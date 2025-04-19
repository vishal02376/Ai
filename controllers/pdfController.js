const PDFDocument = require('pdfkit');

exports.generatePDF = (req, res) => {
  try {
    const { title, questions, styles } = req.body;
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=interview-questions.pdf');

    // PDF Content
    doc.pipe(res);
    
    // Title
    doc.fontSize(20)
       .text(title, { align: 'center', underline: true })
       .moveDown(1);
    
    // Questions and Answers
    questions.forEach((item, index) => {
      // Question
      doc.fontSize(14)
         .fillColor(styles?.questionColor || '#1A73E8')
         .text(`Q${index + 1}: ${item.q}`)
         .moveDown(0.3);
      
      // Answer
      doc.fontSize(12)
         .fillColor(styles?.answerColor || '#333333')
         .text(`A: ${item.a}`)
         .moveDown(1);
    });

    // Footer
    doc.fontSize(10)
       .fillColor('#888888')
       .text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};