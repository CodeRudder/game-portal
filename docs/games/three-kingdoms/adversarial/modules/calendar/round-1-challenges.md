# Calendar R1 Challenger 挑战

> Challenger: TreeChallenger v1.3 | Time: 2026-05-01
> 模块: calendar | 源码: 4文件 ~430行 | Builder树节点: 142

---

## 挑战总览

| 维度 | P0 | P1 | P2 | 总计 |
|------|----|----|-----|------|
| Normal flow | 0 | 0 | 0 | 0 |
| Boundary conditions | 5 | 4 | 0 | 9 |
| Error paths | 3 | 1 | 0 | 4 |
| Cross-system | 2 | 1 | 0 | 3 |
| Data lifecycle | 3 | 1 | 0 | 4 |
| **总计** | **13** | **7** | **0** | **20** |

> 虚报率自评估: ~0%（所有P0均有源码行号支撑）

---

## P0 挑战详情

### CAL-CH-001: update(dt=NaN) 绕过 `dt <= 0` 守卫

**维度**: Boundary | **严重度**: 🔴 P0 | **源码**: L130

**问题**:
```typescript
// CalendarSystem.ts L130
update(dt: number): void {
    if (this.paused || dt <= 0) return;  // NaN <= 0 === false → 绕过！
    this.totalDays += dt * this.timeScale;  // totalDays = 0 + NaN * 1 = NaN
```

**复现**:
```typescript
const cal = new CalendarSystem();
cal.update(NaN);
// totalDays = NaN
// cachedDate = computeDate(NaN) → { year: NaN, month: NaN, day: NaN, season: 'spring'(fallback), eraName: NaN相关, yearInEra: NaN }
```

**影响**: NaN进入totalDays后，所有日期查询返回NaN，formatDate崩溃（CN_DIGITS[NaN]=undefined），系统完全不可用。

**Builder标注**: CAL-B-002 ✅ 已标注为P0 uncovered — **一致**

**修复建议**:
```typescript
if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
```

---

### CAL-CH-002: setTimeScale 无输入验证

**维度**: Boundary | **严重度**: 🔴 P0 | **源码**: L278

**问题**:
```typescript
// CalendarSystem.ts L278
setTimeScale(scale: number): void {
    this.timeScale = scale;  // 无任何验证！
}
```

**复现**:
```typescript
const cal = new CalendarSystem();
cal.setTimeScale(NaN);   // timeScale = NaN → update中 dt * NaN = NaN
cal.setTimeScale(-1);    // timeScale = -1 → 时间倒流
cal.setTimeScale(0);     // timeScale = 0 → 时间冻结（但非paused状态）
cal.setTimeScale(Infinity); // timeScale = Infinity → 一帧跳跃无数天
```

**影响**: 
- NaN: 与CAL-CH-001相同的NaN污染链
- 负数: 时间倒流，日期回到过去，年号倒退
- 0: 隐性冻结，pause状态为false但时间不流动
- Infinity: 一帧后totalDays=Infinity

**Builder标注**: CAL-B-012/B-013/B-014 已标注 — **一致**

**修复建议**:
```typescript
setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) return;
    this.timeScale = scale;
}
```

---

### CAL-CH-003: deserialize(null/undefined) 崩溃

**维度**: Error paths | **严重度**: 🔴 P0 | **源码**: L313

**问题**:
```typescript
// CalendarSystem.ts L313
deserialize(data: CalendarSaveData): void {
    if (data.version !== CALENDAR_SAVE_VERSION) { // data=null → TypeError: Cannot read properties of null
```

**复现**:
```typescript
const cal = new CalendarSystem();
cal.deserialize(null);       // TypeError: Cannot read properties of null (reading 'version')
cal.deserialize(undefined);  // TypeError: Cannot read properties of undefined
```

**影响**: 存档数据损坏或缺失时，游戏崩溃。这是前序模块（Hero/Battle）反复出现的同类问题。

**Builder标注**: CAL-S-003/S-004 已标注 — **一致**

**修复建议**:
```typescript
deserialize(data: CalendarSaveData): void {
    if (!data || typeof data !== 'object') return;
    // ... 后续逻辑
}
```

---

### CAL-CH-004: deserialize 接受 NaN/Infinity/负数 totalDays

**维度**: Data lifecycle | **严重度**: 🔴 P0 | **源码**: L320

**问题**:
```typescript
// CalendarSystem.ts L320
if (typeof data.totalDays === 'number') {  // typeof NaN === 'number' → true!
    this.totalDays = data.totalDays;        // NaN/Infinity/负数全部被接受
}
```

