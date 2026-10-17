import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, AppSettings, SchoolCycle } from '../types';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  X,
  AlertTriangle,
  Info,
  Trash2,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  Layers,
  GraduationCap,
  Link2
} from 'lucide-react';

interface ParsedStudentRow {
  id: string; // temporary key for table
  lastName: string;
  motherLastName: string;
  name: string;
  curp?: string;
  gender?: 'H' | 'M';
  birthDate?: string;
  parentEmail?: string;
  phone?: string;
  matricula: string;
  registrationCode: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  selected: boolean;
}

interface SheetState {
  sheetName: string;
  level: string;
  grade: string;
  group: string;
  nameOrder: 'paternal_first' | 'given_first' | 'columns';
  students: ParsedStudentRow[];
  rawRows: any[][];
  headerRowIndex: number;
  columnMap: Record<string, number>;
  isImported: boolean;
  importedCount?: number;
}

interface ImportStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  cycles: SchoolCycle[];
  existingStudents: Student[];
  onSuccess: () => void;
}

// -------------------------------------------------------------
// NORMALIZATION HELPERS TO LINK WITH ESTRUCTURA ACADÉMICA GLOBAL
// -------------------------------------------------------------

function matchAcademicLevel(raw: string, configuredLevels: string[]): string {
  if (!configuredLevels || configuredLevels.length === 0) return raw || 'Primaria';
  if (!raw) return configuredLevels[0];

  const cleanRaw = raw.trim().toLowerCase();

  // 1. Exact match (case insensitive)
  const exact = configuredLevels.find(l => l.trim().toLowerCase() === cleanRaw);
  if (exact) return exact;

  // 2. Substring match
  const sub = configuredLevels.find(l => cleanRaw.includes(l.trim().toLowerCase()) || l.trim().toLowerCase().includes(cleanRaw));
  if (sub) return sub;

  // 3. Known aliases in Mexican education
  if (cleanRaw.includes('kinder') || cleanRaw.includes('preescolar') || cleanRaw.includes('maternal')) {
    const found = configuredLevels.find(l => /preescolar|kinder|maternal/i.test(l));
    if (found) return found;
  }
  if (cleanRaw.includes('primaria') || cleanRaw.includes('prim')) {
    const found = configuredLevels.find(l => /primaria/i.test(l));
    if (found) return found;
  }
  if (cleanRaw.includes('secundaria') || cleanRaw.includes('sec')) {
    const found = configuredLevels.find(l => /secundaria/i.test(l));
    if (found) return found;
  }
  if (cleanRaw.includes('bachiller') || cleanRaw.includes('prepa') || cleanRaw.includes('medio superior')) {
    const found = configuredLevels.find(l => /bachiller|preparatoria/i.test(l));
    if (found) return found;
  }

  return configuredLevels[0];
}

function matchAcademicGrade(raw: string, configuredGrades: string[]): string {
  if (!configuredGrades || configuredGrades.length === 0) return raw || '1°';
  if (!raw) return configuredGrades[0];

  const cleanRaw = raw.trim().toLowerCase();

  // 1. Exact match (case insensitive)
  const exact = configuredGrades.find(g => g.trim().toLowerCase() === cleanRaw);
  if (exact) return exact;

  // 2. Numeric match (e.g. raw has "1" or "1ro" and configuredGrades has "1°" or "1")
  const wordMap: Record<string, string> = {
    primero: '1', primer: '1',
    segundo: '2',
    tercero: '3', tercer: '3',
    cuarto: '4',
    quinto: '5',
    sexto: '6'
  };

  let num = '';
  for (const [w, d] of Object.entries(wordMap)) {
    if (cleanRaw.includes(w)) {
      num = d;
      break;
    }
  }

  if (!num) {
    const numMatch = cleanRaw.match(/\d+/);
    if (numMatch) num = numMatch[0];
  }

  if (num) {
    const matchedGrade = configuredGrades.find(g => {
      const gNumMatch = g.match(/\d+/);
      return gNumMatch && gNumMatch[0] === num;
    });
    if (matchedGrade) return matchedGrade;
  }

  // 3. Substring match
  const sub = configuredGrades.find(g => cleanRaw.includes(g.trim().toLowerCase()) || g.trim().toLowerCase().includes(cleanRaw));
  if (sub) return sub;

  return configuredGrades[0];
}

function matchAcademicGroup(raw: string, configuredGroups: string[]): string {
  if (!configuredGroups || configuredGroups.length === 0) return raw || 'A';
  if (!raw) return configuredGroups[0];

  const cleanRaw = raw.trim().toUpperCase();

  // 1. Exact match (case insensitive)
  const exact = configuredGroups.find(g => g.trim().toUpperCase() === cleanRaw);
  if (exact) return exact;

  // 2. Remove noise words like "GRUPO", "SECCIÓN", separators
  const stripped = cleanRaw.replace(/GRUPO|SECCION|SECCIÓN|[-_:\s]/gi, '').trim();
  const strippedMatch = configuredGroups.find(g => g.trim().toUpperCase() === stripped);
  if (strippedMatch) return strippedMatch;

  // 3. Single letter match
  const letterMatch = stripped.match(/[A-Z]/);
  if (letterMatch) {
    const foundLetter = configuredGroups.find(g => g.trim().toUpperCase() === letterMatch[0]);
    if (foundLetter) return foundLetter;
  }

  // 4. "Unico" / "Único"
  if (cleanRaw.includes('UNIC') || cleanRaw.includes('ÚNIC')) {
    const foundUnico = configuredGroups.find(g => /unic|únic/i.test(g));
    if (foundUnico) return foundUnico;
  }

  return configuredGroups[0];
}

