import React from 'react';

// ═══════════════════════════════════════════════════════════════

/** 军事科技 — 剑 (红色系) — 兵法入门 mil_1 */
const TechSwordIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 剑身 */}
    <path d="M14,3 L16,12 L14,25 L12,12 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.8" />
    <path d="M14,5 L15,12 L14,22 L13,12 Z" fill="#e53935" opacity="0.6" />
    {/* 剑柄横档 */}
    <rect x="9" y="11" width="10" height="2.5" rx="1" fill="#d4a030" stroke="#8B6914" strokeWidth="0.5" />
    {/* 剑柄 */}
    <rect x="12.5" y="13" width="3" height="6" rx="1" fill="#6b4226" stroke="#4a2a16" strokeWidth="0.5" />
    {/* 剑首 */}
    <circle cx="14" cy="20" r="2" fill="#d4a030" stroke="#8B6914" strokeWidth="0.5" />
  </svg>
);

/** 军事科技 — 盾 (红色系) — 阵法精通 mil_2 */
const TechShieldIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 盾牌外形 */}
    <path d="M14,3 L24,7 L24,16 Q24,22 14,26 Q4,22 4,16 L4,7 Z" fill="#a83232" stroke="#8b1a1a" strokeWidth="1" />
    {/* 盾牌内框 */}
    <path d="M14,6 L21,9 L21,15 Q21,20 14,23 Q7,20 7,15 L7,9 Z" fill="none" stroke="#d4a030" strokeWidth="0.8" />
    {/* 盾牌纹章 — 虎 */}
    <text x="14" y="17" textAnchor="middle" fontSize="8" fill="#d4a030" fontFamily="serif" fontWeight="bold">虎</text>
    {/* 高光 */}
    <path d="M10,8 L12,8 L10,14 Z" fill="white" opacity="0.12" />
  </svg>
);

/** 军事科技 — 弓箭 (红色系) — 神兵利器 mil_3 */
const TechBowIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 弓身 */}
    <path d="M8,4 Q4,14 8,24" fill="none" stroke="#8b4513" strokeWidth="2" strokeLinecap="round" />
    {/* 弓弦 */}
    <line x1="8" y1="4" x2="8" y2="24" stroke="#d4a030" strokeWidth="0.8" />
    {/* 箭身 */}
    <line x1="6" y1="14" x2="24" y2="14" stroke="#6b4226" strokeWidth="1.5" />
    {/* 箭头 */}
    <polygon points="24,14 20,11 20,17" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.5" />
    {/* 箭羽 */}
    <path d="M8,12 L6,14 L8,16" fill="#a83232" stroke="#8b1a1a" strokeWidth="0.5" />
  </svg>
);

/** 军事科技 — 战旗 (红色系) — 百战百胜 mil_4 */
const TechBannerIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 旗杆 */}
    <line x1="7" y1="3" x2="7" y2="26" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    {/* 旗面 */}
    <path d="M8,4 L24,6 L22,14 L8,12 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.8" />
    {/* 旗面纹章 */}
    <text x="15" y="10" textAnchor="middle" fontSize="6" fill="#d4a030" fontFamily="serif" fontWeight="bold">勝</text>
    {/* 旗杆顶部装饰 */}
    <circle cx="7" cy="3" r="1.5" fill="#d4a030" />
    {/* 旗面飘动效果 */}
    <path d="M8,12 Q14,14 22,14" fill="none" stroke="#e53935" strokeWidth="0.5" opacity="0.5" />
  </svg>
);

/** 经济科技 — 锄头 (绿色系) — 农耕改良 eco_1 */
const TechHoeIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 锄柄 */}
    <line x1="14" y1="8" x2="6" y2="24" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    {/* 锄头铁刃 */}
    <path d="M8,6 L20,4 L22,8 L18,10 Q14,8 8,10 Z" fill="#4a7a3a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 锄刃高光 */}
    <path d="M10,6 L18,5 L19,7" fill="none" stroke="#6aaa5a" strokeWidth="0.5" opacity="0.6" />
    {/* 泥土碎屑 */}
    <circle cx="20" cy="10" r="1" fill="#8B7355" opacity="0.5" />
    <circle cx="22" cy="8" r="0.8" fill="#8B7355" opacity="0.4" />
  </svg>
);

/** 经济科技 — 钱币 (绿色系) — 商贸繁荣 eco_2 */
const TechCoinIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 外圆 */}
    <circle cx="14" cy="14" r="11" fill="#4a7a3a" stroke="#2e5d2e" strokeWidth="1" />
    {/* 内圆 */}
    <circle cx="14" cy="14" r="8.5" fill="none" stroke="#6aaa5a" strokeWidth="0.8" />
    {/* 方孔 */}
    <rect x="11" y="11" width="6" height="6" fill="#2a4a2a" rx="0.5" />
    {/* 铭文 */}
    <text x="14" y="10" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif">商</text>
    <text x="14" y="21" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif">通</text>
    {/* 高光 */}
    <path d="M8,8 Q10,6 14,6" fill="none" stroke="white" strokeWidth="0.8" opacity="0.15" />
  </svg>
);

