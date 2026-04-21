import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AppSettings } from '../types';
import VisitorRegistrationForm from '../components/VisitorRegistrationForm';
import { GraduationCap, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export default function PublicVisitRegistration() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-indigo-100 italic-none">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-50/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-50/50 blur-[120px]" />
      </div>

      <header className="relative z-10 px-8 py-8 border-b border-slate-100 bg-white/70 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm shrink-0">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
            ) : (
              <div className="bg-indigo-600 w-full h-full flex items-center justify-center text-white">
                <GraduationCap size={32} />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              {settings?.schoolName || 'Registro de Visita'}
            </h1>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Módulo de Recepción Digital
            </p>
          </div>
        </div>

        <div className="text-right flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
          <Clock size={20} className="text-slate-400" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hora Actual</span>
            <span className="text-xl font-black text-slate-700 tracking-tight leading-none">
              {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl bg-white rounded-[48px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden"
        >
          <div className="p-12 md:p-16">
            <div className="text-center mb-16 underline-offset-8">
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Bienvenido</h2>
              <p className="text-lg font-medium text-slate-400 mt-4">
                Por favor, complete este breve formulario para registrar su ingreso a la institución.
              </p>
            </div>

            <VisitorRegistrationForm isPublic />
          </div>

          <div className="bg-slate-50/80 px-16 py-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               Colegio México Franciscano © {new Date().getFullYear()}
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

      {/* iPad 9th Gen Optimization Notice (Invisible) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (width: 810px) and (height: 1080px) {
          /* Targeted iPad 9th Gen optimization */
          main { p: 12 !important; }
          h2 { font-size: 4rem !important; }
        }
        input, textarea {
          -webkit-appearance: none;
          font-size: 16px !important; /* Prevent iOS zoom */
        }
      ` }} />
    </div>
  );
}
