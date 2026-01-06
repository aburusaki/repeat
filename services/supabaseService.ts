
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Category, Sentence } from '../types';

/**
 * Static access to environment variables.
 * Many bundlers (Vite, Webpack, Vercel) replace these literal strings during build.
 */
const getSupabaseConfig = () => {
  // Try to get from LocalStorage first (Manual override)
  const manualUrl = localStorage.getItem('SB_OVERRIDE_URL');
  const manualKey = localStorage.getItem('SB_OVERRIDE_KEY');
  
  if (manualUrl && manualKey) {
    return { url: manualUrl, key: manualKey };
  }

  // Attempt static access - DO NOT use dynamic [key] access as it fails in most frontend builds
  let url = '';
  let key = '';

  try {
    // @ts-ignore
    url = process.env.REPEAT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_REPEAT_SUPABASE_URL || '';
    // @ts-ignore
    key = process.env.REPEAT_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_REPEAT_SUPABASE_ANON_KEY || '';

    // ESM Fallback
    const meta = import.meta as any;
    if (!url && meta.env) {
      url = meta.env.REPEAT_SUPABASE_URL || meta.env.VITE_REPEAT_SUPABASE_URL || meta.env.SUPABASE_URL || '';
      key = meta.env.REPEAT_SUPABASE_ANON_KEY || meta.env.VITE_REPEAT_SUPABASE_ANON_KEY || meta.env.SUPABASE_ANON_KEY || '';
    }
  } catch (e) {}

  return { url, key };
};

let supabaseClient: SupabaseClient | null = null;

export const supabaseService = {
  getClient(): SupabaseClient {
    const { url, key } = getSupabaseConfig();
    // Re-initialize if config changed or not yet created
    if (!supabaseClient || (supabaseClient as any).supabaseUrl !== url) {
      supabaseClient = createClient(
        url || 'https://placeholder.supabase.co', 
        key || 'placeholder'
      );
    }
    return supabaseClient;
  },

  setManualConfig(url: string, key: string) {
    localStorage.setItem('SB_OVERRIDE_URL', url);
    localStorage.setItem('SB_OVERRIDE_KEY', key);
    // Reset client to use new config
    supabaseClient = null;
  },

  clearManualConfig() {
    localStorage.removeItem('SB_OVERRIDE_URL');
    localStorage.removeItem('SB_OVERRIDE_KEY');
    supabaseClient = null;
  },

  getDebugInfo() {
    const { url, key } = getSupabaseConfig();
    const isManual = !!localStorage.getItem('SB_OVERRIDE_URL');
    const mask = (s: string) => s && s.length > 10 ? `${s.substring(0, 8)}...${s.substring(s.length - 4)}` : 'NOT FOUND';
    return {
      urlFound: !!url,
      keyFound: !!key,
      maskedUrl: mask(url),
      maskedKey: mask(key),
      isManual
    };
  },

  isConfigured(): boolean {
    const { url, key } = getSupabaseConfig();
    return !!(url && key && url.length > 15 && !url.includes('placeholder'));
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: "No configuration found." };
    }
    try {
      const { error } = await this.getClient().from('categories').select('id').limit(1);
      if (error) throw error;
      return { success: true, message: "Connected!" };
    } catch (e: any) {
      return { success: false, message: e.message || "Connection failed." };
    }
  },

  async syncData(): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const client = this.getClient();
      const [cats, sents] = await Promise.all([
        client.from('categories').select('*').order('name'),
        client.from('sentences').select('id, text').order('created_at', { ascending: false })
      ]);
      if (cats.data) localStorage.setItem('zen_categories_cache', JSON.stringify(cats.data));
      if (sents.data) localStorage.setItem('zen_sentences_cache', JSON.stringify(sents.data));
    } catch (e) {}
  },

  async addCategory(name: string): Promise<{ data: Category | null; error: string | null }> {
    if (!this.isConfigured()) return { data: null, error: "Database not configured." };
    try {
      const { data, error } = await this.getClient().from('categories').insert([{ name }]).select();
      if (error) return { data: null, error: error.message };
      await this.syncData(); 
      return { data: data?.[0] || null, error: null };
    } catch (e: any) { return { data: null, error: e.message }; }
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
    } catch (e: any) { return { success: false, error: e.message }; }
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
