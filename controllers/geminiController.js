const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Language mapping
const LANGUAGE_PROMPTS = {
  English:
    "Generate responses in formal, professional English. Use clear and concise language suitable for technical interviews.",
  Hinglish:
    'Generate both questions and answers in Hinglish (a mix of Hindi and English) commonly used in Indian tech interviews. Ensure questions and answers are fully in Hinglish, with no English-only questions. Examples: Q: "React mein useState kaise kaam karta hai? Ek example do." A: "useState ek hook hai jo state manage karta hai. Example: const [count, setCount] = useState(0); setCount(count + 1) se value update hoti hai."',
  Hindi:
    "Generate responses in pure, formal Hindi. Use technical terms accurately and avoid colloquialisms unless specified.",
};

exports.generateQuestions = async (req, res) => {
  try {
    // Validate required fields
    if (
      !req.body.jobTitle ||
      !req.body.skills ||
      !req.body.language ||
      !req.body.companyName ||
      !req.body.experience ||
      !req.body.questionType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Job title, skills, language, company name, experience, and question type are required fields",
        example: {
          jobTitle: "React Developer",
          skills: "JavaScript, React, Redux",
          companyName: "Zomato",
          experience: "3",
          questionType: "Technical",
          language: "Hinglish",
          numberOfQuestions: "5",
          answerLength: "short",
        },
      });
    }

    // Extract all form data
    const {
      jobTitle,
      skills,
      companyName,
      experience,
      questionType,
      language,
      jd,
      numberOfQuestions = "5",
      answerLength = "short",
      includeCodeSnippets = false,
    } = req.body;

    // Prepare skills array
    const skillsArray = skills.split(",").map((skill) => skill.trim());

    // Map answer length to word count
    const answerLengthMap = {
      short: "30-50 words",
      medium: "50-100 words",
      detailed: "100-150 words",
    };

    // Enhanced prompt construction
    let prompt = `${
      LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS["English"]
    }\n\n`;
    prompt += `You are an expert interviewer creating ${numberOfQuestions} ${questionType} interview questions for a ${jobTitle} position at ${companyName}.\n\n`;

    prompt += `### Requirements:\n`;
    prompt += `- **Skills**: ${skillsArray.join(", ")}\n`;
    prompt += `- **Experience Level**: ${experience} years (tailor questions to ${
      experience <= 2 ? "beginner" : experience <= 5 ? "intermediate" : "senior"
    } level)\n`;
    if (jd) {
      prompt += `- **Job Description**: ${jd}\n`;
    }
    prompt += `- **Question Type**: ${questionType}\n`;
    prompt += `- **Include Code Snippets**: No\n`;

    prompt += `\n### Instructions:\n`;
    prompt += `- Generate **exactly ${numberOfQuestions} question-answer pairs**.\n`;
    prompt += `- Each question and answer must be complete and not truncated.\n`;
    prompt += `- Both questions and answers must be in ${language}, with no exceptions.\n`;
    prompt += `- **Do not include code snippets** in questions or answers.\n`;
    prompt += `- Answers should be **${
      answerLengthMap[answerLength] || "30-50 words"
    }** and provide clear, accurate explanations.\n`;
    prompt += `- Format each pair strictly as follows, with no variations:\n`;
    prompt += `  Q: [Question text]\n`;
    prompt += `  A: [Answer text]\n\n`;
    prompt += `- Do not use numbered questions (e.g., "1. Question") or other prefixes. Use only "Q:" and "A:".\n`;
    prompt += `- If inputs are unclear, make reasonable assumptions based on the job title and industry standards.\n`;
    prompt += `- Ensure the response is complete and contains all ${numberOfQuestions} pairs without truncation.\n`;

    // Specific instructions for question types
    if (questionType === "Technical") {
      prompt += `- For Technical questions, focus strictly on technical concepts, differences, implementations, or debugging related to the specified skills. Examples: "What is the difference between useState and useReducer in React? Explain with an example." or "How does JavaScript's event loop work?" Avoid situational or behavioral questions (e.g., "How would you handle a team conflict?").\n`;
    } else if (questionType === "Situational") {
      prompt += `- For Situational questions, focus on hypothetical scenarios relevant to the job role, e.g., "Agar API call fail ho jaye to kya karoge?" or "How would you handle a tight project deadline?"\n`;
    } else if (questionType === "Behavioral") {
      prompt += `- For Behavioral questions, focus on past experiences or personal qualities, e.g., "Tell me about a time you solved a complex bug." or "Kaise ensure karte ho code quality?"\n`;
    }

    // Get Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        maxOutputTokens: 3000,
        temperature: 0.7,
      },
    });

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = response.text();

    // Log raw response for debugging
    console.log("Raw Gemini Response:", text);

    // Parse response into clean Q&A pairs
    const qaPairs = parseGeminiResponse(text, numberOfQuestions);

    return res.json({
      success: true,
      questions: qaPairs,
      meta: {
        language: language,
        questionType: questionType,
        jdIncluded: !!jd,
      },
    });
  } catch (error) {
    console.error("Gemini API Error:", {
      message: error.message,
      stack: error.stack,
      requestBody: req.body,
    });
    return res.status(500).json({
      success: false,
      message: "Failed to generate questions",
      error: error.message,
      solution: "Please check your inputs and try again",
    });
  }
};

