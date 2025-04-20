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

// Tone mapping
const TONE_PROMPTS = {
  Professional: "Maintain a formal, professional tone throughout the questions and answers. Use technical terminology appropriately.",
  Casual: "Use a more conversational and casual tone while keeping the content technically accurate. Suitable for startup environments.",
  "Simple for Freshers": "Use simple language and basic explanations. Avoid complex jargon. Explain concepts as if to a beginner.",
};

exports.generateAdvancedQuestions = async (req, res) => {
  try {
    // Validate required fields
    if (
      !req.body.jobTitle ||
      !req.body.skills ||
      !req.body.language ||
      !req.body.companyName ||
      !req.body.experience ||
      !req.body.questionType ||
      !req.body.seniorityLevel ||
      !req.body.numberOfQuestions ||
      !req.body.answerLength
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Job title, skills, language, company name, experience, question type, seniority level, number of questions, and answer length are required fields",
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
      seniorityLevel = "Mid",
      tone = "Professional"
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
    let prompt = `${LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS["English"]}\n`;
    prompt += `${TONE_PROMPTS[tone] || TONE_PROMPTS["Professional"]}\n\n`;
    
    prompt += `You are an expert interviewer creating ${numberOfQuestions} ${questionType} interview questions for a ${seniorityLevel} level ${jobTitle} position at ${companyName}.\n\n`;

    prompt += `### Candidate Profile:\n`;
    prompt += `- **Skills**: ${skillsArray.join(", ")}\n`;
    prompt += `- **Experience**: ${experience} years\n`;
    prompt += `- **Seniority Level**: ${seniorityLevel}\n`;
    if (jd) {
      prompt += `- **Job Description**: ${jd}\n`;
    }
    
    prompt += `\n### Interview Requirements:\n`;
    prompt += `- **Question Type**: ${questionType}\n`;
    prompt += `- **Language**: ${language}\n`;
    prompt += `- **Tone**: ${tone}\n`;
    prompt += `- **Number of Questions**: ${numberOfQuestions}\n`;
    prompt += `- **Answer Length**: ${answerLengthMap[answerLength] || "30-50 words"}\n`;

    prompt += `\n### Instructions:\n`;
    prompt += `- Generate exactly ${numberOfQuestions} question-answer pairs.\n`;
    prompt += `- Format each pair strictly as: Q: [Question] A: [Answer]\n`;
    prompt += `- Questions should be tailored for ${seniorityLevel} level candidates.\n`;
    prompt += `- Answers should match the ${tone} tone and be in ${language}.\n`;
    prompt += `- For technical questions, focus on ${skillsArray.join(", ")}.\n`;
    prompt += `- Ensure questions test both theoretical knowledge and practical application.\n`;
    
    // Add specific instructions based on question type
    switch(questionType) {
      case "Technical":
        prompt += `- Focus on technical concepts, implementations, and problem-solving.\n`;
        prompt += `- Include questions about best practices and common pitfalls.\n`;
        break;
      case "Behavioral":
        prompt += `- Focus on past experiences, teamwork, and problem-solving approaches.\n`;
        prompt += `- Use STAR (Situation, Task, Action, Result) format for answers.\n`;
        break;
      case "Situational":
        prompt += `- Create realistic work scenarios the candidate might encounter.\n`;
        prompt += `- Focus on decision-making and problem-solving skills.\n`;
        break;
      case "Mixed":
        prompt += `- Include a balanced mix of technical, behavioral, and situational questions.\n`;
        break;
    }

    // Get Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        maxOutputTokens: 3000,
        temperature: tone === "Professional" ? 0.5 : tone === "Casual" ? 0.7 : 0.3,
      },
    });

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = response.text();

    // Parse response into clean Q&A pairs
    const qaPairs = parseGeminiResponse(text, numberOfQuestions);

    return res.json({
      success: true,
      questions: qaPairs,
      meta: {
        language,
        questionType,
        seniorityLevel,
        tone,
        answerLength,
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

// Response parser remains the same as in your original code
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