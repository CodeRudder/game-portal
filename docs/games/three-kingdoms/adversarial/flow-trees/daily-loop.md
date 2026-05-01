# 三国霸业 · 日常循环模块测试流程树

> 模块: `daily-loop` | 版本: v1.0 | 节点数: 35 | 生成时间: 2025-01-01
> 覆盖路径: 登录 → 离线资源收取(粮草+铜钱) → 日常任务列表 → 完成日常战斗 → 完成日常扫荡 → 领取日常奖励 → 武将培养(升星) → 武将培养(升级) → 装备强化 → 建筑升级 → 科技研究 → 联盟签到 → 联盟捐赠 → 资源分配 → 商店购买 → 检查成就 → 保存 → 下线

---

## 统计概览

| 优先级 | 节点数 | 占比 |
|--------|--------|------|
| P0     | 14     | 40%  |
| P1     | 14     | 40%  |
| P2     | 7      | 20%  |

| 关联系统 | 节点数 |
|----------|--------|
| 登录/存档系统 | 4 |
| 资源系统 | 4 |
| 任务系统 | 5 |
| 战斗系统 | 3 |
| 武将系统 | 4 |
| 装备系统 | 2 |
| 建筑系统 | 2 |
| 科技系统 | 2 |
| 联盟系统 | 3 |
| 商店系统 | 2 |
| 成就系统 | 1 |
| 活跃度系统 | 3 |

---

## 阶段一：登录与离线收益 (DAILY-001 ~ DAILY-005)

---

### DAILY-001: 玩家登录游戏
- 前置: 无
- 操作: 启动游戏应用，通过身份验证，加载玩家存档数据（`ALLIANCE_SAVE_VERSION=1`, `TECH_SAVE_VERSION=1`）
- 预期: 进入游戏主界面，加载时间 ≤ 3秒；显示上次在线时间戳 `lastOnlineTime`；主界面资源面板正确显示当前资源数值；底部导航栏包含"主城""武将""任务""联盟""商店"5个Tab
- 优先级: P0
- 关联系统: 登录/存档系统
- 状态: covered

### DAILY-002: 离线收益弹窗触发判定
- 前置: DAILY-001
- 操作: 系统计算离线时长 `offlineSeconds = now - lastOnlineTime`，判断是否 ≥ `OFFLINE_POPUP_THRESHOLD_SECONDS = 300`（5分钟）
- 预期: 离线时长 ≥ 300秒时弹出离线收益面板；离线时长 < 300秒时不弹出，直接进入主界面
- 优先级: P0
- 关联系统: 资源系统
- 状态: covered

### DAILY-003: 离线收益计算（5档衰减）
- 前置: DAILY-002
- 操作: 离线8小时（28800秒），农田Lv5产出速率 grain=0.08/s，市集Lv5产出速率 gold=0.05/s，无加成。按 `OFFLINE_TIERS` 5档计算：0~2h(100%) + 2~8h(80%)
- 预期: grain = 0.08 × 7200×1.0 + 0.08 × 21600×0.8 = 576 + 1382.4 = 1958.4；gold = 0.05 × 7200×1.0 + 0.05 × 21600×0.8 = 360 + 864 = 1224；`isCapped = false`（28800 < 259200）
- 优先级: P0
- 关联系统: 资源系统
- 状态: covered

### DAILY-004: 离线收益超过72小时截断
- 前置: DAILY-002
- 操作: 离线100小时（360000秒），验证 `OFFLINE_MAX_SECONDS = 259200`（72h）截断机制
- 预期: `effectiveSeconds = 259200`；`isCapped = true`；收益按5档全量计算：0~2h(100%) + 2~8h(80%) + 8~24h(60%) + 24~48h(40%) + 48~72h(20%)；超过72h部分不计收益
- 优先级: P1
- 关联系统: 资源系统
- 状态: covered

### DAILY-005: 玩家一键收取离线资源
- 前置: DAILY-003
- 操作: 点击离线收益面板"全部领取"按钮，将离线收益加到当前资源
- 预期: grain += 1958.4（受粮仓上限截断，如粮仓Lv5上限=10000则不截断）；gold += 1224（受铜钱上限截断）；关闭离线收益弹窗；资源面板数值实时刷新；触发 `resource:offlineClaimed` 事件
- 优先级: P0
- 关联系统: 资源系统
- 状态: covered

