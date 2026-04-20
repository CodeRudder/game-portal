/**
 * Panel 组件渲染测试
 *
 * 覆盖：打开/关闭、折叠/展开、标题渲染、子内容显示/隐藏、
 * ESC 关闭、遮罩点击关闭、无障碍属性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Panel } from '../Panel';

describe('Panel 组件渲染测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 打开/关闭 ──

  it('isOpen=true 时渲染面板', () => {
    render(
      <Panel title="测试面板" isOpen={true}>
        <div>面板内容</div>
      </Panel>,
    );
    expect(screen.getByText('测试面板')).toBeInTheDocument();
    expect(screen.getByText('面板内容')).toBeInTheDocument();
  });

  it('isOpen=false 时不渲染任何内容', () => {
    const { container } = render(
      <Panel title="测试面板" isOpen={false}>
        <div>面板内容</div>
      </Panel>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('默认 isOpen=true', () => {
    render(
      <Panel title="默认面板">
        <div>内容</div>
      </Panel>,
    );
    expect(screen.getByText('默认面板')).toBeInTheDocument();
  });

  it('点击关闭按钮触发 onClose', async () => {
    const onClose = vi.fn();
    render(
      <Panel title="可关闭面板" isOpen={true} onClose={onClose}>
        <div>内容</div>
      </Panel>,
    );
    const closeBtn = screen.getByLabelText('关闭面板');
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层触发 onClose', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Panel title="遮罩关闭" isOpen={true} onClose={onClose}>
        <div>内容</div>
      </Panel>,
    );
    const overlay = container.querySelector('.tk-panel-overlay');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── ESC 关闭 ──

  it('按 ESC 键触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <Panel title="ESC关闭" isOpen={true} onClose={onClose}>
        <div>内容</div>
      </Panel>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('面板关闭时 ESC 不触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <Panel title="ESC关闭" isOpen={false} onClose={onClose}>
        <div>内容</div>
      </Panel>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── 折叠/展开 ──

  it('collapsible=true 时显示折叠按钮', () => {
    render(
      <Panel title="可折叠" isOpen={true} collapsible={true}>
        <div>折叠内容</div>
      </Panel>,
    );
    expect(screen.getByLabelText('折叠面板')).toBeInTheDocument();
  });

  it('collapsible=false（默认）时不显示折叠按钮', () => {
    render(
      <Panel title="不可折叠" isOpen={true}>
        <div>内容</div>
      </Panel>,
    );
    expect(screen.queryByLabelText('折叠面板')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('展开面板')).not.toBeInTheDocument();
  });

  it('点击折叠按钮隐藏内容', async () => {
    render(
      <Panel title="折叠测试" isOpen={true} collapsible={true}>
        <div>折叠内容</div>
      </Panel>,
    );
    const collapseBtn = screen.getByLabelText('折叠面板');
    await userEvent.click(collapseBtn);
    // 内容被隐藏
    expect(screen.queryByText('折叠内容')).not.toBeInTheDocument();
    // 按钮变为展开
    expect(screen.getByLabelText('展开面板')).toBeInTheDocument();
  });

  it('折叠后再展开恢复内容', async () => {
    render(
      <Panel title="展开测试" isOpen={true} collapsible={true}>
        <div>展开内容</div>
      </Panel>,
    );
    // 折叠
    await userEvent.click(screen.getByLabelText('折叠面板'));
    expect(screen.queryByText('展开内容')).not.toBeInTheDocument();
    // 展开
    await userEvent.click(screen.getByLabelText('展开面板'));
    expect(screen.getByText('展开内容')).toBeInTheDocument();
  });

  it('defaultCollapsed=true 时初始折叠', () => {
    render(
      <Panel title="初始折叠" isOpen={true} collapsible={true} defaultCollapsed={true}>
        <div>隐藏内容</div>
      </Panel>,
    );
    expect(screen.queryByText('隐藏内容')).not.toBeInTheDocument();
    expect(screen.getByLabelText('展开面板')).toBeInTheDocument();
  });

  // ── 标题 ──

  it('正确渲染标题文本', () => {
    render(
      <Panel title="我的标题" isOpen={true}>
        <div>内容</div>
      </Panel>,
    );
    expect(screen.getByText('我的标题')).toBeInTheDocument();
  });

  it('标题作为 aria-label', () => {
    render(
      <Panel title="无障碍标题" isOpen={true}>
        <div>内容</div>
      </Panel>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', '无障碍标题');
  });

  // ── 子内容 ──

  it('渲染 children 内容', () => {
    render(
      <Panel title="子内容" isOpen={true}>
        <div data-testid="child">子元素</div>
        <span>更多内容</span>
      </Panel>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('更多内容')).toBeInTheDocument();
  });

  it('无 onClose 时不显示关闭按钮', () => {
    render(
      <Panel title="无关闭" isOpen={true}>
        <div>内容</div>
      </Panel>,
    );
    expect(screen.queryByLabelText('关闭面板')).not.toBeInTheDocument();
  });

  // ── className ──

  it('支持自定义 className', () => {
    const { container } = render(
      <Panel title="样式" isOpen={true} className="custom-class">
        <div>内容</div>
      </Panel>,
    );
    const overlay = container.querySelector('.tk-panel-overlay');
    expect(overlay?.classList.contains('custom-class')).toBe(true);
  });

  // ── 无障碍 ──

  it('面板具有 role="dialog"', () => {
    render(
      <Panel title="对话框" isOpen={true}>
        <div>内容</div>
      </Panel>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
