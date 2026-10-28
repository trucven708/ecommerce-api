const express = require('express');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');

const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Không tìm thấy đường dẫn' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ' });
});

module.exports = app;