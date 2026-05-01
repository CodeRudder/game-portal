# R1 Builder 测试分支树 — Alliance 模块

> **构建者**: Builder Agent | **日期**: 2025-01-XX | **目标覆盖率**: 9.0/10  
> **源码范围**: `engine/alliance/` 全部6文件  
> **核心类**: AllianceSystem, AllianceBossSystem, AllianceShopSystem, AllianceTaskSystem, AllianceHelper

---

## 测试维度总览

| # | 维度 | 分支数 | 权重 |
|---|------|--------|------|
| D1 | 正常流程 (Normal Flow) | 28 | 25% |
| D2 | 边界条件 (Boundary Conditions) | 22 | 25% |
| D3 | 错误路径 (Error Paths) | 24 | 25% |
| D4 | 跨系统交互 (Cross-system) | 16 | 15% |
| D5 | 数据生命周期 (Data Lifecycle) | 12 | 10% |
| **合计** | | **102** | **100%** |

---

## D1 — 正常流程 (Normal Flow)

### D1.1 联盟创建与加入 [8分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D1.1.1 | 创建联盟-标准流程 | 玩家无联盟, name="蜀汉", 元宝>=500 | 返回alliance+playerState(allianceId已设), 扣除500元宝 | Must |
| D1.1.2 | 创建联盟-Simple版 | createAllianceSimple("蜀汉","刘备") | success=true, _alliance非null, _playerState.allianceId已设 | Must |
| D1.1.3 | 提交加入申请 | 玩家无联盟, 联盟成员未满 | alliance.applications增加一条PENDING记录 | Must |
| D1.1.4 | 审批通过申请 | operator=LEADER/ADVISOR, 申请PENDING | 申请→APPROVED, members增加新成员(role=MEMBER) | Must |
| D1.1.5 | 拒绝申请 | operator=LEADER/ADVISOR, 申请PENDING | 申请→REJECTED, members不变 | Must |
| D1.1.6 | 成员退出联盟 | 非盟主成员退出 | members减少, playerState.allianceId="" | Must |
| D1.1.7 | 最后一成员退出 | 仅剩盟主时转让后退出 | alliance=null | Should |
| D1.1.8 | 联盟搜索 | alliances数组+keyword | 返回名称包含keyword的联盟列表 | Could |

### D1.2 权限管理 [5分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D1.2.1 | 盟主全权限 | LEADER执行approve/announce/kick/manage | 全部通过 | Must |
| D1.2.2 | 军师部分权限 | ADVISOR执行approve/announce/kick | 通过; 执行manage→拒绝 | Must |
| D1.2.3 | 成员无管理权限 | MEMBER执行approve/announce/kick | 全部拒绝 | Must |
| D1.2.4 | 转让盟主 | LEADER转让给另一成员 | 新LEADER, 原LEADER→MEMBER | Must |
| D1.2.5 | 设置角色 | LEADER设置某成员为ADVISOR | 该成员role=ADVISOR | Must |

### D1.3 联盟等级与经验 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D1.3.1 | 经验增加-不升级 | alliance.level=1, exp+500 | level=1, experience=500 | Must |
| D1.3.2 | 经验增加-升级 | alliance.level=1, exp+1000 | level=2, experience=1000 | Must |
| D1.3.3 | 连续升级 | alliance.level=1, exp+21000 | level=7 (最高级) | Should |
| D1.3.4 | 超过最高级经验 | alliance.level=7, exp+99999 | level保持7, experience累加 | Must |

### D1.4 联盟Boss [5分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D1.4.1 | 挑战Boss-普通伤害 | damage=10000, HP>10000 | boss.currentHp减少, damageRecords记录, 参与奖5公会币 | Must |
| D1.4.2 | 挑战Boss-击杀 | damage>=boss.currentHp | boss.status=KILLED, killReward非null, bossKilledToday=true | Must |
| D1.4.3 | Boss刷新 | refreshBoss(alliance, now) | 新boss实例, bossKilledToday=false | Must |
| D1.4.4 | 伤害排行 | 多人挑战后getDamageRanking | 按伤害降序, rank正确, percent总和≈100 | Should |
| D1.4.5 | 击杀全员奖励分发 | distributeKillRewards | playerState.guildCoins+30 | Should |

