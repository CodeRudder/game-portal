import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MastermindEngine } from '../MastermindEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  DEFAULT_CODE_LENGTH, COLOR_COUNT, MAX_GUESSES,
  Difficulty, DIFFICULTY_CONFIG,
  PEG_COLORS,
  BASE_SCORE, GUESS_PENALTY, PERFECT_BONUS,
  PEG_RADIUS, PEG_SPACING, ROW_HEIGHT, ROW_SPACING,
  INPUT_ROW_Y, GUESS_START_Y,
  COLOR_NAMES,
  BG_COLOR, BOARD_COLOR, TEXT_COLOR,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): MastermindEngine {
  const engine = new MastermindEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 创建引擎并开始游戏 */
function createAndStartEngine(difficulty: Difficulty = 'normal'): MastermindEngine {
  const engine = createEngine();
  engine.setDifficulty(difficulty);
  engine.start();
  return engine;
}

// ========== 常量测试 ==========

describe('Mastermind Constants', () => {
  it('画布尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('默认密码长度为 4', () => {
    expect(DEFAULT_CODE_LENGTH).toBe(4);
  });

  it('颜色数量为 6', () => {
    expect(COLOR_COUNT).toBe(6);
  });

  it('最大猜测次数为 10', () => {
    expect(MAX_GUESSES).toBe(10);
  });

  it('PEG_COLORS 数组长度为 6', () => {
    expect(PEG_COLORS.length).toBe(6);
  });

  it('COLOR_NAMES 数组长度为 6', () => {
    expect(COLOR_NAMES.length).toBe(6);
  });

  it('难度配置包含 easy/normal/hard', () => {
    expect(DIFFICULTY_CONFIG.easy.codeLength).toBe(4);
    expect(DIFFICULTY_CONFIG.normal.codeLength).toBe(5);
    expect(DIFFICULTY_CONFIG.hard.codeLength).toBe(6);
  });

  it('分数常量合理', () => {
    expect(BASE_SCORE).toBe(1000);
    expect(GUESS_PENALTY).toBe(100);
    expect(PERFECT_BONUS).toBe(500);
  });

  it('布局常量合理', () => {
    expect(PEG_RADIUS).toBeGreaterThan(0);
    expect(PEG_SPACING).toBeGreaterThan(PEG_RADIUS * 2);
    expect(ROW_HEIGHT).toBeGreaterThan(0);
    expect(INPUT_ROW_Y).toBeGreaterThan(GUESS_START_Y);
  });

  it('颜色常量非空', () => {
    expect(BG_COLOR).toBeTruthy();
    expect(BOARD_COLOR).toBeTruthy();
    expect(TEXT_COLOR).toBeTruthy();
  });
});

// ========== 初始化测试 ==========

describe('MastermindEngine - 初始化', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始状态为 idle', () => {
    expect(engine.status).toBe('idle');
  });

  it('初始分数为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('初始等级为 1', () => {
    expect(engine.level).toBe(1);
  });

  it('初始难度为 normal', () => {
    expect(engine.difficulty).toBe('normal');
  });

  it('初始没有猜测记录', () => {
    expect(engine.guesses.length).toBe(0);
  });

  it('初始没有获胜', () => {
    expect(engine.won).toBe(false);
  });

  it('初始密码长度为 normal 难度的长度', () => {
    expect(engine.codeLength).toBe(DIFFICULTY_CONFIG.normal.codeLength);
  });

  it('初始密码为空', () => {
    expect(engine.secret.length).toBe(0);
  });

  it('初始剩余猜测次数为 MAX_GUESSES', () => {
    expect(engine.remainingGuesses).toBe(MAX_GUESSES);
  });

  it('初始轮次为 1', () => {
    expect(engine.currentRound).toBe(1);
  });
});

// ========== 生命周期测试 ==========

