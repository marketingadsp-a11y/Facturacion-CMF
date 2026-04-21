import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { GraduationCap, CheckCircle2, AlertCircle, Send, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AppSettings } from '../types';

const SECTIONS = [
  'Bienvenida',
  'Datos del Alumno',
  'Datos de los Padres',
  'Otros Datos',
  'Compromisos'
];

export default function EnrollmentForm() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    });
    return unsub;
  }, []);

  const [formData, setFormData] = useState({
    // Alumno
    studentLastName: '',
    studentMotherLastName: '',
    studentName: '',
    address: '',
    addressNo: '',
    neighborhood: '',
    zipCode: '',
    phone: '',
    grade: '',
    level: '',
    birthPlaceCity: '',
    birthPlaceState: '',
    birthDate: '',
    age: '',
    gender: 'Hombre',
    previousSchool: '',
    curp: '',
    medicalConditions: '',
    medications: '',

    // Padre
    fatherName: '',
    fatherAge: '',
    fatherCivilStatus: '',
    fatherPhone: '',
    fatherEmail: '',
    fatherOccupation: '',

    // Madre
    motherName: '',
    motherAge: '',
    motherCivilStatus: '',
    motherPhone: '',
    motherEmail: '',
    motherOccupation: '',

    // Emergencia
    emergencyContactName: '',
    emergencyContactAddress: '',
    emergencyContactPhone: '',

    // Otros
    schoolChangeReason: '',
    whyChooseSchool: '',
    specialSupportRequired: false,
    specialSupportDescription: '',

    // Compromisos
    commitments: {
      participate: false,
      discipline: false,
      conferences: false,
      payments: false,
      timelyPayments: false,
      workTogether: false
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCommitmentChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      commitments: {
        ...prev.commitments,
        [name as any]: !((prev.commitments as any)[name])
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate commitments
    const allChecked = Object.values(formData.commitments).every(v => v === true);
    if (!allChecked) {
      setError('Por favor, acepta todos los compromisos para continuar.');
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'enrollments'), {
        ...formData,
        status: 'Pendiente',
        folio: Math.floor(1000 + Math.random() * 9000).toString(),
        createdAt: serverTimestamp()
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting enrollment:", err);
      setError('Hubo un error al enviar tu solicitud. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">¡Solicitud Enviada!</h1>
          <p className="text-slate-600 mb-6">
            Tu solicitud de inscripción ha sido recibida correctamente. El personal administrativo se pondrá en contacto contigo pronto.
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Tu Folio de Seguimiento</p>
            <p className="text-3xl font-black text-blue-600 tracking-widest">{formData.phone.slice(-4) || '2025'}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
          >
            Nueva Solicitud
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 bg-white text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100/50 border border-slate-100 overflow-hidden relative">
              {settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt="Logo" 
                  className="w-full h-full object-contain p-2"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-blue-600 flex items-center justify-center">
                  <GraduationCap size={44} />
                </div>
              )}
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{settings?.schoolName || 'COLEGIO MÉXICO FRANCISCANO'}</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Solicitud de Inscripción en Línea</p>
          <div className="inline-block mt-4 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-wider border border-blue-100">
            Ciclo Escolar 2025-2026
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-10 px-4">
          <div className="flex justify-between items-center mb-2">
            {SECTIONS.map((s, i) => (
              <div 
                key={s} 
                className={cn(
                  "hidden md:block text-[10px] font-black uppercase tracking-tighter transition-colors",
                  step === i ? "text-blue-600" : "text-slate-400"
                )}
              >
                {s}
              </div>
            ))}
            <div className="md:hidden text-[10px] font-black uppercase tracking-tighter text-blue-600">
              Paso {step + 1} de {SECTIONS.length}: {SECTIONS[step]}
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / SECTIONS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-8 md:p-12">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div 
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="prose prose-slate max-w-none">
                    <h2 className="text-xl font-bold text-slate-900">Bienvenido al proceso de inscripción</h2>
                    <p className="text-slate-600 leading-relaxed">
                      La Institución se compromete a impartir la educación básica, acorde a los planes y programas de la Secretaría de Educación Pública. 
                      Se imparte una educación integral con base en los valores y principios cristianos, fundamentada en nuestra Misión y Visión.
                    </p>
                    <p className="text-slate-600 leading-relaxed font-bold">
                      Es importante que la información que proporcione sea verídica, ya que ésta servirá para conocer a alguno de los aspirantes que desea ingresar a esta Institución.
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Este formulario tomará aproximadamente 10 minutos. Asegúrate de tener a la mano datos como CURP y domicilio completo.
                    </p>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <h2 className="text-xl font-extrabold text-slate-900 border-l-4 border-blue-600 pl-4">Datos del Alumno</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormInput label="Apellido Paterno" name="studentLastName" value={formData.studentLastName} onChange={handleChange} required />
                    <FormInput label="Apellido Materno" name="studentMotherLastName" value={formData.studentMotherLastName} onChange={handleChange} required />
                    <FormInput label="Nombre(s)" name="studentName" value={formData.studentName} onChange={handleChange} required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-2">
                      <FormInput label="Calle" name="address" value={formData.address} onChange={handleChange} required />
                    </div>
                    <FormInput label="No." name="addressNo" value={formData.addressNo} onChange={handleChange} required />
                    <FormInput label="Colonia" name="neighborhood" value={formData.neighborhood} onChange={handleChange} required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormInput label="C.P." name="zipCode" value={formData.zipCode} onChange={handleChange} required />
                    <FormInput label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} required />
                    <FormInput label="CURP" name="curp" value={formData.curp} onChange={handleChange} required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Grado al que se inscribe</label>
                      <select name="grade" value={formData.grade} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold">
                        <option value="">Selecciona grado</option>
                        {(settings?.academicGrades || ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto']).map(grade => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nivel</label>
                      <select name="level" value={formData.level} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold">
                        <option value="">Selecciona nivel</option>
                        {(settings?.academicLevels || ['Preescolar', 'Primaria', 'Secundaria']).map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormInput label="Ciudad Nacimiento" name="birthPlaceCity" value={formData.birthPlaceCity} onChange={handleChange} />
                    <FormInput label="Estado Nacimiento" name="birthPlaceState" value={formData.birthPlaceState} onChange={handleChange} />
                    <FormInput label="Fecha Nacimiento" name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormInput label="Edad" name="age" type="number" value={formData.age} onChange={handleChange} required />
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Sexo</label>
                      <div className="flex gap-4">
                        {['Hombre', 'Mujer'].map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setFormData({...formData, gender: g as 'Hombre' | 'Mujer'})}
                            className={cn(
                              "flex-1 py-3 rounded-xl text-xs font-bold border transition-all",
                              formData.gender === g ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"
                            )}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <FormInput label="Escuela Procedencia" name="previousSchool" value={formData.previousSchool} onChange={handleChange} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput label="¿Padece alguna enfermedad?" name="medicalConditions" value={formData.medicalConditions} onChange={handleChange} placeholder="No / Mencionar" />
                    <FormInput label="¿Qué medicamentos suministran?" name="medications" value={formData.medications} onChange={handleChange} placeholder="Ninguno / Mencionar" />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div className="space-y-6">
                    <h2 className="text-xl font-extrabold text-slate-900 border-l-4 border-emerald-600 pl-4">Datos del Padre / Tutor</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <FormInput label="Nombre del padre y/o tutor" name="fatherName" value={formData.fatherName} onChange={handleChange} required />
                      </div>
                      <FormInput label="Edad" name="fatherAge" type="number" value={formData.fatherAge} onChange={handleChange} />
                      <FormInput label="Estado Civil" name="fatherCivilStatus" value={formData.fatherCivilStatus} onChange={handleChange} />
                      <FormInput label="Teléfono Particular / Celular" name="fatherPhone" value={formData.fatherPhone} onChange={handleChange} />
                      <FormInput label="Correo Electrónico" name="fatherEmail" type="email" value={formData.fatherEmail} onChange={handleChange} />
                      <div className="md:col-span-2">
                        <FormInput label="Ocupación" name="fatherOccupation" value={formData.fatherOccupation} onChange={handleChange} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h2 className="text-xl font-extrabold text-slate-900 border-l-4 border-pink-600 pl-4">Datos de la Madre / Tutora</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <FormInput label="Nombre de la madre y/o tutora" name="motherName" value={formData.motherName} onChange={handleChange} required />
                      </div>
                      <FormInput label="Edad" name="motherAge" type="number" value={formData.motherAge} onChange={handleChange} />
                      <FormInput label="Estado Civil" name="motherCivilStatus" value={formData.motherCivilStatus} onChange={handleChange} />
                      <FormInput label="Teléfono Particular / Celular" name="motherPhone" value={formData.motherPhone} onChange={handleChange} />
                      <FormInput label="Correo Electrónico" name="motherEmail" type="email" value={formData.motherEmail} onChange={handleChange} />
                      <div className="md:col-span-2">
                        <FormInput label="Ocupación" name="motherOccupation" value={formData.motherOccupation} onChange={handleChange} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h2 className="text-xl font-extrabold text-slate-900 border-l-4 border-orange-600 pl-4">En Caso de Emergencia</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <FormInput label="Avisar a (Nombre)" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} required />
                      </div>
                      <FormInput label="Con Domicilio en" name="emergencyContactAddress" value={formData.emergencyContactAddress} onChange={handleChange} />
                      <FormInput label="Teléfono" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} required />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <h2 className="text-xl font-extrabold text-slate-900 border-l-4 border-indigo-600 pl-4">Otros Datos</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Si es cambio de escuela mencione el motivo</label>
                      <textarea
                        name="schoolChangeReason"
                        value={formData.schoolChangeReason}
                        onChange={handleChange}
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        placeholder="..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Razones por las que elige el Colegio México Franciscano</label>
                      <textarea
                        name="whyChooseSchool"
                        value={formData.whyChooseSchool}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        placeholder="Valores, nivel académico, etc."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">¿Requiere apoyo especial?</label>
                        <div className="flex gap-4">
                          {[true, false].map(v => (
                            <button
                              key={v ? 'Si' : 'No'}
                              type="button"
                              onClick={() => setFormData({...formData, specialSupportRequired: v})}
                              className={cn(
                                "flex-1 py-3 rounded-xl text-xs font-bold border transition-all",
                                formData.specialSupportRequired === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                              )}
                            >
                              {v ? 'Sí' : 'No'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <FormInput label="¿Cuál?" name="specialSupportDescription" value={formData.specialSupportDescription} onChange={handleChange} disabled={!formData.specialSupportRequired} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <h2 className="text-xl font-extrabold text-slate-900 border-l-4 border-amber-600 pl-4">Compromisos</h2>
                  
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 space-y-6">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-4 underline">Se compromete a:</p>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <CommitmentItem 
                        label="Participar y cooperar con la Institución en el proceso Enseñanza - Aprendizaje." 
                        checked={formData.commitments.participate}
                        onChange={() => handleCommitmentChange('participate')}
                      />
                      <CommitmentItem 
                        label="Apoyar a la Institución en la disciplina." 
                        checked={formData.commitments.discipline}
                        onChange={() => handleCommitmentChange('discipline')}
                      />
                      <CommitmentItem 
                        label="Asistir puntualmente a las conferencias formativas y entrega de calificaciones." 
                        checked={formData.commitments.conferences}
                        onChange={() => handleCommitmentChange('conferences')}
                      />
                      <CommitmentItem 
                        label="Realizar sus pagos en los primeros diez días de cada mes." 
                        checked={formData.commitments.payments}
                        onChange={() => handleCommitmentChange('payments')}
                      />
                      <CommitmentItem 
                        label="Hacer sus pagos oportunamente. El incumplimiento libera a la Institución de seguir prestando servicios." 
                        checked={formData.commitments.timelyPayments}
                        onChange={() => handleCommitmentChange('timelyPayments')}
                      />
                      <CommitmentItem 
                        label="Estar dispuesto a trabajar en conjunto con la Institución para ayudar al alumno." 
                        checked={formData.commitments.workTogether}
                        onChange={() => handleCommitmentChange('workTogether')}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                       <AlertCircle size={20} />
                       {error}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(prev => Math.max(0, prev - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-0 transition-all"
            >
              <ArrowLeft size={18} /> Anterior
            </button>

            {step < SECTIONS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => Math.min(SECTIONS.length - 1, prev + 1))}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                Siguiente <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Enviando...' : (
                  <>
                    <Send size={18} /> Enviar Solicitud
                  </>
                )}
              </button>
            )}
          </div>
        </form>

        <p className="mt-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          &copy; 2025 Colegio México Franciscano. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

function FormInput({ label, name, value, onChange, type = 'text', required = false, placeholder = '', disabled = false }: { 
  label: string; name: string; value: any; onChange: any; type?: string; required?: boolean; placeholder?: string; disabled?: boolean 
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        required={required}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold placeholder:text-slate-300",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
    </div>
  );
}

function CommitmentItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-100 cursor-pointer hover:border-blue-200 transition-all">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={onChange} 
        className="w-5 h-5 mt-0.5 text-blue-600 rounded-lg focus:ring-blue-500" 
      />
      <span className="text-xs font-bold text-slate-700 leading-relaxed">{label}</span>
    </label>
  );
}
