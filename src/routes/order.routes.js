const express = require('express');
const { create, list, getOne } = require('../controllers/order.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.post('/', create);
router.get('/', list);
router.get('/:oid', getOne);

module.exports = router;