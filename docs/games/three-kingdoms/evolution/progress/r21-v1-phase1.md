# Round 21 — v1.0 基业初立 Phase 1 准备报告

> **日期**: 2026-04-23
> **轮次**: Round 21（第二轮全局进化循环，v1.0重新评测）
> **进化规则**: evolution-rules.md（6阶段流程）
> **上轮记录**: evolution-progress-r7.md + r21-phase1-preparation.md

---

## 一、v1.0 功能点清单（25个）

### 模块A: 主界面导航 (NAV) — 5项

| # | 功能点 | 优先级 | PRD | UI |
|---|--------|:------:|-----|-----|
| 1 | 主界面功能定位 — 资源栏+Tab+中央场景区布局 | P0 | NAV-1 | 01-main-layout |
| 2 | 顶部资源栏 — 5核心+1付费+2代币+数值+产出速率 | P0 | NAV-1 | 01-main-layout |
| 3 | Tab切换 — 天下/出征/武将/科技/建筑/声望/更多▼ 7个Tab | P0 | NAV-2 | 01-main-layout |
| 4 | 中央场景区 — 建筑俯瞰为默认场景 | P0 | NAV-1 | 01-main-layout |
| 5 | 游戏日历系统 — 年号/季节/天气显示 | P1 | NAV-1 | 01-main-layout |

### 模块B: 资源系统 (RES) — 7项

| # | 功能点 | 优先级 | PRD | UI |
|---|--------|:------:|-----|-----|
| 6 | 5种核心资源定义 — 粮草/铜钱/兵力/科技点/天命 | P0 | RES-1 | 08-resource-system |
| 7 | 资源产出公式 — 基础产出+建筑加成+科技加成 | P0 | RES-2 | 08-resource-system |
| 8 | 资源消耗场景 — 建筑升级/科技研究/武将招募 | P0 | RES-3 | — |
| 9 | 资源存储与上限 — 容量进度条+溢出规则 | P0 | RES-4 | 08-resource-system |
| 10 | 容量警告体系 — 资源接近上限变色/动画 | P1 | — | 08-resource-system |
| 11 | 天命资源完整定义 — 获取/用途/上限/消耗 | P1 | RES-1 | 08-resource-system |
| 12 | 资源产出粒子效果 — CSS脉冲动画 | P2 | — | 08-resource-system |

### 模块C: 建筑系统 (BLD) — 7项

| # | 功能点 | 优先级 | PRD | UI |
|---|--------|:------:|-----|-----|
| 13 | 8座建筑总览 — 类型/功能/依赖关系 | P0 | BLD-1 | 06-building-system |
| 14 | 建筑升级机制 — 消耗资源+等级提升+产出增加 | P0 | BLD-2 | 06-building-system |
| 15 | 建筑资源产出公式 — 各建筑产出明细 | P0 | BLD-3 | 06-building-system |
| 16 | 建筑联动与解锁 — 前置关系+联动加成 | P0 | BLD-4 | 06-building-system |
| 17 | PC端城池俯瞰布局 — 建筑列表+筛选栏 | P0 | — | 06-building-system |
| 18 | 建筑队列管理 — 队列槽位+并行升级 | P1 | BLD-4 | 06-building-system |
| 19 | 建筑升级路线推荐 — 新手/发展/中后期 | P2 | BLD-5 | — |

### 模块D: 全局规范 (SPEC) — 6项

| # | 功能点 | 优先级 | PRD | UI |
|---|--------|:------:|-----|-----|
| 20 | 全局配色/字体/间距规范 | P0 | — | 15-shop-trade |
| 21 | 面板组件通用规范 — 打开/关闭/折叠 | P0 | ITR-3 | — |
| 22 | 弹窗组件通用规范 — 类型/打开/关闭 | P1 | ITR-4 | — |
| 23 | Toast提示规范 — 时长/位置/类型 | P1 | ITR-2 | — |
| 24 | 自动保存机制 — 每30秒保存到localStorage | P0 | — | — |
| 25 | 基础离线收益 — 回归时计算离线资源产出 | P1 | NAV-5 | — |

**优先级分布**: P0×15 / P1×8 / P2×2

---

## 二、Play 流程覆盖情况

v1-play.md（Round 3版）共 **50个流程**，覆盖全部25个功能点：

