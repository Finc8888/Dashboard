/**
 * Jest setup — runs after test framework is loaded (setupFilesAfterEnv).
 * Provides global mocks and cleanup for each test.
 */

// Clean state before each test
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

// Mock fetch globally
global.fetch = jest.fn(() => Promise.resolve({ ok: false }));

// Mock AudioContext
global.AudioContext = jest.fn(() => ({
  state: 'suspended',
  resume: jest.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// Mock confirm/alert
global.confirm = jest.fn(() => true);
global.alert = jest.fn();
