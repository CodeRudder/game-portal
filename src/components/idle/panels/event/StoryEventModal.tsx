/**
 * StoryEventModal — 剧情事件弹窗
 *
 * 显示引擎 StoryEventSystem 触发的剧情事件（桃园结义、官渡之战等），
 * 支持多幕对话、玩家选择和奖励预览。
 *
 * @module components/idle/panels/event/StoryEventModal
 */
import React from 'react';
import Modal from '@/components/idle/common/Modal';

export interface StoryEventModalProps {
  /** 当前剧情幕数据 { id, title, storyLines, isFinal } */
  event: any;
  /** 玩家做出选择后回调 */
  onSelect: (choiceId: string) => void;
  /** 关闭/跳过弹窗 */
  onDismiss: () => void;
}

const StoryEventModal: React.FC<StoryEventModalProps> = ({
  event,
  onSelect,
  onDismiss,
}) => {
  if (!event) return null;

  const { title, storyLines = [] } = event;

  // 提取最后一个含 choices 的台词作为玩家决策点
  const choiceLine = storyLines.find(
    (line: any) => Array.isArray(line.choices) && line.choices.length > 0
  );
  const choices: any[] = choiceLine?.choices ?? [];

  // 收集所有选择中的资源变化作为奖励预览
  const allRewards = choices.flatMap(
    (c: any) => Object.entries(c.resourceChanges ?? {})
      .map(([k, v]) => `${k}: ${(v as number) > 0 ? '+' : ''}${v}`)
  );

  return (
    <Modal
      visible
      type="info"
      title={`📜 ${title ?? '剧情事件'}`}
      confirmText={choices.length > 0 ? undefined : '继续'}
      cancelText="跳过"
      onConfirm={choices.length > 0 ? undefined : onDismiss}
      onCancel={onDismiss}
      width="520px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#e8e0d0', fontSize: '14px' }}>
        {/* 对话内容 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          {storyLines.map((line: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontWeight: 700, color: '#f0c040', minWidth: '48px' }}>{line.speaker}</span>
              <span style={{ lineHeight: 1.6 }}>{line.text}</span>
            </div>
          ))}
        </div>

        {/* 奖励预览 */}
        {allRewards.length > 0 && (
          <div style={{ fontSize: '12px', color: '#a0d0a0', borderTop: '1px solid #555', paddingTop: '8px' }}>
            🎁 可能奖励：{allRewards.join('  ')}
          </div>
        )}

        {/* 选择按钮 */}
        {choices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {choices.map((choice: any) => (
              <button
                key={choice.id}
                onClick={() => onSelect(choice.id)}
                style={{
                  padding: '10px 16px', borderRadius: 'var(--tk-radius-md)' as any, border: '1px solid #8b7355',
                  background: 'linear-gradient(135deg, #3a2a1a, #4a3a2a)', color: '#e8e0d0',
                  cursor: 'pointer', textAlign: 'left', fontSize: '14px',
                }}
              >
                <div style={{ fontWeight: 600 }}>{choice.text}</div>
                {choice.consequence && (
                  <div style={{ fontSize: '12px', color: '#c0a080', marginTop: '2px' }}>
                    → {choice.consequence}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default StoryEventModal;
