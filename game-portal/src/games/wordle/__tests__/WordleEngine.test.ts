import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WordleEngine,
  calculateFeedback,
  isValidWord,
  getRandomAnswer,
} from '../WordleEngine';
import {
  WORD_LENGTH,
  MAX_GUESSES,
  ALPHABET,
  WORD_LIST,
  BASE_SCORE,
  GUESS_PENALTY,
  WIN_BONUS,
  LetterStatus,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../constants';

// ========== 辅助函数 ==========

/** 创建一个带 mock context 的 canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): WordleEngine {
  const e = new WordleEngine();
  e.init(createMockCanvas());
  e.start();
  return e;
}

function tick(engine: WordleEngine, times: number = 1, dt: number = 16.67): void {
  for (let i = 0; i < times; i++) {
    engine.update(dt);
  }
}

/** 输入一个完整单词 */
function typeWord(engine: WordleEngine, word: string): void {
  for (const ch of word) {
    engine.inputLetter(ch.toUpperCase());
  }
}

/** 输入单词并提交 */
function submitWord(engine: WordleEngine, word: string): boolean {
  typeWord(engine, word);
  return engine.submitGuess();
}

/** 创建引擎并设置指定答案 */
function createEngineWithAnswer(answer: string): WordleEngine {
  const e = createEngine();
  e.setAnswer(answer);
  return e;
}

// ========== calculateFeedback 纯函数测试 ==========

describe('calculateFeedback', () => {
  it('全部正确（绿色）', () => {
    const result = calculateFeedback('APPLE', 'APPLE');
    expect(result).toEqual([
      LetterStatus.CORRECT,
      LetterStatus.CORRECT,
      LetterStatus.CORRECT,
      LetterStatus.CORRECT,
      LetterStatus.CORRECT,
    ]);
  });

  it('全部错误（灰色）', () => {
    const result = calculateFeedback('GHOST', 'BRICK');
    expect(result).toEqual([
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
    ]);
  });

  it('一个字母正确且位置正确（绿色）', () => {
    // CRANE vs CLAIM: C==C CORRECT, R!=L, A==A CORRECT, N!=I, E!=M
    // Let me use: HOUSE vs BLANK -> no match... 
    // TRAIN vs TASTE: T==T CORRECT, R!=A, A!=S, I!=T, N!=E -> only T correct
    const result = calculateFeedback('TRAIN', 'TASTE');
    expect(result[0]).toBe(LetterStatus.CORRECT);
    expect(result.filter(f => f === LetterStatus.CORRECT)).toHaveLength(1);
  });

  it('一个字母存在但位置不对（黄色）', () => {
    // BRAIN vs TABLE: B in TABLE at pos 2 -> PRESENT
    // R not in TABLE, A in TABLE at pos 1 -> but let's check
    // BRAIN = B,R,A,I,N vs TABLE = T,A,B,L,E
    // Pass 1: B!=T, R!=A, A!=B, I!=L, N!=E -> no CORRECT
    // Pass 2: B -> unused {T,A,B,L,E} -> B at pos 2 -> PRESENT
    //         R -> unused {T,A,L,E} -> no R -> ABSENT
    //         A -> unused {T,A,L,E} -> A at pos 1 -> PRESENT
    //         I -> unused {T,L,E} -> no I -> ABSENT
    //         N -> unused {T,L,E} -> no N -> ABSENT
    const result = calculateFeedback('BRAIN', 'TABLE');
    expect(result[0]).toBe(LetterStatus.PRESENT);
    expect(result[2]).toBe(LetterStatus.PRESENT);
  });

  it('混合反馈：绿色+黄色+灰色', () => {
    const result = calculateFeedback('CRANE', 'CROWN');
    // C vs C -> CORRECT
    // R vs R -> CORRECT
    // A vs O -> ABSENT
    // N vs W -> ABSENT
    // E vs N -> PRESENT (N at pos 4 of answer, unused)
    expect(result).toEqual([
      LetterStatus.CORRECT,
      LetterStatus.CORRECT,
      LetterStatus.ABSENT,
      LetterStatus.PRESENT,
      LetterStatus.ABSENT,
    ]);
  });

  it('重复字母：答案中有重复', () => {
    const result = calculateFeedback('LEVEL', 'LIVER');
    expect(result).toEqual([
      LetterStatus.CORRECT,
      LetterStatus.ABSENT,
      LetterStatus.CORRECT,
      LetterStatus.CORRECT,
      LetterStatus.ABSENT,
    ]);
  });

  it('重复字母：猜测中有重复字母但答案只有一个', () => {
    const result = calculateFeedback('SPEED', 'STEAM');
    expect(result).toEqual([
      LetterStatus.CORRECT,
      LetterStatus.ABSENT,
      LetterStatus.CORRECT,
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
    ]);
  });

  it('重复字母：猜测中两个相同字母，答案中有两个但位置不同', () => {
    const result = calculateFeedback('EERIE', 'EVERY');
    expect(result).toEqual([
      LetterStatus.CORRECT,
      LetterStatus.PRESENT,
      LetterStatus.PRESENT,
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
    ]);
  });

  it('全部黄色+绿色混合（字母都对但位置部分错）', () => {
    const result = calculateFeedback('ABCDE', 'EDCBA');
    expect(result).toEqual([
      LetterStatus.PRESENT,
      LetterStatus.PRESENT,
      LetterStatus.CORRECT,
      LetterStatus.PRESENT,
      LetterStatus.PRESENT,
    ]);
  });

  it('猜测中三个相同字母，答案只有一个', () => {
    const result = calculateFeedback('AAAAB', 'APPLE');
    expect(result).toEqual([
      LetterStatus.CORRECT,
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
      LetterStatus.ABSENT,
    ]);
  });

  it('猜测中两个相同字母，答案中有两个（一个位置对一个不对）', () => {
    const result = calculateFeedback('TARTS', 'TRUST');
    expect(result).toEqual([
      LetterStatus.CORRECT,
      LetterStatus.ABSENT,
      LetterStatus.PRESENT,
      LetterStatus.PRESENT,
      LetterStatus.PRESENT,
    ]);
  });

  it('大小写不影响反馈', () => {
    const upper = calculateFeedback('APPLE', 'APPLE');
    const lower = calculateFeedback('apple', 'apple');
    expect(upper).toEqual(lower);
  });

  it('答案和猜测完全不同', () => {
    const result = calculateFeedback('GHOST', 'BLANK');
    expect(result.every(s => s === LetterStatus.ABSENT)).toBe(true);
  });

  it('只有一个字母位置正确', () => {
    const result = calculateFeedback('HOUSE', 'HAPPY');
    expect(result[0]).toBe(LetterStatus.CORRECT);
    expect(result.slice(1).every(s => s === LetterStatus.ABSENT)).toBe(true);
  });

  it('反馈数组长度始终为 WORD_LENGTH', () => {
    const result = calculateFeedback('APPLE', 'WORLD');
    expect(result).toHaveLength(WORD_LENGTH);
  });
});

// ========== isValidWord 测试 ==========

describe('isValidWord', () => {
  it('词库中的单词返回 true', () => {
    expect(isValidWord('APPLE')).toBe(true);
    expect(isValidWord('WORLD')).toBe(true);
    expect(isValidWord('YOUTH')).toBe(true);
  });

  it('不在词库中的单词返回 false', () => {
    expect(isValidWord('QQQQQ')).toBe(false);
    expect(isValidWord('ZZZZZ')).toBe(false);
  });

  it('小写也能匹配（因为内部 toUpperCase）', () => {
    expect(isValidWord('apple')).toBe(true);
    expect(isValidWord('world')).toBe(true);
  });

  it('混合大小写也能匹配', () => {
    expect(isValidWord('ApPlE')).toBe(true);
  });

  it('空字符串返回 false', () => {
    expect(isValidWord('')).toBe(false);
  });

  it('非5字母单词返回 false', () => {
    expect(isValidWord('HI')).toBe(false);
    expect(isValidWord('HELLOO')).toBe(false);
  });

  it('词库中第一个和最后一个单词', () => {
    expect(isValidWord(WORD_LIST[0])).toBe(true);
    expect(isValidWord(WORD_LIST[WORD_LIST.length - 1])).toBe(true);
  });
});

// ========== getRandomAnswer 测试 ==========

describe('getRandomAnswer', () => {
  it('返回5字母大写字符串', () => {
    for (let i = 0; i < 50; i++) {
      const answer = getRandomAnswer();
      expect(answer).toHaveLength(WORD_LENGTH);
      expect(answer).toBe(answer.toUpperCase());
    }
  });

  it('返回的单词在词库中', () => {
    for (let i = 0; i < 50; i++) {
      const answer = getRandomAnswer();
      expect(WORD_LIST).toContain(answer);
    }
  });
});

// ========== 引擎初始化测试 ==========

describe('WordleEngine 初始化', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('init() 不传 canvas 不报错', () => {
    const engine = new WordleEngine();
    expect(() => engine.init()).not.toThrow();
  });

  it('start() 后状态为 playing', () => {
    const engine = new WordleEngine();
    engine.init(createMockCanvas());
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start() 后答案已设置', () => {
    const engine = createEngine();
    expect(engine.answer).toHaveLength(WORD_LENGTH);
    expect(WORD_LIST).toContain(engine.answer);
  });

  it('start() 后初始输入为空', () => {
    const engine = createEngine();
    expect(engine.currentInput).toEqual([]);
  });

  it('start() 后猜测记录为空', () => {
    const engine = createEngine();
    expect(engine.guesses).toEqual([]);
  });

  it('start() 后未获胜', () => {
    const engine = createEngine();
    expect(engine.isWin).toBe(false);
  });

  it('start() 后初始分数为 BASE_SCORE', () => {
    const engine = createEngine();
    expect(engine.score).toBe(BASE_SCORE);
  });

  it('start() 后键盘状态为空', () => {
    const engine = createEngine();
    expect(engine.keyStates.size).toBe(0);
  });

  it('start() 后 currentRound 为 1', () => {
    const engine = createEngine();
    expect(engine.currentRound).toBe(1);
  });

  it('start() 后 remainingGuesses 为 MAX_GUESSES', () => {
    const engine = createEngine();
    expect(engine.remainingGuesses).toBe(MAX_GUESSES);
  });

  it('start() 后无错误消息', () => {
    const engine = createEngine();
    expect(engine.errorMessage).toBe('');
  });
});

