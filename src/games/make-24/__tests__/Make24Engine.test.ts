// ========== Make24Engine 测试 ==========
// 纯逻辑测试，不依赖 DOM/Canvas

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Make24Engine,
  canMakeTarget,
  solveMake24,
  validateExpression,
  safeEval,
} from '@/games/make-24/Make24Engine';
import {
  MIN_CARD_VALUE, MAX_CARD_VALUE, CARD_COUNT,
  BASE_SCORE, TIME_BONUS_FACTOR, HINT_PENALTY, SKIP_PENALTY,
  TARGET_RESULT, STREAK_BONUS,
  DIFFICULTY_CONFIG,
  SUCCESS_COLOR, ERROR_COLOR,
} from '@/games/make-24/constants';

// ========== 辅助：创建引擎实例 ==========

function createEngine(): Make24Engine {
  const engine = new Make24Engine();
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  engine.init(canvas);
  return engine;
}

function createAndStartEngine(): Make24Engine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 设置牌面为指定值，方便测试 */
function setCardValues(engine: Make24Engine, values: number[]): void {
  const cards = engine.cards;
  for (let i = 0; i < values.length && i < cards.length; i++) {
    cards[i].value = values[i];
  }
}

/** 构建并提交一个 6+6+6+6=24 的正确表达式 */
function buildCorrectExpression(engine: Make24Engine): void {
  setCardValues(engine, [6, 6, 6, 6]);
  engine.selectCard(0);
  engine.addOperator('+');
  engine.selectCard(1);
  engine.addOperator('+');
  engine.selectCard(2);
  engine.addOperator('+');
  engine.selectCard(3);
}

// ========================================
// 1. canMakeTarget 求解器测试
// ========================================

describe('canMakeTarget', () => {
  it('经典 24 点组合 [1,2,3,4] 有解', () => {
    expect(canMakeTarget([1, 2, 3, 4])).toBe(true); // 1*2*3*4 = 24
  });

  it('[8, 3, 8, 3] 有解', () => {
    expect(canMakeTarget([8, 3, 8, 3])).toBe(true); // 8/(3-8/3) = 24
  });

  it('[1, 1, 1, 1] 无解', () => {
    expect(canMakeTarget([1, 1, 1, 1])).toBe(false);
  });

  it('[1, 1, 1, 2] 无解', () => {
    expect(canMakeTarget([1, 1, 1, 2])).toBe(false);
  });

  it('[5, 5, 5, 1] 有解', () => {
    expect(canMakeTarget([5, 5, 5, 1])).toBe(true); // 5*(5-1/5) = 24
  });

  it('[6, 6, 6, 6] 有解', () => {
    expect(canMakeTarget([6, 6, 6, 6])).toBe(true); // 6+6+6+6 = 24
  });

  it('[13, 13, 13, 13] 无解', () => {
    expect(canMakeTarget([13, 13, 13, 13])).toBe(false);
  });

  it('[2, 3, 4, 5] 有解', () => {
    expect(canMakeTarget([2, 3, 4, 5])).toBe(true);
  });

  it('[10, 10, 4, 4] 有解', () => {
    expect(canMakeTarget([10, 10, 4, 4])).toBe(true); // (10*10-4)/4 = 24
  });

  it('[3, 3, 8, 8] 有解', () => {
    expect(canMakeTarget([3, 3, 8, 8])).toBe(true); // 8/(3-8/3)
  });

  it('[1, 5, 5, 5] 有解', () => {
    expect(canMakeTarget([1, 5, 5, 5])).toBe(true); // (5-1/5)*5
  });

  it('[2, 7, 8, 9] 有解', () => {
    expect(canMakeTarget([2, 7, 8, 9])).toBe(true);
  });

  it('[12, 12, 12, 12] 有解', () => {
    expect(canMakeTarget([12, 12, 12, 12])).toBe(true); // 12+12+12-12 = 24
  });

  it('单元素数组等于目标值', () => {
    expect(canMakeTarget([24])).toBe(true);
  });

  it('单元素数组不等于目标值', () => {
    expect(canMakeTarget([23])).toBe(false);
  });

  it('空数组无解', () => {
    expect(canMakeTarget([])).toBe(false);
  });

  it('两个数字 [6, 4] 有解', () => {
    expect(canMakeTarget([6, 4])).toBe(true); // 6*4 = 24
  });

  it('两个数字 [1, 1] 无解', () => {
    expect(canMakeTarget([1, 1])).toBe(false);
  });

  it('三个数字 [2, 3, 4] 有解', () => {
    expect(canMakeTarget([2, 3, 4])).toBe(true); // 2*3*4 = 24
  });

  it('自定义目标值 12', () => {
    expect(canMakeTarget([3, 4], 12)).toBe(true); // 3*4 = 12
  });

  it('自定义目标值 100', () => {
    expect(canMakeTarget([5, 5, 4], 100)).toBe(true); // 5*5*4 = 100
  });

  it('[7, 7, 7, 7] 无解', () => {
    expect(canMakeTarget([7, 7, 7, 7])).toBe(false);
  });

  it('[9, 9, 9, 9] 无解', () => {
    expect(canMakeTarget([9, 9, 9, 9])).toBe(false);
  });

  it('[1, 2, 1, 2] 无解', () => {
    expect(canMakeTarget([1, 2, 1, 2])).toBe(false);
  });

  it('[4, 6, 8, 2] 有解', () => {
    expect(canMakeTarget([4, 6, 8, 2])).toBe(true);
  });
});

