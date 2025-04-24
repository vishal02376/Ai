const { PROMPT_CONFIG } = require('./advancePromtGimini');

function buildPrompt({
  language,
  tone,
  questionType,
  numberOfQuestions,
  seniorityLevel,
  jobTitle,
  companyName,
  experience,
  skills,
  jd
}) {
  return [
    `${PROMPT_CONFIG.languages[language] || PROMPT_CONFIG.languages.English}`,
    `${PROMPT_CONFIG.tones[tone] || PROMPT_CONFIG.tones.Professional}`,
    "",
    `${PROMPT_CONFIG.questionTypes[questionType] || ""}`,
    `Generate exactly ${numberOfQuestions} ${questionType} interview questions for a ${seniorityLevel} ${jobTitle} at ${companyName}.`,
    `Candidate has ${experience} years experience with ${skills}.`,
    jd ? `Job Description Context: ${jd}` : "",
    "",
    "Format each question-answer pair exactly like this:",
    "Q: [Full question text]",
    "A: [Complete answer in specified length and tone]",
    "",
    "Important: Only return the Q&A pairs, no additional commentary."
  ].filter(part => part !== "").join('\n');
}

module.exports = { buildPrompt };