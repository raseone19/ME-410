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
  motorSetpointOffsets: [number, number, number, number]; // mV
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

  motorSetpointOffsets: [0, 0, 0, 0],
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
    motorSetpointOffsets: [10, -10, 5, -5], // Intentional variations
  },
};

/**
 * Distance range thresholds (matching ESP32 logic)
 */
export const DISTANCE_CLOSE_MAX = 50;    // cm
export const DISTANCE_MEDIUM_MAX = 150;  // cm
export const DISTANCE_FAR_MAX = 300;     // cm

/**
 * Setpoint values for different distance ranges (mV)
 */
export const SETPOINT_CLOSE = 900;
export const SETPOINT_MEDIUM = 850;
export const SETPOINT_FAR = 800;

/**
 * Sector definitions for MODE B (degrees)
 */
export const SECTORS = {
  motor1: { min: 0, max: 30 },
  motor2: { min: 31, max: 60 },
  motor3: { min: 61, max: 90 },
  motor4: { min: 91, max: 120 },
} as const;

/**
 * Get setpoint based on TOF distance (matching ESP32 logic)
 */
export function getSetpointForDistance(distance: number): number {
  if (distance <= DISTANCE_CLOSE_MAX) {
    return SETPOINT_CLOSE;
  } else if (distance <= DISTANCE_MEDIUM_MAX) {
    return SETPOINT_MEDIUM;
  } else {
    return SETPOINT_FAR;
  }
}

/**
 * Determine which motor sector the servo angle belongs to
 */
export function getMotorForAngle(angle: number): 1 | 2 | 3 | 4 | null {
  if (angle >= SECTORS.motor1.min && angle <= SECTORS.motor1.max) return 1;
  if (angle >= SECTORS.motor2.min && angle <= SECTORS.motor2.max) return 2;
  if (angle >= SECTORS.motor3.min && angle <= SECTORS.motor3.max) return 3;
  if (angle >= SECTORS.motor4.min && angle <= SECTORS.motor4.max) return 4;
  return null;
}
