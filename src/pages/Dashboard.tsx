import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { Payment, Expense } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Users, CreditCard, TrendingUp, AlertCircle, Clock, ShieldAlert, 
  PlusCircle, History, ChevronRight, ArrowUpRight, ArrowDownRight, 
  Calendar, FileText, Download, Wallet, GraduationCap, TrendingDown,
  PieChart as PieChartIcon, LogOut, Settings as SettingsIcon
} from 'lucide-react';
import { auth } from '../firebase';
import { formatCurrency, cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { hasPermission, userProfile } = usePermissions();
  const [studentsCount, setStudentsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('Colegio México Franciscano');

  useEffect(() => {
    // Use getCountFromServer for students count to avoid fetching all documents
    const fetchStudentsCount = async () => {
      try {
        const coll = collection(db, 'students');
        const snapshot = await getCountFromServer(coll);
        setStudentsCount(snapshot.data().count);
      } catch (err) {
        console.error("Error fetching students count:", err);
      }
    };
    fetchStudentsCount();

    // For dashboard totals, we still need the data, but we can optimize the listeners
    const paymentsUnsub = onSnapshot(
      query(collection(db, 'payments'), orderBy('date', 'desc')),
      (snap) => {
        const payments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setAllPayments(payments);
        const total = payments.filter(p => p.status === 'Pagado').reduce((acc, p) => acc + (p.amount || 0), 0);
        setTotalRevenue(total);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    );

    const expensesUnsub = onSnapshot(
      query(collection(db, 'expenses'), orderBy('date', 'desc')),
      (snap) => {
        const expenses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        setAllExpenses(expenses);
        const total = expenses.filter(e => e.status === 'Pagado').reduce((acc, e) => acc + (e.amount || 0), 0);
        setTotalExpenses(total);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'expenses')
    );

    const settingsUnsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSchoolName(snap.data().schoolName || 'Colegio México Franciscano');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/general'));

    return () => {
      paymentsUnsub();
      expensesUnsub();
      settingsUnsub();
    };
  }, []);

  const chartData = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    return last7Days.map(day => {
      const dayIncome = allPayments
        .filter(p => {
          const pDate = p.date?.toDate ? p.date.toDate() : null;
          return pDate && isSameDay(pDate, day) && p.status === 'Pagado';
        })
        .reduce((acc, p) => acc + (p.amount || 0), 0);

      const dayExpense = allExpenses
        .filter(e => {
          const eDate = e.date?.toDate ? e.date.toDate() : null;
          return eDate && isSameDay(eDate, day) && e.status === 'Pagado';
        })
        .reduce((acc, e) => acc + (e.amount || 0), 0);

      return {
        name: format(day, 'EEE', { locale: es }),
        ingresos: dayIncome,
        gastos: dayExpense,
        utilidad: dayIncome - dayExpense
      };
    });
  }, [allPayments, allExpenses]);

  const recentPayments = useMemo(() => allPayments.slice(0, 5), [allPayments]);

  const netProfit = totalRevenue - totalExpenses;

  const stats = [
    { 
      name: 'Ingresos Totales', 
      value: formatCurrency(totalRevenue), 
      icon: TrendingUp, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      trend: '+12.3%',
      trendUp: true
    },
    { 
      name: 'Gastos Totales', 
      value: formatCurrency(totalExpenses), 
      icon: TrendingDown, 
      color: 'text-red-600', 
      bg: 'bg-red-50',
      trend: '+5.4%',
      trendUp: false
    },
    { 
      name: 'Utilidad Neta', 
      value: formatCurrency(netProfit), 
      icon: PieChartIcon, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      trend: netProfit >= 0 ? '+8.2%' : '-15%',
      trendUp: netProfit >= 0
    },
  ];

  if (!hasPermission('dashboard', 'view')) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mb-6"
        >
          <ShieldAlert size={40} />
        </motion.div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Sin Acceso al Dashboard</h2>
        <p className="text-slate-500 max-w-md text-lg">
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
    
    const todayPayments = allPayments.filter(p => {
      const pDate = p.date?.toDate ? p.date.toDate() : null;
      return pDate && pDate >= today && p.status === 'Pagado';
    });
    
    const todayTotal = todayPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

    return (
      <div className="space-y-10 pb-12">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Hola {userProfile?.name.split(' ')[0] || 'Cajero'}, ¡Buen día!
            </h1>
            <p className="text-slate-500 mt-1 text-xl font-medium">Panel de Control de Caja - {schoolName}</p>
          </div>
          <div className="bg-indigo-600 p-1 rounded-[2.5rem] shadow-2xl shadow-indigo-200">
            <div className="bg-white/10 backdrop-blur-md px-8 py-5 rounded-[2.4rem] text-white flex items-center gap-6 border border-white/20">
              <div className="bg-white/20 p-3 rounded-2xl">
                <Wallet size={28} />
              </div>
              <div>
                <p className="text-indigo-100 text-xs font-black uppercase tracking-widest">Cobrado Hoy</p>
                <p className="text-3xl font-black tabular-nums tracking-tight">{formatCurrency(todayTotal)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { to: '/payments', icon: PlusCircle, label: 'Registrar Pago', desc: 'Cobros de colegiaturas e inscripciones.', color: 'indigo' },
            { to: '/students', icon: Users, label: 'Alumnos', desc: 'Consulta expedientes y estatus de pago.', color: 'blue' },
            { to: '/payments', icon: History, label: 'Historial', desc: 'Revisa ingresos, cancelaciones y facturas.', color: 'emerald' }
          ].map((action, i) => (
            <motion.div
              key={action.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link 
                to={action.to} 
                className={cn(
                  "group bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 transition-all duration-500 flex flex-col items-start gap-8 relative overflow-hidden",
                  `hover:border-${action.color}-200 hover:shadow-2xl hover:shadow-${action.color}-100/50`
                )}
              >
                <div className={cn("absolute -right-8 -top-8 w-32 h-32 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50", `bg-${action.color}-50`)} />
                
                <div className={cn("w-20 h-20 text-white rounded-3xl flex items-center justify-center shadow-lg transition-transform duration-300 relative z-10 group-hover:scale-110", `bg-${action.color}-600 shadow-${action.color}-200`)}>
                  <action.icon size={40} />
                </div>
                <div className="space-y-3 relative z-10">
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    {action.label}
                    <ChevronRight size={24} className={cn("text-slate-300 group-hover:translate-x-2 transition-all", `group-hover:text-${action.color}-600`)} />
                  </h3>
                  <p className="text-slate-500 text-base leading-relaxed font-medium">
                    {action.desc}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden"
        >
          <div className="p-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-50/50">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
              <div className="w-2.5 h-10 bg-indigo-600 rounded-full" />
              Movimientos Recientes de Caja
            </h2>
            <Link to="/payments" className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm text-indigo-600 font-black hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-2">
              Ver Historial Completo
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment, i) => (
                <motion.div 
                  key={payment.id} 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 + (i * 0.05) }}
                  className="p-8 flex items-center justify-between hover:bg-slate-50/80 transition-all group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-xl transition-all duration-300">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">{payment.concept}</p>
                      <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                        <Calendar size={14} />
                        {payment.date?.toDate ? format(payment.date.toDate(), 'PPp', { locale: es }) : 'Fecha desconocida'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                    <span className={cn(
                      "text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest mt-2 inline-block",
                      payment.status === 'Pagado' ? "bg-emerald-100 text-emerald-700" : 
                      payment.status === 'Cancelado' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {payment.status}
                    </span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-24 text-center">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                  <Clock size={48} />
                </div>
                <p className="text-slate-400 font-bold text-xl">No hay movimientos registrados hoy.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Hola {userProfile?.name.split(' ')[0] || 'Usuario'}, Bienvenido
          </h1>
          <p className="text-slate-500 mt-1 text-xl font-medium">Resumen general de {schoolName}</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
          <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl text-sm font-black flex items-center gap-2">
            <Calendar size={16} />
            {format(new Date(), 'MMMM yyyy', { locale: es })}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
        {/* Left Column */}
        <div className="space-y-6">
          <MenuButton 
            label="ALUMNOS" 
            icon={Users} 
            to="/students" 
            colorClass="bg-rose-500 shadow-rose-500/40" 
            delay={0.1}
          />
          <MenuButton 
            label="COLEGIATURAS" 
            icon={CreditCard} 
            to="/payments" 
            colorClass="bg-emerald-500 shadow-emerald-500/40" 
            delay={0.2}
          />
          <MenuButton 
            label="CALIFICACIONES" 
            icon={FileText} 
            to="/students" 
            colorClass="bg-amber-500 shadow-amber-500/40" 
            delay={0.3}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <MenuButton 
            label="CONFIGURAR CURSOS" 
            icon={GraduationCap} 
            to="/settings?tab=courses" 
            colorClass="bg-slate-700 shadow-slate-700/40" 
            delay={0.15}
          />
          <MenuButton 
            label="LISTADOS" 
            icon={FileText} 
            to="/students" 
            colorClass="bg-slate-600 shadow-slate-600/40" 
            delay={0.25}
          />
          <MenuButton 
            label="UTILERIAS" 
            icon={SettingsIcon} 
            to="/settings" 
            colorClass="bg-slate-500 shadow-slate-500/40" 
            delay={0.35}
          />
          <MenuButton 
            label="PROFESORES" 
            icon={Users} 
            to="/students" 
            colorClass="bg-slate-400 shadow-slate-400/40" 
            delay={0.45}
          />
        </div>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex justify-center mt-10"
      >
        <button 
          onClick={() => auth.signOut()}
          className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-2xl hover:border-slate-300 rounded-[2rem] p-6 flex items-center justify-center gap-4 w-full max-w-md transition-all duration-500"
        >
          <div className="absolute inset-0 bg-slate-900 opacity-0 group-hover:opacity-5 transition-opacity duration-500" />
          <div className="w-12 h-12 bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
            <LogOut size={24} />
          </div>
          <span className="text-xl font-black text-slate-800 tracking-tight">
            SALIR DEL MAPN
          </span>
        </button>
      </motion.div>

    </div>
  );
}

function MenuButton({ label, icon: Icon, to, colorClass, delay }: { label: string, icon: any, to: string, colorClass: string, delay: number }) {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay, duration: 0.5, type: 'spring', stiffness: 100 }}
    >
      <Link 
        to={to} 
        className="group relative overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-2xl rounded-[2.5rem] p-6 flex items-center justify-between transition-all duration-500 hover:-translate-y-1 block"
      >
        <div className="flex items-center gap-6 relative z-10">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
            colorClass
          )}>
            <Icon size={32} />
          </div>
          <span className="text-xl font-black text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors">
            {label}
          </span>
        </div>
        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors relative z-10">
          <ChevronRight className="text-slate-400 group-hover:text-slate-800 group-hover:translate-x-1 transition-all duration-500" size={24} />
        </div>
      </Link>
    </motion.div>
  );
}

