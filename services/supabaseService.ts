
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Category, Sentence, DailyStat } from '../types';

const TIME_TRACKER_ID = 'GLOBAL_TIME_TRACKER';

const getSupabaseConfig = () => {
  const manualUrl = localStorage.getItem('SB_OVERRIDE_URL');
  const manualKey = localStorage.getItem('SB_OVERRIDE_KEY');
  
  if (manualUrl && manualKey) {
    return { url: manualUrl, key: manualKey, isManual: true };
  }

  const HARDCODED_URL = 'https://irmnoqctkoaepeamzfgt.supabase.co';
  const HARDCODED_KEY = 'sb_publishable_jm-zZS8c3Vsuy0l6D2dJdw_1J-IW4kj';

  let envUrl = '';
  let envKey = '';

  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      envUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
      // @ts-ignore
      envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
    }
  } catch (e) {}

  if (!envUrl) {
    try {
      const w = window as any;
      if (w.process && w.process.env) {
        envUrl = w.process.env.SUPABASE_URL;
        envKey = w.process.env.SUPABASE_ANON_KEY;
      }
    } catch (e) {}
  }

  const url = envUrl || HARDCODED_URL || '';
  const key = envKey || HARDCODED_KEY || '';

  return { url, key, isManual: false };
};

let supabaseClient: SupabaseClient | null = null;