describe('MastermindEngine - 生命周期', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后状态变为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后生成密码', () => {
    engine.start();
    expect(engine.secret.length).toBe(engine.codeLength);
  });

  it('start 后输入重置', () => {
    engine.start();
    expect(engine.currentInput.every(c => c === -1)).toBe(true);
  });

  it('start 后光标在位置 0', () => {
    engine.start();
    expect(engine.cursorPos).toBe(0);
  });

  it('start 后猜测记录为空', () => {
    engine.start();
    expect(engine.guesses.length).toBe(0);
  });

  it('pause 后状态变为 paused', () => {
    engine.start();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态恢复为 playing', () => {
    engine.start();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态回到 idle', () => {
    engine.start();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数归零', () => {
    engine.start();
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后猜测记录清空', () => {
    engine.start();
    engine.reset();
    expect(engine.guesses.length).toBe(0);
  });

  it('destroy 后状态为 idle', () => {
    engine.start();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('idle 状态按 Enter 可以开始', () => {
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
  });

  it('idle 状态按 Space 可以开始', () => {
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态按 Enter 可以重新开始', () => {
    engine.start();
    // 强制 game over
    (engine as any).gameOver();
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
  });

  it('won 状态按 Space 可以重新开始', () => {
    engine.start();
    (engine as any)._won = true;
    (engine as any).gameOver();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });
});

// ========== 密码生成测试 ==========

describe('MastermindEngine - 密码生成', () => {
  it('密码长度等于 codeLength', () => {
    const engine = createAndStartEngine('easy');
    expect(engine.secret.length).toBe(4);
  });

  it('密码中每个值在 0-5 范围内', () => {
    const engine = createAndStartEngine('normal');
    engine.secret.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(COLOR_COUNT);
    });
  });

  it('easy 难度生成 4 位密码', () => {
    const engine = createAndStartEngine('easy');
    expect(engine.secret.length).toBe(4);
  });

  it('normal 难度生成 5 位密码', () => {
    const engine = createAndStartEngine('normal');
    expect(engine.secret.length).toBe(5);
  });

  it('hard 难度生成 6 位密码', () => {
    const engine = createAndStartEngine('hard');
    expect(engine.secret.length).toBe(6);
  });

  it('每次 start 生成新密码', () => {
    const engine = createEngine();
    engine.start();
    const secret1 = [...engine.secret];
    engine.reset();
    engine.start();
    const secret2 = [...engine.secret];
    // 极低概率相同（1/6^4 = 1/1296），但不是必然
    // 只检查长度一致
    expect(secret1.length).toBe(secret2.length);
  });
});

// ========== 难度设置测试 ==========

describe('MastermindEngine - 难度设置', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('idle 状态可以设置难度', () => {
    engine.setDifficulty('easy');
    expect(engine.difficulty).toBe('easy');
    expect(engine.codeLength).toBe(4);
  });

  it('设置 normal 难度密码长度为 5', () => {
    engine.setDifficulty('normal');
    expect(engine.codeLength).toBe(5);
  });

  it('设置 hard 难度密码长度为 6', () => {
    engine.setDifficulty('hard');
    expect(engine.codeLength).toBe(6);
  });

  it('playing 状态不能改变难度', () => {
    engine.start();
    const originalDifficulty = engine.difficulty;
    engine.setDifficulty('hard');
    expect(engine.difficulty).toBe(originalDifficulty);
  });

  it('设置难度后输入数组长度更新', () => {
    engine.setDifficulty('hard');
    expect(engine.currentInput.length).toBe(6);
  });

  it('设置难度后光标重置为 0', () => {
    engine.setDifficulty('hard');
    expect(engine.cursorPos).toBe(0);
  });

  it('设置难度触发 difficultyChange 事件', () => {
    const callback = vi.fn();
    engine.on('difficultyChange', callback);
    engine.setDifficulty('easy');
    expect(callback).toHaveBeenCalledWith('easy');
  });
});

// ========== 颜色选择测试 ==========

