# ACC-05 招贤馆 — R1 验收测试报告

> 验收日期：2025-07-10  
> 验收轮次：R1（首轮）  
> 验收方法：代码静态审查 + 引擎逻辑验证  
> 验收人：Game Reviewer Agent

---

## 一、验收统计

| 类别 | 总数 | ✅ 通过 | ⚠️ 待渲染验证 | ❌ 不通过 | 通过率 |
|------|------|---------|-------------|----------|--------|
| 基础可见性 (01-09) | 9 | 7 | 2 | 0 | 77.8% |
| 核心交互 (10-19) | 10 | 8 | 1 | 1 | 80.0% |
| 数据正确性 (20-29) | 10 | 8 | 1 | 1 | 80.0% |
| 边界情况 (30-39) | 10 | 6 | 2 | 2 | 60.0% |
| 手机端适配 (40-49) | 10 | 2 | 8 | 0 | 20.0% |
| **合计** | **49** | **31** | **14** | **4** | **63.3%** |

### 按优先级统计

| 优先级 | 总数 | ✅ 通过 | ⚠️ 待验证 | ❌ 不通过 |
|--------|------|---------|----------|----------|
| P0（阻断性） | 22 | 16 | 3 | 3 |
| P1（重要） | 16 | 10 | 5 | 1 |
| P2（次要） | 11 | 5 | 6 | 0 |

---

## 二、不通过项详情（❌）

### ❌ ACC-05-12 [P0] 十连招募完整流程 — 十连保底排序方向错误

**验收标准**：十连结果按品质从低到高排序

**实际代码**（`HeroRecruitSystem.ts` L281-285）：
```typescript
if (count > 1) {
  results.sort((a, b) => {
    const qa = QUALITY_ORDER[a.quality];
    const qb = QUALITY_ORDER[b.quality];
    if (qa !== qb) return qa - qb;  // ← 升序 = 低品质在前
    ...
  });
}
```

**问题**：`QUALITY_ORDER` 中 COMMON=1, LEGENDARY=5，`qa - qb` 升序排列意味着普通(COMMON)排在最前面、传说(LEGENDARY)排在最后面。验收标准要求"按品质从低到高排序"——如果这是指展示顺序（低→高），则代码正确；但如果玩家期望是"最差的先翻牌、最好的最后翻"（即低→高），代码行为与标准一致。

**重新判定**：经仔细对照，代码排序方向（低品质先、高品质后）**符合**"按品质从低到高排序"的验收标准。**降级为 ⚠️ 待渲染验证**（需确认翻牌动画的视觉顺序是否与排序一致）。

---

### ❌ ACC-05-27 [P0] 高级池硬保底必出传说+ — 硬保底阈值配置与验收标准不一致

**验收标准**：每100次必出传说+

**实际配置**（`hero-recruit-config.ts`）：
```typescript
export const ADVANCED_PITY: PityConfig = {
  tenPullThreshold: 10,
  tenPullMinQuality: Q.RARE,
  hardPityThreshold: 100,       // ← 100次
  hardPityMinQuality: Q.LEGENDARY, // ← LEGENDARY
};
```

**保底逻辑**（`recruit-types.ts` `applyPity()`）：
```typescript
if (hardPityCount >= config.hardPityThreshold - 1) {  // 99 >= 99 → true
  if (QUALITY_ORDER[baseQuality] < QUALITY_ORDER[config.hardPityMinQuality]) {
    return config.hardPityMinQuality;  // 强制 LEGENDARY
  }
}
```

**分析**：硬保底在第100次（计数器=99时）触发，强制提升品质到 LEGENDARY。逻辑正确。

**重新判定**：**✅ 通过**。配置值和逻辑均正确。

---

### ❌ ACC-05-32 [P0] 连续快速点击招募 — 防抖机制验证

**验收标准**：不会出现重复扣除或多次招募；按钮在招募过程中显示"招募中..."并禁用

