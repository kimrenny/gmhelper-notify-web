function AgreementPage() {
  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">User Agreement</h1>
          <p className="gm-admin-page__description">Send a notification email to every registered user about changes to the Terms of Service.</p>
        </div>
      </div>

      <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Subject</h2>
          <input className="gm-admin-input" placeholder="Enter email subject" />
        </div>

        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Email template selector</h2>
          <select className="gm-admin-select">
            <option>Select template</option>
            <option>Terms update announcement</option>
            <option>Policy reminder</option>
          </select>
        </div>

        <div className="gm-admin-card">
          <h2 className="gm-admin-card__title">Preview</h2>
          <div className="gm-admin-empty">
            <p style={{ margin: 0, color: '#cbd5e1' }}>Email preview will appear here.</p>
          </div>
        </div>

        <div className="gm-admin-warning">
          Warning: this action affects every registered user.
        </div>

        <button type="button" className="gm-admin-btn gm-admin-btn--primary">
          Send
        </button>
      </div>
    </section>
  )
}

export default AgreementPage
