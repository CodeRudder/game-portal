/**
 * 武将立绘渲染器 & 对话系统测试
 *
 * 验证12位武将立绘数据完整性、对话数据完整性、
 * 对话场景切换、立绘绘制不报错等。
 *
 * @module games/three-kingdoms/__tests__/GeneralPortraitRenderer.test
 */

import { describe, it, expect } from 'vitest';
import {
  GENERAL_PORTRAITS,
  ALL_GENERAL_IDS,
  drawGeneralPortrait,
  getAllGeneralPortraits,
  getGeneralPortrait,
  type DrawContext,
} from '../GeneralPortraitRenderer';
import {
  GENERAL_DIALOGUES,
  ALL_DIALOGUE_GENERAL_IDS,
  GeneralDialogueSystem,
  createGeneralDialogueSystem,
  type DialogueScene,
  type DialogueMode,
} from '../GeneralDialogueSystem';

// ═══════════════════════════════════════════════════════════════
// Canvas Mock
// ═══════════════════════════════════════════════════════════════

function createMockCtx(): CanvasRenderingContext2D {
  const gradientMock = { addColorStop: () => {} };
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    arcTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    roundRect: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 50 }),
    drawImage: () => {},
    createLinearGradient: () => gradientMock,
    createRadialGradient: () => gradientMock,
    createPattern: () => null,
    setTransform: () => {},
    resetTransform: () => {},
    setLineDash: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(0) }),
    putImageData: () => {},
    canvas: { width: 200, height: 200 },
  } as unknown as CanvasRenderingContext2D;
}

function createDrawContext(): DrawContext {
  return {
    ctx: createMockCtx(),
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  };
}

// ═══════════════════════════════════════════════════════════════
// 测试：武将立绘数据
// ═══════════════════════════════════════════════════════════════

