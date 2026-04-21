import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, Timestamp, addDoc, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ReceptionVisit, Student, Payment, AppSettings, SchoolCycle } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Users, 
  UserPlus, 
  Clock, 
  Calendar, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  MessageSquare,
  History,
  Phone,
  User,
  MoreVertical,
  Plus,
  TrendingUp,
  BarChart3,
  Timer,
  ClipboardList,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, differenceInDays, startOfDay, endOfDay, isAfter, setDate, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { calculateStudentDebts } from '../lib/paymentUtils';

export default function Reception() {
  const { hasPermission } = usePermissions();
  const [visits, setVisits] = useState<ReceptionVisit[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'Visitante' as ReceptionVisit['type'],
    reason: 'Información' as ReceptionVisit['reason'],
    notes: ''
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const today = startOfDay(new Date());
    const q = query(
      collection(db, 'reception_visits'),
      where('checkInTime', '>=', Timestamp.fromDate(today)),
      orderBy('checkInTime', 'desc')
    );
    
    const unsubVisits = onSnapshot(q, (snap) => {
      setVisits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReceptionVisit)));
      setLoading(false);
    });

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    });

    const unsubCycles = onSnapshot(collection(db, 'cycles'), (snap) => {
      setCycles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCycle)));
    });

    return () => {
      unsubVisits();
      unsubStudents();
      unsubSettings();
      unsubCycles();
    };
  }, []);

  useEffect(() => {
    if (!settings?.currentCycleId) return;
    
    const qPayments = collection(db, 'payments');
    
    const unsubPayments = onSnapshot(qPayments, (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    return () => unsubPayments();
  }, [settings?.currentCycleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'reception_visits'), {
        ...formData,
        checkInTime: serverTimestamp(),
        status: 'Pendiente'
      });
      setIsModalOpen(false);
      setFormData({ name: '', type: 'Visitante', reason: 'Información', notes: '' });
    } catch (error) {
      console.error("Error al registrar visita:", error);
    }
  };

  const handleMarkAsAttended = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reception_visits', id), {
        status: 'Atendido',
        attendedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error al actualizar visita:", error);
    }
  };

  const stats = {
    attendedCount: visits.filter(v => v.status === 'Atendido').length,
    pendingToday: visits.filter(v => v.status === 'Pendiente').length,
    mostCommonReason: visits.length > 0 
      ? Object.entries(visits.reduce((acc, v) => ({ ...acc, [v.reason]: (acc[v.reason] || 0) + 1 }), {} as Record<string, number>))
          .sort((a, b) => b[1] - a[1])[0][0]
      : 'N/A',
    avgWaitTime: visits.filter(v => v.status === 'Atendido' && v.attendedAt).reduce((acc, v) => {
      const wait = v.attendedAt!.toMillis() - v.checkInTime.toMillis();
      return acc + wait;
    }, 0) / (visits.filter(v => v.status === 'Atendido' && v.attendedAt).length || 1)
  };

  const getDebtors = () => {
    if (!settings || !cycles.length) return [];
    
    const currentCycle = cycles.find(c => c.id === settings.currentCycleId);
    if (!currentCycle) return [];

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thresholdDay = settings.dueDay + 2;

    return students.map(student => {
      const debtStatus = calculateStudentDebts(student, payments, currentCycle, settings);
      
      if (!debtStatus.hasDebt) return null;

      // Grace period logic: Only show if they have debt from previous months 
      // OR if the current month debt is at least 2 days past due.
      const hasPastDebts = debtStatus.debts.some(d => {
        if (d.year < currentYear) return true;
        return d.year === currentYear && d.month < currentMonth;
      });

      const currentMonthDebt = debtStatus.debts.find(d => d.month === currentMonth && d.year === currentYear);
      const isPastGracePeriod = currentMonthDebt && currentDay >= thresholdDay;

      if (!hasPastDebts && !isPastGracePeriod) {
        return null;
      }

      // Calculate days late for the oldest debt
      const oldestDebt = [...debtStatus.debts].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })[0];
      
      const dueDate = setDate(new Date(oldestDebt.year, oldestDebt.month, 1), settings.dueDay);
      const daysLate = differenceInDays(now, dueDate);

      return {
        ...student,
        debtAmount: debtStatus.totalDebt,
        daysLate
      };
    }).filter((s): s is any => s !== null)
      .sort((a, b) => b.daysLate - a.daysLate);
  };

  const debtors = getDebtors();

  if (!hasPermission('reception', 'view')) {
    return <div className="p-8 text-center text-slate-500">No tienes permisos para ver este módulo.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Header Minimalista y Profesional */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 mb-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <ClipboardList size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Módulo Educativo</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Atención y Recepción</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Gestión de flujo de personas y control preventivo de adeudos.</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hora Local</p>
              <p className="text-lg font-bold text-slate-700 tracking-tight">
                {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl flex items-center gap-3 font-bold text-sm shadow-xl shadow-indigo-100 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
              <Plus size={20} />
              Nueva Visita
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-8 pb-12 space-y-8">
        {/* Estadísticas en Tarjetas Elegantes */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard 
            label="Total Visitas"
            value={visits.length}
            sub={`${stats.pendingToday} pendientes`}
            icon={<Users className="text-indigo-600" size={20} />}
          />
          <StatCard 
            label="Atenciones"
            value={stats.attendedCount}
            sub="Concluidas hoy"
            icon={<CheckCircle2 className="text-emerald-600" size={20} />}
          />
          <StatCard 
            label="Motivo Mayor"
            value={stats.mostCommonReason}
            sub="Tendencia hoy"
            icon={<BarChart3 className="text-blue-600" size={20} />}
          />
          <StatCard 
            label="Tiempo Espera"
            value={stats.avgWaitTime > 0 ? `${Math.round(stats.avgWaitTime / 60000)} min` : '0 min'}
            sub="Promedio actual"
            icon={<Timer className="text-amber-600" size={20} />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Listado de Visitas */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] flex items-center gap-2">
                <History size={16} className="text-indigo-600" />
                Registro de Visitas
              </h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En Vivo</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
              {visits.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Visitante</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Perfil</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Llegada</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visits.map((visit) => (
                        <tr key={visit.id} className={cn(
                          "group transition-colors hover:bg-slate-50/50",
                          visit.status === 'Atendido' ? "opacity-40" : ""
                        )}>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                {visit.name.charAt(0)}
                              </div>
                              <span className="text-sm font-bold text-slate-700">{visit.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={cn(
                              "text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-tight",
                              visit.type === 'Padre' ? "bg-blue-50 text-blue-600" :
                              visit.type === 'Alumno' ? "bg-amber-50 text-amber-600" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {visit.type}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-xs text-slate-500 font-medium">{visit.reason}</span>
                          </td>
                          <td className="px-6 py-5 text-xs font-mono text-slate-400">
                            {format(visit.checkInTime.toDate(), 'HH:mm:ss')}
                          </td>
                          <td className="px-6 py-5 text-right">
                            {visit.status === 'Pendiente' ? (
                              <button
                                onClick={() => handleMarkAsAttended(visit.id)}
                                className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                Marcar Atendido
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 text-emerald-500 font-bold text-[9px] uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-lg">
                                <CheckCircle2 size={12} /> Finalizado
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                    <History size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin registros hoy</p>
                  <p className="text-xs text-slate-300 mt-1">Las visitas registradas aparecerán aquí.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar de Adeudos */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-500" />
              Alumnos con Adeudo
            </h2>
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 space-y-2 max-h-[600px] overflow-y-auto">
              {debtors.length > 0 ? (
                debtors.map((debtor: any) => (
                    <div key={debtor.id} className="p-4 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">
                            {debtor.lastName}, {debtor.name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-tight">
                            {debtor.level} · {debtor.grade}{debtor.group}
                          </p>
                        </div>
                        <span className="text-xs font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">
                          ${debtor.debtAmount.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-3 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-rose-300 uppercase tracking-widest">Retraso</span>
                            <span className="text-xs font-black text-rose-500 leading-none">{debtor.daysLate} Días</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Teléfono Padre</span>
                            <a 
                              href={`tel:${debtor.phone}`}
                              className="text-lg font-black text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-2 justify-end"
                            >
                              <Phone size={18} className="fill-indigo-600/10" />
                              {debtor.phone || 'S/N'}
                            </a>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <a 
                            href={`tel:${debtor.phone}`}
                            className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                          >
                            <Phone size={12} /> Llamar Ahora
                          </a>
                        </div>
                      </div>
                    </div>
                ))
              ) : (
                <div className="py-20 text-center">
                  <CheckCircle2 size={32} className="text-slate-100 mx-auto mb-4" />
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Todo en orden</p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
              <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] text-blue-600 font-bold leading-relaxed lowercase">
                * se muestran deudores con más de 2 días de gracia después del día {settings?.dueDay || 10}.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Registro Moderno */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Registrar Visita</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Atención al público en general</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Nombre completo del visitante</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej. María González"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:text-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Perfil</label>
                    <div className="grid grid-cols-1 gap-2">
                       {(['Visitante', 'Padre', 'Alumno'] as const).map(type => (
                         <button
                           key={type}
                           type="button"
                           onClick={() => setFormData({...formData, type})}
                           className={cn(
                             "px-4 py-3 text-[10px] font-black uppercase text-left border rounded-xl transition-all",
                             formData.type === type ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                           )}
                         >
                           {type === 'Padre' ? 'Padre de Familia' : type}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Motivo</label>
                    <div className="grid grid-cols-1 gap-2">
                       {(['Información', 'Inscripción', 'Pago', 'Otro'] as const).map(reason => (
                         <button
                           key={reason}
                           type="button"
                           onClick={() => setFormData({...formData, reason})}
                           className={cn(
                             "px-4 py-3 text-[10px] font-black uppercase text-left border rounded-xl transition-all",
                             formData.reason === reason ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                           )}
                         >
                           {reason}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all"
                  >
                    Confirmar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string, value: string | number, sub: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
         <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
            {icon}
         </div>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      </div>
      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">{sub}</p>
    </div>
  );
}
