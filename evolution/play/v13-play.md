# v13.0 联盟争霸 — Play 文档 (Round 2)

> 版本: v13.0 联盟争霸 | 引擎域: engine/alliance/(AllianceSystem, AllianceBossSystem, AllianceShopSystem, AllianceTaskSystem)
> 日期: 2025-07-18 | 轮次: Round 2

---

## 玩家流程

### P1: 联盟创建 → 加入 → 成员管理

```
1. 玩家打开"联盟"Tab（AlliancePanel.tsx）
2. 无联盟 → 显示创建/搜索界面
3. 创建联盟: 输入"蜀汉忠义"、宣言"匡扶汉室" → createAlliance(playerState, "蜀汉忠义", "匡扶汉室", "p1", "刘备", now)
4. 校验: 名称2~8字 ✅ → 消耗元宝×500 → 返回 AllianceData{level:1, members:{p1:LEADER}}
5. 搜索联盟: searchAlliance(alliances, "蜀汉") → 返回匹配列表
6. 申请加入: applyToJoin → 生成 Application{status:PENDING}
7. 盟主审批: approveApplication → 成员角色设为 MEMBER
8. 成员上限: 等级1 → 20人, 等级7 → 50人
```

**验证点**: `createAlliance(state, "蜀汉忠义", ..., "p1", "刘备", 0)` → alliance.members["p1"].role === "LEADER"

### P2: 权限管理 → 三级权限+角色变更

```
1. 盟主设置军师: setRole(alliance, "p1", "p2", AllianceRole.ADVISOR)
2. 军师发布公告: postAnnouncement(alliance, "p2", "诸葛亮", "今日讨伐Boss", true, now)
   → 置顶公告数=1 (上限3条)
3. 军师踢人: kickMember(alliance, "p2", "p3") → 成功(ADVISOR有kick权限)
4. 普通成员踢人: kickMember(alliance, "p4", "p3") → 失败("权限不足")
5. 盟主转让: transferLeadership(alliance, "p1", "p2")
   → p1变为MEMBER, p2变为LEADER
6. 盟主退出: leaveAlliance(alliance, state, "p1") → 失败("盟主需先转让")
```

**验证点**: `hasPermission(alliance, "p2", "kick") === true` (ADVISOR)

### P3: 联盟Boss战 → 刷新→挑战→击杀→奖励

```
1. 每日刷新Boss: refreshBoss(alliance, now) → Boss{level:1, maxHp:100000, name:"黄巾力士"}
2. 成员挑战: challengeBoss(boss, alliance, state, "p1", 35000)
   → 实际伤害=35000, Boss剩余HP=65000
   → 奖励: 公会币+5(participationGuildCoin)
3. 第二次挑战: challengeBoss(boss, alliance, state, "p1", 40000)
   → 累计伤害75000, Boss仍存活
4. 成员p2挑战: challengeBoss(boss, alliance, state, "p2", 25000)
   → 击杀! isKillingBlow=true
   → 击杀奖励: 公会币+30, 天命+20 (全员)
5. 伤害排行: getDamageRanking → [{p1:75000,rank:1}, {p2:25000,rank:2}]
6. 第4次挑战 → 失败("今日挑战次数已用完", limit=3)
```

**验证点**: `challengeBoss(boss, ..., 25000).result.isKillingBlow === true`

### P4: 联盟任务 → 每日刷新→贡献→领取奖励

```
1. 每日刷新任务: dailyRefresh() → 3个任务(从8个任务池随机抽取)
2. 任务示例: "全员集结"(SHARED, target:10次登录) / "Boss猎人"(SHARED, target:50000伤害)
3. 更新进度: updateProgress("at_3", 50000) → Boss猎人 currentProgress=50000 ≥ target → COMPLETED
4. 记录贡献: recordContribution(alliance, state, "p1", 15)
   → playerState.guildCoins += 15, member.dailyContribution += 15
5. 领取奖励: claimTaskReward("at_3", alliance, state, "p1")
   → alliance.experience += 200, playerState.guildCoins += 25
6. 联盟升级: addExperience(alliance, 200) → 经验累积, 可能触发升级
```

**验证点**: `claimTaskReward("at_3", ..., "p1").expGained === 200`

### P5: 联盟商店 → 公会币兑换+等级解锁+限购

```
1. 查看商品: getAvailableShopItems(allianceLevel=1) → 3件(招募令/装备箱·良/加速道具·小)
2. 购买: buyShopItem(state, "as_1", allianceLevel=1) → 消耗公会币×50
3. 限购检查: 招募令 weeklyLimit=5, 已购1 → canBuy=true
4. 等级不足: getAvailableShopItems(allianceLevel=1) → "武将碎片·随机"不显示(需等级3)
5. 批量购买: buyShopItemBatch(state, "as_3", 5, allianceLevel=1) → 消耗公会币×100
6. 周重置: resetShopWeekly() → 所有商品 purchased=0
```

**验证点**: `canBuy("as_4", allianceLevel=1, guildCoins=1000).canBuy === false` (等级不足)

---

## 交叉验证矩阵

| 流程 | AllianceSystem | BossSystem | TaskSystem | ShopSystem | Helper | Constants |
|------|:--------------:|:----------:|:----------:|:----------:|:------:|:---------:|
| P1   | ✅             | —          | —          | —          | ✅     | ✅        |
| P2   | ✅             | —          | —          | —          | ✅     | —         |
| P3   | ✅             | ✅         | —          | —          | —      | —         |
| P4   | ✅             | —          | ✅         | —          | —      | —         |
| P5   | —              | —          | —          | ✅         | —      | —         |
| **覆盖率** | 4/4 | 1/1 | 1/1 | 1/1 | 2/2 | 1/1 |
