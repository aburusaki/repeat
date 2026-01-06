
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Category, Sentence } from '../types';

/**
 * Robust environment variable retrieval for frontend environments.
 */
const getEnvValue = (key: string): string => {
  try {
    // 1. Check process.env (Standard/Node Polyfill)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
    
    // 2. Check window.process.env (Some browser polyfills)
    // @ts-ignore
    if (typeof window !== 'undefined' && (window as any).process?.env?.[key]) return (window as any).process.env[key];
    
    // 3. Check import.meta.env (Vite/Modern ESM)
    // @ts-ignore
    const meta = import.meta as any;
    if (meta.env && meta.env[key]) return meta.env[key];
    
    // 4. Check VITE_ prefix (Common Vite requirement)
    const viteKey = `VITE_${key}`;
    if (meta.env && meta.env[viteKey]) return meta.env[viteKey];
  } catch (e) {}
  return '';
};

const getSupabaseConfig = () => {
  // Check for both the "REPEAT_" prefixed versions and standard versions
  const url = getEnvValue('REPEAT_SUPABASE_URL') || getEnvValue('SUPABASE_URL');
  const key = getEnvValue('REPEAT_SUPABASE_ANON_KEY') || getEnvValue('SUPABASE_ANON_KEY');

  return { url, key };
};

// Internal cache for the client
let supabaseClient: SupabaseClient | null = null;

export const supabaseService = {
  /**
   * Returns the Supabase client, initializing it if necessary.
   */
  getClient(): SupabaseClient {
    if (supabaseClient) return supabaseClient;
    const { url, key } = getSupabaseConfig();
    supabaseClient = createClient(
      url || 'https://placeholder.supabase.co', 
      key || 'placeholder'
    );
    return supabaseClient;
  },

  /**
   * Diagnostic info for troubleshooting connection issues.
   */
  getDebugInfo() {
    const { url, key } = getSupabaseConfig();
    const mask = (s: string) => s ? `${s.substring(0, 10)}...${s.substring(s.length - 4)}` : 'MISSING';
    return {
      urlFound: !!url,
      keyFound: !!key,
      maskedUrl: mask(url),
      maskedKey: mask(key)
    };
  },

  isConfigured(): boolean {
    const { url, key } = getSupabaseConfig();
    return !!(url && key && !url.includes('placeholder') && url.length > 10);
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      const debug = this.getDebugInfo();
      return { 
        success: false, 
        message: `Variables missing. URL: ${debug.urlFound ? 'OK' : 'MISSING'}, Key: ${debug.keyFound ? 'OK' : 'MISSING'}.` 
      };
    }
    try {
      const client = this.getClient();
      // Simple query to test RLS and connection
      const { error } = await client.from('categories').select('id').limit(1);
      if (error) throw error;
      return { success: true, message: "Connection verified." };
    } catch (e: any) {
      console.error("Supabase Connection Error:", e);
      return { success: false, message: `Database error: ${e.message || 'Check your Supabase URL/Key.'}` };
    }
  },

  async syncData(): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const client = this.getClient();
      const [catsRes, sentsRes] = await Promise.all([
        client.from('categories').select('*').order('name'),
        client.from('sentences').select('id, text').order('created_at', { ascending: false })
      ]);

      if (catsRes.data) localStorage.setItem('zen_categories_cache', JSON.stringify(catsRes.data));
      if (sentsRes.data) localStorage.setItem('zen_sentences_cache', JSON.stringify(sentsRes.data));
    } catch (e) {
      console.error("Sync error:", e);
    }
  },

  async addCategory(name: string): Promise<{ data: Category | null; error: string | null }> {
    if (!this.isConfigured()) return { data: null, error: "Database not configured." };
    try {
      const { data, error } = await this.getClient().from('categories').insert([{ name }]).select();
      if (error) return { data: null, error: error.message };
      await this.syncData(); 
      return { data: data?.[0] || null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },

  async addSentence(text: string, categoryIds: (string | number)[]): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Database not configured." };
    try {
      const client = this.getClient();
      const { data: sentence, error: sError } = await client.from('sentences').insert([{ text }]).select();
      if (sError) return { success: false, error: sError.message };
      
      if (sentence && sentence[0] && categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ sentence_id: sentence[0].id, category_id: catId }));
        await client.from('sentence_categories').insert(links);
      }
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  getCategories(): Category[] {
    try {
      const cached = localStorage.getItem('zen_categories_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  },

  getRandomSentence(): string {
    try {
      const cached = localStorage.getItem('zen_sentences_cache');
      const sentences: Sentence[] = cached ? JSON.parse(cached) : [];
      if (sentences.length === 0) return "Adopt the pace of nature: her secret is patience.";
      return sentences[Math.floor(Math.random() * sentences.length)].text;
    } catch { return "True peace comes from within."; }
  }
};
