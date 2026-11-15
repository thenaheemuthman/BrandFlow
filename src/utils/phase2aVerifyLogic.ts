import type {
  AiGenerateRequest,
  AiGenerateResponse,
  Brand,
  BrandStrategyModule,
  ModuleStatus,
  Phase2AModuleKey,
  UpsertBrandModuleInput,
} from '../types/brand';

export type CrudStepKey = 'CREATE' | 'READ' | 'UPDATE' | 'LIST' | 'DELETE';

export type CrudStepStatus = 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL';

export interface CrudStepResult {
  step: CrudStepKey;
  status: CrudStepStatus;
  message: string;
  updatedAt: string | null;
}

export interface TrackedTestRecord {
  id: string;
  userId: string;
  brandId: string;
  brandName: string;
  moduleKey: Phase2AModuleKey;
  verificationId: string;
  phase: 'created' | 'updated';
}

export const PREFERRED_VERIFY_BRAND_NAME = 'The Naheem Uthman';
export const TARGET_TEST_MODULE_KEY: Phase2AModuleKey = 'brandFoundation';
export const GEMINI_SMOKE_TEST_MODEL = 'gemini-4-hydrogen' as const;

export const GEMINI_SMOKE_TEST_REQUEST: AiGenerateRequest = {
  prompt:
    'Reply with exactly this sentence and nothing else: BrandFlow AI Gemini integration is working.',
  model: GEMINI_SMOKE_TEST_MODEL,
};

export interface GeminiSmokeTestResult {
  status: CrudStepStatus;
  model: string | null;
  generatedAt: string | null;
  text: string | null;
  error: string | null;
  checkedAt: string | null;
}

export function createInitialGeminiSmokeTestResult(): GeminiSmokeTestResult {
  return {
    status: 'PENDING',
    model: null,
    generatedAt: null,
    text: null,
    error: null,
    checkedAt: null,
  };
}

export function evaluateGeminiSmokeTestResponse(
  response: AiGenerateResponse,
  checkedAt: string | null = null,
): GeminiSmokeTestResult {
  const text = typeof response?.text === 'string' ? response.text.trim() : '';
  const model = typeof response?.model === 'string' && response.model.trim()
    ? response.model.trim()
    : null;
  const generatedAt =
    typeof response?.generatedAt === 'string' && response.generatedAt.trim()
      ? response.generatedAt.trim()
      : null;

  if (!text) {
    return {
      status: 'FAIL',
      model,
      generatedAt,
      text: null,
      error: 'Gemini returned an empty response.',
      checkedAt,
    };
  }

  if (model !== GEMINI_SMOKE_TEST_MODEL) {
    return {
      status: 'FAIL',
      model,
      generatedAt,
      text,
      error: `Expected model "${GEMINI_SMOKE_TEST_MODEL}" but received "${model ?? 'none'}".`,
      checkedAt,
    };
  }

  return {
    status: 'PASS',
    model,
    generatedAt,
    text,
    error: null,
    checkedAt,
  };
}

export function createInitialStepReport(): Record<CrudStepKey, CrudStepResult> {
  return {
    CREATE: { step: 'CREATE', status: 'PENDING', message: 'Not yet run', updatedAt: null },
    READ: { step: 'READ', status: 'PENDING', message: 'Not yet run', updatedAt: null },
    UPDATE: { step: 'UPDATE', status: 'PENDING', message: 'Not yet run', updatedAt: null },
    LIST: { step: 'LIST', status: 'PENDING', message: 'Not yet run', updatedAt: null },
    DELETE: { step: 'DELETE', status: 'PENDING', message: 'Not yet run', updatedAt: null },
  };
}

export function pickDefaultVerifyBrandId(brands: Brand[]): string {
  if (brands.length === 0) return '';
  const target = PREFERRED_VERIFY_BRAND_NAME.toLowerCase();
  const preferred = brands.find((b) => b.brandName.trim().toLowerCase() === target);
  return preferred ? preferred.id : brands[0].id;
}

export function buildInitialTestModuleInput(verificationId: string): UpsertBrandModuleInput {
  return {
    status: 'in_progress',
    content: {
      testRun: true,
      label: 'Phase 2A Live CRUD Verification',
      description: 'Temporary integration test record',
      verificationId,
    },
  };
}

