// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

describe('App routing', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the notification dashboard at root route /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByRole('navigation', { name: /admin navigation/i })).toBeDefined()
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeDefined()
  })

  it('redirects /admin to / and renders the dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByRole('navigation', { name: /admin navigation/i })).toBeDefined()
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeDefined()
  })

  it('redirects /admin/dashboard to / and renders the dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByRole('navigation', { name: /admin navigation/i })).toBeDefined()
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeDefined()
  })
})
