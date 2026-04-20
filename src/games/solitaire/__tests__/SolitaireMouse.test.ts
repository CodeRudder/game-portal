import { SolitaireEngine } from '../SolitaireEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  CARD_WIDTH, CARD_HEIGHT,
  CARD_GAP,
  TABLEAU_OVERLAP_FACE_DOWN, TABLEAU_OVERLAP_FACE_UP,
  TOP_ROW_Y, TABLEAU_Y,
  STOCK_X, WASTE_X,
  FOUNDATION_X_START, FOUNDATION_GAP,
  TABLEAU_X_START, TABLEAU_GAP,
  SCORE_FLIP, SCORE_FOUNDATION, SCORE_FOUNDATION_BACK,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): SolitaireEngine {
  const engine = new SolitaireEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 启动引擎（进入 playing 状态，发好牌） */
function startEngine(engine: SolitaireEngine): void {
  engine.start();
}

/** 创建一张指定花色和面值的牌 */
function makeCard(suit: string, rank: string, faceUp = true) {
  return { suit: suit as any, rank: rank as any, faceUp };
}

/** 拿到内部 tableau 引用 */
function getTableau(engine: SolitaireEngine): any[][] {
  return (engine as any)._tableau;
}
function getFoundations(engine: SolitaireEngine): any[][] {
  return (engine as any)._foundations;
}
function getWaste(engine: SolitaireEngine): any[] {
  return (engine as any)._waste;
}
function getStock(engine: SolitaireEngine): any[] {
  return (engine as any)._stock;
}

// ========== 坐标计算辅助 ==========

/** 计算 foundation 列 i 的中心 X */
function foundationCenterX(i: number): number {
  return FOUNDATION_X_START + i * FOUNDATION_GAP + CARD_WIDTH / 2;
}

/** 计算 foundation 列 i 的中心 Y */
function foundationCenterY(): number {
  return TOP_ROW_Y + CARD_HEIGHT / 2;
}

/** 计算 tableau 列 col 的中心 X */
function tableauCenterX(col: number): number {
  return TABLEAU_X_START + col * TABLEAU_GAP + CARD_WIDTH / 2;
}

/** 计算 tableau 列 col 第 row 张牌的中心 Y（考虑累积偏移） */
function tableauCardCenterY(col: number, row: number, engine: SolitaireEngine): number {
  const pile = getTableau(engine)[col];
  let y = TABLEAU_Y;
  for (let i = 0; i < row; i++) {
    y += pile[i].faceUp ? TABLEAU_OVERLAP_FACE_UP : TABLEAU_OVERLAP_FACE_DOWN;
  }
  return y + CARD_HEIGHT / 2;
}

/** 计算 stock 中心坐标 */
function stockCenter(): { x: number; y: number } {
  return { x: STOCK_X + CARD_WIDTH / 2, y: TOP_ROW_Y + CARD_HEIGHT / 2 };
}

/** 计算 waste 中心坐标 */
function wasteCenter(): { x: number; y: number } {
  return { x: WASTE_X + CARD_WIDTH / 2, y: TOP_ROW_Y + CARD_HEIGHT / 2 };
}

// ========== 测试 ==========

describe('SolitaireEngine 鼠标交互', () => {
  let engine: SolitaireEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ================================================================
  // P0 — hitTest
  // ================================================================
  describe('hitTest', () => {
    it('命中 stock 区域', () => {
      startEngine(engine);
      const result = (engine as any).hitTest(STOCK_X + 5, TOP_ROW_Y + 5);
      expect(result).toEqual({ area: 'stock', col: 0, row: 0 });
    });

    it('命中 waste 区域', () => {
      startEngine(engine);
      const result = (engine as any).hitTest(WASTE_X + 5, TOP_ROW_Y + 5);
      expect(result).toEqual({ area: 'waste', col: 0, row: 0 });
    });

    it('命中 foundation 第 0 列', () => {
      startEngine(engine);
      const result = (engine as any).hitTest(FOUNDATION_X_START + 5, TOP_ROW_Y + 5);
      expect(result).toEqual({ area: 'foundation', col: 0, row: 0 });
    });

    it('命中 foundation 第 3 列', () => {
      startEngine(engine);
      const fx = FOUNDATION_X_START + 3 * FOUNDATION_GAP;
      const result = (engine as any).hitTest(fx + 5, TOP_ROW_Y + 5);
      expect(result).toEqual({ area: 'foundation', col: 3, row: 0 });
    });

    it('命中 tableau 列（有牌）', () => {
      startEngine(engine);
      // tableau 第 0 列有牌，点击第一张牌区域
      const pile = getTableau(engine)[0];
      const result = (engine as any).hitTest(
        TABLEAU_X_START + 5,
        TABLEAU_Y + 5
      );
      expect(result).not.toBeNull();
      expect(result.area).toBe('tableau');
      expect(result.col).toBe(0);
      expect(result.row).toBeGreaterThanOrEqual(0);
    });

    it('命中 tableau 牌叠中间行（混合面朝上/朝下的累积偏移）', () => {
      startEngine(engine);
      // 设置第 0 列：2张面朝下 + 2张面朝上
      getTableau(engine)[0] = [
        makeCard('hearts', 'K', false),
        makeCard('spades', 'Q', false),
        makeCard('hearts', 'J', true),
        makeCard('spades', '10', true),
      ];
      // 第 2 张（面朝上）的 Y 位置
      const card2Y = TABLEAU_Y + TABLEAU_OVERLAP_FACE_DOWN + TABLEAU_OVERLAP_FACE_DOWN;
      const result = (engine as any).hitTest(TABLEAU_X_START + 5, card2Y + 5);
      expect(result).toEqual({ area: 'tableau', col: 0, row: 2 });
    });

    it('命中 tableau 空列（row=-1）', () => {
      startEngine(engine);
      // 清空第 0 列
      getTableau(engine)[0] = [];
      const result = (engine as any).hitTest(
        TABLEAU_X_START + 5,
        TABLEAU_Y + 5
      );
      expect(result).toEqual({ area: 'tableau', col: 0, row: -1 });
    });

    it('空白区域返回 null', () => {
      startEngine(engine);
      // 点击画布左上角空白
      const result = (engine as any).hitTest(0, 0);
      expect(result).toBeNull();
    });

    it('边界坐标：stock 左上角刚好命中', () => {
      startEngine(engine);
      const result = (engine as any).hitTest(STOCK_X, TOP_ROW_Y);
      expect(result).toEqual({ area: 'stock', col: 0, row: 0 });
    });

    it('边界坐标：stock 右下角刚好不命中（边界外）', () => {
      startEngine(engine);
      const result = (engine as any).hitTest(STOCK_X + CARD_WIDTH, TOP_ROW_Y + CARD_HEIGHT);
      expect(result).toBeNull();
    });

    it('命中 tableau 第 6 列', () => {
      startEngine(engine);
      const cx = TABLEAU_X_START + 6 * TABLEAU_GAP;
      const result = (engine as any).hitTest(cx + 5, TABLEAU_Y + 5);
      expect(result).not.toBeNull();
      expect(result.area).toBe('tableau');
      expect(result.col).toBe(6);
    });
  });

  // ================================================================
  // P0 — handleClick
  // ================================================================
  describe('handleClick', () => {
    it('点击 stock 翻牌', () => {
      startEngine(engine);
      const initialWasteLen = getWaste(engine).length;
      engine.handleClick(stockCenter().x, stockCenter().y);
      expect(getWaste(engine).length).toBe(initialWasteLen + 1);
    });

    it('点击 waste 选牌', () => {
      startEngine(engine);
      // 先翻一张牌到 waste
      engine.drawFromStock();
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      expect(engine.selection).not.toBeNull();
      expect(engine.selection!.source).toBe('waste');
    });

    it('点击空 waste 无操作', () => {
      startEngine(engine);
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      expect(engine.selection).toBeNull();
    });

    it('已选牌后点击 foundation 放置', () => {
      startEngine(engine);
      // 设置 waste 有 A♠
      getWaste(engine).push(makeCard('spades', 'A'));
      // 选中 waste 的牌
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      expect(engine.selection).not.toBeNull();
      // 点击 foundation 0
      engine.handleClick(foundationCenterX(0), foundationCenterY());
      expect(getFoundations(engine)[0].length).toBe(1);
      expect(getFoundations(engine)[0][0].rank).toBe('A');
    });

    it('已选牌后点击 tableau 放置', () => {
      startEngine(engine);
      // 设置 waste 有 Q♥
      getWaste(engine).push(makeCard('hearts', 'Q'));
      // 设置 tableau 第 0 列顶牌为 K♠
      getTableau(engine)[0] = [makeCard('spades', 'K')];
      // 选中 waste 的牌
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      expect(engine.selection).not.toBeNull();
      // 点击 tableau 第 0 列
      engine.handleClick(tableauCenterX(0), TABLEAU_Y + 5);
      expect(getTableau(engine)[0].length).toBe(2);
      expect(getTableau(engine)[0][1].rank).toBe('Q');
    });

    it('点击空白取消选择', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      expect(engine.selection).not.toBeNull();
      // 点击空白区域
      engine.handleClick(0, 0);
      expect(engine.selection).toBeNull();
    });

    it('拖拽中忽略 click', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      // 模拟拖拽状态
      (engine as any)._isDragging = true;
      const wasteLen = getWaste(engine).length;
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      // waste 不应变
      expect(getWaste(engine).length).toBe(wasteLen);
    });

    it('点击面朝下的 tableau 牌不选择', () => {
      startEngine(engine);
      getTableau(engine)[0] = [makeCard('hearts', 'K', false)];
      const cx = TABLEAU_X_START + 5;
      engine.handleClick(cx, TABLEAU_Y + 5);
      expect(engine.selection).toBeNull();
    });

    it('点击空 tableau 列不选择', () => {
      startEngine(engine);
      getTableau(engine)[0] = [];
      const cx = TABLEAU_X_START + 5;
      engine.handleClick(cx, TABLEAU_Y + 5);
      expect(engine.selection).toBeNull();
    });

    it('点击 foundation 空位不选择', () => {
      startEngine(engine);
      engine.handleClick(foundationCenterX(0), foundationCenterY());
      expect(engine.selection).toBeNull();
    });

    it('点击 foundation 有牌时选中', () => {
      startEngine(engine);
      getFoundations(engine)[0].push(makeCard('spades', 'A'));
      engine.handleClick(foundationCenterX(0), foundationCenterY());
      expect(engine.selection).not.toBeNull();
      expect(engine.selection!.source).toBe('foundation');
      expect(engine.selection!.col).toBe(0);
    });
  });

  // ================================================================
  // P0 — 拖拽流程
  // ================================================================
  describe('handleMouseDown', () => {
    it('从 waste 拖拽', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(1);
      expect((engine as any)._dragCards[0].rank).toBe('Q');
      expect((engine as any)._dragSource).toEqual({ area: 'waste', col: 0, row: 0 });
    });

    it('从 foundation 拖拽', () => {
      startEngine(engine);
      getFoundations(engine)[0].push(makeCard('spades', 'A'));
      engine.handleMouseDown(foundationCenterX(0), foundationCenterY());
      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(1);
      expect((engine as any)._dragCards[0].rank).toBe('A');
      expect((engine as any)._dragSource!.area).toBe('foundation');
      expect((engine as any)._dragSource!.col).toBe(0);
    });

    it('从 tableau 拖拽单牌', () => {
      startEngine(engine);
      getTableau(engine)[0] = [makeCard('spades', 'K')];
      const cx = TABLEAU_X_START + 5;
      const cy = TABLEAU_Y + 5;
      engine.handleMouseDown(cx, cy);
      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(1);
      expect((engine as any)._dragCards[0].rank).toBe('K');
    });

    it('从 tableau 拖拽多牌', () => {
      startEngine(engine);
      getTableau(engine)[0] = [
        makeCard('hearts', 'K'),
        makeCard('spades', 'Q'),
        makeCard('hearts', 'J'),
      ];
      // 点击第 1 行（Q♠）的坐标
      const cy = TABLEAU_Y + TABLEAU_OVERLAP_FACE_UP + 5;
      engine.handleMouseDown(TABLEAU_X_START + 5, cy);
      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(2); // Q♠ 和 J♥
    });

    it('stock 不支持拖拽', () => {
      startEngine(engine);
      engine.handleMouseDown(stockCenter().x, stockCenter().y);
      expect((engine as any)._isDragging).toBe(false);
      expect((engine as any)._dragCards.length).toBe(0);
    });

    it('面朝下的牌不支持拖拽', () => {
      startEngine(engine);
      getTableau(engine)[0] = [makeCard('hearts', 'K', false)];
      engine.handleMouseDown(TABLEAU_X_START + 5, TABLEAU_Y + 5);
      expect((engine as any)._isDragging).toBe(false);
    });

    it('空区域不触发拖拽', () => {
      startEngine(engine);
      engine.handleMouseDown(0, 0);
      expect((engine as any)._isDragging).toBe(false);
    });

    it('空 waste 不触发拖拽', () => {
      startEngine(engine);
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      expect((engine as any)._isDragging).toBe(false);
    });

    it('空 foundation 不触发拖拽', () => {
      startEngine(engine);
      engine.handleMouseDown(foundationCenterX(0), foundationCenterY());
      expect((engine as any)._isDragging).toBe(false);
    });

    it('设置正确的 _dragX 和 _dragY', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      const x = wasteCenter().x;
      const y = wasteCenter().y;
      engine.handleMouseDown(x, y);
      expect((engine as any)._dragX).toBe(x - CARD_WIDTH / 2);
      expect((engine as any)._dragY).toBe(y - CARD_HEIGHT / 2);
    });

    it('设置 _mouseSelection', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      expect((engine as any)._mouseSelection).not.toBeNull();
      expect((engine as any)._mouseSelection.area).toBe('waste');
    });
  });

  describe('handleMouseMove', () => {
    it('更新拖拽坐标', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      const newX = 200;
      const newY = 300;
      engine.handleMouseMove(newX, newY);
      expect((engine as any)._dragX).toBe(newX - CARD_WIDTH / 2);
      expect((engine as any)._dragY).toBe(newY - CARD_HEIGHT / 2);
    });

    it('更新 hover 目标', () => {
      startEngine(engine);
      engine.handleMouseMove(foundationCenterX(0), foundationCenterY());
      expect((engine as any)._hoverTarget).not.toBeNull();
      expect((engine as any)._hoverTarget.area).toBe('foundation');
      expect((engine as any)._hoverTarget.col).toBe(0);
    });

    it('未拖拽时只更新 hover 不更新坐标', () => {
      startEngine(engine);
      const oldDragX = (engine as any)._dragX;
      const oldDragY = (engine as any)._dragY;
      engine.handleMouseMove(200, 300);
      expect((engine as any)._dragX).toBe(oldDragX);
      expect((engine as any)._dragY).toBe(oldDragY);
      expect((engine as any)._hoverTarget).not.toBeNull();
    });

    it('hover 到空白区域设为 null', () => {
      startEngine(engine);
      engine.handleMouseMove(0, 0);
      expect((engine as any)._hoverTarget).toBeNull();
    });
  });

  describe('handleMouseUp', () => {
    it('拖到 foundation 成功放置', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseMove(foundationCenterX(0), foundationCenterY());
      engine.handleMouseUp(foundationCenterX(0), foundationCenterY());
      expect(getFoundations(engine)[0].length).toBe(1);
      expect(getFoundations(engine)[0][0].rank).toBe('A');
      expect(getWaste(engine).length).toBe(0);
    });

    it('拖到 tableau 成功放置', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      getTableau(engine)[0] = [makeCard('spades', 'K')];
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseMove(tableauCenterX(0), TABLEAU_Y + 5);
      engine.handleMouseUp(tableauCenterX(0), TABLEAU_Y + 5);
      expect(getTableau(engine)[0].length).toBe(2);
      expect(getTableau(engine)[0][1].rank).toBe('Q');
    });

    it('拖多牌到 tableau（只有第一张被放置）', () => {
      startEngine(engine);
      // 源列：K♠, Q♥, J♠
      getTableau(engine)[0] = [
        makeCard('spades', 'K'),
        makeCard('hearts', 'Q'),
        makeCard('spades', 'J'),
      ];
      // 目标列：空列
      getTableau(engine)[1] = [];
      // 从第 1 行（Q♥）开始拖
      const cy = TABLEAU_Y + TABLEAU_OVERLAP_FACE_UP + 5;
      engine.handleMouseDown(TABLEAU_X_START + 5, cy);
      expect((engine as any)._dragCards.length).toBe(2);
      // 拖到空列 → Q 不是 K，不能放
      engine.handleMouseMove(tableauCenterX(1), TABLEAU_Y + 5);
      engine.handleMouseUp(tableauCenterX(1), TABLEAU_Y + 5);
      // 放置失败，源列不变
      expect(getTableau(engine)[0].length).toBe(3);
      expect(getTableau(engine)[1].length).toBe(0);
    });

    it('无效位置取消放回', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      const wasteLen = getWaste(engine).length;
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseMove(0, 0);
      engine.handleMouseUp(0, 0);
      // 放到无效位置，选择被清除，牌应保留在 waste
      expect((engine as any)._isDragging).toBe(false);
      expect(getWaste(engine).length).toBe(wasteLen);
      expect(engine.selection).toBeNull();
    });

    it('放回原位（同列）取消操作', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      const wasteLen = getWaste(engine).length;
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      // 移动到 waste 区域再松开（同源）
      engine.handleMouseMove(wasteCenter().x, wasteCenter().y);
      engine.handleMouseUp(wasteCenter().x, wasteCenter().y);
      expect(getWaste(engine).length).toBe(wasteLen);
      expect(engine.selection).toBeNull();
    });

    it('无拖拽时调用 handleMouseUp 无操作', () => {
      startEngine(engine);
      // 不应抛出异常
      engine.handleMouseUp(100, 100);
      expect((engine as any)._isDragging).toBe(false);
    });

    it('拖拽后状态完全重置', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseMove(foundationCenterX(0), foundationCenterY());
      engine.handleMouseUp(foundationCenterX(0), foundationCenterY());
      expect((engine as any)._isDragging).toBe(false);
      expect((engine as any)._dragCards).toEqual([]);
      expect((engine as any)._dragSource).toBeNull();
      expect((engine as any)._mouseSelection).toBeNull();
    });

    it('从 foundation 拖到 tableau', () => {
      startEngine(engine);
      getFoundations(engine)[0].push(makeCard('spades', 'A'));
      getTableau(engine)[0] = []; // 空列，A 不能放到空列（需要 K）
      engine.handleMouseDown(foundationCenterX(0), foundationCenterY());
      engine.handleMouseMove(tableauCenterX(0), TABLEAU_Y + 5);
      engine.handleMouseUp(tableauCenterX(0), TABLEAU_Y + 5);
      // A 不能放到空 tableau 列
      expect(getTableau(engine)[0].length).toBe(0);
      expect(getFoundations(engine)[0].length).toBe(1); // 牌保留在 foundation
    });
  });

  // ================================================================
  // P0 — 双击
  // ================================================================
  describe('handleDoubleClick', () => {
    it('waste 顶牌双击到 foundation', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleDoubleClick(wasteCenter().x, wasteCenter().y);
      expect(getFoundations(engine)[0].length).toBe(1);
      expect(getFoundations(engine)[0][0].rank).toBe('A');
      expect(getWaste(engine).length).toBe(0);
    });

    it('tableau 顶牌双击到 foundation', () => {
      startEngine(engine);
      getTableau(engine)[0] = [makeCard('spades', 'A')];
      engine.handleDoubleClick(TABLEAU_X_START + 5, TABLEAU_Y + 5);
      expect(getFoundations(engine)[0].length).toBe(1);
      expect(getFoundations(engine)[0][0].rank).toBe('A');
      expect(getTableau(engine)[0].length).toBe(0);
    });

    it('非顶牌不响应双击', () => {
      startEngine(engine);
      getTableau(engine)[0] = [
        makeCard('spades', 'K'),
        makeCard('hearts', 'Q'),
      ];
      // 双击第 0 行（K♠，非顶牌）
      engine.handleDoubleClick(TABLEAU_X_START + 5, TABLEAU_Y + 5);
      expect(getFoundations(engine)[0].length).toBe(0);
      expect(getTableau(engine)[0].length).toBe(2);
    });

    it('面朝下的牌不响应双击', () => {
      startEngine(engine);
      getTableau(engine)[0] = [makeCard('spades', 'K', false)];
      engine.handleDoubleClick(TABLEAU_X_START + 5, TABLEAU_Y + 5);
      expect(getFoundations(engine)[0].length).toBe(0);
    });

    it('无合适 foundation 位置不响应', () => {
      startEngine(engine);
      // Q♠ 不能放到空 foundation
      getTableau(engine)[0] = [makeCard('spades', 'Q')];
      engine.handleDoubleClick(TABLEAU_X_START + 5, TABLEAU_Y + 5);
      expect(getFoundations(engine)[0].length).toBe(0);
      expect(getTableau(engine)[0].length).toBe(1);
    });

    it('空白区域双击不响应', () => {
      startEngine(engine);
      engine.handleDoubleClick(0, 0);
      expect(getFoundations(engine)[0].length).toBe(0);
    });
  });

  // ================================================================
  // P1 — 边界条件
  // ================================================================
  describe('拖拽计分和计数', () => {
    it('拖到 foundation 成功计分', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseUp(foundationCenterX(0), foundationCenterY());
      expect(engine.score).toBe(SCORE_FOUNDATION);
      expect(engine.moves).toBe(1);
    });

    it('拖到 tableau 成功计数', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      getTableau(engine)[0] = [makeCard('spades', 'K')];
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseUp(tableauCenterX(0), TABLEAU_Y + 5);
      expect(engine.moves).toBe(1);
    });

    it('拖拽失败不计数', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseUp(0, 0); // 无效位置
      expect(engine.moves).toBe(0);
    });

    it('拖拽放回原位不计数', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseUp(wasteCenter().x, wasteCenter().y); // 同位置
      expect(engine.moves).toBe(0);
    });
  });

  describe('handleClick 边界', () => {
    it('click 放置到 foundation 计分', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      engine.handleClick(foundationCenterX(0), foundationCenterY());
      expect(engine.score).toBe(SCORE_FOUNDATION);
      expect(engine.moves).toBe(1);
    });

    it('click 放置失败不计数', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      // 放到空 foundation → Q 不是 A，失败
      engine.handleClick(foundationCenterX(0), foundationCenterY());
      expect(engine.moves).toBe(0);
    });

    it('连续点击 stock 翻多张牌', () => {
      startEngine(engine);
      const stockLen = getStock(engine).length;
      engine.handleClick(stockCenter().x, stockCenter().y);
      engine.handleClick(stockCenter().x, stockCenter().y);
      engine.handleClick(stockCenter().x, stockCenter().y);
      expect(getWaste(engine).length).toBe(3);
      expect(getStock(engine).length).toBe(stockLen - 3);
    });
  });

  describe('状态守卫', () => {
    it('非 playing 状态 handleClick 无操作', () => {
      // 未 start，状态为 idle
      const stockLen = getStock(engine).length;
      engine.handleClick(stockCenter().x, stockCenter().y);
      expect(getStock(engine).length).toBe(stockLen);
    });

    it('非 playing 状态 handleDoubleClick 无操作', () => {
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleDoubleClick(wasteCenter().x, wasteCenter().y);
      expect(getFoundations(engine)[0].length).toBe(0);
    });

    it('非 playing 状态 handleMouseDown 无操作', () => {
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      expect((engine as any)._isDragging).toBe(false);
    });

    it('胜利后 handleClick 无操作', () => {
      startEngine(engine);
      (engine as any)._isWin = true;
      const stockLen = getStock(engine).length;
      engine.handleClick(stockCenter().x, stockCenter().y);
      expect(getStock(engine).length).toBe(stockLen);
    });

    it('胜利后 handleDoubleClick 无操作', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      (engine as any)._isWin = true;
      engine.handleDoubleClick(wasteCenter().x, wasteCenter().y);
      expect(getFoundations(engine)[0].length).toBe(0);
    });

    it('胜利后 handleMouseDown 无操作', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      (engine as any)._isWin = true;
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      expect((engine as any)._isDragging).toBe(false);
    });
  });

  describe('多牌拖到 foundation 被拒绝', () => {
    it('拖多牌到 foundation 不放置', () => {
      startEngine(engine);
      getTableau(engine)[0] = [
        makeCard('spades', 'K'),
        makeCard('hearts', 'Q'),
        makeCard('spades', 'J'),
      ];
      // 从 Q♥（第 1 行）开始拖 → Q♥ + J♠ = 2 张
      // K♠ 是 faceUp，偏移 TABLEAU_OVERLAP_FACE_UP
      const cy = TABLEAU_Y + TABLEAU_OVERLAP_FACE_UP + 5;
      engine.handleMouseDown(TABLEAU_X_START + 5, cy);
      expect((engine as any)._dragCards.length).toBe(2);
      // 拖到 foundation
      engine.handleMouseMove(foundationCenterX(0), foundationCenterY());
      engine.handleMouseUp(foundationCenterX(0), foundationCenterY());
      // foundation 不接受多牌
      expect(getFoundations(engine)[0].length).toBe(0);
      // 源列不变（放置失败，选择被清除）
      expect(getTableau(engine)[0].length).toBe(3);
    });
  });

  // ================================================================
  // P2 — 流程测试
  // ================================================================
  describe('完整鼠标流程', () => {
    it('点击选择 → 点击放置流程', () => {
      startEngine(engine);
      // 设置 A♠ 到 waste
      getWaste(engine).push(makeCard('spades', 'A'));
      // 点击 waste 选中
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      expect(engine.selection).not.toBeNull();
      expect(engine.selection!.source).toBe('waste');
      // 点击 foundation 0 放置
      engine.handleClick(foundationCenterX(0), foundationCenterY());
      expect(getFoundations(engine)[0].length).toBe(1);
      expect(engine.selection).toBeNull();
    });

    it('拖拽流程：mousedown → mousemove → mouseup', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      expect((engine as any)._isDragging).toBe(true);
      engine.handleMouseMove(foundationCenterX(0), foundationCenterY());
      expect((engine as any)._dragX).toBe(foundationCenterX(0) - CARD_WIDTH / 2);
      engine.handleMouseUp(foundationCenterX(0), foundationCenterY());
      expect((engine as any)._isDragging).toBe(false);
      expect(getFoundations(engine)[0].length).toBe(1);
    });

    it('双击流程：waste A → foundation', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleDoubleClick(wasteCenter().x, wasteCenter().y);
      expect(getFoundations(engine)[0].length).toBe(1);
      expect(getWaste(engine).length).toBe(0);
      expect(engine.moves).toBe(1);
    });

    it('foundation 拖回 tableau', () => {
      startEngine(engine);
      getFoundations(engine)[0].push(makeCard('spades', 'A'));
      getTableau(engine)[0] = []; // 空列
      // A 不能放到空列（需要 K）
      engine.handleMouseDown(foundationCenterX(0), foundationCenterY());
      engine.handleMouseMove(tableauCenterX(0), TABLEAU_Y + 5);
      engine.handleMouseUp(tableauCenterX(0), TABLEAU_Y + 5);
      expect(getTableau(engine)[0].length).toBe(0);
      expect(getFoundations(engine)[0].length).toBe(1);
    });

    it('foundation A 拖到有 2♠ 的 tableau（合法）', () => {
      startEngine(engine);
      getFoundations(engine)[0].push(makeCard('spades', 'A'));
      getTableau(engine)[0] = [makeCard('hearts', '2')]; // 2♥
      // A♠ 不能放到 2♥（同红不行，需要异色）
      // A♠(黑) 放到 2♥(红)：黑放到红，rankValue(A)=1, rankValue(2♥)=2, 1===2-1 ✓，异色 ✓
      engine.handleMouseDown(foundationCenterX(0), foundationCenterY());
      engine.handleMouseMove(tableauCenterX(0), TABLEAU_Y + 5);
      engine.handleMouseUp(tableauCenterX(0), TABLEAU_Y + 5);
      expect(getTableau(engine)[0].length).toBe(2);
      expect(getTableau(engine)[0][1].rank).toBe('A');
      expect(getFoundations(engine)[0].length).toBe(0);
    });
  });

  describe('鼠标+键盘混合', () => {
    it('鼠标选择后键盘放置', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      // 鼠标选择 waste
      engine.handleClick(wasteCenter().x, wasteCenter().y);
      expect(engine.selection).not.toBeNull();
      // 键盘移动光标到 foundation
      (engine as any)._cursorArea = 'foundation';
      (engine as any)._cursorCol = 0;
      (engine as any)._cursorRow = 0;
      engine.handleKeyDown('Enter');
      expect(getFoundations(engine)[0].length).toBe(1);
    });

    it('键盘选择后鼠标放置', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('spades', 'A'));
      // 键盘选择 waste
      (engine as any)._cursorArea = 'waste';
      (engine as any)._cursorCol = 0;
      (engine as any)._cursorRow = 0;
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();
      // 鼠标点击 foundation 放置
      engine.handleClick(foundationCenterX(0), foundationCenterY());
      expect(getFoundations(engine)[0].length).toBe(1);
    });
  });

  describe('连续拖拽稳定性', () => {
    it('连续多次拖拽不累积状态', () => {
      startEngine(engine);
      // 第一次拖拽
      getWaste(engine).push(makeCard('spades', 'A'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseUp(foundationCenterX(0), foundationCenterY());
      expect((engine as any)._isDragging).toBe(false);
      expect((engine as any)._dragSource).toBeNull();
      // 第二次拖拽
      getWaste(engine).push(makeCard('spades', '2'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      expect((engine as any)._isDragging).toBe(true);
      engine.handleMouseUp(foundationCenterX(0), foundationCenterY());
      expect((engine as any)._isDragging).toBe(false);
      expect(getFoundations(engine)[0].length).toBe(2);
    });

    it('拖拽取消后可以再次拖拽', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      // 第一次拖拽取消
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseUp(0, 0); // 无效位置
      expect((engine as any)._isDragging).toBe(false);
      expect(getWaste(engine).length).toBe(1);
      // 第二次拖拽成功
      getTableau(engine)[0] = [makeCard('spades', 'K')];
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseUp(tableauCenterX(0), TABLEAU_Y + 5);
      expect(getTableau(engine)[0].length).toBe(2);
    });
  });

  describe('渲染状态', () => {
    it('拖拽时 getState 包含拖拽状态', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      const state = engine.getState();
      expect(state).toBeDefined();
      // 拖拽状态应反映在 selection 上
      expect(engine.selection).not.toBeNull();
    });

    it('非拖拽时 getState 正常', () => {
      startEngine(engine);
      const state = engine.getState();
      expect(state).toBeDefined();
      expect(state.selection).toBeNull();
    });
  });

  describe('hover 状态', () => {
    it('hover 到 stock', () => {
      startEngine(engine);
      engine.handleMouseMove(stockCenter().x, stockCenter().y);
      expect((engine as any)._hoverTarget).not.toBeNull();
      expect((engine as any)._hoverTarget.area).toBe('stock');
    });

    it('hover 到 waste', () => {
      startEngine(engine);
      engine.handleMouseMove(wasteCenter().x, wasteCenter().y);
      expect((engine as any)._hoverTarget).not.toBeNull();
      expect((engine as any)._hoverTarget.area).toBe('waste');
    });

    it('hover 到 foundation 各列', () => {
      startEngine(engine);
      for (let i = 0; i < 4; i++) {
        engine.handleMouseMove(foundationCenterX(i), foundationCenterY());
        expect((engine as any)._hoverTarget).not.toBeNull();
        expect((engine as any)._hoverTarget.area).toBe('foundation');
        expect((engine as any)._hoverTarget.col).toBe(i);
      }
    });

    it('hover 到 tableau', () => {
      startEngine(engine);
      engine.handleMouseMove(tableauCenterX(0), TABLEAU_Y + 5);
      expect((engine as any)._hoverTarget).not.toBeNull();
      expect((engine as any)._hoverTarget.area).toBe('tableau');
    });

    it('拖拽中移动更新 hover', () => {
      startEngine(engine);
      getWaste(engine).push(makeCard('hearts', 'Q'));
      engine.handleMouseDown(wasteCenter().x, wasteCenter().y);
      engine.handleMouseMove(foundationCenterX(1), foundationCenterY());
      expect((engine as any)._hoverTarget).not.toBeNull();
      expect((engine as any)._hoverTarget.area).toBe('foundation');
      expect((engine as any)._hoverTarget.col).toBe(1);
    });
  });

  describe('findFoundationTarget 辅助方法', () => {
    it('空 foundation 时 A 可以放置', () => {
      startEngine(engine);
      const result = (engine as any).findFoundationTarget(makeCard('spades', 'A'));
      expect(result).toBe(0); // 第一个空 foundation
    });

    it('匹配花色和点数时可以放置', () => {
      startEngine(engine);
      getFoundations(engine)[0].push(makeCard('spades', 'A'));
      const result = (engine as any).findFoundationTarget(makeCard('spades', '2'));
      expect(result).toBe(0);
    });

    it('不匹配时返回 -1', () => {
      startEngine(engine);
      getFoundations(engine)[0].push(makeCard('spades', 'A'));
      const result = (engine as any).findFoundationTarget(makeCard('hearts', '2'));
      expect(result).toBe(-1);
    });

    it('非 A 不能放到空 foundation', () => {
      startEngine(engine);
      const result = (engine as any).findFoundationTarget(makeCard('spades', 'K'));
      expect(result).toBe(-1);
    });

    it('同花色跳过已占用的 foundation', () => {
      startEngine(engine);
      getFoundations(engine)[0].push(makeCard('spades', 'A'));
      getFoundations(engine)[1].push(makeCard('hearts', 'A'));
      // 2♠ 应找到第 0 个 foundation
      const result = (engine as any).findFoundationTarget(makeCard('spades', '2'));
      expect(result).toBe(0);
    });
  });

  describe('翻牌计分', () => {
    it('拖拽放置后翻开 tableau 顶牌加分', () => {
      startEngine(engine);
      // 设置第 0 列：面朝下的 K♠，面朝上的 Q♥
      getTableau(engine)[0] = [
        makeCard('spades', 'K', false),
        makeCard('hearts', 'Q', true),
      ];
      // 设置第 1 列：空列
      getTableau(engine)[1] = [];
      // 拖 Q♥ 到空列 → Q 不是 K，不能放
      // 换个方案：设置第 1 列有 K♠
      getTableau(engine)[1] = [makeCard('spades', 'K')];
      // 拖 Q♥（红）到 K♠（黑）→ 合法
      const cy = TABLEAU_Y + TABLEAU_OVERLAP_FACE_DOWN + 5; // Q♥ 的位置
      engine.handleMouseDown(TABLEAU_X_START + 5, cy);
      engine.handleMouseMove(tableauCenterX(1), TABLEAU_Y + 5);
      engine.handleMouseUp(tableauCenterX(1), TABLEAU_Y + 5);
      // Q♥ 成功移动，K♠ 被翻开
      expect(getTableau(engine)[0].length).toBe(1);
      expect(getTableau(engine)[0][0].faceUp).toBe(true);
      expect(engine.score).toBe(SCORE_FLIP); // 翻牌加分
    });
  });

  describe('stock 回收后点击', () => {
    it('stock 空时点击回收 waste', () => {
      startEngine(engine);
      // 清空 stock
      const stockLen = getStock(engine).length;
      for (let i = 0; i < stockLen; i++) {
        engine.drawFromStock();
      }
      expect(getStock(engine).length).toBe(0);
      expect(getWaste(engine).length).toBeGreaterThan(0);
      // 点击 stock 回收
      engine.handleClick(stockCenter().x, stockCenter().y);
      expect(getStock(engine).length).toBeGreaterThan(0);
      expect(getWaste(engine).length).toBe(0);
    });
  });
});