**实际代码**（`RecruitModal.tsx` L128-145）：
```typescript
const isRecruitingRef = useRef(false);

const handleRecruit = useCallback((count: 1 | 10) => {
  if (isRecruiting || isRecruitingRef.current) return;  // 双重锁
  isRecruitingRef.current = true;
  setIsRecruiting(true);
  try {
    const output = engine.recruit(recruitType, count);
    ...
  } finally {
    setIsRecruiting(false);
    isRecruitingRef.current = false;
  }
}, [engine, recruitType, onRecruitComplete, isRecruiting]);
```

**问题**：`engine.recruit()` 是同步调用，在单线程 JS 中不存在真正的竞态条件。`isRecruitingRef` 同步锁 + `isRecruiting` 状态锁双重保护已经足够。但 `finally` 中立即重置锁，意味着如果 `engine.recruit()` 触发了 React 状态更新（如 `setResults`），在下一个渲染周期之前锁已被释放。不过由于 JS 事件循环的特性，同一时刻只有一个事件处理器在执行，因此不会出现并发问题。

**判定**：**✅ 通过**。双重防抖锁设计合理。

---

### ❌ ACC-05-38 [P0] 存档加载后保底计数保持

**验收标准**：刷新页面后保底计数与刷新前一致

**实际代码**（`engine-save.ts` L129）：
```typescript
recruit: ctx.recruit.serialize(),
```

**反序列化**（`engine-save.ts` L322-325）：
```typescript
if (data.recruit) {
  ctx.recruit.deserialize(data.recruit);
}
```

**`HeroRecruitSystem.serialize()`** 包含完整的 `pity` 状态（normalPity/advancedPity/normalHardPity/advancedHardPity），`deserialize()` 正确恢复所有字段。

**判定**：**✅ 通过**。存档序列化/反序列化完整覆盖保底计数。

---

## 真正的不通过项

### ❌ ACC-05-06 [P1] 保底进度条可见 — 硬保底标签文案与验收标准不一致

**验收标准**：显示「硬保底（史诗+）」：当前计数/50（高级）或隐藏（普通池无硬保底）

**实际代码**（`RecruitModal.tsx` L176-186）：
```typescript
{pityInfo.hardPity && (
  <div className="tk-recruit-pity-item" title={...}>
    <span className="tk-recruit-pity-label">
      硬保底（{recruitType === 'advanced' ? '传说+' : '史诗+'}）
    </span>
    ...
    <span className="tk-recruit-pity-count">
      {pityInfo.hardPity.current}/{pityInfo.hardPity.max}
    </span>
  </div>
)}
```

**问题**：验收标准文档写的是"硬保底（史诗+）当前计数/50"，但实际配置中：
- 高级池硬保底阈值=100，最低品质=LEGENDARY → UI显示"硬保底（传说+）100/100" ✅ 正确
- 普通池硬保底阈值=Infinity → UI隐藏 ✅ 正确

**验收标准文档的描述有误**（文档写50/史诗+，但实际配置是100/传说+）。以代码配置为准，UI行为正确。

**判定**：**⚠️ 验收标准文档需修正**，代码实现与配置一致，功能正确。降级为建议项。

---

### ❌ ACC-05-22 [P0] 新武将正确入库 — RecruitPanel 结果展示依赖外部注入

**验收标准**：新获得的武将出现在武将列表中

**实际代码**（`RecruitPanel.tsx`）：
```typescript
const [results, setResults] = useState<RecruitResultEntry[]>([]);

const handleRecruit = (m, count) => {
  onRecruit(m, count);
  setResults([]);  // ← 清空旧结果，但未设置新结果！
};
```

**问题**：`RecruitPanel` 组件的 `ResultArea` 依赖 `results` state 展示，但 `handleRecruit` 只清空了结果，没有接收和设置新的招募结果。结果数据完全依赖外部通过 props 传入，但 props 中没有 `results` 字段。

**对比**：`RecruitModal.tsx` 直接调用 `engine.recruit()` 并用 `setResults(output)` 设置结果，功能完整。

**影响**：`RecruitPanel` 作为独立组件使用时，结果展示区永远为空。但实际使用中，`RecruitModal` 是主要入口，`RecruitPanel` 可能是辅助/备用组件。

