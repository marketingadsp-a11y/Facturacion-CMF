import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc, writeBatch, serverTimestamp, updateDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Student, Payment, AppSettings, SchoolCycle } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { User, CreditCard, FileText, Download, AlertCircle, CheckCircle2, Loader2, Calendar, LayoutDashboard, History, GraduationCap, X, Save, Wallet, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { calculateStudentDebts } from '../lib/paymentUtils';

const TAX_SYSTEMS = [
  { id: '601', name: 'General de Ley Personas Morales' },
  { id: '603', name: 'Personas Morales con Fines no Lucrativos' },
  { id: '605', name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { id: '606', name: 'Arrendamiento' },
  { id: '608', name: 'Demás ingresos' },
  { id: '609', name: 'Consolidación' },
  { id: '610', name: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { id: '611', name: 'Ingresos por Dividendos (socios y accionistas)' },
  { id: '612', name: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { id: '614', name: 'Ingresos por Intereses' },
  { id: '616', name: 'Sin obligaciones fiscales' },
  { id: '620', name: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { id: '621', name: 'Incorporación Fiscal' },
  { id: '622', name: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { id: '623', name: 'Opcional para Grupos de Sociedades' },
  { id: '624', name: 'Coordinados' },
  { id: '625', name: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { id: '626', name: 'Régimen Simplificado de Confianza' }
];

export default function ParentDashboard() {
  const { userProfile } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failure' | null>(
    searchParams.get('payment') as 'success' | 'failure' | null
  );

  const [billingData, setBillingData] = useState({
    rfc: '',
    billingName: '',
    billingAddress: '',
    zipCode: '',
    taxSystem: ''
  });

  useEffect(() => {
    if (!auth.currentUser?.email) return;

    // 1. Listen to students
    const sQuery = query(collection(db, 'students'), where('parentEmail', '==', auth.currentUser.email));
    const sUnsub = onSnapshot(sQuery, (snap) => {
      const sData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(sData);
      
      // Check if any student is missing billing info and we haven't prompted yet
      const missingBilling = sData.some(s => !s.rfc || !s.billingName);
      const hasDismissedPrompt = localStorage.getItem(`billing_prompt_dismissed_${auth.currentUser?.uid}`);
      
      if (missingBilling && !hasDismissedPrompt && !isBillingModalOpen) {
        setIsPromptModalOpen(true);
      }

      if (sData.length === 0) setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
      setLoading(false);
    });

    // 2. Listen to settings
    const setUnsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });

    // 3. Listen to cycles
    const cUnsub = onSnapshot(collection(db, 'cycles'), (snap) => {
      setCycles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCycle)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cycles');
    });

    return () => { sUnsub(); setUnsub(); cUnsub(); };
  }, [auth.currentUser?.email]);

  const currentCycle = cycles.find(c => c.id === settings?.currentCycleId) || null;

  // Initialize billing data from first student if available
  useEffect(() => {
    if (students.length > 0 && !billingData.rfc) {
      const firstWithBilling = students.find(s => s.rfc);
      if (firstWithBilling) {
        setBillingData({
          rfc: firstWithBilling.rfc || '',
          billingName: firstWithBilling.billingName || '',
          billingAddress: firstWithBilling.billingAddress || '',
          zipCode: firstWithBilling.zipCode || '',
          taxSystem: firstWithBilling.taxSystem || ''
        });
      }
    }
  }, [students]);

  useEffect(() => {
    if (paymentStatus === 'success') {
      // In a real app, we would verify the payment on the backend
      // and update the status via a webhook.
      // For this demo, we'll show the success message.
      // The admin can manually mark as paid or we can implement a "Verify" button.
      console.log('Payment success detected');
    }
  }, [paymentStatus]);

  // 3. Listen to payments separately when students are loaded
  useEffect(() => {
    if (students.length === 0) return;

    const studentIds = students.map(s => s.id);
    const pQuery = query(collection(db, 'payments'), where('studentId', 'in', studentIds), orderBy('date', 'desc'));
    
    const pUnsub = onSnapshot(pQuery, (pSnap) => {
      setPayments(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
      setLoading(false);
    });

    return () => pUnsub();
  }, [students.map(s => s.id).join(',')]);

  const handleDownloadInvoice = (invoiceId: string) => {
    if (!settings?.facturapiApiKey) return;
    const url = `/api/facturapi/invoice/${invoiceId}/pdf?apiKey=${settings.facturapiApiKey}`;
    window.open(url, '_blank');
  };

  const handlePayment = async (payment: Payment) => {
    setPayingId(payment.id);
    const student = students.find(s => s.id === payment.studentId);
    
    try {
      const response = await fetch('/api/conekta/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: `${student?.name} ${student?.lastName}`,
          amount: payment.amount,
          concept: payment.concept,
          email: auth.currentUser?.email,
          phone: student?.phone || '+525555555555',
          origin: window.location.origin
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al iniciar el pago');

      if (data.checkout_url && data.order_id) {
        // Guardar el order_id en Firestore para poder verificarlo después
        const paymentRef = doc(db, 'payments', payment.id);
        await updateDoc(paymentRef, {
          conektaOrderId: data.order_id,
          updatedAt: serverTimestamp()
        });
        
        // Use window.location.assign for better compatibility
        window.location.assign(data.checkout_url);
      } else if (data.checkout_url) {
        window.location.assign(data.checkout_url);
      } else {
        throw new Error('No se recibió una URL de pago válida de Conekta');
      }
    } catch (error: any) {
      console.error('Payment Error:', error);
      alert('Error al procesar el pago: ' + error.message);
    } finally {
      setPayingId(null);
    }
  };

  const handleVerifyPayment = async (payment: Payment) => {
    if (!payment.conektaOrderId) return;
    
    setPayingId(payment.id);
    try {
      const response = await fetch(`/api/conekta/verify/${payment.conektaOrderId}`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Error al verificar pago');
      
      if (data.status === 'paid') {
        const paymentRef = doc(db, 'payments', payment.id);
        await updateDoc(paymentRef, {
          status: 'Pagado',
          paymentMethod: 'Conekta',
          updatedAt: serverTimestamp()
        });
        alert('¡Pago confirmado con éxito!');
      } else {
        alert('El pago aún no se ha completado o está pendiente.');
      }
    } catch (error: any) {
      console.error('Verify Error:', error);
      alert('Error al verificar el pago: ' + error.message);
    } finally {
      setPayingId(null);
    }
  };

  const handlePayDebt = async (student: Student, debt: { concept: string; amount: number }) => {
    try {
      setPayingId(`debt-${student.id}-${debt.concept}`);
      
      // 1. Create a pending payment record in Firestore
      const paymentData = {
        studentId: student.id,
        amount: debt.amount,
        concept: debt.concept,
        date: serverTimestamp(),
        status: 'Pendiente',
        paymentMethod: 'Conekta',
        parentEmail: auth.currentUser?.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'payments'), paymentData);
      
      // 2. Initiate payment flow with the newly created payment
      const newPayment = {
        id: docRef.id,
        ...paymentData,
        status: 'Pendiente',
        date: { toDate: () => new Date(), toMillis: () => Date.now() }
      } as any;

      await handlePayment(newPayment);
    } catch (error: any) {
      console.error('Error creating debt payment:', error);
      alert('Error al iniciar el pago del adeudo: ' + error.message);
    } finally {
      setPayingId(null);
    }
  };

  const handleSaveBillingData = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBilling(true);
    try {
      const batch = writeBatch(db);
      students.forEach(student => {
        const studentRef = doc(db, 'students', student.id);
        batch.update(studentRef, {
          ...billingData,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      setIsBillingModalOpen(false);
      setIsPromptModalOpen(false);
      localStorage.setItem(`billing_prompt_dismissed_${auth.currentUser?.uid}`, 'true');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'students/billing');
    } finally {
      setSavingBilling(false);
    }
  };

  const dismissPrompt = () => {
    setIsPromptModalOpen(false);
    localStorage.setItem(`billing_prompt_dismissed_${auth.currentUser?.uid}`, 'true');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {paymentStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-4 rounded-2xl flex items-center justify-between gap-4",
              paymentStatus === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"
            )}
          >
            <div className="flex items-center gap-3">
              {paymentStatus === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="text-sm font-bold">
                {paymentStatus === 'success' 
                  ? "¡Pago procesado con éxito! En breve se verá reflejado en tu historial." 
                  : "Hubo un problema al procesar tu pago. Por favor, intenta de nuevo."}
              </p>
            </div>
            <button onClick={() => {
              setPaymentStatus(null);
              setSearchParams({});
            }} className="p-1 hover:bg-black/5 rounded-full">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm shrink-0">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
            ) : (
              <div className="bg-blue-600 w-full h-full flex items-center justify-center text-white">
                <GraduationCap size={32} />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display leading-tight">
              {settings?.schoolName || 'Portal de Padres'}
            </h1>
            <p className="text-slate-500">Bienvenido, {userProfile?.name}. Consulta el estatus de tus hijos.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsBillingModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm"
        >
          <FileText size={20} className="text-blue-600" />
          Datos de Facturación
        </button>
      </div>

      {students.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="text-blue-600" size={40} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No tienes alumnos vinculados</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Tu cuenta de correo ({auth.currentUser?.email}) no está vinculada a ningún alumno. 
            Por favor, contacta a la administración de la escuela para vincular tu cuenta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <LayoutDashboard size={20} className="text-blue-600" />
                  Mis Hijos
                </h2>
                {students.some(s => calculateStudentDebts(s, payments, currentCycle, settings).hasDebt) && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100 animate-pulse">
                    <AlertTriangle size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Adeudos Pendientes</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {students.map((student, idx) => {
                  const debtStatus = calculateStudentDebts(student, payments, currentCycle, settings);
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      key={student.id} 
                      className={cn(
                        "bg-white p-6 rounded-3xl border transition-all relative overflow-hidden",
                        debtStatus.hasDebt ? "border-red-100 shadow-sm shadow-red-50" : "border-slate-100 shadow-sm hover:shadow-md"
                      )}
                    >
                      {debtStatus.hasDebt && (
                        <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-red-50 rounded-full opacity-50" />
                      )}
                      <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl",
                          debtStatus.hasDebt ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {student.name[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{student.name} {student.lastName}</h3>
                          <p className="text-xs text-slate-500">{student.grade} {student.group} • {student.level}</p>
                        </div>
                      </div>
                      <div className="space-y-2 relative z-10">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">CURP:</span>
                          <span className="font-medium text-slate-900">{student.curp || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Facturación:</span>
                          <span className={cn(
                            "font-bold",
                            student.rfc ? "text-emerald-600" : "text-orange-500"
                          )}>
                            {student.rfc ? 'CONFIGURADO' : 'PENDIENTE'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-slate-500">Estatus de Pago:</span>
                          {debtStatus.hasDebt ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold text-[10px] flex items-center gap-1">
                              <AlertCircle size={10} />
                              ADEUDO (${debtStatus.totalDebt.toLocaleString()})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold text-[10px]">AL CORRIENTE</span>
                          )}
                        </div>
                        {debtStatus.hasDebt && (
                          <div className="mt-4 pt-4 border-t border-red-50 space-y-3">
                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Meses Pendientes:</p>
                            <div className="space-y-2">
                              {debtStatus.debts.map((debt, dIdx) => (
                                <div key={dIdx} className="flex items-center justify-between p-2 bg-red-50 rounded-xl border border-red-100">
                                  <span className="text-[10px] font-medium text-red-700">
                                    {debt.concept}
                                  </span>
                                  <button
                                    onClick={() => handlePayDebt(student, debt)}
                                    disabled={payingId === `debt-${student.id}-${debt.concept}`}
                                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-[9px] font-bold hover:bg-red-700 transition-all flex items-center gap-1 disabled:opacity-50"
                                  >
                                    {payingId === `debt-${student.id}-${debt.concept}` ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : (
                                      <Wallet size={10} />
                                    )}
                                    Pagar ${debt.amount.toLocaleString()}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <History size={20} className="text-blue-600" />
                Historial de Pagos
              </h2>
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Alumno</th>
                        <th className="px-6 py-4">Concepto</th>
                        <th className="px-6 py-4">Monto</th>
                        <th className="px-6 py-4">Estatus</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {payment.date?.toDate ? format(payment.date.toDate(), 'dd/MM/yyyy') : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-900">
                              {students.find(s => s.id === payment.studentId)?.name || 'Desconocido'}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">{payment.concept}</td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full font-bold text-[10px]",
                              payment.status === 'Pagado' ? "bg-emerald-100 text-emerald-700" :
                              payment.status === 'Cancelado' ? "bg-red-100 text-red-700" :
                              "bg-orange-100 text-orange-700"
                            )}>
                              {payment.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {payment.status === 'Pendiente' && !payment.conektaOrderId && (
                                <button
                                  onClick={() => handlePayment(payment)}
                                  disabled={payingId === payment.id}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                                >
                                  {payingId === payment.id ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
                                  Pagar
                                </button>
                              )}
                              {payment.status === 'Pendiente' && payment.conektaOrderId && (
                                <button
                                  onClick={() => handleVerifyPayment(payment)}
                                  disabled={payingId === payment.id}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                                >
                                  {payingId === payment.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                  Verificar Pago
                                </button>
                              )}
                              {payment.invoiceId && (
                                <button 
                                  onClick={() => handleDownloadInvoice(payment.invoiceId!)}
                                  className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors"
                                  title="Descargar Factura PDF"
                                >
                                  <Download size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <div key={payment.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {students.find(s => s.id === payment.studentId)?.name || 'Desconocido'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {payment.date?.toDate ? format(payment.date.toDate(), 'dd MMM yyyy', { locale: es }) : '-'}
                          </p>
                        </div>
                        <p className="text-sm font-black text-slate-900">{formatCurrency(payment.amount)}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-600">{payment.concept}</p>
                        <div className="flex items-center gap-2">
                          {payment.status === 'Pendiente' && !payment.conektaOrderId && (
                            <button
                              onClick={() => handlePayment(payment)}
                              disabled={payingId === payment.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                            >
                              {payingId === payment.id ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
                              Pagar
                            </button>
                          )}
                          {payment.status === 'Pendiente' && payment.conektaOrderId && (
                            <button
                              onClick={() => handleVerifyPayment(payment)}
                              disabled={payingId === payment.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                            >
                              {payingId === payment.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                              Verificar
                            </button>
                          )}
                          {payment.invoiceId && (
                            <button 
                              onClick={() => handleDownloadInvoice(payment.invoiceId!)}
                              className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"
                            >
                              <Download size={12} /> PDF
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {payments.length === 0 && (
                  <div className="px-6 py-12 text-center text-slate-500 italic text-sm">
                    No se han registrado pagos todavía.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-600 p-8 rounded-[2rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-lg font-bold mb-2">Información de Pago</h3>
                <p className="text-blue-100 text-sm mb-6">
                  Recuerda realizar tus pagos antes del día {settings?.dueDay || 10} de cada mes para evitar recargos.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Métodos Aceptados</p>
                      <p className="text-sm font-medium">{settings?.paymentMethods.join(', ') || 'Efectivo, Transferencia'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-orange-500" />
                Avisos Importantes
              </h4>
              <div className="space-y-4">
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <p className="text-xs text-orange-800 leading-relaxed">
                    Las facturas se generan automáticamente al momento del pago si tienes tus datos fiscales actualizados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Prompt Modal */}
      <AnimatePresence>
        {isPromptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismissPrompt}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl overflow-hidden"
            >
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                <FileText className="text-blue-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">¿Requiere Factura?</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Hemos detectado que algunos de sus hijos no tienen configurados los datos de facturación. 
                ¿Desea configurarlos ahora para que sus próximos pagos se facturen automáticamente?
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setIsPromptModalOpen(false);
                    setIsBillingModalOpen(true);
                  }}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Sí, configurar ahora
                </button>
                <button 
                  onClick={dismissPrompt}
                  className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  No por ahora
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Billing Form Modal */}
      <AnimatePresence>
        {isBillingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !savingBilling && setIsBillingModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <FileText className="text-blue-600" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Datos de Facturación</h3>
                </div>
                <button 
                  onClick={() => setIsBillingModalOpen(false)}
                  disabled={savingBilling}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSaveBillingData} className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 ml-1">RFC</label>
                    <input 
                      required
                      type="text"
                      placeholder="XAXX010101000"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase"
                      value={billingData.rfc}
                      onChange={e => setBillingData({...billingData, rfc: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 ml-1">Código Postal</label>
                    <input 
                      required
                      type="text"
                      maxLength={5}
                      placeholder="00000"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={billingData.zipCode}
                      onChange={e => setBillingData({...billingData, zipCode: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Nombre o Razón Social</label>
                  <input 
                    required
                    type="text"
                    placeholder="Nombre completo como aparece en el SAT"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={billingData.billingName}
                    onChange={e => setBillingData({...billingData, billingName: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Régimen Fiscal</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                    value={billingData.taxSystem}
                    onChange={e => setBillingData({...billingData, taxSystem: e.target.value})}
                  >
                    <option value="">Selecciona un régimen...</option>
                    {TAX_SYSTEMS.map(sys => (
                      <option key={sys.id} value={sys.id}>{sys.id} - {sys.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Dirección (Opcional)</label>
                  <input 
                    type="text"
                    placeholder="Calle, Número, Colonia"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={billingData.billingAddress}
                    onChange={e => setBillingData({...billingData, billingAddress: e.target.value})}
                  />
                </div>

                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="flex gap-3">
                    <AlertCircle className="text-blue-600 shrink-0" size={18} />
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Al guardar, estos datos se aplicarán a todos sus hijos vinculados ({students.length}). 
                      Asegúrese de que los datos coincidan exactamente con su Constancia de Situación Fiscal.
                    </p>
                  </div>
                </div>

                <div className="pt-4 shrink-0">
                  <button 
                    type="submit"
                    disabled={savingBilling}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {savingBilling ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <Save size={20} />
                        Guardar y Aplicar a todos
                      </>
                    )}
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
