/**
 * F05 商店系统 P0-1修复测试
 *
 * 覆盖：
 * - Tab标签与ShopType语义匹配验证
 */

import { SHOP_TYPE_LABELS, SHOP_TYPES, type ShopType } from '../../../core/shop/shop.types';

describe('P0-1: 商店Tab标签与ShopType语义匹配', () => {
  it('normal类型标签为"集市"', () => {
    expect(SHOP_TYPE_LABELS.normal).toBe('集市');
  });

  it('black_market类型标签为"黑市"（非"竞技商店"）', () => {
    expect(SHOP_TYPE_LABELS.black_market).toBe('黑市');
    expect(SHOP_TYPE_LABELS.black_market).not.toBe('竞技商店');
  });

  it('limited_time类型标签为"限时特惠"（非"远征商店"）', () => {
    expect(SHOP_TYPE_LABELS.limited_time).toBe('限时特惠');
    expect(SHOP_TYPE_LABELS.limited_time).not.toBe('远征商店');
  });

  it('vip类型标签为"VIP商店"（非"联盟商店"）', () => {
    expect(SHOP_TYPE_LABELS.vip).toBe('VIP商店');
    expect(SHOP_TYPE_LABELS.vip).not.toBe('联盟商店');
  });

  it('所有ShopType都有对应标签', () => {
    for (const st of SHOP_TYPES) {
      expect(SHOP_TYPE_LABELS[st]).toBeDefined();
      expect(SHOP_TYPE_LABELS[st].length).toBeGreaterThan(0);
    }
  });

  it('标签不含"竞技"或"远征"或"联盟"的错误映射', () => {
    // 确保没有错误的映射关系
    expect(SHOP_TYPE_LABELS.black_market).not.toContain('竞技');
    expect(SHOP_TYPE_LABELS.limited_time).not.toContain('远征');
    expect(SHOP_TYPE_LABELS.vip).not.toContain('联盟');
  });
});
