const AppError = require('../utils/AppError');

const CREATE_FIELDS = ['name', 'sku', 'description', 'category', 'price', 'quantity', 'lowStockThreshold', 'supplier'];
// quantity is changed only through /restock and /sale
const UPDATE_FIELDS = CREATE_FIELDS.filter((f) => f !== 'quantity');
const STRING_FIELDS = ['name', 'sku', 'description', 'category', 'supplier'];
const NUMBER_FIELDS = ['price', 'quantity', 'lowStockThreshold'];

exports.validateObjectId = (req, res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return next(new AppError(`Invalid product id: ${req.params.id}`, 400));
  }
  next();
};

const buildProductValidator = (isUpdate) => (req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(new AppError('Request body must be a JSON object', 400));
  }
  const allowed = isUpdate ? UPDATE_FIELDS : CREATE_FIELDS;
  const clean = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) clean[key] = req.body[key];
  }

  if (isUpdate && Object.keys(clean).length === 0) {
    return next(new AppError(`Provide at least one updatable field: ${allowed.join(', ')}`, 400));
  }
  // Type checks also block NoSQL-injection payloads such as { "$gt": "" }
  for (const f of STRING_FIELDS) {
    if (f in clean && typeof clean[f] !== 'string') {
      return next(new AppError(`${f} must be a string`, 400));
    }
  }
  for (const f of NUMBER_FIELDS) {
    if (f in clean && (typeof clean[f] !== 'number' || !Number.isFinite(clean[f]))) {
      return next(new AppError(`${f} must be a number`, 400));
    }
  }
  req.body = clean;
  next();
};

exports.validateCreateProduct = buildProductValidator(false);
exports.validateUpdateProduct = buildProductValidator(true);

exports.validateStockChange = (req, res, next) => {
  const q = req.body && req.body.quantity;
  if (typeof q !== 'number' || !Number.isInteger(q) || q <= 0) {
    return next(new AppError('quantity must be a positive whole number', 400));
  }
  req.body = { quantity: q };
  next();
};
