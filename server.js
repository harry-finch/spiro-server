const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import controllers
const ledController = require('./controllers/ledController');
const cameraController = require('./controllers/cameraController');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize hardware controllers
ledController.init();
cameraController.init();

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
  
  // LED control via socket
  socket.on('led:setColor', (data) => {
    ledController.setColor(data.r, data.g, data.b);
    io.emit('led:colorChanged', data);
  });
  
  socket.on('led:setBrightness', (brightness) => {
    ledController.setBrightness(brightness);
    io.emit('led:brightnessChanged', brightness);
  });
  
  socket.on('led:setPattern', (pattern) => {
    ledController.setPattern(pattern);
    io.emit('led:patternChanged', pattern);
  });
  
  // Camera control via socket
  socket.on('camera:takePicture', async () => {
    try {
      const imagePath = await cameraController.takePicture();
      io.emit('camera:pictureTaken', { path: imagePath });
    } catch (error) {
      io.emit('camera:error', { message: error.message });
    }
  });
  
  socket.on('camera:startStream', () => {
    cameraController.startStream(socket);
  });
  
  socket.on('camera:stopStream', () => {
    cameraController.stopStream();
  });
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    ledStatus: ledController.getStatus(),
    cameraStatus: cameraController.getStatus()
  });
});

// LED Routes
app.post('/api/led/color', (req, res) => {
  const { r, g, b } = req.body;
  ledController.setColor(r, g, b);
  io.emit('led:colorChanged', { r, g, b });
  res.json({ success: true, color: { r, g, b } });
});

app.post('/api/led/brightness', (req, res) => {
  const { brightness } = req.body;
  ledController.setBrightness(brightness);
  io.emit('led:brightnessChanged', brightness);
  res.json({ success: true, brightness });
});

app.post('/api/led/pattern', (req, res) => {
  const { pattern } = req.body;
  ledController.setPattern(pattern);
  io.emit('led:patternChanged', pattern);
  res.json({ success: true, pattern });
});

app.get('/api/led/patterns', (req, res) => {
  res.json({ patterns: ledController.getPatterns() });
});

// Camera Routes
app.get('/api/camera/picture', async (req, res) => {
  try {
    const imagePath = await cameraController.takePicture();
    res.json({ success: true, path: imagePath });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/camera/settings', (req, res) => {
  res.json(cameraController.getSettings());
});

app.post('/api/camera/settings', (req, res) => {
  const settings = req.body;
  cameraController.updateSettings(settings);
  res.json({ success: true, settings: cameraController.getSettings() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('Shutting down gracefully...');
  ledController.cleanup();
  cameraController.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}
