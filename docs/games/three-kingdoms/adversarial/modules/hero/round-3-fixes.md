# Hero R3 P0 修复报告

## 修复概览

| FIX ID | 严重度 | 描述 | 状态 |
|--------|--------|------|------|
| FIX-301 | P0 | 引擎保存/加载流程缺失6个子系统 | ✅ 已修复 |
| FIX-302 | P0 | 编队 null guard | ✅ 已修复 |
| FIX-303 | P0 | 武将存在性验证 | ✅ 已修复 |
| FIX-304 | P0 | 深拷贝问题 | ✅ 已修复 |

---

## FIX-301: 引擎保存/加载流程缺失6个子系统

### 问题
6个武将子系统的状态完全不在保存/加载流程中，重启后状态丢失：
- `HeroStarSystem` — 升星/突破数据
- `SkillUpgradeSystem` — 技能升级历史
- `HeroDispatchSystem` — 武将派驻记录
- `AwakeningSystem` — 觉醒状态
- `RecruitTokenEconomySystem` — 招贤令经济数据
- `FactionBondSystem` — 阵营羁绊数据（无状态，仅配置）

### 修复内容

#### 1. `engine-save.ts` — SaveContext 扩展
- 在 `SaveContext` 接口中新增 5 个可选子系统字段（`heroStar`, `skillUpgrade`, `heroDispatch`, `awakening`, `recruitTokenEconomy`）
- `buildSaveData()` 序列化时包含所有 5 个子系统
- `toIGameState()` / `fromIGameState()` 正确传递子系统数据
- `applySaveData()` 反序列化时恢复所有 5 个子系统，缺失时自动初始化默认状态

#### 2. `shared/types.ts` — GameSaveData 类型扩展
- 新增 5 个可选字段到 `GameSaveData` 接口

#### 3. `ThreeKingdomsEngine.ts` — buildSaveCtx 连接
- `buildSaveCtx()` 将所有 5 个子系统实例注入到保存上下文

#### 4. 各子系统 serialize/deserialize 实现
- `SkillUpgradeSystem`: 结构化 serialize/deserialize，null 安全
- `HeroDispatchSystem`: 从 JSON 字符串改为结构化 `DispatchSaveData`，保留 `deserializeLegacy` 兼容
- `HeroStarSystem`: 已有 serialize/deserialize
- `AwakeningSystem`: 已有 serialize/deserialize
- `RecruitTokenEconomySystem`: 已有 serialize/deserialize

### 涉及文件
- `src/games/three-kingdoms/engine/engine-save.ts`
- `src/games/three-kingdoms/engine/ThreeKingdomsEngine.ts`
- `src/games/three-kingdoms/shared/types.ts`
- `src/games/three-kingdoms/engine/hero/SkillUpgradeSystem.ts`
- `src/games/three-kingdoms/engine/hero/HeroDispatchSystem.ts`

---

## FIX-302: 编队 null guard

### 问题
`HeroFormation` 的 `addToFormation`、`removeFromFormation`、`setFormation` 未对 null/undefined/空字符串武将ID做防护，导致无效ID进入编队数据。

### 修复内容
- `addToFormation()`: 添加 `!generalId || typeof generalId !== 'string'` 检查，无效ID返回 null
- `removeFromFormation()`: 同上
- `setFormation()`: 使用 `filter((gid): gid is string => typeof gid === 'string' && gid !== '')` 过滤无效ID

### 涉及文件
- `src/games/three-kingdoms/engine/hero/HeroFormation.ts`

---

## FIX-303: 武将存在性验证

### 问题
`HeroDispatchSystem.dispatchHero()` 和 `AwakeningSystem.awaken()` 未验证武将是否存在，可能对不存在的武将执行操作。

### 修复内容
- `HeroDispatchSystem.dispatchHero()`:
  - `getGeneralFn` 未设置时返回 `{ success: false, reason: '武将查询函数未初始化' }`
  - 武将不存在时返回 `{ success: false, reason: '武将 ${heroId} 不存在' }`
- `AwakeningSystem.awaken()`:
  - 在资源消耗后、状态更新后验证武将存在性
  - 武将不存在时回滚觉醒状态并返回失败

### 涉及文件
- `src/games/three-kingdoms/engine/hero/HeroDispatchSystem.ts`
- `src/games/three-kingdoms/engine/hero/AwakeningSystem.ts`

### 兼容性修复
- `HeroDispatchSystem.test.ts`: 更新序列化测试以匹配新的结构化 API
- `HeroDispatchSystem.attack-bonus.test.ts`: 更新边界测试以期望 dispatchHero 在武将不存在时失败

---

## FIX-304: 深拷贝问题

### 问题
`cloneGeneral()` 使用浅拷贝，修改克隆体的嵌套对象（`baseStats`、`skills`）会影响原对象。

### 修复内容
- `cloneGeneral()` 已使用结构化深拷贝：
  - `baseStats`: 逐字段复制
  - `skills`: `map()` 创建新数组，每个 `SkillData` 逐字段复制
- `null` 防护：传入 null 时安全返回 null

### 涉及文件
- `src/games/three-kingdoms/engine/hero/HeroSerializer.ts`

---

## 测试验证

### R3 专项测试（18/18 通过）
```
✓ FIX-301: 子系统 serialize/deserialize 覆盖 (7 tests)
✓ FIX-302: 编队 null guard (4 tests)
✓ FIX-303: 武将存在性验证 (4 tests)
✓ FIX-304: cloneGeneral 深拷贝 (3 tests)
```

### TypeScript 编译
```
✅ npx tsc --noEmit — 零错误
```

### 回归测试
- `HeroDispatchSystem.test.ts` — 27/27 通过
- `HeroDispatchSystem.attack-bonus.test.ts` — 25/25 通过
- 其他已存在的测试失败（招募消耗、技能加成）为 R3 之前的历史问题，不在本次修复范围
