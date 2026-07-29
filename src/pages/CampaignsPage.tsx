const filterOptions = [
  { label: 'User role', value: 'All roles' },
  { label: 'Registration date', value: 'Any date' },
  { label: 'Email confirmed', value: 'Any' },
  { label: 'Language', value: 'All' },
  { label: 'Account status', value: 'Active' },
]

function CampaignsPage() {
  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Campaigns</h1>
          <p className="gm-admin-page__description">Send a message immediately to users matching the selected audience filters.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: '1.3fr 0.9fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="gm-admin-card">
            <h2 className="gm-admin-card__title">Campaign name</h2>
            <input className="gm-admin-input" placeholder="Enter campaign name" />
          </div>

          <div className="gm-admin-card">
            <h2 className="gm-admin-card__title">Subject</h2>
            <input className="gm-admin-input" placeholder="Enter email subject" />
          </div>

          <div className="gm-admin-card">
            <h2 className="gm-admin-card__title">Email template selector</h2>
            <select className="gm-admin-select">
              <option>Select template</option>
              <option>Welcome email</option>
              <option>Reminder email</option>
              <option>Promotional email</option>
            </select>
          </div>

          <div className="gm-admin-card">
            <h2 className="gm-admin-card__title">Audience filters</h2>
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {filterOptions.map((filter) => (
                <div key={filter.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>{filter.label}</label>
                  <input className="gm-admin-input" placeholder={filter.value} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="gm-admin-card">
            <h2 className="gm-admin-card__title">Preview</h2>
            <div className="gm-admin-empty">
              <p style={{ margin: 0, color: '#cbd5e1' }}>Preview content will appear here.</p>
            </div>
          </div>

          <button type="button" className="gm-admin-btn gm-admin-btn--primary">
            Send
          </button>
        </div>
      </div>
    </section>
  )
}

export default CampaignsPage
