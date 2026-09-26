import type { TransactionalEmailItem } from '../../types/transactional'
import {
  formatDateTime,
  formatTemplateKey,
  getTransactionalStatusBadgeStyle,
  TRANSACTIONAL_STATUS_LABELS,
} from '../../utils/transactional'

export interface TransactionalDetailDrawerProps {
  item: TransactionalEmailItem | null
  onClose: () => void
}

export function TransactionalDetailDrawer({ item, onClose }: TransactionalDetailDrawerProps) {
  if (!item) {
    return null
  }

  const badgeStyle = getTransactionalStatusBadgeStyle(item.deliveryStatus)

  return (
    <div
      className="gm-admin-drawer-overlay"
      onClick={onClose}
      data-testid="transactional-drawer-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        className="gm-admin-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Transactional Email Details"
        style={{
          width: '100%',
          maxWidth: '620px',
          height: '100%',
          background: '#181818',
          borderLeft: '1px solid rgba(189, 0, 214, 0.4)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '1.5rem',
          color: '#ffffff',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.25rem',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              Transactional Email Details
            </h2>
            <span
              style={{
                display: 'inline-block',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                background: badgeStyle.background,
                color: badgeStyle.color,
              }}
            >
              {TRANSACTIONAL_STATUS_LABELS[item.deliveryStatus] || item.deliveryStatus}
            </span>
          </div>

          <button
            type="button"
            className="gm-admin-btn"
            onClick={onClose}
            aria-label="Close details"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Delivery Summary Section */}
          <div className="gm-admin-card" style={{ padding: '1rem' }}>
            <h3 className="gm-admin-card__title" style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#e2e8f0' }}>
              Delivery Summary
            </h3>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Notification ID</dt>
                <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace', color: '#e879f9', fontSize: '0.85rem', wordBreak: 'break-all' }}>{item.id}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Delivery Status</dt>
                <dd style={{ margin: 0 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      background: badgeStyle.background,
                      color: badgeStyle.color,
                    }}
                  >
                    {TRANSACTIONAL_STATUS_LABELS[item.deliveryStatus] || item.deliveryStatus}
                  </span>
                </dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Attempts Count</dt>
                <dd style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{item.attemptsCount}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Notification Type</dt>
                <dd style={{ margin: 0, fontSize: '0.85rem', textTransform: 'capitalize' }}>{item.notificationType || 'direct'}</dd>
              </div>
            </dl>
          </div>

          {/* Recipient Information Section */}
          <div className="gm-admin-card" style={{ padding: '1rem' }}>
            <h3 className="gm-admin-card__title" style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#e2e8f0' }}>
              Recipient Information
            </h3>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Recipient Email</dt>
                <dd style={{ margin: 0, color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem', wordBreak: 'break-all' }}>{item.recipientEmail}</dd>
              </div>
              {item.recipientName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Recipient Name</dt>
                  <dd style={{ margin: 0, fontSize: '0.85rem' }}>{item.recipientName}</dd>
                </div>
              )}
              {item.externalUserId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>External User ID</dt>
                  <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace', color: '#cbd5e1', fontSize: '0.85rem' }}>{item.externalUserId}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Template Information Section */}
          <div className="gm-admin-card" style={{ padding: '1rem' }}>
            <h3 className="gm-admin-card__title" style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#e2e8f0' }}>
              Template Information
            </h3>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Template Key</dt>
                <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace', color: '#e879f9', fontSize: '0.85rem' }}>{item.templateKey || '-'}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Template Name</dt>
                <dd style={{ margin: 0, fontSize: '0.85rem' }}>{item.templateName || formatTemplateKey(item.templateKey)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Locale</dt>
                <dd style={{ margin: 0, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.85rem', color: '#60a5fa' }}>{item.locale || 'en'}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Template ID</dt>
                <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace', color: '#94a3b8', fontSize: '0.8rem', wordBreak: 'break-all' }}>{item.templateId || '-'}</dd>
              </div>
            </dl>
          </div>

          {/* Timestamps Section */}
          <div className="gm-admin-card" style={{ padding: '1rem' }}>
            <h3 className="gm-admin-card__title" style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#e2e8f0' }}>
              Timestamps
            </h3>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Created At</dt>
                <dd style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{formatDateTime(item.createdAt)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Last Attempt At</dt>
                <dd style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{formatDateTime(item.lastAttemptAt)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Sent At</dt>
                <dd style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{formatDateTime(item.sentAt)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <dt className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>Updated At</dt>
                <dd style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{formatDateTime(item.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          {/* Error Message Section */}
          {item.errorMessage && (
            <div
              className="gm-admin-warning"
              role="alert"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ffd3d3',
                padding: '1rem',
                borderRadius: '8px',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>Delivery Error</strong>
              <span style={{ fontSize: '0.85rem' }}>{item.errorMessage}</span>
            </div>
          )}

          {/* Privacy Notice Section */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              background: 'rgba(148, 163, 184, 0.05)',
              color: '#94a3b8',
              fontSize: '0.8rem',
              lineHeight: 1.5,
            }}
          >
            🔒 <strong style={{ color: '#cbd5e1' }}>Privacy &amp; Security Boundary:</strong> Authentication codes, reset tokens, recovery URLs, and email body contents are strictly omitted from monitoring history to protect user credentials.
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="gm-admin-btn"
            onClick={onClose}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default TransactionalDetailDrawer
