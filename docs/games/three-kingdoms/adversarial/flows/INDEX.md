# 游戏流程枚举索引 — 对抗式流程测试

> **版本**: v3.0 | **日期**: 2026-05-02
> **目的**: 将游戏流程枚举按子系统/模块拆分为独立文档，建立二级索引
> **方法**: 3-Agent对抗式流程测试（Builder/Challenger/Arbiter）v2.0
> **迭代**: 建筑系统8轮迭代 9.1/10 ✅ SEALED | 天下Tab 11轮迭代 9.0/10 ✅ SEALED

---

## 方法论

| 文档 | 说明 |
|------|------|
| [流程测试方法论](methodology.md) | 对抗式流程枚举方法、角色定义、迭代规则、流程编号规范 |

---

## 子系统流程文档索引

### 优先级 P0 — 核心玩法

| # | 子系统 | 代码 | 流程文档 | 迭代状态 | 评分 | 流程清单 |
|---|--------|------|---------|---------|------|---------|
| 1 | 建筑系统 | BLD | [building/flows.md](building/flows.md) | ✅ SEALED + R9重设计 | 9.1 | [FLOW-LIST.md](building/FLOW-LIST.md) |
| 2 | 资源系统 | RES | [resource/flows.md](resource/flows.md) | 待开始 | — | — |
| 3 | 武将系统 | HER | [hero/flows.md](hero/flows.md) | 待开始 | — | — |
| 4 | 战斗系统 | CBT | [battle/flows.md](battle/flows.md) | 待开始 | — | — |

### 优先级 P1 — 扩展玩法

| # | 子系统 | 代码 | 流程文档 | 迭代状态 | 评分 | 流程清单 |
|---|--------|------|---------|---------|------|---------|
| 5 | 攻城系统 | CPN | [campaign/flows.md](campaign/flows.md) | 待开始 | — | — |
| 6 | 科技系统 | TEC | [tech/flows.md](tech/flows.md) | 待开始 | — | — |
| 7 | 天下Tab(MAP) | MAP | [map/round-1-flows.md](map/round-1-flows.md) | ✅ SEALED | 9.0 | [FLOW-LIST.md](map/FLOW-LIST.md) |
| 8 | 事件系统 | EVT | [event/flows.md](event/flows.md) | 待开始 | — | — |
| 9 | NPC系统 | NPC | [npc/flows.md](npc/flows.md) | 待开始 | — | — |

### 优先级 P2 — 经济/社交

| # | 子系统 | 代码 | 流程文档 | 迭代状态 | 评分 | 流程清单 |
|---|--------|------|---------|---------|------|---------|
| 10 | 商店系统 | SHP | [shop/flows.md](shop/flows.md) | 待开始 | — | — |
| 11 | 装备系统 | EQP | [equipment/flows.md](equipment/flows.md) | 待开始 | — | — |
| 12 | 联盟系统 | ALC | [alliance/flows.md](alliance/flows.md) | 待开始 | — | — |
| 13 | 贸易系统 | TRD | [trade/flows.md](trade/flows.md) | 待开始 | — | — |
| 14 | 离线收益 | OFR | [offline/flows.md](offline/flows.md) | 待开始 | — | — |

---

## 建筑系统迭代记录 (v2.0方法论)

| 轮次 | 评分 | 关键改进 |
|------|:----:|---------|
| R1 | 6.6 | 初始枚举(9主流程/32子流程)+PRD评估+6 GAP |
| R2 | 7.2 | +收取/加速/自动+PRD 100%覆盖+协同系统 |
| R3 | 7.5 | 医馆重设计+协同+混合模型+加速重平衡+资源上限 |
| R4 | 7.9 | 修复3P0+建筑特化系统+数值验证 |
| R5 | 8.3 | PRD全覆盖+GAP归零+跨系统+事件+特化重置 |
| R6 | 8.4 | 医馆损失框架+事件重设计+主动决策+建筑进化 |
| R7 | 8.7 | 进化Lv15保留+气泡紧迫感+挑战3选1+差距压缩 |
| **R8** | **9.1** | 差距59倍达标+元宝经济修复+进化保护期+决策优化 ✅ SEALED |
| R9 | — | 8→11建筑扩展+资源链循环+跨系统连接+差异化玩法 |

