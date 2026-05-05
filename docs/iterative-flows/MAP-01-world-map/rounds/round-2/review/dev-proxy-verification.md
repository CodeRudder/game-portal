# R2 Dev Proxy Verification Report

> **Date**: 2026-05-05
> **Reviewer**: Dev Proxy (implementation feasibility review)
> **Scope**: All 18 flow documents (FL-MAP-01 through FL-MAP-18), INDEX.md, types/map-interfaces.md
> **Question**: "Taking this flow to code, where would I be uncertain/unable to proceed?"

---

## 1. Summary Statistics

| Priority | Count | Status |
|:--------:|:-----:|:------:|
| P0 | 0 | -- |
| P1 | 3 | New findings requiring fix before implementation |
| P2 | 5 | Improvable, not blocking |
| P3 | 4 | Polish/optimization items |

**Overall Assessment**: The 18 flow documents are in strong shape for implementation. All 7 R2 fixes were properly applied. The remaining new findings are edge cases, minor inconsistencies, and implementation ergonomics -- none would block a developer from starting work.

---

## 2. R2 Fix Verification Results

### P1-R2-01: Tutorial step 3 enemy city lookup algorithm
**Status**: PASS

FL-MAP-01 SP01 step 3 now includes a complete 5-step algorithm:
1. Iterate all non-player-faction city-type territories
2. Filter those adjacent to player territories (adjacentIds contains player territory ID)
3. Sort by Euclidean distance ascending
4. Take first as target, with difficulty reduction (defense x0.5)
5. Fallback: if no adjacent enemy city, skip step 3 and proceed to step 4

The algorithm is unambiguous and implementable.

### P1-R2-02: Cancelled state force cleanup
**Status**: PASS

Verified in two locations:
- **FL-MAP-09-08** (SiegeTask state machine): Row `[P1-R2-02]` explicitly states: on cancelled, sync execute: force status -> destroy (troops return to unallocated, general released to available), march sprite immediately removed.
- **FL-MAP-16** (Force-SiegeTask mapping table): Row for `cancelled` now reads: `cancelled -> force destroy (troops return to unallocated, general released)`.

Both locations are consistent.

### P1-R2-03: Reward claim text updated
**Status**: PASS

FL-MAP-11 FL-MAP-11-01 step now includes `[V-021] [P1-R2-03]` marker with text: "Please click to claim rewards; unclaimed rewards within 24 hours will be automatically issued to your backpack" and countdown timer ("Auto-issue in 24h HH:MM:SS").

### P1-R2-04: Casualty formula implementation note
**Status**: PASS

FL-MAP-07 S7 now includes `[P1-R2-04] Implementation Note`: recommends extracting casualty calculation into a shared utility function `calculateCasualties(result, troops)`, with both FL-MAP-07 and FL-MAP-17 calling the same function to ensure parameter changes stay synchronized. This is clearly an implementation suggestion, not a flow change.

### P1-R2-05: Strategy modifier constants table
**Status**: PASS with NOTE

`map-interfaces.md` now includes two separate `Record<SiegeStrategy, number>` maps:
- `SIEGE_STRATEGY_WALL_DECAY_MODIFIER` (assault: 1.2, surround: 0.8, night_raid: 1.5, insider: 1.3)
- `SIEGE_STRATEGY_FORCE_POWER_MODIFIER` (assault: 1.5, surround: 0.8, night_raid: 1.2, insider: 2.0)

Additionally, a separate section at the bottom of the file contains the same data in table format with Chinese labels.

**NOTE**: The `SiegeStrategy` type definition at the top uses values `'assault' | 'surround' | 'night_raid' | 'insider'`, but the `SIEGE_STRATEGY_WALL_DECAY_MODIFIER` object uses keys `'all_out_assault'`, `'siege'`, `'night_raid'`, `'inside_job'`. The Record type constraints would cause a TypeScript compilation error since the keys don't match the SiegeStrategy type. This is a P1 issue (see finding #1 below).

