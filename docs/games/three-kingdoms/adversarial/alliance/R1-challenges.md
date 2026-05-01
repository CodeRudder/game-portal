# R1 Challenger 挑战报告 — Alliance 模块

> **挑战者**: Challenger Agent | **日期**: 2025-01-XX  
> **审查对象**: R1-builder-tree.md (102分支)  
> **挑战策略**: 5维度逐维度攻击, 补充遗漏分支, 质疑已有分支充分性

---

## 挑战总评

| 维度 | Builder分支 | 挑战新增 | 缺陷发现 | 覆盖率调整 |
|------|-----------|---------|---------|-----------|
| D1 正常流程 | 28 | +7 | 3 | 9.2→8.5 |
| D2 边界条件 | 22 | +9 | 4 | 8.8→8.0 |
| D3 错误路径 | 24 | +8 | 5 | 9.0→8.2 |
| D4 跨系统交互 | 16 | +6 | 4 | 8.5→7.5 |
| D5 数据生命周期 | 12 | +5 | 3 | 8.7→7.8 |
| **合计** | **102** | **+35** | **19** | **8.8→8.0** |

---

## D1 挑战 — 正常流程

### 🔴 C-D1-01: 联盟创建后leader自动成为成员【缺陷-逻辑遗漏】

**质疑**: Builder D1.1.1只验证了`allianceId`设置, 未验证:
- `alliance.members[leaderId]`是否存在
- `alliance.members[leaderId].role`是否为`LEADER`
- `alliance.leaderId`是否正确

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D1.1.9 | 创建联盟后验证leader成员数据完整性 | members[leaderId].role=LEADER, power=0, joinTime=now |
| D1.1.10 | 创建联盟后验证alliance基础字段 | level=1, experience=0, bossKilledToday=false |

**严重度**: P1 — 核心创建逻辑未充分验证

### 🔴 C-D1-02: 联盟消息发送缺少成员校验细节

**质疑**: D1仅测试"发送消息", 但未覆盖:
- 消息ID格式正确性
- 消息列表是否按时间排序
- 消息截断后是否保留最新(非最旧)

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D1.7.4 | 发送消息后验证消息结构 | id含'msg_'前缀, senderId/senderName/content/timestamp正确 |
| D1.7.5 | 消息截断保留最新100条 | 发送101条后, messages[0]是第2条(最早的被截) |

### 🟡 C-D1-03: 联盟等级福利验证不足

**质疑**: Builder D1.3测试了经验增加, 但未验证:
- `getBonuses()`返回值是否与等级配置一致
- `getMaxMembers()`是否与等级配置一致

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D1.3.5 | 各等级福利getBonuses验证 | level=3→resourceBonus=4, expeditionBonus=2 |
| D1.3.6 | 各等级成员上限getMaxMembers验证 | level=5→maxMembers=40 |

---

## D2 挑战 — 边界条件

### 🔴 C-D2-01: Boss伤害计算边界未覆盖【缺陷-数值溢出】

**质疑**: Builder D2.3覆盖了0/负数/超HP, 但遗漏:
- `damage=NaN`时`Math.max(0, Math.min(NaN, hp))`的结果
- `damage=Infinity`时`Math.min(Infinity, hp)=hp`
- `boss.currentHp=0`时挑战(已死但status仍为ALIVE的不一致状态)
- 贡献值计算: `actualDamage / 100` — damage=1时contribution=0.01, 浮点精度问题

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D2.3.5 | damage=NaN | Math.max(0, Math.min(NaN, hp))=NaN→**潜在Bug** |
| D2.3.6 | damage=Infinity | Math.min(Infinity, hp)=hp, 击杀 |
| D2.3.7 | 贡献值浮点精度 | damage=1→contribution=0.01, totalContribution精度 |

**严重度**: P1 — NaN处理缺失可能导致数据污染

### 🔴 C-D2-02: 联盟经验负数/零值边界【缺陷-安全遗漏】

**质疑**: Builder未测试:
- `addExperience(alliance, 0)` — 应该安全
- `addExperience(alliance, -100)` — Math.max(0, exp)保护, 但验证了吗?
- `addExperience(alliance, NaN)` — NaN+NaN=NaN, 可能破坏等级

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D2.5.4 | 经验增加=0 | experience不变, level不变 |
| D2.5.5 | 经验增加=NaN | **需验证**: NaN传播是否破坏level |

