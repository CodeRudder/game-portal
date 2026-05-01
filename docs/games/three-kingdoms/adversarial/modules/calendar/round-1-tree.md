# Calendar 流程分支树 Round 1

> Builder: TreeBuilder v1.3 | Time: 2026-05-01
> 模块: calendar | 文件: 4 | 源码: ~430行 | API: ~25

## 统计

| 维度 | 节点数 | API数 | covered | uncovered | todo | P0 | P1 |
|------|--------|-------|---------|-----------|------|----|----|
| **总计** | **142** | **25** | **98** | **44** | **0** | **12** | **14** |

> 注：API数包含公开方法、辅助函数、配置验证项；节点数=分支条件总行数

## 子系统覆盖

| 子系统 | 文件 | API数 | 节点数 | covered | uncovered | 覆盖率 |
|--------|------|-------|--------|---------|-----------|--------|
| CalendarSystem | CalendarSystem.ts | 18 | 108 | 72 | 36 | 66.7% |
| calendar-config | calendar-config.ts | 4 | 18 | 16 | 2 | 88.9% |
| calendar.types | calendar.types.ts | 2 | 8 | 8 | 0 | 100% |
| index.ts | index.ts | 1 | 8 | 2 | 6 | 25.0% |

## 公开 API 清单

### CalendarSystem.ts (18 API)

| # | API | 类型 | 参数 | 返回值 | 行号 |
|---|-----|------|------|--------|------|
| 1 | `constructor()` | 构造 | — | CalendarSystem | L107-116 |
| 2 | `init(deps)` | 生命周期 | ISystemDeps | void | L121 |
| 3 | `update(dt)` | 生命周期 | number | void | L129-157 |
| 4 | `getState()` | 查询 | — | CalendarState | L160-168 |
| 5 | `reset()` | 生命周期 | — | void | L171-182 |
| 6 | `getDate()` | 查询 | — | GameDate | L189 |
| 7 | `getYear()` | 查询 | — | number | L194 |
| 8 | `getMonth()` | 查询 | — | number | L199 |
| 9 | `getDay()` | 查询 | — | number | L204 |
| 10 | `getSeason()` | 查询 | — | Season | L209 |
| 11 | `getEraName()` | 查询 | — | string | L214 |
| 12 | `getYearInEra()` | 查询 | — | number | L219 |
| 13 | `getTotalDays()` | 查询 | — | number | L224 |
| 14 | `formatDate(date?)` | 格式化 | GameDate? | string | L230-238 |
| 15 | `getWeather()` | 查询 | — | WeatherType | L247 |
| 16 | `setWeather(weather)` | 设置 | WeatherType | void | L254-258 |
| 17 | `getSeasonBonus()` | 查询 | — | SeasonBonus | L265 |
| 18 | `getSeasonBonusFor(season)` | 查询 | Season | SeasonBonus | L270 |
| 19 | `setTimeScale(scale)` | 设置 | number | void | L278 |
| 20 | `getTimeScale()` | 查询 | — | number | L282 |
| 21 | `pause()` | 控制 | — | void | L287 |
| 22 | `resume()` | 控制 | — | void | L291 |
| 23 | `isPaused()` | 查询 | — | boolean | L295 |
| 24 | `serialize()` | 序列化 | — | CalendarSaveData | L302-310 |
| 25 | `deserialize(data)` | 序列化 | CalendarSaveData | void | L313-335 |

### 辅助函数 (4)

| # | 函数 | 参数 | 返回值 | 行号 |
|---|------|------|--------|------|
| A1 | `computeDate(totalDays)` | number | GameDate | L41-51 |
| A2 | `computeEra(year)` | number | {eraName, yearInEra} | L54-62 |
| A3 | `rollWeather()` | — | WeatherType | L65-72 |
| A4 | `rollWeatherDuration()` | — | number | L75-77 |
| A5 | `toChineseNumber(n)` | number | string | L402-406 |
| A6 | `toChineseDay(day)` | number | string | L409-415 |

## 分支节点详细清单

### F-Normal: 正常流程节点

