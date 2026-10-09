const AppError = require('../utils/AppError');

exports.notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

exports.errorHandler = (err, req, res, next) => {
  let error = err;

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors: details });
  }
  if (err.name === 'CastError') {
    error = new AppError(`Invalid value for ${err.path}: ${err.value}`, 400);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    error = new AppError(`Duplicate value: a product with this ${field} already exists`, 409);
  }
  if (err.type === 'entity.parse.failed') {
    error = new AppError('Malformed JSON in request body', 400);
  }

  const status = error.statusCode || 500;
  const body = {
    success: false,
    message: error.isOperational ? error.message : 'Internal server error',
  };
  if (process.env.NODE_ENV === 'development' && !error.isOperational) body.stack = err.stack;
  if (status === 500) console.error(err);
  res.status(status).json(body);
};