---

## 阶段二：日常任务系统 (DAILY-006 ~ DAILY-010)

---

### DAILY-006: 打开日常任务列表
- 前置: DAILY-001
- 操作: 点击底部"任务"Tab，切换到任务面板，选择"日常"子Tab
- 预期: 显示今日日常任务列表，任务数量 = `DEFAULT_DAILY_POOL_CONFIG.dailyPickCount = 6`（从池 `poolSize=20` 中抽取）；每个任务显示名称、描述、进度条、奖励预览；刷新时间显示为 `refreshHour = 5`（每日05:00刷新）；D01登录任务必定出现（`DAILY_MUST_INCLUDE = 'daily-019'`）
- 优先级: P0
- 关联系统: 任务系统
- 状态: covered

### DAILY-007: 日常任务多样性保证
- 前置: DAILY-006
- 操作: 连续3天查看日常任务列表，验证 `pickDailyWithDiversity()` 多样性算法
- 预期: 3天内同一任务出现 ≤ 2次；6个任务覆盖至少3种不同类型（战斗/资源/养成/社交等）；D01登录任务每天必定出现
- 优先级: P1
- 关联系统: 任务系统
- 状态: covered

### DAILY-008: 完成日常战斗任务
- 前置: DAILY-006
- 操作: 接取日常战斗任务"完成3次战役战斗"，进入战役界面，完成3次普通难度战斗
- 预期: 每次战斗胜利后任务进度 +1（0/3 → 1/3 → 2/3 → 3/3）；进度条实时更新；第3次完成时任务状态变为"可领取"；触发 `quest:progress` 事件
- 优先级: P0
- 关联系统: 战斗系统 / 任务系统
- 状态: covered

### DAILY-009: 完成日常扫荡任务
- 前置: DAILY-006
- 操作: 接取日常扫荡任务"完成5次关卡扫荡"，进入远征系统，使用扫荡功能（`SweepType`），选择已3星通关的关卡执行5次扫荡
- 预期: 扫荡消耗体力/天命值（每次消耗对应数值）；5次扫荡完成后任务进度 = 5/5；任务状态变为"可领取"；扫荡奖励正确发放到背包（经验书×5、装备碎片×10~15）
- 优先级: P0
- 关联系统: 战斗系统 / 任务系统
- 状态: covered

### DAILY-010: 领取日常任务奖励
- 前置: DAILY-008 或 DAILY-009
- 操作: 点击已完成任务的"领取"按钮，领取任务奖励
- 预期: 奖励正确发放（典型日常任务奖励：gold 500~2000、exp 100~500、strengthening_stone 1~3）；任务状态变为"已完成"（灰色不可再点）；活跃度点数 +10~20（`activityPoints` 累加）；资源面板数值实时刷新
- 优先级: P0
- 关联系统: 任务系统 / 活跃度系统
- 状态: covered

---

## 阶段三：活跃度与宝箱 (DAILY-011 ~ DAILY-013)

---

### DAILY-011: 活跃度累积与进度显示
- 前置: DAILY-010
- 操作: 完成3个日常任务后查看活跃度面板，验证活跃度累积
- 预期: 活跃度当前值 = 3个任务活跃度之和（约30~60点）；活跃度进度条显示当前值/最大值；4个里程碑宝箱按 `DEFAULT_ACTIVITY_MILESTONES` 阈值显示：40/60/80/100；已达阈值的宝箱高亮闪烁提示可领取
- 优先级: P1
- 关联系统: 活跃度系统
- 状态: covered

### DAILY-012: 领取活跃度宝箱（40点档）
- 前置: DAILY-011（活跃度 ≥ 40）
- 操作: 点击第1档活跃度宝箱（`points=40`），领取奖励
- 预期: 奖励发放：`gold=5000, strengthening_stone=2`；宝箱状态变为"已领取"（`claimed=true`）；`currentPoints` 不变仍为实际累积值；触发 `activity:milestoneClaimed` 事件
- 优先级: P1
- 关联系统: 活跃度系统
- 状态: covered

