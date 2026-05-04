# Builder 行为清单 -- 天下Tab地图系统全量核验

> 日期: 2026-05-04
> 核验范围: PLAN.md A~H 全部50项
> 核验方法: 独立读取源码 + 独立运行测试 + 独立检查UI集成

---

## A. 像素地图集成天下Tab

| ID | 功能 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 | 证据可信度 |
|----|------|---------|---------|---------|---------|-----------|
| A1 | PixelWorldMap接入WorldMapTab | `WorldMapTab.tsx:47` import PixelWorldMap; `:874` 条件渲染 PixelWorldMap | `WorldMapTab.test.tsx` (33 tests PASS) | PASS | 组件导入、props传递、渲染 | 高 |
| A2 | 地图居中+放大 | `PixelWorldMap.tsx` canvas自适应+缩放逻辑; `PixelMapRenderer.ts:127` class PixelMapRenderer | `PixelWorldMap.test.tsx` (31 tests PASS) | PASS | 渲染、缩放、居中 | 高 |
| A3 | 阵营色城市标记 | `PixelWorldMap.tsx:46-53` FACTION_COLORS; `:59-80` CITY_CHAR_TO_ID映射 | `PixelWorldMap.test.tsx` (31 tests PASS) | PASS | 不同阵营颜色渲染 | 高 |
| A4 | 城市点击交互 | `PixelWorldMap.tsx` canvas click handler + `WorldMapTab.tsx:568-613` handleSelectTerritory | `WorldMapTab.test.tsx` (33 tests PASS) | PASS | 点击选中、状态切换 | 高 |
| A5 | 攻城操作集成 | `WorldMapTab.tsx:615-633` handleSiege; `:684-739` handleSiegeConfirm | `WorldMapTab.test.tsx` + `SiegeConfirmModal.test.tsx` (16 tests PASS) | PASS | 攻城弹窗打开、确认、取消 | 高 |
| A6 | 鸟瞰图悬浮定位 | `PixelWorldMap.tsx:252-254` minimapRef; `:726-737` minimap渲染; `:862-876` 位置转换 | `PixelWorldMapMinimap.test.tsx` (10 tests PASS) | PASS | 小地图渲染、点击定位 | 高 |

## B. 道路连接与行军系统

| ID | 功能 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 | 证据可信度 |
|----|------|---------|---------|---------|---------|-----------|
| B1 | 道路网格构建 | `PathfindingSystem.ts:146` buildWalkabilityGrid | `PathfindingSystem.test.ts` (25 tests PASS) | PASS | 网格构建、可行走判断 | 高 |
| B2 | A*寻路(基于地图网格) | `PathfindingSystem.ts:308` findPathBetweenCities | `PathfindingSystem.test.ts` (25 tests PASS) + `PathfindingSystem.adjacency.test.ts` (16 tests PASS) | PASS | 寻路算法、邻接关系 | 高 |
| B3 | 城市相邻关系推导 | `PathfindingSystem.adjacency.test.ts` 测试城市间邻接 | `PathfindingSystem.adjacency.test.ts` (16 tests PASS) | PASS | 城市邻接验证 | 高 |
| B4 | 行军路线计算与显示 | `MarchingSystem.ts` calculateMarchRoute; `WorldMapTab.tsx:524-565` handleStartMarch | `MarchingSystem.test.ts` (26 tests PASS) + `MarchRoute.test.ts` (22 tests PASS) | PASS | 路线计算、显示 | 高 |
| B5 | 行军精灵渲染 | `WorldMapTab.tsx:879` activeMarches props; `PixelWorldMap.tsx:600-660` 精灵渲染逻辑 | `PixelWorldMapMarchSprites.test.tsx` (16 tests PASS) | PASS | 精灵位置、动画 | 高 |
| B6 | 攻城效果渲染 | `ConquestAnimation.ts` ConquestAnimationSystem; `WorldMapTab.tsx:159` 初始化; `:714-732` 触发 | `ConquestAnimation.test.ts` (7 tests PASS) + `ConquestAnimation.render.test.ts` (25 tests PASS) | PASS | 动画创建、渲染 | 高 |
| B7 | 道路数据一致性验证 | `cross-validation.integration.test.ts` (36 tests PASS) | `cross-validation.integration.test.ts` | PASS | 跨系统数据一致 | 高 |

