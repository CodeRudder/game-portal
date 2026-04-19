# Solitaire 纸牌接龙 — 测试覆盖分析报告

> 分析日期：2025-07-10  
> 测试文件：`src/games/solitaire/__tests__/SolitaireEngine.test.ts`  
> 引擎文件：`src/games/solitaire/SolitaireEngine.ts`  
> 常量文件：`src/games/solitaire/constants.ts`

---

## 一、现有测试清单

现有测试共 **15 个 describe 块**，约 **95 个 it 用例**。以下按模块列出：

### 1. 初始化（12 个用例）
| # | 用例名 | 覆盖内容 |
|---|--------|----------|
| 1 | 应正确创建引擎实例 | `new SolitaireEngine()` 实例化 |
| 2 | 初始状态应为 idle | `status === 'idle'` |
| 3 | 初始分数应为 0 | `score === 0` |
| 4 | 初始等级应为 1 | `level === 1` |
| 5 | 初始移动次数应为 0 | `moves === 0` |
| 6 | 初始不应胜利 | `isWin === false` |
| 7 | 初始光标在 stock | `cursorArea/Col/Row` |
| 8 | 初始选择为空 | `selection === null` |
| 9 | 初始 stock 为空 | `stock.length === 0` |
| 10 | 初始 waste 为空 | `waste.length === 0` |
| 11 | 初始 foundation 各列为空 | `foundations` 4 列空 |
| 12 | 初始 tableau 各列为空 | `tableau` 7 列空 |

### 2. 游戏生命周期（13 个用例）
| # | 用例名 | 覆盖方法/场景 |
|---|--------|-------------|
| 1 | start 后状态变为 playing | `start()` |
| 2 | start 后 stock 剩余 24 张 | `start()` → 牌数验证 |
| 3 | start 后 waste 为空 | `start()` |
| 4 | start 后 foundation 各列为空 | `start()` |
| 5 | start 后 tableau 有 7 列 | `start()` |
| 6 | start 后 tableau 各列长度为 i+1 | `dealCards()` |
| 7 | start 后每列最上面一张面朝上 | `dealCards()` |
| 8 | start 后非顶部牌面朝下 | `dealCards()` |
| 9 | start 后总牌数为 52 | 牌数守恒 |
| 10 | start 后分数重置为 0 | `start()` |
| 11 | pause 后状态变为 paused | `pause()` |
| 12 | resume 后状态恢复为 playing | `resume()` |
| 13 | reset 后状态变为 idle | `reset()` |
| 14 | reset 后所有区域清空 | `reset()` |
| 15 | destroy 后状态变为 idle | `destroy()` |

### 3. 发牌（4 个用例）
| # | 用例名 | 覆盖内容 |
|---|--------|----------|
| 1 | 每张牌有合法的花色 | 花色校验 |
| 2 | 每张牌有合法的面值 | 面值校验 |
| 3 | 52 张牌无重复 | 唯一性校验 |
| 4 | 每次 start 洗牌不同（大概率） | 随机性 |

### 4. Stock 翻牌（9 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | 从 stock 翻一张到 waste | `drawFromStock()` |
| 2 | 翻出的牌面朝上 | `drawFromStock()` |
| 3 | 翻牌增加移动次数 | `drawFromStock()` → `moves` |
| 4 | 翻牌增加分数 | `drawFromStock()` → `score` |
| 5 | 连续翻多张 | `drawFromStock()` 连续调用 |
| 6 | stock 空时回收 waste | `drawFromStock()` 回收逻辑 |
| 7 | 回收后所有牌面朝下 | 回收后 `faceUp` 状态 |
| 8 | stock 和 waste 都为空时翻牌无效果 | 空状态边界 |
| 9 | 空格键在 stock 区域翻牌 | `handleKeyDown(' ')` → stock |