### 迭代文档索引

| 文档 | 说明 |
|------|------|
| [building/flows.md](building/flows.md) | **汇总流程文档** (28主流程/118子流程/42触发事件/12跨系统) |
| [building/FLOW-LIST.md](building/FLOW-LIST.md) | 流程清单 (快速索引+锚点链接) |
| [building/rounds/round-2-flows.md](building/rounds/round-2-flows.md) | R2 Builder 补充 (+收取/加速/自动) |
| [building/rounds/round-2-challenges.md](building/rounds/round-2-challenges.md) | R2 Challenger 质疑 (18质疑/4P0) |
| [building/rounds/round-2-verdict.md](building/rounds/round-2-verdict.md) | R2 Arbiter 裁决 (7.2分) |
| [building/rounds/round-3-flows.md](building/rounds/round-3-flows.md) | R3 Builder (医馆+协同+混合模型) |
| [building/rounds/round-3-challenges.md](building/rounds/round-3-challenges.md) | R3 Challenger 质疑 (19质疑/3P0) |
| [building/rounds/round-3-verdict.md](building/rounds/round-3-verdict.md) | R3 Arbiter 裁决 (7.5分) |
| [building/rounds/round-4-flows.md](building/rounds/round-4-flows.md) | R4 Builder (进化+特化+数值) |
| [building/rounds/round-4-challenges.md](building/rounds/round-4-challenges.md) | R4 Challenger 质疑 |
| [building/rounds/round-4-verdict.md](building/rounds/round-4-verdict.md) | R4 Arbiter 裁决 (7.9分) |
| [building/rounds/round-5-flows.md](building/rounds/round-5-flows.md) | R5 Builder (PRD全覆盖+GAP归零) |
| [building/rounds/round-5-challenges.md](building/rounds/round-5-challenges.md) | R5 Challenger (12质疑/2P0) |
| [building/rounds/round-5-verdict.md](building/rounds/round-5-verdict.md) | R5 Arbiter 裁决 (8.3分) |
| [building/rounds/round-6-flows.md](building/rounds/round-6-flows.md) | R6 Builder (损失框架+事件+决策+进化) |
| [building/rounds/round-6-challenges.md](building/rounds/round-6-challenges.md) | R6 Challenger (15质疑/2P0) |
| [building/rounds/round-6-verdict.md](building/rounds/round-6-verdict.md) | R6 Arbiter 裁决 (8.4分) |
| [building/rounds/round-7-flows.md](building/rounds/round-7-flows.md) | R7 Builder (进化修复+气泡+挑战+差距) |
| [building/rounds/round-7-challenges.md](building/rounds/round-7-challenges.md) | R7 Challenger (11质疑/1P0) |
| [building/rounds/round-7-verdict.md](building/rounds/round-7-verdict.md) | R7 Arbiter 裁决 (8.7分) |
| [building/rounds/round-8-flows.md](building/rounds/round-8-flows.md) | R8 Builder (差距59倍+元宝+保护期) |
| [building/rounds/round-8-challenges.md](building/rounds/round-8-challenges.md) | R8 Challenger (10质疑/1P0) |
| [building/rounds/round-8-verdict.md](building/rounds/round-8-verdict.md) | R8 Arbiter 裁决 (9.1分 ✅ SEALED) |
| [building/rounds/round-9-flows.md](building/rounds/round-9-flows.md) | R9 Builder (8→11建筑+资源链+跨系统) |

---

## 天下Tab(MAP)迭代记录

