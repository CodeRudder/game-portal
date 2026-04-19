import React from 'react';

const GrainResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-grain-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f0c040" />
        <stop offset="100%" stopColor="#c49a28" />
      </linearGradient>
    </defs>
    {/* 麦穗茎 */}
    <line x1="10" y1="18" x2="10" y2="3" stroke="#8a7a3a" strokeWidth="1" />
    {/* 顶部穗粒 */}
    <ellipse cx="10" cy="2.5" rx="1.8" ry="2.2" fill="url(#tk-grain-gold)" />
    {/* 第二层穗粒（左右） */}
    <ellipse cx="8" cy="5" rx="1.6" ry="2" fill="url(#tk-grain-gold)" transform="rotate(-25 8 5)" />
    <ellipse cx="12" cy="5" rx="1.6" ry="2" fill="url(#tk-grain-gold)" transform="rotate(25 12 5)" />
    {/* 第三层穗粒 */}
    <ellipse cx="7.5" cy="8.5" rx="1.4" ry="1.8" fill="#d4a030" transform="rotate(-20 7.5 8.5)" />
    <ellipse cx="12.5" cy="8.5" rx="1.4" ry="1.8" fill="#d4a030" transform="rotate(20 12.5 8.5)" />
    {/* 第四层穗粒 */}
    <ellipse cx="8" cy="12" rx="1.2" ry="1.5" fill="#b8943e" transform="rotate(-15 8 12)" />
    <ellipse cx="12" cy="12" rx="1.2" ry="1.5" fill="#b8943e" transform="rotate(15 12 12)" />
    {/* 底部捆扎 */}
    <path d="M7,14 Q10,13 13,14" stroke="#8a6a2a" strokeWidth="1" fill="none" />
    <path d="M7,15 Q10,14 13,15" stroke="#8a6a2a" strokeWidth="0.8" fill="none" />
    {/* 芒刺 */}
    <line x1="10" y1="0.5" x2="10" y2="0" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="7" y1="4" x2="6" y2="3" stroke="#d4a030" strokeWidth="0.4" />
    <line x1="13" y1="4" x2="14" y2="3" stroke="#d4a030" strokeWidth="0.4" />
  </svg>
);

/** 铁 — 铁锭形状（深灰色，带金属光泽渐变） */
const IronResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-iron-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8a8a8a" />
        <stop offset="30%" stopColor="#6a6a6a" />
        <stop offset="60%" stopColor="#9a9a9a" />
        <stop offset="100%" stopColor="#5a5a5a" />
      </linearGradient>
    </defs>
    {/* 铁锭主体 — 梯形 */}
    <path d="M3,14 L5,6 L15,6 L17,14 Z" fill="url(#tk-iron-metal)" stroke="#4a4a4a" strokeWidth="0.8" />
    {/* 铁锭顶部面 */}
    <path d="M5,6 L6,4 L14,4 L15,6 Z" fill="#7a7a7a" stroke="#4a4a4a" strokeWidth="0.5" />
    {/* 金属高光 */}
    <path d="M7,7 L13,7 L12,8 L8,8 Z" fill="white" opacity="0.2" />
    {/* 铁锭底部阴影 */}
    <path d="M3,14 L17,14 L16,16 L4,16 Z" fill="#3a3a3a" stroke="#2a2a2a" strokeWidth="0.5" />
    {/* 矿石纹理斑点 */}
    <circle cx="8" cy="10" r="0.6" fill="#5a5a5a" opacity="0.6" />
    <circle cx="12" cy="11" r="0.5" fill="#5a5a5a" opacity="0.5" />
    <circle cx="10" cy="9" r="0.4" fill="#7a7a7a" opacity="0.4" />
  </svg>
);

