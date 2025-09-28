import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from './App';
import * as api from './api';

// Mock the API module
vi.mock('./api');

const mockApi = vi.mocked(api);

const mockPinConfig = {
  pins: [18, 19, 20],
  triggered: [],
  duration: 2
};

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getPinConfig.mockResolvedValue(mockPinConfig);
  });

  it('renders the main application layout', async () => {
    render(<App />);

    expect(screen.getByText('DR Piro')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Launcher 1')).toBeInTheDocument();
    });
  });

  it('fetches pin configuration on mount', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockApi.getPinConfig).toHaveBeenCalledTimes(1);
    });
  });

  it('opens configuration modal when gear icon is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Launcher 1')).toBeInTheDocument();
    });

    // Find the nav link by using getAllByRole and filtering by the one that doesn't have text content "Fire"
    const buttons = screen.getAllByRole('button');
    const navLink = buttons.find(button => !button.textContent?.includes('Fire'));

    if (navLink) {
      await user.click(navLink);
    }

    await waitFor(() => {
      expect(screen.getByText('Configs')).toBeInTheDocument();
    });
  });

  it('displays launcher buttons for each pin', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Launcher 1')).toBeInTheDocument();
      expect(screen.getByText('Launcher 2')).toBeInTheDocument();
      expect(screen.getByText('Launcher 3')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockApi.getPinConfig.mockRejectedValue(new Error('API Error'));

    render(<App />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(new Error('API Error'));
    });

    consoleSpy.mockRestore();
  });
});
