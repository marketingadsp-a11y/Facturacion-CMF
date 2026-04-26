import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { ReceptionVisit } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const styles = StyleSheet.create({
  page: { padding: 30, backgroundColor: '#ffffff', fontFamily: 'Helvetica' },
  headerDiv: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#1e293b', paddingBottom: 10 },
  schoolName: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  title: { fontSize: 14, fontWeight: 700, color: '#475569', marginTop: 4 },
  dateText: { fontSize: 10, color: '#64748b', marginTop: 4 },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  colTime: { width: '15%', padding: 6, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  colName: { width: '30%', padding: 6, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  colArea: { width: '20%', padding: 6, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  colReason: { width: '20%', padding: 6, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  colStatus: { width: '15%', padding: 6 },
  headerText: { fontSize: 9, fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' },
  cellText: { fontSize: 9, color: '#475569' },
  statusAttended: { color: '#059669', fontWeight: 700 },
  statusPending: { color: '#dc2626', fontWeight: 700 }
});

export const ReceptionLogPDF = ({ visits, date, schoolName }: { visits: ReceptionVisit[], date: Date, schoolName: string }) => {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerDiv}>
          <Text style={styles.schoolName}>{schoolName || 'Registro de Accesos'}</Text>
          <Text style={styles.title}>BITÁCORA DE RECEPCIÓN</Text>
          <Text style={styles.dateText}>
            Fecha de filtro: {format(date, 'EEEE d de MMMM, yyyy', { locale: es }).toUpperCase()}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colTime}><Text style={styles.headerText}>Hora In/Out</Text></View>
            <View style={styles.colName}><Text style={styles.headerText}>Visitante</Text></View>
            <View style={styles.colArea}><Text style={styles.headerText}>Área</Text></View>
            <View style={styles.colReason}><Text style={styles.headerText}>Motivo</Text></View>
            <View style={styles.colStatus}><Text style={styles.headerText}>Estatus</Text></View>
          </View>
          {visits.map(v => (
            <View key={v.id} style={styles.tableRow}>
              <View style={styles.colTime}>
                <Text style={styles.cellText}>{format(v.checkInTime.toDate(), 'HH:mm:ss')}</Text>
                {v.attendedAt && (
                   <Text style={{...styles.cellText, color: '#94a3b8', marginTop: 2 }}>{format(v.attendedAt.toDate(), 'HH:mm:ss')}</Text>
                )}
              </View>
              <View style={styles.colName}>
                <Text style={{...styles.cellText, fontWeight: 700}}>{v.name}</Text>
              </View>
              <View style={styles.colArea}>
                <Text style={styles.cellText}>{v.area}</Text>
              </View>
              <View style={styles.colReason}>
                <Text style={styles.cellText}>{v.reason}</Text>
              </View>
              <View style={styles.colStatus}>
                <Text style={[styles.cellText, v.status === 'Atendido' ? styles.statusAttended : styles.statusPending]}>
                  {v.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
          {visits.length === 0 && (
            <View style={{ padding: 10 }}>
              <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>No se encontraron registros para la fecha consultada.</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
};
