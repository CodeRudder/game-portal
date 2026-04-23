/**
 * 关卡配置测试 — 碎片映射
 *
 * 验证 campaign-config.ts 中各关卡碎片掉落武将ID映射。
 * 从 campaign-config.test.ts 拆分，降低单文件行数。
 */

import {
  ALL_CHAPTERS,
  CHAPTER_1,
  CHAPTER_2,
  CHAPTER_3,
  CHAPTER_4,
  CHAPTER_5,
  CHAPTER_6,
  getStage,
} from '../campaign-config';

// ─────────────────────────────────────────────
// 碎片映射验证（Play v3.0 §4.3a）
// ─────────────────────────────────────────────

describe('campaign-config 碎片映射（Play v3.0 §4.3a）', () => {
  /** 获取关卡的碎片掉落武将ID列表 */
  function getFragmentGeneralIds(stageId: string): string[] {
    const stage = getStage(stageId);
    if (!stage) return [];
    return stage.dropTable
      .filter((d) => d.type === 'fragment' && d.generalId)
      .map((d) => d.generalId!);
  }

  it('1-1 张角 → 张角碎片', () => {
    const ids = getFragmentGeneralIds('chapter1_stage1');
    expect(ids).toContain('zhangjiao');
  });

  it('1-2 程远志 → 张角碎片、程远志碎片', () => {
    const ids = getFragmentGeneralIds('chapter1_stage2');
    expect(ids).toContain('zhangjiao');
    expect(ids).toContain('chengyuanzhi');
  });

  it('1-3 邓茂 → 程远志碎片', () => {
    const ids = getFragmentGeneralIds('chapter1_stage3');
    expect(ids).toContain('chengyuanzhi');
  });

  it('1-4 卜巳 → 关羽碎片', () => {
    const ids = getFragmentGeneralIds('chapter1_stage4');
    expect(ids).toContain('guanyu');
  });

  it('1-5 张宝 → 关羽碎片、张角碎片', () => {
    const ids = getFragmentGeneralIds('chapter1_stage5');
    expect(ids).toContain('guanyu');
    expect(ids).toContain('zhangjiao');
  });

  it('2-1 董卓 → 董卓碎片', () => {
    const ids = getFragmentGeneralIds('chapter2_stage1');
    expect(ids).toContain('dongzhuo');
  });

  it('2-2 华雄 → 董卓碎片、华雄碎片', () => {
    const ids = getFragmentGeneralIds('chapter2_stage2');
    expect(ids).toContain('dongzhuo');
    expect(ids).toContain('huaxiong');
  });

  it('2-3 李傕 → 赵云碎片', () => {
    const ids = getFragmentGeneralIds('chapter2_stage3');
    expect(ids).toContain('zhaoyun');
  });

  it('2-4 郭汜 → 赵云碎片、华雄碎片', () => {
    const ids = getFragmentGeneralIds('chapter2_stage4');
    expect(ids).toContain('zhaoyun');
    expect(ids).toContain('huaxiong');
  });

  it('2-5 吕布 → 吕布碎片', () => {
    const ids = getFragmentGeneralIds('chapter2_stage5');
    expect(ids).toContain('lvbu');
  });

  it('3-1 颜良 → 曹操碎片', () => {
    const ids = getFragmentGeneralIds('chapter3_stage1');
    expect(ids).toContain('caocao');
  });

  it('3-2 文丑 → 曹操碎片、颜良碎片', () => {
    const ids = getFragmentGeneralIds('chapter3_stage2');
    expect(ids).toContain('caocao');
    expect(ids).toContain('yanliang');
  });

  it('3-3 张郃 → 诸葛亮碎片', () => {
    const ids = getFragmentGeneralIds('chapter3_stage3');
    expect(ids).toContain('zhugeliang');
  });

  it('3-4 高览 → 诸葛亮碎片、张郃碎片', () => {
    const ids = getFragmentGeneralIds('chapter3_stage4');
    expect(ids).toContain('zhugeliang');
    expect(ids).toContain('zhanghe');
  });

  it('3-5 袁绍 → 曹操碎片、袁绍碎片', () => {
    const ids = getFragmentGeneralIds('chapter3_stage5');
    expect(ids).toContain('caocao');
    expect(ids).toContain('yuanshao');
  });

  it('4-1 蔡瑁 → 周瑜碎片', () => {
    const ids = getFragmentGeneralIds('chapter4_stage1');
    expect(ids).toContain('zhouyu');
  });

  it('4-2 张允 → 周瑜碎片、蔡瑁碎片', () => {
    const ids = getFragmentGeneralIds('chapter4_stage2');
    expect(ids).toContain('zhouyu');
    expect(ids).toContain('caimao');
  });

  it('4-3 黄盖 → 孙权碎片', () => {
    const ids = getFragmentGeneralIds('chapter4_stage3');
    expect(ids).toContain('sunquan');
  });

  it('4-4 甘宁 → 孙权碎片、黄盖碎片', () => {
    const ids = getFragmentGeneralIds('chapter4_stage4');
    expect(ids).toContain('sunquan');
    expect(ids).toContain('huanggai');
  });

  it('4-5 曹操·赤壁 → 周瑜碎片、孙权碎片', () => {
    const ids = getFragmentGeneralIds('chapter4_stage5');
    expect(ids).toContain('zhouyu');
    expect(ids).toContain('sunquan');
  });

  it('5-1 夏侯惇 → 刘备碎片', () => {
    const ids = getFragmentGeneralIds('chapter5_stage1');
    expect(ids).toContain('liubei');
  });

  it('5-2 夏侯渊 → 刘备碎片、夏侯惇碎片', () => {
    const ids = getFragmentGeneralIds('chapter5_stage2');
    expect(ids).toContain('liubei');
    expect(ids).toContain('xiaohoudun');
  });

  it('5-3 张辽 → 司马懿碎片', () => {
    const ids = getFragmentGeneralIds('chapter5_stage3');
    expect(ids).toContain('simayi');
  });

  it('5-4 徐晃 → 司马懿碎片、张辽碎片', () => {
    const ids = getFragmentGeneralIds('chapter5_stage4');
    expect(ids).toContain('simayi');
    expect(ids).toContain('zhangliao');
  });

  it('5-5 曹丕 → 刘备碎片、司马懿碎片', () => {
    const ids = getFragmentGeneralIds('chapter5_stage5');
    expect(ids).toContain('liubei');
    expect(ids).toContain('simayi');
  });

  it('6-1 魏延 → 关羽碎片、赵云碎片', () => {
    const ids = getFragmentGeneralIds('chapter6_stage1');
    expect(ids).toContain('guanyu');
    expect(ids).toContain('zhaoyun');
  });

  it('6-2 姜维 → 诸葛亮碎片、吕布碎片', () => {
    const ids = getFragmentGeneralIds('chapter6_stage2');
    expect(ids).toContain('zhugeliang');
    expect(ids).toContain('lvbu');
  });

  it('6-3 陆逊 → 周瑜碎片、孙权碎片', () => {
    const ids = getFragmentGeneralIds('chapter6_stage3');
    expect(ids).toContain('zhouyu');
    expect(ids).toContain('sunquan');
  });

  it('6-4 司马师 → 曹操碎片、司马懿碎片', () => {
    const ids = getFragmentGeneralIds('chapter6_stage4');
    expect(ids).toContain('caocao');
    expect(ids).toContain('simayi');
  });

  it('6-5 司马炎·终局 → 全武将碎片随机', () => {
    const ids = getFragmentGeneralIds('chapter6_stage5');
    // 终局关应有多个不同武将碎片
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });
});
