/**
 * P1 错误防护 + 空数据防护 测试
 *
 * 验证：
 * - P1-01~03: 核心 Tab try/catch 防护
 * - P1-04~06: 功能面板数据刷新
 * - P1-07~08: 空数据/null/undefined 防护
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EquipmentBag } from '../EquipmentBag';
import { ArenaPanel } from '../ArenaPanel';
import type { EquipmentInstance } from '../../../../core/equipment/equipment.types';
import type { ArenaPlayerState, SeasonData } from '../../../../core/pvp/pvp.types';

// ── Fixtures ──

const createEquip = (overrides: Partial<EquipmentInstance> = {}): EquipmentInstance => ({
  uid: 'e1',
  templateId: 't1',
  name: '青龙偃月刀',
  slot: 'weapon',
  rarity: 'purple',
  enhanceLevel: 5,
  mainStat: { type: 'attack', baseValue: 100, value: 150 },
  subStats: [{ type: 'critRate', baseValue: 5, value: 8 }],
  specialEffect: null,
  source: 'campaign_drop',
  acquiredAt: Date.now(),
  isEquipped: false,
  equippedHeroId: null,
  seed: 12345,
  ...overrides,
});

const mockPlayerState: ArenaPlayerState = {
  score: 1200,
  rankId: 'SILVER_I',
  ranking: 12,
  dailyChallengesLeft: 3,
  dailyBoughtChallenges: 1,
  dailyManualRefreshes: 0,
  lastFreeRefreshTime: 0,
  opponents: [{
    playerId: 'p2',
    playerName: '曹操',
    power: 8000,
    rankId: 'GOLD_III',
    score: 1500,
    ranking: 5,
    faction: 'wei',
    defenseSnapshot: null,
  }],
  defenseFormation: {
    slots: ['', '', '', '', ''],
    formation: 'FISH_SCALE' as any,
    strategy: 'BALANCED' as any,
  },
  defenseLogs: [],
  replays: [],
  arenaCoins: 500,
};

// ── P1-04: EquipmentBag try/catch 防护 ──

describe('P1-04 EquipmentBag 错误防护', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('穿戴操作抛出异常时不崩溃', () => {
    const onEquip = vi.fn(() => { throw new Error('穿戴失败'); });
    const equip = createEquip({ isEquipped: false });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EquipmentBag equipments={[equip]} onEquip={onEquip} />);
    fireEvent.click(screen.getByText('穿戴'));

    expect(onEquip).toHaveBeenCalledWith('e1');
    expect(consoleSpy).toHaveBeenCalledWith('装备穿戴失败:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('卸下操作抛出异常时不崩溃', () => {
    const onUnequip = vi.fn(() => { throw new Error('卸下失败'); });
    const equip = createEquip({ isEquipped: true, equippedHeroId: 'h1' });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EquipmentBag equipments={[equip]} onUnequip={onUnequip} />);
    fireEvent.click(screen.getByText('卸下'));

    expect(onUnequip).toHaveBeenCalledWith('e1');
    expect(consoleSpy).toHaveBeenCalledWith('装备卸下失败:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('equipments 为 undefined 时使用空列表', () => {
    render(<EquipmentBag />);
    expect(screen.getByText('暂无装备')).toBeInTheDocument();
  });
});

// ── P1-05: ArenaPanel try/catch 防护 ──

describe('P1-05 ArenaPanel 错误防护', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('挑战操作抛出异常时不崩溃', async () => {
    const onChallenge = vi.fn(() => { throw new Error('挑战失败'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} onChallenge={onChallenge} />);
    fireEvent.click(screen.getByText('挑战'));

    // 等待防抖
    await new Promise((r) => setTimeout(r, 600));

    expect(onChallenge).toHaveBeenCalledWith('p2');
    expect(consoleSpy).toHaveBeenCalledWith('竞技场挑战失败:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('opponents 为 undefined 时显示空提示', () => {
    const state = { ...mockPlayerState, opponents: undefined as any };
    render(<ArenaPanel playerState={state} seasonData={null} />);
    expect(screen.getByText('暂无对手，请刷新')).toBeInTheDocument();
  });

  it('arenaCoins 为 undefined 时显示 0', () => {
    const state = { ...mockPlayerState, arenaCoins: undefined as any };
    render(<ArenaPanel playerState={state} seasonData={null} />);
    expect(screen.getByText(/竞技币：0/)).toBeInTheDocument();
  });

  it('dailyChallengesLeft 为 undefined 时显示 0', () => {
    const state = { ...mockPlayerState, dailyChallengesLeft: undefined as any };
    render(<ArenaPanel playerState={state} seasonData={null} />);
    expect(screen.getByText(/剩余 0 次/)).toBeInTheDocument();
  });

  it('dailyBoughtChallenges 为 undefined 时不崩溃', () => {
    const state = { ...mockPlayerState, dailyBoughtChallenges: undefined as any };
    render(<ArenaPanel playerState={state} seasonData={null} />);
    expect(screen.getByRole('region', { name: '竞技场' })).toBeInTheDocument();
  });
});