| 轮次 | 评分 | 关键改进 |
|------|------|---------|
| R1 | 6.8 | 初始枚举(12主流程/28子流程) |
| R2 | 7.4 | 征服恢复+攻城策略+新手引导 |
| R3 | 7.9 | 产出上限+道具获取+奖励调整 |
| R4 | 8.0 | 离线事件+产出上限统一 |
| R5 | 8.4 | 内应信闭环+离线体验修复 |
| R6 | 8.6 | 山贼公式修正+内应暴露冷却+事件链 |
| R7 | 8.7 | P0清零+遗迹数据表+冷却管理器+声望衰减 |
| R8 | 8.8 | 设计矛盾清零+推导根基待夯实 |
| R9 | 8.8 | 方法论突破(公理声明)+模拟数值自洽性硬伤 |
| R10 | 9.0 | P0清零+三方交叉校验+沉没成本检查+A/B测试模板 |
| **R11** | **9.0** | **数值精确化+dailyLimit约束闭环+方法论执行验证 ✅ SEALED** |

### 天下Tab迭代文档索引

| 文档 | 说明 |
|------|------|
| [map/round-1-flows.md](map/round-1-flows.md) | R1 Builder 初始流程枚举 (12主流程/28子流程) |
| [map/round-1-challenges.md](map/round-1-challenges.md) | R1 Challenger 质疑 (18质疑/3P0) |
| [map/round-1-verdict.md](map/round-1-verdict.md) | R1 Arbiter 裁决 (6.8分) |
| [map/round-2-flows.md](map/round-2-flows.md) | R2 Builder 补充 (征服恢复+攻城策略) |
| [map/round-2-challenges.md](map/round-2-challenges.md) | R2 Challenger 质疑 |
| [map/round-2-verdict.md](map/round-2-verdict.md) | R2 Arbiter 裁决 (7.4分) |
| [map/round-3-flows.md](map/round-3-flows.md) | R3 Builder 补充 (产出上限+道具获取) |
| [map/round-3-challenges.md](map/round-3-challenges.md) | R3 Challenger 质疑 |
| [map/round-3-verdict.md](map/round-3-verdict.md) | R3 Arbiter 裁决 (7.9分) |
| [map/round-4-flows.md](map/round-4-flows.md) | R4 Builder (离线事件+产出上限统一) |
| [map/round-4-challenges.md](map/round-4-challenges.md) | R4 Challenger 质疑 |
| [map/round-4-verdict.md](map/round-4-verdict.md) | R4 Arbiter 裁决 (8.0分) |
| [map/round-5-flows.md](map/round-5-flows.md) | R5 Builder (内应信闭环+离线体验) |
| [map/round-5-challenges.md](map/round-5-challenges.md) | R5 Challenger 质疑 |
| [map/round-5-verdict.md](map/round-5-verdict.md) | R5 Arbiter 裁决 (8.4分) |
| [map/round-6-flows.md](map/round-6-flows.md) | R6 Builder (公式修正+事件链) |
| [map/round-6-challenges.md](map/round-6-challenges.md) | R6 Challenger 质疑 |
| [map/round-6-verdict.md](map/round-6-verdict.md) | R6 Arbiter 裁决 (8.6分) |
| [map/round-7-flows.md](map/round-7-flows.md) | R7 Builder (P0清零+边界完成) |
| [map/round-7-challenges.md](map/round-7-challenges.md) | R7 Challenger 质疑 |
| [map/round-7-verdict.md](map/round-7-verdict.md) | R7 Arbiter 裁决 (8.7分) |
| [map/round-8-flows.md](map/round-8-flows.md) | R8 Builder (矛盾清零+数值验证) |
| [map/round-8-challenges.md](map/round-8-challenges.md) | R8 Challenger 质疑 |
| [map/round-8-verdict.md](map/round-8-verdict.md) | R8 Arbiter 裁决 (8.8分) |
| [map/round-9-flows.md](map/round-9-flows.md) | R9 Builder (公理声明+模拟完善) |
| [map/round-9-challenges.md](map/round-9-challenges.md) | R9 Challenger 质疑 |
| [map/round-9-verdict.md](map/round-9-verdict.md) | R9 Arbiter 裁决 (8.8分) |
| [map/round-10-flows.md](map/round-10-flows.md) | R10 Builder (P0修复+三方校验+A/B测试) |
| [map/round-10-challenges.md](map/round-10-challenges.md) | R10 Challenger 质疑 |
| [map/round-10-verdict.md](map/round-10-verdict.md) | R10 Arbiter 裁决 (9.0分) |
| [map/round-11-flows.md](map/round-11-flows.md) | R11 Builder (期望值精确化+dailyLimit闭环) |
| [map/round-11-challenges.md](map/round-11-challenges.md) | R11 Challenger 质疑 |
| [map/round-11-verdict.md](map/round-11-verdict.md) | R11 Arbiter 裁决 (9.0分 ✅ SEALED) |

