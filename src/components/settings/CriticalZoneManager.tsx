import React, { useState } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  query, 
  where,
  DocumentReference 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { SchoolCycle, StudentGrade } from '../../types';
import { loadExampleData } from '../../services/exampleDataService';
import { toast } from 'react-toastify';
import { 
  AlertTriangle, 
  Trash2, 
  Database, 
  Unlock, 
  GraduationCap, 
  ClipboardList, 
  BookOpen, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  Clock, 
  Users, 
  Bell, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle,
  X,
  Loader2,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type PurgeActionType = 
  | 'grades_only'
  | 'observations_only'
  | 'grades_all'
  | 'unlock_all'
  | 'teacher_activities'
  | 'student_attendance'
  | 'all_academic'
  | 'payments'
  | 'expenses'
  | 'kiosk_logs'
  | 'reception_visits'
  | 'enrollments'
  | 'announcements'
  | 'substitutions'
  | 'load_demo'
  | 'factory_reset';

interface ActionConfig {
  id: PurgeActionType;
  title: string;
  shortDesc: string;
  category: 'academic' | 'operational' | 'system';
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  buttonColor: string;
  supportsCycleFilter: boolean;
  requiresWord?: string;
  whatGetsDeleted: string;
  whatIsPreserved: string[];
}

const ACTION_CONFIGS: Record<PurgeActionType, ActionConfig> = {
  grades_only: {
    id: 'grades_only',
    title: 'Limpiar Solo Calificaciones',
    shortDesc: 'Borra notas numéricas y conducta, preservando las observaciones descriptivas si existen.',
    category: 'academic',
    badge: 'Evaluaciones',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: GraduationCap,
    iconBg: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    iconColor: 'text-blue-600',
    buttonColor: 'hover:border-blue-400 hover:shadow-blue-50',
    supportsCycleFilter: true,
    whatGetsDeleted: 'Las notas numéricas de materias y rubros de conducta/uniforme de todos los periodos. Si un alumno tiene observaciones, el texto se mantiene y solo se resetean las calificaciones.',
    whatIsPreserved: ['Alumnos registrados', 'Ciclos escolares', 'Docentes y asignaciones', 'Observaciones por materia', 'Materias configuradas']
  },
  observations_only: {
    id: 'observations_only',
    title: 'Limpiar Solo Observaciones',
    shortDesc: 'Elimina textos y observaciones por materia y generales, conservando las calificaciones numéricas.',
    category: 'academic',
    badge: 'Observaciones',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: ClipboardList,
    iconBg: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    iconColor: 'text-indigo-600',
    buttonColor: 'hover:border-indigo-400 hover:shadow-indigo-50',
    supportsCycleFilter: true,
    whatGetsDeleted: 'Todas las observaciones descriptivas por materia y observaciones generales ingresadas para los alumnos. Las calificaciones de materias NO se tocarán.',
    whatIsPreserved: ['Calificaciones numéricas de materias', 'Rubros de conducta y disciplina', 'Alumnos y ciclos', 'Cuentas de docentes']
  },
  grades_all: {
    id: 'grades_all',
    title: 'Limpiar Calificaciones y Observaciones',
    shortDesc: 'Elimina completamente la colección de notas y observaciones de alumnos en el ciclo seleccionado.',
    category: 'academic',
    badge: 'Historial Académico',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: BookOpen,
    iconBg: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
    iconColor: 'text-amber-600',
    buttonColor: 'hover:border-amber-400 hover:shadow-amber-50',
    supportsCycleFilter: true,
    requiresWord: 'BORRAR NOTAS',
    whatGetsDeleted: 'Todos los registros de calificaciones y observaciones escolares (colección grades).',
    whatIsPreserved: ['Alumnos matriculados', 'Ciclos escolares', 'Materias y planes', 'Usuarios docentes']
  },
  unlock_all: {
    id: 'unlock_all',
    title: 'Desbloquear Todos los Grados',
    shortDesc: 'Elimina todos los candados de cierre de periodos (bimestreLocks) para permitir edición.',
    category: 'academic',
    badge: 'Candados de Periodo',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: Unlock,
    iconBg: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    iconColor: 'text-emerald-600',
    buttonColor: 'hover:border-emerald-400 hover:shadow-emerald-50',
    supportsCycleFilter: true,
    whatGetsDeleted: 'Todos los bloqueos de captura en los periodos académicos (colección bimestreLocks). Todos los docentes podrán volver a editar notas y observaciones.',
    whatIsPreserved: ['Calificaciones existentes', 'Alumnos y grupos', 'Horarios y docentes']
  },
  teacher_activities: {
    id: 'teacher_activities',
    title: 'Limpiar Actividades de Docentes',
    shortDesc: 'Borra tareas, actividades y proyectos evaluados en el portal docente (teacherActivities).',
    category: 'academic',
    badge: 'Libreta Docente',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    icon: Layers,
    iconBg: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white',
    iconColor: 'text-sky-600',
    buttonColor: 'hover:border-sky-400 hover:shadow-sky-50',
    supportsCycleFilter: true,
    whatGetsDeleted: 'Todas las actividades y tareas creadas por los maestros en el portal docente. Los profesores comenzarán con su lista de actividades limpia.',
    whatIsPreserved: ['Alumnos y materias', 'Cuentas de docentes', 'Ciclos escolares']
  },
  student_attendance: {
    id: 'student_attendance',
    title: 'Limpiar Asistencias de Alumnos',
    shortDesc: 'Borra el historial de pases de lista, faltas, retardos y justificaciones de los alumnos.',
    category: 'academic',
    badge: 'Pases de Lista',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: Calendar,
    iconBg: 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white',
    iconColor: 'text-teal-600',
    buttonColor: 'hover:border-teal-400 hover:shadow-teal-50',
    supportsCycleFilter: true,
    whatGetsDeleted: 'Todos los pases de lista y registros de asistencia diaria de alumnos (colección attendance).',
    whatIsPreserved: ['Alumnos matriculados', 'Horarios de clase', 'Ciclos y materias']
  },
  all_academic: {
    id: 'all_academic',
    title: '⚡ Limpiar TODO lo Académico Docente',
    shortDesc: 'Reinicia en un paso: Calificaciones, Observaciones, Actividades, Asistencias y Candados.',
    category: 'academic',
    badge: 'Reinicio Docente Completo',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-200 font-black',
    icon: Sparkles,
    iconBg: 'bg-purple-50 text-purple-700 group-hover:bg-purple-700 group-hover:text-white',
    iconColor: 'text-purple-700',
    buttonColor: 'hover:border-purple-400 hover:shadow-purple-100 border-purple-200 bg-purple-50/20',
    supportsCycleFilter: true,
    requiresWord: 'LIMPIAR ACADEMICO',
    whatGetsDeleted: 'Todas las calificaciones numéricas, observaciones, actividades de maestros, pases de lista y candados de periodo en el ciclo seleccionado.',
    whatIsPreserved: ['Alumnos matriculados', 'Ciclos escolares', 'Docentes y asignaciones de materia', 'Catálogos de materias y cursos']
  },
  payments: {
    id: 'payments',
    title: 'Limpiar Pagos y Cobros de Caja',
    shortDesc: 'Elimina el historial de cobros, recibos y movimientos de caja registrados como prueba.',
    category: 'operational',
    badge: 'Caja y Finanzas',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CreditCard,
    iconBg: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    iconColor: 'text-emerald-600',
    buttonColor: 'hover:border-emerald-400 hover:shadow-emerald-50',
    supportsCycleFilter: true,
    requiresWord: 'LIMPIAR PAGOS',
    whatGetsDeleted: 'Todos los registros de pagos, abonos y recibos en caja (colección payments).',
    whatIsPreserved: ['Alumnos y sus datos de facturación', 'Conceptos de cobro y colegiaturas', 'Ciclos escolares']
  },
  expenses: {
    id: 'expenses',
    title: 'Limpiar Gastos de Operación',
    shortDesc: 'Elimina los comprobantes de egresos y gastos registrados en la administración.',
    category: 'operational',
    badge: 'Egresos',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: DollarSign,
    iconBg: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
    iconColor: 'text-rose-600',
    buttonColor: 'hover:border-rose-400 hover:shadow-rose-50',
    supportsCycleFilter: false,
    whatGetsDeleted: 'Todos los gastos y comprobantes de salida registrados en el módulo de Egresos (colección expenses).',
    whatIsPreserved: ['Configuración general', 'Cuentas de usuario', 'Alumnos y ciclos']
  },
  kiosk_logs: {
    id: 'kiosk_logs',
    title: 'Limpiar Bitácora de Kiosko / Checador',
    shortDesc: 'Borra las checadas y registros biométricos/QR de entradas y salidas de alumnos y personal.',
    category: 'operational',
    badge: 'Checador',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    icon: Clock,
    iconBg: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white',
    iconColor: 'text-cyan-600',
    buttonColor: 'hover:border-cyan-400 hover:shadow-cyan-50',
    supportsCycleFilter: false,
    whatGetsDeleted: 'El registro de checadas en kiosko de empleados y alumnos (colección attendance_logs).',
    whatIsPreserved: ['Empleados registrados', 'Alumnos y credenciales', 'Horarios']
  },
  reception_visits: {
    id: 'reception_visits',
    title: 'Limpiar Visitas de Recepción',
    shortDesc: 'Elimina la bitácora de visitantes, prospectos y turnos atendidos en recepción.',
    category: 'operational',
    badge: 'Recepción',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Users,
    iconBg: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    iconColor: 'text-blue-600',
    buttonColor: 'hover:border-blue-400 hover:shadow-blue-50',
    supportsCycleFilter: false,
    whatGetsDeleted: 'Las visitas registradas en el módulo de Recepción (colección reception_visits).',
    whatIsPreserved: ['Áreas y motivos configurados', 'Alumnos y ciclos']
  },
  enrollments: {
    id: 'enrollments',
    title: 'Limpiar Solicitudes de Preinscripción',
    shortDesc: 'Borra las solicitudes enviadas a través del formulario público de admisión.',
    category: 'operational',
    badge: 'Admisiones',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
    icon: FileText,
    iconBg: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
    iconColor: 'text-violet-600',
    buttonColor: 'hover:border-violet-400 hover:shadow-violet-50',
    supportsCycleFilter: false,
    whatGetsDeleted: 'Todas las solicitudes de preinscripción en línea recibidas (colección enrollments).',
    whatIsPreserved: ['Alumnos ya matriculados', 'Enlace de preinscripción configurado']
  },
  announcements: {
    id: 'announcements',
    title: 'Limpiar Avisos y Comunicados',
    shortDesc: 'Elimina los comunicados escolares y boletines creados como prueba en el sistema.',
    category: 'operational',
    badge: 'Comunicación',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Bell,
    iconBg: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
    iconColor: 'text-amber-600',
    buttonColor: 'hover:border-amber-400 hover:shadow-amber-50',
    supportsCycleFilter: false,
    whatGetsDeleted: 'Todos los avisos y comunicados escolares (colección announcements).',
    whatIsPreserved: ['Cuentas de padres y alumnos', 'Ajustes del colegio']
  },
  substitutions: {
    id: 'substitutions',
    title: 'Limpiar Sustituciones de Horario',
    shortDesc: 'Elimina las solicitudes y asignaciones de suplencia docente registradas.',
    category: 'operational',
    badge: 'Horarios',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: RefreshCw,
    iconBg: 'bg-slate-100 text-slate-600 group-hover:bg-slate-700 group-hover:text-white',
    iconColor: 'text-slate-600',
    buttonColor: 'hover:border-slate-400 hover:shadow-slate-50',
    supportsCycleFilter: false,
    whatGetsDeleted: 'Las solicitudes y registros de sustitución docente (colección substitutions).',
    whatIsPreserved: ['Horarios de clase base', 'Docentes asignados', 'Materias']
  },
  load_demo: {
    id: 'load_demo',
    title: 'Cargar Alumnos Demo',
    shortDesc: 'Poblar el sistema con 40 alumnos ficticios, pagos y asistencias para pruebas.',
    category: 'system',
    badge: 'Demostración',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Database,
    iconBg: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    iconColor: 'text-blue-600',
    buttonColor: 'hover:border-blue-400 hover:shadow-blue-50',
    supportsCycleFilter: false,
    whatGetsDeleted: 'No borra datos existentes. Agrega un ciclo escolar demo, 40 alumnos de muestra, pagos y registros de prueba.',
    whatIsPreserved: ['Datos existentes se combinan']
  },
  factory_reset: {
    id: 'factory_reset',
    title: '⚠️ Restablecer TODO el Sistema (Fábrica)',
    shortDesc: 'BORRA TODO: Alumnos, ciclos, pagos, notas y gastos. Solo para reinicio completo.',
    category: 'system',
    badge: 'Peligro Crítico',
    badgeColor: 'bg-red-100 text-red-900 border-red-200 font-black',
    icon: Trash2,
    iconBg: 'bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white',
    iconColor: 'text-red-600',
    buttonColor: 'hover:border-red-600 hover:shadow-red-100 border-red-200',
    supportsCycleFilter: false,
    requiresWord: 'ELIMINAR TODO',
    whatGetsDeleted: 'Absolutamente toda la información operativa del colegio: Alumnos, Ciclos, Pagos, Gastos, Calificaciones, Asistencias, Visitas y Anuncios.',
    whatIsPreserved: ['Configuraciones generales de facturación y plataforma (settings)']
  }
};

interface CriticalZoneManagerProps {
  cycles: SchoolCycle[];
  currentCycleId?: string;
  onRefresh?: () => void;
}

export default function CriticalZoneManager({ cycles, currentCycleId, onRefresh }: CriticalZoneManagerProps) {
  const [selectedCycleId, setSelectedCycleId] = useState<string>(currentCycleId || 'all');
  const [activeModalAction, setActiveModalAction] = useState<ActionConfig | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);
  const cycleScopeLabel = selectedCycleId === 'all' 
    ? 'Todos los ciclos escolares' 
    : (selectedCycle?.name || 'Ciclo seleccionado');

  // Helper to commit batches safely (max 400 ops per batch)
  const commitBatches = async (operations: Array<{ type: 'delete' | 'update' | 'set'; ref: DocumentReference; data?: any }>) => {
    const BATCH_SIZE = 400;
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        if (op.type === 'delete') {
          batch.delete(op.ref);
        } else if (op.type === 'update') {
          batch.update(op.ref, op.data);
        } else if (op.type === 'set') {
          batch.set(op.ref, op.data, { merge: true });
        }
      }
      await batch.commit();
    }
  };

  // Open modal and calculate affected documents count
  const handleOpenActionModal = async (action: ActionConfig) => {
    setActiveModalAction(action);
    setConfirmationInput('');
    setItemCount(null);
    setIsCounting(true);

    try {
      const count = await fetchAffectedCount(action.id);
      setItemCount(count);
    } catch (err) {
      console.error('Error counting documents:', err);
      setItemCount(null);
    } finally {
      setIsCounting(false);
    }
  };

  // Count documents according to action and scope
  const fetchAffectedCount = async (actionId: PurgeActionType): Promise<number> => {
    const isCycleFiltered = ACTION_CONFIGS[actionId].supportsCycleFilter && selectedCycleId !== 'all';

    switch (actionId) {
      case 'grades_only':
      case 'observations_only':
      case 'grades_all': {
        const q = isCycleFiltered 
          ? query(collection(db, 'grades'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'grades');
        const snap = await getDocs(q);
        return snap.size;
      }
      case 'unlock_all': {
        const q = isCycleFiltered
          ? query(collection(db, 'bimestreLocks'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'bimestreLocks');
        const snap = await getDocs(q);
        return snap.size;
      }
      case 'teacher_activities': {
        const q = isCycleFiltered
          ? query(collection(db, 'teacherActivities'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'teacherActivities');
        const snap = await getDocs(q);
        return snap.size;
      }
      case 'student_attendance': {
        const q = isCycleFiltered
          ? query(collection(db, 'attendance'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'attendance');
        const snap = await getDocs(q);
        return snap.size;
      }
      case 'all_academic': {
        let total = 0;
        const colGrades = isCycleFiltered 
          ? query(collection(db, 'grades'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'grades');
        const colAct = isCycleFiltered
          ? query(collection(db, 'teacherActivities'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'teacherActivities');
        const colAtt = isCycleFiltered
          ? query(collection(db, 'attendance'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'attendance');
        const colLocks = isCycleFiltered
          ? query(collection(db, 'bimestreLocks'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'bimestreLocks');
        
        const [sGrades, sAct, sAtt, sLocks] = await Promise.all([
          getDocs(colGrades),
          getDocs(colAct),
          getDocs(colAtt),
          getDocs(colLocks)
        ]);
        total = sGrades.size + sAct.size + sAtt.size + sLocks.size;
        return total;
      }
      case 'payments': {
        const q = isCycleFiltered
          ? query(collection(db, 'payments'), where('cycleId', '==', selectedCycleId))
          : collection(db, 'payments');
        const snap = await getDocs(q);
        return snap.size;
      }
      case 'expenses': {
        const snap = await getDocs(collection(db, 'expenses'));
        return snap.size;
      }
      case 'kiosk_logs': {
        const snap = await getDocs(collection(db, 'attendance_logs'));
        return snap.size;
      }
      case 'reception_visits': {
        const snap = await getDocs(collection(db, 'reception_visits'));
        return snap.size;
      }
      case 'enrollments': {
        const snap = await getDocs(collection(db, 'enrollments'));
        return snap.size;
      }
      case 'announcements': {
        const snap = await getDocs(collection(db, 'announcements'));
        return snap.size;
      }
      case 'substitutions': {
        const snap = await getDocs(collection(db, 'substitutions'));
        return snap.size;
      }
      case 'load_demo':
        return 40;
      case 'factory_reset': {
        let total = 0;
        const collections = ['students', 'payments', 'expenses', 'cycles', 'announcements', 'grades', 'attendance', 'reception_visits', 'bimestreLocks', 'enrollments', 'teacherActivities', 'attendance_logs', 'substitutions'];
        const snaps = await Promise.all(collections.map(c => getDocs(collection(db, c))));
        snaps.forEach(s => { total += s.size; });
        return total;
      }
      default:
        return 0;
    }
  };

  // Execute the purge action
  const handleExecuteAction = async () => {
    if (!activeModalAction) return;

    // Check required word
    if (activeModalAction.requiresWord) {
      if (confirmationInput.trim().toUpperCase() !== activeModalAction.requiresWord.toUpperCase()) {
        toast.error(`Debes escribir exactamente "${activeModalAction.requiresWord}" para confirmar`);
        return;
      }
    }

    setIsProcessing(true);
    const actionId = activeModalAction.id;
    const isCycleFiltered = activeModalAction.supportsCycleFilter && selectedCycleId !== 'all';

    try {
      let processedCount = 0;

      switch (actionId) {
        case 'grades_only': {
          const q = isCycleFiltered 
            ? query(collection(db, 'grades'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'grades');
          const snap = await getDocs(q);
          const ops: Array<{ type: 'delete' | 'update' | 'set'; ref: DocumentReference; data?: any }> = [];

          snap.docs.forEach(d => {
            const data = d.data() as StudentGrade;
            // Check if observations exist
            const hasSubjObs = data.subjectObservations && Object.values(data.subjectObservations).some(v => typeof v === 'string' && v.trim().length > 0);
            const hasObs = data.observations && Object.values(data.observations).some(v => typeof v === 'string' && v.trim().length > 0);
            const hasGenObs = typeof data.generalObservation === 'string' && data.generalObservation.trim().length > 0;
            const hasAnyObs = hasSubjObs || hasObs || hasGenObs;

            if (hasAnyObs) {
              ops.push({
                type: 'update',
                ref: doc(db, 'grades', d.id),
                data: {
                  subjects: {},
                  conduct: 0,
                  uniform: 0,
                  attendance: 0,
                  tasksNotDone: 0,
                  tardies: 0,
                  cleanliness: 0,
                  updatedAt: serverTimestamp()
                }
              });
            } else {
              ops.push({
                type: 'delete',
                ref: doc(db, 'grades', d.id)
              });
            }
          });

          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se limpiaron las calificaciones de ${processedCount} registros (observaciones preservadas)`);
          break;
        }

        case 'observations_only': {
          const q = isCycleFiltered 
            ? query(collection(db, 'grades'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'grades');
          const snap = await getDocs(q);
          const ops: Array<{ type: 'delete' | 'update' | 'set'; ref: DocumentReference; data?: any }> = [];

          snap.docs.forEach(d => {
            const data = d.data() as StudentGrade;
            const hasNumericGrades = (data.subjects && Object.keys(data.subjects).length > 0) ||
                                     (data.conduct && data.conduct !== 0) ||
                                     (data.uniform && data.uniform !== 0);

            if (hasNumericGrades) {
              ops.push({
                type: 'update',
                ref: doc(db, 'grades', d.id),
                data: {
                  subjectObservations: {},
                  observations: {},
                  generalObservation: '',
                  updatedAt: serverTimestamp()
                }
              });
            } else {
              ops.push({
                type: 'delete',
                ref: doc(db, 'grades', d.id)
              });
            }
          });

          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se limpiaron las observaciones de ${processedCount} alumnos (notas numéricas preservadas)`);
          break;
        }

        case 'grades_all': {
          const q = isCycleFiltered 
            ? query(collection(db, 'grades'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'grades');
          const snap = await getDocs(q);
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'grades', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron completamente ${processedCount} registros de calificaciones y observaciones`);
          break;
        }

        case 'unlock_all': {
          const q = isCycleFiltered
            ? query(collection(db, 'bimestreLocks'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'bimestreLocks');
          const snap = await getDocs(q);
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'bimestreLocks', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se desbloquearon ${processedCount} periodos/grados exitosamente`);
          break;
        }

        case 'teacher_activities': {
          const q = isCycleFiltered
            ? query(collection(db, 'teacherActivities'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'teacherActivities');
          const snap = await getDocs(q);
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'teacherActivities', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} actividades de docentes`);
          break;
        }

        case 'student_attendance': {
          const q = isCycleFiltered
            ? query(collection(db, 'attendance'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'attendance');
          const snap = await getDocs(q);
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'attendance', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} registros de asistencia escolar`);
          break;
        }

        case 'all_academic': {
          // Clear grades, activities, attendance, and locks
          const colGrades = isCycleFiltered 
            ? query(collection(db, 'grades'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'grades');
          const colAct = isCycleFiltered
            ? query(collection(db, 'teacherActivities'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'teacherActivities');
          const colAtt = isCycleFiltered
            ? query(collection(db, 'attendance'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'attendance');
          const colLocks = isCycleFiltered
            ? query(collection(db, 'bimestreLocks'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'bimestreLocks');

          const [sGrades, sAct, sAtt, sLocks] = await Promise.all([
            getDocs(colGrades),
            getDocs(colAct),
            getDocs(colAtt),
            getDocs(colLocks)
          ]);

          const allOps = [
            ...sGrades.docs.map(d => ({ type: 'delete' as const, ref: doc(db, 'grades', d.id) })),
            ...sAct.docs.map(d => ({ type: 'delete' as const, ref: doc(db, 'teacherActivities', d.id) })),
            ...sAtt.docs.map(d => ({ type: 'delete' as const, ref: doc(db, 'attendance', d.id) })),
            ...sLocks.docs.map(d => ({ type: 'delete' as const, ref: doc(db, 'bimestreLocks', d.id) }))
          ];

          await commitBatches(allOps);
          processedCount = allOps.length;
          toast.success(`¡Reinicio Docente Completo! Se limpiaron ${processedCount} registros académicos sin tocar a los alumnos.`);
          break;
        }

        case 'payments': {
          const q = isCycleFiltered
            ? query(collection(db, 'payments'), where('cycleId', '==', selectedCycleId))
            : collection(db, 'payments');
          const snap = await getDocs(q);
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'payments', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} recibos de pago de prueba`);
          break;
        }

        case 'expenses': {
          const snap = await getDocs(collection(db, 'expenses'));
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'expenses', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} registros de gastos`);
          break;
        }

        case 'kiosk_logs': {
          const snap = await getDocs(collection(db, 'attendance_logs'));
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'attendance_logs', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} checadas del kiosko checador`);
          break;
        }

        case 'reception_visits': {
          const snap = await getDocs(collection(db, 'reception_visits'));
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'reception_visits', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} visitas de recepción`);
          break;
        }

        case 'enrollments': {
          const snap = await getDocs(collection(db, 'enrollments'));
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'enrollments', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} solicitudes de preinscripción`);
          break;
        }

        case 'announcements': {
          const snap = await getDocs(collection(db, 'announcements'));
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'announcements', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} comunicados escolares`);
          break;
        }

        case 'substitutions': {
          const snap = await getDocs(collection(db, 'substitutions'));
          const ops = snap.docs.map(d => ({
            type: 'delete' as const,
            ref: doc(db, 'substitutions', d.id)
          }));
          await commitBatches(ops);
          processedCount = ops.length;
          toast.success(`Se eliminaron ${processedCount} sustituciones de horario`);
          break;
        }

        case 'load_demo': {
          await loadExampleData();
          toast.success('Datos demo cargados exitosamente. Recargando...');
          setTimeout(() => window.location.reload(), 1200);
          return;
        }

        case 'factory_reset': {
          const collections = ['students', 'payments', 'expenses', 'cycles', 'announcements', 'grades', 'attendance', 'reception_visits', 'bimestreLocks', 'enrollments', 'teacherActivities', 'attendance_logs', 'substitutions'];
          for (const coll of collections) {
            const snap = await getDocs(collection(db, coll));
            const ops = snap.docs.map(d => ({
              type: 'delete' as const,
              ref: doc(db, coll, d.id)
            }));
            await commitBatches(ops);
          }
          toast.success('Sistema restablecido a valores iniciales de fábrica.');
          setTimeout(() => window.location.reload(), 1200);
          return;
        }
      }

      setActiveModalAction(null);
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Error in purge action:', error);
      toast.error('Error al procesar la limpieza: ' + (error?.message || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const academicActions = [
    ACTION_CONFIGS.all_academic,
    ACTION_CONFIGS.grades_only,
    ACTION_CONFIGS.observations_only,
    ACTION_CONFIGS.unlock_all,
    ACTION_CONFIGS.teacher_activities,
    ACTION_CONFIGS.student_attendance,
    ACTION_CONFIGS.grades_all
  ];

  const operationalActions = [
    ACTION_CONFIGS.payments,
    ACTION_CONFIGS.expenses,
    ACTION_CONFIGS.kiosk_logs,
    ACTION_CONFIGS.reception_visits,
    ACTION_CONFIGS.enrollments,
    ACTION_CONFIGS.announcements,
    ACTION_CONFIGS.substitutions
  ];

  const systemActions = [
    ACTION_CONFIGS.load_demo,
    ACTION_CONFIGS.factory_reset
  ];

  return (
    <div className="space-y-8">
      {/* Header and Scope Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-red-50/70 via-orange-50/40 to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200">
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Zona Crítica y Limpieza de Datos</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                  Superadministrador
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Herramientas para purgar datos de prueba (calificaciones, observaciones, pases de lista) manteniendo seguros tus alumnos y ciclos.
              </p>
            </div>
          </div>

          {/* Cycle Scope Filter */}
          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm self-start md:self-auto">
            <Calendar size={16} className="text-slate-400 shrink-0" />
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ámbito de Limpieza</span>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
              >
                <option value="all">🌐 Todos los ciclos escolares</option>
                {cycles.map(cycle => (
                  <option key={cycle.id} value={cycle.id}>
                    📅 {cycle.name} {cycle.id === currentCycleId ? '(Actual)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Safety Reassurance Banner */}
        <div className="px-8 py-4 bg-emerald-50/60 border-b border-emerald-100/60 flex items-center gap-3 text-emerald-900 text-xs font-medium">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
          <p>
            <strong className="font-bold text-emerald-950">Protección de Datos Fundamentales:</strong> Las opciones de limpieza académica y operativa <span className="underline decoration-emerald-500 font-bold">NO eliminan alumnos, ciclos escolares, materias ni usuarios</span>. Solo purgan los registros operativos de prueba ingresados por los profesores o personal.
          </p>
        </div>
      </div>

      {/* Group 1: Evaluaciones y Labor Docente */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <GraduationCap size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">1. Evaluaciones y Portal Docente</h3>
              <p className="text-[11px] text-slate-500 font-medium">Limpieza de notas, observaciones, actividades de maestros y candados de bimestre</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            Ámbito: <strong className="text-slate-700">{cycleScopeLabel}</strong>
          </span>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {academicActions.map(action => {
            const Icon = action.icon;
            const isMaster = action.id === 'all_academic';

            return (
              <button
                key={action.id}
                onClick={() => handleOpenActionModal(action)}
                className={cn(
                  "group p-5 rounded-2xl border transition-all text-left flex flex-col justify-between hover:shadow-lg relative overflow-hidden",
                  isMaster 
                    ? "bg-gradient-to-br from-purple-50/60 via-white to-blue-50/40 border-purple-200 hover:border-purple-400 md:col-span-2 lg:col-span-3 shadow-xs" 
                    : "bg-white border-slate-200 hover:border-blue-400 shadow-2xs"
                )}
              >
                {isMaster && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                    <Sparkles size={12} />
                    Recomendado para inicio de ciclo
                  </div>
                )}

                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-2xs",
                      action.iconBg
                    )}>
                      <Icon size={22} />
                    </div>
                    {!isMaster && (
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        action.badgeColor
                      )}>
                        {action.badge}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors tracking-tight mb-1">
                    {action.title}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {action.shortDesc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600 group-hover:text-blue-600">
                  <span>Limpiar datos</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Group 2: Operaciones y Módulos Administrativos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">2. Módulos Operativos y Administrativos</h3>
              <p className="text-[11px] text-slate-500 font-medium">Limpieza de cobros de prueba en caja, egresos, registros de kiosko y visitantes</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            Alumnos y ciclos seguros
          </span>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {operationalActions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleOpenActionModal(action)}
                className="group p-5 bg-white rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all text-left flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-2xs",
                      action.iconBg
                    )}>
                      <Icon size={22} />
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      action.badgeColor
                    )}>
                      {action.badge}
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-slate-900 group-hover:text-purple-700 transition-colors tracking-tight mb-1">
                    {action.title}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {action.shortDesc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600 group-hover:text-purple-600">
                  <span>Purgar registros</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Group 3: Herramientas de Fábrica y Demostración */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 bg-red-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-red-950 uppercase tracking-tight">3. Demostración y Restablecimiento Completo</h3>
              <p className="text-[11px] text-red-700/70 font-medium">Carga de alumnos demo y reinicio total a valores de fábrica</p>
            </div>
          </div>
          <span className="text-[10px] font-black text-red-700 uppercase tracking-widest bg-red-100/70 px-2.5 py-1 rounded-lg border border-red-200">
            Zona de Alto Riesgo
          </span>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {systemActions.map(action => {
            const Icon = action.icon;
            const isReset = action.id === 'factory_reset';

            return (
              <button
                key={action.id}
                onClick={() => handleOpenActionModal(action)}
                className={cn(
                  "group p-6 rounded-2xl border transition-all text-left flex flex-col justify-between hover:shadow-xl",
                  isReset 
                    ? "bg-red-50/40 border-red-200 hover:border-red-600 hover:shadow-red-100" 
                    : "bg-white border-blue-200 hover:border-blue-500 hover:shadow-blue-50"
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm",
                      action.iconBg
                    )}>
                      <Icon size={24} />
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border",
                      action.badgeColor
                    )}>
                      {action.badge}
                    </span>
                  </div>

                  <h4 className={cn(
                    "text-base font-black tracking-tight mb-1.5",
                    isReset ? "text-red-900 group-hover:text-red-700" : "text-slate-900 group-hover:text-blue-700"
                  )}>
                    {action.title}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {action.shortDesc}
                  </p>
                </div>

                <div className={cn(
                  "mt-6 pt-3 border-t flex items-center justify-between text-xs font-bold",
                  isReset ? "border-red-200/80 text-red-700" : "border-slate-100 text-blue-600"
                )}>
                  <span>{isReset ? 'Ejecutar borrado total' : 'Iniciar carga de datos'}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog / Modal */}
      {activeModalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className={cn(
              "px-6 py-5 border-b flex items-start justify-between gap-4",
              activeModalAction.category === 'system' ? "bg-red-50/70 border-red-100" : "bg-slate-50 border-slate-100"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  activeModalAction.iconBg
                )}>
                  <activeModalAction.icon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {activeModalAction.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Confirmación de purga de datos
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isProcessing && setActiveModalAction(null)}
                disabled={isProcessing}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Scope badge */}
              {activeModalAction.supportsCycleFilter && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="font-bold text-slate-500">Ciclo a aplicar:</span>
                  <span className="font-black text-slate-900">
                    {selectedCycleId === 'all' ? '🌐 Todos los ciclos escolares' : `📅 ${selectedCycle?.name || 'Ciclo seleccionado'}`}
                  </span>
                </div>
              )}

              {/* Document count card */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs text-blue-900 font-medium">
                  {isCounting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-blue-600" />
                      <span>Calculando registros existentes...</span>
                    </>
                  ) : (
                    <>
                      <Database size={16} className="text-blue-600" />
                      <span>Registros encontrados para procesar:</span>
                    </>
                  )}
                </div>
                {!isCounting && itemCount !== null && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white">
                    {itemCount} {itemCount === 1 ? 'registro' : 'registros'}
                  </span>
                )}
              </div>

              {/* What gets deleted */}
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-red-500" />
                  ¿Qué se eliminará o limpiará?
                </p>
                <div className="p-3.5 bg-red-50/50 rounded-xl border border-red-100 text-xs text-red-900 leading-relaxed font-medium">
                  {activeModalAction.whatGetsDeleted}
                </div>
              </div>

              {/* What is preserved */}
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Información que se mantendrá 100% segura:
                </p>
                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-emerald-900 space-y-1">
                  {activeModalAction.whatIsPreserved.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-bold">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required confirmation text */}
              {activeModalAction.requiresWord && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-black text-slate-800 block">
                    Para confirmar, escribe <span className="text-red-600 font-mono tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-200">{activeModalAction.requiresWord}</span>:
                  </label>
                  <input
                    type="text"
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder={`Escribe ${activeModalAction.requiresWord}`}
                    disabled={isProcessing}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono tracking-wider focus:ring-2 focus:ring-red-500 focus:border-red-500 uppercase"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveModalAction(null)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-800 transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={
                  isProcessing ||
                  (Boolean(activeModalAction.requiresWord) && confirmationInput.trim().toUpperCase() !== activeModalAction.requiresWord?.toUpperCase())
                }
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed",
                  activeModalAction.category === 'system' ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-slate-900 hover:bg-slate-800 shadow-slate-200"
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Procesando limpieza...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirmar y Limpiar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
