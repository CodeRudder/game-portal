# Integrator 核验集成报告 (R2)

> **核验角色**: Integrator（集成检查员）
> **核验日期**: 2026-05-05
> **核验范围**: FL-MAP-01 ~ FL-MAP-18 全部18个流程 + types/map-interfaces.md + INDEX.md
> **核心问题**: "三方发现拼在一起，哪里对不上/漏掉了？R2修复是否引入了新问题？"
> **输入来源**: User Proxy R2 核验报告 + Dev Proxy R2 核验报告 + Integrator 自有交叉验证

---

## 发现汇总

| 优先级 | 数量 | 描述 |
|:------:|:----:|------|
| P0 | 0 | 无阻断性问题 |
| P1 | 2 | 跨流程矛盾和内部自相矛盾 |
| P2 | 4 | 细化不足/一致性缺失 |
| P3 | 3 | 信息更新/文档维护 |
| 已验证修复 | 4 | R2 issues.md 中已过时的条目，实际文档已修复 |

---

## Integrator 自有发现

### INT-R2-V01 | 攻城撤退伤亡规则 FL-MAP-09 内部自相矛盾

**检查项**: 攻城撤退政策跨步骤/跨子流程一致性
**关联流程**: FL-MAP-09 Stage P8 + FL-MAP-09-08 状态机 + FL-MAP-09-12 结算
**矛盾描述**: FL-MAP-09 内部对 sieging 阶段主动撤退的伤亡处理存在 3 种不同说法：

| 位置 | 描述 | 伤亡 |
|------|------|------|
| Stage P8 战斗结束分支表（L376） | "中断，50%粮草/道具退还，**兵力保留**" | 0%（兵力全保留） |
| Stage P8 撤退 tooltip（L383） | "确认撤退？将**损失约 20%~40% 兵力**" | 20%~40% |
| FL-MAP-09-08 状态机注释（L572） | "撤退也经过 settling（计算撤退伤亡，默认为 defeat 级别：**20%~40% 兵力损失**）" | 20%~40% |
| FL-MAP-09-12 V-032（L641） | "城防剩余<30%=**20%~40%**，城防剩余>=30%=**50%~80%**" | 20%~80%（按城防比例） |

这 4 处说法互相冲突。"兵力保留" 与 "20%~40% 损失" 是 0% vs 20%~40% 的矛盾；"20%~40%" 与 "50%~80%" 是损失幅度的矛盾。实施者无法确定撤退时到底扣不扣兵力、扣多少。

**需修正内容**: 统一撤退伤亡规则。建议以 V-032（按城防剩余比例区分）为权威版本，同步更新：
1. Stage P8 战斗结束分支表：将"兵力保留"改为"按V-032伤亡规则结算"
2. Stage P8 tooltip：改为"确认撤退？可能损失 20%~80% 兵力（视城防剩余比例）"
3. FL-MAP-09-08 状态机注释：引用 V-032 而非固定"defeat 级别"
4. Stage P8 统一取消规则表（L492）：同步更新

**优先级**: P1
**与 User Proxy 发现3 的关系**: UP-Finding3 仅指出 tooltip 文案与 P0-V07 规则矛盾，建议拆分 tooltip。但实际矛盾范围远大于 tooltip -- 是整个撤退机制的自相矛盾。INT-R2-V01 为更全面的发现，包含 UP-Finding3。

---

### INT-R2-V02 | FL-MAP-08 S1 胜利→驻防过渡已修复但 P0-M-02 未关闭

**检查项**: R2 issues.md 与实际文档状态同步
**关联流程**: FL-MAP-08 S1 + FL-MAP-07 S8 + FL-MAP-09 P9
**描述**: R2 issues.md 中 P0-M-02 声明"胜利后多信息同时弹出可能压垮玩家"为待修复 P0。但实际文档中：
1. FL-MAP-08 S1（L77）已包含 `[P1-R2-VERIFY-02]` 从胜利弹窗进入的完整过渡说明
2. FL-MAP-07 S8 和 FL-MAP-09 P9 已有分步信息展示时序（先弹窗 → 延迟 Toast → 内嵌警告）
3. User Proxy 验证报告 Finding 2 仍标记为 P1（胜利→驻防过渡行为需明确），但实际上 FL-MAP-08 S1 已补充了过渡说明

