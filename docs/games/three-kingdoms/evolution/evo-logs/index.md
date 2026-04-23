# 进化迭代日志（索引）

> 索引文件，每轮一行。详细记录见 `progress/evolution-record-{round}.md`。
> 流程规则: [evolution-rules.md](../../process/evolution-rules.md) | 进化计划: [evo-plans/index.md](../evo-plans/index.md) | 检查规则: [review-rules/index.md](../review-rules/index.md)

---

## 旧格式轮次（v5.0规则之前）

> 详细记录见各 `evolution-r{N}.md`。

| Round | 版本 | 关键成果 | 详细记录 |
|-------|------|---------|---------|
| R1 | v1.0 | 测试基础设施+技术审查，EVO-001~005 | [evolution-r1.md](./evolution-r1.md) |
| R2 | v2.0 | 新增即导出+先探后测，EVO-006~007 | [evolution-r2.md](./evolution-r2.md) |
| R3 | v1.0 | 大文件拆分+data-testid，EVO-011~015 | [evolution-r3.md](./evolution-r3.md) |
| R4 | v4.0 | ISubsystem同步+复杂域拆分，EVO-024~028 | [evolution-r4.md](./evolution-r4.md) |
| R5 | v3.0 | 技术审查修复+30/30 UI通过 | [evolution-r5.md](./evolution-r5.md) |
| R6 | v5.0 | 零缺陷+62/62 UI+EVO-053~055 | [evolution-r6.md](./evolution-r6.md) |
| R7 | v6.0 | P0修复+26/26 UI | [evolution-r7.md](./evolution-r7.md) |
| R8 | v8.0 | 商贸/离线评测 | [evolution-r8.md](./evolution-r8.md) |
| R9 | v9.0 | 科技/策略评测 | [evolution-r9.md](./evolution-r9.md) |
| R10 | v2.0 | 引导overlay障碍，CSS选择器策略 | [evolution-r10.md](./evolution-r10.md) |
| R11 | 全局 | 20版本完成+GES创建+EVO-049~052 | [evolution-r11.md](./evolution-r11.md) |
| R17 | v17.0 | 移动端适配375-768px | [evolution-r17.md](./evolution-r17.md) |
| R18 | v18.0 | 新手引导+EVO-036~038 | [evolution-r18.md](./evolution-r18.md) |
| R19 | v19.0 | 合并冲突+重叠治理+23/23 UI | [evolution-r19.md](./evolution-r19.md) |
| R20 | v20.0 | 全链路+数值5维+项目收官 | [evolution-r20.md](./evolution-r20.md) |

---

## 新格式轮次（v5.0规则起）

| Round | 版本 | 日期 | P0/P1/P2 | 修复率 | 耗时 | 关键改进 | 详细记录 |
|-------|------|------|----------|--------|------|---------|---------|
| — | — | — | — | — | — | *等待新一轮* | — |

### R21

| Round | 版本 | 日期 | P0/P1/P2 | 修复率 | 耗时 | 关键改进 | 详细记录 |
|-------|------|------|----------|--------|------|---------|---------|
| R21 | v1.0(第二轮) | 2026-04-23 | 0/3→0/3P2 | P1全部关闭 | ~2h | 遗留P1清零+双指标覆盖率+EVO-059~062 | [r21-phase1-preparation.md](../progress/r21-phase1-preparation.md) |
| R21 | v1.0基业初立 | 2026-04-23 | 2P0→0/8P1/7P2 | P0=100% | ~2h | 6阶段全流程+59/60架构+EVO-063~068 | [evolution-r21.md](./evolution-r21.md) |

---

## 方向进展

| 方向 | 状态 | 下一步 |
|------|------|--------|
| 1. 评测工具 | 🟡 | [GES v2方案](../evo-plans/game-event-simulator-v2.md) |
| 2. 架构审查 | ✅ | 维持，R21-v1.0 59/60优秀 |
| 3. 基础设施 | ✅ | 引擎API健壮性 |
| 4. PRD/UI/PLAY | 🟡 | R21发现5处数值不一致，需建立权威源机制 |
| 5. 启发式 | 🟡 | 验证H-1~H-7 |
| 6. 数值平衡 | 🟡 | R21核心资源链路已验证，v2.0统一数值权威源 |
| 7. 性能 | ⚪ | — |
| 8. 回归防护 | 🟡 | 截图基线 |
| 9. 可访问性 | ⚪ | — |

---

*索引版本: v2.2 | 更新日期: 2026-04-23 | R21-v1.0基业初立封版通过，EVO-063~068新增*
