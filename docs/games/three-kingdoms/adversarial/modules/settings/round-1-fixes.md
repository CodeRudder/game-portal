# Settings R1 修复清单

> Fixer Agent | 2026-05-01

## 修复总览

| FIX | 优先级 | 文件 | 描述 |
|-----|--------|------|------|
| FIX-001 | P0 | SettingsManager.ts | restoreFromSaveData 数据注入防护 |
| FIX-002 | P0 | CloudSaveCrypto.ts | 空密钥加密防护 |
| FIX-003 | P0 | AccountSystem.ts | bind identifier 参数校验 |
| FIX-004 | P0 | SaveSlotManager.ts | importSaves 两阶段导入 |
| FIX-005 | P0 | CloudSaveSystem.ts | sync 并发锁 |
| FIX-006 | P1 | AudioManager.ts | NaN 音量防护 |
| FIX-007 | P1 | GraphicsManager.ts | detectBestPreset NaN/Infinity 防护 |
| FIX-008 | P1 | SaveSlotManager.ts | saveToSlot null gameData 防护 |
| FIX-009 | P1 | account-delete-flow.ts | isGuestExpired NaN 防护 |

## 详细修复

### FIX-001: SettingsManager.restoreFromSaveData 数据注入防护

**问题**: restoreFromSaveData 无字段校验，Infinity/NaN lastModifiedAt 导致云端同步永久失效，非法音量值不被 clamp。

**修复**:
```typescript
// SettingsManager.ts - restoreFromSaveData()
const merged = { ...createDefaultAllSettings(), ...data.settings };
// 校验 lastModifiedAt
if (!Number.isFinite(merged.lastModifiedAt)) {
  merged.lastModifiedAt = Date.now();
}
// 校验音量范围
merged.audio.masterVolume = this.clampVolume(merged.audio.masterVolume);
merged.audio.bgmVolume = this.clampVolume(merged.audio.bgmVolume);
merged.audio.sfxVolume = this.clampVolume(merged.audio.sfxVolume);
merged.audio.voiceVolume = this.clampVolume(merged.audio.voiceVolume);
```

**关联P0模式**: 模式1(null/undefined) + 模式2(数值溢出)

---

### FIX-002: CloudSaveCrypto 空密钥防护

**问题**: encryptData('data', '') 不崩溃但加密无效（keyBytes.length=0，XOR undefined=原值）。

**修复**:
```typescript
// CloudSaveCrypto.ts
export function encryptData(data: string, key: string): string {
  if (!key || key.length === 0) {
    throw new Error('加密密钥不能为空');
  }
  // ...
}
export function decryptData(encrypted: string, key: string): string {
  if (!key || key.length === 0) {
    throw new Error('解密密钥不能为空');
  }
  // ...
}
```

**关联P0模式**: 模式1(null/undefined)

---

### FIX-003: AccountSystem.bind identifier 校验

**问题**: bind() 无 identifier 参数校验，null/undefined/空字符串直接写入绑定记录。

**修复**:
```typescript
// AccountSystem.ts - bind()
if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
  return { success: false, message: '绑定标识不能为空', rewardGranted: false, rewardAmount: 0 };
}
```

**关联P0模式**: 模式1(null/undefined)

---

### FIX-004: SaveSlotManager.importSaves 两阶段导入

**问题**: importSaves 循环中部分成功后异常不回滚，导致数据不一致。

**修复**: 改为两阶段导入——先验证所有数据可解码，再统一写入。
```typescript
// SaveSlotManager.ts - importSaves()
const decodedEntries: Array<{ index: number; data: string }> = [];
try {
  for (const [indexStr, encoded] of Object.entries(exportData.slots)) {
    const index = parseInt(indexStr, 10);
    if (!this.isValidSlotIndex(index)) continue;
    const decoded = decodeURIComponent(escape(atob(encoded)));
    decodedEntries.push({ index, data: decoded });
  }
} catch {
  return { success: false, message: '导入失败：数据格式错误' };
}
// 全部验证通过，统一写入
for (const { index, data } of decodedEntries) {
  this.saveToSlot(index, data, '导入存档');
}
```

**关联P0模式**: 模式7(数据丢失)

---

### FIX-005: CloudSaveSystem.sync 并发锁

**问题**: sync() 无并发锁，两个 sync() 可同时执行导致状态混乱。

**修复**:
```typescript
// CloudSaveSystem.ts
private syncInProgress = false;

async sync(...) {
  if (this.syncInProgress) {
    return this.failResult('同步正在进行中');
  }
  this.syncInProgress = true;
  try {
    // ...
    this.syncInProgress = false;
  } catch {
    this.syncInProgress = false;
  }
}
```

**关联P0模式**: 模式5(竞态/状态泄漏)

---

### FIX-006: AudioManager NaN 音量防护

**问题**: getEffectiveVolume 中 Math.max(0, NaN) = NaN，NaN 传播到播放器。

**修复**:
```typescript
// AudioManager.ts - getEffectiveVolume()
if (!Number.isFinite(effective)) return 0;
```

**关联P0模式**: 模式9(NaN绕过)

---

### FIX-007: GraphicsManager.detectBestPreset NaN/Infinity 防护

**问题**: Infinity cpuCores 选择 High，NaN 选择 Low（非预期行为）。

**修复**:
```typescript
// GraphicsManager.ts - detectBestPreset()
const cpuCores = Number.isFinite(cap.cpuCores) ? cap.cpuCores : 0;
const memoryGB = Number.isFinite(cap.memoryGB) ? cap.memoryGB : 0;
```

**关联P0模式**: 模式9(NaN绕过)

---

### FIX-008: SaveSlotManager.saveToSlot null gameData 防护

**问题**: saveToSlot 接受 null gameData，创建损坏存档。

**修复**:
```typescript
// SaveSlotManager.ts - saveToSlot()
if (gameData == null || typeof gameData !== 'string') {
  return { success: false, message: '存档数据无效' };
}
```

**关联P0模式**: 模式1(null/undefined)

---

### FIX-009: isGuestExpired NaN createdAt 防护

**问题**: createdAt=NaN 导致 NaN >= GUEST_EXPIRE_MS = false，永不过期。

**修复**:
```typescript
// account-delete-flow.ts - isGuestExpired()
if (!Number.isFinite(createdAt)) return true;
```

**关联P0模式**: 模式9(NaN绕过)
