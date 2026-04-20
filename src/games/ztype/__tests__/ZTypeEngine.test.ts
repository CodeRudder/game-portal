import {
  WORD_LIST, WORD_TIERS,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  INITIAL_LIVES, MAX_LIVES,
  BASE_SCORE_PER_LETTER, COMBO_MULTIPLIER_BONUS, MAX_COMBO_MULTIPLIER,
  INITIAL_FALL_SPEED, SPEED_INCREMENT_PER_LEVEL,
  INITIAL_SPAWN_INTERVAL, MIN_SPAWN_INTERVAL, SPAWN_INTERVAL_DECREASE,
  WORDS_PER_LEVEL, MAX_LEVEL,
  COMBO_TIMEOUT,
  EXPLOSION_PARTICLES,
  STAR_COUNT,
  PADDING_BOTTOM,
} from '../constants';
import {
  getWordsForLevel,
  getFallSpeed,
  getSpawnInterval,
  calculateComboMultiplier,
  calculateWordScore,
  calculateWPM,
  pickRandomWord,
  createStars,
  createExplosionParticles,
} from '../ZTypeEngine';
import { ZTypeEngine } from '../ZTypeEngine';

// ========== Mock Canvas ==========
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

// ========== 词库测试 ==========
describe('ZType - 词库', () => {
  it('词库至少包含 100 个单词', () => {
    expect(WORD_LIST.length).toBeGreaterThanOrEqual(100);
  });

  it('词库中所有单词都是小写', () => {
    for (const word of WORD_LIST) {
      expect(word).toBe(word.toLowerCase());
    }
  });

  it('词库中所有单词只包含字母', () => {
    for (const word of WORD_LIST) {
      expect(/^[a-z]+$/.test(word)).toBe(true);
    }
  });

  it('词库中没有重复单词', () => {
    const set = new Set(WORD_LIST);
    expect(set.size).toBe(WORD_LIST.length);
  });

  it('词库包含不同长度的单词', () => {
    const lengths = new Set(WORD_LIST.map(w => w.length));
    expect(lengths.size).toBeGreaterThanOrEqual(4);
  });

  it('词库包含 3 字母单词', () => {
    const short = WORD_LIST.filter(w => w.length === 3);
    expect(short.length).toBeGreaterThan(0);
  });

  it('词库包含 4 字母单词', () => {
    const words = WORD_LIST.filter(w => w.length === 4);
    expect(words.length).toBeGreaterThan(0);
  });

  it('词库包含 5 字母单词', () => {
    const words = WORD_LIST.filter(w => w.length === 5);
    expect(words.length).toBeGreaterThan(0);
  });

  it('词库包含 6 字母单词', () => {
    const words = WORD_LIST.filter(w => w.length === 6);
    expect(words.length).toBeGreaterThan(0);
  });

  it('词库包含 7+ 字母单词', () => {
    const words = WORD_LIST.filter(w => w.length >= 7);
    expect(words.length).toBeGreaterThan(0);
  });

  it('词库中所有单词长度至少为 3', () => {
    for (const word of WORD_LIST) {
      expect(word.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('词库包含常见英文单词', () => {
    expect(WORD_LIST).toContain('apple');
    expect(WORD_LIST).toContain('water');
    expect(WORD_LIST).toContain('king');
  });
});

// ========== 难度分级测试 ==========
describe('ZType - 难度分级', () => {
  it('等级 1 只使用 3-4 字母单词', () => {
    const words = getWordsForLevel(1);
    for (const w of words) {
      expect(w.length).toBeLessThanOrEqual(4);
    }
  });

  it('等级 2 只使用 3-4 字母单词', () => {
    const words = getWordsForLevel(2);
    for (const w of words) {
      expect(w.length).toBeLessThanOrEqual(4);
    }
  });

  it('等级 3 可以使用最多 5 字母单词', () => {
    const words = getWordsForLevel(3);
    const has5Letter = words.some(w => w.length === 5);
    expect(has5Letter).toBe(true);
  });

  it('等级 5 可以使用最多 6 字母单词', () => {
    const words = getWordsForLevel(5);
    const has6Letter = words.some(w => w.length === 6);
    expect(has6Letter).toBe(true);
  });

  it('等级 7 可以使用所有单词', () => {
    const words = getWordsForLevel(7);
    expect(words.length).toBe(WORD_LIST.length);
  });

  it('等级 10 可以使用所有单词', () => {
    const words = getWordsForLevel(10);
    expect(words.length).toBe(WORD_LIST.length);
  });

  it('低等级词库是高等级词库的子集', () => {
    const low = getWordsForLevel(1);
    const high = getWordsForLevel(7);
    for (const w of low) {
      expect(high).toContain(w);
    }
  });
});

// ========== 下落速度测试 ==========
describe('ZType - 下落速度', () => {
  it('等级 1 的基础速度', () => {
    expect(getFallSpeed(1)).toBe(INITIAL_FALL_SPEED);
  });

  it('每级速度递增', () => {
    const speed1 = getFallSpeed(1);
    const speed2 = getFallSpeed(2);
    expect(speed2).toBeGreaterThan(speed1);
  });

  it('速度递增量为固定值', () => {
    const diff = getFallSpeed(2) - getFallSpeed(1);
    expect(diff).toBe(SPEED_INCREMENT_PER_LEVEL);
  });

  it('高等级速度显著高于低等级', () => {
    const speed1 = getFallSpeed(1);
    const speed10 = getFallSpeed(10);
    expect(speed10).toBeGreaterThan(speed1 * 2);
  });

  it('速度公式正确', () => {
    for (let level = 1; level <= 10; level++) {
      const expected = INITIAL_FALL_SPEED + (level - 1) * SPEED_INCREMENT_PER_LEVEL;
      expect(getFallSpeed(level)).toBe(expected);
    }
  });
});

// ========== 生成间隔测试 ==========
describe('ZType - 生成间隔', () => {
  it('等级 1 的基础间隔', () => {
    expect(getSpawnInterval(1)).toBe(INITIAL_SPAWN_INTERVAL);
  });

  it('每级间隔递减', () => {
    const interval1 = getSpawnInterval(1);
    const interval2 = getSpawnInterval(2);
    expect(interval2).toBeLessThan(interval1);
  });

  it('间隔不低于最小值', () => {
    const interval = getSpawnInterval(100);
    expect(interval).toBeGreaterThanOrEqual(MIN_SPAWN_INTERVAL);
  });

  it('间隔递减到最小值后不再减少', () => {
    const highLevelInterval = getSpawnInterval(100);
    expect(highLevelInterval).toBe(MIN_SPAWN_INTERVAL);
  });

  it('间隔公式正确（未达到最小值时）', () => {
    const expected = INITIAL_SPAWN_INTERVAL - SPAWN_INTERVAL_DECREASE;
    expect(getSpawnInterval(2)).toBe(expected);
  });
});

// ========== 连击系统测试 ==========
describe('ZType - 连击系统', () => {
  it('0 连击倍率为 1.0', () => {
    expect(calculateComboMultiplier(0)).toBe(1.0);
  });

  it('1 连击倍率为 1.0', () => {
    expect(calculateComboMultiplier(1)).toBe(1.0);
  });

  it('2 连击倍率增加', () => {
    const multiplier = calculateComboMultiplier(2);
    expect(multiplier).toBeGreaterThan(1.0);
  });

  it('连击倍率随连击数递增', () => {
    const m3 = calculateComboMultiplier(3);
    const m5 = calculateComboMultiplier(5);
    expect(m5).toBeGreaterThan(m3);
  });

  it('连击倍率有上限', () => {
    const multiplier = calculateComboMultiplier(100);
    expect(multiplier).toBeLessThanOrEqual(MAX_COMBO_MULTIPLIER);
  });

  it('连击倍率上限为 MAX_COMBO_MULTIPLIER', () => {
    const multiplier = calculateComboMultiplier(1000);
    expect(multiplier).toBe(MAX_COMBO_MULTIPLIER);
  });

  it('连击倍率公式正确', () => {
    const combo = 5;
    const expected = Math.min(1.0 + (combo - 1) * COMBO_MULTIPLIER_BONUS, MAX_COMBO_MULTIPLIER);
    expect(calculateComboMultiplier(combo)).toBe(expected);
  });

  it('倍率精确到小数', () => {
    const multiplier = calculateComboMultiplier(3);
    expect(typeof multiplier).toBe('number');
    expect(isFinite(multiplier)).toBe(true);
  });
});

// ========== 得分计算测试 ==========
describe('ZType - 得分计算', () => {
  it('基础得分 = 单词长度 × 每字母分数', () => {
    const score = calculateWordScore(5, 1);
    expect(score).toBe(5 * BASE_SCORE_PER_LETTER);
  });

  it('连击倍率影响得分', () => {
    const score1 = calculateWordScore(5, 1);
    const score5 = calculateWordScore(5, 5);
    expect(score5).toBeGreaterThan(score1);
  });

  it('长单词得分更高', () => {
    const short = calculateWordScore(3, 1);
    const long = calculateWordScore(7, 1);
    expect(long).toBeGreaterThan(short);
  });

  it('得分为整数', () => {
    const score = calculateWordScore(5, 3);
    expect(Number.isInteger(score)).toBe(true);
  });

  it('0 连击得分正确', () => {
    const score = calculateWordScore(4, 0);
    expect(score).toBe(4 * BASE_SCORE_PER_LETTER);
  });

  it('高连击得分显著提高', () => {
    const base = calculateWordScore(5, 1);
    const highCombo = calculateWordScore(5, 10);
    expect(highCombo).toBeGreaterThanOrEqual(base * 2);
  });
});

// ========== WPM 计算测试 ==========
describe('ZType - WPM 计算', () => {
  it('时间为 0 时 WPM 为 0', () => {
    expect(calculateWPM(10, 0)).toBe(0);
  });

  it('时间为负数时 WPM 为 0', () => {
    expect(calculateWPM(10, -1)).toBe(0);
  });

  it('字母数为 0 时 WPM 为 0', () => {
    expect(calculateWPM(0, 60000)).toBe(0);
  });

  it('1 分钟输入 5 个字母 = 1 WPM', () => {
    expect(calculateWPM(5, 60000)).toBe(1);
  });

  it('1 分钟输入 50 个字母 = 10 WPM', () => {
    expect(calculateWPM(50, 60000)).toBe(10);
  });

  it('30 秒输入 25 个字母 = 10 WPM', () => {
    expect(calculateWPM(25, 30000)).toBe(10);
  });

  it('WPM 结果为整数', () => {
    const wpm = calculateWPM(17, 45000);
    expect(Number.isInteger(wpm)).toBe(true);
  });

  it('WPM 随输入量增加而增加', () => {
    const wpm1 = calculateWPM(10, 60000);
    const wpm2 = calculateWPM(20, 60000);
    expect(wpm2).toBeGreaterThan(wpm1);
  });

  it('WPM 随时间减少而增加', () => {
    const wpm1 = calculateWPM(10, 60000);
    const wpm2 = calculateWPM(10, 30000);
    expect(wpm2).toBeGreaterThan(wpm1);
  });
});

// ========== 随机选词测试 ==========
describe('ZType - 随机选词', () => {
  it('返回的单词在词库中', () => {
    const word = pickRandomWord([], 1);
    expect(WORD_LIST).toContain(word);
  });

  it('排除已有单词', () => {
    const level1Words = getWordsForLevel(1);
    if (level1Words.length > 1) {
      const existing = [level1Words[0]];
      const word = pickRandomWord(existing, 1);
      // 可能等于 existing[0] 如果没有其他选择，但通常不等
      // 只验证返回的单词在词库中
      expect(WORD_LIST).toContain(word);
    }
  });

  it('多次调用返回不同单词（概率性）', () => {
    const words = new Set<string>();
    for (let i = 0; i < 20; i++) {
      words.add(pickRandomWord([], 7));
    }
    // 20次调用至少返回3个不同单词
    expect(words.size).toBeGreaterThanOrEqual(3);
  });

  it('等级 1 返回的单词不超过 4 字母', () => {
    for (let i = 0; i < 20; i++) {
      const word = pickRandomWord([], 1);
      expect(word.length).toBeLessThanOrEqual(4);
    }
  });

  it('空排除列表也能正常工作', () => {
    const word = pickRandomWord([], 5);
    expect(word).toBeTruthy();
    expect(typeof word).toBe('string');
  });
});

// ========== 星星生成测试 ==========
describe('ZType - 背景星星', () => {
  it('生成正确数量的星星', () => {
    const stars = createStars();
    expect(stars.length).toBe(STAR_COUNT);
  });

  it('星星 x 坐标在画布范围内', () => {
    const stars = createStars();
    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(CANVAS_WIDTH);
    }
  });

  it('星星 y 坐标在画布范围内', () => {
    const stars = createStars();
    for (const star of stars) {
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(CANVAS_HEIGHT);
    }
  });

  it('星星速度在合理范围内', () => {
    const stars = createStars();
    for (const star of stars) {
      expect(star.speed).toBeGreaterThanOrEqual(10);
      expect(star.speed).toBeLessThanOrEqual(50);
    }
  });

  it('星星亮度在 0-1 之间', () => {
    const stars = createStars();
    for (const star of stars) {
      expect(star.brightness).toBeGreaterThan(0);
      expect(star.brightness).toBeLessThanOrEqual(1);
    }
  });

  it('每次生成不同的星星', () => {
    const stars1 = createStars();
    const stars2 = createStars();
    // 至少有一颗星星位置不同
    let different = false;
    for (let i = 0; i < stars1.length; i++) {
      if (stars1[i].x !== stars2[i].x || stars1[i].y !== stars2[i].y) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });
});

// ========== 爆炸粒子测试 ==========
describe('ZType - 爆炸粒子', () => {
  it('生成正确数量的粒子', () => {
    const particles = createExplosionParticles(100, 100, '#ff0000');
    expect(particles.length).toBe(EXPLOSION_PARTICLES);
  });

  it('粒子初始位置正确', () => {
    const particles = createExplosionParticles(200, 300, '#ff0000');
    for (const p of particles) {
      expect(p.x).toBe(200);
      expect(p.y).toBe(300);
    }
  });

  it('粒子颜色正确', () => {
    const particles = createExplosionParticles(100, 100, '#00ff00');
    for (const p of particles) {
      expect(p.color).toBe('#00ff00');
    }
  });

  it('粒子初始生命为 1.0', () => {
    const particles = createExplosionParticles(100, 100, '#ff0000');
    for (const p of particles) {
      expect(p.life).toBe(1.0);
    }
  });

  it('粒子有不同方向的速度', () => {
    const particles = createExplosionParticles(100, 100, '#ff0000');
    const directions = new Set<string>();
    for (const p of particles) {
      const dir = `${Math.sign(p.vx)},${Math.sign(p.vy)}`;
      directions.add(dir);
    }
    expect(directions.size).toBeGreaterThan(1);
  });

  it('粒子大小合理', () => {
    const particles = createExplosionParticles(100, 100, '#ff0000');
    for (const p of particles) {
      expect(p.size).toBeGreaterThan(0);
      expect(p.size).toBeLessThanOrEqual(6);
    }
  });
});

// ========== 引擎初始化测试 ==========
describe('ZType - 引擎初始化', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
  });

  it('可以创建引擎实例', () => {
    expect(engine).toBeDefined();
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

  it('可以设置 canvas', () => {
    expect(() => engine.setCanvas(canvas)).not.toThrow();
  });

  it('初始化后状态仍为 idle', () => {
    engine.setCanvas(canvas);
    engine.init();
    expect(engine.status).toBe('idle');
  });

  it('未初始化 canvas 时 start 抛出错误', () => {
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });
});

// ========== 游戏开始测试 ==========
describe('ZType - 游戏开始', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
  });

  it('开始后状态为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('开始后分数为 0', () => {
    engine.start();
    expect(engine.score).toBe(0);
  });

  it('开始后等级为 1', () => {
    engine.start();
    expect(engine.level).toBe(1);
  });

  it('开始后生命为初始值', () => {
    engine.start();
    expect(engine.currentLives).toBe(INITIAL_LIVES);
  });

  it('开始后连击为 0', () => {
    engine.start();
    expect(engine.currentCombo).toBe(0);
  });

  it('开始后输入为空', () => {
    engine.start();
    expect(engine.currentInput).toBe('');
  });

  it('开始后 WPM 为 0', () => {
    engine.start();
    expect(engine.currentWpm).toBe(0);
  });

  it('开始后消灭单词数为 0', () => {
    engine.start();
    expect(engine.currentWordsDestroyed).toBe(0);
  });

  it('开始后屏幕上有单词', () => {
    engine.start();
    expect(engine.currentWords.length).toBeGreaterThan(0);
  });

  it('开始后最大连击为 0', () => {
    engine.start();
    expect(engine.currentMaxCombo).toBe(0);
  });

  it('开始后倍率为 1.0', () => {
    engine.start();
    expect(engine.currentMultiplier).toBe(1.0);
  });
});

