import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Student, AppSettings } from '../types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#0F172A',
    paddingBottom: 15,
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  schoolInfo: {
    flex: 1,
    marginLeft: 15,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  schoolSubtitle: {
    fontSize: 8,
    color: '#64748B',
    fontWeight: 700,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listTitle: {
    alignItems: 'center',
    marginBottom: 20,
  },
  titleMain: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  titleSub: {
    fontSize: 9,
    color: '#475569',
    marginTop: 4,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  tableHeaderCell: {
    padding: 8,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowEven: {
    backgroundColor: '#F8FAFC',
  },
  tableCell: {
    padding: 8,
    fontSize: 9,
    color: '#334155',
  },
  colNo: { width: '8%', textAlign: 'center', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  colName: { width: '60%', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  colCurp: { width: '32%' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    color: '#94A3B8',
    fontWeight: 700,
  },
  pageNumber: {
    fontSize: 7,
    color: '#94A3B8',
  }
});

interface OfficialListPDFProps {
  students: Student[];
  settings: AppSettings | null;
  level: string;
  grade: string;
  group: string;
  cycleName: string;
}

export default function OfficialListPDF({ students, settings, level, grade, group, cycleName }: OfficialListPDFProps) {
  const proxiedLogo = settings?.logoUrl && settings.logoUrl.length > 0 
    ? `/api/proxy/image?url=${encodeURIComponent(settings.logoUrl)}`
    : null;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {proxiedLogo ? (
              <Image src={proxiedLogo} style={styles.logo} />
            ) : (
              <View style={[styles.logo, { backgroundColor: '#F1F5F9', borderRadius: 4 }]} />
            )}
            <View style={styles.schoolInfo}>
              <Text style={styles.schoolName}>{settings?.schoolName || 'INSTITUCIÓN EDUCATIVA'}</Text>
              <Text style={styles.schoolSubtitle}>
                {settings?.levelCCT?.[level] ? `CCT: ${settings.levelCCT[level]}` : 'CONTROL ESCOLAR'}
              </Text>
            </View>
          </View>
        </View>

        {/* Title */}
        <View style={styles.listTitle}>
          <Text style={styles.titleMain}>Lista de Asistencia Oficial</Text>
          <Text style={styles.titleSub}>
            {level} • {grade} {group} • CICLO {cycleName}
          </Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colNo]}>No.</Text>
            <Text style={[styles.tableHeaderCell, styles.colName]}>Nombre Completo del Alumno</Text>
            <Text style={[styles.tableHeaderCell, styles.colCurp]}>CURP</Text>
          </View>
          
          {students.map((student, index) => (
            <View key={student.id} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowEven : {}]}>
              <Text style={[styles.tableCell, styles.colNo, { fontWeight: 'bold' }]}>{index + 1}</Text>
              <Text style={[styles.tableCell, styles.colName, { fontWeight: 'bold', textTransform: 'uppercase' }]}>
                {student.lastName} {student.motherLastName || ''} {student.name}
              </Text>
              <Text style={[styles.tableCell, styles.colCurp, { fontSize: 8 }]}>
                {student.curp || 'N/A'}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {settings?.pdfFooter || 'Documento oficial generado por el sistema de control escolar.'}
          </Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `${pageNumber} / ${totalPages}`
          )} fixed />
        </View>
      </Page>
    </Document>
  );
}
