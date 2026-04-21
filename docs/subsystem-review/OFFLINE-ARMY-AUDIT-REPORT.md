# 三国霸业 v9.0(离线收益) & v10.0(兵强马壮) 引擎层代码审计报告

> 审计范围：`engine/offline/` 全部文件 + `engine/battle/` + `engine/hero/HeroFormation` + `engine/resource/` + `engine/engine-campaign-deps`
> 审计时间：2025-01
> 审计人：Game Developer Agent

---

## 一、v9.0 离线收益系统

### 🔴 P0（必须修复）

#### P0-01 | 离线收益无防重复领取机制
- **文件**: `engine/offline/OfflineRewardSystem.ts`
- **问题**: `calculateFullReward()` 和 `calculateSnapshot()` 是纯计算方法，没有任何 `claimed` / `pendingReward` 状态标记。`OfflineSnapshotSystem.clearSnapshot()` 虽然会清除快照，但 `OfflineRewardSystem` 本身不跟踪是否已领取。如果 UI 层多次调用 `calculateFullReward()` 并将结果传给 `ResourceSystem.addResource()`，玩家可以无限重复领取离线收益。
- **影响**: 玩家可利用刷新页面或重新登录无限刷取离线收益，严重破坏经济平衡。
- **建议修复**:
  ```typescript
  // OfflineRewardSystem 中增加状态
  private hasClaimed = false;
  private pendingReward: Resources | null = null;

  claimReward(): Resources | null {
    if (this.hasClaimed || !this.pendingReward) return null;
    this.hasClaimed = true;
    const reward = this.pendingReward;
    this.pendingReward = null;
    return reward;
  }
  ```

#### P0-02 | 离线收益计算存在两套独立实现，结果不一致
- **文件**: `engine/offline/OfflineRewardEngine.ts` vs `engine/offline/OfflineRewardSystem.ts` vs `engine/resource/OfflineEarningsCalculator.ts`
- **问题**: 存在 **三套** 独立的离线收益计算逻辑：
  1. `OfflineRewardEngine.calculateOfflineSnapshot()` — 使用 `ProductionRate` 类型
  2. `OfflineRewardSystem.calculateSnapshot()` — 使用 `Resources` 类型作为产出速率
  3. `OfflineEarningsCalculator.calculateOfflineEarnings()` — 使用 `ProductionRate` + `Bonuses`
  
  三者的参数类型不同（`ProductionRate` vs `Resources`），加成计算方式不同（`BonusSources` vs `Bonuses`），取整策略不同（`floorRes` vs 不取整）。`engine-save.ts:computeOfflineAndFinalize()` 使用的是 `ResourceSystem.applyOfflineEarnings()`，而 v9.0 面板使用 `OfflineRewardSystem.calculateFullReward()`，两者给出的收益数值可能不同。
- **影响**: 玩家看到的预览收益与实际领取收益不一致，引发客诉。
- **建议修复**: 统一为一套计算逻辑。`OfflineRewardSystem` 和 `OfflineEarningsCalculator` 应委托给同一个核心计算函数。

#### P0-03 | `OfflineRewardSystem.deserialize()` 无负数/NaN 防护
- **文件**: `engine/offline/OfflineRewardSystem.ts:291-297`
- **问题**: `deserialize()` 直接将存档数据写入内部状态，没有对 `boostItems` 的数量做负数检查，也没有对 `vipDoubleUsedToday` 做上限校验。恶意存档可以注入负数道具数量或超大的每日翻倍计数。
  ```typescript
  deserialize(data: OfflineSaveData): void {
    this.lastOfflineTime = data.lastOfflineTime;       // 无校验
    this.vipDoubleUsedToday = data.vipDoubleUsedToday;  // 可为负数
    // ...
    for (const [id, count] of Object.entries(data.boostItems)) {
      this.boostInventory.set(id, count);  // count 可为负数
    }
  }
  ```
- **影响**: 存档篡改可导致道具数量为负、翻倍计数异常。
- **建议修复**:
  ```typescript
  this.vipDoubleUsedToday = Math.max(0, Math.floor(data.vipDoubleUsedToday ?? 0));
  for (const [id, count] of Object.entries(data.boostItems)) {
    const safe = Math.max(0, Math.floor(count ?? 0));
    if (safe > 0) this.boostInventory.set(id, safe);
  }
  ```

