# 建筑系统(BLD) 流程清单

> **版本**: v1.0 | **日期**: 2026-05-02
> **迭代状态**: R8 SEALED，评分 9.1/10
> **目的**: 快速索引所有流程编号及步骤概要，方便审核
> **统计**: 22主流程 / 95子流程 / 31触发事件 / 7跨系统 / 0断裂

---

## 一、主流程(BLD-F)

| 编号 | 流程名称 | 步骤概要 | 详细文档 |
|------|---------|---------|---------|
| BLD-F01 | 资源产出 | tick→9因子乘法公式→资源累加→UI飘字 | [flows.md](flows.md) |
| BLD-F02 | 建筑升级 | 点击→校验(锁/队列/资源/等级)→扣费→入队→tick完成→等级+1 | [flows.md](flows.md) |
| BLD-F03 | 建筑建造 | 解锁条件达标→首次建造→初始化等级1 | [flows.md](flows.md) |
| BLD-F04 | 升级取消 | 取消→返还80%资源→清空队列 | [flows.md](flows.md) |
| BLD-F05 | 解锁链 | 主城升级→检查所有建筑解锁条件→解锁/锁定 | [flows.md](flows.md) |
| BLD-F06 | 城墙防御 | 城墙等级→城防值公式→攻城防御计算 | [flows.md](flows.md) |
| BLD-F07 | 离线收益 | 登录→离线时长→产出计算→离线面板→领取 | [flows.md](flows.md) |
| BLD-F08 | 武将派驻 | 选择武将→派驻→属性加成注入产出公式 | [flows.md](flows.md) |
| BLD-F09 | 建筑详情 | 点击建筑→面板(等级/产出/加成/升级费用/时间) | [flows.md](flows.md) |
| BLD-F10 | 一键收取 | 悬浮按钮→点击→各建筑库存飞入资源栏→角标清零 | [round-2-flows.md](round-2-flows.md) |
| BLD-F11 | 升级加速 | 铜钱(-30%×3次) / 天命(-50%) / 元宝(秒完成) | [round-2-flows.md](round-2-flows.md) |
| BLD-F12 | 自动升级 | 开关→资源检查→优先级排序→自动入队→资源保留阈值 | [round-2-flows.md](round-2-flows.md) |
| BLD-F13 | 医馆系统 | 被动加成(2%/级)→主动治疗(10%日产)→治疗Buff(+10%持续10min) | [round-3-flows.md](round-3-flows.md) |
| BLD-F14 | 建筑协同 | 组合条件检查→激活加成→叠加规则(上限80%) | [round-3-flows.md](round-3-flows.md) |
| BLD-F15 | 资源上限 | 上限公式(建筑等级)→溢出检查→降速50%→收取恢复 | [round-3-flows.md](round-3-flows.md) |
| BLD-F16 | 建筑特化 | Lv10触发→2方向选1→永久生效→稀有道具重置 | [round-4-flows.md](round-4-flows.md) |
| BLD-F17 | 跨系统连接 | BLD↔RES/TEC/HER/CPN/EVT 五条数据通路 | [round-5-flows.md](round-5-flows.md) |
| BLD-F18 | 建筑事件 | 随机触发→双向收益选择(即时vs持续)→冷却24h | [round-5-flows.md](round-5-flows.md) |
| BLD-F19 | 医馆损失框架 | 绝对值展示→升级对比→未建造红色负值→动态损失报告 | [round-6-flows.md](round-6-flows.md) |
| BLD-F20 | 事件重设计 | 100%每日触发→2阶段气泡(平静→紧迫)→冷却管理 | [round-6-flows.md](round-6-flows.md) |
| BLD-F21 | 主动决策 | 焦点(1座+15%/6h冷却) + 挑战(3选1差异化) + 巡查(3x花费回报) | [round-6-flows.md](round-6-flows.md) |
| BLD-F22 | 建筑进化 | 满级→重置Lv15→72h保护期→星级(+10%/+12%/+15%)→新上限 | [round-6-flows.md](round-6-flows.md) |

---

## 二、子流程(BLD-F-XX)

### BLD-F01 资源产出

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F01-01 | 主城加成计算 | castle.level × 2% → 乘法因子 | [flows.md](flows.md) |
| BLD-F01-02 | 产出上限检查 | 资源≥上限 → 停止累加 | [flows.md](flows.md) |

### BLD-F02 建筑升级

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F02-01 | 升级校验 | 7项校验: 锁定/升级中/上限/主城关系/队列/资源 | [flows.md](flows.md) |
| BLD-F02-02 | 升级队列 | 入队→tick消费→完成→解锁链检查 | [flows.md](flows.md) |

