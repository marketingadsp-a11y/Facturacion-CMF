import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Register a clean font for the PDF
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGkyAZ9hiA.woff2', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGkyAZ9hiA.woff2', fontWeight: 900 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#0F172A',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 900,
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  content: {
    marginTop: 20,
  },
  section: {
    marginBottom: 25,
  },
  studentInfo: {
    backgroundColor: '#F8FAFC',
    padding: 15,
    borderRadius: 8,
    border: '1pt solid #E2E8F0',
  },
  studentName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  studentLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  codeSection: {
    marginTop: 30,
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#0F172A',
    borderRadius: 12,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 10,
  },
  code: {
    fontSize: 48,
    fontWeight: 900,
    color: '#FFFFFF',
    letterSpacing: 5,
  },
  instructions: {
    marginTop: 30,
  },
  instructionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0F172A',
    textTransform: 'uppercase',
    marginBottom: 10,
    borderLeft: '3pt solid #4F46E5',
    paddingLeft: 10,
  },
  step: {
    fontSize: 10,
    color: '#334155',
    marginBottom: 8,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTop: '1pt solid #E2E8F0',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

interface RegistrationCodePDFProps {
  studentName: string;
  registrationCode: string;
  schoolName?: string;
}

const RegistrationCodePDF: React.FC<RegistrationCodePDFProps> = ({ studentName, registrationCode, schoolName = 'Portal Escolar' }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{schoolName}</Text>
        <Text style={styles.subtitle}>Instrucciones de Acceso para Padres</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.studentInfo}>
            <Text style={styles.studentLabel}>Alumno(a):</Text>
            <Text style={styles.studentName}>{studentName}</Text>
          </View>
        </View>

        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>Código de Registro Único</Text>
          <Text style={styles.code}>{registrationCode}</Text>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>Pasos para el Registro</Text>
          <Text style={styles.step}>1. Ingrese a la plataforma oficial de padres de familia.</Text>
          <Text style={styles.step}>2. Seleccione la opción "Registrarse" o "Vincular Alumno".</Text>
          <Text style={styles.step}>3. Ingrese su correo electrónico personal y cree una contraseña segura.</Text>
          <Text style={styles.step}>4. Cuando se le solicite, ingrese el CÓDIGO DE REGISTRO que aparece arriba.</Text>
          <Text style={styles.step}>5. Una vez validado, podrá consultar calificaciones, estados de cuenta y avisos institucionales.</Text>
        </View>

        <View style={styles.section}>
          <View style={{ marginTop: 20, padding: 15, backgroundColor: '#F0F9FF', borderRadius: 8, border: '1pt solid #BAE6FD' }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', marginBottom: 5 }}>Nota Importante:</Text>
            <Text style={{ fontSize: 9, color: '#075985', lineHeight: 1.4 }}>
              Este código es confidencial y personal. Si tiene problemas para acceder, por favor contacte a la administración escolar.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Generado por el Sistema de Gestión Escolar • {new Date().toLocaleDateString()}</Text>
      </View>
    </Page>
  </Document>
);

export default RegistrationCodePDF;
