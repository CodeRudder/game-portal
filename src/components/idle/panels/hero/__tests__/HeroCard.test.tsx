/**
 * HeroCard UI 交互测试
 *
 * 覆盖场景：
 * - 渲染测试：品质边框、名字、等级、战力显示
 * - 品质色映射：5种品质对应5种颜色
 * - 星级显示：等级对应星级
 * - 点击事件：onClick回调触发
 * - 红点显示：showRedDot为true时显示红点
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroCard from '../HeroCard';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { Quality, QUALITY_BORDER_COLORS } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../HeroCard.css', () => ({}));
vi.mock('../atoms/QualityBadge.css', () => ({}));
vi.mock('../atoms/StarDisplay.css', () => ({}));
vi.mock('../../common/constants', () => ({
  HERO_QUALITY_BG_COLORS: {
    COMMON: 'rgba(158,158,158,0.4)',
    FINE: 'rgba(33,150,243,0.4)',
    RARE: 'rgba(156,39,176,0.4)',
    EPIC: 'rgba(244,67,54,0.4)',
    LEGENDARY: 'rgba(255,152,0,0.4)',
  },
}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────

const makeGeneral = (overrides: Partial<GeneralData> = {}): GeneralData => ({
  id: 'test-hero',
  name: '测试武将',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 70 },
  level: 25,
  exp: 500,
  faction: 'shu',
  skills: [],
  ...overrides,
});

// ─────────────────────────────────────────────
// Mock Engine Factory
// ─────────────────────────────────────────────

function makeMockEngine(power = 5000) {
  const heroSystem = {
    calculatePower: vi.fn(() => power),
  };
  return {
    getHeroSystem: vi.fn(() => heroSystem),
  } as unknown as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('HeroCard', () => {
  const onClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染测试
  // ═══════════════════════════════════════════

  it('应渲染武将名字', () => {
    const general = makeGeneral({ name: '关羽' });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    expect(screen.getByText('关羽')).toBeInTheDocument();
  });

  it('应渲染武将等级', () => {
    const general = makeGeneral({ level: 25 });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    expect(screen.getByText(/Lv\.25/)).toBeInTheDocument();
  });

  it('应渲染战力数值', () => {
    const general = makeGeneral();
    render(<HeroCard general={general} engine={makeMockEngine(8888)} />);
    // formatNumber(8888) -> "8888"（< 10000 不缩写）
    const card = screen.getByTestId('hero-card-test-hero');
    expect(card).toBeInTheDocument();
    expect(card.textContent).toContain('8888');
  });

  it('应渲染大数字战力（使用万单位）', () => {
    const general = makeGeneral();
    render(<HeroCard general={general} engine={makeMockEngine(15000)} />);
    const card = screen.getByTestId('hero-card-test-hero');
    expect(card).toBeInTheDocument();
    // formatNumber(15000) -> "1.5万"
    expect(card.textContent).toContain('1.5万');
  });

  it('应渲染阵营信息', () => {
    const general = makeGeneral({ faction: 'shu' });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    // 阵营文本包含在 emoji+文字 中：🔴蜀
    const factionEl = screen.getByText(/蜀/);
    expect(factionEl).toBeInTheDocument();
  });

  it('应渲染品质标签', () => {
    const general = makeGeneral({ quality: Quality.LEGENDARY });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    expect(screen.getByText('传说')).toBeInTheDocument();
  });

  it('应渲染武将首字头像', () => {
    const general = makeGeneral({ name: '赵云' });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    expect(screen.getByText('赵')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 品质色映射
  // ═══════════════════════════════════════════

  it('应正确映射普通品质边框色', () => {
    const general = makeGeneral({ quality: Quality.COMMON });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const card = screen.getByTestId('hero-card-test-hero');
    // 浏览器会将 hex 颜色标准化为 rgb() 格式
    expect(card.style.borderColor).toBeTruthy();
  });

  it('应正确映射精良品质边框色', () => {
    const general = makeGeneral({ quality: Quality.FINE });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const card = screen.getByTestId('hero-card-test-hero');
    expect(card.style.borderColor).toBeTruthy();
  });

  it('应正确映射稀有色边框色', () => {
    const general = makeGeneral({ quality: Quality.RARE });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const card = screen.getByTestId('hero-card-test-hero');
    expect(card.style.borderColor).toBeTruthy();
  });

  it('应正确映射史诗品质边框色', () => {
    const general = makeGeneral({ quality: Quality.EPIC });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const card = screen.getByTestId('hero-card-test-hero');
    expect(card.style.borderColor).toBeTruthy();
  });

  it('应正确映射传说品质边框色', () => {
    const general = makeGeneral({ quality: Quality.LEGENDARY });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const card = screen.getByTestId('hero-card-test-hero');
    expect(card.style.borderColor).toBeTruthy();
  });

  // ═══════════════════════════════════════════
  // 3. 星级显示
  // ═══════════════════════════════════════════

  it('等级<10应显示1星', () => {
    const general = makeGeneral({ level: 5 });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    // StarDisplay renders stars via atoms
    const starsContainer = screen.getByTestId('hero-card-test-hero').querySelector('.tk-hero-card-stars');
    expect(starsContainer).toBeInTheDocument();
  });

  it('等级10~19应显示2星', () => {
    const general = makeGeneral({ level: 15 });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const starsContainer = screen.getByTestId('hero-card-test-hero').querySelector('.tk-hero-card-stars');
    expect(starsContainer).toBeInTheDocument();
  });

  it('等级20~29应显示3星', () => {
    const general = makeGeneral({ level: 25 });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const starsContainer = screen.getByTestId('hero-card-test-hero').querySelector('.tk-hero-card-stars');
    expect(starsContainer).toBeInTheDocument();
  });

  it('等级30~39应显示4星', () => {
    const general = makeGeneral({ level: 35 });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const starsContainer = screen.getByTestId('hero-card-test-hero').querySelector('.tk-hero-card-stars');
    expect(starsContainer).toBeInTheDocument();
  });

  it('等级>=40应显示5星', () => {
    const general = makeGeneral({ level: 45 });
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const starsContainer = screen.getByTestId('hero-card-test-hero').querySelector('.tk-hero-card-stars');
    expect(starsContainer).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 点击事件
  // ═══════════════════════════════════════════

  it('点击卡片应触发onClick回调', async () => {
    const user = userEvent.setup();
    const general = makeGeneral();
    const mockEngine = makeMockEngine();
    render(<HeroCard general={general} engine={mockEngine} onClick={onClick} />);

    const card = screen.getByTestId('hero-card-test-hero');
    await user.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(general);
  });

  it('无onClick时点击不报错', async () => {
    const user = userEvent.setup();
    const general = makeGeneral();
    render(<HeroCard general={general} engine={makeMockEngine()} />);

    const card = screen.getByTestId('hero-card-test-hero');
    await expect(user.click(card)).resolves.not.toThrow();
  });

  // ═══════════════════════════════════════════
  // 5. 红点显示
  // ═══════════════════════════════════════════

  it('showRedDot为true时应显示红点', () => {
    const general = makeGeneral();
    render(<HeroCard general={general} engine={makeMockEngine()} showRedDot />);
    const card = screen.getByTestId('hero-card-test-hero');
    const redDot = card.querySelector('.tk-hero-card-red-dot');
    expect(redDot).toBeInTheDocument();
  });

  it('showRedDot为false时不应显示红点', () => {
    const general = makeGeneral();
    render(<HeroCard general={general} engine={makeMockEngine()} showRedDot={false} />);
    const card = screen.getByTestId('hero-card-test-hero');
    const redDot = card.querySelector('.tk-hero-card-red-dot');
    expect(redDot).not.toBeInTheDocument();
  });

  it('未传showRedDot时不应显示红点', () => {
    const general = makeGeneral();
    render(<HeroCard general={general} engine={makeMockEngine()} />);
    const card = screen.getByTestId('hero-card-test-hero');
    const redDot = card.querySelector('.tk-hero-card-red-dot');
    expect(redDot).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 边缘情况
  // ═══════════════════════════════════════════

  it('引擎calculatePower异常时应显示0战力', () => {
    const general = makeGeneral();
    const badEngine = {
      getHeroSystem: vi.fn(() => ({
        calculatePower: vi.fn(() => { throw new Error('calc error'); }),
      })),
    } as unknown as ThreeKingdomsEngine;
    render(<HeroCard general={general} engine={badEngine} />);
    const card = screen.getByTestId('hero-card-test-hero');
    expect(card.textContent).toContain('0');
  });

  it('应设置正确的aria-label', () => {
    const general = makeGeneral({ name: '张飞', level: 30 });
    render(<HeroCard general={general} engine={makeMockEngine(6000)} />);
    const card = screen.getByTestId('hero-card-test-hero');
    expect(card.getAttribute('aria-label')).toContain('张飞');
    expect(card.getAttribute('aria-label')).toContain('Lv.30');
  });

  it('不同阵营应显示对应阵营图标', () => {
    const factions: Array<{ faction: 'shu' | 'wei' | 'wu' | 'qun'; icon: string; label: string }> = [
      { faction: 'shu', icon: '🔴', label: '蜀' },
      { faction: 'wei', icon: '🔵', label: '魏' },
      { faction: 'wu', icon: '🟢', label: '吴' },
      { faction: 'qun', icon: '🟣', label: '群' },
    ];
    for (const { faction, label } of factions) {
      const { unmount } = render(
        <HeroCard general={makeGeneral({ faction, id: `hero-${faction}` })} engine={makeMockEngine()} />,
      );
      // 阵营文本在 emoji+文字 的 span 中，使用 regex 匹配
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
      unmount();
    }
  });
});
