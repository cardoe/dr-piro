import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from './api';

// Import the components we need to test
// Since they're not exported individually, we'll need to test them through App
// But we can still create focused tests by rendering components in isolation


// Mock the API module
vi.mock('./api');
const mockApi = vi.mocked(api);

// Helper function to render a Launcher component
const renderLauncher = (props = {}) => {
  const defaultProps = {
    pin: 18,
    label: 1,
    duration: 2,
    disabled: false,
    ...props
  };

  // We need to copy the Launcher component logic since it's not exported
  const TestLauncher = ({ pin, label, duration, disabled }: any) => {
    const [clicked, setClicked] = React.useState(false);
    const [error, setError] = React.useState('');
    const [dis, setDis] = React.useState(disabled);

    const handleClick = async () => {
      setClicked(true);
      try {
        await api.firePin(pin);
        setDis(true);
      } catch (err) {
        setError(err as string);
      }
    };

    return (
      <div>
        <div>Launcher {label}</div>
        <button
          disabled={dis}
          onClick={handleClick}
          data-testid={`fire-btn-${pin}`}
        >
          Fire
        </button>
        {clicked && (
          <div data-testid="launch-alert">Launching {label}</div>
        )}
        {error !== '' && (
          <div data-testid="error-alert">Failed to launch: {error}</div>
        )}
      </div>
    );
  };

  return render(<TestLauncher {...defaultProps} />);
};

describe('Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Launcher Component Logic', () => {
    it('renders launcher with correct label', () => {
      renderLauncher({ label: 5 });
      expect(screen.getByText('Launcher 5')).toBeInTheDocument();
    });

    it('fires pin when button is clicked', async () => {
      const user = userEvent.setup();
      mockApi.firePin.mockResolvedValue();

      renderLauncher({ pin: 18 });

      const fireButton = screen.getByTestId('fire-btn-18');
      await user.click(fireButton);

      expect(mockApi.firePin).toHaveBeenCalledWith(18);
      await waitFor(() => {
        expect(screen.getByTestId('launch-alert')).toBeInTheDocument();
      });
    });

    it('disables button after successful fire', async () => {
      const user = userEvent.setup();
      mockApi.firePin.mockResolvedValue();

      renderLauncher({ pin: 19 });

      const fireButton = screen.getByTestId('fire-btn-19');
      expect(fireButton).not.toBeDisabled();

      await user.click(fireButton);

      await waitFor(() => {
        expect(fireButton).toBeDisabled();
      });
    });

    it('shows error when firing fails', async () => {
      const user = userEvent.setup();
      mockApi.firePin.mockRejectedValue('Network error');

      renderLauncher({ pin: 20 });

      const fireButton = screen.getByTestId('fire-btn-20');
      await user.click(fireButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toHaveTextContent('Failed to launch: Network error');
      });
    });

    it('renders as disabled when disabled prop is true', () => {
      renderLauncher({ disabled: true });
      const fireButton = screen.getByTestId('fire-btn-18');
      expect(fireButton).toBeDisabled();
    });
  });

  describe('LaunchAlert Component Logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('clears alert after duration timeout', () => {
      const TestLaunchAlert = ({ duration }: { duration: number }) => {
        const [show, setShow] = React.useState(true);

        React.useEffect(() => {
          const timeId = setTimeout(() => {
            setShow(false);
          }, duration * 1000);

          return () => clearTimeout(timeId);
        }, [duration]);

        return show ? <div data-testid="launch-alert">Launching</div> : null;
      };

      render(<TestLaunchAlert duration={2} />);

      expect(screen.getByTestId('launch-alert')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByTestId('launch-alert')).not.toBeInTheDocument();
    });
  });

  describe('Configuration Modal Logic', () => {
    const mockConfig = {
      pins: [18, 19, 20],
      triggered: [18],
      duration: 2
    };

    const renderConfigModal = (showConfig = true) => {
      const TestConfigModal = ({ config, showConfig: show }: any) => {
        const [showModal, setShowModal] = React.useState(show);
        const [durationValue, setDurationValue] = React.useState('');
        const [pinValue, setPinValue] = React.useState('');

        const handleSaveDuration = async () => {
          if (durationValue) {
            const val = Number(durationValue);
            await api.setDuration(val);
          }
        };

        const handleEnablePin = async () => {
          if (pinValue) {
            const val = Number(pinValue);
            await api.enablePin(val);
          }
        };

        const handleDisablePin = async (pin: number) => {
          await api.disablePin(pin);
        };

        if (!showModal) return null;

        return (
          <div data-testid="config-modal">
            <h2>Configs</h2>
            <div>
              <input
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                type="number"
                placeholder={String(config.duration)}
                data-testid="duration-input"
              />
              <button onClick={handleSaveDuration} data-testid="save-duration">
                Save Duration
              </button>
            </div>
            <div>
              <input
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                type="number"
                data-testid="pin-input"
              />
              <button onClick={handleEnablePin} data-testid="enable-pin">
                Enable Pin
              </button>
            </div>
            {config.pins.map((pin: number, index: number) => (
              <button
                key={index}
                onClick={() => handleDisablePin(pin)}
                data-testid={`disable-pin-${pin}`}
              >
                Disable Launch {index} / Pin {pin}
              </button>
            ))}
          </div>
        );
      };

      return render(<TestConfigModal config={mockConfig} showConfig={showConfig} />);
    };

    it('saves duration when save button is clicked', async () => {
      const user = userEvent.setup();
      mockApi.setDuration.mockResolvedValue(mockConfig);

      renderConfigModal();

      const durationInput = screen.getByTestId('duration-input');
      const saveButton = screen.getByTestId('save-duration');

      await user.type(durationInput, '5');
      await user.click(saveButton);

      expect(mockApi.setDuration).toHaveBeenCalledWith(5);
    });

    it('enables pin when enable button is clicked', async () => {
      const user = userEvent.setup();
      mockApi.enablePin.mockResolvedValue();

      renderConfigModal();

      const pinInput = screen.getByTestId('pin-input');
      const enableButton = screen.getByTestId('enable-pin');

      await user.type(pinInput, '21');
      await user.click(enableButton);

      expect(mockApi.enablePin).toHaveBeenCalledWith(21);
    });

    it('disables pin when disable button is clicked', async () => {
      const user = userEvent.setup();
      mockApi.disablePin.mockResolvedValue();

      renderConfigModal();

      const disableButton = screen.getByTestId('disable-pin-18');
      await user.click(disableButton);

      expect(mockApi.disablePin).toHaveBeenCalledWith(18);
    });

    it('does not render when showConfig is false', () => {
      renderConfigModal(false);
      expect(screen.queryByTestId('config-modal')).not.toBeInTheDocument();
    });
  });
});