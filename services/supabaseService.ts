
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Category, Sentence } from '../types';

/**
 * Supabase configuration with hardcoded credentials provided by the user.
 */
const getSupabaseConfig = () => {
  // 1. Try LocalStorage override first (Manual bypass if needed)
  const manualUrl = localStorage.getItem('SB_OVERRIDE_URL');
  const manualKey = localStorage.getItem('SB_OVERRIDE_KEY');
  
  if (manualUrl && manualKey) {
    return { url: manualUrl, key: manualKey, isManual: true };
  }

  // 2. Hardcoded values provided by the user for direct connection
  const HARDCODED_URL = 'https://irmnoqctkoaepeamzfgt.supabase.co';
  const HARDCODED_KEY = 'sb_publishable_jm-zZS8c3Vsuy0l6D2dJdw_1J-IW4kj';

  // 3. Fallback to environment variables using the user's successful pattern
  const envUrl = 
    // @ts-ignore
    process.env.SUPABASE_URL || (window as any).process?.env?.SUPABASE_URL || 
    // @ts-ignore
    process.env.REPEAT_SUPABASE_URL || (window as any).process?.env?.REPEAT_SUPABASE_URL || 
    '';

  const envKey = 
    // @ts-ignore
    process.env.SUPABASE_ANON_KEY || (window as any).process?.env?.SUPABASE_ANON_KEY || 
    // @ts-ignore
    process.env.REPEAT_SUPABASE_ANON_KEY || (window as any).process?.env?.REPEAT_SUPABASE_ANON_KEY || 
    '';

  const url = HARDCODED_URL || envUrl;
  const key = HARDCODED_KEY || envKey;

  return { url, key, isManual: false };
};

let supabaseClient: SupabaseClient | null = null;

export const supabaseService = {
  getClient(): SupabaseClient {
    const config = getSupabaseConfig();
    
    // Initialize or re-initialize if the URL or Key has changed
    if (!supabaseClient || (supabaseClient as any).supabaseUrl !== config.url) {
      supabaseClient = createClient(
        config.url || 'https://placeholder-project.supabase.co', 
        config.key || 'placeholder-key'
      );
    }
    return supabaseClient;
  },

  setManualConfig(url: string, key: string) {
    localStorage.setItem('SB_OVERRIDE_URL', url);
    localStorage.setItem('SB_OVERRIDE_KEY', key);
    // Reset client cache
    supabaseClient = null;
  },

  clearManualConfig() {
    localStorage.removeItem('SB_OVERRIDE_URL');
    localStorage.removeItem('SB_OVERRIDE_KEY');
    supabaseClient = null;
  },

  getDebugInfo() {
    const config = getSupabaseConfig();
    const mask = (s: string) => s && s.length > 5 ? `${s.substring(0, 8)}...${s.substring(s.length - 4)}` : 'NOT FOUND';
    return {
      urlFound: !!config.url,
      keyFound: !!config.key,
      maskedUrl: mask(config.url),
      maskedKey: mask(config.key),
      isManual: config.isManual
    };
  },

  isConfigured(): boolean {
    const { url, key } = getSupabaseConfig();
    // Basic validation: check if a URL exists and is not the placeholder
    return !!(url && key && url.includes('supabase.co'));
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: "Configuration missing or invalid." };
    }
    try {
      // Simple query to test the connection to the database
      const { error } = await this.getClient().from('categories').select('id').limit(1);
      if (error) throw error;
      return { success: true, message: "Connected successfully!" };
    } catch (e: any) {
      return { success: false, message: e.message || "Connection failed. Check your Supabase project settings." };
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
    } catch (e) {
      console.error("Sync failed:", e);
    }
  },

  async addCategory(name: string): Promise<{ data: Category | null; error: string | null }> {
    if (!this.isConfigured()) return { data: null, error: "Cloud not configured." };
    try {
      const { data, error } = await this.getClient().from('categories').insert([{ name }]).select();
      if (error) return { data: null, error: error.message };
      await this.syncData(); 
      return { data: data?.[0] || null, error: null };
    } catch (e: any) { return { data: null, error: e.message }; }
  },

  async addSentence(text: string, categoryIds: (string | number)[]): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
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
