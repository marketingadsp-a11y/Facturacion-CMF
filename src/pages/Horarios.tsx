import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Calendar, 
  Users, 
  BookOpen, 
  Clock, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Printer, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  UserCheck,
  MapPin,
  Save,
  Check
} from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'motion/react';
import { ScheduleSlot, TeacherSubstitution, AppSettings } from '../types';
import { 
  subscribeToSchedules, 
  saveSchedulesBatch, 
  subscribeToSubstitutions,
  addSubstitution,
  deleteSubstitution,
  clearSchedulesForCycle
} from '../services/scheduleService';

// Time periods definition
const DEFAULT_TIME_PERIODS = [
  { label: '1er Periodo', time: '07:30 - 08:20', isBreak: false },
  { label: '2do Periodo', time: '08:20 - 09:10', isBreak: false },
  { label: '3er Periodo', time: '09:10 - 10:00', isBreak: false },
  { label: 'Receso', time: '10:00 - 10:30', isBreak: true },
  { label: '4to Periodo', time: '10:30 - 11:20', isBreak: false },
  { label: '5to Periodo', time: '11:20 - 12:10', isBreak: false },
  { label: '6to Periodo', time: '12:10 - 13:00', isBreak: false },
  { label: '7mo Periodo', time: '13:00 - 13:50', isBreak: false },
];

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
];

