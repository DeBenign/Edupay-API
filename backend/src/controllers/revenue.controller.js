// src/controllers/revenue.controller.js
const { getPlatformRevenue, getSchoolRevenue, getAllSchoolsRevenue } = require('../services/revenue.service');
const { success, error, forbidden } = require('../utils/apiResponse');

// GET /api/revenue/platform — platform admin only (route-gated)
const platformRevenue = async (req, res) => {
  try {
    const { from, to } = req.query;
    const revenue = await getPlatformRevenue({ from, to });
    return success(res, { revenue });
  } catch (err) { return error(res, err.message); }
};

// GET /api/revenue/schools — every school's revenue at a glance, platform admin only
const allSchoolsRevenue = async (req, res) => {
  try {
    const schools = await getAllSchoolsRevenue();
    return success(res, { schools });
  } catch (err) { return error(res, err.message); }
};

// GET /api/revenue/schools/:schoolId?term=&academicSession=
// A school's own admin/bursar can see their own school; platform admin can see any.
const oneSchoolRevenue = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const isOwnSchool = req.user.schoolId?.toString() === schoolId;
    if (!isOwnSchool && !req.platformAdmin) {
      return forbidden(res, 'You can only view your own school\'s revenue');
    }
    const { term, academicSession } = req.query;
    const revenue = await getSchoolRevenue(schoolId, { term, academicSession });
    return success(res, { revenue });
  } catch (err) { return error(res, err.message); }
};

module.exports = { platformRevenue, allSchoolsRevenue, oneSchoolRevenue };