const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// WS2812 LED driver for Raspberry Pi using the Python rpi_ws281x script
class WS2812Driver {
  constructor(config) {
    this.ledCount = config.ledCount || 60;
    this.pin = config.pin || 18;
    this._brightness = config.brightness || 100; // Store brightness as percentage (0-100)
    this.isSimulation = config.simulation || false;
    
    // Full path to the Python script
    this.pythonScript = path.join(__dirname, 'led_control_rpi_ws281x.py');
    console.log(`Python script path: ${this.pythonScript}`);
    
    // Check if the script exists and log the result
    if (fs.existsSync(this.pythonScript)) {
      console.log('Python script found at the specified path');
    } else {
      console.warn('WARNING: Python script NOT found at the specified path');
    }
    
    this.pythonProcess = null;
    
    // Initialize the LED strip (turn all LEDs off initially)
    this.initialize();
  }
  
  // Initialize the LED strip
  initialize() {
    if (this.isSimulation) {
      console.log('Running in simulation mode - no hardware operations will be performed');
      return;
    }
    
    try {
      // Check if Python script exists
      if (!fs.existsSync(this.pythonScript)) {
        console.error(`Python script not found: ${this.pythonScript}`);
        this.isSimulation = true;
        return;
      }
      
      // Turn on all LEDs to full bright white initially
      this.setAllLEDs(255, 255, 255);
      console.log(`WS2812 LED strip initialized with ${this.ledCount} LEDs on GPIO pin ${this.pin} - set to full bright white`);
    } catch (error) {
      console.error('Failed to initialize LED strip:', error);
      this.isSimulation = true;
    }
  }
  
  // Get brightness (0-100)
  get brightness() {
    return this._brightness;
  }
  
  // Set brightness (0-100)
  set brightness(value) {
    // Store brightness as percentage
    this._brightness = Math.max(0, Math.min(100, value));
    console.log(`WS2812 brightness set to ${this._brightness}%`);
    
    // We'll apply brightness when we update the LEDs
  }
  
  // Set all LEDs to a specific RGB color
  setAllLEDs(r, g, b) {
    if (this.isSimulation) {
      console.log(`Simulation: Would set all LEDs to RGB(${r},${g},${b})`);
      return;
    }
    
    try {
      // Convert RGB to hex string
      const hexColor = this.rgbToHex(r, g, b);
      
      // Construct the command
      const command = `python3 ${this.pythonScript} "${hexColor}" ${this.ledCount}`;
      console.log(`Executing: ${command}`);
      
      // Run the Python script with the color in quotes
      const result = execSync(command, { 
        encoding: 'utf8',
        timeout: 5000
      });
      
      console.log(`Set all LEDs to ${hexColor}`);
      if (result) {
        console.log(`Python script output: ${result}`);
      }
    } catch (error) {
      console.error('Error setting LED colors:', error.message || error);
    }
  }
  
  // Helper function to convert RGB to hex string
  rgbToHex(r, g, b) {
    // Apply brightness scaling
    const brightnessScale = this._brightness / 100;
    r = Math.min(255, Math.max(0, Math.floor(r * brightnessScale)));
    g = Math.min(255, Math.max(0, Math.floor(g * brightnessScale)));
    b = Math.min(255, Math.max(0, Math.floor(b * brightnessScale)));
    
    // Convert to hex string with proper padding
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');
    
    console.log(`RGB(${r},${g},${b}) -> HEX: #${rHex}${gHex}${bHex}`);
    
    // Return hex color with # prefix
    return '#' + rHex + gHex + bHex;
  }
  
  // Update the LED strip with new colors (array of {r, g, b} objects)
  update(ledData) {
    if (this.isSimulation) {
      console.log('Simulation: Would update LEDs with new data');
      return;
    }
    
    try {
      // For now, we'll just use the first LED's color for all LEDs
      // This simplifies the integration with the Python script
      if (ledData && ledData.length > 0) {
        // Use the first LED's color for the entire strip
        const led = ledData[0];
        this.setAllLEDs(led.r, led.g, led.b);
      }
    } catch (error) {
      console.error('Error updating WS2812 LEDs:', error);
    }
  }
  
  // Stop the LED driver and turn off all LEDs
  stop() {
    if (this.isSimulation) return;
    
    try {
      // Turn off all LEDs
      this.setAllLEDs(0, 0, 0);
      console.log('WS2812 driver stopped and LEDs turned off');
    } catch (error) {
      console.error('Error stopping WS2812 driver:', error);
    }
  }
}

module.exports = WS2812Driver;