### BLD-F05 解锁链

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F05-01 | 主城解锁 | 主城Lv N → 解锁对应建筑 | [flows.md](flows.md) |
| BLD-F05-02 | 特殊解锁 | 主城Lv4→5需任一建筑Lv4; Lv9→10需任一Lv9 | [flows.md](flows.md) |

### BLD-F07 离线收益

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F07-01 | 离线产出计算 | 离线时长 × 产出速率(含全部加成) | [flows.md](flows.md) |
| BLD-F07-02 | 离线面板 | 显示离线时长+产出明细+领取按钮 | [flows.md](flows.md) |

### BLD-F08 武将派驻

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F08-01 | 武将选择 | 显示可派驻武将列表+属性预览 | [flows.md](flows.md) |
| BLD-F08-02 | 加成注入 | 武将属性 → 建筑产出乘法因子 | [flows.md](flows.md) |

### BLD-F10 一键收取

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F10-01 | VIP收取加成 | VIP3+10% / VIP6+20% 额外收益 | [round-2-flows.md](round-2-flows.md) |
| BLD-F10-02 | 收取动画 | 各建筑飘字→弧线飞入资源栏→数字跳动 | [round-2-flows.md](round-2-flows.md) |
| BLD-F10-03 | 建筑库存 | 资源先累积在建筑中→容量=速率×缓冲时间→溢出降速50% | [round-3-flows.md](round-3-flows.md) |

### BLD-F11 升级加速

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F11-01 | 铜钱加速 | 花费铜钱→减少30%时间→可叠加3次 | [round-2-flows.md](round-2-flows.md) |
| BLD-F11-02 | 天命加速 | 使用天命道具→减少50%时间 | [round-2-flows.md](round-2-flows.md) |
| BLD-F11-03 | 元宝秒完成 | 花费元宝→立即完成→连续定价递增 | [round-2-flows.md](round-2-flows.md) |

### BLD-F12 自动升级

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F12-01 | 优先级算法 | 协同优先→产出最高→最便宜→随机 | [round-2-flows.md](round-2-flows.md) |
| BLD-F12-02 | 资源保护 | 保留最低资源(升级费用×1.5)防死锁 | [round-2-flows.md](round-2-flows.md) |

### BLD-F13 医馆系统

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F13-01 | 被动加成 | level × 2% → 乘法因子注入产出公式 | [round-3-flows.md](round-3-flows.md) |
| BLD-F13-02 | 主动治疗 | 消耗粮草→立即恢复10%日产兵力→冷却 | [round-3-flows.md](round-3-flows.md) |
| BLD-F13-03 | 治疗Buff | 治疗后+10%产出→持续10分钟 | [round-3-flows.md](round-3-flows.md) |
| BLD-F13-04 | 可视化反馈 | 浮动指示器(绝对值)+治愈报告通知 | [round-5-flows.md](round-5-flows.md) |

### BLD-F14 建筑协同

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F14-01 | 协同发现 | 建筑组合满足条件时高亮提示 | [round-3-flows.md](round-3-flows.md) |
| BLD-F14-02 | 协同激活 | 条件满足→激活加成→注入产出公式 | [round-3-flows.md](round-3-flows.md) |
| BLD-F14-03 | 协同效果 | 加成+特化合计上限80% | [round-3-flows.md](round-3-flows.md) |

### BLD-F15 资源上限

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F15-01 | 上限计算 | 上限公式基于建筑等级 | [round-3-flows.md](round-3-flows.md) |
| BLD-F15-02 | 溢出处理 | 达上限→产出降速50%→收取后恢复 | [round-3-flows.md](round-3-flows.md) |

### BLD-F16 建筑特化

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F16-01 | 特化选择 | Lv10触发→2方向选1→永久生效(7建筑×2方向) | [round-4-flows.md](round-4-flows.md) |
| BLD-F16-02 | 特化效果 | 特化加成→与协同叠加(合计上限80%) | [round-4-flows.md](round-4-flows.md) |
| BLD-F16-03 | 特化重置 | 首次免费→之后需稀有道具(每周任务获取) | [round-4-flows.md](round-4-flows.md) |

### BLD-F17 跨系统连接

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F17-01 | BLD↔RES | 产出→资源系统入库 | [round-5-flows.md](round-5-flows.md) |
| BLD-F17-02 | BLD↔TEC | 书院产出→科技点→科技研究 | [round-5-flows.md](round-5-flows.md) |
| BLD-F17-03 | BLD↔HER | 武将派驻→建筑产出加成 | [round-5-flows.md](round-5-flows.md) |
| BLD-F17-04 | BLD↔CPN | 城墙等级→攻城防御计算 | [round-5-flows.md](round-5-flows.md) |
| BLD-F17-05 | BLD↔EVT | 建筑随机事件触发 | [round-5-flows.md](round-5-flows.md) |

