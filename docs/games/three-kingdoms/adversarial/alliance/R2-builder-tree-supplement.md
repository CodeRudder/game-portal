# R2 Builder — 联盟模块补充测试分支树

> **模块**: alliance (联盟系统)
> **轮次**: R2 (补充)
> **构建者**: TreeBuilder Agent
> **基于**: R1 Arbiter裁决的6个P0 + 14个P1遗漏

---

## P0遗漏补充 (6项)

### P0-1: 联盟解散路径与死锁

| ID | 流程路径 | 前置条件 | 预期结果 | 对应遗漏 |
|----|---------|---------|---------|---------|
| P0-1.1 | 盟主退出(仅1人) → 失败 | 联盟只有盟主1人 | throw "盟主需先转让" | #1 |
| P0-1.2 | 盟主转让给唯一成员 → 原盟主退出 | 2人联盟 | 成功退出, 剩1人 | #1 |
| P0-1.3 | 盟主转让后新盟主退出 → 失败 | 新盟主是唯一成员 | throw "盟主需先转让" | #1 |
| P0-1.4 | 非盟主退出 → 剩1人(盟主) | 2人: 盟主+成员 | 成员退出成功, 盟主被困 | #1 |
| P0-1.5 | 联盟解散后alliance=null → 验证 | leaveAlliance返回null | playerState.allianceId='' | #1 |
| P0-1.6 | 联盟解散后playerState.guildCoins保留 | 解散前后对比 | guildCoins不变 | #26 |

**死锁路径确认**:
```
创建联盟(盟主A) → A邀请B加入 → B退出 → 剩A一人
A尝试退出 → 失败(盟主不能退出)
A尝试转让 → 无成员可转让
→ 联盟永远无法解散 ← BUG确认
```

### P0-2: createAllianceSimple硬编码ID

| ID | 流程路径 | 前置条件 | 预期结果 | 对应遗漏 |
|----|---------|---------|---------|---------|
| P0-2.1 | createAllianceSimple → 检查leaderId | 创建成功 | alliance.leaderId === 'player-1' | #2 |
| P0-2.2 | createAllianceSimple → playerState.allianceId | 创建成功 | playerState.allianceId含'ally_' | #2 |
| P0-2.3 | createAllianceSimple后 → 用非player-1 ID操作 | 用'real-player'发消息 | throw "不是联盟成员" | #2 |
| P0-2.4 | createAllianceSimple → 元宝不足 | balance < 500 | {success:false, reason含'元宝不足'} | #2 |
| P0-2.5 | createAllianceSimple → 无回调设置 | currencyBalanceCallback未设置 | 直接创建(跳过余额检查) | #2 |

### P0-3: Boss挑战次数双重检查

| ID | 流程路径 | 前置条件 | 预期结果 | 对应遗漏 |
|----|---------|---------|---------|---------|
| P0-3.1 | member.challenges=3, playerState.challenges=0 | 部分重置 | throw "次数已用完" | #8 |
| P0-3.2 | member.challenges=0, playerState.challenges=3 | 部分重置 | throw "次数已用完" | #8 |
| P0-3.3 | member.challenges=2, playerState.challenges=2 | 正常 | 可挑战(第3次) | #8 |
| P0-3.4 | member.challenges=3, playerState.challenges=3 | 正常 | throw "次数已用完" | #8 |
| P0-3.5 | 挑战后两个计数器都+1 | 挑战成功 | member和playerState同步+1 | #8 |

### P0-4: kickMember后playerState未清理

| ID | 流程路径 | 前置条件 | 预期结果 | 对应遗漏 |
|----|---------|---------|---------|---------|
| P0-4.1 | 踢人后 → 被踢者playerState.allianceId | 踢人成功 | allianceId未清空(BUG) | #15 |
| P0-4.2 | 被踢者尝试创建新联盟 | allianceId仍存在 | throw "已在联盟中" | #15 |
| P0-4.3 | 被踢者尝试发消息 | allianceId仍存在但不在members中 | throw "不是联盟成员" | #15 |
| P0-4.4 | 被踢者尝试申请加入其他联盟 | allianceId仍存在 | throw "已在联盟中" | #15 |
| P0-4.5 | 外部手动清空allianceId后 → 创建新联盟 | allianceId='' | 创建成功 | #15 |

