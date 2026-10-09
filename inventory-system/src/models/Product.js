const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9-]{3,30}$/, 'SKU must be 3-30 chars: letters, digits, hyphens'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      min: [0, 'Threshold cannot be negative'],
      default: 10,
    },
    supplier: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Computed fields (not stored)
productSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.lowStockThreshold;
});
productSchema.virtual('stockValue').get(function () {
  return this.price * this.quantity;
});

module.exports = mongoose.model('Product', productSchema);