### DAILY-013: 领取全部活跃度宝箱（100点满档）
- 前置: DAILY-011（完成全部6个日常任务，活跃度 ≥ 100）
- 操作: 依次领取4档活跃度宝箱，验证每档奖励
- 预期: 第1档(40点): gold=5000, strengthening_stone=2；第2档(60点): gem=50, recruit_token=1；第3档(80点): gem=100, purple_equipment_box=1；第4档(100点): gem=200, golden_fragment=3；4档全部领取后，宝箱区域显示"今日活跃度已全部领取"
- 优先级: P1
- 关联系统: 活跃度系统
- 状态: covered

---

## 阶段四：武将培养 (DAILY-014 ~ DAILY-017)

---

### DAILY-014: 武将升星操作
- 前置: DAILY-001
- 操作: 进入武将详情页，选择1星武将，消耗碎片（`SYNTHESIZE_REQUIRED_FRAGMENTS`）和铜钱（`STAR_UP_GOLD_COST[1]=5000`），执行升星操作 `starUp()`
- 预期: 武将星级从1星升至2星（`currentStar: 1 → 2`）；碎片数量减少对应消耗；铜钱减少5000；属性倍率从1.0x变为1.15x（`STAR_MULTIPLIERS[2]=1.15`）；四维属性值（攻击/防御/兵力/速度）按倍率增长；战力数值正确增长；触发 `hero:starUp` 事件
- 优先级: P0
- 关联系统: 武将系统
- 状态: covered

### DAILY-015: 武将升星属性验证（防LL-007回归）
- 前置: DAILY-014
- 操作: 升星后立即查看武将详情面板，验证四维属性值是否正确更新
- 预期: 攻击力 = 基础攻击 × 1.15（非升星前的旧值）；防御力 = 基础防御 × 1.15；兵力 = 基础兵力 × 1.15；速度 = 基础速度 × 1.15；详情面板 `statsAtLevel()` 正确应用星级倍率（非仅显示基础属性）
- 优先级: P0
- 关联系统: 武将系统
- 状态: covered

### DAILY-016: 武将升级操作
- 前置: DAILY-001
- 操作: 选择Lv10武将，经验值已满（≥ `10 × LEVEL_EXP_TABLE[0].expPerLevel = 10 × 50 = 500`），铜钱充足（≥ `10 × 20 = 200`），执行 `levelUp()`
- 预期: 武将等级 Lv10 → Lv11；经验值重置为溢出部分；铜钱减少200；进入新等级段 `LEVEL_EXP_TABLE[1]: expPerLevel=120, goldPerLevel=50`；属性值按新等级计算增长；触发 `hero:levelUp` 事件
- 优先级: P0
- 关联系统: 武将系统
- 状态: covered

### DAILY-017: 武将批量升级（快速强化）
- 前置: DAILY-016
- 操作: 使用 `quickEnhance(generalId, targetLevel=20)`，铜钱充足（需计算11~20级总消耗 = Σ(level × 50) for level 11~20 = 7750），经验充足
- 预期: 武将等级连续提升 Lv11 → Lv20；每次升级返回 `LevelUpResult` 记录；总铜钱消耗 = 7750；总经验消耗 = Σ(level × 120) for level 11~20 = 18600；最终等级 = 20，不超过突破上限（`levelCapBefore=50`）
- 优先级: P1
- 关联系统: 武将系统
- 状态: covered

---

## 阶段五：装备强化 (DAILY-018 ~ DAILY-019)

---

### DAILY-018: 装备强化（安全区 +3→+4）
- 前置: DAILY-001
- 操作: 选择+3装备，执行强化操作，消耗铜钱（`baseCopper × copperGrowth^3 = 100 × 1.5^3 = 337.5`）和强化石（`baseStone × stoneGrowth^3 = 1 × 1.3^3 ≈ 2`）
- 预期: 强化成功率 = `ENHANCE_SUCCESS_RATES[3] = 0.80`（80%）；成功时装备等级 +3 → +4；属性增长 = 基础属性 × `ENHANCE_STAT_GROWTH = 5%`；失败时降级概率 = `downgradeChance = 0.5`（50%概率降至+2）；强化等级 < `safeLevel=5` 时失败不降级
- 优先级: P1
- 关联系统: 装备系统
- 状态: covered

