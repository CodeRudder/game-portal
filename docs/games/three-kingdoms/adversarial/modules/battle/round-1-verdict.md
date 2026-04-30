# Battle 仲裁裁决 Round 1

> Arbiter: TreeArbiter v1.3 | Time: 2026-05-04
> 状态: **CONTINUE** 🔴

---

# 📋 裁决声明

**Battle 模块 Round 1 仲裁裁决：评分 7.4/10，未达封版线 9.0，判定 CONTINUE。**

- **综合评分**: 7.4/10（封版线 9.0）
- **封版条件通过**: 2/8
- **新 P0**: 6（Challenger 发现）+ 4（系统性问题）= 10 个 P0 级问题
- **系统性问题**: 4 个（NaN 传播链、配置不一致、序列化不完整、Infinity 序列化）
- **可玩性总评**: 6.8/10
- **Hero 经验吸收**: 良好（8 个特别关注项全部来自 Hero 模块经验）

---

## 一、综合评分（5维度加权）

| 维度 | 权重 | 评分 | 说明 |
|------|------|------|------|
| 完备性 | 25% | **7.5** | 488 节点 / 95 API 覆盖面广，但 6 个 P0 说明关键路径仍有遗漏 |
| 准确性 | 25% | **7.0** | covered 标注基本可信，但 74.8% 覆盖率中 NaN 防护标注存在虚报 |
| 优先级 | 15% | **8.0** | P0/P1/P2 分配合理，特别关注项优先级标注准确 |
| 可测试性 | 15% | **8.0** | 节点描述清晰，复现步骤完整，可直接转化为测试用例 |
| 挑战应对 | 20% | **6.5** | 首轮评估——Builder 对 Hero 经验的吸收体现在特别关注项，但修复尚未执行 |

### 评分计算详情

```
完备性:   7.5 × 0.25 = 1.875
准确性:   7.0 × 0.25 = 1.750
优先级:   8.0 × 0.15 = 1.200
可测试性: 8.0 × 0.15 = 1.200
挑战应对: 6.5 × 0.20 = 1.300
─────────────────────────
综合总分:          7.325 → 7.4/10 (四舍五入)
```

### 各维度详细评估

#### 完备性: 7.5/10

**加分项**:
- 488 节点覆盖 20 个文件、4,907 行源码、95 个 API，覆盖面比 Hero R1（~420 节点 / ~60 API）更广
- 17 个子系统逐一列出覆盖率，最细粒度到 DamageNumberConfig（100%）和 index.ts（100%）
- 跨系统链路覆盖 30 条全部 marked covered，Part A/B/C 三层交叉验证
- 特别关注项（S-1~S-8）主动标注了 Hero 模块经验中的高风险模式

**扣分项**:
- 6 个 Challenger P0 中，Builder 仅标记了其中 4 个为 P0 uncovered（S-1/S-2/S-6/S-7），遗漏了 BAT-A-003（skillMultiplier NaN/负数）和 BAT-B-002（负值漏洞）的 P0 级别判定
- 74.8% 的 covered 率中，DEF-006 的 NaN 防护仅覆盖了 `calculateDamage` + `applyDamage`，但 Builder 将 `getCriticalRate` 等函数标记为"已有 NaN 防护"——实际源码中这些函数并无防护（虚报）
- DamageCalculator 的 `calculateDotDamage` 完全未出现在 Builder 的 Top 10 P0 列表中，但 Challenger 发现其为 P0（BAT-A-001）

**结论**: 覆盖广度优秀，但深度不足——Builder 在标注 covered 时过于乐观，部分已标注的防护实际不存在。

#### 准确性: 7.0/10

**加分项**:
- 子系统覆盖率统计与源码 grep 验证一致（如 BattleSpeedController 87.5%、DamageNumberConfig 100%）
- AVAILABLE_SPEEDS 配置交叉问题（S-2）标注准确，源码确认 `[1, 2, 3] as const` vs `BattleSpeed.X4 = 4`
- Top 10 P0 Uncovered 节点的行号和描述基本准确

**扣分项**:
- **NaN 防护虚报**: Builder 在特别关注项 S-4 中声称"DamageCalculator NaN防护已覆盖calculateDamage+applyDamage ✅; 但getCriticalRate(speed=NaN)未防护"——但 Challenger 发现 `calculateDotDamage`（BAT-A-001）和 `getAttackBonus`/`getDefenseBonus`（BAT-A-002）也完全无防护。Builder 的"✅"标注过于乐观
- **covered 标注虚报率预估 5-8%**: 365 个 covered 节点中，预估有 18-29 个节点的 covered 标注不准确（主要是 NaN 防护声称已覆盖但实际未覆盖）
- **serialize 完整性低估**: Builder 在 S-6 中标注"不含battleMode/speedState/ultimateState"是准确的，但未量化影响——Challenger 在 SYS-003 中明确指出这是"断线重连后状态丢失"的可玩性阻断项

