import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './Header.scss'
import languagesIcon from '../../assets/icons/languages.png'
import defaultAvatar from '../../assets/icons/default-avatar.png'

function Header() {
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [userIsAuthenticated] = useState(false)
  const [userAvatarUrl] = useState(defaultAvatar)
  const [userNickname] = useState('Guest')
  const [userRole] = useState<string | null>('Guest')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isUserLoading] = useState(false)
  const [showAuthHighlight] = useState(true)

  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/') {
      setShowUserMenu(false)
    }
  }, [location.pathname])

  useEffect(() => {
    const handleDocumentClick = (event: Event) => {
      const targetElement = event.target as HTMLElement
      const languageMenu = document.querySelector('.language-dropdown')
      const userMenu = document.querySelector('.user-menu')

      if (languageMenu && !languageMenu.contains(targetElement)) {
        setShowLanguageMenu(false)
      }

      if (userMenu && !userMenu.contains(targetElement)) {
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

  const mainWebUrl =
    import.meta.env.VITE_MAIN_WEB_URL ?? 'http://localhost:4200'

  const navigateToMainApp = (event?: ReactMouseEvent<HTMLAnchorElement>) => {
    event?.preventDefault()
    window.location.href = mainWebUrl
  }

  const navigateToRegistration = (type: 'signup' | 'login') => {
    navigate(`/register?type=${type}`)
  }

  const logout = () => {
    setShowUserMenu(false)
    navigate('/')
  }

  const openUserSettings = () => {
    setShowUserMenu(false)
    navigate('/settings')
  }

  const openAdminPanel = () => {
    if (!checkAdminAccess()) return

    setShowUserMenu(false)
    navigate('/admin')
  }

  const openOwnerPanel = () => {
    if (!checkOwnerAccess()) return

    setShowUserMenu(false)
    navigate('/owner')
  }

  const checkAdminAccess = () => userRole === 'Admin' || userRole === 'Owner'
  const checkOwnerAccess = () => userRole === 'Owner'

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
        <div className="language-dropdown">
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

        {isUserLoading ? (
          <div className="custom-loader">
            <div className="circle delay2" />
            <div className="circle delay1" />
            <div className="circle" />
          </div>
        ) : userIsAuthenticated ? (
          <div className="user-info">
            <div className="user-menu">
              <div
                className={`user-header ${showUserMenu ? 'active' : ''}`}
                onClick={toggleUserMenu}
              >
                <img src={userAvatarUrl} alt="Avatar" className="user-avatar" />
                <span className="user-nickname">{userNickname}</span>
              </div>

              {showUserMenu && (
                <ul className="user-menu-list">
                  <li onClick={openUserSettings}>Settings</li>
                  {checkAdminAccess() && <li onClick={openAdminPanel}>Admin</li>}
                  {checkOwnerAccess() && <li onClick={openOwnerPanel}>Owner</li>}
                  <li onClick={logout}>Logout</li>
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className={`auth-buttons ${showAuthHighlight ? 'highlight' : ''}`}>
            <button type="button" className="login-btn" onClick={() => navigateToRegistration('login')}>
              Log In
            </button>
            <button type="button" className="register-btn" onClick={() => navigateToRegistration('signup')}>
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
