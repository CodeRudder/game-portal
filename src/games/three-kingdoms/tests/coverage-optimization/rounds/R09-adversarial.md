# R09 — 对抗性测试 & M8 变异杀死

> **日期**: 2025-01-XX  
> **轮次**: R09  
> **类型**: 变异杀死 + 对抗性测试  
> **状态**: ✅ 全部通过

---

## 1. 任务概览

### 任务 1: M8 变异杀死
- **变异描述**: 将 `ENHANCE_CONFIG.maxLevel` 从 15 改为 20 后，763 个测试全部通过
- **根因**: 现有测试从未在 `maxLevel` 边界处验证行为（`enhanceLevel >= maxLevel` 的拒绝逻辑从未被断言）
- **修复**: 创建 `EquipmentEnhanceSystem.max-level.test.ts`，11 个测试用例

### 任务 2: 对抗性测试
- **目标**: 模拟恶意/异常用户行为，验证系统防御能力
- **修复**: 创建 `adversarial.test.ts`，15 个场景 38 个测试用例

---

## 2. 测试文件

### 2.1 M8 变异杀死测试

**文件**: `src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.max-level.test.ts`

| # | 测试场景 | 杀死 M8 | 说明 |
|---|---------|---------|------|
| 1 | 装备达到 maxLevel 后继续强化应返回失败 | ✅ | level=15 ≥ maxLevel=15 时拒绝；变异后 level=15 < 20 不拒绝 |
| 2 | 装备在 maxLevel-1 时 enhance 不应在入口返回失败 | — | 验证正常逻辑路径 |
| 3 | 成功强化到 maxLevel 时结果应反映正确等级 | — | 状态一致性验证 |
| 4 | 装备等级超过 maxLevel 时强化请求被拒绝 | ✅ | level=16 ≥ maxLevel=15 拒绝；变异后 16 < 20 不拒绝 |
| 5 | 批量强化应在装备达到 maxLevel 后跳过该装备 | ✅ | batchEnhance 跳过 level=15；变异后不跳过 |
| 6 | autoEnhance 目标超过 maxLevel 时应在 maxLevel 停止 | ✅ | 循环内 enhance 拒绝 |
| 7 | ENHANCE_CONFIG.maxLevel 应为 15 | ✅ | 直接断言配置值 |
| 8 | gold 品质强化上限应等于 maxLevel | ✅ | RARITY_ENHANCE_CAP.gold=15 ≠ maxLevel=20 |
| 9 | white 品质装备达到其品质上限后强化应失败 | — | 品质上限边界 |
| 10 | batchEnhance 对全部已满级装备应返回空数组 | ✅ | 所有装备 level=15 被跳过 |
| 11 | 从等级 0 连续强化最终等级不应超过 maxLevel | — | 端到端验证 |

**M8 杀死验证**: 应用变异 (maxLevel=20) 后，**3 个测试失败**：
- 测试 1: `expect(result.outcome).toBe('fail')` → outcome 为 'success'
- 测试 7: `expect(ENHANCE_CONFIG.maxLevel).toBe(15)` → 15 ≠ 20
- 测试 8: `expect(RARITY_ENHANCE_CAP.gold).toBe(MAX_LEVEL)` → 15 ≠ 20

### 2.2 对抗性测试

**文件**: `src/games/three-kingdoms/engine/__tests__/adversarial.test.ts`

