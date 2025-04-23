const PDFDocument = require('pdfkit');

exports.generatePDF = (req, res) => {
  try {
    const { title = "Interview Questions & Answers", questions = [], styles = {} } = req.body;
    
    const doc = new PDFDocument({
      margins: { top: 50, bottom: 70, left: 50, right: 50 },
      bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=interview-questions.pdf');

    doc.pipe(res);

    addTitle(doc, title);
    addQuestions(doc, questions);
    
    // Add footer only to pages that have content
    addFooterToPages(doc, styles);

    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
  }
};

function addTitle(doc, title) {
  doc.fillColor('#2563eb')
     .fontSize(24)
     .font('Helvetica-Bold')
     .text(title, { align: 'center' })
     .moveDown(0.5);
  
  doc.moveTo(50, doc.y)
     .lineTo(550, doc.y)
     .lineWidth(2)
     .stroke('#7c3aed')
     .moveDown(1);
}

function addQuestions(doc, questions) {
  const footerHeight = 30;
  const minContentSpace = 150; // Increased minimum space to prevent awkward page breaks
  
  questions.forEach((item, index) => {
    // Estimate if current content will fit on the page
    const answerHeight = estimateTextHeight(item.a, 10, doc.page.width - 100);
    const totalNeeded = 50 + answerHeight; // Space for question + answer + divider
    
    if (doc.y + totalNeeded > doc.page.height - footerHeight) {
      doc.addPage();
    }

    // Question
    doc.fillColor('#1e40af')
       .font('Helvetica-Bold')
       .fontSize(12)
       .text(`Q${index + 1}: ${item.q}`)
       .moveDown(0.3);

    // Answer
    doc.fillColor('#374151')
       .font('Helvetica')
       .fontSize(10)
       .text(`A: ${item.a}`, {
         indent: 15,
         lineGap: 5,
         paragraphGap: 5
       })
       .moveDown(0.8);

    // Divider (except after last question)
    if (index < questions.length - 1) {
      doc.moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .lineWidth(0.5)
         .stroke('#9ca3af')
         .moveDown(0.8);
    }
  });
}

function addFooterToPages(doc, styles) {
  const footerText = "Powered by ax.ai.in";
  
  // Only process pages that have content
  const pages = doc.bufferedPageRange();
  for (let i = 0; i <= pages.count; i++) {
    doc.switchToPage(i);
    
    // Calculate footer position based on actual content
    const footerY = Math.max(
      doc.y + 20, // Below last content
      doc.page.height - doc.page.margins.bottom // But at least at bottom margin
    );
    
    // Only add footer if we're not at the start of a new empty page
    if (i < pages.count || footerY < doc.page.height - 50) {
      doc.save()
         .fontSize(styles?.footerFontSize || 8)
         .fillColor(styles?.footerColor || '#6b7280')
         .text(
           footerText,
           doc.page.margins.left,
           footerY,
           {
             width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
             align: 'center'
           }
         )
         .restore();
    }
  }
}

// Helper function to estimate text height
function estimateTextHeight(text, fontSize, maxWidth) {
  const lineHeight = fontSize * 1.2;
  const words = text.split(' ');
  let lines = 1;
  let currentLineLength = 0;
  
  words.forEach(word => {
    // Approximate character count (5px per character is a rough estimate)
    const wordLength = word.length * 5;
    if (currentLineLength + wordLength > maxWidth) {
      lines++;
      currentLineLength = wordLength;
    } else {
      currentLineLength += wordLength;
    }
  });
  
  return lines * lineHeight;
}