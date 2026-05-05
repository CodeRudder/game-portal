# Dev Proxy Findings — BLD Building System Flows (R2)

> **Reviewer**: Dev Proxy (implementation perspective)
> **Date**: 2026-05-05
> **Scope**: All 14 flow files (FL-BLD-01 through FL-BLD-14) + PRD/UI cross-reference
> **Total findings**: 47

---

## P0 — Cannot Implement (Blockers)

### P0-01 | FL-BLD-02/04 | Building naming inconsistency across source documents

- **Flow/data**: FL-BLD-02, FL-BLD-04, FL-BLD-07, FL-BLD-01
- **Confusion**: The UI layout document uses "铁匠铺" (blacksmith) and "招贤馆" (recruitment hall) in ASCII diagrams and the sub-building config table, while the PRD renamed them to "工坊" (workshop) and "酒馆" (tavern) respectively in v3.0. Flow documents use the PRD names (工坊/酒馆), but the UI sub-building config table at BLD-2 lists "铁匠铺" as a simple building with no Tab, while the PRD clearly states 工坊 is a complex building with a "炼制" Tab. Similarly, "招贤馆" appears in UI where flows say "酒馆". An implementer cannot reconcile which name and behavior to code against.
- **Possible interpretations**: (A) The UI doc is stale (v2.0) and the PRD (v3.0) takes precedence, so ignore the UI naming. (B) They are different buildings and both exist. (C) The UI doc needs a v3.0 update to match PRD before flows can be considered authoritative.
- **Needed clarification**: Align all three document sets (PRD, UI, flows) to use the same 11 building names and their simple/complex classification. The UI sub-building config table must be updated to match PRD v3.0.

---

### P0-02 | FL-BLD-01/02 | 11 buildings vs. grid layout contradiction

- **Flow/data**: FL-BLD-01 (key requirements), FL-BLD-02-02
- **Confusion**: FL-BLD-01 states "11座建筑固定位置" and FL-BLD-02-02 says "11座建筑固定位置，空地显示+号". However, the UI grid shows only 11 buildings placed in a 6x6 grid with 25 empty plots. The PRD building list has exactly 11 buildings, but the UI layout positions list includes "铁匠铺" (row 3, col 4) which was deleted in PRD v3.0. If we use PRD v3.0's list (11 buildings), the UI grid positions are wrong because 铁匠铺 was deleted but its grid slot is occupied. There is no official updated grid layout for the v3.0 building set.
- **Possible interpretations**: (A) The deleted 铁匠铺's grid slot becomes an empty plot. (B) Buildings shift positions. (C) A completely new grid layout is needed for v3.0's 11 buildings.
- **Needed clarification**: Provide an updated 6x6 grid position map for the v3.0 building set (without 铁匠铺), specifying which exact grid positions the remaining 11 buildings occupy.

---

### P0-03 | FL-BLD-02-02 | 6x6 grid spec contradicts UI layout

- **Flow/data**: FL-BLD-02-02
- **Confusion**: FL-BLD-02-02 states "6列x6行网格, 卡片180x120px, 间距12px". The UI doc BLD-1 confirms 6x6 grid. However, a 6-column grid with 180px cards + 12px gaps + 24px padding = 6*180 + 5*12 + 2*24 = 1128px. This exceeds the 420px D-area but is for the full 1280px scene area. But the UI ASCII art only shows 5 columns per row (not 6). The spec says "6x6" but the visual shows "5 columns x 6 rows". An implementer cannot determine the correct column count.
- **Possible interpretations**: (A) The ASCII art is approximate; use 6 columns as spec'd. (B) Only 5 columns are needed since there are only 11 buildings + some empty plots, and a 5x5 or 5x6 grid suffices. (C) The grid is actually 6 columns but the ASCII art truncated for readability.
- **Needed clarification**: State definitively whether the grid is 6 columns or 5 columns. Provide exact column/row count. If 6x6, clarify whether 36 total cells = 11 buildings + 25 empty plots.

---

### P0-04 | FL-BLD-04 | Missing data: building construction costs per building

- **Flow/data**: FL-BLD-04-01 through 04-04
- **Confusion**: FL-BLD-04 describes building a new building (selecting from unbuilt list, checking resources, executing). The PRD provides detailed upgrade cost tables for each building but does NOT provide a "construction cost" table for initially building Lv.1 of each building. The flow references "校验建造条件" and "扣除建造资源" but never specifies what those resources are. The UI construction dialog shows "消耗: 100  150  15秒" for 医馆, but this data has no authoritative source table.
- **Possible interpretations**: (A) Construction cost = the first upgrade cost from each building's level table (e.g., 农田 Lv.1->2 costs). (B) Construction cost is a separate, independent value not yet defined. (C) The building starts at Lv.0 and the "construction" is just the first upgrade to Lv.1.
- **Needed clarification**: Provide a definitive "building construction cost" table listing: building name, construction resource costs (grain/coin/ore/wood/troops), construction time, for all 11 buildings.

---

### P0-05 | FL-BLD-03-06 | One-click max-level flow has no confirmation step

- **Flow/data**: FL-BLD-03-06
- **Confusion**: The main flow (FL-BLD-01) and FL-BLD-03 key requirements explicitly state "升级不需要确认弹窗，点击即执行". This is clear for single-level upgrades. But FL-BLD-03-06 describes "一键满级" which can consume massive amounts of resources across multiple levels. The step says "显示预计达到的等级和总消耗 -> 确认后批量执行" but no UI spec exists for this confirmation dialog. The UI doc only shows a Toast for single upgrades. This creates a contradiction: upgrades need no confirmation, but one-click-max does.
- **Possible interpretations**: (A) One-click-max is an exception that DOES have a confirmation dialog, contradicting the general rule. (B) The "确认" is just clicking the button itself, no separate dialog. (C) The feature needs a unique confirmation UI not yet designed.
- **Needed clarification**: Specify whether one-click-max-level has a unique confirmation dialog. If yes, provide its UI spec. If no, clarify the exact user interaction ("clicking the button IS the confirmation").

