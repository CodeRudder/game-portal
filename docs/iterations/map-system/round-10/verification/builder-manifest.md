# R10 Builder Manifest — 功能实现与测试验证报告

> 生成时间: 2026-05-04
> 验证状态: 3/3 功能点有完整证据

---

## 功能点 1: R10 Task 5 (E1-3) — 行军->攻占完整链路E2E集成测试

### 实现证据

**文件**: `src/games/three-kingdoms/engine/map/__tests__/integration/march-to-siege-chain.integration.test.ts`

| 位置 | 说明 |
|------|------|
| 行 94-801 | 完整测试套件，7个场景describe块 |
| 行 115-181 | Scenario 1: createMarch -> update(dt) -> march:arrived 完整链路 |
| 行 185-253 | Scenario 2: 行军精灵数据 — 路径/位置/速度 Canvas渲染属性验证 |
| 行 257-336 | Scenario 3: 到达触发攻占 — march:arrived -> SiegeTaskManager.advanceStatus('sieging') |
| 行 340-464 | Scenario 4: 回城行军链路 — 攻占完成 -> createReturnMarch -> speed x0.8 -> 到达出发城市 |
| 行 468-606 | Scenario 5: 多城市链路 — A->B成功后B->C，无状态污染 |
| 行 610-747 | Scenario 6: 取消行军 — cancelMarch中途取消 -> 事件触发 + 行军清理 |
| 行 751-800 | Scenario 7 (bonus): 全生命周期状态转换验证 preparing->marching->sieging->settling->returning->completed |

### 测试证据

```
Test command: npx vitest run src/games/three-kingdoms/engine/map/__tests__/integration/march-to-siege-chain.integration.test.ts
Result: 14 passed (14 tests) — 4ms
Status: PASS
```

### 集成证据 — 真实系统交互

测试使用 **真实实例** (非mock核心逻辑):
- `EventBus` — 真实事件总线，验证事件触发顺序 (行 101)
- `MarchingSystem` — 真实行军系统，验证 createMarch/startMarch/update/cancelMarch 完整API (行 103-104)
- `SiegeTaskManager` — 真实任务管理器，验证 createTask/advanceStatus/setResult 状态机 (行 106-107)
- `SiegeBattleSystem` — 真实战斗系统，验证 createBattle/update 战斗周期 (行 109-110)

唯一mock: `calculateMarchRoute` 在Scenario 4中mock为返回固定路径，因为路径计算依赖地图数据，与E2E链路无关。

---

## 功能点 2: R10 Task 6 (I11) — 行军精灵Canvas渲染+路线交互

### 实现证据

**源码文件**: `src/components/idle/panels/map/PixelWorldMap.tsx`