// ========== 字母输入测试 ==========

describe('inputLetter', () => {
  let engine: WordleEngine;

  beforeEach(() => {
    localStorage.clear();
    engine = createEngine();
  });

  it('输入单个字母成功', () => {
    expect(engine.inputLetter('A')).toBe(true);
    expect(engine.currentInput).toEqual(['A']);
  });

  it('连续输入多个字母', () => {
    engine.inputLetter('A');
    engine.inputLetter('B');
    engine.inputLetter('C');
    expect(engine.currentInput).toEqual(['A', 'B', 'C']);
  });

  it('输入满 WORD_LENGTH 个字母后不能再输入', () => {
    for (let i = 0; i < WORD_LENGTH; i++) {
      engine.inputLetter(ALPHABET[i]);
    }
    expect(engine.inputLetter('Z')).toBe(false);
    expect(engine.currentInput).toHaveLength(WORD_LENGTH);
  });

  it('非字母字符被拒绝', () => {
    expect(engine.inputLetter('1')).toBe(false);
    expect(engine.inputLetter('@')).toBe(false);
    expect(engine.inputLetter(' ')).toBe(false);
  });

  it('小写字母被拒绝（ALPHABET 是大写）', () => {
    expect(engine.inputLetter('a')).toBe(false);
  });

  it('输入触发 inputChange 事件', () => {
    const spy = vi.fn();
    engine.on('inputChange', spy);
    engine.inputLetter('H');
    expect(spy).toHaveBeenCalledWith(['H']);
  });

  it('连续输入触发多次 inputChange', () => {
    const spy = vi.fn();
    engine.on('inputChange', spy);
    engine.inputLetter('H');
    engine.inputLetter('E');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('输入被拒绝时不触发事件', () => {
    const spy = vi.fn();
    engine.on('inputChange', spy);
    // Fill up input
    for (let i = 0; i < WORD_LENGTH; i++) {
      engine.inputLetter(ALPHABET[i]);
    }
    spy.mockClear();
    engine.inputLetter('Z'); // should fail
    expect(spy).not.toHaveBeenCalled();
  });
});

// ========== 退格删除测试 ==========

describe('deleteLetter', () => {
  let engine: WordleEngine;

  beforeEach(() => {
    localStorage.clear();
    engine = createEngine();
  });

  it('空输入时删除返回 false', () => {
    expect(engine.deleteLetter()).toBe(false);
    expect(engine.currentInput).toEqual([]);
  });

  it('删除最后一个字母', () => {
    engine.inputLetter('A');
    engine.inputLetter('B');
    expect(engine.deleteLetter()).toBe(true);
    expect(engine.currentInput).toEqual(['A']);
  });

  it('连续删除到空', () => {
    engine.inputLetter('A');
    engine.inputLetter('B');
    engine.deleteLetter();
    engine.deleteLetter();
    expect(engine.currentInput).toEqual([]);
  });

  it('删除空后继续删除返回 false', () => {
    engine.inputLetter('A');
    engine.deleteLetter();
    expect(engine.deleteLetter()).toBe(false);
  });

  it('删除触发 inputChange 事件', () => {
    engine.inputLetter('A');
    const spy = vi.fn();
    engine.on('inputChange', spy);
    engine.deleteLetter();
    expect(spy).toHaveBeenCalledWith([]);
  });

  it('输入 ABC 后删除 C', () => {
    engine.inputLetter('A');
    engine.inputLetter('B');
    engine.inputLetter('C');
    engine.deleteLetter();
    expect(engine.currentInput).toEqual(['A', 'B']);
  });
});

// ========== 猜测提交测试 ==========

describe('submitGuess', () => {
  let engine: WordleEngine;

  beforeEach(() => {
    localStorage.clear();
    engine = createEngineWithAnswer('APPLE');
  });

  it('输入不足5个字母时提交失败', () => {
    engine.inputLetter('A');
    expect(engine.submitGuess()).toBe(false);
    expect(engine.errorMessage).toBe('Not enough letters');
  });

  it('空输入提交失败', () => {
    expect(engine.submitGuess()).toBe(false);
    expect(engine.errorMessage).toBe('Not enough letters');
  });

  it('输入不在词库中的单词提交失败', () => {
    typeWord(engine, 'QQQQQ');
    expect(engine.submitGuess()).toBe(false);
    expect(engine.errorMessage).toBe('Not in word list');
  });

  it('提交有效单词成功', () => {
    expect(submitWord(engine, 'WORLD')).toBe(true);
    expect(engine.guesses).toHaveLength(1);
  });

  it('提交后 currentInput 被清空（非获胜/失败时）', () => {
    submitWord(engine, 'WORLD');
    expect(engine.currentInput).toEqual([]);
  });

  it('提交后 currentRound 增加', () => {
    submitWord(engine, 'WORLD');
    expect(engine.currentRound).toBe(2);
  });

  it('提交后 remainingGuesses 减少', () => {
    submitWord(engine, 'WORLD');
    expect(engine.remainingGuesses).toBe(MAX_GUESSES - 1);
  });

  it('提交后分数减少 GUESS_PENALTY', () => {
    submitWord(engine, 'WORLD');
    expect(engine.score).toBe(BASE_SCORE - GUESS_PENALTY);
  });

  it('提交正确答案获胜', () => {
    submitWord(engine, 'APPLE');
    expect(engine.isWin).toBe(true);
  });

  it('获胜后状态为 gameover', () => {
    submitWord(engine, 'APPLE');
    expect(engine.status).toBe('gameover');
  });

  it('获胜后分数加上 WIN_BONUS', () => {
    submitWord(engine, 'APPLE');
    expect(engine.score).toBe(BASE_SCORE - GUESS_PENALTY + WIN_BONUS);
  });

  it('提交触发 scoreChange 事件', () => {
    const spy = vi.fn();
    engine.on('scoreChange', spy);
    submitWord(engine, 'WORLD');
    expect(spy).toHaveBeenCalled();
  });

  it('提交触发 guessSubmitted 事件（非终局）', () => {
    const spy = vi.fn();
    engine.on('guessSubmitted', spy);
    submitWord(engine, 'WORLD');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ word: 'WORLD', round: 1 })
    );
  });

  it('获胜时触发 win 事件', () => {
    const spy = vi.fn();
    engine.on('win', spy);
    submitWord(engine, 'APPLE');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ guesses: 1, score: BASE_SCORE - GUESS_PENALTY + WIN_BONUS })
    );
  });
});

