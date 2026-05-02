# 天下(MAP) 流程清单

> **版本**: v3.0 | **日期**: 2026-05-02
> **迭代状态**: R11 SEALED，评分 9.0/10
> **目的**: 快速索引所有流程编号及步骤概要，方便审核
> **统计**: 12主流程 / 100子流程 / 15跨系统 / 10触发事件 / 0断裂 / 47 PRD修订
> **汇总流程文档**: → [flows.md](flows.md) (所有流程详细步骤)

---

## 一、主流程(MAP-F)

| 编号 | 流程名称 | 步骤概要 | 详细文档 |
|------|---------|---------|---------|
| MAP-F01 | 进入天下Tab | 点击Tab→场景切换→地图渲染→初始视角→己方高亮 | [flows.md#map-f01](flows.md#map-f01-进入天下tab) |
| MAP-F02 | 地图浏览与缩放 | 拖拽移动→缩放(50%~200%)→气泡隐藏规则 | [flows.md#map-f02](flows.md#map-f02-地图浏览与缩放) |
| MAP-F03 | 领土选择与详情 | 点击领土→详情面板(名称/等级/地形/产出/驻防) | [flows.md#map-f03](flows.md#map-f03-领土选择与详情) |
| MAP-F04 | 领土征服 | 校验(相邻+兵力)→部署兵力→胜率预估→出征→胜/败结算 | [flows.md#map-f04](flows.md#map-f04-领土征服) |
| MAP-F05 | 驻防管理 | 查看驻防→调整兵力→防御值更新 | [flows.md#map-f05](flows.md#map-f05-驻防管理) |
| MAP-F06 | 攻城战 | 校验(相邻+兵力+粮草+次数)→策略选择→消耗→城防归零→占领 | [flows.md#map-f06](flows.md#map-f06-攻城战) |
| MAP-F07 | 筛选与热力图 | 筛选面板(5维度)→过滤→高亮/灰度→热力图分档 | [flows.md#map-f07](flows.md#map-f07-筛选与热力图) |
| MAP-F08 | 攻城奖励领取 | 结果弹窗→奖励明细(首次/重复)→确认领取 | [flows.md#map-f08](flows.md#map-f08-攻城奖励领取) |
| MAP-F09 | 地图事件处理 | 事件生成→脉冲图标→点击→选择分支→结果(6种事件) | [flows.md#map-f09](flows.md#map-f09-地图事件处理) |
| MAP-F10 | 地图统计查看 | 统计面板(领土/资源/战斗/探索/事件) | [flows.md#map-f10](flows.md#map-f10-地图统计查看) |
| MAP-F11 | 领土等级提升 | 时间达标→投资→等级提升→产出倍率提升 | [flows.md#map-f11](flows.md#map-f11-领土等级提升) |
| MAP-F12 | 离线领土变化查看 | 登录→回归面板(新占领/失去/收益变化/离线事件) | [flows.md#map-f12](flows.md#map-f12-离线领土变化查看) |

---

## 二、子流程(MAP-F-XX)

### MAP-F01 进入天下Tab

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F01-01 | 新手引导 | 首次进入→遮罩→引导箭头→完成征服→新手礼包 | [flows.md](flows.md#map-f01-01-新手引导r2) |
| MAP-F01-02 | 产出上限机制 | 上限=10000×等级×(1+仓储术×5%)→停止累加 | [flows.md](flows.md#map-f01-02-产出上限机制r3) |
| MAP-F01-03 | 统一产出上限 | 与建筑系统共用仓储术科技→统一上限管理 | [flows.md](flows.md#map-f01-03-统一产出上限r4) |
| MAP-F01-04 | 产出上限管理增强 | 80%预警+百分比显示+概览面板+一键收取 | [flows.md](flows.md#map-f01-04-产出上限管理增强r5r6r7) |

### MAP-F02 地图浏览与缩放

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F02-01 | 缩放约束检查 | min(50%)/max(200%)边界校验 | [flows.md](flows.md#map-f02-01-缩放约束检查r1) |
| MAP-F02-02 | 瓦片坐标转换 | gridToPixel/pixelToGrid双向转换 | [flows.md](flows.md#map-f02-02-瓦片坐标转换r1) |
| MAP-F02-03 | 视口裁剪 | 只渲染可见瓦片 | [flows.md](flows.md#map-f02-03-视口裁剪r1) |

### MAP-F04 领土征服

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F04-01 | 征服失败恢复 | 失败→"重整旗鼓"(铜钱×1000)→下次消耗-20% | [flows.md](flows.md#map-f04-01-征服失败恢复r2) |
| MAP-F04-02 | 胜率公式完善 | 胜率+地形修正(山地-10%/城池-20%/关隘-30%) | [flows.md](flows.md#map-f04-02-胜率公式r2r6修正) |

### MAP-F05 驻防管理

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F05-01 | 领土放弃 | 确认→损失驻防→中立→24h冷却 | [flows.md](flows.md#map-f05-01-领土放弃r2) |

### MAP-F06 攻城战

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F06-01 | 攻城中断处理 | 退出→暂停→重连→继续/取消 | [flows.md](flows.md#map-f06-01-攻城中断处理r2) |
| MAP-F06-02 | 攻城策略选项 | 强攻/围困/夜袭/内应(四维差异化) | [flows.md](flows.md#map-f06-02-攻城策略选项r2r5四维差异化) |
| MAP-F06-03 | 攻城策略道具获取 | 夜袭令:事件+商店; 内应信:攻城+事件+好感 | [flows.md](flows.md#map-f06-03-攻城策略道具获取r3) |
| MAP-F06-04 | 策略与奖励关系 | 强攻×0.9/围困×1.0/夜袭×1.2/内应×1.5 | [flows.md](flows.md#map-f06-04-策略与奖励关系r3r4调整) |
| MAP-F06-05 | 攻城锁定机制 | 攻城开始→锁定→暂停24h→续攻(元宝×50) | [flows.md](flows.md#map-f06-05-攻城锁定机制r3) |
| MAP-F06-06 | 科技加成来源明确 | 屯田/铸币/募兵/仓储术/城防工事/攻城术/夜战 | [flows.md](flows.md#map-f06-06-科技加成来源明确r4) |
| MAP-F06-07 | 内应信消费流程 | 背包校验→效果预估→扣取→执行→成功/失败分支 | [flows.md](flows.md#map-f06-07-内应信消费完整流程r5r6r7r8) |
| MAP-F06-08 | 四策略差异化 | 时间/损耗/前置/特效四维度差异化 | [flows.md](flows.md#map-f06-08-四种攻城策略差异化维度r5) |

### MAP-F07 筛选与热力图

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F07-01 | 筛选器实现逻辑 | 高产领地排序/可征服判定/热力图分档算法 | [flows.md](flows.md#map-f07-01-筛选器实现逻辑r2) |

### MAP-F08 攻城奖励领取

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F08-01 | 攻城胜利内应信掉落 | 胜利→20%概率掉落内应信 | [flows.md](flows.md#map-f08-01-攻城胜利内应信掉落r4) |

### MAP-F09 地图事件处理

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F09-01 | 地图事件内应信掉落 | 事件分支掉落内应信(遗迹25%/山贼15%) | [flows.md](flows.md#map-f09-01-地图事件内应信掉落r4) |
| MAP-F09-02 | 事件战斗分支机制 | 山贼战斗(公式修正)+遗迹探索(三档判定) | [flows.md](flows.md#map-f09-02-事件战斗分支机制r5r6公式修正r7数据修正r8上限修正) |

### MAP-F11 领土等级提升

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F11-01 | 领土等级提升消耗 | Lv5:无/Lv10:铜钱50000+元宝200/Lv15:铜钱200000+元宝500 | [flows.md](flows.md#map-f11-01-领土等级提升消耗r3r6终裁) |

### MAP-F12 离线领土变化查看

| 编号 | 名称 | 步骤概要 | 文档 |
|------|------|---------|------|
| MAP-F12-01 | 离线事件回归体验 | 登录→24h重算(累计衰减)→快速处理(80%奖励)→过期惩罚 | [flows.md](flows.md#map-f12-01-离线事件回归体验r4r5重设计r6修正r7r8修正) |
| MAP-F12-02 | 离线/在线双计数器 | 在线上限3/离线上限5/情报值系统/战斗重试令牌 | [flows.md](flows.md#map-f12-02-离线在线事件双计数器机制r5r7情报值系统r8修正r9r10r11) |
| MAP-F12-03 | 间歇性重度玩家 | 第8类玩家类型+极端周期分析(N=2/4/8/12) | [flows.md](flows.md#map-f12-03-间歇性重度玩家类型r10r11修正) |

---

## 三、跨系统流程(XI)

| 编号 | 涉及系统 | 衔接点 | 详细文档 |
|------|---------|--------|---------|
| XI-MAP-01 | MAP→RES | 领土产出→资源系统入库 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-02 | MAP→CBT | 攻城→战斗结算 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-03 | TEC→MAP | 科技加成→产出公式(7项科技) | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-04 | PRS→MAP | 声望加成→产出公式 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-05 | HER→MAP | 武将属性→领土加成 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-06 | MAP→QST/ACH | 征服→任务/成就进度 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-07 | MAP→ACT | 攻城→活动进度 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-08 | BLD→MAP | 城墙等级→攻城防御 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-09 | MAP→RES | 产出上限→资源停止累加 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-10 | MAP→CBT | 攻城策略→战斗参数 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-11 | MAP内部 | 领土等级→产出倍率 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-12 | MAP↔BLD | 产出上限↔仓储术科技共用 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-13 | MAP→背包 | 内应信掉落→背包系统 | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-14 | MAP↔背包 | 内应信完整生命周期(6阶段) | [flows.md](flows.md#跨系统流程xi) |
| XI-MAP-15 | MAP↔PRS | 阵营声望数据框架 | [flows.md](flows.md#跨系统流程xi) |

---

## 四、触发事件(TE)

| 编号 | 触发类型 | 描述 | 详细文档 |
|------|---------|------|---------|
| TE-MAP-01 | 定时 | 领土产出tick(每秒) | [flows.md](flows.md#触发事件te) |
| TE-MAP-02 | 条件 | 领土等级提升(占领时间达标) | [flows.md](flows.md#触发事件te) |
| TE-MAP-03 | 定时 | 城防自动恢复(每小时5%) | [flows.md](flows.md#触发事件te) |
| TE-MAP-04 | 定时 | 每日攻城次数重置(0点) | [flows.md](flows.md#触发事件te) |
| TE-MAP-05 | 随机 | 地图事件生成(每小时10%概率) | [flows.md](flows.md#触发事件te) |
| TE-MAP-06 | 条件 | 领土占领冷却结束(24h) | [flows.md](flows.md#触发事件te) |
| TE-MAP-07 | 离线 | 离线领土变化结算(登录时) | [flows.md](flows.md#触发事件te) |
| TE-MAP-08 | 离线 | 离线事件累积(每小时10%，最多5个) | [flows.md](flows.md#触发事件te) |
| TE-MAP-09 | 离线 | 离线事件过期(登录后24h累计衰减) | [flows.md](flows.md#触发事件te) |
| TE-MAP-10 | 条件 | 产出预警触发(>=80%) | [flows.md](flows.md#触发事件te) |

---

## 五、流程断裂点(GAP) — 最终状态

| 编号 | 描述 | R1状态 | 最终状态 |
|------|------|--------|---------|
| GAP-MAP-01 | 地图与建筑系统无联动 | 🔴 | ✅ 已解决(XI-MAP-08/12) |
| GAP-MAP-02 | 领土等级提升缺乏操作 | 🔴 | ✅ 已解决(MAP-F11-01投资) |
| GAP-MAP-03 | 攻城缺少战斗过程 | 🔴 | ✅ 已解决(策略选项R2+公式修正R6) |
| GAP-MAP-04 | 事件缺少后续影响 | 🔴 | ✅ 已解决(事件链R6) |
| GAP-MAP-05 | 新手引导缺失 | 🔴 | ✅ 已解决(MAP-F01-01) |
| GAP-MAP-06 | 领土放弃机制缺失 | 🔴 | ✅ 已解决(MAP-F05-01) |
| GAP-MAP-07 | 攻城冷却期无玩法 | 🔴 | ✅ 已解决(攻城锁定R5+冷却管理R7) |
| GAP-MAP-08 | 多人交互缺失 | 🔴 | ⚠️ 部分解决(NPCMapPlacer已实现，联盟攻城/排行榜流程未文档化) |

**GAP清零**: 7/8 已解决，1/8 部分解决

---

## 六、PRD修订建议(PRD-R) — 最终状态

| 编号 | 建议 | R1状态 | 最终状态 |
|------|------|--------|---------|
| PRD-R001 | 领土数量增加 | 待定 | ✅ 已采纳(领土变体R8) |
| PRD-R002 | 地形特殊效果 | 待定 | ✅ 已采纳(地形修正R2) |
| PRD-R003 | 攻城策略选项 | 待定 | ✅ 已采纳(MAP-F06-02 R2) |
| PRD-R004 | 事件链系统 | 待定 | ✅ 已采纳(事件链R6) |
| PRD-R005 | 终局目标 | 待定 | ✅ 已采纳(终局目标R8) |
| PRD-R006~R047 | 详见各轮round文件 | — | ✅ 已采纳(R4~R11) |

**PRD修订执行率**: 47/47 = 100% ✅

---

## 七、迭代进度

| 轮次 | 评分 | 关键改进 | 详细文档 |
|------|------|---------|---------|
| R1 | 6.8 | 初始枚举(12主流程/28子流程) | [flows](rounds/round-1-flows.md) [challenges](rounds/round-1-challenges.md) [verdict](rounds/round-1-verdict.md) |
| R2 | 7.4 | 征服恢复+攻城策略+新手引导 | [flows](rounds/round-2-flows.md) [challenges](rounds/round-2-challenges.md) [verdict](rounds/round-2-verdict.md) |
| R3 | 7.9 | 产出上限+道具获取+奖励调整 | [flows](rounds/round-3-flows.md) [challenges](rounds/round-3-challenges.md) [verdict](rounds/round-3-verdict.md) |
| R4 | 8.2 | 离线事件+产出上限统一 | [flows](rounds/round-4-flows.md) [challenges](rounds/round-4-challenges.md) [verdict](rounds/round-4-verdict.md) |
| R5 | 8.4 | 内应信闭环+离线体验修复 | [flows](rounds/round-5-flows.md) [challenges](rounds/round-5-challenges.md) [verdict](rounds/round-5-verdict.md) |
| R6 | 8.6 | 山贼公式修正+事件链+冷却管理 | [flows](rounds/round-6-flows.md) [challenges](rounds/round-6-challenges.md) [verdict](rounds/round-6-verdict.md) |
| R7 | 8.8 | P0清零+遗迹数据表+冷却管理器 | [flows](rounds/round-7-flows.md) [challenges](rounds/round-7-challenges.md) [verdict](rounds/round-7-verdict.md) |
| R8 | 9.0 | 终局目标+胜利损耗推导+声望衰减 | [flows](rounds/round-8-flows.md) [challenges](rounds/round-8-challenges.md) [verdict](rounds/round-8-verdict.md) |
| R9 | 9.2 | 公理声明化+并发安全+声望模拟7类玩家 | [flows](rounds/round-9-flows.md) [challenges](rounds/round-9-challenges.md) [verdict](rounds/round-9-verdict.md) |
| R10 | 9.4 | 三方交叉校验+A/B测试+沉没成本修正 | [flows](rounds/round-10-flows.md) [challenges](rounds/round-10-challenges.md) [verdict](rounds/round-10-verdict.md) |
| R11 | **9.0** | dailyLimit闭环+数值精确化 **SEALED** | [flows](rounds/round-11-flows.md) [challenges](rounds/round-11-challenges.md) [verdict](rounds/round-11-verdict.md) |

---

*天下(MAP) 流程清单 v3.0 | 2026-05-02 | R11 SEALED*
