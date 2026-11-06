import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp, 
  writeBatch, 
  deleteField,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  AppSettings, 
  Student, 
  StudentGrade, 
  Attendance, 
  BimestreLock, 
  Subject, 
  AppUser, 
  Bimestre 
} from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  getLevelEvaluationConfig, 
  getPeriodForDate, 
  isSubjectLockLevel,
  isAttendanceTrackingSubject
} from '../lib/evaluationUtils';
import { cn, studentMatchesSearch } from '../lib/utils';
import { format, subDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { 
  ShieldCheck, 
  Calendar, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Search, 
  Filter, 
  Sparkles, 
  Lock, 
  Unlock, 
  Save, 
  Download, 
  RefreshCw, 
  GraduationCap, 
  Check, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  UserCheck, 
  UserX,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

// Weekend & School Day Helper Functions
export const isWeekend = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
};

export const getNearestSchoolDay = (date: Date = new Date()): string => {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) {
    d.setDate(d.getDate() - 1);
  } else if (day === 0) {
    d.setDate(d.getDate() - 2);
  }
  return format(d, 'yyyy-MM-dd');
};

export const getNextSchoolDay = (dateStr: string): string => {
  let d = new Date(dateStr + 'T12:00:00');
  do {
    d = addDays(d, 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return format(d, 'yyyy-MM-dd');
};

export const getPrevSchoolDay = (dateStr: string): string => {
  let d = new Date(dateStr + 'T12:00:00');
  do {
    d = subDays(d, 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return format(d, 'yyyy-MM-dd');
};

interface PrefectPortalProps {
  appSettings?: AppSettings | null;
}

export default function PrefectPortal({ appSettings: initialSettings }: PrefectPortalProps = {}) {
  const { userProfile } = usePermissions();

  // Settings & Cycles
  const [settings, setSettings] = useState<AppSettings | null>(initialSettings || null);
  const [currentCycleId, setCurrentCycleId] = useState<string>('');

  // Collections
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [cycleAbsences, setCycleAbsences] = useState<Attendance[]>([]);
  const [gradesMap, setGradesMap] = useState<Record<string, StudentGrade>>({});
  const [classLocks, setClassLocks] = useState<BimestreLock[]>([]);

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'attendance' | 'development' | 'summary'>('attendance');

  // Filters State
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('Todos');
  const [selectedGroup, setSelectedGroup] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Attendance Date (defaults to nearest school day, avoiding weekends)
  const [selectedDate, setSelectedDate] = useState<string>(() => getNearestSchoolDay(new Date()));

  // Evaluation Period
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const hasManuallySelectedPeriodRef = useRef(false);

  // Auto-save & Status Feedback
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Active Justification Modal / Prompt
  const [justifyingStudent, setJustifyingStudent] = useState<{ student: Student; status: 'Justificado' | 'Retardo' } | null>(null);
  const [justificationReason, setJustificationReason] = useState<string>('');
  const [logoLoadError, setLogoLoadError] = useState(false);

  // Load general settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        setSettings(data);
        if (data.currentCycleId) {
          setCurrentCycleId(data.currentCycleId);
        }
      }
    });
    return unsub;
  }, []);

  // Determine available levels for the logged user
  const availableLevels = useMemo(() => {
    const allConfigured = settings?.academicLevels || ['Secundaria', 'Preparatoria'];
    
    // If the user is a Prefecto, prioritize their assigned levels
    if (userProfile?.role === 'Prefecto') {
      const assigned = userProfile.assignedLevels && userProfile.assignedLevels.length > 0 
        ? userProfile.assignedLevels 
        : (userProfile.restrictedLevels && userProfile.restrictedLevels.length > 0 
            ? userProfile.restrictedLevels 
            : (userProfile.assignedLevel ? [userProfile.assignedLevel] : []));
      
      if (assigned.length > 0) {
        return allConfigured.filter(lvl => assigned.includes(lvl));
      }
      // Default preference for Prefectura: Secundaria y Preparatoria
      const prefDefault = allConfigured.filter(lvl => /secundaria|preparatoria|bachillerato/i.test(lvl));
      return prefDefault.length > 0 ? prefDefault : allConfigured;
    }

    // Admins / Superadmins / Control Escolar see all levels
    return allConfigured;
  }, [settings?.academicLevels, userProfile]);

  // Set default level when availableLevels are resolved
  useEffect(() => {
    if (availableLevels.length > 0) {
      if (!selectedLevel || !availableLevels.includes(selectedLevel)) {
        setSelectedLevel(availableLevels[0]);
      }
    }
  }, [availableLevels, selectedLevel]);

  // Evaluation config for the selected level
  const evalConfig = useMemo(() => {
    return getLevelEvaluationConfig(settings, selectedLevel);
  }, [settings, selectedLevel]);

  // Resolve logo for currently selected level (with fallback to school general logo)
  const currentLevelLogo = useMemo(() => {
    const cleanLevel = selectedLevel?.trim();
    if (cleanLevel && settings?.levelLogos) {
      if (settings.levelLogos[cleanLevel] && settings.levelLogos[cleanLevel].trim().length > 0) {
        return settings.levelLogos[cleanLevel].trim();
      }
      const matchedKey = Object.keys(settings.levelLogos).find(
        k => k.trim().toLowerCase() === cleanLevel.toLowerCase()
      );
      if (matchedKey && settings.levelLogos[matchedKey] && settings.levelLogos[matchedKey].trim().length > 0) {
        return settings.levelLogos[matchedKey].trim();
      }
    }
    return settings?.logoUrl?.trim() || null;
  }, [selectedLevel, settings]);

  useEffect(() => {
    setLogoLoadError(false);
  }, [currentLevelLogo]);

  // Determine period corresponding to the selected date
  const dateTargetPeriod = useMemo(() => {
    return getPeriodForDate(selectedDate, evalConfig.periodCount);
  }, [selectedDate, evalConfig.periodCount]);

  // Load students
  useEffect(() => {
    const q = collection(db, 'students');
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Student));
      setStudents(list);
    });
    return unsub;
  }, []);

  // Load subjects for the selected level
  useEffect(() => {
    if (!selectedLevel) {
      setSubjects([]);
      return;
    }
    const q = query(
      collection(db, 'subjects'),
      where('educationalLevel', '==', selectedLevel)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Subject));
      setSubjects(list);
    });
    return unsub;
  }, [selectedLevel]);

  // Identify Desarrollo Personal subjects for the selected level
  const devSubjects = useMemo(() => {
    const list = subjects.filter(s => 
      s.category === 'Desarrollo Personal' || s.category === 'Aspectos Formativos'
    );
    return list;
  }, [subjects]);

  // Available grades and groups for the selected level
  const availableGrades = useMemo(() => {
    const levelStudents = students.filter(s => s.level === selectedLevel);
    const setGrades = new Set<string>();
    levelStudents.forEach(s => {
      if (s.grade) setGrades.add(s.grade);
    });
    const fromSettings = settings?.academicGrades || [];
    fromSettings.forEach(g => {
      if (levelStudents.some(s => s.grade === g)) setGrades.add(g);
    });
    return Array.from(setGrades).sort();
  }, [students, selectedLevel, settings?.academicGrades]);

  const availableGroups = useMemo(() => {
    const levelStudents = students.filter(s => s.level === selectedLevel && (selectedGrade === 'Todos' || s.grade === selectedGrade));
    const setGroups = new Set<string>();
    levelStudents.forEach(s => {
      if (s.group) setGroups.add(s.group);
    });
    const fromSettings = settings?.academicGroups || [];
    fromSettings.forEach(g => {
      if (levelStudents.some(s => s.group === g)) setGroups.add(g);
    });
    return Array.from(setGroups).sort();
  }, [students, selectedLevel, selectedGrade, settings?.academicGroups]);

  // Load bimestre locks for current cycle and level
  useEffect(() => {
    if (!currentCycleId || !selectedLevel) {
      setClassLocks([]);
      return;
    }
    const q = query(
      collection(db, 'bimestreLocks'),
      where('cycleId', '==', currentCycleId),
      where('level', '==', selectedLevel)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as BimestreLock));
      setClassLocks(list);
    });
    return unsub;
  }, [currentCycleId, selectedLevel]);

  // Evaluate locked periods
  const lockedPeriodsMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    const isSubjectLock = isSubjectLockLevel(selectedLevel);

    Array.from({ length: evalConfig.periodCount }, (_, i) => i + 1).forEach((period) => {
      // 1. Global period lock for this level/grade/group
      const matchingLocks = classLocks.filter(l => Number(l.bimestre) === Number(period) && l.locked);
      
      const hasGlobalLock = matchingLocks.some(l => 
        !l.subjectId && 
        (!selectedGrade || selectedGrade === 'Todos' || l.grade === selectedGrade) &&
        (!selectedGroup || selectedGroup === 'Todos' || l.group === selectedGroup)
      );

      if (hasGlobalLock) {
        map[period] = true;
        return;
      }

      // 2. If subject-level locking applies (Secundaria / Preparatoria):
      // Check if all Desarrollo Personal subjects are locked
      if (isSubjectLock && devSubjects.length > 0) {
        const allDevLocked = devSubjects.every(devSubj => {
          return matchingLocks.some(l => 
            (l.subjectId === devSubj.id || l.subjectName?.toLowerCase().trim() === devSubj.name.toLowerCase().trim()) &&
            (!selectedGrade || selectedGrade === 'Todos' || l.grade === selectedGrade) &&
            (!selectedGroup || selectedGroup === 'Todos' || l.group === selectedGroup)
          );
        });
        map[period] = allDevLocked;
        return;
      }

      map[period] = false;
    });

    return map;
  }, [classLocks, evalConfig.periodCount, selectedLevel, selectedGrade, selectedGroup, devSubjects]);

  // Effective period for registering attendance:
  // If the standard period for the date is closed by prefectura, automatically register in the first available/open period!
  const effectiveAttendancePeriod = useMemo(() => {
    // 1. If dateTargetPeriod is open, use it directly
    if (!lockedPeriodsMap[dateTargetPeriod]) {
      return dateTargetPeriod;
    }

    // 2. If dateTargetPeriod is closed, find the first available (unlocked) period >= dateTargetPeriod
    const allPeriods = Array.from({ length: evalConfig.periodCount }, (_, i) => i + 1);
    const nextOpen = allPeriods.find(p => p >= dateTargetPeriod && !lockedPeriodsMap[p]);
    if (nextOpen) return nextOpen;

    // 3. Otherwise find any open period
    const anyOpen = allPeriods.find(p => !lockedPeriodsMap[p]);
    if (anyOpen) return anyOpen;

    // 4. Fallback if all periods are closed
    return dateTargetPeriod;
  }, [dateTargetPeriod, lockedPeriodsMap, evalConfig.periodCount]);

  // Auto-advance to the default period (first open period or effectiveAttendancePeriod)
  useEffect(() => {
    if (hasManuallySelectedPeriodRef.current) return;
    
    // Check if the effective period corresponding to today/selected date is unlocked
    if (!lockedPeriodsMap[effectiveAttendancePeriod]) {
      setSelectedPeriod(effectiveAttendancePeriod);
      return;
    }

    // Otherwise find the first unlocked period
    const firstOpen = Array.from({ length: evalConfig.periodCount }, (_, i) => i + 1)
      .find(p => !lockedPeriodsMap[p]);

    if (firstOpen) {
      setSelectedPeriod(firstOpen);
    } else {
      // If all periods are locked, stay on effectiveAttendancePeriod
      setSelectedPeriod(effectiveAttendancePeriod);
    }
  }, [effectiveAttendancePeriod, lockedPeriodsMap, evalConfig.periodCount]);

  const isCurrentPeriodLocked = useMemo(() => {
    return Boolean(lockedPeriodsMap[selectedPeriod]);
  }, [lockedPeriodsMap, selectedPeriod]);

  // Load school attendance for selected date
  useEffect(() => {
    if (!currentCycleId) return;

    // School attendance: where cycleId == currentCycleId and date == selectedDate
    const q = query(
      collection(db, 'attendance'),
      where('date', '==', selectedDate),
      where('cycleId', '==', currentCycleId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as Attendance))
        // School attendance records have no subjectId (independent of subject)
        .filter(att => !att.subjectId);
      setAttendanceList(list);
    });

    return unsub;
  }, [selectedDate, currentCycleId]);

  // Load all cycle absences for the students in view to calculate period absence count
  useEffect(() => {
    if (!currentCycleId) return;

    const q = query(
      collection(db, 'attendance'),
      where('cycleId', '==', currentCycleId),
      where('status', '==', 'Falta')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as Attendance))
        .filter(att => !att.subjectId);
      setCycleAbsences(list);
    });

    return unsub;
  }, [currentCycleId]);

  // Load grades for the selected period
  useEffect(() => {
    if (!currentCycleId || !selectedPeriod) return;

    const q = query(
      collection(db, 'grades'),
      where('bimestre', '==', selectedPeriod),
      where('cycleId', '==', currentCycleId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, StudentGrade> = {};
      snap.docs.forEach(docSnap => {
        const raw = docSnap.data();
        map[raw.studentId] = {
          id: docSnap.id,
          ...raw,
          subjects: raw.subjects || {},
          conduct: (raw.conduct === 0 || raw.conduct === '0') ? '' : (raw.conduct ?? raw.subjects?.['CONDUCTA'] ?? raw.subjects?.['Conducta'] ?? ''),
          uniform: (raw.uniform === 0 || raw.uniform === '0') ? '' : (raw.uniform ?? raw.subjects?.['UNIFORME'] ?? raw.subjects?.['Uniforme'] ?? '')
        } as StudentGrade;
      });
      setGradesMap(map);
    });

    return unsub;
  }, [selectedPeriod, currentCycleId]);

  // Filtered students in current view
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => {
        if (s.level !== selectedLevel) return false;
        if (selectedGrade !== 'Todos' && s.grade !== selectedGrade) return false;
        if (selectedGroup !== 'Todos' && s.group !== selectedGroup) return false;
        if (searchTerm && !studentMatchesSearch([s.name, s.lastName, s.motherLastName, s.matricula, s.curp], searchTerm)) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by Grade, Group, LastName, MotherLastName, Name
        if (a.grade !== b.grade) return (a.grade || '').localeCompare(b.grade || '');
        if (a.group !== b.group) return (a.group || '').localeCompare(b.group || '');
        const nameA = `${a.lastName || ''} ${a.motherLastName || ''} ${a.name || ''}`.trim();
        const nameB = `${b.lastName || ''} ${b.motherLastName || ''} ${b.name || ''}`.trim();
        return nameA.localeCompare(nameB);
      });
  }, [students, selectedLevel, selectedGrade, selectedGroup, searchTerm]);

  // Attendance metrics for today / selectedDate
  const attendanceStats = useMemo(() => {
    const total = filteredStudents.length;
    let present = 0;
    let absent = 0;
    let tardy = 0;
    let excused = 0;

    filteredStudents.forEach(st => {
      const att = attendanceList.find(a => a.studentId === st.id);
      const status = att?.status || 'Asistió';
      if (status === 'Asistió') present++;
      else if (status === 'Falta') absent++;
      else if (status === 'Retardo') tardy++;
      else if (status === 'Justificado') excused++;
    });

    const registered = present + absent + tardy + excused;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, tardy, excused, registered, percentage };
  }, [filteredStudents, attendanceList]);

  // Helper to calculate student cumulative school absences in a period (excluding weekends)
  const getStudentAbsenceCountForPeriod = useCallback((studentId: string, period: number): number => {
    return cycleAbsences.filter(att => {
      if (att.studentId !== studentId) return false;
      if (isWeekend(att.date)) return false; // Sábados y domingos no cuentan
      const attPeriod = att.period || getPeriodForDate(att.date, evalConfig.periodCount);
      return attPeriod === period;
    }).length;
  }, [cycleAbsences, evalConfig.periodCount]);

  // Set single attendance record
  const handleSetAttendance = async (student: Student, newStatus: 'Asistió' | 'Falta' | 'Retardo' | 'Justificado', reason?: string) => {
    if (isWeekend(selectedDate)) {
      toast.error("No se puede registrar asistencia en fines de semana (días inhábiles).");
      return;
    }
    if (lockedPeriodsMap[effectiveAttendancePeriod]) {
      toast.warn(`El Periodo ${effectiveAttendancePeriod} se encuentra cerrado.`);
      return;
    }
    if (!currentCycleId) return;

    const attId = `${student.id}_${selectedDate}`;
    const targetPeriod = effectiveAttendancePeriod;

    try {
      setIsAutoSaving(true);

      const attendanceDoc: Record<string, any> = {
        studentId: student.id,
        cycleId: currentCycleId,
        date: selectedDate,
        status: newStatus,
        period: targetPeriod,
        justificationReason: reason || null,
        updatedAt: serverTimestamp(),
        createdBy: userProfile?.id || 'prefectura'
      };

      // 1. Save to attendance collection (al plantel / sin subjectId)
      await setDoc(doc(db, 'attendance', attId), attendanceDoc);

      // 2. Mirror into student_attendance_records for Kiosk / Checador Alumnos consistency
      const kioskRecordRef = doc(db, 'student_attendance_records', attId);
      await setDoc(kioskRecordRef, {
        studentId: student.id,
        studentName: `${student.lastName} ${student.motherLastName || ''} ${student.name}`.trim(),
        level: student.level,
        grade: student.grade,
        group: student.group || '',
        date: selectedDate,
        status: newStatus === 'Falta' ? 'Falta' : 'Asistió',
        checkIn: newStatus !== 'Falta' ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 3. Recalculate absence count in grades collection for targetPeriod (excluding weekends)
      const otherAbsences = cycleAbsences.filter(a => {
        if (a.studentId === student.id && a.date === selectedDate) return false;
        if (isWeekend(a.date)) return false;
        return true;
      });
      const newAbsenceCount = otherAbsences.filter(a => {
        if (a.studentId !== student.id) return false;
        const p = a.period || getPeriodForDate(a.date, evalConfig.periodCount);
        return p === targetPeriod;
      }).length + (newStatus === 'Falta' ? 1 : 0);

      const gradeId = `${student.id}_B${targetPeriod}_${currentCycleId}`;
      const updateGradeData: Record<string, any> = {
        studentId: student.id,
        cycleId: currentCycleId,
        bimestre: targetPeriod,
        attendance: newAbsenceCount,
        updatedAt: serverTimestamp(),
        createdBy: userProfile?.id || 'prefectura'
      };

      // If an attendance tracker subject exists for this level, update it as well
      const trackerSubj = subjects.find(isAttendanceTrackingSubject);
      if (trackerSubj) {
        updateGradeData.subjects = { [trackerSubj.name]: newAbsenceCount };
      }

      await setDoc(doc(db, 'grades', gradeId), updateGradeData, { merge: true });

      setLastSavedTime(new Date());
    } catch (err) {
      console.error("Error setting school attendance:", err);
      toast.error("Error al registrar asistencia");
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Mark all students as 'Asistió'
  const handleMarkAllPresent = async () => {
    if (isWeekend(selectedDate)) {
      toast.error("No se puede registrar asistencia en fines de semana (días inhábiles).");
      return;
    }
    if (lockedPeriodsMap[effectiveAttendancePeriod]) {
      toast.warn(`El Periodo ${effectiveAttendancePeriod} se encuentra cerrado.`);
      return;
    }
    if (!currentCycleId || filteredStudents.length === 0) return;

    try {
      setIsAutoSaving(true);
      const batch = writeBatch(db);
      const targetPeriod = effectiveAttendancePeriod;

      filteredStudents.forEach(student => {
        const attId = `${student.id}_${selectedDate}`;
        const ref = doc(db, 'attendance', attId);
        batch.set(ref, {
          studentId: student.id,
          cycleId: currentCycleId,
          date: selectedDate,
          status: 'Asistió',
          period: targetPeriod,
          updatedAt: serverTimestamp(),
          createdBy: userProfile?.id || 'prefectura'
        });

        // Also update student_attendance_records
        const kioskRef = doc(db, 'student_attendance_records', attId);
        batch.set(kioskRef, {
          studentId: student.id,
          studentName: `${student.lastName} ${student.motherLastName || ''} ${student.name}`.trim(),
          level: student.level,
          grade: student.grade,
          group: student.group || '',
          date: selectedDate,
          status: 'Asistió',
          checkIn: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      toast.success(`Se marcaron ${filteredStudents.length} alumnos como Asistió`);
      setLastSavedTime(new Date());
    } catch (err) {
      console.error("Error marking all present:", err);
      toast.error("Error al registrar asistencia masiva");
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Save single Desarrollo Personal grade (Conducta / Uniforme)
  const handleSaveDevGrade = async (studentId: string, aspect: 'conduct' | 'uniform' | string, rawValue: string | number) => {
    if (isCurrentPeriodLocked) {
      toast.warn("El periodo seleccionado está bloqueado. Modo solo lectura.");
      return;
    }
    if (!currentCycleId) return;

    const gradeId = `${studentId}_B${selectedPeriod}_${currentCycleId}`;
    const cleanStr = String(rawValue).trim();

    try {
      setIsAutoSaving(true);

      let valToSave: any;
      if (cleanStr === '' || cleanStr === '0' || cleanStr === '-') {
        valToSave = deleteField();
      } else {
        const num = parseFloat(cleanStr);
        valToSave = isNaN(num) ? deleteField() : num;
      }

      const updateData: Record<string, any> = {
        studentId,
        cycleId: currentCycleId,
        bimestre: selectedPeriod,
        updatedAt: serverTimestamp(),
        createdBy: userProfile?.id || 'prefectura'
      };

      if (aspect === 'conduct') {
        updateData.conduct = valToSave;
        updateData.subjects = {
          CONDUCTA: valToSave,
          Conducta: valToSave
        };
      } else if (aspect === 'uniform') {
        updateData.uniform = valToSave;
        updateData.subjects = {
          UNIFORME: valToSave,
          Uniforme: valToSave
        };
      } else {
        // Specific subject name
        updateData.subjects = {
          [aspect]: valToSave
        };
      }

      await setDoc(doc(db, 'grades', gradeId), updateData, { merge: true });
      setLastSavedTime(new Date());
    } catch (err) {
      console.error("Error saving dev grade:", err);
      toast.error("Error al guardar calificación");
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Mass fill 10 for Conducta or Uniforme
  const handleMassFillGrade = async (aspect: 'conduct' | 'uniform', targetGrade: number = 10) => {
    if (isCurrentPeriodLocked) {
      toast.warn("El periodo seleccionado está bloqueado. No se puede modificar.");
      return;
    }
    if (!currentCycleId || filteredStudents.length === 0) return;

    const label = aspect === 'conduct' ? 'Conducta' : 'Uniforme';
    if (!window.confirm(`¿Deseas asignar ${targetGrade} en ${label} a los ${filteredStudents.length} alumnos en pantalla para el Periodo ${selectedPeriod}?`)) {
      return;
    }

    try {
      setIsAutoSaving(true);
      const batch = writeBatch(db);

      filteredStudents.forEach(st => {
        const gradeId = `${st.id}_B${selectedPeriod}_${currentCycleId}`;
        const ref = doc(db, 'grades', gradeId);

        const updateData: Record<string, any> = {
          studentId: st.id,
          cycleId: currentCycleId,
          bimestre: selectedPeriod,
          updatedAt: serverTimestamp(),
          createdBy: userProfile?.id || 'prefectura'
        };

        if (aspect === 'conduct') {
          updateData.conduct = targetGrade;
          updateData.subjects = {
            CONDUCTA: targetGrade,
            Conducta: targetGrade
          };
        } else {
          updateData.uniform = targetGrade;
          updateData.subjects = {
            UNIFORME: targetGrade,
            Uniforme: targetGrade
          };
        }

        batch.set(ref, updateData, { merge: true });
      });

      await batch.commit();
      toast.success(`Se asignó ${targetGrade} en ${label} a ${filteredStudents.length} alumnos`);
      setLastSavedTime(new Date());
    } catch (err) {
      console.error("Error mass filling grade:", err);
      toast.error("Error al asignar calificaciones");
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Toggle Period Lock / Finalize for current period
  const handleTogglePeriodLock = async () => {
    if (!currentCycleId || !selectedLevel) return;

    const willLock = !isCurrentPeriodLocked;
    const actionLabel = willLock ? 'cerrar' : 'abrir';
    const periodLabel = `Periodo ${selectedPeriod}`;

    const confirmMsg = willLock 
      ? `¿Estás seguro de que deseas CERRAR el ${periodLabel} para ${selectedLevel}?\n\nAl cerrarlo, quedará protegido en modo solo lectura para evitar modificaciones no deseadas.`
      : `¿Estás seguro de que deseas ABRIR el ${periodLabel} para ${selectedLevel}?\n\nAl abrirlo, podrás editar calificaciones de conducta y uniforme nuevamente.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setIsAutoSaving(true);
      const batch = writeBatch(db);

      // Target grades and groups
      const targetGrades = selectedGrade !== 'Todos' ? [selectedGrade] : (availableGrades.length > 0 ? availableGrades : ['1', '2', '3']);
      const targetGroups = selectedGroup !== 'Todos' ? [selectedGroup] : (availableGroups.length > 0 ? availableGroups : ['A', 'B']);

      // Dev subjects
      const subjectsToLock = devSubjects.length > 0 
        ? devSubjects 
        : [
            { id: 'conducta', name: 'CONDUCTA' },
            { id: 'uniforme', name: 'UNIFORME' }
          ];

      if (willLock) {
        targetGrades.forEach(g => {
          targetGroups.forEach(grp => {
            // Lock dev subjects
            subjectsToLock.forEach(s => {
              const lockId = `${selectedPeriod}_${selectedLevel}_${g}_${grp}_${currentCycleId}_${s.id}`;
              const ref = doc(db, 'bimestreLocks', lockId);
              batch.set(ref, {
                id: lockId,
                bimestre: selectedPeriod,
                level: selectedLevel,
                grade: g,
                group: grp,
                cycleId: currentCycleId,
                subjectId: s.id,
                subjectName: s.name,
                locked: true,
                lockedAt: serverTimestamp(),
                lockedBy: userProfile?.id || 'prefectura'
              });
            });

            // Global group lock
            const globalLockId = `${selectedPeriod}_${selectedLevel}_${g}_${grp}_${currentCycleId}`;
            const globalRef = doc(db, 'bimestreLocks', globalLockId);
            batch.set(globalRef, {
              id: globalLockId,
              bimestre: selectedPeriod,
              level: selectedLevel,
              grade: g,
              group: grp,
              cycleId: currentCycleId,
              locked: true,
              lockedAt: serverTimestamp(),
              lockedBy: userProfile?.id || 'prefectura'
            });
          });
        });

        await batch.commit();
        toast.success(`¡${periodLabel} cerrado exitosamente!`);
      } else {
        // Unlock / Open: delete matching locks
        const locksToDelete = classLocks.filter(l => {
          if (Number(l.bimestre) !== Number(selectedPeriod)) return false;
          if (selectedGrade !== 'Todos' && l.grade !== selectedGrade) return false;
          if (selectedGroup !== 'Todos' && l.group !== selectedGroup) return false;
          return true;
        });

        locksToDelete.forEach(l => {
          const ref = doc(db, 'bimestreLocks', l.id);
          batch.delete(ref);
        });

        await batch.commit();
        toast.success(`¡${periodLabel} abierto exitosamente! Ya puedes editar calificaciones.`);
      }

      setLastSavedTime(new Date());
    } catch (err) {
      console.error(`Error al ${actionLabel} periodo:`, err);
      toast.error(`Error al ${actionLabel} el periodo`);
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Export CSV of Attendance or Grades
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      toast.info("No hay alumnos para exportar");
      return;
    }

    if (activeTab === 'attendance') {
      const headers = ['Matrícula', 'Nivel', 'Grado', 'Grupo', 'Apellidos', 'Nombre', 'Estado Asistencia', 'Justificación'];
      const rows = filteredStudents.map(st => {
        const att = attendanceList.find(a => a.studentId === st.id);
        const status = att?.status || 'Sin registrar';
        const reason = att?.justificationReason || '';
        return [
          `"${st.matricula || ''}"`,
          `"${st.level || ''}"`,
          `"${st.grade || ''}"`,
          `"${st.group || ''}"`,
          `"${st.lastName || ''} ${st.motherLastName || ''}"`,
          `"${st.name || ''}"`,
          `"${status}"`,
          `"${reason.replace(/"/g, '""')}"`
        ].join(',');
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Asistencia_Plantel_${selectedLevel}_${selectedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Lista de asistencia exportada exitosamente");
    } else {
      const headers = ['Matrícula', 'Nivel', 'Grado', 'Grupo', 'Apellidos', 'Nombre', 'Conducta', 'Uniforme'];
      const rows = filteredStudents.map(st => {
        const g = gradesMap[st.id];
        return [
          `"${st.matricula || ''}"`,
          `"${st.level || ''}"`,
          `"${st.grade || ''}"`,
          `"${st.group || ''}"`,
          `"${st.lastName || ''} ${st.motherLastName || ''}"`,
          `"${st.name || ''}"`,
          `"${g?.conduct ?? ''}"`,
          `"${g?.uniform ?? ''}"`
        ].join(',');
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Desarrollo_Personal_${selectedLevel}_Periodo${selectedPeriod}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Calificaciones de desarrollo personal exportadas");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-[#1e3a8a] text-white rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#172554]">
        <div className="flex items-center gap-3.5 sm:gap-4">
          {currentLevelLogo && !logoLoadError ? (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white p-1.5 border border-blue-900 flex items-center justify-center shrink-0 overflow-hidden">
              <img 
                src={currentLevelLogo} 
                alt={`Logotipo ${selectedLevel || 'Nivel'}`} 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={() => setLogoLoadError(true)}
              />
            </div>
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#172554] border border-blue-900 flex items-center justify-center shrink-0 text-blue-200">
              <GraduationCap size={28} />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Panel de Prefectura
              </h1>
              {availableLevels.length === 1 && selectedLevel && (
                <span className="px-2.5 py-1 bg-[#172554] text-white border border-blue-900 rounded-lg text-xs font-bold tracking-wide">
                  {selectedLevel}
                </span>
              )}
            </div>
            {userProfile?.name && (
              <p className="text-xs text-blue-200 font-medium mt-1">
                Responsable: {userProfile.name}
              </p>
            )}
          </div>
        </div>

        {/* Date Selector placed directly on the right side of the header banner */}
        <div className="bg-[#172554] border border-blue-900 rounded-xl p-3 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={13} className="text-blue-300" />
              Fecha de Asistencia
            </span>
            <span className="text-xs font-bold text-white capitalize">
              {format(new Date(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedDate(getPrevSchoolDay(selectedDate))}
              className="p-2 rounded-lg bg-[#1e3a8a] hover:bg-blue-800 text-white border border-blue-900 transition-colors cursor-pointer"
              title="Día hábil anterior (omite sábados y domingos)"
            >
              <ChevronLeft size={15} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (isWeekend(val)) {
                  toast.warn("Los sábados y domingos son días inhábiles. Se seleccionó el día hábil más cercano.");
                  setSelectedDate(getNearestSchoolDay(new Date(val + 'T12:00:00')));
                } else {
                  setSelectedDate(val);
                }
              }}
              className="px-3 py-1.5 bg-white text-slate-900 font-bold text-xs rounded-lg border border-slate-300 outline-none cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(getNextSchoolDay(selectedDate))}
              className="p-2 rounded-lg bg-[#1e3a8a] hover:bg-blue-800 text-white border border-blue-900 transition-colors cursor-pointer"
              title="Día hábil siguiente (omite sábados y domingos)"
            >
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                if (today.getDay() === 0 || today.getDay() === 6) {
                  toast.info("Hoy es fin de semana (inhábil). Mostrando viernes.");
                  setSelectedDate(getNearestSchoolDay(today));
                } else {
                  setSelectedDate(format(today, 'yyyy-MM-dd'));
                }
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white font-bold text-xs transition-colors cursor-pointer border border-blue-500"
              title="Hoy (o último día hábil si es fin de semana)"
            >
              Hoy
            </button>
          </div>
        </div>
      </div>

      {/* Main Controls Card: Filters & Tabs */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main Navigation Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('attendance')}
              className={cn(
                "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap",
                activeTab === 'attendance'
                  ? "bg-[#1e3a8a] text-white border border-[#1e3a8a]"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              Asistencia al Plantel
            </button>

            <button
              onClick={() => setActiveTab('development')}
              className={cn(
                "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap",
                activeTab === 'development'
                  ? "bg-[#1e3a8a] text-white border border-[#1e3a8a]"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              Desarrollo Personal (Conducta y Uniforme)
            </button>

            <button
              onClick={() => setActiveTab('summary')}
              className={cn(
                "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap",
                activeTab === 'summary'
                  ? "bg-[#1e3a8a] text-white border border-[#1e3a8a]"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              Resumen y Reportes
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-300"
              title="Exportar a CSV / Excel"
            >
              <Download size={14} />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Nivel (if multiple), Grade, Group, Search & (if not attendance) Period */}
        <div className="flex flex-col sm:flex-row sm:items-end flex-wrap gap-3 pt-4 border-t border-slate-100">
          {/* Nivel Selector (only shown if user has multiple levels available) */}
          {availableLevels.length > 1 && (
            <div className="w-full sm:w-36 md:w-40 shrink-0">
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nivel Educativo</label>
              <select
                value={selectedLevel}
                onChange={(e) => {
                  setSelectedLevel(e.target.value);
                  setSelectedGrade('Todos');
                  setSelectedGroup('Todos');
                }}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-900 cursor-pointer"
              >
                {availableLevels.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
          )}

          {/* Grado Filter (compact) */}
          <div className="w-full sm:w-28 md:w-32 shrink-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Grado</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-900 cursor-pointer"
            >
              <option value="Todos">Todos</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>{g}° Grado</option>
              ))}
            </select>
          </div>

          {/* Grupo Filter (compact) */}
          <div className="w-full sm:w-28 md:w-32 shrink-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Grupo</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-900 cursor-pointer"
            >
              <option value="Todos">Todos</option>
              {availableGroups.map(grp => (
                <option key={grp} value={grp}>Grupo "{grp}"</option>
              ))}
            </select>
          </div>

          {/* Search Input (Takes maximum preference and expands to fill space) */}
          <div className="flex-1 min-w-[200px] sm:min-w-[260px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Buscar Alumno</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Nombre, apellidos, matrícula o CURP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-900"
              />
            </div>
          </div>

          {/* Period Selector (shown on Desarrollo Personal and Summary tabs) */}
          {activeTab !== 'attendance' && (
            <div className="w-full sm:w-48 md:w-56 shrink-0">
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Periodo de Evaluación</label>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: evalConfig.periodCount }, (_, i) => i + 1).map(p => {
                  const isLocked = Boolean(lockedPeriodsMap[p]);
                  const isSelected = selectedPeriod === p;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        hasManuallySelectedPeriodRef.current = true;
                        setSelectedPeriod(p);
                      }}
                      className={cn(
                        "flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer border",
                        isSelected 
                          ? (isLocked 
                              ? "bg-slate-800 text-white border-slate-800" 
                              : "bg-[#1e3a8a] text-white border-[#1e3a8a]")
                          : (isLocked
                              ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100")
                      )}
                    >
                      <span>P{p}</span>
                      {isLocked ? <Lock size={11} className="text-slate-300" /> : <Unlock size={11} className="text-blue-300" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Period Locking Notification for Calificaciones */}
      {activeTab === 'development' && (
        <div className={cn(
          "rounded-xl p-4 border flex items-center justify-between gap-4",
          isCurrentPeriodLocked
            ? "bg-amber-50 border-amber-300 text-amber-900"
            : "bg-blue-50 border-blue-200 text-blue-950"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              isCurrentPeriodLocked ? "bg-amber-200 text-amber-800" : "bg-blue-200 text-blue-900"
            )}>
              {isCurrentPeriodLocked ? <Lock size={20} /> : <Unlock size={20} />}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">
                {isCurrentPeriodLocked 
                  ? `Periodo ${selectedPeriod} Bloqueado (Modo Solo Lectura)` 
                  : `Periodo ${selectedPeriod} Activo y Abierto para Captura`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isCurrentPeriodLocked ? (
              <button
                type="button"
                onClick={handleTogglePeriodLock}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border border-emerald-600"
                title="Abrir este periodo para permitir captura y edición"
              >
                <Unlock size={13} />
                <span>Abrir Periodo {selectedPeriod}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTogglePeriodLock}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-800"
                title="Cerrar y proteger este periodo en modo solo lectura"
              >
                <Lock size={13} />
                <span>Cerrar Periodo {selectedPeriod}</span>
              </button>
            )}

            {!isCurrentPeriodLocked && (
              <>
                <button
                  type="button"
                  onClick={() => handleMassFillGrade('conduct', 10)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 transition-colors cursor-pointer"
                  title="Llenar Conducta con 10 para los alumnos mostrados"
                >
                  10 en Conducta
                </button>
                <button
                  type="button"
                  onClick={() => handleMassFillGrade('uniform', 10)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 transition-colors cursor-pointer"
                  title="Llenar Uniforme con 10 para los alumnos mostrados"
                >
                  10 en Uniforme
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: ASISTENCIA AL PLANTEL (GENERAL) */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Weekend warning banner */}
          {isWeekend(selectedDate) && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider">
                    Fin de semana (Día Inhábil) — No se registra asistencia
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Los sábados y domingos no cuentan para el registro ni cálculo de inasistencias escolares.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(getNearestSchoolDay(new Date(selectedDate + 'T12:00:00')))}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer text-center"
              >
                Ir a día hábil (Viernes)
              </button>
            </div>
          )}

          {/* Period closed warning banner if effectiveAttendancePeriod is locked */}
          {Boolean(lockedPeriodsMap[effectiveAttendancePeriod]) && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider">
                  Periodo {effectiveAttendancePeriod} Bloqueado / Cerrado
                </p>
                <p className="text-[11px] text-rose-800">
                  Para modificar o registrar asistencia en este periodo, puedes abrirlo desde la pestaña de "Desarrollo Personal".
                </p>
              </div>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-300">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Alumnos en Lista</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{attendanceStats.total}</p>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                <CheckCircle2 size={12} /> Presentes ({attendanceStats.percentage}%)
              </span>
              <p className="text-2xl font-black text-emerald-950 mt-1">{attendanceStats.present}</p>
            </div>

            <div className="bg-rose-50 p-4 rounded-xl border border-rose-300">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block flex items-center gap-1">
                <XCircle size={12} /> Faltas
              </span>
              <p className="text-2xl font-black text-rose-950 mt-1">{attendanceStats.absent}</p>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-300">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
                <Clock size={12} /> Retardos
              </span>
              <p className="text-2xl font-black text-amber-950 mt-1">{attendanceStats.tardy}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-300">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block flex items-center gap-1">
                <HelpCircle size={12} /> Justificados
              </span>
              <p className="text-2xl font-black text-blue-950 mt-1">{attendanceStats.excused}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Acción Rápida</span>
              <button
                onClick={handleMarkAllPresent}
                disabled={isWeekend(selectedDate) || Boolean(lockedPeriodsMap[effectiveAttendancePeriod])}
                className={cn(
                  "mt-1 w-full py-1.5 px-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1",
                  isWeekend(selectedDate) || Boolean(lockedPeriodsMap[effectiveAttendancePeriod])
                    ? "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                )}
              >
                <Check size={13} /> Todos Asistió
              </button>
            </div>
          </div>

          {/* Student Attendance Table */}
          <div className="bg-white rounded-xl border border-slate-300 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Pase de Lista al Plantel • {selectedLevel}
                </h3>
                <p className="text-xs text-slate-500">
                  La asistencia registrada aquí corresponde a la entrada general al colegio y es independiente de las materias de cada docente.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-500">Periodo activo:</span>
                <span className="text-blue-900 font-black">P{effectiveAttendancePeriod}</span>
                {Boolean(lockedPeriodsMap[dateTargetPeriod]) && dateTargetPeriod !== effectiveAttendancePeriod && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                    P{dateTargetPeriod} cerrado
                  </span>
                )}
                {Boolean(lockedPeriodsMap[effectiveAttendancePeriod]) && (
                  <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Lock size={10} /> Cerrado
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Alumno</th>
                    <th className="py-3.5 px-4">Nivel / Grado / Grupo</th>
                    <th className="py-3.5 px-4 text-center">Inasistencias en P{effectiveAttendancePeriod}</th>
                    <th className="py-3.5 px-4 text-center">Estado de Asistencia Hoy</th>
                    <th className="py-3.5 px-4">Justificación / Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-40" />
                        No se encontraron alumnos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const att = attendanceList.find(a => a.studentId === st.id);
                      const currentStatus = att?.status || 'Asistió';
                      const periodAbsences = getStudentAbsenceCountForPeriod(st.id, effectiveAttendancePeriod);
                      const isAttendanceDisabled = isWeekend(selectedDate) || Boolean(lockedPeriodsMap[effectiveAttendancePeriod]);

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Student Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-black text-xs shrink-0">
                                {st.name?.charAt(0) || 'A'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-tight">
                                  {st.lastName} {st.motherLastName || ''} {st.name}
                                </p>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {st.matricula || 'Sin matrícula'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Class Info */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-800">
                              {st.grade}° "{st.group || 'A'}"
                            </span>
                            <span className="text-slate-400 text-[10px] block font-medium">
                              {st.level}
                            </span>
                          </td>

                          {/* Period Absences Count */}
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black",
                              periodAbsences >= 3 
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : periodAbsences > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                            )}>
                              {periodAbsences} {periodAbsences === 1 ? 'falta' : 'faltas'}
                            </span>
                          </td>

                          {/* Attendance Action Buttons */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                              {/* Asistió */}
                              <button
                                onClick={() => handleSetAttendance(st, 'Asistió')}
                                disabled={isAttendanceDisabled}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1",
                                  isAttendanceDisabled && "cursor-not-allowed",
                                  currentStatus === 'Asistió'
                                    ? "bg-emerald-600 text-white"
                                    : isAttendanceDisabled
                                      ? "text-slate-400 opacity-60"
                                      : "text-slate-600 hover:text-emerald-700 hover:bg-white cursor-pointer"
                                )}
                                title="Marcar como Asistió"
                              >
                                <CheckCircle2 size={13} /> Asistió
                              </button>

                              {/* Falta */}
                              <button
                                onClick={() => handleSetAttendance(st, 'Falta')}
                                disabled={isAttendanceDisabled}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1",
                                  isAttendanceDisabled && "cursor-not-allowed",
                                  currentStatus === 'Falta'
                                    ? "bg-rose-600 text-white"
                                    : isAttendanceDisabled
                                      ? "text-slate-400 opacity-60"
                                      : "text-slate-600 hover:text-rose-700 hover:bg-white cursor-pointer"
                                )}
                                title="Marcar con Falta"
                              >
                                <XCircle size={13} /> Falta
                              </button>

                              {/* Retardo */}
                              <button
                                onClick={() => {
                                  if (isAttendanceDisabled) return;
                                  setJustifyingStudent({ student: st, status: 'Retardo' });
                                  setJustificationReason(att?.justificationReason || '');
                                }}
                                disabled={isAttendanceDisabled}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1",
                                  isAttendanceDisabled && "cursor-not-allowed",
                                  currentStatus === 'Retardo'
                                    ? "bg-amber-600 text-white"
                                    : isAttendanceDisabled
                                      ? "text-slate-400 opacity-60"
                                      : "text-slate-600 hover:text-amber-700 hover:bg-white cursor-pointer"
                                )}
                                title="Registrar Retardo"
                              >
                                <Clock size={13} /> Retardo
                              </button>

                              {/* Justificado */}
                              <button
                                onClick={() => {
                                  if (isAttendanceDisabled) return;
                                  setJustifyingStudent({ student: st, status: 'Justificado' });
                                  setJustificationReason(att?.justificationReason || '');
                                }}
                                disabled={isAttendanceDisabled}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1",
                                  isAttendanceDisabled && "cursor-not-allowed",
                                  currentStatus === 'Justificado'
                                    ? "bg-[#1e3a8a] text-white"
                                    : isAttendanceDisabled
                                      ? "text-slate-400 opacity-60"
                                      : "text-slate-600 hover:text-blue-900 hover:bg-white cursor-pointer"
                                )}
                                title="Registrar Justificante"
                              >
                                <HelpCircle size={13} /> Justif.
                              </button>
                            </div>
                          </td>

                          {/* Justification note display */}
                          <td className="py-3 px-4">
                            {att?.justificationReason ? (
                              <span className="text-[11px] text-slate-600 italic bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg block max-w-xs truncate" title={att.justificationReason}>
                                {att.justificationReason}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-300 italic">Sin nota</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DESARROLLO PERSONAL (CONDUCTA Y UNIFORME) */}
      {activeTab === 'development' && (
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={16} className="text-[#1e3a8a]" />
                Calificaciones de Desarrollo Personal • Periodo {selectedPeriod}
              </h3>
              <p className="text-xs text-slate-500">
                Las calificaciones de Uniforme y Conducta ingresadas aquí alimentan directamente la boleta oficial de calificaciones del alumno.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                Escala: <strong className="text-slate-800">1 al 10</strong> (0 o vacío borra)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">Alumno</th>
                  <th className="py-3.5 px-4">Nivel / Grado / Grupo</th>
                  <th className="py-3.5 px-4 text-center w-36">Conducta</th>
                  <th className="py-3.5 px-4 text-center w-36">Uniforme</th>
                  {devSubjects.filter(s => !['conducta', 'uniforme'].includes(s.name.toLowerCase().trim())).map(s => (
                    <th key={s.id} className="py-3.5 px-4 text-center w-36">{s.name}</th>
                  ))}
                  <th className="py-3.5 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={devSubjects.length + 4} className="py-12 text-center text-slate-400">
                      <Users size={32} className="mx-auto mb-2 opacity-40" />
                      No hay alumnos que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st, idx) => {
                    const gradeDoc = gradesMap[st.id];
                    const conductVal = gradeDoc?.conduct ?? '';
                    const uniformVal = gradeDoc?.uniform ?? '';

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Student Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                              {st.name?.charAt(0) || 'A'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">
                                {st.lastName} {st.motherLastName || ''} {st.name}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {st.matricula || ''}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Grade / Group */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">
                            {st.grade}° "{st.group || 'A'}"
                          </span>
                        </td>

                        {/* Conducta Input */}
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="1"
                            max="10"
                            step="any"
                            disabled={isCurrentPeriodLocked}
                            defaultValue={conductVal}
                            key={`conduct_${st.id}_${selectedPeriod}_${conductVal}`}
                            onBlur={(e) => handleSaveDevGrade(st.id, 'conduct', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className={cn(
                              "w-20 text-center py-1.5 px-2 rounded-lg text-sm font-black transition-colors outline-none border",
                              isCurrentPeriodLocked
                                ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                                : "bg-slate-50 focus:bg-white focus:border-[#1e3a8a] border-slate-300 text-slate-900"
                            )}
                            placeholder="-"
                          />
                        </td>

                        {/* Uniforme Input */}
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="1"
                            max="10"
                            step="any"
                            disabled={isCurrentPeriodLocked}
                            defaultValue={uniformVal}
                            key={`uniform_${st.id}_${selectedPeriod}_${uniformVal}`}
                            onBlur={(e) => handleSaveDevGrade(st.id, 'uniform', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className={cn(
                              "w-20 text-center py-1.5 px-2 rounded-lg text-sm font-black transition-colors outline-none border",
                              isCurrentPeriodLocked
                                ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                                : "bg-slate-50 focus:bg-white focus:border-[#1e3a8a] border-slate-300 text-slate-900"
                            )}
                            placeholder="-"
                          />
                        </td>

                        {/* Other dev subjects if registered */}
                        {devSubjects.filter(s => !['conducta', 'uniforme'].includes(s.name.toLowerCase().trim())).map(s => {
                          const val = gradeDoc?.subjects?.[s.name] ?? '';
                          return (
                            <td key={s.id} className="py-3 px-4 text-center">
                              <input
                                type="number"
                                min="1"
                                max="10"
                                step="any"
                                disabled={isCurrentPeriodLocked}
                                defaultValue={val}
                                key={`subj_${s.name}_${st.id}_${selectedPeriod}_${val}`}
                                onBlur={(e) => handleSaveDevGrade(st.id, s.name, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className={cn(
                                  "w-20 text-center py-1.5 px-2 rounded-lg text-sm font-black transition-colors outline-none border",
                                  isCurrentPeriodLocked
                                    ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                                    : "bg-slate-50 focus:bg-white focus:border-[#1e3a8a] border-slate-300 text-slate-900"
                                )}
                                placeholder="-"
                              />
                            </td>
                          );
                        })}

                        {/* Status feedback */}
                        <td className="py-3 px-4 text-center text-[11px] text-slate-400">
                          {isCurrentPeriodLocked ? (
                            <span className="inline-flex items-center gap-1 text-slate-400 font-bold">
                              <Lock size={12} /> Bloqueado
                            </span>
                          ) : (conductVal || uniformVal) ? (
                            <span className="inline-flex items-center gap-1 text-blue-800 font-bold">
                              <CheckCircle2 size={12} /> Calificado
                            </span>
                          ) : (
                            <span className="text-slate-300">Pendiente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RESUMEN Y REPORTES DE PREFECTURA */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Alumnos con 3 o más faltas en el periodo */}
          <div className="bg-white rounded-xl border border-slate-300 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Alerta de Inasistencias • Periodo {selectedPeriod}
                </h3>
              </div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                3 o más faltas
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Alumnos con riesgo de pérdida de derecho a examen o reporte disciplinario por faltas acumuladas en el periodo actual.
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredStudents
                .map(st => ({ student: st, count: getStudentAbsenceCountForPeriod(st.id, selectedPeriod) }))
                .filter(item => item.count >= 3)
                .sort((a, b) => b.count - a.count)
                .map(({ student, count }) => (
                  <div key={student.id} className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {student.lastName} {student.motherLastName || ''} {student.name}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {student.level} • {student.grade}° "{student.group || 'A'}"
                      </span>
                    </div>
                    <span className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-black">
                      {count} faltas
                    </span>
                  </div>
                ))}

              {filteredStudents.filter(st => getStudentAbsenceCountForPeriod(st.id, selectedPeriod) >= 3).length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs font-bold text-slate-700">¡Excelente!</p>
                  <p className="text-xs text-slate-500">Ningún alumno supera el límite de inasistencias en este periodo.</p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Resumen de Aspectos Formativos */}
          <div className="bg-white rounded-xl border border-slate-300 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#1e3a8a]" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Desarrollo Personal • Resumen Periodo {selectedPeriod}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Alumnos con calificaciones bajas en Conducta o Uniforme (&lt; 8) que requieren seguimiento de prefectura o citatorio con padres.
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredStudents
                .filter(st => {
                  const g = gradesMap[st.id];
                  const c = parseFloat(String(g?.conduct));
                  const u = parseFloat(String(g?.uniform));
                  return (!isNaN(c) && c < 8) || (!isNaN(u) && u < 8);
                })
                .map(st => {
                  const g = gradesMap[st.id];
                  return (
                    <div key={st.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {st.lastName} {st.motherLastName || ''} {st.name}
                        </p>
                        <span className="text-[11px] text-slate-500">
                          {st.grade}° "{st.group || 'A'}"
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {g?.conduct !== undefined && g.conduct !== '' && (
                          <span className={cn(
                            "px-2 py-0.5 rounded font-black",
                            parseFloat(String(g.conduct)) < 8 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                          )}>
                            Cond: {g.conduct}
                          </span>
                        )}
                        {g?.uniform !== undefined && g.uniform !== '' && (
                          <span className={cn(
                            "px-2 py-0.5 rounded font-black",
                            parseFloat(String(g.uniform)) < 8 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                          )}>
                            Unif: {g.uniform}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

              {filteredStudents.filter(st => {
                const g = gradesMap[st.id];
                const c = parseFloat(String(g?.conduct));
                const u = parseFloat(String(g?.uniform));
                return (!isNaN(c) && c < 8) || (!isNaN(u) && u < 8);
              }).length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-[#1e3a8a]" />
                  <p className="text-xs font-bold text-slate-700">Sin incidencias</p>
                  <p className="text-xs text-slate-500">Todos los alumnos evaluados mantienen 8 o superior en desarrollo personal.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Justification Note Modal */}
      {justifyingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-[#1e3a8a]" />
                Registrar {justifyingStudent.status}
              </h3>
              <button
                onClick={() => setJustifyingStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Alumno: <strong className="text-slate-900">{justifyingStudent.student.lastName} {justifyingStudent.student.motherLastName || ''} {justifyingStudent.student.name}</strong> ({justifyingStudent.student.grade}° "{justifyingStudent.student.group}")
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Motivo / Justificación (Opcional)
              </label>
              <textarea
                rows={3}
                value={justificationReason}
                onChange={(e) => setJustificationReason(e.target.value)}
                placeholder="Ej. Cita médica, permiso de dirección, transporte..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-[#1e3a8a] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setJustifyingStudent(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSetAttendance(justifyingStudent.student, justifyingStudent.status, justificationReason);
                  setJustifyingStudent(null);
                }}
                className="px-5 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirmar {justifyingStudent.status}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

