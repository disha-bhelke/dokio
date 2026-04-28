const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const { uploadDocument, getDocuments, updateDocument, deleteDocument } = require('../controllers/documentController');

router.post('/upload', protect, upload.single('image'), uploadDocument);
router.get('/', protect, getDocuments);
router.put('/:id', protect, updateDocument);
router.delete('/:id', protect, deleteDocument);

module.exports = router;
