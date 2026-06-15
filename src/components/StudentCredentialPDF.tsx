import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Student, AppSettings } from '../types';

// Standard CR-80 card size in points (72 points per inch)
// 2.125" x 3.375" -> 153 x 243
const styles = StyleSheet.create({
  page: {
    width: 153,
    height: 243,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  frontBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#0F172A', // Slate 900
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  frontCard: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 2,
    zIndex: 1,
  },
  schoolName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  schoolCycle: {
    fontSize: 5,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  photoContainer: {
    width: 60,
    height: 70,
    backgroundColor: '#E2E8F0',
    border: '2pt solid #FFFFFF',
    borderRadius: 4,
    marginBottom: 6,
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  infoContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 2,
  },
  studentName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 0,
  },
  levelContainer: {
    backgroundColor: '#E0E7FF', // Indigo 100
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 6,
  },
  levelText: {
    color: '#4338CA', // Indigo 700
    fontSize: 6,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  detailsGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  detailBox: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 5,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  logo: {
    height: 22,
    width: 60,
    marginBottom: 2,
    objectFit: 'contain',
  },
  curpDetails: {
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
    paddingTop: 6,
    borderTop: '0.5pt solid #E2E8F0',
  },
  matriculaLabel: {
    fontSize: 5,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  matriculaValue: {
    fontSize: 7,
    fontWeight: 'normal',
    color: '#0F172A',
    marginTop: 1,
    fontFamily: 'Courier',
  },
  // Back card styles
  backCard: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  backQrContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#FFFFFF',
    padding: 2,
    borderRadius: 4,
    border: '0.5pt solid #CBD5E1',
    marginBottom: 8,
    alignSelf: 'center',
  },
  backHeader: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'center',
    borderBottom: '0.5pt solid #CBD5E1',
    paddingBottom: 2,
    width: '100%',
  },
  termsText: {
    fontSize: 5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 1.3,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  signatureArea: {
    width: '80%',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  signatureLine: {
    width: '100%',
    borderBottom: '1pt solid #0F172A',
    marginBottom: 3,
  },
  signatureLabel: {
    fontSize: 5,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  backFooter: {
    fontSize: 5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 'auto',
    borderTop: '0.5pt solid #E2E8F0',
    paddingTop: 4,
    width: '100%',
  }
});

interface StudentCredentialPDFProps {
  student: Student;
  settings: AppSettings | null;
}

export default function StudentCredentialPDF({ student, settings }: StudentCredentialPDFProps) {
  const proxiedLogo = settings?.logoUrl && settings.logoUrl.length > 0 
    ? `/api/proxy/image?url=${encodeURIComponent(settings.logoUrl)}`
    : null;

  const proxiedPhoto = student.photoUrl && student.photoUrl.length > 0 
    ? `/api/proxy/image?url=${encodeURIComponent(student.photoUrl)}`
    : null;

  const defaultTerms = "Esta credencial es de uso estrictamente personal e intransferible. Identifica al portador como estudiante activo de esta institución durante el ciclo escolar vigente. El titular se compromete a hacer buen uso de la misma y reportar su extravío inmediatamente a Control Escolar.";

  return (
    <Document>
      {/* FRONT SIDE */}
      <Page size={[153, 243]} style={styles.page}>
        <View style={styles.frontBackground} />
        <View style={styles.frontCard}>
          <View style={styles.header}>
            {proxiedLogo ? (
              <Image src={proxiedLogo} style={styles.logo} />
            ) : (
              <Text style={styles.schoolName}>{settings?.schoolName || 'Institución Educativa'}</Text>
            )}
            <Text style={styles.schoolCycle}>CREDENCIAL DE ESTUDIANTE</Text>
          </View>

          <View style={styles.photoContainer}>
            {proxiedPhoto ? (
              <Image src={proxiedPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <View style={{ width: 25, height: 25, borderRadius: 12.5, backgroundColor: '#CBD5E1', marginBottom: 4 }} />
                <View style={{ width: 35, height: 20, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: '#CBD5E1' }} />
              </>
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.studentName}>
              {student.name}
            </Text>
            <Text style={[styles.studentName, { fontSize: 8, color: '#334155' }]}>
              {student.lastName} {student.motherLastName || ''}
            </Text>
            
            <View style={{ marginTop: 2, marginBottom: 4 }}>
              <View style={styles.levelContainer}>
                <Text style={styles.levelText}>
                  {student.level?.toUpperCase().trim() === 'BACHILLERATO' ? 'PREPARATORIA' : student.level}
                </Text>
              </View>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Grado</Text>
                <Text style={styles.detailValue}>{student.grade || '-'}</Text>
              </View>
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Grupo</Text>
                <Text style={styles.detailValue}>{student.group || '-'}</Text>
              </View>
            </View>

            <View style={styles.curpDetails}>
              <Text style={styles.matriculaLabel}>MATRÍCULA</Text>
              <Text style={styles.matriculaValue}>
                {student.matricula || 'S/M'}
              </Text>
              {student.curp && (
                <Text style={{ fontSize: 6, color: '#475569', marginTop: 1, fontFamily: 'Courier' }}>
                  {student.curp}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Page>

      {/* BACK SIDE */}
      <Page size={[153, 243]} style={styles.page}>
        <View style={styles.backCard}>
          <View style={styles.backQrContainer}>
            <Image 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(student.matricula || '')}&margin=0`} 
              style={{ width: '100%', height: '100%' }} 
            />
          </View>

          <Text style={styles.backHeader}>Información Importante</Text>
          
          <Text style={styles.termsText}>
            {settings?.credentialTerms || defaultTerms}
          </Text>

          <View style={{ flex: 1 }} />

          <View style={styles.signatureArea}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma del Alumno</Text>
          </View>

          <View style={[styles.signatureArea, { marginTop: 24 }]}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Director de Nivel</Text>
          </View>

          <Text style={styles.backFooter}>
            {settings?.schoolName || 'Institución Educativa'}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
