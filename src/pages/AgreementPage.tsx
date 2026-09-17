import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import {
  agreementService,
  ApiError,
  campaignService,
  templateService,
} from '../services'
import type {
  Campaign,
  CreateAgreementBroadcastInput,
  EmailTemplate,
  PreviewTemplateRequest,
  PreviewTemplateResponse,
} from '../types'

interface ErrorInfo {
  type: 'unauthorized' | 'forbidden' | 'api' | 'network'
  message: string
}

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

function getStatusBadgeStyle(status: string) {
  const normalized = status.toLowerCase()
  switch (normalized) {
    case 'completed':
    case 'active':
      return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
    case 'sending':
      return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }
    case 'scheduled':
    case 'running':
      return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }
    case 'draft':
      return { background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }
    case 'partially_failed':
      return { background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' }
    case 'failed':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
    case 'cancelled':
    default:
      return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
  }
}

function AgreementPage() {
  const apiClient = useApiClient()

  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState<ErrorInfo | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // Form state
  const [campaignName, setCampaignName] = useState('')
  const [isCustomName, setIsCustomName] = useState(false)

  // Preview state
  const [previewData, setPreviewData] = useState<PreviewTemplateResponse | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Confirmation & submission state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Campaign progress tracking
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null)

  // 1. Load active templates
  const loadTemplates = useCallback(
    async (signal?: AbortSignal) => {
      setIsTemplatesLoading(true)
      setTemplatesError(null)

      try {
        const allTemplates = await templateService.getTemplates(apiClient, signal)
        const activeTemplates = (allTemplates ?? []).filter(
          (t) => t.status?.toLowerCase() === 'active'
        )
        setTemplates(activeTemplates)
      } catch (err) {
        if (signal?.aborted) {
          return
        }

        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.statusCode === 401) {
            setTemplatesError({
              type: 'unauthorized',
              message: 'Unauthorized (401): Please verify your authentication.',
            })
          } else if (err.isForbidden || err.statusCode === 403) {
            setTemplatesError({
              type: 'forbidden',
              message: 'Forbidden (403): You do not have permission to access templates.',
            })
          } else {
            setTemplatesError({
              type: 'api',
              message: err.message || 'Failed to load templates.',
            })
          }
        } else {
          const msg =
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while loading templates.'
          setTemplatesError({
            type: 'network',
            message: msg,
          })
        }
      } finally {
        if (!signal?.aborted) {
          setIsTemplatesLoading(false)
        }
      }
    },
    [apiClient]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadTemplates(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadTemplates])

  // Selected template object
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  // 2. Fetch preview when selected template changes
  useEffect(() => {
    if (!selectedTemplate) {
      setPreviewData(null)
      setPreviewError(null)
      setIsPreviewLoading(false)
      return
    }

    // Auto-populate default campaign name if user hasn't customized it
    if (!isCustomName || !campaignName.trim()) {
      setCampaignName(`User Agreement - ${selectedTemplate.name}`)
    }

    const controller = new AbortController()
    setIsPreviewLoading(true)
    setPreviewError(null)

    const timer = setTimeout(async () => {
      try {
        const previewReq: PreviewTemplateRequest = {
          subject: selectedTemplate.subject,
          htmlBody: selectedTemplate.htmlBody,
          plainTextBody: selectedTemplate.plainTextBody,
          variables: {},
        }
        const rendered = await templateService.previewTemplate(
          selectedTemplate.id,
          previewReq,
          apiClient,
          controller.signal
        )
        if (!controller.signal.aborted) {
          setPreviewData(rendered)
          setPreviewError(null)
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }
        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.statusCode === 401) {
            setPreviewError('Unauthorized (401): Session expired or invalid.')
          } else if (err.isForbidden || err.statusCode === 403) {
            setPreviewError('Forbidden (403): You do not have permission to preview templates.')
          } else {
            setPreviewError(err.message || 'Failed to generate template preview.')
          }
        } else {
          const msg =
            err instanceof Error
              ? err.message
              : 'Network error occurred while generating template preview.'
          setPreviewError(msg)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPreviewLoading(false)
        }
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [selectedTemplate, apiClient, isCustomName, campaignName])

  // 3. Conservative campaign status polling
  useEffect(() => {
    if (!createdCampaign?.id) {
      return
    }

    const terminalStatuses = ['completed', 'failed', 'cancelled', 'partially_failed']
    const isTerminal = terminalStatuses.includes(createdCampaign.status?.toLowerCase())

    if (isTerminal) {
      return
    }

    const controller = new AbortController()
    const intervalId = setInterval(async () => {
      try {
        const updated = await campaignService.getCampaign(
          createdCampaign.id,
          apiClient,
          controller.signal
        )
        if (!controller.signal.aborted && updated) {
          setCreatedCampaign(updated)
        }
      } catch {
        // Polling error silently ignored until next tick
      }
    }, 2500)

    return () => {
      clearInterval(intervalId)
      controller.abort()
    }
  }, [createdCampaign?.id, createdCampaign?.status, apiClient])

  // Handlers
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value
    setSelectedTemplateId(newId)
    setSubmitError(null)
    if (!newId) {
      setCampaignName('')
      setIsCustomName(false)
      setPreviewData(null)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCampaignName(e.target.value)
    setIsCustomName(true)
  }

  const openConfirmation = () => {
    if (!selectedTemplateId || isSubmitting) return
    setSubmitError(null)
    setIsConfirmModalOpen(true)
  }

  const closeConfirmation = () => {
    if (isSubmitting) return
    setIsConfirmModalOpen(false)
  }

  const handleConfirmSend = async () => {
    if (!selectedTemplateId || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload: CreateAgreementBroadcastInput = {
        templateId: selectedTemplateId,
        name: campaignName.trim() || undefined,
      }

      const campaign = await agreementService.createBroadcast(payload, apiClient)
      setCreatedCampaign(campaign)
      setIsConfirmModalOpen(false)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'CONFLICT') {
          setSubmitError('Another User Agreement broadcast is already in progress.')
        } else if (err.isUnauthorized || err.statusCode === 401) {
          setSubmitError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setSubmitError('Forbidden (403): You do not have permission to broadcast agreements.')
        } else if (err.statusCode === 400 || err.statusCode === 404) {
          setSubmitError(
            'The selected template is no longer available or active. Please select another template.'
          )
        } else {
          setSubmitError(err.message || 'Failed to create User Agreement broadcast.')
        }
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'A network error occurred while creating the broadcast.'
        setSubmitError(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetForNewBroadcast = () => {
    setCreatedCampaign(null)
    setSelectedTemplateId('')
    setCampaignName('')
    setIsCustomName(false)
    setPreviewData(null)
    setSubmitError(null)
    void loadTemplates()
  }

  const isTerminalStatus =
    createdCampaign?.status &&
    ['completed', 'failed', 'cancelled', 'partially_failed'].includes(
      createdCampaign.status.toLowerCase()
    )

  return (
    <section className="gm-admin-page">
      {/* Header */}
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">User Agreement</h1>
          <p className="gm-admin-page__description">
            Broadcast mandatory policy updates or Terms of Service agreements to registered users.
          </p>
        </div>
      </div>

      {/* Template Loading Error */}
      {templatesError && (
        <div
          className="gm-admin-warning"
          role="alert"
          data-testid="templates-error-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <strong data-testid="error-title">
              {templatesError.type === 'unauthorized' && 'Unauthorized (401)'}
              {templatesError.type === 'forbidden' && 'Forbidden (403)'}
              {templatesError.type === 'api' && 'Template API Error'}
              {templatesError.type === 'network' && 'Connection Error'}
            </strong>
            <p style={{ margin: '0.25rem 0 0' }} data-testid="error-message">
              {templatesError.message}
            </p>
          </div>
          <button
            type="button"
            className="gm-admin-btn"
            onClick={() => void loadTemplates()}
            data-testid="retry-templates-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Campaign Status View (After broadcast creation) */}
      {createdCampaign ? (
        <div
          className="gm-admin-card"
          data-testid="agreement-status-card"
          style={{ maxWidth: '840px', width: '100%' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <h2 className="gm-admin-card__title" style={{ margin: 0, fontSize: '1.25rem' }}>
              Broadcast Campaign Status
            </h2>
            <span
              data-testid="campaign-status-badge"
              style={{
                display: 'inline-block',
                padding: '0.3rem 0.75rem',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                ...getStatusBadgeStyle(createdCampaign.status),
              }}
            >
              {createdCampaign.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '1rem',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <div className="gm-admin-muted" style={{ fontSize: '0.8rem' }}>
                Campaign Name
              </div>
              <div
                data-testid="status-campaign-name"
                style={{ fontWeight: 600, color: '#f8fafc' }}
              >
                {createdCampaign.name}
              </div>
            </div>

            <div>
              <div className="gm-admin-muted" style={{ fontSize: '0.8rem' }}>
                Campaign ID
              </div>
              <div
                data-testid="status-campaign-id"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#e2e8f0' }}
              >
                {createdCampaign.id}
              </div>
            </div>

            <div>
              <div className="gm-admin-muted" style={{ fontSize: '0.8rem' }}>
                Campaign Type
              </div>
              <div style={{ textTransform: 'capitalize', color: '#e2e8f0' }}>
                {createdCampaign.campaignType || 'user_agreement'}
              </div>
            </div>

            <div>
              <div className="gm-admin-muted" style={{ fontSize: '0.8rem' }}>
                Created At
              </div>
              <div style={{ color: '#e2e8f0' }}>{formatDateTime(createdCampaign.createdAt)}</div>
            </div>

            {createdCampaign.scheduledAt && (
              <div>
                <div className="gm-admin-muted" style={{ fontSize: '0.8rem' }}>
                  Scheduled At
                </div>
                <div style={{ color: '#c084fc', fontWeight: 600 }}>
                  {formatDateTime(createdCampaign.scheduledAt)}
                </div>
              </div>
            )}

            {createdCampaign.startedAt && (
              <div>
                <div className="gm-admin-muted" style={{ fontSize: '0.8rem' }}>
                  Started At
                </div>
                <div style={{ color: '#e2e8f0' }}>{formatDateTime(createdCampaign.startedAt)}</div>
              </div>
            )}

            {createdCampaign.completedAt && (
              <div>
                <div className="gm-admin-muted" style={{ fontSize: '0.8rem' }}>
                  Completed At
                </div>
                <div style={{ color: '#4ade80', fontWeight: 600 }}>
                  {formatDateTime(createdCampaign.completedAt)}
                </div>
              </div>
            )}
          </div>

          {/* Status notification banner */}
          {createdCampaign.status === 'completed' && (
            <div
              data-testid="status-completed-banner"
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#86efac',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1.25rem',
              }}
            >
              <strong>✓ Broadcast Completed</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                All eligible active and unblocked recipients have been processed by the delivery
                worker.
              </p>
            </div>
          )}

          {createdCampaign.status === 'failed' && (
            <div
              data-testid="status-failed-banner"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1.25rem',
              }}
            >
              <strong>✕ Broadcast Failed</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                The campaign broadcast encountered an error during delivery.
              </p>
            </div>
          )}

          {createdCampaign.status === 'partially_failed' && (
            <div
              data-testid="status-partially-failed-banner"
              style={{
                background: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                color: '#fdba74',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1.25rem',
              }}
            >
              <strong>⚠ Partially Failed</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                The broadcast finished, but some recipient delivery attempts failed.
              </p>
            </div>
          )}

          {createdCampaign.status === 'cancelled' && (
            <div
              data-testid="status-cancelled-banner"
              style={{
                background: 'rgba(148, 163, 184, 0.12)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                color: '#cbd5e1',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1.25rem',
              }}
            >
              <strong>Broadcast Cancelled</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                This campaign broadcast was cancelled.
              </p>
            </div>
          )}

          {!isTerminalStatus && (
            <div
              data-testid="status-in-progress-banner"
              style={{
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                color: '#e9d5ff',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#c084fc',
                  boxShadow: '0 0 8px #c084fc',
                }}
              />
              <div>
                <strong>Broadcast In Progress</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                  Audience population and recipient delivery are currently being processed. Status
                  updates automatically.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="gm-admin-btn gm-admin-btn--primary"
              onClick={handleResetForNewBroadcast}
              data-testid="new-broadcast-btn"
            >
              Start Another Broadcast
            </button>
          </div>
        </div>
      ) : (
        /* Configuration & Preview Layout */
        <div className="gm-admin-editor-layout">
          {/* Left Column: Configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Template Selection Card */}
            <div className="gm-admin-card">
              <h2 className="gm-admin-card__title">1. Select Email Template</h2>
              <p className="gm-admin-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Choose an active email template for this agreement broadcast.
              </p>

              {isTemplatesLoading ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                  Loading active templates...
                </div>
              ) : templates.length === 0 && !templatesError ? (
                <div
                  data-testid="no-templates-notice"
                  style={{
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: '#fca5a5',
                    fontSize: '0.9rem',
                  }}
                >
                  <strong>No active templates found.</strong>
                  <p style={{ margin: '0.35rem 0 0', color: '#cbd5e1' }}>
                    An active email template must be created in Email Templates before a User
                    Agreement broadcast can be sent.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <select
                    className="gm-admin-select"
                    value={selectedTemplateId}
                    onChange={handleTemplateChange}
                    disabled={isTemplatesLoading || isSubmitting}
                    data-testid="template-select"
                  >
                    <option value="">-- Select an active template --</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.templateKey})
                      </option>
                    ))}
                  </select>

                  {selectedTemplate && (
                    <div
                      data-testid="selected-template-details"
                      style={{
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '0.85rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <span className="gm-admin-muted">Template: </span>
                        <strong>{selectedTemplate.name}</strong>
                      </div>
                      <div>
                        <span className="gm-admin-muted">Key: </span>
                        <code style={{ color: '#c084fc' }}>{selectedTemplate.templateKey}</code>
                      </div>
                      <div>
                        <span className="gm-admin-muted">Locale: </span>
                        <span>{selectedTemplate.locale}</span>
                      </div>
                      <div>
                        <span className="gm-admin-muted">Subject: </span>
                        <span style={{ color: '#e2e8f0' }}>{selectedTemplate.subject}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Broadcast Details Card */}
            <div className="gm-admin-card">
              <h2 className="gm-admin-card__title">2. Broadcast Name (Optional)</h2>
              <p className="gm-admin-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Provide a descriptive name to easily identify this broadcast in campaign records.
              </p>

              <input
                className="gm-admin-input"
                placeholder="e.g. User Agreement - Terms of Service Update 2026"
                value={campaignName}
                onChange={handleNameChange}
                disabled={!selectedTemplateId || isSubmitting}
                data-testid="campaign-name-input"
              />
            </div>

            {/* Audience & Safety Warning Card */}
            <div className="gm-admin-warning" data-testid="safety-warning">
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>⚠</span> High-Impact Action
              </strong>
              <p style={{ margin: '0.5rem 0 0', lineHeight: 1.5, fontSize: '0.9rem' }}>
                This will create and schedule a broadcast targeting the audience selected by the
                campaign pipeline: <strong>active</strong>, <strong>unblocked</strong> users with an{' '}
                <strong>available email address</strong>.
              </p>
            </div>

            {/* Submit Error Display */}
            {submitError && (
              <div
                className="gm-admin-warning"
                role="alert"
                data-testid="submit-error"
                style={{
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                }}
              >
                <strong>Error: </strong>
                <span>{submitError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div>
              <button
                type="button"
                className="gm-admin-btn gm-admin-btn--primary"
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  fontSize: '1rem',
                  opacity: !selectedTemplateId || isTemplatesLoading || isSubmitting ? 0.5 : 1,
                  cursor:
                    !selectedTemplateId || isTemplatesLoading || isSubmitting
                      ? 'not-allowed'
                      : 'pointer',
                }}
                onClick={openConfirmation}
                disabled={!selectedTemplateId || isTemplatesLoading || isSubmitting}
                data-testid="send-agreement-btn"
              >
                Send User Agreement Broadcast
              </button>
            </div>
          </div>

          {/* Right Column: Live Template Preview */}
          <div
            className="gm-admin-card"
            data-testid="template-preview-card"
            style={{
              position: 'sticky',
              top: '1.5rem',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <h2 className="gm-admin-card__title" style={{ margin: 0 }}>
                Email Preview
              </h2>
              {isPreviewLoading && (
                <span
                  data-testid="preview-loading-indicator"
                  style={{
                    fontSize: '0.75rem',
                    color: '#c084fc',
                    background: 'rgba(192, 132, 252, 0.15)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  Loading preview...
                </span>
              )}
            </div>

            {previewError ? (
              <div className="gm-admin-warning" role="alert" data-testid="preview-error">
                {previewError}
              </div>
            ) : !selectedTemplate ? (
              <div
                className="gm-admin-empty"
                data-testid="preview-placeholder"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: 0, color: '#94a3b8' }}>
                  Select an active email template to preview its rendered contents.
                </p>
              </div>
            ) : previewData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div
                    className="gm-admin-muted"
                    style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}
                  >
                    Subject
                  </div>
                  <div
                    data-testid="preview-subject"
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '4px',
                      color: '#f8fafc',
                      fontWeight: 600,
                    }}
                  >
                    {previewData.subject}
                  </div>
                </div>

                <div>
                  <div
                    className="gm-admin-muted"
                    style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}
                  >
                    Rendered Body
                  </div>
                  <div
                    data-testid="preview-body-container"
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      borderRadius: '6px',
                      padding: '1.25rem',
                      maxHeight: '420px',
                      overflowY: 'auto',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                    dangerouslySetInnerHTML={{ __html: previewData.htmlBody }}
                  />
                </div>

                {previewData.plainTextBody && (
                  <div>
                    <div
                      className="gm-admin-muted"
                      style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}
                    >
                      Plain Text Body
                    </div>
                    <pre
                      data-testid="preview-plain-text"
                      style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        color: '#cbd5e1',
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        margin: 0,
                      }}
                    >
                      {previewData.plainTextBody}
                    </pre>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Confirmation Dialog / Modal */}
      {isConfirmModalOpen && (
        <div
          data-testid="confirm-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="gm-admin-card"
            data-testid="confirm-broadcast-modal"
            style={{
              maxWidth: '540px',
              width: '100%',
              borderColor: 'rgba(189, 0, 214, 0.5)',
              boxShadow: '0 0 30px rgba(189, 0, 214, 0.4)',
              background: '#1a1420',
            }}
          >
            <h2 className="gm-admin-card__title" style={{ fontSize: '1.25rem', color: '#f5d0fe' }}>
              Confirm User Agreement Broadcast
            </h2>

            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#fecaca',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                margin: '0.75rem 0 1rem',
                fontSize: '0.9rem',
              }}
            >
              <strong>⚠ High-Impact Action:</strong>
              <p style={{ margin: '0.25rem 0 0' }}>
                This broadcast will send emails to all active and unblocked users registered in the
                system.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '0.9rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <span className="gm-admin-muted">Selected Template: </span>
                <strong data-testid="modal-template-name">{selectedTemplate?.name}</strong> (
                <code style={{ color: '#c084fc' }}>{selectedTemplate?.templateKey}</code>)
              </div>
              <div>
                <span className="gm-admin-muted">Broadcast Name: </span>
                <strong data-testid="modal-campaign-name">
                  {campaignName.trim() || `User Agreement - ${selectedTemplate?.name}`}
                </strong>
              </div>
              <div>
                <span className="gm-admin-muted">Audience: </span>
                <span>Active & unblocked users with an available email address</span>
              </div>
            </div>

            {submitError && (
              <div
                className="gm-admin-warning"
                role="alert"
                data-testid="modal-submit-error"
                style={{
                  marginBottom: '1rem',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                }}
              >
                {submitError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="gm-admin-btn"
                onClick={closeConfirmation}
                disabled={isSubmitting}
                data-testid="cancel-modal-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="gm-admin-btn gm-admin-btn--primary"
                onClick={handleConfirmSend}
                disabled={isSubmitting}
                data-testid="confirm-send-btn"
              >
                {isSubmitting ? 'Sending...' : 'Confirm & Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default AgreementPage
