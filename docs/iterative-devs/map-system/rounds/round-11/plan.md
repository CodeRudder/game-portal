# Round 11 计划

> **迭代**: map-system
> **轮次**: Round 11
> **来源**: `PLAN.md` + Round 10 `report.md` + Round 9 `report.md`
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | R10遗留P1: 行军精灵smoke tests功能断言补充 | R10 P1-2 (R11-1) | 16个smoke tests仅验证调用不崩溃，Canvas调用断言密度不足 |
| P1 | R10遗留P2: return march异常路径测试 | R10 P2-2 (R11-2) | 行军系统中断/取消场景mock覆盖不足 |
| P1 | E1-3: 行军系统端到端完整链路 | PLAN.md E1-3 | 行军→A*寻路→精灵沿道路移动→到达→触发事件，全链路打通 |
| P1 | E1-4: 离线→上线→弹窗→领取→资源更新 | PLAN.md E1-4 | 离线系统端到端闭环验证 |
| P1 | D3-1: 像素地图渲染60fps无卡顿 | PLAN.md D3-1 | 性能基准线达标，满足验收标准第7条 |
| P1 | D3-2: 脏标记渲染(无变化时跳过) | PLAN.md D3-2 | 渲染性能优化核心机制 |
| P2 | I3: 攻城锁定机制 | PLAN.md I3 (MAP-F06-05) | 攻城阶段P5核心功能，引擎部分有初步实现需完善 |
| P2 | I10: 攻占任务面板UI | PLAN.md I10 (MAP-F06-10) | R9已实现SiegeTaskPanel基础功能，需补充UI细节 |
| P2 | I11: 行军精灵显示与路线交互增强 | PLAN.md I11 (MAP-F06-11) | R10已实现基础渲染，需增强交互能力 |
| P2 | H5: 攻城结果弹窗显示伤亡详情增强 | PLAN.md H5 (MAP-F06) | R9已实现基础版，需补充将领受伤状态等细节 |

## 对抗性评测重点

- [ ] 行军精灵smoke tests是否真正补充了Canvas调用级断言（非仅"不崩溃"）
- [ ] return march异常路径：中断/取消/重复取消/取消不存在的行军等边界条件
- [ ] E1-3端到端链路：行军创建→寻路→精灵移动→到达→攻城触发，数据一致性验证
- [ ] E1-4离线链路：离线时长计算→奖励生成→弹窗→领取→资源增量验证
- [ ] D3-1性能基准：requestAnimationFrame帧率测量，是否存在GC卡顿
- [ ] D3-2脏标记：无变化时Canvas渲染调用次数为0，有变化时仅重绘脏区域
- [ ] I3攻城锁定：并发攻城请求互斥验证，锁定超时释放，锁定状态一致性
- [ ] I10攻占任务面板：任务列表渲染正确性，状态转换完整，空状态处理
- [ ] I11行军精灵交互：点击精灵→显示信息，路线hover→高亮，拖拽视窗不影响精灵
- [ ] H5伤亡详情：5种outcome渲染正确，将领受伤状态显示，恢复时间倒计时
- [ ] Builder交付门禁：必须报告全部已有测试套件运行结果（含R10之前套件）
- [ ] TypeScript门禁：Builder每完成一个Task运行`tsc --noEmit`，零错误才能提交

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0（子轮内全部清除） |
| 测试通过率 | 100% |
| TS错误 | 0（排除pre-existing PathfindingSystem 5个错误） |
| PLAN.md完成率 | >= 88%（当前~80%，目标新增D3-1/D3-2/E1-3/E1-4） |
| 内部循环次数 | <= 2 |

---

## 任务清单

### Task 1: 行军精灵smoke tests功能断言补充 (R10遗留P1)

- **来源**: R10 P1-2 (R11-1)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/__tests__/` 行军精灵测试文件
  - 行军精灵相关Canvas渲染测试
- **步骤**:
  1. 识别16个现有smoke tests，标注为"Part 1: smoke tests"
  2. 为每个smoke test创建对应的功能断言测试：
     - Canvas `fillRect`/`arc`/`drawImage` 调用参数验证
     - 阵营色(wei/shu/wu/neutral)正确传递到Canvas API
     - 4帧行走动画帧计数正确递增
     - 路线虚线`setLineDash`参数正确
     - 抵达攻城特效闪烁帧验证
     - 撤退半透明`globalAlpha`值验证
  3. 确保新增测试与smoke tests分离，可独立运行
  4. 运行全部测试套件验证通过
- **验证**:
  - 16个smoke tests各补充至少1个功能断言测试
  - 新增测试全部通过
  - Canvas mock调用记录包含具体参数断言

### Task 2: return march异常路径测试 (R10遗留P2)

- **来源**: R10 P2-2 (R11-2)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts`
  - `src/games/three-kingdoms/engine/map/MarchingSystem.ts`
