
import { createClient } from '@supabase/supabase-js';
import { Category, Sentence } from '../types';

/**
 * Robust environment variable retrieval.
 * Modern bundlers often require static access (e.g., process.env.KEY) 
 * to correctly inject values during the build process.
 */
const getSupabaseConfig = () => {
  let url = '';
  let key = '';

  try {
    // Attempt to get values from various possible locations/prefixes
    // @ts-ignore
    url = process.env.REPEAT_SUPABASE_URL || process.env.SUPABASE_URL || '';
    // @ts-ignore
    key = process.env.REPEAT_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

    // If still empty, check import.meta.env (Vite standard)
    if (!url || !key) {
      const meta = import.meta as any;
      if (meta.env) {
        url = url || meta.env.REPEAT_SUPABASE_URL || meta.env.VITE_REPEAT_SUPABASE_URL || meta.env.SUPABASE_URL;
        key = key || meta.env.REPEAT_SUPABASE_ANON_KEY || meta.env.VITE_REPEAT_SUPABASE_ANON_KEY || meta.env.SUPABASE_ANON_KEY;
      }
    }
  } catch (e) {
    console.error("Error accessing environment variables:", e);
  }

  return {
    url: url || 'https://your-project.supabase.co',
    key: key || 'your-anon-key'
  };
};

const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.key);

const STORAGE_KEY = 'zen_sentences_cache';
const CATEGORY_STORAGE_KEY = 'zen_categories_cache';

const DEFAULT_SENTENCES = [
  "True peace comes from within.",
  "Simplicity is the soul of efficiency.",
  "Every moment is a fresh beginning.",
  "Silence is a source of great strength.",
  "The journey of a thousand miles begins with one step.",
  "Do not let the behavior of others destroy your inner peace.",
  "Adopt the pace of nature: her secret is patience."
];

export const supabaseService = {
  isConfigured(): boolean {
    const isUrlDefault = config.url.includes('your-project');
    const isKeyDefault = config.key.includes('your-anon-key');
    const hasValues = config.url.length > 10 && config.key.length > 10;
    return !isUrlDefault && !isKeyDefault && hasValues;
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { 
        success: false, 
        message: "Supabase variables missing from environment. If you just added them, try redeploying." 
      };
    }
    try {
      const { error } = await supabase.from('categories').select('id').limit(1);
      if (error) throw error;
      return { success: true, message: "Connected to Supabase successfully." };
    } catch (e: any) {
      console.error("Supabase Connection Test Failed:", e);
      return { success: false, message: `DB Connection Error: ${e.message || 'Check project settings.'}` };
    }
  },

  async syncData(): Promise<void> {
    if (!this.isConfigured()) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SENTENCES.map((text, i) => ({ id: i, text }))));
      }
      return;
    }

    try {
      const [catsRes, sentsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sentences').select('id, text').order('created_at', { ascending: false })
      ]);

      if (catsRes.data) {
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(catsRes.data));
      }

      if (sentsRes.data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sentsRes.data));
      }
    } catch (e) {
      console.error("Sync error:", e);
    }
  },

  async addCategory(name: string): Promise<{ data: Category | null; error: string | null }> {
    if (!this.isConfigured()) return { data: null, error: "Database not configured." };
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name }])
        .select();
      
      if (error) return { data: null, error: error.message };
      
      await this.syncData(); 
      return { data: data?.[0] || null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message || "An unexpected error occurred." };
    }
  },

  async addSentence(text: string, categoryIds: (string | number)[]): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Database not configured." };

    try {
      const { data: sentence, error: sError } = await supabase
        .from('sentences')
        .insert([{ text }])
        .select();
      
      if (sError) return { success: false, error: sError.message };
      if (!sentence || sentence.length === 0) return { success: false, error: "No data returned after insert." };

      const sentenceId = sentence[0].id;

      if (categoryIds && categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ 
          sentence_id: sentenceId, 
          category_id: catId 
        }));
        
        const { error: lError } = await supabase
          .from('sentence_categories')
          .insert(links);

        if (lError) return { success: true, error: `Sentence saved, but tags failed: ${lError.message}` };
      }
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e.message || "An unexpected error occurred." };
    }
  },

  getCategories(): Category[] {
    try {
      const cached = localStorage.getItem(CATEGORY_STORAGE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  },

  getRandomSentence(): string {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      const sentences: Sentence[] = cached ? JSON.parse(cached) : [];
      if (!sentences || sentences.length === 0) {
        return DEFAULT_SENTENCES[Math.floor(Math.random() * DEFAULT_SENTENCES.length)];
      }
      const randomIndex = Math.floor(Math.random() * sentences.length);
      return sentences[randomIndex].text;
    } catch {
      return DEFAULT_SENTENCES[0];
    }
  }
};
