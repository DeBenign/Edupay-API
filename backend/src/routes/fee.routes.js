// src/routes/fee.routes.js
const express = require('express');
const router = express.Router();
const {
  createFeeStructure,
  getFeeStructures,
  getFeeStructure,
  updateFeeStructure,
  assignFeeToStudent,
  assignFeeToClass,
  getStudentFeeAssignments,
} = require('../controllers/fee.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const staff  = authorize('admin', 'bursar');
const admin  = authorize('admin');

// Fee structures
router.post('/structures',       protect, admin,  createFeeStructure);
router.get('/structures',        protect, staff,  getFeeStructures);
router.get('/structures/:id',    protect, staff,  getFeeStructure);
router.patch('/structures/:id',  protect, admin,  updateFeeStructure);

// Assignments
router.post('/assign',              protect, staff, assignFeeToStudent);
router.post('/assign-class',        protect, staff, assignFeeToClass);
router.get('/assignments/:studentId', protect, authorize('admin','bursar','parent'), getStudentFeeAssignments);

module.exports = router;
