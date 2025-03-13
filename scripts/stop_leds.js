const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const WS2812Driver = require('./ws2812');

console.log('Stopping all LED processes and turning off LEDs...');

// Create a driver instance just to turn off the LEDs
const driver = new WS2812Driver({
  ledCount: 60,
  pin: 18,
  brightness: 100,
  simulation: false
});

// Create an array of all-off LEDs
const offLEDs = Array(60).fill({ r: 0, g: 0, b: 0 });

// Update with all LEDs off
driver.update(offLEDs);

// Wait a moment to ensure the update is sent
setTimeout(() => {
  console.log('Stopping driver...');
  
  // Stop the driver
  driver.stop();
  
  // Kill any existing ws2812_driver processes
  exec('pkill -f ws2812_driver', (error) => {
    if (error && error.code !== 1) {
      console.error('Error killing ws2812_driver processes:', error);
    } else {
      console.log('All ws2812_driver processes terminated');
    }
    
    // Force kill any remaining processes that might be using the GPIO
    exec('sudo killall -9 ws2812_driver 2>/dev/null || true', () => {
      // Try to stop pigpiod
      exec('sudo killall pigpiod', (error) => {
        if (error && error.code !== 1) {
          console.log('Note: pigpiod was not running or could not be stopped');
        } else {
          console.log('pigpiod stopped');
        }
        
        // Remove any lock files
        exec('sudo rm -f /var/run/pigpio.pid /dev/shm/pigpio /var/run/pigpio.sock 2>/dev/null || true', () => {
          console.log('LED cleanup complete');
          
          // Force exit after a short delay to ensure all processes have time to terminate
          setTimeout(() => {
            process.exit(0);
          }, 500);
        });
      });
    });
  });
}, 1000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Interrupted, exiting...');
  process.exit(0);
});
