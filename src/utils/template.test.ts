import { describe, expect, it } from 'vitest'
import { filterTemplatesByType } from './template'
import type { EmailTemplate } from '../types'

describe('filterTemplatesByType utility', () => {
  const mockTemplates: EmailTemplate[] = [
    {
      id: 'tpl-dir-1',
      templateKey: 'direct_1',
      name: 'Direct Active',
      templateType: 'direct',
      subject: 'Subject 1',
      htmlBody: '<p>Body 1</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'tpl-dir-2',
      templateKey: 'direct_2',
      name: 'Direct Draft',
      templateType: 'direct',
      subject: 'Subject 2',
      htmlBody: '<p>Body 2</p>',
      locale: 'en',
      status: 'draft',
      version: 1,
      createdAt: '2026-09-02T00:00:00Z',
      updatedAt: '2026-09-02T00:00:00Z',
    },
    {
      id: 'tpl-camp-1',
      templateKey: 'camp_1',
      name: 'Campaign Active',
      templateType: 'campaign',
      subject: 'Subject 3',
      htmlBody: '<p>Body 3</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-03T00:00:00Z',
      updatedAt: '2026-09-03T00:00:00Z',
    },
    {
      id: 'tpl-agree-1',
      templateKey: 'agree_1',
      name: 'Agreement Active',
      templateType: 'user_agreement',
      subject: 'Subject 4',
      htmlBody: '<p>Body 4</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-04T00:00:00Z',
      updatedAt: '2026-09-04T00:00:00Z',
    },
    {
      id: 'tpl-agree-2',
      templateKey: 'agree_2',
      name: 'Agreement Inactive',
      templateType: 'user_agreement',
      subject: 'Subject 5',
      htmlBody: '<p>Body 5</p>',
      locale: 'en',
      status: 'archived',
      version: 1,
      createdAt: '2026-09-05T00:00:00Z',
      updatedAt: '2026-09-05T00:00:00Z',
    },
    {
      id: 'tpl-auto-1',
      templateKey: 'auto_1',
      name: 'Automation Active',
      templateType: 'automation',
      subject: 'Subject 6',
      htmlBody: '<p>Body 6</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-06T00:00:00Z',
      updatedAt: '2026-09-06T00:00:00Z',
    },
  ]

  it('filters by direct template type', () => {
    const result = filterTemplatesByType(mockTemplates, 'direct')
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.id)).toEqual(['tpl-dir-1', 'tpl-dir-2'])
  })

  it('filters by direct template type with onlyActive = true', () => {
    const result = filterTemplatesByType(mockTemplates, 'direct', { onlyActive: true })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tpl-dir-1')
  })

  it('filters by campaign template type', () => {
    const result = filterTemplatesByType(mockTemplates, 'campaign')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tpl-camp-1')
  })

  it('filters by user_agreement template type with onlyActive = true', () => {
    const result = filterTemplatesByType(mockTemplates, 'user_agreement', { onlyActive: true })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tpl-agree-1')
  })

  it('filters by automation template type', () => {
    const result = filterTemplatesByType(mockTemplates, 'automation')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tpl-auto-1')
  })

  it('returns empty array when given null, undefined, or empty array', () => {
    expect(filterTemplatesByType(null, 'direct')).toEqual([])
    expect(filterTemplatesByType(undefined, 'campaign')).toEqual([])
    expect(filterTemplatesByType([], 'automation')).toEqual([])
  })
})
