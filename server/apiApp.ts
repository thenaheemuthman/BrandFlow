import express, { type NextFunction, type Request, type Response } from 'express';
import {
  BrandAccessError,
  ModuleValidationError,
  createStorageRepository,
  isValidModuleStatus,
  isValidStrategyModuleKey,
  validateServerBrandInput,
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
  BrandFormInput,
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
  if (err instanceof ModuleValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: err instanceof Error ? err.message : fallbackMessage });
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
}

export function createApiApp(options?: CreateApiAppOptions) {
  const app = express();
  const generateAi = options?.generateAiContent ?? ((input) => generateGeminiContent(input));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', requireOwner);
  app.use('/api/ai/generate', express.json({ limit: AI_REQUEST_BODY_LIMIT }));
  app.use('/api/brands/:id/prompts/execute', express.json({ limit: AI_REQUEST_BODY_LIMIT }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/workspace/overview', async (req, res) => {
    try {
      const storage = getStorage(req);
      const [brands, activities, profile] = await Promise.all([
        storage.listBrands(), storage.listActivities(), storage.getProfile(),
      ]);
      res.json({ brands, activities, profile, storage: storage.getStorageStatus() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load workspace overview.' });
    }
  });

  app.get('/api/brands', async (req, res) => {
    try { res.json({ brands: await getStorage(req).listBrands() }); }
    catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load brands.' }); }
  });

  app.get('/api/brands/:id', async (req, res) => {
    try {
      const storage = getStorage(req);
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
      res.status(201).json({ brand: await getStorage(req).createBrand(payload) });
    } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create brand.' }); }
  });

  app.put('/api/brands/:id', async (req, res) => {
    try {
      const payload = (req.body ?? {}) as BrandFormInput;
      const validationError = validateServerBrandInput(payload);
      if (validationError) { res.status(400).json({ error: validationError }); return; }
      const updated = await getStorage(req).updateBrand(req.params.id, payload);
      if (!updated) { res.status(404).json({ error: 'Brand not found.' }); return; }
      res.json({ brand: updated });
    } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update brand.' }); }
  });

  app.delete('/api/brands/:id', async (req, res) => {
    try {
      const deleted = await getStorage(req).deleteBrand(req.params.id);
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
      const modules = await getStorage(req).listBrandModules(brandId);
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
          'Unsupported strategy module key. Supported keys are brandFoundation, brandMessaging, and customerIntelligence.',
      });
      return;
    }
    try {
      const module = await getStorage(req).getBrandModule(brandId, moduleKey);
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
          'Unsupported strategy module key. Supported keys are brandFoundation, brandMessaging, and customerIntelligence.',
      });
      return;
    }
    const { data, error } = validateUpsertModuleBody(req.body);
    if (error || !data) {
      res.status(400).json({ error: error ?? 'Invalid strategy module payload.' });
      return;
    }
    try {
      const module = await getStorage(req).upsertBrandModule(brandId, moduleKey, data);
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
          'Unsupported strategy module key. Supported keys are brandFoundation, brandMessaging, and customerIntelligence.',
      });
      return;
    }
    try {
      const deleted = await getStorage(req).deleteBrandModule(brandId, moduleKey);
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
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      if (err instanceof GeminiTimeoutError || err instanceof GeminiProviderError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(502).json({ error: 'AI generation failed due to an upstream provider error.' });
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

    try {
      const authReq = req as AuthenticatedRequest;
      const storage = getStorage(req);
      const brand = await storage.getBrand(brandId, false);
      if (!brand) {
        res.status(404).json({ error: 'Brand not found.' });
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
          return generateAi(data);
        },
      });

      if (result.status === 'missing_information') {
        res.status(422).json(result);
        return;
      }

      if (result.status === 'validation_error') {
        res.status(502).json(result);
        return;
      }

      res.json(result);
    } catch (err) {
      if (err instanceof PromptNotFoundError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      if (
        err instanceof PromptStatusError ||
        err instanceof BrandContextIsolationError ||
        err instanceof PromptCompilationError
      ) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      if (
        err instanceof GeminiConfigError ||
        err instanceof GeminiTimeoutError ||
        err instanceof GeminiProviderError
      ) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(502).json({ error: 'Prompt execution failed due to an unexpected error.' });
    }
  });

  app.put('/api/profile', async (req, res) => {
    try {
      const patch = (req.body ?? {}) as Partial<UserProfile>;
      const profile = await getStorage(req).updateProfile(patch);
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
