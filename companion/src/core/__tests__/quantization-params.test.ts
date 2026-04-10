import { describe, it, expect } from 'vitest'
import {
  DEFAULT_QUANTIZATION_PARAMS,
  getDefaultParams,
  validateParams,
  PARAM_RANGES,
  type QuantizationParams,
} from '../quantization-params'

describe('quantization-params', () => {
  // -----------------------------------------------------------------------
  // DEFAULT_QUANTIZATION_PARAMS
  // -----------------------------------------------------------------------

  describe('DEFAULT_QUANTIZATION_PARAMS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_QUANTIZATION_PARAMS).toEqual({
        saturationFactor: 1.4,
        ditherThreshold: 24000,
        graySpread: 40,
        grayLuminanceMidpoint: 128,
      })
    })

    it('should be frozen (immutable)', () => {
      // In strict mode, assigning to a frozen object throws.
      // In non-strict mode, it silently fails.
      // Either way, the value should not change.
      const original = DEFAULT_QUANTIZATION_PARAMS.saturationFactor
      try {
        ;(DEFAULT_QUANTIZATION_PARAMS as QuantizationParams).saturationFactor = 999
      } catch {
        // Expected in strict mode
      }
      expect(DEFAULT_QUANTIZATION_PARAMS.saturationFactor).toBe(original)
    })
  })

  // -----------------------------------------------------------------------
  // getDefaultParams()
  // -----------------------------------------------------------------------

  describe('getDefaultParams()', () => {
    it('should return a copy equal to DEFAULT_QUANTIZATION_PARAMS', () => {
      const params = getDefaultParams()
      expect(params).toEqual(DEFAULT_QUANTIZATION_PARAMS)
    })

    it('should return a new object each time (not the same reference)', () => {
      const a = getDefaultParams()
      const b = getDefaultParams()
      expect(a).not.toBe(b)
    })

    it('returned object should be mutable', () => {
      const params = getDefaultParams()
      params.saturationFactor = 2.5
      expect(params.saturationFactor).toBe(2.5)
      // Original unchanged
      expect(DEFAULT_QUANTIZATION_PARAMS.saturationFactor).toBe(1.4)
    })
  })

  // -----------------------------------------------------------------------
  // validateParams()
  // -----------------------------------------------------------------------

  describe('validateParams()', () => {
    it('should return defaults when given empty object', () => {
      const result = validateParams({})
      expect(result).toEqual(getDefaultParams())
    })

    it('should merge partial params with defaults', () => {
      const result = validateParams({ ditherThreshold: 10000 })
      expect(result.ditherThreshold).toBe(10000)
      expect(result.saturationFactor).toBe(1.4)
      expect(result.graySpread).toBe(40)
      expect(result.grayLuminanceMidpoint).toBe(128)
    })

    it('should clamp values above maximum', () => {
      const result = validateParams({ saturationFactor: 5.0 })
      expect(result.saturationFactor).toBe(3.0) // max is 3.0
    })

    it('should clamp values below minimum', () => {
      const result = validateParams({ saturationFactor: 0.1 })
      expect(result.saturationFactor).toBe(0.5) // min is 0.5
    })

    it('should clamp all parameters to their ranges', () => {
      const result = validateParams({
        saturationFactor: -1,
        ditherThreshold: 100000,
        graySpread: -50,
        grayLuminanceMidpoint: 999,
      })
      expect(result.saturationFactor).toBe(PARAM_RANGES.saturationFactor[0])
      expect(result.ditherThreshold).toBe(PARAM_RANGES.ditherThreshold[1])
      expect(result.graySpread).toBe(PARAM_RANGES.graySpread[0])
      expect(result.grayLuminanceMidpoint).toBe(PARAM_RANGES.grayLuminanceMidpoint[1])
    })

    it('should accept values within range as-is', () => {
      const input: QuantizationParams = {
        saturationFactor: 2.0,
        ditherThreshold: 10000,
        graySpread: 60,
        grayLuminanceMidpoint: 100,
      }
      const result = validateParams(input)
      expect(result).toEqual(input)
    })

    it('should accept exact boundary values', () => {
      const result = validateParams({
        saturationFactor: 0.5,
        ditherThreshold: 0,
        graySpread: 100,
        grayLuminanceMidpoint: 200,
      })
      expect(result.saturationFactor).toBe(0.5)
      expect(result.ditherThreshold).toBe(0)
      expect(result.graySpread).toBe(100)
      expect(result.grayLuminanceMidpoint).toBe(200)
    })

    it('should ignore NaN values and use defaults', () => {
      const result = validateParams({ saturationFactor: NaN })
      expect(result.saturationFactor).toBe(1.4)
    })

    it('should ignore non-number values and use defaults', () => {
      const result = validateParams({ saturationFactor: 'hello' as unknown as number })
      expect(result.saturationFactor).toBe(1.4)
    })
  })
})
