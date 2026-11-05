import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject } from '../types';
import { 
  getLevelEvaluationConfig, 
  gradeToNumeric, 
  formatAverage,
  getEffectiveSubjectGrade 
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
    marginTop: 14,
    marginBottom: 16,
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
    height: 48,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  signatureBoxLast: {
    height: 48,
    borderRightWidth: 0,
  },
});

export interface ReportCardSecundaria2PDFProps {
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

export default function ReportCardSecundaria2PDF({
  student,
  grades,
  subjects,
  settings,
  cycle
}: ReportCardSecundaria2PDFProps) {
  const evalConfig = getLevelEvaluationConfig(settings, student.level);
  const scale = evalConfig.gradingScale || 'numeric_10';
  const roundAverages = Boolean(evalConfig.roundAverages);

  // Helper to normalize strings for robust fuzzy subject matching
  const norm = (str: string) => {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // 1. Definition of CAMPOS FORMATIVOS for 2° de Secundaria (Table 1: 10 columns)
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
          matchNames: ['MATEMATICAS II', 'MATEMÁTICAS II', 'MATEMATICAS 2', 'MATEMÁTICAS 2', 'MATEMATICAS', 'MATEMÁTICAS']
        },
        {
          displayName: 'FÍSICA',
          matchNames: ['FISICA', 'FÍSICA', 'CIENCIAS II (FÍSICA)', 'CIENCIAS II (FISICA)', 'CIENCIAS 2', 'CIENCIAS II']
        }
      ]
    },
    {
      name: 'ÉTICA, NATURALEZA Y\nSOCIEDAD',
      colSpan: 2,
      subjects: [
        {
          displayName: 'HISTORIA',
          matchNames: ['HISTORIA', 'HISTORIA II', 'HISTORIA 2']
        },
        {
          displayName: 'FORMACIÓN\nCÍVICA Y ÉTICA',
          matchNames: ['FORMACION CIVICA Y ETICA', 'FORMACIÓN CÍVICA Y ÉTICA', 'FORMACION CIVICA', 'FORMACIÓN CÍVICA']
        }
      ]
    },
    {
      name: 'DE LO HUMANO A LO COMUNITARIO',
      colSpan: 3,
      subjects: [
        {
          displayName: 'EDUCACIÓN\nFÍSICA',
          matchNames: ['EDUCACIÓN FÍSICA', 'EDUCACION FISICA']
        },
        {
          displayName: 'TECNOLOGÍA',
          matchNames: ['TECNOLOGIA 2', 'TECNOLOGÍA 2', 'TECNOLOGIA II', 'TECNOLOGÍA II', 'TECNOLOGIA', 'TECNOLOGÍA']
        },
        {
          displayName: 'TUTORÍA /\nEDUCACIÓN\nSOCIOEMOCIONAL',
          matchNames: ['TUTORIAS', 'TUTORÍAS', 'TUTORIA', 'TUTORÍA', 'TUTORÍA / EDUCACIÓN SOCIOEMOCIONAL', 'EDUCACIÓN SOCIOEMOCIONAL', 'EDUCACION SOCIOEMOCIONAL']
        }
      ]
    }
  ];

  // Flattened list of 10 Campos Formativos subjects
  const allCamposSubjects: SubjectDefinition[] = camposGroups.flatMap(g => g.subjects);

  // 2. Definition of AUTONOMÍA CURRICULAR (Table 2: 6 columns)
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
    }
  ];

  // Core grade resolution helper
  const getSubjectGrade = (matchNames: string[], bimestre: number): string | number => {
    // 1. First, check effective grade logic (which considers linked autonomy subjects)
    for (const name of matchNames) {
      const eff = getEffectiveSubjectGrade(name, bimestre, grades, subjects, scale, roundAverages);
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
        return val;
      }
    }

    // Check by matching subject document IDs
    for (const m of matchNames) {
      const matchedSubject = subjects.find(s => norm(s.name) === norm(m));
      if (matchedSubject && rawSubjects[matchedSubject.id] !== undefined && rawSubjects[matchedSubject.id] !== '') {
        return rawSubjects[matchedSubject.id];
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

  const studentGroupDisplay = student.group ? (student.group.toUpperCase().startsWith('2') ? student.group : `2° ${student.group}`) : '2°';
  const studentMatriculaDisplay = student.matricula || student.curp || '—';

  // Table 1 column dimensions (Total 736 pt width)
  const COL0_WIDTH = 106;
  const SUBJ_COL_WIDTH = 63; // 63 * 10 = 630 + 106 = 736 pt

  // Table 2 column dimensions (Total 436 pt width)
  const T2_COL0_WIDTH = 88;
  const T2_SUBJ_WIDTH = 58; // 58 * 6 = 348 + 88 = 436 pt

  // Table 3 column dimensions (Total 275 pt width)
  const T3_COL0_WIDTH = 110;
  const T3_PERIOD_WIDTH = 55; // 55 * 3 = 165 + 110 = 275 pt

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        
        {/* ========================================================
            HEADER: TITULO INSTITUCIONAL
            ======================================================== */}
        <View style={styles.titleContainer}>
          <Text style={styles.mainTitle}>BOLETA DE EVALUACIÓN</Text>
          <Text style={styles.subTitle}>SEGUNDO GRADO DE EDUCACIÓN SECUNDARIA</Text>
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
                      <Text style={[styles.headerText, { fontSize: 5.6, lineHeight: 1.15 }]}>
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
                  const val = bg?.conduct !== undefined && bg?.conduct !== null && bg?.conduct !== '' ? bg.conduct : '-';
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
                  const val = bg?.uniform !== undefined && bg?.uniform !== null && bg?.uniform !== '' ? bg.uniform : '-';
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
                  const val = bg?.attendance !== undefined && bg?.attendance !== null && bg?.attendance !== '' ? bg.attendance : 0;
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
        </View>

      </Page>
    </Document>
  );
}

