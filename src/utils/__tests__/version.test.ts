import { parseVersion, isNewerVersion } from '../version';

describe('parseVersion', () => {
  it('parses standard semver strings', () => {
    expect(parseVersion('1.0.0')).toEqual([1, 0, 0]);
    expect(parseVersion('2.4.12')).toEqual([2, 4, 12]);
  });

  it('strips leading v prefix', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('V2.0.0')).toEqual([2, 0, 0]);
  });

  it('handles irregular formats gracefully', () => {
    expect(parseVersion('')).toEqual([0, 0, 0]);
    expect(parseVersion('1.0')).toEqual([1, 0]);
  });
});

describe('isNewerVersion', () => {
  it('detects patch updates', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(false);
  });

  it('detects minor updates', () => {
    expect(isNewerVersion('1.0.5', '1.1.0')).toBe(true);
    expect(isNewerVersion('1.2.0', '1.1.9')).toBe(false);
  });

  it('detects major updates', () => {
    expect(isNewerVersion('1.9.9', '2.0.0')).toBe(true);
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(false);
  });

  it('handles identical versions', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('v1.0.0', '1.0.0')).toBe(false);
  });

  it('handles different lengths', () => {
    expect(isNewerVersion('1.0', '1.0.1')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0')).toBe(false);
  });
});
