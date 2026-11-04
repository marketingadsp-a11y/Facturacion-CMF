import { AppSettings, LevelEvaluationConfig, GradingScale, StudentGrade, Subject } from '../types';

export type QualitativeGradeLetter = 'A' | 'E' | 'ED' | 'RA';
export type LegacyGradeLetter = 'B' | 'C' | 'D';

export interface PreescolarGradeLetter {
  letter: QualitativeGradeLetter;
  label: string;
  description: string;
  score: number; // A=10, E=8, ED=6, RA=5 for averaging
}

export const PREESCOLAR_LETTERS: PreescolarGradeLetter[] = [
  { letter: 'A', label: 'A (Avanzado)', description: 'Avanzado', score: 10 },
  { letter: 'E', label: 'E (Esperado)', description: 'Esperado', score: 8 },
  { letter: 'ED', label: 'ED (En Desarrollo)', description: 'En Desarrollo', score: 6 },
  { letter: 'RA', label: 'RA (Requiere Apoyo)', description: 'Requiere Apoyo', score: 5 },
];

/**
 * Returns default grading scale for a given level name:
 * - Preescolar: 'letters' (A, E, ED, RA)
 * - Preparatoria / Bachillerato: 'numeric_100' (0 - 100)
 * - Primaria / Secundaria / others: 'numeric_10' (0 - 10)
 */
export function getDefaultGradingScale(levelName?: string): GradingScale {
  if (!levelName) return 'numeric_10';
  const l = levelName.toLowerCase();
  if (
    l.includes('preescolar') ||
    l.includes('kinder') ||
    l.includes('kínder') ||
    l.includes('maternal') ||
    l.includes('pre-escolar') ||
    l.includes('pre escolar')
  ) {
    return 'letters';
  }
  if (
    l.includes('prepa') ||
    l.includes('bachiller') ||
    l.includes('universidad') ||
    l.includes('licenciatura')
  ) {
    return 'numeric_100';
  }
  return 'numeric_10';
}

/**
 * Gets configured or default grading scale for a level
 */
export function getGradingScale(settings: AppSettings | null, levelName?: string): GradingScale {
  if (!levelName) return 'numeric_10';
  if (settings?.levelEvaluationConfig?.[levelName]?.gradingScale) {
    return settings.levelEvaluationConfig[levelName].gradingScale as GradingScale;
  }
  return getDefaultGradingScale(levelName);
}

/**
 * Converts a letter (A, E, ED, RA or legacy B, C, D) to its point equivalent (A=10, E/B=8, ED/C=6, RA/D=5)
 */
export function letterToPoints(letter: string): number | null {
  const clean = letter.toUpperCase().trim();
  if (clean === 'A') return 10;
  if (clean === 'E' || clean === 'B') return 8;
  if (clean === 'ED' || clean === 'C') return 6;
  if (clean === 'RA' || clean === 'D') return 5;
  return null;
}

/**
 * Converts a numerical score back to letter grade (A, E, ED, RA)
 * Cutoffs:
 * >= 9.0  -> A (Avanzado)
 * >= 7.0  -> E (Esperado - midpoint between 8 and 6 is 7.0)
 * >= 5.5  -> ED (En Desarrollo - midpoint between 6 and 5 is 5.5)
 * < 5.5   -> RA (Requiere Apoyo)
 */
export function pointsToLetter(points: number): QualitativeGradeLetter {
  if (points >= 9.0) return 'A';
  if (points >= 7.0) return 'E';
  if (points >= 5.5) return 'ED';
  return 'RA';
}

/**
 * Extracts a numeric value from a grade entry regardless of scale.
 * If letter, converts to points. If number, returns numeric value.
 */
export function gradeToNumeric(grade: number | string | undefined | null, scale: GradingScale): number | null {
  if (grade === undefined || grade === null || grade === '' || grade === '-') return null;
  if (scale === 'letters') {
    if (typeof grade === 'string') return letterToPoints(grade);
    if (typeof grade === 'number') return grade;
    return null;
  }
  const n = typeof grade === 'number' ? grade : parseFloat(String(grade));
  return isNaN(n) ? null : n;
}