| Play章节 | 流程数 | 覆盖功能点 | 说明 |
|---------|:------:|-----------|------|
| 一、资源系统 (RES) | 5 | #6~#12 | RES-FLOW-1~5 |
| 二、建筑系统 (BLD) | 6 | #13~#19 | BLD-FLOW-1~6 |
| 三、主界面导航 (NAV) | 6 | #1~#5 | NAV-FLOW-1~6 |
| 四、全局规范 (SPEC) | 6 | #20~#25 | SPEC-FLOW-1~6 |
| 五、核心循环E2E | 2 | 全覆盖 | E2E-FLOW-1~2 |
| 六、关联系统交叉 | 3 | 全覆盖 | CROSS-FLOW-1~3 |
| 七、设置系统 (SET) | 8 | 跨系统 | SET-FLOW-1~8 |
| 八、军师建议 (ADV) | 3 | 跨系统 | ADV-FLOW-1~3 |
| 九、红点系统 (RDP) | 4 | 跨系统 | RDP-FLOW-1~4 |
| 十、资源交易 (TRD) | 3 | 跨系统 | TRD-FLOW-1~3 |
| 十一、设置交叉验证 | 5 | 跨系统 | CROSS-SET-0~4 |
| 十二、更多菜单导航 | 1 | #3 | NAV-FLOW-6 |

### 功能点→Play章节映射表

| 功能点 | Play章节 | 核心流程 |
|:------:|---------|---------|
| #1 | NAV-FLOW-1 | 主界面三段式布局验证 |
| #2 | NAV-FLOW-2 | 资源栏5+1+2资源显示验证 |
| #3 | NAV-FLOW-3 + NAV-FLOW-6 | 7个Tab切换 + 更多菜单 |
| #4 | NAV-FLOW-4 | 中央场景区随Tab切换 |
| #5 | NAV-FLOW-5 | 日历年号/季节/天气 |
| #6 | RES-FLOW-1 | 5种资源自动增长 |
| #7 | RES-FLOW-1 | 资源产出公式验证 |
| #8 | RES-FLOW-2 | 资源消耗（建筑升级场景） |
| #9 | RES-FLOW-3 | 容量上限+进度条 |
| #10 | RES-FLOW-3 | 容量警告变色/动画 |
| #11 | RES-FLOW-4 | 天命特殊定义 |
| #12 | RES-FLOW-5 | 产出粒子效果 |
| #13 | BLD-FLOW-1 | 8座建筑展示+筛选 |
| #14 | BLD-FLOW-2 | 建筑升级完整流程 |
| #15 | BLD-FLOW-3 | 升级后产出增加 |
| #16 | BLD-FLOW-4 | 建筑解锁条件 |
| #17 | BLD-FLOW-1 | PC端城池俯瞰布局 |
| #18 | BLD-FLOW-5 | 建筑队列管理 |
| #19 | BLD-FLOW-6 | 升级路线推荐 |
| #20 | SPEC-FLOW-1 | 配色/字体/间距 |
| #21 | SPEC-FLOW-2 | 面板组件规范 |
| #22 | SPEC-FLOW-3 | 弹窗组件规范 |
| #23 | SPEC-FLOW-4 | Toast提示规范 |
| #24 | SPEC-FLOW-5 | 自动保存验证 |
| #25 | SPEC-FLOW-6 | 离线收益验证 |

**覆盖度: 25/25 = 100%**

---

## 三、需要对照的 PRD/UI 文件清单

### 3.1 PRD 文件（6个核心）

