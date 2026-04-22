# v12.0 远征天下 — Play 文档 (Round 2)

> 版本: v12.0 远征天下 | 引擎域: engine/expedition/(ExpeditionSystem, ExpeditionBattleSystem, ExpeditionRewardSystem, AutoExpeditionSystem)
> 日期: 2025-07-17 | 轮次: Round 2

---

## 玩家流程

### P1: 远征地图 → 浏览路线+解锁区域

```
1. 玩家打开"远征天下"Tab（ExpeditionTab.tsx）
2. 显示路线列表: 虎牢关·简(已解锁) / 虎牢关·普(已解锁) / 虎牢关·难(已解锁)
3. 汜水关路线显示🔒未解锁(需通关虎牢关全部路线)
4. 进度条: 0/10 路线已通关
5. 点击"虎牢关·简" → 节点链展示: 🗡️山贼前哨 → ⛰️险峻山路 → 📦隐藏宝箱 → 🗡️山贼主力 → 🏕️休整营地 → 👹守关大将
6. 节点状态: 🔒未解锁(首次) / ✅已通关 / 🏃行军中
```

**验证点**: `createDefaultRoutes(1000)` 返回10条路线，虎牢关3条默认解锁

### P2: 队伍编成 → 武将选择+阵型+阵营羁绊

```
1. 玩家创建队伍: 选择关羽(蜀)+张飞(蜀)+赵云(蜀)+诸葛亮(蜀)+马超(蜀)
2. 选择阵型: 鹤翼(攻击+15%, 防御-5%)
3. 蜀阵营≥3名 → 阵营羁绊激活: 全属性+10%
4. 队伍战力 = Σ(hero.power × (1+avgFormationMod) × bondMultiplier)
   = (320+310+350+400+280) × 1.025 × 1.10 ≈ 1,876
5. 系统校验: 武将互斥通过(无其他活跃队伍) → 创建成功
6. 兵力消耗: 5武将 × 20 = 100兵力
```

**验证点**: `checkFactionBond(['guanyu','zhangfei','zhaoyun'], heroDataMap) === true`

### P3: 远征推进 → 出发→战斗→节点效果→通关

```
1. 派遣队伍到"虎牢关·简" → dispatchTeam(teamId, 'route_hulao_easy')
2. 队伍状态: isExpeditioning=true, currentNodeId=route_hulao_easy_n1
3. 推进到下一节点 → advanceToNextNode(teamId, 0)
4. 节点n1(山贼): 战力比 1,876 vs 600 → 大捷⭐⭐⭐
5. 继续推进到n3(宝箱): 直接获得奖励(装备碎片+2, 铜钱+320)
6. 推进到n5(休息): 恢复20%兵力 = 100×0.20 = 20
7. 推进到n6(Boss): 战力比 1,876 vs 1,200 → 大捷⭐⭐⭐
8. 完成路线 → completeRoute(teamId, 3) → 路线三星通关
```

**验证点**: `processNodeEffect(teamId).healed === true && healAmount === 20`

### P4: 扫荡系统 → 三星通关解锁+三种扫荡

```
1. 虎牢关·简已三星通关 → canSweepRoute('route_hulao_easy') === true
2. 普通扫荡: executeSweep('route_hulao_easy', SweepType.NORMAL)
   → 消耗扫荡令×1, 奖励×100%, 每日5次
3. 高级扫荡: executeSweep('route_hulao_easy', SweepType.ADVANCED)
   → 消耗扫荡令×3, 奖励×150%+保底稀有, 每日3次
4. 免费扫荡: executeSweep('route_hulao_easy', SweepType.FREE)
   → 无消耗, 奖励×50%, 每日1次
5. 第6次普通扫荡 → 失败("今日扫荡次数已用完")
```

**验证点**: `getSweepCount('route_hulao_easy', SweepType.NORMAL) === 5 → 第6次success=false`

### P5: 自动远征+离线收益 → 循环执行+72h上限

```
1. 配置自动远征: repeatCount=5, failureAction='pause', lowTroopAction='pause'
2. 启动 → startAutoExpedition(state, teamId, routeId)
3. 执行5次循环: 每次quickBattle → 计算奖励 → 消耗兵力
4. 连续失败2次 → 自动暂停(PauseReason.CONSECUTIVE_FAILURES)
5. 离线24h计算: avgRouteDuration=1800s → maxRuns=48
   → 胜率0.85×0.85=0.72 → completedRuns≈35
   → 效率=35×0.85/48≈0.62
6. 离线72h上限: isTimeCapped=true
```

**验证点**: `calculateOfflineExpedition({offlineSeconds: 86400, ...}).completedRuns > 0`

---

## 交叉验证矩阵

| 流程 | 路线管理 | 队伍编成 | 战斗系统 | 奖励系统 | 扫荡 | 自动远征 | 离线 |
|------|:-------:|:-------:|:-------:|:-------:|:----:|:-------:|:----:|
| P1   | ✅      | —       | —       | —       | —    | —       | —    |
| P2   | —       | ✅      | —       | —       | —    | —       | —    |
| P3   | ✅      | ✅      | ✅      | ✅      | —    | —       | —    |
| P4   | ✅      | —       | ✅      | ✅      | ✅   | —       | —    |
| P5   | —       | —       | ✅      | ✅      | —    | ✅      | ✅   |
| **覆盖率** | 3/3 | 2/2 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 |
