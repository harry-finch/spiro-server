const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const RaspiCam = require('raspicam');
const dotenv = require('dotenv');

dotenv.config();

// Camera configuration
const config = {
  enabled: process.env.CAMERA_ENABLED === 'true',
  width: parseInt(process.env.CAMERA_WIDTH) || 640,
  height: parseInt(process.env.CAMERA_HEIGHT) || 480,
  quality: 85,
  encoding: 'jpg',
  timeout: 0, // For streaming
  framerate: 24,
  rotation: 0
};

// Camera state
let camera = null;
let isStreaming = false;
let streamSocket = null;
let streamInterval = null;
const outputDir = path.join(__dirname, '../public/images');

// Initialize the camera
function init() {
  if (!config.enabled) {
    console.log('Camera is disabled in configuration');
    return;
  }
  
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Check if ArduCAM is connected
    exec('vcgencmd get_camera', (error, stdout, stderr) => {
      if (error) {
        console.error('Error checking camera:', error);
        return;
      }
      
      if (stdout.includes('detected=1')) {
        console.log('Camera detected and initialized');
      } else {
        console.warn('No camera detected. Camera functionality will be limited.');
      }
    });
  } catch (error) {
    console.error('Failed to initialize camera:', error);
  }
}

// Take a picture with the camera
function takePicture() {
  return new Promise((resolve, reject) => {
    if (!config.enabled) {
      reject(new Error('Camera is disabled in configuration'));
      return;
    }
    
    const timestamp = Date.now();
    const filename = `image_${timestamp}.jpg`;
    const outputPath = path.join(outputDir, filename);
    const relativePath = `/images/${filename}`;
    
    // Create a new camera instance for this picture
    const options = {
      mode: 'photo',
      output: outputPath,
      width: config.width,
      height: config.height,
      quality: config.quality,
      encoding: config.encoding,
      rotation: config.rotation
    };
    
    const cam = new RaspiCam(options);
    
    cam.on('start', () => {
      console.log('Starting to take picture');
    });
    
    cam.on('read', (err, timestamp, filename) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`Picture taken: ${filename}`);
      resolve(relativePath);
      cam.stop();
    });
    
    cam.on('exit', () => {
      console.log('Camera process exited');
    });
    
    cam.start();
  });
}

// Start video streaming
function startStream(socket) {
  if (!config.enabled) {
    socket.emit('camera:error', { message: 'Camera is disabled in configuration' });
    return;
  }
  
  if (isStreaming) {
    stopStream();
  }
  
  isStreaming = true;
  streamSocket = socket;
  
  const streamOptions = {
    mode: 'timelapse',
    output: path.join(outputDir, 'stream_frame.jpg'),
    width: config.width,
    height: config.height,
    quality: 60, // Lower quality for streaming
    encoding: config.encoding,
    rotation: config.rotation,
    timelapse: 250 // Take a frame every 250ms
  };
  
  camera = new RaspiCam(streamOptions);
  
  camera.on('read', (err, timestamp, filename) => {
    if (err) {
      console.error('Error reading stream frame:', err);
      return;
    }
    
    if (streamSocket && isStreaming) {
      const framePath = path.join(outputDir, 'stream_frame.jpg');
      
      fs.readFile(framePath, (err, data) => {
        if (err) {
          console.error('Error reading frame file:', err);
          return;
        }
        
        const base64Image = `data:image/jpeg;base64,${data.toString('base64')}`;
        streamSocket.emit('camera:frame', { image: base64Image });
      });
    }
  });
  
  camera.start();
  
  console.log('Camera streaming started');
  socket.emit('camera:streamStarted');
}

// Stop video streaming
function stopStream() {
  if (camera && isStreaming) {
    camera.stop();
    camera = null;
    isStreaming = false;
    
    if (streamSocket) {
      streamSocket.emit('camera:streamStopped');
      streamSocket = null;
    }
    
    console.log('Camera streaming stopped');
  }
}

// Get camera settings
function getSettings() {
  return {
    enabled: config.enabled,
    width: config.width,
    height: config.height,
    quality: config.quality,
    rotation: config.rotation,
    isStreaming: isStreaming
  };
}

// Update camera settings
function updateSettings(settings) {
  if (settings.width) config.width = parseInt(settings.width);
  if (settings.height) config.height = parseInt(settings.height);
  if (settings.quality) config.quality = parseInt(settings.quality);
  if (settings.rotation !== undefined) config.rotation = parseInt(settings.rotation);
  
  // If we're streaming, restart the stream with new settings
  if (isStreaming && streamSocket) {
    stopStream();
    startStream(streamSocket);
  }
  
  return getSettings();
}

// Get camera status
function getStatus() {
  return {
    enabled: config.enabled,
    isStreaming: isStreaming,
    resolution: `${config.width}x${config.height}`
  };
}

// Clean up resources when shutting down
function cleanup() {
  if (camera) {
    stopStream();
  }
}

module.exports = {
  init,
  takePicture,
  startStream,
  stopStream,
  getSettings,
  updateSettings,
  getStatus,
  cleanup
};