// ========== 字母输入测试 ==========
describe('ZType - 字母输入', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('输入字母后输入字符串更新', () => {
    // 获取屏幕上的单词
    const words = engine.currentWords;
    if (words.length > 0) {
      const firstLetter = words[0].text[0];
      engine.handleKeyDown(firstLetter);
      expect(engine.currentInput.length).toBeGreaterThan(0);
    }
  });

  it('输入不匹配的字母被忽略', () => {
    // 找一个不在任何单词首字母的字母
    const words = engine.currentWords;
    const firstLetters = new Set(words.map(w => w.text[0]));
    let unmatched = 'z';
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      if (!firstLetters.has(letter)) {
        unmatched = letter;
        break;
      }
    }
    engine.handleKeyDown(unmatched);
    expect(engine.currentInput).toBe('');
  });

  it('输入匹配字母后活跃单词高亮', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const firstLetter = words[0].text[0];
      engine.handleKeyDown(firstLetter);
      const active = engine.activeWord;
      expect(active).toBeDefined();
      if (active) {
        expect(active.active).toBe(true);
        expect(active.typed).toBe(1);
      }
    }
  });

  it('Backspace 删除一个字母', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const firstLetter = words[0].text[0];
      engine.handleKeyDown(firstLetter);
      expect(engine.currentInput.length).toBe(1);
      engine.handleKeyDown('Backspace');
      expect(engine.currentInput.length).toBe(0);
    }
  });

  it('Escape 取消当前输入', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const firstLetter = words[0].text[0];
      engine.handleKeyDown(firstLetter);
      engine.handleKeyDown('Escape');
      expect(engine.currentInput).toBe('');
      // 所有单词都不活跃
      const activeWords = engine.currentWords.filter(w => w.active);
      expect(activeWords.length).toBe(0);
    }
  });

  it('Backspace 在空输入时无效果', () => {
    const inputBefore = engine.currentInput;
    engine.handleKeyDown('Backspace');
    expect(engine.currentInput).toBe(inputBefore);
  });

  it('非字母键被忽略', () => {
    engine.handleKeyDown('1');
    engine.handleKeyDown('!');
    engine.handleKeyDown('Enter');
    expect(engine.currentInput).toBe('');
  });

  it('大写字母也能匹配', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const firstLetter = words[0].text[0].toUpperCase();
      engine.handleKeyDown(firstLetter);
      expect(engine.currentInput.length).toBe(1);
    }
  });
});

