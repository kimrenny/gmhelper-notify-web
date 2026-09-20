import { describe, it, expect } from 'vitest'
import { formatExecutionStatus, getExecutionStatusBadgeStyle } from './automation'

describe('automation utils', () => {
  describe('formatExecutionStatus', () => {
    it('formats standard statuses correctly', () => {
      expect(formatExecutionStatus('success')).toBe('Success')
      expect(formatExecutionStatus('skipped_cooldown')).toBe('Skipped (Cooldown)')
      expect(formatExecutionStatus('skipped_duplicate')).toBe('Skipped (Duplicate)')
      expect(formatExecutionStatus('failed')).toBe('Failed')
    })

    it('handles empty / undefined gracefully', () => {
      expect(formatExecutionStatus(undefined)).toBe('-')
      expect(formatExecutionStatus('')).toBe('-')
    })

    it('falls back gracefully on unknown statuses', () => {
      expect(formatExecutionStatus('partially_completed')).toBe('Partially Completed')
      expect(formatExecutionStatus('UNKNOWN_STATUS')).toBe('Unknown Status')
    })
  })

  describe('getExecutionStatusBadgeStyle', () => {
    it('returns green for success', () => {
      const style = getExecutionStatusBadgeStyle('success')
      expect(style.color).toBe('#4ade80')
    })

    it('returns yellow for skipped_cooldown', () => {
      const style = getExecutionStatusBadgeStyle('skipped_cooldown')
      expect(style.color).toBe('#fde047')
    })

    it('returns blue for skipped_duplicate', () => {
      const style = getExecutionStatusBadgeStyle('skipped_duplicate')
      expect(style.color).toBe('#38bdf8')
    })

    it('returns red for failed', () => {
      const style = getExecutionStatusBadgeStyle('failed')
      expect(style.color).toBe('#f87171')
    })

    it('returns neutral gray for unknown statuses', () => {
      const style = getExecutionStatusBadgeStyle('weird_status')
      expect(style.color).toBe('#94a3b8')
      const style2 = getExecutionStatusBadgeStyle(undefined)
      expect(style2.color).toBe('#94a3b8')
    })
  })
})
