import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { ApiError, campaignService, templateService } from '../services'
import type { Campaign, EmailTemplate } from '../types'
import { filterTemplatesByType } from '../utils'

interface ErrorInfo {
  type: 'unauthorized' | 'forbidden' | 'api' | 'network'
  message: string
}

interface CampaignFormState {
  name: string
  subject: string
  templateId: string
  campaignType: string
  roleFilter: string
  registrationDateFilter: string
  emailConfirmedFilter: string
  languageFilter: string
  accountStatusFilter: string
}

const initialFormState: CampaignFormState = {
  name: '',
  subject: '',
  templateId: '',
  campaignType: 'broadcast',
  roleFilter: 'All roles',
  registrationDateFilter: 'Any date',
  emailConfirmedFilter: 'Any',
  languageFilter: 'All',
  accountStatusFilter: 'Active',
}

const filterOptions = [
  { name: 'roleFilter', label: 'User role', value: 'All roles' },
  { name: 'registrationDateFilter', label: 'Registration date', value: 'Any date' },
  { name: 'emailConfirmedFilter', label: 'Email confirmed', value: 'Any' },
  { name: 'languageFilter', label: 'Language', value: 'All' },
  { name: 'accountStatusFilter', label: 'Account status', value: 'Active' },
]

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return dateStr
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }
    case 'draft':
      return { background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }
    case 'partially_failed':
    case 'failed':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
    case 'cancelled':
    default:
      return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
  }
}

