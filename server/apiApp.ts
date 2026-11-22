import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  BrandAccessError,
  CalendarValidationError,
  ContentAssetValidationError,
  ModuleValidationError,
  createStorageRepository,
  isValidModuleStatus,
  isValidStrategyModuleKey,
  validateServerBrandInput,
  type StorageRepository,
} from './storage.ts';
import {
  AI_REQUEST_BODY_LIMIT,
  GeminiConfigError,
  GeminiProviderError,
  GeminiTimeoutError,
  generateGeminiContent,
  validateAiGenerateBody,
  type GeminiGenerateFn,
} from './gemini.ts';
import type {
  AiErrorCategory,
  BrandFormInput,
  CreateContentAssetInput,
  CreateContentAssetVersionInput,
  CreateContentCalendarInput,
  CreateContentCalendarItemInput,
  UpdateContentAssetInput,
  UpdateContentCalendarInput,
  UpdateContentCalendarItemInput,
  UpsertBrandModuleInput,
  UserProfile,
} from '../src/types/brand.ts';
import {
  BrandContextIsolationError,
  PromptCompilationError,
  PromptNotFoundError,
  PromptStatusError,
  executePrompt,
} from '../src/prompts/index.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidBrandId(id: string): boolean {
  return UUID_REGEX.test(id.trim());
}

function validateUpsertModuleBody(
  body: unknown,
): { data?: UpsertBrandModuleInput; error?: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const raw = body as Record<string, unknown>;
  const data: UpsertBrandModuleInput = {};

  if (raw.status !== undefined) {
    if (typeof raw.status !== 'string' || !isValidModuleStatus(raw.status)) {
      return {
        error: 'Invalid module status. Supported values are not_started, in_progress, and completed.',
      };
    }
    data.status = raw.status;
  }

  if (raw.content !== undefined) {
    if (
      typeof raw.content !== 'object' ||
      raw.content === null ||
      Array.isArray(raw.content)
    ) {
      return { error: 'Strategy module content must be a JSON object.' };
    }
    data.content = raw.content as Record<string, unknown>;
  }

  if (raw.promptId !== undefined) {
    if (raw.promptId !== null && typeof raw.promptId !== 'string') {
      return { error: 'promptId must be a string or null.' };
    }
    data.promptId = raw.promptId;
  }

  if (raw.promptVersion !== undefined) {
    if (raw.promptVersion !== null && typeof raw.promptVersion !== 'string') {
      return { error: 'promptVersion must be a string or null.' };
    }
    data.promptVersion = raw.promptVersion;
  }

  if (raw.model !== undefined) {
    if (raw.model !== null && typeof raw.model !== 'string') {
      return { error: 'model must be a string or null.' };
    }
    data.model = raw.model;
  }

  if (raw.generatedAt !== undefined) {
    if (raw.generatedAt !== null) {
      if (typeof raw.generatedAt !== 'string' || Number.isNaN(Date.parse(raw.generatedAt))) {
        return { error: 'generatedAt must be a valid ISO timestamp string or null.' };
      }
    }
    data.generatedAt = raw.generatedAt;
  }

  if (
    data.status === undefined &&
    data.content === undefined &&
    data.promptId === undefined &&
    data.promptVersion === undefined &&
    data.model === undefined &&
    data.generatedAt === undefined
  ) {
    return { error: 'Provide status or content to update the strategy module.' };
  }

  return { data };
}

function handleModuleError(res: Response, err: unknown, fallbackMessage: string) {
  if (err instanceof BrandAccessError) {
    res.status(404).json({ error: 'Brand not found.' });
    return;
  }
  if (
    err instanceof ModuleValidationError ||
    err instanceof CalendarValidationError ||
    err instanceof ContentAssetValidationError
  ) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: err instanceof Error ? err.message : fallbackMessage });
}

/**
 * In Google AI Studio preview, an upstream Nginx reverse proxy intercepts
 * HTTP 502/503/504 responses (`error_page 502 503 504 = /warmup.html;`) and
 * replaces Express's sanitized JSON error body with HTTP 200 HTML.
 * When running behind that preview proxy (NGINX_PORT set), map 502/503/504
 * API error responses to HTTP 500 JSON (preserving `upstreamStatus` in the body)
 * so the client always receives the real sanitized error message.
 * Outside preview (Vercel, production, unit tests), return the exact status code.
 */
