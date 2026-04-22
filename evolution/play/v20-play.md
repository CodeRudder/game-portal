# v20.0 天下一统(下) — Play 文档 (Round 2)

> 版本: v20.0 天下一统(下) | 引擎域: 7域(achievement/activity/mail/advisor/bond/quest/social)
> 日期: 2025-07-24 | 轮次: Round 2

## P1: 成就系统 — 解锁检测 → 进度追踪 → 分档奖励 → 通知推送

```
1. AchievementSystem.init(deps)
   → 加载ACHIEVEMENT_CONFIGS(多分类+多分档), 注册事件监听
2. onEvent('hero_recruited', {heroId:'guanyu'})
   → 匹配成就定义: "招募名将" → 检查条件(heroId in FAMOUS_HEROES)
   → progress=1/1 → unlock() → grantReward(铜钱×500)
3. onEvent('stage_cleared', {stageId:5})
   → 匹配"征战四方" → progress=5/15 → 未完成
   → onEvent('stage_cleared', {stageId:15}) → progress=15/15 → unlock!
   → 分档奖励: bronze(5关)已领 → silver(10关)已领 → gold(15关)→领取天命×50
4. onEvent('rebirth_complete', {times:1})
   → 匹配"浴火重生" → progress=1/1 → unlock → 全服通知
5. getState() → { unlocked:['ach_hero_001','ach_stage_gold'], progress:{ach_arena:8/10} }
```
**验证**: 分档成就**3级递进**, 事件驱动**自动检测**, 奖励**即时发放**

## P2: 活动签到 — 每日签到 → 连续奖励 → 限时活动 → 代币商店

```
1. SignInSystem.init(deps) → 加载连续签到奖励表(7天循环)
   → signIn(day1) → reward=铜钱×1000 → streak=1
   → signIn(day2) → reward=招贤榜×1 → streak=2
   → signIn(day7) → reward=天命×20 → streak=7 → 循环重置
2. 跳过1天: signIn(day9) → streak重置为1, 连续奖励从头开始
   → 补签: retroactiveSignIn(day8, cost=天命×10) → streak恢复
3. TimedActivitySystem.startFlow('spring_festival')
   → phase='preview'(24h) → phase='active'(7天) → phase='settle'(1天) → 'closed'
   → 活动期间: 排行榜积分累积 → 奖励梯度(前10%/30%/60%/100%)
4. TokenShopSystem.init(deps) → 加载商品列表+限购配置
   → purchase('hero_shard_guanyu', cost=活动代币×200) → 库存-1
   → purchase同商品(第2次) → 超过限购(2次) → 拒绝
5. ActivityOfflineCalculator.calcOfflineProgress(offlineHours=8)
   → 日常活动100%累积, 赛季活动50%, 限时活动30%
```
**验证**: 7天签到**循环重置**, 限时活动**4阶段生命周期**, 代币商店**限购控制**

## P3: 邮件系统 — 模板渲染 → 收发管理 → 附件领取 → 批量操作

```
1. MailTemplateSystem.createTemplate('battle_reward')
   → subject="征战捷报", body="恭喜通过第{n}关!", variables=['n']
2. MailSystem.sendMail({to:'player_001', templateId:'battle_reward', vars:{n:'5'}})
   → renderTemplate → "恭喜通过第5关!" + 附件=[铜钱×2000, 粮草×500]
   → mail.status='unread', mail.hasAttachment=true
3. MailSystem.readMail(mailId) → status='read'
   → claimAttachment(mailId) → 资源到账, attachmentClaimed=true
4. MailSystem.sendSystemMail({templateId:'maintenance', vars:{date:'7/25'}})
   → 批量发送给全服玩家
5. MailSystem.batchDelete([id1,id2,id3])
   → 仅删除已读+已领附件的邮件, 有未领附件的拒绝删除
```
**验证**: 模板渲染**变量替换**, 附件**领取后可删**, 系统邮件**全服广播**

## P4: 军师推荐 — 上下文检测 → 推荐生成 → 玩家反馈 → 触发优先级

```
1. AdvisorSystem.init(deps) → 加载推荐规则库+触发条件
2. AdvisorTriggerDetector.detect(context)
   → context={gold:200, stage:3, idleMinutes:5}
   → 匹配规则: "资源充足建议升级建筑" → priority=high
3. AdvisorSystem.generateAdvice(triggerId)
   → advice={title:"军师献策", content:"主公资源充裕, 可升级兵营", action:'open_building'}
   → showAdvice(advice) → 玩家选择: 接受/忽略/不再提示
4. 玩家选择"接受" → 执行action → feedbackScore+=1
   → 玩家选择"忽略" → feedbackScore-=0.5
   → 连续忽略3次同类推荐 → 降低该类推荐频率
5. AdvisorSystem.update(dt) → 检查冷却时间, 避免推荐过于频繁
   → getState() → { pendingAdvice, feedbackScore, cooldownRemaining }
```
**验证**: 上下文感知**动态推荐**, 玩家反馈**自适应频率**, 触发检测**优先级排序**

## P5: 羁绊系统 — 阵营检测 → 效果计算 → 编队预览 → 跨域依赖(hero)

