import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AppSettings } from '../types';
import { 
  User, 
  MapPin, 
  MessageSquare, 
  CheckCircle2, 
  X,
  ChevronRight,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface VisitorRegistrationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isPublic?: boolean;
}

export default function VisitorRegistrationForm({ onSuccess, onCancel, isPublic = false }: VisitorRegistrationFormProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    area: '',
    reason: '',
    otherReason: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        setSettings(data);
        
        // No defaults anymore since it's step by step
      }
    });
    return unsub;
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate final values
    const finalReason = formData.reason === 'Otro' ? formData.otherReason : formData.reason;
    if (!formData.name || !formData.area || !finalReason) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'reception_visits'), {
        name: formData.name,
        area: formData.area,
        reason: finalReason,
        checkInTime: serverTimestamp(),
        status: 'Pendiente'
      });
      setIsSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        // Reset if public
        if (isPublic) {
          setIsSuccess(false);
          setStep(1);
          setFormData({ name: '', area: '', reason: '', otherReason: '' });
        }
      }, 3000);
    } catch (error) {
      console.error("Error al registrar visita:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const areas = settings?.receptionAreas || ['Dirección', 'Administración', 'Control Escolar'];
  const reasons = settings?.receptionReasons || ['Información', 'Inscripción', 'Pago', 'Otro'];

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-12 text-center space-y-6"
      >
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-xl shadow-emerald-50">
          <CheckCircle2 size={48} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            {settings?.receptionSuccessTitle || '¡Registro Exitoso!'}
          </h2>
          <p className="text-slate-500 font-medium mt-4 max-w-sm mx-auto text-lg leading-relaxed">
            {settings?.receptionSuccessMessage || 'Hemos recibido tu registro. Por favor, toma asiento, en un momento te atenderemos.'}
          </p>
        </div>
        {isPublic && (
          <div className="pt-8 w-full max-w-xs">
            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="bg-emerald-500 h-full"
              />
            </div>
            <p className="text-[10px] font-black text-slate-300 uppercase mt-4 tracking-widest">Reiniciando formulario...</p>
          </div>
        )}
      </motion.div>
    );
  }

  const variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className={cn("w-full transition-all duration-500", isPublic ? "max-w-4xl mx-auto" : "")}>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1" 
            variants={variants} 
            initial="initial" 
            animate="animate" 
            exit="exit"
            className="space-y-12 py-8"
          >
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 mx-auto shadow-sm border border-indigo-100/50">
                <User size={36} strokeWidth={2.5} />
              </div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Bienvenido, ¿cuál es su nombre?</h3>
              <p className="text-slate-400 font-medium text-lg italic lowercase">— por favor, ingrese su nombre completo —</p>
            </div>
            
            <div className="space-y-8">
              <input
                required
                autoFocus
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                onKeyDown={(e) => { if(e.key === 'Enter' && formData.name) nextStep(); }}
                placeholder="Escribe aquí..."
                className="w-full bg-white border-b-4 border-slate-100 pb-6 text-5xl font-black text-center focus:border-indigo-600 outline-none transition-all placeholder:text-slate-100"
              />
              
              <div className="flex justify-center pt-8">
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!formData.name}
                  className={cn(
                    "px-16 py-6 rounded-[2rem] font-black text-lg uppercase tracking-widest transition-all flex items-center gap-4 shadow-2xl",
                    formData.name 
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 scale-105" 
                      : "bg-slate-100 text-slate-300 cursor-not-allowed opacity-50"
                  )}
                >
                  Siguiente
                  <ArrowRight size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2" 
            variants={variants} 
            initial="initial" 
            animate="animate" 
            exit="exit"
            className="space-y-12 py-8"
          >
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-600 mx-auto shadow-sm border border-emerald-100/50">
                <MapPin size={36} strokeWidth={2.5} />
              </div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">¿A qué área se dirige?</h3>
              <p className="text-slate-400 font-medium text-lg italic lowercase">— seleccione el departamento de su interés —</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {areas.map(area => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setFormData({...formData, area})}
                  className={cn(
                    "px-8 py-6 text-left rounded-3xl border-4 transition-all duration-300 relative group overflow-hidden",
                    formData.area === area 
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xl shadow-emerald-50 scale-105" 
                      : "border-slate-50 bg-slate-50/50 text-slate-400 hover:border-slate-100 hover:bg-white"
                  )}
                >
                  <span className="text-xl font-black uppercase tracking-tight relative z-10">{area}</span>
                  {formData.area === area && (
                    <motion.div layoutId="area-active" className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-600">
                       <CheckCircle2 size={24} strokeWidth={3} />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-center items-center gap-6 pt-12">
              <button
                type="button"
                onClick={prevStep}
                className="p-6 text-slate-300 hover:text-slate-600 transition-colors rounded-full"
              >
                <ArrowLeft size={32} />
              </button>
              <button
                type="button"
                onClick={nextStep}
                disabled={!formData.area}
                className={cn(
                  "px-16 py-6 rounded-[2rem] font-black text-lg uppercase tracking-widest transition-all flex items-center gap-4 shadow-2xl",
                  formData.area 
                    ? "bg-slate-900 text-white hover:bg-black shadow-slate-200 scale-105" 
                    : "bg-slate-100 text-slate-300 cursor-not-allowed opacity-50"
                )}
              >
                Siguiente
                <ArrowRight size={24} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3" 
            variants={variants} 
            initial="initial" 
            animate="animate" 
            exit="exit"
            className="space-y-10 py-8"
          >
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center text-amber-600 mx-auto shadow-sm border border-amber-100/50">
                <MessageSquare size={36} strokeWidth={2.5} />
              </div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">¿Cuál es el motivo de su visita?</h3>
              <p className="text-slate-400 font-medium text-lg italic lowercase">— cuéntenos brevemente la razón de su llegada —</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex flex-wrap justify-center gap-3">
                {reasons.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFormData({...formData, reason})}
                    className={cn(
                      "px-8 py-5 text-sm font-black uppercase rounded-2xl border-4 transition-all",
                      formData.reason === reason 
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xl scale-110" 
                        : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {formData.reason === 'Otro' && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center italic">Escriba el motivo específico</label>
                     <input
                        autoFocus
                        value={formData.otherReason}
                        onChange={(e) => setFormData({...formData, otherReason: e.target.value})}
                        placeholder="Escriba aquí..."
                        className="w-full bg-slate-50 border-4 border-slate-100 rounded-[2rem] px-8 py-6 text-2xl font-black focus:border-amber-500 focus:bg-white outline-none transition-all placeholder:text-slate-200 text-center"
                     />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-center items-center gap-8 pt-6">
                <button
                  type="button"
                  onClick={prevStep}
                  className="p-6 text-slate-300 hover:text-slate-600 transition-colors rounded-full"
                >
                  <ArrowLeft size={32} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting || !formData.reason || (formData.reason === 'Otro' && !formData.otherReason)}
                  className={cn(
                    "px-20 py-7 rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] transition-all flex items-center gap-4 shadow-2xl active:scale-95",
                    (formData.reason && (formData.reason !== 'Otro' || formData.otherReason))
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 scale-105" 
                      : "bg-slate-100 text-slate-300 cursor-not-allowed opacity-50 shadow-none"
                  )}
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Finalizar Registro
                      <ArrowRight size={24} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Footer Exit (Only for non-public modal) */}
      {!isPublic && onCancel && step === 1 && (
        <div className="mt-8 pt-8 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 transition-colors flex items-center gap-2"
            >
              <X size={14} /> Salir del registro
            </button>
        </div>
      )}
    </div>
  );
}