---

## 跨系统流程衔接索引

跨子系统之间的前置/后置流程通过流程编号衔接，避免重复编写。

| 源流程 | 目标流程 | 衔接点 | 说明 |
|--------|---------|--------|------|
| BLD-F01（资源产出） | RES-F01（资源累积） | 建筑产出 → 资源系统入库 | 每秒产出流入资源池 |
| BLD-F02（建筑升级） | RES-F02（资源消耗） | 升级扣费 → 资源系统扣除 | 前置流程 |
| BLD-F05（解锁链） | HER-F01（武将招募） | 主城Lv5 → 招贤馆解锁 | 前置条件 |
| BLD-F06（城墙防御） | CPN-F01（攻城防守） | 城防值 → 攻城防御计算 | 数据消费 |
| BLD-F01（书院产出） | TEC-F01（科技研究） | 科技点产出 → 科技系统消费 | 资源流转 |
| BLD-F01（铁匠产出） | EQP-F01（装备强化） | 材料产出 → 装备系统消费 | 资源流转 |
| HER-F02（武将派驻） | BLD-F01（资源产出） | 武将属性 → 建筑产出加成 | 加成注入 |
| TEC-F02（科技加成） | BLD-F01（资源产出） | 科技效果 → 建筑产出加成 | 加成注入 |
| BLD-F15（协同系统） | BLD-F01（资源产出） | 协同效果 → 产出加成 | 内部联动 |
| BLD-F19（建筑特化） | BLD-F01（资源产出） | 特化方向 → 产出变化 | 内部联动 |
| BLD-F02（建筑升级） | ACH-F01（成就系统） | 等级里程碑 → 成就解锁 | 跨系统 |
| BLD-F02（建筑升级） | TSK-F01（任务系统） | 升级完成 → 任务进度 | 跨系统 |
| BLD-F02（建筑升级） | EVT-F01（活动系统） | 升级操作 → 活动进度 | 跨系统 |
| BLD-F23（招贤馆） | HER-F01（英雄招募） | 招贤馆等级 → 招募概率 | R9新增 |
| BLD-F24（工坊） | EQP-F01（装备炼制） | 工坊等级 → 炼制效率 | R9新增 |
| BLD-F25（市舶司） | TRD-F01（贸易系统） | 市舶司等级 → 贸易折扣 | R9新增 |
| BLD-F26（铁匠铺） | BLD-F24（工坊） | 材料流转 → 装备炼制 | R9新增(资源链) |
| BLD-F25（市舶司） | BLD-F01（市集） | 繁荣度 → 铜钱产出加成 | R9新增(资源链) |

---

## 数据追溯链

每个游戏数据的产生必须可追溯到玩家操作或触发事件。