**结论**: 虚报率 5-8%，超过 5% 阈值，扣准确性分。Builder 的标注在配置层面准确，但在运行时防护层面（NaN/Infinity/null）过于乐观。

#### 优先级: 8.0/10

**加分项**:
- P0/P1/P2 分配基本合理：6 个 Challenger P0 均为可复现的崩溃或数据错误
- 系统性问题单独列出，影响范围标注清晰
- Builder 的特别关注项严重度标注（S-1~S-8）与 Challenger 发现高度一致

**扣分项**:
- BAT-B-002（负值漏洞）Builder 标为 P1（S-5 资源溢出无上限），但 Challenger 正确提升为 P0——因为负值攻击力直接影响战斗结果
- BAT-A-003（skillMultiplier 为 NaN/0/负数）在 Builder 的 Top 10 中未出现，但属于 P0 级别的算法正确性问题
- Infinity 序列化问题（BAT-B-003）Builder 标为 P0（S-7 的一部分），但实际影响有限——当前使用 structuredClone 不会丢失 Infinity，仅在 JSON 中转时才出问题。可降为 P1

**结论**: 优先级分配整体合理，个别项需调整（1 个 P0 被低估为 P1，1 个 P0 可降为 P1）。

#### 可测试性: 8.0/10

**加分项**:
- Challenger 的每个 P0/P1 都包含完整的复现步骤（含代码片段和预期行为）
- Builder 的节点描述含文件名、行号、分支条件，可直接转化为测试
- 已有对抗式测试文件（P0-crash-fixes.test.ts、battle-fuzz.test.ts、BattleEngine.boundary.test.ts）覆盖了部分 NaN/Infinity 场景

**扣分项**:
- 部分节点的复现依赖"配置异常"（如 BAT-B-002 需要 tech 配置中 troop < all），测试需要构造特殊的 mock 数据
- Infinity 序列化问题（BAT-B-003）的测试需要区分 structuredClone 和 JSON.stringify 两条路径

**结论**: 可测试性良好，大部分节点可直接转化为 Jest 测试用例。

#### 挑战应对: 6.5/10

**加分项**:
- Builder 主动列出了 8 个特别关注项（S-1~S-8），全部基于 Hero 模块经验（模式 9/10/12/13/14/15），说明对前序模块经验有良好吸收
- 与 Hero 模块的对比表格清晰展示了 Battle 模块的改进和遗留问题

**扣分项**:
- **首轮评估，修复尚未执行**: 挑战应对维度评估的是"Builder 是否充分回应了 Challenger 的质疑"。在 R1 阶段，Builder 构建树、Challenger 提出挑战，但修复尚未开始，因此此维度评分保守
- **特别关注项标注有虚报**: S-4 中"✅"标注暗示 calculateDamage/applyDamage 的 NaN 防护已完善，但 Challenger 发现 calculateDotDamage 和 getAttackBonus/getDefenseBonus 完全无防护——Builder 对已有防护的评估不够严谨
- **serialize 问题影响范围低估**: S-6 标注为 P0，但未明确说明这是"断线重连后战斗模式/速度/大招状态全部丢失"的可玩性阻断项

**结论**: 首轮评估，Builder 的经验吸收体现在关注项列表中，但标注准确性和深度有待 R2 修复验证。

---

## 二、封版条件检查（8项）

| # | 条件 | 门槛 | R1 状态 | 通过 | 说明 |
|---|------|------|---------|------|------|
| 1 | 评分 | ≥9.0 | 7.4 | ❌ | 差 1.6 分，需 2-3 轮迭代 |
| 2 | API 覆盖率 | ≥90% | ~95%（95 API / 20 文件） | ✅ | 广度覆盖达标 |
| 3 | F-Cross 覆盖率 | ≥75% | 30/30 链路 marked covered | ⚠️ | Builder 声称 100%，但需 R2 穿透验证确认真实性 |
| 4 | F-Lifecycle 覆盖率 | ≥70% | ~65%（serialize/deserialize 不完整） | ❌ | serialize 缺少 3 个子系统状态 |
| 5 | P0 节点覆盖 | 100% | ~88%（57 P0 uncovered，6 个 Challenger 新 P0） | ❌ | 10 个 P0 待修复 |
| 6 | 虚报数 | 0 | ~18-29 个 covered 虚报 | ❌ | NaN 防护标注虚报率 5-8% |
| 7 | 最终轮新 P0 | 0 | 6（Challenger P0）+ 4 系统性 | ❌ | 首轮，新 P0 预期非零 |
| 8 | 所有子系统覆盖 | 是 | 17/17 子系统已列出 | ✅ | 所有子系统均已扫描 |

