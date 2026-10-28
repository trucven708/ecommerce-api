const express = require('express');
const { list, me } = require('../controllers/membership.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', list);
router.get('/me', authenticate, me);

module.exports = router;