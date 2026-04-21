import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { usePermissions } from '../hooks/usePermissions';
import { Student, StudentGrade, Bimestre } from '../types';
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
  AlertCircle
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'grading'>('grading');
  const [selectedBimestre, setSelectedBimestre] = useState<Bimestre>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

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

  const handleGradeChange = (studentId: string, field: string, value: any, isSubject: boolean = false) => {
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
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Guardar Bimestre {selectedBimestre}
          </button>
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
          onClick={() => setActiveTab('grading')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'grading' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <ClipboardList size={18} /> Calificaciones
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'students' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Users size={18} /> Mi Lista
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
                    <th className="px-6 py-4 sticky left-0 bg-slate-50 z-10 w-64 border-r border-slate-100">Alumno</th>
                    {SUBJECTS.map(subj => (
                      <th key={subj} className="px-4 py-4 text-center border-r border-slate-100 min-w-[100px]">{subj}</th>
                    ))}
                    <th className="px-4 py-4 text-center text-indigo-600 border-r border-slate-100">Conducta</th>
                    <th className="px-4 py-4 text-center text-indigo-600 border-r border-slate-100">Uniforme</th>
                    <th className="px-4 py-4 text-center text-red-600 border-r border-slate-100">Faltas</th>
                    <th className="px-4 py-4 text-center text-red-600 border-r border-slate-100">Tareas No Real.</th>
                    <th className="px-4 py-4 text-center text-red-600 border-r border-slate-100">Retardos</th>
                    <th className="px-4 py-4 text-center text-indigo-600">Aseo</th>
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
                        <td className="px-6 py-4 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {student.name.charAt(0)}{student.lastName.charAt(0)}
                            </div>
                            <div className="truncate">
                              <p className="text-sm font-bold text-slate-900 truncate leading-none mb-1">{student.lastName}</p>
                              <p className="text-[10px] text-slate-500 truncate">{student.name}</p>
                            </div>
                          </div>
                        </td>
                        {SUBJECTS.map(subj => (
                          <td key={subj} className="px-2 py-2 border-r border-slate-100">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={studentGrade.subjects?.[subj] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, subj, e.target.value, true)}
                              className="w-full bg-slate-50 border-none rounded-lg px-2 py-2 text-center text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="-"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={studentGrade.conduct ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'conduct', e.target.value)}
                            className="w-full bg-indigo-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={studentGrade.uniform ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'uniform', e.target.value)}
                            className="w-full bg-indigo-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            min="0"
                            value={studentGrade.attendance ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'attendance', e.target.value)}
                            className="w-full bg-red-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            min="0"
                            value={studentGrade.tasksNotDone ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'tasksNotDone', e.target.value)}
                            className="w-full bg-red-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100">
                          <input
                            type="number"
                            min="0"
                            value={studentGrade.tardies ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'tardies', e.target.value)}
                            className="w-full bg-red-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={studentGrade.cleanliness ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'cleanliness', e.target.value)}
                            className="w-full bg-indigo-50/30 border-none rounded-lg px-2 py-2 text-center text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {filteredStudents.map(student => (
            <div key={student.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg uppercase group-hover:scale-110 transition-transform">
                  {student.name.charAt(0)}{student.lastName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{student.lastName}</h3>
                  <p className="text-sm text-slate-500">{student.name}</p>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-slate-50">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-tight">CURP</span>
                  <span className="text-slate-700 font-mono font-bold uppercase">{student.curp || '-'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-tight">Email</span>
                  <span className="text-slate-700 font-bold truncate ml-4">{student.email || '-'}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <Users className="mx-auto text-slate-300 mb-2" size={40} />
              <p className="text-slate-500 font-medium tracking-tight">No se encontraron alumnos en este grupo.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
