# Command Protocol Documentation

## Overview

This document defines the text-based command protocol for bidirectional communication between the frontend and the ESP32 controller.

## Architecture

```
Frontend UI → WebSocket Store → Node.js Bridge → USB Serial → ESP32
                                      ↑                           ↓
Frontend UI ← WebSocket Store ← Node.js Bridge ← USB Serial ← ESP32
```

## Command Format

Commands are sent as **newline-terminated ASCII strings** (`\n`).

**General Format:**
```
CATEGORY:ACTION[:PARAMETER]\n
```

## TOF & Servo Sweep Commands

### Sweep Control

| Command | Description | Parameters | Example |
|---------|-------------|------------|---------|
| `SWEEP:ENABLE` | Enable automatic servo sweep | None | `SWEEP:ENABLE\n` |
| `SWEEP:DISABLE` | Disable automatic servo sweep | None | `SWEEP:DISABLE\n` |
| `SWEEP:STATUS` | Query current sweep status | None | `SWEEP:STATUS\n` |

### Manual Servo Control

| Command | Description | Parameters | Example | Constraints |
|---------|-------------|------------|---------|-------------|
| `SERVO:ANGLE:<value>` | Set servo to specific angle | angle (0-180) | `SERVO:ANGLE:90\n` | Sweep must be disabled |

### Sweep Configuration

| Command | Description | Parameters | Example | Constraints |
|---------|-------------|------------|---------|-------------|
| `SWEEP:MIN:<value>` | Set minimum sweep angle | angle (0-180) | `SWEEP:MIN:10\n` | Must be < MAX |
| `SWEEP:MAX:<value>` | Set maximum sweep angle | angle (0-180) | `SWEEP:MAX:170\n` | Must be > MIN |
| `SWEEP:STEP:<value>` | Set sweep step increment | step (1-20) | `SWEEP:STEP:5\n` | Recommended: 3-10 |
| `SWEEP:MODE:FORWARD` | Set forward-only sweep | None | `SWEEP:MODE:FORWARD\n` | 0° → 180°, restart |
| `SWEEP:MODE:BIDIRECTIONAL` | Set bidirectional sweep | None | `SWEEP:MODE:BIDIRECTIONAL\n` | 0° ↔ 180° |

### Advanced Configuration

| Command | Description | Parameters | Example | Constraints |
|---------|-------------|------------|---------|-------------|
| `SWEEP:SETTLE:<value>` | Servo settle time | milliseconds (0-100) | `SWEEP:SETTLE:10\n` | Default: 5ms |
| `SWEEP:DELAY:<value>` | TOF reading delay | milliseconds (0-100) | `SWEEP:DELAY:5\n` | Default: 5ms |

## Response Format

ESP32 sends acknowledgment messages in the same format:

### Success Responses

```
ACK:SWEEP:ENABLED\n
ACK:SWEEP:DISABLED\n
ACK:SERVO:ANGLE:90\n
ACK:SWEEP:MIN:10\n
ACK:SWEEP:MAX:170\n
```

### Error Responses

```
ERR:INVALID_COMMAND:<original_command>\n
ERR:OUT_OF_RANGE:<parameter>:<value>\n
ERR:SWEEP_ACTIVE:<command>\n
```

**Examples:**
- `ERR:OUT_OF_RANGE:ANGLE:200\n` - Angle must be 0-180
- `ERR:SWEEP_ACTIVE:SERVO:ANGLE\n` - Cannot set manual angle while sweep is enabled
- `ERR:INVALID_COMMAND:SWEEP:RANDOM\n` - Unknown command

### Status Responses

```
STATUS:SWEEP:ENABLED:<min>:<max>:<step>:<mode>\n
STATUS:SWEEP:DISABLED:<current_angle>\n
```

**Example:**
```
STATUS:SWEEP:ENABLED:5:175:5:BIDIRECTIONAL\n
STATUS:SWEEP:DISABLED:90\n
```

## Existing Commands (Already Implemented)

| Command | Description | Parameters | Example |
|---------|-------------|------------|---------|
| `MODE:A` | Set control mode A | None | `MODE:A\n` |
| `MODE:B` | Set control mode B | None | `MODE:B\n` |

## Future Commands (Planned)

