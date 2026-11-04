import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { AppUser } from '../../types';
import { cn } from '../../lib/utils';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Activity, 
  Clock, 
  Search, 
  Filter, 
  GraduationCap, 
  ShieldCheck, 
  UserCheck, 
  Wifi, 
  WifiOff, 
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface ActiveUsersMonitorProps {
  currentUserId?: string;
}

export default function ActiveUsersMonitor({ currentUserId }: ActiveUsersMonitorProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  // Filters
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Docente' | 'Administrador' | 'Control Escolar'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'online' | 'offline'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Subscribe to users collection in real time
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(list);
      setLoading(false);
    }, (error) => {
      console.error("Error loading users for presence monitor:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 2. Periodic timer to update relative elapsed times ("hace X min", duration) every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // 3. Helper: check if user is currently online (heartbeat within last 2.5 minutes)
  const isUserOnline = (user: AppUser): boolean => {
    if (!user.lastActiveAt?.toDate) return false;
    const lastActiveMs = user.lastActiveAt.toDate().getTime();
    return user.isOnline !== false && (now - lastActiveMs) < 2.5 * 60 * 1000;
  };

  // Helper: format login time
  const formatLoginTime = (user: AppUser): string => {
    if (!user.lastLoginAt?.toDate) return 'Sin registros';
    const date = user.lastLoginAt.toDate();
    const isToday = isSameDay(date, new Date(now));
    const timeStr = format(date, 'hh:mm a');
    return isToday ? `Hoy, ${timeStr}` : format(date, "d 'de' MMM, hh:mm a", { locale: es });
  };

  // Helper: format duration in current session
  const formatSessionDuration = (user: AppUser): string => {
    if (!user.lastLoginAt?.toDate) return '';
    const startMs = user.lastLoginAt.toDate().getTime();
    const diffMins = Math.floor(Math.max(0, now - startMs) / 60000);
    if (diffMins < 1) return 'Menos de 1 min';
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `${hours}h ${remMins}m`;
  };

  // Helper: format time elapsed since last active
  const formatLastActive = (user: AppUser): string => {
    if (!user.lastActiveAt?.toDate) return 'Sin actividad registrada';
    const activeDate = user.lastActiveAt.toDate();
    const diffMins = Math.floor(Math.max(0, now - activeDate.getTime()) / 60000);
    if (diffMins < 1) return 'Hace unos segundos';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} día${days > 1 ? 's' : ''}`;
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = users.length;
    const online = users.filter(u => isUserOnline(u)).length;
    const teachers = users.filter(u => u.role === 'Docente');
    const onlineTeachers = teachers.filter(u => isUserOnline(u)).length;
    const todayLogins = users.filter(u => u.lastLoginAt?.toDate && isSameDay(u.lastLoginAt.toDate(), new Date(now))).length;

    return {
      total,
      online,
      teachersCount: teachers.length,
      onlineTeachers,
      todayLogins
    };
  }, [users, now]);

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let result = users.filter(u => {
      // Role filter
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      // Status filter
      const online = isUserOnline(u);
      if (statusFilter === 'online' && !online) return false;
      if (statusFilter === 'offline' && online) return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const nameMatch = (u.name || '').toLowerCase().includes(term);
        const emailMatch = (u.email || '').toLowerCase().includes(term);
        const levelMatch = (u.assignedLevel || '').toLowerCase().includes(term);
        const roleMatch = (u.role || '').toLowerCase().includes(term);
        if (!nameMatch && !emailMatch && !levelMatch && !roleMatch) return false;
      }

      return true;
    });

    // Sort: Online users first, then by last active desc
    result.sort((a, b) => {
      const aOnline = isUserOnline(a);
      const bOnline = isUserOnline(b);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;

      const aActive = a.lastActiveAt?.toDate ? a.lastActiveAt.toDate().getTime() : 0;
      const bActive = b.lastActiveAt?.toDate ? b.lastActiveAt.toDate().getTime() : 0;
      return bActive - aActive;
    });

    return result;
  }, [users, roleFilter, statusFilter, searchTerm, now]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Docente':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Superadministrador':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Administrador':
        return 'bg-slate-900 text-white border-slate-900';
      case 'Control Escolar':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Cajero':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Recepción':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* 1. Header con indicador de actividad en vivo */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                Usuarios en Sesión y Monitoreo de Docentes
              </h3>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>En Vivo</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Visualiza en tiempo real qué docentes y usuarios han iniciado sesión, hora de ingreso y permanencia en la plataforma
            </p>
          </div>
        </div>

        {/* Resumen numérico rápido */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
            <div className="text-left">
              <span className="text-xs font-black text-slate-900">{metrics.online} en línea</span>
              <span className="text-[9px] text-slate-400 block font-bold leading-none">de {metrics.total} usuarios</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Métricas destacadas */}
      <div className="p-6 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/20">
        {/* Card 1: En Línea Ahora */}
        <button
          type="button"
          onClick={() => { setStatusFilter(statusFilter === 'online' ? 'ALL' : 'online'); }}
          className={cn(
            "p-4 rounded-xl border text-left transition-all cursor-pointer",
            statusFilter === 'online'
              ? "bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs"
              : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">En Línea Ahora</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wifi size={14} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{metrics.online}</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
              Activos
            </span>
          </div>
        </button>

        {/* Card 2: Docentes Conectados (Foco solicitado por el usuario) */}
        <button
          type="button"
          onClick={() => { 
            setRoleFilter(roleFilter === 'Docente' ? 'ALL' : 'Docente'); 
            setStatusFilter('online');
          }}
          className={cn(
            "p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden",
            roleFilter === 'Docente' && statusFilter === 'online'
              ? "bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
              : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Docentes en Línea</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <GraduationCap size={14} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-900 tabular-nums">{metrics.onlineTeachers}</span>
            <span className="text-[10px] font-bold text-slate-400">
              de {metrics.teachersCount} registrados
            </span>
          </div>
        </button>

        {/* Card 3: Ingresos Hoy */}
        <div className="p-4 rounded-xl border bg-white border-slate-200 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ingresos Hoy</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock size={14} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{metrics.todayLogins}</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
              Sesiones iniciadas
            </span>
          </div>
        </div>

        {/* Card 4: Total Personal */}
        <button
          type="button"
          onClick={() => { setRoleFilter('ALL'); setStatusFilter('ALL'); setSearchTerm(''); }}
          className={cn(
            "p-4 rounded-xl border text-left transition-all cursor-pointer",
            roleFilter === 'ALL' && statusFilter === 'ALL' && !searchTerm
              ? "bg-slate-50 border-slate-300 shadow-xs"
              : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Plantilla Completa</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users size={14} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{metrics.total}</span>
            <span className="text-[10px] font-bold text-slate-500">
              Cuentas activas
            </span>
          </div>
        </button>
      </div>

      {/* 3. Filtros y Búsqueda */}
      <div className="p-4 bg-slate-50/40 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Pills de rol */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter size={11} /> Filtrar:
          </span>
          <button
            type="button"
            onClick={() => setRoleFilter('ALL')}
            className={cn(
              "px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
              roleFilter === 'ALL'
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            )}
          >
            Todos ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('Docente')}
            className={cn(
              "px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
              roleFilter === 'Docente'
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700"
            )}
          >
            <GraduationCap size={13} />
            <span>Docentes ({metrics.teachersCount})</span>
            {metrics.onlineTeachers > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('Control Escolar')}
            className={cn(
              "px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
              roleFilter === 'Control Escolar'
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-blue-50"
            )}
          >
            Control Escolar
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('Administrador')}
            className={cn(
              "px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
              roleFilter === 'Administrador'
                ? "bg-slate-800 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            )}
          >
            Administración
          </button>
        </div>

        {/* Filtro de estado & Buscador */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shrink-0 shadow-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                statusFilter === 'ALL' ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('online')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1",
                statusFilter === 'online' ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>En Línea</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('offline')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                statusFilter === 'offline' ? "bg-slate-600 text-white" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Desconectados
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* 4. Lista interactiva de Usuarios y Docentes */}
      <div className="p-6">
        {loading ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold uppercase tracking-wider">Cargando estado de usuarios...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <WifiOff size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
              No se encontraron usuarios con los filtros seleccionados
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Prueba cambiando el rol o limpiando la barra de búsqueda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredUsers.map((user) => {
              const online = isUserOnline(user);
              const isCurrentUser = user.id === currentUserId;
              const hasLoggedIn = Boolean(user.lastLoginAt?.toDate);

              return (
                <div
                  key={user.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between group",
                    online
                      ? "bg-white border-emerald-300 shadow-sm shadow-emerald-100/50 hover:shadow-md hover:border-emerald-400"
                      : "bg-slate-50/60 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-sm"
                  )}
                >
                  {/* Barra superior de estado */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar con punto de presencia */}
                      <div className="relative shrink-0">
                        {user.photoUrl ? (
                          <img
                            src={user.photoUrl}
                            alt={user.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm uppercase shadow-xs",
                            online ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                          )}>
                            {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </div>
                        )}

                        {/* Indicador de estado */}
                        <span
                          className={cn(
                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white",
                            online
                              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse"
                              : "bg-slate-300"
                          )}
                          title={online ? "En línea ahora" : "Desconectado"}
                        />
                      </div>

                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-slate-900 truncate">
                            {user.name || 'Sin nombre'}
                          </h4>
                          {isCurrentUser && (
                            <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1 rounded">
                              Tú
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold truncate" title={user.email}>
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {/* Badge de Rol */}
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0",
                      getRoleBadgeColor(user.role)
                    )}>
                      {user.role}
                    </span>
                  </div>

                  {/* Asignación académica si es docente */}
                  {user.role === 'Docente' && (
                    <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-[10px] font-bold text-indigo-900 flex items-center gap-1.5 truncate">
                      <GraduationCap size={12} className="text-indigo-600 shrink-0" />
                      <span className="truncate">
                        {user.assignedLevel ? `${user.assignedLevel}` : 'Varios Niveles'}
                        {user.assignedGrade ? ` • ${user.assignedGrade}` : ''}
                        {user.assignedGroup ? ` "${user.assignedGroup}"` : ''}
                      </span>
                    </div>
                  )}

                  {/* Estado de Conexión & Tiempos */}
                  <div className="pt-2 border-t border-slate-100/80 space-y-1.5">
                    {online ? (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                            <Wifi size={13} className="text-emerald-500 animate-pulse" />
                            <span>En Línea Ahora</span>
                          </div>
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full">
                            Activo
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-semibold bg-emerald-50/40 p-2 rounded-lg border border-emerald-100">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Hora de Ingreso:</span>
                            <span className="text-slate-800 font-black">{formatLoginTime(user)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">Tiempo en Línea:</span>
                            <span className="text-emerald-700 font-black">{formatSessionDuration(user)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <WifiOff size={11} />
                            Desconectado
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {formatLastActive(user)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between bg-slate-100/70 p-1.5 rounded-lg font-semibold">
                          <span className="text-slate-400 text-[9px] uppercase">Último Ingreso:</span>
                          <span className="text-slate-700 font-bold">
                            {hasLoggedIn ? formatLoginTime(user) : 'Nunca ha ingresado'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

