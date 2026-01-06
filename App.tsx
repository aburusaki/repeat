
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

  // Form states
  const [newCategory, setNewCategory] = useState('');
  const [newSentenceText, setNewSentenceText] = useState('');
  const [selectedCats, setSelectedCats] = useState<(string | number)[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const initialize = useCallback(async () => {
    setIsSyncing(true);
    statsService.pruneStats();
    await supabaseService.syncData();
    
    const newNum = Math.floor(Math.random() * 7) + 1;
    const newSentence = supabaseService.getRandomSentence();
    
    setAllCategories(supabaseService.getCategories());
    setCurrentNumber(newNum);
    setCurrentSentence(newSentence);
    setIsSyncing(false);
  }, []);

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
          setCurrentSentence(supabaseService.getRandomSentence());
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
    if (!newCategory.trim()) return;
    await supabaseService.addCategory(newCategory.trim());
    setNewCategory('');
    setAllCategories(supabaseService.getCategories());
  };

  const handleAddSentence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSentenceText.trim()) return;
    const success = await supabaseService.addSentence(newSentenceText.trim(), selectedCats);
    if (success) {
      setNewSentenceText('');
      setSelectedCats([]);
    }
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

      <div className={`relative z-10 text-center px-10 w-full max-w-5xl transition-all duration-700 ${showStats || showManage ? 'blur-md opacity-20 scale-95' : 'blur-0 opacity-100 scale-100'}`}>
        <div className={`flex items-center justify-center gap-4 mb-8 transition-all duration-500 ease-in-out ${isAnimating ? 'opacity-20 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
          <div className="h-[1px] w-6 bg-slate-200"></div>
          <div className="text-lg md:text-xl font-medium text-slate-400 tracking-[0.3em]">{currentNumber}</div>
          <div className="h-[1px] w-6 bg-slate-200"></div>
        </div>
        <div className={`text-4xl md:text-6xl lg:text-7xl font-serif italic text-slate-800 leading-[1.2] transition-all duration-700 ease-in-out ${isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
          {currentSentence ? `“${currentSentence}”` : ''}
        </div>
      </div>

      {/* Stats Overlay */}
      {showStats && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-white/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-slate-200/50 w-full max-w-lg max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold tracking-widest uppercase text-slate-400">Today's Wisdom Stats</h2>
              <button onClick={() => setShowStats(false)} className="text-slate-300 hover:text-slate-900 transition-colors">Close</button>
            </div>
            <div className="space-y-4">
              {dailyStats.length === 0 ? (
                <p className="text-slate-400 italic text-center py-8">No interactions recorded today yet.</p>
              ) : (
                dailyStats.map((stat, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4 pb-4 border-b border-slate-50 last:border-0">
                    <p className="font-serif text-slate-700 text-lg italic leading-tight">“{stat.sentence}”</p>
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
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/5 backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-sm font-bold tracking-widest uppercase text-slate-400">Manage Content</h2>
              <button onClick={() => setShowManage(false)} className="text-slate-300 hover:text-slate-900 transition-colors text-xs font-bold uppercase tracking-tighter">Close</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Category Section */}
              <section>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Categories</h3>
                <form onSubmit={handleAddCategory} className="mb-6 flex gap-2">
                  <input 
                    type="text" 
                    value={newCategory} 
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="Category name..."
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-blue-200 text-sm"
                  />
                  <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">Add</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {allCategories.map(cat => (
                    <span key={cat.id} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">{cat.name}</span>
                  ))}
                  {allCategories.length === 0 && <p className="text-slate-300 text-[10px] italic">No categories yet.</p>}
                </div>
              </section>

              {/* Sentence Section */}
              <section>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Add Sentence</h3>
                <form onSubmit={handleAddSentence} className="space-y-4">
                  <textarea 
                    value={newSentenceText}
                    onChange={e => setNewSentenceText(e.target.value)}
                    placeholder="Enter inspiring words..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-blue-200 text-sm font-serif italic"
                  />
                  
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Categories</p>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                      {allCategories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCatSelection(cat.id)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                            selectedCats.includes(cat.id) 
                            ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-200' 
                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-shadow shadow-lg shadow-blue-100">Save Sentence</button>
                </form>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className={`absolute bottom-12 flex flex-col items-center gap-6 transition-all duration-700 ${showStats || showManage ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <div className="flex gap-8 items-center">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowStats(true); }}
            className="text-slate-300 text-[9px] font-bold tracking-[0.5em] uppercase hover:text-slate-500 transition-colors"
          >Stats</button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setShowManage(true); }}
            className="p-2 text-slate-300 hover:text-slate-900 transition-colors rounded-full border border-slate-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>

          <div className={`text-slate-300 text-[9px] font-bold tracking-[0.5em] uppercase opacity-40`}>
            {isSyncing ? 'Syncing' : 'Flow'}
          </div>
        </div>
        
        {/* Progress Indicator */}
        <div className="flex gap-2 items-center">
           {[...Array(7)].map((_, i) => (
             <div 
               key={i} 
               className={`h-[2px] rounded-full transition-all duration-700 ease-out ${i < currentNumber ? 'bg-slate-300 w-4' : 'bg-slate-100 w-1'}`}
             />
           ))}
        </div>
      </div>

      <style>{`
        body { user-select: none; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