### 5. 选择机制（9 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | Enter 在 waste 拾取牌 | `handleKeyDown('Enter')` → waste |
| 2 | Enter 在空 waste 不拾取 | 空区域边界 |
| 3 | Enter 在 foundation 拾取顶部牌 | `handleKeyDown('Enter')` → foundation |
| 4 | Enter 在空 foundation 不拾取 | 空区域边界 |
| 5 | Enter 在 tableau 拾取面朝上的牌 | `handleKeyDown('Enter')` → tableau |
| 6 | Enter 在 tableau 面朝下的牌不拾取 | `faceUp === false` 边界 |
| 7 | Enter 在空 tableau 不拾取 | 空列边界 |
| 8 | Escape 清除选择 | `handleKeyDown('Escape')` |
| 9 | 空格键有选择时取消选择 | `handleKeyDown(' ')` 取消 |

### 6. Foundation 放置规则（7 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | 只有 A 能放到空 foundation | `tryPlaceOnFoundation()` |
| 2 | 非 A 不能放到空 foundation | `tryPlaceOnFoundation()` |
| 3 | 同花色递增可放到 foundation | `tryPlaceOnFoundation()` |
| 4 | 不同花色不能放到 foundation | `tryPlaceOnFoundation()` |
| 5 | 不连续的牌不能放到 foundation | `tryPlaceOnFoundation()` |
| 6 | 放到 foundation 加分 | 计分逻辑 |
| 7 | 从 foundation 移回 foundation 加负分 | `SCORE_FOUNDATION_BACK` |
| 8 | 多张牌不能放到 foundation | 多牌限制 |

### 7. Tableau 放置规则（7 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | 只有 K 能放到空 tableau | `tryPlaceOnTableau()` |
| 2 | 非 K 不能放到空 tableau | `tryPlaceOnTableau()` |
| 3 | 异色递减可放到 tableau | `tryPlaceOnTableau()` |
| 4 | 同色不能放到 tableau | `tryPlaceOnTableau()` |
| 5 | 不连续不能放到 tableau | `tryPlaceOnTableau()` |
| 6 | 面朝下的顶牌不能放 | `faceUp` 检查 |
| 7 | 不能放到 waste | 目标区域限制 |
| 8 | 不能放到 stock | 目标区域限制 |

### 8. 翻牌与计分（4 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | 移动后翻开 tableau 面朝下的顶牌 | `flipTopTableauCard()` |
| 2 | 翻 tableau 牌加翻牌分 | 计分 |
| 3 | 成功放置增加移动次数 | `moves` |
| 4 | 放置失败不增加移动次数 | 失败边界 |

### 9. 胜利检测（3 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | 所有 52 张牌到 foundation 时胜利 | `checkWin()` |
| 2 | 未集齐 52 张不胜利 | `checkWin()` |
| 3 | 胜利后状态变为 gameover | `checkWin()` → `gameOver()` |

### 10. 键盘导航（23 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1-6 | ArrowRight 各区域导航 | `handleArrowRight()` |
| 7-12 | ArrowLeft 各区域导航 | `handleArrowLeft()` |
| 13-18 | ArrowDown/Up 各区域导航 | `handleArrowDown/Up()` |
| 19-20 | 数字键 1-7 选择 tableau 列 | `handleKeyDown('3'/'7')` |
| 21-23 | R 键重置/开始 | `handleKeyDown('r'/'R')` |

### 11. 胜利后键盘（2 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | 胜利后 R 键重新开始 | `handleKeyDown('r')` gameover |
| 2 | 胜利后非 R 键无效 | `handleKeyDown()` gameover |

### 12. 自动完成（6 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | stock 非空时不能自动完成 | `canAutoComplete()` |
| 2 | stock 空且所有牌面朝上时可以自动完成 | `canAutoComplete()` |
| 3 | stock 空但 waste 有牌也可以自动完成 | `canAutoComplete()` |
| 4 | tableau 有面朝下的牌不能自动完成 | `canAutoComplete()` |
| 5 | 自动完成运行中不能再次触发 | `tryAutoComplete()` |
| 6 | 自动完成逐步移动牌到 foundation | `autoCompleteStep()` |
| 7 | 自动完成完成后检测胜利 | `autoCompleteStep()` → `checkWin()` |

