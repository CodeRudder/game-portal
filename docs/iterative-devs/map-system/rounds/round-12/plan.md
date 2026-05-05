# Round 12 计划

> **迭代**: map-system
> **轮次**: Round 12
> **来源**: `PLAN.md` + Round 11 `judge-ruling.md` + Round 11 `builder-manifest.md` + R9-R11 跨轮趋势
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | E1-3: 行军→攻占完整链路E2E | PLAN.md E1-3 (MAP-F02b + MAP-F06) | R10已有march-to-siege-chain基础集成测试(14场景)，但精灵沿道路移动→到达→触发事件的完整视觉链路未打通；R11 Judge P2 #8确认精灵残留问题 |
| P1 | R11遗留P1修复(4项) | R11 Judge P1 #1/#2/#3/#5 | Test 14描述不精确、分层脏标记优化效果有限、originalPath死参数、Benchmark 8无意义 |
| P1 | I5: 城防衰减显示(UI层) | PLAN.md I5 (MAP-F06-13) | 引擎层已有城防衰减计算(R9 PixelWorldMap城防血条渲染)，需补充衰减动画+实时递减+恢复UI |
| P1 | I10: 攻占任务面板UI完善 | PLAN.md I10 (MAP-F06-10) | R9已实现SiegeTaskPanel基础功能(进度条/ETA/折叠/聚焦)，需补充编队摘要/状态图标/空状态 |
| P2 | E1-4: 离线→上线→弹窗→领取→资源更新 | PLAN.md E1-4 (MAP-F10~F12) | 离线系统端到端闭环，R10/R11均未推进 |
| P2 | D3-4: 行军精灵批量渲染减少drawCall | PLAN.md D3-4 | 性能优化收尾项，与R11性能基准测试联动 |
| P2 | I7: 内应信掉落 | PLAN.md I7 (MAP-F08-01) | 攻城胜利20%概率掉落，引擎层已有内应信逻辑(R5 I2)，需补充掉落触发+UI通知 |
| P2 | I8: 攻城策略道具获取 | PLAN.md I8 (MAP-F06-03) | 夜袭令/内应信商店获取途径，P4阶段道具管理 |
| P2 | H5/H6: 伤亡/将领受伤UI显示 | PLAN.md H5/H6 | R9已实现SiegeResultModal伤亡详情基础版，H5需将领受伤状态图标增强，H6需将领面板受伤标记 |
| P2 | R11遗留P2修复(5项) | R11 Judge P2 #4/#6/#7/#8/#10 | intercepted渲染逻辑、mock canvas局限性、EventBus mock范围、空行军清除、retreating瞬时状态 |

## 对抗性评测重点