### BLD-F18 建筑事件

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F18-01 | 事件触发 | 7类建筑×3种事件=21种→随机选择 | [round-5-flows.md](round-5-flows.md) |
| BLD-F18-02 | 事件结算 | 双向收益选择(即时vs持续)→结果执行 | [round-5-flows.md](round-5-flows.md) |

### BLD-F19 医馆损失框架

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F19-01 | 绝对值展示 | 浮动指示器显示"医馆为您节省 X 粮草/秒" | [round-6-flows.md](round-6-flows.md) |
| BLD-F19-02 | 升级对比 | 升级医馆时弹出前后产出对比动画 | [round-6-flows.md](round-6-flows.md) |
| BLD-F19-03 | 未建造提示 | 已解锁未建造→红色负值(仅全局总览显示一次) | [round-6-flows.md](round-6-flows.md) |
| BLD-F19-04 | 损失报告 | 动态报告(节省量→排名→ROI预测)→整合进每日收益汇总 | [round-6-flows.md](round-6-flows.md) |

### BLD-F20 事件重设计

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F20-01 | 每日事件触发 | 首次登录100%触发→随机建筑→气泡2阶段(平静0-2h→紧迫2h+) | [round-6-flows.md](round-6-flows.md) |
| BLD-F20-02 | 事件选择 | 双向收益(即时vs持续)→预期收益显示→离线生效 | [round-6-flows.md](round-6-flows.md) |
| BLD-F20-03 | 事件冷却 | 同一建筑24h冷却→不同建筑独立冷却 | [round-6-flows.md](round-6-flows.md) |

### BLD-F21 主动决策

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F21-01 | 建筑焦点 | 标记1座建筑→+15%产出→切换冷却6h | [round-6-flows.md](round-6-flows.md) |
| BLD-F21-02 | 每日挑战 | 3选1(粮草元宝/进化材料/加速道具)→ROI>100%→5元宝跳过 | [round-6-flows.md](round-6-flows.md) |
| BLD-F21-03 | 建筑巡查 | 发现问题→手动处理(免费)/花费资源(3x回报)/自动处理 | [round-6-flows.md](round-6-flows.md) |

### BLD-F22 建筑进化

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| BLD-F22-01 | 进化解锁 | 满级检查→进化按钮→消耗预览(粮草/铜钱/元宝) | [round-6-flows.md](round-6-flows.md) |
| BLD-F22-02 | 进化执行 | 等级重置Lv15→新上限(Lv30/35/40)→72h保护期(产出不降)→Lv15→20加速50% | [round-6-flows.md](round-6-flows.md) |
| BLD-F22-03 | 进化效果 | 星级加成(+10%/+12%/+15%递增)→加法层注入产出公式→外观变化 | [round-6-flows.md](round-6-flows.md) |

---

## 三、触发事件(TE)

| 编号 | 触发类型 | 描述 | 文档 |
|------|---------|------|------|
| TE-01 | 定时 | 资源产出tick(每帧) | [flows.md](flows.md) |
| TE-02 | 定时 | 升级完成检查(tick) | [flows.md](flows.md) |
| TE-03 | 条件 | 解锁条件检查(主城升级时) | [flows.md](flows.md) |
| TE-04 | 条件 | 城防值计算(城墙升级时) | [flows.md](flows.md) |
| TE-05 | 条件 | 武将派驻/卸任 | [flows.md](flows.md) |
| TE-06 | 操作 | 一键收取触发 | [round-2-flows.md](round-2-flows.md) |
| TE-07 | 定时 | 自动升级检查 | [round-2-flows.md](round-2-flows.md) |
| TE-08 | 操作 | 加速完成触发 | [round-2-flows.md](round-2-flows.md) |
| TE-09 | 操作 | 医馆治疗触发 | [round-3-flows.md](round-3-flows.md) |
| TE-10 | 定时 | 治疗Buff状态检查 | [round-3-flows.md](round-3-flows.md) |
| TE-11 | 条件 | 协同条件检查(等级变化时) | [round-3-flows.md](round-3-flows.md) |
| TE-12 | 条件 | 资源上限检查(资源变化时) | [round-3-flows.md](round-3-flows.md) |
| TE-13 | 条件 | 建筑库存溢出(达上限时) | [round-3-flows.md](round-3-flows.md) |
| TE-14 | 条件 | 医馆被动加成重算(升级时) | [round-4-flows.md](round-4-flows.md) |
| TE-15 | 条件 | 库存降速检查(达上限时) | [round-4-flows.md](round-4-flows.md) |
| TE-16 | 条件 | 特化选择触发(首次达Lv10) | [round-4-flows.md](round-4-flows.md) |
| TE-17 | 定时 | 治愈报告触发(每日) | [round-5-flows.md](round-5-flows.md) |
| TE-18 | 条件 | 新手引导收取(首次库存80%) | [round-5-flows.md](round-5-flows.md) |
| TE-19 | 定时 | 跨系统产出注入(每个产出周期) | [round-5-flows.md](round-5-flows.md) |
| TE-20 | 条件 | 科技点注入(书院产出时) | [round-5-flows.md](round-5-flows.md) |
| TE-21 | 条件 | 建筑事件随机触发(登录时) | [round-5-flows.md](round-5-flows.md) |
| TE-22 | 条件 | 特化推荐触发(Lv10选择时) | [round-5-flows.md](round-5-flows.md) |
| TE-23 | 条件 | 每日事件触发(首次登录) | [round-6-flows.md](round-6-flows.md) |
| TE-24 | 操作 | 建筑焦点标记 | [round-6-flows.md](round-6-flows.md) |
| TE-25 | 定时 | 每日挑战生成(0点刷新) | [round-6-flows.md](round-6-flows.md) |
| TE-26 | 条件 | 挑战完成检查(升级完成时) | [round-6-flows.md](round-6-flows.md) |
| TE-27 | 操作 | 巡查奖励触发(访问建筑时) | [round-6-flows.md](round-6-flows.md) |
| TE-28 | 条件 | 进化解锁检查(满级时) | [round-6-flows.md](round-6-flows.md) |
| TE-29 | 条件 | 进化完成触发 | [round-6-flows.md](round-6-flows.md) |
| TE-30 | 定时 | 焦点加成计算(每个产出周期) | [round-6-flows.md](round-6-flows.md) |
| TE-31 | 条件 | 巡查冷却检查(每次巡查后) | [round-6-flows.md](round-6-flows.md) |

