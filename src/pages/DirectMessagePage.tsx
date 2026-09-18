import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { ApiError, directService, templateService, userService } from '../services'
import type {
  CreateDirectNotificationInput,
  DirectNotification,
  EmailTemplate,
  UserSearchResult,
} from '../types'
import {
  buildNotificationPayload,
  categorizeVariables,
  extractTemplateVariables,
  filterTemplatesByType,
  isValidEmail,
  renderPreviewText,
} from '../utils'

export type RecipientMode = 'registered' | 'custom'

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return dateStr
    }
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getDeliveryStatusBadgeStyle(status: string) {
  const normalized = status.toLowerCase()
  switch (normalized) {
    case 'sent':
      return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
    case 'sending':
      return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }
    case 'pending':
      return { background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }
    case 'failed':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
    case 'cancelled':
    default:
      return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
  }
}

export function DirectMessagePage() {
  const client = useApiClient()

  // Template State
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Recipient Mode
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('registered')

  // Registered User State
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)

  // Custom Email State
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)

  // Template Variables State
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Confirmation & Submit State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Delivery Tracking & Result State
  const [notification, setNotification] = useState<DirectNotification | null>(null)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)
  const [pollingError, setPollingError] = useState<string | null>(null)

  // Debounce search timer ref
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Polling timer ref
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load active direct templates on mount
  useEffect(() => {
    let isMounted = true
    setTemplatesLoading(true)
    setTemplatesError(null)

    templateService
      .getTemplates(client)
      .then((data) => {
        if (!isMounted) return
        const directTemplates = filterTemplatesByType(data, 'direct', { onlyActive: true })
        setTemplates(directTemplates)
        setTemplatesLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        const message = err instanceof Error ? err.message : 'Failed to load templates'
        setTemplatesError(message)
        setTemplatesLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [client])

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      stopPolling()
    }
  }, [stopPolling])

  // Selected template object
  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null
  }, [templates, selectedTemplateId])

  // Extract variables from selected template
  const extractedVariables = useMemo(() => {
    if (!selectedTemplate) return []
    return extractTemplateVariables(
      selectedTemplate.subject,
      selectedTemplate.htmlBody,
      selectedTemplate.plainTextBody
    )
  }, [selectedTemplate])

  // Categorize variables into system & custom
  const isRegisteredUser = recipientMode === 'registered' && selectedUser !== null
  const { systemVariables, customVariables } = useMemo(() => {
    return categorizeVariables(extractedVariables, isRegisteredUser)
  }, [extractedVariables, isRegisteredUser])

  // Handle template selection change: recalculate required variables and prune obsolete ones
  const handleTemplateChange = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId)
      setValidationErrors((prev) => {
        const next = { ...prev }
        delete next.template
        return next
      })

      const newTemplate = templates.find((t) => t.id === templateId)
      if (!newTemplate) {
        setVariableValues({})
        return
      }

      const newVars = extractTemplateVariables(
        newTemplate.subject,
        newTemplate.htmlBody,
        newTemplate.plainTextBody
      )

      setVariableValues((prev) => {
        const next: Record<string, string> = {}
        for (const v of newVars) {
          if (prev[v] !== undefined) {
            next[v] = prev[v]
          }
        }
        return next
      })
    },
    [templates]
  )

  // Handle switching recipient mode: cleanly resets incompatible state
  const handleModeChange = useCallback((mode: RecipientMode) => {
    setRecipientMode(mode)
    setValidationErrors({})
    setSubmitError(null)
    if (mode === 'custom') {
      setSelectedUser(null)
      setSearchQuery('')
      setSearchResults([])
      setSearchError(null)
    } else {
      setCustomEmail('')
      setCustomName('')
      setEmailTouched(false)
    }
  }, [])

  // Debounced search for registered users
  useEffect(() => {
    if (recipientMode !== 'registered' || selectedUser !== null) {
      return
    }

    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults([])
      setSearchError(null)
      setSearching(false)
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    setSearching(true)
    setSearchError(null)

    searchTimeoutRef.current = setTimeout(() => {
      userService
        .searchUsers(trimmed, 10, client)
        .then((users) => {
          setSearchResults(users)
          setSearching(false)
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Failed to search users'
          setSearchError(message)
          setSearching(false)
        })
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, recipientMode, selectedUser, client])

  // Clear selected user
  const handleClearUser = useCallback(() => {
    setSelectedUser(null)
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
  }, [])

  // Update variable value
  const handleVariableChange = useCallback((varName: string, value: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [varName]: value,
    }))
    setValidationErrors((prev) => {
      if (!prev[varName]) return prev
      const next = { ...prev }
      delete next[varName]
      return next
    })
  }, [])

  // Email validation for custom mode
  const isEmailValid = useMemo(() => {
    if (recipientMode !== 'custom') return true
    return isValidEmail(customEmail)
  }, [recipientMode, customEmail])

  // Live preview variables scope
  const previewVariablesScope = useMemo(() => {
    const scope: Record<string, string> = {}
    if (recipientMode === 'registered' && selectedUser) {
      scope.username = selectedUser.username
      scope.email = selectedUser.email
      scope.role = selectedUser.role
      scope.language = selectedUser.language
    }
    for (const [k, v] of Object.entries(variableValues)) {
      if (v.trim() !== '') {
        scope[k] = v
      }
    }
    return scope
  }, [recipientMode, selectedUser, variableValues])

  // Rendered subject and body for preview & confirmation
  const renderedSubject = useMemo(() => {
    if (!selectedTemplate) return ''
    return renderPreviewText(selectedTemplate.subject, previewVariablesScope)
  }, [selectedTemplate, previewVariablesScope])

  const renderedHtmlBody = useMemo(() => {
    if (!selectedTemplate) return ''
    return renderPreviewText(selectedTemplate.htmlBody, previewVariablesScope)
  }, [selectedTemplate, previewVariablesScope])

  // Validate form before opening confirmation modal
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    // 1. Template validation
    if (!selectedTemplateId || !selectedTemplate) {
      errors.template = 'Please select an email template.'
    }

    // 2. Recipient validation
    if (recipientMode === 'registered') {
      if (!selectedUser) {
        errors.recipient = 'Please select a registered user.'
      } else if (!selectedUser.email || !isValidEmail(selectedUser.email)) {
        errors.recipient = 'The selected user does not have a valid email address.'
      }
    } else {
      if (!customEmail.trim()) {
        errors.recipient = 'Recipient email address is required.'
      } else if (!isValidEmail(customEmail)) {
        errors.recipient = 'Please enter a valid recipient email address.'
      }
    }

    // 3. Variables validation
    for (const varName of customVariables) {
      const val = variableValues[varName]
      if (!val || val.trim() === '') {
        errors[varName] = `Variable {{${varName}}} is required.`
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [
    selectedTemplateId,
    selectedTemplate,
    recipientMode,
    selectedUser,
    customEmail,
    customVariables,
    variableValues,
  ])

  // Open confirmation modal
  const handleOpenConfirmation = useCallback(() => {
    setSubmitError(null)
    if (validateForm()) {
      setIsConfirmModalOpen(true)
    }
  }, [validateForm])

  // Polling helper
  const pollStatus = useCallback(
    async (id: string, attemptCount = 0) => {
      if (attemptCount >= 30) {
        stopPolling()
        return
      }

      try {
        const updated = await directService.getNotification(id, client)
        setNotification(updated)
        setPollingError(null)

        const status = updated.deliveryStatus?.toLowerCase()
        if (status === 'sent' || status === 'failed' || status === 'cancelled') {
          stopPolling()
          return
        }

        pollingTimeoutRef.current = setTimeout(() => {
          pollStatus(id, attemptCount + 1)
        }, 1500)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to refresh delivery status'
        setPollingError(`Unable to refresh delivery status: ${msg}`)
      }
    },
    [client, stopPolling]
  )

  const startPolling = useCallback(
    (id: string) => {
      stopPolling()
      pollingTimeoutRef.current = setTimeout(() => {
        pollStatus(id, 0)
      }, 1500)
    },
    [pollStatus, stopPolling]
  )

  // Confirm Send: Create notification -> Immediately deliver -> Poll status
  const handleConfirmSend = useCallback(async () => {
    if (!selectedTemplate) return
    setIsSubmitting(true)
    setSubmitError(null)
    setDeliveryError(null)
    setPollingError(null)

    const payload = buildNotificationPayload(customVariables, variableValues)

    const input: CreateDirectNotificationInput =
      recipientMode === 'registered' && selectedUser
        ? {
            templateId: selectedTemplate.id,
            externalUserId: selectedUser.id,
            recipientEmail: selectedUser.email,
            recipientName: selectedUser.username,
            notificationType: 'direct',
            payload,
          }
        : {
            templateId: selectedTemplate.id,
            recipientEmail: customEmail.trim(),
            recipientName: customName.trim() || undefined,
            notificationType: 'direct',
            payload,
          }

    let createdNotif: DirectNotification
    try {
      createdNotif = await directService.createNotification(input, client)
      setNotification(createdNotif)
      setIsConfirmModalOpen(false)
    } catch (err) {
      setIsSubmitting(false)
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to create direct notification'
      setSubmitError(message)
      return
    }

    // 2. Immediately call deliver
    try {
      const deliveredNotif = await directService.deliverNotification(createdNotif.id, client)
      setNotification(deliveredNotif)
      setIsSubmitting(false)

      const status = deliveredNotif.deliveryStatus?.toLowerCase()
      if (status === 'sent' || status === 'failed' || status === 'cancelled') {
        return
      }

      startPolling(deliveredNotif.id)
    } catch (err) {
      setIsSubmitting(false)
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to deliver notification'
      setDeliveryError(message)
    }
  }, [
    selectedTemplate,
    recipientMode,
    selectedUser,
    customEmail,
    customName,
    customVariables,
    variableValues,
    client,
    startPolling,
  ])

  // Retry delivery
  const handleRetryDelivery = useCallback(async () => {
    if (!notification) return
    setIsSubmitting(true)
    setDeliveryError(null)
    setPollingError(null)

    try {
      const delivered = await directService.deliverNotification(notification.id, client)
      setNotification(delivered)
      setIsSubmitting(false)

      const status = delivered.deliveryStatus?.toLowerCase()
      if (status === 'sent' || status === 'failed' || status === 'cancelled') {
        return
      }

      startPolling(delivered.id)
    } catch (err) {
      setIsSubmitting(false)
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to retry delivery'
      setDeliveryError(message)
    }
  }, [notification, client, startPolling])

  // Reset form to clean compose state
  const handleReset = useCallback(() => {
    stopPolling()
    setNotification(null)
    setSelectedTemplateId('')
    setRecipientMode('registered')
    setSelectedUser(null)
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
    setCustomEmail('')
    setCustomName('')
    setEmailTouched(false)
    setVariableValues({})
    setValidationErrors({})
    setSubmitError(null)
    setDeliveryError(null)
    setPollingError(null)
    setIsConfirmModalOpen(false)
    setIsSubmitting(false)
  }, [stopPolling])

  // Render Delivery Result View if notification exists
  if (notification) {
    const status = notification.deliveryStatus?.toLowerCase()
    const isSent = status === 'sent'
    const isFailed = status === 'failed' || deliveryError !== null
    const isPendingOrSending = !isSent && !isFailed

    return (
      <section className="gm-admin-page">
        <div className="gm-admin-page__header">
          <div>
            <h1 className="gm-admin-page__title">Direct Message Delivery</h1>
            <p className="gm-admin-page__description">
              Real-time delivery status and execution tracking for this notification.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Result Status Card */}
          <div className="gm-admin-card" data-testid="delivery-result-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 className="gm-admin-card__title" style={{ margin: 0 }}>
                Delivery Status
              </h2>
              <span
                style={{
                  ...getDeliveryStatusBadgeStyle(notification.deliveryStatus),
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                }}
              >
                {notification.deliveryStatus}
              </span>
            </div>

            {/* Success State Banner */}
            {isSent && (
              <div
                data-testid="delivery-success-banner"
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#4ade80',
                  marginBottom: '1rem',
                  fontWeight: 500,
                }}
              >
                Message delivered successfully to {notification.recipientEmail}.
              </div>
            )}

            {/* Failure State Banner */}
            {isFailed && (
              <div
                data-testid="delivery-failure-banner"
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontWeight: 500,
                }}
              >
                Delivery failed: {deliveryError || notification.errorMessage || 'An error occurred during SMTP transmission.'}
              </div>
            )}

            {/* Pending / Sending State Banner */}
            {isPendingOrSending && (
              <div
                data-testid="delivery-progress-banner"
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span>Delivery in progress... Status: <strong>{notification.deliveryStatus}</strong></span>
              </div>
            )}

            {/* Polling Error Notice */}
            {pollingError && (
              <div style={{ color: '#fb923c', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {pollingError}
              </div>
            )}

            {/* Notification Details Table */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.75rem', fontSize: '0.95rem' }}>
              <div style={{ color: '#94a3b8' }}>Notification ID:</div>
              <div><code>{notification.id}</code></div>

              <div style={{ color: '#94a3b8' }}>Recipient:</div>
              <div>
                {notification.recipientName ? `${notification.recipientName} ` : ''}
                &lt;{notification.recipientEmail}&gt;
              </div>

              <div style={{ color: '#94a3b8' }}>Template:</div>
              <div>{selectedTemplate?.name || notification.templateId}</div>

              <div style={{ color: '#94a3b8' }}>Attempts Count:</div>
              <div>{notification.attemptsCount}</div>

              <div style={{ color: '#94a3b8' }}>Created At:</div>
              <div>{formatDateTime(notification.createdAt)}</div>

              {notification.sentAt && (
                <>
                  <div style={{ color: '#94a3b8' }}>Sent At:</div>
                  <div>{formatDateTime(notification.sentAt)}</div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {isFailed && (
                <button
                  type="button"
                  className="gm-admin-btn gm-admin-btn--primary"
                  onClick={handleRetryDelivery}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Retrying...' : 'Retry Delivery'}
                </button>
              )}

              <button
                type="button"
                className="gm-admin-btn gm-admin-btn--secondary"
                onClick={handleReset}
              >
                Send Another Message
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // Render Composition Form View
  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Direct Message</h1>
          <p className="gm-admin-page__description">
            Send an individual email to a registered platform user or arbitrary email recipient.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Submit / API Error Banner */}
        {submitError && (
          <div
            data-testid="submit-error-banner"
            style={{
              padding: '1rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontWeight: 500,
            }}
          >
            {submitError}
          </div>
        )}

        {/* 1. Email Template Selector Card */}
        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">1. Email Template</h2>
          {templatesLoading ? (
            <div style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>Loading active templates...</div>
          ) : templatesError ? (
            <div style={{ color: '#f87171', fontSize: '0.95rem' }}>{templatesError}</div>
          ) : (
            <div>
              <select
                className="gm-admin-select"
                aria-label="Email template"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                <option value="">-- Select a template --</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.locale})
                  </option>
                ))}
              </select>
              {validationErrors.template && (
                <div style={{ marginTop: '0.35rem', color: '#f87171', fontSize: '0.85rem' }}>
                  {validationErrors.template}
                </div>
              )}
              {selectedTemplate && (
                <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                  <strong>Subject template:</strong> {selectedTemplate.subject}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Recipient Selection Card */}
        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">2. Recipient</h2>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              type="button"
              className={`gm-admin-btn ${
                recipientMode === 'registered' ? 'gm-admin-btn--primary' : 'gm-admin-btn--secondary'
              }`}
              onClick={() => handleModeChange('registered')}
              aria-pressed={recipientMode === 'registered'}
            >
              Registered User
            </button>
            <button
              type="button"
              className={`gm-admin-btn ${
                recipientMode === 'custom' ? 'gm-admin-btn--primary' : 'gm-admin-btn--secondary'
              }`}
              onClick={() => handleModeChange('custom')}
              aria-pressed={recipientMode === 'custom'}
            >
              Custom Email
            </button>
          </div>

          {/* Registered User Mode */}
          {recipientMode === 'registered' && (
            <div>
              {selectedUser ? (
                <div
                  data-testid="selected-user-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        width: '2.8rem',
                        height: '2.8rem',
                        borderRadius: '999px',
                        background: '#b000d6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: '#ffffff',
                      }}
                    >
                      {selectedUser.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>
                        {selectedUser.username}
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: selectedUser.isBlocked
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(34, 197, 94, 0.2)',
                            color: selectedUser.isBlocked ? '#f87171' : '#4ade80',
                          }}
                        >
                          {selectedUser.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
                        {selectedUser.email} &bull; Role: {selectedUser.role} &bull; Language:{' '}
                        {selectedUser.language}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gm-admin-btn gm-admin-btn--secondary"
                    onClick={handleClearUser}
                    aria-label="Clear selected user"
                  >
                    Change User
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    className="gm-admin-input"
                    placeholder="Search by email or username..."
                    aria-label="Search users"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  {validationErrors.recipient && (
                    <div style={{ marginTop: '0.35rem', color: '#f87171', fontSize: '0.85rem' }}>
                      {validationErrors.recipient}
                    </div>
                  )}

                  {searching && (
                    <div style={{ marginTop: '0.75rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                      Searching users...
                    </div>
                  )}

                  {searchError && (
                    <div style={{ marginTop: '0.75rem', color: '#f87171', fontSize: '0.9rem' }}>
                      {searchError}
                    </div>
                  )}

                  {!searching &&
                    !searchError &&
                    searchQuery.trim() !== '' &&
                    searchResults.length === 0 && (
                      <div style={{ marginTop: '0.75rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                        No users found matching &quot;{searchQuery}&quot;.
                      </div>
                    )}

                  {searchResults.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        maxHeight: '240px',
                        overflowY: 'auto',
                      }}
                    >
                      {searchResults.map((u) => (
                        <div
                          key={u.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.username}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                              {u.email} &bull; {u.role} ({u.language})
                            </div>
                          </div>
                          <button
                            type="button"
                            className="gm-admin-btn gm-admin-btn--primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                            onClick={() => {
                              setSelectedUser(u)
                              setValidationErrors((prev) => {
                                const next = { ...prev }
                                delete next.recipient
                                return next
                              })
                            }}
                            aria-label={`Select user ${u.username}`}
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Custom Email Mode */}
          {recipientMode === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label
                  htmlFor="custom-email-input"
                  style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem', color: '#cbd5e1' }}
                >
                  Recipient Email *
                </label>
                <input
                  id="custom-email-input"
                  type="email"
                  className="gm-admin-input"
                  placeholder="recipient@example.com"
                  value={customEmail}
                  onChange={(e) => {
                    setCustomEmail(e.target.value)
                    setValidationErrors((prev) => {
                      const next = { ...prev }
                      delete next.recipient
                      return next
                    })
                  }}
                  onBlur={() => setEmailTouched(true)}
                  aria-invalid={(emailTouched && !isEmailValid) || Boolean(validationErrors.recipient)}
                />
                {((emailTouched && !isEmailValid) || validationErrors.recipient) && (
                  <div style={{ marginTop: '0.25rem', color: '#f87171', fontSize: '0.85rem' }}>
                    {validationErrors.recipient || 'Please enter a valid email address.'}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="custom-name-input"
                  style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem', color: '#cbd5e1' }}
                >
                  Recipient Name (Optional)
                </label>
                <input
                  id="custom-name-input"
                  type="text"
                  className="gm-admin-input"
                  placeholder="e.g. Jane Smith"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Template Variables Card */}
        {selectedTemplate && (
          <div className="gm-admin-card">
            <h2 className="gm-admin-card__title">3. Template Variables</h2>

            {extractedVariables.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                This template has no dynamic placeholders.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* System Variables Callout for Registered Users */}
                {systemVariables.length > 0 && (
                  <div
                    data-testid="system-variables-callout"
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: '#7dd3fc',
                      fontSize: '0.875rem',
                    }}
                  >
                    <strong>Auto-resolved from user context:</strong>{' '}
                    {systemVariables.map((v) => `{{${v}}}`).join(', ')}
                  </div>
                )}

                {/* Custom Variables Inputs */}
                {customVariables.length > 0 ? (
                  customVariables.map((varName) => (
                    <div key={varName}>
                      <label
                        htmlFor={`var-${varName}`}
                        style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          marginBottom: '0.25rem',
                          color: '#e2e8f0',
                        }}
                      >
                        <code>{`{{${varName}}}`}</code> *
                      </label>
                      <input
                        id={`var-${varName}`}
                        type="text"
                        className="gm-admin-input"
                        placeholder={`Enter value for {{${varName}}}`}
                        value={variableValues[varName] || ''}
                        onChange={(e) => handleVariableChange(varName, e.target.value)}
                        aria-invalid={Boolean(validationErrors[varName])}
                      />
                      {validationErrors[varName] && (
                        <div style={{ marginTop: '0.25rem', color: '#f87171', fontSize: '0.85rem' }}>
                          {validationErrors[varName]}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                    All template variables are automatically resolved.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Live Preview Card */}
        {selectedTemplate && (
          <div className="gm-admin-card" data-testid="live-preview-card">
            <h2 className="gm-admin-card__title">4. Live Preview</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                  Rendered Subject:
                </div>
                <div
                  data-testid="preview-subject"
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: 600,
                  }}
                >
                  {renderedSubject || '(No subject)'}
                </div>
              </div>

              <div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                  Rendered HTML Body:
                </div>
                <div
                  data-testid="preview-body"
                  style={{
                    padding: '1rem',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    minHeight: '100px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderedHtmlBody }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <div>
          <button
            type="button"
            className="gm-admin-btn gm-admin-btn--primary"
            onClick={handleOpenConfirmation}
          >
            Send Direct Message
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div
          data-testid="confirmation-modal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="gm-admin-card"
            style={{
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h2 className="gm-admin-card__title" style={{ fontSize: '1.25rem' }}>
              Confirm Direct Message Send
            </h2>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '0 0 1rem 0' }}>
              Are you sure you want to send this email? It will be delivered immediately to the recipient via SMTP.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.875rem',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.04)',
                marginBottom: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <div>
                <strong style={{ color: '#94a3b8' }}>Recipient:</strong>{' '}
                {recipientMode === 'registered' && selectedUser
                  ? `${selectedUser.username} (${selectedUser.email})`
                  : `${customName ? customName + ' ' : ''}<${customEmail}>`}
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Template:</strong> {selectedTemplate?.name} (
                {selectedTemplate?.locale})
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Subject:</strong> {renderedSubject}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="gm-admin-btn gm-admin-btn--secondary"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="gm-admin-btn gm-admin-btn--primary"
                onClick={handleConfirmSend}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default DirectMessagePage