/** 经济科技 — 粮仓 (绿色系) — 治国安邦 eco_3 */
const TechGranaryIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 粮仓屋顶 */}
    <path d="M4,12 L14,4 L24,12 Z" fill="#4a7a3a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 粮仓主体 */}
    <rect x="6" y="12" width="16" height="11" rx="1" fill="#5a8a4a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 仓门 */}
    <rect x="11" y="16" width="6" height="7" rx="0.5" fill="#3a5a2a" />
    <line x1="14" y1="16" x2="14" y2="23" stroke="#2e5d2e" strokeWidth="0.5" />
    {/* 麦穗装饰 */}
    <ellipse cx="8" cy="9" rx="1.5" ry="2.5" fill="#8aaa5a" transform="rotate(-20 8 9)" />
    <ellipse cx="20" cy="9" rx="1.5" ry="2.5" fill="#8aaa5a" transform="rotate(20 20 9)" />
    {/* 装饰横纹 */}
    <line x1="6" y1="15" x2="22" y2="15" stroke="#6aaa5a" strokeWidth="0.5" opacity="0.5" />
  </svg>
);

/** 经济科技 — 皇冠 (绿色系) — 富国强兵 eco_4 */
const TechCrownIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 皇冠主体 */}
    <path d="M4,18 L6,8 L10,14 L14,6 L18,14 L22,8 L24,18 Z" fill="#4a7a3a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 皇冠底部 */}
    <rect x="4" y="18" width="20" height="5" rx="1" fill="#5a8a4a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 宝石 */}
    <circle cx="10" cy="13" r="1.2" fill="#d4a030" />
    <circle cx="14" cy="8" r="1.5" fill="#d4a030" />
    <circle cx="18" cy="13" r="1.2" fill="#d4a030" />
    {/* 底部纹饰 */}
    <line x1="6" y1="20" x2="22" y2="20" stroke="#6aaa5a" strokeWidth="0.5" />
  </svg>
);

/** 文化科技 — 竹简 (蓝色系) — 招贤纳士 cul_1 */
const TechBambooSlipIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 竹简条 */}
    {[5, 8, 11, 14, 17, 20, 23].map((x, i) => (
      <rect key={i} x={x} y="4" width="2.2" height="20" rx="0.5" fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.4" />
    ))}
    {/* 编绳 */}
    <line x1="4" y1="9" x2="25" y2="9" stroke="#d4a030" strokeWidth="0.8" />
    <line x1="4" y1="19" x2="25" y2="19" stroke="#d4a030" strokeWidth="0.8" />
    {/* 文字 */}
    <text x="14" y="15" textAnchor="middle" fontSize="5" fill="#a0c4e8" fontFamily="serif">賢</text>
  </svg>
);

/** 文化科技 — 书卷 (蓝色系) — 礼贤下士 cul_2 */
const TechScrollIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 书卷主体 */}
    <rect x="6" y="6" width="16" height="16" rx="2" fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.8" />
    {/* 书卷卷角 */}
    <path d="M18,6 Q22,6 22,10 L18,10 Z" fill="#5a7fb5" stroke="#2e4a7a" strokeWidth="0.5" />
    {/* 文字行 */}
    <line x1="9" y1="10" x2="19" y2="10" stroke="#a0c4e8" strokeWidth="0.6" opacity="0.6" />
    <line x1="9" y1="13" x2="17" y2="13" stroke="#a0c4e8" strokeWidth="0.6" opacity="0.6" />
    <line x1="9" y1="16" x2="18" y2="16" stroke="#a0c4e8" strokeWidth="0.6" opacity="0.6" />
    <line x1="9" y1="19" x2="15" y2="19" stroke="#a0c4e8" strokeWidth="0.6" opacity="0.6" />
    {/* 印章 */}
    <circle cx="18" cy="18" r="2" fill="none" stroke="#c62828" strokeWidth="0.6" opacity="0.7" />
  </svg>
);

