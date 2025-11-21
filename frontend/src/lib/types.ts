/**
 * TypeScript type definitions for ESP32 Motor Control Dashboard
 */

/**
 * Motor control data point from ESP32
 * Binary protocol: 84 bytes including servo_angle and tof_current_cm for real-time radar
 */
export interface MotorData {
  time_ms: number;
  sp1_mv: number;  // Motor 1 setpoint in millivolts
  sp2_mv: number;  // Motor 2 setpoint in millivolts
  sp3_mv: number;  // Motor 3 setpoint in millivolts
  sp4_mv: number;  // Motor 4 setpoint in millivolts
  sp5_mv: number;  // Motor 5 setpoint in millivolts
  pp1_mv: number;
  pp2_mv: number;
  pp3_mv: number;
  pp4_mv: number;
  pp5_mv: number;
  duty1_pct: number;
  duty2_pct: number;
  duty3_pct: number;
  duty4_pct: number;
  duty5_pct: number;
  tof1_cm: number;  // Motor 1 sector distance (5°-39° in servo_config.h)
  tof2_cm: number;  // Motor 2 sector distance (39°-73° in servo_config.h)
  tof3_cm: number;  // Motor 3 sector distance (73°-107° in servo_config.h)
  tof4_cm: number;  // Motor 4 sector distance (107°-141° in servo_config.h)
  tof5_cm: number;  // Motor 5 sector distance (141°-175° in servo_config.h)
  servo_angle: number;  // Current servo position in degrees (configured range in servo_config.h)
  tof_current_cm: number;  // TOF distance at current servo angle (real-time)
}

/**
 * Radar scan point - angle and distance pair
 */
export interface RadarScanPoint {
  angle: number;      // Servo angle in degrees (configured range in servo_config.h)
  distance: number;   // TOF distance in cm
  timestamp: number;  // Time when reading was taken
}

/**
 * WebSocket message types
 */
export type WebSocketMessage =
  | {
      type: 'connected';
      message: string;
      frequency: string;
    }
  | {
      type: 'data';
      payload: MotorData;
      timestamp: number;
    }
  | {
      type: 'reset_complete';
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'pong';
    };

/**
 * Distance range classification
 */
export enum DistanceRange {
  CLOSE = 'CLOSE',
  MEDIUM = 'MEDIUM',
  FAR = 'FAR',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
}

/**
 * Get distance range classification
 */
export function getDistanceRange(distance: number): DistanceRange {
  if (distance < 0 || distance > 300) {
    return DistanceRange.OUT_OF_RANGE;
  } else if (distance <= 50) {
    return DistanceRange.CLOSE;
  } else if (distance <= 150) {
    return DistanceRange.MEDIUM;
  } else {
    return DistanceRange.FAR;
  }
}

/**
 * Get badge color for distance range
 */
export function getDistanceRangeColor(
  range: DistanceRange
): 'destructive' | 'default' | 'secondary' {
  switch (range) {
    case DistanceRange.CLOSE:
      return 'destructive'; // Red
    case DistanceRange.MEDIUM:
      return 'default'; // Yellow/orange
    case DistanceRange.FAR:
      return 'secondary'; // Green/blue
    case DistanceRange.OUT_OF_RANGE:
      return 'destructive'; // Red
  }
}

/**
 * Session data for historical playback
 */
export interface Session {
  id: number;
  name: string;
  start_time: number;
  end_time: number | null;
}

/**
 * WebSocket connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}
