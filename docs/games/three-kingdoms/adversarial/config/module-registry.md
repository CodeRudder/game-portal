# 模块注册表 — 三国霸业

> 版本: v1.0 | 初始化: 2026-05-01

## 引擎模块总览（35个子系统）

### P0-核心模块（已测，需30轮深度进化）
| 模块 | 目录 | 依赖 | 对抗轮次 | 状态 |
|------|------|------|---------|------|
| hero | engine/hero/ | battle,campaign,equipment,bond | 4轮(R1-R4) | 待进化 |
| battle | engine/battle/ | hero,equipment,campaign | 4轮(R1-R4) | 待进化 |
| campaign | engine/campaign/ | hero,battle,equipment | 3轮(R1-R3) | 待进化 |

### P1-重要模块（已有对抗测试，需进化）
| 模块 | 目录 | 依赖 | 对抗文件 | 状态 |
|------|------|------|---------|------|
| building | engine/building/ | hero,resource,tech | 2个(106用例) | 待进化 |
| equipment | engine/equipment/ | hero,battle | 4个(147用例) | 待进化 |
| quest | engine/quest/ | hero,building | 1个(56用例) | 待进化 |
| alliance | engine/alliance/ | hero,quest | 1个(78用例) | 待进化 |
| tech | engine/tech/ | building,resource | 7个(220用例) | 待进化 |
| expedition | engine/expedition/ | hero,battle | 5个(193用例) | 待进化 |
| pvp | engine/pvp/ | hero,battle | 4个(160用例) | 待进化 |
| shop | engine/shop/ | resource,currency | 1个(54用例) | 待进化 |
| prestige | engine/prestige/ | hero,resource | 4个(141用例) | 待进化 |
| resource | engine/resource/ | building,tech | 4个(159用例) | R1完成(21 P0已修复) |
| bond | engine/bond/ | hero | 1个(51用例) | 待进化 |
| event | engine/event/ | 全局 | 1个(57用例) | 待进化 |
| mail | engine/mail/ | 全局 | 0个(融入常规) | 待进化 |

### P2-新模块（尚未覆盖）
| 模块 | 目录 | 依赖 | 状态 |
|------|------|------|------|
| achievement | engine/achievement/ | hero,quest | 未覆盖 |
| activity | engine/activity/ | event,quest | 未覆盖 |
| advisor | engine/advisor/ | hero,building | 未覆盖 |
| calendar | engine/calendar/ | event,activity | 未覆盖 |
| currency | engine/currency/ | resource,shop | 未覆盖 |
| guide | engine/guide/ | hero,building | 未覆盖 |
| heritage | engine/heritage/ | hero,prestige | 未覆盖 |
| map | engine/map/ | campaign,battle | 未覆盖 |
| npc | engine/npc/ | hero,quest | 未覆盖 |
| offline | engine/offline/ | resource,building | 未覆盖 |
| season | engine/season/ | event,quest | 未覆盖 |
| settings | engine/settings/ | 全局 | 未覆盖 |
| social | engine/social/ | alliance,mail | 未覆盖 |
| trade | engine/trade/ | resource,shop | 未覆盖 |
| tutorial | engine/tutorial/ | guide,hero | 未覆盖 |
| unification | engine/unification/ | 全局 | 未覆盖 |

## 进化优先级

1. hero → battle → campaign（核心三角，30轮深度进化）
2. building → equipment（与核心交互密集）
3. 其余模块按依赖关系排序
