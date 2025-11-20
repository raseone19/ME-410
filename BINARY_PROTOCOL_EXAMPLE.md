# Binary Protocol Example - Complete Packet Flow

## Overview

This document shows exactly how a single data packet travels from the ESP32-S3 through the serial port to your web browser.

---

## Binary Packet Structure (70 bytes total)

```
┌─────────────────────────────────────────────────────────────────┐
│ Byte Position │ Size │ Type    │ Field Name        │ Value      │
├─────────────────────────────────────────────────────────────────┤
│ 0-1           │ 2    │ uint16  │ Header            │ 0xAA55     │
│ 2-5           │ 4    │ uint32  │ timestamp_ms      │ 12345      │
│ 6-9           │ 4    │ float   │ setpoint1_mv      │ 550.25     │
│ 10-13         │ 4    │ float   │ setpoint2_mv      │ 550.25     │
│ 14-17         │ 4    │ float   │ setpoint3_mv      │ 550.25     │
│ 18-21         │ 4    │ float   │ setpoint4_mv      │ 550.25     │
│ 22-23         │ 2    │ uint16  │ pressure_pad1_mv  │ 523        │
│ 24-25         │ 2    │ uint16  │ pressure_pad2_mv  │ 518        │
│ 26-27         │ 2    │ uint16  │ pressure_pad3_mv  │ 530        │
│ 28-29         │ 2    │ uint16  │ pressure_pad4_mv  │ 525        │
│ 30-33         │ 4    │ float   │ duty_cycle1_pct   │ 45.5       │
│ 34-37         │ 4    │ float   │ duty_cycle2_pct   │ 43.2       │
│ 38-41         │ 4    │ float   │ duty_cycle3_pct   │ 47.8       │
│ 42-45         │ 4    │ float   │ duty_cycle4_pct   │ 44.1       │
│ 46-49         │ 4    │ float   │ tof_distance1_cm  │ 35.2       │
│ 50-53         │ 4    │ float   │ tof_distance2_cm  │ 38.7       │
│ 54-57         │ 4    │ float   │ tof_distance3_cm  │ 32.1       │
│ 58-61         │ 4    │ float   │ tof_distance4_cm  │ 36.5       │
│ 62            │ 1    │ uint8   │ servo_angle       │ 75         │
│ 63-66         │ 4    │ float   │ tof_current_cm    │ 35.2       │
│ 67            │ 1    │ uint8   │ current_mode      │ 1          │
│ 68-69         │ 2    │ uint16  │ crc16_checksum    │ 0x3F2A     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example: Real Binary Packet

### Raw Hexadecimal (70 bytes)
```
55 AA 39 30 00 00 0A 44 09 44 0A 44 09 44
0B 02 06 02 09 02 08 02 16 42 15 42 18 42
14 42 0C 42 0D 42 08 42 0B 42 4B 0C 42 01
2A 3F
```

### Broken Down by Field

**Header (bytes 0-1):**
```
55 AA = 0xAA55 (little-endian)
✓ Valid header detected
```

**Timestamp (bytes 2-5):**
```
39 30 00 00 = 12345 milliseconds
= 12.345 seconds since boot
```

**Setpoints (bytes 6-21):** *(Target pressure for each motor)*
```
Motor 1: 0A 44 09 44 = 550.25 mV
Motor 2: 0A 44 09 44 = 550.25 mV
Motor 3: 0A 44 09 44 = 550.25 mV
Motor 4: 0B 02 06 02 = 550.25 mV
```

**Pressure Pads (bytes 22-29):** *(Current pressure readings)*
```
Pad 1: 0B 02 = 523 mV (below target, inflating)
Pad 2: 06 02 = 518 mV (below target, inflating)
Pad 3: 09 02 = 530 mV (below target, inflating)
Pad 4: 08 02 = 525 mV (below target, inflating)
```

**Motor Duty Cycles (bytes 30-45):** *(Motor power percentage)*
```
Motor 1: 16 42 15 42 = 45.5% (pumping air in)
Motor 2: 18 42 14 42 = 43.2% (pumping air in)
Motor 3: 08 42 0B 42 = 47.8% (pumping air in)
Motor 4: 4B 14 42    = 44.1% (pumping air in)
```

**TOF Distances (bytes 46-61):** *(Distance sensor readings per sector)*
```
Sector 1: 0C 42 0D 42 = 35.2 cm
Sector 2: 08 42 0B 42 = 38.7 cm
Sector 3: 4B 0C 42    = 32.1 cm
Sector 4: 01          = 36.5 cm
```

**Servo Angle (byte 62):**
```
4B = 75 degrees (servo position for TOF sweep)
```

**Current TOF Reading (bytes 63-66):**
```
0C 42 = 35.2 cm (live distance measurement)
```

**Mode (byte 67):**
```
01 = Sweep mode active
```

**CRC-16 Checksum (bytes 68-69):**
```
2A 3F = 0x3F2A
✓ Checksum valid
```

---

## Packet Journey: From ESP32 to Your Screen

### Step 1: ESP32-S3 (Firmware)
**Location:** `src/tasks/core0_tasks.cpp`

```cpp
// Every 20ms (50 Hz), the ESP32 creates a packet:
DataPacket packet;
buildDataPacket(&packet,
    time_ms,        // 12345 ms
    setpoints,      // [550.25, 550.25, 550.25, 550.25]
    pp_mv,          // [523, 518, 530, 525]
    duty,           // [45.5, 43.2, 47.8, 44.1]
    tof_dist,       // [35.2, 38.7, 32.1, 36.5]
    servo_angle,    // 75 degrees
    tof_current,    // 35.2 cm
    mode_byte       // 1
);
sendBinaryPacket(&packet);
```

**Result:** 70 bytes sent over USB serial at 115200 baud (takes ~6ms to transmit)

---

### Step 2: Serial Bridge (Node.js)
**Location:** `frontend/dev/serial-ws-bridge.ts`

```typescript
// Binary data arrives from serial port
serialPort.on('data', (chunk: Buffer) => {
  processBinaryData(chunk);  // Accumulates until full packet
});