| # | 节点ID | API | 分支条件 | 行号 | covered |
|---|--------|-----|---------|------|---------|
| N-01 | CAL-N-001 | update | dt > 0 且非暂停 → 推进时间 | L130 | ✅ CalendarSystem.test.ts:L45 |
| N-02 | CAL-N-002 | update | dt <= 0 → 跳过更新 | L130 | ✅ CalendarSystem.test.ts:L52 |
| N-03 | CAL-N-003 | update | paused=true → 跳过更新 | L130 | ✅ CalendarSystem.test.ts:L58 |
| N-04 | CAL-N-004 | update | currentIntegerDay > prevIntegerDay → emitDayChanged | L148 | ✅ calendar-advanced.test.ts:L84 |
| N-05 | CAL-N-005 | update | currentIntegerDay == prevIntegerDay → 不触发事件 | L148 | ✅ CalendarSystem.test.ts:L67 |
| N-06 | CAL-N-006 | update | 季节变化 → emitSeasonChanged | L153 | ✅ calendar-advanced.test.ts:L100 |
| N-07 | CAL-N-007 | update | 天气计时器到期 → changeWeather | L155-156 | ✅ calendar-advanced.test.ts:L108 |
| N-08 | CAL-N-008 | setWeather | 新旧天气不同 → emit + 更新 | L256-257 | ✅ calendar-advanced.test.ts:L61 |
| N-09 | CAL-N-009 | setWeather | 新旧天气相同 → 跳过 | L256 | ✅ calendar-advanced.test.ts:L74 |
| N-10 | CAL-N-010 | reset | 所有状态回到初始值 | L171-182 | ✅ CalendarSystem.test.ts:L108 |
| N-11 | CAL-N-011 | serialize | 正常序列化 | L302-310 | ✅ CalendarSystem.test.ts:L118 |
| N-12 | CAL-N-012 | deserialize | 正常反序列化 | L313-335 | ✅ CalendarSystem.test.ts:L128 |
| N-13 | CAL-N-013 | formatDate | 年号元年特殊处理 | L232-233 | ✅ calendar-advanced.test.ts:L20 |
| N-14 | CAL-N-014 | formatDate | 非元年年号 | L233 | ✅ calendar-advanced.test.ts:L28 |
| N-15 | CAL-N-015 | formatDate | 正月特殊处理 | L234 | ✅ calendar-advanced.test.ts:L20 |
| N-16 | CAL-N-016 | formatDate | 非正月 | L234 | ✅ calendar-advanced.test.ts:L28 |
| N-17 | CAL-N-017 | computeDate | totalDays=0 → year=1, month=1, day=1 | L42-51 | ✅ calendar-config.test.ts |
| N-18 | CAL-N-018 | computeDate | totalDays=360 → year=2, month=1, day=1 | L42-51 | ✅ calendar-config.test.ts |
| N-19 | CAL-N-019 | computeEra | year=1 → 建安元年 | L56-60 | ✅ calendar-config.test.ts |
| N-20 | CAL-N-020 | computeEra | year=25 → 延康元年 | L56-60 | ✅ calendar-config.test.ts |
| N-21 | CAL-N-021 | computeEra | year > 64 → 沿用咸熙 | L61-62 | ✅ calendar-config.test.ts |
| N-22 | CAL-N-022 | rollWeather | 按权重随机 | L65-72 | ✅ calendar-advanced.test.ts |
| N-23 | CAL-N-023 | rollWeatherDuration | [3, 10] 范围随机 | L75-77 | ✅ covered |
| N-24 | CAL-N-024 | changeWeather | 天气变化后重置计时器 | L384-386 | ✅ calendar-advanced.test.ts |
| N-25 | CAL-N-025 | changeWeather | 天气未变 → 不触发事件 | L388 | ✅ covered |

### F-Boundary: 边界条件节点

