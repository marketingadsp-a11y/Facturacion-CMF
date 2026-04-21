import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Using built-in PDF fonts for maximum reliability
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
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
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
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
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  studentLabel: {
    fontSize: 8,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  code: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  instructions: {
    marginTop: 30,
  },
  instructionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
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
  },
});

interface RegistrationCodePDFProps {
  studentNames: string[];
  registrationCode: string;
  schoolName?: string;
  registrationInstructions?: string;
  pdfFooter?: string;
}

const RegistrationCodePDF: React.FC<RegistrationCodePDFProps> = ({ 
  studentNames, 
  registrationCode, 
  schoolName = 'Portal Escolar',
  registrationInstructions,
  pdfFooter
}) => {
  const steps = registrationInstructions 
    ? registrationInstructions.split('\n').filter(step => step.trim() !== '')
    : [
        '1. Ingrese a la plataforma oficial de padres de familia.',
        '2. Seleccione la opción "Registrarse" o "Vincular Alumno".',
        '3. Ingrese su correo electrónico personal y cree una contraseña segura.',
        '4. Cuando se le solicite, ingrese el CÓDIGO DE REGISTRO que aparece arriba.',
        '5. Una vez validado, podrá consultar calificaciones, estados de cuenta y avisos institucionales.'
      ];

  const footerLine = pdfFooter 
    ? `${pdfFooter} • ${new Date().toLocaleDateString()}`
    : `Generado por el Sistema de Gestión Escolar • ${new Date().toLocaleDateString()}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{schoolName}</Text>
          <Text style={styles.subtitle}>Instrucciones de Acceso para Padres</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.studentInfo}>
              <Text style={styles.studentLabel}>Alumnos Identificados:</Text>
              {studentNames.map((name, index) => (
                <Text key={index} style={[styles.studentName, { fontSize: studentNames.length > 3 ? 12 : 16, marginBottom: 2 }]}>
                  • {name}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.codeSection}>
            <Text style={styles.codeLabel}>Código de Registro Único</Text>
            <Text style={styles.code}>{registrationCode}</Text>
          </View>

          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>Pasos para el Registro</Text>
            {steps.map((step, index) => (
              <Text key={index} style={styles.step}>{step}</Text>
            ))}
          </View>

          <View style={styles.section}>
            <View style={{ marginTop: 20, padding: 15, backgroundColor: '#F0F9FF', borderRadius: 8, border: '1pt solid #BAE6FD' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#0369A1', textTransform: 'uppercase', marginBottom: 5 }}>Nota Importante:</Text>
              <Text style={{ fontSize: 9, color: '#075985', lineHeight: 1.4 }}>
                Este código es confidencial y personal. Si tiene problemas para acceder, por favor contacte a la administración escolar.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{footerLine}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default RegistrationCodePDF;
