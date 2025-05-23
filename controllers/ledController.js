const fs = require('fs');
const { exec } = require('child_process');
const dotenv = require('dotenv');
const path = require('path');
const WS2812Driver = require('../scripts/ws2812');

dotenv.config();

// LED strip configuration
const config = {
  ledCount: parseInt(process.env.LED_COUNT) || 60,
  pin: parseInt(process.env.LED_PIN) || 18,
  brightness: parseInt(process.env.LED_BRIGHTNESS) || 100,  // 0-100 scale
  simulation: process.env.LED_SIMULATION === 'true' || process.platform !== 'linux' // Default to hardware mode on Linux
};

// LED strip state
let currentColor = { r: 255, g: 255, b: 255 }; // Start with white
let currentBrightness = config.brightness;
let currentPattern = 'solid';
let patternInterval = null;
let isReady = false;

// Virtual LED strip for simulation
let virtualLEDs = Array(config.ledCount).fill({ r: 0, g: 0, b: 0 });

// Available patterns - only solid color now
const patterns = {
  solid: { name: 'Solid Color', description: 'Display a single color' }
};

// Hardware-specific variables
let ws2812Driver = null;

// Initialize the LED strip
function init() {
  return new Promise((resolve) => {
    try {
      console.log(`Initializing LED controller with ${config.ledCount} LEDs`);
      
      if (config.simulation) {
        console.log('Running in simulation mode');
      } else {
        console.log(`Hardware mode on GPIO pin ${config.pin}`);
        
        // Check if we're on a Raspberry Pi
        if (process.platform !== 'linux') {
          throw new Error('Hardware mode is only supported on Raspberry Pi (Linux)');
        }
        
        // Check if pigpio is installed
        exec('which pigpiod', (error, stdout) => {
          if (error || !stdout.trim()) {
            console.warn('pigpio not detected. Install with: sudo apt-get install pigpio');
            config.simulation = true;
          } else {
            console.log('pigpio detected:', stdout.trim());
            
            // We'll initialize the driver on first use to avoid startup delays
            console.log('WS2812 driver will be initialized on first use');
          }
        });
        
        console.log(`WS2812 LED strip initialized on GPIO pin ${config.pin}`);
      }
      
      // Set all LEDs to white initially
      for (let i = 0; i < config.ledCount; i++) {
        virtualLEDs[i] = { r: 255, g: 255, b: 255 };
      }
      
      // Turn on all LEDs to white
      setColor(255, 255, 255);
      
      isReady = true;
      console.log('LED controller initialized successfully');
      resolve();
    } catch (error) {
      console.error('Failed to initialize LED controller:', error);
      // Still resolve, but in simulation mode
      config.simulation = true;
      isReady = true;
      resolve();
    }
  });
}