// ========================================
// 2. solveMake24 求解器测试
// ========================================

describe('solveMake24', () => {
  it('[1,2,3,4] 返回有效表达式', () => {
    const result = solveMake24([1, 2, 3, 4]);
    expect(result).not.toBeNull();
    const evalResult = safeEval(result!);
    expect(Math.abs(evalResult - 24)).toBeLessThan(1e-6);
  });

  it('[6,6,6,6] 返回有效表达式', () => {
    const result = solveMake24([6, 6, 6, 6]);
    expect(result).not.toBeNull();
    expect(Math.abs(safeEval(result!) - 24)).toBeLessThan(1e-6);
  });

  it('[1,1,1,1] 返回 null', () => {
    expect(solveMake24([1, 1, 1, 1])).toBeNull();
  });

  it('[1,1,1,2] 返回 null', () => {
    expect(solveMake24([1, 1, 1, 2])).toBeNull();
  });

  it('[8,3,8,3] 返回有效表达式', () => {
    const result = solveMake24([8, 3, 8, 3]);
    expect(result).not.toBeNull();
    expect(Math.abs(safeEval(result!) - 24)).toBeLessThan(1e-6);
  });

  it('[5,5,5,1] 返回有效表达式', () => {
    const result = solveMake24([5, 5, 5, 1]);
    expect(result).not.toBeNull();
    expect(Math.abs(safeEval(result!) - 24)).toBeLessThan(1e-6);
  });

  it('表达式包含所有四个数字', () => {
    const result = solveMake24([2, 3, 4, 5]);
    expect(result).not.toBeNull();
    const nums = result!.match(/\d+/g)?.map(Number) || [];
    const sorted = [...nums].sort((a, b) => a - b);
    expect(sorted).toEqual([2, 3, 4, 5]);
  });

  it('自定义目标值', () => {
    const result = solveMake24([3, 4], 12);
    expect(result).not.toBeNull();
    expect(Math.abs(safeEval(result!) - 12)).toBeLessThan(1e-6);
  });

  it('[13,13,13,13] 返回 null', () => {
    expect(solveMake24([13, 13, 13, 13])).toBeNull();
  });

  it('[3,3,8,8] 返回有效表达式', () => {
    const result = solveMake24([3, 3, 8, 8]);
    expect(result).not.toBeNull();
    expect(Math.abs(safeEval(result!) - 24)).toBeLessThan(1e-6);
  });
});

// ========================================
// 3. safeEval 测试
// ========================================

describe('safeEval', () => {
  it('简单加法', () => {
    expect(safeEval('1+2')).toBe(3);
  });

  it('简单减法', () => {
    expect(safeEval('5-3')).toBe(2);
  });

  it('简单乘法', () => {
    expect(safeEval('3*4')).toBe(12);
  });

  it('简单除法', () => {
    expect(safeEval('10/2')).toBe(5);
  });

  it('带括号的表达式', () => {
    expect(safeEval('(2+3)*4')).toBe(20);
  });

  it('复杂嵌套括号', () => {
    expect(safeEval('((1+2)*(3+4))')).toBe(21);
  });

  it('运算符优先级', () => {
    expect(safeEval('2+3*4')).toBe(14);
  });

  it('除法产生小数', () => {
    expect(safeEval('7/2')).toBe(3.5);
  });

  it('空格忽略', () => {
    expect(safeEval(' 1 + 2 * 3 ')).toBe(7);
  });

  it('非法字符抛出错误', () => {
    expect(() => safeEval('1+abc')).toThrow();
  });

  it('空字符串抛出错误', () => {
    expect(() => safeEval('')).toThrow();
  });

  it('单数字', () => {
    expect(safeEval('42')).toBe(42);
  });

  it('大数运算', () => {
    expect(safeEval('1000*1000')).toBe(1000000);
  });

  it('连续运算', () => {
    expect(safeEval('1+2+3+4')).toBe(10);
  });

  it('负数结果', () => {
    expect(safeEval('3-5')).toBe(-2);
  });

  it('连续括号', () => {
    expect(safeEval('((1+1))')).toBe(2);
  });
});