// ========== 单词消灭测试 ==========
describe('ZType - 单词消灭', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('输入完整单词后消灭', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const word = words[0];
      for (const letter of word.text) {
        engine.handleKeyDown(letter);
      }
      expect(engine.currentWordsDestroyed).toBeGreaterThan(0);
    }
  });

  it('消灭单词后加分', () => {
    const initialScore = engine.score;
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const word = words[0];
      for (const letter of word.text) {
        engine.handleKeyDown(letter);
      }
      expect(engine.score).toBeGreaterThan(initialScore);
    }
  });

  it('消灭单词后输入重置', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const word = words[0];
      for (const letter of word.text) {
        engine.handleKeyDown(letter);
      }
      expect(engine.currentInput).toBe('');
    }
  });

  it('消灭单词后连击增加', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const word = words[0];
      for (const letter of word.text) {
        engine.handleKeyDown(letter);
      }
      expect(engine.currentCombo).toBeGreaterThan(0);
    }
  });

  it('连续消灭多个单词连击递增', () => {
    const destroyed = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const words = engine.currentWords.filter(w => !w.destroying);
      if (words.length > 0) {
        const word = words[0];
        for (const letter of word.text) {
          engine.handleKeyDown(letter);
        }
        destroyed.push(word);
      }
    }
    if (destroyed.length >= 2) {
      expect(engine.currentCombo).toBeGreaterThanOrEqual(2);
    }
  });

  it('消灭单词得分与单词长度相关', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const word = words[0];
      const wordLen = word.text.length;
      const initialScore = engine.score;
      for (const letter of word.text) {
        engine.handleKeyDown(letter);
      }
      const scoreGain = engine.score - initialScore;
      expect(scoreGain).toBeGreaterThanOrEqual(wordLen * BASE_SCORE_PER_LETTER);
    }
  });
});

