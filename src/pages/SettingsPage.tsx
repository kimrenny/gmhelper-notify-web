const sections = [
  { title: 'SMTP', description: 'Configure outgoing mail settings for your notification service.' },
  { title: 'Queue', description: 'Monitor queue status and pending delivery jobs.' },
  { title: 'Retry policy', description: 'Define how failed deliveries should be retried.' },
  { title: 'Logging', description: 'Review recent system events and delivery logs.' },
]

function SettingsPage() {
  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Settings</h1>
          <p className="gm-admin-page__description">Configure the core notification service settings.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {sections.map((section) => (
          <div key={section.title} className="gm-admin-card">
            <h2 className="gm-admin-card__title">{section.title}</h2>
            <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>{section.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default SettingsPage