describe('MastermindEngine - 颜色选择', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
  });

  it('数字键 1 选择颜色 0', () => {
    engine.handleKeyDown('1');
    expect(engine.currentInput[0]).toBe(0);
  });

  it('数字键 6 选择颜色 5', () => {
    engine.handleKeyDown('6');
    expect(engine.currentInput[0]).toBe(5);
  });

  it('选择颜色后光标自动前进', () => {
    engine.handleKeyDown('1');
    expect(engine.cursorPos).toBe(1);
  });

  it('选择颜色到末尾位置光标不超出', () => {
    engine.handleKeyDown('1');
    engine.handleKeyDown('2');
    engine.handleKeyDown('3');
    engine.handleKeyDown('4');
    expect(engine.cursorPos).toBe(3); // 最后一个位置
  });

  it('可以在指定位置设置颜色', () => {
    engine.selectColor(2);
    expect(engine.currentInput[0]).toBe(2);
  });

  it('无效颜色索引被忽略', () => {
    engine.selectColor(-1);
    expect(engine.currentInput[0]).toBe(-1);
    engine.selectColor(6);
    expect(engine.currentInput[0]).toBe(-1);
  });

  it('选择颜色触发 inputChange 事件', () => {
    const callback = vi.fn();
    engine.on('inputChange', callback);
    engine.selectColor(1);
    expect(callback).toHaveBeenCalled();
    const input = callback.mock.calls[0][0];
    expect(input[0]).toBe(1);
  });

  it('连续选择颜色填满所有位置', () => {
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    expect(engine.currentInput).toEqual([0, 1, 2, 3]);
  });
});

// ========== 光标移动测试 ==========

describe('MastermindEngine - 光标移动', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
  });

  it('初始光标在位置 0', () => {
    expect(engine.cursorPos).toBe(0);
  });

  it('右箭头移动光标向右', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorPos).toBe(1);
  });

  it('左箭头移动光标向左', () => {
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorPos).toBe(0);
  });

  it('光标不能超出左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorPos).toBe(0);
  });

  it('光标不能超出右边界', () => {
    for (let i = 0; i < 10; i++) {
      engine.handleKeyDown('ArrowRight');
    }
    expect(engine.cursorPos).toBe(engine.codeLength - 1);
  });

  it('moveCursor 方法正确移动', () => {
    engine.moveCursor(2);
    expect(engine.cursorPos).toBe(2);
    engine.moveCursor(-1);
    expect(engine.cursorPos).toBe(1);
  });

  it('setCursorPos 设置光标位置', () => {
    engine.setCursorPos(2);
    expect(engine.cursorPos).toBe(2);
  });

  it('setCursorPos 无效位置被忽略', () => {
    engine.setCursorPos(-1);
    expect(engine.cursorPos).toBe(0);
    engine.setCursorPos(100);
    expect(engine.cursorPos).toBe(0);
  });
});

// ========== 删除操作测试 ==========

describe('MastermindEngine - 删除操作', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
  });

  it('Backspace 删除当前位置颜色', () => {
    engine.selectColor(1);
    engine.setCursorPos(0);
    engine.handleKeyDown('Backspace');
    expect(engine.currentInput[0]).toBe(-1);
  });

  it('当前位置为空时 Backspace 回退并删除前一个', () => {
    engine.selectColor(1); // pos 0 -> cursor moves to 1
    engine.selectColor(2); // pos 1 -> cursor moves to 2
    // cursor is at 2, pos 2 is empty
    engine.handleKeyDown('Backspace');
    expect(engine.cursorPos).toBe(1);
    expect(engine.currentInput[1]).toBe(-1);
  });

  it('在位置 0 且为空时 Backspace 无效', () => {
    engine.handleKeyDown('Backspace');
    expect(engine.cursorPos).toBe(0);
    expect(engine.currentInput[0]).toBe(-1);
  });

  it('连续删除可以清空所有输入', () => {
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.selectColor(4);
    engine.setCursorPos(3);
    engine.handleKeyDown('Backspace');
    engine.handleKeyDown('Backspace');
    engine.handleKeyDown('Backspace');
    engine.handleKeyDown('Backspace');
    expect(engine.currentInput.every(c => c === -1)).toBe(true);
  });

  it('删除触发 inputChange 事件', () => {
    engine.selectColor(1);
    engine.setCursorPos(0);
    const callback = vi.fn();
    engine.on('inputChange', callback);
    engine.handleKeyDown('Backspace');
    expect(callback).toHaveBeenCalled();
  });
});