## C. 离线/产出系统集成

| ID | 功能 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 | 证据可信度 |
|----|------|---------|---------|---------|---------|-----------|
| C1 | 离线奖励弹窗 | `OfflineRewardModal.tsx` 组件; `WorldMapTab.tsx:43` import; `:1104-1113` 渲染 | `OfflineRewardModal.test.tsx` (22 tests PASS) | PASS | 弹窗显示、事件列表、领取 | 高 |
| C2 | 产出管理面板 | `ProductionPanel.tsx` 组件; `WorldMapTab.tsx:44` import; `:1004-1009` 渲染 | `ProductionPanel.test.tsx` (16 tests PASS) | PASS | 产出数据、面板展示 | 高 |

## D. 交互体验完善

| ID | 功能 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 | 证据可信度 |
|----|------|---------|---------|---------|---------|-----------|
| D1-1 | V键切换像素/列表视图 | `WorldMapTab.tsx:213-217` case 'v'/'V' | `WorldMapTab.keyboard.test.tsx` (6 tests PASS) | PASS | V键切换viewMode | 高 |
| D1-2 | 方向键在像素模式下平移视窗 | `WorldMapTab.tsx:219-255` ArrowUp/Down/Left/Right | `WorldMapTab.keyboard.test.tsx` (6 tests PASS) | PASS | 方向键触发map-pan事件 | 高 |
| D1-3 | +/-键缩放 | `WorldMapTab.tsx:257-274` +/-键 | `WorldMapTab.keyboard.test.tsx` (6 tests PASS) | PASS | +/-触发map-zoom事件 | 高 |
| D1-4 | Escape取消选中/关闭弹窗 | `WorldMapTab.tsx:276-281` Escape | `WorldMapTab.keyboard.test.tsx` (6 tests PASS) | PASS | Escape清除选中 | 高 |
| D1-5 | 空格键居中到选中城市 | `WorldMapTab.tsx:284-291` Space键 | `WorldMapTab.keyboard.test.tsx` (6 tests PASS) | PASS | 空格触发map-center事件 | 高 |
| D2-1 | PC端：左侧像素地图 + 右侧信息面板 | `WorldMapTab.css:322-356` @media(max-width:767px) 断点 + flex布局 | `responsive-layout.integration.test.ts` (38 tests PASS) | PASS | 布局断点、PC布局 | 高 |
| D2-2 | 手机端：全屏地图 + 底部抽屉信息面板 | `WorldMapTab.css:322-406` @media手机适配 + `mobile-responsive.integration.test.ts` | `mobile-responsive.integration.test.ts` (18 tests PASS, 5 skipped) | PASS | 手机端布局 | 高 |
| D2-3 | 触摸板双指平移/捏合缩放 | `PixelWorldMap.tsx` touch事件; `TouchInputSystem.test.ts` | `TouchInputSystem.test.ts` (47 tests PASS) | PASS | 双指手势 | 高 |
| D2-4 | 触摸屏单指拖拽/双指缩放 | `PixelWorldMap.touch.test.tsx` + `TouchInteractionSystem.test.ts` | `PixelWorldMap.touch.test.tsx` (3 tests PASS) + `TouchInteractionSystem.test.ts` (42 tests PASS) | PASS | 触摸交互 | 高 |
| D3-1 | 像素地图渲染60fps无卡顿 | `performance.test.ts` 性能基准测试 | `performance.test.ts` (8 tests PASS, 4.4s) | PASS | 帧率测试 | 高 |
| D3-2 | 脏标记渲染(无变化时跳过) | `PixelMapRenderer.ts` 内部优化 | `PixelMapRenderer.test.ts` (32 tests PASS) | PASS | 渲染性能 | 中 |
| D3-3 | 大地图(100x60)视口裁剪只渲染可见区域 | `WorldMapSystem.viewport.test.ts` (35 tests PASS) | `WorldMapSystem.viewport.test.ts` | PASS | 视口裁剪 | 高 |
| D3-4 | 行军精灵批量渲染减少drawCall | `PixelWorldMapMarchSprites.test.tsx` (16 tests PASS) | `PixelWorldMapMarchSprites.test.tsx` | PASS | 批量渲染 | 中 |

