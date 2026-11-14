const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { listAssigned, getAssignedDetail, decideRequest, getApprovalHistory } = require('../controllers/approval.controller');
router.use(protect);
router.get('/assigned', listAssigned);
router.get('/:id/history', getApprovalHistory);
router.get('/:id', getAssignedDetail);
router.post('/:id/decision', decideRequest);
module.exports = router;
