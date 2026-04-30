/**
 * MailConstants 单元测试
 *
 * 验证邮件系统常量配置的正确性：
 * - 保留时长计算准确
 * - 各类型邮件保留时长顺序合理
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RETAIN_SECONDS,
  SYSTEM_RETAIN_SECONDS,
  REWARD_RETAIN_SECONDS,
} from '../MailConstants';

describe('MailConstants', () => {
  describe('DEFAULT_RETAIN_SECONDS', () => {
    it('should equal 7 days in seconds', () => {
      expect(DEFAULT_RETAIN_SECONDS).toBe(7 * 24 * 3600);
    });

    it('should be 604800 seconds', () => {
      expect(DEFAULT_RETAIN_SECONDS).toBe(604800);
    });
  });

  describe('SYSTEM_RETAIN_SECONDS', () => {
    it('should equal 30 days in seconds', () => {
      expect(SYSTEM_RETAIN_SECONDS).toBe(30 * 24 * 3600);
    });

    it('should be 2592000 seconds', () => {
      expect(SYSTEM_RETAIN_SECONDS).toBe(2592000);
    });
  });

  describe('REWARD_RETAIN_SECONDS', () => {
    it('should equal 14 days in seconds', () => {
      expect(REWARD_RETAIN_SECONDS).toBe(14 * 24 * 3600);
    });

    it('should be 1209600 seconds', () => {
      expect(REWARD_RETAIN_SECONDS).toBe(1209600);
    });
  });

  describe('retention ordering', () => {
    it('system mail should be retained longer than reward mail', () => {
      expect(SYSTEM_RETAIN_SECONDS).toBeGreaterThan(REWARD_RETAIN_SECONDS);
    });

    it('reward mail should be retained longer than default mail', () => {
      expect(REWARD_RETAIN_SECONDS).toBeGreaterThan(DEFAULT_RETAIN_SECONDS);
    });

    it('all retention values should be positive', () => {
      expect(DEFAULT_RETAIN_SECONDS).toBeGreaterThan(0);
      expect(SYSTEM_RETAIN_SECONDS).toBeGreaterThan(0);
      expect(REWARD_RETAIN_SECONDS).toBeGreaterThan(0);
    });
  });
});
