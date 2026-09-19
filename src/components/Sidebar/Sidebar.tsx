import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks'
import './Sidebar.scss'

type SidebarProps = {
  isCollapsed: boolean
  onToggle: () => void
}

interface NavItem {
  to: string
  label: string
  ownerOnly?: boolean
}

const links: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/admin/campaigns', label: 'Campaigns' },
  { to: '/admin/automation', label: 'Automation' },
  { to: '/admin/agreement', label: 'Agreement' },
  { to: '/admin/direct-message', label: 'Direct message' },
  { to: '/admin/templates', label: 'Templates' },
  { to: '/admin/activity', label: 'Activity history', ownerOnly: true },
  { to: '/admin/settings', label: 'Settings' },
]

function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { role } = useAuth()
  const isOwner = role?.toLowerCase() === 'owner'

  const visibleLinks = links.filter((link) => !link.ownerOnly || isOwner)

  return (
    <aside className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button type="button" className="admin-sidebar__toggle" onClick={onToggle}>
        {isCollapsed ? '>' : '<'}
      </button>

      <nav className="admin-sidebar__nav" aria-label="Admin navigation">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
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