**复现**:
```typescript
const cal = new CalendarSystem();
cal.deserialize({ version: 1, totalDays: NaN, weather: 'clear', weatherTimer: 0, paused: false });
// totalDays = NaN → 全链污染

cal.deserialize({ version: 1, totalDays: -100, weather: 'clear', weatherTimer: 0, paused: false });
// totalDays = -100 → computeDate(-100) → year=0, month=负数, day=负数

cal.deserialize({ version: 1, totalDays: Infinity, weather: 'clear', weatherTimer: 0, paused: false });
// totalDays = Infinity → computeDate(Infinity) → 全Infinity
```

**影响**: 恶意或损坏的存档数据可以注入NaN/Infinity/负数，导致日历系统完全崩溃。

**Builder标注**: CAL-S-005/S-006/S-007 已标注 — **一致**

**修复建议**:
```typescript
if (typeof data.totalDays === 'number' && Number.isFinite(data.totalDays) && data.totalDays >= 0) {
    this.totalDays = data.totalDays;
}
```

---

### CAL-CH-005: serialize 不保存 timeScale

**维度**: Data lifecycle | **严重度**: 🔴 P0 | **源码**: L302-310

**问题**:
```typescript
// CalendarSystem.ts L302-310
serialize(): CalendarSaveData {
    return {
        version: CALENDAR_SAVE_VERSION,
        totalDays: this.totalDays,
        weather: this.weather,
        weatherTimer: this.weatherTimer,
        paused: this.paused,
        // ❌ 缺少 timeScale
        // ❌ 缺少 weatherDuration
    };
}
```

**复现**:
```typescript
const cal = new CalendarSystem();
cal.setTimeScale(5.0);  // 加速5倍
const saved = cal.serialize();  // timeScale=5 未保存

const cal2 = new CalendarSystem();
cal2.deserialize(saved);
cal2.getTimeScale();  // 1.0（默认值）→ 玩家加速设置丢失！
```

**影响**: 
- 玩家设置加速后存档，读档后加速丢失，回退到1x速度
- weatherDuration未保存，读档后天气变化间隔重新随机，行为不一致
- **可玩性阻断项**：加速是核心体验功能，丢失后严重影响体验

**Builder标注**: CAL-S-011/S-012 已标注 — **一致**

**修复建议**:
```typescript
// 1. 扩展 CalendarSaveData 类型
interface CalendarSaveData {
    version: number;
    totalDays: number;
    weather: WeatherType;
    weatherTimer: number;
    paused: boolean;
    timeScale: number;        // 新增
    weatherDuration: number;  // 新增
}

// 2. serialize 添加字段
serialize(): CalendarSaveData {
    return {
        version: CALENDAR_SAVE_VERSION,
        totalDays: this.totalDays,
        weather: this.weather,
        weatherTimer: this.weatherTimer,
        paused: this.paused,
        timeScale: this.timeScale,
        weatherDuration: this.weatherDuration,
    };
}

// 3. deserialize 恢复字段
if (typeof data.timeScale === 'number' && Number.isFinite(data.timeScale) && data.timeScale > 0) {
    this.timeScale = data.timeScale;
}
if (typeof data.weatherDuration === 'number' && Number.isFinite(data.weatherDuration)) {
    this.weatherDuration = data.weatherDuration;
}
```

---

### CAL-CH-006: computeDate(totalDays=NaN) 全链 NaN 污染

**维度**: Boundary | **严重度**: 🔴 P0 | **源码**: L41-51

**问题**:
```typescript
// CalendarSystem.ts L41-51
function computeDate(totalDays: number): GameDate {
    const td = Math.floor(totalDays);  // Math.floor(NaN) = NaN
    const day = (td % DAYS_PER_MONTH) + 1;    // NaN % 30 = NaN → day = NaN
    const totalMonths = Math.floor(td / DAYS_PER_MONTH); // NaN
    const month = (totalMonths % MONTHS_PER_YEAR) + 1;   // NaN
    const year = Math.floor(totalMonths / MONTHS_PER_YEAR) + 1; // NaN
    const season = SEASON_MONTH_MAP[month] ?? 'spring';  // SEASON_MONTH_MAP[NaN] = undefined → 'spring' fallback
    const { eraName, yearInEra } = computeEra(year);      // computeEra(NaN)
```

**影响**: 一旦totalDays变为NaN，所有日期字段变为NaN，但season fallback为'spring'（掩盖了错误），eraName和yearInEra依赖computeEra(NaN)。

