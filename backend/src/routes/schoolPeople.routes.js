const router = require('express').Router();
const { protect }   = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { listByRole, setActive, resetBursarPassword, bulkParents } = require('../controllers/schoolPeople.controller');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(protect, authorize('admin'));
router.get('/bursars', listByRole('bursar'));
router.get('/parents', listByRole('parent'));
// Parents only: manual (auth/create-staff) + bulk. Bursars stay manual.
router.post('/parents/bulk', requireActiveSubscription, bulkParents);
router.patch('/:id/deactivate', setActive(false));
router.patch('/:id/reactivate', setActive(true));
router.post('/:id/reset-password', resetBursarPassword);

module.exports = router;