
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseService } from './services/supabaseService';
import { statsService } from './services/statsService';
import { Category, Sentence } from './types';

const App: React.FC = () => {
  const [currentNumber, setCurrentNumber] = useState<number>(0);
  const [randomLimit, setRandomLimit] = useState<number>(7); 
  const [currentSentence, setCurrentSentence] = useState<string>('');
  const [counterMode, setCounterMode] = useState<'up' | 'down'>('down');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [showManage, setShowManage] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  
  const [sessionFocusId, setSessionFocusId] = useState<string | number | 'all'>('all');

  const [newCategory, setNewCategory] = useState('');
  const [newSentenceText, setNewSentenceText] = useState('');
  const [selectedCats, setSelectedCats] = useState<(string | number)[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSentences, setAllSentences] = useState<Sentence[]>([]);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<{ text: string; categoryIds: (string | number)[] }>({ text: '', categoryIds: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | number | 'all'>('all');

  const todayClickCount = useMemo(() => {
    return statsService.getSentenceCount(currentSentence);
  }, [currentSentence, currentNumber]);

  const generateRandomLimit = () => Math.floor(Math.random() * 1) + 1;

  const loadData = useCallback(async () => {
    setIsSyncing(true);
    const status = await supabaseService.testConnection();
    if (status.success) {
      const sents = await supabaseService.syncData();
      setAllCategories(supabaseService.getCategories());
      setAllSentences(sents);
    }
    setIsSyncing(false);
  }, []);

  const resetCycle = useCallback((mode: 'up' | 'down', focusId: string | number | 'all') => {
    const newLimit = generateRandomLimit();
    const newSentence = supabaseService.getRandomSentence(focusId);
    
    setRandomLimit(newLimit);
    setCurrentSentence(newSentence);
    setCurrentNumber(mode === 'down' ? newLimit : 1);
  }, []);

  useEffect(() => {
    statsService.pruneStats();
    loadData().then(() => {
      resetCycle(counterMode, sessionFocusId);
    });
  }, [loadData]);

  const handleFocusChange = (e: React.MouseEvent, id: string | number | 'all') => {
    e.stopPropagation();
    setSessionFocusId(id);
    resetCycle(counterMode, id);
  };

  const handleInteraction = useCallback(() => {
    if (isAnimating || isSyncing || showStats || showManage) return;
    
    if (currentSentence) {
      statsService.recordClick(currentSentence);
    }

    setIsAnimating(true);
    
    setTimeout(() => {
      setCurrentNumber(prev => {
        if (counterMode === 'down') {
          if (prev <= 1) {
            const newLimit = generateRandomLimit();
            setRandomLimit(newLimit);
            setCurrentSentence(supabaseService.getRandomSentence(sessionFocusId));
            return newLimit;
          }
          return prev - 1;
        } else {
          if (prev >= randomLimit) {
            const newLimit = generateRandomLimit();
            setRandomLimit(newLimit);
            setCurrentSentence(supabaseService.getRandomSentence(sessionFocusId));
            return 1;
          }
          return prev + 1;
        }
      });
      setIsAnimating(false);
    }, 250);
  }, [isAnimating, isSyncing, showStats, showManage, currentSentence, counterMode, sessionFocusId, randomLimit]);

  const toggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMode = counterMode === 'down' ? 'up' : 'down';
    setCounterMode(newMode);
    setCurrentNumber(newMode === 'down' ? randomLimit : 1);
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
      await loadData();
    }
    setIsSyncing(false);
  };

  const handleAddSentence = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newSentenceText.trim();
    if (!text) return;
    setIsSyncing(true);
    const { success, error } = await supabaseService.addSentence(text, selectedCats);
    if (error) alert(`Save Error: ${error}\n\nTip: Check if RLS policies are enabled on your Supabase tables.`);
    if (success) {
      setNewSentenceText('');
      setSelectedCats([]);
      await loadData();
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
      // Immediately refresh the list from the newly synced cloud data
      setAllSentences(await supabaseService.getSentences());
    } else {
      alert(`Update Error: ${error}\n\nEnsure you have 'UPDATE' and 'DELETE' (for categories) permissions in Supabase.`);
    }
    setIsSyncing(false);
  };

  const handleDeleteSentence = async (id: string | number) => {
    if (!confirm("Delete this entry permanently?")) return;
    setIsSyncing(true);
    const { success, error } = await supabaseService.deleteSentence(id);
    if (success) await loadData();
    else alert(`Delete Error: ${error}`);
    setIsSyncing(false);
  };

  const filteredSentences = useMemo(() => {
    return allSentences.filter(s => {
      const matchesSearch = s.text.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategoryId === 'all' || (s.categoryIds || []).includes(filterCategoryId);
      return matchesSearch && matchesCategory;
    });
  }, [allSentences, searchTerm, filterCategoryId]);

  return (
    <div onClick={handleInteraction} className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer select-none bg-slate-50 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-50 rounded-full blur-[120px] opacity-40"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-50 rounded-full blur-[120px] opacity-40"></div>
      </div>

      <div className={`relative z-10 text-center px-10 w-full max-w-5xl transition-all duration-700 ${showStats || showManage ? 'blur-md opacity-20 scale-95' : 'blur-0 opacity-100 scale-100'}`}>
        <div className="flex flex-col items-center gap-2 mb-8">
           <div className={`flex items-center justify-center gap-4 transition-all duration-500 ease-in-out ${isAnimating ? 'opacity-20 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
            <div className="h-[1px] w-6 bg-slate-200"></div>
            <div className="text-2xl md:text-3xl font-light text-slate-800 tracking-[0.3em] font-serif italic">{currentNumber}</div>
            <div className="h-[1px] w-6 bg-slate-200"></div>
          </div>
          <div className={`text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            Today: {todayClickCount}
          </div>
        </div>
        
        <div className={`text-4xl md:text-6xl lg:text-7xl font-serif italic text-slate-800 leading-[1.2] transition-all duration-700 ease-in-out ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          {currentSentence || '...'}
        </div>
      </div>

      {showManage && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-white/50 overflow-hidden">
            <div className="p-8 md:p-12 pb-6 flex justify-between items-center border-b border-slate-50">
              <div className="space-y-4">
                <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-slate-400">Content Studio</h2>
                <div className="flex gap-6">
                  <button onClick={() => setActiveTab('create')} className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'create' ? 'text-slate-900 border-slate-900' : 'text-slate-300 border-transparent hover:text-slate-500'}`}>Add Content</button>
                  <button onClick={() => setActiveTab('library')} className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'library' ? 'text-slate-900 border-slate-900' : 'text-slate-300 border-transparent hover:text-slate-500'}`}>Manage Library ({allSentences.length})</button>
                </div>
              </div>
              <button onClick={() => setShowManage(false)} className="px-8 py-3 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-100">Close</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12">
              {activeTab === 'create' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  <section className="space-y-8">
                    <div>
                      <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] mb-6">Create Categories</h3>
                      <form onSubmit={handleAddCategory} className="flex gap-2 mb-8">
                        <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="e.g. Resilience" className="flex-1 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm" />
                        <button type="submit" disabled={isSyncing} className="px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50">Add</button>
                      </form>
                      <div className="flex flex-wrap gap-2">
                        {allCategories.map(cat => (
                          <span key={cat.id} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">{cat.name}</span>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="space-y-8">
                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] mb-6">New Sentence</h3>
                    <form onSubmit={handleAddSentence} className="space-y-8">
                      <textarea value={newSentenceText} onChange={e => setNewSentenceText(e.target.value)} placeholder="Enter a sentence that appears on countdown zero..." rows={4} className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm font-serif italic" />
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tag Categories</p>
                        <div className="flex flex-wrap gap-2">
                          {allCategories.map(cat => (
                            <button key={cat.id} type="button" onClick={() => setSelectedCats(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])} className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${selectedCats.includes(cat.id) ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-50' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'}`}>
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button type="submit" disabled={isSyncing || !newSentenceText.trim()} className="w-full py-5 bg-blue-600 text-white rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 disabled:opacity-50">
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
                        className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm italic font-serif"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>

                    <div className="flex flex-col gap-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2">Browse by Category</p>
                      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-scrollbar">
                        <button 
                          onClick={() => setFilterCategoryId('all')}
                          className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${filterCategoryId === 'all' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
                        >
                          All Entries
                        </button>
                        {allCategories.map(cat => (
                          <button 
                            key={cat.id} 
                            onClick={() => setFilterCategoryId(cat.id)}
                            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${filterCategoryId === cat.id ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {filteredSentences.map(s => (
                      <div key={s.id} className={`p-8 rounded-3xl border transition-all ${editingId === s.id ? 'bg-blue-50/50 border-blue-200 ring-2 ring-blue-50' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm hover:shadow-md'}`}>
                        {editingId === s.id ? (
                          <div className="space-y-6">
                            <textarea 
                              value={editForm.text} 
                              onChange={e => setEditForm(prev => ({ ...prev, text: e.target.value }))}
                              className="w-full p-6 bg-white border border-blue-100 rounded-2xl text-sm font-serif italic focus:outline-none focus:ring-2 focus:ring-blue-200"
                              rows={3}
                            />
                            <div className="flex flex-wrap gap-2">
                              {allCategories.map(cat => (
                                <button 
                                  key={cat.id} 
                                  type="button" 
                                  onClick={() => setEditForm(prev => ({ ...prev, categoryIds: prev.categoryIds.includes(cat.id) ? prev.categoryIds.filter(id => id !== cat.id) : [...prev.categoryIds, cat.id] }))}
                                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${editForm.categoryIds.includes(cat.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                >
                                  {cat.name}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                              <button onClick={() => setEditingId(null)} className="px-6 py-2 bg-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-300">Cancel</button>
                              <button onClick={() => handleUpdateSentence(s.id)} disabled={isSyncing} className="px-6 py-2 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100">Save Changes</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col md:flex-row justify-between gap-6">
                            <div className="space-y-4">
                              <p className="text-lg font-serif italic text-slate-800 leading-relaxed">"{s.text}"</p>
                              <div className="flex flex-wrap gap-2">
                                {(s.categoryIds || []).map(catId => {
                                  const cat = allCategories.find(c => c.id === catId);
                                  return cat ? <span key={catId} className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-100">{cat.name}</span> : null;
                                })}
                              </div>
                            </div>
                            <div className="flex gap-2 items-center justify-end">
                              <button onClick={() => handleStartEdit(s)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              </button>
                              <button onClick={() => handleDeleteSentence(s.id)} className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all">
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

      {showStats && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-xl">
           <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-lg text-center space-y-8">
              <h2 className="text-xs font-black tracking-[0.4em] uppercase text-slate-400">Activity Logs</h2>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {statsService.getStatsForDate().map((stat, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                    <span className="text-xs font-serif italic text-slate-600 truncate mr-4">"{stat.sentence}"</span>
                    <span className="text-[10px] font-black text-slate-900 px-3 py-1 bg-white rounded-lg shadow-sm">{stat.count}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowStats(false)} className="w-full py-4 bg-slate-900 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest">Done</button>
           </div>
        </div>
      )}

      <div className={`absolute bottom-8 w-full flex flex-col items-center gap-6 transition-all duration-700 ${showStats || showManage ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        
        <div className="w-full max-w-xs md:max-w-md px-6 overflow-x-auto no-scrollbar flex items-center justify-center gap-4 py-2">
            <button 
              onClick={(e) => handleFocusChange(e, 'all')}
              className={`text-[8px] font-black uppercase tracking-[0.3em] transition-all px-3 py-1 rounded-full whitespace-nowrap ${sessionFocusId === 'all' ? 'text-blue-600 bg-blue-50' : 'text-slate-300 hover:text-slate-500'}`}
            >
              All Wisdom
            </button>
            {allCategories.map(cat => (
              <button 
                key={cat.id}
                onClick={(e) => handleFocusChange(e, cat.id)}
                className={`text-[8px] font-black uppercase tracking-[0.3em] transition-all px-3 py-1 rounded-full whitespace-nowrap ${sessionFocusId === cat.id ? 'text-blue-600 bg-blue-50' : 'text-slate-300 hover:text-slate-500'}`}
              >
                {cat.name}
              </button>
            ))}
        </div>

        <div className="flex gap-10 items-center">
          <button onClick={(e) => { e.stopPropagation(); setShowStats(true); }} className="text-slate-300 text-[10px] font-black tracking-[0.4em] uppercase hover:text-slate-900 transition-colors">Logs</button>
          
          <div className="flex flex-col items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); setShowManage(true); }} className="group p-3 text-slate-300 hover:text-slate-900 transition-all rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121(0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button 
              onClick={toggleMode} 
              className="text-[8px] font-black uppercase tracking-widest text-slate-300 hover:text-blue-500 transition-colors"
            >
              {counterMode === 'down' ? 'Descend' : 'Ascend'}
            </button>
          </div>

          <div className={`text-slate-300 text-[10px] font-black tracking-[0.4em] uppercase transition-all ${isSyncing ? 'opacity-100 text-blue-400 animate-pulse' : 'opacity-40'}`}>
            {isSyncing ? 'Sync' : 'Live'}
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
           {[...Array(randomLimit)].map((_, i) => (
             <div 
                key={i} 
                className={`h-[2px] rounded-full transition-all duration-700 ease-out 
                  ${counterMode === 'down' 
                    ? (i < currentNumber ? 'bg-slate-400 w-5' : 'bg-slate-200 w-1.5') 
                    : (i >= currentNumber ? 'bg-slate-200 w-1.5' : 'bg-slate-400 w-5')
                  }`} 
             />
           ))}
        </div>
      </div>
    </div>
  );
};

export default App;