- [ ] **R11 P1 #1 验证**: dirty-flag Test 14 名称改为"activeMarches变化标记全部层脏"或改用空数组场景；补充对 `terrain/effects/route === false` 的断言（仅限空数组→空数组场景）
- [ ] **R11 P1 #2 验证**: 分层脏标记 `markDirtyRef.current()` 调用点梳理，为各 useEffect 实现更精细的脏标记策略，或承认当前保守策略的合理性并更新文档
- [ ] **R11 P1 #3 验证**: `MarchingSystem.test.ts` 中5处 `originalPath` 死参数已移除，`tsc --strict` 零错误
- [ ] **R11 P1 #5 验证**: Benchmark 8 "1000次fillRect < 1ms" 已移除或改造为测量组件渲染逻辑完整路径的有意义基准
- [ ] **E1-3 完整链路**: 行军创建 → A*寻路 → 精灵沿道路移动数据 → 到达事件 → 攻城触发 → 精灵清理（R11 P2 #8残留问题），>= 4 个新增/增强E2E场景
- [ ] **I5 城防衰减显示**: 每秒递减动画在Canvas上正确渲染（衰减曲线+颜色过渡+恢复阶段），>= 8 个Canvas渲染测试
- [ ] **I10 攻占任务面板**: 编队摘要(将领名+兵力数)、状态图标(5种)、空状态引导文案渲染正确，>= 10 个UI测试
- [ ] **E1-4 离线链路**: 离线时长计算→奖励生成→弹窗→领取→资源增量，>= 5 个集成测试场景
- [ ] **D3-4 批量渲染**: 50精灵场景drawCall数较优化前减少 >= 30%，无视觉回归
- [ ] **R11 P2 #8 验证**: activeMarches从非空变为空时，精灵层Canvas正确清除（非残留）
- [ ] **R11 P2 #10 验证**: cancelMarch的retreating状态要么创建真正的返回行军动画，要么语义调整为"取消"而非"撤退"
- [ ] **Builder交付门禁**: 必须报告全部已有测试套件运行结果（含R11之前套件），组件测试 >= 378 通过
- [ ] **TypeScript门禁**: `tsc --noEmit` 零错误（排除pre-existing PathfindingSystem 5个错误）

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0（R11遗留4个P1 + 本轮新增P1全部清除） |
| P2 | <= 3（R11遗留5个P2 + 本轮新增P2，至少清除5个） |
| 测试通过率 | 100% |
| TS错误 | 0（排除pre-existing PathfindingSystem 5个错误） |
| PLAN.md完成率 | >= 92%（当前~80%，目标新增E1-3/E1-4/D3-4/I5/I10/H5/H6） |
| 内部循环次数 | <= 2 |
| 新增测试用例 | >= 40（E2E 8 + I5 Canvas 8 + I10 UI 10 + 离线 5 + 批量渲染 5 + P1修复 4） |

---

## 任务清单

### Task 1: R11遗留P1修复 — Test 14脏标记描述修正 + 分层策略优化 (P1, Small)

- **来源**: R11 Judge P1 #1 + P1 #2
- **涉及文件**:
  - `src/components/idle/panels/map/__tests__/PixelWorldMap.dirty-flag.test.tsx` — Test 14修正
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — markDirty策略优化（可选）
- **步骤**:
  1. 修正Test 14名称：`activeMarches变化仅标记sprites=true` → `activeMarches变化（非空→非空）标记全部层脏`
  2. 为Test 14补充对 `terrain/effects/route === true` 的断言（因为 `markDirtyRef.current()` 确实标记全部层）
  3. 新增Test 15：空数组→空数组场景，验证仅 `sprites=true`，其他层 `=== false`
  4. 评估 `markDirtyRef.current()` 调用策略：
     - 方案A（保守，推荐）：承认当前保守策略，在文档中说明"宁可多标记也不漏标记"
     - 方案B（优化）：为各 useEffect 实现更精细的脏标记（如 `territories` 变化仅标记 `terrain`，`marchRoute` 变化仅标记 `route`）
  5. 如选方案B，修改各 useEffect 将 `markDirtyRef.current()` 替换为精确的层标记
- **验证**:
  - Test 14 断言完整（4个层均有断言）
  - Test 15 新增且通过
  - `tsc --noEmit` 零错误
  - 全部15+个dirty-flag测试通过

### Task 2: R11遗留P1修复 — originalPath死参数清理 (P1, Trivial)

