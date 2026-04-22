# v10.0 兵强马壮 — 技术审查报告 R2

> **审查日期**: 2026-04-23
> **审查范围**: engine/equipment/ + core/equipment/ + UI 组件 + 测试 + 架构合规
> **R1 报告**: `tech-reviews/v10.0-review-r1.md`
> **R1 状态**: ⚠️ CONDITIONAL（P0: 0 / P1: 6 / P2: 5）

---

## 一、R1 → R2 修复追踪

| R1 编号 | 问题 | R2 状态 | 验证结果 |
|---------|------|---------|----------|
| P1-1 | 强化成功率 +1~+3 非必成 | ✅ 已修复 | `ENHANCE_SUCCESS_RATES[0..2]` 均为 1.0 |
| P1-2 | 特殊词条概率与 PRD 不符 | ✅ 已修复 | `RARITY_SPECIAL_EFFECT_CHANCE` 改为 blue:0.05/purple:0.20/gold:1.0 |
| P1-3 | 保底阈值配置不一致 | ⚠️ 部分修复 | ForgePityManager 已引用 core 配置，但 `targetedGoldPity` 仍为 20（PRD 要求 30） |
| P1-4 | 基础炼制 3 蓝→金概率 | ⚠️ 未修复 | 代码 `purple:78/gold:22`，PRD 要求 `purple:75/gold:22`，紫色偏高 3% |
| P1-5 | 默认背包容量 | ✅ 已修复 | `DEFAULT_BAG_CAPACITY = 50`，与 PRD 一致 |
| P1-6 | EquipmentSetSystem 重复实例化 | ✅ 已修复 | `engine-extended-deps.ts:105` 复用同一 `setSystem` 实例 |
| P2-1 | EquipmentGenerator/GenHelper 重复 | ⚠️ 未修复 | 两文件仍并存（228行/150行），函数签名差异 |
| P2-2 | EquipmentDecomposer 废弃品质 | ⚠️ 未修复 | `orange:5000/red:12000` 仍存在于本地配置 |
| P2-3 | 分解配置双重定义 | ⚠️ 未修复 | Decomposer 本地值与 core 配置不一致（purple: 2000 vs 1000） |
| P2-4 | data-testid 覆盖不足 | ⚠️ 未修复 | EquipmentTab 仍仅 1 个，EquipmentPanel 仍 0 个 |
| P2-5 | 炼制权重硬编码 | ⚠️ 未修复 | Engine 层仍硬编码权重，未引用 core 配置 |

---

## 二、编译与测试

### 编译检查

```
npx tsc --noEmit → ✅ 零错误
```

### 单元测试

| 测试文件 | 通过 | 失败 | 说明 |
|----------|:----:|:----:|------|
| equipment-v10.test.ts | 63 | 0 | 5 模块 20 功能点全覆盖 |
| EquipmentSystem.test.ts | 80 | 3 | 分解产出计算失败（配置不一致） |
| **合计** | **143** | **3** | |

#### 失败测试详情

| 测试 | 期望 | 实际 | 根因 |
|------|------|------|------|
| 分解产出·紫品铜钱 | 1500 | 3000 | Decomposer 本地 `purple:2000` vs core `purple:1000` |
| 分解产出·金品铜钱 | 2500 | 5000 | Decomposer 本地 `gold:5000`（含 orange）vs core `gold:2500` |
| 分解产出·金品强化石 | 15 | 50 | Decomposer 本地 `gold:50`（含 orange）vs core `gold:15` |

---

## 三、R2 问题清单

### P0 — 阻塞性问题（1个）

#### P0-1: EquipmentDecomposer 分解配置与 core 严重不一致

- **文件A**: `engine/equipment/EquipmentDecomposer.ts:15-21`
- **文件B**: `core/equipment/equipment-config.ts:229-233 + 415-428`
- **问题描述**: Decomposer 使用本地硬编码配置，与 core 配置存在系统性偏差：

| 品质 | Decomposer 铜钱 | Core 铜钱 | Decomposer 强化石 | Core 强化石 |
|------|:---------------:|:---------:|:-----------------:|:-----------:|
| white | 100 | 50 | 1 | 1 |
| green | 300 | 150 | 3 | 2 |
| blue | 800 | 400 | 8 | 4 |
| purple | 2000 | 1000 | 20 | 8 |
| gold | — | 2500 | — | 15 |
| orange | 5000 | — | 50 | — |
| red | 12000 | — | 120 | — |

- **影响**: 分解产出是 core 配置的 2 倍，3 个测试因此失败
- **修复方案**: 删除 Decomposer 本地配置，引用 core `DECOMPOSE_OUTPUT`

---

### P1 — 重要问题（4个）

#### P1-1: 保底阈值 targetedGoldPity 仍为 20（PRD 要求 30）

- **文件**: `core/equipment/equipment-config.ts:124`
- **当前值**: `targetedGoldPity: 20`
- **PRD 要求**: 连续 30 次未金→第 31 次必金
- **修复**: 改为 `targetedGoldPity: 30`

#### P1-2: 基础炼制 3 蓝→金概率紫色偏高 3%

- **文件**: `engine/equipment/EquipmentForgeSystem.ts:44`
- **当前值**: `blue: { purple: 78, gold: 22 }`
- **PRD 要求**: `purple: 75, gold: 22`（剩余 3% 可能回退蓝品）
- **修复**: 需与策划确认 PRD 总和 97% 是否笔误

