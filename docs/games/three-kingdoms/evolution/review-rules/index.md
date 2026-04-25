# 检查规则库（索引）

> **定位**: 评测和审查时必须遵守的检查规则，每轮评测必检。
> **进化能力**: 规则在进化迭代中持续新增和修订，新增/修订记录到每轮完成记录中。
> **流程规则**: [evolution-rules.md](../../process/evolution-rules.md) | **进化规则**: [INDEX.md](./INDEX.md)

---

## 规则分类

| 类别 | 规则文件 | 说明 |
|------|---------|------|
| 白屏防护 | [white-screen-rules.md](./review-rules/white-screen-rules.md) | 白屏零容忍，ErrorBoundary，引擎安全 |
| UI完整性 | [ui-integrity-rules.md](./review-rules/ui-integrity-rules.md) | data-testid，防御性编程，交互规范 |
| 架构合规 | [architecture-rules.md](./review-rules/architecture-rules.md) | DDD分层，门面违规，文件行数，类型安全 |
| 代码质量 | [code-quality-rules.md](./review-rules/code-quality-rules.md) | 禁止模式，死代码，命名规范 |
| 构建与部署 | [build-rules.md](./review-rules/build-rules.md) | 编译通过，构建产物，基本功能可用性 |

---

## 规则进化记录

> 每轮新增或修订的规则记录在此。完成记录中记录详细来源。

| 日期 | 轮次 | 变更 | 规则编号 |
|------|------|------|---------|
| — | — | *等待新一轮* | — |

---

## 快速检查清单

> Phase 2 冒烟和 Phase 5 架构审查时直接使用此清单。

### P0 必须通过（任一失败阻塞封版）

- [ ] 无白屏：`<div id="root">` 有内容
- [ ] 无JS Error：F12 Console 0个Error
- [ ] ErrorBoundary包裹游戏主组件
- [ ] 引擎构造在try/catch内
- [ ] 编译通过：`pnpm run build` 成功

### P1 重要检查

- [ ] getState()返回完整默认状态，类型非unknown
- [ ] Object.values/keys调用前空值守卫
- [ ] localStorage读写try/catch包裹
- [ ] 构建产物游戏入口chunk非空
- [ ] 页面加载/引擎初始化/资源栏/Tab切换正常

### P2 架构合规

- [ ] 业务代码文件 ≤500行，测试脚本 ≤1000行
- [ ] DDD分层单向依赖
- [ ] 门面违规检测通过
- [ ] as any零存在
- [ ] 无废弃文件/bak目录

---

*索引版本: v1.0 | 创建日期: 2026-04-23*