#### P0-04 | `OfflineRewardSystem.applyDouble()` 翻倍后收益未取整
- **文件**: `engine/offline/OfflineRewardSystem.ts:140`
- **问题**: `applyDouble()` 中 `doubledEarned: mulRes(earned, multiplier)` 返回浮点数结果，没有调用 `floorRes()` 取整。而 `OfflineRewardEngine.applyDouble()` 正确使用了 `floorRes()`。
  ```typescript
  // OfflineRewardSystem — 缺少取整
  return { success: true, ..., doubledEarned: mulRes(earned, multiplier), ... };
  
  // OfflineRewardEngine — 正确取整
  return { success: true, ..., doubledEarned: floorRes(mulRes(earned, multiplier)), ... };
  ```
- **影响**: 资源出现小数值，UI 显示异常，累积误差。
- **建议修复**: `doubledEarned: floorRes(mulRes(earned, multiplier))`

---

### 🟡 P1（建议修复）

#### P1-01 | 离线收益无 NaN/Infinity 防护
- **文件**: `engine/offline/OfflineRewardEngine.ts`, `OfflineRewardSystem.ts`, `OfflineEstimateSystem.ts`
- **问题**: 所有计算函数均未检查输入参数是否为 `NaN` 或 `Infinity`。如果 `productionRates` 中某个值为 `NaN`（如存档损坏），收益计算结果全部变为 `NaN`，导致后续逻辑崩溃。
- **建议修复**: 在 `calculateOfflineSnapshot()` 和 `calculateSnapshot()` 入口增加防护：
  ```typescript
  if (!Number.isFinite(offlineSeconds) || offlineSeconds < 0) offlineSeconds = 0;
  ```

#### P1-02 | `OfflineSnapshotSystem.clearSnapshot()` 同时清除 `lastOfflineTime`
- **文件**: `engine/offline/OfflineSnapshotSystem.ts:363-367`
- **问题**: `clearSnapshot()` 将 `lastOfflineTime` 设为 0，这导致下次 `getOfflineSeconds()` 返回 0。如果玩家领取后立刻下线，下次上线无法正确计算离线时长。
  ```typescript
  clearSnapshot(): void {
    this.snapshot = null;
    this.saveData.lastOfflineTime = 0;  // 应该设为 Date.now() 而非 0
    this.persistSaveData();
  }
  ```
- **影响**: 领取离线收益后立刻下线的玩家，下次上线无离线收益。
- **建议修复**: `this.saveData.lastOfflineTime = Date.now();`

#### P1-03 | `OfflineRewardSystem.getVipBonus()` 对超出范围的 VIP 等级处理不当
- **文件**: `engine/offline/OfflineRewardSystem.ts:200-203`
- **问题**: 当 `vipLevel` 超过配置表最大值（5）时，`getVipBonus()` 返回 VIP5 的配置，这是合理的。但当传入负数时，循环中 `bonus.vipLevel <= vipLevel` 对 `vipLevel = -1` 不会匹配任何条目，`matched` 保持 `VIP_OFFLINE_BONUSES[0]`（VIP0），这倒是安全的。但代码意图不够清晰。
- **建议修复**: 增加 `vipLevel = Math.max(0, vipLevel)` 防护。

#### P1-04 | `OfflineTradeAndBoost.useBoostItem()` 加速收益不应用衰减
- **文件**: `engine/offline/OfflineTradeAndBoost.ts:82-90`
- **问题**: 加速道具的收益计算使用 100% 效率（无衰减），这与设计意图一致。但注释说"使用100%效率"，而道具描述是"增加X小时离线收益"，玩家可能期望获得与正常离线相同的收益（含衰减）。建议明确道具是否应该享受衰减。
- **建议修复**: 如果设计意图是100%效率，在代码注释和道具描述中明确标注"加速收益不享受衰减"。

#### P1-05 | `OfflineRewardSystem.calculateSnapshot()` 的 `offlineSeconds` 参数未封顶
- **文件**: `engine/offline/OfflineRewardSystem.ts:78-85`
- **问题**: `calculateSnapshot()` 内部用 `Math.min(offlineSeconds, MAX_OFFLINE_SECONDS)` 封顶了有效计算时长，但返回的 `OfflineSnapshot` 中 `offlineSeconds` 字段保存的是原始输入值（可能远超 72h）。`OfflineRewardEngine.calculateOfflineSnapshot()` 则正确地保存了封顶后的值。这导致面板显示的离线时长与实际计算时长不一致。
  ```typescript
  // OfflineRewardSystem — 保存原始值
  return { ..., offlineSeconds, ... };  // 原始值，可能 200h
  
  // OfflineRewardEngine — 保存封顶值
  const effectiveSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
  return { ..., offlineSeconds: effectiveSeconds, ... };  // 但实际用的是 offlineSeconds
  ```
  实际上 `OfflineRewardEngine` 也有问题：它返回的 `offlineSeconds` 是原始值而非封顶值。
