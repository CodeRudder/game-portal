# R24 — v3.0 攻城略地(上) 第二轮全局进化审查 执行计划

> **规划日期**: 2026-04-25
> **目标版本**: v3.0 攻城略地(上)
> **前置轮次**: R21-v3(Phase 1~6 已完成) → R22 → R23(还债提质) → **R24(本轮)**
> **基础状态**: R23 结束时代码质量历史最高（as any=0, TODO=0, 超500行=0, jest残留=0）

---

## 一、R24 背景与动机

### 1.1 为什么需要 R24？

R21-v3 已完成 v3.0 的第一轮全局审查（Phase 1~6 封版通过），但后续 R22~R23 进行了大规模还债提质（SharedPanel重构、TODO清零、文件拆分、jest→vi迁移）。这些全局改动可能引入了回归问题，需要一轮新的全局审查确认 v3.0 代码仍然健康。

### 1.2 已知问题（R24 前置发现）

| # | 模块 | 问题 | 严重性 |
|---|------|------|:------:|
| 1 | Panel 测试 | **12 个 Panel 测试失败**（BattleFormationModal 5个 + BattleResultModal 3个 + BattleScene 4个） | **P1** |
| 2 | Panel 测试 | BattleFormationModal 测试引用旧 CSS 类 `.tk-bfm-overlay`，组件已重构为 SharedPanel（`tk-shared-panel-overlay`） | P1 |
| 3 | Panel 测试 | BattleResultModal 测试选择器与新 DOM 结构不匹配 | P1 |
| 4 | Panel 测试 | BattleScene `log.parts` 可能为 undefined 导致渲染崩溃 | P1 |
| 5 | P2 遗留 | CampaignProgressSystem.ts 449行接近500行阈值 | P2 |
| 6 | P2 遗留 | 测试文件7处直接引用engine子模块类型 | P2 |
| 7 | P2 遗留 | MapDataRenderer/MapFilterSystem 未实现 ISubsystem | P2 |
| 8 | P2 遗留 | 攻城消耗PRD表述优化 | P2 |

### 1.3 Engine 测试状态（全部健康）

| 模块 | 测试文件 | 测试数 | 状态 |
|------|:--------:|:------:|:----:|
| Campaign Engine | 9 | 320 | ✅ 全通过 |
| Battle Engine | 15 | 496 | ✅ 全通过 |
| Map Engine | 9 | 319 | ✅ 全通过 |
| **合计** | **33** | **1,135** | **✅** |

### 1.4 Panel 测试状态（需修复）

| 模块 | 测试文件 | 通过 | 失败 | 状态 |
|------|:--------:|:----:|:----:|:----:|
| CampaignTab.test.tsx | 1 | 11 | 0 | ✅ |
| CampaignTab.sweep.test.tsx | 1 | 5 | 0 | ✅ |
| SweepPanel.test.tsx | 1 | ? | 0 | ✅ |
| SweepModal.test.tsx | 1 | ? | 0 | ✅ |
| BattleSpeedControl.test.tsx | 1 | ? | 0 | ✅ |
| BattleFormationModal.test.tsx | 1 | 10 | **5** | ❌ |
| BattleResultModal.test.tsx | 1 | 5 | **3** | ❌ |
| BattleScene.test.tsx | 1 | 10 | **4** | ❌ |

---

## 二、R24 执行计划

### 总体策略
R24 分为 **6 个子任务**，遵循进化规则 Phase 1~6 流程，但聚焦于：
1. **修复 12 个 Panel 测试失败**（P1，最高优先级）
2. **UI 回归验证**（确认 SharedPanel 重构未破坏功能）
3. **技术审查更新**（确认架构合规性）
4. **P2 遗留处理**（酌情修复）

---

### 子任务 R24-1: Panel 测试修复 — BattleFormationModal（P1）

**预估时间**: 15min
**目标**: 修复 5 个 BattleFormationModal 测试失败

**问题根因**:
- 组件已重构为使用 `SharedPanel`，DOM 结构从 `.tk-bfm-overlay` 变为 `.tk-shared-panel-overlay`
- 测试仍使用旧选择器 `.tk-bfm-overlay`

