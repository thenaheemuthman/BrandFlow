import { useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  LayoutGrid,
  Layers,
  SquarePen,
  Feather,
  BookMarked,
  SlidersHorizontal,
  PanelLeft,
  X,
  Plus,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import type { UserProfile } from '../../types/brand';
import type { AppRoute } from '../../utils/router';

interface NavItem {
  id: 'dashboard' | 'brands' | 'content-studio' | 'writing-styles' | 'prompt-library' | 'settings';
  label: string;
  route: AppRoute;
  icon: typeof LayoutGrid;
  adminTag?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', route: { view: 'dashboard' }, icon: LayoutGrid },
  { id: 'brands', label: 'My Brands', route: { view: 'brands' }, icon: Layers },
  { id: 'content-studio', label: 'Content Studio', route: { view: 'content-studio' }, icon: SquarePen },
  { id: 'writing-styles', label: 'Writing Styles', route: { view: 'writing-styles' }, icon: Feather },
  {
    id: 'prompt-library',
    label: 'Prompt Library',
    route: { view: 'prompt-library' },
    icon: BookMarked,
    adminTag: true,
  },
  { id: 'settings', label: 'Settings', route: { view: 'settings' }, icon: SlidersHorizontal },
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
  onSignOut: () => void;
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
    case 'phase2a-verify':
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
  onSignOut,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeNavId = getActiveNavId(currentRoute);

  const handleNavClick = (route: AppRoute) => {
    setMobileMenuOpen(false);
    onNavigate(route);
  };

  const renderBrandLockup = (interactive: boolean) => {
    const content = (
      <>
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold tracking-tight text-white shadow-xs"
        >
          BF
        </span>
        <span className="font-display text-[15px] font-semibold tracking-tight text-slate-950 whitespace-nowrap">
          BrandFlow AI
        </span>
      </>
    );

    if (!interactive) {
      return <div className="flex items-center gap-2.5">{content}</div>;
    }

    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.12 }}
        onClick={() => handleNavClick({ view: 'dashboard' })}
        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 hover:bg-slate-200/50"
      >
        {content}
      </motion.button>
    );
  };

  const renderSidebarBody = (showBrandHeader: boolean, layoutScope: 'desktop' | 'mobile') => (
    <div className="flex h-full flex-col justify-between bg-slate-50/80 px-3.5 py-5">
      <div>
        {showBrandHeader && (
          <div className="mb-6 px-0.5">{renderBrandLockup(true)}</div>
        )}

        <nav
          aria-label="Primary Navigation"
          className={`${showBrandHeader ? '' : 'mt-1 '}space-y-1`}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavId === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.975 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => handleNavClick(item.route)}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'text-slate-950'
                    : 'text-slate-600 hover:bg-slate-200/45 hover:text-slate-950'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId={`${layoutScope}-nav-active-bg`}
                    transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.7 }}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_-6px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/90"
                  />
                )}

                <span className="relative z-10 flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150 group-active:scale-90 ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-400 group-hover:bg-white/80 group-hover:text-slate-700'
                    }`}
                  >
                    <Icon className="h-[17px] w-[17px]" strokeWidth={1.85} aria-hidden="true" />
                  </span>
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </span>

                {item.adminTag && (
                  <span className="relative z-10 shrink-0 text-[11px] font-medium text-slate-400 whitespace-nowrap">
                    Admin
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200/80 pt-3.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.12 }}
          onClick={() => handleNavClick({ view: 'settings' })}
          aria-label="Open account and workspace settings"
          className="group flex min-h-[46px] w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors duration-150 hover:bg-white hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:ring-1 hover:ring-slate-200/80"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900/5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80"
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
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-slate-600"
            strokeWidth={1.85}
            aria-hidden="true"
          />
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.975 }}
          transition={{ duration: 0.12 }}
          onClick={onSignOut}
          className="group mt-1.5 flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-500 transition-colors duration-150 hover:bg-slate-200/50 hover:text-slate-900"
        >
          <LogOut
            className="h-4 w-4 shrink-0 text-slate-400 transition-colors duration-150 group-hover:text-slate-700"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>Sign out</span>
        </motion.button>
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white text-slate-900 lg:flex">
        {/* Persistent Desktop Sidebar */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 lg:border-r lg:border-slate-200/80">
          {renderSidebarBody(true, 'desktop')}
        </aside>

        {/* Mobile Header Bar (compact, single row, well under 15% viewport height) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12 }}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 transition-colors duration-150 hover:bg-slate-100"
            >
              <PanelLeft className="h-[19px] w-[19px]" strokeWidth={1.85} />
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.12 }}
              onClick={() => handleNavClick({ view: 'dashboard' })}
              className="font-display text-base font-semibold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
            >
              BrandFlow AI
            </motion.button>
          </div>

          {primaryAction && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.12 }}
              onClick={primaryAction.onClick}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-colors duration-150 hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              <span>New Brand</span>
            </motion.button>
          )}
        </header>

        {/* Mobile Slide-Over Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 z-50 lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile Navigation"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 bg-slate-950/35 backdrop-blur-[2px]"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-slate-200/90 bg-slate-50 shadow-2xl"
              >
                <div className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white px-4">
                  {renderBrandLockup(false)}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    transition={{ duration: 0.12 }}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close navigation menu"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-[18px] w-[18px]" strokeWidth={1.85} />
                  </motion.button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {renderSidebarBody(false, 'mobile')}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Main Content Viewport */}
        <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
          {/* Desktop Contextual Top Bar */}
          <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-8 border-b border-slate-200/80 bg-white/95 px-8 backdrop-blur-md lg:flex">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <div key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
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
                        className="truncate text-slate-500 transition-colors duration-150 hover:text-slate-900 whitespace-nowrap shrink-0"
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
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12 }}
                onClick={primaryAction.onClick}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors duration-150 hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                <span>{primaryAction.label}</span>
              </motion.button>
            )}
          </header>

          <main className="flex-1 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1200px]">{children}</div>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