### 13. getState（4 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | 返回包含所有必要字段 | `getState()` 字段完整性 |
| 2 | idle 状态返回初始值 | `getState()` 初始值 |
| 3 | playing 状态反映当前牌数 | `getState()` 牌数 |
| 4 | 翻牌后状态更新 | `getState()` 动态更新 |
| 5 | 选择状态反映在 getState 中 | `getState()` 选择状态 |

### 14. 事件系统（9 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1-3 | start 触发 statusChange/scoreChange/levelChange | `on()` |
| 4-6 | pause/resume/reset 触发 statusChange | `on()` |
| 7 | 翻牌触发 scoreChange 事件 | `on()` |
| 8 | off 取消事件监听 | `off()` |
| 9 | gameover 触发 statusChange 事件 | `on()` |

### 15. 公共辅助方法（8 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1-2 | getFoundationTop | 正常/空列 |
| 3-4 | getTableauTop | 正常/空列 |
| 5-6 | getWasteTop | 正常/空 |
| 7 | getTotalFoundationCards | 计数 |
| 8-10 | getFaceUpCardCount/getFaceDownCardCount | 计数 + 守恒 |

### 16. 空格键特殊行为（3 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | idle 状态空格键开始游戏 | `handleKeyDown(' ')` idle |
| 2 | playing 状态空格键在 stock 翻牌 | `handleKeyDown(' ')` stock |
| 3 | playing 状态空格键有选择时取消 | `handleKeyDown(' ')` 取消 |

### 17. 边界情况（12 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | 未初始化 canvas 调用 start 抛出异常 | 异常处理 |
| 2 | pause 在 idle 状态无效 | 状态守卫 |
| 3 | resume 在 idle 状态无效 | 状态守卫 |
| 4 | 多次 reset 不报错 | 幂等性 |
| 5 | 多次 destroy 不报错 | 幂等性 |
| 6 | 连续 start-reset-start 循环正常 | 循环操作 |
| 7 | handleKeyUp 不报错 | `handleKeyUp()` |
| 8 | 未知按键不报错 | `handleKeyDown()` 未知键 |
| 9 | 选择后 Enter 在非 playing 状态不放置 | 状态守卫 |
| 10 | tableau 多张牌拾取 | 多牌拾取 |
| 11 | tableau 多张牌移动 | 多牌放置 |
| 12 | cursorRow 超出 pile 长度时拾取最后一张 | 边界行索引 |

### 18. 完整游戏流程（3 个用例）
| # | 用例名 | 覆盖方法 |
|---|--------|----------|
| 1 | start → 翻牌 → 选择 → 放置 → 检查状态 | 全流程 |
| 2 | start → pause → resume → reset 完整流程 | 全流程 |
| 3 | 多次翻牌和回收 | 全流程 |

### 19. 常量验证（6 个用例）
| # | 用例名 | 覆盖内容 |
|---|--------|----------|
| 1 | 画布尺寸 480×640 | `CANVAS_WIDTH/HEIGHT` |
| 2 | SUITS 有 4 种花色 | `SUITS` |
| 3 | RANKS 有 13 种面值 | `RANKS` |
| 4 | rankValue A=1, K=13 | `rankValue()` |
| 5 | isRedSuit 正确判断 | `isRedSuit()` |
| 6 | suitSymbol 返回正确符号 | `suitSymbol()` |
| 7 | 计分常量正确 | `SCORE_*` |

---

## 二、未覆盖场景清单

### P0 — 鼠标交互核心场景（完全未覆盖）

现有测试 **100% 通过键盘交互**，以下所有鼠标相关公共方法 **零测试覆盖**：

| 方法 | 行号 | 说明 |
|------|------|------|
| `hitTest()` | 335 | 坐标→区域映射，所有鼠标交互的基础 |
| `handleClick()` | 392 | 点击选牌/放牌/翻牌 |
| `handleDoubleClick()` | 456 | 双击自动移到 foundation |
| `handleMouseDown()` | 508 | 拖拽起始 |
| `handleMouseMove()` | 567 | 拖拽移动 + hover 高亮 |
| `handleMouseUp()` | 578 | 拖拽放置 |