### DAILY-019: 装备强化（危险区 +6→+7 使用保护符）
- 前置: DAILY-018
- 操作: 选择+6装备，使用保护符（`protectionCost[7] = 1`个保护符），执行强化操作
- 预期: 强化成功率 = `ENHANCE_SUCCESS_RATES[6] = 0.40`（40%）；成功时 +6 → +7；失败时：有保护符 → 等级不变（+6保持），消耗保护符；无保护符 → 50%概率降至+5；强化消耗铜钱 = `100 × 1.5^6 ≈ 1139`；消耗强化石 = `1 × 1.3^6 ≈ 5`
- 优先级: P2
- 关联系统: 装备系统
- 状态: covered

---

## 阶段六：建筑升级 (DAILY-020 ~ DAILY-021)

---

### DAILY-020: 主城升级（Lv2→Lv3）
- 前置: DAILY-001
- 操作: 进入城池界面，选择主城（当前Lv2），验证资源充足（grain ≥ 500, gold ≥ 400, troops ≥ 50），执行升级
- 预期: 消耗 grain=500, gold=400, troops=50（`CASTLE_LEVEL_TABLE[2]`）；升级时间 timeSeconds=30；升级期间主城显示建造进度条；升级完成后全资源加成 = `production=4%`（Lv3）；建筑等级 `castle: 2 → 3`
- 优先级: P1
- 关联系统: 建筑系统
- 状态: covered

### DAILY-021: 建筑解锁条件验证（铁匠铺Lv3）
- 前置: DAILY-020
- 操作: 主城升级到Lv3后，验证铁匠铺（smithy）是否解锁
- 预期: `BUILDING_UNLOCK_LEVELS.smithy = 3`，主城Lv3时铁匠铺解锁；铁匠铺出现在城池建筑列表中；初始等级 = Lv1，最大等级 = `BUILDING_MAX_LEVELS.smithy = 20`；未解锁前点击显示"需要主城Lv3"提示
- 优先级: P2
- 关联系统: 建筑系统
- 状态: covered

---

## 阶段七：科技研究 (DAILY-022 ~ DAILY-023)

---

### DAILY-022: 启动科技研究（军事路线 T1）
- 前置: DAILY-020（主城 ≥ Lv3，书院已建造）
- 操作: 进入科技树界面，选择军事路线T1节点"锐兵术"，消耗科技点 `costPoints=50`，启动研究
- 预期: 研究时间 `researchTime=120`秒；科技点减少50；研究队列占用1/`BASE_RESEARCH_QUEUE_SIZE=1`；节点状态变为"研究中"；研究完成后效果生效：全军攻击力+10%（`effects: [{ type:'troop_attack', target:'all', value:10 }]`）
- 优先级: P1
- 关联系统: 科技系统
- 状态: covered

### DAILY-023: 科技互斥分支验证（锐兵术 vs 铁壁术）
- 前置: DAILY-022
- 操作: 研究完成"锐兵术"后，尝试研究同层互斥节点"铁壁术"（`mutexGroup = 'mil_t1'`）
- 预期: "铁壁术"节点显示锁定状态；点击提示"已选择同层另一分支：锐兵术"；无法启动研究；互斥组 `M('mil', 1) = 'mil_t1'` 正确生效
- 优先级: P2
- 关联系统: 科技系统
- 状态: covered

---

## 阶段八：联盟操作 (DAILY-024 ~ DAILY-026)

---

### DAILY-024: 联盟每日签到
- 前置: DAILY-001（已加入联盟）
- 操作: 进入联盟界面，点击"签到"按钮，执行每日签到
- 预期: 签到成功，获得签到奖励（Day1: 铜钱×1000，`consecutiveDays=1`）；签到状态记录到联盟成员数据；`dailyContribution` 增加对应值；连续签到7天奖励递增（Day7: 求贤令×1）；同日重复签到提示"今日已签到"
- 优先级: P1
- 关联系统: 联盟系统
- 状态: covered

### DAILY-025: 联盟捐赠（铜钱→公会币）
- 前置: DAILY-024
- 操作: 在联盟界面选择"捐赠"，选择铜钱捐赠档位（消耗铜钱1000），执行捐赠
- 预期: 铜钱减少1000；`playerState.guildCoins` 增加对应公会币（如+100）；`playerState.dailyContribution` 增加；联盟经验增加（`AllianceData.experience += 对应值`）；成员 `member.totalContribution` 增加；触发 `alliance:donation` 事件
- 优先级: P1
- 关联系统: 联盟系统
- 状态: covered

