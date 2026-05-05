# Round 22 迭代报告

> **日期**: 2026-05-05
> **迭代周期**: 第22轮 — 攻占准备(P1~P5)对抗性核验
> **内部循环次数**: 1

## 1. 对抗性评测发现

### Builder 客观事实清单
- P5-6 过渡动画缺失：无Toast、无精灵高亮、无弹窗关闭动画 (I-14)
- P3-4 战力预览无将领技能加成：calculateEffectivePower仅为Facade (I-15)
- P2-8 多条失败推荐无排序逻辑：条件列表固定顺序展示 (I-16)
- P5-1 任务创建原子性不足：资源扣减与任务创建非原子 (I-17)

### Challenger 攻击结果
| 编号 | 发现 |
|------|------|
| ATT-01 | SiegeSystem.checkSiegeConditions缺少并发上限检查(最多3个) (I-03) |
| ATT-02 | cancelSiege注释声称释放锁但代码未实现，仅5分钟超时兜底 (I-06) |
| ATT-03 | 内应信暴露冷却态零测试覆盖 (I-04) |
| ATT-04 | CooldownManager孤立，SiegeSystem自管理冷却 (I-07) |
| ATT-06/08 | configRegistry vs config命名不匹配(as any绕过类型检查) (I-08) |
| ATT-07 | SiegeConfirmModal确认按钮零测试覆盖，fireEvent.click仅1处(取消按钮) (I-01) |
| ATT-10 | handleSiegeConfirm(100行核心函数)零测试覆盖 (I-05) |
| ATT-11 | ui-interaction.integration.test标题误导，仅为ExpeditionForcePanel单元测试 (I-09) |
| ATT-12 | SiegeSystem→SiegeTaskManager校验一致性依赖时间窗口 (I-10) |
| ATT-13 | 编队兵力三来源(expeditionSelection/deployTroops/costEstimate)可能不一致 (I-11) |
| ATT-14 | 每日次数重置依赖update()调用频率，挂机跨天有边界风险 (I-12) |
| ATT-15 | createMarch失败异常路径无清理，task已创建但march未创建 (I-13) |
| ATT-18 | deductSiegeResources try-catch静默吞异常，扣费失败任务继续执行 (I-02) |

### Judge 综合评定
- 共发现17个问题：P0x2, P1x3, P2x12
- P0/P1共5个全部在本轮修复完毕
- P2共12个全部传递至PROGRESS.md积压追踪
- 修复后全量测试365+ tests, 0 failures, 0 regressions

## 2. 修复内容

| 修复ID | 对应问题 | 修复内容 | 新增测试 | 验证结果 |
|--------|---------|---------|:-------:|---------|
| F-01 | I-01 | 新增8个确认按钮点击测试(条件通过/失败/无编队等场景) | 8 | 24/24 PASS |
| F-02 | I-02 | deductSiegeResources返回boolean+失败时emit siege:resourceError+SiegeResult.resourceDeductionFailed标记 | — | 70/70 PASS |
| F-03 | I-03 | 新增CONCURRENT_LIMIT_REACHED错误码+MAX_CONCURRENT_SIEGES=3常量+siegeTaskManager私有getter | 4 | 44/44 PASS |
| F-04 | I-04 | 新增13个内应暴露冷却测试(三态/过期/独立/序列化/剩余时间) | 13 | 57/57 PASS |
| F-05 | I-05 | 新增7个handleSiegeConfirm测试(成功/无引擎/无源城市/路线空/锁占用/UI重置/回退源) | 7 | 41/41 PASS |

## 3. 内部循环记录
| 子轮次 | 发现 | 修复 | 剩余P0 | 剩余P1 | 备注 |
|--------|:----:|:----:|:------:|:------:|------|
| 22.1 | 5 | 5 | 0 | 0 | 首次对抗+修复 |

## 4. 测试结果
| 测试套件 | 通过 | 失败 |
|----------|:----:|:----:|
| 攻城系统测试 | 365+ | 0 |

## 5. 架构审查结果
- deductSiegeResources异常处理改为返回boolean + emit事件，修复静默吞异常问题
- 并发上限通过MAX_CONCURRENT_SIEGES=3常量控制，新增CONCURRENT_LIMIT_REACHED错误码
- 内应暴露冷却测试覆盖三态/过期/独立/序列化/剩余时间场景
- P2级架构问题(CooldownManager孤立、configRegistry命名不匹配、校验时间窗口依赖)传递下轮处理

## 7. 剩余问题(移交下轮)
| ID | 描述 | 传递去向 |
|----|------|---------|
| I-06 | cancelSiege注释声称释放锁但代码未实现，5分钟超时兜底 | → PROGRESS.md #4 |
| I-07 | CooldownManager孤立，SiegeSystem自管理冷却 | → PROGRESS.md #7 |
| I-08 | configRegistry vs config命名不匹配(as any绕过类型检查) | → PROGRESS.md #5 |
| I-09 | ui-interaction.integration.test标题误导，仅为ExpeditionForcePanel单元测试 | → PROGRESS.md #15 |
| I-10 | SiegeSystem→SiegeTaskManager校验一致性依赖时间窗口 | → PROGRESS.md (合并#8) |
| I-11 | 编队兵力三来源(expeditionSelection/deployTroops/costEstimate)可能不一致 | → PROGRESS.md #8 |
| I-12 | 每日次数重置依赖update()调用频率，挂机跨天有边界风险 | → PROGRESS.md (新增) |
| I-13 | createMarch失败异常路径无清理，task已创建但march未创建 | → PROGRESS.md #6 |
| I-14 | P5-6 过渡动画缺失(无Toast/无精灵高亮/无弹窗关闭动画) | → PROGRESS.md #1 |
| I-15 | P3-4 战力预览无将领技能加成(calculateEffectivePower仅为Facade) | → PROGRESS.md #2 |
| I-16 | P2-8 多条失败推荐无排序逻辑(条件列表固定顺序展示) | → PROGRESS.md #3 |
| I-17 | P5-1 任务创建原子性不足(资源扣减与任务创建非原子) | → PROGRESS.md (合并ATT-18修复后降级) |

## 8. 下轮计划
> 详见 `rounds/round-23/plan.md`
