import { describe, expect, test } from 'bun:test';
import { checkTelegramAccess } from './access-control.js';

describe('telegram access control', () => {
  test('allows all chats when allowedChatIds is empty', () => {
    expect(checkTelegramAccess(12345, [])).toBe(true);
    expect(checkTelegramAccess(99999, [])).toBe(true);
  });

  test('allows chat in allowlist', () => {
    expect(checkTelegramAccess(12345, [12345, 67890])).toBe(true);
  });

  test('blocks chat not in allowlist', () => {
    expect(checkTelegramAccess(99999, [12345, 67890])).toBe(false);
  });

  test('handles single allowed chat', () => {
    expect(checkTelegramAccess(12345, [12345])).toBe(true);
    expect(checkTelegramAccess(67890, [12345])).toBe(false);
  });
});
