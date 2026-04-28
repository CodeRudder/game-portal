# 天下Tab占领城池 — 测试/文档覆盖调研报告

> 调研日期: 2025-07-10
> 调研目标: 检查"天下Tab占领一个城池"完整流程的测试/文档覆盖情况
> 完整链路: 选择城池 → 编队出征 → 行军耗时 → 战斗过程 → 胜负结果 → 收入/消耗结算 → 城池归属变化

---

## 一、总览矩阵

| 流程环节 | 引擎单元测试 | 引擎集成测试 | ACC验收测试 | UI组件测试 | E2E测试 | 流程文档 |
|----------|:-----------:|:-----------:|:-----------:|:---------:|:------:|:-------:|
| 1. 选择城池 | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| 2. 编队出征 | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| 3. 行军耗时 | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| 4. 战斗过程 | ✅ | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| 5. 胜负结果 | ✅ | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| 6. 收入/消耗结算 | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ |
| 7. 城池归属变化 | ✅ | ✅ | ⚠️ | ❌ | ❌ | ✅ |

---

## 二、逐环节详细分析

### 1. 选择城池

**✅ 已覆盖 — 引擎层**
- `TerritorySystem.test.ts` — 领土查询、产出结构、占领状态
- `WorldMapSystem.viewport.test.ts` — getLandmarksByType 城池、getPlayerLandmarkCount
- `MapFilterSystem.test.ts` — 按占领状态筛选、筛选城池
- `map-rendering-siege-conditions.integration.test.ts` — §6.1-6.4 地图渲染、区域划分、地形类型

**✅ 已覆盖 — UI组件层**
- `WorldMapTab.test.tsx` — 领土网格显示、领土卡片排列、筛选工具栏
- `TerritoryInfoPanel.test.tsx` — 己方/敌方/中立领土状态显示

**⚠️ 部分覆盖 — ACC验收**
- `ACC-09-05` 天下Tab整体布局 — 领土网格显示
- `ACC-09-07` 领土网格显示 — 领土卡片排列
- `ACC-09-08` 统计卡片显示 — 占领/总数和产出
- 缺失: 无从玩家视角选择目标城池的完整交互流程验证

**⚠️ 部分覆盖 — E2E**
- `tab-smoke.spec.ts` SM-01 天下Tab — 仅验证Tab切换和基本渲染
- `v5-evolution-ui-test.cjs` — 验证领土格子、归属分类、产出气泡
- 缺失: 无实际点击选择城池→触发攻城流程的E2E用例

**✅ 已覆盖 — 文档**
- `v5-test-checklist.md` §2.1-2.6 地图渲染与浏览
- `v3.0-攻城略地-上.md` 模块A 战役长卷
- `v5.0-百家争鸣.md` 模块B 世界地图

---

### 2. 编队出征

**❌ 未覆盖 — 引擎层**
- `SiegeSystem.ts` 的 `executeSiegeWithResult()` 接受 `availableTroops` 参数，但无编队（Formation）概念
- `SiegeSystem` 不依赖 `HeroFormation` 系统，攻城时只看兵力总量
- `GarrisonSystem` 有"驻防与出战编队互斥"校验（`isGeneralInFormation`），但这是驻防侧逻辑，非攻城出征编队
- 缺失: 无"选择武将编队→出征攻城"的引擎逻辑和测试

**❌ 未覆盖 — UI/ACC/E2E**
- 无任何UI测试验证"攻城前选择/编辑出征编队"的交互
- ACC-09 测试中攻城按钮直接触发回调，无编队选择步骤

**⚠️ 部分覆盖 — 文档**
- `v3.0-攻城略地-上.md` 模块B 战前布阵 描述了"6人编队"概念，但那是战役关卡（Campaign）的布阵，非天下Tab攻城的出征编队
- 天下Tab攻城与战役关卡的编队关系未在文档中明确

---

### 3. 行军耗时

**❌ 未覆盖 — 引擎层**
- `SiegeSystem.ts` 中无任何行军时间/耗时相关字段或方法
- `SiegeEnhancer.ts` 中无攻城时间计算逻辑
- 搜索 `siegeTime/marchTime/行军/耗时/30min` 在 `engine/map/` 目录下无匹配
- `v5-test-checklist.md` §4.5 标注"攻城时间计算 — 基础30min+城防/100"状态为 ✅，但实际源码中无此实现
- **R25-v5.0-deep-review.md** 明确标注: "#31 攻城时间计算 — ❌ 未实现 — 无攻城时间公式"

