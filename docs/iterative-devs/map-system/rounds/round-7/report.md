# Round 7 迭代报告

> **日期**: 2026-05-04
> **迭代周期**: 第7轮 — SiegeBattleSystem生命周期修复 + 系统集成 + Canvas渲染 + 对抗性验证
> **内部循环次数**: 2

## 1. 对抗性评测发现

### Builder 行为清单
| ID | 功能 | 预期行为 | 假设 | 状态 |
|----|------|---------|------|:----:|
| R7-1 | ISubsystem.destroy() 可选方法 | `subsystem.ts:125` 添加 `destroy?(): void` | 子系统需要统一清理接口 | PASS |
| R7-2 | SiegeBattleAnimationSystem _initialized 幂等守卫 | 多次 `init()` 不重复注册事件监听器 | useEffect 可能在 StrictMode 下重复调用 | PASS |
| R7-3 | SiegeBattleAnimationSystem unsubscribers 数组 | init() 中收集 battle:started/battle:completed 取消订阅函数 | eventBus.on() 返回 unsubscribe 函数 | PASS |
| R7-4 | SiegeBattleAnimationSystem destroy() | 取消所有事件监听、清除动画数据、重置 _initialized | destroy 后可安全 reinit | PASS |
| R7-5 | SiegeBattleSystem destroy() | 清除 activeBattles Map | SiegeBattleSystem 仅 emit 不订阅 | PASS |
| R7-6 | BattleStartedEvent 扩展 | 新增 targetX/targetY/faction 字段 | 自动订阅处理器需真实坐标和阵营 | PASS |
| R7-7 | faction 类型收窄 | `'wei' \| 'shu' \| 'wu' \| 'neutral'` 联合类型 | TypeScript 编译通过 | PASS |
| R7-8 | auto-subscription | init() 自动订阅 battle:started/completed，事件驱动动画 | 与 SiegeBattleSystem 共享 eventBus | PASS |
| R7-9 | SiegeBattleSystem 在 useEffect 中创建并 init | WorldMapTab.tsx:406-408 | 与 MarchingSystem 共享同一 eventBus | PASS |
| R7-10 | siegeBattleSystem.update(dt) 在 rAF 循环中调用 | WorldMapTab.tsx:629 | 驱动城防衰减，完成时 emit battle:completed | PARTIAL |
| R7-11 | createBattle() 在攻城执行流程中调用 | WorldMapTab.tsx:462-472 | 行军到达后自动触发 | PASS |
| R7-12 | siegeBattleSystem.destroy() 在 cleanup 中调用 | WorldMapTab.tsx:657-658 | 组件卸载时释放资源 | PARTIAL |
| R7-13 | 共享 eventBus | WorldMapTab.tsx:401-408 | battle:started/completed 事件自动传递 | PASS |
| R7-14~R7-23 | PixelWorldMap Canvas 攻城动画渲染 | 集结/战斗/完成三阶段特效+策略差异化 | activeSiegeAnims prop 已透传 | PASS (数据源问题见P0-2) |

### Challenger 攻击结果
| ID | 攻击维度 | 攻击方式 | 结果 | Judge判定 |
|----|---------|---------|------|----------|
| P0-1 | 状态/内存泄漏 | siegeBattleAnimSystem.destroy() 在 WorldMapTab cleanup 中被遗漏 | 遗漏确认 | P0 UPHELD |
| P0-2 | 数据/功能断链 | updateBattleProgress() 从未被生产代码调用，defenseRatio 永远为 1.0 | 城防血条永远满血 | P0 UPHELD |
| P1-1 | 测试覆盖 | Phase 2 (R7-9~R7-13) 全部通过"代码审查"验证，零集成测试 | 5个集成点无自动化测试 | P1 UPHELD |
| P1-2 | 测试覆盖 | Phase 3 (R7-14~R7-23) 全部通过"代码审查"，零 Canvas 测试 | 10个渲染功能点无测试 | P1→P2 UPHELD |
| P1-3 | 测试覆盖 | 测试中 eventBus 被 mock，未验证真实事件传递链 | 跨系统事件桥接未验证 | P1 PARTIALLY UPHELD |
| P1-4 | 类型安全 | ownershipToFaction 返回 string 而非联合类型 | 实际服务于不同系统 | DISMISS |
| P2-1 | 设计冗余 | SiegeBattleSystem destroy() 与 reset() 实现完全相同 | 功能正确，语义冗余 | P2 UPHELD |
| P2-2 | 测试覆盖 | SiegeBattleSystem 缺少 faction 字段边界值测试 | TS 编译器已提供更强保证 | DISMISS |
| P2-3 | Canvas 安全 | renderSiegeAnimationOverlay globalAlpha 泄露风险 | ctx.save()/restore() 已保护 | DISMISS |