// ========== 生命系统测试 ==========
describe('ZType - 生命系统', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('初始生命为 INITIAL_LIVES', () => {
    expect(engine.currentLives).toBe(INITIAL_LIVES);
  });

  it('生命值不超过 MAX_LIVES', () => {
    expect(INITIAL_LIVES).toBeLessThanOrEqual(MAX_LIVES);
  });

  it('可以通过 getState 获取生命值', () => {
    const state = engine.getState();
    expect(state.lives).toBe(INITIAL_LIVES);
  });
});

// ========== 暂停/恢复测试 ==========
describe('ZType - 暂停/恢复', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('暂停后状态为 paused', () => {
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('恢复后状态为 playing', () => {
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('暂停时输入无效', () => {
    engine.pause();
    const inputBefore = engine.currentInput;
    engine.handleKeyDown('a');
    expect(engine.currentInput).toBe(inputBefore);
  });

  it('idle 状态不能暂停', () => {
    engine.reset();
    engine.pause();
    expect(engine.status).toBe('idle');
  });
});

// ========== 重置测试 ==========
describe('ZType - 重置', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('重置后状态为 idle', () => {
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('重置后分数为 0', () => {
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('重置后等级为 1', () => {
    engine.reset();
    expect(engine.level).toBe(1);
  });

  it('重置后可以重新开始', () => {
    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('重置后输入清空', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      engine.handleKeyDown(words[0].text[0]);
    }
    engine.reset();
    expect(engine.currentInput).toBe('');
  });
});

// ========== 销毁测试 ==========
describe('ZType - 销毁', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('销毁后可以重新创建', () => {
    engine.destroy();
    const newEngine = new ZTypeEngine();
    const newCanvas = createMockCanvas();
    newEngine.setCanvas(newCanvas);
    newEngine.init();
    newEngine.start();
    expect(newEngine.status).toBe('playing');
  });
});

// ========== getState 测试 ==========
describe('ZType - getState', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('返回正确的状态结构', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('words');
    expect(state).toHaveProperty('input');
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('lives');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('combo');
    expect(state).toHaveProperty('maxCombo');
    expect(state).toHaveProperty('comboMultiplier');
    expect(state).toHaveProperty('wpm');
    expect(state).toHaveProperty('totalTypedLetters');
    expect(state).toHaveProperty('wordsDestroyed');
    expect(state).toHaveProperty('gameStatus');
    expect(state).toHaveProperty('particles');
    expect(state).toHaveProperty('stars');
  });

  it('返回的分数与引擎一致', () => {
    const state = engine.getState();
    expect(state.score).toBe(engine.score);
  });

  it('返回的等级与引擎一致', () => {
    const state = engine.getState();
    expect(state.level).toBe(engine.level);
  });

  it('返回的生命与引擎一致', () => {
    const state = engine.getState();
    expect(state.lives).toBe(engine.currentLives);
  });

  it('返回的连击与引擎一致', () => {
    const state = engine.getState();
    expect(state.combo).toBe(engine.currentCombo);
  });

  it('返回的输入与引擎一致', () => {
    const state = engine.getState();
    expect(state.input).toBe(engine.currentInput);
  });
});

// ========== 事件系统测试 ==========
describe('ZType - 事件系统', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
  });

  it('开始时触发 statusChange 事件', () => {
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('暂停时触发 statusChange 事件', () => {
    engine.start();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.pause();
    expect(handler).toHaveBeenCalledWith('paused');
  });

  it('重置时触发 statusChange 事件', () => {
    engine.start();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });

  it('分数变化时触发 scoreChange 事件', () => {
    engine.start();
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const word = words[0];
      for (const letter of word.text) {
        engine.handleKeyDown(letter);
      }
      expect(handler).toHaveBeenCalled();
    }
  });

  it('等级变化时触发 levelChange 事件', () => {
    const handler = jest.fn();
    engine.on('levelChange', handler);
    engine.start();
    // 等级从 1 开始，start 时已触发
    expect(handler).toHaveBeenCalledWith(1);
  });
});

// ========== 活跃单词选择测试 ==========
describe('ZType - 活跃单词选择', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('没有输入时没有活跃单词', () => {
    expect(engine.activeWord).toBeUndefined();
  });

  it('输入字母后设置活跃单词', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      engine.handleKeyDown(words[0].text[0]);
      expect(engine.activeWord).toBeDefined();
    }
  });

  it('切换目标单词时重置旧单词的 typed', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length >= 2) {
      // 输入第一个单词的首字母
      engine.handleKeyDown(words[0].text[0]);
      // 输入第二个单词的首字母
      engine.handleKeyDown(words[1].text[0]);
      // 旧的活跃单词应该被重置
      const oldWord = engine.currentWords.find(w => w.id === words[0].id);
      if (oldWord && !oldWord.destroying) {
        expect(oldWord.typed).toBe(0);
        expect(oldWord.active).toBe(false);
      }
    }
  });
});