## E. 全流程集成

| ID | 功能 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 | 证据可信度 |
|----|------|---------|---------|---------|---------|-----------|
| E1-1 | 启动->天下Tab->像素地图显示正常 | `e2e-map-flow.integration.test.ts:79-86` E1-1描述 | `e2e-map-flow.integration.test.ts` (7 tests PASS) | PASS | 领土初始化验证 | 中 |
| E1-2 | 点击城市->攻城->结果->领土变化 | `e2e-map-flow.integration.test.ts:88-107` E1-2描述 | `e2e-map-flow.integration.test.ts` (7 tests PASS) | PASS | 攻城全流程 | 高 |
| E1-3 | 行军->网格A*寻路->精灵沿道路移动->到达->触发事件 | `e2e-map-flow.integration.test.ts:109-115` | `e2e-map-flow.integration.test.ts` + `marching-full-flow.integration.test.ts` | PASS | **空壳测试** -- 只检查 `mockTerritories.length > 0` | **低** |
| E1-4 | 离线->上线->弹窗->领取->资源更新 | `e2e-map-flow.integration.test.ts:117-124` | `e2e-map-flow.integration.test.ts` + `offline-full-flow.integration.test.ts` | PASS | **空壳测试** -- 只检查 `playerTerritories.length > 0` | **低** |
| E1-5 | 存档->读档->数据恢复一致 | `e2e-map-flow.integration.test.ts:126-164` E1-5描述 | `e2e-map-flow.integration.test.ts` (7 tests PASS) | PASS | 序列化/反序列化验证 | 高 |
| E1-6 | 全链路无报错、数据一致 | `e2e-map-flow.integration.test.ts:167-205` E1-6描述 | `e2e-map-flow.integration.test.ts` (7 tests PASS) | PASS | 全流程+伤亡+序列化 | 高 |

## F. 文档更新

| ID | 功能 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 | 证据可信度 |
|----|------|---------|---------|---------|---------|-----------|
| F1 | 更新MAP-world-prd-v2.md | `docs/games/three-kingdoms/ui-design/prd/MAP-world-prd-v2.md` 存在且包含编队/伤亡章节(7.1, 8.1) | N/A (文档) | N/A | 文档含MAP-7编队+MAP-8伤亡 | 高 |
| F2 | 更新MAP-INTEGRATION-STATUS.md | 无此文件 -- `MAP-INTEGRATION-STATUS.md` 未找到 | N/A | **缺失** | 无集成状态文档 | **无** |
| F3 | 更新测试覆盖文档 | PLAN.md中标记为完成但无专门覆盖文档 | N/A | **缺失** | 无独立覆盖文档 | **低** |

## G. 编队系统