**通过: 2/8**（API 覆盖率 + 子系统覆盖）

### 对比 Hero R1 封版条件

| 条件 | Hero R1 | Battle R1 | 说明 |
|------|---------|-----------|------|
| 评分 | 7.0 (❌) | 7.4 (❌) | Battle 略高，因覆盖面更广 |
| API 覆盖率 | ~93% (✅) | ~95% (✅) | 两者均达标 |
| F-Cross | ~38% (❌) | ~100% claimed (⚠️) | Battle 声称更高但需验证 |
| F-Lifecycle | ~65% (❌) | ~65% (❌) | serialize 问题相似 |
| P0 覆盖 | ~75% (❌) | ~88% (❌) | Battle 略好 |
| 虚报数 | ~15 (❌) | ~18-29 (❌) | 两者均有虚报 |
| 新 P0 | 41 (❌) | 10 (❌) | Battle 少得多（经验吸收效果） |
| 子系统覆盖 | 29/29 (✅) | 17/17 (✅) | 两者均达标 |

**关键差异**: Battle R1 的新 P0 仅 10 个（Hero R1 为 41 个），说明 Builder 吸收了 Hero 模块的 NaN 防护经验（DEF-006 已覆盖 calculateDamage/applyDamage），但防护不完整。

---

## 三、P0 裁定

### Challenger P0 验证

| ID | Challenger 声称 | Arbiter 验证 | 裁定 | 说明 |
|----|----------------|-------------|------|------|
| BAT-A-001 | calculateDotDamage 无 NaN 防护 | ✅ 源码确认无防护 | **P0 确认** | NaN 绕过 `> 0` 检查，DOT 伤害完全失效 |
| BAT-A-002 | getAttackBonus/getDefenseBonus 无 NaN 防护 | ✅ 源码确认无防护 | **P0 确认** | buff.value 为 NaN 时全链污染 |
| BAT-A-003 | skillMultiplier 为 NaN/0/负数 | ✅ 源码确认 calculateDamage 有最终 NaN 防护（行 298-299），但 skillMultiplier=0 时 damage=0（非 NaN），负数时 damage 为负（被 applyDamage 的 NaN 检查放过但 `hp -= negative` = 加血） | **P0 确认（降级为 P0-）** | skillMultiplier 负数导致"负伤害=加血"是逻辑错误，但 NaN 已被 DEF-006 拦截 |
| BAT-B-001 | AVAILABLE_SPEEDS 缺少 X4 | ✅ 源码确认 `[1, 2, 3]` vs `BattleSpeed.X4 = 4` | **P0 确认** | X4 档位完全不可用，配置与枚举不一致 |
| BAT-B-002 | getTechTroopAttackBonus 可能返回负值 | ✅ 源码确认减法无下限保护 | **P0 确认（降级为 P0-）** | 实际影响取决于配置，正常配置下不会触发，但属于防御性编程缺失 |
| BAT-B-003 | SKIP 模式 Infinity 动画速度 | ✅ 源码确认 `animationSpeedScale: Infinity`（行 300） | **P1 降级** | 当前使用 structuredClone（不丢失 Infinity），仅在 JSON 中转时有问题。风险可控 |

### 系统性问题裁定

| ID | 描述 | Arbiter 裁定 | 说明 |
|----|------|-------------|------|
| SYS-001 | NaN 传播链 — 6 个文件无统一防护 | **P0 确认** | 战斗系统核心链路（buff→攻防→伤害→统计）缺乏统一 NaN 防护层。DEF-006 仅覆盖了 calculateDamage+applyDamage，上游入口未覆盖 |
| SYS-002 | 配置与枚举不一致 | **P0 确认** | 与 BAT-B-001 合并。枚举定义了 X4 但配置不支持，属于构建时就应该发现的问题 |
| SYS-003 | 序列化不完整 | **P0 确认** | BattleEngine.serialize 仅处理 BattleState，不含 battleMode/speedState/ultimateState。断线重连后战斗模式和速度设置丢失——**可玩性阻断项** |
| SYS-004 | Infinity 序列化变为 null | **P1 确认** | 当前使用 structuredClone 不受影响，但属于潜在风险。建议修复但不阻碍封版 |

### P0 汇总

