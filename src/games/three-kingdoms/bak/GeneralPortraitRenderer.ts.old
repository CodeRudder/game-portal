/**
 * 武将立绘程序化绘制器 — Q版国风立绘
 *
 * 为12位三国武将程序化绘制Q版立绘，每位武将有独特的外观特征。
 * 使用 Canvas 2D API 程序化绘制，无外部图片依赖。
 *
 * 武将列表：
 * - 刘备：双耳垂肩、仁慈面容、双剑
 * - 关羽：红脸、长须、青龙偃月刀
 * - 张飞：黑脸、虎须、丈八蛇矛
 * - 曹操：白脸、短须、倚天剑
 * - 诸葛亮：羽扇纶巾、仙风道骨
 * - 赵云：银甲白袍、龙胆枪
 * - 孙权：紫髯碧眼、吴钩
 * - 吕布：方天画戟、赤兔马
 * - 周瑜：儒雅风流、古琴
 * - 黄忠：白发白须、大弓
 * - 马超：银甲、虎头湛金枪
 * - 许褚：虎痴、大锤
 *
 * @module games/three-kingdoms/GeneralPortraitRenderer
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 武将立绘配置 */
export interface GeneralPortraitDef {
  /** 武将唯一 ID */
  id: string;
  /** 武将名称 */
  name: string;
  /** 脸部颜色 */
  faceColor: string;
  /** 主色调（衣服） */
  primaryColor: string;
  /** 辅助色 */
  secondaryColor: string;
  /** 帽子/头饰类型 */
  hatType: 'crown' | 'helmet' | 'scholar_hat' | 'band' | 'feather_helm' | 'none';
  /** 胡须类型 */
  beardType: 'long' | 'short' | 'tiger' | 'white_long' | 'none';
  /** 武器类型 */
  weaponType: 'dual_sword' | 'guandao' | 'spear' | 'sword' | 'fan' | 'dragon_spear' | 'hook' | 'halberd' | 'lute' | 'bow' | 'golden_spear' | 'hammer';
  /** 特殊特征 */
  specialFeature: 'big_ears' | 'red_face' | 'dark_face' | 'white_face' | 'wisdom_aura' | 'silver_armor' | 'purple_beard' | 'fierce_eyes' | 'elegant' | 'elderly' | 'silver_armor_2' | 'muscular';
  /** 阵营 */
  faction: string;
}

/** 绘制上下文 */
export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ═══════════════════════════════════════════════════════════════
// 12 武将配置
// ═══════════════════════════════════════════════════════════════