- **建议修复**: 统一行为，`offlineSeconds` 字段保存原始值，增加 `effectiveSeconds` 字段。

#### P1-06 | `OfflinePanelHelper.estimateOfflineReward()` 的 `_calculateSnapshot` 参数未使用
- **文件**: `engine/offline/OfflinePanelHelper.ts:128`
- **问题**: 参数 `_calculateSnapshot` 标注为"向后兼容参数位"但从未使用，是死代码。
- **建议修复**: 删除此参数，或实际使用它。

---

### 🟢 P2（优化建议）

#### P2-01 | 离线收益计算函数大量重复
- **文件**: `OfflineRewardEngine.ts`, `OfflineRewardSystem.ts`, `OfflinePanelHelper.ts`, `OfflineEstimateSystem.ts`
- **问题**: 四个文件中各自实现了 `zeroRes()`, `mulRes()`, `addRes()`, `floorRes()` 辅助函数和衰减分段计算逻辑，代码高度重复。
- **建议修复**: 提取公共 `offline-utils.ts` 工具模块。

#### P2-02 | `OfflineEstimateSystem.getEfficiencyCurve()` 性能可优化
- **文件**: `engine/offline/OfflineEstimateSystem.ts:113-121`
- **问题**: 每次调用都遍历 1~72 小时，每小时遍历 5 个衰减档位，共 360 次迭代。由于衰减曲线是分段线性的，只需计算 5 个断点即可。
- **建议修复**: 只计算 0h/2h/8h/24h/48h/72h 六个关键点，中间线性插值。

#### P2-03 | `OfflineRewardSystem` 的 `offlineSeconds` 类型不一致
- **问题**: `calculateSnapshot()` 接受 `productionRates: Readonly<Resources>`，但 `OfflineRewardEngine.calculateOfflineSnapshot()` 接受 `productionRates: Readonly<ProductionRate>`。`Resources` 和 `ProductionRate` 虽然结构相同（都是 grain/gold/troops/mandate），但语义不同，混用容易出错。

---

## 二、v10.0 兵强马壮 — 军队/兵种系统

### 🔴 P0（必须修复）

#### P0-05 | 我方武将兵种类型硬编码为步兵
- **文件**: `engine/engine-campaign-deps.ts:136`
- **问题**: `generalToBattleUnit()` 中，所有我方武将的 `troopType` 都硬编码为 `TroopType.INFANTRY`，完全忽略了武将应有的兵种类型：
  ```typescript
  return {
    ...
    troopType: TroopType.INFANTRY,  // 所有武将都是步兵！
    ...
  };
  ```
  这意味着：
  - 所有我方武将都没有克制关系收益（骑兵对步兵的克制加成永远无法获得）
  - 枪兵对我方所有武将都有克制优势
  - 科技系统中兵种专属加成（如 `troop_attack: 'cavalry'`）对我方完全无效
- **影响**: v10.0 兵强马壮的核心玩法（兵种克制+兵种加成）完全失效。
- **建议修复**: 在 `GeneralData` 中增加 `troopType` 字段，或根据武将属性/阵营自动分配兵种：
  ```typescript
  // 方案1: GeneralData 增加 troopType
  troopType: g.troopType ?? TroopType.INFANTRY,
  
  // 方案2: 根据属性推断
  function inferTroopType(stats: GeneralStats): TroopType {
    if (stats.speed > stats.defense) return TroopType.CAVALRY;
    if (stats.intelligence > stats.attack) return TroopType.STRATEGIST;
    // ...
  }
  ```

#### P0-06 | 战斗系统无兵力(troops)消耗机制
- **文件**: `engine/battle/BattleEngine.ts`, `engine/battle/BattleTurnExecutor.ts`
- **问题**: 战斗系统使用 `BattleUnit.hp` 作为生命值，战斗结束后 HP 扣减仅存在于战斗状态中，**不会**反映到全局资源 `troops` 上。`BattleEngine.runFullBattle()` 返回 `BattleResult` 后，没有任何代码将战斗损失转化为 `troops` 资源消耗。
  
  具体问题：
  1. 战斗失败不消耗兵力
  2. 战斗胜利不消耗兵力（即使我方有伤亡）
  3. 不存在"战后兵力恢复"机制
