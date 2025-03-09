const ws281x = require('rpi-ws281x-native');
const dotenv = require('dotenv');

dotenv.config();

// LED strip configuration
const config = {
  ledCount: parseInt(process.env.LED_COUNT) || 60,
  gpioPin: parseInt(process.env.LED_PIN) || 18,
  brightness: parseInt(process.env.LED_BRIGHTNESS) || 255
};

// LED strip state
let currentColor = { r: 0, g: 0, b: 0 };
let currentBrightness = config.brightness;
let currentPattern = 'solid';
let patternInterval = null;
let pixels = new Uint32Array(config.ledCount);

// Available patterns
const patterns = {
  solid: { name: 'Solid Color', description: 'Display a single color' },
  rainbow: { name: 'Rainbow', description: 'Cycle through rainbow colors' },
  pulse: { name: 'Pulse', description: 'Pulse the current color' },
  chase: { name: 'Chase', description: 'Chase effect with current color' },
  alternating: { name: 'Alternating', description: 'Alternate between two colors' }
};

// Helper function to convert RGB to the format needed by the LED library
function rgbToHex(r, g, b) {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

// Initialize the LED strip
function init() {
  try {
    ws281x.init(config.ledCount, { gpioPin: config.gpioPin });
    ws281x.setBrightness(currentBrightness);
    console.log(`LED strip initialized with ${config.ledCount} LEDs on GPIO pin ${config.gpioPin}`);
    setColor(0, 0, 0); // Turn off all LEDs initially
  } catch (error) {
    console.error('Failed to initialize LED strip:', error);
  }
}

// Set all LEDs to a single color
function setColor(r, g, b) {
  currentColor = { r, g, b };
  const colorValue = rgbToHex(r, g, b);
  
  for (let i = 0; i < config.ledCount; i++) {
    pixels[i] = colorValue;
  }
  
  ws281x.render(pixels);
  return currentColor;
}

// Set the brightness of the LED strip
function setBrightness(brightness) {
  currentBrightness = Math.max(0, Math.min(255, brightness));
  ws281x.setBrightness(currentBrightness);
  return currentBrightness;
}

// Set a pattern for the LED strip
function setPattern(pattern) {
  // Clear any existing pattern interval
  if (patternInterval) {
    clearInterval(patternInterval);
    patternInterval = null;
  }
  
  currentPattern = pattern;
  
  // If pattern is 'solid', just keep the current color
  if (pattern === 'solid') {
    setColor(currentColor.r, currentColor.g, currentColor.b);
    return;
  }
  
  // Set up the new pattern
  switch (pattern) {
    case 'rainbow':
      let offset = 0;
      patternInterval = setInterval(() => {
        for (let i = 0; i < config.ledCount; i++) {
          const hue = ((i + offset) % 360) / 360;
          const { r, g, b } = hsvToRgb(hue, 1, 1);
          pixels[i] = rgbToHex(r, g, b);
        }
        offset = (offset + 1) % 360;
        ws281x.render(pixels);
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
        
        for (let i = 0; i < config.ledCount; i++) {
          pixels[i] = rgbToHex(r, g, b);
        }
        
        ws281x.render(pixels);
      }, 30);
      break;
      
    case 'chase':
      let position = 0;
      patternInterval = setInterval(() => {
        for (let i = 0; i < config.ledCount; i++) {
          if (i === position) {
            pixels[i] = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
          } else {
            pixels[i] = rgbToHex(0, 0, 0);
          }
        }
        
        position = (position + 1) % config.ledCount;
        ws281x.render(pixels);
      }, 50);
      break;
      
    case 'alternating':
      let state = false;
      patternInterval = setInterval(() => {
        const color1 = state ? rgbToHex(currentColor.r, currentColor.g, currentColor.b) : rgbToHex(0, 0, 0);
        const color2 = state ? rgbToHex(0, 0, 0) : rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        
        for (let i = 0; i < config.ledCount; i++) {
          pixels[i] = i % 2 === 0 ? color1 : color2;
        }
        
        state = !state;
        ws281x.render(pixels);
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
    ledCount: config.ledCount
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
  }
  
  // Turn off all LEDs
  for (let i = 0; i < config.ledCount; i++) {
    pixels[i] = 0;
  }
  ws281x.render(pixels);
  
  // Reset the LED strip
  ws281x.reset();
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