export const GENERAL_PORTRAITS: Record<string, GeneralPortraitDef> = {
  liubei: {
    id: 'liubei', name: '刘备',
    faceColor: '#FFDBAC', primaryColor: '#8B4513', secondaryColor: '#FFD700',
    hatType: 'crown', beardType: 'short', weaponType: 'dual_sword',
    specialFeature: 'big_ears', faction: 'shu',
  },
  guanyu: {
    id: 'guanyu', name: '关羽',
    faceColor: '#CD5C5C', primaryColor: '#228B22', secondaryColor: '#8B0000',
    hatType: 'band', beardType: 'long', weaponType: 'guandao',
    specialFeature: 'red_face', faction: 'shu',
  },
  zhangfei: {
    id: 'zhangfei', name: '张飞',
    faceColor: '#3D3D3D', primaryColor: '#2F4F4F', secondaryColor: '#696969',
    hatType: 'helmet', beardType: 'tiger', weaponType: 'spear',
    specialFeature: 'dark_face', faction: 'shu',
  },
  caocao: {
    id: 'caocao', name: '曹操',
    faceColor: '#FFF8DC', primaryColor: '#800020', secondaryColor: '#FFD700',
    hatType: 'crown', beardType: 'short', weaponType: 'sword',
    specialFeature: 'white_face', faction: 'wei',
  },
  zhugeliang: {
    id: 'zhugeliang', name: '诸葛亮',
    faceColor: '#FFDBAC', primaryColor: '#4169E1', secondaryColor: '#FFFFFF',
    hatType: 'scholar_hat', beardType: 'none', weaponType: 'fan',
    specialFeature: 'wisdom_aura', faction: 'shu',
  },
  zhaoyun: {
    id: 'zhaoyun', name: '赵云',
    faceColor: '#FFDBAC', primaryColor: '#C0C0C0', secondaryColor: '#4169E1',
    hatType: 'helmet', beardType: 'none', weaponType: 'dragon_spear',
    specialFeature: 'silver_armor', faction: 'shu',
  },
  sunquan: {
    id: 'sunquan', name: '孙权',
    faceColor: '#FFDBAC', primaryColor: '#FF6600', secondaryColor: '#FFD700',
    hatType: 'crown', beardType: 'short', weaponType: 'hook',
    specialFeature: 'purple_beard', faction: 'wu',
  },
  lvbu: {
    id: 'lvbu', name: '吕布',
    faceColor: '#FFDBAC', primaryColor: '#8B0000', secondaryColor: '#FFD700',
    hatType: 'feather_helm', beardType: 'none', weaponType: 'halberd',
    specialFeature: 'fierce_eyes', faction: 'neutral',
  },
  zhouyu: {
    id: 'zhouyu', name: '周瑜',
    faceColor: '#FFDBAC', primaryColor: '#F5F5F5', secondaryColor: '#DC143C',
    hatType: 'scholar_hat', beardType: 'none', weaponType: 'lute',
    specialFeature: 'elegant', faction: 'wu',
  },
  huangzhong: {
    id: 'huangzhong', name: '黄忠',
    faceColor: '#FFDBAC', primaryColor: '#556B2F', secondaryColor: '#8B4513',
    hatType: 'band', beardType: 'white_long', weaponType: 'bow',
    specialFeature: 'elderly', faction: 'shu',
  },
  machao: {
    id: 'machao', name: '马超',
    faceColor: '#FFDBAC', primaryColor: '#C0C0C0', secondaryColor: '#4169E1',
    hatType: 'helmet', beardType: 'none', weaponType: 'golden_spear',
    specialFeature: 'silver_armor_2', faction: 'shu',
  },
  xuchu: {
    id: 'xuchu', name: '许褚',
    faceColor: '#FFDBAC', primaryColor: '#8B4513', secondaryColor: '#A0522D',
    hatType: 'none', beardType: 'tiger', weaponType: 'hammer',
    specialFeature: 'muscular', faction: 'wei',
  },
};

/** 所有武将 ID 列表 */
export const ALL_GENERAL_IDS = Object.keys(GENERAL_PORTRAITS);

// ═══════════════════════════════════════════════════════════════
// 颜色辅助
// ═══════════════════════════════════════════════════════════════

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function darkenHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function lightenHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
}

// ═══════════════════════════════════════════════════════════════
// 立绘绘制主函数
// ═══════════════════════════════════════════════════════════════

/**
 * 绘制武将 Q 版立绘
 *
 * @param dc - 绘制上下文
 * @param generalId - 武将 ID
 */