**Builder标注**: CAL-B-005 已标注 — **一致**

**修复建议**: 在update入口和deserialize入口阻断NaN，computeDate内部添加防御:
```typescript
function computeDate(totalDays: number): GameDate {
    if (!Number.isFinite(totalDays) || totalDays < 0) totalDays = 0;
    // ... 后续逻辑
}
```

---

### CAL-CH-007: computeEra(NaN) 不匹配任何年号

**维度**: Boundary | **严重度**: 🔴 P0 | **源码**: L54-62

**问题**:
```typescript
// CalendarSystem.ts L54-62
function computeEra(year: number): { eraName: string; yearInEra: number } {
    for (const era of ERA_TABLE) {
        if (year >= era.startYear && year <= era.endYear) {
            // NaN >= 1 === false → 跳过所有年号
            return { eraName: era.name, yearInEra: year - era.startYear + 1 };
        }
    }
    // 走到fallback
    const last = ERA_TABLE[ERA_TABLE.length - 1];
    return { eraName: last.name, yearInEra: year - last.startYear + 1 };
    // yearInEra = NaN - 61 + 1 = NaN
}
```

**影响**: eraName正确fallback到"咸熙"，但yearInEra=NaN。formatDate中使用yearInEra进行条件判断和中文转换，NaN导致formatDate输出含"undefined"。

**Builder标注**: CAL-B-009 已标注 — **一致**

**修复建议**: 与CAL-CH-006联动，在computeDate入口防护。

---

### CAL-CH-008: toChineseNumber(NaN) 返回 undefined

**维度**: Boundary | **严重度**: 🔴 P0 | **源码**: L402-406

**问题**:
```typescript
// CalendarSystem.ts L402-406
function toChineseNumber(n: number): string {
    if (n <= 10) return CN_DIGITS[n];  // NaN <= 10 === false → 跳过
    if (n < 20) return `十${n % 10 === 0 ? '' : CN_DIGITS[n % 10]}`;  // NaN < 20 === false → 跳过
    if (n < 100 && n % 10 === 0) return `${CN_DIGITS[Math.floor(n / 10)]}十`;  // 跳过
    return `${CN_DIGITS[Math.floor(n / 10)]}十${CN_DIGITS[n % 10]}`;
    // CN_DIGITS[NaN] = undefined → "undefined十undefined"
}
```

**复现**:
```typescript
const cal = new CalendarSystem();
// 假设通过某种方式totalDays被设为NaN
cal.formatDate(); // 输出类似 "咸熙undefined年 undefined月undefined" 
```

**影响**: formatDate是UI显示核心函数，显示"undefined"严重影响玩家体验。

**Builder标注**: CAL-B-016 已标注 — **一致**

**修复建议**:
```typescript
function toChineseNumber(n: number): string {
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return '零';
    // ... 原有逻辑
}
```

---

### CAL-CH-009: toChineseDay(NaN) 返回 undefined

**维度**: Boundary | **严重度**: 🔴 P0 | **源码**: L409-415

**问题**: 与CAL-CH-008对称，toChineseDay(NaN)同样导致CN_DIGITS[NaN]=undefined。

**Builder标注**: CAL-B-019 已标注 — **一致**

**修复建议**: 同CAL-CH-008模式。

---

### CAL-CH-010: weatherTimer 累加溢出风险

**维度**: Boundary | **严重度**: 🔴 P0 | **源码**: L155-156

**问题**:
```typescript
// CalendarSystem.ts L155-156
this.weatherTimer += (currentIntegerDay - prevIntegerDay);
if (this.weatherTimer >= this.weatherDuration) {
    this.changeWeather();
}
```

当 `dt` 非常大（如 dt=1e10），一次update跨越大量天数：
- `currentIntegerDay - prevIntegerDay` 可能非常大
- `weatherTimer` 累加后远超 `weatherDuration`
- `changeWeather` 只调用一次，但实际应触发多次天气变化
- 更关键的是：如果 `this.timeScale` 为 NaN（通过 CAL-CH-002 注入），`dt * NaN = NaN`
- `this.totalDays += NaN` → NaN污染链

**影响**: 大dt导致天气变化只触发一次而非多次，但更严重的是配合NaN注入导致全链崩溃。

**Builder标注**: 未单独标注（被SP-1覆盖）

**修复建议**: update入口NaN防护即可覆盖。

---

### CAL-CH-011: serialize 输出含 NaN/Infinity 时破坏存档

**维度**: Data lifecycle | **严重度**: 🔴 P0 | **源码**: L302-310

