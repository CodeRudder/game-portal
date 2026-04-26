/**
 * StarDisplay 原子组件单元测试
 *
 * 覆盖场景：
 * - 渲染0~6星
 * - 实心星(★)和空心星(☆)数量正确
 * - 三种尺寸（small/normal/large）
 * - maxStars参数自定义
 * - 星级超出maxStars时clamp
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import StarDisplay from '../StarDisplay';

// Mock CSS import
vi.mock('../StarDisplay.css', () => ({}));

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('StarDisplay', () => {
  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染0~6星
  // ═══════════════════════════════════════════

  it('应渲染0星（全部空心星）', () => {
    render(<StarDisplay stars={0} />);
    const container = screen.getByTestId('star-display-0');
    expect(container).toBeInTheDocument();
    const stars = container.querySelectorAll('.tk-star-display__star');
    expect(stars).toHaveLength(6); // 默认maxStars=6
    stars.forEach((star) => {
      expect(star.textContent).toBe('☆');
    });
  });

  it('应渲染3星（3实心+3空心）', () => {
    render(<StarDisplay stars={3} />);
    const container = screen.getByTestId('star-display-3');
    expect(container).toBeInTheDocument();
    const stars = container.querySelectorAll('.tk-star-display__star');
    expect(stars).toHaveLength(6);
    // 前3个实心
    for (let i = 0; i < 3; i++) {
      expect(stars[i].textContent).toBe('★');
      expect(stars[i].className).toContain('tk-star-display__star--filled');
    }
    // 后3个空心
    for (let i = 3; i < 6; i++) {
      expect(stars[i].textContent).toBe('☆');
      expect(stars[i].className).toContain('tk-star-display__star--empty');
    }
  });

  it('应渲染6星（全部实心星）', () => {
    render(<StarDisplay stars={6} />);
    const container = screen.getByTestId('star-display-6');
    expect(container).toBeInTheDocument();
    const stars = container.querySelectorAll('.tk-star-display__star');
    expect(stars).toHaveLength(6);
    stars.forEach((star) => {
      expect(star.textContent).toBe('★');
    });
  });

  it('应渲染1星', () => {
    render(<StarDisplay stars={1} />);
    const container = screen.getByTestId('star-display-1');
    const stars = container.querySelectorAll('.tk-star-display__star');
    expect(stars[0].textContent).toBe('★');
    expect(stars[1].textContent).toBe('☆');
  });

  it('应渲染5星', () => {
    render(<StarDisplay stars={5} />);
    const container = screen.getByTestId('star-display-5');
    const stars = container.querySelectorAll('.tk-star-display__star');
    for (let i = 0; i < 5; i++) {
      expect(stars[i].textContent).toBe('★');
    }
    expect(stars[5].textContent).toBe('☆');
  });

  // ═══════════════════════════════════════════
  // 2. 实心星和空心星数量验证
  // ═══════════════════════════════════════════

  it.each([0, 1, 2, 3, 4, 5, 6] as const)(
    'stars=%d 时实心星数量正确',
    (stars) => {
      render(<StarDisplay stars={stars} />);
      const container = screen.getByTestId(`star-display-${stars}`);
      const filled = container.querySelectorAll('.tk-star-display__star--filled');
      const empty = container.querySelectorAll('.tk-star-display__star--empty');
      expect(filled).toHaveLength(stars);
      expect(empty).toHaveLength(6 - stars);
    },
  );

  // ═══════════════════════════════════════════
  // 3. 三种尺寸
  // ═══════════════════════════════════════════

  it('默认尺寸为normal', () => {
    render(<StarDisplay stars={3} />);
    const container = screen.getByTestId('star-display-3');
    expect(container.className).toContain('tk-star-display--normal');
  });

  it('应支持small尺寸', () => {
    render(<StarDisplay stars={3} size="small" />);
    const container = screen.getByTestId('star-display-3');
    expect(container.className).toContain('tk-star-display--small');
  });

  it('应支持large尺寸', () => {
    render(<StarDisplay stars={3} size="large" />);
    const container = screen.getByTestId('star-display-3');
    expect(container.className).toContain('tk-star-display--large');
  });

  // ═══════════════════════════════════════════
  // 4. maxStars参数自定义
  // ═══════════════════════════════════════════

  it('应支持自定义maxStars=3', () => {
    render(<StarDisplay stars={2} maxStars={3} />);
    const container = screen.getByTestId('star-display-2');
    const stars = container.querySelectorAll('.tk-star-display__star');
    expect(stars).toHaveLength(3);
    expect(stars[0].textContent).toBe('★');
    expect(stars[1].textContent).toBe('★');
    expect(stars[2].textContent).toBe('☆');
  });

  it('应支持自定义maxStars=10', () => {
    render(<StarDisplay stars={7} maxStars={10} />);
    const container = screen.getByTestId('star-display-7');
    const stars = container.querySelectorAll('.tk-star-display__star');
    expect(stars).toHaveLength(10);
    const filled = container.querySelectorAll('.tk-star-display__star--filled');
    expect(filled).toHaveLength(7);
  });

  // ═══════════════════════════════════════════
  // 5. 星级超出maxStars时clamp
  // ═══════════════════════════════════════════

  it('星级超出maxStars时应clamp到maxStars', () => {
    render(<StarDisplay stars={10} maxStars={5} />);
    // clampedStars = min(10, 5) = 5
    const container = screen.getByTestId('star-display-5');
    const stars = container.querySelectorAll('.tk-star-display__star');
    expect(stars).toHaveLength(5);
    stars.forEach((star) => {
      expect(star.textContent).toBe('★');
    });
  });

  it('负数星级应clamp到0', () => {
    render(<StarDisplay stars={-3} />);
    // clampedStars = max(0, -3) = 0
    const container = screen.getByTestId('star-display-0');
    const stars = container.querySelectorAll('.tk-star-display__star');
    stars.forEach((star) => {
      expect(star.textContent).toBe('☆');
    });
  });

  // ═══════════════════════════════════════════
  // 6. ARIA和辅助功能
  // ═══════════════════════════════════════════

  it('应设置正确的aria-label', () => {
    render(<StarDisplay stars={4} />);
    const container = screen.getByTestId('star-display-4');
    expect(container.getAttribute('aria-label')).toBe('4星');
  });

  it('应设置role=img', () => {
    render(<StarDisplay stars={3} />);
    const container = screen.getByTestId('star-display-3');
    expect(container.getAttribute('role')).toBe('img');
  });

  // ═══════════════════════════════════════════
  // 7. 自定义className
  // ═══════════════════════════════════════════

  it('应应用自定义className', () => {
    render(<StarDisplay stars={3} className="custom-stars" />);
    const container = screen.getByTestId('star-display-3');
    expect(container.className).toContain('custom-stars');
    expect(container.className).toContain('tk-star-display');
  });
});
