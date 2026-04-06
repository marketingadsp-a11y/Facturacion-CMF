import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Payment } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Users, CreditCard, TrendingUp, AlertCircle, Clock, ShieldAlert, PlusCircle, History, ChevronRight } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { hasPermission, userProfile } = usePermissions();
  const [studentsCount, setStudentsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('Colegio México Franciscano');

  useEffect(() => {
    const studentsUnsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudentsCount(snap.size);
    });

    const paymentsUnsub = onSnapshot(
      query(collection(db, 'payments'), orderBy('date', 'desc'), limit(5)),
      (snap) => {
        const payments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setRecentPayments(payments);
      }
    );

    const revenueUnsub = onSnapshot(collection(db, 'payments'), (snap) => {
      const total = snap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setTotalRevenue(total);
      setLoading(false);
    });

    const settingsUnsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSchoolName(snap.data().schoolName || 'Colegio México Franciscano');
      }
    });

    return () => {
      studentsUnsub();
      paymentsUnsub();
      revenueUnsub();
      settingsUnsub();
    };
  }, []);

  const stats = [
    { name: 'Alumnos Inscritos', value: studentsCount, icon: Users, color: 'bg-blue-500' },
    { name: 'Ingresos Totales', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'bg-emerald-500' },
    { name: 'Pagos del Mes', value: recentPayments.length, icon: CreditCard, color: 'bg-indigo-500' },
  ];

  if (!hasPermission('dashboard', 'view')) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12">
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Sin Acceso al Dashboard</h2>
        <p className="text-slate-500 max-w-md">
          No tienes permisos para ver las estadísticas generales. 
          Utiliza el menú lateral para navegar a las secciones permitidas.
        </p>
      </div>
    );
  }

  // Cashier specific dashboard
  if (userProfile?.role === 'Cajero') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayPayments = recentPayments.filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : null;
      return pDate && pDate >= today && p.status === 'Pagado';
    });
    
    const todayTotal = todayPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

    return (
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Hola {userProfile?.name.split(' ')[0] || 'Cajero'}, ¡Buen día!
            </h1>
            <p className="text-slate-500 mt-1 text-lg">Panel de Control de Caja - {schoolName}</p>
          </div>
          <div className="bg-indigo-600 px-6 py-4 rounded-[2rem] text-white shadow-xl shadow-indigo-200 flex items-center gap-4">
            <div className="bg-white/20 p-2 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Cobrado Hoy</p>
              <p className="text-2xl font-black">{formatCurrency(todayTotal)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Link 
            to="/payments" 
            className="group bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-500 flex flex-col items-start gap-8 relative overflow-hidden"
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50" />
            
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-300 relative z-10">
              <PlusCircle size={40} />
            </div>
            <div className="space-y-3 relative z-10">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                Registrar Pago
                <ChevronRight size={24} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all" />
              </h3>
              <p className="text-slate-500 text-base leading-relaxed font-medium">
                Realiza cobros de colegiaturas, inscripciones y otros conceptos.
              </p>
            </div>
          </Link>

          <Link 
            to="/students" 
            className="group bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-500 flex flex-col items-start gap-8 relative overflow-hidden"
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50" />
            
            <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-300 relative z-10">
              <Users size={40} />
            </div>
            <div className="space-y-3 relative z-10">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                Alumnos
                <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-2 transition-all" />
              </h3>
              <p className="text-slate-500 text-base leading-relaxed font-medium">
                Consulta expedientes, estatus de pago y datos de contacto.
              </p>
            </div>
          </Link>

          <Link 
            to="/payments" 
            className="group bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-500 flex flex-col items-start gap-8 relative overflow-hidden"
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50" />
            
            <div className="w-20 h-20 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform duration-300 relative z-10">
              <History size={40} />
            </div>
            <div className="space-y-3 relative z-10">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                Historial
                <ChevronRight size={24} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-2 transition-all" />
              </h3>
              <p className="text-slate-500 text-base leading-relaxed font-medium">
                Revisa los ingresos del día, cancelaciones y facturación.
              </p>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <div className="w-2 h-8 bg-indigo-600 rounded-full" />
              Movimientos Recientes de Caja
            </h2>
            <Link to="/payments" className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-indigo-600 font-bold hover:bg-indigo-50 transition-all shadow-sm">
              Ver Historial Completo
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment) => (
                <div key={payment.id} className="p-6 flex items-center justify-between hover:bg-slate-50/80 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-md transition-all">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900">{payment.concept}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        {payment.date?.toDate ? format(payment.date.toDate(), 'PPp', { locale: es }) : 'Fecha desconocida'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-900">{formatCurrency(payment.amount)}</p>
                    <span className={cn(
                      "text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider",
                      payment.status === 'Pagado' ? "bg-emerald-100 text-emerald-700" : 
                      payment.status === 'Cancelado' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <Clock size={40} />
                </div>
                <p className="text-slate-400 font-medium">No hay movimientos registrados hoy.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola {userProfile?.name || 'Usuario'}, Bienvenido
        </h1>
        <p className="text-slate-500">Resumen general de {schoolName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={cn("p-4 rounded-2xl text-white", stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.name}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Payments */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock size={20} className="text-blue-600" />
              Pagos Recientes
            </h2>
            <Link to="/payments" className="text-sm text-blue-600 font-medium hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment) => (
                <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{payment.concept}</p>
                      <p className="text-xs text-slate-500">
                        {payment.date?.toDate ? format(payment.date.toDate(), 'PPp', { locale: es }) : 'Fecha desconocida'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold uppercase">
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400">
                No hay pagos registrados recientemente.
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions or Alerts */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-500" />
            Alertas y Recordatorios
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={20} />
              <div>
                <p className="text-sm font-semibold text-amber-900">Configuración de Facturapi</p>
                <p className="text-xs text-amber-700 mt-1">
                  Asegúrate de configurar tu API Key en la sección de Ajustes para emitir facturas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