/**
 * Formats an average according to the level's scale:
 * - 'letters': returns 'A' | 'E' | 'ED' | 'RA'
 * - 'numeric_100': returns rounded whole integer string (e.g. '88', '95', '100')
 * - 'numeric_10': returns 1 decimal string (e.g. '8.8', '9.5')
 */
export function formatAverage(sum: number, count: number, scale: GradingScale): string {
  if (count === 0) return '-';
  const raw = sum / count;
  if (scale === 'letters') {
    return pointsToLetter(raw);
  }
  if (scale === 'numeric_100') {
    return Math.round(raw).toString();
  }
  return raw.toFixed(1);
}

/**
 * Generates default period names like "1er Trimestre", "2do Trimestre" or "1er Bimestre"
 */
export function generateDefaultPeriodNames(type: string, count: number): string[] {
  const ordinalPrefixes = ['1er', '2do', '3er', '4to', '5to', '6to', '7mo', '8vo'];
  const singular = type === 'Trimestres' ? 'Trimestre' :
                   type === 'Bimestres' ? 'Bimestre' :
                   type === 'Semestres' ? 'Semestre' :
                   type === 'Cuatrimestres' ? 'Cuatrimestre' : 'Periodo';

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const prefix = ordinalPrefixes[i] || `${i + 1}°`;
    names.push(`${prefix} ${singular}`);
  }
  return names;
}

/**
 * Returns the evaluation configuration for a given level, respecting the global settings,
 * or returning sensible default Mexican educational standards (3 Trimestres for Primaria/Secundaria, 5 Bimestres for Prepa).
 */
export function getLevelEvaluationConfig(settings: AppSettings | null, levelName?: string): LevelEvaluationConfig {
  const defaultScale = getDefaultGradingScale(levelName);

  if (!levelName) {
    return {
      periodCount: 3,
      periodType: 'Trimestres',
      periodNames: ['1er Trimestre', '2do Trimestre', '3er Trimestre'],
      gradingScale: defaultScale,
      enableActivities: false,
      enableSubjectAttendance: false
    };
  }

  const trimmedLevel = levelName.trim().toLowerCase();
  const activitiesFallback = Boolean(
    settings?.teacherActivitiesLevels?.some(l => l && l.trim().toLowerCase() === trimmedLevel)
  );

  const defaultSubjectAttendance = /secundaria|bachillerato|preparatoria|prepa/i.test(trimmedLevel);
  const subjectAttendanceFallback = Boolean(
    settings?.subjectAttendanceLevels !== undefined
      ? settings.subjectAttendanceLevels.some(l => l && l.trim().toLowerCase() === trimmedLevel)
      : defaultSubjectAttendance
  );

  // 1. If explicitly configured in settings under levelEvaluationConfig
  const exactConf = settings?.levelEvaluationConfig?.[levelName];
  const matchedKey = exactConf
    ? levelName
    : Object.keys(settings?.levelEvaluationConfig || {}).find(k => k && k.trim().toLowerCase() === trimmedLevel);
  const conf = exactConf || (matchedKey ? settings?.levelEvaluationConfig?.[matchedKey] : undefined);

  if (conf) {
    const count = Number(conf.periodCount) || 3;
    const type = conf.periodType || (count === 5 ? 'Bimestres' : count === 3 ? 'Trimestres' : 'Personalizado');
    const names = (conf.periodNames && conf.periodNames.length === count)
      ? conf.periodNames
      : generateDefaultPeriodNames(type, count);
    const gradingScale = conf.gradingScale || defaultScale;
    const enableActivities = conf.enableActivities !== undefined
      ? Boolean(conf.enableActivities)
      : activitiesFallback;
    const enableSubjectAttendance = conf.enableSubjectAttendance !== undefined
      ? Boolean(conf.enableSubjectAttendance)
      : subjectAttendanceFallback;

    return {
      periodCount: count,
      periodType: type,
      periodNames: names,
      gradingScale,
      enableActivities,
      enableSubjectAttendance
    };
  }

  // 2. Intelligent defaults based on Mexican standard educational levels:
  const lLower = trimmedLevel;
  if (lLower.includes('prepa') || lLower.includes('bachiller')) {
    // Preparatoria / Bachillerato: 5 bimestres, 0 a 100
    return {
      periodCount: 5,
      periodType: 'Bimestres',
      periodNames: ['1er Bimestre', '2do Bimestre', '3er Bimestre', '4to Bimestre', '5to Bimestre'],
      gradingScale: 'numeric_100',
      enableActivities: activitiesFallback,
      enableSubjectAttendance: subjectAttendanceFallback
    };
  } else if (lLower.includes('universidad') || lLower.includes('licenciatura')) {
    return {
      periodCount: 2,
      periodType: 'Semestres',
      periodNames: ['1er Semestre', '2do Semestre'],
      gradingScale: 'numeric_100',
      enableActivities: activitiesFallback,
      enableSubjectAttendance: subjectAttendanceFallback
    };
  } else if (
    lLower.includes('preescolar') ||
    lLower.includes('kinder') ||
    lLower.includes('kínder') ||
    lLower.includes('maternal') ||
    lLower.includes('pre-escolar')
  ) {
    // Preescolar: 3 Trimestres, Letras A-D
    return {
      periodCount: 3,
      periodType: 'Trimestres',
      periodNames: ['1er Trimestre', '2do Trimestre', '3er Trimestre'],
      gradingScale: 'letters',
      enableActivities: activitiesFallback,
      enableSubjectAttendance: subjectAttendanceFallback
    };
  } else {
    // Primaria, Secundaria: 3 Trimestres (SEP estándar), 0 a 10
    return {
      periodCount: 3,
      periodType: 'Trimestres',
      periodNames: ['1er Trimestre', '2do Trimestre', '3er Trimestre'],
      gradingScale: 'numeric_10',
      enableActivities: activitiesFallback,
      enableSubjectAttendance: subjectAttendanceFallback
    };
  }
}

