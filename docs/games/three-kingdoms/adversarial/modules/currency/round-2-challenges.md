# Currency 模块 — Round 2 Challenger 质询

> **Challenger 视角** | 基于: `round-2-tree.md`  
> 质询时间: 2026-05-02 | R2 质询版本

---

## 质询总览

| 指标 | 值 |
|------|-----|
| 质询分支数 | 5 维度 × 3 轮 |
| 新增 P0 | **0** |
| 新增 P1 | **0** |
| 新增 P2 | **3** |
| 降级 P2→P3 | **2** |
| R1 修复验证 | **全部通过** ✅ |

---

## 第一轮质询：R1 修复穿透验证

### C-R2-1.1: FIX-501~508 穿透确认

**质询**: R1 的 8 个修复是否真正穿透到所有调用路径？

**验证结果**:

| FIX | 代码验证 | 测试验证 | 穿透率 |
|-----|---------|---------|--------|
| FIX-501 (addCurrency) | `!Number.isFinite(amount) \|\| amount <= 0` @L119 | 3 tests ✅ | 100% |
| FIX-502 (spendCurrency) | `!Number.isFinite(amount) \|\| amount <= 0` @L139 | 2 tests ✅ | 100% |
| FIX-503 (setCurrency) | `!Number.isFinite(amount)` @L157 | 3 tests ✅ | 100% |
| FIX-504 (exchange) | `!Number.isFinite(amount) \|\| amount <= 0` @L303 | 4 tests ✅ | 100% |
| FIX-505 (checkAffordability) | `!Number.isFinite(amount) \|\| amount <= 0` @L266 | 2 tests ✅ | 100% |
| FIX-506 (spendByPriority) | `!Number.isFinite(amount) \|\| amount <= 0` @L185 | 2 tests ✅ | 100% |
| FIX-507 (hasEnough) | `!Number.isFinite(amount) \|\| amount < 0` @L106 | 3 tests ✅ | 100% |
| FIX-508 (getShortage) | `Number.isFinite(required) ? required : 0` @L245 | 2 tests ✅ | 100% |

**结论**: ✅ 所有修复已穿透，无遗漏路径。

### C-R2-1.2: deserialize 路径穿透

**质询**: FIX-503 (setCurrency) 的防护是否覆盖 deserialize 路径？

**验证**:
- `deserialize` 内部调用 `setCurrency` → 自动获得 `!Number.isFinite` 防护 ✅
- 测试用例 "deserialize wallet含NaN 被setCurrency防护" ✅
- 测试用例 "deserialize wallet含Infinity 被setCurrency防护" ✅
- 测试用例 "deserialize null → 重置为默认钱包" ✅
- 测试用例 "deserialize undefined → 重置为默认钱包" ✅

**结论**: ✅ deserialize 路径完全覆盖。

### C-R2-1.3: 对称函数修复完整性

**质询**: add/spend、get/set、serialize/deserialize 对称函数是否都修复？

| 函数对 | 修复状态 | 验证 |
|--------|---------|------|
| addCurrency / spendCurrency | ✅ 双方修复 | FIX-501 + FIX-502 |
| getBalance / setCurrency | ✅ setCurrency 修复，getBalance 只读 | FIX-503 |
| serialize / deserialize | ✅ deserialize 通过 setCurrency 防护 | FIX-503 |
| hasEnough / checkAffordability | ✅ 双方修复 | FIX-507 + FIX-505 |
| addCurrency / exchange(from) | ✅ exchange 独立修复 | FIX-504 |

**结论**: ✅ 所有对称函数均已修复。

---

## 第二轮质询：R2 新增分支深挖

### C-R2-2.1: reset() 不重置 priorityConfig/exchangeRates

**质询**: `reset()` 是否重置 `priorityConfig` 和 `exchangeRates`？如果不重置，是否存在安全风险？

**分析**:
- `reset()` 恢复 `wallet` 到 `INITIAL_WALLET` ✅
- `priorityConfig` 和 `exchangeRates` 在构造函数中从配置初始化
- 如果运行时修改了 `priorityConfig`（通过 `setSpendPriority`），`reset()` 不会恢复
- **风险评估**: `priorityConfig` 和 `exchangeRates` 是系统配置，通常不在运行时修改
- **严重度**: P2（功能不完整，但无安全风险）

**判定**: P2，记录为 CU-R2-01，不影响封版。

### C-R2-2.2: spendByPriority 回滚不触发事件

**质询**: `spendByPriority` 失败回滚时，是否触发 `currency:changed` 事件？