// ========== 颜色反馈测试 ==========

describe('颜色反馈', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('正确字母正确位置为绿色', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'ADMIT');
    const feedback = engine.guesses[0].feedback;
    expect(feedback[0]).toBe(LetterStatus.CORRECT);
  });

  it('正确字母错误位置为黄色', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'TABLE');
    // T vs A -> ABSENT
    // A vs P -> PRESENT (A in APPLE at pos 0)
    // B vs P -> ABSENT
    // L vs L -> CORRECT
    // E vs E -> CORRECT
    const feedback = engine.guesses[0].feedback;
    expect(feedback[1]).toBe(LetterStatus.PRESENT);
  });

  it('不存在的字母为灰色', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'BRICK');
    // B vs A -> ABSENT, R vs P -> ABSENT, I vs P -> ABSENT, C vs L -> ABSENT, K vs E -> ABSENT
    const feedback = engine.guesses[0].feedback;
    expect(feedback.every(f => f === LetterStatus.ABSENT)).toBe(true);
  });

  it('所有字母正确为全绿', () => {
    const engine = createEngineWithAnswer('WORLD');
    submitWord(engine, 'WORLD');
    const feedback = engine.guesses[0].feedback;
    expect(feedback.every(f => f === LetterStatus.CORRECT)).toBe(true);
  });

  it('键盘状态更新：绿色优先级最高', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'ADMIT');
    expect(engine.getKeyState('A')).toBe(LetterStatus.CORRECT);
  });

  it('键盘状态更新：黄色覆盖灰色', () => {
    const engine = createEngineWithAnswer('APPLE');
    // Guess "AGENT" -> A CORRECT, G ABSENT, E PRESENT, N ABSENT, T ABSENT
    submitWord(engine, 'AGENT');
    expect(engine.getKeyState('G')).toBe(LetterStatus.ABSENT);
    expect(engine.getKeyState('E')).toBe(LetterStatus.PRESENT);
  });

  it('键盘状态：黄色不覆盖绿色', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'ADMIT');
    expect(engine.getKeyState('A')).toBe(LetterStatus.CORRECT);

    // Second guess: ABUSE -> A at pos 0 CORRECT
    submitWord(engine, 'ABUSE');
    expect(engine.getKeyState('A')).toBe(LetterStatus.CORRECT);
  });

  it('键盘状态：灰色不覆盖黄色', () => {
    const engine = createEngineWithAnswer('APPLE');
    // Guess "AGENT" -> E PRESENT
    submitWord(engine, 'AGENT');
    expect(engine.getKeyState('E')).toBe(LetterStatus.PRESENT);

    // Guess "BRICK" -> E not in guess, but PRESENT should stay
    submitWord(engine, 'BRICK');
    expect(engine.getKeyState('E')).toBe(LetterStatus.PRESENT);
  });
});