| ID | 功能 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 | 证据可信度 |
|----|------|---------|---------|---------|---------|-----------|
| G1 | 编队类型定义(ExpeditionForce) | `expedition-types.ts:1-147` 全部类型+常量 | `ExpeditionSystem.test.ts` (20 tests PASS) | PASS | 类型完整性 | 高 |
| G2 | 编队系统实现(ExpeditionSystem) | `ExpeditionSystem.ts:1-397` 完整实现 | `ExpeditionSystem.test.ts` (20 tests PASS) | PASS | 创建/解散/校验/伤亡/序列化 | 高 |
| G3 | 编队单元测试 | `ExpeditionSystem.test.ts` (20 tests) + `expedition-full-flow.integration.test.ts` (8 tests) | 两文件均PASS | PASS | 全面单元+集成覆盖 | 高 |
| G4 | 编队UI组件(将领选择+兵力分配) | `ExpeditionForcePanel.tsx:1-311` 组件实现 | `ExpeditionForcePanel.test.tsx` (9 tests PASS) | PASS | 将领选择/兵力滑块/约束 | 高 |
| G5 | 攻城确认弹窗集成编队选择 | **未集成** -- `SiegeConfirmModal.tsx` 无 ExpeditionForcePanel import; `WorldMapTab.tsx` 无编队组件引用 | 见下方UI集成分析 | **未集成** | 攻城弹窗不含编队选择 | **低** |
| G6 | 编队约束校验(无将领/无士兵/将领重复/将领受伤) | `ExpeditionSystem.ts:125-174` createForce校验 | `ExpeditionSystem.test.ts` (20 tests PASS) | PASS | 四种错误码 HERO_REQUIRED/TROOPS_REQUIRED/HERO_BUSY/HERO_INJURED | 高 |

## H. 伤亡系统

| ID | 功能 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 | 证据可信度 |
|----|------|---------|---------|---------|---------|-----------|
| H1 | 伤亡计算逻辑(胜利/失败/惨败) | `expedition-types.ts:113-120` CASUALTY_RATES; `ExpeditionSystem.ts:267-296` calculateCasualties | `ExpeditionSystem.test.ts` + `expedition-full-flow.integration.test.ts` | PASS | 伤亡率范围验证 | 高 |
| H2 | 将领受伤概率(轻伤/中伤/重伤) | `expedition-types.ts:122-130` HERO_INJURY_RATES; `ExpeditionSystem.ts:278-279` 受伤判定 | `expedition-full-flow.integration.test.ts` (8 tests PASS) | PASS | 概率配置+受伤应用 | 高 |
| H3 | 将领受伤恢复机制 | `ExpeditionSystem.ts:316-337` applyHeroInjury + checkInjuryRecovery; `expedition-types.ts:141-146` INJURY_RECOVERY_TIME | `ExpeditionSystem.test.ts` (20 tests PASS) | PASS | 恢复时间设置+检查 | 高 |
| H4 | 伤亡集成到攻城流程 | `SiegeSystem.ts:736-809` executeSiegeWithExpedition; **但UI层未调用此方法** | `siege-expedition.integration.test.ts` (11 tests PASS) | PASS (引擎层) | 引擎层集成完整 | **中** |
| H5 | 攻城结果弹窗显示伤亡详情 | `SiegeResultModal.tsx:190` data-testid="siege-result-casualties"; **但SiegeResultData接口无casualties/heroInjured字段** | `SiegeResultModal.test.tsx` (19 tests PASS) | PASS | 战损区域存在但不含伤亡详情数据 | **低** |
| H6 | 将领受伤状态显示 | `ExpeditionForcePanel.tsx:91-93,171-203` injuredHeroes显示; **但此组件未集成到任何父组件** | `ExpeditionForcePanel.test.tsx` (9 tests PASS) | PASS | 孤立组件测试通过 | **低** |
| H7 | 将领受伤影响战力 | `expedition-types.ts:133-138` INJURY_POWER_MULTIPLIER; `ExpeditionSystem.ts:308-311` getHeroPowerMultiplier; `SiegeSystem.ts:788-789` 应用战力倍率 | `ExpeditionSystem.test.ts` + `expedition-full-flow.integration.test.ts` | PASS | 战力倍率正确应用 | 高 |

---

## UI集成验证

