# Settings R1 测试树

> Builder Agent | 2026-05-01

## 模块统计

| 指标 | 值 |
|------|-----|
| 源文件 | 16 个 (4012 行) |
| 测试文件 | 22 个 |
| 总测试数 | 626 |
| P0 发现 | 5 |
| P1 发现 | 5 |
| P2 发现 | 4 |
| 设计选择 | 2 |
| 修复数 | 9 |

## 测试覆盖矩阵

### SettingsManager (480行)
| API | 已有测试 | R1新增 | 修复 |
|-----|---------|--------|------|
| initialize() | ✅ | | |
| getAllSettings() | ✅ | | |
| getBasicSettings() | ✅ | | |
| getAudioSettings() | ✅ | | |
| getGraphicsSettings() | ✅ | | |
| getAccountSettings() | ✅ | | |
| getAnimationSettings() | ✅ | | |
| updateBasicSettings() | ✅ | | |
| updateAudioSettings() | ✅ | | |
| updateGraphicsSettings() | ✅ | | |
| updateAccountSettings() | ✅ | | |
| updateAnimationSettings() | ✅ | | |
| setSetting() | ✅ | | |
| calculateEffectiveVolume() | ✅ | ✅ NaN | |
| adjustVolume() | ✅ | | |
| resetCategory() | ✅ | | |
| resetAll() | ✅ | | |
| getSaveData() | ✅ | | |
| **restoreFromSaveData()** | ✅ | ✅ Infinity/NaN/非法音量 | FIX-001 |
| **mergeRemoteSettings()** | ✅ | ✅ Infinity/NaN/相等时间戳 | |
| onChange() | ✅ | | |
| removeAllListeners() | ✅ | | |

### AccountSystem (429行)
| API | 已有测试 | R1新增 | 修复 |
|-----|---------|--------|------|
| **bind()** | ✅ | ✅ null/undefined/空字符串 | FIX-003 |
| unbind() | ✅ | | |
| hasBinding() | ✅ | | |
| getBindings() | ✅ | | |
| registerDevice() | ✅ | | |
| unregisterDevice() | ✅ | | |
| setPrimaryDevice() | ✅ | | |
| isDeviceInUnbindCooldown() | ✅ | | |
| getDevices() | ✅ | | |
| getPrimaryDevice() | ✅ | | |
| initiateDelete() | ✅ | | |
| confirmDelete() | ✅ | | |
| checkDeleteCooldown() | ✅ | | |
| executeDelete() | ✅ | | |
| cancelDelete() | ✅ | | |
| getDeleteFlow() | ✅ | | |
| **isGuestExpired()** | ✅ | ✅ NaN | FIX-009 |
| getGuestRemainingDays() | ✅ | | |
| onChange() | ✅ | | |
| reset() | ✅ | | |

### CloudSaveSystem (377行)
| API | 已有测试 | R1新增 | 修复 |
|-----|---------|--------|------|
| configure() | ✅ | | |
| setCloudStorage() | ✅ | | |
| **sync()** | ✅ | ✅ 并发竞态 | FIX-005 |
| resolveAndUpload() | ✅ | | |
| startAutoSync() | ✅ | | |
| stopAutoSync() | ✅ | | |
| encrypt() | ✅ | | |
| decrypt() | ✅ | | |
| computeChecksum() | ✅ | | |
| verifyIntegrity() | ✅ | | |
| onChange() | ✅ | | |
| reset() | ✅ | | |

### CloudSaveCrypto (70行)
| API | 已有测试 | R1新增 | 修复 |
|-----|---------|--------|------|
| **encryptData()** | ✅ | ✅ 空密钥 | FIX-002 |
| **decryptData()** | ✅ | ✅ 空密钥 | FIX-002 |
| computeChecksum() | ✅ | | |
| verifyIntegrity() | ✅ | | |

