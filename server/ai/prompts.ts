export const PROMPT_VERSION = 1;

export type StrategyModule = 'brand_foundation' | 'brand_messaging';

export interface StrategyPrompt {
  key: string;
  version: number;
  systemInstruction: string;
  build: (brand: Record<string, unknown>, approvedFoundation?: Record<string, unknown>) => string;
  reconstructed: boolean;
}

const sharedRules = [
  'Use only information supplied in the brand context and explicitly approved upstream strategy.',
  'Do not invent company history, customer research, market share, certifications, results, testimonials, awards, statistics, or proof.',
  'When information is missing, state that it is missing and use null or an empty array as required by the schema.',
  'Separate facts supplied by the user from strategic recommendations and assumptions.',
  'Use clear, specific, commercially useful language. Avoid generic marketing clichés.',
  'Do not pretend that assumptions are verified facts.',
].join('\n');

export const strategyPrompts: Record<StrategyModule, StrategyPrompt> = {
  brand_foundation: {
    key: 'brand_foundation_v1',
    version: PROMPT_VERSION,
    reconstructed: true,
    systemInstruction: `You are a senior brand strategist. Develop a rigorous, evidence-aware brand foundation for the business.\n\n${sharedRules}\n\nReturn valid JSON only. Do not wrap it in markdown.`,
    build: (brand) => `Create a proposed brand foundation using this business profile:\n\n${JSON.stringify(brand, null, 2)}\n\nProduce these fields:\n- strategicSummary: concise summary of the strategic direction\n- brandPurpose: why the brand exists beyond making sales; if unsupported, propose a clearly labelled hypothesis\n- mission: what the business does, for whom, and the value it delivers\n- vision: the future the business wants to help create\n- coreValues: 3 to 5 values, each with name, meaning, and observable behaviours\n- brandPromise: the consistent value or experience customers should expect\n- differentiation: meaningful points of distinction grounded in supplied information; identify gaps where evidence is missing\n- positioningStatement: audience, category, need, value and distinction in one concise statement\n- strategicPillars: 3 to 5 principles that should guide business and brand decisions\n- assumptions: explicit assumptions that require owner confirmation\n- missingInformation: information that would materially improve this foundation\n- evidenceNotes: which statements come directly from the brief and which are recommendations\n\nDo not claim that proposed language is already the company's official mission, vision or values. This is a draft for review.`,
  },
  brand_messaging: {
    key: 'brand_messaging_v1',
    version: PROMPT_VERSION,
    reconstructed: true,
    systemInstruction: `You are a senior brand messaging strategist. Translate the approved brand foundation into a practical messaging system.\n\n${sharedRules}\n\nReturn valid JSON only. Do not wrap it in markdown.`,
    build: (brand, foundation) => `Develop the brand messaging system using the business profile and approved foundation below.\n\nBUSINESS PROFILE:\n${JSON.stringify(brand, null, 2)}\n\nAPPROVED BRAND FOUNDATION:\n${JSON.stringify(foundation, null, 2)}\n\nProduce these fields:\n- messagingStrategy: concise explanation of the central messaging direction\n- primaryValueProposition: clear statement of who the brand helps, what outcome it enables and why its approach matters\n- supportingMessages: 3 to 5 message themes, each with message, audience relevance and supporting evidence needed\n- elevatorPitch: natural 2 to 3 sentence explanation of the business\n- brandVoice: 3 to 5 voice attributes, each with description and practical do/don't guidance\n- toneGuidelines: how tone should adapt while keeping a consistent voice\n- vocabulary: preferred words and phrases, words and phrases to avoid, and reasons\n- taglineOptions: up to 5 options; mark each as a creative proposal, not an existing slogan\n- proofRequirements: claims that should not be published until supporting evidence is supplied\n- assumptions: explicit assumptions requiring owner confirmation\n- missingInformation: information needed to strengthen messaging\n\nDo not invent customer segments, customer quotes, testimonials, performance figures or proof. Use only the approved foundation as strategic source material. This is a draft for review.`,
  },
};
