const fs = require('fs');
const { exec, spawn } = require('child_process');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// LED strip configuration
const config = {
  ledCount: parseInt(process.env.LED_COUNT) || 60,
  pin: parseInt(process.env.LED_PIN) || 18,
  brightness: parseInt(process.env.LED_BRIGHTNESS) || 100,  // 0-100 scale
  simulation: process.env.LED_SIMULATION === 'true' || process.platform !== 'linux' // Default to hardware mode on Linux
};

// LED strip state
let currentColor = { r: 0, g: 0, b: 0 };
let currentBrightness = config.brightness;
let currentPattern = 'solid';
let patternInterval = null;
let isReady = false;

// Virtual LED strip for simulation
let virtualLEDs = Array(config.ledCount).fill({ r: 0, g: 0, b: 0 });

// Available patterns
const patterns = {
  solid: { name: 'Solid Color', description: 'Display a single color' },
  rainbow: { name: 'Rainbow', description: 'Cycle through rainbow colors' },
  pulse: { name: 'Pulse', description: 'Pulse the current color' },
  chase: { name: 'Chase', description: 'Chase effect with current color' },
  alternating: { name: 'Alternating', description: 'Alternate between two colors' }
};

// Hardware-specific variables
let ws2812Process = null;

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
        
        // Check if the SPI interface is enabled
        exec('ls /dev/spidev*', (error, stdout) => {
          if (error || !stdout.trim()) {
            console.warn('SPI interface not detected. You may need to enable it using raspi-config');
            config.simulation = true;
          } else {
            console.log('SPI interface detected:', stdout.trim());
          }
        });
        
        console.log(`WS2812 LED strip initialized on GPIO pin ${config.pin}`);
      }
      
      // Set all LEDs to off initially
      for (let i = 0; i < config.ledCount; i++) {
        virtualLEDs[i] = { r: 0, g: 0, b: 0 };
      }
      
      // Turn off all LEDs
      setColor(0, 0, 0);
      
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

