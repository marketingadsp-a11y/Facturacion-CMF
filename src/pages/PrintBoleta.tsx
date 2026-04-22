import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, StudentGrade, AppSettings, SchoolCycle } from '../types';
import ReportCardPDF from '../components/ReportCardPDF';
import { PDFViewer } from '@react-pdf/renderer';

export default function PrintBoleta() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
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
          setStudent({ id: studentSnap.id, ...studentSnap.data() } as Student);
        }

        // Fetch Cycle
        if (appSettings?.currentCycleId) {
          const cycleSnap = await getDoc(doc(db, 'cycles', appSettings.currentCycleId));
          if (cycleSnap.exists()) {
            setCycle({ id: cycleSnap.id, ...cycleSnap.data() } as SchoolCycle);
          }
        }

        // Fetch Grades for this student
        const gradesQuery = query(collection(db, 'grades'), where('studentId', '==', studentId));
        const gradesSnap = await getDocs(gradesQuery);
        const stGrades = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentGrade));
        setGrades(stGrades);
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

  if (!student || !cycle) {
    return (
      <div className="h-screen flex items-center justify-center p-6 text-center bg-white text-slate-500">
        <p>No se pudo cargar la información del alumno o no hay ciclo activo para mostrar la boleta.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 h-screen w-screen m-0 p-0 overflow-hidden flex flex-col">
      <PDFViewer width="100%" height="100%" className="flex-1 border-none">
        <ReportCardPDF 
          student={student}
          grades={grades}
          settings={settings}
          cycle={cycle}
        />
      </PDFViewer>
    </div>
  );
}
