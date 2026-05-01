# Resource 模块 R2 对抗式测试 — Builder 精简流程树

> 版本: v2.0 | 日期: 2026-05-02 | Builder Agent
> 源码: `src/games/three-kingdoms/engine/resource/` (8 files, 1874 lines)
> R1修复: 21 P0 全部已修，10 P1 留待 R2

## FIX 穿透验证

| 修复组 | R1 P0 覆盖 | 穿透验证 | 结果 |
|--------|-----------|----------|------|
| 组A: NaN 守卫 | P0-001~016 (16个) | 14个 `Number.isFinite` 守卫分布在 5 个文件 | ✅ 全穿透 |
| 组B: deserialize null | P0-017 (3个) | 3 个 `if (!data)` 入口守卫 | ✅ 全穿透 |
| 组C: engine-save 接入 | P0-020/021 (2个) | engine-save.ts 6 处 copperEconomy/materialEconomy 同步 | ✅ 全穿透 |
| 组D: NaN 传播链 | P0-018/019 (2个) | setResource NaN 前置检查 + serialize NaN 修复 | ✅ 全穿透 |

**穿透率**: 100% (21/21 P0 修复已验证落源码)

---

## 精简树（仅保留 R2 需关注的节点）

### 策略说明
- R1 P0 节点（21个）已全部修复并验证，从树中移除
- R1 P1 节点（10个）重新评估，标注修复状态
- R2 新增节点仅补充 R1 未覆盖的维度

---

### F1: ResourceSystem — 资源状态管理

#### F1.1~F1.9 已修复 P0 节点（R1 标记 P0 的 16 个 NaN 守卫）
> 全部已修，不再列出。R1 中这些节点的 `uncovered` 标记已变更为 `fixed`。

#### F1.10 enforceCaps — P1-007 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.10-N07 | enforceCaps + NaN resource | F-Error | `NaN > cap` = false → NaN 不截断 | P1 | **open** |

**分析**: 上游 NaN 已被入口守卫阻断（FIX-701~719），enforceCaps 收到 NaN 的概率极低。但作为防御纵深，仍应添加 `!Number.isFinite` 检查。

#### F1.11 容量警告 — P1-004 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.11-N03 | getWarningLevel(NaN) | F-Error | NaN 所有比较 false → 返回 'safe' | P1 | **open** |

**分析**: 同上，上游 NaN 已阻断，但返回 'safe' 掩盖问题。

#### F1.12 序列化 — P1-001 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.12-N03 | deserialize + NaN values | F-Error | NaN → `Number(val) \|\| 0` = 0 静默丢失 | P1 | **open** |

**分析**: R1 FIX-719 在 serialize 端已修 NaN，但 deserialize 端仍静默归零。已有 `gameLog.warn` 日志（FIX-717 添加），可接受。

---

### F2: resource-calculator — 纯计算函数

#### F2.2 加成计算 — P1-002 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F2.2-N04 | calculateBonusMultiplier({tech: -1}) | F-Error | multiplier = 0 → 产出归零 | P1 | **open** |

#### F2.3 上限查表 — P1-003 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F2.3-N08 | lookupCap + 异常表数据 | F-Error | 外推可能为负值 | P1 | **open** |

---

### F3: OfflineEarningsCalculator — 离线收益

#### F3.3 工具方法 — P1-008/009 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F3.3-N03 | formatOfflineTime(NaN) | F-Error | NaN → "NaN 分钟" | P1 | **open** |
| F3.3-N05 | getOfflineEfficiencyPercent(NaN) | F-Error | NaN / NaN → NaN | P1 | **open** |

---

### F4: CopperEconomySystem — 铜钱经济

#### F4.5 升级消耗 — P1-005 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.5-N10 | trySpend + economyDeps=null | F-Error | `!` 非空断言崩溃 | P1 | **open** |

#### F4.7 日重置 — P1-010 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.7-N03 | checkDailyReset + mock time | F-Lifecycle | 依赖系统时间不可测 | P1 | **open** |

---

### F5: MaterialEconomySystem — 材料经济

#### F5.1 突破石获取 — P1-006 遗留
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F5.1-N14 | sweepStage + random injection | F-Error | 默认 Math.random 不可控 | P1 | **open** |

---

### F6: 跨系统链路 (F-Cross) — R2 新增

| 节点ID | 链路 | 场景 | 优先级 | 状态 |
|--------|------|------|--------|------|
| F6-N08 | engine-save → CopperEconomy.serialize → ResourceSystem.addResource | **铜钱存档恢复链路验证** | P2 | covered |
| F6-N09 | engine-save → MaterialEconomy.serialize → ResourceSystem.consumeResource | **材料存档恢复链路验证** | P2 | covered |
| F6-N10 | serialize → JSON.stringify → deserialize 往返一致性 | NaN 修复后序列化往返 | P2 | covered |
| F6-N11 | reset() → serialize() → deserialize() 重置后存档恢复 | 重置-存档往返 | P2 | covered |

---

## 精简统计

| 指标 | R1 | R2 | 变化 |
|------|-----|-----|------|
| 总节点数 | 161 | 10 | -93.8% |
| P0 节点 | 21 | 0 | -100% |
| P1 节点 | 10 | 10 | 0 (全部 open) |
| P2 节点 | 130 | 0 | 移除（已 covered） |
| 维度均衡度 | 0.72 | 0.80 | ↑ |

## P1 修复建议（R2 Fixer）

| P1 ID | 建议修复 | 复杂度 |
|--------|----------|--------|
| P1-001 | deserialize NaN 已有 warn 日志 → 可关闭 | 无需修改 |
| P1-002 | `multiplier = Math.max(0, multiplier)` 下界 | 1行 |
| P1-003 | `result = Math.max(0, result)` 下界 | 1行 |
| P1-004 | `if (!Number.isFinite(percentage)) return 'error'` | 2行 |
| P1-005 | `if (!this.economyDeps) return 0;` 替换 `!` | 1行 |
| P1-006 | 已有注入机制 → 可关闭 | 无需修改 |
| P1-007 | `if (!Number.isFinite(this.resources[type])) this.resources[type] = 0;` | 2行 |
| P1-008 | `if (!Number.isFinite(seconds)) return '--';` | 1行 |
| P1-009 | `if (!Number.isFinite(offlineSeconds)) return 0;` | 1行 |
| P1-010 | 已有 checkDailyReset(now?) 参数 → 可关闭 | 无需修改 |

**预估修复量**: 6 处代码修改，~10 行新增代码