### D1.6 联盟商店 [3分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D1.6.1 | 购买商品-标准 | guildCoins=100, 买as_1(50币) | guildCoins=50, item.purchased=1 | Must |
| D1.6.2 | 批量购买 | guildCoins=300, 买as_1×5 | guildCoins=50, purchased=5 | Must |
| D1.6.3 | 周购重置 | resetShopWeekly() | 所有item.purchased=0 | Should |

### D1.7 联盟任务 [3分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D1.7.1 | 每日任务刷新 | dailyRefresh() | 生成3个任务实例, status=ACTIVE | Must |
| D1.7.2 | 更新任务进度到完成 | updateProgress('at_1', 10) | status=COMPLETED, currentProgress=10 | Must |
| D1.7.3 | 领取任务奖励 | COMPLETED任务+未领取玩家 | guildCoins增加, alliance.experience增加 | Must |

---

## D2 — 边界条件 (Boundary Conditions)

### D2.1 联盟名称边界 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D2.1.1 | 名称=最小长度 | name="蜀" (len=1) | 抛出: 名称长度需在2~8之间 | Must |
| D2.1.2 | 名称=最小长度-1 | name="蜀汉" (len=2) | 成功创建 | Must |
| D2.1.3 | 名称=最大长度 | name="一二三四五六七八" (len=8) | 成功创建 | Must |
| D2.1.4 | 名称=最大长度+1 | name="一二三四五六七八九" (len=9) | 抛出: 名称长度需在2~8之间 | Must |

### D2.2 成员上限边界 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D2.2.1 | 成员满时申请 | level=1, members=20人 | 抛出: 联盟成员已满 | Must |
| D2.2.2 | 成员满时审批 | level=1, members=20人, PENDING申请 | 抛出: 联盟成员已满 | Must |
| D2.2.3 | 成员上限随等级增长 | level=2 → maxMembers=25 | 可加入25人 | Must |
| D2.2.4 | 最高等级成员上限 | level=7 → maxMembers=50 | 可加入50人 | Should |

### D2.3 Boss挑战边界 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D2.3.1 | 伤害=0 | damage=0 | actualDamage=0, HP不变, 挑战次数+1 | Must |
| D2.3.2 | 伤害>当前HP | damage=999999, currentHp=50000 | actualDamage=50000, 击杀 | Must |
| D2.3.3 | 伤害=负数 | damage=-1000 | actualDamage=0 (Math.max(0,...)) | Must |
| D2.3.4 | 最后一次挑战机会 | dailyBossChallenges=2, limit=3 | 允许挑战, 之后=3 | Must |

### D2.4 商店边界 [5分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D2.4.1 | 公会币刚好够 | guildCoins=50, 买as_1 | 成功, guildCoins=0 | Must |
| D2.4.2 | 公会币差1 | guildCoins=49, 买as_1 | 抛出: 公会币不足 | Must |
| D2.4.3 | 限购最后一件 | purchased=4, weeklyLimit=5, 买as_1 | 成功, purchased=5 | Must |
| D2.4.4 | 已达限购上限 | purchased=5, weeklyLimit=5, 买as_1 | 抛出: 已达限购上限 | Must |
| D2.4.5 | weeklyLimit=0的商品 | 无限购商品, 购买N次 | 全部成功(不检查限购) | Should |

### D2.5 任务边界 [3分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D2.5.1 | 进度刚好达标 | targetCount=10, progress=10 | status=COMPLETED | Must |
| D2.5.2 | 进度超额 | targetCount=10, progress=15 | currentProgress=15, status=COMPLETED | Should |
| D2.5.3 | 进度为负数 | progress=-5 | currentProgress不变(Math.max(0,...)) | Must |

### D2.6 公告与消息边界 [2分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D2.6.1 | 置顶公告=3条上限 | 已有3条置顶, 再发置顶 | 抛出: 置顶公告最多3条 | Must |
| D2.6.2 | 消息超过100条 | 发送第101条消息 | 保留最新100条 | Should |

---

## D3 — 错误路径 (Error Paths)

### D3.1 联盟创建错误 [5分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D3.1.1 | 已在联盟中创建 | playerState.allianceId非空 | 抛出: 已在联盟中，无法创建 | Must |
| D3.1.2 | 元宝不足创建 | balance<500 | createAllianceSimple返回success=false, reason含"元宝不足" | Must |
| D3.1.3 | 元宝扣除失败 | spendCallback返回false | createAllianceSimple返回success=false, reason="元宝扣除失败" | Must |
| D3.1.4 | 名称含特殊字符 | name="<script>" | 当前无校验, 需标记为**安全风险** | Must |
| D3.1.5 | declaration为超长字符串 | declaration.length=10000 | 当前无长度限制, 需标记为**风险** | Should |

