import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatTemplateKey,
  getTransactionalStatusBadgeStyle,
} from './transactional'

describe('transactional utils', () => {
  describe('getTransactionalStatusBadgeStyle', () => {
    it('returns green badge style for sent status', () => {
      const style = getTransactionalStatusBadgeStyle('sent')
      expect(style.color).toBe('#4ade80')
    })

    it('returns blue badge style for sending status', () => {
      const style = getTransactionalStatusBadgeStyle('sending')
      expect(style.color).toBe('#38bdf8')
    })

    it('returns yellow badge style for pending status', () => {
      const style = getTransactionalStatusBadgeStyle('pending')
      expect(style.color).toBe('#facc15')
    })

    it('returns red badge style for failed status', () => {
      const style = getTransactionalStatusBadgeStyle('failed')
      expect(style.color).toBe('#f87171')
    })

    it('returns default gray badge style for cancelled or unknown status', () => {
      const style = getTransactionalStatusBadgeStyle('cancelled')
      expect(style.color).toBe('#94a3b8')

      const unknownStyle = getTransactionalStatusBadgeStyle('unknown')
      expect(unknownStyle.color).toBe('#94a3b8')
    })
  })

  describe('formatTemplateKey', () => {
    it('formats recognized template keys into readable names', () => {
      expect(formatTemplateKey('auth.register_code')).toBe('Registration Code')
      expect(formatTemplateKey('auth.welcome')).toBe('Welcome')
      expect(formatTemplateKey('auth.password_recovery')).toBe('Password Recovery')
      expect(formatTemplateKey('auth.ip_confirmation')).toBe('New Device Login')
    })

    it('returns original key or dash for unrecognized/empty keys', () => {
      expect(formatTemplateKey('custom.template')).toBe('custom.template')
      expect(formatTemplateKey('')).toBe('-')
      expect(formatTemplateKey(undefined)).toBe('-')
    })
  })

  describe('formatDateTime', () => {
    it('formats ISO date string properly', () => {
      const formatted = formatDateTime('2026-09-26T12:30:00Z')
      expect(formatted).not.toBe('-')
      expect(formatted.length).toBeGreaterThan(5)
    })

    it('returns dash for undefined or empty string', () => {
      expect(formatDateTime(undefined)).toBe('-')
      expect(formatDateTime('')).toBe('-')
    })
  })
})