### SaveSlotManager (451行)
| API | 已有测试 | R1新增 | 修复 |
|-----|---------|--------|------|
| getSlots() | ✅ | | |
| getSlot() | ✅ | | |
| getUsedSlotCount() | ✅ | | |
| getAvailableSlotCount() | ✅ | | |
| isSlotAvailable() | ✅ | | |
| isSlotEmpty() | ✅ | | |
| **saveToSlot()** | ✅ | ✅ null gameData | FIX-008 |
| loadFromSlot() | ✅ | | |
| deleteSlot() | ✅ | | |
| purchasePaidSlot() | ✅ | | |
| startAutoSave() | ✅ | | |
| stopAutoSave() | ✅ | | |
| exportSaves() | ✅ | | |
| **importSaves()** | ✅ | ✅ 部分失败不回滚 | FIX-004 |
| cloudSync() | ✅ | | |
| resolveConflict() | ✅ | | |
| onChange() | ✅ | | |
| reset() | ✅ | | |

### AudioManager (360行)
| API | 已有测试 | R1新增 | 修复 |
|-----|---------|--------|------|
| **getEffectiveVolume()** | ✅ | ✅ NaN | FIX-006 |
| getRawVolume() | ✅ | | |
| playBGM() | ✅ | | |
| stopBGM() | ✅ | | |
| enterBackground() | ✅ | | |
| enterForeground() | ✅ | | |
| handleInterruption() | ✅ | | |
| handleInterruptionEnd() | ✅ | | |
| updateBatteryLevel() | ✅ | | |
| playSFX() | ✅ | | |
| playVoice() | ✅ | | |
| playBattleSFX() | ✅ | | |
| setScene() | ✅ | | |
| reset() | ✅ | | |

### GraphicsManager (336行)
| API | 已有测试 | R1新增 | 修复 |
|-----|---------|--------|------|
| **detectBestPreset()** | ✅ | ✅ NaN/Infinity | FIX-007 |
| detectDeviceCapability() | ✅ | | |
| applyPreset() | ✅ | | |
| setAdvancedOption() | ✅ | | |
| updateAdvancedOptions() | ✅ | | |
| isLowQuality() | ✅ | | |
| isHighQuality() | ✅ | | |
| getEffectiveOptions() | ✅ | | |
| onChange() | ✅ | | |
| reset() | ✅ | | |

### AnimationController (428行)
| API | 已有测试 | R1新增 | 修复 |
|-----|---------|--------|------|
| playTransition() | ✅ | | |
| playStateAnimation() | ✅ | | |
| playFeedback() | ✅ | | |
| playInkWashTransition() | ✅ | | |
| isEnabled() | ✅ | ✅ null settings | 设计选择 |
| cancelAllAnimations() | ✅ | | |
| onChange() | ✅ | | |
| reset() | ✅ | | |

## P0 模式命中统计

| P0模式 | 命中数 | 具体 |
|--------|--------|------|
| 模式1: null/undefined防护 | 3 | P0-3, P1-3, P1-4 |
| 模式2: 数值溢出/非法值 | 3 | P0-1, P1-1, P1-2 |
| 模式5: 竞态/状态泄漏 | 1 | P0-5 |
| 模式9: NaN绕过 | 3 | P1-1, P1-2, P1-5 |
| 其他 | 1 | P0-2(空密钥), P0-4(部分回滚) |

## 修复清单

| FIX | 挑战 | 文件 | 行数变化 | 状态 |
|-----|------|------|---------|------|
| FIX-001 | P0-1 | SettingsManager.ts | +8 | ✅ 已修复已验证 |
| FIX-002 | P0-2 | CloudSaveCrypto.ts | +6 | ✅ 已修复已验证 |
| FIX-003 | P0-3 | AccountSystem.ts | +4 | ✅ 已修复已验证 |
| FIX-004 | P0-4 | SaveSlotManager.ts | +12/-8 | ✅ 已修复已验证 |
| FIX-005 | P0-5 | CloudSaveSystem.ts | +5 | ✅ 已修复已验证 |
| FIX-006 | P1-1 | AudioManager.ts | +3 | ✅ 已修复已验证 |
| FIX-007 | P1-2 | GraphicsManager.ts | +3 | ✅ 已修复已验证 |
| FIX-008 | P1-3 | SaveSlotManager.ts | +3 | ✅ 已修复已验证 |
| FIX-009 | P1-5 | account-delete-flow.ts | +2 | ✅ 已修复已验证 |
