const { Configuration, OpenAIApi } = require("openai");
require('dotenv').config();

// Configure OpenAI with error handling
let openai;
try {
  const configuration = new Configuration({ 
    apiKey: process.env.OPENAI_API_KEY,
  });
  openai = new OpenAIApi(configuration);
} catch (error) {
  console.error("OpenAI configuration failed:", error.message);
  process.exit(1);
}

// Enhanced delay with jitter to prevent synchronized retries
const delay = (baseMs, attempt) => 
  new Promise(resolve => setTimeout(resolve, baseMs * Math.pow(2, attempt) + Math.random() * 1000));

// Request queue to prevent parallel overload
const requestQueue = {
  queue: [],
  processing: false,
  async add(requestFn) {
    this.queue.push(requestFn);
    if (!this.processing) {
      this.processing = true;
      while (this.queue.length > 0) {
        await this.queue.shift()();
      }
      this.processing = false;
    }
  }
};

exports.generateQuestions = async (req, res) => {
  // Validate request
  if (!req.body?.jobTitle || !req.body?.skills) {
    return res.status(400).json({
      error: "Missing required fields",
      required: ["jobTitle", "skills"],
      solution: "Please provide both job title and skills"
    });
  }

  const { jobTitle, companyName = "", experience = "", skills, questionType = "", seniorityLevel = "" } = req.body;

  // Optimized prompt
  const prompt = `Generate 5 interview questions for ${jobTitle} (Skills: ${skills})${
    companyName ? ` at ${companyName}` : ""
  }. ${experience ? `${experience} years experience.` : ""} ${
    questionType ? `Focus: ${questionType}.` : ""
  } ${seniorityLevel ? `Level: ${seniorityLevel}.` : ""}
  Format: "Q: [question]\nA: [answer]\n\n"`;

  try {
    // Process through queue
    const result = await new Promise((resolve, reject) => {
      requestQueue.add(async () => {
        try {
          let lastError;
          let attempt = 0;
          const maxAttempts = 3;
          const baseDelay = 2000; // 2 seconds base delay

          while (attempt < maxAttempts) {
            try {
              const response = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 1000,
                temperature: 0.7,
              });

              const content = response.data.choices[0].message.content;
              const qaPairs = parseQA(content) || [{
                question: "Parsing failed - see raw response",
                answer: content
              }];

              return resolve({
                questions: qaPairs,
                apiUsage: response.data.usage
              });
            } catch (error) {
              lastError = error;
              if (error.response?.status === 429) {
                attempt++;
                const waitTime = baseDelay * Math.pow(2, attempt);
                console.warn(`Rate limited (attempt ${attempt}). Waiting ${waitTime}ms...`);
                await delay(baseDelay, attempt);
                continue;
              }
              throw error;
            }
          }

          // If we exhausted retries
          if (lastError?.response?.status === 429) {
            throw {
              status: 429,
              data: {
                error: "OpenAI API rate limit exceeded",
                solution: "Please wait 3-5 minutes before trying again",
                retryAfter: "300 seconds",
                usageTips: [
                  "Reduce request frequency",
                  "Use cached results when possible",
                  "Try during off-peak hours"
                ]
              }
            };
          }
          throw lastError;
        } catch (error) {
          reject(error);
        }
      });
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("API Error:", error.message);

    // Structured error response
    const status = error.status || error.response?.status || 500;
    const response = {
      error: error.response?.data?.error || "Question generation failed",
      details: {
        type: status === 429 ? "rate_limit" : "api_error",
        message: error.response?.data?.error?.message || error.message
      }
    };

    if (status === 429) {
      Object.assign(response, {
        solution: "Please wait before retrying",
        retryAfter: "300 seconds",
        mitigation: [
          "Reduce request frequency",
          "Upgrade your OpenAI plan if needed",
          "Implement client-side caching"
        ]
      });
    }

    return res.status(status).json(response);
  }
};

// Improved Q&A parser
function parseQA(content) {
  try {
    return content.split('\n\n')
      .filter(block => block.trim())
      .map(block => {
        const [q, a] = block.split('\n');
        return {
          question: q?.replace(/^Q:\s*/, '').trim(),
          answer: a?.replace(/^A:\s*/, '').trim()
        };
      })
      .filter(qa => qa.question && qa.answer);
  } catch (e) {
    console.warn("Failed to parse Q&A:", e);
    return null;
  }
}