### Motor Configuration
```
MOTOR:<n>:KP:<value>\n         # Set proportional gain
MOTOR:<n>:KI:<value>\n         # Set integral gain
MOTOR:<n>:SETPOINT:<value>\n   # Set target pressure
MOTOR:<n>:ENABLE\n             # Enable motor
MOTOR:<n>:DISABLE\n            # Disable motor
```

### System Configuration
```
CONFIG:SAVE\n                  # Save current config to NVS
CONFIG:LOAD\n                  # Load config from NVS
CONFIG:RESET\n                 # Reset to factory defaults
```

### Diagnostic Commands
```
DIAG:MEMORY\n                  # Report free heap/stack
DIAG:TASKS\n                   # List FreeRTOS task status
DIAG:SENSORS\n                 # Report sensor health
```

## Implementation Notes

### ESP32 Side

**Command Processing Location:** `src/main.cpp` in `loop()` function

**Example Handler:**
```cpp
void processSerialCommand() {
    if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd.startsWith("SWEEP:")) {
            handleSweepCommand(cmd.substring(6));
        } else if (cmd.startsWith("SERVO:")) {
            handleServoCommand(cmd.substring(6));
        }
    }
}
```

**Thread Safety:**
- All runtime configuration variables must be `volatile`
- Use mutex protection for multi-core access (Core 0 ↔ Core 1)

### Node.js Bridge

**Command Sending Function:** Already exists in `frontend/dev/serial-ws-bridge.ts`

```typescript
async function sendCommandToESP32(command: string) {
  return new Promise<boolean>((resolve) => {
    if (!serialPort || !serialPort.isOpen) {
      console.log('[Bridge] Cannot send command: Serial port not open');
      resolve(false);
      return;
    }

    serialPort.write(command + '\n', (err) => {
      if (err) {
        console.error('[Bridge] Error writing to serial:', err);
        resolve(false);
      } else {
        console.log('[Bridge] Command sent:', command);
        resolve(true);
      }
    });
  });
}
```

**WebSocket Message Handling:** Add new message types

```typescript
ws.on('message', async (message: string) => {
  const msg = JSON.parse(message);

  switch (msg.type) {
    case 'sweep_command':
      await sendCommandToESP32(msg.command);
      break;
    case 'servo_command':
      await sendCommandToESP32(msg.command);
      break;
    // ... existing handlers
  }
});
```

### Frontend (React/TypeScript)

**WebSocket Store:** Add command sending methods

```typescript
export const useSensorStore = create<SensorStore>((set, get) => ({
  // ... existing state

  sendSweepCommand: async (command: string) => {
    const ws = get().ws;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'sweep_command',
        command: command
      }));
    }
  },

  sendServoCommand: async (angle: number) => {
    const ws = get().ws;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'servo_command',
        command: `SERVO:ANGLE:${angle}`
      }));
    }
  }
}));
```

## Error Handling

### Command Validation (ESP32)

```cpp
bool validateAngle(int angle) {
    return (angle >= 0 && angle <= 180);
}

bool validateSweepRange(int min, int max) {
    return (min >= 0 && max <= 180 && min < max);
}

void sendError(const String& type, const String& detail) {
    Serial.print("ERR:");
    Serial.print(type);
    Serial.print(":");
    Serial.println(detail);
}
```

### Timeout Handling (Frontend)

Commands should have a timeout (e.g., 1000ms). If no ACK received, show error to user.

## Testing

### Manual Testing via Serial Monitor

Open PlatformIO Serial Monitor and send commands directly:

```
SWEEP:DISABLE
SERVO:ANGLE:90
SWEEP:MIN:20
SWEEP:MAX:160
SWEEP:ENABLE
```

### Automated Testing

**Test Script:** `frontend/dev/test-commands.ts`

```typescript
const commands = [
  'SWEEP:DISABLE',
  'SERVO:ANGLE:90',
  'SWEEP:ENABLE'
];

for (const cmd of commands) {
  await sendCommand(cmd);
  await delay(100);
}
```

## Performance Considerations

- **Command Rate Limit:** Max 10 commands/second to avoid serial buffer overflow
- **Response Buffering:** ESP32 should queue responses if serial TX buffer is full
- **Priority:** Data packets (50Hz) have priority over command acknowledgments

## Security

- **Input Validation:** All parameters must be validated on ESP32 side
- **Rate Limiting:** Implement command rate limiting to prevent abuse
- **Authentication:** Not implemented (local USB serial only)

---

**Last Updated:** 2025-01-16
**Version:** 1.0
**Status:** Initial Draft
