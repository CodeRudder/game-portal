# Round 10 — Settings 文件监控 + 全局代码质量扫描报告

> **扫描时间**: Round 10  
> **扫描范围**: `src/games/three-kingdoms/engine/` 全部引擎层代码  
> **引擎规模**: 259 个非测试 TS 文件，66,315 行代码，167 个测试文件

---

## 一、Part A: Settings 模块大文件监控

### 1.1 文件行数排名

| 文件 | 行数 | 状态 |
|------|------|------|
| `SettingsManager.ts` | 480 | ✅ ≤500 |
| `AnimationController.ts` | 476 | ✅ ≤500 |
| `AudioManager.ts` | 475 | ✅ ≤500 |
| `AccountSystem.ts` | 466 | ✅ ≤500 |
| `SaveSlotManager.ts` | 451 | ✅ ≤500 |
| `CloudSaveSystem.ts` | 406 | ✅ ≤500 |
| `GraphicsManager.ts` | 336 | ✅ ≤500 |
| `account.types.ts` | 99 | ✅ |
| `cloud-save.types.ts` | 97 | ✅ |
| `save-slot.types.ts` | 62 | ✅ |
| `index.ts` | 72 | ✅ |

### 1.2 450+ 行文件拆分可行性分析

#### SettingsManager.ts (480 行)
- **方法数**: 5 个 private + public 方法（`applyUpdate`, `notifyListeners`, `loadFromStorage`, `saveToStorage`, `clampVolume`, `createDefaultStorage`）
- **职责**: 设置的 CRUD、持久化、事件通知
- **评估**: 结构紧凑，5 个私有方法都是核心基础设施，无独立可拆分的职责域
- **结论**: ✅ **合理设计，无需拆分**

#### AnimationController.ts (476 行)
- **方法数**: 6 个 private 方法 + 多个 public 方法
- **职责**: 动画播放管理、过渡配置、状态动画、反馈动画
- **评估**: 3 个 `getDefault*Config` 方法（过渡/状态/反馈）可以考虑提取为配置工厂，但仅节省约 50 行，拆分收益低
- **结论**: ✅ **合理设计，无需拆分**

#### AudioManager.ts (475 行)
- **方法数**: 8 个 private 方法
- **职责**: BGM 播放、音量控制、通道管理、设置变更检测
- **评估**: `detectVolumeChanges` + `detectSwitchChanges` 可提取为变更检测器，但与主类耦合紧密
- **结论**: ✅ **合理设计，无需拆分**

#### AccountSystem.ts (466 行)
- **方法数**: 1 个 private 方法（`notifyListeners`）
- **评估**: 高度内聚，方法少但单方法体较长（业务逻辑密集）
- **结论**: ✅ **合理设计，无需拆分**

#### SaveSlotManager.ts (451 行)
- **方法数**: 6 个 private 方法
- **评估**: 槽位管理、加解密、持久化紧密耦合，拆分会破坏封装
- **结论**: ✅ **合理设计，无需拆分**

---

## 二、Part B: 全局代码质量扫描

### 2.1 活跃文件行数扫描（≤500 行验证）

| 检查项 | 结果 |
|--------|------|
| **超标文件数** | **0** |
| **最接近阈值** | `ArenaSystem.ts` / `StoryEventPlayer.ts` — 499 行 |
| **判定** | ✅ **通过** |

Top 5 接近阈值的文件（需持续监控）：

| 文件 | 行数 | 距阈值 |
|------|------|--------|
| `pvp/ArenaSystem.ts` | 499 | 1 行 |
| `guide/StoryEventPlayer.ts` | 499 | 1 行 |
| `npc/NPCPatrolSystem.ts` | 496 | 4 行 |
| `quest/QuestSystem.ts` | 495 | 5 行 |
| `tech/TechLinkSystem.ts` | 489 | 11 行 |

> ⚠️ **预警**: `ArenaSystem.ts` 和 `StoryEventPlayer.ts` 仅差 1 行即触线，后续迭代需严格监控。

### 2.2 `as any` 扫描（引擎层零容忍）

| 检查项 | 结果 |
|--------|------|
| **`as any` 数量** | **0** |
| **判定** | ✅ **通过** |

引擎层零 `as any` 强制转换，类型安全达标。

### 2.3 `: any` 类型注解扫描

| 检查项 | 结果 |
|--------|------|
| **`: any` 数量** | **5 处** |
| **settings 模块** | **0 处** |
| **判定** | ⚠️ **需关注** |

残留位置：

| 文件 | 行号 | 用途 | 风险 |
|------|------|------|------|
| `NPCPatrolSystem.ts` | 472 | `getNPCSystem(): any` — 内部跨系统引用 | 低 |
| `engine-campaign-deps.ts` | 128 | 战役依赖注入参数类型 | 中 |
| `engine-getters.ts` | 99 | `applyGetters(cls: any)` — 泛型工具函数 | 低 |
| `ThreeKingdomsEngine.ts` | 304-305 | EventEmitter `on()` 重载签名 | 低 |

> 建议: 这 5 处 `: any` 属于框架边界代码，可后续用泛型收窄，不阻塞当前迭代。

