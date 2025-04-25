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
  
  console.log('LED cleanup complete');
  
  // Force exit after a short delay to ensure all processes have time to terminate
  setTimeout(() => {
    process.exit(0);
  }, 500);
  
}, 1000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Interrupted, exiting...');
  process.exit(0);
});