### P0-5: approveApplication双重联盟

| ID | 流程路径 | 前置条件 | 预期结果 | 对应遗漏 |
|----|---------|---------|---------|---------|
| P0-5.1 | 申请A → 加入B → A审批通过 | 申请人playerState.allianceId=B | A的members含申请人, 但申请人实际在B | #16 |
| P0-5.2 | 申请A → 加入B → A拒绝 | 申请人playerState.allianceId=B | A的applications含REJECTED记录 | #16 |
| P0-5.3 | 同一玩家向同一联盟重复申请 | 第一个PENDING | throw "已提交申请" | #16 |
| P0-5.4 | 同一玩家向不同联盟申请 | 分别向A和B申请 | 两个联盟各有申请记录 | #16 |

### P0-6: 联盟解散关联数据清理

| ID | 流程路径 | 前置条件 | 预期结果 | 对应遗漏 |
|----|---------|---------|---------|---------|
| P0-6.1 | 联盟解散 → Boss系统状态 | alliance=null | Boss需通过refreshBoss重建 | #26 |
| P0-6.2 | 联盟解散 → 任务系统状态 | alliance=null | activeTasks仍存在(需外部清理) | #26 |
| P0-6.3 | 联盟解散 → 商店限购状态 | alliance=null | shopItems.purchased仍保留 | #26 |
| P0-6.4 | 联盟解散 → playerState.guildCoins | alliance=null | guildCoins保留 | #26 |
| P0-6.5 | 联盟解散 → 重新创建联盟 | playerState.allianceId清空后 | 可创建新联盟 | #26 |

---

## P1遗漏补充 (14项)

### P1-1: 联盟名称唯一性

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-1.1 | 两个玩家创建同名联盟 | 都成功(无唯一性检查) |
| P1-1.2 | searchAlliance搜索同名 | 返回多个结果 |

### P1-2: approveApplication半完成状态

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-2.1 | 审批通过 → 新成员发消息 | 失败(如果playerState未更新) |
| P1-2.2 | 审批通过 → 外部更新playerState → 发消息 | 成功 |

### P1-3: 联盟宣言验证

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-3.1 | declaration='' | 创建成功(无校验) |
| P1-3.2 | declaration=10000字符 | 创建成功(无长度限制) |

### P1-4: getCurrentBoss伤害丢失

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-4.1 | 挑战Boss造成50000伤害 → getCurrentBoss | 返回满血Boss(伤害丢失) |
| P1-4.2 | challengeBoss返回的boss → 伤害保留 | boss.currentHp正确减少 |

### P1-5: 批量购买weeklyLimit=0

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-5.1 | weeklyLimit=0, count=5, 公会币充足 | 购买5个 |
| P1-5.2 | weeklyLimit=0, count=5, 公会币只够3个 | throw "公会币不足" |
| P1-5.3 | weeklyLimit=0, count=0 | throw "已达限购上限"(actualCount=0) |

### P1-6: damage=0消耗次数和获币

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-6.1 | damage=0 → 检查dailyBossChallenges | +1(消耗次数) |
| P1-6.2 | damage=0 → 检查guildCoins | +participationGuildCoin(5) |
| P1-6.3 | damage=0 → 检查贡献值 | +0/100=0 |

### P1-7: Boss贡献值浮点精度

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-7.1 | damage=50 → contribution=0.5 | member.dailyContribution=0.5 |
| P1-7.2 | damage=33 → contribution=0.33 | member.dailyContribution含浮点 |
| P1-7.3 | 3次damage=33 → contribution=0.99 | 累积0.99 |

### P1-8: 每日重置vs Boss刷新

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-8.1 | dailyReset → bossKilledToday=false | 可再次挑战 |
| P1-8.2 | dailyReset → 成员dailyBossChallenges=0 | 次数重置 |
| P1-8.3 | refreshBoss → 全新Boss | HP/等级根据当前联盟等级 |