- **影响**: v10.0 的核心资源循环（兵力消耗→补充→再战）不存在，兵力资源形同虚设。
- **建议修复**: 在战斗结束后增加兵力消耗计算：
  ```typescript
  // BattleEngine 或 engine-campaign-deps 中
  function calculateTroopLoss(allyTeam: BattleTeam): number {
    return allyTeam.units.reduce((loss, u) => {
      const hpLoss = u.maxHp - u.hp;
      return loss + Math.ceil(hpLoss / 100); // 按比例折算兵力
    }, 0);
  }
  ```

---

### 🟡 P1（建议修复）

#### P1-07 | `HeroFormation` 允许同一武将出现在多个编队
- **文件**: `engine/hero/HeroFormation.ts:115-127`
- **问题**: `addToFormation()` 只检查武将是否在 **当前编队** 中（`formation.slots.includes(generalId)`），不检查是否在其他编队中。`isGeneralInAnyFormation()` 方法存在但未在 `addToFormation()` 中使用。
  ```typescript
  addToFormation(id: string, generalId: string): FormationData | null {
    const formation = this.state.formations[id];
    if (!formation) return null;
    if (formation.slots.includes(generalId)) return null;  // 只检查当前编队
    // 应该增加: if (this.isGeneralInAnyFormation(generalId)) return null;
    ...
  }
  ```
- **影响**: 同一武将可同时出现在多个编队，战斗中可能出现"影子武将"。
- **建议修复**: 在 `addToFormation()` 中增加跨编队检查，或提供配置开关。

#### P1-08 | 编队系统无武将有效性校验
- **文件**: `engine/hero/HeroFormation.ts`
- **问题**: `setFormation()` 和 `addToFormation()` 只存储武将 ID 字符串，不验证该 ID 对应的武将是否真实存在。如果武将被删除/消耗（如碎片合成消耗），编队中会残留无效 ID。
- **建议修复**: `deserialize()` 后增加校验步骤，或在 `addToFormation()` 中增加可选的验证回调。

#### P1-09 | `autoFormation()` 空候选列表导致无效调用
- **文件**: `engine/hero/HeroFormation.ts:193-200`
- **问题**: `autoFormation()` 内部调用 `autoFormationByIds([], ...)` 传入空数组，导致永远返回 `null`。方法注释说"通过外部传入的 getGeneral 遍历"，但实际无法实现。这是一个 **不可用的公共 API**。
  ```typescript
  autoFormation(...): FormationData | null {
    // ...
    return this.autoFormationByIds(
      [], // 空列表 → 永远返回 null
      ...
    );
  }
  ```
- **建议修复**: 要么删除 `autoFormation()` 方法（只保留 `autoFormationByIds`），要么增加 `allGeneralIds` 参数。

#### P1-10 | `DamageCalculator` 暴击率无上限保护（极端情况）
- **文件**: `engine/battle/DamageCalculator.ts:82-85`
- **问题**: 暴击率公式 `5% + speed/100`。当速度超过 100 时暴击率超过 100%。虽然有 `Math.min(1.0, ...)` 保护，但如果速度为负数或 NaN，结果可能异常。
- **建议修复**: 增加 `Math.max(0, ...)` 保护：
  ```typescript
  return Math.min(1.0, Math.max(0.0, rate));
  ```
  当前代码已有 `Math.max(0.0, rate)`，此处确认已修复。但 `speed` 为 NaN 时仍会穿透。

#### P1-11 | 战斗伤害计算无整数溢出保护
- **文件**: `engine/battle/DamageCalculator.ts:115-120`
- **问题**: 最终伤害 `damageAfterSkill * criticalMultiplier * restraintMultiplier * randomFactor` 是浮点连乘。如果攻击力极大（如通过存档篡改），伤害值可能超过 `Number.MAX_SAFE_INTEGER`，导致精度丢失。
- **建议修复**: 增加 `Math.min(Number.MAX_SAFE_INTEGER, ...)` 封顶。

#### P1-12 | `BattleEngine.runFullBattle()` 无最大回合保护
- **文件**: `engine/battle/BattleEngine.ts:163-175`
- **问题**: `while` 循环条件是 `state.currentTurn <= state.maxTurns`，但 `executeTurn()` 内部也可能递增 `currentTurn`（通过 `endTurn`）。如果 `executeTurn` 内部有 bug 导致不推进回合，可能死循环。
  ```typescript
  while (state.phase === BattlePhase.IN_PROGRESS && state.currentTurn <= state.maxTurns) {
    this.executeTurn(state);
    if (this.isBattleOver(state)) break;
    state.currentTurn++;  // 这里递增，但 executeTurn 内部 endTurn 也可能触发 FINISHED
  }
  ```