| 位置 | 说明 |
|------|------|
| 行 91-97 | `MARCH_SPRITE_COLORS` 阵营颜色映射: wei=#2196F3, shu=#4CAF50, wu=#F44336, neutral=#9E9E9E |
| 行 99-106 | 行走动画常量: `WALK_FRAME_INTERVAL=125ms`, `WALK_FRAME_COUNT=4` |
| 行 158-308 | `renderSingleMarch()` 函数 — 完整行军精灵Canvas渲染逻辑 |
| 行 200-204 | preparing状态: 闪烁效果 (PREPARE_BLINK_INTERVAL) |
| 行 207 | 4帧行走动画: `walkFrame = Math.floor(now / WALK_FRAME_INTERVAL) % WALK_FRAME_COUNT` |
| 行 234-236 | retreating状态: `ctx.globalAlpha = 0.7`, `ctx.fillStyle = '#888888'` |
| 行 243 | 精灵身体: `ctx.fillRect(ox - size/2 + bodyShiftX, py - size + legOffset, size, size*2)` |
| 行 255-266 | 旗帜渲染: 第一个精灵携带阵营色旗帜 |
| 行 273-294 | arrived状态: 攻城闪烁 + 交叉双剑(#FFD700) |
| 行 1078-1149 | `renderMarchSpritesOverlay()` — 行军精灵叠加层，先绘制路线再绘制精灵 |
| 行 1098-1142 | 路线渲染: 阵营色虚线 (`setLineDash([ts*0.4, ts*0.3])`), retreating=0.5 alpha |
| 行 933-938 | 行军数据同步: `useEffect` 监听 `activeMarches` prop 变化 |

**测试文件**: `src/components/idle/panels/map/__tests__/PixelWorldMapMarchSprites.test.tsx`

| 位置 | 说明 |
|------|------|
| 行 276-548 | Part 1: 15个基础渲染测试 (不同状态/阵营/兵力/生命周期不崩溃) |
| 行 552-811 | Part 2 (I11): 20个Canvas Mock测试 — 验证精灵渲染细节 |
| 行 564-572 | I11 Test 1: 活跃行军 fillRect 被调用 |
| 行 577-605 | I11 Test 2: 精灵位置随 x/y 变化 |
| 行 609-635 | I11 Test 3: retreating alpha=0.7, 灰色#888888; marching alpha=1.0 |
| 行 639-661 | I11 Test 4: 多行军 fillRect 调用数 > 单行军 |
| 行 665-676 | I11 Test 5: 无行军时不渲染精灵相关颜色 |
| 行 680-710 | I11 Test 6: 四阵营颜色验证 |
| 行 714-736 | I11 Test 7: setLineDash 虚线 + strokeStyle 阵营色 |
| 行 740-758 | I11 Test 8: arrived 交叉双剑 #FFD700 |
| 行 762-769 | I11 Test 9: retreating 路线 0.5 透明度 |
| 行 773-780 | I11 Test 10: ctx.save/restore 包裹 |
| 行 784-793 | I11 Test 11: 旗帜使用阵营色 (出现 >= 2次) |
| 行 797-810 | I11 Test 12: 4帧行走动画渲染 |

### 测试证据

```
Test command: npx vitest run src/components/idle/panels/map/__tests__/PixelWorldMapMarchSprites.test.tsx
Result: 35 passed (35 tests) — 38ms
Status: PASS
```

其中I11新增Canvas Mock测试20个 (Part 2 describe块内), Part 1基础测试15个。

### 集成证据

测试通过mock `HTMLCanvasElement.prototype.getContext` 返回mock Canvas context, 然后验证:
- `fillRect` 调用次数和参数 (精灵绘制)
- `fillStyle` 值 (阵营颜色)
- `globalAlpha` 值 (透明度)
- `setLineDash` 调用 (虚线路线)
- `strokeStyle` 值 (路线颜色)
- `beginPath`/`stroke` 调用 (arrived攻城效果)
- `save`/`restore` 调用 (上下文管理)

**非mock关键逻辑**: PixelWorldMap组件本身完全真实渲染, mock仅替代底层Canvas API (JSDOM环境下必须)。

---

## 功能点 3: R10 Task 7 (H7) — 将领受伤影响战力衰减计算

### 实现证据

**源码文件**: `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts`

| 位置 | 说明 |
|------|------|
| 行 320-323 | `getInjuryPowerModifier(injuryLevel)` — 纯函数，返回受伤等级对应战力系数 |
| 行 334-337 | `calculateEffectivePower(force)` — 计算编队实际战力 (基础战力 x 受伤系数) |
| 行 383-390 | `calculateRemainingPower(forceId)` — 完整战力计算: `basePower * heroMultiplier` |
| 行 308-311 | `getHeroPowerMultiplier(heroId)` — 获取将领战力倍率 (查 INJURY_POWER_MULTIPLIER) |
| 行 351-372 | `applyCasualties()` — 应用战斗伤亡: 扣除士兵 + 应用受伤 + 设置 returning 状态 |
| 行 425-433 | `applyHeroInjury()` — 设置受伤等级和恢复时间 |

**常量文件**: `src/games/three-kingdoms/engine/map/expedition-types.ts`

| 位置 | 说明 |
|------|------|
| 行 133-138 | `INJURY_POWER_MULTIPLIER`: none=1.0, minor=0.8, moderate=0.5, severe=0.2 |

**测试文件**: `src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts`

| 位置 | 说明 |
|------|------|
| 行 323-327 | H7 Test 1: 无伤 -> 系数 1.0 |
| 行 329-332 | H7 Test 2: 轻伤 -> 系数 0.8 |
| 行 334-337 | H7 Test 3: 中伤 -> 系数 0.5 |
| 行 339-342 | H7 Test 4: 重伤 -> 系数 0.2 |
| 行 344-352 | H7 Test 5: 编队实际战力 = 基础战力 * 受伤系数 (moderate 0.5) |
| 行 354-362 | H7 Test 6: 无伤编队 -> 系数 1.0 (回归测试) |

### 测试证据

```
Test command: npx vitest run src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts
Result: 37 passed (37 tests) — 5ms
Status: PASS
```

其中H7新增测试6个 (describe('H7: 将领受伤影响战力') 块内), 其余31个测试覆盖 applyCasualties/calculateRemainingPower/getForceHealthColor/removeForce 及组合场景。

### 集成证据

H7测试链路验证:
1. `applyCasualties(forceId, troopsLost, heroInjured=true, injuryLevel='moderate')` — 应用受伤
2. `system.getInjuryPowerModifier('moderate')` 返回 0.5 — 纯函数查表
3. `system.calculateEffectivePower(force)` 返回 400 — 编队实际战力 (800 troops x 0.5)
4. `system.calculateRemainingPower(forceId)` 内部调用 `getHeroPowerMultiplier(force.heroId)` 读取受伤状态

**非mock关键逻辑**: ExpeditionSystem实例完全真实, 仅mock ISystemDeps (EventBus/config/registry) 和 ExpeditionDeps (getHero/getAvailableTroops等), 这些是外部依赖接口, 不影响核心战力计算逻辑。

---

## 汇总

| 功能点 | 状态 | 测试数 | 通过 | 耗时 |
|--------|------|--------|------|------|
| R10 Task 5 (E1-3): 行军->攻占E2E | PASS | 14 | 14 | 4ms |
| R10 Task 6 (I11): 行军精灵Canvas渲染 | PASS | 35 | 35 | 38ms |
| R10 Task 7 (H7): 将领受伤战力衰减 | PASS | 37 | 37 | 5ms |
| **总计** | **ALL PASS** | **86** | **86** | **47ms** |

**Builder完成, 3个功能点有证据, 0个无证据。**
