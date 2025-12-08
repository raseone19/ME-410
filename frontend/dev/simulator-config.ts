/**
 * Simulator Configuration
 * Define test scenarios and simulation parameters
 */

import { MotorData } from '../src/lib/types';

/**
 * Simulation scenario types
 */
export type ScenarioType =
  | 'steady'           // Constant distance
  | 'sweep'            // Slow distance sweep
  | 'step'             // Step changes in distance
  | 'random'           // Random distance variations
  | 'sector_test'      // Test each sector individually
  | 'calibration';     // Calibration pattern

/**
 * Simulation parameters
 */
export interface SimulatorConfig {
  scenario: ScenarioType;
  mode: 'A' | 'B';
  frequency: number;           // Hz (default 50)

  // Distance parameters
  initialDistance: number;     // cm
  minDistance: number;         // cm
  maxDistance: number;         // cm
  sweepSpeed: number;          // cm per second

  // Servo parameters (MODE B)
  servoSpeed: number;          // degrees per second
  servoMin: number;            // degrees
  servoMax: number;            // degrees

  // Noise levels
  tofNoise: number;            // cm
  pressureNoise: number;       // mV

  // PI controller simulation
  piResponseSpeed: number;     // 0-1 (how fast pressure responds)
  piKp: number;                // Proportional gain
  piKi: number;                // Integral gain

  // Per-motor setpoint offsets (for testing variations)
  motorSetpointOffsets: [number, number, number, number, number]; // mV
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: SimulatorConfig = {
  scenario: 'sweep',
  mode: 'B',
  frequency: 50,

  initialDistance: 100,
  minDistance: 30,
  maxDistance: 250,
  sweepSpeed: 20, // 20 cm/s

  servoSpeed: 60, // 60 degrees/s (2 seconds for full 120° sweep)
  servoMin: 0,
  servoMax: 120,

  tofNoise: 2,
  pressureNoise: 5,

  piResponseSpeed: 0.05,
  piKp: 0.15,
  piKi: 0.02,

  motorSetpointOffsets: [0, 0, 0, 0, 0],
};

/**
 * Predefined scenario configurations
 */
export const SCENARIO_CONFIGS: Record<ScenarioType, Partial<SimulatorConfig>> = {
  steady: {
    scenario: 'steady',
    initialDistance: 100,
    sweepSpeed: 0,
  },

  sweep: {
    scenario: 'sweep',
    initialDistance: 175,
    minDistance: 30,
    maxDistance: 250,
    sweepSpeed: 20,
  },

  step: {
    scenario: 'step',
    initialDistance: 100,
    sweepSpeed: 0,
  },

  random: {
    scenario: 'random',
    initialDistance: 100,
    minDistance: 50,
    maxDistance: 200,
  },

  sector_test: {
    scenario: 'sector_test',
    mode: 'B',
    servoSpeed: 30, // Slower for testing
  },

  calibration: {
    scenario: 'calibration',
    initialDistance: 100,
    motorSetpointOffsets: [10, -10, 5, -5, 8], // Intentional variations
  },
};

/**
 * Distance range thresholds (matching ESP32 logic)
 */
export const DISTANCE_CLOSE_MAX = 50;    // cm
export const DISTANCE_MEDIUM_MAX = 150;  // cm
export const DISTANCE_FAR_MAX = 300;     // cm

/**
 * Backend configuration values (loaded from API)
 */
interface BackendConfig {
  setpointCloseMv: number;
  setpointMediumMv: number;
  securityOffsetMv: number;
  distanceCloseMax: number;
  distanceMediumMax: number;
  distanceFarMax: number;
  servoMinAngle: number;
  servoMaxAngle: number;
  sectors: {
    motor1: { min: number; max: number };
    motor2: { min: number; max: number };
    motor3: { min: number; max: number };
    motor4: { min: number; max: number };
    motor5: { min: number; max: number };
  };
}

let backendConfig: BackendConfig | null = null;

/**
 * Load configuration from backend API (browser environment)
 */
export async function loadBackendConfig(): Promise<void> {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();

    if (data.success && data.config.tofConstants) {
      const tofConstants = data.config.tofConstants;
      const tof = data.config.tof;
      const sectors = data.config.sectors;

      backendConfig = {
        setpointCloseMv: parseFloat(tofConstants.setpointCloseMv) || 950,
        setpointMediumMv: parseFloat(tofConstants.setpointMediumMv) || 700,
        securityOffsetMv: parseFloat(tofConstants.securityOffsetMv) || 50,
        distanceCloseMax: parseFloat(tofConstants.distanceCloseMax) || 100,
        distanceMediumMax: parseFloat(tofConstants.distanceMediumMax) || 200,
        distanceFarMax: parseFloat(tofConstants.distanceFarMax) || 300,
        servoMinAngle: parseFloat(tof.servoMinAngle) || 5,
        servoMaxAngle: parseFloat(tof.servoMaxAngle) || 175,
        sectors: {
          motor1: {
            min: parseFloat(sectors.motor1.min) || 5,
            max: parseFloat(sectors.motor1.max) || 39,
          },
          motor2: {
            min: parseFloat(sectors.motor2.min) || 39,
            max: parseFloat(sectors.motor2.max) || 73,
          },
          motor3: {
            min: parseFloat(sectors.motor3.min) || 73,
            max: parseFloat(sectors.motor3.max) || 107,
          },
          motor4: {
            min: parseFloat(sectors.motor4.min) || 107,
            max: parseFloat(sectors.motor4.max) || 141,
          },
          motor5: {
            min: parseFloat(sectors.motor5.min) || 141,
            max: parseFloat(sectors.motor5.max) || 175,
          },
        },
      };
      console.log('[Simulator] Loaded backend config from API:', backendConfig);
    }
  } catch (error) {
    console.warn('[Simulator] Failed to load backend config from API, using defaults:', error);
    // Use fallback defaults if API call fails
    backendConfig = {
      setpointCloseMv: 950,
      setpointMediumMv: 700,
      securityOffsetMv: 50,
      distanceCloseMax: 100,
      distanceMediumMax: 200,
      distanceFarMax: 300,
      servoMinAngle: 5,
      servoMaxAngle: 175,
      sectors: {
        motor1: { min: 5, max: 39 },
        motor2: { min: 39, max: 73 },
        motor3: { min: 73, max: 107 },
        motor4: { min: 107, max: 141 },
        motor5: { min: 141, max: 175 },
      },
    };
  }
}

