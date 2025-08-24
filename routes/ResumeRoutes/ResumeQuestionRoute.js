const express = require('express');
const router = express.Router();
const multer = require('multer');
const questionController = require('../../controllers/ResumeBased/ResumeQuestionControllers');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
    }
  }
});

// API Routes
router.post('/parse-resume', upload.single('resume'), questionController.parseResume);
router.post('/generate-questions', questionController.generateQuestions);

module.exports = router;