/**
 * Computes the effective grade for an academic subject for a specific period (bimestre),
 * taking into account any Autonomía Curricular subjects linked to it.
 *
 * For example:
 * - Academic subject: "De lo Humano y lo Comunitario" (base grade: 9)
 * - Linked Autonomía subject: "Educación Física" (grade: 10, linked to "De lo Humano y lo Comunitario")
 * Returns: { rawValue: '9.5', numericValue: 9.5 }
 */
export function getEffectiveSubjectGrade(
  subjectName: string,
  bimestre: number,
  studentGrades: StudentGrade[],
  allSubjects: Subject[],
  scale: GradingScale
): { rawValue: string | number; numericValue: number | null } {
  const bg = studentGrades.find(g => Number(g.bimestre) === Number(bimestre));
  if (!bg || !bg.subjects) {
    return { rawValue: '-', numericValue: null };
  }

  // Find any Autonomía Curricular subjects linked to this subject
  const normName = subjectName.trim().toLowerCase();
  const linkedAutonomySubjects = allSubjects.filter(s =>
    s.category === 'Autonomía Curricular' &&
    s.linkedSubjectName &&
    s.linkedSubjectName.trim().toLowerCase() === normName
  );

  // Helper for case-insensitive subject lookup in bg.subjects
  const getSubjectRaw = (name: string) => {
    if (!bg.subjects) return undefined;
    if (bg.subjects[name] !== undefined) return bg.subjects[name];
    const n = name.trim().toLowerCase();
    for (const [k, v] of Object.entries(bg.subjects)) {
      if (k.trim().toLowerCase() === n) return v;
    }
    return undefined;
  };

  // If this subject is not linked to any autonomy subjects, return its direct grade
  if (linkedAutonomySubjects.length === 0) {
    const raw = getSubjectRaw(subjectName);
    if (raw !== undefined && raw !== null && raw !== '' && raw !== '-') {
      const num = gradeToNumeric(raw, scale);
      return { rawValue: raw, numericValue: num };
    }
    return { rawValue: '-', numericValue: null };
  }

  // Collect grades from base subject and all linked subjects
  const allNums: number[] = [];
  const baseRaw = getSubjectRaw(subjectName);
  const baseNum = gradeToNumeric(baseRaw, scale);
  if (baseNum !== null) {
    allNums.push(baseNum);
  }

  for (const lSub of linkedAutonomySubjects) {
    const lRaw = getSubjectRaw(lSub.name);
    const lNum = gradeToNumeric(lRaw, scale);
    if (lNum !== null) {
      allNums.push(lNum);
    }
  }

  if (allNums.length === 0) {
    return { rawValue: '-', numericValue: null };
  }

  if (allNums.length === 1) {
    // If only base or only one linked subject was graded
    if (baseNum !== null) {
      return { rawValue: baseRaw!, numericValue: baseNum };
    }
    return {
      rawValue: formatAverage(allNums[0], 1, scale),
      numericValue: allNums[0]
    };
  }

  // Multiple grades -> average them
  const sum = allNums.reduce((a, b) => a + b, 0);
  const avg = sum / allNums.length;
  return {
    rawValue: formatAverage(sum, allNums.length, scale),
    numericValue: avg
  };
}

