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
import { QRCodeSVG } from 'qrcode.react';

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
      const timeoutSeconds = settings?.visitorSuccessTimeout || 5;
      setTimeout(() => {
        if (onSuccess) onSuccess();
        // Reset if public
        if (isPublic) {
          setIsSuccess(false);
          setStep(1);
          setFormData({ name: '', area: '', reason: '', otherReason: '' });
        }
      }, timeoutSeconds * 1000);
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
        className="flex flex-col items-center justify-center p-6 sm:p-12 text-center"
      >
        <div className="flex flex-col md:flex-row items-center justify-center gap-10 w-full">
          <div className="flex flex-col items-center flex-1 space-y-6">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-xl shadow-emerald-50">
              <CheckCircle2 size={48} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {settings?.receptionSuccessTitle || '¡Registro Exitoso!'}
              </h2>
              <p className="text-slate-500 font-medium mt-4 max-w-sm mx-auto text-lg leading-relaxed">
                {settings?.receptionSuccessMessage || 'Hemos recibido tu registro. Por favor, toma asiento, en un momento te atenderemos.'}
              </p>
            </div>
          </div>

          {settings?.visitorQrCodeContent && (
            <div className="bg-white p-6 rounded-3xl border-4 border-slate-50 shadow-xl flex flex-col items-center gap-4 animate-in fade-in zoom-in slide-in-from-right-4 duration-700">
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                <QRCodeSVG 
                  value={settings.visitorQrCodeContent} 
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  {settings.visitorQrCodeLabel || 'Escanea para'}
                </p>
                <p className="text-xs font-black text-slate-900 uppercase tracking-widest truncate max-w-[200px]">
                  {settings.visitorQrCodeDescription || 'Contenido exclusivo'}
                </p>
              </div>
            </div>
          )}
        </div>

        {isPublic && (
          <div className="pt-12 w-full max-w-xs">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: settings?.visitorSuccessTimeout || 5, ease: "linear" }}
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
            className="space-y-8 py-4"
          >
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">¿Cuál es su nombre?</h3>
              <p className="text-slate-400 font-medium text-base italic lowercase">— ingrese su nombre completo —</p>
            </div>
            
            <div className="space-y-6">
              <input
                required
                autoFocus
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                onKeyDown={(e) => { if(e.key === 'Enter' && formData.name) nextStep(); }}
                placeholder="Escribe aquí..."
                className="w-full bg-white border-b-4 border-slate-100 pb-4 text-4xl font-black text-center focus:border-indigo-600 outline-none transition-all placeholder:text-slate-100"
              />
              
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!formData.name}
                  className={cn(
                    "px-12 py-5 rounded-[2rem] font-black text-base uppercase tracking-widest transition-all flex items-center gap-4 shadow-2xl",
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
            className="space-y-6 py-4"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center text-emerald-600 mx-auto shadow-sm border border-emerald-100/50">
                <MapPin size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">¿A qué área se dirige?</h3>
              <p className="text-slate-400 font-medium text-base italic lowercase">— seleccione el departamento de su interés —</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {areas.map(area => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setFormData({...formData, area})}
                  className={cn(
                    "px-6 py-4 text-left rounded-[1.5rem] border-4 transition-all duration-300 relative group overflow-hidden",
                    formData.area === area 
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-lg shadow-emerald-50 scale-105" 
                      : "border-slate-50 bg-slate-50/50 text-slate-400 hover:border-slate-100 hover:bg-white"
                  )}
                >
                  <span className="text-lg font-black uppercase tracking-tight relative z-10">{area}</span>
                  {formData.area === area && (
                    <motion.div layoutId="area-active" className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600">
                       <CheckCircle2 size={24} strokeWidth={3} />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-center items-center gap-6 pt-6">
              <button
                type="button"
                onClick={prevStep}
                className="p-5 text-slate-300 hover:text-slate-600 transition-colors rounded-full"
              >
                <ArrowLeft size={28} />
              </button>
              <button
                type="button"
                onClick={nextStep}
                disabled={!formData.area}
                className={cn(
                  "px-12 py-5 rounded-[2rem] font-black text-base uppercase tracking-widest transition-all flex items-center gap-4 shadow-2xl",
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
            className="space-y-6 py-4"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-amber-50 rounded-[1.5rem] flex items-center justify-center text-amber-600 mx-auto shadow-sm border border-amber-100/50">
                <MessageSquare size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">¿Cuál es el motivo de su visita?</h3>
              <p className="text-slate-400 font-medium text-base italic lowercase">— cuéntenos brevemente la razón de su llegada —</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex flex-wrap justify-center gap-3">
                {reasons.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFormData({...formData, reason})}
                    className={cn(
                      "px-6 py-4 text-sm font-black uppercase rounded-2xl border-4 transition-all",
                      formData.reason === reason 
                        ? "bg-slate-900 text-white border-slate-900 shadow-xl scale-110" 
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
                    className="space-y-2"
                  >
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center italic">Escriba el motivo específico</label>
                     <input
                        autoFocus
                        value={formData.otherReason}
                        onChange={(e) => setFormData({...formData, otherReason: e.target.value})}
                        placeholder="Escriba aquí..."
                        className="w-full bg-slate-50 border-4 border-slate-100 rounded-[2rem] px-6 py-4 text-xl font-black focus:border-amber-500 focus:bg-white outline-none transition-all placeholder:text-slate-200 text-center"
                     />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-center items-center gap-6 pt-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="p-5 text-slate-300 hover:text-slate-600 transition-colors rounded-full"
                >
                  <ArrowLeft size={28} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting || !formData.reason || (formData.reason === 'Otro' && !formData.otherReason)}
                  className={cn(
                    "px-14 py-6 rounded-[2.5rem] font-black text-lg uppercase tracking-[0.2em] transition-all flex items-center gap-4 shadow-2xl active:scale-95",
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
