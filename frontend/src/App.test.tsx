import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import * as api from './api';

// Mock the API module
vi.mock('./api', () => ({
  getPinConfig: vi.fn(),
  firePin: vi.fn(),
  enablePin: vi.fn(),
  disablePin: vi.fn(),
  setDuration: vi.fn(),
}));

test('renders DR Piro app', async () => {
  // Mock the getPinConfig API call
  vi.mocked(api.getPinConfig).mockResolvedValue({
    pins: [],
    triggered: [],
    duration: 100,
  });

  render(<App />);

  // Wait for the app to render
  await waitFor(() => {
    expect(screen.getByText(/DR Piro/i)).toBeInTheDocument();
  });
});
