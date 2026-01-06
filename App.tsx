
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseService } from './services/supabaseService';
import { statsService } from './services/statsService';
import { Category } from './types';

const App: React.FC = () => {
  const [currentNumber, setCurrentNumber] = useState<number>(0);
  const [currentSentence, setCurrentSentence] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [showManage, setShowManage] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message: string }>({ connected: false, message: 'Checking...' });

  // Form states
  const [newCategory, setNewCategory] = useState('');
  const [newSentenceText, setNewSentenceText] = useState('');
  const [selectedCats, setSelectedCats] = useState<(string | number)[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const checkConnection = useCallback(async () => {
    setIsSyncing(true);
    const status = await supabaseService.testConnection();
    setDbStatus({ connected: status.success, message: status.message });
    await supabaseService.syncData();
    setAllCategories(supabaseService.getCategories());
    setIsSyncing(false);
  }, []);

  const initialize = useCallback(async () => {
    statsService.pruneStats();
    await checkConnection();
    
    const newNum = Math.floor(Math.random() * 7) + 1;
    const initialSentence = supabaseService.getRandomSentence();
    
    setCurrentNumber(newNum);
    setCurrentSentence(initialSentence);
  }, [checkConnection]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleInteraction = useCallback(() => {
    if (isAnimating || isSyncing || showStats || showManage) return;

    if (currentSentence) {
      statsService.recordClick(currentSentence);
    }

    setIsAnimating(true);
    
    setTimeout(() => {
      setCurrentNumber(prev => {
        if (prev <= 1) {
          const newNum = Math.floor(Math.random() * 7) + 1;
          const nextSentence = supabaseService.getRandomSentence();
          setCurrentSentence(nextSentence);
          return newNum;
        }
        return prev - 1;
      });
      setIsAnimating(false);
    }, 250);
  }, [isAnimating, isSyncing, showStats, showManage, currentSentence]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        handleInteraction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInteraction]);

  const dailyStats = useMemo(() => {
    if (!showStats) return [];
    return statsService.getStatsForDate();
  }, [showStats, currentNumber]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    
    setIsSyncing(true);
    const { error } = await supabaseService.addCategory(name);
    
    if (error) {
      alert(`Error: ${error}`);
    } else {
      setNewCategory('');
      setAllCategories(supabaseService.getCategories());
    }
    setIsSyncing(false);
  };

  const handleAddSentence = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newSentenceText.trim();
    if (!text) return;
    
    setIsSyncing(true);
    const { success, error } = await supabaseService.addSentence(text, selectedCats);
    
    if (error) {
      alert(`Feedback: ${error}`);
    }
    
    if (success) {
      setNewSentenceText('');
      setSelectedCats([]);
      // Reload cache to ensure the new sentence can appear next time
      await supabaseService.syncData();
      alert("Successfully added to your zen pool.");
    }
    setIsSyncing(false);
  };

  const toggleCatSelection = (id: string | number) => {
    setSelectedCats(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <div 
      onClick={handleInteraction}
      className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer select-none bg-slate-50 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-50 rounded-full blur-[120px] opacity-40"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-50 rounded-full blur-[120px] opacity-40"></div>
      </div>

      {/* Main Display */}
      <div className={`relative z-10 text-center px-10 w-full max-w-5xl transition-all duration-700 ${showStats || showManage ? 'blur-md opacity-20 scale-95' : 'blur-0 opacity-100 scale-100'}`}>
        <div className={`flex items-center justify-center gap-4 mb-8 transition-all duration-500 ease-in-out ${isAnimating ? 'opacity-20 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
          <div className="h-[1px] w-6 bg-slate-200"></div>
          <div className="text-lg md:text-xl font-medium text-slate-400 tracking-[0.3em]">{currentNumber}</div>
          <div className="h-[1px] w-6 bg-slate-200"></div>
        </div>
        <div className={`text-4xl md:text-6xl lg:text-7xl font-serif italic text-slate-800 leading-[1.2] transition-all duration-700 ease-in-out ${isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
          {currentSentence || ''}
        </div>
      </div>

      {/* Stats Overlay */}
      {showStats && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-white/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-slate-200/50 w-full max-w-lg max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold tracking-widest uppercase text-slate-400">Activity Logs</h2>
              <button onClick={() => setShowStats(false)} className="text-slate-300 hover:text-slate-900 transition-colors">Close</button>
            </div>
            <div className="space-y-4">
              {dailyStats.length === 0 ? (
                <p className="text-slate-400 italic text-center py-8">No clicks today.</p>
              ) : (
                dailyStats.map((stat, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4 pb-4 border-b border-slate-50 last:border-0">
                    <p className="font-serif text-slate-700 text-lg italic leading-tight">{stat.sentence}</p>
                    <span className="font-mono text-blue-500 font-bold">{stat.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Management Overlay */}
      {showManage && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-xl">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto relative border border-white/50">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-sm font-bold tracking-[0.3em] uppercase text-slate-400">Content Studio</h2>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`}></div>
                    <span className={`text-[10px] uppercase font-black tracking-widest ${dbStatus.connected ? 'text-green-600' : 'text-red-500'}`}>
                      {dbStatus.connected ? 'Supabase Linked' : 'Disconnected'}
                    </span>
                  </div>
                  {!dbStatus.connected && <p className="text-[10px] text-red-400 italic font-medium">{dbStatus.message}</p>}
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={checkConnection}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-slate-50 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50"
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button onClick={() => setShowManage(false)} className="px-4 py-2 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">Close</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              {/* Category Section */}
              <section className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-4">Tags</h3>
                  <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                    <input 
                      type="text" 
                      value={newCategory} 
                      onChange={e => setNewCategory(e.target.value)}
                      placeholder="e.g. Zen"
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                    />
                    <button type="submit" disabled={isSyncing || !dbStatus.connected} className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-colors">
                      +
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2">
                    {allCategories.map(cat => (
                      <span key={cat.id} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">{cat.name}</span>
                    ))}
                    {allCategories.length === 0 && <p className="text-slate-300 text-[10px] italic">No categories found in DB.</p>}
                  </div>
                </div>
              </section>

              {/* Sentence Section */}
              <section className="space-y-6">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-4">New Entry</h3>
                <form onSubmit={handleAddSentence} className="space-y-6">
                  <textarea 
                    value={newSentenceText}
                    onChange={e => setNewSentenceText(e.target.value)}
                    placeholder="Enter inspiring words..."
                    rows={4}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm font-serif italic text-slate-700"
                  />
                  
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign Tags</p>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 border border-slate-50 rounded-xl">
                      {allCategories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCatSelection(cat.id)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                            selectedCats.includes(cat.id) 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                      {allCategories.length === 0 && <p className="text-slate-300 text-[9px] italic p-2">Create a tag first.</p>}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSyncing || !dbStatus.connected || !newSentenceText.trim()} 
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {isSyncing ? 'Synchronizing...' : 'Push to Cloud'}
                  </button>
                  {!dbStatus.connected && <p className="text-center text-[9px] text-red-400 font-bold uppercase tracking-widest">Database connection required</p>}
                </form>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Footer Interface */}
      <div className={`absolute bottom-12 flex flex-col items-center gap-6 transition-all duration-700 ${showStats || showManage ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <div className="flex gap-10 items-center">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowStats(true); }}
            className="text-slate-300 text-[10px] font-black tracking-[0.4em] uppercase hover:text-slate-900 transition-colors"
          >Logs</button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setShowManage(true); }}
            className="group p-3 text-slate-300 hover:text-slate-900 transition-all rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>

          <div className={`text-slate-300 text-[10px] font-black tracking-[0.4em] uppercase transition-all ${isSyncing ? 'opacity-100 text-blue-400 animate-pulse' : 'opacity-40'}`}>
            {isSyncing ? 'Sync' : 'Cloud'}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="flex gap-2 items-center">
           {[...Array(7)].map((_, i) => (
             <div 
               key={i} 
               className={`h-[2px] rounded-full transition-all duration-700 ease-out ${i < currentNumber ? 'bg-slate-400 w-5' : 'bg-slate-200 w-1.5'}`}
             />
           ))}
        </div>
      </div>

      <style>{`
        body { user-select: none; -webkit-tap-highlight-color: transparent; background-color: #f8fafc; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
