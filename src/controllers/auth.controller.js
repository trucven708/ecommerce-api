const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const config = require('../config/env');

const SALT_ROUNDS = 10;

const isText = (value, min, max) =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;

function toPublicUser(user) {
  return {
    uid: user.uid,
    username: user.username,
    fullname: user.fullname,
    role: user.role.rolename,
    membership: user.membership.mname,
  };
}

async function register(req, res, next) {
  try {
    const { username, fullname, password } = req.body || {};

    if (!isText(username, 3, 50) || !isText(fullname, 1, 100)) {
      return res.status(400).json({ message: 'username (3-50 ký tự) và fullname (1-100 ký tự) là bắt buộc' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return res.status(400).json({ message: 'password phải từ 6 đến 72 ký tự' });
    }

    const role = await prisma.role.findUnique({ where: { rolename: 'customer' } });
    const membership = await prisma.memberShip.findUnique({ where: { mname: 'Basic' } });
    if (!role || !membership) {
      return res.status(500).json({ message: 'Chưa có dữ liệu mặc định, hãy chạy: npx prisma db seed' });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        fullname: fullname.trim(),
        password: hashed,
        roleid: role.roleid,
        mid: membership.mid,
      },
      include: { role: true, membership: true },
    });

    return res.status(201).json(toPublicUser(user));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại' });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Cần nhập username và password' });
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
      include: { role: true, membership: true },
    });

    const ok = user && (await bcrypt.compare(password, user.password));
    if (!ok) {
      return res.status(401).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const token = jwt.sign(
      { uid: user.uid, role: user.role.rolename },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: config.jwtExpiresIn }
    );

    return res.status(200).json({
      token,
      tokenType: 'Bearer',
      expiresIn: config.jwtExpiresIn,
      user: toPublicUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: req.user.uid },
      include: { role: true, membership: true },
    });
    if (!user) {
      return res.status(401).json({ message: 'Tài khoản không còn tồn tại' });
    }
    return res.status(200).json(toPublicUser(user));
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me };