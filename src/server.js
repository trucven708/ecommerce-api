const config = require('./config/env');
const app = require('./app');
const prisma = require('./config/prisma');

const server = app.listen(config.port, () => {
  console.log(`Server chạy tại http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`Nhận ${signal}, đang tắt server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));