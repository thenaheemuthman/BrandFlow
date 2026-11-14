import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './services/api';
import type {
  ActivityEvent,
  Brand,
  BrandFormInput,
  StorageStatus,
  UserProfile,
  WorkspaceSection,
} from './types/brand';
import { parseRoute, routeToPath, type AppRoute } from './utils/router';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { MyBrandsView } from './components/brands/MyBrandsView';
import { BrandFormView } from './components/brands/BrandFormView';
import { BrandWorkspaceView } from './components/workspace/BrandWorkspaceView';
import { ContentStudioGlobalView } from './components/sections/ContentStudioGlobalView';
import { WritingStylesView } from './components/sections/WritingStylesView';
import { PromptLibraryView } from './components/sections/PromptLibraryView';
import { SettingsView } from './components/sections/SettingsView';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { ToastBanner, type ToastMessage } from './components/common/ToastBanner';
import { useAuth } from './auth/AuthProvider';
import { LoginView } from './components/auth/LoginView';

const INITIAL_PROFILE: UserProfile = {
  id: 'user-default',
  fullName: 'Uthman Aheem',
  email: 'uthmanaheem@gmail.com',
  role: 'Brand Strategist',
  organization: 'BrandFlow Workspace',
};

const INITIAL_STORAGE: StorageStatus = {
  mode: 'local-file',
  persisted: true,
  supabaseConfigured: false,
  geminiConfigured: false,
  requiredEnvVars: [],
};

const SECTION_LABELS: Record<WorkspaceSection, string> = {
  overview: 'Overview',
  'brand-foundation': 'Brand Foundation',
  'brand-messaging': 'Brand Messaging',
  'customer-intelligence': 'Customer Intelligence',
  'marketing-strategy': 'Marketing Strategy',
  'content-strategy': 'Content Strategy',
  'content-calendar': 'Content Calendar',
  'content-studio': 'Content Studio',
  'brand-settings': 'Brand Settings',
};

