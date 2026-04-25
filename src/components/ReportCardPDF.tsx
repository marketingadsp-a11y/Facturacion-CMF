import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject } from '../types';

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
    minHeight: 22,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 24,
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
    marginBottom: 20,
  },
  coverSchoolDetails: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  coverTitleArea: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 15,
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
    marginBottom: 30,
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
});

interface ReportCardPDFProps {
  student: Student;
  grades: StudentGrade[];
  subjects: Subject[];
  settings: AppSettings | null;
  cycle: SchoolCycle;
}

export default function ReportCardPDF({ student, grades, subjects, settings, cycle }: ReportCardPDFProps) {
  const academicSubjects = subjects
    .filter(s => s.category !== 'Extracurricular' && s.category !== 'Aspectos Formativos')
    .map(s => s.name);

  const curricularSubjects = subjects
    .filter(s => s.category === 'Extracurricular')
    .map(s => s.name);

  const formativeSubjects = subjects
    .filter(s => s.category === 'Aspectos Formativos')
    .map(s => s.name);

  const behaviorAspects = [
    'Conducta', 'Uniforme', 'Inasistencia', 'Tareas no realizadas', 'Retardo', 'Aseo'
  ];

  const getGrade = (subject: string, bimestre: number) => {
    const bg = grades.find(g => g.bimestre === bimestre);
    if (!bg) return '-';

    // Map behavior aspect labels to their dedicated fields in StudentGrade object
    const behaviorMap: Record<string, keyof StudentGrade> = {
      'Conducta': 'conduct',
      'Uniforme': 'uniform',
      'Inasistencia': 'attendance',
      'Tareas no realizadas': 'tasksNotDone',
      'Retardo': 'tardies',
      'Aseo': 'cleanliness'
    };

    if (behaviorMap[subject]) {
      const field = behaviorMap[subject];
      const val = bg[field];
      return typeof val === 'number' ? val : '-';
    }

    if (!bg.subjects) return '-';
    return bg.subjects[subject] !== undefined ? bg.subjects[subject] : '-';
  };

  const getSubjectAvg = (subject: string) => {
    let total = 0;
    let count = 0;
    for (let i = 1; i <= 5; i++) {
        const val = getGrade(subject, i);
        if (typeof val === 'number') {
            total += val;
            count++;
        }
    }
    return count > 0 ? (total / count).toFixed(1) : '-';
  };

  const getBimestreAvg = (bimestre: number) => {
    const bg = grades.find(g => g.bimestre === bimestre);
    if (!bg || !bg.subjects) return '-';
    const numericGrades = Object.entries(bg.subjects)
        .filter(([subj, val]) => (academicSubjects.includes(subj) || curricularSubjects.includes(subj)) && typeof val === 'number')
        .map(([_, val]) => val as number);
    
    if (numericGrades.length === 0) return '-';
    return (numericGrades.reduce((a,b) => a+b, 0) / numericGrades.length).toFixed(1);
  };

  const getGlobalAvg = () => {
    let total = 0;
    let count = 0;
    for (let i = 1; i <= 5; i++) {
        const val = getBimestreAvg(i);
        if (val !== '-') {
            total += parseFloat(val);
            count++;
        }
    }
    return count > 0 ? (total / count).toFixed(1) : '-';
  };

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.twoColumnContainer}>
          {/* ----- LEFT OUTER PAGE (Back Cover) ----- */}
          <View style={[styles.pane, { borderRightWidth: 1, borderRightColor: '#F1F5F9', borderRightStyle: 'dashed' }]}>
            <View style={{ flex: 1 }} />
            <View style={{ alignItems: 'center', opacity: 0.5 }}>
              {settings?.logoUrl && <Image src={settings.logoUrl} style={{ width: 40, height: 40, marginBottom: 10 }} />}
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748B' }}>{settings?.schoolName || 'Institución'}</Text>
              <Text style={{ fontSize: 8, color: '#94A3B8', marginTop: 5 }}>{settings?.pdfFooter || 'Documento oficial generado sistemáticamente.'}</Text>
            </View>
          </View>

          {/* ----- RIGHT OUTER PAGE (Front Cover) ----- */}
          <View style={styles.pane}>
            <View style={styles.paneContent}>
              <View style={styles.coverHeader}>
                <View style={{ width: 70, height: 70, justifyContent: 'center' }}>
                  {settings?.logoUrl ? (
                    <Image src={settings.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <View style={{ width: 70, height: 70, backgroundColor: '#E2E8F0', borderRadius: 8 }} />
                  )}
                </View>
                <View style={styles.coverSchoolDetails}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0F172A', marginBottom: 2 }}>{settings?.schoolName || 'COLEGIO MÉXICO'}</Text>
                  <Text style={{ fontSize: 7, color: '#475569', marginBottom: 2, textTransform: 'uppercase' }}>CLAVE CENTRO DE TRABAJO</Text>
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
                  <Text style={styles.tableCellHeaderGrade}>1º</Text>
                  <Text style={styles.tableCellHeaderGrade}>2º</Text>
                  <Text style={styles.tableCellHeaderGrade}>3º</Text>
                  <Text style={styles.tableCellHeaderGrade}>4º</Text>
                  <Text style={styles.tableCellHeaderGrade}>5º</Text>
                  <Text style={styles.tableCellHeaderAvg}>PROM</Text>
                </View>
                {academicSubjects.map((subject, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tableCellSubject}>{subject}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 1)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 2)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 3)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 4)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 5)}</Text>
                    <View style={{ flex: 1.2, backgroundColor: '#F1F5F9', height: '100%', justifyContent: 'center' }}>
                       <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getSubjectAvg(subject)}</Text>
                    </View>
                  </View>
                ))}
                
                {/* PROMEDIO ROW */}
                <View style={[styles.tableRow, { backgroundColor: '#E2E8F0', borderBottomWidth: 2, borderBottomColor: '#0F172A' }]}>
                  <Text style={[styles.tableCellSubject, { fontWeight: 'bold' }]}>PROMEDIO PARCIAL</Text>
                  <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getBimestreAvg(1)}</Text>
                  <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getBimestreAvg(2)}</Text>
                  <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getBimestreAvg(3)}</Text>
                  <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getBimestreAvg(4)}</Text>
                  <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getBimestreAvg(5)}</Text>
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
                  <Text style={styles.tableCellHeaderGrade}>1º</Text>
                  <Text style={styles.tableCellHeaderGrade}>2º</Text>
                  <Text style={styles.tableCellHeaderGrade}>3º</Text>
                  <Text style={styles.tableCellHeaderGrade}>4º</Text>
                  <Text style={styles.tableCellHeaderGrade}>5º</Text>
                  <Text style={styles.tableCellHeaderAvg}>PROM</Text>
                </View>
                {curricularSubjects.map((subject, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tableCellSubject}>{subject}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 1)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 2)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 3)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 4)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(subject, 5)}</Text>
                    <View style={{ flex: 1.2, backgroundColor: '#F1F5F9', height: '100%', justifyContent: 'center' }}>
                       <Text style={[styles.tableCellGrade, { fontWeight: 'bold', color: '#0F172A' }]}>{getSubjectAvg(subject)}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Aspectos Formativos y Conducta</Text>
              <View style={styles.table}>
                <View style={[styles.tableHeaderRow, { backgroundColor: '#475569' }]}>
                  <Text style={styles.tableCellHeaderSubject}>Aspecto</Text>
                  <Text style={styles.tableCellHeaderGrade}>1º</Text>
                  <Text style={styles.tableCellHeaderGrade}>2º</Text>
                  <Text style={styles.tableCellHeaderGrade}>3º</Text>
                  <Text style={styles.tableCellHeaderGrade}>4º</Text>
                  <Text style={styles.tableCellHeaderGrade}>5º</Text>
                </View>
                {formativeSubjects.map((aspect, idx) => (
                  <View key={`formative-${idx}`} style={styles.tableRow}>
                    <Text style={[styles.tableCellSubject, { color: '#475569' }]}>{aspect}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 1)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 2)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 3)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 4)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 5)}</Text>
                  </View>
                ))}
                {behaviorAspects.map((aspect, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tableCellSubject, { color: '#475569' }]}>{aspect}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 1)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 2)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 3)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 4)}</Text>
                    <Text style={styles.tableCellGrade}>{getGrade(aspect, 5)}</Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 'auto', marginBottom: 20 }}>
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
    </Document>
  );
}
