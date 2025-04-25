# Raspberry Pi LED & Camera Control

A Node.js Express server for controlling RGB LED strips and camera on a Raspberry Pi.

This project is a simplified fork of [Spiro by Alyona Minina](https://www.alyonaminina.org/spiro), which was originally designed for scientific imaging in plant biology research.

## Overview

This project provides a web interface to control:
- RGB LED strips (using the WS281x protocol)
- Raspberry Pi Camera Module

Features include:
- LED control (basic colors and brightness)
- Camera control (take pictures, stream video)
- Real-time updates via WebSockets
- Mobile-friendly responsive design

## Hardware Requirements

- Raspberry Pi 3B or newer
- WS281x compatible RGB LED strip
- Raspberry Pi Camera Module (v2 or HQ)
- Power supply for the Raspberry Pi and LED strip

## Operating System Requirements

To work correctly, you should install **Ubuntu for Raspberry Pi** rather than Raspberry Pi OS.

1. Download Ubuntu Server for Raspberry Pi from: https://ubuntu.com/download/raspberry-pi
2. Flash the image to an SD card using Balena Etcher or similar tool
3. Insert the SD card into your Raspberry Pi and complete the initial setup

## Wiring

### LED Strip
- Connect the LED strip's data input to GPIO pin 18 (configurable in .env)
- Connect the LED strip's power to an appropriate power supply
- Connect the LED strip's ground to both the power supply ground and the Raspberry Pi ground

### Camera Module
- Connect the camera module to the Raspberry Pi's camera port
- If using the v2 camera (Sony IMX219), add the module to kernel modules (see Camera Setup section)

## Software Installation

### Prerequisites

1. Update system packages:
```bash
sudo apt update
sudo apt upgrade -y
```

2. Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs
```

3. Install development tools:
```bash
sudo apt install -y git build-essential python3-pip
```

### Camera Setup

1. To recognize the Sony IMX219 camera module, add it to kernel modules:
```bash
echo "imx219" | sudo tee -a /etc/modules
```

2. Build and install libcamera (required for camera functionality):
```bash
# Install dependencies
sudo apt install -y libcamera-dev libepoxy-dev libjpeg-dev libtiff5-dev
sudo apt install -y python3-pip python3-picamera2 python3-matplotlib
sudo apt install -y cmake libboost-dev libgnutls28-dev openssl libtiff5-dev 
sudo apt install -y qtbase5-dev libqt5core5a libqt5gui5 libqt5widgets5
sudo apt install -y meson ninja-build
sudo pip3 install pyyaml ply

# Clone and build libcamera
cd ~
git clone https://git.linuxtv.org/libcamera.git
cd libcamera
meson build
cd build
ninja
sudo ninja install
```

3. Build and install rpicam-apps with necessary modifications:
```bash
# Clone rpicam-apps
cd ~
git clone https://github.com/raspberrypi/rpicam-apps.git
cd rpicam-apps

# Apply fix for audio codec issue
nano encoder/libav_encoder.cpp
# Find the entire initAudioOutCodec function (around line 323) and replace it with:
# void LibAvEncoder::initAudioOutCodec(const VideoOptions* options, const StreamInfo& info)
# {
#     // Audio encoding disabled
#     return;
# }

# Build rpicam-apps
meson build
cd build
meson compile
sudo meson install

# Ensure camera permissions
sudo usermod -a -G video $USER
```

For more details on building rpicam-apps on Ubuntu 22.04, see [this guide on AskUbuntu](https://askubuntu.com/questions/1542652/getting-rpicam-tools-rpicam-apps-working-on-ubuntu-22-04-lts-for-the-raspber).

3. Install Python library for LED control:
```bash
sudo pip3 install rpi_ws281x
```

### Project Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/SpiroServ.git
cd SpiroServ/NodeServer
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
sudo node server.js
```

The web interface will be available at `http://your-raspberry-pi-ip:3000`

## Auto-start at Boot

To configure the server to start automatically at boot:

1. Create a systemd service file:
```bash
sudo nano /etc/systemd/system/spiroserv.service
```

2. Add the following content:
```
[Unit]
Description=SpiroServ LED and Camera Control
After=network.target

[Service]
ExecStart=/usr/bin/node /path/to/SpiroServ/NodeServer/server.js
WorkingDirectory=/path/to/SpiroServ/NodeServer
StandardOutput=inherit
StandardError=inherit
Restart=always
User=root
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

3. Replace `/path/to/SpiroServ` with your actual installation path

4. Enable and start the service:
```bash
sudo systemctl enable spiroserv.service
sudo systemctl start spiroserv.service
```

5. Check the status:
```bash
sudo systemctl status spiroserv.service
```

## Hostname with mDNS (Avahi)

To access your Raspberry Pi using a hostname instead of IP address:

1. Install Avahi daemon:
```bash
sudo apt install avahi-daemon
```

2. Ensure it's enabled and running:
```bash
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

3. Set your hostname:
```bash
# Set a hostname (replace "spiroserv" with your preferred name)
sudo hostnamectl set-hostname spiroserv
```

4. Update the hosts file:
```bash
sudo nano /etc/hosts
```
Add or modify the line with `127.0.1.1` to match your new hostname:
```
127.0.1.1       spiroserv
```

5. Restart the Avahi daemon:
```bash
sudo systemctl restart avahi-daemon
```

Now you can access your server using `http://spiroserv.local:3000` from other devices on the same network.

## Configuration

Edit the `.env` file to configure the server:

```
# Server configuration
PORT=3000

# LED strip configuration
LED_COUNT=60
LED_PIN=18
LED_BRIGHTNESS=100

# Camera configuration
CAMERA_ENABLED=true
CAMERA_WIDTH=640
CAMERA_HEIGHT=480
```

## Usage

### Web Interface

The simplified web interface now provides:

- **LED Control**
  - Basic color buttons (White, Red, Green, Blue, Yellow, Cyan, Magenta)
  - Brightness slider
  - Turn off button

- **Camera Control**
  - Take picture button
  - Start/stop stream button
  - Rotation selection
  - Image gallery

### Key Changes in This Version

1. **Simplified LED Control**:
   - LEDs turn on to full bright white on server startup
   - Simple color buttons instead of a color picker
   - Removed pattern controls for more reliable operation

2. **Python-based LED Driver**:
   - Using the reliable rpi_ws281x Python library
   - More stable operation for LED control

3. **Ubuntu Compatibility**:
   - Optimized for Ubuntu on Raspberry Pi
   - Uses libcamera-based tools for camera control

### API Endpoints

The server provides the following REST API endpoints:

#### Status
- `GET /api/status` - Get the status of LED and camera

#### LED Control
- `POST /api/led/color` - Set LED color (body: `{r, g, b}`)
- `POST /api/led/brightness` - Set LED brightness (body: `{brightness}`)

#### Camera Control
- `GET /api/camera/picture` - Take a picture
- `GET /api/camera/settings` - Get camera settings
- `POST /api/camera/settings` - Update camera settings (body: `{width, height, quality, rotation}`)

## Troubleshooting

### LED Issues
- Ensure the LED strip is properly powered
- Check the GPIO pin configuration in the .env file
- Run the server with sudo (`sudo node server.js`) to avoid permission issues with GPIO
- Verify the rpi_ws281x Python library is installed
- Check if the Python script has executable permissions: `chmod +x scripts/led_control_rpi_ws281x.py`

### Camera Issues
- Ensure the camera is properly connected
- Verify the camera is recognized with `ls -l /dev/video*`
- Try testing the camera with: `libcamera-still -o test.jpg`
- Make sure "imx219" is added to /etc/modules and reboot
- Ensure rpicam-apps are correctly installed

### Connection Issues
- If using hostname.local and it doesn't work, try using the IP address directly
- Make sure Avahi daemon is running: `sudo systemctl status avahi-daemon`
- Check firewall settings to ensure port 3000 is open

## License

This project is licensed under the MIT License - see the LICENSE file for details.