| 数据类型 | 产生来源 | 追溯链 | 覆盖状态 |
|---------|---------|--------|---------|
| 建筑等级 | 玩家点击升级 / 自动升级 / 离线完成 | BLD-F02/F12/F07 → startUpgrade → tick/deserialize | ✅ |
| 资源数量(消耗) | 建筑升级扣费 | BLD-F02 → startUpgrade → RES扣除 | ✅ |
| 资源数量(产出) | 建筑产出 | BLD-F01 → calculateTotalProduction → RES累加 | ✅ |
| 升级队列 | 玩家操作 / 自动升级 | BLD-F02/F12 → addToQueue → tick消费 | ✅ |
| 解锁状态 | 主城等级达标 | BLD-F05 → checkAndUnlockBuildings | ✅ |
| 城防值 | 城墙等级 | BLD-F06 → getWallDefense | ✅ |
| 科技点 | 书院产出 | BLD-F01 → getProduction → RES累加 | ✅ |
| 协同效果 | 建筑组合条件 | BLD-F15 → 协同检查 → 加成注入 | ✅ |
| 特化方向 | 玩家选择 | BLD-F19 → 特化选择 → 效果生效 | ✅ |
| 资源上限 | 建筑等级 | BLD-F01-02 → 上限公式 → 溢出检查 | ✅ |
| 自动升级 | 系统触发 | TE-06 → 资源检查 → 自动加入队列 | ✅ |
| 阶段目标 | 等级里程碑 | TE-07 → 目标检查 → 奖励发放 | ✅ |

**数据追溯覆盖率**: 100% ✅

---

## 已解决的游戏流程断裂/缺失

| # | 子系统 | 断裂点 | R1状态 | R10状态 | 解决方案 |
|---|--------|--------|--------|---------|---------|
| GAP-001 | BLD | 主城Lv5后无新机制 | 🔴 高 | ✅ 已解决 | 特化系统(R6)+阶段目标(R2)+协同(R3) |
| GAP-002 | MAP | 地图系统缺失 | 🔴 高 | ⚠️ 部分缓解 | 建筑→地图衔接设计(R4)，地图系统本身待开发 |
| GAP-003 | BLD | 资源产出失衡 | 🟡 中 | ✅ 已解决 | 数值曲线优化(R3)+产出上限(R5) |
| GAP-004 | BLD | 建筑间无协同 | 🟡 中 | ✅ 已解决 | 协同系统(R3)+叠加规则(R4) |
| GAP-005 | BLD | 自动升级缺失 | 🟡 中 | ✅ 已解决 | 自动升级流程(R2)+资源保留(R3) |
| GAP-006 | BLD | 推荐缺乏长期规划 | 🟡 中 | ✅ 已解决 | 协同+特化提供长期目标 |

---

## 建筑系统最终流程统计 (v2.0方法论 R1→R9)

| 指标 | R1 | R8最终 | R9 | 总增量 |
|------|----|---------|-----|--------|
| 主流程 | 9 | 22 | **28** | +19 |
| 子流程 | 32 | 95 | **118** | +86 |
| 跨系统(XI) | 6 | 7 | **12** | +6 |
| 触发事件(TE) | 5 | 31 | **42** | +37 |
| 流程断裂(GAP) | 6 | 0 | **0** | -6 |
| PRD修订(PRD-R) | 6 | 43 | **52** | +46 |
| PRD覆盖率 | 76.9% | 100% | **100%** | +23.1% |
| 数据追溯率 | 92% | 100% | **100%** | +8% |
| 新手vs老手差距 | — | 59倍 | **59倍** | 达标(行业20~60倍) |
| 评分 | 6.6 | 9.1 | — | — |

---

## 建筑系统全部流程清单

### 主流程 (28个)

