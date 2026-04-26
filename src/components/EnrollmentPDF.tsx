import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Enrollment, AppSettings } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  folioSection: {
    textAlign: 'right',
  },
  folioLabel: {
    fontSize: 8,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  folioValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
    color: '#0F172A',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    backgroundColor: '#F1F5F9',
    padding: 4,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 10,
  },
  field: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 2,
  },
  label: {
    fontSize: 7,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  value: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  signatureContainer: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signatureBox: {
    width: 180,
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginTop: 30,
    paddingTop: 5,
  },
  signatureLabel: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    fontSize: 7,
    color: '#94A3B8',
  },
  commitmentText: {
    fontSize: 8,
    color: '#64748B',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxMark: {
    fontSize: 8,
    fontWeight: 'bold',
  }
});

interface Props {
  enrollment: Enrollment;
  settings: AppSettings;
}

const EnrollmentPDF: React.FC<Props> = ({ enrollment, settings }) => {
  const proxiedLogo = settings?.logoUrl && settings.logoUrl.length > 0 
    ? `/api/proxy/image?url=${encodeURIComponent(settings.logoUrl)}`
    : null;

  const dateStr = enrollment.createdAt ? format(enrollment.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: es }) : '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            {proxiedLogo && (
              <Image src={proxiedLogo} style={styles.logo} />
            )}
            <View>
              <Text style={styles.schoolName}>{settings?.schoolName || 'Institución Educativa'}</Text>
              <Text style={{ fontSize: 8, color: '#64748B' }}>{settings?.legalName || ''}</Text>
            </View>
          </View>
          <View style={styles.folioSection}>
            <Text style={styles.folioLabel}>Folio de Solicitud</Text>
            <Text style={styles.folioValue}>{enrollment.folio}</Text>
            <Text style={{ fontSize: 7, color: '#94A3B8', marginTop: 2 }}>{dateStr}</Text>
          </View>
        </View>

        <Text style={styles.title}>Formato de Solicitud de Inscripción</Text>

        {/* Datos del Alumno */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. Datos del Alumno</Text>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Nombre completo del alumno</Text>
              <Text style={styles.value}>{`${enrollment.studentName} ${enrollment.studentLastName} ${enrollment.studentMotherLastName}`}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Nivel/Grado</Text>
              <Text style={styles.value}>{`${enrollment.level} - ${enrollment.grade}`}</Text>
            </View>
          </View>
          
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>CURP</Text>
              <Text style={styles.value}>{enrollment.curp}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Fecha de Nacimiento</Text>
              <Text style={styles.value}>{enrollment.birthDate}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Edad</Text>
              <Text style={styles.value}>{enrollment.age} años</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Género</Text>
              <Text style={styles.value}>{enrollment.gender}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Lugar de Nacimiento</Text>
              <Text style={styles.value}>{`${enrollment.birthPlaceCity}, ${enrollment.birthPlaceState}`}</Text>
            </View>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Escuela de Procedencia</Text>
              <Text style={styles.value}>{enrollment.previousSchool || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 3 }]}>
              <Text style={styles.label}>Dirección Particular</Text>
              <Text style={styles.value}>{`${enrollment.address} #${enrollment.addressNo}, ${enrollment.neighborhood}`}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>C.P.</Text>
              <Text style={styles.value}>{enrollment.zipCode}</Text>
            </View>
          </View>
        </View>

        {/* Datos de los Padres */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. Datos de los Padres / Tutores</Text>
          
          <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 5 }}>Padre / Tutor 1</Text>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Nombre completo del Padre</Text>
              <Text style={styles.value}>{enrollment.fatherName || 'N/A'}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Teléfono</Text>
              <Text style={styles.value}>{enrollment.fatherPhone || 'N/A'}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 8, fontWeight: 'bold', marginTop: 5, marginBottom: 5 }}>Madre / Tutor 2</Text>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Nombre completo de la Madre</Text>
              <Text style={styles.value}>{enrollment.motherName || 'N/A'}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Teléfono</Text>
              <Text style={styles.value}>{enrollment.motherPhone || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Salud y Emergencia */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. Salud y Emergencias</Text>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Padecimientos/Alergias</Text>
              <Text style={styles.value}>{enrollment.medicalConditions || 'Ninguno'}</Text>
            </View>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Contacto de Emergencia</Text>
              <Text style={styles.value}>{`${enrollment.emergencyContactName} (${enrollment.emergencyContactPhone})`}</Text>
            </View>
          </View>
        </View>

        {/* Compromisos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IV. Compromisos Institucionales</Text>
          <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#1E293B', marginBottom: 6, textDecoration: 'underline' }}>
            SE COMPROMETE A:
          </Text>
          
          <View style={styles.checkboxRow}>
            <View style={styles.checkbox}>{enrollment.commitments?.participate && <Text style={styles.checkboxMark}>✓</Text>}</View>
            <Text style={styles.commitmentText}>Participar y cooperar con la Institución en el proceso Enseñanza - Aprendizaje.</Text>
          </View>
          <View style={styles.checkboxRow}>
            <View style={styles.checkbox}>{enrollment.commitments?.discipline && <Text style={styles.checkboxMark}>✓</Text>}</View>
            <Text style={styles.commitmentText}>Apoyar a la Institución en la disciplina.</Text>
          </View>
          <View style={styles.checkboxRow}>
            <View style={styles.checkbox}>{enrollment.commitments?.conferences && <Text style={styles.checkboxMark}>✓</Text>}</View>
            <Text style={styles.commitmentText}>Asistir puntualmente a las conferencias formativas y entrega de calificaciones.</Text>
          </View>
          <View style={styles.checkboxRow}>
            <View style={styles.checkbox}>{enrollment.commitments?.payments && <Text style={styles.checkboxMark}>✓</Text>}</View>
            <Text style={styles.commitmentText}>Realizar sus pagos en los primeros diez días de cada mes.</Text>
          </View>
          <View style={styles.checkboxRow}>
            <View style={styles.checkbox}>{enrollment.commitments?.timelyPayments && <Text style={styles.checkboxMark}>✓</Text>}</View>
            <Text style={styles.commitmentText}>Hacer sus pagos oportunamente. El incumplimiento libera a la Institución de seguir prestando servicios.</Text>
          </View>
          <View style={styles.checkboxRow}>
            <View style={styles.checkbox}>{enrollment.commitments?.workTogether && <Text style={styles.checkboxMark}>✓</Text>}</View>
            <Text style={styles.commitmentText}>Estar dispuesto a trabajar en conjunto con la Institución para ayudar al alumno.</Text>
          </View>
        </View>

        {/* Firmas */}
        <View style={styles.signatureContainer}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma del Padre o Tutor</Text>
            <Text style={{ fontSize: 7, color: '#64748B' }}>Nombre y Firma</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Sello de Dirección</Text>
            <Text style={{ fontSize: 7, color: '#64748B' }}>Autorización</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{`${settings.schoolName || ''} • ${new Date().getFullYear()} • Formato Digital de Inscripción`}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default EnrollmentPDF;