---

### P0-06 | FL-BLD-04 | No construction queue interaction model defined

- **Flow/data**: FL-BLD-04-04
- **Confusion**: FL-BLD-04-04 says "建造任务加入队列" and FL-BLD-04-05 says "队列下一项自动开始". But building construction (FL-BLD-04) and building upgrades (FL-BLD-03) share the same upgrade queue (FL-BLD-06). The flow does not specify whether building a new building from scratch occupies a queue slot the same way an upgrade does. If the queue is full, can the player still build a new Lv.1 building? The validation step (04-03) checks "升级队列有空槽", suggesting it uses the same queue, but this is never stated explicitly.
- **Possible interpretations**: (A) New building construction uses the same upgrade queue slots. (B) Construction is instant (5-30 seconds per key requirement) and does not consume queue slots. (C) Construction has its own separate queue.
- **Needed clarification**: Explicitly state whether new building construction consumes upgrade queue slots, and how it interacts with the queue management flow (FL-BLD-06).

---

### P0-07 | FL-BLD-07 | Hero subsystem integration boundary undefined

- **Flow/data**: FL-BLD-07-05, FL-BLD-07-06
- **Confusion**: FL-BLD-07-05 says "根据概率随机抽取武将品质 -> 在该品质池中随机选取武将 -> 创建武将实例（进入英雄系统）". The flow treats hero creation as a black box. There is no specification of: (1) What data fields the building system sends to the hero system. (2) What happens if the hero system rejects the creation (e.g., hero already owned, inventory full). (3) How to handle the async boundary -- does the building system wait for hero system confirmation before showing the result? The flow assumes hero creation always succeeds.
- **Possible interpretations**: (A) The hero system is synchronous and always succeeds. (B) There is a defined API contract between building/hero subsystems that is documented elsewhere. (C) This is a flow document gap; the integration boundary needs its own mini-spec.
- **Needed clarification**: Define the contract between the building system and hero system for recruitment: input data, success/failure responses, error handling, and sync/async model.

---

### P0-08 | FL-BLD-09 | Trade subsystem integration boundary undefined

- **Flow/data**: FL-BLD-09-05 through FL-BLD-09-09
- **Confusion**: FL-BLD-09 references trade subsystem types (`TradeRouteDef`, `Caravan`, `TradeGoodsPrice`, `TradeEventDef`, `ProsperityTier`, `NpcMerchantDef`) but these are code references, not flow-level specifications. The flow describes what the user sees but does not define the data contracts between the building system and trade system. For example: (1) What data does the building system request to render the trade routes? (2) How does caravan dispatch get created -- does the building system call a trade API or manage it internally? (3) How are trade events triggered -- server-push or client-poll?
- **Possible interpretations**: (A) The referenced TypeScript types ARE the spec; implement directly against them. (B) The trade subsystem will provide its own flow documents; BLD flows only cover the UI layer. (C) Integration contracts need to be extracted into a shared spec.
- **Needed clarification**: Define whether BLD flows should include inter-subsystem data contracts, or if integration specs live elsewhere. If elsewhere, provide references.

---

## P1 — Might Implement Wrong

### P1-01 | FL-BLD-01 | "可升级" state transition undefined

- **Flow/data**: FL-BLD-02-03 (building card states)
- **Confusion**: FL-BLD-02-03 defines 4 building states: 正常(upgradeable but not highlighted), 升级中(upgrading), 可升级(upgradeable with green highlight), 锁定(locked). The difference between "正常" (gold border) and "可升级" (green border) is unclear. When does a building transition from "正常" to "可升级"? The PRD does not define this state. If all buildings with resources available show green, the "正常" state would be nearly invisible since the system would constantly re-evaluate resource sufficiency.
- **Possible interpretations**: (A) "可升级" means all upgrade conditions are met (resources + prerequisites + queue slot available). "正常" means the building exists but conditions are not all met. (B) "可升级" is only shown when the player explicitly checks, and "正常" is the default display state. (C) These are the same state with visual emphasis toggle.
- **Needed clarification**: Define the exact conditions that distinguish "正常" from "可升级" state, and the transition triggers between them.

---

### P1-02 | FL-BLD-03-02 | Validation order not specified

- **Flow/data**: FL-BLD-03-02
- **Confusion**: The step lists 4 validation checks: (1) resources, (2) main city level, (3) queue slot, (4) special prerequisites. But the error handling shows 5 distinct error messages. The order of validation matters because if multiple conditions fail simultaneously, only the first error should be shown. The flow does not specify priority.
- **Possible interpretations**: (A) Validate in order 1->2->3->4, show first failure. (B) Validate all simultaneously and show all failures. (C) Validate resources first (most common failure), then prerequisites.
- **Needed clarification**: Specify validation order and whether to show one or all failures.

---

### P1-03 | FL-BLD-03-03/06 | Instant upgrade threshold "<5 seconds" ambiguous

