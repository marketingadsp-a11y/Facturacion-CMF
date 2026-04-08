import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { Payment, Expense, Announcement } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Users, CreditCard, TrendingUp, AlertCircle, Clock, ShieldAlert, 
  PlusCircle, History, ChevronRight, ArrowUpRight, ArrowDownRight, 
  Calendar, FileText, Download, Wallet, GraduationCap, TrendingDown,
  PieChart as PieChartIcon, LogOut, Settings as SettingsIcon, Bell,
  Plus, Edit2, Trash2, AlertTriangle, X as XIcon, User, LayoutDashboard
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annFormData, setAnnFormData] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    type: 'info',
    active: true
  });
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

    const annUnsub = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')), (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });

    return () => {
      paymentsUnsub();
      expensesUnsub();
      settingsUnsub();
      annUnsub();
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
      <div className="space-y-6 pb-12">
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Control de Caja
              </h1>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                {schoolName} • {format(new Date(), 'dd MMMM, yyyy', { locale: es })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cobrado Hoy</p>
              <p className="text-xl font-black text-indigo-600 tabular-nums">{formatCurrency(todayTotal)}</p>
            </div>
            <div className="w-px h-8 bg-slate-100 hidden sm:block" />
            <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 flex items-center gap-2">
              <User size={14} className="text-indigo-600" />
              {userProfile?.name}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { to: '/payments', icon: PlusCircle, label: 'Registrar Pago', desc: 'Cobros y recibos', color: 'bg-indigo-600' },
            { to: '/students', icon: Users, label: 'Consultar Alumnos', desc: 'Expedientes y estatus', color: 'bg-blue-600' },
            { to: '/payments', icon: History, label: 'Historial de Caja', desc: 'Ingresos y cortes', color: 'bg-emerald-600' }
          ].map((action, i) => (
            <motion.div
              key={action.label}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link 
                to={action.to} 
                className="group bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-all duration-300 flex items-center gap-4 hover:border-indigo-200 hover:bg-indigo-50/30"
              >
                <div className={cn("w-12 h-12 text-white rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110", action.color)}>
                  <action.icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                    {action.label}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {action.desc}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden"
        >
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              Movimientos Recientes
            </h2>
            <Link to="/payments" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
              Ver todo
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment, i) => (
                <motion.div 
                  key={payment.id} 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 + (i * 0.05) }}
                  className="px-8 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-md transition-all">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{payment.concept}</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {payment.date?.toDate ? format(payment.date.toDate(), 'PPp', { locale: es }) : 'Fecha desconocida'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-slate-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                    <span className={cn(
                      "text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest mt-1 inline-block",
                      payment.status === 'Pagado' ? "bg-emerald-100 text-emerald-700" : 
                      payment.status === 'Cancelado' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {payment.status}
                    </span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-slate-400 font-medium text-sm">No hay movimientos registrados hoy.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Compact Header */}
      <motion.div 
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Panel de Control
            <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 uppercase tracking-widest">
              Admin
            </span>
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            {schoolName} • {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-xs font-bold text-slate-900">{userProfile?.name}</p>
            <p className="text-[10px] text-slate-400 font-medium">{userProfile?.role}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
            <User size={20} />
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      {(userProfile?.role === 'Superadministrador' || userProfile?.role === 'Administrador') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.concat({ 
            name: 'Alumnos Activos', 
            value: studentsCount.toString(), 
            icon: GraduationCap, 
            color: 'text-indigo-600', 
            bg: 'bg-indigo-50',
            trend: '+2.1%',
            trendUp: true
          }).map((stat, i) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                  <stat.icon size={20} />
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  stat.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                )}>
                  {stat.trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {stat.trend}
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.name}</p>
              <p className="text-xl font-black text-slate-900 tabular-nums">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Actions Area */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MenuButton 
              label="Gestión de Alumnos" 
              icon={Users} 
              to="/students" 
              colorClass="bg-rose-500" 
              delay={0.1}
              description="Expedientes, grupos y estatus"
            />
            <MenuButton 
              label="Control de Pagos" 
              icon={CreditCard} 
              to="/payments" 
              colorClass="bg-emerald-500" 
              delay={0.2}
              description="Colegiaturas e inscripciones"
            />
            <MenuButton 
              label="Gestión de Padres" 
              icon={Users} 
              to="/parents" 
              colorClass="bg-blue-500" 
              delay={0.3}
              description="Vincular familias y accesos"
            />
            <MenuButton 
              label="Gastos y Egresos" 
              icon={TrendingDown} 
              to="/expenses" 
              colorClass="bg-amber-500" 
              delay={0.4}
              description="Proveedores y servicios"
            />
          </div>

          {/* Chart Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Flujo de Efectivo</h3>
                <p className="text-[10px] text-slate-400 font-medium">Últimos 7 días de actividad</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Ingresos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Gastos</span>
                </div>
              </div>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ingresos" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorIngresos)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="gastos" 
                    stroke="#f43f5e" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorGastos)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Sidebar Area */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Access Grid */}
          <div className="grid grid-cols-2 gap-3">
            <QuickAction 
              icon={SettingsIcon} 
              label="Ajustes" 
              to="/settings" 
              color="text-slate-600" 
              bg="bg-slate-100" 
            />
            <QuickAction 
              icon={Bell} 
              label="Avisos" 
              onClick={() => setIsAnnModalOpen(true)}
              color="text-blue-600" 
              bg="bg-blue-50" 
            />
            <QuickAction 
              icon={FileText} 
              label="Reportes" 
              to="/students" 
              color="text-indigo-600" 
              bg="bg-indigo-50" 
            />
            <QuickAction 
              icon={ShieldAlert} 
              label="Seguridad" 
              to="/settings?tab=users" 
              color="text-rose-600" 
              bg="bg-rose-50" 
            />
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Pagos Recientes</h3>
              <Link to="/payments" className="text-[10px] font-bold text-blue-600 hover:underline">Ver todo</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {recentPayments.map((payment, i) => (
                <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                      <CreditCard size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">{payment.concept}</p>
                      <p className="text-[9px] text-slate-400 font-medium">
                        {payment.date?.toDate ? format(payment.date.toDate(), 'dd MMM', { locale: es }) : '---'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{formatCurrency(payment.amount)}</p>
                    <span className={cn(
                      "text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider",
                      payment.status === 'Pagado' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))}
              {recentPayments.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs italic">No hay pagos recientes.</div>
              )}
            </div>
          </div>

          {/* Announcements Preview */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 text-white shadow-lg shadow-blue-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <Bell size={80} />
            </div>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Bell size={16} />
              Último Aviso
            </h3>
            {announcements.length > 0 ? (
              <div>
                <p className="text-xs font-bold mb-1 line-clamp-1">{announcements[0].title}</p>
                <p className="text-[10px] text-blue-100 line-clamp-2 mb-4">{announcements[0].content}</p>
                <button 
                  onClick={() => setIsAnnModalOpen(true)}
                  className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-bold backdrop-blur-md transition-all"
                >
                  Gestionar Avisos
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-blue-100 italic">No hay avisos activos en este momento.</p>
            )}
          </div>
        </div>
      </div>


      <AnimatePresence>
        {isAnnModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Bell className="text-blue-600" />
                  Gestión de Avisos
                </h2>
                <button onClick={() => setIsAnnModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <XIcon size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* List Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800">Avisos Publicados</h3>
                    <button 
                      onClick={() => {
                        setEditingAnn(null);
                        setAnnFormData({ title: '', content: '', type: 'info', active: true });
                      }}
                      className="text-blue-600 text-sm font-bold hover:underline"
                    >
                      Limpiar Formulario
                    </button>
                  </div>
                  <div className="space-y-3">
                    {announcements.map(ann => (
                      <div key={ann.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            ann.type === 'important' ? 'bg-red-100 text-red-600' :
                            ann.type === 'warning' ? 'bg-orange-100 text-orange-600' :
                            'bg-blue-100 text-blue-600'
                          )}>
                            {ann.type === 'important' ? <AlertTriangle size={20} /> : 
                             ann.type === 'warning' ? <AlertCircle size={20} /> : 
                             <Bell size={20} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{ann.title}</p>
                            <p className="text-[10px] text-slate-500 line-clamp-1">{ann.content}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            ann.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          )}>
                            {ann.active ? 'Activo' : 'Inactivo'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingAnn(ann);
                                setAnnFormData(ann);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={async () => {
                                if (window.confirm('¿Estás seguro de eliminar este aviso?')) {
                                  try {
                                    const { deleteDoc } = await import('firebase/firestore');
                                    await deleteDoc(doc(db, 'announcements', ann.id));
                                  } catch (error) {
                                    console.error("Error deleting announcement:", error);
                                  }
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {announcements.length === 0 && (
                      <div className="py-12 text-center text-slate-400 italic text-sm">
                        No hay avisos registrados.
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Section */}
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6 self-start">
                  <h3 className="text-lg font-bold text-slate-800">
                    {editingAnn ? 'Editar Aviso' : 'Nuevo Aviso'}
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Título *</label>
                      <input
                        required
                        value={annFormData.title}
                        onChange={(e) => setAnnFormData({...annFormData, title: e.target.value})}
                        className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Ej. Suspensión de clases"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Contenido *</label>
                      <textarea
                        required
                        rows={4}
                        value={annFormData.content}
                        onChange={(e) => setAnnFormData({...annFormData, content: e.target.value})}
                        className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                        placeholder="Escribe el mensaje para los padres..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Tipo</label>
                        <select
                          value={annFormData.type}
                          onChange={(e) => setAnnFormData({...annFormData, type: e.target.value as any})}
                          className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                          <option value="info">Informativo</option>
                          <option value="warning">Advertencia</option>
                          <option value="important">Importante</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Estatus</label>
                        <button
                          type="button"
                          onClick={() => setAnnFormData({...annFormData, active: !annFormData.active})}
                          className={cn(
                            "w-full px-5 py-3 rounded-2xl text-xs font-black uppercase transition-all border",
                            annFormData.active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'
                          )}
                        >
                          {annFormData.active ? 'Publicado' : 'Borrador'}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (!annFormData.title || !annFormData.content) {
                          alert('Por favor completa los campos obligatorios.');
                          return;
                        }
                        try {
                          const { setDoc, addDoc, serverTimestamp } = await import('firebase/firestore');
                          if (editingAnn) {
                            await setDoc(doc(db, 'announcements', editingAnn.id), {
                              ...annFormData,
                              updatedAt: serverTimestamp()
                            }, { merge: true });
                          } else {
                            await addDoc(collection(db, 'announcements'), {
                              ...annFormData,
                              createdAt: serverTimestamp(),
                              createdBy: auth.currentUser?.uid
                            });
                          }
                          setEditingAnn(null);
                          setAnnFormData({ title: '', content: '', type: 'info', active: true });
                        } catch (error) {
                          console.error("Error saving announcement:", error);
                        }
                      }}
                      className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Plus size={20} />
                      {editingAnn ? 'Guardar Cambios' : 'Publicar Aviso'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function MenuButton({ label, icon: Icon, to, colorClass, delay, onClick, description }: { label: string, icon: any, to?: string, colorClass: string, delay: number, onClick?: () => void, description?: string }) {
  const content = (
    <div className="group relative overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:border-blue-200 hover:bg-blue-50/30 w-full text-left">
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shrink-0",
        colorClass
      )}>
        <Icon size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-800 tracking-tight group-hover:text-blue-700 transition-colors truncate">
          {label}
        </span>
        {description && (
          <span className="block text-[10px] text-slate-400 font-medium truncate">
            {description}
          </span>
        )}
      </div>
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
        <ChevronRight className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" size={16} />
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay, duration: 0.5, type: 'spring', stiffness: 100 }}
    >
      {to ? (
        <Link to={to} className="block">
          {content}
        </Link>
      ) : (
        <button onClick={onClick} className="w-full block">
          {content}
        </button>
      )}
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, to, onClick, color, bg }: { icon: any, label: string, to?: string, onClick?: () => void, color: string, bg: string }) {
  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group hover:border-blue-200 bg-white",
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-transform group-hover:scale-110", bg, color)}>
        <Icon size={20} />
      </div>
      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{label}</span>
    </div>
  );

  if (to) return <Link to={to} className="block">{content}</Link>;
  return <button onClick={onClick} className="block">{content}</button>;
}