// Helper function to send data to the WS2812 LEDs using Python's rpi_ws281x library
function sendToHardware(ledData) {
  if (config.simulation) return;
  
  try {
    // Kill any existing process
    if (ws2812Process) {
      ws2812Process.kill();
      ws2812Process = null;
    }
    
    // Create a temporary file with LED data
    const tempFile = path.join(__dirname, '../temp_led_data.json');
    fs.writeFileSync(tempFile, JSON.stringify({
      leds: ledData,
      count: config.ledCount,
      pin: config.pin,
      brightness: currentBrightness
    }));
    
    // Run the Python script to control the LEDs
    const pythonScript = path.join(__dirname, '../scripts/ws2812_control.py');
    
    // Create the script if it doesn't exist
    if (!fs.existsSync(pythonScript)) {
      const scriptDir = path.dirname(pythonScript);
      if (!fs.existsSync(scriptDir)) {
        fs.mkdirSync(scriptDir, { recursive: true });
      }
      
      // Create a Python script that uses rpi_ws281x library
      const pythonCode = `#!/usr/bin/env python3
import json
import sys
import time
try:
    import board
    import neopixel
    HAS_LIBRARIES = True
except ImportError:
    HAS_LIBRARIES = False
    print("Warning: Required libraries not found. Install with: pip3 install adafruit-circuitpython-neopixel")

# Read LED data from the temporary file
with open(sys.argv[1], 'r') as f:
    data = json.load(f)

led_count = data['count']
pin = data['pin']
brightness = data['brightness'] / 100.0  # Convert to 0-1 scale
led_data = data['leds']

if not HAS_LIBRARIES:
    print("Simulation mode: Would set", led_count, "LEDs")
    sys.exit(0)

# Initialize the LED strip
pixels = neopixel.NeoPixel(
    board.D${config.pin},  # Use the specified pin
    led_count,
    brightness=brightness,
    auto_write=False
)

# Set the LED colors
for i, led in enumerate(led_data):
    if i < led_count:
        pixels[i] = (led['r'], led['g'], led['b'])

# Update the LEDs
pixels.show()

# Keep the script running to maintain the LED state
# The Node.js process will kill this when needed
time.sleep(600)  # 10 minutes timeout as a safety measure
`;
      
      fs.writeFileSync(pythonScript, pythonCode);
      fs.chmodSync(pythonScript, '755');  // Make executable
    }
    
    // Run the Python script
    ws2812Process = spawn('python3', [pythonScript, tempFile]);
    
    ws2812Process.stdout.on('data', (data) => {
      console.log(`WS2812 Python: ${data}`);
    });
    
    ws2812Process.stderr.on('data', (data) => {
      console.error(`WS2812 Python error: ${data}`);
    });
    
    ws2812Process.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`WS2812 Python process exited with code ${code}`);
      }
      ws2812Process = null;
    });
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
        for (let i = 0; i < config.ledCount; i++) {
          const hue = ((i + offset) % 360) / 360;
          const { r, g, b } = hsvToRgb(hue, 1, 1);
          
          // Apply brightness
          const brightnessScale = currentBrightness / 100;
          const scaledR = Math.floor(r * brightnessScale);
          const scaledG = Math.floor(g * brightnessScale);
          const scaledB = Math.floor(b * brightnessScale);
          
          virtualLEDs[i] = { r: scaledR, g: scaledG, b: scaledB };
        }
        
        if (!config.simulation) {
          sendToHardware(virtualLEDs);
          console.log('Hardware: Updating rainbow pattern');
        }
        
        offset = (offset + 1) % 360;
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
      let position = 0;
      patternInterval = setInterval(() => {
        // Turn off all LEDs
        for (let i = 0; i < config.ledCount; i++) {
          virtualLEDs[i] = { r: 0, g: 0, b: 0 };
        }
        
        // Turn on just the current position
        const brightnessScale = currentBrightness / 100;
        const r = Math.floor(currentColor.r * brightnessScale);
        const g = Math.floor(currentColor.g * brightnessScale);
        const b = Math.floor(currentColor.b * brightnessScale);
        
        virtualLEDs[position] = { r, g, b };
        
        if (!config.simulation) {
          sendToHardware(virtualLEDs);
          console.log(`Hardware: Chase at position ${position}`);
        }
        
        position = (position + 1) % config.ledCount;
      }, 50);
      break;
      
    case 'alternating':
      let state = false;
      patternInterval = setInterval(() => {
        const brightnessScale = currentBrightness / 100;
        const r = Math.floor(currentColor.r * brightnessScale);
        const g = Math.floor(currentColor.g * brightnessScale);
        const b = Math.floor(currentColor.b * brightnessScale);
        
        for (let i = 0; i < config.ledCount; i++) {
          if ((i % 2 === 0 && state) || (i % 2 !== 0 && !state)) {
            virtualLEDs[i] = { r, g, b };
          } else {
            virtualLEDs[i] = { r: 0, g: 0, b: 0 };
          }
        }
        
        if (!config.simulation) {
          sendToHardware(virtualLEDs);
          console.log(`Hardware: Alternating pattern state: ${state}`);
        }
        
        state = !state;
      }, 500);
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
  if (patternInterval) {
    clearInterval(patternInterval);
    patternInterval = null;
  }
  
  // Turn off all LEDs
  for (let i = 0; i < config.ledCount; i++) {
    virtualLEDs[i] = { r: 0, g: 0, b: 0 };
  }
  
  if (!config.simulation) {
    // Turn off all hardware LEDs
    sendToHardware(virtualLEDs);
    
    // Kill the Python process
    if (ws2812Process) {
      ws2812Process.kill();
      ws2812Process = null;
    }
    
    console.log('Hardware: Turning off all LEDs and resetting');
  }
  
  console.log('LED controller cleaned up');
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
