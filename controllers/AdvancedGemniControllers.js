const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enhanced configuration with separate prompts for each question type
const PROMPT_CONFIG = {
  languages: {
    English: "Generate in professional English with technical accuracy.",
  Hinglish: "Please generate the output in Hinglish — written using English letters but easy to read and sound like Hindi. Use simple, conversational tone for better understanding.",

    Hindi: "Generate in formal Hindi with proper technical terms."
  },
  tones: {
    Professional: "Maintain formal, technical tone.",
    Casual: "Use conversational tone suitable for startups.",
    "Simple for Freshers": "Use simple language for beginners."
  },
  questionTypes: {
  Technical: {
  prompt: (params) => `
    You are an expert technical interviewer.

    Generate ${params.numberOfQuestions} technical interview questions **with answers** for the role of **${params.seniorityLevel} ${params.jobTitle}** at **${params.companyName}**.

    Candidate Details:
    - Experience: ${params.experience} years
    - Skills: ${params.skills.split(',').map(skill => skill.trim()).join(', ')}


    For each question:
    - Start from basic concept (e.g., "What is X?")
    - Explain progressively with real-world examples
    - Include comparison or advanced detail (e.g., "X vs Y", "When to use?")
    - End with a tricky or modern interview-style scenario

    Each answer must:
    - Break down the concept step-by-step
    - Use practical examples or relatable use-cases
    - Highlight best practices and common pitfalls
    - ${
      params.answerLength === 'detailed'
        ? 'Include code examples or pseudo-code if applicable.'
        : 'Keep it informative but concise.'
    }

    Maintain a tone that is friendly and easy to follow, like a mentor guiding the candidate.
  `,

  format: (params) => `
    Q: [A thoughtful question in ${params.language} based on the structure above]

    A: [${
      params.answerLength
    } answer in ${params.language}, including:
      - Clear concept explanation
      - Real-world or technical example
      - Comparison or deeper insight
      - ${
        params.answerLength === 'detailed'
          ? 'Code snippet or pseudo-code if needed.'
          : 'Concise explanation with enough clarity.'
      }
    ]
  `
},


    Situational: {
      prompt: (params) => `
        Generate ${params.numberOfQuestions} situational interview questions for a ${params.seniorityLevel} 
        ${params.jobTitle} position at ${params.companyName}.
        
        Focus on:
        - Workplace scenarios
        - Team collaboration challenges
        - Project management situations
        - Conflict resolution
        - Company-specific situations for ${params.companyName}
        
        Tailor for ${params.experience} years experience level.
      `,
      format: (params) => `
        Q: [Describe a realistic work situation/scenario]
        A: [${params.answerLength} answer with:
          - Recommended approach
          - Reasoning behind it
          - Alternative solutions
          - Expected outcomes
        ]
      `
    },
    Behavioral: {
      prompt: (params) => `
        Generate ${params.numberOfQuestions} behavioral interview questions for a ${params.seniorityLevel} 
        ${params.jobTitle} position at ${params.companyName} based on ${params.experience} years experience.
        
        Focus on:
        - STAR (Situation, Task, Action, Result) format
        - Leadership qualities
        - Problem-solving abilities
        - Adaptability and learning
        - Company culture fit for ${params.companyName}
      `,
      format: (params) => `
        Q: [Behavioral question about past experiences/actions]
        A: [${params.answerLength} answer structured as:
          - Situation/Task description
          - Actions taken
          - Results achieved
          - Lessons learned
        ]
      `
    }
  },
  answerLengths: {
    short: "2-3 sentences",
    medium: "1 short paragraph (4-5 sentences)",
    detailed: "Comprehensive answer with examples (2-3 paragraphs)"
  }
};