| # | 流程 | 说明 | 详细文档 |
|---|------|------|---------|
| BLD-F01 | 资源产出 | 建筑每秒产出资源，9因子乘法公式 | [flows.md](building/flows.md) |
| BLD-F02 | 建筑升级 | 消耗资源+等待时间，升级队列 | [flows.md](building/flows.md) |
| BLD-F03 | 建筑建造 | 解锁新建筑，首次建造流程 | [flows.md](building/flows.md) |
| BLD-F04 | 升级取消 | 取消升级返还80%资源 | [flows.md](building/flows.md) |
| BLD-F05 | 解锁链 | 主城等级→解锁其他建筑 | [flows.md](building/flows.md) |
| BLD-F06 | 城墙防御 | 城墙等级→城防值计算 | [flows.md](building/flows.md) |
| BLD-F07 | 离线收益 | 离线期间建筑继续产出 | [flows.md](building/flows.md) |
| BLD-F08 | 武将派驻 | 武将属性→建筑产出加成 | [flows.md](building/flows.md) |
| BLD-F09 | 建筑详情 | 查看产出/加成/升级信息 | [flows.md](building/flows.md) |
| BLD-F10 | 一键收取 | 混合产出模型，收取建筑库存 | [round-2-flows.md](building/round-2-flows.md) |
| BLD-F11 | 升级加速 | 铜钱(3次)/天命(50%)/元宝(连续) | [round-2-flows.md](building/round-2-flows.md) |
| BLD-F12 | 自动升级 | 开关控制，资源保留阈值 | [round-2-flows.md](building/round-2-flows.md) |
| BLD-F13 | 医馆系统 | 被动加成+主动治疗+治疗Buff | [round-3-flows.md](building/round-3-flows.md) |
| BLD-F14 | 建筑协同 | 8种建筑组合加成效果 | [round-3-flows.md](building/round-3-flows.md) |
| BLD-F15 | 资源上限 | 资源上限公式+溢出处理 | [round-3-flows.md](building/round-3-flows.md) |
| BLD-F16 | 建筑特化 | Lv10选择特化方向(7建筑×2方向) | [round-4-flows.md](building/round-4-flows.md) |
| BLD-F17 | 跨系统连接 | BLD↔RES/TEC/HER/CPN/EVT | [round-5-flows.md](building/round-5-flows.md) |
| BLD-F18 | 建筑事件 | 7类建筑×3种事件，双向收益选择 | [round-5-flows.md](building/round-5-flows.md) |
| BLD-F19 | 医馆损失框架 | 绝对值展示+升级对比+未建造负值+损失报告 | [round-6-flows.md](building/round-6-flows.md) |
| BLD-F20 | 事件重设计 | 100%每日触发+气泡紧迫感+冷却 | [round-6-flows.md](building/round-6-flows.md) |
| BLD-F21 | 主动决策 | 焦点(1座+15%)+挑战(3选1)+巡查 | [round-6-flows.md](building/round-6-flows.md) |
| BLD-F22 | 建筑进化 | 满级→重置Lv15+星级(+10%/+12%/+15%) | [round-6-flows.md](building/round-6-flows.md) |
| **BLD-F23** | **招贤馆系统** | **武将招募+概率加成+保底机制** | **[round-9-flows.md](building/round-9-flows.md)** |
| **BLD-F24** | **工坊系统** | **装备炼制+效率加成+批量+分解** | **[round-9-flows.md](building/round-9-flows.md)** |
| **BLD-F25** | **市舶司系统** | **商队派遣+繁荣度事件+贸易折扣+跨服** | **[round-9-flows.md](building/round-9-flows.md)** |
| **BLD-F26** | **铁匠铺重设计** | **材料加工→工坊消费+强化折扣** | **[round-9-flows.md](building/round-9-flows.md)** |
| **BLD-F27** | **兵营编队系统** | **编队管理+训练模式+编队出征** | **[round-9-flows.md](building/round-9-flows.md)** |
| **BLD-F28** | **资源链循环** | **5条资源链路+跨建筑资源流转** | **[round-9-flows.md](building/round-9-flows.md)** |

### 产出公式 (R8最终版)

```
最终产出 = 基础产出(Lv表)
         × 主城加成(1 + castle.level × 2%)
         × 科技加成(1 + techBonus%)
         × 武将加成(1 + heroBonus%)
         × 医馆加成(1 + clinic.level × 2%)
         × (协同+特化)(1 + synergy% + spec%)   上限80%
         × 治疗Buff(1.1 if active)
         × 进化加成(1 + prestigeBonus%)         加法层
         × 焦点加成(1 + focusBonus%)             加法层
```

新手vs老手差距: **59倍** (行业标准20~60倍)