// ========== 词库验证测试 ==========

describe('词库验证', () => {
  it('词库不为空', () => {
    expect(WORD_LIST.length).toBeGreaterThan(0);
  });

  it('词库中所有单词都是5个字母', () => {
    for (const word of WORD_LIST) {
      expect(word).toHaveLength(WORD_LENGTH);
    }
  });

  it('词库中所有单词都是大写', () => {
    for (const word of WORD_LIST) {
      expect(word).toBe(word.toUpperCase());
    }
  });

  it('词库中所有单词只包含字母', () => {
    for (const word of WORD_LIST) {
      expect(/^[A-Z]+$/.test(word)).toBe(true);
    }
  });

  it('词库至少有 100 个单词', () => {
    expect(WORD_LIST.length).toBeGreaterThanOrEqual(100);
  });

  it('常见单词在词库中', () => {
    const common = ['APPLE', 'WORLD', 'HOUSE', 'WATER', 'MUSIC', 'HAPPY', 'LIGHT', 'NIGHT'];
    for (const word of common) {
      expect(WORD_LIST).toContain(word);
    }
  });
});

// ========== 胜利判定测试 ==========

describe('胜利判定', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('第一次猜中即获胜', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    expect(engine.isWin).toBe(true);
    expect(engine.guesses).toHaveLength(1);
  });

  it('第二次猜中获胜', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    submitWord(engine, 'APPLE');
    expect(engine.isWin).toBe(true);
    expect(engine.guesses).toHaveLength(2);
  });

  it('最后一次机会猜中获胜', () => {
    const engine = createEngineWithAnswer('APPLE');
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
      expect(engine.isWin).toBe(false);
    }
    submitWord(engine, 'APPLE');
    expect(engine.isWin).toBe(true);
    expect(engine.guesses).toHaveLength(MAX_GUESSES);
  });

  it('获胜后 inputLetter 因 currentInput 已满而失败', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    // After win, currentInput is NOT cleared (contains 'APPLE'), so inputLetter fails due to length
    expect(engine.currentInput).toEqual(['A', 'P', 'P', 'L', 'E']);
    const result = engine.inputLetter('Z');
    expect(result).toBe(false);
  });

  it('获胜分数计算正确', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    expect(engine.score).toBe(BASE_SCORE - GUESS_PENALTY + WIN_BONUS);
  });

  it('多次猜测后获胜分数', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    submitWord(engine, 'HOUSE');
    submitWord(engine, 'APPLE');
    expect(engine.score).toBe(BASE_SCORE - 3 * GUESS_PENALTY + WIN_BONUS);
  });

  it('获胜时触发 statusChange 为 gameover', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('statusChange', spy);
    submitWord(engine, 'APPLE');
    expect(spy).toHaveBeenCalledWith('gameover');
  });
});

// ========== 失败判定测试 ==========

describe('失败判定', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('用完所有猜测次数后失败', () => {
    const engine = createEngineWithAnswer('APPLE');
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (let i = 0; i < wrongWords.length - 1; i++) {
      submitWord(engine, wrongWords[i]);
      expect(engine.status).toBe('playing');
    }
    submitWord(engine, wrongWords[5]); // 6th guess
    expect(engine.isWin).toBe(false);
    expect(engine.status).toBe('gameover');
  });

  it('失败时触发 lose 事件', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('lose', spy);
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ answer: 'APPLE' })
    );
  });

  it('失败后分数不包含 WIN_BONUS', () => {
    const engine = createEngineWithAnswer('APPLE');
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(engine.score).toBe(BASE_SCORE - MAX_GUESSES * GUESS_PENALTY);
  });

  it('失败时猜测记录为 MAX_GUESSES', () => {
    const engine = createEngineWithAnswer('APPLE');
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(engine.guesses).toHaveLength(MAX_GUESSES);
  });
});

// ========== 统计测试 ==========

