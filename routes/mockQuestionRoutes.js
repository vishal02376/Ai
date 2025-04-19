const express = require('express');
const router = express.Router();
const mockController = require('../controllers/mockQuestionController');

router.post('/mock', mockController.generateQuestions);
module.exports = router;