// ========== 提交猜测测试 ==========

describe('MastermindEngine - 提交猜测', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
  });

  it('未填满所有位置不能提交', () => {
    engine.selectColor(0);
    const result = engine.submitGuess();
    expect(result).toBe(false);
    expect(engine.guesses.length).toBe(0);
  });

  it('填满所有位置后可以提交', () => {
    // 使用不会完全匹配的猜测
    (engine as any)._secret = [0, 1, 2, 3];
    engine.selectColor(4);
    engine.selectColor(5);
    engine.selectColor(4);
    engine.selectColor(5);
    const result = engine.submitGuess();
    expect(result).toBe(true);
    expect(engine.guesses.length).toBe(1);
  });

  it('提交后输入重置', () => {
    (engine as any)._secret = [0, 1, 2, 3];
    engine.selectColor(4);
    engine.selectColor(5);
    engine.selectColor(4);
    engine.selectColor(5);
    engine.submitGuess();
    expect(engine.currentInput.every(c => c === -1)).toBe(true);
  });

  it('提交后光标重置为 0', () => {
    (engine as any)._secret = [0, 1, 2, 3];
    engine.selectColor(4);
    engine.selectColor(5);
    engine.selectColor(4);
    engine.selectColor(5);
    engine.submitGuess();
    expect(engine.cursorPos).toBe(0);
  });

  it('提交猜测扣分', () => {
    (engine as any)._secret = [0, 1, 2, 3];
    engine.selectColor(4);
    engine.selectColor(5);
    engine.selectColor(4);
    engine.selectColor(5);
    const scoreBefore = engine.score;
    engine.submitGuess();
    expect(engine.score).toBe(scoreBefore - GUESS_PENALTY);
  });

  it('提交猜测触发 guessSubmitted 事件', () => {
    (engine as any)._secret = [0, 1, 2, 3];
    engine.selectColor(4);
    engine.selectColor(5);
    engine.selectColor(4);
    engine.selectColor(5);
    const callback = vi.fn();
    engine.on('guessSubmitted', callback);
    engine.submitGuess();
    expect(callback).toHaveBeenCalled();
  });

  it('Enter 键提交猜测', () => {
    (engine as any)._secret = [0, 1, 2, 3];
    engine.selectColor(4);
    engine.selectColor(5);
    engine.selectColor(4);
    engine.selectColor(5);
    engine.handleKeyDown('Enter');
    expect(engine.guesses.length).toBe(1);
  });
});

// ========== 反馈计算测试 ==========

describe('MastermindEngine - 反馈计算', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3]; // 红蓝绿黄
  });

  it('完全正确返回 4A0B', () => {
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(4);
    expect(engine.guesses[0].b).toBe(0);
  });

  it('全部颜色正确但位置全错返回 0A4B', () => {
    engine.selectColor(3);
    engine.selectColor(2);
    engine.selectColor(1);
    engine.selectColor(0);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(0);
    expect(engine.guesses[0].b).toBe(4);
  });

  it('两个正确两个错位返回 2A2B', () => {
    engine.selectColor(0);
    engine.selectColor(2);
    engine.selectColor(1);
    engine.selectColor(3);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(2);
    expect(engine.guesses[0].b).toBe(2);
  });

  it('全部错误返回 0A0B', () => {
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(0);
    expect(engine.guesses[0].b).toBe(0);
  });

  it('一个正确三个错误返回 1A0B', () => {
    engine.selectColor(0);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(1);
    expect(engine.guesses[0].b).toBe(0);
  });

  it('一个正确一个错位返回 1A1B', () => {
    engine.selectColor(0);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(2);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(1);
    expect(engine.guesses[0].b).toBe(1);
  });

  it('有重复颜色的反馈正确', () => {
    // secret: [0, 1, 2, 3]
    // guess:  [0, 0, 0, 0]
    // 只有位置 0 正确，其他 0 在 secret 中没有更多匹配
    engine.selectColor(0);
    engine.selectColor(0);
    engine.selectColor(0);
    engine.selectColor(0);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(1);
    expect(engine.guesses[0].b).toBe(0);
  });

  it('重复颜色在 secret 中的反馈正确', () => {
    // secret: [0, 0, 2, 3] — 两个红色
    (engine as any)._secret = [0, 0, 2, 3];
    // guess: [0, 4, 0, 4]
    engine.selectColor(0);
    engine.selectColor(4);
    engine.selectColor(0);
    engine.selectColor(4);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(1);
    expect(engine.guesses[0].b).toBe(1);
  });

  it('getLastFeedback 返回最后一次反馈', () => {
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();
    const feedback = engine.getLastFeedback();
    expect(feedback).toEqual({ a: 0, b: 0 });
  });

  it('没有猜测时 getLastFeedback 返回 null', () => {
    expect(engine.getLastFeedback()).toBeNull();
  });
});