### Judge 综合评定
| ID | 严重度 | 可复现 | 根因 | 建议 |
|----|:------:|:------:|------|------|
| P0-1 | P0 | 是 | cleanup 中遗漏 siegeBattleAnimSystem.destroy()，模式性错误——SiegeBattleSystem 的 destroy 被正确调用但 AnimationSystem 被遗忘 | cleanup 中补充 siegeBattleAnimSystem.destroy() + siegeBattleAnimRef.current = null |
| P0-2 | P0 | 是 | rAF 循环中 SiegeBattleSystem.update(dt) 和 SiegeBattleAnimationSystem.update(dt) 之间缺少 defenseRatio 桥接调用；两端 API 已就绪但集成遗漏 | 在 rAF 循环中遍历 activeBattles 调用 updateBattleProgress() |
| P1-1 | P1 | N/A | Phase 2 五个集成点全靠"代码审查"验证，不可重复；且恰好是 P0-1/P0-2 未被发现的原因 | 至少补充一个端到端集成测试覆盖 createBattle→emit→动画→destroy 链路 |
| P1-2→P2 | P2 | N/A | Canvas 渲染层无测试，但纯视觉层无逻辑副作用；核心数据问题已被 P0-2 覆盖 | 后续通过 Canvas mock 或快照测试补充 |
| P1-3 | P1 | 部分 | 各子系统内部事件行为已验证，但跨系统事件桥接（SiegeBattleSystem→AnimationSystem）未验证 | 与 P1-1 合并在集成测试中覆盖 |
| P2-1 | P2 | 是 | destroy() 与 reset() 实现等价，SiegeBattleSystem 不订阅事件故 destroy 只需 clear() | 改为 destroy() { this.reset(); } 或添加注释说明 |