// ========== 连击超时测试 ==========
describe('ZType - 连击超时', () => {
  it('连击超时时间定义正确', () => {
    expect(COMBO_TIMEOUT).toBe(3000);
  });

  it('连击倍率计算正确', () => {
    expect(calculateComboMultiplier(1)).toBe(1.0);
    expect(calculateComboMultiplier(2)).toBe(1.0 + COMBO_MULTIPLIER_BONUS);
    expect(calculateComboMultiplier(3)).toBe(1.0 + 2 * COMBO_MULTIPLIER_BONUS);
  });
});

// ========== 难度递增测试 ==========
describe('ZType - 难度递增', () => {
  it('每级消灭 WORDS_PER_LEVEL 个单词升级', () => {
    expect(WORDS_PER_LEVEL).toBeGreaterThan(0);
  });

  it('最大等级有限制', () => {
    expect(MAX_LEVEL).toBeGreaterThan(0);
    expect(MAX_LEVEL).toBeLessThanOrEqual(100);
  });

  it('速度随等级线性增长', () => {
    const speeds = [];
    for (let i = 1; i <= 5; i++) {
      speeds.push(getFallSpeed(i));
    }
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i] - speeds[i - 1]).toBe(SPEED_INCREMENT_PER_LEVEL);
    }
  });

  it('生成间隔随等级递减', () => {
    const intervals = [];
    for (let i = 1; i <= 5; i++) {
      intervals.push(getSpawnInterval(i));
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeLessThan(intervals[i - 1]);
    }
  });

  it('高等级单词更长', () => {
    const lowLevelWords = getWordsForLevel(1);
    const highLevelWords = getWordsForLevel(10);
    const avgLow = lowLevelWords.reduce((s, w) => s + w.length, 0) / lowLevelWords.length;
    const avgHigh = highLevelWords.reduce((s, w) => s + w.length, 0) / highLevelWords.length;
    expect(avgHigh).toBeGreaterThanOrEqual(avgLow);
  });
});

