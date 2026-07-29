const templates = [
  { name: 'Welcome email', description: 'Sent to newly registered users', updated: '2 days ago' },
  { name: 'Reminder email', description: 'Used for inactive accounts', updated: '1 week ago' },
  { name: 'Agreement notice', description: 'Shared for policy updates', updated: '3 weeks ago' },
]

function EmailTemplatesPage() {
  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Email Templates</h1>
          <p className="gm-admin-page__description">Manage the available message templates for your campaigns.</p>
        </div>

        <button type="button" className="gm-admin-btn gm-admin-btn--primary">
          Add template
        </button>
      </div>

      <div className="gm-admin-card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="gm-admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.name}>
                <td>{template.name}</td>
                <td className="gm-admin-muted">{template.description}</td>
                <td className="gm-admin-muted">{template.updated}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="gm-admin-btn">
                      Edit
                    </button>
                    <button type="button" className="gm-admin-btn" style={{ color: '#fecaca', borderColor: 'rgba(248,113,113,0.3)' }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default EmailTemplatesPage
