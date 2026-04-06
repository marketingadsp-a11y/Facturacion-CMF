import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Payment, Student, AppSettings, SchoolCycle } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Plus, Search, CreditCard, Download, FileText, X, AlertCircle, 
  CheckCircle2, Loader2, Calendar, History, Check, ChevronDown,
  MessageSquare, Bell, Send, User, ExternalLink
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
              tax_system: student.taxSystem || (student.rfc?.length === 13 ? '605' : '601'),
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control de Pagos</h1>
          <p className="text-slate-500">Historial de colegiaturas y otros ingresos.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl border border-slate-100 flex shadow-sm">
            <button 
              onClick={() => setActiveTab('historial')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'historial' ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <History size={14} />
              Historial
            </button>
            <button 
              onClick={() => setActiveTab('recordatorios')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'recordatorios' ? "bg-orange-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Bell size={14} />
              Recordatorios
              {pendingStudents.length > 0 && (
                <span className="bg-white text-orange-600 px-1.5 py-0.5 rounded-full text-[10px]">
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-semibold shadow-lg shadow-blue-100 transition-all active:scale-95"
            >
              <Plus size={18} />
              Registrar Pago
            </button>
          )}
        </div>
      </div>

      {activeTab === 'historial' ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Alumno</th>
                  <th className="px-6 py-4">Concepto</th>
                  <th className="px-6 py-4">Monto</th>
                  <th className="px-6 py-4">Método</th>
                  <th className="px-6 py-4 text-right">Factura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {payment.date?.toDate ? format(payment.date.toDate(), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{getStudentName(payment.studentId)}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{payment.concept}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium">
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {payment.invoiceId ? (
                        hasPermission('payments', 'downloadInvoice') && (
                          <button 
                            onClick={() => handleDownloadInvoice(payment.invoiceId!)}
                            className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors"
                            title="Descargar Factura PDF"
                          >
                            <Download size={16} />
                          </button>
                        )
                      ) : (
                        hasPermission('payments', 'invoice') && (
                          <button 
                            disabled={invoiceLoading === payment.id}
                            onClick={() => handleInvoice(payment.id, payment, payment.studentId)}
                            className="text-slate-400 hover:text-blue-600 p-2 rounded-lg transition-colors disabled:opacity-50"
                            title="Generar Factura"
                          >
                            {invoiceLoading === payment.id ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex items-center gap-4">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-orange-900">Alumnos con Pago Pendiente ({MONTHS[getMonth(new Date())]})</h3>
              <p className="text-sm text-orange-700">Se listan los alumnos que no han registrado su pago de colegiatura este mes.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingStudents.map((student) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={student.id} 
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 font-bold text-xl">
                    {student.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{student.name} {student.lastName}</h4>
                    <p className="text-xs text-slate-500">{student.grade} {student.group} • {student.level}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adeudo</span>
                    <span className="text-sm font-bold text-red-600">{formatCurrency(currentCycle?.tuitionAmount || 0)}</span>
                  </div>
                  <button 
                    onClick={() => sendWhatsAppReminder(student)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                  >
                    <MessageSquare size={14} />
                    Recordatorio
                  </button>
                </div>
              </motion.div>
            ))}
            {pendingStudents.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-100 italic text-slate-400">
                ¡Excelente! Todos los alumnos están al día este mes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="text-blue-600" />
                Registrar Nuevo Pago
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreatePayment} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alumno *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o CURP..."
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setIsStudentDropdownOpen(true);
                    }}
                    onFocus={() => setIsStudentDropdownOpen(true)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {formData.studentId && !isStudentDropdownOpen && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                  )}
                </div>

                {isStudentDropdownOpen && studentSearch && (
                  <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setFormData({...formData, studentId: s.id});
                            setStudentSearch(`${s.name} ${s.lastName}`);
                            setIsStudentDropdownOpen(false);
                            setSelectedMonths([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0"
                        >
                          <p className="font-bold text-slate-900">{s.name} {s.lastName}</p>
                          <p className="text-[10px] text-slate-500">{s.grade} {s.group} • {s.curp}</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 italic">No se encontraron alumnos</div>
                    )}
                  </div>
                )}
              </div>

              {formData.studentId && (
                <>
                  <div className="flex gap-4 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'Colegiatura'})}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.type === 'Colegiatura' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Colegiatura
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'Otro'})}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.type === 'Otro' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Otro Concepto
                    </button>
                  </div>

                  {formData.type === 'Colegiatura' ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {currentCycle ? (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-2">Seleccionar Meses ({currentCycle.name})</label>
                            <div className="grid grid-cols-3 gap-2">
                              {currentCycle.billableMonths.map(monthIndex => {
                                const isPaid = paidMonths.includes(monthIndex);
                                return (
                                  <button
                                    key={monthIndex}
                                    type="button"
                                    disabled={isPaid}
                                    onClick={() => toggleMonth(monthIndex)}
                                    className={cn(
                                      "px-3 py-2 rounded-xl text-xs font-medium border transition-all relative overflow-hidden",
                                      selectedMonths.includes(monthIndex) 
                                        ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                                        : "bg-white border-slate-200 text-slate-600 hover:border-blue-300",
                                      isPaid && "bg-emerald-50 border-emerald-100 text-emerald-600 opacity-80 cursor-not-allowed"
                                    )}
                                  >
                                    {MONTHS[monthIndex]}
                                    {isPaid && (
                                      <div className="absolute top-0 right-0 p-0.5">
                                        <CheckCircle2 size={10} />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            {paidMonths.length > 0 && (
                              <p className="text-[10px] text-emerald-600 font-medium mt-2 flex items-center gap-1">
                                <CheckCircle2 size={10} /> Los meses en verde ya han sido pagados.
                              </p>
                            )}
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>Subtotal Colegiaturas:</span>
                              <span>{formatCurrency(selectedMonths.length * currentCycle.tuitionAmount)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-orange-600 font-medium">
                              <span>Recargos Estimados:</span>
                              <span>{formatCurrency(calculateTotal() - (selectedMonths.length * currentCycle.tuitionAmount))}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                              <span>Total a Pagar:</span>
                              <span>{formatCurrency(calculateTotal())}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 bg-orange-50 text-orange-700 rounded-2xl border border-orange-100 text-xs flex items-center gap-2">
                          <AlertCircle size={16} />
                          No hay un ciclo escolar activo. Configúralo en Ajustes.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Concepto *</label>
                        <input
                          required
                          value={formData.concept}
                          onChange={(e) => setFormData({...formData, concept: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Ej. Inscripción, Uniforme, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Monto *</label>
                        <input
                          type="number"
                          required
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Método de Pago *</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {settings?.paymentMethods.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <input
                      type="checkbox"
                      id="shouldInvoice"
                      checked={formData.shouldInvoice}
                      onChange={(e) => setFormData({...formData, shouldInvoice: e.target.checked})}
                      className="w-5 h-5 text-blue-600 rounded-lg focus:ring-blue-500"
                    />
                    <label htmlFor="shouldInvoice" className="text-sm font-medium text-blue-900 cursor-pointer">
                      Generar factura automáticamente (Facturapi)
                    </label>
                  </div>
                </>
              )}

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formData.type === 'Colegiatura' && selectedMonths.length === 0}
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  Confirmar Pago {calculateTotal() > 0 && `(${formatCurrency(calculateTotal())})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