**❌ 未覆盖 — 测试**
- 无任何测试验证行军/攻城时间计算
- v5-test-checklist 中的 §4.5 标注为已覆盖，但与实际代码和R25深度审查矛盾

**⚠️ 部分覆盖 — 文档**
- `v5-test-checklist.md` §4.5 提到公式"基础30min+城防/100"
- 但实际源码中未实现此公式
- **文档与代码不一致**

> **注**: 远征系统（ExpeditionSystem）有完整的行军时长（`MARCH_DURATION`），但那是远征系统，非天下Tab攻城。

---

### 4. 战斗过程

**✅ 已覆盖 — 引擎单元测试**
- `SiegeSystem.test.ts` — simulateBattle、executeSiegeWithResult（含强制胜负参数）
- `SiegeEnhancer.test.ts` — executeConquest 完整流程、胜率预估
- `BattleEngine.test.ts` — 回合制战斗引擎
- `BattleTurnExecutor.test.ts` — 回合执行
- `DamageCalculator.test.ts` — 伤害计算

**✅ 已覆盖 — 引擎集成测试**
- `siege-execution-territory-capture.integration.test.ts` — §7.2 城防计算、§7.3 攻城执行
- `siege-settlement-winrate.integration.test.ts` — §7.5 攻城结算、§7.6 胜率预估
- `map-rendering-siege-conditions.integration.test.ts` — §7.1 攻城条件检查

**⚠️ 部分覆盖 — ACC验收**
- `ACC-09-26` 攻城条件校验 — SiegeConfirmModal条件检查（仅渲染验证）
- `ACC-09-28` 攻城按钮触发（仅验证回调调用）
- 缺失: 无战斗过程动画/回合执行的ACC验收

**❌ 未覆盖 — UI/E2E**
- 无UI测试验证战斗动画/回合过程
- E2E测试中无攻城战斗过程验证

**✅ 已覆盖 — 文档**
- `v5-test-checklist.md` §4.1-4.3 攻城条件/城防/战斗
- `v3.0-攻城略地-上.md` 模块C 战斗机制

---

### 5. 胜负结果

**✅ 已覆盖 — 引擎单元测试**
- `SiegeSystem.test.ts` — 胜利/失败分支、攻城统计、历史记录
- `SiegeEnhancer.test.ts` — executeConquest 各阶段结果

**✅ 已覆盖 — 引擎集成测试**
- `siege-execution-territory-capture.integration.test.ts`:
  - 攻城胜利 → 领土归属变更
  - 攻城失败 → 领土归属不变
  - 攻城失败 → 损失30%出征兵力
  - 攻城统计正确记录
- `siege-settlement-winrate.integration.test.ts`:
  - 胜利: 领土归己方，产出开始生效
  - 失败: 损失30%出征兵力，领土不变
  - 连续攻占多座城池

**⚠️ 部分覆盖 — ACC验收**
- `ACC-09-27` 攻城消耗显示 — 仅验证消耗数据正确性
- 缺失: 无胜利/失败后UI状态变化的ACC验收（如战报弹窗、领土归属变化动画）

**❌ 未覆盖 — UI/E2E**
- 无UI测试验证胜负结果后的界面变化

---

### 6. 收入/消耗结算

**✅ 已覆盖 — 引擎单元测试**
- `SiegeSystem.test.ts` — 攻城消耗计算（兵力×系数、粮草固定500）
- `SiegeEnhancer.test.ts` — 攻城奖励计算（资源+经验+道具掉落）
- `TerritorySystem.test.ts` — 占领后产出汇总

**✅ 已覆盖 — 引擎集成测试**
- `siege-execution-territory-capture.integration.test.ts`:
  - §7.4 攻城奖励（首占+重复+关卡加成）
  - 攻城消耗: 兵力×100 + 粮草×500
  - 占领后产出汇总正确增长
- `siege-settlement-winrate.integration.test.ts`:
  - 占领后产出汇总包含新领土
  - 连续攻占产出持续增长

**⚠️ 部分覆盖 — ACC验收**
- `ACC-09-27` 攻城消耗显示 — 验证消耗数据正确（troops=100, grain=50）
- 缺失: 无奖励发放后资源变化的ACC验证