## 2. 修复内容
| ID | 对应问题 | 文件:行 | 修复方式 | 影响 |
|----|---------|---------|---------|------|
| F-01 | R6 DEFERRED C-01 | `subsystem.ts:125` | ISubsystem 接口添加 `destroy?(): void` 可选方法 | 统一子系统清理接口 |
| F-02 | R6 DEFERRED C-06 | `SiegeBattleAnimationSystem.ts:176,193-194` | 添加 `_initialized` 幂等守卫，多次 init() 不累积监听器 | 消除 StrictMode 下的监听器累积 |
| F-03 | R6 DEFERRED C-01 | `SiegeBattleAnimationSystem.ts:300-313` | 实现 destroy(): 取消事件监听 + 清除动画数据 + 重置 _initialized | 完整生命周期管理 |
| F-04 | R6 DEFERRED C-01 | `SiegeBattleSystem.ts:269-271` | 实现 destroy(): 清除 activeBattles | 资源释放 |
| F-05 | R6 DEFERRED C-02 | `SiegeBattleSystem.ts:101-111` | BattleStartedEvent 扩展 targetX/targetY/faction 字段 | 消除自动订阅处理器中的硬编码坐标和阵营 |
| F-06 | R7-FIX-1 | `SiegeBattleSystem.ts:110` | faction 类型收窄为 `'wei' \| 'shu' \| 'wu' \| 'neutral'` 联合类型 | TypeScript 类型安全 |
| F-07 | R6 DEFERRED C-02 | `SiegeBattleAnimationSystem.ts:202-217` | init() 自动订阅 battle:started/completed，使用事件数据中的真实坐标和阵营 | 事件驱动动画自动启动/完成 |
| F-08 | PLAN.md Task 3 | `WorldMapTab.tsx:401-408` | SiegeBattleSystem + SiegeBattleAnimationSystem 在 useEffect 中创建并 init，共享 eventBus | 攻城执行流从旧同步路径迁移到战斗系统 |
| F-09 | PLAN.md Task 3 | `WorldMapTab.tsx:462-472` | handleArrived 中调用 battleSystem.createBattle() 替代旧 siegeSystem.executeSiege() | SiegeBattleSystem 成为攻城执行唯一入口 |
| F-10 | PLAN.md Task 3 | `WorldMapTab.tsx:629` | siegeBattleSystem.update(dt) 添加到 rAF 动画循环 | 驱动城防衰减和战斗会话推进 |
| F-11 | PLAN.md Task 3 | `WorldMapTab.tsx:657-658` | cleanup 中调用 siegeBattleSystem.destroy() | 组件卸载时释放资源 |
| F-12 | PLAN.md Task 5 | `PixelWorldMap.tsx:291-597,1061-1096` | 实现攻城动画 Canvas 渲染（集结/战斗/完成三阶段，4种策略差异化特效） | I12 视觉渲染层交付 |
| F-13 | R6 DEFERRED C-05 | `SiegeBattleAnimationSystem.ts` | 序列化保真度修复，completed 动画 linger 时间正确保存/恢复 | 存档兼容性 |

## 3. 内部循环记录
| 子轮次 | 发现 | 修复 | 剩余P0 | 剩余P1 | 备注 |
|--------|:----:|:----:|:------:|:------:|------|
| 7.1 | 9 (Challenger) → 2 P0 + 3 P1 + 1 P2 + 3 DISMISS | 0 (待修复) | 2 | 3 | Judge 裁决 6 个有效问题 |
| 7.2 | 0 (P0 修复验证) | 2 (P0-1 + P0-2) | 0 | 3 | P0 全部修复，P1/P2 记录移交 R8 |
| **合计** | **9** | **2** | **0** | **3** | 2 子轮完成 |

### P0 修复详情

**P0-1 修复** — siegeBattleAnimSystem.destroy() 遗漏:
```typescript
// WorldMapTab.tsx cleanup — 补充:
siegeBattleAnimSystem.destroy();
siegeBattleAnimRef.current = null;
```

**P0-2 修复** — defenseRatio 桥接缺失:
```typescript
// WorldMapTab.tsx rAF 循环 — 在 siegeBattleSystem.update(dt) 之后补充:
const activeBattles = siegeBattleSystem.getState().activeBattles;
for (const battle of activeBattles) {
  if (battle.maxDefense > 0) {
    siegeBattleAnimSystem.updateBattleProgress(
      battle.taskId,
      battle.defenseValue / battle.maxDefense
    );
  }
}
```

## 4. 测试结果
| 测试套件 | 通过 | 失败 | 跳过 |
|----------|:----:|:----:|:----:|
| SiegeBattleSystem.test.ts | 28 | 0 | 0 |
| SiegeBattleAnimationSystem.test.ts | 47 | 0 | 0 |
| **R7新增总计** | **75** | **0** | **0** |
| Map engine全量套件 | 1930 | 2 | 0 |

> 注: 2个失败为 HeroStarSystem 预存问题，非本轮引入。全量套件 1930/1932 通过率 99.9%。

