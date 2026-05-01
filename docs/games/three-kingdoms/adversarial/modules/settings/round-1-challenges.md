# Settings R1 挑战书

> Challenger Agent | 2026-05-01

## 挑战总览

| ID | 优先级 | 目标文件 | 攻击向量 | 描述 |
|----|--------|---------|---------|------|
| P0-1 | CRITICAL | SettingsManager.ts | restoreFromSaveData | 破坏性数据注入覆盖lastModifiedAt导致云端同步永久失效 |
| P0-2 | CRITICAL | CloudSaveCrypto.ts | encryptData | 密钥为空字符串时XOR加密无效 |
| P0-3 | CRITICAL | AccountSystem.ts | bind | identifier参数注入null/undefined导致绑定记录损坏 |
| P0-4 | CRITICAL | SaveSlotManager.ts | importSaves | 部分导入失败不回滚导致数据不一致 |
| P0-5 | CRITICAL | CloudSaveSystem.ts | sync | 并发sync()导致状态机混乱 |
| P1-1 | HIGH | AudioManager.ts | getEffectiveVolume | NaN channelVolume导致NaN传播到播放器 |
| P1-2 | HIGH | GraphicsManager.ts | detectBestPreset | capability含NaN/Infinity导致错误预设选择 |
| P1-3 | HIGH | SaveSlotManager.ts | saveToSlot | gameData为null时Blob size为NaN |
| P1-4 | HIGH | AnimationController.ts | playTransition | settings=null时isEnabled()返回true |
| P1-5 | HIGH | AccountSystem.ts | isGuestExpired | createdAt=NaN导致永不过期 |
| P1-6 | HIGH | CloudSaveSystem.ts | sync | retryCount在configure后不重置 |
| P1-7 | HIGH | SettingsManager.ts | mergeRemoteSettings | remoteTimestamp与localTimestamp相等时使用旧数据 |
| P2-1 | MEDIUM | AudioManager.ts | setScene | 场景叠加处理不完整 |
| P2-2 | MEDIUM | SaveSlotManager.ts | purchasePaidSlot | 已购买后再次购买不拒绝 |
| P2-3 | MEDIUM | AnimationController.ts | cancelAllAnimations | setTimeout回调仍在执行 |
| P2-4 | MEDIUM | GraphicsManager.ts | applySettings | Auto预设下advanced被覆盖 |

---

## P0 详细挑战

### P0-1: SettingsManager.restoreFromSaveData 破坏性数据注入

**攻击向量**: `restoreFromSaveData({ version: '19.0.0', settings: { lastModifiedAt: Infinity } })`

**证据**: SettingsManager.ts:389 - restoreFromSaveData 无字段校验，`data.settings` 展开后直接覆盖

**问题链**:
1. `data.settings` 展开后直接覆盖 `this.settings`，无任何字段校验
2. `lastModifiedAt: Infinity` 写入后，`mergeRemoteSettings()` 中 `remoteTimestamp > this.settings.lastModifiedAt` 永远为 false
3. 云端同步永久失效——即使远程有更新也无法覆盖
4. `lastModifiedAt: NaN` 同理：`NaN > NaN` = false

**影响**: 用户导入恶意存档后，所有云端同步永久失效

---

### P0-2: CloudSaveCrypto.encryptData 空密钥加密无效

**攻击向量**: `encryptData('data', '')`

**证据**: CloudSaveCrypto.ts:15 - keyBytes.length=0 时 `keyBytes[i % 0]` = undefined

**问题链**:
1. `key = ''` 导致 `keyBytes.length = 0`
2. `keyBytes[i % 0]` = `keyBytes[NaN]` = `undefined`
3. `dataBytes[i] ^ undefined` = `dataBytes[i]`（加密无效）
4. 空密钥加密=未加密，数据安全完全失效

---

### P0-3: AccountSystem.bind identifier null 注入

**攻击向量**: `account.bind(BindMethod.Phone, null as any)`

**证据**: AccountSystem.ts:131 - bind() 无 identifier 参数校验

**问题链**:
1. identifier 参数无 null/undefined/空字符串检查
2. 写入 `identifier: null` 后绑定记录损坏
3. 序列化后反序列化丢失类型信息

---

### P0-4: SaveSlotManager.importSaves 部分失败不回滚

**攻击向量**: `importSaves({ version: '1.0', exportedAt: 0, slots: { '0': valid, '1': invalid } })`

**证据**: SaveSlotManager.ts:316 - importSaves 循环中部分成功后异常不回滚

**问题链**:
1. 部分槽位已成功导入，异常后已导入的槽位不回滚
2. 返回 "导入失败" 但部分槽位数据已被覆盖
3. 元数据已部分更新

---

### P0-5: CloudSaveSystem.sync 并发竞态

**攻击向量**: 同时调用两次 `sync()`

**证据**: CloudSaveSystem.ts:131 - sync() 无并发锁

**问题链**:
1. 无并发锁——两个 sync() 可以同时执行
2. retryCount 被两个并发调用共享
3. lastSyncResult 被后完成的调用覆盖

---

## P1 详细挑战

### P1-1: AudioManager.getEffectiveVolume NaN 传播
- `Math.max(0, NaN)` 返回 `NaN`，不是 0
- NaN 音量值传播到播放器

### P1-2: GraphicsManager.detectBestPreset NaN/Infinity
- `cpuCores = Infinity` 选择 High（可能不正确）
- `cpuCores = NaN` 选择 Low（安全但非预期）

### P1-3: SaveSlotManager.saveToSlot null gameData
- `gameData = null` 时 `new Blob([null])` 创建损坏存档

### P1-4: AnimationController settings=null 默认启用
- `isEnabled()` 在 settings=null 时返回 true

### P1-5: AccountSystem.isGuestExpired NaN
- `createdAt = NaN` 导致永不过期

### P1-6: CloudSaveSystem retryCount 不重置
- configure() 后 retryCount 不重置

### P1-7: SettingsManager.mergeRemoteSettings 相等时间戳
- `>` 不含等于，相等时使用旧数据
