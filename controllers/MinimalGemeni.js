const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuration constants
const QUESTION_TYPE_CONFIG = {
  Technical: {
    description: "Technical skills and problem-solving questions",
    examples: [
      "Explain how React's virtual DOM works",
      "Write a function to reverse a linked list",
      "How would you optimize database queries for a high-traffic app?"
    ],
    focus: "coding problems, algorithms, system design, and technology-specific concepts"
  },
  Behavioral: {
    description: "Behavioral and personality-based questions",
    examples: [
      "Tell me about a time you faced a tight deadline",
      "Describe a situation where you had to work with a difficult team member",
      "How do you handle failure or criticism?"
    ],
    focus: "STAR (Situation, Task, Action, Result) format responses"
  },
  Situational: {
    description: "Hypothetical work scenarios",
    examples: [
      "How would you handle a major production outage?",
      "If you disagree with your manager's technical decision, what would you do?",
      "A teammate isn't pulling their weight - how would you address this?"
    ],
    focus: "practical solutions, decision-making, and teamwork scenarios"
  }
};

const LANGUAGE_PROMPTS = {
  English: "Generate responses in formal, professional English.",
  Hinglish: "Generate in Hinglish (Hindi-English mix) as used in Indian tech interviews.",
  Hindi: "Generate responses in formal Hindi with technical terms."
};

exports.generateMinimalQuestions = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.jobTitle || !req.body.skills || !req.body.experience || !req.body.questionType) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: jobTitle, skills, experience, questionType",
        example: {
          jobTitle: "React Developer",
          skills: "JavaScript, React, Redux",
          experience: "1-3 years",
          questionType: "Technical",
          language: "English",
          tone: "Professional",
          answerLength: "medium"
        },
        availableQuestionTypes: Object.keys(QUESTION_TYPE_CONFIG)
      });
    }

    const {
      jobTitle,
      skills,
      experience,
      questionType,
      language = "English",
      tone = "Professional",
      answerLength = "medium"
    } = req.body;

    // Validate question type
    if (!QUESTION_TYPE_CONFIG[questionType]) {
      return res.status(400).json({
        success: false,
        message: `Invalid questionType. Valid types are: ${Object.keys(QUESTION_TYPE_CONFIG).join(', ')}`,
        exampleQuestionTypes: QUESTION_TYPE_CONFIG
      });
    }

    // Helper functions
    const getExperienceSpecificPrompt = (exp) => {
      const prompts = {
        "Fresher": "Ask fundamental concepts with simple examples",
        "1-3 years": "Focus on practical implementation and debugging",
        "3-5 years": "Include system design considerations",
        "5+ years": "Add architecture and leadership aspects"
      };
      return prompts[exp] || "Tailor questions to experience level";
    };

    const getQuestionTypePrompt = (type) => {
      const config = QUESTION_TYPE_CONFIG[type];
      return `
      **Question Type**: ${type} (${config.description})
      **Focus Areas**: ${config.focus}
      **Examples**: ${config.examples.join('; ')}
      `;
    };

    const skillsArray = skills.split(",").map(skill => skill.trim());

    // Construct the prompt
    const prompt = `
    **Interview Question Generation Task**
    
    **Candidate Profile**:
    - Role: ${jobTitle}
    - Experience: ${experience} (${getExperienceSpecificPrompt(experience)})
    - Key Skills: ${skillsArray.join(', ')}
    
    **Question Requirements**:
    ${getQuestionTypePrompt(questionType)}
    
    **Response Format**:
    - Language: ${language} (${LANGUAGE_PROMPTS[language]})
    - Tone: ${tone}
    - Answer Length: ${answerLength}
    
    **Strict Output Format**:
    Generate exactly 5 Q&A pairs in this format:
    Q: [Question text]
    A: [Answer text]
    
    **Quality Guidelines**:
    - Questions should be specific to ${jobTitle} role
    - Answers should be practical and actionable
    - Include real-world examples where applicable
    - For technical questions, include code snippets if relevant
    - For behavioral/situational, use realistic scenarios
    
    **Examples of Expected Output**:
    ${QUESTION_TYPE_CONFIG[questionType].examples.map(ex => `Q: ${ex}`).join('\n')}
    `;

    // Get Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: questionType === "Technical" ? 0.3 : 0.7, // Lower temp for technical accuracy
      },
    });

    // Generate content with retry logic
    let qaPairs = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (qaPairs.length < 5 && attempts < maxAttempts) {
      attempts++;
      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const response = await result.response;
        const text = response.text();

        // Parse and validate response
        const parsedPairs = parseQAResponse(text, questionType);
        
        // Add only the number we need to reach 5
        const needed = 5 - qaPairs.length;
        qaPairs = [...qaPairs, ...parsedPairs.slice(0, needed)];
        
        if (qaPairs.length < 5) {
          console.log(`Attempt ${attempts}: Only got ${parsedPairs.length} questions, need ${needed} more`);
        }
      } catch (error) {
        console.error(`Attempt ${attempts} failed:`, error.message);
        if (attempts >= maxAttempts) throw error;
      }
    }

    if (qaPairs.length < 5) {
      // Fill with fallback questions if still not enough
      const needed = 5 - qaPairs.length;
      const fallbacks = getFallbackQuestions(req.body).slice(0, needed);
      qaPairs = [...qaPairs, ...fallbacks];
    }

    return res.json({
      success: true,
      questions: qaPairs.slice(0, 5),
      meta: {
        language,
        questionType,
        seniorityLevel: experience,
        tone,
        answerLength,
        generatedAt: new Date().toISOString(),
        skills: skillsArray,
        attemptsMade: attempts
      },
    });
  } catch (error) {
    console.error("Error generating questions:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate questions",
      error: error.message,
      fallbackQuestions: getFallbackQuestions(req.body)
    });
  }
};

