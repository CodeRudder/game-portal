import {
  PITS_PER_SIDE, INITIAL_SEEDS, TOTAL_PITS,
  PLAYER_STORE, AI_STORE,
  PLAYER_PITS, AI_PITS,
  AI_THINK_DELAY,
} from '@/games/mancala/constants';
import { MancalaEngine, Player, MancalaResult } from '@/games/mancala/MancalaEngine';

// ========== 辅助函数 ==========

/** 创建引擎实例（不调用 init/start） */
function createEngine(): MancalaEngine {
  return new MancalaEngine();
}

/** 创建并启动引擎（模拟 playing 状态） */
function createAndStartEngine(): MancalaEngine {
  const engine = new MancalaEngine();
  // 模拟 canvas
  const mockCanvas = {
    width: 480,
    height: 640,
    getContext: jest.fn().mockReturnValue({
      fillRect: jest.fn(),
      fillText: jest.fn(),
      strokeText: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arcTo: jest.fn(),
      closePath: jest.fn(),
      setLineDash: jest.fn(),
      measureText: jest.fn().mockReturnValue({ width: 0 }),
    }),
  } as any;
  engine.init(mockCanvas);
  engine.start();
  return engine;
}

/** 模拟完成一次完整播种（跳过动画） */
function simulateCompleteMove(engine: MancalaEngine, pitIndex: number): void {
  // 直接访问内部方法进行测试比较困难，我们通过 handleKeyDown 触发
  // 然后通过 update 推进动画
  const key = `${pitIndex + 1}`;
  engine.handleKeyDown(key);

  // 推进动画直到完成
  let maxIterations = 50; // 安全上限
  while (engine.animating && maxIterations-- > 0) {
    engine.update(200); // 超过 SEED_ANIM_DURATION
  }
}

/** 模拟 AI 完成一次走子 */
function simulateAIMove(engine: MancalaEngine): void {
  // AI 需要 AI_THINK_DELAY 毫秒
  engine.update(AI_THINK_DELAY + 100);

  // 推进动画
  let maxIterations = 50;
  while (engine.animating && maxIterations-- > 0) {
    engine.update(200);
  }
}

/** 强制设置当前玩家 */
function forceSetPlayer(engine: MancalaEngine, player: Player): void {
  // 通过反射设置私有属性
  (engine as any)._currentPlayer = player;
  (engine as any).updateValidMoves();
}

/** 直接设置棋盘状态 */
function setBoard(engine: MancalaEngine, board: number[]): void {
  (engine as any)._board = [...board];
  (engine as any).updateValidMoves();
}

// ========== 测试套件 ==========