**关键遗漏：**

1. **hitTest 区域判定** — 无任何测试验证坐标到区域的映射是否正确
2. **鼠标点击选牌** — `handleClick` 的选牌、放牌、stock 翻牌逻辑
3. **鼠标拖拽** — `handleMouseDown → handleMouseMove → handleMouseUp` 完整拖拽流程
4. **鼠标双击自动放置** — `handleDoubleClick` 的 foundation 自动查找
5. **hover 高亮** — `_hoverTarget` 的更新逻辑
6. **拖拽状态管理** — `_isDragging`、`_dragCards`、`_dragSource`、`_dragX`、`_dragY` 的生命周期

### P1 — 边界条件补充

| # | 未覆盖场景 | 优先级 | 说明 |
|---|-----------|--------|------|
| 1 | 空列拖拽（tableau 空列 hitTest row=-1） | P1 | hitTest 对空列返回 `row: -1` |
| 2 | 拖拽中忽略 click | P1 | `handleClick` 开头检查 `_isDragging` |
| 3 | 拖拽到无效位置取消 | P1 | `handleMouseUp` hit=null 时清除选择 |
| 4 | 拖拽放回原位取消 | P1 | `handleMouseUp` isSamePlace 检查 |
| 5 | stock 不支持拖拽 | P1 | `handleMouseDown` 对 stock 不设拖拽 |
| 6 | 面朝下的牌不支持拖拽 | P1 | `handleMouseDown` 检查 `faceUp` |
| 7 | 从 foundation 拖拽（仅顶牌） | P1 | `handleMouseDown` foundation 分支 |
| 8 | 多牌拖拽（tableau 从中间拾取） | P1 | `handleMouseDown` tableau 分支 |
| 9 | 拖拽坐标更新 | P1 | `_dragX`/`_dragY` 跟随鼠标 |
| 10 | handleClick 点击空白区域取消选择 | P1 | hit=null 时 clearSelection |
| 11 | handleDoubleClick 只有顶牌能双击 | P1 | tableau 中非顶牌不能双击 |
| 12 | handleDoubleClick 找不到合适 foundation 时无操作 | P1 | `findFoundationTarget` 返回 -1 |

### P2 — 游戏流程补充

| # | 未覆盖场景 | 优先级 | 说明 |
|---|-----------|--------|------|
| 1 | 鼠标点击 stock 翻牌 | P2 | `handleClick` → stock → `drawFromStock()` |
| 2 | 鼠标点击选牌后再点击放牌 | P2 | `handleClick` 有选牌时放置 |
| 3 | 拖拽到 foundation 成功 | P2 | 鼠标拖拽路径的 foundation 放置 |
| 4 | 拖拽到 tableau 成功 | P2 | 鼠标拖拽路径的 tableau 放置 |
| 5 | 拖拽多牌到 tableau 成功 | P2 | 多牌拖拽放置 |
| 6 | 双击 waste 牌到 foundation | P2 | `handleDoubleClick` waste 分支 |
| 7 | 双击 tableau 顶牌到 foundation | P2 | `handleDoubleClick` tableau 分支 |
| 8 | 鼠标+键盘混合操作 | P2 | 鼠标选牌后键盘放置等 |
| 9 | 拖拽渲染半透明效果 | P2 | `_isDragging` 时原位置牌半透明 |
| 10 | hover 渲染高亮 | P2 | `_hoverTarget` 影响渲染 |

---

## 三、建议的测试用例列表

### P0 — hitTest 区域判定

#### TC-M01: hitTest — stock 区域命中
- **描述**: 点击 stock 区域内坐标应返回 `{area:'stock', col:0, row:0}`
- **预期**: `hitTest(STOCK_X + 30, TOP_ROW_Y + 42)` → `{area:'stock', col:0, row:0}`

#### TC-M02: hitTest — waste 区域命中
- **描述**: 点击 waste 区域内坐标应返回 `{area:'waste', col:0, row:0}`
- **预期**: `hitTest(WASTE_X + 30, TOP_ROW_Y + 42)` → `{area:'waste', col:0, row:0}`

