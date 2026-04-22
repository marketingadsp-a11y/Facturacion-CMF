import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AppSettings } from '../types';
import VisitorRegistrationForm from '../components/VisitorRegistrationForm';
import { GraduationCap, Maximize } from 'lucide-react';
import { motion } from 'motion/react';

export default function PublicVisitRegistration() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    });
    return () => unsub();
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8FAFC] flex flex-col font-sans selection:bg-indigo-100">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-50/60 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-50/60 blur-[120px]" />
      </div>

      {/* Fullscreen toggle button */}
      <button 
        onClick={toggleFullScreen}
        className="absolute top-6 right-6 z-50 p-4 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all"
        title="Pantalla Completa"
      >
        <Maximize size={24} />
      </button>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl max-h-full flex flex-col bg-white rounded-[40px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden"
        >
          {/* Main content area (scrollable if needed, but optimized to fit) */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 sm:p-14">
            
            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-[2rem] flex items-center justify-center overflow-hidden border border-slate-100 shadow-md mb-6 shrink-0">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-[85%] h-[85%] object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="bg-indigo-600 w-full h-full flex items-center justify-center text-white">
                    <GraduationCap size={48} />
                  </div>
                )}
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">Bienvenido</h2>
            </div>

            <VisitorRegistrationForm isPublic />
          </div>

          {/* Footer inside the card */}
          <div className="bg-slate-50/80 px-8 py-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               {settings?.schoolName || 'Colegio México Franciscano'} © {new Date().getFullYear()}
             </p>
             <div className="flex items-center gap-1.5 grayscale opacity-50">
               {settings?.developerAttribution ? (
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                   {settings.developerAttribution}
                 </p>
               ) : (
                 <>
                   <span className="text-[9px] font-black text-slate-400 uppercase">Powered by</span>
                   <div className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-black tracking-tight">Antigravity</div>
                 </>
               )}
             </div>
          </div>
        </motion.div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        input, textarea {
          -webkit-appearance: none;
          font-size: 16px !important; /* Prevent iOS zoom */
        }
        /* Custom scrollbar for form area to look clean on iPad */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent; 
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      ` }} />
    </div>
  );
}
