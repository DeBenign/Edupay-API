// src/controllers/revenue.controller.js
const { getPlatformRevenue, getSchoolRevenue } = require('../services/revenue.service');
const { success, error, forbidden } = require('../utils/apiResponse');

// GET /api/revenue/platform — platform admin only (route-gated)
const platformRevenue = async (req, res) => {
  try {
    const { from, to } = req.query;
    const revenue = await getPlatformRevenue({ from, to });
    return success(res, { revenue });
  } catch (err) { return error(res, err.message); }
};

// GET /api/revenue/schools/:schoolId?term=&academicSession=
// Only a school's own admin/bursar can see that school's revenue. Platform admin cannot.
const oneSchoolRevenue = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const isStaffOfSchool = ['admin', 'bursar'].includes(req.user.role) && req.user.schoolId?.toString() === schoolId;
    if (!isStaffOfSchool) {
      return forbidden(res, 'You can only view your own school\'s revenue');
    }
    const { term, academicSession } = req.query;
    const revenue = await getSchoolRevenue(schoolId, { term, academicSession });
    return success(res, { revenue });
  } catch (err) { return error(res, err.message); }
};

module.exports = { platformRevenue, oneSchoolRevenue };