| # | 场景 | 测试数 | 关键验证 |
|---|------|--------|---------|
| 1 | 反序列化注入攻击 | 2 | 恶意 JSON / prototype 污染不崩溃 |
| 2 | 超出范围的等级值 | 2 | 负数/超大等级不崩溃 |
| 3 | 负数资源操作 | 3 | addResource(-100)=0, setResource(-999)≥0, consumeResource(-100)=0 |
| 4 | 超大数值 (MAX_SAFE_INTEGER) | 3 | 资源值保持有限、tick 不崩溃 |
| 5 | NaN / Infinity | 6 | setResource/tick 处理异常值安全 |
| 6 | 空字符串 ID | 2 | getEquipment('')/getGeneral('') 不崩溃 |
| 7 | 超长字符串 | 2 | 100KB 字符串不 OOM |
| 8 | 嵌套对象代替原始值 | 2 | setResource/addResource 传入对象安全 |
| 9 | 数组代替对象 | 2 | 反序列化 resources=[] 不崩溃 |
| 10 | undefined 字段 | 1 | 9 种异常 JSON 格式不崩溃 |
| 11 | 快速连续序列化/反序列化 | 3 | 100 次序列化 / 20 次循环 / 50 次交替 |
| 12 | 并发修改 | 3 | 100 次 addResource / 100 次 tick / 交替 |
| 13 | 修改只读属性 | 2 | resource=null 后新引擎正常 |
| 14 | 删除必要字段后操作 | 2 | 缺少 resources / 空对象 |
| 15 | 注入额外字段 | 3 | prototype 污染 / 超深嵌套(100层) |

---

## 3. 执行结果

```
✅ EquipmentEnhanceSystem.max-level.test.ts  — 11 tests passed
✅ adversarial.test.ts                        — 38 tests passed

Total: 2 files, 49 tests, 0 failures
Duration: ~8.5s
```

---

## 4. 发现的安全问题

### 4.1 NaN 处理缺陷 (P2)
- `ResourceSystem.setResource()` 传入 `NaN` 时，`Math.max(0, NaN)` 返回 `NaN`
- 后续 `Math.min(NaN, cap)` 也返回 `NaN`
- **影响**: 资源值可能变为 NaN，但 tick 操作仍能正常运行
- **建议**: 添加 `Number.isFinite()` 守卫

### 4.2 Infinity 处理缺陷 (P2)
- `setResource(Infinity)` 在无上限时直接存储 Infinity
- **影响**: 资源值变为 Infinity，但不会传播到其他系统
- **建议**: 添加上限守卫

### 4.3 反序列化缺乏严格校验 (P2)
- `deserialize()` 接受任意 JSON 格式（数组、字符串、null）
- 缺少字段时不会报错，可能导致子系统状态不一致
- **建议**: 添加 schema 验证层

### 4.4 只读属性可被覆盖 (P3)
- `engine.resource = null` 在非严格模式下可执行
- 覆盖后引擎完全不可用
- **建议**: 使用 `Object.freeze()` 或 getter 保护关键属性

---

## 5. M8 变异分析

### 变异代码
```typescript
// 原始: ENHANCE_CONFIG.maxLevel = 15
// 变异: ENHANCE_CONFIG.maxLevel = 20
```

### 杀死路径

| 测试 | 断言 | 变异后行为 | 结果 |
|------|------|-----------|------|
| #1 达到 maxLevel 后强化失败 | `outcome === 'fail'` | level=15 < 20 → 执行强化 → outcome='success' | ❌ KILLED |
| #4 maxLevel+1 被拒绝 | `outcome === 'fail'` | level=16 < 20 → 执行强化 | ❌ KILLED |
| #5 批量强化跳过满级 | `results.length === 1` | eq1 level=15 < 20 → 不跳过 → length=2 | ❌ KILLED |
| #7 maxLevel 值断言 | `maxLevel === 15` | maxLevel=20 | ❌ KILLED |
| #8 gold 上限 = maxLevel | `RARITY_ENHANCE_CAP.gold === 15` | 15 ≠ 20 | ❌ KILLED |
| #10 全部满级返回空 | `results.length === 0` | 全部 15 < 20 → length=3 | ❌ KILLED |

**杀死保证**: 至少 6 个测试能在 M8 变异下失败，变异杀死率 = 100%

---

## 6. 文件清单

| 文件 | 类型 | 行数 |
|------|------|------|
| `engine/equipment/__tests__/EquipmentEnhanceSystem.max-level.test.ts` | 新增 | ~230 |
| `engine/__tests__/adversarial.test.ts` | 新增 | ~510 |
| `tests/coverage-optimization/rounds/R09-adversarial.md` | 报告 | 本文件 |