- **建议修复**: 增加硬性安全退出：
  ```typescript
  let safetyCounter = 0;
  while (... && safetyCounter++ < 100) { ... }
  ```

---

### 🟢 P2（优化建议）

#### P2-04 | 兵种克制关系表缺少弓兵/谋士的特殊交互
- **文件**: `engine/battle/battle.types.ts:31-35` 和 `DamageCalculator.ts:35-41`
- **问题**: 注释说"弓兵、谋士无特殊克制关系"，这意味着弓兵和谋士在任何对局中都是 1.0 系数，缺乏策略深度。通常弓兵克制后排/谋士，被骑兵冲锋克制。
- **建议修复**: 考虑增加弓兵对后排的加成或骑兵对弓兵的克制。

#### P2-05 | `BattleUnit` 的 `attack`/`defense` 与 `baseAttack`/`baseDefense` 同步问题
- **文件**: `engine/battle/battle.types.ts`
- **问题**: `BattleUnit` 同时有 `attack`/`baseAttack` 和 `defense`/`baseDefense`。`DamageCalculator` 使用 `attacker.attack`（含 Buff 修正值），但 Buff 的 `ATK_UP`/`ATK_DOWN` 是在 `calculateDamage()` 中通过 `getAttackBonus()` 临时计算的，并未写回 `attack` 字段。这意味着 `attack` 字段实际上等于 `baseAttack`，两套字段冗余。
- **建议修复**: 要么在 Buff 应用时更新 `attack`/`defense`，要么删除 `baseAttack`/`baseDefense` 字段。

#### P2-06 | `generalToBattleUnit()` 中武将技能全部映射为相同倍率
- **文件**: `engine/engine-campaign-deps.ts:155-160`
- **问题**: 所有武将技能都被映射为 `multiplier: 1.5`，`rageCost: 50`，`cooldown: 3`，丢失了技能差异化。
  ```typescript
  const skills: BattleSkill[] = (g.skills ?? []).map((s) => ({
    ..., multiplier: 1.5,           // 全部 1.5
    rageCost: 50, cooldown: 3,      // 全部相同
  }));
  ```
- **建议修复**: 在 `SkillData` 中增加 `multiplier`/`rageCost`/`cooldown` 字段，或根据技能类型/品质差异化配置。

#### P2-07 | `autoFormation()` 布阵策略过于简单
- **文件**: `engine/battle/BattleEngine.ts:autoFormation()`
- **问题**: 布阵策略仅按防御排序，前排放防御最高的3个。未考虑：
  - 兵种搭配（前排骑兵+步兵，后排弓兵+谋士）
  - 阵营羁绊
  - 武将技能协同
- **建议修复**: 增加基于兵种的智能布阵策略。

---

## 三、通用问题

### 🔴 P0

#### P0-07 | 资源系统无整数溢出保护
- **文件**: `engine/resource/ResourceSystem.ts:addResource()`
- **问题**: `addResource()` 中 `before + amount` 可能超过 `Number.MAX_SAFE_INTEGER`（约 9×10¹⁵）。长时间运行的存档（如几年）在高产出速率下可能触发。
- **建议修复**: 增加 `Math.min(before + amount, Number.MAX_SAFE_INTEGER)` 封顶。

#### P0-08 | `ResourceSystem.deserialize()` 的类型转换不安全
- **文件**: `engine/resource/ResourceSystem.ts` (deserialize 方法)
- **问题**: `Math.max(0, Number(val) || 0) as any` 使用 `as any` 强制类型转换，`Number(val)` 对 `undefined` 返回 `NaN`，`NaN || 0` 返回 `0`，这虽然安全但依赖隐式转换。对 `Infinity` 值无防护。
- **建议修复**: 使用 `Number.isFinite(val) ? val : 0` 替代。

---

### 🟡 P1

#### P1-13 | 两套离线收益配置（`resource-config.ts` vs `offline-config.ts`）
- **文件**: `engine/resource/resource-config.ts:OFFLINE_TIERS` vs `engine/offline/offline-config.ts:DECAY_TIERS`
- **问题**: 两处定义了相同的 5 档衰减配置，但格式不同：
  - `resource-config.ts` 用秒（`startSeconds`/`endSeconds`）
  - `offline-config.ts` 用小时（`startHours`/`endHours`）
  
  如果修改一处忘记同步另一处，会导致离线收益计算不一致。