- **来源**: R11 Judge P1 #3
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts` — 移除5处 `originalPath`
- **步骤**:
  1. 定位 `MarchingSystem.test.ts` 中5处传递 `originalPath` 的测试用例（L293, L307, L332, 347, 388）
  2. 移除每处 `originalPath: [{ x: 0, y: 0 }, { x: 10, y: 10 }]` 参数
  3. 修正"路径基于 calculateMarchRoute（非 originalPath）"测试描述，改为"路径通过 calculateMarchRoute 重新计算"
  4. 运行 `tsc --strict` 验证零TS2353错误
  5. 运行全部MarchingSystem测试验证通过
- **验证**:
  - 5处 `originalPath` 已移除
  - `npx tsc --noEmit --strict` 零错误
  - `MarchingSystem.test.ts` 全部43+测试通过

### Task 3: R11遗留P1修复 — Benchmark 8改造 (P1, Trivial)

- **来源**: R11 Judge P1 #5
- **涉及文件**:
  - `src/components/idle/panels/map/__tests__/PixelWorldMap.perf.test.tsx` — Benchmark 8
- **步骤**:
  1. 评估改造方案：
     - 方案A（推荐）：移除Benchmark 8，因为裸调mock无参考价值
     - 方案B：改造为测量组件渲染逻辑完整路径的基准——使用 `renderPixelWorldMap` + mock数据，测量从props设置到Canvas API调用完成的时间
  2. 如选方案A：移除Benchmark 8，更新文件头注释说明移除原因
  3. 如选方案B：重写Benchmark 8，使用完整的组件渲染流程（包含dirty flag检查 + 层渲染逻辑 + Canvas API调用）
  4. 更新性能基准总数（11→10或11）
- **验证**:
  - Benchmark 8不再测量裸mock调用开销
  - 全部性能基准测试通过
  - 如改造：新Benchmark 8测量完整渲染逻辑路径，断言有意义

### Task 4: E1-3 行军→攻占完整链路E2E增强 (P1, Large)

- **来源**: PLAN.md E1-3 (MAP-F02b + MAP-F06) + R11 Judge P2 #8 (精灵残留)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/__tests__/integration/march-e2e.integration.test.ts` — 增强/新建
  - `src/components/idle/panels/map/__tests__/PixelWorldMapMarchSprites.test.tsx` — 精灵清除测试
- **步骤**:
  1. 梳理R10已有march-to-siege-chain集成测试(14场景)的覆盖范围
  2. 新增/增强E2E场景（聚焦E1-3定义的完整链路）：
     - **场景1: 完整行军生命周期** — createMarch → PathfindingSystem A*寻路 → 路径点验证 → MarchingSystem.update推进 → 精灵位置沿路径线性插值 → 到达目标城 → march:arrived事件触发 → 自动进入sieging状态
     - **场景2: 精灵位置与A*路径一致性** — 验证多个update调用后，MarchUnit.position 与 PathfindingSystem返回路径上的点偏差 < epsilon
     - **场景3: 多城链式行军** — A→B攻城成功后，B→C继续攻城，验证无状态污染，每次行军独立
     - **场景4: 行军速度与距离关系** — 验证行军到达时间 = 路径总距离 / march.speed，精度在10ms内
  3. 修复R11 P2 #8（精灵残留）：
     - 新增Canvas测试：activeMarches从非空变为空后，`clearRect` 被调用清除精灵层，无残留像素
     - 在 `PixelWorldMap.tsx` 中修复 `renderMarchSpritesOverlay`：当 `marches.length === 0` 时执行 `ctx.clearRect` 清除精灵区域
  4. 修复R11 P2 #10（retreating瞬时状态）：
     - 评估 `cancelMarch` 语义：要么在取消后创建短暂的retreating视觉（延迟1帧再从active移除），要么将状态改为 `cancelled`（而非 `retreating`）
     - 如改语义：添加 `cancelled` 状态到行军状态机，更新渲染逻辑和测试
  5. 验证完整事件链：`march:created` → `march:updated`(多次) → `march:arrived` → `siege:started`
- **验证**:
  - >= 4 个新增/增强E2E场景通过
  - 精灵位置与A*路径偏差 < epsilon
  - activeMarches清空后精灵Canvas被清除（P2 #8修复）
  - retreating状态语义合理（P2 #10处理）
  - 完整事件链无遗漏

### Task 5: I5 城防衰减显示 — UI动画与实时渲染 (P1, Medium)

- **来源**: PLAN.md I5 (MAP-F06-13)，引擎层✅，UI层❌
- **涉及文件**:
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — 城防血条渲染增强
  - `src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx` — 扩展测试
