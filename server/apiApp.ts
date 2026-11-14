import express, { type NextFunction, type Request, type Response } from 'express';
import {
  createStorageRepository,
  validateServerBrandInput,
} from './storage.ts';
import type { BrandFormInput, UserProfile } from '../src/types/brand.ts';
import { getGeminiConnectionStatus, testGeminiConnection } from './ai/gemini.ts';

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

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', requireOwner);

  app.get('/api/ai/status', (_req, res) => {
    res.json(getGeminiConnectionStatus());
  });

  app.post('/api/ai/test', async (_req, res) => {
    try {
      const response = await testGeminiConnection();
      res.json({ ok: true, response });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gemini connection test failed.';
      const status = message.includes('not configured') ? 503 : 502;
      res.status(status).json({ error: message });
    }
  });

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

  app.put('/api/profile', async (req, res) => {
    try {
      const patch = (req.body ?? {}) as Partial<UserProfile>;
      const profile = await getStorage(req).updateProfile(patch);
      res.json({ profile });
    } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update profile.' }); }
  });

  return app;
}