| # | 节点ID | API | 分支条件 | 行号 | covered | P0/P1 |
|---|--------|-----|---------|------|---------|-------|
| B-01 | CAL-B-001 | update | dt=0 → 不推进 | L130 | ✅ | — |
| B-02 | CAL-B-002 | update | dt=NaN → `dt <= 0` 为 false → **NaN进入totalDays** | L130 | ❌ **P0** | 🔴 |
| B-03 | CAL-B-003 | update | dt=Infinity → totalDays=Infinity | L130 | ❌ **P0** | 🔴 |
| B-04 | CAL-B-004 | update | dt=负数 → 跳过（dt <= 0） | L130 | ✅ | — |
| B-05 | CAL-B-005 | computeDate | totalDays=NaN → day/month/year全为NaN | L42-51 | ❌ **P0** | 🔴 |
| B-06 | CAL-B-006 | computeDate | totalDays=Infinity → day/month/year含Infinity | L42-51 | ❌ **P1** | 🟡 |
| B-07 | CAL-B-007 | computeDate | totalDays=负数 → year<=0, month<=0, day<=0 | L42-51 | ❌ **P1** | 🟡 |
| B-08 | CAL-B-008 | computeEra | year=0 → 不匹配任何年号 | L56-60 | ❌ **P1** | 🟡 |
| B-09 | CAL-B-009 | computeEra | year=NaN → 不匹配任何年号 | L56-60 | ❌ **P0** | 🔴 |
| B-10 | CAL-B-010 | computeEra | year=负数 → 不匹配任何年号 | L56-60 | ❌ **P1** | 🟡 |
| B-11 | CAL-B-011 | setTimeScale | scale=0 → 时间停滞 | L278 | ❌ **P1** | 🟡 |
| B-12 | CAL-B-012 | setTimeScale | scale=NaN → totalDays += dt * NaN = NaN | L278 | ❌ **P0** | 🔴 |
| B-13 | CAL-B-013 | setTimeScale | scale=负数 → 时间倒流 | L278 | ❌ **P0** | 🔴 |
| B-14 | CAL-B-014 | setTimeScale | scale=Infinity → totalDays瞬间Infinity | L278 | ❌ **P1** | 🟡 |
| B-15 | CAL-B-015 | toChineseNumber | n=0 → CN_DIGITS[0]="零" | L402 | ❌ **P1** | 🟡 |
| B-16 | CAL-B-016 | toChineseNumber | n=NaN → CN_DIGITS[NaN]=undefined | L402 | ❌ **P0** | 🔴 |
| B-17 | CAL-B-017 | toChineseNumber | n=负数 → 数组越界 | L402 | ❌ **P1** | 🟡 |
| B-18 | CAL-B-018 | toChineseDay | day=0 → `初零` (day从1开始，0不应出现) | L409 | ❌ **P1** | 🟡 |
| B-19 | CAL-B-019 | toChineseDay | day=NaN → CN_DIGITS[NaN]=undefined | L409 | ❌ **P0** | 🔴 |
| B-20 | CAL-B-020 | toChineseDay | day=31 → 超过30天范围 | L409 | ❌ **P1** | 🟡 |

### F-Serialize: 序列化/反序列化节点

| # | 节点ID | API | 分支条件 | 行号 | covered | P0/P1 |
|---|--------|-----|---------|------|---------|-------|
| S-01 | CAL-S-001 | serialize | totalDays=NaN → 存档中totalDays为NaN | L306 | ❌ **P0** | 🔴 |
| S-02 | CAL-S-002 | serialize | totalDays=Infinity → 存档中totalDays为Infinity | L306 | ❌ **P1** | 🟡 |
| S-03 | CAL-S-003 | deserialize | data=null → 崩溃 | L313 | ❌ **P0** | 🔴 |
| S-04 | CAL-S-004 | deserialize | data=undefined → 崩溃 | L313 | ❌ **P0** | 🔴 |
| S-05 | CAL-S-005 | deserialize | data.totalDays=NaN → typeof NaN === 'number' → **NaN被接受** | L320 | ❌ **P0** | 🔴 |
| S-06 | CAL-S-006 | deserialize | data.totalDays=负数 → 负数被接受 | L320 | ❌ **P1** | 🟡 |
| S-07 | CAL-S-007 | deserialize | data.totalDays=Infinity → Infinity被接受 | L320 | ❌ **P1** | 🟡 |
| S-08 | CAL-S-008 | deserialize | data.weather=无效字符串 → WEATHERS.includes → false → 跳过 | L323 | ✅ | — |
| S-09 | CAL-S-009 | deserialize | data.weather=undefined → typeof !== 'string' → 跳过 | L323 | ✅ | — |
| S-10 | CAL-S-010 | deserialize | data.version不匹配 → 仅warn不拒绝 | L315-318 | ✅ | — |
| S-11 | CAL-S-011 | deserialize | **缺少timeScale恢复** — serialize不保存timeScale | L302-335 | ❌ **P0** | 🔴 |
| S-12 | CAL-S-012 | deserialize | **缺少weatherDuration恢复** — serialize不保存weatherDuration | L302-335 | ❌ **P1** | 🟡 |
| S-13 | CAL-S-013 | deserialize | **缺少lastIntegerDay重建验证** — 虽然有重建但依赖totalDays | L332-333 | ✅ | — |

