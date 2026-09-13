// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Header from './Header'
import * as hooks from '../../hooks'
import type { AuthContextValue } from '../../types/auth'

vi.mock('../../hooks', () => ({
  useAuth: vi.fn(),
}))

describe('Header component', () => {
  const mainWebUrl = (
    import.meta.env.VITE_MAIN_WEB_URL ?? 'http://localhost:4200'
  ).replace(/\/+$/, '')

  let mockLogout: () => Promise<void>

  const setAuthMock = (overrides: Partial<AuthContextValue> = {}) => {
    mockLogout = vi.fn().mockImplementation(() => Promise.resolve())
    const defaultAuthValue: AuthContextValue = {
      user: null,
      accessToken: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      logout: mockLogout,
      ...overrides,
    }
    vi.mocked(hooks.useAuth).mockReturnValue(defaultAuthValue)
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    window.location.href = 'http://localhost:5173/'
  })

  afterEach(() => {
    cleanup()
  })

  it('1. Authenticated nickname is rendered', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminSuperUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    expect(screen.getByText('AdminSuperUser')).toBeDefined()
  })

  it('2. Authenticated avatar is rendered (real avatar and fallback)', () => {
    const customAvatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: customAvatar,
        language: 'en',
      },
    })

    const { rerender } = render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    const avatarImg = screen.getByRole('img', { name: /avatar/i }) as HTMLImageElement
    expect(avatarImg.src).toBe(customAvatar)

    // Fallback when avatar is null
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    rerender(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    const fallbackAvatar = screen.getByRole('img', { name: /avatar/i }) as HTMLImageElement
    expect(fallbackAvatar.src).toContain('default-avatar')
  })

  it('3. Dropdown is NOT visible initially', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('user-menu-list')).toBeNull()
    expect(screen.queryByText('Settings')).toBeNull()
  })

  it('4. Clicking nickname/avatar makes the dropdown visible and 5. contains Settings action', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('user-header'))

    const menu = screen.getByTestId('user-menu-list')
    expect(menu).toBeDefined()
    expect(screen.getByText('Settings')).toBeDefined()
  })

  it('6. Admin sees Admin action and does not see Owner action', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('user-header'))

    expect(screen.getByText('Settings')).toBeDefined()
    expect(screen.getByText('Admin')).toBeDefined()
    expect(screen.getByText('Logout')).toBeDefined()
    expect(screen.queryByText('Owner')).toBeNull()
  })

  it('7. Owner sees Owner action', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Owner',
      user: {
        nickname: 'OwnerUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('user-header'))

    expect(screen.getByText('Settings')).toBeDefined()
    expect(screen.getByText('Admin')).toBeDefined()
    expect(screen.getByText('Owner')).toBeDefined()
    expect(screen.getByText('Logout')).toBeDefined()
  })

  it('8. User / unauthorized state does not see privileged actions', () => {
    // Non-admin authenticated user (role: null)
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: null,
      user: {
        nickname: 'RegularUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('user-header'))

    expect(screen.getByText('Settings')).toBeDefined()
    expect(screen.getByText('Logout')).toBeDefined()
    expect(screen.queryByText('Admin')).toBeNull()
    expect(screen.queryByText('Owner')).toBeNull()
  })

  it('9. Clicking nickname again closes the dropdown', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    const userHeader = screen.getByTestId('user-header')

    // Open
    fireEvent.click(userHeader)
    expect(screen.getByTestId('user-menu-list')).toBeDefined()

    // Close
    fireEvent.click(userHeader)
    expect(screen.queryByTestId('user-menu-list')).toBeNull()
  })

  it('10. Clicking outside closes the dropdown', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <div data-testid="outside-area">Outside</div>
        <Header />
      </MemoryRouter>
    )

    // Open
    fireEvent.click(screen.getByTestId('user-header'))
    expect(screen.getByTestId('user-menu-list')).toBeDefined()

    // Click outside
    fireEvent.click(screen.getByTestId('outside-area'))
    expect(screen.queryByTestId('user-menu-list')).toBeNull()
  })

  it('11. Clicking Settings closes dropdown and navigates to the main application', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('user-header'))
    fireEvent.click(screen.getByText('Settings'))

    expect(screen.queryByTestId('user-menu-list')).toBeNull()
    expect(window.location.href).toBe(`${mainWebUrl}/settings`)
  })

  it('12. Clicking Admin closes dropdown and navigates to the main application', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('user-header'))
    fireEvent.click(screen.getByText('Admin'))

    expect(screen.queryByTestId('user-menu-list')).toBeNull()
    expect(window.location.href).toBe(`${mainWebUrl}/admin`)
  })

  it('13. Clicking Owner closes dropdown and navigates to the main application', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Owner',
      user: {
        nickname: 'OwnerUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('user-header'))
    fireEvent.click(screen.getByText('Owner'))

    expect(screen.queryByTestId('user-menu-list')).toBeNull()
    expect(window.location.href).toBe(`${mainWebUrl}/owner`)
  })

  it('14. Clicking Logout calls useAuth().logout() and 15. navigates to the main application root', async () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('user-header'))

    await act(async () => {
      fireEvent.click(screen.getByText('Logout'))
    })

    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('user-menu-list')).toBeNull()
    expect(window.location.href.replace(/\/$/, '')).toBe(mainWebUrl)
  })

  it('verifies logo still points to the main GMHelper root', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    const logoLink = screen.getByRole('link', { name: /gmhelper home/i })
    expect(logoLink.getAttribute('href')).toBe(mainWebUrl)

    fireEvent.click(logoLink)
    expect(window.location.href.replace(/\/$/, '')).toBe(mainWebUrl)
  })

  it('verifies navigation URLs contain no authentication data', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      accessToken: 'super-secret-token-12345',
      role: 'Owner',
      user: {
        nickname: 'OwnerUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    const checkUrlIsClean = (url: string) => {
      const parsed = new URL(url)
      expect(parsed.searchParams.has('token')).toBe(false)
      expect(parsed.searchParams.has('jwt')).toBe(false)
      expect(parsed.searchParams.has('accessToken')).toBe(false)
      expect(parsed.hash).toBe('')
      expect(url).not.toContain('super-secret-token-12345')
    }

    fireEvent.click(screen.getByTestId('user-header'))
    fireEvent.click(screen.getByText('Settings'))
    checkUrlIsClean(window.location.href)
  })

  it('regression protection: preserves Header layout structure and classes', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      role: null,
    })

    const { container } = render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    expect(container.querySelector('.app-header')).not.toBeNull()
    expect(container.querySelector('.logo-container')).not.toBeNull()
    expect(container.querySelector('.gm-logo')).not.toBeNull()
    expect(container.querySelector('.auth-and-language')).not.toBeNull()
    expect(container.querySelector('.language-dropdown')).not.toBeNull()
    expect(container.querySelector('.auth-buttons')).not.toBeNull()
  })
})