#### TC-M03: hitTest — foundation 各列命中
- **描述**: 点击 4 个 foundation 区域分别返回对应列号
- **预期**: `hitTest(FOUNDATION_X_START + i*FOUNDATION_GAP + 30, TOP_ROW_Y + 42)` → `{area:'foundation', col:i, row:0}` (i=0,1,2,3)

#### TC-M04: hitTest — tableau 各列命中
- **描述**: 点击 tableau 各列顶部牌区域返回正确列号和行号
- **预期**: `hitTest(TABLEAU_X_START + col*TABLEAU_GAP + 30, TABLEAU_Y + 42)` → `{area:'tableau', col, row:0}` (col=0..6)

#### TC-M05: hitTest — tableau 牌叠中间行命中
- **描述**: 点击 tableau 第6列（7张牌）中间某张牌，应返回正确的行号
- **预期**: 根据牌面朝上/朝下的偏移量计算 Y 坐标，命中指定行

#### TC-M06: hitTest — tableau 空列命中
- **描述**: 点击空 tableau 列应返回 `{area:'tableau', col, row:-1}`
- **预期**: 清空某列后点击该列区域，row 为 -1

#### TC-M07: hitTest — 空白区域返回 null
- **描述**: 点击不属于任何区域的坐标应返回 null
- **预期**: `hitTest(0, 0)` → null；`hitTest(240, 60)` → null（stock 和 waste 之间的间隙）

#### TC-M08: hitTest — 边界坐标精确命中
- **描述**: 点击区域边缘坐标（刚好在边界上）的行为
- **预期**: 左上角 `hitTest(STOCK_X, TOP_ROW_Y)` → 命中 stock；刚好超出 `hitTest(STOCK_X-1, TOP_ROW_Y)` → null

### P0 — 鼠标点击（handleClick）

#### TC-M10: handleClick — 点击 stock 翻牌
- **描述**: 点击 stock 区域应调用 drawFromStock，waste 增加 1 张牌
- **预期**: `waste.length` 从 0 变为 1，`stock.length` 从 24 变为 23

#### TC-M11: handleClick — 点击 waste 选牌
- **描述**: waste 有牌时点击应选中 waste 顶牌
- **预期**: `selection.source === 'waste'`，`selectedCards.length === 1`

#### TC-M12: handleClick — 点击空 waste 无操作
- **描述**: waste 为空时点击 waste 区域不应设置选择
- **预期**: `selection === null`

#### TC-M13: handleClick — 已选牌后点击 foundation 放置
- **描述**: 选中 waste 的 A 后，点击 foundation[0] 应成功放置
- **预期**: `foundations[0].length === 1`

#### TC-M14: handleClick — 已选牌后点击 tableau 放置
- **描述**: 选中 waste 的 Q♠ 后，点击有 K♥ 的 tableau 列应成功放置
- **预期**: 目标 tableau 列增加 1 张牌

#### TC-M15: handleClick — 点击空白区域取消选择
- **描述**: 有选中的牌时，点击不属于任何区域的坐标应清除选择
- **预期**: `selection === null`

#### TC-M16: handleClick — 拖拽中忽略 click
- **描述**: `_isDragging` 为 true 时调用 handleClick 应直接返回
- **预期**: 无任何状态变化

### P0 — 鼠标拖拽（handleMouseDown → handleMouseMove → handleMouseUp）

#### TC-M20: handleMouseDown — 从 waste 拖拽单牌
- **描述**: 在 waste 区域按下鼠标应开始拖拽 waste 顶牌
- **预期**: `_isDragging === true`，`_dragCards.length === 1`，`_dragSource.area === 'waste'`

#### TC-M21: handleMouseDown — 从 foundation 拖拽单牌
- **描述**: 在有牌的 foundation 区域按下鼠标应开始拖拽顶牌
- **预期**: `_isDragging === true`，`_dragCards.length === 1`，`_dragSource.area === 'foundation'`

