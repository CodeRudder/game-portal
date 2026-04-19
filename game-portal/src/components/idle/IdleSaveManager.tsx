/**
 * IdleSaveManager — 存档管理组件
 *
 * 3个自动存档槽、导出/导入存档、存档预览。
 */
import { useState, useCallback } from 'react';
import type { SaveData, SaveSlot } from '@/types/idle';

interface IdleSaveManagerProps {
  gameId: string;
  currentSave: (() => SaveData) | null;
  formatNumber: (n: number) => string;
  onLoad: (data: SaveData) => void;
  onImport: (encoded: string) => boolean;
  onReset: () => void;
}

function getSaveSlots(gameId: string): SaveSlot[] {
  const slots: SaveSlot[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      const key = `idle-save-${gameId}-slot-${i}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw) as SaveData;
        slots.push({
          slot: i,
          data,
          savedAt: data.timestamp,
          preview: generatePreview(data),
        });
      } else {
        slots.push({ slot: i, data: null, savedAt: null, preview: null });
      }
    } catch {
      slots.push({ slot: i, data: null, savedAt: null, preview: null });
    }
  }
  return slots;
}

function generatePreview(data: SaveData): string {
  const resources = Object.entries(data.resources)
    .filter(([, v]) => v.amount > 0)
    .map(([k, v]) => `${k}: ${Math.floor(v.amount)}`)
    .join(', ');
  return resources || '空存档';
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function IdleSaveManager({
  gameId,
  currentSave,
  formatNumber,
  onLoad,
  onImport,
  onReset,
}: IdleSaveManagerProps) {
  const [slots, setSlots] = useState<SaveSlot[]>(() => getSaveSlots(gameId));
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const refreshSlots = useCallback(() => {
    setSlots(getSaveSlots(gameId));
  }, [gameId]);

  const saveToSlot = useCallback(
    (slotIndex: number) => {
      if (!currentSave) return;
      const data = currentSave();
      try {
        const key = `idle-save-${gameId}-slot-${slotIndex}`;
        localStorage.setItem(key, JSON.stringify(data));
        setMessage({ text: `存档已保存到槽位 ${slotIndex + 1}`, type: 'success' });
        refreshSlots();
      } catch {
        setMessage({ text: '保存失败', type: 'error' });
      }
    },
    [currentSave, gameId, refreshSlots]
  );

  const loadFromSlot = useCallback(
    (slotIndex: number) => {
      try {
        const key = `idle-save-${gameId}-slot-${slotIndex}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw) as SaveData;
          onLoad(data);
          setMessage({ text: `已加载槽位 ${slotIndex + 1}`, type: 'success' });
        }
      } catch {
        setMessage({ text: '加载失败', type: 'error' });
      }
    },
    [gameId, onLoad]
  );

  const deleteSlot = useCallback(
    (slotIndex: number) => {
      try {
        const key = `idle-save-${gameId}-slot-${slotIndex}`;
        localStorage.removeItem(key);
        setMessage({ text: `槽位 ${slotIndex + 1} 已删除`, type: 'success' });
        refreshSlots();
      } catch {
        setMessage({ text: '删除失败', type: 'error' });
      }
    },
    [gameId, refreshSlots]
  );

  const handleExport = useCallback(() => {
    if (!currentSave) return;
    const data = currentSave();
    const json = JSON.stringify(data);
    const encoded = btoa(encodeURIComponent(json));
    navigator.clipboard?.writeText(encoded).then(
      () => setMessage({ text: '存档已复制到剪贴板', type: 'success' }),
      () => setMessage({ text: '复制失败，请手动复制', type: 'error' })
    );
  }, [currentSave]);

  const handleImport = useCallback(() => {
    if (!importText.trim()) return;
    const success = onImport(importText.trim());
    if (success) {
      setMessage({ text: '存档导入成功', type: 'success' });
      setImportText('');
    } else {
      setMessage({ text: '存档导入失败，格式错误', type: 'error' });
    }
  }, [importText, onImport]);

  const handleReset = useCallback(() => {
    if (window.confirm('确定要重置游戏吗？所有进度将丢失！')) {
      onReset();
      refreshSlots();
      setMessage({ text: '游戏已重置', type: 'success' });
    }
  }, [onReset, refreshSlots]);

  return (
    <div className="flex flex-col gap-4">
      {/* 存档槽位 */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-gray-300">💾 存档槽位</h4>
        {slots.map((slot) => (
          <div
            key={slot.slot}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400">
                槽位 {slot.slot + 1} — {formatDate(slot.savedAt)}
              </div>
              <div className="truncate text-xs text-gray-500">
                {slot.preview ?? '空'}
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => saveToSlot(slot.slot)}
                className="rounded-lg bg-gp-accent/20 px-2 py-1 text-xs text-gp-accent hover:bg-gp-accent/30"
              >
                保存
              </button>
              {slot.data && (
                <>
                  <button
                    onClick={() => loadFromSlot(slot.slot)}
                    className="rounded-lg bg-gp-green/20 px-2 py-1 text-xs text-gp-green hover:bg-gp-green/30"
                  >
                    加载
                  </button>
                  <button
                    onClick={() => deleteSlot(slot.slot)}
                    className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/30"
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 导出/导入 */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-gray-300">📋 导出/导入</h4>
        <button
          onClick={handleExport}
          className="rounded-lg bg-gp-accent/20 px-3 py-2 text-sm text-gp-accent hover:bg-gp-accent/30"
        >
          📤 导出存档（复制到剪贴板）
        </button>
        <div className="flex gap-2">
          <input
            type="text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="粘贴存档字符串..."
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 placeholder:text-gray-600 focus:border-gp-accent/50 focus:outline-none"
          />
          <button
            onClick={handleImport}
            className="rounded-lg bg-gp-green/20 px-3 py-2 text-xs text-gp-green hover:bg-gp-green/30"
          >
            📥 导入
          </button>
        </div>
      </div>

      {/* 重置 */}
      <button
        onClick={handleReset}
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20"
      >
        🗑️ 重置游戏
      </button>

      {/* 消息 */}
      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            message.type === 'success'
              ? 'bg-gp-green/10 text-gp-green'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
