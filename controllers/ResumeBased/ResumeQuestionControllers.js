// backend/controllers/ResumeQuestion.js


const axios = require('axios');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Parse resume text from PDF or Word
const parseResumeText = async (fileBuffer, fileType) => {
  try {
    if (fileType === 'application/pdf') {
      const data = await pdf(fileBuffer);
      return data.text;
    } else if (fileType.includes('msword') || fileType.includes('wordprocessingml')) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }
    throw new Error('Unsupported file type');
  } catch (error) {
    console.error('Error parsing resume:', error);
    throw error;
  }
};

// Extract information from resume text
const extractResumeInfo = async (text) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
      Analyze the following resume text and extract the following information in JSON format:
      {
        "jobTitle": "Most relevant job title based on experience",
        "skills": ["array of technical skills mentioned"],
        "experience": "total years of experience as a number"
      }
      
      Resume Text:
      ${text}
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonString = response.text().replace(/```json|```/g, '').trim();
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error extracting resume info:', error);
    throw error;
  }
};

// Generate interview questions using Gemini
const generateInterviewQuestions = async (data) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
      Generate ${data.questionType || 'Technical'} interview questions for a ${data.jobTitle} position.
      The candidate has ${data.experience} years of experience and skills in: ${data.skills.join(', ')}.
      ${data.resumeText ? `Here's additional context from their resume: ${data.resumeText}` : ''}
      
      Requirements:
      1. Generate 10-15 high quality questions
      2. Questions should be in ${data.language || 'English'} language
      3. Format as a JSON array of strings
      4. Include a mix of conceptual and practical questions
      5. For technical roles, include coding/problem-solving questions
      6. For behavioral/situational, use STAR method examples
      
      Return only the JSON array, no additional text or markdown.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonString = response.text().replace(/```json|```/g, '').trim();
    
    return {
      questions: JSON.parse(jsonString),
      metadata: {
        jobTitle: data.jobTitle,
        experience: data.experience,
        skills: data.skills,
        questionType: data.questionType,
        language: data.language,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error generating questions:', error);
    throw error;
  }
};

// Controller methods
exports.parseResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const text = await parseResumeText(req.file.buffer, req.file.mimetype);
    const parsedData = await extractResumeInfo(text);
    
    res.json({
      success: true,
      text,
      ...parsedData
    });
  } catch (error) {
    console.error('Error in parseResume:', error);
    res.status(500).json({ error: 'Failed to parse resume', details: error.message });
  }
};

exports.generateQuestions = async (req, res) => {
  try {
    const { jobTitle, experience, skills, questionType, language, resumeText } = req.body;
    
    if ((!jobTitle || !experience || !skills) && !resumeText) {
      return res.status(400).json({ 
        error: 'Either provide jobTitle, experience, and skills OR resumeText' 
      });
    }
    
    const skillsArray = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
    
    const result = await generateInterviewQuestions({
      jobTitle,
      experience,
      skills: skillsArray,
      questionType: questionType || 'Technical',
      language: language || 'English',
      resumeText
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error in generateQuestions:', error);
    res.status(500).json({ error: 'Failed to generate questions', details: error.message });
  }
};