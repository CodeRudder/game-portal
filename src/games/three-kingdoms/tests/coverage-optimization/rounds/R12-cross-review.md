# R12 交叉审查报告

> **测试策略**: 用模块A的测试验证模块B的行为，打破AI自洽陷阱
> **执行时间**: 2025-01-XX
> **结果**: ✅ 30/30 全部通过

---

## 1. 测试文件概览

| 文件 | 用例数 | 通过 | 耗时 |
|------|--------|------|------|
| `cross-building-resource.test.ts` | 10 | ✅ 10 | ~1.2s |
| `cross-hero-battle.test.ts` | 10 | ✅ 10 | ~1.5s |
| `cross-save-all.test.ts` | 10 | ✅ 10 | ~1.5s |
| **合计** | **30** | **30** | **4.2s** |

---

## 2. 建筑↔资源交叉验证 (cross-building-resource.test.ts)

### 交叉审查原理
- BuildingSystem 声称升级成功 → ResourceSystem 视角确认资源确实被扣
- BuildingSystem 声称升级失败 → ResourceSystem 视角确认资源未变
- BuildingSystem 声称满级 → ResourceSystem 确认不再扣费

### 测试用例

| # | 场景 | 交叉验证方式 | 结果 |
|---|------|-------------|------|
| 1 | 升级成功 | ResourceSystem 确认 gold/grain 扣除量与 UpgradeCost 精确匹配 | ✅ |
| 2 | 升级失败（资源不足） | ResourceSystem 确认所有资源数值未变 | ✅ |
| 3 | 满级拒绝升级 | ResourceSystem 确认资源未被扣除 | ✅ |
| 4 | 建筑产出 | ResourceSystem 确认 grain 增量与 productionRates × dtSec 一致 | ✅ |
| 5 | 连续升级3次 | ResourceSystem 确认总扣费 = Σ(各次 UpgradeCost) | ✅ |
| 6 | 升级完成产出增加 | ResourceSystem 确认 grain 产出速率提升 | ✅ |
| 7 | 取消升级 | ResourceSystem 确认返还量与 BuildingSystem 报告的 refund 一致 | ✅ |
| 8 | 离线收益 | 加载后 ResourceSystem 确认资源 ≥ 保存前值，BuildingSystem 确认等级一致 | ✅ |
| 9 | 等级-产出正相关 | BuildingSystem 等级提升 → ResourceSystem 产出速率单调递增 | ✅ |
| 10 | 存档/加载 | BuildingSystem 等级 + ResourceSystem 数量双重一致 | ✅ |

### 发现的关键问题

**P2 — forceCompleteUpgrades 不触发 syncBuildingToResource**
- `BuildingSystem.forceCompleteUpgrades()` 只更新内部 level/status，不调用 `syncBuildingToResource()`
- 导致 ResourceSystem 的产出速率、资源上限与 BuildingSystem 不同步
- **影响**: 测试中需手动调用 `engine.building.calculateTotalProduction()` + `engine.resource.recalculateProduction()` 同步
- **建议**: 在 `forceCompleteUpgrades()` 返回后自动触发 sync，或在文档中明确标注需手动同步

---

## 3. 武将↔战斗交叉验证 (cross-hero-battle.test.ts)

### 交叉审查原理
- HeroSystem 说武将 ATK=100 → BattleSystem 用 ATK=100 计算伤害
- 武将升级后 → 战斗伤害相应增加
- 武将防御属性 → 影响受伤量

### 测试用例

| # | 场景 | 交叉验证方式 | 结果 |
|---|------|-------------|------|
| 1 | 武将属性一致性 | BattleSystem 使用 HeroSystem 武将的 attack 值进行战斗 | ✅ |
| 2 | 升级→伤害增加 | ATK+50 后 BattleSystem 的 allyTotalDamage 增加 | ✅ |
| 3 | 防御→受伤减少 | DEF 10 vs DEF 200，高防御方 enemyTotalDamage 更低 | ✅ |
| 4 | 羁绊/数据完整性 | HeroSystem 武将数据创建的 BattleUnit 能正常完成战斗 | ✅ |
| 5 | 技能生效 | 带 skills 的 BattleUnit 造成 allyTotalDamage > 0 | ✅ |
| 6 | 编队一致性 | Formation 中的 generalIds 在 HeroSystem 中确实存在 | ✅ |
| 7 | 血量扣减 | 战斗中 enemyTotalDamage > 0 时 allySurvivors ≤ 1 | ✅ |
| 8 | 战斗胜利 | 高攻武将 vs 弱敌 → outcome=VICTORY | ✅ |
| 9 | 武将死亡 | 弱武将 vs 强敌 → outcome=DEFEAT, allySurvivors=0 | ✅ |
| 10 | 存档/加载 | 武将 id/name/level/stats/fragments 全部一致 | ✅ |

