import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { usePermissions } from '../hooks/usePermissions';
import { Student, StudentGrade, Bimestre, Attendance, AttendanceStatus, BimestreLock } from '../types';
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

const SUBJECTS = [
  'Español',
  'Matemáticas',
  'Ciencias Naturales',
  'La Entidad Donde Vivo',
  'Formación Cívica y Ética',
  'Taller Lúdico'
];

export default function TeacherPortal() {
  const { userProfile, hasPermission } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, StudentGrade>>({});
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

  const [currentCycleId, setCurrentCycleId] = useState('');

  // Fetch settings for cycle
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setCurrentCycleId(snap.data().currentCycleId || '');
      }
    });
    return unsub;
  }, []);

  // Fetch students based on teacher's assignment
  useEffect(() => {
    if (!userProfile) return;

    // Teachers can only see their group
    // Admins can see everything based on search/filter (but for this portal we focus on the specific group if provided)
    let q = query(collection(db, 'students'), orderBy('lastName', 'asc'));

    if (userProfile.role === 'Docente') {
      if (userProfile.assignedLevel && userProfile.assignedGrade) {
        const filters = [
          where('level', '==', userProfile.assignedLevel),
          where('grade', '==', userProfile.assignedGrade)
        ];
        if (userProfile.assignedGroup) {
          filters.push(where('group', '==', userProfile.assignedGroup));
        }
        q = query(collection(db, 'students'), ...filters, orderBy('lastName', 'asc'));
      }
    }

    const unsubStudents = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setLoading(false);
    });

    return () => unsubStudents();
  }, [userProfile]);

  // Fetch grades for the selected bimestre
  useEffect(() => {
    if (students.length === 0) return;

    const unsubGrades = onSnapshot(
      query(collection(db, 'grades'), where('bimestre', '==', selectedBimestre)),
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
  }, [students, selectedBimestre]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portal Docente</h1>
          <p className="text-slate-500">
            {userProfile?.role === 'Docente' 
              ? `Gestionando: ${userProfile.assignedLevel} - ${userProfile.assignedGrade} ${userProfile.assignedGroup || ''}`
              : 'Gestión de Calificaciones'}
          </p>
        </div>
        
        {activeTab === 'grading' && hasPermission('grading', 'manage') && (
          <div className="flex gap-3">
            {!isBimestreLocked && (
              <button
                onClick={handleFinalize}
                disabled={isLocking || isSaving}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-100 disabled:opacity-50"
              >
                {isLocking ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Lock size={18} />
                )}
                Finalizar Bimestre
              </button>
            )}
            {isBimestreLocked && (
              <div className="px-6 py-2.5 bg-amber-100 text-amber-700 rounded-xl font-bold flex items-center gap-2 border border-amber-200">
                <Lock size={18} />
                Bimestre Bloqueado
              </div>
            )}
            <button
              onClick={handleSaveAll}
              disabled={isSaving || (isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || ''))}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isBimestreLocked ? 'Guardar Cambios (Admin)' : `Guardar Bimestre ${selectedBimestre}`}
            </button>
          </div>
        )}
      </div>

      {savedStatus && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700"
        >
          <CheckCircle2 size={20} />
          <span className="font-bold">{savedStatus}</span>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('attendance')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'attendance' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Calendar size={18} /> Asistencia
        </button>
        <button
          onClick={() => setActiveTab('grading')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'grading' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <ClipboardList size={18} /> Calificaciones
        </button>
      </div>

      {activeTab === 'grading' ? (
        <div className="space-y-6">
          {/* Bimestre Selector */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">Bimestre:</span>
            {[1, 2, 3, 4, 5].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBimestre(b as Bimestre)}
                className={cn(
                  "w-10 h-10 rounded-xl font-black text-sm transition-all border",
                  selectedBimestre === b 
                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" 
                    : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                )}
              >
                {b}
              </button>
            ))}
            
            <div className="flex-1" />
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                placeholder="Filtrar alumno..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm w-64"
              />
            </div>
          </div>

          {/* Grading Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 w-64 border-r border-slate-100 italic">Alumno</th>
                    {SUBJECTS.map(subj => (
                      <th key={subj} className="px-2 py-3 text-center border-r border-slate-100 min-w-[80px]">{subj}</th>
                    ))}
                    <th className="px-2 py-3 text-center text-indigo-600 border-r border-slate-100">Cond.</th>
                    <th className="px-2 py-3 text-center text-indigo-600 border-r border-slate-100">Unif.</th>
                    <th className="px-2 py-3 text-center text-red-600 border-r border-slate-100">Falt.</th>
                    <th className="px-2 py-3 text-center text-red-600 border-r border-slate-100">Tareas</th>
                    <th className="px-2 py-3 text-center text-red-600 border-r border-slate-100">Ret.</th>
                    <th className="px-2 py-3 text-center text-indigo-600">Aseo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
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
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                              {student.name.charAt(0)}{student.lastName.charAt(0)}
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-900 truncate leading-none mb-0.5">{student.lastName}</p>
                              <p className="text-[9px] text-slate-500 truncate">{student.name}</p>
                            </div>
                          </div>
                        </td>
                        {SUBJECTS.map(subj => (
                          <td key={subj} className="px-2 py-2 border-r border-slate-100">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max="10"
                              step="0.1"
                              disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                              value={studentGrade.subjects?.[subj] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, subj, e.target.value, true)}
                              className="w-full bg-slate-50 border-none rounded-lg px-2 py-2 text-center text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                              placeholder="-"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="10"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.conduct ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'conduct', e.target.value)}
                            className="w-full bg-indigo-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="10"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.uniform ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'uniform', e.target.value)}
                            className="w-full bg-indigo-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.attendance ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'attendance', e.target.value)}
                            className="w-full bg-red-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.tasksNotDone ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'tasksNotDone', e.target.value)}
                            className="w-full bg-red-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.tardies ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'tardies', e.target.value)}
                            className="w-full bg-red-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="10"
                            disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                            value={studentGrade.cleanliness ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'cleanliness', e.target.value)}
                            className="w-full bg-indigo-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
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
          {/* Attendance Controls */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Calendar size={18} />
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none"
              />
            </div>
            
            <div className="flex-1" />
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs w-48 md:w-64"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Alumno</th>
                    <th className="px-4 py-3 text-center">Estado de Asistencia</th>
                    <th className="px-4 py-3 hidden md:table-cell">CURP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.map((student, index) => {
                    const att = attendance[student.id]?.status || 'Asistió';
                    
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-2 text-center text-[10px] font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                              {student.name.charAt(0)}{student.lastName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                                {student.lastName} {student.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center">
                            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl w-fit">
                              <button
                                onClick={() => handleAttendanceToggle(student.id, 'Asistió')}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 border border-transparent",
                                  att === 'Asistió' 
                                    ? "bg-emerald-600 text-white border-emerald-500 shadow-sm" 
                                    : "text-slate-500 hover:bg-white"
                                )}
                              >
                                <Check size={12} /> <span className="hidden sm:inline">Asistió</span>
                              </button>
                              <button
                                onClick={() => handleAttendanceToggle(student.id, 'Falta')}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 border border-transparent",
                                  att === 'Falta' 
                                    ? "bg-red-600 text-white border-red-500 shadow-sm" 
                                    : "text-slate-500 hover:bg-white"
                                )}
                              >
                                <UserX size={12} /> <span className="hidden sm:inline">Falta</span>
                              </button>
                              <button
                                onClick={() => handleAttendanceToggle(student.id, 'Retardo')}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 border border-transparent",
                                  att === 'Retardo' 
                                    ? "bg-amber-500 text-white border-amber-400 shadow-sm" 
                                    : "text-slate-500 hover:bg-white"
                                )}
                              >
                                <ClockIcon size={12} /> <span className="hidden sm:inline">Retardo</span>
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 hidden md:table-cell">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">{student.curp || '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredStudents.length === 0 && (
              <div className="py-12 text-center bg-slate-50/50">
                <Users className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-slate-500 text-xs font-medium tracking-tight">No se encontraron alumnos.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