**需修正内容**: P0-M-02 应标记为已修复（R2-Step2 中修复）。UP-Finding2 发现的过渡问题也已由 `[P1-R2-VERIFY-02]` 覆盖，应关闭或降级为 P3（仅需确认措辞精确性）。

**优先级**: P2（issues.md 维护问题，非流程缺陷）

---

### INT-R2-V03 | INDEX.md 版本标签未更新至 R2 状态

**检查项**: INDEX.md 元数据准确性
**关联流程**: INDEX.md
**描述**: INDEX.md 头部仍显示：
- `版本: v2.1 (R1完成)`
- `状态: R1有条件完成（3个P0推迟R2）`
- `达标率: 176/180 = 97.8%`

但 R2 完整性检查显示 10 维度达标率 180/180（100%），R2 修复了全部 3 个 R1 遗留 P0。标签应更新为 R2 状态。

**需修正内容**: 更新 INDEX.md 头部元数据为 `v3.0 (R2完成)`，达标率 `180/180 (100%)`，R2 待补充清单标注完成状态。

**优先级**: P3

---

### INT-R2-V04 | R2 issues.md 中 SiegeStrategy 键不匹配已修复

**检查项**: Dev Proxy Finding #1 当前状态
**关联流程**: types/map-interfaces.md
**描述**: Dev Proxy 验证报告 Finding #1 标记为 P1："SiegeStrategy type key mismatch"。但实际 types/map-interfaces.md 第32-43行中，两个 Record 常量已使用与 SiegeStrategy 类型匹配的键（`assault/surround/night_raid/insider`），并有 `[P1-fix]` 注释。此问题在 R2-Step2 修复周期中已解决。

**需修正内容**: Dev Proxy Finding #1 应从 issues.md P1 列表中移除或标记为已修复。

**优先级**: P3（issues.md 维护）

---

### INT-R2-V05 | R2 issues.md 中 Version 常量类型不匹配已修复

**检查项**: Dev Proxy Finding #3 当前状态
**关联流程**: types/map-interfaces.md
**描述**: Dev Proxy 验证报告 Finding #3 标记为 P1："Version field type mismatch"。但实际 types/map-interfaces.md 第512行已统一为 `CURRENT_MAP_GAME_STATE_VERSION = '1.0'`（字符串类型），与 `MapGameState.version: string` 一致。此问题在 R2-Step2 修复周期中已解决。

**需修正内容**: Dev Proxy Finding #3 应从 issues.md P1 列表中移除或标记为已修复。

**优先级**: P3（issues.md 维护）

---

### INT-R2-V06 | FL-MAP-08 放弃领土回收比例已统一为 70%/30%

**检查项**: Dev Proxy Finding #2 当前状态
**关联流程**: FL-MAP-08-01 S3 + 全局兵力池分配规则表
**描述**: Dev Proxy 验证报告 Finding #2 标记为 P1："Territory abandon recovery ratio contradiction (60% vs 70%)"。但实际 FL-MAP-08 文件中：
- S3（L182）："回收比例: 驻防兵力的 70% 归还全局兵力池（unallocated），30% 损失（V-057修复）"
- 兵力池分配规则表（L218）："放弃领土 unallocated += 驻防 x 70%（V-057修复：部分比例=70%）"

两处已完全一致，均为 70%/30%，无 60%/40% 残留。Dev Proxy 可能在编写报告时看到了修复前的缓存版本。此问题实际已解决。

**需修正内容**: Dev Proxy Finding #2 应从 issues.md P1 列表中移除或标记为已修复。

**优先级**: P3（issues.md 维护）

---

### INT-R2-V07 | P0-M-01 攻城撤退按钮位置已定义

