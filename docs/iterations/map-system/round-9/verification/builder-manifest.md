# Builder 行为清单 — Round 9 (编队系统集成测试)

> **日期**: 2026-05-04
> **焦点**: 编队系统(Expedition System) + 伤亡系统(Casualty System) 集成测试验证

## 测试执行结果

### ExpeditionSystem 单元测试 (20/20 passed)
```
✓ 创建编队 > 应该成功创建编队（有将领+有士兵）
✓ 创建编队 > 应该拒绝创建编队（无将领）
✓ 创建编队 > 应该拒绝创建编队（无士兵）
✓ 创建编队 > 应该拒绝创建编队（士兵不足）
✓ 创建编队 > 应该拒绝创建编队（将领已编队）
✓ 创建编队 > 应该拒绝创建编队（兵力不足）
✓ 创建编队 > 应该拒绝创建编队（达到上限）
✓ 解散编队 > 应该成功解散编队
✓ 解散编队 > 应该拒绝解散不存在的编队
✓ 解散编队 > 应该拒绝解散非ready状态的编队
✓ 编队校验 > 应该通过ready状态的编队校验
✓ 编队校验 > 应该拒绝非ready状态的编队
✓ 编队校验 > 应该拒绝受伤将领的编队
✓ 伤亡计算 > 胜利时应该损失5-15%兵力
✓ 伤亡计算 > 失败时应该损失20-40%兵力
✓ 伤亡计算 > 惨败时应该损失50-80%兵力
✓ 伤亡计算 > 应该更新编队兵力
✓ 将领受伤 > 胜利时将领应该有10%概率轻伤
✓ 将领受伤 > 受伤将领应该降低战力
✓ 序列化 > 应该正确序列化和反序列化
```
**文件**: `src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.test.ts`

### 编队全流程集成测试 (8/8 passed)
```
✓ 编队创建→出征→攻城→伤亡→返回 > 应该完成全流程
✓ 将领受伤恢复 > 应该正确处理将领受伤和恢复
✓ 多编队并发 > 应该支持多编队同时存在
✓ 编队约束 > 应该拒绝重复将领
✓ 编队约束 > 应该拒绝兵力不足
✓ 编队约束 > 应该拒绝非ready状态解散
✓ 编队序列化 > 应该正确序列化和反序列化
✓ 编队序列化 > 应该保存将领受伤状态
```
**文件**: `src/games/three-kingdoms/engine/map/__tests__/integration/expedition-full-flow.integration.test.ts`

### 编队攻城集成测试 (11/11 passed)
```
✓ G5: 攻城确认弹窗集成编队选择 > 应该使用编队兵力发起攻城
✓ G6: 编队约束校验 > 应该拒绝无将领的编队
✓ G6: 编队约束校验 > 应该拒绝无士兵的编队
✓ G6: 编队约束校验 > 应该拒绝将领重复的编队
✓ G6: 编队约束校验 > 应该拒绝受伤将领的编队攻城
✓ H4: 伤亡集成到攻城流程 > 胜利时应该有士兵伤亡
✓ H4: 伤亡集成到攻城流程 > 失败时应该有更高的士兵伤亡
✓ H4: 伤亡集成到攻城流程 > 攻城后编队兵力应该减少
✓ H5: 攻城结果弹窗显示伤亡详情 > 结果应该包含伤亡信息
✓ H7: 将领受伤影响战力 > 受伤将领应该降低攻城胜率
✓ 无ExpeditionSystem时回退 > 应该返回失败结果
```
**文件**: `src/games/three-kingdoms/engine/map/__tests__/integration/siege-expedition.integration.test.ts`

### ExpeditionForcePanel UI测试 (9/9 passed)
```
✓ 应该渲染可用将领列表
✓ 应该显示受伤将领
✓ 应该显示繁忙将领
✓ 应该允许选择将领
✓ 应该允许调整兵力
✓ 应该禁用状态
✓ 应该显示最大兵力
✓ 应该显示无可用将领提示
✓ 应该允许清除选择
```
**文件**: `src/components/idle/panels/map/__tests__/ExpeditionForcePanel.test.tsx`

---

## 功能点行为清单

