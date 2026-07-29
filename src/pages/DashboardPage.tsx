const summaryCards = [
  { title: 'Campaigns', value: '12', description: 'Active campaigns' },
  { title: 'Automations', value: '8', description: 'Configured workflows' },
  { title: 'Templates', value: '24', description: 'Available templates' },
  { title: 'Sent messages', value: '1,284', description: 'Messages delivered' },
]

function DashboardPage() {
  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Dashboard</h1>
          <p className="gm-admin-page__description">Overview of your notification automation workspace.</p>
        </div>
      </div>

      <div className="gm-admin-grid gm-admin-grid--cards">
        {summaryCards.map((card) => (
          <article key={card.title} className="gm-admin-card">
            <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.95rem' }}>{card.title}</p>
            <h2 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.8rem', color: '#ffffff' }}>{card.value}</h2>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.95rem' }}>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default DashboardPage
