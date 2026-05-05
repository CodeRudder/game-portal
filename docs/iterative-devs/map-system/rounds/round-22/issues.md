# Round 22 问题清单

> **日期**: 2026-05-05
> **来源**: 对抗性评测 (Builder + Challenger ATT-01~19 + Judge 裁决)
> **P0/P1 规则**: 正常情况下在本轮修复，每修复一个即时更新状态为 ✅；如传递下轮需标注原因
> **P2/P3 规则**: 可传递下轮，必须有最终状态 (✅/➡️)

## 问题列表
| ID | 严重度 | 类型 | 来源 | 描述 | 文件 | 状态 | 传递去向 |
|----|:------:|------|------|------|------|:----:|---------|
| I-01 | P0 | 功能 | ATT-07 | SiegeConfirmModal确认按钮零测试覆盖，fireEvent.click仅1处(取消按钮) | SiegeConfirmModal.test.tsx | ✅ | 本轮修复: 新增8个确认按钮点击测试 |
| I-02 | P0 | 功能 | ATT-18 | deductSiegeResources try-catch静默吞异常，扣费失败任务继续执行 | SiegeSystem.ts | ✅ | 本轮修复: 返回boolean+emit siege:resourceError+resourceDeductionFailed标记 |
| I-03 | P1 | 功能 | ATT-01 | SiegeSystem.checkSiegeConditions缺少并发上限检查(CR-02: 最多3个) | SiegeSystem.ts | ✅ | 本轮修复: 新增CONCURRENT_LIMIT_REACHED+MAX_CONCURRENT_SIEGES=3 |
| I-04 | P1 | 测试 | ATT-03 | 内应信暴露冷却态零测试覆盖(InsiderLetterSystem.test.ts无exposed测试) | SiegeSystem.test.ts | ✅ | 本轮修复: 新增13个暴露冷却状态测试 |
| I-05 | P1 | 测试 | ATT-10 | handleSiegeConfirm(100行核心函数)零测试覆盖 | WorldMapTab.test.tsx | ✅ | 本轮修复: 新增7个核心路径测试 |
| I-06 | P2 | 功能 | ATT-02 | cancelSiege注释声称释放锁但代码未实现，5分钟超时兜底 | SiegeTaskManager.ts | ➡️ | → PROGRESS.md #4 |
| I-07 | P2 | 架构 | ATT-04 | CooldownManager孤立，SiegeSystem自管理冷却 | CooldownManager.ts | ➡️ | → PROGRESS.md #7 |
| I-08 | P2 | 架构 | ATT-06/08 | configRegistry vs config命名不匹配(as any绕过类型检查) | SiegeStrategy.test.ts, InsiderLetterSystem.test.ts | ➡️ | → PROGRESS.md #5 |
| I-09 | P2 | 功能 | ATT-11 | ui-interaction.integration.test标题误导，仅为ExpeditionForcePanel单元测试 | ui-interaction.integration.test.tsx | ➡️ | → PROGRESS.md #15 |
| I-10 | P2 | 架构 | ATT-12 | SiegeSystem→SiegeTaskManager校验一致性依赖时间窗口 | SiegeSystem.ts, WorldMapTab.tsx | ➡️ | → PROGRESS.md (合并#8) |
| I-11 | P2 | 数据 | ATT-13 | 编队兵力三来源(expeditionSelection/deployTroops/costEstimate)可能不一致 | WorldMapTab.tsx | ➡️ | → PROGRESS.md #8 |
| I-12 | P2 | 功能 | ATT-14 | 每日次数重置依赖update()调用频率，挂机跨天有边界风险 | SiegeSystem.ts | ➡️ | → PROGRESS.md (新增) |
| I-13 | P2 | 功能 | ATT-15 | createMarch失败异常路径无清理，task已创建但march未创建 | WorldMapTab.tsx | ➡️ | → PROGRESS.md #6 |
| I-14 | P2 | 功能 | Builder | P5-6 过渡动画缺失(无Toast/无精灵高亮/无弹窗关闭动画) | WorldMapTab.tsx | ➡️ | → PROGRESS.md #1 |
| I-15 | P2 | 功能 | Builder | P3-4 战力预览无将领技能加成(calculateEffectivePower仅为Facade) | ExpeditionSystem.ts | ➡️ | → PROGRESS.md #2 |
| I-16 | P2 | 功能 | Builder | P2-8 多条失败推荐无排序逻辑(条件列表固定顺序展示) | SiegeConfirmModal.tsx | ➡️ | → PROGRESS.md #3 |
| I-17 | P2 | 功能 | Builder | P5-1 任务创建原子性不足(资源扣减与任务创建非原子) | SiegeSystem.ts | ➡️ | → PROGRESS.md (合并ATT-18修复后降级) |

## 统计
- P0: 2 (修复: 2, 传递: 0)
- P1: 3 (修复: 3, 传递: 0)
- P2: 12 (修复: 0, 传递: 12)
- P3: 0

## 修复记录

| 修复ID | 对应问题 | 修复内容 | 新增测试 | 验证结果 |
|--------|---------|---------|:-------:|---------|
| F-01 | I-01 | 新增8个确认按钮点击测试(条件通过/失败/无编队等场景) | 8 | 24/24 PASS |
| F-02 | I-02 | deductSiegeResources返回boolean+失败时emit siege:resourceError+SiegeResult.resourceDeductionFailed标记 | — | 70/70 PASS |
| F-03 | I-03 | 新增CONCURRENT_LIMIT_REACHED错误码+MAX_CONCURRENT_SIEGES=3常量+siegeTaskManager私有getter | 4 | 44/44 PASS |
| F-04 | I-04 | 新增13个内应暴露冷却测试(三态/过期/独立/序列化/剩余时间) | 13 | 57/57 PASS |
| F-05 | I-05 | 新增7个handleSiegeConfirm测试(成功/无引擎/无源城市/路线空/锁占用/UI重置/回退源) | 7 | 41/41 PASS |

## 传递校验
- [x] P0/P1 全部为 ✅ (5/5 已修复)
- [x] 所有 ➡️ 传递的问题已写入 report.md "剩余问题(下轮)" Section 7
- [x] 所有 ➡️ 传递的问题已同步到 PROGRESS.md "P2 问题积压追踪" R22遗留
- [x] 修复后多维度评测通过: 365+ tests, 0 failures, 0 regressions

---
*Round 22 问题清单 | 2026-05-05 | 全部P0/P1已修复*
