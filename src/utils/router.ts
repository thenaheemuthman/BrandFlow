import type { WorkspaceSection } from '../types/brand';

export type AppRoute =
  | { view: 'dashboard' }
  | { view: 'brands' }
  | { view: 'brand-new' }
  | { view: 'brand-edit'; brandId: string }
  | { view: 'brand-workspace'; brandId: string; section: WorkspaceSection }
  | { view: 'content-studio' }
  | { view: 'writing-styles' }
  | { view: 'prompt-library' }
  | { view: 'settings' }
  | { view: 'phase2a-verify' };

const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  'overview',
  'brand-foundation',
  'brand-messaging',
  'customer-intelligence',
  'marketing-strategy',
  'content-strategy',
  'content-calendar',
  'content-studio',
  'brand-settings',
];

export function parseRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/' || clean === '/dashboard') {
    return { view: 'dashboard' };
  }
  if (clean === '/brands') {
    return { view: 'brands' };
  }
  if (clean === '/brands/new') {
    return { view: 'brand-new' };
  }
  if (clean === '/content-studio') {
    return { view: 'content-studio' };
  }
  if (clean === '/writing-styles') {
    return { view: 'writing-styles' };
  }
  if (clean === '/prompt-library') {
    return { view: 'prompt-library' };
  }
  if (clean === '/settings') {
    return { view: 'settings' };
  }
  if (clean === '/verify-phase2a') {
    return { view: 'phase2a-verify' };
  }

  const editMatch = clean.match(/^\/brands\/([^/]+)\/edit$/);
  if (editMatch) {
    return { view: 'brand-edit', brandId: decodeURIComponent(editMatch[1]) };
  }

  const workspaceSectionMatch = clean.match(/^\/brands\/([^/]+)\/([^/]+)$/);
  if (workspaceSectionMatch) {
    const brandId = decodeURIComponent(workspaceSectionMatch[1]);
    const rawSection = decodeURIComponent(workspaceSectionMatch[2]) as WorkspaceSection;
    const section = WORKSPACE_SECTIONS.includes(rawSection) ? rawSection : 'overview';
    return { view: 'brand-workspace', brandId, section };
  }

  const workspaceMatch = clean.match(/^\/brands\/([^/]+)$/);
  if (workspaceMatch) {
    return {
      view: 'brand-workspace',
      brandId: decodeURIComponent(workspaceMatch[1]),
      section: 'overview',
    };
  }

  return { view: 'dashboard' };
}

export function routeToPath(route: AppRoute): string {
  switch (route.view) {
    case 'dashboard':
      return '/';
    case 'brands':
      return '/brands';
    case 'brand-new':
      return '/brands/new';
    case 'brand-edit':
      return `/brands/${encodeURIComponent(route.brandId)}/edit`;
    case 'brand-workspace':
      return route.section === 'overview'
        ? `/brands/${encodeURIComponent(route.brandId)}`
        : `/brands/${encodeURIComponent(route.brandId)}/${route.section}`;
    case 'content-studio':
      return '/content-studio';
    case 'writing-styles':
      return '/writing-styles';
    case 'prompt-library':
      return '/prompt-library';
    case 'settings':
      return '/settings';
    case 'phase2a-verify':
      return '/verify-phase2a';
  }
}
