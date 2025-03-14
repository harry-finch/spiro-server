const WS2812Driver = require("./ws2812");
const path = require("path");

// Test the WS2812 driver
console.log("Testing WS2812 LED driver...");

// Get LED count from command line or use default
const ledCount = parseInt(process.argv[2]) || 10;

// Create a driver instance
const driver = new WS2812Driver({
  ledCount: ledCount,
  pin: 18,
  brightness: 100,
  simulation: false,
});

console.log(`Using ${ledCount} LEDs`);

// Create some test patterns
const testPatterns = [
  // All white
  Array(ledCount).fill({ r: 255, g: 255, b: 255 }),

  // All red
  Array(ledCount).fill({ r: 255, g: 0, b: 0 }),

  // All green
  Array(ledCount).fill({ r: 0, g: 255, b: 0 }),

  // All blue
  Array(ledCount).fill({ r: 0, g: 0, b: 255 }),

  // All off
  Array(ledCount).fill({ r: 0, g: 0, b: 0 }),
];

// Function to convert HSV to RGB
function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// Run through each pattern
let patternIndex = 0;

console.log("Running test patterns...");
const interval = setInterval(() => {
  if (patternIndex >= testPatterns.length) {
    clearInterval(interval);
    driver.stop();
    console.log("Test complete");
    process.exit(0);
    return;
  }

  const pattern = testPatterns[patternIndex];
  const patternType = patternIndex < 5 ? "Basic" : patternIndex < 65 ? "Chase" : patternIndex < 75 ? "Brightness" : "Off";

  console.log(`Showing pattern ${patternIndex + 1}/${testPatterns.length} (${patternType})`);
  driver.update(pattern);
  patternIndex++;

  // Speed up for chase patterns
  if (patternIndex >= 5 && patternIndex < 65) {
    clearInterval(interval);
    interval = setInterval(arguments.callee, 100);
  } else if (patternIndex === 65) {
    // Slow down for brightness test
    clearInterval(interval);
    interval = setInterval(arguments.callee, 500);
  }
}, 2000);

// Handle Ctrl+C
process.on("SIGINT", () => {
  clearInterval(interval);
  driver.stop();
  console.log("Test interrupted");
  process.exit(0);
});