/** 文化科技 — 笔墨 (蓝色系) — 王道仁政 cul_3 */
const TechBrushInkIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 毛笔笔杆 */}
    <line x1="18" y1="3" x2="10" y2="19" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    {/* 毛笔笔毫 */}
    <path d="M10,19 Q8,22 10,25 Q12,22 10,19" fill="#2a2a2a" stroke="#1a1a1a" strokeWidth="0.3" />
    {/* 墨迹 */}
    <ellipse cx="10" cy="24" rx="2" ry="1" fill="#1a1a1a" opacity="0.3" />
    {/* 砚台 */}
    <ellipse cx="18" cy="22" rx="6" ry="3.5" fill="#4a4a4a" stroke="#2a2a2a" strokeWidth="0.6" />
    <ellipse cx="18" cy="21" rx="4" ry="2" fill="#1a1a1a" opacity="0.6" />
    {/* 装饰 — 墨滴 */}
    <circle cx="13" cy="16" r="0.8" fill="#4a6fa5" opacity="0.5" />
  </svg>
);

/** 文化科技 — 星辉 (蓝色系) — 天下归心 cul_4 */
const TechStarIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 外圈光晕 */}
    <circle cx="14" cy="14" r="11" fill="none" stroke="#4a6fa5" strokeWidth="0.5" opacity="0.3" />
    <circle cx="14" cy="14" r="8" fill="none" stroke="#5a7fb5" strokeWidth="0.3" opacity="0.2" />
    {/* 五角星 */}
    <polygon
      points="14,4 16.5,10.5 23,11 18,15.5 19.5,22 14,18.5 8.5,22 10,15.5 5,11 11.5,10.5"
      fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.6"
    />
    {/* 中心光点 */}
    <circle cx="14" cy="13" r="2" fill="#a0c4e8" opacity="0.5" />
    {/* 装饰小星 */}
    <circle cx="6" cy="6" r="0.8" fill="#5a7fb5" opacity="0.5" />
    <circle cx="22" cy="6" r="0.8" fill="#5a7fb5" opacity="0.5" />
    <circle cx="6" cy="22" r="0.8" fill="#5a7fb5" opacity="0.5" />
    <circle cx="22" cy="22" r="0.8" fill="#5a7fb5" opacity="0.5" />
  </svg>
);

/** 科技图标映射 — 根据 tech id 查找对应图标 */
const TECH_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  mil_1: TechSwordIcon,
  mil_2: TechShieldIcon,
  mil_3: TechBowIcon,
  mil_4: TechBannerIcon,
  eco_1: TechHoeIcon,
  eco_2: TechCoinIcon,
  eco_3: TechGranaryIcon,
  eco_4: TechCrownIcon,
  cul_1: TechBambooSlipIcon,
  cul_2: TechScrollIcon,
  cul_3: TechBrushInkIcon,
  cul_4: TechStarIcon,
};

/** 科技树图标组件 — 根据科技 ID 渲染对应的古风 SVG 图标 */
export const TechIcon: React.FC<{ techId: string; size?: number }> = ({ techId, size = 28 }) => {
  const IconComponent = TECH_ICON_MAP[techId];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // 兜底：通用科技图标
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="10" fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.8" />
      <text x="14" y="17" textAnchor="middle" fontSize="10" fill="#d4a030" fontFamily="serif">?</text>
    </svg>
  );
};

/** 锁定状态图标 — 古风铜锁 (替代通用 🔒) */
export const TechLockedIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 锁体 */}
    <rect x="7" y="13" width="14" height="11" rx="2" fill="#5a4a3a" stroke="#3a2a1a" strokeWidth="0.8" />
    {/* 锁环 */}
    <path d="M10,13 L10,9 Q10,5 14,5 Q18,5 18,9 L18,13" fill="none" stroke="#8B7355" strokeWidth="1.5" strokeLinecap="round" />
    {/* 锁孔 */}
    <circle cx="14" cy="18" r="2" fill="#2a1a0a" />
    <rect x="13" y="18" width="2" height="3" fill="#2a1a0a" />
    {/* 铜锈质感 */}
    <path d="M9,15 L19,15" stroke="#6b5a3a" strokeWidth="0.4" opacity="0.5" />
  </svg>
);

/** 研究中旋转动画图标 */
export const TechResearchingIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" className="tk-tech-research-spin">
    {/* 外环 */}
    <circle cx="14" cy="14" r="11" fill="none" stroke="#d4a030" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
    {/* 内环 */}
    <circle cx="14" cy="14" r="7" fill="none" stroke="#d4a030" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.4" />
    {/* 中心点 */}
    <circle cx="14" cy="14" r="2.5" fill="#d4a030" opacity="0.8" />
    {/* 火花 */}
    <circle cx="14" cy="3" r="1" fill="#ff8c00" opacity="0.7" />
    <circle cx="25" cy="14" r="1" fill="#ff8c00" opacity="0.5" />
    <circle cx="14" cy="25" r="1" fill="#ff8c00" opacity="0.3" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════
// 武将技能图标 SVG 组件 (20×20)
// ═══════════════════════════════════════════════════════════════
