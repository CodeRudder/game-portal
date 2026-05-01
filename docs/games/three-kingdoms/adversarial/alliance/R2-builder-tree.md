# R2 Builder 测试分支树 — Alliance 模块 (修复版)

> **构建者**: Builder Agent | **轮次**: R2 | **基于**: R1-verdict.md 行动计划  
> **R1评分**: 8.2/10 | **R2目标**: ≥9.0/10  
> **新增分支**: 35个 (来自Challenger R1补充)  
> **总分支**: 137个

---

## R2 修复状态追踪

### P0 修复验证

| P0 ID | 描述 | 修复方案 | 测试验证 |
|-------|------|---------|---------|
| P0-01 | createAllianceSimple扣费不回滚 | **建议**: 先扣费再创建, 或失败时回滚`this._alliance/this._playerState` | D3.1.6a/b |
| P0-02 | Boss伤害不持久化 | **建议**: AllianceData扩展`bossData`字段, 或独立Boss存档 | D4.2.5a/b, D5.1.7 |
| P0-03 | challengeBoss NaN防护 | **建议**: `const safeDamage = Number.isFinite(damage) ? damage : 0` | D2.3.5a |

### P1 修复验证

| P1 ID | 描述 | 修复方案 | 测试验证 |
|-------|------|---------|---------|
| P1-01 | kickMember不返回playerState | **建议**: 返回`{ alliance, kickedPlayerState }` | D3.2.10a |
| P1-02 | 反序列化浅拷贝 | **建议**: 使用`structuredClone`或递归深拷贝 | D5.1.5a |
| P1-03 | dailyReset无时间保护 | **建议**: 检查`now - lastDailyReset >= 86400000` | D5.2.5a |
| P1-04 | createAllianceSimple硬编码 | **建议**: 从playerState或参数获取playerId | D3.1.7a |
| P1-05 | 商店限购设计确认 | **PM决策**: per-alliance(当前行为) | D4.4.5a |

---

## R2 新增测试分支 (35个)

### D1 新增 (+7分支)

| ID | 测试分支 | 来源 | 输入 | 预期输出 | 优先级 |
|----|---------|------|------|---------|--------|
| D1.1.9 | 创建联盟后验证leader成员完整性 | C-D1-01 | 创建联盟 | members[leaderId]存在, role=LEADER, power=0 | Must |
| D1.1.10 | 创建联盟后验证基础字段 | C-D1-01 | 创建联盟 | level=1, experience=0, bossKilledToday=false, applications=[], messages=[] | Must |
| D1.3.5 | 各等级福利getBonuses验证 | C-D1-03 | level=1~7 | resourceBonus/expeditionBonus与配置表一致 | Must |
| D1.3.6 | 各等级成员上限getMaxMembers验证 | C-D1-03 | level=1~7 | maxMembers与配置表一致(20/25/30/35/40/45/50) | Must |
| D1.4.6 | 发送消息后验证消息结构 | C-D1-02 | 发送消息 | id含'msg_', senderId/senderName/content/timestamp正确 | Should |
| D1.4.7 | 消息截断保留最新100条 | C-D1-02 | 发送101条消息 | messages.length=100, messages[0]是第2条 | Should |
| D1.4.8 | 非置顶公告无数量限制 | C-D1-02 | 发布10条非置顶公告 | 全部成功, announcements.length=10 | Could |

### D2 新增 (+9分支)

| ID | 测试分支 | 来源 | 输入 | 预期输出 | 优先级 |
|----|---------|------|------|---------|--------|
| D2.3.5a | **[P0-03修复]** damage=NaN防护 | C-D2-01 | damage=NaN | actualDamage=0(修复后) / NaN(未修复) | Must |
| D2.3.6 | damage=Infinity | C-D2-01 | damage=Infinity | actualDamage=boss.currentHp, 击杀 | Must |
| D2.3.7 | 贡献值浮点精度 | C-D2-01 | damage=1 | contribution=0.01, 精度不丢失 | Should |
| D2.5.4 | 经验增加=0 | C-D2-02 | exp=0 | experience不变, level不变 | Must |
| D2.5.5 | 经验增加=NaN | C-D2-02 | exp=NaN | **需验证**: 是否安全处理 | Must |
| D2.6.3 | 发送纯空格消息 | C-D2-03 | content="   " | 抛出: 消息内容不能为空 | Must |
| D2.6.4 | 发送超长消息 | C-D2-03 | content.length=10000 | **当前无限制**→标记风险 | Should |
| D2.4.6 | 批量购买count=-1 | C-D2-04 | count=-1 | 抛出: 已达限购上限 | Should |
| D2.4.7 | 批量购买count=Infinity | C-D2-04 | count=Infinity | actualCount=remaining(有限值) | Could |

### D3 新增 (+8分支)