// ========================================
// 4. validateExpression 测试
// ========================================

describe('validateExpression', () => {
  const makeCards = (values: number[]) =>
    values.map((v, i) => ({
      value: v,
      suit: ['spade', 'heart', 'diamond', 'club'][i % 4] as any,
      used: false,
    }));

  it('正确的表达式 [1,2,3,4] → 1*2*3*4=24', () => {
    const result = validateExpression('1*2*3*4', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(true);
    expect(result.result).toBe(24);
  });

  it('正确的表达式 [6,6,6,6] → 6+6+6+6=24', () => {
    const result = validateExpression('6+6+6+6', makeCards([6, 6, 6, 6]));
    expect(result.valid).toBe(true);
  });

  it('结果不等于 24', () => {
    const result = validateExpression('1+2+3+4', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('不等于');
  });

  it('使用了错误的数字', () => {
    const result = validateExpression('5*5+5-5', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('不匹配');
  });

  it('使用了太少数字', () => {
    const result = validateExpression('1+2', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('4 个');
  });

  it('使用了太多数字', () => {
    const result = validateExpression('1+2+3+4+5', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
  });

  it('空表达式', () => {
    const result = validateExpression('', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('输入');
  });

  it('只有空格的表达式', () => {
    const result = validateExpression('   ', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
  });

  it('带括号的正确表达式', () => {
    const result = validateExpression('(5-1/5)*5', makeCards([5, 1, 5, 5]));
    expect(result.valid).toBe(true);
  });

  it('非法字符', () => {
    const result = validateExpression('1+2^3+4', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('非法字符');
  });

  it('自定义目标值', () => {
    const result = validateExpression('3*4', makeCards([3, 4]), 12);
    expect(result.valid).toBe(true);
  });

  it('表达式格式错误', () => {
    const result = validateExpression('((1+2', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
  });

  it('没有数字的表达式', () => {
    const result = validateExpression('++', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
  });

  it('正确使用减法', () => {
    const result = validateExpression('8*3-8+8', makeCards([8, 3, 8, 8]));
    expect(result.valid).toBe(true);
  });

  it('表达式结果为小数不等于 24', () => {
    const result = validateExpression('1/2+3+4', makeCards([1, 2, 3, 4]));
    expect(result.valid).toBe(false);
  });
});

// ========================================
// 5. Make24Engine 生命周期测试
// ========================================

describe('Make24Engine 生命周期', () => {
  it('init 后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
    engine.destroy();
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
    engine.destroy();
  });

  it('start 后生成 4 张牌', () => {
    const engine = createAndStartEngine();
    expect(engine.cards).toHaveLength(CARD_COUNT);
    engine.destroy();
  });

  it('start 后牌面值在合法范围', () => {
    const engine = createAndStartEngine();
    for (const card of engine.cards) {
      expect(card.value).toBeGreaterThanOrEqual(MIN_CARD_VALUE);
      expect(card.value).toBeLessThanOrEqual(MAX_CARD_VALUE);
    }
    engine.destroy();
  });

  it('start 后表达式为空', () => {
    const engine = createAndStartEngine();
    expect(engine.expression).toHaveLength(0);
    expect(engine.expressionString).toBe('');
    engine.destroy();
  });

  it('start 后分数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
    engine.destroy();
  });

  it('start 后提示次数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.hintsUsed).toBe(0);
    engine.destroy();
  });

  it('start 后完成轮数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.roundsSolved).toBe(0);
    engine.destroy();
  });

  it('pause 后状态为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
    engine.destroy();
  });

  it('resume 后状态为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
    engine.destroy();
  });

  it('reset 后状态为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
    engine.destroy();
  });

  it('destroy 后可以重新 init', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    const canvas = document.createElement('canvas');
    engine.init(canvas);
    expect(engine.status).toBe('idle');
  });

  it('多次 start 不出错', () => {
    const engine = createEngine();
    engine.start();
    engine.start();
    expect(engine.status).toBe('playing');
    engine.destroy();
  });
});

// ========================================
// 6. 选牌和表达式构建测试
// ========================================

describe('表达式构建', () => {
  let engine: Make24Engine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('选择一张牌添加到表达式', () => {
    engine.selectCard(0);
    expect(engine.expression).toHaveLength(1);
    expect(engine.expression[0].type).toBe('number');
    expect(engine.expression[0].value).toBe(engine.cards[0].value);
  });

  it('选择已使用的牌无效', () => {
    engine.selectCard(0);
    const len = engine.expression.length;
    engine.selectCard(0);
    expect(engine.expression).toHaveLength(len);
  });

  it('选择无效索引不出错', () => {
    engine.selectCard(-1);
    engine.selectCard(99);
    expect(engine.expression).toHaveLength(0);
  });

  it('添加运算符', () => {
    engine.addOperator('+');
    expect(engine.expression).toHaveLength(1);
    expect(engine.expression[0].type).toBe('operator');
  });

  it('添加所有运算符', () => {
    engine.addOperator('+');
    engine.addOperator('-');
    engine.addOperator('*');
    engine.addOperator('/');
    expect(engine.expression).toHaveLength(4);
  });

  it('添加括号', () => {
    engine.addParen('(');
    engine.addParen(')');
    expect(engine.expression).toHaveLength(2);
  });

  it('构建完整表达式', () => {
    engine.selectCard(0);
    engine.addOperator('+');
    engine.selectCard(1);
    engine.addOperator('*');
    engine.selectCard(2);
    engine.addOperator('+');
    engine.selectCard(3);
    expect(engine.expression.length).toBe(7);
  });

  it('removeLastToken 删除数字时释放牌', () => {
    engine.selectCard(0);
    expect(engine.cards[0].used).toBe(true);
    engine.removeLastToken();
    expect(engine.cards[0].used).toBe(false);
    expect(engine.expression).toHaveLength(0);
  });

  it('removeLastToken 删除运算符不影响牌', () => {
    engine.selectCard(0);
    engine.addOperator('+');
    expect(engine.cards[0].used).toBe(true);
    engine.removeLastToken(); // 删除 +
    expect(engine.cards[0].used).toBe(true);
    expect(engine.expression).toHaveLength(1);
  });

  it('removeLastToken 空表达式时无操作', () => {
    engine.removeLastToken();
    expect(engine.expression).toHaveLength(0);
  });

  it('clearExpression 清空所有并释放牌', () => {
    engine.selectCard(0);
    engine.selectCard(1);
    engine.addOperator('+');
    engine.clearExpression();
    expect(engine.expression).toHaveLength(0);
    expect(engine.cards.every((c) => !c.used)).toBe(true);
  });

  it('expressionString 正确拼接', () => {
    setCardValues(engine, [3, 5]);
    engine.selectCard(0);
    engine.addOperator('+');
    engine.selectCard(1);
    const str = engine.expressionString;
    expect(str).toBe('3 + 5');
  });

  it('非 playing 状态下选牌无效', () => {
    engine.pause();
    engine.selectCard(0);
    expect(engine.expression).toHaveLength(0);
  });

  it('非 playing 状态下添加运算符无效', () => {
    engine.pause();
    engine.addOperator('+');
    expect(engine.expression).toHaveLength(0);
  });

  it('非 playing 状态下清空无效', () => {
    engine.selectCard(0);
    engine.pause();
    engine.clearExpression();
    // 表达式仍有内容因为 clear 在 pause 下不执行
    expect(engine.expression).toHaveLength(1);
  });
});

// ========================================
// 7. 提交表达式测试
// ========================================

describe('提交表达式', () => {
  it('正确表达式得分增加', () => {
    const engine = createAndStartEngine();
    buildCorrectExpression(engine);
    const result = engine.submitExpression();
    expect(result.valid).toBe(true);
    expect(engine.score).toBe(BASE_SCORE);
    expect(engine.roundsSolved).toBe(1);
    engine.destroy();
  });

  it('连胜时额外加分', () => {
    const engine = createAndStartEngine();
    // 第一次
    buildCorrectExpression(engine);
    engine.submitExpression();
    // 第二次
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.streak).toBe(2);
    expect(engine.score).toBe(BASE_SCORE + BASE_SCORE + STREAK_BONUS);
    engine.destroy();
  });

  it('错误表达式不得分', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [1, 1, 1, 1]);
    engine.selectCard(0);
    engine.addOperator('+');
    engine.selectCard(1);
    engine.addOperator('+');
    engine.selectCard(2);
    engine.addOperator('+');
    engine.selectCard(3);
    const result = engine.submitExpression();
    expect(result.valid).toBe(false);
    expect(engine.score).toBe(0);
    expect(engine.roundsSolved).toBe(0);
    engine.destroy();
  });

  it('成功后自动发新牌', () => {
    const engine = createAndStartEngine();
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.expression).toHaveLength(0);
    expect(engine.cards).toHaveLength(CARD_COUNT);
    engine.destroy();
  });

  it('非 playing 状态提交返回错误', () => {
    const engine = createEngine();
    const result = engine.submitExpression();
    expect(result.valid).toBe(false);
    engine.destroy();
  });

  it('成功提交触发 solveSuccess 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('solveSuccess', handler);
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(handler).toHaveBeenCalled();
    engine.destroy();
  });

  it('失败提交触发 solveFail 事件', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [1, 1, 1, 1]);
    const handler = vi.fn();
    engine.on('solveFail', handler);
    engine.selectCard(0);
    engine.addOperator('+');
    engine.selectCard(1);
    engine.addOperator('+');
    engine.selectCard(2);
    engine.addOperator('+');
    engine.selectCard(3);
    engine.submitExpression();
    expect(handler).toHaveBeenCalled();
    engine.destroy();
  });

  it('错误表达式重置连胜', () => {
    const engine = createAndStartEngine();
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.streak).toBe(1);

    setCardValues(engine, [1, 1, 1, 1]);
    engine.selectCard(0);
    engine.addOperator('+');
    engine.selectCard(1);
    engine.addOperator('+');
    engine.selectCard(2);
    engine.addOperator('+');
    engine.selectCard(3);
    engine.submitExpression();
    expect(engine.streak).toBe(0);
    engine.destroy();
  });
});

