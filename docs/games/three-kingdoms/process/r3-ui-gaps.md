# Round 3 — UI层缺失汇总

> **分析日期**: 2025-07-09
> **数据来源**: v10-review-r2.md, v16-review-r2.md, v9-review-r2.md
> **目的**: 仅记录缺失项，不做UI实现（UI补全作为Round 4专项任务）

---

## v10 兵强马壮 (P0: 7个UI组件缺失)

引擎层全部就绪，UI层严重滞后。

| # | 缺失UI组件 | 优先级 | 引擎状态 | 说明 |
|---|-----------|:------:|---------|------|
| 1 | 穿戴/卸下装备UI | P0 | `equipItem`/`unequipItem` 已实现 | 装备详情弹窗无"穿戴""卸下"按钮 |
| 2 | 定向锻造UI | P0 | `forgeType` 仅支持 basic/advanced | 缺少 `'targeted'` 类型选择 |
| 3 | 自动强化UI | P0 | `autoEnhance()` 引擎已实现 | UI 无自动强化入口 |
| 4 | 一键推荐UI | P0 | `EquipmentRecommendSystem` 完整 | 无推荐入口，5维评分未展示 |
| 5 | 套装效果UI | P0 | `EquipmentSetSystem` 完整 | 套装件数/激活效果无UI反馈 |
| 6 | 装备图鉴UI | P1 | `isCodexDiscovered()`/`getCodexEntry()` 已实现 | 无图鉴面板入口 |
| 7 | 品质筛选UI | P1 | 数据层支持 | 背包仅有部位筛选，无品质筛选 |

### v10 附带P1/P2缺失
- 保底计数器展示 (C7)
- 成功率展示 (D6)
- 强化费用展示 (D7)
- 一键强化 (D9)
- 强化转移 (D10)
- 批量分解 (B12)
- 0个 `data-testid` (E4)
- 0个 `aria-*` 属性 (H1)
- 无独立CSS文件 (H5)

---

## v16 传承有序 (P0: 6个UI组件缺失)

引擎层全面通过（PrestigeSystem 386行 + RebirthSystem 268行 + helpers 217行 + PrestigeShopSystem 226行），UI层完全空白。

| # | 缺失UI组件 | 优先级 | 引擎状态 | 说明 |
|---|-----------|:------:|---------|------|
| 1 | 声望面板UI | P0 | PrestigeSystem 完整 (28测试) | 无 `PrestigePanel.tsx` |
| 2 | 转生确认UI | P0 | RebirthSystem 完整 (38测试) | 无转生操作界面 |
| 3 | 收益模拟器UI | P0 | `simulateEarningsV16()` 完整 | 无模拟器可视化界面 |
| 4 | 声望商店UI | P0 | PrestigeShopSystem 完整 (28测试) | 无商店浏览/购买界面 |
| 5 | 设置面板UI | P0 | SettingsManager 480行 (38测试) | 无 `SettingsPanel.tsx` |
| 6 | 存档管理UI | P0 | SaveSlotManager+CloudSaveSystem 完整 | 无存档/云存档管理界面 |

### v16 附带P2缺失
- 无 `prestige.css` / `settings.css` 样式文件 (G7)
- 声望面板弹窗 UI (H8)
- 转生确认弹窗 UI (H9)
- 声望商店浏览/购买 UI (H10)
- 收益模拟器可视化 UI (H11)

---

## v9 闲云野鹤 (P1: 多个UI组件缺失)

| # | 缺失UI组件 | 优先级 | 说明 |
|---|-----------|:------:|------|
| 1 | 翻倍选项UI (广告/道具/VIP) | P1 | `getAvailableDoubles()` 未接入 |
| 2 | 加速道具使用UI | P1 | `boostItems` 数据未展示 |
| 3 | 预估面板组件 | P1 | `OfflineEstimateComponent` 不存在 |
| 4 | 衰减档位明细展示 | P1 | 5档 tierDetails 未展示 |
| 5 | 综合效率百分比 | P1 | overallEfficiency 未展示 |
| 6 | 离线贸易收益 | P2 | tradeSummary 未展示 |
| 7 | 效率曲线图 | P2 | `getEfficiencyCurve()` 无UI渲染 |
| 8 | 推荐下线时长 | P2 | recommendedHours 无UI展示 |

---

## 缺失统计

| 版本 | P0缺失 | P1缺失 | P2缺失 | 引擎就绪率 |
|------|:------:|:------:|:------:|:---------:|
| v10 兵强马壮 | 5 | 6 | 4 | ~95% |
| v16 传承有序 | 6 | 4 | 1 | 100% |
| v9 闲云野鹤 | 0 | 5 | 3 | ~90% |
| **合计** | **11** | **15** | **8** | — |

---

## 建议

1. **Round 4 专项**: UI补全工作量较大（34个缺失项），建议作为独立Round处理
2. **优先级排序**: 先补全 v16 的6个P0组件（引擎100%就绪，ROI最高），再处理v10
3. **模板复用**: v16的声望/转生/商店面板可参考现有 Tab 组件结构
4. **测试覆盖**: 补全UI时同步添加 `data-testid` 和 ARIA 属性