/**
 * Determines which evaluation period (1-indexed: 1, 2, 3...) a specific date belongs to,
 * based on the standard Mexican school year (Aug-Jul) and the number of periods (e.g., 3 trimestres, 5 bimestres, 2 semestres).
 */
export function getPeriodForDate(dateStr: string, periodCount: number = 3): number {
  if (!dateStr) return 1;
  const parts = dateStr.split('-');
  if (parts.length < 2) return 1;
  const month = parseInt(parts[1], 10); // 1 = Jan ... 12 = Dec

  if (periodCount === 3) {
    // 3 Trimestres (SEP estándar):
    // T1: Agosto, Septiembre, Octubre, Noviembre
    if ([8, 9, 10, 11].includes(month)) return 1;
    // T2: Diciembre, Enero, Febrero, Marzo
    if ([12, 1, 2, 3].includes(month)) return 2;
    // T3: Abril, Mayo, Junio, Julio
    return 3;
  }

  if (periodCount === 5) {
    // 5 Bimestres:
    // B1: Agosto, Septiembre, Octubre
    if ([8, 9, 10].includes(month)) return 1;
    // B2: Noviembre, Diciembre
    if ([11, 12].includes(month)) return 2;
    // B3: Enero, Febrero
    if ([1, 2].includes(month)) return 3;
    // B4: Marzo, Abril
    if ([3, 4].includes(month)) return 4;
    // B5: Mayo, Junio, Julio
    return 5;
  }

  if (periodCount === 2) {
    // 2 Semestres:
    // S1: Agosto a Enero
    if ([8, 9, 10, 11, 12, 1].includes(month)) return 1;
    // S2: Febrero a Julio
    return 2;
  }

  if (periodCount === 4) {
    if ([8, 9, 10].includes(month)) return 1;
    if ([11, 12, 1].includes(month)) return 2;
    if ([2, 3, 4].includes(month)) return 3;
    return 4;
  }

  // Fallback: divide 12 months evenly starting from August
  const schoolMonth = ((month - 8 + 12) % 12); // 0 (Aug) to 11 (Jul)
  const period = Math.floor((schoolMonth / 12) * periodCount) + 1;
  return Math.min(Math.max(period, 1), periodCount);
}

/**
 * Checks whether a Subject is configured or identified as tracking student absences (Inasistencias / Faltas).
 */
export function isAttendanceTrackingSubject(subject: Subject): boolean {
  if (!subject) return false;
  if (subject.isAttendanceCount) return true;
  const norm = (subject.name || '').toLowerCase().trim();
  return (
    norm === 'inasistencia' ||
    norm === 'inasistencias' ||
    norm === 'faltas' ||
    norm === 'falta' ||
    norm.includes('inasistencia') ||
    norm.includes('falta')
  );
}

/**
 * Checks if educational level is Preescolar or Primaria (where period subject observations apply)
 */
export function isObservationsLevel(levelName?: string): boolean {
  if (!levelName) return false;
  const l = levelName.toLowerCase().trim();
  return (
    l.includes('preescolar') ||
    l.includes('kinder') ||
    l.includes('kínder') ||
    l.includes('maternal') ||
    l.includes('pre-escolar') ||
    l.includes('pre escolar') ||
    l.includes('primaria')
  );
}

/**
 * Checks if a subject belongs to "Materias Académicas"
 */
export function isPureAcademicSubject(subject: Subject): boolean {
  if (!subject) return false;
  return !subject.category || subject.category === 'Académica' || subject.category === 'Recursamiento';
}

/**
 * Retrieves the observation text for a given student's subject and period
 */