const SUBJECT_COLORS = [
  { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/70', dot: 'bg-indigo-500' },
  { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70', dot: 'bg-rose-500' },
  { bg: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100/70', dot: 'bg-sky-500' },
  { bg: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100/70', dot: 'bg-violet-500' },
  { bg: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100/70', dot: 'bg-teal-500' },
  { bg: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100/70', dot: 'bg-orange-500' },
  { bg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100/70', dot: 'bg-fuchsia-500' },
  { bg: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100/70', dot: 'bg-pink-500' },
  { bg: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100/70', dot: 'bg-cyan-500' },
  { bg: 'bg-lime-50 text-lime-700 border-lime-200 hover:bg-lime-100/70', dot: 'bg-lime-500' },
  { bg: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70', dot: 'bg-purple-500' },
];

const getSubjectColor = (subjectId: string | undefined) => {
  if (!subjectId) return { bg: 'bg-slate-55 text-slate-600 border-slate-200 hover:bg-slate-100', dot: 'bg-slate-400' };
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) {
    hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[index];
};

interface ClassContract {
  id?: string;
  level: string;
  grade: string;
  group: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classroom?: string;
  periodsPerDay: number;
  customPeriodsPerDay?: Record<string, number>;
}

export default function Horarios() {
  const { hasPermission, userProfile } = usePermissions();
  const isAdmin = hasPermission('controlEscolar', 'manage') || userProfile?.role === 'Superadministrador';
  const isTeacher = userProfile?.role === 'Docente';
  const isParent = userProfile?.role === 'Padre';

  // Active view setup
  const [activeTab, setActiveTab] = useState<'editor' | 'substitutions'>('editor');
  const [viewMode, setViewMode] = useState<'group' | 'teacher' | 'classroom' | 'master' | 'master_groups'>('group');
  const [selectedMasterDay, setSelectedMasterDay] = useState(1);
  
  // Selected filter entities
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');

  // Dropdown list data
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<string[]>([]);

  const sortedTeachersForMaster = useMemo(() => {
    return [...teachers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [teachers]);
  
  // Real-time scheduling data
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [contracts, setContracts] = useState<ClassContract[]>([]);

  // Drag and Drop / Move / Sidebar Filter states
  const [draggedSlot, setDraggedSlot] = useState<ScheduleSlot | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: number; periodIndex: number } | null>(null);
  const [movingSlot, setMovingSlot] = useState<ScheduleSlot | null>(null);
  const [editClassroom, setEditClassroom] = useState('');
  const [filterLessonsByGroup, setFilterLessonsByGroup] = useState(true);

  // Dynamic activePeriods
  const activePeriods = useMemo(() => {
    const levelToUse = selectedLevel || (settings?.academicLevels?.[0]) || '';
    if (settings?.levelPeriods?.[levelToUse] && settings.levelPeriods[levelToUse].length > 0) {
      return settings.levelPeriods[levelToUse];
    }
    return DEFAULT_TIME_PERIODS;
  }, [settings, selectedLevel]);

  const getSubPeriod = (periodIndex: number) => {
    const isDefault = activePeriods === DEFAULT_TIME_PERIODS;
    if (isDefault) {
      const classOnlyPeriods = activePeriods.filter(p => !p.isBreak);
      if (periodIndex < classOnlyPeriods.length) {
        return classOnlyPeriods[periodIndex];
      }
    }
    return activePeriods[periodIndex] || activePeriods.filter(p => !p.isBreak)[periodIndex] || null;
  };
  
  // Form states
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [newContract, setNewContract] = useState<Partial<ClassContract>>({
    level: '',
    grade: '',
    group: '',
    subjectId: '',
    teacherId: '',
    classroom: '',
    periodsPerDay: 1
  });
  const [isSpecialSchedule, setIsSpecialSchedule] = useState(false);
  const [specialScheduleHours, setSpecialScheduleHours] = useState<Record<string, number>>({
    "1": 1,
    "2": 1,
    "3": 1,
    "4": 1,
    "5": 1
  });

  // Manual placement modal
  const [isCellModalOpen, setIsCellModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ day: number; periodIndex: number } | null>(null);

  // Auto generator simulation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');

  // Substitution states
  const [subDate, setSubDate] = useState(new Date().toISOString().split('T')[0]);
  const [substitutions, setSubstitutions] = useState<TeacherSubstitution[]>([]);
  const [absentTeacherId, setAbsentTeacherId] = useState('');
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubReason, setNewSubReason] = useState('Enfermedad');
  const [selectedSubPeriod, setSelectedSubPeriod] = useState<number | null>(null);
  const [selectedSubDay, setSelectedSubDay] = useState<number | null>(null);
  const [substituteTeacherId, setSubstituteTeacherId] = useState('');
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  // Listeners
  useEffect(() => {
    // 1. Fetch cycles
    const unsubCycles = onSnapshot(collection(db, 'cycles'), (snap) => {
      const cyList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setCycles(cyList);
      
      // Auto select cycle if setting general is set or first cycle
      if (cyList.length > 0 && !selectedCycleId) {
        setSelectedCycleId(cyList[0].id);
      }
    });

    // 2. Fetch general settings (levels, grades, groups)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        setSettings(data);
        if (data.academicLevels && data.academicLevels.length > 0 && !selectedLevel) {
          setSelectedLevel(data.academicLevels[0]);
        }
        if (data.academicGrades && data.academicGrades.length > 0 && !selectedGrade) {
          setSelectedGrade(data.academicGrades[0]);
        }
        if (data.academicGroups && data.academicGroups.length > 0 && !selectedGroup) {
          setSelectedGroup(data.academicGroups[0]);
        }
      }
    });

    // 3. Fetch subjects
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    // 4. Fetch teachers (users with role 'Docente')
    const unsubTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Docente')), (snap) => {
      const tList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setTeachers(tList);
      if (tList.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(tList[0].id);
      }
    });

    return () => {
      unsubCycles();
      unsubSettings();
      unsubSubjects();
      unsubTeachers();
    };
  }, []);

  // Listen to today's attendance logs for substitutions module connection
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(collection(db, 'attendance_logs'), where('timestamp', '>=', today));
    const unsub = onSnapshot(q, (snap) => {
      setTodayLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    return unsub;
  }, []);

  // Listen to schedules once cycleId is set
  useEffect(() => {
    if (!selectedCycleId) return;
    
    const unsubSchedules = subscribeToSchedules(selectedCycleId, (slots) => {
      setSchedules(slots);
    });

    // Fetch schedule contracts
    const unsubContracts = onSnapshot(
      query(collection(db, 'schedule_contracts'), where('cycleId', '==', selectedCycleId)),
      (snap) => {
        setContracts(snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            periodsPerDay: data.periodsPerDay || data.periodsPerWeek || 1
          } as ClassContract;
        }));
      }
    );

    return () => {
      unsubSchedules();
      unsubContracts();
    };
  }, [selectedCycleId]);

  // Listen to substitutions
  useEffect(() => {
    const unsubSubs = subscribeToSubstitutions(subDate, (subsList) => {
      setSubstitutions(subsList);
    });
    return () => unsubSubs();
  }, [subDate]);

  // Auto compile classrooms from contracts or schedules
  useEffect(() => {
    const rooms = new Set<string>();
    contracts.forEach(c => { if (c.classroom) rooms.add(c.classroom); });
    schedules.forEach(s => { if (s.classroom) rooms.add(s.classroom); });
    // Add default rooms if none exist
    if (rooms.size === 0) {
      rooms.add('Salón 101');
      rooms.add('Salón 102');
      rooms.add('Salón 103');
      rooms.add('Laboratorio');
      rooms.add('Aula de Usos Múltiples');
    }
    const sortedRooms = Array.from(rooms).sort();
    setClassrooms(sortedRooms);
    if (sortedRooms.length > 0 && !selectedClassroom) {
      setSelectedClassroom(sortedRooms[0]);
    }
  }, [contracts, schedules]);

  // Parent view children's filter
  const [parentStudents, setParentStudents] = useState<any[]>([]);
  useEffect(() => {
    if (isParent && auth.currentUser?.email) {
      const q = query(collection(db, 'students'), where('parentEmail', '==', auth.currentUser.email));
      getDocs(q).then((snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setParentStudents(list);
        if (list.length > 0) {
          setSelectedLevel(list[0].level);
          setSelectedGrade(list[0].grade);
          setSelectedGroup(list[0].group || '');
        }
      });
    }
  }, [isParent]);

  // Teacher view auto filter
  useEffect(() => {
    if (isTeacher && auth.currentUser) {
      setViewMode('teacher');
      setSelectedTeacherId(auth.currentUser.uid);
    }
  }, [isTeacher]);

  // Helper to get active group text
  const currentGroupKey = `${selectedLevel} ${selectedGrade} ${selectedGroup}`;

  // Computed: Grid Matrix items
  const gridSchedules = useMemo(() => {
    return schedules.filter(slot => {
      if (viewMode === 'group') {
        return slot.level === selectedLevel && slot.grade === selectedGrade && slot.group === selectedGroup;
      } else if (viewMode === 'teacher') {
        return slot.teacherId === selectedTeacherId;
      } else if (viewMode === 'classroom') {
        return slot.classroom === selectedClassroom;
      } else {
        return true; // master mode - returns all schedules of the cycle to visualize and coordinate cross-level slots
      }
    });
  }, [schedules, viewMode, selectedLevel, selectedGrade, selectedGroup, selectedTeacherId, selectedClassroom]);

  // Index helper
  const getCellSlot = (day: number, periodIndex: number) => {
    return gridSchedules.find(s => {
      if (s.day !== day) return false;
      if (viewMode === 'master' && s.teacherId !== selectedTeacherId) return false;
      if (viewMode === 'master_groups' && (s.level !== selectedLevel || s.grade !== selectedGrade || s.group !== selectedGroup)) return false;
      if (s.periodIndex === periodIndex) return true;
      // Fallback for old class-only indexing when using the default time periods
      const isDefault = activePeriods === DEFAULT_TIME_PERIODS;
      if (isDefault) {
        const mappedIndex = s.periodIndex < 3 ? s.periodIndex : s.periodIndex + 1;
        return mappedIndex === periodIndex;
      }
      return false;
    });
  };

  // Find active substitution for cell (for teacher/group on selected date)
  const getCellSubstitution = (day: number, periodIndex: number, slot: ScheduleSlot | undefined) => {
    if (!slot) return null;
    return substitutions.find(sub => {
      if (sub.day !== day || sub.absentTeacherId !== slot.teacherId) return false;
      if (sub.periodIndex === periodIndex) return true;
      const isDefault = activePeriods === DEFAULT_TIME_PERIODS;
      if (isDefault) {
        const mappedIndex = sub.periodIndex < 3 ? sub.periodIndex : sub.periodIndex + 1;
        return mappedIndex === periodIndex;
      }
      return false;
    });
  };

  const getMasterCellSlot = (teacherId: string, dayId: number, periodIndex: number) => {
    return gridSchedules.find(s => {
      if (s.teacherId !== teacherId || s.day !== dayId) return false;
      if (s.periodIndex === periodIndex) return true;
      // Fallback for old class-only indexing when using the default time periods
      const isDefault = activePeriods === DEFAULT_TIME_PERIODS;
      if (isDefault) {
        const mappedIndex = s.periodIndex < 3 ? s.periodIndex : s.periodIndex + 1;
        return mappedIndex === periodIndex;
      }
      return false;
    });
  };

  const getGroupMasterCellSlot = (grade: string, group: string, dayId: number, periodIndex: number) => {
    return gridSchedules.find(s => {
      if (s.level !== selectedLevel || s.grade !== grade || s.group !== group || s.day !== dayId) return false;
      if (s.periodIndex === periodIndex) return true;
      // Fallback for old class-only indexing when using the default time periods
      const isDefault = activePeriods === DEFAULT_TIME_PERIODS;
      if (isDefault) {
        const mappedIndex = s.periodIndex < 3 ? s.periodIndex : s.periodIndex + 1;
        return mappedIndex === periodIndex;
      }
      return false;
    });
  };

  const getMasterCellSubstitution = (teacherId: string, dayId: number, periodIndex: number, slot: ScheduleSlot | undefined) => {
    const targetTeacherId = teacherId || slot?.teacherId;
    if (!targetTeacherId) return null;
    return substitutions.find(sub => {
      if (sub.day !== dayId || sub.absentTeacherId !== targetTeacherId) return false;
      if (sub.periodIndex === periodIndex) return true;
      const isDefault = activePeriods === DEFAULT_TIME_PERIODS;
      if (isDefault) {
        const mappedIndex = sub.periodIndex < 3 ? sub.periodIndex : sub.periodIndex + 1;
        return mappedIndex === periodIndex;
      }
      return false;
    });
  };

  const sortedGroupsForMaster = useMemo(() => {
    if (!settings) return [];
    const list: { grade: string; group: string }[] = [];
    const activeGrades = settings.academicGrades || [];
    const activeGroups = settings.academicGroups || [];
    
    activeGrades.forEach(grade => {
      activeGroups.forEach(group => {
        // Include group combination if there is any contract or assigned schedule in the cycle for it
        const hasData = contracts.some(c => c.level === selectedLevel && c.grade === grade && c.group === group) ||
                        schedules.some(s => s.cycleId === selectedCycleId && s.level === selectedLevel && s.grade === grade && s.group === group);
        if (hasData) {
          list.push({ grade, group });
        }
      });
    });

    // Fallback: if no active data, show all settings combinations
    if (list.length === 0) {
      activeGrades.forEach(grade => {
        activeGroups.forEach(group => {
          list.push({ grade, group });
        });
      });
    }
    
    // Sort primarily by grade rank in settings, then group alphabetically
    return list.sort((a, b) => {
      const aIdx = activeGrades.indexOf(a.grade);
      const bIdx = activeGrades.indexOf(b.grade);
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.group.localeCompare(b.group);
    });
  }, [settings, contracts, schedules, selectedLevel, selectedCycleId]);

  // Cross-reference scheduled teachers for today (Monday-Friday) who have no 'Entrada' logs
  const teachersWithClassesToday = useMemo(() => {
    const dayOfWeek = new Date().getDay();
    const validDay = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : dayOfWeek;
    const activeTeachers = new Map<string, string>(); // id -> name
    schedules.forEach(s => {
      if (s.day === validDay && s.teacherId && s.teacherName) {
        activeTeachers.set(s.teacherId, s.teacherName);
      }
    });
    return Array.from(activeTeachers.entries()).map(([id, name]) => ({ id, name }));
  }, [schedules]);

  const absentTeachersToday = useMemo(() => {
    return teachersWithClassesToday.filter(teacher => {
      const hasEntrada = todayLogs.some(log => 
        log.type === 'Entrada' && 
        log.employeeName?.toLowerCase().trim() === teacher.name?.toLowerCase().trim()
      );
      return !hasEntrada;
    });
  }, [teachersWithClassesToday, todayLogs]);

  // Conflict detection
  const conflicts = useMemo(() => {
    const list: { type: 'teacher' | 'classroom'; message: string; slot1: ScheduleSlot; slot2: ScheduleSlot }[] = [];
    
    // Check conflicts across ALL schedules in this cycle
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const s1 = schedules[i];
        const s2 = schedules[j];
        
        if (s1.day === s2.day && s1.periodIndex === s2.periodIndex) {
          // 1. Teacher conflict
          if (s1.teacherId === s2.teacherId) {
            list.push({
              type: 'teacher',
              message: `El docente ${s1.teacherName} está asignado al mismo tiempo en ${s1.level} ${s1.grade}° ${s1.group} y ${s2.level} ${s2.grade}° ${s2.group}`,
              slot1: s1,
              slot2: s2
            });
          }
          // 2. Classroom conflict
          if (s1.classroom && s2.classroom && s1.classroom === s2.classroom && 
              (s1.level !== s2.level || s1.grade !== s2.grade || s1.group !== s2.group)) {
            list.push({
              type: 'classroom',
              message: `El aula ${s1.classroom} está ocupada simultáneamente por ${s1.level} ${s1.grade}° ${s1.group} y ${s2.level} ${s2.grade}° ${s2.group}`,
              slot1: s1,
              slot2: s2
            });
          }
        }
      }
    }
    return list;
  }, [schedules]);

  // Detailed metrics for lessons and teacher loads
  const contractMetrics = useMemo(() => {
    // 1. Map contract key -> total weekly hours assigned
    const contractWeeklyAssigned: Record<string, number> = {};
    // 2. Map contract key -> hours assigned by day (1-5)
    const contractDailyAssigned: Record<string, Record<number, number>> = {};
    
    // 3. Map teacherId -> total weekly hours assigned
    const teacherWeeklyAssigned: Record<string, number> = {};
    // 4. Map teacherId -> hours assigned by day (1-5)
    const teacherDailyAssigned: Record<string, Record<number, number>> = {};

    // Initialize maps for all active contracts to guarantee keys exist
    contracts.forEach(c => {
      const key = `${c.subjectId}_${c.level}_${c.grade}_${c.group}_${c.teacherId}`;
      contractWeeklyAssigned[key] = 0;
      contractDailyAssigned[key] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    });

    // Process all placed schedule slots
    schedules.forEach(s => {
      const key = `${s.subjectId}_${s.level}_${s.grade}_${s.group}_${s.teacherId}`;
      
      // Increment contract counters (initialize dynamically if not exists)
      if (contractWeeklyAssigned[key] === undefined) {
        contractWeeklyAssigned[key] = 0;
        contractDailyAssigned[key] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      }
      contractWeeklyAssigned[key]++;
      if (contractDailyAssigned[key]) {
        contractDailyAssigned[key][s.day] = (contractDailyAssigned[key][s.day] || 0) + 1;
      }

      // Increment teacher counters
      if (s.teacherId) {
        teacherWeeklyAssigned[s.teacherId] = (teacherWeeklyAssigned[s.teacherId] || 0) + 1;
        if (!teacherDailyAssigned[s.teacherId]) {
          teacherDailyAssigned[s.teacherId] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        }
        teacherDailyAssigned[s.teacherId][s.day] = (teacherDailyAssigned[s.teacherId][s.day] || 0) + 1;
      }
    });

    // Compute global metrics counts
    let unassignedContractsCount = 0;
    let inProgressContractsCount = 0;
    let overloadedContractsCount = 0;

    contracts.forEach(c => {
      const key = `${c.subjectId}_${c.level}_${c.grade}_${c.group}_${c.teacherId}`;
      const total = contractWeeklyAssigned[key] || 0;
      const daily = contractDailyAssigned[key] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      
      let hasOverload = false;
      for (let d = 1; d <= 5; d++) {
        const limit = (c.customPeriodsPerDay && c.customPeriodsPerDay[d.toString()] !== undefined)
          ? Number(c.customPeriodsPerDay[d.toString()])
          : c.periodsPerDay;
        if ((daily[d] || 0) > limit) {
          hasOverload = true;
        }
      }

      if (total === 0) {
        unassignedContractsCount++;
      } else if (hasOverload) {
        overloadedContractsCount++;
      } else {
        inProgressContractsCount++;
      }
    });

    // Count overloaded teachers
    let overloadedTeachersCount = 0;
    teachers.forEach(t => {
      const weeklyLimit = t.maxHoursPerWeek || 0;
      const dailyLimit = t.maxHoursPerDay || 0;
      const totalWeekly = teacherWeeklyAssigned[t.id] || 0;
      const dailyHours = teacherDailyAssigned[t.id] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      let exceeds = false;
      if (weeklyLimit > 0 && totalWeekly > weeklyLimit) {
        exceeds = true;
      }
      if (dailyLimit > 0) {
        for (let d = 1; d <= 5; d++) {
          if ((dailyHours[d] || 0) > dailyLimit) {
            exceeds = true;
          }
        }
      }
      if (exceeds) {
        overloadedTeachersCount++;
      }
    });

    return {
      contractWeeklyAssigned,
      contractDailyAssigned,
      teacherWeeklyAssigned,
      teacherDailyAssigned,
      unassignedContractsCount,
      inProgressContractsCount,
      overloadedContractsCount,
      overloadedTeachersCount,
      totalScheduledHours: schedules.length
    };
  }, [contracts, schedules, teachers]);

  // Check if a single cell has a conflict
  const getCellConflicts = (day: number, periodIndex: number) => {
    return conflicts.filter(c => 
      (c.slot1.day === day && c.slot1.periodIndex === periodIndex && 
       (viewMode === 'group' && c.slot1.level === selectedLevel && c.slot1.grade === selectedGrade && c.slot1.group === selectedGroup ||
        viewMode === 'teacher' && c.slot1.teacherId === selectedTeacherId ||
        viewMode === 'classroom' && c.slot1.classroom === selectedClassroom ||
        viewMode === 'master')) ||
      (c.slot2.day === day && c.slot2.periodIndex === periodIndex && 
       (viewMode === 'group' && c.slot2.level === selectedLevel && c.slot2.grade === selectedGrade && c.slot2.group === selectedGroup ||
        viewMode === 'teacher' && c.slot2.teacherId === selectedTeacherId ||
        viewMode === 'classroom' && c.slot2.classroom === selectedClassroom ||
        viewMode === 'master'))
    );
  };

  // Add a contract
  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCycleId || !newContract.level || !newContract.grade || !newContract.group || !newContract.subjectId || !newContract.teacherId) {
      toast.error('Por favor completa todos los campos del contrato.');
      return;
    }
    
    try {
      const subject = subjects.find(s => s.id === newContract.subjectId);
      const teacher = teachers.find(t => t.id === newContract.teacherId);
      
      const contractData: any = {
        cycleId: selectedCycleId,
        level: newContract.level,
        grade: newContract.grade,
        group: newContract.group,
        subjectId: newContract.subjectId,
        subjectName: subject?.name || 'Materia',
        teacherId: newContract.teacherId,
        teacherName: teacher?.name || 'Docente',
        classroom: newContract.classroom || '',
      };

      if (isSpecialSchedule) {
        contractData.customPeriodsPerDay = {
          "1": Number(specialScheduleHours["1"] || 0),
          "2": Number(specialScheduleHours["2"] || 0),
          "3": Number(specialScheduleHours["3"] || 0),
          "4": Number(specialScheduleHours["4"] || 0),
          "5": Number(specialScheduleHours["5"] || 0)
        };
        // Set periodsPerDay to max daily value (retrocompatibility fallback)
        contractData.periodsPerDay = Math.max(1, ...Object.values(contractData.customPeriodsPerDay).map(v => Number(v)));
      } else {
        contractData.periodsPerDay = Number(newContract.periodsPerDay || 1);
      }

      await addDoc(collection(db, 'schedule_contracts'), contractData);
      toast.success('Lección agregada correctamente.');
      setIsContractModalOpen(false);
      
      // Auto-update main filters so the user sees the newly registered lesson
      if (newContract.level) setSelectedLevel(newContract.level);
      if (newContract.grade) setSelectedGrade(newContract.grade);
      if (newContract.group) setSelectedGroup(newContract.group);

      setNewContract({
        level: newContract.level || '',
        grade: newContract.grade || '',
        group: newContract.group || '',
        subjectId: '',
        teacherId: '',
        classroom: '',
        periodsPerDay: 1
      });
      setIsSpecialSchedule(false);
      setSpecialScheduleHours({ "1": 1, "2": 1, "3": 1, "4": 1, "5": 1 });
    } catch (err: any) {
      console.error(err);
      toast.error('Error al agregar lección.');
    }
  };

  // Delete a contract
  const handleDeleteContract = async (id: string) => {
    const contract = contracts.find(c => c.id === id);
    if (!contract) return;

    if (!window.confirm(`¿Seguro que deseas eliminar esta asignación de lección (${contract.subjectName})? Se quitarán todas sus horas asignadas del horario.`)) return;
    
    try {
      const batch = writeBatch(db);
      
      // Delete the contract document
      batch.delete(doc(db, 'schedule_contracts', id));
      
      // Find matching scheduled slots in the current cycle
      const matchingSlots = schedules.filter(s => 
        s.cycleId === selectedCycleId &&
        s.level === contract.level &&
        s.grade === contract.grade &&
        s.group === contract.group &&
        s.subjectId === contract.subjectId &&
        s.teacherId === contract.teacherId
      );
      
      // Add deletes for matching slots
      matchingSlots.forEach(slot => {
        if (slot.id) {
          batch.delete(doc(db, 'schedules', slot.id));
        }
      });

      await batch.commit();
      toast.success('Lección y sus clases asignadas eliminadas correctamente.');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al eliminar lección y sus horarios.');
    }
  };

  // Manual Cell placement click
  const handleMoveOrSwap = async (sourceSlot: ScheduleSlot, targetDay: number, targetPeriodIdx: number) => {
    if (!selectedCycleId) return;

    const sourceDay = sourceSlot.day;
    const sourcePeriodIdx = sourceSlot.periodIndex;

    // If target cell is the same, cancel move
    if (sourceDay === targetDay && sourcePeriodIdx === targetPeriodIdx) {
      setMovingSlot(null);
      return;
    }

    // Find if there's an existing slot at the destination cell (for active grid layout)
    const existingAtTarget = schedules.find(s => 
      s.cycleId === selectedCycleId &&
      s.day === targetDay && 
      s.periodIndex === targetPeriodIdx &&
      (viewMode === 'group' ? (s.level === selectedLevel && s.grade === selectedGrade && s.group === selectedGroup) : true) &&
      (viewMode === 'teacher' ? (s.teacherId === selectedTeacherId) : true) &&
      (viewMode === 'classroom' ? (s.classroom === selectedClassroom) : true)
    );

    // Validate Daily Limit for source teacher at targetDay
    const sourceTeacherObj = teachers.find(t => t.id === sourceSlot.teacherId);
    const sourceMaxDaily = sourceTeacherObj?.maxHoursPerDay;
    if (sourceMaxDaily !== undefined && sourceMaxDaily !== null) {
      const currentTargetDaily = schedules.filter(s => 
        s.id !== sourceSlot.id && 
        s.teacherId === sourceSlot.teacherId && 
        s.day === targetDay
      ).length;
      if (currentTargetDaily + 1 > sourceMaxDaily) {
        toast.error(`No se puede mover: El docente ${sourceSlot.teacherName} ha alcanzado su límite de ${sourceMaxDaily} horas para el día ${DAYS_OF_WEEK.find(d => d.id === targetDay)?.name}.`);
        setMovingSlot(null);
        return;
      }
    }

    // Validate Daily Limit for target teacher at sourceDay if swapping
    if (existingAtTarget) {
      const targetTeacherObj = teachers.find(t => t.id === existingAtTarget.teacherId);
      const targetMaxDaily = targetTeacherObj?.maxHoursPerDay;
      if (targetMaxDaily !== undefined && targetMaxDaily !== null) {
        const currentSourceDaily = schedules.filter(s => 
          s.id !== existingAtTarget.id && 
          s.teacherId === existingAtTarget.teacherId && 
          s.day === sourceDay
        ).length;
        if (currentSourceDaily + 1 > targetMaxDaily) {
          toast.error(`No se puede intercambiar: El docente ${existingAtTarget.teacherName} ha alcanzado su límite de ${targetMaxDaily} horas para el día ${DAYS_OF_WEEK.find(d => d.id === sourceDay)?.name}.`);
          setMovingSlot(null);
          return;
        }
      }
    }

    try {

      if (existingAtTarget) {
        // Swap! Update source to target's position, and target to source's position
        const batch = writeBatch(db);
        const sourceRef = doc(db, 'schedules', sourceSlot.id!);
        const targetRef = doc(db, 'schedules', existingAtTarget.id!);

        const { id: sourceId, ...sourceData } = sourceSlot;
        const { id: targetId, ...targetData } = existingAtTarget;

        batch.set(sourceRef, {
          ...sourceData,
          day: targetDay,
          periodIndex: targetPeriodIdx,
          updatedAt: serverTimestamp()
        });

        batch.set(targetRef, {
          ...targetData,
          day: sourceDay,
          periodIndex: sourcePeriodIdx,
          updatedAt: serverTimestamp()
        });

        await batch.commit();
        toast.success('Clases intercambiadas con éxito.');
      } else {
        // Simple move
        const docRef = doc(db, 'schedules', sourceSlot.id!);
        const { id: sourceId, ...sourceData } = sourceSlot;
        await setDoc(docRef, {
          ...sourceData,
          day: targetDay,
          periodIndex: targetPeriodIdx,
          updatedAt: serverTimestamp()
        }, { merge: true });

        toast.success('Clase movida con éxito.');
      }
    } catch (error) {
      console.error('Error moving schedule slot:', error);
      toast.error('Error al reubicar la clase.');
    } finally {
      setMovingSlot(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, slot: ScheduleSlot) => {
    if (!isAdmin) return;
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDay: number, targetPeriodIdx: number) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedSlot) return;
    handleMoveOrSwap(draggedSlot, targetDay, targetPeriodIdx);
    setDraggedSlot(null);
  };

  const handleQuickDelete = async (slot: ScheduleSlot) => {
    if (!slot.id) return;
    if (!window.confirm(`¿Seguro que deseas quitar la clase de ${slot.subjectName}?`)) return;
    try {
      await deleteDoc(doc(db, 'schedules', slot.id));
      toast.success('Clase quitada del horario.');
    } catch (err) {
      console.error(err);
      toast.error('Error al quitar la clase.');
    }
  };

  const handleSaveClassroom = async () => {
    if (!selectedCell) return;
    const existing = getCellSlot(selectedCell.day, selectedCell.periodIndex);
    if (!existing || !existing.id) return;

    try {
      const docRef = doc(db, 'schedules', existing.id);
      await setDoc(docRef, { classroom: editClassroom, updatedAt: serverTimestamp() }, { merge: true });
      toast.success('Aula actualizada correctamente.');
      setIsCellModalOpen(false);
      setSelectedCell(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar el aula.');
    }
  };

  const handleCellClick = (day: number, periodIndex: number) => {
    if (!isAdmin) return; // Read-only

    if (movingSlot) {
      handleMoveOrSwap(movingSlot, day, periodIndex);
      return;
    }

    setSelectedCell({ day, periodIndex });
    const slot = getCellSlot(day, periodIndex);
    setEditClassroom(slot?.classroom || '');
    setIsCellModalOpen(true);
  };

  const handleAssignLessonToCell = async (contract: ClassContract | 'delete') => {
    if (!selectedCell || !selectedCycleId) return;
    
    // Find if there's an existing slot
    const existing = getCellSlot(selectedCell.day, selectedCell.periodIndex);
    
    try {
      if (contract === 'delete') {
        if (existing?.id) {
          await deleteDoc(doc(db, 'schedules', existing.id));
          toast.success('Clase quitada del módulo.');
        }
      } else {
        // Validate teacher capacity limits
        const teacherObj = teachers.find(t => t.id === contract.teacherId);
        const maxWeekly = teacherObj?.maxHoursPerWeek;
        const maxDaily = teacherObj?.maxHoursPerDay;

        const otherSchedules = schedules.filter(s => s.id !== existing?.id && s.teacherId === contract.teacherId);

        if (maxWeekly !== undefined && maxWeekly !== null) {
          const currentWeeklyHours = otherSchedules.length;
          if (currentWeeklyHours >= maxWeekly) {
            toast.error(`No se puede asignar: El docente ${contract.teacherName} ha alcanzado su límite de ${maxWeekly} horas por semana.`);
            return;
          }
        }

        if (maxDaily !== undefined && maxDaily !== null) {
          const currentDailyHours = otherSchedules.filter(s => s.day === selectedCell.day).length;
          if (currentDailyHours >= maxDaily) {
            toast.error(`No se puede asignar: El docente ${contract.teacherName} ha alcanzado su límite de ${maxDaily} horas para el día ${DAYS_OF_WEEK.find(d => d.id === selectedCell.day)?.name}.`);
            return;
          }
        }

        // Validate daily limit for the contract (materia)
        const currentContractPlacedOnDay = schedules.filter(s =>
          s.cycleId === selectedCycleId &&
          s.level === contract.level &&
          s.grade === contract.grade &&
          s.group === contract.group &&
          s.subjectId === contract.subjectId &&
          s.day === selectedCell.day &&
          s.id !== existing?.id
        ).length;

        const limitForDay = (contract.customPeriodsPerDay && contract.customPeriodsPerDay[selectedCell.day.toString()] !== undefined)
          ? Number(contract.customPeriodsPerDay[selectedCell.day.toString()])
          : contract.periodsPerDay;

        if (currentContractPlacedOnDay >= limitForDay) {
          toast.error(`No se puede asignar: Ya se han asignado las ${limitForDay} horas diarias permitidas para esta materia.`);
          return;
        }

        const slotData: ScheduleSlot = {
          cycleId: selectedCycleId,
          level: (viewMode === 'group' || viewMode === 'master_groups') ? selectedLevel : contract.level,
          grade: (viewMode === 'group' || viewMode === 'master_groups') ? selectedGrade : contract.grade,
          group: (viewMode === 'group' || viewMode === 'master_groups') ? selectedGroup : contract.group,
          day: selectedCell.day,
          periodIndex: selectedCell.periodIndex,
          subjectId: contract.subjectId,
          subjectName: contract.subjectName,
          teacherId: contract.teacherId,
          teacherName: contract.teacherName,
          classroom: contract.classroom || ''
        };

        // Check if teacher is free before placing (warning, but allowed to place)
        const busyTeacherSlot = schedules.find(s => 
          s.day === selectedCell.day && 
          s.periodIndex === selectedCell.periodIndex && 
          s.teacherId === contract.teacherId &&
          s.id !== existing?.id
        );

        if (busyTeacherSlot) {
          toast.warning(`Atención: El docente ${contract.teacherName} ya tiene clase con ${busyTeacherSlot.level} ${busyTeacherSlot.grade}° ${busyTeacherSlot.group} a esta hora.`);
        }

        if (existing?.id) {
          const docRef = doc(db, 'schedules', existing.id);
          await setDoc(docRef, { ...slotData, updatedAt: serverTimestamp() }, { merge: true });
        } else {
          await addDoc(collection(db, 'schedules'), { ...slotData, updatedAt: serverTimestamp() });
        }
        toast.success('Clase asignada al horario.');
      }
      setIsCellModalOpen(false);
      setSelectedCell(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar asignación.');
    }
  };

  // BACKTRACKING SOLVER ALGORITHM (aSc timetables generator simulation)
  const handleAutoGenerate = async () => {
    if (contracts.length === 0) {
      toast.error('No hay lecciones configuradas para este ciclo. Agrega materias en la pestaña de Lecciones primero.');
      return;
    }

    if (!window.confirm('Esta acción recreará completamente los horarios de este ciclo. Se borrarán las asignaciones manuales actuales. ¿Deseas continuar?')) return;

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStep('Inicializando generador...');

    setTimeout(async () => {
      try {
        setGenerationStep('Analizando restricciones de docentes...');
        setGenerationProgress(15);
        
        // Simulating the generator work
        await new Promise(resolve => setTimeout(resolve, 800));
        setGenerationStep('Ordenando contratos por nivel de complejidad...');
        setGenerationProgress(30);
        
        await new Promise(resolve => setTimeout(resolve, 800));
        setGenerationStep('Distribuyendo materias clave (Español, Matemáticas)...');
        setGenerationProgress(50);
        
        // Execute solver
        const result = solveSchedules(contracts, selectedCycleId);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        setGenerationStep('Resolviendo empalmes de aulas y profesores...');
        setGenerationProgress(75);

        await new Promise(resolve => setTimeout(resolve, 800));
        
        if (result.success) {
          setGenerationStep('Optimizando huecos en horarios...');
          setGenerationProgress(90);
          await new Promise(resolve => setTimeout(resolve, 600));

          // Save to firebase
          await saveSchedulesBatch(selectedCycleId, result.slots);
          toast.success('¡Horarios generados automáticamente sin conflictos!');
        } else {
          // If partial solver result, save anyway but warn the user
          await saveSchedulesBatch(selectedCycleId, result.slots);
          toast.warning(`Horario generado con éxito, pero ${result.unplaced.length} lecciones no pudieron colocarse debido a restricciones severas.`);
        }
      } catch (err: any) {
        console.error(err);
        toast.error('Fallo en el proceso de generación automática.');
      } finally {
        setIsGenerating(false);
        setGenerationProgress(100);
      }
    }, 200);
  };

  const handleClearTimetable = async () => {
    if (!selectedCycleId) return;
    if (!window.confirm('¿Seguro que deseas limpiar todo el horario de este ciclo escolar? Se eliminarán permanentemente todas las clases asignadas en la cuadrícula, pero se conservarán las lecciones configuradas.')) return;
    
    try {
      await clearSchedulesForCycle(selectedCycleId);
      toast.success('Horario limpiado por completo. Puedes comenzar a asignar de cero.');
    } catch (err) {
      console.error(err);
      toast.error('Error al limpiar el horario.');
    }
  };

  // Solve schedules local helper
  const solveSchedules = (contractsList: ClassContract[], cycleId: string) => {
    let slots: ScheduleSlot[] = [];
    
    // Sort contracts by difficulty (most periods per week first)
    const sorted = [...contractsList].sort((a, b) => b.periodsPerDay - a.periodsPerDay);
    
    const busyTeachers = new Set<string>(); // "teacherId_day_period"
    const busyGroups = new Set<string>(); // "level_grade_group_day_period"
    const busyClassrooms = new Set<string>(); // "classroom_day_period"
    const subjectCountPerDay = new Map<string, number>(); // "level_grade_group_day_subjectId" -> count
    const teacherWeeklyHours = new Map<string, number>(); // teacherId -> count
    const teacherDailyHours = new Map<string, number>(); // teacherId_day -> count
    
    let statesVisited = 0;
    
    const addBusy = (slot: ScheduleSlot) => {
      const { level, grade, group, day, periodIndex, teacherId, subjectId, classroom } = slot;
      busyTeachers.add(`${teacherId}_${day}_${periodIndex}`);
      busyGroups.add(`${level}_${grade}_${group}_${day}_${periodIndex}`);
      if (classroom) {
        busyClassrooms.add(`${classroom}_${day}_${periodIndex}`);
      }
      const key = `${level}_${grade}_${group}_${day}_${subjectId}`;
      subjectCountPerDay.set(key, (subjectCountPerDay.get(key) || 0) + 1);
      
      // Track teacher hours
      teacherWeeklyHours.set(teacherId, (teacherWeeklyHours.get(teacherId) || 0) + 1);
      const dailyKey = `${teacherId}_${day}`;
      teacherDailyHours.set(dailyKey, (teacherDailyHours.get(dailyKey) || 0) + 1);
    };
    
    const removeBusy = (slot: ScheduleSlot) => {
      const { level, grade, group, day, periodIndex, teacherId, subjectId, classroom } = slot;
      busyTeachers.delete(`${teacherId}_${day}_${periodIndex}`);
      busyGroups.delete(`${level}_${grade}_${group}_${day}_${periodIndex}`);
      if (classroom) {
        busyClassrooms.delete(`${classroom}_${day}_${periodIndex}`);
      }
      const key = `${level}_${grade}_${group}_${day}_${subjectId}`;
      const cnt = subjectCountPerDay.get(key) || 0;
      if (cnt <= 1) subjectCountPerDay.delete(key);
      else subjectCountPerDay.set(key, cnt - 1);
      
      // Untrack teacher hours
      const weeklyCnt = teacherWeeklyHours.get(teacherId) || 0;
      if (weeklyCnt <= 1) teacherWeeklyHours.delete(teacherId);
      else teacherWeeklyHours.set(teacherId, weeklyCnt - 1);
      
      const dailyKey = `${teacherId}_${day}`;
      const dailyCnt = teacherDailyHours.get(dailyKey) || 0;
      if (dailyCnt <= 1) teacherDailyHours.delete(dailyKey);
      else teacherDailyHours.set(dailyKey, dailyCnt - 1);
    };
    
    const isValid = (contract: ClassContract, day: number, period: number) => {
      const { level, grade, group, teacherId, subjectId, classroom } = contract;
      if (busyTeachers.has(`${teacherId}_${day}_${period}`)) return false;
      if (busyGroups.has(`${level}_${grade}_${group}_${day}_${period}`)) return false;
      if (classroom && busyClassrooms.has(`${classroom}_${day}_${period}`)) return false;
      
      // Limit of the subject for this specific day
      const dailyLimit = (contract.customPeriodsPerDay && contract.customPeriodsPerDay[day.toString()] !== undefined)
        ? Number(contract.customPeriodsPerDay[day.toString()])
        : contract.periodsPerDay;

      const key = `${level}_${grade}_${group}_${day}_${subjectId}`;
      if ((subjectCountPerDay.get(key) || 0) >= dailyLimit) return false;

      // Validate teacher capacity limits
      const teacherObj = teachers.find(t => t.id === teacherId);
      const maxWeekly = teacherObj?.maxHoursPerWeek;
      const maxDaily = teacherObj?.maxHoursPerDay;

      if (maxWeekly !== undefined && maxWeekly !== null) {
        const weeklyScheduled = teacherWeeklyHours.get(teacherId) || 0;
        if (weeklyScheduled >= maxWeekly) return false;
      }

      if (maxDaily !== undefined && maxDaily !== null) {
        const dailyKey = `${teacherId}_${day}`;
        const dailyScheduled = teacherDailyHours.get(dailyKey) || 0;
        if (dailyScheduled >= maxDaily) return false;
      }
      
      return true;
    };
    
    // Backtracking recursive search
    const solve = (contractIndex: number, periodCount: number): boolean => {
      statesVisited++;
      if (statesVisited > 10000) {
        return false; // Safely exit recursion to avoid locking the UI thread
      }
      
      if (contractIndex >= sorted.length) {
        return true;
      }
      
      const contract = sorted[contractIndex];
      const weeklyLimit = contract.customPeriodsPerDay
        ? Object.values(contract.customPeriodsPerDay).reduce((sum, val) => sum + Number(val || 0), 0)
        : contract.periodsPerDay * 5;

      if (periodCount >= weeklyLimit) {
        return solve(contractIndex + 1, 0);
      }
      
      const options: { day: number; period: number }[] = [];
      for (let d = 1; d <= 5; d++) {
        const dailyLimit = (contract.customPeriodsPerDay && contract.customPeriodsPerDay[d.toString()] !== undefined)
          ? Number(contract.customPeriodsPerDay[d.toString()])
          : contract.periodsPerDay;
        if (dailyLimit <= 0) continue;

        for (let p = 0; p < 7; p++) {
          options.push({ day: d, period: p });
        }
      }
      
      // Shuffle options to generate variety
      options.sort(() => Math.random() - 0.5);
      
      for (const opt of options) {
        if (isValid(contract, opt.day, opt.period)) {
          const newSlot: ScheduleSlot = {
            cycleId,
            level: contract.level,
            grade: contract.grade,
            group: contract.group,
            day: opt.day,
            periodIndex: opt.period,
            subjectId: contract.subjectId,
            subjectName: contract.subjectName,
            teacherId: contract.teacherId,
            teacherName: contract.teacherName,
            classroom: contract.classroom || ''
          };
          
          slots.push(newSlot);
          addBusy(newSlot);
          
          if (solve(contractIndex, periodCount + 1)) {
            return true;
          }
          
          // Backtrack
          slots.pop();
          removeBusy(newSlot);
        }
      }
      return false;
    };
    
    // Try solving up to 5 times
    let success = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      slots = [];
      busyTeachers.clear();
      busyGroups.clear();
      busyClassrooms.clear();
      subjectCountPerDay.clear();
      teacherWeeklyHours.clear();
      teacherDailyHours.clear();
      statesVisited = 0;
      
      if (solve(0, 0)) {
        success = true;
        break;
      }
    }
    
    // Fallback greedy placing
    if (!success) {
      slots = [];
      busyTeachers.clear();
      busyGroups.clear();
      busyClassrooms.clear();
      subjectCountPerDay.clear();
      
      const unplaced: ClassContract[] = [];
      for (const contract of sorted) {
        let placedCount = 0;
        const weeklyLimit = contract.customPeriodsPerDay
          ? Object.values(contract.customPeriodsPerDay).reduce((sum, val) => sum + Number(val || 0), 0)
          : contract.periodsPerDay * 5;

        for (let i = 0; i < weeklyLimit; i++) {
          let placed = false;
          
          outer: for (let d = 1; d <= 5; d++) {
            const dailyLimit = (contract.customPeriodsPerDay && contract.customPeriodsPerDay[d.toString()] !== undefined)
              ? Number(contract.customPeriodsPerDay[d.toString()])
              : contract.periodsPerDay;
            if (dailyLimit <= 0) continue;

            for (let p = 0; p < 7; p++) {
              if (isValid(contract, d, p)) {
                const newSlot: ScheduleSlot = {
                  cycleId,
                  level: contract.level,
                  grade: contract.grade,
                  group: contract.group,
                  day: d,
                  periodIndex: p,
                  subjectId: contract.subjectId,
                  subjectName: contract.subjectName,
                  teacherId: contract.teacherId,
                  teacherName: contract.teacherName,
                  classroom: contract.classroom || ''
                };
                slots.push(newSlot);
                addBusy(newSlot);
                placed = true;
                placedCount++;
                break outer;
              }
            }
          }
          
          if (!placed) {
            unplaced.push({ ...contract, periodsPerDay: Math.max(1, weeklyLimit - placedCount) });
            break;
          }
        }
      }
      return { success: false, slots, unplaced };
    }
    
    return { success: true, slots, unplaced: [] };
  };

  // Substitution logic
  const handleOpenSubModal = (day: number, periodIndex: number) => {
    setSelectedSubDay(day);
    setSelectedSubPeriod(periodIndex);
    setSubstituteTeacherId('');
    setIsSubModalOpen(true);
  };

  // Find teachers available for the specific day & period (no assignments)
  const availableSubstitutes = useMemo(() => {
    if (selectedSubDay === null || selectedSubPeriod === null) return [];
    
    return teachers.filter(t => {
      // 1. Cannot be the absent teacher
      if (t.id === absentTeacherId) return false;
      
      // 2. Must not be teaching anyone else during that time slot
      const isBusy = schedules.some(s => 
        s.day === selectedSubDay && 
        s.periodIndex === selectedSubPeriod && 
        s.teacherId === t.id
      );
      
      return !isBusy;
    });
  }, [selectedSubDay, selectedSubPeriod, absentTeacherId, teachers, schedules]);

  const handleAddSubstitution = async () => {
    if (selectedSubDay === null || selectedSubPeriod === null || !absentTeacherId || !substituteTeacherId) {
      toast.error('Selecciona el docente suplente.');
      return;
    }

    try {
      const absent = teachers.find(t => t.id === absentTeacherId);
      const sub = teachers.find(t => t.id === substituteTeacherId);

      await addSubstitution({
        date: subDate,
        day: selectedSubDay,
        periodIndex: selectedSubPeriod,
        absentTeacherId,
        absentTeacherName: absent?.name || 'Ausente',
        substituteTeacherId,
        substituteTeacherName: sub?.name || 'Suplente',
        reason: newSubReason,
        status: 'Confirmada'
      });

      toast.success('Sustitución registrada con éxito.');
      setIsSubModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al registrar sustitución.');
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta sustitución?')) return;
    try {
      await deleteSubstitution(id);
      toast.success('Sustitución cancelada.');
    } catch (err: any) {
      toast.error('Error al cancelar.');
    }
  };

  // Print schedules helper
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 font-sans tracking-tight max-w-[1600px] mx-auto print:p-0 print:m-0">
      
      {/* aSc Generator Loading Screen */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center flex-col text-white p-6"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="mb-8"
            >
              <Sparkles size={64} className="text-indigo-400" />
            </motion.div>
            
            <h2 className="text-2xl font-black uppercase tracking-widest text-indigo-300">Generador Automático de Horarios</h2>
            <p className="text-slate-400 font-medium text-sm mt-2 max-w-md text-center">
              Evaluando millones de combinaciones para crear el horario óptimo...
            </p>
            
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-full h-3 overflow-hidden mt-8">
              <motion.div 
                className="bg-indigo-500 h-full"
                animate={{ width: `${generationProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            
            <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest mt-4 animate-pulse">
              {generationStep}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
              Módulo de Programación Escolar
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Horarios y Clases
            <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded uppercase tracking-widest">
              aSc Engine
            </span>
          </h1>
        </div>

        {/* Tab & Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'editor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Horarios
            </button>
            <button
              onClick={() => setActiveTab('substitutions')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'substitutions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sustituciones
            </button>
          </div>

          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm outline-none"
          >
            {cycles.map(cy => (
              <option key={cy.id} value={cy.id}>{cy.name}</option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl shadow-sm transition-all"
            title="Imprimir Horario"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Main Tab Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Info & Filters & Contracts list */}
        <div className="lg:col-span-3 space-y-6 print:hidden">
          
          {/* Editor Filters */}
          {activeTab === 'editor' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">
                Filtros de Cuadrícula
              </h3>

              <div className="space-y-4">
                {/* View Mode */}
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Modo de Vista
                  </label>
                  <div className="grid grid-cols-5 gap-1 p-1 bg-slate-50 rounded-lg border border-slate-100">
                    {(['group', 'teacher', 'classroom', 'master', 'master_groups'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => {
                          setViewMode(mode);
                          // Reset selections
                        }}
                        disabled={isTeacher && mode !== 'teacher' || isParent && mode !== 'group'}
                        className={`py-1.5 text-[8px] font-bold rounded capitalize transition-all ${
                          viewMode === mode 
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                            : 'text-slate-400 hover:text-slate-700 disabled:opacity-40'
                        }`}
                      >
                        {mode === 'group' 
                          ? 'Grupo' 
                          : mode === 'teacher' 
                          ? 'Docente' 
                          : mode === 'classroom' 
                          ? 'Aula' 
                          : mode === 'master' 
                          ? 'Docente G.' 
                          : 'Materia G.'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional dropdowns based on mode */}
                {(viewMode === 'master' || viewMode === 'master_groups') && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nivel Escolar</label>
                      <select
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                      >
                        {settings?.academicLevels?.map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {viewMode === 'group' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nivel</label>
                      <select
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        disabled={isParent}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                      >
                        {settings?.academicLevels?.map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Grado</label>
                        <select
                          value={selectedGrade}
                          onChange={(e) => setSelectedGrade(e.target.value)}
                          disabled={isParent}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                        >
                          {settings?.academicGrades?.map(grd => (
                            <option key={grd} value={grd}>{grd}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Grupo</label>
                        <select
                          value={selectedGroup}
                          onChange={(e) => setSelectedGroup(e.target.value)}
                          disabled={isParent}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                        >
                          {settings?.academicGroups?.map(grp => (
                            <option key={grp} value={grp}>{grp}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isParent && parentStudents.length > 0 && (
                      <div className="pt-2">
                        <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Hijo Seleccionado</label>
                        <select
                          onChange={(e) => {
                            const student = parentStudents.find(s => s.id === e.target.value);
                            if (student) {
                              setSelectedLevel(student.level);
                              setSelectedGrade(student.grade);
                              setSelectedGroup(student.group || '');
                            }
                          }}
                          className="w-full px-3 py-2 bg-rose-50/50 border border-rose-100 rounded-lg text-xs font-bold outline-none"
                        >
                          {parentStudents.map(student => (
                            <option key={student.id} value={student.id}>{student.lastName} {student.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === 'teacher' && (
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Docente</label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      disabled={isTeacher}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                    >
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {viewMode === 'classroom' && (
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Aula Física</label>
                    <select
                      value={selectedClassroom}
                      onChange={(e) => setSelectedClassroom(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                    >
                      {classrooms.map(room => (
                        <option key={room} value={room}>{room}</option>
                      ))}
                    </select>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* List of Contracts / Lessons (Administrators only) */}
          {activeTab === 'editor' && isAdmin && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Lecciones ({contracts.length})
                </h3>
                <button
                  onClick={() => {
                    setNewContract({
                      level: selectedLevel,
                      grade: selectedGrade,
                      group: selectedGroup,
                      subjectId: '',
                      teacherId: '',
                      classroom: '',
                      periodsPerDay: 1
                    });
                    setIsContractModalOpen(true);
                  }}
                  className="p-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"
                  title="Nueva Lección"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Resumen de Horarios */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="bg-white p-2 rounded-lg border border-slate-200/60 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock size={11} className="text-indigo-500" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Hrs Semanal</span>
                  </div>
                  <span className="text-sm font-black text-slate-800">{contractMetrics.totalScheduledHours}</span>
                </div>
                
                <div className="bg-white p-2 rounded-lg border border-slate-200/60 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-slate-400">
                    <AlertCircle size={11} className={contractMetrics.unassignedContractsCount > 0 ? "text-amber-500" : "text-slate-400"} />
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Sin Asignar</span>
                  </div>
                  <span className="text-sm font-black text-slate-800">{contractMetrics.unassignedContractsCount}</span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200/60 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-slate-400">
                    <CheckCircle size={11} className="text-emerald-500" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">En Progreso</span>
                  </div>
                  <span className="text-sm font-black text-slate-800">{contractMetrics.inProgressContractsCount}</span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200/60 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-slate-400">
                    <AlertTriangle size={11} className={contractMetrics.overloadedContractsCount + contractMetrics.overloadedTeachersCount > 0 ? "text-rose-500 animate-pulse" : "text-slate-400"} />
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Sobrecargas</span>
                  </div>
                  <span className={`text-sm font-black ${contractMetrics.overloadedContractsCount + contractMetrics.overloadedTeachersCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-800'}`}>
                    {contractMetrics.overloadedContractsCount + contractMetrics.overloadedTeachersCount}
                  </span>
                </div>
              </div>

              {/* Checkbox toggle to see all lessons */}
              <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterLessonsByGroup}
                    onChange={(e) => setFilterLessonsByGroup(e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    Filtrar por grupo actual
                  </span>
                </label>
              </div>

              <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                {contracts
                  .filter(c => !filterLessonsByGroup || (c.level === selectedLevel && c.grade === selectedGrade && c.group === selectedGroup))
                  .map(contract => {
                    const key = `${contract.subjectId}_${contract.level}_${contract.grade}_${contract.group}_${contract.teacherId}`;
                    const weeklyAssigned = contractMetrics.contractWeeklyAssigned[key] || 0;
                    const dailyAssigned = contractMetrics.contractDailyAssigned[key] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                    
                    const teacher = teachers.find(t => t.id === contract.teacherId);
                    const teacherWeeklyTotal = contractMetrics.teacherWeeklyAssigned[contract.teacherId] || 0;
                    const teacherWeeklyLimit = teacher?.maxHoursPerWeek || 0;
                    const teacherDailyLimit = teacher?.maxHoursPerDay || 0;
                    const teacherDailyAssigned = contractMetrics.teacherDailyAssigned[contract.teacherId] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                    
                    const isTeacherWeeklyOverloaded = teacherWeeklyLimit > 0 && teacherWeeklyTotal > teacherWeeklyLimit;
                    
                    let overloadedDays: string[] = [];
                    const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
                    if (teacherDailyLimit > 0) {
                      for (let d = 1; d <= 5; d++) {
                        if ((teacherDailyAssigned[d] || 0) > teacherDailyLimit) {
                          overloadedDays.push(dayNames[d]);
                        }
                      }
                    }

                    return (
                      <div 
                        key={contract.id} 
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1 relative group hover:shadow-sm transition-all duration-200"
                      >
                        <button
                          onClick={() => handleDeleteContract(contract.id!)}
                          className="absolute top-2.5 right-2.5 text-slate-350 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar Lección"
                        >
                          <Trash2 size={12} />
                        </button>
                        
                        <div className="flex justify-between items-start gap-2 pr-5">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tight line-clamp-1">{contract.subjectName}</span>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                            weeklyAssigned === 0 ? 'bg-slate-200/50 text-slate-500' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            {weeklyAssigned}h colocadas
                          </span>
                        </div>

                        <div className="text-[9px] font-bold text-slate-700 mt-0.5">
                          <span>Docente: {contract.teacherName}</span>
                          <div className={`text-[8px] font-semibold mt-0.5 ${
                            isTeacherWeeklyOverloaded ? 'text-rose-600 font-extrabold animate-pulse' : 'text-slate-500'
                          }`}>
                            Carga: {teacherWeeklyTotal}{teacherWeeklyLimit > 0 ? `/${teacherWeeklyLimit}` : ''} hrs/sem
                            {isTeacherWeeklyOverloaded && ' ⚠️ Excede límite'}
                          </div>
                          {overloadedDays.length > 0 && (
                            <div className="text-[7.5px] font-black text-rose-500 uppercase tracking-tight mt-0.5">
                              ⚠️ Exceso diario: {overloadedDays.join(', ')}
                            </div>
                          )}
                        </div>

                        {!filterLessonsByGroup && (
                          <span className="text-[8px] font-black text-indigo-500 uppercase tracking-wider mt-0.5">
                            Grupo: {contract.level} {contract.grade}°{contract.group}
                          </span>
                        )}

                        <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1 border-t border-slate-100 pt-1">
                          <span>Aula: {contract.classroom || 'Sin Asignar'}</span>
                          <span className="bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded text-[8.5px] tracking-tight">
                            {contract.customPeriodsPerDay ? 'Especial' : `${contract.periodsPerDay}h/día`}
                          </span>
                        </div>

                        {/* Mini-matriz de distribución diaria */}
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                            Distribución Semanal {contract.customPeriodsPerDay ? '(Horario Esp.)' : ''}
                          </span>
                          <div className="grid grid-cols-5 gap-1">
                            {[1, 2, 3, 4, 5].map(dayNum => {
                              const count = dailyAssigned[dayNum] || 0;
                              const limit = (contract.customPeriodsPerDay && contract.customPeriodsPerDay[dayNum.toString()] !== undefined)
                                ? Number(contract.customPeriodsPerDay[dayNum.toString()])
                                : contract.periodsPerDay;
                              
                              let bgStyle = 'bg-slate-100 text-slate-500 border-slate-200/50';
                              let tooltipText = `Sin asignar`;
                              
                              if (limit === 0 && count === 0) {
                                bgStyle = 'bg-slate-100 text-slate-350 border-slate-150 border-dashed opacity-50';
                                tooltipText = `No disponible`;
                              } else if (count > limit) {
                                bgStyle = 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-extrabold';
                                tooltipText = `Exceso: ${count}/${limit}h`;
                              } else if (count === limit) {
                                bgStyle = 'bg-emerald-50 text-emerald-700 border-emerald-250 font-black';
                                tooltipText = `Completo: ${count}/${limit}h`;
                              } else if (count > 0) {
                                bgStyle = 'bg-amber-50 text-amber-700 border-amber-250 font-bold';
                                tooltipText = `Asignado: ${count}/${limit}h`;
                              }
                              
                              const labels = ['', 'L', 'M', 'M', 'J', 'V'];
                              const fullDays = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

                              return (
                                <div 
                                  key={dayNum}
                                  className={`flex flex-col items-center justify-center py-1 rounded border text-center transition-all ${bgStyle}`}
                                  title={`${fullDays[dayNum]}: ${tooltipText}`}
                                >
                                  <span className="text-[7.5px] font-black uppercase opacity-60">{labels[dayNum]}</span>
                                  <span className="text-[9px] tracking-tighter mt-0.5">{count}/{limit}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                
                {contracts.filter(c => !filterLessonsByGroup || (c.level === selectedLevel && c.grade === selectedGrade && c.group === selectedGroup)).length === 0 && (
                  <p className="text-[10px] font-medium text-slate-400 text-center py-4 italic">
                    Sin lecciones configuradas. Pulsa "+" para agregar.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Conflict Panel */}
          {activeTab === 'editor' && conflicts.length > 0 && (
            <div className="bg-red-50 border border-red-150 rounded-2xl p-6 space-y-3 shadow-inner">
              <h3 className="text-xs font-black uppercase tracking-widest text-red-700 flex items-center gap-2">
                <AlertTriangle size={16} />
                Conflictos ({conflicts.length})
              </h3>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {conflicts.map((c, idx) => (
                  <div key={idx} className="p-2.5 bg-white rounded-lg border border-red-100 text-[9px] font-bold text-red-600 leading-relaxed">
                    {c.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Tools: Auto Scheduler */}
          {activeTab === 'editor' && isAdmin && (
            <div className="space-y-2.5">
              <button
                onClick={handleAutoGenerate}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                Generador Automático
              </button>
              <button
                onClick={handleClearTimetable}
                className="w-full bg-rose-50 hover:bg-rose-100/75 border border-rose-100 text-rose-600 font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
              >
                <Trash2 size={14} />
                Limpiar todo el Horario
              </button>
            </div>
          )}

          {/* Substitutions filters */}
          {activeTab === 'substitutions' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Parámetros de Ausencias
              </h3>
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={subDate}
                  onChange={(e) => setSubDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Reportar Docente Ausente</label>
                  <select
                    value={absentTeacherId}
                    onChange={(e) => setAbsentTeacherId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                  >
                    <option value="">-- Seleccionar Docente --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Column: Grid and Scheduler Workspace */}
        <div className="lg:col-span-9 space-y-6">

          {/* Tab 1: Editor / Grid */}
          {activeTab === 'editor' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col print:border-none print:shadow-none">
              
              {/* Grid Header Info */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/60 flex flex-col sm:flex-row justify-between sm:items-center gap-2 print:border-none print:bg-transparent">
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    {viewMode === 'group' && `Grupo: ${currentGroupKey}`}
                    {viewMode === 'teacher' && `Docente: ${teachers.find(t => t.id === selectedTeacherId)?.name || 'Cargando Docente...'}`}
                    {viewMode === 'classroom' && `Aula: ${selectedClassroom}`}
                    {viewMode === 'master' && `Horarios de Docentes: ${selectedLevel || 'Sin Nivel'}`}
                    {viewMode === 'master_groups' && `Horarios de Grupos: ${selectedLevel || 'Sin Nivel'}`}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Horario Semanal
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Vista actual: {
                      viewMode === 'group' 
                        ? 'Por Grupo' 
                        : viewMode === 'teacher' 
                        ? 'Por Docente' 
                        : viewMode === 'classroom' 
                        ? 'Por Aula' 
                        : viewMode === 'master'
                        ? 'Completa Docentes'
                        : 'Completa Grupos'
                    }
                  </span>
                </div>
              </div>

              {/* TIMETABLE GRID MATRIX */}
              <div className="overflow-x-auto print:overflow-visible">
                {movingSlot && (
                  <div className="p-4 bg-indigo-600 text-white flex items-center justify-between border-b border-indigo-700 animate-pulse">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Modo Reubicar Activo: Selecciona cualquier celda para mover o intercambiar la clase de "{movingSlot.subjectName}" ({movingSlot.teacherName}).
                      </span>
                    </div>
                    <button
                      onClick={() => setMovingSlot(null)}
                      className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                
                {viewMode === 'master_groups' ? (
                  <table className="w-full border-collapse text-left min-w-[900px] print:min-w-0 table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="w-[150px] px-4 py-3 bg-slate-50/50 text-[10px] font-black uppercase text-slate-500 tracking-wider sticky left-0 z-20 bg-slate-50 shadow-[1px_0_4px_rgba(0,0,0,0.03)]">
                          Grupo
                        </th>
                        {DAYS_OF_WEEK.map(day => (
                          <th 
                            key={day.id} 
                            className="px-4 py-3 bg-slate-50/50 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center"
                          >
                            {day.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {sortedGroupsForMaster.map(({ grade, group }) => {
                        const groupKey = `${grade}_${group}`;
                        return (
                          <tr key={groupKey} className="hover:bg-slate-50/50 transition-colors">
                            {/* Group Column */}
                            <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[1px_0_4px_rgba(0,0,0,0.03)]">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center font-black text-[9px] uppercase shadow-sm">
                                  {grade.charAt(0)}
                                </div>
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate">
                                  {grade}° {group}
                                </span>
                              </div>
                            </td>

                            {/* Day Columns */}
                            {DAYS_OF_WEEK.map(day => (
                              <td 
                                key={day.id} 
                                className="px-2 py-3 border-r border-slate-100 last:border-0 align-top text-center min-h-[80px]"
                              >
                                <div className="space-y-1.5">
                                  {activePeriods.map((period, pIdx) => {
                                    if (period.isBreak) {
                                      return (
                                        <div 
                                          key={`break-${pIdx}`}
                                          className="py-1 px-1.5 bg-slate-50 border border-dashed border-slate-200 text-slate-400 text-[7px] font-bold uppercase rounded-lg text-center"
                                        >
                                          {period.label} ({period.time})
                                        </div>
                                      );
                                    }
                                    
                                    const slot = getGroupMasterCellSlot(grade, group, day.id, pIdx);
                                    const hasConflict = getCellConflicts(day.id, pIdx).some(
                                      c => 
                                        (c.slot1.level === selectedLevel && c.slot1.grade === grade && c.slot1.group === group) ||
                                        (c.slot2.level === selectedLevel && c.slot2.grade === grade && c.slot2.group === group)
                                    );
                                    const substitution = getCellSubstitution(day.id, pIdx, slot || undefined);

                                    if (slot) {
                                      const colors = getSubjectColor(slot.subjectId);
                                      return (
                                        <div 
                                          key={pIdx}
                                          onClick={(e) => {
                                            if (!isAdmin) return;
                                            e.stopPropagation();
                                            setSelectedCell({ day: day.id, periodIndex: pIdx });
                                            setSelectedLevel(selectedLevel);
                                            setSelectedGrade(grade);
                                            setSelectedGroup(group);
                                            setEditClassroom(slot.classroom || '');
                                            setIsCellModalOpen(true);
                                          }}
                                          className={`p-1.5 rounded-lg h-full flex flex-col justify-center items-center relative transition-all border text-[9px] cursor-pointer hover:scale-[1.01] ${
                                            substitution 
                                              ? 'bg-rose-50 border-rose-250 text-rose-900 hover:bg-rose-100' 
                                              : hasConflict 
                                              ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' 
                                              : colors.bg
                                          }`}
                                        >
                                          {/* Quick Actions overlay */}
                                          {isAdmin && (
                                            <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity z-10">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleQuickDelete(slot);
                                                }}
                                                className="p-0.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 rounded"
                                                title="Quitar clase"
                                              >
                                                <Trash2 size={8} />
                                              </button>
                                            </div>
                                          )}

                                          {/* Period Time */}
                                          <span className="text-[6px] font-bold text-slate-400/80 mb-0.5 block">
                                            {activePeriods[pIdx]?.time}
                                          </span>

                                          {/* Subject */}
                                          <span className="font-black uppercase tracking-tight truncate max-w-full">
                                            {slot.subjectName}
                                          </span>
                                          {/* Teacher */}
                                          <span className="text-[7px] font-bold text-slate-500 mt-0.5 truncate max-w-full">
                                            {slot.teacherName}
                                          </span>
                                          {/* Classroom */}
                                          {slot.classroom && (
                                            <span className="text-[6px] font-bold text-slate-400 uppercase mt-0.5">
                                              Aula: {slot.classroom}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }

                                    // Render empty cell slot for manual click assignment
                                    return (
                                      <div 
                                        key={pIdx}
                                        onClick={() => {
                                          if (!isAdmin) return;
                                          setSelectedCell({ day: day.id, periodIndex: pIdx });
                                          setSelectedLevel(selectedLevel);
                                          setSelectedGrade(grade);
                                          setSelectedGroup(group);
                                          setEditClassroom('');
                                          setIsCellModalOpen(true);
                                        }}
                                        className={`group/cell min-h-[36px] flex flex-col justify-center items-center rounded-lg border border-dashed border-slate-150 hover:border-slate-300 hover:bg-slate-50/50 transition-all cursor-pointer`}
                                      >
                                        <span className="text-[6px] font-bold text-slate-350 block group-hover/cell:text-slate-500">
                                          {activePeriods[pIdx]?.time}
                                        </span>
                                        <Plus className="w-2.5 h-2.5 text-slate-300 group-hover/cell:text-slate-400 transition-colors mt-0.5" />
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : viewMode === 'master' ? (
                  <table className="w-full border-collapse text-left min-w-[900px] print:min-w-0 table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="w-[150px] px-4 py-3 bg-slate-50/50 text-[10px] font-black uppercase text-slate-500 tracking-wider sticky left-0 z-20 bg-slate-50 shadow-[1px_0_4px_rgba(0,0,0,0.03)]">
                          Docente
                        </th>
                        {DAYS_OF_WEEK.map(day => (
                          <th 
                            key={day.id} 
                            className="px-4 py-3 bg-slate-50/50 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center"
                          >
                            {day.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {sortedTeachersForMaster.map(teacher => (
                        <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Teacher Column */}
                          <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[1px_0_4px_rgba(0,0,0,0.03)]">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-black text-[9px] uppercase shadow-sm">
                                {teacher.name?.charAt(0) || 'D'}
                              </div>
                              <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate">
                                {teacher.name}
                              </span>
                            </div>
                          </td>

                          {/* Day Columns */}
                          {DAYS_OF_WEEK.map(day => (
                            <td 
                              key={day.id} 
                              className="px-2 py-3 border-r border-slate-100 last:border-0 align-top text-center min-h-[80px]"
                            >
                              <div className="space-y-1.5">
                                {activePeriods.map((period, pIdx) => {
                                  if (period.isBreak) return null;
                                  
                                  const slot = getMasterCellSlot(teacher.id, day.id, pIdx);
                                  const hasConflict = getCellConflicts(day.id, pIdx).some(c => c.slot1.teacherId === teacher.id || c.slot2.teacherId === teacher.id);
                                  const substitution = getMasterCellSubstitution(teacher.id, day.id, pIdx, slot);

                                  if (slot) {
                                    const colors = getSubjectColor(slot.subjectId);
                                    return (
                                      <div 
                                        key={pIdx}
                                        onClick={(e) => {
                                          if (!isAdmin) return;
                                          e.stopPropagation();
                                          setSelectedCell({ day: day.id, periodIndex: pIdx });
                                          setSelectedTeacherId(teacher.id);
                                          setEditClassroom(slot.classroom || '');
                                          setIsCellModalOpen(true);
                                        }}
                                        className={`p-1.5 rounded-lg h-full flex flex-col justify-center items-center relative transition-all border text-[9px] cursor-pointer hover:border-indigo-300 ${
                                          substitution 
                                            ? 'bg-rose-50 border-rose-250 text-rose-900' 
                                            : hasConflict 
                                            ? 'bg-red-50 border-red-200 text-red-700' 
                                            : slot.level !== selectedLevel
                                            ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-150'
                                            : colors.bg
                                        }`}
                                      >
                                        {/* Quick Actions overlay for master mode */}
                                        {isAdmin && (
                                          <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity z-10">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickDelete(slot);
                                              }}
                                              className="p-0.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 rounded"
                                              title="Quitar clase"
                                            >
                                              <Trash2 size={8} />
                                            </button>
                                          </div>
                                        )}

                                        {/* Subject */}
                                        <span className={`font-black uppercase tracking-tight truncate max-w-full ${
                                          slot.level !== selectedLevel ? 'text-slate-600' : ''
                                        }`}>
                                          {slot.subjectName}
                                        </span>
                                        {/* Group/Grade */}
                                        <span className="text-[7px] font-bold text-slate-500 mt-0.5 truncate max-w-full">
                                          {slot.level.substring(0, 3)}. {slot.grade}°{slot.group}
                                        </span>
                                        {/* Classroom */}
                                        {slot.classroom && (
                                          <span className="text-[6px] font-bold text-slate-400 uppercase mt-0.5">
                                            {slot.classroom}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (isAdmin) {
                                    return (
                                      <button
                                        key={pIdx}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCell({ day: day.id, periodIndex: pIdx });
                                          setSelectedTeacherId(teacher.id);
                                          setEditClassroom('');
                                          setIsCellModalOpen(true);
                                        }}
                                        className="w-full text-center py-1 border border-dashed border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/20 text-[7px] font-bold text-slate-350 hover:text-indigo-600 rounded uppercase tracking-wider transition-all"
                                      >
                                        + {period.label.split(' ')[0]}
                                      </button>
                                    );
                                  }

                                  return null;
                                })}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full border-collapse text-left min-w-[700px] print:min-w-0 table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="w-[120px] px-4 py-3 bg-slate-50/50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Periodo / Hora
                        </th>
                        {DAYS_OF_WEEK.map(day => (
                          <th 
                            key={day.id} 
                            className="px-4 py-3 bg-slate-50/50 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center"
                          >
                            {day.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activePeriods.map((period, pIdx) => {
                        if (period.isBreak) {
                          return (
                            <tr key={`break-${pIdx}`} className="bg-slate-100 border-y border-slate-200 text-center">
                              <td className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">
                                {period.time}
                              </td>
                              <td colSpan={5} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                                ☕ {period.label} ☕
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={pIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/20">
                            {/* Left Slot Details */}
                            <td className="px-4 py-4 bg-slate-50/20 font-sans border-r border-slate-100">
                              <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{period.label}</p>
                              <p className="text-[9px] text-slate-400 font-bold mt-1 tracking-tight">{period.time}</p>
                            </td>

                            {/* Week Days Slots */}
                            {DAYS_OF_WEEK.map(day => {
                              const slot = getCellSlot(day.id, pIdx);
                              const hasConflict = getCellConflicts(day.id, pIdx).length > 0;
                              const substitution = getCellSubstitution(day.id, pIdx, slot);
                              const isDraggedOver = dragOverCell?.day === day.id && dragOverCell?.periodIndex === pIdx;
                              const colors = getSubjectColor(slot?.subjectId);

                              return (
                                <td 
                                  key={day.id}
                                  onClick={() => handleCellClick(day.id, pIdx)}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    if (isAdmin && draggedSlot) {
                                      setDragOverCell({ day: day.id, periodIndex: pIdx });
                                    }
                                  }}
                                  onDragLeave={() => setDragOverCell(null)}
                                  onDrop={(e) => handleDrop(e, day.id, pIdx)}
                                  className={`px-2 py-2 border-r border-slate-100 last:border-0 align-middle h-20 text-center relative group select-none transition-all ${
                                    isAdmin ? 'cursor-pointer hover:bg-indigo-50/30' : ''
                                  } ${hasConflict ? 'bg-red-50/30' : ''} ${
                                    isDraggedOver ? 'bg-indigo-50 border-2 border-dashed border-indigo-400' : ''
                                  }`}
                                >
                                  {slot ? (
                                    <div 
                                      draggable={isAdmin ? "true" : "false"}
                                      onDragStart={(e) => handleDragStart(e, slot)}
                                      className={`p-2 rounded-xl h-full flex flex-col justify-center items-center relative transition-all border ${
                                        isAdmin ? 'cursor-grab active:cursor-grabbing' : ''
                                      } ${
                                        substitution 
                                          ? 'bg-rose-50 border-rose-200 text-rose-900' 
                                          : hasConflict 
                                          ? 'bg-red-50 border-red-200 text-red-700' 
                                          : `${colors.bg} shadow-sm group-hover:border-indigo-300`
                                      }`}
                                    >
                                      {/* Action Hover overlay for quick edit/reorder */}
                                      {isAdmin && (
                                        <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setMovingSlot(slot);
                                            }}
                                            className="p-0.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-50 transition-colors"
                                            title="Mover clase"
                                          >
                                            <RefreshCw size={10} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleQuickDelete(slot);
                                            }}
                                            className="p-0.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 rounded hover:bg-slate-50 transition-colors"
                                            title="Quitar clase"
                                          >
                                            <Trash2 size={10} />
                                          </button>
                                        </div>
                                      )}
                                      
                                      {/* Subject */}
                                      <span className="text-[10px] font-black uppercase tracking-tight truncate max-w-full">
                                        {slot.subjectName}
                                      </span>
                                      
                                      {/* Docente / Grupo */}
                                      <span className="text-[8px] font-bold text-slate-500 mt-1 truncate max-w-full">
                                        {viewMode === 'teacher' 
                                          ? `${slot.level} ${slot.grade}°${slot.group}` 
                                          : slot.teacherName}
                                      </span>

                                      {/* Classroom or substitution details */}
                                      {substitution ? (
                                        <span className="text-[7px] font-black px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded mt-1.5 flex items-center gap-1">
                                          <UserCheck size={8} /> Suplente: {substitution.substituteTeacherName}
                                        </span>
                                      ) : (
                                        slot.classroom && (
                                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-0.5">
                                            <MapPin size={8} className="opacity-50" /> {slot.classroom}
                                          </span>
                                        )
                                      )}

                                      {/* Conflict Indicator */}
                                      {hasConflict && !substitution && (
                                        <div className="absolute top-1 left-1 text-red-500">
                                          <AlertCircle size={10} />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-full flex items-center justify-center">
                                      {isAdmin && (
                                        <span className="text-[9px] font-black text-slate-300 group-hover:text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                          + Asignar
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Substitutions View */}
          {activeTab === 'substitutions' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Ausencias y Suplencias para el Día {subDate}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Gestiona incidencias del plantel escolar en tiempo real
                </p>
              </div>

              {/* Absent teachers warnings from Reloj Checador */}
              {absentTeachersToday.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-2 space-y-3 shadow-inner">
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Alertas del Checador: Docentes Ausentes ({absentTeachersToday.length})
                  </h3>
                  <p className="text-[10px] text-amber-600 font-bold leading-normal">
                    Los siguientes docentes tienen clases programadas hoy pero no han registrado su Entrada en el Reloj Checador:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {absentTeachersToday.map(teacher => (
                      <div key={teacher.id} className="p-3 bg-white border border-amber-100 rounded-xl flex items-center justify-between shadow-sm">
                        <div>
                          <p className="text-xs font-black text-slate-900">{teacher.name}</p>
                          <p className="text-[8px] text-amber-600 font-bold uppercase tracking-wider mt-0.5">Sin Entrada hoy</p>
                        </div>
                        <button
                          onClick={() => {
                            setAbsentTeacherId(teacher.id);
                            // Auto find first period they teach today
                            const dayOfWeek = new Date().getDay();
                            const validDay = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : dayOfWeek;
                            const firstClass = schedules.find(s => s.teacherId === teacher.id && s.day === validDay);
                            if (firstClass) {
                              setSelectedSubPeriod(firstClass.periodIndex);
                              setSelectedSubDay(validDay);
                            }
                            toast.info(`Configurando suplente para ${teacher.name}`);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg shadow-sm transition-all"
                        >
                          Suplir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Substitutions logged today */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Sustituciones Programadas ({substitutions.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {substitutions.map(sub => {
                    const period = getSubPeriod(sub.periodIndex);
                    return (
                      <div 
                        key={sub.id} 
                        className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative group flex flex-col justify-between"
                      >
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSub(sub.id!)}
                            className="absolute top-3 right-3 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded">
                              Falta: {sub.absentTeacherName}
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                              Suplente: {sub.substituteTeacherName}
                            </span>
                          </div>
                          
                          <p className="text-xs font-bold text-slate-800">
                            Módulo: {period?.label} ({period?.time})
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">
                            Motivo: {sub.reason}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {substitutions.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-slate-400 font-medium text-xs italic">
                      No se han reportado ausencias o sustituciones en esta fecha.
                    </div>
                  )}
                </div>
              </div>

              {/* Absence builder wizard */}
              {absentTeacherId && isAdmin && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                    Asignador de Suplente por Módulo
                  </h3>

                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                      Selecciona un módulo en el que falte el docente para ver sustitutos recomendados disponibles:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* List periods where absent teacher has classes today */}
                      {activePeriods.map((period, pIdx) => {
                        if (period.isBreak) return null;
                        
                        // Check if teacher has class this period
                        const dayOfWeek = new Date(subDate + 'T00:00:00').getDay(); // 1 = Mon, 5 = Fri
                        // Adjust day code if weekend
                        const validDay = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : dayOfWeek;
                        
                        const hasClass = schedules.some(s => 
                          s.teacherId === absentTeacherId && 
                          s.day === validDay && 
                          (s.periodIndex === pIdx || (activePeriods === DEFAULT_TIME_PERIODS && (s.periodIndex < 3 ? s.periodIndex : s.periodIndex + 1) === pIdx))
                        );

                        if (!hasClass) return null;

                        const isSelected = selectedSubPeriod === pIdx && selectedSubDay === validDay;

                        return (
                          <button
                            key={pIdx}
                            onClick={() => {
                              setSelectedSubPeriod(pIdx);
                              setSelectedSubDay(validDay);
                            }}
                            className={`p-3 rounded-lg border text-left flex flex-col justify-between gap-1 transition-all ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <span className="text-[9px] font-black uppercase">{period.label}</span>
                            <span className={`text-[8px] font-medium leading-none ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                              {period.time}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedSubPeriod !== null && (
                      <div className="space-y-4 pt-4 border-t border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Docentes Libres (Recomendados)</label>
                            <select
                              value={substituteTeacherId}
                              onChange={(e) => setSubstituteTeacherId(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                            >
                              <option value="">-- Seleccionar Suplente --</option>
                              {availableSubstitutes.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Motivo / Notas</label>
                            <input
                              type="text"
                              value={newSubReason}
                              onChange={(e) => setNewSubReason(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                            />
                          </div>
                        </div>

                        <button
                          onClick={handleAddSubstitution}
                          disabled={!substituteTeacherId}
                          className="px-6 py-2.5 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                        >
                          Confirmar Sustitución
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* MODAL: CONTRACT / LESSONS CREATOR */}
      {isContractModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Agregar Asignación de Clase</h3>
              <button 
                onClick={() => setIsContractModalOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContract} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nivel Educativo</label>
                  <select
                    required
                    value={newContract.level}
                    onChange={(e) => setNewContract({...newContract, level: e.target.value, subjectId: ''})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="">-- Nivel --</option>
                    {settings?.academicLevels?.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Grado</label>
                    <select
                      required
                      value={newContract.grade}
                      onChange={(e) => setNewContract({...newContract, grade: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    >
                      <option value="">-- Grado --</option>
                      {settings?.academicGrades?.map(grd => (
                        <option key={grd} value={grd}>{grd}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Grupo</label>
                    <select
                      required
                      value={newContract.group}
                      onChange={(e) => setNewContract({...newContract, group: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    >
                      <option value="">-- Gp --</option>
                      {settings?.academicGroups?.map(grp => (
                        <option key={grp} value={grp}>{grp}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Materia</label>
                <select
                  required
                  value={newContract.subjectId}
                  onChange={(e) => setNewContract({...newContract, subjectId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="">-- Seleccionar Materia --</option>
                  {subjects
                    .sort((a, b) => {
                      const aMatches = a.level?.toLowerCase().trim() === newContract.level?.toLowerCase().trim();
                      const bMatches = b.level?.toLowerCase().trim() === newContract.level?.toLowerCase().trim();
                      if (aMatches && !bMatches) return -1;
                      if (!aMatches && bMatches) return 1;
                      return (a.name || '').localeCompare(b.name || '');
                    })
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.level ? `(${s.level})` : ''}
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Docente</label>
                <select
                  required
                  value={newContract.teacherId}
                  onChange={(e) => setNewContract({...newContract, teacherId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="">-- Seleccionar Docente --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Aula (Salón Físico)</label>
                  <input
                    type="text"
                    value={newContract.classroom}
                    onChange={(e) => setNewContract({...newContract, classroom: e.target.value})}
                    placeholder="ej. Salón 101"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSpecialSchedule}
                    onChange={(e) => setIsSpecialSchedule(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    ¿Habilitar horario especial (diferentes horas por día)?
                  </span>
                </label>
              </div>

              {!isSpecialSchedule ? (
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Horas por Día</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required={!isSpecialSchedule}
                    value={newContract.periodsPerDay}
                    onChange={(e) => setNewContract({...newContract, periodsPerDay: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              ) : (
                <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                    Horas Permitidas por Día de la Semana
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { id: "1", name: "Lun" },
                      { id: "2", name: "Mar" },
                      { id: "3", name: "Mié" },
                      { id: "4", name: "Jue" },
                      { id: "5", name: "Vie" }
                    ].map(day => (
                      <div key={day.id} className="flex flex-col items-center gap-1 bg-white p-2 rounded-xl border border-slate-200/60 shadow-sm">
                        <label className="text-[9px] font-bold text-slate-500">{day.name}</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          required={isSpecialSchedule}
                          value={specialScheduleHours[day.id] ?? 1}
                          onChange={(e) => setSpecialScheduleHours({
                            ...specialScheduleHours,
                            [day.id]: Math.max(0, Number(e.target.value))
                          })}
                          className="w-full text-center px-1 py-1 border border-slate-200 rounded-lg text-xs font-black outline-none bg-slate-50/20"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[8.5px] text-slate-400 font-semibold italic">
                    * Ingresa 0 si la materia no se imparte ese día en particular.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl shadow-md transition-all mt-4"
              >
                Registrar Asignación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL CELL LESSON PLACEMENT */}
      {isCellModalOpen && selectedCell && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Asignar Clase</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                  {DAYS_OF_WEEK.find(d => d.id === selectedCell.day)?.name} - Periodo {selectedCell.periodIndex + 1}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsCellModalOpen(false);
                  setSelectedCell(null);
                }}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              <p className="text-[10px] text-slate-500 font-bold leading-normal">
                Selecciona una lección de la lista para colocarla en esta celda:
              </p>

              <div className="space-y-2">
                {contracts
                  .filter(c => {
                    if (viewMode === 'group' || viewMode === 'master_groups') {
                      return c.level === selectedLevel && c.grade === selectedGrade && c.group === selectedGroup;
                    }
                    if (viewMode === 'master') {
                      return c.teacherId === selectedTeacherId;
                    }
                    if (viewMode === 'teacher') {
                      return c.teacherId === selectedTeacherId;
                    }
                    return true;
                  })
                  .map(contract => {
                    const currentPlacedCount = schedules.filter(s => 
                      s.subjectId === contract.subjectId && 
                      s.level === contract.level && 
                      s.grade === contract.grade && 
                      s.group === contract.group &&
                      s.day === selectedCell.day
                    ).length;

                    return (
                      <button
                        key={contract.id}
                        onClick={() => handleAssignLessonToCell(contract)}
                        className="w-full text-left p-3 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 rounded-xl transition-all flex justify-between items-center group"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-700">
                            {contract.subjectName}
                          </p>
                          <p className="text-[9px] text-slate-500 font-semibold mt-0.5">
                            Docente: {contract.teacherName}
                          </p>
                          {viewMode !== 'group' && (
                            <p className="text-[8px] text-slate-400 font-bold mt-0.5">
                              Grupo: {contract.level} {contract.grade}°{contract.group}
                            </p>
                          )}
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {currentPlacedCount} / {(contract.customPeriodsPerDay && contract.customPeriodsPerDay[selectedCell.day.toString()] !== undefined)
                            ? Number(contract.customPeriodsPerDay[selectedCell.day.toString()])
                            : contract.periodsPerDay}h/día
                        </span>
                      </button>
                    );
                })}

                {getCellSlot(selectedCell.day, selectedCell.periodIndex) && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 mt-2">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
                        Editar Aula (Salón Físico)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ej. Salón 101"
                          value={editClassroom}
                          onChange={(e) => setEditClassroom(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white font-bold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={handleSaveClassroom}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAssignLessonToCell('delete')}
                      className="w-full p-3 border border-red-200 bg-red-50 hover:bg-red-100/50 rounded-xl text-center text-xs font-black uppercase text-red-600 tracking-wider transition-all mt-2"
                    >
                      Quitar Clase Actual
                    </button>
                  </div>
                )}

                {contracts.length === 0 && (
                  <p className="text-xs font-bold text-slate-400 text-center py-6">
                    No hay lecciones configuradas. Agrega contratos a la lista de lecciones.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