- **建议修复**: 统一为一处配置，另一处引用。

#### P1-14 | `OfflineSnapshotSystem` 直接操作 `localStorage`
- **文件**: `engine/offline/OfflineSnapshotSystem.ts:342-355`
- **问题**: `OfflineSnapshotSystem` 直接读写 `localStorage`，而引擎其他子系统（如 `ResourceSystem`）通过外部 `SaveManager` 管理存档。这导致存档管理分散，可能产生竞争条件。
- **建议修复**: 移除直接 `localStorage` 操作，统一通过依赖注入的存储接口。

---

## 四、问题汇总

| 级别 | 编号 | 子系统 | 问题描述 |
|------|------|--------|----------|
| 🔴 P0 | P0-01 | 离线收益 | 无防重复领取机制 |
| 🔴 P0 | P0-02 | 离线收益 | 三套独立计算逻辑结果不一致 |
| 🔴 P0 | P0-03 | 离线收益 | deserialize 无负数/NaN 防护 |
| 🔴 P0 | P0-04 | 离线收益 | 翻倍后收益未取整 |
| 🔴 P0 | P0-05 | 兵种系统 | 我方武将兵种硬编码为步兵 |
| 🔴 P0 | P0-06 | 兵种系统 | 战斗无兵力消耗机制 |
| 🔴 P0 | P0-07 | 资源系统 | 无整数溢出保护 |
| 🔴 P0 | P0-08 | 资源系统 | deserialize 类型转换不安全 |
| 🟡 P1 | P1-01 | 离线收益 | 无 NaN/Infinity 防护 |
| 🟡 P1 | P1-02 | 离线收益 | clearSnapshot 清除时间戳导致下次无收益 |
| 🟡 P1 | P1-03 | 离线收益 | VIP 等级边界处理 |
| 🟡 P1 | P1-04 | 离线收益 | 加速道具收益策略不明确 |
| 🟡 P1 | P1-05 | 离线收益 | offlineSeconds 字段语义不一致 |
| 🟡 P1 | P1-06 | 离线收益 | 死代码参数 |
| 🟡 P1 | P1-07 | 编队系统 | 同一武将可出现在多个编队 |
| 🟡 P1 | P1-08 | 编队系统 | 无武将有效性校验 |
| 🟡 P1 | P1-09 | 编队系统 | autoFormation() 永远返回 null |
| 🟡 P1 | P1-10 | 战斗系统 | 暴击率 NaN 穿透 |
| 🟡 P1 | P1-11 | 战斗系统 | 伤害无溢出保护 |
| 🟡 P1 | P1-12 | 战斗系统 | runFullBattle 潜在死循环 |
| 🟡 P1 | P1-13 | 通用 | 两套离线衰减配置 |
| 🟡 P1 | P1-14 | 通用 | 直接操作 localStorage |
| 🟢 P2 | P2-01 | 离线收益 | 辅助函数大量重复 |
| 🟢 P2 | P2-02 | 离线收益 | 效率曲线计算可优化 |
| 🟢 P2 | P2-03 | 离线收益 | Resources vs ProductionRate 类型混用 |
| 🟢 P2 | P2-04 | 兵种系统 | 弓兵/谋士无克制交互 |
| 🟢 P2 | P2-05 | 兵种系统 | attack/baseAttack 冗余 |
| 🟢 P2 | P2-06 | 兵种系统 | 技能倍率全部相同 |
| 🟢 P2 | P2-07 | 兵种系统 | 布阵策略过于简单 |

**统计**: 🔴 P0 × 8 | 🟡 P1 × 14 | 🟢 P2 × 7 = **29 个问题**

---

## 五、优先修复建议

### 第一优先级（影响核心玩法）
1. **P0-05** — 武将兵种硬编码 → v10.0 核心玩法完全失效
2. **P0-06** — 战斗无兵力消耗 → v10.0 资源循环断裂
3. **P0-01** — 离线收益可重复领取 → 经济系统崩溃

### 第二优先级（数据一致性）
4. **P0-02** — 统一离线收益计算逻辑
5. **P0-03/P0-08** — 存档反序列化防护
6. **P0-04** — 翻倍收益取整

### 第三优先级（体验优化）
7. **P1-02** — clearSnapshot 时间戳修复
8. **P1-07** — 编队武将唯一性
9. **P1-09** — autoFormation 修复