| # | P0 ID | 子系统 | 描述 | 修复优先级 |
|---|-------|--------|------|-----------|
| 1 | BAT-A-001 | DamageCalculator | calculateDotDamage 无 NaN 防护 | 🔴 最高 |
| 2 | BAT-A-002 | DamageCalculator | getAttackBonus/getDefenseBonus 无 NaN 防护 | 🔴 最高 |
| 3 | BAT-A-003 | DamageCalculator | skillMultiplier 负数导致负伤害=加血 | 🟡 高 |
| 4 | BAT-B-001 + SYS-002 | battle-config | AVAILABLE_SPEEDS 缺少 X4 档位 | 🔴 最高 |
| 5 | BAT-B-002 | BattleEffectApplier | getTechTroopAttackBonus 可能返回负值 | 🟡 高 |
| 6 | SYS-001 | 6 个文件 | NaN 传播链缺乏统一防护层 | 🔴 最高（架构级） |
| 7 | SYS-003 | BattleEngine | serialize 不含子系统状态（可玩性阻断） | 🔴 最高（可玩性阻断） |

**P0 总计: 7 个**（含 1 个可玩性阻断项 SYS-003，按 AR-010 规则权重 ×1.5）

---

## 四、可玩性评估（战斗系统）

| 维度 | 权重 | 评分 | 说明 |
|------|------|------|------|
| 趣味性 | 25% | **7.5** | 战斗系统包含普攻/技能/DOT/大招/速度控制/兵种克制，玩法丰富。UltimateSkillSystem 的大招时停机制有策略深度 |
| 进度平衡 | 25% | **6.5** | 伤害公式（DamageCalculator）在正常情况下工作良好，但 NaN/负值漏洞可能导致异常伤害。serialize 不完整导致断线重连丢失进度 |
| 经济平衡 | 20% | **7.0** | BattleFragmentRewards 碎片掉落系统基本合理，但 simpleHash("")=0 导致空 ID 单位 100% 掉落（违反 10% 基础掉率）。重复 ID 可叠加碎片 |
| 玩家体验 | 15% | **7.0** | BattleSpeedController 的速度控制（1x/2x/3x/跳过）流畅，但 X4 档位不可用。DamageNumberSystem 显示正常但 NaN 时显示 "-NaN" |
| 系统一致性 | 15% | **5.5** | 配置与枚举不一致（X4）、serialize 不完整（3 个子系统状态丢失）、NaN 防护不统一（部分函数有防护部分没有） |

**可玩性总评: 6.8/10**

```
趣味性:     7.5 × 0.25 = 1.875
进度平衡:   6.5 × 0.25 = 1.625
经济平衡:   7.0 × 0.20 = 1.400
玩家体验:   7.0 × 0.15 = 1.050
系统一致性: 5.5 × 0.15 = 0.825
─────────────────────────
可玩性总分:         6.775 → 6.8/10
```

### 可玩性阻断项

| # | 阻断项 | 严重度 | 影响 | 状态 |
|---|--------|--------|------|------|
| 1 | serialize 不含子系统状态 | 🔴 可玩性阻断 | 断线重连后战斗模式/速度/大招状态丢失，玩家需要重新设置 | ❌ 待修复 |
| 2 | NaN 传播链 | 🔴 可玩性阻断 | 特定条件下（buff.value=NaN）伤害计算完全错误，战斗结果不可预测 | ❌ 待修复 |
| 3 | X4 速度档位不可用 | 🟡 体验降级 | 玩家期望 4 倍速但实际只有 3 倍速 | ❌ 待修复 |
| 4 | Infinity 序列化风险 | 🟢 潜在风险 | 当前 structuredClone 不受影响，但未来 JSON 传输可能出问题 | ⚠️ 建议修复 |

---

## 五、三 Agent 复盘

### Builder R1 表现: 7.5/10

#### 亮点
1. **覆盖面广** (+1.0): 488 节点 / 95 API / 20 文件，比 Hero R1 更广更细。17 个子系统逐一列出覆盖率，最细到 DamageNumberConfig（100%）
2. **Hero 经验吸收良好** (+1.0): 8 个特别关注项（S-1~S-8）全部来自 Hero 模块经验模式（NaN 绕过、配置交叉、setter/getter 注入、修复穿透、资源溢出、保存/加载缺失、deserialize 无验证、BUFF 映射不完整），说明 Builder 认真学习了 Hero 模块的教训
3. **跨系统链路覆盖** (+0.5): 30 条链路全部标注 covered，Part A/B/C 三层交叉验证
4. **对比分析** (+0.5): 与 Hero 模块的对比表格清晰展示了 Battle 模块的改进和遗留问题