- **Flow/data**: FL-BLD-03-03, FL-BLD-03 key requirements
- **Confusion**: The key requirement says "即时升级（<5秒）无队列占用，直接完成". FL-BLD-03-03 says "即时升级（<=5秒）不占队列槽，直接完成". Is it strictly less than 5 seconds, or less than or equal to? This changes behavior for upgrades that take exactly 5 seconds. Additionally, the PRD level data shows Lv.1->2 upgrades taking 5s-10s -- the boundary of "5 seconds" falls within the first upgrade tier, meaning the threshold is numerically significant.
- **Possible interpretations**: (A) Strictly < 5s = instant. (B) <= 5s = instant. (C) The threshold is a configuration value, not a hard-coded constant.
- **Needed clarification**: Use consistent comparison operator (< vs <=). Ideally specify the exact threshold value and its unit.

---

### P1-04 | FL-BLD-03-04 | Progress update mechanism undefined

- **Flow/data**: FL-BLD-03-04
- **Confusion**: The step says "持续更新升级进度（进度条+剩余时间）" and "进度条动画平滑，倒计时精确到秒". It does not specify HOW progress is updated. Options include: (1) Server pushes progress updates via WebSocket. (2) Client calculates progress locally based on start time + duration (and syncs on completion). (3) Client polls the server at intervals. The choice significantly affects implementation architecture and data freshness.
- **Possible interpretations**: (A) Client-side countdown from start_time + duration; server confirms completion. (B) Server pushes real-time progress via WebSocket. (C) Client polls every N seconds.
- **Needed clarification**: Specify the progress update mechanism (client-local countdown, server-push, or polling).

---

### P1-05 | FL-BLD-05-01 | Bubble number formula: "total resource value converted to copper equivalent" undefined

- **Flow/data**: FL-BLD-05-01
- **Confusion**: The step says "气泡数字显示总资源价值（折算为铜钱等价）". There is no exchange rate defined between the 4 resource types (grain/coin/ore/wood). Without a defined conversion formula, the implementer cannot calculate this number. The PRD does not define inter-resource exchange rates.
- **Possible interpretations**: (A) Each resource has a fixed weight (e.g., 1 grain = 1 coin, 1 ore = 2 coin, 1 wood = 2 coin). (B) The number shows the sum of all resources in their own units (not converted). (C) Only coin income is shown.
- **Needed clarification**: Define the inter-resource exchange rate formula, or change the spec to show per-resource counts instead of a converted total.

---

### P1-06 | FL-BLD-05-03 | Animation blocking behavior unclear

- **Flow/data**: FL-BLD-05-03
- **Confusion**: The step says "动画总时长 <= 1.5秒，不阻塞后续操作". But also says the animation involves resource numbers flying from multiple buildings. If there are 11 buildings producing resources, 11 simultaneous flying animations could be visually overwhelming and potentially cause performance issues on mobile. The flow does not specify: (1) Maximum number of simultaneous flying animations. (2) Whether animations are staggered or simultaneous. (3) What happens if the player clicks "collect" again during the animation.
- **Possible interpretations**: (A) All 11 animations fire simultaneously and complete in 1.5s. (B) Animations are staggered in groups. (C) A single combined animation represents all resources.
- **Needed clarification**: Specify animation staggering rules, maximum concurrent animations, and behavior when player re-triggers during animation.

---

### P1-07 | FL-BLD-06-03 | Acceleration cost formula missing

- **Flow/data**: FL-BLD-06-03
- **Confusion**: The step lists 3 acceleration options: "铜钱加速 / 天命加速 / 元宝秒完成" but provides NO cost formulas. How much copper does copper acceleration cost per minute reduced? What is "天命" (Destiny/Mandate) -- is it a currency, an item, or a daily allowance? How much 元宝 (premium currency) does instant completion cost? Without these formulas, acceleration cannot be implemented.
- **Possible interpretations**: (A) These costs are defined in a separate economy spec not referenced. (B) They should match the same acceleration formulas used in FL-BLD-11 (research acceleration). (C) They are defined per-building or per-level.
- **Needed clarification**: Provide acceleration cost formulas for all 3 options: copper acceleration (cost per minute/hour reduced), "天命" definition and cost, 元宝 instant completion (cost formula based on remaining time).

---

### P1-08 | FL-BLD-06-05 | Auto-upgrade: trigger frequency and scope undefined

- **Flow/data**: FL-BLD-06-05
- **Confusion**: "开启自动升级 -> 定期检查可升级建筑（资源够+前置满足）-> 自动加入队列". "定期" is not defined. How often does the system check? Every second? Every minute? When resources change? When queue becomes available? Additionally, which buildings are eligible for auto-upgrade -- all buildings, or a configurable subset? Does it prioritize by some order?
- **Possible interpretations**: (A) Check every time a queue slot opens. (B) Poll every N seconds/minutes. (C) React to resource threshold events.
- **Needed clarification**: Define: (1) Auto-upgrade check frequency/trigger. (2) Priority order for buildings. (3) Whether the player can configure which buildings are auto-upgraded. (4) Whether auto-upgrade considers the one-click-max feature.

---

### P1-09 | FL-BLD-07 | Probability calculation: additive or multiplicative bonuses?

- **Flow/data**: FL-BLD-07-02, FL-BLD-07-05
- **Confusion**: The UI shows probability breakdowns like "招贤馆 Lv.8: +16%, 主城 Lv.10: +20%, 科技: +5%, 合计: +19.2%". The math (16+20+5=41% but shown as 19.2%) implies multiplicative stacking, not additive. But the display format suggests additive breakdown. Without knowing the exact formula, an implementer will get the probability wrong. Additionally, PRD BLD-3's output formula is multiplicative (base x castle x tech x hero), but the probability display in the UI panel seems inconsistent.
- **Possible interpretations**: (A) All bonuses are multiplicative: final = base_rate * (1 + building_bonus/100) * (1 + castle_bonus/100) * (1 + tech_bonus/100). (B) All bonuses are additive to the base probability. (C) Some are additive, some multiplicative -- need a clear formula.
- **Needed clarification**: Provide the exact probability calculation formula with worked examples showing how base probability + building level + tech + hero attributes combine.