export function buildUpdatedTestModuleInput(verificationId: string): UpsertBrandModuleInput {
  return {
    status: 'completed',
    content: {
      testRun: true,
      label: 'Phase 2A Live CRUD Verification (Updated)',
      description: 'Updated temporary integration test record',
      verificationId,
      updated: true,
    },
  };
}

export function findExistingBrandFoundationModule(
  modules: BrandStrategyModule[],
): BrandStrategyModule | undefined {
  return modules.find((m) => m.moduleKey === TARGET_TEST_MODULE_KEY);
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (typeof actual !== typeof expected || actual === null || expected === null) {
    return false;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    return actual.every((item, idx) => valuesEqual(item, expected[idx]));
  }
  if (typeof actual === 'object' && typeof expected === 'object' && !Array.isArray(actual) && !Array.isArray(expected)) {
    const aObj = actual as Record<string, unknown>;
    const eObj = expected as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const eKeys = Object.keys(eObj).sort();
    if (!valuesEqual(aKeys, eKeys)) return false;
    return aKeys.every((key) => valuesEqual(aObj[key], eObj[key]));
  }
  return false;
}

export function verifyModuleMatchesExpected(
  actual: BrandStrategyModule,
  expected: {
    id: string;
    userId: string;
    brandId: string;
    status: ModuleStatus;
    content: Record<string, unknown>;
  },
): { ok: boolean; reason?: string } {
  if (actual.id !== expected.id) {
    return { ok: false, reason: 'Returned module ID does not match the tracked test record.' };
  }
  if (actual.userId !== expected.userId) {
    return { ok: false, reason: 'Returned module ownership does not match the current owner.' };
  }
  if (actual.brandId !== expected.brandId) {
    return { ok: false, reason: 'Returned module brand association does not match.' };
  }
  if (actual.moduleKey !== TARGET_TEST_MODULE_KEY) {
    return { ok: false, reason: `Unexpected module key "${actual.moduleKey}".` };
  }
  if (actual.status !== expected.status) {
    return {
      ok: false,
      reason: `Expected status "${expected.status}" but received "${actual.status}".`,
    };
  }
  if (!valuesEqual(actual.content, expected.content)) {
    return { ok: false, reason: 'Returned module content does not match the test payload.' };
  }
  return { ok: true };
}

export function verifyTrackedModuleOwnership(
  tracked: TrackedTestRecord | null,
  selectedBrandId: string,
  ownerUserId: string,
): { ok: boolean; reason?: string } {
  if (!tracked) {
    return {
      ok: false,
      reason: 'No tracked test record exists for this run. Run CREATE first.',
    };
  }
  if (tracked.brandId !== selectedBrandId) {
    return {
      ok: false,
      reason: `A tracked test record belongs to "${tracked.brandName}". Clean up that record before testing another brand.`,
    };
  }
  if (!ownerUserId || tracked.userId !== ownerUserId) {
    return {
      ok: false,
      reason: 'Tracked record ownership does not match the signed-in owner.',
    };
  }
  if (tracked.moduleKey !== TARGET_TEST_MODULE_KEY) {
    return {
      ok: false,
      reason: 'Tracked record module key does not match the verification target.',
    };
  }
  return { ok: true };
}

export function isConfirmedVerificationTestRecord(
  module: BrandStrategyModule,
  tracked: TrackedTestRecord,
): boolean {
  return (
    module.id === tracked.id &&
    module.userId === tracked.userId &&
    module.brandId === tracked.brandId &&
    module.moduleKey === TARGET_TEST_MODULE_KEY &&
    module.content?.testRun === true &&
    module.content?.verificationId === tracked.verificationId
  );
}

export function sanitizeModuleDisplay(module: BrandStrategyModule): Record<string, unknown> {
  return {
    id: module.id,
    brandId: module.brandId,
    moduleKey: module.moduleKey,
    status: module.status,
    content: module.content,
    updatedAt: module.updatedAt,
  };
}

export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unexpected error.';
  const firstLine = raw.split(/\r?\n/)[0]?.trim() || 'Request failed.';
  const redacted = firstLine
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-token]')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted-key]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[redacted-key]');
  return redacted.length > 260 ? `${redacted.slice(0, 257)}...` : redacted;
}
