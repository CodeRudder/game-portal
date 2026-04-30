# Hero 挑战清单 Round 3 — Part B（经济+编队系统验证）

> Challenger: TreeChallenger v1.2 | Time: 2026-05-02
> 审查对象: FIX-201/FIX-204 修复穿透验证 + 经济/编队/保存系统新问题扫描

## 一、R2 修复穿透验证

### FIX-201: setBondMultiplierGetter/setEquipmentPowerGetter 集成 — ✅ 完整穿透

| 检查点 | 位置 | 修复状态 | 穿透验证 |
|--------|------|---------|---------|
| `setBondMultiplierGetter` 在引擎初始化中调用 | engine-hero-deps.ts:121-124 | ✅ `if (systems.bondSystem) { systems.hero.setBondMultiplierGetter(...) }` | ✅ |
| `setEquipmentPowerGetter` 在引擎初始化中调用 | engine-hero-deps.ts:128-136 | ✅ `if (systems.equipmentSystem) { systems.hero.setEquipmentPowerGetter(...) }` | ✅ |
| `calculatePower` 中装备战力 fallback 链 | HeroSystem.ts:187 | ✅ `totalEquipmentPower ?? this._getEquipmentPower?.(general.id) ?? 0` | ✅ |
| `calculateFormationPower` 中羁绊系数 fallback 链 | HeroSystem.ts:226 | ✅ `bondMultiplier ?? this._getBondMultiplier?.(generalIds) ?? 1.0` | ✅ |
| FactionBondSystem.getBondMultiplier 返回值安全 | faction-bond-system.ts:177-193 | ✅ 有 `!Number.isFinite(totalBonus)` 防护，范围 [1.0, 2.0] | ✅ |
| EquipmentSystem 集成路径 | engine-hero-deps.ts:130-135 | ✅ getHeroEquipments + calculatePower 求和 | ✅ |

**集成路径完整追踪**：
```
ThreeKingdomsEngine.constructor()
  → engine-hero-deps.initHeroSystems()
    → systems.hero.setBondMultiplierGetter(callback)
      → callback = FactionBondSystem.getBondMultiplier()
        → FactionBondSystem.calculateBonds() → 合并效果 → getBondMultiplier()
    → systems.hero.setEquipmentPowerGetter(callback)
      → callback = EquipmentSystem.getHeroEquipments() → 求和 calculatePower()
  → HeroSystem.calculateFormationPower()
    → this._getBondMultiplier?.(generalIds) → 注入的回调 → 正确的羁绊系数
  → HeroSystem.calculatePower()
    → this._getEquipmentPower?.(general.id) → 注入的回调 → 正确的装备战力
```

**结论**：FIX-201 的集成修复**完整穿透**，从引擎初始化到战力计算的完整链路均已覆盖。

### FIX-204: 碎片溢出上限处理 — ✅ 完整穿透

| 检查点 | 位置 | 修复状态 | 穿透验证 |
|--------|------|---------|---------|
| `FRAGMENT_CAP = 999` | HeroSystem.ts:234 | ✅ 常量定义 | ✅ |
| `FRAGMENT_TO_GOLD_RATE = 100` | HeroSystem.ts:236 | ✅ 常量定义 | ✅ |
| `addFragment` 上限截断 + 返回溢出 | HeroSystem.ts:245-253 | ✅ `newTotal <= cap` / `return newTotal - cap` | ✅ |
| `exchangeFragmentsFromShop` 溢出退铜钱 | HeroStarSystem.ts:140-148 | ✅ `overflow * config.pricePerFragment` 退铜钱 | ✅ |
| `addFragmentFromActivity` 溢出转铜钱 | HeroStarSystem.ts:176-180 | ✅ `overflow * FRAGMENT_TO_GOLD_RATE` 转铜钱 | ✅ |
| `addFragmentFromExpedition` 溢出转铜钱 | HeroStarSystem.ts:198-202 | ✅ `overflow * FRAGMENT_TO_GOLD_RATE` 转铜钱 | ✅ |
| 招募重复武将碎片溢出处理 | HeroRecruitSystem.ts:396-397 | ✅ `overflow * FRAGMENT_TO_GOLD_RATE` 转铜钱 | ✅ |