- **步骤**:
  1. 梳理R9已实现的城防血条渲染：
     - 静态颜色分段（绿>0.6/黄0.3~0.6/红<0.3）
     - barWidth = ts*3
     - 百分比文本
  2. 实现城防衰减动画：
     - **实时递减显示**: 攻城战斗阶段(10s~60s)，城防血条每帧按衰减曲线递减
     - **衰减曲线可视化**: 血条宽度 + 颜色随ratio实时变化（绿→黄→红平滑过渡）
     - **恢复动画**: 攻城结束后城防恢复阶段，血条从当前值渐增到恢复目标值
     - **数字跳动**: 百分比文本实时更新（带缓动效果，避免数字闪烁）
  3. Canvas渲染优化：
     - 衰减动画在effects层（而非terrain层）渲染，利用脏标记机制减少重绘
     - 使用 `requestAnimationFrame` 驱动，与animate loop集成
  4. 编写Canvas渲染测试：
     - 衰减过程中 ratio 递减 → 血条宽度递减
     - 颜色边界过渡（ratio=0.6绿→黄，ratio=0.3黄→红）
     - 恢复阶段 ratio 递增 → 血条宽度递增
     - 非battle阶段不渲染衰减动画
     - 多城市同时攻城时各血条独立衰减
- **验证**:
  - >= 8 个Canvas渲染测试通过
  - 衰减动画平滑（无跳帧）
  - 颜色过渡正确
  - 脏标记机制正确（仅effects层脏）
  - 与已有城防血条测试兼容

### Task 6: I10 攻占任务面板UI完善 (P1, Medium)

- **来源**: PLAN.md I10 (MAP-F06-10)，R9已实现基础版
- **涉及文件**:
  - `src/components/idle/panels/map/SiegeTaskPanel.tsx` — UI增强
  - `src/components/idle/panels/map/SiegeTaskPanel.test.tsx` — 测试扩展
- **步骤**:
  1. 梳理R9已实现功能：
     - 实时进度条 (defenseRatios驱动)
     - 回城ETA (returnETAs驱动)
     - 已完成折叠 (MAX_COMPLETED_TASKS=5)
     - 聚焦路线按钮
  2. 补充UI元素：
     - **编队摘要**: 显示将领名(图标+文字) + 兵力数(数字)
     - **状态图标**: 5种状态对应图标
       - `marching` (行军中) → 移动箭头图标
       - `sieging` (攻城中) → 剑盾图标
       - `returning` (回城中) → 回城箭头图标
       - `completed` (已完成) → 绿色勾号
       - `failed` (失败) → 红色叉号
     - **空状态引导**: 无攻城任务时显示引导文案："选择敌方城市开始攻城"
     - **任务创建时间**: 显示创建经过时间（如"3分钟前"）
  3. 响应式适配检查（配合D2系列）
  4. 编写UI测试覆盖新增元素
- **验证**:
  - >= 10 个新增UI测试通过
  - 编队摘要渲染正确（将领+兵力）
  - 5种状态图标正确显示
  - 空状态引导文案显示
  - 任务创建时间格式化正确
  - 向后兼容（已有功能不受影响）

### Task 7: E1-4 离线→上线→弹窗→领取→资源更新 (P2, Large)

- **来源**: PLAN.md E1-4 (MAP-F10~F12)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/OfflineRewardSystem.ts` 或相关离线系统
  - `src/components/idle/panels/map/` 离线奖励弹窗组件
  - `src/games/three-kingdoms/engine/map/ResourceSystem.ts` 或资源管理
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/integration/offline-e2e.integration.test.ts`
- **步骤**:
  1. 梳理已有离线系统实现：
     - C1/C2已在R6完成(离线奖励弹窗+产出管理面板)
     - 确认离线奖励计算逻辑位置和数据结构
  2. 设计离线端到端测试场景：
     - **场景1: 正常离线奖励** — 离线8小时 → 上线 → 弹窗显示奖励 → 领取 → 资源增量 = 领土产出 * 8h
     - **场景2: 离线时间过短** — 离线5分钟 → 无弹窗或最低奖励
     - **场景3: 离线时间过长** — 离线72小时 → 奖励封顶（如有上限机制）
     - **场景4: 多资源类型** — 领土产出粮草/金币/元宝等多种资源分别计算
     - **场景5: 领土变化影响** — 离线期间领土被占 → 产出按实际占领时间计算
  3. 验证离线时长计算精度（秒级）
  4. 验证弹窗UI数据与实际奖励数据一致
  5. 验证领取后资源增量精确匹配（无浮点误差）
