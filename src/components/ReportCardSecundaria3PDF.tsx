import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject } from '../types';
import { 
  getLevelEvaluationConfig, 
  gradeToNumeric, 
  formatAverage,
  getEffectiveSubjectGrade,
  isAttendanceIncludedInReportCard
} from '../lib/evaluationUtils';

const BORDER_COLOR = '#000000';
const BORDER_WIDTH = 1;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 28,
    fontSize: 7.5,
    color: '#000000',
  },

  // Document Title
  titleContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 3,
    letterSpacing: 0.3,
  },

  // Student Info Line
  studentInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
    fontSize: 7.5,
  },
  studentInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  studentInfoLabel: {
    fontWeight: 'bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
  },
  studentInfoValue: {
    fontSize: 7.5,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    textTransform: 'uppercase',
  },

  // Tables Generic
  table: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 1,
    paddingVertical: 2,
  },
  tableCellLastCol: {
    borderRightWidth: 0,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 1,
    paddingVertical: 2,
  },
  tableCellLastRow: {
    borderBottomWidth: 0,
  },

  // Text Styles
  headerText: {
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  cellText: {
    textAlign: 'center',
  },
  cellTextBold: {
    textAlign: 'center',
    fontWeight: 'bold',
  },

  // Middle Section Layout
  middleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 10,
  },
  middleLeft: {
    width: 440,
  },
  middleRight: {
    width: 275,
    alignItems: 'flex-end',
  },

  // Promedio Final Box
  promedioBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 18,
    gap: 8,
  },
  promedioBoxLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  promedioBox: {
    width: 44,
    height: 32,
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promedioBoxValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Bottom Signatures
  signaturesWrapper: {
    alignItems: 'center',
    marginTop: 4,
  },
  signaturesContainer: {
    width: 460,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  signatureBox: {
    height: 38,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  signatureBoxLast: {
    height: 38,
    borderRightWidth: 0,
  },
  directorSealContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: 460,
    marginTop: 32,
  },
  directorBlock: {
    width: 220,
    alignItems: 'center',
    paddingTop: 24,
  },
  directorSignatureLine: {
    width: '100%',
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
    marginBottom: 4,
  },
  directorLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  sealBlock: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealBox: {
    width: 48,
    height: 44,
    borderWidth: BORDER_WIDTH,
    borderColor: '#94A3B8',
    borderStyle: 'dashed',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sealText: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#94A3B8',
    textAlign: 'center',
  },
});

export interface ReportCardSecundaria3PDFProps {
  student: Student;
  grades: StudentGrade[];
  subjects: Subject[];
  settings: AppSettings | null;
  cycle: SchoolCycle;
  teacherName?: string;
}

interface SubjectDefinition {
  displayName: string;
  matchNames: string[];
  subTitle?: string;
}

interface CampoGroup {
  name: string;
  colSpan: number;
  subjects: SubjectDefinition[];
}