**⚠️ 部分覆盖 — UI组件**
- `SiegeConfirmModal.test.tsx` — 攻城确认弹窗渲染（含消耗显示）
- 缺失: 无结算面板/奖励展示的UI测试

**❌ 未覆盖 — E2E**
- 无E2E测试验证攻城消耗扣除和奖励发放

**✅ 已覆盖 — 文档**
- `v5-test-checklist.md` §4.4 攻城奖励
- `v4.0-攻城略地-下.md` — 攻城消耗与奖励设计

---

### 7. 城池归属变化

**✅ 已覆盖 — 引擎单元测试**
- `TerritorySystem.test.ts` — 占领领土成功/失败、敌方占领、产出变化
- `GarrisonSystem.test.ts` — 占领后驻防

**✅ 已覆盖 — 引擎集成测试**
- `siege-execution-territory-capture.integration.test.ts`:
  - 攻城胜利 → 领土数据同步更新（ownership变更）
  - 连续攻城逐步扩张领土
  - 攻城胜利触发 siege:victory 事件
- `siege-settlement-winrate.integration.test.ts`:
  - 连续攻占多座城池，领土数和产出持续增长
- `territory-garrison-filter-landmarks.integration.test.ts` — 领土+驻防+筛选联动

**⚠️ 部分覆盖 — ACC验收**
- `ACC-09-39` 中立领土操作 — 不显示攻城和升级按钮
- 缺失: 无攻城成功后领土卡片归属状态变化的ACC验证

**❌ 未覆盖 — UI/E2E**
- 无UI测试验证领土归属变化后的视觉反馈（颜色变化、图标更新等）

**✅ 已覆盖 — 文档**
- `v5-test-checklist.md` §3.1 领土占领
- `v6.0-天下大势.md` — 天下大势系统设计

---

## 三、关键发现

### 🔴 严重缺口

1. **编队出征（环节2）完全未实现**
   - 天下Tab攻城无"编队选择"步骤，`SiegeSystem` 只看兵力总量
   - 与战役关卡（Campaign）的6人编队系统完全独立
   - 无相关测试和文档

2. **行军耗时（环节3）完全未实现**
   - `SiegeSystem` 和 `SiegeEnhancer` 中无任何时间计算逻辑
   - R25深度审查明确标注"❌ 未实现"
   - **v5-test-checklist.md 标注"✅ 已覆盖"与实际代码矛盾** ← 文档不准确
   - 远征系统（ExpeditionSystem）有行军时长，但属于不同系统

3. **完整链路E2E测试缺失**
   - 无任何E2E测试覆盖"选择城池→攻城→结算→归属变化"的完整用户流程
   - 现有E2E仅验证UI渲染和Tab切换

### 🟡 需要改进

4. **ACC验收覆盖不完整**
   - ACC-09 有攻城按钮和确认弹窗的测试，但缺少:
     - 攻城成功/失败后的UI状态变化
     - 奖励展示面板
     - 领土归属变化视觉反馈

5. **UI组件测试缺少结算面板**
   - 有 `SiegeConfirmModal.test.tsx`（战前确认）
   - 缺少战果结算面板/奖励展示的组件测试

6. **文档与代码不一致**
   - `v5-test-checklist.md` §4.5 标注攻城时间"✅ 已覆盖"
   - 实际代码中无攻城时间计算逻辑
   - R25深度审查标注"❌ 未实现"

---

## 四、文件索引

### 引擎源码（攻城相关）
| 文件 | 职责 |
|------|------|
| `engine/map/SiegeSystem.ts` | 攻城条件校验、消耗计算、战斗执行、占领变更 |
| `engine/map/SiegeEnhancer.ts` | 胜率预估、攻城奖励、完整征服流程 |
| `engine/map/TerritorySystem.ts` | 领土管理（归属、产出、升级、相邻关系） |
| `engine/map/GarrisonSystem.ts` | 驻防系统（武将驻防、防御加成） |
| `engine/map/WorldMapSystem.ts` | 世界地图核心（区域、地形、地标、视口） |
| `engine/engine-map-deps.ts` | 地图子系统依赖注入和初始化 |