| 组件 | 是否被父组件导入 | 导入位置 | 集成状态 |
|------|----------------|---------|---------|
| PixelWorldMap | 是 | `WorldMapTab.tsx:47` | 已集成 |
| TerritoryInfoPanel | 是 | `WorldMapTab.tsx:39` | 已集成 |
| SiegeConfirmModal | 是 | `WorldMapTab.tsx:40` | 已集成 |
| SiegeResultModal | 是 | `WorldMapTab.tsx:41` | 已集成 |
| OfflineRewardModal | 是 | `WorldMapTab.tsx:43` | 已集成 |
| ProductionPanel | 是 | `WorldMapTab.tsx:44` | 已集成 |
| **ExpeditionForcePanel** | **否** | **仅被测试文件导入** | **孤立 -- 未集成到任何父组件** |

### 关键集成断裂分析

1. **ExpeditionForcePanel 孤立**: 该组件在 `ExpeditionForcePanel.tsx` 中定义，但只在测试文件 (`ExpeditionForcePanel.test.tsx`, `ui-interaction.integration.test.tsx`) 中被导入。**WorldMapTab.tsx** 和 **SiegeConfirmModal.tsx** 均未导入此组件。用户无法在攻城流程中看到或使用编队选择面板。

2. **WorldMapTab 使用 executeSiege 而非 executeSiegeWithExpedition**: `WorldMapTab.tsx:689-695` 中 `handleSiegeConfirm` 调用的是 `siegeSystem.executeSiege(siegeTarget.id, 'player', deployTroops, currentGrain)`，这是旧的攻城流程（不带编队）。`executeSiegeWithExpedition` 方法虽然存在于 `SiegeSystem.ts:736`，但 **从未被UI层调用**。

3. **SiegeResultData 缺少 casualties/heroInjured 字段**: `SiegeResultModal.tsx:34-64` 的 `SiegeResultData` 接口没有 `casualties` 或 `heroInjured` 字段。攻城结果弹窗无法显示将领受伤详情（H5）。弹窗中的"战损统计"区域（line 190）只显示出征兵力和粮草消耗，不包含具体的伤亡/受伤数据。

4. **将领受伤状态(H6)无法在UI中体现**: `ExpeditionForcePanel.tsx` 包含受伤将领显示逻辑，但该组件未被集成。在实际的攻城流程中，用户看不到将领的受伤状态。

---

## 测试执行汇总

### 地图引擎测试 (src/games/three-kingdoms/engine/map/__tests__/)

| 指标 | 数量 |
|------|------|
| 测试文件总数 | 65 |
| 通过文件 | 57 |
| 失败文件 | 8 |
| 总测试用例 | 1815 |
| 通过 | 1771 |
| 失败 | 27 |
| 跳过 | 5 |
| TODO | 12 |

### 失败测试文件明细

| 文件 | 失败数 | 原因 |
|------|--------|------|
| cross-system-linkage.integration.test.ts | 2 | HeroStarSystem.starUp() 返回 false（非地图核心功能） |
| SiegeRewardProgressive.test.ts | 4 | 攻城奖励递增逻辑断言失败 |
| MapP1Numerics.test.ts | 5 | 城防值生成公式不匹配 |
| MapP2TerritoryDetail.test.ts | 3 | 领土详情数值不匹配 |
| MapP2StatGarrison.test.ts | 5 | 驻防数值不匹配 |
| map.adversarial.test.ts | 6 | 对抗性测试断言失败 |
| MapP2FilterDetail.test.ts | 1 | 筛选细节测试失败 |
| CooldownManager.test.ts | 1 | 冷却管理器查询测试失败 |

### UI组件测试 (src/components/idle/panels/map/__tests__/)

| 指标 | 数量 |
|------|------|
| 测试文件总数 | 13 |
| 通过文件 | 13 |
| 失败文件 | 0 |
| 总测试用例 | 205 |
| 通过 | 205 |
| 失败 | 0 |

