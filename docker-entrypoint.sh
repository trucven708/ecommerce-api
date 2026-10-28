#!/bin/sh
set -e

echo "Chạy migration..."
npx prisma migrate deploy

echo "Nạp dữ liệu mặc định..."
node prisma/seed.js

echo "Khởi động server..."
exec node src/server.js