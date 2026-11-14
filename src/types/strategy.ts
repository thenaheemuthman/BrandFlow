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

export interface StrategyPromptTemplate {
  key: string;
  name: string;
  module: StrategyModule;
  version: number;
  aiRole: string;
  requiredContext: string[];
  inputs: string[];
  taskInstructions: string[];
  outputRequirements: string[];
  qualityCriteria: string[];
  restrictions: string[];
  systemInstruction: string;
  templatePreview: string;
  reconstructed: boolean;
}