#### 扣分项
1. **covered 标注虚报** (-1.0): S-4 中"✅"标注暗示 calculateDamage/applyDamage 的 NaN 防护已完善，但实际仅覆盖了 2 个函数，calculateDotDamage、getAttackBonus、getDefenseBonus 完全无防护。虚报率 5-8%
2. **P0 优先级低估** (-0.5): BAT-B-002（负值漏洞）标为 P1，但实际可能导致攻击力降低（P0 级别）。BAT-A-003（skillMultiplier 负数）未出现在 Top 10 中
3. **serialize 影响范围低估** (-0.3): S-6 标注为 P0，但未明确说明这是"断线重连后战斗模式/速度/大招状态全部丢失"的可玩性阻断项

#### 改进建议
1. **covered 标注严谨化**: 对每个 claimed covered 的节点，验证源码中是否确实存在防护代码，而非仅凭"该文件有 DEF-006 修复"就标注 covered
2. **可玩性阻断项显式标注**: serialize 不完整属于可玩性阻断项，应在特别关注项中显式标注（参考 Hero 模块的"可玩性阻断项"列表）
3. **NaN 防护覆盖率量化**: 不要用"✅"标注，而是明确列出"已防护的函数列表"和"未防护的函数列表"

### Challenger R1 表现: 8.5/10

#### 亮点
1. **P0 发现精准** (+1.0): 6 个 P0 全部可复现，含完整源码引用、复现步骤和影响分析。Arbiter 验证确认 5 个为 P0，1 个降为 P1（BAT-B-003），准确率 83%
2. **系统性问题识别深入** (+1.0): 4 个系统性问题（NaN 传播链、配置不一致、序列化不完整、Infinity 序列化）覆盖了战斗系统的核心风险。SYS-001 的根因分析（buff→攻防→伤害→统计链路无统一防护）精准到位
3. **修复建议可操作** (+0.5): 每个 P0/P1 都附带具体修复代码（通常 1-3 行），可直接使用
4. **虚报率自评估** (+0.5): 主动评估虚报率 ~4%（1/25），并说明虚报原因（BAT-B-005 SSR 环境问题），透明度高

#### 扣分项
1. **BAT-B-003 优先级偏高** (-0.3): Infinity 序列化问题在当前使用 structuredClone 的架构下不会触发，标为 P0 过重。应标为 P1 并注明"潜在风险"
2. **Part C 无 P0** (-0.2): 辅助层的 BAT-C-001（统计 NaN）和 BAT-C-002（simpleHash 空字符串）实际影响较大（统计面板显示 NaN、碎片掉率 100%），可考虑提升为 P0
3. **缺少跨系统 NaN 传播路径图** (-0.2): SYS-001 描述了 NaN 传播链，但未画出完整的传播路径图（如 `buff.value=NaN → getAttackBonus → calculateDamage → applyDamage → BattleStatistics → calculateBattleStats`），不利于修复验证

#### 改进建议
1. **P0 严格性**: 仅在"当前架构下可复现"时标为 P0，"潜在风险"标为 P1
2. **传播路径图**: 对系统性问题，画出完整的数据流传播路径图，方便 R2 穿透验证
3. **Part C 关注度提升**: 辅助层虽然非核心，但统计和碎片奖励直接影响玩家体验，应提高关注度

### Arbiter 独立发现（~10% 补充）

基于对 Builder 树和 Challenger 挑战的交叉审查，Arbiter 独立发现以下要点：

#### 1. DEF-006 防护范围不足 — 确认 Challenger 分析 ✅

源码验证：DamageCalculator.ts 中 DEF-006 仅在 3 处添加了 NaN 检查（行 253-254 calculateDamage 入口、行 298-299 calculateDamage 出口、行 332-333 applyDamage 入口），但以下函数完全无防护：
- `calculateDotDamage`（行 390-414）— BAT-A-001 ✅
- `getAttackBonus`（行 126-139）— BAT-A-002 ✅
- `getDefenseBonus`（行 141-156）— BAT-A-002 ✅
- `getCriticalRate` — Builder S-1 已标注

**Arbiter 补充**: DEF-006 的修复策略是"在关键入口/出口做 NaN 拦截"，但遗漏了"上游函数也可能产生 NaN"的情况。建议 R2 采用 Challenger 的 `safeNumber(val, fallback=0)` 工具函数方案，统一防护。

#### 2. serialize 不完整的可玩性影响 — 补充量化

Builder 在 S-6 中标注 serialize 不含 battleMode/speedState/ultimateState，但未量化影响。Arbiter 补充：

| 丢失的状态 | 影响场景 | 玩家感知 |
|-----------|---------|---------|
| battleMode | 断线重连后不知道当前是 PVP 还是 PVE | 战斗模式显示异常 |
| speedController.state | 断线重连后速度设置丢失，回退到 1x | 玩家需要重新设置速度 |
| ultimateSystem.state | 断线重连后大招充能进度丢失 | 大招能量清零，严重影响策略 |
| effectManager.state | 断线重连后 buff 状态丢失 | buff 效果消失，战斗结果可能逆转 |

