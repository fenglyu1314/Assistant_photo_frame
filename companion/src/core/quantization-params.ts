/**
 * Quantization Parameters
 *
 * Defines the data model for user-adjustable quantization parameters,
 * including the interface, default values, validation, and range constants.
 *
 * These parameters control:
 *   - Saturation enhancement (Stage 3)
 *   - Gray pixel preprocessing (Stage 3.5)
 *   - Floyd-Steinberg dithering threshold (Stage 4)
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * User-adjustable quantization parameters.
 * All fields are required; use `getDefaultParams()` for a full default set.
 */
export interface QuantizationParams {
  /** Saturation enhancement multiplier (1.0 = no change) */
  saturationFactor: number
  /** Floyd-Steinberg dither bypass threshold (RGB distance squared) */
  ditherThreshold: number
  /** Gray pixel detection: max channel spread (max-min) to classify as gray */
  graySpread: number
  /** Gray pixel binarization: luminance midpoint for black/white split */
  grayLuminanceMidpoint: number
}

// ---------------------------------------------------------------------------
// Range definitions
// ---------------------------------------------------------------------------

/** Valid ranges for each parameter: [min, max] */
export const PARAM_RANGES: Readonly<Record<keyof QuantizationParams, [min: number, max: number]>> = {
  saturationFactor: [0.5, 3.0],
  ditherThreshold: [0, 50000],
  graySpread: [0, 100],
  grayLuminanceMidpoint: [50, 200],
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

/**
 * Frozen default quantization parameters.
 * These match the hardcoded constants in `quantizer.ts`.
 * Do NOT mutate — use `getDefaultParams()` to get a mutable copy.
 */
export const DEFAULT_QUANTIZATION_PARAMS: Readonly<QuantizationParams> = Object.freeze({
  saturationFactor: 1.4,
  ditherThreshold: 24000,
  graySpread: 40,
  grayLuminanceMidpoint: 128,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a mutable copy of the default parameters.
 */
export function getDefaultParams(): QuantizationParams {
  return { ...DEFAULT_QUANTIZATION_PARAMS }
}

/**
 * Clamp a number to [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Merge partial user-supplied parameters with defaults, clamping each value
 * to its valid range.
 *
 * - Missing fields are filled from `DEFAULT_QUANTIZATION_PARAMS`.
 * - Out-of-range values are clamped to the nearest boundary.
 * - Non-number values are replaced with the default.
 *
 * @param params Partial parameter overrides
 * @returns A complete, valid `QuantizationParams` object
 */
export function validateParams(params: Partial<QuantizationParams>): QuantizationParams {
  const defaults = DEFAULT_QUANTIZATION_PARAMS
  const result: QuantizationParams = { ...defaults }

  for (const key of Object.keys(defaults) as Array<keyof QuantizationParams>) {
    const val = params[key]
    if (typeof val === 'number' && !Number.isNaN(val)) {
      const [min, max] = PARAM_RANGES[key]
      result[key] = clamp(val, min, max)
    }
    // else: keep default
  }

  return result
}
