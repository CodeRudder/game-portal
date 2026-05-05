# Builder Manifest — Round 23 Phase 2 行军推进 (P6) 客观审核

> **审核日期**: 2026-05-05
> **审核角色**: Builder (客观审核者)
> **审核流程**: Phase 2 行军推进 (P6)
> **完整链路**: 行军精灵在出发城市生成 -> A*寻路计算路线 -> 精灵沿道路移动 -> 进度显示 -> 到达目标触发Phase 3

---

## 1. 计划完成状态

| 任务ID | 检查项 | 完成状态 | 备注 |
|:------:|--------|:--------:|------|
| P6-1 | 行军精灵生成 | ✅完成 | SiegeTask创建后通过createMarch在出发城市生成精灵 |
| P6-2 | 行军时长约束 | ✅完成 | clamp(10s, 60s)在createMarch和generatePreview中均有实现 |
| P6-3 | A*寻路 | ✅完成 | calculateMarchRoute调用findPathBetweenCities(A*) |
| P6-4 | 路线显示 | ✅完成 | PixelWorldMap渲染黄色虚线+转折点+途径城市标签 |
| P6-5 | 进度指示 | ✅完成 | SiegeTaskPanel常驻进度条+ETA剩余时间 |
| P6-6 | 屏幕边缘指示器 | ⬜未完成 | 无屏幕边缘箭头+距离指示器实现 |
| P6-7 | 地形修正 | 🔄部分完成 | 有常量定义(ROAD/MOUNTAIN_SPEED_MULTIPLIER)但未在update中应用 |
| P6-8 | 到达判定 | ✅完成 | update中pathIndex>=path.length-1时state='arrived'并emit march:arrived |
| P6-9 | 并行行军渲染 | 🔄部分完成 | 有startTime排序但无显式渲染优先级规则 |
| P6-10 | 取消行军 | ✅完成 | cancelMarch设置cancelled状态并emit march:cancelled |
| P6-11 | 切后台/崩溃恢复 | ✅完成 | serialize/deserialize支持行军数据持久化 |
| P6-12 | 恢复超时处理 | ⬜未完成 | 无30s移动/10sPC超时检测和撤退逻辑 |

**汇总**: 7个已完成 / 2个未完成 / 3个部分完成

---

## 2. 实现证据

### P6-1: 行军精灵生成
- **MarchingSystem.ts:235-280** — `createMarch()` 方法创建MarchUnit对象,初始位置为path[0] (出发城市)
- **WorldMapTab.tsx:1176-1190** — `handleSiegeConfirm()` 中调用createMarch + startMarch
- **PixelWorldMap.tsx:236-254** — `collectMarchRects()` 根据兵力渲染1/3/5个精灵
- **约束 CR-02 (最多3个)**: ⚠️ 无硬性上限校验,依赖SiegeTaskManager的siege lock间接控制

### P6-2: 行军时长约束 [10s, 60s]
- **MarchingSystem.ts:143-146** — `MIN_MARCH_DURATION_MS = 10_000`, `MAX_MARCH_DURATION_MS = 60_000`
- **MarchingSystem.ts:246-247** — `createMarch()` 中 `Math.max(MIN, Math.min(MAX, rawEstimatedTime))`
- **MarchingSystem.ts:385-386** — `generatePreview()` 中同样clamp

### P6-3: A*寻路
- **PathfindingSystem.ts:309-335** — `findPathBetweenCities()` 使用A*算法
- **PathfindingSystem.ts:147-169** — `buildWalkabilityGrid()` 从地图数据构建可行走网格
- **MarchingSystem.ts:422-451** — `calculateMarchRoute()` 封装A*调用并返回MarchRoute
- **MarchingSystem.ts:518-544** — `findWaypointCities()` 提取途径城市

