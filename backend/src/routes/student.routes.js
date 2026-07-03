// src/routes/student.routes.js
const express = require('express');
const router = express.Router();
const {
  enrollStudent,
  getStudents,
  getStudent,
  updateStudent,
  deactivateStudent,
  retryAccountProvisioning,
  getStudentAccount,
} = require('../controllers/student.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const staff = authorize('admin', 'bursar');

// Collection routes
router.post('/',   protect, staff,                        enrollStudent);
router.get('/',    protect, authorize('admin', 'bursar'), getStudents);

// Individual student routes
router.get('/:id',          protect, authorize('admin', 'bursar', 'parent'), getStudent);
router.patch('/:id',        protect, staff,                                  updateStudent);
router.delete('/:id',       protect, authorize('admin'),                     deactivateStudent);

// Virtual account routes
router.get('/:id/account',            protect, authorize('admin', 'bursar', 'parent'), getStudentAccount);
router.post('/:id/provision-account', protect, staff,                                  retryAccountProvisioning);

module.exports = router;
