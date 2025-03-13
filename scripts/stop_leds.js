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
  
  // More aggressive cleanup with multiple approaches
  const cleanupSteps = [
    // Kill any existing ws2812_driver processes
    'pkill -f ws2812_driver',
    // Force kill with -9 if needed
    'pkill -9 -f ws2812_driver 2>/dev/null || true',
    // Use sudo killall as another approach
    'sudo killall ws2812_driver 2>/dev/null || true',
    'sudo killall -9 ws2812_driver 2>/dev/null || true',
    // Try to stop pigpiod
    'sudo killall pigpiod 2>/dev/null || true',
    // Remove any lock files
    'sudo rm -f /var/run/pigpio.pid /dev/shm/pigpio* /var/run/pigpio.sock 2>/dev/null || true'
  ];
  
  // Execute cleanup steps in sequence
  function runNextCleanupStep(index) {
    if (index >= cleanupSteps.length) {
      console.log('LED cleanup complete');
      
      // Force exit after a short delay to ensure all processes have time to terminate
      setTimeout(() => {
        process.exit(0);
      }, 500);
      return;
    }
    
    const cmd = cleanupSteps[index];
    console.log(`Running cleanup step: ${cmd}`);
    
    exec(cmd, (error) => {
      // Ignore errors and continue with next step
      runNextCleanupStep(index + 1);
    });
  }
  
  // Start the cleanup sequence
  runNextCleanupStep(0);
}, 1000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Interrupted, exiting...');
  process.exit(0);
});