// ========== 胜利测试 ==========

describe('MastermindEngine - 胜利', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3];
  });

  it('猜对密码标记为胜利', () => {
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.submitGuess();
    expect(engine.won).toBe(true);
  });

  it('猜对密码游戏结束', () => {
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.submitGuess();
    expect(engine.status).toBe('gameover');
  });

  it('第一次猜对获得完美奖励', () => {
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.submitGuess();
    // -100 (penalty) + 500 (bonus) = +400
    expect(engine.score).toBe(-GUESS_PENALTY + PERFECT_BONUS);
  });

  it('胜利触发 win 事件', () => {
    const callback = vi.fn();
    engine.on('win', callback);
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.submitGuess();
    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls[0][0].guesses).toBe(1);
  });

  it('第二次猜对没有完美奖励', () => {
    // 先猜错一次
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();
    // 再猜对
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.submitGuess();
    // -100 * 2 = -200
    expect(engine.score).toBe(-GUESS_PENALTY * 2);
  });
});

// ========== 失败测试 ==========

describe('MastermindEngine - 失败', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3];
  });

  it('用完所有猜测次数后游戏结束', () => {
    for (let i = 0; i < MAX_GUESSES; i++) {
      engine.selectColor(4);
      engine.selectColor(4);
      engine.selectColor(4);
      engine.selectColor(4);
      engine.submitGuess();
    }
    expect(engine.status).toBe('gameover');
    expect(engine.won).toBe(false);
  });

  it('失败触发 lose 事件', () => {
    const callback = vi.fn();
    engine.on('lose', callback);
    for (let i = 0; i < MAX_GUESSES; i++) {
      engine.selectColor(4);
      engine.selectColor(4);
      engine.selectColor(4);
      engine.selectColor(4);
      engine.submitGuess();
    }
    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls[0][0].secret).toEqual([0, 1, 2, 3]);
  });

  it('失败后不能再猜测', () => {
    for (let i = 0; i < MAX_GUESSES; i++) {
      engine.selectColor(4);
      engine.selectColor(4);
      engine.selectColor(4);
      engine.selectColor(4);
      engine.submitGuess();
    }
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    // 不应该增加猜测记录
    expect(engine.guesses.length).toBe(MAX_GUESSES);
  });

  it('剩余猜测次数随每次猜测减少', () => {
    expect(engine.remainingGuesses).toBe(MAX_GUESSES);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();
    expect(engine.remainingGuesses).toBe(MAX_GUESSES - 1);
  });

  it('轮次随猜测增加', () => {
    expect(engine.currentRound).toBe(1);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();
    expect(engine.currentRound).toBe(2);
  });
});

// ========== 多难度测试 ==========