export function getSubjectObservation(
  grades: StudentGrade[],
  subjectName: string,
  period: number
): string {
  if (!grades || grades.length === 0 || !subjectName) return '';
  const bg = grades.find(g => Number(g.bimestre) === Number(period));
  if (!bg) return '';
  if (bg.subjectObservations && bg.subjectObservations[subjectName] !== undefined) {
    return bg.subjectObservations[subjectName];
  }
  if (bg.observations && bg.observations[subjectName] !== undefined) {
    return bg.observations[subjectName];
  }
  // Case-insensitive fallback
  const normTarget = subjectName.toLowerCase().trim();
  if (bg.subjectObservations) {
    for (const [k, v] of Object.entries(bg.subjectObservations)) {
      if (k.toLowerCase().trim() === normTarget && v !== undefined) {
        return v;
      }
    }
  }
  if (bg.observations) {
    for (const [k, v] of Object.entries(bg.observations)) {
      if (k.toLowerCase().trim() === normTarget && v !== undefined) {
        return v;
      }
    }
  }
  return '';
}

/**
 * Checks whether an educational level uses subject-level period locking (Secundaria and Preparatoria)
 * so that each subject is locked independently without blocking other teachers.
 */
export function isSubjectLockLevel(levelName?: string | null): boolean {
  if (!levelName) return false;
  return /secundaria|bachillerato|preparatoria|prepa/i.test(levelName.trim().toLowerCase());
}

/**
 * Normalizes grade strings to allow robust matching:
 * e.g. "1ro", "1°", "1", "1ero" -> "1"
 * "2do", "2°", "2" -> "2"
 * "3ro", "3°", "3", "3ero" -> "3"
 */
export function normalizeGradeStr(grade?: string): string {
  if (!grade) return '';
  const g = String(grade).toLowerCase().trim();
  return g
    .replace(/[°º]/g, '')
    .replace(/(ro|do|er|ero|to|vo|mo)$/g, '')
    .trim();
}

/**
 * Returns available grades for a specific educational level.
 * Preescolar & Secundaria default to 1ro, 2do, 3ro.
 * Primaria & Bachillerato default to 1ro..6to.
 */
export function getLevelGrades(level?: string, configuredGrades?: string[]): string[] {
  const base = configuredGrades && configuredGrades.length > 0
    ? configuredGrades
    : ['1ro', '2do', '3ro', '4to', '5to', '6to'];
  const lvl = (level || '').toLowerCase().trim();
  if (lvl.includes('preescolar') || lvl.includes('secundaria')) {
    return base.filter(g => {
      const n = parseInt(g.replace(/\D/g, ''), 10);
      return isNaN(n) || n <= 3;
    });
  }
  return base;
}

/**
 * Checks if a subject applies to a specific grade.
 * If applicableGrades is empty or undefined, it applies to all grades in the level.
 */
export function isSubjectApplicableToGrade(subject: Subject, studentGrade?: string): boolean {
  if (!studentGrade) return true;
  if (!subject.applicableGrades || subject.applicableGrades.length === 0) {
    return true;
  }
  const rawTarget = studentGrade.toLowerCase().trim();
  const normTarget = normalizeGradeStr(studentGrade);

  return subject.applicableGrades.some(g => {
    const rawG = g.toLowerCase().trim();
    if (rawG === rawTarget) return true;
    const normG = normalizeGradeStr(g);
    return normG === normTarget;
  });
}

/**
 * Checks whether a student is enrolled in a subject.
 * - Grade check: if applicableGrades is specified, student must be in one of those grades.
 * - Non-TAE subjects apply to all students (matching grade).
 * - TAE subjects with taeStudentMode === 'all' apply to all students in the level (matching grade).
 * - TAE subjects with taeStudentMode === 'specific' apply only to students listed in taeStudentIds.
 */
export function isStudentEnrolledInSubject(subject: Subject, studentId: string, studentGrade?: string): boolean {
  if (!subject) return false;
  // Grade applicability check
  if (studentGrade && subject.applicableGrades && subject.applicableGrades.length > 0) {
    if (!isSubjectApplicableToGrade(subject, studentGrade)) {
      return false;
    }
  }
  // TAE check
  if (!subject.isTae) return true;
  if (!subject.taeStudentMode || subject.taeStudentMode === 'all') return true;
  return Boolean(subject.taeStudentIds && subject.taeStudentIds.includes(studentId));
}