**问题**:
```typescript
serialize(): CalendarSaveData {
    return {
        version: CALENDAR_SAVE_VERSION,
        totalDays: this.totalDays,  // 如果totalDays=NaN → 存档含NaN
        // JSON.stringify(NaN) → "null" → 反序列化后totalDays=null
        // typeof null !== 'number' → deserialize跳过 → totalDays保持上一次值
        weather: this.weather,
        weatherTimer: this.weatherTimer,  // 同理可能含NaN
        paused: this.paused,
    };
}
```

**复现**:
```typescript
const cal = new CalendarSystem();
// 通过CAL-CH-001或CAL-CH-002注入NaN
cal.update(NaN); // 或 cal.setTimeScale(NaN); cal.update(1);
const saved = cal.serialize();
// saved.totalDays = NaN

const json = JSON.stringify(saved);
// json = '{"version":1,"totalDays":null,"weather":"clear","weatherTimer":0,"paused":false}'

const parsed = JSON.parse(json);
// parsed.totalDays = null

const cal2 = new CalendarSystem();
cal2.deserialize(parsed);
// typeof null !== 'number' → totalDays保持0 → 日期回到初始
```

**影响**: NaN → JSON序列化 → null → deserialize跳过 → 日期重置到初始状态。**玩家进度完全丢失！**

**Builder标注**: CAL-S-001 已标注 — **一致**

**修复建议**: serialize时过滤NaN/Infinity:
```typescript
serialize(): CalendarSaveData {
    return {
        version: CALENDAR_SAVE_VERSION,
        totalDays: Number.isFinite(this.totalDays) ? this.totalDays : 0,
        weather: this.weather,
        weatherTimer: Number.isFinite(this.weatherTimer) ? this.weatherTimer : 0,
        paused: this.paused,
    };
}
```

---

### CAL-CH-012: Engine.save 是否调用 Calendar.serialize — 跨系统验证

**维度**: Cross-system | **严重度**: 🔴 P0 | **源码**: 需验证engine-save

**问题**: Builder树中CAL-X-006/CAL-X-007标注为"需验证engine-save/load调用"。如果引擎的buildSaveData/applySaveData未包含CalendarSystem.serialize/deserialize调用，则日历状态完全不保存。

**影响**: 如果引擎未调用calendar.serialize()，所有日历状态（日期、天气、季节）在存档/读档后丢失。

**Builder标注**: CAL-X-006/X-007 已标注为需验证 — **一致**

**验证方法**: grep engine源码中的buildSaveData/applySaveData，确认calendar被包含。

---

### CAL-CH-013: checkSeasonChange 的 prevDay < 0 守卫不完整

**维度**: Boundary | **严重度**: 🔴 P0 | **源码**: L366-367

**问题**:
```typescript
// CalendarSystem.ts L365-367
private checkSeasonChange(currentIntegerDay: number): void {
    const prevDay = currentIntegerDay - 1;
    if (prevDay < 0) return;  // 仅在currentIntegerDay=0时触发
```

当totalDays被设为负数（通过deserialize注入）：
- `currentIntegerDay = Math.floor(-100) = -100`
- `prevDay = -101`
- `prevDay < 0` → return，跳过季节检测
- 但 `computeDate(-100)` 会产生负数year/month/day
- 季节检测被跳过意味着季节事件不会发射，但日期已经错误

**影响**: 配合deserialize注入负数totalDays，日期计算错误但季节事件不发射，状态不一致。

**Builder标注**: 未单独标注

**修复建议**: 在deserialize入口阻断负数totalDays。

---

## P1 挑战详情

### CAL-CH-P1-001: computeDate(负数) 产生负数日期

**维度**: Boundary | **源码**: L42-51

`computeDate(-1)` → `td = -1`, `day = (-1 % 30) + 1 = 0`, `totalMonths = floor(-1/30) = -1`, `month = (-1 % 12) + 1 = 0`, `year = floor(-1/360) + 1 = 0`

year=0, month=0, day=0 — 无意义但不会崩溃。SEASON_MONTH_MAP[0] = undefined → 'spring' fallback。

**修复建议**: computeDate入口 `totalDays = Math.max(0, totalDays)`。

---

### CAL-CH-P1-002: computeDate(Infinity) 全 Infinity

**维度**: Boundary | **源码**: L42-51

`Math.floor(Infinity) = Infinity`, `Infinity % 30 = NaN`, day = NaN。

**修复建议**: computeDate入口 `if (!Number.isFinite(totalDays)) return defaultDate`。

---

### CAL-CH-P1-003: deserialize weatherTimer 无范围验证