// ========================================
// 8. 提示功能测试
// ========================================

describe('提示功能', () => {
  it('使用提示消耗次数', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [6, 6, 6, 6]);
    engine.useHint();
    expect(engine.hintsUsed).toBe(1);
    engine.destroy();
  });

  it('使用提示扣分', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [6, 6, 6, 6]);
    engine.useHint();
    expect(engine.score).toBe(-HINT_PENALTY);
    engine.destroy();
  });

  it('提示次数用完返回 null', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [6, 6, 6, 6]);
    for (let i = 0; i < engine.maxHints; i++) {
      engine.useHint();
    }
    const result = engine.useHint();
    expect(result).toBeNull();
    expect(engine.hintsUsed).toBe(engine.maxHints);
    engine.destroy();
  });

  it('有解时提示返回表达式', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [6, 6, 6, 6]);
    const hint = engine.useHint();
    expect(hint).not.toBeNull();
    expect(hint!.expression).toBeTruthy();
    engine.destroy();
  });

  it('非 playing 状态使用提示返回 null', () => {
    const engine = createEngine();
    expect(engine.useHint()).toBeNull();
    engine.destroy();
  });

  it('提示触发 hintUsed 事件', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [6, 6, 6, 6]);
    const handler = vi.fn();
    engine.on('hintUsed', handler);
    engine.useHint();
    expect(handler).toHaveBeenCalled();
    engine.destroy();
  });

  it('提示次数耗尽显示消息', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [6, 6, 6, 6]);
    for (let i = 0; i < engine.maxHints; i++) {
      engine.useHint();
    }
    engine.useHint();
    expect(engine.message).not.toBeNull();
    expect(engine.message!.text).toContain('没有更多提示');
    engine.destroy();
  });
});

