
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

  const [newCategory, setNewCategory] = useState('');
  const [newSentenceText, setNewSentenceText] = useState('');
  const [selectedCats, setSelectedCats] = useState<(string | number)[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const checkConnection = useCallback(async () => {
    setIsSyncing(true);
    const status = await supabaseService.testConnection();
    setDbStatus({ connected: status.success, message: status.message });
    if (status.success) {
      await supabaseService.syncData();
      setAllCategories(supabaseService.getCategories());
    }
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    statsService.pruneStats();
    checkConnection().then(() => {
      setCurrentNumber(Math.floor(Math.random() * 7) + 1);
      setCurrentSentence(supabaseService.getRandomSentence());
    });
  }, [checkConnection]);

  useEffect(() => {
    if (showManage) checkConnection();
  }, [showManage, checkConnection]);

  const handleInteraction = useCallback(() => {
    if (isAnimating || isSyncing || showStats || showManage) return;
    if (currentSentence) statsService.recordClick(currentSentence);
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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    setIsSyncing(true);
    const { error } = await supabaseService.addCategory(name);
    if (error) alert(`Error: ${error}`);
    else {
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
    if (error) alert(`Note: ${error}`);
    if (success) {
      setNewSentenceText('');
      setSelectedCats([]);
      await supabaseService.syncData();
      alert("Entry saved successfully.");
    }
    setIsSyncing(false);
  };

  const debugInfo = useMemo(() => supabaseService.getDebugInfo(), [showManage]);

  return (
    <div onClick={handleInteraction} className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer select-none bg-slate-50 overflow-hidden">
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
          {currentSentence || '...'}
        </div>
      </div>

      {showManage && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-xl">
          <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative border border-white/50">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-sm font-bold tracking-[0.3em] uppercase text-slate-400">Content Studio</h2>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`}></div>
                    <span className={`text-[10px] uppercase font-black tracking-widest ${dbStatus.connected ? 'text-green-600' : 'text-red-500'}`}>
                      {dbStatus.connected ? 'Cloud Connected' : 'Cloud Disconnected'}
                    </span>
                  </div>
                  {!dbStatus.connected && (
                    <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-100 max-w-md">
                      <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest mb-2">Debug Diagnostic:</p>
                      <div className="space-y-1 font-mono text-[9px] text-red-500">
                        <p>Found URL: {debugInfo.urlFound ? 'YES' : 'NO'}</p>
                        <p>Found Key: {debugInfo.keyFound ? 'YES' : 'NO'}</p>
                        <p className="opacity-60 break-all">URL Detected: {debugInfo.maskedUrl}</p>
                        <p className="mt-3 leading-relaxed">Tip: Environment variables often require a "Redeploy" or "Restart" of the preview environment to take effect.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={checkConnection} disabled={isSyncing} className="px-4 py-2 bg-slate-50 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50">
                  {isSyncing ? 'Syncing...' : 'Force Refresh'}
                </button>
                <button onClick={() => setShowManage(false)} className="px-6 py-2 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">Close</button>
              </div>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 ${!dbStatus.connected ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
              <section className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-4">Categories</h3>
                  <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                    <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="e.g. Focus" className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm" />
                    <button type="submit" disabled={isSyncing || !dbStatus.connected} className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800">Add</button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map(cat => (
                      <span key={cat.id} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">{cat.name}</span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-4">New Entry</h3>
                <form onSubmit={handleAddSentence} className="space-y-6">
                  <textarea value={newSentenceText} onChange={e => setNewSentenceText(e.target.value)} placeholder="Type words of wisdom..." rows={3} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm font-serif italic" />
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tag Entry</p>
                    <div className="flex flex-wrap gap-2">
                      {allCategories.map(cat => (
                        <button key={cat.id} type="button" onClick={() => setSelectedCats(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${selectedCats.includes(cat.id) ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'}`}>
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="submit" disabled={isSyncing || !dbStatus.connected || !newSentenceText.trim()} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50">
                    {isSyncing ? 'Synchronizing...' : 'Save to Cloud'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Footer Interface */}
      <div className={`absolute bottom-12 flex flex-col items-center gap-6 transition-all duration-700 ${showStats || showManage ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <div className="flex gap-10 items-center">
          <button onClick={(e) => { e.stopPropagation(); setShowStats(true); }} className="text-slate-300 text-[10px] font-black tracking-[0.4em] uppercase hover:text-slate-900">Logs</button>
          <button onClick={(e) => { e.stopPropagation(); setShowManage(true); }} className="group p-3 text-slate-300 hover:text-slate-900 transition-all rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <div className={`text-slate-300 text-[10px] font-black tracking-[0.4em] uppercase transition-all ${isSyncing ? 'opacity-100 text-blue-400 animate-pulse' : 'opacity-40'}`}>
            {isSyncing ? 'Sync' : 'Live'}
          </div>
        </div>
        <div className="flex gap-2 items-center">
           {[...Array(7)].map((_, i) => (
             <div key={i} className={`h-[2px] rounded-full transition-all duration-700 ease-out ${i < currentNumber ? 'bg-slate-400 w-5' : 'bg-slate-200 w-1.5'}`} />
           ))}
        </div>
      </div>
    </div>
  );
};

export default App;