#### TC-M22: handleMouseDown — 从 tableau 拖拽单牌（顶牌）
- **描述**: 在 tableau 某列顶牌位置按下鼠标应开始拖拽该牌
- **预期**: `_isDragging === true`，`_dragCards.length === 1`

#### TC-M23: handleMouseDown — 从 tableau 拖拽多牌
- **描述**: 在 tableau 某列中间面朝上的牌按下鼠标，应拾取该牌及其下方所有牌
- **预期**: `_dragCards.length` 等于从该行到列尾的牌数

#### TC-M24: handleMouseDown — stock 不支持拖拽
- **描述**: 在 stock 区域按下鼠标不应开始拖拽
- **预期**: `_isDragging === false`，`_dragCards` 为空

#### TC-M25: handleMouseDown — 面朝下的牌不支持拖拽
- **描述**: 在 tableau 面朝下的牌上按下鼠标不应开始拖拽
- **预期**: `_isDragging === false`

#### TC-M26: handleMouseDown — 空区域不拖拽
- **描述**: 在空 waste、空 foundation、空 tableau 上按下鼠标不应开始拖拽
- **预期**: `_isDragging === false`

#### TC-M27: handleMouseMove — 更新拖拽坐标
- **描述**: 拖拽中移动鼠标应更新 `_dragX` 和 `_dragY`
- **预期**: `_dragX === canvasX - CARD_WIDTH/2`，`_dragY === canvasY - CARD_HEIGHT/2`

#### TC-M28: handleMouseMove — 更新 hover 目标
- **描述**: 非拖拽状态下移动鼠标应更新 `_hoverTarget`
- **预期**: `_hoverTarget` 反映当前鼠标位置的区域信息

#### TC-M29: handleMouseMove — 拖拽中不移动时 dragX/Y 不变
- **描述**: 拖拽中未调用 handleMouseMove 时坐标保持不变
- **预期**: `_dragX`/`_dragY` 保持 handleMouseDown 时设置的值

#### TC-M30: handleMouseUp — 拖拽到 foundation 成功放置
- **描述**: 从 waste 拖拽 A♥ 到 foundation[0] 应成功放置
- **预期**: `foundations[0].length === 1`，`waste.length` 减少 1，`_isDragging === false`

#### TC-M31: handleMouseUp — 拖拽到 tableau 成功放置
- **描述**: 从 waste 拖拽 Q♠ 到有 K♥ 的 tableau 列应成功放置
- **预期**: 目标 tableau 列增加 1 张牌

#### TC-M32: handleMouseUp — 拖拽多牌到 tableau 成功放置
- **描述**: 从 tableau 拖拽 Q♠+J♥ 两张牌到有 K♥ 的空列或合适列
- **预期**: 目标列增加 2 张牌，源列减少 2 张牌

#### TC-M33: handleMouseUp — 拖拽到无效位置取消
- **描述**: 拖拽到空白区域（hit=null）应取消选择
- **预期**: `selection === null`，`_isDragging === false`，牌回到原位

#### TC-M34: handleMouseUp — 拖拽放回原位取消
- **描述**: 从 tableau[0] 拖拽后放回 tableau[0] 同一列应取消
- **预期**: 牌数不变，`_isDragging === false`

#### TC-M35: handleMouseUp — 无拖拽时调用无效果
- **描述**: 未开始拖拽时调用 handleMouseUp 应直接返回
- **预期**: 无状态变化

#### TC-M36: handleMouseUp — 拖拽后状态完全重置
- **描述**: 拖拽放置后所有拖拽状态应清零
- **预期**: `_isDragging === false`，`_dragCards === []`，`_dragSource === null`，`_mouseSelection === null`

### P0 — 鼠标双击（handleDoubleClick）

#### TC-M40: handleDoubleClick — 双击 waste 牌自动到 foundation
- **描述**: 双击 waste 中的 A♥ 应自动找到 foundation[0] 并放置
- **预期**: `foundations[0].length === 1`，`waste.length` 减少 1

