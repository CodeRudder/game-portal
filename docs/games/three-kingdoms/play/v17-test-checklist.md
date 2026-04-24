# v17.0 竖屏适配 — 集成测试检查清单

> 日期：2026-04-24
> 版本：v17.0
> 测试框架：Vitest 1.6.1 + jsdom

---

## §1 竖屏布局 — `responsive-layout.integration.test.ts`

| # | 用例 | 状态 |
|---|------|------|
| 1 | DesktopL 断点 (≥1920px) | ✅ |
| 2 | Desktop 断点 (≥1280px) | ✅ |
| 3 | TabletL 断点 (≥1024px) | ✅ |
| 4 | Tablet 断点 (≥768px) | ✅ |
| 5 | MobileL 断点 (≥428px) | ✅ |
| 6 | Mobile 断点 (≥375px) | ✅ |
| 7 | MobileS 断点 (<375px) | ✅ |
| 8 | updateViewport 断点变化返回 true | ✅ |
| 9 | updateViewport 同断点返回 false | ✅ |
| 10 | 静态方法断点分类 | ✅ |
| 11 | getAllBreakpoints 返回7级 | ✅ |
| 12 | 桌面端等比缩放 + SCALE_MAX | ✅ |
| 13 | 桌面端 CenterDecorated 留白策略 | ✅ |
| 14 | 平板端 CenterFilled 留白策略 | ✅ |
| 15 | 移动端 scale=1 画布=视口 | ✅ |
| 16 | offsetX/offsetY 居中画布 | ✅ |
| 17 | calculateWhitespace 左右留白 | ✅ |
| 18 | 画布=视口时留白为0 | ✅ |
| 19 | 左手模式镜像留白 | ✅ |
| 20 | 非左手模式不变 | ✅ |
| 21 | calculateMobileSceneHeight 扣除区域 | ✅ |
| 22 | getMobileLayoutState 完整状态 | ✅ |
| 23 | 场景高度不为负 | ✅ |
| 24 | 默认5个Tab activeTabId=home | ✅ |
| 25 | switchTab 切换+通知 | ✅ |
| 26 | switchTab 不存在tabId返回false | ✅ |
| 27 | setTabs 替换Tab列表 | ✅ |
| 28 | openFullScreenPanel + 导航深度 | ✅ |
| 29 | closeFullScreenPanel - 导航深度 | ✅ |
| 30 | openBottomSheet 内容高度+把手 | ✅ |
| 31 | closeBottomSheet 重置状态 | ✅ |
| 32 | 竖屏 orientation=portrait | ✅ |
| 33 | 横屏 orientation=landscape | ✅ |
| 34 | 横竖屏切换布局通知 | ✅ |
| 35 | getSnapshot 完整快照 | ✅ |
| 36 | setFontSize 更新+通知 | ✅ |
| 37 | ISubsystem 接口 init/getState | ✅ |
| 38 | reset 恢复默认 | ✅ |

---

## §2 触控交互 — `touch-input.integration.test.ts`

| # | 用例 | 状态 |
|---|------|------|
| 1 | Tap 快速点击识别 | ✅ |
| 2 | LongPress >500ms 识别 | ✅ |
| 3 | Drag 超阈值距离识别 | ✅ |
| 4 | SwipeLeft 左滑>80px 识别 | ✅ |
| 5 | PullDown 下拉>60px 识别 | ✅ |
| 6 | Pinch 双指缩放识别 | ✅ |
| 7 | DoubleTap 两次快速点击 | ✅ |
| 8 | 长按后移动取消手势 | ✅ |
| 9 | 触控区域 ≥44px 验证通过 | ✅ |
| 10 | 触控区域 <44px 验证不通过 | ✅ |
| 11 | expandTouchTarget 扩展至44px | ✅ |
| 12 | 防误触冷却期阻止连续点击 | ✅ |
| 13 | setFeedbackConfig 更新配置 | ✅ |
| 14 | SelectHero 选中武将 | ✅ |
| 15 | DeployToSlot 部署选中武将 | ✅ |
| 16 | DeployToSlot 未选中返回null | ✅ |
| 17 | RemoveFromSlot 移除事件 | ✅ |
| 18 | SwapSlots 交换槽位 | ✅ |
| 19 | SwapSlots 缺少参数返回null | ✅ |
| 20 | clearFormationSelection 清除 | ✅ |
| 21 | 默认态 phase=idle | ✅ |
| 22 | 按下态 phase=started | ✅ |
| 23 | 移动态 phase=moved | ✅ |
| 24 | 松开态 phase=idle | ✅ |
| 25 | 禁用态 FeedbackType.None | ✅ |
| 26 | handleDesktopInteraction 分发 | ✅ |
| 27 | handleKeyDown 匹配快捷键 | ✅ |
| 28 | handleKeyDown 未匹配返回null | ✅ |
| 29 | 事件取消订阅生效 | ✅ |
| 30 | TouchInteractionSystem isTouchTargetHit | ✅ |
| 31 | TouchInteractionSystem 编队流程 | ✅ |
| 32 | TouchInteractionSystem handleKeyPress | ✅ |
| 33 | TouchInteractionSystem getVisualScale | ✅ |
| 34 | ISubsystem init/getState | ✅ |
| 35 | reset 清除状态和监听器 | ✅ |