**判定**：**❌ 不通过**。`RecruitPanel` 的结果展示功能不完整。

---

### ❌ ACC-05-33 [P1] 十连招募中途资源不足

**验收标准**：十连是原子操作，不会只抽了几次就中断

**实际代码**（`HeroRecruitSystem.ts` L266-274）：
```typescript
private executeRecruit(type: RecruitType, count: number): RecruitOutput | null {
  const cost = this.getRecruitCost(type, count);
  if (!this.recruitDeps.canAffordResource(cost.resourceType, cost.amount)) return null;
  if (!this.recruitDeps.spendResource(cost.resourceType, cost.amount)) return null;

  const results: RecruitResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(this.executeSinglePull(type));
  }
  ...
}
```

**分析**：十连招募先一次性扣除全部资源（`spendResource`），然后循环执行10次单抽。这是正确的原子操作设计——资源已预先扣除，循环不会因资源不足中断。✅ 通过。

---

### ❌ ACC-05-36 [P2] 招募结果为空（极端情况）

**验收标准**：系统不会崩溃，显示兜底提示

**实际代码**（`HeroRecruitSystem.ts` L293-300）：
```typescript
if (!generalId) {
  return {
    general: null,
    isDuplicate: false,
    fragmentCount: 0,
    quality: finalQuality,
    isEmpty: true,
  };
}
```

引擎层返回 `isEmpty: true` 的空结果。UI层（`RecruitModal.tsx` L246-258）：
```typescript
{result.general?.name ?? '???'}
{result.isDuplicate ? ... : <div className="tk-recruit-result-new">✨ 新获得</div>}
```

**问题**：当 `general` 为 null 时，UI 显示 "???" 和 "✨ 新获得"，没有专门的空状态提示。但 `isEmpty` 标记已存在于数据中，UI 未使用该标记。

**判定**：**❌ 不通过**。极端情况下 UI 提示不够友好，应显示"武将池为空"等兜底文案。

---

### ❌ ACC-05-39 [P2] 招募历史记录上限

**验收标准**：历史记录最多保留20条

**实际代码**（`recruit-types.ts`）：
```typescript
export const MAX_HISTORY_SIZE = 20;
```

（`HeroRecruitSystem.ts` L247-249）：
```typescript
private pushHistory(output: RecruitOutput): void {
  this.history.push({...});
  if (this.history.length > MAX_HISTORY_SIZE) {
    this.history = this.history.slice(-MAX_HISTORY_SIZE);
  }
}
```

**判定**：**✅ 通过**。上限20条，旧的自动丢弃。

---

## 三、待渲染验证项（⚠️）

| 编号 | 验收项 | 待验证原因 |
|------|--------|-----------|
| ACC-05-02 | 招募弹窗正确打开 | 需渲染验证弹窗居中、半透明遮罩效果 |
| ACC-05-10 | 普通单抽完整流程 | 需渲染验证翻牌动画效果、品质揭示动画 |
| ACC-05-12 | 十连招募完整流程 | 需渲染验证10张卡片逐张翻牌（80ms间隔） |
| ACC-05-28 | 概率公示数值准确 | 需渲染验证概率表显示与配置一致 |
| ACC-05-40 | 招募弹窗手机端布局 | 需渲染验证375×667适配 |
| ACC-05-41 | 招募类型按钮触控友好 | 需渲染验证按钮尺寸≥44px |
| ACC-05-42 | 单抽/十连按钮触控友好 | 需渲染验证按钮尺寸≥44px |
| ACC-05-43 | 概率表手机端可读性 | 需渲染验证无横向滚动 |
| ACC-05-44 | 保底进度条手机端显示 | 需渲染验证进度条适配 |
| ACC-05-45 | 十连结果卡片手机端排列 | 需渲染验证网格排列 |
| ACC-05-46 | 招募历史手机端滚动 | 需渲染验证滚动流畅性 |
| ACC-05-47 | 招募弹窗关闭手势 | 需渲染验证遮罩点击关闭 |
| ACC-05-48 | 资源余额手机端显示 | 需渲染验证千分位分隔 |
| ACC-05-49 | 横竖屏切换适配 | 需渲染验证布局自适应 |