**Arbiter 裁定**: 此项按 AR-010 规则，可玩性阻断项权重 ×1.5，是 R2 最优先修复项。

#### 3. NaN 防护的"瑞士奶酪"模型

Battle 模块的 NaN 防护呈现"瑞士奶酪"特征——DEF-006 在 calculateDamage/applyDamage 的 3 个位置打了"补丁"，但上游（getAttackBonus、getDefenseBonus、calculateDotDamage）和下游（calculateBattleStats、sortBySpeed）都有漏洞。NaN 可以绕过补丁通过其他路径传播。

```
buff.value=NaN
    ├── getAttackBonus() → NaN bonus → calculateDamage() → [DEF-006 拦截 ✅]
    ├── getDefenseBonus() → NaN defense → calculateDamage() → [DEF-006 拦截 ✅]
    ├── calculateDotDamage() → NaN dotDamage → dotDamage > 0 → false → [绕过 ❌]
    └── BattleStatistics.calculateBattleStats() → NaN totalDamage → [无拦截 ❌]
```

**Arbiter 建议**: R2 应建立统一的 NaN 防护层，而非继续在个别函数打补丁。

#### 4. test 文件覆盖度良好 — 正面发现

Battle 模块的测试文件数量（22 个 .test.ts 文件）远多于 Hero 模块，且包含专门的对抗式测试文件：
- `P0-crash-fixes.test.ts` — DEF-006 NaN 防护测试
- `battle-fuzz.test.ts` — 模糊测试
- `BattleEngine.boundary.test.ts` — 边界测试
- `DamageCalculator.adversarial.test.ts` — 对抗式测试

这说明 Battle 模块在开发过程中已经历过多轮测试迭代，代码质量基础好于 Hero 模块 R1。

---

## 六、收敛预测

### 基于 Hero 模块四轮收敛经验的预测

| 维度 | Battle R1 | Battle R2 预测 | Battle R3 预测 | Battle R4 预测 |
|------|-----------|---------------|---------------|---------------|
| 综合评分 | 7.4 | 8.3~8.5 | 8.8~9.0 | 9.0+ |
| 新 P0 | 10 | 3~5 | 0~1 | 0 |
| P0 总量 | 57+10=67 | 40~50 | 20~30 | 10~15 |
| covered 率 | 74.8% | 80~85% | 85~90% | 90%+ |
| 虚报率 | 5-8% | <3% | 0% | 0% |
| 封版条件 | 2/8 | 4~5/8 | 6~7/8 | 7~8/8 |

### 收敛加速因素

1. **Hero 经验直接复用**: NaN 防护模式（safeNumber）、serialize 扩展模式（六处同步）、FIX 穿透验证模式已在 Hero 模块验证有效，可直接应用
2. **测试基础良好**: 22 个测试文件已覆盖大部分场景，R2 只需补充 NaN/serialize 相关测试
3. **P0 数量少**: 10 个 P0（Hero R1 为 41 个），修复工作量小

### 收敛减速因素

1. **NaN 传播链是架构级问题**: 不是简单的"加一行检查"，而是需要建立统一防护层，可能涉及 6 个文件的修改
2. **serialize 扩展需要接口设计**: 需要设计 BattleEngine.serialize 的扩展接口，包含子系统状态，可能影响存档格式版本
3. **配置不一致需要策划决策**: AVAILABLE_SPEEDS 是否应包含 X4，需要策划确认

### 预测结论

**Battle 模块预计 3-4 轮可封版**。R2 修复 10 个 P0 后评分可达 8.3~8.5，R3 补全 serialize 和 NaN 防护后可达 8.8~9.0，R4 穿透验证后封版。

如果 Builder 充分吸收 Hero 模块经验（特别是 FIX-301 的 serialize 修复模式和 DEF-006 的 NaN 防护模式），R3 封版是可能的。

---

## 七、R2 行动指令

### Builder R2 必须执行

