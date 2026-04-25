import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc, writeBatch, serverTimestamp, updateDoc, addDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Student, Payment, AppSettings, SchoolCycle, Subject, StudentGrade } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { User, CreditCard, FileText, Download, AlertCircle, CheckCircle2, Loader2, Calendar, LayoutDashboard, History, GraduationCap, X, Save, Wallet, RefreshCw, AlertTriangle, Users, Clock, Bell } from 'lucide-react';
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

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'hijos' | 'facturas' | 'billing' | 'avisos' | 'grades'>((searchParams.get('tab') as any) || 'hijos');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [billingData, setBillingData] = useState({
    rfc: '',
    billingName: '',
    billingAddress: '',
    zipCode: '',
    taxSystem: ''
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'hijos' || tab === 'facturas' || tab === 'billing' || tab === 'avisos' || tab === 'grades') {
      if (tab !== activeTab) setActiveTab(tab as any);
    } else if (!tab && activeTab !== 'hijos') {
      setActiveTab('hijos');
    }
  }, [searchParams, activeTab]);

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

    // 4. Listen to announcements
    const annQuery = query(collection(db, 'announcements'), where('active', '==', true), orderBy('createdAt', 'desc'));
    const annUnsub = onSnapshot(annQuery, (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });

    // 5. Listen to subjects
    const subUnsub = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });

    return () => { sUnsub(); setUnsub(); cUnsub(); annUnsub(); subUnsub(); };
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
    const orderId = searchParams.get('order_id');
    if (paymentStatus === 'success' && orderId && payments.length > 0) {
      const payment = payments.find(p => p.conektaOrderId === orderId);
      if (payment && payment.status === 'Pendiente') {
        handleVerifyPayment(payment);
        // Clear order_id to prevent multiple alerts
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('order_id');
        setSearchParams(newParams);
      }
    }
  }, [paymentStatus, payments, searchParams]);

  // 3. Listen to payments and grades separately when students are loaded
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

    // Listen to grades for these students
    const gQuery = query(collection(db, 'grades'), where('studentId', 'in', studentIds));
    const gUnsub = onSnapshot(gQuery, (gSnap) => {
      setStudentGrades(gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentGrade)));
    });

    return () => { pUnsub(); gUnsub(); };
  }, [students.map(s => s.id).join(',')]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'facturas' || tab === 'hijos' || tab === 'billing' || tab === 'avisos' || tab === 'grades') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleOpenHistory = (student: Student) => {
    setSelectedStudent(student);
    setIsHistoryModalOpen(true);
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    if (!settings?.facturapiApiKey) return;
    const url = `/api/facturapi/invoice/${invoiceId}/pdf?apiKey=${settings.facturapiApiKey}`;
    window.open(url, '_blank');
  };

  const handleGenerateInvoice = async (payment: Payment) => {
    if (!settings?.facturapiApiKey) {
      alert('El colegio no tiene configurada la facturación electrónica.');
      return;
    }

    const student = students.find(s => s.id === payment.studentId);
    if (!student || !student.rfc) {
      alert('Por favor, actualiza tus datos fiscales primero.');
      setIsBillingModalOpen(true);
      return;
    }

    setPayingId(payment.id);
    try {
      const invoiceItems = (payment.items || [{ description: payment.concept, price: payment.amount }]).map((item: any) => ({
        quantity: 1,
        product: {
          description: item.description,
          product_key: '86121500',
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
            use: 'D10',
          }
        })
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error(`Error del servidor: ${text.substring(0, 100)}...`);
      }

      if (result.id) {
        await updateDoc(doc(db, 'payments', payment.id!), {
          invoiceId: result.id
        });
        alert('Factura generada con éxito.');
      } else {
        throw new Error(result.message || 'Error desconocido al generar factura');
      }
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      alert(`Error al generar factura: ${error.message}`);
    } finally {
      setPayingId(null);
    }
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

      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response from server:', text);
        throw new Error(`Error del servidor (no es JSON). Por favor contacte al administrador.`);
      }

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
      // Validate generic RFC tax system
      let finalBillingData = { ...billingData };
      if ((billingData.rfc === 'XAXX010101000' || billingData.rfc === 'XEXX010101000') && billingData.taxSystem !== '616') {
        finalBillingData.taxSystem = '616';
      }

      const batch = writeBatch(db);
      students.forEach(student => {
        const studentRef = doc(db, 'students', student.id);
        batch.update(studentRef, {
          ...finalBillingData,
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

  const handleAcknowledgeAnnouncement = async (announcementId: string) => {
    if (!auth.currentUser?.uid) return;
    try {
      const annRef = doc(db, 'announcements', announcementId);
      await updateDoc(annRef, {
        acknowledgedBy: arrayUnion(auth.currentUser.uid)
      });
    } catch (error: any) {
      console.error("Error acknowledging announcement:", error);
      alert(`No se pudo marcar como enterado. Error: ${error.message}`);
    }
  };

  const unreadAnnouncements = announcements.filter(ann => 
    !auth.currentUser?.uid || !ann.acknowledgedBy?.includes(auth.currentUser.uid)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 pt-4">
      <AnimatePresence>
        {paymentStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg",
              paymentStatus === 'success' 
                ? "bg-emerald-600 text-white" 
                : "bg-rose-600 text-white"
            )}
          >
            <div className="flex items-center gap-3">
              {paymentStatus === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                  {paymentStatus === 'success' ? "Éxito" : "Atención"}
                </p>
                <p className="text-xs opacity-90 font-medium">
                  {paymentStatus === 'success' ? "Pago confirmado." : "Error al procesar."}
                </p>
              </div>
            </div>
            <button onClick={() => {
              setPaymentStatus(null);
              setSearchParams({});
            }} className="p-1.5 hover:bg-white/10 rounded-lg">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'hijos' && (
        <>
          {unreadAnnouncements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unreadAnnouncements.map((ann, idx) => (
                <motion.div 
                  key={ann.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    "p-5 rounded-2xl border relative overflow-hidden group flex flex-col shadow-sm transition-all hover:shadow-md",
                    ann.type === 'important' ? "bg-rose-50 border-rose-100" :
                    ann.type === 'warning' ? "bg-amber-50 border-amber-200" :
                    "bg-slate-900 border-slate-800 text-white"
                  )}
                >
                  <div className="relative z-10 flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn(
                        "p-2 rounded-lg",
                        ann.type === 'important' ? "bg-rose-600 text-white" :
                        ann.type === 'warning' ? "bg-amber-500 text-white" :
                        "bg-white/10 text-white backdrop-blur-md"
                      )}>
                        {ann.type === 'important' ? <AlertTriangle size={18} /> : 
                         ann.type === 'warning' ? <AlertCircle size={18} /> : 
                         <Bell size={18} />}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-50">
                        {format(ann.createdAt?.toDate ? ann.createdAt.toDate() : new Date(), 'dd MMM', { locale: es })}
                      </span>
                    </div>
                    
                    <h3 className="text-base font-black tracking-tight mb-1">{ann.title}</h3>
                    <p className="text-xs opacity-80 leading-relaxed mb-6 line-clamp-2">{ann.content}</p>
                    
                        <div className="mt-auto pt-4 border-t border-black/5 flex justify-end">
                          <button
                            onClick={() => handleAcknowledgeAnnouncement(ann.id)}
                            className={cn(
                              "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
                              ann.type === 'important' ? "bg-rose-600 text-white hover:bg-rose-700" :
                              ann.type === 'warning' ? "bg-amber-600 text-white hover:bg-amber-700" :
                              "bg-white text-slate-900 hover:bg-slate-50"
                            )}
                          >
                            Enterado
                          </button>
                        </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <p className="text-[9px] font-black text-blue-600 tracking-[0.2em] uppercase mb-1">Bienvenido</p>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                  Hola, {userProfile?.name.split(' ')[0] || 'Padre'}
                </h1>
              </motion.div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    "p-6 rounded-2xl border shadow-sm flex flex-col justify-between transition-all group",
                    students.some(s => calculateStudentDebts(s, payments, currentCycle, settings).hasOverdueDebt)
                      ? "bg-rose-600 border-rose-500 text-white shadow-rose-100"
                      : "bg-white border-slate-100 shadow-slate-200/40 hover:border-emerald-100"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-6",
                    students.some(s => calculateStudentDebts(s, payments, currentCycle, settings).hasOverdueDebt)
                      ? "bg-white/20 text-white border border-white/30 backdrop-blur-md"
                      : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  )}>
                    {students.some(s => calculateStudentDebts(s, payments, currentCycle, settings).hasOverdueDebt) 
                      ? <AlertTriangle size={20} strokeWidth={2.5} /> 
                      : <CheckCircle2 size={20} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <p className={cn(
                      "text-[10px] uppercase font-black tracking-widest mb-1",
                      students.some(s => calculateStudentDebts(s, payments, currentCycle, settings).hasOverdueDebt)
                        ? "text-rose-100"
                        : "text-slate-400"
                    )}>Estado de Cuenta</p>
                    <p className="text-xl font-black tabular-nums leading-tight tracking-tighter">
                      {students.some(s => calculateStudentDebts(s, payments, currentCycle, settings).hasOverdueDebt) 
                        ? "Adeudo Pendiente" 
                        : "Al Corriente"}
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
        </>
      )}

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
        <div className="space-y-8">
          {activeTab === 'hijos' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {students.map((student, idx) => {
                      const debtStatus = calculateStudentDebts(student, payments, currentCycle, settings);
                      const hasOverdue = debtStatus.hasOverdueDebt;
                      
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          key={student.id} 
                          className={cn(
                            "bg-white p-6 rounded-2xl border transition-all relative overflow-hidden group flex flex-col justify-between",
                            hasOverdue ? "border-rose-200 shadow-lg shadow-rose-50" : "border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200"
                          )}
                        >
                          <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-sm",
                              hasOverdue ? "bg-rose-600 text-white" : "bg-slate-950 text-white"
                            )}>
                              {student.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-black text-slate-900 truncate text-base tracking-tight leading-tight">{student.name} {student.lastName}</h3>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">
                                {student.grade} {student.group} <span className="text-blue-500 mx-1">•</span> {student.level}
                              </p>
                            </div>
                            <button 
                              onClick={() => handleOpenHistory(student)}
                              className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-all border border-slate-100"
                              title="Ver Historial"
                            >
                              <History size={16} strokeWidth={2.5} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                              <p className="text-[9px] text-slate-400 uppercase font-black tracking-[0.2em] mb-1.5">Situación</p>
                              <div className="flex items-center gap-1.5">
                                {hasOverdue ? (
                                  <span className="text-[9px] font-black text-rose-600 flex items-center gap-1 px-2 py-0.5 bg-white border border-rose-100 rounded-md">
                                    <AlertCircle size={10} strokeWidth={3} /> ADEUDO
                                  </span>
                                ) : debtStatus.hasDebt ? (
                                  <span className="text-[9px] font-black text-amber-600 flex items-center gap-1 px-2 py-0.5 bg-white border border-amber-100 rounded-md">
                                    <Clock size={10} strokeWidth={3} /> TIEMPO
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black text-emerald-600 flex items-center gap-1 px-2 py-0.5 bg-white border border-emerald-100 rounded-md">
                                    <CheckCircle2 size={10} strokeWidth={3} /> AL DÍA
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                              <p className="text-[9px] text-slate-400 uppercase font-black tracking-[0.2em] mb-1.5">Fiscal</p>
                              <span className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-md border inline-block",
                                student.rfc ? "text-emerald-700 bg-white border-emerald-100" : "text-amber-600 bg-white border-amber-100"
                              )}>
                                {student.rfc ? 'OK' : 'PEND.'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2 relative z-10">
                            {debtStatus.hasDebt && debtStatus.debts.map((debt, dIdx) => (
                              <button
                                key={dIdx}
                                onClick={() => handlePayDebt(student, debt)}
                                disabled={payingId === `debt-${student.id}-${debt.concept}`}
                                className={cn(
                                  "w-full py-2.5 px-4 rounded-xl text-[10px] font-bold transition-all flex items-center justify-between group/btn disabled:opacity-50",
                                  debt.isOverdue 
                                    ? "bg-rose-600 text-white hover:bg-rose-700 shadow-sm" 
                                    : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                                )}
                              >
                                <span className="flex items-center gap-2">
                                  <Wallet size={14} />
                                  {debt.concept}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span>{formatCurrency(debt.amount)}</span>
                                  {payingId === `debt-${student.id}-${debt.concept}` && (
                                    <Loader2 size={12} className="animate-spin" />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>

                          {!debtStatus.hasDebt && debtStatus.nextTuition && (
                              <div className="mt-4 pt-4 border-t border-slate-50">
                                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest text-center mb-2.5">Al corriente</p>
                                <button
                                  onClick={() => handlePayDebt(student, debtStatus.nextTuition!)}
                                  disabled={payingId === `debt-${student.id}-${debtStatus.nextTuition.concept}`}
                                  className="w-full py-2 px-4 rounded-xl text-[10px] font-bold transition-all flex items-center justify-between group/btn disabled:opacity-50 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"
                                >
                                  <span className="flex items-center gap-2 text-[9px]">
                                    <Calendar size={12} />
                                    Adelantar próx. mes
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold">{formatCurrency(debtStatus.nextTuition.amount)}</span>
                                    {payingId === `debt-${student.id}-${debtStatus.nextTuition.concept}` && (
                                      <Loader2 size={10} className="animate-spin" />
                                    )}
                                  </div>
                                </button>
                              </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                {/* Billing info card removed from here */}
              </div>
            </div>
          ) : activeTab === 'avisos' ? (
            <div className="space-y-8">
              {announcements.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center">
                  <p className="text-slate-500 italic font-medium">No hay avisos publicados en este momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {announcements.map((ann, idx) => (
                    <motion.div 
                      key={ann.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "bg-white p-8 rounded-[2.5rem] border shadow-xl shadow-slate-200/40 relative overflow-hidden group flex flex-col h-full",
                        ann.type === 'important' ? "border-rose-100 hover:border-rose-200" :
                        ann.type === 'warning' ? "border-amber-100 hover:border-amber-200" :
                        "border-slate-100 hover:border-blue-100"
                      )}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className={cn(
                          "p-3 rounded-2xl",
                          ann.type === 'important' ? "bg-rose-50 text-rose-600" :
                          ann.type === 'warning' ? "bg-amber-50 text-amber-600" :
                          "bg-slate-50 text-blue-600"
                        )}>
                          {ann.type === 'important' ? <AlertTriangle size={24} /> : 
                           ann.type === 'warning' ? <AlertCircle size={24} /> : 
                           <Bell size={24} />}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {ann.createdAt?.toDate ? format(ann.createdAt.toDate(), 'PPP', { locale: es }) : 'Reciente'}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-3">{ann.title}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                      </div>
                      
                      {!ann.acknowledgedBy?.includes(auth.currentUser?.uid) && (
                        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                          <span className="flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                            No leído
                          </span>
                          <button
                            onClick={() => handleAcknowledgeAnnouncement(ann.id)}
                            className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-200"
                          >
                            Enterado
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'grades' ? (
            <div className="space-y-8">
              {students.length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center">
                  <p className="text-slate-400 font-medium">No hay alumnos vinculados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8">
                  {students.map((student, sIdx) => {
                    const studentGradeDocs = studentGrades.filter(g => g.studentId === student.id && g.cycleId === currentCycle?.id);
                    const studentLevelSubjects = subjects.filter(sub => sub.level === student.level);
                    const academicSubjectNames = studentLevelSubjects
                      .filter(s => s.category === 'Académica' || !s.category)
                      .map(s => s.name);
                    
                    // Calculate overall average correctly: only include academic subjects
                    const allAcademicGrades: number[] = [];
                    studentGradeDocs.forEach(g => {
                      if (g.subjects) {
                        academicSubjectNames.forEach(subName => {
                          const val = g.subjects[subName];
                          if (typeof val === 'number') {
                            allAcademicGrades.push(val);
                          }
                        });
                      }
                    });

                    const overallAverage = allAcademicGrades.length > 0 
                      ? (allAcademicGrades.reduce((a, b) => a + b, 0) / allAcademicGrades.length).toFixed(1) 
                      : '-';

                    return (
                      <motion.div 
                        key={student.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: sIdx * 0.1 }}
                        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                      >
                        {/* Header Section - More Compact */}
                        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-sm">
                              {student.name[0]}
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-slate-900 leading-none">{student.name}</h3>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {student.grade} {student.group} • {student.level}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="text-right">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">PROMEDIO ACADÉMICO</p>
                              <p className="text-lg font-black text-slate-900 leading-none tabular-nums">{overallAverage}</p>
                            </div>
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px]",
                              overallAverage === '-' ? "bg-slate-100 text-slate-300" :
                              Number(overallAverage) >= 9 ? "bg-emerald-500 text-white" :
                              Number(overallAverage) >= 8 ? "bg-blue-500 text-white" :
                              Number(overallAverage) >= 6 ? "bg-amber-500 text-white" :
                              "bg-rose-500 text-white"
                            )}>
                              {overallAverage === '-' ? '-' : Number(overallAverage) >= 9 ? 'A+' : Number(overallAverage) >= 8 ? 'B' : 'C'}
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
                            <thead>
                              <tr className="bg-white text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 border-b border-slate-50">
                                <th className="px-6 py-3 w-1/3">Materia</th>
                                <th className="px-2 py-3 text-center w-12">B1</th>
                                <th className="px-2 py-3 text-center w-12">B2</th>
                                <th className="px-2 py-3 text-center w-12">B3</th>
                                <th className="px-2 py-3 text-center w-12">B4</th>
                                <th className="px-2 py-3 text-center w-12">B5</th>
                                <th className="px-6 py-3 text-right w-24">Promedio</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {studentLevelSubjects.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic text-[10px]">
                                    No hay materias configuradas para este nivel.
                                  </td>
                                </tr>
                              ) : (
                                studentLevelSubjects.map((sub) => {
                                  const subjectGradesArr = studentGradeDocs.map(g => g.subjects?.[sub.name]).filter(g => typeof g === 'number');
                                  const subAverage = subjectGradesArr.length > 0 ? (subjectGradesArr.reduce((a, b) => (a as any) + (b as any), 0) / subjectGradesArr.length).toFixed(1) : '-';

                                  return (
                                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                                      <td className="px-6 py-3">
                                        <div className="flex flex-col">
                                          <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-1">{sub.category || 'Materia'}</span>
                                          <span className="text-xs font-semibold text-slate-700 truncate">{sub.name}</span>
                                        </div>
                                      </td>
                                      {[1, 2, 3, 4, 5].map(b => {
                                        const grade = studentGradeDocs.find(g => g.bimestre === b)?.subjects?.[sub.name];
                                        return (
                                          <td key={b} className="px-2 py-3 text-center">
                                            <span className={cn(
                                              "text-[10px] font-bold tabular-nums",
                                              grade === undefined ? "text-slate-200" :
                                              grade >= 9 ? "text-emerald-600" :
                                              grade >= 8 ? "text-blue-600" :
                                              grade >= 6 ? "text-amber-600" :
                                              "text-rose-600"
                                            )}>
                                              {grade !== undefined ? grade : '—'}
                                            </span>
                                          </td>
                                        );
                                      })}
                                      <td className="px-6 py-3 text-right">
                                        <span className={cn(
                                          "text-xs font-black tabular-nums",
                                          subAverage === '-' ? "text-slate-200" : "text-slate-900"
                                        )}>
                                          {subAverage}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'facturas' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                <section>
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                            <th className="px-8 py-5">Fecha</th>
                            <th className="px-8 py-5">Nombre</th>
                            <th className="px-8 py-5">Concepto</th>
                            <th className="px-8 py-5">Importe</th>
                            <th className="px-8 py-5">Estatus</th>
                            <th className="px-8 py-5 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {payments.map((payment) => {
                            const student = students.find(s => s.id === payment.studentId);
                            return (
                            <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-8 py-6 text-xs font-bold text-slate-500">
                                {payment.date?.toDate ? format(payment.date.toDate(), 'dd/MM/yyyy') : '-'}
                              </td>
                              <td className="px-8 py-6">
                                <p className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {student?.name || 'Alumno'}
                                </p>
                              </td>
                              <td className="px-8 py-6 text-xs font-medium text-slate-500">{payment.concept}</td>
                              <td className="px-8 py-6">
                                <p className="text-xs font-black text-slate-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                              </td>
                              <td className="px-8 py-6">
                                <span className={cn(
                                  "px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest border",
                                  payment.status === 'Pagado' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                  payment.status === 'Cancelado' ? "bg-rose-50 text-rose-700 border-rose-100" :
                                  "bg-amber-50 text-amber-700 border-amber-100"
                                )}>
                                  {payment.status}
                                </span>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {payment.status === 'Pendiente' && !payment.conektaOrderId && (
                                    <button
                                      onClick={() => handlePayment(payment)}
                                      disabled={payingId === payment.id}
                                      className="flex items-center gap-2 px-4 py-2 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                    >
                                      {payingId === payment.id ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
                                      Pagar
                                    </button>
                                  )}
                                  {payment.status === 'Pendiente' && payment.conektaOrderId && (
                                    <button
                                      onClick={() => handleVerifyPayment(payment)}
                                      disabled={payingId === payment.id}
                                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                    >
                                      {payingId === payment.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                      Verificar
                                    </button>
                                  )}
                                  {payment.invoiceId ? (
                                    <button 
                                      onClick={() => handleDownloadInvoice(payment.invoiceId!)}
                                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                                      title="Descargar Factura PDF"
                                    >
                                      <Download size={14} />
                                      PDF
                                    </button>
                                  ) : payment.status === 'Pagado' ? (
                                    <button 
                                      onClick={() => handleGenerateInvoice(payment)}
                                      disabled={payingId === payment.id}
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                      title="Generar Factura"
                                    >
                                      {payingId === payment.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                      Facturar
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )})}
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
                              {payment.invoiceId ? (
                                <button 
                                  onClick={() => handleDownloadInvoice(payment.invoiceId!)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"
                                >
                                  <Download size={12} /> PDF
                                </button>
                              ) : payment.status === 'Pagado' ? (
                                <button 
                                  onClick={() => handleGenerateInvoice(payment)}
                                  disabled={payingId === payment.id}
                                  className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg disabled:opacity-50"
                                >
                                  {payingId === payment.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                  Generar Factura
                                </button>
                              ) : null}
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
              </div>
            </div>
          ) : (
            <section>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden mb-12">
                <form onSubmit={handleSaveBillingData} className="p-10 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">RFC del Contribuyente</label>
                      <input 
                        required
                        type="text"
                        placeholder="XAXX010101000"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base font-black text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all uppercase font-mono tracking-widest shadow-inner shadow-slate-100"
                        value={billingData.rfc}
                        onChange={e => setBillingData({...billingData, rfc: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Código Postal Fiscal</label>
                      <input 
                        required
                        type="text"
                        maxLength={5}
                        placeholder="00000"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono tracking-widest shadow-sm"
                        value={billingData.zipCode}
                        onChange={e => setBillingData({...billingData, zipCode: e.target.value.replace(/\D/g, '')})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre o Razón Social (Mayúsculas)</label>
                    <input 
                      required
                      type="text"
                      placeholder="COMO APARECE EN CONSTANCIA"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all uppercase shadow-sm"
                      value={billingData.billingName}
                      onChange={e => setBillingData({...billingData, billingName: e.target.value.toUpperCase()})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Régimen Fiscal</label>
                    <div className="relative">
                      <select 
                        required
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none shadow-sm"
                        value={billingData.taxSystem}
                        onChange={e => setBillingData({...billingData, taxSystem: e.target.value})}
                      >
                        <option value="" className="text-slate-400">Seleccionar régimen...</option>
                        {TAX_SYSTEMS.map(sys => (
                          <option key={sys.id} value={sys.id}>{sys.id} - {sys.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-5 bg-blue-50 rounded-xl border border-blue-100 flex gap-4">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                      <AlertCircle className="text-blue-600" size={20} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Verificación Necesaria</p>
                      <p className="text-[10px] text-blue-800/70 leading-relaxed font-medium">
                        Debe ser idéntico a su Constancia de Situación Fiscal para evitar rechazos.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button 
                      type="submit"
                      disabled={savingBilling}
                      className="w-full sm:w-auto px-8 py-3 bg-slate-950 text-white rounded-xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 text-[10px]"
                    >
                      {savingBilling ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <>
                          <Save size={16} strokeWidth={2.5} />
                          Guardar Perfil Fiscal
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}
        </div>
      )}

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                    <History size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Historial de Pagos</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedStudent.name} {selectedStudent.lastName}</p>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                {payments.filter(p => p.studentId === selectedStudent.id).length > 0 ? (
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Concepto</th>
                          <th className="px-4 py-3 text-right">Monto</th>
                          <th className="px-4 py-3 text-center">Estatus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payments
                          .filter(p => p.studentId === selectedStudent.id)
                          .sort((a, b) => (b.date?.toMillis?.() || 0) - (a.date?.toMillis?.() || 0))
                          .map((payment) => (
                            <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 text-[10px] font-bold text-slate-400">
                                {payment.date?.toDate ? format(payment.date.toDate(), 'dd MMM yyyy', {locale: es}) : '-'}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-950">{payment.concept}</td>
                              <td className="px-4 py-3 text-xs font-black text-slate-950 text-right tabular-nums">{formatCurrency(payment.amount)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn(
                                  "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest inline-block",
                                  payment.status === 'Pagado' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                  payment.status === 'Cancelado' ? "bg-rose-50 text-rose-600 border border-rose-100" :
                                  "bg-amber-50 text-amber-600 border border-amber-100"
                                )}>
                                  {payment.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                      <CreditCard size={40} />
                    </div>
                    <p className="text-slate-900 font-bold text-lg">Sin pagos registrados</p>
                    <p className="text-slate-500 text-sm mt-2 font-medium">Los pagos de este alumno aparecerán aquí una vez que se realicen.</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-8 py-3 bg-slate-900 text-white text-sm font-bold tracking-wide rounded-xl shadow-sm hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <X size={18} />
                  Cerrar Historial
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl overflow-hidden text-center"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 mx-auto border border-blue-100">
                <FileText className="text-blue-600" size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">¿Requiere Factura?</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">
                Detectamos que falta información fiscal. 
                ¿Desea configurarla ahora para facturación automática?
              </p>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => {
                    setIsPromptModalOpen(false);
                    setActiveTab('billing');
                    setSearchParams({ tab: 'billing' });
                  }}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                >
                  Configurar ahora
                </button>
                <button 
                  onClick={dismissPrompt}
                  className="w-full py-2.5 bg-slate-50 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Más tarde
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
