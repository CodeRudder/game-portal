# Round 23 问题清单

> **日期**: 2026-05-05
> **来源**: 对抗性评测 (Builder + Challenger CA-01~17 + Judge 裁决)
> **P0/P1 规则**: 正常情况下在本轮修复，每修复一个即时更新状态为 ✅；如传递下轮需标注原因
> **P2/P3 规则**: 可传递下轮，必须有最终状态 (✅/➡️)

## 问题列表
| ID | 严重度 | 类型 | 来源 | 描述 | 文件 | 状态 | 传递去向 |
|----|:------:|------|------|------|------|:----:|---------|
| I-01 | P0 | 功能 | CA-01/10 | handleCancelled中marching→completed状态转换无效，siege lock永不释放(生产bug) | SiegeTaskManager.ts, WorldMapTab.tsx | ✅ | 本轮修复: 新增cancelTask()方法，handleCancelled改用cancelTask |
| I-02 | P0 | 功能 | CA-10 | cancelSiege不释放siege lock，取消行军后5分钟内同目标无法再次攻占 | SiegeTaskManager.ts | ✅ | 本轮修复: 与I-01同根源，cancelTask内释放lock |
| I-03 | P1 | 功能 | CA-12 | handleSiegeConfirm中ETA硬编码为10秒，进度条与实际行军时间不匹配 | WorldMapTab.tsx:1194 | ✅ | 本轮修复: 改用generatePreview()返回的estimatedTime |
| I-04 | P1 | 数据 | CA-15 | SiegeTaskManager.deserialize不恢复siege lock，恢复后可重复创建攻占任务 | SiegeTaskManager.ts | ✅ | 本轮修复: deserialize中遍历tasks为非终态任务重建siegeLocks |
| I-05 | P1 | 集成 | CA-09 | handleArrived中setTimeout(0)竞态防护不足(仅检查result未检查status) | WorldMapTab.tsx:510 | ✅ | 本轮修复: 守卫增加status!==marching检查 |
| I-06 | P1 | 功能 | CA-03 | 行军时长clamp仅影响ETA显示，不影响实际行军速度(speed=BASE_SPEED固定) | MarchingSystem.ts:245 | ➡️ | → PROGRESS.md #11 | 需设计决策: speed=distance/estimatedTime |
| I-07 | P1 | 功能 | CA-04 | 回城路线不可达时部队凭空消失，无任何视觉反馈 | WorldMapTab.tsx:652 | ➡️ | → PROGRESS.md #13 | 降级P1→P2: 功能不崩溃但UX缺陷 |
| I-08 | P2 | 功能 | CA-02/17 | dist<2阈值在网格坐标(间距=1)下总为true，精灵逐格跳跃非平滑移动 | MarchingSystem.ts:466 | ➡️ | → PROGRESS.md #12 |
| I-09 | P2 | 功能 | CA-13 | 回城行军状态为marching非retreating，外观与出发精灵相同无法区分 | MarchingSystem.ts, PixelWorldMap.tsx | ➡️ | → PROGRESS.md #14 |
| I-10 | P2 | 测试 | CA-05 | march-e2e-full-chain使用空对象as any而非真实config/registry依赖 | march-e2e-full-chain.integration.test.ts | ➡️ | → PROGRESS.md #15 |
| I-11 | P2 | 测试 | CA-06 | march-to-siege-chain使用vi.spyOn mock了calculateMarchRoute，回城寻路未真实验证 | march-to-siege-chain.integration.test.ts | ➡️ | → PROGRESS.md #15 |
| I-12 | P2 | 测试 | CA-07 | PixelWorldMapMarchSprites完全mock Canvas，无真实渲染验证 | PixelWorldMapMarchSprites.test.tsx | ➡️ | → PROGRESS.md #15 |
| I-13 | P2 | 测试 | CA-08 | marching-full-flow是伪集成测试(手工构造对象，无系统交互) | marching-full-flow.integration.test.ts | ➡️ | → PROGRESS.md #15 |
| I-14 | P2 | 集成 | CA-11 | createMarch失败时siege lock泄漏(task已创建但march未启动) | WorldMapTab.tsx | ➡️ | → PROGRESS.md #16 |
| I-15 | P2 | 集成 | CA-14 | march:arrived→sieging非原子操作，并发场景下状态可能不一致 | WorldMapTab.tsx:520 | ➡️ | → PROGRESS.md #17 |
| I-16 | P2 | 数据 | CA-16 | siegeTaskId通过外部赋值(march.siegeTaskId=task.id)而非createMarch参数 | WorldMapTab.tsx:1188 | ➡️ | → PROGRESS.md #18 |
| I-17 | P2 | 功能 | Builder | P6-6 屏幕边缘指示器完全未实现(无边缘箭头+距离指示器) | 无相关代码 | ➡️ | → PROGRESS.md #9 |
| I-18 | P2 | 功能 | Builder | P6-12 恢复超时处理未实现(无30s移动/10sPC超时检测和撤退逻辑) | 无相关代码 | ➡️ | → PROGRESS.md #10 |
| I-19 | P2 | 功能 | Builder | P6-7 地形修正常量已定义(ROAD/MOUNTAIN_SPEED_MULTIPLIER)但未在update中应用 | MarchingSystem.ts:149-155,458-479 | ➡️ | → PROGRESS.md #19 |

## 统计
- P0: 2 (修复: 2, 传递: 0)
- P1: 5 (修复: 3, 传递: 2 — I-06需设计决策, I-07降级为P2)
- P2: 12 (修复: 0, 传递: 12)
- P3: 0

## 修复记录

| 修复ID | 对应问题 | 修复内容 | 新增测试 | 验证结果 |
|--------|---------|---------|:-------:|---------|
| F-01 | I-01/I-02 | SiegeTaskManager新增cancelTask()方法: 从任意活跃状态终止+释放lock+emit事件 | 6单元+2集成 | 51/51 PASS |
| F-02 | I-01 | WorldMapTab.handleCancelled改用cancelTask()替代advanceStatus | — | 逻辑验证 |
| F-03 | I-03 | handleSiegeConfirm中ETA改用generatePreview().estimatedTime替代硬编码10秒 | 1(更新mock) | 41/41 PASS |
| F-04 | I-04 | deserialize中遍历tasks为非终态任务重建siegeLocks | 2(更新lock测试) | 13/13 PASS |
| F-05 | I-05 | handleArrived守卫增加currentTask.status!=='marching'检查 | — | 逻辑验证 |

## 传递校验
- [x] P0 全部为 ✅ (2/2 已修复)
- [x] P1 修复 3/5，传递 2 个 (I-06需设计决策, I-07降级P2)
- [x] 所有 ➡️ 传递的问题已写入 report.md "剩余问题(下轮)" Section 6
- [x] 所有 ➡️ 传递的问题已同步到 PROGRESS.md "P2 问题积压追踪" R23遗留
- [x] 传递问题已写入 R24 plan.md "传递问题" Section
- [x] 修复后多维度评测通过: 437 tests, 0 failures, 0 regressions

---
*Round 23 问题清单 | 2026-05-05 | P0全部修复, P1修复3/5*