// Enhanced response parser for multilingual support
function parseGeminiResponse(text, numberOfQuestions) {
  const qaPairs = [];
  const blocks = text.split("\n\n").filter((block) => block.trim());

  let currentQuestion = "";
  let currentAnswer = "";
  let isQuestion = false;

  blocks.forEach((block) => {
    const lines = block.split("\n").map((line) => line.trim());

    lines.forEach((line) => {
      if (line.match(/^Q[:.]?\s*/i)) {
        if (currentQuestion && currentAnswer) {
          qaPairs.push({ question: currentQuestion, answer: currentAnswer });
        }
        currentQuestion = line.replace(/^Q[:.]?\s*/i, "").trim();
        currentAnswer = "";
        isQuestion = true;
      } else if (line.match(/^A[:.]?\s*/i)) {
        currentAnswer = line.replace(/^A[:.]?\s*/i, "").trim();
        isQuestion = false;
      } else if (isQuestion && line) {
        currentQuestion += " " + line;
      } else if (!isQuestion && line) {
        currentAnswer += " " + line;
      }
    });
  });

  if (currentQuestion && currentAnswer) {
    qaPairs.push({ question: currentQuestion, answer: currentAnswer });
  }

  if (qaPairs.length < parseInt(numberOfQuestions)) {
    const remainingText = text.split("\n").filter((line) => line.trim());
    let fallbackPairs = [];
    let tempQuestion = "";
    let tempAnswer = "";
    let collectingAnswer = false;

    remainingText.forEach((line) => {
      if (line.match(/^(Q|Question)[:.]?\s*/i) || line.match(/^\d+\.\s*/)) {
        if (tempQuestion && tempAnswer) {
          fallbackPairs.push({ question: tempQuestion, answer: tempAnswer });
        }
        tempQuestion = line
          .replace(/^(Q|Question)[:.]?\s*/i, "")
          .replace(/^\d+\.\s*/, "")
          .trim();
        tempAnswer = "";
        collectingAnswer = false;
      } else if (
        line.match(/^(A|Answer)[:.]?\s*/i) ||
        (tempQuestion && !collectingAnswer)
      ) {
        collectingAnswer = true;
        tempAnswer = line.replace(/^(A|Answer)[:.]?\s*/i, "").trim();
      } else if (collectingAnswer) {
        tempAnswer += " " + line.trim();
      }
    });

    if (tempQuestion && tempAnswer) {
      fallbackPairs.push({ question: tempQuestion, answer: tempAnswer });
    }

    qaPairs.push(...fallbackPairs);
  }

  if (qaPairs.length === 0) {
    return [
      {
        question: "Could not parse questions - raw response",
        answer: text.substring(0, 200),
      },
    ];
  }

  return qaPairs.slice(0, parseInt(numberOfQuestions));
}