### DAILY-026: 联盟每日重置验证
- 前置: DAILY-025
- 操作: 模拟跨天（05:00刷新），验证联盟每日数据重置
- 预期: `dailyBossChallenges` 清零；`dailyContribution` 清零；`bossKilledToday = false`；`totalContribution` 保持不变；`lastDailyReset` 更新为当天时间戳
- 优先级: P2
- 关联系统: 联盟系统
- 状态: covered

---

## 阶段九：资源分配与商店 (DAILY-027 ~ DAILY-030)

---

### DAILY-027: 资源分配检查（粮草/铜钱比例）
- 前置: DAILY-005（离线资源已收取）
- 操作: 查看当前资源面板，评估资源分配合理性
- 预期: 粮草当前值 ≥ `MIN_GRAIN_RESERVE = 10`（保护机制）；铜钱当前值 ≥ `GOLD_SAFETY_LINE = 500`（安全线）；粮草占比不超过上限90%（`CAP_WARNING_THRESHOLDS.notice=0.9`时触发注意提示）；资源接近上限时（≥95%）触发紧急提示（`urgent=1.0`）
- 优先级: P1
- 关联系统: 资源系统
- 状态: covered

### DAILY-028: 商店购买（铜钱袋）
- 前置: DAILY-027
- 操作: 进入商店界面，选择"铜钱袋"商品（`id='shop-copper'`），消耗活动代币 `tokenPrice=10`，执行购买
- 预期: 活动代币减少10；获得铜钱1000（`rewards.copper=1000`）；购买次数 `purchased: 0 → 1`，购买上限 `purchaseLimit=10`；背包资源更新；触发 `shop:purchase` 事件
- 优先级: P0
- 关联系统: 商店系统
- 状态: covered

### DAILY-029: 商店购买达到上限
- 前置: DAILY-028
- 操作: 连续购买"铜钱袋"10次（达到 `purchaseLimit=10`），尝试第11次购买
- 预期: 第10次购买成功，`purchased=10`；第11次购买按钮置灰，显示"今日已售罄"；代币不扣除；错误提示"该商品今日购买次数已达上限"
- 优先级: P2
- 关联系统: 商店系统
- 状态: covered

### DAILY-030: 天命大额消耗二次确认
- 前置: DAILY-027
- 操作: 在任意系统消耗天命值 ≥ `MANDATE_CONFIRM_THRESHOLD = 100`，验证二次确认弹窗
- 预期: 弹出确认对话框，显示消耗数量和用途；点击"确认"后执行消耗；点击"取消"后不执行消耗；天命值 < 100 的消耗操作不弹确认框
- 优先级: P2
- 关联系统: 资源系统
- 状态: covered

---

## 阶段十：成就检查与存档 (DAILY-031 ~ DAILY-035)

---

### DAILY-031: 检查成就进度
- 前置: DAILY-010（完成日常任务后）
- 操作: 打开成就面板，检查今日操作触发的成就进度更新
- 预期: "日常达人"成就进度 +1（完成日常任务）；"强化大师"成就进度更新（如有强化操作）；"联盟忠臣"成就进度 +1（签到/捐赠）；未达成的成就显示当前进度/目标值（如 3/10）；已达成的成就显示"可领取"状态
- 优先级: P1
- 关联系统: 成就系统
- 状态: missing

### DAILY-032: 活跃度系统每日重置
- 前置: DAILY-013（活跃度宝箱已领取）
- 操作: 模拟跨天（05:00），调用 `activitySys.resetDaily()`，验证活跃度系统重置
- 预期: `currentPoints = 0`；`maxPoints` 重置；4个里程碑宝箱全部恢复为 `claimed=false`；`lastResetDate` 更新为当天日期；日常任务列表重新生成（`refreshDailyQuestsLogic()`）；未领取的活跃度宝箱奖励自动补发
- 优先级: P0
- 关联系统: 活跃度系统 / 任务系统
- 状态: covered

