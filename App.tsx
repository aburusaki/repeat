
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabaseService } from './services/supabaseService';
import { Category, Sentence, DailyStat } from './types';
import { User } from '@supabase/supabase-js';

// --- AUTH COMPONENT ---
const AuthScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 6) {
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
    }

    try {
      const { error: apiError } = isLogin 
        ? await supabaseService.signIn(username, password)
        : await supabaseService.signUp(username, password);

      if (apiError) {
        setError(apiError);
      } else {
        if (!isLogin) {
            // Auto login after signup if successful
            await supabaseService.signIn(username, password);
        }
        onLogin();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 transition-colors duration-500">
       <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-50 dark:bg-blue-900/20 rounded-full blur-[120px] opacity-40"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
            <h1 className="text-3xl font-serif italic text-slate-800 dark:text-slate-100 mb-2">Zen Counter</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Your Personal Space</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <input 
                    type="text" 
                    placeholder="Username" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400"
                    required
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400"
                    required
                />
            </div>
            
            {error && <div className="text-red-500 text-xs text-center font-bold uppercase tracking-wider">{error}</div>}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                {loading ? 'Processing...' : (isLogin ? 'Enter' : 'Create Account')}
            </button>
        </form>

        <div className="mt-8 text-center">
            <button 
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
            >
                {isLogin ? "New here? Create Account" : "Have an account? Login"}
            </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // App State
  const [currentNumber, setCurrentNumber] = useState<number>(0);
  const [randomLimit, setRandomLimit] = useState<number>(3); 
  const [currentSentence, setCurrentSentence] = useState<Sentence | null>(null);
  const [counterMode, setCounterMode] = useState<'up' | 'down'>('down');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [showManage, setShowManage] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  const [sessionFocusId, setSessionFocusId] = useState<string | number | 'all'>('all');

  // Interaction throttling refs
  const lastScrollTime = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  
  // Sentence Selection Queue (Shuffle Bag)
  const sentenceQueue = useRef<Sentence[]>([]);

  // Data State
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSentences, setAllSentences] = useState<Sentence[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);

  // Form State
  const [newCategory, setNewCategory] = useState('');
  const [newSentenceText, setNewSentenceText] = useState('');
  const [selectedCats, setSelectedCats] = useState<(string | number)[]>([]);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<{ text: string; categoryIds: (string | number)[] }>({ text: '', categoryIds: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | number | 'all'>('all');

  // Derived State
  const todayClickCount = useMemo(() => {
    if (!currentSentence) return 0;
    const stat = dailyStats.find(s => String(s.sentence_id) === String(currentSentence.id));
    return stat ? stat.count : 0;
  }, [currentSentence, dailyStats]);

  const generateRandomLimit = () => 3;

  // --- Auth Check ---
  useEffect(() => {
    supabaseService.getCurrentUser().then(user => {
        setCurrentUser(user);
        setLoadingAuth(false);
    });
  }, []);

  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    const sents = await supabaseService.syncData();
    const cats = supabaseService.getCategories();
    const stats = await supabaseService.getDailyStats();
    
    setAllSentences(sents);
    setAllCategories(cats);
    setDailyStats(stats);
  }, [currentUser]);

  // Logic to get next sentence using shuffle bag (queue)
  const getNextSentence = useCallback((focusId: string | number | 'all') => {
    const relevant = allSentences.filter(s => 
      focusId === 'all' || (s.categoryIds || []).includes(focusId)
    );

    if (relevant.length === 0) return null;

    // If queue is empty or has invalid items, refill it
    if (sentenceQueue.current.length === 0) {
      const newQueue = [...relevant];
      // Fisher-Yates shuffle
      for (let i = newQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
      }
      sentenceQueue.current = newQueue;
    }

    // Pop the next sentence
    let next = sentenceQueue.current.pop();

    // Ensure the popped sentence is still valid (in case it was deleted or changed category while in queue)
    while (next && !relevant.find(r => r.id === next?.id)) {
        if (sentenceQueue.current.length === 0) {
            // Queue exhausted with invalid items, recursion to refill
            return getNextSentence(focusId);
        }
        next = sentenceQueue.current.pop();
    }
    
    // Safety fallback
    if (!next) return getNextSentence(focusId);

    return next;
  }, [allSentences]);

  const resetCycle = useCallback((mode: 'up' | 'down', focusId: string | number | 'all') => {
    const newLimit = generateRandomLimit();
    const newSentenceObj = getNextSentence(focusId);
    
    setRandomLimit(newLimit);
    setCurrentSentence(newSentenceObj);
    setCurrentNumber(mode === 'down' ? newLimit : 1);
  }, [getNextSentence]);

  // Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Data Initialization
  useEffect(() => {
    if (!currentUser) return;

    const init = async () => {
      setIsSyncing(true);
      try {
        await refreshData();
      } catch (e) {
        console.error("Initialization failed:", e);
      } finally {
        setIsSyncing(false);
      }
    };
    init();

    let unsubscribe = () => {};
    try {
      unsubscribe = supabaseService.subscribeToChanges(
        (sents, cats) => {
          setAllSentences(sents);
          setAllCategories(cats);
        },
        (stats) => {
          setDailyStats(stats);
        }
      );
    } catch (e) {
      console.error("Subscription failed:", e);
    }

    return () => {
      unsubscribe();
    };
  }, [currentUser, refreshData]); 

  // Auto-start cycle when data is available
  useEffect(() => {
    if (currentSentence === null && allSentences.length > 0) {
        resetCycle(counterMode, sessionFocusId);
    }
  }, [allSentences, currentSentence, resetCycle, counterMode, sessionFocusId]);

  const handleFocusChange = (e: React.MouseEvent, id: string | number | 'all') => {
    e.stopPropagation();
    setSessionFocusId(id);
    sentenceQueue.current = []; // Clear queue to ensure we pick from the new category immediately
    resetCycle(counterMode, id);
  };

  const handleInteraction = useCallback(() => {
    if (isAnimating || showStats || showManage) return;
    
    // Optimistic Update for local feeling
    if (currentSentence) {
       supabaseService.incrementStat(currentSentence.id);
    }

    setIsAnimating(true);
    
    setTimeout(() => {
      setCurrentNumber(prev => {
        if (counterMode === 'down') {
          if (prev <= 1) {
            const newLimit = generateRandomLimit();
            // Trigger next sentence logic directly here
            const nextSentence = getNextSentence(sessionFocusId);
            setRandomLimit(newLimit);
            setCurrentSentence(nextSentence);
            return newLimit;
          }
          return prev - 1;
        } else {
          // Ascend Mode: No limit, just keep counting up indefinitely
          return prev + 1;
        }
      });
      setIsAnimating(false);
    }, 250);
  }, [isAnimating, showStats, showManage, currentSentence, counterMode, sessionFocusId, getNextSentence]);

  // Keyboard and Scroll Interaction Effects
  useEffect(() => {
    if (!currentUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); 
        handleInteraction();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime.current < 600) return;
      if (e.deltaY < -10) {
        lastScrollTime.current = now;
        handleInteraction();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastScrollTime.current < 600) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;
      if (diff < -50) {
        lastScrollTime.current = now;
        handleInteraction();
        touchStartY.current = currentY;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleInteraction, currentUser]);

  const toggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMode = counterMode === 'down' ? 'up' : 'down';
    setCounterMode(newMode);
    
    if (newMode === 'down') {
      resetCycle('down', sessionFocusId);
    } else {
      setCurrentNumber(1);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    setIsSyncing(true);
    const { error } = await supabaseService.addCategory(name);
    if (error) alert(`Category Error: ${error}`);
    else {
      setNewCategory('');
    }
    setIsSyncing(false);
  };

  const handleAddSentence = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newSentenceText.trim();
    if (!text) return;
    setIsSyncing(true);
    const { success, error } = await supabaseService.addSentence(text, selectedCats);
    if (!success) alert(`Save Error: ${error}`);
    else {
      setNewSentenceText('');
      setSelectedCats([]);
    }
    setIsSyncing(false);
  };

  const handleStartEdit = (s: Sentence) => {
    setEditingId(s.id);
    setEditForm({ text: s.text, categoryIds: s.categoryIds || [] });
  };

  const handleUpdateSentence = async (id: string | number) => {
    setIsSyncing(true);
    const { success, error } = await supabaseService.updateSentence(id, editForm.text, editForm.categoryIds);
    if (success) {
      setEditingId(null);
    } else {
      alert(`Update Error: ${error}`);
    }
    setIsSyncing(false);
  };

  const handleDeleteSentence = async (id: string | number) => {
    if (!confirm("Delete this entry permanently?")) return;
    setIsSyncing(true);
    const { success, error } = await supabaseService.deleteSentence(id);
    if (!success) {
      alert(`Delete Error: ${error}`);
    } else {
      // Optimistically update local list to reflect deletion immediately
      setAllSentences(prev => prev.filter(s => s.id !== id));
      // If the currently displayed sentence was deleted, pick a new one
      if (currentSentence?.id === id) {
        const remaining = allSentences.filter(s => s.id !== id);
        // Basic random pick from local state or reset cycle
        if (remaining.length > 0) {
            const next = remaining[Math.floor(Math.random() * remaining.length)];
            setCurrentSentence(next);
        } else {
            setCurrentSentence(null);
        }
      }
    }
    setIsSyncing(false);
  };

  const handleResetAllCounters = async () => {
    if (confirm("Are you sure you want to reset all counters to 0?")) {
      await supabaseService.resetAllStats();
    }
  };

  const handleLogout = async () => {
    await supabaseService.signOut();
    setCurrentUser(null);
    setAllSentences([]);
    setAllCategories([]);
    setShowManage(false);
  };

  const filteredSentences = useMemo(() => {
    return allSentences.filter(s => {
      const matchesSearch = s.text.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategoryId === 'all' || (s.categoryIds || []).includes(filterCategoryId);
      return matchesSearch && matchesCategory;
    });
  }, [allSentences, searchTerm, filterCategoryId]);

  const statsList = useMemo(() => {
    return dailyStats
      .map(stat => {
        const s = allSentences.find(sent => String(sent.id) === String(stat.sentence_id));
        return {
          sentence: s ? s.text : 'Unknown',
          count: stat.count
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [dailyStats, allSentences]);

  if (loadingAuth) {
    return <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors duration-500">
        <div className="text-slate-300 dark:text-slate-600 animate-pulse text-xs tracking-[0.5em] uppercase">Loading Space</div>
    </div>;
  }

  if (!currentUser) {
    return <AuthScreen onLogin={() => supabaseService.getCurrentUser().then(setCurrentUser)} />;
  }

  return (
    <div onClick={handleInteraction} className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer select-none bg-slate-50 dark:bg-slate-950 transition-colors duration-500 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-50 dark:bg-blue-900/20 rounded-full blur-[120px] opacity-40 transition-colors duration-700"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-[120px] opacity-40 transition-colors duration-700"></div>
      </div>

      <div className={`relative z-10 text-center px-10 w-full max-w-5xl transition-all duration-700 ${showStats || showManage ? 'blur-md opacity-20 scale-95' : 'blur-0 opacity-100 scale-100'}`}>
        <div className="flex flex-col items-center gap-2 mb-8">
           <div className={`flex items-center justify-center gap-4 transition-all duration-500 ease-in-out ${isAnimating ? 'opacity-20 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
            <div className="h-[1px] w-6 bg-slate-200 dark:bg-slate-800 transition-colors duration-500"></div>
            <div className="text-2xl md:text-3xl font-light text-slate-800 dark:text-slate-100 tracking-[0.3em] font-serif italic transition-colors duration-500">{currentNumber}</div>
            <div className="h-[1px] w-6 bg-slate-200 dark:bg-slate-800 transition-colors duration-500"></div>
          </div>
          <div className={`text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 transition-all duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            Today: {todayClickCount}
          </div>
        </div>
        
        <div className={`text-4xl md:text-6xl lg:text-7xl font-serif italic text-slate-800 dark:text-slate-200 leading-[1.2] transition-all duration-700 ease-in-out ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          {currentSentence?.text || '...'}
        </div>
      </div>

      {showStats && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/10 dark:bg-black/60 backdrop-blur-xl transition-colors duration-500">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-lg flex flex-col border border-white/50 dark:border-slate-800 overflow-hidden max-h-[80vh] transition-colors duration-500">
            <div className="p-8 pb-6 flex justify-between items-center border-b border-slate-50 dark:border-slate-800">
              <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-slate-400 dark:text-slate-500">Daily Logs</h2>
              <button onClick={() => setShowStats(false)} className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-200 dark:shadow-none">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
               {statsList.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 dark:text-slate-600 text-xs tracking-widest uppercase">No reflections yet today</div>
               ) : (
                 statsList.map((stat, idx) => (
                   <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <span className="text-sm font-serif italic text-slate-700 dark:text-slate-300 pr-4 line-clamp-2">"{stat.sentence}"</span>
                      <span className="px-3 py-1 bg-white dark:bg-slate-900 rounded-full text-[10px] font-black text-blue-600 dark:text-blue-400 shadow-sm border border-slate-100 dark:border-slate-700">{stat.count}</span>
                   </div>
                 ))
               )}
            </div>
             <div className="p-6 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center">
                <button onClick={handleResetAllCounters} className="text-[9px] font-black uppercase tracking-widest text-red-300 hover:text-red-500 transition-colors">Reset All Counters</button>
             </div>
          </div>
        </div>
      )}

      {showManage && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/10 dark:bg-black/60 backdrop-blur-xl transition-colors duration-500">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-white/50 dark:border-slate-800 overflow-hidden transition-colors duration-500">
            <div className="p-8 md:p-12 pb-6 flex justify-between items-center border-b border-slate-50 dark:border-slate-800">
              <div className="space-y-4">
                <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-slate-400 dark:text-slate-500">Content Studio</h2>
                <div className="flex gap-6">
                  <button onClick={() => setActiveTab('create')} className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'create' ? 'text-slate-900 dark:text-slate-100 border-slate-900 dark:border-slate-100' : 'text-slate-300 dark:text-slate-600 border-transparent hover:text-slate-500 dark:hover:text-slate-400'}`}>Add Content</button>
                  <button onClick={() => setActiveTab('library')} className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'library' ? 'text-slate-900 dark:text-slate-100 border-slate-900 dark:border-slate-100' : 'text-slate-300 dark:text-slate-600 border-transparent hover:text-slate-500 dark:hover:text-slate-400'}`}>Manage Library ({allSentences.length})</button>
                </div>
              </div>
              <div className="flex gap-4">
                  <button onClick={handleLogout} className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-all">
                    Log Out
                  </button>
                  <button onClick={() => setShowManage(false)} className="px-8 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-100 dark:shadow-none">Close</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12">
              {activeTab === 'create' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  <section className="space-y-8">
                    <div>
                      <h3 className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.3em] mb-6">Create Categories</h3>
                      <form onSubmit={handleAddCategory} className="flex gap-2 mb-8">
                        <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="e.g. Resilience" className="flex-1 px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600" />
                        <button type="submit" disabled={isSyncing} className="px-6 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50">Add</button>
                      </form>
                      <div className="flex flex-wrap gap-2">
                        {allCategories.map(cat => (
                          <span key={cat.id} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-wider">{cat.name}</span>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="space-y-8">
                    <h3 className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.3em] mb-6">New Sentence</h3>
                    <form onSubmit={handleAddSentence} className="space-y-8">
                      <textarea value={newSentenceText} onChange={e => setNewSentenceText(e.target.value)} placeholder="Enter a sentence that appears on countdown zero..." rows={4} className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all text-sm font-serif italic text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600" />
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tag Categories</p>
                        <div className="flex flex-wrap gap-2">
                          {allCategories.map(cat => (
                            <button key={cat.id} type="button" onClick={() => setSelectedCats(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])} className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${selectedCats.includes(cat.id) ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-50 dark:shadow-none' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-400 dark:hover:border-slate-500'}`}>
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button type="submit" disabled={isSyncing || !newSentenceText.trim()} className="w-full py-5 bg-blue-600 text-white rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 dark:shadow-none disabled:opacity-50">
                        {isSyncing ? 'Synchronizing...' : 'Commit to Cloud'}
                      </button>
                    </form>
                  </section>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-6 mb-10">
                    <div className="flex-1 relative">
                      <input 
                        type="text" 
                        placeholder="Search your wisdom library..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all text-sm italic font-serif text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>

                    <div className="flex flex-col gap-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 ml-2">Browse by Category</p>
                      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-scrollbar">
                        <button 
                          onClick={() => setFilterCategoryId('all')}
                          className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${filterCategoryId === 'all' ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'}`}
                        >
                          All Entries
                        </button>
                        {allCategories.map(cat => (
                          <button 
                            key={cat.id} 
                            onClick={() => setFilterCategoryId(cat.id)}
                            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${filterCategoryId === cat.id ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900 shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'}`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {filteredSentences.map(s => (
                      <div key={s.id} className={`p-8 rounded-3xl border transition-all ${editingId === s.id ? 'bg-blue-50/50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 ring-2 ring-blue-50 dark:ring-blue-900' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm hover:shadow-md'}`}>
                        {editingId === s.id ? (
                          <div className="space-y-6">
                            <textarea 
                              value={editForm.text} 
                              onChange={e => setEditForm(prev => ({ ...prev, text: e.target.value }))}
                              className="w-full p-6 bg-white dark:bg-slate-950 border border-blue-100 dark:border-blue-900 rounded-2xl text-sm font-serif italic focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 text-slate-800 dark:text-slate-200"
                              rows={3}
                            />
                            <div className="flex flex-wrap gap-2">
                              {allCategories.map(cat => (
                                <button 
                                  key={cat.id} 
                                  type="button" 
                                  onClick={() => setEditForm(prev => ({ ...prev, categoryIds: prev.categoryIds.includes(cat.id) ? prev.categoryIds.filter(id => id !== cat.id) : [...prev.categoryIds, cat.id] }))}
                                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${editForm.categoryIds.includes(cat.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}
                                >
                                  {cat.name}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                              <button onClick={() => setEditingId(null)} className="px-6 py-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700">Cancel</button>
                              <button onClick={() => handleUpdateSentence(s.id)} disabled={isSyncing} className="px-6 py-2 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 dark:shadow-none">Save Changes</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col md:flex-row justify-between gap-6">
                            <div className="space-y-4">
                              <p className="text-lg font-serif italic text-slate-800 dark:text-slate-200 leading-relaxed">"{s.text}"</p>
                              <div className="flex flex-wrap gap-2">
                                {(s.categoryIds || []).map(catId => {
                                  const cat = allCategories.find(c => c.id === catId);
                                  return cat ? <span key={catId} className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-slate-700">{cat.name}</span> : null;
                                })}
                              </div>
                            </div>
                            <div className="flex gap-2 items-center justify-end">
                              <button onClick={() => handleStartEdit(s)} className="p-3 text-slate-400 dark:text-slate-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121(0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              </button>
                              <button onClick={() => handleDeleteSentence(s.id)} className="p-3 text-slate-400 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`absolute bottom-8 w-full flex flex-col items-center gap-6 transition-all duration-700 ${showStats || showManage ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        
        <div className="w-full max-w-xs md:max-w-md px-6 overflow-x-auto no-scrollbar flex items-center justify-center gap-4 py-2">
            <button 
              onClick={(e) => handleFocusChange(e, 'all')}
              className={`text-[8px] font-black uppercase tracking-[0.3em] transition-all px-3 py-1 rounded-full whitespace-nowrap ${sessionFocusId === 'all' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'}`}
            >
              All Wisdom
            </button>
            {allCategories.map(cat => (
              <button 
                key={cat.id}
                onClick={(e) => handleFocusChange(e, cat.id)}
                className={`text-[8px] font-black uppercase tracking-[0.3em] transition-all px-3 py-1 rounded-full whitespace-nowrap ${sessionFocusId === cat.id ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'}`}
              >
                {cat.name}
              </button>
            ))}
        </div>

        <div className="flex gap-10 items-center">
          <button onClick={(e) => { e.stopPropagation(); setShowStats(true); }} className="text-slate-300 dark:text-slate-600 text-[10px] font-black tracking-[0.4em] uppercase hover:text-slate-900 dark:hover:text-slate-300 transition-colors">Logs</button>
          
          <div className="flex items-center gap-4">
            <button onClick={(e) => { e.stopPropagation(); setShowManage(true); }} className="group p-3 text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-300 transition-all rounded-full border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:-translate-y-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121(0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            
            <button onClick={toggleTheme} className="group p-3 text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-300 transition-all rounded-full border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:-translate-y-0.5">
               {theme === 'light' ? (
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
               )}
            </button>

            <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="group p-3 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-all rounded-full border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:-translate-y-0.5" title="Sign Out">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>

            <button 
              onClick={toggleMode} 
              className="text-[8px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors min-w-[60px]"
            >
              {counterMode === 'down' ? 'Descend' : 'Ascend'}
            </button>
          </div>

          <div className={`text-slate-300 dark:text-slate-600 text-[10px] font-black tracking-[0.4em] uppercase transition-all ${isSyncing ? 'opacity-100 text-blue-400 dark:text-blue-500 animate-pulse' : 'opacity-40'}`}>
            {isSyncing ? 'Sync' : 'Live'}
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
           {counterMode === 'down' ? (
             [...Array(randomLimit)].map((_, i) => (
               <div 
                  key={i} 
                  className={`h-[2px] rounded-full transition-all duration-700 ease-out 
                    ${i < currentNumber ? 'bg-slate-400 dark:bg-slate-500 w-5' : 'bg-slate-200 dark:bg-slate-800 w-1.5'}
                  `} 
               />
             ))
           ) : (
             <div className="flex items-center gap-1 opacity-50">
                <div className="h-[2px] w-12 bg-gradient-to-r from-transparent via-slate-400 dark:via-slate-500 to-transparent rounded-full animate-pulse"></div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default App;
