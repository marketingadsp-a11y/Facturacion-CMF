import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp, 
  onSnapshot,
  WriteBatch
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  AppSettings, 
  SchoolCycle, 
  BimestreLock, 
  Subject, 
  Student, 
  AppUser, 
  Bimestre 
} from '../../types';
import { getLevelEvaluationConfig, isSubjectLockLevel } from '../../lib/evaluationUtils';
import { cn } from '../../lib/utils';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Unlock, 
  Calendar, 
  Layers, 
  BookOpen, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  User,
  GraduationCap
} from 'lucide-react';

interface GradeLocksManagerProps {
  settings: AppSettings;
  cycles: SchoolCycle[];
  gradeLocks: BimestreLock[];
  subjects: Subject[];
  userProfile: AppUser | null;
  users?: AppUser[];
}

interface CustomLockFormData {
  level: string;
  grade: string;
  group: string;
  scope: 'all' | 'subject';
  subjectId: string;
}

export interface TeacherAssignmentItem {
  level: string;
  grade: string;
  group: string;
  subjectId?: string;
  subjectName?: string;
  isSubjectLevel: boolean;
}

export default function GradeLocksManager({
  settings,
  cycles,
  gradeLocks,
  subjects,
  userProfile,
  users: initialUsers = []
}: GradeLocksManagerProps) {
  // 1. Cycle selection
  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    settings.currentCycleId || cycles[0]?.id || ''
  );

  useEffect(() => {
    if (!selectedCycleId && (settings.currentCycleId || cycles[0]?.id)) {
      setSelectedCycleId(settings.currentCycleId || cycles[0]?.id || '');
    }
  }, [settings.currentCycleId, cycles, selectedCycleId]);

  // 2. Educational levels
  const levels = useMemo(() => {
    return settings.academicLevels && settings.academicLevels.length > 0
      ? settings.academicLevels
      : ['Preescolar', 'Primaria', 'Secundaria', 'Preparatoria'];
  }, [settings.academicLevels]);

  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL');

  // Mode: Por Niveles y Salones vs Por Docente
  const [managerMode, setManagerMode] = useState<'by_level' | 'by_teacher'>('by_level');

  // 3. Subscribe to users if not passed in props
  const [allUsers, setAllUsers] = useState<AppUser[]>(initialUsers);

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setAllUsers(initialUsers);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    });
    return () => unsub();
  }, [initialUsers]);

  // Filter teachers
  const teachers = useMemo(() => {
    return allUsers.filter(u => u.role === 'Docente');
  }, [allUsers]);

  // Teacher search term, lock filter and expanded teachers
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [teacherLockFilter, setTeacherLockFilter] = useState<'ALL' | 'locked' | 'open'>('ALL');
  const [expandedTeachers, setExpandedTeachers] = useState<Record<string, boolean>>({});

  const toggleTeacherExpanded = (teacherId: string) => {
    setExpandedTeachers(prev => ({
      ...prev,
      [teacherId]: !prev[teacherId]
    }));
  };

  const expandAllTeachers = (teacherList: AppUser[]) => {
    const next: Record<string, boolean> = {};
    teacherList.forEach(t => { next[t.id] = true; });
    setExpandedTeachers(next);
  };

  const collapseAllTeachers = () => {
    setExpandedTeachers({});
  };

  // 4. Subscribe to students to know all active classes (level, grade, group) in the school
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    }, (error) => {
      console.error("Error loading students in GradeLocksManager:", error);
    });

    return () => unsubStudents();
  }, []);

  // Helper to deduplicate subjects per level
  const getDeduplicatedSubjects = (levelName: string): Subject[] => {
    const seen = new Set<string>();
    return subjects.filter(s => {
      if (!s.level) return false;
      if (s.level.toLowerCase().trim() !== levelName.toLowerCase().trim()) return false;
      const norm = s.name.toLowerCase().trim();
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  };

  // Map of all active classes (grade & group) for each level
  const classesByLevel = useMemo(() => {
    const map: Record<string, Array<{ grade: string; group: string }>> = {};
    levels.forEach(lvl => { map[lvl] = []; });
    const seen = new Set<string>();

    // From registered students
    students.forEach(st => {
      const stCycle = st.cycleId || settings.currentCycleId;
      if (selectedCycleId && stCycle && stCycle !== selectedCycleId) return;
      if (st.level && st.grade && st.group) {
        const key = `${st.level}__${st.grade}__${st.group}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (!map[st.level]) map[st.level] = [];
          map[st.level].push({ grade: st.grade, group: st.group });
        }
      }
    });

    // Fallback to configured academic grades/groups if level has no enrolled students
    levels.forEach(lvl => {
      if (!map[lvl] || map[lvl].length === 0) {
        const confGrades = lvl.toLowerCase().includes('preescolar')
          ? ['1ro', '2do', '3ro']
          : lvl.toLowerCase().includes('secundaria')
            ? ['1ro', '2do', '3ro']
            : (settings.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to']);
        const confGroups = (settings.academicGroups && settings.academicGroups.length > 0)
          ? settings.academicGroups
          : ['A', 'B'];

        if (!map[lvl]) map[lvl] = [];
        confGrades.forEach(g => {
          confGroups.forEach(grp => {
            map[lvl].push({ grade: g, group: grp });
          });
        });
      } else {
        map[lvl].sort((a, b) => a.grade.localeCompare(b.grade) || a.group.localeCompare(b.group));
      }
    });

    return map;
  }, [levels, students, selectedCycleId, settings]);

  // 5. Periods for current view
  const periodCountForSelectedLevel = useMemo(() => {
    if (selectedLevelFilter !== 'ALL') {
      const cfg = getLevelEvaluationConfig(settings, selectedLevelFilter);
      return cfg.periodCount || 3;
    }
    let max = 3;
    levels.forEach(lvl => {
      const cfg = getLevelEvaluationConfig(settings, lvl);
      if (cfg.periodCount > max) max = cfg.periodCount;
    });
    return max;
  }, [settings, selectedLevelFilter, levels]);

  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);

  useEffect(() => {
    if (selectedPeriod > periodCountForSelectedLevel) {
      setSelectedPeriod(1);
    }
  }, [periodCountForSelectedLevel, selectedPeriod]);

  // Filter locks for currently selected cycle and period
  const currentCycleLocks = useMemo(() => {
    if (!selectedCycleId) return gradeLocks;
    return gradeLocks.filter(l => l.cycleId === selectedCycleId);
  }, [gradeLocks, selectedCycleId]);

  const activePeriodLocks = useMemo(() => {
    return currentCycleLocks.filter(l => Number(l.bimestre) === selectedPeriod);
  }, [currentCycleLocks, selectedPeriod]);

  // Search filter and expanded classes state
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  const toggleClassExpanded = (key: string) => {
    setExpandedClasses(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  // Safe chunk batch writer helper
  const commitBatches = async (operations: Array<(b: WriteBatch) => void>) => {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(op => op(batch));
      await batch.commit();
    }
  };

  // 6. Operation states & confirmation modal
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionConfirmModal, setActionConfirmModal] = useState<{
    isOpen: boolean;
    type: 'lock_all' | 'unlock_all' | 'lock_level' | 'unlock_level';
    targetLevel?: string;
    title: string;
    description: string;
    actionLabel: string;
    isDangerous?: boolean;
  } | null>(null);

  // 7. Custom lock modal state
  const [isCustomLockModalOpen, setIsCustomLockModalOpen] = useState(false);
  const [customLockData, setCustomLockData] = useState<CustomLockFormData>({
    level: levels[0] || 'Primaria',
    grade: '1ro',
    group: 'A',
    scope: 'all',
    subjectId: ''
  });

  const availableGradesForCustomLevel = useMemo(() => {
    const list = classesByLevel[customLockData.level] || [];
    const distinctGrades = Array.from(new Set(list.map(c => c.grade)));
    return distinctGrades.length > 0
      ? distinctGrades
      : (settings.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to']);
  }, [classesByLevel, customLockData.level, settings.academicGrades]);

  const availableGroupsForCustomLevel = useMemo(() => {
    const list = classesByLevel[customLockData.level] || [];
    const distinctGroups = Array.from(new Set(list.filter(c => c.grade === customLockData.grade).map(c => c.group)));
    return distinctGroups.length > 0
      ? distinctGroups
      : (settings.academicGroups || ['A', 'B']);
  }, [classesByLevel, customLockData.level, customLockData.grade, settings.academicGroups]);

  const availableSubjectsForCustomLevel = useMemo(() => {
    return getDeduplicatedSubjects(customLockData.level);
  }, [subjects, customLockData.level]);

  useEffect(() => {
    if (!availableGradesForCustomLevel.includes(customLockData.grade)) {
      setCustomLockData(prev => ({
        ...prev,
        grade: availableGradesForCustomLevel[0] || '1ro'
      }));
    }
  }, [availableGradesForCustomLevel, customLockData.grade]);

  useEffect(() => {
    if (!availableGroupsForCustomLevel.includes(customLockData.group)) {
      setCustomLockData(prev => ({
        ...prev,
        group: availableGroupsForCustomLevel[0] || 'A'
      }));
    }
  }, [availableGroupsForCustomLevel, customLockData.group]);

  // Status computation for level
  const getLevelLocks = (levelName: string) => {
    return activePeriodLocks.filter(l => l.level === levelName);
  };

  const getLevelLockStatus = (levelName: string) => {
    const levelClasses = classesByLevel[levelName] || [];
    const locks = getLevelLocks(levelName);
    const isSubj = isSubjectLockLevel(levelName);
    const levelSubjs = getDeduplicatedSubjects(levelName);

    if (levelClasses.length === 0) {
      return { status: 'open', label: 'Sin clases', color: 'slate', count: 0, total: 0 };
    }

    if (isSubj && levelSubjs.length > 0) {
      const totalExpected = levelClasses.length * levelSubjs.length;
      let lockedCount = 0;

      levelClasses.forEach(cls => {
        const hasGlobal = locks.some(l => l.grade === cls.grade && l.group === cls.group && !l.subjectId && l.locked);
        if (hasGlobal) {
          lockedCount += levelSubjs.length;
        } else {
          levelSubjs.forEach(s => {
            const hasSubjLock = locks.some(l => 
              l.grade === cls.grade && 
              l.group === cls.group && 
              (l.subjectId === s.id || (l.subjectName && l.subjectName.toLowerCase().trim() === s.name.toLowerCase().trim())) && 
              l.locked
            );
            if (hasSubjLock) lockedCount++;
          });
        }
      });

      if (lockedCount >= totalExpected && totalExpected > 0) {
        return { status: 'locked', label: 'Nivel Totalmente Cerrado', color: 'rose', count: lockedCount, total: totalExpected };
      }
      if (lockedCount > 0) {
        return { status: 'partial', label: `Parcial (${lockedCount}/${totalExpected} materias)`, color: 'amber', count: lockedCount, total: totalExpected };
      }
      return { status: 'open', label: 'Abierto para Captura', color: 'emerald', count: 0, total: totalExpected };
    }

    const lockedClassesCount = levelClasses.filter(c => 
      locks.some(l => l.grade === c.grade && l.group === c.group && !l.subjectId && l.locked)
    ).length;

    if (lockedClassesCount === levelClasses.length && levelClasses.length > 0) {
      return { status: 'locked', label: 'Nivel Totalmente Cerrado', color: 'rose', count: lockedClassesCount, total: levelClasses.length };
    }
    if (locks.length > 0) {
      return { status: 'partial', label: `Parcial (${lockedClassesCount}/${levelClasses.length} salones)`, color: 'amber', count: lockedClassesCount, total: levelClasses.length };
    }
    return { status: 'open', label: 'Abierto para Captura', color: 'emerald', count: 0, total: levelClasses.length };
  };

  const institutionalPeriodStatus = useMemo(() => {
    const relevantLevels = selectedLevelFilter === 'ALL' ? levels : [selectedLevelFilter];
    let allLocked = true;
    let anyLocked = false;
    let totalClasses = 0;

    relevantLevels.forEach(lvl => {
      const st = getLevelLockStatus(lvl);
      totalClasses += st.total;
      if (st.status !== 'locked') allLocked = false;
      if (st.status !== 'open') anyLocked = true;
    });

    if (allLocked && totalClasses > 0) {
      return { status: 'locked', label: 'Periodo Totalmente Cerrado', color: 'rose' };
    }
    if (anyLocked) {
      return { status: 'partial', label: `Captura Parcial (${activePeriodLocks.length} bloqueos)`, color: 'amber' };
    }
    return { status: 'open', label: 'Captura Abierta Institucional', color: 'emerald' };
  }, [selectedLevelFilter, levels, activePeriodLocks, classesByLevel]);

  // ========================================================
  // CALCULATION: TEACHER ASSIGNMENTS & LOCK STATUS
  // ========================================================

  const getTeacherAssignments = (teacher: AppUser): TeacherAssignmentItem[] => {
    const assignments: TeacherAssignmentItem[] = [];
    const seen = new Set<string>();

    const teacherLevels = teacher.teacherGroupAccess === 'multiple' && (teacher.restrictedLevels || []).length > 0
      ? teacher.restrictedLevels
      : (teacher.assignedLevel ? [teacher.assignedLevel] : levels);

    const isSpecific = teacher.teacherSubjectAccess === 'specific' && (teacher.assignedSubjects || []).length > 0;

    if (isSpecific) {
      const allowed = teacher.assignedSubjects || [];
      subjects.forEach(subj => {
        if (!subj.level) return;
        const keyWithLevel = `${subj.name}__${subj.level}`;
        const isMatch = allowed.some(a => 
          a === subj.id || 
          a.toLowerCase().trim() === keyWithLevel.toLowerCase().trim() ||
          a.toLowerCase().trim() === subj.name.toLowerCase().trim()
        );
        if (!isMatch) return;

        const subjLevel = subj.level;
        const availableClasses = classesByLevel[subjLevel] || [];

        // Check grade filter
        const gradeList = teacher.teacherSubjectGrades?.[keyWithLevel] 
          || teacher.teacherSubjectGrades?.[subj.name] 
          || teacher.teacherSubjectGrades?.[subj.id] || [];

        const validGrades = (gradeList.length > 0 && !gradeList.includes('all'))
          ? Array.from(new Set(availableClasses.map(c => c.grade).filter(g => gradeList.includes(g))))
          : Array.from(new Set(availableClasses.map(c => c.grade)));

        validGrades.forEach(grd => {
          const groupList = teacher.teacherSubjectGroups?.[`${keyWithLevel}__${grd}`] 
            || teacher.teacherSubjectGroups?.[`${subj.name}__${grd}`] || [];

          const validGroups = (groupList.length > 0 && !groupList.includes('all'))
            ? availableClasses.filter(c => c.grade === grd && groupList.includes(c.group)).map(c => c.group)
            : availableClasses.filter(c => c.grade === grd).map(c => c.group);

          validGroups.forEach(grp => {
            const assignmentKey = `${subjLevel}__${grd}__${grp}__${subj.id}`;
            if (!seen.has(assignmentKey)) {
              seen.add(assignmentKey);
              assignments.push({
                level: subjLevel,
                grade: grd,
                group: grp,
                subjectId: subj.id,
                subjectName: subj.name,
                isSubjectLevel: true
              });
            }
          });
        });
      });
    } else {
      // Standard teacher (all subjects in their level/grade/group)
      teacherLevels.forEach(lvl => {
        const isSubj = isSubjectLockLevel(lvl);
        const levelSubjs = getDeduplicatedSubjects(lvl);
        const availableClasses = classesByLevel[lvl] || [];

        const teacherGrades = (teacher.restrictedGrades || []).length > 0
          ? teacher.restrictedGrades
          : (teacher.assignedGrade ? [teacher.assignedGrade] : Array.from(new Set(availableClasses.map(c => c.grade))));

        const teacherGroups = (teacher.restrictedGroups || []).length > 0
          ? teacher.restrictedGroups
          : (teacher.assignedGroup ? [teacher.assignedGroup] : (settings.academicGroups || ['A', 'B']));

        availableClasses.forEach(cls => {
          if (!teacherGrades.includes(cls.grade)) return;
          if (!teacherGroups.includes(cls.group)) return;

          if (isSubj && levelSubjs.length > 0) {
            levelSubjs.forEach(s => {
              const assignmentKey = `${lvl}__${cls.grade}__${cls.group}__${s.id}`;
              if (!seen.has(assignmentKey)) {
                seen.add(assignmentKey);
                assignments.push({
                  level: lvl,
                  grade: cls.grade,
                  group: cls.group,
                  subjectId: s.id,
                  subjectName: s.name,
                  isSubjectLevel: true
                });
              }
            });
          } else {
            const assignmentKey = `${lvl}__${cls.grade}__${cls.group}__all`;
            if (!seen.has(assignmentKey)) {
              seen.add(assignmentKey);
              assignments.push({
                level: lvl,
                grade: cls.grade,
                group: cls.group,
                isSubjectLevel: false
              });
            }
          }
        });
      });
    }

    return assignments;
  };

  // Helper: get all distinct levels for a teacher (from assignments or profile)
  const getTeacherLevels = (teacher: AppUser, assignments: TeacherAssignmentItem[]): string[] => {
    const fromAssignments = Array.from(new Set(assignments.map(a => a.level).filter(Boolean)));
    if (fromAssignments.length > 0) return fromAssignments;

    if (teacher.teacherGroupAccess === 'multiple' && (teacher.restrictedLevels || []).length > 0) {
      return teacher.restrictedLevels;
    }
    if (teacher.assignedLevel) {
      return [teacher.assignedLevel];
    }
    return [];
  };

  // Helper: check if a teacher assignment is locked in the current period
  const isAssignmentLocked = (item: TeacherAssignmentItem): boolean => {
    const hasGlobal = activePeriodLocks.some(l => 
      l.level === item.level && 
      l.grade === item.grade && 
      l.group === item.group && 
      !l.subjectId && 
      l.locked
    );
    if (hasGlobal) return true;

    if (item.subjectId || item.subjectName) {
      return activePeriodLocks.some(l => 
        l.level === item.level && 
        l.grade === item.grade && 
        l.group === item.group && 
        (l.subjectId === item.subjectId || (l.subjectName && l.subjectName.toLowerCase().trim() === item.subjectName?.toLowerCase().trim())) && 
        l.locked
      );
    }

    return false;
  };

  // ========================================================
  // TEACHER LOCK & UNLOCK ACTIONS
  // ========================================================

  // Bloquear todo lo asignado al Docente (todos sus niveles a la vez)
  const handleLockTeacherAll = async (teacher: AppUser) => {
    if (!selectedCycleId) return;
    const assignments = getTeacherAssignments(teacher);
    if (assignments.length === 0) {
      toast.warning(`El docente ${teacher.name} no tiene materias o grupos configurados.`);
      return;
    }

    setIsProcessing(true);
    try {
      const opsMap = new Map<string, (b: WriteBatch) => void>();

      assignments.forEach(item => {
        if (item.isSubjectLevel && item.subjectId) {
          const lockId = `${selectedPeriod}_${item.level}_${item.grade}_${item.group}_${selectedCycleId}_${item.subjectId}`;
          opsMap.set(lockId, b => b.set(doc(db, 'bimestreLocks', lockId), {
            id: lockId,
            bimestre: selectedPeriod as Bimestre,
            level: item.level,
            grade: item.grade,
            group: item.group,
            cycleId: selectedCycleId,
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            locked: true,
            lockedAt: serverTimestamp(),
            lockedBy: userProfile?.id || 'admin'
          }));
        } else {
          const lockId = `${selectedPeriod}_${item.level}_${item.grade}_${item.group}_${selectedCycleId}`;
          opsMap.set(lockId, b => b.set(doc(db, 'bimestreLocks', lockId), {
            id: lockId,
            bimestre: selectedPeriod as Bimestre,
            level: item.level,
            grade: item.grade,
            group: item.group,
            cycleId: selectedCycleId,
            locked: true,
            lockedAt: serverTimestamp(),
            lockedBy: userProfile?.id || 'admin'
          }));
        }
      });

      await commitBatches(Array.from(opsMap.values()));
      toast.success(`¡Todas las materias de ${teacher.name} han sido bloqueadas para el Periodo ${selectedPeriod}! (${assignments.length} asignaciones)`);
    } catch (error) {
      console.error("Error locking teacher assignments:", error);
      toast.error("Error al bloquear las materias del docente");
    } finally {
      setIsProcessing(false);
    }
  };

  // Bloquear lo asignado al Docente solo en un Nivel
  const handleLockTeacherLevel = async (teacher: AppUser, levelName: string) => {
    if (!selectedCycleId) return;
    const assignments = getTeacherAssignments(teacher).filter(a => a.level === levelName);
    if (assignments.length === 0) return;

    setIsProcessing(true);
    try {
      const opsMap = new Map<string, (b: WriteBatch) => void>();
      assignments.forEach(item => {
        if (item.isSubjectLevel && item.subjectId) {
          const lockId = `${selectedPeriod}_${item.level}_${item.grade}_${item.group}_${selectedCycleId}_${item.subjectId}`;
          opsMap.set(lockId, b => b.set(doc(db, 'bimestreLocks', lockId), {
            id: lockId,
            bimestre: selectedPeriod as Bimestre,
            level: item.level,
            grade: item.grade,
            group: item.group,
            cycleId: selectedCycleId,
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            locked: true,
            lockedAt: serverTimestamp(),
            lockedBy: userProfile?.id || 'admin'
          }));
        } else {
          const lockId = `${selectedPeriod}_${item.level}_${item.grade}_${item.group}_${selectedCycleId}`;
          opsMap.set(lockId, b => b.set(doc(db, 'bimestreLocks', lockId), {
            id: lockId,
            bimestre: selectedPeriod as Bimestre,
            level: item.level,
            grade: item.grade,
            group: item.group,
            cycleId: selectedCycleId,
            locked: true,
            lockedAt: serverTimestamp(),
            lockedBy: userProfile?.id || 'admin'
          }));
        }
      });
      await commitBatches(Array.from(opsMap.values()));
      toast.success(`Materias de ${teacher.name} en ${levelName} bloqueadas con éxito para el Periodo ${selectedPeriod}.`);
    } catch (error) {
      console.error("Error locking teacher level:", error);
      toast.error("Error al bloquear las materias del nivel");
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper unificado para desbloquear asignaciones de un docente de forma segura
  const executeUnlockTeacherItems = async (teacher: AppUser, targetAssignments: TeacherAssignmentItem[], successMsg: string) => {
    if (!selectedCycleId || targetAssignments.length === 0) return;

    setIsProcessing(true);
    try {
      const opsMap = new Map<string, (b: WriteBatch) => void>();

      // Agrupamos por salón único (nivel, grado, grupo) para evitar colisiones
      const classMap = new Map<string, {
        level: string;
        grade: string;
        group: string;
        isSubjectLevel: boolean;
        subjectIds: Set<string>;
      }>();

      targetAssignments.forEach(item => {
        const key = `${item.level}__${item.grade}__${item.group}`;
        if (!classMap.has(key)) {
          classMap.set(key, {
            level: item.level,
            grade: item.grade,
            group: item.group,
            isSubjectLevel: item.isSubjectLevel,
            subjectIds: new Set<string>()
          });
        }
        if (item.subjectId) {
          classMap.get(key)!.subjectIds.add(item.subjectId);
        }
      });

      for (const cls of classMap.values()) {
        if (cls.isSubjectLevel && cls.subjectIds.size > 0) {
          // 1. Eliminar candados directos de las materias de este docente
          cls.subjectIds.forEach(sId => {
            const lockId = `${selectedPeriod}_${cls.level}_${cls.grade}_${cls.group}_${selectedCycleId}_${sId}`;
            opsMap.set(lockId, b => b.delete(doc(db, 'bimestreLocks', lockId)));
          });

          // 2. Verificar si existe un candado global del grupo completo
          const globalLock = activePeriodLocks.find(l => 
            l.level === cls.level && l.grade === cls.grade && l.group === cls.group && !l.subjectId
          );
          if (globalLock) {
            opsMap.set(globalLock.id, b => b.delete(doc(db, 'bimestreLocks', globalLock.id)));
            // Mantener bloqueadas las demás materias del grupo que NO correspondan a este docente
            const levelSubjs = getDeduplicatedSubjects(cls.level);
            levelSubjs.filter(s => !cls.subjectIds.has(s.id)).forEach(s => {
              const otherLockId = `${selectedPeriod}_${cls.level}_${cls.grade}_${cls.group}_${selectedCycleId}_${s.id}`;
              if (!opsMap.has(otherLockId)) {
                opsMap.set(otherLockId, b => b.set(doc(db, 'bimestreLocks', otherLockId), {
                  id: otherLockId,
                  bimestre: selectedPeriod as Bimestre,
                  level: cls.level,
                  grade: cls.grade,
                  group: cls.group,
                  cycleId: selectedCycleId,
                  subjectId: s.id,
                  subjectName: s.name,
                  locked: true,
                  lockedAt: serverTimestamp(),
                  lockedBy: userProfile?.id || 'admin'
                }));
              }
            });
          }
        } else {
          // Nivel con candado por grupo completo (Primaria / Preescolar)
          const lockId = `${selectedPeriod}_${cls.level}_${cls.grade}_${cls.group}_${selectedCycleId}`;
          opsMap.set(lockId, b => b.delete(doc(db, 'bimestreLocks', lockId)));
        }
      }

      await commitBatches(Array.from(opsMap.values()));
      toast.success(successMsg);
    } catch (error) {
      console.error("Error unlocking teacher assignments:", error);
      toast.error("Error al desbloquear las materias del docente");
    } finally {
      setIsProcessing(false);
    }
  };

  // Desbloquear todo lo asignado al Docente (todos sus niveles a la vez)
  const handleUnlockTeacherAll = async (teacher: AppUser) => {
    const assignments = getTeacherAssignments(teacher);
    await executeUnlockTeacherItems(
      teacher,
      assignments,
      `¡Todas las materias de ${teacher.name} han sido desbloqueadas con éxito para el Periodo ${selectedPeriod}!`
    );
  };

  // Desbloquear lo asignado al Docente solo en un Nivel
  const handleUnlockTeacherLevel = async (teacher: AppUser, levelName: string) => {
    const assignments = getTeacherAssignments(teacher).filter(a => a.level === levelName);
    await executeUnlockTeacherItems(
      teacher,
      assignments,
      `Materias de ${teacher.name} en ${levelName} desbloqueadas con éxito para el Periodo ${selectedPeriod}.`
    );
  };

  // ========================================================
  // LEVEL LOCK & UNLOCK ACTIONS
  // ========================================================

  const executeLockLevel = async (levelName: string) => {
    if (!selectedCycleId) {
      toast.error("No hay un ciclo escolar seleccionado.");
      return;
    }

    const levelClasses = classesByLevel[levelName] || [];
    if (levelClasses.length === 0) {
      toast.warning(`No hay clases configuradas para el nivel ${levelName}`);
      return;
    }

    setIsProcessing(true);
    try {
      const isSubj = isSubjectLockLevel(levelName);
      const levelSubjs = getDeduplicatedSubjects(levelName);
      const ops: Array<(b: WriteBatch) => void> = [];

      for (const cls of levelClasses) {
        if (isSubj && levelSubjs.length > 0) {
          const globalLockId = `${selectedPeriod}_${levelName}_${cls.grade}_${cls.group}_${selectedCycleId}`;
          ops.push(b => b.delete(doc(db, 'bimestreLocks', globalLockId)));

          for (const subj of levelSubjs) {
            const lockId = `${selectedPeriod}_${levelName}_${cls.grade}_${cls.group}_${selectedCycleId}_${subj.id}`;
            ops.push(b => b.set(doc(db, 'bimestreLocks', lockId), {
              id: lockId,
              bimestre: selectedPeriod as Bimestre,
              level: levelName,
              grade: cls.grade,
              group: cls.group,
              cycleId: selectedCycleId,
              subjectId: subj.id,
              subjectName: subj.name,
              locked: true,
              lockedAt: serverTimestamp(),
              lockedBy: userProfile?.id || 'admin'
            }));
          }
        } else {
          const lockId = `${selectedPeriod}_${levelName}_${cls.grade}_${cls.group}_${selectedCycleId}`;
          ops.push(b => b.set(doc(db, 'bimestreLocks', lockId), {
            id: lockId,
            bimestre: selectedPeriod as Bimestre,
            level: levelName,
            grade: cls.grade,
            group: cls.group,
            cycleId: selectedCycleId,
            locked: true,
            lockedAt: serverTimestamp(),
            lockedBy: userProfile?.id || 'admin'
          }));
        }
      }

      await commitBatches(ops);
      toast.success(
        isSubj && levelSubjs.length > 0
          ? `¡Nivel "${levelName}" bloqueado por materias con éxito!`
          : `¡Nivel "${levelName}" bloqueado con éxito para el Periodo ${selectedPeriod}!`
      );
      setActionConfirmModal(null);
    } catch (error) {
      console.error("Error locking level:", error);
      toast.error("Error al bloquear el nivel escolar");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeUnlockLevel = async (levelName: string) => {
    const locksToDelete = activePeriodLocks.filter(l => l.level === levelName);
    if (locksToDelete.length === 0) {
      toast.info(`No hay bloqueos activos para ${levelName} en el Periodo ${selectedPeriod}`);
      return;
    }

    setIsProcessing(true);
    try {
      const ops: Array<(b: WriteBatch) => void> = [];
      locksToDelete.forEach(l => {
        ops.push(b => b.delete(doc(db, 'bimestreLocks', l.id)));
      });
      await commitBatches(ops);
      toast.success(`¡Nivel "${levelName}" desbloqueado completamente para el Periodo ${selectedPeriod}!`);
      setActionConfirmModal(null);
    } catch (error) {
      console.error("Error unlocking level:", error);
      toast.error("Error al desbloquear el nivel escolar");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeLockAll = async () => {
    if (!selectedCycleId) {
      toast.error("No hay un ciclo escolar seleccionado.");
      return;
    }

    setIsProcessing(true);
    try {
      const ops: Array<(b: WriteBatch) => void> = [];
      const targetLevels = selectedLevelFilter === 'ALL' ? levels : [selectedLevelFilter];

      targetLevels.forEach(lvl => {
        const levelClasses = classesByLevel[lvl] || [];
        const isSubj = isSubjectLockLevel(lvl);
        const levelSubjs = getDeduplicatedSubjects(lvl);

        levelClasses.forEach(cls => {
          if (isSubj && levelSubjs.length > 0) {
            const globalLockId = `${selectedPeriod}_${lvl}_${cls.grade}_${cls.group}_${selectedCycleId}`;
            ops.push(b => b.delete(doc(db, 'bimestreLocks', globalLockId)));

            levelSubjs.forEach(subj => {
              const lockId = `${selectedPeriod}_${lvl}_${cls.grade}_${cls.group}_${selectedCycleId}_${subj.id}`;
              ops.push(b => b.set(doc(db, 'bimestreLocks', lockId), {
                id: lockId,
                bimestre: selectedPeriod as Bimestre,
                level: lvl,
                grade: cls.grade,
                group: cls.group,
                cycleId: selectedCycleId,
                subjectId: subj.id,
                subjectName: subj.name,
                locked: true,
                lockedAt: serverTimestamp(),
                lockedBy: userProfile?.id || 'admin'
              }));
            });
          } else {
            const lockId = `${selectedPeriod}_${lvl}_${cls.grade}_${cls.group}_${selectedCycleId}`;
            ops.push(b => b.set(doc(db, 'bimestreLocks', lockId), {
              id: lockId,
              bimestre: selectedPeriod as Bimestre,
              level: lvl,
              grade: cls.grade,
              group: cls.group,
              cycleId: selectedCycleId,
              locked: true,
              lockedAt: serverTimestamp(),
              lockedBy: userProfile?.id || 'admin'
            }));
          }
        });
      });

      await commitBatches(ops);
      toast.success(`¡Periodo ${selectedPeriod} cerrado y bloqueado completamente!`);
      setActionConfirmModal(null);
    } catch (error) {
      console.error("Error locking all:", error);
      toast.error("Error al cerrar el periodo");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeUnlockAll = async () => {
    const targetLevels = selectedLevelFilter === 'ALL' ? levels : [selectedLevelFilter];
    const locksToDelete = activePeriodLocks.filter(l => targetLevels.includes(l.level));

    if (locksToDelete.length === 0) {
      toast.info(`No hay bloqueos activos en el Periodo ${selectedPeriod}`);
      return;
    }

    setIsProcessing(true);
    try {
      const ops: Array<(b: WriteBatch) => void> = [];
      locksToDelete.forEach(l => {
        ops.push(b => b.delete(doc(db, 'bimestreLocks', l.id)));
      });
      await commitBatches(ops);
      toast.success(`¡Periodo ${selectedPeriod} desbloqueado exitosamente!`);
      setActionConfirmModal(null);
    } catch (error) {
      console.error("Error unlocking all:", error);
      toast.error("Error al desbloquear el periodo");
    } finally {
      setIsProcessing(false);
    }
  };

  // Single Subject Lock / Unlock
  const handleUnlockSingleSubject = async (
    levelName: string, 
    grade: string, 
    group: string, 
    subj: Subject, 
    existingLock?: BimestreLock
  ) => {
    if (!selectedCycleId) return;
    setIsProcessing(true);
    try {
      if (existingLock) {
        await deleteDoc(doc(db, 'bimestreLocks', existingLock.id));
        toast.success(`Materia "${subj.name}" desbloqueada para ${grade} "${group}"`);
      } else {
        const globalLock = activePeriodLocks.find(l => 
          l.level === levelName && l.grade === grade && l.group === group && !l.subjectId
        );
        if (globalLock) {
          const levelSubjs = getDeduplicatedSubjects(levelName);
          const otherSubjs = levelSubjs.filter(s => s.id !== subj.id);
          const ops: Array<(b: WriteBatch) => void> = [];
          ops.push((b) => b.delete(doc(db, 'bimestreLocks', globalLock.id)));
          otherSubjs.forEach(s => {
            const lockId = `${selectedPeriod}_${levelName}_${grade}_${group}_${selectedCycleId}_${s.id}`;
            ops.push((b) => b.set(doc(db, 'bimestreLocks', lockId), {
              id: lockId,
              bimestre: selectedPeriod as Bimestre,
              level: levelName,
              grade,
              group,
              cycleId: selectedCycleId,
              subjectId: s.id,
              subjectName: s.name,
              locked: true,
              lockedAt: serverTimestamp(),
              lockedBy: userProfile?.id || 'admin'
            }));
          });
          await commitBatches(ops);
          toast.success(`Materia "${subj.name}" desbloqueada. Las demás materias de ${grade} "${group}" permanecen bloqueadas.`);
        }
      }
    } catch (error) {
      console.error("Error unlocking single subject:", error);
      toast.error("Error al desbloquear la materia");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLockSingleSubject = async (levelName: string, grade: string, group: string, subj: Subject) => {
    if (!selectedCycleId) return;
    setIsProcessing(true);
    try {
      const lockId = `${selectedPeriod}_${levelName}_${grade}_${group}_${selectedCycleId}_${subj.id}`;
      await setDoc(doc(db, 'bimestreLocks', lockId), {
        id: lockId,
        bimestre: selectedPeriod as Bimestre,
        level: levelName,
        grade,
        group,
        cycleId: selectedCycleId,
        subjectId: subj.id,
        subjectName: subj.name,
        locked: true,
        lockedAt: serverTimestamp(),
        lockedBy: userProfile?.id || 'admin'
      });
      toast.success(`Materia "${subj.name}" bloqueada para ${grade} "${group}"`);
    } catch (error) {
      console.error("Error locking single subject:", error);
      toast.error("Error al bloquear la materia");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLockEntireClass = async (levelName: string, grade: string, group: string) => {
    if (!selectedCycleId) return;
    setIsProcessing(true);
    try {
      const isSubj = isSubjectLockLevel(levelName);
      const levelSubjs = getDeduplicatedSubjects(levelName);
      const ops: Array<(b: WriteBatch) => void> = [];

      if (isSubj && levelSubjs.length > 0) {
        const globalLockId = `${selectedPeriod}_${levelName}_${grade}_${group}_${selectedCycleId}`;
        ops.push(b => b.delete(doc(db, 'bimestreLocks', globalLockId)));

        levelSubjs.forEach(s => {
          const lockId = `${selectedPeriod}_${levelName}_${grade}_${group}_${selectedCycleId}_${s.id}`;
          ops.push(b => b.set(doc(db, 'bimestreLocks', lockId), {
            id: lockId,
            bimestre: selectedPeriod as Bimestre,
            level: levelName,
            grade,
            group,
            cycleId: selectedCycleId,
            subjectId: s.id,
            subjectName: s.name,
            locked: true,
            lockedAt: serverTimestamp(),
            lockedBy: userProfile?.id || 'admin'
          }));
        });
      } else {
        const lockId = `${selectedPeriod}_${levelName}_${grade}_${group}_${selectedCycleId}`;
        ops.push(b => b.set(doc(db, 'bimestreLocks', lockId), {
          id: lockId,
          bimestre: selectedPeriod as Bimestre,
          level: levelName,
          grade,
          group,
          cycleId: selectedCycleId,
          locked: true,
          lockedAt: serverTimestamp(),
          lockedBy: userProfile?.id || 'admin'
        }));
      }

      await commitBatches(ops);
      toast.success(`Todas las materias de ${grade} "${group}" han sido bloqueadas`);
    } catch (error) {
      console.error("Error locking class:", error);
      toast.error("Error al bloquear el grupo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlockEntireClass = async (levelName: string, grade: string, group: string) => {
    const classLocks = activePeriodLocks.filter(l => 
      l.level === levelName && l.grade === grade && l.group === group
    );
    if (classLocks.length === 0) return;
    setIsProcessing(true);
    try {
      const ops: Array<(b: WriteBatch) => void> = [];
      classLocks.forEach(l => ops.push(b => b.delete(doc(db, 'bimestreLocks', l.id))));
      await commitBatches(ops);
      toast.success(`Grupo ${grade} "${group}" desbloqueado completamente`);
    } catch (error) {
      console.error("Error unlocking class:", error);
      toast.error("Error al desbloquear el grupo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateCustomLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCycleId) {
      toast.error("No hay ciclo escolar seleccionado");
      return;
    }

    const { level, grade, group, scope, subjectId } = customLockData;

    let targetSubj: Subject | undefined;
    if (scope === 'subject') {
      targetSubj = subjects.find(s => s.id === subjectId);
      if (!targetSubj) {
        toast.error("Selecciona una materia válida para bloquear");
        return;
      }
    }

    const lockId = targetSubj
      ? `${selectedPeriod}_${level}_${grade}_${group}_${selectedCycleId}_${targetSubj.id}`
      : `${selectedPeriod}_${level}_${grade}_${group}_${selectedCycleId}`;

    setIsProcessing(true);
    try {
      const docData: Record<string, any> = {
        id: lockId,
        bimestre: selectedPeriod as Bimestre,
        level,
        grade,
        group,
        cycleId: selectedCycleId,
        locked: true,
        lockedAt: serverTimestamp(),
        lockedBy: userProfile?.id || 'admin'
      };

      if (targetSubj) {
        docData.subjectId = targetSubj.id;
        docData.subjectName = targetSubj.name;
      }

      await setDoc(doc(db, 'bimestreLocks', lockId), docData);
      toast.success(
        targetSubj
          ? `Materia "${targetSubj.name}" bloqueada para ${level} ${grade} "${group}" (Periodo ${selectedPeriod})`
          : `Grado ${level} ${grade} "${group}" bloqueado completamente (Periodo ${selectedPeriod})`
      );
      setIsCustomLockModalOpen(false);
    } catch (error) {
      console.error("Error creating custom lock:", error);
      toast.error("Error al crear el bloqueo");
    } finally {
      setIsProcessing(false);
    }
  };

  const getPeriodLabel = (p: number, lvlName?: string) => {
    if (lvlName && lvlName !== 'ALL') {
      const cfg = getLevelEvaluationConfig(settings, lvlName);
      const name = cfg.periodNames?.[p - 1];
      const tag = cfg.periodType === 'Bimestres' ? `B${p}` : `T${p}`;
      return { tag, name: name || `Periodo ${p}`, type: cfg.periodType };
    }

    return {
      tag: `P${p}`,
      name: `Periodo ${p} (T${p} / B${p})`,
      type: 'Periodo'
    };
  };

  const activePeriodMeta = getPeriodLabel(selectedPeriod, selectedLevelFilter);

  // Filtered teachers and metrics for teacher mode
  const { filteredTeachers, teacherMetrics } = useMemo(() => {
    let withLocks = 0;
    let allOpen = 0;

    teachers.forEach(t => {
      const assignments = getTeacherAssignments(t);
      const lockedCount = assignments.filter(a => isAssignmentLocked(a)).length;
      if (lockedCount > 0) withLocks++;
      else if (assignments.length > 0) allOpen++;
    });

    const list = teachers.filter(t => {
      const assignments = getTeacherAssignments(t);
      const lockedCount = assignments.filter(a => isAssignmentLocked(a)).length;

      // Filter by Level tab if not 'ALL'
      if (selectedLevelFilter !== 'ALL') {
        const teacherLvls = getTeacherLevels(t, assignments);
        const teachesLevel = teacherLvls.some(l => l.toLowerCase().trim() === selectedLevelFilter.toLowerCase().trim());
        if (!teachesLevel) return false;
      }

      // Filter by Lock status
      if (teacherLockFilter === 'locked' && lockedCount === 0) return false;
      if (teacherLockFilter === 'open' && (lockedCount > 0 || assignments.length === 0)) return false;

      // Filter by Search term
      if (teacherSearchTerm) {
        const term = teacherSearchTerm.toLowerCase().trim();
        const nameMatch = (t.name || '').toLowerCase().includes(term);
        const emailMatch = (t.email || '').toLowerCase().includes(term);
        if (!nameMatch && !emailMatch) return false;
      }

      return true;
    });

    return {
      filteredTeachers: list,
      teacherMetrics: {
        total: teachers.length,
        withLocks,
        allOpen
      }
    };
  }, [teachers, selectedLevelFilter, teacherLockFilter, teacherSearchTerm, activePeriodLocks, subjects, classesByLevel]);

  return (
    <div className="space-y-6">
      {/* 1. Header principal con selector de Ciclo */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-200 shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Control de Bloqueos de Periodo
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Gestión, cierre y apertura de trimestres y bimestres por nivel, salón o docente individual
              </p>
            </div>
          </div>

          {/* Selector de Ciclo Escolar */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs self-stretch sm:self-auto">
            <Calendar size={14} className="text-amber-600 shrink-0" />
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ciclo:</span>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer pr-2"
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.id === settings.currentCycleId ? '★ (Activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Pestañas de Vista: Por Niveles y Salones VS Por Docente */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => setManagerMode('by_level')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                managerMode === 'by_level'
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Layers size={13} />
              <span>Por Niveles y Salones</span>
            </button>
            <button
              type="button"
              onClick={() => setManagerMode('by_teacher')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                managerMode === 'by_teacher'
                  ? "bg-indigo-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-indigo-600"
              )}
            >
              <GraduationCap size={14} />
              <span>Bloquear / Desbloquear por Docente ({teachers.length})</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-semibold">
            {managerMode === 'by_teacher' 
              ? 'Controla de forma masiva o por niveles las materias asignadas a cada docente'
              : 'Supervisa los candados agrupados por grado, grupo y asignatura'}
          </div>
        </div>

        {/* 3. Filtro de Nivel Educativo */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter size={12} /> Nivel:
          </span>
          <button
            onClick={() => setSelectedLevelFilter('ALL')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
              selectedLevelFilter === 'ALL'
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            )}
          >
            <Layers size={13} />
            <span>Todos los Niveles</span>
          </button>

          {levels.map(lvl => {
            const cfg = getLevelEvaluationConfig(settings, lvl);
            const isSelected = selectedLevelFilter === lvl;
            const lvlLocksCount = currentCycleLocks.filter(l => l.level === lvl && Number(l.bimestre) === selectedPeriod).length;

            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevelFilter(lvl)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2",
                  isSelected
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                )}
              >
                <span>{lvl}</span>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.2 rounded font-black",
                  isSelected ? "bg-amber-700/80 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {cfg.periodType === 'Bimestres' ? `${cfg.periodCount} Bimestres` : `${cfg.periodCount} Trimestres`}
                </span>
                {lvlLocksCount > 0 && (
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.2 rounded-full font-black",
                    isSelected ? "bg-rose-500 text-white" : "bg-amber-100 text-amber-800"
                  )}>
                    {lvlLocksCount}🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 4. Pestañas de Bloques / Periodos (T1, T2, T3... / B1, B2, B3, B4, B5) */}
        <div className="px-6 pt-4 pb-0 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Selecciona el Bloque / Periodo a Gestionar:
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-3">
            {Array.from({ length: periodCountForSelectedLevel }, (_, i) => i + 1).map((p) => {
              const meta = getPeriodLabel(p, selectedLevelFilter);
              const isSelected = selectedPeriod === p;
              const periodLocksCount = currentCycleLocks.filter(l => 
                Number(l.bimestre) === p && (selectedLevelFilter === 'ALL' || l.level === selectedLevelFilter)
              ).length;

              return (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={cn(
                    "group relative px-4 py-3 rounded-2xl border transition-all text-left shrink-0 cursor-pointer flex flex-col justify-between min-w-[140px] sm:min-w-[170px]",
                    isSelected
                      ? "bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-200/50"
                      : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={cn(
                      "text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg",
                      isSelected ? "bg-amber-600 text-white" : "bg-white border border-slate-200 text-slate-700"
                    )}>
                      {meta.tag}
                    </span>
                    {periodLocksCount > 0 ? (
                      <span className={cn(
                        "text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1",
                        isSelected ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700 border border-rose-200"
                      )}>
                        <Lock size={10} />
                        {periodLocksCount}
                      </span>
                    ) : (
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                        isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                      )}>
                        Abierto
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-bold truncate block",
                    isSelected ? "text-white" : "text-slate-900"
                  )}>
                    {meta.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Banner institucional del Periodo seleccionado y Acciones Globales */}
        <div className="p-6 bg-slate-50/50 border-b border-slate-100">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase px-2.5 py-1 bg-amber-600 text-white rounded-lg shadow-xs">
                  {activePeriodMeta.tag}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {activePeriodMeta.name}
                </h3>
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border",
                  institutionalPeriodStatus.color === 'rose'
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : institutionalPeriodStatus.color === 'amber'
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                )}>
                  {institutionalPeriodStatus.color === 'rose' && <Lock size={11} />}
                  {institutionalPeriodStatus.color === 'emerald' && <CheckCircle2 size={11} />}
                  {institutionalPeriodStatus.color === 'amber' && <AlertTriangle size={11} />}
                  {institutionalPeriodStatus.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {activePeriodLocks.length === 0
                  ? "No hay bloqueos registrados. Todos los docentes tienen permitido capturar notas en este periodo."
                  : `Hay ${activePeriodLocks.length} bloqueo(s) activo(s) protegiendo calificaciones en este periodo.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  const targetLevelsDesc = selectedLevelFilter === 'ALL'
                    ? "TODOS los niveles educativos"
                    : `el nivel ${selectedLevelFilter}`;
                  setActionConfirmModal({
                    isOpen: true,
                    type: selectedLevelFilter === 'ALL' ? 'lock_all' : 'lock_level',
                    targetLevel: selectedLevelFilter === 'ALL' ? undefined : selectedLevelFilter,
                    title: `Cerrar y Bloquear ${activePeriodMeta.name}`,
                    description: `Esta acción bloqueará la captura de calificaciones para ${targetLevelsDesc} en el ${activePeriodMeta.name}. En Secundaria y Preparatoria se bloquearán todas las materias por separado para permitirte desbloquear cualquier materia puntual si lo necesitas.`,
                    actionLabel: 'Bloquear Todo el Periodo',
                    isDangerous: true
                  });
                }}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Lock size={13} />
                <span>Bloquear Periodo Completo</span>
              </button>

              {activePeriodLocks.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const targetLevelsDesc = selectedLevelFilter === 'ALL'
                      ? "TODOS los niveles"
                      : `el nivel ${selectedLevelFilter}`;
                    setActionConfirmModal({
                      isOpen: true,
                      type: selectedLevelFilter === 'ALL' ? 'unlock_all' : 'unlock_level',
                      targetLevel: selectedLevelFilter === 'ALL' ? undefined : selectedLevelFilter,
                      title: `Desbloquear ${activePeriodMeta.name}`,
                      description: `Esta acción retirará los bloqueos de ${targetLevelsDesc} en el ${activePeriodMeta.name}. Los docentes podrán capturar y editar calificaciones nuevamente.`,
                      actionLabel: 'Desbloquear Todo',
                      isDangerous: false
                    });
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Unlock size={13} />
                  <span>Desbloquear Todo</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCustomLockData(prev => ({
                    ...prev,
                    level: selectedLevelFilter !== 'ALL' ? selectedLevelFilter : (levels[0] || 'Primaria')
                  }));
                  setIsCustomLockModalOpen(true);
                }}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} className="text-amber-600" />
                <span>Bloqueo Específico</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            MODO 2: VISTA Y GESTIÓN POR DOCENTE
            ======================================================== */}
        {managerMode === 'by_teacher' ? (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Barra superior de herramientas: Búsqueda, Filtro de Bloqueos y Expansión */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              {/* Buscador de docentes */}
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={teacherSearchTerm}
                  onChange={(e) => setTeacherSearchTerm(e.target.value)}
                  placeholder="Buscar docente por nombre o correo..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                {teacherSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setTeacherSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filtros de estado y botones de expandir */}
              <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                {/* Filtro de estado de bloqueos */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setTeacherLockFilter('ALL')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      teacherLockFilter === 'ALL'
                        ? "bg-white text-slate-900 shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Todos ({teacherMetrics.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherLockFilter('locked')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1",
                      teacherLockFilter === 'locked'
                        ? "bg-rose-600 text-white shadow-xs font-black"
                        : "text-rose-700 hover:bg-rose-50"
                    )}
                  >
                    <Lock size={10} />
                    <span>Con Bloqueos ({teacherMetrics.withLocks})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherLockFilter('open')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1",
                      teacherLockFilter === 'open'
                        ? "bg-emerald-600 text-white shadow-xs font-black"
                        : "text-emerald-700 hover:bg-emerald-50"
                    )}
                  >
                    <Unlock size={10} />
                    <span>Abiertos ({teacherMetrics.allOpen})</span>
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block mx-0.5" />

                {/* Expandir / Colapsar Todos */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => expandAllTeachers(filteredTeachers)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs cursor-pointer"
                    title="Desplegar todas las materias de todos los docentes"
                  >
                    Expandir todo
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllTeachers}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs cursor-pointer"
                    title="Ocultar materias de todos los docentes"
                  >
                    Colapsar todo
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Docentes */}
            {filteredTeachers.length === 0 ? (
              <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <GraduationCap size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  No se encontraron docentes con los criterios seleccionados
                </p>
                {(teacherSearchTerm || teacherLockFilter !== 'ALL' || selectedLevelFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSearchTerm('');
                      setTeacherLockFilter('ALL');
                      setSelectedLevelFilter('ALL');
                    }}
                    className="mt-2 text-xs font-bold text-indigo-600 hover:underline uppercase tracking-wider cursor-pointer"
                  >
                    Restablecer filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredTeachers.map(teacher => {
                  const assignments = getTeacherAssignments(teacher);
                  const isExpanded = !!expandedTeachers[teacher.id];

                  // Check how many assignments are locked
                  const lockedCount = assignments.filter(a => isAssignmentLocked(a)).length;
                  const totalCount = assignments.length;
                  const isAllLocked = totalCount > 0 && lockedCount === totalCount;
                  const isPartiallyLocked = lockedCount > 0 && !isAllLocked;
                  const isAllOpen = totalCount > 0 && lockedCount === 0;

                  // Distinct levels for this teacher
                  const teacherLevels = getTeacherLevels(teacher, assignments);

                  return (
                    <div
                      key={teacher.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all overflow-hidden"
                    >
                      {/* FILA 1: Identidad del Docente y Acciones Globales (Todo a la vez) */}
                      <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                        {/* Izquierda: Avatar, Nombre, Correo y Estado Global */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm uppercase shadow-xs shrink-0">
                            {teacher.name?.charAt(0) || 'D'}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-black text-slate-900 truncate">
                                {teacher.name}
                              </h4>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                isAllLocked
                                  ? "bg-rose-50 border-rose-200 text-rose-700"
                                  : isPartiallyLocked
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : totalCount === 0
                                      ? "bg-slate-100 border-slate-200 text-slate-500"
                                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                              )}>
                                {totalCount === 0 && 'Sin materias asignadas'}
                                {isAllLocked && `🔒 Todo Bloqueado (${totalCount} materias)`}
                                {isPartiallyLocked && `🟡 Parcial (${lockedCount}/${totalCount} bloqueadas)`}
                                {isAllOpen && `🟢 Todo Abierto (${totalCount} materias)`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold truncate mt-0.5">
                              <span>{teacher.email}</span>
                              {teacherLevels.length > 0 && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center gap-1">
                                    {teacherLevels.map(lvl => (
                                      <span key={lvl} className="bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                        {lvl}
                                      </span>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Derecha: Acciones Globales (Todo a la vez) + Desplegar */}
                        {totalCount > 0 && (
                          <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleLockTeacherAll(teacher)}
                              disabled={isProcessing || isAllLocked}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5",
                                isAllLocked
                                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                                  : "bg-amber-600 hover:bg-amber-700 text-white active:scale-95 cursor-pointer"
                              )}
                              title="Bloquear todas las materias asignadas a este docente en todos sus niveles a la vez"
                            >
                              <Lock size={12} />
                              <span>Bloquear Todo</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUnlockTeacherAll(teacher)}
                              disabled={isProcessing || isAllOpen}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5",
                                isAllOpen
                                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer"
                              )}
                              title="Desbloquear todas las materias asignadas a este docente en todos sus niveles a la vez"
                            >
                              <Unlock size={12} />
                              <span>Desbloquear Todo</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleTeacherExpanded(teacher.id)}
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                              title={isExpanded ? "Ocultar detalle de materias" : "Ver materias individuales"}
                            >
                              <span>Materias ({totalCount})</span>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* FILA 2: Control Dedicado por Nivel Educativo (Espacioso, Compacto y Profesional) */}
                      {teacherLevels.length > 0 && (
                        <div className="px-4 py-3 bg-white border-b border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                              <Layers size={11} className="text-slate-400" />
                              Control por Nivel Educativo de este docente:
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {teacherLevels.length} nivel{teacherLevels.length > 1 ? 'es' : ''} configurado{teacherLevels.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {teacherLevels.map(lvl => {
                              const lvlAssignments = assignments.filter(a => a.level === lvl);
                              const lvlLocked = lvlAssignments.filter(a => isAssignmentLocked(a)).length;
                              const isLvlAllLocked = lvlAssignments.length > 0 && lvlLocked === lvlAssignments.length;
                              const isLvlAllOpen = lvlAssignments.length > 0 && lvlLocked === 0;
                              const isLvlPartial = lvlLocked > 0 && !isLvlAllLocked;

                              return (
                                <div
                                  key={lvl}
                                  className={cn(
                                    "p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition-all",
                                    isLvlAllLocked 
                                      ? "bg-rose-50/40 border-rose-200"
                                      : isLvlPartial 
                                        ? "bg-amber-50/40 border-amber-200"
                                        : "bg-slate-50/60 border-slate-200"
                                  )}
                                >
                                  {/* Cabecera del Nivel */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{
                                        backgroundColor: isLvlAllLocked ? '#f43f5e' : isLvlPartial ? '#f59e0b' : '#10b981'
                                      }} />
                                      <span className="text-xs font-black text-slate-900 uppercase truncate">
                                        {lvl}
                                      </span>
                                    </div>
                                    <span className={cn(
                                      "px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider border shrink-0",
                                      isLvlAllLocked 
                                        ? "bg-rose-50 border-rose-200 text-rose-700" 
                                        : isLvlPartial 
                                          ? "bg-amber-50 border-amber-200 text-amber-700"
                                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    )}>
                                      {isLvlAllLocked && 'Bloqueado'}
                                      {isLvlPartial && `${lvlLocked}/${lvlAssignments.length} bloq.`}
                                      {isLvlAllOpen && 'Abierto'}
                                    </span>
                                  </div>

                                  {/* Conteo de materias */}
                                  <p className="text-[10px] text-slate-500 font-semibold">
                                    {lvlAssignments.length} {lvlAssignments.length === 1 ? 'asignación' : 'asignaciones'} en este nivel
                                  </p>

                                  {/* Botones independientes para este Nivel */}
                                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60">
                                    <button
                                      type="button"
                                      onClick={() => handleLockTeacherLevel(teacher, lvl)}
                                      disabled={isProcessing || isLvlAllLocked}
                                      className={cn(
                                        "py-1 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1",
                                        isLvlAllLocked
                                          ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
                                          : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs cursor-pointer"
                                      )}
                                      title={`Bloquear asignaciones de ${lvl} de este docente`}
                                    >
                                      <Lock size={10} />
                                      <span>Bloquear</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleUnlockTeacherLevel(teacher, lvl)}
                                      disabled={isProcessing || isLvlAllOpen}
                                      className={cn(
                                        "py-1 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1",
                                        isLvlAllOpen
                                          ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
                                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs cursor-pointer"
                                      )}
                                      title={`Abrir captura de ${lvl} de este docente`}
                                    >
                                      <Unlock size={10} />
                                      <span>Abrir</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* FILA 3: Desglose Compacto en Tabla de Materias (Al expandir) */}
                      {isExpanded && (
                        <div className="p-4 bg-slate-50/30 border-t border-slate-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                              <BookOpen size={12} className="text-indigo-600" />
                              Detalle individual de asignaciones en el Periodo {selectedPeriod}:
                            </p>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {assignments.length} asignaciones
                            </span>
                          </div>

                          {assignments.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">Sin asignaciones configuradas</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <th className="py-2.5 px-3">Nivel</th>
                                    <th className="py-2.5 px-3">Grado y Grupo</th>
                                    <th className="py-2.5 px-3">Materia / Asignatura</th>
                                    <th className="py-2.5 px-3 text-center">Estado</th>
                                    <th className="py-2.5 px-3 text-right">Acción Individual</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {assignments.map((item, idx) => {
                                    const locked = isAssignmentLocked(item);
                                    const subjObj = subjects.find(s => s.id === item.subjectId);

                                    return (
                                      <tr key={`${item.level}_${item.grade}_${item.group}_${item.subjectId || idx}`} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md uppercase">
                                            {item.level}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap font-black text-slate-800">
                                          {item.grade} "{item.group}"
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className="font-bold text-slate-900">
                                            {item.subjectName || 'Salón completo'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap">
                                          {locked ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 border border-rose-200 text-rose-700">
                                              <Lock size={10} />
                                              <span>Bloqueado</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 border border-emerald-200 text-emerald-700">
                                              <Unlock size={10} />
                                              <span>Abierto</span>
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-right whitespace-nowrap">
                                          {locked ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (subjObj) {
                                                  handleUnlockSingleSubject(item.level, item.grade, item.group, subjObj);
                                                } else {
                                                  handleUnlockEntireClass(item.level, item.grade, item.group);
                                                }
                                              }}
                                              disabled={isProcessing}
                                              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-[10px] font-black uppercase transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                              title="Desbloquear solo esta materia"
                                            >
                                              <Unlock size={10} />
                                              <span>Abrir</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (subjObj) {
                                                  handleLockSingleSubject(item.level, item.grade, item.group, subjObj);
                                                } else {
                                                  handleLockEntireClass(item.level, item.grade, item.group);
                                                }
                                              }}
                                              disabled={isProcessing}
                                              className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 rounded-lg text-[10px] font-black uppercase transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                              title="Bloquear solo esta materia"
                                            >
                                              <Lock size={10} />
                                              <span>Bloquear</span>
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================
              MODO 1: VISTA POR NIVELES Y SALONES
              ======================================================== */
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div className="relative w-full max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar materia, grado o grupo (ej. Artes, 2do A)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-700 underline cursor-pointer"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>

            {(selectedLevelFilter === 'ALL' ? levels : [selectedLevelFilter]).map(lvl => {
              const levelClasses = classesByLevel[lvl] || [];
              const locks = getLevelLocks(lvl);
              const status = getLevelLockStatus(lvl);
              const cfg = getLevelEvaluationConfig(settings, lvl);
              const isSubjLock = isSubjectLockLevel(lvl);
              const levelSubjs = getDeduplicatedSubjects(lvl);

              if (selectedPeriod > cfg.periodCount) {
                return (
                  <div key={lvl} className="p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-between text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">{lvl}</span>
                      <span className="text-[10px] font-semibold italic">
                        (Este nivel cuenta con {cfg.periodCount} {cfg.periodType.toLowerCase()})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                      No Aplica
                    </span>
                  </div>
                );
              }

              const filteredClasses = levelClasses.filter(c => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase().trim();
                const classStr = `${c.grade} ${c.group}`.toLowerCase();
                if (classStr.includes(term)) return true;
                if (levelSubjs.some(s => s.name.toLowerCase().includes(term))) return true;
                return false;
              });

              return (
                <div key={lvl} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        {lvl.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            {lvl}
                          </h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                            status.color === 'rose'
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : status.color === 'amber'
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          )}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          {cfg.periodNames?.[selectedPeriod - 1] || `Periodo ${selectedPeriod}`} • {isSubjLock ? 'Bloqueo independiente por materia (permite desbloquear materias individuales)' : 'Bloqueo completo por grupo'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setActionConfirmModal({
                            isOpen: true,
                            type: 'lock_level',
                            targetLevel: lvl,
                            title: `Bloquear ${lvl} (${activePeriodMeta.name})`,
                            description: isSubjLock
                              ? `Se bloquearán todas las materias de ${lvl} para el ${activePeriodMeta.name}. Cada materia quedará registrada independientemente, por lo que podrás desbloquear cualquiera de ellas individualmente cuando lo desees.`
                              : `Se cerrará la captura de calificaciones para todos los salones de ${lvl} en el ${activePeriodMeta.name}.`,
                            actionLabel: `Bloquear ${lvl}`,
                            isDangerous: true
                          });
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Lock size={12} />
                        <span>Bloquear {lvl}</span>
                      </button>

                      {locks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionConfirmModal({
                              isOpen: true,
                              type: 'unlock_level',
                              targetLevel: lvl,
                              title: `Desbloquear ${lvl} (${activePeriodMeta.name})`,
                              description: `Se retirarán todos los bloqueos de ${lvl} en el ${activePeriodMeta.name} (${locks.length} bloqueos).`,
                              actionLabel: `Desbloquear ${lvl}`,
                              isDangerous: false
                            });
                          }}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Unlock size={12} />
                          <span>Desbloquear Todo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {filteredClasses.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                        <ShieldCheck size={32} className="mx-auto text-emerald-500 mb-2" />
                        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                          Sin clases que coincidan con la búsqueda
                        </p>
                      </div>
                    ) : (
                      filteredClasses.map(cls => {
                        const classKey = `${lvl}__${cls.grade}__${cls.group}__P${selectedPeriod}`;
                        const classLocks = locks.filter(l => l.grade === cls.grade && l.group === cls.group);
                        const hasGlobalLock = classLocks.some(l => !l.subjectId && l.locked);

                        const isExpanded = expandedClasses[classKey] !== undefined 
                          ? expandedClasses[classKey] 
                          : (classLocks.length > 0 || Boolean(searchTerm));

                        if (isSubjLock && levelSubjs.length > 0) {
                          const lockedSubjectsCount = hasGlobalLock 
                            ? levelSubjs.length 
                            : levelSubjs.filter(s => classLocks.some(l => 
                                (l.subjectId === s.id || (l.subjectName && l.subjectName.toLowerCase().trim() === s.name.toLowerCase().trim())) && 
                                l.locked
                              )).length;

                          const isAllLocked = lockedSubjectsCount === levelSubjs.length;
                          const isPartiallyLocked = lockedSubjectsCount > 0 && !isAllLocked;
                          const isAllOpen = lockedSubjectsCount === 0;

                          return (
                            <div 
                              key={classKey}
                              className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                            >
                              <div className="px-4 py-3 bg-slate-50/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => toggleClassExpanded(classKey)}>
                                  <button
                                    type="button"
                                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                                  >
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-black text-slate-900 uppercase">
                                        {cls.grade} "{cls.group}"
                                      </span>
                                      <span className={cn(
                                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                                        isAllLocked
                                          ? "bg-rose-50 border-rose-200 text-rose-700"
                                          : isPartiallyLocked
                                            ? "bg-amber-50 border-amber-200 text-amber-700"
                                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                      )}>
                                        {isAllLocked && `🔒 Todas bloqueadas (${lockedSubjectsCount}/${levelSubjs.length})`}
                                        {isPartiallyLocked && `🟡 ${lockedSubjectsCount} de ${levelSubjs.length} materias bloqueadas`}
                                        {isAllOpen && `🟢 Abierto para captura (${levelSubjs.length} materias)`}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  {!isAllLocked && (
                                    <button
                                      type="button"
                                      onClick={() => handleLockEntireClass(lvl, cls.grade, cls.group)}
                                      disabled={isProcessing}
                                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                      title="Bloquear todas las materias de este salón"
                                    >
                                      <Lock size={10} />
                                      <span>Bloquear todo el grupo</span>
                                    </button>
                                  )}

                                  {lockedSubjectsCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleUnlockEntireClass(lvl, cls.grade, cls.group)}
                                      disabled={isProcessing}
                                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                      title="Desbloquear todas las materias de este salón"
                                    >
                                      <Unlock size={10} />
                                      <span>Desbloquear todo</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="p-4 bg-white">
                                  {hasGlobalLock && (
                                    <div className="p-2.5 mb-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Lock size={14} className="text-amber-600 shrink-0" />
                                        <span>
                                          Este grupo tiene un <strong>Bloqueo Global</strong> activo. Al desbloquear cualquier materia, se convertirá automáticamente en bloqueos independientes para mantener las demás materias protegidas.
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                    {levelSubjs
                                      .filter(s => !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase().trim()))
                                      .map(s => {
                                        const subjectLock = classLocks.find(l => 
                                          l.subjectId === s.id || 
                                          (l.subjectName && l.subjectName.toLowerCase().trim() === s.name.toLowerCase().trim())
                                        );
                                        const isLocked = hasGlobalLock || Boolean(subjectLock);

                                        return (
                                          <div
                                            key={s.id}
                                            className={cn(
                                              "p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2",
                                              isLocked
                                                ? "bg-amber-50/60 border-amber-200 text-slate-800"
                                                : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/20"
                                            )}
                                          >
                                            <div className="min-w-0 pr-1">
                                              <p className="text-xs font-bold truncate text-slate-900" title={s.name}>
                                                {s.name}
                                              </p>
                                              <span className={cn(
                                                "text-[9px] font-bold uppercase",
                                                isLocked ? "text-amber-700" : "text-emerald-600"
                                              )}>
                                                {isLocked ? "🔒 Bloqueada" : "🟢 Abierta"}
                                              </span>
                                            </div>

                                            {isLocked ? (
                                              <button
                                                type="button"
                                                onClick={() => handleUnlockSingleSubject(lvl, cls.grade, cls.group, s, subjectLock)}
                                                disabled={isProcessing}
                                                className="px-2 py-1 bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-black uppercase transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1"
                                                title={`Desbloquear solo ${s.name}`}
                                              >
                                                <Unlock size={11} className="text-emerald-600" />
                                                <span>Abrir</span>
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => handleLockSingleSubject(lvl, cls.grade, cls.group, s)}
                                                disabled={isProcessing}
                                                className="px-2 py-1 bg-white hover:bg-amber-50 text-slate-500 hover:text-amber-700 border border-slate-200 hover:border-amber-300 rounded-lg text-[10px] font-black uppercase transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1"
                                                title={`Bloquear solo ${s.name}`}
                                              >
                                                <Lock size={11} className="text-amber-600" />
                                                <span>Cerrar</span>
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        const isLocked = classLocks.some(l => !l.subjectId && l.locked);

                        return (
                          <div
                            key={classKey}
                            className="p-3.5 bg-slate-50 hover:bg-white rounded-xl border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition-all flex items-center justify-between"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 uppercase">
                                {cls.grade} "{cls.group}"
                                </span>
                                <span className={cn(
                                  "text-[10px] font-black uppercase px-2 py-0.5 rounded-md border",
                                  isLocked
                                    ? "bg-rose-50 border-rose-200 text-rose-700"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                )}>
                                  {isLocked ? "🔒 Salón Bloqueado" : "🟢 Captura Abierta"}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                {isLocked ? "Cierre completo del grupo" : "Docente titular puede capturar notas"} • Periodo {selectedPeriod}
                              </p>
                            </div>

                            {isLocked ? (
                              <button
                                type="button"
                                onClick={() => handleUnlockEntireClass(lvl, cls.grade, cls.group)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5"
                                title="Desbloquear salón para permitir edición"
                              >
                                <Unlock size={13} className="text-emerald-600" />
                                <span>Desbloquear</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleLockEntireClass(lvl, cls.grade, cls.group)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-200 hover:border-amber-300 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5"
                                title="Bloquear salón"
                              >
                                <Lock size={13} className="text-amber-600" />
                                <span>Bloquear</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL: Confirmación de Acciones Masivas
          ======================================================== */}
      <AnimatePresence>
        {actionConfirmModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setActionConfirmModal(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-5 sm:p-6 z-10 space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "p-2 rounded-xl border shrink-0",
                    actionConfirmModal.isDangerous
                      ? "bg-rose-50 border-rose-200 text-rose-600"
                      : "bg-emerald-50 border-emerald-200 text-emerald-600"
                  )}>
                    {actionConfirmModal.isDangerous ? <Lock size={18} /> : <Unlock size={18} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      {actionConfirmModal.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Confirmación de Seguridad
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !isProcessing && setActionConfirmModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {actionConfirmModal.description}
              </p>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionConfirmModal(null)}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (actionConfirmModal.type === 'lock_all') executeLockAll();
                    else if (actionConfirmModal.type === 'unlock_all') executeUnlockAll();
                    else if (actionConfirmModal.type === 'lock_level' && actionConfirmModal.targetLevel) {
                      executeLockLevel(actionConfirmModal.targetLevel);
                    } else if (actionConfirmModal.type === 'unlock_level' && actionConfirmModal.targetLevel) {
                      executeUnlockLevel(actionConfirmModal.targetLevel);
                    }
                  }}
                  disabled={isProcessing}
                  className={cn(
                    "px-4 py-2 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5",
                    actionConfirmModal.isDangerous
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  {isProcessing ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : actionConfirmModal.isDangerous ? (
                    <Lock size={14} />
                  ) : (
                    <Unlock size={14} />
                  )}
                  <span>{actionConfirmModal.actionLabel}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          MODAL: Bloqueo Puntual / Personalizado
          ======================================================== */}
      <AnimatePresence>
        {isCustomLockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setIsCustomLockModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-5 sm:p-6 z-10 space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Bloquear Grado o Materia
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {activePeriodMeta.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !isProcessing && setIsCustomLockModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateCustomLock} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                    Nivel Educativo
                  </label>
                  <select
                    value={customLockData.level}
                    onChange={(e) => setCustomLockData({ ...customLockData, level: e.target.value, subjectId: '' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    {levels.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                      Grado
                    </label>
                    <select
                      value={customLockData.grade}
                      onChange={(e) => setCustomLockData({ ...customLockData, grade: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      {availableGradesForCustomLevel.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                      Grupo
                    </label>
                    <select
                      value={customLockData.group}
                      onChange={(e) => setCustomLockData({ ...customLockData, group: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      {availableGroupsForCustomLevel.map(grp => (
                        <option key={grp} value={grp}>{grp}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                    Alcance del Bloqueo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomLockData({ ...customLockData, scope: 'all', subjectId: '' })}
                      className={cn(
                        "py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer",
                        customLockData.scope === 'all'
                          ? "bg-amber-50 border-amber-300 text-amber-800 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Todo el Grado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const firstSubj = availableSubjectsForCustomLevel[0]?.id || '';
                        setCustomLockData({ ...customLockData, scope: 'subject', subjectId: firstSubj });
                      }}
                      className={cn(
                        "py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer",
                        customLockData.scope === 'subject'
                          ? "bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Materia Específica
                    </button>
                  </div>
                </div>

                {customLockData.scope === 'subject' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                      Materia a Bloquear
                    </label>
                    {availableSubjectsForCustomLevel.length === 0 ? (
                      <p className="text-xs text-rose-500 font-semibold p-2 bg-rose-50 rounded-xl">
                        No hay materias registradas para {customLockData.level}
                      </p>
                    ) : (
                      <select
                        value={customLockData.subjectId}
                        onChange={(e) => setCustomLockData({ ...customLockData, subjectId: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {availableSubjectsForCustomLevel.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCustomLockModalOpen(false)}
                    disabled={isProcessing}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || (customLockData.scope === 'subject' && !customLockData.subjectId)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isProcessing ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Lock size={14} />
                    )}
                    <span>Aplicar Bloqueo</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
