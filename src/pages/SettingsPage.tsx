import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { ApiError, settingsService } from '../services'
import { SUPPORTED_LOCALES, type Settings, type UpdateSettingsInput } from '../types'

interface FormValidationErrors {
  defaultFromName?: string
  replyToEmail?: string
  defaultLocale?: string
}

function validateEmail(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed) return true
  // Standard email format with domain having at least one period
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(trimmed)
}

function SettingsPage() {
  const apiClient = useApiClient()

  const [serverSettings, setServerSettings] = useState<Settings | null>(null)
  const [formData, setFormData] = useState<UpdateSettingsInput>({
    defaultFromName: '',
    replyToEmail: '',
    defaultLocale: 'en',
  })

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [validationErrors, setValidationErrors] = useState<FormValidationErrors>({})

  // Fetch settings from backend
  const loadSettings = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setLoadError(null)

      try {
        const data = await settingsService.getSettings(apiClient, signal)
        setServerSettings(data)
        setFormData({
          defaultFromName: data.defaultFromName ?? '',
          replyToEmail: data.replyToEmail ?? '',
          defaultLocale: data.defaultLocale ?? 'en',
        })
        setValidationErrors({})
      } catch (err) {
        if (signal?.aborted) {
          return
        }

        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.status === 401) {
            setLoadError('You are not authorized to view settings. Please sign in again.')
          } else if (err.isForbidden || err.status === 403) {
            setLoadError('You do not have permission to access application settings.')
          } else {
            setLoadError(err.message || 'Failed to load application settings.')
          }
        } else {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'A network error occurred while loading settings.'
          )
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [apiClient]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadSettings(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadSettings])

  // Track dirty state
  const isDirty = useMemo(() => {
    if (!serverSettings) return false
    const currentName = (formData.defaultFromName ?? '').trim()
    const serverName = (serverSettings.defaultFromName ?? '').trim()
    const currentEmail = (formData.replyToEmail ?? '').trim()
    const serverEmail = (serverSettings.replyToEmail ?? '').trim()
    const currentLocale = (formData.defaultLocale ?? '').trim()
    const serverLocale = (serverSettings.defaultLocale ?? '').trim()

    return (
      currentName !== serverName ||
      currentEmail !== serverEmail ||
      currentLocale !== serverLocale
    )
  }, [formData, serverSettings])

  // Validate individual field
  const validateField = (name: keyof UpdateSettingsInput, value: string): string | undefined => {
    switch (name) {
      case 'defaultFromName': {
        if (value.trim().length > 100) {
          return 'Default sender name must not exceed 100 characters.'
        }
        return undefined
      }
      case 'replyToEmail': {
        const trimmed = value.trim()
        if (trimmed && trimmed.length > 255) {
          return 'Reply-to email must not exceed 255 characters.'
        }
        if (trimmed && !validateEmail(trimmed)) {
          return 'Please enter a valid email address.'
        }
        return undefined
      }
      case 'defaultLocale': {
        const trimmed = value.trim()
        if (!trimmed) {
          return 'Default locale is required.'
        }
        const supported = SUPPORTED_LOCALES.some(
          (l) => l.value.toLowerCase() === trimmed.toLowerCase()
        )
        if (!supported) {
          return 'Please select a supported locale.'
        }
        return undefined
      }
      default:
        return undefined
    }
  }

  // Check if form is currently valid
  const isFormValid = useMemo(() => {
    const nameErr = validateField('defaultFromName', formData.defaultFromName ?? '')
    const emailErr = validateField('replyToEmail', formData.replyToEmail ?? '')
    const localeErr = validateField('defaultLocale', formData.defaultLocale ?? '')
    return !nameErr && !emailErr && !localeErr
  }, [formData])

  // Field change handler
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const fieldName = name as keyof UpdateSettingsInput

    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
    setSaveSuccess(false)
    setSaveError(null)

    const error = validateField(fieldName, value)
    setValidationErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }))
  }

  // Reset / Cancel handler
  const handleReset = () => {
    if (!serverSettings || isSaving) return
    setFormData({
      defaultFromName: serverSettings.defaultFromName ?? '',
      replyToEmail: serverSettings.replyToEmail ?? '',
      defaultLocale: serverSettings.defaultLocale ?? 'en',
    })
    setValidationErrors({})
    setSaveError(null)
    setSaveSuccess(false)
  }

  // Submit / Save handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSaving || !isDirty) return

    // Run full validation
    const nameErr = validateField('defaultFromName', formData.defaultFromName ?? '')
    const emailErr = validateField('replyToEmail', formData.replyToEmail ?? '')
    const localeErr = validateField('defaultLocale', formData.defaultLocale ?? '')

    if (nameErr || emailErr || localeErr) {
      setValidationErrors({
        defaultFromName: nameErr,
        replyToEmail: emailErr,
        defaultLocale: localeErr,
      })
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const payload: UpdateSettingsInput = {
        defaultFromName: (formData.defaultFromName ?? '').trim(),
        replyToEmail: (formData.replyToEmail ?? '').trim(),
        defaultLocale: (formData.defaultLocale ?? '').trim() || 'en',
      }

      const updated = await settingsService.updateSettings(payload, apiClient)
      setServerSettings(updated)
      setFormData({
        defaultFromName: updated.defaultFromName ?? '',
        replyToEmail: updated.replyToEmail ?? '',
        defaultLocale: updated.defaultLocale ?? 'en',
      })
      setValidationErrors({})
      setSaveSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message || 'Failed to update application settings.')
      } else {
        setSaveError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while saving settings.'
        )
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Settings</h1>
          <p className="gm-admin-page__description">
            Configure notification service defaults and application preferences.
          </p>
        </div>
      </div>

      {/* Initial load error alert */}
      {loadError && (
        <div
          className="gm-admin-warning"
          role="alert"
          data-testid="settings-load-error"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <span>{loadError}</span>
          <button
            type="button"
            className="gm-admin-btn"
            onClick={() => void loadSettings()}
            data-testid="settings-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Initial Loading placeholder */}
      {isLoading ? (
        <div
          className="gm-admin-card"
          data-testid="settings-loading"
          style={{ padding: '3rem 1.5rem', textAlign: 'center' }}
        >
          <p className="gm-admin-muted" style={{ margin: 0 }}>
            Loading application settings...
          </p>
        </div>
      ) : serverSettings ? (
        <div
          style={{
            maxWidth: '840px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Save Error Banner */}
          {saveError && (
            <div
              className="gm-admin-warning"
              role="alert"
              data-testid="settings-save-error"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <span>{saveError}</span>
              <button
                type="button"
                className="gm-admin-btn"
                style={{ fontSize: '0.85rem', padding: '0.35rem 0.65rem' }}
                onClick={() => setSaveError(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Save Success Banner */}
          {saveSuccess && (
            <div
              className="gm-admin-card"
              role="status"
              data-testid="settings-save-success"
              style={{
                border: '1px solid rgba(34, 197, 94, 0.4)',
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#86efac',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <span style={{ fontWeight: 500 }}>Settings updated successfully.</span>
              <button
                type="button"
                className="gm-admin-btn"
                style={{
                  fontSize: '0.85rem',
                  padding: '0.35rem 0.65rem',
                  borderColor: 'rgba(34, 197, 94, 0.4)',
                }}
                onClick={() => setSaveSuccess(false)}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Notification Defaults Form Card */}
          <div className="gm-admin-card" data-testid="settings-card">
            <h2 className="gm-admin-card__title">Notification Defaults</h2>
            <p
              className="gm-admin-muted"
              style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', lineHeight: 1.5 }}
            >
              These values serve as standard defaults for notification messages and template resolution.
            </p>

            <form
              onSubmit={handleSubmit}
              data-testid="settings-form"
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* Default Sender Name */}
              <div>
                <label
                  htmlFor="defaultFromName"
                  style={{
                    display: 'block',
                    marginBottom: '0.4rem',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                  }}
                >
                  Default Sender Name
                </label>
                <input
                  id="defaultFromName"
                  name="defaultFromName"
                  type="text"
                  className="gm-admin-input"
                  placeholder="e.g. GMHelper Notifications"
                  value={formData.defaultFromName ?? ''}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  maxLength={100}
                  data-testid="settings-from-name-input"
                />
                <p
                  className="gm-admin-muted"
                  style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}
                >
                  Display name used for outgoing messages when a template or campaign does not specify one.
                </p>
                {validationErrors.defaultFromName && (
                  <p
                    data-testid="settings-from-name-error"
                    style={{ margin: '0.35rem 0 0', color: '#f87171', fontSize: '0.85rem' }}
                  >
                    {validationErrors.defaultFromName}
                  </p>
                )}
              </div>

              {/* Reply-To Email */}
              <div>
                <label
                  htmlFor="replyToEmail"
                  style={{
                    display: 'block',
                    marginBottom: '0.4rem',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                  }}
                >
                  Reply-To Email
                </label>
                <input
                  id="replyToEmail"
                  name="replyToEmail"
                  type="email"
                  className="gm-admin-input"
                  placeholder="e.g. support@gmhelper.com"
                  value={formData.replyToEmail ?? ''}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  maxLength={255}
                  data-testid="settings-reply-to-input"
                />
                <p
                  className="gm-admin-muted"
                  style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}
                >
                  Address that recipients will reply to. Leave blank if not needed.
                </p>
                {validationErrors.replyToEmail && (
                  <p
                    data-testid="settings-reply-to-error"
                    style={{ margin: '0.35rem 0 0', color: '#f87171', fontSize: '0.85rem' }}
                  >
                    {validationErrors.replyToEmail}
                  </p>
                )}
              </div>

              {/* Default Locale */}
              <div>
                <label
                  htmlFor="defaultLocale"
                  style={{
                    display: 'block',
                    marginBottom: '0.4rem',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                  }}
                >
                  Default Locale
                </label>
                <select
                  id="defaultLocale"
                  name="defaultLocale"
                  className="gm-admin-select"
                  value={formData.defaultLocale ?? 'en'}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  data-testid="settings-locale-select"
                >
                  {SUPPORTED_LOCALES.map((loc) => (
                    <option key={loc.value} value={loc.value}>
                      {loc.label}
                    </option>
                  ))}
                </select>
                <p
                  className="gm-admin-muted"
                  style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}
                >
                  Fallback locale for notification content and template resolution.
                </p>
                {validationErrors.defaultLocale && (
                  <p
                    data-testid="settings-locale-error"
                    style={{ margin: '0.35rem 0 0', color: '#f87171', fontSize: '0.85rem' }}
                  >
                    {validationErrors.defaultLocale}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <button
                  type="button"
                  className="gm-admin-btn"
                  onClick={handleReset}
                  disabled={!isDirty || isSaving}
                  data-testid="settings-reset-btn"
                >
                  Reset Changes
                </button>
                <button
                  type="submit"
                  className="gm-admin-btn gm-admin-btn--primary"
                  disabled={!isDirty || !isFormValid || isSaving}
                  data-testid="settings-save-btn"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Infrastructure Notice Card */}
          <div
            className="gm-admin-card"
            data-testid="infrastructure-info-card"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              borderColor: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            <h2
              className="gm-admin-card__title"
              style={{ fontSize: '0.95rem', color: '#cbd5e1' }}
            >
              Infrastructure & Security Notice
            </h2>
            <p
              style={{
                margin: 0,
                color: '#94a3b8',
                fontSize: '0.88rem',
                lineHeight: 1.6,
              }}
            >
              SMTP network connectivity, authentication credentials, worker intervals, and JWT security keys are managed at service startup and cannot be altered from this control panel.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default SettingsPage
