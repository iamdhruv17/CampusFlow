const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { createRequest, listMyRequests, getRequestSummary, getRequestById, resubmitRequest } = require('../controllers/request.controller');

// All student request routes require the existing Member 1 authentication session.
router.use(protect);
router.get('/summary', getRequestSummary);
router.route('/').get(listMyRequests).post(createRequest);
router.get('/:id', getRequestById);
router.patch('/:id/resubmit', resubmitRequest);

module.exports = router;
