const WS2812Driver = require('./ws2812');

console.log('Stopping all LED processes and turning off LEDs...');

// Create a driver instance just to turn off the LEDs
const driver = new WS2812Driver({
  ledCount: 60,
  pin: 18,
  brightness: 100,
  simulation: false
});

// Turn off all LEDs
driver.stop();

// Give some time for the command to complete
setTimeout(() => {
  console.log('LED cleanup complete');
  process.exit(0);
}, 1000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Interrupted, exiting...');
  process.exit(0);
});