**修复方案**:
1. 更新测试选择器：`.tk-bfm-overlay` → `data-testid="battle-formation-modal"` 或 `.tk-shared-panel-overlay`
2. 更新标题查找：`screen.getByText('黄巾之乱')` → `screen.getByText('战前布阵 - 黄巾之乱')`
3. 更新关闭按钮查找：`screen.getByLabelText('关闭')` → 适配 SharedPanel 的关闭按钮
4. 更新遮罩点击：适配 SharedPanel 的 overlay 点击行为

**验证**:
- `npx vitest run src/components/idle/panels/campaign/__tests__/BattleFormationModal.test.tsx` 全通过

---

### 子任务 R24-2: Panel 测试修复 — BattleResultModal（P1）

**预估时间**: 10min
**目标**: 修复 3 个 BattleResultModal 测试失败

**问题根因**:
- 组件已重构为使用 `SharedPanel`，DOM 结构变化
- `screen.getByText('战斗胜利')` 匹配到多个元素（SharedPanel title + 原有标题）

**修复方案**:
1. 更新弹窗容器选择器
2. 使用 `getAllByText` + 索引或更精确的选择器
3. 确认 SharedPanel title 与内部标题的层级关系

**验证**:
- `npx vitest run src/components/idle/panels/campaign/__tests__/BattleResultModal.test.tsx` 全通过

---

### 子任务 R24-3: Panel 测试修复 — BattleScene（P1）

**预估时间**: 10min
**目标**: 修复 4 个 BattleScene 测试失败

**问题根因**:
- `BattleScene.tsx:117` 行 `log.parts.map(...)` 中 `log.parts` 为 undefined
- 测试提供的 mock battleLog 数据缺少 `parts` 字段

**修复方案**:
1. 在 BattleScene.tsx 中添加防御性检查：`log.parts?.map(...)` 或 `(log.parts ?? []).map(...)`
2. 或更新测试 mock 数据确保每个 log entry 包含 `parts` 数组

**验证**:
- `npx vitest run src/components/idle/panels/campaign/__tests__/BattleScene.test.tsx` 全通过

---

### 子任务 R24-4: UI 回归验证（Phase 2 冒烟 + Phase 3 深度）

**预估时间**: 30min
**目标**: 确认 SharedPanel 重构后 UI 功能正常

**执行步骤**:

#### Phase 2 冒烟测试（15min）
1. 启动 dev-server（`pnpm dev`）
2. 使用 Playwright 运行 e2e 测试（基于 `e2e/v3-r2-test.cij` 模板）
3. 验证 P0 检查清单：
   - [ ] 无白屏
   - [ ] 无 JS Error
   - [ ] 战役 Tab 切换正常
   - [ ] 关卡列表渲染（85+ DOM 元素）
   - [ ] 世界地图 Tab 切换正常
   - [ ] 领土网格渲染（54+ 元素）
   - [ ] PC 端 1280×720 截图正常
   - [ ] 移动端 375×812 截图正常
   - [ ] 无 NaN/undefined 显示

#### Phase 3 深度验证（15min）
按 Play 文档 §1~§7 关键步骤验证：
- [ ] §1 战役地图：6章关卡渲染、节点状态、章节切换
- [ ] §2 战前布阵：弹窗打开/关闭、一键布阵、战力对比
- [ ] §3 战斗过程：自动战斗、伤害飘字、技能释放
- [ ] §4 战斗结算：胜利/失败面板、奖励展示、星级评定
- [ ] §5 核心循环：编队→出征→战斗→结算→奖励→返回
- [ ] §9 扫荡系统：三星通关关卡显示扫荡按钮

**产出**: `ui-reviews/v3.0-review-r3.md`

---

### 子任务 R24-5: 技术审查更新（Phase 5）

**预估时间**: 20min
**目标**: 确认 R22~R23 重构后架构合规性

**审查维度**:

