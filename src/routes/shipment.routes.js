const express = require('express');
const { create, updateStatus } = require('../controllers/shipment.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.post('/', create);
router.patch('/:shipid', updateStatus);

module.exports = router;