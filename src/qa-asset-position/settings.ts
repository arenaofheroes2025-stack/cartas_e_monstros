import type { ShadowGroup } from '../render/shadowCalibration';
import { ASSET_POSITION_CALIBRATION } from '../render/assetPositionCalibration';

export type { ShadowGroup };
export type StageFocus = 'todos' | ShadowGroup;
export const GROUPS: ShadowGroup[] = ['personagens', 'casas', 'arvores', 'pedras', 'plantas', 'objetos'];
export const GROUP_LABELS: Record<ShadowGroup, string> = {
  personagens: 'Personagens', casas: 'Casas', arvores: 'Árvores',
  pedras: 'Pedras', plantas: 'Plantas', objetos: 'Objetos gerais'
};

export interface PositionSettings {
  heightY: Record<ShadowGroup, number>;
  depthZ: Record<ShadowGroup, number>;
  frontGroups: Record<ShadowGroup, boolean>;
  frontAssetIds: string[];
  zoom: number;
  showAnchors: boolean;
}

const emptyGroups = (): Record<ShadowGroup, number> => ({
  personagens: 0, casas: 0, arvores: 0, pedras: 0, plantas: 0, objetos: 0
});
export const DEFAULT_SETTINGS: PositionSettings = {
  heightY: {...ASSET_POSITION_CALIBRATION.heightY}, depthZ: emptyGroups(),
  frontGroups: {...ASSET_POSITION_CALIBRATION.frontOfTerrain}, frontAssetIds: [], zoom: 42, showAnchors: true
};

function validAssetIds(value: unknown): string[] {
  const ids = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(ids.filter((id): id is string =>
    typeof id === 'string' && /^[a-z0-9-]{1,48}$/.test(id)))].slice(0, 50);
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.max(min, Math.min(max, number)) * 100) / 100 : fallback;
}

export function parsePositionSettings(search: string, stored: Partial<PositionSettings> = {}): PositionSettings {
  if (!stored || typeof stored !== 'object') stored = {};
  const params = new URLSearchParams(search);
  const hasSharedPosition = GROUPS.some(group => params.has(`y_${group}`) || params.has(`z_${group}`));
  const selectedFrontGroups = params.has('frontGroups') ? params.get('frontGroups')?.split(',') :
    hasSharedPosition ? [] : GROUPS.filter(group => stored.frontGroups?.[group] ?? DEFAULT_SETTINGS.frontGroups[group]);
  const selectedFrontAssets = params.has('frontAssets') ? params.get('frontAssets') :
    hasSharedPosition ? [] : stored.frontAssetIds;
  const result: PositionSettings = {
    heightY: {...DEFAULT_SETTINGS.heightY}, depthZ: emptyGroups(),
    frontGroups: {...DEFAULT_SETTINGS.frontGroups}, frontAssetIds: validAssetIds(selectedFrontAssets),
    zoom: bounded(params.get('zoom') ?? stored.zoom, DEFAULT_SETTINGS.zoom, 26, 60),
    showAnchors: params.has('anchors') ? params.get('anchors') === '1' :
      typeof stored.showAnchors === 'boolean' ? stored.showAnchors : true
  };
  for (const group of GROUPS) {
    result.heightY[group] = bounded(params.get(`y_${group}`) ?? stored.heightY?.[group], DEFAULT_SETTINGS.heightY[group], -2, 2);
    result.depthZ[group] = bounded(params.get(`z_${group}`) ?? stored.depthZ?.[group], 0, -2, 2);
    result.frontGroups[group] = selectedFrontGroups?.includes(group) ?? false;
  }
  return result;
}

export function positionSettingsUrl(settings: PositionSettings, base = window.location.href): string {
  const url = new URL(base);
  url.search = '';
  for (const group of GROUPS) {
    url.searchParams.set(`y_${group}`, String(settings.heightY[group]));
    url.searchParams.set(`z_${group}`, String(settings.depthZ[group]));
  }
  url.searchParams.set('frontGroups', GROUPS.filter(group => settings.frontGroups[group]).join(','));
  url.searchParams.set('frontAssets', settings.frontAssetIds.join(','));
  url.searchParams.set('zoom', String(settings.zoom));
  url.searchParams.set('anchors', settings.showAnchors ? '1' : '0');
  return url.toString();
}

export function readPositionSettings(): PositionSettings {
  let stored: Partial<PositionSettings> = {};
  try { stored = JSON.parse(localStorage.getItem('cartas-asset-position-lab') || '{}') as Partial<PositionSettings>; }
  catch { /* Invalid saved QA data falls back to the current game positions. */ }
  return parsePositionSettings(window.location.search, stored);
}

export function savePositionSettings(settings: PositionSettings): void {
  try { localStorage.setItem('cartas-asset-position-lab', JSON.stringify(settings)); }
  catch { /* Sharing still works through the URL and JSON when storage is unavailable. */ }
  history.replaceState(null, '', positionSettingsUrl(settings));
}
