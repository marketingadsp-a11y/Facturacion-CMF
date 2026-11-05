import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Student, AppSettings, Subject, StudentGrade, GradingScale } from '../types';
import { isAttendanceTrackingSubject, isStudentEnrolledInSubject, isObservationsLevel } from '../lib/evaluationUtils';

// ─── Single Ink / Monochromatic Styles ──────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },

  // ── Header Box ───────────────────────────────────────────────────────────
  headerBox: {
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 5,
  },
  headerTop: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 28,
    height: 28,
    objectFit: 'contain',
    marginRight: 8,
  },
  schoolName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  schoolLegal: {
    fontSize: 5.5,
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
    fontFamily: 'Helvetica',
  },
  headerRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 1.5,
  },
  headerRightText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRightSub: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── Meta Strip ────────────────────────────────────────────────────────────
  metaStrip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaLabel: {
    fontSize: 5.5,
    color: '#555555',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 6.5,
    color: '#000000',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },

  // ── Table Container ───────────────────────────────────────────────────────
  table: {
    borderWidth: 1,
    borderColor: '#000000',
  },

  // Category Header Row
  catHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E5E5',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    alignItems: 'center',
  },
  catHeaderCell: {
    fontSize: 5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingVertical: 2,
    borderRightWidth: 0.5,
    borderRightColor: '#000000',
  },

  // Subject Header Row
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    alignItems: 'center',
  },
  thCell: {
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    paddingVertical: 3,
    paddingHorizontal: 1,
    textTransform: 'uppercase',
    borderRightWidth: 0.5,
    borderRightColor: '#000000',
  },

  // Table Body Rows
  tr: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#CCCCCC',
    alignItems: 'center',
  },
  trEven: {
    backgroundColor: '#FAFAFA',
  },
  td: {
    borderRightWidth: 0.5,
    borderRightColor: '#CCCCCC',
    textAlign: 'center',
    color: '#000000',
  },

  // ── Signature Row (Only Teacher Signature, Centered, No Names) ───────────
  signatureRow: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleSignatureBox: {
    width: 220,
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 6,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 5,
    color: '#777777',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  pageNumber: {
    fontSize: 5,
    color: '#777777',
    fontFamily: 'Helvetica-Bold',
  },
});

export interface TeacherGradesListPDFProps {
  settings: AppSettings | null;
  level: string;
  grade: string;
  group: string;
  cycleName: string;
  periodName: string;
  periodNumber: number;
  periodType: string;
  teacherName?: string;
  isSpecificTeacher?: boolean;
  gradingScale?: GradingScale;
  students: Student[];
  subjects: Subject[]; // Only subjects the teacher has access to!
  grades: Record<string, StudentGrade>; // studentId -> StudentGrade
  getAbsenceCount?: (studentId: string) => number | null;
  includeObservations?: boolean;
}

