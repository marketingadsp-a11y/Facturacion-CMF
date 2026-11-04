import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { AppUser } from '../../types';
import { cn } from '../../lib/utils';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Users, 
  Clock, 
  Search, 
  Filter, 
  GraduationCap, 
  Wifi, 
  WifiOff
} from 'lucide-react';

interface ActiveUsersMonitorProps {
  currentUserId?: string;
}

export default function ActiveUsersMonitor({ currentUserId }: ActiveUsersMonitorProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  // Filters: DEFAULT TO 'online' AS REQUESTED
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'online' | 'offline'>('online');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Docente' | 'Administrador' | 'Control Escolar'>('ALL');
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

  // 2. Periodic timer to update relative elapsed times every 15 seconds
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
      {/* 1. Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
            ACTIVIDAD DOCENTE
          </h3>
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

      {/* 2. Filtros principales: Estado (Por defecto: EN LÍNEA) y Roles */}
      <div className="p-4 bg-slate-50/40 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Toggle de Estado: EN LÍNEA por defecto */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter size={11} /> Estado:
          </span>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('online')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                statusFilter === 'online'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 hover:bg-emerald-50"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>En Línea ({metrics.online})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                statusFilter === 'ALL'
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Todos ({metrics.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('offline')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                statusFilter === 'offline'
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <WifiOff size={12} />
              <span>Desconectados ({metrics.total - metrics.online})</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block mx-1" />

          {/* Filtro de Rol */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRoleFilter(roleFilter === 'Docente' ? 'ALL' : 'Docente')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
                roleFilter === 'Docente'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700"
              )}
            >
              <GraduationCap size={13} />
              <span>Solo Docentes ({metrics.teachersCount})</span>
              {metrics.onlineTeachers > 0 && (
                <span className="px-1.5 py-0.2 bg-emerald-400 text-emerald-950 font-black rounded-full text-[9px]">
                  {metrics.onlineTeachers} online
                </span>
              )}
            </button>

            {roleFilter !== 'ALL' && roleFilter !== 'Docente' && (
              <button
                type="button"
                onClick={() => setRoleFilter('ALL')}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Limpiar rol
              </button>
            )}
          </div>
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-64 shrink-0">
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

      {/* 3. Tabla compacta de Usuarios y Docentes (1 usuario por fila) */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold uppercase tracking-wider">Cargando usuarios...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/50">
            <WifiOff size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {statusFilter === 'online' 
                ? 'No hay usuarios en línea en este momento' 
                : 'No se encontraron usuarios con los filtros seleccionados'}
            </p>
            {statusFilter === 'online' && (
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className="mt-2 text-xs font-bold text-indigo-600 hover:underline uppercase tracking-wider cursor-pointer"
              >
                Ver todos los usuarios ({metrics.total})
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-3">Rol</th>
                <th className="py-3 px-3">Asignación / Materias</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-4">Hora de Ingreso</th>
                <th className="py-3 px-4">Tiempo en Sesión / Última Conexión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const online = isUserOnline(user);
                const isCurrentUser = user.id === currentUserId;
                const hasLoggedIn = Boolean(user.lastLoginAt?.toDate);

                return (
                  <tr
                    key={user.id}
                    className={cn(
                      "hover:bg-slate-50/80 transition-colors group",
                      online ? "bg-emerald-50/15" : "bg-white"
                    )}
                  >
                    {/* Columna 1: Usuario */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          {user.photoUrl ? (
                            <img
                              src={user.photoUrl}
                              alt={user.name}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                            />
                          ) : (
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs uppercase shadow-xs",
                              online ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                            )}>
                              {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </div>
                          )}

                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
                              online
                                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)] animate-pulse"
                                : "bg-slate-300"
                            )}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 truncate">
                              {user.name || 'Sin nombre'}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1 rounded">
                                Tú
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 truncate block">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Columna 2: Rol */}
                    <td className="py-3 px-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border inline-block whitespace-nowrap",
                        getRoleBadgeColor(user.role)
                      )}>
                        {user.role}
                      </span>
                    </td>

                    {/* Columna 3: Asignación Académica */}
                    <td className="py-3 px-3">
                      {user.role === 'Docente' ? (
                        <div className="text-[11px] font-semibold text-slate-700 max-w-xs truncate" title={user.assignedLevel || 'Docente'}>
                          <span className="text-indigo-700 font-bold">
                            {user.assignedLevel || 'Docente Asignado'}
                          </span>
                          {user.assignedGrade && <span> • {user.assignedGrade}</span>}
                          {user.assignedGroup && <span> "{user.assignedGroup}"</span>}
                          {user.teacherSubjectAccess === 'specific' && user.assignedSubjects?.length ? (
                            <span className="text-[10px] text-slate-400 block truncate">
                              ({user.assignedSubjects.length} materias específicas)
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">
                          Personal Administrativo
                        </span>
                      )}
                    </td>

                    {/* Columna 4: Estado */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {online ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>En Línea</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Desconectado</span>
                        </span>
                      )}
                    </td>

                    {/* Columna 5: Hora de Ingreso */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span>{formatLoginTime(user)}</span>
                      </div>
                    </td>

                    {/* Columna 6: Tiempo en Sesión / Última Actividad */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {online ? (
                        <div>
                          <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[10px]">
                            En línea: {formatSessionDuration(user)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-500 font-semibold text-[11px]">
                          <span>Última vez: {formatLastActive(user)}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
