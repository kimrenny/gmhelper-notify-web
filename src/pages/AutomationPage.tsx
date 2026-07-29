const events = ['User registered', 'User inactive', 'Email confirmed', 'Password changed']

function AutomationPage() {
  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Automation</h1>
          <p className="gm-admin-page__description">Create automatic email rules for your notification workflows.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', maxWidth: '720px' }}>
        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Rule name</h2>
          <input className="gm-admin-input" placeholder="Enter rule name" />
        </div>

        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Event selector</h2>
          <select className="gm-admin-select">
            <option>Select event</option>
            {events.map((event) => (
              <option key={event}>{event}</option>
            ))}
          </select>
        </div>

        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Email template selector</h2>
          <select className="gm-admin-select">
            <option>Select template</option>
            <option>Welcome email</option>
            <option>Reactivation email</option>
            <option>Security notice</option>
          </select>
        </div>

        <div className="gm-admin-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h2 className="gm-admin-card__title" style={{ marginBottom: '0.25rem' }}>Enable switch</h2>
              <p style={{ margin: 0, color: '#cbd5e1' }}>Toggle this rule on or off.</p>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ color: '#cbd5e1' }}>Off</span>
              <input type="checkbox" style={{ width: '1.1rem', height: '1.1rem' }} />
              <span style={{ color: '#cbd5e1' }}>On</span>
            </label>
          </div>
        </div>

        <button type="button" className="gm-admin-btn gm-admin-btn--primary" style={{ alignSelf: 'flex-start' }}>
          Save
        </button>
      </div>
    </section>
  )
}

export default AutomationPage
