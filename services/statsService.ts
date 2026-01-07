
const STATS_KEY = 'zen_counter_daily_stats';

export interface DailyStats {
  [date: string]: {
    [sentence: string]: number;
  };
}

export const statsService = {
  /**
   * Records a click for a specific sentence on the current date.
   */
  recordClick(sentence: string): void {
    const today = new Date().toISOString().split('T')[0];
    const rawStats = localStorage.getItem(STATS_KEY);
    const stats: DailyStats = rawStats ? JSON.parse(rawStats) : {};

    if (!stats[today]) {
      stats[today] = {};
    }

    stats[today][sentence] = (stats[today][sentence] || 0) + 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  },

  /**
   * Returns the count for a specific sentence today.
   */
  getSentenceCount(sentence: string): number {
    const today = new Date().toISOString().split('T')[0];
    const rawStats = localStorage.getItem(STATS_KEY);
    const stats: DailyStats = rawStats ? JSON.parse(rawStats) : {};
    return stats[today]?.[sentence] || 0;
  },

  /**
   * Retrieves stats for a specific date.
   */
  getStatsForDate(date?: string): { sentence: string; count: number }[] {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const rawStats = localStorage.getItem(STATS_KEY);
    const stats: DailyStats = rawStats ? JSON.parse(rawStats) : {};

    const dayData = stats[targetDate] || {};
    return Object.entries(dayData)
      .map(([sentence, count]) => ({ sentence, count }))
      .sort((a, b) => b.count - a.count);
  },

  /**
   * Clears old stats (older than 7 days) to keep localStorage clean.
   */
  pruneStats(): void {
    const rawStats = localStorage.getItem(STATS_KEY);
    if (!rawStats) return;

    const stats: DailyStats = JSON.parse(rawStats);
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 7);
    const limitStr = dateLimit.toISOString().split('T')[0];

    const newStats: DailyStats = {};
    Object.keys(stats).forEach(date => {
      if (date >= limitStr) {
        newStats[date] = stats[date];
      }
    });

    localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
  },

  /**
   * Resets all counters to 0 by clearing the stats storage.
   */
  resetAllStats(): void {
    localStorage.removeItem(STATS_KEY);
  }
};