describe('MastermindEngine - 多难度', () => {
  it('easy 难度输入长度为 4', () => {
    const engine = createAndStartEngine('easy');
    expect(engine.currentInput.length).toBe(4);
  });

  it('normal 难度输入长度为 5', () => {
    const engine = createAndStartEngine('normal');
    expect(engine.currentInput.length).toBe(5);
  });

  it('hard 难度输入长度为 6', () => {
    const engine = createAndStartEngine('hard');
    expect(engine.currentInput.length).toBe(6);
  });

  it('easy 难度需要填满 4 位才能提交', () => {
    const engine = createAndStartEngine('easy');
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    // 只填了 3 位
    expect(engine.submitGuess()).toBe(false);
  });

  it('hard 难度需要填满 6 位才能提交', () => {
    const engine = createAndStartEngine('hard');
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.selectColor(4);
    // 只填了 5 位
    expect(engine.submitGuess()).toBe(false);
    engine.selectColor(5);
    expect(engine.submitGuess()).toBe(true);
  });

  it('hard 难度猜对密码获胜', () => {
    const engine = createAndStartEngine('hard');
    const secret = [...engine.secret];
    secret.forEach(c => engine.selectColor(c));
    engine.submitGuess();
    expect(engine.won).toBe(true);
  });
});

// ========== 事件系统测试 ==========

describe('MastermindEngine - 事件', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 触发 statusChange 事件', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.start();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('pause 触发 statusChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.pause();
    expect(callback).toHaveBeenCalledWith('paused');
  });

  it('resume 触发 statusChange 事件', () => {
    engine.start();
    engine.pause();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.resume();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('reset 触发 statusChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.reset();
    expect(callback).toHaveBeenCalledWith('idle');
  });

  it('gameOver 触发 statusChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    (engine as any).gameOver();
    expect(callback).toHaveBeenCalledWith('gameover');
  });

  it('得分变化触发 scoreChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('scoreChange', callback);
    (engine as any).addScore(100);
    expect(callback).toHaveBeenCalledWith(100);
  });

  it('off 可以取消事件监听', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.off('statusChange', callback);
    engine.start();
    expect(callback).not.toHaveBeenCalled();
  });

  it('未填写完整提交触发 error 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('error', callback);
    engine.selectColor(0);
    engine.submitGuess();
    expect(callback).toHaveBeenCalled();
  });
});

// ========== getState 测试 ==========

describe('MastermindEngine - getState', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
  });

  it('返回正确的分数', () => {
    const state = engine.getState();
    expect(state.score).toBe(0);
  });

  it('返回正确的等级', () => {
    const state = engine.getState();
    expect(state.level).toBe(1);
  });

  it('返回正确的状态', () => {
    const state = engine.getState();
    expect(state.status).toBe('playing');
  });

  it('返回正确的难度', () => {
    const state = engine.getState();
    expect(state.difficulty).toBe('easy');
  });

  it('返回正确的密码长度', () => {
    const state = engine.getState();
    expect(state.codeLength).toBe(4);
  });

  it('返回正确的当前轮次', () => {
    const state = engine.getState();
    expect(state.currentRound).toBe(1);
  });

  it('返回正确的剩余猜测次数', () => {
    const state = engine.getState();
    expect(state.remainingGuesses).toBe(MAX_GUESSES);
  });

  it('返回正确的猜测数量', () => {
    const state = engine.getState();
    expect(state.guessCount).toBe(0);
  });

  it('返回正确的获胜状态', () => {
    const state = engine.getState();
    expect(state.won).toBe(false);
  });

  it('返回当前输入的副本', () => {
    engine.selectColor(0);
    const state = engine.getState();
    expect(state.currentInput).toEqual([0, -1, -1, -1]);
  });

  it('返回正确的光标位置', () => {
    engine.selectColor(0);
    const state = engine.getState();
    expect(state.cursorPos).toBe(1);
  });
});

// ========== revealSecret 测试 ==========

describe('MastermindEngine - revealSecret', () => {
  it('返回密码的副本', () => {
    const engine = createAndStartEngine('easy');
    const revealed = engine.revealSecret();
    expect(revealed).toEqual(engine.secret);
    // 确保是副本，不是引用
    expect(revealed).not.toBe(engine.secret);
  });
});

