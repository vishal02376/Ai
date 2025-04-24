function parseResponse(text, expectedCount) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const qaPairs = [];
    let currentQ = null;
    let currentA = null;
  
    for (const line of lines) {
      if (line.match(/^Q[:.]?\s*/i)) {
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
  
    if (currentQ && currentA) {
      qaPairs.push({
        question: currentQ.replace(/^Q[:.]?\s*/i, '').trim(),
        answer: currentA.trim()
      });
    }
  
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
  
  module.exports = { parseResponse };