import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getCountFromServer, where, getDocs, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Payment, Expense, Announcement } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Users, CreditCard, TrendingUp, AlertCircle, Clock, ShieldAlert, 
  PlusCircle, History, ChevronRight, ArrowUpRight, ArrowDownRight, 
  Calendar, FileText, Download, Wallet, GraduationCap, TrendingDown,
  PieChart as PieChartIcon, LogOut, Settings as SettingsIcon, Bell,
  Plus, Edit2, Trash2, AlertTriangle, X as XIcon, User, LayoutDashboard, Save,
  CheckCircle2, Activity, UserRound, Heart, Banknote,
  FileBadge, ClipboardList, Presentation, SlidersHorizontal, BellRing, ArrowRight, Sparkles, Eye
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
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [selectedMetricsAnn, setSelectedMetricsAnn] = useState<Announcement | null>(null);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  
  // Specific role metrics
  const [pendingEnrollmentsCount, setPendingEnrollmentsCount] = useState(0);
  const [todayVisitsCount, setTodayVisitsCount] = useState(0);
  const [pendingVisitsCount, setPendingVisitsCount] = useState(0);
  const [parentsCount, setParentsCount] = useState(0);
  const [debtCount, setDebtCount] = useState(0);

  const [annFormData, setAnnFormData] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    type: 'info',
    active: true
  });
  const [schoolName, setSchoolName] = useState('Colegio México Franciscano');
  const [logoUrl, setLogoUrl] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<'default' | 'controlEscolar'>('default');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isSuperAdmin = userProfile?.role === 'Superadministrador' || userProfile?.email?.toLowerCase() === 'cramonmb@gmail.com';
  const restrictedLevels = useMemo(() => {
    if (isSuperAdmin) return [];
    if (userProfile?.restrictedLevels && userProfile.restrictedLevels.length > 0) {
      return userProfile.restrictedLevels;
    }
    if (userProfile?.assignedLevel) {
      return [userProfile.assignedLevel];
    }
    return [];
  }, [isSuperAdmin, userProfile?.restrictedLevels, userProfile?.assignedLevel]);

  const restrictedGrades = useMemo(() => isSuperAdmin ? [] : (userProfile?.restrictedGrades || []), [isSuperAdmin, userProfile?.restrictedGrades]);
  const restrictedGroups = useMemo(() => isSuperAdmin ? [] : (userProfile?.restrictedGroups || []), [isSuperAdmin, userProfile?.restrictedGroups]);

  useEffect(() => {
    // Fetch counts - filtered by assigned levels if user has restrictions
    const fetchCounts = async () => {
      try {
        let totalActiveStudents = 0;

        if (restrictedLevels.length > 0) {
          const targetLevels = new Set(restrictedLevels.map(l => l.toLowerCase().trim()));
          if (targetLevels.has('bachillerato')) targetLevels.add('preparatoria');
          if (targetLevels.has('preparatoria')) targetLevels.add('bachillerato');

          const studentsSnap = await getDocs(collection(db, 'students'));
          const matchingStudents = studentsSnap.docs.filter(d => {
            const data = d.data();
            const stLevel = (data.level || '').toLowerCase().trim();
            if (targetLevels.size > 0 && !targetLevels.has(stLevel)) return false;
            if (restrictedGrades.length > 0 && !restrictedGrades.includes(data.grade)) return false;
            if (restrictedGroups.length > 0 && !restrictedGroups.includes(data.group)) return false;
            return true;
          });
          totalActiveStudents = matchingStudents.length;
          setStudentsCount(totalActiveStudents);

          const enrollSnap = await getDocs(query(collection(db, 'enrollments'), where('status', '==', 'Pendiente')));
          const matchingEnrollments = enrollSnap.docs.filter(d => {
            const data = d.data();
            const enrLevel = (data.level || '').toLowerCase().trim();
            if (targetLevels.size > 0 && !targetLevels.has(enrLevel)) return false;
            if (restrictedGrades.length > 0 && !restrictedGrades.includes(data.grade)) return false;
            if (restrictedGroups.length > 0 && !restrictedGroups.includes(data.group)) return false;
            return true;
          });
          setPendingEnrollmentsCount(matchingEnrollments.length);

          const parentEmails = new Set(
            matchingStudents
              .map(d => (d.data().parentEmail || '').toLowerCase().trim())
              .filter(Boolean)
          );
          setParentsCount(parentEmails.size);
        } else {
          const studentsSnap = await getCountFromServer(collection(db, 'students'));
          totalActiveStudents = studentsSnap.data().count;
          setStudentsCount(totalActiveStudents);

          const parentsSnap = await getCountFromServer(query(collection(db, 'users'), where('role', '==', 'Padre')));
          setParentsCount(parentsSnap.data().count);

          const enrollmentsSnap = await getCountFromServer(
            query(collection(db, 'enrollments'), where('status', '==', 'Pendiente'))
          );
          setPendingEnrollmentsCount(enrollmentsSnap.data().count);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const visitsQuery = query(
          collection(db, 'reception_visits'),
          where('checkInTime', '>=', today)
        );
        const visitsSnap = await getDocs(visitsQuery);
        setTodayVisitsCount(visitsSnap.size);
        setPendingVisitsCount(visitsSnap.docs.filter(d => d.data().status === 'Pendiente').length);

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const startOfCurMonth = new Date(currentYear, currentMonth, 1);
        
        const paymentsThisMonth = await getDocs(query(
          collection(db, 'payments'), 
          where('date', '>=', startOfCurMonth),
          where('status', '==', 'Pagado'),
          where('type', '==', 'Colegiatura')
        ));
        
        const paidStudentIds = new Set(paymentsThisMonth.docs.map(d => d.data().studentId));
        setDebtCount(Math.max(0, totalActiveStudents - paidStudentIds.size));

      } catch (err) {
        console.error("Error fetching metrics:", err);
      }
    };

    fetchCounts();
  }, [userProfile, restrictedLevels, restrictedGrades, restrictedGroups]);

  useEffect(() => {

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
        const data = snap.data();
        setSchoolName(data.schoolName || 'Colegio México Franciscano');
        setLogoUrl(data.logoUrl || '');
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
      value: totalRevenue, 
      icon: TrendingUp, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      trend: '+12.3%',
      trendUp: true
    },
    { 
      name: 'Gastos Totales', 
      value: totalExpenses, 
      icon: TrendingDown, 
      color: 'text-red-600', 
      bg: 'bg-red-50',
      trend: '+5.4%',
      trendUp: false
    },
    { 
      name: 'Utilidad Neta', 
      value: netProfit, 
      icon: Activity, 
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
          className="w-20 h-20 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mb-6"
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
      <div className="space-y-8 pb-12 font-sans tracking-tight">
        {/* Header - Minimal Utility */}
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200"
        >
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Control de Caja
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-full border border-slate-200 shadow-sm">
             <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white">
                <User size={14} />
             </div>
             <div>
                <p className="text-xs font-bold text-slate-900 leading-none">{userProfile?.name}</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">Caja Principal</p>
             </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Stat & Actions (Left Col) */}
          <div className="lg:col-span-8 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }} 
              className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ingresos del Día</p>
                <h2 className="text-5xl font-light text-slate-900 tabular-nums">
                  {formatCurrency(todayTotal)}
                </h2>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-2 text-sm font-medium text-slate-500">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>{todayPayments.length} transacciones procesadas hoy</span>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { to: '/pagos', icon: PlusCircle, label: 'Registrar Cobro', desc: 'Recibir pago', bg: 'bg-slate-950', text: 'text-white', iconColor: 'text-slate-400' },
                { to: '/alumnos', icon: Users, label: 'Buscar Alumno', desc: 'Consultar estado', bg: 'bg-white', text: 'text-slate-900', border: 'border border-slate-200', iconColor: 'text-slate-400' }
              ].map((action, i) => (
                <motion.div
                  key={action.label}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + (i * 0.1) }}
                >
                  <Link 
                    to={action.to} 
                    className={cn(
                      "group p-5 rounded-lg flex items-center justify-between transition-all duration-300 hover:scale-[1.01] shadow-sm",
                      action.bg, action.border
                    )}
                  >
                    <div>
                      <action.icon size={24} className={cn("mb-4", action.iconColor)} />
                      <h3 className={cn("text-lg font-bold tracking-tight", action.text)}>
                        {action.label}
                      </h3>
                      <p className={cn("text-xs font-medium mt-1", action.text === 'text-white' ? 'text-slate-400' : 'text-slate-500')}>
                        {action.desc}
                      </p>
                    </div>
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-1",
                      action.text === 'text-white' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                    )}>
                      <ArrowUpRight size={18} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Movements (Right Col) */}
          <div className="lg:col-span-4">
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg border border-slate-200 shadow-sm h-full flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  Movimientos del Día
                </h3>
                <Link to="/pagos" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <History size={16} className="text-slate-400" />
                </Link>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {recentPayments.length > 0 ? (
                  recentPayments.map((payment, i) => (
                    <div 
                      key={payment.id} 
                      className="p-3 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{payment.concept}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-2">
                          <Clock size={12} className="opacity-50" />
                          {payment.date?.toDate ? format(payment.date.toDate(), 'HH:mm', { locale: es }) : '--:--'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                        <span className={cn(
                          "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest mt-1 inline-block",
                          payment.status === 'Pagado' ? "bg-emerald-50 text-emerald-600" : 
                          payment.status === 'Cancelado' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {payment.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <Wallet size={20} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No hay movimientos recientes</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    );
  }

  // Control Escolar specific dashboard
  if (userProfile?.role === 'Control Escolar' || (isSuperAdmin && viewMode === 'controlEscolar')) {
    const timeHoursMinutes = format(currentTime, 'hh:mm');
    const timeSeconds = format(currentTime, 'ss');
    const timeAmPm = format(currentTime, 'a', { locale: es }).replace(/\./g, '').toUpperCase();
    const rawDate = format(currentTime, "EEEE, d '/' MMMM '/' yyyy", { locale: es });
    const capitalizedDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
    const currentHour = currentTime.getHours();
    const timeGreeting = currentHour < 12 
      ? 'Buenos días' 
      : currentHour < 19 
        ? 'Buenas tardes' 
        : 'Buenas noches';
    const firstName = userProfile?.name?.split(' ')[0] || 'Coordinador(a)';

    const modules = [
      {
        id: 'control-escolar',
        title: 'Control Escolar y Boletas',
        icon: FileBadge,
        to: '/control-escolar',
        hasAccess: hasPermission('controlEscolar', 'view')
      },
      {
        id: 'alumnos',
        title: 'Expedientes de Alumnos',
        icon: GraduationCap,
        to: '/alumnos',
        hasAccess: hasPermission('students', 'view')
      },
      {
        id: 'horarios',
        title: 'Horarios Escolares',
        icon: Calendar,
        to: '/horarios',
        hasAccess: hasPermission('controlEscolar', 'view')
      },
      {
        id: 'docentes',
        title: 'Portal Docente y Evaluaciones',
        icon: Presentation,
        to: '/docentes',
        hasAccess: hasPermission('grading', 'view')
      },
      {
        id: 'checador-alumnos',
        title: 'Asistencia de Alumnos',
        icon: ClipboardList,
        to: '/checador-alumnos',
        hasAccess: hasPermission('timeClock', 'view')
      },
      {
        id: 'padres',
        title: 'Directorio de Familias',
        icon: Heart,
        to: '/padres',
        hasAccess: hasPermission('parents', 'view')
      },
      {
        id: 'recepcion',
        title: 'Recepción y Accesos',
        icon: BellRing,
        to: '/recepcion',
        hasAccess: hasPermission('reception', 'view')
      },
      {
        id: 'checador-admin',
        title: 'Checador de Personal',
        icon: Clock,
        to: '/checador-admin',
        hasAccess: hasPermission('timeClock', 'view')
      },
      {
        id: 'pagos',
        title: 'Caja y Pagos',
        icon: Banknote,
        to: '/pagos',
        hasAccess: hasPermission('payments', 'view')
      },
      {
        id: 'gastos',
        title: 'Gastos y Egresos',
        icon: TrendingDown,
        to: '/gastos',
        hasAccess: hasPermission('expenses', 'view')
      },
      {
        id: 'ajustes',
        title: 'Ajustes y Configuración',
        icon: SlidersHorizontal,
        to: '/ajustes',
        hasAccess: hasPermission('settings', 'view')
      }
    ];

    const availableModules = modules.filter(m => m.hasAccess);

    return (
      <div className="space-y-6 pb-16 font-sans tracking-tight max-w-[1600px] mx-auto">
        {/* Hero Banner with Welcome & Real-Time Digital Clock */}
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6 sm:p-8 shadow-xl overflow-hidden border border-slate-800"
        >
          {/* Subtle background ambient glow */}
          <div className="absolute -right-24 -top-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Column: Greeting with Logo */}
            <div className="space-y-3 max-w-2xl">
              {isSuperAdmin && (
                <div>
                  <button
                    onClick={() => setViewMode('default')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 hover:bg-blue-500/25 text-xs font-bold tracking-wide transition-colors cursor-pointer mb-2"
                    title="Volver al panel general de Administrador"
                  >
                    <Eye size={12} />
                    <span>Cambiar a Vista Admin</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-4 sm:gap-5">
                {/* School Logo */}
                {logoUrl ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2 sm:p-2.5 shadow-lg border border-white/20 shrink-0 flex items-center justify-center">
                    <img 
                      src={logoUrl} 
                      alt={schoolName || 'Logo'} 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shrink-0 flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-9 h-9 sm:w-10 sm:h-10 text-blue-300" />
                  </div>
                )}

                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                    ¡{timeGreeting}, {firstName}!
                  </h1>
                </div>
              </div>
            </div>

            {/* Right Column: Real-time Local Clock & Large Date Card */}
            <div className="shrink-0">
              <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-5 shadow-2xl min-w-[280px] sm:min-w-[340px]">
                {/* AM/PM */}
                <div className="flex items-center justify-end mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-blue-300 border border-slate-700 font-mono">
                    {timeAmPm}
                  </span>
                </div>

                {/* Digital Clock Display */}
                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight font-mono text-white tabular-nums drop-shadow-sm">
                    {timeHoursMinutes}
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-blue-400 tabular-nums">
                    :{timeSeconds}
                  </span>
                </div>

                {/* Calendar / Date row - Format: Martes, 20 / octubre / 2026 */}
                <div className="flex items-center gap-2.5 pt-3 mt-2 border-t border-slate-800">
                  <Calendar size={18} className="text-blue-400 shrink-0" />
                  <span className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                    {capitalizedDate}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Row - Clean Blue Tone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stat 1: Alumnos Activos */}
          <Link to="/alumnos" className="block group">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alumnos Activos</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <GraduationCap size={18} />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{studentsCount}</span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {restrictedLevels.length > 0 ? restrictedLevels.join(', ') : 'Todos'}
                </span>
              </div>
            </div>
          </Link>

          {/* Stat 2: Solicitudes de Ingreso */}
          <Link to="/control-escolar?tab=enrollments" className="block group">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solicitudes Ingreso</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform relative">
                  <Clock size={18} />
                  {pendingEnrollmentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{pendingEnrollmentsCount}</span>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                  pendingEnrollmentsCount > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                )}>
                  {pendingEnrollmentsCount > 0 ? 'Por revisar' : 'Al corriente'}
                </span>
              </div>
            </div>
          </Link>

          {/* Stat 3: Familias */}
          <Link to="/padres" className="block group">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Familias Vinculadas</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={18} />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{parentsCount}</span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {restrictedLevels.length > 0 ? `Nivel ${restrictedLevels.join(', ')}` : 'Padres'}
                </span>
              </div>
            </div>
          </Link>

          {/* Stat 4: Avisos Escolares */}
          <button 
            type="button" 
            onClick={() => setIsAnnModalOpen(true)}
            className="block group text-left w-full cursor-pointer"
          >
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avisos Escolares</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BellRing size={18} />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{announcements.filter(a => a.active).length}</span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Circulares activas
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* The Grid Menu of Accessible Options - Titles Only, No Tags, No Descriptions, Unified Blue Palette */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableModules.map((m, index) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 + index * 0.02 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
            >
              <Link
                to={m.to}
                className="group flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-400 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                    <m.icon size={22} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    {m.title}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 flex items-center justify-center transition-all shrink-0 ml-3 group-hover:translate-x-1">
                  <ArrowRight size={16} />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Noticeboard / Avisos Preview Section - Professional Blue Styling */}
        {hasPermission('announcements', 'view') && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <BellRing size={16} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    Avisos y Circulares Escolares
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Comunicados informativos vigentes para padres y personal escolar
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingAnn(null);
                    setAnnFormData({ title: '', content: '', type: 'info', active: true });
                    setIsAnnModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Nuevo Aviso</span>
                </button>
              </div>
            </div>

            <div className="mt-5">
              {announcements.filter(a => a.active).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {announcements.filter(a => a.active).slice(0, 6).map((ann) => {
                    const ackCount = ann.acknowledgedBy?.length || 0;
                    return (
                      <div 
                        key={ann.id}
                        className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-blue-300 transition-all flex flex-col justify-between group shadow-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200 tracking-wider">
                              {ann.type === 'important' ? 'Urgente' : ann.type === 'warning' ? 'Aviso' : 'Informativo'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {ann.createdAt?.toDate ? format(ann.createdAt.toDate(), 'dd MMM yyyy', { locale: es }) : 'Reciente'}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                            {ann.title}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                            {ann.content}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <button
                            onClick={() => {
                              setSelectedMetricsAnn(ann);
                              setIsMetricsModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-slate-500 hover:text-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Users size={12} className="text-blue-600" />
                            <span>{ackCount} enterados</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingAnn(ann);
                              setAnnFormData(ann);
                              setIsAnnModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Bell size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-500">No hay comunicados publicados actualmente</p>
                  <button
                    onClick={() => {
                      setEditingAnn(null);
                      setAnnFormData({ title: '', content: '', type: 'info', active: true });
                      setIsAnnModalOpen(true);
                    }}
                    className="mt-2 text-xs font-bold text-blue-600 hover:underline uppercase tracking-wider cursor-pointer"
                  >
                    Publicar el primer aviso
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shared Modals */}
        <AnnouncementManagementModal 
          isOpen={isAnnModalOpen}
          onClose={() => setIsAnnModalOpen(false)}
          announcements={announcements}
          editingAnn={editingAnn}
          setEditingAnn={setEditingAnn}
          annFormData={annFormData}
          setAnnFormData={setAnnFormData}
          onSelectMetrics={(ann) => {
            setSelectedMetricsAnn(ann);
            setIsMetricsModalOpen(true);
          }}
        />

        <MetricsModal 
          isOpen={isMetricsModalOpen} 
          onClose={() => setIsMetricsModalOpen(false)} 
          announcement={selectedMetricsAnn} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans tracking-tight max-w-[1600px] mx-auto">
      {/* Compact Header */}
      <motion.div 
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-200"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Sistema Operativo Conectado</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic">
            Dashboard
            <span className="not-italic text-[9px] font-black px-2 py-0.5 bg-slate-950 text-white rounded uppercase tracking-tighter leading-none inline-flex items-center h-4">
              {userProfile?.role}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <button
              onClick={() => setViewMode('controlEscolar')}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Eye size={13} />
              <span>Vista Control Escolar</span>
            </button>
          )}
          <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-slate-800">
              <Clock size={13} className="text-blue-600" />
              <span>{format(currentTime, 'hh:mm:ss a')}</span>
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                {format(currentTime, 'dd MMMM yyyy', { locale: es })}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      {(userProfile?.role === 'Superadministrador' || userProfile?.role === 'Administrador') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Alumnos Activos', value: studentsCount.toString(), icon: UserRound, color: 'text-slate-900', bg: 'bg-slate-100', isCurrency: false },
            { name: 'Ingresos Mes', value: totalRevenue, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', isCurrency: true },
            { name: 'Cuentas Familia', value: parentsCount.toString(), icon: Heart, color: 'text-blue-600', bg: 'bg-blue-50', isCurrency: false },
            { name: 'Cartera Vencida', value: debtCount.toString(), icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', isCurrency: false }
          ].map((stat, i) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="compact-card p-5 group hover:border-slate-300 transition-all border-slate-200"
            >
              <div className="flex items-start justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{stat.name}</p>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                  <stat.icon size={16} />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter">
                  {typeof stat.value === 'number' ? (stat.isCurrency ? formatCurrency(stat.value) : stat.value) : stat.value}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}


      {/* Recepción Metrics */}
      {userProfile?.role === 'Recepción' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="compact-card p-6 group hover:border-slate-300 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Visitantes Registrados Hoy</p>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 bg-slate-50 text-slate-900 border border-slate-100">
                <Users size={20} />
              </div>
            </div>
            <p className="text-4xl font-black text-slate-900 tabular-nums tracking-tighter italic">
              {todayVisitsCount}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="compact-card p-6 group hover:border-slate-300 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Visitas sin Salida</p>
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 border",
                pendingVisitsCount > 0 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
              )}>
                {pendingVisitsCount > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              </div>
            </div>
            <div className="flex items-center gap-4">
               <p className="text-4xl font-black text-slate-900 tabular-nums tracking-tighter italic">
                 {pendingVisitsCount}
               </p>
               {pendingVisitsCount > 0 && (
                 <div className="text-[9px] font-black px-2 py-0.5 rounded bg-rose-950 text-white uppercase tracking-tighter">
                   Atención requerida
                 </div>
               )}
            </div>
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Actions Area */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {hasPermission('students', 'view') && (
              <MenuButton 
                label="Gestión de Alumnos" 
                icon={UserRound} 
                to="/alumnos" 
                colorClass="bg-slate-950 text-white border border-slate-900" 
                iconClass="text-slate-400"
                delay={0.1}
                description="Expedientes, grupos y estatus"
              />
            )}
            {hasPermission('payments', 'view') && (
              <MenuButton 
                label="Control de Pagos" 
                icon={Banknote} 
                to="/pagos" 
                colorClass="bg-white border border-slate-200 text-slate-900" 
                iconClass="text-slate-400"
                textColor="text-slate-900"
                descColor="text-slate-500"
                arrowBg="bg-slate-50 text-slate-900 border border-slate-100 shadow-sm"
                delay={0.2}
                description="Colegiaturas e inscripciones"
              />
            )}
            {hasPermission('settings', 'manageUsers') && (
              <MenuButton 
                label="Gestión de Padres" 
                icon={Heart} 
                to="/padres" 
                colorClass="bg-white border border-slate-200 text-slate-900" 
                iconClass="text-slate-400"
                textColor="text-slate-900"
                descColor="text-slate-500"
                arrowBg="bg-slate-50 text-slate-900 border border-slate-100 shadow-sm"
                delay={0.3}
                description="Vincular familias y accesos"
              />
            )}
            {hasPermission('expenses', 'view') && (
              <MenuButton 
                label="Gastos y Egresos" 
                icon={TrendingDown} 
                to="/gastos" 
                colorClass="bg-white border border-slate-200 text-slate-900" 
                iconClass="text-slate-400"
                textColor="text-slate-900"
                descColor="text-slate-500"
                arrowBg="bg-slate-50 text-slate-900 border border-slate-100 shadow-sm"
                delay={0.4}
                description="Proveedores y servicios"
              />
            )}
          </div>

          {/* Chart Section */}
          {(hasPermission('payments', 'view') || hasPermission('expenses', 'view')) && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="compact-card p-6 border-slate-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-none">Actividad Financiera</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                    <span className="mono-label">Métrica: Últimos 7 días</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 px-3 py-1.5 rounded-lg border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ingresos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gastos</span>
                  </div>
                </div>
              </div>
              <div className="h-[260px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#020617" stopOpacity={0.05}/>
                          <stop offset="95%" stopColor="#020617" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: '1px solid #e2e8f0', 
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#0f172a',
                          textTransform: 'uppercase'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="ingresos" 
                        stroke="#020617" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorIngresos)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="gastos" 
                        stroke="#94a3b8" 
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fill="transparent" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Cargando datos financieros...</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar Area */}
        <div className="lg:col-span-4 space-y-8">
          {/* Quick Access Grid */}
          <div className="grid grid-cols-2 gap-4">
            {hasPermission('settings', 'view') && (
              <QuickAction 
                icon={SettingsIcon} 
                label="Ajustes" 
                to="/ajustes" 
                color="text-slate-600" 
                bg="bg-slate-100" 
              />
            )}
            {hasPermission('announcements', 'view') && (
              <QuickAction 
                icon={Bell} 
                label="Avisos" 
                onClick={() => setIsAnnModalOpen(true)}
                color="text-slate-900" 
                bg="bg-slate-200" 
              />
            )}
            {hasPermission('students', 'view') && (
              <QuickAction 
                icon={FileText} 
                label="Reportes" 
                to="/alumnos" 
                color="text-indigo-600" 
                bg="bg-indigo-50" 
              />
            )}
            {hasPermission('settings', 'manageUsers') && (
              <QuickAction 
                icon={ShieldAlert} 
                label="Seguridad" 
                to="/ajustes?tab=users" 
                color="text-slate-500" 
                bg="bg-slate-50" 
              />
            )}
          </div>

          {/* Recent Activity */}
          {hasPermission('payments', 'view') && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Pagos Recientes</h3>
                <Link to="/pagos" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <History size={14} className="text-slate-400" />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {recentPayments.map((payment, i) => (
                  <div key={payment.id} className="p-3 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{payment.concept}</p>
                        <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5">
                          <Clock size={10} className="opacity-50" />
                          {payment.date?.toDate ? format(payment.date.toDate(), 'HH:mm', { locale: es }) : '--:--'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest mt-1 inline-block",
                        payment.status === 'Pagado' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      )}>
                        {payment.status}
                      </span>
                    </div>
                  </div>
                ))}
                {recentPayments.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <Wallet size={20} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No hay pagos recientes</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Announcements Preview */}
          {hasPermission('announcements', 'view') && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden group flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Bell size={14} className="text-slate-400" />
                  Comunicados
                </h3>
                <button 
                  onClick={() => setIsAnnModalOpen(true)}
                  className="p-1.5 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <ChevronRight size={14} className="text-slate-400" />
                </button>
              </div>
              <div className="p-4">
                {announcements.length > 0 ? (
                  <div className="space-y-4">
                    <div className={cn(
                      "p-4 rounded-lg border relative overflow-hidden transition-all",
                      announcements[0].type === 'important' ? "bg-red-50 border-red-100" :
                      announcements[0].type === 'warning' ? "bg-orange-50 border-orange-100" :
                      "bg-slate-50 border-slate-200"
                    )}>
                      <div className="flex items-start gap-3 relative z-10">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                          announcements[0].type === 'important' ? "bg-red-100 text-red-600" :
                          announcements[0].type === 'warning' ? "bg-orange-100 text-orange-600" :
                          "bg-white text-slate-600 shadow-sm"
                        )}>
                          {announcements[0].type === 'important' ? <AlertTriangle size={16} /> : 
                           announcements[0].type === 'warning' ? <AlertCircle size={16} /> : 
                           <Bell size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{announcements[0].title}</p>
                          <p className="text-[10px] font-medium text-slate-500 line-clamp-2 mt-0.5 leading-tight">{announcements[0].content}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                        {announcements.length} avisos activos
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <Bell size={24} />
                    </div>
                    <p className="text-sm text-slate-500 font-bold mb-1">No hay avisos activos</p>
                    <button 
                      onClick={() => setIsAnnModalOpen(true)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest"
                    >
                      Crear primer aviso
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>


      <AnnouncementManagementModal 
        isOpen={isAnnModalOpen}
        onClose={() => setIsAnnModalOpen(false)}
        announcements={announcements}
        editingAnn={editingAnn}
        setEditingAnn={setEditingAnn}
        annFormData={annFormData}
        setAnnFormData={setAnnFormData}
        onSelectMetrics={(ann) => {
          setSelectedMetricsAnn(ann);
          setIsMetricsModalOpen(true);
        }}
      />

      <MetricsModal 
        isOpen={isMetricsModalOpen} 
        onClose={() => setIsMetricsModalOpen(false)} 
        announcement={selectedMetricsAnn} 
      />

    </div>
  );
}

function AnnouncementManagementModal({
  isOpen,
  onClose,
  announcements,
  editingAnn,
  setEditingAnn,
  annFormData,
  setAnnFormData,
  onSelectMetrics
}: {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
  editingAnn: Announcement | null;
  setEditingAnn: (ann: Announcement | null) => void;
  annFormData: Partial<Announcement>;
  setAnnFormData: React.Dispatch<React.SetStateAction<Partial<Announcement>>>;
  onSelectMetrics: (ann: Announcement) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200"
          >
            {/* Compact Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-950 text-white rounded-lg flex items-center justify-center shadow-sm">
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
                onClick={onClose} 
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
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
                        <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">Alcance</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {announcements.map(ann => {
                        const ackCount = ann.acknowledgedBy?.length || 0;
                        return (
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
                                <p className="text-xs font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">{ann.title}</p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px]">{ann.content}</p>
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
                          <td className="px-4 py-3">
                            <button 
                              onClick={() => onSelectMetrics(ann)}
                              className="flex items-center gap-1.5 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                              title="Ver Padres Enterados"
                            >
                              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <Users size={10} />
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="text-[10px] font-black text-slate-700 leading-none hover:text-emerald-600 transition-colors">{ackCount}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Enterados</span>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingAnn(ann);
                                  setAnnFormData(ann);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={async () => {
                                  if (window.confirm('¿Eliminar aviso?')) {
                                    try {
                                      await deleteDoc(doc(db, 'announcements', ann.id));
                                    } catch (error) {
                                      console.error("Error deleting announcement:", error);
                                    }
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )})}
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
                      className="text-[9px] font-bold text-blue-600 hover:underline uppercase cursor-pointer"
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
                              "py-1.5 rounded-md text-[8px] font-black uppercase transition-all border cursor-pointer",
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
                          "w-full px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all border flex items-center justify-between cursor-pointer",
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
                      className="w-full py-2.5 bg-blue-600 text-white font-black text-[10px] rounded-lg shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
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
  );
}

function MetricsModal({ isOpen, onClose, announcement }: { isOpen: boolean, onClose: () => void, announcement: Announcement | null }) {
  const [parents, setParents] = useState<{name: string, email: string}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchParents = async () => {
      if (!isOpen || !announcement || !announcement.acknowledgedBy || announcement.acknowledgedBy.length === 0) {
        setParents([]);
        return;
      }
      setLoading(true);
      try {
        const adminBatchSize = 10; // For chunking to avoid limits on 'in' queries
        const uids = announcement.acknowledgedBy;
        let fetchedParents: {name: string, email: string}[] = [];
        
        for (let i = 0; i < uids.length; i += adminBatchSize) {
          const chunk = uids.slice(i, i + adminBatchSize);
          const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
          const snap = await getDocs(q);
          const chunkData = snap.docs.map(d => ({ name: d.data().name || 'Desconocido', email: d.data().email || 'Sin correo' }));
          fetchedParents = [...fetchedParents, ...chunkData];
        }
        
        setParents(fetchedParents);
      } catch (error) {
        console.error("Error fetching acknowledged parents:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchParents();
  }, [isOpen, announcement]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-slate-200"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <Users size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Padres Enterados
              </h2>
              <p className="text-[9px] font-medium text-slate-400 capitalize tracking-wider truncate w-40">{announcement?.title}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
          >
            <XIcon size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 text-emerald-600"></div>
            </div>
          ) : parents.length > 0 ? (
            <ul className="space-y-2">
              {parents.map((p, i) => (
                <li key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <User size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">{p.name}</span>
                    <span className="text-[10px] text-slate-400">{p.email}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-400 text-xs font-medium italic">Nadie ha confirmado todavía.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function MenuButton({ 
  label, 
  icon: Icon, 
  to, 
  colorClass, 
  iconClass = "text-white",
  textColor = "text-slate-800",
  descColor = "text-slate-400",
  arrowBg = "bg-slate-50 text-slate-300",
  delay, 
  onClick, 
  description 
}: { 
  label: string, 
  icon: any, 
  to?: string, 
  colorClass: string, 
  iconClass?: string,
  textColor?: string,
  descColor?: string,
  arrowBg?: string,
  delay: number, 
  onClick?: () => void, 
  description?: string 
}) {
  const content = (
    <div className={cn("group relative overflow-hidden shadow-sm hover:shadow-md rounded-lg p-5 flex items-center justify-between transition-all duration-300 hover:scale-[1.01] w-full text-left", colorClass)}>
      <div>
        <Icon size={20} className={cn("mb-3", iconClass)} />
        <span className={cn("block text-base font-bold tracking-tight transition-colors truncate", textColor)}>
          {label}
        </span>
        {description && (
          <span className={cn("block text-[10px] font-black uppercase tracking-widest truncate mt-1", descColor)}>
            {description}
          </span>
        )}
      </div>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:translate-x-1 shrink-0", arrowBg)}>
        <ArrowUpRight size={14} />
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
      "flex flex-col items-center justify-center p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-all group hover:border-slate-900 bg-white",
    )}>
      <div className={cn("w-9 h-9 rounded-md flex items-center justify-center mb-2 transition-transform group-hover:scale-110", bg, color)}>
        <Icon size={18} />
      </div>
      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
    </div>
  );

  if (to) return <Link to={to} className="block">{content}</Link>;
  return <button onClick={onClick} className="block">{content}</button>;
}

