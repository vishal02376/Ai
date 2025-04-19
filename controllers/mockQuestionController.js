exports.generateQuestions = async (req, res) => {
    const { jobTitle, skills, companyName = "", experience = "", seniorityLevel = "" } = req.body;
  
    if (!jobTitle || !skills) {
      return res.status(400).json({ error: "Missing required fields" });
    }
  
    const dummyQuestions = [
      {
        question: `What are key responsibilities of a ${jobTitle}?`,
        answer: `As a ${jobTitle}, your key responsibilities involve working with technologies like ${skills}...`
      },
      {
        question: `How do you handle project deadlines in a ${seniorityLevel} role?`,
        answer: `By using planning tools and maintaining clear communication.`
      },
      {
        question: `Describe a challenging task at ${companyName || "your previous company"}.`,
        answer: `Handled a critical bug in production under tight deadlines.`
      },
      {
        question: `How do you keep up with ${skills.split(',')[0]} trends?`,
        answer: `Through blogs, YouTube, and official documentation.`
      },
     
    ];
  
    return res.status(200).json({
      questions: dummyQuestions
    });
  };
  