**检查项**: R2 issues.md P0-M-01 与实际文档同步
**关联流程**: FL-MAP-09 Stage P8
**描述**: R2 issues.md 中 P0-M-01 声明"攻城战斗中玩家主动撤退的按钮位置未定义"为待修复 P0。但实际 FL-MAP-09 Stage P8（L380-384）已包含完整的撤退按钮定义：
- 位置：攻城覆盖层左下角，紧邻底部进度条左侧
- 视觉样式：红色按钮"撤退"，80x36px，确认对话框交互
- 出现时机：攻城开始后第 5 秒起可点击
- 标注为 `[R2-Step2]` 修复

此问题在 R2-Step2 中已修复。

**需修正内容**: P0-M-01 应标记为已修复。

**优先级**: P2（issues.md 维护）

---

### INT-R2-V08 | 跨流程引用 INDEX.md 与 FL-MAP-09 P9 结算序列同步验证

**检查项**: FL-MAP-09 P9 结算后执行序列与其他流程衔接
**关联流程**: FL-MAP-09 P9 → FL-MAP-11/FL-MAP-08/FL-MAP-17/FL-MAP-16
**描述**: FL-MAP-09 P9 结算后执行序列（L92-108）定义了完整的后结算步骤链。交叉验证：
1. 步骤1-3（动画+伤亡+编队状态）→ 与 FL-MAP-17 伤亡系统一致 ✓
2. 步骤4-5（编队销毁+回城行军）→ 与 FL-MAP-16 编队映射表一致 ✓
3. 步骤6-7（奖励生成+自动驻防）→ 与 FL-MAP-11 PendingReward 一致 ✓
4. 步骤7 驻防 → FL-MAP-08 S1 `[P1-R2-VERIFY-02]` 已定义过渡 ✓

整体衔接正确。唯一问题为 INT-R2-V01 中的撤退伤亡矛盾。

**优先级**: P2（确认衔接正确，附带撤退伤亡标注问题）

---

### INT-R2-V09 | map-interfaces.md 策略修正常量表与中文术语表命名映射缺失

**检查项**: 策略命名跨文档一致性
**关联流程**: types/map-interfaces.md + FL-MAP-09 Stage P4
**描述**: map-interfaces.md 底部的"策略修正系数常量表"使用中英双语标注（如 "强攻 (assault)"），FL-MAP-09 Stage P4 使用中文（强攻/围困/夜袭/内应），TypeScript 代码使用英文（assault/surround/night_raid/insider）。三者虽然值一致，但缺少一个权威的中文名 → 英文 key → 显示名的映射表。Dev Proxy Finding #12 提出同样问题（标记为 P3）。

**需修正内容**: 在 map-interfaces.md 策略修正常量表顶部添加一个简短的映射表：强攻↔assault, 围困↔surround, 夜袭↔night_raid, 内应↔insider。

**优先级**: P2

---

## 三方合并去重表

### 已验证为已修复（从 P1 降级为已关闭）

| 原编号 | 原来源 | 原描述 | 当前状态 | 处理建议 |
|--------|--------|--------|----------|---------|
| DP-Finding-1 | Dev Proxy P1 | SiegeStrategy type key mismatch | **已修复** - keys aligned with `[P1-fix]` | 关闭 |
| DP-Finding-2 | Dev Proxy P1 | Territory abandon 60% vs 70% | **已修复** - 统一为70%/30% (V-057) | 关闭 |
| DP-Finding-3 | Dev Proxy P1 | Version field type mismatch | **已修复** - unified to string '1.0' | 关闭 |
| P0-M-01 | issues.md P0 | 撤退按钮位置未定义 | **已修复** - [R2-Step2] 完整定义 | 关闭 |
| P0-M-02 | issues.md P0 | 胜利后多信息弹出 | **已修复** - 时序+过渡已定义 | 关闭 |

### 去重合并（三方发现重叠）