### D3.2 成员管理错误 [5分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D3.2.1 | 盟主退出 | leaderId调用leaveAlliance | 抛出: 盟主需先转让才能退出 | Must |
| D3.2.2 | 踢出盟主 | operator=LEADER, target=leaderId | 抛出: 不能踢出盟主 | Must |
| D3.2.3 | 踢出自己 | operator=target | 抛出: 不能踢出自己 | Must |
| D3.2.4 | 转让给自己 | currentLeaderId=newLeaderId | 抛出: 不能转让给自己 | Must |
| D3.2.5 | 非盟主转让 | operator≠leaderId | 抛出: 只有盟主可以转让 | Must |

### D3.3 权限错误 [5分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D3.3.1 | 非成员审批 | playerId不在members中 | 抛出: 不是联盟成员 | Must |
| D3.3.2 | MEMBER审批 | role=MEMBER, 执行approve | 抛出: 权限不足 | Must |
| D3.3.3 | 重复审批 | 申请已APPROVED | 抛出: 申请已处理 | Must |
| D3.3.4 | 重复拒绝 | 申请已REJECTED | 抛出: 申请已处理 | Must |
| D3.3.5 | 设置角色为LEADER | setRole(target, 'LEADER') | 抛出: 请使用转让盟主功能 | Must |

### D3.4 Boss错误 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D3.4.1 | Boss已死挑战 | boss.status=KILLED | 抛出: Boss已被击杀 | Must |
| D3.4.2 | 非成员挑战Boss | playerId不在members中 | 抛出: 不是联盟成员 | Must |
| D3.4.3 | 挑战次数耗尽 | dailyBossChallenges>=3 | 抛出: 今日挑战次数已用完 | Must |
| D3.4.4 | 申请不存在审批 | applicationId无效 | 抛出: 申请不存在 | Must |

### D3.5 商店错误 [3分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D3.5.1 | 商品不存在 | itemId="invalid" | 抛出: 商品不存在 | Must |
| D3.5.2 | 联盟等级不足 | allianceLevel=1, 买as_4(需3级) | 抛出: 联盟等级不足 | Must |
| D3.5.3 | 批量购买数量=0 | count=0 | 抛出: 已达限购上限 (actualCount<=0) | Should |

### D3.6 任务错误 [2分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D3.6.1 | 领取未完成任务 | status=ACTIVE | 抛出: 任务未完成 | Must |
| D3.6.2 | 重复领取奖励 | claimedPlayers已含playerId | 抛出: 已领取奖励 | Must |

---

## D4 — 跨系统交互 (Cross-system)

### D4.1 Boss→经验→等级联动 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D4.1.1 | Boss击杀→全员奖励→商店购买 | 击杀Boss获得30公会币→买as_3(20币) | guildCoins最终=10 | Must |
| D4.1.2 | 任务完成→联盟经验→升级 | 任务奖励100exp, level=1, exp=900→升级到2 | level=2, maxMembers=25 | Must |
| D4.1.3 | 每日重置→Boss+任务+成员数据联动 | dailyReset() | bossKilledToday=false, dailyTaskCompleted=0, 成员dailyContribution=0 | Must |
| D4.1.4 | 贡献→公会币→商店完整链路 | recordContribution(50) → buyShopItem | guildCoins先+50再-50=0 | Must |

### D4.2 联盟生命周期交互 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D4.2.1 | 创建→加入→退出→再加入 | 完整生命周期 | 每步状态正确 | Must |
| D4.2.2 | 创建→升级→Boss→商店完整流程 | 端到端 | 所有系统联动正确 | Should |
| D4.2.3 | 成员退出后贡献保留 | 退出再重新加入 | totalContribution保留, dailyContribution重置 | Should |
| D4.2.4 | 存档序列化/反序列化完整链路 | serialize→deserialize | 数据完全一致 | Must |

### D4.3 权限与操作交叉 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D4.3.1 | 被踢成员无法操作 | 踢出后发消息 | 抛出: 不是联盟成员 | Must |
| D4.3.2 | 降权后无法审批 | ADVISOR被降为MEMBER后审批 | 抛出: 权限不足 | Should |
| D4.3.3 | 盟主转让后原盟主权限变化 | 转让后原盟主踢人 | 抛出: 权限不足 | Must |
| D4.3.4 | 重复申请防护 | 已有PENDING申请再次申请 | 抛出: 已提交申请 | Must |

