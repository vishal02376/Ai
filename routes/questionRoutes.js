const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

router.post('/generate', questionController.generateQuestions);
module.exports = router;