exports.generateAdvancedQuestions = async (req, res) => {
  try {
    // Validate required fields
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

    // Validate inputs
    if (!PROMPT_CONFIG.questionTypes[questionType]) {
      return res.status(400).json({
        success: false,
        message: `Invalid question type. Use one of: ${Object.keys(PROMPT_CONFIG.questionTypes).join(', ')}`
      });
    }

    if (!PROMPT_CONFIG.languages[language]) {
      return res.status(400).json({
        success: false,
        message: `Invalid language. Use one of: ${Object.keys(PROMPT_CONFIG.languages).join(', ')}`
      });
    }

    if (!PROMPT_CONFIG.tones[tone]) {
      return res.status(400).json({
        success: false,
        message: `Invalid tone. Use one of: ${Object.keys(PROMPT_CONFIG.tones).join(', ')}`
      });
    }

    // Build the prompt based on question type
    const params = {
      jobTitle,
      skills,
      companyName,
      experience,
      questionType,
      language,
      jd,
      numberOfQuestions,
      answerLength,
      seniorityLevel,
      tone
    };

    const questionTypeConfig = PROMPT_CONFIG.questionTypes[questionType];
    
    const promptParts = [
      `${PROMPT_CONFIG.languages[language]}`,
      `${PROMPT_CONFIG.tones[tone]}`,
      "",
      questionTypeConfig.prompt(params),
      "",
      "Format requirements:",
      questionTypeConfig.format(params),
      "",
      jd ? `Additional Job Description Context: ${jd}` : "",
      "",
      `Important: Generate exactly ${numberOfQuestions} questions.`,
      `Ensure answers are ${PROMPT_CONFIG.answerLengths[answerLength]}.`,
      "Return only the Q&A pairs in the specified format, no additional commentary."
    ];

    const prompt = promptParts.filter(part => part.trim()).join("\n");

    // Configure model based on tone
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        maxOutputTokens: answerLength === 'detailed' ? 4000 : 2000,
        temperature: getTemperature(tone),
        topP: 0.95,
      },
    });

    // Generate content with error handling
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse response
    const qaPairs = parseResponse(text, numberOfQuestions);

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

// Helper function to determine temperature based on tone
function getTemperature(tone) {
  const temperatureMap = {
    Professional: 0.3,
    Casual: 0.7,
    "Simple for Freshers": 0.5
  };
  return temperatureMap[tone] || 0.5;
}

// Optimized response parser
function parseResponse(text, expectedCount) {
  // Normalize line endings and remove empty lines
  const lines = text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.match(/^(Note:|Disclaimer:)/i));
  
  const qaPairs = [];
  let currentQ = null;
  let currentA = null;
  let inAnswer = false;

  for (const line of lines) {
    // Detect question start (supports Q1, Q:, 1., etc.)
    if (line.match(/^(Q\d*[:.]?|\d+\.)\s+/i)) {
      // Save previous pair if exists
      if (currentQ && currentA) {
        qaPairs.push(createQAPair(currentQ, currentA));
      }
      currentQ = line;
      currentA = "";
      inAnswer = false;
    } 
    // Detect answer start (supports A:, Ans, etc.)
    else if (line.match(/^(A\d*[:.]?|Answer[:.]?)\s+/i) && currentQ) {
      currentA = line.replace(/^(A\d*[:.]?|Answer[:.]?)\s+/i, '');
      inAnswer = true;
    } 
    // Continue answer text
    else if (inAnswer && currentA !== null) {
      currentA += ' ' + line;
    }
    // Handle questions that span multiple lines
    else if (currentQ !== null && !inAnswer) {
      currentQ += ' ' + line;
    }
  }

  // Add the last pair if exists
  if (currentQ && currentA) {
    qaPairs.push(createQAPair(currentQ, currentA));
  }

  // Fallback parsing if standard format fails
  if (qaPairs.length < expectedCount) {
    const fallbackPairs = fallbackParse(lines, expectedCount);
    qaPairs.push(...fallbackPairs);
  }

  return qaPairs.length > 0 ? qaPairs : [{
    question: "Could not parse questions from response",
    answer: text.substring(0, 500) + (text.length > 500 ? "..." : "")
  }];
}

function createQAPair(question, answer) {
  return {
    question: question.replace(/^(Q\d*[:.]?|\d+\.)\s+/i, '').trim(),
    answer: answer.trim()
  };
}

function fallbackParse(lines, expectedCount) {
  const pairs = [];
  let currentPair = null;

  for (const line of lines) {
    // Check if line looks like a question (ends with ? or starts with number/Q)
    if (line.match(/\?$/) || line.match(/^(Q|\d+)/i)) {
      if (currentPair && currentPair.question) {
        pairs.push(currentPair);
      }
      currentPair = { question: line, answer: "" };
    } 
    // Otherwise treat as answer text
    else if (currentPair) {
      currentPair.answer += (currentPair.answer ? " " : "") + line;
    }
  }

  // Add the last pair if exists
  if (currentPair && currentPair.question) {
    pairs.push(currentPair);
  }

  return pairs;
}