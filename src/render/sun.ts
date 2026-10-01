import { SHADOW_CALIBRATION } from './shadowCalibration';

// The calibrated afternoon direction is fixed; brightness still follows the clock.
export const SUN_OFFSET = SHADOW_CALIBRATION.sunOffset;
export const SHADOW_SLOPE = {
  x: -SUN_OFFSET.x / SUN_OFFSET.y * SHADOW_CALIBRATION.reach,
  z: -SUN_OFFSET.z / SUN_OFFSET.y * SHADOW_CALIBRATION.reach
} as const;
