const express = require('express');
const router  = express.Router();
const {
  createFeeStructure, getFeeStructures, getFeeStructure,
  updateFeeStructure, assignFeeToStudent, assignFeeToClass,
  getStudentFeeAssignments, adjustFeeAmount, addFeeToStudent
} = require('../controllers/fee.controller');
const { protect }   = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');
const staff = authorize('admin','bursar');
const admin = authorize('admin');

router.post('/structures', protect, admin, requireActiveSubscription, createFeeStructure);
router.get('/structures', protect, staff, getFeeStructures);
router.get('/structures/:id', protect, staff, getFeeStructure);
router.patch('/structures/:id',       protect, admin, updateFeeStructure);
router.post('/assign',                protect, staff, requireActiveSubscription, assignFeeToStudent);
router.post('/assign-class',          protect, staff, requireActiveSubscription, assignFeeToClass);
router.get('/assignments/:studentId', protect, authorize('admin','bursar','parent'), getStudentFeeAssignments);
router.patch('/assignments/:id/adjust', protect, staff, adjustFeeAmount);
router.post('/assign-custom', protect, staff, requireActiveSubscription, addFeeToStudent);

module.exports = router;