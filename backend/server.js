const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const cityRoutes = require('./routes/cityRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    message: 'Smart City Dashboard API is active',
    timestamp: new Date().toISOString()
  });
});

// City Data Endpoints
app.use('/api/city', cityRoutes);

// AI Assistant Endpoints
app.use('/api/ai', aiRoutes);

// 404 Handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Smart City Dashboard Backend running`);
  console.log(` Server URL : http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log(` City Overview: http://localhost:${PORT}/api/city/overview`);
  console.log(` AI Chat    : http://localhost:${PORT}/api/ai/chat`);
  console.log(`===============================================`);
});