function sendGatewaySafeError(
  res: Response,
  statusCode: number,
  message: string,
  extra?: { errorCategory?: AiErrorCategory; requestId?: string; retryAfterSeconds?: number },
) {
  const behindPreviewNginx = Boolean(process.env.NGINX_PORT?.trim());
  const retryAfterSeconds =
    typeof extra?.retryAfterSeconds === 'number' &&
    Number.isFinite(extra.retryAfterSeconds) &&
    extra.retryAfterSeconds > 0
      ? Math.ceil(extra.retryAfterSeconds)
      : undefined;
  if (retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
  }
  const payload: Record<string, unknown> = {
    error: message,
    ...(extra?.errorCategory ? { errorCategory: extra.errorCategory } : {}),
    ...(extra?.requestId ? { requestId: extra.requestId } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
  if (
    behindPreviewNginx &&
    (statusCode === 502 || statusCode === 503 || statusCode === 504)
  ) {
    res.status(500).json({ ...payload, upstreamStatus: statusCode });
    return;
  }
  res.status(statusCode).json(payload);
}

interface AuthenticatedRequest extends Request {
  authenticatedUser?: { id: string; email: string };
  accessToken?: string;
}

async function requireOwner(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  const authorization = req.header('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const ownerUserId = process.env.BRANDFLOW_OWNER_USER_ID?.trim();
  if (!supabaseUrl || !anonKey || !ownerUserId) {
    res.status(503).json({ error: 'Authentication is not fully configured on the server.' });
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}` },
    });
    if (!response.ok) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      return;
    }
    const user = await response.json() as { id?: string; email?: string };
    if (!user.id || user.id !== ownerUserId) {
      res.status(403).json({ error: 'This account is not authorised to access this private workspace.' });
      return;
    }
    authReq.authenticatedUser = { id: user.id, email: user.email ?? '' };
    authReq.accessToken = match[1];
    next();
  } catch {
    res.status(503).json({ error: 'Unable to verify your session. Please try again.' });
  }
}

function getStorage(req: Request) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authenticatedUser || !authReq.accessToken) throw new Error('Unauthenticated request.');
  return createStorageRepository(authReq.authenticatedUser.id, authReq.accessToken, authReq.authenticatedUser.email);
}

export interface CreateApiAppOptions {
  generateAiContent?: GeminiGenerateFn;
  storageFactory?: (userId: string, accessToken: string, userEmail: string) => StorageRepository;
}

export function createApiApp(options?: CreateApiAppOptions) {
  const app = express();
  const generateAi: GeminiGenerateFn =
    options?.generateAiContent ??
    ((input, diagnostics) => generateGeminiContent(input, { diagnostics }));
  const resolveStorage = (req: Request): StorageRepository => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.authenticatedUser || !authReq.accessToken) {
      throw new Error('Unauthenticated request.');
    }
    if (options?.storageFactory) {
      return options.storageFactory(
        authReq.authenticatedUser.id,
        authReq.accessToken,
        authReq.authenticatedUser.email,
      );
    }
    return getStorage(req);
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', requireOwner);
  app.use('/api/ai/generate', express.json({ limit: AI_REQUEST_BODY_LIMIT }));
  app.use('/api/brands/:id/prompts/execute', express.json({ limit: AI_REQUEST_BODY_LIMIT }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/workspace/overview', async (req, res) => {
    try {
      const storage = resolveStorage(req);
      const [brands, activities, profile] = await Promise.all([
        storage.listBrands(), storage.listActivities(), storage.getProfile(),
      ]);
      res.json({ brands, activities, profile, storage: storage.getStorageStatus() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load workspace overview.' });
    }
  });

  app.get('/api/brands', async (req, res) => {
    try { res.json({ brands: await resolveStorage(req).listBrands() }); }
    catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load brands.' }); }
  });

  app.get('/api/brands/:id', async (req, res) => {
    try {
      const storage = resolveStorage(req);
      const brand = await storage.getBrand(req.params.id, req.query.trackAccess === 'true');
      if (!brand) { res.status(404).json({ error: 'Brand not found.' }); return; }
      res.json({ brand, activities: await storage.listActivities(brand.id) });
    } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load brand.' }); }
  });

  app.post('/api/brands', async (req, res) => {
    try {
      const payload = (req.body ?? {}) as BrandFormInput;
      const validationError = validateServerBrandInput(payload);
      if (validationError) { res.status(400).json({ error: validationError }); return; }
      res.status(201).json({ brand: await resolveStorage(req).createBrand(payload) });
    } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create brand.' }); }
  });

  app.put('/api/brands/:id', async (req, res) => {
    try {
      const payload = (req.body ?? {}) as BrandFormInput;
      const validationError = validateServerBrandInput(payload);
      if (validationError) { res.status(400).json({ error: validationError }); return; }
      const updated = await resolveStorage(req).updateBrand(req.params.id, payload);
      if (!updated) { res.status(404).json({ error: 'Brand not found.' }); return; }
      res.json({ brand: updated });
    } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update brand.' }); }
  });

  app.delete('/api/brands/:id', async (req, res) => {
    try {
      const deleted = await resolveStorage(req).deleteBrand(req.params.id);
      if (!deleted) { res.status(404).json({ error: 'Brand not found.' }); return; }
      res.json({ deleted: true });
    } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete brand.' }); }
  });

  app.get('/api/brands/:id/strategy-modules', async (req, res) => {
    const brandId = req.params.id.trim();
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }
    try {
      const modules = await resolveStorage(req).listBrandModules(brandId);
      res.json({ modules });
    } catch (err) {
      handleModuleError(res, err, 'Failed to load strategy modules.');
    }
  });

  app.get('/api/brands/:id/strategy-modules/:moduleKey', async (req, res) => {
    const brandId = req.params.id.trim();
    const moduleKey = req.params.moduleKey.trim();
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }
    if (!isValidStrategyModuleKey(moduleKey)) {
      res.status(400).json({
        error:
          'Unsupported strategy module key. Supported keys are brandFoundation, brandMessaging, customerIntelligence, marketingStrategy, and contentStrategy.',
      });
      return;
    }
    try {
      const module = await resolveStorage(req).getBrandModule(brandId, moduleKey);
      if (!module) {
        res.status(404).json({ error: 'Strategy module not found.' });
        return;
      }
      res.json({ module });
    } catch (err) {
      handleModuleError(res, err, 'Failed to load strategy module.');
    }
  });

  app.put('/api/brands/:id/strategy-modules/:moduleKey', async (req, res) => {
    const brandId = req.params.id.trim();
    const moduleKey = req.params.moduleKey.trim();
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }
    if (!isValidStrategyModuleKey(moduleKey)) {
      res.status(400).json({
        error:
          'Unsupported strategy module key. Supported keys are brandFoundation, brandMessaging, customerIntelligence, marketingStrategy, and contentStrategy.',
      });
      return;
    }
    const { data, error } = validateUpsertModuleBody(req.body);
    if (error || !data) {
      res.status(400).json({ error: error ?? 'Invalid strategy module payload.' });
      return;
    }
    try {
      const module = await resolveStorage(req).upsertBrandModule(brandId, moduleKey, data);
      res.json({ module });
    } catch (err) {
      handleModuleError(res, err, 'Failed to save strategy module.');
    }
  });

  app.delete('/api/brands/:id/strategy-modules/:moduleKey', async (req, res) => {
    const brandId = req.params.id.trim();
    const moduleKey = req.params.moduleKey.trim();
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }
    if (!isValidStrategyModuleKey(moduleKey)) {
      res.status(400).json({
        error:
          'Unsupported strategy module key. Supported keys are brandFoundation, brandMessaging, customerIntelligence, marketingStrategy, and contentStrategy.',
      });
      return;
    }
    try {
      const deleted = await resolveStorage(req).deleteBrandModule(brandId, moduleKey);
      if (!deleted) {
        res.status(404).json({ error: 'Strategy module not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      handleModuleError(res, err, 'Failed to delete strategy module.');
    }
  });

  app.post('/api/ai/generate', async (req, res) => {
    const { data, error } = validateAiGenerateBody(req.body);
    if (error || !data) {
      res.status(400).json({ error: error ?? 'Invalid AI generation request.' });
      return;
    }

    try {
      const result = await generateAi(data);
      res.json(result);
    } catch (err) {
      if (err instanceof GeminiConfigError) {
        sendGatewaySafeError(res, err.statusCode, err.message);
        return;
      }
      if (err instanceof GeminiTimeoutError || err instanceof GeminiProviderError) {
        sendGatewaySafeError(res, err.statusCode, err.message, {
          errorCategory: err.errorCategory,
          retryAfterSeconds: err instanceof GeminiProviderError ? err.retryAfterSeconds : undefined,
        });
        return;
      }
      sendGatewaySafeError(
        res,
        502,
        'AI generation failed due to an upstream provider error.',
      );
    }
  });

  app.post('/api/brands/:id/prompts/execute', async (req, res) => {
    const brandId = req.params.id.trim();
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID.' });
      return;
    }

    const body = req.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }

    const raw = body as Record<string, unknown>;
    const promptId = typeof raw.promptId === 'string' ? raw.promptId.trim() : '';
    if (!promptId) {
      res.status(400).json({ error: 'promptId is required and must be a string.' });
      return;
    }

    let version: string | undefined;
    if (raw.version !== undefined && raw.version !== null) {
      if (typeof raw.version !== 'string' || !raw.version.trim()) {
        res.status(400).json({ error: 'version must be a non-empty string when provided.' });
        return;
      }
      version = raw.version.trim();
    }

    let variables: Record<string, unknown> | undefined;
    if (raw.variables !== undefined && raw.variables !== null) {
      if (
        typeof raw.variables !== 'object' ||
        Array.isArray(raw.variables)
      ) {
        res.status(400).json({ error: 'variables must be a JSON object.' });
        return;
      }
      variables = raw.variables as Record<string, unknown>;
    }

    const includeApprovedModules = raw.includeApprovedModules === true;

    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    try {
      const authReq = req as AuthenticatedRequest;
      const storage = resolveStorage(req);
      const brand = await storage.getBrand(brandId, false);
      if (!brand) {
        res.status(404).json({ error: 'Brand not found.', requestId });
        return;
      }

      const strategyModules = includeApprovedModules
        ? await storage.listBrandModules(brandId)
        : [];

      const result = await executePrompt({
        promptId,
        version,
        brandId,
        brand,
        expectedOwnerUserId: authReq.authenticatedUser?.id,
        strategyModules,
        variables,
        executeAi: async (aiRequest) => {
          const { data, error } = validateAiGenerateBody(aiRequest);
          if (error || !data) {
            throw new PromptCompilationError(error ?? 'Compiled prompt failed server validation.');
          }
          return generateAi(data, {
            requestId,
            brandId,
            promptId,
            stage: 'execute_prompt',
          });
        },
      });

      const elapsedMs = Math.max(0, Date.now() - startedAt);

      if (result.status === 'missing_information') {
        res.status(422).json({
          ...result,
          errorCategory: 'missing_prerequisites',
          requestId,
        });
        return;
      }

      if (result.status === 'validation_error') {
        const isJsonParse = /malformed json|could not be parsed/i.test(result.error);
        const errorCategory: AiErrorCategory = isJsonParse
          ? 'json_parse_failure'
          : 'invalid_ai_response';
        // Log only sanitized schema validation metadata — never prompt contents, raw AI text, PII, or secrets.
        console.error(
          `[PromptExecute] requestId=${requestId} brandId=${brandId} promptId=${result.promptId} stage=validate_output elapsedMs=${elapsedMs} status=validation_error errorCategory=${errorCategory} model=${result.model} errorCount=${result.errors.length}`,
        );
        res.status(422).json({
          ...result,
          errorCategory,
          requestId,
        });
        return;
      }

      res.json(result);
    } catch (err) {
      const elapsedMs = Math.max(0, Date.now() - startedAt);
      if (err instanceof PromptNotFoundError) {
        res.status(err.statusCode).json({
          error: err.message,
          errorCategory: 'invalid_ai_response',
          requestId,
        });
        return;
      }
      if (
        err instanceof PromptStatusError ||
        err instanceof BrandContextIsolationError ||
        err instanceof PromptCompilationError
      ) {
        const errorCategory: AiErrorCategory = /exceeds.*limit|12000|24000/i.test(err.message)
          ? 'prompt_budget_exceeded'
          : /missing required/i.test(err.message)
            ? 'missing_prerequisites'
            : 'invalid_ai_response';
        console.error(
          `[PromptExecute] requestId=${requestId} brandId=${brandId} promptId=${promptId} stage=compile_prompt elapsedMs=${elapsedMs} status=client_error errorName=${err.name} errorCategory=${errorCategory} statusCode=${err.statusCode}`,
        );
        res.status(err.statusCode).json({
          error: err.message,
          errorCategory,
          requestId,
        });
        return;
      }
      if (
        err instanceof GeminiConfigError ||
        err instanceof GeminiTimeoutError ||
        err instanceof GeminiProviderError
      ) {
        console.error(
          `[PromptExecute] requestId=${requestId} brandId=${brandId} promptId=${promptId} stage=gemini_call elapsedMs=${elapsedMs} status=provider_error errorName=${err.name} errorCategory=${err.errorCategory} statusCode=${err.statusCode}`,
        );
        sendGatewaySafeError(res, err.statusCode, err.message, {
          errorCategory: err.errorCategory,
          requestId,
          retryAfterSeconds: err instanceof GeminiProviderError ? err.retryAfterSeconds : undefined,
        });
        return;
      }
      const unexpectedName = err instanceof Error ? err.name : 'UnknownError';
      console.error(
        `[PromptExecute] requestId=${requestId} brandId=${brandId} promptId=${promptId} stage=unexpected elapsedMs=${elapsedMs} status=unexpected_error errorName=${unexpectedName}`,
      );
      sendGatewaySafeError(
        res,
        502,
        'Prompt execution failed due to an unexpected error.',
        { errorCategory: 'provider_unavailable', requestId },
      );
    }
  });

  // ============================================================================
  // PHASE 2B: 30-DAY CONTENT CALENDAR ROUTES (BRAND-SCOPED & OWNER-AUTHENTICATED)
  // ============================================================================

  app.get('/api/brands/:id/calendars', async (req, res) => {
    const brandId = req.params.id;
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID format.' });
      return;
    }
    try {
      const calendars = await resolveStorage(req).listContentCalendars(brandId);
      res.json({ calendars });
    } catch (err) {
      handleModuleError(res, err, 'Failed to load content calendars.');
    }
  });

  app.post('/api/brands/:id/calendars', async (req, res) => {
    const brandId = req.params.id;
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID format.' });
      return;
    }
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }
    try {
      const calendar = await resolveStorage(req).createContentCalendar(
        brandId,
        req.body as CreateContentCalendarInput,
      );
      res.status(201).json({ calendar });
    } catch (err) {
      handleModuleError(res, err, 'Failed to create content calendar.');
    }
  });

  app.get('/api/brands/:id/calendars/:calendarId', async (req, res) => {
    const brandId = req.params.id;
    const calendarId = req.params.calendarId;
    if (!isValidBrandId(brandId) || !isValidBrandId(calendarId)) {
      res.status(400).json({ error: 'Invalid brand or calendar ID format.' });
      return;
    }
    try {
      const calendar = await resolveStorage(req).getContentCalendar(brandId, calendarId);
      if (!calendar) {
        res.status(404).json({ error: 'Content calendar not found.' });
        return;
      }
      res.json({ calendar });
    } catch (err) {
      handleModuleError(res, err, 'Failed to load content calendar.');
    }
  });

  app.patch('/api/brands/:id/calendars/:calendarId', async (req, res) => {
    const brandId = req.params.id;
    const calendarId = req.params.calendarId;
    if (!isValidBrandId(brandId) || !isValidBrandId(calendarId)) {
      res.status(400).json({ error: 'Invalid brand or calendar ID format.' });
      return;
    }
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }
    try {
      const calendar = await resolveStorage(req).updateContentCalendar(
        brandId,
        calendarId,
        req.body as UpdateContentCalendarInput,
      );
      if (!calendar) {
        res.status(404).json({ error: 'Content calendar not found.' });
        return;
      }
      res.json({ calendar });
    } catch (err) {
      handleModuleError(res, err, 'Failed to update content calendar.');
    }
  });

  app.delete('/api/brands/:id/calendars/:calendarId', async (req, res) => {
    const brandId = req.params.id;
    const calendarId = req.params.calendarId;
    if (!isValidBrandId(brandId) || !isValidBrandId(calendarId)) {
      res.status(400).json({ error: 'Invalid brand or calendar ID format.' });
      return;
    }
    try {
      const deleted = await resolveStorage(req).deleteContentCalendar(brandId, calendarId);
      if (!deleted) {
        res.status(404).json({ error: 'Content calendar not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      handleModuleError(res, err, 'Failed to delete content calendar.');
    }
  });

  app.post('/api/brands/:id/calendars/:calendarId/items/batch', async (req, res) => {
    const brandId = req.params.id;
    const calendarId = req.params.calendarId;
    if (!isValidBrandId(brandId) || !isValidBrandId(calendarId)) {
      res.status(400).json({ error: 'Invalid brand or calendar ID format.' });
      return;
    }
    const body = req.body as {
      items?: unknown;
      replaceBatchIndex?: unknown;
    };
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'items must be a non-empty array of calendar entries.' });
      return;
    }
    if (body.items.length > 35) {
      res.status(400).json({ error: 'Batch cannot exceed 35 calendar entries at once.' });
      return;
    }
    const replaceBatchIndex =
      typeof body.replaceBatchIndex === 'number' && Number.isInteger(body.replaceBatchIndex)
        ? body.replaceBatchIndex
        : null;
    try {
      const items = await resolveStorage(req).createContentCalendarItems(
        brandId,
        calendarId,
        body.items as CreateContentCalendarItemInput[],
        replaceBatchIndex,
      );
      res.status(201).json({ items });
    } catch (err) {
      handleModuleError(res, err, 'Failed to save calendar batch items.');
    }
  });

  app.post('/api/brands/:id/calendars/:calendarId/items', async (req, res) => {
    const brandId = req.params.id;
    const calendarId = req.params.calendarId;
    if (!isValidBrandId(brandId) || !isValidBrandId(calendarId)) {
      res.status(400).json({ error: 'Invalid brand or calendar ID format.' });
      return;
    }
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }
    try {
      const item = await resolveStorage(req).createContentCalendarItem(
        brandId,
        calendarId,
        req.body as CreateContentCalendarItemInput,
      );
      res.status(201).json({ item });
    } catch (err) {
      handleModuleError(res, err, 'Failed to add calendar entry.');
    }
  });

  app.patch('/api/brands/:id/calendars/:calendarId/items/:itemId', async (req, res) => {
    const brandId = req.params.id;
    const calendarId = req.params.calendarId;
    const itemId = req.params.itemId;
    if (!isValidBrandId(brandId) || !isValidBrandId(calendarId) || !isValidBrandId(itemId)) {
      res.status(400).json({ error: 'Invalid brand, calendar, or item ID format.' });
      return;
    }
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }
    try {
      const item = await resolveStorage(req).updateContentCalendarItem(
        brandId,
        calendarId,
        itemId,
        req.body as UpdateContentCalendarItemInput,
      );
      if (!item) {
        res.status(404).json({ error: 'Calendar entry not found.' });
        return;
      }
      res.json({ item });
    } catch (err) {
      handleModuleError(res, err, 'Failed to update calendar entry.');
    }
  });

  app.delete('/api/brands/:id/calendars/:calendarId/items/:itemId', async (req, res) => {
    const brandId = req.params.id;
    const calendarId = req.params.calendarId;
    const itemId = req.params.itemId;
    if (!isValidBrandId(brandId) || !isValidBrandId(calendarId) || !isValidBrandId(itemId)) {
      res.status(400).json({ error: 'Invalid brand, calendar, or item ID format.' });
      return;
    }
    try {
      const deleted = await resolveStorage(req).deleteContentCalendarItem(
        brandId,
        calendarId,
        itemId,
      );
      if (!deleted) {
        res.status(404).json({ error: 'Calendar entry not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      handleModuleError(res, err, 'Failed to delete calendar entry.');
    }
  });

  // ============================================================================
  // PHASE 2B: CONTENT STUDIO ROUTES (BRAND-SCOPED & OWNER-AUTHENTICATED)
  // ============================================================================

  app.get('/api/brands/:id/content-assets', async (req, res) => {
    const brandId = req.params.id;
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID format.' });
      return;
    }
    try {
      const assets = await resolveStorage(req).listContentAssets(brandId);
      res.json({ assets });
    } catch (err) {
      handleModuleError(res, err, 'Failed to load content assets.');
    }
  });

  app.post('/api/brands/:id/content-assets', async (req, res) => {
    const brandId = req.params.id;
    if (!isValidBrandId(brandId)) {
      res.status(400).json({ error: 'Invalid brand ID format.' });
      return;
    }
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }
    const raw = req.body as Record<string, unknown>;
    if (
      typeof raw.brandId === 'string' &&
      raw.brandId.trim() &&
      raw.brandId.trim() !== brandId.trim()
    ) {
      res.status(400).json({ error: 'Request brandId does not match route brand scope.' });
      return;
    }
    try {
      const asset = await resolveStorage(req).createContentAsset(
        brandId,
        req.body as CreateContentAssetInput,
      );
      res.status(201).json({ asset });
    } catch (err) {
      handleModuleError(res, err, 'Failed to create content asset.');
    }
  });

  app.get('/api/brands/:id/content-assets/:assetId', async (req, res) => {
    const brandId = req.params.id;
    const assetId = req.params.assetId;
    if (!isValidBrandId(brandId) || !isValidBrandId(assetId)) {
      res.status(400).json({ error: 'Invalid brand or asset ID format.' });
      return;
    }
    try {
      const asset = await resolveStorage(req).getContentAsset(brandId, assetId);
      if (!asset) {
        res.status(404).json({ error: 'Content asset not found.' });
        return;
      }
      res.json({ asset });
    } catch (err) {
      handleModuleError(res, err, 'Failed to load content asset.');
    }
  });

  app.patch('/api/brands/:id/content-assets/:assetId', async (req, res) => {
    const brandId = req.params.id;
    const assetId = req.params.assetId;
    if (!isValidBrandId(brandId) || !isValidBrandId(assetId)) {
      res.status(400).json({ error: 'Invalid brand or asset ID format.' });
      return;
    }
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }
    try {
      const asset = await resolveStorage(req).updateContentAsset(
        brandId,
        assetId,
        req.body as UpdateContentAssetInput,
      );
      if (!asset) {
        res.status(404).json({ error: 'Content asset not found.' });
        return;
      }
      res.json({ asset });
    } catch (err) {
      handleModuleError(res, err, 'Failed to update content asset.');
    }
  });

  app.post('/api/brands/:id/content-assets/:assetId/versions', async (req, res) => {
    const brandId = req.params.id;
    const assetId = req.params.assetId;
    if (!isValidBrandId(brandId) || !isValidBrandId(assetId)) {
      res.status(400).json({ error: 'Invalid brand or asset ID format.' });
      return;
    }
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }
    try {
      const asset = await resolveStorage(req).createContentAssetVersion(
        brandId,
        assetId,
        req.body as CreateContentAssetVersionInput,
      );
      if (!asset) {
        res.status(404).json({ error: 'Content asset not found.' });
        return;
      }
      res.status(201).json({ asset });
    } catch (err) {
      handleModuleError(res, err, 'Failed to create content asset version.');
    }
  });

  app.delete('/api/brands/:id/content-assets/:assetId', async (req, res) => {
    const brandId = req.params.id;
    const assetId = req.params.assetId;
    if (!isValidBrandId(brandId) || !isValidBrandId(assetId)) {
      res.status(400).json({ error: 'Invalid brand or asset ID format.' });
      return;
    }
    try {
      const deleted = await resolveStorage(req).deleteContentAsset(brandId, assetId);
      if (!deleted) {
        res.status(404).json({ error: 'Content asset not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      handleModuleError(res, err, 'Failed to delete content asset.');
    }
  });

  app.put('/api/profile', async (req, res) => {
    try {
      const patch = (req.body ?? {}) as Partial<UserProfile>;
      const profile = await resolveStorage(req).updateProfile(patch);
      res.json({ profile });
    } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update profile.' }); }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const typedErr = err as { type?: string; status?: number };
    if (typedErr?.type === 'entity.too.large' || typedErr?.status === 413) {
      res.status(413).json({ error: 'Request payload exceeds the allowed size limit.' });
      return;
    }
    if (typedErr?.type === 'entity.parse.failed' || typedErr?.status === 400) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
    res.status(500).json({ error: 'Unexpected server error.' });
  });

  return app;
}