export function App() {
  const auth = useAuth();
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRoute(window.location.pathname),
  );
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [storage, setStorage] = useState<StorageStatus>(INITIAL_STORAGE);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const [formDirty, setFormDirty] = useState<boolean>(false);
  const [pendingRoute, setPendingRoute] = useState<AppRoute | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({
      id: `${Date.now()}`,
      type,
      message,
    });
  }, []);

  const refreshOverview = useCallback(async () => {
    try {
      const data = await api.getWorkspaceOverview();
      setBrands(data.brands);
      setActivities(data.activities);
      setProfile(data.profile);
      setStorage(data.storage);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load workspace data.';
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (auth.loading || !auth.session) return;
    setLoading(true);
    void refreshOverview();
  }, [auth.loading, auth.session, refreshOverview]);

  useEffect(() => {
    const handlePopState = () => {
      setFormDirty(false);
      setFormError(null);
      setRoute(parseRoute(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!formDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formDirty]);

  const commitNavigation = useCallback((nextRoute: AppRoute) => {
    const nextPath = routeToPath(nextRoute);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    setFormDirty(false);
    setFormError(null);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const handleNavigate = useCallback(
    (nextRoute: AppRoute) => {
      if (formDirty) {
        setPendingRoute(nextRoute);
        return;
      }
      commitNavigation(nextRoute);
    },
    [formDirty, commitNavigation],
  );

  // Track brand workspace access when entering a brand workspace
  const activeWorkspaceBrandId =
    route.view === 'brand-workspace' ? route.brandId : null;

  useEffect(() => {
    if (!activeWorkspaceBrandId) return;
    let cancelled = false;
    api
      .getBrand(activeWorkspaceBrandId, true)
      .then((res) => {
        if (cancelled) return;
        setBrands((prev) =>
          prev.map((b) => (b.id === res.brand.id ? res.brand : b)),
        );
        return api.getWorkspaceOverview();
      })
      .then((overview) => {
        if (cancelled || !overview) return;
        setActivities(overview.activities);
      })
      .catch(() => {
        // Brand may not exist; handled gracefully in render
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceBrandId]);

  const activeBrand = useMemo(() => {
    if (route.view === 'brand-workspace' || route.view === 'brand-edit') {
      return brands.find((b) => b.id === route.brandId);
    }
    return undefined;
  }, [brands, route]);

  const brandActivities = useMemo(() => {
    if (!activeBrand) return [];
    return activities.filter((a) => a.brandId === activeBrand.id);
  }, [activities, activeBrand]);

  const handleCreateBrand = async (input: BrandFormInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const { brand } = await api.createBrand(input);
      setFormDirty(false);
      await refreshOverview();
      showToast('success', `${brand.brandName} created and saved.`);
      commitNavigation({
        view: 'brand-workspace',
        brandId: brand.id,
        section: 'overview',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create brand.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBrand = async (
    brandId: string,
    input: BrandFormInput,
    redirectRoute: AppRoute,
  ) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const { brand } = await api.updateBrand(brandId, input);
      setFormDirty(false);
      await refreshOverview();
      showToast('success', `Updated ${brand.brandName}.`);
      commitNavigation(redirectRoute);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update brand.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!brandToDelete) return;
    setDeleting(true);
    try {
      const deletedName = brandToDelete.brandName;
      const deletedId = brandToDelete.id;
      await api.deleteBrand(deletedId);
      setBrandToDelete(null);
      setFormDirty(false);
      await refreshOverview();
      showToast('success', `Deleted ${deletedName}.`);
      if (
        (route.view === 'brand-workspace' || route.view === 'brand-edit') &&
        route.brandId === deletedId
      ) {
        commitNavigation({ view: 'brands' });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete brand.';
      showToast('error', message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveProfile = async (patch: Partial<UserProfile>) => {
    try {
      const { profile: updated } = await api.updateProfile(patch);
      setProfile(updated);
      showToast('success', 'Workspace profile updated.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update profile.';
      showToast('error', message);
    }
  };

  const breadcrumbs = useMemo(() => {
    switch (route.view) {
      case 'dashboard':
        return [{ label: 'Dashboard' }];
      case 'brands':
        return [
          { label: 'Dashboard', route: { view: 'dashboard' } as AppRoute },
          { label: 'My Brands' },
        ];
      case 'brand-new':
        return [
          { label: 'My Brands', route: { view: 'brands' } as AppRoute },
          { label: 'Create New Brand' },
        ];
      case 'brand-edit':
        return [
          { label: 'My Brands', route: { view: 'brands' } as AppRoute },
          {
            label: activeBrand?.brandName ?? 'Brand',
            route: activeBrand
              ? ({
                  view: 'brand-workspace',
                  brandId: activeBrand.id,
                  section: 'overview',
                } as AppRoute)
              : undefined,
          },
          { label: 'Edit Brand' },
        ];
      case 'brand-workspace':
        return [
          { label: 'My Brands', route: { view: 'brands' } as AppRoute },
          {
            label: activeBrand?.brandName ?? 'Brand Workspace',
            route: activeBrand
              ? ({
                  view: 'brand-workspace',
                  brandId: activeBrand.id,
                  section: 'overview',
                } as AppRoute)
              : undefined,
          },
          ...(route.section !== 'overview'
            ? [{ label: SECTION_LABELS[route.section] }]
            : []),
        ];
      case 'content-studio':
        return [
          { label: 'Dashboard', route: { view: 'dashboard' } as AppRoute },
          { label: 'Content Studio' },
        ];
      case 'writing-styles':
        return [
          { label: 'Dashboard', route: { view: 'dashboard' } as AppRoute },
          { label: 'Writing Styles' },
        ];
      case 'prompt-library':
        return [
          { label: 'Dashboard', route: { view: 'dashboard' } as AppRoute },
          { label: 'Prompt Library' },
        ];
      case 'settings':
        return [
          { label: 'Dashboard', route: { view: 'dashboard' } as AppRoute },
          { label: 'Settings' },
        ];
    }
  }, [route, activeBrand]);

  const topBarAction =
    route.view === 'dashboard' ||
    route.view === 'brands' ||
    route.view === 'brand-new' ||
    route.view === 'brand-edit'
      ? undefined
      : {
          label: 'Create New Brand',
          onClick: () => handleNavigate({ view: 'brand-new' }),
        };

  if (auth.loading) {
    return <main className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500">Loading your private workspace…</main>;
  }
  if (!auth.session) return <LoginView />;

  return (
    <>
      <AppShell
        currentRoute={route}
        breadcrumbs={breadcrumbs}
        primaryAction={topBarAction}
        profile={profile}
        onNavigate={handleNavigate}
        onSignOut={() => void auth.signOut()}
      >
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

        {route.view === 'dashboard' && (
          <DashboardView
            brands={brands}
            activities={activities}
            profile={profile}
            loading={loading}
            onNavigate={handleNavigate}
          />
        )}

        {route.view === 'brands' && (
          <MyBrandsView
            brands={brands}
            loading={loading}
            onNavigate={handleNavigate}
            onRequestDelete={(brand) => setBrandToDelete(brand)}
          />
        )}

        {route.view === 'brand-new' && (
          <BrandFormView
            mode="create"
            submitting={submitting}
            serverError={formError}
            onDirtyChange={setFormDirty}
            onSubmit={handleCreateBrand}
            onCancel={() =>
              handleNavigate(
                brands.length > 0 ? { view: 'brands' } : { view: 'dashboard' },
              )
            }
          />
        )}

        {route.view === 'brand-edit' && (
          <>
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
            ) : activeBrand ? (
              <BrandFormView
                mode="edit"
                initialBrand={activeBrand}
                submitting={submitting}
                serverError={formError}
                onDirtyChange={setFormDirty}
                onSubmit={(input) =>
                  handleUpdateBrand(activeBrand.id, input, {
                    view: 'brand-workspace',
                    brandId: activeBrand.id,
                    section: 'overview',
                  })
                }
                onCancel={() =>
                  handleNavigate({
                    view: 'brand-workspace',
                    brandId: activeBrand.id,
                    section: 'overview',
                  })
                }
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <h1 className="text-lg font-semibold text-slate-900">
                  Brand not found
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  The requested brand may have been removed.
                </p>
                <button
                  type="button"
                  onClick={() => handleNavigate({ view: 'brands' })}
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Back to My Brands
                </button>
              </div>
            )}
          </>
        )}

        {route.view === 'brand-workspace' && (
          <>
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
            ) : activeBrand ? (
              <BrandWorkspaceView
                brand={activeBrand}
                activities={brandActivities}
                section={route.section}
                submitting={submitting}
                serverError={formError}
                onSelectSection={(section) =>
                  handleNavigate({
                    view: 'brand-workspace',
                    brandId: activeBrand.id,
                    section,
                  })
                }
                onNavigate={handleNavigate}
                onUpdateBrand={(input) =>
                  handleUpdateBrand(activeBrand.id, input, {
                    view: 'brand-workspace',
                    brandId: activeBrand.id,
                    section: 'overview',
                  })
                }
                onRequestDelete={(brand) => setBrandToDelete(brand)}
                onDirtyChange={setFormDirty}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <h1 className="text-lg font-semibold text-slate-900">
                  Workspace not found
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  This brand workspace does not exist or has been deleted.
                </p>
                <button
                  type="button"
                  onClick={() => handleNavigate({ view: 'brands' })}
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  View My Brands
                </button>
              </div>
            )}
          </>
        )}

        {route.view === 'content-studio' && (
          <ContentStudioGlobalView brands={brands} onNavigate={handleNavigate} />
        )}

        {route.view === 'writing-styles' && (
          <WritingStylesView onNavigate={handleNavigate} />
        )}

        {route.view === 'prompt-library' && (
          <PromptLibraryView onNavigate={handleNavigate} />
        )}

        {route.view === 'settings' && (
          <SettingsView
            profile={profile}
            storage={storage}
            onSaveProfile={handleSaveProfile}
          />
        )}
      </AppShell>

      {/* Delete Brand Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(brandToDelete)}
        title={`Delete ${brandToDelete?.brandName ?? 'brand'}?`}
        description="This permanently deletes the brand profile and its workspace records. You cannot undo this action."
        confirmLabel="Delete Brand"
        variant="danger"
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setBrandToDelete(null);
        }}
      />

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(pendingRoute)}
        title="Discard unsaved changes?"
        description="You have unsaved changes in this brand form. Leaving now will discard your edits."
        confirmLabel="Discard Changes"
        cancelLabel="Continue Editing"
        variant="primary"
        onConfirm={() => {
          if (pendingRoute) {
            const target = pendingRoute;
            setPendingRoute(null);
            commitNavigation(target);
          }
        }}
        onCancel={() => setPendingRoute(null)}
      />
    </>
  );
}

export default App;