### P6-4: 路线显示
- **PixelWorldMap.tsx:1263-1386** — `renderMarchRouteOverlay()` 黄色虚线(#FFD700) + 转折点圆点 + 途径城市标签
- **PixelWorldMap.tsx:1416-1465** — `renderMarchSpritesOverlay()` Phase 1绘制每条行军路线(阵营色虚线)
- **PixelWorldMap.tsx:1492-1578** — `renderHighlightedMarchOverlay()` 高亮路线(加粗+脉冲)

### P6-5: 进度指示
- **SiegeTaskPanel.tsx:341-345** — marching状态显示ETA文本(`预计 Xs`)
- **SiegeTaskPanel.tsx:358-368** — 进度条(marching/sieging/paused/returning/settling)
- **SiegeTaskPanel.tsx:160-200** — `getProgressPercent()` 计算进度百分比
- **SiegeTaskManager.ts:441-487** — `getTaskSummary()` 计算marchProgress和siegeProgress

### P6-6: 屏幕边缘指示器
- **未实现** — 无边缘箭头指示器相关代码

### P6-7: 地形修正
- **MarchingSystem.ts:149-155** — 常量定义: `BASE_SPEED=30`, `ROAD_SPEED_MULTIPLIER=1.5`, `MOUNTAIN_SPEED_MULTIPLIER=0.5`
- ⚠️ `updateMarchPosition()` (line 458-479) 仅使用 `march.speed * dt`,未根据地形动态调整速度
- `calculateTerrainSummary()` (line 497-505) 返回硬编码的60%平原/30%道路/10%山地,非真实计算

### P6-8: 到达判定
- **MarchingSystem.ts:202-214** — update循环中检查 `pathIndex >= path.length - 1` → state='arrived' → emit march:arrived
- **MarchingSystem.ts:458-479** — `updateMarchPosition()` 逐路径点推进,到达时snap到最终位置
- **WorldMapTab.tsx:487-753** — handleArrived监听器处理到达后自动推进到Phase 3

### P6-9: 并行行军渲染
- **PixelWorldMap.tsx:1414** — `sortedMarches = [...marches].sort((a,b) => a.startTime - b.startTime)` 按创建时间排序
- ⚠️ 无显式渲染优先级规则(如距离远近、阵营优先级等)
- 无最大并行行军数限制

### P6-10: 取消行军
- **MarchingSystem.ts:301-314** — `cancelMarch()` 设置state='cancelled'并从activeMarches删除
- **WorldMapTab.tsx:757-778** — handleCancelled监听器处理关联的SiegeTask清理
- ⚠️ 资源退还未在行军系统中直接处理(需上层engine处理)

### P6-11: 切后台/崩溃恢复
- **MarchingSystem.ts:548-561** — `serialize()` 和 `deserialize()` 支持行军数据持久化
- 行军update基于dt(时间差)计算位置,理论上恢复后会跳到最新位置
- ⚠️ 无专门的恢复逻辑(如跳帧检测)

### P6-12: 恢复超时处理
- **未实现** — 无30s移动超时/10s PC超时的检测和撤退逻辑

---

## 3. 测试证据

### 3.1 引擎单元测试

| 测试文件 | 测试数 | 通过 | 失败 | 耗时 |
|---------|:------:|:----:|:----:|:----:|
| MarchingSystem.test.ts | 53 | 53 | 0 | 33ms |
| MarchRoute.test.ts | 22 | 22 | 0 | 33ms |

**覆盖场景**: 创建/启动/取消行军, 到达判定, 时长clamp, 序列化/反序列化, 回城行军, A*路线计算, 路径连续性, 途径城市

### 3.2 UI组件测试

| 测试文件 | 测试数 | 通过 | 失败 | 耗时 |
|---------|:------:|:----:|:----:|:----:|
| PixelWorldMapMarchSprites.test.tsx | 56 | 56 | 0 | 259ms |
| SiegeTaskPanel.test.tsx | 73 | 73 | 0 | 688ms |

**覆盖场景**: 精灵渲染(多状态/多阵营/多兵力), Canvas API调用验证, 路线虚线, 进度条, ETA显示, 空状态, 生命周期转换, 奖励领取, 暂停/继续/取消按钮

### 3.3 集成测试

| 测试文件 | 测试数 | 通过 | 失败 | 耗时 |
|---------|:------:|:----:|:----:|:----:|
| march-e2e-full-chain.integration.test.ts | 17 | 17 | 0 | 19ms |
| march-siege.integration.test.ts | 22 | 22 | 0 | 36ms |
| march-to-siege-chain.integration.test.ts | 14 | 14 | 0 | 17ms |
| marching-full-flow.integration.test.ts | 3 | 3 | 0 | 7ms |

**覆盖场景**: 完整行军生命周期(create->start->update->arrive), 事件触发顺序, 多并发行军, 取消行军, 行军→攻城状态转换, 回城行军, 多城链式攻占, siegeTaskId传播

**总计**: 260 tests, 260 passed, 0 failed

---

## 4. 测试有效性评估

| 测试文件 | mock关键依赖 | 评估 | 说明 |
|---------|:----------:|:----:|------|
| MarchingSystem.test.ts | eventBus=mock | ⚠️有效性存疑 | eventBus被vi.fn() mock,无法验证事件实际传播 |
| MarchRoute.test.ts | eventBus=mock | ⚠️有效性存疑 | 同上,使用手工构建的grid而非真实地图 |
| PixelWorldMapMarchSprites.test.tsx | Canvas=mock,地图=mock,config=mock | ⚠️有效性存疑 | Canvas API完全mock,无法验证真实渲染输出 |
| SiegeTaskPanel.test.tsx | CSS=mock | ✅有效 | 纯UI渲染测试,mock合理 |
| march-e2e-full-chain.integration.test.ts | 无(mock-free) | ✅有效 | 使用真实EventBus和MarchingSystem |
| march-siege.integration.test.ts | eventBus=mock | ⚠️有效性存疑 | eventBus mock但使用真实A*寻路 |
| march-to-siege-chain.integration.test.ts | 无(真实EventBus) | ✅有效 | 使用真实EventBus/MarchingSystem/SiegeTaskManager/SiegeBattleSystem |
| marching-full-flow.integration.test.ts | eventBus=mock | ⚠️有效性存疑 | 基础数据验证,无实际系统交互 |

**有效性统计**: 3个有效 / 5个有效性存疑

---

## 5. 客观事实清单

| 计划任务ID | 完成状态 | 实现位置 | 测试文件 | 测试结果 | 测试有效性 | 覆盖场景 |
|:----------:|:--------:|---------|---------|:--------:|:----------:|---------|
| P6-1 行军精灵生成 | ✅完成 | MarchingSystem.ts:235-280, PixelWorldMap.tsx:236-368 | MarchingSystem.test.ts, PixelWorldMapMarchSprites.test.tsx | 53+56 PASS | 存疑 | 创建精灵,mock Canvas渲染,多兵力精灵数 |
| P6-2 行军时长约束 | ✅完成 | MarchingSystem.ts:143-146,246-247 | MarchingSystem.test.ts:546-709 | 53 PASS | 存疑 | 短距离clamp=10s,长距离clamp=60s,边界值,多段路径 |
| P6-3 A*寻路 | ✅完成 | PathfindingSystem.ts:209-335, MarchingSystem.ts:422-451 | MarchRoute.test.ts, march-siege.integration.test.ts | 22+22 PASS | 存疑+部分有效 | 路线计算,路径连续性,途径城市,不可达,起终点 |
| P6-4 路线显示 | ✅完成 | PixelWorldMap.tsx:1263-1578 | PixelWorldMapMarchSprites.test.tsx:746-768 | 56 PASS | 存疑 | 虚线渲染(setLineDash),阵营色strokeStyle,高亮路线 |
| P6-5 进度指示 | ✅完成 | SiegeTaskPanel.tsx:160-368, SiegeTaskManager.ts:441-487 | SiegeTaskPanel.test.tsx | 73 PASS | 有效 | 进度条,ETA,defenseRatios驱动,returnETAs驱动 |
| P6-6 屏幕边缘指示器 | ⬜未完成 | 无 | 无 | N/A | N/A | 无覆盖 |
| P6-7 地形修正 | 🔄部分完成 | MarchingSystem.ts:149-155(常量),未在update中应用 | 无专项测试 | N/A | N/A | 无覆盖 |
| P6-8 到达判定 | ✅完成 | MarchingSystem.ts:202-214,458-479 | march-e2e-full-chain.integration.test.ts, march-siege.integration.test.ts | 17+22 PASS | 有效 | 到达→arrived→march:arrived事件,完整链路 |
| P6-9 并行行军渲染 | 🔄部分完成 | PixelWorldMap.tsx:1414(startTime排序) | march-e2e-full-chain.test.ts:280-386 | 17 PASS | 有效 | 多并发行军独立到达,位置不干扰 |
| P6-10 取消行军 | ✅完成 | MarchingSystem.ts:301-314, WorldMapTab.tsx:757-778 | MarchingSystem.test.ts:401-542, march-to-siege-chain.test.ts:616-753 | 53+14 PASS | 存疑+有效 | 各状态取消,重复取消,march:cancelled事件,siegeTaskId传播 |
| P6-11 切后台/崩溃恢复 | ✅完成 | MarchingSystem.ts:548-561 | MarchingSystem.test.ts:711-766 | 53 PASS | 存疑 | 序列化/反序列化,siegeTaskId保留 |
| P6-12 恢复超时处理 | ⬜未完成 | 无 | 无 | N/A | N/A | 无覆盖 |

---

## 6. 关键发现

### 已实现 (质量可接受)
1. **行军核心流程完整**: createMarch → startMarch → update(dt) → arrived 事件链路畅通
2. **时长约束严格执行**: clamp(10s, 60s) 在 createMarch 和 generatePreview 均有测试覆盖
3. **A*寻路集成有效**: calculateMarchRoute 正确调用 PathfindingSystem, 路径连续性和途径城市提取均通过测试
4. **到达→攻城转换**: march:arrived 事件正确携带 siegeTaskId, WorldMapTab 正确推进 SiegeTaskManager 状态
5. **取消行军链路**: cancelMarch → march:cancelled → SiegeTask清理 链路完整
6. **UI渲染全面**: 精灵多状态渲染,路线虚线,进度条,ETA显示均实现并有Canvas API级别测试

### 未完成/待改进
1. **P6-6 屏幕边缘指示器**: 完全未实现,无任何相关代码
2. **P6-12 恢复超时处理**: 完全未实现,无超时检测和撤退逻辑
3. **P6-7 地形修正**: 常量已定义但未在 updateMarchPosition 中应用,calculateTerrainSummary返回硬编码值
4. **P6-9 并行渲染优先级**: 仅有startTime排序,缺乏显式优先级规则(距离/阵营等)
5. **CR-02 最多3个行军**: MarchingSystem无硬性上限,依赖外部 siege lock 间接限制
6. **资源退还(P6-10)**: 取消行军的100%资源退还未在行军系统中直接处理

### 测试有效性顾虑
- 5/8测试文件mock了关键依赖(eventBus或Canvas),降低了集成验证的可靠性
- march-e2e-full-chain 和 march-to-siege-chain 使用真实子系统,是最可靠的测试
- 缺少地形修正(P6-7)的专项测试

---

*Builder Manifest | Round 23 | 2026-05-05*
