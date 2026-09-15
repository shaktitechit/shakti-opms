const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ApiError } = require('../../utils/ApiError');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const { sanitizeUser } = require('../../utils/sanitize');
const User = require('../../models/User');
const {
  loadUserForJwtSub,
  authenticate,
  matchesMasterPassword,
} = require('./mongoUserBridge');

function registerToken(user) {
  // Claims are a snapshot for clients; servers re-load the user from Mongo on each request.
  const payload = {
    sub: String(user._id),
    name: user.name,
    email: user.email,
    department: user.department,
    roles: user.roles || [],
    role_codes: user.role_codes || [],
    role_names: user.role_names || [],
    portals: user.portals || [],
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function login(email, password) {
  const user = await authenticate(email, password);
  if (!user) throw new ApiError(401, 'Invalid credentials');

  const token = registerToken(user);
  return { token, user };
}

async function me(userId) {
  const u = await loadUserForJwtSub(userId);
  if (!u) throw new ApiError(401, 'Unauthorized');
  return sanitizeUser(u);
}

async function changePassword(userId, currentPassword, newPassword) {
  const current = String(currentPassword || '');
  const next = String(newPassword || '');
  if (!current) throw new ApiError(400, 'Current password is required');
  if (next.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }
  if (current === next) {
    throw new ApiError(400, 'New password must be different from the current password');
  }

  const doc = await User.findById(userId).select('+password');
  if (!doc || doc.is_active === false) throw new ApiError(401, 'Unauthorized');

  const ok =
    (typeof matchesMasterPassword === 'function' && matchesMasterPassword(current))
    || await bcrypt.compare(current, doc.password);
  if (!ok) throw new ApiError(400, 'Current password is incorrect');

  doc.password = await bcrypt.hash(next, 10);
  await doc.save();
  return { success: true };
}

module.exports = {
  login,
  me,
  changePassword,
  registerToken,
};
