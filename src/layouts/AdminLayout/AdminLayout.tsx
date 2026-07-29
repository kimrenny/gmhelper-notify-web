import { useState, type ReactNode } from 'react'
import Header from '../../components/Header'
import Sidebar from '../../components/Sidebar'

type AdminLayoutProps = {
  children: ReactNode
}

function AdminLayout({ children }: AdminLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="admin-shell">
      <Header />

      <div className="admin-layout">
        <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((value) => !value)} />

        <main className="admin-main">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout
