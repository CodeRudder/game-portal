# Round 17: 苏格拉底式深度评测

> **评测方法**: 不满足于"测试通过了"，而是追问：这些测试真的在验证正确的事情吗？

**评测范围**: 651个测试文件, 268,083行测试代码, 18,678个测试用例, 4,794个describe块

---

## 一、抽样审查结果（10个文件）

| # | 文件 | 有效性 | 独立性 | 完整性 | 可维护性 | 关键问题 |
|---|------|--------|--------|--------|----------|----------|
| 1 | `settings/audio-config.test.ts` | 8 | 9 | 7 | 9 | ✅ 枚举值精确断言、边界检查合理。⚠️ 仅验证默认配置，缺少动态修改场景 |
| 2 | `integration/v2-e2e-flow.integration.test.ts` | 9 | 8 | 8 | 7 | ✅ 完整招募→升级→编队循环，战力公式手动验证。⚠️ `try { recruitHero } catch { break }` 吞掉错误，可能掩盖真实bug |
| 3 | `event/EventNotificationSystem-p1.test.ts` | 7 | 5 | 7 | 5 | ⚠️ **mockDeps() 创建全mock依赖**，eventBus.emit 被mock后无法验证事件是否真正传播。`as unknown as ISystemDeps` 绕过类型检查 |
| 4 | `unification/rebirth-emperor-economy.integration.test.ts` | 6 | 4 | 6 | 4 | ⚠️ **过度mock**：CurrencySystem/PrestigeSystem/RebirthSystem/HeritageSystem 全部用mockDeps初始化，跨系统联动被mock切断。`simulateEarnings` 只验证返回值非null，不验证数值正确性 |
| 5 | `event/event-trigger.integration.test.ts` | 8 | 5 | 8 | 5 | ✅ 概率公式精确验证 `toBeCloseTo`。⚠️ 同样的mockDeps模式重复出现，如果ISystemDeps接口变化，所有mock都要改 |
| 6 | `hero/FormationRecommendSystem.test.ts` | 9 | 7 | 9 | 8 | ✅ **最佳实践样本**：纯函数测试、精确战力验证、边界条件（空池/单武将/7武将）。⚠️ mockDeps较轻但 `as unknown` 仍在 |
| 7 | `integration/v9-e2e-flow.integration.test.ts` | **10** | **10** | **9** | **9** | ✅ **标杆文件**：使用真实引擎API（createSim），零mock，精确数值验证（316800, 158400），全链路数据一致性。声明"不使用as any"且实际遵守 |
| 8 | `quest/QuestSystem.helpers.test.ts` | 9 | 9 | 8 | 9 | ✅ **另一个标杆**：纯函数测试，零mock，边界条件完整（超过上限/不存在的ID/已领取），状态变更验证精确 |
| 9 | `guide/StoryEventPlayer.test.ts` | 8 | 5 | 8 | 6 | ✅ 8段剧情全覆盖，交互规则验证细致。⚠️ mockDeps中eventBus有真实的事件存储Map但once/off/removeAllListeners仍是stub，部分事件场景可能失真 |
| 10 | `integration/v19-unification-upper-flow.integration.test.ts` | **4** | **8** | **5** | **7** | ❌ **最严重问题**：大量条件断言 `if (stageIds.length > 0)` 包裹expect，当数据为空时断言被跳过，**测试永远通过但什么都没验证** |

### 抽样评分汇总

| 维度 | 平均分 | 评价 |
|------|--------|------|
| 有效性 | 7.8/10 | 多数测试验证了真实业务逻辑，但v19存在"空测试"问题 |
| 独立性 | 7.0/10 | 集成测试质量分化严重：v9/helpers接近满分，mockDeps模式拉低平均 |
| 完整性 | 7.5/10 | 正常/边界覆盖较好，异常路径和并发场景覆盖不足 |
| 可维护性 | 6.9/10 | mockDeps重复模式是最大隐患 |

---

## 二、Mock依赖审计

### 数据总览

| 指标 | 数量 | 评估 |
|------|------|------|
| mock使用总数（vi.mock/mockImplementation/mockReturnValue） | 538处 | **适中偏多** |
| `as any` 使用 | 449处 | **偏多** |
| `as unknown as` 类型绕过 | ~30+处 | **需要关注** |

### Mock模式分析

**模式1: mockDeps() 工厂函数（最常见，~60%的mock集中于此）**
```typescript
function mockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), ... },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), ... },
  } as unknown as ISystemDeps;
}
```
- **问题**: 每个测试文件独立定义mockDeps，无共享，接口变化时需逐一修改
- **风险**: eventBus.emit被mock后，事件驱动的副作用完全不可测

**模式2: 真实引擎测试（最佳实践，~30%）**
```typescript
const sim = createSim(); // 使用真实引擎
sim.addResources({ gold: 500000 });
sim.recruitHero('normal', 1);
```
- **优势**: 零mock，验证真实行为
- **代表**: v9-e2e-flow, QuestSystem.helpers

**模式3: 部分mock（~10%）**
- 如StoryEventPlayer中eventBus有真实Map存储，但once/off仍是stub

### Mock风险评估

| 风险等级 | 描述 | 影响范围 |
|----------|------|----------|
| 🔴 高 | mockDeps中emit是空函数，事件驱动的bug完全不可测 | 所有使用mockDeps的单元测试 |
| 🟡 中 | `as unknown as ISystemDeps` 绕过类型检查，接口变更不会编译报错 | ~30个文件 |
| 🟢 低 | 集成测试中createSim使用真实引擎 | v2/v9等集成测试 |

---

## 三、断言质量

### 数据总览

| 类别 | 断言类型 | 数量 | 占比 |
|------|----------|------|------|
| **弱断言** | `toBeDefined` | 2,662 | - |
| | `toBeTruthy` | 291 | - |
| | `toBeUndefined` | 270 | - |
| | `toBeNull` | 1,416 | - |
| | **弱断言小计** | **4,639** | **12.0%** |
| **强断言** | `toBe(具体值)` | 21,976 | - |
| | `toBeGreaterThan/LessThan` | 3,876 | - |
| | `toContain` | 1,618 | - |
| | `toEqual` | 651 | - |
| | `toBeCloseTo` | 633 | - |
| | `toThrow` | 597 | - |
| | `toStrictEqual` | 0 | - |
| | **强断言小计** | **29,351** | **75.9%** |
| **其他** | `not.toThrow` | 280 | 0.7% |
| | `toBe(true/false)` | 6,304 | 16.3% |

### 强/弱比: 6.3:1

### 断言质量评估

**✅ 优秀方面:**
- 强/弱比 6.3:1 远超行业平均（通常2:1~3:1），说明测试质量意识较高
- `toBeCloseTo` 633处用于浮点比较，概率公式验证精确
- `toThrow` 597处验证异常路径
- `toContain` 1,618处验证集合成员关系
- 引用常量的断言141处，避免魔法数字

**⚠️ 需要关注:**
- `toBeDefined` 2,662处 — 大量仅检查"存在"而不验证值，可能掩盖返回错误值的情况
- `toStrictEqual` 0处 — 没有任何深度严格比较，对象结构变更可能不被发现
- `toBe(true/false)` 6,304处 — 简单布尔断言占比16.3%，部分可能是合理的（如success标志），但需审查是否遗漏了错误详情验证
- `not.toThrow` 280处 — 仅验证"不报错"，不验证行为正确性

---

## 四、发现的核心问题

### 🔴 问题1: 条件断言 — 测试永远通过但什么都没验证

**严重程度**: ⭐⭐⭐⭐⭐ (最高)

**影响文件**: `v19-unification-upper-flow.integration.test.ts` 及类似模式

**典型代码**:
```typescript
it('should complete a stage and update progress', () => {
  const stageIds = Object.keys(progress.stageStates);
  if (stageIds.length > 0) {  // ← 如果为空，整个测试被跳过！
    campaign.completeStage(stageIds[0], 3);
    expect(starsAfter).toBeGreaterThanOrEqual(starsBefore);
  }
});
```

**问题本质**: 当数据为空时，expect被跳过，测试永远显示绿色但实际上什么都没验证。这是一种**虚假安全感**。

**修复方案**:
```typescript
it('should complete a stage and update progress', () => {
  const stageIds = Object.keys(progress.stageStates);
  expect(stageIds.length).toBeGreaterThan(0); // ← 确保数据存在
  campaign.completeStage(stageIds[0], 3);
  expect(campaign.getStageStars(stageIds[0])).toBe(3);
});
```

### 🔴 问题2: try/catch吞掉错误 — 掩盖真实bug

**严重程度**: ⭐⭐⭐⭐

**影响文件**: `v2-e2e-flow.integration.test.ts` 等多处

**典型代码**:
```typescript
for (let i = 0; i < 6; i++) {
  try { sim.recruitHero('normal', 1); } catch { break; }  // ← 吞掉所有错误
}
const generalCount = sim.getGeneralCount();
expect(generalCount).toBeGreaterThanOrEqual(1);
```

**问题本质**: 如果recruitHero因为bug抛出异常（而非资源不足），测试不会发现。只验证了"至少有1个武将"，不验证"招募过程是否正确"。

**修复方案**: 使用明确的资源准备确保招募成功，或至少区分"预期失败"和"意外错误"。

### 🟡 问题3: mockDeps重复模式 — 可维护性定时炸弹

**严重程度**: ⭐⭐⭐

**影响范围**: ~60%的单元测试文件

**问题本质**:
1. 每个文件独立定义 `mockDeps()`，无共享
2. `as unknown as ISystemDeps` 绕过类型检查
3. ISystemDeps接口变化时，所有mockDeps需逐一修改
4. eventBus.emit被mock为空函数，事件驱动逻辑完全不可测

**修复方案**: 创建共享的 `createMockDeps()` 工厂函数，集中管理mock行为。

### 🟡 问题4: toStrictEqual零使用 — 深度结构验证缺失

**严重程度**: ⭐⭐⭐

**问题**: 0处使用 `toStrictEqual`，651处 `toEqual`。`toEqual` 忽略 `undefined` 属性和原型链差异，可能导致序列化/反序列化测试通过但实际数据结构有微妙差异。

### 🟢 问题5: it.todo积压

**严重程度**: ⭐⭐

**数据**: 93处 `it.todo`/`xit`/`it.skip`，表示有未完成的测试承诺。

---

## 五、改进建议

### 建议1: 消除条件断言（优先级: 🔴 最高）

**行动项**:
1. 全局搜索 `if.*expect\|if.*length > 0` 模式
2. 将条件断言改为前置断言：`expect(data.length).toBeGreaterThan(0)`
3. 对v19测试文件逐个修复

**预期效果**: 消除虚假绿色，确保每个it块至少执行一个expect

### 建议2: 创建共享mockDeps工厂（优先级: 🟡 高）

**行动项**:
```typescript
// test-utils/mock-deps.ts
export function createMockDeps(overrides?: Partial<ISystemDeps>): ISystemDeps {
  // 集中定义，支持override
}
```
1. 创建共享文件
2. 逐步替换各文件中的独立mockDeps定义
3. 消除 `as unknown as ISystemDeps`

**预期效果**: ISystemDeps变更时只需改一处

### 建议3: 区分"预期失败"和"意外错误"（优先级: 🟡 中）

**行动项**:
1. 将 `try { action } catch { break }` 替换为明确的条件检查
2. 使用 `expect(() => action).toThrow(/资源不足/)` 验证预期错误
3. 不预期的错误应让测试失败

### 建议4: 关键序列化测试使用toStrictEqual（优先级: 🟢 低）

**行动项**:
1. 在所有序列化/反序列化测试中使用 `toStrictEqual`
2. 在状态快照测试中使用 `toStrictEqual`

### 建议5: 建立测试质量门禁（优先级: 🟢 低）

**行动项**:
1. CI中检查条件断言比例
2. 新增测试文件禁止使用 `as any`
3. 定期审查 `toBeDefined` 使用是否可升级为更强断言

---

## 六、测试质量分层评估

```
┌─────────────────────────────────────────────────────────────────┐
│                    测试质量金字塔                                │
│                                                                 │
│                    ┌─────────────┐                              │
│                    │  E2E集成    │  v9-e2e-flow: ★★★★★         │
│                    │  (真实引擎) │  v2-e2e-flow: ★★★★☆         │
│                    ├─────────────┤                              │
│                    │  单元测试   │  QuestSystem.helpers: ★★★★★ │
│                    │  (纯函数)   │  FormationRecommend: ★★★★☆  │
│                    ├─────────────┤                              │
│                    │  单元测试   │  EventNotification: ★★★☆☆  │
│                    │  (mock依赖) │  rebirth-emperor: ★★★☆☆    │
│                    ├─────────────┤                              │
│                    │  条件断言   │  v19-unification: ★★☆☆☆    │
│                    │  (空测试)   │  ⚠️ 虚假绿色               │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、总体评分: 7.2/10

### 评分理由

| 维度 | 得分 | 理由 |
|------|------|------|
| **覆盖率广度** | 9/10 | 651文件、18,678用例，模块覆盖全面 |
| **断言质量** | 8/10 | 强/弱比6.3:1优秀，但toBeDefined过多 |
| **测试有效性** | 7/10 | 多数测试验证真实逻辑，但v19条件断言拉低 |
| **Mock合理性** | 6/10 | 集成测试零mock优秀，但单元测试mockDeps模式重复且过度 |
| **可维护性** | 6/10 | mockDeps重复定义是最大隐患 |
| **边界覆盖** | 7/10 | 正常/边界较好，异常/并发/竞态覆盖不足 |

### 一句话总结

> **这是一个"量"已经非常充分、"质"正在追赶的测试体系。** 顶尖的测试文件（v9-e2e-flow, QuestSystem.helpers）展示了团队完全有能力写出高质量测试，但条件断言和mockDeps重复模式两个系统性问题正在侵蚀整体质量。修复这两个问题可将评分提升至8.5+。

---

*评测完成时间: Round 17*
*评测方法: 苏格拉底式批判性审查*
*抽样方法: 随机10文件 + 全量静态分析*
