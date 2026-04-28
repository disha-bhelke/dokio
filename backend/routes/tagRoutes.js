const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getTags, createTag, updateTag, deleteTag } = require('../controllers/tagController');

router.route('/').get(protect, getTags).post(protect, createTag);
router.route('/:id').put(protect, updateTag).delete(protect, deleteTag);

module.exports = router;
