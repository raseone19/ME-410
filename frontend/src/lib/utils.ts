import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// Pressure Pad Calibration Constants
// ============================================================================

/**
 * Calibration parameters for converting millivolt readings to force (Newtons)
 * Formula: Force (N) = S × (mV - Ro) × 9.81 × 10⁻³
 *
 * Ro: Zero-force offset (mV) - reading when no force is applied
 * S:  Slope (sensitivity) - conversion factor from mV to grams
 */

// Zero-force offsets (Ro) for each pressure pad (mV)
export const PP_OFFSET_RO = [
  0,      // Pressure Pad 1
  700,    // Pressure Pad 2
  80,     // Pressure Pad 3
  480,    // Pressure Pad 4
  400,    // Pressure Pad 5
];

// Slopes (S) for each pressure pad (mV to grams conversion factor)
export const PP_SLOPE_S = [
  0.78,     // Pressure Pad 1
  0.4875,   // Pressure Pad 2
  0.39,     // Pressure Pad 3
  0.26,     // Pressure Pad 4
  0.25,     // Pressure Pad 5
];

// Physical constants
const GRAVITY_MPS2 = 9.81;
const GRAMS_TO_NEWTONS = 0.001;

/**
 * Convert millivolt reading to force in Newtons
 * Applies calibration formula: Force (N) = S × (mV - Ro) × 9.81 × 10⁻³
 *
 * @param padIndex Pressure pad index (0 to 4, corresponding to motors 1-5)
 * @param millivolts Raw millivolt reading
 * @returns Force in Newtons (clamped to >= 0)
 */
export function millivoltsToNewtons(padIndex: number, millivolts: number): number {
  if (padIndex < 0 || padIndex >= 5) {
    return 0;
  }

  const Ro = PP_OFFSET_RO[padIndex];
  const S = PP_SLOPE_S[padIndex];

  // Apply calibration formula: Force (N) = S × (mV - Ro) × 9.81 × 10⁻³
  const force = S * (millivolts - Ro) * GRAVITY_MPS2 * GRAMS_TO_NEWTONS;

  // Clamp to non-negative (can't have negative force)
  return force > 0 ? force : 0;
}

/**
 * Convert force in Newtons to millivolts
 * Inverse calibration: mV = (Force / (S × 9.81 × 10⁻³)) + Ro
 *
 * @param padIndex Pressure pad index (0 to 4)
 * @param newtons Force in Newtons
 * @returns Equivalent millivolt value
 */
export function newtonsToMillivolts(padIndex: number, newtons: number): number {
  if (padIndex < 0 || padIndex >= 5) {
    return 0;
  }

  const Ro = PP_OFFSET_RO[padIndex];
  const S = PP_SLOPE_S[padIndex];

  // Avoid division by zero
  if (S < 0.0001) {
    return Ro;
  }

  // Inverse calibration: mV = (Force / (S × 9.81 × 10⁻³)) + Ro
  const millivolts = (newtons / (S * GRAVITY_MPS2 * GRAMS_TO_NEWTONS)) + Ro;

  return millivolts;
}
