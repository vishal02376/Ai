const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

// POST /api/pdf/generate
router.post('/generate', pdfController.generatePDF);

module.exports = router;