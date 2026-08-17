const Document = require('../models/Document');
const cloudinary = require('../config/cloudinary');
const { processScanImage } = require('../services/scanProcessor');

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { name, tags } = req.body;

    // Upload to cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'dokioki_docs' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const parsedTags = tags ? JSON.parse(tags) : [];

    const newDocument = await Document.create({
      userId: req.user.id,
      name: name || 'Untitled Document',
      fileUrl: result.secure_url,
      tags: parsedTags,
    });

    res.status(201).json(newDocument);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading document' });
  }
};

const scanDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let corners = null;
    if (req.body.corners) {
      corners = JSON.parse(req.body.corners);
    }

    const blackAndWhite = req.body.blackAndWhite === 'true' || req.body.blackAndWhite === true;

    const result = await processScanImage({
      imageBuffer: req.file.buffer,
      corners,
      blackAndWhite,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ message: error.message || 'Error processing document scan' });
  }
};

const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.user.id }).populate('tags').sort({ createdAt: -1 });
    res.status(200).json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents' });
  }
};

const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tags } = req.body;

    const document = await Document.findOne({ _id: id, userId: req.user.id });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (name) document.name = name;
    if (tags) document.tags = tags;

    await document.save();
    res.status(200).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error updating document' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findOne({ _id: id, userId: req.user.id });
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const urlParts = document.fileUrl.split('/');
    const filenameWithExt = urlParts[urlParts.length - 1];
    const publicId = `dokioki_docs/${filenameWithExt.split('.')[0]}`;

    await cloudinary.uploader.destroy(publicId);
    await document.deleteOne();

    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document' });
  }
};

module.exports = { uploadDocument, scanDocument, getDocuments, updateDocument, deleteDocument };
