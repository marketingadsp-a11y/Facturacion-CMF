import React, { useState, useMemo } from 'react';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Student } from '../types';
import {
  X,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  Info,
  ShieldAlert,
  Edit3
} from 'lucide-react';
import { toast } from 'react-toastify';
import { cn } from '../lib/utils';

// ─── Normalization Helper ───────────────────────────────────────────────────
export function normalizeStudentName(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Match Finding Algorithm ────────────────────────────────────────────────
export function findStudentMatch(
  pastedName: string,
  pastedCurp: string,
  students: Student[]
): { student: Student | null; matchType: 'name_exact' | 'name_tokens' | 'curp_exact' | null } {
  const normPasted = normalizeStudentName(pastedName);
  const cleanCurp = pastedCurp ? pastedCurp.trim().toUpperCase() : '';

  // 1. Direct match by CURP if provided (18 alphanumeric chars)
  if (cleanCurp && cleanCurp.length === 18) {
    const curpMatch = students.find(s => s.curp && s.curp.trim().toUpperCase() === cleanCurp);
    if (curpMatch) {
      return { student: curpMatch, matchType: 'curp_exact' };
    }
  }

  if (!normPasted) {
    return { student: null, matchType: null };
  }

  // 2. Direct match by normalized name variants
  const exactMatch = students.find(s => {
    // Variant A: Paternal + Maternal + Given Names (Standard format)
    const varA = normalizeStudentName(`${s.lastName || ''} ${s.motherLastName || ''} ${s.name || ''}`);
    // Variant B: Given Names + Paternal + Maternal
    const varB = normalizeStudentName(`${s.name || ''} ${s.lastName || ''} ${s.motherLastName || ''}`);
    // Variant C: Paternal + Given Names (without maternal)
    const varC = normalizeStudentName(`${s.lastName || ''} ${s.name || ''}`);
    // Variant D: Given Names + Paternal (without maternal)
    const varD = normalizeStudentName(`${s.name || ''} ${s.lastName || ''}`);

    return (
      normPasted === varA ||
      normPasted === varB ||
      normPasted === varC ||
      normPasted === varD
    );
  });

  if (exactMatch) {
    return { student: exactMatch, matchType: 'name_exact' };
  }

  // 3. Match by Token Set equality (same words regardless of order)
  const pastedTokens = normPasted.split(' ').filter(t => t.length > 1).sort().join(' ');
  const tokenMatch = students.find(s => {
    const full = normalizeStudentName(`${s.lastName || ''} ${s.motherLastName || ''} ${s.name || ''}`);
    const studentTokens = full.split(' ').filter(t => t.length > 1).sort().join(' ');
    return pastedTokens === studentTokens;
  });

  if (tokenMatch) {
    return { student: tokenMatch, matchType: 'name_tokens' };
  }

  return { student: null, matchType: null };
}

// ─── Interfaces ─────────────────────────────────────────────────────────────
export interface ParsedUpdateItem {
  id: string;
  rawLine: string;
  pastedName: string;
  pastedMatricula: string;
  pastedCurp: string;
  matchedStudent: Student | null;
  matchType: 'name_exact' | 'name_tokens' | 'curp_exact' | null;
  status: 'to_update' | 'no_change' | 'not_found';
  selected: boolean;
  hasMatriculaChange: boolean;
  hasCurpChange: boolean;
  warning?: string;
}

interface ImportStudentsDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onSuccess?: () => void;
  isSuperAdmin: boolean;
}

