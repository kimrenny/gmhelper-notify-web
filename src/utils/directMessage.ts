export const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

export const SYSTEM_USER_VARIABLES = ['username', 'email', 'role', 'language'] as const
export type SystemUserVariable = typeof SYSTEM_USER_VARIABLES[number]

/**
 * Extracts unique placeholder variables from template fields in deterministic order of appearance.
 * Recognizes {{variable}} syntax with optional internal whitespace.
 */
export function extractTemplateVariables(
  subject?: string,
  htmlBody?: string,
  plainTextBody?: string
): string[] {
  const seen = new Set<string>()
  const variables: string[] = []

  const sources = [subject, htmlBody, plainTextBody]
  for (const source of sources) {
    if (!source) continue
    const regex = new RegExp(PLACEHOLDER_REGEX.source, 'g')
    let match: RegExpExecArray | null
    while ((match = regex.exec(source)) !== null) {
      const varName = match[1].trim()
      if (varName && !seen.has(varName)) {
        seen.add(varName)
        variables.push(varName)
      }
    }
  }

  return variables
}

/**
 * Checks if a given variable name is a system user variable supported by the backend user context.
 */
export function isSystemUserVariable(varName: string): boolean {
  return (SYSTEM_USER_VARIABLES as readonly string[]).includes(varName.trim().toLowerCase())
}

export interface CategorizedVariables {
  systemVariables: string[]
  customVariables: string[]
}

/**
 * Categorizes template variables into automatically resolved system variables and custom user-input variables.
 * For registered users, system variables (username, email, role, language) are automatically populated.
 * For custom email recipients, NO variables are auto-resolved from user context.
 */
export function categorizeVariables(
  variables: string[],
  isRegisteredUser: boolean
): CategorizedVariables {
  if (!isRegisteredUser) {
    return {
      systemVariables: [],
      customVariables: [...variables],
    }
  }

  const systemVariables: string[] = []
  const customVariables: string[] = []

  for (const v of variables) {
    if (isSystemUserVariable(v)) {
      systemVariables.push(v)
    } else {
      customVariables.push(v)
    }
  }

  return { systemVariables, customVariables }
}

/**
 * Builds the payload map for custom variables to be sent in CreateDirectNotificationInput.
 * Returns undefined if no custom variables have values.
 */
export function buildNotificationPayload(
  customVariables: string[],
  variableValues: Record<string, string>
): Record<string, unknown> | undefined {
  const payload: Record<string, unknown> = {}
  let hasAny = false

  for (const varName of customVariables) {
    const val = variableValues[varName]
    if (val !== undefined && val.trim() !== '') {
      payload[varName] = val
      hasAny = true
    }
  }

  return hasAny ? payload : undefined
}

/**
 * Validates whether a string is a well-formed email address according to standard web formats.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > 254) {
    return false
  }
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  return emailRegex.test(trimmed)
}

/**
 * Replaces {{variable}} placeholders in template text with resolved variable values.
 * Unresolved variables remain as {{variable}}.
 */
export function renderPreviewText(
  text?: string,
  vars?: Record<string, string | undefined>
): string {
  if (!text) return ''
  return text.replace(PLACEHOLDER_REGEX, (match, varName) => {
    const key = varName.trim()
    const val = vars?.[key]
    if (val !== undefined && val.trim() !== '') {
      return val
    }
    return match
  })
}