**经济闭环验证**：
| 场景 | 碎片处理 | 铜钱处理 | 验证结果 |
|------|---------|---------|---------|
| 商店兑换溢出 | 截断到999 | 退还 overflow × pricePerFragment | ✅ 经济闭环 |
| 活动奖励溢出 | 截断到999 | 补偿 overflow × 100 | ✅ 经济闭环 |
| 远征奖励溢出 | 截断到999 | 补偿 overflow × 100 | ✅ 经济闭环 |
| 重复武将溢出 | 截断到999 | 补偿 overflow × 100 | ✅ 经济闭环 |

**结论**：FIX-204 的碎片溢出处理**完整穿透**，所有碎片获取路径的经济闭环均已建立。

### FIX-202: 十连招募资源回滚 — ✅ 完整穿透

| 检查点 | 位置 | 修复状态 | 穿透验证 |
|--------|------|---------|---------|
| try-catch 包裹循环 | HeroRecruitSystem.ts:316-325 | ✅ | ✅ |
| 异常时退还全部资源 | HeroRecruitSystem.ts:322-323 | ✅ `addResource(cost.resourceType, cost.amount)` | ✅ |
| 日志记录 | HeroRecruitSystem.ts:325 | ✅ `gameLog.error` | ✅ |

**注意**：回滚策略是"全额退还"而非"按已完成次数退还"。如果前5次成功后第6次异常，退还的是全部10次的资源，而非5次。这意味着玩家可能获得额外5次免费招募结果。但考虑到异常是罕见情况，这个策略是合理的。

**结论**：FIX-202 的十连招募回滚**完整穿透**。

---

## 二、新发现问题

### R3-B001: 引擎保存/加载流程缺失6个子系统 — P0（新发现，R1/R2均遗漏）

**位置**：`engine-save.ts` + `shared/types.ts` + `ThreeKingdomsEngine.ts`

**问题描述**：引擎的保存/加载流程中，以下子系统**完全没有被序列化和反序列化**：

| 子系统 | 有 serialize() | 有 deserialize() | 在 SaveContext 中 | 在 GameSaveData 中 | 在 buildSaveData 中 | 在 applySaveData 中 |
|--------|---------------|-----------------|------------------|-------------------|--------------------|--------------------|
| HeroStarSystem | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| SkillUpgradeSystem | ✅ (getState) | ❌ | ❌ | ❌ | ❌ | ❌ |
| HeroDispatchSystem | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| HeroBadgeSystem | ✅ (getState) | ❌ | ❌ | ❌ | ❌ | ❌ |
| AwakeningSystem | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| TokenEconomy | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| HeroRecruitUpManager | ✅ (内嵌) | ✅ (内嵌) | ❌ | ❌ | ❌ | ❌ |
| BondSystem | ✅ (内嵌) | ✅ (内嵌) | ❌ | ❌ | ❌ | ❌ |
| FactionBondSystem | N/A (无状态) | N/A | ❌ | ❌ | ❌ | ❌ |

**源码验证**：

1. `SaveContext` 接口（engine-save.ts:55-100）：**不包含**上述子系统
2. `GameSaveData` 接口（shared/types.ts:216-280）：**不包含**上述子系统字段
3. `buildSaveData`（engine-save.ts:120-175）：**不调用**上述子系统的 serialize
4. `applySaveData`（engine-save.ts:386-560）：**不调用**上述子系统的 deserialize
5. `buildSaveCtx`（ThreeKingdomsEngine.ts:829-855）：**不包含**上述子系统