---

### P1-10 | FL-BLD-07 | Pity system (保底) edge cases undefined

- **Flow/data**: FL-BLD-07-05
- **Confusion**: "Lv16+解锁保底机制：每50次高级招募必出稀有武将". Undefined: (1) Does the pity counter reset on ANY rare pull, or only on the guaranteed rare? (2) Does the pity counter persist across sessions/logouts? (3) If the player reaches 49 pulls, upgrades the tavern to Lv16, does the counter start from 0? (4) What "rarity" qualifies as "稀有" -- purple only, or purple + orange? (5) Is the guaranteed rare in ADDITION to normal probability, or does it override the 50th pull's normal result?
- **Possible interpretations**: (A) Counter resets on any purple+ pull. (B) Counter resets only on reaching 50. (C) Counter is for "no purple in 50 pulls" and resets on any purple.
- **Needed clarification**: Define: counter reset condition, persistence scope (permanent vs. daily), rarity threshold for "稀有", interaction with tavern level-up during counting.

---

### P1-11 | FL-BLD-08 | Forging efficiency calculation example contradicts itself

- **Flow/data**: FL-BLD-08-03, FL-BLD-08-04
- **Confusion**: FL-BLD-08-03 says "工坊等级+科技加成计算锻造效率 -> 显示实际材料消耗". FL-BLD-08-04 says "锻造效率减少实际消耗（如效率+21.6%，材料x10实际消耗x8）". The math: if base cost is 10 and efficiency is +21.6%, the reduction should be 10 * (1 - 0.216) = 7.84, rounded to 8. This makes sense. But the UI doc's overview example shows "效率21.6% -> 实际消耗 8 份" for base x10. What about x30 (精炼) and x100 (神炼)? Does the same efficiency multiplier apply? The flow does not specify whether efficiency is a flat percentage reduction or a tier-based discount.
- **Possible interpretations**: (A) Efficiency is a flat multiplier applied to all modes. (B) Different forging modes have different efficiency coefficients. (C) Efficiency only applies to material cost, not coin cost.
- **Needed clarification**: State whether forging efficiency applies uniformly to all forging modes (快速/精炼/神炼), and whether it reduces material cost only or also coin cost.

---

### P1-12 | FL-BLD-08 | Equipment attribute generation rules undefined

- **Flow/data**: FL-BLD-08-04, FL-BLD-08-05
- **Confusion**: FL-BLD-08-05 says "装备属性词条随机生成（主属性固定类型+副属性随机池）" and the UI shows "属性: 攻击力 + 暴击/命中/吸血(随机)". But there is NO specification of: (1) The attribute range per quality tier (white vs. orange). (2) How many sub-stats each quality gets. (3) The probability distribution of each sub-stat. (4) Whether "特殊词条" (special effects) are guaranteed for certain modes. An implementer cannot build the random attribute generation system from this description alone.
- **Possible interpretations**: (A) This is defined in the equipment subsystem spec, not BLD. (B) The BLD flows should at minimum reference the equipment attribute spec. (C) These rules are to be designed as part of implementation.
- **Needed clarification**: Either provide attribute generation rules within BLD flows or provide a clear reference to the equipment subsystem spec that defines them.

---

### P1-13 | FL-BLD-09-07 | Trade event trigger conditions undefined

- **Flow/data**: FL-BLD-09-06, FL-BLD-09-07
- **Confusion**: "定期检测是否触发贸易事件" and "商队运输中随机触发". Neither the trigger probability nor the maximum number of events per trip is defined. Can a single caravan encounter 0, 1, 2, or 8 events during a 10-30 minute trip? What determines the event type? The PRD mentions 8 event types but no frequency distribution.
- **Possible interpretations**: (A) 1 event per trip, random type. (B) Events fire at fixed intervals during transport. (C) Events have a per-minute probability check.
- **Needed clarification**: Define: (1) Event trigger probability per trip or per time unit. (2) Maximum events per trip. (3) Event type selection mechanism. (4) Whether events can overlap (multiple pending events).

---

### P1-14 | FL-BLD-09-08 | Combat outcome formula undefined

- **Flow/data**: FL-BLD-09-08
- **Confusion**: "根据选项类型+武将属性计算胜负". The flow mentions 武将武力 vs 山贼规模 as factors but provides no formula. Is there a combat power comparison? A random element? A threshold? The PRD's event result rules table says "武将武力 vs 山贼规模" but this is descriptive, not computational. Without a formula, the result calculation cannot be implemented.
- **Possible interpretations**: (A) If guard martial arts >= enemy size threshold, guaranteed win. (B) Win probability = guard_attack / (guard_attack + enemy_power). (C) Dice roll with modifier based on stat difference.
- **Needed clarification**: Provide the combat outcome formula with variables: guard stats, enemy stats, random factor, win/loss threshold.

---

### P1-15 | FL-BLD-09-10 | NPC merchant spawn rules undefined