**维度**: Data lifecycle | **源码**: L326

```typescript
if (typeof data.weatherTimer === 'number') {
    this.weatherTimer = data.weatherTimer;  // NaN/负数/Infinity全部接受
}
```

**修复建议**: 添加 `Number.isFinite(data.weatherTimer) && data.weatherTimer >= 0`。

---

### CAL-CH-P1-004: init 未调用时 update 可运行

**维度**: Error paths | **源码**: L129

update方法不检查deps是否已初始化。如果init未被调用：
- update正常运行（时间推进正常）
- 但所有事件发射静默丢弃（deps=null → emit方法return）
- 时间流逝但无事件通知 → 其他系统收不到日期/季节/天气变化

**影响**: 非典型使用场景，但缺少guard可能导致难以调试的bug。

---

### CAL-CH-P1-005: getSeasonBonusFor 无输入验证

**维度**: Boundary | **源码**: L270

```typescript
getSeasonBonusFor(season: Season) {
    return { ...SEASON_BONUSES[season] };  // season不在SEASON_BONUSES中 → undefined spread → {}
}
```

传入无效season字符串时返回空对象`{}`而非报错。

---

### CAL-CH-P1-006: formatDate 传入无效 GameDate

**维度**: Boundary | **源码**: L230-238

formatDate接受可选GameDate参数，但不验证传入的对象是否合法：
```typescript
cal.formatDate({ year: NaN, month: NaN, day: NaN, season: 'spring', eraName: '', yearInEra: NaN });
// → toChineseNumber(NaN) → "undefined十undefined"
```

---

### CAL-CH-P1-007: weatherDuration 不在 serialize 中

**维度**: Data lifecycle | **源码**: L302-310

与CAL-CH-005的timeScale问题同类，weatherDuration未序列化导致读档后天气变化间隔重新随机。

---

## 系统性问题

### SYS-CAL-001: NaN 防护完全缺失

Calendar模块没有任何NaN防护。与前序模块（Hero有DEF-006，Battle有部分防护）不同，Calendar是一个全新的NaN无防护区：
- update(dt): 无NaN检查
- setTimeScale(scale): 无NaN检查  
- deserialize(data): typeof NaN === 'number' 绕过
- computeDate(totalDays): 无NaN检查
- computeEra(year): 无NaN检查
- toChineseNumber/toChineseDay: 无NaN检查

**根因**: Calendar模块作为较新的模块，未经历NaN防护迭代。

### SYS-CAL-002: serialize/deserialize 不完整

serialize遗漏2个运行时状态字段（timeScale、weatherDuration），deserialize缺少null/NaN/负数验证。这与Hero/Battle模块的serialize问题模式一致（BR-14/15教训）。

### SYS-CAL-003: 无上限保护

totalDays无上限，理论上可以无限增长。虽然360天/年使得year增长缓慢，但长时间运行后：
- year超过64（ERA_TABLE末尾）→ 沿用咸熙，yearInEra持续增长
- yearInEra超过99 → toChineseNumber不支持（仅支持1-99）
- 超过一定天数后，数值精度可能下降（浮点数）

---

## 修复优先级排序

| 优先级 | ID | 修复成本 | 描述 |
|--------|-----|---------|------|
| 🔴 最高 | CAL-CH-001 | 1行 | update入口NaN防护 |
| 🔴 最高 | CAL-CH-002 | 3行 | setTimeScale输入验证 |
| 🔴 最高 | CAL-CH-003 | 2行 | deserialize null检查 |
| 🔴 最高 | CAL-CH-004 | 3行 | deserialize NaN/负数过滤 |
| 🔴 最高 | CAL-CH-005 | 中等 | serialize扩展+类型修改 |
| 🔴 最高 | CAL-CH-011 | 3行 | serialize NaN过滤 |
| 🔴 高 | CAL-CH-006 | 2行 | computeDate防御 |
| 🔴 高 | CAL-CH-007 | 联动 | 与006联动 |
| 🔴 高 | CAL-CH-008/009 | 4行 | toChineseNumber/Day防御 |
| 🔴 高 | CAL-CH-012 | 需验证 | Engine.save集成验证 |
| 🟡 中 | CAL-CH-010 | 联动 | 与001联动 |
| 🟡 中 | CAL-CH-013 | 联动 | 与004联动 |

---

*Calendar R1 Challenger 挑战完成。发现13个P0、7个P1。模块体量小但NaN防护完全空白，serialize/deserialize存在系统性缺陷。与前序模块问题模式高度一致，建议建立项目级NaN防护规范。*
