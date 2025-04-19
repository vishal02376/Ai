const express = require('express');
const router = express.Router();
const deepSeekController = require('../controllers/deepSeekQuestions'); // Filename changed

// POST /api/deepseek-questions/generate
router.post('/generate', deepSeekController.generateQuestions);

module.exports = router;







  // Handle form submission and API call
  // const handleGenerate = async () => {
  //   try {
  //     const response = await axios.post(
  //       "http://localhost:5000/api/gemini/generate-questions",
  //       formData
  //     );
  //     setGeneratedQuestions(response.data.questions); // Directly use the array
  //   } catch (error) {
  //     console.error("Error generating questions:", error.message);
  //   }
  // };