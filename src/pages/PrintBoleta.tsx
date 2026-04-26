import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, StudentGrade, AppSettings, SchoolCycle, Subject } from '../types';
import ReportCardPDF from '../components/ReportCardPDF';
import { PDFViewer } from '@react-pdf/renderer';
import { GraduationCap, Clock } from 'lucide-react';

export default function PrintBoleta() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cycle, setCycle] = useState<SchoolCycle | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="bg-slate-900 h-screen w-screen m-0 p-0 overflow-hidden flex flex-col">
      <PDFViewer width="100%" height="100%" className="flex-1 border-none">
        <ReportCardPDF 
          student={student}
          grades={grades}
          subjects={subjects}
          settings={settings}
          cycle={cycle}
        />
      </PDFViewer>
    </div>
  );
}