// ========================================
// 9. 键盘输入测试
// ========================================

describe('键盘输入', () => {
  let engine: Make24Engine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('数字键 1-4 选择对应牌', () => {
    engine.handleKeyDown('1');
    expect(engine.expression).toHaveLength(1);
    expect(engine.cards[0].used).toBe(true);
  });

  it('运算符键添加运算符', () => {
    engine.handleKeyDown('+');
    expect(engine.expression).toHaveLength(1);
    expect(engine.expression[0].type).toBe('operator');
  });

  it('减号键', () => {
    engine.handleKeyDown('-');
    expect(engine.expression[0].type).toBe('operator');
  });

  it('星号键', () => {
    engine.handleKeyDown('*');
    expect(engine.expression[0].type).toBe('operator');
  });

  it('斜杠键', () => {
    engine.handleKeyDown('/');
    expect(engine.expression[0].type).toBe('operator');
  });

  it('括号键', () => {
    engine.handleKeyDown('(');
    engine.handleKeyDown(')');
    expect(engine.expression).toHaveLength(2);
  });

  it('Backspace 删除最后一个 token', () => {
    engine.handleKeyDown('1');
    engine.handleKeyDown('+');
    engine.handleKeyDown('Backspace');
    expect(engine.expression).toHaveLength(1);
  });

  it('Escape 清空表达式', () => {
    engine.handleKeyDown('1');
    engine.handleKeyDown('+');
    engine.handleKeyDown('2');
    engine.handleKeyDown('Escape');
    expect(engine.expression).toHaveLength(0);
  });

  it('H 键使用提示', () => {
    setCardValues(engine, [6, 6, 6, 6]);
    engine.handleKeyDown('h');
    expect(engine.hintsUsed).toBe(1);
  });

  it('大写 H 也可使用提示', () => {
    setCardValues(engine, [6, 6, 6, 6]);
    engine.handleKeyDown('H');
    expect(engine.hintsUsed).toBe(1);
  });

  it('N 键跳过当前轮', () => {
    const handler = vi.fn();
    engine.on('roundSkipped', handler);
    engine.handleKeyDown('n');
    expect(handler).toHaveBeenCalled();
  });

  it('idle 状态下 Space 启动游戏', () => {
    engine.reset();
    expect(engine.status).toBe('idle');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('idle 状态下 Enter 启动游戏', () => {
    engine.reset();
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
  });

  it('handleKeyUp 不报错', () => {
    expect(() => engine.handleKeyUp('1')).not.toThrow();
  });

  it('键 2 选择第二张牌', () => {
    engine.handleKeyDown('2');
    expect(engine.expression).toHaveLength(1);
    expect(engine.cards[1].used).toBe(true);
  });

  it('键 3 选择第三张牌', () => {
    engine.handleKeyDown('3');
    expect(engine.cards[2].used).toBe(true);
  });

  it('键 4 选择第四张牌', () => {
    engine.handleKeyDown('4');
    expect(engine.cards[3].used).toBe(true);
  });
});

// ========================================
// 10. 计时器测试
// ========================================

describe('计时器', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('计时器每秒递减', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    const handler = vi.fn();
    engine.on('timeChange', handler);
    vi.advanceTimersByTime(1000);
    expect(engine.timeRemaining).toBe(DIFFICULTY_CONFIG.normal.timeLimit - 1);
    expect(handler).toHaveBeenCalledWith(DIFFICULTY_CONFIG.normal.timeLimit - 1);
    vi.useRealTimers();
    engine.destroy();
  });

  it('计时器归零触发 gameover', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    vi.advanceTimersByTime(DIFFICULTY_CONFIG.normal.timeLimit * 1000);
    expect(engine.timeRemaining).toBe(0);
    expect(engine.status).toBe('gameover');
    vi.useRealTimers();
    engine.destroy();
  });

  it('暂停时计时器不递减', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    engine.pause();
    vi.advanceTimersByTime(5000);
    expect(engine.timeRemaining).toBe(DIFFICULTY_CONFIG.normal.timeLimit);
    vi.useRealTimers();
    engine.destroy();
  });

  it('恢复后计时器继续递减', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    engine.pause();
    vi.advanceTimersByTime(3000);
    engine.resume();
    vi.advanceTimersByTime(2000);
    expect(engine.timeRemaining).toBe(DIFFICULTY_CONFIG.normal.timeLimit - 2);
    vi.useRealTimers();
    engine.destroy();
  });

  it('timeChange 事件正确触发', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    const handler = vi.fn();
    engine.on('timeChange', handler);
    vi.advanceTimersByTime(3000);
    expect(handler).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
    engine.destroy();
  });
});

