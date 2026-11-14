import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createStorageRepository,
  validateServerBrandInput,
} from './server/storage.ts';
import type { BrandFormInput, UserProfile } from './src/types/brand.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const storage = createStorageRepository();

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storage: storage.getStorageStatus(),
    });
  });

  app.get('/api/workspace/overview', async (_req, res) => {
    try {
      const [brands, activities, profile] = await Promise.all([
        storage.listBrands(),
        storage.listActivities(),
        storage.getProfile(),
      ]);
      res.json({
        brands,
        activities,
        profile,
        storage: storage.getStorageStatus(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspace overview.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/brands', async (_req, res) => {
    try {
      const brands = await storage.listBrands();
      res.json({ brands });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load brands.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/brands/:id', async (req, res) => {
    try {
      const trackAccess = req.query.trackAccess === 'true';
      const brand = await storage.getBrand(req.params.id, trackAccess);
      if (!brand) {
        res.status(404).json({ error: 'Brand not found.' });
        return;
      }
      const activities = await storage.listActivities(brand.id);
      res.json({ brand, activities });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load brand.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/brands', async (req, res) => {
    try {
      const payload = (req.body ?? {}) as BrandFormInput;
      const validationError = validateServerBrandInput(payload);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      const brand = await storage.createBrand(payload);
      res.status(201).json({ brand });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create brand.';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/brands/:id', async (req, res) => {
    try {
      const payload = (req.body ?? {}) as BrandFormInput;
      const validationError = validateServerBrandInput(payload);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      const updated = await storage.updateBrand(req.params.id, payload);
      if (!updated) {
        res.status(404).json({ error: 'Brand not found.' });
        return;
      }
      res.json({ brand: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update brand.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/brands/:id', async (req, res) => {
    try {
      const deleted = await storage.deleteBrand(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Brand not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete brand.';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/profile', async (req, res) => {
    try {
      const patch = (req.body ?? {}) as Partial<UserProfile>;
      const profile = await storage.updateProfile(patch);
      res.json({ profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`BrandFlow AI server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BrandFlow AI server:', err);
  process.exit(1);
});