- **验证**:
  - >= 5 个端到端集成测试通过
  - 离线时长计算误差 < 1秒
  - 资源增量精确到整数
  - 弹窗数据与计算数据一致

### Task 8: D3-4 行军精灵批量渲染减少drawCall (P2, Medium)

- **来源**: PLAN.md D3-4
- **涉及文件**:
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — renderMarchSpritesOverlay优化
  - `src/components/idle/panels/map/__tests__/PixelWorldMap.perf.test.tsx` — 性能对比基准
- **步骤**:
  1. 分析当前 `renderMarchSpritesOverlay` 的drawCall模式：
     - 每个精灵独立调用 `fillRect`/`arc` → N个精灵 = N * k 次drawCall
     - 识别可批量化的操作（同色精灵合并、路径批量绘制等）
  2. 实现批量渲染优化：
     - **方案A: 同色批量** — 将同阵营精灵的 `fillRect` 调用合并为一个 `beginPath` + 多个 `rect` + 一个 `fill`
     - **方案B: 离屏Canvas预渲染** — 将静态精灵图预渲染到离屏Canvas，主Canvas直接 `drawImage`
     - **方案C: 路径合并** — 同路线的多精灵共享一次 `setLineDash` + `stroke` 调用
  3. 建立优化前后性能对比基准：
     - 10精灵场景 drawCall数对比
     - 50精灵场景 drawCall数对比
     - 100精灵场景 drawCall数对比（压力测试）
  4. 验证优化后无视觉回归（颜色/位置/动画不变）
- **验证**:
  - 50精灵场景drawCall数减少 >= 30%
  - 视觉回归测试通过（颜色/位置/动画正确）
  - 性能基准测试通过
  - 全部已有精灵测试通过

### Task 9: I7 内应信掉落 + I8 攻城策略道具获取 (P2, Medium)

- **来源**: PLAN.md I7 (MAP-F08-01) + I8 (MAP-F06-03)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/SiegeRewardSystem.ts` — 掉落逻辑
  - `src/components/idle/panels/map/SiegeResultModal.tsx` — 掉落显示
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/SiegeReward.drop.test.ts`
- **步骤**:
  1. **I7 内应信掉落**:
     - 攻城胜利后20%概率掉落内应信
     - 使用确定性随机种子（基于taskId + 攻城时间），保证可测试性
     - 掉落物品添加到玩家背包
     - SiegeResultModal中显示掉落动画/通知
  2. **I8 攻城策略道具获取**:
     - 定义道具数据结构（夜袭令/内应信/围困手册等）
     - 实现道具获取途径：商店购买 / 攻城掉落 / 每日签到
     - 道具数量检查集成到攻城策略选择UI（R5 I1/I2已有三态卡片，需对接道具数量）
  3. 编写测试：
     - 掉落概率验证（100次模拟中约20次掉落，95%置信区间）
     - 道具获取/消耗正确性
     - 道具不足时策略选择被禁用
- **验证**:
  - >= 8 个测试通过（掉落5 + 道具获取3）
  - 掉落概率在合理范围内
  - 道具数据结构完整
  - 与已有策略选择UI集成无冲突

### Task 10: H5/H6 伤亡/将领受伤UI显示增强 (P2, Medium)

- **来源**: PLAN.md H5 (MAP-F06) + H6 (MAP-F06)
- **涉及文件**:
  - `src/components/idle/panels/map/SiegeResultModal.tsx` — H5增强
  - `src/components/idle/panels/map/` 将领面板组件 — H6新增
  - `src/components/idle/panels/map/SiegeResultModal.test.tsx` — 测试扩展
- **步骤**:
  1. **H5 增强内容**:
     - 将领受伤状态图标（轻伤🟡/中伤🟠/重伤🔴 + 颜色编码）
     - 将领恢复倒计时（实时更新，每秒刷新）
     - 伤亡对比可视化（我方损失 vs 预计敌方损失）
  2. **H6 将领受伤状态显示**:
     - 将领选择面板中标记受伤状态（灰色遮罩 + 受伤图标）
     - 受伤将领不可选（编队选择时灰色+tooltip"恢复中"）
     - 恢复进度条（剩余时间/总恢复时间）
  3. 编写UI测试