// ========================================
// 11. 事件系统测试
// ========================================

describe('事件系统', () => {
  it('expressionChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('expressionChange', handler);
    engine.selectCard(0);
    expect(handler).toHaveBeenCalledWith(expect.any(String));
    engine.destroy();
  });

  it('cardsDealt 事件在 start 时触发', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('cardsDealt', handler);
    engine.start();
    expect(handler).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it('scoreChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('scoreChange', handler);
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(handler).toHaveBeenCalledWith(BASE_SCORE);
    engine.destroy();
  });

  it('statusChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
    engine.destroy();
  });

  it('off 取消监听', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('expressionChange', handler);
    engine.off('expressionChange', handler);
    engine.selectCard(0);
    expect(handler).not.toHaveBeenCalled();
    engine.destroy();
  });

  it('roundsChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('roundsChange', handler);
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(handler).toHaveBeenCalledWith(1);
    engine.destroy();
  });
});

// ========================================
// 12. getState 测试
// ========================================

describe('getState', () => {
  it('返回完整状态对象', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('status');
    expect(state).toHaveProperty('cards');
    expect(state).toHaveProperty('expression');
    expect(state).toHaveProperty('timeRemaining');
    expect(state).toHaveProperty('hintsUsed');
    expect(state).toHaveProperty('roundsSolved');
    expect(state).toHaveProperty('message');
    engine.destroy();
  });

  it('状态值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.status).toBe('playing');
    expect(state.hintsUsed).toBe(0);
    expect(state.roundsSolved).toBe(0);
    expect(state.timeRemaining).toBe(DIFFICULTY_CONFIG.normal.timeLimit);
    engine.destroy();
  });

  it('操作后状态更新', () => {
    const engine = createAndStartEngine();
    buildCorrectExpression(engine);
    engine.submitExpression();
    const state = engine.getState();
    expect(state.score).toBe(BASE_SCORE);
    expect(state.roundsSolved).toBe(1);
    engine.destroy();
  });

  it('状态包含难度信息', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.difficulty).toBe('normal');
    engine.destroy();
  });

  it('状态包含连胜信息', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.streak).toBe(0);
    engine.destroy();
  });
});

// ========================================
// 13. 跳过轮次测试
// ========================================

