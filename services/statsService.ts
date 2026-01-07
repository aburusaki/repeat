
// This service is now deprecated.
// Stats are handled directly via supabaseService and App state for real-time syncing.

export const statsService = {
  // Methods kept for backward compatibility to prevent crashes if called
  recordClick: () => {},
  getSentenceCount: () => 0,
  getStatsForDate: () => [],
  pruneStats: () => {},
  resetAllStats: () => {}
};