### 引擎单元测试
| 文件 | 用例数 | 覆盖范围 |
|------|--------|---------|
| `engine/map/__tests__/SiegeSystem.test.ts` | ~20 | 攻城条件/消耗/执行/统计/历史 |
| `engine/map/__tests__/SiegeEnhancer.test.ts` | ~15 | 胜率预估/奖励/征服流程 |
| `engine/map/__tests__/TerritorySystem.test.ts` | ~15 | 领土占领/产出/升级 |
| `engine/map/__tests__/GarrisonSystem.test.ts` | ~20 | 驻防/编队互斥/防御加成 |
| `engine/map/__tests__/WorldMapSystem.test.ts` | ~10 | 地图基础 |
| `engine/map/__tests__/MapFilterSystem.test.ts` | ~8 | 筛选/过滤 |

### 引擎集成测试
| 文件 | 用例数 | 覆盖范围 |
|------|--------|---------|
| `engine/map/__tests__/integration/siege-execution-territory-capture.integration.test.ts` | ~15 | §7.2城防/§7.3攻城执行/§7.4奖励/§10.0B声望/§13.3 PRD |
| `engine/map/__tests__/integration/siege-settlement-winrate.integration.test.ts` | ~15 | §7.5攻城结算/§7.5.1重复奖励/§7.6胜率预估/§10.0B声望 |
| `engine/map/__tests__/integration/map-rendering-siege-conditions.integration.test.ts` | ~10 | §6.1-6.4地图渲染/§7.1攻城条件 |

### ACC验收测试
| 文件 | 覆盖范围 |
|------|---------|
| `tests/acc/ACC-09-地图关卡.test.tsx` | 天下Tab布局/领土网格/攻城按钮/攻城弹窗/消耗显示/手机适配 |

### UI组件测试
| 文件 | 覆盖范围 |
|------|---------|
| `components/idle/panels/map/__tests__/WorldMapTab.test.tsx` | 领土网格/筛选/攻城闭环 |
| `components/idle/panels/map/__tests__/TerritoryInfoPanel.test.tsx` | 归属状态/攻城按钮/升级按钮 |
| `components/idle/panels/map/__tests__/SiegeConfirmModal.test.tsx` | 攻城确认弹窗 |

### E2E测试
| 文件 | 覆盖范围 |
|------|---------|
| `e2e/tab-smoke.spec.ts` SM-01 | 天下Tab切换和基本渲染 |
| `e2e/v5-evolution-ui-test.cjs` | 领土格子/归属分类/产出气泡/热力图 |
| `e2e/v3-evolution-ui-test.cjs` | 攻城略地(上) UI测试（关卡地图为主） |
| `e2e/v4-evolution-ui-test.cjs` | 攻城略地(下) UI测试 |

### 文档
| 文件 | 覆盖范围 |
|------|---------|
| `docs/games/three-kingdoms/v5-test-checklist.md` | 攻城测试清单（§4.1-4.6） |
| `docs/games/three-kingdoms/plans/v3.0-攻城略地-上.md` | 攻城略地功能设计 |
| `docs/games/three-kingdoms/plans/v4.0-攻城略地-下.md` | 攻城略地功能设计(下) |
| `docs/games/three-kingdoms/plans/v6.0-天下大势.md` | 天下大势系统设计 |
| `docs/games/three-kingdoms/reviews/evolution/R25-v5.0-deep-review.md` | R25深度审查（攻城时间未实现） |

---

## 五、结论与建议

### 整体评价
天下Tab攻城占领城池的**引擎层核心逻辑**（条件校验→战斗→胜负→消耗→占领→奖励）测试覆盖较好，有完整的单元测试和集成测试。但**完整用户链路**存在3个严重缺口：编队出征、行军耗时、端到端E2E验证。

### 优先建议
1. **修复文档不一致**: `v5-test-checklist.md` §4.5 攻城时间计算应标注为"❌ 未实现"
2. **实现行军耗时**: 在 `SiegeSystem` 中添加攻城时间计算逻辑（基础30min+城防/100），并补充测试
3. **明确编队关系**: 确定天下Tab攻城是否需要编队选择步骤，如需要则实现并测试
4. **补充E2E链路测试**: 编写覆盖"选择城池→攻城→结算→归属变化"的完整E2E测试
5. **补充ACC验收**: 添加攻城成功/失败后UI状态变化的ACC用例