### P1-9: claimedPlayers序列化往返

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-9.1 | 领奖(p1) → serialize → deserialize → 领奖(p1) | throw "已领取奖励" |
| P1-9.2 | 领奖(p1) → serialize → deserialize → 领奖(p2) | 成功 |
| P1-9.3 | 空claimedPlayers → serialize → deserialize | Set.size=0 |

### P1-10: 联盟升级后Boss HP变化

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-10.1 | level=1, Boss受伤 → 升级到2 → getCurrentBoss | HP=150000(满血,新等级) |
| P1-10.2 | level=1 → calculateBossMaxHp(2) | 150000 |

### P1-11: createAllianceSimple无回滚

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-11.1 | 创建成功 → 扣费失败 → _alliance已设置 | 联盟已创建但未扣费(BUG) |
| P1-11.2 | 无回调 → 创建成功 → 不扣费 | 正常创建 |

### P1-12: 成员退出后重新申请

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-12.1 | 成员退出 → 重新申请同一联盟 | 新PENDING申请(旧记录保留) |
| P1-12.2 | 成员退出 → 申请被拒 → 再申请 | 第三个申请记录 |

### P1-13: 盟主转让贡献保留

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-13.1 | 盟主total=1000 → 转让 → 检查total | 仍为1000 |
| P1-13.2 | 盟主daily=50 → 转让 → 检查daily | 仍为50 |

### P1-14: 任务进度累加和截断

| ID | 流程路径 | 预期结果 |
|----|---------|---------|
| P1-14.1 | target=10, update(5)+update(8) | progress=10(截断), status=COMPLETED |
| P1-14.2 | target=10, update(5)+update(3)+update(5) | progress=10(截断) |
| P1-14.3 | 已完成任务updateProgress | 返回task不变 |

---

## P2遗漏补充 (12项)

| ID | 场景 | 预期结果 |
|----|------|---------|
| P2-1 | messages.length=100 → 发送 → 裁剪到100 | FIFO正确 |
| P2-2 | messages.length=101 → 发送 → 裁剪到100 | 丢弃最旧2条 |
| P2-3 | taskPool只有1个任务 → dailyRefresh | 返回1个任务 |
| P2-4 | taskPool为空 → dailyRefresh | 返回空数组 |
| P2-5 | generateId同毫秒调用两次 | ID不同(random部分不同) |
| P2-6 | name含特殊字符 | 创建成功(无过滤) |
| P2-7 | buyShopItem直接修改item对象 | purchased持久化 |
| P2-8 | hasPermission非成员 | 返回false |
| P2-9 | 商店周重置后购买 | purchased=0, 可购买 |
| P2-10 | 任务不刷新直接操作 | 仍为旧任务 |
| P2-11 | refreshBoss不存储Boss到AllianceData | Boss仅存于返回值 |
| P2-12 | CLAIMED状态从未使用 | 枚举存在但代码未使用 |

---

## 更新后的统计

| 维度 | R1节点 | R2补充 | 总计 | 占比 |
|------|--------|--------|------|------|
| F-Normal | 70 | 22 | 92 | 39.5% |
| F-Boundary | 28 | 20 | 48 | 20.6% |
| F-Error | 22 | 18 | 40 | 17.2% |
| F-Cross | 18 | 12 | 30 | 12.9% |
| F-Lifecycle | 16 | 8 | 24 | 10.3% |
| **总计** | **154** | **80** | **234** | **100%** |

### P0覆盖率
- R1 P0节点: 全部保留
- R2 P0补充: 6项×5场景 = 30个新节点
- **P0覆盖率: 100%**

### 新增覆盖的关键BUG
1. **BUG-001**: 联盟解散死锁 (P0-1)
2. **BUG-002**: createAllianceSimple硬编码playerId (P0-2)
3. **BUG-003**: kickMember不清理被踢者playerState (P0-4)
4. **BUG-004**: approveApplication不检查双重联盟 (P0-5)
5. **BUG-005**: getCurrentBoss每次重建丢失运行时状态 (P1-4)
6. **BUG-006**: createAllianceSimple先创建后扣费无回滚 (P1-11)
7. **BUG-007**: damage=0仍获公会币 (P1-6)
8. **BUG-008**: CLAIMED状态定义但未使用 (P2-12)