### DAILY-033: 存档序列化（全系统状态保存）
- 前置: DAILY-031
- 操作: 触发自动存档，验证所有系统状态序列化
- 预期: 资源系统：grain/gold/troops等数值正确保存；武将系统：等级/星级/经验/装备状态保存；建筑系统：各建筑等级和升级进度保存；科技系统：研究进度和已完成节点保存（`TECH_SAVE_VERSION=1`）；联盟系统：贡献值和公会币保存（`ALLIANCE_SAVE_VERSION=1`）；任务系统：日常任务进度和活跃度保存
- 优先级: P0
- 关联系统: 登录/存档系统
- 状态: covered

### DAILY-034: 存档数据完整性校验
- 前置: DAILY-033
- 操作: 读取存档数据，验证关键字段完整性和数值合法性
- 预期: 所有资源值 ≥ 0（无负数）；武将等级 ≤ 当前突破上限（50/60/70/80/100）；建筑等级 ≤ `BUILDING_MAX_LEVELS` 对应上限；科技点 ≥ 0；存档版本号匹配（`ALLIANCE_SAVE_VERSION=1`, `TECH_SAVE_VERSION=1`）；序列化/反序列化往返一致
- 优先级: P1
- 关联系统: 登录/存档系统
- 状态: covered

### DAILY-035: 玩家安全下线
- 前置: DAILY-033
- 操作: 点击"设置→退出游戏"，触发最终存档，记录 `lastOnlineTime = Date.now()`，关闭游戏
- 预期: 最终存档成功写入（含 `lastOnlineTime`）；下次登录时 `offlineSeconds = now - lastOnlineTime` 计算正确；所有未完成的异步操作（建筑升级倒计时、科技研究倒计时）进度正确保存；无数据丢失；下线动画 ≤ 2秒
- 优先级: P0
- 关联系统: 登录/存档系统
- 状态: covered

---

## 附录A: 跨系统依赖矩阵

| 节点ID | 依赖系统 | 被依赖节点 | 关键配置引用 |
|--------|----------|------------|-------------|
| DAILY-003 | 资源系统 | DAILY-005 | `OFFLINE_TIERS`, `OFFLINE_MAX_SECONDS=259200` |
| DAILY-006 | 任务系统 | DAILY-008, DAILY-009 | `DEFAULT_DAILY_POOL_CONFIG: poolSize=20, dailyPickCount=6` |
| DAILY-010 | 任务+活跃度 | DAILY-011 | `activityPoints` 累加 |
| DAILY-012 | 活跃度系统 | DAILY-013 | `DEFAULT_ACTIVITY_MILESTONES: 40/60/80/100` |
| DAILY-014 | 武将系统 | DAILY-015 | `STAR_UP_GOLD_COST`, `STAR_MULTIPLIERS` |
| DAILY-016 | 武将系统 | DAILY-017 | `LEVEL_EXP_TABLE`, `HERO_MAX_LEVEL=50` |
| DAILY-018 | 装备系统 | DAILY-019 | `ENHANCE_SUCCESS_RATES`, `ENHANCE_CONFIG` |
| DAILY-020 | 建筑系统 | DAILY-021, DAILY-022 | `CASTLE_LEVEL_TABLE`, `BUILDING_UNLOCK_LEVELS` |
| DAILY-022 | 科技系统 | DAILY-023 | `costPoints=50`, `researchTime=120`, `BASE_RESEARCH_QUEUE_SIZE=1` |
| DAILY-024 | 联盟系统 | DAILY-025, DAILY-026 | `dailyContribution`, `guildCoins` |
| DAILY-028 | 商店系统 | DAILY-029 | `tokenPrice=10`, `purchaseLimit=10` |
| DAILY-032 | 活跃度+任务 | DAILY-006(循环) | `resetDaily()`, `refreshDailyQuestsLogic()` |
| DAILY-033 | 全系统 | DAILY-034, DAILY-035 | `ALLIANCE_SAVE_VERSION=1`, `TECH_SAVE_VERSION=1` |

---

## 附录B: 关键数值速查表