- **验证**:
  - >= 8 个新增UI测试通过
  - 3种受伤级别颜色正确
  - 恢复倒计时实时更新
  - 受伤将领在选择面板中正确标记
  - 向后兼容（无伤亡时不显示伤亡区域）

---

## R11遗留问题追踪

| ID | 问题 | 优先级 | 本轮处理 |
|----|------|:------:|---------|
| R12-1 | R11 P1 #1: dirty-flag Test 14描述不精确 | P1 | Task 1 |
| R12-2 | R11 P1 #2: 分层脏标记优化效果有限 | P1 | Task 1 |
| R12-3 | R11 P1 #3: originalPath死参数 | P1 | Task 2 |
| R12-4 | R11 P1 #5: Benchmark 8无意义 | P1 | Task 3 |
| R12-5 | R11 P2 #4: intercepted无专门渲染逻辑 | P2 | Task 4步骤4（随retreating语义一起处理） |
| R12-6 | R11 P2 #6: 所有性能基准用mock canvas | P2 | 不修复（Judge已确认为已知技术约束，文档已声明） |
| R12-7 | R11 P2 #7: EventBus完全mock | P2 | Task 4（E2E集成测试使用真实EventBus） |
| R12-8 | R11 P2 #8: 无空行军清除测试 | P2 | Task 4步骤3 |
| R12-9 | R11 P2 #10: retreating状态瞬时无效 | P2 | Task 4步骤4 |
| R12-10 | R10 DEFERRED: 双路径结算架构统一 | P2 | DEFERRED至R13（本轮聚焦功能推进） |
| R12-11 | Pre-existing: PathfindingSystem TS错误 | P3 | 不处理 |

## 跨轮趋势参考（R9-R11）

| 指标 | R9 | R10 | R11 | R12目标 |
|------|:--:|:---:|:---:|:-------:|
| 对抗性发现 | 8 | 6 | 11 | <= 8 |
| P0问题 | 1→0 | 0 | 0 | 0 |
| P1问题 | 3→0 | 2→0 | 4(未修复) | 0 |
| P2问题 | 4 | 2 | 5 | <= 3 |
| 内部循环次数 | 2 | 1 | N/A | <= 2 |
| PLAN.md完成率 | 74% | ~80% | ~80% | >= 92% |
| 测试总数 | 223 | ~250+ | ~378+ | ~420+ |
| 跨轮遗留P1 | 0 | 0 | 4 | 0 |

> R11出现4个P1遗留（前几轮均在子轮内清除），R12首要目标是清除所有遗留P1。PLAN.md完成率长期停滞在~80%，R12聚焦E1-3/E1-4/I5/I10等核心未完成项，目标突破92%。

## 改进措施（来自R9/R10/R11复盘）

| ID | 措施 | 本轮执行 |
|----|------|---------|
| IMP-01 | Builder交付门禁：必须报告全部已有测试套件运行结果 | 所有Task验证步骤已包含 |
| IMP-02 | TypeScript门禁：每Task完成后运行 `tsc --noEmit` | 所有Task验证步骤已包含 |
| IMP-03 | 高亮行军路线E2E集成测试 | R9/R10已完成基础版，Task 4增强精灵清除 |
| IMP-04 | 双路径结算架构统一 | DEFERRED至R13 |
| IMP-05 | 测试回归检查：每次大规模重构后必须运行全量测试 | 所有Task验证步骤已包含 |
| IMP-06 | TypeScript编译门禁：每次提交前 `tsc --noEmit` | 所有Task验证步骤已包含 |
| IMP-07 | 边界值测试规范：严格边界值使用精确值 | Task 5城防衰减测试遵循 |
| IMP-08 | 对称路径验证：Path A/B对称逻辑必须同时覆盖 | Task 4 E2E测试覆盖 |
| IMP-09 (R12新增) | R11遗留P1优先修复：跨轮遗留P1在下一轮Task 1-3中优先处理 | Task 1/2/3 |
| IMP-10 (R12新增) | PLAN.md停滞突破：连续2轮完成率~80%，本轮必须推进至少5个新功能项到✅ | Task 4-10 |

