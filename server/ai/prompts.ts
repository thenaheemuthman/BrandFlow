export const PROMPT_VERSION = 1;

export type StrategyModule = 'brand_foundation' | 'brand_messaging';

export interface StrategyPrompt {
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
  build: (brand: Record<string, unknown>, approvedFoundation?: Record<string, unknown>) => string;
  reconstructed: boolean;
}

const restrictions = [
  'Use only information supplied in the brand context and explicitly approved upstream strategy.',
  'Do not invent company history, customer research, market share, certifications, results, testimonials, awards, statistics, or proof.',
  'When information is missing, state that it is missing and use null or an empty array as required by the schema.',
  'Separate facts supplied by the user from strategic recommendations and assumptions.',
  'Use clear, specific, commercially useful language. Avoid generic marketing clichés.',
  'Do not present proposed language as already approved or officially adopted by the business.',
];

const sharedSystem = `You are a senior brand strategist working on a real business. Produce practical, evidence-aware strategy that a business owner can review, edit and approve.\n\nRESTRICTIONS:\n${restrictions.map((item) => `- ${item}`).join('\n')}\n\nReturn valid JSON only. Do not wrap the response in markdown.`;

export const strategyPrompts: Record<StrategyModule, StrategyPrompt> = {
  brand_foundation: {
    key: 'brand_foundation_v1',
    name: 'Brand Foundation Development',
    module: 'brand_foundation',
    version: PROMPT_VERSION,
    aiRole: 'Senior Brand Strategist',
    requiredContext: ['Brand name', 'Business description', 'Industry', 'Products or services', 'Target market', 'Primary location'],
    inputs: ['Complete brand profile', 'Existing mission and vision, if supplied', 'Business goals', 'Competitors', 'Marketing challenges', 'Additional notes'],
    taskInstructions: [
      'Study the supplied business profile before proposing the foundation.',
      'Clarify why the brand exists, what it does, who it serves and the future it wants to help create.',
      'Identify a small set of meaningful core values and explain how each value should appear in behaviour.',
      'Define the brand personality, promise, central belief and manifesto.',
      'Develop differentiation and a positioning statement only where the supplied context supports them.',
      'Identify assumptions and missing information instead of inventing facts.',
    ],
    outputRequirements: ['brandPurpose', 'mission', 'vision', 'coreValues', 'brandPersonality', 'brandPromise', 'brandBelief', 'brandManifesto', 'differentiation', 'positioningStatement', 'assumptions', 'missingInformation', 'evidenceNotes'],
    qualityCriteria: ['Specific to this business', 'Consistent across all foundation elements', 'Easy for the owner to understand and approve', 'Evidence-aware and free of unsupported claims'],
    restrictions,
    systemInstruction: sharedSystem,
    reconstructed: true,
    build: (brand) => `Create a proposed brand foundation using this business profile:\n\n${JSON.stringify(brand, null, 2)}\n\nReturn a JSON object with these fields:\n- strategicSummary: concise summary of the proposed strategic direction\n- brandPurpose: why the brand exists beyond making sales; label a hypothesis if unsupported\n- mission: what the business does, for whom, and the value it delivers\n- vision: the future the business wants to help create\n- coreValues: 3 to 5 values, each with name, meaning, and observable behaviours\n- brandPersonality: 3 to 5 personality traits with short explanations\n- brandPromise: the consistent value or experience customers should expect\n- brandBelief: the central belief that guides the brand\n- brandManifesto: a concise, motivating statement of what the brand stands for\n- differentiation: meaningful points of distinction grounded in supplied information; identify evidence gaps\n- positioningStatement: audience, category, need, value and distinction in one concise statement\n- assumptions: explicit assumptions requiring owner confirmation\n- missingInformation: information that would materially improve this foundation\n- evidenceNotes: identify which statements come from the brief and which are strategic recommendations\n\nThis is a draft for owner review. Do not claim that proposed language is already the company's official mission, vision or values.`,
  },
  brand_messaging: {
    key: 'brand_messaging_v1',
    name: 'Brand Messaging Framework',
    module: 'brand_messaging',
    version: PROMPT_VERSION,
    aiRole: 'Senior Brand Messaging Strategist',
    requiredContext: ['Complete brand profile', 'Approved Brand Foundation'],
    inputs: ['Business profile', 'Approved brand purpose, mission, vision, values, personality, promise, belief, manifesto and positioning'],
    taskInstructions: [
      'Use the approved Brand Foundation as the strategic source of truth.',
      'Translate the foundation into a clear value proposition and unique selling proposition.',
      'Create core messages and selling points that explain the brand’s value without unsupported claims.',
      'Develop a practical messaging framework the owner can use consistently.',
      'Write a concise elevator pitch and brand introduction.',
      'Offer tagline options as proposals, not as existing slogans.',
      'Identify proof requirements, assumptions and missing information.',
    ],
    outputRequirements: ['positioningStatement', 'valueProposition', 'uniqueSellingProposition', 'taglineOptions', 'elevatorPitch', 'brandIntroduction', 'coreMessaging', 'sellingPoints', 'messagingFramework', 'brandVoice', 'assumptions', 'missingInformation', 'proofRequirements'],
    qualityCriteria: ['Directly aligned with the approved Brand Foundation', 'Clear and memorable without hype', 'Useful across sales and marketing touchpoints', 'No invented proof or customer research'],
    restrictions,
    systemInstruction: sharedSystem,
    reconstructed: true,
    build: (brand, foundation) => `Develop the brand messaging framework using the business profile and approved foundation below.\n\nBUSINESS PROFILE:\n${JSON.stringify(brand, null, 2)}\n\nAPPROVED BRAND FOUNDATION:\n${JSON.stringify(foundation, null, 2)}\n\nReturn a JSON object with these fields:\n- positioningStatement: concise positioning statement consistent with the approved foundation\n- valueProposition: who the brand helps, what outcome it enables and why its approach matters\n- uniqueSellingProposition: the clearest defensible reason to choose this business; state when evidence is insufficient\n- taglineOptions: up to 5 proposed taglines, each with a short rationale\n- elevatorPitch: natural 2 to 3 sentence explanation of the business\n- brandIntroduction: a slightly fuller introduction suitable for a website or business profile\n- coreMessaging: 3 to 5 core message themes, each with message, audience relevance and proof needed\n- sellingPoints: 3 to 5 concise selling points grounded in supplied facts\n- messagingFramework: practical message hierarchy with primary message, supporting messages and suggested calls to action\n- brandVoice: 3 to 5 voice attributes with descriptions and do/don't guidance\n- assumptions: explicit assumptions requiring owner confirmation\n- missingInformation: information needed to strengthen messaging\n- proofRequirements: claims that must not be published until supporting evidence is supplied\n\nDo not invent customer segments, customer quotes, testimonials, performance figures or proof. This is a draft for owner review.`,
  },
};
