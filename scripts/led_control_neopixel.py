import argparse
import board
import neopixel
import re
import sys

# Configuration
LED_COUNT = 60         # Total number of LEDs on your strip
LED_PIN = board.D18    # GPIO18 is PWM-capable and commonly used

# Parse color from hex string
def parse_color(color_str):
    if re.match(r"^#?[0-9A-Fa-f]{6}$", color_str):
        color_str = color_str.lstrip('#')
        r = int(color_str[0:2], 16)
        g = int(color_str[2:4], 16)
        b = int(color_str[4:6], 16)
        return (r, g, b)
    else:
        raise ValueError("Invalid color format. Use hex format like '#FF0000'.")

def main():
    parser = argparse.ArgumentParser(description="Control WS2812B LEDs using Adafruit NeoPixel")
    parser.add_argument('color', type=str, help='Color in hex format (e.g., "#00FF00" for green)')
    parser.add_argument('count', type=int, help='Number of LEDs to light up (1 to LED_COUNT)')

    args = parser.parse_args()

    try:
        color = parse_color(args.color)
    except ValueError as e:
        print(e)
        sys.exit(1)

    if args.count < 1 or args.count > LED_COUNT:
        print(f"LED count must be between 1 and {LED_COUNT}")
        sys.exit(1)

    # Initialize the NeoPixel strip
    pixels = neopixel.NeoPixel(LED_PIN, LED_COUNT, brightness=1.0, auto_write=False)

    # Set colors
    for i in range(LED_COUNT):
        if i < args.count:
            pixels[i] = color
        else:
            pixels[i] = (0, 0, 0)

    pixels.show()

if __name__ == "__main__":
    main()
