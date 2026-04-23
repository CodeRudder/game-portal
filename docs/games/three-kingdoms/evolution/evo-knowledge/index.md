# 进化知识库索引

> **用途**: 积累的进化知识，持续增长，不归档。
> **与 review-rules 的关系**: review-rules 是操作性检查清单，evo-knowledge 是知识来源。
> **编号格式**: EVO-{TYPE}-{SEQ}
> **入口**: [进化规则](../../process/evolution-rules.md) | [导航索引](../INDEX.md)

---

## 知识分类

| 类别 | 文件 | 前缀 | 数量 |
|------|------|------|------|
| 流程方法论 | [evo-proc.md](./evo-proc.md) | EVO-PROC | 13 |
| 架构实践 | [evo-arch.md](./evo-arch.md) | EVO-ARCH | 9 |
| 代码质量 | [evo-code.md](./evo-code.md) | EVO-CODE | 11 |
| UI实践 | [evo-ui.md](./evo-ui.md) | EVO-UI | 4 |
| 游戏基础设施 | [evo-infra.md](./evo-infra.md) | EVO-INFRA | 3 |
| **合计** | | | **40** |

---

## EVO 规则快速索引

| 编号 | 标题 | 对应 review-rule |
|------|------|-----------------|
| **EVO-PROC (流程方法论)** | | |
| EVO-PROC-001 | 技术审查先行 | — |
| EVO-PROC-002 | 测试基础设施优先 | — |
| EVO-PROC-003 | 子任务粒度控制 | CQ-06 |
| EVO-PROC-004 | 测试工具预验证 | — |
| EVO-PROC-005 | 截图+人工确认 | UI-05 |
| EVO-PROC-006 | UI测试警告分类 | — |
| EVO-PROC-007 | 搜索后DOM刷新 | — |
| EVO-PROC-008 | 不能跳过迭代流程 | — |
| EVO-PROC-009 | 引导测试状态注入 | — |
| EVO-PROC-010 | 引擎API冒烟测试 | BLD-05 |
| EVO-PROC-011 | 条件性UI测试策略 | — |
| EVO-PROC-012 | 每版本4步流水线 | — |
| EVO-PROC-013 | 测试修复批量策略 | — |
| **EVO-ARCH (架构实践)** | | |
| EVO-ARCH-001 | 新增即导出 | ARCH-05 |
| EVO-ARCH-002 | 门面违规检测 | ARCH-03 |
| EVO-ARCH-003 | Mixin模式 | ARCH-09 |
| EVO-ARCH-004 | ISubsystem同步实现 | ARCH-04 |
| EVO-ARCH-005 | 子系统接入检查清单 | ARCH-07 |
| EVO-ARCH-006 | 复杂域四层拆分 | ARCH-06 |
| EVO-ARCH-007 | 域内命名统一 | ARCH-08 |
| EVO-ARCH-008 | core层聚合导出 | ARCH-10 |
| EVO-ARCH-009 | 子系统重叠迁移策略 | — |
| **EVO-CODE (代码质量)** | | |
| EVO-CODE-001 | 提取即删除 | CQ-01 |
| EVO-CODE-002 | 废弃清理 | CQ-03, CQ-04 |
| EVO-CODE-003 | 文件行数预警 | ARCH-01 |
| EVO-CODE-004 | data-testid强制 | UI-01 |
| EVO-CODE-005 | 截图辅助测试 | UI-05 |
| EVO-CODE-006 | 合并冲突CI检测 | BLD-04 |
| EVO-CODE-007 | 性能监控先行 | — |
| EVO-CODE-008 | 交互规范代码化 | — |
| EVO-CODE-009 | as any 零容忍 | CQ-02 |
| EVO-CODE-010 | 模块命名一致性 | — |
| EVO-CODE-011 | 函数签名冲突检测 | CQ-07 |
| **EVO-UI (UI实践)** | | |
| EVO-UI-001 | 弹窗独立 | UI-02, UI-03 |
| EVO-UI-002 | 选择器先探后测 | UI-04 |
| EVO-UI-003 | CSS拆分最小成本 | — |
| EVO-UI-004 | data-testid覆盖率 | UI-01 |
| **EVO-INFRA (游戏基础设施)** | | |
| EVO-INFRA-001 | 不必要动画效果 | — |
| EVO-INFRA-002 | 收官版本全链路验证 | — |
| EVO-INFRA-003 | GameEventSimulator | — |

---

*文档版本: v4.0 | 更新日期: 2026-04-23 | 合并重复项，54→41条*
