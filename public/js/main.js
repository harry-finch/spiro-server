document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectionStatus = document.getElementById('connection-status');
  const brightnessSlider = document.getElementById('brightness-slider');
  const brightnessValue = document.getElementById('brightness-value');
  const ledOffBtn = document.getElementById('led-off-btn');
  const cameraImage = document.getElementById('camera-image');
  const takePictureBtn = document.getElementById('take-picture-btn');
  const toggleStreamBtn = document.getElementById('toggle-stream-btn');
  const cameraRotation = document.getElementById('camera-rotation');
  const imageGallery = document.getElementById('image-gallery');
  const serverTime = document.getElementById('server-time');
  const themeToggle = document.getElementById('theme-toggle');
  
  // Color buttons
  const whiteBtn = document.getElementById('white-btn');
  const redBtn = document.getElementById('red-btn');
  const greenBtn = document.getElementById('green-btn');
  const blueBtn = document.getElementById('blue-btn');
  const yellowBtn = document.getElementById('yellow-btn');
  const cyanBtn = document.getElementById('cyan-btn');
  const magentaBtn = document.getElementById('magenta-btn');
  
  // Color values
  const colorValues = {
    white: { r: 255, g: 255, b: 255 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 255, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    cyan: { r: 0, g: 255, b: 255 },
    magenta: { r: 255, g: 0, b: 255 }
  };
  
  let activeColorButton = whiteBtn; // Default to white
  
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
          const { brightness } = data.ledStatus;
          
          // Update brightness slider
          brightnessSlider.value = brightness;
          brightnessValue.textContent = brightness;
          
          // By default, set to white on startup (even though LEDs are already white)
          setActiveColorButton(whiteBtn);
        }
      })
      .catch(error => console.error('Error fetching status:', error));
    
    // Load image gallery
    loadImageGallery();
  }
  
  // Make a color button active
  function setActiveColorButton(button) {
    // Remove active class from current active button
    if (activeColorButton) {
      activeColorButton.classList.remove('active');
    }
    
    // Set new active button
    activeColorButton = button;
    activeColorButton.classList.add('active');
  }
  
  // LED Control Events - Color Buttons
  whiteBtn.addEventListener('click', () => {
    setActiveColorButton(whiteBtn);
    setLedColor(colorValues.white.r, colorValues.white.g, colorValues.white.b);
  });
  
  redBtn.addEventListener('click', () => {
    setActiveColorButton(redBtn);
    setLedColor(colorValues.red.r, colorValues.red.g, colorValues.red.b);
  });
  
  greenBtn.addEventListener('click', () => {
    setActiveColorButton(greenBtn);
    setLedColor(colorValues.green.r, colorValues.green.g, colorValues.green.b);
  });
  
  blueBtn.addEventListener('click', () => {
    setActiveColorButton(blueBtn);
    setLedColor(colorValues.blue.r, colorValues.blue.g, colorValues.blue.b);
  });
  
  yellowBtn.addEventListener('click', () => {
    setActiveColorButton(yellowBtn);
    setLedColor(colorValues.yellow.r, colorValues.yellow.g, colorValues.yellow.b);
  });
  
  cyanBtn.addEventListener('click', () => {
    setActiveColorButton(cyanBtn);
    setLedColor(colorValues.cyan.r, colorValues.cyan.g, colorValues.cyan.b);
  });
  
  magentaBtn.addEventListener('click', () => {
    setActiveColorButton(magentaBtn);
    setLedColor(colorValues.magenta.r, colorValues.magenta.g, colorValues.magenta.b);
  });
  
  brightnessSlider.addEventListener('input', () => {
    const brightness = parseInt(brightnessSlider.value);
    brightnessValue.textContent = brightness;
    setLedBrightness(brightness);
  });
  
  ledOffBtn.addEventListener('click', () => {
    setLedColor(0, 0, 0);
    // Don't set any color button as active
    if (activeColorButton) {
      activeColorButton.classList.remove('active');
      activeColorButton = null;
    }
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
  socket.on('led:brightnessChanged', (brightness) => {
    brightnessSlider.value = brightness;
    brightnessValue.textContent = brightness;
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
  
  // Highlight the white button as active on page load (since LEDs start as white)
  setActiveColorButton(whiteBtn);
});