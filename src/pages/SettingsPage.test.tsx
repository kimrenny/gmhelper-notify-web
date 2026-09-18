// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import * as useAuthModule from '../hooks/useAuth'
import { settingsService } from '../services/settingsService'
import { ApiError } from '../services/apiClient'
import type { AuthContextValue } from '../types/auth'
import type { Settings } from '../types/settings'

describe('SettingsPage component', () => {
  const setAuthMock = (overrides: Partial<AuthContextValue> = {}) => {
    const defaultAuth: AuthContextValue = {
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
      accessToken: 'sample-access-token-xyz',
      role: 'Admin',
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
      ...overrides,
    }
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(defaultAuth)
  }

  const sampleSettings: Settings = {
    defaultFromName: 'GMHelper Notifications',
    replyToEmail: 'support@gmhelper.com',
    defaultLocale: 'en',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
  })

  afterEach(() => {
    cleanup()
  })

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )
  }

  it('1. Displays initial loading state while settings request is pending', async () => {
    vi.spyOn(settingsService, 'getSettings').mockReturnValue(new Promise(() => {}))
    renderComponent()

    expect(screen.getByTestId('settings-loading')).toBeDefined()
    expect(screen.getByText('Loading application settings...')).toBeDefined()
    expect(screen.queryByTestId('settings-form')).toBeNull()
  })

  it('2. Successfully loads and displays settings form', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.queryByTestId('settings-loading')).toBeNull()
    })

    expect(screen.getByTestId('settings-card')).toBeDefined()
    expect(screen.getByTestId('settings-form')).toBeDefined()
  })

  it('3. Populates form controls with loaded values', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-from-name-input')).toBeDefined()
    })

    const fromNameInput = screen.getByTestId('settings-from-name-input') as HTMLInputElement
    const replyToInput = screen.getByTestId('settings-reply-to-input') as HTMLInputElement
    const localeSelect = screen.getByTestId('settings-locale-select') as HTMLSelectElement

    expect(fromNameInput.value).toBe('GMHelper Notifications')
    expect(replyToInput.value).toBe('support@gmhelper.com')
    expect(localeSelect.value).toBe('en')
  })

  it('4. Displays error state when initial API load fails', async () => {
    vi.spyOn(settingsService, 'getSettings').mockRejectedValue(
      new ApiError('Failed to load application settings.', 500, 'INTERNAL_ERROR')
    )
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-load-error')).toBeDefined()
    })

    expect(screen.getByText('Failed to load application settings.')).toBeDefined()
    expect(screen.getByTestId('settings-retry-btn')).toBeDefined()
    expect(screen.queryByTestId('settings-form')).toBeNull()
  })

  it('5. Retry button triggers another load attempt after error', async () => {
    const getSpy = vi
      .spyOn(settingsService, 'getSettings')
      .mockRejectedValueOnce(new ApiError('Connection error', 0, 'NETWORK_ERROR'))
      .mockResolvedValueOnce(sampleSettings)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-load-error')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('settings-retry-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('settings-load-error')).toBeNull()
      expect(screen.getByTestId('settings-form')).toBeDefined()
    })

    expect(getSpy).toHaveBeenCalledTimes(2)
  })

  it('6. Form is initially clean and Save/Reset buttons are disabled', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-save-btn')).toBeDefined()
    })

    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    const resetBtn = screen.getByTestId('settings-reset-btn') as HTMLButtonElement

    expect(saveBtn.disabled).toBe(true)
    expect(resetBtn.disabled).toBe(true)
  })

  it('7. Editing sender name marks form as dirty and enables Save/Reset', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-from-name-input')).toBeDefined()
    })

    const fromNameInput = screen.getByTestId('settings-from-name-input')
    fireEvent.change(fromNameInput, { target: { name: 'defaultFromName', value: 'New Brand Name' } })

    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    const resetBtn = screen.getByTestId('settings-reset-btn') as HTMLButtonElement

    expect(saveBtn.disabled).toBe(false)
    expect(resetBtn.disabled).toBe(false)
  })

  it('8. Editing reply-to email marks form as dirty', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-reply-to-input')).toBeDefined()
    })

    const replyToInput = screen.getByTestId('settings-reply-to-input')
    fireEvent.change(replyToInput, { target: { name: 'replyToEmail', value: 'new-reply@gmhelper.com' } })

    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(false)
  })

  it('9. Editing default locale marks form as dirty', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-locale-select')).toBeDefined()
    })

    const localeSelect = screen.getByTestId('settings-locale-select')
    fireEvent.change(localeSelect, { target: { name: 'defaultLocale', value: 'ua' } })

    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(false)
  })

  it('10. Invalid reply-to email displays validation message and disables Save', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-reply-to-input')).toBeDefined()
    })

    const replyToInput = screen.getByTestId('settings-reply-to-input')
    fireEvent.change(replyToInput, { target: { name: 'replyToEmail', value: 'invalid-email-no-domain' } })

    expect(screen.getByTestId('settings-reply-to-error')).toBeDefined()
    expect(screen.getByText('Please enter a valid email address.')).toBeDefined()

    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })

  it('11. Empty reply-to email is valid and enables Save when dirty', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-reply-to-input')).toBeDefined()
    })

    const replyToInput = screen.getByTestId('settings-reply-to-input')
    fireEvent.change(replyToInput, { target: { name: 'replyToEmail', value: '' } })

    expect(screen.queryByTestId('settings-reply-to-error')).toBeNull()

    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(false)
  })

  it('12. Name exceeding 100 characters displays validation message and disables Save', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-from-name-input')).toBeDefined()
    })

    const fromNameInput = screen.getByTestId('settings-from-name-input')
    fireEvent.change(fromNameInput, {
      target: { name: 'defaultFromName', value: 'a'.repeat(101) },
    })

    expect(screen.getByTestId('settings-from-name-error')).toBeDefined()
    expect(screen.getByText('Default sender name must not exceed 100 characters.')).toBeDefined()

    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })

  it('13. Submitting form sends expected payload and displays success message', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    const updateSpy = vi.spyOn(settingsService, 'updateSettings').mockResolvedValue({
      defaultFromName: 'Updated Sender',
      replyToEmail: 'updated@gmhelper.com',
      defaultLocale: 'de',
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-from-name-input')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('settings-from-name-input'), {
      target: { name: 'defaultFromName', value: 'Updated Sender' },
    })
    fireEvent.change(screen.getByTestId('settings-reply-to-input'), {
      target: { name: 'replyToEmail', value: 'updated@gmhelper.com' },
    })
    fireEvent.change(screen.getByTestId('settings-locale-select'), {
      target: { name: 'defaultLocale', value: 'de' },
    })

    fireEvent.click(screen.getByTestId('settings-save-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('settings-save-success')).toBeDefined()
    })

    expect(updateSpy).toHaveBeenCalledWith(
      {
        defaultFromName: 'Updated Sender',
        replyToEmail: 'updated@gmhelper.com',
        defaultLocale: 'de',
      },
      expect.anything()
    )

    expect(screen.getByText('Settings updated successfully.')).toBeDefined()

    // Form should now be clean
    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })

  it('14. Save failure preserves user edits, displays error, and keeps form dirty', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    vi.spyOn(settingsService, 'updateSettings').mockRejectedValue(
      new ApiError('Failed to save settings to database', 500, 'INTERNAL_ERROR')
    )

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-from-name-input')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('settings-from-name-input'), {
      target: { name: 'defaultFromName', value: 'Attempted Name' },
    })

    fireEvent.click(screen.getByTestId('settings-save-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('settings-save-error')).toBeDefined()
    })

    expect(screen.getByText('Failed to save settings to database')).toBeDefined()

    // User edits must be preserved
    const fromNameInput = screen.getByTestId('settings-from-name-input') as HTMLInputElement
    expect(fromNameInput.value).toBe('Attempted Name')

    // Form must remain dirty
    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(false)
  })

  it('15. Reset button restores initial server values and clears dirty state', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-from-name-input')).toBeDefined()
    })

    const fromNameInput = screen.getByTestId('settings-from-name-input') as HTMLInputElement
    const replyToInput = screen.getByTestId('settings-reply-to-input') as HTMLInputElement

    fireEvent.change(fromNameInput, { target: { name: 'defaultFromName', value: 'Temporary Name' } })
    fireEvent.change(replyToInput, { target: { name: 'replyToEmail', value: 'temp@gmhelper.com' } })

    expect(fromNameInput.value).toBe('Temporary Name')
    expect(replyToInput.value).toBe('temp@gmhelper.com')

    const resetBtn = screen.getByTestId('settings-reset-btn') as HTMLButtonElement
    fireEvent.click(resetBtn)

    expect(fromNameInput.value).toBe('GMHelper Notifications')
    expect(replyToInput.value).toBe('support@gmhelper.com')

    // Save/Reset should be disabled after reset
    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
    expect(resetBtn.disabled).toBe(true)
  })

  it('16. Prevents duplicate submissions while save is in flight', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    let resolveUpdate: (value: Settings) => void
    const updatePromise = new Promise<Settings>((resolve) => {
      resolveUpdate = resolve
    })
    const updateSpy = vi.spyOn(settingsService, 'updateSettings').mockReturnValue(updatePromise)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('settings-from-name-input')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('settings-from-name-input'), {
      target: { name: 'defaultFromName', value: 'Slow Save' },
    })

    const saveBtn = screen.getByTestId('settings-save-btn') as HTMLButtonElement
    fireEvent.click(saveBtn)

    expect(saveBtn.textContent).toBe('Saving...')
    expect(saveBtn.disabled).toBe(true)

    // Attempt second click
    fireEvent.click(saveBtn)
    expect(updateSpy).toHaveBeenCalledTimes(1)

    resolveUpdate!({
      ...sampleSettings,
      defaultFromName: 'Slow Save',
    })

    await waitFor(() => {
      expect(screen.getByTestId('settings-save-success')).toBeDefined()
    })
  })

  it('17. Displays infrastructure and security notice card', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sampleSettings)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('infrastructure-info-card')).toBeDefined()
    })

    expect(screen.getByText('Infrastructure & Security Notice')).toBeDefined()
    expect(
      screen.getByText(/SMTP network connectivity, authentication credentials/i)
    ).toBeDefined()
  })
})
