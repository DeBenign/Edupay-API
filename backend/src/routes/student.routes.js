const express = require('express');
const router  = express.Router();
const {
  enrollStudent, getStudents, getStudent, updateStudent,
  deactivateStudent, retryAccountProvisioning, getStudentAccount,
} = require('../controllers/student.controller');
const { protect }   = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const staff  = authorize('admin','bursar');
const all    = authorize('admin','bursar','parent');

router.post('/',                        protect, staff,  enrollStudent);
router.get('/',                         protect, staff,  getStudents);
router.get('/:id',                      protect, all,    getStudent);
router.patch('/:id',                    protect, staff,  updateStudent);
router.delete('/:id',                   protect, authorize('admin'), deactivateStudent);
router.get('/:id/account',              protect, all,    getStudentAccount);
router.post('/:id/provision-account',   protect, staff,  retryAccountProvisioning);

module.exports = router;
