import { Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'

function PlaceholderPage() {
  return (
    <section
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        margin: 0,
      }}
    />
  )
}

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<PlaceholderPage />} />
        <Route path="/settings" element={<PlaceholderPage />} />
        <Route path="/admin" element={<PlaceholderPage />} />
        <Route path="/owner" element={<PlaceholderPage />} />
      </Routes>
    </AppLayout>
  )
}

export default App
