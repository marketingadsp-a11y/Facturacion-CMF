import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { usePermissions } from '../hooks/usePermissions';
import { AppUser, Student, StudentGrade, Bimestre, Attendance, AttendanceStatus, BimestreLock, Subject, AppSettings, SchoolCycle, ScheduleSlot, TeacherSubstitution } from '../types';
import { getLevelEvaluationConfig, getPeriodForDate, isAttendanceTrackingSubject } from '../lib/evaluationUtils';
import { 
  Users, 
  User,
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
  Clock as ClockIcon,
  CreditCard,
  Download,
  Copy,
  ExternalLink,
  Share2,
  Upload,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Edit3,
  Trash2,
  ShieldCheck,
  UserCheck,
  School,
  IdCard,
  QrCode,
  FileBadge,
  X
} from 'lucide-react';
import { cn, studentMatchesSearch } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToSchedules, subscribeToSubstitutions } from '../services/scheduleService';
import { pdf } from '@react-pdf/renderer';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import TeacherCredentialPDF from '../components/TeacherCredentialPDF';

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

export default function TeacherPortal() {
  const { userProfile, hasPermission } = usePermissions();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, StudentGrade>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [cycleAbsences, setCycleAbsences] = useState<Attendance[]>([]);
  const [justificationModal, setJustificationModal] = useState<{
    student: Student;
    currentReason?: string;
  } | null>(null);
  const [justificationReason, setJustificationReason] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attendance' | 'grading' | 'horario' | 'credencial'>('attendance');
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [isEditingCredential, setIsEditingCredential] = useState(false);
  const [isSavingCredential, setIsSavingCredential] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [credFormData, setCredFormData] = useState({
    name: '',
    employeeNumber: '',
    assignedLevel: '',
    photoUrl: ''
  });

  const [selectedBimestre, setSelectedBimestre] = useState<Bimestre>(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [substitutions, setSubstitutions] = useState<TeacherSubstitution[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [isBimestreLocked, setIsBimestreLocked] = useState(false);
  const [lockedPeriods, setLockedPeriods] = useState<Record<number, boolean>>({});
  const hasManuallySelectedPeriodRef = useRef(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const isSuperAdmin = userProfile?.role === 'Superadministrador' || userProfile?.email?.toLowerCase() === 'cramonmb@gmail.com';
  const restrictedLevels = useMemo(() => isSuperAdmin ? [] : (userProfile?.restrictedLevels || []), [isSuperAdmin, userProfile?.restrictedLevels]);
  const restrictedGrades = useMemo(() => isSuperAdmin ? [] : (userProfile?.restrictedGrades || []), [isSuperAdmin, userProfile?.restrictedGrades]);
  const restrictedGroups = useMemo(() => isSuperAdmin ? [] : (userProfile?.restrictedGroups || []), [isSuperAdmin, userProfile?.restrictedGroups]);

  const availableLevels = useMemo(() => {
    const all = settings?.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato'];
    if (restrictedLevels.length > 0) {
      return all.filter(lvl => restrictedLevels.includes(lvl));
    }
    return all;
  }, [settings?.academicLevels, restrictedLevels]);

  const availableGrades = useMemo(() => {
    const all = settings?.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to'];
    if (restrictedGrades.length > 0) {
      return all.filter(g => restrictedGrades.includes(g));
    }
    return all;
  }, [settings?.academicGrades, restrictedGrades]);

  const availableGroups = useMemo(() => {
    const all = settings?.academicGroups && settings.academicGroups.length > 0
      ? settings.academicGroups
      : ['A', 'B', 'C', 'D'];
    if (restrictedGroups.length > 0) {
      return all.filter(grp => restrictedGroups.includes(grp));
    }
    return all;
  }, [settings?.academicGroups, restrictedGroups]);

  const isMultiGroupTeacher = userProfile?.role === 'Docente' && (
    userProfile.teacherGroupAccess === 'multiple' ||
    (userProfile.restrictedLevels && userProfile.restrictedLevels.length > 1) ||
    (userProfile.restrictedGrades && userProfile.restrictedGrades.length > 1) ||
    (userProfile.restrictedGroups && userProfile.restrictedGroups.length > 1) ||
    availableLevels.length > 1 ||
    availableGrades.length > 1 ||
    availableGroups.length > 1
  );

  const canFilterGroups = userProfile?.role !== 'Docente' || isMultiGroupTeacher;

  const activeLevel = useMemo(() => {
    if (selectedLevel && availableLevels.includes(selectedLevel)) return selectedLevel;
    if (userProfile?.role === 'Docente' && userProfile.assignedLevel && availableLevels.includes(userProfile.assignedLevel)) {
      return userProfile.assignedLevel;
    }
    return availableLevels[0] || '';
  }, [selectedLevel, availableLevels, userProfile]);

  const activeGrade = useMemo(() => {
    if (selectedGrade && availableGrades.includes(selectedGrade)) return selectedGrade;
    if (userProfile?.role === 'Docente' && userProfile.assignedGrade && availableGrades.includes(userProfile.assignedGrade)) {
      return userProfile.assignedGrade;
    }
    return availableGrades[0] || '';
  }, [selectedGrade, availableGrades, userProfile]);

  const activeGroup = useMemo(() => {
    if (selectedGroup && availableGroups.includes(selectedGroup)) return selectedGroup;
    if (userProfile?.role === 'Docente' && userProfile.assignedGroup && availableGroups.includes(userProfile.assignedGroup)) {
      return userProfile.assignedGroup;
    }
    return availableGroups[0] || 'A';
  }, [selectedGroup, availableGroups, userProfile]);

  const students = useMemo(() => {
    let list = [...allStudents];
    if (restrictedLevels.length > 0) {
      list = list.filter(s => restrictedLevels.includes(s.level));
    }
    if (restrictedGrades.length > 0) {
      list = list.filter(s => restrictedGrades.includes(s.grade));
    }
    if (restrictedGroups.length > 0) {
      list = list.filter(s => restrictedGroups.includes(s.group || ''));
    }

    if (activeLevel) {
      list = list.filter(s => s.level?.toLowerCase().trim() === activeLevel.toLowerCase().trim());
    }
    if (activeGrade) {
      list = list.filter(s => s.grade === activeGrade);
    }
    if (activeGroup) {
      list = list.filter(s => s.group === activeGroup);
    }
    return list.sort((a, b) => {
      const nameA = `${a.name || ''} ${a.lastName || ''}`.toLowerCase();
      const nameB = `${b.name || ''} ${b.lastName || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [allStudents, restrictedLevels, restrictedGrades, restrictedGroups, activeLevel, activeGrade, activeGroup]);

  const evalConfig = useMemo(() => {
    return getLevelEvaluationConfig(settings, activeLevel);
  }, [settings, activeLevel]);

  const gradingScale = evalConfig.gradingScale || 'numeric_10';

  // Subjects for the current active level
  const activeLevelSubjects = useMemo(() => {
    let list = subjects.filter(s => 
      s.level && activeLevel && 
      s.level.toLowerCase().trim() === activeLevel.toLowerCase().trim()
    );

    // If teacher has specific subject access, filter only assigned subjects (and by grade/group if restricted)
    if (userProfile?.role === 'Docente' && userProfile.teacherSubjectAccess === 'specific') {
      const allowed = userProfile.assignedSubjects || [];
      list = list.filter(s => {
        const keyWithLevel = `${s.name}__${s.level}`;
        const isSubjectAllowed = allowed.some(a => 
          a === s.id || 
          a.toLowerCase().trim() === keyWithLevel.toLowerCase().trim() ||
          a.toLowerCase().trim() === s.name.toLowerCase().trim()
        );
        if (!isSubjectAllowed) return false;

        // Check if grade-restricted for this subject
        const gradeList = userProfile.teacherSubjectGrades?.[keyWithLevel] 
          || userProfile.teacherSubjectGrades?.[s.name] 
          || userProfile.teacherSubjectGrades?.[s.id];

        if (gradeList && gradeList.length > 0 && !gradeList.includes('all')) {
          if (activeGrade && !gradeList.includes(activeGrade)) {
            return false;
          }
        }

        // Check if group-restricted for this subject
        const groupList = userProfile.teacherSubjectGroups?.[keyWithLevel]
          || userProfile.teacherSubjectGroups?.[s.name]
          || userProfile.teacherSubjectGroups?.[s.id];

        if (groupList && groupList.length > 0 && !groupList.includes('all')) {
          if (activeGroup && !groupList.includes(activeGroup)) {
            return false;
          }
        }

        return true;
      });
    }

    // CRITICAL: Deduplicate subjects by normalized name within the same level
    // This strictly guarantees no subject is ever duplicated in the grading table
    const seenNames = new Set<string>();
    list = list.filter(s => {
      const norm = s.name.toLowerCase().trim();
      if (seenNames.has(norm)) return false;
      seenNames.add(norm);
      return true;
    });

    return list;
  }, [subjects, activeLevel, activeGrade, activeGroup, userProfile]);

  // Academic and Autonomía Curricular subjects (combined, used for average calculations)
  const academicLevelSubjects = useMemo(() => {
    return activeLevelSubjects.filter(s => 
      s.category !== 'Aspectos Formativos' && s.category !== 'Desarrollo Personal'
    );
  }, [activeLevelSubjects]);

  // Pure academic subjects only
  const pureAcademicSubjects = useMemo(() => {
    return activeLevelSubjects.filter(s => 
      !s.category || s.category === 'Académica'
    );
  }, [activeLevelSubjects]);

  // Autonomía Curricular subjects only
  const autonomyCurricularSubjects = useMemo(() => {
    return activeLevelSubjects.filter(s => 
      s.category === 'Autonomía Curricular'
    );
  }, [activeLevelSubjects]);

  // Desarrollo Personal subjects (formerly Aspectos Formativos)
  const personalDevLevelSubjects = useMemo(() => {
    return activeLevelSubjects.filter(s => 
      s.category === 'Aspectos Formativos' || s.category === 'Desarrollo Personal'
    );
  }, [activeLevelSubjects]);

  const isSpecificTeacher = userProfile?.role === 'Docente' && userProfile.teacherSubjectAccess === 'specific';

  // Adjust selectedBimestre if it exceeds the level's period count
  useEffect(() => {
    if (evalConfig.periodCount && selectedBimestre > evalConfig.periodCount) {
      setSelectedBimestre(1);
    }
  }, [evalConfig.periodCount, selectedBimestre]);

  const [currentCycleId, setCurrentCycleId] = useState('');
  const [selectedLevelSchema, setSelectedLevelSchema] = useState('');

  // Dynamic activePeriods for layout
  const activePeriods = useMemo(() => {
    if (settings?.levelPeriods?.[selectedLevelSchema] && settings.levelPeriods[selectedLevelSchema].length > 0) {
      return settings.levelPeriods[selectedLevelSchema];
    }
    return DEFAULT_TIME_PERIODS;
  }, [settings, selectedLevelSchema]);

  // Helper to map and lookup slots
  const getCellSlot = (dayId: number, periodIndex: number) => {
    return mySchedules.find(s => {
      if (s.day !== dayId) return false;
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

  // Listen to schedules for current cycle
  useEffect(() => {
    if (!currentCycleId) return;
    const unsub = subscribeToSchedules(currentCycleId, (slots) => {
      setSchedules(slots);
    });
    return unsub;
  }, [currentCycleId]);

  // Listen to today's substitutions
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const unsub = subscribeToSubstitutions(todayStr, (subs) => {
      setSubstitutions(subs);
    });
    return unsub;
  }, []);

  // Filter teacher's own schedules
  const mySchedules = useMemo(() => {
    if (!userProfile) return [];
    return schedules.filter(s => s.teacherId === userProfile.id);
  }, [schedules, userProfile]);

  // Substitutions assigned to the teacher today
  const mySubstitutionsToday = useMemo(() => {
    if (!userProfile) return [];
    return substitutions.filter(sub => sub.substituteTeacherId === userProfile.id);
  }, [substitutions, userProfile]);

  // Fetch settings for cycle
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        setSettings(data);
        setCurrentCycleId(data.currentCycleId || '');
        // Initialize schema selection
        if (userProfile?.assignedLevel) {
          setSelectedLevelSchema(userProfile.assignedLevel);
        } else if (data.academicLevels && data.academicLevels.length > 0) {
          setSelectedLevelSchema(data.academicLevels[0]);
        }
      }
    });
    return unsub;
  }, [userProfile]);

  // Fetch subjects
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Subject)));
    });
    return unsub;
  }, []);

  // Fetch students once
  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Ensure the portal doesn't get stuck indefinitely if network is slow
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        console.warn("TeacherPortal: Timeout de seguridad alcanzado cargando alumnos.");
        setLoading(false);
      }
    }, 6000);

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      clearTimeout(safetyTimer);
      if (!isMounted) return;
      const list = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student));
      setAllStudents(list);
      setLoading(false);
    }, (error) => {
      clearTimeout(safetyTimer);
      console.error("Error loading students:", error);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubStudents();
    };
  }, []);

  // Fetch grades for the selected bimestre
  useEffect(() => {
    if (!currentCycleId) return;

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
      },
      (error) => {
        console.error("Error loading grades:", error);
      }
    );

    return () => unsubGrades();
  }, [selectedBimestre, currentCycleId]);

  // Fetch lock status for all periods of current class
  useEffect(() => {
    if (!currentCycleId || !activeLevel || !activeGrade) {
      setLockedPeriods({});
      setIsBimestreLocked(false);
      return;
    }

    const unsubs = Array.from({ length: evalConfig.periodCount }, (_, i) => i + 1).map((b) => {
      const lockId = `${b}_${activeLevel}_${activeGrade}_${activeGroup || ''}_${currentCycleId}`;
      return onSnapshot(doc(db, 'bimestreLocks', lockId), (snap) => {
        const isLocked = snap.exists() && !!snap.data()?.locked;
        setLockedPeriods(prev => {
          if (prev[b] === isLocked) return prev;
          return { ...prev, [b]: isLocked };
        });
      }, (error) => {
        console.error("Error reading lock status:", error);
      });
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [activeLevel, activeGrade, activeGroup, currentCycleId, evalConfig.periodCount]);

  // Keep isBimestreLocked in sync with selected period
  useEffect(() => {
    setIsBimestreLocked(!!lockedPeriods[selectedBimestre]);
  }, [lockedPeriods, selectedBimestre]);

  // Reset manual selection when switching tabs or class selection
  useEffect(() => {
    hasManuallySelectedPeriodRef.current = false;
  }, [activeTab, activeLevel, activeGrade, activeGroup]);

  // Auto-advance to the next available (unlocked) period when entering grading or when locks update
  useEffect(() => {
    if (activeTab !== 'grading') return;
    if (hasManuallySelectedPeriodRef.current) return;
    if (!currentCycleId || !activeLevel || !activeGrade) return;

    // Find the first period that is NOT locked
    const firstAvailable = Array.from({ length: evalConfig.periodCount }, (_, i) => i + 1)
      .find(b => !lockedPeriods[b]);

    if (firstAvailable) {
      if (selectedBimestre !== firstAvailable) {
        setSelectedBimestre(firstAvailable as Bimestre);
      }
    } else if (Object.keys(lockedPeriods).length >= evalConfig.periodCount) {
      // If all periods are finalized/locked, stay on the last period
      if (selectedBimestre !== evalConfig.periodCount) {
        setSelectedBimestre(evalConfig.periodCount as Bimestre);
      }
    }
  }, [activeTab, lockedPeriods, evalConfig.periodCount, currentCycleId, activeLevel, activeGrade, selectedBimestre]);

  // Fetch attendance for selected date
  useEffect(() => {
    if (!currentCycleId || activeTab !== 'attendance') return;

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
      },
      (error) => {
        console.error("Error loading attendance:", error);
      }
    );

    return () => unsubAttendance();
  }, [selectedDate, currentCycleId, activeTab]);

  // Fetch all 'Falta' records in the active cycle to calculate cumulative inasistencias per period
  useEffect(() => {
    if (!currentCycleId) {
      setCycleAbsences([]);
      return;
    }

    const unsubAbsences = onSnapshot(
      query(
        collection(db, 'attendance'),
        where('cycleId', '==', currentCycleId),
        where('status', '==', 'Falta')
      ),
      (snap) => {
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Attendance));
        setCycleAbsences(list);
      },
      (error) => {
        console.error("Error loading cycle absences:", error);
      }
    );

    return () => unsubAbsences();
  }, [currentCycleId]);

  const getStudentAbsenceCount = (studentId: string, period: number): number => {
    return cycleAbsences.filter(att => {
      if (att.studentId !== studentId) return false;
      const attPeriod = att.period || getPeriodForDate(att.date, evalConfig.periodCount);
      return attPeriod === period;
    }).length;
  };

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
        let parsedVal: number | string = value;
        if (gradingScale === 'letters') {
          parsedVal = value ? String(value).toUpperCase().trim() : '';
        } else if (value === '' || value === null || value === undefined) {
          parsedVal = '';
        } else {
          const num = parseFloat(value);
          parsedVal = isNaN(num) ? 0 : num;
        }

        const nextSubjects = { ...current.subjects };
        if (parsedVal === '') {
          delete nextSubjects[field];
        } else {
          nextSubjects[field] = parsedVal;
        }

        return {
          ...prev,
          [studentId]: {
            ...current,
            subjects: nextSubjects
          }
        };
      }

      let parsedFieldVal: any = value;
      if (gradingScale === 'letters') {
        parsedFieldVal = value ? String(value).toUpperCase().trim() : '';
      } else if (value === '' || value === null || value === undefined) {
        parsedFieldVal = 0;
      } else {
        const num = parseFloat(value);
        parsedFieldVal = isNaN(num) ? 0 : num;
      }

      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: parsedFieldVal
        }
      };
    });
  };

  const handleSaveAll = async () => {
    if (!hasPermission('grading', 'manage')) return;
    setIsSaving(true);
    try {
      const trackerSubj = personalDevLevelSubjects.find(isAttendanceTrackingSubject);

      const promises = students.map(student => {
        const grade = grades[student.id] || {
          studentId: student.id,
          bimestre: selectedBimestre,
          cycleId: currentCycleId,
          subjects: {},
          conduct: 0,
          uniform: 0,
          attendance: 0,
          tasksNotDone: 0,
          tardies: 0,
          cleanliness: 0,
          updatedAt: serverTimestamp() as any,
          createdBy: userProfile?.id || 'system'
        };

        const autoFaltas = trackerSubj ? getStudentAbsenceCount(student.id, selectedBimestre) : null;
        const finalAttendance = autoFaltas !== null 
          ? (grade.attendance !== undefined && grade.attendance !== '' ? grade.attendance : autoFaltas)
          : grade.attendance;

        const updatedSubjects = { ...(grade.subjects || {}) };
        if (trackerSubj && autoFaltas !== null) {
          if (updatedSubjects[trackerSubj.name] === undefined || updatedSubjects[trackerSubj.name] === '') {
            updatedSubjects[trackerSubj.name] = autoFaltas;
          }
        }

        const id = `${student.id}_B${selectedBimestre}_${currentCycleId}`;
        return setDoc(doc(db, 'grades', id), {
          ...grade,
          attendance: finalAttendance,
          subjects: updatedSubjects,
          cycleId: currentCycleId,
          updatedAt: serverTimestamp(),
          createdBy: userProfile?.id || 'system'
        }, { merge: true });
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
    const periodLabel = evalConfig.periodNames?.[selectedBimestre - 1] || `Periodo ${selectedBimestre}`;
    if (!window.confirm(`¿Estás seguro de finalizar las calificaciones de ${periodLabel}? Una vez finalizado, no podrás editarlas a menos que un administrador te habilite.`)) return;

    setIsLocking(true);
    try {
      // First save everything
      await handleSaveAll();

      const targetLevel = activeLevel;
      const targetGrade = activeGrade;
      const targetGroup = activeGroup;

      const lockId = `${selectedBimestre}_${targetLevel}_${targetGrade}_${targetGroup || ''}_${currentCycleId}`;
      await setDoc(doc(db, 'bimestreLocks', lockId), {
        id: lockId,
        bimestre: selectedBimestre,
        level: targetLevel,
        grade: targetGrade,
        group: targetGroup || '',
        cycleId: currentCycleId,
        locked: true,
        lockedAt: serverTimestamp(),
        lockedBy: userProfile.id
      });

      hasManuallySelectedPeriodRef.current = false;
      if (selectedBimestre < evalConfig.periodCount) {
        const nextB = (selectedBimestre + 1) as Bimestre;
        setSelectedBimestre(nextB);
        setSavedStatus(`¡${periodLabel} finalizado! Se avanzó automáticamente al periodo ${evalConfig.periodType.charAt(0)}${nextB}.`);
      } else {
        setSavedStatus(`¡${periodLabel} finalizado y bloqueado! Se han completado todos los periodos.`);
      }
    } catch (error) {
      console.error("Error locking bimestre:", error);
      alert("Error al finalizar el periodo");
    } finally {
      setIsLocking(false);
    }
  };

  const handleAttendanceToggle = async (studentId: string, newStatus: AttendanceStatus, justification?: string) => {
    if (!userProfile || !currentCycleId) return;

    const attId = `${studentId}_${selectedDate}`;
    const targetPeriod = getPeriodForDate(selectedDate, evalConfig.periodCount);

    try {
      await setDoc(doc(db, 'attendance', attId), {
        studentId,
        cycleId: currentCycleId,
        date: selectedDate,
        status: newStatus,
        justificationReason: newStatus === 'Justificado' ? (justification || 'Justificado con autorización') : null,
        period: targetPeriod,
        updatedAt: serverTimestamp(),
        createdBy: userProfile.id
      });

      // Recalculate absence count for targetPeriod and sync with grades
      const otherAbsences = cycleAbsences.filter(a => !(a.studentId === studentId && a.date === selectedDate));
      const newAbsenceCount = otherAbsences.filter(a => {
        if (a.studentId !== studentId) return false;
        const p = a.period || getPeriodForDate(a.date, evalConfig.periodCount);
        return p === targetPeriod;
      }).length + (newStatus === 'Falta' ? 1 : 0);

      const trackerSubj = personalDevLevelSubjects.find(isAttendanceTrackingSubject);
      const gradeId = `${studentId}_B${targetPeriod}_${currentCycleId}`;
      const updateData: Record<string, any> = {
        studentId,
        cycleId: currentCycleId,
        bimestre: targetPeriod,
        attendance: newAbsenceCount,
        updatedAt: serverTimestamp(),
        createdBy: userProfile.id
      };
      if (trackerSubj) {
        updateData[`subjects.${trackerSubj.name}`] = newAbsenceCount;
      }
      await setDoc(doc(db, 'grades', gradeId), updateData, { merge: true });

      // Update local grades state if targetPeriod is currently viewed
      if (selectedBimestre === targetPeriod) {
        setGrades(prev => {
          const cur = prev[studentId] || {
            studentId,
            bimestre: targetPeriod,
            cycleId: currentCycleId,
            subjects: {},
            conduct: 0,
            uniform: 0,
            attendance: 0,
            tasksNotDone: 0,
            tardies: 0,
            cleanliness: 0,
            updatedAt: serverTimestamp() as any,
            createdBy: userProfile.id
          };
          return {
            ...prev,
            [studentId]: {
              ...cur,
              attendance: newAbsenceCount,
              subjects: {
                ...(cur.subjects || {}),
                ...(trackerSubj ? { [trackerSubj.name]: newAbsenceCount } : {})
              }
            }
          };
        });
      }
    } catch (error) {
      console.error("Error saving attendance:", error);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!userProfile || !currentCycleId || students.length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const targetPeriod = getPeriodForDate(selectedDate, evalConfig.periodCount);
      students.forEach(student => {
        const attId = `${student.id}_${selectedDate}`;
        const ref = doc(db, 'attendance', attId);
        batch.set(ref, {
          studentId: student.id,
          cycleId: currentCycleId,
          date: selectedDate,
          status: 'Asistió',
          period: targetPeriod,
          updatedAt: serverTimestamp(),
          createdBy: userProfile.id
        });
      });
      await batch.commit();
      setSavedStatus('¡Todos los alumnos confirmados como Asistió!');
      setTimeout(() => setSavedStatus(null), 3000);
    } catch (err) {
      console.error("Error marking all present:", err);
      alert("Error al confirmar asistencia");
    } finally {
      setIsSaving(false);
    }
  };

  const openJustificationModal = (student: Student, currentReason?: string) => {
    setJustificationModal({ student, currentReason: currentReason || '' });
    setJustificationReason(currentReason || '');
  };

  const handleSaveJustification = async () => {
    if (!justificationModal) return;
    const reason = justificationReason.trim() || 'Justificado con autorización';
    await handleAttendanceToggle(justificationModal.student.id, 'Justificado', reason);
    setJustificationModal(null);
    setJustificationReason('');
  };

  const filteredStudents = students.filter(s => {
    return studentMatchesSearch([
      s.name,
      s.lastName,
      s.motherLastName,
      s.curp,
      s.matricula
    ], searchTerm);
  }).sort((a, b) => {
    const nameA = `${a.name || ''} ${a.lastName || ''}`.toLowerCase();
    const nameB = `${b.name || ''} ${b.lastName || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Listen to teachers for admin selection
  useEffect(() => {
    if (userProfile?.role !== 'Docente') {
      const unsub = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Docente')), (snap) => {
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as AppUser));
        setTeachers(list);
        if (list.length > 0 && !selectedTeacherId) {
          setSelectedTeacherId(list[0].id);
        }
      });
      return unsub;
    }
  }, [userProfile?.role]);

  // The active teacher whose credential is being viewed/edited
  const credentialTeacher = useMemo(() => {
    if (userProfile?.role === 'Docente') return userProfile;
    if (selectedTeacherId) {
      const found = teachers.find(t => t.id === selectedTeacherId);
      if (found) return found;
    }
    return userProfile;
  }, [userProfile, selectedTeacherId, teachers]);

  // Sync form data with active teacher
  useEffect(() => {
    if (credentialTeacher) {
      setCredFormData({
        name: credentialTeacher.name || '',
        employeeNumber: credentialTeacher.employeeNumber || '',
        assignedLevel: credentialTeacher.assignedLevel || '',
        photoUrl: credentialTeacher.photoUrl || ''
      });
    }
  }, [credentialTeacher?.id, credentialTeacher?.photoUrl, credentialTeacher?.employeeNumber, credentialTeacher?.assignedLevel, credentialTeacher?.name]);

  // Check if required data is missing
  const hasMissingCredentialData = useMemo(() => {
    if (!credentialTeacher) return true;
    return !credFormData.photoUrl || !credFormData.employeeNumber || !credFormData.assignedLevel || !credFormData.name;
  }, [credentialTeacher, credFormData]);

  const virtualCredentialUrl = credentialTeacher?.id 
    ? `${window.location.origin}/credencial-docente/${credentialTeacher.id}` 
    : '';

  // Photo upload handler
  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      if (settings?.imgbbApiKey) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${settings.imgbbApiKey}`, {
          method: 'POST',
          body: fd
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success && resData.data?.url) {
            setCredFormData(prev => ({ ...prev, photoUrl: resData.data.url }));
            toast.success('Fotografía subida exitosamente.');
            setUploadingPhoto(false);
            return;
          }
        }
      }

      // Compression to Base64 (max 500x600, JPEG 0.85)
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 500;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCredFormData(prev => ({ ...prev, photoUrl: dataUrl }));
          toast.success('Fotografía cargada correctamente.');
          setUploadingPhoto(false);
        };
        img.onerror = () => {
          toast.error('Error al procesar la imagen.');
          setUploadingPhoto(false);
        };
        img.src = readerEvent.target?.result as string;
      };
      reader.onerror = () => {
        toast.error('Error al leer el archivo.');
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Error al subir foto:', err);
      toast.error('Error al procesar la imagen.');
      setUploadingPhoto(false);
    }
  };

  const handleSaveCredential = async () => {
    if (!credentialTeacher?.id) return;
    if (!credFormData.name.trim()) {
      toast.error('El nombre del docente es obligatorio.');
      return;
    }
    if (!credFormData.employeeNumber.trim()) {
      toast.error('El número de empleado es obligatorio.');
      return;
    }
    if (!credFormData.assignedLevel.trim()) {
      toast.error('El nivel que imparte es obligatorio.');
      return;
    }
    if (!credFormData.photoUrl) {
      toast.error('La fotografía del docente es obligatoria para la credencial.');
      return;
    }

    setIsSavingCredential(true);
    try {
      await setDoc(doc(db, 'users', credentialTeacher.id), {
        name: credFormData.name.trim(),
        employeeNumber: credFormData.employeeNumber.trim(),
        assignedLevel: credFormData.assignedLevel.trim(),
        photoUrl: credFormData.photoUrl,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast.success('¡Datos de la credencial guardados exitosamente!');
      setIsEditingCredential(false);
    } catch (err: any) {
      console.error('Error al guardar credencial:', err);
      toast.error(`Error al guardar: ${err.message || err}`);
    } finally {
      setIsSavingCredential(false);
    }
  };

  const handleDownloadTeacherPdf = async () => {
    if (!credentialTeacher) return;
    setIsDownloadingPdf(true);
    try {
      const teacherToPrint: AppUser = {
        ...credentialTeacher,
        name: credFormData.name || credentialTeacher.name,
        employeeNumber: credFormData.employeeNumber || credentialTeacher.employeeNumber,
        assignedLevel: credFormData.assignedLevel || credentialTeacher.assignedLevel,
        photoUrl: credFormData.photoUrl || credentialTeacher.photoUrl
      };

      const blob = await pdf(
        <TeacherCredentialPDF 
          teacher={teacherToPrint} 
          settings={settings} 
          virtualCredentialUrl={virtualCredentialUrl} 
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Credencial_Docente_${teacherToPrint.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Credencial PDF descargada exitosamente.');
    } catch (err: any) {
      console.error('Error generando credencial PDF:', err);
      toast.error('Hubo un error al generar la credencial en PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleCopyVirtualLink = () => {
    if (!virtualCredentialUrl) return;
    navigator.clipboard.writeText(virtualCredentialUrl);
    setCopiedLink(true);
    toast.success('Enlace de credencial virtual copiado al portapapeles.');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareVirtualLink = async () => {
    if (!virtualCredentialUrl || !credentialTeacher) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Credencial Docente - ${credentialTeacher.name}`,
          text: `Credencial Digital Oficial de ${credentialTeacher.name} en ${settings?.schoolName || 'Colegio México Franciscano'}`,
          url: virtualCredentialUrl
        });
      } catch (e) {
        // User dismissed
      }
    } else {
      handleCopyVirtualLink();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (userProfile?.role === 'Docente' && (!userProfile.assignedLevel || !userProfile.assignedGrade) && !isMultiGroupTeacher && activeTab !== 'credencial') {
    return (
      <div className="space-y-6 pb-12">
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
          <button
            onClick={() => setActiveTab('horario')}
            className={cn(
              "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === 'horario' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Calendar size={14} /> Mi Horario
          </button>
          <button
            onClick={() => setActiveTab('credencial')}
            className="px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 text-slate-400 hover:text-slate-600"
          >
            <CreditCard size={14} /> Credencial
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-800">
          <div className="flex items-center gap-4">
            <AlertCircle className="shrink-0 text-amber-600" size={32} />
            <div>
              <h2 className="font-bold text-base">Configuración de Grupo Pendiente para Asistencia y Calificaciones</h2>
              <p className="text-xs text-amber-700 mt-0.5">Tu cuenta aún no tiene un grado o grupo asignado para control escolar. Sin embargo, ya puedes configurar tu Credencial Oficial y fotografía en la pestaña Credencial.</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('credencial')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 shadow-sm"
          >
            Ir a Mi Credencial
          </button>
        </div>
      </div>
    );
  }

  const studentAttendanceStatuses = students.map(s => attendance[s.id]?.status || 'Asistió');
  const presentCount = studentAttendanceStatuses.filter(st => st === 'Asistió' || st === 'Retardo' || st === 'Justificado').length;
  const attendancePercentage = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 100;
  const faltaCount = studentAttendanceStatuses.filter(st => st === 'Falta').length;
  const retardoCount = studentAttendanceStatuses.filter(st => st === 'Retardo').length;
  const justificadoCount = studentAttendanceStatuses.filter(st => st === 'Justificado').length;



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
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1 opacity-75 flex items-center gap-2">
            {userProfile?.role === 'Docente' 
              ? (isMultiGroupTeacher ? (
                  <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                    DOCENTE MULTIGRUPO • SELECCIONADO: <strong>{activeLevel} {activeGrade} "{activeGroup}"</strong>
                  </span>
                ) : (
                  <span>ASIGNACIÓN: <strong>{activeLevel} - {activeGrade} "{activeGroup}"</strong></span>
                ))
              : (
                <span>GESTIÓN DE CALIFICACIONES Y ASISTENCIA • <strong>{activeLevel} {activeGrade} "{activeGroup}"</strong></span>
              )}
          </p>
        </div>

        {/* Group selection filter for admin or multi-group teachers */}
        {canFilterGroups ? (
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-1">
              <Users size={12} className="text-blue-600" />
              Grupo Activo:
            </span>
            <select
              value={activeLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-xs"
            >
              {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={activeGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-xs"
            >
              {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={activeGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-xs"
            >
              {availableGroups.map(grp => <option key={grp} value={grp}>Grupo {grp}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-blue-900">
            <Users size={14} className="text-blue-600" />
            <span className="text-xs font-black uppercase tracking-wider">
              {activeLevel} • {activeGrade} "{activeGroup}"
            </span>
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
                Finalizar {evalConfig.periodNames?.[selectedBimestre - 1] || 'Periodo'}
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
              {isBimestreLocked ? 'Guardar (Admin)' : `Guardar ${evalConfig.periodType.charAt(0)}${selectedBimestre}`}
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
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              {evalConfig.periodType === 'Trimestres' ? 'Trimestre Activo' : evalConfig.periodType === 'Bimestres' ? 'Bimestre Activo' : 'Periodo Activo'}
            </p>
            <div className="flex items-end justify-between">
              <p className="text-xl font-bold text-slate-900 tabular-nums">
                {evalConfig.periodNames?.[selectedBimestre - 1] || `${selectedBimestre}º Periodo`}
              </p>
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

      {/* Substitution Alerts banner */}
      {mySubstitutionsToday.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-3xl flex items-start gap-3 text-rose-800 shadow-sm animate-pulse mb-6">
          <AlertCircle className="shrink-0 mt-0.5 animate-bounce" size={20} />
          <div>
            <h3 className="font-black text-xs uppercase tracking-wider">📌 Tienes una Suplencia Hoy</h3>
            <p className="text-[10px] font-medium leading-relaxed mt-1">
              Se te ha asignado cubrir las siguientes clases debido a ausencias de docentes:
            </p>
            <div className="mt-2 space-y-1">
              {mySubstitutionsToday.map(sub => {
                const periodTimes = [
                  '07:30 - 08:20', '08:20 - 09:10', '09:10 - 10:00', '10:00 - 10:30', 
                  '10:30 - 11:20', '11:20 - 12:10', '12:10 - 13:00', '13:00 - 13:50'
                ];
                const periodLabel = sub.periodIndex < 3 ? `Periodo ${sub.periodIndex + 1}` : `Periodo ${sub.periodIndex + 2}`;
                const timeStr = sub.periodIndex < 3 ? periodTimes[sub.periodIndex] : periodTimes[sub.periodIndex + 1];
                return (
                  <span key={sub.id} className="text-[9px] font-black bg-white/70 border border-rose-100 rounded px-2.5 py-1 inline-block mr-2 mt-1 shadow-sm">
                    {periodLabel} ({timeStr}) - Cubrir a: {sub.absentTeacherName}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
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
        <button
          onClick={() => setActiveTab('horario')}
          className={cn(
            "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'horario' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Calendar size={14} /> Mi Horario
        </button>
        <button
          onClick={() => setActiveTab('credencial')}
          className={cn(
            "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'credencial' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <CreditCard size={14} /> Credencial
        </button>
      </div>

      {activeTab === 'grading' ? (
        <div className="space-y-4">
          {/* Controls - Compact */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mx-2">
                {evalConfig.periodType}:
              </span>
              {Array.from({ length: evalConfig.periodCount }, (_, i) => (i + 1) as Bimestre).map((b) => (
                <button
                  key={b}
                  type="button"
                  title={evalConfig.periodNames?.[b - 1] || `Periodo ${b}`}
                  onClick={() => {
                    hasManuallySelectedPeriodRef.current = true;
                    setSelectedBimestre(b);
                  }}
                  className={cn(
                    "px-2.5 h-7 rounded font-black text-[10px] transition-all flex items-center justify-center gap-1",
                    selectedBimestre === b 
                      ? "bg-slate-900 text-white shadow-sm" 
                      : lockedPeriods[b]
                        ? "text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <span>{evalConfig.periodType.charAt(0)}{b}</span>
                  {lockedPeriods[b] && <Lock size={9} className="opacity-70 text-amber-500" />}
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

          {/* Category badges legend bar */}
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1">Categorías:</span>
            {pureAcademicSubjects.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 shadow-xs">
                <span>Académica: <strong className="font-black text-blue-900">{pureAcademicSubjects.length}</strong></span>
              </span>
            )}
            {autonomyCurricularSubjects.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                <span>Autonomía Curricular: <strong className="font-black text-amber-900">{autonomyCurricularSubjects.length}</strong></span>
              </span>
            )}
            {personalDevLevelSubjects.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-xs">
                <span>Desarrollo Personal: <strong className="font-black text-indigo-900">{personalDevLevelSubjects.length}</strong></span>
              </span>
            )}
            {isSpecificTeacher && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 shadow-xs">
                <span>Modo: <strong className="font-black text-purple-900">Materias Específicas ({activeLevelSubjects.length})</strong></span>
              </span>
            )}
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded border shadow-xs sm:ml-auto",
              gradingScale === 'letters' ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
              gradingScale === 'numeric_100' ? "bg-purple-50 text-purple-800 border-purple-300" :
              "bg-blue-50 text-blue-800 border-blue-300"
            )}>
              <span>Escala: <strong className="font-black">{
                gradingScale === 'letters' ? 'Letras (A, B, C, D)' :
                gradingScale === 'numeric_100' ? 'Numérica (0 a 100)' : 'Numérica (0 a 10)'
              }</strong></span>
            </span>
          </div>

          {/* If specific teacher and no subjects assigned in this level */}
          {isSpecificTeacher && activeLevelSubjects.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center mb-12 shadow-sm">
              <AlertCircle className="mx-auto text-amber-500 mb-2" size={32} />
              <h3 className="text-sm font-black text-amber-900 uppercase">Sin materias asignadas para este grupo</h3>
              <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto font-medium">
                Tu usuario tiene asignado acceso a materias específicas, pero ninguna de tus materias asignadas corresponde al nivel o grupo seleccionado. Solicita a Dirección o Administración que verifique tus materias en Gestión de Colaboradores.
              </p>
            </div>
          ) : (
            /* Grading Table - High Density with Category Divisions */
            <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden mb-12">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    {/* Category Group Header Row */}
                    <tr className="text-[10px] font-black uppercase tracking-wider">
                      <th 
                        rowSpan={2} 
                        className="px-4 py-3 sticky left-0 bg-slate-100/95 z-20 w-56 border-r-[3px] border-r-slate-300 border-b border-slate-200 backdrop-blur-sm text-slate-700 shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
                      >
                        <span>Nombre Alumno</span>
                      </th>

                      {/* Grupo: Académica */}
                      {pureAcademicSubjects.length > 0 ? (
                        <th 
                          colSpan={pureAcademicSubjects.length} 
                          className={cn(
                            "py-2.5 px-3 text-center bg-blue-50/90 text-blue-900 border-b border-blue-200 font-black",
                            (autonomyCurricularSubjects.length > 0 || personalDevLevelSubjects.length > 0) ? "border-r-[3px] border-r-slate-300" : ""
                          )}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="tracking-wider">Materias Académicas</span>
                            <span className="text-[9px] bg-blue-200/80 text-blue-800 px-1.5 py-0.5 rounded-full font-bold ml-1">
                              {pureAcademicSubjects.length}
                            </span>
                          </div>
                        </th>
                      ) : (autonomyCurricularSubjects.length === 0 && personalDevLevelSubjects.length === 0) ? (
                        <th 
                          colSpan={1} 
                          className="py-2.5 px-3 text-center bg-slate-50 text-slate-400 border-b border-slate-200 font-bold italic text-[9px]"
                        >
                          Sin materias registradas
                        </th>
                      ) : null}

                      {/* Grupo: Autonomía Curricular */}
                      {autonomyCurricularSubjects.length > 0 && (
                        <th 
                          colSpan={autonomyCurricularSubjects.length} 
                          className={cn(
                            "py-2.5 px-3 text-center bg-amber-50/90 text-amber-900 border-b border-amber-200 font-black",
                            personalDevLevelSubjects.length > 0 ? "border-r-[3px] border-r-slate-300" : ""
                          )}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="tracking-wider">Autonomía Curricular</span>
                            <span className="text-[9px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded-full font-bold ml-1">
                              {autonomyCurricularSubjects.length}
                            </span>
                          </div>
                        </th>
                      )}

                      {/* Grupo: Desarrollo Personal */}
                      {personalDevLevelSubjects.length > 0 && (
                        <th 
                          colSpan={personalDevLevelSubjects.length} 
                          className="py-2.5 px-3 text-center bg-indigo-50/90 text-indigo-900 border-b border-indigo-200 font-black"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="tracking-wider">Desarrollo Personal</span>
                            <span className="text-[9px] bg-indigo-200/80 text-indigo-800 px-1.5 py-0.5 rounded-full font-bold ml-1">
                              {personalDevLevelSubjects.length}
                            </span>
                          </div>
                        </th>
                      )}
                    </tr>

                    {/* Subject Names Sub-Header Row */}
                    <tr className="text-[9px] font-black uppercase tracking-wider border-b border-slate-200">
                      {/* Pure Academic Subjects */}
                      {pureAcademicSubjects.length > 0 ? (
                        pureAcademicSubjects.map((subj, idx) => {
                          const isLast = idx === pureAcademicSubjects.length - 1;
                          const hasNextGroup = autonomyCurricularSubjects.length > 0 || personalDevLevelSubjects.length > 0;
                          return (
                            <th 
                              key={subj.id} 
                              className={cn(
                                "px-2 py-2.5 text-center min-w-[95px] max-w-[130px] whitespace-normal break-words leading-tight bg-blue-50/30 text-blue-950",
                                (isLast && hasNextGroup) ? "border-r-[3px] border-r-slate-300" : "border-r border-slate-200"
                              )} 
                              title={`Académica: ${subj.name}`}
                            >
                              <span className="block leading-tight">{subj.name}</span>
                            </th>
                          );
                        })
                      ) : (autonomyCurricularSubjects.length === 0 && personalDevLevelSubjects.length === 0) ? (
                        <th className="px-3 py-2 text-center text-slate-400 italic text-[8px]">
                          -
                        </th>
                      ) : null}

                      {/* Autonomía Curricular Subjects */}
                      {autonomyCurricularSubjects.length > 0 && (
                        autonomyCurricularSubjects.map((subj, idx) => {
                          const isLast = idx === autonomyCurricularSubjects.length - 1;
                          const hasNextGroup = personalDevLevelSubjects.length > 0;
                          return (
                            <th 
                              key={subj.id} 
                              className={cn(
                                "px-2 py-2.5 text-center min-w-[95px] max-w-[130px] whitespace-normal break-words leading-tight bg-amber-50/60 text-amber-950 font-black",
                                (isLast && hasNextGroup) ? "border-r-[3px] border-r-slate-300" : "border-r border-amber-200/70"
                              )} 
                              title={`Autonomía Curricular: ${subj.name}${subj.linkedSubjectName ? ` (Suma al promedio de: ${subj.linkedSubjectName})` : ''}`}
                            >
                              <span className="block leading-tight">{subj.name}</span>
                              {subj.linkedSubjectName && (
                                <span className="block text-[7px] text-amber-700 font-bold uppercase tracking-tighter mt-0.5">
                                  🔗 Suma a: {subj.linkedSubjectName}
                                </span>
                              )}
                            </th>
                          );
                        })
                      )}

                      {/* Desarrollo Personal Subjects */}
                      {personalDevLevelSubjects.length > 0 && (
                        personalDevLevelSubjects.map((subj, idx) => {
                          const isLast = idx === personalDevLevelSubjects.length - 1;
                          return (
                            <th 
                              key={subj.id} 
                              title={`Desarrollo Personal: ${subj.name}`}
                              className={cn(
                                "px-2 py-2.5 text-center min-w-[90px] max-w-[130px] whitespace-normal break-words leading-tight bg-indigo-50/70 text-indigo-900 font-black",
                                isLast ? "" : "border-r border-indigo-200/70"
                              )}
                            >
                              <span className="block leading-tight">{subj.name}</span>
                            </th>
                          );
                        })
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
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
                          <td className="px-4 py-2 sticky left-0 bg-white z-10 border-r-[3px] border-r-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.03)] backdrop-blur-sm group-hover:bg-slate-50/80">
                            <div className="flex items-center gap-3">
                              {student.photoUrl ? (
                                <img 
                                  src={student.photoUrl} 
                                  alt="Avatar" 
                                  className="w-7 h-7 rounded object-cover border border-slate-200 shadow-sm shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-slate-950 text-white flex items-center justify-center font-black text-[10px] shadow-sm shrink-0">
                                  {student.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-900 truncate tracking-tight uppercase leading-none">{student.name}</p>
                                <p className="text-[8px] font-bold text-slate-400 truncate uppercase mt-0.5">{[student.lastName, student.motherLastName].filter(Boolean).join(' ')}</p>
                              </div>
                            </div>
                          </td>

                          {/* Pure Academic Inputs */}
                          {pureAcademicSubjects.length > 0 ? (
                            pureAcademicSubjects.map((subj, idx) => {
                              const isLast = idx === pureAcademicSubjects.length - 1;
                              const hasNextGroup = autonomyCurricularSubjects.length > 0 || personalDevLevelSubjects.length > 0;
                              const rawVal = studentGrade.subjects?.[subj.name] ?? '';
                              return (
                                <td 
                                  key={subj.id} 
                                  className={cn(
                                    "px-1 py-1.5 bg-blue-50/5",
                                    (isLast && hasNextGroup) ? "border-r-[3px] border-r-slate-300" : "border-r border-slate-100"
                                  )}
                                >
                                  {gradingScale === 'letters' ? (
                                    <select
                                      disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                                      value={rawVal}
                                      onChange={(e) => handleGradeChange(student.id, subj.name, e.target.value, true)}
                                      className={cn(
                                        "w-full rounded px-1 py-1.5 text-center text-[10px] font-black outline-none transition-all cursor-pointer border",
                                        rawVal === 'A' ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-black" :
                                        rawVal === 'B' ? "bg-blue-50 text-blue-800 border-blue-300 font-black" :
                                        rawVal === 'C' ? "bg-amber-50 text-amber-800 border-amber-300 font-black" :
                                        rawVal === 'D' ? "bg-rose-50 text-rose-800 border-rose-300 font-black" :
                                        "bg-slate-50 text-slate-400 border-transparent focus:bg-white focus:border-blue-400"
                                      )}
                                    >
                                      <option value="">-</option>
                                      <option value="A">A - Destacado</option>
                                      <option value="B">B - Bueno</option>
                                      <option value="C">C - Suficiente</option>
                                      <option value="D">D - Apoyo</option>
                                    </select>
                                  ) : (
                                    <input
                                      type="number"
                                      inputMode={gradingScale === 'numeric_100' ? "numeric" : "decimal"}
                                      min="0"
                                      max={gradingScale === 'numeric_100' ? "100" : "10"}
                                      step={gradingScale === 'numeric_100' ? "1" : "0.5"}
                                      disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                                      value={rawVal}
                                      onChange={(e) => handleGradeChange(student.id, subj.name, e.target.value, true)}
                                      className="w-full bg-slate-50 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-slate-950 focus:bg-white focus:border-blue-400 outline-none disabled:opacity-30 transition-all tabular-nums italic"
                                      placeholder={gradingScale === 'numeric_100' ? "0-100" : "-"}
                                    />
                                  )}
                                </td>
                              );
                            })
                          ) : (autonomyCurricularSubjects.length === 0 && personalDevLevelSubjects.length === 0) ? (
                            <td className="px-1 py-1.5 text-center text-slate-300 text-[10px] italic">
                              -
                            </td>
                          ) : null}

                          {/* Autonomía Curricular Inputs */}
                          {autonomyCurricularSubjects.length > 0 && (
                            autonomyCurricularSubjects.map((subj, idx) => {
                              const isLast = idx === autonomyCurricularSubjects.length - 1;
                              const hasNextGroup = personalDevLevelSubjects.length > 0;
                              const rawVal = studentGrade.subjects?.[subj.name] ?? '';
                              return (
                                <td 
                                  key={subj.id} 
                                  className={cn(
                                    "px-1 py-1.5 bg-amber-50/20",
                                    (isLast && hasNextGroup) ? "border-r-[3px] border-r-slate-300" : "border-r border-amber-100/70"
                                  )}
                                >
                                  {gradingScale === 'letters' ? (
                                    <select
                                      disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                                      value={rawVal}
                                      onChange={(e) => handleGradeChange(student.id, subj.name, e.target.value, true)}
                                      className={cn(
                                        "w-full rounded px-1 py-1.5 text-center text-[10px] font-black outline-none transition-all cursor-pointer border",
                                        rawVal === 'A' ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-black" :
                                        rawVal === 'B' ? "bg-blue-50 text-blue-800 border-blue-300 font-black" :
                                        rawVal === 'C' ? "bg-amber-50 text-amber-800 border-amber-300 font-black" :
                                        rawVal === 'D' ? "bg-rose-50 text-rose-800 border-rose-300 font-black" :
                                        "bg-amber-50/40 text-amber-400 border-transparent focus:bg-white focus:border-amber-400"
                                      )}
                                    >
                                      <option value="">-</option>
                                      <option value="A">A - Destacado</option>
                                      <option value="B">B - Bueno</option>
                                      <option value="C">C - Suficiente</option>
                                      <option value="D">D - Apoyo</option>
                                    </select>
                                  ) : (
                                    <input
                                      type="number"
                                      inputMode={gradingScale === 'numeric_100' ? "numeric" : "decimal"}
                                      min="0"
                                      max={gradingScale === 'numeric_100' ? "100" : "10"}
                                      step={gradingScale === 'numeric_100' ? "1" : "0.5"}
                                      disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                                      value={rawVal}
                                      onChange={(e) => handleGradeChange(student.id, subj.name, e.target.value, true)}
                                      className="w-full bg-amber-50/40 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-amber-950 focus:bg-white focus:border-amber-400 outline-none disabled:opacity-30 transition-all tabular-nums italic"
                                      placeholder={gradingScale === 'numeric_100' ? "0-100" : "-"}
                                    />
                                  )}
                                </td>
                              );
                            })
                          )}

                          {/* Desarrollo Personal Inputs */}
                          {personalDevLevelSubjects.length > 0 && (
                            personalDevLevelSubjects.map((subj, idx) => {
                              const isLast = idx === personalDevLevelSubjects.length - 1;
                              const isAttendanceTracker = isAttendanceTrackingSubject(subj);
                              const autoAbsenceCount = isAttendanceTracker ? getStudentAbsenceCount(student.id, selectedBimestre) : null;

                              const norm = subj.name.toLowerCase().trim();
                              const legacyField = (
                                norm === 'conducta' ? 'conduct' :
                                norm === 'uniforme' ? 'uniform' :
                                norm === 'faltas' || norm === 'falta' || norm === 'inasistencia' ? 'attendance' :
                                norm === 'tareas' || norm === 'tareas no realizadas' ? 'tasksNotDone' :
                                norm === 'retardo' || norm === 'retardos' ? 'tardies' :
                                norm === 'aseo' ? 'cleanliness' : null
                              ) as keyof StudentGrade | null;

                              const gradeVal = isAttendanceTracker
                                ? (studentGrade.subjects?.[subj.name] ?? (studentGrade.attendance !== undefined && studentGrade.attendance !== '' ? studentGrade.attendance : (autoAbsenceCount ?? 0)))
                                : (studentGrade.subjects?.[subj.name] ?? (legacyField ? studentGrade[legacyField] : '') ?? '');

                              return (
                                <td 
                                  key={subj.id} 
                                  className={cn(
                                    "px-1 py-1.5 bg-indigo-50/15",
                                    isLast ? "" : "border-r border-indigo-100/70"
                                  )}
                                >
                                  {isAttendanceTracker ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                                      value={gradeVal}
                                      onChange={(e) => {
                                        handleGradeChange(student.id, subj.name, e.target.value, true);
                                        handleGradeChange(student.id, 'attendance', e.target.value, false);
                                      }}
                                      className="w-full bg-indigo-50/30 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-indigo-950 focus:bg-white focus:border-indigo-400 outline-none transition-all tabular-nums"
                                      placeholder="0"
                                    />
                                  ) : gradingScale === 'letters' ? (
                                    <select
                                      disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                                      value={gradeVal}
                                      onChange={(e) => {
                                        handleGradeChange(student.id, subj.name, e.target.value, true);
                                        if (legacyField) {
                                          handleGradeChange(student.id, legacyField, e.target.value, false);
                                        }
                                      }}
                                      className={cn(
                                        "w-full rounded px-1 py-1.5 text-center text-[10px] font-black outline-none transition-all cursor-pointer border",
                                        gradeVal === 'A' ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-black" :
                                        gradeVal === 'B' ? "bg-blue-50 text-blue-800 border-blue-300 font-black" :
                                        gradeVal === 'C' ? "bg-amber-50 text-amber-800 border-amber-300 font-black" :
                                        gradeVal === 'D' ? "bg-rose-50 text-rose-800 border-rose-300 font-black" :
                                        "bg-indigo-50/30 text-indigo-400 border-transparent focus:bg-white focus:border-indigo-400"
                                      )}
                                    >
                                      <option value="">-</option>
                                      <option value="A">A - Destacado</option>
                                      <option value="B">B - Bueno</option>
                                      <option value="C">C - Suficiente</option>
                                      <option value="D">D - Apoyo</option>
                                    </select>
                                  ) : (
                                    <input
                                      type="number"
                                      inputMode={gradingScale === 'numeric_100' ? "numeric" : "decimal"}
                                      min="0"
                                      max={gradingScale === 'numeric_100' ? "100" : "10"}
                                      step={gradingScale === 'numeric_100' ? "1" : "0.5"}
                                      disabled={isBimestreLocked && !['Superadministrador', 'Administrador'].includes(userProfile?.role || '')}
                                      value={gradeVal}
                                      onChange={(e) => {
                                        handleGradeChange(student.id, subj.name, e.target.value, true);
                                        if (legacyField) {
                                          handleGradeChange(student.id, legacyField, e.target.value, false);
                                        }
                                      }}
                                      className="w-full bg-indigo-50/30 border border-transparent rounded px-1 py-2 text-center text-[10px] font-black text-indigo-950 focus:bg-white focus:border-indigo-400 outline-none transition-all italic tabular-nums"
                                      placeholder={gradingScale === 'numeric_100' ? "0-100" : "-"}
                                    />
                                  )}
                                </td>
                              );
                            })
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'attendance' ? (
        <div className="space-y-4">
          {/* Attendance Controls - Compact */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-3 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-sm"
                />
              </div>

              {/* Attendance Quick Stats */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                  Presentes: {presentCount}/{students.length} ({attendancePercentage}%)
                </span>
                {faltaCount > 0 && (
                  <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded flex items-center gap-1">
                    <UserX size={10} className="text-slate-500" /> {faltaCount} {faltaCount === 1 ? 'Falta' : 'Faltas'}
                  </span>
                )}
                {justificadoCount > 0 && (
                  <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded flex items-center gap-1">
                    <ShieldCheck size={10} className="text-slate-500" /> {justificadoCount} Justif.
                  </span>
                )}
                {retardoCount > 0 && (
                  <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded flex items-center gap-1">
                    <ClockIcon size={10} className="text-slate-500" /> {retardoCount} Ret.
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllPresent}
                disabled={isSaving || students.length === 0}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-black uppercase tracking-wider transition-all border border-slate-200 flex items-center gap-1 shadow-xs"
                title="Guarda a todos los alumnos como Asistió en esta fecha (100% Asistencia)"
              >
                <Check size={11} className="text-slate-700" /> Confirmar Todos Presentes
              </button>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  placeholder="Filtrar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold w-full md:w-56 outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="px-6 py-3 w-12 text-center">RT</th>
                    <th className="px-6 py-3">Nombre Alumno</th>
                    <th className="px-6 py-3 text-center">Registro de Asistencia</th>
                    <th className="px-6 py-3 hidden md:table-cell text-right pr-12">CURP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.map((student, index) => {
                    const att = attendance[student.id]?.status || 'Asistió';
                    const justReason = attendance[student.id]?.justificationReason;
                    
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-3 text-center text-[9px] font-black text-slate-300 tabular-nums">
                          {index + 1}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            {student.photoUrl ? (
                              <img 
                                src={student.photoUrl} 
                                alt="Avatar" 
                                className="w-8 h-8 rounded object-cover border border-slate-200 shadow-sm shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-black text-[10px] uppercase shadow-sm shrink-0">
                                {student.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-slate-900 tracking-tight uppercase leading-none">
                                {student.name} {[student.lastName, student.motherLastName].filter(Boolean).join(' ')}
                              </p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Matrícula: {student.id.substring(0, 8)}</p>
                              {att === 'Justificado' && (
                                <p className="text-[8px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded mt-1 inline-flex items-center gap-1">
                                  <ShieldCheck size={9} className="text-slate-500" /> Justificación: {justReason || 'Autorizada'}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col items-center justify-center gap-1">
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
                                title="Marca Falta (suma automáticamente a inasistencias en calificaciones)"
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
                              <button
                                onClick={() => openJustificationModal(student, justReason)}
                                className={cn(
                                  "px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1 border border-transparent",
                                  att === 'Justificado' 
                                    ? "bg-sky-600 text-white shadow-sm" 
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                                title={justReason ? `Motivo: ${justReason}` : "Marcar como Justificado (cuenta como asistencia)"}
                              >
                                <ShieldCheck size={10} /> <span className="hidden sm:inline">Justificado</span>
                              </button>
                            </div>
                            {att === 'Justificado' && (
                              <button
                                onClick={() => openJustificationModal(student, justReason)}
                                className="text-[8px] font-bold text-slate-500 hover:text-slate-800 underline uppercase tracking-tight"
                              >
                                Editar motivo
                              </button>
                            )}
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
      ) : activeTab === 'horario' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Mi Horario Semanal</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Itinerario de clases asignadas en el ciclo activo
              </p>
            </div>

            {/* Level Scheme Selector */}
            {settings?.academicLevels && settings.academicLevels.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Esquema:</span>
                <div className="flex gap-1">
                  {settings.academicLevels.map(level => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevelSchema(level)}
                      className={cn(
                        "px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all",
                        selectedLevelSchema === level
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left min-w-[700px] table-fixed">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="w-[120px] px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Periodo / Hora</th>
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(dayName => (
                    <th key={dayName} className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">
                      {dayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePeriods.map((period, pIdx) => {
                  if (period.isBreak) {
                    return (
                      <tr key={`break-${pIdx}`} className="bg-slate-50 text-center border-y border-slate-100">
                        <td className="px-4 py-2 text-[9px] font-black uppercase text-slate-400">{period.time}</td>
                        <td colSpan={5} className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 italic text-center">
                          ☕ {period.label} ☕
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={pIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/10">
                      <td className="px-4 py-4 font-sans border-r border-slate-50">
                        <p className="text-[10px] font-black text-slate-900 leading-none">{period.label}</p>
                        <p className="text-[8px] text-slate-400 font-bold mt-1">{period.time}</p>
                      </td>
                      {[1, 2, 3, 4, 5].map(dayId => {
                        const slot = getCellSlot(dayId, pIdx);
                        return (
                          <td key={dayId} className="px-2 py-2 border-r border-slate-50 last:border-0 h-20 text-center align-middle">
                            {slot ? (
                              <div className="p-2 bg-indigo-50/50 border border-indigo-100 text-indigo-900 rounded-xl h-full flex flex-col justify-center items-center animate-in fade-in duration-300">
                                <span className="text-[9px] font-black uppercase tracking-tight text-indigo-700">{slot.subjectName}</span>
                                <span className="text-[8px] font-bold text-slate-500 mt-1">
                                  {slot.level} {slot.grade}°{slot.group}
                                </span>
                                {slot.classroom && (
                                  <span className="text-[7px] text-slate-400 font-bold uppercase mt-1.5 bg-white border border-slate-100 px-1.5 py-0.5 rounded shadow-sm">
                                    📍 {slot.classroom}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[8px] text-slate-300 uppercase tracking-widest font-black">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'credencial' ? (
        <div className="space-y-6">
          {/* Admin Teacher Selector */}
          {userProfile?.role !== 'Docente' && teachers.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Gestión de Credenciales Docentes</h2>
                <p className="text-[11px] text-slate-400 font-medium">Selecciona el docente para consultar, completar datos o emitir su credencial.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Profesor:</span>
                <select
                  value={selectedTeacherId || credentialTeacher?.id}
                  onChange={(e) => {
                    setSelectedTeacherId(e.target.value);
                    setIsEditingCredential(false);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-600 shadow-sm"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.employeeNumber ? `(${t.employeeNumber})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* If Missing Data OR In Edit Mode: Show Missing Data & Photo Request Form */}
          {(hasMissingCredentialData || isEditingCredential) ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
              {/* Header and status alert */}
              <div>
                <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <IdCard size={22} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                        {hasMissingCredentialData ? 'Completa los Datos de la Credencial' : 'Editar Datos de Credencial'}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        {hasMissingCredentialData 
                          ? 'Se requieren los siguientes datos y fotografía para emitir tu credencial oficial (PDF y Virtual).' 
                          : 'Actualiza tu fotografía o información que aparecerá en la credencial física y virtual.'}
                      </p>
                    </div>
                  </div>

                  {!hasMissingCredentialData && (
                    <button
                      onClick={() => setIsEditingCredential(false)}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Cancelar y Ver Credencial
                    </button>
                  )}
                </div>

                {/* Status indicators */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                    credFormData.photoUrl ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    {credFormData.photoUrl ? <Check size={12} /> : <AlertCircle size={12} />}
                    {credFormData.photoUrl ? 'Fotografía Lista' : 'Falta Fotografía'}
                  </span>

                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                    credFormData.employeeNumber ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    {credFormData.employeeNumber ? <Check size={12} /> : <AlertCircle size={12} />}
                    {credFormData.employeeNumber ? `No. Empleado: ${credFormData.employeeNumber}` : 'Falta No. Empleado'}
                  </span>

                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                    credFormData.assignedLevel ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    {credFormData.assignedLevel ? <Check size={12} /> : <AlertCircle size={12} />}
                    {credFormData.assignedLevel ? `Nivel: ${credFormData.assignedLevel}` : 'Falta Nivel'}
                  </span>

                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                    credFormData.name ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    {credFormData.name ? <Check size={12} /> : <AlertCircle size={12} />}
                    {credFormData.name ? 'Nombre Completo Listo' : 'Falta Nombre'}
                  </span>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-2">
                {/* Photo Column */}
                <div className="md:col-span-4 flex flex-col items-center justify-start p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Fotografía del Docente *
                  </span>

                  <div className="relative group w-36 h-44 bg-white rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all">
                    {credFormData.photoUrl ? (
                      <img 
                        src={credFormData.photoUrl} 
                        alt="Foto Docente" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-slate-400 group-hover:text-blue-500 text-center">
                        <Camera size={28} className="mb-2 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Subir Foto</span>
                        <span className="text-[8px] text-slate-400 mt-1">JPG o PNG</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all text-white text-[9px] font-black uppercase tracking-wider gap-1">
                      <Upload size={18} />
                      {credFormData.photoUrl ? 'Cambiar Foto' : 'Seleccionar'}
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingPhoto}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                    />
                  </div>

                  {uploadingPhoto && (
                    <div className="flex items-center gap-2 text-blue-600 text-xs font-bold">
                      <div className="w-3.5 h-3.5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                      Procesando fotografía...
                    </div>
                  )}

                  {credFormData.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setCredFormData(prev => ({ ...prev, photoUrl: '' }))}
                      className="text-[10px] font-black uppercase tracking-wider text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={12} /> Quitar Foto
                    </button>
                  )}

                  {/* Manual URL input fallback */}
                  <div className="w-full pt-2 border-t border-slate-200">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      O pegar URL de imagen:
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={credFormData.photoUrl.startsWith('data:') ? '' : credFormData.photoUrl}
                      onChange={(e) => setCredFormData(prev => ({ ...prev, photoUrl: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Details Column */}
                <div className="md:col-span-8 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                      Nombre Completo del Docente *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Lic. Juan Carlos Pérez López"
                      value={credFormData.name}
                      onChange={(e) => setCredFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  {/* Employee Number */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                      Número de Empleado / Clave Institucional *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: EMP-042, DOC-105..."
                      value={credFormData.employeeNumber}
                      onChange={(e) => setCredFormData(prev => ({ ...prev, employeeNumber: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Este número se reflejará en la credencial impresa y virtual.</p>
                  </div>

                  {/* Educational Level */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                      Nivel en el que es Docente *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={['Preescolar', 'Primaria', 'Secundaria', 'Preparatoria', 'Bachillerato', 'General'].includes(credFormData.assignedLevel) ? credFormData.assignedLevel : (credFormData.assignedLevel ? 'custom' : '')}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            setCredFormData(prev => ({ ...prev, assignedLevel: e.target.value }));
                          }
                        }}
                        className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      >
                        <option value="">Selecciona Nivel...</option>
                        {settings?.academicLevels?.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                        {!settings?.academicLevels?.length && (
                          <>
                            <option value="Preescolar">Preescolar</option>
                            <option value="Primaria">Primaria</option>
                            <option value="Secundaria">Secundaria</option>
                            <option value="Preparatoria">Preparatoria</option>
                            <option value="Bachillerato">Bachillerato</option>
                            <option value="General">Docente General</option>
                          </>
                        )}
                        <option value="custom">Otro (Escribir manualmente)</option>
                      </select>

                      <input
                        type="text"
                        placeholder="O escribe el nivel..."
                        value={credFormData.assignedLevel}
                        onChange={(e) => setCredFormData(prev => ({ ...prev, assignedLevel: e.target.value }))}
                        className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="pt-4 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={isSavingCredential}
                      onClick={handleSaveCredential}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSavingCredential ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      <span>{isSavingCredential ? 'Guardando...' : 'Guardar Datos y Activar Credencial'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Complete Credential View: Interactive Preview, Virtual Link & PDF Download */
            <div className="space-y-6">
              {/* Action Toolbar */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        Credencial Oficial Activa
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">
                        Vigente
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Credencial digital y física lista para descarga e inspección en línea.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setIsEditingCredential(true)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    <Edit3 size={13} /> Editar Datos / Foto
                  </button>

                  <button
                    onClick={handleCopyVirtualLink}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copiedLink ? '¡Enlace Copiado!' : 'Copiar Link'}
                  </button>

                  <button
                    onClick={handleDownloadTeacherPdf}
                    disabled={isDownloadingPdf}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isDownloadingPdf ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    <span>{isDownloadingPdf ? 'Generando...' : 'Descargar PDF'}</span>
                  </button>
                </div>
              </div>

              {/* Main Grid: Visual Cards & Virtual Info */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Column 1: Physical PVC Card Preview (Front and Back) */}
                <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        Vista Previa de Credencial (Formato Tarjeta PVC)
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        Impresión estándar CR-80 de alta definición
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                    {/* FRONT CARD PREVIEW */}
                    <div className="w-[190px] h-[300px] bg-white rounded-2xl shadow-xl border border-slate-300 relative overflow-hidden flex flex-col items-center p-3 text-center shrink-0">
                      {/* Top dark banner */}
                      <div className="absolute top-0 left-0 right-0 h-20 bg-slate-900 rounded-b-2xl" />
                      <div className="absolute top-[76px] left-4 right-4 h-1 bg-blue-500 rounded-full" />
                      
                      {/* Header in banner */}
                      <div className="relative z-10 w-full mb-2 flex flex-col items-center">
                        {settings?.logoUrl ? (
                          <img src={settings.logoUrl} alt="Logo" className="h-7 w-auto object-contain max-w-[100px] mb-0.5" />
                        ) : (
                          <span className="text-[9px] font-black uppercase text-white tracking-wide truncate max-w-[170px]">
                            {settings?.schoolName || 'Institución Educativa'}
                          </span>
                        )}
                        <span className="text-[7px] font-black text-blue-300 uppercase tracking-widest">
                          Credencial de Docente
                        </span>
                      </div>

                      {/* Photo */}
                      <div className="relative z-10 w-20 h-24 bg-slate-100 rounded-xl border-2 border-white shadow-md overflow-hidden mb-2">
                        {credFormData.photoUrl ? (
                          <img src={credFormData.photoUrl} alt="Docente" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <User size={32} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="relative z-10 w-full flex flex-col items-center mt-1">
                        <span className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight line-clamp-2">
                          {credFormData.name || credentialTeacher?.name}
                        </span>

                        <div className="mt-1.5 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-md">
                          <span className="text-[8px] font-black text-blue-700 uppercase tracking-wider">
                            Docente • {credFormData.assignedLevel || 'General'}
                          </span>
                        </div>

                        <div className="mt-2 text-center">
                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">No. Empleado</span>
                          <span className="text-xs font-black font-mono text-slate-900">
                            {credFormData.employeeNumber || 'S/N'}
                          </span>
                        </div>

                        <span className="mt-auto text-[7px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Personal Activo
                        </span>
                      </div>
                    </div>

                    {/* BACK CARD PREVIEW */}
                    <div className="w-[190px] h-[300px] bg-slate-50 rounded-2xl shadow-xl border border-slate-300 p-4 flex flex-col items-center justify-between text-center shrink-0">
                      <div className="w-full border-b border-slate-200 pb-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-800">
                          Validación Digital
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <QRCodeSVG value={virtualCredentialUrl} size={90} />
                      </div>

                      <p className="text-[6.5px] text-slate-500 leading-relaxed px-1">
                        Esta credencial oficial acredita al portador como docente activo. Escanee el código QR para validar su vigencia en línea.
                      </p>

                      <div className="w-full space-y-3">
                        <div className="border-t border-slate-900 pt-0.5">
                          <span className="text-[6px] font-bold text-slate-700 uppercase tracking-wider block">Firma del Docente</span>
                        </div>
                        <div className="border-t border-slate-900 pt-0.5">
                          <span className="text-[6px] font-bold text-slate-700 uppercase tracking-wider block">Dirección General</span>
                        </div>
                      </div>

                      <span className="text-[6.5px] font-bold text-slate-400 uppercase truncate max-w-[170px]">
                        {settings?.schoolName || 'Institución Educativa'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Virtual Credential Online Link & QR Code */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Virtual Credential Link Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <FileBadge size={18} className="text-slate-700" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                          Credencial Virtual Oficial
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9px] font-black uppercase tracking-wider">
                        En Línea
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Esta credencial cuenta con una versión digital pública para verificación de autenticidad en tiempo real. Cualquier persona o autoridad escolar puede consultar la vigencia desde cualquier dispositivo o navegador.
                    </p>

                    {/* URL box */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enlace Oficial de Verificación:</span>
                      <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <input
                          readOnly
                          value={virtualCredentialUrl}
                          className="bg-transparent text-xs font-mono text-slate-800 w-full outline-none select-all truncate font-medium"
                        />
                        <button
                          onClick={handleCopyVirtualLink}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all flex items-center gap-1 shadow-xs"
                        >
                          {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <a
                        href={virtualCredentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-slate-200 shadow-xs"
                      >
                        <ExternalLink size={13} /> Abrir Credencial Virtual
                      </a>

                      <button
                        onClick={handleShareVirtualLink}
                        className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-slate-200 shadow-xs"
                        title="Compartir"
                      >
                        <Share2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* QR Code Validation Card */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-3">
                    <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <QrCode size={14} className="text-slate-700" /> Código QR de Verificación
                      </span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase border border-emerald-200">
                        Vigente
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
                      <QRCodeSVG 
                        value={virtualCredentialUrl} 
                        size={140} 
                        level="H" 
                        includeMargin={false}
                      />
                    </div>

                    <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                      Escanee este código QR con la cámara de cualquier teléfono para abrir y certificar la credencial virtual oficial.
                    </p>

                    <div className="text-[9px] text-slate-400 font-mono">
                      FOLIO: CMF-DOC-{credentialTeacher?.id?.substring(0, 8).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Modal Justificación de Asistencia */}
      <AnimatePresence>
        {justificationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-600 text-white rounded-lg shadow-sm">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-sky-950 uppercase tracking-tight">Justificar Asistencia</h3>
                    <p className="text-[10px] text-sky-700 font-bold uppercase tracking-wider">
                      Cuenta como asistencia en el cálculo real
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setJustificationModal(null)}
                  className="p-1.5 text-sky-400 hover:text-sky-700 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                  {justificationModal.student.photoUrl ? (
                    <img
                      src={justificationModal.student.photoUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center font-black text-xs text-slate-600">
                      {justificationModal.student.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 uppercase truncate">
                      {justificationModal.student.name} {[justificationModal.student.lastName, justificationModal.student.motherLastName].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Fecha: {selectedDate}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Motivo o Justificación
                  </label>
                  <textarea
                    rows={3}
                    autoFocus
                    value={justificationReason}
                    onChange={(e) => setJustificationReason(e.target.value)}
                    placeholder="Ej. Cita médica con receta, permiso familiar por viaje, reposo por salud..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all resize-none"
                  />
                </div>

                {/* Quick chip presets */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Opciones rápidas:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Cita médica / Receta',
                      'Enfermedad / Reposo',
                      'Permiso familiar',
                      'Trámite oficial',
                      'Causa de fuerza mayor'
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setJustificationReason(chip)}
                        className="text-[9px] font-bold px-2.5 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200 rounded-lg text-slate-600 transition-all active:scale-95 cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setJustificationModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveJustification}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Check size={14} /> Guardar Justificación
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