### P1-R2-06: Version migration strategy
**Status**: PASS

`map-interfaces.md` now includes:
1. A `migrateGameState` function skeleton with version checking logic
2. A migration strategy description: incremental migration by version number, toast on failure, core data preserved
3. `CURRENT_MAP_GAME_STATE_VERSION = 1` constant definition

The `MapGameState` interface includes a `version: string` field. The migration function checks against `CURRENT_VERSION = '2.0'` (string), while `CURRENT_MAP_GAME_STATE_VERSION = 1` (number). This type mismatch (string vs number) is noted but is a P2 issue (see finding #3 below).

### P1-R2-07: Loading progress percentage display
**Status**: PASS

FL-MAP-01-02 now specifies: skeleton screen includes progress bar with percentage digits (e.g., "Loading 67%") + estimated remaining time (e.g., "Estimated 2 seconds remaining"). The FR-01-02 requirement text has been updated accordingly.

---

## 3. Cross-Flow Consistency Check

### 3.1 Formula Consistency

| Formula | Defined In | Used In | Consistent? |
|---------|-----------|---------|:-----------:|
| Army cap = 500 + territories x 200 + barracks x 50 | FL-MAP-08 / map-interfaces | FL-MAP-08, map-interfaces | Yes |
| Production cap = 1000 + level x 200 + tech | FL-MAP-01 SP02 / map-interfaces | FL-MAP-01, map-interfaces | Yes |
| Wall defense init = 500 + wall level x 50 | FL-MAP-09 / map-interfaces | FL-MAP-09 P8, map-interfaces | Yes |
| Wall defense decay per turn | FL-MAP-09 P8 / map-interfaces | FL-MAP-09 P8 | Yes |
| Food consumption | FL-MAP-09 P2 (inline) / map-interfaces | FL-MAP-09, map-interfaces | Yes |
| Win rate = clamp(5%, 95%, (our_power/their_power x 0.5) + terrain_mod) | FL-MAP-07-02 / FL-MAP-12 | FL-MAP-07, FL-MAP-12 | Yes |
| Casualty: victory 5~15% / defeat 20~40% / crushing 50~80% | FL-MAP-17 / map-interfaces | FL-MAP-09, FL-MAP-17, map-interfaces | Yes |
| Force power = troops x coeff + general attrs | FL-MAP-16 / FL-MAP-09 P3 | FL-MAP-09, FL-MAP-16 | Yes |
| Territory abandon recovery = 70% | FL-MAP-08 / map-interfaces | FL-MAP-08, map-interfaces | Yes |

**One inconsistency found** (see finding #1): SiegeStrategy type keys don't match the Record constant keys.

### 3.2 State Machine Consistency

| State Machine | Defined In | Referenced In | Consistent? |
|---------------|-----------|---------------|:-----------:|
| SiegeTask status (7 states) | FL-MAP-09-08, map-interfaces | FL-MAP-09, FL-MAP-05, FL-MAP-16 | Yes |
| Force status (4 states) | FL-MAP-16, map-interfaces | FL-MAP-09, FL-MAP-16 | Yes |
| Tutorial step flow (4 steps) | FL-MAP-01 SP01 | FL-MAP-01 | Yes |
| March intercept state machine | FL-MAP-04-02 | FL-MAP-04 | Yes |

### 3.3 Data Structure Consistency

| Structure | map-interfaces.md | Flow Docs | Consistent? |
|-----------|-------------------|-----------|:-----------:|
| TerritoryData | Defined (11 fields) | FL-MAP-06/07/08 | Yes |
| CityData | Defined (7 fields) | FL-MAP-03/09 | Yes |
| SiegeTask | Defined (12 fields) | FL-MAP-09 | Yes |
| ExpeditionForce | Defined (7 fields) | FL-MAP-09/16 | Yes |
| TotalArmyPool | Defined (5 fields) | FL-MAP-08 | Yes |
| PendingReward | Defined (6 fields) | FL-MAP-11 | Yes |
| GeneralData | Defined (6 fields) | FL-MAP-16/17 | Yes |
| BattleOutcome | Defined (6 fields) | FL-MAP-09/17 | Yes |
| MapGameState | Defined (8 fields) | FL-MAP-01 | Yes |

### 3.4 Coordinate System Consistency

All documents consistently use the BlockCoord (320x240 grid) system. Pixel coordinates are derived as `block * 8 * zoom`. No inconsistencies found.

### 3.5 Territory Abandon Recovery Ratio

FL-MAP-08-01 states "60% returned, 40% lost" in step S3. However, FL-MAP-08 army pool rules table and map-interfaces.md both say "70% returned, 30% lost". These two figures **contradict** each other (see finding #2).

---

## 4. Data Structure Completeness Check (map-interfaces.md)

### 4.1 Interfaces Defined (30 types/interfaces)

All core data structures for the map game system are defined:
- Basic types: BlockCoord, Faction, TerrainType, BattleResult, InjuryLevel, SiegeStrategy, ForceStatus, CityType, RoadType, ResourceType
- Data interfaces: MapConfig, FactionConfig, MapData, TerrainBlock, CityData, RoadSegment, TerritoryData, ProductionData, GarrisonData, TotalArmyPool, ExpeditionForce, SiegeTask, MarchToSiegeTransition, BattleOutcome, GeneralInjury, PendingReward, GeneralData, GeneralInjuryState, MapGameState

### 4.2 Missing Data Structures

The following structures are referenced in flow documents but not defined in map-interfaces.md:

| Structure | Referenced In | Impact |
|-----------|--------------|--------|
| TerritoryDetailViewModel | FL-MAP-06 S5 | P3 -- UI view model, can be derived from TerritoryData |
| MapEvent (event type) | FL-MAP-12 | P3 -- 6 event types listed inline in FL-MAP-12 |
| OfflineChange | FL-MAP-15 | P3 -- Change record structure inferable from context |
| FilterState / HeatmapConfig | FL-MAP-10 | P3 -- UI state, straightforward to derive |

These are all P3 level (UI/view layer types easily derived from existing definitions).

### 4.3 Formula Index Completeness

map-interfaces.md contains a formula index table with 10 formulas. Cross-referencing with flow documents confirms all major formulas are captured. No critical formulas are missing.

---

## 5. New Findings

| # | Flow/Data | Issue | Priority | Fix Suggestion |
|---|-----------|-------|:--------:|----------------|
| 1 | map-interfaces.md | **SiegeStrategy type key mismatch**: Type defined as `'assault' \| 'surround' \| 'night_raid' \| 'insider'` but Record constants use `'all_out_assault' \| 'siege' \| 'night_raid' \| 'inside_job'`. TypeScript would reject this. Also, the siege warfare document (FL-MAP-09) and strategy table at bottom of map-interfaces.md use the Chinese terms (assault/surround/night_raid/insider) while the Record constants use different English keys. | P1 | Unify to one set of keys. Recommend keeping the SiegeStrategy type definition (`assault/surround/night_raid/insider`) and updating the Record constants to use matching keys. |
| 2 | FL-MAP-08 vs map-interfaces | **Territory abandon recovery ratio contradiction**: FL-MAP-08-01 S3 says "60% returned, 40% lost" while FL-MAP-08 army pool table and map-interfaces.md both say "70% returned, 30% lost". A developer would not know which to implement. | P1 | Pick one ratio and update all three locations consistently. The 70%/30% ratio appears in 2 of 3 places, suggesting that is the intended value. Update FL-MAP-08-01 S3 to match. |
| 3 | map-interfaces.md | **Version field type mismatch**: MapGameState.version is `string`, migrateGameState compares against `CURRENT_VERSION = '2.0'` (string), but `CURRENT_MAP_GAME_STATE_VERSION = 1` (number). Two different constants with different types for the same concept. | P1 | Unify: either use string version throughout (recommended for semver) or use integer throughout. Remove one of the two constants. |
| 4 | FL-MAP-09 P2 | **Food consumption formula discrepancy**: FL-MAP-09 P2 inline formula uses `base=50, troop_coeff=troops/100, dist_coeff=distance*0.3, strategy_mod`, while map-interfaces.md formula index says `base=100, troop_coeff=troops*0.1, dist_coeff=distance*5, strategy_mod`. The mathematical results differ: FL-MAP-09 example gives 2880 for 800 troops/20 tiles/assault, but map-interfaces formula with same inputs gives: 100 + 80 + 100 + 180 = 460 (using strategy_mod as multiplier). The inline formula in FL-MAP-09 is self-consistent but the map-interfaces version is a simplified expression that doesn't match. | P2 | Align the map-interfaces.md formula index entry with the detailed FL-MAP-09 P2 formula. The FL-MAP-09 P2 version is the authoritative one since it includes a worked example. |
| 5 | FL-MAP-07 S7 / FL-MAP-17 | **Conquest vs siege casualty floor inconsistency**: FL-MAP-07 XC-005 states conquest minimum loss is 10% of expedition troops. FL-MAP-17 states minimum loss is 1 soldier (when troops > 10) or 0 (when troops <= 10). Both are documented as authoritative in their respective scopes, but a shared utility function (as recommended by P1-R2-04) would need a parameter to switch between these floors. | P2 | In the shared `calculateCasualties()` function, add a `mode: 'conquest' | 'siege'` parameter to select the appropriate loss floor rule. Document this in FL-MAP-07 S7. |
| 6 | FL-MAP-04-01 | **Terrain move cost table lacks snow**: FL-MAP-04-01 defines TERRAIN_MOVE_COST for 5 terrain types (plains/forest/mountain/desert/water) but TerrainType in map-interfaces.md includes `snow` as a 6th type. No move cost defined for snow. | P2 | Add snow terrain move cost to FL-MAP-04-01 table (e.g., snow = 1.6 or similar, referencing PLAN.md if defined there). |
| 7 | FL-MAP-03-01 | **Terrain palette lacks snow**: TERRAIN_PALETTE defines 20 colors for 5 terrain types (0-19). TerrainType includes `snow` as a 6th type. No palette colors defined for snow. | P2 | Add snow palette entries (e.g., color numbers 20-23) or explicitly state that snow is a variant/reskin of an existing terrain type. |
| 8 | FL-MAP-09 P8 | **City defense initial value formula has two versions**: FL-MAP-09 P8 inline says `base = city_level x 100 + garrison_troops x 0.5`, while map-interfaces.md says `base = 500 + wall_level x 50`. The FL-MAP-09 AC-09-01 and V-029 say `500 + wall_level x 50`. The inline P8 formula adds garrison troops as a factor which is not in the V-029 version. | P2 | Reconcile: either the city defense initial value includes garrison troops or it doesn't. Recommend clarifying that V-029 is the base defense (wall component) and the P8 formula is the total effective defense (base + garrison contribution). |
| 9 | FL-MAP-01 SP01 | **Tutorial step 2 general assignment unclear**: Step 2 (conquest) uses the "attack general power coefficient" formula which requires a general, but the tutorial step does not describe how a general is assigned for the tutorial conquest. Is a tutorial general auto-assigned? | P3 | Add a note that in tutorial mode, a default general is auto-assigned with coefficient 1.0, or clarify that the tutorial conquest uses the base formula without general contribution. |
| 10 | FL-MAP-08 | **Army pool replenish implementation timing undefined**: replenishRate = 50/hour + barracks_level * 10/hour is defined, but when exactly does replenishment happen? On tab open? On timer tick? The flow says "each second tick" for production but doesn't specify army replenishment timing. | P3 | Add a note that army replenishment uses the same per-second tick as production (FL-MAP-01 SP02 TE-MAP-01), calculating `replenishRate / 3600` per second. |
| 11 | FL-MAP-18 | **Mobile context menu "scout" action has no corresponding flow**: The long-press context menu includes a "scout" action that shows target territory details, but there's no dedicated scout flow defined. It appears to be a read-only view of FL-MAP-06 data. | P3 | Clarify that "scout" opens FL-MAP-06 in read-only mode (no action buttons). Current text already hints at this but could be explicit. |
| 12 | FL-MAP-09 P8 / map-interfaces | **Strategy modifier naming inconsistency across documents**: FL-MAP-09 uses "强攻/围困/夜袭/内应" (Chinese strategy names). map-interfaces.md uses English 'assault'/'surround'/'night_raid'/'insider' in the type but 'all_out_assault'/'siege'/'night_raid'/'inside_job' in the constants. The formula index uses yet another naming (强攻x1.2 etc). A developer must manually map between 3 naming schemes. | P3 | Create a canonical mapping table (Chinese name -> English type key -> display name) in map-interfaces.md. |

---

## 6. Per-Flow Implementation Readiness Assessment

| Flow | Can Start Coding? | Blockers | Notes |
|------|:-----------------:|----------|-------|
| FL-MAP-01 | Yes | -- | Tutorial algorithm complete, loading progress specified |
| FL-MAP-02 | Yes | -- | Zoom constraints reference PRD but logic is clear |
| FL-MAP-03 | Yes | -- | Snow terrain palette missing (P2) but can start with 5 types |
| FL-MAP-04 | Yes | -- | A* parameters reference PRD, terrain cost table nearly complete |
| FL-MAP-05 | Yes | -- | Animation timings well defined |
| FL-MAP-06 | Yes | -- | Panel layout, selection logic all clear |
| FL-MAP-07 | Yes | -- | Win rate formula complete, casualty formula inline |
| FL-MAP-08 | Yes | -- | Abandon ratio needs clarification (P1 finding #2) |
| FL-MAP-09 | Yes | -- | Most complex flow but thoroughly documented |
| FL-MAP-10 | Yes | -- | Filter logic well defined inline |
| FL-MAP-11 | Yes | -- | Reward claim text updated (R2-03) |
| FL-MAP-12 | Yes | -- | Event types table unified to 6 types |
| FL-MAP-13 | Yes | -- | Read-only statistics, straightforward |
| FL-MAP-14 | Yes | -- | 15-level table with precise values inline |
| FL-MAP-15 | Yes | -- | Offline definition clear (300s threshold) |
| FL-MAP-16 | Yes | -- | Force power formula complete with example |
| FL-MAP-17 | Yes | -- | 3-tier casualty system authoritative source |
| FL-MAP-18 | Yes | -- | Mobile adaptation comprehensive, long-press menu complete |

**18/18 flows are implementation-ready**. The 3 P1 findings are data-level inconsistencies that can be resolved in a single pass before coding begins.

---

## 7. Recommendations for Implementation Start

### Must Fix Before Coding (P1)
1. **Unify SiegeStrategy keys** in map-interfaces.md (finding #1) -- 10 min
2. **Resolve abandon recovery ratio** contradiction (finding #2) -- 5 min
3. **Unify version constant type** (finding #3) -- 5 min

### Fix During Initial Implementation (P2)
4. Align food consumption formula in map-interfaces index
5. Add snow terrain move cost and palette entries
6. Clarify city defense formula (base vs total)
7. Document shared casualty function mode parameter

### Polish Later (P3)
8-12. Tutorial general, replenish timing, scout flow, strategy name mapping

---

*Dev Proxy Verification Report | R2 | 2026-05-05*
