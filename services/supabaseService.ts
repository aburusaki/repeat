
import { createClient } from '@supabase/supabase-js';
import { Category, Sentence } from '../types';

// Use environment variables or placeholders if not provided
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

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
      // Attempt rich fetch with categories
      const { data: sentData, error: sentError } = await supabase
        .from('sentences')
        .select(`
          id,
          text,
          categories (id, name)
        `);

      if (sentError) {
        console.warn("Rich sentences sync failed (likely missing junction table):", sentError.message);
        
        // Fallback to simple fetch
        const { data: simpleData, error: simpleError } = await supabase
          .from('sentences')
          .select('id, text');
          
        if (simpleError) {
          throw simpleError;
        }
        
        if (simpleData) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(simpleData));
        }
      } else if (sentData && sentData.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sentData));
      } else {
        // Handle empty table by ensuring cache exists
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

  /**
   * Adds a new category
   */
  async addCategory(name: string): Promise<Category | null> {
    try {
      const { data, error } = await supabase.from('categories').insert([{ name }]).select();
      if (error) {
        console.error("Error adding category:", error.message);
        return null;
      }
      await this.syncData();
      return data?.[0] || null;
    } catch (e: any) {
      console.error("Unexpected error in addCategory:", e.message || e);
      return null;
    }
  },

  /**
   * Adds a sentence and links it to multiple categories
   */
  async addSentence(text: string, categoryIds: (string | number)[]): Promise<boolean> {
    try {
      const { data: sentence, error: sError } = await supabase
        .from('sentences')
        .insert([{ text }])
        .select();

      if (sError || !sentence) {
        console.error("Error adding sentence:", sError?.message || "Unknown error");
        return false;
      }

      const sentenceId = sentence[0].id;

      if (categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({
          sentence_id: sentenceId,
          category_id: catId
        }));
        const { error: lError } = await supabase.from('sentence_categories').insert(links);
        if (lError) {
          console.error("Error linking categories (check your sentence_categories table):", lError.message);
        }
      }

      await this.syncData();
      return true;
    } catch (e: any) {
      console.error("Unexpected error in addSentence:", e.message || e);
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