### F-State: 状态机节点

| # | 节点ID | API | 分支条件 | 行号 | covered | P0/P1 |
|---|--------|-----|---------|------|---------|-------|
| T-01 | CAL-T-001 | pause/resume | 暂停后update不推进 | L130,287,291 | ✅ | — |
| T-02 | CAL-T-002 | reset | reset后timeScale回到DEFAULT | L177 | ✅ | — |
| T-03 | CAL-T-003 | init | deps=null时emitDayChanged静默返回 | L353 | ✅ | — |
| T-04 | CAL-T-004 | init | deps=null时checkSeasonChange静默返回 | L363 | ✅ | — |
| T-05 | CAL-T-005 | init | deps=null时emitWeatherChanged静默返回 | L393 | ✅ | — |
| T-06 | CAL-T-006 | init | **init未调用时update仍可运行** — 无guard | L129 | ❌ **P1** | 🟡 |

### F-Cross: 跨系统链路

| # | 节点ID | 链路 | 描述 | covered | P0/P1 |
|---|--------|------|------|---------|-------|
| X-01 | CAL-X-001 | Calendar → SocialEvents.CALENDAR_DAY_CHANGED | 日期变化事件发射 | ✅ calendar-advanced.test.ts:L84 | — |
| X-02 | CAL-X-002 | Calendar → SocialEvents.CALENDAR_SEASON_CHANGED | 季节变化事件发射 | ✅ calendar-advanced.test.ts:L100 | — |
| X-03 | CAL-X-003 | Calendar → MapEvents.WEATHER_CHANGED | 天气变化事件发射 | ✅ calendar-advanced.test.ts:L108 | — |
| X-04 | CAL-X-004 | Calendar → EventBus (deps=null) | 未初始化时事件静默丢弃 | ✅ CalendarSystem.test.ts | — |
| X-05 | CAL-X-005 | Calendar → Resource系统 (间接) | 季节加成查询接口 | ✅ getSeasonBonus | — |
| X-06 | CAL-X-006 | **Engine.save → Calendar.serialize** | 存档是否包含calendar | ❌ 需验证engine-save调用 | 🟡 |
| X-07 | CAL-X-007 | **Engine.load → Calendar.deserialize** | 读档是否恢复calendar | ❌ 需验证engine-load调用 | 🟡 |
| X-08 | CAL-X-008 | **Calendar → integration:garrison-production** | 已有集成测试 | ✅ garrison-production.integration.test.ts | — |

## 配置交叉验证

| # | 验证项 | 预期 | 实际 | 状态 |
|---|--------|------|------|------|
| C-01 | SEASONS.length vs SEASON_MONTH_MAP keys | 4 vs 12 | 4 vs 12 | ✅ |
| C-02 | WEATHERS.length vs WEATHER_WEIGHTS keys | 4 vs 4 | 4 vs 4 | ✅ |
| C-03 | WEATHER_WEIGHTS 总和 | 100 | 55+20+10+15=100 | ✅ |
| C-04 | ERA_TABLE 覆盖范围 | 1-64 无间断 | 1-64 连续 | ✅ |
| C-05 | ERA_TABLE 最后一项 endYear | 有限值 | 64（非Infinity） | ✅ |
| C-06 | DAYS_PER_MONTH * MONTHS_PER_YEAR = DAYS_PER_YEAR | 360 | 30*12=360 | ✅ |
| C-07 | DAYS_PER_SEASON = DAYS_PER_YEAR / 4 | 90 | 360/4=90 | ✅ |
| C-08 | SEASON_BONUSES keys === SEASONS | 4 keys match | ✅ | ✅ |

## 特别关注项汇总（基于前序模块经验）

