import type { EmailTemplate, TemplateType } from '../types'

export interface FilterTemplatesOptions {
  onlyActive?: boolean
}

/**
 * Filters a list of templates by a specific template type, and optionally by active status.
 *
 * @param templates - The list of email templates to filter
 * @param type - The required template type ('direct' | 'campaign' | 'user_agreement' | 'automation')
 * @param options - Optional filters such as onlyActive
 * @returns The filtered array of email templates
 */
export function filterTemplatesByType(
  templates: EmailTemplate[] | undefined | null,
  type: TemplateType,
  options?: FilterTemplatesOptions
): EmailTemplate[] {
  if (!templates || !Array.isArray(templates)) {
    return []
  }

  return templates.filter((template) => {
    if (template.templateType !== type) {
      return false
    }

    if (options?.onlyActive) {
      return typeof template.status === 'string' && template.status.toLowerCase() === 'active'
    }

    return true
  })
}
