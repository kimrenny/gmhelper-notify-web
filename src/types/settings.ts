export interface Settings {
  defaultFromName: string
  replyToEmail: string
  defaultLocale: string
}

export interface UpdateSettingsInput {
  defaultFromName?: string
  replyToEmail?: string
  defaultLocale?: string
}

export interface SupportedLocaleOption {
  value: string
  label: string
}

export const SUPPORTED_LOCALES: readonly SupportedLocaleOption[] = [
  { value: 'en', label: 'English (en)' },
  { value: 'en-US', label: 'English - United States (en-US)' },
  { value: 'en-GB', label: 'English - United Kingdom (en-GB)' },
  { value: 'ua', label: 'Ukrainian (ua)' },
  { value: 'uk', label: 'Ukrainian - ISO (uk)' },
  { value: 'de', label: 'German (de)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'it', label: 'Italian (it)' },
  { value: 'pl', label: 'Polish (pl)' },
  { value: 'ru', label: 'Russian (ru)' },
]
