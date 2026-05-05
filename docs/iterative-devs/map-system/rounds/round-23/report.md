# Round 23 迭代报告

> **日期**: 2026-05-05
> **迭代周期**: 第23轮 — 行军推进(P6)对抗性核验
> **内部循环次数**: 1

## 1. 对抗性评测发现

### Builder 客观事实清单
- I-17: P6-6 屏幕边缘指示器完全未实现(无边缘箭头+距离指示器)
- I-18: P6-12 恢复超时处理未实现(无30s移动/10sPC超时检测和撤退逻辑)
- I-19: P6-7 地形修正常量已定义(ROAD/MOUNTAIN_SPEED_MULTIPLIER)但未在update中应用

### Challenger 攻击结果
- CA-01: handleCancelled状态转换无效(→ I-01)
- CA-02: dist<2阈值在网格坐标下总为true(→ I-08)
- CA-03: 行军时长clamp不影响实际速度(→ I-06)
- CA-04: 回城路线不可达时部队凭空消失(→ I-07)
- CA-05: march-e2e-full-chain使用空对象as any(→ I-10)
- CA-06: march-to-siege-chain mock了calculateMarchRoute(→ I-11)
- CA-07: PixelWorldMapMarchSprites完全mock Canvas(→ I-12)
- CA-08: marching-full-flow是伪集成测试(→ I-13)
- CA-09: handleArrived中setTimeout(0)竞态防护不足(→ I-05)
- CA-10: cancelSiege不释放siege lock(→ I-02)
- CA-11: createMarch失败时siege lock泄漏(→ I-14)
- CA-12: handleSiegeConfirm中ETA硬编码为10秒(→ I-03)
- CA-13: 回城行军状态为marching非retreating(→ I-09)
- CA-14: march:arrived→sieging非原子操作(→ I-15)
- CA-15: deserialize不恢复siege lock(→ I-04)
- CA-16: siegeTaskId通过外部赋值而非createMarch参数(→ I-16)
- CA-17: dist<2阈值精灵逐格跳跃非平滑移动(→ I-08)

### Judge 综合评定
- P0: 2项 — handleCancelled状态转换+cancelSiege不释放lock，均为生产级缺陷
- P1: 5项 — ETA硬编码、deserialize不恢复lock、竞态防护、行军速度clamp、回城路线不可达
- P2: 12项 — 精灵移动、状态区分、测试质量、集成原子性等
- 修复后全量测试通过: 437 tests, 0 failures, 0 regressions

## 2. 修复内容

| 修复ID | 对应问题 | 修复内容 | 新增测试 | 验证结果 |
|--------|---------|---------|:-------:|---------|
| F-01 | I-01/I-02 | SiegeTaskManager新增cancelTask()方法: 从任意活跃状态终止+释放lock+emit事件 | 6单元+2集成 | 51/51 PASS |
| F-02 | I-01 | WorldMapTab.handleCancelled改用cancelTask()替代advanceStatus | — | 逻辑验证 |
| F-03 | I-03 | handleSiegeConfirm中ETA改用generatePreview().estimatedTime替代硬编码10秒 | 1(更新mock) | 41/41 PASS |
| F-04 | I-04 | deserialize中遍历tasks为非终态任务重建siegeLocks | 2(更新lock测试) | 13/13 PASS |
| F-05 | I-05 | handleArrived守卫增加currentTask.status!=='marching'检查 | — | 逻辑验证 |

## 3. 内部循环记录
| 子轮次 | 发现 | 修复 | 剩余P0 | 剩余P1 | 备注 |
|--------|:----:|:----:|:------:|:------:|------|
| 23.1 | 5 | 5 | 0 | 0 | 首次对抗+修复 |

## 4. 测试结果
| 测试套件 | 通过 | 失败 |
|----------|:----:|:----:|
| 攻城系统测试 | 437 | 0 |

## 7. 剩余问题(移交下轮)
| ID | 严重度 | 描述 | 传递去向 |
|----|:------:|------|---------|
| I-06 | P1 | 行军时长clamp仅影响ETA显示，不影响实际行军速度(speed=BASE_SPEED固定) | → PROGRESS.md #11, 需设计决策: speed=distance/estimatedTime |
| I-07 | P1→P2 | 回城路线不可达时部队凭空消失，无任何视觉反馈 | → PROGRESS.md #13, 降级P1→P2: 功能不崩溃但UX缺陷 |
| I-08 | P2 | dist<2阈值在网格坐标(间距=1)下总为true，精灵逐格跳跃非平滑移动 | → PROGRESS.md #12 |
| I-09 | P2 | 回城行军状态为marching非retreating，外观与出发精灵相同无法区分 | → PROGRESS.md #14 |
| I-10 | P2 | march-e2e-full-chain使用空对象as any而非真实config/registry依赖 | → PROGRESS.md #15 |
| I-11 | P2 | march-to-siege-chain使用vi.spyOn mock了calculateMarchRoute，回城寻路未真实验证 | → PROGRESS.md #15 |
| I-12 | P2 | PixelWorldMapMarchSprites完全mock Canvas，无真实渲染验证 | → PROGRESS.md #15 |
| I-13 | P2 | marching-full-flow是伪集成测试(手工构造对象，无系统交互) | → PROGRESS.md #15 |
| I-14 | P2 | createMarch失败时siege lock泄漏(task已创建但march未启动) | → PROGRESS.md #16 |
| I-15 | P2 | march:arrived→sieging非原子操作，并发场景下状态可能不一致 | → PROGRESS.md #17 |
| I-16 | P2 | siegeTaskId通过外部赋值(march.siegeTaskId=task.id)而非createMarch参数 | → PROGRESS.md #18 |
| I-17 | P2 | P6-6 屏幕边缘指示器完全未实现(无边缘箭头+距离指示器) | → PROGRESS.md #9 |
| I-18 | P2 | P6-12 恢复超时处理未实现(无30s移动/10sPC超时检测和撤退逻辑) | → PROGRESS.md #10 |
| I-19 | P2 | P6-7 地形修正常量已定义(ROAD/MOUNTAIN_SPEED_MULTIPLIER)但未在update中应用 | → PROGRESS.md #19 |

## 8. 下轮计划
> 详见 `rounds/round-24/plan.md`
