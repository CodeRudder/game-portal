# Bond R1 — Arbiter 裁决报告

> Arbiter Agent | 2026-05-01 | BondSystem (engine/bond/BondSystem.ts)

## 裁决摘要

| 指标 | 数值 |
|------|------|
| Builder P0 节点 | 18 |
| Challenger P0 缺陷 | 8 (含8个独立P0) |
| 裁决确认 P0 | 8 |
| 裁决降级 P0→P1 | 0 |
| 裁决升级 P1→P0 | 0 |
| 需修复 FIX | 7 |

## P0 裁决明细

### FIX-B01: addFavorability NaN/Infinity/负数/上限防护 ✅ CONFIRMED P0
- **Challenger**: P0-001 + P0-002
- **Builder**: T4-N03, T4-N05, T4-N07
- **裁决**: 确认。NaN注入可绕过好感度检查（NaN < 50 = false），Infinity导致序列化数据丢失（JSON.stringify(Infinity) = null）。无上限违反BR-022。
- **修复方案**: 
  1. 入口检查 `!Number.isFinite(amount) || amount <= 0` → early return
  2. 添加 `MAX_FAVORABILITY = 99999` 常量
  3. `fav.value = Math.min(MAX_FAVORABILITY, fav.value + amount)`
- **穿透验证**: triggerStoryEvent 内部调用 addFavorability，但已在 FIX-B04 中处理前置条件，此处只需防护 addFavorability 自身

### FIX-B02: loadSaveData null/undefined输入防护 ✅ CONFIRMED P0
- **Challenger**: P0-003
- **Builder**: T7-N04, T7-N05
- **裁决**: 确认。`loadSaveData(null)` 直接崩溃，`loadSaveData({version:1})` 中 `[...undefined]` 崩溃。
- **修复方案**: 
  ```typescript
  if (!data) return;
  const favs = data.favorabilities ?? {};
  const events = data.completedStoryEvents ?? [];
  ```

### FIX-B03: BondSystem 引擎存档接入（六处同步） ✅ CONFIRMED P0
- **Challenger**: P0-004
- **Builder**: T9-N01~N06
- **裁决**: 确认。这是最严重的系统性缺陷——好感度和故事事件进度在每次保存/加载后全部丢失。需同步修改六处：
  1. `SaveContext` 添加 `bond?: BondSystem` 字段
  2. `GameSaveData` 添加 `bond?: BondSaveData` 字段
  3. `buildSaveCtx()` 添加 `bond: this.bondSystem`
  4. `buildSaveData()` 添加 `bond: ctx.bond?.serialize()`
  5. `applySaveData()` 添加 `if (data.bond && ctx.bond) ctx.bond.loadSaveData(data.bond)`
  6. `toIGameState()` + `fromIGameState()` 添加 bond 字段
- **规则**: BR-014(保存/加载覆盖扫描), BR-015(deserialize覆盖验证六处)

### FIX-B04: triggerStoryEvent 前置条件校验 ✅ CONFIRMED P0
- **Challenger**: P0-005
- **Builder**: T5-N05
- **裁决**: 确认。triggerStoryEvent 不校验任何前置条件（武将存在、好感度、等级、前置事件），可直接调用获取奖励。
- **修复方案**: 在 triggerStoryEvent 中添加前置条件校验，需要传入 heroes Map 或通过回调获取。由于 triggerStoryEvent 当前签名不包含 heroes 参数，需要：
  1. 方案A：添加 setCallbacks 中的 `getHeroesMap` 回调
  2. 方案B：在 triggerStoryEvent 中使用 `this.getFormationHeroes` 回调
  - 选择方案A：添加 `getHeroesMap` 回调，因为故事事件需要全武将Map而非仅编队武将

### FIX-B05: triggerStoryEvent deps初始化检查 ✅ CONFIRMED P0
- **Challenger**: P0-006
- **Builder**: T5-N06
- **裁决**: 确认。未init时 `this.deps` 为 undefined，调用 eventBus.emit 崩溃。
- **修复方案**: 在 triggerStoryEvent 开头检查 `if (!this.deps)` return error

### FIX-B06: getAvailableStoryEvents null防护 ✅ CONFIRMED P0
- **Challenger**: P0-007
- **Builder**: T6-N07
- **裁决**: 确认。`heroes.has()` 在 heroes 为 null 时崩溃。
- **修复方案**: `if (!heroes) return []`

### FIX-B07: getFactionDistribution faction有效性检查 ✅ CONFIRMED P0
- **Challenger**: P0-008
- **Builder**: T1-N04
- **裁决**: 确认。`dist[hero.faction]++` 当 faction 为 undefined 时静默创建无效key。
- **修复方案**: 添加 `if (hero.faction && hero.faction in dist)` 检查

## P1 裁决（本轮不修复，记录追踪）

| P1 ID | 描述 | 裁决 |
|-------|------|------|
| P1-001 | getBondEffect 无效BondType | 追踪至R2 |
| P1-002 | heroId空字符串 | 追踪至R2 |
| P1-003 | 双BondSystem name冲突 | 追踪至R2（需架构决策） |
| P1-004 | STORY_EVENTS无前置事件链 | 追踪至R2 |
| P1-005 | loadSaveData无版本兼容 | 追踪至R2 |

## 覆盖率评估

| 维度 | 评分 | 说明 |
|------|------|------|
| Normal flow | 90% | 18个公开API中16个有F-Normal节点 |
| Boundary | 70% | 空数组/空编队已覆盖，缺少极端大数组 |
| Error path | 95% | NaN/null/undefined/Infinity均有覆盖 |
| Cross-system | 95% | 保存/加载六处全覆盖，双系统冲突已识别 |
| Data lifecycle | 100% | serialize/deserialize完整覆盖 |

## 修复优先级排序

| 顺序 | FIX ID | 影响面 | 复杂度 |
|------|--------|--------|--------|
| 1 | FIX-B01 | addFavorability | 低 |
| 2 | FIX-B02 | loadSaveData | 低 |
| 3 | FIX-B05 | triggerStoryEvent deps检查 | 低 |
| 4 | FIX-B06 | getAvailableStoryEvents null防护 | 低 |
| 5 | FIX-B07 | getFactionDistribution faction检查 | 低 |
| 6 | FIX-B04 | triggerStoryEvent 前置条件 | 中 |
| 7 | FIX-B03 | 存档接入六处 | 高 |

## 最终裁决

**Bond R1 测试覆盖充分，Challenger发现的8个P0全部确认。要求全部修复后方可进入R2。**

P0-004（存档系统未接入）为最高优先级，涉及6个文件的同步修改，需特别注意FIX穿透验证。
