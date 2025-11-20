#!/bin/bash

# ESP32-S3 Build and Upload Script
# Kills any processes using the serial port, builds firmware, and uploads to ESP32-S3

set -e  # Exit on error

PROJECT_DIR="/Users/miguelmoorcastro/Desktop/EPFL/410/Projects/TEST3/Project"
SERIAL_PORT="/dev/cu.usbserial-10"

echo "======================================"
echo "ESP32-S3 Flash Tool"
echo "======================================"
echo ""

# Kill processes using serial port
echo "1. Checking for processes using serial port..."
if lsof "$SERIAL_PORT" 2>/dev/null | grep -v COMMAND > /dev/null; then
    echo "   Found processes using $SERIAL_PORT - killing them..."
    lsof "$SERIAL_PORT" 2>/dev/null | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "   ✓ Processes killed"
else
    echo "   ✓ Serial port is free"
fi

echo ""
echo "2. Building and uploading firmware..."
cd "$PROJECT_DIR"
~/.platformio/penv/bin/pio run --target upload

echo ""
echo "======================================"
echo "✓ Firmware uploaded successfully!"
echo "======================================"
