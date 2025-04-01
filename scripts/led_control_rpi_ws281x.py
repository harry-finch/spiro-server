import argparse
import re
import sys
from rpi_ws281x import PixelStrip, Color

# LED strip configuration:
LED_COUNT = 60        # Adjust this to the total number of LEDs in your strip
LED_PIN = 18          # GPIO pin connected to the pixels (must support PWM, like GPIO18)
LED_FREQ_HZ = 800000  # LED signal frequency in hertz (usually 800kHz)
LED_DMA = 10          # DMA channel to use for generating signal
LED_BRIGHTNESS = 255  # Brightness (0-255)
LED_INVERT = False    # Invert signal (when using NPN transistor level shift)
LED_CHANNEL = 0

def parse_color(color_str):
    # Accept hex format: "#RRGGBB" or "RRGGBB"
    if re.match(r"^#?[0-9A-Fa-f]{6}$", color_str):
        color_str = color_str.lstrip('#')
        r = int(color_str[0:2], 16)
        g = int(color_str[2:4], 16)
        b = int(color_str[4:6], 16)
        return Color(r, g, b)
    else:
        raise ValueError("Invalid color format. Use hex format like '#FF0000'.")

def main():
    parser = argparse.ArgumentParser(description='Control WS2812B LEDs')
    parser.add_argument('color', type=str, help='Color in hex format (e.g., "#FF0000" for red)')
    parser.add_argument('count', type=int, help='Number of LEDs to light up')

    args = parser.parse_args()

    try:
        color = parse_color(args.color)
    except ValueError as e:
        print(e)
        sys.exit(1)

    if args.count < 1 or args.count > LED_COUNT:
        print(f"LED count must be between 1 and {LED_COUNT}")
        sys.exit(1)

    strip = PixelStrip(LED_COUNT, LED_PIN, LED_FREQ_HZ, LED_DMA, LED_INVERT, LED_BRIGHTNESS, LED_CHANNEL)
    strip.begin()

    for i in range(LED_COUNT):
        if i < args.count:
            strip.setPixelColor(i, color)
        else:
            strip.setPixelColor(i, Color(0, 0, 0))  # Turn off the rest
    strip.show()

if __name__ == '__main__':
    main()
