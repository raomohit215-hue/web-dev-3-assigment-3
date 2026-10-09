const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const SORTABLE = ['name', 'price', 'quantity', 'category', 'createdAt', 'updatedAt'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// POST /api/products
exports.createProduct = catchAsync(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, data: product });
});

// GET /api/products?category=&minPrice=&maxPrice=&inStock=&search=&sort=&page=&limit=
exports.getProducts = catchAsync(async (req, res) => {
  const { category, minPrice, maxPrice, inStock, search, supplier } = req.query;
  const filter = {};

  if (typeof category === 'string') filter.category = category.toLowerCase();
  if (typeof supplier === 'string') filter.supplier = supplier;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) {
      if (isNaN(minPrice)) throw new AppError('minPrice must be a number', 400);
      filter.price.$gte = Number(minPrice);
    }
    if (maxPrice !== undefined) {
      if (isNaN(maxPrice)) throw new AppError('maxPrice must be a number', 400);
      filter.price.$lte = Number(maxPrice);
    }
  }
  if (inStock === 'true') filter.quantity = { $gt: 0 };
  if (inStock === 'false') filter.quantity = 0;

  if (typeof search === 'string' && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { description: rx }];
  }

  // Sorting: ?sort=price,-createdAt (whitelisted fields only)
  let sort = '-createdAt';
  if (typeof req.query.sort === 'string') {
    const fields = req.query.sort.split(',').map((s) => s.trim()).filter(Boolean);
    for (const f of fields) {
      if (!SORTABLE.includes(f.replace(/^-/, ''))) {
        throw new AppError(`Cannot sort by '${f}'. Allowed: ${SORTABLE.join(', ')}`, 400);
      }
    }
    if (fields.length) sort = fields.join(' ');
  }

  // Pagination
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: products.length,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data: products,
  });
});

// GET /api/products/:id
exports.getProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, data: product });
});

// PUT|PATCH /api/products/:id  (details only; stock goes via restock/sale)
exports.updateProduct = catchAsync(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, data: product });
});

// PATCH /api/products/:id/restock  { "quantity": 25 }
// Atomic $inc: safe under concurrent requests
exports.restockProduct = catchAsync(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $inc: { quantity: req.body.quantity } },
    { new: true, runValidators: true }
  );
  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, message: `Restocked ${req.body.quantity} unit(s)`, data: product });
});

// PATCH /api/products/:id/sale  { "quantity": 3 }
// The filter { quantity: { $gte: qty } } and the $inc happen in ONE atomic
// operation, so stock can never go negative even with simultaneous sales.
exports.sellProduct = catchAsync(async (req, res) => {
  const { quantity } = req.body;
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, quantity: { $gte: quantity } },
    { $inc: { quantity: -quantity } },
    { new: true }
  );
  if (!product) {
    const exists = await Product.findById(req.params.id).select('quantity');
    if (!exists) throw new AppError('Product not found', 404);
    throw new AppError(`Insufficient stock: requested ${quantity}, available ${exists.quantity}`, 409);
  }
  res.json({
    success: true,
    message: `Sold ${quantity} unit(s)`,
    lowStockWarning: product.isLowStock,
    data: product,
  });
});

// DELETE /api/products/:id
exports.deleteProduct = catchAsync(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, message: 'Product deleted', data: { id: product._id } });
});

// GET /api/products/reports/low-stock  (quantity <= lowStockThreshold)
exports.getLowStockReport = catchAsync(async (req, res) => {
  const products = await Product.aggregate([
    { $match: { $expr: { $lte: ['$quantity', '$lowStockThreshold'] } } },
    {
      $project: {
        name: 1, sku: 1, category: 1, quantity: 1, lowStockThreshold: 1, supplier: 1,
        shortage: { $subtract: ['$lowStockThreshold', '$quantity'] },
        status: { $cond: [{ $eq: ['$quantity', 0] }, 'OUT_OF_STOCK', 'LOW_STOCK'] },
      },
    },
    { $sort: { quantity: 1, name: 1 } },
  ]);
  res.json({ success: true, count: products.length, data: products });
});

// GET /api/products/reports/category-summary
exports.getCategorySummary = catchAsync(async (req, res) => {
  const summary = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        totalProducts: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        averagePrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        lowStockCount: {
          $sum: { $cond: [{ $lte: ['$quantity', '$lowStockThreshold'] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        totalProducts: 1,
        totalQuantity: 1,
        totalStockValue: { $round: ['$totalStockValue', 2] },
        averagePrice: { $round: ['$averagePrice', 2] },
        minPrice: 1, maxPrice: 1, lowStockCount: 1,
      },
    },
    { $sort: { totalStockValue: -1 } },
  ]);

  const overall = summary.reduce(
    (acc, c) => ({
      categories: acc.categories + 1,
      products: acc.products + c.totalProducts,
      units: acc.units + c.totalQuantity,
      stockValue: +(acc.stockValue + c.totalStockValue).toFixed(2),
    }),
    { categories: 0, products: 0, units: 0, stockValue: 0 }
  );
  res.json({ success: true, overall, data: summary });
});