| PRD文件 | 路径 | 关联模块 |
|---------|------|---------|
| NAV 主界面PRD | `ui-design/prd/NAV-main-prd.md` | NAV(#1~#5) |
| RES 资源PRD | `ui-design/prd/RES-resources-prd.md` | RES(#6~#12) |
| BLD 建筑PRD | `ui-design/prd/BLD-buildings-prd.md` | BLD(#13~#19) |
| SPEC 交互规范 | `ui-design/prd/SPEC-interaction.md` | SPEC(#20~#23) |
| SET 设置PRD | `ui-design/prd/SET-settings-prd.md` | SET流程 |
| SPEC 离线规范 | `ui-design/prd/SPEC-offline.md` | #25 |

### 3.2 UI Layout 文件（6个核心）

| UI文件 | 路径 | 关联模块 |
|--------|------|---------|
| 主界面布局 | `ui-design/ui-layout/NAV-main.md` | NAV(#1~#5) |
| 建筑系统 | `ui-design/ui-layout/BLD-buildings.md` | BLD(#13~#19) |
| 资源系统 | `ui-design/ui-layout/RES-resources.md` | RES(#6~#12) |
| 全局规范 | `ui-design/ui-layout/SPEC-global.md` | #20 |
| 设置系统 | `ui-design/ui-layout/SET-settings.md` | SET流程 |
| 离线奖励 | `ui-design/ui-layout/OFR-offline.md` | #25 |

### 3.3 检查规则（5个）

| 规则文件 | 路径 |
|---------|------|
| 白屏防护 | `evolution/review-rules/white-screen-rules.md` |
| UI完整性 | `evolution/review-rules/ui-integrity-rules.md` |
| 架构合规 | `evolution/review-rules/architecture-rules.md` |
| 代码质量 | `evolution/review-rules/code-quality-rules.md` |
| 构建部署 | `evolution/review-rules/build-rules.md` |

---

## 四、上轮遗留问题

### 4.1 R20 继承的 P1 问题

| # | 问题 | 影响范围 | 计划处理 |
|---|------|---------|---------|
| P1-001 | 邮件域双重导出风险（exports-v9 + mail同时导出） | engine/index.ts | Phase 5 架构审查 |
| P1-002 | ThreeKingdomsEngine.ts 未集成 prestige/unification | engine/ThreeKingdomsEngine.ts | Phase 5 架构审查 |

### 4.2 R7 遗留 P2 问题

| # | 问题 | 说明 |
|---|------|------|
| P2-001 | 预存测试失败约300+ | 继续批量修复 |
| P2-002 | 更多组件 data-testid 待补全 | 逐步补全 |
| P2-003 | v15.0 EventTriggerSystem Phase2增强 | 概率公式+条件评估算法优化 |

### 4.3 用户3条待办

| # | 待办 | 优先级 | 本轮处理 |
|---|------|:------:|---------|
| TODO-1 | 增加游戏测试设施：模拟触发事件获取资源验证 | P1 | 记录为进化计划 |
| TODO-2 | 按DDD要求划分业务域/子系统，不按版本命名 | P1 | Phase 5 标记 |
| TODO-3 | 梳理分析每种资源的来源是否正确/有断裂 | P1 | Phase 3 深度评测 |

---

## 五、本轮评测重点

### 5.1 P0 功能点（15项，必须全部通过）

1. **主界面框架** (#1~#4): 三段式布局、资源栏、7个Tab、中央场景区
2. **核心资源循环** (#6~#9): 5种资源自动增长、产出公式、消耗、存储上限
3. **建筑核心循环** (#13~#17): 8座建筑、升级机制、产出联动、解锁条件、PC布局
4. **全局规范** (#20~#21, #24): 配色风格、面板组件、自动保存

### 5.2 核心循环验证（E2E）

**主循环**: 建筑升级 → 资源产出增加 → 解锁更多建筑 → 继续升级
- E2E-FLOW-1: 完整游戏循环（11步）
- E2E-FLOW-2: 30秒可理解性验证（5步）

### 5.3 关键数据验证点

| 验证项 | 预期值 | 验证方式 |
|--------|--------|---------|
| 初始粮草 | ≈100 | RES-FLOW-1 步骤3 |
| 粮草初始上限 | 2,000 | RES-FLOW-3 |
| 兵力初始上限 | 500 | RES-FLOW-3 |
| 农田Lv1→2费用 | 100粮草+50铜钱 | BLD-FLOW-2 |
| 主城Lv1→2费用 | 200粮草+150铜钱 | BLD-FLOW-2 |
| 主城Lv2解锁 | 市集+兵营 | BLD-FLOW-4 |
| 主城Lv3解锁 | 铁匠铺+书院 | BLD-FLOW-4 |
| 主城Lv4解锁 | 医馆 | BLD-FLOW-4 |
| 主城Lv5解锁 | 城墙 | BLD-FLOW-4 |
| 自动保存间隔 | 30秒 | SPEC-FLOW-5 |
| 离线收益最大时长 | 72小时 | SPEC-FLOW-6 |

### 5.4 交叉验证重点

| 交叉路径 | 验证内容 |
|---------|---------|
| BLD→RES→NAV | 建筑升级→产出增加→资源栏更新 |
| BLD→BLD | 主城升级→新建筑解锁→新建筑可升级 |
| SPEC→SPEC | 自动保存→刷新→数据恢复 |
| SET→SPEC | 设置变更→持久化→重启恢复 |

### 5.5 架构审查重点

| 审查项 | 说明 |
|--------|------|
| P1-001修复 | engine/index.ts 邮件域导出去重 |
| P1-002修复 | ThreeKingdomsEngine 集成 prestige/unification |
| DDD域标记 | 标记版本号后缀文件，不重构 |
| 资源来源追踪 | 5种核心资源来源全链路验证 |

---

## 六、Phase 2~6 执行计划

| Phase | 内容 | 预估时间 | 产出 |
|-------|------|:--------:|------|
| Phase 2 | 冒烟测试（Play第1遍） | 15min | 冒烟报告 |
| Phase 3 | 深度评测（Play第2遍）+ 资源来源梳理 | 40min | UI评测报告 |
| Phase 4 | 修复 + 回归验证循环 | 30min | 修复记录 |
| Phase 5 | 架构审查（P1修复+DDD标记） | 25min | 架构审查报告 |
| Phase 6 | 封版判定 + 复盘进化 | 15min | 进化日志 |

---

*报告版本: v1.0 | 创建日期: 2026-04-23 | Phase 1 准备完成 ✅*
