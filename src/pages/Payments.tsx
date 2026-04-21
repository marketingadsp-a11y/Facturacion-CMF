import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Payment, Student, AppSettings, SchoolCycle } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Plus, Search, CreditCard, Download, FileText, X, AlertCircle, 
  CheckCircle2, Loader2, Calendar, History, Check, ChevronDown,
  MessageSquare, Bell, Send, User, ExternalLink, Wallet, X as XIcon
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format, getDate, getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function Payments() {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<SchoolCycle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'historial' | 'recordatorios'>('historial');
  const [dateStart, setDateStart] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // ... (previous useEffects and logic)

  useEffect(() => {
    if (location.state?.studentId && students.length > 0) {
      const student = students.find(s => s.id === location.state.studentId);
      if (student) {
        setFormData(prev => ({ ...prev, studentId: student.id }));
        setStudentSearch(`${student.name} ${student.lastName}`);
        setIsModalOpen(true);
        // Clear state to avoid reopening on refresh
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, students]);

  // Form State
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    concept: '',
    paymentMethod: 'Efectivo',
    shouldInvoice: false,
    type: 'Colegiatura' as 'Colegiatura' | 'Otro'
  });
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  const filteredStudents = students.filter(s => 
    `${s.name} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.curp?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const getPaidMonthsForStudent = (studentId: string) => {
    if (!currentCycle || !studentId) return [];
    
    const studentPayments = payments.filter(p => p.studentId === studentId && p.status !== 'Cancelado');
    const paidIndices: number[] = [];

    studentPayments.forEach(p => {
      if (p.items) {
        p.items.forEach(item => {
          MONTHS.forEach((month, index) => {
            if (item.description.includes(month) && item.description.includes(currentCycle.name)) {
              paidIndices.push(index);
            }
          });
        });
      } else if (p.concept.includes(currentCycle.name)) {
        // Fallback for older payments without items array
        MONTHS.forEach((month, index) => {
          if (p.concept.includes(month)) {
            paidIndices.push(index);
          }
        });
      }
    });

    return [...new Set(paidIndices)];
  };

  const paidMonths = getPaidMonthsForStudent(formData.studentId);

  useEffect(() => {
    const pUnsub = onSnapshot(query(collection(db, 'payments'), orderBy('date', 'desc')), (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
    });

    const sUnsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const setUnsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });

    const cyUnsub = onSnapshot(collection(db, 'cycles'), (snap) => {
      const cyData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCycle));
      setCycles(cyData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cycles');
    });

    return () => { pUnsub(); sUnsub(); setUnsub(); cyUnsub(); };
  }, []);

  useEffect(() => {
    if (settings?.currentCycleId && cycles.length > 0) {
      const active = cycles.find(c => c.id === settings.currentCycleId);
      setCurrentCycle(active || null);
    }
  }, [settings?.currentCycleId, cycles]);

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      if (!payment.date?.toDate) return true;
      const pDate = payment.date.toDate();
      const start = new Date(dateStart + 'T00:00:00');
      const end = new Date(dateEnd + 'T23:59:59');
      return pDate >= start && pDate <= end;
    });
  }, [payments, dateStart, dateEnd]);

  const calculateTotal = () => {
    if (formData.type === 'Otro') return parseFloat(formData.amount) || 0;
    if (!currentCycle) return 0;

    let total = 0;
    const today = new Date();
    const currentDay = getDate(today);
    const currentMonth = getMonth(today);

    selectedMonths.forEach(monthIndex => {
      let monthAmount = currentCycle.tuitionAmount;
      
      // Check for interest
      // If month is in the past OR (month is current month AND day > dueDay)
      const isPastMonth = monthIndex < currentMonth;
      const isCurrentMonthLate = monthIndex === currentMonth && currentDay > (settings?.dueDay || 10);

      if (isPastMonth || isCurrentMonthLate) {
        if (settings?.lateFeeType === 'fixed') {
          monthAmount += settings.lateFeeAmount;
        } else if (settings?.lateFeeType === 'percentage') {
          monthAmount += (monthAmount * (settings.lateFeeAmount / 100));
        }
      }
      total += monthAmount;
    });

    return total;
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = calculateTotal();
    if (!formData.studentId || total <= 0) return;

    try {
      let finalConcept = formData.concept;
      let items: any[] = [];

      if (formData.type === 'Colegiatura' && currentCycle) {
        const today = new Date();
        const currentDay = getDate(today);
        const currentMonth = getMonth(today);

        const monthNames = selectedMonths.map(m => MONTHS[m]).join(', ');
        finalConcept = `Colegiatura ${currentCycle.name}: ${monthNames}`;

        selectedMonths.forEach(monthIndex => {
          let baseAmount = currentCycle.tuitionAmount;
          let interest = 0;

          const isPastMonth = monthIndex < currentMonth;
          const isCurrentMonthLate = monthIndex === currentMonth && currentDay > (settings?.dueDay || 10);

          if (isPastMonth || isCurrentMonthLate) {
            if (settings?.lateFeeType === 'fixed') {
              interest = settings.lateFeeAmount;
            } else if (settings?.lateFeeType === 'percentage') {
              interest = (baseAmount * (settings.lateFeeAmount / 100));
            }
          }

          items.push({
            description: `Colegiatura ${MONTHS[monthIndex]} ${currentCycle.name}`,
            price: baseAmount
          });

          if (interest > 0) {
            items.push({
              description: `Recargo por pago tardío (${MONTHS[monthIndex]})`,
              price: interest
            });
          }
        });
      } else {
        items.push({
          description: formData.concept,
          price: parseFloat(formData.amount)
        });
      }

      const paymentData = {
        studentId: formData.studentId,
        amount: total,
        concept: finalConcept,
        paymentMethod: formData.paymentMethod,
        date: serverTimestamp(),
        status: 'Pagado',
        items // Store items for invoicing
      };

      const docRef = await addDoc(collection(db, 'payments'), paymentData);

      if (formData.shouldInvoice && settings?.facturapiApiKey) {
        handleInvoice(docRef.id, paymentData, formData.studentId);
      }

      setIsModalOpen(false);
      setFormData({ studentId: '', amount: '', concept: '', paymentMethod: 'Efectivo', shouldInvoice: false, type: 'Colegiatura' });
      setSelectedMonths([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    }
  };

  const handleInvoice = async (paymentId: string, payment: any, studentId: string) => {
    if (!settings?.facturapiApiKey) {
      alert('Por favor, configura tu API Key de Facturapi en Ajustes.');
      return;
    }

    setInvoiceLoading(paymentId);
    try {
      const student = students.find(s => s.id === studentId);
      if (!student || !student.rfc) {
        alert('El alumno no tiene RFC configurado para facturar.');
        return;
      }

      // Prepare items for Facturapi
      const invoiceItems = (payment.items || [{ description: payment.concept, price: payment.amount }]).map((item: any) => ({
        quantity: 1,
        product: {
          description: item.description,
          product_key: '86121500', // Servicios educativos
          unit_key: 'E48',
          price: item.price,
          tax_included: true,
          taxes: [{ type: 'IVA', rate: 0, factor: 'Exento' }]
        }
      }));

      const response = await fetch('/api/facturapi/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.facturapiApiKey,
          invoiceData: {
            customer: {
              legal_name: student.billingName || `${student.name} ${student.lastName}`,
              tax_id: student.rfc,
              tax_system: (student.rfc === 'XAXX010101000' || student.rfc === 'XEXX010101000') ? '616' : (student.taxSystem || (student.rfc?.length === 13 ? '605' : '601')),
              address: { zip: student.zipCode || '44100' }
            },
            items: invoiceItems,
            payment_form: payment.paymentMethod === 'Efectivo' ? '01' : '03',
            use: 'D10', // Pagos por servicios educativos (Colegiaturas)
          }
        })
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error(`El servidor devolvió una respuesta no válida (no es JSON). Esto suele indicar un error de configuración en el servidor o una ruta no encontrada (404). Detalle: ${text.substring(0, 100)}...`);
      }

      if (result.id) {
        await updateDoc(doc(db, 'payments', paymentId), {
          invoiceId: result.id,
          status: 'Pagado'
        });
        alert('Factura generada con éxito.');
      } else {
        throw new Error(result.error || 'Error desconocido al generar factura');
      }
    } catch (error: any) {
      console.error("Invoice error:", error);
      alert(`Error al generar factura: ${error.message}`);
    } finally {
      setInvoiceLoading(null);
    }
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    if (!settings?.facturapiApiKey) return;
    const url = `/api/facturapi/invoice/${invoiceId}/pdf?apiKey=${settings.facturapiApiKey}`;
    window.open(url, '_blank');
  };

  const getStudentName = (id: string) => {
    const s = students.find(s => s.id === id);
    return s ? `${s.name} ${s.lastName}` : 'Desconocido';
  };

  const toggleMonth = (monthIndex: number) => {
    setSelectedMonths(prev => 
      prev.includes(monthIndex) 
        ? prev.filter(m => m !== monthIndex) 
        : [...prev, monthIndex].sort((a, b) => a - b)
    );
  };

  const pendingStudents = useMemo(() => {
    if (!currentCycle) return [];
    const currentMonth = getMonth(new Date());
    
    return students.filter(student => {
      const paid = getPaidMonthsForStudent(student.id);
      return !paid.includes(currentMonth);
    });
  }, [students, payments, currentCycle]);

  const sendWhatsAppReminder = (student: Student) => {
    const currentMonthName = MONTHS[getMonth(new Date())];
    const message = `Hola, te recordamos que el pago de colegiatura de ${student.name} ${student.lastName} correspondiente al mes de ${currentMonthName} está pendiente. Por favor, realiza tu pago a la brevedad para evitar recargos. ¡Gracias!`;
    const phone = student.phone?.replace(/\D/g, '');
    if (!phone) {
      alert('El alumno no tiene un número de teléfono configurado.');
      return;
    }
    const url = `https://wa.me/52${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-6">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Gestión de Cajas</h1>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1 opacity-60">Control operativo de ingresos y cobranza.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-md flex shadow-inner">
              <button 
                onClick={() => setActiveTab('historial')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'historial' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Historial
              </button>
              <button 
                onClick={() => setActiveTab('recordatorios')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  activeTab === 'recordatorios' ? "bg-white text-orange-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Cobranza
                {pendingStudents.length > 0 && (
                  <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-sm text-[8px]">
                    {pendingStudents.length}
                  </span>
                )}
              </button>
            </div>
            
            {hasPermission('payments', 'create') && (
              <button
                onClick={() => {
                  setFormData({ studentId: '', amount: '', concept: '', paymentMethod: 'Efectivo', shouldInvoice: false, type: 'Colegiatura' });
                  setStudentSearch('');
                  setIsModalOpen(true);
                }}
                className="tech-button"
              >
                <Plus size={14} strokeWidth={3} className="mr-1" />
                Registrar Pago
              </button>
            )}
          </div>
        </motion.div>

        {/* Filters & Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Active Range Filter */}
          <div className="lg:col-span-5 bg-white p-3 rounded-md border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Desde</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input 
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasta</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input 
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Día ({format(new Date(), 'dd/MM')})</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(payments.filter(p => {
                  const pDate = p.date?.toDate ? p.date.toDate() : null;
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  return pDate && pDate >= today && p.status === 'Pagado';
                }).reduce((acc, p) => acc + (p.amount || 0), 0))}
              </p>
            </div>
            <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Filtro Selección</p>
              <p className="text-xl font-bold text-emerald-600 tabular-nums">
                {formatCurrency(filteredPayments.reduce((acc, p) => acc + (p.status === 'Pagado' ? (p.amount || 0) : 0), 0))}
              </p>
            </div>
            <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Pendientes</p>
              <p className="text-xl font-bold text-orange-600 tabular-nums">
                {pendingStudents.length}
              </p>
            </div>
            <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Regs</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">
                {filteredPayments.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'historial' ? (
        <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-3 w-32">Fecha</th>
                  <th className="px-6 py-3 min-w-[220px]">Alumno / Identidad</th>
                  <th className="px-6 py-3">Concepto Glosa</th>
                  <th className="px-6 py-3 w-36">Importe</th>
                  <th className="px-6 py-3 w-32">Modalidad</th>
                  <th className="px-6 py-3 w-24 text-right">SAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-3 text-[10px] font-bold text-slate-400 tabular-nums italic">
                      {payment.date?.toDate ? format(payment.date.toDate(), 'dd/MM/yy HH:mm') : '--/--/--'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-slate-950 text-white flex items-center justify-center font-black text-[10px] shadow-sm shrink-0">
                          {getStudentName(payment.studentId).charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-slate-900 truncate tracking-tight uppercase">{getStudentName(payment.studentId)}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight truncate">ID: {payment.studentId.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-[10px] font-medium text-slate-500 line-clamp-1 italic tracking-tight">{payment.concept}</p>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-[11px] font-black text-slate-950 tabular-nums">{formatCurrency(payment.amount)}</p>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {payment.invoiceId ? (
                        hasPermission('payments', 'downloadInvoice') && (
                          <button 
                            onClick={() => handleDownloadInvoice(payment.invoiceId!)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-all border border-transparent hover:border-emerald-100"
                            title="Descargar Factura PDF"
                          >
                            <Download size={14} />
                          </button>
                        )
                      ) : (
                        hasPermission('payments', 'invoice') && (
                          <button 
                            disabled={invoiceLoading === payment.id}
                            onClick={() => handleInvoice(payment.id, payment, payment.studentId)}
                            className="p-1.5 text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded transition-all border border-transparent hover:border-slate-200 disabled:opacity-30"
                            title="Generar Factura Electrónica"
                          >
                            {invoiceLoading === payment.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                   <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-4 border border-slate-100">
                        <Wallet size={24} />
                      </div>
                      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Sin registros en este periodo</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-orange-50 border border-orange-100 p-4 rounded-md flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-white text-orange-600 rounded flex items-center justify-center shadow-sm border border-orange-100 shrink-0">
              <Bell size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xs font-black text-orange-950 uppercase tracking-widest italic">Morosidad detectada ({MONTHS[getMonth(new Date())]})</h3>
              <p className="text-[10px] text-orange-700 font-medium mt-0.5 tracking-tight">
                Alumnos con adeudo en el ciclo activo. Notifica a los tutores para regularizar su estado.
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {pendingStudents.map((student) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={student.id} 
                className="bg-white p-3 rounded-md border border-slate-200 shadow-sm hover:border-slate-900 transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded flex items-center justify-center text-slate-400 font-black text-sm shrink-0">
                    {student.name[0]}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-black text-slate-900 tracking-tight uppercase truncate">{student.name} {student.lastName}</h4>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      {student.grade}/{student.group} <span className="opacity-30">•</span> {student.level}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-50 mb-3">
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest italic">Adeudo</span>
                  <p className="text-sm font-black text-rose-600 tabular-nums">{formatCurrency(currentCycle?.tuitionAmount || 0)}</p>
                </div>
                
                <button 
                  onClick={() => sendWhatsAppReminder(student)}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Send size={10} />
                  Notificar Tutor
                </button>
              </motion.div>
            ))}
            {pendingStudents.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-md border border-slate-100 italic">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Cartera al corriente</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-lg shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-950 text-white rounded flex items-center justify-center shadow-inner">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 tracking-tight uppercase italic">Captura de Ingreso</h2>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">Control de Caja</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400">
                  <XIcon size={18} />
                </button>
              </div>
              
              <form onSubmit={handleCreatePayment} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="relative">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Búsqueda de Alumno</label>
                  <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={12} className="text-slate-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Nombre o CURP..."
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        setIsStudentDropdownOpen(true);
                      }}
                      onFocus={() => setIsStudentDropdownOpen(true)}
                      className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-900 focus:bg-white outline-none font-bold text-xs transition-all"
                    />
                  </div>

                  {isStudentDropdownOpen && studentSearch && (
                    <div className="absolute z-[120] w-full mt-1 bg-white border border-slate-200 rounded-md shadow-2xl max-h-48 overflow-y-auto p-1">
                      {filteredStudents.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setFormData({...formData, studentId: s.id});
                            setStudentSearch(`${s.name} ${s.lastName}`);
                            setIsStudentDropdownOpen(false);
                            setSelectedMonths([]);
                          }}
                          className="w-full p-2 text-left hover:bg-slate-50 rounded transition-colors mb-0.5 last:mb-0"
                        >
                          <p className="font-black text-slate-900 text-[11px] uppercase truncate">{s.name} {s.lastName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{s.grade}{s.group} • {s.level}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {formData.studentId && (
                  <>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-md">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, type: 'Colegiatura'})}
                        className={cn(
                          "flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all",
                          formData.type === 'Colegiatura' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        )}
                      >
                        Colegiatura
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, type: 'Otro'})}
                        className={cn(
                          "flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all",
                          formData.type === 'Otro' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        )}
                      >
                        Gastos Varios
                      </button>
                    </div>

                    {formData.type === 'Colegiatura' ? (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        {currentCycle ? (
                          <>
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Periodos Electivos ({currentCycle.name})</label>
                              <div className="grid grid-cols-4 gap-1.5">
                                {currentCycle.billableMonths.map(monthIndex => {
                                  const isPaid = paidMonths.includes(monthIndex);
                                  const isSelected = selectedMonths.includes(monthIndex);
                                  return (
                                    <button
                                      key={monthIndex}
                                      type="button"
                                      disabled={isPaid}
                                      onClick={() => toggleMonth(monthIndex)}
                                      className={cn(
                                        "px-1 py-1.5 rounded border text-[8px] font-black uppercase tracking-widest transition-all",
                                        isSelected 
                                          ? "bg-slate-950 border-slate-950 text-white shadow-sm" 
                                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-400",
                                        isPaid && "bg-emerald-50 border-emerald-100 text-emerald-600 opacity-50 cursor-not-allowed"
                                      )}
                                    >
                                      {MONTHS[monthIndex].substring(0, 3)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Subtotal</span>
                                <span className="text-slate-900">{formatCurrency(selectedMonths.length * currentCycle.tuitionAmount)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[9px] font-black text-rose-500 uppercase tracking-widest">
                                <span>Mora/Recargos</span>
                                <span>{formatCurrency(calculateTotal() - (selectedMonths.length * currentCycle.tuitionAmount))}</span>
                              </div>
                              <div className="pt-2 mt-1 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Total Neto:</span>
                                <span className="text-lg font-black text-slate-900 tabular-nums italic">{formatCurrency(calculateTotal())}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-100 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle size={14} />
                            Falta Ciclo Activo.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Concepto Detallado</label>
                          <input
                            required
                            value={formData.concept}
                            onChange={(e) => setFormData({...formData, concept: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-900 outline-none font-bold text-xs"
                            placeholder="Describa el motivo del cobro..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Importe ($)</label>
                          <input
                            type="number"
                            required
                            value={formData.amount}
                            onChange={(e) => setFormData({...formData, amount: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-900 outline-none font-bold text-xs tabular-nums"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Medio de Pago</label>
                        <select
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-900 outline-none font-bold text-xs"
                        >
                          {settings?.paymentMethods.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex flex-col justify-end">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, shouldInvoice: !formData.shouldInvoice})}
                          className={cn(
                            "group px-3 py-2 rounded-md border transition-all flex items-center justify-between",
                            formData.shouldInvoice ? "bg-slate-950 border-slate-950" : "bg-slate-50 border-slate-200"
                          )}
                        >
                          <div className="flex flex-col text-left">
                            <span className={cn("text-[8px] font-black uppercase tracking-widest", formData.shouldInvoice ? "text-white" : "text-slate-400")}>Factura</span>
                          </div>
                          <div className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center transition-all",
                            formData.shouldInvoice ? "bg-white text-slate-900 scale-110" : "bg-white border border-slate-200"
                          )}>
                            {formData.shouldInvoice && <Check size={10} strokeWidth={4} />}
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest"
                  >
                    Anular
                  </button>
                  <button
                    type="submit"
                    disabled={formData.studentId === '' || (formData.type === 'Colegiatura' && selectedMonths.length === 0)}
                    className="tech-button"
                  >
                    CONFIRMAR INGRESO
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