export default function ReportCardSecundaria3PDF({
  student,
  grades,
  subjects,
  settings,
  cycle
}: ReportCardSecundaria3PDFProps) {
  const evalConfig = getLevelEvaluationConfig(settings, student.level);
  const scale = evalConfig.gradingScale || 'numeric_10';
  const roundAverages = Boolean(evalConfig.roundAverages);
  const roundLinkedSubjects = Boolean(evalConfig.roundLinkedSubjects);

  // Helper to normalize strings for robust fuzzy subject matching
  const norm = (str: string) => {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // 1. Definition of CAMPOS FORMATIVOS (Table 1: 10 columns)
  const camposGroups: CampoGroup[] = [
    {
      name: 'LENGUAJES',
      colSpan: 3,
      subjects: [
        {
          displayName: 'ESPAÑOL',
          matchNames: ['ESPAÑOL', 'ESPANOL', 'LENGUA MATERNA', 'LENGUA MATERNA (ESPAÑOL)']
        },
        {
          displayName: 'INGLÉS',
          matchNames: ['INGLÉS', 'INGLES', 'LENGUA EXTRANJERA (INGLÉS)', 'LENGUA EXTRANJERA (INGLES)']
        },
        {
          displayName: 'ARTES',
          matchNames: ['ARTES', 'Artes']
        }
      ]
    },
    {
      name: 'SABERES Y\nPENSAMIENTO\nCIENTÍFICO',
      colSpan: 2,
      subjects: [
        {
          displayName: 'MATEMÁTI-\nCAS',
          matchNames: ['MATEMATICAS III', 'MATEMÁTICAS III', 'MATEMATICAS', 'MATEMÁTICAS', 'MATEMATICAS 3', 'MATEMÁTICAS 3']
        },
        {
          displayName: 'QUÍMICA',
          matchNames: ['QUIMICA', 'QUÍMICA', 'CIENCIAS III (QUÍMICA)', 'CIENCIAS III (QUIMICA)', 'CIENCIAS 3']
        }
      ]
    },
    {
      name: 'ÉTICA, NATURALEZA Y\nSOCIEDAD',
      colSpan: 2,
      subjects: [
        {
          displayName: 'HISTORIA',
          matchNames: ['HISTORIA', 'HISTORIA III', 'HISTORIA 3', 'HISTORIA DE MÉXICO']
        },
        {
          displayName: 'FORMACIÓN\nCÍVICA Y ÉTICA',
          matchNames: ['FORMACION CIVICA Y ETICA', 'FORMACIÓN CÍVICA Y ÉTICA', 'FORMACION CIVICA', 'FORMACIÓN CÍVICA']
        }
      ]
    },
    {
      name: 'DE LO HUMANO A LO COMUNITARIO',
      colSpan: 2,
      subjects: [
        {
          displayName: 'EDUCACIÓN\nFÍSICA',
          matchNames: ['EDUCACIÓN FÍSICA', 'EDUCACION FISICA']
        },
        {
          displayName: 'TECNOLOGÍA',
          matchNames: ['TECNOLOGIA 3', 'TECNOLOGÍA 3', 'TECNOLOGIA', 'TECNOLOGÍA', 'TECNOLOGÍA III', 'TECNOLOGIA III']
        }
      ]
    }
  ];

  // Flattened list of 9 Campos Formativos subjects
  const allCamposSubjects: SubjectDefinition[] = camposGroups.flatMap(g => g.subjects);

  // 2. Definition of AUTONOMÍA CURRICULAR (Table 2: 7 columns)
  const autonomiaSubjects: SubjectDefinition[] = [
    {
      displayName: 'TALLERES\nARTÍSTICOS',
      matchNames: ['TALLERES ARTÍSTICOS', 'TALLERES ARTISTICOS', 'TALLER ARTISTICO', 'TALLER ARTÍSTICO', 'TALLER ARTISTICO - INGLES']
    },
    {
      displayName: 'TALLERES\nDEPORTIVOS',
      matchNames: ['TALLERES DEPORTIVOS', 'TALLERES DEPORTIVO', 'TALLER DEPORTIVO', 'TALLER VOLEIBOL', 'VOLEIBOL', 'FUTBOL', 'BASQUETBOL']
    },
    {
      displayName: 'ATENCIÓN\nPLENA',
      matchNames: ['ATENCIÓN PLENA', 'ATENCION PLENA']
    },
    {
      displayName: 'NUTRICIÓN /\nVIDA\nSALUDABLE',
      matchNames: ['NUTRICIÓN / VIDA SALUDABLE', 'NUTRICION', 'NUTRICIÓN', 'VIDA SALUDABLE']
    },
    {
      displayName: 'ESCUELA DE\nHUMANIDAD\n/ CAMINO DE\nFÉ Y VIDA',
      matchNames: ['ESCUELA DE HUMANIDAD', 'ESCUELA DE HUMANIDAD / CAMINO DE FÉ Y VIDA', 'CAMINO DE FE Y VIDA', 'CAMINO DE FÉ Y VIDA']
    },
    {
      displayName: 'INTEGRACIÓN\nCURRICULAR',
      matchNames: ['INTEGRACION CURRICULAR', 'INTEGRACIÓN CURRICULAR']
    },
    {
      displayName: 'TUTORÍA /\nEDUCACIÓN\nSOCIOEMOCIONAL',
      matchNames: ['TUTORIAS', 'TUTORÍAS', 'TUTORIA', 'TUTORÍA', 'TUTORÍA / EDUCACIÓN SOCIOEMOCIONAL', 'EDUCACIÓN SOCIOEMOCIONAL', 'EDUCACION SOCIOEMOCIONAL']
    }
  ];

  // Core grade resolution helper
  const getSubjectGrade = (matchNames: string[], bimestre: number): string | number => {
    // 1. First, check effective grade logic (which considers linked autonomy subjects)
    for (const name of matchNames) {
      const eff = getEffectiveSubjectGrade(name, bimestre, grades, subjects, scale, roundAverages, roundLinkedSubjects);
      if (eff.rawValue !== '-') {
        return eff.rawValue;
      }
    }

    // 2. Direct lookup in student's grade doc for this bimestre
    const bg = grades.find(g => Number(g.bimestre) === Number(bimestre));
    if (!bg || !bg.subjects) return '-';

    const rawSubjects = bg.subjects;

    // Check by exact or normalized key match
    for (const [key, val] of Object.entries(rawSubjects)) {
      if (val === undefined || val === null || val === '') continue;
      const normKey = norm(key);
      const isMatch = matchNames.some(m => {
        const normM = norm(m);
        return normM === normKey || m === key;
      });
      if (isMatch) {
        const strVal = String(val);
        return strVal.endsWith('.0') ? strVal.slice(0, -2) : val;
      }
    }

    // Check by matching subject document IDs
    for (const m of matchNames) {
      const matchedSubject = subjects.find(s => norm(s.name) === norm(m));
      if (matchedSubject && rawSubjects[matchedSubject.id] !== undefined && rawSubjects[matchedSubject.id] !== '') {
        const strVal = String(rawSubjects[matchedSubject.id]);
        return strVal.endsWith('.0') ? strVal.slice(0, -2) : rawSubjects[matchedSubject.id];
      }
    }

    return '-';
  };

  // Subject average across evaluated trimestres
  const getSubjectAvg = (matchNames: string[]) => {
    let total = 0;
    let count = 0;
    for (let b = 1; b <= 3; b++) {
      const val = getSubjectGrade(matchNames, b);
      const num = gradeToNumeric(val, scale);
      if (num !== null) {
        total += num;
        count++;
      }
    }
    return formatAverage(total, count, scale, roundAverages);
  };

  // Promedio Final de Grado (overall average of all Campos Formativos y Autonomía Curricular)
  const getPromedioFinalDeGrado = () => {
    const evaluatedSubjectAverages: number[] = [];
    const allEvaluationSubjects = [...allCamposSubjects, ...autonomiaSubjects];
    allEvaluationSubjects.forEach(s => {
      const avgStr = getSubjectAvg(s.matchNames);
      const num = gradeToNumeric(avgStr, scale);
      if (num !== null) {
        evaluatedSubjectAverages.push(num);
      }
    });

    if (evaluatedSubjectAverages.length === 0) return '-';
    const sum = evaluatedSubjectAverages.reduce((a, b) => a + b, 0);
    return formatAverage(sum, evaluatedSubjectAverages.length, scale, roundAverages);
  };

  // Student details
  const studentFullName = [student.name, student.lastName, student.motherLastName]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  const studentGroupDisplay = student.group ? (student.group.toUpperCase().startsWith('3') ? student.group : `3° ${student.group}`) : '3°';
  const studentMatriculaDisplay = student.matricula || student.curp || '—';

  // Table 1 column dimensions for 9 subjects (Total 736 pt width)
  const COL0_WIDTH = 106;
  const SUBJ_COL_WIDTH = 70; // 70 * 9 = 630 + 106 = 736 pt

  // Table 2 column dimensions for 7 subjects (Total 440 pt width)
  const T2_COL0_WIDTH = 76;
  const T2_SUBJ_WIDTH = 52; // 52 * 7 = 364 + 76 = 440 pt

  // Table 3 column dimensions (Total 275 pt width)
  const T3_COL0_WIDTH = 110;
  const T3_PERIOD_WIDTH = 55; // 55 * 3 = 165 + 110 = 275 pt

  // Helper to resolve development aspects (Conducta, Uniforme) checking subjects first, then legacy fields
  const getDevelopmentAspectGrade = (bg: StudentGrade | undefined, legacyField: keyof StudentGrade, matchNames: string[]): string | number => {
    if (!bg) return '-';

    // 1. Check in bg.subjects first (where teachers enter subject grades)
    if (bg.subjects) {
      for (const m of matchNames) {
        if (bg.subjects[m] !== undefined && bg.subjects[m] !== null && bg.subjects[m] !== '') {
          return bg.subjects[m];
        }
      }
      const lowerMatch = matchNames.map(m => m.toLowerCase().trim());
      for (const [k, v] of Object.entries(bg.subjects)) {
        if (lowerMatch.includes(k.toLowerCase().trim()) && v !== undefined && v !== null && v !== '') {
          return v;
        }
      }
    }

    // 2. Check in legacy root field (e.g. bg.conduct, bg.uniform)
    const legVal = bg[legacyField];
    if (legVal !== undefined && legVal !== null && legVal !== '') {
      return legVal as string | number;
    }

    return '-';
  };

  const getAttendanceAspectGrade = (bg: StudentGrade | undefined, p: number): string | number => {
    if (!isAttendanceIncludedInReportCard(evalConfig, student.level, p)) {
      return '-';
    }
    if (!bg) return 0;
    if (bg.attendance !== undefined && bg.attendance !== null && bg.attendance !== '') {
      return bg.attendance;
    }
    if (bg.subjects) {
      const matchNames = ['INASISTENCIAS', 'Inasistencias', 'FALTAS', 'Faltas', 'ASISTENCIA', 'Asistencia'];
      for (const m of matchNames) {
        if (bg.subjects[m] !== undefined && bg.subjects[m] !== null && bg.subjects[m] !== '') {
          return bg.subjects[m];
        }
      }
      for (const [k, v] of Object.entries(bg.subjects)) {
        const normKey = k.toLowerCase().trim();
        if ((normKey === 'inasistencias' || normKey === 'faltas' || normKey === 'asistencia') && v !== undefined && v !== null && v !== '') {
          return v;
        }
      }
    }
    return 0;
  };

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        
        {/* ========================================================
            HEADER: TITULO INSTITUCIONAL
            ======================================================== */}
        <View style={styles.titleContainer}>
          <Text style={styles.mainTitle}>BOLETA DE EVALUACIÓN</Text>
          <Text style={styles.subTitle}>TERCER GRADO DE EDUCACIÓN SECUNDARIA</Text>
        </View>

        {/* ========================================================
            DATOS DEL ALUMNO
            ======================================================== */}
        <View style={styles.studentInfoContainer}>
          <View style={[styles.studentInfoItem, { flex: 3.8 }]}>
            <Text style={styles.studentInfoLabel}>NOMBRE DEL ALUMNO: </Text>
            <Text style={[styles.studentInfoValue, { flex: 1 }]}>{studentFullName}</Text>
          </View>
          <View style={[styles.studentInfoItem, { flex: 1.1 }]}>
            <Text style={styles.studentInfoLabel}>GRUPO: </Text>
            <Text style={[styles.studentInfoValue, { flex: 1, textAlign: 'center' }]}>{studentGroupDisplay}</Text>
          </View>
          <View style={[styles.studentInfoItem, { flex: 1.5 }]}>
            <Text style={styles.studentInfoLabel}>MATRICULA: </Text>
            <Text style={[styles.studentInfoValue, { flex: 1, textAlign: 'center' }]}>{studentMatriculaDisplay}</Text>
          </View>
        </View>

        {/* ========================================================
            TABLA 1: CAMPOS FORMATIVOS (SUPERIOR)
            ======================================================== */}
        <View style={styles.table}>
          
          {/* Fila 1: Grupos de Campos Formativos */}
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: COL0_WIDTH, height: 26 }]}>
              <Text style={[styles.headerText, { fontSize: 7 }]}>CAMPOS FORMATIVOS</Text>
            </View>
            {camposGroups.map((group, gIdx) => {
              const isLast = gIdx === camposGroups.length - 1;
              const cellWidth = SUBJ_COL_WIDTH * group.colSpan;
              return (
                <View 
                  key={`cg-${gIdx}`} 
                  style={[
                    isLast ? styles.tableCellLastCol : styles.tableCell, 
                    { width: cellWidth, height: 26 }
                  ]}
                >
                  <Text style={[styles.headerText, { fontSize: 6.8, lineHeight: 1.15 }]}>
                    {group.name}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Fila 2: Nombres de Materias */}
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: COL0_WIDTH, height: 32 }]} />
            {allCamposSubjects.map((subj, sIdx) => {
              const isLast = sIdx === allCamposSubjects.length - 1;
              return (
                <View 
                  key={`th-subj-${sIdx}`} 
                  style={[
                    isLast ? styles.tableCellLastCol : styles.tableCell, 
                    { width: SUBJ_COL_WIDTH, height: 32 }
                  ]}
                >
                  <Text style={[styles.headerText, { fontSize: 6.2, lineHeight: 1.15 }]}>
                    {String(subj.displayName || '').toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Fila 3: TRIMESTRE 1 */}
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: COL0_WIDTH, height: 18 }]}>
              <Text style={[styles.headerText, { fontSize: 7 }]}>TRIMESTRE 1</Text>
            </View>
            {allCamposSubjects.map((subj, sIdx) => {
              const isLast = sIdx === allCamposSubjects.length - 1;
              const val = getSubjectGrade(subj.matchNames, 1);
              return (
                <View 
                  key={`g1-${sIdx}`} 
                  style={[
                    isLast ? styles.tableCellLastCol : styles.tableCell, 
                    { width: SUBJ_COL_WIDTH, height: 18 }
                  ]}
                >
                  <Text style={[styles.cellText, { fontSize: 8 }]}>{val}</Text>
                </View>
              );
            })}
          </View>

          {/* Fila 4: TRIMESTRE 2 */}
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: COL0_WIDTH, height: 18 }]}>
              <Text style={[styles.headerText, { fontSize: 7 }]}>TRIMESTRE 2</Text>
            </View>
            {allCamposSubjects.map((subj, sIdx) => {
              const isLast = sIdx === allCamposSubjects.length - 1;
              const val = getSubjectGrade(subj.matchNames, 2);
              return (
                <View 
                  key={`g2-${sIdx}`} 
                  style={[
                    isLast ? styles.tableCellLastCol : styles.tableCell, 
                    { width: SUBJ_COL_WIDTH, height: 18 }
                  ]}
                >
                  <Text style={[styles.cellText, { fontSize: 8 }]}>{val}</Text>
                </View>
              );
            })}
          </View>

          {/* Fila 5: TRIMESTRE 3 */}
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: COL0_WIDTH, height: 18 }]}>
              <Text style={[styles.headerText, { fontSize: 7 }]}>TRIMESTRE 3</Text>
            </View>
            {allCamposSubjects.map((subj, sIdx) => {
              const isLast = sIdx === allCamposSubjects.length - 1;
              const val = getSubjectGrade(subj.matchNames, 3);
              return (
                <View 
                  key={`g3-${sIdx}`} 
                  style={[
                    isLast ? styles.tableCellLastCol : styles.tableCell, 
                    { width: SUBJ_COL_WIDTH, height: 18 }
                  ]}
                >
                  <Text style={[styles.cellText, { fontSize: 8 }]}>{val}</Text>
                </View>
              );
            })}
          </View>

          {/* Fila 6: PROMEDIO FINAL */}
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, styles.tableCellLastRow, { width: COL0_WIDTH, height: 18 }]}>
              <Text style={[styles.headerText, { fontSize: 7 }]}>PROMEDIO FINAL</Text>
            </View>
            {allCamposSubjects.map((subj, sIdx) => {
              const isLast = sIdx === allCamposSubjects.length - 1;
              const avg = getSubjectAvg(subj.matchNames);
              return (
                <View 
                  key={`gavg-${sIdx}`} 
                  style={[
                    isLast ? styles.tableCellLastCol : styles.tableCell, 
                    styles.tableCellLastRow,
                    { width: SUBJ_COL_WIDTH, height: 18 }
                  ]}
                >
                  <Text style={[styles.cellTextBold, { fontSize: 8 }]}>{avg}</Text>
                </View>
              );
            })}
          </View>

        </View>

        {/* ========================================================
            SECCIÓN MEDIA: AUTONOMÍA CURRICULAR Y DESARROLLO PERSONAL
            ======================================================== */}
        <View style={styles.middleContainer}>
          
          {/* TABLA 2: AUTONOMÍA CURRICULAR (IZQUIERDA) */}
          <View style={styles.middleLeft}>
            <View style={styles.table}>
              
              {/* Encabezados de Autonomía Curricular */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: T2_COL0_WIDTH, height: 38 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.8 }]}>AUTONOMÍA{"\n"}CURRICULAR</Text>
                </View>
                {autonomiaSubjects.map((subj, idx) => {
                  const isLast = idx === autonomiaSubjects.length - 1;
                  return (
                    <View 
                      key={`th-auto-${idx}`} 
                      style={[
                        isLast ? styles.tableCellLastCol : styles.tableCell, 
                        { width: T2_SUBJ_WIDTH, height: 38 }
                      ]}
                    >
                      <Text style={[styles.headerText, { fontSize: 5.2, lineHeight: 1.15 }]}>
                        {String(subj.displayName || '').toUpperCase()}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Fila: TRIMESTRE 1 */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: T2_COL0_WIDTH, height: 16 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.5 }]}>TRIMESTRE 1</Text>
                </View>
                {autonomiaSubjects.map((subj, idx) => {
                  const isLast = idx === autonomiaSubjects.length - 1;
                  const val = getSubjectGrade(subj.matchNames, 1);
                  return (
                    <View 
                      key={`auto-g1-${idx}`} 
                      style={[
                        isLast ? styles.tableCellLastCol : styles.tableCell, 
                        { width: T2_SUBJ_WIDTH, height: 16 }
                      ]}
                    >
                      <Text style={[styles.cellText, { fontSize: 7.5 }]}>{val}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Fila: TRIMESTRE 2 */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: T2_COL0_WIDTH, height: 16 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.5 }]}>TRIMESTRE 2</Text>
                </View>
                {autonomiaSubjects.map((subj, idx) => {
                  const isLast = idx === autonomiaSubjects.length - 1;
                  const val = getSubjectGrade(subj.matchNames, 2);
                  return (
                    <View 
                      key={`auto-g2-${idx}`} 
                      style={[
                        isLast ? styles.tableCellLastCol : styles.tableCell, 
                        { width: T2_SUBJ_WIDTH, height: 16 }
                      ]}
                    >
                      <Text style={[styles.cellText, { fontSize: 7.5 }]}>{val}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Fila: TRIMESTRE 3 */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: T2_COL0_WIDTH, height: 16 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.5 }]}>TRIMESTRE 3</Text>
                </View>
                {autonomiaSubjects.map((subj, idx) => {
                  const isLast = idx === autonomiaSubjects.length - 1;
                  const val = getSubjectGrade(subj.matchNames, 3);
                  return (
                    <View 
                      key={`auto-g3-${idx}`} 
                      style={[
                        isLast ? styles.tableCellLastCol : styles.tableCell, 
                        { width: T2_SUBJ_WIDTH, height: 16 }
                      ]}
                    >
                      <Text style={[styles.cellText, { fontSize: 7.5 }]}>{val}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Fila: PROMEDIO FINAL */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, styles.tableCellLastRow, { width: T2_COL0_WIDTH, height: 16 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.5 }]}>PROMEDIO{"\n"}FINAL</Text>
                </View>
                {autonomiaSubjects.map((subj, idx) => {
                  const isLast = idx === autonomiaSubjects.length - 1;
                  const avg = getSubjectAvg(subj.matchNames);
                  return (
                    <View 
                      key={`auto-avg-${idx}`} 
                      style={[
                        isLast ? styles.tableCellLastCol : styles.tableCell, 
                        styles.tableCellLastRow,
                        { width: T2_SUBJ_WIDTH, height: 16 }
                      ]}
                    >
                      <Text style={[styles.cellTextBold, { fontSize: 7.5 }]}>{avg}</Text>
                    </View>
                  );
                })}
              </View>

            </View>
          </View>

          {/* DERECHA: TABLA 3 (DESARROLLO PERSONAL) Y PROMEDIO FINAL DE GRADO */}
          <View style={styles.middleRight}>
            
            {/* TABLA 3: DESARROLLO PERSONAL */}
            <View style={[styles.table, { width: T3_COL0_WIDTH + T3_PERIOD_WIDTH * 3 }]}>
              {/* Header */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: T3_COL0_WIDTH, height: 22 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.8 }]}>DESARROLLO{"\n"}PERSONAL</Text>
                </View>
                <View style={[styles.tableCell, { width: T3_PERIOD_WIDTH, height: 22 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.5 }]}>TRIMESTRE{"\n"}1</Text>
                </View>
                <View style={[styles.tableCell, { width: T3_PERIOD_WIDTH, height: 22 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.5 }]}>TRIMESTRE{"\n"}2</Text>
                </View>
                <View style={[styles.tableCellLastCol, { width: T3_PERIOD_WIDTH, height: 22 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.5 }]}>TRIMESTRE{"\n"}3</Text>
                </View>
              </View>

              {/* Fila: CONDUCTA */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: T3_COL0_WIDTH, height: 16 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.8 }]}>CONDUCTA</Text>
                </View>
                {[1, 2, 3].map(p => {
                  const bg = grades.find(g => Number(g.bimestre) === p);
                  const val = getDevelopmentAspectGrade(bg, 'conduct', ['CONDUCTA', 'Conducta']);
                  const isLast = p === 3;
                  return (
                    <View 
                      key={`cond-${p}`} 
                      style={[isLast ? styles.tableCellLastCol : styles.tableCell, { width: T3_PERIOD_WIDTH, height: 16 }]}
                    >
                      <Text style={[styles.cellText, { fontSize: 7.5 }]}>{val}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Fila: UNIFORME */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: T3_COL0_WIDTH, height: 16 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.8 }]}>UNIFORME</Text>
                </View>
                {[1, 2, 3].map(p => {
                  const bg = grades.find(g => Number(g.bimestre) === p);
                  const val = getDevelopmentAspectGrade(bg, 'uniform', ['UNIFORME', 'Uniforme']);
                  const isLast = p === 3;
                  return (
                    <View 
                      key={`uni-${p}`} 
                      style={[isLast ? styles.tableCellLastCol : styles.tableCell, { width: T3_PERIOD_WIDTH, height: 16 }]}
                    >
                      <Text style={[styles.cellText, { fontSize: 7.5 }]}>{val}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Fila: INASISTENCIAS */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, styles.tableCellLastRow, { width: T3_COL0_WIDTH, height: 16 }]}>
                  <Text style={[styles.headerText, { fontSize: 6.8 }]}>INASISTENCIAS</Text>
                </View>
                {[1, 2, 3].map(p => {
                  const bg = grades.find(g => Number(g.bimestre) === p);
                  const val = getAttendanceAspectGrade(bg, p);
                  const isLast = p === 3;
                  return (
                    <View 
                      key={`att-${p}`} 
                      style={[
                        isLast ? styles.tableCellLastCol : styles.tableCell, 
                        styles.tableCellLastRow, 
                        { width: T3_PERIOD_WIDTH, height: 16 }
                      ]}
                    >
                      <Text style={[styles.cellText, { fontSize: 7.5 }]}>{val}</Text>
                    </View>
                  );
                })}
              </View>

            </View>

            {/* CAJA: PROMEDIO FINAL DE GRADO */}
            <View style={styles.promedioBoxContainer}>
              <Text style={styles.promedioBoxLabel}>PROMEDIO FINAL DE GRADO:</Text>
              <View style={styles.promedioBox}>
                <Text style={styles.promedioBoxValue}>
                  {getPromedioFinalDeGrado()}
                </Text>
              </View>
            </View>

          </View>
        </View>

        {/* ========================================================
            SECCIÓN INFERIOR: FIRMA DE LA MADRE, PADRE O TUTOR
            ======================================================== */}
        <View style={styles.signaturesWrapper}>
          <View style={styles.signaturesContainer}>
            {/* Título de la tabla de firmas */}
            <View style={[styles.tableCellLastCol, { height: 16, borderBottomWidth: BORDER_WIDTH }]}>
              <Text style={[styles.headerText, { fontSize: 7.5 }]}>
                FIRMA DE LA MADRE, PADRE O TUTOR
              </Text>
            </View>

            {/* Sub-encabezados de Trimestres */}
            <View style={styles.tableRow}>
              <View style={[styles.tableCell, { width: '33.33%', height: 16 }]}>
                <Text style={[styles.headerText, { fontSize: 7 }]}>TRIMESTRE 1</Text>
              </View>
              <View style={[styles.tableCell, { width: '33.33%', height: 16 }]}>
                <Text style={[styles.headerText, { fontSize: 7 }]}>TRIMESTRE 2</Text>
              </View>
              <View style={[styles.tableCellLastCol, { width: '33.34%', height: 16 }]}>
                <Text style={[styles.headerText, { fontSize: 7 }]}>TRIMESTRE 3</Text>
              </View>
            </View>

            {/* Área vacía para firmas */}
            <View style={styles.tableRow}>
              <View style={[styles.signatureBox, { width: '33.33%' }]} />
              <View style={[styles.signatureBox, { width: '33.33%' }]} />
              <View style={[styles.signatureBoxLast, { width: '33.34%' }]} />
            </View>
          </View>

          {/* FIRMA DIRECTOR DE NIVEL Y SELLO */}
          <View style={styles.directorSealContainer}>
            <View style={styles.directorBlock}>
              <View style={styles.directorSignatureLine} />
              <Text style={styles.directorLabel}>FIRMA DEL DIRECTOR(A) DE NIVEL</Text>
            </View>
            <View style={styles.sealBlock}>
              <View style={styles.sealBox}>
                <Text style={styles.sealText}>SELLO</Text>
              </View>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  );
}