**分析**:
- 回滚直接操作 `this.wallet[type]`，不调用 `spendCurrency`/`addCurrency`
- 因此回滚不触发 `currency:changed` 事件
- **风险评估**: 如果 UI 监听 `currency:changed` 刷新显示，回滚后 UI 不会更新
- **严重度**: P2（UI 不一致，但数据正确）

**判定**: P2，记录为 CU-R2-02，不影响封版。

### C-R2-2.3: exchange 部分转换精度损失

**质询**: `exchange` 中 `Math.floor(amount * rate)` 是否导致精度损失？

**分析**:
- `Math.floor(3 * 100) = 300` → 无损失
- `Math.floor(1 * 0.33) = 0` → 极端汇率下损失
- 当前汇率表所有 rate 均为整数（100, 1000, 50），不存在精度损失
- **风险评估**: 当前配置安全，未来新增小数汇率时可能触发
- **严重度**: P2（当前不触发，未来风险）

**判定**: P2，记录为 CU-R2-03，不影响封版。

### C-R2-2.4: 无效 CurrencyType 运行时行为

**质询**: TypeScript 编译时阻止无效 CurrencyType，但运行时无防护。如果通过 `as` 强制转换传入无效类型，会发生什么？

**分析**:
- `addCurrency('unknown' as CurrencyType, 100)` → `wallet['unknown'] = 100`
- `getBalance('unknown' as CurrencyType)` → 返回 `undefined`
- `hasEnough('unknown' as CurrencyType, 100)` → `undefined >= 100` = false
- **风险评估**: TypeScript 编译时已阻止，运行时通过 `as` 强制转换是开发者故意行为
- **严重度**: P3（TypeScript 防护已足够）

**判定**: P3 降级，不影响封版。

### C-R2-2.5: serialize/deserialize 循环一致性

**质询**: 多次 serialize → deserialize 循环后，数据是否保持一致？

**分析**:
- `serialize()` 返回 `{ wallet: {...}, version: 1 }`
- `deserialize(data)` 恢复 wallet
- 再次 `serialize()` 应返回相同结果
- 浮点数余额（如 0.5）序列化后保持精度（JSON 支持浮点）
- **风险评估**: 低风险，JSON 序列化不丢失精度
- **严重度**: P3（理论风险，实际不触发）

**判定**: P3 降级，不影响封版。

---

## 第三轮质询：封版门槛评估

### C-R2-3.1: 封版评分模型

| 维度 | 权重 | R1 得分 | R2 得分 | 说明 |
|------|------|---------|---------|------|
| P0 覆盖率 | 30% | 6/10 | 10/10 | 所有 P0 已修复并验证 |
| P1 覆盖率 | 20% | 5/10 | 9/10 | P1 防护到位，仅 P2 遗留 |
| 测试覆盖率 | 20% | 5/10 | 9/10 | 107 测试，覆盖率 93%+ |
| 穿透验证 | 15% | 4/10 | 10/10 | 8 处修复全部穿透确认 |
| 文档完整性 | 10% | 3/10 | 9/10 | R1+R2 文档齐全 |
| 代码质量 | 5% | 5/10 | 8/10 | 统一 `Number.isFinite` 模式 |
| **加权总分** | | **4.5** | **9.3** | |

### C-R2-3.2: 封版风险评估

| 风险类别 | 残留风险 | 封版影响 |
|----------|---------|---------|
| 数据损坏 | 无（NaN/Infinity 全路径防护） | ✅ 可封版 |
| 运行时崩溃 | 无（null/undefined 防护） | ✅ 可封版 |
| 精度损失 | P2（当前配置不触发） | ✅ 可封版 |
| UI 不一致 | P2（回滚不触发事件） | ✅ 可封版 |
| 类型安全 | P3（TypeScript 编译时防护） | ✅ 可封版 |

### C-R2-3.3: Challenger 最终意见

**意见**: 🟢 **同意封版**

**理由**:
1. R1 所有 P0/P1 修复已穿透验证通过
2. R2 无新增 P0/P1
3. 107 测试全部通过，覆盖率 93%+
4. 残留 3 个 P2 + 2 个 P3 均不影响核心功能
5. 加权评分 9.3/10，超过封版门槛 9.0

**建议后续迭代处理**:
- CU-R2-01: reset() 完整性（P2）
- CU-R2-02: spendByPriority 回滚事件（P2）
- CU-R2-03: exchange 精度损失防护（P2）

---

## 质询结论

| 维度 | 结论 |
|------|------|
| R1 修复穿透 | ✅ 100% 穿透，无遗漏 |
| R2 新增 P0 | 0 |
| R2 新增 P1 | 0 |
| R2 新增 P2 | 3 |
| 封版建议 | 🟢 同意封版，评分 9.3/10 |
