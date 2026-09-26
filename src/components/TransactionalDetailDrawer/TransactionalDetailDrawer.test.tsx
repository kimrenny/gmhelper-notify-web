// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TransactionalDetailDrawer } from './TransactionalDetailDrawer'
import type { TransactionalEmailItem } from '../../types/transactional'

describe('TransactionalDetailDrawer', () => {
  afterEach(() => {
    cleanup()
  })

  const mockItem: TransactionalEmailItem = {
    id: 'notif-12345',
    templateId: 'tpl-999',
    templateKey: 'auth.password_recovery',
    templateName: 'Password Recovery (RU)',
    locale: 'ru',
    externalUserId: 'user-ext-77',
    recipientEmail: 'alex@example.com',
    recipientName: 'Alex Smith',
    notificationType: 'direct',
    deliveryStatus: 'failed',
    attemptsCount: 3,
    lastAttemptAt: '2026-09-26T14:30:00Z',
    sentAt: undefined,
    errorMessage: 'SMTP 550 Mailbox unavailable',
    createdAt: '2026-09-26T14:25:00Z',
    updatedAt: '2026-09-26T14:30:00Z',
  }

  it('renders nothing when item is null', () => {
    const { container } = render(
      <TransactionalDetailDrawer item={null} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders all safe metadata fields when item is provided', () => {
    render(<TransactionalDetailDrawer item={mockItem} onClose={vi.fn()} />)

    expect(screen.getByText('Transactional Email Details')).toBeDefined()
    expect(screen.getByText('notif-12345')).toBeDefined()
    expect(screen.getByText('alex@example.com')).toBeDefined()
    expect(screen.getByText('Alex Smith')).toBeDefined()
    expect(screen.getByText('user-ext-77')).toBeDefined()
    expect(screen.getByText('auth.password_recovery')).toBeDefined()
    expect(screen.getByText('Password Recovery (RU)')).toBeDefined()
    expect(screen.getByText('ru')).toBeDefined()
    expect(screen.getByText('tpl-999')).toBeDefined()
    expect(screen.getByText('SMTP 550 Mailbox unavailable')).toBeDefined()
    expect(
      screen.getByText(/Authentication codes, reset tokens, recovery URLs, and email body contents are strictly omitted/i)
    ).toBeDefined()
  })

  it('calls onClose when close button or overlay is clicked', () => {
    const onClose = vi.fn()
    render(<TransactionalDetailDrawer item={mockItem} onClose={onClose} />)

    const closeBtn = screen.getByRole('button', { name: /close details/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    const overlay = screen.getByTestId('transactional-drawer-overlay')
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
