const express = require('express');
const router = express.Router();
const {
  testConnection,
  generateQuestions
} = require('../controllers/geminiController');

// Test route
// router.get('/test', testConnection);

// Main functionality
router.post('/generate-questions', generateQuestions);

module.exports = router;