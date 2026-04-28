const { PDFDocument } = require('pdf-lib');
const Document = require('../models/Document');

// Global fetch is available in Node 18+
const generatePdf = async (req, res) => {
  try {
    const { documentIds } = req.body;
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of document IDs' });
    }

    const docs = await Document.find({ _id: { $in: documentIds }, userId: req.user.id });
    const orderedDocs = documentIds.map(id => docs.find(d => d._id.toString() === id)).filter(Boolean);

    const pdfDoc = await PDFDocument.create();

    for (const doc of orderedDocs) {
      try {
        const imageResponse = await fetch(doc.fileUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        
        let image;
        if (doc.fileUrl.toLowerCase().endsWith('.png')) {
          image = await pdfDoc.embedPng(imageBuffer);
        } else {
          image = await pdfDoc.embedJpg(imageBuffer);
        }

        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        
        const imgDims = image.scaleToFit(width - 40, height - 40);

        page.drawImage(image, {
          x: page.getWidth() / 2 - imgDims.width / 2,
          y: page.getHeight() / 2 - imgDims.height / 2,
          width: imgDims.width,
          height: imgDims.height,
        });
      } catch (err) {
        console.error(`Error embedding image ${doc.fileUrl}:`, err);
      }
    }

    const pdfBytes = await pdfDoc.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=dokioki_documents.pdf');
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Error generating PDF' });
  }
};

module.exports = { generatePdf };
