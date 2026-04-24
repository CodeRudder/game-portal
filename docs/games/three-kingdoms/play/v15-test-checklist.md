# v15.0 事件风云 — 集成测试检查清单

> **版本**: v15.0 事件风云  
> **日期**: 2026-04-24  
> **测试框架**: Vitest  
> **测试环境**: jsdom  

---

## 测试文件总览

| 文件 | 覆盖章节 | 通过 | 跳过 | 总计 |
|------|---------|------|------|------|
| `event-trigger.integration.test.ts` | §1 事件系统 | 32 | 0 | 32 |
| `chain-event.integration.test.ts` | §2 链式事件 | 32 | 0 | 32 |
| `activity-system.integration.test.ts` | §3 活动系统 | 27 | 10 | 37 |
| **合计** | — | **91** | **10** | **101** |

---

## §1 事件系统 — event-trigger.integration.test.ts

### §1.1 事件注册与生命周期 (5/5)
- [x] 应成功注册单个事件定义
- [x] 应成功批量注册事件定义
- [x] 应按触发类型筛选事件定义
- [x] 应正确重置系统状态
- [x] 应正确序列化和反序列化系统状态

### §1.2 触发条件引擎 (7/7)
- [x] 应正确评估 turn_range 条件 — minTurn
- [x] 应正确评估 turn_range 条件 — maxTurn
- [x] 应正确评估 turn_range 条件 — turnInterval
- [x] 应正确评估 resource_threshold 条件
- [x] 应正确评估 event_completed 条件
- [x] 固定事件应在条件满足时可触发

### §1.3 概率公式 P = clamp(base + Σ(add) × Π(mul), 0, 1) (8/8)
- [x] 基础概率无修正时应返回 base
- [x] 加法修正应累加到概率上
- [x] 乘法修正应累乘到概率上
- [x] 混合加法+乘法修正应按公式计算
- [x] 非活跃修正因子应被忽略
- [x] 最终概率应 clamp 到 [0, 1]
- [x] EventTriggerSystem 应支持注册概率条件

### §1.4 事件触发与冷却 (5/5)
- [x] 强制触发应成功创建事件实例
- [x] 触发不存在的事件应失败
- [x] 已完成的事件不应再次触发
- [x] 活跃事件数达到上限时应阻止新触发
- [x] checkAndTriggerEvents 应返回新触发的事件实例列表

### §1.5 通知优先级（6级）(7/7)
- [x] 应按紧急程度创建横幅通知
- [x] 横幅应按优先级排序 — critical > high > medium > low
- [x] 应正确追踪未读横幅数量
- [x] 标记已读后应更新未读状态
- [x] 过期横幅应在 expireBanners 时被移除
- [x] 批量创建横幅应正常工作

### §1.6 事件选项与后果 (3/3)
- [x] resolveEvent 应正确处理选项选择
- [x] resolveEvent 不存在的实例应返回 null
- [x] 过期事件应在 expireEvents 时被清理

---

## §2 链式事件 — chain-event.integration.test.ts

### §2.1 连锁引擎注册与启动 (8/8)
- [x] 应成功注册事件链定义
- [x] 应成功批量注册事件链
- [x] 超过最大深度的链应拒绝注册
- [x] 节点深度超过链最大深度应拒绝注册
- [x] startChain 应返回根节点（depth=0）
- [x] startChain 不存在的链应返回 null
- [x] startChain 无根节点的链应返回 null
- [x] 启动链应发出 chain:started 事件

### §2.2 分支路径推进（选择驱动）(7/7)
- [x] 线性链应按选择推进到下一节点
- [x] 线性链推进到最后应标记完成
- [x] 分支链应按选项走不同路径
- [x] 分支链外交路径应正确推进
- [x] 无效选项应导致链完成（无后续节点）
- [x] 深层分支链应支持多级推进
- [x] 推进链应发出 chain:advanced 事件

### §2.3 链进度追踪 (7/7)
- [x] getProgress 应返回正确的进度数据
- [x] getProgressStats 应返回正确的完成统计
- [x] 推进后 completedNodeIds 应增加
- [x] isChainStarted 应正确反映链启动状态
- [x] isChainCompleted 应正确反映链完成状态
- [x] getCurrentNode 应返回当前活跃节点
- [x] getNextNodes 应返回指定节点的后续节点

### §2.4 链超时与完成检测 (4/4)
- [x] 已完成链不应再推进
- [x] 未启动链不应推进
- [x] 链完成时应记录 completedAt 时间
- [x] 链完成应发出 chain:completed 事件

### §2.5 并发链管理 (3/3)
- [x] 应支持同时启动多条链
- [x] 并发链推进应互不影响
- [x] reset 应清除所有链进度

### §2.6 序列化/反序列化 (3/3)
- [x] 应正确导出存档数据
- [x] 应正确导入存档数据
- [x] 空存档数据应正常处理

---

## §3 活动系统 — activity-system.integration.test.ts

### §3.1 代币兑换商店（七阶稀有度 + 限购 + 刷新）(15/15)
- [x] 应正确初始化商店并加载默认商品
- [x] 应正确查询代币余额
- [x] 应正确增加代币
- [x] 应正确消耗代币
- [x] 代币不足时应拒绝消耗
- [x] 应成功购买可用商品
- [x] 购买不存在的商品应失败
- [x] 代币不足时应拒绝购买
- [x] 达到限购数量后应拒绝购买
- [x] 批量购买应正确计算总价
- [x] 下架商品不应可购买
- [x] refreshShop 应重置所有商品购买计数
- [x] 按稀有度筛选商品应正确工作
- [x] getAvailableItems 应仅返回可购买商品
- [x] dailyRefresh 应重置限购并提供新商品

### §3.2 签到系统（7天循环 + 连续加成 + 补签）(12/12)
- [x] 首次签到应从第1天开始
- [x] 连续签到应递增天数
- [x] 7天循环应正确回绕
- [x] 断签后应重置为第1天
- [x] 同一天重复签到应抛出错误
- [x] 连续3天应获得20%加成
- [x] 连续7天应获得50%加成
- [x] 补签应消耗元宝并增加连续天数
- [x] 元宝不足时应拒绝补签
- [x] 本周补签次数用完应拒绝
- [x] getReward 应返回对应天数的奖励
- [x] getConsecutiveBonus 不足3天应返回0

### §3.3 限时活动流程（预览→活跃→结算→关闭）(0/4)
- [ ] 应在预览阶段显示活动预告 *(it.skip)*
- [ ] 应在活跃阶段允许参与活动任务 *(it.skip)*
- [ ] 应在结算阶段计算排行榜奖励 *(it.skip)*
- [ ] 应在关闭阶段清理活动数据 *(it.skip)*

### §3.4 活跃度系统（任务积分 + 里程碑奖励）(0/3)
- [ ] 应正确计算任务积分 *(it.skip)*
- [ ] 应正确解锁里程碑奖励 *(it.skip)*
- [ ] 应正确计算离线进度累积 *(it.skip)*

### §3.5 活动排行榜（积分排序 + 奖励梯度）(0/3)
- [ ] 应按积分降序排列排行 *(it.skip)*
- [ ] 应正确分配奖励档位 *(it.skip)*
- [ ] 应限制排行榜最大人数 *(it.skip)*

---

## 封版验证

```bash
# 运行集成测试
npx vitest run src/games/three-kingdoms/engine/event/__tests__/integration/ \
  event-trigger.integration.test.ts \
  chain-event.integration.test.ts \
  activity-system.integration.test.ts

# 结果: 3 files | 91 passed | 10 skipped | 101 total
```

---

*Generated: 2026-04-24*