- **Flow/data**: FL-BLD-09-10
- **Confusion**: "根据繁荣度等级决定出现的NPC类型" and "NPC商人限时出现（通常1-4小时）". No definition of: (1) How many NPCs can appear simultaneously. (2) Spawn cooldown between appearances. (3) Whether spawn is deterministic or random. (4) The exact prosperity tier -> NPC type mapping. The PRD mentions 5 NPC types (行商/珍品/奢侈品/黑市/大师) and prosperity tiers, but the exact unlock/ spawn rules are not specified.
- **Possible interpretations**: (A) Each prosperity tier unlocks 1 additional NPC type, and they cycle. (B) All unlocked types have independent spawn timers. (C) At most 1 NPC active at a time.
- **Needed clarification**: Define NPC spawn rules: spawn trigger, cooldown, maximum concurrent NPCs, prosperity tier unlock mapping.

---

### P1-16 | FL-BLD-10 | Army (troops) subsystem integration undefined

- **Flow/data**: FL-BLD-10-02, FL-BLD-10-03, FL-BLD-10-05
- **Confusion**: FL-BLD-10 describes managing "编队" (formations) with 武将 and 兵力, but the data contracts with the combat/expedition subsystem are completely undefined. Key unknowns: (1) Is "兵力" a resource consumed from a pool, or generated per-formation? (2) When the player saves a formation, does it "lock" those troops, preventing them from being used elsewhere? (3) What is the maximum troops per formation? (4) How does the 3-type unit system (步/骑/弓) map to actual troop allocation?
- **Possible interpretations**: (A) Troops are allocated from the barrack's pool and locked to the formation. (B) Formations are templates; troops are consumed when dispatched. (C) Each formation has its own troop count independent of the barrack pool.
- **Needed clarification**: Define the data model for formation troop allocation, the relationship between barrack troop pool and formation troops, and the locking/unlocking mechanism.

---

### P1-17 | FL-BLD-10-05 | Training acceleration: "temporary boost" specifics missing

- **Flow/data**: FL-BLD-10-05
- **Confusion**: "消耗粮草 -> 增加兵力产出速度（持续一段时间）". "一段时间" (a period of time) is undefined. How long does the boost last? What is the boost magnitude? Is it a flat increase or a percentage? The step also says "训练速度受兵营等级和酒馆等级双重影响" but no formula is provided.
- **Possible interpretations**: (A) Boost duration and magnitude are fixed constants. (B) Boost scales with grain consumed. (C) Boost is a percentage multiplier lasting until next training cycle.
- **Needed clarification**: Define training acceleration: boost magnitude (flat or %), duration, cost formula (grain per boost), and how barrack level and tavern level interact.

---

### P1-18 | FL-BLD-11-01 | Tech point output formula incomplete

- **Flow/data**: FL-BLD-11-01
- **Confusion**: The step says "计算科技点产出（基础 x 主城加成 x 科技加成 x 武将智力加成）". The PRD output formula (BLD-3) is "基础产出 x 主城加成 x 科技加成 x 武将加成 x 声望加成". The flow omits "声望加成" (reputation bonus). Additionally, "武将智力加成" in the flow is more specific than "武将加成" in the PRD -- which attribute type applies?
- **Possible interpretations**: (A) The flow is correct; reputation bonus does not apply to tech points. (B) The PRD formula is canonical; the flow should include reputation bonus. (C) Tech points use a different formula than the general output formula.
- **Needed clarification**: Clarify the exact tech point output formula, including whether reputation bonus applies, and which hero attribute (intelligence vs. general) is used.

---

### P1-19 | FL-BLD-12-03 | "10% daily production" grain cost baseline undefined

- **Flow/data**: FL-BLD-12-03
- **Confusion**: "消耗粮草（10%日产）". Which building's daily production? The farm's base production? The total grain production across all farms? The current grain output rate x 86400 seconds? If the player has 3 farms at different levels, is "日产" the sum of all their daily output? What if the farm is being upgraded during the calculation?
- **Possible interpretations**: (A) 10% of the total current grain production rate x 86400 (daily output). (B) 10% of the specific farm building's daily output. (C) A fixed cost that scales with hospital level.
- **Needed clarification**: Define "日产" precisely: which building(s), which rate (base or after bonuses), and at what point in time (current snapshot).

---

### P1-20 | FL-BLD-12-04 | Buff stacking behavior undefined

- **Flow/data**: FL-BLD-12-04
- **Confusion**: "+10%产出持续10分钟". If the player heals multiple times (after the 30-minute cooldown), do the buffs stack? Can the player have +20% or +30% output with multiple consecutive heals? The flow does not address buff stacking.
- **Possible interpretations**: (A) Buffs do not stack; re-healing refreshes the timer. (B) Buffs stack additively (10% + 10% = 20%). (C) Buffs stack multiplicatively.
- **Needed clarification**: Define buff stacking behavior: stackable or not, refresh vs. extend timer, maximum stacks.

---

### P1-21 | FL-BLD-13-04 | Trap reinforcement resource costs undefined

- **Flow/data**: FL-BLD-13-04
- **Confusion**: "加固消耗（矿石+木材）" and "加固消耗矿石+木材". But no cost formula is provided. How much ore and wood per trap? Does it scale with wall level? How many traps can be deployed per reinforcement action?
- **Possible interpretations**: (A) Fixed cost per trap (e.g., 100 ore + 100 wood per trap). (B) Cost scales with wall level. (C) Cost scales with current trap count.
- **Needed clarification**: Provide trap reinforcement cost formula: ore cost per trap, wood cost per trap, and any scaling factors.

---

### P1-22 | FL-BLD-03/06 | Offline upgrade completion: timing resolution

