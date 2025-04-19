const axios = require('axios');
require('dotenv').config();

// DeepSeek API Configuration
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.error("DeepSeek API key missing. Please set DEEPSEEK_API_KEY in .env file");
  process.exit(1);
}

const deepSeekClient = axios.create({
  baseURL: DEEPSEEK_API_URL,
  headers: {
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Improved Q&A parser for DeepSeek responses
function parseDeepSeekQA(content) {
  try {
    return content.split('\n\n')
      .filter(block => block.trim())
      .map(block => {
        const lines = block.split('\n');
        const question = lines.find(line => line.startsWith('Q:'))?.replace(/^Q:\s*/, '').trim();
        const answer = lines.find(line => line.startsWith('A:'))?.replace(/^A:\s*/, '').trim();
        return { question, answer };
      })
      .filter(qa => qa.question && qa.answer);
  } catch (e) {
    console.warn("DeepSeek Q&A parsing failed:", e);
    return null;
  }
}

exports.generateQuestions = async (req, res) => {
  // Validate request
  if (!req.body?.jobTitle || !req.body?.skills) {
    return res.status(400).json({
      error: "Required fields missing",
      required: ["jobTitle", "skills"],
      example: {
        jobTitle: "React Developer",
        skills: ["JavaScript", "React", "Redux"],
        experience: "3",
        model: "deepseek-chat"  // Default model
      }
    });
  }

  const { jobTitle, skills, experience = "", model = "deepseek-chat" } = req.body;

  const prompt = `Generate 5 technical interview questions for ${jobTitle} role.
Required Skills: ${Array.isArray(skills) ? skills.join(', ') : skills}
${experience ? `Experience Required: ${experience} years` : ""}

Format each question-answer pair exactly like:
Q: [question]
A: [answer]`;

  try {
    const response = await deepSeekClient.post('/chat/completions', {
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    });

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek returned empty response");
    }

    const qaPairs = parseDeepSeekQA(content) || [{
      question: "Parsing failed - see raw response",
      answer: content
    }];

    return res.json({
      success: true,
      questions: qaPairs,
      model: response.data.model,
      usage: response.data.usage
    });

  } catch (error) {
    console.error("DeepSeek API Error:", error.response?.data || error.message);
    
    const status = error.response?.status || 500;
    return res.status(status).json({
      success: false,
      error: error.response?.data?.error || error.message,
      statusCode: status
    });
  }
};