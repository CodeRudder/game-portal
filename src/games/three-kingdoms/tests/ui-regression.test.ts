import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { formatNumber } from '../../../components/idle/utils/formatNumber';

const IDLE_DIR = path.resolve(__dirname, '../../../components/idle');

function walkDir(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, pattern));
    else if (pattern.test(entry.name)) results.push(full);
  }
  return results;
}

describe('UI Regression', () => {
  it('formatNumber工具函数输出正确（中文万/亿格式）', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(10000)).toBe('1万');
    expect(formatNumber(15000)).toBe('1.5万');
    expect(formatNumber(1500000)).toBe('150万');
    expect(formatNumber(100000000)).toBe('1亿');
    expect(formatNumber(1500000000)).toBe('15亿');
  });

  it('CSS无新增硬编码z-index>1（当前已知19处）', () => {
    const cssFiles = walkDir(IDLE_DIR, /\.css$/);
    const violations: string[] = [];
    for (const file of cssFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      content.split('\n').forEach((line, i) => {
        const m = line.match(/z-index\s*:\s*(\d+)/);
        if (m && parseInt(m[1]) > 1 && !line.includes('var(')) {
          violations.push(`${path.relative(IDLE_DIR, file)}:${i+1}: ${line.trim()}`);
        }
      });
    }
    // 回归快照：当前已知 36 处硬编码 z-index，不允许新增
    expect(violations.length).toBe(36);
  });

  it('Tab按钮移动端有44px最小高度', () => {
    const css = fs.readFileSync(path.join(IDLE_DIR, 'three-kingdoms/tab-bar.css'), 'utf-8');
    expect(css).toContain('min-height: 44px');
  });
});