### 响应式测试 (src/games/three-kingdoms/engine/responsive/)

| 指标 | 数量 |
|------|------|
| 测试文件总数 | 15 |
| 通过文件 | 15 |
| 失败文件 | 0 |
| 总测试用例 | 515 |
| 通过 | 515 |
| 失败 | 0 |

---

## 空壳测试清单

| 测试文件 | 测试描述 | 问题 |
|---------|---------|------|
| e2e-map-flow.integration.test.ts:109-115 | E1-3 行军->寻路->精灵 | 只检查 `mockTerritories.length > 0`，未测试行军/寻路/精灵 |
| e2e-map-flow.integration.test.ts:117-124 | E1-4 离线->上线->领取 | 只检查 `playerTerritories.length > 0`，未测试离线系统 |

---

## 结论

### 有完整证据的功能点: 41/50

- A系列: 6/6 (全部高可信度)
- B系列: 7/7 (全部高可信度)
- C系列: 2/2 (全部高可信度)
- D系列: 13/13 (高/中可信度)
- E系列: 4/6 (E1-3/E1-4为空壳测试)
- F系列: 1/3 (F2/F3缺失)
- G系列: 4/6 (G5未集成，G6引擎层实现完整)
- H系列: 4/7 (H4引擎层OK但UI断裂; H5数据缺失; H6孤立组件)

### 证据不足/缺失的功能点: 9/50

| ID | 问题 |
|----|------|
| E1-3 | 空壳测试，仅检查mock数据长度，未测试行军/寻路/精灵 |
| E1-4 | 空壳测试，仅检查mock数据长度，未测试离线系统 |
| F2 | MAP-INTEGRATION-STATUS.md 文件不存在 |
| F3 | 无独立测试覆盖文档 |
| G5 | ExpeditionForcePanel 未集成到 SiegeConfirmModal/WorldMapTab |
| H4 | UI层调用 executeSiege（旧流程），未调用 executeSiegeWithExpedition（含编队+伤亡的新流程） |
| H5 | SiegeResultData 接口无 casualties/heroInjured 字段，弹窗无法显示伤亡详情 |
| H6 | ExpeditionForcePanel（含受伤状态显示）为孤立组件，未集成到任何父组件 |
| H7 | 战力影响仅在引擎层实现，UI层未体现（因编队系统未集成） |

### UI集成断裂: 4项

1. **ExpeditionForcePanel 孤立** -- 未被 WorldMapTab 或 SiegeConfirmModal 导入
2. **executeSiege 替代 executeSiegeWithExpedition** -- UI层绕过编队系统
3. **SiegeResultData 缺少伤亡字段** -- 攻城结果弹窗无法显示伤亡/受伤
4. **将领受伤状态无处展示** -- ExpeditionForcePanel 孤立

### 非地图相关测试失败: 27个

其中 2 个来自 cross-system-linkage（HeroStarSystem 问题，非地图核心），其余来自数值断言不匹配（城防值公式、驻防数值、攻城奖励递增等）。

### 验收标准差距

| 标准 | 状态 |
|------|------|
| 1. 编队必须有将领+士兵 | 引擎层OK; UI层无编队选择入口 |
| 2. 攻城后士兵有伤亡，武将可能受伤 | 引擎层OK; UI层不显示伤亡详情 |
| 3. 编队中的将领不能重复使用 | 引擎层OK; UI层无编队 |
| 4. 将领受伤后无法出征 | 引擎层OK; UI层无编队流程 |
| 5. 快捷键完整可用 | 全部通过 |
| 6. 响应式布局 | 全部通过 |
| 7. 性能达标 | 全部通过 |
| 8. E2E全链路 | 部分空壳(E1-3/E1-4) |
| 9. 文档完整 | 缺MAP-INTEGRATION-STATUS.md |
| 10. 所有测试通过 | 27个地图引擎测试失败 |

---

*Builder Manifest | 2026-05-04 | 独立核验*