/**
 * Load configuration from file (Node.js environment)
 */
export async function loadBackendConfigFromFile(): Promise<void> {
  try {
    // Dynamic import for Node.js fs module
    const fs = await import('fs');
    const path = await import('path');

    // Path to ESP32 source files (relative to frontend/dev directory)
    const tofSensorPath = path.join(__dirname, '..', '..', 'src', 'sensors', 'tof_sensor.h');
    const servoConfigPath = path.join(__dirname, '..', '..', 'src', 'config', 'servo_config.h');

    // Read files
    const tofSensorContent = fs.readFileSync(tofSensorPath, 'utf-8');
    const servoConfigContent = fs.readFileSync(servoConfigPath, 'utf-8');

    // Extract values using regex
    const extractValue = (content: string, varName: string): number => {
      const regex = new RegExp(`constexpr\\s+\\w+\\s+${varName}\\s*=\\s*([\\d.]+)f?;`, 'm');
      const match = content.match(regex);
      return match ? parseFloat(match[1]) : 0;
    };

    backendConfig = {
      setpointCloseMv: extractValue(tofSensorContent, 'SETPOINT_CLOSE_MV') || 950,
      setpointMediumMv: extractValue(tofSensorContent, 'SETPOINT_MEDIUM_MV') || 700,
      securityOffsetMv: extractValue(tofSensorContent, 'SECURITY_OFFSET_MV') || 50,
      distanceCloseMax: extractValue(tofSensorContent, 'DISTANCE_CLOSE_MAX') || 100,
      distanceMediumMax: extractValue(tofSensorContent, 'DISTANCE_MEDIUM_MAX') || 200,
      distanceFarMax: extractValue(tofSensorContent, 'DISTANCE_FAR_MAX') || 300,
      servoMinAngle: extractValue(servoConfigContent, 'SERVO_MIN_ANGLE') || 5,
      servoMaxAngle: extractValue(servoConfigContent, 'SERVO_MAX_ANGLE') || 175,
      sectors: {
        motor1: {
          min: extractValue(servoConfigContent, 'SECTOR_MOTOR_1_MIN') || 5,
          max: extractValue(servoConfigContent, 'SECTOR_MOTOR_1_MAX') || 39,
        },
        motor2: {
          min: extractValue(servoConfigContent, 'SECTOR_MOTOR_2_MIN') || 39,
          max: extractValue(servoConfigContent, 'SECTOR_MOTOR_2_MAX') || 73,
        },
        motor3: {
          min: extractValue(servoConfigContent, 'SECTOR_MOTOR_3_MIN') || 73,
          max: extractValue(servoConfigContent, 'SECTOR_MOTOR_3_MAX') || 107,
        },
        motor4: {
          min: extractValue(servoConfigContent, 'SECTOR_MOTOR_4_MIN') || 107,
          max: extractValue(servoConfigContent, 'SECTOR_MOTOR_4_MAX') || 141,
        },
        motor5: {
          min: extractValue(servoConfigContent, 'SECTOR_MOTOR_5_MIN') || 141,
          max: extractValue(servoConfigContent, 'SECTOR_MOTOR_5_MAX') || 175,
        },
      },
    };

    console.log('[Simulator] Loaded backend config from file:', backendConfig);
  } catch (error) {
    console.warn('[Simulator] Failed to load backend config from file, using defaults:', error);
    // Use fallback defaults if file read fails
    backendConfig = {
      setpointCloseMv: 950,
      setpointMediumMv: 700,
      securityOffsetMv: 50,
      distanceCloseMax: 100,
      distanceMediumMax: 200,
      distanceFarMax: 300,
      servoMinAngle: 5,
      servoMaxAngle: 175,
      sectors: {
        motor1: { min: 5, max: 39 },
        motor2: { min: 39, max: 73 },
        motor3: { min: 73, max: 107 },
        motor4: { min: 107, max: 141 },
        motor5: { min: 141, max: 175 },
      },
    };
  }
}

