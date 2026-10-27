const express = require('express');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.use(express.json());

app.use('/health', healthRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Không tìm thấy đường dẫn' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ' });
});

module.exports = app;