### 🟡 C-D2-03: 空内容消息/公告边界

**质疑**: Builder D2.6只测了置顶上限, 遗漏:
- 空字符串消息(已被`!content.trim()`拦截)
- 纯空格消息(也被`trim()`拦截)
- 超长消息(无长度限制!)

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D2.6.3 | 发送纯空格消息 | 抛出: 消息内容不能为空 |
| D2.6.4 | 发送超长消息(10000字) | **当前无限制**→标记风险 |
| D2.6.5 | 发送公告内容为空 | 抛出: 公告内容不能为空 |

### 🟡 C-D2-04: 商店批量购买边界

**质疑**: Builder D2.4.5测了weeklyLimit=0, 但未测:
- `buyShopItemBatch`中`count=负数`时`actualCount=Math.min(-1, remaining)`→负数→抛出
- `buyShopItemBatch`中`count=Infinity`时行为

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D2.4.6 | 批量购买count=-1 | actualCount<=0, 抛出: 已达限购上限 |
| D2.4.7 | 批量购买count=Infinity | remaining有限, actualCount=remaining |

---

## D3 挑战 — 错误路径

### 🔴 C-D3-01: createAllianceSimple竞态条件【缺陷-原子性】

**质疑**: 分析源码发现:
```typescript
// 1. 先检查余额
if (this.currencyBalanceCallback) {
  const balance = this.currencyBalanceCallback('ingot');
  if (balance < costGold) return { success: false, reason: '元宝不足' };
}
// 2. 创建联盟(修改状态)
const result = this.createAlliance(...);
// 3. 扣除元宝
if (this.currencySpendCallback) {
  const spent = this.currencySpendCallback('ingot', costGold);
  if (!spent) return { success: false, reason: '元宝扣除失败' };
}
```

**问题**: 步骤2已修改`this._playerState`(在createAlliance中), 但步骤3如果失败, 已修改的状态**未回滚**!

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D3.1.6 | 元宝扣除失败后状态回滚 | _alliance和_playerState应保持原值(当前**不会回滚**) |

**严重度**: **P0 — 数据一致性Bug!** 创建成功但扣费失败时, alliance已赋值但元宝未扣除

### 🔴 C-D3-02: 盟主转让后原盟主角色验证【缺陷-遗漏】

**质疑**: Builder D1.2.4测了转让, 但未验证转让后:
- 原盟主是否能执行manage操作
- 新盟主是否能执行manage操作
- 转让后members中两个人的role是否都正确

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D3.2.6 | 转让后原盟主尝试manage | 抛出: 权限不足 |
| D3.2.7 | 转让后新盟主执行manage | 成功 |
| D3.2.8 | 转让后验证双方role | 原LEADER→MEMBER, 目标→LEADER |

### 🔴 C-D3-03: 踢人后成员数据一致性【缺陷-遗漏】

**质疑**: Builder D3.2.2/3测了踢人错误, 但未验证踢人后:
- 被踢成员的playerState是否清空allianceId(当前代码**不处理**!)
- 踢人后联盟成员数是否正确

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D3.2.9 | 踢人后验证被踢者playerState | **当前不返回playerState**→需外部处理, 标记为API缺陷 |
| D3.2.10 | 踢人后验证members数量 | Object.keys(members).length减少1 |

**严重度**: P1 — kickMember不返回被踢者playerState, 外部需自行处理

### 🟡 C-D3-04: 任务系统错误路径遗漏

**质疑**: Builder遗漏:
- `updateProgress`对不存在任务的返回值(返回null, 未测试)
- `claimTaskReward`对不存在任务定义的处理(def找不到时抛出)
- `recordContribution`贡献值为0/负数

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D3.6.3 | updateProgress不存在的任务 | 返回null |
| D3.6.4 | recordContribution贡献=0 | 安全通过, contribution不变 |
| D3.6.5 | recordContribution非成员 | 抛出: 不是联盟成员 |

### 🟡 C-D3-05: 重复操作防护遗漏

**质疑**: Builder未测试:
- 重复退出联盟(第二次退出)
- 重复创建联盟(已创建后再创建)
- 对已REJECTED申请再次审批

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D3.3.6 | 非成员退出联盟 | 抛出: 不是联盟成员 |
| D3.3.7 | 对已REJECTED申请执行reject | 抛出: 申请已处理 |
| D3.3.8 | 非成员发消息 | 抛出: 不是联盟成员 |