describe('跳过轮次', () => {
  it('跳过发新牌', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('roundSkipped', handler);
    engine.skipRound();
    expect(handler).toHaveBeenCalled();
    expect(engine.expression).toHaveLength(0);
    expect(engine.cards).toHaveLength(CARD_COUNT);
    engine.destroy();
  });

  it('非 playing 状态跳过无效', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('roundSkipped', handler);
    engine.skipRound();
    expect(handler).not.toHaveBeenCalled();
    engine.destroy();
  });

  it('跳过扣分', () => {
    const engine = createAndStartEngine();
    engine.skipRound();
    expect(engine.score).toBe(-SKIP_PENALTY);
    engine.destroy();
  });

  it('跳过重置连胜', () => {
    const engine = createAndStartEngine();
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.streak).toBe(1);
    engine.skipRound();
    expect(engine.streak).toBe(0);
    engine.destroy();
  });
});

// ========================================
// 14. 发牌测试
// ========================================

describe('发牌', () => {
  it('发的牌值在合法范围', () => {
    const engine = createAndStartEngine();
    for (const card of engine.cards) {
      expect(card.value).toBeGreaterThanOrEqual(MIN_CARD_VALUE);
      expect(card.value).toBeLessThanOrEqual(MAX_CARD_VALUE);
    }
    engine.destroy();
  });

  it('normal 难度发的牌有解', () => {
    for (let t = 0; t < 20; t++) {
      const engine = createAndStartEngine();
      const values = engine.cards.map((c) => c.value);
      expect(canMakeTarget(values)).toBe(true);
      engine.destroy();
    }
  });

  it('发的牌数量正确', () => {
    const engine = createAndStartEngine();
    expect(engine.cards).toHaveLength(CARD_COUNT);
    engine.destroy();
  });

  it('发的牌初始未使用', () => {
    const engine = createAndStartEngine();
    expect(engine.cards.every((c) => !c.used)).toBe(true);
    engine.destroy();
  });

  it('dealCards 触发 cardsDealt 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('cardsDealt', handler);
    engine.dealCards();
    expect(handler).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it('easy 难度牌面不超过 9', () => {
    const engine = createEngine();
    engine.setDifficulty('easy');
    engine.start();
    for (const card of engine.cards) {
      expect(card.value).toBeLessThanOrEqual(DIFFICULTY_CONFIG.easy.maxValue);
    }
    engine.destroy();
  });
});

// ========================================
// 15. 边界情况测试
// ========================================

describe('边界情况', () => {
  it('连续多次 submit 不崩溃', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 10; i++) {
      engine.submitExpression();
    }
    expect(engine.status).toBe('playing');
    engine.destroy();
  });

  it('连续多次 clearExpression 不崩溃', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 10; i++) {
      engine.clearExpression();
    }
    expect(engine.expression).toHaveLength(0);
    engine.destroy();
  });

  it('连续多次 removeLastToken 不崩溃', () => {
    const engine = createAndStartEngine();
    engine.selectCard(0);
    for (let i = 0; i < 10; i++) {
      engine.removeLastToken();
    }
    expect(engine.expression).toHaveLength(0);
    engine.destroy();
  });

  it('gameover 后键盘输入处理', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    vi.advanceTimersByTime(DIFFICULTY_CONFIG.normal.timeLimit * 1000);
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
    vi.useRealTimers();
    engine.destroy();
  });

  it('gameover 后 Space 重新开始', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    vi.advanceTimersByTime(DIFFICULTY_CONFIG.normal.timeLimit * 1000);
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    vi.useRealTimers();
    engine.destroy();
  });

  it('多次连续解题后状态正确', () => {
    const engine = createAndStartEngine();
    for (let round = 0; round < 5; round++) {
      buildCorrectExpression(engine);
      engine.submitExpression();
    }
    expect(engine.roundsSolved).toBe(5);
    // 基础分 + 连胜加成
    const expected = 5 * BASE_SCORE + STREAK_BONUS * (1 + 2 + 3 + 4);
    expect(engine.score).toBe(expected);
    engine.destroy();
  });

  it('canMakeTarget 处理浮点精度', () => {
    expect(canMakeTarget([8, 3, 8, 3])).toBe(true);
  });

  it('solveMake24 处理大数', () => {
    const result = solveMake24([13, 13, 1, 1]);
    if (result) {
      expect(Math.abs(safeEval(result) - 24)).toBeLessThan(1e-6);
    }
  });

  it('safeEval 处理连续括号', () => {
    expect(safeEval('((1+1))')).toBe(2);
  });

  it('空消息初始为 null', () => {
    const engine = createAndStartEngine();
    expect(engine.message).toBeNull();
    engine.destroy();
  });
});

// ========================================
// 16. 消息系统测试
// ========================================

