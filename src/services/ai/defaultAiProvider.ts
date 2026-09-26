import { PlanlyAiProvider } from './aiProvider';
import { generateGeminiContent } from './geminiProxyClient';

export const defaultAiProvider = new PlanlyAiProvider(generateGeminiContent);
