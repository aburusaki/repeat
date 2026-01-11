import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabaseService } from './services/supabaseService';
import { Category, Sentence, DailyStat } from './types';
import { User } from '@supabase/supabase-js';

// --- HELPER: TIME FORMATTER ---
const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
};

// --- CHART COMPONENT ---
const StatsChart: React.FC<{ stats: DailyStat[] }> = ({ stats }) => {
  const chartData = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const aggregated = days.map(dateStr => {
        const total = stats
            .filter(s => s.date === dateStr)
            .reduce((sum, curr) => sum + curr.count, 0);
        
        const dateObj = new Date(dateStr);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
        
        return { date: dateStr, total, dayName };
    });

    return aggregated;
  }, [stats]);

  const maxVal = Math.max(...chartData.map(d => d.total), 1); 

  return (
    <div className="w-full h-48 flex items-end justify-between gap-2 md:gap-4 mb-6 px-2">
      {chartData.map((d, i) => {
        const heightPct = (d.total / maxVal) * 100;
        const isToday = d.date === new Date().toISOString().split('T')[0];
        
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group">
            <div className={`text-[10px] font-bold transition-all ${isToday ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-slate-400 dark:text-slate-500'} ${d.total === 0 ? 'opacity-0' : 'opacity-100'}`}>
                {d.total}
            </div>
            <div className="relative w-full flex items-end h-24 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden">
                <div 
                    style={{ height: `${heightPct}%` }} 
                    className={`w-full transition-all duration-1000 ease-out rounded-t-md ${isToday ? 'bg-blue-500 dark:bg-blue-600' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'}`}
                ></div>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-wider ${isToday ? 'text-blue-500 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}>
                {d.dayName}
            </span>
          </div>
        );
      })}
    </div>
  );
};

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
  const [currentNumber, setCurrentNumber] = useState<number>(3);
  const [randomLimit, setRandomLimit] = useState<number>(3); 
  const [countdownConfig, setCountdownConfig] = useState<number | 'random'>(3); 
  const [currentSentence, setCurrentSentence] = useState<Sentence | null>(null);
  const [counterMode, setCounterMode] = useState<'up' | 'down'>('down');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [showManage, setShowManage] = useState<boolean>(false);
  
  // Time Tracking State
  const [dailyTime, setDailyTime] = useState<number>(0); 
  const [unsyncedTime, setUnsyncedTime] = useState<number>(0); 
  const [isActiveUser, setIsActiveUser] = useState<boolean>(false);
  const lastActivityTime = useRef<number>(Date.now());
  const ACTIVITY_THRESHOLD_MS = 2000; 
  const SYNC_INTERVAL_MS = 3000; 

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [sessionFocusId, setSessionFocusId] = useState<string | number | 'all'>('all');

  // Interaction throttling & State Refs
  const lastScrollTime = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  
  // REFS for stable access in async operations
  const currentNumberRef = useRef(currentNumber);
  const countdownConfigRef = useRef(countdownConfig);
  const sessionFocusIdRef = useRef(sessionFocusId);
  const counterModeRef = useRef(counterMode);
  const allSentencesRef = useRef<Sentence[]>([]);
  const lastShownIdRef = useRef<string | number | null>(null);
  const isAnimatingRef = useRef<boolean>(false); // NEW: Synchronous lock for interactions

  // Sync Refs
  useEffect(() => { currentNumberRef.current = currentNumber; }, [currentNumber]);
  useEffect(() => { countdownConfigRef.current = countdownConfig; }, [countdownConfig]);
  useEffect(() => { sessionFocusIdRef.current = sessionFocusId; }, [sessionFocusId]);
  useEffect(() => { counterModeRef.current = counterMode; }, [counterMode]);

  // Sentence Selection Queue (Shuffle Bag)
  const sentenceQueue = useRef<Sentence[]>([]);

  // Data State
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSentences, setAllSentences] = useState<Sentence[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [historicalStats, setHistoricalStats] = useState<DailyStat[]>([]);

  // Form State
  const [newCategory, setNewCategory] = useState('');
  const [newSentenceText, setNewSentenceText] = useState('');
  const [selectedCats, setSelectedCats] = useState<(string | number)[]>([]);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<{ text: string; categoryIds: (string | number)[]; count: number }>({ text: '', categoryIds: [], count: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | number | 'all'>('all');

  // Stats Editing State
  const [editingStatId, setEditingStatId] = useState<string | number | null>(null);
  const [statEditValue, setStatEditValue] = useState<number>(0);

  // Derived State
  const todayClickCount = useMemo(() => {
    if (!currentSentence) return 0;
    const stat = dailyStats.find(s => String(s.sentence_id) === String(currentSentence.id));
    return stat ? stat.count : 0;
  }, [currentSentence, dailyStats]);

  // Stable Limit Generator
  const getNextLimit = useCallback(() => {
    const cfg = countdownConfigRef.current;
    if (cfg === 'random') {
      return Math.floor(Math.random() * 7) + 1;
    }
    return typeof cfg === 'number' && cfg > 0 ? cfg : 3;
  }, []);

  // Haptic Logic
  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15); 
    }
    const label = document.getElementById('haptic-trigger');
    if (label) {
        label.click();
    }
  }, []);

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
    const history = await supabaseService.getHistoricalStats(7);
    const time = await supabaseService.getDailyTime();
    
    setAllSentences(sents);
    setAllCategories(cats);
    setDailyStats(stats); 
    setHistoricalStats(history);
    setDailyTime(time);
  }, [currentUser]);

  // --- DATA INITIALIZATION & SUBSCRIPTION ---
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
          supabaseService.getHistoricalStats(7).then(setHistoricalStats);
        },
        (totalTime) => {
            setDailyTime(prev => Math.max(prev, totalTime));
        }
      );
    } catch (e) {
      console.error("Subscription failed:", e);
    }

    return () => {
      unsubscribe();
    };
  }, [currentUser, refreshData]);

  // --- ACTIVITY TRACKER ---
  useEffect(() => {
    if (!currentUser) return;
    const recordActivity = () => {
        lastActivityTime.current = Date.now();
        if (!isActiveUser) setIsActiveUser(true);
    };
    const debouncedRecord = () => {
        if (Date.now() - lastActivityTime.current > 100) recordActivity();
    };
    window.addEventListener('mousemove', debouncedRecord);
    window.addEventListener('mousedown', recordActivity);
    window.addEventListener('touchstart', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('scroll', debouncedRecord);
    window.addEventListener('click', recordActivity);
    return () => {
        window.removeEventListener('mousemove', debouncedRecord);
        window.removeEventListener('mousedown', recordActivity);
        window.removeEventListener('touchstart', recordActivity);
        window.removeEventListener('keydown', recordActivity);
        window.removeEventListener('scroll', debouncedRecord);
        window.removeEventListener('click', recordActivity);
    };
  }, [currentUser, isActiveUser]);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
        const now = Date.now();
        if (now - lastActivityTime.current < ACTIVITY_THRESHOLD_MS) {
            setIsActiveUser(true);
            setDailyTime(prev => prev + 1);
            setUnsyncedTime(prev => prev + 1);
        } else {
            setIsActiveUser(false);
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(async () => {
        if (unsyncedTime > 0) {
            const timeToSend = unsyncedTime;
            setUnsyncedTime(0);
            const newTotal = await supabaseService.incrementDailyTime(timeToSend);
            if (newTotal > 0) setDailyTime(newTotal);
        }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [currentUser, unsyncedTime]);


  // --- CORE LOGIC: RANDOMIZED ROUND ROBIN ---

  const getNextSentence = useCallback((focusId: string | number | 'all') => {
    const sents = allSentencesRef.current;
    
    // Filter
    const relevant = sents.filter(s => 
      focusId === 'all' || (s.categoryIds || []).includes(focusId)
    );

    if (relevant.length === 0) return null;
    if (relevant.length === 1) return relevant[0];

    // Refill Queue if empty
    if (sentenceQueue.current.length === 0) {
      const newQueue = [...relevant];
      
      // Fisher-Yates Shuffle
      for (let i = newQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
      }

      // Boundary Check: Prevent immediate repeat when cycle restarts
      // We pop from the end, so index [length-1] is the next one.
      if (lastShownIdRef.current !== null && newQueue.length > 1) {
          const nextUp = newQueue[newQueue.length - 1]; 
          if (nextUp.id === lastShownIdRef.current) {
             // Swap last item (nextUp) with first item (index 0)
             [newQueue[newQueue.length - 1], newQueue[0]] = [newQueue[0], newQueue[newQueue.length - 1]];
          }
      }

      sentenceQueue.current = newQueue;
    }

    // Pick next
    let next = sentenceQueue.current.pop();
    
    // Validate (in case sentence was deleted mid-cycle)
    while (next && !relevant.find(r => r.id === next?.id)) {
        if (sentenceQueue.current.length === 0) {
             // If we run out while filtering, force recursion to refill
            return getNextSentence(focusId);
        }
        next = sentenceQueue.current.pop();
    }
    
    if (next) lastShownIdRef.current = next.id;
    return next || null;
  }, []); 

  // Stable Reset Logic
  const resetCycle = useCallback((mode: 'up' | 'down', focusId: string | number | 'all') => {
    const newLimit = getNextLimit();
    const newSentenceObj = getNextSentence(focusId);
    
    setRandomLimit(newLimit);
    setCurrentSentence(newSentenceObj);
    setCurrentNumber(mode === 'down' ? newLimit : 1);
  }, [getNextSentence, getNextLimit]);

  // Update Data Ref
  useEffect(() => {
    allSentencesRef.current = allSentences;
  }, [allSentences]);

  // 1. Initial Load (Data Arrival)
  useEffect(() => {
    if (!currentSentence && allSentences.length > 0) {
        resetCycle(counterMode, sessionFocusId);
    }
  }, [allSentences, currentSentence, resetCycle, counterMode, sessionFocusId]);

  // 2. Focus/Category Change -> Full Reset
  useEffect(() => {
    if (allSentencesRef.current.length > 0) {
        resetCycle(counterModeRef.current, sessionFocusId);
    }
  }, [sessionFocusId, resetCycle]); 

  // 3. Config Change -> Update Limit ONLY (Preserve Flow)
  useEffect(() => {
    let newLimit = 3;
    if (countdownConfig === 'random') {
        newLimit = Math.floor(Math.random() * 7) + 1;
    } else if (typeof countdownConfig === 'number' && countdownConfig > 0) {
        newLimit = countdownConfig;
    }
    
    setRandomLimit(newLimit);
    setCurrentNumber(counterModeRef.current === 'down' ? newLimit : 1);
  }, [countdownConfig]); 


  // --- INTERACTION ---

  const handleFocusChange = (e: React.MouseEvent, id: string | number | 'all') => {
    e.stopPropagation();
    if (id === sessionFocusId) return; 
    setSessionFocusId(id);
    sentenceQueue.current = []; // Clear bag to enforce new category constraints
  };

  const handleInteraction = useCallback(() => {
    // IMPORTANT: Check ref here for synchronous blocking
    if (isAnimatingRef.current || showStats || showManage) return;

    const currentVal = currentNumberRef.current;
    const mode = counterModeRef.current;

    // Trigger haptic if finished
    if (mode === 'down' && currentVal <= 1) {
        triggerHaptic();
    }
    
    if (currentSentence) {
       supabaseService.incrementStat(currentSentence.id);
    }

    // Set lock immediately
    isAnimatingRef.current = true;
    setIsAnimating(true);
    
    setTimeout(() => {
       const valNow = currentNumberRef.current;

       if (mode === 'down') {
         if (valNow <= 1) {
             // Reset Logic
             const newLimit = getNextLimit();
             const nextSentence = getNextSentence(sessionFocusIdRef.current);
             
             setRandomLimit(newLimit);
             setCurrentSentence(nextSentence);
             setCurrentNumber(newLimit);
         } else {
             setCurrentNumber(valNow - 1);
         }
       } else {
         setCurrentNumber(valNow + 1);
       }
       
       setIsAnimating(false);
       isAnimatingRef.current = false; // Release lock
    }, 250);
  }, [showStats, showManage, currentSentence, getNextSentence, getNextLimit, triggerHaptic]);

  // Keyboard and Scroll Interaction Effects
  useEffect(() => {
    if (!currentUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
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
      refreshData();
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
      refreshData();
    }
    setIsSyncing(false);
  };

  const handleStartEdit = (s: Sentence) => {
    setEditingId(s.id);
    const dailyStat = dailyStats.find(ds => String(ds.sentence_id) === String(s.id));
    setEditForm({ 
        text: s.text, 
        categoryIds: s.categoryIds || [],
        count: dailyStat ? dailyStat.count : 0
    });
  };

  const handleUpdateSentence = async (id: string | number) => {
    setIsSyncing(true);
    const countPromise = supabaseService.updateDailyCount(id, editForm.count);
    const contentPromise = supabaseService.updateSentence(id, editForm.text, editForm.categoryIds);
    const [countResult, contentResult] = await Promise.all([countPromise, contentPromise]);
    if (contentResult.success && countResult.success) {
      setEditingId(null);
      refreshData();
    } else {
      alert(`Update Error: ${contentResult.error || countResult.error}`);
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
      setAllSentences(prev => prev.filter(s => s.id !== id));
      refreshData();
      if (currentSentence?.id === id) {
        const remaining = allSentences.filter(s => s.id !== id);
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
      const { success, error } = await supabaseService.resetAllStats();
      if (!success) alert(`Reset Error: ${error}`);
      else refreshData();
    }
  };

  const handleStartStatEdit = (id: string | number, count: number) => {
    setEditingStatId(id);
    setStatEditValue(count);
  };

  const handleSaveStatEdit = async (id: string | number) => {
    setIsSyncing(true);
    const { success, error } = await supabaseService.updateDailyCount(id, statEditValue);
    if(success) {
        setEditingStatId(null);
        refreshData();
    } else {
        alert(error);
    }
    setIsSyncing(false);
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
          sentenceId: stat.sentence_id,
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
      
      <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" aria-hidden="true">
        <label id="haptic-trigger">
            <input type="checkbox" {...{'switch': ''} as any} />
        </label>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-50 dark:bg-blue-900/20 rounded-full blur-[120px] opacity-40 transition-colors duration-700"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-[120px] opacity-40 transition-colors duration-700"></div>
      </div>

      {/* TOP MENU BAR */}
      <div 
        className={`absolute top-0 w-full z-20 flex flex-col gap-4 pt-6 pb-6 px-6 bg-gradient-to-b from-slate-50/90 via-slate-50/50 to-transparent dark:from-slate-950/90 dark:via-slate-950/50 transition-all duration-700 ${showStats || showManage ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}
        onClick={(e) => e.stopPropagation()} 
      >
         <div className="w-full overflow-x-auto no-scrollbar flex items-center justify-center gap-3">
            <button 
              onClick={(e) => handleFocusChange(e, 'all')}
              className={`text-[8px] font-black uppercase tracking-[0.2em] transition-all px-3 py-1.5 rounded-full whitespace-nowrap border ${sessionFocusId === 'all' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30' : 'text-slate-300 dark:text-slate-600 border-transparent hover:text-slate-500 dark:hover:text-slate-400'}`}
            >
              All
            </button>
            {allCategories.map(cat => (
              <button 
                key={cat.id}
                onClick={(e) => handleFocusChange(e, cat.id)}
                className={`text-[8px] font-black uppercase tracking-[0.2em] transition-all px-3 py-1.5 rounded-full whitespace-nowrap border ${sessionFocusId === cat.id ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30' : 'text-slate-300 dark:text-slate-600 border-transparent hover:text-slate-500 dark:hover:text-slate-400'}`}
              >
                {cat.name}
              </button>
            ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-3">
                 <div className={`transition-all duration-500 flex items-center gap-2 ${isActiveUser ? 'opacity-100' : 'opacity-50'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isActiveUser ? 'bg-green-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <div className="text-slate-300 dark:text-slate-600 text-[10px] font-black tracking-[0.1em] uppercase tabular-nums">
                        {formatTime(dailyTime)}
                    </div>
                 </div>

                 <div className={`text-slate-300 dark:text-slate-600 text-[9px] font-black tracking-[0.1em] uppercase transition-all ${isSyncing ? 'opacity-100 text-blue-400 dark:text-blue-500 animate-pulse' : 'opacity-30'}`}>
                    {isSyncing ? 'Sync' : 'Live'}
                 </div>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={(e) => { e.stopPropagation(); setShowStats(true); }} className="text-slate-300 dark:text-slate-600 text-[9px] font-black tracking-[0.2em] uppercase hover:text-slate-900 dark:hover:text-slate-300 transition-colors">Logs</button>
                
                <button onClick={(e) => { e.stopPropagation(); setShowManage(true); }} className="p-2 text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-300 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121(0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </button>
                
                <button onClick={toggleTheme} className="p-2 text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-300 transition-all">
                   {theme === 'light' ? (
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                   )}
                </button>

                <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-all" title="Sign Out">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
            </div>

            <div className="flex items-center gap-3 pl-3 border-l border-slate-100 dark:border-slate-800">
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">Max</label>
                    <input 
                        type="number" 
                        min="1" 
                        max="50"
                        value={countdownConfig === 'random' ? '' : countdownConfig}
                        placeholder="?"
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val > 0) setCountdownConfig(val);
                        }}
                        className="w-6 bg-transparent border-b border-slate-200 dark:border-slate-800 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors p-0"
                    />
                    <button 
                        onClick={() => setCountdownConfig('random')}
                        className={`text-[8px] font-black uppercase tracking-widest transition-colors ${countdownConfig === 'random' ? 'text-blue-500' : 'text-slate-300 dark:text-slate-700 hover:text-slate-500'}`}
                    >
                        RND
                    </button>
                </div>

                <button 
                  onClick={toggleMode} 
                  className="text-[8px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                >
                  {counterMode === 'down' ? 'Down' : 'Up'}
                </button>
            </div>
        </div>

        <div className="flex gap-2 items-center justify-center mt-2">
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

      {/* Main Content */}
      <div className={`relative z-10 text-center px-10 w-full max-w-5xl transition-all duration-700 mt-20 ${showStats || showManage ? 'blur-md opacity-20 scale-95' : 'blur-0 opacity-100 scale-100'}`}>
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
        
        <div 
           key={currentSentence?.id}
           className={`text-4xl md:text-6xl lg:text-7xl font-serif italic text-slate-800 dark:text-slate-200 leading-[1.2] transition-all duration-700 ease-in-out ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
        >
          {currentSentence?.text || '...'}
        </div>
      </div>

      {/* STATS MODAL */}
      {showStats && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/10 dark:bg-black/60 backdrop-blur-xl transition-colors duration-500">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-lg flex flex-col border border-white/50 dark:border-slate-800 overflow-hidden max-h-[80vh] transition-colors duration-500">
            <div className="p-8 pb-6 flex justify-between items-center border-b border-slate-50 dark:border-slate-800">
              <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-slate-400 dark:text-slate-500">Daily Logs</h2>
              <button onClick={() => setShowStats(false)} className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-200 dark:shadow-none">Close</button>
            </div>
            
            <div className="px-8 mt-4">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">Last 7 Days</h3>
                 <StatsChart stats={historicalStats} />
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-4 sticky top-0 bg-white dark:bg-slate-900 py-2">Today's Breakdown</h3>
               {statsList.length === 0 ? (
                 <div className="text-center py-4 text-slate-400 dark:text-slate-600 text-xs tracking-widest uppercase">No reflections yet today</div>
               ) : (
                 statsList.map((stat, idx) => (
                   <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <span className="text-sm font-serif italic text-slate-700 dark:text-slate-300 pr-4 line-clamp-2">"{stat.sentence}"</span>
                      {editingStatId === stat.sentenceId ? (
                        <div className="flex items-center gap-2">
                           <input 
                             type="number"
                             min="0"
                             autoFocus
                             className="w-16 px-2 py-1 bg-white dark:bg-slate-950 border border-blue-500 rounded-lg text-sm font-bold text-center focus:outline-none"
                             value={statEditValue}
                             onChange={(e) => setStatEditValue(parseInt(e.target.value) || 0)}
                           />
                           <button onClick={() => handleSaveStatEdit(stat.sentenceId)} className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                           </button>
                           <button onClick={() => setEditingStatId(null)} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                           </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                           <span className="px-3 py-1 bg-white dark:bg-slate-900 rounded-full text-[10px] font-black text-blue-600 dark:text-blue-400 shadow-sm border border-slate-100 dark:border-slate-700 min-w-[2rem] text-center">{stat.count}</span>
                           <button onClick={() => handleStartStatEdit(stat.sentenceId, stat.count)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121(0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                           </button>
                        </div>
                      )}
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

      {/* MANAGE MODAL */}
      {showManage && (
         <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/10 dark:bg-black/60 backdrop-blur-xl transition-colors duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-lg flex flex-col border border-white/50 dark:border-slate-800 overflow-hidden max-h-[80vh] transition-colors duration-500">
                <div className="p-8 pb-6 flex justify-between items-center border-b border-slate-50 dark:border-slate-800">
                  <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-slate-400 dark:text-slate-500">Manage Space</h2>
                  <button onClick={() => { setShowManage(false); setEditingId(null); }} className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-200 dark:shadow-none">Done</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    
                    {/* Add Category */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">Add Category</h3>
                        <form onSubmit={handleAddCategory} className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="New Category Name" 
                                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                            />
                            <button type="submit" className="px-4 bg-slate-200 dark:bg-slate-800 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </form>
                    </div>

                    {/* Add Sentence */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">Add Sentence</h3>
                        <form onSubmit={handleAddSentence} className="space-y-3">
                            <textarea 
                                placeholder="Enter your sentence here..." 
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200 resize-none h-24"
                                value={newSentenceText}
                                onChange={(e) => setNewSentenceText(e.target.value)}
                            />
                            <div className="flex flex-wrap gap-2">
                                {allCategories.map(cat => (
                                    <button 
                                        key={cat.id}
                                        type="button"
                                        onClick={() => {
                                            if (selectedCats.includes(cat.id)) {
                                                setSelectedCats(selectedCats.filter(id => id !== cat.id));
                                            } else {
                                                setSelectedCats([...selectedCats, cat.id]);
                                            }
                                        }}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${selectedCats.includes(cat.id) ? 'bg-blue-500 text-white border-blue-500' : 'bg-transparent text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'}`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                            <button type="submit" className="w-full py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90">
                                Save Sentence
                            </button>
                        </form>
                    </div>

                    {/* Manage List */}
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">Library</h3>
                            <div className="flex items-center gap-2">
                                <select 
                                    className="bg-transparent text-[10px] font-bold text-slate-400 uppercase focus:outline-none text-right"
                                    value={filterCategoryId}
                                    onChange={(e) => setFilterCategoryId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                >
                                    <option value="all">All Cats</option>
                                    {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-lg px-4 py-2 text-xs focus:ring-0 text-slate-600 dark:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />

                        <div className="space-y-3">
                            {filteredSentences.map(s => (
                                <div key={s.id} className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800 group">
                                    {editingId === s.id ? (
                                        <div className="space-y-3">
                                            <textarea 
                                                className="w-full bg-white dark:bg-slate-900 border border-blue-500 rounded-xl p-3 text-sm focus:outline-none dark:text-slate-200"
                                                value={editForm.text}
                                                onChange={(e) => setEditForm({...editForm, text: e.target.value})}
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                {allCategories.map(cat => (
                                                    <button 
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const ids = editForm.categoryIds;
                                                            if (ids.includes(cat.id)) {
                                                                setEditForm({...editForm, categoryIds: ids.filter(id => id !== cat.id)});
                                                            } else {
                                                                setEditForm({...editForm, categoryIds: [...ids, cat.id]});
                                                            }
                                                        }}
                                                        className={`px-2 py-0.5 rounded text-[9px] font-bold border ${editForm.categoryIds.includes(cat.id) ? 'bg-blue-500 text-white border-blue-500' : 'text-slate-400 border-slate-200 dark:border-slate-700'}`}
                                                    >
                                                        {cat.name}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleUpdateSentence(s.id)} className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-bold uppercase">Save</button>
                                                <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold uppercase">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-2">
                                                <p className="text-sm font-serif italic text-slate-700 dark:text-slate-300">{s.text}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {(s.categoryIds || []).map(cid => {
                                                        const c = allCategories.find(cat => cat.id === cid);
                                                        return c ? <span key={cid} className="text-[8px] font-bold uppercase text-slate-400 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded">{c.name}</span> : null;
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleStartEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121(0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                                <button onClick={() => handleDeleteSentence(s.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;