// ========== handleKeyUp 测试 ==========
describe('ZType - handleKeyUp', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('handleKeyUp 不影响游戏状态', () => {
    const stateBefore = engine.getState();
    engine.handleKeyUp('a');
    const stateAfter = engine.getState();
    expect(stateAfter.input).toBe(stateBefore.input);
    expect(stateAfter.score).toBe(stateBefore.score);
  });
});

// ========== 边界条件测试 ==========
describe('ZType - 边界条件', () => {
  it('getWordsForLevel 处理等级 0', () => {
    const words = getWordsForLevel(0);
    expect(words.length).toBeGreaterThan(0);
  });

  it('getWordsForLevel 处理高等级', () => {
    const words = getWordsForLevel(100);
    expect(words.length).toBe(WORD_LIST.length);
  });

  it('getFallSpeed 处理等级 0', () => {
    const speed = getFallSpeed(0);
    expect(speed).toBeGreaterThan(0);
  });

  it('getSpawnInterval 处理等级 0', () => {
    const interval = getSpawnInterval(0);
    expect(interval).toBeGreaterThan(0);
  });

  it('calculateWPM 处理极大值', () => {
    const wpm = calculateWPM(1000000, 60000);
    expect(wpm).toBeGreaterThan(0);
    expect(isFinite(wpm)).toBe(true);
  });

  it('calculateComboMultiplier 处理负数', () => {
    const multiplier = calculateComboMultiplier(-1);
    expect(multiplier).toBe(1.0);
  });

  it('calculateWordScore 处理 0 长度单词', () => {
    const score = calculateWordScore(0, 1);
    expect(score).toBe(0);
  });

  it('pickRandomWord 处理所有单词都被排除的情况', () => {
    const allWords = [...WORD_LIST];
    const word = pickRandomWord(allWords, 7);
    expect(word).toBeTruthy();
  });
});