### 发现的关键问题

无显著问题。HeroSystem 与 BattleSystem 的数据流清晰、一致。

---

## 4. 存档↔全系统交叉验证 (cross-save-all.test.ts)

### 交叉审查原理
- SaveManager 保存完整状态 → 加载后各子系统状态一致
- 用各子系统的 API 验证反序列化的正确性

### 测试用例

| # | 场景 | 交叉验证方式 | 结果 |
|---|------|-------------|------|
| 1 | BuildingSystem | 8种建筑 level + status 全部一致 | ✅ |
| 2 | HeroSystem | 武将数量/id/name/level/quality/faction/stats + fragments + totalPower | ✅ |
| 3 | ResourceSystem | 7种资源有效数字 + 产出速率有效 + 上限有效 | ✅ |
| 4 | TechSystem | techState 字段完整 | ✅ |
| 5 | CampaignSystem | currentChapterId + stageStates 数量一致 | ✅ |
| 6 | QuestSystem | getState() 可恢复 | ✅ |
| 7 | ShopSystem | 商店类型数量一致 | ✅ |
| 8 | serialize/deserialize | 资源精确一致 + 建筑等级精确一致 + 武将数量一致 | ✅ |
| 9 | 蓝图修复 | fixSaveData() 返回有效报告 | ✅ |
| 10 | 损坏数据恢复 | 加载后各系统可正常 tick/save | ✅ |

### 发现的关键问题

**P2 — reset() 删除存档**
- `ThreeKingdomsEngine.reset()` 内部调用 `this.saveManager.deleteSave()`
- 测试中如果在 save() 后调用 reset()，存档数据会被清除
- **影响**: 测试需在 load() 之前不调用 reset()
- **建议**: 这是设计行为，但应在文档中明确标注

**P3 — 离线收益导致资源量变化**
- `load()` 内部计算离线收益，导致资源量可能大于保存时
- 测试中无法精确断言资源量相等，只能断言 ≥
- **影响**: 低，属于正常游戏行为

---

## 5. 交叉审查统计

### 覆盖的系统对

| 系统A | 系统B | 验证场景数 | 发现问题 |
|-------|-------|-----------|---------|
| BuildingSystem | ResourceSystem | 10 | 1×P2 |
| HeroSystem | BattleSystem | 10 | 0 |
| SaveManager | 全系统(7+) | 10 | 1×P2, 1×P3 |

### 发现的问题汇总

| 严重度 | 问题 | 影响 | 建议 |
|--------|------|------|------|
| P2 | `forceCompleteUpgrades()` 不触发 syncBuildingToResource | 测试/调试时产出速率不同步 | 自动触发 sync 或文档标注 |
| P2 | `reset()` 删除存档 | 测试中需注意调用顺序 | 文档标注 |
| P3 | 离线收益导致 load 后资源量变化 | 测试断言需放宽 | 属于正常行为 |

### 交叉审查价值

1. **forceCompleteUpgrades 同步问题**: 常规 BuildingSystem 单元测试不会发现此问题（因为只验证 BuildingSystem 内部状态），交叉审查通过 ResourceSystem 视角暴露了不同步
2. **存档完整性**: 通过 SaveManager 视角验证了 7+ 个子系统的序列化/反序列化一致性
3. **战斗属性一致性**: 确认 HeroSystem 的武将属性在 BattleSystem 中被正确使用

---

## 6. 运行命令

```bash
cd /mnt/user-data/workspace && pnpm vitest run src/games/three-kingdoms/engine/__tests__/cross-*.test.ts --reporter=verbose 2>&1 | tail -15
```

```
 Test Files  3 passed (3)
      Tests  30 passed (30)
   Start at  10:06:55
   Duration  4.17s
```
