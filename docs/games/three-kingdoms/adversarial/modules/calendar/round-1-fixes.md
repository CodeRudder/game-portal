# Calendar R1 修复记录

> Fixer: TreeFixer v1.3 | Time: 2026-05-01
> 模块: calendar | P0修复: 10/10 | 测试通过: 426/428 (2个预存失败无关)

---

## 修复汇总

| # | P0 ID | 修复描述 | 文件 | 行数变更 | 状态 |
|---|-------|---------|------|---------|------|
| FIX-CAL-001 | CAL-CH-001 | update入口NaN防护 | CalendarSystem.ts L130 | +1字符 | ✅ |
| FIX-CAL-002 | CAL-CH-002 | setTimeScale输入验证 | CalendarSystem.ts L279-280 | +2行 | ✅ |
| FIX-CAL-003 | CAL-CH-003 | deserialize null检查 | CalendarSystem.ts L326 | +1行 | ✅ |
| FIX-CAL-004 | CAL-CH-004 | deserialize NaN/负数过滤 | CalendarSystem.ts L332,338 | +2行 | ✅ |
| FIX-CAL-005 | CAL-CH-005 | serialize扩展+类型修改 | CalendarSystem.ts + calendar.types.ts | +8行 | ✅ |
| FIX-CAL-006 | CAL-CH-006 | computeDate NaN防护 | CalendarSystem.ts L43 | +1行 | ✅ |
| FIX-CAL-007 | CAL-CH-007 | computeEra联动修复 | CalendarSystem.ts | 联动006 | ✅ |
| FIX-CAL-008 | CAL-CH-008 | toChineseNumber NaN防护 | CalendarSystem.ts L421 | +1行 | ✅ |
| FIX-CAL-009 | CAL-CH-009 | toChineseDay NaN防护 | CalendarSystem.ts L430 | +1行 | ✅ |
| FIX-CAL-011 | CAL-CH-011 | serialize NaN过滤 | CalendarSystem.ts L315-316 | +2行 | ✅ |

---

## 修复详情

### FIX-CAL-001: update(dt=NaN) 防护

**问题**: `NaN <= 0` 为 false，绕过守卫。

**修复**:
```typescript
// Before
if (this.paused || dt <= 0) return;

// After
if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
```

**验证**: `setTimeScale(NaN); update(NaN)` → totalDays保持0 ✅

---

### FIX-CAL-002: setTimeScale 输入验证

**问题**: 无任何输入验证，NaN/负数/Infinity均可注入。

**修复**:
```typescript
// Before
setTimeScale(scale: number): void {
    this.timeScale = scale;
}

// After
setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale < 0) return;
    this.timeScale = scale;
}
```

**设计决策**: 允许 `scale=0`（时间冻结），拒绝 `scale<0`（时间倒流）和 `NaN/Infinity`。与现有测试 `setTimeScale(0)` 兼容。

**验证**: `setTimeScale(NaN)` → timeScale保持1.0 ✅; `setTimeScale(-1)` → timeScale保持1.0 ✅; `setTimeScale(0)` → timeScale=0 ✅

---

### FIX-CAL-003: deserialize null 防护

**问题**: `deserialize(null)` 在 `data.version` 处崩溃。

**修复**:
```typescript
// Before
deserialize(data: CalendarSaveData): void {
    if (data.version !== CALENDAR_SAVE_VERSION) {

// After
deserialize(data: CalendarSaveData): void {
    if (!data || typeof data !== 'object') return;
    if (data.version !== CALENDAR_SAVE_VERSION) {
```

**验证**: `deserialize(null)` → 静默返回 ✅; `deserialize(undefined)` → 静默返回 ✅

---

### FIX-CAL-004: deserialize NaN/负数过滤

**问题**: `typeof NaN === 'number'` 为 true，NaN被接受。

**修复**:
```typescript
// Before
if (typeof data.totalDays === 'number') {
    this.totalDays = data.totalDays;
}
if (typeof data.weatherTimer === 'number') {
    this.weatherTimer = data.weatherTimer;
}

// After
if (typeof data.totalDays === 'number' && Number.isFinite(data.totalDays) && data.totalDays >= 0) {
    this.totalDays = data.totalDays;
}
if (typeof data.weatherTimer === 'number' && Number.isFinite(data.weatherTimer) && data.weatherTimer >= 0) {
    this.weatherTimer = data.weatherTimer;
}
```

**验证**: `deserialize({totalDays: NaN})` → totalDays保持原值 ✅; `deserialize({totalDays: -100})` → totalDays保持原值 ✅

---

### FIX-CAL-005: serialize 扩展（timeScale + weatherDuration）

**问题**: serialize不保存timeScale和weatherDuration，存档恢复后加速档位丢失。

**修复**:

1. **类型扩展** (calendar.types.ts):
```typescript
export interface CalendarSaveData {
    // ... 原有字段
    timeScale?: number;        // v2 新增，旧存档可能缺失
    weatherDuration?: number;  // v2 新增，旧存档可能缺失
}
```

2. **serialize 添加字段** (CalendarSystem.ts):
```typescript
serialize(): CalendarSaveData {
    return {
        // ... 原有字段（totalDays/weatherTimer已添加NaN过滤）
        timeScale: Number.isFinite(this.timeScale) ? this.timeScale : DEFAULT_TIME_SCALE,
        weatherDuration: Number.isFinite(this.weatherDuration) ? this.weatherDuration : rollWeatherDuration(),
    };
}
```