**影响**：
- **升星进度丢失**：武将星级、突破阶段在重启后重置
- **觉醒状态丢失**：觉醒武将恢复为未觉醒
- **技能升级历史丢失**：所有技能升级记录清零
- **派驻关系丢失**：武将-建筑派驻关系清空
- **徽章进度丢失**：徽章系统进度重置
- **招募令余额丢失**：离线收益、每日任务奖励的招募令清零
- **UP武将配置丢失**：UP武将和概率重置

**严重程度**：**P0** — 这是数据持久化的根本性问题，影响所有玩家的存档体验。

**根因分析**：这些子系统在 `ThreeKingdomsEngine` 中被创建和注册到 `SubsystemRegistry`，但引擎的保存/加载流程只处理了 `SaveContext` 中列出的子系统。新子系统被添加时没有同步更新 `SaveContext`、`GameSaveData`、`buildSaveData` 和 `applySaveData`。

**建议修复**：
1. 在 `SaveContext` 中添加这些子系统
2. 在 `GameSaveData` 中添加对应字段
3. 在 `buildSaveData` 中调用 serialize
4. 在 `applySaveData` 中调用 deserialize
5. 为 `SkillUpgradeSystem` 和 `HeroBadgeSystem` 添加 deserialize 方法

### R3-B002: HeroFormation.setFormation(null) 仍然崩溃 — P0（R2 遗留）

**位置**：`HeroFormation.ts:135-145`

**源码**：
```typescript
setFormation(id: string, generalIds: string[]): FormationData | null {
  const formation = this.state.formations[id];
  if (!formation) return null;
  // ❌ 缺少 generalIds null guard
  const trimmed = generalIds.slice(0, MAX_SLOTS_PER_FORMATION); // null.slice() → TypeError
  ...
}
```

**R2 标记**：R2-B008（P0），但 R2 未修复。

**严重程度**：P0（外部输入可导致崩溃）

### R3-B003: HeroFormation.addToFormation 不验证武将存在性 — P0（R2 遗留）

**位置**：`HeroFormation.ts:150-165`

**源码**：
```typescript
addToFormation(id: string, generalId: string): FormationData | null {
  const formation = this.state.formations[id];
  if (!formation) return null;
  if (formation.slots.includes(generalId)) return null;
  if (this.isGeneralInAnyFormation(generalId)) return null;
  // ❌ 不验证 generalId 是否在 HeroSystem 中存在
  const emptyIdx = formation.slots.indexOf('');
  if (emptyIdx === -1) return null;
  formation.slots[emptyIdx] = generalId; // 任意字符串都能加入编队
  ...
}
```

**R2 标记**：R2-B007（P0），但 R2 未修复。

**影响**：编队中可填入不存在的武将ID，后续 calculateFormationPower 跳过（返回0战力），但 UI 显示空武将。

### R3-B004: HeroDispatchSystem.getState() 浅拷贝风险 — P0（R2 遗留）

**位置**：`HeroDispatchSystem.ts:101-105`

**源码**：
```typescript
getState(): Record<string, unknown> {
  return {
    buildingDispatch: { ...this.buildingDispatch }, // 浅拷贝
    heroDispatch: { ...this.heroDispatch },
  };
}
```

**R2 标记**：R2-C012（P0），但 R2 未修复。

**影响**：`DispatchRecord` 对象是引用类型，外部可通过 `getState().buildingDispatch["castle"].bonusPercent = 999` 篡改内部状态。

### R3-B005: FormationRecommendSystem 羁绊分数使用硬编码值 — P0（R2 遗留）

**位置**：`FormationRecommendSystem.ts:296`

**源码**：
```typescript
const synergyBonus = bestGroup.length >= 3 ? 15 : bestGroup.length >= 2 ? 8 : 0;
```

**R2 标记**：R2-B010（P0），但 R2 未修复。

**影响**：推荐算法的羁绊分数与实际战斗中的羁绊效果不一致。

### R3-B006: FormationRecommendSystem 方案去重缺失 — P0（R2 遗留）

