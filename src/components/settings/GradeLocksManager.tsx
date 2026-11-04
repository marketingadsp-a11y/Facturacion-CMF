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
  ChevronRight
} from 'lucide-react';

interface GradeLocksManagerProps {
  settings: AppSettings;
  cycles: SchoolCycle[];
  gradeLocks: BimestreLock[];
  subjects: Subject[];
  userProfile: AppUser | null;
}

interface CustomLockFormData {
  level: string;
  grade: string;
  group: string;
  scope: 'all' | 'subject';
  subjectId: string;
}

export default function GradeLocksManager({
  settings,
  cycles,
  gradeLocks,
  subjects,
  userProfile
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

  // 3. Subscribe to students to know all active classes (level, grade, group) in the school
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

  // 4. Periods for current view
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

  // 5. Operation states & confirmation modal
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

  // 6. Custom lock modal state
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

    // Single-teacher levels (Primaria, Preescolar)
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
  // ACTIONS: Lock / Unlock Handlers
  // ========================================================

  // Bloquear Nivel Completo: en Secundaria/Prepa crea bloqueos independientes por cada materia
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
          // Remove legacy global class lock so subject-level locks take full effect
          const globalLockId = `${selectedPeriod}_${levelName}_${cls.grade}_${cls.group}_${selectedCycleId}`;
          ops.push(b => b.delete(doc(db, 'bimestreLocks', globalLockId)));

          // Create lock for each individual subject
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
          // Standard whole-class lock for Primaria / Preescolar
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
          ? `¡Nivel "${levelName}" bloqueado por materias con éxito! Ahora puedes desbloquear cualquier materia individual.`
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

  // Desbloquear Nivel Completo
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

  // Bloquear Periodo Completo (Todos los Niveles)
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

  // Desbloquear Periodo Completo
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

  // ========================================================
  // DESBLOQUEAR / BLOQUEAR UNA SOLA MATERIA
  // ========================================================

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
        // Direct delete of specific subject lock
        await deleteDoc(doc(db, 'bimestreLocks', existingLock.id));
        toast.success(`Materia "${subj.name}" desbloqueada para ${grade} "${group}"`);
      } else {
        // Check if there was a global lock covering this class
        const globalLock = activePeriodLocks.find(l => 
          l.level === levelName && l.grade === grade && l.group === group && !l.subjectId
        );
        if (globalLock) {
          // SPLIT THE GLOBAL LOCK:
          // 1. Delete global lock
          // 2. Create subject locks for ALL OTHER subjects in this class!
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

  // Bloquear / Desbloquear Todo un Grupo
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

  // Crear Bloqueo Personalizado
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
                Gestión, cierre y apertura de trimestres y bimestres por nivel o materia individual
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

        {/* 2. Filtro de Nivel Educativo */}
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

        {/* 3. Pestañas de Bloques / Periodos (T1, T2, T3... / B1, B2, B3, B4, B5) */}
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

        {/* 4. Banner institucional del Periodo seleccionado y Acciones Globales */}
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

            {/* Botones de acción institucional */}
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

        {/* Barra de búsqueda rápida de clases / materias */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
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

        {/* 5. Secciones por Nivel Educativo en el Periodo Seleccionado */}
        <div className="p-6 space-y-6">
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

            // Filter classes matching searchTerm if any
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
                {/* Cabecera del Nivel */}
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

                  {/* Acciones para este nivel */}
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

                {/* Contenido: Tarjetas agrupadas por Grado y Grupo */}
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

                      // Is expanded by default if has locks or if user explicitly opened
                      const isExpanded = expandedClasses[classKey] !== undefined 
                        ? expandedClasses[classKey] 
                        : (classLocks.length > 0 || Boolean(searchTerm));

                      // If this is Secundaria or Prepa (subject-level locking)
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
                            {/* Cabecera del Salón / Grupo */}
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

                              {/* Acciones del Grupo */}
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

                            {/* Detalle de Materias (cuando está expandido) */}
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

                      // Single-teacher levels (Primaria, Preescolar)
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
