/**
 * Attendance list Excel export utility
 * Uses xlsx (SheetJS) for formatting
 */
import * as XLSX from 'xlsx';
import { Student, AppSettings, SchoolCycle } from '../types';

export interface AttendanceExcelOptions {
  students: Student[];
  settings: AppSettings | null;
  level: string;
  grade: string;
  group: string;
  cycle: SchoolCycle | null;
  teacherName?: string;
}

function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const na = `${a.lastName || ''} ${a.motherLastName || ''} ${a.name || ''}`.toUpperCase();
    const nb = `${b.lastName || ''} ${b.motherLastName || ''} ${b.name || ''}`.toUpperCase();
    return na.localeCompare(nb);
  });
}

export function exportAttendanceExcel({
  students,
  settings,
  level,
  grade,
  group,
  cycle,
  teacherName,
}: AttendanceExcelOptions): void {
  const schoolName = settings?.schoolName || 'Institución Educativa';
  const legalName = settings?.legalName || '';
  const schoolAddress = settings?.schoolAddress || '';
  const schoolPhone = settings?.schoolPhone || '';
  const schoolWebsite = settings?.schoolWebsite || '';
  const cycleName = cycle?.name || 'ACTUAL';

  const showNo = settings?.attendanceListShowNo !== false;
  const showMatricula = settings?.attendanceListShowMatricula !== false;
  const totalDayCols = Math.max(1, Math.min(31, settings?.attendanceListColumns ?? 31));
  const dayNumbers = Array.from({ length: totalDayCols }, (_, i) => i + 1);

  const sortedStudents = sortStudents(students);

  // ── Build worksheet data (array of arrays) ──────────────────────────────
  const rows: (string | number | null)[][] = [];

  // Row 1 – School name
  rows.push([schoolName]);
  // Row 2 – Legal name
  if (legalName) rows.push([legalName]);
  // Row 3 – Contact
  const contact = [schoolAddress, schoolPhone ? `Tel. ${schoolPhone}` : '', schoolWebsite]
    .filter(Boolean)
    .join('   |   ');
  if (contact) rows.push([contact]);

  // Blank separator
  rows.push([]);

  // Doc title
  rows.push(['LISTA DE ASISTENCIA OFICIAL']);

  // Meta row
  rows.push([
    `Nivel: ${level}`,
    null,
    `Grado y Grupo: ${grade} ${group}`,
    null,
    `Ciclo Escolar: ${cycleName}`,
    null,
    `Docente: ${teacherName || ''}`,
    null,
    `Total de alumnos: ${sortedStudents.length}`,
  ]);

  // Blank separator
  rows.push([]);

  // ── Column headers ────────────────────────────────────────────────────────
  const headerRow: (string | number)[] = [];
  if (showNo) headerRow.push('No.');
  if (showMatricula) headerRow.push('Matrícula');
  headerRow.push('Apellidos y Nombre');
  dayNumbers.forEach((d) => headerRow.push(d));
  rows.push(headerRow);

  // ── Data rows ─────────────────────────────────────────────────────────────
  sortedStudents.forEach((student, index) => {
    const dataRow: (string | number | null)[] = [];
    if (showNo) dataRow.push(index + 1);
    if (showMatricula) dataRow.push(student.matricula || '—');
    const fullName =
      `${student.lastName || ''}${student.motherLastName ? ' ' + student.motherLastName : ''}, ${student.name || ''}`.toUpperCase();
    dataRow.push(fullName);
    dayNumbers.forEach(() => dataRow.push(null)); // blank attendance cells
    rows.push(dataRow);
  });

  // ── Signature block at bottom with ample space ────────────────────────────
  const totalCols = (showNo ? 1 : 0) + (showMatricula ? 1 : 0) + 1 + totalDayCols;
  rows.push([]);
  rows.push([]);
  rows.push([]);

  const sigLineRow = new Array(totalCols).fill(null);
  const sigLabelRow = new Array(totalCols).fill(null);
  const sigSubRow = new Array(totalCols).fill(null);

  // Column positions for the 3 signatories
  const leftCol = showNo && showMatricula ? 2 : 1;
  const midCol = Math.floor(totalCols / 2);
  const rightCol = Math.max(midCol + 4, totalCols - 5);

  sigLineRow[leftCol] = '______________________________________';
  sigLabelRow[leftCol] = 'FIRMA DEL DOCENTE RESPONSABLE';
  if (teacherName) sigSubRow[leftCol] = teacherName.toUpperCase();

  sigLineRow[midCol] = '______________________________________';
  sigLabelRow[midCol] = 'DIRECTOR/A DE NIVEL';

  sigLineRow[rightCol] = '______________________________________';
  sigLabelRow[rightCol] = 'SELLO INSTITUCIONAL';

  rows.push(sigLineRow);
  rows.push(sigLabelRow);
  if (teacherName) rows.push(sigSubRow);

  // ── Create workbook ───────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // ── Determine column widths ───────────────────────────────────────────────
  const colWidths: XLSX.ColInfo[] = [];
  if (showNo) colWidths.push({ wch: 5 });
  if (showMatricula) colWidths.push({ wch: 14 });
  colWidths.push({ wch: 40 }); // name column
  dayNumbers.forEach(() => colWidths.push({ wch: 4 }));
  ws['!cols'] = colWidths;

  // ── Calculate start row for data header (0-indexed) ──────────────────────
  // Row 0 = schoolName, +1 if legalName, +1 if contact, +1 blank, +1 title, +1 meta, +1 blank → headerRow
  let headerRowIdx = 4; // "LISTA DE ASISTENCIA OFICIAL"
  if (legalName) headerRowIdx++;
  if (contact) headerRowIdx++;
  headerRowIdx += 2; // meta row + blank
  const dataStartRowIdx = headerRowIdx + 1;

  // ── Merge cells for title rows ────────────────────────────────────────────
  if (!ws['!merges']) ws['!merges'] = [];

  // Merge school name row (row 0)
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

  // ── Styles via cell properties ────────────────────────────────────────────
  // SheetJS Community (0.18.x) only supports basic styles via utils; 
  // true cell style requires xlsx-style or exceljs.
  // We use XLSX's built-in approach — set styles via !style hack (limited)
  // For better results we use conditional writing on specific cells:

  const styleCells = (addr: string, style: object) => {
    if (!ws[addr]) ws[addr] = { v: '', t: 's' };
    (ws[addr] as any).s = style;
  };

  // School name
  const schoolNameAddr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  styleCells(schoolNameAddr, {
    font: { bold: true, sz: 16, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: '0F172A' } },
  });

  // Title row
  const titleAddr = XLSX.utils.encode_cell({ r: headerRowIdx - 2, c: 0 });
  styleCells(titleAddr, {
    font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });

  // Header row cells
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: dataStartRowIdx - 1, c });
    styleCells(addr, {
      font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: c < (showNo ? 1 : 0) + (showMatricula ? 1 : 0) + 1 ? 'left' : 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '334155' } },
        bottom: { style: 'thin', color: { rgb: '334155' } },
        left: { style: 'thin', color: { rgb: '334155' } },
        right: { style: 'thin', color: { rgb: '334155' } },
      },
    });
  }

  // Data rows alternating bg
  sortedStudents.forEach((_, rowIdx) => {
    const r = dataStartRowIdx + rowIdx;
    const isEven = rowIdx % 2 === 1;
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      (ws[addr] as any).s = {
        fill: { fgColor: { rgb: isEven ? 'F8FAFC' : 'FFFFFF' } },
        border: {
          top: { style: 'hair', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
          left: { style: 'hair', color: { rgb: 'E2E8F0' } },
          right: { style: 'hair', color: { rgb: 'E2E8F0' } },
        },
        alignment: { vertical: 'center' },
        font: { sz: 9 },
      };
    }
  });

  // Row heights
  ws['!rows'] = rows.map((_, i) => {
    if (i === 0) return { hpt: 28 }; // school name
    if (i === dataStartRowIdx - 1) return { hpt: 20 }; // header
    if (i >= dataStartRowIdx) return { hpt: 18 }; // data rows
    return { hpt: 14 };
  });

  // Sheet name
  const sheetName = `${level.substring(0, 5)}_${grade}_${group}`.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // ── Download ──────────────────────────────────────────────────────────────
  const filename = `Lista_Asistencia_${level}_${grade}_${group}_${cycleName}.xlsx`
    .replace(/\s+/g, '_')
    .replace(/[/\\:*?"<>|]/g, '');
  XLSX.writeFile(wb, filename);
}

/**
 * Export attendance lists for ALL groups within a level.
 * One sheet per group.
 */
export function exportAttendanceExcelAllGroups({
  groups,
  settings,
  level,
  cycle,
}: {
  groups: { grade: string; group: string; students: Student[]; teacherName?: string }[];
  settings: AppSettings | null;
  level: string;
  cycle: SchoolCycle | null;
}): void {
  const cycleName = cycle?.name || 'ACTUAL';
  const schoolName = settings?.schoolName || 'Institución Educativa';
  const showNo = settings?.attendanceListShowNo !== false;
  const showMatricula = settings?.attendanceListShowMatricula !== false;
  const totalDayCols = Math.max(1, Math.min(31, settings?.attendanceListColumns ?? 31));
  const dayNumbers = Array.from({ length: totalDayCols }, (_, i) => i + 1);

  const wb = XLSX.utils.book_new();

  groups.forEach(({ grade, group, students, teacherName }) => {
    const sortedStudents = sortStudents(students);
    const rows: (string | number | null)[][] = [];

    rows.push([schoolName]);
    rows.push(['LISTA DE ASISTENCIA OFICIAL']);
    rows.push([
      `Nivel: ${level}`,
      null,
      `Grado y Grupo: ${grade} ${group}`,
      null,
      `Ciclo: ${cycleName}`,
      null,
      `Docente: ${teacherName || ''}`,
      null,
      `Alumnos: ${sortedStudents.length}`,
    ]);
    rows.push([]);

    const headerRow: (string | number)[] = [];
    if (showNo) headerRow.push('No.');
    if (showMatricula) headerRow.push('Matrícula');
    headerRow.push('Apellidos y Nombre');
    dayNumbers.forEach((d) => headerRow.push(d));
    rows.push(headerRow);

    sortedStudents.forEach((student, index) => {
      const dataRow: (string | number | null)[] = [];
      if (showNo) dataRow.push(index + 1);
      if (showMatricula) dataRow.push(student.matricula || '—');
      const fullName =
        `${student.lastName || ''}${student.motherLastName ? ' ' + student.motherLastName : ''}, ${student.name || ''}`.toUpperCase();
      dataRow.push(fullName);
      dayNumbers.forEach(() => dataRow.push(null));
      rows.push(dataRow);
    });

    // ── Signature block at bottom with ample space ──────────────────────────
    const totalCols = (showNo ? 1 : 0) + (showMatricula ? 1 : 0) + 1 + totalDayCols;
    rows.push([]);
    rows.push([]);
    rows.push([]);

    const sigLineRow = new Array(totalCols).fill(null);
    const sigLabelRow = new Array(totalCols).fill(null);
    const sigSubRow = new Array(totalCols).fill(null);

    const leftCol = showNo && showMatricula ? 2 : 1;
    const midCol = Math.floor(totalCols / 2);
    const rightCol = Math.max(midCol + 4, totalCols - 5);

    sigLineRow[leftCol] = '______________________________________';
    sigLabelRow[leftCol] = 'FIRMA DEL DOCENTE RESPONSABLE';
    if (teacherName) sigSubRow[leftCol] = teacherName.toUpperCase();

    sigLineRow[midCol] = '______________________________________';
    sigLabelRow[midCol] = 'DIRECTOR/A DE NIVEL';

    sigLineRow[rightCol] = '______________________________________';
    sigLabelRow[rightCol] = 'SELLO INSTITUCIONAL';

    rows.push(sigLineRow);
    rows.push(sigLabelRow);
    if (teacherName) rows.push(sigSubRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths: XLSX.ColInfo[] = [];
    if (showNo) colWidths.push({ wch: 5 });
    if (showMatricula) colWidths.push({ wch: 14 });
    colWidths.push({ wch: 40 });
    dayNumbers.forEach(() => colWidths.push({ wch: 4 }));
    ws['!cols'] = colWidths;
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });

    const sheetName = `${grade} ${group}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const filename = `Listas_Asistencia_${level}_${cycleName}.xlsx`
    .replace(/\s+/g, '_')
    .replace(/[/\\:*?"<>|]/g, '');
  XLSX.writeFile(wb, filename);
}