## 5. 架构审查结果
| 检查项 | 状态 | 问题描述 |
|--------|:----:|----------|
| 依赖方向 | PASS | SiegeBattleSystem/SiegeBattleAnimationSystem 单向依赖 eventBus，不互相直接引用 |
| 层级边界 | PASS | Engine 层系统在 engine/map/ 下，WorldMapTab 集成在 UI 层，PixelWorldMap 渲染在组件层 |
| 类型安全 | PASS | ISubsystem.destroy() 可选接口、BattleStartedEvent 完整类型、faction 联合类型收窄 |
| 数据流 | PASS | battle:started → AnimationSystem.startSiegeAnimation()；battle:completed → AnimationSystem.completeSiegeAnimation()；defenseRatio 通过 rAF 桥接同步 |
| 事件总线 | PASS | 两个子系统共享同一 eventBus 实例，cleanup 中 destroy 取消所有订阅 |
| 生命周期 | PASS | init() 幂等、destroy() 完整清理、reset() 允许 reinit |
| Canvas 渲染 | PASS | ctx.save()/restore() 保护 globalAlpha，攻城动画在城池标记之上渲染 |
| 代码重复 | WARN | SiegeBattleSystem.destroy() 与 reset() 实现等价（P2-1） |

## 6. 回顾(跨轮趋势)
| 指标 | R1 | R2 | R3 | R4 | R5 | R5c | R5d | R5e | R6 | R7 | 趋势 |
|------|:--:|:--:|:--:|:--:|:--:|:---:|:---:|:--:|:--:|:--:|:----:|
| 测试通过率 | 100% | 100% | 100% | 100% | ~100% | 99.9% | 100% | 100% | 100% | 99.9% | → |
| P0问题 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | ↑ SPIKE |
| P1问题 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 3 | ↑ SPIKE |
| 对抗性发现 | 1 | 0 | 0 | - | - | 10 | 7 | 6 | 7 | 9 | → |
| 内部循环次数 | 1 | 1 | 1 | 1 | - | 1 | 2 | 1 | 1 | 2 | ↑ |
| 架构问题 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1(WARN) | → |
| 新增测试用例 | 20 | 11 | 9 | - | - | 27 | 27 | 0 | 66 | 75 | UP |
| 预存失败 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 2 | 2 | → |
| DEFERRED技术债 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | ↓ CLEARED |

> 关键指标：R7 是项目以来首次出现 P0 问题的一轮（此前连续6轮 P0 为零）。Challenger 发现了两个致命的集成缺陷——destroy 遗漏和 defenseRatio 断链——均源于 Phase 2/3 仅依赖"代码审查"验证而缺少自动化测试。75 个新增测试用例全部通过（Phase 1 单元测试），但 Phase 2 集成和 Phase 3 Canvas 渲染零测试覆盖。R6 遗留的 2 个 DEFERRED 技术债已在 Phase 1 完全清偿。

## 7. 剩余问题(移交下轮)
| ID | 问题 | 优先级 | 来源 | 备注 |
|----|------|:------:|------|------|
| R8-1 | Phase 2 集成测试缺失 | P1 | P1-1/P1-3 | SiegeBattleSystem + AnimationSystem + 真实 EventBus 端到端测试 |
| R8-2 | Phase 3 Canvas 渲染测试缺失 | P2 | P1-2→P2 | renderAssemblyPhase/renderBattlePhase/renderCompletedPhase 测试 |
| R8-3 | SiegeBattleSystem destroy()/reset() 语义重复 | P2 | P2-1 | 改为 destroy() { this.reset(); } 或添加注释 |
| R8-4 | WorldMapTab createBattle() faction 硬编码 'wei' | P3 | P1-4 DISMISS | 多阵营支持时需动态获取 |
| R8-5 | PixelWorldMap 渲染参数可配置化 | P3 | P2-3 | ASSEMBLY_POINT_COUNT/BATTLE_PARTICLE_COUNT 等常量提取 |

## 8. 下轮计划
> 详见 `docs/iterations/map-system/round-8/plan.md`

> 重点方向：(1) 补充 SiegeBattleSystem + SiegeBattleAnimationSystem 端到端集成测试（P1-1/P1-3）；(2) SiegeBattleSystem destroy()/reset() 语义统一（P2-1）；(3) 推进 PLAN.md I14 攻占结果结算与事件生成；(4) 推进 PLAN.md I15 编队伤亡状态更新+自动回城。