```
1. BondSystem.init(deps) → 加载阵营羁绊定义(4种类型)
   → import { FACTIONS } from '../hero/hero.types' (跨域依赖)
2. checkBonds(formation=['guanyu','zhangfei','liubei'])
   → 查阵营: 关羽(蜀) + 张飞(蜀) + 刘备(蜀) = 3同阵营
   → 激活"同仇敌忾"(3同): ATK+15%, DEF+10%
3. previewBonds(['guanyu','zhangfei','zhugeliang','zhaoyun','machao'])
   → 蜀×5 → "众志成城"(6同未满) + "同乡之谊"(2同蜀) = ATK+10%
   → 添加黄忠(蜀) → 6同 → "众志成城": ATK+25%, DEF+20%, 全属性+10%
4. 混搭检测: ['guanyu'(蜀),'caocao'(魏),'zhouyu'(吴),'lvbu'(群)]
   → 3+3未满足 → 无羁绊激活
   → 添加张飞(蜀)+张辽(魏) → 蜀2+魏2+吴1+群1 → 无激活
5. BondSystem.update(dt) → 编队变更时重新计算羁绊效果
```
**验证**: 4种阵营羁绊**正确激活**, 编队预览**实时计算**, 跨域hero依赖**类型安全**

## P6: 任务系统 — 主线/支线/日常 → 进度追踪 → 活跃度 → 20选6

```
1. QuestSystem.init(deps) → 加载PREDEFINED_QUESTS + DAILY_QUEST_TEMPLATES
   → acceptQuest('main_001') → 创建QuestInstance, status='active'
   → trackObjective('kill_enemy', count=5) → objective.progress=5/10
2. 日常任务: dailyPool生成20个候选 → 玩家选择6个接受
   → acceptDailyQuests(['daily_003','daily_007',...]) → 6个active
   → 完成日常 → 获活跃度点数 → 累积到里程碑奖励
3. QuestTrackerSystem.init(deps) → MAX_TRACKED_QUESTS=3
   → trackQuest('main_001') → 面板显示该任务进度
   → untrackQuest('main_001') → 替换为其他任务
4. 完成任务: allObjectivesMet → status='completed'
   → claimReward('main_001') → 铜钱×3000, 经验×500
   → completedQuestIds.add('main_001') → 防止重复接受
5. QuestSerialization.serialize(state) → JSON持久化
   → deserialize(savedData) → 恢复所有任务进度
```
**验证**: 主线/日常**双轨并行**, 20选6**自由度**, 活跃度**里程碑奖励**

## P7: 社交系统 — 好友管理 → 聊天频道 → 排行榜 → 借将互动

```
1. FriendSystem.init(deps) → MAX_FRIENDS=50
   → sendRequest('player_002') → 对方收到请求
   → acceptRequest('req_001') → 双方好友列表更新
   → removeFriend('player_002') → 24h冷却期
2. ChatSystem.init(deps) → 频道=[世界/联盟/私聊/系统]
   → sendMessage('world', '三国群英会!') → 广播+频率限制(5s/条)
   → sendMessage('private', target='player_002', msg='借个关羽')
   → mute(player, level='chat') → 禁言1h, level='login'→封号
3. LeaderboardSystem.init(deps) → 排行类型=[战力/关卡/声望/财富]
   → updateScore('power', playerScore=15000) → 排名计算
   → getTopN('power', n=10) → 前10名列表
   → getRank('power', playerId) → 个人排名+前后各3名
4. 好友互动(委托FriendInteractionSubsystem):
   → giftTroops(friendId, amount=500) → 每日限3次
   → visitCastle(friendId) → 获得友好度+随机资源
   → spar(friendId) → 友谊赛, 无消耗, 获得友好度
5. 借将(委托BorrowHeroSubsystem):
   → borrowHero(friendId, heroId='guanyu') → 借用12h
   → returnHero(borrowId) → 归还, 冷却24h
```
**验证**: 好友**50上限+24h冷却**, 聊天**4频道+频率限制**, 排行榜**4维度**, 借将**12h时限**

---

## 交叉验证矩阵

| 流程 | Achievement | SignIn | TimedActivity | TokenShop | Mail | MailTemplate | Advisor | Bond | Quest | QuestTracker | Friend | Chat | Leaderboard |
|------|:-----------:|:------:|:-------------:|:---------:|:----:|:------------:|:-------:|:----:|:-----:|:------------:|:------:|:----:|:-----------:|
| P1   | ✅ | — | — | — | ✉️通知 | — | — | — | — | — | — | — | — |
| P2   | — | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | ✅ |
| P3   | — | — | — | — | ✅ | ✅ | — | — | — | — | — | — | — |
| P4   | — | — | — | — | — | — | ✅ | — | — | — | — | — | — |
| P5   | — | — | — | — | — | — | — | ✅ | — | — | — | — | — |
| P6   | ✅解锁 | — | — | — | ✉️奖励 | — | — | — | ✅ | ✅ | — | — | — |
| P7   | — | — | — | — | — | — | — | — | — | — | ✅ | ✅ | ✅ |