| 配置项 | 值 | 代码溯源 |
|--------|-----|---------|
| 离线收益弹窗阈值 | 300秒(5分钟) | `resource-config.ts OFFLINE_POPUP_THRESHOLD_SECONDS` |
| 离线最大计算时长 | 259200秒(72小时) | `resource-config.ts OFFLINE_MAX_SECONDS` |
| 离线衰减5档 | 100%/80%/60%/40%/20% | `resource-config.ts OFFLINE_TIERS` |
| 粮草最低保留量 | 10 | `resource-config.ts MIN_GRAIN_RESERVE` |
| 铜钱安全线 | 500 | `resource-config.ts GOLD_SAFETY_LINE` |
| 天命确认阈值 | 100 | `resource-config.ts MANDATE_CONFIRM_THRESHOLD` |
| 日常任务每日抽取 | 6个(池20) | `quest.types.ts DEFAULT_DAILY_POOL_CONFIG` |
| 日常任务刷新时间 | 05:00 | `quest.types.ts refreshHour=5` |
| 活跃度宝箱阈值 | 40/60/80/100 | `quest.types.ts DEFAULT_ACTIVITY_MILESTONES` |
| 1→2星升星铜钱 | 5000 | `star-up-config.ts STAR_UP_GOLD_COST[1]` |
| 2星属性倍率 | 1.15x | `star-up-config.ts STAR_MULTIPLIERS[2]` |
| 1~10级经验需求 | 等级×50 | `hero-config.ts LEVEL_EXP_TABLE[0]` |
| 1~10级铜钱消耗 | 等级×20 | `hero-config.ts LEVEL_EXP_TABLE[0]` |
| 武将初始等级上限 | 50 | `hero-config.ts HERO_MAX_LEVEL` |
| 强化安全线 | +5 | `equipment-config.ts ENHANCE_CONFIG.safeLevel` |
| +3→+4成功率 | 80% | `equipment-config.ts ENHANCE_SUCCESS_RATES[3]` |
| +6→+7成功率 | 40% | `equipment-config.ts ENHANCE_SUCCESS_RATES[6]` |
| 强化降级概率 | 50% | `equipment-config.ts ENHANCE_CONFIG.downgradeChance` |
| 强化每级属性增长 | 5% | `equipment-config.ts ENHANCE_STAT_GROWTH` |
| 主城Lv2→3费用 | grain=500,gold=400,troops=50 | `building-config.ts CASTLE_LEVEL_TABLE[2]` |
| 铁匠铺解锁条件 | 主城Lv3 | `building-config.ts BUILDING_UNLOCK_LEVELS.smithy` |
| 科技T1节点费用 | 50科技点, 120秒 | `tech-config.ts mil_t1_attack` |
| 科技研究队列 | 1个(基础) | `tech-config.ts BASE_RESEARCH_QUEUE_SIZE` |
| 联盟创建费用 | 500铜钱 | `alliance-constants.ts DEFAULT_CREATE_CONFIG` |
| 铜钱袋价格 | 10活动代币 | `token-shop-config.ts shop-copper` |
| 铜钱袋购买上限 | 10次/日 | `token-shop-config.ts shop-copper.purchaseLimit` |

---

## 附录C: 风险标记

| 风险ID | 关联节点 | 风险描述 | 严重度 | 缓解措施 |
|--------|----------|----------|--------|----------|
| RISK-001 | DAILY-014, DAILY-015 | 武将升星后属性面板不更新（LL-007回归风险） | 高 | 每次升星测试必须验证四维属性值变化，非仅验证星级数字 |
| RISK-002 | DAILY-003, DAILY-004 | 离线收益计算精度（浮点数累积误差） | 中 | 使用 `toFixed(2)` 比对，允许 ±0.01 误差 |
| RISK-003 | DAILY-032 | 跨天重置时未领取奖励丢失 | 高 | 验证 `refreshDailyQuestsLogic()` 自动领取机制 |
| RISK-004 | DAILY-018, DAILY-019 | 强化随机性导致测试不稳定 | 中 | Mock随机种子或统计多次执行结果 |
| RISK-005 | DAILY-033 | 全系统存档数据量过大导致序列化失败 | 中 | 验证存档大小 ≤ 合理阈值（建议 < 1MB） |
| RISK-006 | DAILY-031 | 成就系统 v1.0 未实现，节点标记 missing | 低 | 标记为 missing，待 v12.0 ACH 模块实现后补充测试 |