/**
 * Get setpoint values in percentage (0-100%)
 * Now using normalized values instead of mV
 */
export function getSetpointValues() {
  return {
    SETPOINT_CLOSE: 70,   // 70% for close range
    SETPOINT_MEDIUM: 50,  // 50% for medium range
    SETPOINT_FAR: 30,     // 30% for far range
  };
}

/**
 * Sector definitions for MODE B (degrees)
 * These are fallback defaults - actual values loaded from backend
 */
export const SECTORS = {
  motor1: { min: 5, max: 39 },
  motor2: { min: 39, max: 73 },
  motor3: { min: 73, max: 107 },
  motor4: { min: 107, max: 141 },
  motor5: { min: 141, max: 175 },
} as const;

/**
 * Get setpoint based on TOF distance (matching ESP32 logic)
 * Uses values from backend configuration
 */
export function getSetpointForDistance(distance: number): number {
  const setpoints = getSetpointValues();

  if (distance <= DISTANCE_CLOSE_MAX) {
    return setpoints.SETPOINT_CLOSE;
  } else if (distance <= DISTANCE_MEDIUM_MAX) {
    return setpoints.SETPOINT_MEDIUM;
  } else {
    return setpoints.SETPOINT_FAR;
  }
}

/**
 * Determine which motor sector the servo angle belongs to
 */
export function getMotorForAngle(angle: number): 1 | 2 | 3 | 4 | 5 | null {
  if (angle >= SECTORS.motor1.min && angle <= SECTORS.motor1.max) return 1;
  if (angle >= SECTORS.motor2.min && angle <= SECTORS.motor2.max) return 2;
  if (angle >= SECTORS.motor3.min && angle <= SECTORS.motor3.max) return 3;
  if (angle >= SECTORS.motor4.min && angle <= SECTORS.motor4.max) return 4;
  if (angle >= SECTORS.motor5.min && angle <= SECTORS.motor5.max) return 5;
  return null;
}