### 2.4 Jest 残留扫描

| 检查项 | 结果 |
|--------|------|
| **jest 残留** | **0** |
| **判定** | ✅ **通过** |

所有测试文件已完全迁移至 Vitest，无 `jest.*` API 残留。

### 2.5 `@deprecated` 残留扫描

| 检查项 | 结果 |
|--------|------|
| **@deprecated 数量** | **0** |
| **判定** | ✅ **通过** |

引擎层无废弃 API 标记，接口整洁。

### 2.6 废弃文件扫描

| 检查项 | 结果 |
|--------|------|
| **`.bak/.old/.tmp` 文件** | **0** |
| **孤立 `exports-v*.ts`** | **2 个** |
| **判定** | ⚠️ **需清理** |

发现的废弃文件：

| 文件 | 行数 | 引用情况 |
|------|------|----------|
| `engine/exports-v9.ts` | 88 | ❌ 无任何引用 |
| `engine/exports-v12.ts` | 114 | ❌ 无任何引用 |

> **分析**: 这两个文件是历史版本迭代时从 `index.ts` 拆分出的导出桶文件。当前 `index.ts` 已通过域子目录的 `index.ts` 直接 `export *` 完成导出，不再依赖 `exports-v*` 文件。这两个文件可安全删除。

### 2.7 `data-testid` 覆盖率统计

| 检查项 | 结果 |
|--------|------|
| **总 TSX 文件** | **89** |
| **已覆盖** | **68** |
| **覆盖率** | **76.4%** |
| **判定** | ⚠️ **需提升** |

21 个未覆盖文件集中在 `src/components/idle/` 目录：

| 类别 | 未覆盖文件数 | 示例 |
|------|-------------|------|
| Pixi 游戏组件 | 8 | `TotalWarPixiGame.tsx`, `CivChinaPixiGame.tsx` 等 |
| 功能面板 | 4 | `BuildingPanel.tsx`, `IdleUpgradePanel.tsx` 等 |
| 图标组件 | 5 | `CombatIcons.tsx`, `ResourceIcons.tsx` 等 |
| 其他 | 4 | `IdleGamePlayer.tsx`, `IdleSaveManager.tsx` 等 |

> **注意**: `src/games/three-kingdoms/ui/` 目录下的 TSX 文件覆盖率需单独确认。idle 组件多为游戏画布封装，部分组件（如 Pixi 画布）可能不需要 data-testid。

### 2.8 `console.*` 调用扫描

| 检查项 | 结果 |
|--------|------|
| **console.warn** | ~10 处（存档版本不匹配警告） |
| **console.error** | ~3 处（加载失败日志） |
| **console.log** | 0 处（仅注释中出现） |
| **判定** | ✅ **合理** |

所有 `console.warn/error` 均用于存档版本不匹配和数据加载失败的防御性日志，属于合理的运行时诊断。无调试用 `console.log` 残留。

### 2.9 安全扫描补充

| 检查项 | 结果 |
|--------|------|
| **`eval()` / `new Function()`** | **0** ✅ |
| **`@deprecated`** | **0** ✅ |
| **`TODO/FIXME/HACK`** | **0** ✅ |
| **TypeScript strict mode** | **已开启** ✅ |

---

## 三、问题清单与修复优先级

### 🔴 P0 — 必须修复（阻塞质量门禁）

无。所有核心指标达标。

### 🟡 P1 — 建议修复（本轮或下轮处理）

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 1 | 孤立文件 `exports-v9.ts` / `exports-v12.ts` | 死代码增加维护负担 | 删除这两个文件 |
| 2 | `data-testid` 覆盖率 76.4% | 测试可靠性不足 | 对关键交互组件补充 data-testid |

### 🟢 P2 — 持续监控

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 3 | `ArenaSystem.ts` / `StoryEventPlayer.ts` 499 行 | 随时可能超 500 行阈值 | 每轮迭代后检查行数 |
| 4 | 5 处 `: any` 类型注解 | 类型安全不完美 | 后续用泛型收窄 |
| 5 | Settings 模块 5 个文件 450-480 行 | 接近拆分阈值 | 持续监控，若超 500 再拆分 |

---

## 四、总结

| 维度 | 评分 | 说明 |
|------|------|------|
| **文件行数控制** | ⭐⭐⭐⭐⭐ | 全部 ≤500 行，0 超标 |
| **类型安全** | ⭐⭐⭐⭐½ | `as any` 零残留，5 处 `: any` 为边界代码 |
| **测试迁移** | ⭐⭐⭐⭐⭐ | Jest 完全清除，Vitest 100% |
| **代码整洁** | ⭐⭐⭐⭐½ | 2 个孤立废弃文件待清理 |
| **测试可访问性** | ⭐⭐⭐⭐ | data-testid 76.4%，需提升 |
| **安全合规** | ⭐⭐⭐⭐⭐ | 无 eval、无 TODO/FIXME、strict 模式 |

**整体评价**: 引擎层代码质量优秀，核心指标全部达标。唯一需要行动的是清理 2 个孤立 exports 文件和提升 data-testid 覆盖率。
