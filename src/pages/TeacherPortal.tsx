import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { usePermissions } from '../hooks/usePermissions';
import { Student, StudentGrade, Bimestre, Attendance, AttendanceStatus, BimestreLock, Subject, AppSettings, SchoolCycle } from '../types';
import { 
  Users, 
  BookOpen, 
  Save, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Search,
  Filter,
  MoreVertical,
  ClipboardList,
  AlertCircle,
  Calendar,
  Lock,
  Unlock,
  Check,
  UserX,
  Clock as ClockIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function TeacherPortal() {
  const { userProfile, hasPermission } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, StudentGrade>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attendance' | 'grading'>('attendance');
  const [selectedBimestre, setSelectedBimestre] = useState<Bimestre>(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [isBimestreLocked, setIsBimestreLocked] = useState(false);
  const [adminSelectedLevel, setAdminSelectedLevel] = useState<string>('');
  const [adminSelectedGrade, setAdminSelectedGrade] = useState<string>('');
  const [adminSelectedGroup, setAdminSelectedGroup] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [currentCycleId, setCurrentCycleId] = useState('');

  // Fetch settings for cycle
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        setSettings(data);
        setCurrentCycleId(data.currentCycleId || '');
      }
    });
    return unsub;
  }, []);

  // Fetch subjects
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });
    return unsub;
  }, []);

  // Fetch students based on teacher's assignment
  useEffect(() => {
    if (!userProfile) return;

    // Teachers can only see their group
    // Admins can see everything based on search/filter
    let q = query(collection(db, 'students'), orderBy('lastName', 'asc'));

    const activeLevel = userProfile.role === 'Docente' ? userProfile.assignedLevel : adminSelectedLevel;
    const activeGrade = userProfile.role === 'Docente' ? userProfile.assignedGrade : adminSelectedGrade;
    const activeGroup = userProfile.role === 'Docente' ? userProfile.assignedGroup : adminSelectedGroup;

    if (activeLevel && activeGrade) {
      const filters = [
        where('level', '==', activeLevel),
        where('grade', '==', activeGrade)
      ];
      if (activeGroup) {
        filters.push(where('group', '==', activeGroup));
      }
      q = query(collection(db, 'students'), ...filters, orderBy('lastName', 'asc'));
    }

    const unsubStudents = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setLoading(false);
    });

    return () => unsubStudents();
  }, [userProfile]);

  // Fetch grades for the selected bimestre
  useEffect(() => {
    if (students.length === 0 || !currentCycleId) return;

    const unsubGrades = onSnapshot(
      query(
        collection(db, 'grades'), 
        where('bimestre', '==', selectedBimestre),
        where('cycleId', '==', currentCycleId)
      ),
      (snap) => {
        const gradesMap: Record<string, StudentGrade> = {};
        snap.docs.forEach(doc => {
          const data = doc.data() as StudentGrade;
          gradesMap[data.studentId] = { ...data, id: doc.id };
        });
        setGrades(gradesMap);
      }
    );

    return () => unsubGrades();
  }, [students, selectedBimestre, currentCycleId]);

  // Fetch lock status
  useEffect(() => {
    if (!userProfile || !currentCycleId) return;
    
    const lockId = `${selectedBimestre}_${userProfile.assignedLevel}_${userProfile.assignedGrade}_${userProfile.assignedGroup}_${currentCycleId}`;
    const unsubLock = onSnapshot(doc(db, 'bimestreLocks', lockId), (snap) => {
      setIsBimestreLocked(snap.exists() && snap.data().locked);
    });

    return () => unsubLock();
  }, [userProfile, selectedBimestre, currentCycleId]);

  // Fetch attendance for selected date
  useEffect(() => {
    if (students.length === 0 || !currentCycleId || activeTab !== 'attendance') return;

    const unsubAttendance = onSnapshot(
      query(
        collection(db, 'attendance'), 
        where('date', '==', selectedDate),
        where('cycleId', '==', currentCycleId)
      ),
      (snap) => {
        const attMap: Record<string, Attendance> = {};
        snap.docs.forEach(doc => {
          const data = doc.data() as Attendance;
          attMap[data.studentId] = { ...data, id: doc.id };
        });
        setAttendance(attMap);
      }
    );

    return () => unsubAttendance();
  }, [students, selectedDate, currentCycleId, activeTab]);

  const handleGradeChange = (studentId: string, field: string, value: any, isSubject: boolean = false) => {
    if (isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')) return;
    setGrades(prev => {
      const current = prev[studentId] || {
        studentId,
        bimestre: selectedBimestre,
        cycleId: '', // Will be updated on save or if already fetched
        subjects: {},
        conduct: 0,
        uniform: 0,
        attendance: 0,
        tasksNotDone: 0,
        tardies: 0,
        cleanliness: 0,
        updatedAt: serverTimestamp() as any,
        createdBy: userProfile?.id || ''
      };

      if (isSubject) {
        const next = {
          ...current,
          subjects: {
            ...current.subjects,
            [field]: parseFloat(value) || 0
          }
        };
        return { ...prev, [studentId]: next };
      }

      const next = {
        ...current,
        [field]: parseFloat(value) || 0
      };
      return { ...prev, [studentId]: next };
    });
  };

  const handleSaveAll = async () => {
    if (!hasPermission('grading', 'manage')) return;
    setIsSaving(true);
    try {
      const promises = Object.values(grades).map(grade => {
        const id = `${grade.studentId}_B${selectedBimestre}_${currentCycleId}`;
        return setDoc(doc(db, 'grades', id), {
          ...grade,
          cycleId: currentCycleId,
          updatedAt: serverTimestamp(),
          createdBy: userProfile?.id || 'system'
        });
      });
      await Promise.all(promises);
      setSavedStatus('¡Calificaciones guardadas!');
      setTimeout(() => setSavedStatus(null), 3000);
    } catch (error) {
      console.error("Error saving grades:", error);
      alert("Error al guardar calificaciones");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!userProfile || !currentCycleId) return;
    if (!window.confirm('¿Estás seguro de finalizar las calificaciones de este bimestre? Una vez finalizado, no podrás editarlas a menos que un administrador te habilite.')) return;

    setIsLocking(true);
    try {
      // First save everything
      await handleSaveAll();

      const lockId = `${selectedBimestre}_${userProfile.assignedLevel}_${userProfile.assignedGrade}_${userProfile.assignedGroup}_${currentCycleId}`;
      await setDoc(doc(db, 'bimestreLocks', lockId), {
        id: lockId,
        bimestre: selectedBimestre,
        level: userProfile.assignedLevel,
        grade: userProfile.assignedGrade,
        group: userProfile.assignedGroup,
        cycleId: currentCycleId,
        locked: true,
        lockedAt: serverTimestamp(),
        lockedBy: userProfile.id
      });
      setSavedStatus('¡Bimestre finalizado y bloqueado!');
    } catch (error) {
      console.error("Error locking bimestre:", error);
      alert("Error al finalizar bimestre");
    } finally {
      setIsLocking(false);
    }
  };

  const handleAttendanceToggle = async (studentId: string, newStatus: AttendanceStatus) => {
    if (!userProfile || !currentCycleId) return;

    const attId = `${studentId}_${selectedDate}`;
    try {
      await setDoc(doc(db, 'attendance', attId), {
        studentId,
        cycleId: currentCycleId,
        date: selectedDate,
        status: newStatus,
        updatedAt: serverTimestamp(),
        createdBy: userProfile.id
      });
    } catch (error) {
      console.error("Error saving attendance:", error);
    }
  };

  const filteredStudents = students.filter(s => {
    const fullName = `${s.name} ${s.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || s.curp?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (userProfile?.role === 'Docente' && (!userProfile.assignedLevel || !userProfile.assignedGrade)) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-center gap-4 text-amber-800">
        <AlertCircle className="shrink-0" size={32} />
        <div>
          <h2 className="font-bold text-lg">Configuración de Grupo Pendiente</h2>
          <p className="text-sm">Tu cuenta de docente aún no tiene un nivel, grado o grupo asignado. Pide al administrador que lo configure en los ajustes de usuario.</p>
        </div>
      </div>
    );
  }

  const presentCount = Object.values(attendance).filter(a => a.status === 'Asistió' || a.status === 'Retardo').length;
  const attendancePercentage = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

  const activeLevel = userProfile?.role === 'Docente' ? userProfile?.assignedLevel : adminSelectedLevel;
  const activeGrade = userProfile?.role === 'Docente' ? userProfile?.assignedGrade : adminSelectedGrade;
  const activeGroup = userProfile?.role === 'Docente' ? userProfile?.assignedGroup : adminSelectedGroup;

  // Filter subjects for the group level (case-insensitive and trimmed)
  const levelSubjects = subjects.filter(s => 
    s.level && activeLevel && 
    s.level.toLowerCase().trim() === activeLevel.toLowerCase().trim()
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header - Technical Utility */}
      <motion.div 
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200"
      >
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Portal Docente</h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1 opacity-60">
            {userProfile?.role === 'Docente' 
              ? `ASIGNACIÓN: ${activeLevel} - ${activeGrade}${activeGroup || ''}`
              : 'Gestión de Calificaciones y Asistencia'}
          </p>
        </div>

        {/* Admin level selection if no teacher assignment */}
        {userProfile?.role !== 'Docente' && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Seleccionar Grupo:</span>
            <select
              value={adminSelectedLevel}
              onChange={(e) => setAdminSelectedLevel(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="">Nivel</option>
              {settings?.academicLevels?.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={adminSelectedGrade}
              onChange={(e) => setAdminSelectedGrade(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="">Grado</option>
              {settings?.academicGrades?.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={adminSelectedGroup}
              onChange={(e) => setAdminSelectedGroup(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="">Grupo (Opcional)</option>
              {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}
        
        {activeTab === 'grading' && hasPermission('grading', 'manage') && (
          <div className="flex flex-wrap gap-2">
            {!isBimestreLocked && (
              <button
                onClick={handleFinalize}
                disabled={isLocking || isSaving}
                className="tech-button"
              >
                {isLocking ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
                ) : (
                  <Lock size={12} className="mr-1" />
                )}
                Finalizar Bimestre
              </button>
            )}
            {isBimestreLocked && (
              <div className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded border border-amber-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Lock size={12} />
                Bloqueado
              </div>
            )}
            <button
              onClick={handleSaveAll}
              disabled={isSaving || (isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || ''))}
              className="px-4 py-1.5 bg-white text-slate-900 border border-slate-200 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <Save size={12} />
              )}
              {isBimestreLocked ? 'Guardar (Admin)' : `Guardar B${selectedBimestre}`}
            </button>
          </div>
        )}
      </motion.div>

      {/* Metrics Row - Compact Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Matrícula Grupo</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-bold text-slate-900 tabular-nums lowercase">{students.length} <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">alumnos</span></p>
            <Users size={16} className="text-slate-200 mb-1" />
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Asistencia Real</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {attendancePercentage}% <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">({presentCount}/{students.length})</span>
            </p>
            <CheckCircle2 size={16} className="text-emerald-200 mb-1" />
          </div>
        </motion.div>

        {activeTab === 'grading' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between"
          >
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Bimestre Activo</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-slate-900 tabular-nums lowercase">{selectedBimestre} <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">periodo</span></p>
              <ClipboardList size={16} className="text-slate-200 mb-1" />
            </div>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Estado Ciclo</p>
          <div className="flex items-end justify-between">
            <p className="text-sm font-black text-slate-950 uppercase tracking-tight truncate max-w-[120px]">
              {isBimestreLocked ? 'Bloqueado' : 'Abierto para Edición'}
            </p>
            {isBimestreLocked ? <Lock size={16} className="text-amber-400 mb-1" /> : <Unlock size={16} className="text-emerald-400 mb-1" />}
          </div>
        </motion.div>
      </div>

      {savedStatus && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50 border border-emerald-100 p-2 rounded text-center"
        >
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest italic">{savedStatus}</span>
        </motion.div>
      )}

      {/* Tabs - Technical Strip */}
      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-md w-fit">
        <button
          onClick={() => setActiveTab('attendance')}
          className={cn(
            "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'attendance' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Calendar size={14} /> Asistencia
        </button>
        <button
          onClick={() => setActiveTab('grading')}
          className={cn(
            "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'grading' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <ClipboardList size={14} /> Calificaciones
        </button>
      </div>

      {activeTab === 'grading' ? (
        <div className="space-y-4">
          {/* Controls - Compact */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mx-2">Bimestre:</span>
              {[1, 2, 3, 4, 5].map((b) => (
                <button
                  key={b}
                  onClick={() => setSelectedBimestre(b as Bimestre)}
                  className={cn(
                    "w-7 h-7 rounded font-black text-[10px] transition-all",
                    selectedBimestre === b 
                      ? "bg-slate-900 text-white shadow-sm" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                placeholder="Filtrar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold w-full md:w-64 outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Grading Table - High Density */}
          <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-50/80 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="px-4 py-3 sticky left-0 bg-slate-50/95 z-10 w-56 border-r border-slate-200 backdrop-blur-sm">Identidad Alumno</th>
                    {levelSubjects.length > 0 ? levelSubjects.map(subj => (
                      <th key={subj.id} className="px-1 py-3 text-center border-r border-slate-200 min-w-[75px] max-w-[75px]">{subj.name.substring(0, 10)}...</th>
                    )) : (
                      <th className="px-4 py-3 border-r border-slate-200 text-amber-500 italic">Sin materias config. en Control Escolar</th>
                    )}
                    <th className="px-1 py-3 text-center border-r border-slate-200 w-16">Cond.</th>
                    <th className="px-1 py-3 text-center border-r border-slate-200 w-16">Unif.</th>
                    <th className="px-1 py-3 text-center border-r border-slate-200 w-16">Falt.</th>
                    <th className="px-1 py-3 text-center border-r border-slate-200 w-16">Tareas</th>
                    <th className="px-1 py-3 text-center border-r border-slate-200 w-16">Ret.</th>
                    <th className="px-1 py-3 text-center w-16">Aseo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-mono">
                  {filteredStudents.map((student) => {
                    const studentGrade = grades[student.id] || {
                      subjects: {},
                      conduct: 0,
                      uniform: 0,
                      attendance: 0,
                      tasksNotDone: 0,
                      tardies: 0,
                      cleanliness: 0
                    };

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-2 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[1px_0_4px_rgba(0,0,0,0.03)] backdrop-blur-sm group-hover:bg-slate-50/80">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded bg-slate-950 text-white flex items-center justify-center font-black text-[10px] shadow-sm shrink-0">
                              {student.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-slate-900 truncate tracking-tight uppercase leading-none">{student.lastName}</p>
                              <p className="text-[8px] font-bold text-slate-400 truncate uppercase mt-0.5">{student.name}</p>
                            </div>
                          </div>
                        </td>
                        {levelSubjects.map(subj => (
                          <td key={subj.id} className="px-1 py-1.5 border-r border-slate-50">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max="10"
                              step="0.1"
                              disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                              value={studentGrade.subjects?.[subj.name] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, subj.name, e.target.value, true)}
                              className="w-full bg-slate-50 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-slate-950 focus:bg-white focus:border-slate-400 outline-none disabled:opacity-30 transition-all tabular-nums italic"
                              placeholder="-"
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1.5 border-r border-slate-50">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.conduct ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'conduct', e.target.value)}
                            className="w-full bg-slate-50 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-slate-950 focus:bg-white focus:border-slate-400 outline-none transition-all italic tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-50">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.uniform ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'uniform', e.target.value)}
                            className="w-full bg-slate-50 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-slate-950 focus:bg-white focus:border-slate-400 outline-none transition-all italic tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-50">
                          <input
                            type="number"
                            min="0"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.attendance ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'attendance', e.target.value)}
                            className="w-full bg-slate-50 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-slate-950 focus:bg-white focus:border-slate-400 outline-none transition-all italic tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-50">
                          <input
                            type="number"
                            min="0"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.tasksNotDone ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'tasksNotDone', e.target.value)}
                            className="w-full bg-slate-50 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-slate-950 focus:bg-white focus:border-slate-400 outline-none transition-all italic tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-50">
                          <input
                            type="number"
                            min="0"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.tardies ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'tardies', e.target.value)}
                            className="w-full bg-slate-50 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-slate-950 focus:bg-white focus:border-slate-400 outline-none transition-all italic tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.cleanliness ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'cleanliness', e.target.value)}
                            className="w-full bg-slate-50 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-slate-950 focus:bg-white focus:border-slate-400 outline-none transition-all italic tabular-nums"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Attendance Controls - Compact */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-slate-200 rounded px-3 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-sm"
              />
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                placeholder="Filtrar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold w-full md:w-64 outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="px-6 py-3 w-12 text-center">RT</th>
                    <th className="px-6 py-3">Alumno / Identidad</th>
                    <th className="px-6 py-3 text-center">Registro de Asistencia</th>
                    <th className="px-6 py-3 hidden md:table-cell text-right pr-12">CURP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.map((student, index) => {
                    const att = attendance[student.id]?.status || 'Asistió';
                    
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-3 text-center text-[9px] font-black text-slate-300 tabular-nums">
                          {index + 1}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-black text-[10px] uppercase shadow-sm">
                              {student.lastName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-slate-900 tracking-tight uppercase leading-none">
                                {student.lastName} {student.name}
                              </p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Matrícula: {student.id.substring(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-center">
                            <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-md w-fit shadow-inner">
                              <button
                                onClick={() => handleAttendanceToggle(student.id, 'Asistió')}
                                className={cn(
                                  "px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1 border border-transparent",
                                  att === 'Asistió' 
                                    ? "bg-slate-900 text-white shadow-sm" 
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                <Check size={10} /> <span className="hidden sm:inline">Asistió</span>
                              </button>
                              <button
                                onClick={() => handleAttendanceToggle(student.id, 'Falta')}
                                className={cn(
                                  "px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1 border border-transparent",
                                  att === 'Falta' 
                                    ? "bg-rose-600 text-white shadow-sm" 
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                <UserX size={10} /> <span className="hidden sm:inline">Falta</span>
                              </button>
                              <button
                                onClick={() => handleAttendanceToggle(student.id, 'Retardo')}
                                className={cn(
                                  "px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1 border border-transparent",
                                  att === 'Retardo' 
                                    ? "bg-amber-500 text-white shadow-sm" 
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                <ClockIcon size={10} /> <span className="hidden sm:inline">Retardo</span>
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 hidden md:table-cell text-right pr-12">
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tabular-nums tracking-widest italic">{student.curp || 'S/N'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredStudents.length === 0 && (
              <div className="py-20 text-center bg-slate-50/20 italic">
                <Users className="mx-auto text-slate-200 mb-2 opacity-30" size={32} />
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin registros encontrados</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
