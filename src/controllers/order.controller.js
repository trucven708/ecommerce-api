const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');

const MAX_INT = 2147483647;
const MAX_ITEMS = 50;

const orderInclude = {
  details: { include: { product: true }, orderBy: { pid: 'asc' } },
  shipments: true,
};

function parseOrderId(value) {
  const oid = Number(value);
  return Number.isInteger(oid) && oid > 0 && oid <= MAX_INT ? oid : null;
}

function parseItems(body) {
  const items = body && body.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    throw new HttpError(400, `items phải là mảng từ 1 đến ${MAX_ITEMS} phần tử`);
  }

  const merged = new Map();
  for (const item of items) {
    const pid = item && item.pid;
    const qty = item && item.qty;
    if (!Number.isInteger(pid) || pid < 1 || pid > MAX_INT) {
      throw new HttpError(400, 'pid phải là số nguyên dương');
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_INT) {
      throw new HttpError(400, 'qty phải là số nguyên dương');
    }
    const total = (merged.get(pid) || 0) + qty;
    if (total > MAX_INT) {
      throw new HttpError(400, 'Tổng số lượng quá lớn');
    }
    merged.set(pid, total);
  }

  return [...merged.entries()]
    .map(([pid, qty]) => ({ pid, qty }))
    .sort((a, b) => a.pid - b.pid);
}

function formatOrder(order) {
  let total = new Prisma.Decimal(0);
  const items = order.details.map((d) => {
    const subtotal = d.unit_price.mul(d.qty);
    total = total.plus(subtotal);
    return {
      pid: d.pid,
      pname: d.product.pname,
      qty: d.qty,
      unit_price: d.unit_price.toFixed(2),
      subtotal: subtotal.toFixed(2),
    };
  });

  return {
    oid: order.oid,
    uid: order.uid,
    createat: order.createat,
    items,
    total: total.toFixed(2),
    shipments: order.shipments.map((s) => ({ shipid: s.shipid, status: s.status })),
  };
}

async function create(req, res, next) {
  try {
    const items = parseItems(req.body);

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { pid: { in: items.map((i) => i.pid) } },
      });
      const byPid = new Map(products.map((p) => [p.pid, p]));

      for (const item of items) {
        if (!byPid.has(item.pid)) {
          throw new HttpError(404, `Không tìm thấy sản phẩm pid=${item.pid}`);
        }
      }

      for (const item of items) {
        const result = await tx.product.updateMany({
          where: { pid: item.pid, quantity: { gte: item.qty } },
          data: { quantity: { decrement: item.qty } },
        });
        if (result.count === 0) {
          throw new HttpError(409, `Sản phẩm pid=${item.pid} không đủ hàng`);
        }
      }

      return tx.order.create({
        data: {
          uid: req.user.uid,
          details: {
            create: items.map((item) => ({
              pid: item.pid,
              qty: item.qty,
              unit_price: byPid.get(item.pid).price,
            })),
          },
        },
        include: orderInclude,
      });
    });

    return res.status(201).json(formatOrder(order));
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ message: err.message });
    }
    if (err.code === 'P2003') {
      return res.status(401).json({ message: 'Tài khoản không còn tồn tại' });
    }
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 1000000);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const where = req.user.role === 'admin' ? {} : { uid: req.user.uid };

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { oid: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: orderInclude,
      }),
    ]);

    return res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: orders.map(formatOrder),
    });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const oid = parseOrderId(req.params.oid);
    if (!oid) return res.status(400).json({ message: 'oid không hợp lệ' });

    const order = await prisma.order.findUnique({ where: { oid }, include: orderInclude });
    const allowed = order && (req.user.role === 'admin' || order.uid === req.user.uid);
    if (!allowed) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    return res.status(200).json(formatOrder(order));
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, list, getOne };