| Integrator 发现 | User Proxy 对应 | Dev Proxy 对应 | 处理 |
|-----------------|----------------|---------------|------|
| INT-R2-V01（撤退伤亡矛盾） | UP-Finding3（撤退 tooltip 误导） | 无 | INT-R2-V01 覆盖 UP-Finding3，保留 INT 版本（更全面） |
| INT-R2-V02（P0-M-02 已修复） | UP-Finding2（胜利→驻防过渡） | 无 | 标记 P0-M-02 已关闭，UP-Finding2 降为 P3（仅措辞优化） |
| INT-R2-V09（策略命名映射） | 无 | DP-Finding-12（策略命名不一致 P3） | 合并，升级为 P2 |
| INT-R2-V07（P0-M-01 已修复） | 无 | 无 | P0-M-01 标记已关闭 |

### 新发现（Integrator 独有）

| 编号 | 优先级 | 描述 |
|------|:------:|------|
| INT-R2-V01 | P1 | 攻城撤退伤亡规则 FL-MAP-09 内部 4 处自相矛盾 |
| INT-R2-V08 | P2 | P9 结算序列衔接验证通过（附带撤退伤亡标注问题） |
| INT-R2-V09 | P2 | 策略修正常量表缺少中文↔英文映射 |

### User Proxy 独有（未与 Integrator 重叠）

| 编号 | 优先级 | 描述 | Integrator 评估 |
|------|:------:|------|----------------|
| UP-Finding1 | P1 | 加载超时弹窗缺少进度百分比 | 认可，保留为 P1 |
| UP-Finding4 | P2 | FL-MAP-13 数据时效性指示缺少用户感知 | 认可，保留为 P2 |
| UP-Finding5 | P2 | FL-MAP-08-01 AI 不受放弃冷却限制风险 | 认可，保留为 P2 |
| UP-Finding6 | P2 | FL-MAP-12-02 事件战斗兵力来源公式不同 | 认可，保留为 P2 |
| UP-Finding7 | P3 | 新手引导步骤3跳过缺少用户感知 | 认可，保留为 P3 |
| UP-Finding8 | P3 | Bottom Sheet 关闭确认未区分模态类型 | 认可，保留为 P3 |

### Dev Proxy 独有（未与 Integrator 重叠）

| 编号 | 优先级 | 描述 | Integrator 评估 |
|------|:------:|------|----------------|
| DP-Finding-4 | P2 | 粮草消耗公式 map-interfaces vs FL-MAP-09 不一致 | 认可，保留为 P2 |
| DP-Finding-5 | P2 | 征服 vs 攻城伤亡最低损失不一致 | 认可，保留为 P2（已由 P1-R2-04 缓解） |
| DP-Finding-6 | P2 | 雪地地形移动成本未定义 | 认可，保留为 P2 |
| DP-Finding-7 | P2 | 地形调色板缺少雪地 | 认可，保留为 P2 |
| DP-Finding-8 | P2 | 城防初始值公式两个版本 | 认可，保留为 P2 |
| DP-Finding-9 | P3 | 新手引导步骤2将领分配不明确 | 认可，保留为 P3 |
| DP-Finding-10 | P3 | 兵力池补充时机未定义 | 认可，保留为 P3 |
| DP-Finding-11 | P3 | 侦查操作无对应流程 | 认可，保留为 P3 |

---

## 索引完整性验证

### INDEX.md 子流程索引 vs 实际文件

| INDEX.md 声明 | 实际文件 | 一致性 |
|--------------|---------|:------:|
| FL-MAP-01-01 新手引导 | FL-MAP-01 SP01 | ✓ |
| FL-MAP-01-02 产出上限机制 | FL-MAP-01 SP02 | ✓ |
| FL-MAP-09-01~15 攻城战子流程 | FL-MAP-09 内15个子流程 | ✓ |
| FL-MAP-11-01~05 奖励子流程 | FL-MAP-11 内5个子流程 | ✓ |
| FL-MAP-12-01/02 事件子流程 | FL-MAP-12 内2个子流程 | ✓ |

**结论**: 索引与实际文件一致。

### INDEX.md 跨流程引用关系 vs 实际引用