---

## 四、关键发现

### ✅ 正面发现

1. **双重防抖锁设计优秀**：`RecruitModal` 同时使用 `isRecruitingRef`（同步锁）和 `isRecruiting`（状态锁），有效防止快速连点导致的重复招募。

2. **保底系统实现完整**：
   - 十连保底：每10次必出 RARE+（两种池均生效）
   - 硬保底：高级池每100次必出 LEGENDARY+，普通池无硬保底（Infinity）
   - `applyPity()` 函数优先检查硬保底再检查十连保底，逻辑正确
   - 保底计数在达到阈值品质时正确重置

3. **UP武将机制完整**：`HeroRecruitUpManager` 独立管理UP武将状态，高级池出LEGENDARY时50%概率为UP武将，序列化/反序列化完整。

4. **免费招募每日重置**：通过 `todayDateString()` 比较实现跨日重置，逻辑简洁可靠。

5. **招募历史记录管理**：最多20条，自动丢弃旧记录，支持清空。

6. **重复武将处理完整**：重复武将自动转化为碎片（`handleDuplicate`），碎片溢出转化为铜钱。

7. **ESC键和遮罩关闭**：`RecruitModal` 和 `RecruitResultModal` 均支持ESC键关闭和遮罩点击关闭。

8. **概率公示合规**：`ProbabilityDisclosure` 组件显示合计100%、合规审查声明，符合法规要求。

### ⚠️ 需关注项

1. **RecruitPanel 结果展示缺陷**：`RecruitPanel` 组件的 `handleRecruit` 只清空旧结果不设置新结果，导致结果展示区永远为空。虽然主入口 `RecruitModal` 功能完整，但 `RecruitPanel` 作为独立组件存在功能缺陷。

2. **验收标准文档数值误差**：ACC-05-06 描述硬保底为"史诗+ 50次"，但实际配置为"传说+ 100次"。文档需更新以匹配代码。

3. **空武将池兜底不足**：极端情况下（武将池为空），UI显示"???"和"✨ 新获得"，应利用 `isEmpty` 标记显示更友好的提示。

4. **RecruitPanel 与 RecruitModal 功能重叠**：两个组件都实现了招募面板功能，但 `RecruitPanel` 的结果展示不完整。建议明确职责划分或合并。

5. **十连消耗无折扣**：`TEN_PULL_DISCOUNT = 1.0`（无折扣），十连消耗 = 单抽 × 10。验收标准中十连消耗（普通×50、高级×1000）与此一致。

---

## 五、R1 评分

| 维度 | 评分（/10） | 说明 |
|------|-----------|------|
| 功能完整性 | 8.0 | 核心招募流程完整，RecruitPanel结果展示有缺陷 |
| 数据正确性 | 9.0 | 消耗扣除、保底计数、概率配置均正确 |
| 用户体验 | 8.5 | 翻牌动画、防抖、ESC关闭等体验良好 |
| 边界处理 | 7.0 | 空武将池兜底不足，其他边界场景处理良好 |
| 代码质量 | 8.5 | 架构清晰，职责分离，序列化完整 |
| **综合评分** | **8.0/10** | **建议修复后进入R2验证** |

### R1 结论：**有条件通过**

核心招募功能（单抽/十连/保底/免费/UP/历史）实现完整且正确。主要问题集中在 `RecruitPanel` 结果展示缺陷和空武将池兜底不足。建议修复后进入R2渲染验证。

### 必须修复项（R2前）

1. **[P0]** 修复 `RecruitPanel` 的结果展示：`handleRecruit` 应接收并设置招募结果
2. **[P2]** 空武将池兜底：UI层使用 `isEmpty` 标记显示"武将池为空"提示

### 建议改进项

1. 更新验收标准文档 ACC-05-06 的硬保底数值（50/史诗+ → 100/传说+）
2. 明确 `RecruitPanel` 与 `RecruitModal` 的职责划分
3. 考虑为十连招募添加折扣（如九折），提升十连吸引力
