# v6.0 技术审查 (Round 2)
日期: 2026-04-23

## 摘要
- P0: 5 / P1: 12 / P2: 18

## 文件行数 (>500行)

### P0 (>800行) — 5个
| 行数 | 文件 |
|------|------|
| 934 | engine/activity/\_\_tests\_\_/ActivitySystem.test.ts |
| 897 | engine/battle/\_\_tests\_\_/BattleTurnExecutor.test.ts |
| 888 | engine/equipment/\_\_tests\_\_/EquipmentSystem.test.ts |
| 831 | engine/shop/\_\_tests\_\_/ShopSystem.test.ts |
| 815 | core/event/encounter-templates.ts |

### P1 (601-800行) — 12个
| 行数 | 文件 |
|------|------|
| 755 | engine/equipment/\_\_tests\_\_/equipment-v10.test.ts |
| 714 | core/npc/npc-config.ts |
| 680 | engine/npc/\_\_tests\_\_/NPCMapPlacer.test.ts |
| 666 | engine/event/\_\_tests\_\_/EventTriggerSystem.test.ts |
| 646 | engine/npc/\_\_tests\_\_/NPCPatrolSystem.test.ts |
| 645 | engine/campaign/\_\_tests\_\_/CampaignProgressSystem.test.ts |
| 643 | engine/event/\_\_tests\_\_/EventNotificationSystem.test.ts |
| 623 | engine/responsive/\_\_tests\_\_/TouchInputSystem.test.ts |
| 623 | engine/npc/\_\_tests\_\_/NPCAffinitySystem.test.ts |
| 612 | engine/battle/\_\_tests\_\_/BattleEngine.test.ts |
| 607 | engine/heritage/\_\_tests\_\_/HeritageSystem.test.ts |
| 605 | engine/\_\_tests\_\_/ThreeKingdomsEngine.test.ts |

### P2 (501-600行) — 18个
| 行数 | 文件 |
|------|------|
| 593 | tests/ui-extractor/\_\_tests\_\_/ReactDOMAdapter.test.ts |
| 590 | engine/quest/\_\_tests\_\_/QuestSystem.test.ts |
| 582 | engine/campaign/\_\_tests\_\_/RewardDistributor.test.ts |
| 577 | engine/event/\_\_tests\_\_/EventEngine.test.ts |
| 570 | engine/activity/\_\_tests\_\_/SignInSystem.test.ts |
| 566 | engine/npc/\_\_tests\_\_/NPCFavorabilitySystem.test.ts |
| 558 | engine/alliance/\_\_tests\_\_/AllianceSystem.test.ts |
| 554 | engine/pvp/\_\_tests\_\_/ArenaSystem.test.ts |
| 549 | engine/mail/\_\_tests\_\_/MailSystem.test.ts |
| 549 | engine/expedition/\_\_tests\_\_/ExpeditionSystem.test.ts |
| 548 | core/event/event-v15.types.ts |
| 534 | engine/event/\_\_tests\_\_/EventTriggerEngine.test.ts |
| 529 | engine/battle/\_\_tests\_\_/BattleEffectManager.test.ts |
| 511 | engine/\_\_tests\_\_/engine-tech-integration.test.ts |
| 509 | tests/ui-extractor/\_\_tests\_\_/UITreeDiffer.test.ts |
| 503 | engine/activity/ActivitySystem.ts |
| 502 | tests/ui-review/\_\_tests\_\_/PrdChecker.test.ts |
| 502 | core/expedition/expedition.types.ts |

## DDD门面
- engine/index.ts: 138行
- exports-v9.ts: 有
- exports-v12.ts: 有

## ISubsystem: 90个
## as any: 52处