---

## 四、跨系统流程(XI)

| 编号 | 涉及系统 | 衔接点 | 文档 |
|------|---------|--------|------|
| XI-001 | BLD→RES | 建筑产出→资源系统入库 | [flows.md](flows.md) |
| XI-002 | BLD→RES | 升级扣费→资源系统扣除 | [flows.md](flows.md) |
| XI-003 | BLD→HER | 主城Lv5→酒馆解锁 | [flows.md](flows.md) |
| XI-004 | BLD→CPN | 城防值→攻城防御计算 | [flows.md](flows.md) |
| XI-005 | BLD→TEC | 书院产出→科技点消费 | [flows.md](flows.md) |
| XI-006 | BLD→EQP | 铁匠产出→装备材料消费 | [flows.md](flows.md) |
| XI-007 | HER→BLD | 武将属性→建筑产出加成 | [round-2-flows.md](round-2-flows.md) |

---

## 五、产出公式(R8最终版)

```
最终产出 = 基础产出(Lv表)
         × 主城加成(1 + castle.level × 2%)
         × 科技加成(1 + techBonus%)
         × 武将加成(1 + heroBonus%)
         × 医馆加成(1 + clinic.level × 2%)
         × (协同+特化)(1 + synergy% + spec%)   上限80%
         × 治疗Buff(1.1 if active)
         × (1 + 进化加成% + 焦点加成%)          加法层
```

新手(Lv5) vs 老手(Lv40,3星,焦点): **59倍** (SLG行业标准20~60倍)

---

## 六、迭代进度

| 轮次 | 评分 | 关键改进 | 详细文档 |
|------|------|---------|---------|
| R1 | 6.6 | 初始枚举(9主流程/32子流程) | [flows](flows.md) [challenges](round-1-challenges.md) [verdict](round-1-verdict.md) |
| R2 | 7.2 | +收取/加速/自动+PRD 100% | [flows](round-2-flows.md) [challenges](round-2-challenges.md) [verdict](round-2-verdict.md) |
| R3 | 7.5 | 医馆重设计+协同+资源上限 | [flows](round-3-flows.md) [challenges](round-3-challenges.md) [verdict](round-3-verdict.md) |
| R4 | 7.9 | 士气简化+特化+库存修复 | [flows](round-4-flows.md) [challenges](round-4-challenges.md) [verdict](round-4-verdict.md) |
| R5 | 8.3 | PRD全覆盖+GAP归零+跨系统 | [flows](round-5-flows.md) [challenges](round-5-challenges.md) [verdict](round-5-verdict.md) |
| R6 | 8.4 | 损失框架+事件重设计+主动决策+进化 | [flows](round-6-flows.md) [challenges](round-6-challenges.md) [verdict](round-6-verdict.md) |
| R7 | 8.7 | 进化Lv15+气泡紧迫+挑战3选1+差距压缩 | [flows](round-7-flows.md) [challenges](round-7-challenges.md) [verdict](round-7-verdict.md) |
| R8 | **9.1** | 差距59倍+元宝修复+保护期+决策优化 **SEALED** | [flows](round-8-flows.md) [challenges](round-8-challenges.md) [verdict](round-8-verdict.md) |

---

*建筑系统流程清单 v1.0 | 2026-05-02*
