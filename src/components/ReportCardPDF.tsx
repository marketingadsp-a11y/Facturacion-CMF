import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject } from '../types';
import ReportCardSecundaria1PDF from './ReportCardSecundaria1PDF';
import ReportCardSecundaria2PDF from './ReportCardSecundaria2PDF';
import ReportCardSecundaria3PDF from './ReportCardSecundaria3PDF';
import { 
  getLevelEvaluationConfig, 
  gradeToNumeric, 
  formatAverage, 
  getEffectiveSubjectGrade, 
  isObservationsLevel, 
  getSubjectObservation,
  isStudentEnrolledInSubject,
  isAttendanceIncludedInReportCard
} from '../lib/evaluationUtils';

const styles = StyleSheet.create({
  // Page 1: Main Report Card (Strict 1-page portrait letter)
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 24,
    fontSize: 7.5,
    color: '#0F172A',
  },
  
  // Page 2: Observations Sheet (Portrait letter)
  obsPage: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 24,
    fontSize: 7.5,
    color: '#0F172A',
  },

  // Institutional Header (Top)
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0F172A',
    marginBottom: 6,
  },
  logoContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  schoolName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  schoolCct: {
    fontSize: 7,
    color: '#475569',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  schoolLevelCycle: {
    fontSize: 7.5,
    color: '#0F172A',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  headerRightBox: {
    width: 105,
    paddingVertical: 4,
    paddingHorizontal: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  docSubtitle: {
    fontSize: 6,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 1,
    textTransform: 'uppercase',
  },

  // Student Info Card
  studentCard: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    backgroundColor: '#F8FAFC',
    marginBottom: 5,
    overflow: 'hidden',
  },
  studentCardRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 15,
    alignItems: 'center',
  },
  studentCardRowLast: {
    flexDirection: 'row',
    minHeight: 15,
    alignItems: 'center',
  },
  studentField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  studentFieldLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fieldLabel: {
    fontSize: 6,
    fontWeight: 'bold',
    color: '#64748B',
    marginRight: 3,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },

  // Subject Table Sections
  sectionBanner: {
    backgroundColor: '#0F172A',
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionBannerText: {
    color: '#FFFFFF',
    fontSize: 6.8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  table: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderTopWidth: 0,
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    minHeight: 13,
    alignItems: 'center',
  },
  tableHeaderSubject: {
    flex: 3.8,
    paddingLeft: 6,
    fontSize: 6.3,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
  },
  tableHeaderPeriod: {
    flex: 1,
    textAlign: 'center',
    fontSize: 6.3,
    fontWeight: 'bold',
    color: '#334155',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  tableHeaderAvg: {
    flex: 1.2,
    textAlign: 'center',
    fontSize: 6.3,
    fontWeight: 'bold',
    color: '#0F172A',
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 13,
    alignItems: 'center',
  },
  tableCellSubject: {
    flex: 3.8,
    paddingLeft: 6,
    fontSize: 6.8,
    color: '#0F172A',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    paddingVertical: 1.5,
  },
  tableCellPeriod: {
    flex: 1,
    textAlign: 'center',
    fontSize: 6.8,
    color: '#334155',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    paddingVertical: 1.5,
  },
  tableCellAvg: {
    flex: 1.2,
    textAlign: 'center',
    fontSize: 7.2,
    fontWeight: 'bold',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
    paddingVertical: 1.5,
  },
  tableSummaryRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    minHeight: 14,
    alignItems: 'center',
  },
  tableSummaryLabel: {
    flex: 3.8,
    paddingLeft: 6,
    fontSize: 6.8,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  tableSummaryPeriod: {
    flex: 1,
    textAlign: 'center',
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0F172A',
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
  },
  tableSummaryAvg: {
    flex: 1.2,
    textAlign: 'center',
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#0F172A',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyRowText: {
    padding: 4,
    fontSize: 6,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Final Cycle Summary Banner
  cycleSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    marginTop: 4,
    marginBottom: 5,
  },
  scaleNotice: {
    flex: 1,
    fontSize: 5.8,
    color: '#64748B',
    paddingRight: 8,
  },
  finalAvgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  finalAvgLabel: {
    fontSize: 7.2,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  finalAvgValueBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 3,
  },
  finalAvgValueText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: 'bold',
  },

  // Signatures Area
  signaturesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 'auto',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  signatureBlock: {
    width: '38%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    marginBottom: 3,
  },
  signatureLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  signatureSub: {
    fontSize: 5.8,
    color: '#64748B',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  sealBlock: {
    width: '18%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealBox: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealText: {
    fontSize: 5.5,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  footerNotice: {
    fontSize: 5.2,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },

  // PAGE 2 (Observaciones) Styles
  obsHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0F172A',
    marginBottom: 6,
  },
  obsDocTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  obsDocSubtitle: {
    fontSize: 6.5,
    color: '#475569',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  obsTable: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 8,
  },
  obsTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    minHeight: 16,
    alignItems: 'center',
  },
  obsTableHeaderSubject: {
    flex: 2.2,
    paddingLeft: 6,
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  obsTableHeaderPeriod: {
    borderLeftWidth: 1,
    borderLeftColor: '#334155',
    textAlign: 'center',
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    paddingVertical: 2,
  },
  obsTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 28,
    alignItems: 'stretch',
  },
  obsTableCellSubject: {
    flex: 2.2,
    padding: 5,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
  },
  obsTableCellPeriod: {
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    padding: 4,
    justifyContent: 'center',
  },
  obsSubjectName: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  obsText: {
    fontSize: 6.5,
    color: '#1E293B',
    lineHeight: 1.25,
  },
  obsEmpty: {
    fontSize: 6,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

interface ReportCardPDFProps {
  student: Student;
  grades: StudentGrade[];
  subjects: Subject[];
  settings: AppSettings | null;
  cycle: SchoolCycle;
  teacherName?: string;
  teacherSubjectGroupsMap?: Record<string, string[]>;
}

export default function ReportCardPDF({ 
  student, 
  grades, 
  subjects, 
  settings, 
  cycle,
  teacherName,
  teacherSubjectGroupsMap
}: ReportCardPDFProps) {
  // Dedicated landscape boletas matching the official format for Secundaria (1°, 2°, 3°)
  const studentLevelStr = (student?.level || '').toLowerCase().trim();
  const isSecundaria = studentLevelStr.includes('secundaria');
  const gradeStr = String(student?.grade || '').toLowerCase().trim();
  const isPrimero = gradeStr.includes('1') || gradeStr.includes('primer');
  const isSegundo = gradeStr.includes('2') || gradeStr.includes('segund');
  const isTercero = gradeStr.includes('3') || gradeStr.includes('tercer');

  if (isSecundaria) {
    if (isPrimero) {
      return (
        <ReportCardSecundaria1PDF
          student={student}
          grades={grades}
          subjects={subjects}
          settings={settings}
          cycle={cycle}
          teacherName={teacherName}
        />
      );
    }
    if (isSegundo) {
      return (
        <ReportCardSecundaria2PDF
          student={student}
          grades={grades}
          subjects={subjects}
          settings={settings}
          cycle={cycle}
          teacherName={teacherName}
        />
      );
    }
    if (isTercero) {
      return (
        <ReportCardSecundaria3PDF
          student={student}
          grades={grades}
          subjects={subjects}
          settings={settings}
          cycle={cycle}
          teacherName={teacherName}
        />
      );
    }
  }

  const evalConfig = getLevelEvaluationConfig(settings, student.level);
  const scale = evalConfig.gradingScale || 'numeric_10';
  const periodCount = evalConfig.periodCount;
  const roundAverages = Boolean(evalConfig.roundAverages);
  const roundLinkedSubjects = Boolean(evalConfig.roundLinkedSubjects);
  const periodIndices = Array.from({ length: periodCount }, (_, i) => i + 1);
  const isPreescolarOrPrimaria = isObservationsLevel(student.level);

  // Level-specific logo with fallback to general school logo
  const studentLevel = student?.level?.trim();
  let rawLogo = settings?.logoUrl;
  if (studentLevel && settings?.levelLogos) {
    if (settings.levelLogos[studentLevel]) {
      rawLogo = settings.levelLogos[studentLevel];
    } else {
      const matchedKey = Object.keys(settings.levelLogos).find(
        k => k.trim().toLowerCase() === studentLevel.toLowerCase()
      );
      if (matchedKey && settings.levelLogos[matchedKey]) {
        rawLogo = settings.levelLogos[matchedKey];
      }
    }
  }

  const proxiedLogo = rawLogo && rawLogo.length > 0 
    ? (rawLogo.startsWith('data:') ? rawLogo : `/api/proxy/image?url=${encodeURIComponent(rawLogo)}`)
    : null;

  // Filter subjects for this specific student (respects grade, group, TAE enrollment and recursamiento status):
  const studentSubjects = subjects.filter(s => 
    isStudentEnrolledInSubject(s, student.id, student.grade, student.group, grades, teacherSubjectGroupsMap)
  );

  // Separate subjects into categories as requested
  const academicSubjects = studentSubjects
    .filter(s => s.category !== 'Autonomía Curricular' && s.category !== 'Aspectos Formativos' && s.category !== 'Desarrollo Personal' && s.category !== 'Recursamiento')
    .map(s => s.name);

  const recursamientoSubjects = studentSubjects
    .filter(s => s.category === 'Recursamiento')
    .map(s => s.name);

  const curricularSubjects = studentSubjects
    .filter(s => s.category === 'Autonomía Curricular')
    .map(s => s.name);

  const personalDevSubjects = studentSubjects
    .filter(s => s.category === 'Aspectos Formativos' || s.category === 'Desarrollo Personal')
    .map(s => s.name);

  const observationSubjects = [...academicSubjects, ...recursamientoSubjects];

  // Behavioral aspects mapping (conducta, uniforme, faltas)
  const behaviorMap: Record<string, 'conduct' | 'uniform' | 'attendance' | 'tasksNotDone' | 'tardies' | 'cleanliness'> = {
    'conducta': 'conduct',
    'uniforme': 'uniform',
    'inasistencia': 'attendance',
    'faltas': 'attendance',
    'tareas no realizadas': 'tasksNotDone',
    'tareas': 'tasksNotDone',
    'retardo': 'tardies',
    'retardos': 'tardies',
    'aseo': 'cleanliness'
  };

  const isAttendanceAspect = (subjName: string): boolean => {
    const subjObj = subjects.find(s => s.name?.toLowerCase().trim() === subjName.toLowerCase().trim());
    if (subjObj?.isAttendanceCount) return true;
    const norm = subjName.toLowerCase().trim();
    return ['asistencia', 'inasistencia', 'inasistencias', 'faltas', 'retardo', 'retardos'].includes(norm);
  };

  const getGrade = (subject: string, bimestre: number): string | number => {
    // If it's an academic or recursamiento subject, compute effective grade taking into account linked autonomy subjects
    const isAcademic = academicSubjects.includes(subject) || recursamientoSubjects.includes(subject);
    if (isAcademic) {
      const effective = getEffectiveSubjectGrade(subject, bimestre, grades, subjects, scale, roundAverages, roundLinkedSubjects);
      if (effective.rawValue !== '-') {
        return effective.rawValue;
      }
    }

    const bg = grades.find(g => Number(g.bimestre) === Number(bimestre));
    if (!bg) return '-';

    const isPersonalDev = personalDevSubjects.some(p => p.toLowerCase().trim() === subject.toLowerCase().trim());

    if (bg.subjects) {
      const normSubj = subject.toLowerCase().trim();
      let matchedVal = bg.subjects[subject];
      if (matchedVal === undefined || matchedVal === '') {
        for (const [k, val] of Object.entries(bg.subjects)) {
          if (k.toLowerCase().trim() === normSubj && val !== undefined && val !== '') {
            matchedVal = val;
            break;
          }
        }
      }

      if (matchedVal !== undefined && matchedVal !== '') {
        if (isPersonalDev && !isAttendanceAspect(subject)) {
          if (matchedVal === 0 || matchedVal === '0' || (!isNaN(parseFloat(String(matchedVal))) && parseFloat(String(matchedVal)) < 1)) {
            return '-';
          }
        }
        return matchedVal;
      }
    }

    const subjectObj = subjects.find(s => s.name?.toLowerCase().trim() === subject.toLowerCase().trim());
    if (subjectObj?.isAttendanceCount && bg.attendance !== undefined && bg.attendance !== null && bg.attendance !== '') {
      if (!isAttendanceIncludedInReportCard(evalConfig, student.level, Number(bimestre))) {
        return '-';
      }
      return bg.attendance;
    }

    const normKey = subject.toLowerCase().trim();
    if (behaviorMap[normKey]) {
      const field = behaviorMap[normKey];
      const val = bg[field];
      if (val !== undefined && val !== null && val !== '') {
        if (field === 'attendance' && !isAttendanceIncludedInReportCard(evalConfig, student.level, Number(bimestre))) {
          return '-';
        }
        if (!isAttendanceAspect(subject)) {
          if (val === 0 || val === '0' || (!isNaN(parseFloat(String(val))) && parseFloat(String(val)) < 1)) {
            return '-';
          }
        }
        return val as string | number;
      }
      return '-';
    }

    return '-';
  };

  const isPrepa = Boolean(student?.level && /preparatoria|bachillerato|prepa/i.test(student.level));

  const effectivePersonalDevList = (personalDevSubjects.length > 0 
    ? personalDevSubjects 
    : (isPrepa ? ['Conducta', 'Uniforme'] : ['Conducta', 'Uniforme', 'Asistencia'])
  ).filter(aspect => {
    if (isPrepa && isAttendanceAspect(aspect)) {
      return false;
    }
    return true;
  });

  const getSubjectAvg = (subject: string) => {
    if (isAttendanceAspect(subject)) {
      let total = 0;
      let count = 0;
      for (let i = 1; i <= periodCount; i++) {
        const val = getGrade(subject, i);
        if (val !== '-' && val !== '' && !isNaN(Number(val))) {
          total += Number(val);
          count++;
        }
      }
      return count > 0 ? total.toString() : '-';
    }

    let total = 0;
    let count = 0;
    for (let i = 1; i <= periodCount; i++) {
      const val = getGrade(subject, i);
      const num = gradeToNumeric(val, scale);
      if (num !== null) {
        total += num;
        count++;
      }
    }
    return formatAverage(total, count, scale, roundAverages);
  };

  // Helper to compute raw numeric average for a section in a single period
  const getSectionPeriodNumericAvg = (subjectList: string[], bimestre: number): number | null => {
    let total = 0;
    let count = 0;
    for (const subj of subjectList) {
      if (isAttendanceAspect(subj)) continue;
      const val = getGrade(subj, bimestre);
      const num = gradeToNumeric(val, scale);
      if (num !== null) {
        total += num;
        count++;
      }
    }
    return count > 0 ? (total / count) : null;
  };

  // Helper to compute raw numeric overall average for a section across all evaluated periods
  const getSectionOverallNumericAvg = (subjectList: string[]): number | null => {
    if (subjectList.length === 0) return null;
    const periodAverages: number[] = [];
    for (let i = 1; i <= periodCount; i++) {
      const pAvg = getSectionPeriodNumericAvg(subjectList, i);
      if (pAvg !== null) {
        periodAverages.push(pAvg);
      }
    }
    if (periodAverages.length === 0) return null;
    const sum = periodAverages.reduce((a, b) => a + b, 0);
    return sum / periodAverages.length;
  };

  // 1. Formación Académica
  const getAcademicPeriodAvg = (bimestre: number) => {
    const pAvg = getSectionPeriodNumericAvg(academicSubjects, bimestre);
    return pAvg !== null ? formatAverage(pAvg, 1, scale, roundAverages) : '-';
  };
  const getBimestreAvg = getAcademicPeriodAvg;

  const getAcademicOverallAvg = () => {
    const num = getSectionOverallNumericAvg(academicSubjects);
    return num !== null ? formatAverage(num, 1, scale, roundAverages) : '-';
  };

  // 2. Desarrollo Personal y Social
  const getPersonalDevPeriodAvg = (bimestre: number) => {
    const pAvg = getSectionPeriodNumericAvg(effectivePersonalDevList, bimestre);
    return pAvg !== null ? formatAverage(pAvg, 1, scale, roundAverages) : '-';
  };

  const getPersonalDevOverallAvg = () => {
    const num = getSectionOverallNumericAvg(effectivePersonalDevList);
    return num !== null ? formatAverage(num, 1, scale, roundAverages) : '-';
  };

  // 3. Autonomía Curricular
  const getCurricularPeriodAvg = (bimestre: number) => {
    if (curricularSubjects.length === 0) return '-';
    const pAvg = getSectionPeriodNumericAvg(curricularSubjects, bimestre);
    return pAvg !== null ? formatAverage(pAvg, 1, scale, roundAverages) : '-';
  };

  const getCurricularOverallAvg = () => {
    if (curricularSubjects.length === 0) return '-';
    const num = getSectionOverallNumericAvg(curricularSubjects);
    return num !== null ? formatAverage(num, 1, scale, roundAverages) : '-';
  };

  // Promedio General del Ciclo: Promedio de Formación Académica y Autonomía Curricular
  const levelLower = student.level?.toLowerCase().trim() || '';
  const isPrimariaOrPreescolar = 
    levelLower.includes('primaria') || 
    levelLower.includes('preescolar') || 
    levelLower.includes('kinder') || 
    levelLower.includes('kínder') || 
    levelLower.includes('maternal') || 
    levelLower.includes('pre-escolar') || 
    levelLower.includes('pre escolar');

  const getGlobalAvg = () => {
    const acadAvgNum = getSectionOverallNumericAvg(academicSubjects);
    const currAvgNum = curricularSubjects.length > 0 
      ? getSectionOverallNumericAvg(curricularSubjects) 
      : null;

    if (isPrimariaOrPreescolar) {
      // Must have both Formación Académica and Autonomía Curricular with grades
      if (acadAvgNum !== null && currAvgNum !== null) {
        const combined = (acadAvgNum + currAvgNum) / 2;
        return formatAverage(combined, 1, scale, roundAverages);
      }
      return '—';
    }

    // Other levels fallback (e.g. Preparatoria/Bachillerato)
    if (acadAvgNum !== null && currAvgNum !== null) {
      const combined = (acadAvgNum + currAvgNum) / 2;
      return formatAverage(combined, 1, scale, roundAverages);
    }
    if (acadAvgNum !== null) {
      return formatAverage(acadAvgNum, 1, scale, roundAverages);
    }
    return '—';
  };

  // Format student full name
  const studentFullName = [student.lastName, student.motherLastName, student.name]
    .filter(Boolean)
    .map(s => String(s).trim())
    .join(' ');

  const studentCurpMatricula = [
    student.matricula ? `MAT: ${student.matricula}` : null,
    student.curp ? `CURP: ${student.curp}` : null
  ].filter(Boolean).join(' • ') || 'N/A';

  // Resolve assigned teacher for Preescolar or Primaria from settings.groupTeachers or props
  const groupKey = `${(student.level || '').trim()}__${(student.grade || '').trim()}__${(student.group || '').trim()}`;
  let resolvedTeacherName = teacherName || student.teacherName || '';
  if (settings?.groupTeachers) {
    if (settings.groupTeachers[groupKey]) {
      const entry = settings.groupTeachers[groupKey];
      resolvedTeacherName = typeof entry === 'string' ? entry : entry.teacherName || resolvedTeacherName;
    } else {
      const normTarget = groupKey.toLowerCase();
      for (const [k, v] of Object.entries(settings.groupTeachers)) {
        if (k.toLowerCase() === normTarget) {
          resolvedTeacherName = typeof v === 'string' ? v : (v as any).teacherName || resolvedTeacherName;
          break;
        }
      }
    }
  }

  return (
    <Document>
      {/* ========================================================
          HOJA 1: REPORTE DE EVALUACIÓN (ESTRICTAMENTE 1 SOLA HOJA)
          ======================================================== */}
      <Page size="LETTER" orientation="portrait" style={styles.page}>
        {/* Institutional Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoContainer}>
            {proxiedLogo ? (
              <Image src={proxiedLogo} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder} />
            )}
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.schoolName}>
              {settings?.schoolName || 'COLEGIO MÉXICO FRANCISCANO'}
            </Text>
            <Text style={styles.schoolCct}>
              {settings?.levelCCT?.[student.level] 
                ? `C.C.T. ${settings.levelCCT[student.level]}` 
                : 'CLAVE DE CENTRO DE TRABAJO'}
            </Text>
            <Text style={styles.schoolLevelCycle}>
              NIVEL {student.level?.toUpperCase() || 'BÁSICO'} • CICLO ESCOLAR {cycle.name}
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </View>

        {/* Student Information Card */}
        <View style={styles.studentCard}>
          {/* Row 1: Nombre del Alumno & Matrícula/CURP */}
          <View style={styles.studentCardRow}>
            <View style={[styles.studentField, { flex: 3.2 }]}>
              <Text style={styles.fieldLabel}>ALUMNO(A):</Text>
              <Text style={styles.fieldValue}>{studentFullName}</Text>
            </View>
            <View style={[styles.studentFieldLast, { flex: 2 }]}>
              <Text style={styles.fieldLabel}>REGISTRO:</Text>
              <Text style={[styles.fieldValue, { fontSize: 6.5 }]}>{studentCurpMatricula}</Text>
            </View>
          </View>

          {/* Row 2: No. Lista, Grado, Grupo & Docente Asignado (Solo Preescolar y Primaria) */}
          <View style={styles.studentCardRowLast}>
            <View style={[styles.studentField, { flex: 1.1 }]}>
              <Text style={styles.fieldLabel}>NO. LISTA:</Text>
              <Text style={styles.fieldValue}>{student.listNumber || '—'}</Text>
            </View>

            <View style={[styles.studentField, { flex: 1.2 }]}>
              <Text style={styles.fieldLabel}>GRADO:</Text>
              <Text style={styles.fieldValue}>{student.grade || '—'}</Text>
            </View>

            <View style={[styles.studentField, { flex: 1.1 }]}>
              <Text style={styles.fieldLabel}>GRUPO:</Text>
              <Text style={styles.fieldValue}>"{student.group || '—'}"</Text>
            </View>

            {/* Docente asignado: SOLO para Preescolar y Primaria */}
            {isPreescolarOrPrimaria && (
              <View style={[styles.studentFieldLast, { flex: 3.2 }]}>
                <Text style={styles.fieldLabel}>DOCENTE ASIGNADO:</Text>
                <Text style={styles.fieldValue}>
                  {resolvedTeacherName ? resolvedTeacherName.toUpperCase() : '—'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ----------------------------------------------------
            SECCIÓN 1: FORMACIÓN ACADÉMICA
            ---------------------------------------------------- */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>I. FORMACIÓN ACADÉMICA</Text>
          <Text style={[styles.sectionBannerText, { fontSize: 6, color: '#CBD5E1' }]}>
            CAMPOS FORMATIVOS FUNDAMENTALES
          </Text>
        </View>
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderSubject}>Asignatura / Campo Formativo</Text>
            {periodIndices.map(num => (
              <Text key={`th-acad-${num}`} style={styles.tableHeaderPeriod}>
                {evalConfig.periodNames?.[num - 1] || `${num}º`}
              </Text>
            ))}
            <Text style={styles.tableHeaderAvg}>PROM</Text>
          </View>

          {/* Subject Rows */}
          {academicSubjects.length > 0 ? (
            academicSubjects.map((subj, idx) => (
              <View 
                key={`row-acad-${idx}`} 
                style={[styles.tableRow, idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}]}
              >
                <Text style={styles.tableCellSubject}>{String(subj || '').toUpperCase()}</Text>
                {periodIndices.map(num => (
                  <Text key={`g-${subj}-${num}`} style={styles.tableCellPeriod}>
                    {getGrade(subj, num)}
                  </Text>
                ))}
                <Text style={styles.tableCellAvg}>
                  {getSubjectAvg(subj)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyRowText}>Sin asignaturas académicas registradas</Text>
          )}

          {/* Academic Promedios Summary Row */}
          <View style={styles.tableSummaryRow}>
            <Text style={styles.tableSummaryLabel}>PROMEDIO FORMACIÓN ACADÉMICA</Text>
            {periodIndices.map(num => (
              <Text key={`avg-p-${num}`} style={styles.tableSummaryPeriod}>
                {getAcademicPeriodAvg(num)}
              </Text>
            ))}
            <View style={styles.tableSummaryAvg}>
              <Text style={{ color: '#FFFFFF', fontSize: 7.5, fontWeight: 'bold' }}>
                {getAcademicOverallAvg()}
              </Text>
            </View>
          </View>
        </View>

        {/* ----------------------------------------------------
            SECCIÓN 2: DESARROLLO PERSONAL
            ---------------------------------------------------- */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>II. DESARROLLO PERSONAL Y SOCIAL</Text>
          <Text style={[styles.sectionBannerText, { fontSize: 6, color: '#CBD5E1' }]}>
            EDUCACIÓN SOCIOEMOCIONAL, ARTES Y ASPECTOS FORMATIVOS
          </Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderSubject}>Aspecto / Criterio Formativo</Text>
            {periodIndices.map(num => (
              <Text key={`th-dev-${num}`} style={styles.tableHeaderPeriod}>
                {evalConfig.periodNames?.[num - 1] || `${num}º`}
              </Text>
            ))}
            <Text style={styles.tableHeaderAvg}>PROM</Text>
          </View>

          {effectivePersonalDevList.map((aspect, idx) => (
            <View 
              key={`row-dev-${idx}`} 
              style={[styles.tableRow, idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}]}
            >
              <Text style={styles.tableCellSubject}>{String(aspect || '').toUpperCase()}</Text>
              {periodIndices.map(num => (
                <Text key={`g-dev-${aspect}-${num}`} style={styles.tableCellPeriod}>
                  {getGrade(aspect, num)}
                </Text>
              ))}
              <Text style={styles.tableCellAvg}>
                {getSubjectAvg(aspect)}
              </Text>
            </View>
          ))}

          {/* Personal Dev Promedios Summary Row */}
          <View style={styles.tableSummaryRow}>
            <Text style={styles.tableSummaryLabel}>PROMEDIO DESARROLLO PERSONAL Y SOCIAL</Text>
            {periodIndices.map(num => (
              <Text key={`avg-dev-${num}`} style={styles.tableSummaryPeriod}>
                {getPersonalDevPeriodAvg(num)}
              </Text>
            ))}
            <View style={styles.tableSummaryAvg}>
              <Text style={{ color: '#FFFFFF', fontSize: 7.5, fontWeight: 'bold' }}>
                {getPersonalDevOverallAvg()}
              </Text>
            </View>
          </View>
        </View>

        {/* ----------------------------------------------------
            SECCIÓN 3: AUTONOMÍA CURRICULAR
            ---------------------------------------------------- */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>III. AUTONOMÍA CURRICULAR</Text>
          <Text style={[styles.sectionBannerText, { fontSize: 6, color: '#CBD5E1' }]}>
            TALLERES, IDIOMAS Y ÁREAS COMPLEMENTARIAS
          </Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderSubject}>Área de Autonomía Curricular</Text>
            {periodIndices.map(num => (
              <Text key={`th-curr-${num}`} style={styles.tableHeaderPeriod}>
                {evalConfig.periodNames?.[num - 1] || `${num}º`}
              </Text>
            ))}
            <Text style={styles.tableHeaderAvg}>PROM</Text>
          </View>

          {curricularSubjects.length > 0 ? (
            curricularSubjects.map((subj, idx) => (
              <View 
                key={`row-curr-${idx}`} 
                style={[styles.tableRow, idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}]}
              >
                <Text style={styles.tableCellSubject}>{String(subj || '').toUpperCase()}</Text>
                {periodIndices.map(num => (
                  <Text key={`g-curr-${subj}-${num}`} style={styles.tableCellPeriod}>
                    {getGrade(subj, num)}
                  </Text>
                ))}
                <Text style={styles.tableCellAvg}>
                  {getSubjectAvg(subj)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyRowText}>Sin asignaturas de autonomía curricular asignadas</Text>
          )}

          {/* Autonomía Curricular Promedios Summary Row */}
          <View style={styles.tableSummaryRow}>
            <Text style={styles.tableSummaryLabel}>PROMEDIO AUTONOMÍA CURRICULAR</Text>
            {periodIndices.map(num => (
              <Text key={`avg-curr-${num}`} style={styles.tableSummaryPeriod}>
                {getCurricularPeriodAvg(num)}
              </Text>
            ))}
            <View style={styles.tableSummaryAvg}>
              <Text style={{ color: '#FFFFFF', fontSize: 7.5, fontWeight: 'bold' }}>
                {getCurricularOverallAvg()}
              </Text>
            </View>
          </View>
        </View>

        {/* ----------------------------------------------------
            SECCIÓN 4: RECURSAMIENTO
            ---------------------------------------------------- */}
        {recursamientoSubjects.length > 0 && (
          <View wrap={false}>
            <View style={styles.sectionBanner}>
              <Text style={styles.sectionBannerText}>IV. RECURSAMIENTO</Text>
              <Text style={[styles.sectionBannerText, { fontSize: 6, color: '#CBD5E1' }]}>
                REGULARIZACIÓN Y RECUPERACIÓN ACADÉMICA
              </Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.tableHeaderSubject}>Asignatura en Recursamiento</Text>
                {periodIndices.map(num => (
                  <Text key={`th-rec-${num}`} style={styles.tableHeaderPeriod}>
                    {evalConfig.periodNames?.[num - 1] || `${num}º`}
                  </Text>
                ))}
                <Text style={styles.tableHeaderAvg}>PROM</Text>
              </View>

              {recursamientoSubjects.length > 0 ? (
                recursamientoSubjects.map((subj, idx) => (
                  <View 
                    key={`row-rec-${idx}`} 
                    style={[styles.tableRow, idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}]}
                  >
                    <Text style={styles.tableCellSubject}>{String(subj || '').toUpperCase()}</Text>
                    {periodIndices.map(num => (
                      <Text key={`g-rec-${subj}-${num}`} style={styles.tableCellPeriod}>
                        {getGrade(subj, num)}
                      </Text>
                    ))}
                    <Text style={styles.tableCellAvg}>
                      {getSubjectAvg(subj)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyRowText}>Sin asignaturas en recursamiento</Text>
              )}
            </View>
          </View>
        )}

        {/* ----------------------------------------------------
            PROMEDIO FINAL DEL CICLO & ESCALA
            ---------------------------------------------------- */}
        <View style={styles.cycleSummaryBox}>
          <View style={styles.scaleNotice}>
            {scale === 'letters' ? (
              <Text>
                <Text style={{ fontWeight: 'bold' }}>ESCALA CUALITATIVA:</Text> A: Avanzado • E: Esperado • ED: En Desarrollo • RA: Requiere Apoyo.
              </Text>
            ) : scale === 'numeric_100' ? (
              <Text>
                <Text style={{ fontWeight: 'bold' }}>ESCALA OFICIAL:</Text> Escala numérica de 0 a 100 puntos (Calificación mínima aprobatoria: 60).
              </Text>
            ) : (
              <Text>
                <Text style={{ fontWeight: 'bold' }}>ESCALA OFICIAL:</Text> Escala numérica de 5.0 a 10.0 puntos (Calificación mínima aprobatoria: 6.0).
              </Text>
            )}
          </View>

          <View style={styles.finalAvgBox}>
            <Text style={styles.finalAvgLabel}>PROMEDIO GENERAL DEL CICLO:</Text>
            <View style={styles.finalAvgValueBadge}>
              <Text style={styles.finalAvgValueText}>{getGlobalAvg()}</Text>
            </View>
          </View>
        </View>

        {/* ----------------------------------------------------
            ÁREA DE FIRMAS AL CALCE (HOJA 1)
            ---------------------------------------------------- */}
        <View style={styles.signaturesContainer}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>FIRMA DEL DOCENTE</Text>
          </View>

          <View style={styles.sealBlock}>
            <View style={styles.sealBox} />
          </View>

          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>DIRECCIÓN DE NIVEL</Text>
          </View>
        </View>
      </Page>

      {/* ========================================================
          HOJA 2: OBSERVACIONES CUALITATIVAS POR MATERIA Y PERIODO
          (SOLO DONDE EXISTAN OBSERVACIONES: PREESCOLAR Y PRIMARIA)
          ======================================================== */}
      {isPreescolarOrPrimaria && (
        <Page size="LETTER" orientation="portrait" style={styles.obsPage}>
          {/* Institutional Header */}
          <View style={styles.obsHeaderContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.logoContainer}>
                {proxiedLogo ? (
                  <Image src={proxiedLogo} style={styles.logoImage} />
                ) : (
                  <View style={styles.logoPlaceholder} />
                )}
              </View>
              <View>
                <Text style={styles.schoolName}>
                  {settings?.schoolName || 'COLEGIO MÉXICO FRANCISCANO'}
                </Text>
                <Text style={styles.schoolCct}>
                  {settings?.levelCCT?.[student.level] 
                    ? `C.C.T. ${settings.levelCCT[student.level]}` 
                    : 'CLAVE DE CENTRO DE TRABAJO'}
                </Text>
                <Text style={styles.schoolLevelCycle}>
                  NIVEL {student.level?.toUpperCase() || 'BÁSICO'} • CICLO ESCOLAR {cycle.name}
                </Text>
              </View>
            </View>

            <View style={styles.headerRightBox}>
              <Text style={styles.obsDocTitle}>OBSERVACIONES</Text>
              <Text style={styles.obsDocSubtitle}>POR PERIODO</Text>
            </View>
          </View>

          {/* Student Info Summary */}
          <View style={styles.studentCard}>
            <View style={styles.studentCardRowLast}>
              <View style={[styles.studentField, { flex: 3 }]}>
                <Text style={styles.fieldLabel}>ALUMNO(A):</Text>
                <Text style={styles.fieldValue}>{studentFullName}</Text>
              </View>
              <View style={[styles.studentField, { flex: 1.2 }]}>
                <Text style={styles.fieldLabel}>GRADO / GPO:</Text>
                <Text style={styles.fieldValue}>{student.grade || '—'} "{student.group || '—'}"</Text>
              </View>
              <View style={[styles.studentFieldLast, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>NO. LISTA:</Text>
                <Text style={styles.fieldValue}>{student.listNumber || '—'}</Text>
              </View>
            </View>
          </View>

          {/* Observations Table */}
          <View style={styles.obsTable}>
            {/* Header Row */}
            <View style={styles.obsTableHeaderRow}>
              <Text style={styles.obsTableHeaderSubject}>Materia Académica / Campo Formativo</Text>
              {periodIndices.map(num => (
                <Text 
                  key={`obs-head-${num}`} 
                  style={[styles.obsTableHeaderPeriod, { flex: 7.8 / periodCount }]}
                >
                  {evalConfig.periodNames?.[num - 1] || `${num}º Periodo`}
                </Text>
              ))}
            </View>

            {/* Rows */}
            {observationSubjects.length > 0 ? (
              observationSubjects.map((subject, idx) => (
                <View 
                  key={`obs-row-${idx}`} 
                  style={[styles.obsTableRow, idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}]}
                >
                  <View style={styles.obsTableCellSubject}>
                    <Text style={styles.obsSubjectName}>{String(subject || '').toUpperCase()}</Text>
                  </View>
                  {periodIndices.map(num => {
                    const obs = getSubjectObservation(grades, subject, num);
                    const hasObs = obs && obs.trim().length > 0;
                    return (
                      <View 
                        key={`obs-cell-${subject}-${num}`} 
                        style={[styles.obsTableCellPeriod, { flex: 7.8 / periodCount }]}
                      >
                        {hasObs ? (
                          <Text style={styles.obsText}>{obs.trim()}</Text>
                        ) : (
                          <Text style={styles.obsEmpty}>—</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))
            ) : (
              <View style={{ padding: 12, alignItems: 'center' }}>
                <Text style={styles.obsEmpty}>Sin asignaturas académicas registradas</Text>
              </View>
            )}
          </View>

          {/* Signatures on Page 2 */}
          <View style={styles.signaturesContainer}>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>FIRMA DEL DOCENTE</Text>
            </View>

            <View style={styles.sealBlock}>
              <View style={styles.sealBox} />
            </View>

            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>PADRE, MADRE O TUTOR</Text>
              <Text style={styles.signatureSub}>FIRMA DE CONFORMIDAD</Text>
            </View>
          </View>
        </Page>
      )}
    </Document>
  );
}