INDEX.md 声明的引用关系与实际文件中的引用完全闭合，无孤立引用或断链。

### INDEX.md R2待补充清单

INDEX.md 底部 R2 待补充清单 4 项：
1. ☐ 架构假设声明（P0-01）→ 实际已在 R2-Step0 完成 ✓
2. ☐ 编队总战力完整公式内联（P0-02）→ 实际已在 R2-Step0 完成 ✓
3. ☐ 核心数据结构 TypeScript 接口汇总（P0-03）→ 实际已在 R2-Step0 完成 ✓
4. ☐ FL-MAP-11/12/13/14/15 PRD 版本引用统一至 v2（P1-41）→ 需确认

**结论**: 清单中 3/4 项已完成，应更新为 ☑。第 4 项需确认。

---

## 术语一致性验证

| 术语 | 使用位置 | 一致性 |
|------|---------|:------:|
| 攻城策略（强攻/围困/夜袭/内应）| FL-MAP-09, map-interfaces 中文表 | ✓ |
| SiegeStrategy (assault/surround/night_raid/insider) | map-interfaces.ts | ✓ |
| BattleResult 3档（victory/defeat/crushing_defeat）| FL-MAP-09, FL-MAP-17, map-interfaces | ✓ |
| ForceStatus 4态（ready/marching/fighting/returning）| FL-MAP-16, map-interfaces | ✓ (cancelled 走销毁，不经过 ForceStatus) |
| 离线定义（300s/5分钟）| FL-MAP-15 | ✓ (单一定义点) |
| 兵力上限公式 | FL-MAP-08, map-interfaces | ✓ |
| 产出上限公式 | FL-MAP-01 SP02, map-interfaces | ✓ |

---

## R2 修复质量评估

| R2 Fix ID | 描述 | User Proxy | Dev Proxy | Integrator | 综合 |
|-----------|------|:----------:|:---------:|:----------:|:----:|
| P1-R2-01 | 敌方城池查找算法 | PASS | PASS | PASS | ✓ |
| P1-R2-02 | cancelled 编队清理 | PASS | PASS | PASS | ✓ |
| P1-R2-03 | 奖励领取文案 | PASS | PASS | PASS | ✓ |
| P1-R2-04 | 征服伤亡实施备注 | PASS | PASS | PASS | ✓ |
| P1-R2-05 | 策略修正系数常量表 | PASS | PASS+NOTE | PASS (keys已对齐) | ✓ |
| P1-R2-06 | 版本迁移策略 | PASS | PASS+NOTE | PASS (type已统一) | ✓ |
| P1-R2-07 | 加载进度百分比 | PASS | PASS | PASS | ✓ |

**R2 修复质量: 7/7 PASS**（Dev Proxy 的 NOTE 实际已在修复周期中解决）

---

## 综合评估

### R2 结束条件判定

| 条件 | 状态 | 说明 |
|------|:----:|------|
| P0 问题数 = 0 | ✓ | R2 issues.md 中 2 个 P0 实际已修复 |
| P1 问题可管理 | ✓ | 新增仅 1 个 Integrator P1（撤退伤亡矛盾），加上 UP-Finding1 共 2 个新 P1 |
| R2 修复全部验证 | ✓ | 7/7 PASS |
| 跨流程一致 | ✓ | 除撤退伤亡矛盾外，其余一致 |
| 索引完整 | ✓ | INDEX.md 准确（需更新标签） |

### 是否可结束 R2

**是，R2 可有条件完成。**

条件：
1. 修复 INT-R2-V01（撤退伤亡矛盾，1个文档内部的4处统一，约 15 分钟）
2. 更新 issues.md 中 5 个已过时条目的状态
3. 更新 INDEX.md 版本标签

修复上述 3 项后，综合可实施性从 R1 的 88% 提升至 **96%**，可进入实施阶段。

---

*Integrator 核验集成报告 R2 | 2026-05-05 | P0=0, P1=2(新), P2=4, P3=3 | R2可条件完成*
