import { useState, useEffect } from 'react';
import { GameType } from '@/types';
import type { GameRecord } from '@/types';
import { RecordService, HighScoreService } from '@/services/StorageService';

const GAME_LABELS: Record<string, string> = {
  [GameType.TETRIS]: '🧱 俄罗斯方块',
  [GameType.SNAKE]: '🐍 贪吃蛇',
  [GameType.SOKOBAN]: '📦 推箱子',
};

export default function ScoreBoard() {
  const [activeTab, setActiveTab] = useState<GameType>(GameType.TETRIS);
  const [topScores, setTopScores] = useState<{ score: number; date: string }[]>([]);
  const [records, setRecords] = useState<GameRecord[]>([]);

  useEffect(() => {
    // 获取该游戏的最近记录作为排行数据
    const allRecords = RecordService.getByGame(activeTab);
    const sorted = [...allRecords].sort((a, b) => b.score - a.score).slice(0, 10);
    setTopScores(sorted.map(r => ({ score: r.score, date: r.date })));
    setRecords(allRecords.slice(0, 10));
  }, [activeTab]);

  return (
    <section id="scoreboard" className="mx-auto max-w-4xl px-4 py-12">
      <h2 className="mb-8 text-center font-game text-lg text-gp-neon neon-text md:text-xl">
        🏆 排行榜
      </h2>

      {/* Tab 切换 */}
      <div className="mb-6 flex justify-center gap-2">
        {Object.values(GameType).map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              activeTab === type
                ? 'bg-gp-accent text-white shadow-lg shadow-gp-accent/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {GAME_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 最高分排行 */}
        <div className="rounded-2xl border border-white/5 bg-gp-card p-5">
          <h3 className="mb-4 font-game text-xs text-gp-accent">👑 最高分</h3>
          {topScores.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">暂无记录，快去挑战吧！</p>
          ) : (
            <div className="space-y-2">
              {topScores.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-game text-[10px] ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-400'}`}>
                      #{i + 1}
                    </span>
                    <span className="text-sm">{s.score} 分</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(s.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 最近记录 */}
        <div className="rounded-2xl border border-white/5 bg-gp-card p-5">
          <h3 className="mb-4 font-game text-xs text-gp-accent">📋 最近记录</h3>
          {records.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">暂无记录</p>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{r.score} 分</span>
                    <span className="text-xs text-gray-400">Lv.{r.level}</span>
                    {r.isWin && <span className="text-xs text-green-400">✓ 通关</span>}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(r.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
