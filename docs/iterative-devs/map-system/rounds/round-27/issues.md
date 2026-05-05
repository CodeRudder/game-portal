# Round 27 问题追踪

> **轮次**: Round 27 — 全流程E2E(失败/撤退路径)对抗性核验
> **创建**: 2026-05-05
> **来源**: Builder/Challenger/Judge 对抗性评测

## 问题清单

| ID | 严重度 | 类型 | 来源 | 描述 | 涉及文件 | 状态 |
|----|:------:|------|:----:|------|---------|:----:|
| R27-I01 | P0 | 功能 | Judge P0-1 | 失败路径两套伤亡率不一致: SiegeSystem 30% vs SettlementPipeline 40-70% | SiegeSystem.ts, WorldMapTab.tsx | ✅ |
| R27-I02 | P1 | 功能 | Judge P0-2→P1 | cancelSiege在settling状态使用全量兵力创建回城(防御性) | SiegeTaskManager.ts | ➡️ |
| R27-I03 | P1 | 功能 | Judge P0-3→P1 | settling状态cancel资源守恒(不可达场景) | SiegeTaskManager.ts | ➡️ |
| R27-I04 | P1 | 架构 | Judge P1-1 | 资源扣减架构分裂(随P0修复) | SiegeSystem.ts | ✅ |
| R27-I05 | P1 | 功能 | Judge P1-4 | 弹窗显示defeatTroopLoss与实际回城伤亡不一致 | WorldMapTab.tsx | ✅ |
| R27-I06 | P1 | 测试 | Judge P1-2 | 缺少settling状态cancel真实MarchingSystem e2e测试 | tests/ | ➡️ |
| R27-I07 | P1 | 设计 | Judge P1-5 | 粮草消耗时机缺少设计决策文档 | docs/ | ➡️ |
| R27-I08 | P2 | 测试 | Judge P1-3→P2 | cancel路径缺少cancelReason字段 | SiegeTaskManager.ts | ➡️ |
| R27-I09 | P2 | 时序 | Judge P1-6→P2 | setTimeout回调与cancelSiege理论竞态 | WorldMapTab.tsx | ➡️ |
| R27-I10 | P2 | 测试 | Judge P2-1 | deductSiegeResources静默跳过导致测试与生产不一致 | SiegeSystem.ts | ➡️ |
| R27-I11 | P2 | 架构 | Judge P2-2 | 战斗系统与结算系统判定脱钩 | SiegeBattleSystem.ts | ➡️ |
| R27-I12 | P2 | 功能 | Judge P2-3 | createTask不校验资源，executeSiege才校验 | SiegeSystem.ts | ➡️ |

## 修复记录

### R27-I01 ✅ 已修复
- **问题**: 失败路径SiegeSystem扣30%兵力(基于cost.troops)，SettlementPipeline计算40-70%伤亡(基于expedition.troops)，两套值互相矛盾。弹窗显示30%但回城按40-70%扣减
- **修复**:
  1. SiegeSystem.resolveSiege的defeat分支改为`deductSiegeResources({ troops: 0, grain: cost.grain })`，仅扣粮草不扣兵力(与胜利路径对齐)
  2. WorldMapTab.tsx弹窗数据`defeatTroopLoss`改为使用`casualties.troopsLost`(来自SettlementPipeline)
- **验证**: 108个引擎测试 + 55个UI测试全部通过

### R27-I04 ✅ 已修复(随I01)
- 伤亡计算统一归SettlementPipeline，SiegeSystem胜利/失败路径均不扣兵力

### R27-I05 ✅ 已修复(随I01)
- 弹窗defeatTroopLoss使用SettlementPipeline的casualties.troopsLost

## 传递问题

### R24传递P1(2个，关闭1个+继续1个)
| ID | 问题 | 处理 |
|----|------|------|
| R24-I07 | 连续时间vs回合制+同步阻塞 | ✅关闭: 当前架构为同步阻塞结算，设计决策 |
| R24-I08 | 失败条件死代码 | ➡️→R28: timeExceeded在Path A中不可达 |

### R26传递P1(6个，关闭4个+继续2个)
| ID | 问题 | 处理 |
|----|------|------|
| R26-I03 | setTimeout(0)竞态风险 | ➡️→R28: 风险可控但应文档化 |
| R26-I04 | UI EventBus与引擎EventBus隔离 | ✅关闭: 设计决策 |
| R26-I05 | 集成测试mock率高 | ✅关闭: siege-interrupt e2e已使用真实EventBus |
| R26-I06 | 缺全链路事件断言测试 | ✅关闭: siege-interrupt e2e已补充 |
| R26-I07 | 资源守恒未验证 | ➡️→R28: 撤退路径仍无守恒测试 |
| R26-I08 | 无单次连续E2E测试 | ✅关闭: siege-interrupt e2e已提供 |

### R27 P1传递(4个)
| ID | 问题 | 传递去向 |
|----|------|---------|
| R27-I02 | cancelSiege settling状态全量兵力 | → R28 |
| R27-I03 | settling cancel资源守恒 | → R28 |
| R27-I06 | 缺settling cancel e2e测试 | → R28 |
| R27-I07 | 粮草消耗设计文档 | → R28 |

---
*issues.md | Round 27 | 2026-05-05*
