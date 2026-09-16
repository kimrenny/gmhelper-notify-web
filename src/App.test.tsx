// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { authService } from './services/authService'
import { dashboardService } from './services/dashboardService'

describe('App routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue({
      campaigns: { total: 0, draft: 0, scheduled: 0, running: 0, sending: 0, completed: 0, partiallyFailed: 0, failed: 0, cancelled: 0 },
      templates: { total: 0, draft: 0, active: 0, archived: 0 },
      deliveries: { totalMessages: 0, totalSent: 0, totalFailed: 0, totalPending: 0, totalSending: 0, successRate: 0 },
      recentCampaigns: [],
    })
    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue({
      isAuthenticated: true,
      accessToken: 'test-admin-jwt',
      role: 'Admin',
      user: {
        nickname: 'AdminTester',
        avatar: null,
        language: 'en',
      },
    })
  })


  afterEach(() => {
    cleanup()
  })

  it('renders the notification dashboard at root route /', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeDefined()
    })

    expect(screen.getByRole('navigation', { name: /admin navigation/i })).toBeDefined()
  })

  it('redirects /admin to / and renders the dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeDefined()
    })

    expect(screen.getByRole('navigation', { name: /admin navigation/i })).toBeDefined()
  })

  it('redirects /admin/dashboard to / and renders the dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeDefined()
    })

    expect(screen.getByRole('navigation', { name: /admin navigation/i })).toBeDefined()
  })
})
