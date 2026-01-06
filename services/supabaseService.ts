
import { createClient } from '@supabase/supabase-js';
import { Category, Sentence } from '../types';

/**
 * Safely access environment variables.
 * In many build environments (like Vite or Vercel's default builders), 
 * process.env is shimmed, but in raw browser ESM it is not.
 */
const getEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore
    return (typeof process !== 'undefined' && process.env) ? process.env[key] : undefined;
  } catch {
    return undefined;
  }
};

const SUPABASE_URL = getEnv('REPEAT_SUPABASE_URL') || 'https://your-project.supabase.co';
const SUPABASE_KEY = getEnv('REPEAT_SUPABASE_ANON_KEY') || 'your-anon-key';

// Initialize Supabase. Note: if URL is the placeholder, requests will simply fail/fallback 
// rather than crashing the whole JS runtime.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  /**
   * Syncs everything from Supabase to LocalStorage with partial failure support
   */
  async syncData(): Promise<void> {
    // Ensure we don't try to sync if keys are obviously placeholders
    if (SUPABASE_URL.includes('your-project')) {
      console.info("Supabase URL not configured, skipping sync and using defaults.");
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SENTENCES.map((text, i) => ({ id: i, text }))));
      }
      return;
    }

    // 1. Sync Categories independently
    try {
      const { data: catData, error: catError } = await supabase.from('categories').select('*');
      if (catError) {
        console.warn("Categories sync failed:", catError.message);
      } else if (catData) {
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(catData));
      }
    } catch (e: any) {
      console.error("Unexpected error syncing categories:", e.message || e);
    }

    // 2. Sync Sentences independently
    try {
      const { data: sentData, error: sentError } = await supabase
        .from('sentences')
        .select(`
          id,
          text,
          categories (id, name)
        `);

      if (sentError) {
        console.warn("Rich sentences sync failed, trying simple fetch.");
        const { data: simpleData, error: simpleError } = await supabase.from('sentences').select('id, text');
        if (simpleError) throw simpleError;
        if (simpleData) localStorage.setItem(STORAGE_KEY, JSON.stringify(simpleData));
      } else if (sentData && sentData.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sentData));
      } else {
        if (!localStorage.getItem(STORAGE_KEY)) {
           localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SENTENCES.map((text, i) => ({ id: i, text }))));
        }
      }
    } catch (err: any) {
      console.warn("Supabase sentences sync failed, using default data fallback.", err.message || err);
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SENTENCES.map((text, i) => ({ id: i, text }))));
      }
    }
  },

  async addCategory(name: string): Promise<Category | null> {
    try {
      const { data, error } = await supabase.from('categories').insert([{ name }]).select();
      if (error) return null;
      await this.syncData();
      return data?.[0] || null;
    } catch {
      return null;
    }
  },

  async addSentence(text: string, categoryIds: (string | number)[]): Promise<boolean> {
    try {
      const { data: sentence, error: sError } = await supabase.from('sentences').insert([{ text }]).select();
      if (sError || !sentence) return false;

      const sentenceId = sentence[0].id;
      if (categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ sentence_id: sentenceId, category_id: catId }));
        await supabase.from('sentence_categories').insert(links);
      }
      await this.syncData();
      return true;
    } catch {
      return false;
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
      const sentences: Sentence[] = cached ? JSON.parse(cached) : DEFAULT_SENTENCES.map((text, i) => ({ id: i, text }));
      if (!sentences || sentences.length === 0) return DEFAULT_SENTENCES[0];
      const randomIndex = Math.floor(Math.random() * sentences.length);
      return sentences[randomIndex].text;
    } catch {
      return DEFAULT_SENTENCES[0];
    }
  }
};