## 9. 复盘（每3轮，当 N % 3 == 0 时不触发；R7 为补充分析）

### 9.1 R7 异常分析

R7 是迭代过程中首次出现 P0 问题的一轮。对比 R1-R6 连续 6 轮 P0 为零的记录，需要分析根因：

| 维度 | 分析 |
|------|------|
| **变更规模** | R7 是变更范围最广的一轮：3 个 Phase、23 个功能点、涉及 Engine 层 + UI 集成层 + Canvas 渲染层，跨越 3 个不同层级 |
| **验证方法** | Phase 2/3 共 15 个功能点使用"代码审查"验证，占 R7 功能点的 65%。这是首次在非 Phase 1 功能点上使用非自动化验证 |
| **集成复杂度** | SiegeBattleSystem + SiegeBattleAnimationSystem + WorldMapTab 三者集成涉及 3 个系统的生命周期协调，此前的 R6 只创建了独立子系统但未集成 |
| **P0 根因** | 两个 P0 都是"集成遗漏"（非逻辑错误）：destroy 遗漏是 cleanup 逻辑不完整（模式性错误），defenseRatio 断链是中间桥接调用缺失（API 已设计好但未调用） |

### 9.2 流程改进
| 项目 | 做得好 | 可改进 | 改进措施 |
|------|--------|--------|----------|
| 对抗性评测 | Challenger 精准发现两个致命集成缺陷，集成断裂攻击（3个断裂点）方法论有效 | P0 在 Builder 声称 PASS 后才被发现，Builder 自测不够 | Builder 应在集成代码完成后先自行运行"集成断裂"检查清单 |
| 修复效率 | 两个 P0 合计仅需约 10 行代码，修复速度快 | P1 问题（集成测试缺失）未在本轮补齐 | 集成测试应在修复 P0 后的同一子轮内补充 |
| Phase 1 质量 | 75 个单元测试、两个子系统独立验证充分，Phase 1 零缺陷 | Phase 1 测试覆盖未延伸到 Phase 2/3 | 每个 Phase 完成后立即补充该 Phase 的测试，不要累积到末尾 |
| Canvas 渲染 | 三阶段动画（集结/战斗/完成）视觉差异化实现完整 | Canvas 渲染零测试，纯靠人工视觉验证 | 后续轮次引入 Canvas mock 测试框架 |

### 9.3 工具/方法改进
| 改进项 | 当前方式 | 建议方式 | 预期效果 |
|--------|---------|---------|---------|
| 集成验证标准 | "代码审查" PASS | 集成点必须有至少一个自动化测试（即使是最小粒度的调用验证） | 防止集成遗漏类缺陷 |
| 多 Phase 管控 | 三个 Phase 完成后统一对抗性评测 | 每个 Phase 完成后进行 mini 对抗性评测 | 更早发现问题，减少子轮修复成本 |
| cleanup 完整性 | 手动检查每个系统是否在 cleanup 中销毁 | 建立"创建-销毁配对检查表"：每个 new/init 必须对应一个 destroy/null | 防止模式性遗漏 |
| 数据流完整性 | 依赖代码审查发现断链 | 建立"数据生产者-消费者配对表"：每个 setter 必须有对应的调用点 | 防止桥接遗漏 |

### 9.4 改进措施（列入下轮计划）
| ID | 改进措施 | 负责 | 验收标准 |
|----|---------|------|---------|
| IMP-01 | 建立"创建-销毁配对检查表"强制检查 | Builder | 每个系统/资源创建时同步写 cleanup，Challenger 验证配对完整性 |
| IMP-02 | 集成点必须至少一个自动化测试 | Builder | R8 Phase 2/3 的集成测试 >= 1 个端到端场景 |
| IMP-03 | 多 Phase 迭代中间增加 mini 对抗性评测 | Challenger | Phase 间有独立的验证记录 |
| IMP-04 | SiegeBattleSystem destroy/reset 语义统一 | Builder | destroy() 内部调用 reset() 并添加注释 |

---

*Round 7 迭代报告 | 2026-05-04*
