import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks'
import './Header.scss'
import languagesIcon from '../../assets/icons/languages.png'
import defaultAvatar from '../../assets/icons/default-avatar.png'

function Header() {
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAuthHighlight] = useState(false)

  const userMenuRef = useRef<HTMLDivElement>(null)
  const languageMenuRef = useRef<HTMLDivElement>(null)

  const { user, role, isAuthenticated, isLoading, logout } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/') {
      setShowUserMenu(false)
    }
  }, [location.pathname])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (languageMenuRef.current && !languageMenuRef.current.contains(target)) {
        setShowLanguageMenu(false)
      }

      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [])

  const toggleLanguageMenu = () => {
    setShowLanguageMenu((value) => !value)
  }

  const selectLanguage = (language: string) => {
    void language
    setShowLanguageMenu(false)
  }

  const toggleUserMenu = () => {
    setShowUserMenu((value) => !value)
  }

  const mainWebUrl = (
    import.meta.env.VITE_MAIN_WEB_URL ?? 'http://localhost:4200'
  ).replace(/\/+$/, '')

  const navigateToMainApp = (event?: ReactMouseEvent<HTMLAnchorElement>) => {
    event?.preventDefault()
    window.location.href = mainWebUrl
  }

  const navigateToRegistration = (type: 'signup' | 'login') => {
    window.location.href = `${mainWebUrl}/register?type=${type}`
  }

  const openUserSettings = () => {
    setShowUserMenu(false)
    window.location.href = `${mainWebUrl}/settings`
  }

  const openAdminPanel = () => {
    if (!checkAdminAccess()) return
    setShowUserMenu(false)
    window.location.href = `${mainWebUrl}/admin`
  }

  const openOwnerPanel = () => {
    if (!checkOwnerAccess()) return
    setShowUserMenu(false)
    window.location.href = `${mainWebUrl}/owner`
  }

  const handleLogout = async () => {
    setShowUserMenu(false)
    try {
      await logout()
    } finally {
      window.location.href = mainWebUrl
    }
  }

  const checkAdminAccess = () => role === 'Admin' || role === 'Owner'
  const checkOwnerAccess = () => role === 'Owner'

  const userAvatarUrl = user?.avatar || defaultAvatar
  const userNickname = user?.nickname

  return (
    <header className="app-header">
      <div className="logo-container">
        <a
          className="gm-logo"
          href={mainWebUrl}
          onClick={navigateToMainApp}
          aria-label="GMHelper Home"
        />
      </div>

      <div className="auth-and-language">
        <div className="language-dropdown" ref={languageMenuRef}>
          <button type="button" className="lang-btn" onClick={toggleLanguageMenu}>
            <img src={languagesIcon} alt="Language" />
          </button>

          {showLanguageMenu && (
            <ul className="language-list">
              <li onClick={() => selectLanguage('en')}>English</li>
              <li onClick={() => selectLanguage('fr')}>Français</li>
              <li onClick={() => selectLanguage('de')}>Deutsch</li>
              <li onClick={() => selectLanguage('ko')}>한국어</li>
              <li onClick={() => selectLanguage('ua')}>Українська</li>
              <li onClick={() => selectLanguage('ru')}>Русский</li>
              <li onClick={() => selectLanguage('zh')}>简中</li>
              <li onClick={() => selectLanguage('ja')}>日本</li>
            </ul>
          )}
        </div>

        {isLoading ? (
          <div className="custom-loader" data-testid="header-loader">
            <div className="circle delay2" />
            <div className="circle delay1" />
            <div className="circle" />
          </div>
        ) : isAuthenticated && user ? (
          <div className="user-info">
            <div className="user-menu" ref={userMenuRef}>
              <div
                className={`user-header ${showUserMenu ? 'active' : ''}`}
                onClick={toggleUserMenu}
                data-testid="user-header"
              >
                <img src={userAvatarUrl} alt="Avatar" className="user-avatar" />
                <span className="user-nickname">{userNickname}</span>
              </div>

              {showUserMenu && (
                <ul className="user-menu-list" data-testid="user-menu-list">
                  <li onClick={openUserSettings}>Settings</li>
                  {checkAdminAccess() && <li onClick={openAdminPanel}>Admin</li>}
                  {checkOwnerAccess() && <li onClick={openOwnerPanel}>Owner</li>}
                  <li onClick={() => void handleLogout()}>Logout</li>
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className={`auth-buttons ${showAuthHighlight ? 'highlight' : ''}`}>
            <button
              type="button"
              className="login-btn"
              onClick={() => navigateToRegistration('login')}
            >
              Log In
            </button>
            <button
              type="button"
              className="register-btn"
              onClick={() => navigateToRegistration('signup')}
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