/** 木材 — 原木形状（棕色，带年轮纹理） */
const WoodResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-wood-bark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8B6914" />
        <stop offset="100%" stopColor="#5a3a0a" />
      </linearGradient>
    </defs>
    {/* 原木主体 */}
    <rect x="3" y="7" width="14" height="8" rx="3" fill="url(#tk-wood-bark)" stroke="#3a2a0a" strokeWidth="0.8" />
    {/* 树皮纹理 */}
    <line x1="6" y1="8" x2="6" y2="14" stroke="#4a3a1a" strokeWidth="0.4" opacity="0.5" />
    <line x1="10" y1="7.5" x2="10" y2="14.5" stroke="#4a3a1a" strokeWidth="0.3" opacity="0.4" />
    <line x1="14" y1="8" x2="14" y2="14" stroke="#4a3a1a" strokeWidth="0.4" opacity="0.5" />
    {/* 左端年轮截面 */}
    <ellipse cx="3.5" cy="11" rx="2" ry="4" fill="#b8943e" stroke="#8B6914" strokeWidth="0.6" />
    <ellipse cx="3.5" cy="11" rx="1.2" ry="2.5" fill="none" stroke="#8B6914" strokeWidth="0.4" opacity="0.6" />
    <ellipse cx="3.5" cy="11" rx="0.5" ry="1" fill="#8B6914" opacity="0.5" />
    {/* 右端年轮截面 */}
    <ellipse cx="16.5" cy="11" rx="2" ry="4" fill="#b8943e" stroke="#8B6914" strokeWidth="0.6" />
    <ellipse cx="16.5" cy="11" rx="1.2" ry="2.5" fill="none" stroke="#8B6914" strokeWidth="0.4" opacity="0.6" />
    <ellipse cx="16.5" cy="11" rx="0.5" ry="1" fill="#8B6914" opacity="0.5" />
    {/* 木纹高光 */}
    <path d="M5,9 Q10,8 15,9" stroke="#c49a28" strokeWidth="0.3" fill="none" opacity="0.4" />
  </svg>
);

/** 铜钱 — 方孔圆钱（古铜色，中间方孔，边缘纹路） */
const GoldResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-coin-patina" cx="0.4" cy="0.35" r="0.6">
        <stop offset="0%" stopColor="#d4a030" />
        <stop offset="50%" stopColor="#b87333" />
        <stop offset="100%" stopColor="#8B6914" />
      </radialGradient>
    </defs>
    {/* 外圆 */}
    <circle cx="10" cy="10" r="8.5" fill="url(#tk-coin-patina)" stroke="#6b5a14" strokeWidth="0.8" />
    {/* 外缘纹路 — 短线装饰 */}
    <circle cx="10" cy="10" r="7.5" fill="none" stroke="#d4a030" strokeWidth="0.4" opacity="0.6" />
    {/* 边缘锯齿纹 */}
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => {
      const rad = (angle * Math.PI) / 180;
      const x1 = 10 + Math.cos(rad) * 7.8;
      const y1 = 10 + Math.sin(rad) * 7.8;
      const x2 = 10 + Math.cos(rad) * 8.3;
      const y2 = 10 + Math.sin(rad) * 8.3;
      return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b5a14" strokeWidth="0.4" />;
    })}
    {/* 内圈 */}
    <circle cx="10" cy="10" r="5.5" fill="none" stroke="#d4a030" strokeWidth="0.6" />
    {/* 方孔 */}
    <rect x="8" y="8" width="4" height="4" fill="#2a1a0a" stroke="#6b5a14" strokeWidth="0.4" rx="0.3" />
    {/* 方孔内高光 */}
    <rect x="8.5" y="8.5" width="1" height="1" fill="#d4a030" opacity="0.15" />
    {/* 古钱铭文位置（上下左右四字位） */}
    <text x="10" y="6" textAnchor="middle" fontSize="2.5" fill="#d4a030" fontFamily="serif" opacity="0.7">開</text>
    <text x="10" y="16" textAnchor="middle" fontSize="2.5" fill="#d4a030" fontFamily="serif" opacity="0.7">元</text>
    <text x="5.5" y="11" textAnchor="middle" fontSize="2.5" fill="#d4a030" fontFamily="serif" opacity="0.7">通</text>
    <text x="14.5" y="11" textAnchor="middle" fontSize="2.5" fill="#d4a030" fontFamily="serif" opacity="0.7">宝</text>
    {/* 铜锈斑点 */}
    <circle cx="6" cy="6" r="0.8" fill="#4a8a3a" opacity="0.2" />
    <circle cx="14" cy="14" r="0.6" fill="#4a8a3a" opacity="0.15" />
  </svg>
);

