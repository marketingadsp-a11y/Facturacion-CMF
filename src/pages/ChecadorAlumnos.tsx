import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, AppSettings, AppUser } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Trash2, 
  Link as LinkIcon, 
  Search,
  UserCheck,
  UserMinus,
  Calendar,
  X,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'react-toastify';

interface StudentAttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  level: string;
  grade: string;
  group: string;
  date: string;
  checkIn?: Timestamp;
  checkOut?: Timestamp;
  status: 'Asistió' | 'Falta';
  updatedAt?: Timestamp;
}

export default function ChecadorAlumnos() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('timeClock', 'manage');

  // Filters state
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Collections state
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isCopying, setIsCopying] = useState(false);

  // Load general settings
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as AppSettings);
      }
    });
    return unsubSettings;
  }, []);

  // Load students
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    });
    return unsubStudents;
  }, []);

  // Load users (to match parent names and phones)
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    });
    return unsubUsers;
  }, []);

  // Load attendance records for selected date
  useEffect(() => {
    const q = query(
      collection(db, 'student_attendance_records'),
      where('date', '==', selectedDate)
    );
    const unsubRecords = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentAttendanceRecord)));
    });
    return unsubRecords;
  }, [selectedDate]);

  // Set default level, grade, group on load if not set and settings loaded
  useEffect(() => {
    if (settings) {
      if (!selectedLevel && settings.academicLevels && settings.academicLevels.length > 0) {
        setSelectedLevel(settings.academicLevels[0]);
      }
      if (!selectedGrade && settings.academicGrades && settings.academicGrades.length > 0) {
        setSelectedGrade(settings.academicGrades[0]);
      }
      if (!selectedGroup && settings.academicGroups && settings.academicGroups.length > 0) {
        setSelectedGroup(settings.academicGroups[0]);
      }
    }
  }, [settings]);

  // Copy Public QR Kiosk Link
  const copyKioskLink = () => {
    const url = `${window.location.origin}/checador-kiosko-alumnos`;
    navigator.clipboard.writeText(url);
    setIsCopying(true);
    toast.success("Enlace del kiosko QR de alumnos copiado");
    setTimeout(() => setIsCopying(false), 2000);
  };

  // Toggle exit check-out tracking in settings
  const toggleTrackExit = async () => {
    if (!canManage) return;
    try {
      const currentVal = settings?.studentAttendanceTrackExit || false;
      await setDoc(doc(db, 'settings', 'general'), {
        studentAttendanceTrackExit: !currentVal
      }, { merge: true });
      toast.success(`Registro de salida ${!currentVal ? 'habilitado' : 'deshabilitado'}`);
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar la configuración");
    }
  };

  // Manual Check-in
  const handleManualCheckIn = async (student: Student) => {
    if (!canManage) return;
    const recordId = `${student.id}_${selectedDate}`;
    const recordRef = doc(db, 'student_attendance_records', recordId);
    
    try {
      await setDoc(recordRef, {
        studentId: student.id,
        studentName: `${student.lastName} ${student.motherLastName || ''} ${student.name}`.trim(),
        level: student.level,
        grade: student.grade,
        group: student.group || '',
        date: selectedDate,
        checkIn: serverTimestamp(),
        status: 'Asistió',
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success(`Entrada registrada para ${student.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar entrada");
    }
  };

  // Manual Check-out
  const handleManualCheckOut = async (student: Student) => {
    if (!canManage) return;
    const recordId = `${student.id}_${selectedDate}`;
    const recordRef = doc(db, 'student_attendance_records', recordId);
    
    try {
      await setDoc(recordRef, {
        checkOut: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success(`Salida registrada para ${student.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar salida");
    }
  };

  // Manual Absent
  const handleManualAbsent = async (student: Student) => {
    if (!canManage) return;
    const recordId = `${student.id}_${selectedDate}`;
    const recordRef = doc(db, 'student_attendance_records', recordId);
    
    try {
      await setDoc(recordRef, {
        studentId: student.id,
        studentName: `${student.lastName} ${student.motherLastName || ''} ${student.name}`.trim(),
        level: student.level,
        grade: student.grade,
        group: student.group || '',
        date: selectedDate,
        status: 'Falta',
        checkIn: null,
        checkOut: null,
        updatedAt: serverTimestamp()
      });
      toast.info(`${student.name} marcado con Falta`);
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar inasistencia");
    }
  };

  // Clear Attendance Record
  const handleClearRecord = async (student: Student) => {
    if (!canManage) return;
    const recordId = `${student.id}_${selectedDate}`;
    const recordRef = doc(db, 'student_attendance_records', recordId);
    
    try {
      await deleteDoc(recordRef);
      toast.info(`Registro de asistencia limpiado para ${student.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Error al limpiar registro");
    }
  };

  // Filters application
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => {
        // Class filters
        if (selectedLevel && s.level !== selectedLevel) return false;
        if (selectedGrade && s.grade !== selectedGrade) return false;
        if (selectedGroup && s.group !== selectedGroup) return false;
        
        // Search filter
        if (searchTerm) {
          const fullQuery = `${s.name} ${s.lastName} ${s.motherLastName || ''} ${s.matricula || ''}`.toLowerCase();
          return fullQuery.includes(searchTerm.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => `${a.lastName} ${a.name}`.localeCompare(`${b.lastName} ${b.name}`));
  }, [students, selectedLevel, selectedGrade, selectedGroup, searchTerm]);

  // Statistics calculation for the filtered group
  const stats = useMemo(() => {
    let total = filteredStudents.length;
    let attended = 0;
    let absent = 0;
    let pending = 0;

    filteredStudents.forEach(s => {
      const record = records.find(r => r.studentId === s.id);
      if (record) {
        if (record.status === 'Asistió') attended++;
        else if (record.status === 'Falta') absent++;
      } else {
        pending++;
      }
    });

    return { total, attended, absent, pending };
  }, [filteredStudents, records]);

  // Helper formatting for timestamps
  const formatTime = (ts: Timestamp | undefined) => {
    if (!ts) return '--:--';
    try {
      return format(ts.toDate(), 'hh:mm:ss a');
    } catch (e) {
      return '--:--';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section with branding & kiosk options */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic">
            Checador de Alumnos
            <span className="not-italic text-[9px] font-black px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md uppercase tracking-wider">Lector de Credenciales QR</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Visualiza las listas de asistencia de estudiantes y gestiona entradas/salidas diarias.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={copyKioskLink}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-sm transition-all"
          >
            {isCopying ? <CheckCircle2 size={14} className="text-emerald-500" /> : <LinkIcon size={14} />}
            Copiar Enlace Kiosko QR
          </button>
          
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Registrar Salidas</span>
            <button
              onClick={toggleTrackExit}
              disabled={!canManage}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings?.studentAttendanceTrackExit ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings?.studentAttendanceTrackExit ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and query bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fecha</label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nivel Educativo</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="">-- Todos los Niveles --</option>
              {settings?.academicLevels?.map(lvl => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grado</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="">-- Todos los Grados --</option>
              {settings?.academicGrades?.map(grd => (
                <option key={grd} value={grd}>{grd}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grupo</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="">-- Todos los Grupos --</option>
              {settings?.academicGroups?.map(grp => (
                <option key={grp} value={grp}>{grp}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Buscar Alumno</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre, Apellido, Matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
              <Search size={13} className="absolute left-2.5 top-3 text-slate-400" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alumnos Filtrados</span>
            <h3 className="text-xl font-black text-slate-900 leading-tight mt-0.5">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Asistieron (Entrada)</span>
            <h3 className="text-xl font-black text-slate-900 leading-tight mt-0.5">{stats.attended}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
            <XCircle size={22} />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faltas Registradas</span>
            <h3 className="text-xl font-black text-slate-900 leading-tight mt-0.5">{stats.absent}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center shrink-0">
            <HelpCircle size={22} />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin Registro</span>
            <h3 className="text-xl font-black text-slate-900 leading-tight mt-0.5">{stats.pending}</h3>
          </div>
        </div>
      </div>

      {/* Main Student Attendance List Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-55 border-b border-slate-200">
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Alumno</th>
                <th className="px-6 py-4">Nivel y Grupo</th>
                <th className="px-6 py-4">Tutor / Contacto</th>
                <th className="px-6 py-4">Hora Entrada</th>
                {settings?.studentAttendanceTrackExit && <th className="px-6 py-4">Hora Salida</th>}
                <th className="px-6 py-4 text-right">Acciones de Asistencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(student => {
                const record = records.find(r => r.studentId === student.id);
                const hasEntered = !!(record && record.status === 'Asistió' && record.checkIn);
                const hasExited = !!(record && record.status === 'Asistió' && record.checkOut);
                const isAbsent = !!(record && record.status === 'Falta');
                const parent = users.find(u => u.role === 'Padre' && u.email.toLowerCase().trim() === student.parentEmail?.toLowerCase().trim());

                return (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {student.photoUrl ? (
                          <img 
                            src={student.photoUrl} 
                            alt="Estudiante" 
                            className="w-9 h-9 rounded-full object-cover border border-slate-200" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs uppercase border border-indigo-100">
                            {student.name.charAt(0)}{student.lastName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-black text-slate-900 leading-none">
                            {student.lastName} {student.motherLastName || ''} {student.name}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold mt-1 font-mono">
                            M: {student.matricula || 'S/M'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {student.level} {student.grade}°"{student.group || ''}"
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {parent ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-900 leading-tight">
                            {parent.name}
                          </span>
                          {parent.phone ? (
                            <a 
                              href={`tel:${parent.phone}`} 
                              className="text-xs font-black text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 w-fit"
                            >
                              {parent.phone}
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic font-medium">
                              Sin teléfono
                            </span>
                          )}
                        </div>
                      ) : student.parentEmail ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-slate-500 font-medium italic">
                            Sin tutor vinculado
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {student.parentEmail}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic font-medium">
                          Sin tutor asignado
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isAbsent ? (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                          <XCircle size={10} /> Falta
                        </span>
                      ) : hasEntered ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                            <CheckCircle2 size={10} /> Ingresó
                          </span>
                          <span className="font-mono text-[10px] text-slate-700 font-bold ml-0.5">{formatTime(record.checkIn)}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          --:--
                        </span>
                      )}
                    </td>

                    {settings?.studentAttendanceTrackExit && (
                      <td className="px-6 py-4">
                        {isAbsent ? (
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                            <XCircle size={10} /> Falta
                          </span>
                        ) : hasExited ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit">
                              <CheckCircle2 size={10} /> Salió
                            </span>
                            <span className="font-mono text-[10px] text-slate-700 font-bold ml-0.5">{formatTime(record.checkOut)}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            --:--
                          </span>
                        )}
                      </td>
                    )}

                    <td className="px-6 py-4 text-right">
                      {canManage ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Entrada manual */}
                          <button
                            onClick={() => handleManualCheckIn(student)}
                            disabled={hasEntered || isAbsent}
                            className={`p-1.5 rounded-lg border transition-all ${
                              hasEntered 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 cursor-not-allowed opacity-50'
                                : 'bg-white text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/50 border-slate-200'
                            }`}
                            title="Marcar Entrada"
                          >
                            <UserCheck size={14} />
                          </button>

                          {/* Salida manual */}
                          {settings?.studentAttendanceTrackExit && (
                            <button
                              onClick={() => handleManualCheckOut(student)}
                              disabled={!hasEntered || hasExited || isAbsent}
                              className={`p-1.5 rounded-lg border transition-all ${
                                hasExited 
                                  ? 'bg-blue-50 text-blue-600 border-blue-100 cursor-not-allowed opacity-50'
                                  : (!hasEntered || isAbsent)
                                    ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                    : 'bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 border-slate-200'
                              }`}
                              title="Marcar Salida"
                            >
                              <Clock size={14} />
                            </button>
                          )}

                          {/* Falta manual */}
                          <button
                            onClick={() => handleManualAbsent(student)}
                            disabled={isAbsent}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isAbsent 
                                ? 'bg-rose-50 text-rose-600 border-rose-100 cursor-not-allowed opacity-50'
                                : 'bg-white text-slate-600 hover:text-rose-600 hover:bg-rose-50/50 border-slate-200'
                            }`}
                            title="Marcar Falta"
                          >
                            <UserMinus size={14} />
                          </button>

                          {/* Resetear / Limpiar fila */}
                          {record && (
                            <button
                              onClick={() => handleClearRecord(student)}
                              className="p-1.5 bg-white text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-350 rounded-lg transition-all"
                              title="Limpiar Registro de Hoy"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Lectura únicamente</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={settings?.studentAttendanceTrackExit ? 6 : 5}>
                    <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                      <Users size={32} className="opacity-20 mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No se encontraron alumnos para los filtros actuales</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
