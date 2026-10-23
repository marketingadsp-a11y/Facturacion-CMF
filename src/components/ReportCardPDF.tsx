import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject } from '../types';
import { getLevelEvaluationConfig, gradeToNumeric, formatAverage, getEffectiveSubjectGrade, isObservationsLevel, getSubjectObservation } from '../lib/evaluationUtils';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  twoColumnContainer: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  pane: {
    width: '50%',
    height: '100%',
    padding: 35,
    justifyContent: 'space-between',
  },
  paneContent: {
    flex: 1,
  },
  // Table Styles
  table: {
    width: '100%',
    marginBottom: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
    minHeight: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 22,
    alignItems: 'center',
  },
  tableCellSubject: {
    flex: 3,
    paddingLeft: 8,
    fontSize: 9,
    color: '#0F172A',
    fontWeight: 'bold',
  },
  tableCellHeaderSubject: {
    flex: 3,
    paddingLeft: 8,
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tableCellGrade: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    color: '#334155',
  },
  tableCellHeaderGrade: {
    flex: 1,
    textAlign: 'center',
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  tableCellHeaderAvg: {
    flex: 1.2,
    textAlign: 'center',
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Typography
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    backgroundColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 5,
    textTransform: 'uppercase',
    color: '#0F172A',
    borderRadius: 2,
  },
  // Cover Styles
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  coverSchoolDetails: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  coverTitleArea: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#0F172A',
  },
  coverTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 1,
  },
  coverSubtitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
  },
  coverStudentArea: {
    marginBottom: 20,
  },
  coverStudentSubtitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#64748B',
  },
  // Lines
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  lineLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  lineValueContainer: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    marginLeft: 5,
  },
  lineValue: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingBottom: 2,
    textTransform: 'uppercase',
  },
  signatureArea: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 'auto',
    paddingTop: 20,
  },
  signatureCol: {
    width: '45%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    marginBottom: 6,
  },
  signatureText: {
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#334155',
  },
  // Observations Page Styles
  obsPage: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 30,
    paddingVertical: 25,
    justifyContent: 'space-between',
  },
  obsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0F172A',
  },
  obsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  obsSchoolInfo: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  obsSchoolName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  obsSchoolCct: {
    fontSize: 7,
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  obsLevelBadge: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 1,
  },
  obsHeaderRight: {
    alignItems: 'flex-end',
  },
  obsHeaderTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  obsHeaderSubtitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    marginTop: 2,
  },
  obsStudentBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  obsStudentItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  obsStudentLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#64748B',
    marginRight: 4,
  },
  obsStudentValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  obsTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  obsTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    minHeight: 20,
  },
  obsTableHeaderCellSubject: {
    flex: 2.2,
    paddingLeft: 8,
    fontSize: 7.5,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  obsTableHeaderCellPeriod: {
    textAlign: 'center',
    fontSize: 7.5,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    borderLeftWidth: 1,
    borderLeftColor: '#334155',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  obsTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 34,
    alignItems: 'stretch',
  },
  obsTableCellSubject: {
    flex: 2.2,
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'center',
  },
  obsSubjectName: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  obsTableCellPeriod: {
    padding: 5,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  obsPeriodText: {
    fontSize: 7,
    color: '#334155',
    lineHeight: 1.25,
  },
  obsPeriodEmpty: {
    fontSize: 6.5,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  obsSignatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 8,
  },
  obsFooterNotice: {
    fontSize: 6.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
});

interface ReportCardPDFProps {
  student: Student;
  grades: StudentGrade[];
  subjects: Subject[];
  settings: AppSettings | null;
  cycle: SchoolCycle;
}

export default function ReportCardPDF({ student, grades, subjects, settings, cycle }: ReportCardPDFProps) {
  const evalConfig = getLevelEvaluationConfig(settings, student.level);
  const scale = evalConfig.gradingScale || 'numeric_10';
  const periodCount = evalConfig.periodCount;
  const periodIndices = Array.from({ length: periodCount }, (_, i) => i + 1);

  const proxiedLogo = settings?.logoUrl && settings.logoUrl.length > 0 
    ? `/api/proxy/image?url=${encodeURIComponent(settings.logoUrl)}`
    : null;

  const academicSubjects = subjects
    .filter(s => s.category !== 'Autonomía Curricular' && s.category !== 'Aspectos Formativos' && s.category !== 'Desarrollo Personal')
    .map(s => s.name);

  const curricularSubjects = subjects
    .filter(s => s.category === 'Autonomía Curricular')
    .map(s => s.name);

  const personalDevSubjects = subjects
    .filter(s => s.category === 'Aspectos Formativos' || s.category === 'Desarrollo Personal')
    .map(s => s.name);

  const getGrade = (subject: string, bimestre: number): string | number => {
    // If it's an academic subject, compute effective grade taking into account linked autonomy subjects
    const isAcademic = academicSubjects.includes(subject);
    if (isAcademic) {
      const effective = getEffectiveSubjectGrade(subject, bimestre, grades, subjects, scale);
      if (effective.rawValue !== '-') {
        return effective.rawValue;
      }
    }

    const bg = grades.find(g => Number(g.bimestre) === Number(bimestre));
    if (!bg) return '-';

    // First check in subjects dictionary
    if (bg.subjects && bg.subjects[subject] !== undefined && bg.subjects[subject] !== '') {
      return bg.subjects[subject];
    }

    const subjectObj = subjects.find(s => s.name === subject);
    if (subjectObj?.isAttendanceCount && bg.attendance !== undefined && bg.attendance !== null && bg.attendance !== '') {
      return bg.attendance;
    }

    // Map behavior aspect labels to their dedicated fields in StudentGrade object
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

    const normKey = subject.toLowerCase().trim();
    if (behaviorMap[normKey]) {
      const field = behaviorMap[normKey];
      const val = bg[field];
      if (val !== undefined && val !== null && val !== '') {
        return val as string | number;
      }
      return '-';
    }

    return '-';
  };

  const getSubjectAvg = (subject: string) => {
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
    return formatAverage(total, count, scale);
  };

  const getBimestreAvg = (bimestre: number) => {
    let total = 0;
    let count = 0;
    for (const subj of academicSubjects) {
      const val = getGrade(subj, bimestre);
      const num = gradeToNumeric(val, scale);
      if (num !== null) {
        total += num;
        count++;
      }
    }

    return formatAverage(total, count, scale);
  };

  const getGlobalAvg = () => {
    const periodAverages: number[] = [];
    for (let i = 1; i <= periodCount; i++) {
      let pTotal = 0;
      let pCount = 0;
      for (const subj of academicSubjects) {
        const val = getGrade(subj, i);
        const num = gradeToNumeric(val, scale);
        if (num !== null) {
          pTotal += num;
          pCount++;
        }
      }
      if (pCount > 0) {
        periodAverages.push(pTotal / pCount);
      }
    }

    if (periodAverages.length === 0) return '-';
    const sum = periodAverages.reduce((a, b) => a + b, 0);
    return formatAverage(sum, periodAverages.length, scale);
  };

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.twoColumnContainer}>
          {/* ----- LEFT OUTER PAGE (Back Cover) ----- */}
          <View style={[styles.pane, { borderRightWidth: 1, borderRightColor: '#F1F5F9', borderRightStyle: 'dashed' }]}>
            <View style={{ flex: 1 }} />
            <View style={{ alignItems: 'center', opacity: 0.5 }}>
              {proxiedLogo && (
                <Image 
                  src={proxiedLogo} 
                  style={{ width: 40, height: 40, marginBottom: 10 }} 
                />
              )}
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748B' }}>{settings?.schoolName || 'Institución'}</Text>
              <Text style={{ fontSize: 8, color: '#94A3B8', marginTop: 5 }}>{settings?.pdfFooter || 'Documento oficial generado sistemáticamente.'}</Text>
            </View>
          </View>

          {/* ----- RIGHT OUTER PAGE (Front Cover) ----- */}
          <View style={styles.pane}>
            <View style={styles.paneContent}>
              <View style={styles.coverHeader}>
                <View style={{ width: 70, height: 70, justifyContent: 'center' }}>
                  {proxiedLogo ? (
                    <Image 
                      src={proxiedLogo} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  ) : (
                    <View style={{ width: 70, height: 70, backgroundColor: '#E2E8F0', borderRadius: 8 }} />
                  )}
                </View>
                <View style={styles.coverSchoolDetails}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0F172A', marginBottom: 2 }}>{settings?.schoolName || 'COLEGIO MÉXICO'}</Text>
                  <Text style={{ fontSize: 7, color: '#475569', marginBottom: 2, textTransform: 'uppercase' }}>
                    {settings?.levelCCT?.[student.level] || 'CLAVE CENTRO DE TRABAJO'}
                  </Text>
                  <Text style={{ fontSize: 9, color: '#0F172A', fontWeight: 'bold' }}>NIVEL DE {student.level?.toUpperCase() || 'ESTUDIOS'}</Text>
                </View>
              </View>

              <View style={styles.coverTitleArea}>
                <Text style={styles.coverTitle}>REPORTE DE EVALUACIÓN</Text>
                <Text style={styles.coverSubtitle}>CICLO ESCOLAR {cycle.name}</Text>
              </View>

              <View style={styles.coverStudentArea}>
                <Text style={styles.coverStudentSubtitle}>DATOS DEL ALUMNO:</Text>
                
                <View style={styles.lineRow}>
                  <View style={styles.lineValueContainer}>
                    <Text style={[styles.lineValue, { fontSize: 12 }]}>{student.lastName} {student.name}</Text>
                  </View>
                </View>

                <View style={styles.lineRow}>
                  <Text style={styles.lineLabel}>No. DE LISTA:</Text>
                  <View style={[styles.lineValueContainer, { flex: 0.3 }]} />
                  <Text style={[styles.lineLabel, { marginLeft: 15 }]}>GRADO:</Text>
                  <View style={[styles.lineValueContainer, { flex: 0.3 }]}>
                    <Text style={[styles.lineValue, { fontSize: 10 }]}>{student.grade || ' '}</Text>
                  </View>
                  <Text style={[styles.lineLabel, { marginLeft: 15 }]}>GRUPO:</Text>
                  <View style={[styles.lineValueContainer, { flex: 0.3 }]}>
                    <Text style={[styles.lineValue, { fontSize: 10 }]}>{student.group || ' '}</Text>
                  </View>
                </View>

                <View style={styles.lineRow}>
                  <Text style={styles.lineLabel}>PROFR(A):</Text>
                  <View style={styles.lineValueContainer} />
                </View>
              </View>

              <View style={styles.signatureArea}>
                <View style={styles.signatureCol}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureText}>DIRECTOR(A) GENERAL</Text>
                </View>
                <View style={styles.signatureCol}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureText}>DIRECTOR(A) DE {student.level?.toUpperCase() || 'NIVEL'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Page>

      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.twoColumnContainer}>
          {/* ----- LEFT INNER PAGE (Grades Part 1) ----- */}
          <View style={[styles.pane, { borderRightWidth: 1, borderRightColor: '#F1F5F9', borderRightStyle: 'dashed', paddingRight: 20 }]}>
            <View style={styles.paneContent}>
              <Text style={styles.sectionTitle}>Formación Académica</Text>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.tableCellHeaderSubject}>Asignatura</Text>
                  {periodIndices.map(num => (
                    <Text key={num} style={styles.tableCellHeaderGrade}>{num}º</Text>
                  ))}
                  <Text style={styles.tableCellHeaderAvg}>PROM</Text>
                </View>
                {academicSubjects.map((subject, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tableCellSubject}>{subject}</Text>
                    {periodIndices.map(num => (
                      <Text key={num} style={styles.tableCellGrade}>{getGrade(subject, num)}</Text>
                    ))}
                    <View style={{ flex: 1.2, backgroundColor: '#F1F5F9', height: '100%', justifyContent: 'center' }}>
                       <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getSubjectAvg(subject)}</Text>
                    </View>
                  </View>
                ))}
                
                {/* PROMEDIO ROW */}
                <View style={[styles.tableRow, { backgroundColor: '#E2E8F0', borderBottomWidth: 2, borderBottomColor: '#0F172A' }]}>
                  <Text style={[styles.tableCellSubject, { fontWeight: 'bold' }]}>PROMEDIO PARCIAL</Text>
                  {periodIndices.map(num => (
                    <Text key={num} style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getBimestreAvg(num)}</Text>
                  ))}
                  <View style={{ flex: 1.2, backgroundColor: '#0F172A', height: '100%', justifyContent: 'center' }}>
                     <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#FFFFFF' }]}>{getGlobalAvg()}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ----- RIGHT INNER PAGE (Grades Part 2 & Behavior) ----- */}
          <View style={[styles.pane, { paddingLeft: 20 }]}>
            <View style={styles.paneContent}>
              
              <Text style={styles.sectionTitle}>Autonomía Curricular</Text>
              <View style={[styles.table, { marginBottom: 15 }]}>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.tableCellHeaderSubject}>Taller / Club</Text>
                  {periodIndices.map(num => (
                    <Text key={num} style={styles.tableCellHeaderGrade}>{num}º</Text>
                  ))}
                  <Text style={styles.tableCellHeaderAvg}>PROM</Text>
                </View>
                {curricularSubjects.map((subject, idx) => {
                  const subjObj = subjects.find(s => s.name === subject);
                  const linkedTo = subjObj?.linkedSubjectName;
                  return (
                    <View key={idx} style={styles.tableRow}>
                      <View style={{ flex: 3.5, justifyContent: 'center' }}>
                        <Text style={styles.tableCellSubject}>{subject}</Text>
                        {linkedTo && (
                          <Text style={{ fontSize: 6, color: '#64748B', fontStyle: 'italic', paddingLeft: 8 }}>
                            (Suma al promedio de: {linkedTo})
                          </Text>
                        )}
                      </View>
                      {periodIndices.map(num => (
                        <Text key={num} style={styles.tableCellGrade}>{getGrade(subject, num)}</Text>
                      ))}
                      <View style={{ flex: 1.2, backgroundColor: '#F1F5F9', height: '100%', justifyContent: 'center' }}>
                         <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getSubjectAvg(subject)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {personalDevSubjects.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Desarrollo Personal</Text>
                  <View style={styles.table}>
                    <View style={[styles.tableHeaderRow, { backgroundColor: '#475569' }]}>
                      <Text style={styles.tableCellHeaderSubject}>Aspecto / Materia</Text>
                      {periodIndices.map(num => (
                        <Text key={num} style={styles.tableCellHeaderGrade}>{num}º</Text>
                      ))}
                    </View>
                    {personalDevSubjects.map((aspect, idx) => (
                      <View key={`dev-${idx}`} style={styles.tableRow}>
                        <Text style={[styles.tableCellSubject, { color: '#475569' }]}>{aspect}</Text>
                        {periodIndices.map(num => (
                          <Text key={num} style={styles.tableCellGrade}>{getGrade(aspect, num)}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </>
              )}

              <View style={{ marginTop: 'auto', marginBottom: 20 }}>
                 {scale === 'letters' ? (
                   <View style={{ marginBottom: 8, padding: 6, backgroundColor: '#F0FDF4', borderRadius: 4, borderWidth: 1, borderColor: '#DCFCE7' }}>
                     <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#166534', marginBottom: 2 }}>ESCALA DE EVALUACIÓN CUALITATIVA (PREESCOLAR):</Text>
                     <Text style={{ fontSize: 6.5, color: '#15803D' }}>
                       A: Destacado / Excelente  •  B: Satisfactorio / Bueno  •  C: Suficiente / En Proceso  •  D: Insuficiente / Requiere Apoyo
                     </Text>
                   </View>
                 ) : scale === 'numeric_100' ? (
                   <View style={{ marginBottom: 8, padding: 4, backgroundColor: '#FAF5FF', borderRadius: 4, borderWidth: 1, borderColor: '#F3E8FF', alignItems: 'center' }}>
                     <Text style={{ fontSize: 6.5, color: '#6B21A8', fontWeight: 'bold' }}>
                       ESCALA DE EVALUACIÓN: 0 A 100 PUNTOS (MÍNIMO APROBATORIO: 60)
                     </Text>
                   </View>
                 ) : (
                   <View style={{ marginBottom: 8, padding: 4, backgroundColor: '#F8FAFC', borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                     <Text style={{ fontSize: 6.5, color: '#475569', fontWeight: 'bold' }}>
                       ESCALA DE EVALUACIÓN: 0.0 A 10.0 PUNTOS (MÍNIMO APROBATORIO: 6.0)
                     </Text>
                   </View>
                 )}

                 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                   <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569', marginRight: 10 }}>PROMEDIO FINAL DEL CICLO:</Text>
                   <View style={{ backgroundColor: '#0F172A', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }}>
                     <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' }}>{getGlobalAvg()}</Text>
                   </View>
                 </View>
              </View>
              
            </View>
          </View>

        </View>
      </Page>

      {/* ----- PAGE 3: HOJA DE OBSERVACIONES POR MATERIA (PREESCOLAR Y PRIMARIA) ----- */}
      {isObservationsLevel(student.level) && (
        <Page size="LETTER" orientation="landscape" style={styles.obsPage}>
          <View>
            {/* Header */}
            <View style={styles.obsHeader}>
              <View style={styles.obsHeaderLeft}>
                <View style={{ width: 44, height: 44, justifyContent: 'center' }}>
                  {proxiedLogo ? (
                    <Image 
                      src={proxiedLogo} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  ) : (
                    <View style={{ width: 44, height: 44, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                  )}
                </View>
                <View style={styles.obsSchoolInfo}>
                  <Text style={styles.obsSchoolName}>{settings?.schoolName || 'COLEGIO MÉXICO'}</Text>
                  <Text style={styles.obsSchoolCct}>
                    {settings?.levelCCT?.[student.level] || 'CLAVE CENTRO DE TRABAJO'}
                  </Text>
                  <Text style={styles.obsLevelBadge}>NIVEL DE {student.level?.toUpperCase() || 'ESTUDIOS'}</Text>
                </View>
              </View>

              <View style={styles.obsHeaderRight}>
                <Text style={styles.obsHeaderTitle}>OBSERVACIONES Y RECOMENDACIONES</Text>
                <Text style={styles.obsHeaderSubtitle}>CICLO ESCOLAR {cycle.name}</Text>
              </View>
            </View>

            {/* Student Info Banner */}
            <View style={styles.obsStudentBanner}>
              <View style={styles.obsStudentItem}>
                <Text style={styles.obsStudentLabel}>ALUMNO:</Text>
                <Text style={styles.obsStudentValue}>{student.lastName} {student.name}</Text>
              </View>
              <View style={styles.obsStudentItem}>
                <Text style={styles.obsStudentLabel}>GRADO Y GRUPO:</Text>
                <Text style={styles.obsStudentValue}>{student.grade || '-'} {student.group || ''}</Text>
              </View>
              <View style={styles.obsStudentItem}>
                <Text style={styles.obsStudentLabel}>CURP:</Text>
                <Text style={styles.obsStudentValue}>{student.curp || 'N/A'}</Text>
              </View>
              <View style={styles.obsStudentItem}>
                <Text style={styles.obsStudentLabel}>MATRÍCULA:</Text>
                <Text style={styles.obsStudentValue}>{student.matricula || 'N/A'}</Text>
              </View>
            </View>

            {/* Observations Table */}
            <View style={styles.obsTable}>
              {/* Header */}
              <View style={styles.obsTableHeaderRow}>
                <Text style={styles.obsTableHeaderCellSubject}>Materia Académica / Campo Formativo</Text>
                {periodIndices.map(num => (
                  <Text 
                    key={`obs-head-${num}`} 
                    style={[styles.obsTableHeaderCellPeriod, { flex: 7.8 / periodCount }]}
                  >
                    {evalConfig.periodNames?.[num - 1] || `${num}º Periodo`}
                  </Text>
                ))}
              </View>

              {/* Rows */}
              {academicSubjects.length > 0 ? (
                academicSubjects.map((subject, idx) => (
                  <View 
                    key={`obs-row-${idx}`} 
                    style={[styles.obsTableRow, idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}]}
                  >
                    <View style={styles.obsTableCellSubject}>
                      <Text style={styles.obsSubjectName}>{subject}</Text>
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
                            <Text style={styles.obsPeriodText}>{obs.trim()}</Text>
                          ) : (
                            <Text style={styles.obsPeriodEmpty}>—</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))
              ) : (
                <View style={{ padding: 15, alignItems: 'center' }}>
                  <Text style={styles.obsPeriodEmpty}>No hay materias académicas configuradas para este nivel.</Text>
                </View>
              )}
            </View>
          </View>

          {/* Signatures & Footer */}
          <View>
            <View style={styles.obsSignatures}>
              <View style={styles.signatureCol}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureText}>DOCENTE TITULAR / MAESTRO(A) DE GRUPO</Text>
              </View>
              <View style={styles.signatureCol}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureText}>DIRECTOR(A) DE {student.level?.toUpperCase() || 'NIVEL'}</Text>
              </View>
            </View>

            <Text style={styles.obsFooterNotice}>
              {settings?.pdfFooter || 'Documento oficial generado sistemáticamente.'}
            </Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