3. **deserialize 恢复字段** (CalendarSystem.ts):
```typescript
if (typeof data.timeScale === 'number' && Number.isFinite(data.timeScale) && data.timeScale > 0) {
    this.timeScale = data.timeScale;
}
if (typeof data.weatherDuration === 'number' && Number.isFinite(data.weatherDuration) && data.weatherDuration > 0) {
    this.weatherDuration = data.weatherDuration;
}
```

**向后兼容**: 新字段使用 `?` 可选标记，旧存档（不含timeScale/weatherDuration）可正常加载，使用默认值。

**验证**: `setTimeScale(5); serialize(); deserialize(saved); getTimeScale() === 5` ✅

---

### FIX-CAL-006: computeDate NaN 防护

**问题**: computeDate(NaN) → 全字段NaN。

**修复**:
```typescript
// Before
function computeDate(totalDays: number): GameDate {
    const td = Math.floor(totalDays);

// After
function computeDate(totalDays: number): GameDate {
    if (!Number.isFinite(totalDays) || totalDays < 0) totalDays = 0;
    const td = Math.floor(totalDays);
```

**验证**: `computeDate(NaN)` → 返回初始日期 {year:1, month:1, day:1, ...} ✅

---

### FIX-CAL-007: computeEra 联动修复

computeEra通过computeDate的入口防护间接保护。当year为NaN时，computeEra的fallback（沿用咸熙）行为合理，yearInEra=NaN被toChineseNumber的NaN防护拦截。

**验证**: 联动FIX-CAL-006和FIX-CAL-008 ✅

---

### FIX-CAL-008: toChineseNumber NaN 防护

**问题**: `CN_DIGITS[NaN] = undefined`。

**修复**:
```typescript
// Before
function toChineseNumber(n: number): string {
    if (n <= 10) return CN_DIGITS[n];

// After
function toChineseNumber(n: number): string {
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return '一';
    if (n <= 10) return CN_DIGITS[n];
```

**设计决策**: fallback返回'一'而非'零'，因为年号内年份从1开始（无"零年"）。

**验证**: `toChineseNumber(NaN)` → '一' ✅; `toChineseNumber(-1)` → '一' ✅

---

### FIX-CAL-009: toChineseDay NaN 防护

**问题**: 与FIX-CAL-008对称。

**修复**:
```typescript
// Before
function toChineseDay(day: number): string {
    if (day <= 10) return `初${CN_DIGITS[day]}`;

// After
function toChineseDay(day: number): string {
    if (!Number.isFinite(day) || day < 1 || !Number.isInteger(day)) return '初一';
    if (day <= 10) return `初${CN_DIGITS[day]}`;
```

**验证**: `toChineseDay(NaN)` → '初一' ✅

---

### FIX-CAL-011: serialize NaN 过滤

**问题**: serialize输出含NaN，JSON.stringify(NaN)="null"，导致进度丢失。

**修复**（合并到FIX-CAL-005中）:
```typescript
totalDays: Number.isFinite(this.totalDays) ? this.totalDays : 0,
weatherTimer: Number.isFinite(this.weatherTimer) ? this.weatherTimer : 0,
```

**验证**: `totalDays=NaN → serialize().totalDays === 0` ✅

---

## 测试适配

### calendar-advanced.test.ts 更新

serialize测试从 `toEqual`（精确匹配）改为 `toMatchObject`（部分匹配），因为weatherDuration是随机值。

```typescript
// Before
expect(data).toEqual({ version: ..., totalDays: 0, ... });

// After
expect(data).toMatchObject({ version: ..., totalDays: 0, ... });
expect(data.timeScale).toBe(1.0);
expect(data.weatherDuration).toBeGreaterThanOrEqual(3);
expect(data.weatherDuration).toBeLessThanOrEqual(10);
```

---

## 测试结果

```
Test Files  10 passed (11 total, 1 pre-existing failure unrelated to calendar)
Tests       426 passed | 2 failed (pre-existing siege integration) | 11 skipped
```

**Calendar相关测试**: 全部通过 ✅
**预存失败**: territory-conquest.integration.test.ts 中的2个失败与Calendar修复无关（SiegeSystem逻辑问题）

---

## 修复穿透验证

| 检查项 | 结果 | 说明 |
|--------|------|------|
| FIX-CAL-001 → computeDate | ✅ | NaN被入口拦截，computeDate收到合法值 |
| FIX-CAL-002 → update | ✅ | timeScale=NaN时 dt*NaN=NaN，但update入口已拦截dt*NaN |
| FIX-CAL-003 → FIX-CAL-004 | ✅ | null检查在version检查之前 |
| FIX-CAL-005 → Engine.save | ✅ | engine-save.ts:L195调用serialize()，新字段自动保存 |
| FIX-CAL-005 → Engine.load | ✅ | engine-save.ts:L521调用deserialize()，新字段自动恢复 |
| FIX-CAL-006 → computeEra | ✅ | computeDate防护后year始终为正整数 |
| FIX-CAL-008 ↔ FIX-CAL-009 | ✅ | 对称函数同步修复（BR-20规则） |
| FIX-CAL-011 → JSON序列化 | ✅ | NaN被过滤为0，JSON.stringify(0)="0"正常 |

---

## 文件变更清单

| 文件 | 变更类型 | 行数 |
|------|---------|------|
| CalendarSystem.ts | 修改 | +24/-5 |
| calendar.types.ts | 修改 | +4 |
| calendar-advanced.test.ts | 修改 | +5/-1 |
| **总计** | | **+33/-6** |

---

*Calendar R1 Fixer 完成。10个P0全部修复，426个测试通过。修复成本极低（27行代码变更），与Arbiter预测一致。*