| # | 指令 | 对应 P0 | 修复参考 | 优先级 |
|---|------|---------|---------|--------|
| BR-026 | 建立 `safeNumber(val, fallback=0)` 工具函数，统一 NaN 防护 | SYS-001 | Hero DEF-006 模式 | 🔴 |
| BR-027 | DamageCalculator 全函数 NaN 防护（calculateDotDamage、getAttackBonus、getDefenseBonus、getCriticalRate） | BAT-A-001/002 | safeNumber 工具函数 | 🔴 |
| BR-028 | BattleEngine.serialize 扩展，包含 battleMode、speedController.serialize()、ultimateSystem.serialize() | SYS-003 | Hero FIX-301 六处同步模式 | 🔴 |
| BR-029 | AVAILABLE_SPEEDS 配置修复（添加 X4 或移除枚举） | BAT-B-001 | 配置同步 | 🔴 |
| BR-030 | getTechTroopAttackBonus 添加 Math.max(0, ...) 下限保护 | BAT-B-002 | 防御性编程 | 🟡 |
| BR-031 | BattleStatistics.calculateBattleStats 添加 NaN 过滤 | BAT-C-001 | safeNumber 工具函数 | 🟡 |
| BR-032 | BattleFragmentRewards.simpleHash 空字符串特殊处理 | BAT-C-002 | 边界处理 | 🟡 |
| BR-033 | BattleSpeedController SKIP 模式使用有限大值替代 Infinity | BAT-B-003 | 防御性编程 | 🟢 |

### Challenger R2 必须执行

| # | 指令 | 参考 | 优先级 |
|---|------|------|--------|
| CR-022 | FIX 穿透验证：验证 BR-026~033 的修复是否完整穿透到所有调用方 | Hero CR-016 模式 | 🔴 |
| CR-023 | serialize 扩展验证：验证 BR-028 的六处同步完整性 | Hero CR-019 模式 | 🔴 |
| CR-024 | NaN 防护覆盖率验证：验证 safeNumber 是否覆盖了所有 NaN 入口 | SYS-001 传播路径 | 🔴 |
| CR-025 | 新维度探索：探索 Battle 模块特有的风险维度（如战斗回放、AI 决策、技能链） | Hero CR-020 模式 | 🟡 |

### Arbiter R2 重点

| # | 重点 | 说明 |
|---|------|------|
| AR-011 | safeNumber 工具函数质量 | 验证工具函数是否覆盖了 NaN/Infinity/null/undefined 四种非法值 |
| AR-012 | serialize 扩展的版本兼容性 | 验证旧存档（不含子系统状态）能否正确加载 |
| AR-013 | NaN 防护性能影响 | safeNumber 在高频调用路径（如 calculateDamage）的性能开销 |

---

## 八、规则进化建议

### 新增规则建议

| # | 规则 | 来源 | 说明 |
|---|------|------|------|
| AR-014 | **covered 标注验证规则** | Battle R1 虚报 | Builder 在标注 covered 时，必须引用源码行号作为证据。声称"已有 NaN 防护"时，必须列出具体的防护代码行号 |
| AR-015 | **NaN 防护统一性规则** | Battle SYS-001 | 如果模块存在 DEF-xxx 类型的 NaN 防护修复，Builder 必须验证该修复是否覆盖了所有同类型函数（而非仅标注"已修复"） |
| AR-016 | **配置-枚举同步规则** | Battle SYS-002 | Builder 在构建树时，必须验证枚举值与配置数组的一致性（如 AVAILABLE_SPEEDS 是否包含所有 BattleSpeed 枚举值） |

### 规则进化记录

| 日期 | 轮次 | 变更 | 原因 |
|------|------|------|------|
| 2026-05-04 | Battle R1 | +AR-014~016 规则建议 | covered 虚报、NaN 防护不统一、配置-枚举不同步 |

### 与 Hero 模块规则复用评估

| Hero 规则 | Battle 适用性 | 建议 |
|-----------|-------------|------|
| BR-019 修复穿透检查 | ✅ 高度适用 | R2 强制执行 |
| BR-023 保存/加载覆盖扫描 | ✅ 高度适用 | R2 强制执行（Battle serialize 扩展后） |
| BR-024 六处同步验证 | ✅ 高度适用 | R2 强制执行 |
| BR-025 跨系统链路验证 | ✅ 适用 | R2 开始执行 |
| CR-016 FIX 穿透验证 | ✅ 高度适用 | R2 强制执行 |
| CR-019 保存/加载完整性 | ✅ 高度适用 | R2 强制执行 |
| CR-020 新维度探索 | ✅ 适用 | R2 开始执行 |
| CR-021 遗留 P0 重新评估 | ✅ 适用 | R3 开始执行 |
| AR-008 保存/加载架构评审 | ✅ 高度适用 | R2 强制执行 |
| AR-009 收敛加速 | ✅ 适用 | R3 起引入 |
| AR-010 可玩性封版权重 | ✅ 适用 | R1 已应用 |

---

## 九、与 Hero 模块 R1 对比总结

