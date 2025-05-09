require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const questionRoutes = require('./routes/questionRoutes');
const mockQuestionRoutes = require('./routes/mockQuestionRoutes');
const pdfRoutes = require('./routes/pdfRoutes'); 
const advanceGeminiRoutes = require('./routes/AdvanceGemniRoutes');
const minimalGeminiRoutes = require('./routes/MinimalRoute'); // Add this line for Minimal Generator

const app = express();
app.use(cors());
app.use(express.json());

// API routes
// app.use('/api/questions', questionRoutes);  // http://localhost:5000/api/questions/generate
app.use('/api/questions', mockQuestionRoutes);  // Mock API
app.use('/api/pdf', pdfRoutes);                 // PDF generation
// app.use('/api/deepseek-questions', deepSeekRoutes); // http://localhost:5000/api/deepseek-questions/generate
app.use('/api/gemini', advanceGeminiRoutes); // http://localhost:5000/api/gemini/generate-advanced-questions
app.use('/api/gemini', minimalGeminiRoutes); // http://localhost:5000/api/gemini/generate-minimal-questions

const PORT = process.env.PORT || 5000;



// app.listen(PORT, '0.0.0.0', () => {
//   console.log('Server running on port 5000');
// });

app.listen(PORT, ()=>{
  console.log("Server is Running on the PORt",PORT)
})

