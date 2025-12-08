/**
 * TypeScript type definitions for ESP32 Motor Control Dashboard
 */

/**
 * Active sensor type for distance detection
 */
export enum ActiveSensor {
  NONE = 0,        // No valid reading from either sensor
  TOF = 1,         // TOF sensor is providing the minimum distance
  ULTRASONIC = 2,  // Ultrasonic sensor is providing the minimum distance
  BOTH_EQUAL = 3,  // Both sensors have equal readings
}

/**
 * Get display name for active sensor
 */
export function getActiveSensorName(sensor: ActiveSensor): string {
  switch (sensor) {
    case ActiveSensor.NONE:
      return 'None';
    case ActiveSensor.TOF:
      return 'TOF';
    case ActiveSensor.ULTRASONIC:
      return 'Ultrasonic';
    case ActiveSensor.BOTH_EQUAL:
      return 'Both';
    default:
      return 'Unknown';
  }
}

/**
 * Motor control data point from ESP32
 * Binary protocol: 115 bytes including servo_angle, tof_current_cm, active_sensor,
 * potentiometer scales, and dynamic distance thresholds
 *
 * All pressure/setpoint values are now NORMALIZED (0-100%)
 * based on calibrated prestress (0%) and maxstress*0.95 (100%)
 */
export interface MotorData {
  time_ms: number;
  sp1_pct: number;  // Motor 1 setpoint in % (0-100)
  sp2_pct: number;  // Motor 2 setpoint in % (0-100)
  sp3_pct: number;  // Motor 3 setpoint in % (0-100)
  sp4_pct: number;  // Motor 4 setpoint in % (0-100)
  sp5_pct: number;  // Motor 5 setpoint in % (0-100)
  pp1_pct: number;  // Pressure pad 1 normalized (0-100%)
  pp2_pct: number;  // Pressure pad 2 normalized (0-100%)
  pp3_pct: number;  // Pressure pad 3 normalized (0-100%)
  pp4_pct: number;  // Pressure pad 4 normalized (0-100%)
  pp5_pct: number;  // Pressure pad 5 normalized (0-100%)
  duty1_pct: number;  // Motor 1 duty cycle (-100 to +100%)
  duty2_pct: number;  // Motor 2 duty cycle (-100 to +100%)
  duty3_pct: number;  // Motor 3 duty cycle (-100 to +100%)
  duty4_pct: number;  // Motor 4 duty cycle (-100 to +100%)
  duty5_pct: number;  // Motor 5 duty cycle (-100 to +100%)
  tof1_cm: number;  // Motor 1 sector distance (5°-39°)
  tof2_cm: number;  // Motor 2 sector distance (39°-73°)
  tof3_cm: number;  // Motor 3 sector distance (73°-107°)
  tof4_cm: number;  // Motor 4 sector distance (107°-141°)
  tof5_cm: number;  // Motor 5 sector distance (141°-175°)
  servo_angle: number;  // Current servo position in degrees
  tof_current_cm: number;  // TOF distance at current servo angle (real-time)
  active_sensor: ActiveSensor;  // Which sensor provided the minimum distance (0=none, 1=TOF, 2=ultrasonic, 3=both)
  // Potentiometer scale values
  force_scale: number;  // Force scale from pot 1 (0.6-1.0)
  distance_scale: number;  // Distance scale from pot 2 (0.5-1.5)
  // Dynamic distance thresholds (in cm)
  dist_close_max: number;  // CLOSE/MEDIUM boundary (75-125 cm)
  dist_medium_max: number;  // MEDIUM/FAR boundary (125-275 cm)
  dist_far_max: number;  // FAR/OUT boundary (150-450 cm)
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
 * Distance thresholds for range classification
 */
export interface DistanceThresholds {
  closeMin: number;   // Fixed at 50 cm (sensor limitation)
  closeMax: number;   // CLOSE/MEDIUM boundary
  mediumMax: number;  // MEDIUM/FAR boundary
  farMax: number;     // FAR/OUT boundary
}

/**
 * Default distance thresholds (scale = 1.0, pot at 50%)
 */
export const DEFAULT_THRESHOLDS: DistanceThresholds = {
  closeMin: 50,
  closeMax: 100,
  mediumMax: 200,
  farMax: 300,
};

/**
 * Get distance range classification with dynamic thresholds
 */
export function getDistanceRange(
  distance: number,
  thresholds: DistanceThresholds = DEFAULT_THRESHOLDS
): DistanceRange {
  if (distance < 0 || distance < thresholds.closeMin || distance > thresholds.farMax) {
    return DistanceRange.OUT_OF_RANGE;
  } else if (distance < thresholds.closeMax) {
    return DistanceRange.CLOSE;
  } else if (distance < thresholds.mediumMax) {
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