- **Flow/data**: FL-BLD-06 (E-06-03)
- **Confusion**: E-06-03 says "离线期间升级完成：正常结算，队列下一项自动开始". The PRD states "离线效率 = 资源效率 x 1.2（建造额外20%效率）". But the flow does not specify: (1) How offline time is calculated (server timestamp diff?). (2) Whether multiple queued upgrades can complete during one offline period. (3) How the "20% bonus" interacts with the real-time upgrade timer (does the server fast-forward?). (4) What happens if the player was offline for 24 hours and had 4 queued upgrades -- do all 4 complete?
- **Possible interpretations**: (A) Server simulates the queue in order during offline period with 1.2x speed. (B) Only the current active upgrade gets the offline bonus; queued items wait. (C) All pending upgrades complete with offline bonus if time allows.
- **Needed clarification**: Define offline queue simulation logic: how many upgrades can complete, how the 1.2x efficiency applies, and how completion order is handled.

---

### P1-23 | FL-BLD-05 | Resource overflow (E-05-03) handling incomplete

- **Flow/data**: FL-BLD-05 (E-05-03)
- **Confusion**: E-05-03 says "资源溢出（超过上限）：正常收取+Toast'库存已满，溢出资源已损耗'". But what is the storage cap for each resource? The PRD mentions "容量=产出速率x24h" for ore and wood, but does not define caps for grain or coin. Additionally, the PRD mentions "溢出降速50%" for ore/wood -- does this affect the collection amount or just the production rate? The flow treats overflow as a simple warning but the underlying mechanics are unclear.
- **Possible interpretations**: (A) All resources have the same cap formula (output rate x 24h). (B) Only ore/wood have caps; grain/coin are uncapped. (C) Caps vary by resource type with different formulas.
- **Needed clarification**: Define storage caps for ALL 4 resource types, the overflow behavior (discard vs. slowdown), and how the cap is displayed to the player.

---

### P1-24 | FL-BLD-02-06 | Empty plots: are they per-building-type or generic?

- **Flow/data**: FL-BLD-02-06, FL-BLD-04
- **Confusion**: FL-BLD-02-06 says clicking an empty plot opens the building selection. FL-BLD-04 says the popup shows "尚未建造的建筑" (unbuilt buildings). But the UI grid has 25 empty plots for 11 buildings. Once all 11 buildings are built, what happens to the remaining empty plots? Can the player still click them? Does the game prevent this case entirely?
- **Possible interpretations**: (A) After all 11 buildings are built, empty plots become decorative (non-interactive). (B) Empty plots allow rebuilding demolished buildings (demolition not mentioned). (C) Some plots are reserved for future building types.
- **Needed clarification**: Define the behavior of empty plots when all 11 buildings have been built, and whether building demolition is supported.

---

## P2 — Incomplete

### P2-01 | FL-BLD-01 | No flow for building demolition/reset

- **Flow/data**: FL-BLD-01 (global roadmap)
- **Confusion**: The PRD and flows describe building, upgrading, and canceling upgrades, but there is NO flow for demolishing a building. If a player accidentally builds the wrong building on a plot (though each building type is unique), or wants to rearrange, there is no mechanism described. While this may be intentional (no demolition allowed), it should be explicitly stated.
- **Possible interpretations**: (A) Demolition is not a feature; buildings are permanent once built. (B) Demolition will be added in a future iteration. (C) It was overlooked.
- **Needed clarification**: State explicitly whether building demolition is supported. If not, add this as a design decision note.

---

### P2-02 | FL-BLD-01 | No flow for main city upgrade (the "mother building")

- **Flow/data**: FL-BLD-01 (Phase B)
- **Confusion**: The main city (主城) is listed among the 11 buildings and follows the same upgrade mechanics, but its upgrade is critical because it gates all other buildings. The PRD provides a detailed upgrade table for the main city with special prerequisites like "任一建筑Lv4" and "任一建筑Lv9". However, no flow specifically addresses main city upgrade validation with its unique prerequisites. FL-BLD-03 (general upgrade) mentions "特殊前置条件" but does not detail the main city's specific prerequisites.
- **Possible interpretations**: (A) Main city upgrade uses the same FL-BLD-03 flow with expanded prerequisites. (B) Main city needs its own dedicated flow due to unique prerequisites. (C) The "特殊前置条件" field in FL-BLD-03-02 is sufficient.
- **Needed clarification**: Either confirm that FL-BLD-03 covers main city upgrades with its special prerequisites, or create a dedicated main city upgrade sub-flow.

---

### P2-03 | FL-BLD-03 | No flow for upgrade failure during progress

- **Flow/data**: FL-BLD-03-04
- **Confusion**: What happens if the server goes down during an upgrade? The client shows a progress bar, but the server-side state may be inconsistent. When the player reconnects, how is the upgrade state reconciled? The flow only covers "network timeout during initial request" (E-03-06) but not mid-upgrade failure.
- **Possible interpretations**: (A) The server tracks start time and duration; on reconnect, progress is recalculated. (B) Upgrades are transactional; failure rolls back. (C) This is handled by a global reconnection flow not specific to buildings.
- **Needed clarification**: Define upgrade state reconciliation on reconnection.

---

### P2-04 | FL-BLD-07 | No flow for recruit ten-pull (x10 recruitment)

- **Flow/data**: FL-BLD-07
- **Confusion**: Many gacha/hero recruitment games offer a 10x pull option. The flow only describes single recruitment. Is 10x recruitment supported? If so, how does pity interact with it (does it count as 10 individual pulls)?
- **Possible interpretations**: (A) Only single recruitment is supported. (B) 10x will be added later. (C) It was an oversight.
- **Needed clarification**: Specify whether multi-pull recruitment is supported and how it interacts with pity counter.