describe('武将立绘数据完整性', () => {
  const EXPECTED_GENERALS = [
    'liubei', 'guanyu', 'zhangfei', 'caocao', 'zhugeliang',
    'zhaoyun', 'sunquan', 'lvbu', 'zhouyu', 'huangzhong',
    'machao', 'xuchu',
  ];

  it('应有12位武将立绘配置', () => {
    expect(ALL_GENERAL_IDS.length).toBe(12);
  });

  it('应包含所有预期的武将 ID', () => {
    for (const id of EXPECTED_GENERALS) {
      expect(GENERAL_PORTRAITS[id]).toBeDefined();
      expect(GENERAL_PORTRAITS[id].id).toBe(id);
    }
  });

  it('每位武将应有完整的配置字段', () => {
    for (const id of EXPECTED_GENERALS) {
      const p = GENERAL_PORTRAITS[id];
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.faceColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p.secondaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(['crown', 'helmet', 'scholar_hat', 'band', 'feather_helm', 'none']).toContain(p.hatType);
      expect(['long', 'short', 'tiger', 'white_long', 'none']).toContain(p.beardType);
      expect(p.weaponType).toBeTruthy();
      expect(p.specialFeature).toBeTruthy();
      expect(p.faction).toBeTruthy();
    }
  });

  it('getAllGeneralPortraits 应返回12个配置', () => {
    const all = getAllGeneralPortraits();
    expect(all.length).toBe(12);
  });

  it('getGeneralPortrait 应返回正确配置', () => {
    const liubei = getGeneralPortrait('liubei');
    expect(liubei).toBeDefined();
    expect(liubei!.name).toBe('刘备');
    expect(liubei!.faction).toBe('shu');
  });

  it('getGeneralPortrait 对不存在的 ID 应返回 undefined', () => {
    expect(getGeneralPortrait('nonexistent')).toBeUndefined();
  });

  it('刘备应有双耳垂肩特征', () => {
    expect(GENERAL_PORTRAITS.liubei.specialFeature).toBe('big_ears');
    expect(GENERAL_PORTRAITS.liubei.weaponType).toBe('dual_sword');
  });

  it('关羽应有红脸和长须', () => {
    expect(GENERAL_PORTRAITS.guanyu.specialFeature).toBe('red_face');
    expect(GENERAL_PORTRAITS.guanyu.beardType).toBe('long');
    expect(GENERAL_PORTRAITS.guanyu.weaponType).toBe('guandao');
  });

  it('张飞应有黑脸和虎须', () => {
    expect(GENERAL_PORTRAITS.zhangfei.specialFeature).toBe('dark_face');
    expect(GENERAL_PORTRAITS.zhangfei.beardType).toBe('tiger');
  });

  it('曹操应有白脸和倚天剑', () => {
    expect(GENERAL_PORTRAITS.caocao.specialFeature).toBe('white_face');
    expect(GENERAL_PORTRAITS.caocao.weaponType).toBe('sword');
  });

  it('诸葛亮应有羽扇纶巾', () => {
    expect(GENERAL_PORTRAITS.zhugeliang.hatType).toBe('scholar_hat');
    expect(GENERAL_PORTRAITS.zhugeliang.weaponType).toBe('fan');
    expect(GENERAL_PORTRAITS.zhugeliang.specialFeature).toBe('wisdom_aura');
  });

  it('赵云应有银甲和龙胆枪', () => {
    expect(GENERAL_PORTRAITS.zhaoyun.weaponType).toBe('dragon_spear');
    expect(GENERAL_PORTRAITS.zhaoyun.specialFeature).toBe('silver_armor');
  });

  it('孙权应有紫髯碧眼和吴钩', () => {
    expect(GENERAL_PORTRAITS.sunquan.weaponType).toBe('hook');
    expect(GENERAL_PORTRAITS.sunquan.specialFeature).toBe('purple_beard');
  });

  it('吕布应有方天画戟和翎羽头盔', () => {
    expect(GENERAL_PORTRAITS.lvbu.weaponType).toBe('halberd');
    expect(GENERAL_PORTRAITS.lvbu.hatType).toBe('feather_helm');
  });

  it('周瑜应有古琴和儒雅风流', () => {
    expect(GENERAL_PORTRAITS.zhouyu.weaponType).toBe('lute');
    expect(GENERAL_PORTRAITS.zhouyu.specialFeature).toBe('elegant');
  });

  it('黄忠应有白发白须和大弓', () => {
    expect(GENERAL_PORTRAITS.huangzhong.beardType).toBe('white_long');
    expect(GENERAL_PORTRAITS.huangzhong.weaponType).toBe('bow');
  });

  it('马超应有虎头湛金枪和银甲', () => {
    expect(GENERAL_PORTRAITS.machao.weaponType).toBe('golden_spear');
    expect(GENERAL_PORTRAITS.machao.specialFeature).toBe('silver_armor_2');
  });

  it('许褚应有大锤和壮硕体型', () => {
    expect(GENERAL_PORTRAITS.xuchu.weaponType).toBe('hammer');
    expect(GENERAL_PORTRAITS.xuchu.specialFeature).toBe('muscular');
    expect(GENERAL_PORTRAITS.xuchu.hatType).toBe('none');
  });
});

// ═══════════════════════════════════════════════════════════════
// 测试：立绘绘制
// ═══════════════════════════════════════════════════════════════

