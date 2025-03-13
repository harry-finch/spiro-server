const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// WS2812 LED driver for Raspberry Pi
class WS2812Driver {
  constructor(config) {
    this.ledCount = config.ledCount || 60;
    this.pin = config.pin || 18;
    this.brightness = config.brightness || 100;
    this.process = null;
    this.isSimulation = config.simulation || false;
    
    // Path to our C executable
    this.executablePath = path.join(__dirname, 'ws2812_driver');
    
    // Ensure the C driver is compiled
    this.compileDriver();
  }
  
  // Compile the C driver if it doesn't exist
  compileDriver() {
    if (this.isSimulation) return;
    
    try {
      // Check if executable exists
      if (!fs.existsSync(this.executablePath)) {
        console.log('Compiling WS2812 driver...');
        
        // Create C source file
        const sourcePath = path.join(__dirname, 'ws2812_driver.c');
        fs.writeFileSync(sourcePath, this.getDriverSource());
        
        // Compile with gcc
        execSync(`gcc -Wall -o ${this.executablePath} ${sourcePath} -lrt -lm -lpigpio -pthread`, 
          { stdio: 'inherit' });
        
        // Make executable
        fs.chmodSync(this.executablePath, '755');
        console.log('WS2812 driver compiled successfully');
      }
    } catch (error) {
      console.error('Failed to compile WS2812 driver:', error);
      this.isSimulation = true;
    }
  }
  
  // Get the C source code for the driver
  getDriverSource() {
    return `
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <pigpio.h>
#include <signal.h>

// WS2812B timing (in microseconds)
#define T0H 0.35  // 0 bit high time
#define T1H 0.7   // 1 bit high time
#define T0L 0.8   // 0 bit low time
#define T1L 0.6   // 1 bit low time
#define RES 50    // Reset time in microseconds

volatile int running = 1;
uint32_t global_led_count = 60; // Default LED count

void handle_signal(int sig) {
    running = 0;
}

// Render LED data using DMA-based PWM
void ws2812_render(int pin, uint8_t *pixels, int count) {
    // Calculate the number of bytes needed for the waveform
    int numBits = count * 3 * 8;
    
    // Allocate memory for the waveform
    gpioPulse_t *pulses = (gpioPulse_t *)malloc(numBits * 2 * sizeof(gpioPulse_t));
    if (!pulses) {
        fprintf(stderr, "Memory allocation failed for pulses\\n");
        return;
    }
    
    int pulseCount = 0;
    
    // Set GPIO mode
    gpioSetMode(pin, PI_OUTPUT);
    
    // Create pulses for each bit
    for (int i = 0; i < count * 3; i++) {
        uint8_t byte = pixels[i];
        
        // Process each bit in the byte (MSB first)
        for (int bit = 7; bit >= 0; bit--) {
            if (byte & (1 << bit)) {
                // 1 bit: longer high pulse, shorter low pulse
                pulses[pulseCount].gpioOn = (1 << pin);
                pulses[pulseCount].gpioOff = 0;
                pulses[pulseCount].usDelay = T1H;
                pulseCount++;
                
                pulses[pulseCount].gpioOn = 0;
                pulses[pulseCount].gpioOff = (1 << pin);
                pulses[pulseCount].usDelay = T1L;
                pulseCount++;
            } else {
                // 0 bit: shorter high pulse, longer low pulse
                pulses[pulseCount].gpioOn = (1 << pin);
                pulses[pulseCount].gpioOff = 0;
                pulses[pulseCount].usDelay = T0H;
                pulseCount++;
                
                pulses[pulseCount].gpioOn = 0;
                pulses[pulseCount].gpioOff = (1 << pin);
                pulses[pulseCount].usDelay = T0L;
                pulseCount++;
            }
        }
    }
    
    // Clear any existing waveforms
    gpioWaveAddNew();
    
    // Add the pulses to the waveform
    gpioWaveAddGeneric(pulseCount, pulses);
    free(pulses);
    
    // Create and send the waveform
    int wave_id = gpioWaveCreate();
    if (wave_id >= 0) {
        gpioWaveTxSend(wave_id, PI_WAVE_MODE_ONE_SHOT);
        
        // Wait for transmission to complete
        while (gpioWaveTxBusy()) {
            usleep(100);
        }
        
        // Delete the wave
        gpioWaveDelete(wave_id);
    }
    
    // Reset period
    usleep(RES);
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <gpio-pin> <led-data-file>\\n", argv[0]);
        return 1;
    }
    
    int pin = atoi(argv[1]);
    char *dataFile = argv[2];
    
    // Initialize pigpio with a different port if needed
    if (gpioInitialise() < 0) {
        // Try with a different port
        gpioCfgSocketPort(8889);
        if (gpioInitialise() < 0) {
            // Try one more port
            gpioCfgSocketPort(8890);
            if (gpioInitialise() < 0) {
                fprintf(stderr, "Failed to initialize pigpio after trying multiple ports\\n");
                return 1;
            }
        }
    }
    
    // Set up signal handling
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
    
    printf("WS2812 driver started on GPIO pin %d\\n", pin);
    
    while (running) {
        // Read LED data from file
        FILE *fp = fopen(dataFile, "rb");
        if (!fp) {
            fprintf(stderr, "Failed to open data file: %s\\n", dataFile);
            sleep(1);
            continue;
        }
        
        // First 4 bytes contain the LED count
        uint32_t led_count;
        if (fread(&led_count, sizeof(uint32_t), 1, fp) != 1) {
            fprintf(stderr, "Failed to read LED count\\n");
            fclose(fp);
            sleep(1);
            continue;
        }
        
        // Allocate memory for LED data (3 bytes per LED: R, G, B)
        uint8_t *pixels = (uint8_t *)malloc(led_count * 3);
        if (!pixels) {
            fprintf(stderr, "Memory allocation failed\\n");
            fclose(fp);
            sleep(1);
            continue;
        }
        
        // Read LED data
        if (fread(pixels, 1, led_count * 3, fp) != led_count * 3) {
            fprintf(stderr, "Failed to read LED data\\n");
            free(pixels);
            fclose(fp);
            sleep(1);
            continue;
        }
        
        fclose(fp);
        
        // Render the LEDs
        ws2812_render(pin, pixels, led_count);
        
        // Clean up
        free(pixels);
        
        // Check for updates every 50ms
        usleep(50000);
    }
    
    // Turn off all LEDs before exiting using the global LED count
    uint8_t *off_pixels = (uint8_t *)calloc(global_led_count * 3, 1);
    if (off_pixels) {
        ws2812_render(pin, off_pixels, global_led_count);
        free(off_pixels);
    }
    
    // Clean up
    gpioTerminate();
    printf("WS2812 driver stopped\\n");
    
    return 0;
}
`;
  }
  
