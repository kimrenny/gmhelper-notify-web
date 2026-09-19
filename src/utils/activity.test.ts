import { describe, expect, it } from 'vitest'
import {
  formatActivityActor,
  formatActivityEventType,
  formatActivityTarget,
  formatActivityTargetType,
  formatDateTime,
  getActivityStatusBadgeStyle,
} from './activity'

describe('activity utils', () => {
  describe('formatActivityEventType', () => {
    it('formats known event types into human-readable strings', () => {
      expect(formatActivityEventType('template.created')).toBe('Template Created')
      expect(formatActivityEventType('automation.enabled')).toBe('Automation Rule Enabled')
      expect(formatActivityEventType('campaign.completed')).toBe('Campaign Completed')
      expect(formatActivityEventType('direct.delivered')).toBe('Direct Message Delivered')
      expect(formatActivityEventType('settings.updated')).toBe('Settings Updated')
      expect(formatActivityEventType('agreement.broadcast_created')).toBe(
        'Agreement Broadcast Created'
      )
    })

    it('falls back gracefully for unknown or empty event types', () => {
      expect(formatActivityEventType('')).toBe('-')
      expect(formatActivityEventType(undefined)).toBe('-')
      expect(formatActivityEventType('custom.event_action')).toBe('custom event action')
    })
  })

  describe('formatActivityTargetType', () => {
    it('formats known target types into human-readable strings', () => {
      expect(formatActivityTargetType('campaign')).toBe('Campaign')
      expect(formatActivityTargetType('direct_notification')).toBe('Direct Message')
      expect(formatActivityTargetType('template')).toBe('Email Template')
      expect(formatActivityTargetType('automation_rule')).toBe('Automation Rule')
      expect(formatActivityTargetType('settings')).toBe('System Settings')
      expect(formatActivityTargetType('agreement')).toBe('User Agreement')
    })

    it('falls back gracefully for unknown or empty target types', () => {
      expect(formatActivityTargetType('')).toBe('-')
      expect(formatActivityTargetType(undefined)).toBe('-')
      expect(formatActivityTargetType('custom_target')).toBe('custom target')
    })
  })

  describe('formatActivityActor', () => {
    it('formats user actor with name or userId', () => {
      expect(
        formatActivityActor({
          type: 'user',
          name: 'Jane Doe',
          userId: 'u-1',
          role: 'owner',
        })
      ).toBe('Jane Doe')

      expect(
        formatActivityActor({
          type: 'user',
          userId: 'u-99',
        })
      ).toBe('User (u-99)')
    })

    it('formats system and service actors', () => {
      expect(formatActivityActor({ type: 'service' })).toBe('Service Account')
      expect(formatActivityActor({ type: 'system' })).toBe('System')
      expect(formatActivityActor(undefined)).toBe('System')
    })
  })

  describe('formatActivityTarget', () => {
    it('returns target name if present', () => {
      expect(
        formatActivityTarget({
          type: 'template',
          id: 'tpl-1',
          name: 'Welcome Email',
        })
      ).toBe('Welcome Email')
    })

    it('returns target ID if name is missing', () => {
      expect(
        formatActivityTarget({
          type: 'campaign',
          id: 'camp-123',
        })
      ).toBe('camp-123')
    })

    it('falls back to formatted target type if only type is available', () => {
      expect(
        formatActivityTarget({
          type: 'settings',
          id: '',
        })
      ).toBe('System Settings')
      expect(formatActivityTarget(undefined)).toBe('-')
    })
  })

  describe('getActivityStatusBadgeStyle', () => {
    it('returns appropriate styles for success, warning, failure, and other statuses', () => {
      expect(getActivityStatusBadgeStyle('success').color).toBe('#4ade80')
      expect(getActivityStatusBadgeStyle('warning').color).toBe('#fb923c')
      expect(getActivityStatusBadgeStyle('failure').color).toBe('#f87171')
      expect(getActivityStatusBadgeStyle('unknown').color).toBe('#94a3b8')
    })
  })

  describe('formatDateTime', () => {
    it('formats ISO date strings', () => {
      const formatted = formatDateTime('2026-09-19T10:30:00Z')
      expect(formatted).not.toBe('-')
      expect(typeof formatted).toBe('string')
    })

    it('handles empty and invalid dates gracefully', () => {
      expect(formatDateTime('')).toBe('-')
      expect(formatDateTime(undefined)).toBe('-')
      expect(formatDateTime('invalid-date')).toBe('invalid-date')
    })
  })
})
