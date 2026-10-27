const express = require('express');
const { list, getOne, create, update, remove } = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', list);
router.get('/:pid', getOne);

router.post('/', authenticate, authorize('admin'), create);
router.put('/:pid', authenticate, authorize('admin'), update);
router.delete('/:pid', authenticate, authorize('admin'), remove);

module.exports = router;