| # | 模式 | 严重度 | 影响范围 | 状态 |
|---|------|--------|---------|------|
| SP-1 | NaN绕过dt<=0检查（BR-01） | 🔴 P0 | update(dt=NaN) → totalDays=NaN → computeDate全NaN → formatDate崩溃 |
| SP-2 | setTimeScale无输入验证（BR-01） | 🔴 P0 | setTimeScale(NaN/负数/Infinity) → 时间系统完全失控 |
| SP-3 | serialize不保存timeScale（BR-14/15） | 🔴 P0 | 存档恢复后timeScale回到默认1.0，加速档位丢失 |
| SP-4 | deserialize接受NaN/Infinity（BR-02） | 🔴 P0 | data.totalDays=NaN通过typeof检查 → 系统状态全NaN |
| SP-5 | deserialize(null)崩溃（BR-10） | 🔴 P0 | data=null → 访问data.version崩溃 |
| SP-6 | computeDate(totalDays=NaN)全链污染 | 🔴 P0 | year/month/day/season/eraName/yearInEra全为NaN或异常 |
| SP-7 | toChineseNumber/toChineseDay NaN崩溃 | 🔴 P0 | formatDate内部CN_DIGITS[NaN]=undefined → 字符串含undefined |
| SP-8 | computeEra边界外行为 | 🟡 P1 | year>64沿用咸熙，yearInEra持续增长无上限 |

## Top 10 P0 Uncovered 节点

| # | 节点 | 子系统 | 描述 |
|---|------|--------|------|
| 1 | CAL-B-002 | CalendarSystem | update(dt=NaN)绕过`dt<=0`检查，NaN进入totalDays |
| 2 | CAL-B-012 | CalendarSystem | setTimeScale(NaN) → dt*NaN=NaN → 时间系统崩溃 |
| 3 | CAL-B-013 | CalendarSystem | setTimeScale(负数) → 时间倒流 |
| 4 | CAL-S-003 | CalendarSystem | deserialize(null) → 崩溃 |
| 5 | CAL-S-005 | CalendarSystem | deserialize({totalDays:NaN}) → NaN被接受 |
| 6 | CAL-S-011 | CalendarSystem | serialize不保存timeScale → 存档恢复后加速丢失 |
| 7 | CAL-B-005 | CalendarSystem | computeDate(NaN) → 全字段NaN |
| 8 | CAL-B-009 | CalendarSystem | computeEra(NaN) → 不匹配任何年号 |
| 9 | CAL-B-016 | CalendarSystem | toChineseNumber(NaN) → undefined |
| 10 | CAL-S-001 | CalendarSystem | serialize(totalDays=NaN) → 存档含NaN |

## 与前序模块对比

| 维度 | Hero R1 | Battle R1 | Calendar R1 |
|------|---------|-----------|-------------|
| 总节点数 | ~420 | 488 | 142 |
| API数 | ~60 | 95 | 25 |
| covered率 | ~72% | 74.8% | 69.0% |
| P0 uncovered | ~35 | 57 | 12 |
| 配置交叉问题 | 2 | 1 | 0 |
| NaN防护遗漏 | 6 | 5 | 5 (update/setTimeScale/deserialize/computeDate/toChineseNumber) |
| serialize缺失 | 6个子系统 | 3个子系统 | 1个字段(timeScale) |
| deserialize null崩溃 | 有 | 有 | 有 |

## 下一步建议

1. **SP-1 update NaN防护**：update入口添加 `!Number.isFinite(dt) || dt <= 0` 检查
2. **SP-2 setTimeScale验证**：添加 `!Number.isFinite(scale) || scale <= 0` 检查
3. **SP-3 serialize扩展**：添加 timeScale 和 weatherDuration 到 CalendarSaveData
4. **SP-4/5 deserialize加固**：null检查 + NaN/Infinity过滤
5. **SP-6 computeDate防护**：内部添加 Math.max(0, Math.floor(totalDays)) 保护
6. **SP-7 toChineseNumber防护**：添加 NaN/越界检查

---

*Calendar 模块 R1 Builder 树完成。模块体量小（4文件430行），但NaN防护和serialize完整性存在系统性缺陷，与前序模块（Hero/Battle）发现的问题模式高度一致。*
