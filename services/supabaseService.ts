
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Category, Sentence } from '../types';

const getSupabaseConfig = () => {
  const manualUrl = localStorage.getItem('SB_OVERRIDE_URL');
  const manualKey = localStorage.getItem('SB_OVERRIDE_KEY');
  
  if (manualUrl && manualKey) {
    return { url: manualUrl, key: manualKey, isManual: true };
  }

  const HARDCODED_URL = 'https://irmnoqctkoaepeamzfgt.supabase.co';
  const HARDCODED_KEY = 'sb_publishable_jm-zZS8c3Vsuy0l6D2dJdw_1J-IW4kj';

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
    if (!supabaseClient || (supabaseClient as any).supabaseUrl !== config.url) {
      supabaseClient = createClient(
        config.url || 'https://placeholder-project.supabase.co', 
        config.key || 'placeholder-key'
      );
    }
    return supabaseClient;
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
    return !!(url && key && url.includes('supabase.co'));
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) return { success: false, message: "Configuration missing." };
    try {
      const { error } = await this.getClient().from('categories').select('id').limit(1);
      if (error) throw error;
      return { success: true, message: "Connected!" };
    } catch (e: any) {
      return { success: false, message: e.message || "Failed." };
    }
  },

  async syncData(): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const client = this.getClient();
      const [cats, sents] = await Promise.all([
        client.from('categories').select('*').order('name'),
        client.from('sentences').select('*, categories:sentence_categories(category_id)').order('created_at', { ascending: false })
      ]);
      if (cats.data) localStorage.setItem('zen_categories_cache', JSON.stringify(cats.data));
      if (sents.data) localStorage.setItem('zen_sentences_cache', JSON.stringify(sents.data));
    } catch (e) {
      console.error("Sync error:", e);
    }
  },

  async getSentences(): Promise<Sentence[]> {
    if (!this.isConfigured()) return [];
    try {
      // Fetch sentences with their associated category IDs
      const { data, error } = await this.getClient()
        .from('sentences')
        .select(`
          id, 
          text, 
          sentence_categories (
            category_id
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((s: any) => ({
        id: s.id,
        text: s.text,
        categoryIds: s.sentence_categories.map((sc: any) => sc.category_id)
      }));
    } catch (e) {
      console.error("Fetch sentences error:", e);
      return [];
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
      
      if (sentence?.[0] && categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ sentence_id: sentence[0].id, category_id: catId }));
        await client.from('sentence_categories').insert(links);
      }
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  },

  async updateSentence(id: string | number, text: string, categoryIds: (string | number)[]): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
    try {
      const client = this.getClient();
      
      // Update sentence text
      const { error: sError } = await client.from('sentences').update({ text }).eq('id', id);
      if (sError) return { success: false, error: sError.message };
      
      // Update categories: delete old associations and insert new ones
      await client.from('sentence_categories').delete().eq('sentence_id', id);
      if (categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ sentence_id: id, category_id: catId }));
        await client.from('sentence_categories').insert(links);
      }
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  },

  async deleteSentence(id: string | number): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
    try {
      const { error } = await this.getClient().from('sentences').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
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

  getRandomSentence(filterCategoryId?: string | number | 'all'): string {
    try {
      const cached = localStorage.getItem('zen_sentences_cache');
      let sentences: any[] = cached ? JSON.parse(cached) : [];
      
      if (filterCategoryId && filterCategoryId !== 'all') {
        sentences = sentences.filter(s => {
          // If synced structure has categories array
          if (s.categories) {
            return s.categories.some((c: any) => c.category_id === filterCategoryId);
          }
          // If structure from getSentences() was used
          if (s.sentence_categories) {
            return s.sentence_categories.some((sc: any) => sc.category_id === filterCategoryId);
          }
          // Fallback if we just have categoryIds mapped locally
          if (s.categoryIds) {
            return s.categoryIds.includes(filterCategoryId);
          }
          return false;
        });
      }

      if (sentences.length === 0) {
        return filterCategoryId && filterCategoryId !== 'all' 
          ? "This theme awaits your wisdom. Add a sentence to begin." 
          : "Adopt the pace of nature: her secret is patience.";
      }
      
      return sentences[Math.floor(Math.random() * sentences.length)].text;
    } catch { return "True peace comes from within."; }
  }
};
