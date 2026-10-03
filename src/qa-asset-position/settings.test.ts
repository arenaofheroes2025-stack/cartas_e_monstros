import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parsePositionSettings, positionSettingsUrl } from './settings';

describe('asset position QA settings', () => {
  it('keeps each group independent and restores shared links', () => {
    const settings = parsePositionSettings('', {
      heightY: {...DEFAULT_SETTINGS.heightY, arvores: -0.25},
      depthZ: {...DEFAULT_SETTINGS.depthZ, casas: 0.45},
      frontGroups: {...DEFAULT_SETTINGS.frontGroups, casas: true},
      frontAssetIds: ['willow']
    });
    const url = positionSettingsUrl(settings, 'https://example.test/qa-posicao-assets.html');
    expect(parsePositionSettings(new URL(url).search)).toEqual(settings);
    expect(settings.heightY.casas).toBe(-0.61);
    expect(settings.depthZ.arvores).toBe(0);
    expect(settings.frontGroups.casas).toBe(true);
    expect(settings.frontAssetIds).toEqual(['willow']);
  });

  it('prefers URL values and bounds malformed input', () => {
    const settings = parsePositionSettings('?y_arvores=-9&z_arvores=0.375&y_casas=bad&zoom=999&anchors=0', {
      heightY: {...DEFAULT_SETTINGS.heightY, arvores: 0.4}
    });
    expect(settings.heightY.arvores).toBe(-2);
    expect(settings.depthZ.arvores).toBe(0.38);
    expect(settings.heightY.casas).toBe(-0.61);
    expect(settings.zoom).toBe(60);
    expect(settings.showAnchors).toBe(false);
  });

  it('preserves old shared positions without inheriting unrelated front priorities', () => {
    const settings = parsePositionSettings('?y_casas=-0.78&z_casas=0&zoom=53&anchors=1', {
      frontGroups: {...DEFAULT_SETTINGS.frontGroups, arvores: true},
      frontAssetIds: ['house-cards']
    });
    expect(settings.heightY.casas).toBe(-0.78);
    expect(settings.frontGroups.arvores).toBe(false);
    expect(settings.frontAssetIds).toEqual([]);
  });
});