export function drawGeneralPortrait(dc: DrawContext, generalId: string): void {
  const def = GENERAL_PORTRAITS[generalId];
  if (!def) {
    drawUnknownPortrait(dc);
    return;
  }

  const { ctx, x, y, width, height } = dc;
  const cx = x + width / 2;    // 中心 X
  const s = Math.min(width, height) / 200; // 缩放因子
  const baseY = y + height * 0.85; // 脚底 Y

  ctx.save();

  // ── 背景光环 ──
  drawAura(ctx, cx, baseY - 70 * s, s, def.primaryColor);

  // ── 身体 ──
  drawBody(ctx, cx, baseY, s, def);

  // ── 头部 ──
  drawHead(ctx, cx, baseY, s, def);

  // ── 帽子/头饰 ──
  drawHat(ctx, cx, baseY, s, def);

  // ── 胡须 ──
  drawBeard(ctx, cx, baseY, s, def);

  // ── 武器 ──
  drawWeapon(ctx, cx, baseY, s, def);

  // ── 特殊特征 ──
  drawSpecialFeature(ctx, cx, baseY, s, def);

  // ── 名字标签 ──
  drawNameTag(ctx, cx, y + height - 10 * s, s, def.name, def.primaryColor);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// 各部位绘制
// ═══════════════════════════════════════════════════════════════

/** 背景光环 */
function drawAura(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string): void {
  const gradient = ctx.createRadialGradient(cx, cy, 10 * s, cx, cy, 80 * s);
  gradient.addColorStop(0, lightenHex(color, 0.6) + '40');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 80 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** 身体 */
function drawBody(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, def: GeneralPortraitDef): void {
  // ── 腿部 ──
  ctx.strokeStyle = darkenHex(def.primaryColor, 0.6);
  ctx.lineWidth = 8 * s;
  ctx.lineCap = 'round';
  // 左腿
  ctx.beginPath();
  ctx.moveTo(cx - 12 * s, baseY - 40 * s);
  ctx.lineTo(cx - 14 * s, baseY - 5 * s);
  ctx.stroke();
  // 右腿
  ctx.beginPath();
  ctx.moveTo(cx + 12 * s, baseY - 40 * s);
  ctx.lineTo(cx + 14 * s, baseY - 5 * s);
  ctx.stroke();

  // ── 靴子 ──
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.ellipse(cx - 14 * s, baseY - 3 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 14 * s, baseY - 3 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 身体（衣袍） ──
  const bodyTop = baseY - 85 * s;
  const bodyBot = baseY - 35 * s;
  ctx.fillStyle = def.primaryColor;
  ctx.beginPath();
  ctx.moveTo(cx - 25 * s, bodyTop);
  ctx.lineTo(cx + 25 * s, bodyTop);
  ctx.lineTo(cx + 30 * s, bodyBot);
  ctx.lineTo(cx - 30 * s, bodyBot);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = darkenHex(def.primaryColor, 0.7);
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  // ── 腰带 ──
  ctx.fillStyle = def.secondaryColor;
  ctx.fillRect(cx - 28 * s, bodyTop + 25 * s, 56 * s, 6 * s);
  ctx.strokeStyle = darkenHex(def.secondaryColor, 0.7);
  ctx.lineWidth = 1 * s;
  ctx.strokeRect(cx - 28 * s, bodyTop + 25 * s, 56 * s, 6 * s);

  // ── 衣领 ──
  ctx.strokeStyle = def.secondaryColor;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 10 * s, bodyTop);
  ctx.lineTo(cx, bodyTop + 15 * s);
  ctx.lineTo(cx + 10 * s, bodyTop);
  ctx.stroke();

  // ── 袖子/手臂 ──
  ctx.fillStyle = def.primaryColor;
  // 左袖
  ctx.beginPath();
  ctx.moveTo(cx - 25 * s, bodyTop + 5 * s);
  ctx.quadraticCurveTo(cx - 45 * s, bodyTop + 20 * s, cx - 40 * s, bodyTop + 45 * s);
  ctx.lineTo(cx - 30 * s, bodyTop + 40 * s);
  ctx.quadraticCurveTo(cx - 35 * s, bodyTop + 20 * s, cx - 20 * s, bodyTop + 10 * s);
  ctx.closePath();
  ctx.fill();
  // 右袖
  ctx.beginPath();
  ctx.moveTo(cx + 25 * s, bodyTop + 5 * s);
  ctx.quadraticCurveTo(cx + 45 * s, bodyTop + 20 * s, cx + 40 * s, bodyTop + 45 * s);
  ctx.lineTo(cx + 30 * s, bodyTop + 40 * s);
  ctx.quadraticCurveTo(cx + 35 * s, bodyTop + 20 * s, cx + 20 * s, bodyTop + 10 * s);
  ctx.closePath();
  ctx.fill();

  // ── 手 ──
  ctx.fillStyle = def.faceColor;
  ctx.beginPath();
  ctx.arc(cx - 40 * s, bodyTop + 45 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 40 * s, bodyTop + 45 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** 头部 */
function drawHead(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, def: GeneralPortraitDef): void {
  const headCY = baseY - 105 * s;
  const headR = 22 * s;

  // ── 头部 ──
  ctx.fillStyle = def.faceColor;
  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darkenHex(def.faceColor, 0.8);
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  // ── 头发 ──
  ctx.fillStyle = '#1A1A2E';
  ctx.beginPath();
  ctx.arc(cx, headCY - 5 * s, headR + 1 * s, Math.PI * 1.1, Math.PI * 1.9);
  ctx.closePath();
  ctx.fill();

  // ── 眼睛 ──
  const eyeY = headCY - 2 * s;
  // 白眼
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(cx - 8 * s, eyeY, 5 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 8 * s, eyeY, 5 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // 黑瞳
  ctx.fillStyle = '#1A1A2E';
  ctx.beginPath();
  ctx.arc(cx - 7 * s, eyeY, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 7 * s, eyeY, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  // 高光
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx - 6 * s, eyeY - 1.5 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 8 * s, eyeY - 1.5 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();

  // ── 眉毛 ──
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 13 * s, eyeY - 7 * s);
  ctx.lineTo(cx - 4 * s, eyeY - 8 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 4 * s, eyeY - 8 * s);
  ctx.lineTo(cx + 13 * s, eyeY - 7 * s);
  ctx.stroke();

  // ── 嘴巴 ──
  ctx.strokeStyle = '#CC6666';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(cx, headCY + 8 * s, 4 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // ── 腮红 ──
  ctx.fillStyle = 'rgba(255, 153, 153, 0.3)';
  ctx.beginPath();
  ctx.ellipse(cx - 15 * s, headCY + 5 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 15 * s, headCY + 5 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 帽子/头饰 */
function drawHat(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, def: GeneralPortraitDef): void {
  const headCY = baseY - 105 * s;
  const headR = 22 * s;

  switch (def.hatType) {
    case 'crown': {
      // 帝冠/冕旒
      ctx.fillStyle = '#1A1A2E';
      ctx.beginPath();
      ctx.rect(cx - headR - 5 * s, headCY - headR - 15 * s, (headR + 5 * s) * 2, 15 * s);
      ctx.fill();
      ctx.strokeStyle = def.secondaryColor;
      ctx.lineWidth = 1.5 * s;
      ctx.strokeRect(cx - headR - 5 * s, headCY - headR - 15 * s, (headR + 5 * s) * 2, 15 * s);
      // 冕旒垂珠
      ctx.strokeStyle = def.secondaryColor;
      ctx.lineWidth = 1 * s;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 6 * s, headCY - headR - 15 * s);
        ctx.lineTo(cx + i * 6 * s, headCY - headR - 22 * s);
        ctx.stroke();
        ctx.fillStyle = def.secondaryColor;
        ctx.beginPath();
        ctx.arc(cx + i * 6 * s, headCY - headR - 23 * s, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'helmet': {
      // 头盔
      ctx.fillStyle = darkenHex(def.primaryColor, 0.7);
      ctx.beginPath();
      ctx.arc(cx, headCY - 2 * s, headR + 2 * s, Math.PI, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = def.secondaryColor;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(cx, headCY - 2 * s, headR + 2 * s, Math.PI, 2 * Math.PI);
      ctx.stroke();
      // 头盔红缨
      ctx.strokeStyle = '#F44336';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(cx, headCY - headR - 2 * s);
      ctx.lineTo(cx, headCY - headR - 15 * s);
      ctx.stroke();
      ctx.fillStyle = '#F44336';
      ctx.beginPath();
      ctx.arc(cx, headCY - headR - 16 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'scholar_hat': {
      // 纶巾/方巾
      ctx.fillStyle = '#F5F5DC';
      ctx.beginPath();
      ctx.rect(cx - headR - 3 * s, headCY - headR - 12 * s, (headR + 3 * s) * 2, 12 * s);
      ctx.fill();
      ctx.strokeStyle = darkenHex('#F5F5DC', 0.7);
      ctx.lineWidth = 1 * s;
      ctx.strokeRect(cx - headR - 3 * s, headCY - headR - 12 * s, (headR + 3 * s) * 2, 12 * s);
      // 帽翅
      ctx.strokeStyle = '#F5F5DC';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(cx - headR - 3 * s, headCY - headR - 6 * s);
      ctx.lineTo(cx - headR - 18 * s, headCY - headR - 4 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + headR + 3 * s, headCY - headR - 6 * s);
      ctx.lineTo(cx + headR + 18 * s, headCY - headR - 4 * s);
      ctx.stroke();
      break;
    }
    case 'band': {
      // 头巾/额带
      ctx.fillStyle = def.primaryColor;
      ctx.beginPath();
      ctx.rect(cx - headR - 1 * s, headCY - headR + 2 * s, (headR + 1 * s) * 2, 8 * s);
      ctx.fill();
      ctx.strokeStyle = darkenHex(def.primaryColor, 0.6);
      ctx.lineWidth = 1 * s;
      ctx.strokeRect(cx - headR - 1 * s, headCY - headR + 2 * s, (headR + 1 * s) * 2, 8 * s);
      break;
    }
    case 'feather_helm': {
      // 翎羽头盔（吕布专用）
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(cx, headCY - 2 * s, headR + 3 * s, Math.PI, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(cx, headCY - 2 * s, headR + 3 * s, Math.PI, 2 * Math.PI);
      ctx.stroke();
      // 双翎
      ctx.strokeStyle = '#F44336';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * s, headCY - headR - 3 * s);
      ctx.quadraticCurveTo(cx - 15 * s, headCY - headR - 25 * s, cx - 25 * s, headCY - headR - 30 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 5 * s, headCY - headR - 3 * s);
      ctx.quadraticCurveTo(cx + 15 * s, headCY - headR - 25 * s, cx + 25 * s, headCY - headR - 30 * s);
      ctx.stroke();
      break;
    }
    case 'none':
    default:
      break;
  }
}

/** 胡须 */
function drawBeard(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, def: GeneralPortraitDef): void {
  const headCY = baseY - 105 * s;

  switch (def.beardType) {
    case 'long': {
      // 长须（关羽）
      ctx.strokeStyle = '#1A1A2E';
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 3 * s, headCY + 10 * s);
        ctx.quadraticCurveTo(cx + i * 4 * s, headCY + 30 * s, cx + i * 2 * s, headCY + 40 * s);
        ctx.stroke();
      }
      break;
    }
    case 'short': {
      // 短须
      ctx.strokeStyle = '#1A1A2E';
      ctx.lineWidth = 1.5 * s;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 4 * s, headCY + 10 * s);
        ctx.lineTo(cx + i * 3 * s, headCY + 18 * s);
        ctx.stroke();
      }
      break;
    }
    case 'tiger': {
      // 虎须（张飞、许褚）
      ctx.strokeStyle = '#1A1A2E';
      ctx.lineWidth = 1.5 * s;
      ctx.lineCap = 'round';
      // 左侧虎须
      ctx.beginPath();
      ctx.moveTo(cx - 12 * s, headCY + 6 * s);
      ctx.lineTo(cx - 25 * s, headCY + 2 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 12 * s, headCY + 8 * s);
      ctx.lineTo(cx - 25 * s, headCY + 8 * s);
      ctx.stroke();
      // 右侧虎须
      ctx.beginPath();
      ctx.moveTo(cx + 12 * s, headCY + 6 * s);
      ctx.lineTo(cx + 25 * s, headCY + 2 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 12 * s, headCY + 8 * s);
      ctx.lineTo(cx + 25 * s, headCY + 8 * s);
      ctx.stroke();
      break;
    }
    case 'white_long': {
      // 白须（黄忠）
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 3 * s, headCY + 10 * s);
        ctx.quadraticCurveTo(cx + i * 4 * s, headCY + 30 * s, cx + i * 2 * s, headCY + 38 * s);
        ctx.stroke();
      }
      break;
    }
    case 'none':
    default:
      break;
  }
}

/** 武器 */
function drawWeapon(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, def: GeneralPortraitDef): void {
  const bodyTop = baseY - 85 * s;

  switch (def.weaponType) {
    case 'dual_sword': {
      // 双剑（刘备）
      drawSword(ctx, cx - 45 * s, bodyTop + 10 * s, s, '#BDBDBD', -0.2);
      drawSword(ctx, cx + 45 * s, bodyTop + 10 * s, s, '#BDBDBD', 0.2);
      break;
    }
    case 'guandao': {
      // 青龙偃月刀（关羽）
      drawPoleWeapon(ctx, cx + 50 * s, bodyTop - 10 * s, s, 80, '#8D6E63', '#4CAF50');
      // 刀刃
      ctx.fillStyle = '#BDBDBD';
      ctx.beginPath();
      ctx.moveTo(cx + 50 * s, bodyTop - 85 * s);
      ctx.lineTo(cx + 40 * s, bodyTop - 70 * s);
      ctx.lineTo(cx + 55 * s, bodyTop - 65 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'spear': {
      // 丈八蛇矛（张飞）
      drawPoleWeapon(ctx, cx + 50 * s, bodyTop - 5 * s, s, 75, '#5D4037', '#795548');
      // 蛇矛头
      ctx.fillStyle = '#9E9E9E';
      ctx.beginPath();
      ctx.moveTo(cx + 50 * s, bodyTop - 75 * s);
      ctx.quadraticCurveTo(cx + 42 * s, bodyTop - 65 * s, cx + 50 * s, bodyTop - 55 * s);
      ctx.quadraticCurveTo(cx + 58 * s, bodyTop - 65 * s, cx + 50 * s, bodyTop - 75 * s);
      ctx.fill();
      break;
    }
    case 'sword': {
      // 倚天剑（曹操）
      drawSword(ctx, cx + 48 * s, bodyTop + 15 * s, s, '#FFD700', 0.15);
      break;
    }
    case 'fan': {
      // 羽扇（诸葛亮）
      drawFeatherFan(ctx, cx + 45 * s, bodyTop + 10 * s, s);
      break;
    }
    case 'dragon_spear': {
      // 龙胆枪（赵云）
      drawPoleWeapon(ctx, cx + 50 * s, bodyTop - 10 * s, s, 80, '#C0C0C0', '#4169E1');
      // 枪头
      ctx.fillStyle = '#E0E0E0';
      ctx.beginPath();
      ctx.moveTo(cx + 50 * s, bodyTop - 85 * s);
      ctx.lineTo(cx + 44 * s, bodyTop - 72 * s);
      ctx.lineTo(cx + 56 * s, bodyTop - 72 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'hook': {
      // 吴钩（孙权）
      ctx.strokeStyle = '#BDBDBD';
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 48 * s, bodyTop + 50 * s);
      ctx.lineTo(cx + 48 * s, bodyTop + 10 * s);
      ctx.quadraticCurveTo(cx + 48 * s, bodyTop, cx + 40 * s, bodyTop + 5 * s);
      ctx.stroke();
      // 剑柄
      ctx.strokeStyle = '#795548';
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(cx + 48 * s, bodyTop + 45 * s);
      ctx.lineTo(cx + 48 * s, bodyTop + 50 * s);
      ctx.stroke();
      break;
    }
    case 'halberd': {
      // 方天画戟（吕布）
      drawPoleWeapon(ctx, cx + 55 * s, bodyTop - 10 * s, s, 85, '#8D6E63', '#FFD700');
      // 戟头
      ctx.fillStyle = '#C0C0C0';
      ctx.beginPath();
      ctx.moveTo(cx + 55 * s, bodyTop - 90 * s);
      ctx.lineTo(cx + 45 * s, bodyTop - 75 * s);
      ctx.lineTo(cx + 55 * s, bodyTop - 70 * s);
      ctx.lineTo(cx + 65 * s, bodyTop - 75 * s);
      ctx.closePath();
      ctx.fill();
      // 月牙
      ctx.strokeStyle = '#C0C0C0';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(cx + 55 * s, bodyTop - 75 * s, 10 * s, Math.PI * 0.7, Math.PI * 1.3);
      ctx.stroke();
      break;
    }
    case 'lute': {
      // 古琴（周瑜）
      drawLute(ctx, cx + 45 * s, bodyTop + 15 * s, s);
      break;
    }
    case 'bow': {
      // 大弓（黄忠）
      ctx.strokeStyle = '#8D6E63';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(cx + 50 * s, bodyTop + 25 * s, 30 * s, Math.PI * 1.6, Math.PI * 2.4);
      ctx.stroke();
      // 弦
      ctx.strokeStyle = '#F5F5DC';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(cx + 50 * s + 30 * s * Math.cos(Math.PI * 1.6), bodyTop + 25 * s + 30 * s * Math.sin(Math.PI * 1.6));
      ctx.lineTo(cx + 50 * s + 30 * s * Math.cos(Math.PI * 2.4), bodyTop + 25 * s + 30 * s * Math.sin(Math.PI * 2.4));
      ctx.stroke();
      break;
    }
    case 'golden_spear': {
      // 虎头湛金枪（马超）
      drawPoleWeapon(ctx, cx + 50 * s, bodyTop - 10 * s, s, 80, '#C0C0C0', '#FFD700');
      // 金枪头
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(cx + 50 * s, bodyTop - 85 * s);
      ctx.lineTo(cx + 43 * s, bodyTop - 70 * s);
      ctx.lineTo(cx + 57 * s, bodyTop - 70 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'hammer': {
      // 大锤（许褚）
      ctx.strokeStyle = '#795548';
      ctx.lineWidth = 4 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 42 * s, bodyTop + 45 * s);
      ctx.lineTo(cx + 48 * s, bodyTop - 5 * s);
      ctx.stroke();
      // 锤头
      ctx.fillStyle = '#757575';
      ctx.beginPath();
      ctx.arc(cx + 48 * s, bodyTop - 10 * s, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#616161';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(cx + 48 * s, bodyTop - 10 * s, 10 * s, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
}

/** 特殊特征 */
function drawSpecialFeature(ctx: CanvasRenderingContext2D, cx: number, baseY: number, s: number, def: GeneralPortraitDef): void {
  const headCY = baseY - 105 * s;

  switch (def.specialFeature) {
    case 'big_ears': {
      // 刘备：大耳朵
      ctx.fillStyle = def.faceColor;
      ctx.beginPath();
      ctx.ellipse(cx - 25 * s, headCY + 2 * s, 8 * s, 12 * s, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = darkenHex(def.faceColor, 0.8);
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.ellipse(cx - 25 * s, headCY + 2 * s, 8 * s, 12 * s, -0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 25 * s, headCY + 2 * s, 8 * s, 12 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 25 * s, headCY + 2 * s, 8 * s, 12 * s, 0.2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'wisdom_aura': {
      // 诸葛亮：智慧光环
      ctx.strokeStyle = 'rgba(65, 105, 225, 0.4)';
      ctx.lineWidth = 1.5 * s;
      ctx.setLineDash([3 * s, 3 * s]);
      ctx.beginPath();
      ctx.arc(cx, headCY, 30 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 星光点缀
      ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const sx = cx + Math.cos(angle) * 32 * s;
        const sy = headCY + Math.sin(angle) * 32 * s;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'fierce_eyes': {
      // 吕布：凶猛眼神
      ctx.strokeStyle = '#8B0000';
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 13 * s, headCY - 9 * s);
      ctx.lineTo(cx - 4 * s, headCY - 10 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 4 * s, headCY - 10 * s);
      ctx.lineTo(cx + 13 * s, headCY - 9 * s);
      ctx.stroke();
      break;
    }
    case 'purple_beard': {
      // 孙权：紫髯
      ctx.strokeStyle = '#6A0DAD';
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 4 * s, headCY + 10 * s);
        ctx.lineTo(cx + i * 3 * s, headCY + 22 * s);
        ctx.stroke();
      }
      break;
    }
    case 'elderly': {
      // 黄忠：皱纹
      ctx.strokeStyle = 'rgba(139, 119, 101, 0.3)';
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 8 * s, headCY - 5 * s);
      ctx.lineTo(cx - 3 * s, headCY - 4 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 3 * s, headCY - 4 * s);
      ctx.lineTo(cx + 8 * s, headCY - 5 * s);
      ctx.stroke();
      // 白发
      ctx.fillStyle = '#E0E0E0';
      ctx.beginPath();
      ctx.arc(cx, headCY - 5 * s, 23 * s, Math.PI * 1.1, Math.PI * 1.9);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'muscular': {
      // 许褚：壮硕体型（已在身体部分体现）
      // 添加额外肌肉线条
      ctx.strokeStyle = darkenHex(def.primaryColor, 0.5);
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 30 * s, baseY - 75 * s);
      ctx.lineTo(cx - 28 * s, baseY - 60 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 30 * s, baseY - 75 * s);
      ctx.lineTo(cx + 28 * s, baseY - 60 * s);
      ctx.stroke();
      break;
    }
    // red_face, dark_face, white_face, silver_armor, elegant, silver_armor_2
    // 这些已通过 faceColor 和 primaryColor 体现
    case 'silver_armor':
    case 'silver_armor_2': {
      // 银甲高光
      const bodyTop = baseY - 85 * s;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(cx - 20 * s, bodyTop + 5 * s);
      ctx.lineTo(cx - 5 * s, bodyTop + 5 * s);
      ctx.lineTo(cx - 8 * s, bodyTop + 40 * s);
      ctx.lineTo(cx - 22 * s, bodyTop + 40 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'elegant': {
      // 周瑜：飘逸丝带
      ctx.strokeStyle = '#DC143C';
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 15 * s, baseY - 105 * s);
      ctx.quadraticCurveTo(cx + 35 * s, baseY - 95 * s, cx + 30 * s, baseY - 75 * s);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
}

// ═══════════════════════════════════════════════════════════════
// 武器辅助绘制
// ═══════════════════════════════════════════════════════════════

/** 绘制单剑 */
function drawSword(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, bladeColor: string, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // 剑刃
  ctx.strokeStyle = bladeColor;
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 40 * s);
  ctx.lineTo(0, -20 * s);
  ctx.stroke();
  // 剑尖
  ctx.beginPath();
  ctx.moveTo(-3 * s, -20 * s);
  ctx.lineTo(0, -28 * s);
  ctx.lineTo(3 * s, -20 * s);
  ctx.closePath();
  ctx.fillStyle = bladeColor;
  ctx.fill();
  // 剑柄
  ctx.strokeStyle = '#795548';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(0, 40 * s);
  ctx.lineTo(0, 48 * s);
  ctx.stroke();
  // 护手
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(-6 * s, 38 * s);
  ctx.lineTo(6 * s, 38 * s);
  ctx.stroke();
  ctx.restore();
}

/** 绘制长杆武器 */
function drawPoleWeapon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, length: number, poleColor: string, _tipColor: string): void {
  ctx.strokeStyle = poleColor;
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + length * s * 0.5);
  ctx.lineTo(x, y - length * s * 0.5);
  ctx.stroke();
}

/** 绘制羽扇 */
function drawFeatherFan(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // 扇面
  ctx.fillStyle = '#F5F5DC';
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, Math.PI * 0.2, Math.PI * 0.8);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = darkenHex('#F5F5DC', 0.7);
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  // 羽毛纹理
  ctx.strokeStyle = '#BDBDBD';
  ctx.lineWidth = 0.8 * s;
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI * 0.25 + i * Math.PI * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * 16 * s, y - Math.sin(angle) * 16 * s);
    ctx.stroke();
  }
  // 扇柄
  ctx.strokeStyle = '#795548';
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 2 * s, y + 20 * s);
  ctx.stroke();
}

/** 绘制古琴 */
function drawLute(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // 琴身
  ctx.fillStyle = '#8D6E63';
  ctx.beginPath();
  ctx.roundRect(x - 8 * s, y - 12 * s, 16 * s, 24 * s, 4 * s);
  ctx.fill();
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.roundRect(x - 8 * s, y - 12 * s, 16 * s, 24 * s, 4 * s);
  ctx.stroke();
  // 琴弦
  ctx.strokeStyle = '#F5F5DC';
  ctx.lineWidth = 0.5 * s;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 3 * s, y - 10 * s);
    ctx.lineTo(x + i * 3 * s, y + 10 * s);
    ctx.stroke();
  }
}

/** 名字标签 */
function drawNameTag(ctx: CanvasRenderingContext2D, cx: number, y: number, s: number, name: string, color: string): void {
  ctx.font = `bold ${12 * s}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textWidth = ctx.measureText(name).width;
  const pad = 6 * s;

  // 标签背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(cx - textWidth / 2 - pad, y - 8 * s, textWidth + pad * 2, 16 * s, 4 * s);
  ctx.fill();

  // 标签边框
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.roundRect(cx - textWidth / 2 - pad, y - 8 * s, textWidth + pad * 2, 16 * s, 4 * s);
  ctx.stroke();

  // 文字
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(name, cx, y);
}

/** 未知武将占位立绘 */
function drawUnknownPortrait(dc: DrawContext): void {
  const { ctx, x, y, width, height } = dc;
  const cx = x + width / 2;
  const cy = y + height / 2;

  ctx.save();
  ctx.fillStyle = '#424242';
  ctx.beginPath();
  ctx.roundRect(cx - 20, cy - 20, 40, 40, 8);
  ctx.fill();
  ctx.fillStyle = '#9E9E9E';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// 批量绘制工具
// ═══════════════════════════════════════════════════════════════

/**
 * 获取所有武将立绘配置
 */
export function getAllGeneralPortraits(): GeneralPortraitDef[] {
  return Object.values(GENERAL_PORTRAITS);
}

/**
 * 获取指定武将立绘配置
 */
export function getGeneralPortrait(id: string): GeneralPortraitDef | undefined {
  return GENERAL_PORTRAITS[id];
}

/**
 * 将武将立绘绘制到离屏 Canvas 并返回 data URL
 */
export function renderGeneralToDataURL(generalId: string, size: number = 200): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  drawGeneralPortrait({ ctx, x: 0, y: 0, width: size, height: size }, generalId);
  return canvas.toDataURL();
}
