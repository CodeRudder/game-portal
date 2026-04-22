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
import './StoryEventModal.css';

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
      <div className="tk-story-container" data-testid="story-event-modal">
        {/* 对话内容 */}
        <div className="tk-story-dialogues">
          {storyLines.map((line: any, idx: number) => (
            <div key={idx} className="tk-story-line">
              <span className="tk-story-speaker">{line.speaker}</span>
              <span className="tk-story-text">{line.text}</span>
            </div>
          ))}
        </div>

        {/* 奖励预览 */}
        {allRewards.length > 0 && (
          <div className="tk-story-rewards">
            🎁 可能奖励：{allRewards.join('  ')}
          </div>
        )}

        {/* 选择按钮 */}
        {choices.length > 0 && (
          <div className="tk-story-choices" data-testid="story-event-choices">
            {choices.map((choice: any) => (
              <button
                key={choice.id}
                className="tk-story-choice-btn"
                onClick={() => onSelect(choice.id)}
              >
                <div className="tk-story-choice-text">{choice.text}</div>
                {choice.consequence && (
                  <div className="tk-story-choice-consequence">
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