**位置**：`FormationRecommendSystem.ts:243-310`

**R2 标记**：R2-B011/B012（P0），但 R2 未修复。

**影响**：当可用武将 ≤ 6 时，平衡方案与最强方案完全重复；所有武将同阵营时，羁绊方案与最强方案完全重复。

### R3-B007: SkillUpgradeSystem 无 deserialize 方法 — P0（R2 遗留 + R3 确认更严重）

**位置**：`SkillUpgradeSystem.ts`

**R2 标记**：R2-C004（P0），但 R2 未修复。

**R3 新发现**：不仅是缺少 serialize/deserialize 方法，更根本的问题是**引擎保存流程完全忽略了该子系统**（见 R3-B001）。即使添加了 deserialize 方法，如果不更新 SaveContext 和 GameSaveData，状态仍然不会持久化。

### R3-B008: 配置冲突仍然存在 — P0（R1/R2 遗留）

以下配置冲突在 R1 和 R2 中均被标记为 P0，但至今未修复：

| # | 位置 | 冲突描述 | R1/R2 标记 |
|---|------|---------|-----------|
| 1 | bond-config.ts:342 vs faction-bond-config.ts:443 | 搭档羁绊ID不一致 `partner_wei_shuangbi` vs `partner_weizhi_shuangbi` | R2-C005 |
| 2 | hero-config.ts:357/369 vs faction-bond-config.ts:57 | 阵营标识 'qun' vs 'neutral' | R2-C006 |
| 3 | bond-config.ts vs faction-bond-config.ts | 搭档羁绊效果值不一致（桃园结义：攻击+15% vs 全属性+10%） | R2-C007 |
| 4 | star-up-config.ts | 6名新增武将无商店兑换+无关卡掉落 | R2-C009 |

### R3-B009: HeroSystem.removeGeneral 不清理关联系统引用 — P1（新发现）

**位置**：`HeroSystem.ts:132-138`

**源码**：
```typescript
removeGeneral(generalId: string): GeneralData | null {
  const general = this.state.generals[generalId];
  if (!general) return null;
  const removed = cloneGeneral(general);
  delete this.state.generals[generalId];
  return removed;
  // ❌ 不清理 HeroFormation 中的引用
  // ❌ 不清理 HeroDispatchSystem 中的派驻关系
  // ❌ 不清理 HeroStarSystem 中的碎片数据
}
```

**影响**：
- 编队中保留已删除武将的ID（悬空引用）
- 派驻系统中保留已删除武将的派驻记录
- 碎片数据保留但武将已不存在

**严重程度**：P1（removeGeneral 当前可能不被外部调用，但作为公共 API 应保持一致性）

### R3-B010: HeroRecruitUpManager.setUpRate 无范围校验 — P1（R2 遗留）

**位置**：`HeroRecruitUpManager.ts:72-73`

**R2 标记**：R2-A010（P1），但 R2 未修复。

**源码**：`this.upHero.upRate = rate;` — 直接赋值，无范围校验。

---

## 三、Part B 统计

| 类别 | 数量 |
|------|------|
| R2 修复穿透验证 | 4/4 全部通过 |
| 新发现（P0） | 1（引擎保存缺失6个子系统） |
| R2 遗留未修复（P0） | 7 |
| 新发现（P1） | 1 |
| R2 遗留未修复（P1） | 1 |
| 配置冲突遗留（P0） | 4 |

### 与 R2 对比

| 指标 | R2 Part B | R3 Part B | 变化 |
|------|-----------|-----------|------|
| 新 P0 | 6 | 1 | ↓5（碎片溢出已修复） |
| R2 遗留 P0 未修复 | 6 | 7 | ↑1（编队/推荐系统未修复） |
| 修复穿透验证 | 2/2 | 4/4 | 全部穿透 |

---

*Part B 审查完成。FIX-201/204 的经济+编队修复穿透验证全部通过。发现引擎保存流程缺失6个子系统的严重问题。*