describe('游戏统计', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('初始统计全为0', () => {
    const engine = new WordleEngine();
    engine.init();
    expect(engine.stats.totalGames).toBe(0);
    expect(engine.stats.wins).toBe(0);
    expect(engine.stats.currentStreak).toBe(0);
    expect(engine.stats.maxStreak).toBe(0);
    expect(engine.stats.guessDistribution).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('获胜后统计更新', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    expect(engine.stats.totalGames).toBe(1);
    expect(engine.stats.wins).toBe(1);
    expect(engine.stats.currentStreak).toBe(1);
    expect(engine.stats.guessDistribution[0]).toBe(1);
  });

  it('失败后统计更新', () => {
    const engine = createEngineWithAnswer('APPLE');
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(engine.stats.totalGames).toBe(1);
    expect(engine.stats.wins).toBe(0);
    expect(engine.stats.currentStreak).toBe(0);
  });

  it('猜测次数分布正确', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    submitWord(engine, 'APPLE');
    expect(engine.stats.guessDistribution[1]).toBe(1); // 2nd guess win
  });

  it('连续获胜更新最大连胜', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    expect(engine.stats.currentStreak).toBe(1);
    expect(engine.stats.maxStreak).toBe(1);

    engine.reset();
    engine.start();
    engine.setAnswer('WORLD');
    submitWord(engine, 'WORLD');
    expect(engine.stats.currentStreak).toBe(2);
    expect(engine.stats.maxStreak).toBe(2);
  });

  it('失败后连胜归零', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    expect(engine.stats.currentStreak).toBe(1);

    engine.reset();
    engine.start();
    engine.setAnswer('WORLD');
    const wrongWords = ['APPLE', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(engine.stats.currentStreak).toBe(0);
    expect(engine.stats.maxStreak).toBe(1);
  });

  it('resetStats 清空统计', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    expect(engine.stats.totalGames).toBe(1);
    engine.resetStats();
    expect(engine.stats.totalGames).toBe(0);
    expect(engine.stats.wins).toBe(0);
    expect(engine.stats.currentStreak).toBe(0);
    expect(engine.stats.maxStreak).toBe(0);
  });

  it('统计保存到 localStorage', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    engine.saveStats();
    const stored = localStorage.getItem('wordle_stats');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.totalGames).toBe(1);
    expect(parsed.wins).toBe(1);
  });

  it('loadStats 从 localStorage 读取', () => {
    localStorage.setItem('wordle_stats', JSON.stringify({
      totalGames: 10,
      wins: 7,
      currentStreak: 3,
      maxStreak: 5,
      guessDistribution: [2, 1, 1, 2, 1, 0],
    }));
    const engine = new WordleEngine();
    engine.init();
    expect(engine.stats.totalGames).toBe(10);
    expect(engine.stats.wins).toBe(7);
    expect(engine.stats.currentStreak).toBe(3);
    expect(engine.stats.maxStreak).toBe(5);
  });

  it('loadStats 处理损坏的 localStorage 数据', () => {
    localStorage.setItem('wordle_stats', 'invalid json');
    const engine = new WordleEngine();
    engine.init();
    expect(engine.stats.totalGames).toBe(0);
  });

  it('loadStats 处理缺失字段', () => {
    localStorage.setItem('wordle_stats', JSON.stringify({ totalGames: 5 }));
    const engine = new WordleEngine();
    engine.init();
    expect(engine.stats.totalGames).toBe(5);
    expect(engine.stats.wins).toBe(0);
    expect(engine.stats.guessDistribution).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

// ========== 键盘输入处理测试 ==========

describe('handleKeyDown', () => {
  let engine: WordleEngine;

  beforeEach(() => {
    localStorage.clear();
    engine = createEngineWithAnswer('APPLE');
  });

  it('字母键输入', () => {
    engine.handleKeyDown('a');
    expect(engine.currentInput).toEqual(['A']);
  });

  it('Enter 提交猜测', () => {
    engine.handleKeyDown('A');
    engine.handleKeyDown('P');
    engine.handleKeyDown('P');
    engine.handleKeyDown('L');
    engine.handleKeyDown('E');
    engine.handleKeyDown('Enter');
    expect(engine.guesses).toHaveLength(1);
    expect(engine.isWin).toBe(true);
  });

  it('Backspace 删除字母', () => {
    engine.handleKeyDown('A');
    engine.handleKeyDown('B');
    engine.handleKeyDown('Backspace');
    expect(engine.currentInput).toEqual(['A']);
  });

  it('N 键重置并开始新游戏', () => {
    engine.handleKeyDown('N');
    expect(engine.status).toBe('playing');
    expect(engine.currentInput).toEqual([]);
  });

  it('gameover 状态下 N 键重新开始', () => {
    submitWord(engine, 'APPLE');
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown('N');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下 Enter 键重新开始', () => {
    submitWord(engine, 'APPLE');
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下空格键重新开始', () => {
    submitWord(engine, 'APPLE');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('idle 状态下 Enter 键开始游戏', () => {
    const e = new WordleEngine();
    e.init(createMockCanvas());
    expect(e.status).toBe('idle');
    e.handleKeyDown('Enter');
    expect(e.status).toBe('playing');
  });

  it('idle 状态下空格键开始游戏', () => {
    const e = new WordleEngine();
    e.init(createMockCanvas());
    e.handleKeyDown(' ');
    expect(e.status).toBe('playing');
  });

  it('无效键不做任何操作', () => {
    engine.handleKeyDown('1');
    engine.handleKeyDown('@');
    engine.handleKeyDown('F1');
    expect(engine.currentInput).toEqual([]);
  });

  it('gameover 状态下字母键通过 handleKeyDown 被忽略（提前返回）', () => {
    submitWord(engine, 'APPLE');
    expect(engine.status).toBe('gameover');
    // After win, currentInput still has 'APPLE'
    // handleKeyDown in gameover state returns early for letter keys
    engine.handleKeyDown('Z');
    // Z is not handled because handleKeyDown returns early for non-N/Enter/Space in gameover
    // But currentInput still has the winning word
    expect(engine.currentInput).toEqual(['A', 'P', 'P', 'L', 'E']);
  });
});

// ========== handleKeyUp 测试 ==========

describe('handleKeyUp', () => {
  it('handleKeyUp 不报错', () => {
    const engine = createEngine();
    expect(() => engine.handleKeyUp('A')).not.toThrow();
    expect(() => engine.handleKeyUp('Enter')).not.toThrow();
  });
});

// ========== setAnswer 测试 ==========

describe('setAnswer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('设置5字母答案', () => {
    const engine = createEngine();
    engine.setAnswer('WORLD');
    expect(engine.answer).toBe('WORLD');
  });

  it('自动转为大写', () => {
    const engine = createEngine();
    engine.setAnswer('world');
    expect(engine.answer).toBe('WORLD');
  });

  it('非5字母答案不设置', () => {
    const engine = createEngine();
    const original = engine.answer;
    engine.setAnswer('AB');
    expect(engine.answer).toBe(original);
  });
});

// ========== getKeyState 测试 ==========

describe('getKeyState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('未使用的字母返回 UNUSED', () => {
    const engine = createEngine();
    expect(engine.getKeyState('A')).toBe(LetterStatus.UNUSED);
  });

  it('猜测后返回正确状态', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'ADMIT');
    expect(engine.getKeyState('A')).toBe(LetterStatus.CORRECT);
    expect(engine.getKeyState('D')).toBe(LetterStatus.ABSENT);
  });

  it('大小写不敏感', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'ADMIT');
    expect(engine.getKeyState('a')).toBe(LetterStatus.CORRECT);
  });
});

