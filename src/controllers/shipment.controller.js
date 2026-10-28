const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');
const { syncTier } = require('../services/membership.service');

const MAX_INT = 2147483647;
const ALL_STATUS = ['PENDING', 'SHIPPING', 'DELIVERED'];
const NEXT_STATUS = { PENDING: 'SHIPPING', SHIPPING: 'DELIVERED' };

const isId = (value) => Number.isInteger(value) && value > 0 && value <= MAX_INT;

function handleError(err, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  return next(err);
}

async function create(req, res, next) {
  try {
    const oid = req.body && req.body.oid;
    if (!isId(oid)) {
      return res.status(400).json({ message: 'oid phải là số nguyên dương' });
    }

    const shipment = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw`SELECT oid FROM orders WHERE oid = ${oid} FOR UPDATE`;
      if (locked.length === 0) {
        throw new HttpError(404, 'Không tìm thấy đơn hàng');
      }

      const existing = await tx.shipment.findFirst({ where: { oid } });
      if (existing) {
        throw new HttpError(409, 'Đơn hàng này đã có vận đơn');
      }

      return tx.shipment.create({ data: { oid, status: 'PENDING' } });
    });

    return res.status(201).json({
      shipid: shipment.shipid,
      oid: shipment.oid,
      status: shipment.status,
    });
  } catch (err) {
    return handleError(err, res, next);
  }
}

async function updateStatus(req, res, next) {
  try {
    const shipid = Number(req.params.shipid);
    if (!isId(shipid)) {
      return res.status(400).json({ message: 'shipid không hợp lệ' });
    }

    const status = req.body && req.body.status;
    if (!ALL_STATUS.includes(status)) {
      return res.status(400).json({ message: `status phải là một trong: ${ALL_STATUS.join(', ')}` });
    }

    const result = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { shipid },
        include: { order: { select: { uid: true } } },
      });
      if (!shipment) {
        throw new HttpError(404, 'Không tìm thấy vận đơn');
      }

      if (NEXT_STATUS[shipment.status] !== status) {
        throw new HttpError(409, `Không thể chuyển từ ${shipment.status} sang ${status}`);
      }

      const changed = await tx.shipment.updateMany({
        where: { shipid, status: shipment.status },
        data: { status },
      });
      if (changed.count === 0) {
        throw new HttpError(409, 'Trạng thái vừa được thay đổi, hãy thử lại');
      }

      let membership = null;
      if (status === 'DELIVERED') {
        const tier = await syncTier(tx, shipment.order.uid);
        membership = tier ? tier.mname : null;
      }

      return { shipid, oid: shipment.oid, status, membership };
    });

    const body = { shipid: result.shipid, oid: result.oid, status: result.status };
    if (result.membership) body.membership = result.membership;
    return res.status(200).json(body);
  } catch (err) {
    return handleError(err, res, next);
  }
}

module.exports = { create, updateStatus };