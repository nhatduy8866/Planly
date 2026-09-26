import { supabase } from '../supabase';
import {
  createGeminiProxyGateway,
  type GeminiProxyClient,
} from './geminiProxy';

export const generateGeminiContent = createGeminiProxyGateway(
  supabase as GeminiProxyClient | null,
);
