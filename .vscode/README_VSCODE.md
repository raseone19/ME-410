# Visual Studio Code Quick Guide

This guide explains how to use this project in **Visual Studio Code with PlatformIO**.

## Prerequisites

1. **Visual Studio Code** installed ([download here](https://code.visualstudio.com/))
2. **PlatformIO IDE extension** installed in VS Code

## Opening the Project

1. Open VS Code
2. **File → Open Folder**
3. Select the `MovingTof_OneMotor_OK` folder
4. PlatformIO will automatically detect the project and install dependencies

## PlatformIO Toolbar (Bottom Bar)

After opening the project, you'll see a blue toolbar at the bottom with these icons:

| Icon | Name | Shortcut | Description |
|------|------|----------|-------------|
| 🏠 | Home | | Open PlatformIO Home |
| ✓ | Build | `Ctrl+Alt+B` (Win/Linux)<br>`Cmd+Shift+B` (Mac) | Compile the project |
| → | Upload | `Ctrl+Alt+U` (Win/Linux)<br>`Cmd+Shift+U` (Mac) | Upload to ESP32 |
| 🗑️ | Clean | | Remove build files |
| 🔬 | Test | | Run unit tests |
| 🔌 | Serial Monitor | `Ctrl+Alt+S` (Win/Linux)<br>`Cmd+Shift+S` (Mac) | Open serial monitor |
| 📊 | Tasks | | Run custom tasks |

## Typical Workflow

### 1. First Time Setup

```bash
# PlatformIO automatically installs:
# - ESP32 platform support
# - ESP32Servo library (version 3.0.5)
# - All build tools
```

Just open the project and wait for the setup to complete (check bottom-right corner for progress).

### 2. Building the Project

- Click the **✓ (Build)** icon in the bottom toolbar
- Or use menu: **Terminal → Run Task → PlatformIO: Build**
- Or press `Ctrl+Alt+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)

**Output:** Compiled firmware in `.pio/build/esp32dev/firmware.bin`

### 3. Uploading to ESP32

**Before uploading:**
1. Connect ESP32 to computer via USB
2. Ensure correct COM/serial port is detected

**Upload:**
- Click the **→ (Upload)** icon
- Or press `Ctrl+Alt+U` (Windows/Linux) or `Cmd+Shift+U` (Mac)

**Troubleshooting upload:**
- If upload fails, press and hold the **BOOT** button on ESP32, then click Upload
- Release BOOT button after upload starts

### 4. Monitoring Serial Output

- Click the **🔌 (Serial Monitor)** icon
- Or press `Ctrl+Alt+S` (Windows/Linux) or `Cmd+Shift+S` (Mac)
- Baud rate is automatically set to 115200 (configured in `platformio.ini`)

**Expected output:**
```
========================================
4-Motor Independent PI Control System
With Dynamic TOF Setpoint
========================================

Initializing hardware...
  - TOF sensor... OK
  - Pressure pads... OK
  - Motors... OK
  - PI controllers... OK

Starting Core 0 tasks...
...
```

## Project Structure in VS Code

```
MovingTof_OneMotor_OK/
├── .vscode/                    # VS Code settings
│   ├── c_cpp_properties.json   # IntelliSense configuration
│   ├── extensions.json         # Recommended extensions
│   ├── launch.json             # Debug configuration
│   └── settings.json           # Project settings
├── .pio/                       # PlatformIO build directory (auto-generated)
├── docs/                       # Documentation
├── src/                        # Source code
│   ├── main.cpp                # Main program
│   ├── config/                 # Configuration headers
│   ├── sensors/                # Sensor modules
│   ├── actuators/              # Motor control
│   ├── control/                # PI controllers
│   ├── utils/                  # Utilities
│   └── tasks/                  # FreeRTOS tasks
├── platformio.ini              # PlatformIO configuration
└── README.md                   # Main project README
```

## IntelliSense & Code Navigation

PlatformIO automatically configures IntelliSense for ESP32 development.

**Features:**
- **Go to Definition**: `F12` or `Ctrl+Click`
- **Find All References**: `Shift+F12`
- **Rename Symbol**: `F2`
- **Auto-completion**: `Ctrl+Space`
- **Parameter hints**: `Ctrl+Shift+Space`

## Debugging (Optional)

For debugging with a hardware debugger (JTAG):

1. Configure your debugger in `launch.json`
2. Press `F5` to start debugging
3. Set breakpoints by clicking left of line numbers

**Note:** Basic ESP32 Dev Modules don't include a built-in debugger. You need an external JTAG adapter (e.g., ESP-Prog, J-Link).

## Useful Commands

Access via **Terminal → Run Task** or **Ctrl+Shift+P** (Command Palette):

| Command | Description |
|---------|-------------|
| `PlatformIO: Build` | Compile the project |
| `PlatformIO: Upload` | Upload to device |
| `PlatformIO: Clean` | Remove build files |
| `PlatformIO: Upload and Monitor` | Upload then open serial monitor |
| `PlatformIO: Device Monitor` | Open serial monitor only |
| `PlatformIO: Home` | Open PlatformIO home page |

## Configuration Files

### `platformio.ini`

Main configuration file:

```ini
[env:esp32dev]
platform = espressif32       # ESP32 platform
board = esp32dev             # Target board
framework = arduino          # Use Arduino framework
monitor_speed = 115200       # Serial baud rate
upload_speed = 921600        # Upload baud rate
lib_deps =
    madhephaestus/ESP32Servo@^3.0.5  # Required library
```

**To add more libraries:**
```ini
lib_deps =
    madhephaestus/ESP32Servo@^3.0.5
    adafruit/Adafruit Sensor@^1.1.0  # Example: add another library
```

## Troubleshooting

### Problem: IntelliSense not working

**Solution:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: `PlatformIO: Rebuild IntelliSense Index`
3. Restart VS Code

### Problem: Upload fails (port not found)

**Solution:**
1. Check USB cable connection
2. Install ESP32 USB drivers (CP210x or CH340)
3. Verify port in PlatformIO toolbar: click **🔌** → select correct port
4. Check `Device Manager` (Windows) or `ls /dev/tty*` (Mac/Linux)

### Problem: Build errors

**Solution:**
1. Clean the project: click **🗑️ (Clean)**
2. Rebuild: click **✓ (Build)**
3. Check `platformio.ini` for correct board and platform
4. Delete `.pio` folder and rebuild

### Problem: Library not found

**Solution:**
1. Open `platformio.ini`
2. Verify library is listed in `lib_deps`
3. Save file (auto-triggers library installation)
4. Or run: `pio lib install` in terminal

## Additional Resources

- [PlatformIO Documentation](https://docs.platformio.org/)
- [ESP32 Arduino Core](https://docs.espressif.com/projects/arduino-esp32/en/latest/)
- [ESP32Servo Library](https://github.com/madhephaestus/ESP32Servo)
- [Project Documentation](../docs/)

## Tips for Efficient Development

1. **Use split editor** to view multiple files simultaneously
2. **Open integrated terminal** (`Ctrl+` `) for quick commands
3. **Use breadcrumbs** (top of editor) for quick navigation
4. **Enable auto-save** (File → Auto Save) to avoid losing changes
5. **Use Find in Files** (`Ctrl+Shift+F`) to search across the project

---

Happy coding! 🚀
