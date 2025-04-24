// routes/AdvanceGemniRoutes.js

const express = require('express');
const router = express.Router();
const {
  generateAdvancedQuestions
} = require('../controllers/AdvancedGemniControllers');

router.post('/generate-advanced-questions', generateAdvancedQuestions);

module.exports = router;