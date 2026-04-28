const Tag = require('../models/Tag');

const getTags = async (req, res) => {
  try {
    const tags = await Tag.find({ userId: req.user.id });
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tags' });
  }
};

const createTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ message: 'Tag name is required' });

    const tag = await Tag.create({
      userId: req.user.id,
      name,
      color: color || '#e2e8f0'
    });

    res.status(201).json(tag);
  } catch (error) {
    res.status(500).json({ message: 'Error creating tag' });
  }
};

const updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const tag = await Tag.findOne({ _id: id, userId: req.user.id });
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    if (typeof name !== 'undefined') {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Tag name is required' });
      }
      tag.name = trimmed;
    }

    if (typeof color !== 'undefined') {
      tag.color = color;
    }

    await tag.save();
    return res.status(200).json(tag);
  } catch (error) {
    return res.status(500).json({ message: 'Error updating tag' });
  }
};

const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    const tag = await Tag.findOne({ _id: id, userId: req.user.id });
    
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    await tag.deleteOne();
    res.status(200).json({ message: 'Tag deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting tag' });
  }
};

module.exports = { getTags, createTag, updateTag, deleteTag };