function CampaignsPage() {
  const apiClient = useApiClient()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ErrorInfo | null>(null)

  // Composer / Form state
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(false)
  const [formData, setFormData] = useState<CampaignFormState>(initialFormState)
  const [formValidationErrors, setFormValidationErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete state
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Schedule state
  const [campaignToSchedule, setCampaignToSchedule] = useState<Campaign | null>(null)
  const [scheduleDateTime, setScheduleDateTime] = useState('')
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [isScheduling, setIsScheduling] = useState(false)

  // Cancel state
  const [campaignToCancel, setCampaignToCancel] = useState<Campaign | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const loadCampaigns = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await campaignService.getCampaigns(apiClient, signal)
      setCampaigns(data ?? [])
    } catch (err) {
      if (signal?.aborted) {
        return
      }

      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setError({
            type: 'unauthorized',
            message: 'You do not have access to campaigns. Please verify your authentication.',
          })
        } else if (err.isForbidden || err.statusCode === 403) {
          setError({
            type: 'forbidden',
            message: 'You do not have permission to access campaigns.',
          })
        } else {
          setError({
            type: 'api',
            message: err.message || 'Failed to load campaigns.',
          })
        }
      } else {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred while loading campaigns.'
        setError({
          type: 'network',
          message,
        })
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [apiClient])

  const loadTemplates = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await templateService.getTemplates(apiClient, signal)
      const campaignTemplates = filterTemplatesByType(data, 'campaign')
      setTemplates(campaignTemplates)
    } catch {
      // Non-blocking template loading
    }
  }, [apiClient])

  useEffect(() => {
    const controller = new AbortController()
    void loadCampaigns(controller.signal)
    void loadTemplates(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadCampaigns, loadTemplates])

  const toggleComposer = () => {
    if (isSubmitting || isLoadingCampaign) return
    if (isComposerOpen) {
      setIsComposerOpen(false)
      setEditingCampaignId(null)
      setFormData(initialFormState)
      setFormValidationErrors({})
      setFormError(null)
    } else {
      setEditingCampaignId(null)
      setFormData(initialFormState)
      setFormValidationErrors({})
      setFormError(null)
      setIsComposerOpen(true)
    }
  }

  const handleOpenEdit = async (campaign: Campaign) => {
    if (isSubmitting || isLoadingCampaign) return
    setIsComposerOpen(true)
    setEditingCampaignId(campaign.id)
    setFormError(null)
    setFormValidationErrors({})

    const matchingTpl = templates.find((t) => t.id === campaign.templateId)

    // Populate immediate values
    setFormData({
      name: campaign.name || '',
      subject: matchingTpl ? matchingTpl.subject : '',
      templateId: campaign.templateId || '',
      campaignType: campaign.campaignType || 'broadcast',
      roleFilter: 'All roles',
      registrationDateFilter: 'Any date',
      emailConfirmedFilter: 'Any',
      languageFilter: 'All',
      accountStatusFilter: 'Active',
    })

    // Load fresh details by ID
    setIsLoadingCampaign(true)
    try {
      const freshCampaign = await campaignService.getCampaign(campaign.id, apiClient)
      const freshMatchingTpl = templates.find((t) => t.id === freshCampaign.templateId)
      setFormData((prev) => ({
        ...prev,
        name: freshCampaign.name || prev.name,
        templateId: freshCampaign.templateId || prev.templateId,
        campaignType: freshCampaign.campaignType || prev.campaignType,
        subject: freshMatchingTpl ? freshMatchingTpl.subject : prev.subject,
      }))
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setFormError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setFormError('Forbidden (403): You do not have permission to view this campaign.')
        } else {
          setFormError(err.message || 'Failed to load campaign details.')
        }
      } else {
        setFormError('An unexpected error occurred while loading campaign details.')
      }
    } finally {
      setIsLoadingCampaign(false)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const selectedTpl = templates.find((t) => t.id === templateId)
    setFormData((prev) => ({
      ...prev,
      templateId,
      subject: selectedTpl ? selectedTpl.subject : prev.subject,
    }))
    if (formValidationErrors.templateId) {
      setFormValidationErrors((prev) => {
        const next = { ...prev }
        delete next.templateId
        return next
      })
    }
  }

  const handleInputChange = (field: keyof CampaignFormState, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (formValidationErrors[field]) {
      setFormValidationErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) {
      errors.name = 'Campaign name is required'
    }
    if (!formData.templateId.trim()) {
      errors.templateId = 'Please select an email template'
    }
    setFormValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting || isLoadingCampaign) return
    if (!validateForm()) return

    setIsSubmitting(true)
    setFormError(null)

    try {
      if (editingCampaignId) {
        await campaignService.updateCampaign(
          editingCampaignId,
          {
            name: formData.name.trim(),
            templateId: formData.templateId.trim(),
            campaignType: formData.campaignType || 'broadcast',
          },
          apiClient
        )
      } else {
        await campaignService.createCampaign(
          {
            name: formData.name.trim(),
            templateId: formData.templateId.trim(),
            campaignType: formData.campaignType || 'broadcast',
            status: 'draft',
          },
          apiClient
        )
      }

      // Successful submit: reset & close composer, then refresh campaign list
      setFormData(initialFormState)
      setFormValidationErrors({})
      setEditingCampaignId(null)
      setIsComposerOpen(false)
      await loadCampaigns()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setFormError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setFormError(
            editingCampaignId
              ? 'Forbidden (403): You do not have permission to modify campaigns.'
              : 'Forbidden (403): You do not have permission to create campaigns.'
          )
        } else if (err.statusCode === 400) {
          setFormError(`Validation error: ${err.message}`)
        } else {
          setFormError(
            err.message ||
              (editingCampaignId
                ? 'Failed to update campaign. Please try again.'
                : 'Failed to create campaign. Please try again.')
          )
        }
      } else {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred while saving the campaign.'
        setFormError(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const promptDelete = (campaign: Campaign) => {
    setCampaignToDelete(campaign)
    setDeleteError(null)
  }

  const cancelDelete = () => {
    if (isDeleting) return
    setCampaignToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!campaignToDelete || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await campaignService.deleteCampaign(campaignToDelete.id, apiClient)
      if (editingCampaignId === campaignToDelete.id) {
        setIsComposerOpen(false)
        setEditingCampaignId(null)
        setFormData(initialFormState)
        setFormValidationErrors({})
        setFormError(null)
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignToDelete.id))
      setCampaignToDelete(null)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setDeleteError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setDeleteError('Forbidden (403): You do not have permission to delete campaigns.')
        } else if (err.statusCode === 404) {
          setDeleteError('Campaign not found. It may have already been deleted.')
          setCampaigns((prev) => prev.filter((c) => c.id !== campaignToDelete.id))
        } else {
          setDeleteError(err.message || 'Failed to delete campaign.')
        }
      } else {
        setDeleteError('Network error occurred while deleting the campaign.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const promptSchedule = (campaign: Campaign) => {
    setCampaignToSchedule(campaign)
    setScheduleError(null)
    setScheduleDateTime('')
  }

  const closeScheduleModal = () => {
    if (isScheduling) return
    setCampaignToSchedule(null)
    setScheduleError(null)
    setScheduleDateTime('')
  }

  const confirmSchedule = async () => {
    if (!campaignToSchedule || isScheduling) return

    if (!scheduleDateTime.trim()) {
      setScheduleError('Scheduled date and time is required.')
      return
    }

    const selectedDate = new Date(scheduleDateTime)
    if (isNaN(selectedDate.getTime())) {
      setScheduleError('Invalid scheduled date and time.')
      return
    }

    if (selectedDate.getTime() <= Date.now()) {
      setScheduleError('Scheduled date and time must be in the future.')
      return
    }

    setIsScheduling(true)
    setScheduleError(null)

    try {
      const utcIsoString = selectedDate.toISOString()
      const updatedCampaign = await campaignService.scheduleCampaign(
        campaignToSchedule.id,
        utcIsoString,
        apiClient
      )

      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignToSchedule.id ? updatedCampaign : c))
      )
      setCampaignToSchedule(null)
      setScheduleDateTime('')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setScheduleError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setScheduleError('Forbidden (403): You do not have permission to schedule campaigns.')
        } else if (err.statusCode === 400) {
          setScheduleError(err.message || 'Invalid schedule time. Must be in the future.')
        } else {
          setScheduleError(err.message || 'Failed to schedule campaign.')
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Network error occurred while scheduling the campaign.'
        setScheduleError(msg)
      }
    } finally {
      setIsScheduling(false)
    }
  }

  const promptCancel = (campaign: Campaign) => {
    setCampaignToCancel(campaign)
    setCancelError(null)
  }

  const closeCancelModal = () => {
    if (isCancelling) return
    setCampaignToCancel(null)
    setCancelError(null)
  }

  const confirmCancel = async () => {
    if (!campaignToCancel || isCancelling) return

    setIsCancelling(true)
    setCancelError(null)

    try {
      const updatedCampaign = await campaignService.cancelCampaign(campaignToCancel.id, apiClient)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignToCancel.id ? updatedCampaign : c))
      )
      setCampaignToCancel(null)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setCancelError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setCancelError('Forbidden (403): You do not have permission to cancel campaigns.')
        } else if (err.statusCode === 400) {
          setCancelError(err.message || 'Only scheduled campaigns can be cancelled.')
        } else {
          setCancelError(err.message || 'Failed to cancel campaign.')
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Network error occurred while cancelling the campaign.'
        setCancelError(msg)
      }
    } finally {
      setIsCancelling(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === formData.templateId)

  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Campaigns</h1>
          <p className="gm-admin-page__description">
            Manage your message campaigns and send announcements to targeted audiences.
          </p>
        </div>

        <button
          type="button"
          className="gm-admin-btn gm-admin-btn--primary"
          onClick={toggleComposer}
          disabled={isSubmitting || isLoadingCampaign}
        >
          {isComposerOpen ? 'Close Composer' : 'New Campaign'}
        </button>
      </div>

      {/* Error alert states */}
      {error && (
        <div
          className="gm-admin-warning"
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            borderColor:
              error.type === 'forbidden'
                ? 'rgba(234, 179, 8, 0.4)'
                : error.type === 'unauthorized'
                  ? 'rgba(248, 113, 113, 0.4)'
                  : 'rgba(255, 0, 0, 0.2)',
            background:
              error.type === 'forbidden'
                ? 'rgba(234, 179, 8, 0.12)'
                : error.type === 'unauthorized'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(255, 0, 0, 0.12)',
            color: error.type === 'forbidden' ? '#fef08a' : '#ffd3d3',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <strong data-testid="error-title">
              {error.type === 'unauthorized' && 'Unauthorized (401)'}
              {error.type === 'forbidden' && 'Forbidden (403)'}
              {error.type === 'api' && 'Campaign API Error'}
              {error.type === 'network' && 'Connection Error'}
            </strong>
            <span data-testid="error-message">{error.message}</span>
          </div>

          <button
            type="button"
            className="gm-admin-btn"
            onClick={() => void loadCampaigns()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal / Prompt */}
      {campaignToDelete && (
        <div
          className="gm-admin-card"
          data-testid="delete-confirmation-card"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            background: 'rgba(26, 17, 23, 0.95)',
            marginBottom: '1rem',
          }}
        >
          <h2 className="gm-admin-card__title" style={{ color: '#fca5a5' }}>
            Confirm Delete
          </h2>
          <p style={{ color: '#e2e8f0', margin: '0.5rem 0 1rem', lineHeight: 1.6 }}>
            Are you sure you want to delete campaign <strong>{campaignToDelete.name}</strong>? This action cannot be undone.
          </p>

          {deleteError && (
            <div className="gm-admin-warning" role="alert" data-testid="delete-error" style={{ marginBottom: '1rem' }}>
              {deleteError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="gm-admin-btn"
              onClick={cancelDelete}
              disabled={isDeleting}
              data-testid="cancel-delete-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              className="gm-admin-btn"
              style={{
                background: '#dc2626',
                borderColor: '#ef4444',
                color: '#ffffff',
                opacity: isDeleting ? 0.7 : 1,
              }}
              onClick={() => void confirmDelete()}
              disabled={isDeleting}
              data-testid="confirm-delete-btn"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Schedule Campaign Modal / Prompt */}
      {campaignToSchedule && (
        <div
          className="gm-admin-card"
          data-testid="schedule-modal-card"
          style={{
            borderColor: 'rgba(168, 85, 247, 0.4)',
            background: 'rgba(26, 17, 33, 0.95)',
            marginBottom: '1rem',
          }}
        >
          <h2 className="gm-admin-card__title" style={{ color: '#c084fc' }}>
            Schedule Campaign
          </h2>
          <p style={{ color: '#e2e8f0', margin: '0.5rem 0 1rem', lineHeight: 1.6 }}>
            Select a future date and time to schedule campaign <strong>{campaignToSchedule.name}</strong>:
          </p>

          {scheduleError && (
            <div className="gm-admin-warning" role="alert" data-testid="schedule-error" style={{ marginBottom: '1rem' }}>
              {scheduleError}
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
              Scheduled Date & Time (Local Time) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="datetime-local"
              name="scheduleDateTime"
              className="gm-admin-input"
              data-testid="schedule-datetime-input"
              value={scheduleDateTime}
              onChange={(e) => {
                setScheduleDateTime(e.target.value)
                setScheduleError(null)
              }}
              disabled={isScheduling}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="gm-admin-btn"
              onClick={closeScheduleModal}
              disabled={isScheduling}
              data-testid="cancel-schedule-modal-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              className="gm-admin-btn gm-admin-btn--primary"
              style={{
                background: '#7e22ce',
                borderColor: '#a855f7',
                color: '#ffffff',
                opacity: isScheduling ? 0.7 : 1,
              }}
              onClick={() => void confirmSchedule()}
              disabled={isScheduling}
              data-testid="confirm-schedule-btn"
            >
              {isScheduling ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* Cancel Scheduled Campaign Modal / Prompt */}
      {campaignToCancel && (
        <div
          className="gm-admin-card"
          data-testid="cancel-confirmation-card"
          style={{
            borderColor: 'rgba(234, 179, 8, 0.4)',
            background: 'rgba(28, 24, 15, 0.95)',
            marginBottom: '1rem',
          }}
        >
          <h2 className="gm-admin-card__title" style={{ color: '#facc15' }}>
            Cancel Scheduled Campaign
          </h2>
          <p style={{ color: '#e2e8f0', margin: '0.5rem 0 1rem', lineHeight: 1.6 }}>
            Are you sure you want to cancel scheduled campaign <strong>{campaignToCancel.name}</strong>?
          </p>

          {cancelError && (
            <div className="gm-admin-warning" role="alert" data-testid="cancel-error" style={{ marginBottom: '1rem' }}>
              {cancelError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="gm-admin-btn"
              onClick={closeCancelModal}
              disabled={isCancelling}
              data-testid="dismiss-cancel-modal-btn"
            >
              Back
            </button>
            <button
              type="button"
              className="gm-admin-btn"
              style={{
                background: '#ca8a04',
                borderColor: '#eab308',
                color: '#ffffff',
                opacity: isCancelling ? 0.7 : 1,
              }}
              onClick={() => void confirmCancel()}
              disabled={isCancelling}
              data-testid="confirm-cancel-btn"
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Campaign Composer / Editor (Collapsible/Toggleable Form) */}
      {isComposerOpen && (
        <div className="gm-admin-card" style={{ marginBottom: '0.5rem' }}>
          <h2 className="gm-admin-card__title">
            {editingCampaignId ? 'Edit Campaign' : 'Create Campaign'}
          </h2>

          {formError && (
            <div
              className="gm-admin-warning"
              role="alert"
              data-testid="composer-error"
              style={{ marginBottom: '1.25rem' }}
            >
              {formError}
            </div>
          )}

          <form onSubmit={(e) => void handleFormSubmit(e)}>
            <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: '1.3fr 0.9fr', marginTop: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    Campaign name <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    name="name"
                    className="gm-admin-input"
                    placeholder="Enter campaign name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={isSubmitting || isLoadingCampaign}
                  />
                  {formValidationErrors.name && (
                    <span style={{ color: '#f87171', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                      {formValidationErrors.name}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    Subject
                  </label>
                  <input
                    name="subject"
                    className="gm-admin-input"
                    placeholder="Enter email subject"
                    value={formData.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    disabled={isSubmitting || isLoadingCampaign}
                  />
                </div>

                <div>
                  <label htmlFor="campaign-template-select" style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    Email template selector <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <select
                    id="campaign-template-select"
                    name="templateId"
                    className="gm-admin-select"
                    value={formData.templateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    disabled={isSubmitting || isLoadingCampaign}
                    data-testid="campaign-template-select"
                  >
                    <option value="">Select template</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.templateKey})
                      </option>
                    ))}
                  </select>
                  {formValidationErrors.templateId && (
                    <span style={{ color: '#f87171', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                      {formValidationErrors.templateId}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    Audience filters
                  </label>
                  <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                    {filterOptions.map((filter) => (
                      <div key={filter.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{filter.label}</label>
                        <input
                          name={filter.name}
                          className="gm-admin-input"
                          placeholder={filter.value}
                          value={formData[filter.name as keyof CampaignFormState]}
                          onChange={(e) => handleInputChange(filter.name as keyof CampaignFormState, e.target.value)}
                          disabled={isSubmitting || isLoadingCampaign}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    Preview
                  </label>
                  <div className="gm-admin-empty" style={{ overflow: 'auto', maxHeight: '18rem' }}>
                    {selectedTemplate ? (
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '0.5rem' }}>
                          Subject: {selectedTemplate.subject}
                        </div>
                        <div
                          style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}
                          dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlBody }}
                        />
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: '#cbd5e1' }}>Preview content will appear here.</p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="gm-admin-btn"
                    onClick={toggleComposer}
                    disabled={isSubmitting || isLoadingCampaign}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="gm-admin-btn gm-admin-btn--primary"
                    disabled={isSubmitting || isLoadingCampaign}
                    style={{ opacity: isSubmitting || isLoadingCampaign ? 0.7 : 1 }}
                  >
                    {isSubmitting
                      ? editingCampaignId
                        ? 'Saving...'
                        : 'Sending...'
                      : editingCampaignId
                        ? 'Save Changes'
                        : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Main Campaign List States */}
      {isLoading ? (
        <div className="gm-admin-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <p className="gm-admin-muted" style={{ margin: 0 }}>
            Loading campaigns...
          </p>
        </div>
      ) : campaigns.length === 0 && !error ? (
        <div className="gm-admin-card">
          <div
            className="gm-admin-empty"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '12rem' }}
          >
            <p style={{ margin: 0, color: '#cbd5e1' }}>
              No campaigns found. Click "New Campaign" to create one.
            </p>
          </div>
        </div>
      ) : campaigns.length > 0 ? (
        <div className="gm-admin-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="gm-admin-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Type</th>
                <th>Status</th>
                <th>Scheduled / Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{campaign.name}</div>
                    {campaign.templateId && (
                      <div className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                        Template: {campaign.templateId}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ textTransform: 'capitalize' }}>
                      {campaign.campaignType || 'broadcast'}
                    </span>
                  </td>
                  <td>
                    <span
                      data-testid={`status-badge-${campaign.id}`}
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        ...getStatusBadgeStyle(campaign.status),
                      }}
                    >
                      {campaign.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {campaign.scheduledAt ? (
                      <div
                        data-testid={`scheduled-time-${campaign.id}`}
                        style={{ fontWeight: 600, color: '#c084fc' }}
                      >
                        Scheduled: {formatDateTime(campaign.scheduledAt)}
                      </div>
                    ) : null}
                    <div className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                      Created: {formatDateTime(campaign.createdAt)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {campaign.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            className="gm-admin-btn"
                            onClick={() => void handleOpenEdit(campaign)}
                            disabled={isSubmitting || isLoadingCampaign || isDeleting || isScheduling || isCancelling}
                            data-testid={`edit-campaign-btn-${campaign.id}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="gm-admin-btn gm-admin-btn--primary"
                            style={{ color: '#e9d5ff', borderColor: 'rgba(168,85,247,0.4)' }}
                            onClick={() => promptSchedule(campaign)}
                            disabled={isSubmitting || isLoadingCampaign || isDeleting || isScheduling || isCancelling}
                            data-testid={`schedule-campaign-btn-${campaign.id}`}
                          >
                            Schedule
                          </button>
                        </>
                      )}
                      {campaign.status === 'scheduled' && (
                        <button
                          type="button"
                          className="gm-admin-btn"
                          style={{ color: '#fef08a', borderColor: 'rgba(234,179,8,0.4)' }}
                          onClick={() => promptCancel(campaign)}
                          disabled={isSubmitting || isLoadingCampaign || isDeleting || isScheduling || isCancelling}
                          data-testid={`cancel-campaign-btn-${campaign.id}`}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        className="gm-admin-btn"
                        style={{ color: '#fecaca', borderColor: 'rgba(248,113,113,0.3)' }}
                        onClick={() => promptDelete(campaign)}
                        disabled={isSubmitting || isLoadingCampaign || isDeleting || isScheduling || isCancelling}
                        data-testid={`delete-campaign-btn-${campaign.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export default CampaignsPage