export default function TeacherGradesListPDF({
  settings,
  level = '',
  grade = '',
  group = '',
  cycleName = '',
  periodName = '',
  periodNumber = 1,
  periodType = 'Periodo',
  teacherName = '',
  isSpecificTeacher = false,
  students = [],
  subjects = [],
  grades = {},
  getAbsenceCount,
  includeObservations = true,
}: TeacherGradesListPDFProps) {
  // Sort students alphabetically by last names
  const sortedStudents = [...students].sort((a, b) => {
    const na = `${a.lastName || ''} ${a.motherLastName || ''} ${a.name || ''}`.toUpperCase().trim();
    const nb = `${b.lastName || ''} ${b.motherLastName || ''} ${b.name || ''}`.toUpperCase().trim();
    return na.localeCompare(nb);
  });

  // Filter subjects for group teacher vs specific teacher:
  // For a group teacher (titular) in Preescolar and Primaria, only Formación Académica and Desarrollo Personal are visible.
  // Autonomía Curricular is excluded because specialized teachers download their own lists for those subjects.
  const isPreescolarOrPrimaria = isObservationsLevel(level);
  let effectiveSubjects = subjects;
  if (isPreescolarOrPrimaria && !isSpecificTeacher) {
    effectiveSubjects = subjects.filter(
      s => s.category !== 'Autonomía Curricular' && s.category !== 'Recursamiento'
    );
  }

  // Group subjects by the established order:
  // 1. Académica, 2. Desarrollo Personal, 3. Autonomía Curricular, 4. Recursamiento
  const pureAcademic = effectiveSubjects.filter(s => !s.category || s.category === 'Académica');
  const personalDev = effectiveSubjects.filter(s => s.category === 'Aspectos Formativos' || s.category === 'Desarrollo Personal');
  const autonomy = effectiveSubjects.filter(s => s.category === 'Autonomía Curricular');
  const recursamiento = effectiveSubjects.filter(s => s.category === 'Recursamiento');

  const orderedSubjects = [...pureAcademic, ...personalDev, ...autonomy, ...recursamiento];

  // Level-specific or general school logo
  const studentLevel = level.trim();
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

  // Total printable width = 756 pt
  const TOTAL_PRINTABLE_WIDTH = 756;
  const colNoWidth = 22;

  // Calculate dynamic widths for student name and subject columns (No Matricula, No Promedio)
  const subjCount = Math.max(orderedSubjects.length, 1);
  let colSubjWidth = 60;
  let nameWidth = 200;

  if (subjCount === 1) {
    colSubjWidth = 160;
    nameWidth = TOTAL_PRINTABLE_WIDTH - colNoWidth - colSubjWidth; // 574 pt
  } else if (subjCount === 2) {
    colSubjWidth = 140;
    nameWidth = TOTAL_PRINTABLE_WIDTH - colNoWidth - (colSubjWidth * 2); // 454 pt
  } else if (subjCount === 3) {
    colSubjWidth = 120;
    nameWidth = TOTAL_PRINTABLE_WIDTH - colNoWidth - (colSubjWidth * 3); // 374 pt
  } else if (subjCount === 4) {
    colSubjWidth = 100;
    nameWidth = TOTAL_PRINTABLE_WIDTH - colNoWidth - (colSubjWidth * 4); // 334 pt
  } else if (subjCount <= 8) {
    colSubjWidth = Math.floor((TOTAL_PRINTABLE_WIDTH - colNoWidth - 220) / subjCount);
    nameWidth = TOTAL_PRINTABLE_WIDTH - colNoWidth - (colSubjWidth * subjCount);
  } else if (subjCount <= 12) {
    colSubjWidth = Math.floor((TOTAL_PRINTABLE_WIDTH - colNoWidth - 180) / subjCount);
    nameWidth = TOTAL_PRINTABLE_WIDTH - colNoWidth - (colSubjWidth * subjCount);
  } else {
    colSubjWidth = Math.floor((TOTAL_PRINTABLE_WIDTH - colNoWidth - 150) / subjCount);
    nameWidth = TOTAL_PRINTABLE_WIDTH - colNoWidth - (colSubjWidth * subjCount);
  }

  // Dynamic row sizing based on student count
  const count = Math.max(sortedStudents.length, 1);
  let rowHeight = 12.2;
  let fontSize = 6.4;
  let padV = 1.4;

  if (count <= 20) {
    rowHeight = 14.5;
    fontSize = 7.2;
    padV = 2.0;
  } else if (count <= 28) {
    rowHeight = 12.2;
    fontSize = 6.4;
    padV = 1.4;
  } else if (count <= 36) {
    rowHeight = 10.2;
    fontSize = 5.8;
    padV = 1.0;
  } else if (count <= 44) {
    rowHeight = 8.8;
    fontSize = 5.2;
    padV = 0.6;
  } else {
    rowHeight = 7.8;
    fontSize = 4.8;
    padV = 0.4;
  }

  // Helper to get grade value for a student in a specific subject
  const getGradeValue = (student: Student, subj: Subject): string => {
    if (!isStudentEnrolledInSubject(subj, student.id, student.grade)) {
      return '—';
    }

    const sg = grades[student.id];
    if (!sg) return '—';

    if (isAttendanceTrackingSubject(subj)) {
      if (getAbsenceCount) {
        const c = getAbsenceCount(student.id);
        if (c !== null) return String(c);
      }
      if (sg.attendance !== undefined && sg.attendance !== '') {
        return String(sg.attendance);
      }
    }

    const norm = subj.name.toLowerCase().trim();
    const legacyField = (
      norm === 'conducta' ? 'conduct' :
      norm === 'uniforme' ? 'uniform' :
      norm === 'faltas' || norm === 'falta' || norm === 'inasistencia' || norm === 'inasistencias' ? 'attendance' :
      norm === 'tareas' || norm === 'tareas no realizadas' ? 'tasksNotDone' :
      norm === 'retardo' || norm === 'retardos' ? 'tardies' :
      norm === 'aseo' ? 'cleanliness' : null
    ) as keyof StudentGrade | null;

    const raw = sg.subjects?.[subj.name] ?? (subj.id ? sg.subjects?.[subj.id] : undefined) ?? (legacyField ? sg[legacyField] : '') ?? '';
    return raw !== '' && raw !== undefined && raw !== null ? String(raw) : '—';
  };

  // Helper to extract all entered observations for a student in this period
  const getStudentObservations = (student: Student): { subjectName: string; observation: string }[] => {
    const sg = grades[student.id];
    if (!sg) return [];

    const entries: { subjectName: string; observation: string }[] = [];
    const obsMap = { ...(sg.observations || {}), ...(sg.subjectObservations || {}) };
    const processedKeys = new Set<string>();

    // 1. Process subjects in the current level/teacher list
    orderedSubjects.forEach(subj => {
      let text = obsMap[subj.name];
      let matchedKey = subj.name;
      if (!text && subj.id && obsMap[subj.id]) {
        text = obsMap[subj.id];
        matchedKey = subj.id;
      }
      if (!text) {
        const normName = subj.name.toLowerCase().trim();
        for (const [k, v] of Object.entries(obsMap)) {
          if (k.toLowerCase().trim() === normName && v) {
            text = v;
            matchedKey = k;
            break;
          }
        }
      }

      if (text && typeof text === 'string' && text.trim().length > 0) {
        entries.push({
          subjectName: subj.name,
          observation: text.trim()
        });
        processedKeys.add(matchedKey);
        processedKeys.add(subj.name);
        if (subj.id) processedKeys.add(subj.id);
      }
    });

    // 2. Any additional subject observations recorded in obsMap
    for (const [k, v] of Object.entries(obsMap)) {
      if (!processedKeys.has(k) && typeof v === 'string' && v.trim().length > 0) {
        entries.push({
          subjectName: k,
          observation: v.trim()
        });
        processedKeys.add(k);
      }
    }

    // 3. General observation if present
    if (sg.generalObservation && typeof sg.generalObservation === 'string' && sg.generalObservation.trim().length > 0) {
      entries.push({
        subjectName: 'Observación General',
        observation: sg.generalObservation.trim()
      });
    }

    return entries;
  };

  const studentsWithObservations = sortedStudents
    .map((student, idx) => ({
      studentIndex: idx + 1,
      student,
      observations: getStudentObservations(student)
    }))
    .filter(item => item.observations.length > 0);

  const formattedPeriodTitle = periodName || `${periodType} ${periodNumber}`;
  const schoolCCT = (level && settings?.levelCCT?.[level]) || '';
  const schoolLegalInfo = [
    schoolCCT ? `C.C.T. ${schoolCCT}` : null,
    settings?.legalName || null,
    settings?.schoolPhone ? `TEL: ${settings.schoolPhone}` : null,
    settings?.schoolAddress || null
  ].filter(Boolean).join(' • ') || 'SISTEMA DE CONTROL ESCOLAR';

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* ── 1. Header Box (Single Ink / Monochromatic) ────────────────── */}
        <View style={styles.headerBox} wrap={false}>
          <View style={styles.headerTop}>
            {/* Left: Logo & School */}
            <View style={styles.headerLeft}>
              {proxiedLogo ? (
                <Image src={proxiedLogo} style={styles.logo} />
              ) : null}
              <View>
                <Text style={styles.schoolName}>
                  {settings?.schoolName || 'INSTITUCIÓN EDUCATIVA'}
                </Text>
                <Text style={styles.schoolLegal}>
                  {schoolLegalInfo}
                </Text>
              </View>
            </View>

            {/* Right: Period & Cycle (No redundant title, no status tag) */}
            <View style={styles.headerRight}>
              <Text style={styles.headerRightText}>
                {formattedPeriodTitle.toUpperCase()}
              </Text>
              <Text style={styles.headerRightSub}>
                CICLO ESCOLAR {cycleName || 'ACTUAL'}
              </Text>
            </View>
          </View>

          {/* Subheader Meta Strip (No Docente item) */}
          <View style={styles.metaStrip}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>NIVEL Y GRUPO:</Text>
              <Text style={styles.metaValue}>{level} • {grade}° "{group}"</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>PERIODO EVALUADO:</Text>
              <Text style={styles.metaValue}>{formattedPeriodTitle}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>CICLO ESCOLAR:</Text>
              <Text style={styles.metaValue}>{cycleName || 'ACTUAL'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>ALUMNOS:</Text>
              <Text style={styles.metaValue}>{sortedStudents.length}</Text>
            </View>
          </View>
        </View>

        {/* ── 2. Grades Table (No Matricula, No Promedio) ───────────────── */}
        <View style={styles.table}>
          {/* Row 1: Category Groups Header */}
          <View style={styles.catHeaderRow} wrap={false}>
            <Text style={[styles.catHeaderCell, { width: colNoWidth + nameWidth }]}>
              DATOS DEL ALUMNO
            </Text>

            {pureAcademic.length > 0 && (
              <Text style={[
                styles.catHeaderCell, 
                { 
                  width: pureAcademic.length * colSubjWidth,
                  borderRightWidth: (personalDev.length > 0 || autonomy.length > 0 || recursamiento.length > 0) ? 0.5 : 0
                }
              ]}>
                I. FORMACIÓN ACADÉMICA ({pureAcademic.length})
              </Text>
            )}

            {personalDev.length > 0 && (
              <Text style={[
                styles.catHeaderCell, 
                { 
                  width: personalDev.length * colSubjWidth,
                  borderRightWidth: (autonomy.length > 0 || recursamiento.length > 0) ? 0.5 : 0
                }
              ]}>
                II. DESARROLLO PERSONAL ({personalDev.length})
              </Text>
            )}

            {autonomy.length > 0 && (
              <Text style={[
                styles.catHeaderCell, 
                { 
                  width: autonomy.length * colSubjWidth,
                  borderRightWidth: recursamiento.length > 0 ? 0.5 : 0
                }
              ]}>
                III. AUTONOMÍA CURRICULAR ({autonomy.length})
              </Text>
            )}

            {recursamiento.length > 0 && (
              <Text style={[styles.catHeaderCell, { width: recursamiento.length * colSubjWidth, borderRightWidth: 0 }]}>
                IV. RECURSAMIENTO ({recursamiento.length})
              </Text>
            )}
          </View>

          {/* Row 2: Columns & Subject Names Sub-Header */}
          <View style={styles.thRow} wrap={false}>
            <Text style={[styles.thCell, { width: colNoWidth }]}>#</Text>
            <Text style={[styles.thCell, { width: nameWidth, textAlign: 'left', paddingLeft: 6 }]}>
              NOMBRE COMPLETO DEL ALUMNO
            </Text>

            {orderedSubjects.length === 0 ? (
              <Text style={[styles.thCell, { width: colSubjWidth, borderRightWidth: 0 }]}>
                SIN MATERIAS
              </Text>
            ) : (
              orderedSubjects.map((subj, sIdx) => {
                const isLast = sIdx === orderedSubjects.length - 1;
                const maxChars = Math.max(16, Math.floor(colSubjWidth / 3.4) * 2);
                const displayName = subj.name.length > maxChars ? `${subj.name.substring(0, maxChars - 1)}.` : subj.name;
                return (
                  <Text
                    key={`th-subj-${subj.id || sIdx}`}
                    style={[
                      styles.thCell,
                      { 
                        width: colSubjWidth,
                        fontSize: orderedSubjects.length > 10 ? 4.8 : 5.5,
                        lineHeight: 1.1
                      },
                      isLast ? { borderRightWidth: 0 } : {}
                    ]}
                  >
                    {displayName}
                  </Text>
                );
              })
            )}
          </View>

          {/* Row 3+: Student Rows (Only Entered Grades, No Average, No Matricula) */}
          {sortedStudents.map((student, idx) => {
            const isEven = idx % 2 === 1;
            const fullName = `${student.lastName || ''} ${student.motherLastName || ''} ${student.name || ''}`.toUpperCase().trim();

            return (
              <View 
                key={`st-row-${student.id || idx}`}
                style={[styles.tr, isEven ? styles.trEven : {}, { minHeight: rowHeight }]}
                wrap={false}
              >
                <Text style={[styles.td, { width: colNoWidth, fontSize: fontSize * 0.9, fontFamily: 'Helvetica-Bold', paddingVertical: padV }]}>
                  {idx + 1}
                </Text>
                <Text style={[styles.td, { width: nameWidth, fontSize, fontFamily: 'Helvetica-Bold', textAlign: 'left', paddingLeft: 6, paddingRight: 2, paddingVertical: padV }]}>
                  {fullName}
                </Text>

                {/* Grade Cells for each Subject the Teacher has Access to */}
                {orderedSubjects.length === 0 ? (
                  <Text style={[styles.td, { width: colSubjWidth, fontSize, borderRightWidth: 0, paddingVertical: padV }]}>
                    —
                  </Text>
                ) : (
                  orderedSubjects.map((subj, sIdx) => {
                    const isLast = sIdx === orderedSubjects.length - 1;
                    const val = getGradeValue(student, subj);
                    const isEnrolled = isStudentEnrolledInSubject(subj, student.id, student.grade);
                    return (
                      <Text
                        key={`td-grade-${student.id}-${subj.id}`}
                        style={[
                          styles.td,
                          {
                            width: colSubjWidth,
                            fontSize,
                            fontFamily: 'Helvetica-Bold',
                            color: val === '—' || !isEnrolled ? '#777777' : '#000000',
                            paddingVertical: padV
                          },
                          isLast ? { borderRightWidth: 0 } : {}
                        ]}
                      >
                        {val}
                      </Text>
                    );
                  })
                )}
              </View>
            );
          })}
        </View>

        {/* ── 3. Single Signature: FIRMA DEL DOCENTE (Without Name) ─────── */}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.singleSignatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>FIRMA DEL DOCENTE</Text>
          </View>
        </View>

        {/* ── 4. Compact Footer ─────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {settings?.schoolName || 'CONTROL INTEGRAL ESCOLAR'} • {formattedPeriodTitle.toUpperCase()}
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`}
            fixed
          />
        </View>
      </Page>

      {/* ── 2. Observations Page (Rendered when includeObservations is true and observations exist) ── */}
      {includeObservations && studentsWithObservations.length > 0 && (
        <Page size="LETTER" orientation="landscape" style={styles.page}>
          {/* Header Box */}
          <View style={styles.headerBox} wrap={false}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                {proxiedLogo ? (
                  <Image src={proxiedLogo} style={styles.logo} />
                ) : null}
                <View>
                  <Text style={styles.schoolName}>
                    {settings?.schoolName || 'INSTITUCIÓN EDUCATIVA'}
                  </Text>
                  <Text style={styles.schoolLegal}>
                    {schoolLegalInfo}
                  </Text>
                </View>
              </View>

              <View style={styles.headerRight}>
                <Text style={styles.headerRightText}>
                  OBSERVACIONES Y RECOMENDACIONES
                </Text>
                <Text style={styles.headerRightSub}>
                  {formattedPeriodTitle.toUpperCase()} • CICLO {cycleName || 'ACTUAL'}
                </Text>
              </View>
            </View>

            {/* Meta Strip */}
            <View style={styles.metaStrip}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>NIVEL Y GRUPO:</Text>
                <Text style={styles.metaValue}>{level} • {grade}° "{group}"</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>PERIODO EVALUADO:</Text>
                <Text style={styles.metaValue}>{formattedPeriodTitle}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>ALUMNOS CON OBSERVACIONES:</Text>
                <Text style={styles.metaValue}>{studentsWithObservations.length} de {sortedStudents.length}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>DOCENTE:</Text>
                <Text style={styles.metaValue}>{teacherName || 'DOCENTE'}</Text>
              </View>
            </View>
          </View>

          {/* Observations Table */}
          <View style={styles.table}>
            {/* Table Header Row */}
            <View style={styles.thRow} wrap={false}>
              <Text style={[styles.thCell, { width: colNoWidth }]}>#</Text>
              <Text style={[styles.thCell, { width: 175, textAlign: 'left', paddingLeft: 6 }]}>
                NOMBRE COMPLETO DEL ALUMNO
              </Text>
              <Text style={[styles.thCell, { width: 140, textAlign: 'left', paddingLeft: 6 }]}>
                ASIGNATURA / ÁREA
              </Text>
              <Text style={[styles.thCell, { flex: 1, textAlign: 'left', paddingLeft: 6, borderRightWidth: 0 }]}>
                OBSERVACIONES Y RECOMENDACIONES PEDAGÓGICAS
              </Text>
            </View>

            {/* Observation Rows */}
            {studentsWithObservations.map((item, stIdx) => {
              const isEvenStudent = stIdx % 2 === 1;
              const fullName = `${item.student.lastName || ''} ${item.student.motherLastName || ''} ${item.student.name || ''}`.toUpperCase().trim();

              return item.observations.map((obs, oIdx) => {
                const isFirst = oIdx === 0;
                return (
                  <View
                    key={`obs-row-${item.student.id}-${oIdx}`}
                    style={[
                      styles.tr,
                      isEvenStudent ? styles.trEven : {},
                      isFirst && stIdx > 0 ? { borderTopWidth: 1, borderTopColor: '#000000' } : {},
                      { minHeight: 14, alignItems: 'stretch' }
                    ]}
                    wrap={false}
                  >
                    <Text style={[
                      styles.td, 
                      { 
                        width: colNoWidth, 
                        fontSize: 6, 
                        fontFamily: 'Helvetica-Bold', 
                        paddingVertical: 3 
                      }
                    ]}>
                      {isFirst ? item.studentIndex : ''}
                    </Text>
                    <Text style={[
                      styles.td, 
                      { 
                        width: 175, 
                        fontSize: 6.2, 
                        fontFamily: 'Helvetica-Bold', 
                        textAlign: 'left', 
                        paddingLeft: 6, 
                        paddingRight: 4, 
                        paddingVertical: 3 
                      }
                    ]}>
                      {isFirst ? fullName : ''}
                    </Text>
                    <Text style={[
                      styles.td, 
                      { 
                        width: 140, 
                        fontSize: 5.8, 
                        fontFamily: 'Helvetica-Bold', 
                        textAlign: 'left', 
                        paddingLeft: 6, 
                        paddingRight: 4, 
                        paddingVertical: 3,
                        color: '#111827' 
                      }
                    ]}>
                      {obs.subjectName.toUpperCase()}
                    </Text>
                    <Text style={[
                      styles.td, 
                      { 
                        flex: 1, 
                        fontSize: 6, 
                        fontFamily: 'Helvetica', 
                        textAlign: 'left', 
                        paddingLeft: 6, 
                        paddingRight: 6, 
                        paddingVertical: 3, 
                        lineHeight: 1.25, 
                        borderRightWidth: 0,
                        color: '#000000' 
                      }
                    ]}>
                      {obs.observation}
                    </Text>
                  </View>
                );
              });
            })}
          </View>

          {/* Signature */}
          <View style={styles.signatureRow} wrap={false}>
            <View style={styles.singleSignatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>FIRMA DEL DOCENTE</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>
              {settings?.schoolName || 'CONTROL INTEGRAL ESCOLAR'} • {formattedPeriodTitle.toUpperCase()} • OBSERVACIONES
            </Text>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`}
              fixed
            />
          </View>
        </Page>
      )}
    </Document>
  );
}
