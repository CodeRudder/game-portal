/**
 * 设置系统 Play 流程集成测试 (v1.0 SET-FLOW-1~8)
 *
 * 覆盖范围：
 * - SET-FLOW-1: 音效/音乐开关流程
 * - SET-FLOW-2: 推送通知设置流程
 * - SET-FLOW-3: 账号绑定/解绑流程
 * - SET-FLOW-4: 存档管理流程
 * - SET-FLOW-5: 画面质量设置流程 [UI层测试]
 * - SET-FLOW-6: 语言切换流程
 * - SET-FLOW-7: 账号删除流程
 * - SET-FLOW-8: 恢复默认设置流程
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 */

import { describe, it, expect } from 'vitest';
import { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import { SettingsManager } from '../../settings/SettingsManager';

// ── 辅助：创建全新的模拟器实例 ──
function createSim(): GameEventSimulator {
  const sim = new GameEventSimulator();
  sim.init();
  return sim;
}

// ═══════════════════════════════════════════════
// V1 SET-FLOW 设置系统
// ═══════════════════════════════════════════════
describe('V1 SET-FLOW 设置系统', () => {

  // ═══════════════════════════════════════════════
  // SET-FLOW-1: 音效/音乐开关流程
  // ═══════════════════════════════════════════════
  describe('SET-FLOW-1: 音效/音乐开关流程', () => {
    it('should have SettingsManager accessible via engine.getSettingsManager()', () => {
      // SET-FLOW-1 步骤1: 获取 SettingsManager
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();
      expect(settingsManager).toBeDefined();
    });

    it('should have default audio settings: masterVolume=80, bgmVolume=60, sfxVolume=70, voiceVolume=80', () => {
      // SET-FLOW-1 步骤2: 检查默认音效值
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();
      const audio = settingsManager.getAudioSettings();

      expect(audio.masterVolume).toBe(80);
      expect(audio.bgmVolume).toBe(60);
      expect(audio.sfxVolume).toBe(70);
      expect(audio.voiceVolume).toBe(80);
    });

    it('should have master/bgm/voice/battleSfx switches enabled by default', () => {
      // SET-FLOW-1 步骤2: 检查默认开关状态
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();
      const audio = settingsManager.getAudioSettings();

      expect(audio.masterSwitch).toBe(true);
      expect(audio.bgmSwitch).toBe(true);
      expect(audio.voiceSwitch).toBe(true);
      expect(audio.battleSfxSwitch).toBe(true);
    });

    it('should update masterVolume via updateAudioSettings', () => {
      // SET-FLOW-1 步骤3: 修改主音量
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateAudioSettings({ masterVolume: 50 });
      expect(settingsManager.getAudioSettings().masterVolume).toBe(50);
    });

    it('should clamp volume to [0, 100] range', () => {
      // SET-FLOW-1 步骤3: 音量 clamp
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateAudioSettings({ masterVolume: 150 });
      expect(settingsManager.getAudioSettings().masterVolume).toBe(100);

      settingsManager.updateAudioSettings({ masterVolume: -10 });
      expect(settingsManager.getAudioSettings().masterVolume).toBe(0);
    });

    it('should toggle masterSwitch to mute all audio', () => {
      // SET-FLOW-1 步骤4: 主开关关闭 → 静音
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateAudioSettings({ masterSwitch: false });
      expect(settingsManager.getAudioSettings().masterSwitch).toBe(false);

      // calculateEffectiveVolume 应返回 0
      const effective = settingsManager.calculateEffectiveVolume(80);
      expect(effective).toBe(0);
    });

    it('should calculate effective volume correctly', () => {
      // SET-FLOW-1 步骤5: 验证实际音量计算
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      // 默认: masterVolume=80, channelVolume=60 → effective = 0.6 * 0.8 = 0.48
      const effective = settingsManager.calculateEffectiveVolume(60);
      expect(effective).toBeCloseTo(0.48, 2);
    });

    it('should adjust volume by step using adjustVolume', () => {
      // SET-FLOW-1 步骤6: 步进调整音量
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      const volBefore = settingsManager.getAudioSettings().masterVolume; // 80
      settingsManager.adjustVolume('masterVolume', 1); // +5
      expect(settingsManager.getAudioSettings().masterVolume).toBe(volBefore + 5);

      settingsManager.adjustVolume('masterVolume', -1); // -5
      expect(settingsManager.getAudioSettings().masterVolume).toBe(volBefore);
    });

    it('should notify listeners on audio settings change', () => {
      // SET-FLOW-1 步骤7: 变更通知
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      let receivedEvent: unknown = null;
      settingsManager.onChange((event) => { receivedEvent = event; });

      settingsManager.updateAudioSettings({ masterVolume: 30 });

      expect(receivedEvent).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════
  // SET-FLOW-2: 推送通知设置流程
  // ═══════════════════════════════════════════════
  describe('SET-FLOW-2: 推送通知设置流程', () => {
    it('should have notificationEnabled in basic settings', () => {
      // SET-FLOW-2 步骤1: 验证通知开关存在
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();
      const basic = settingsManager.getBasicSettings();

      expect(basic.notificationEnabled).toBe(true);
    });

    it('should have notificationFlags for each notification type', () => {
      // SET-FLOW-2 步骤2: 验证各类通知开关
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();
      const basic = settingsManager.getBasicSettings();

      expect(basic.notificationFlags).toBeDefined();
      expect(typeof basic.notificationFlags.buildingComplete).toBe('boolean');
      expect(typeof basic.notificationFlags.expeditionReturn).toBe('boolean');
      expect(typeof basic.notificationFlags.activityReminder).toBe('boolean');
      expect(typeof basic.notificationFlags.friendMessage).toBe('boolean');
      expect(typeof basic.notificationFlags.allianceNotice).toBe('boolean');
    });

    it('should toggle notificationEnabled via updateBasicSettings', () => {
      // SET-FLOW-2 步骤3: 关闭通知总开关
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateBasicSettings({ notificationEnabled: false });
      expect(settingsManager.getBasicSettings().notificationEnabled).toBe(false);
    });

    it('should update individual notification flags', () => {
      // SET-FLOW-2 步骤4: 修改单个通知类型
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateBasicSettings({
        notificationFlags: {
          ...settingsManager.getBasicSettings().notificationFlags,
          buildingComplete: false,
        },
      });
      expect(settingsManager.getBasicSettings().notificationFlags.buildingComplete).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════
  // SET-FLOW-3: 账号绑定/解绑流程
  // ═══════════════════════════════════════════════
  describe('SET-FLOW-3: 账号绑定/解绑流程', () => {
    it('should have AccountSystem accessible via engine.getAccountSystem()', () => {
      // SET-FLOW-3 步骤1: 验证 AccountSystem 存在
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      expect(accountSystem).toBeDefined();
    });

    it('should initialize account system with default account settings', () => {
      // SET-FLOW-3 步骤2: 初始化账号系统
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      const accountSettings = settingsManager.getAccountSettings();

      // 使用默认账号设置初始化
      accountSystem.initialize(accountSettings);
      const settings = accountSystem.getSettings();

      expect(settings).not.toBeNull();
      expect(settings!.isGuest).toBe(true);
      expect(settings!.bindings).toHaveLength(0);
    });

    it('should bind phone number and grant first-bind reward', () => {
      // SET-FLOW-3 步骤3: 绑定手机号
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      accountSystem.initialize(settingsManager.getAccountSettings());

      const result = accountSystem.bind('phone' as const, '138****1234');

      expect(result.success).toBe(true);
      expect(result.rewardGranted).toBe(true);
      expect(result.rewardAmount).toBe(50); // FIRST_BIND_REWARD = 50
    });

    it('should reject duplicate binding for same method', () => {
      // SET-FLOW-3 步骤4: 重复绑定应被拒绝
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      accountSystem.initialize(settingsManager.getAccountSettings());

      accountSystem.bind('phone' as const, '138****1234');
      const result = accountSystem.bind('phone' as const, '139****5678');

      expect(result.success).toBe(false);
    });

    it('should unbind when at least one binding remains', () => {
      // SET-FLOW-3 步骤5: 解绑（至少保留一个）
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      accountSystem.initialize(settingsManager.getAccountSettings());

      accountSystem.bind('phone' as const, '138****1234');
      accountSystem.bind('email' as const, 'test@example.com');

      // 解绑手机号（还剩邮箱）
      const result = accountSystem.unbind('phone' as const);
      expect(result.success).toBe(true);
    });

    it('should reject unbind when only one binding remains', () => {
      // SET-FLOW-3 步骤6: 最后一个绑定不能解绑
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      accountSystem.initialize(settingsManager.getAccountSettings());

      accountSystem.bind('phone' as const, '138****1234');

      const result = accountSystem.unbind('phone' as const);
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════
  // SET-FLOW-4: 存档管理流程
  // ═══════════════════════════════════════════════
  describe('SET-FLOW-4: 存档管理流程', () => {
    it('should return false for hasSaveData() before saving', () => {
      // SET-FLOW-4 步骤1: 初始状态无存档
      const sim = createSim();
      expect(sim.engine.hasSaveData()).toBe(false);
    });

    it('should save and then hasSaveData() returns true', () => {
      // SET-FLOW-4 步骤2: save() → hasSaveData()=true
      const sim = createSim();
      sim.engine.save();
      expect(sim.engine.hasSaveData()).toBe(true);
    });

    it('should serialize to valid JSON string', () => {
      // SET-FLOW-4 步骤3: serialize() → 验证 JSON 有效
      const sim = createSim();
      const json = sim.engine.serialize();

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.version).toBeDefined();
      expect(parsed.resource).toBeDefined();
      expect(parsed.building).toBeDefined();
    });

    it('should deserialize and restore engine state', () => {
      // SET-FLOW-4 步骤4: serialize → deserialize → 验证状态恢复
      // 注意: deserialize 会重建建筑并重置资源上限到初始值
      // grain 初始上限 2000, gold 无上限, troops 初始上限 500
      // 初始资源: grain=500, gold=300, troops=50
      const sim = createSim();

      // gold 无上限，可以安全验证
      sim.addResources({ gold: 5000 });

      const json = sim.engine.serialize();

      // 创建新引擎并恢复
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      // 验证 gold 恢复（gold 无上限，不受截断影响）
      expect(sim2.getResource('gold')).toBe(5300); // 初始300 + 5000
    });

    it('should save/load round-trip preserves building levels', () => {
      // SET-FLOW-4 步骤5: save → load → 建筑等级一致
      const sim = createSim();
      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuilding('castle');

      const json = sim.engine.serialize();

      const sim2 = createSim();
      sim2.engine.deserialize(json);

      expect(sim2.getBuildingLevel('castle')).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════
  // SET-FLOW-5: 画面质量设置流程
  // ═══════════════════════════════════════════════
  describe('SET-FLOW-5: 画面质量设置流程', () => {
    it.skip('[UI层测试] 画面质量切换需要渲染层验证', () => {
      // SET-FLOW-5: 画面质量切换属于 UI 层测试
      // 引擎层可通过 updateGraphicsSettings 修改设置
      // 但实际渲染效果需要浏览器环境验证
    });

    it('should have graphics settings with preset and advanced options', () => {
      // SET-FLOW-5 引擎层验证: 画面设置数据结构
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();
      const graphics = settingsManager.getGraphicsSettings();

      expect(graphics.preset).toBe('auto');
      expect(graphics.advanced).toBeDefined();
      expect(graphics.advanced.particleEffects).toBe(true);
      expect(graphics.advanced.inkWash).toBe(true);
    });

    it('should update graphics preset via updateGraphicsSettings', () => {
      // SET-FLOW-5 引擎层验证: 修改画质档位
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateGraphicsSettings({ preset: 'low' });
      expect(settingsManager.getGraphicsSettings().preset).toBe('low');
    });
  });

  // ═══════════════════════════════════════════════
  // SET-FLOW-6: 语言切换流程
  // ═══════════════════════════════════════════════
  describe('SET-FLOW-6: 语言切换流程', () => {
    it('should have default language as SimplifiedChinese', () => {
      // SET-FLOW-6 步骤1: 默认语言
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();
      const basic = settingsManager.getBasicSettings();

      expect(basic.language).toBe('zh-CN');
    });

    it('should switch language via updateBasicSettings', () => {
      // SET-FLOW-6 步骤2: 切换语言
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateBasicSettings({ language: 'en' });
      expect(settingsManager.getBasicSettings().language).toBe('en');
    });

    it('should persist language setting after save/restore cycle', () => {
      // SET-FLOW-6 步骤3: 语言设置持久化
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateBasicSettings({ language: 'ja' });

      // 获取保存数据
      const saveData = settingsManager.getSaveData();

      // 创建新 SettingsManager 并恢复
      const newManager = new SettingsManager();
      newManager.initialize();
      const result = newManager.restoreFromSaveData(saveData);

      expect(result).toBe(true);
      expect(newManager.getBasicSettings().language).toBe('ja');
    });
  });

  // ═══════════════════════════════════════════════
  // SET-FLOW-7: 账号删除流程
  // ═══════════════════════════════════════════════
  describe('SET-FLOW-7: 账号删除流程', () => {
    it('should have initiateDelete method on AccountSystem', () => {
      // SET-FLOW-7 步骤1: 验证删除流程方法存在
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();

      expect(typeof accountSystem.initiateDelete).toBe('function');
      expect(typeof accountSystem.confirmDelete).toBe('function');
      expect(typeof accountSystem.cancelDelete).toBe('function');
      expect(typeof accountSystem.executeDelete).toBe('function');
    });

    it('should reject initiate delete for guest account', () => {
      // SET-FLOW-7 步骤2: 游客账号不能删除
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      accountSystem.initialize(settingsManager.getAccountSettings());

      // 默认是游客账号
      const result = accountSystem.initiateDelete('确认删除');
      expect(result.success).toBe(false);
      expect(result.message).toContain('游客');
    });

    it('should initiate delete for non-guest account with correct confirmation text', () => {
      // SET-FLOW-7 步骤3: 非游客账号 + 正确确认文字 → 可发起删除
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      accountSystem.initialize(settingsManager.getAccountSettings());

      // 先绑定手机号（变为非游客）
      accountSystem.bind('phone' as const, '138****1234');

      const result = accountSystem.initiateDelete('确认删除');
      expect(result.success).toBe(true);
    });

    it('should reject initiate delete with wrong confirmation text', () => {
      // SET-FLOW-7 步骤4: 错误确认文字
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      accountSystem.initialize(settingsManager.getAccountSettings());

      // 先绑定手机号（变为非游客）
      accountSystem.bind('phone' as const, '138****1234');

      const result = accountSystem.initiateDelete('错误文字');
      expect(result.success).toBe(false);
    });

    it('should cancel delete during cooldown period', () => {
      // SET-FLOW-7 步骤5: 冷静期内撤销
      const sim = createSim();
      const accountSystem = sim.engine.getAccountSystem();
      const settingsManager = sim.engine.getSettingsManager();
      accountSystem.initialize(settingsManager.getAccountSettings());

      // 先绑定手机号（变为非游客）
      accountSystem.bind('phone' as const, '138****1234');

      accountSystem.initiateDelete('确认删除');
      accountSystem.confirmDelete();

      const result = accountSystem.cancelDelete();
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // SET-FLOW-8: 恢复默认设置流程
  // ═══════════════════════════════════════════════
  describe('SET-FLOW-8: 恢复默认设置流程', () => {
    it('should reset all settings to defaults via resetAll()', () => {
      // SET-FLOW-8 步骤1: 修改设置 → resetAll → 验证恢复
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      // 修改多个设置
      settingsManager.updateAudioSettings({ masterVolume: 30, bgmVolume: 20 });
      settingsManager.updateBasicSettings({ language: 'en' });

      // 恢复默认
      settingsManager.resetAll();

      // 验证音效恢复默认
      const audio = settingsManager.getAudioSettings();
      expect(audio.masterVolume).toBe(80);
      expect(audio.bgmVolume).toBe(60);

      // 验证基础设置恢复默认
      const basic = settingsManager.getBasicSettings();
      expect(basic.language).toBe('zh-CN');
    });

    it('should reset specific category via resetCategory()', () => {
      // SET-FLOW-8 步骤2: 只重置音效分类
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      settingsManager.updateAudioSettings({ masterVolume: 30 });
      settingsManager.updateBasicSettings({ language: 'en' });

      // 只重置音效
      settingsManager.resetCategory('audio' as const);

      // 音效应恢复默认
      expect(settingsManager.getAudioSettings().masterVolume).toBe(80);

      // 基础设置不受影响
      expect(settingsManager.getBasicSettings().language).toBe('en');
    });

    it('should notify listeners on resetAll', () => {
      // SET-FLOW-8 步骤3: 重置时触发通知
      const sim = createSim();
      const settingsManager = sim.engine.getSettingsManager();

      const events: unknown[] = [];
      settingsManager.onChange((event) => { events.push(event); });

      settingsManager.resetAll();

      // 重置会为每个分类发送通知
      expect(events.length).toBeGreaterThan(0);
    });
  });
});
