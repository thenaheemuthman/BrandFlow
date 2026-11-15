import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Brand, BrandStrategyModule } from '../../types/brand';
import type { AppRoute } from '../../utils/router';
import {
  TARGET_TEST_MODULE_KEY,
  buildInitialTestModuleInput,
  buildUpdatedTestModuleInput,
  createInitialStepReport,
  findExistingBrandFoundationModule,
  isConfirmedVerificationTestRecord,
  pickDefaultVerifyBrandId,
  sanitizeErrorMessage,
  sanitizeModuleDisplay,
  verifyModuleMatchesExpected,
  verifyTrackedModuleOwnership,
  type CrudStepKey,
  type CrudStepResult,
  type TrackedTestRecord,
} from '../../utils/phase2aVerifyLogic';

interface Phase2AVerifyViewProps {
  brands: Brand[];
  ownerUserId: string;
  onRefreshBrands: () => Promise<Brand[]>;
  onNavigate: (route: AppRoute) => void;
}

const STEP_ORDER: Array<{ key: CrudStepKey; label: string; description: string }> = [
  {
    key: 'CREATE',
    label: 'A. CREATE',
    description: 'Check no brandFoundation module exists, then create test record (in_progress).',
  },
  {
    key: 'READ',
    label: 'B. READ',
    description: 'Fetch the exact test module and verify payload, status, and brand match.',
  },
  {
    key: 'UPDATE',
    label: 'C. UPDATE',
    description: 'Update the tracked test module content and transition status to completed.',
  },
  {
    key: 'LIST',
    label: 'D. LIST',
    description: 'List all strategy modules for the brand and verify the tracked record appears.',
  },
  {
    key: 'DELETE',
    label: 'E. DELETE',
    description: 'Delete only the tracked test record created during this verification run.',
  },
];