  // Update the LED strip with new colors
  update(ledData) {
    if (this.isSimulation) {
      console.log('Simulation: Would update LEDs with new data');
      return;
    }
    
    try {
      // Kill any existing process
      this.stop();
      
      // Create a binary file with LED data
      const dataFile = path.join(__dirname, 'led_data.bin');
      const buffer = Buffer.alloc(4 + (ledData.length * 3)); // 4 bytes for count + 3 bytes per LED
      
      // Write LED count (32-bit integer)
      buffer.writeUInt32LE(ledData.length, 0);
      
      // Apply brightness and write RGB values for each LED
      const brightnessScale = this.brightness / 100;
      
      // Write RGB values for each LED
      for (let i = 0; i < ledData.length; i++) {
        const led = ledData[i];
        const offset = 4 + (i * 3);
        
        // Apply brightness scaling
        const r = Math.floor(led.r * brightnessScale);
        const g = Math.floor(led.g * brightnessScale);
        const b = Math.floor(led.b * brightnessScale);
        
        buffer[offset] = g; // GRB order for WS2812
        buffer[offset + 1] = r;
        buffer[offset + 2] = b;
      }
      
      fs.writeFileSync(dataFile, buffer);
      
      // Start the C driver process
      this.process = spawn(this.executablePath, [this.pin.toString(), dataFile], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      this.process.stdout.on('data', (data) => {
        console.log(`WS2812 driver: ${data}`);
      });
      
      this.process.stderr.on('data', (data) => {
        console.error(`WS2812 driver error: ${data}`);
      });
      
      this.process.on('close', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`WS2812 driver exited with code ${code}`);
        }
        this.process = null;
      });
      
      console.log(`Hardware: Updated ${ledData.length} LEDs on GPIO pin ${this.pin}`);
    } catch (error) {
      console.error('Error updating WS2812 LEDs:', error);
    }
  }
  
  // Stop the LED driver
  stop() {
    if (this.process) {
      try {
        // First try to kill the process group
        try {
          process.kill(-this.process.pid, 'SIGTERM');
        } catch (e) {
          console.log('Process group kill failed, trying direct kill');
        }
        
        // Also try direct kill as fallback
        try {
          this.process.kill('SIGTERM');
        } catch (e) {
          console.log('Direct process kill failed');
        }
        
        // Force kill after a short delay if still running
        setTimeout(() => {
          try {
            if (this.process) {
              console.log('Forcing process termination');
              this.process.kill('SIGKILL');
            }
          } catch (e) {
            // Ignore errors, process might be gone already
          }
        }, 500);
        
        // Use pkill as a last resort
        const { execSync } = require('child_process');
        try {
          execSync('pkill -f ws2812_driver', { stdio: 'ignore' });
        } catch (e) {
          // Ignore errors from pkill, it returns non-zero if no processes match
        }
      } catch (error) {
        console.error('Error stopping WS2812 driver:', error);
      } finally {
        this.process = null;
      }
    } else {
      // Even if we don't have a process reference, try to kill any lingering processes
      try {
        const { execSync } = require('child_process');
        execSync('pkill -f ws2812_driver', { stdio: 'ignore' });
      } catch (e) {
        // Ignore errors from pkill
      }
    }
  }
}

module.exports = WS2812Driver;