// ========== getState 测试 ==========

describe('getState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('返回完整游戏状态', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('status');
    expect(state).toHaveProperty('answer');
    expect(state).toHaveProperty('guesses');
    expect(state).toHaveProperty('currentInput');
    expect(state).toHaveProperty('keyStates');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('currentRound');
    expect(state).toHaveProperty('remainingGuesses');
    expect(state).toHaveProperty('stats');
  });

  it('返回正确的猜测记录', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    const state = engine.getState();
    const guesses = state.guesses as Array<{ word: string; feedback: string[] }>;
    expect(guesses).toHaveLength(1);
    expect(guesses[0].word).toBe('WORLD');
  });

  it('返回正确的答案', () => {
    const engine = createEngineWithAnswer('APPLE');
    expect(engine.getState().answer).toBe('APPLE');
  });

  it('返回正确的当前轮次', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    expect(engine.getState().currentRound).toBe(2);
  });
});

// ========== update 测试 ==========

describe('update (tick)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('update 不报错', () => {
    const engine = createEngine();
    expect(() => tick(engine, 10)).not.toThrow();
  });

  it('错误消息在2秒后清除', () => {
    const engine = createEngineWithAnswer('APPLE');
    engine.inputLetter('A');
    engine.submitGuess(); // Not enough letters
    expect(engine.errorMessage).toBe('Not enough letters');

    // Mock Date.now to control time
    const originalNow = Date.now;
    const baseTime = Date.now();
    let mockTime = baseTime;
    Date.now = () => mockTime;

    // The error was set at baseTime, so we need time > baseTime + 2000
    tick(engine, 10, 16.67); // process some updates
    expect(engine.errorMessage).toBe('Not enough letters');

    // Advance past 2 seconds
    mockTime = baseTime + 2001;
    tick(engine, 1, 16.67);
    expect(engine.errorMessage).toBe('');

    Date.now = originalNow;
  });

  it('错误消息在2秒内不清除', () => {
    const engine = createEngineWithAnswer('APPLE');
    engine.inputLetter('A');
    engine.submitGuess();
    expect(engine.errorMessage).toBe('Not enough letters');

    const originalNow = Date.now;
    const baseTime = Date.now();
    let mockTime = baseTime;
    Date.now = () => mockTime;

    mockTime = baseTime + 1000; // Only 1 second passed
    tick(engine, 1, 16.67);
    expect(engine.errorMessage).toBe('Not enough letters');

    Date.now = originalNow;
  });
});

// ========== 无效单词处理测试 ==========

describe('无效单词处理', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('输入 QQQQQ 显示不在词库中', () => {
    const engine = createEngine();
    typeWord(engine, 'QQQQQ');
    expect(engine.submitGuess()).toBe(false);
    expect(engine.errorMessage).toBe('Not in word list');
  });

  it('输入 ZZZZZ 显示不在词库中', () => {
    const engine = createEngine();
    typeWord(engine, 'ZZZZZ');
    expect(engine.submitGuess()).toBe(false);
    expect(engine.errorMessage).toBe('Not in word list');
  });

  it('无效单词不消耗猜测次数', () => {
    const engine = createEngine();
    typeWord(engine, 'QQQQQ');
    engine.submitGuess();
    expect(engine.guesses).toHaveLength(0);
    expect(engine.remainingGuesses).toBe(MAX_GUESSES);
  });

  it('无效单词不扣分', () => {
    const engine = createEngine();
    typeWord(engine, 'QQQQQ');
    engine.submitGuess();
    expect(engine.score).toBe(BASE_SCORE);
  });

  it('输入不足显示字母不够', () => {
    const engine = createEngine();
    engine.inputLetter('A');
    engine.inputLetter('B');
    engine.submitGuess();
    expect(engine.errorMessage).toBe('Not enough letters');
  });

  it('输入不足不消耗猜测次数', () => {
    const engine = createEngine();
    engine.inputLetter('A');
    engine.submitGuess();
    expect(engine.guesses).toHaveLength(0);
  });
});

// ========== 边界情况测试 ==========

describe('边界情况', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('连续快速输入5个字母', () => {
    const engine = createEngine();
    const result = ['H', 'E', 'L', 'L', 'O'].map(l => engine.inputLetter(l));
    expect(result.every(r => r === true)).toBe(true);
    expect(engine.currentInput).toEqual(['H', 'E', 'L', 'L', 'O']);
  });

  it('输入5个字母后删除再输入', () => {
    const engine = createEngine();
    typeWord(engine, 'HELLO');
    engine.deleteLetter();
    engine.inputLetter('S');
    expect(engine.currentInput).toEqual(['H', 'E', 'L', 'L', 'S']);
  });

  it('全部删除后重新输入', () => {
    const engine = createEngine();
    typeWord(engine, 'HELLO');
    for (let i = 0; i < WORD_LENGTH; i++) {
      engine.deleteLetter();
    }
    expect(engine.currentInput).toEqual([]);
    typeWord(engine, 'WORLD');
    expect(engine.currentInput).toEqual(['W', 'O', 'R', 'L', 'D']);
  });

  it('分数不会低于0', () => {
    const engine = createEngineWithAnswer('APPLE');
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(engine.score).toBeGreaterThanOrEqual(0);
  });

  it('多次 reset 和 start 循环', () => {
    const engine = new WordleEngine();
    engine.init(createMockCanvas());
    for (let i = 0; i < 5; i++) {
      engine.start();
      expect(engine.status).toBe('playing');
      engine.reset();
      expect(engine.status).toBe('idle');
    }
  });

  it('游戏结束后 reset 再 start', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    expect(engine.status).toBe('gameover');
    engine.reset();
    expect(engine.status).toBe('idle');
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('destroy 后不报错', () => {
    const engine = createEngine();
    expect(() => engine.destroy()).not.toThrow();
  });

  it('猜测记录包含正确的反馈', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'ADMIT');
    const guess = engine.guesses[0];
    expect(guess.word).toBe('ADMIT');
    expect(guess.feedback).toHaveLength(WORD_LENGTH);
    expect(guess.feedback[0]).toBe(LetterStatus.CORRECT); // A at pos 0
  });

  it('多次猜测后猜测记录按顺序保存', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    submitWord(engine, 'HOUSE');
    submitWord(engine, 'APPLE');
    expect(engine.guesses[0].word).toBe('WORLD');
    expect(engine.guesses[1].word).toBe('HOUSE');
    expect(engine.guesses[2].word).toBe('APPLE');
  });

  it('空格键在 idle 状态开始游戏', () => {
    const engine = new WordleEngine();
    engine.init(createMockCanvas());
    expect(engine.status).toBe('idle');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('重复提交同一个有效单词', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    submitWord(engine, 'WORLD');
    expect(engine.guesses).toHaveLength(2);
    expect(engine.guesses[0].word).toBe('WORLD');
    expect(engine.guesses[1].word).toBe('WORLD');
  });

  it('连续输入超过 WORD_LENGTH 的字母被忽略', () => {
    const engine = createEngine();
    for (let i = 0; i < 10; i++) {
      engine.inputLetter(ALPHABET[i % 26]);
    }
    expect(engine.currentInput).toHaveLength(WORD_LENGTH);
  });
});