---

## §3 移动端UI设置 — `mobile-settings.integration.test.ts`

| # | 用例 | 状态 |
|---|------|------|
| 1 | 默认省电关闭 60fps | ✅ |
| 2 | 手动开启省电 30fps | ✅ |
| 3 | 手动关闭省电恢复 | ✅ |
| 4 | 自动模式 低电量激活 | ✅ |
| 5 | 自动模式 充电中不激活 | ✅ |
| 6 | 自动模式 电量恢复关闭 | ✅ |
| 7 | 省电激活禁用粒子阴影 | ✅ |
| 8 | 省电关闭粒子阴影正常 | ✅ |
| 9 | 省电状态变更通知监听器 | ✅ |
| 10 | 电量值 clamp 0-100 | ✅ |
| 11 | setPowerSaveConfig 更新配置 | ✅ |
| 12 | 字体大小默认 Medium | ✅ |
| 13 | setFontSize 切换档位 | ✅ |
| 14 | FONT_SIZE_MAP 三档递增 | ✅ |
| 15 | 屏幕常亮默认关闭 | ✅ |
| 16 | setScreenAlwaysOn 设置 | ✅ |
| 17 | 屏幕常亮仅游戏内生效 | ✅ |
| 18 | getSettingsState 完整快照 | ✅ |
| 19 | 省电+画质联动-开启 | ✅ |
| 20 | 省电+画质联动-关闭恢复 | ✅ |
| 21 | 省电+字体独立设置 | ✅ |
| 22 | 省电不影响屏幕常亮 | ✅ |
| 23 | getSettingsState 属性完整性 | ✅ |
| 24 | PowerSaveSystem enable/disable | ✅ |
| 25 | PowerSaveSystem 自动模式低电量 | ✅ |
| 26 | PowerSaveSystem 自动模式充电中 | ✅ |
| 27 | PowerSaveSystem 粒子/阴影查询 | ✅ |
| 28 | PowerSaveSystem getFrameInterval | ✅ |
| 29 | PowerSaveSystem shouldSkipFrame | ✅ |
| 30 | PowerSaveSystem toggleScreenAlwaysOn | ✅ |
| 31 | PowerSaveSystem updateConfig 重评估 | ✅ |
| 32 | PowerSaveSystem 状态变更通知 | ✅ |
| 33 | PowerSaveSystem reset 恢复默认 | ✅ |
| 34 | 跨系统 字体大小同步 | ✅ |
| 35 | 跨系统 省电不影响断点 | ✅ |
| 36 | 跨系统 ISubsystem 接口 | ✅ |
| 37 | MobileSettingsSystem reset | ✅ |

---

## 测试统计

| 文件 | 用例数 | 通过 | 失败 |
|------|--------|------|------|
| responsive-layout.integration.test.ts | 38 | 38 | 0 |
| touch-input.integration.test.ts | 35 | 35 | 0 |
| mobile-settings.integration.test.ts | 37 | 37 | 0 |
| **合计** | **110** | **110** | **0** |

---

## 封版确认

- [x] 全部 110 用例通过
- [x] 无 `it.skip` 遗留
- [x] 构建通过 (`pnpm run build`)
- [x] 覆盖 §1/§2/§3 全部需求点
