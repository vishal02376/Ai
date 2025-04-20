const express = require('express');
const router = express.Router();
const minimalController = require('../controllers/MinimalGemeni');

router.post('/generate-minimal-questions', minimalController.generateMinimalQuestions);
module.exports = router;