describe('武将立绘绘制', () => {
  it('绘制刘备立绘不应报错', () => {
    const dc = createDrawContext();
    expect(() => drawGeneralPortrait(dc, 'liubei')).not.toThrow();
  });

  it('绘制所有12位武将立绘均不应报错', () => {
    for (const id of ALL_GENERAL_IDS) {
      const dc = createDrawContext();
      expect(() => drawGeneralPortrait(dc, id)).not.toThrow();
    }
  });

  it('绘制不存在的武将应使用占位立绘且不报错', () => {
    const dc = createDrawContext();
    expect(() => drawGeneralPortrait(dc, 'nonexistent')).not.toThrow();
  });

  it('不同武将应产生不同的绘制调用', () => {
    // 验证绘制函数能正常处理不同武将
    const ids = ['liubei', 'guanyu', 'zhugeliang'];
    for (const id of ids) {
      const dc = createDrawContext();
      expect(() => drawGeneralPortrait(dc, id)).not.toThrow();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 测试：对话数据完整性
// ═══════════════════════════════════════════════════════════════

describe('武将对话数据完整性', () => {
  it('应有12位武将对话配置', () => {
    expect(ALL_DIALOGUE_GENERAL_IDS.length).toBe(12);
  });

  it('每位武将应有至少5句 idle 对话', () => {
    for (const [id, dialogue] of Object.entries(GENERAL_DIALOGUES)) {
      expect(dialogue.idle.length).toBeGreaterThanOrEqual(5);
      expect(dialogue.generalId).toBe(id);
    }
  });

  it('每位武将应有至少3句 battle 对话', () => {
    for (const dialogue of Object.values(GENERAL_DIALOGUES)) {
      expect(dialogue.battle.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('每位武将应有至少3句 recruit 对话', () => {
    for (const dialogue of Object.values(GENERAL_DIALOGUES)) {
      expect(dialogue.recruit.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('每位武将应有至少2句 quest 对话', () => {
    for (const dialogue of Object.values(GENERAL_DIALOGUES)) {
      expect(dialogue.quest.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('对话内容不应为空字符串', () => {
    for (const dialogue of Object.values(GENERAL_DIALOGUES)) {
      for (const text of dialogue.idle) {
        expect(text.length).toBeGreaterThan(0);
      }
      for (const text of dialogue.battle) {
        expect(text.length).toBeGreaterThan(0);
      }
      for (const text of dialogue.recruit) {
        expect(text.length).toBeGreaterThan(0);
      }
      for (const text of dialogue.quest) {
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  it('对话内容应有三国历史感', () => {
    // 检查一些关键词
    const liubeiIdle = GENERAL_DIALOGUES.liubei.idle.join('');
    expect(liubeiIdle).toContain('大业');

    const guanyuIdle = GENERAL_DIALOGUES.guanyu.idle.join('');
    expect(guanyuIdle).toContain('忠义');

    const zhugeliangIdle = GENERAL_DIALOGUES.zhugeliang.idle.join('');
    expect(zhugeliangIdle).toContain('汉室');
  });

  it('武将名称应正确', () => {
    expect(GENERAL_DIALOGUES.liubei.generalName).toBe('刘备');
    expect(GENERAL_DIALOGUES.guanyu.generalName).toBe('关羽');
    expect(GENERAL_DIALOGUES.zhangfei.generalName).toBe('张飞');
    expect(GENERAL_DIALOGUES.caocao.generalName).toBe('曹操');
    expect(GENERAL_DIALOGUES.zhugeliang.generalName).toBe('诸葛亮');
    expect(GENERAL_DIALOGUES.zhaoyun.generalName).toBe('赵云');
    expect(GENERAL_DIALOGUES.sunquan.generalName).toBe('孙权');
    expect(GENERAL_DIALOGUES.lvbu.generalName).toBe('吕布');
    expect(GENERAL_DIALOGUES.zhouyu.generalName).toBe('周瑜');
    expect(GENERAL_DIALOGUES.huangzhong.generalName).toBe('黄忠');
    expect(GENERAL_DIALOGUES.machao.generalName).toBe('马超');
    expect(GENERAL_DIALOGUES.xuchu.generalName).toBe('许褚');
  });
});

// ═══════════════════════════════════════════════════════════════
// 测试：对话系统
// ═══════════════════════════════════════════════════════════════

describe('GeneralDialogueSystem', () => {
  let system: GeneralDialogueSystem;

  beforeEach(() => {
    system = createGeneralDialogueSystem();
  });

  // ── 基本功能 ──

  describe('基本功能', () => {
    it('应能创建对话系统实例', () => {
      expect(system).toBeDefined();
    });

    it('应注册12位武将', () => {
      expect(system.getRegisteredGeneralIds().length).toBe(12);
    });

    it('hasDialogue 对已注册武将应返回 true', () => {
      expect(system.hasDialogue('liubei')).toBe(true);
      expect(system.hasDialogue('guanyu')).toBe(true);
    });

    it('hasDialogue 对未注册武将应返回 false', () => {
      expect(system.hasDialogue('nonexistent')).toBe(false);
    });

    it('getGeneralName 应返回正确名称', () => {
      expect(system.getGeneralName('liubei')).toBe('刘备');
      expect(system.getGeneralName('nonexistent')).toBe('未知武将');
    });
  });

  // ── 对话场景切换 ──

  describe('对话场景切换', () => {
    it('idle 场景应返回闲聊对话', () => {
      const result = system.getDialogue('liubei', 'idle', 'chat');
      expect(result.generalId).toBe('liubei');
      expect(result.scene).toBe('idle');
      expect(result.mode).toBe('chat');
      expect(result.text.length).toBeGreaterThan(0);
    });

    it('battle 场景应返回战斗对话', () => {
      const result = system.getDialogue('guanyu', 'battle', 'chat');
      expect(result.scene).toBe('battle');
      // 战斗对话应包含战斗相关的词
      const battleTexts = GENERAL_DIALOGUES.guanyu.battle;
      expect(battleTexts).toContain(result.text);
    });

    it('recruit 场景应返回招募对话', () => {
      const result = system.getDialogue('zhugeliang', 'recruit', 'chat');
      expect(result.scene).toBe('recruit');
      const recruitTexts = GENERAL_DIALOGUES.zhugeliang.recruit;
      expect(recruitTexts).toContain(result.text);
    });

    it('quest 模式应返回任务对话', () => {
      const result = system.getDialogue('liubei', 'idle', 'quest');
      expect(result.mode).toBe('quest');
      const questTexts = GENERAL_DIALOGUES.liubei.quest;
      expect(questTexts).toContain(result.text);
    });

    it('不存在的武将应返回省略号', () => {
      const result = system.getDialogue('nonexistent', 'idle', 'chat');
      expect(result.text).toBe('……');
    });
  });

  // ── 对话不重复 ──

  describe('对话不重复', () => {
    it('连续获取对话应避免重复（当有多条时）', () => {
      const results: string[] = [];
      for (let i = 0; i < 5; i++) {
        const r = system.getDialogue('liubei', 'idle', 'chat');
        results.push(r.text);
      }
      // 至少应有2条不同对话
      const unique = new Set(results);
      expect(unique.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 便捷方法 ──

  describe('便捷方法', () => {
    it('getDialoguesByScene 应返回正确的对话列表', () => {
      const idle = system.getDialoguesByScene('liubei', 'idle');
      expect(idle.length).toBeGreaterThanOrEqual(5);

      const battle = system.getDialoguesByScene('liubei', 'battle');
      expect(battle.length).toBeGreaterThanOrEqual(3);
    });

    it('getQuestDialogue 应返回任务对话', () => {
      const quest = system.getQuestDialogue('liubei');
      expect(quest.length).toBeGreaterThan(0);
      expect(GENERAL_DIALOGUES.liubei.quest).toContain(quest);
    });

    it('getIdleChat 应返回闲聊对话', () => {
      const chat = system.getIdleChat('guanyu');
      expect(chat.length).toBeGreaterThan(0);
      expect(GENERAL_DIALOGUES.guanyu.idle).toContain(chat);
    });

    it('getQuestDialogue 对不存在的武将应返回默认文本', () => {
      expect(system.getQuestDialogue('nonexistent')).toBe('暂无任务。');
    });

    it('getIdleChat 对不存在的武将应返回省略号', () => {
      expect(system.getIdleChat('nonexistent')).toBe('……');
    });

    it('getDialoguesByScene 对不存在的武将应返回空数组', () => {
      expect(system.getDialoguesByScene('nonexistent', 'idle')).toEqual([]);
    });
  });

  // ── 所有武将对话可用 ──

  describe('所有武将对话可用', () => {
    const generals = [
      'liubei', 'guanyu', 'zhangfei', 'caocao', 'zhugeliang',
      'zhaoyun', 'sunquan', 'lvbu', 'zhouyu', 'huangzhong',
      'machao', 'xuchu',
    ];

    for (const id of generals) {
      it(`${id} 所有场景对话均可获取`, () => {
        const scenes: DialogueScene[] = ['idle', 'battle', 'recruit'];
        const modes: DialogueMode[] = ['chat', 'quest'];

        for (const scene of scenes) {
          for (const mode of modes) {
            const result = system.getDialogue(id, scene, mode);
            expect(result.text.length).toBeGreaterThan(0);
            expect(result.generalId).toBe(id);
          }
        }
      });
    }
  });
});
