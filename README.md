# Raspberry Pi LED & ArduCAM Control

A Node.js Express server for controlling RGB LED strips and ArduCAM on a Raspberry Pi 3B.

## Overview

This project provides a web interface to control:
- RGB LED strips (using the WS281x protocol)
- ArduCAM camera module

Features include:
- LED control (color, brightness, patterns)
- Camera control (take pictures, stream video)
- Real-time updates via WebSockets
- Mobile-friendly responsive design

## Hardware Requirements

- Raspberry Pi 3B or newer
- WS281x compatible RGB LED strip
- ArduCAM camera module
- Power supply for the Raspberry Pi and LED strip

## Wiring

### LED Strip
- Connect the LED strip's data input to GPIO pin 18 (configurable in .env)
- Connect the LED strip's power to an appropriate power supply
- Connect the LED strip's ground to both the power supply ground and the Raspberry Pi ground

### ArduCAM
- Connect the ArduCAM to the Raspberry Pi's camera port

## Software Installation

### Prerequisites

Make sure your Raspberry Pi is running the latest Raspberry Pi OS and has Node.js installed:

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Install development tools
sudo apt install -y git build-essential
```

### Project Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pi-led-camera-server.git
cd pi-led-camera-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure the environment variables:
```bash
# Copy the example .env file
cp .env.example .env

# Edit the .env file with your settings
nano .env
```

4. Start the server:
```bash
npm start
```

The web interface will be available at `http://your-raspberry-pi-ip:3000`

## Configuration

Edit the `.env` file to configure the server:

```
# Server configuration
PORT=3000

# LED strip configuration
LED_COUNT=60
LED_PIN=18
LED_BRIGHTNESS=255

# ArduCAM configuration
CAMERA_ENABLED=true
CAMERA_WIDTH=640
CAMERA_HEIGHT=480
```

## Usage

### Web Interface

The web interface provides controls for:

- **LED Control**
  - Color picker
  - Brightness slider
  - Pattern selection (solid, rainbow, pulse, chase, alternating)
  - Turn off button

- **Camera Control**
  - Take picture button
  - Start/stop stream button
  - Rotation selection
  - Image gallery

### API Endpoints

The server provides the following REST API endpoints:

#### Status
- `GET /api/status` - Get the status of LED and camera

#### LED Control
- `POST /api/led/color` - Set LED color (body: `{r, g, b}`)
- `POST /api/led/brightness` - Set LED brightness (body: `{brightness}`)
- `POST /api/led/pattern` - Set LED pattern (body: `{pattern}`)
- `GET /api/led/patterns` - Get available patterns

#### Camera Control
- `GET /api/camera/picture` - Take a picture
- `GET /api/camera/settings` - Get camera settings
- `POST /api/camera/settings` - Update camera settings (body: `{width, height, quality, rotation}`)

### WebSocket Events

The server uses Socket.IO for real-time communication:

#### LED Events
- `led:setColor` - Set LED color
- `led:setBrightness` - Set LED brightness
- `led:setPattern` - Set LED pattern
- `led:colorChanged` - LED color changed
- `led:brightnessChanged` - LED brightness changed
- `led:patternChanged` - LED pattern changed

#### Camera Events
- `camera:takePicture` - Take a picture
- `camera:startStream` - Start camera stream
- `camera:stopStream` - Stop camera stream
- `camera:pictureTaken` - Picture taken
- `camera:frame` - New video frame
- `camera:streamStarted` - Stream started
- `camera:streamStopped` - Stream stopped
- `camera:error` - Camera error

## Development

To run the server in development mode with automatic restart:

```bash
npm run dev
```

## Troubleshooting

### LED Issues
- Ensure the LED strip is properly powered
- Check the GPIO pin configuration in the .env file
- Run the server with sudo if you encounter permission issues with GPIO

### Camera Issues
- Ensure the camera is properly connected
- Enable the camera interface using `sudo raspi-config`
- Check if the camera is detected with `vcgencmd get_camera`

## License

This project is licensed under the MIT License - see the LICENSE file for details.