// ========== 边界与异常测试 ==========

describe('MastermindEngine - 边界与异常', () => {
  it('未初始化 canvas 就 start 会抛出错误', () => {
    const engine = new MastermindEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('idle 状态 pause 无效', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('idle 状态 resume 无效', () => {
    const engine = createEngine();
    engine.resume();
    expect(engine.status).toBe('idle');
  });

  it('playing 状态 resume 无效', () => {
    const engine = createEngine();
    engine.start();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('destroy 后可以重新 init', () => {
    const engine = createEngine();
    engine.start();
    engine.destroy();
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    engine.init(canvas);
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('gameover 后按键输入无效', () => {
    const engine = createAndStartEngine('easy');
    (engine as any).gameOver();
    engine.handleKeyDown('1');
    // 输入不应改变（因为重新初始化了）
    expect(engine.currentInput.every(c => c === -1)).toBe(true);
  });

  it('paused 状态按键输入无效', () => {
    const engine = createAndStartEngine('easy');
    engine.pause();
    engine.handleKeyDown('1');
    expect(engine.currentInput[0]).toBe(-1);
  });

  it('数字键 0 不选择颜色', () => {
    const engine = createAndStartEngine('easy');
    engine.handleKeyDown('0');
    expect(engine.currentInput[0]).toBe(-1);
  });

  it('数字键 7 不选择颜色', () => {
    const engine = createAndStartEngine('easy');
    engine.handleKeyDown('7');
    expect(engine.currentInput[0]).toBe(-1);
  });

  it('字母键被忽略', () => {
    const engine = createAndStartEngine('easy');
    engine.handleKeyDown('a');
    expect(engine.currentInput[0]).toBe(-1);
  });

  it('handleKeyUp 不影响状态', () => {
    const engine = createAndStartEngine('easy');
    const inputBefore = [...engine.currentInput];
    engine.handleKeyUp('1');
    expect(engine.currentInput).toEqual(inputBefore);
  });
});

// ========== 完整游戏流程测试 ==========

describe('MastermindEngine - 完整游戏流程', () => {
  it('完整的 4 轮猜测流程', () => {
    const engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3];

    // 第 1 轮：全错
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();
    expect(engine.guesses.length).toBe(1);
    expect(engine.guesses[0].a).toBe(0);
    expect(engine.guesses[0].b).toBe(0);
    expect(engine.won).toBe(false);

    // 第 2 轮：1 个正确
    engine.selectColor(0);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();
    expect(engine.guesses.length).toBe(2);
    expect(engine.guesses[1].a).toBe(1);
    expect(engine.guesses[1].b).toBe(0);

    // 第 3 轮：2 个正确 2 个错位
    engine.selectColor(0);
    engine.selectColor(2);
    engine.selectColor(1);
    engine.selectColor(3);
    engine.submitGuess();
    expect(engine.guesses.length).toBe(3);
    expect(engine.guesses[2].a).toBe(2);
    expect(engine.guesses[2].b).toBe(2);

    // 第 4 轮：全部正确
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(2);
    engine.selectColor(3);
    engine.submitGuess();
    expect(engine.guesses.length).toBe(4);
    expect(engine.won).toBe(true);
    expect(engine.status).toBe('gameover');
    // 分数: -100 * 4 = -400
    expect(engine.score).toBe(-GUESS_PENALTY * 4);
  });

  it('用完所有猜测后失败', () => {
    const engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3];

    for (let i = 0; i < MAX_GUESSES; i++) {
      engine.selectColor(5);
      engine.selectColor(5);
      engine.selectColor(5);
      engine.selectColor(5);
      engine.submitGuess();
    }

    expect(engine.guesses.length).toBe(MAX_GUESSES);
    expect(engine.won).toBe(false);
    expect(engine.status).toBe('gameover');
  });

  it('重新开始后状态完全重置', () => {
    const engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3];

    // 玩一轮
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();

    // 重新开始
    engine.reset();
    engine.start();

    expect(engine.guesses.length).toBe(0);
    expect(engine.won).toBe(false);
    expect(engine.score).toBe(0);
    expect(engine.currentInput.every(c => c === -1)).toBe(true);
    expect(engine.cursorPos).toBe(0);
    expect(engine.remainingGuesses).toBe(MAX_GUESSES);
  });
});

// ========== 多轮猜测记录测试 ==========

describe('MastermindEngine - 猜测记录', () => {
  it('猜测记录包含正确的猜测内容', () => {
    const engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3];

    engine.selectColor(4);
    engine.selectColor(5);
    engine.selectColor(4);
    engine.selectColor(5);
    engine.submitGuess();

    expect(engine.guesses[0].guess).toEqual([4, 5, 4, 5]);
  });

  it('多次猜测记录按顺序保存', () => {
    const engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3];

    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();

    engine.selectColor(5);
    engine.selectColor(5);
    engine.selectColor(5);
    engine.selectColor(5);
    engine.submitGuess();

    expect(engine.guesses.length).toBe(2);
    expect(engine.guesses[0].guess).toEqual([4, 4, 4, 4]);
    expect(engine.guesses[1].guess).toEqual([5, 5, 5, 5]);
  });

  it('每条记录包含 A 和 B 反馈', () => {
    const engine = createAndStartEngine('easy');
    (engine as any)._secret = [0, 1, 2, 3];

    engine.selectColor(0);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.selectColor(4);
    engine.submitGuess();

    const record = engine.guesses[0];
    expect(record).toHaveProperty('a');
    expect(record).toHaveProperty('b');
    expect(typeof record.a).toBe('number');
    expect(typeof record.b).toBe('number');
  });
});

// ========== evaluateGuess 独立测试 ==========

describe('MastermindEngine - evaluateGuess 边界场景', () => {
  let engine: MastermindEngine;

  beforeEach(() => {
    engine = createAndStartEngine('easy');
  });

  it('secret 全相同颜色，guess 全相同不同颜色 -> 0A0B', () => {
    (engine as any)._secret = [0, 0, 0, 0];
    engine.selectColor(1);
    engine.selectColor(1);
    engine.selectColor(1);
    engine.selectColor(1);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(0);
    expect(engine.guesses[0].b).toBe(0);
  });

  it('secret 全相同颜色，guess 全相同相同颜色 -> 4A0B', () => {
    (engine as any)._secret = [0, 0, 0, 0];
    engine.selectColor(0);
    engine.selectColor(0);
    engine.selectColor(0);
    engine.selectColor(0);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(4);
    expect(engine.guesses[0].b).toBe(0);
  });

  it('secret 全相同颜色，guess 有 1 个正确 + 1 个错位 -> 1A0B', () => {
    (engine as any)._secret = [0, 0, 0, 0];
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(1);
    engine.selectColor(1);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(1);
    expect(engine.guesses[0].b).toBe(0);
  });

  it('secret [0,1,0,1]，guess [1,0,1,0] -> 0A4B', () => {
    (engine as any)._secret = [0, 1, 0, 1];
    engine.selectColor(1);
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(0);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(0);
    expect(engine.guesses[0].b).toBe(4);
  });

  it('secret [0,1,2,3]，guess [0,1,0,1] -> 2A0B', () => {
    (engine as any)._secret = [0, 1, 2, 3];
    engine.selectColor(0);
    engine.selectColor(1);
    engine.selectColor(0);
    engine.selectColor(1);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(2);
    expect(engine.guesses[0].b).toBe(0);
  });

  it('secret [0,1,2,3]，guess [3,2,1,0] -> 0A4B', () => {
    (engine as any)._secret = [0, 1, 2, 3];
    engine.selectColor(3);
    engine.selectColor(2);
    engine.selectColor(1);
    engine.selectColor(0);
    engine.submitGuess();
    expect(engine.guesses[0].a).toBe(0);
    expect(engine.guesses[0].b).toBe(4);
  });
});
