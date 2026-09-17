// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  buildNotificationPayload,
  categorizeVariables,
  extractTemplateVariables,
  isSystemUserVariable,
  isValidEmail,
  renderPreviewText,
  SYSTEM_USER_VARIABLES,
} from './directMessage'

describe('directMessage utils', () => {
  describe('extractTemplateVariables', () => {
    it('detects variables from subject', () => {
      const result = extractTemplateVariables('Welcome, {{username}}!')
      expect(result).toEqual(['username'])
    })

    it('detects variables from HTML body', () => {
      const result = extractTemplateVariables(
        undefined,
        '<p>Hello {{username}}, your role is {{role}}.</p>'
      )
      expect(result).toEqual(['username', 'role'])
    })

    it('combines variables from subject and HTML body with deterministic ordering', () => {
      const result = extractTemplateVariables(
        'Invoice #{{invoiceId}} for {{username}}',
        '<p>Hi {{username}}, amount due: {{amount}} for invoice {{invoiceId}}.</p>'
      )
      expect(result).toEqual(['invoiceId', 'username', 'amount'])
    })

    it('includes variables from plainTextBody when provided', () => {
      const result = extractTemplateVariables(
        'Notification',
        '<p>Main content</p>',
        'Plain text footer: {{unsubscribeLink}}'
      )
      expect(result).toEqual(['unsubscribeLink'])
    })

    it('deduplicates recurring variables', () => {
      const result = extractTemplateVariables(
        '{{title}} - {{title}}',
        '<p>{{title}} {{content}} {{title}}</p>'
      )
      expect(result).toEqual(['title', 'content'])
    })

    it('handles whitespace around variable names inside brackets', () => {
      const result = extractTemplateVariables(
        '{{  spacedVar  }} and {{	tabbedVar	}}'
      )
      expect(result).toEqual(['spacedVar', 'tabbedVar'])
    })

    it('handles variable names with underscores, hyphens, and dots', () => {
      const result = extractTemplateVariables(
        '{{user.first_name}} and {{account-id_v2}}'
      )
      expect(result).toEqual(['user.first_name', 'account-id_v2'])
    })

    it('returns empty array when no variables are present or inputs are empty/undefined', () => {
      expect(extractTemplateVariables()).toEqual([])
      expect(extractTemplateVariables('', '', '')).toEqual([])
      expect(extractTemplateVariables('Static subject', 'Static body')).toEqual([])
    })
  })

  describe('isSystemUserVariable', () => {
    it('returns true for all supported system variables', () => {
      for (const v of SYSTEM_USER_VARIABLES) {
        expect(isSystemUserVariable(v)).toBe(true)
        expect(isSystemUserVariable(v.toUpperCase())).toBe(true)
      }
    })

    it('returns false for custom variable names', () => {
      expect(isSystemUserVariable('orderNumber')).toBe(false)
      expect(isSystemUserVariable('code')).toBe(false)
      expect(isSystemUserVariable('link')).toBe(false)
    })
  })

  describe('categorizeVariables', () => {
    it('categorizes system and custom variables for a registered user', () => {
      const variables = ['username', 'orderId', 'role', 'trackingUrl', 'language', 'email']
      const result = categorizeVariables(variables, true)

      expect(result.systemVariables).toEqual(['username', 'role', 'language', 'email'])
      expect(result.customVariables).toEqual(['orderId', 'trackingUrl'])
    })

    it('treats all variables as custom for custom email recipients (no fabricated system variables)', () => {
      const variables = ['username', 'orderId', 'role', 'email']
      const result = categorizeVariables(variables, false)

      expect(result.systemVariables).toEqual([])
      expect(result.customVariables).toEqual(['username', 'orderId', 'role', 'email'])
    })
  })

  describe('buildNotificationPayload', () => {
    it('creates payload containing only populated custom variables', () => {
      const customVars = ['orderId', 'code', 'emptyField']
      const values = {
        orderId: 'ORD-999',
        code: '123456',
        emptyField: '',
      }

      const payload = buildNotificationPayload(customVars, values)
      expect(payload).toEqual({
        orderId: 'ORD-999',
        code: '123456',
      })
    })

    it('returns undefined if no custom variables have non-empty values', () => {
      const customVars = ['field1', 'field2']
      const values = {
        field1: '   ',
      }

      const payload = buildNotificationPayload(customVars, values)
      expect(payload).toBeUndefined()
    })

    it('ignores variables not in customVariables list', () => {
      const customVars = ['allowedVar']
      const values = {
        allowedVar: 'val',
        otherVar: 'ignored',
      }

      const payload = buildNotificationPayload(customVars, values)
      expect(payload).toEqual({ allowedVar: 'val' })
    })
  })

  describe('isValidEmail', () => {
    it('returns true for valid email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('alice.smith+notify@gmhelper.org')).toBe(true)
      expect(isValidEmail('admin_123@sub.domain.co')).toBe(true)
    })

    it('returns false for invalid email formats', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('   ')).toBe(false)
      expect(isValidEmail('plainaddress')).toBe(false)
      expect(isValidEmail('@missinguser.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user@domain')).toBe(false)
      expect(isValidEmail('user name@domain.com')).toBe(false)
    })
  })

  describe('renderPreviewText', () => {
    it('replaces populated placeholders with corresponding values', () => {
      const text = 'Hello {{username}}, your code is {{code}}.'
      const vars = { username: 'Alice', code: '12345' }
      expect(renderPreviewText(text, vars)).toBe('Hello Alice, your code is 12345.')
    })

    it('leaves unpopulated placeholders as {{variable}}', () => {
      const text = 'Hello {{username}}, your code is {{code}}.'
      const vars = { username: 'Alice' }
      expect(renderPreviewText(text, vars)).toBe('Hello Alice, your code is {{code}}.')
    })

    it('handles empty or undefined inputs gracefully', () => {
      expect(renderPreviewText('')).toBe('')
      expect(renderPreviewText(undefined)).toBe('')
    })
  })
})
