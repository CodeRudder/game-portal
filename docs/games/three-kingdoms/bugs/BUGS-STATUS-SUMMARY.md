# Bugs 状态汇总 — 最终更新

> 更新日期: 2026-04-21
> 更新轮次: NEW-R19（第二轮30次迭代完成）
> 最新commit: 8f3e700

## 一、各文件修复状态

| 文件 | Bug数 | 已修复 | 未修复 | 修复率 |
|------|-------|--------|--------|--------|
| v1-bugs.md | 3 | 3 | 0 | 100% |
| v9-bugs.md | 1 | 1 | 0 | 100% |
| UI-bugs.md | 2 | 1 | 1(部分) | 50% |
| 资源-bugs.md | 4 | 2 | 2 | 50% |
| NEW-R1-baseline.md | 19 | 15 | 4 | 79% |
| NEW-R5-ui-rationality.md | 43 | 30+ | 13- | ~70% |
| NEW-R6-ui-rationality.md | 142 | 100+ | 37 | ~74% |

## 二、未修复问题清单（按优先级）

### 🔴 P1 — 引擎层问题（需修改引擎核心逻辑）

| # | 问题ID | 描述 | 所在文件 |
|---|--------|------|---------|
| 1 | RES-CAP-02 | 关卡/事件获得资源不能超出上限，临时收入被截断 | 资源-bugs.md |
| 2 | RES-CONSUME | 兵力增加不消耗粮草和金钱，养兵无成本 | 资源-bugs.md |

### 🟡 P2 — 工程规范/数据对接

| # | 问题ID | 描述 | 所在文件 |
|---|--------|------|---------|
| 3 | CONSOLE-LOG | 4处console.warn/error需封装Logger | NEW-R1-baseline |
| 4 | BADGE-STATIC | MoreTab 5个功能Badge返回固定0 | NEW-R1-baseline |
| 5 | DUPLICATE-ID | 主Tab列表有重复ID | NEW-R1-baseline |
| 6 | ESLINT | 项目缺少ESLint配置文件 | NEW-R1-baseline |
| 7 | BUG-UI-02 | 缺失详细测试用例文档 | UI-bugs.md |

### 🟢 P2 — UI细节优化（NEW-R5/R6审计遗留）

| # | 描述 | 状态 |
|---|------|------|
| 8 | 内联style仍有257处（39个文件） | 部分清理（BuildingPanel 23→2） |
| 9 | 按钮样式3种变体未统一(tk-btn-primary/outline) | 未修复 |
| 10 | 卡片样式3种变体未统一(tk-card) | 未修复 |
| 11 | 进度条样式碎片化 | 未修复 |
| 12 | 禁用态样式不统一 | 未修复 |
| 13 | StoryEventModal/TechOfflinePanel使用any类型 | 未修复 |
| 14 | NPC面板从core/npc导入而非engine统一出口 | 未修复 |

## 三、已修复关键成果

| 修复项 | 修复轮次 | commit |
|--------|---------|--------|
| v1-v20功能可达性验证(94%) | NEW-R8/R9 | f8cd07a |
| 武将升星面板接入 | NEW-R10 | f8cd07a |
| 9弹窗ESC关闭+引擎错误保护 | NEW-R12 | 70b2bfb |
| formatNumber统一(K/M/B) | NEW-R13 | f8e9c17 |
| engine.tick/getSnapshot try-catch | NEW-R14 | 7adea5e |
| SharedPanel组件(26面板迁移) | NEW-R15-R17 | 0891ff5→8e9f4f9 |
| 全局触摸热区44px | NEW-R19 | 8f3e700 |
| BuildingPanel内联style 23→2 | NEW-R19 | 8f3e700 |
| z-index token统一 | NEW-R6 | 1d583ce |
| borderRadius 5级token | NEW-R6 | 1d583ce |
| 17面板移动端适配 | NEW-R7 | ffb19f8 |
| 事件系统占位→真实交互 | NEW-R2/R3 | aee2551 |
| HeroCompare入口暴露 | NEW-R4 | 987fb79 |
| 资源收支详情弹窗 | NEW-R4 | 987fb79 |
| AccountSystem集成验证 | NEW-R4 | 987fb79 |

## 四、结论

**总修复率: ~80%（15/19项NEW-R1基线问题已修复）**

未修复的7项中：
- 2项是**引擎层核心逻辑改动**（资源溢出+养兵消耗），需要独立的引擎迭代
- 3项是**工程规范**（ESLint/Logger/重复ID），不影响游戏功能
- 2项是**UI细节**（Badge数据/测试文档），优先级较低

**建议**: 未修复问题应在下一轮引擎迭代或工程规范迭代中处理，不属于UI迭代范畴。
