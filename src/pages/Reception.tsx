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
  X,
  FileDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, differenceInDays, startOfDay, endOfDay, isAfter, setDate, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { calculateStudentDebts } from '../lib/paymentUtils';
import VisitorRegistrationForm from '../components/VisitorRegistrationForm';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReceptionLogPDF } from '../components/ReceptionLogPDF';

export default function Reception() {
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<'visitas' | 'bitacora'>('visitas');
  const [visits, setVisits] = useState<ReceptionVisit[]>([]);
  const [logVisits, setLogVisits] = useState<ReceptionVisit[]>([]);
  const [logDate, setLogDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
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

  useEffect(() => {
    if (activeTab !== 'bitacora') return;

    // Parse YYYY-MM-DD
    const parts = logDate.split('-');
    if (parts.length !== 3) return;
    
    const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const startObj = startOfDay(targetDate);
    const endObj = endOfDay(targetDate);

    const qLogs = query(
      collection(db, 'reception_visits'),
      where('checkInTime', '>=', Timestamp.fromDate(startObj)),
      where('checkInTime', '<=', Timestamp.fromDate(endObj)),
      orderBy('checkInTime', 'desc')
    );

    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogVisits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReceptionVisit)));
    });

    return () => unsubLogs();
  }, [activeTab, logDate]);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans tracking-tight pb-12">
      {/* Header Minimalista y Profesional - Technical Style */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 mb-6 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Terminal de Acceso</span>
            </div>
            <h1 className="text-2xl font-black text-slate-950 tracking-tighter flex items-center gap-3 italic">
              Recepción
              <span className="not-italic text-[9px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase tracking-tighter leading-none inline-flex items-center h-4">
                ACTIVO
              </span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block border-r border-slate-200 pr-4">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Reloj de Sistema</p>
              <p className="text-lg font-black text-slate-800 tracking-tight font-mono">
                {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-950 hover:bg-black text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200 transition-all active:scale-95"
            >
              <Plus size={16} />
              Registrar Visita
            </button>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="max-w-[1600px] mx-auto mt-6 flex gap-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('visitas')}
            className={cn(
              "px-4 py-2 font-black text-[11px] uppercase tracking-widest transition-all border-b-2",
              activeTab === 'visitas' 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
            )}
          >
            Panel Principal
          </button>
          <button
            onClick={() => setActiveTab('bitacora')}
            className={cn(
              "px-4 py-2 font-black text-[11px] uppercase tracking-widest transition-all border-b-2 flex items-center gap-2",
              activeTab === 'bitacora' 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
            )}
          >
            Bitácora de Acceso
          </button>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 space-y-6">
        {activeTab === 'visitas' && (
          <>
            {/* Estadísticas en Tarjetas Elegantes y Compactas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Tráfico Total"
            value={visits.length}
            sub={`${stats.pendingToday} pdt hoy`}
            icon={<Users size={16} />}
            color="indigo"
          />
          <StatCard 
            label="Concluidos"
            value={stats.attendedCount}
            sub="Atenciones hoy"
            icon={<CheckCircle2 size={16} />}
            color="emerald"
          />
          <StatCard 
            label="Trend de Fuga"
            value={stats.mostCommonReason}
            sub="Motivo principal"
            icon={<BarChart3 size={16} />}
            color="blue"
          />
          <StatCard 
            label="Latency"
            value={stats.avgWaitTime > 0 ? `${Math.round(stats.avgWaitTime / 60000)}m` : '0m'}
            sub="Espera promedio"
            icon={<Timer size={16} />}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Listado de Visitas - Technical Table */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                <History size={14} className="text-indigo-600" />
                Bitácora de Accesso
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 px-1.5 py-0.5 rounded">Real-time Data</span>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
              {visits.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800">
                        <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Interesado</th>
                        <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Contexto / Motivo</th>
                        <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Registro</th>
                        <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-right italic">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                      {visits.map((visit) => (
                        <tr key={visit.id} className={cn(
                          "group transition-all hover:bg-slate-950 hover:text-white not-italic",
                          visit.status === 'Atendido' ? "opacity-40" : ""
                        )}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded bg-slate-100 group-hover:bg-slate-800 flex items-center justify-center text-slate-400 font-black text-[10px] uppercase shadow-inner border border-slate-200 group-hover:border-slate-700">
                                {visit.name.charAt(0)}
                              </div>
                              <span className="text-[11px] font-bold uppercase tracking-tight">{visit.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 group-hover:bg-indigo-900 group-hover:text-indigo-200 px-1.5 py-0.5 rounded-sm uppercase tracking-widest w-fit mb-1">
                                {visit.area || 'GENERAL'}
                              </span>
                              <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-bold italic truncate max-w-[200px]">« {visit.reason} »</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center text-[10px] font-mono font-bold tracking-tighter">
                            {format(visit.checkInTime.toDate(), 'HH:mm:ss')}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {visit.status === 'Pendiente' ? (
                              <button
                                onClick={() => handleMarkAsAttended(visit.id)}
                                className="bg-slate-950 text-white group-hover:bg-white group-hover:text-slate-950 px-3 py-1.5 rounded text-[8px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 border border-slate-900"
                              >
                                Atender
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-emerald-500 font-black text-[8px] uppercase tracking-widest bg-emerald-50 group-hover:bg-emerald-950 px-2 py-1 rounded">
                                <CheckCircle2 size={10} /> Concluido
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                  <History size={32} className="mb-2 opacity-20" />
                  <p className="text-[9px] font-black uppercase tracking-[0.3em]">System Standby</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar de Adeudos - Professional List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
              <AlertCircle size={14} className="text-rose-500" />
              Alertas de Cobranza
            </h2>
            
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-y-auto max-h-[600px] divide-y divide-slate-50">
              {debtors.length > 0 ? (
                debtors.map((debtor: any) => (
                    <div key={debtor.id} className="p-4 hover:bg-slate-50 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-[11px] font-black text-slate-950 uppercase leading-none mb-1">
                            {debtor.lastName}, {debtor.name}
                          </p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                            {debtor.level} · <span className="text-slate-600 italic font-bold">{debtor.grade}{debtor.group}</span>
                          </p>
                        </div>
                        <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                          ${debtor.debtAmount.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-rose-50/50 p-2 rounded border border-rose-100/50">
                           <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest block mb-1">Antigüedad</span>
                           <span className="text-xs font-black text-rose-600 leading-none italic">{debtor.daysLate} DÍAS LATE</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Canal Contacto</span>
                           <a 
                             href={`tel:${debtor.phone}`}
                             className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1.5"
                           >
                             <Phone size={10} className="fill-indigo-600/10" />
                             {debtor.phone || 'S/N'}
                           </a>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <a 
                          href={`tel:${debtor.phone}`}
                          className="w-full h-8 bg-indigo-600 text-white rounded font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Phone size={12} /> Despachar Llamada
                        </a>
                      </div>
                    </div>
                ))
              ) : (
                <div className="py-20 text-center flex flex-col items-center">
                  <CheckCircle2 size={24} className="text-slate-100 mb-2" />
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Sincronizado al 100%</p>
                </div>
              )}
            </div>

            <div className="bg-indigo-950 text-indigo-100 p-4 rounded-lg flex gap-3 border border-indigo-900 shadow-lg shadow-indigo-100">
              <AlertCircle className="text-indigo-400 shrink-0 mt-0.5" size={14} />
              <p className="text-[8px] font-black uppercase tracking-widest leading-relaxed">
                MUESTRAS BASADAS EN DÍAS DE GRACIA ({settings?.dueDay || 10} + 2 DÍAS). ACTUALIZACIÓN AUTOMÁTICA CADA 15 MIN.
              </p>
            </div>
          </div>
        </div>
        </>
        )}

        {activeTab === 'bitacora' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha de Consulta</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm font-black text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <PDFDownloadLink
                document={<ReceptionLogPDF visits={logVisits} date={new Date(parseInt(logDate.split('-')[0]), parseInt(logDate.split('-')[1]) - 1, parseInt(logDate.split('-')[2]))} schoolName={settings?.schoolName || ''} />}
                fileName={`bitacora-recepcion-${logDate}.pdf`}
                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-emerald-200 hover:border-emerald-600 shadow-sm"
              >
                {/* @ts-ignore */}
                {({ loading }) => (
                  <>
                    {loading ? <Timer size={14} className="animate-spin" /> : <FileDown size={14} />}
                    {loading ? 'Generando PDF...' : 'Exportar Bitácora'}
                  </>
                )}
              </PDFDownloadLink>
            </div>

            <div className="flex-1 overflow-auto">
              {logVisits.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-3">Visitante</th>
                      <th className="px-6 py-3">Área y Motivo</th>
                      <th className="px-6 py-3">Entrada</th>
                      <th className="px-6 py-3">Salida</th>
                      <th className="px-6 py-3">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logVisits.map(visit => (
                      <tr key={visit.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-slate-800">{visit.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-700">{visit.area}</p>
                          <p className="text-[10px] font-medium text-slate-500 line-clamp-1">{visit.reason}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-mono text-xs text-slate-600">
                            {format(visit.checkInTime.toDate(), 'HH:mm:ss')}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {visit.attendedAt ? (
                            <p className="font-mono text-xs text-slate-400">
                              {format(visit.attendedAt.toDate(), 'HH:mm:ss')}
                            </p>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">Pendiente</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {visit.status === 'Pendiente' ? (
                            <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Pendiente</span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Atendido</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-300">
                  <History size={48} className="mb-4 opacity-20" />
                  <p className="text-xs font-black uppercase tracking-[0.3em]">No hay registros para este día</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal de Registro - Technical Aesthetic */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic">Registro de Ingreso</h2>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Terminal de identificación de seguridad</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded transition-all text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8">
                <VisitorRegistrationForm 
                  onSuccess={() => setIsModalOpen(false)} 
                  onCancel={() => setIsModalOpen(false)} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }: { label: string, value: string | number, sub: string, icon: React.ReactNode, color: 'indigo' | 'emerald' | 'blue' | 'amber' }) {
  const colors = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100"
  };

  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-all overflow-hidden relative group">
      <div className="flex items-center justify-between mb-4 relative z-10">
         <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
         <div className={cn("w-7 h-7 rounded flex items-center justify-center border", colors[color])}>
            {icon}
         </div>
      </div>
      <div className="flex items-baseline gap-1 relative z-10">
        <p className="text-xl font-black text-slate-950 tracking-tighter font-mono">{value}</p>
      </div>
      <p className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-widest relative z-10">{sub}</p>
      
      {/* Subtle indicator bar */}
      <div className={cn("absolute bottom-0 left-0 h-1 transition-all group-hover:w-full", {
        "bg-indigo-500 w-2": color === 'indigo',
        "bg-emerald-500 w-2": color === 'emerald',
        "bg-blue-500 w-2": color === 'blue',
        "bg-amber-500 w-2": color === 'amber'
      })} />
    </div>
  );
}