export default function ImportStudentsDataModal({
  isOpen,
  onClose,
  students,
  onSuccess,
  isSuperAdmin,
}: ImportStudentsDataModalProps) {
  const [step, setStep] = useState<'paste' | 'preview'>('paste');
  const [rawText, setRawText] = useState('');
  const [skipHeader, setSkipHeader] = useState(true);
  const [keepExistingIfEmpty, setKeepExistingIfEmpty] = useState(true);
  const [parsedItems, setParsedItems] = useState<ParsedUpdateItem[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'to_update' | 'no_change' | 'not_found'>('all');
  const [previewSearch, setPreviewSearch] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // ─── Filter & Selection Helpers (Must be declared before any conditional return) ───
  const filteredItems = useMemo(() => {
    return parsedItems.filter(item => {
      if (filterTab === 'to_update' && item.status !== 'to_update') return false;
      if (filterTab === 'no_change' && item.status !== 'no_change') return false;
      if (filterTab === 'not_found' && item.status !== 'not_found') return false;

      if (previewSearch.trim()) {
        const query = normalizeStudentName(previewSearch);
        const nameA = normalizeStudentName(item.pastedName);
        const nameB = item.matchedStudent 
          ? normalizeStudentName(`${item.matchedStudent.lastName || ''} ${item.matchedStudent.motherLastName || ''} ${item.matchedStudent.name || ''}`)
          : '';
        const mat = (item.pastedMatricula || '') + (item.matchedStudent?.matricula || '');
        const curp = (item.pastedCurp || '') + (item.matchedStudent?.curp || '');
        return nameA.includes(query) || nameB.includes(query) || mat.includes(query) || curp.includes(query);
      }

      return true;
    });
  }, [parsedItems, filterTab, previewSearch]);

  const stats = useMemo(() => {
    const toUpdate = parsedItems.filter(i => i.status === 'to_update').length;
    const noChange = parsedItems.filter(i => i.status === 'no_change').length;
    const notFound = parsedItems.filter(i => i.status === 'not_found').length;
    const selectedCount = parsedItems.filter(i => i.selected && i.status === 'to_update').length;
    return {
      total: parsedItems.length,
      toUpdate,
      noChange,
      notFound,
      selectedCount
    };
  }, [parsedItems]);

  if (!isOpen) return null;

  // Security gate: only Superadministrador
  if (!isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
          <ShieldAlert className="mx-auto text-rose-600" size={48} />
          <h3 className="text-lg font-black text-slate-900">Acceso Denegado</h3>
          <p className="text-xs text-slate-600">
            Esta función de importación masiva de datos está restringida exclusivamente para el usuario Superadministrador.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 1: Parse and Analyze Pasted Text ─────────────────────────────────
  const handleAnalyze = () => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      toast.error('Por favor pega al menos una fila copiada desde Excel.');
      return;
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error('No se detectaron líneas válidas en el texto pegado.');
      return;
    }

    let startIndex = 0;
    const colMap = { name: 0, matricula: 1, curp: 2 };

    // Detect header row
    const firstLineNorm = normalizeStudentName(lines[0]);
    if (
      skipHeader &&
      (firstLineNorm.includes('NOMBRE') ||
       firstLineNorm.includes('MATRICULA') ||
       firstLineNorm.includes('CURP'))
    ) {
      startIndex = 1;
      const headerCols = lines[0].split('\t').map(c => normalizeStudentName(c));
      headerCols.forEach((h, idx) => {
        if (h.includes('NOMBRE') || h.includes('ALUMNO')) colMap.name = idx;
        else if (h.includes('MATRICULA') || h.includes('SEP')) colMap.matricula = idx;
        else if (h.includes('CURP')) colMap.curp = idx;
      });
    }

    const results: ParsedUpdateItem[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      let cols: string[] = [];

      if (line.includes('\t')) {
        cols = line.split('\t').map(c => c.trim());
      } else if (line.includes(';') || line.includes(',')) {
        cols = line.split(/[,;]/).map(c => c.trim());
      } else {
        // Fallback: 2 or more spaces
        cols = line.split(/ {2,}/).map(c => c.trim());
      }

      const rawName = cols[colMap.name] || '';
      let rawMatricula = cols[colMap.matricula] || '';
      let rawCurp = cols[colMap.curp] || '';

      // Smart check: if matricula looks like a CURP and curp looks like matricula
      if (rawMatricula.length === 18 && rawCurp.length !== 18 && /^[A-Z]{4}/i.test(rawMatricula)) {
        const temp = rawMatricula;
        rawMatricula = rawCurp;
        rawCurp = temp;
      }

      const cleanMatricula = rawMatricula.trim();
      const cleanCurp = rawCurp.trim().toUpperCase();

      const { student, matchType } = findStudentMatch(rawName, cleanCurp, students);

      if (!student) {
        results.push({
          id: `row-${i}-${Date.now()}`,
          rawLine: line,
          pastedName: rawName,
          pastedMatricula: cleanMatricula,
          pastedCurp: cleanCurp,
          matchedStudent: null,
          matchType: null,
          status: 'not_found',
          selected: false,
          hasMatriculaChange: false,
          hasCurpChange: false,
          warning: 'No se encontró ningún alumno con este nombre en el sistema.'
        });
        continue;
      }

      const currentMatricula = (student.matricula || '').trim();
      const currentCurp = (student.curp || '').trim().toUpperCase();

      // Determine changes
      const hasMatriculaChange = cleanMatricula !== '' && cleanMatricula !== currentMatricula;
      const hasCurpChange = cleanCurp !== '' && cleanCurp !== currentCurp;

      const isChanged = hasMatriculaChange || hasCurpChange;

      results.push({
        id: `row-${i}-${student.id}`,
        rawLine: line,
        pastedName: rawName,
        pastedMatricula: cleanMatricula,
        pastedCurp: cleanCurp,
        matchedStudent: student,
        matchType,
        status: isChanged ? 'to_update' : 'no_change',
        selected: isChanged, // auto-select rows that actually have changes
        hasMatriculaChange,
        hasCurpChange
      });
    }

    if (results.length === 0) {
      toast.error('No se pudieron procesar las filas pegadas.');
      return;
    }

    setParsedItems(results);
    setStep('preview');
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setParsedItems(prev => prev.map(item => {
      if (item.status === 'to_update') {
        return { ...item, selected: checked };
      }
      return item;
    }));
  };

  const handleToggleRow = (id: string) => {
    setParsedItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, selected: !item.selected };
      }
      return item;
    }));
  };

  // ─── Step 3: Confirmation and Execution ───────────────────────────────────
  const handleConfirmAndApply = async () => {
    const itemsToApply = parsedItems.filter(i => i.selected && i.matchedStudent && i.status === 'to_update');

    if (itemsToApply.length === 0) {
      toast.warning('No hay ningún alumno seleccionado para actualizar.');
      return;
    }

    setIsApplying(true);
    try {
      let batch = writeBatch(db);
      let opCount = 0;
      const batches = [batch];

      for (const item of itemsToApply) {
        const student = item.matchedStudent!;
        const docRef = doc(db, 'students', student.id);

        const updateData: Record<string, any> = {
          updatedAt: serverTimestamp()
        };

        // Update matricula if provided or if allowed to overwrite
        if (item.pastedMatricula) {
          updateData.matricula = item.pastedMatricula.trim();
        } else if (!keepExistingIfEmpty) {
          updateData.matricula = '';
        }

        // Update curp if provided or if allowed to overwrite
        if (item.pastedCurp) {
          updateData.curp = item.pastedCurp.trim().toUpperCase();
        } else if (!keepExistingIfEmpty) {
          updateData.curp = '';
        }

        batch.update(docRef, updateData);
        opCount++;

        if (opCount % 400 === 0) {
          batch = writeBatch(db);
          batches.push(batch);
        }
      }

      for (const b of batches) {
        await b.commit();
      }

      toast.success(`¡Se actualizaron con éxito ${itemsToApply.length} alumnos!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error aplicando actualización masiva:', err);
      toast.error('Ocurrió un error al guardar los cambios en la base de datos.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* ── Modal Header ─────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-sm">
              <ClipboardPaste size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wider">
                  Importar Datos de Alumnos (Matrícula y CURP)
                </h2>
                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-widest rounded">
                  Superadministrador
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Copia y pega desde Excel columnas: <span className="text-slate-200 font-mono font-bold">NOMBRE | MATRÍCULA SEP | CURP</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isApplying}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Modal Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {step === 'paste' ? (
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Instructions Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
                <div className="flex items-center gap-2 font-black uppercase tracking-wider text-blue-950">
                  <Info size={16} className="text-blue-600 shrink-0" />
                  Instrucciones de Importación
                </div>
                <p className="text-blue-800 leading-relaxed font-medium">
                  1. En Excel selecciona las 3 columnas en orden: <strong>NOMBRE</strong>, <strong>MATRICULA SEP</strong> y <strong>CURP</strong>.
                  <br />
                  2. Copia las filas (<kbd className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-[10px]">Ctrl+C</kbd> o <kbd className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-[10px]">Cmd+C</kbd>) y pégalas directamente en el recuadro inferior.
                  <br />
                  3. El sistema buscará a los alumnos registrados por coincidencia de nombre (sin alterar el nombre que ya tienen en el sistema) y te mostrará una <strong>tabla de confirmación</strong> antes de aplicar cualquier cambio.
                </p>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <label htmlFor="pastedText" className="uppercase tracking-wider text-[11px] font-black text-slate-600">
                    Pegar texto de Excel (Tabulaciones / Separado por columnas)
                  </label>
                  {rawText && (
                    <button
                      type="button"
                      onClick={() => setRawText('')}
                      className="text-rose-600 hover:text-rose-700 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Limpiar texto
                    </button>
                  )}
                </div>

                <textarea
                  id="pastedText"
                  rows={14}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`NOMBRE\tMATRICULA SEP\tCURP\nALAMILLO DÁVILA IKER ALBERTO\t17974134\tAADI140205HJCLVKA5\nÁLVAREZ HERNÁNDEZ MARÍA JOSÉ\t18063492\tAAHJ140714MCMLRSA8\nRIVERO MENDOZA LUIS ALONSO\t\tRIML141003HJCVNSA8`}
                  className="w-full p-4 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner leading-relaxed"
                />
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={skipHeader}
                    onChange={(e) => setSkipHeader(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Omitir fila de encabezados si incluye "NOMBRE", "MATRICULA" o "CURP"
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={keepExistingIfEmpty}
                    onChange={(e) => setKeepExistingIfEmpty(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Conservar dato actual si la celda de Excel viene vacía (No borrar)
                  </span>
                </label>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!rawText.trim()}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles size={15} />
                  Analizar y Previsualizar Coincidencias
                </button>
              </div>
            </div>
          ) : (
            // ─── Step 2: Confirmation Table Preview ─────────────────────────
            <div className="space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Filas</span>
                  <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.total}</span>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl shadow-xs">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">Listos para Actualizar</span>
                  <span className="text-xl font-black text-emerald-700 mt-0.5 block">{stats.toUpdate}</span>
                </div>

                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl shadow-xs">
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest block">Ya Actualizados / Sin Cambios</span>
                  <span className="text-xl font-black text-blue-700 mt-0.5 block">{stats.noChange}</span>
                </div>

                <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl shadow-xs">
                  <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest block">No Encontrados</span>
                  <span className="text-xl font-black text-rose-700 mt-0.5 block">{stats.notFound}</span>
                </div>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                      filterTab === 'all'
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Todos ({stats.total})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab('to_update')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                      filterTab === 'to_update'
                        ? "bg-emerald-600 text-white"
                        : "text-emerald-700 hover:bg-emerald-50"
                    )}
                  >
                    Para Actualizar ({stats.toUpdate})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab('no_change')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                      filterTab === 'no_change'
                        ? "bg-blue-600 text-white"
                        : "text-blue-700 hover:bg-blue-50"
                    )}
                  >
                    Sin Cambios ({stats.noChange})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab('not_found')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                      filterTab === 'not_found'
                        ? "bg-rose-600 text-white"
                        : "text-rose-700 hover:bg-rose-50"
                    )}
                  >
                    No Encontrados ({stats.notFound})
                  </button>
                </div>

                <div className="relative min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Filtrar por nombre o matrícula..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Informative notice */}
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>
                  <strong>Importante:</strong> El nombre oficial de cada alumno en el sistema <strong>permanecerá intacto</strong>. Solo se actualizarán los campos de Matrícula y CURP de los alumnos marcados con casilla activa.
                </span>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={stats.toUpdate > 0 && stats.selectedCount === stats.toUpdate}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            title="Seleccionar todos los alumnos para actualizar"
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-2 w-8 text-center">#</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Nombre en Excel</th>
                        <th className="py-2.5 px-3">Alumno en Sistema</th>
                        <th className="py-2.5 px-3">Matrícula (Actual → Nueva)</th>
                        <th className="py-2.5 px-3">CURP (Actual → Nueva)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400 font-bold">
                            No hay registros para mostrar con el filtro seleccionado.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item, idx) => {
                          const st = item.matchedStudent;
                          const systemFullName = st
                            ? `${st.lastName || ''} ${st.motherLastName || ''} ${st.name || ''}`.trim()
                            : '';

                          return (
                            <tr
                              key={item.id}
                              className={cn(
                                "transition-colors",
                                item.status === 'to_update'
                                  ? (item.selected ? "bg-emerald-50/20 hover:bg-emerald-50/40" : "bg-white opacity-70")
                                  : item.status === 'no_change'
                                  ? "bg-slate-50/30 text-slate-600"
                                  : "bg-rose-50/30 text-rose-900"
                              )}
                            >
                              <td className="py-2 px-3 text-center">
                                {item.status === 'to_update' ? (
                                  <input
                                    type="checkbox"
                                    checked={item.selected}
                                    onChange={() => handleToggleRow(item.id)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>

                              <td className="py-2 px-2 text-center text-[10px] font-bold text-slate-400 font-mono">
                                {idx + 1}
                              </td>

                              {/* Status Badge */}
                              <td className="py-2 px-3 whitespace-nowrap">
                                {item.status === 'to_update' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <Check size={10} strokeWidth={3} />
                                    Actualizar
                                  </span>
                                ) : item.status === 'no_change' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                                    <CheckCircle2 size={10} />
                                    Sin Cambios
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                                    <XCircle size={10} />
                                    No Encontrado
                                  </span>
                                )}
                              </td>

                              {/* Pasted Name */}
                              <td className="py-2 px-3 font-mono text-[11px] font-bold text-slate-800">
                                {item.pastedName}
                              </td>

                              {/* System Student Info */}
                              <td className="py-2 px-3">
                                {st ? (
                                  <div>
                                    <span className="font-bold text-slate-900 block leading-tight">{systemFullName}</span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {st.level} • {st.grade}° "{st.group || 'U'}"
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-rose-500 text-[11px] italic">
                                    Sin coincidencia en la base de datos
                                  </span>
                                )}
                              </td>

                              {/* Matricula Change */}
                              <td className="py-2 px-3 font-mono text-[11px]">
                                {st ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn(
                                      "text-slate-500",
                                      item.hasMatriculaChange ? "line-through text-slate-400 text-[10px]" : ""
                                    )}>
                                      {st.matricula || '(Vacía)'}
                                    </span>
                                    {item.hasMatriculaChange ? (
                                      <>
                                        <ArrowRight size={11} className="text-emerald-600" />
                                        <span className="font-black text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                                          {item.pastedMatricula || '(Vacía)'}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 font-sans italic">(=)</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono">{item.pastedMatricula || '—'}</span>
                                )}
                              </td>

                              {/* CURP Change */}
                              <td className="py-2 px-3 font-mono text-[11px]">
                                {st ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn(
                                      "text-slate-500",
                                      item.hasCurpChange ? "line-through text-slate-400 text-[10px]" : ""
                                    )}>
                                      {st.curp || '(Vacía)'}
                                    </span>
                                    {item.hasCurpChange ? (
                                      <>
                                        <ArrowRight size={11} className="text-emerald-600" />
                                        <span className="font-black text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                                          {item.pastedCurp || '(Vacía)'}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 font-sans italic">(=)</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono">{item.pastedCurp || '—'}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer (Confirmation Controls) ─────────────────────────── */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {step === 'preview' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('paste')}
                disabled={isApplying}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 size={14} />
                Editar texto pegado
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isApplying}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndApply}
                  disabled={isApplying || stats.selectedCount === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApplying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Actualizando en Sistema...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} strokeWidth={3} />
                      <span>Confirmar y Actualizar {stats.selectedCount} Alumnos</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-400">
                Pega tus datos y presiona "Analizar" para ver la previsualización antes de aplicar.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