- **步骤**:
  1. 设计异常路径测试场景：
     - 场景A: 行军中取消 → 状态正确回退
     - 场景B: 取消不存在的行军 → 不崩溃，返回错误
     - 场景C: 重复取消同一行军 → 幂等处理
     - 场景D: 行军中断后重新创建 → 资源释放正确
     - 场景E: return march途中取消 → 编队状态恢复
     - 场景F: 并发创建行军和取消行军 → 竞态条件安全
  2. 实现测试用例，mock范围覆盖MarchingSystem完整状态机
  3. 验证所有边界条件
- **验证**:
  - 至少6个异常路径测试场景全部通过
  - mock覆盖MarchingSystem.cancelMarch/createReturnMarch的完整状态机
  - 无竞态条件导致的间歇性失败

### Task 3: E1-3 行军系统端到端完整链路

- **来源**: PLAN.md E1-3 (MAP-F02b + MAP-F06)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/MarchingSystem.ts` — 行军创建/管理
  - `src/games/three-kingdoms/engine/map/PathfindingSystem.ts` — A*寻路
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — 精灵渲染
  - `src/components/idle/panels/map/WorldMapTab.tsx` — 事件粘合层
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/integration/march-e2e.integration.test.ts`
- **步骤**:
  1. 设计端到端测试场景（集成测试级别）：
     - 场景1: 创建行军 → PathfindingSystem计算路线 → 精灵数据生成 → 模拟帧推进 → 到达目标城 → 触发march:arrived事件 → 自动进入攻城流程
     - 场景2: 多城链式行军（A→B→C）验证路线连续性
     - 场景3: 行军途中目标城被其他玩家占领 → 行军取消或重定向
     - 场景4: 行军速度与距离/地形的关系验证
  2. 集成MarchingSystem + PathfindingSystem + EventBus，验证数据流一致性
  3. 验证行军精灵位置数据随时间推进与A*路径一致
  4. 验证march:arrived事件携带正确的siegeTaskId
- **验证**:
  - 端到端集成测试至少4个场景全部通过
  - 行军精灵位置与A*路径偏差 < 1像素（在测试精度内）
  - march:arrived事件100%触发，无遗漏
  - 数据一致性：编队兵力在行军前后不变（无战斗前伤亡）

### Task 4: E1-4 离线→上线→弹窗→领取→资源更新

- **来源**: PLAN.md E1-4 (MAP-F10~F12)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/OfflineRewardSystem.ts` 或相关离线系统
  - `src/components/idle/panels/map/` 离线奖励弹窗组件
  - `src/games/three-kingdoms/engine/map/ResourceSystem.ts` 或资源管理
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/integration/offline-e2e.integration.test.ts`
- **步骤**:
  1. 设计离线端到端测试场景：
     - 场景1: 正常离线奖励 — 离线8小时→上线→弹窗显示奖励→领取→资源增量正确
     - 场景2: 离线时间过短 — 离线5分钟→无弹窗或最低奖励
     - 场景3: 离线时间过长 — 离线72小时→奖励上限封顶
     - 场景4: 多资源类型 — 领土产出粮草/金币/元宝等多种资源分别计算
     - 场景5: 领土变化影响 — 离线期间领土被占→产出按实际占领时间计算
  2. 验证离线时长计算精度（秒级）
  3. 验证弹窗UI数据与实际奖励数据一致
  4. 验证领取后资源增量精确匹配
- **验证**:
  - 端到端集成测试至少5个场景全部通过
  - 离线时长计算误差 < 1秒
  - 资源增量精确到整数（无浮点误差）
  - 弹窗显示数据与后端计算数据完全一致

### Task 5: D3-1 像素地图渲染60fps无卡顿

