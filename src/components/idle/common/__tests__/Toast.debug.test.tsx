import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { Toast } from '../Toast';

vi.mock('../Toast.css', () => ({}));

describe('Toast Debug', () => {
  beforeEach(() => {
    const existing = globalThis.document?.querySelector('.tk-toast-portal');
    if (existing) existing.remove();
  });

  afterEach(() => {
    const existing = globalThis.document?.querySelector('.tk-toast-portal');
    if (existing) existing.remove();
  });

  it('flush with real timers plus await', async () => {
    act(() => {
      Toast.show({ message: 'hello world test' });
    });
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });
    
    const msg = document.querySelector('.tk-toast-message');
    expect(msg?.textContent).toBe('hello world test');
  });
});
