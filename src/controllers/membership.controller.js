const prisma = require('../config/prisma');
const config = require('../config/env');
const { calcPoints } = require('../services/membership.service');

async function list(req, res, next) {
  try {
    const tiers = await prisma.memberShip.findMany({ orderBy: { score: 'asc' } });
    return res.status(200).json(tiers);
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: req.user.uid },
      include: { membership: true },
    });
    if (!user) {
      return res.status(401).json({ message: 'Tài khoản không còn tồn tại' });
    }

    const { spent, points } = await calcPoints(prisma, user.uid);
    const upcoming = await prisma.memberShip.findFirst({
      where: { score: { gt: points } },
      orderBy: { score: 'asc' },
    });

    return res.status(200).json({
      membership: user.membership.mname,
      points,
      spent: spent.toFixed(2),
      pointUnit: config.pointUnit,
      nextTier: upcoming
        ? { mname: upcoming.mname, pointsNeeded: upcoming.score - points }
        : null,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, me };