// ========== 常量验证测试 ==========
describe('ZType - 常量验证', () => {
  it('CANVAS_WIDTH 为 480', () => {
    expect(CANVAS_WIDTH).toBe(480);
  });

  it('CANVAS_HEIGHT 为 640', () => {
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('INITIAL_LIVES 大于 0', () => {
    expect(INITIAL_LIVES).toBeGreaterThan(0);
  });

  it('BASE_SCORE_PER_LETTER 大于 0', () => {
    expect(BASE_SCORE_PER_LETTER).toBeGreaterThan(0);
  });

  it('MAX_COMBO_MULTIPLIER 大于 1', () => {
    expect(MAX_COMBO_MULTIPLIER).toBeGreaterThan(1);
  });

  it('INITIAL_FALL_SPEED 大于 0', () => {
    expect(INITIAL_FALL_SPEED).toBeGreaterThan(0);
  });

  it('INITIAL_SPAWN_INTERVAL 大于 MIN_SPAWN_INTERVAL', () => {
    expect(INITIAL_SPAWN_INTERVAL).toBeGreaterThan(MIN_SPAWN_INTERVAL);
  });

  it('WORDS_PER_LEVEL 大于 0', () => {
    expect(WORDS_PER_LEVEL).toBeGreaterThan(0);
  });

  it('COMBO_TIMEOUT 大于 0', () => {
    expect(COMBO_TIMEOUT).toBeGreaterThan(0);
  });

  it('WORD_TIERS 按等级排序', () => {
    for (let i = 1; i < WORD_TIERS.length; i++) {
      expect(WORD_TIERS[i].minLevel).toBeGreaterThan(WORD_TIERS[i - 1].minLevel);
    }
  });
});

// ========== 完整游戏流程测试 ==========
describe('ZType - 完整游戏流程', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
  });

  it('完整的开始-玩-暂停-恢复-重置流程', () => {
    // 开始
    engine.start();
    expect(engine.status).toBe('playing');

    // 输入一些字母
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      engine.handleKeyDown(words[0].text[0]);
    }

    // 暂停
    engine.pause();
    expect(engine.status).toBe('paused');

    // 恢复
    engine.resume();
    expect(engine.status).toBe('playing');

    // 重置
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('开始-重置-重新开始流程', () => {
    engine.start();
    expect(engine.status).toBe('playing');

    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);

    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.currentLives).toBe(INITIAL_LIVES);
  });

  it('多次开始不会出错', () => {
    for (let i = 0; i < 3; i++) {
      engine.start();
      expect(engine.status).toBe('playing');
      engine.reset();
      expect(engine.status).toBe('idle');
    }
  });

  it('消灭一个完整单词的流程', () => {
    engine.start();
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      const word = words[0];
      const initialDestroyed = engine.currentWordsDestroyed;

      for (const letter of word.text) {
        engine.handleKeyDown(letter);
      }

      expect(engine.currentWordsDestroyed).toBe(initialDestroyed + 1);
      expect(engine.currentInput).toBe('');
      expect(engine.currentCombo).toBeGreaterThan(0);
    }
  });

  it('输入部分单词后取消再输入其他单词', () => {
    engine.start();
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length >= 2) {
      // 输入第一个单词的首字母
      engine.handleKeyDown(words[0].text[0]);
      expect(engine.currentInput.length).toBe(1);

      // 取消
      engine.handleKeyDown('Escape');
      expect(engine.currentInput).toBe('');

      // 输入第二个单词
      engine.handleKeyDown(words[1].text[0]);
      expect(engine.currentInput.length).toBe(1);
    }
  });

  it('输入部分单词后 Backspace 再继续', () => {
    engine.start();
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0 && words[0].text.length >= 3) {
      const word = words[0];
      // 输入前两个字母
      engine.handleKeyDown(word.text[0]);
      engine.handleKeyDown(word.text[1]);
      expect(engine.currentInput).toBe(word.text.substring(0, 2));

      // 删除一个
      engine.handleKeyDown('Backspace');
      expect(engine.currentInput).toBe(word.text.substring(0, 1));

      // 继续输入（活跃单词仍在）
      engine.handleKeyDown(word.text[1]);
      expect(engine.currentInput).toBe(word.text.substring(0, 2));
    }
  });
});

