const router = require('express').Router();
const { protect }   = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { listByRole, setActive, resetBursarPassword } = require('../controllers/schoolPeople.controller');

router.use(protect, authorize('admin'));
router.get('/bursars', listByRole('bursar'));
router.get('/parents', listByRole('parent'));
router.patch('/:id/deactivate', setActive(false));
router.patch('/:id/reactivate', setActive(true));
router.post('/:id/reset-password', resetBursarPassword);

module.exports = router;