export default function ImportStudentsModal({
  isOpen,
  onClose,
  settings,
  cycles,
  existingStudents,
  onSuccess
}: ImportStudentsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<SheetState[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);

  // Common metadata
  const [cycleId, setCycleId] = useState<string>(settings?.currentCycleId || '');

  // UI status
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; message?: string } | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Official Global Academic Structure from Settings
  const globalLevels = (settings?.academicLevels && settings.academicLevels.length > 0)
    ? settings.academicLevels
    : ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato'];

  const globalGrades = (settings?.academicGrades && settings.academicGrades.length > 0)
    ? settings.academicGrades
    : ['1°', '2°', '3°', '4°', '5°', '6°'];

  const globalGroups = (settings?.academicGroups && settings.academicGroups.length > 0)
    ? settings.academicGroups
    : ['A', 'B', 'C', 'D'];

  const currentCycle = cycles.find(c => c.id === cycleId) || cycles.find(c => c.id === settings?.currentCycleId);
  const activeSheet = sheets[activeSheetIndex] || null;

  // Helper to generate a unique matrícula with the level prefix
  const createMatriculaCode = (targetLevel: string, usedCodes: Set<string>) => {
    const prefix = settings?.matriculaPrefixes?.[targetLevel] || '';
    let code = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
    let attempts = 0;
    while ((existingStudents.some(s => s.matricula === code) || usedCodes.has(code)) && attempts < 30) {
      code = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
      attempts++;
    }
    usedCodes.add(code);
    return code;
  };

  // Helper to generate a unique 5-digit registration code
  const createRegistrationCode = (usedCodes: Set<string>) => {
    let code = Math.floor(10000 + Math.random() * 90000).toString();
    let attempts = 0;
    while ((existingStudents.some(s => s.registrationCode === code) || usedCodes.has(code)) && attempts < 20) {
      code = Math.floor(10000 + Math.random() * 90000).toString();
      attempts++;
    }
    usedCodes.add(code);
    return code;
  };

  // Download official multi-sheet sample Excel template configured with Global Structure
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const sampleLevel = globalLevels[0] || 'Primaria';
    const sampleGrade1 = globalGrades[0] || '1°';
    const sampleGrade2 = globalGrades[1] || globalGrades[0] || '2°';
    const sampleGroupA = globalGroups[0] || 'A';
    const sampleGroupB = globalGroups[1] || 'B';

    // Sheet 1
    const ws1Data = [
      ['COLEGIO / CONTROL INTEGRAL ESCOLAR - LISTA DE ALUMNOS'],
      [`NIVEL: ${sampleLevel}`, `GRADO: ${sampleGrade1}`, `GRUPO: ${sampleGroupA}`, 'CICLO: ' + (currentCycle?.name || '2024-2025')],
      [],
      ['#', 'Nombre del Alumno (Apellidos y Nombres)', 'CURP (Opcional)', 'Correo Tutor (Opcional)', 'Teléfono (Opcional)'],
      [1, 'HERNÁNDEZ GÓMEZ ALEJANDRO', 'HEGA150312HDFRRN01', 'tutor.hernandez@ejemplo.com', '5512345678'],
      [2, 'LÓPEZ MARTÍNEZ SOFÍA', 'LOMS150724MDFPRN02', 'padre.lopez@ejemplo.com', '5523456789'],
      [3, 'RAMÍREZ TORRES MATEO', 'RATM151105HDFMRN03', '', '5534567890'],
      [4, 'DE LA TORRE RUIZ MARÍA FERNANDA', 'TORM150918MDFLNN04', 'familia.torre@ejemplo.com', '5545678901']
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    ws1['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 24 }, { wch: 32 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, `${sampleGrade1} ${sampleGroupA} ${sampleLevel}`);

    // Sheet 2
    const ws2Data = [
      ['COLEGIO / CONTROL INTEGRAL ESCOLAR - LISTA DE ALUMNOS'],
      [`NIVEL: ${sampleLevel}`, `GRADO: ${sampleGrade1}`, `GRUPO: ${sampleGroupB}`, 'CICLO: ' + (currentCycle?.name || '2024-2025')],
      [],
      ['#', 'Nombre del Alumno (Apellidos y Nombres)', 'CURP (Opcional)', 'Correo Tutor (Opcional)', 'Teléfono (Opcional)'],
      [1, 'ALONSO CASTILLO RODRIGO', 'AOCR150210HDFRNN01', 'familia.alonso@ejemplo.com', '5511223344'],
      [2, 'BENÍTEZ MORALES VALENTINA', 'BEMV150415MDFPRN02', 'tutor.benitez@ejemplo.com', '5522334455'],
      [3, 'CASTRO DEL VALLE SANTIAGO', 'CADS150620HDFMRN03', '', '5533445566']
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 24 }, { wch: 32 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, `${sampleGrade1} ${sampleGroupB} ${sampleLevel}`);

    // Sheet 3 (Separate columns)
    const ws3Data = [
      ['COLEGIO / CONTROL INTEGRAL ESCOLAR - LISTA DE ALUMNOS'],
      [`NIVEL: ${sampleLevel}`, `GRADO: ${sampleGrade2}`, `GRUPO: ${sampleGroupA}`, 'CICLO: ' + (currentCycle?.name || '2024-2025')],
      [],
      ['#', 'Apellido Paterno', 'Apellido Materno', 'Nombre(s)', 'CURP', 'Correo Tutor', 'Teléfono'],
      [1, 'DOMÍNGUEZ', 'SANABRIA', 'CAMILA', 'DOSC140510MDFRNN01', 'dominguez@ejemplo.com', '5544556677'],
      [2, 'ESPINOZA', 'FLORES', 'LEONARDO', 'ESFL140812HDFPRN02', '', '5555667788']
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
    ws3['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 24 }, { wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, `${sampleGrade2} ${sampleGroupA} (Columnas)`);

    XLSX.writeFile(wb, 'Plantilla_Alumnos_Estructura_Global.xlsx');
  };

  // Smart Spanish / Mexican name splitter
  const splitFullName = (fullName: string, order: 'paternal_first' | 'given_first') => {
    if (!fullName) return { lastName: '', motherLastName: '', name: '' };

    const clean = fullName.replace(/\s+/g, ' ').trim();
    if (!clean) return { lastName: '', motherLastName: '', name: '' };

    const rawTokens = clean.split(' ');
    const tokens: string[] = [];
    const particles = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'SAN', 'SANTA', 'VON', 'VAN', 'MC', 'MAC']);

    for (let i = 0; i < rawTokens.length; i++) {
      let t = rawTokens[i];
      while (i + 1 < rawTokens.length && particles.has(t.toUpperCase())) {
        i++;
        t = `${t} ${rawTokens[i]}`;
      }
      tokens.push(t);
    }

    if (tokens.length === 1) {
      return { lastName: tokens[0], motherLastName: '', name: tokens[0] };
    }

    if (order === 'paternal_first') {
      if (tokens.length === 2) {
        return { lastName: tokens[0], motherLastName: '', name: tokens[1] };
      }
      if (tokens.length === 3) {
        return { lastName: tokens[0], motherLastName: tokens[1], name: tokens[2] };
      }
      return {
        lastName: tokens[0],
        motherLastName: tokens[1],
        name: tokens.slice(2).join(' ')
      };
    } else {
      if (tokens.length === 2) {
        return { name: tokens[0], lastName: tokens[1], motherLastName: '' };
      }
      if (tokens.length === 3) {
        return { name: tokens[0], lastName: tokens[1], motherLastName: tokens[2] };
      }
      return {
        name: tokens.slice(0, tokens.length - 2).join(' '),
        lastName: tokens[tokens.length - 2],
        motherLastName: tokens[tokens.length - 1]
      };
    }
  };

  // Detect metadata from rows and sheet name, then NORMALIZE to Estructura Académica Global
  const detectAndNormalizeMetadata = (sheetName: string, rows: any[][]) => {
    let rawLevel = '';
    let rawGrade = '';
    let rawGroup = '';

    const scanLimit = Math.min(rows.length, 12);
    const standardLevels = ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato', 'Preparatoria', 'Maternal'];

    for (let r = 0; r < scanLimit; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (!val) continue;

        const valLower = val.toLowerCase();

        // 1. Detect Level
        if (!rawLevel) {
          if (valLower.includes('nivel')) {
            const match = val.match(/nivel\s*[:\s-]+\s*([A-Za-zÁÉÍÓÚáéíóúñÑ]+)/i);
            if (match && match[1]) {
              rawLevel = match[1].trim();
            } else if (c + 1 < row.length && String(row[c + 1] || '').trim()) {
              rawLevel = String(row[c + 1]).trim();
            }
          } else {
            for (const lvl of standardLevels) {
              if (new RegExp(`\\b${lvl}\\b`, 'i').test(val)) {
                rawLevel = lvl;
                break;
              }
            }
          }
        }

        // 2. Detect Grade
        if (!rawGrade) {
          if (valLower.includes('grado')) {
            const match = val.match(/grado\s*[:\s-]+\s*([0-9A-Za-z°º]+)/i);
            if (match && match[1]) {
              rawGrade = match[1].trim();
            } else if (c + 1 < row.length && String(row[c + 1] || '').trim()) {
              rawGrade = String(row[c + 1]).trim();
            }
          } else {
            const match = val.match(/\b([1-6]°|[1-6]º|[1-6]ro|[1-6]do|[1-6]to|primero|segundo|tercero|cuarto|quinto|sexto)\b/i);
            if (match) {
              rawGrade = match[1].trim();
            }
          }
        }

        // 3. Detect Group
        if (!rawGroup) {
          if (valLower.includes('grupo')) {
            const match = val.match(/grupo\s*[:\s-]+\s*([A-Za-z0-9]+)/i);
            if (match && match[1]) {
              rawGroup = match[1].toUpperCase().trim();
            } else if (c + 1 < row.length && String(row[c + 1] || '').trim()) {
              rawGroup = String(row[c + 1]).toUpperCase().trim();
            }
          }
        }
      }
    }

    // Complement from sheet name if not found in header
    const sLower = sheetName.toLowerCase();
    if (!rawLevel) {
      if (sLower.includes('preescolar') || sLower.includes('kinder')) rawLevel = 'Preescolar';
      else if (sLower.includes('primaria') || sLower.includes('prim')) rawLevel = 'Primaria';
      else if (sLower.includes('secundaria') || sLower.includes('sec')) rawLevel = 'Secundaria';
      else if (sLower.includes('bachillerato') || sLower.includes('prepa')) rawLevel = 'Bachillerato';
      else if (sLower.includes('maternal')) rawLevel = 'Maternal';
    }

    if (!rawGrade) {
      const match = sheetName.match(/\b([1-6])(?:°|º|ro|do|to)?\b/i) || sheetName.match(/(\d+)/);
      if (match) {
        rawGrade = match[0];
      }
    }

    if (!rawGroup) {
      const match = sheetName.match(/(?:grupo\s*|[-_\s])?([A-Za-z])(?:\s|$)/i) || sheetName.match(/\d+([A-Za-z])/i);
      if (match) {
        rawGroup = match[1].toUpperCase();
      }
    }

    // =========================================================================
    // NORMALIZE DIRECTLY AGAINST GLOBAL ACADEMIC STRUCTURE (Ajustes)
    // =========================================================================
    const normalizedLevel = matchAcademicLevel(rawLevel, globalLevels);
    const normalizedGrade = matchAcademicGrade(rawGrade, globalGrades);
    const normalizedGroup = matchAcademicGroup(rawGroup, globalGroups);

    return {
      level: normalizedLevel,
      grade: normalizedGrade,
      group: normalizedGroup
    };
  };

  // Find table header row index and map columns
  const analyzeColumnsAndHeader = (rows: any[][]) => {
    let bestHeaderIdx = -1;
    let maxMatches = 0;
    let detectedOrder: 'paternal_first' | 'given_first' | 'columns' = 'paternal_first';

    const colMap: Record<string, number> = {};
    const scanLimit = Math.min(rows.length, 20);

    for (let r = 0; r < scanLimit; r++) {
      const row = rows[r] || [];
      let matches = 0;
      const currentMap: Record<string, number> = {};

      row.forEach((cellVal, idx) => {
        const text = String(cellVal || '').trim().toLowerCase();
        if (!text) return;

        if (text.includes('paterno') || text.includes('primer apellido')) {
          currentMap['paterno'] = idx;
          matches += 2;
        } else if (text.includes('materno') || text.includes('segundo apellido')) {
          currentMap['materno'] = idx;
          matches += 2;
        } else if (
          text.includes('nombre del alumno') ||
          text.includes('nombre completo') ||
          text.includes('apellidos y nombres') ||
          text.includes('alumno') ||
          text === 'nombre' ||
          text === 'nombres'
        ) {
          currentMap['name'] = idx;
          matches += 2;
        }

        if (text.includes('curp')) {
          currentMap['curp'] = idx;
          matches += 1;
        }
        if (text.includes('correo') || text.includes('email') || text.includes('tutor') || text.includes('padre')) {
          currentMap['parentEmail'] = idx;
          matches += 1;
        }
        if (text.includes('tel') || text.includes('cel') || text.includes('telefono') || text.includes('teléfono')) {
          currentMap['phone'] = idx;
          matches += 1;
        }
        if (text.includes('matricula') || text.includes('matrícula')) {
          currentMap['matricula'] = idx;
          matches += 1;
        }
      });

      if (matches > maxMatches) {
        maxMatches = matches;
        bestHeaderIdx = r;
        Object.assign(colMap, currentMap);
      }
    }

    if (colMap['paterno'] !== undefined && colMap['name'] !== undefined) {
      detectedOrder = 'columns';
    } else {
      detectedOrder = 'paternal_first';
    }

    return {
      headerRowIndex: bestHeaderIdx >= 0 ? bestHeaderIdx : 3,
      columnMap: colMap,
      nameOrder: detectedOrder
    };
  };

  // Convert raw rows to parsed students based on columnMap & nameOrder
  const buildStudentsFromRows = (
    rows: any[][],
    startIdx: number,
    cMap: Record<string, number>,
    order: 'paternal_first' | 'given_first' | 'columns',
    targetLevel: string,
    usedGlobalMatriculas: Set<string>,
    usedGlobalCodes: Set<string>
  ) => {
    const list: ParsedStudentRow[] = [];
    const skipKeywords = ['total', 'firma', 'profesor', 'maestro', 'docente', 'director', 'alumnos:', 'promedio', 'observaciones'];

    for (let r = startIdx; r < rows.length; r++) {
      const row = rows[r] || [];
      if (row.length === 0) continue;

      let lastName = '';
      let motherLastName = '';
      let name = '';
      let curp = '';
      let parentEmail = '';
      let phone = '';
      let explicitMatricula = '';

      if (order === 'columns' && cMap['paterno'] !== undefined) {
        lastName = String(row[cMap['paterno']] || '').trim();
        motherLastName = cMap['materno'] !== undefined ? String(row[cMap['materno']] || '').trim() : '';
        name = cMap['name'] !== undefined ? String(row[cMap['name']] || '').trim() : '';
      } else {
        let fullText = '';
        if (cMap['name'] !== undefined && row[cMap['name']]) {
          fullText = String(row[cMap['name']]).trim();
        } else {
          for (const cell of row) {
            const str = String(cell || '').trim();
            if (str && isNaN(Number(str)) && str.length > 5 && !skipKeywords.some(k => str.toLowerCase().includes(k))) {
              fullText = str;
              break;
            }
          }
        }

        const split = splitFullName(fullText, order === 'given_first' ? 'given_first' : 'paternal_first');
        lastName = split.lastName;
        motherLastName = split.motherLastName;
        name = split.name;
      }

      const testString = `${lastName} ${motherLastName} ${name}`.trim().toLowerCase();
      if (!testString || testString.length < 3) continue;
      if (skipKeywords.some(k => testString.includes(k))) continue;

      if (cMap['curp'] !== undefined && row[cMap['curp']]) {
        curp = String(row[cMap['curp']]).trim().toUpperCase();
      }
      if (cMap['parentEmail'] !== undefined && row[cMap['parentEmail']]) {
        parentEmail = String(row[cMap['parentEmail']]).trim().toLowerCase();
      }
      if (cMap['phone'] !== undefined && row[cMap['phone']]) {
        phone = String(row[cMap['phone']]).trim();
      }
      if (cMap['matricula'] !== undefined && row[cMap['matricula']]) {
        explicitMatricula = String(row[cMap['matricula']]).trim();
      }

      let isDuplicate = false;
      let duplicateReason = '';

      const dupMatch = existingStudents.find(s => {
        if (curp && s.curp && s.curp === curp) return true;
        const sFull = `${s.name} ${s.lastName} ${s.motherLastName || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
        const curFull = `${name} ${lastName} ${motherLastName}`.toLowerCase().replace(/\s+/g, ' ').trim();
        return sFull === curFull;
      });

      if (dupMatch) {
        isDuplicate = true;
        duplicateReason = `Ya registrado: ${dupMatch.name} ${dupMatch.lastName} (${dupMatch.level} ${dupMatch.grade})`;
      }

      const matricula = explicitMatricula || createMatriculaCode(targetLevel, usedGlobalMatriculas);
      const registrationCode = createRegistrationCode(usedGlobalCodes);

      list.push({
        id: `row-${r}-${Math.random().toString(36).substring(2, 7)}`,
        lastName: lastName.toUpperCase(),
        motherLastName: motherLastName.toUpperCase(),
        name: name.toUpperCase(),
        curp,
        parentEmail,
        phone,
        matricula,
        registrationCode,
        isDuplicate,
        duplicateReason,
        selected: !isDuplicate
      });
    }

    return list;
  };

  // Process all sheets in the Excel file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingFile(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);

        const usedGlobalMatriculas = new Set<string>();
        const usedGlobalCodes = new Set<string>();

        const parsedSheets: SheetState[] = wb.SheetNames.map((sName) => {
          const ws = wb.Sheets[sName];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

          // Normalize level, grade, group against Estructura Académica Global
          const meta = detectAndNormalizeMetadata(sName, rows);
          const analysis = analyzeColumnsAndHeader(rows);

          const students = buildStudentsFromRows(
            rows,
            analysis.headerRowIndex + 1,
            analysis.columnMap,
            analysis.nameOrder,
            meta.level,
            usedGlobalMatriculas,
            usedGlobalCodes
          );

          return {
            sheetName: sName,
            level: meta.level,
            grade: meta.grade,
            group: meta.group,
            nameOrder: analysis.nameOrder,
            students,
            rawRows: rows,
            headerRowIndex: analysis.headerRowIndex,
            columnMap: analysis.columnMap,
            isImported: false
          };
        });

        const validSheets = parsedSheets.filter(s => s.students.length > 0);
        const finalSheets = validSheets.length > 0 ? validSheets : parsedSheets;

        setSheets(finalSheets);
        setActiveSheetIndex(0);
      } catch (err) {
        console.error('Error procesando Excel:', err);
        alert('Hubo un error al leer el archivo Excel. Asegúrate de que no esté protegido con contraseña o dañado.');
      } finally {
        setLoadingFile(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Update metadata for active sheet
  const handleUpdateActiveSheetMeta = (field: 'level' | 'grade' | 'group' | 'nameOrder', val: any) => {
    setSheets(prev => {
      const copy = [...prev];
      const cur = { ...copy[activeSheetIndex], [field]: val };

      if (field === 'nameOrder' || field === 'level') {
        const usedMatriculas = new Set<string>();
        const usedCodes = new Set<string>();
        cur.students = buildStudentsFromRows(
          cur.rawRows,
          cur.headerRowIndex + 1,
          cur.columnMap,
          cur.nameOrder,
          cur.level,
          usedMatriculas,
          usedCodes
        );
      }

      copy[activeSheetIndex] = cur;
      return copy;
    });
  };

  // Edit student inline in active sheet
  const handleUpdateStudent = (id: string, field: keyof ParsedStudentRow, val: any) => {
    setSheets(prev => {
      const copy = [...prev];
      const cur = copy[activeSheetIndex];
      cur.students = cur.students.map(s => (s.id === id ? { ...s, [field]: val } : s));
      copy[activeSheetIndex] = { ...cur };
      return copy;
    });
  };

  // Delete row in active sheet
  const handleDeleteRow = (id: string) => {
    setSheets(prev => {
      const copy = [...prev];
      const cur = copy[activeSheetIndex];
      cur.students = cur.students.filter(s => s.id !== id);
      copy[activeSheetIndex] = { ...cur };
      return copy;
    });
  };

  // Toggle selection in active sheet
  const handleToggleSelectAll = (checked: boolean) => {
    setSheets(prev => {
      const copy = [...prev];
      const cur = copy[activeSheetIndex];
      cur.students = cur.students.map(s => ({
        ...s,
        selected: checked ? (skipDuplicates ? !s.isDuplicate : true) : false
      }));
      copy[activeSheetIndex] = { ...cur };
      return copy;
    });
  };

  // Execute import for a given list of sheets
  const executeBatchImport = async (targetSheets: SheetState[], isAllSheets: boolean) => {
    const toImportRecords: { sheet: SheetState; student: ParsedStudentRow }[] = [];

    targetSheets.forEach(sheet => {
      sheet.students
        .filter(s => s.selected)
        .forEach(student => {
          toImportRecords.push({ sheet, student });
        });
    });

    if (toImportRecords.length === 0) {
      alert('No hay alumnos seleccionados para importar.');
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: toImportRecords.length, message: 'Iniciando guardado...' });

    try {
      const now = new Date();
      const enrollmentMonth = now.getMonth();
      const enrollmentYear = now.getFullYear();

      const chunkSize = 400; // Firestore batch limit is 500
      let importedCount = 0;

      for (let i = 0; i < toImportRecords.length; i += chunkSize) {
        const chunk = toImportRecords.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const docRef = doc(collection(db, 'students'));
          batch.set(docRef, {
            name: item.student.name.trim(),
            lastName: item.student.lastName.trim(),
            motherLastName: item.student.motherLastName ? item.student.motherLastName.trim() : '',
            curp: item.student.curp ? item.student.curp.trim().toUpperCase() : '',
            level: item.sheet.level.trim(),
            grade: item.sheet.grade.trim(),
            group: item.sheet.group.trim() || '',
            cycleId: cycleId || settings?.currentCycleId || '',
            matricula: item.student.matricula.trim(),
            registrationCode: item.student.registrationCode,
            parentEmail: item.student.parentEmail ? item.student.parentEmail.trim().toLowerCase() : '',
            phone: item.student.phone ? item.student.phone.trim() : '',
            birthDate: '',
            gender: 'H',
            birthState: 'MC',
            taxSystem: '605',
            enrollmentMonth,
            enrollmentYear,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        await batch.commit();
        importedCount += chunk.length;
        setImportProgress({
          current: importedCount,
          total: toImportRecords.length,
          message: `Guardando registros... (${importedCount} de ${toImportRecords.length})`
        });
      }

      // Mark imported sheets
      const targetSheetNames = new Set(targetSheets.map(s => s.sheetName));
      setSheets(prev =>
        prev.map(s => {
          if (targetSheetNames.has(s.sheetName)) {
            const count = s.students.filter(st => st.selected).length;
            return { ...s, isImported: true, importedCount: count };
          }
          return s;
        })
      );

      onSuccess();

      if (isAllSheets || targetSheets.length === sheets.length) {
        alert(`¡Importación masiva completada! Se guardaron ${importedCount} alumnos en ${targetSheets.length} pestañas/grupos perfectamente vinculados a la Estructura Académica Global.`);
        onClose();
      } else {
        alert(`¡Pestaña "${targetSheets[0].sheetName}" importada con éxito! Se registraron ${importedCount} alumnos en ${targetSheets[0].level} ${targetSheets[0].grade} ${targetSheets[0].group}.`);
        const nextIndex = sheets.findIndex((s, idx) => idx !== activeSheetIndex && !s.isImported);
        if (nextIndex >= 0) {
          setActiveSheetIndex(nextIndex);
        }
      }
    } catch (error) {
      console.error('Error al importar alumnos:', error);
      alert('Ocurrió un error al guardar los alumnos en el sistema. Revisa la conexión o intenta con menos registros.');
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleImportCurrentSheet = () => {
    if (!activeSheet) return;
    executeBatchImport([activeSheet], false);
  };

  const handleImportAllSheets = () => {
    const pendingSheets = sheets.filter(s => !s.isImported && s.students.some(st => st.selected));
    if (pendingSheets.length === 0) {
      alert('Todas las pestañas ya fueron importadas o no tienen alumnos seleccionados.');
      return;
    }
    executeBatchImport(pendingSheets, true);
  };

  // Active sheet calculations
  const activeStudents = activeSheet?.students || [];
  const selectedCount = activeStudents.filter(s => s.selected).length;
  const duplicateCount = activeStudents.filter(s => s.isDuplicate).length;

  const totalAllStudents = sheets.reduce((acc, s) => acc + s.students.filter(st => st.selected).length, 0);
  const pendingSheetsCount = sheets.filter(s => !s.isImported).length;

  const filteredPreview = activeStudents.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.lastName.toLowerCase().includes(term) ||
      s.motherLastName.toLowerCase().includes(term) ||
      (s.curp && s.curp.toLowerCase().includes(term)) ||
      s.matricula.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
                  <Link2 size={10} />
                  Enlazado con Estructura Académica Global
                </span>
                <span className="text-[10px] font-bold text-slate-400">Excel / .xlsx / .xls</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Importar Lista de Alumnos desde Excel
                {sheets.length > 1 && (
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/50">
                    {sheets.length} pestañas
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
              title="Descargar plantilla de Excel adaptada a la Estructura Académica Global"
            >
              <Download size={13} className="text-emerald-400" />
              Descargar Plantilla
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Step 1: Upload or File info */}
          {!sheets.length ? (
            <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all flex flex-col items-center justify-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-file-input"
              />
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                <Upload size={32} />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-black text-slate-900">
                  Selecciona o arrastra tu archivo de Excel
                </h3>
                <p className="text-xs text-slate-500">
                  El sistema analizará el encabezado de cada pestaña y <span className="font-bold text-indigo-700">vinculará automáticamente el nivel, grado y grupo con la Estructura Académica Global configurada en Ajustes</span> para que todo se enlace sin errores con Control Escolar y listas oficiales.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label
                  htmlFor="excel-file-input"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2"
                >
                  <FileSpreadsheet size={15} />
                  Examinar Archivo
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Download size={14} className="text-slate-500" />
                  Descargar Plantilla Adaptada
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-indigo-700 bg-indigo-50/80 px-4 py-2 rounded-lg border border-indigo-100 mt-2">
                <GraduationCap size={14} className="text-indigo-600" />
                <span>
                  Estructura detectada en Ajustes: <strong>{globalLevels.length} niveles</strong>, <strong>{globalGrades.length} grados</strong> y <strong>{globalGroups.length} grupos</strong>.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* File Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
                      Archivo cargado
                    </span>
                    <span className="text-xs font-black text-slate-900">{fileName}</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                    <Layers size={13} className="text-indigo-600" />
                    <span>{sheets.length} pestaña{sheets.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSheets([]);
                      setWorkbook(null);
                      setFileName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    Cambiar Archivo
                  </button>
                </div>
              </div>

              {/* Multi-Tab Selector Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Layers size={13} className="text-emerald-600" />
                    Pestañas del Archivo ({sheets.length}):
                  </span>
                  {sheets.length > 1 && (
                    <span className="text-[11px] text-slate-500">
                      Haz clic en cada pestaña para revisar o importar sus alumnos individualmente.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-thin">
                  {sheets.map((sheet, idx) => {
                    const isActive = idx === activeSheetIndex;
                    const count = sheet.students.length;
                    return (
                      <button
                        key={sheet.sheetName}
                        type="button"
                        onClick={() => setActiveSheetIndex(idx)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <span className="truncate max-w-[140px]">{sheet.sheetName}</span>
                        
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${
                          isActive ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {sheet.level} {sheet.grade} "{sheet.group}"
                        </span>

                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-200/80 text-slate-700'
                        }`}>
                          {count}
                        </span>

                        {sheet.isImported && (
                          <span className="text-emerald-500 font-black text-xs" title="Pestaña ya importada">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeSheet && (
                <>
                  {/* Active Sheet Meta & Settings - STRICTLY LINKED WITH GLOBAL ACADEMIC STRUCTURE */}
                  <div className="bg-indigo-50/40 border border-indigo-200/70 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GraduationCap size={16} className="text-indigo-600" />
                        <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                          Vinculación con Estructura Académica Global para: "{activeSheet.sheetName}"
                        </span>
                        <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                          <Check size={10} className="text-indigo-600" /> Enlazado con Ajustes
                        </span>
                        {activeSheet.isImported && (
                          <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check size={10} /> Ya Importada ({activeSheet.importedCount} alumnos)
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-indigo-800/80">
                        Opciones validadas contra los Niveles, Grados y Grupos de Control Escolar:
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                          Nivel Educativo (Global)
                        </label>
                        <select
                          value={activeSheet.level}
                          onChange={(e) => handleUpdateActiveSheetMeta('level', e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        >
                          {globalLevels.map(lvl => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                          ))}
                          {!globalLevels.includes(activeSheet.level) && (
                            <option value={activeSheet.level}>{activeSheet.level} (Detectado)</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                          Grado (Global)
                        </label>
                        <select
                          value={activeSheet.grade}
                          onChange={(e) => handleUpdateActiveSheetMeta('grade', e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        >
                          {globalGrades.map(grd => (
                            <option key={grd} value={grd}>{grd}</option>
                          ))}
                          {!globalGrades.includes(activeSheet.grade) && (
                            <option value={activeSheet.grade}>{activeSheet.grade} (Detectado)</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                          Grupo (Global)
                        </label>
                        <select
                          value={activeSheet.group}
                          onChange={(e) => handleUpdateActiveSheetMeta('group', e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        >
                          {globalGroups.map(grp => (
                            <option key={grp} value={grp}>{grp}</option>
                          ))}
                          {!globalGroups.includes(activeSheet.group) && (
                            <option value={activeSheet.group}>{activeSheet.group} (Detectado)</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                          Ciclo Escolar
                        </label>
                        <select
                          value={cycleId}
                          onChange={(e) => setCycleId(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        >
                          {cycles.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.id === settings?.currentCycleId ? '(Activo)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Name format controls */}
                    <div className="pt-2 border-t border-indigo-200/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 text-[11px]">Orden del nombre en esta pestaña:</span>
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleUpdateActiveSheetMeta('nameOrder', 'paternal_first')}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              activeSheet.nameOrder === 'paternal_first'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Apellidos Primero (SEP)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateActiveSheetMeta('nameOrder', 'given_first')}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              activeSheet.nameOrder === 'given_first'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Nombre(s) Primero
                          </button>
                          {activeSheet.columnMap['paterno'] !== undefined && (
                            <button
                              type="button"
                              onClick={() => handleUpdateActiveSheetMeta('nameOrder', 'columns')}
                              className={`px-2.5 py-1 rounded-md transition-all ${
                                activeSheet.nameOrder === 'columns'
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Columnas Separadas
                            </button>
                          )}
                        </div>
                      </div>

                      {duplicateCount > 0 && (
                        <label className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={skipDuplicates}
                            onChange={(e) => {
                              setSkipDuplicates(e.target.checked);
                              if (e.target.checked) {
                                setSheets(prev => {
                                  const copy = [...prev];
                                  const cur = copy[activeSheetIndex];
                                  cur.students = cur.students.map(s => ({
                                    ...s,
                                    selected: s.isDuplicate ? false : s.selected
                                  }));
                                  copy[activeSheetIndex] = { ...cur };
                                  return copy;
                                });
                              }
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Omitir {duplicateCount} alumno(s) ya existentes</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Active Sheet Students Preview */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-800">
                          Alumnos en "{activeSheet.sheetName}":
                        </span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {selectedCount} de {activeStudents.length} seleccionados
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleSelectAll(selectedCount !== activeStudents.length)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      >
                        {selectedCount === activeStudents.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    </div>

                    <div className="relative min-w-[240px]">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Filtrar por nombre en esta pestaña..."
                        className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-slate-800"
                      />
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={selectedCount === activeStudents.length && activeStudents.length > 0}
                              onChange={(e) => handleToggleSelectAll(e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </th>
                          <th className="py-2.5 px-2 w-8 text-center text-slate-400">#</th>
                          <th className="py-2.5 px-3">Apellido Paterno</th>
                          <th className="py-2.5 px-3">Apellido Materno</th>
                          <th className="py-2.5 px-3">Nombre(s)</th>
                          <th className="py-2.5 px-3">CURP</th>
                          <th className="py-2.5 px-3">Matrícula</th>
                          <th className="py-2.5 px-3">Cód. Acceso</th>
                          <th className="py-2.5 px-3">Correo Tutor</th>
                          <th className="py-2.5 px-3">Estatus</th>
                          <th className="py-2.5 px-2 w-8 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredPreview.map((student, idx) => (
                          <tr
                            key={student.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              student.isDuplicate ? 'bg-amber-50/40' : ''
                            } ${!student.selected ? 'opacity-60 bg-slate-50/40' : ''}`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={student.selected}
                                onChange={(e) => handleUpdateStudent(student.id, 'selected', e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="py-2 px-2 text-center text-[10px] font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={student.lastName}
                                onChange={(e) => handleUpdateStudent(student.id, 'lastName', e.target.value.toUpperCase())}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-800 focus:bg-white px-1 py-0.5 font-bold text-slate-900 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={student.motherLastName}
                                onChange={(e) => handleUpdateStudent(student.id, 'motherLastName', e.target.value.toUpperCase())}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-800 focus:bg-white px-1 py-0.5 font-bold text-slate-800 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={student.name}
                                onChange={(e) => handleUpdateStudent(student.id, 'name', e.target.value.toUpperCase())}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-800 focus:bg-white px-1 py-0.5 font-black text-slate-900 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={student.curp || ''}
                                placeholder="SIN CURP"
                                onChange={(e) => handleUpdateStudent(student.id, 'curp', e.target.value.toUpperCase())}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-800 focus:bg-white px-1 py-0.5 font-mono text-[11px] text-slate-600 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2 font-mono text-[11px] font-bold text-slate-700">
                              {student.matricula}
                            </td>
                            <td className="py-2 px-2 font-mono text-[11px] font-bold text-indigo-600">
                              {student.registrationCode}
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="email"
                                value={student.parentEmail || ''}
                                placeholder="Opcional"
                                onChange={(e) => handleUpdateStudent(student.id, 'parentEmail', e.target.value.toLowerCase())}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-800 focus:bg-white px-1 py-0.5 text-[11px] text-slate-600 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2">
                              {student.isDuplicate ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded cursor-help"
                                  title={student.duplicateReason}
                                >
                                  <AlertTriangle size={10} />
                                  Existe
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  <Check size={10} />
                                  Nuevo
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(student.id)}
                                className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                                title="Descartar alumno"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {activeSheet ? (
              <span>
                Asignación Global: <strong className="text-indigo-950 font-black">{activeSheet.level}</strong> &gt; <strong className="text-indigo-950 font-black">{activeSheet.grade}</strong> &gt; Grupo <strong className="text-indigo-950 font-black">"{activeSheet.group}"</strong> ({selectedCount} alumnos).
              </span>
            ) : (
              <span>Sube un archivo Excel para comenzar.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cerrar
            </button>

            {sheets.length > 1 && (
              <button
                type="button"
                onClick={handleImportAllSheets}
                disabled={importing || totalAllStudents === 0 || pendingSheetsCount === 0}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-900 border border-slate-300 bg-white hover:bg-slate-100 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                  importing || totalAllStudents === 0 || pendingSheetsCount === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : 'active:scale-95'
                }`}
              >
                <Layers size={14} className="text-emerald-600" />
                <span>Importar Todas ({totalAllStudents} en {pendingSheetsCount} hojas)</span>
              </button>
            )}

            {activeSheet && (
              <button
                type="button"
                onClick={handleImportCurrentSheet}
                disabled={importing || selectedCount === 0}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  importing || selectedCount === 0
                    ? 'bg-slate-400 cursor-not-allowed opacity-70'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/30 active:scale-95'
                }`}
              >
                {importing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>
                      {importProgress?.message || `Guardando... (${importProgress?.current}/${importProgress?.total})`}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>
                      {sheets.length > 1 ? `Importar solo "${activeSheet.sheetName}" (${selectedCount})` : `Importar ${selectedCount} Alumnos`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