- **来源**: PLAN.md D3-1
- **涉及文件**:
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — 渲染主循环
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/performance/render-perf.test.ts`
- **步骤**:
  1. 建立性能基准测试框架：
     - 使用 `performance.now()` 测量单帧渲染时间
     - 模拟100x60大地图 + 50个行军精灵 + 20个攻城特效场景
  2. 目标指标：
     - 单帧渲染时间 < 16.67ms (60fps)
     - P99帧时间 < 33ms (30fps最低线)
     - 无GC导致的帧时间突刺（连续10帧平均不超标）
  3. 优化方向（如不达标）：
     - 批量Canvas操作减少drawCall
     - 预渲染静态元素到离屏Canvas
     - 视口裁剪优化（已有D3-3，确认覆盖）
  4. 记录优化前后性能对比数据
- **验证**:
  - 性能基准测试在CI环境通过（允许10%容差）
  - 100x60地图 + 50精灵场景单帧 < 16.67ms
  - 无帧时间突刺超过33ms

### Task 6: D3-2 脏标记渲染(无变化时跳过)

- **来源**: PLAN.md D3-2
- **涉及文件**:
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — 渲染主循环
  - 新增: `src/components/idle/panels/map/__tests__/PixelWorldMap.dirty-flag.test.tsx`
- **步骤**:
  1. 设计脏标记渲染机制：
     - `isDirty` 标志：任何数据变化（城市状态、行军位置、攻城特效）时置脏
     - 渲染循环：`if (!isDirty) return; render(); isDirty = false;`
     - 细粒度脏标记（可选）：按区域/层级分离，仅重绘脏区域
  2. 实现脏标记追踪：
     - 城市状态变化 → 地图层脏
     - 行军精灵移动 → 精灵层脏
     - 攻城特效帧推进 → 特效层脏
  3. 编写测试验证：
     - 无变化时Canvas渲染调用次数为0
     - 单一变化仅触发对应层重绘
     - 变化后isDirty正确重置
  4. 性能对比：脏标记前后帧率提升比例
- **验证**:
  - 无变化场景：Canvas渲染调用次数 = 0
  - 有变化场景：仅脏区域对应API被调用
  - 集成到PixelWorldMap后全部已有测试通过
  - 帧率提升 >= 20%（静态场景下）

### Task 7: I3 攻城锁定机制

- **来源**: PLAN.md I3 (MAP-F06-05)，引擎部分有初步实现(⚠️)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts` — 攻城锁定逻辑
  - `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts` — 任务状态管理
  - `src/components/idle/panels/map/WorldMapTab.tsx` — UI层锁定状态显示
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/SiegeLock.test.ts`
- **步骤**:
  1. 完善攻城锁定引擎逻辑：
     - `lockCity(cityId, attackerId)` — 攻城开始时锁定城市
     - `isCityLocked(cityId)` — 检查城市是否被锁定
     - `unlockCity(cityId, attackerId)` — 攻城结束/取消时解锁
     - 锁定超时自动释放（默认30分钟）
  2. 并发攻城互斥验证：
     - 玩家A攻城 → 玩家B尝试攻同一城 → 被拒绝
     - 玩家A攻城取消 → 玩家B可立即攻城
     - 玩家A攻城超时 → 自动解锁 → 其他玩家可攻
  3. UI层锁定状态显示：
     - 被锁定城市在像素地图上显示锁定图标
     - 攻城确认弹窗检查锁定状态
  4. 编写单元测试和集成测试
- **验证**:
  - 攻城锁定引擎逻辑完整，无竞态条件
  - 并发攻城互斥测试全部通过
  - 锁定超时释放测试通过
  - UI层正确显示锁定状态

### Task 8: I10 攻占任务面板UI完善

- **来源**: PLAN.md I10 (MAP-F06-10)，R9已实现基础版
- **涉及文件**:
  - `src/components/idle/panels/map/SiegeTaskPanel.tsx` — 任务面板
  - `src/components/idle/panels/map/SiegeTaskPanel.test.tsx` — 现有测试
- **步骤**:
  1. 梳理R9已实现的SiegeTaskPanel功能：
     - 实时进度条 (defenseRatios驱动)
     - 回城ETA (returnETAs驱动)
     - 已完成折叠 (MAX_COMPLETED_TASKS=5)
     - 聚焦路线按钮
  2. 补充UI细节：
     - 任务创建时间显示
     - 编队摘要（将领名+兵力数）
     - 任务状态图标（行军中/攻城中/回城中/已完成/失败）
     - 空状态提示（无攻城任务时显示引导文案）
  3. 响应式适配（配合D2系列）
  4. 补充测试覆盖新增UI元素
- **验证**:
  - 攻占任务面板渲染正确，所有状态有对应图标
  - 空状态显示引导文案
  - 新增UI测试覆盖

### Task 9: I11 行军精灵显示与路线交互增强

- **来源**: PLAN.md I11 (MAP-F06-11)，R10已实现基础渲染
- **涉及文件**:
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — 精灵渲染+交互
  - `src/components/idle/panels/map/WorldMapTab.tsx` — 交互事件处理
  - 行军精灵相关测试文件
- **步骤**:
  1. 明确"路线交互"定义（消除R10 P1-3术语歧义）：
     - **路线高亮交互**: hover行军路线→高亮+显示信息tooltip
     - **路线数据交互**: 点击精灵→弹出编队详情/预计到达时间
     - **路线聚焦交互**: 已有聚焦路线功能（R9实现），验证完整性
  2. 实现hover交互：
     - 鼠标悬停行军路线 → 路线变亮+显示预计到达时间
     - 鼠标离开 → 恢复原样
  3. 实现点击交互：
     - 点击行军精灵 → 显示编队摘要弹窗（将领+兵力+预计到达）
     - 点击空白 → 关闭弹窗
  4. 编写交互测试
- **验证**:
  - hover交互：路线高亮+tooltip显示正确
  - 点击交互：编队信息弹窗内容正确
  - 交互不影响渲染性能（60fps维持）
  - PLAN.md中"路线交互"术语定义明确

### Task 10: H5 攻城结果弹窗显示伤亡详情增强

- **来源**: PLAN.md H5 (MAP-F06)，R9已实现基础版
- **涉及文件**:
  - `src/components/idle/panels/map/SiegeResultModal.tsx` — 结果弹窗
  - `src/components/idle/panels/map/SiegeResultModal.test.tsx` — 现有测试
- **步骤**:
  1. 梳理R9已实现的伤亡详情：
     - 5级结果等级badge (OUTCOME_CONFIG)
     - 伤亡健康色条 (getCasualtyHealthColor)
     - 将领恢复时间
     - 奖励倍率标签
  2. 补充增强内容：
     - 将领受伤状态图标（轻伤/中伤/重伤+颜色编码）
     - 将领恢复倒计时（实时更新）
     - 伤亡对比柱状图（我方vs敌方）
     - 历史战绩回查入口
  3. 补充测试覆盖增强功能
- **验证**:
  - 将领受伤状态显示正确（3种级别+颜色）
  - 恢复倒计时实时更新（每秒刷新）
  - 新增测试全部通过
  - 向后兼容：无伤亡时不显示伤亡区域

---

## R10遗留问题追踪

| ID | 问题 | 优先级 | 本轮处理 |
|----|------|:------:|---------|
| R11-1 | 行军精灵smoke tests功能断言补充 | P1 | Task 1 |
| R11-2 | return march异常路径测试 | P2 | Task 2 |
| R11-3 | H7测试计数精确性 | P2 | 不单独处理，在Task 2中顺带标注 |
| R11-4 | "路线交互"术语定义 | P2 | Task 9步骤1 |
| R11-5 | 双路径结算架构统一 | P2 | DEFERRED至R12（本轮聚焦功能推进） |
| R11-6 | PathfindingSystem TS错误 | P3 | Pre-existing，本轮不处理 |
| R11-7 | PLAN.md剩余功能项 | P2 | Task 3-10覆盖E1-3/E1-4/D3-1/D3-2/I3/I10/I11/H5 |

## 跨轮趋势参考（R7-R10）

| 指标 | R7 | R8 | R9 | R10 | R11目标 |
|------|:--:|:--:|:--:|:---:|:-------:|
| 对抗性发现 | 9 | 8 | 8 | 6 | <= 6 |
| P0问题 | 2 | 0 | 1→0 | 0 | 0 |
| P1问题 | 3→0 | 2→0 | 3→0 | 2→0 | 0 |
| 内部循环次数 | 2 | 1 | 2 | 1 | <= 2 |
| PLAN.md完成率 | 62% | 68% | 74% | ~80% | >= 88% |
| 测试总数 | ~200 | ~210 | 223 | ~250 | ~280+ |

## 改进措施（来自R9复盘）

| ID | 措施 | 本轮执行 |
|----|------|---------|
| IMP-01 | Builder交付门禁：报告全部已有测试套件结果 | 所有Task验证步骤已包含 |
| IMP-02 | TypeScript门禁：每Task完成后运行`tsc --noEmit` | 所有Task验证步骤已包含 |
| IMP-03 | 高亮行军路线E2E集成测试 | 已在R9/R10完成基础版，Task 9增强 |
| IMP-04 | 双路径结算架构统一 | DEFERRED至R12 |

---

## 预期PLAN.md更新

| ID | 当前状态 | 预期状态 |
|----|---------|---------|
| D3-1 | 🔄 | ✅ |
| D3-2 | 🔄 | ✅ |
| E1-3 | ⬜ | ✅ |
| E1-4 | ⬜ | ✅ |
| I3 | ⬜ | ✅ (引擎+UI) |
| I10 | ⬜ | ✅ (UI完善) |
| I11 | ⬜ | ✅ (增强) |
| H5 | ⬜ | ✅ (增强) |

预期完成率: 44+8 = 52/65 = **80% → ~92%** (如全部完成)

---

*Round 11 迭代计划 | 2026-05-04*
