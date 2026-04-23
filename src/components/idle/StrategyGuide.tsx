/**
 * StrategyGuide — 攻略组件
 *
 * 分阶段显示攻略，未解锁内容显示为 "???"，支持折叠/展开。
 */
import { useState } from 'react';
import type { StrategyPhase } from '@/types/idle';

interface StrategyGuideProps {
  phases: StrategyPhase[];
}

export default function StrategyGuide({ phases }: StrategyGuideProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(phases.filter((p) => p.unlocked).map((p) => p.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div className="flex flex-col gap-3" data-testid="strategy-guide">
      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={expandAll}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10"
        >
          展开全部
        </button>
        <button
          onClick={collapseAll}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10"
        >
          折叠全部
        </button>
      </div>

      {/* 攻略阶段 */}
      {phases.map((phase, idx) => {
        const expanded = expandedIds.has(phase.id);
        const locked = !phase.unlocked;

        return (
          <div
            key={phase.id}
            className={`rounded-xl border p-3 transition ${
              locked
                ? 'border-white/5 bg-white/[0.02] opacity-60'
                : 'border-white/10 bg-gp-card'
            }`}
          >
            {/* 标题栏 */}
            <button
              onClick={() => !locked && toggle(phase.id)}
              className="flex w-full items-center gap-2 text-left"
              disabled={locked}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gp-accent/20 text-xs text-gp-accent">
                {locked ? '🔒' : idx + 1}
              </span>
              <span className={`flex-1 text-sm font-medium ${locked ? 'text-gray-600' : 'text-gray-200'}`}>
                {locked ? '???' : phase.title}
              </span>
              {!locked && (
                <span className={`text-gray-500 transition ${expanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              )}
            </button>

            {/* 展开内容 */}
            {expanded && !locked && (
              <div className="mt-3 ml-8 flex flex-col gap-2">
                <p className="text-xs text-gray-400">{phase.description}</p>
                {phase.tips.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {phase.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-gray-500">
                        💡 {tip}
                      </li>
                    ))}
                  </ul>
                )}
                {phase.unlockCondition && (
                  <p className="text-xs text-gp-accent/70">
                    🔓 解锁条件: {phase.unlockCondition}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