// Enhanced Q/A parser with more flexible validation
function parseQAResponse(text, questionType) {
  const pairs = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  let currentQ = null;
  let currentA = null;
  
  for (const line of lines) {
    const isQuestion = line.match(/^Q[:.]\s*/i);
    const isAnswer = line.match(/^A[:.]\s*/i);
    
    if (isQuestion) {
      // Save previous pair if exists
      if (currentQ && currentA) {
        pairs.push({ q: currentQ, a: currentA });
      }
      currentQ = line.substring(isQuestion[0].length).trim();
      currentA = null;
    } else if (isAnswer && currentQ) {
      currentA = line.substring(isAnswer[0].length).trim();
      pairs.push({ q: currentQ, a: currentA });
      currentQ = null;
      currentA = null;
    } else if (currentQ && currentA === null) {
      // Handle multi-line answers
      currentA = line;
    } else if (currentQ && currentA) {
      // Append to existing answer
      currentA += '\n' + line;
    }
  }
  
  // Add the last pair if valid
  if (currentQ && currentA) {
    pairs.push({ q: currentQ, a: currentA });
  }
  
  // Filter only if we have more than enough
  if (pairs.length > 5) {
    return pairs.filter(pair => validateQuestion(pair.q, questionType));
  }
  
  return pairs;
}

// More flexible validation
function validateQuestion(question, questionType) {
  // If we're short on questions, be more lenient
  return true; // For now, accept all questions
  
  
  const keywords = {
    Technical: ["how", "what", "explain","difference","example","code", "algorithm", "design", "describe"],
    Behavioral: ["time", "situation", "experience", "worked", "handled"],
    Situational: ["would you", "scenario", "if", "how would", "what would"]
  };
  
  const questionLower = question.toLowerCase();
  return keywords[questionType].some(keyword => questionLower.includes(keyword));
  
}

// Improved fallback questions
function getFallbackQuestions(body) {
  const { jobTitle, skills, experience, questionType } = body;
  const skillsArray = skills.split(',').map(s => s.trim());
  const config = QUESTION_TYPE_CONFIG[questionType] || QUESTION_TYPE_CONFIG.Technical;
  
  return config.examples.map(example => ({
    q: example.replace("[ROLE]", jobTitle)
              .replace("[SKILL]", skillsArray[0] || "React")
              .replace("[EXP]", experience),
    a: "This is a sample answer. The AI system is currently optimizing its response quality. The answer would typically provide detailed, role-specific information here."
  }));
}