const five = require('johnny-five');
const pixel = require('node-pixel');
const dotenv = require('dotenv');

dotenv.config();

// LED strip configuration
const config = {
  ledCount: parseInt(process.env.LED_COUNT) || 60,
  pin: process.env.LED_PIN || 6,         // Data pin (D6 by default)
  controller: process.env.LED_CONTROLLER || 'FIRMATA',
  stripType: process.env.LED_STRIP_TYPE || 'WS2812',
  brightness: parseInt(process.env.LED_BRIGHTNESS) || 100  // 0-100 for node-pixel
};

// LED strip state
let strip = null;
let board = null;
let currentColor = { r: 0, g: 0, b: 0 };
let currentBrightness = config.brightness;
let currentPattern = 'solid';
let patternInterval = null;
let isReady = false;

// Available patterns
const patterns = {
  solid: { name: 'Solid Color', description: 'Display a single color' },
  rainbow: { name: 'Rainbow', description: 'Cycle through rainbow colors' },
  pulse: { name: 'Pulse', description: 'Pulse the current color' },
  chase: { name: 'Chase', description: 'Chase effect with current color' },
  alternating: { name: 'Alternating', description: 'Alternate between two colors' }
};

// Initialize the LED strip
function init() {
  return new Promise((resolve, reject) => {
    try {
      // Initialize Johnny-Five board
      board = new five.Board({
        repl: false,
        debug: false
      });

      board.on('ready', () => {
        console.log('Board connected');
        
        // Initialize the LED strip
        strip = new pixel.Strip({
          board: board,
          controller: config.controller,
          strips: [{ pin: config.pin, length: config.ledCount }],
          gamma: 2.8
        });

        strip.on('ready', () => {
          console.log(`LED strip initialized with ${config.ledCount} LEDs on pin ${config.pin}`);
          
          // Set initial brightness
          strip.brightness(currentBrightness / 100);  // node-pixel uses 0-1 for brightness
          
          // Turn off all LEDs initially
          setColor(0, 0, 0);
          
          isReady = true;
          resolve();
        });

        strip.on('error', (err) => {
          console.error('LED strip error:', err);
          reject(err);
        });
      });

      board.on('error', (err) => {
        console.error('Board error:', err);
        reject(err);
      });
    } catch (error) {
      console.error('Failed to initialize LED strip:', error);
      reject(error);
    }
  });
}

// Set all LEDs to a single color
function setColor(r, g, b) {
  if (!isReady) {
    console.warn('LED strip not ready');
    return currentColor;
  }
  
  currentColor = { r, g, b };
  
  // Set all pixels to the same color
  strip.color(`rgb(${r}, ${g}, ${b})`);
  strip.show();
  
  return currentColor;
}

// Set the brightness of the LED strip
function setBrightness(brightness) {
  if (!isReady) {
    console.warn('LED strip not ready');
    return currentBrightness;
  }
  
  // Ensure brightness is between 0-100
  currentBrightness = Math.max(0, Math.min(100, brightness));
  
  // node-pixel uses 0-1 for brightness
  strip.brightness(currentBrightness / 100);
  strip.show();
  
  return currentBrightness;
}

// Set a pattern for the LED strip
function setPattern(pattern) {
  if (!isReady) {
    console.warn('LED strip not ready');
    return currentPattern;
  }
  
  // Clear any existing pattern interval
  if (patternInterval) {
    clearInterval(patternInterval);
    patternInterval = null;
  }
  
  currentPattern = pattern;
  
  // If pattern is 'solid', just keep the current color
  if (pattern === 'solid') {
    setColor(currentColor.r, currentColor.g, currentColor.b);
    return currentPattern;
  }
  
  // Set up the new pattern
  switch (pattern) {
    case 'rainbow':
      let offset = 0;
      patternInterval = setInterval(() => {
        for (let i = 0; i < config.ledCount; i++) {
          const hue = ((i + offset) % 360) / 360;
          const { r, g, b } = hsvToRgb(hue, 1, 1);
          strip.pixel(i).color(`rgb(${r}, ${g}, ${b})`);
        }
        offset = (offset + 1) % 360;
        strip.show();
      }, 50);
      break;
      
    case 'pulse':
      let brightness = 0;
      let increasing = true;
      patternInterval = setInterval(() => {
        if (increasing) {
          brightness += 5;
          if (brightness >= 255) {
            brightness = 255;
            increasing = false;
          }
        } else {
          brightness -= 5;
          if (brightness <= 0) {
            brightness = 0;
            increasing = true;
          }
        }
        
        const factor = brightness / 255;
        const r = Math.floor(currentColor.r * factor);
        const g = Math.floor(currentColor.g * factor);
        const b = Math.floor(currentColor.b * factor);
        
        strip.color(`rgb(${r}, ${g}, ${b})`);
        strip.show();
      }, 30);
      break;
      
    case 'chase':
      let position = 0;
      patternInterval = setInterval(() => {
        strip.off(); // Turn off all LEDs
        
        // Turn on just the current position
        strip.pixel(position).color(`rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`);
        
        position = (position + 1) % config.ledCount;
        strip.show();
      }, 50);
      break;
      
    case 'alternating':
      let state = false;
      patternInterval = setInterval(() => {
        for (let i = 0; i < config.ledCount; i++) {
          if ((i % 2 === 0 && state) || (i % 2 !== 0 && !state)) {
            strip.pixel(i).color(`rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`);
          } else {
            strip.pixel(i).off();
          }
        }
        
        state = !state;
        strip.show();
      }, 500);
      break;
      
    default:
      setColor(currentColor.r, currentColor.g, currentColor.b);
      break;
  }
  
  return currentPattern;
}

// Convert HSV to RGB (for rainbow pattern)
function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

// Get the current status of the LED strip
function getStatus() {
  return {
    color: currentColor,
    brightness: currentBrightness,
    pattern: currentPattern,
    ledCount: config.ledCount,
    isReady: isReady
  };
}

// Get available patterns
function getPatterns() {
  return patterns;
}

// Clean up resources when shutting down
function cleanup() {
  if (patternInterval) {
    clearInterval(patternInterval);
    patternInterval = null;
  }
  
  if (strip && isReady) {
    // Turn off all LEDs
    strip.off();
    strip.show();
  }
  
  if (board) {
    board.io.reset();
  }
}

module.exports = {
  init,
  setColor,
  setBrightness,
  setPattern,
  getStatus,
  getPatterns,
  cleanup
};