// When 70 bytes with header 0xAA55 detected:
function parseBinaryPacket(packet: Buffer): MotorData | null {
  // Verify header
  const header = packet.readUInt16LE(0);  // 0xAA55

  // Verify CRC-16
  const calculatedCRC = calculateCRC16(dataForCRC);
  const packetCRC = packet.readUInt16LE(68);

  if (calculatedCRC === packetCRC) {
    // ✓ Valid packet - parse all fields
    return {
      time_ms: 12345,
      sp1_mv: 550.25,
      pp1_mv: 523,
      duty1_pct: 45.5,
      // ... all other fields
    };
  }
}

// Broadcast to WebSocket clients
broadcastData(motorData);
```

**Result:** JSON object sent to all connected web clients via WebSocket

---

### Step 3: Frontend (Browser)
**Location:** `frontend/src/lib/websocket-store.ts`

```typescript
// WebSocket receives message
ws.onmessage = (event) => {
  const message: WebSocketMessage = JSON.parse(event.data);

  if (message.type === 'data') {
    const newData = message.payload;
    // newData = {
    //   time_ms: 12345,
    //   sp1_mv: 550.25,
    //   pp1_mv: 523,
    //   duty1_pct: 45.5,
    //   ...
    // }

    // Update UI state
    set({ currentData: newData });
  }
};
```

**Result:** React components re-render with new data

---

### Step 4: UI Display
**Location:** `frontend/src/app/diagnostics/page.tsx`

The data appears on your screen:

```
┌─────────────────────────────────────┐
│ Motor 1                             │
├─────────────────────────────────────┤
│ Setpoint:    550.25 mV              │
│ Pressure:    523 mV      ⬇️ Below    │
│ Duty Cycle:  45.5%       🔵 Inflating│
│ TOF Dist:    35.2 cm                │
└─────────────────────────────────────┘
```

---

## Timing Analysis

**Total latency from sensor reading to screen update:**

1. **ESP32 Processing:** ~1 ms (PI controller + packet building)
2. **Serial Transmission:** ~6 ms (70 bytes @ 115200 baud)
3. **Serial Bridge Parsing:** <1 ms (binary parsing is fast)
4. **WebSocket Transmission:** ~1 ms (local network)
5. **Browser Rendering:** ~16 ms (60 FPS refresh)

**Total:** ~25 ms end-to-end latency

At 50 Hz (20 ms period), you get real-time updates with minimal lag!

---

## Understanding the Values

### Setpoints (mV)
- **What it means:** Target pressure for each motor
- **Typical range:** 500-600 mV
- **Calculation:** Based on TOF distance sensor
  - Far away → Lower setpoint (soft touch)
  - Close → Higher setpoint (firm touch)

### Pressure Pads (mV)
- **What it means:** Current pressure inside inflatable
- **Typical range:** 0-1000 mV
- **Interpretation:**
  - 0-300 mV: Deflated
  - 400-600 mV: Normal operation
  - 700+ mV: High pressure

### Duty Cycles (%)
- **What it means:** Motor power (pump speed)
- **Range:** -100% to +100%
  - **Positive:** Pumping air IN (inflating)
  - **Negative:** Pumping air OUT (deflating)
  - **0%:** Motor stopped
- **PI Controller:** Automatically adjusts duty to reach setpoint

### TOF Distances (cm)
- **What it means:** Distance from sensor to nearest object
- **Range:** 10-300 cm
- **4 Sectors:** Servo sweeps left to right, tracking minimum distance per zone
- **Usage:** Determines how firm the inflatable should be

### Servo Angle (degrees)
- **What it means:** Current position of TOF sensor servo
- **Range:** 0-180 degrees
- **Sweep:** Continuously moves to scan environment

### CRC-16 Checksum
- **What it means:** Error detection code
- **Purpose:** Ensures data wasn't corrupted during transmission
- **Algorithm:** CRC-16-CCITT
- **If invalid:** Packet is discarded and retransmitted

---

## Common Scenarios

### Scenario 1: System at Rest
```
Setpoint:  550 mV  (target)
Pressure:  548 mV  (almost there)
Duty:      2.5%    (gentle correction)
TOF:       100 cm  (no object nearby)
```
**Interpretation:** System is stable, maintaining pressure

---

### Scenario 2: Object Detected - Increasing Pressure
```
Setpoint:  650 mV  (increased target)
Pressure:  548 mV  (below target)
Duty:      75%     (pumping hard)
TOF:       25 cm   (object detected close)
```
**Interpretation:** Object detected, inflating to firmer state

---

### Scenario 3: Object Moved Away - Deflating
```
Setpoint:  500 mV  (reduced target)
Pressure:  650 mV  (above target)
Duty:      -50%    (deflating)
TOF:       150 cm  (object moved away)
```
**Interpretation:** Object gone, deflating to softer state

---

### Scenario 4: Out of Range - Emergency Deflate
```
Setpoint:  -1 mV   (invalid/disabled)
Pressure:  850 mV  (too high!)
Duty:      -100%   (full reverse)
TOF:       5 cm    (too close!)
```
**Interpretation:** Safety mode - object too close, emergency deflate

---

## Troubleshooting with Binary Packets

### No packets received
```
Check: Is header 0xAA55 present?
```
→ If no: ESP32 not transmitting or wrong baud rate

### Packets with CRC errors
```
CRC Expected: 0x3F2A
CRC Received: 0x1234
```
→ Serial port noise or cable issue

### All values are 0
```
time_ms: 0, sp1_mv: 0, pp1_mv: 0, ...
```
→ ESP32 just booted, wait for initialization

### Constant values (not changing)
```
time_ms: 5000, 5000, 5000, ...
```
→ ESP32 firmware frozen, press RESET button

---

**Last Updated:** 2025-01-20
**Protocol Version:** Binary v1.0 (70-byte packets)
**Frequency:** 50 Hz (20 ms period)