| # | 检查项 | 标准 | 方法 |
|---|--------|------|------|
| 1 | 文件行数 | 所有文件 ≤500行 | `find src/ -name "*.ts" -o -name "*.tsx" \| xargs wc -l \| sort -rn \| head -20` |
| 2 | DDD 门面 | 面板不直接引用 engine 子模块 | `grep -r "engine/campaign\|engine/battle\|engine/map" src/components/` |
| 3 | ISubsystem | 核心子系统 100% | 统计实现率 |
| 4 | as any | 零容忍 | `grep -rn "as any" src/ --include="*.ts" --include="*.tsx"` |
| 5 | TODO/FIXME | 零容忍 | `grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx"` |
| 6 | console.log | 生产代码零存在 | `grep -rn "console\." src/ --include="*.ts" --include="*.tsx"` |
| 7 | data-testid | 关键交互元素覆盖 | 统计覆盖数 |
| 8 | 废弃文件 | 无 .bak/.old/.tmp | `find src/ -name "*.bak" -o -name "*.old" -o -name "*.tmp"` |
| 9 | Panel 测试 | 100% 通过 | `npx vitest run src/components/idle/panels/campaign/` |
| 10 | Engine 测试 | 100% 通过 | `npx vitest run src/games/three-kingdoms/engine/` |
| 11 | Build | `pnpm run build` 成功 | 执行构建 |

**产出**: `tech-reviews/v3.0-review-r3.md`

---

### 子任务 R24-6: 封版判定 + 复盘（Phase 6）

**预估时间**: 15min
**目标**: 判定 v3.0 第二轮全局审查是否通过

**封版条件**:

| 条件 | 要求 | 当前状态 |
|------|------|---------|
| Panel 测试 | 100% 通过（53/53） | ❌ 41/53（需修复 12 个） |
| Engine 测试 | 100% 通过（1,135/1,135） | ✅ 已通过 |
| Build | `pnpm run build` 成功 | ✅ 已通过 |
| UI 冒烟 | 10/10 检查点通过 | ⏳ 待验证 |
| 技术审查 | P0=0, P1=0 | ⏳ 待验证 |
| Plan 覆盖度 | 43 个功能点被 Play 覆盖 | ✅ Play 文档 1217 行 |

**产出**:
- `evolution-progress-r24.md`
- `lessons/v3.0-lessons-r3.md`
- 进化规则更新（如有新教训）

---

## 三、P2 遗留处理策略

R24 的主要目标是修复 P1 测试失败。P2 遗留问题根据时间酌情处理：

| # | P2 问题 | 处理策略 |
|---|---------|---------|
| 1 | CampaignProgressSystem.ts 449行 | 监控，不拆分（距离500行还有余量） |
| 2 | 测试文件7处直接引用engine子模块类型 | R24-1/2/3 修复时一并处理 |
| 3 | MapDataRenderer/MapFilterSystem 未实现 ISubsystem | 豁免，不处理（无状态辅助类） |
| 4 | 攻城消耗PRD表述优化 | 文档优化，不涉及代码 |

---

## 四、预估时间与执行顺序

```
R24-1: BattleFormationModal 测试修复     15min  ← P1 最高优先
  ↓
R24-2: BattleResultModal 测试修复        10min  ← P1
  ↓
R24-3: BattleScene 测试修复              10min  ← P1
  ↓
R24-4: UI 回归验证（冒烟+深度）          30min  ← 确认修复有效
  ↓
R24-5: 技术审查更新                      20min  ← 架构合规确认
  ↓
R24-6: 封版判定 + 复盘                   15min  ← 产出文档
─────────────────────────────────────────────────
总计:                                ~100min
```

---

## 五、风险与缓解

| 风险 | 概率 | 缓解措施 |
|------|:----:|---------|
| SharedPanel 重构引入其他隐藏问题 | 中 | UI 冒烟测试全面覆盖 |
| Panel 测试修复引入新回归 | 低 | 每个修复后立即运行全量 Panel 测试 |
| BattleScene parts 问题影响生产渲染 | 中 | 添加防御性检查（可选链/默认值） |
| Engine 层出现回归 | 低 | Engine 测试 1,135 个已全部通过 |

---

## 六、R24 完成标准

- [ ] 12 个 Panel 测试失败全部修复（53/53 通过）
- [ ] 1,135 个 Engine 测试维持全通过
- [ ] `pnpm run build` 成功
- [ ] UI 冒烟测试 10/10 通过
- [ ] 技术审查 P0=0, P1=0
- [ ] 进度文档 + 经验教训 + 进化规则更新完成

---

*文档版本: v1.0 | 创建日期: 2026-04-25 | R24 v3.0 第二轮全局审查规划*
