import React, { useState, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import JSZip from 'jszip';
import { 
  X, 
  Loader2, 
  Check, 
  Download, 
  FolderArchive
} from 'lucide-react';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject } from '../types';
import ReportCardPDF from './ReportCardPDF';

export function getBoletaFileName(student: Student, level?: string, grade?: string, group?: string): string {
  // 1. Nombre y Apellido del Alumno
  const nameParts = [
    student.name,
    student.lastName,
    student.motherLastName
  ].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  
  const studentFullName = nameParts.join(' ');
  
  // 2. Nivel, Grado y Grupo
  const groupParts = [
    level || student.level,
    grade || student.grade,
    group || student.group
  ].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  
  const groupStr = groupParts.join(' ');
  
  // 3. Juntar con guión bajo y extensión .pdf
  const rawFileName = `${studentFullName}_${groupStr}.pdf`;
  
  // 4. Sanitizar caracteres no válidos para nombres de archivo
  return rawFileName
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

interface BatchBoletasModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  grades: StudentGrade[];
  subjects: Subject[];
  settings: AppSettings | null;
  cycle: SchoolCycle;
  level: string;
  grade: string;
  group: string;
}

export default function BatchBoletasModal({
  isOpen,
  onClose,
  students,
  grades,
  subjects,
  settings,
  cycle,
  level,
  grade,
  group
}: BatchBoletasModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: students.length,
    studentName: '',
    percent: 0,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const cancelRef = useRef(false);

  if (!isOpen) return null;

  const exampleFileName = students.length > 0 
    ? getBoletaFileName(students[0], level, grade, group)
    : `Alumno_${level || 'Nivel'} ${grade || 'Grado'} ${group || 'Grupo'}.pdf`;

  const handleStartDownload = async (mode: 'zip' | 'individual') => {
    setIsProcessing(true);
    setIsComplete(false);
    setErrors([]);
    cancelRef.current = false;

    const totalStudents = students.length;
    if (totalStudents === 0) {
      setIsProcessing(false);
      return;
    }

    const zip = mode === 'zip' ? new JSZip() : null;
    const failedStudents: string[] = [];

    for (let i = 0; i < totalStudents; i++) {
      if (cancelRef.current) break;

      const student = students[i];
      const studentFullName = [student.name, student.lastName, student.motherLastName]
        .filter(Boolean)
        .map(s => String(s).trim())
        .join(' ');

      const fileName = getBoletaFileName(student, level, grade, group);
      const percent = Math.round(((i + 1) / totalStudents) * (mode === 'zip' ? 90 : 100));

      setProgress({
        current: i + 1,
        total: totalStudents,
        studentName: studentFullName,
        percent,
      });

      const studentSubjects = subjects.filter(
        s => s.level?.toLowerCase().trim() === student.level?.toLowerCase().trim()
      );
      const studentGrades = grades.filter(
        g => g.studentId === student.id && g.cycleId === cycle.id
      );

      try {
        const docElement = (
          <ReportCardPDF
            student={student}
            grades={studentGrades}
            subjects={studentSubjects}
            settings={settings}
            cycle={cycle}
          />
        );

        const blob = await pdf(docElement).toBlob();

        if (mode === 'zip' && zip) {
          zip.file(fileName, blob);
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          
          await new Promise(r => setTimeout(r, 400));
        }
      } catch (err: any) {
        console.error(`Error generando boleta para ${studentFullName}:`, err);
        failedStudents.push(studentFullName);
      }

      await new Promise(r => setTimeout(r, 20));
    }

    if (cancelRef.current) {
      setIsProcessing(false);
      return;
    }

    if (mode === 'zip' && zip) {
      try {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipName = `Boletas_${level}_${grade}_${group || 'General'}.zip`
          .replace(/[/\\?%*:|"<>]/g, '-')
          .replace(/\s+/g, '_');

        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = zipName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      } catch (err: any) {
        console.error('Error generando zip:', err);
        failedStudents.push('Archivo ZIP');
      }
    }

    setErrors(failedStudents);
    setProgress(p => ({ ...p, percent: 100 }));
    setIsProcessing(false);
    setIsComplete(true);
  };

  const handleClose = () => {
    if (isProcessing) {
      cancelRef.current = true;
      setIsProcessing(false);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">
              Descargar Boletas
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {level} {grade} {group ? `"${group}"` : ''} • {students.length} alumnos
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Filename preview */}
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Formato de archivo:
            </span>
            <p className="font-mono text-slate-700 text-[10px] truncate font-semibold">
              {exampleFileName}
            </p>
          </div>

          {/* Processing progress */}
          {isProcessing && (
            <div className="space-y-2 py-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-2">
                  <Loader2 size={13} className="text-indigo-600 animate-spin" />
                  <span>Generando {progress.current} de {progress.total}...</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">{progress.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {progress.studentName && (
                <p className="text-[10px] text-slate-400 truncate uppercase">
                  {progress.studentName}
                </p>
              )}
            </div>
          )}

          {/* Completion state (minimalist) */}
          {isComplete && (
            <div className="py-1 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <Check size={15} className="shrink-0 text-emerald-600" />
                <span>Descarga completada ({students.length} boletas)</span>
              </div>
              {errors.length > 0 && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Hubo error con {errors.length} alumno(s): {errors.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Action buttons (When idle) */}
          {!isProcessing && !isComplete && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleStartDownload('zip')}
                disabled={students.length === 0}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                <FolderArchive size={14} />
                <span>Descargar en ZIP</span>
              </button>

              <button
                type="button"
                onClick={() => handleStartDownload('individual')}
                disabled={students.length === 0}
                className="w-full py-2 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                <Download size={14} />
                <span>Descargar Archivos Sueltos</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          {isProcessing ? (
            <button
              type="button"
              onClick={handleClose}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1 cursor-pointer"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1 cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