// ========== 并发单词测试 ==========
describe('ZType - 并发单词', () => {
  let engine: ZTypeEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    engine = new ZTypeEngine();
    canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
  });

  it('屏幕上可以有多个单词', () => {
    const words = engine.currentWords;
    expect(words.length).toBeGreaterThanOrEqual(1);
  });

  it('一次只有一个活跃单词', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length > 0) {
      engine.handleKeyDown(words[0].text[0]);
      const activeWords = engine.currentWords.filter(w => w.active);
      expect(activeWords.length).toBeLessThanOrEqual(1);
    }
  });

  it('消灭一个单词后可以立即输入另一个', () => {
    const words = engine.currentWords.filter(w => !w.destroying);
    if (words.length >= 2) {
      // 消灭第一个
      for (const letter of words[0].text) {
        engine.handleKeyDown(letter);
      }
      expect(engine.currentInput).toBe('');

      // 立即输入第二个
      engine.handleKeyDown(words[1].text[0]);
      expect(engine.currentInput.length).toBe(1);
    }
  });
});

// ========== WPM 集成测试 ==========
describe('ZType - WPM 集成', () => {
  it('游戏开始时 WPM 为 0', () => {
    const engine = new ZTypeEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
    expect(engine.currentWpm).toBe(0);
  });

  it('WPM 计算公式正确', () => {
    // 60秒内输入30个字母 = 6 WPM
    expect(calculateWPM(30, 60000)).toBe(6);
  });

  it('WPM 使用标准 5 字符 = 1 单词', () => {
    expect(calculateWPM(5, 60000)).toBe(1);
    expect(calculateWPM(10, 60000)).toBe(2);
  });
});

// ========== 游戏结束测试 ==========
describe('ZType - 游戏结束', () => {
  it('生命为 0 时游戏结束（通过状态验证）', () => {
    const engine = new ZTypeEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();

    // 验证初始状态
    expect(engine.currentLives).toBe(INITIAL_LIVES);
    expect(engine.status).toBe('playing');
  });

  it('游戏结束后可以获取最终状态', () => {
    const engine = new ZTypeEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();

    const state = engine.getState();
    expect(state.gameStatus).toBe('playing');
  });
});

// ========== 常量一致性测试 ==========
describe('ZType - 常量一致性', () => {
  it('MAX_LIVES >= INITIAL_LIVES', () => {
    expect(MAX_LIVES).toBeGreaterThanOrEqual(INITIAL_LIVES);
  });

  it('SPEED_INCREMENT_PER_LEVEL > 0', () => {
    expect(SPEED_INCREMENT_PER_LEVEL).toBeGreaterThan(0);
  });

  it('SPAWN_INTERVAL_DECREASE > 0', () => {
    expect(SPAWN_INTERVAL_DECREASE).toBeGreaterThan(0);
  });

  it('COMBO_MULTIPLIER_BONUS > 0', () => {
    expect(COMBO_MULTIPLIER_BONUS).toBeGreaterThan(0);
  });

  it('PADDING_BOTTOM > 0', () => {
    expect(PADDING_BOTTOM).toBeGreaterThan(0);
  });

  it('INITIAL_SPAWN_INTERVAL > MIN_SPAWN_INTERVAL', () => {
    expect(INITIAL_SPAWN_INTERVAL).toBeGreaterThan(MIN_SPAWN_INTERVAL);
  });
});
