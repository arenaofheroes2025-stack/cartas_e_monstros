import { parseShadowSettings, type ShadowSettings } from '../qa-shadows/settings';
import { positionSettingsUrl, type PositionSettings } from './settings';

export type LabView = 'posicao' | 'sombras';

const shadowKeys: (keyof ShadowSettings)[] = [
  'azimuth', 'elevation', 'casterHeight', 'characterHeightScale',
  'characterShadowSide', 'characterShadowDepth', 'houseHeightScale',
  'houseShadowSide', 'houseShadowDepth', 'treeHeightScale', 'treeShadowSide',
  'treeShadowDepth', 'stoneHeightScale', 'stoneShadowSide', 'stoneShadowDepth',
  'plantHeightScale', 'plantShadowSide', 'plantShadowDepth', 'propHeightScale',
  'propShadowSide', 'propShadowDepth', 'reach', 'opacity', 'footGain',
  'softness', 'sunStrength', 'zoom', 'showShadows', 'showAnchors'
];

export function readCombinedShadowSettings(search: string, stored: Partial<ShadowSettings> = {}): ShadowSettings {
  const params = new URLSearchParams(search);
  const shadowParams = new URLSearchParams();
  for (const key of shadowKeys) {
    const value = params.get(`shadow_${key}`);
    if (value !== null) shadowParams.set(key, value);
  }
  return parseShadowSettings(shadowParams.toString(), stored);
}

export function combinedSettingsUrl(position: PositionSettings, shadow: ShadowSettings,
  view: LabView, base = window.location.href): string {
  const url = new URL(positionSettingsUrl(position, base));
  for (const key of shadowKeys) {
    const value = shadow[key];
    url.searchParams.set(`shadow_${key}`, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  url.searchParams.set('view', view);
  return url.toString();
}
