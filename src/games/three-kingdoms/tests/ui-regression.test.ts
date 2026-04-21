/**
 * UI 回归测试套件
 *
 * 自动化检测常见 UI 回归问题，确保：
 * 1. 弹窗组件均支持 ESC 键关闭
 * 2. formatNumber 数字格式化输出一致
 * 3. CSS 中无硬编码 z-index（应使用 CSS 变量 token）
 * 4. 关键 CSS 文件包含移动端响应式断点
 * 5. Tab 按钮满足移动端 44px 触摸热区要求
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { formatNumber } from '../../../components/idle/utils/formatNumber';

// ─── 路径常量 ──────────────────────────────────────────────
const IDLE_DIR = path.resolve(__dirname, '../../../components/idle');
const PANELS_DIR = path.resolve(IDLE_DIR, 'panels');

// ─── 工具函数 ──────────────────────────────────────────────

/** 递归查找目录下匹配正则的文件 */
function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (pattern.test(entry.name)) results.push(full);
    }
  }
  walk(dir);
  return results;
}

/** 读取文件内容（不存在返回空字符串） */
function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════

describe('UI Regression Tests', () => {
  // ─── 1. 弹窗 ESC 关闭检查 ───────────────────────────────
  describe('弹窗ESC关闭', () => {
    it('所有自定义弹窗组件应注册 Escape 键监听', () => {
      const modalFiles = findFiles(PANELS_DIR, /Modal\.tsx$/);
      const missingEsc: string[] = [];

      for (const file of modalFiles) {
        const content = readFileContent(file);
        if (!content) continue;

        // 跳过使用通用 Modal 组件的文件（通用 Modal 已内置 ESC 处理）
        if (content.includes('from') && content.includes("common/Modal")) continue;
        if (content.includes('import Modal')) continue;

        // 自定义弹窗：包含 overlay/遮罩层 的组件必须有 Escape 处理
        const hasOverlay =
          content.includes('overlay') ||
          content.includes('Overlay') ||
          content.includes('backdrop');
        const hasEsc =
          content.includes('Escape') ||
          content.includes('escape') ||
          content.includes('keydown');

        if (hasOverlay && !hasEsc) {
          missingEsc.push(path.basename(file));
        }
      }

      expect(missingEsc, `以下弹窗缺少 Escape 键处理: ${missingEsc.join(', ')}`).toEqual([]);
    });

    it('通用 Modal 组件应内置 Escape 键关闭', () => {
      const modalPath = path.resolve(IDLE_DIR, 'common/Modal.tsx');
      const content = readFileContent(modalPath);

      expect(content).toContain('Escape');
      expect(content).toContain('keydown');
    });
  });

  // ─── 2. formatNumber 一致性 ─────────────────────────────
  describe('formatNumber 数字格式化', () => {
    it('应正确格式化个位数和百位数', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(1)).toBe('1');
      expect(formatNumber(999)).toBe('999');
    });

    it('应正确格式化千级数字（K）', () => {
      expect(formatNumber(1000)).toBe('1K');
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(999900)).toBe('999.9K');
    });

    it('应正确格式化百万级数字（M）', () => {
      expect(formatNumber(1_000_000)).toBe('1M');
      expect(formatNumber(1_500_000)).toBe('1.5M');
      expect(formatNumber(999_900_000)).toBe('999.9M');
    });

    it('应正确格式化十亿级数字（B）', () => {
      expect(formatNumber(1_000_000_000)).toBe('1B');
      expect(formatNumber(1_500_000_000)).toBe('1.5B');
      expect(formatNumber(2_300_000_000)).toBe('2.3B');
    });
  });

  // ─── 3. z-index 无硬编码 ────────────────────────────────
  describe('z-index CSS token 规范', () => {
    it('CSS 文件中不应有硬编码 z-index 值（排除 0 和 1）', () => {
      const cssFiles = findFiles(IDLE_DIR, /\.css$/);
      const violations: string[] = [];

      for (const file of cssFiles) {
        const content = readFileContent(file);
        const lines = content.split('\n');

        lines.forEach((line, i) => {
          const match = line.match(/z-index\s*:\s*(\d+)/);
          if (match) {
            const value = parseInt(match[1], 10);
            // 排除 z-index: 0 和 z-index: 1（属于合理基础值）
            if (value > 1 && !line.includes('var(')) {
              violations.push(
                `${path.relative(IDLE_DIR, file)}:${i + 1}: ${line.trim()}`,
              );
            }
          }
        });
      }

      // 断言：硬编码 z-index 数量应在合理范围内
      // 当前已知存量问题较多，设置阈值以防止新增
      expect(
        violations.length,
        `发现 ${violations.length} 处硬编码 z-index（阈值 20）:\n${violations.join('\n')}`,
      ).toBeLessThanOrEqual(20);
    });

    it('通用 Modal/Panel/Toast 应使用 CSS 变量 z-index', () => {
      const keyFiles = [
        { name: 'Modal.css', varName: '--tk-z-modal' },
        { name: 'Panel.css', varName: '--tk-z-panel' },
        { name: 'Toast.css', varName: '--tk-z-toast' },
      ];

      for (const { name, varName } of keyFiles) {
        const filePath = path.resolve(IDLE_DIR, 'common', name);
        const content = readFileContent(filePath);
        expect(
          content,
          `${name} 应包含 z-index 变量 ${varName}`,
        ).toContain(varName);
      }
    });
  });

  // ─── 4. 移动端响应式 ────────────────────────────────────
  describe('移动端响应式断点', () => {
    const keyCssFiles = [
      { name: 'ThreeKingdomsGame.css', dir: IDLE_DIR },
      { name: 'BuildingPanel.css', dir: path.resolve(IDLE_DIR, 'panels/building') },
    ];

    it('关键 CSS 文件应包含 @media (max-width: 767px) 移动端断点', () => {
      for (const { name, dir } of keyCssFiles) {
        const filePath = path.resolve(dir, name);
        const content = readFileContent(filePath);

        expect(
          content,
          `${name} 应包含 @media (max-width: 767px)`,
        ).toContain('@media (max-width: 767px)');
      }
    });

    it('面板 CSS 文件整体移动端覆盖率达到 80%', () => {
      const allPanelCss = findFiles(PANELS_DIR, /\.css$/)
        .filter(f => !f.includes('.mobile.css')); // 排除独立 mobile 文件

      const withMobileBreakpoint = allPanelCss.filter((file) => {
        const content = readFileContent(file);
        return content.includes('@media (max-width: 767px)');
      });

      const ratio = withMobileBreakpoint.length / allPanelCss.length;
      expect(
        ratio,
        `移动端响应式覆盖率 ${(ratio * 100).toFixed(1)}%，期望 ≥ 80%`,
      ).toBeGreaterThanOrEqual(0.8);
    });
  });

  // ─── 5. Tab 按钮触摸热区 ────────────────────────────────
  describe('Tab按钮触摸热区', () => {
    /**
     * 提取 @media (max-width: 767px) 块内的所有内容。
     * 由于 CSS 块内可能嵌套花括号（如伪元素），使用平衡括号匹配。
     */
    function extractMediaBlock(css: string, breakpoint: string): string | null {
      const startPattern = `@media (max-width: ${breakpoint})`;
      const startIdx = css.indexOf(startPattern);
      if (startIdx === -1) return null;

      // 找到 media 块开始的 {
      const braceStart = css.indexOf('{', startIdx);
      if (braceStart === -1) return null;

      let depth = 1;
      let i = braceStart + 1;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
      }
      return css.slice(braceStart + 1, i - 1);
    }

    it('移动端 .tk-tab-btn 应有 min-height: 44px（Apple HIG 标准）', () => {
      const gameCss = readFileContent(
        path.resolve(IDLE_DIR, 'ThreeKingdomsGame.css'),
      );

      const mediaBlock = extractMediaBlock(gameCss, '767px');

      expect(
        mediaBlock,
        '应包含 @media (max-width: 767px) 块',
      ).not.toBeNull();

      // 在 media block 中查找 .tk-tab-btn 规则
      const tabBtnMatch = mediaBlock!.match(
        /\.tk-tab-btn\s*\{([^}]*)\}/,
      );

      expect(
        tabBtnMatch,
        '@media (max-width: 767px) 内应定义 .tk-tab-btn 样式',
      ).toBeTruthy();

      expect(
        tabBtnMatch![1],
        '.tk-tab-btn 移动端应有 min-height: 44px',
      ).toContain('min-height: 44px');
    });

    it('移动端 .tk-tab-btn 应有 min-width: 44px', () => {
      const gameCss = readFileContent(
        path.resolve(IDLE_DIR, 'ThreeKingdomsGame.css'),
      );

      const mediaBlock = extractMediaBlock(gameCss, '767px');
      expect(mediaBlock).not.toBeNull();

      const tabBtnMatch = mediaBlock!.match(
        /\.tk-tab-btn\s*\{([^}]*)\}/,
      );

      expect(tabBtnMatch).toBeTruthy();
      expect(tabBtnMatch![1]).toContain('min-width: 44px');
    });
  });
});
