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
  Plus, Edit2, Trash2, AlertTriangle, X as XIcon, User, LayoutDashboard, Save
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
            { to: '/pagos', icon: PlusCircle, label: 'Registrar Pago', desc: 'Cobros y recibos', color: 'bg-indigo-600' },
            { to: '/alumnos', icon: Users, label: 'Consultar Alumnos', desc: 'Expedientes y estatus', color: 'bg-blue-600' },
            { to: '/pagos', icon: History, label: 'Historial de Caja', desc: 'Ingresos y cortes', color: 'bg-emerald-600' }
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
            <Link to="/pagos" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
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
              to="/alumnos" 
              colorClass="bg-rose-500" 
              delay={0.1}
              description="Expedientes, grupos y estatus"
            />
            <MenuButton 
              label="Control de Pagos" 
              icon={CreditCard} 
              to="/pagos" 
              colorClass="bg-emerald-500" 
              delay={0.2}
              description="Colegiaturas e inscripciones"
            />
            <MenuButton 
              label="Gestión de Padres" 
              icon={Users} 
              to="/padres" 
              colorClass="bg-blue-500" 
              delay={0.3}
              description="Vincular familias y accesos"
            />
            <MenuButton 
              label="Gastos y Egresos" 
              icon={TrendingDown} 
              to="/gastos" 
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
              to="/ajustes" 
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
              to="/alumnos" 
              color="text-indigo-600" 
              bg="bg-indigo-50" 
            />
            <QuickAction 
              icon={ShieldAlert} 
              label="Seguridad" 
              to="/ajustes?tab=users" 
              color="text-rose-600" 
              bg="bg-rose-50" 
            />
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Pagos Recientes</h3>
              <Link to="/pagos" className="text-[10px] font-bold text-blue-600 hover:underline">Ver todo</Link>
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
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden group"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Bell size={16} className="text-blue-600" />
                Avisos a Padres
              </h3>
              <button 
                onClick={() => setIsAnnModalOpen(true)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                Gestionar
                <ChevronRight size={12} />
              </button>
            </div>
            <div className="p-6">
              {announcements.length > 0 ? (
                <div className="space-y-4">
                  <div className={cn(
                    "p-4 rounded-2xl border relative overflow-hidden",
                    announcements[0].type === 'important' ? "bg-red-50 border-red-100" :
                    announcements[0].type === 'warning' ? "bg-orange-50 border-orange-100" :
                    "bg-blue-50 border-blue-100"
                  )}>
                    <div className="flex items-start gap-3 relative z-10">
                      <div className={cn(
                        "p-2 rounded-xl shrink-0",
                        announcements[0].type === 'important' ? "bg-red-100 text-red-600" :
                        announcements[0].type === 'warning' ? "bg-orange-100 text-orange-600" :
                        "bg-blue-100 text-blue-600"
                      )}>
                        {announcements[0].type === 'important' ? <AlertTriangle size={16} /> : 
                         announcements[0].type === 'warning' ? <AlertCircle size={16} /> : 
                         <Bell size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{announcements[0].title}</p>
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{announcements[0].content}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center font-medium">
                    {announcements.length} avisos activos en total
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <Bell size={24} />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">No hay avisos activos</p>
                  <button 
                    onClick={() => setIsAnnModalOpen(true)}
                    className="mt-3 text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    Crear primer aviso
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>


      <AnimatePresence>
        {isAnnModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200"
            >
              {/* Compact Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-sm">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">
                      Gestión de Avisos
                    </h2>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Panel Administrativo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAnnModalOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                >
                  <XIcon size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* Compact List Section */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 border-r border-slate-100">
                  <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial de Comunicados</h3>
                    <div className="flex gap-2">
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {announcements.length} Total
                      </span>
                    </div>
                  </div>

                  <div className="min-w-full">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-[53px] z-10 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">Aviso</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">Estado</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {announcements.map(ann => (
                          <tr 
                            key={ann.id} 
                            className={cn(
                              "group transition-colors",
                              editingAnn?.id === ann.id ? "bg-blue-50/50" : "bg-white hover:bg-slate-50/80"
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                                  ann.type === 'important' ? 'bg-red-50 text-red-600' :
                                  ann.type === 'warning' ? 'bg-orange-50 text-orange-600' :
                                  'bg-blue-50 text-blue-600'
                                )}>
                                  {ann.type === 'important' ? <AlertTriangle size={14} /> : 
                                   ann.type === 'warning' ? <AlertCircle size={14} /> : 
                                   <Bell size={14} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate max-w-[200px]">{ann.title}</p>
                                  <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{ann.content}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase w-fit",
                                  ann.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                )}>
                                  {ann.active ? 'Publicado' : 'Borrador'}
                                </span>
                                <span className="text-[8px] text-slate-300 font-medium">
                                  {ann.createdAt?.toDate ? format(ann.createdAt.toDate(), 'dd/MM/yy', { locale: es }) : 'Reciente'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setEditingAnn(ann);
                                    setAnnFormData(ann);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                                  title="Editar"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (window.confirm('¿Eliminar?')) {
                                      try {
                                        const { deleteDoc } = await import('firebase/firestore');
                                        await deleteDoc(doc(db, 'announcements', ann.id));
                                      } catch (error) {
                                        console.error("Error deleting announcement:", error);
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                  title="Eliminar"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {announcements.length === 0 && (
                      <div className="py-20 text-center">
                        <p className="text-slate-400 text-xs font-medium italic">No hay registros</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact Form Section */}
                <div className="w-full lg:w-[320px] p-5 bg-white overflow-y-auto">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {editingAnn ? 'Editar Registro' : 'Nuevo Registro'}
                    </h3>
                    {editingAnn && (
                      <button 
                        onClick={() => {
                          setEditingAnn(null);
                          setAnnFormData({ title: '', content: '', type: 'info', active: true });
                        }}
                        className="text-[9px] font-bold text-blue-600 hover:underline uppercase"
                      >
                        Nuevo
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Título del Aviso</label>
                      <input
                        required
                        value={annFormData.title}
                        onChange={(e) => setAnnFormData({...annFormData, title: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-xs font-bold placeholder:text-slate-300"
                        placeholder="Ej. Suspensión de clases"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mensaje Detallado</label>
                      <textarea
                        required
                        rows={4}
                        value={annFormData.content}
                        onChange={(e) => setAnnFormData({...annFormData, content: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none resize-none transition-all text-xs font-medium placeholder:text-slate-300 leading-relaxed"
                        placeholder="Escribe el mensaje aquí..."
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridad</label>
                        <div className="grid grid-cols-3 gap-1">
                          {(['info', 'warning', 'important'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setAnnFormData({...annFormData, type: t})}
                              className={cn(
                                "py-1.5 rounded-md text-[8px] font-black uppercase transition-all border",
                                annFormData.type === t 
                                  ? t === 'important' ? 'bg-red-600 text-white border-red-600' :
                                    t === 'warning' ? 'bg-orange-500 text-white border-orange-500' :
                                    'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                              )}
                            >
                              {t === 'info' ? 'Info' : t === 'warning' ? 'Aviso' : 'Urgente'}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Visibilidad</label>
                        <button
                          type="button"
                          onClick={() => setAnnFormData({...annFormData, active: !annFormData.active})}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all border flex items-center justify-between",
                            annFormData.active 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-slate-50 text-slate-500 border-slate-100'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full", annFormData.active ? "bg-emerald-500" : "bg-slate-400")} />
                            {annFormData.active ? 'Publicado' : 'Borrador'}
                          </span>
                          <div className={cn(
                            "w-6 h-3 rounded-full relative transition-colors",
                            annFormData.active ? "bg-emerald-500" : "bg-slate-300"
                          )}>
                            <div className={cn(
                              "absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all",
                              annFormData.active ? "right-0.5" : "left-0.5"
                            )} />
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={async () => {
                          if (!annFormData.title || !annFormData.content) {
                            alert('Completa los campos.');
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
                        className="w-full py-2.5 bg-blue-600 text-white font-black text-[10px] rounded-lg shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider"
                      >
                        {editingAnn ? <Save size={12} /> : <Plus size={12} />}
                        {editingAnn ? 'Actualizar' : 'Publicar'}
                      </button>
                    </div>
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