#### TC-M41: handleDoubleClick — 双击 tableau 顶牌自动到 foundation
- **描述**: 双击 tableau 某列顶部的 A♠ 应自动找到合适 foundation 并放置
- **预期**: 对应 foundation 增加 1 张牌

#### TC-M42: handleDoubleClick — 双击非顶牌无效果
- **描述**: 双击 tableau 中间行（非顶牌）不应移动任何牌
- **预期**: 牌数不变

#### TC-M43: handleDoubleClick — 双击面朝下的牌无效果
- **描述**: 双击 tableau 面朝下的牌不应有任何操作
- **预期**: 无状态变化

#### TC-M44: handleDoubleClick — 找不到合适 foundation 时无操作
- **描述**: 双击一张无法放到任何 foundation 的牌（如 5♥ 但 foundation 只有 3♥）
- **预期**: 牌数不变

#### TC-M45: handleDoubleClick — gameover 状态不响应
- **描述**: 胜利后双击不应有任何操作
- **预期**: 无状态变化

### P1 — 边界条件补充

#### TC-B01: 拖拽过程中 moves 计数正确
- **描述**: 鼠标拖拽成功放置后 `moves` 应增加 1
- **预期**: `moves` 从 N 变为 N+1

#### TC-B02: 拖拽过程中 score 计分正确
- **描述**: 鼠标拖拽到 foundation 后应加 `SCORE_FOUNDATION`
- **预期**: `score` 增加 10

#### TC-B03: 拖拽放置后翻开 tableau 面朝下的牌
- **描述**: 从 tableau 拖走顶牌后，下一张面朝下的牌应自动翻开
- **预期**: 源列新顶牌 `faceUp === true`

#### TC-B04: 拖拽放置失败后 moves 不增加
- **描述**: 拖拽到无效位置（如红 Q 放到红 K 上）后 `moves` 不变
- **预期**: `moves` 保持不变

#### TC-B05: handleClick 已选牌后点击 stock 应先清除选择再翻牌
- **描述**: 有选中牌时点击 stock，应先清除选择再翻牌
- **预期**: `selection === null`，`waste.length` 增加 1

#### TC-B06: handleMouseDown 胜利后不响应
- **描述**: `_isWin === true` 时 handleMouseDown 不应开始拖拽
- **预期**: `_isDragging === false`

#### TC-B07: handleMouseDown 非 playing 状态不响应
- **描述**: `status !== 'playing'` 时 handleMouseDown 不应开始拖拽
- **预期**: `_isDragging === false`

#### TC-B08: handleClick 已选牌放到 waste 无效果
- **描述**: 有选中牌时点击 waste 区域，应清除选择（不能放到 waste）
- **预期**: `selection === null`，waste 牌数不变

#### TC-B09: handleClick 已选牌放到 stock 无效果
- **描述**: 有选中牌时点击 stock 区域，应清除选择（不能放到 stock）
- **预期**: `selection === null`

#### TC-B10: 多牌拖拽到 foundation 被拒绝
- **描述**: 从 tableau 拖拽多张牌到 foundation 应失败
- **预期**: foundation 牌数不变，选择被清除

#### TC-B11: 拖拽中 _selection 被正确设置
- **描述**: handleMouseDown 应同时设置 `_selection`（用于渲染高亮）
- **预期**: `_selection.source/col/cardIndex` 正确反映拖拽来源

### P2 — 游戏流程补充

#### TC-F01: 鼠标完整游戏流程 — 点击翻牌 → 点击选牌 → 点击放牌
- **描述**: 通过纯鼠标操作完成一次翻牌→选牌→放牌的完整流程
- **预期**: 各区域牌数正确，分数和移动次数更新

#### TC-F02: 鼠标完整游戏流程 — 拖拽移牌
- **描述**: 通过拖拽完成一次 tableau→tableau 的移动
- **预期**: 源列减少，目标列增加，翻牌正确

#### TC-F03: 鼠标完整游戏流程 — 双击移到 foundation
- **描述**: 通过双击将 A♥ 从 waste 移到 foundation
- **预期**: foundation 增加 1 张，waste 减少 1 张

