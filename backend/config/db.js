const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Migration safety: remove old indexes from previous auth schemas (e.g. googleId)
    try {
      await User.syncIndexes();
    } catch (indexError) {
      console.warn('Index sync skipped/failed:', indexError.message);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