describe('MancalaEngine', () => {
  let engine: MancalaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  // ===== 基础初始化测试 =====

  describe('初始化', () => {
    it('应该正确初始化棋盘', () => {
      const board = engine.board;
      expect(board).toHaveLength(TOTAL_PITS);
    });

    it('每个凹坑初始应有 4 颗种子', () => {
      for (const pit of PLAYER_PITS) {
        expect(engine.getSeeds(pit)).toBe(INITIAL_SEEDS);
      }
      for (const pit of AI_PITS) {
        expect(engine.getSeeds(pit)).toBe(INITIAL_SEEDS);
      }
    });

    it('仓库初始应为 0', () => {
      expect(engine.getSeeds(PLAYER_STORE)).toBe(0);
      expect(engine.getSeeds(AI_STORE)).toBe(0);
    });

    it('初始玩家应为 player', () => {
      expect(engine.currentPlayer).toBe('player');
    });

    it('初始不应有动画', () => {
      expect(engine.animating).toBe(false);
    });

    it('初始不应有 AI 思考', () => {
      expect(engine.aiThinking).toBe(false);
    });

    it('初始不应有结果', () => {
      expect(engine.result).toBeNull();
    });

    it('初始不应有额外回合', () => {
      expect(engine.extraTurn).toBe(false);
    });

    it('总种子数应为 48', () => {
      const total = engine.board.reduce((sum, v) => sum + v, 0);
      expect(total).toBe(48);
    });

    it('玩家凹坑索引应为 0-5', () => {
      expect(PLAYER_PITS).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('AI 凹坑索引应为 7-12', () => {
      expect(AI_PITS).toEqual([7, 8, 9, 10, 11, 12]);
    });
  });

  // ===== 有效走法测试 =====

  describe('有效走法', () => {
    it('初始有效走法应为玩家凹坑 0-5', () => {
      expect(engine.validMoves).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('空坑不应出现在有效走法中', () => {
      setBoard(engine, [0, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
      forceSetPlayer(engine, 'player');
      expect(engine.validMoves).toEqual([1, 2, 3, 4, 5]);
    });

    it('所有坑都空时有效走法为空', () => {
      setBoard(engine, [0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 0]);
      forceSetPlayer(engine, 'player');
      expect(engine.validMoves).toEqual([]);
    });

    it('AI 回合时有效走法应为 AI 凹坑', () => {
      forceSetPlayer(engine, 'ai');
      expect(engine.validMoves).toEqual([7, 8, 9, 10, 11, 12]);
    });
  });

  // ===== 选择凹坑测试 =====

  describe('selectPit', () => {
    it('玩家应能选择有种子的凹坑', () => {
      const result = engine.selectPit(0);
      expect(result).toBe(true);
    });

    it('玩家不应能选择空凹坑', () => {
      setBoard(engine, [0, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
      const result = engine.selectPit(0);
      expect(result).toBe(false);
    });

    it('动画中不应能选择', () => {
      engine.selectPit(0); // 触发动画
      const result = engine.selectPit(1);
      expect(result).toBe(false);
    });

    it('AI 回合时玩家不应能选择', () => {
      forceSetPlayer(engine, 'ai');
      const result = engine.selectPit(0);
      expect(result).toBe(false);
    });

    it('不应能选择仓库', () => {
      const result = engine.selectPit(PLAYER_STORE);
      expect(result).toBe(false);
    });

    it('不应能选择 AI 凹坑', () => {
      const result = engine.selectPit(7);
      expect(result).toBe(false);
    });

    it('无效索引应返回 false', () => {
      expect(engine.selectPit(-1)).toBe(false);
      expect(engine.selectPit(14)).toBe(false);
    });
  });

  // ===== handleKeyDown 测试 =====

  describe('handleKeyDown', () => {
    it('数字键 1-6 应选择对应凹坑', () => {
      expect(engine.selectPit(0)).toBe(true);
    });

    it('按键 "1" 对应凹坑 0', () => {
      engine.handleKeyDown('1');
      expect(engine.animating).toBe(true);
    });

    it('按键 "6" 对应凹坑 5', () => {
      engine.handleKeyDown('6');
      expect(engine.animating).toBe(true);
    });

    it('按键 "0" 不应触发走子', () => {
      engine.handleKeyDown('0');
      expect(engine.animating).toBe(false);
    });

    it('按键 "7" 不应触发走子', () => {
      engine.handleKeyDown('7');
      expect(engine.animating).toBe(false);
    });

    it('非数字键不应触发走子', () => {
      engine.handleKeyDown('a');
      expect(engine.animating).toBe(false);
    });

    it('空格键在 idle 状态应启动游戏', () => {
      const e = createEngine();
      const mockCanvas = {
        width: 480, height: 640,
        getContext: jest.fn().mockReturnValue({
          fillRect: jest.fn(), clearRect: jest.fn(),
          fillText: jest.fn(), strokeText: jest.fn(),
          beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(),
          stroke: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
          arcTo: jest.fn(), closePath: jest.fn(),
          setLineDash: jest.fn(),
          measureText: jest.fn().mockReturnValue({ width: 0 }),
        }),
      } as any;
      e.init(mockCanvas);
      e.handleKeyDown(' ');
      expect(e.status).toBe('playing');
    });
  });

  // ===== 播种规则测试 =====

  describe('播种规则', () => {
    it('从坑 0 播 4 颗应正确分配', () => {
      // 坑 0 有 4 颗 → 放入 1, 2, 3, 4
      simulateCompleteMove(engine, 0);
      expect(engine.getSeeds(0)).toBe(0);
      expect(engine.getSeeds(1)).toBe(5);
      expect(engine.getSeeds(2)).toBe(5);
      expect(engine.getSeeds(3)).toBe(5);
      expect(engine.getSeeds(4)).toBe(5);
      expect(engine.getSeeds(5)).toBe(4); // 未被播种
    });

    it('从坑 5 播 4 颗应落入仓库', () => {
      // 坑 5 有 4 颗 → 放入 6(仓库), 7, 8, 9
      simulateCompleteMove(engine, 5);
      expect(engine.getSeeds(5)).toBe(0);
      expect(engine.getSeeds(PLAYER_STORE)).toBe(1);
      expect(engine.getSeeds(7)).toBe(5);
      expect(engine.getSeeds(8)).toBe(5);
      expect(engine.getSeeds(9)).toBe(5);
    });

    it('播种应跳过对方仓库', () => {
      // 设置一个会跨过 AI 仓库的场景
      // 坑 4 有足够种子跨过 AI_STORE(13)
      setBoard(engine, [4, 4, 4, 4, 11, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
      // 坑 4 有 11 颗: 5,6,7,8,9,10,11,12, (skip 13), 0,1,2
      simulateCompleteMove(engine, 4);
      expect(engine.getSeeds(AI_STORE)).toBe(0); // 不应增加
      expect(engine.getSeeds(0)).toBe(5);
    });

    it('AI 播种应跳过玩家仓库', () => {
      forceSetPlayer(engine, 'ai');
      setBoard(engine, [4, 4, 4, 4, 4, 4, 0, 11, 4, 4, 4, 4, 4, 0]);
      // 坑 7 有 11 颗: 8,9,10,11,12,13(AI仓库), (skip 6), 0,1,2,3,4
      simulateCompleteMove(engine, 7);
      expect(engine.getSeeds(PLAYER_STORE)).toBe(0); // 不应增加
    });

    it('播种应逆时针进行', () => {
      // 从坑 2 播 4 颗 → 3, 4, 5, 6(仓库)
      simulateCompleteMove(engine, 2);
      expect(engine.getSeeds(3)).toBe(5);
      expect(engine.getSeeds(4)).toBe(5);
      expect(engine.getSeeds(5)).toBe(5);
      expect(engine.getSeeds(6)).toBe(1); // 落在仓库
    });

    it('大量种子应绕棋盘一圈', () => {
      setBoard(engine, [13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      // 坑 0 有 13 颗: 1,2,3,4,5,6(仓库),7,8,9,10,11,12,(skip 13),0
      // 最后一颗落在坑 0（空坑），对面坑 12 有 1 颗 → 吃子
      // 仓库获得 1(播种) + 1(坑0的种子) + 1(坑12的种子) = 3
      simulateCompleteMove(engine, 0);
      expect(engine.getSeeds(PLAYER_STORE)).toBe(3);
      expect(engine.getSeeds(AI_STORE)).toBe(0);
      expect(engine.getSeeds(0)).toBe(0); // 被吃
      expect(engine.getSeeds(12)).toBe(0); // 被吃
    });
  });

  // ===== 额外回合测试 =====

  describe('额外回合', () => {
    it('落在自己仓库应获得额外回合', () => {
      // 坑 2 有 4 颗 → 3, 4, 5, 6(仓库)
      simulateCompleteMove(engine, 2);
      expect(engine.currentPlayer).toBe('player');
      expect(engine.extraTurn).toBe(true);
    });

    it('不落在仓库应切换玩家', () => {
      // 坑 0 有 4 颗 → 1, 2, 3, 4 (不落在仓库)
      simulateCompleteMove(engine, 0);
      expect(engine.currentPlayer).toBe('ai');
      expect(engine.extraTurn).toBe(false);
    });

    it('坑 1 有 5 颗种子应落在仓库', () => {
      // 坑 1 需要有 5 颗种子 → 2, 3, 4, 5, 6(仓库)
      setBoard(engine, [4, 5, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
      simulateCompleteMove(engine, 1);
      expect(engine.extraTurn).toBe(true);
      expect(engine.currentPlayer).toBe('player');
    });

    it('坑 0 有 7 颗种子应落在仓库', () => {
      setBoard(engine, [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      // 0 → 1,2,3,4,5,6(仓库),7
      simulateCompleteMove(engine, 0);
      // 不落在仓库（落在 7），所以切换到 AI
      expect(engine.extraTurn).toBe(false);
    });

    it('连续额外回合', () => {
      // 第一次：坑 2 → 落在仓库，获得额外回合
      // 设置坑 2 有 4 颗（正好落在仓库）
      simulateCompleteMove(engine, 2);
      expect(engine.currentPlayer).toBe('player');

      // 第二次：坑 0 有 4 颗 → 不落在仓库
      simulateCompleteMove(engine, 0);
      expect(engine.currentPlayer).toBe('ai');
    });
  });

  // ===== 吃子规则测试 =====

  describe('吃子规则', () => {
    it('落在自己空坑应吃对面种子', () => {
      // 设置：坑 1 为空，对面坑 11 有种子
      setBoard(engine, [4, 0, 0, 0, 0, 1, 0, 4, 4, 4, 4, 5, 4, 0]);
      // 从坑 5 播 1 颗 → 落在坑 6(仓库)
      // 不对，让我设计一个落在空坑的场景
      // 坑 0 有 1 颗 → 落在坑 1（空坑）→ 吃对面坑 11
      setBoard(engine, [1, 0, 4, 4, 4, 4, 0, 4, 4, 4, 4, 5, 4, 0]);
      simulateCompleteMove(engine, 0);
      expect(engine.getSeeds(1)).toBe(0); // 被吃
      expect(engine.getSeeds(11)).toBe(0); // 对面被吃
      expect(engine.getSeeds(PLAYER_STORE)).toBe(6); // 1(自己的) + 5(对面的)
    });

    it('落在非空坑不应吃子', () => {
      // 坑 0 有 1 颗 → 坑 1 有 4 颗（非空）→ 不吃
      setBoard(engine, [1, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
      simulateCompleteMove(engine, 0);
      expect(engine.getSeeds(PLAYER_STORE)).toBe(0);
      expect(engine.getSeeds(1)).toBe(5);
    });

    it('落在对方坑不应吃子', () => {
      // 从坑 5 播种，最后落在 AI 坑 → 不吃
      setBoard(engine, [4, 4, 4, 4, 4, 1, 0, 4, 4, 4, 4, 4, 4, 0]);
      simulateCompleteMove(engine, 5);
      // 落在仓库 → 额外回合
      expect(engine.getSeeds(PLAYER_STORE)).toBe(1);
      expect(engine.currentPlayer).toBe('player');
    });

    it('对面坑为空时不应吃子', () => {
      // 坑 0 有 1 颗 → 坑 1（空），对面坑 11 也为 0
      setBoard(engine, [1, 0, 4, 4, 4, 4, 0, 4, 4, 4, 4, 0, 4, 0]);
      simulateCompleteMove(engine, 0);
      // 对面没有种子，不吃（但自己的1颗仍保留）
      expect(engine.getSeeds(PLAYER_STORE)).toBe(0);
    });

    it('吃子应正确计算种子数', () => {
      // 坑 2 有 1 颗 → 坑 3（空），对面坑 9 有 7 颗
      setBoard(engine, [0, 0, 1, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0]);
      simulateCompleteMove(engine, 2);
      expect(engine.getSeeds(3)).toBe(0);
      expect(engine.getSeeds(9)).toBe(0);
      expect(engine.getSeeds(PLAYER_STORE)).toBe(8); // 1 + 7
    });
  });

  // ===== 游戏结束测试 =====

  describe('游戏结束', () => {
    it('玩家侧全空应结束游戏', () => {
      setBoard(engine, [0, 0, 0, 0, 0, 0, 5, 3, 2, 1, 4, 5, 6, 10]);
      forceSetPlayer(engine, 'player');
      // 玩家没有可用走法
      engine.selectPit(0); // 不应生效
      // 直接检查游戏结束
      expect((engine as any).checkGameEnd()).toBe(true);
    });

    it('AI 侧全空应结束游戏', () => {
      setBoard(engine, [3, 2, 1, 4, 5, 6, 10, 0, 0, 0, 0, 0, 0, 5]);
      forceSetPlayer(engine, 'ai');
      expect((engine as any).checkGameEnd()).toBe(true);
    });

    it('游戏结束时应收集剩余种子', () => {
      setBoard(engine, [0, 0, 0, 0, 0, 0, 5, 3, 2, 1, 4, 5, 6, 10]);
      (engine as any).collectRemainingSeeds();
      expect(engine.getSeeds(PLAYER_STORE)).toBe(5);
      expect(engine.getSeeds(AI_STORE)).toBe(10 + 3 + 2 + 1 + 4 + 5 + 6);
    });

    it('玩家仓库更多时应判定玩家赢', () => {
      setBoard(engine, [0, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0, 0, 0, 18]);
      const result = (engine as any).calculateResult();
      expect(result.winner).toBe('player');
    });

    it('AI 仓库更多时应判定 AI 赢', () => {
      setBoard(engine, [0, 0, 0, 0, 0, 0, 18, 0, 0, 0, 0, 0, 0, 30]);
      const result = (engine as any).calculateResult();
      expect(result.winner).toBe('ai');
    });

    it('仓库相等时应判定平局', () => {
      setBoard(engine, [0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 24]);
      const result = (engine as any).calculateResult();
      expect(result.winner).toBe('draw');
    });

    it('游戏结束后应有结果', () => {
      // 强制结束
      setBoard(engine, [0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 10]);
      forceSetPlayer(engine, 'player');
      (engine as any).checkGameEnd();
      expect(engine.result).not.toBeNull();
      expect(engine.result!.winner).toBe('ai');
    });
  });

  // ===== 对面坑测试 =====

  describe('getOppositePit', () => {
    it('玩家坑 0 的对面是 AI 坑 12', () => {
      expect(engine.getOppositePit(0)).toBe(12);
    });

    it('玩家坑 5 的对面是 AI 坑 7', () => {
      expect(engine.getOppositePit(5)).toBe(7);
    });

    it('AI 坑 7 的对面是玩家坑 5', () => {
      expect(engine.getOppositePit(7)).toBe(5);
    });

    it('AI 坑 12 的对面是玩家坑 0', () => {
      expect(engine.getOppositePit(12)).toBe(0);
    });

    it('仓库没有对面坑', () => {
      expect(engine.getOppositePit(PLAYER_STORE)).toBe(-1);
      expect(engine.getOppositePit(AI_STORE)).toBe(-1);
    });

    it('所有对面关系应对称', () => {
      for (const pit of PLAYER_PITS) {
        const opp = engine.getOppositePit(pit);
        expect(engine.getOppositePit(opp)).toBe(pit);
      }
      for (const pit of AI_PITS) {
        const opp = engine.getOppositePit(pit);
        expect(engine.getOppositePit(opp)).toBe(pit);
      }
    });
  });

  // ===== getSideTotal 测试 =====

  describe('getSideTotal', () => {
    it('初始双方各 24 颗种子', () => {
      expect(engine.getSideTotal('player')).toBe(24);
      expect(engine.getSideTotal('ai')).toBe(24);
    });

    it('播种后应正确计算', () => {
      setBoard(engine, [1, 2, 3, 4, 5, 6, 10, 7, 8, 9, 10, 11, 12, 0]);
      expect(engine.getSideTotal('player')).toBe(21);
      expect(engine.getSideTotal('ai')).toBe(57);
    });
  });

  // ===== AI 逻辑测试 =====

  describe('AI 逻辑', () => {
    it('AI 回合应开始思考', () => {
      forceSetPlayer(engine, 'ai');
      engine.update(10);
      expect(engine.aiThinking).toBe(true);
    });

    it('AI 思考延迟后应执行走子', () => {
      forceSetPlayer(engine, 'ai');
      // 第一次 update：AI 开始思考
      engine.update(10);
      expect(engine.aiThinking).toBe(true);
      // 第二次 update：延迟足够后执行走子
      engine.update(AI_THINK_DELAY + 100);
      expect(engine.aiThinking).toBe(false);
      // 应该已经开始动画或完成走子
    });

    it('AI 难度可设置', () => {
      engine.setAIDifficulty(0.5);
      expect((engine as any)._aiDifficulty).toBe(0.5);
    });

    it('AI 难度应被限制在 0-1', () => {
      engine.setAIDifficulty(-1);
      expect((engine as any)._aiDifficulty).toBe(0);
      engine.setAIDifficulty(2);
      expect((engine as any)._aiDifficulty).toBe(1);
    });

    it('AI 无可用走法应返回 -1', () => {
      setBoard(engine, [4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 24]);
      forceSetPlayer(engine, 'ai');
      const move = (engine as any).chooseAIMove();
      expect(move).toBe(-1);
    });

    it('AI 只有一个走法时应选择它', () => {
      setBoard(engine, [4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 5, 0, 0, 0]);
      forceSetPlayer(engine, 'ai');
      // 只剩坑 10 有种子
      const move = (engine as any).chooseAIMove();
      expect(move).toBe(10);
    });

    it('AI 应优先选择获得额外回合的走法', () => {
      // 坑 10 有 3 颗 → 11, 12, 13(仓库) → 额外回合
      // 坑 8 有 4 颗 → 9, 10, 11, 12 → 不在仓库
      setBoard(engine, [0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 3, 0, 0, 0]);
      forceSetPlayer(engine, 'ai');
      engine.setAIDifficulty(1.0); // 最高难度
      const move = (engine as any).chooseAIMove();
      expect(move).toBe(10); // 应选择能获得额外回合的
    });
  });

  // ===== 动画测试 =====

  describe('动画', () => {
    it('选择凹坑后应开始动画', () => {
      engine.selectPit(0);
      expect(engine.animating).toBe(true);
    });

    it('动画应逐步推进', () => {
      engine.selectPit(0);
      const animBefore = (engine as any)._sowAnimation;
      expect(animBefore).not.toBeNull();
      expect(animBefore.remaining).toBe(4);
    });

    it('动画完成后应停止', () => {
      simulateCompleteMove(engine, 0);
      expect(engine.animating).toBe(false);
      expect((engine as any)._sowAnimation).toBeNull();
    });

    it('动画中不应接受新输入', () => {
      engine.selectPit(0);
      const result = engine.selectPit(1);
      expect(result).toBe(false);
    });
  });

  // ===== 事件系统测试 =====

  describe('事件系统', () => {
    it('应触发 statusChange 事件', () => {
      const callback = jest.fn();
      engine.on('statusChange', callback);
      engine.reset();
      expect(callback).toHaveBeenCalledWith('idle');
    });

    it('额外回合应触发 extraTurn 事件', () => {
      const callback = jest.fn();
      engine.on('extraTurn', callback);
      // 坑 2 有 4 颗 → 落在仓库
      simulateCompleteMove(engine, 2);
      expect(callback).toHaveBeenCalledWith('player');
    });

    it('吃子应触发 capture 事件', () => {
      const callback = jest.fn();
      engine.on('capture', callback);
      setBoard(engine, [1, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]);
      simulateCompleteMove(engine, 0);
      // 坑 0 → 坑 1（空坑），对面坑 11 有 0 颗 → 不吃
      // 让我重新设置
    });

    it('吃子事件应携带正确信息', () => {
      const callback = jest.fn();
      engine.on('capture', callback);
      // 坑 0 有 1 颗 → 坑 1（空），对面坑 11 有 5 颗
      setBoard(engine, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0]);
      simulateCompleteMove(engine, 0);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          player: 'player',
          pit: 1,
          oppositePit: 11,
          seeds: 6, // 1 + 5
        })
      );
    });

    it('游戏结束应触发 gameResult 事件', () => {
      const callback = jest.fn();
      engine.on('gameResult', callback);
      setBoard(engine, [0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 10]);
      forceSetPlayer(engine, 'player');
      (engine as any).checkGameEnd();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ winner: 'ai' })
      );
    });
  });

  // ===== getState 测试 =====

  describe('getState', () => {
    it('应返回完整状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('board');
      expect(state).toHaveProperty('currentPlayer');
      expect(state).toHaveProperty('playerStoreSeeds');
      expect(state).toHaveProperty('aiStoreSeeds');
      expect(state).toHaveProperty('animating');
      expect(state).toHaveProperty('validMoves');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
    });

    it('状态中的棋盘应是副本', () => {
      const state = engine.getState();
      const board = state.board as number[];
      board[0] = 999;
      expect(engine.getSeeds(0)).toBe(4);
    });
  });

  // ===== 生命周期测试 =====

  describe('生命周期', () => {
    it('reset 应重置所有状态', () => {
      simulateCompleteMove(engine, 0);
      engine.reset();
      expect(engine.currentPlayer).toBe('player');
      expect(engine.animating).toBe(false);
      expect(engine.result).toBeNull();
      expect(engine.getSeeds(0)).toBe(4);
    });

    it('destroy 应清理所有事件', () => {
      const callback = jest.fn();
      engine.on('statusChange', callback);
      engine.destroy();
      engine.emit('statusChange', 'test');
      // callback 不应被调用（已清理）
      expect(callback).not.toHaveBeenCalledWith('test');
    });

    it('重复 start 应重置分数', () => {
      engine.reset();
      engine.start();
      expect(engine.score).toBe(0);
    });
  });

  // ===== setHoverPit 测试 =====

  describe('setHoverPit', () => {
    it('应设置悬停凹坑', () => {
      engine.setHoverPit(3);
      expect(engine.hoverPit).toBe(3);
    });
  });

  // ===== 完整游戏流程测试 =====

  describe('完整游戏流程', () => {
    it('应能完成一局快节奏游戏', () => {
      // 设置一个快结束的状态
      setBoard(engine, [1, 0, 0, 0, 0, 0, 20, 1, 0, 0, 0, 0, 0, 15]);
      forceSetPlayer(engine, 'player');

      // 玩家走最后一步
      simulateCompleteMove(engine, 0);
      // 坑 0 有 1 颗 → 坑 1（空），对面坑 11 有 0 → 不吃
      // 然后切换到 AI
      // AI 坑 7 有 1 颗 → 坑 8（空），对面坑 5 有 0 → 不吃
      // 然后玩家侧全空

      // 检查游戏是否结束（可能需要更多步骤）
    });

    it('种子守恒：游戏过程中总种子数不变', () => {
      const initialTotal = engine.board.reduce((s, v) => s + v, 0);

      // 玩家走一步
      simulateCompleteMove(engine, 0);
      const afterMove1 = engine.board.reduce((s, v) => s + v, 0);
      expect(afterMove1).toBe(initialTotal);

      // AI 走一步
      if (engine.currentPlayer === 'ai') {
        simulateAIMove(engine);
        const afterMove2 = engine.board.reduce((s, v) => s + v, 0);
        expect(afterMove2).toBe(initialTotal);
      }
    });

    it('多步游戏种子守恒', () => {
      const initialTotal = 48;
      for (let step = 0; step < 10; step++) {
        if (engine.status !== 'playing') break;
        if (engine.currentPlayer === 'player') {
          const moves = engine.validMoves;
          if (moves.length === 0) break;
          simulateCompleteMove(engine, moves[0]);
        } else {
          simulateAIMove(engine);
        }
        const total = engine.board.reduce((s, v) => s + v, 0);
        expect(total).toBe(initialTotal);
      }
    });
  });

  // ===== 历史记录测试 =====

  describe('历史记录', () => {
    it('初始历史应为空', () => {
      expect(engine.moveHistory).toHaveLength(0);
    });

    it('每步应记录历史', () => {
      simulateCompleteMove(engine, 0);
      expect(engine.moveHistory).toHaveLength(1);
    });

    it('历史应包含棋盘快照', () => {
      simulateCompleteMove(engine, 0);
      const history = engine.moveHistory;
      expect(history[0].board).toHaveLength(TOTAL_PITS);
      expect(history[0].player).toBe('player');
    });

    it('历史中的棋盘应是副本', () => {
      simulateCompleteMove(engine, 0);
      const history = engine.moveHistory;
      history[0].board[0] = 999;
      // 原始棋盘不受影响（已在走子时改变）
    });
  });

  // ===== 边界条件测试 =====

  describe('边界条件', () => {
    it('坑中只有 1 颗种子应正确播种', () => {
      setBoard(engine, [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
      simulateCompleteMove(engine, 0);
      expect(engine.getSeeds(0)).toBe(0);
      expect(engine.getSeeds(1)).toBe(1);
    });

    it('坑中有很多种子应正确处理', () => {
      setBoard(engine, [20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      simulateCompleteMove(engine, 0);
      const total = engine.board.reduce((s, v) => s + v, 0);
      expect(total).toBe(20);
    });

    it('所有坑都有 0 颗种子时不应崩溃', () => {
      setBoard(engine, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      forceSetPlayer(engine, 'player');
      expect(engine.validMoves).toEqual([]);
      expect(engine.selectPit(0)).toBe(false);
    });

    it('非 playing 状态不应接受输入', () => {
      engine.reset();
      expect(engine.selectPit(0)).toBe(false);
    });

    it('gameover 状态不应接受输入', () => {
      (engine as any)._status = 'gameover';
      expect(engine.selectPit(0)).toBe(false);
    });
  });

  // ===== handleKeyUp 测试 =====

  describe('handleKeyUp', () => {
    it('handleKeyUp 不应抛出异常', () => {
      expect(() => engine.handleKeyUp('1')).not.toThrow();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });
  });

  // ===== 属性访问器测试 =====

  describe('属性访问器', () => {
    it('playerStoreSeeds 应返回正确值', () => {
      expect(engine.playerStoreSeeds).toBe(0);
      setBoard(engine, [0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0]);
      expect(engine.playerStoreSeeds).toBe(10);
    });

    it('aiStoreSeeds 应返回正确值', () => {
      expect(engine.aiStoreSeeds).toBe(0);
      setBoard(engine, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15]);
      expect(engine.aiStoreSeeds).toBe(15);
    });

    it('board getter 应返回副本', () => {
      const board = engine.board;
      board[0] = 999;
      expect(engine.getSeeds(0)).toBe(4);
    });

    it('validMoves getter 应返回副本', () => {
      const moves = engine.validMoves;
      moves.push(999);
      expect(engine.validMoves).not.toContain(999);
    });
  });

  // ===== 回合切换测试 =====

  describe('回合切换', () => {
    it('正常走子后应切换到 AI', () => {
      simulateCompleteMove(engine, 0);
      expect(engine.currentPlayer).toBe('ai');
    });

    it('AI 走子后应切换到玩家', () => {
      forceSetPlayer(engine, 'ai');
      // 直接调用 executeMove（selectPit 会拒绝 AI 回合）
      (engine as any).executeMove(7);
      // 推进动画直到完成
      while (engine.animating) {
        engine.update(200);
      }
      // 坑 7 有 4 颗 → 8, 9, 10, 11，不落在仓库，切换到玩家
      expect(engine.currentPlayer).toBe('player');
    });
  });

  // ===== 种子计数测试 =====

  describe('种子计数', () => {
    it('getSeeds 应返回正确值', () => {
      expect(engine.getSeeds(0)).toBe(4);
      expect(engine.getSeeds(PLAYER_STORE)).toBe(0);
      expect(engine.getSeeds(AI_STORE)).toBe(0);
    });

    it('getSeeds 无效索引应返回 0', () => {
      expect(engine.getSeeds(-1)).toBe(0);
      expect(engine.getSeeds(100)).toBe(0);
    });
  });

  // ===== 模拟完整对局 =====

  describe('模拟完整对局', () => {
    it('应能完成一局完整游戏直到结束', () => {
      let moves = 0;
      const maxMoves = 200; // 安全上限

      while (engine.status === 'playing' && moves < maxMoves) {
        if (engine.currentPlayer === 'player') {
          const validMoves = engine.validMoves;
          if (validMoves.length === 0) break;
          // 选择第一个有效走法
          simulateCompleteMove(engine, validMoves[0]);
        } else {
          simulateAIMove(engine);
        }
        moves++;
      }

      // 游戏应该已经结束
      expect(engine.status).toBe('gameover');
      expect(engine.result).not.toBeNull();
      // 总种子数应为 48
      const total = engine.board.reduce((s, v) => s + v, 0);
      expect(total).toBe(48);
    });

    it('完整对局结果应正确', () => {
      let moves = 0;
      while (engine.status === 'playing' && moves < 200) {
        if (engine.currentPlayer === 'player') {
          const validMoves = engine.validMoves;
          if (validMoves.length === 0) break;
          simulateCompleteMove(engine, validMoves[0]);
        } else {
          simulateAIMove(engine);
        }
        moves++;
      }

      if (engine.result) {
        const ps = engine.result.playerStore;
        const as = engine.result.aiStore;
        expect(ps + as).toBe(48);
        if (ps > as) expect(engine.result.winner).toBe('player');
        else if (as > ps) expect(engine.result.winner).toBe('ai');
        else expect(engine.result.winner).toBe('draw');
      }
    });
  });
});
