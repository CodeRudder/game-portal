/**
 * R14→R16 Task2: InjuryLevel enum mapping integration tests
 *
 * Verifies:
 * - mapInjuryLevel: engine InjuryLevel → UI injuryLevel mapping (shared config)
 * - mapInjuryData: CasualtyResult → injuryData prop mapping
 * - mapTroopLoss: CasualtyResult → troopLoss prop mapping
 * - WorldMapTab passes injuryData/troopLoss to SiegeResultModal
 * - No injury case: injuryData=undefined, troopLoss=undefined
 * - R16: mapInjuryLevel and INJURY_RECOVERY_HOURS are imported from shared engine config
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  mapInjuryLevel as sharedMapInjuryLevel,
  INJURY_RECOVERY_HOURS,
  INJURY_RECOVERY_TIME,
} from '@/games/three-kingdoms/engine/map/expedition-types';
import type { CasualtyResult } from '@/games/three-kingdoms/engine/map/expedition-types';
import {
  mapInjuryLevel,
  mapInjuryData,
  mapTroopLoss,
} from '../WorldMapTab';

// ─────────────────────────────────────────────
// mapInjuryLevel unit tests
// ─────────────────────────────────────────────

describe('R14: mapInjuryLevel — engine → UI enum mapping', () => {
  it('minor → light', () => {
    expect(mapInjuryLevel('minor')).toBe('light');
  });

  it('moderate → medium', () => {
    expect(mapInjuryLevel('moderate')).toBe('medium');
  });

  it('severe → severe', () => {
    expect(mapInjuryLevel('severe')).toBe('severe');
  });

  it('none → none', () => {
    expect(mapInjuryLevel('none')).toBe('none');
  });
});

// ─────────────────────────────────────────────
// R16: Shared config tests
// ─────────────────────────────────────────────

describe('R16: shared mapInjuryLevel from expedition-types', () => {
  it('shared function matches WorldMapTab re-export', () => {
    expect(sharedMapInjuryLevel('minor')).toBe(mapInjuryLevel('minor'));
    expect(sharedMapInjuryLevel('moderate')).toBe(mapInjuryLevel('moderate'));
    expect(sharedMapInjuryLevel('severe')).toBe(mapInjuryLevel('severe'));
    expect(sharedMapInjuryLevel('none')).toBe(mapInjuryLevel('none'));
  });
});

describe('R16: INJURY_RECOVERY_HOURS from shared config', () => {
  it('has correct hours for all UI levels', () => {
    expect(INJURY_RECOVERY_HOURS.none).toBe(0);
    expect(INJURY_RECOVERY_HOURS.light).toBe(0.5);
    expect(INJURY_RECOVERY_HOURS.medium).toBe(2);
    expect(INJURY_RECOVERY_HOURS.severe).toBe(6);
  });

  it('values are consistent with INJURY_RECOVERY_TIME in engine', () => {
    // INJURY_RECOVERY_TIME is in ms, INJURY_RECOVERY_HOURS is in hours
    // They should be consistent
    expect(INJURY_RECOVERY_HOURS.light).toBe(INJURY_RECOVERY_TIME.minor / (60 * 60 * 1000));
    expect(INJURY_RECOVERY_HOURS.medium).toBe(INJURY_RECOVERY_TIME.moderate / (60 * 60 * 1000));
    expect(INJURY_RECOVERY_HOURS.severe).toBe(INJURY_RECOVERY_TIME.severe / (60 * 60 * 1000));
  });

  it('mapInjuryData uses shared INJURY_RECOVERY_HOURS', () => {
    // Verify mapInjuryData recoveryHours match shared config
    const minorCasualties: CasualtyResult = {
      troopsLost: 50, troopsLostPercent: 0.1, heroInjured: true,
      injuryLevel: 'minor', battleResult: 'victory',
    };
    const result = mapInjuryData(minorCasualties, '测试');
    expect(result?.recoveryHours).toBe(INJURY_RECOVERY_HOURS.light);

    const severeCasualties: CasualtyResult = {
      troopsLost: 300, troopsLostPercent: 0.6, heroInjured: true,
      injuryLevel: 'severe', battleResult: 'defeat',
    };
    const result2 = mapInjuryData(severeCasualties, '测试');
    expect(result2?.recoveryHours).toBe(INJURY_RECOVERY_HOURS.severe);
  });
});

// ─────────────────────────────────────────────
// mapInjuryData unit tests
// ─────────────────────────────────────────────

describe('R14: mapInjuryData — CasualtyResult → injuryData', () => {
  it('minor injury maps to light with 0.5h recovery', () => {
    const casualties: CasualtyResult = {
      troopsLost: 50,
      troopsLostPercent: 0.1,
      heroInjured: true,
      injuryLevel: 'minor',
      battleResult: 'victory',
    };
    const result = mapInjuryData(casualties, '关羽');
    expect(result).toEqual({
      generalName: '关羽',
      injuryLevel: 'light',
      recoveryHours: 0.5,
    });
  });

  it('moderate injury maps to medium with 2h recovery', () => {
    const casualties: CasualtyResult = {
      troopsLost: 100,
      troopsLostPercent: 0.2,
      heroInjured: true,
      injuryLevel: 'moderate',
      battleResult: 'victory',
    };
    const result = mapInjuryData(casualties, '张飞');
    expect(result).toEqual({
      generalName: '张飞',
      injuryLevel: 'medium',
      recoveryHours: 2,
    });
  });

  it('severe injury maps to severe with 6h recovery', () => {
    const casualties: CasualtyResult = {
      troopsLost: 300,
      troopsLostPercent: 0.6,
      heroInjured: true,
      injuryLevel: 'severe',
      battleResult: 'defeat',
    };
    const result = mapInjuryData(casualties, '赵云');
    expect(result).toEqual({
      generalName: '赵云',
      injuryLevel: 'severe',
      recoveryHours: 6,
    });
  });

  it('no injury (heroInjured=false) returns undefined', () => {
    const casualties: CasualtyResult = {
      troopsLost: 10,
      troopsLostPercent: 0.02,
      heroInjured: false,
      injuryLevel: 'none',
      battleResult: 'victory',
    };
    expect(mapInjuryData(casualties, '诸葛亮')).toBeUndefined();
  });

  it('no injury (injuryLevel=none with heroInjured=true) returns undefined', () => {
    // Edge case: heroInjured=true but level=none
    const casualties: CasualtyResult = {
      troopsLost: 10,
      troopsLostPercent: 0.02,
      heroInjured: true,
      injuryLevel: 'none',
      battleResult: 'victory',
    };
    expect(mapInjuryData(casualties, '马超')).toBeUndefined();
  });

  it('undefined casualties returns undefined', () => {
    expect(mapInjuryData(undefined, '黄忠')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// mapTroopLoss unit tests
// ─────────────────────────────────────────────

describe('R14: mapTroopLoss — CasualtyResult → troopLoss', () => {
  it('maps casualties with losses', () => {
    const casualties: CasualtyResult = {
      troopsLost: 150,
      troopsLostPercent: 0.3,
      heroInjured: false,
      injuryLevel: 'none',
      battleResult: 'victory',
    };
    const result = mapTroopLoss(casualties, 500);
    expect(result).toEqual({ lost: 150, total: 500 });
  });

  it('returns undefined when troopsLost is 0', () => {
    const casualties: CasualtyResult = {
      troopsLost: 0,
      troopsLostPercent: 0,
      heroInjured: false,
      injuryLevel: 'none',
      battleResult: 'victory',
    };
    expect(mapTroopLoss(casualties, 500)).toBeUndefined();
  });

  it('returns undefined when totalTroops is 0', () => {
    const casualties: CasualtyResult = {
      troopsLost: 10,
      troopsLostPercent: 0.1,
      heroInjured: false,
      injuryLevel: 'none',
      battleResult: 'victory',
    };
    expect(mapTroopLoss(casualties, 0)).toBeUndefined();
  });

  it('returns undefined when casualties is undefined', () => {
    expect(mapTroopLoss(undefined, 500)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// Integration: SiegeResultModal receives mapped props
// ─────────────────────────────────────────────

import SiegeResultModal from '../SiegeResultModal';
import type { SiegeResultData } from '../SiegeResultModal';

// Mock CSS
vi.mock('../SiegeResultModal.css', () => ({}));
vi.mock('../../../common/Modal.css', () => ({}));

const makeVictoryWithCasualties = (
  injuryLevel: 'none' | 'minor' | 'moderate' | 'severe',
  heroInjured: boolean,
  troopsLost: number,
  troopsTotal: number,
): { result: SiegeResultData; generalName: string } => {
  const casualties: CasualtyResult = {
    troopsLost,
    troopsLostPercent: troopsTotal > 0 ? troopsLost / troopsTotal : 0,
    heroInjured,
    injuryLevel,
    battleResult: 'victory',
  };
  const generalName = '关羽';
  return {
    result: {
      launched: true,
      victory: true,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: troopsTotal, grain: 100 },
      casualties,
      heroInjured: heroInjured ? { heroId: 'hero-guanyu', injuryLevel } : undefined,
    },
    generalName,
  };
};

describe('R14: SiegeResultModal receives mapped injury/troopLoss props', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays injury section when engine reports minor injury', () => {
    const { result, generalName } = makeVictoryWithCasualties('minor', true, 50, 500);
    const injuryData = mapInjuryData(result.casualties, generalName);
    const troopLoss = mapTroopLoss(result.casualties!, result.cost.troops);

    render(
      <SiegeResultModal
        visible={true}
        result={result}
        injuryData={injuryData}
        troopLoss={troopLoss}
        onClose={vi.fn()}
      />
    );

    // Injury section visible
    const injurySection = screen.getByTestId('siege-injury-status-section');
    expect(injurySection).toBeTruthy();
    // General name
    const name = screen.getByTestId('siege-injury-general-name');
    expect(name.textContent).toBe('关羽');
    // Injury tag shows 轻伤 (light)
    const tag = screen.getByTestId('siege-injury-tag');
    expect(tag.textContent).toContain('轻伤');
    // Recovery time
    const recovery = screen.getByTestId('siege-injury-recovery');
    expect(recovery.textContent).toContain('0.5小时');
  });

  it('displays injury section when engine reports moderate injury', () => {
    const { result, generalName } = makeVictoryWithCasualties('moderate', true, 100, 500);
    const injuryData = mapInjuryData(result.casualties, generalName);
    const troopLoss = mapTroopLoss(result.casualties!, result.cost.troops);

    render(
      <SiegeResultModal
        visible={true}
        result={result}
        injuryData={injuryData}
        troopLoss={troopLoss}
        onClose={vi.fn()}
      />
    );

    const tag = screen.getByTestId('siege-injury-tag');
    expect(tag.textContent).toContain('中伤');
    const recovery = screen.getByTestId('siege-injury-recovery');
    expect(recovery.textContent).toContain('2小时');
  });

  it('displays injury section when engine reports severe injury', () => {
    const { result, generalName } = makeVictoryWithCasualties('severe', true, 300, 500);
    const injuryData = mapInjuryData(result.casualties, generalName);
    const troopLoss = mapTroopLoss(result.casualties!, result.cost.troops);

    render(
      <SiegeResultModal
        visible={true}
        result={result}
        injuryData={injuryData}
        troopLoss={troopLoss}
        onClose={vi.fn()}
      />
    );

    const tag = screen.getByTestId('siege-injury-tag');
    expect(tag.textContent).toContain('重伤');
    const recovery = screen.getByTestId('siege-injury-recovery');
    expect(recovery.textContent).toContain('6小时');
  });

  it('displays troop loss section with correct numbers', () => {
    const { result, generalName } = makeVictoryWithCasualties('minor', true, 150, 500);
    const injuryData = mapInjuryData(result.casualties, generalName);
    const troopLoss = mapTroopLoss(result.casualties!, result.cost.troops);

    render(
      <SiegeResultModal
        visible={true}
        result={result}
        injuryData={injuryData}
        troopLoss={troopLoss}
        onClose={vi.fn()}
      />
    );

    const troopLossSection = screen.getByTestId('siege-troop-loss-section');
    expect(troopLossSection).toBeTruthy();
    const count = screen.getByTestId('siege-troop-loss-count');
    expect(count.textContent).toBe('150');
    const percent = screen.getByTestId('siege-troop-loss-percent');
    expect(percent.textContent).toContain('30.0%');
  });

  it('no injury case: injuryData=undefined, no injury section shown', () => {
    const { result, generalName } = makeVictoryWithCasualties('none', false, 10, 500);
    const injuryData = mapInjuryData(result.casualties, generalName);

    render(
      <SiegeResultModal
        visible={true}
        result={result}
        injuryData={injuryData}
        onClose={vi.fn()}
      />
    );

    // No injury section
    expect(screen.queryByTestId('siege-injury-status-section')).toBeNull();
    expect(screen.queryByTestId('siege-injury-tag')).toBeNull();
  });

  it('no casualties: both injuryData and troopLoss undefined', () => {
    const result: SiegeResultData = {
      launched: true,
      victory: true,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: 500, grain: 100 },
    };

    render(
      <SiegeResultModal
        visible={true}
        result={result}
        injuryData={undefined}
        troopLoss={undefined}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId('siege-injury-status-section')).toBeNull();
    expect(screen.queryByTestId('siege-troop-loss-section')).toBeNull();
  });

  it('backward compatible: existing modal without new props still works', () => {
    const result: SiegeResultData = {
      launched: true,
      victory: true,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: 500, grain: 100 },
    };

    render(
      <SiegeResultModal
        visible={true}
        result={result}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('siege-result-modal')).toBeTruthy();
    expect(screen.getByText(/攻城大捷/)).toBeTruthy();
  });
});