### D4.4 多玩家并发场景 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D4.4.1 | 多人同时挑战Boss | 3人各挑战1次 | damageRecords正确, 各自dailyBossChallenges=1 | Must |
| D4.4.2 | 多人同时申请加入 | 5人同时申请 | applications增加5条PENDING | Should |
| D4.4.3 | 多人买同一商品 | 2人各买as_1 | purchased累加(共享限购?) | Should |
| D4.4.4 | Boss被多人击杀判定 | 第1人打残, 第2人击杀 | 第2人得killReward, 第1人只得参与奖 | Must |

---

## D5 — 数据生命周期 (Data Lifecycle)

### D5.1 存档序列化 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D5.1.1 | 序列化-有联盟 | playerState+alliance非null | version=1, playerState/allianceData完整 | Must |
| D5.1.2 | 序列化-无联盟 | playerState+alliance=null | allianceData=null | Must |
| D5.1.3 | 反序列化-版本不匹配 | version=999 | 返回默认playerState+null alliance | Must |
| D5.1.4 | 任务序列化/反序列化 | 含claimedPlayers(Set) | 序列化为string[], 反序列化恢复为Set | Must |

### D5.2 每日/每周重置 [4分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D5.2.1 | 每日重置-完整 | dailyReset() | 成员dailyContribution/dailyBossChallenges归零, bossKilledToday=false | Must |
| D5.2.2 | 商店周购重置 | resetShopWeekly() | 所有商品purchased=0 | Must |
| D5.2.3 | Boss刷新-等级关联 | level=3刷新Boss | boss.maxHp=200000, name=BOSS_NAMES[2] | Must |
| D5.2.4 | 任务刷新-随机性 | 多次dailyRefresh | 每次从8个任务池中随机抽3个 | Should |

### D5.3 ID生成与唯一性 [2分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D5.3.1 | ID格式校验 | generateId('ally') | 格式=ally_{timestamp}_{random6} | Should |
| D5.3.2 | ID冲突概率 | 连续生成1000个ID | 无重复(概率验证) | Could |

### D5.4 状态一致性 [2分支]

| ID | 测试分支 | 输入 | 预期输出 | 优先级 |
|----|---------|------|---------|--------|
| D5.4.1 | playerState与alliance.members同步 | 加入/退出后 | allianceId与members一致 | Must |
| D5.4.2 | Boss挑战次数双重检查 | member.dailyBossChallenges与playerState.dailyBossChallenges | 两者同步递增 | Must |

---

## 覆盖率评分矩阵

| 维度 | 分支数 | Must | Should | Could | Won't | 估计覆盖率 |
|------|--------|------|--------|-------|-------|-----------|
| D1 正常流程 | 28 | 20 | 6 | 2 | 0 | 9.2 |
| D2 边界条件 | 22 | 16 | 5 | 1 | 0 | 8.8 |
| D3 错误路径 | 24 | 18 | 4 | 2 | 0 | 9.0 |
| D4 跨系统交互 | 16 | 10 | 5 | 1 | 0 | 8.5 |
| D5 数据生命周期 | 12 | 8 | 3 | 1 | 0 | 8.7 |
| **总计** | **102** | **72** | **23** | **7** | **0** | **8.8** |

---

## 已识别风险项 (Builder标记)

| 风险ID | 描述 | 严重度 | 状态 |
|--------|------|--------|------|
| RISK-001 | 联盟名称无特殊字符/XSS过滤 | P1 | 待Challenger确认 |
| RISK-002 | declaration无长度限制 | P2 | 待Challenger确认 |
| RISK-003 | generateId使用Date.now()+random, 高并发可能冲突 | P2 | 待Challenger确认 |
| RISK-004 | Boss挑战次数双重检查(member+playerState)逻辑不一致风险 | P1 | 待Challenger确认 |
| RISK-005 | 商店purchased是实例共享状态, 多玩家买同一商品限购共享问题 | P1 | 待Challenger确认 |
| RISK-006 | createAllianceSimple硬编码playerId='player-1' | P1 | 待Challenger确认 |
| RISK-007 | AllianceData无Boss持久化字段(damageRecords等) | P2 | 待Challenger确认 |
| RISK-008 | 任务进度超额不截断(currentProgress可>targetCount) | P3 | 待Challenger确认 |

---

*Builder R1 完成, 交付Challenger审查。*
