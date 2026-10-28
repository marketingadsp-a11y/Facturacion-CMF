import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject } from '../types';
import { getLevelEvaluationConfig, isObservationsLevel, isPureAcademicSubject, isStudentEnrolledInSubject } from '../lib/evaluationUtils';
import { 
  X, 
  Save, 
  Printer, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle2, 
  BookOpen,
  Calendar,
  User
} from 'lucide-react';
import { toast } from 'react-toastify';
import { usePermissions } from '../hooks/usePermissions';

interface StudentObservationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  cycle: SchoolCycle | null;
  settings: AppSettings | null;
  subjects: Subject[];
  onSaved?: () => void;
}



export default function StudentObservationsModal({
  isOpen,
  onClose,
  student,
  cycle,
  settings,
  subjects,
  onSaved
}: StudentObservationsModalProps) {
  const { userProfile, hasPermission } = usePermissions();
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [gradesByPeriod, setGradesByPeriod] = useState<Record<number, StudentGrade>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const evalConfig = useMemo(() => {
    return getLevelEvaluationConfig(settings, student?.level);
  }, [settings, student?.level]);

  const periodIndices = useMemo(() => {
    return Array.from({ length: evalConfig.periodCount }, (_, i) => i + 1);
  }, [evalConfig.periodCount]);

  // Filter pure academic subjects for this student's level
  const academicSubjects = useMemo(() => {
    if (!student?.level) return [];
    const studentLvl = student.level.toLowerCase().trim();
    return subjects.filter(s => 
      s.level?.toLowerCase().trim() === studentLvl &&
      isPureAcademicSubject(s) &&
      isStudentEnrolledInSubject(s, student.id)
    );
  }, [subjects, student?.level, student?.id]);

  // Load grades/observations for this student and current cycle
  useEffect(() => {
    if (!isOpen || !student || !cycle) return;

    const fetchGrades = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'grades'),
          where('studentId', '==', student.id),
          where('cycleId', '==', cycle.id)
        );
        const snap = await getDocs(q);
        const map: Record<number, StudentGrade> = {};
        snap.docs.forEach(d => {
          const g = { id: d.id, ...d.data() } as StudentGrade;
          map[Number(g.bimestre)] = g;
        });
        setGradesByPeriod(map);

        // Load observations for currently selected period
        const currentGrade = map[selectedPeriod];
        const currentObs = currentGrade?.subjectObservations || currentGrade?.observations || {};
        setObservations({ ...currentObs });
        setHasChanges(false);
      } catch (err) {
        console.error("Error loading observations:", err);
        toast.error("Error al cargar las observaciones del alumno");
      } finally {
        setLoading(false);
      }
    };

    fetchGrades();
  }, [isOpen, student, cycle]);

  // Synchronize when period changes
  const handlePeriodChange = (period: number) => {
    if (hasChanges) {
      if (!window.confirm("Tienes cambios sin guardar en este periodo. ¿Deseas cambiar de periodo sin guardar?")) {
        return;
      }
    }
    setSelectedPeriod(period);
    const grade = gradesByPeriod[period];
    const obs = grade?.subjectObservations || grade?.observations || {};
    setObservations({ ...obs });
    setHasChanges(false);
  };

  const handleObservationChange = (subjectName: string, text: string) => {
    setObservations(prev => ({
      ...prev,
      [subjectName]: text
    }));
    setHasChanges(true);
  };



  const handleSave = async () => {
    if (!student || !cycle) return;
    setIsSaving(true);
    try {
      const docId = `${student.id}_B${selectedPeriod}_${cycle.id}`;
      const docRef = doc(db, 'grades', docId);

      const existing = gradesByPeriod[selectedPeriod];
      const payload: Partial<StudentGrade> = {
        studentId: student.id,
        bimestre: selectedPeriod as any,
        cycleId: cycle.id,
        subjectObservations: observations,
        observations: observations,
        updatedAt: serverTimestamp() as any,
        createdBy: existing?.createdBy || userProfile?.id || 'system'
      };

      await setDoc(docRef, payload, { merge: true });

      // Update local state
      setGradesByPeriod(prev => ({
        ...prev,
        [selectedPeriod]: {
          ...(prev[selectedPeriod] || {}),
          ...payload,
          id: docId
        } as StudentGrade
      }));

      setHasChanges(false);
      toast.success(`Observaciones del ${evalConfig.periodNames?.[selectedPeriod - 1] || `Periodo ${selectedPeriod}`} guardadas`);
      if (onSaved) onSaved();
    } catch (err) {
      console.error("Error saving observations:", err);
      toast.error("Error al guardar las observaciones");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !student) return null;

  const currentPeriodName = evalConfig.periodNames?.[selectedPeriod - 1] || `${selectedPeriod}º Periodo`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <MessageSquare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Observaciones por Materia
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {student.level}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {student.lastName} {student.name} • {student.grade || ''} {student.group || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/imprimir-boleta/${student.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              title="Abrir vista previa de la boleta con observaciones"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Ver Boleta</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Student Mini Banner & Period Selector */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Matrícula:</span>
              <span className="font-mono font-bold text-slate-800">{student.matricula || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">CURP:</span>
              <span className="font-mono font-bold text-slate-800">{student.curp || 'N/A'}</span>
            </div>
          </div>

          {/* Period selector buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mx-2">
              Periodo:
            </span>
            {periodIndices.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedPeriod === p
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                {evalConfig.periodNames?.[p - 1] || `P${p}`}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold">Cargando observaciones...</p>
            </div>
          ) : academicSubjects.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center text-amber-800">
              <AlertCircle className="mx-auto text-amber-500 mb-2" size={32} />
              <h4 className="text-sm font-black uppercase">Sin materias académicas registradas</h4>
              <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                No hay materias configuradas con la categoría "Académica" para el nivel {student.level}. 
                Puedes configurarlas en Control Escolar &gt; Materias.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold">
                  Materias Académicas para <strong className="text-slate-800">{currentPeriodName}</strong> ({academicSubjects.length})
                </span>
                <span className="text-[11px] text-slate-400 italic">
                  Las observaciones se imprimirán en la hoja dedicada de la boleta.
                </span>
              </div>

              <div className="space-y-4">
                {academicSubjects.map((subj) => {
                  const currentText = observations[subj.name] || '';
                  const charCount = currentText.length;
                  const isLong = charCount > 240;

                  return (
                    <div 
                      key={subj.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <BookOpen size={15} className="text-blue-600" />
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                            {subj.name}
                          </h4>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            Materia Académica
                          </span>
                        </div>

                        {/* Character counter */}
                        <div className="text-[10px] font-bold">
                          <span className={isLong ? "text-amber-600 font-black" : "text-slate-400"}>
                            {charCount} / 240 carac.
                          </span>
                        </div>
                      </div>

                      {/* Textarea */}
                      <textarea
                        value={currentText}
                        onChange={(e) => handleObservationChange(subj.name, e.target.value)}
                        placeholder={`Escribe observaciones, fortalezas y recomendaciones para ${student.name} en ${subj.name}...`}
                        rows={3}
                        maxLength={240}
                        className="w-full text-xs p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-slate-800 leading-relaxed transition-all placeholder:text-slate-300 resize-y"
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Tienes cambios sin guardar
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || academicSubjects.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              <span>Guardar {currentPeriodName}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
