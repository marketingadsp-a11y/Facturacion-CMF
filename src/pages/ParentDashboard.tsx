import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Student, Payment, AppSettings } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { User, CreditCard, FileText, Download, AlertCircle, CheckCircle2, Loader2, Calendar, LayoutDashboard, History } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';

export default function ParentDashboard() {
  const { userProfile } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser?.email) return;

    const sQuery = query(collection(db, 'students'), where('parentEmail', '==', auth.currentUser.email));
    const sUnsub = onSnapshot(sQuery, (snap) => {
      const sData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(sData);
      
      if (sData.length > 0) {
        const studentIds = sData.map(s => s.id);
        const pQuery = query(collection(db, 'payments'), where('studentId', 'in', studentIds), orderBy('date', 'desc'));
        const pUnsub = onSnapshot(pQuery, (pSnap) => {
          setPayments(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'payments');
        });
        return () => pUnsub();
      } else {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const setUnsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });

    return () => { sUnsub(); setUnsub(); };
  }, []);

  const handleDownloadInvoice = (invoiceId: string) => {
    if (!settings?.facturapiApiKey) return;
    const url = `/api/facturapi/invoice/${invoiceId}/pdf?apiKey=${settings.facturapiApiKey}`;
    window.open(url, '_blank');
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Portal de Padres</h1>
          <p className="text-slate-500">Bienvenido, {userProfile?.name}. Consulta el estatus de tus hijos.</p>
        </div>
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
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <LayoutDashboard size={20} className="text-blue-600" />
                Mis Hijos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {students.map((student, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={student.id} 
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 font-bold text-xl">
                        {student.name[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{student.name} {student.lastName}</h3>
                        <p className="text-xs text-slate-500">{student.grade} {student.group} • {student.level}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">CURP:</span>
                        <span className="font-medium text-slate-900">{student.curp || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Estatus:</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold text-[10px]">ACTIVO</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
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
                        <th className="px-6 py-4 text-right">Factura</th>
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
                          <td className="px-6 py-4 text-right">
                            {payment.invoiceId && (
                              <button 
                                onClick={() => handleDownloadInvoice(payment.invoiceId!)}
                                className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors"
                                title="Descargar Factura PDF"
                              >
                                <Download size={14} />
                              </button>
                            )}
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
    </div>
  );
}
