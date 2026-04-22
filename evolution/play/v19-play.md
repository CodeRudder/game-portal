# v19.0 天下一统(上) — Play 文档 (Round 2)

> 版本: v19.0 天下一统(上) | 引擎域: engine/unification/(9子系统) + engine/settings/(7子系统)
> 日期: 2025-07-24 | 轮次: Round 2

## P1: 音量控制 — 主音量×分类音量 → 4通道开关 → 特殊场景处理

```
1. AudioController.init(deps)
   → channels=[BGM,SFX,VOICE,BATTLE], masterVolume=100%
2. setVolume('bgm', 60) → bgmVolume=60, 实际输出=60%×100%=60%
   setVolume('master', 80) → masterVolume=80
   → bgm实际输出=60%×80%=48%
3. setSwitch('bgm', false) → bgmSwitch=false → BGM停止播放
   setSwitch('bgm', true) → BGM恢复, 渐入0.5s
4. simulateBackground() → masterVolume渐弱至0%(1s过渡)
   simulatePhoneCall() → 立即静音 → 恢复后渐入0.5s
   simulateLowBattery(15%) → BGM音量自动降低50%
5. getState() → { masterVolume:80, channels:{bgm:{volume:60,switch:false}...} }
```
**验证**: 实际输出=分类音量×主音量 **公式正确**, 4开关独立控制

## P2: 画质4档预设 → 自动检测 → 高级选项 → 即时切换

```
1. GraphicsQualityManager.init(deps)
   → detectHardware() → {cpuCores:8, memoryGB:16} → recommended='high'
2. setPreset('low') → 粒子关+阴影关+水墨关+30fps → 即时生效
   setPreset('high') → 粒子开+阴影开+水墨开+60fps → 水墨晕染0.6s过渡
3. setPreset('auto') → 检测硬件→自动选择档位
4. setAdvanced({ particleEffects:true, realTimeShadows:false })
   → 覆盖预设中的对应项, 其他保持预设值
5. GraphicsQualityManager.update(dt) → 监控帧率, auto模式动态调整
```
**验证**: 4档预设**即时生效**, 自动检测**CPU≥8核+内存≥8GB→高画质**

## P3: 数值验证 — 5维度验证 → 报告生成 → 偏差检测

```
1. BalanceValidator.init(deps)
   → 加载DEFAULT_RESOURCE_CONFIGS + HERO_BASE_STATS + DEFAULT_BATTLE_CONFIG
2. validateResource(grainConfig)
   → generateResourceCurve() → 曲线点生成
   → validateSingleResource() → 检查产出率/消耗率/储备量
   → entries=[{level:'info',...}] → deviation<10% → PASS
3. validateHero(heroConfig)
   → calcPower(baseStats, levelFactor, starFactor) → 战力值
   → validateSingleHero() → 检查战力曲线/成长率
   → deviation>20% → WARNING条目
4. generateReport() → BalanceReport汇总5维度
   → resources/heroes/battle/economy/rebirth
   → overallStatus='pass'|'warning'|'fail'
5. BalanceValidator.getState() → { lastReport: BalanceReport }
```
**验证**: 5维度验证**全覆盖**, deviation>20%→**WARNING触发**

## P4: 账号绑定 → 云存档同步 → 多设备管理 → 冲突解决

```
1. AccountSystem.bind('phone', '13800138000')
   → bindMethod='phone', isFirstBind=true → grantIngot(50)
   → bindings=[{method:'phone', id:'138****8000', boundAt:Date.now()}]
2. CloudSaveSystem.init(deps) → syncFrequency='on_exit'
   → autoSaveEnabled=true, wifiOnly=true, encrypt=true
   → sync() → encryptData(saveData) → upload → CloudSyncResult.success
3. AccountSystem.registerDevice({id:'dev-001', name:'iPhone 15'})
   → devices.length=1 ≤ MAX_DEVICES(5) → 成功
   → setPrimaryDevice('dev-001') → primaryDeviceId='dev-001'
4. 模拟冲突: 本地timestamp=100, 远程timestamp=200
   → resolveConflict('newest_wins') → 取远程(200>100)
   → mergeRemoteData(remote) → 本地更新
5. AccountSystem.requestDelete() → inputConfirmText('确认删除')
   → confirmDelete() → deleteFlow.state='cooling', 冷静期7天
   → cancelDelete() → 撤销, state='idle'
```
**验证**: 首次绑定**元宝×50**, 冲突解决**newest_wins生效**, 冷静期**可撤销**

## P5: 动画规范 — 过渡/状态/反馈3类 → AnimationAuditor注册审计

```
1. AnimationController.applySettings(animSettings)
   → 注册ALL_ANIMATION_SPECS(过渡/状态/反馈/装饰4类)
2. playTransition('panel_open', {duration:300, easing:'ease-out'})
   → 匹配spec: {category:'transition', durationMs:300} → 合规
3. playTransition('panel_open', {duration:500})
   → spec.durationMs=300 ≠ 500 → AnimationAuditor记录违规
4. AnimationAuditor.audit() → report
   → totalSpecs=N, violations=1, summary={transition:1 violation}
5. AnimationController.playInkWashTransition()
   → 水墨晕染特效(0.6s) → 回调onComplete
```
**验证**: 动画规范**自动审计**, 违规**可检测**, 水墨过渡**0.6s**

---

## 交叉验证矩阵

| 流程 | AudioCtrl | GraphicsQM | BalanceValidator | BalanceCalc | BalanceReport | AccountSys | CloudSave | AnimationCtrl | AnimationAuditor |
|------|:---------:|:----------:|:----------------:|:-----------:|:-------------:|:----------:|:---------:|:-------------:|:----------------:|
| P1   | ✅ | — | — | — | — | — | — | — | — |
| P2   | — | ✅ | — | — | — | — | — | — | — |
| P3   | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| P4   | — | — | — | — | — | ✅ | ✅ | — | — |
| P5   | — | — | — | — | — | — | — | ✅ | ✅ |