// Helper function to convert RGB to the format needed by the LED library
function rgbToHex(r, g, b) {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

// Helper function to send data to the WS2812 LEDs using our custom driver
function sendToHardware(ledData) {
  if (config.simulation) return;
  
  try {
    if (!ws2812Driver) {
      // Initialize driver if not already done
      ws2812Driver = new WS2812Driver({
        ledCount: config.ledCount,
        pin: config.pin,
        brightness: currentBrightness,
        simulation: config.simulation
      });
    }
    
    ws2812Driver.update(ledData);
  } catch (error) {
    console.error('Error sending data to WS2812 LEDs:', error);
  }
}

// Set all LEDs to a single color
function setColor(r, g, b) {
  // Ensure values are within valid range
  r = Math.max(0, Math.min(255, Math.floor(r)));
  g = Math.max(0, Math.min(255, Math.floor(g)));
  b = Math.max(0, Math.min(255, Math.floor(b)));
  
  currentColor = { r, g, b };
  
  // Apply brightness
  const brightnessScale = currentBrightness / 100;
  const scaledR = Math.floor(r * brightnessScale);
  const scaledG = Math.floor(g * brightnessScale);
  const scaledB = Math.floor(b * brightnessScale);
  
  // Update all LEDs in the virtual strip
  for (let i = 0; i < config.ledCount; i++) {
    virtualLEDs[i] = { r: scaledR, g: scaledG, b: scaledB };
  }
  
  if (!config.simulation) {
    // Send the data to the LED strip using our Python helper
    sendToHardware(virtualLEDs);
    console.log(`Hardware: Setting all LEDs to RGB(${scaledR},${scaledG},${scaledB})`);
  }
  
  console.log(`Set color to RGB(${r},${g},${b}) with brightness ${currentBrightness}%`);
  return currentColor;
}

// Set the brightness of the LED strip
function setBrightness(brightness) {
  // Ensure brightness is between 0-100
  currentBrightness = Math.max(0, Math.min(100, brightness));
  
  // Update driver brightness if it exists
  if (ws2812Driver && !config.simulation) {
    ws2812Driver.brightness = currentBrightness;
  }
  
  // Re-apply current color with new brightness
  setColor(currentColor.r, currentColor.g, currentColor.b);
  
  console.log(`Set brightness to ${currentBrightness}%`);
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
    return currentPattern;
  }
  
  // Set up the new pattern
  switch (pattern) {
    case 'rainbow':
      let offset = 0;
      patternInterval = setInterval(() => {
        // For our Python-based implementation, we'll use a single color for the entire strip
        // and change it gradually for a rainbow effect
        const hue = (offset % 360) / 360;
        const { r, g, b } = hsvToRgb(hue, 1, 1);
        
        // Apply brightness
        const brightnessScale = currentBrightness / 100;
        const scaledR = Math.floor(r * brightnessScale);
        const scaledG = Math.floor(g * brightnessScale);
        const scaledB = Math.floor(b * brightnessScale);
        
        // Set all LEDs to this single color
        for (let i = 0; i < config.ledCount; i++) {
          virtualLEDs[i] = { r: scaledR, g: scaledG, b: scaledB };
        }
        
        if (!config.simulation) {
          sendToHardware(virtualLEDs);
          console.log('Hardware: Updating rainbow pattern');
        }
        
        offset = (offset + 10) % 360; // Faster color change
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
        const brightnessScale = currentBrightness / 100;
        const r = Math.floor(currentColor.r * factor * brightnessScale);
        const g = Math.floor(currentColor.g * factor * brightnessScale);
        const b = Math.floor(currentColor.b * factor * brightnessScale);
        
        for (let i = 0; i < config.ledCount; i++) {
          virtualLEDs[i] = { r, g, b };
        }
        
        if (!config.simulation) {
          sendToHardware(virtualLEDs);
          console.log(`Hardware: Pulsing at ${Math.round(factor * 100)}%`);
        }
      }, 30);
      break;
      
    case 'chase':
      // For our Python script implementation, we'll adapt the chase pattern
      // to blink all LEDs on and off
      let isOn = false;
      patternInterval = setInterval(() => {
        const brightnessScale = currentBrightness / 100;
        
        for (let i = 0; i < config.ledCount; i++) {
          if (isOn) {
            // Turn all LEDs on
            const r = Math.floor(currentColor.r * brightnessScale);
            const g = Math.floor(currentColor.g * brightnessScale);
            const b = Math.floor(currentColor.b * brightnessScale);
            virtualLEDs[i] = { r, g, b };
          } else {
            // Turn all LEDs off
            virtualLEDs[i] = { r: 0, g: 0, b: 0 };
          }
        }
        
        if (!config.simulation) {
          sendToHardware(virtualLEDs);
          console.log(`Hardware: Blinking ${isOn ? 'ON' : 'OFF'}`);
        }
        
        isOn = !isOn;
      }, 500); // Slower blink interval for better visibility
      break;
      
    case 'alternating':
      // For our Python script implementation, we'll adapt the alternating pattern
      // to alternate between normal brightness and half brightness
      let normalBrightness = true;
      patternInterval = setInterval(() => {
        const brightnessScale = currentBrightness / 100;
        // Use either full or half brightness
        const intensity = normalBrightness ? 1.0 : 0.5;
        
        const r = Math.floor(currentColor.r * brightnessScale * intensity);
        const g = Math.floor(currentColor.g * brightnessScale * intensity);
        const b = Math.floor(currentColor.b * brightnessScale * intensity);
        
        // Set all LEDs to the same color
        for (let i = 0; i < config.ledCount; i++) {
          virtualLEDs[i] = { r, g, b };
        }
        
        if (!config.simulation) {
          sendToHardware(virtualLEDs);
          console.log(`Hardware: Alternating pattern brightness: ${normalBrightness ? 'FULL' : 'HALF'}`);
        }
        
        normalBrightness = !normalBrightness;
      }, 1000); // Slower change for better visibility
      break;
      
    default:
      setColor(currentColor.r, currentColor.g, currentColor.b);
      break;
  }
  
  console.log(`Set pattern to ${pattern}`);
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
    isReady: isReady,
    simulation: config.simulation
  };
}

// Get available patterns
function getPatterns() {
  return patterns;
}

// Get the current state of all LEDs (for debugging or visualization)
function getLEDState() {
  return virtualLEDs;
}

// Clean up resources when shutting down
function cleanup() {
  return new Promise((resolve) => {
    console.log('LED controller cleanup started...');
    
    if (patternInterval) {
      clearInterval(patternInterval);
      patternInterval = null;
    }
    
    // Turn off all LEDs
    for (let i = 0; i < config.ledCount; i++) {
      virtualLEDs[i] = { r: 0, g: 0, b: 0 };
    }
    
    if (!config.simulation && ws2812Driver) {
      try {
        // Turn off all hardware LEDs
        sendToHardware(virtualLEDs);
        
        // Stop the LED driver with a timeout
        const stopTimeout = setTimeout(() => {
          console.log('LED driver stop timed out, forcing cleanup');
          ws2812Driver = null;
          resolve();
        }, 1000);
        
        // Try to stop the driver gracefully
        ws2812Driver.stop();
        
        // Clear the timeout once the driver is stopped
        clearTimeout(stopTimeout);
        ws2812Driver = null;
        console.log('Hardware: Turned off all LEDs and reset driver');
        resolve();
      } catch (error) {
        console.error('Error during LED cleanup:', error);
        ws2812Driver = null;
        resolve();
      }
    } else {
      console.log('LED controller cleaned up (simulation mode or no driver)');
      resolve();
    }
  });
}

module.exports = {
  init,
  setColor,
  setBrightness,
  setPattern,
  getStatus,
  getPatterns,
  getLEDState,
  cleanup
};
