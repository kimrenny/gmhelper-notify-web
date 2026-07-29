function DirectMessagePage() {
  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Direct Message</h1>
          <p className="gm-admin-page__description">Send a message to a single user from the notification dashboard.</p>
        </div>
      </div>

      <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Search</h2>
          <input className="gm-admin-input" placeholder="Search by email or username" />
          <div style={{ marginTop: '0.75rem', color: '#cbd5e1', fontSize: '0.95rem' }}>
            Search by: email or username
          </div>
        </div>

        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Selected user</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.2)' }}>
            <div style={{ width: '2.8rem', height: '2.8rem', borderRadius: '999px', background: '#b000d6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              U
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Placeholder user</div>
              <div style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>user@example.com</div>
            </div>
          </div>
        </div>

        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Subject</h2>
          <input className="gm-admin-input" placeholder="Enter email subject" />
        </div>

        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Email template</h2>
          <select className="gm-admin-select">
            <option>Select template</option>
            <option>Personal message</option>
            <option>Follow-up note</option>
          </select>
        </div>

        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Preview</h2>
          <div className="gm-admin-empty">
            <p style={{ margin: 0, color: '#cbd5e1' }}>Message preview will appear here.</p>
          </div>
        </div>

        <button type="button" className="gm-admin-btn gm-admin-btn--primary">
          Send
        </button>
      </div>
    </section>
  )
}

export default DirectMessagePage
