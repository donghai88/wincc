import type { DeviceType } from '@/types/template';
import { defaultLadleNav, isLadleNavId, type LadleNavId } from '@/lib/ladle-navigation';

export type LadlePanelMode = 'selector' | 'radar';

export interface AppRouteState {
  /** 平台侧栏导航；钢包壳层时为 ladle-* */
  nav: string;
  deviceType: DeviceType | null;
  /** 钢包功能选择页上的子模式 */
  ladlePanelMode: LadlePanelMode;
  /** 是否已进入钢包业务壳层 */
  ladleShellActive: boolean;
}

const DEVICE_TYPES: DeviceType[] = [
  'ladle',
  'converter',
  'continuous-cast',
  'heating-furnace',
  'hot-metal-trough',
  'hot-metal-trough-sim',
  'ladle-recognition',
];

function isDeviceType(value: string | null): value is DeviceType {
  return !!value && DEVICE_TYPES.includes(value as DeviceType);
}

/** 钢包产品版业务一级菜单路由。 */
export function createLadleProductRoute(nav: LadleNavId = defaultLadleNav): AppRouteState {
  return {
    nav,
    deviceType: 'ladle-recognition',
    ladlePanelMode: 'selector',
    ladleShellActive: true,
  };
}

export function createDefaultAppRoute(): AppRouteState {
  return {
    nav: 'dashboard',
    deviceType: null,
    ladlePanelMode: 'selector',
    ladleShellActive: false,
  };
}

export function parseAppRoute(search = ''): AppRouteState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const deviceParam = params.get('device');
  const deviceType = isDeviceType(deviceParam) ? deviceParam : null;
  const ladleParam = params.get('ladle');
  const modeParam = params.get('mode');
  const navParam = params.get('nav');

  if (deviceType === 'ladle-recognition' && ladleParam && isLadleNavId(ladleParam)) {
    return {
      nav: ladleParam,
      deviceType,
      ladlePanelMode: 'selector',
      ladleShellActive: true,
    };
  }

  if (deviceType === 'ladle-recognition' && modeParam === 'radar') {
    return {
      nav: 'dashboard',
      deviceType,
      ladlePanelMode: 'radar',
      ladleShellActive: false,
    };
  }

  if (deviceType) {
    return {
      nav: 'dashboard',
      deviceType,
      ladlePanelMode: 'selector',
      ladleShellActive: false,
    };
  }

  if (navParam && !isLadleNavId(navParam)) {
    return {
      nav: navParam,
      deviceType: null,
      ladlePanelMode: 'selector',
      ladleShellActive: false,
    };
  }

  return createDefaultAppRoute();
}

export function buildAppRouteSearch(state: AppRouteState): string {
  const params = new URLSearchParams();

  if (state.ladleShellActive && state.deviceType === 'ladle-recognition') {
    params.set('device', 'ladle-recognition');
    params.set('ladle', isLadleNavId(state.nav) ? state.nav : defaultLadleNav);
    return `?${params.toString()}`;
  }

  if (state.deviceType === 'ladle-recognition' && state.ladlePanelMode === 'radar') {
    params.set('device', 'ladle-recognition');
    params.set('mode', 'radar');
    return `?${params.toString()}`;
  }

  if (state.deviceType) {
    params.set('device', state.deviceType);
    return `?${params.toString()}`;
  }

  if (state.nav && state.nav !== 'dashboard') {
    params.set('nav', state.nav);
    return `?${params.toString()}`;
  }

  return '';
}

export function buildAppRouteUrl(state: AppRouteState): string {
  return `${window.location.pathname}${buildAppRouteSearch(state)}${window.location.hash}`;
}

export function pushAppRoute(state: AppRouteState) {
  const nextUrl = buildAppRouteUrl(state);
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;
  window.history.pushState(state, '', nextUrl);
}

export function replaceAppRoute(state: AppRouteState) {
  window.history.replaceState(state, '', buildAppRouteUrl(state));
}

export function readAppRouteFromLocation(): AppRouteState {
  return parseAppRoute(window.location.search);
}