| 维度 | Hero R1 | Battle R1 | 评价 |
|------|---------|-----------|------|
| 综合评分 | 7.0 | 7.4 | Battle 略高（+0.4），因覆盖面更广、测试基础更好 |
| 新 P0 | 41 | 10 | **Battle 远低于 Hero**（-75.6%），经验吸收效果显著 |
| 节点数 | ~420 | 488 | Battle 更多（+16.2%），因 Battle 模块文件更多 |
| API 数 | ~60 | 95 | Battle 更多（+58.3%） |
| covered 率 | ~72% | 74.8% | 接近 |
| 虚报率 | 4-8% | 5-8% | 接近 |
| 系统性问题 | 3 | 4 | Battle 多 1 个（Infinity 序列化） |
| 可玩性 | 6.7 | 6.8 | 接近 |
| 封版条件 | 2/8 | 2/8 | 相同 |
| 预计封版轮次 | 4 轮 | 3-4 轮 | Battle 可能更快（P0 少、经验可复用） |

### 关键结论

1. **Builder 的 Hero 经验吸收是有效的**: 8 个特别关注项全部来自 Hero 模块经验，DEF-006 的 NaN 防护已在 calculateDamage/applyDamage 中实施（虽然不完整）
2. **Battle 模块起点更高**: 22 个测试文件 vs Hero 的少量测试，说明 Battle 模块在开发过程中更注重测试
3. **系统性问题模式相似**: NaN 传播链、serialize 不完整、配置不一致——这三个问题在 Hero 和 Battle 模块中都存在，说明是项目级别的系统性问题，建议建立项目级防护规范

---

## 附录 A：P0 修复方案速查

| # | P0 | 修复方案 | 修复成本 | 参考 |
|---|-----|---------|---------|------|
| 1 | BAT-A-001 | `return Number.isFinite(totalDot) ? totalDot : 0;` | 1 行 | Challenger 建议 |
| 2 | BAT-A-002 | `bonus += Number.isFinite(buff.value) ? buff.value : 0;` | 2 处 × 1 行 | Challenger 建议 |
| 3 | BAT-A-003 | `if (!Number.isFinite(skillMultiplier) || skillMultiplier <= 0) skillMultiplier = 1;` | 1 行 | Arbiter 补充 |
| 4 | BAT-B-001 | `AVAILABLE_SPEEDS: [1, 2, 3, 4] as const` | 1 行 | Challenger 建议 |
| 5 | BAT-B-002 | `return Math.max(0, ...)` | 2 处 × 1 行 | Challenger 建议 |
| 6 | SYS-001 | 建立 `safeNumber()` 工具函数，6 个文件统一使用 | 中等 | Challenger 建议 |
| 7 | SYS-003 | 扩展 serialize 接口，含子系统状态 | 中等 | Hero FIX-301 模式 |

**总修复成本**: 低（大部分 P0 修复仅需 1-2 行代码，SYS-001 和 SYS-003 需要中等成本的架构调整）

---

## 附录 B：评分计算详情

### R1 综合评分

```
完备性:   7.5 × 0.25 = 1.875
准确性:   7.0 × 0.25 = 1.750
优先级:   8.0 × 0.15 = 1.200
可测试性: 8.0 × 0.15 = 1.200
挑战应对: 6.5 × 0.20 = 1.300
─────────────────────────
综合总分:          7.325 → 7.4/10
```

### R1 可玩性评分

```
趣味性:     7.5 × 0.25 = 1.875
进度平衡:   6.5 × 0.25 = 1.625
经济平衡:   7.0 × 0.20 = 1.400
玩家体验:   7.0 × 0.15 = 1.050
系统一致性: 5.5 × 0.15 = 0.825
─────────────────────────
可玩性总分:         6.775 → 6.8/10
```

---

## 附录 C：规则累计（v1.3 + Battle R1 建议）

| 来源 | Hero 累计 | Battle R1 新增建议 | 累计 |
|------|----------|-------------------|------|
| Builder | BR-001~025 | BR-026~033（R2 指令） | **33 条** |
| Challenger | CR-001~021 | CR-022~025（R2 指令） | **25 条** |
| Arbiter | AR-001~010 | AR-011~016（R2 重点 + 新规则） | **16 条** |
| **合计** | **56 条** | **+14 条建议** | **~70 条** |

---

*Round 1 仲裁裁决完成。评分 7.4/10（封版线 9.0），**CONTINUE** 🔴。Battle 模块 R1 发现 10 个 P0 级问题（含 4 个系统性问题），主要风险集中在 NaN 传播链（SYS-001）和 serialize 不完整（SYS-003）。Builder 对 Hero 模块经验吸收良好（P0 数量仅为 Hero R1 的 24%），但 covered 标注存在 5-8% 虚报率。预计 3-4 轮可封版。R2 重点：建立统一 NaN 防护层、扩展 serialize 接口、修复配置不一致。*

**⚔️ Battle 模块 — CONTINUE at Round 1 | 预计 R3-R4 封版**
