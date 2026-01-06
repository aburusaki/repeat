
import { createClient } from '@supabase/supabase-js';
import { Category, Sentence } from '../types';

/**
 * Safely access environment variables.
 * In this environment, secrets are injected into process.env.
 */
const getEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    // Fix: Casting import.meta to any to bypass the TypeScript error for .env
    const meta = import.meta as any;
    if (typeof meta !== 'undefined' && meta.env && meta.env[key]) {
      return meta.env[key];
    }
  } catch (e) {
    console.error(`Error accessing environment variable ${key}:`, e);
  }
  return undefined;
};

const SUPABASE_URL = getEnv('REPEAT_SUPABASE_URL') || 'https://your-project.supabase.co';
const SUPABASE_KEY = getEnv('REPEAT_SUPABASE_ANON_KEY') || 'your-anon-key';

// Initialize Supabase client
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
   * Checks if the client is using real credentials or placeholders.
   */
  isConfigured(): boolean {
    const isDefault = SUPABASE_URL.includes('your-project') || SUPABASE_KEY.includes('your-anon-key');
    return !isDefault;
  },

  /**
   * Tests the connection and returns a diagnostic message.
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { 
        success: false, 
        message: "Supabase credentials missing. Please set REPEAT_SUPABASE_URL and REPEAT_SUPABASE_ANON_KEY in project secrets." 
      };
    }
    try {
      // Test by querying categories - needs SELECT policy
      const { data, error } = await supabase.from('categories').select('id').limit(1);
      if (error) throw error;
      return { success: true, message: "Connected to Supabase successfully." };
    } catch (e: any) {
      console.error("Supabase Connection Test Failed:", e);
      return { success: false, message: `DB Error: ${e.message || 'Check your URL and API Key.'}` };
    }
  },

  /**
   * Syncs everything from Supabase to LocalStorage.
   */
  async syncData(): Promise<void> {
    if (!this.isConfigured()) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SENTENCES.map((text, i) => ({ id: i, text }))));
      }
      return;
    }

    try {
      console.log("Syncing data from Supabase...");
      
      const [catsRes, sentsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sentences').select('id, text').order('created_at', { ascending: false })
      ]);

      if (catsRes.error) {
        console.error("Category Sync Error:", catsRes.error.message);
      } else if (catsRes.data) {
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(catsRes.data));
      }

      if (sentsRes.error) {
        console.error("Sentence Sync Error:", sentsRes.error.message);
      } else if (sentsRes.data && sentsRes.data.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sentsRes.data));
      } else if (sentsRes.data && sentsRes.data.length === 0) {
        // If DB is empty, keep defaults but clear cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      }
      
      console.log("Sync complete.");
    } catch (e) {
      console.error("Critical sync error:", e);
    }
  },

  async addCategory(name: string): Promise<{ data: Category | null; error: string | null }> {
    if (!this.isConfigured()) return { data: null, error: "Database not configured." };
    
    try {
      console.log(`Adding category: ${name}`);
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name }])
        .select();
      
      if (error) {
        console.error("Add Category Failed:", error);
        return { data: null, error: error.message };
      }
      
      console.log("Category added successfully:", data);
      await this.syncData(); 
      return { data: data?.[0] || null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message || "Unexpected error." };
    }
  },

  async addSentence(text: string, categoryIds: (string | number)[]): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Database not configured." };

    try {
      console.log(`Adding sentence: "${text}" with categories:`, categoryIds);
      
      // 1. Insert the sentence
      const { data: sentence, error: sError } = await supabase
        .from('sentences')
        .insert([{ text }])
        .select();
      
      if (sError) {
        console.error("Sentence insert error:", sError);
        return { success: false, error: sError.message };
      }

      if (!sentence || sentence.length === 0) {
        return { success: false, error: "Sentence saved but no data returned. Check RLS SELECT policy." };
      }

      const sentenceId = sentence[0].id;
      console.log(`Sentence created with ID: ${sentenceId}`);

      // 2. Link to categories if any selected
      if (categoryIds && categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ 
          sentence_id: sentenceId, 
          category_id: catId 
        }));
        
        console.log("Linking to categories...", links);
        const { error: lError } = await supabase
          .from('sentence_categories')
          .insert(links);

        if (lError) {
          console.error("Link Category Error:", lError);
          return { success: true, error: `Sentence saved, but failed to link categories: ${lError.message}` };
        }
      }
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) {
      console.error("Unhandled Add Sentence Error:", e);
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
      
      // If we have local DB sentences, use them. Otherwise defaults.
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
