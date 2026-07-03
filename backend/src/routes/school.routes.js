// src/routes/school.routes.js
const express = require('express');
const router = express.Router();
const { createSchool, getMySchool, updateSchool } = require('../controllers/school.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.post('/',      protect, authorize('admin'), createSchool);
router.get('/me',     protect,                     getMySchool);
router.patch('/:id',  protect, authorize('admin'), updateSchool);

module.exports = router;
