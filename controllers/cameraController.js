const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { StillCamera, StreamCamera, Codec } = require('pi-camera-connect');
const dotenv = require('dotenv');

dotenv.config();

// Camera configuration
const config = {
  enabled: process.env.CAMERA_ENABLED === 'true',
  width: parseInt(process.env.CAMERA_WIDTH) || 640,
  height: parseInt(process.env.CAMERA_HEIGHT) || 480,
  quality: 85,
  rotation: 0,
  framerate: 24
};

// Camera state
let streamCamera = null;
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
    
    // Check if camera is connected
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
async function takePicture() {
  if (!config.enabled) {
    throw new Error('Camera is disabled in configuration');
  }
  
  const timestamp = Date.now();
  const filename = `image_${timestamp}.jpg`;
  const outputPath = path.join(outputDir, filename);
  const relativePath = `/images/${filename}`;
  
  try {
    // Create a new still camera instance
    const stillCamera = new StillCamera({
      width: config.width,
      height: config.height,
      rotation: config.rotation
    });
    
    console.log('Starting to take picture');
    
    // Capture image as buffer
    const image = await stillCamera.takeImage();
    
    // Save the image to file
    fs.writeFileSync(outputPath, image);
    
    console.log(`Picture taken: ${filename}`);
    return relativePath;
  } catch (error) {
    console.error('Error taking picture:', error);
    throw error;
  }
}

// Start video streaming
async function startStream(socket) {
  if (!config.enabled) {
    socket.emit('camera:error', { message: 'Camera is disabled in configuration' });
    return;
  }
  
  if (isStreaming) {
    await stopStream();
  }
  
  try {
    isStreaming = true;
    streamSocket = socket;
    
    // Create a new stream camera instance
    streamCamera = new StreamCamera({
      width: config.width,
      height: config.height,
      rotation: config.rotation,
      fps: config.framerate,
      codec: Codec.JPEG
    });
    
    // Start the camera stream
    await streamCamera.startCapture();
    
    // Set up interval to capture frames
    streamInterval = setInterval(async () => {
      if (streamSocket && isStreaming) {
        try {
          // Capture a frame
          const frameBuffer = await streamCamera.takeImage();
          
          // Convert to base64 and send to client
          const base64Image = `data:image/jpeg;base64,${frameBuffer.toString('base64')}`;
          streamSocket.emit('camera:frame', { image: base64Image });
        } catch (error) {
          console.error('Error capturing stream frame:', error);
        }
      }
    }, 100); // 10 frames per second
    
    console.log('Camera streaming started');
    socket.emit('camera:streamStarted');
  } catch (error) {
    console.error('Error starting stream:', error);
    socket.emit('camera:error', { message: error.message });
    isStreaming = false;
    streamSocket = null;
  }
}

// Stop video streaming
async function stopStream() {
  if (streamCamera && isStreaming) {
    try {
      if (streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
      }
      
      await streamCamera.stopCapture();
      streamCamera = null;
      isStreaming = false;
      
      if (streamSocket) {
        streamSocket.emit('camera:streamStopped');
        streamSocket = null;
      }
      
      console.log('Camera streaming stopped');
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
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
    framerate: config.framerate,
    isStreaming: isStreaming
  };
}

// Update camera settings
async function updateSettings(settings) {
  if (settings.width) config.width = parseInt(settings.width);
  if (settings.height) config.height = parseInt(settings.height);
  if (settings.quality) config.quality = parseInt(settings.quality);
  if (settings.rotation !== undefined) config.rotation = parseInt(settings.rotation);
  if (settings.framerate) config.framerate = parseInt(settings.framerate);
  
  // If we're streaming, restart the stream with new settings
  if (isStreaming && streamSocket) {
    await stopStream();
    await startStream(streamSocket);
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
async function cleanup() {
  if (isStreaming) {
    await stopStream();
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
