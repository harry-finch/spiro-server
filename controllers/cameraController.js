const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config();

// Camera configuration
const config = {
  enabled: process.env.CAMERA_ENABLED === 'true',
  width: parseInt(process.env.CAMERA_WIDTH) || 640,
  height: parseInt(process.env.CAMERA_HEIGHT) || 480,
  quality: 85,
  rotation: 0,
  framerate: 24,
  timeout: 1000 // Default timeout for still images (ms)
};

// Camera state
let streamProcess = null;
let isStreaming = false;
let streamSocket = null;
let streamDir = null;
const outputDir = path.join(__dirname, '../public/images');
const streamOutputDir = path.join(__dirname, '../public/stream');

// Initialize the camera
function init() {
  if (!config.enabled) {
    console.log('Camera is disabled in configuration');
    return;
  }
  
  try {
    // Ensure output directories exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    if (!fs.existsSync(streamOutputDir)) {
      fs.mkdirSync(streamOutputDir, { recursive: true });
    }
    
    // Check if camera is connected using libcamera-still
    exec('libcamera-still --list-cameras', (error, stdout, stderr) => {
      if (error) {
        console.error('Error checking camera:', error);
        return;
      }
      
      if (stdout.includes('Available cameras')) {
        console.log('Camera detected and initialized');
        console.log(stdout);
      } else {
        console.warn('No camera detected. Camera functionality will be limited.');
      }
    });
  } catch (error) {
    console.error('Failed to initialize camera:', error);
  }
}

// Take a picture with the camera using libcamera-still
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
    
    console.log('Starting to take picture');
    
    // Build the libcamera-still command
    const args = [
      `--width`, config.width,
      `--height`, config.height,
      `--rotation`, config.rotation,
      `--quality`, config.quality,
      `--output`, outputPath,
      `--timeout`, config.timeout
    ];
    
    // Execute libcamera-still command
    const cameraProcess = spawn('libcamera-still', args);
    
    let errorOutput = '';
    
    cameraProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    cameraProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`libcamera-still process exited with code ${code}`);
        console.error(`Error output: ${errorOutput}`);
        reject(new Error(`Failed to take picture: ${errorOutput}`));
        return;
      }
      
      // Check if the file was created
      if (fs.existsSync(outputPath)) {
        console.log(`Picture taken: ${filename}`);
        resolve(relativePath);
      } else {
        reject(new Error('Picture file was not created'));
      }
    });
    
    cameraProcess.on('error', (err) => {
      console.error('Failed to start libcamera-still process:', err);
      reject(err);
    });
  });
}

// Start video streaming using libcamera-vid
function startStream(socket) {
  if (!config.enabled) {
    socket.emit('camera:error', { message: 'Camera is disabled in configuration' });
    return;
  }
  
  if (isStreaming) {
    stopStream();
  }
  
  try {
    isStreaming = true;
    streamSocket = socket;
    
    // Create a unique directory for this stream session
    const timestamp = Date.now();
    streamDir = path.join(streamOutputDir, `stream_${timestamp}`);
    
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }
    
    // Build the libcamera-vid command for MJPEG streaming
    const args = [
      `--width`, config.width,
      `--height`, config.height,
      `--rotation`, config.rotation,
      `--framerate`, config.framerate,
      `--codec`, 'mjpeg',
      `--segment`, 1, // Create a new file every second
      `--wrap`, 10,   // Keep only 10 files
      `--output`, path.join(streamDir, 'frame_%d.jpg'),
      `--timeout`, 0  // Run indefinitely
    ];
    
    // Start the libcamera-vid process
    streamProcess = spawn('libcamera-vid', args);
    
    let errorOutput = '';
    
    streamProcess.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      
      // Log only if it's not the common "Frame rate set to" message
      if (!output.includes('Frame rate set to')) {
        console.log(`libcamera-vid stderr: ${output}`);
      }
    });
    
    streamProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`libcamera-vid process exited with code ${code}`);
        console.error(`Error output: ${errorOutput}`);
        
        if (streamSocket) {
          streamSocket.emit('camera:error', { 
            message: `Stream process exited unexpectedly: ${errorOutput}` 
          });
        }
      }
      
      // Clean up
      isStreaming = false;
      streamProcess = null;
      
      if (streamSocket) {
        streamSocket.emit('camera:streamStopped');
        streamSocket = null;
      }
    });
    
    streamProcess.on('error', (err) => {
      console.error('Failed to start libcamera-vid process:', err);
      
      if (streamSocket) {
        streamSocket.emit('camera:error', { 
          message: `Failed to start stream: ${err.message}` 
        });
      }
      
      isStreaming = false;
      streamProcess = null;
      streamSocket = null;
    });
    
    // Set up interval to read the latest frame and send to client
    const frameInterval = setInterval(() => {
      if (!isStreaming || !streamSocket) {
        clearInterval(frameInterval);
        return;
      }
      
      // Find the latest frame file
      fs.readdir(streamDir, (err, files) => {
        if (err) {
          console.error('Error reading stream directory:', err);
          return;
        }
        
        // Filter for jpg files and sort by name (which includes frame number)
        const frameFiles = files
          .filter(file => file.endsWith('.jpg'))
          .sort((a, b) => {
            const numA = parseInt(a.match(/frame_(\d+)\.jpg/)[1]);
            const numB = parseInt(b.match(/frame_(\d+)\.jpg/)[1]);
            return numB - numA; // Descending order
          });
        
        if (frameFiles.length > 0) {
          const latestFrame = path.join(streamDir, frameFiles[0]);
          
          // Read the frame file
          fs.readFile(latestFrame, (err, data) => {
            if (err) {
              console.error('Error reading frame file:', err);
              return;
            }
            
            // Convert to base64 and send to client
            const base64Image = `data:image/jpeg;base64,${data.toString('base64')}`;
            streamSocket.emit('camera:frame', { image: base64Image });
          });
        }
      });
    }, 100); // Check for new frames every 100ms
    
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
function stopStream() {
  if (streamProcess && isStreaming) {
    try {
      // Kill the libcamera-vid process
      streamProcess.kill('SIGTERM');
      streamProcess = null;
      isStreaming = false;
      
      if (streamSocket) {
        streamSocket.emit('camera:streamStopped');
        streamSocket = null;
      }
      
      console.log('Camera streaming stopped');
      
      // Clean up stream directory
      if (streamDir && fs.existsSync(streamDir)) {
        // Delete all files in the stream directory
        const files = fs.readdirSync(streamDir);
        for (const file of files) {
          fs.unlinkSync(path.join(streamDir, file));
        }
        
        // Remove the directory
        fs.rmdirSync(streamDir);
        streamDir = null;
      }
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
function updateSettings(settings) {
  if (settings.width) config.width = parseInt(settings.width);
  if (settings.height) config.height = parseInt(settings.height);
  if (settings.quality) config.quality = parseInt(settings.quality);
  if (settings.rotation !== undefined) config.rotation = parseInt(settings.rotation);
  if (settings.framerate) config.framerate = parseInt(settings.framerate);
  
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
  if (isStreaming) {
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