/** 兵力 — 盾牌+剑形状（朱红） */
const TroopsResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 盾牌 */}
    <path d="M5,4 L5,12 Q5,17 9,18 L9,18 Q9,17 9,18 Q13,17 13,12 L13,4 Z" fill="#8b2020" stroke="#c62828" strokeWidth="0.8" />
    {/* 盾牌内框 */}
    <path d="M6,5 L6,11.5 Q6,15.5 9,16.5 Q12,15.5 12,11.5 L12,5 Z" fill="#a83232" opacity="0.5" />
    {/* 盾牌纹饰 — 横竖线 */}
    <line x1="9" y1="6" x2="9" y2="15" stroke="#d4a030" strokeWidth="0.5" opacity="0.6" />
    <line x1="6.5" y1="10" x2="11.5" y2="10" stroke="#d4a030" strokeWidth="0.5" opacity="0.6" />
    {/* 剑 */}
    <line x1="14" y1="3" x2="18" y2="17" stroke="#c0c0c0" strokeWidth="1.2" strokeLinecap="round" />
    {/* 剑柄横档 */}
    <line x1="13" y1="13" x2="17" y2="12" stroke="#8B7355" strokeWidth="1" strokeLinecap="round" />
    {/* 剑尖 */}
    <polygon points="14,2 14.5,3 13.5,3" fill="#e0e0e0" />
    {/* 剑首 */}
    <circle cx="17.5" cy="16" r="0.8" fill="#d4a030" />
  </svg>
);

/** 民心 — 灯笼形状（新增资源类型） */
const MoraleResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-lantern-glow" cx="0.5" cy="0.4" r="0.5">
        <stop offset="0%" stopColor="#ff6b35" />
        <stop offset="100%" stopColor="#c62828" />
      </radialGradient>
    </defs>
    {/* 灯笼挂绳 */}
    <line x1="10" y1="2" x2="10" y2="5" stroke="#8B6914" strokeWidth="0.6" />
    {/* 灯笼顶部 */}
    <rect x="7.5" y="4.5" width="5" height="1.5" rx="0.5" fill="#c62828" stroke="#8b2020" strokeWidth="0.4" />
    {/* 灯笼主体 */}
    <ellipse cx="10" cy="11" rx="5" ry="6" fill="url(#tk-lantern-glow)" stroke="#8b2020" strokeWidth="0.6" />
    {/* 灯笼横纹 */}
    <ellipse cx="10" cy="9" rx="4.5" ry="0.5" fill="none" stroke="#d4a030" strokeWidth="0.3" opacity="0.5" />
    <ellipse cx="10" cy="11" rx="5" ry="0.5" fill="none" stroke="#d4a030" strokeWidth="0.3" opacity="0.5" />
    <ellipse cx="10" cy="13" rx="4.5" ry="0.5" fill="none" stroke="#d4a030" strokeWidth="0.3" opacity="0.5" />
    {/* 灯笼底部 */}
    <rect x="7.5" y="16.5" width="5" height="1.5" rx="0.5" fill="#c62828" stroke="#8b2020" strokeWidth="0.4" />
    {/* 灯笼穗子 */}
    <line x1="9" y1="18" x2="8.5" y2="19.5" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="10" y1="18" x2="10" y2="19.5" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="11" y1="18" x2="11.5" y2="19.5" stroke="#d4a030" strokeWidth="0.5" />
    {/* 灯笼内光 */}
    <ellipse cx="10" cy="10" rx="2" ry="3" fill="#ff8c00" opacity="0.25" />
    {/* 福字 */}
    <text x="10" y="12.5" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif" fontWeight="bold" opacity="0.8">福</text>
  </svg>
);

/** 天命 — 玉玺 (翠绿) */
const DestinyResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 玉玺底部 */}
    <rect x="4" y="10" width="12" height="7" rx="1" fill="#4a8a5a" stroke="#3a6a4a" strokeWidth="0.8" />
    {/* 玉玺把手 */}
    <rect x="7" y="4" width="6" height="7" rx="2" fill="#5a9a6a" stroke="#3a6a4a" strokeWidth="0.8" />
    {/* 玉玺印文 */}
    <text x="10" y="15" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif" fontWeight="bold">命</text>
    {/* 高光 */}
    <rect x="8" y="5" width="1.5" height="4" rx="0.5" fill="white" opacity="0.15" />
  </svg>
);

/** 资源图标映射 */
const RESOURCE_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  grain: GrainResourceIcon,
  gold: GoldResourceIcon,
  iron: IronResourceIcon,
  wood: WoodResourceIcon,
  troops: TroopsResourceIcon,
  destiny: DestinyResourceIcon,
  morale: MoraleResourceIcon,
};

/** 资源图标组件 — 根据资源 ID 渲染对应的 SVG */
export const ResourceIcon: React.FC<{ resourceId: string; size?: number }> = ({ resourceId, size = 20 }) => {
  const IconComponent = RESOURCE_ICON_MAP[resourceId];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // 兜底：显示通用资源图标
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7" fill="#8B7355" stroke="#6b5a3a" strokeWidth="1" />
      <text x="10" y="13" textAnchor="middle" fontSize="8" fill="#d4a030">?</text>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
