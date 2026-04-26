import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { TimeLog } from '../types';
import { format, differenceInMinutes } from 'date-fns';
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
  colName: { width: '35%', padding: 6, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  colEntrada: { width: '20%', padding: 6, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  colSalida: { width: '20%', padding: 6, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  colTotal: { width: '25%', padding: 6 },
  headerText: { fontSize: 9, fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' },
  cellText: { fontSize: 9, color: '#475569' },
  cellTextBold: { fontSize: 9, fontWeight: 700, color: '#0f172a' }
});

interface Summary {
  employeeName: string;
  position: string;
  primerEntrada: string;
  ultimaSalida: string;
  totalTimeWorked: string;
}

const computeSummary = (logs: TimeLog[]): Summary[] => {
  const byEmp: Record<string, TimeLog[]> = {};
  logs.forEach(l => {
    if(!byEmp[l.employeeId]) byEmp[l.employeeId] = [];
    byEmp[l.employeeId].push(l);
  });

  return Object.values(byEmp).map(empLogs => {
    // Sort ascending
    empLogs.sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());
    const name = empLogs[0].employeeName;
    const position = empLogs[0].employeePosition;
    
    let totalMinutes = 0;
    let currentIn: number | null = null;
    let primerE = '-';
    let ultimaS = '-';

    empLogs.forEach(l => {
      const timeMs = l.timestamp.toMillis();
      if (l.type === 'Entrada') {
        if (currentIn === null) currentIn = timeMs;
        if (primerE === '-') primerE = format(new Date(timeMs), 'HH:mm:ss');
      } else if (l.type === 'Salida') {
        ultimaS = format(new Date(timeMs), 'HH:mm:ss');
        if (currentIn !== null) {
          totalMinutes += differenceInMinutes(new Date(timeMs), new Date(currentIn));
          currentIn = null;
        }
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const totalStr = totalMinutes > 0 ? `${hours}h ${mins}m` : 'Turno Activo';

    return {
      employeeName: name,
      position: position,
      primerEntrada: primerE,
      ultimaSalida: ultimaS,
      totalTimeWorked: totalStr
    };
  });
};

export const ChecadorLogPDF = ({ logs, date, schoolName }: { logs: TimeLog[], date: Date, schoolName: string }) => {
  const summary = computeSummary(logs);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerDiv}>
          <Text style={styles.schoolName}>{schoolName || 'Reloj Checador'}</Text>
          <Text style={styles.title}>BITÁCORA DE ASISTENCIA DIARIA</Text>
          <Text style={styles.dateText}>
            Fecha: {format(date, 'EEEE d de MMMM, yyyy', { locale: es }).toUpperCase()}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colName}><Text style={styles.headerText}>Personal</Text></View>
            <View style={styles.colEntrada}><Text style={styles.headerText}>Primer Entrada</Text></View>
            <View style={styles.colSalida}><Text style={styles.headerText}>Última Salida</Text></View>
            <View style={styles.colTotal}><Text style={styles.headerText}>Tiempo Trabajado</Text></View>
          </View>
          {summary.map((s, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colName}>
                <Text style={styles.cellTextBold}>{s.employeeName}</Text>
                <Text style={{...styles.cellText, color: '#94a3b8', marginTop: 2}}>{s.position}</Text>
              </View>
              <View style={styles.colEntrada}>
                <Text style={styles.cellText}>{s.primerEntrada}</Text>
              </View>
              <View style={styles.colSalida}>
                <Text style={styles.cellText}>{s.ultimaSalida}</Text>
              </View>
              <View style={styles.colTotal}>
                <Text style={styles.cellTextBold}>{s.totalTimeWorked}</Text>
              </View>
            </View>
          ))}
          {summary.length === 0 && (
            <View style={{ padding: 10 }}>
              <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>No se encontraron registros de entrada o salida para este día.</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
};