| ID | 功能点 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 |
|----|--------|---------|---------|---------|---------|
| G1 | 编队类型定义 | `engine/map/expedition-types.ts` | ExpeditionSystem.test.ts | 20/20 passed | 创建/约束/伤亡/受伤/序列化 |
| G2 | 编队系统实现 | `engine/map/ExpeditionSystem.ts` | ExpeditionSystem.test.ts + expedition-full-flow.integration.test.ts | 28/28 passed | 创建/解散/校验/并发/约束/序列化 |
| G3 | 编队单元测试 | `__tests__/ExpeditionSystem.test.ts` | 自身 | 20/20 passed | 正常+异常+边界 |
| G4 | 编队UI组件 | `components/.../ExpeditionForcePanel.tsx` | ExpeditionForcePanel.test.tsx | 9/9 passed | 渲染/选择/受伤/繁忙/禁用 |
| G5 | 攻城弹窗集成编队 | `components/.../SiegeConfirmModal.tsx:46` (import) + `engine/map/SiegeSystem.ts:736` (executeSiegeWithExpedition) | siege-expedition.integration.test.ts | 11/11 passed | 编队攻城/约束/伤亡/回退 |
| G6 | 编队约束校验 | `engine/map/ExpeditionSystem.ts` (validateForceForExpedition) | ExpeditionSystem.test.ts + siege-expedition.integration.test.ts | passed | 无将领/无士兵/重复/受伤 |
| H1 | 伤亡计算逻辑 | `engine/map/ExpeditionSystem.ts` (calculateCasualties) | ExpeditionSystem.test.ts + siege-expedition.integration.test.ts | passed | 胜利5-15%/失败20-40%/惨败50-80% |
| H2 | 将领受伤概率 | `engine/map/ExpeditionSystem.ts` (calculateCasualties含heroInjured) | ExpeditionSystem.test.ts | passed | 10%概率轻伤 |
| H3 | 将领受伤恢复 | `engine/map/ExpeditionSystem.ts` + expedition-full-flow.integration.test.ts | expedition-full-flow.integration.test.ts | 8/8 passed | 受伤+恢复 |
| H4 | 伤亡集成攻城 | `engine/map/SiegeSystem.ts:736` (executeSiegeWithExpedition含casualties) | siege-expedition.integration.test.ts | passed | 胜利伤亡/失败伤亡/兵力减少 |
| H5 | 伤亡详情显示 | `components/.../SiegeResultModal.tsx:209-255` | siege-expedition.integration.test.ts | passed | 伤亡信息+将领受伤 |
| H6 | 将领受伤状态显示 | `components/.../ExpeditionForcePanel.tsx` | ExpeditionForcePanel.test.tsx | 9/9 passed | 受伤将领标记 |
| H7 | 将领受伤影响战力 | `engine/map/ExpeditionSystem.ts` (getHeroPowerMultiplier) + SiegeSystem.ts:788 | siege-expedition.integration.test.ts | passed | 受伤降低胜率 |

## Round 9 计划验收对照

| 验收标准 | 状态 | 测试文件 | 结果 |
|---------|:----:|---------|------|
| 编队创建→出征→攻城→伤亡→返回全流程测试 | ✅ | expedition-full-flow.integration.test.ts | 1 test passed |
| 将领受伤恢复测试 | ✅ | expedition-full-flow.integration.test.ts | 1 test passed |
| 多编队并发测试 | ✅ | expedition-full-flow.integration.test.ts | 1 test passed |
| 编队约束测试 | ✅ | expedition-full-flow.integration.test.ts + siege-expedition.integration.test.ts | 6 tests passed |
| 编队序列化测试 | ✅ | expedition-full-flow.integration.test.ts | 2 tests passed |

## 源代码集成证据

1. **ExpeditionForcePanel → SiegeConfirmModal**: `SiegeConfirmModal.tsx` 导入 `ExpeditionForcePanel`，通过 `heroes`/`expeditionSelection`/`onExpeditionChange` props 集成
2. **WorldMapTab → ExpeditionSystem**: `WorldMapTab.tsx:46-47` 导入 `HeroInfo`/`ExpeditionForceSelection`/`CasualtyResult`，`handleSiegeConfirm` 使用 `executeSiegeWithExpedition`
3. **SiegeResultModal → CasualtyResult**: `SiegeResultModal.tsx:60-62` 接收 `casualties?` 和 `heroInjured?`，行209-255渲染伤亡详情

## 总计

- **功能点**: 13/13 有实现证据
- **测试**: 48/48 全部通过 (20单元 + 8全流程 + 11攻城集成 + 9 UI)
- **Round 9 验收**: 5/5 全部通过
