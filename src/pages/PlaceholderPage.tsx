type PlaceholderPageProps = {
  title: string
  description: string
}

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
        color: '#f8fafc',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{title}</h1>
        <p style={{ margin: '0.5rem 0 0', color: '#cbd5e1', lineHeight: 1.6 }}>{description}</p>
      </div>

      <div
        style={{
          minHeight: '18rem',
          border: '1px dashed rgba(255,255,255,0.2)',
          borderRadius: '1rem',
          background: 'rgba(255,255,255,0.04)',
        }}
      />
    </section>
  )
}

export default PlaceholderPage