export const supabaseService = {
  getClient(): SupabaseClient {
    const config = getSupabaseConfig();
    if (!supabaseClient || (supabaseClient as any).supabaseUrl !== config.url) {
      supabaseClient = createClient(
        config.url || 'https://placeholder-project.supabase.co', 
        config.key || 'placeholder-key',
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: localStorage
          }
        }
      );
    }
    return supabaseClient;
  },

  isConfigured(): boolean {
    const { url, key } = getSupabaseConfig();
    return !!(url && key && url.includes('supabase.co'));
  },

  // --- AUTH METHODS ---

  async getCurrentUser(): Promise<User | null> {
    const { data: { session } } = await this.getClient().auth.getSession();
    return session?.user || null;
  },

  async signIn(username: string, password: string): Promise<{ user: User | null; error: string | null }> {
    // Proxy username to a fake email domain to satisfy Supabase requirements
    const email = `${username.toLowerCase().replace(/\s/g, '')}@zen-counter.local`;
    
    const { data, error } = await this.getClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
  },

  async signUp(username: string, password: string): Promise<{ user: User | null; error: string | null }> {
    const email = `${username.toLowerCase().replace(/\s/g, '')}@zen-counter.local`;
    
    const { data, error } = await this.getClient().auth.signUp({
      email,
      password,
    });

    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
  },

  async signOut(): Promise<void> {
    await this.getClient().auth.signOut();
    localStorage.removeItem('zen_categories_cache');
    localStorage.removeItem('zen_sentences_cache');
  },

  // --- DATA METHODS ---

  async syncData(): Promise<Sentence[]> {
    if (!this.isConfigured()) return [];
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      const client = this.getClient();
      const [catsRes, sentsRes] = await Promise.all([
        client.from('categories').select('*').eq('user_id', user.id).order('name'),
        client.from('sentences').select('id, text, sentence_categories(category_id)').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      if (catsRes.error) throw catsRes.error;
      if (sentsRes.error) throw sentsRes.error;

      const sentences: Sentence[] = (sentsRes.data || []).map((s: any) => ({
        id: s.id,
        text: s.text,
        categoryIds: (s.sentence_categories || []).map((sc: any) => sc.category_id)
      }));

      localStorage.setItem('zen_categories_cache', JSON.stringify(catsRes.data || []));
      localStorage.setItem('zen_sentences_cache', JSON.stringify(sentences));
      
      return sentences;
    } catch (e) {
      console.error("Zen Counter Sync Error:", e);
      return [];
    }
  },

  async getSentences(): Promise<Sentence[]> {
    return this.syncData();
  },

  subscribeToChanges(
    onContentChange: (sentences: Sentence[], categories: Category[]) => void,
    onStatsChange: (stats: DailyStat[]) => void,
    onTimeChange?: (totalSeconds: number) => void
  ): () => void {
    if (!this.isConfigured()) return () => {};
    
    const client = this.getClient();
    let pollingInterval: any = null;
    
    const handleContentEvent = async () => {
      const sents = await this.syncData();
      const cats = this.getCategories();
      onContentChange(sents, cats);
    };

    const handleStatsEvent = async () => {
      const stats = await this.getDailyStats();
      // Filter out the time tracker row from standard stats display
      const cleanStats = stats.filter(s => s.sentence_id !== TIME_TRACKER_ID);
      onStatsChange(cleanStats);

      // Handle time update specifically
      const timeStat = stats.find(s => s.sentence_id === TIME_TRACKER_ID);
      if (onTimeChange && timeStat) {
        onTimeChange(timeStat.count);
      }
    };

    const startPolling = () => {
      if (pollingInterval) return;
      handleContentEvent();
      handleStatsEvent();
      pollingInterval = setInterval(() => {
        handleContentEvent();
        handleStatsEvent();
      }, 5000); 
    };

    const channel = client.channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, handleContentEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sentences' }, handleContentEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, handleStatsEvent)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            startPolling();
        }
      });

    return () => {
      client.removeChannel(channel);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  },

  async addCategory(name: string): Promise<{ data: Category | null; error: string | null }> {
    if (!this.isConfigured()) return { data: null, error: "Cloud not configured." };
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error("Not logged in");

      const { data, error } = await this.getClient().from('categories').insert([{ name, user_id: user.id }]).select();
      if (error) return { data: null, error: error.message };
      await this.syncData(); 
      return { data: data?.[0] || null, error: null };
    } catch (e: any) { return { data: null, error: e.message }; }
  },

  async addSentence(text: string, categoryIds: (string | number)[]): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error("Not logged in");

      const client = this.getClient();
      const { data: sentence, error: sError } = await client.from('sentences').insert([{ text, user_id: user.id }]).select();
      if (sError) throw sError;
      
      if (sentence?.[0] && categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ 
            sentence_id: sentence[0].id, 
            category_id: catId,
            user_id: user.id 
        }));
        const { error: linkError } = await client.from('sentence_categories').insert(links);
        if (linkError) throw linkError;
      }
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  },

  async updateSentence(id: string | number, text: string, categoryIds: (string | number)[]): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error("Not logged in");

      const client = this.getClient();
      
      // 1. Update text - Use .select() to verify the update actually happened
      const { data: updated, error: sError } = await client
        .from('sentences')
        .update({ text })
        .eq('id', id)
        .eq('user_id', user.id)
        .select();
        
      if (sError) throw new Error(`Failed to update text: ${sError.message}`);
      if (!updated || updated.length === 0) throw new Error("Update failed: Sentence not found or permission denied.");

      // 2. Clear existing categories for this sentence. 
      const { error: delError } = await client
        .from('sentence_categories')
        .delete()
        .eq('sentence_id', id)
        .eq('user_id', user.id); 
        
      if (delError) throw new Error(`Failed to clear categories: ${delError.message}`);

      // 3. Insert new categories
      if (categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ 
            sentence_id: id, 
            category_id: catId,
            user_id: user.id 
        }));
        const { error: insError } = await client.from('sentence_categories').insert(links);
        if (insError) throw new Error(`Failed to insert categories: ${insError.message}`);
      }
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  },

  async deleteSentence(id: string | number): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error("Not logged in");

      const client = this.getClient();

      // 1. Delete associated category links
      const { error: linkError } = await client
        .from('sentence_categories')
        .delete()
        .eq('sentence_id', id)
        .eq('user_id', user.id);

      if (linkError) throw new Error(`Failed to delete categories: ${linkError.message}`);
      
      // 2. Delete associated daily stats
      const { error: statError } = await client
        .from('daily_stats')
        .delete()
        .eq('sentence_id', id)
        .eq('user_id', user.id);

      if (statError) throw new Error(`Failed to delete stats: ${statError.message}`);

      // 3. Delete the sentence - Use .select() to verify deletion
      const { data: deleted, error: sentError } = await client
        .from('sentences')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select();
      
      if (sentError) throw new Error(`Failed to delete sentence: ${sentError.message}`);
      if (!deleted || deleted.length === 0) throw new Error("Delete failed: Sentence not found or permission denied.");
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) { 
        console.error("Delete sentence error:", e);
        return { success: false, error: e.message }; 
    }
  },

  getCategories(): Category[] {
    try {
      const cached = localStorage.getItem('zen_categories_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  },

  getRandomSentence(filterCategoryId?: string | number | 'all'): Sentence | null {
    try {
      const cached = localStorage.getItem('zen_sentences_cache');
      let sentences: Sentence[] = cached ? JSON.parse(cached) : [];
      
      if (filterCategoryId && filterCategoryId !== 'all') {
        sentences = sentences.filter(s => (s.categoryIds || []).includes(filterCategoryId));
      }

      if (sentences.length === 0) return null;
      
      return sentences[Math.floor(Math.random() * sentences.length)];
    } catch { return null; }
  },

  async getDailyStats(): Promise<DailyStat[]> {
    if (!this.isConfigured()) return [];
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await this.getClient()
        .from('daily_stats')
        .select('*')
        .eq('date', today)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Get Stats Error:', e);
      return [];
    }
  },

  async getHistoricalStats(days: number = 7): Promise<DailyStat[]> {
    if (!this.isConfigured()) return [];
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startStr = startDate.toISOString().split('T')[0];

      const { data, error } = await this.getClient()
        .from('daily_stats')
        .select('*')
        .gte('date', startStr)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Get Historical Stats Error:', e);
      return [];
    }
  },

  async incrementStat(sentenceId: string | number): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const user = await this.getCurrentUser();
      if (!user) return;

      const client = this.getClient();
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existing } = await client
        .from('daily_stats')
        .select('count')
        .eq('date', today)
        .eq('sentence_id', sentenceId)
        .eq('user_id', user.id)
        .single();
      
      const newCount = (existing?.count || 0) + 1;

      const { error } = await client
        .from('daily_stats')
        .upsert({ 
            date: today, 
            sentence_id: sentenceId, 
            count: newCount,
            user_id: user.id 
        }, { onConflict: 'date, sentence_id' }); 
        
      if (error) throw error;
    } catch (e) {
      console.error('Increment Stat Error:', e);
    }
  },

  // --- TIME TRACKING METHODS ---
  
  async getDailyTime(): Promise<number> {
    if (!this.isConfigured()) return 0;
    try {
      const user = await this.getCurrentUser();
      if (!user) return 0;
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await this.getClient()
        .from('daily_stats')
        .select('count')
        .eq('date', today)
        .eq('sentence_id', TIME_TRACKER_ID)
        .eq('user_id', user.id)
        .single();
        
      if (error || !data) return 0;
      return data.count;
    } catch { return 0; }
  },

  async incrementDailyTime(secondsToAdd: number): Promise<number> {
    if (!this.isConfigured() || secondsToAdd <= 0) return 0;
    try {
      const user = await this.getCurrentUser();
      if (!user) return 0;

      const client = this.getClient();
      const today = new Date().toISOString().split('T')[0];

      // Atomic update approach: get current, add, set.
      const { data: existing } = await client
        .from('daily_stats')
        .select('count')
        .eq('date', today)
        .eq('sentence_id', TIME_TRACKER_ID)
        .eq('user_id', user.id)
        .single();
        
      const newTotal = (existing?.count || 0) + secondsToAdd;

      const { error } = await client
        .from('daily_stats')
        .upsert({ 
            date: today, 
            sentence_id: TIME_TRACKER_ID, 
            count: newTotal,
            user_id: user.id 
        }, { onConflict: 'date, sentence_id' }); 
      
      if (error) throw error;
      return newTotal;
    } catch (e) {
      console.error("Time Sync Error", e);
      return 0;
    }
  },

  async updateDailyCount(sentenceId: string | number, count: number): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error("Not logged in");

      const client = this.getClient();
      const today = new Date().toISOString().split('T')[0];

      const { error } = await client
        .from('daily_stats')
        .upsert({ 
            date: today, 
            sentence_id: sentenceId, 
            count: count,
            user_id: user.id 
        }, { onConflict: 'date, sentence_id' }); 
        
      if (error) throw error;
      return { success: true, error: null };
    } catch (e: any) {
      console.error('Update Count Error:', e);
      return { success: false, error: e.message };
    }
  },

  async resetAllStats(): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
    try {
       const user = await this.getCurrentUser();
       if (!user) throw new Error("Not logged in");
       
       const { error } = await this.getClient()
        .from('daily_stats')
        .delete()
        .gte('count', 0)
        .eq('user_id', user.id);
        
       if (error) throw error;
       return { success: true, error: null };
    } catch (e: any) {
      console.error('Reset Stats Error:', e);
      return { success: false, error: e.message };
    }
  }
};