#### TC-F04: 鼠标+键盘混合操作
- **描述**: 键盘选牌后鼠标点击放牌；或鼠标选牌后键盘 Enter 放牌
- **预期**: 两种输入方式可以混合使用

#### TC-F05: 从 foundation 拖回 tableau
- **描述**: 从 foundation 拖拽一张牌放回 tableau（合法移动）
- **预期**: foundation 减少，tableau 增加

#### TC-F06: 大量连续拖拽操作稳定性
- **描述**: 连续执行 50+ 次拖拽操作后引擎状态仍然一致
- **预期**: 总牌数始终为 52，无内存泄漏（数组长度合理）

#### TC-F07: 拖拽渲染状态验证
- **描述**: 拖拽中 `_dragCards` 应包含正确的牌数据，`_dragX/Y` 应反映鼠标位置
- **预期**: 拖拽状态完整且正确

#### TC-F08: hover 状态在非拖拽时更新
- **描述**: 非拖拽时移动鼠标，`_hoverTarget` 应跟随鼠标位置实时更新
- **预期**: `_hoverTarget` 反映最后鼠标位置的区域

#### TC-F09: hover 状态在拖拽时也更新
- **描述**: 拖拽中移动鼠标，`_hoverTarget` 仍应更新（用于显示放置预览）
- **预期**: `_hoverTarget` 在拖拽中持续更新

#### TC-F10: findFoundationTarget — A 放到空 foundation
- **描述**: `findFoundationTarget(A♥)` 在所有 foundation 为空时应返回某个空列索引
- **预期**: 返回 0-3 中的某个索引

#### TC-F11: findFoundationTarget — 找不到合适位置
- **描述**: `findFoundationTarget(5♥)` 在 foundation 只有 3♥ 时应返回 -1
- **预期**: 返回 -1

#### TC-F12: findFoundationTarget — 同花色递增匹配
- **描述**: foundation[0] 有 A♥，`findFoundationTarget(2♥)` 应返回 0
- **预期**: 返回 0

---

## 四、覆盖情况总结

### 按方法统计

| 方法 | 是否有测试 | 覆盖程度 |
|------|-----------|---------|
| `start()` | ✅ | 完整 |
| `pause()` | ✅ | 完整 |
| `resume()` | ✅ | 完整 |
| `reset()` | ✅ | 完整 |
| `destroy()` | ✅ | 基本 |
| `handleKeyDown()` | ✅ | 完整 |
| `handleKeyUp()` | ✅ | 基本 |
| `drawFromStock()` | ✅ | 完整 |
| `tryAutoComplete()` | ✅ | 完整 |
| `getState()` | ✅ | 完整 |
| `getFoundationTop()` | ✅ | 完整 |
| `getTableauTop()` | ✅ | 完整 |
| `getWasteTop()` | ✅ | 完整 |
| `getTotalFoundationCards()` | ✅ | 完整 |
| `getFaceUpCardCount()` | ✅ | 完整 |
| `getFaceDownCardCount()` | ✅ | 完整 |
| **`hitTest()`** | ❌ | **0%** |
| **`handleClick()`** | ❌ | **0%** |
| **`handleDoubleClick()`** | ❌ | **0%** |
| **`handleMouseDown()`** | ❌ | **0%** |
| **`handleMouseMove()`** | ❌ | **0%** |
| **`handleMouseUp()`** | ❌ | **0%** |

### 按交互方式统计

| 交互方式 | 测试用例数 | 占比 |
|---------|-----------|------|
| 键盘交互 | ~85 | 100% |
| 鼠标交互 | 0 | 0% |

### 建议优先级

1. **立即补充（P0）**: 6 个鼠标公共方法 — 这是用户最常用的交互方式，完全无测试是最高风险
2. **尽快补充（P1）**: 11 个边界条件 — 防止回归错误
3. **计划补充（P2）**: 12 个流程测试 — 提升整体覆盖率和信心

### 预估新增测试用例数

| 优先级 | 用例数 |
|--------|-------|
| P0 | ~30 |
| P1 | ~11 |
| P2 | ~12 |
| **合计** | **~53** |
