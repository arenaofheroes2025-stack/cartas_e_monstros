import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS as POSITION } from './settings';
import { DEFAULT_SETTINGS as SHADOW } from '../qa-shadows/settings';
import { combinedSettingsUrl, readCombinedShadowSettings } from './combinedSettings';

describe('link do laboratório conjunto', () => {
  it('preserva posição e sombra sem colisão de zoom e âncoras', () => {
    const position = {...POSITION, zoom: 60, showAnchors: true};
    const shadow = {...SHADOW, zoom: 31, showAnchors: false, treeShadowSide: 0.35};
    const url = new URL(combinedSettingsUrl(position, shadow, 'sombras',
      'http://localhost/qa-posicao-assets.html'));
    expect(url.searchParams.get('zoom')).toBe('60');
    expect(url.searchParams.get('shadow_zoom')).toBe('31');
    expect(url.searchParams.get('view')).toBe('sombras');
    expect(readCombinedShadowSettings(url.search, {}).treeShadowSide).toBe(0.35);
    expect(readCombinedShadowSettings(url.search, {}).showAnchors).toBe(false);
  });
});
