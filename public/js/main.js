document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectionStatus = document.getElementById('connection-status');
  const colorPicker = document.getElementById('color-picker');
  const brightnessSlider = document.getElementById('brightness-slider');
  const brightnessValue = document.getElementById('brightness-value');
  const patternSelect = document.getElementById('pattern-select');
  const ledOffBtn = document.getElementById('led-off-btn');
  const cameraImage = document.getElementById('camera-image');
  const takePictureBtn = document.getElementById('take-picture-btn');
  const toggleStreamBtn = document.getElementById('toggle-stream-btn');
  const cameraRotation = document.getElementById('camera-rotation');
  const imageGallery = document.getElementById('image-gallery');
  const serverTime = document.getElementById('server-time');
  const themeToggle = document.getElementById('theme-toggle');
  
  // Socket.io connection
  const socket = io();
  let isStreaming = false;
  
  // Connection status
  socket.on('connect', () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.add('connected');
    fetchInitialData();
  });
  
  socket.on('disconnect', () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.classList.remove('connected');
  });
  
  // Fetch initial data
  function fetchInitialData() {
    // Get LED status
    fetch('/api/status')
      .then(response => response.json())
      .then(data => {
        if (data.ledStatus) {
          const { color, brightness, pattern } = data.ledStatus;
          
          // Update color picker
          const hexColor = rgbToHex(color.r, color.g, color.b);
          colorPicker.value = hexColor;
          
          // Update brightness slider
          brightnessSlider.value = brightness;
          brightnessValue.textContent = brightness;
          
          // Update pattern select
          patternSelect.value = pattern;
        }
      })
      .catch(error => console.error('Error fetching status:', error));
    
    // Get available patterns
    fetch('/api/led/patterns')
      .then(response => response.json())
      .then(data => {
        if (data.patterns) {
          // Clear existing options
          patternSelect.innerHTML = '';
          
          // Add options for each pattern
          Object.entries(data.patterns).forEach(([value, pattern]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = pattern.name;
            patternSelect.appendChild(option);
          });
        }
      })
      .catch(error => console.error('Error fetching patterns:', error));
    
    // Load image gallery
    loadImageGallery();
  }
  
  // LED Control Events
  colorPicker.addEventListener('change', () => {
    const rgb = hexToRgb(colorPicker.value);
    setLedColor(rgb.r, rgb.g, rgb.b);
  });
  
  brightnessSlider.addEventListener('input', () => {
    const brightness = parseInt(brightnessSlider.value);
    brightnessValue.textContent = brightness;
    setLedBrightness(brightness);
  });
  
  patternSelect.addEventListener('change', () => {
    setLedPattern(patternSelect.value);
  });
  
  ledOffBtn.addEventListener('click', () => {
    setLedColor(0, 0, 0);
    colorPicker.value = '#000000';
  });
  
  // Camera Control Events
  takePictureBtn.addEventListener('click', () => {
    takePicture();
  });
  
  toggleStreamBtn.addEventListener('click', () => {
    if (isStreaming) {
      stopStream();
    } else {
      startStream();
    }
  });
  
  cameraRotation.addEventListener('change', () => {
    updateCameraSettings({
      rotation: parseInt(cameraRotation.value)
    });
  });
  
  // Socket.io event handlers
  socket.on('led:colorChanged', (data) => {
    const hexColor = rgbToHex(data.r, data.g, data.b);
    colorPicker.value = hexColor;
  });
  
  socket.on('led:brightnessChanged', (brightness) => {
    brightnessSlider.value = brightness;
    brightnessValue.textContent = brightness;
  });
  
  socket.on('led:patternChanged', (pattern) => {
    patternSelect.value = pattern;
  });
  
  socket.on('camera:pictureTaken', (data) => {
    // Add the new image to the gallery
    addImageToGallery(data.path);
    
    // Show the image in the preview
    cameraImage.src = data.path;
  });
  
  socket.on('camera:frame', (data) => {
    if (isStreaming) {
      cameraImage.src = data.image;
    }
  });
  
  socket.on('camera:streamStarted', () => {
    isStreaming = true;
    toggleStreamBtn.textContent = 'Stop Stream';
    toggleStreamBtn.classList.remove('secondary');
    toggleStreamBtn.classList.add('danger');
  });
  
  socket.on('camera:streamStopped', () => {
    isStreaming = false;
    toggleStreamBtn.textContent = 'Start Stream';
    toggleStreamBtn.classList.remove('danger');
    toggleStreamBtn.classList.add('secondary');
  });
  
  socket.on('camera:error', (data) => {
    alert(`Camera Error: ${data.message}`);
  });
  
  // LED Control Functions
  function setLedColor(r, g, b) {
    fetch('/api/led/color', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ r, g, b })
    })
      .catch(error => console.error('Error setting LED color:', error));
  }
  
  function setLedBrightness(brightness) {
    fetch('/api/led/brightness', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ brightness })
    })
      .catch(error => console.error('Error setting LED brightness:', error));
  }
  
  function setLedPattern(pattern) {
    fetch('/api/led/pattern', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pattern })
    })
      .catch(error => console.error('Error setting LED pattern:', error));
  }
  
  // Camera Control Functions
  function takePicture() {
    takePictureBtn.disabled = true;
    takePictureBtn.textContent = 'Taking Picture...';
    
    fetch('/api/camera/picture')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          cameraImage.src = data.path;
          addImageToGallery(data.path);
        } else {
          alert(`Error: ${data.message}`);
        }
      })
      .catch(error => console.error('Error taking picture:', error))
      .finally(() => {
        takePictureBtn.disabled = false;
        takePictureBtn.textContent = 'Take Picture';
      });
  }
  
  function startStream() {
    socket.emit('camera:startStream');
  }
  
  function stopStream() {
    socket.emit('camera:stopStream');
  }
  
  function updateCameraSettings(settings) {
    fetch('/api/camera/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    })
      .catch(error => console.error('Error updating camera settings:', error));
  }
  
  // Gallery Functions
  function loadImageGallery() {
    // This would typically fetch from a server endpoint that lists images
    // For simplicity, we'll just check if there are any images in the public/images directory
    fetch('/api/camera/picture')
      .then(response => response.json())
      .then(data => {
        if (data.success && data.path) {
          addImageToGallery(data.path);
        }
      })
      .catch(error => console.error('Error loading gallery:', error));
  }
  
  function addImageToGallery(imagePath) {
    const img = document.createElement('img');
    img.src = imagePath;
    img.alt = 'Captured Image';
    img.addEventListener('click', () => {
      cameraImage.src = imagePath;
    });
    
    // Add to the beginning of the gallery
    if (imageGallery.firstChild) {
      imageGallery.insertBefore(img, imageGallery.firstChild);
    } else {
      imageGallery.appendChild(img);
    }
  }
  
  // Utility Functions
  function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
  
  // Update server time
  function updateServerTime() {
    const now = new Date();
    serverTime.textContent = now.toLocaleString();
  }
  
  setInterval(updateServerTime, 1000);
  updateServerTime();
  
  // Theme toggle functionality
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  if (isDarkMode) {
    document.documentElement.classList.add('dark-mode');
    themeToggle.textContent = '☀️ Light Mode';
  } else {
    document.documentElement.classList.remove('dark-mode');
    themeToggle.textContent = '🌙 Dark Mode';
  }
  
  themeToggle.addEventListener('click', () => {
    const isDarkMode = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    
    if (isDarkMode) {
      themeToggle.textContent = '☀️ Light Mode';
    } else {
      themeToggle.textContent = '🌙 Dark Mode';
    }
  });
});