function nowTimestamp(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function generateVerificationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function Phase2AVerifyView({
  brands,
  ownerUserId,
  onRefreshBrands,
  onNavigate,
}: Phase2AVerifyViewProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(() =>
    pickDefaultVerifyBrandId(brands),
  );
  const [report, setReport] = useState<Record<CrudStepKey, CrudStepResult>>(
    () => createInitialStepReport(),
  );
  const [trackedRecord, setTrackedRecord] = useState<TrackedTestRecord | null>(null);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [refreshingBrands, setRefreshingBrands] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'info' | 'warning' | 'error' | 'success';
    text: string;
  } | null>(null);

  const runningRef = useRef(false);

  useEffect(() => {
    if (brands.length === 0) return;
    const stillExists = brands.some((b) => b.id === selectedBrandId);
    if (!selectedBrandId || !stillExists) {
      setSelectedBrandId(pickDefaultVerifyBrandId(brands));
    }
  }, [brands, selectedBrandId]);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId),
    [brands, selectedBrandId],
  );

  const isBusy = activeAction !== null || refreshingBrands;

  const setStepResult = (
    step: CrudStepKey,
    status: CrudStepResult['status'],
    message: string,
  ) => {
    setReport((prev) => ({
      ...prev,
      [step]: {
        step,
        status,
        message,
        updatedAt: nowTimestamp(),
      },
    }));
  };

  const handleRefreshBrands = async () => {
    if (runningRef.current || refreshingBrands) return;
    setRefreshingBrands(true);
    try {
      const updated = await onRefreshBrands();
      if (updated.length > 0 && !updated.some((b) => b.id === selectedBrandId)) {
        setSelectedBrandId(pickDefaultVerifyBrandId(updated));
      }
      setStatusBanner({
        tone: 'info',
        text: `Loaded ${updated.length} brand${updated.length === 1 ? '' : 's'} for this owner session.`,
      });
    } catch (err) {
      setStatusBanner({
        tone: 'error',
        text: sanitizeErrorMessage(err),
      });
    } finally {
      setRefreshingBrands(false);
    }
  };

  const executeCreate = async (
    brand: Brand,
    currentTracked: TrackedTestRecord | null,
  ): Promise<TrackedTestRecord | null> => {
    if (currentTracked) {
      const msg = `An active test record is already tracked on "${currentTracked.brandName}". Clean it up before creating another.`;
      setStepResult('CREATE', 'FAIL', msg);
      setStatusBanner({ tone: 'warning', text: msg });
      return null;
    }

    setStepResult('CREATE', 'RUNNING', 'Checking for existing brandFoundation module...');
    const { modules } = await api.listStrategyModules(brand.id);
    const existing = findExistingBrandFoundationModule(modules);
    if (existing) {
      const label =
        typeof existing.content?.label === 'string' && existing.content.label
          ? ` (label: "${existing.content.label}")`
          : '';
      const msg = `Stopped: A brandFoundation module already exists for "${brand.brandName}" with status "${existing.status}"${label}. To protect existing data, this utility will not overwrite or delete it.`;
      setStepResult('CREATE', 'FAIL', msg);
      setStatusBanner({ tone: 'warning', text: msg });
      setLastPayload(sanitizeModuleDisplay(existing));
      return null;
    }

    const verificationId = generateVerificationId();
    const payload = buildInitialTestModuleInput(verificationId);
    setStepResult('CREATE', 'RUNNING', 'Creating temporary brandFoundation test module...');

    const { module } = await api.upsertStrategyModule(
      brand.id,
      TARGET_TEST_MODULE_KEY,
      payload,
    );

    const nextTracked: TrackedTestRecord = {
      id: module.id,
      userId: module.userId,
      brandId: module.brandId,
      brandName: brand.brandName,
      moduleKey: module.moduleKey,
      verificationId,
      phase: 'created',
    };

    const match = verifyModuleMatchesExpected(module, {
      id: module.id,
      userId: ownerUserId,
      brandId: brand.id,
      status: 'in_progress',
      content: payload.content as Record<string, unknown>,
    });

    setTrackedRecord(nextTracked);
    setLastPayload(sanitizeModuleDisplay(module));

    if (!match.ok) {
      setStepResult('CREATE', 'FAIL', match.reason ?? 'Created module failed verification.');
      return nextTracked;
    }

    setStepResult(
      'CREATE',
      'PASS',
      `Created temporary brandFoundation record (${module.id.slice(0, 8)}...) with status in_progress.`,
    );
    return nextTracked;
  };

  const executeRead = async (
    brand: Brand,
    currentTracked: TrackedTestRecord | null,
  ): Promise<boolean> => {
    const guard = verifyTrackedModuleOwnership(currentTracked, brand.id, ownerUserId);
    if (!guard.ok || !currentTracked) {
      setStepResult('READ', 'FAIL', guard.reason ?? 'Missing tracked test record.');
      return false;
    }

    setStepResult('READ', 'RUNNING', 'Retrieving tracked test module...');
    const { module } = await api.getStrategyModule(brand.id, TARGET_TEST_MODULE_KEY);
    setLastPayload(sanitizeModuleDisplay(module));

    const expectedInput =
      currentTracked.phase === 'updated'
        ? buildUpdatedTestModuleInput(currentTracked.verificationId)
        : buildInitialTestModuleInput(currentTracked.verificationId);

    const check = verifyModuleMatchesExpected(module, {
      id: currentTracked.id,
      userId: ownerUserId,
      brandId: brand.id,
      status: expectedInput.status!,
      content: expectedInput.content as Record<string, unknown>,
    });

    if (!check.ok) {
      setStepResult('READ', 'FAIL', check.reason ?? 'Retrieved payload mismatch.');
      return false;
    }

    setStepResult(
      'READ',
      'PASS',
      `Verified stored content and status "${module.status}" match expected payload.`,
    );
    return true;
  };

  const executeUpdate = async (
    brand: Brand,
    currentTracked: TrackedTestRecord | null,
  ): Promise<TrackedTestRecord | null> => {
    const guard = verifyTrackedModuleOwnership(currentTracked, brand.id, ownerUserId);
    if (!guard.ok || !currentTracked) {
      setStepResult('UPDATE', 'FAIL', guard.reason ?? 'Missing tracked test record.');
      return null;
    }

    const updatedPayload = buildUpdatedTestModuleInput(currentTracked.verificationId);
    setStepResult('UPDATE', 'RUNNING', 'Updating tracked test module to completed...');

    const { module } = await api.upsertStrategyModule(
      brand.id,
      TARGET_TEST_MODULE_KEY,
      updatedPayload,
    );
    setLastPayload(sanitizeModuleDisplay(module));

    const nextTracked: TrackedTestRecord = {
      ...currentTracked,
      phase: 'updated',
    };
    setTrackedRecord(nextTracked);

    const check = verifyModuleMatchesExpected(module, {
      id: currentTracked.id,
      userId: ownerUserId,
      brandId: brand.id,
      status: 'completed',
      content: updatedPayload.content as Record<string, unknown>,
    });

    if (!check.ok) {
      setStepResult('UPDATE', 'FAIL', check.reason ?? 'Updated payload mismatch.');
      return null;
    }

    setStepResult(
      'UPDATE',
      'PASS',
      'Updated test payload and verified returned status is completed.',
    );
    return nextTracked;
  };

  const executeList = async (
    brand: Brand,
    currentTracked: TrackedTestRecord | null,
  ): Promise<boolean> => {
    const guard = verifyTrackedModuleOwnership(currentTracked, brand.id, ownerUserId);
    if (!guard.ok || !currentTracked) {
      setStepResult('LIST', 'FAIL', guard.reason ?? 'Missing tracked test record.');
      return false;
    }

    setStepResult('LIST', 'RUNNING', 'Listing all strategy modules for brand...');
    const { modules } = await api.listStrategyModules(brand.id);
    const found = modules.find(
      (m: BrandStrategyModule) =>
        m.id === currentTracked.id &&
        m.userId === ownerUserId &&
        m.moduleKey === TARGET_TEST_MODULE_KEY,
    );

    if (!found) {
      setStepResult(
        'LIST',
        'FAIL',
        'Tracked test module did not appear in listStrategyModules response.',
      );
      return false;
    }

    setLastPayload(sanitizeModuleDisplay(found));
    setStepResult(
      'LIST',
      'PASS',
      `Confirmed tracked test module appears in list (${modules.length} module${modules.length === 1 ? '' : 's'} returned).`,
    );
    return true;
  };

  const executeDelete = async (
    brand: Brand,
    currentTracked: TrackedTestRecord | null,
  ): Promise<boolean> => {
    const guard = verifyTrackedModuleOwnership(currentTracked, brand.id, ownerUserId);
    if (!guard.ok || !currentTracked) {
      setStepResult('DELETE', 'FAIL', guard.reason ?? 'No tracked test record to delete.');
      return false;
    }

    setStepResult('DELETE', 'RUNNING', 'Verifying record identity before cleanup...');
    const { module: liveModule } = await api.getStrategyModule(
      brand.id,
      TARGET_TEST_MODULE_KEY,
    );

    if (!isConfirmedVerificationTestRecord(liveModule, currentTracked)) {
      const msg =
        'Cleanup aborted: live record does not match the verification run ID created by this panel.';
      setStepResult('DELETE', 'FAIL', msg);
      setStatusBanner({ tone: 'error', text: msg });
      return false;
    }

    setStepResult('DELETE', 'RUNNING', 'Deleting tracked test module...');
    const result = await api.deleteStrategyModule(brand.id, TARGET_TEST_MODULE_KEY);
    if (!result.deleted) {
      setStepResult('DELETE', 'FAIL', 'API returned deleted=false.');
      return false;
    }

    setTrackedRecord(null);
    setStepResult(
      'DELETE',
      'PASS',
      `Deleted tracked test module (${currentTracked.id.slice(0, 8)}...) cleanly.`,
    );
    return true;
  };

  const runGuarded = async (actionName: string, fn: () => Promise<void>) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setActiveAction(actionName);
    setStatusBanner(null);
    try {
      await fn();
    } finally {
      runningRef.current = false;
      setActiveAction(null);
    }
  };

  const handleStep = (step: CrudStepKey) => {
    if (!selectedBrand) {
      setStatusBanner({ tone: 'warning', text: 'Select a brand first.' });
      return;
    }

    void runGuarded(step, async () => {
      try {
        if (step === 'CREATE') {
          await executeCreate(selectedBrand, trackedRecord);
        } else if (step === 'READ') {
          await executeRead(selectedBrand, trackedRecord);
        } else if (step === 'UPDATE') {
          await executeUpdate(selectedBrand, trackedRecord);
        } else if (step === 'LIST') {
          await executeList(selectedBrand, trackedRecord);
        } else if (step === 'DELETE') {
          await executeDelete(selectedBrand, trackedRecord);
        }
      } catch (err) {
        const message = sanitizeErrorMessage(err);
        setStepResult(step, 'FAIL', message);
        setStatusBanner({ tone: 'error', text: `${step} failed: ${message}` });
      }
    });
  };

  const handleCleanupTracked = () => {
    if (!trackedRecord) return;
    const targetBrand = brands.find((b) => b.id === trackedRecord.brandId);
    if (!targetBrand) {
      setStatusBanner({
        tone: 'error',
        text: 'Cannot locate tracked brand in current list. Refresh brands and retry cleanup.',
      });
      return;
    }

    void runGuarded('CLEANUP', async () => {
      try {
        const ok = await executeDelete(targetBrand, trackedRecord);
        if (ok) {
          setStatusBanner({
            tone: 'success',
            text: `Cleaned up temporary test record on "${targetBrand.brandName}".`,
          });
        }
      } catch (err) {
        const message = sanitizeErrorMessage(err);
        setStepResult('DELETE', 'FAIL', message);
        setStatusBanner({
          tone: 'error',
          text: `Cleanup failed: ${message}. You can retry Cleanup Test Record.`,
        });
      }
    });
  };

  const handleRunFullSuite = () => {
    if (!selectedBrand) {
      setStatusBanner({ tone: 'warning', text: 'Select a brand first.' });
      return;
    }
    if (trackedRecord) {
      setStatusBanner({
        tone: 'warning',
        text: `Clean up the existing tracked test record on "${trackedRecord.brandName}" before starting a full suite run.`,
      });
      return;
    }

    void runGuarded('SUITE', async () => {
      setReport(createInitialStepReport());
      setLastPayload(null);

      let activeTracked: TrackedTestRecord | null = null;
      let deletedInSuite = false;
      let currentStep: CrudStepKey = 'CREATE';

      try {
        activeTracked = await executeCreate(selectedBrand, null);
        if (!activeTracked) return;

        currentStep = 'READ';
        const readInitialOk = await executeRead(selectedBrand, activeTracked);
        if (!readInitialOk) return;

        currentStep = 'UPDATE';
        const updatedTracked = await executeUpdate(selectedBrand, activeTracked);
        if (!updatedTracked) return;
        activeTracked = updatedTracked;

        currentStep = 'READ';
        const readAfterUpdateOk = await executeRead(selectedBrand, activeTracked);
        if (!readAfterUpdateOk) return;

        currentStep = 'LIST';
        const listOk = await executeList(selectedBrand, activeTracked);
        if (!listOk) return;

        currentStep = 'DELETE';
        deletedInSuite = await executeDelete(selectedBrand, activeTracked);
        if (deletedInSuite) {
          setStatusBanner({
            tone: 'success',
            text: 'All 5 Phase 2A CRUD checks passed and the temporary record was cleaned up.',
          });
        }
      } catch (err) {
        const message = sanitizeErrorMessage(err);
        setStepResult(currentStep, 'FAIL', message);
        setStatusBanner({
          tone: 'error',
          text: `${currentStep} failed: ${message}`,
        });
      } finally {
        if (activeTracked && !deletedInSuite) {
          try {
            const cleaned = await executeDelete(selectedBrand, activeTracked);
            if (!cleaned) {
              setStatusBanner({
                tone: 'warning',
                text: 'A previous step failed and automatic cleanup did not complete. Use "Clean Up Test Record" below.',
              });
            }
          } catch (cleanupErr) {
            const cleanupMsg = sanitizeErrorMessage(cleanupErr);
            setStepResult('DELETE', 'FAIL', `Cleanup failed: ${cleanupMsg}`);
            setStatusBanner({
              tone: 'error',
              text: `Step failed and auto-cleanup failed (${cleanupMsg}). Use "Clean Up Test Record" to retry.`,
            });
          }
        }
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate({ view: 'settings' })}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          <span>Back to Settings</span>
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
          <FlaskConical className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Temporary Diagnostic Utility</span>
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Phase 2A Live API Verification
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Temporary owner-only verification harness to test authenticated CRUD operations on{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
            /api/brands/:id/strategy-modules
          </code>{' '}
          using your active session. Pre-existing strategy modules are never overwritten or deleted.
        </p>
      </div>

      {/* Persistent Cleanup Banner if a tracked record remains */}
      {trackedRecord && (
        <section
          aria-label="Active Test Record Cleanup"
          className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
                <span>Tracked Temporary Test Record Active</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-amber-900">
                Brand: <strong>{trackedRecord.brandName}</strong> · Module:{' '}
                <code className="font-mono">{trackedRecord.moduleKey}</code> · Record ID:{' '}
                <code className="font-mono">{trackedRecord.id}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={handleCleanupTracked}
              disabled={isBusy}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              {activeAction === 'CLEANUP' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              )}
              <span>Clean Up Test Record</span>
            </button>
          </div>
        </section>
      )}

      {/* Status Alert Banner */}
      {statusBanner && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm ${
            statusBanner.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : statusBanner.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : statusBanner.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
          }`}
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <p className="leading-relaxed">{statusBanner.text}</p>
        </div>
      )}

      {/* Brand Selector */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">1. Target Brand</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Defaults to &ldquo;The Naheem Uthman&rdquo; when present in your brands list.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefreshBrands()}
            disabled={isBusy}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingBrands ? 'animate-spin' : ''}`} />
            <span>Refresh Brands</span>
          </button>
        </div>

        <div className="mt-4">
          <label
            htmlFor="verify-brand-select"
            className="block text-xs font-medium text-slate-700"
          >
            Select Brand Workspace
          </label>
          {brands.length === 0 ? (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600">
              No brands found for this owner account. Create a brand first before running Phase 2A CRUD checks.
            </p>
          ) : (
            <select
              id="verify-brand-select"
              value={selectedBrandId}
              disabled={isBusy}
              onChange={(e) => {
                setSelectedBrandId(e.target.value);
                setReport(createInitialStepReport());
                setLastPayload(null);
                setStatusBanner(null);
              }}
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50"
            >
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.brandName} ({brand.industry})
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* Action Controls */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">2. CRUD Controls</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Run the full guarded sequence or trigger individual steps manually.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunFullSuite}
            disabled={isBusy || !selectedBrand}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {activeAction === 'SUITE' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" strokeWidth={2} />
            )}
            <span>{activeAction === 'SUITE' ? 'Running Suite...' : 'Run Full CRUD Suite'}</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {STEP_ORDER.map((item) => {
            const isStepDisabled =
              isBusy ||
              !selectedBrand ||
              (item.key !== 'CREATE' && (!trackedRecord || trackedRecord.brandId !== selectedBrand.id)) ||
              (item.key === 'CREATE' && Boolean(trackedRecord));
            const isThisRunning = activeAction === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleStep(item.key)}
                disabled={isStepDisabled}
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.key === 'DELETE'
                    ? 'border-red-200 bg-red-50/70 text-red-700 hover:bg-red-100'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {isThisRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Results Report */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">3. Verification Report</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Live pass/fail summary for each endpoint step (tokens and headers are never shown).
        </p>

        <ul className="mt-4 divide-y divide-slate-100">
          {STEP_ORDER.map((item) => {
            const result = report[item.key];
            return (
              <li
                key={item.key}
                data-testid={`verify-row-${item.key}`}
                className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.key}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                        result.status === 'PASS'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : result.status === 'FAIL'
                            ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                            : result.status === 'RUNNING'
                              ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {result.status === 'PASS' && <CheckCircle2 className="h-3 w-3" />}
                      {result.status === 'FAIL' && <XCircle className="h-3 w-3" />}
                      {result.status === 'RUNNING' && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span>{result.status}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {result.message || item.description}
                  </p>
                </div>

                {result.updatedAt && (
                  <span className="shrink-0 font-mono text-[11px] text-slate-400 tabular-nums">
                    {result.updatedAt}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Sanitized Module Snapshot */}
      {lastPayload && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            Last Returned Strategy Module Payload (Sanitized)
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50 p-3.5 font-mono text-xs leading-relaxed text-slate-800">
            {JSON.stringify(lastPayload, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
