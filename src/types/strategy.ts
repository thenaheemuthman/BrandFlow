export type StrategyModule = 'brand_foundation' | 'brand_messaging';
export type StrategyDocumentStatus = 'draft' | 'approved' | 'rejected' | 'superseded' | 'stale';

export interface StrategyDocument {
  id: string;
  brandId: string;
  moduleKey: StrategyModule;
  version: number;
  status: StrategyDocumentStatus;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}
