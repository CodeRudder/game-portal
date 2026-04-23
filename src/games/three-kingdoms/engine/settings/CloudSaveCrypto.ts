/**
 * 云存档 — 加密与校验工具函数
 *
 * 从 CloudSaveSystem 中提取的加密/解密/校验和工具函数。
 *
 * @module engine/settings/CloudSaveCrypto
 */

// ─────────────────────────────────────────────
// 加密与校验
// ─────────────────────────────────────────────

/** 加密数据（模拟 AES-GCM） */
export function encryptData(data: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const dataBytes = new TextEncoder().encode(data);
  const encrypted = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return uint8ToBase64(encrypted);
}

/** 解密数据 */
export function decryptData(encrypted: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encryptedBytes = base64ToUint8(encrypted);
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

/** 计算校验和 */
export function computeChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/** 验证数据完整性 */
export function verifyIntegrity(data: string, checksum: string): boolean {
  return computeChecksum(data) === checksum;
}

// ─────────────────────────────────────────────
// 内部编码工具
// ─────────────────────────────────────────────

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
