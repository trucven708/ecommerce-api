const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      database: 'up',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'down',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;