#### P1-3: EquipmentGenerator 与 EquipmentGenHelper 代码重复

- **文件A**: `engine/equipment/EquipmentGenerator.ts` (228行)
- **文件B**: `engine/equipment/EquipmentGenHelper.ts` (150行)
- **问题描述**: 两个文件包含几乎相同的函数
- **修复**: 统一为一个文件

#### P1-4: EquipmentForgeSystem 炼制权重未引用 core 配置

- **文件**: `engine/equipment/EquipmentForgeSystem.ts:41-55`
- **问题描述**: Engine 层硬编码权重，core 配置中也有相同数据
- **修复**: Engine 层应引用 core 配置

---

### P2 — 改进建议（5个）

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| P2-1 | EquipmentDecomposer 含废弃品质 orange/red | `EquipmentDecomposer.ts:16-21` | 随 P0-1 修复自动消除 |
| P2-2 | UI 组件 `engine as any` 类型不安全 | 两个 UI 组件 | 5 处 `as any` + 1 处 `any` Props |
| P2-3 | data-testid 覆盖不足 | 两个 UI 组件 | EquipmentTab 仅 1 个，EquipmentPanel 0 个 |
| P2-4 | CSS 变量需 `as any` 绕过类型 | 两个 UI 组件，共 17 处 | 需创建 CSS 类型扩展 |
| P2-5 | 缺少 exports-v10.ts | `engine/` | 有 v9/v12 但无 v10，功能等价 |

---

## 四、架构合规性

### DDD 四层架构 ✅

| 层级 | 目录 | 职责 | 合规 |
|------|------|------|:----:|
| Core 层 | `core/equipment/` | 类型定义 + 配置常量，零逻辑 | ✅ |
| Engine 层 | `engine/equipment/` | 5 个 ISubsystem 业务子系统 | ✅ |
| UI 层 | `components/idle/panels/equipment/` | 展示 + 交互 | ✅ |
| 共享层 | `shared/` | 跨域事件类型 | ✅ |

### 文件行数 ≤500 ✅

全部 16 个装备域文件均在 500 行以内。最大文件：equipment-config.ts (440行)。

### ISubsystem 接口实现 ✅

120 个子系统实现 ISubsystem，装备域 5 个子系统完整（init/update/getState/reset/serialize）。

### 门面导出完整性 ✅

- `engine/equipment/index.ts`: 导出 5 个子系统 + 辅助模块 + 核心类型
- `engine/index.ts:81`: `export * from './equipment'`
- `engine/engine-getters.ts:217-218`: 5 个 getter 方法完整

### 存档集成 ✅

- `engine-save.ts` 包含 equipment/equipmentForge/equipmentEnhance 序列化
- heroEquips 通过装备实例的 isEquipped/equippedHeroId 反序列化重建

---

## 五、测试覆盖分析

### v10 专用测试（equipment-v10.test.ts — 755行）

| 模块 | 功能点 | 测试数 | 结果 |
|------|--------|:------:|:----:|
| A: 装备类型与背包 | #1~#4 | 13 | ✅ 全通过 |
| B: 装备品质与炼制 | #5~#9 | 12 | ✅ 全通过 |
| C: 装备属性与套装 | #16~#17 | 9 | ✅ 全通过 |
| D: 强化系统 | #10~#15 | 16 | ✅ 全通过 |
| E: 穿戴规则 | #19~#20 | 10 | ✅ 全通过 |
| 存档/序列化 | — | 3 | ✅ 全通过 |
| **合计** | **20 功能点** | **63** | **✅ 100% 通过** |

---

## 六、修复优先级建议

| 优先级 | 问题编号 | 预估工时 |
|:------:|----------|:--------:|
| 🔴 P0 | P0-1 分解配置不一致 | 15min |
| 🟡 P1 | P1-1 保底阈值 20→30 | 5min |
| 🟡 P1 | P1-2 炼制概率确认 | 5min（需策划确认） |
| 🟡 P1 | P1-3 Generator/GenHelper 合并 | 30min |
| 🟡 P1 | P1-4 炼制权重引用 core | 20min |
| 🟢 P2 | P2-1~P2-5 | 各 5~15min |

---

## 七、R1→R2 改进总结

| 维度 | R1 | R2 | 变化 |
|------|:--:|:--:|------|
| P0 问题 | 0 | 1 | ↑ 分解配置不一致升级为 P0 |
| P1 问题 | 6 | 4 | ↓ 修复 4 个，新发现 2 个 |
| P2 问题 | 5 | 5 | → 基本稳定 |
| 编译 | ✅ | ✅ | 零错误 |
| v10 测试通过率 | — | 63/63 | ✅ 100% |
| 全量测试通过率 | — | 143/146 | ⚠️ 97.9% |

---

## 八、结论

**v10.0 兵强马壮 技术审查 R2 结论: ⚠️ CONDITIONAL**

- **编译**: ✅ 零错误
- **v10 专项测试**: ✅ 63/63 全通过（20 功能点 100% 覆盖）
- **全量测试**: ⚠️ 143/146 通过（3 个分解测试因配置不一致失败）
- **R1 修复率**: 6 个 P1 中 4 个已修复（66.7%）
- **剩余阻塞**: P0-1 分解配置双重定义导致产出为 PRD 的 2 倍
- **建议**: 修复 P0-1 后可达到 PASS 标准
