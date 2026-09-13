// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Header from './Header'

describe('Header component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('navigates to VITE_MAIN_WEB_URL on GMHelper logo click in same tab without tokens', () => {
    const expectedMainWebUrl = import.meta.env.VITE_MAIN_WEB_URL ?? 'http://localhost:4200'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    const logoLink = screen.getByRole('link', { name: /gmhelper home/i })
    expect(logoLink).toBeDefined()
    expect(logoLink.getAttribute('href')).toBe(expectedMainWebUrl)
    expect(logoLink.getAttribute('target')).toBeNull()

    fireEvent.click(logoLink)

    // Confirms window.open was not called (same-tab navigation)
    expect(openSpy).not.toHaveBeenCalled()

    // Confirms destination URL is clean without auth parameters
    const parsedUrl = new URL(expectedMainWebUrl)
    expect(parsedUrl.origin).toBe('http://localhost:4200')
    expect(parsedUrl.searchParams.has('token')).toBe(false)
    expect(parsedUrl.searchParams.has('jwt')).toBe(false)
    expect(parsedUrl.searchParams.has('accessToken')).toBe(false)
    expect(parsedUrl.hash).toBe('')
  })
})
