// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// 🚨 CRUCIAL: Configure Express to serve static files (like your CSS)
// Assuming your final CSS is in a folder named 'public'
// app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(cors());
app.use(express.json()); // Allows parsing JSON request bodies

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const contactRoutes = require('./routes/contactRoutes');

// Route Linking
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/contacts', contactRoutes);

// 1. Database Connection
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully.');
    
    // 2. Start Server after successful DB connection
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => console.error('DB connection error:', err));

// 3. Basic Test Route
app.get('/', (req, res) => {
  res.send('CRM API is operational.');
});