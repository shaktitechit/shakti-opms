const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireUserManagerAdmin } = require('../../middlewares/userManagerAuth.middleware');

router.use(requireAuth);
router.use(requireUserManagerAdmin);

router.get('/roles', userController.listRoles);
router.post('/roles/seed', userController.seedRoles);
router.post('/roles', userController.createRole);
router.put('/roles/:id', userController.updateRole);
router.delete('/roles/:id', userController.deleteRole);

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.get('/:id', userController.getUser);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
