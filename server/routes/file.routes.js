const express = require('express');
const router = express.Router();
const { getFile, previewFile } = require('../controllers/file.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/:id/preview', protect, previewFile);
router.get('/:id', protect, getFile);

module.exports = router;
