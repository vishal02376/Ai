const express = require('express');
const router = express.Router();
const deepSeekController = require('../controllers/deepSeekQuestions'); // Filename changed

// POST /api/deepseek-questions/generate
router.post('/generate', deepSeekController.generateQuestions);

module.exports = router;