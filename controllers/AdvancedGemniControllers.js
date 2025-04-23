const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enhanced language and tone prompt
const PROMPT_CONFIG = {
  languages: {
    English: "Generate in professional English with technical accuracy.",
    Hinglish: "Generate in Hinglish (Hindi+English mix) as used in Indian tech interviews.",
    Hindi: "Generate in formal Hindi with proper technical terms."
  },
  tones: {
    Professional: "Maintain formal, technical tone.",
    Casual: "Use conversational tone suitable for startups.",
    "Simple for Freshers": "Use simple language for beginners."
  }
};

exports.generateAdvancedQuestions = async (req, res) => {
  try {
    // Validate required fields with better error messages
    const requiredFields = [
      'jobTitle', 'skills', 'language', 'companyName',
      'experience', 'questionType', 'seniorityLevel',
      'numberOfQuestions', 'answerLength'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        example: {
          jobTitle: "React Developer",
          skills: "JavaScript, React, Redux",
          companyName: "Zomato",
          experience: "3",
          questionType: "Technical",
          language: "Hinglish",
          seniorityLevel: "Mid",
          numberOfQuestions: "5",
          answerLength: "short",
          tone: "Professional"
        }
      });
    }

    // Extract and sanitize inputs
    const {
      jobTitle, skills, companyName, experience,
      questionType, language, jd,
      numberOfQuestions = 5,
      answerLength = "short",
      seniorityLevel = "Mid",
      tone = "Professional"
    } = req.body;

    // Validate answer length
    const validLengths = ["short", "medium", "detailed"];
    if (!validLengths.includes(answerLength)) {
      return res.status(400).json({
        success: false,
        message: "Invalid answer length. Use: short, medium, or detailed"
      });
    }

    // Build the prompt
    const promptParts = [
      `${PROMPT_CONFIG.languages[language] || PROMPT_CONFIG.languages.English}`,
      `${PROMPT_CONFIG.tones[tone] || PROMPT_CONFIG.tones.Professional}`,
      "",
      `Generate exactly ${numberOfQuestions} ${questionType} interview questions for a ${seniorityLevel} ${jobTitle} at ${companyName}.`,
      `Candidate has ${experience} years experience with ${skills}.`,
      jd ? `Job Description Context: ${jd}` : "",
      "",
      "Format each question-answer pair exactly like this:",
      "Q: [Full question text]",
      "A: [Complete answer in specified length and tone]",
      "",
      "Important: Only return the Q&A pairs, no additional commentary."
    ];

    const prompt = promptParts.filter(part => part.trim()).join("\n");

    // Configure model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        maxOutputTokens: 3000,
        temperature: tone === "Professional" ? 0.5 : tone === "Casual" ? 0.7 : 0.3,
      },
    });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse response with improved logic
    const qaPairs = parseResponse(text, numberOfQuestions);

    // Validate we got correct number of questions
    if (qaPairs.length < numberOfQuestions) {
      console.warn(`Requested ${numberOfQuestions} questions but got ${qaPairs.length}`);
    }

    return res.json({
      success: true,
      questions: qaPairs.slice(0, numberOfQuestions),
      meta: {
        language,
        questionType,
        seniorityLevel,
        tone,
        answerLength,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Generation Error:", {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    
    return res.status(500).json({
      success: false,
      message: "Question generation failed",
      error: error.message,
      solution: "Please check your inputs and try again"
    });
  }
};

// Improved response parser
function parseResponse(text, expectedCount) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const qaPairs = [];
  let currentQ = null;
  let currentA = null;

  for (const line of lines) {
    if (line.match(/^Q[:.]?\s*/i)) {
      // If we have a complete pair, save it
      if (currentQ && currentA) {
        qaPairs.push({
          question: currentQ.replace(/^Q[:.]?\s*/i, '').trim(),
          answer: currentA.trim()
        });
      }
      currentQ = line;
      currentA = null;
    } else if (line.match(/^A[:.]?\s*/i) && currentQ) {
      currentA = line.replace(/^A[:.]?\s*/i, '').trim();
    } else if (currentA !== null) {
      currentA += ' ' + line.trim();
    } else if (currentQ !== null) {
      currentQ += ' ' + line.trim();
    }
  }

  // Add the last pair if exists
  if (currentQ && currentA) {
    qaPairs.push({
      question: currentQ.replace(/^Q[:.]?\s*/i, '').trim(),
      answer: currentA.trim()
    });
  }

  // Fallback parsing if standard format fails
  if (qaPairs.length < expectedCount) {
    const fallbackPairs = [];
    const questionRegex = /^(?:\d+\.|Q[:.]?)\s*(.+)/i;
    const answerRegex = /^A[:.]?\s*(.+)/i;

    let tempQ = null;
    let tempA = null;

    for (const line of lines) {
      if (questionRegex.test(line)) {
        if (tempQ && tempA) {
          fallbackPairs.push({
            question: tempQ,
            answer: tempA
          });
        }
        tempQ = line.replace(questionRegex, '$1').trim();
        tempA = null;
      } else if (answerRegex.test(line) && tempQ) {
        tempA = line.replace(answerRegex, '$1').trim();
      } else if (tempA !== null) {
        tempA += ' ' + line.trim();
      }
    }

    if (tempQ && tempA) {
      fallbackPairs.push({
        question: tempQ,
        answer: tempA
      });
    }

    qaPairs.push(...fallbackPairs);
  }

  return qaPairs.length > 0 ? qaPairs : [{
    question: "Could not parse questions from response",
    answer: text.substring(0, 200) + (text.length > 200 ? "..." : "")
  }];
}