import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODEL } from './gemini.ts';
import { strategyPrompts, type StrategyModule } from './prompts.ts';

export interface StrategyResult {
  id: string;
  brandId: string;
  moduleKey: StrategyModule;
  version: number;
  status: 'draft' | 'approved' | 'rejected' | 'superseded';
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

const requiredBrandFields = ['brandName', 'businessDescription', 'industry', 'productsOrServices', 'targetMarket', 'primaryLocation'];

function assertBrandContext(brand: Record<string, unknown>) {
  const missing = requiredBrandFields.filter((key) => !String(brand[key] ?? '').trim());
  if (missing.length) {
    throw new Error(`Complete these brand profile fields before generating strategy: ${missing.join(', ')}.`);
  }
}

function parseGeneratedJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/i, '');
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini returned an invalid strategy format. Please regenerate.');
  }
  return parsed as Record<string, unknown>;
}

function mapDocument(row: any): StrategyResult {
  return {
    id: row.id,
    brandId: row.brand_id,
    moduleKey: row.module_key,
    version: row.version,
    status: row.status,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
  };
}

export class StrategyService {
  private readonly baseUrl: string;
  private readonly anonKey: string;
  private readonly accessToken: string;
  private readonly userId: string;

  constructor(baseUrl: string, anonKey: string, accessToken: string, userId: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.anonKey = anonKey;
    this.accessToken = accessToken;
    this.userId = userId;
  }

  private async db<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Strategy storage request failed (${response.status}): ${detail}`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? JSON.parse(text) as T : undefined as T;
  }

  async list(brandId: string, moduleKey: StrategyModule): Promise<StrategyResult[]> {
    const rows = await this.db<any[]>(
      `brand_strategy_documents?brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${moduleKey}&select=*&order=version.desc`,
    );
    return rows.map(mapDocument);
  }

  async getApproved(brandId: string, moduleKey: StrategyModule): Promise<StrategyResult | null> {
    const rows = await this.db<any[]>(
      `brand_strategy_documents?brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${moduleKey}&status=eq.approved&select=*&order=version.desc&limit=1`,
    );
    return rows[0] ? mapDocument(rows[0]) : null;
  }

  async generate(brand: Record<string, unknown>, moduleKey: StrategyModule, approvedFoundation?: Record<string, unknown>): Promise<StrategyResult> {
    assertBrandContext(brand);
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error('Gemini is not configured. Add GEMINI_API_KEY to Vercel before generating strategy.');
    }
    const prompt = strategyPrompts[moduleKey];
    const context = { brand, approvedFoundation: approvedFoundation ?? null };
    const ai = new GoogleGenAI({ apiKey });
    let output: Record<string, unknown>;

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt.build(brand, approvedFoundation),
        config: {
          systemInstruction: prompt.systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.35,
          maxOutputTokens: 7000,
        },
      });
      const text = response.text?.trim();
      if (!text) throw new Error('Gemini returned an empty response.');
      output = parseGeneratedJson(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gemini generation failed.';
      await this.db('brand_ai_generations', {
        method: 'POST',
        body: JSON.stringify({
          user_id: this.userId,
          brand_id: brand.id,
          module_key: moduleKey,
          prompt_key: prompt.key,
          prompt_version: prompt.version,
          model: GEMINI_MODEL,
          input_context: context,
          status: 'failed',
          error_message: message.slice(0, 1000),
        }),
      }).catch(() => undefined);
      throw error;
    }

    const generations = await this.db<any[]>('brand_ai_generations?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brand.id,
        module_key: moduleKey,
        prompt_key: prompt.key,
        prompt_version: prompt.version,
        model: GEMINI_MODEL,
        input_context: context,
        output_content: output,
        status: 'generated',
      }),
    });
    const generationId = generations[0]?.id;
    if (!generationId) throw new Error('The generated result could not be recorded. Please try again.');

    const prior = await this.list(String(brand.id), moduleKey);
    const nextVersion = prior.reduce((max, item) => Math.max(max, item.version), 0) + 1;
    if (prior.some((item) => item.status === 'approved')) {
      await this.db(
        `brand_strategy_documents?brand_id=eq.${encodeURIComponent(String(brand.id))}&module_key=eq.${moduleKey}&status=eq.approved`,
        { method: 'PATCH', body: JSON.stringify({ status: 'superseded' }) },
      );
    }

    const rows = await this.db<any[]>('brand_strategy_documents', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: this.userId,
        brand_id: brand.id,
        module_key: moduleKey,
        version: nextVersion,
        status: 'draft',
        content: output,
        source_generation_id: generationId,
      }),
    });
    if (!rows[0]) throw new Error('The generated draft could not be saved.');
    return mapDocument(rows[0]);
  }

  async saveDraft(brandId: string, moduleKey: StrategyModule, documentId: string, content: Record<string, unknown>): Promise<StrategyResult> {
    const existing = await this.db<any[]>(
      `brand_strategy_documents?id=eq.${encodeURIComponent(documentId)}&brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${moduleKey}&status=eq.draft&select=*`,
    );
    if (!existing[0]) throw new Error('Only an existing draft can be edited.');
    const rows = await this.db<any[]>(
      `brand_strategy_documents?id=eq.${encodeURIComponent(documentId)}&brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${moduleKey}&status=eq.draft`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ content, updated_at: new Date().toISOString() }),
      },
    );
    if (!rows[0]) throw new Error('The draft could not be saved.');
    return mapDocument(rows[0]);
  }

  async approve(brandId: string, moduleKey: StrategyModule, documentId: string): Promise<StrategyResult> {
    const current = await this.db<any[]>(
      `brand_strategy_documents?id=eq.${encodeURIComponent(documentId)}&brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${moduleKey}&status=eq.draft&select=*`,
    );
    if (!current[0]) throw new Error('Only a draft can be approved.');
    await this.db(
      `brand_strategy_documents?brand_id=eq.${encodeURIComponent(brandId)}&module_key=eq.${moduleKey}&status=eq.approved`,
      { method: 'PATCH', body: JSON.stringify({ status: 'superseded' }) },
    );
    const rows = await this.db<any[]>(
      `brand_strategy_documents?id=eq.${encodeURIComponent(documentId)}&brand_id=eq.${encodeURIComponent(brandId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      },
    );
    if (!rows[0]) throw new Error('The draft could not be approved.');
    return mapDocument(rows[0]);
  }
}
