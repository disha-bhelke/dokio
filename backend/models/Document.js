const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  fileUrl: { type: String, required: true },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
