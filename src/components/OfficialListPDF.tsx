import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Student, AppSettings } from '../types';

// ─── Palette ───────────────────────────────────────────────────────────────
const DARK = '#0F172A';
const ACCENT = '#1E3A8A'; // deep blue
const ACCENT_LIGHT = '#DBEAFE';
const GRAY = '#64748B';
const LIGHT_BG = '#F8FAFC';
const BORDER = '#CBD5E1';
const WHITE = '#FFFFFF';
const TEXT = '#1E293B';

// ─── Static Styles (Dimensions tuned for EXACT 1-PAGE fit) ─────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: WHITE,
    fontFamily: 'Helvetica',
  },

  // ── Header Box ───────────────────────────────────────────────────────────
  headerBox: {
    borderWidth: 1,
    borderColor: DARK,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 5,
  },
  headerTop: {
    backgroundColor: DARK,
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
    backgroundColor: WHITE,
    borderRadius: 2,
    padding: 1,
  },
  schoolName: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  schoolLegal: {
    fontSize: 5.5,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
    fontFamily: 'Helvetica-Bold',
  },
  headerRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 1,
  },
  contactText: {
    fontSize: 5.5,
    color: '#CBD5E1',
    textAlign: 'right',
  },

  // ── Subheader / Meta Strip ────────────────────────────────────────────────
  metaStrip: {
    backgroundColor: ACCENT,
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
    color: ACCENT_LIGHT,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 6.5,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  metaDivider: {
    color: '#60A5FA',
    fontSize: 7,
    marginHorizontal: 4,
  },

  // ── Table ─────────────────────────────────────────────────────────────────
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: DARK,
    height: 14,
    alignItems: 'center',
  },
  thNo: {
    width: 20,
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    textTransform: 'uppercase',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  thMat: {
    width: 50,
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    textTransform: 'uppercase',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  thName: {
    width: 172,
    paddingLeft: 4,
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    textTransform: 'uppercase',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  thDay: {
    flex: 1,
    fontSize: 5,
    fontFamily: 'Helvetica-Bold',
    color: '#94A3B8',
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#1E293B',
  },

  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: LIGHT_BG,
  },
  tdNo: {
    width: 20,
    fontFamily: 'Helvetica-Bold',
    color: ACCENT,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },
  tdMat: {
    width: 50,
    color: GRAY,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
    fontFamily: 'Helvetica-Bold',
  },
  tdName: {
    width: 172,
    paddingLeft: 4,
    paddingRight: 2,
    fontFamily: 'Helvetica-Bold',
    color: TEXT,
    textTransform: 'uppercase',
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },
  tdDay: {
    flex: 1,
    height: '100%',
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },

  // ── Signature Row (Fixed at bottom with ample signing space) ─────────────
  signatureRow: {
    position: 'absolute',
    bottom: 22,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 35,
    alignItems: 'flex-end',
  },
  signatureBox: {
    flex: 1,
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: DARK,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  signatureSub: {
    fontSize: 5.5,
    fontFamily: 'Helvetica',
    color: GRAY,
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 8,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 5,
    color: '#94A3B8',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pageNumber: {
    fontSize: 5,
    color: '#94A3B8',
    fontFamily: 'Helvetica-Bold',
  },
});

// ─── Props ─────────────────────────────────────────────────────────────────
export interface OfficialGroupData {
  level: string;
  grade: string;
  group: string;
  students: Student[];
  teacherName?: string;
}

interface OfficialListPDFProps {
  students?: Student[];
  settings: AppSettings | null;
  level?: string;
  grade?: string;
  group?: string;
  cycleName: string;
  teacherName?: string;
  groups?: OfficialGroupData[];
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function OfficialListPDF({
  students = [],
  settings,
  level = '',
  grade = '',
  group = '',
  cycleName,
  teacherName,
  groups,
}: OfficialListPDFProps) {
  const proxiedLogo =
    settings?.logoUrl && settings.logoUrl.length > 0
      ? `/api/proxy/image?url=${encodeURIComponent(settings.logoUrl)}`
      : null;

  const showNo = settings?.attendanceListShowNo !== false;
  const showMatricula = settings?.attendanceListShowMatricula !== false;
  const totalDayCols = Math.max(1, Math.min(31, settings?.attendanceListColumns ?? 31));
  const dayNumbers = Array.from({ length: totalDayCols }, (_, i) => i + 1);

  // Single group or list of groups
  const groupList: OfficialGroupData[] =
    groups && groups.length > 0
      ? groups
      : [{ level, grade, group, students, teacherName }];

  return (
    <Document>
      {groupList.map((grp, grpIdx) => {
        const sortedStudents = [...grp.students].sort((a, b) => {
          const na = `${a.lastName || ''} ${a.motherLastName || ''} ${a.name || ''}`.toUpperCase();
          const nb = `${b.lastName || ''} ${b.motherLastName || ''} ${b.name || ''}`.toUpperCase();
          return na.localeCompare(nb);
        });

        const count = Math.max(sortedStudents.length, 1);

        // ── Dynamic scaling so it ALWAYS strictly fits 1 page with AMPLE space for signatures ──
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
        } else if (count <= 35) {
          rowHeight = 10.2;
          fontSize = 5.8;
          padV = 1.0;
        } else if (count <= 42) {
          rowHeight = 8.8;
          fontSize = 5.2;
          padV = 0.6;
        } else {
          rowHeight = 7.8;
          fontSize = 4.8;
          padV = 0.4;
        }

        return (
          <Page
            key={`${grp.level}-${grp.grade}-${grp.group}-${grpIdx}`}
            size="LETTER"
            orientation="landscape"
            style={styles.page}
          >
            {/* ── Compact Integrated Header Box ─────────────────────────── */}
            <View style={styles.headerBox} wrap={false}>
              <View style={styles.headerTop}>
                {/* Left: Logo & School */}
                <View style={styles.headerLeft}>
                  {proxiedLogo ? (
                    <Image src={proxiedLogo} style={styles.logo} />
                  ) : (
                    <View style={[styles.logo, { backgroundColor: '#E2E8F0' }]} />
                  )}
                  <View>
                    <Text style={styles.schoolName}>{settings?.schoolName || 'Institución Educativa'}</Text>
                    <Text style={styles.schoolLegal}>
                      {[
                        settings?.legalName,
                        settings?.levelCCT?.[grp.level] ? `CCT: ${settings.levelCCT[grp.level]}` : null,
                      ]
                        .filter(Boolean)
                        .join('  •  ')}
                    </Text>
                  </View>
                </View>

                {/* Right: Contact */}
                <View style={styles.headerRight}>
                  {settings?.schoolAddress && <Text style={styles.contactText}>{settings.schoolAddress}</Text>}
                  <Text style={styles.contactText}>
                    {[
                      settings?.schoolPhone ? `Tel. ${settings.schoolPhone}` : null,
                      settings?.schoolWebsite,
                    ]
                      .filter(Boolean)
                      .join('  |  ')}
                  </Text>
                </View>
              </View>

              {/* Subheader Meta Strip */}
              <View style={styles.metaStrip}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>DOCUMENTO:</Text>
                  <Text style={[styles.metaValue, { color: '#FDE047' }]}>LISTA DE ASISTENCIA OFICIAL</Text>
                </View>

                <Text style={styles.metaDivider}>|</Text>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>NIVEL:</Text>
                  <Text style={styles.metaValue}>{grp.level}</Text>
                </View>

                <Text style={styles.metaDivider}>|</Text>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>GRADO Y GRUPO:</Text>
                  <Text style={styles.metaValue}>{grp.grade} — {grp.group}</Text>
                </View>

                <Text style={styles.metaDivider}>|</Text>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>CICLO:</Text>
                  <Text style={styles.metaValue}>{cycleName}</Text>
                </View>

                <Text style={styles.metaDivider}>|</Text>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>DOCENTE:</Text>
                  <Text style={styles.metaValue}>{grp.teacherName || '___________________________'}</Text>
                </View>

                <Text style={styles.metaDivider}>|</Text>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>ALUMNOS:</Text>
                  <Text style={[styles.metaValue, { color: '#6EE7B7' }]}>{sortedStudents.length}</Text>
                </View>
              </View>
            </View>

            {/* ── Table (Auto-scaled to fit 1 page) ──────────────────────── */}
            <View style={styles.table} wrap={false}>
              {/* Header */}
              <View style={styles.tableHead}>
                {showNo && <Text style={styles.thNo}>No.</Text>}
                {showMatricula && <Text style={styles.thMat}>Matrícula</Text>}
                <Text style={styles.thName}>Apellidos y Nombre</Text>
                {dayNumbers.map((d, i) => (
                  <Text
                    key={d}
                    style={[
                      styles.thDay,
                      i === dayNumbers.length - 1 ? { borderRightWidth: 0 } : {},
                    ]}
                  >
                    {d}
                  </Text>
                ))}
              </View>

              {/* Rows */}
              {sortedStudents.map((student, index) => {
                const fullName = `${student.lastName || ''}${student.motherLastName ? ' ' + student.motherLastName : ''}, ${student.name || ''}`.trim();
                return (
                  <View
                    key={student.id}
                    style={[
                      styles.tableRow,
                      { height: rowHeight },
                      index % 2 === 1 ? styles.tableRowEven : {},
                    ]}
                    wrap={false}
                  >
                    {showNo && (
                      <Text style={[styles.tdNo, { fontSize, paddingVertical: padV }]}>
                        {index + 1}
                      </Text>
                    )}
                    {showMatricula && (
                      <Text style={[styles.tdMat, { fontSize: fontSize * 0.9, paddingVertical: padV }]}>
                        {student.matricula || '—'}
                      </Text>
                    )}
                    <Text style={[styles.tdName, { fontSize, paddingVertical: padV }]}>
                      {fullName}
                    </Text>
                    {dayNumbers.map((d, i) => (
                      <View
                        key={d}
                        style={[
                          styles.tdDay,
                          i === dayNumbers.length - 1 ? { borderRightWidth: 0 } : {},
                        ]}
                      />
                    ))}
                  </View>
                );
              })}
            </View>

            {/* ── Signatures Row (Positioned at bottom with ample space) ──── */}
            <View style={styles.signatureRow} wrap={false}>
              <View style={styles.signatureBox}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>FIRMA DEL DOCENTE RESPONSABLE</Text>
                {grp.teacherName ? (
                  <Text style={styles.signatureSub}>{grp.teacherName}</Text>
                ) : null}
              </View>
              <View style={styles.signatureBox}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>DIRECTOR/A DE NIVEL</Text>
              </View>
              <View style={styles.signatureBox}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>SELLO INSTITUCIONAL</Text>
              </View>
            </View>

            {/* ── Compact Footer ─────────────────────────────────────────── */}
            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>
                {settings?.pdfFooter || 'Documento oficial generado por el sistema de control escolar.'}
              </Text>
              <Text
                style={styles.pageNumber}
                render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`}
                fixed
              />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
