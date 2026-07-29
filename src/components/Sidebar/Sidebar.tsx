import { NavLink } from 'react-router-dom'
import './Sidebar.scss'

type SidebarProps = {
  isCollapsed: boolean
  onToggle: () => void
}

const links = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/campaigns', label: 'Campaigns' },
  { to: '/admin/automation', label: 'Automation' },
  { to: '/admin/agreement', label: 'Agreement' },
  { to: '/admin/direct-message', label: 'Direct message' },
  { to: '/admin/templates', label: 'Templates' },
  { to: '/admin/settings', label: 'Settings' },
]

function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button type="button" className="admin-sidebar__toggle" onClick={onToggle}>
        {isCollapsed ? '>' : '<'}
      </button>

      <nav className="admin-sidebar__nav" aria-label="Admin navigation">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `admin-sidebar__link ${isActive ? 'active' : ''}`}
          >
            <span className="admin-sidebar__icon" aria-hidden="true">
              ■
            </span>
            {!isCollapsed && <span className="admin-sidebar__label">{link.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
