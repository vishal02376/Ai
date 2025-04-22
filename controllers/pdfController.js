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
      doc
        .font(styles?.titleFont || 'Helvetica-Bold')
        .fontSize(12) // 🔽 Slightly smaller than before
        .fillColor(styles?.questionColor || '#1A73E8')
        .text(`Q${index + 1}: ${item.q}`)
        .moveDown(0.3);
    
      // Answer
      doc
        .font(styles?.contentFont || 'Helvetica')
        .fontSize(10) // ✅ Standard answer font
        .fillColor(styles?.answerColor || '#333333')
        .text(`A: ${item.a}`, {
          indent: 15,
          lineGap: 4
        })
        .moveDown(1);
    
      // Divider line (optional but clean)
      doc
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor('#e5e7eb')
        .lineWidth(0.5)
        .stroke()
        .moveDown(1);
    });
    

    // Footer
    doc.fontSize(9)
       .fillColor('#888888')
       .text(`Generated on ${new Date().toLocaleString()}`, { align: 'center', lineGap: 2 });

    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};