// ========== 事件系统测试 ==========

describe('事件系统', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('scoreChange 事件在每次分数变化时触发', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('scoreChange', spy);
    submitWord(engine, 'WORLD');
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall[0]).toBe(BASE_SCORE - GUESS_PENALTY);
  });

  it('win 事件包含猜测次数', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('win', spy);
    submitWord(engine, 'WORLD');
    submitWord(engine, 'APPLE');
    expect(spy).toHaveBeenCalledWith({ guesses: 2, score: BASE_SCORE - 2 * GUESS_PENALTY + WIN_BONUS });
  });

  it('lose 事件包含答案', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('lose', spy);
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(spy).toHaveBeenCalledWith({ answer: 'APPLE' });
  });

  it('error 事件在无效输入时触发', () => {
    const engine = createEngine();
    const spy = vi.fn();
    engine.on('error', spy);
    engine.inputLetter('A');
    engine.submitGuess(); // Not enough letters
    expect(spy).toHaveBeenCalledWith('Not enough letters');
  });

  it('off 取消事件监听', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('scoreChange', spy);
    engine.off('scoreChange', spy);
    submitWord(engine, 'WORLD');
    expect(spy).not.toHaveBeenCalled();
  });

  it('guessSubmitted 事件包含反馈信息', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('guessSubmitted', spy);
    submitWord(engine, 'WORLD');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'WORLD',
        round: 1,
        feedback: expect.any(Array),
      })
    );
  });

  it('statusChange 事件在获胜时触发', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('statusChange', spy);
    submitWord(engine, 'APPLE');
    expect(spy).toHaveBeenCalledWith('gameover');
  });

  it('statusChange 事件在失败时触发', () => {
    const engine = createEngineWithAnswer('APPLE');
    const spy = vi.fn();
    engine.on('statusChange', spy);
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(spy).toHaveBeenCalledWith('gameover');
  });
});

// ========== 完整游戏流程测试 ==========

describe('完整游戏流程', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('完整的6次猜测失败流程', () => {
    const engine = createEngineWithAnswer('APPLE');
    const guesses = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];

    for (let i = 0; i < guesses.length; i++) {
      expect(engine.currentRound).toBe(i + 1);
      expect(engine.remainingGuesses).toBe(MAX_GUESSES - i);
      submitWord(engine, guesses[i]);
    }

    expect(engine.isWin).toBe(false);
    expect(engine.status).toBe('gameover');
    expect(engine.guesses).toHaveLength(MAX_GUESSES);
    expect(engine.stats.totalGames).toBe(1);
    expect(engine.stats.wins).toBe(0);
  });

  it('完整的3次猜测获胜流程', () => {
    const engine = createEngineWithAnswer('APPLE');

    submitWord(engine, 'WORLD');
    expect(engine.status).toBe('playing');

    submitWord(engine, 'HOUSE');
    expect(engine.status).toBe('playing');

    submitWord(engine, 'APPLE');
    expect(engine.isWin).toBe(true);
    expect(engine.status).toBe('gameover');
    expect(engine.stats.totalGames).toBe(1);
    expect(engine.stats.wins).toBe(1);
    expect(engine.stats.guessDistribution[2]).toBe(1);
  });

  it('重置后开始新游戏', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');

    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.guesses).toEqual([]);
    expect(engine.currentInput).toEqual([]);

    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.answer).toHaveLength(WORD_LENGTH);
  });

  it('通过 handleKeyDown 玩完整游戏', () => {
    const engine = createEngineWithAnswer('APPLE');

    ['W', 'O', 'R', 'L', 'D'].forEach(k => engine.handleKeyDown(k));
    engine.handleKeyDown('Enter');
    expect(engine.guesses).toHaveLength(1);

    ['A', 'P', 'P', 'L', 'E'].forEach(k => engine.handleKeyDown(k));
    engine.handleKeyDown('Enter');
    expect(engine.isWin).toBe(true);
  });

  it('通过 handleKeyDown 使用退格修改输入', () => {
    const engine = createEngineWithAnswer('APPLE');

    ['W', 'O', 'R', 'L', 'X'].forEach(k => engine.handleKeyDown(k));
    engine.handleKeyDown('Backspace');
    engine.handleKeyDown('D');
    engine.handleKeyDown('Enter');
    expect(engine.guesses[0].word).toBe('WORLD');
  });
});

// ========== 常量验证测试 ==========