---

### P2-05 | FL-BLD-08 | Batch forging: result display timing

- **Flow/data**: FL-BLD-08-08
- **Confusion**: "批量锻造结果逐一展示" and "批量锻造结果汇总展示（获得N件装备，按品质分类统计）". These two descriptions are contradictory. Does the player see each item one by one (like a gacha pull sequence), or a summary screen showing counts by quality?
- **Possible interpretations**: (A) Quick one-by-one reveal then a summary. (B) Summary only. (C) Player can choose the display mode.
- **Needed clarification**: Unify the result display description: per-item reveal, summary only, or both.

---

### P2-06 | FL-BLD-08 | Equipment enhancement (强化) max level undefined

- **Flow/data**: FL-BLD-08-06
- **Confusion**: The error branch says "装备已满级：Toast'装备已达最高强化等级'". But what IS the maximum enhancement level? +10? +20? Does it vary by equipment quality? The flow provides no numbers.
- **Possible interpretations**: (A) Max level is defined in the equipment subsystem spec. (B) Max level is a constant (e.g., +15). (C) Max level varies by equipment tier.
- **Needed clarification**: Specify max enhancement level, or reference the equipment subsystem spec.

---

### P2-07 | FL-BLD-09 | Prosperity level thresholds undefined

- **Flow/data**: FL-BLD-09-01, FL-BLD-09-10
- **Confusion**: "繁荣度4等级（萧条/平稳/繁荣/鼎盛）" but no threshold values. The UI shows "繁荣度: 62/100 等级: 繁荣(产出1.3x) 下一等级: 鼎盛(75)". This suggests thresholds at 0/25/50/75, but these are inferred from a UI example, not specified. Also, the prosperity value range (0-100?) is not defined.
- **Possible interpretations**: (A) Thresholds are 0/25/50/75 out of 100. (B) Thresholds scale with building level. (C) Thresholds are defined in the trade subsystem.
- **Needed clarification**: Define prosperity value range, tier thresholds, and output multiplier per tier.

---

### P2-08 | FL-BLD-10 | Formation dispatch to map system: no handoff spec

- **Flow/data**: FL-BLD-10 (key requirements)
- **Confusion**: "编队可直接用于地图征服/攻城". This is stated as a key requirement but there is no flow or data contract for how formations transition from the building system to the map/expedition system. What data is passed? Does the building system "release" the formation, or does the map system "pull" it?
- **Possible interpretations**: (A) The map system reads formation data directly from the barrack subsystem. (B) The player explicitly "dispatches" a formation from the barrack. (C) Formations are shared data with no explicit handoff.
- **Needed clarification**: Define the formation-to-map handoff mechanism.

---

### P2-09 | FL-BLD-11 | Research queue: no queue slot limit defined

- **Flow/data**: FL-BLD-11-02
- **Confusion**: "可排队多个科技研究，自动推进". How many? Is there a queue slot limit like the building upgrade queue? Or is it unlimited? If unlimited, could a player queue 100 technologies? The building upgrade queue (FL-BLD-06) has clear slot limits (1-4 based on main city level), but no equivalent is defined for research.
- **Possible interpretations**: (A) Research queue is unlimited. (B) Research queue shares building upgrade queue slots. (C) Research has its own slot limit.
- **Needed clarification**: Define research queue slot limit and any scaling mechanism.

---

### P2-10 | FL-BLD-14-02 | Left-swipe gesture threshold and conflict resolution insufficient

- **Flow/data**: FL-BLD-14-02, E-14-01
- **Confusion**: E-14-01 says "左滑仅在水平距离>垂直距离时触发". But what about diagonal swipes? What about fast flicks vs. slow drags? The "40px trigger distance" is defined but there is no maximum distance or velocity threshold. This could conflict with browser back-swipe gestures on certain mobile browsers.
- **Possible interpretations**: (A) Simple pixel threshold is sufficient. (B) Need velocity and angle thresholds. (C) Use a proven mobile gesture library.
- **Needed clarification**: Add gesture recognition parameters: minimum velocity, maximum angle from horizontal, and handling of browser-level gesture conflicts.

---

### P2-11 | FL-BLD-14 | Mobile landscape mode not addressed

- **Flow/data**: FL-BLD-14
- **Confusion**: The mobile adaptation flow only considers "screen width < 768px" (portrait mode). What about tablets or phones in landscape orientation where width > 768px but height < 696px? Do they get the PC layout (which may be too compressed) or the mobile layout (which wastes horizontal space)?
- **Possible interpretations**: (A) Landscape tablets use PC layout. (B) A third "tablet" layout is needed. (C) The breakpoint should consider both width AND height.
- **Needed clarification**: Define behavior for landscape orientation on tablets and large phones.

---

### P2-12 | FL-BLD-03/04/06 | Upgrade queue: what happens to queued items when main city levels up?

- **Flow/data**: FL-BLD-06
- **Confusion**: When the main city levels up, queue slots increase (e.g., from 1 to 2 at Lv6). If the player had a queued item waiting, does it automatically start in the new slot? If the main city is itself in the queue and levels up, does the queue expand mid-upgrade?
- **Possible interpretations**: (A) Queue expansion is immediate; waiting items auto-start. (B) Queue expansion only applies to NEW items. (C) Player must manually refresh the queue UI.
- **Needed clarification**: Define queue behavior when slot count increases due to main city level-up.

---

## P3 — Optimization

### P3-01 | FL-BLD-02-01 | Skeleton screen implementation suggestion

