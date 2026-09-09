import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { AppUser, AppSettings } from '../types';

// Standard CR-80 card size in points (72 points per inch): 2.125" x 3.375" -> 153 x 243 pt
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
    height: 72,
    backgroundColor: '#0F172A', // Slate 900
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  accentBar: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: '#3B82F6', // Blue 500 accent
    borderRadius: 1.5,
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
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  tagBadge: {
    fontSize: 5,
    color: '#93C5FD', // Blue 300
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoContainer: {
    width: 62,
    height: 72,
    backgroundColor: '#F1F5F9',
    border: '2pt solid #FFFFFF',
    borderRadius: 6,
    marginBottom: 6,
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    marginBottom: 3,
  },
  placeholderBody: {
    width: 36,
    height: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: '#CBD5E1',
  },
  infoContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 1,
  },
  teacherName: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  levelContainer: {
    backgroundColor: '#EFF6FF', // Blue 50
    border: '0.5pt solid #BFDBFE',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 5,
  },
  levelText: {
    color: '#1D4ED8', // Blue 700
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
    fontSize: 4.5,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0F172A',
    fontFamily: 'Courier',
  },
  logo: {
    height: 22,
    width: 65,
    marginBottom: 2,
    objectFit: 'contain',
  },
  roleBadge: {
    fontSize: 5,
    fontWeight: 'bold',
    color: '#059669', // Emerald
    backgroundColor: '#ECFDF5',
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  // Back card styles
  backCard: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  backHeader: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
    marginBottom: 3,
    textAlign: 'center',
    borderBottom: '0.5pt solid #CBD5E1',
    paddingBottom: 2,
    width: '100%',
  },
  backQrContainer: {
    width: 58,
    height: 58,
    backgroundColor: '#FFFFFF',
    padding: 2,
    borderRadius: 4,
    border: '0.5pt solid #CBD5E1',
    marginBottom: 6,
    alignSelf: 'center',
  },
  termsText: {
    fontSize: 4.8,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 1.25,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  signatureArea: {
    width: '80%',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  signatureLine: {
    width: '100%',
    borderBottom: '0.75pt solid #0F172A',
    marginBottom: 2,
  },
  signatureLabel: {
    fontSize: 4.5,
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
    paddingTop: 3,
    width: '100%',
  }
});

interface TeacherCredentialPDFProps {
  teacher: AppUser;
  settings: AppSettings | null;
  virtualCredentialUrl: string;
}

export default function TeacherCredentialPDF({ teacher, settings, virtualCredentialUrl }: TeacherCredentialPDFProps) {
  // If logo is a base64 data URI, react-pdf handles it directly; if http/https, route via proxy to prevent CORS issues
  const proxiedLogo = settings?.logoUrl && settings.logoUrl.length > 0 
    ? (settings.logoUrl.startsWith('data:') ? settings.logoUrl : `/api/proxy/image?url=${encodeURIComponent(settings.logoUrl)}`)
    : null;

  const proxiedPhoto = teacher.photoUrl && teacher.photoUrl.length > 0 
    ? (teacher.photoUrl.startsWith('data:') ? teacher.photoUrl : `/api/proxy/image?url=${encodeURIComponent(teacher.photoUrl)}`)
    : null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(virtualCredentialUrl)}&margin=0`;

  return (
    <Document>
      {/* FRONT SIDE */}
      <Page size={[153, 243]} style={styles.page}>
        <View style={styles.frontBackground} />
        <View style={styles.accentBar} />
        <View style={styles.frontCard}>
          <View style={styles.header}>
            {proxiedLogo ? (
              <Image src={proxiedLogo} style={styles.logo} />
            ) : (
              <Text style={styles.schoolName}>{settings?.schoolName || 'Institución Educativa'}</Text>
            )}
            <Text style={styles.tagBadge}>CREDENCIAL DE DOCENTE</Text>
          </View>

          <View style={styles.photoContainer}>
            {proxiedPhoto ? (
              <Image src={proxiedPhoto} style={styles.photo} />
            ) : (
              <>
                <View style={styles.placeholderHead} />
                <View style={styles.placeholderBody} />
              </>
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.teacherName}>{teacher.name || 'Docente'}</Text>
            
            <View style={styles.levelContainer}>
              <Text style={styles.levelText}>
                {teacher.assignedLevel 
                  ? `DOCENTE • ${teacher.assignedLevel.toUpperCase().trim() === 'BACHILLERATO' ? 'PREPARATORIA' : teacher.assignedLevel.toUpperCase()}`
                  : 'DOCENTE INSTITUCIONAL'}
              </Text>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>No. Empleado</Text>
                <Text style={styles.detailValue}>{teacher.employeeNumber || 'S/N'}</Text>
              </View>
              {teacher.assignedGrade && (
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>Grado</Text>
                  <Text style={styles.detailValue}>{teacher.assignedGrade}</Text>
                </View>
              )}
              {teacher.assignedGroup && (
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>Grupo</Text>
                  <Text style={styles.detailValue}>{teacher.assignedGroup}</Text>
                </View>
              )}
            </View>

            <Text style={styles.roleBadge}>Personal Activo</Text>
          </View>
        </View>
      </Page>

      {/* BACK SIDE */}
      <Page size={[153, 243]} style={styles.page}>
        <View style={styles.backCard}>
          <Text style={styles.backHeader}>Validación Digital</Text>

          <View style={styles.backQrContainer}>
            <Image 
              src={qrImageUrl} 
              style={{ width: '100%', height: '100%' }} 
            />
          </View>

          <Text style={styles.termsText}>
            Esta credencial oficial acredita al portador como docente activo de esta institución educativa. Escanee el código QR con cualquier dispositivo móvil para validar su vigencia y autenticidad en línea.
          </Text>

          <View style={{ flex: 1 }} />

          <View style={styles.signatureArea}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma del Docente</Text>
          </View>

          <View style={[styles.signatureArea, { marginTop: 16 }]}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Dirección General</Text>
          </View>

          <Text style={styles.backFooter}>
            {settings?.schoolName || 'Institución Educativa'}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
