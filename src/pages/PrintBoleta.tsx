import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject, AppUser } from '../types';
import ReportCardPDF from '../components/ReportCardPDF';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { GraduationCap, Clock, FileDown, Maximize2, Minimize2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function PrintBoleta() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cycle, setCycle] = useState<SchoolCycle | null>(null);
  const [teacherName, setTeacherName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [fitMode, setFitMode] = useState<'adapted' | 'full'>('adapted');

  useEffect(() => {
    const fetchData = async () => {
      if (!studentId) return;

      try {
        // Fetch Settings
        const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
        let appSettings: AppSettings | null = null;
        if (settingsSnap.exists()) {
          appSettings = settingsSnap.data() as AppSettings;
          setSettings(appSettings);
        }

        // Fetch Student
        const studentSnap = await getDoc(doc(db, 'students', studentId));
        if (studentSnap.exists()) {
          const studentData = { id: studentSnap.id, ...studentSnap.data() } as Student;
          setStudent(studentData);

          // Fetch Subjects for student's level (case-insensitive filter)
          const subjectsSnap = await getDocs(collection(db, 'subjects'));
          const filteredSubjects = subjectsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Subject))
            .filter(s => s.level?.toLowerCase().trim() === studentData.level?.toLowerCase().trim());
          setSubjects(filteredSubjects);

          // Fetch assigned teacher for Preescolar or Primaria
          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const teacher = usersSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as AppUser))
              .find(u => 
                u.role === 'Docente' && 
                u.assignedLevel?.toLowerCase().trim() === studentData.level?.toLowerCase().trim() && 
                (!u.assignedGrade || u.assignedGrade === studentData.grade) && 
                (!u.assignedGroup || u.assignedGroup === studentData.group)
              );
            if (teacher) {
              setTeacherName(teacher.name);
            }
          } catch (tErr) {
            console.warn("Could not fetch teacher:", tErr);
          }
        }

        // Fetch Cycle
        if (appSettings?.currentCycleId) {
          const cycleSnap = await getDoc(doc(db, 'cycles', appSettings.currentCycleId));
          if (cycleSnap.exists()) {
            setCycle({ id: cycleSnap.id, ...cycleSnap.data() } as SchoolCycle);
          }
        }

        // Fetch Grades for this student and current cycle
        if (appSettings?.currentCycleId) {
          const gradesQuery = query(
            collection(db, 'grades'), 
            where('studentId', '==', studentId),
            where('cycleId', '==', appSettings.currentCycleId)
          );
          const gradesSnap = await getDocs(gradesQuery);
          const stGrades = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentGrade));
          setGrades(stGrades);
        }
      } catch (error) {
        console.error("Error fetching data for print:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-white text-slate-500">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <GraduationCap size={32} className="text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Alumno no encontrado</h2>
        <p>No se pudo cargar la información del alumno con ID: {studentId}</p>
        <button 
          onClick={() => window.close()}
          className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg font-bold"
        >
          Cerrar Ventana
        </button>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-white text-slate-500">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Clock size={32} className="text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Ciclo Escolar no encontrado</h2>
        <p>No hay un ciclo escolar activo configurado en el sistema o el ciclo actual no es válido.</p>
        <p className="text-xs mt-2">Por favor configure el ciclo escolar actual en Ajustes &gt; Ciclos.</p>
        <button 
          onClick={() => window.close()}
          className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg font-bold"
        >
          Cerrar Ventana
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 h-screen w-full m-0 p-0 overflow-hidden flex flex-col font-sans select-none">
      {/* Top Bar with Student Info & Controls */}
      <header className="w-full bg-[#F8F9FA] border-b border-slate-200/90 z-10 shadow-xs shrink-0">
        <div
          className={cn(
            "w-full mx-auto px-3 sm:px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 transition-all duration-300",
            fitMode === 'adapted' ? "max-w-4xl xl:max-w-5xl" : "max-w-full"
          )}
        >
          {/* Student Info */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-sm font-black uppercase text-black truncate tracking-tight">
              {student.lastName} {student.name}
            </h1>
            <p className="text-[10px] text-slate-800 font-bold uppercase tracking-wider truncate">
              {student.level} • {student.grade} "{student.group}" • {cycle.name}
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Width Mode Selector */}
            <div className="flex items-center bg-slate-200/70 p-1 rounded-xl border border-slate-300/70 text-xs">
              <button
                type="button"
                onClick={() => setFitMode('adapted')}
                className={cn(
                  "px-2 sm:px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer",
                  fitMode === 'adapted'
                    ? "bg-blue-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-black hover:bg-slate-300/50"
                )}
                title="Ajustado proporcional al monitor (Carta)"
              >
                <Minimize2 size={12} />
                <span className="hidden sm:inline">Ajustado</span>
              </button>
              <button
                type="button"
                onClick={() => setFitMode('full')}
                className={cn(
                  "px-2 sm:px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer",
                  fitMode === 'full'
                    ? "bg-blue-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-black hover:bg-slate-300/50"
                )}
                title="Ancho completo de pantalla"
              >
                <Maximize2 size={12} />
                <span className="hidden sm:inline">Completo</span>
              </button>
            </div>

            <PDFDownloadLink
              document={
                <ReportCardPDF 
                  student={student}
                  grades={grades}
                  subjects={subjects}
                  settings={settings}
                  cycle={cycle}
                  teacherName={teacherName}
                />
              }
              fileName={`Boleta_${student.lastName}_${student.name}.pdf`.replace(/\s+/g, '_')}
              className="px-2.5 sm:px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer border border-blue-950/20"
            >
              {({ loading: pdfLoading }) => (
                <>
                  <FileDown size={14} />
                  <span className="hidden sm:inline">{pdfLoading ? 'Generando...' : 'Descargar'}</span>
                </>
              )}
            </PDFDownloadLink>

            <button
              type="button"
              onClick={() => window.close()}
              className="p-1.5 text-slate-500 hover:text-black hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer"
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Responsive Centered Viewer Area */}
      <main className="flex-1 w-full bg-slate-950 p-2 sm:p-4 md:p-6 flex items-center justify-center overflow-hidden">
        <div
          className={cn(
            "h-full w-full transition-all duration-300 flex flex-col overflow-hidden shadow-2xl",
            fitMode === 'adapted'
              ? "max-w-4xl xl:max-w-5xl rounded-2xl border border-slate-800/80 bg-slate-900"
              : "max-w-full rounded-none sm:rounded-xl border border-slate-800/80 bg-slate-900"
          )}
        >
          <PDFViewer width="100%" height="100%" className="w-full h-full border-none flex-1">
            <ReportCardPDF 
              student={student}
              grades={grades}
              subjects={subjects}
              settings={settings}
              cycle={cycle}
              teacherName={teacherName}
            />
          </PDFViewer>
        </div>
      </main>
    </div>
  );
}
