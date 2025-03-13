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
  // Stop the driver
  driver.stop();
  
  // Kill any existing ws2812_driver processes
  exec('pkill -f ws2812_driver', (error) => {
    if (error && error.code !== 1) {
      console.error('Error killing ws2812_driver processes:', error);
    } else {
      console.log('All ws2812_driver processes terminated');
    }
    
    // Try to stop pigpiod
    exec('sudo killall pigpiod', (error) => {
      if (error && error.code !== 1) {
        console.log('Note: pigpiod was not running or could not be stopped');
      } else {
        console.log('pigpiod stopped');
      }
      
      console.log('LED cleanup complete');
      process.exit(0);
    });
  });
}, 1000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Interrupted, exiting...');
  process.exit(0);
});
