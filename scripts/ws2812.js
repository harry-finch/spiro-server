const ws281x = require('rpi-ws281x-native');

// WS2812 LED driver for Raspberry Pi using rpi-ws281x-native library
class WS2812Driver {
  constructor(config) {
    this.ledCount = config.ledCount || 60;
    this.pin = config.pin || 18;
    this._brightness = config.brightness || 100; // Store as percentage (0-100)
    this.isSimulation = config.simulation || false;
    this.channel = null;
    
    // Initialize the LED strip
    this.initialize();
  }
  
  // Initialize the rpi-ws281x library
  initialize() {
    if (this.isSimulation) {
      console.log('Running in simulation mode - no hardware operations will be performed');
      return;
    }
    
    try {
      // Initialize the library with our LED count
      this.channel = ws281x.init(this.ledCount, {
        // Options to match the pin used previously (GPIO 18 = PWM0 = 18)
        gpio: this.pin,
        // Set DMA to default (10)
        dma: 10,
        // Set brightness from 0-255
        brightness: Math.round((this._brightness / 100) * 255),
        // Set strip type (default is ws2812)
        stripType: 'ws2812'
      });
      
      // Initialize all LEDs to black (off)
      this.pixelData = new Uint32Array(this.ledCount);
      for(let i = 0; i < this.ledCount; i++) {
        this.pixelData[i] = 0;
      }
      ws281x.render(this.pixelData);
      
      console.log(`WS2812 LED strip initialized with ${this.ledCount} LEDs on GPIO pin ${this.pin}`);
    } catch (error) {
      console.error('Failed to initialize rpi-ws281x library:', error);
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
    
    if (!this.isSimulation && this.channel !== null) {
      // Apply to rpi-ws281x (which uses 0-255)
      const brightnessValue = Math.round((this._brightness / 100) * 255);
      ws281x.setBrightness(brightnessValue);
      console.log(`WS2812 brightness set to ${this._brightness}% (${brightnessValue}/255)`);
    }
  }
  
  // Helper function to convert RGB components to color value
  // rpi-ws281x expects colors in the format 0x00RRGGBB
  rgbToColor(r, g, b) {
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  }
  
  // Update the LED strip with new colors
  update(ledData) {
    if (this.isSimulation) {
      console.log('Simulation: Would update LEDs with new data');
      return;
    }
    
    try {
      if (!this.channel || !this.pixelData) {
        // Reinitialize if needed
        this.initialize();
        if (this.isSimulation) return;
      }
      
      // Apply the colors to the pixel data array
      for (let i = 0; i < ledData.length && i < this.ledCount; i++) {
        const led = ledData[i];
        // rpi-ws281x uses a different color format
        this.pixelData[i] = this.rgbToColor(led.r, led.g, led.b);
      }
      
      // Render the updates to the LED strip
      ws281x.render(this.pixelData);
      console.log(`Updated ${ledData.length} LEDs on GPIO pin ${this.pin}`);
    } catch (error) {
      console.error('Error updating WS2812 LEDs:', error);
    }
  }
  
  // Stop the LED driver and clean up
  stop() {
    if (!this.isSimulation && this.channel !== null) {
      try {
        // Turn off all LEDs
        for (let i = 0; i < this.ledCount; i++) {
          this.pixelData[i] = 0;
        }
        ws281x.render(this.pixelData);
        
        // Reset the library
        ws281x.reset();
        console.log('WS2812 driver stopped and LEDs turned off');
      } catch (error) {
        console.error('Error stopping WS2812 driver:', error);
      } finally {
        this.channel = null;
      }
    }
  }
}

module.exports = WS2812Driver;