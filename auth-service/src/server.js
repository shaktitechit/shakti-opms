const mongoose = require('mongoose');
const app = require('./app');
const { PORT, MONGO_URI } = require('./config/env');
const User = require('./models/User');
const departmentService = require('./modules/departments/department.service');
const userService = require('./modules/users/user.service');

async function syncUserIndexes() {
  try {
    const indexes = await User.collection.indexes();
    const legacyEmailIndex = indexes.find(
      (idx) => idx.name === 'email_1' && !idx.partialFilterExpression
    );
    if (legacyEmailIndex) {
      await User.collection.dropIndex('email_1');
      console.log('[auth-service] Dropped legacy email_1 index to enable partial unique index');
    }
    await User.syncIndexes();
  } catch (err) {
    console.warn('[auth-service] User index sync notice:', err?.message || err);
  }
}

async function ensureDefaults() {
  try {
    await syncUserIndexes();
    const deptResults = await departmentService.seedDefaultDepartments();
    const roleResults = await userService.seedDefaultRoles();
    const createdDepts = deptResults.filter((r) => r.status === 'created').length;
    const createdRoles = roleResults.filter((r) => r.status === 'created').length;
    if (createdDepts || createdRoles) {
      console.log(
        `[auth-service] Seeded defaults: ${createdDepts} department(s), ${createdRoles} role(s)`
      );
    }
  } catch (err) {
    console.warn('[auth-service] Default department/role seed skipped:', err?.message || err);
  }
}

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[auth-service] Connected to MongoDB');

    await ensureDefaults();

    app.listen(PORT, () => {
      console.log(`[auth-service] Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[auth-service] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
