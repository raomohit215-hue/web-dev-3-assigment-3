// Wraps async handlers so rejected promises reach the error middleware
module.exports = (fn) => (req, res, next) => fn(req, res, next).catch(next);
