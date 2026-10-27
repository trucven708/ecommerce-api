const prisma = require('../config/prisma');

const MAX_INT = 2147483647;

function parsePid(value) {
  const pid = Number(value);
  return Number.isInteger(pid) && pid > 0 && pid <= MAX_INT ? pid : null;
}

function validateProduct(body) {
  const { pname, price, quantity } = body || {};

  if (typeof pname !== 'string' || pname.trim().length < 1 || pname.trim().length > 100) {
    return 'pname phải là chuỗi từ 1 đến 100 ký tự';
  }
  if (
    typeof price !== 'number' ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 99999999.99 ||
    Math.round(price * 100) / 100 !== price
  ) {
    return 'price phải là số từ 0 đến 99999999.99, tối đa 2 chữ số thập phân';
  }
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_INT) {
    return 'quantity phải là số nguyên không âm';
  }
  return null;
}

async function list(req, res, next) {
  try {
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 1000000);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where = q ? { pname: { contains: q, mode: 'insensitive' } } : {};

    const [total, items] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { pid: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const pid = parsePid(req.params.pid);
    if (!pid) return res.status(400).json({ message: 'pid không hợp lệ' });

    const product = await prisma.product.findUnique({ where: { pid } });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    return res.status(200).json(product);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ message: error });

    const { pname, price, quantity } = req.body;
    const product = await prisma.product.create({
      data: { pname: pname.trim(), price, quantity },
    });

    return res.status(201).json(product);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const pid = parsePid(req.params.pid);
    if (!pid) return res.status(400).json({ message: 'pid không hợp lệ' });

    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ message: error });

    const { pname, price, quantity } = req.body;
    const product = await prisma.product.update({
      where: { pid },
      data: { pname: pname.trim(), price, quantity },
    });

    return res.status(200).json(product);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const pid = parsePid(req.params.pid);
    if (!pid) return res.status(400).json({ message: 'pid không hợp lệ' });

    await prisma.product.delete({ where: { pid } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ message: 'Không thể xóa: sản phẩm đã có trong đơn hàng' });
    }
    return next(err);
  }
}

module.exports = { list, getOne, create, update, remove };