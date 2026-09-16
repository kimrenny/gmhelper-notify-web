import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { ApiError, templateService } from '../services'
import type {
  CreateTemplateInput,
  EmailTemplate,
  PreviewTemplateRequest,
  PreviewTemplateResponse,
  UpdateTemplateInput,
} from '../types'

interface FormState {
  templateKey: string
  name: string
  subject: string
  htmlBody: string
  plainTextBody: string
  locale: string
  status: string
  version: number
}

const initialFormState: FormState = {
  templateKey: '',
  name: '',
  subject: '',
  htmlBody: '',
  plainTextBody: '',
  locale: 'en',
  status: 'active',
  version: 1,
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return dateStr
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function EmailTemplatesPage() {
  const apiClient = useApiClient()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [formValidationErrors, setFormValidationErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Preview state
  const [showPreview, setShowPreview] = useState(true)
  const [previewData, setPreviewData] = useState<PreviewTemplateResponse | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Delete state
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadTemplates = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setListError(null)
    try {
      const data = await templateService.getTemplates(apiClient, signal)
      setTemplates(data ?? [])
    } catch (err) {
      if (signal?.aborted) {
        return
      }
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setListError('Unauthorized (401): You do not have access to email templates. Please verify your authentication.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setListError('Forbidden (403): You do not have permission to access email templates.')
        } else {
          setListError(err.message || 'Failed to load email templates')
        }
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load email templates'
        setListError(message)
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [apiClient])

  useEffect(() => {
    const controller = new AbortController()
    void loadTemplates(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadTemplates])

  // Live debounced template preview
  useEffect(() => {
    if (!isFormOpen || !showPreview) {
      return
    }

    const trimmedSubject = formData.subject.trim()
    const trimmedHtml = formData.htmlBody.trim()

    if (!trimmedSubject || !trimmedHtml) {
      setIsPreviewLoading(false)
      setPreviewError(null)
      setPreviewData(null)
      return
    }

    const controller = new AbortController()
    setIsPreviewLoading(true)

    const timer = setTimeout(async () => {
      try {
        const templateId = editingTemplate?.id || 'preview'
        const previewReq: PreviewTemplateRequest = {
          subject: formData.subject,
          htmlBody: formData.htmlBody,
          plainTextBody: formData.plainTextBody,
          variables: {},
        }
        const rendered = await templateService.previewTemplate(
          templateId,
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
          } else if (err.statusCode === 400) {
            setPreviewError(`Validation error: ${err.message}`)
          } else {
            setPreviewError(err.message || 'Failed to generate template preview.')
          }
        } else {
          const msg = err instanceof Error ? err.message : 'Network error occurred while generating template preview.'
          setPreviewError(msg)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPreviewLoading(false)
        }
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [
    isFormOpen,
    showPreview,
    formData.subject,
    formData.htmlBody,
    formData.plainTextBody,
    editingTemplate?.id,
    apiClient,
  ])

  const openCreateForm = () => {
    setEditingTemplate(null)
    setFormData(initialFormState)
    setFormValidationErrors({})
    setFormError(null)
    setPreviewData(null)
    setPreviewError(null)
    setShowPreview(true)
    setIsFormOpen(true)
  }

  const openEditForm = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData({
      templateKey: template.templateKey,
      name: template.name,
      subject: template.subject,
      htmlBody: template.htmlBody,
      plainTextBody: template.plainTextBody ?? '',
      locale: template.locale,
      status: template.status,
      version: template.version,
    })
    setFormValidationErrors({})
    setFormError(null)
    setPreviewData(null)
    setPreviewError(null)
    setShowPreview(true)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingTemplate(null)
    setFormData(initialFormState)
    setFormValidationErrors({})
    setFormError(null)
    setPreviewData(null)
    setPreviewError(null)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'version' ? Math.max(1, parseInt(value, 10) || 1) : value,
    }))
    if (formValidationErrors[name]) {
      setFormValidationErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) {
      errors.name = 'Name is required'
    }
    if (!formData.templateKey.trim()) {
      errors.templateKey = 'Template key is required'
    }
    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required'
    }
    if (!formData.htmlBody.trim()) {
      errors.htmlBody = 'HTML body is required'
    }
    setFormValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      if (editingTemplate) {
        const updateData: UpdateTemplateInput = {
          templateKey: formData.templateKey.trim(),
          name: formData.name.trim(),
          subject: formData.subject.trim(),
          htmlBody: formData.htmlBody,
          plainTextBody: formData.plainTextBody.trim() || undefined,
          locale: formData.locale.trim() || 'en',
          status: formData.status,
          version: formData.version,
        }

        const updated = await templateService.updateTemplate(editingTemplate.id, updateData, apiClient)
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      } else {
        const createData: CreateTemplateInput = {
          templateKey: formData.templateKey.trim(),
          name: formData.name.trim(),
          subject: formData.subject.trim(),
          htmlBody: formData.htmlBody,
          plainTextBody: formData.plainTextBody.trim() || undefined,
          locale: formData.locale.trim() || 'en',
          status: formData.status,
          version: formData.version,
        }

        const created = await templateService.createTemplate(createData, apiClient)
        setTemplates((prev) => [created, ...prev])
      }

      setIsFormOpen(false)
      setEditingTemplate(null)
      setFormData(initialFormState)
      setPreviewData(null)
      setPreviewError(null)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setFormError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setFormError('Forbidden (403): You do not have permission to modify templates.')
        } else if (err.statusCode === 409 || err.code === 'CONFLICT') {
          setFormError('A template with this key, locale, and version already exists.')
        } else if (err.statusCode === 400) {
          setFormError(`Validation error: ${err.message}`)
        } else {
          setFormError(err.message || 'Failed to save template. Please try again.')
        }
      } else {
        setFormError('An unexpected error occurred while saving the template.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const promptDelete = (template: EmailTemplate) => {
    setTemplateToDelete(template)
    setDeleteError(null)
  }

  const cancelDelete = () => {
    if (isDeleting) return
    setTemplateToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!templateToDelete) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await templateService.deleteTemplate(templateToDelete.id, apiClient)
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id))
      setTemplateToDelete(null)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setDeleteError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setDeleteError('Forbidden (403): You do not have permission to delete templates.')
        } else if (err.statusCode === 409 || err.code === 'CONFLICT') {
          setDeleteError('This template cannot currently be deleted because it is in use by campaigns or automations.')
        } else if (err.statusCode === 404) {
          setDeleteError('Template not found. It may have already been deleted.')
          setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id))
        } else {
          setDeleteError(err.message || 'Failed to delete template.')
        }
      } else {
        setDeleteError('Network error occurred while deleting the template.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Email Templates</h1>
          <p className="gm-admin-page__description">Manage the available message templates for your campaigns.</p>
        </div>

        {!isFormOpen && (
          <button type="button" className="gm-admin-btn gm-admin-btn--primary" onClick={openCreateForm}>
            Add template
          </button>
        )}
      </div>

      {listError && (
        <div
          className="gm-admin-warning"
          role="alert"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}
        >
          <span data-testid="templates-error-message">{listError}</span>
          <button type="button" className="gm-admin-btn" onClick={() => void loadTemplates()}>
            Retry
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal / Prompt */}
      {templateToDelete && (
        <div
          className="gm-admin-card"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            background: 'rgba(26, 17, 23, 0.95)',
          }}
        >
          <h2 className="gm-admin-card__title" style={{ color: '#fca5a5' }}>
            Confirm Delete
          </h2>
          <p style={{ color: '#e2e8f0', margin: '0.5rem 0 1rem', lineHeight: 1.6 }}>
            Are you sure you want to delete template <strong>{templateToDelete.name}</strong> (
            <code>{templateToDelete.templateKey}</code>)? This action cannot be undone.
          </p>

          {deleteError && (
            <div className="gm-admin-warning" role="alert" style={{ marginBottom: '1rem' }}>
              {deleteError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="gm-admin-btn" onClick={cancelDelete} disabled={isDeleting}>
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
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Form Section with Side-by-Side Live Preview */}
      {isFormOpen && (
        <div
          className={showPreview ? 'gm-admin-editor-layout' : 'gm-admin-editor-layout--single'}
          data-testid="template-editor-container"
        >
          {/* Left Column: Form */}
          <div className="gm-admin-card" style={{ width: '100%', boxSizing: 'border-box' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                gap: '1rem',
              }}
            >
              <h2 className="gm-admin-card__title" style={{ margin: 0 }}>
                {editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'New Email Template'}
              </h2>
              <button
                type="button"
                className="gm-admin-btn"
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
                onClick={() => setShowPreview((prev) => !prev)}
                data-testid="toggle-preview-btn"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>

            {formError && (
              <div className="gm-admin-warning" role="alert" style={{ marginBottom: '1.25rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={(e) => void handleFormSubmit(e)} style={{ display: 'grid', gap: '1rem' }}>
              <div className="gm-admin-grid gm-admin-grid--2">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>
                    Name <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    name="name"
                    className="gm-admin-input"
                    placeholder="e.g. Welcome Email"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={isSaving}
                  />
                  {formValidationErrors.name && (
                    <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{formValidationErrors.name}</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>
                    Template Key <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    name="templateKey"
                    className="gm-admin-input"
                    placeholder="e.g. welcome_email"
                    value={formData.templateKey}
                    onChange={handleInputChange}
                    disabled={isSaving}
                  />
                  {formValidationErrors.templateKey && (
                    <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{formValidationErrors.templateKey}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>
                  Subject <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  name="subject"
                  className="gm-admin-input"
                  placeholder="e.g. Welcome to GMHelper!"
                  value={formData.subject}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {formValidationErrors.subject && (
                  <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{formValidationErrors.subject}</span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>Locale</label>
                  <input
                    name="locale"
                    className="gm-admin-input"
                    placeholder="en"
                    value={formData.locale}
                    onChange={handleInputChange}
                    disabled={isSaving}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>Status</label>
                  <select
                    name="status"
                    className="gm-admin-select"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={isSaving}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>Version</label>
                  <input
                    name="version"
                    type="number"
                    min="1"
                    className="gm-admin-input"
                    value={formData.version}
                    onChange={handleInputChange}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>
                  HTML Body <span style={{ color: '#f87171' }}>*</span>
                </label>
                <textarea
                  name="htmlBody"
                  className="gm-admin-input"
                  placeholder="<p>Hello, welcome to our service...</p>"
                  rows={6}
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem' }}
                  value={formData.htmlBody}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {formValidationErrors.htmlBody && (
                  <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{formValidationErrors.htmlBody}</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>
                  Plain Text Body <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                </label>
                <textarea
                  name="plainTextBody"
                  className="gm-admin-input"
                  placeholder="Hello, welcome to our service..."
                  rows={4}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }}
                  value={formData.plainTextBody}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="gm-admin-btn" onClick={closeForm} disabled={isSaving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gm-admin-btn gm-admin-btn--primary"
                  disabled={isSaving}
                  style={{ opacity: isSaving ? 0.7 : 1 }}
                >
                  {isSaving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Rendered Preview */}
          {showPreview && (
            <div
              className="gm-admin-card"
              data-testid="template-preview-card"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(15, 23, 42, 0.75)',
                position: 'sticky',
                top: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 className="gm-admin-card__title" style={{ margin: 0, fontSize: '1.1rem' }}>
                    Live Preview
                  </h3>
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
                      Updating...
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="gm-admin-btn"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
                  onClick={() => setShowPreview(false)}
                  data-testid="close-preview-btn"
                >
                  Hide Preview
                </button>
              </div>

              {/* Preview Content Area */}
              {previewError ? (
                <div className="gm-admin-warning" role="alert" data-testid="preview-error">
                  {previewError}
                </div>
              ) : isPreviewLoading && !previewData ? (
                <div
                  data-testid="preview-initial-loading"
                  style={{
                    padding: '3rem 1rem',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                  }}
                >
                  Loading preview...
                </div>
              ) : !formData.subject.trim() || !formData.htmlBody.trim() ? (
                <div
                  data-testid="preview-empty-notice"
                  style={{
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    border: '1px dashed rgba(148, 163, 184, 0.25)',
                    background: 'rgba(30, 41, 59, 0.3)',
                    fontSize: '0.9rem',
                  }}
                >
                  Enter a subject and HTML body to see the live rendered preview.
                </div>
              ) : previewData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Rendered Subject:
                    </div>
                    <div
                      data-testid="preview-rendered-subject"
                      style={{
                        color: '#f8fafc',
                        fontSize: '1rem',
                        fontWeight: 600,
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(30, 41, 59, 0.6)',
                        borderRadius: '4px',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {previewData.subject}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Rendered HTML:
                    </div>
                    <div
                      data-testid="preview-rendered-html"
                      style={{
                        padding: '1rem',
                        background: '#ffffff',
                        color: '#0f172a',
                        borderRadius: '6px',
                        minHeight: '140px',
                        maxHeight: '400px',
                        overflow: 'auto',
                      }}
                      dangerouslySetInnerHTML={{ __html: previewData.htmlBody }}
                    />
                  </div>

                  {previewData.plainTextBody && (
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Rendered Plain Text:
                      </div>
                      <pre
                        data-testid="preview-rendered-plaintext"
                        style={{
                          margin: 0,
                          padding: '0.75rem',
                          background: 'rgba(30, 41, 59, 0.6)',
                          color: '#e2e8f0',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          border: '1px solid rgba(148, 163, 184, 0.15)',
                          maxHeight: '200px',
                          overflow: 'auto',
                        }}
                      >
                        {previewData.plainTextBody}
                      </pre>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Templates Table / State Views */}
      {isLoading ? (
        <div className="gm-admin-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <p className="gm-admin-muted" style={{ margin: 0 }}>
            Loading templates...
          </p>
        </div>
      ) : templates.length === 0 && !listError && !isFormOpen ? (
        <div className="gm-admin-card">
          <div
            className="gm-admin-empty"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '12rem' }}
          >
            <p style={{ margin: 0, color: '#cbd5e1' }}>No email templates found. Click "Add template" to create one.</p>
          </div>
        </div>
      ) : (
        <div className="gm-admin-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="gm-admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key / Subject</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{template.name}</div>
                    <div className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                      v{template.version} ({template.locale})
                    </div>
                  </td>
                  <td>
                    <div style={{ color: '#ffffff' }}>{template.subject}</div>
                    <div className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                      {template.templateKey}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        background:
                          template.status === 'active'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : template.status === 'draft'
                              ? 'rgba(234, 179, 8, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                        color:
                          template.status === 'active'
                            ? '#4ade80'
                            : template.status === 'draft'
                              ? '#facc15'
                              : '#94a3b8',
                      }}
                    >
                      {template.status}
                    </span>
                  </td>
                  <td className="gm-admin-muted">{formatDateTime(template.updatedAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="gm-admin-btn"
                        onClick={() => openEditForm(template)}
                        disabled={isSaving || isDeleting}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="gm-admin-btn"
                        style={{ color: '#fecaca', borderColor: 'rgba(248,113,113,0.3)' }}
                        onClick={() => promptDelete(template)}
                        disabled={isSaving || isDeleting}
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
      )}
    </section>
  )
}

export default EmailTemplatesPage
