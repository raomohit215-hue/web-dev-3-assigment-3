const express = require('express');
const c = require('../controllers/productController');
const v = require('../middleware/validate');

const router = express.Router();

// Reports first so "reports" is never treated as an :id
router.get('/reports/low-stock', c.getLowStockReport);
router.get('/reports/category-summary', c.getCategorySummary);

router.route('/')
  .get(c.getProducts)
  .post(v.validateCreateProduct, c.createProduct);

router.route('/:id')
  .all(v.validateObjectId)
  .get(c.getProduct)
  .put(v.validateUpdateProduct, c.updateProduct)
  .patch(v.validateUpdateProduct, c.updateProduct)
  .delete(c.deleteProduct);

router.patch('/:id/restock', v.validateObjectId, v.validateStockChange, c.restockProduct);
router.patch('/:id/sale', v.validateObjectId, v.validateStockChange, c.sellProduct);

module.exports = router;
