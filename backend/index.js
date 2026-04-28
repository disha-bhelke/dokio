require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/tags', require('./routes/tagRoutes'));
app.use('/api/pdf', require('./routes/pdfRoutes'));

app.get('/', (req, res) => {
  res.send('Dokioki API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
