//MinimalGemeni.js

const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Language mapping
const LANGUAGE_PROMPTS = {
  English: "Generate responses in formal, professional English. Use clear and concise language suitable for technical interviews.",
  Hinglish: 'Generate both questions and answers in Hinglish (a mix of Hindi and English) commonly used in Indian tech interviews. Examples: Q: "React mein useState kaise kaam karta hai?" A: "useState ek hook hai jo state manage karta hai..."',
  Hindi: "Generate responses in pure, formal Hindi. Use technical terms accurately.",
};

exports.generateMinimalQuestions = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.jobTitle || !req.body.skills || !req.body.experience) {
      return res.status(400).json({
        success: false,
        message: "Job title, skills, and experience are required fields",
        example: {
          jobTitle: "React Developer",
          skills: "JavaScript, React",
          experience: "Fresher",
          questionType: "Technical",
          language: "English"
        },
      });
    }

    // Extract form data
    const {
      jobTitle,
      skills,
      experience,
      questionType = "Technical",
      language = "English"
    } = req.body;

    // Prepare skills array
    const skillsArray = skills.split(",").map((skill) => skill.trim());
    let prompt = `${LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS["English"]}\n\n`;

    prompt += `
    You are an expert technical interviewer. Generate 5 detailed and realistic interview Q&A pairs for a ${experience} ${jobTitle} who is applying for a job role in the tech industry. The candidate has skills in ${skillsArray.join(", ")}.
    
    Follow these rules:
    1. Focus on ${questionType} questions only.
    2. Format strictly as:
    Q: [Insert question here]  
    A: [Insert 2-3 sentence answer here]
    
    3. Each question should test a different concept.
    4. Use the ${language} language fluently. Ensure clarity and conciseness.
    5. Make the answers practical and insightful – helpful for real interview scenarios.
    6. Avoid generic questions. Tailor it specifically to the job title and skills.
    `;
    

    // Add type-specific instructions
    switch (questionType) {
      case "Technical":
        prompt += `Focus on practical coding problems and core concepts.\n`;
        prompt += `Include examples or code snippets where relevant.\n`;
        break;
      case "Behavioral":
        prompt += `Focus on STAR (Situation, Task, Action, Result) format responses.\n`;
        break;
      case "Situational":
        prompt += `Create realistic work scenarios and practical solutions.\n`;
        break;
    }

    // Get Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        maxOutputTokens: 2000,  // Increased for Q&A pairs
        temperature: 0.7,       // Slightly higher for varied answers
      },
    });

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = response.text();

    // Parse response into Q/A pairs
    const qaPairs = parseQAResponse(text);

    // Ensure we have exactly 5 pairs
    const questions = qaPairs.slice(0, 5).map(pair => ({
      question: pair.q,
      answer: pair.a || "Answer will be generated..."  // Fallback if empty
    }));

    // If we got fewer than 5, fill remaining with placeholders
    while (questions.length < 5) {
      questions.push({
        question: `Sample ${questionType} question about ${skillsArray[0]}`,
        answer: "Answer will be generated..."
      });
    }

    return res.json({
      success: true,
      questions,
      meta: {
        language,
        questionType,
        experienceLevel: experience,
        skills: skillsArray
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
      fallbackQuestions: getFallbackQuestions(req.body)  // Provide basic questions
    });
  }
};

// Improved Q/A parser
function parseQAResponse(text) {
  const pairs = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  let currentQ = null;
  
  for (const line of lines) {
    // Check for question line
    if (line.startsWith('Q:') || line.startsWith('Q.')) {
      currentQ = line.substring(2).trim();
    } 
    // Check for answer line when we have a question
    else if ((line.startsWith('A:') || line.startsWith('A.')) && currentQ) {
      const answer = line.substring(2).trim();
      pairs.push({
        q: currentQ,
        a: answer
      });
      currentQ = null;
    }
  }
  
  return pairs;
}

// Fallback questions if API fails
function getFallbackQuestions(body) {
  const { jobTitle, skills, experience, questionType } = body;
  const skillsArray = skills.split(',').map(s => s.trim());
  
  const baseQuestions = [
    `What are the core responsibilities of a ${experience} ${jobTitle}?`,
    `How would you explain ${skillsArray[0]} to a non-technical person?`,
    `Describe a challenging ${questionType.toLowerCase()} situation you might face in this role`,
    `What are the key differences between ${skillsArray[0]} and ${skillsArray[1] || 'related technology'}?`,
    `How do you stay updated with ${skillsArray[0]} developments?`
  ];
  
  return baseQuestions.map(q => ({
    question: q,
    answer: "Answer will be generated..."
  }));

}