describe('常量', () => {
  it('WORD_LENGTH 为 5', () => {
    expect(WORD_LENGTH).toBe(5);
  });

  it('MAX_GUESSES 为 6', () => {
    expect(MAX_GUESSES).toBe(6);
  });

  it('ALPHABET 包含26个字母', () => {
    expect(ALPHABET).toHaveLength(26);
  });

  it('BASE_SCORE 为 1000', () => {
    expect(BASE_SCORE).toBe(1000);
  });

  it('GUESS_PENALTY 为 100', () => {
    expect(GUESS_PENALTY).toBe(100);
  });

  it('WIN_BONUS 为 500', () => {
    expect(WIN_BONUS).toBe(500);
  });

  it('LetterStatus 枚举值正确', () => {
    expect(LetterStatus.UNUSED).toBe('unused');
    expect(LetterStatus.ABSENT).toBe('absent');
    expect(LetterStatus.PRESENT).toBe('present');
    expect(LetterStatus.CORRECT).toBe('correct');
  });
});

// ========== 键盘状态优先级测试 ==========

describe('键盘状态优先级', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('CORRECT > PRESENT > ABSENT', () => {
    const engine = createEngineWithAnswer('APPLE');
    // Guess "AGENT" -> A CORRECT, G ABSENT, E PRESENT, N ABSENT, T ABSENT
    submitWord(engine, 'AGENT');
    expect(engine.getKeyState('A')).toBe(LetterStatus.CORRECT);
    expect(engine.getKeyState('G')).toBe(LetterStatus.ABSENT);
    expect(engine.getKeyState('E')).toBe(LetterStatus.PRESENT);
  });

  it('PRESENT 不被后续 ABSENT 覆盖', () => {
    const engine = createEngineWithAnswer('APPLE');
    // Guess "AGENT" -> E PRESENT
    submitWord(engine, 'AGENT');
    expect(engine.getKeyState('E')).toBe(LetterStatus.PRESENT);

    // Guess "BRICK" -> E not in guess, state stays PRESENT
    submitWord(engine, 'BRICK');
    expect(engine.getKeyState('E')).toBe(LetterStatus.PRESENT);
  });

  it('ABSENT 可升级为 PRESENT', () => {
    const engine = createEngineWithAnswer('APPLE');
    // Guess "BRICK" -> all ABSENT
    submitWord(engine, 'BRICK');
    expect(engine.getKeyState('B')).toBe(LetterStatus.ABSENT);

    // Guess "TABLE" -> A PRESENT (at pos 0 of answer)
    submitWord(engine, 'TABLE');
    expect(engine.getKeyState('A')).toBe(LetterStatus.PRESENT);
  });

  it('ABSENT 可升级为 CORRECT', () => {
    const engine = createEngineWithAnswer('APPLE');
    // Guess "BRICK" -> all ABSENT
    submitWord(engine, 'BRICK');
    expect(engine.getKeyState('A')).toBe(LetterStatus.UNUSED);

    // Guess "ADMIT" -> A CORRECT
    submitWord(engine, 'ADMIT');
    expect(engine.getKeyState('A')).toBe(LetterStatus.CORRECT);
  });

  it('PRESENT 可升级为 CORRECT', () => {
    const engine = createEngineWithAnswer('APPLE');
    // Guess "AGENT" -> E PRESENT
    submitWord(engine, 'AGENT');
    expect(engine.getKeyState('E')).toBe(LetterStatus.PRESENT);

    // Guess "HOUSE" -> E at pos 4 == E at pos 4 of APPLE -> CORRECT
    submitWord(engine, 'HOUSE');
    expect(engine.getKeyState('E')).toBe(LetterStatus.CORRECT);
  });
});

// ========== 分数计算测试 ==========

describe('分数计算', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('初始分数为 BASE_SCORE', () => {
    const engine = createEngine();
    expect(engine.score).toBe(BASE_SCORE);
  });

  it('每次猜测扣除 GUESS_PENALTY', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'WORLD');
    expect(engine.score).toBe(BASE_SCORE - GUESS_PENALTY);
    submitWord(engine, 'HOUSE');
    expect(engine.score).toBe(BASE_SCORE - 2 * GUESS_PENALTY);
  });

  it('获胜加上 WIN_BONUS', () => {
    const engine = createEngineWithAnswer('APPLE');
    submitWord(engine, 'APPLE');
    expect(engine.score).toBe(BASE_SCORE - GUESS_PENALTY + WIN_BONUS);
  });

  it('6次猜测后失败分数为 BASE_SCORE - 6 * GUESS_PENALTY', () => {
    const engine = createEngineWithAnswer('APPLE');
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT', 'NIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    expect(engine.score).toBe(BASE_SCORE - 6 * GUESS_PENALTY);
  });

  it('第6次猜测获胜分数', () => {
    const engine = createEngineWithAnswer('APPLE');
    const wrongWords = ['WORLD', 'HOUSE', 'WATER', 'MUSIC', 'LIGHT'];
    for (const word of wrongWords) {
      submitWord(engine, word);
    }
    submitWord(engine, 'APPLE');
    expect(engine.score).toBe(BASE_SCORE - 6 * GUESS_PENALTY + WIN_BONUS);
  });
});

// ========== 输入边界测试 ==========

describe('输入边界', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('输入特殊字符被拒绝', () => {
    const engine = createEngine();
    expect(engine.inputLetter('!')).toBe(false);
    expect(engine.inputLetter('@')).toBe(false);
    expect(engine.inputLetter('#')).toBe(false);
    expect(engine.inputLetter('$')).toBe(false);
    expect(engine.inputLetter('%')).toBe(false);
  });

  it('输入数字被拒绝', () => {
    const engine = createEngine();
    for (let i = 0; i <= 9; i++) {
      expect(engine.inputLetter(String(i))).toBe(false);
    }
  });

  it('输入小写字母被拒绝（ALPHABET 是大写）', () => {
    const engine = createEngine();
    expect(engine.inputLetter('a')).toBe(false);
    expect(engine.inputLetter('z')).toBe(false);
  });

  it('所有26个大写字母都可以输入', () => {
    for (const ch of ALPHABET) {
      const e = createEngine();
      expect(e.inputLetter(ch)).toBe(true);
    }
  });

  it('输入单个空格字符被拒绝', () => {
    const engine = createEngine();
    expect(engine.inputLetter(' ')).toBe(false);
  });

  it('输入 Unicode 字符被拒绝', () => {
    const engine = createEngine();
    expect(engine.inputLetter('你')).toBe(false);
    expect(engine.inputLetter('é')).toBe(false);
  });
});