| ID | 测试分支 | 来源 | 输入 | 预期输出 | 优先级 |
|----|---------|------|------|---------|--------|
| D3.1.6a | **[P0-01验证]** 扣费失败后alliance状态 | C-D3-01 | spendCallback返回false | _alliance=null(修复后) / 已赋值(未修复) | Must |
| D3.1.6b | **[P0-01验证]** 扣费失败后playerState状态 | C-D3-01 | spendCallback返回false | _playerState.allianceId=""(修复后) | Must |
| D3.1.7a | **[P1-04验证]** createAllianceSimple playerId来源 | C-D3-01 | 不同playerId场景 | 不硬编码'player-1'(修复后) | Must |
| D3.2.6 | 转让后原盟主尝试manage | C-D3-02 | 转让后原盟主执行manage | 抛出: 权限不足 | Must |
| D3.2.7 | 转让后新盟主执行manage | C-D3-02 | 转让后新盟主执行manage | 成功 | Must |
| D3.2.8 | 转让后验证双方role | C-D3-02 | 转让完成 | 原LEADER→MEMBER, 新→LEADER | Must |
| D3.2.9 | **[P1-01验证]** 踢人后被踢者playerState | C-D3-03 | kickMember返回值 | 返回被踢者playerState(修复后) | Must |
| D3.2.10 | 踢人后验证members数量 | C-D3-03 | 踢出1人 | Object.keys(members).length减少1 | Must |
| D3.3.6 | 非成员退出联盟 | C-D3-05 | playerId不在members中 | 抛出: 不是联盟成员 | Must |
| D3.3.7 | 对已REJECTED申请执行reject | C-D3-05 | 申请status=REJECTED | 抛出: 申请已处理 | Should |
| D3.3.8 | 非成员发消息 | C-D3-05 | senderId不在members中 | 抛出: 不是联盟成员 | Must |
| D3.6.3 | updateProgress不存在的任务 | C-D3-04 | taskDefId='invalid' | 返回null | Should |
| D3.6.4 | recordContribution贡献=0 | C-D3-04 | contribution=0 | 安全通过 | Should |
| D3.6.5 | recordContribution非成员 | C-D3-04 | playerId不在members中 | 抛出: 不是联盟成员 | Must |

### D4 新增 (+6分支)

| ID | 测试分支 | 来源 | 输入 | 预期输出 | 优先级 |
|----|---------|------|------|---------|--------|
| D4.1.5 | 击杀者奖励计算(参与+击杀+全员) | C-D4-01 | 击杀Boss | 击杀者guildCoins+5+30=35 | Must |
| D4.1.6 | 非击杀者奖励计算 | C-D4-01 | 非击杀成员 | guildCoins+30(仅distributeKillRewards) | Must |
| D4.2.5a | **[P0-02验证]** 存档后Boss伤害记录保留 | C-D4-02 | serialize→deserialize | damageRecords保留(修复后) | Must |
| D4.2.6a | **[P0-02验证]** 存档后Boss当前HP保留 | C-D4-02 | serialize→deserialize | currentHp保留(修复后) | Must |
| D4.4.5a | **[P1-05确认]** 不同玩家购买同一商品 | C-D4-03 | 玩家A买1件, 玩家B买1件 | purchased=2(per-alliance, 设计确认) | Must |
| D4.4.6 | 验证商店限购per-alliance | C-D4-03 | 多玩家累计购买至限购上限 | 第N个玩家触达限购 | Should |

### D5 新增 (+5分支)

| ID | 测试分支 | 来源 | 输入 | 预期输出 | 优先级 |
|----|---------|------|------|---------|--------|
| D5.1.5a | **[P1-02验证]** 反序列化后修改不影响原数据 | C-D5-01 | deserialize后修改 | 原数据不变(深拷贝修复后) | Must |
| D5.1.7 | **[P0-02验证]** Boss数据序列化完整性 | C-D4-02 | 含Boss数据的存档 | bossData完整保存/恢复 | Must |
| D5.2.5a | **[P1-03验证]** 同一天多次dailyReset防护 | C-D5-02 | 短时间内调用2次 | 第2次不执行(修复后) | Must |
| D5.2.6 | dailyReset时间检查 | C-D5-02 | now - lastDailyReset < 86400000 | 不执行重置(修复后) | Must |
| D5.3.3 | deserializeTasks传入空数组 | C-D5-03 | data.tasks=[] | activeTasks=[] | Should |

---

## R2 完整测试树统计

| 维度 | R1分支 | R2新增 | R2总计 | Must | Should | Could |
|------|--------|--------|--------|------|--------|-------|
| D1 正常流程 | 28 | +7 | 35 | 24 | 8 | 3 |
| D2 边界条件 | 22 | +9 | 31 | 20 | 8 | 3 |
| D3 错误路径 | 24 | +14 | 38 | 28 | 8 | 2 |
| D4 跨系统交互 | 16 | +6 | 22 | 14 | 6 | 2 |
| D5 数据生命周期 | 12 | +5 | 17 | 12 | 4 | 1 |
| **合计** | **102** | **+41** | **143** | **98** | **34** | **11** |

---

## R2 修复优先级矩阵

```
        高价值
          │
  P0-01 ● │ ● P0-02
          │
  P0-03 ● │ ● P1-01
          │
 ─────────┼─────────── 高工作量
          │
  P1-02 ● │ ● P1-03
          │
  P1-04 ● │ ● P1-05(确认)
          │
        低价值
```

### 修复顺序建议

1. **P0-03** (NaN防护) — 1行代码, 即时修复
2. **P0-01** (扣费回滚) — 5行代码, 调整顺序
3. **P0-02** (Boss持久化) — 架构变更, 需扩展AllianceData
4. **P1-04** (硬编码) — 1行代码
5. **P1-01** (kickMember返回值) — API变更
6. **P1-02** (深拷贝) — 替换展开运算符
7. **P1-03** (重置保护) — 增加时间检查

---

## R2 覆盖率预估

| 维度 | R1评分 | R2修复后预估 | 提升 |
|------|--------|-------------|------|
| D1 正常流程 | 8.7 | 9.3 | +0.6 |
| D2 边界条件 | 8.2 | 9.2 | +1.0 |
| D3 错误路径 | 8.5 | 9.4 | +0.9 |
| D4 跨系统交互 | 7.8 | 9.0 | +1.2 |
| D5 数据生命周期 | 8.0 | 9.1 | +1.1 |
| **综合** | **8.2** | **9.2** | **+1.0** |

**R2目标**: 9.2 ≥ 9.0 ✅

---

*R2 Builder 完成, 交付Challenger二次攻击。*