---

## D4 挑战 — 跨系统交互

### 🔴 C-D4-01: Boss击杀奖励+全员奖励双重发放【缺陷-逻辑Bug】

**质疑**: 分析源码发现:
```typescript
// challengeBoss中:
if (isKillingBlow) {
  killReward = { guildCoin: 30, destinyPoint: 20 };
}
let guildCoinReward = this.config.participationGuildCoin; // 5
// 更新玩家:
guildCoins: playerState.guildCoins + guildCoinReward  // +5
```

**问题**: 击杀者获得`guildCoinReward=5`(参与奖) + `killReward.guildCoin=30`(击杀奖), 但`killReward`只是返回值, **未自动加到guildCoins**! 击杀者实际只得5公会币, 30需外部处理。

而`distributeKillRewards`是给**全员**加30, 包括击杀者自己! 所以击杀者会获得5+30=35, 其他成员获得30。

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D4.1.5 | 击杀者奖励计算(参与+击杀+全员) | 击杀者guildCoins+5(challengeBoss) +30(distributeKillRewards)=35 |
| D4.1.6 | 非击杀者奖励计算 | 非击杀者guildCoins+5(challengeBoss) +30(distributeKillRewards)=35 |

**严重度**: P1 — 奖励发放逻辑分散, 需明确文档化

### 🔴 C-D4-02: Boss伤害记录不持久化【缺陷-数据丢失】

**质疑**: `AllianceData`接口中**没有**`boss`或`damageRecords`字段! `getCurrentBoss`每次根据`lastBossRefreshTime`重建Boss, **damageRecords丢失**!

```typescript
getCurrentBoss(alliance: AllianceData): AllianceBoss {
  const boss = createBoss(alliance.level, alliance.lastBossRefreshTime);
  // ↑ 每次创建全新Boss, damageRecords={}
  if (alliance.bossKilledToday) { boss.status = BossStatus.KILLED; boss.currentHp = 0; }
  return boss;
}
```

**问题**: Boss伤害数据不持久化, 存档加载后Boss重置为满血!

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D4.2.5 | 存档后Boss伤害记录保留 | **当前丢失**→P0缺陷 |
| D4.2.6 | 存档后Boss当前HP保留 | **当前丢失**→P0缺陷 |

**严重度**: **P0 — Boss数据不持久化, 存档后全部丢失!**

### 🟡 C-D4-03: 多玩家商店限购共享问题

**质疑**: `AllianceShopSystem`的`shopItems`是实例属性, 所有玩家共享。`purchased`计数器是全局的, 不是per-player! 这意味着:
- 玩家A买了1件, purchased=1
- 玩家B再买, purchased=2
- 限购5次是**全联盟共享**而非每人5次

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D4.4.5 | 不同玩家购买同一商品限购共享 | purchased全局累加(设计如此?) |
| D4.4.6 | 验证限购是per-player还是per-alliance | **当前是per-alliance** |

**严重度**: P1 — 需确认设计意图, 可能是Bug

### 🟡 C-D4-04: 联盟战争模块缺失

**质疑**: 用户需求明确提到"联盟战争", 但源码中**没有AllianceWarSystem**! `__tests__`中有`P0-alliance-war.test.ts`, 说明战争功能可能是独立模块或待实现。

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D4.5.1 | 联盟战争模块存在性检查 | **未找到**→标记为Won't/Won't Have |
| D4.5.2 | AllianceRankType有POWER/BOSS_DAMAGE但无排名系统实现 | 排行榜类型已定义但无实现 |

---

## D5 挑战 — 数据生命周期

### 🔴 C-D5-01: 存档反序列化浅拷贝风险【缺陷-引用共享】

**质疑**: `deserializeAlliance`使用展开运算符:
```typescript
return {
  playerState: { ...data.playerState },
  alliance: data.allianceData ? { ...data.allianceData } : null,
};
```
这是**浅拷贝**! `members`, `applications`, `announcements`, `messages`仍然是引用共享!

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D5.1.5 | 反序列化后修改不影响原数据 | **当前会互相影响**→P1 |
| D5.1.6 | 序列化后修改alliance不影响saveData | 浅拷贝风险 |