- **Flow/data**: FL-BLD-02-01
- **Confusion**: "加载时显示骨架屏，不超过1秒". For 11 buildings, the skeleton screen would show 11 placeholder cards. This is straightforward but the spec does not address: (1) What the skeleton looks like (same card shape with gray fill?). (2) Whether the skeleton includes the upgrade queue area. (3) Transition animation from skeleton to loaded content.
- **Possible interpretations**: Standard skeleton screen patterns apply.
- **Needed clarification**: Low priority, but consider adding a brief skeleton screen visual spec.

---

### P3-02 | FL-BLD-03-04 | Progress bar precision: "precise to seconds" on long upgrades

- **Flow/data**: FL-BLD-03-04
- **Confusion**: "倒计时精确到秒" but upgrade times can span hours. Showing "02:30:15" for a 2.5-hour upgrade adds minimal value. Consider showing hours:minutes for >1 hour upgrades, and minutes:seconds for <1 hour.
- **Possible interpretations**: Display format should adapt to duration range.
- **Needed clarification**: Consider adaptive time display format.

---

### P3-03 | FL-BLD-05-02 | Atomic collection: what if player closes browser mid-transaction?

- **Flow/data**: FL-BLD-05-02
- **Confusion**: "原子操作——要么全部收取成功，要么全部不收". If the server processes the collection but the client disconnects before receiving the response, the player has lost resources but never saw the result. How is this reconciled on re-login?
- **Possible interpretations**: Standard idempotent transaction handling applies.
- **Needed clarification**: Consider adding reconnection reconciliation note.

---

### P3-04 | FL-BLD-07-07 | Recruitment history: 50-record limit with no pagination

- **Flow/data**: FL-BLD-07-07
- **Confusion**: "记录最近50次招募结果". Is this client-side or server-side? If server-side, is there pagination for players who want to see older history? If client-side, what happens on cache clear?
- **Possible interpretations**: Server-side with a 50-record window, no pagination.
- **Needed clarification**: Consider whether 50 is the right limit and whether older records should be accessible.

---

### P3-05 | FL-BLD-09-03 | Price refresh: "6 hours" with no server-sync mechanism

- **Flow/data**: FL-BLD-09-03
- **Confusion**: "价格6小时刷新". Does every player see the same prices at the same time (global market), or does each player have independent price cycles? The flow does not specify.
- **Possible interpretations**: (A) Global synchronized price refresh (all players see same prices). (B) Per-player independent 6-hour cycle. (C) Price is determined when the player opens the trade UI.
- **Needed clarification**: Specify whether prices are global or per-player.

---

### P3-06 | FL-BLD-14-01 | Mobile list grouping: "by area" undefined

- **Flow/data**: FL-BLD-14-01
- **Confusion**: "按区域分组（核心/民生/军事/文教/防御）". The PRD building table has a "分区" column, but the groupings are not exhaustive. 主城 is "核心中央", 农田/市集 are "资源", 市舶司 is unlabeled in the PRD's partition column. The 5 groups (核心/民生/军事/文教/防御) do not directly map to the PRD's partition labels.
- **Possible interpretations**: (A) Use the 5 groups defined in FL-BLD-14-01. (B) Use PRD partition labels. (C) Define a clear mapping table.
- **Needed clarification**: Provide a definitive building-to-group mapping for the mobile list view.

---

### P3-07 | FL-BLD-08-07 | Equipment decompose: "unequipped only" validation gap

- **Flow/data**: FL-BLD-08-07
- **Confusion**: "仅未穿戴装备可分解". But what about equipment locked by other systems (e.g., in a formation, in a trade, in a quest)? The flow only checks "equipped vs. unequipped" but real games typically have multiple lock states.
- **Possible interpretations**: Only the simple equipped/unequipped check is needed for MVP.
- **Needed clarification**: Consider defining a more complete "equipment lock state" model for future-proofing.

---

## Summary

| Priority | Count | Description |
|:--------:|:-----:|-------------|
| P0 | 8 | Cannot implement -- missing data, contradictions, undefined contracts |
| P1 | 24 | Might implement wrong -- ambiguous rules, missing formulas, edge cases |
| P2 | 12 | Incomplete -- missing flows, undefined behaviors, gaps |
| P3 | 7 | Optimization -- UX polish, future-proofing, minor gaps |
| **Total** | **51** | |

### Critical Path for Implementation

The P0 issues must be resolved before ANY implementation can begin:

1. **Naming alignment** (P0-01): PRD v3.0 renamed buildings; UI doc is still v2.0. All three document sets must agree.
2. **Grid layout** (P0-02/03): The actual grid layout for v3.0's building set is undefined.
3. **Construction costs** (P0-04): No cost table for building Lv.1 of each building.
4. **Confirmation UX** (P0-05): One-click-max-level contradicts "no confirmation" rule.
5. **Queue interaction** (P0-06): New building construction's queue behavior is undefined.
6. **Subsystem contracts** (P0-07/08): Hero and trade system integration boundaries are black boxes.

### Key Themes

- **Cross-document inconsistency**: The UI doc (v2.0) uses old building names and classifications that conflict with PRD v3.0 and the flow documents.
- **Missing formulas**: Multiple systems reference calculations (probability, combat, acceleration costs, resource caps) without providing the actual math.
- **Undefined subsystem boundaries**: The flows describe user-facing behavior well but treat subsystem interactions (hero creation, trade dispatch, combat resolution) as opaque.
- **State machine gaps**: Building states, upgrade states, and formation states lack complete transition tables with all edge cases covered.