---

## 预期PLAN.md更新

| ID | 当前状态 | 预期状态 | 依据 |
|----|---------|---------|------|
| E1-3 | ⬜ | ✅ | Task 4: E2E增强 + 精灵清除修复 |
| E1-4 | ⬜ | ✅ (如Task 7完成) | Task 7: 离线E2E |
| D3-4 | ⬜ | ✅ (如Task 8完成) | Task 8: 批量渲染优化 |
| I5 | ⬜ (引擎✅, UI❌) | ✅ | Task 5: 城防衰减UI动画 |
| I7 | ⬜ | ✅ (如Task 9完成) | Task 9: 内应信掉落 |
| I8 | ⬜ | ✅ (如Task 9完成) | Task 9: 道具获取 |
| I10 | ⬜ (基础版已有) | ✅ | Task 6: 面板UI完善 |
| I11 | ⬜ (部分完成) | ✅ | Task 4: 行军精灵增强 |
| H5 | ⬜ (基础版已有) | ✅ (如Task 10完成) | Task 10: 伤亡详情增强 |
| H6 | ⬜ | ✅ (如Task 10完成) | Task 10: 将领受伤UI |
| D3-1 | 🔄 | ✅ | R11已实现性能基准，本轮补充精灵清除后标记完成 |
| D3-2 | 🔄 | ✅ | R11已实现脏标记机制，Task 1修复P1后标记完成 |

预期完成率: 44 + 8~12 = 52~56/65 = **80% → 92%~98%** (取决于Task 7/8/9/10完成情况)

## 实施优先序

```
Phase 1 — R11遗留P1修复（阻塞一切，最高优先）
  Task 1 (P1, Small)    → dirty-flag Test 14修正 + 分层策略优化
  Task 2 (P1, Trivial)  → originalPath死参数清理
  Task 3 (P1, Trivial)  → Benchmark 8改造/移除

Phase 2 — E1-3完整链路 + R11 P2修复（依赖Phase 1）
  Task 4 (P1, Large)    → 行军→攻占E2E增强 + 精灵清除(retreating语义)

Phase 3 — I5/I10 UI功能（可与Phase 2并行）
  Task 5 (P1, Medium)   → I5 城防衰减UI动画
  Task 6 (P1, Medium)   → I10 攻占任务面板完善

Phase 4 — E1-4/D3-4/I7/I8/H5/H6（功能推进，可与Phase 3并行）
  Task 7  (P2, Large)   → E1-4 离线系统E2E
  Task 8  (P2, Medium)  → D3-4 批量渲染优化
  Task 9  (P2, Medium)  → I7/I8 内应信掉落+道具获取
  Task 10 (P2, Medium)  → H5/H6 伤亡/受伤UI增强
```

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| R11遗留P1修复引入回归 | 低 | 中 | 修复后运行全量测试套件，dirty-flag基准已建立 |
| E1-3 E2E测试跨系统依赖复杂 | 中 | 中 | 使用真实EventBus + MarchingSystem + SiegeBattleSystem组合，避免过度mock |
| I5城防衰减动画与animate loop冲突 | 低 | 中 | 在effects层渲染，与现有脏标记机制集成，避免干扰terrain层 |
| E1-4离线系统代码可能不完整 | 中 | 高 | 先梳理已有离线系统实现，确认数据结构可用再编写测试 |
| D3-4批量渲染优化导致视觉回归 | 低 | 中 | 逐精灵颜色/位置断言回归测试 |
| Task数量(10个)过多导致轮次膨胀 | 中 | 中 | 严格按Phase优先序执行，Phase 4为弹性范围，可按时间裁剪 |

---

*Round 12 迭代计划 | 2026-05-04*
