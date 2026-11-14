import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  PenTool,
  Feather,
  Library,
  Settings,
  Menu,
  X,
  Plus,
  ChevronRight,
} from 'lucide-react';
import type { UserProfile } from '../../types/brand';
import type { AppRoute } from '../../utils/router';

interface NavItem {
  id: 'dashboard' | 'brands' | 'content-studio' | 'writing-styles' | 'prompt-library' | 'settings';
  label: string;
  route: AppRoute;
  icon: typeof LayoutDashboard;
  adminTag?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', route: { view: 'dashboard' }, icon: LayoutDashboard },
  { id: 'brands', label: 'My Brands', route: { view: 'brands' }, icon: Briefcase },
  { id: 'content-studio', label: 'Content Studio', route: { view: 'content-studio' }, icon: PenTool },
  { id: 'writing-styles', label: 'Writing Styles', route: { view: 'writing-styles' }, icon: Feather },
  {
    id: 'prompt-library',
    label: 'Prompt Library',
    route: { view: 'prompt-library' },
    icon: Library,
    adminTag: true,
  },
  { id: 'settings', label: 'Settings', route: { view: 'settings' }, icon: Settings },
];

interface AppShellProps {
  currentRoute: AppRoute;
  breadcrumbs: Array<{ label: string; route?: AppRoute }>;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  profile: UserProfile;
  onNavigate: (route: AppRoute) => void;
  children: ReactNode;
}

function getActiveNavId(route: AppRoute): NavItem['id'] {
  switch (route.view) {
    case 'dashboard':
      return 'dashboard';
    case 'brands':
    case 'brand-new':
    case 'brand-edit':
    case 'brand-workspace':
      return 'brands';
    case 'content-studio':
      return 'content-studio';
    case 'writing-styles':
      return 'writing-styles';
    case 'prompt-library':
      return 'prompt-library';
    case 'settings':
      return 'settings';
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AppShell({
  currentRoute,
  breadcrumbs,
  primaryAction,
  profile,
  onNavigate,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeNavId = getActiveNavId(currentRoute);

  const handleNavClick = (route: AppRoute) => {
    setMobileMenuOpen(false);
    onNavigate(route);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-slate-50/70 px-4 py-5">
      <div>
        <button
          type="button"
          onClick={() => handleNavClick({ view: 'dashboard' })}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-100/80"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold tracking-tight text-white"
          >
            BF
          </span>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            BrandFlow AI
          </span>
        </button>

        <nav aria-label="Primary Navigation" className="mt-7 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.route)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      isActive ? 'text-blue-600' : 'text-slate-400'
                    }`}
                    strokeWidth={1.75}
                  />
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </span>
                {item.adminTag && (
                  <span className="text-[11px] font-normal text-slate-400 whitespace-nowrap shrink-0">
                    Admin
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200/80 pt-4">
        <button
          type="button"
          onClick={() => handleNavClick({ view: 'settings' })}
          aria-label="Open account and workspace settings"
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-100"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700"
          >
            {getInitials(profile.fullName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900">
              {profile.fullName}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {profile.email}
            </span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 lg:flex">
      {/* Persistent Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 lg:border-r lg:border-slate-200">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Header Bar (compact, single row, well under 15% viewport height) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs lg:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => handleNavClick({ view: 'dashboard' })}
            className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            BrandFlow AI
          </button>
        </div>

        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            <span>New Brand</span>
          </button>
        )}
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="font-display text-base font-bold text-slate-900">
                Navigation
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderSidebarContent()}</div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Desktop Contextual Top Bar */}
        <header className="hidden h-16 items-center justify-between gap-8 border-b border-slate-200 bg-white px-8 lg:flex">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={`${crumb.label}-${index}`} className="flex items-center gap-2 min-w-0">
                  {index > 0 && (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-slate-300"
                      strokeWidth={1.75}
                    />
                  )}
                  {crumb.route && !isLast ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(crumb.route!)}
                      className="truncate text-slate-500 transition-colors hover:text-slate-900 whitespace-nowrap shrink-0"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span
                      className={`truncate whitespace-nowrap ${
                        isLast ? 'font-medium text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {crumb.label}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              <span>{primaryAction.label}</span>
            </button>
          )}
        </header>

        <main className="flex-1 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
