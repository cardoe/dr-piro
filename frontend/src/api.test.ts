import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPinConfig, setDuration, firePin, enablePin, disablePin, PinConfig } from './api';

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = vi.mocked(fetch);

describe('API Functions', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getPinConfig', () => {
    it('should fetch pin configuration successfully', async () => {
      const mockConfig: PinConfig = {
        pins: [18, 19, 20],
        triggered: [18],
        duration: 2
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      } as Response);

      const result = await getPinConfig();

      expect(mockFetch).toHaveBeenCalledWith('/api/fire/');
      expect(result).toEqual(mockConfig);
    });

    it('should reject when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(getPinConfig()).rejects.toThrow('Failed to read pin config');
    });
  });

  describe('setDuration', () => {
    it('should set duration successfully', async () => {
      const mockConfig: PinConfig = {
        pins: [18, 19, 20],
        triggered: [],
        duration: 5
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      } as Response);

      const result = await setDuration(5);

      expect(mockFetch).toHaveBeenCalledWith('/api/fire/', {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ duration: 5 }),
      });
      expect(result).toEqual(mockConfig);
    });

    it('should reject when setting duration fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(setDuration(5)).rejects.toThrow('Failed to edit duration');
    });
  });

  describe('firePin', () => {
    it('should fire pin successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await firePin(18);

      expect(mockFetch).toHaveBeenCalledWith('/api/fire/18');
    });

    it('should reject when firing pin fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(firePin(18)).rejects.toThrow('Failed to fire 18');
    });
  });

  describe('enablePin', () => {
    it('should enable pin successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await enablePin(21);

      expect(mockFetch).toHaveBeenCalledWith('/api/fire/21', { method: 'PUT' });
    });

    it('should reject when enabling pin fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(enablePin(21)).rejects.toThrow('Failed to enable pin 21');
    });
  });

  describe('disablePin', () => {
    it('should disable pin successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await disablePin(19);

      expect(mockFetch).toHaveBeenCalledWith('/api/fire/19', { method: 'DELETE' });
    });

    it('should reject when disabling pin fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(disablePin(19)).rejects.toThrow('Failed to disable pin 19');
    });
  });
});