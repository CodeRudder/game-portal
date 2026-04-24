# v19.0 天下一统(上) — 测试检查清单

> **日期**: 2026-04-24  
> **版本**: v19.0  
> **测试框架**: Vitest  
> **测试文件**: 3 | **用例总数**: 59 | **全部通过**: ✅

---

## §1 音效系统统一

| # | 用例 | 状态 |
|---|------|------|
| 1 | BGM通道: bgmSwitch=false → 静音 | ✅ |
| 2 | SFX通道: masterSwitch 控制开关 | ✅ |
| 3 | Voice通道: voiceSwitch=false → 静音 | ✅ |
| 4 | Battle通道: battleSfxSwitch=false → 静音 | ✅ |
| 5 | 4通道音量互不干扰 | ✅ |
| 6 | 主音量公式: bgm×master = 0.4 | ✅ |
| 7 | masterVolume=0 → 全静音 | ✅ |
| 8 | masterVolume=100, bgmVolume=100 → 1.0 | ✅ |
| 9 | calculateOutput 返回 0~100 范围 | ✅ |
| 10 | getRawVolume 不受特殊场景影响 | ✅ |
| 11 | 后台: enterBackground → BGM fade 至 0 | ✅ |
| 12 | 来电: handleInterruption → 全通道静音 | ✅ |
| 13 | 来电恢复: handleInterruptionEnd → 渐入 | ✅ |
| 14 | 低电量: BGM 音量降低 50% | ✅ |
| 15 | 低电量不影响 SFX/Voice/Battle | ✅ |
| 16 | setScene(Background) 自动触发后台 | ✅ |
| 17 | setScene(Normal) 从后台/来电恢复 | ✅ |
| 18 | 首次启动 BGM 延迟 firstLaunchDelayMs | ✅ |
| 19 | 非首次启动立即播放 | ✅ |
| 20 | 重复播放同一 BGM 不触发重复 | ✅ |
| 21 | stopBGM 清除延迟定时器 | ✅ |

**文件**: `engine/settings/__tests__/integration/settings-audio.integration.test.ts`

---

## §2 画质管理

| # | 用例 | 状态 |
|---|------|------|
| 1 | 低画质: 全关, 帧率30 | ✅ |
| 2 | 中画质: 粒子/水墨开, 帧率60 | ✅ |
| 3 | 高画质: 全开, 帧率60 | ✅ |
| 4 | 自动模式: 根据设备能力选择 | ✅ |
| 5 | 切换预设 preset 正确反映 | ✅ |
| 6 | 低端设备(2核/2GB) → 低画质 | ✅ |
| 7 | 中端设备(4核/4GB) → 中画质 | ✅ |
| 8 | 高端设备(8核/8GB) → 高画质 | ✅ |
| 9 | 边界: 6核/6GB → 中画质 | ✅ |
| 10 | isLowQuality / isHighQuality 一致 | ✅ |
| 11 | setAdvancedOption 单独关闭粒子 | ✅ |
| 12 | updateAdvancedOptions 批量修改 | ✅ |
| 13 | 低画质隐藏高级选项 | ✅ |
| 14 | 切换预设重置高级选项 | ✅ |
| 15 | onChange 回调在预设切换时触发 | ✅ |
| 16 | INK_WASH_TRANSITION_DURATION = 600ms | ✅ |
| 17 | playInkWashTransition 调用播放器 | ✅ |
| 18 | 水墨过渡回调触发 | ✅ |
| 19 | getInkWashDuration 返回 600ms | ✅ |
| 20 | 过渡动画缓动配置合理 | ✅ |

**文件**: `engine/settings/__tests__/integration/settings-graphics.integration.test.ts`

---

## §3 统一系统

| # | 用例 | 状态 |
|---|------|------|
| 1 | validateAll 生成完整报告 | ✅ |
| 2 | validateResourceBalance 资源产出验证 | ✅ |
| 3 | validateHeroBalance 武将战力验证 | ✅ |
| 4 | validateBattleDifficulty 战斗难度曲线 | ✅ |
| 5 | validateEconomy 经济系统验证 | ✅ |
| 6 | getLastReport 缓存报告 | ✅ |
| 7 | makeStep: checkFn=true → passed | ✅ |
| 8 | makeStep: checkFn=false → 含错误前缀 | ✅ |
| 9 | makeStep: 抛异常 → 含异常信息 | ✅ |
| 10 | INK_WASH_TRANSITION_DURATION = 600ms | ✅ |
| 11 | 动画开关关闭 → playInkWashTransition 不执行 | ✅ |
| 12 | getPresetConfig 返回各预设完整配置 | ✅ |
| 13 | 跨系统同时初始化 (BV+GM+AM) | ✅ |
| 14 | BalanceValidator reset 清除报告 | ✅ |
| 15 | GraphicsManager reset 恢复 Auto | ✅ |
| 16 | setResourceConfigs 自定义配置 | ✅ |
| 17 | setHeroBaseStats 自定义武将属性 | ✅ |
| 18 | summary 含 pass/warning/fail 计数 | ✅ |

**文件**: `engine/unification/__tests__/integration/unification-balance.integration.test.ts`

---

## 封版验证

| 项目 | 结果 |
|------|------|
| 测试文件数 | 3 |
| 用例总数 | 59 |
| 通过率 | 100% |
| 构建状态 | 待验证 |

---

*检查清单生成时间: 2026-04-24*