describe('消息系统', () => {
  it('成功提交显示成功消息', () => {
    const engine = createAndStartEngine();
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.message).not.toBeNull();
    expect(engine.message!.text).toContain('正确');
    expect(engine.message!.color).toBe(SUCCESS_COLOR);
    engine.destroy();
  });

  it('失败提交显示错误消息', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [1, 1, 1, 1]);
    engine.selectCard(0);
    engine.addOperator('+');
    engine.selectCard(1);
    engine.addOperator('+');
    engine.selectCard(2);
    engine.addOperator('+');
    engine.selectCard(3);
    engine.submitExpression();
    expect(engine.message).not.toBeNull();
    expect(engine.message!.color).toBe(ERROR_COLOR);
    engine.destroy();
  });

  it('初始消息为 null', () => {
    const engine = createAndStartEngine();
    expect(engine.message).toBeNull();
    engine.destroy();
  });

  it('提示消息包含提示内容', () => {
    const engine = createAndStartEngine();
    setCardValues(engine, [6, 6, 6, 6]);
    engine.useHint();
    expect(engine.message).not.toBeNull();
    expect(engine.message!.text).toContain('提示');
    engine.destroy();
  });
});

// ========================================
// 17. 游戏结束测试
// ========================================

describe('游戏结束', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('时间耗尽触发 gameover', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    vi.advanceTimersByTime(DIFFICULTY_CONFIG.normal.timeLimit * 1000);
    expect(engine.status).toBe('gameover');
    vi.useRealTimers();
    engine.destroy();
  });

  it('gameover 触发 statusChange 事件', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.start();
    vi.advanceTimersByTime(DIFFICULTY_CONFIG.normal.timeLimit * 1000);
    expect(handler).toHaveBeenCalledWith('gameover');
    vi.useRealTimers();
    engine.destroy();
  });

  it('gameover 后时间不再递减', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    vi.advanceTimersByTime(DIFFICULTY_CONFIG.normal.timeLimit * 1000);
    const timeAtGameOver = engine.timeRemaining;
    vi.advanceTimersByTime(5000);
    expect(engine.timeRemaining).toBe(timeAtGameOver);
    vi.useRealTimers();
    engine.destroy();
  });

  it('gameover 后重新开始分数重置', () => {
    const engine = createEngine();
    vi.useFakeTimers();
    engine.start();
    vi.advanceTimersByTime(DIFFICULTY_CONFIG.normal.timeLimit * 1000);
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(0);
    expect(engine.roundsSolved).toBe(0);
    vi.useRealTimers();
    engine.destroy();
  });
});

// ========================================
// 18. 难度设置测试
// ========================================

describe('难度设置', () => {
  it('默认难度为 normal', () => {
    const engine = createEngine();
    expect(engine.difficulty).toBe('normal');
    engine.destroy();
  });

  it('设置难度为 easy', () => {
    const engine = createEngine();
    engine.setDifficulty('easy');
    expect(engine.difficulty).toBe('easy');
    engine.destroy();
  });

  it('easy 难度无时间限制', () => {
    const engine = createEngine();
    engine.setDifficulty('easy');
    engine.start();
    expect(DIFFICULTY_CONFIG.easy.timeLimit).toBe(0);
    engine.destroy();
  });

  it('hard 难度有 60 秒时间限制', () => {
    const engine = createEngine();
    engine.setDifficulty('hard');
    engine.start();
    expect(engine.timeRemaining).toBe(60);
    engine.destroy();
  });

  it('hard 难度不保证有解', () => {
    expect(DIFFICULTY_CONFIG.hard.guaranteedSolvable).toBe(false);
  });
});

// ========================================
// 19. 连胜系统测试
// ========================================

describe('连胜系统', () => {
  it('初始连胜为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.streak).toBe(0);
    engine.destroy();
  });

  it('第一次成功连胜为 1', () => {
    const engine = createAndStartEngine();
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.streak).toBe(1);
    engine.destroy();
  });

  it('连续成功连胜递增', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 3; i++) {
      buildCorrectExpression(engine);
      engine.submitExpression();
    }
    expect(engine.streak).toBe(3);
    engine.destroy();
  });

  it('失败重置连胜', () => {
    const engine = createAndStartEngine();
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.streak).toBe(1);

    setCardValues(engine, [1, 1, 1, 1]);
    engine.selectCard(0);
    engine.addOperator('+');
    engine.selectCard(1);
    engine.addOperator('+');
    engine.selectCard(2);
    engine.addOperator('+');
    engine.selectCard(3);
    engine.submitExpression();
    expect(engine.streak).toBe(0);
    engine.destroy();
  });

  it('连胜加分正确', () => {
    const engine = createAndStartEngine();
    // 第1次：BASE_SCORE + 0 (streak=1, bonus=0)
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.score).toBe(BASE_SCORE);

    // 第2次：BASE_SCORE + STREAK_BONUS*1 (streak=2)
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.score).toBe(BASE_SCORE * 2 + STREAK_BONUS);

    // 第3次：BASE_SCORE + STREAK_BONUS*2 (streak=3)
    buildCorrectExpression(engine);
    engine.submitExpression();
    expect(engine.score).toBe(BASE_SCORE * 3 + STREAK_BONUS * 3);
    engine.destroy();
  });
});
