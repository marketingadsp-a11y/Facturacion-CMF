import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AppSettings } from '../types';
import { Home, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function NotFound() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as AppSettings);
      }
    });
    return () => unsub();
  }, []);

  const backgroundUrl = settings?.notFoundBackgroundUrl;
  const errorText = settings?.notFoundText || '¡Ups! La página que buscas no existe.';

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-slate-900 overflow-hidden relative"
      style={backgroundUrl ? { 
        backgroundImage: `url(${backgroundUrl})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center' 
      } : {}}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center px-6"
      >
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/10 mb-8 border border-white/20 overflow-hidden shadow-2xl backdrop-blur-sm">
          {settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Logo" 
              className="w-16 h-16 object-contain" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <AlertCircle size={48} className="text-red-500" />
          )}
        </div>
        
        <h1 className="text-8xl font-black text-white mb-4 tracking-tighter drop-shadow-2xl">404</h1>
        
        <p className="text-xl md:text-2xl font-medium text-slate-200 mb-10 max-w-lg mx-auto leading-relaxed drop-shadow-md">
          {errorText}
        </p>

        <Link 
          to="/"
          className="inline-flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-black/20"
        >
          <Home size={20} />
          Volver al Inicio
        </Link>
      </motion.div>

      {/* Decorative accents */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
    </div>
  );
}
