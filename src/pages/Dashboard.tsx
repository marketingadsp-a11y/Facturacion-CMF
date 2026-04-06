import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Payment } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Users, CreditCard, TrendingUp, AlertCircle, Clock, ShieldAlert, 
  PlusCircle, History, ChevronRight, ArrowUpRight, ArrowDownRight, 
  Calendar, FileText, Download, Wallet, GraduationCap
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { hasPermission, userProfile } = usePermissions();
  const [studentsCount, setStudentsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('Colegio México Franciscano');

  useEffect(() => {
    const studentsUnsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudentsCount(snap.size);
    });

    const paymentsUnsub = onSnapshot(
      query(collection(db, 'payments'), orderBy('date', 'desc')),
      (snap) => {
        const payments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setAllPayments(payments);
        const total = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
        setTotalRevenue(total);
        setLoading(false);
      }
    );

    const settingsUnsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSchoolName(snap.data().schoolName || 'Colegio México Franciscano');
      }
    });

    return () => {
      studentsUnsub();
      paymentsUnsub();
      settingsUnsub();
    };
  }, []);

  const chartData = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    return last7Days.map(day => {
      const dayTotal = allPayments
        .filter(p => {
          const pDate = p.date?.toDate ? p.date.toDate() : null;
          return pDate && isSameDay(pDate, day) && p.status === 'Pagado';
        })
        .reduce((acc, p) => acc + (p.amount || 0), 0);

      return {
        name: format(day, 'EEE', { locale: es }),
        total: dayTotal
      };
    });
  }, [allPayments]);

  const recentPayments = useMemo(() => allPayments.slice(0, 5), [allPayments]);

  const stats = [
    { 
      name: 'Alumnos Inscritos', 
      value: studentsCount, 
      icon: Users, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      trend: '+2.5%',
      trendUp: true
    },
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
      name: 'Pagos del Mes', 
      value: allPayments.filter(p => {
        const pDate = p.date?.toDate ? p.date.toDate() : null;
        return pDate && pDate >= startOfMonth(new Date()) && pDate <= endOfMonth(new Date());
      }).length, 
      icon: CreditCard, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50',
      trend: '-1.2%',
      trendUp: false
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.name}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-6 relative overflow-hidden group hover:shadow-xl transition-all duration-500"
          >
            <div className="flex items-center justify-between relative z-10">
              <div className={cn("p-4 rounded-2xl", stat.bg, stat.color)}>
                <stat.icon size={28} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full",
                stat.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {stat.trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {stat.trend}
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{stat.name}</p>
              <p className="text-3xl font-black text-slate-900 mt-1 tabular-nums tracking-tight">{stat.value}</p>
            </div>
            <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-5 transition-transform duration-700 group-hover:scale-150", stat.bg)} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <div className="w-2.5 h-8 bg-emerald-500 rounded-full" />
                Ingresos Semanales
              </h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Comparativa de cobros en los últimos 7 días</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cobros</span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '15px'
                  }}
                  itemStyle={{ fontWeight: 800, color: '#10b981' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col"
        >
          <div className="p-10 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Clock size={24} className="text-blue-600" />
              Actividad
            </h2>
          </div>
          <div className="flex-1 divide-y divide-slate-50">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment, i) => (
                <div key={payment.id} className="p-6 flex items-center gap-4 hover:bg-slate-50 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-lg transition-all">
                    <CreditCard size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{payment.concept}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {payment.date?.toDate ? format(payment.date.toDate(), 'PP', { locale: es }) : '---'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{formatCurrency(payment.amount)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-20 text-center text-slate-400 font-bold">
                Sin actividad reciente.
              </div>
            )}
          </div>
          <Link to="/payments" className="p-6 text-center text-sm font-black text-blue-600 hover:bg-blue-50 transition-all border-t border-slate-100">
            Ver todos los pagos
          </Link>
        </motion.div>
      </div>

      {/* Quick Actions / Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="md:col-span-2 bg-slate-900 p-10 rounded-[3rem] text-white relative overflow-hidden group"
        >
          <div className="relative z-10">
            <h3 className="text-3xl font-black mb-4">Gestión de Alumnos</h3>
            <p className="text-slate-400 text-lg mb-8 max-w-md">Inscribe nuevos alumnos, gestiona sus expedientes y revisa su historial académico en segundos.</p>
            <Link to="/students" className="inline-flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-blue-50 transition-all">
              Ir a Alumnos
              <ChevronRight size={20} />
            </Link>
          </div>
          <Users size={200} className="absolute -right-10 -bottom-10 text-white/5 group-hover:scale-110 transition-transform duration-1000" />
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-indigo-600 p-10 rounded-[3rem] text-white flex flex-col justify-between group"
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <FileText size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black mb-2">Facturación</h3>
            <p className="text-indigo-100 text-sm font-medium mb-6">Emite facturas CFDI con un solo clic.</p>
            <Link to="/payments" className="text-white font-black flex items-center gap-2 hover:translate-x-2 transition-transform">
              Configurar
              <ChevronRight size={18} />
            </Link>
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-amber-200 transition-all"
        >
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <AlertCircle size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Ajustes</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">Personaliza ciclos y reglas de cobro.</p>
            <Link to="/settings" className="text-amber-600 font-black flex items-center gap-2 hover:translate-x-2 transition-transform">
              Ir a Ajustes
              <ChevronRight size={18} />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