**严重度**: P1 — 浅拷贝导致存档数据污染

### 🔴 C-D5-02: 每日重置时间判断缺失【缺陷-逻辑遗漏】

**质疑**: `dailyReset`方法直接重置, **不检查是否已重置过**! 没有基于`lastDailyReset`的时间判断, 多次调用会多次重置。

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D5.2.5 | 同一天多次dailyReset | 成员贡献被多次清零→**设计缺陷** |
| D5.2.6 | dailyReset不检查lastDailyReset | 无时间保护→可被滥用 |

**严重度**: P1 — 缺少重置时间保护

### 🟡 C-D5-03: 任务claimedPlayers序列化完整性

**质疑**: `Set<string>`序列化为`string[]`, 反序列化恢复为`Set<string>`. 但如果存档数据中`claimedPlayers`为null/undefined会怎样?

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D5.3.3 | deserializeTasks传入null | 应安全处理(当前会crash?) |
| D5.3.4 | deserializeTasks传入空数组 | activeTasks=[] |

---

## 挑战总结 — 缺陷清单

### P0 缺陷 (必须修复)

| # | 缺陷ID | 描述 | 影响 |
|---|--------|------|------|
| 1 | **BUG-P0-01** | createAllianceSimple扣费失败不回滚alliance状态 | 元宝未扣但联盟已创建 |
| 2 | **BUG-P0-02** | Boss伤害记录/当前HP不持久化 | 存档加载后Boss满血重置 |
| 3 | **BUG-P0-03** | damage=NaN时actualDamage=NaN, 污染damageRecords | 数据污染 |

### P1 缺陷 (应当修复)

| # | 缺陷ID | 描述 | 影响 |
|---|--------|------|------|
| 4 | BUG-P1-01 | kickMember不返回被踢者playerState | 外部需自行清空allianceId |
| 5 | BUG-P1-02 | 反序列化浅拷贝导致引用共享 | 存档数据污染 |
| 6 | BUG-P1-03 | dailyReset无时间保护, 可多次重置 | 贡献值被意外清零 |
| 7 | BUG-P1-04 | createAllianceSimple硬编码playerId='player-1' | 多玩家场景失效 |
| 8 | BUG-P1-05 | 商店限购per-alliance而非per-player(需确认设计意图) | 可能是Bug |
| 9 | BUG-P1-06 | 联盟名称/公告/消息无XSS过滤 | 安全风险 |
| 10 | BUG-P1-07 | declaration/消息内容无长度限制 | 内存/存储滥用 |

### P2 缺陷 (建议修复)

| # | 缺陷ID | 描述 | 影响 |
|---|--------|------|------|
| 11 | BUG-P2-01 | generateId高并发可能冲突 | ID重复 |
| 12 | BUG-P2-02 | 联盟排行榜类型已定义但无实现 | 功能缺失 |
| 13 | BUG-P2-03 | 联盟战争模块缺失 | 功能缺失 |
| 14 | BUG-P2-04 | 任务进度超额不截断 | 进度可超过target |

---

## 覆盖率评分调整

| 维度 | Builder自评 | Challenger调整 | 理由 |
|------|-----------|--------------|------|
| D1 正常流程 | 9.2 | **8.5** | 创建后字段验证不足, 等级福利未验证 |
| D2 边界条件 | 8.8 | **8.0** | NaN/Infinity未覆盖, 消息长度未限制 |
| D3 错误路径 | 9.0 | **8.2** | 竞态条件遗漏, 踢人后状态一致性 |
| D4 跨系统交互 | 8.5 | **7.5** | Boss数据不持久化, 奖励逻辑分散 |
| D5 数据生命周期 | 8.7 | **7.8** | 浅拷贝风险, 重置时间保护缺失 |
| **综合** | **8.8** | **8.0** | **3个P0 + 7个P1 + 4个P2 = 未达封版线9.0** |

---

## 判定: ❌ 未通过 — 需进入R2

**理由**: 
1. 3个P0缺陷需代码修复+测试补充
2. 综合覆盖率8.0 < 封版线9.0
3. 需补充35个新测试分支覆盖遗漏场景
4. 建议R2重点: 修复P0→补充测试→重新评估

---

*Challenger R1 完成, 交付Arbiter仲裁。*
