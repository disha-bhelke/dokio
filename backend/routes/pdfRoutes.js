const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { generatePdf } = require('../controllers/pdfController');

router.post('/generate', protect, generatePdf);

module.exports = router;
