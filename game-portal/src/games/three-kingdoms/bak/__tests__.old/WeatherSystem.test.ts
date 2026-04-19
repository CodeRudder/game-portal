import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeatherSystem, type MapWeatherType } from '../WeatherSystem';

describe('WeatherSystem', () => {
  let ws: WeatherSystem;

  beforeEach(() => {
    ws = new WeatherSystem();
  });

  // ─── 初始状态 ──────────────────────────────────────────

  it('初始天气为 sunny', () => {
    expect(ws.getCurrentWeather()).toBe('sunny');
  });

  it('初始 tint 为晴天色调', () => {
    // getTint() returns { color, alpha }; sunny tint is 0xfff8e1 with alpha 0.04
    // transitionProgress starts at 1, so tint is fully the current weather's tint
    const tint = ws.getTint();
    expect(tint.color).toBe(0xfff8e1);
    expect(tint.alpha).toBeCloseTo(0.04);
  });

  it('初始粒子类型为 petal', () => {
    expect(ws.getParticleType()).toBe('petal');
  });

  // ─── update 累计时间 ───────────────────────────────────

  it('update 累计时间，未达阈值不切换', () => {
    // nextChange 初始为 30~60，先 update 10 秒不会切换
    ws.update(10);
    // 天气可能不变（概率极低会变，但 timer < 30 不可能变）
    expect(ws.getCurrentWeather()).toBe('sunny');
  });

  it('update 累计时间足够长后天气切换并重置 timer', () => {
    // 强制设置 nextChange 为较小值以便测试
    const data = ws.serialize();
    ws.deserialize({ ...data, nextChangeTime: 5 });
    // update caps dt at 0.1, so we need many small updates to accumulate time
    // After weather switches, timer resets to 0 and new nextChangeTime is set (30-60)
    // With 60 * 0.1 = 6s total, first switch at ~5s, then timer accumulates remaining ~1s
    for (let i = 0; i < 60; i++) ws.update(0.1);
    // 天气应该已经切换（不再是 sunny）
    const afterData = ws.serialize();
    // Timer should have been reset to 0 on switch, then accumulated remaining time
    // Since nextChangeTime is now 30-60, timer < nextChangeTime (no second switch)
    expect(afterData.weatherTimer).toBeLessThan(afterData.nextChangeTime);
    // Weather should have changed from sunny
    expect(afterData.currentWeather).not.toBe('sunny');
  });

  // ─── 天气切换 ──────────────────────────────────────────

  it('天气切换后 nextChange 重新随机生成', () => {
    const data = ws.serialize();
    ws.deserialize({ ...data, nextChangeTime: 1 });
    // update caps dt at 0.1, need multiple calls to accumulate enough time
    for (let i = 0; i < 20; i++) ws.update(0.1);
    const newData = ws.serialize();
    expect(newData.nextChangeTime).toBeGreaterThanOrEqual(30);
    expect(newData.nextChangeTime).toBeLessThanOrEqual(60);
  });

  // ─── getTint 返回正确颜色 ─────────────────────────────

  it('getTint: sunny → 0xfff8e1', () => {
    // setWeather is a no-op when weather is already sunny, so tint stays at sunny
    // transitionProgress is already 1 (initial), no transition needed
    const tint = ws.getTint();
    expect(tint.color).toBe(0xfff8e1);
    expect(tint.alpha).toBeCloseTo(0.04);
  });

  it('getTint: rain → 0x90a4ae', () => {
    ws.setWeather('rain');
    // Complete the transition: update caps dt at 0.1, transition duration is 5s
    // Need 50+ updates of 0.1s each to reach t=1
    for (let i = 0; i < 60; i++) ws.update(0.1);
    const tint = ws.getTint();
    expect(tint.color).toBe(0x90a4ae);
    expect(tint.alpha).toBeCloseTo(0.08);
  });

  it('getTint: snow → 0xe8eaf6', () => {
    ws.setWeather('snow');
    for (let i = 0; i < 60; i++) ws.update(0.1);
    const tint = ws.getTint();
    expect(tint.color).toBe(0xe8eaf6);
    expect(tint.alpha).toBeCloseTo(0.06);
  });

  it('getTint: fog → 0xb0bec5', () => {
    ws.setWeather('fog');
    for (let i = 0; i < 60; i++) ws.update(0.1);
    const tint = ws.getTint();
    expect(tint.color).toBe(0xb0bec5);
    expect(tint.alpha).toBeCloseTo(0.10);
  });

  // ─── getParticleType 返回正确类型 ─────────────────────

  it('getParticleType: sunny → petal', () => {
    ws.setWeather('sunny');
    // setWeather is no-op when already sunny
    expect(ws.getParticleType()).toBe('petal');
  });

  it('getParticleType: rain → rain', () => {
    ws.setWeather('rain');
    expect(ws.getParticleType()).toBe('rain');
  });

  it('getParticleType: snow → snow', () => {
    ws.setWeather('snow');
    expect(ws.getParticleType()).toBe('snow');
  });

  it('getParticleType: fog → fog', () => {
    ws.setWeather('fog');
    expect(ws.getParticleType()).toBe('fog');
  });

  // ─── setWeather ────────────────────────────────────────

  it('setWeather 直接设置天气', () => {
    ws.update(20); // 累积一些时间
    ws.setWeather('fog');
    expect(ws.getCurrentWeather()).toBe('fog');
    // setWeather does NOT reset weatherTimer, only switchWeather does
    // weatherTimer should still be >= 20 (capped by deltaTime clamp)
  });

  // ─── serialize / deserialize ───────────────────────────

  it('serialize 返回完整状态', () => {
    ws.setWeather('rain');
    const data = ws.serialize();
    expect(data).toHaveProperty('currentWeather', 'rain');
    expect(data).toHaveProperty('weatherTimer');
    expect(data).toHaveProperty('nextChangeTime');
    expect(data).toHaveProperty('previousWeather');
    expect(data).toHaveProperty('transitionProgress');
    expect(data).toHaveProperty('initialized');
  });

  it('deserialize 恢复天气状态', () => {
    ws.setWeather('snow');
    ws.update(15);
    const saved = ws.serialize();

    const ws2 = new WeatherSystem();
    ws2.deserialize(saved);
    expect(ws2.getCurrentWeather()).toBe('snow');
    expect(ws2.serialize().weatherTimer).toBe(saved.weatherTimer);
    expect(ws2.serialize().nextChangeTime).toBe(saved.nextChangeTime);
  });

  it('deserialize 忽略无效数据', () => {
    ws.setWeather('fog');
    // deserialize with empty object — should not change current weather
    ws.deserialize({});
    expect(ws.getCurrentWeather()).toBe('fog');

    // deserialize with partial data — should only update matching fields
    ws.deserialize({ weatherTimer: 10 });
    expect(ws.getCurrentWeather()).toBe('fog');
    expect(ws.serialize().weatherTimer).toBe(10);

    // deserialize with invalid types — should be ignored
    ws.deserialize({ currentWeather: 123, weatherTimer: 'bad' });
    expect(ws.getCurrentWeather()).toBe('fog');
  });
});
