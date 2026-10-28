const { Prisma } = require('@prisma/client');
const config = require('../config/env');

async function calcPoints(db, uid) {
  const rows = await db.$queryRaw`
    SELECT COALESCE(SUM(od.qty * od.unit_price), 0) AS total
    FROM order_details od
    JOIN orders o ON o.oid = od.oid
    WHERE o.uid = ${uid}
      AND EXISTS (
        SELECT 1 FROM shipments s
        WHERE s.oid = o.oid AND s.status = 'DELIVERED'
      )
  `;
  const spent = new Prisma.Decimal(rows[0].total);
  const points = spent.div(config.pointUnit).floor().toNumber();
  return { spent, points };
}

async function syncTier(tx, uid) {
  await tx.$queryRaw`SELECT uid FROM users WHERE uid = ${uid} FOR UPDATE`;

  const { points } = await calcPoints(tx, uid);

  const tier = await tx.memberShip.findFirst({
    where: { score: { lte: points } },
    orderBy: { score: 'desc' },
  });
  if (!tier) return null;

  const user = await tx.user.findUnique({ where: { uid }, select: { mid: true } });
  if (user && user.mid !== tier.mid) {
    await tx.user.update({ where: { uid }, data: { mid: tier.mid } });
  }
  return tier;
}

module.exports = { calcPoints, syncTier };