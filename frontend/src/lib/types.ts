/**
 * TypeScript type definitions for ESP32 Motor Control Dashboard
 */

/**
 * Motor control data point from ESP32
 * Matches the CSV format: time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm
 */
export interface MotorData {
  time_ms: number;
  setpoint_mv: number;
  pp1_mv: number;
  pp2_mv: number;
  pp3_mv: number;
  pp4_mv: number;
  duty1_pct: number;
  duty2_pct: number;
  duty3_pct: number;
  duty4_pct: number;
  tof_dist_cm: number;
}

/**
 * WebSocket message types
 */
export type WebSocketMessage =
  | {
      type: 'connected';
      message: string;
      frequency: string;
      isRecording: boolean;
    }
  | {
      type: 'data';
      payload: MotorData;
      timestamp: number;
      isRecording: boolean;
    }
  | {
      type: 'recording_status';
      isRecording: boolean;
    }
  | {
      type: 'reset_complete';
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
  is_recording: boolean;
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
