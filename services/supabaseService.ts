
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Category, Sentence, DailyStat } from '../types';

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
    '';

  const envKey = 
    // @ts-ignore
    process.env.SUPABASE_ANON_KEY || (window as any).process?.env?.SUPABASE_ANON_KEY || 
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

  /**
   * Fetches latest data and populates localStorage cache.
   * Returns standardized Sentence objects.
   */
  async syncData(): Promise<Sentence[]> {
    if (!this.isConfigured()) return [];
    try {
      const client = this.getClient();
      const [catsRes, sentsRes] = await Promise.all([
        client.from('categories').select('*').order('name'),
        client.from('sentences').select('id, text, sentence_categories(category_id)').order('created_at', { ascending: false })
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

  /**
   * Subscribes to changes in content AND stats.
   * Uses polling as fallback if Realtime is not enabled on the table.
   */
  subscribeToChanges(
    onContentChange: (sentences: Sentence[], categories: Category[]) => void,
    onStatsChange: (stats: DailyStat[]) => void
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
      onStatsChange(stats);
    };

    const startPolling = () => {
      if (pollingInterval) return;
      // Initial fetch to ensure data is fresh if realtime failed
      handleContentEvent();
      handleStatsEvent();
      
      pollingInterval = setInterval(() => {
        handleContentEvent();
        handleStatsEvent();
      }, 5000); // Poll every 5s
    };

    const channel = client.channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, handleContentEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sentences' }, handleContentEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sentence_categories' }, handleContentEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, handleStatsEvent)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Realtime subscription active!');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('Realtime connection failed (likely Replication not enabled). Falling back to polling.');
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
      if (sError) throw sError;
      
      if (sentence?.[0] && categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ sentence_id: sentence[0].id, category_id: catId }));
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
      const client = this.getClient();
      
      const { error: sError } = await client.from('sentences').update({ text }).eq('id', id);
      if (sError) throw sError;
      
      const { error: delError } = await client.from('sentence_categories').delete().eq('sentence_id', id);
      if (delError) throw delError;

      if (categoryIds.length > 0) {
        const links = categoryIds.map(catId => ({ sentence_id: id, category_id: catId }));
        const { error: insError } = await client.from('sentence_categories').insert(links);
        if (insError) throw insError;
      }
      
      await this.syncData();
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  },

  async deleteSentence(id: string | number): Promise<{ success: boolean; error: string | null }> {
    if (!this.isConfigured()) return { success: false, error: "Cloud not configured." };
    try {
      const { error } = await this.getClient().from('sentences').delete().eq('id', id);
      if (error) throw error;
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

  /**
   * Returns a random Sentence object from cache.
   */
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

  // --- STATS METHODS ---

  async getDailyStats(): Promise<DailyStat[]> {
    if (!this.isConfigured()) return [];
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await this.getClient()
        .from('daily_stats')
        .select('*')
        .eq('date', today);
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Get Stats Error:', e);
      return [];
    }
  },

  async incrementStat(sentenceId: string | number): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const client = this.getClient();
      const today = new Date().toISOString().split('T')[0];

      // Try to fetch existing first to increment, or use upsert with a known count if possible.
      // Since we don't have an atomic increment RPC easily set up by user, we do a quick select-update or upsert.
      // An upsert with On Conflict is best.
      // But standard Supabase upsert requires us to know the new value.
      
      const { data: existing } = await client
        .from('daily_stats')
        .select('count')
        .eq('date', today)
        .eq('sentence_id', sentenceId)
        .single();
      
      const newCount = (existing?.count || 0) + 1;

      const { error } = await client
        .from('daily_stats')
        .upsert({ date: today, sentence_id: sentenceId, count: newCount }, { onConflict: 'date, sentence_id' });
        
      if (error) throw error;
    } catch (e) {
      console.error('Increment Stat Error:', e);
    }
  },

  async resetAllStats(): Promise<void> {
    if (!this.isConfigured()) return;
    try {
       // Delete all stats (or just today's, but prompt said "reset all counters")
       const { error } = await this.getClient().from('daily_stats').delete().neq('count', -1); // delete all
       if (error) throw error;
    } catch (e) {
      console.error('Reset Stats Error:', e);
    }
  }
};
