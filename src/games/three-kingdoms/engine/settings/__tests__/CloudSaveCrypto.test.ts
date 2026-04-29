/**
 * CloudSaveCrypto 单元测试
 *
 * 覆盖：
 * 1. encryptData / decryptData — 加密解密对称性
 * 2. computeChecksum — 校验和计算
 * 3. verifyIntegrity — 完整性验证
 * 4. uint8ToBase64 / base64ToUint8 — 编码工具
 */

import {
  encryptData,
  decryptData,
  computeChecksum,
  verifyIntegrity,
  uint8ToBase64,
  base64ToUint8,
} from '../CloudSaveCrypto';

describe('CloudSaveCrypto', () => {
  // ─── encryptData / decryptData ────────────

  describe('encryptData / decryptData', () => {
    it('加密后解密应还原原文', () => {
      const original = 'Hello 三国霸业！';
      const key = 'test-key-123';
      const encrypted = encryptData(original, key);
      const decrypted = decryptData(encrypted, key);
      expect(decrypted).toBe(original);
    });

    it('不同密钥解密应得到不同结果', () => {
      const original = 'secret data';
      const encrypted = encryptData(original, 'key1');
      const decrypted = decryptData(encrypted, 'key2');
      expect(decrypted).not.toBe(original);
    });

    it('空字符串应正常处理', () => {
      const encrypted = encryptData('', 'key');
      const decrypted = decryptData(encrypted, 'key');
      expect(decrypted).toBe('');
    });

    it('加密结果应为 Base64 格式', () => {
      const encrypted = encryptData('test', 'key');
      // Base64 字符集: A-Z, a-z, 0-9, +, /, =
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  // ─── computeChecksum ──────────────────────

  describe('computeChecksum', () => {
    it('相同数据应返回相同校验和', () => {
      const cs1 = computeChecksum('hello');
      const cs2 = computeChecksum('hello');
      expect(cs1).toBe(cs2);
    });

    it('不同数据应返回不同校验和', () => {
      const cs1 = computeChecksum('hello');
      const cs2 = computeChecksum('world');
      expect(cs1).not.toBe(cs2);
    });

    it('校验和应为8位16进制字符串', () => {
      const cs = computeChecksum('test');
      expect(cs).toMatch(/^[0-9a-f]{8}$/);
    });

    it('空字符串应返回有效校验和', () => {
      const cs = computeChecksum('');
      expect(cs).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  // ─── verifyIntegrity ──────────────────────

  describe('verifyIntegrity', () => {
    it('正确的校验和应返回 true', () => {
      const data = 'important data';
      const checksum = computeChecksum(data);
      expect(verifyIntegrity(data, checksum)).toBe(true);
    });

    it('错误的校验和应返回 false', () => {
      expect(verifyIntegrity('data', '00000000')).toBe(false);
    });

    it('数据被篡改应返回 false', () => {
      const original = 'original';
      const checksum = computeChecksum(original);
      expect(verifyIntegrity('modified', checksum)).toBe(false);
    });
  });

  // ─── uint8ToBase64 / base64ToUint8 ─────────

  describe('uint8ToBase64 / base64ToUint8', () => {
    it('应正确往返转换', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const base64 = uint8ToBase64(bytes);
      const restored = base64ToUint8(base64);
      expect(Array.from(restored)).toEqual(Array.from(bytes));
    });

    it('空 Uint8Array 应返回空字符串', () => {
      const base64 = uint8ToBase64(new Uint8Array(0));
      expect(base64).toBe('');
    });
  });
});
