import React from 'react';
import { Student, StudentGrade, AppSettings, SchoolCycle } from '../types';

interface ReportCardPrintProps {
  student: Student;
  grades: StudentGrade[];
  settings: AppSettings | null;
  cycle: SchoolCycle;
}

export default function ReportCardPrint({ student, grades, settings, cycle }: ReportCardPrintProps) {
  const academicSubjects = [
    'Español', 'Matemáticas', 'Inglés', 'Ciencias Naturales', 'Geografía', 
    'Historia', 'Educación Artística', 'Formación Cívica y Ética', 
    'Arte Terapia', 'Educación Física', 'Vida Saludable'
  ];

  const curricularSubjects = [
    'Taller Lúdico', 'Escuela de Humanidad', 'Taller de Danza', 
    'Taller Deportivo', 'Taller Socioemocional'
  ];

  const behaviorAspects = [
    'Conducta', 'Uniforme', 'Inasistencia', 'Tareas no realizadas', 'Retardo', 'Aseo'
  ];

  // Helper to extract grade for a specific subject and bimestre
  const getGrade = (subject: string, bimestre: number) => {
    const bg = grades.find(g => g.bimestre === bimestre);
    if (!bg || !bg.subjects) return '';
    return bg.subjects[subject] !== undefined ? bg.subjects[subject] : '';
  };

  // Helper to get average for a subject across all bimestres
  const getSubjectAvg = (subject: string) => {
    let total = 0;
    let count = 0;
    for (let i = 1; i <= 5; i++) {
        const val = getGrade(subject, i);
        if (typeof val === 'number') {
            total += val;
            count++;
        }
    }
    return count > 0 ? (total / count).toFixed(1) : '';
  };
  
  // Calculate total average per bimestre (academic + curricular, omitting strings like 'A')
  const getBimestreAvg = (bimestre: number) => {
    const bg = grades.find(g => g.bimestre === bimestre);
    if (!bg || !bg.subjects) return '';
    const numericGrades = Object.entries(bg.subjects)
        .filter(([subj, val]) => (academicSubjects.includes(subj) || curricularSubjects.includes(subj)) && typeof val === 'number')
        .map(([_, val]) => val as number);
    
    if (numericGrades.length === 0) return '';
    return (numericGrades.reduce((a,b) => a+b, 0) / numericGrades.length).toFixed(2);
  };

  return (
    <div className="print-report-card">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print-report-card, .print-report-card * { visibility: visible; }
          .print-report-card { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            padding: 20px; 
            font-family: Arial, sans-serif;
            color: black;
          }
          .boleta-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
          .boleta-table th, .boleta-table td { border: 1px solid black; padding: 4px; text-align: center; }
          .boleta-table th { background-color: #e5e7eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
          .header-row { font-weight: bold; }
          .subject-col { text-align: left !important; width: 35%; font-weight: bold;}
          .vertical-text { writing-mode: vertical-lr; transform: rotate(180deg); text-align: center; padding: 10px 0; font-size: 9px; }
          .section-title { font-weight: bold; background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
          .avg-box { background-color: #d1d5db !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .signatures { margin-top: 20px; width: 100%; border-collapse: collapse; font-size: 11px; }
          .signatures td { border: 1px solid black; padding: 8px; }
          .sig-label { width: 20%; font-weight: bold; background-color: #e5e7eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
          .print-hide { display: none; }
        }
      `}} />
      
      <div className="border-[2px] border-black p-1 w-full max-w-[210mm] mx-auto bg-white" style={{ minHeight: '297mm' }}>
        <table className="boleta-table mb-0">
          <tbody>
            <tr>
              <td rowSpan={3} className="w-[15%] font-bold text-[10px]">CICLO ESCOLAR<br/>{cycle.name}</td>
              <td colSpan={5} className="font-bold text-sm tracking-widest">{student.grade?.toUpperCase() || '-'} GRADO</td>
              <td rowSpan={4} className="w-[10%] font-bold bg-gray-200">
                <div className="flex flex-col items-center justify-center h-full text-[10px] tracking-widest gap-1">
                  <span>P</span><span>R</span><span>O</span><span>M</span><span>E</span><span>D</span><span>I</span><span>O</span>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={5} className="font-bold text-xs tracking-widest">CALIFICACIONES</td>
            </tr>
            <tr>
              <td colSpan={5} className="font-bold text-[10px] tracking-widest">CAMPOS DE FORMACIÓN ACADÉMICA</td>
            </tr>
            <tr>
              <td className="w-[15%] font-bold bg-gray-200">
                <div className="flex flex-col items-center justify-center h-full text-[10px] tracking-widest gap-1 py-4">
                  <span>A</span><span>S</span><span>I</span><span>G</span><span>N</span><span>A</span><span>T</span><span>U</span><span>R</span><span>A</span><span>S</span>
                </div>
              </td>
              <td className="w-[13%] font-bold bg-gray-200"><div className="vertical-text mx-auto">1º BIMESTRE</div></td>
              <td className="w-[13%] font-bold bg-gray-200"><div className="vertical-text mx-auto">2º BIMESTRE</div></td>
              <td className="w-[13%] font-bold bg-gray-200"><div className="vertical-text mx-auto">3º BIMESTRE</div></td>
              <td className="w-[13%] font-bold bg-gray-200"><div className="vertical-text mx-auto">4º BIMESTRE</div></td>
              <td className="w-[13%] font-bold bg-gray-200"><div className="vertical-text mx-auto">5º BIMESTRE</div></td>
            </tr>
            
            {/* Academic Subjects */}
            {academicSubjects.map((subject, idx) => (
              <tr key={idx}>
                <td className="text-left font-bold text-[10px] px-2">{subject}</td>
                <td>{getGrade(subject, 1)}</td>
                <td>{getGrade(subject, 2)}</td>
                <td>{getGrade(subject, 3)}</td>
                <td>{getGrade(subject, 4)}</td>
                <td>{getGrade(subject, 5)}</td>
                <td className="bg-gray-100">{getSubjectAvg(subject)}</td>
              </tr>
            ))}

            {/* AUTONOMÍA CURRICULAR */}
            <tr>
                <td colSpan={7} className="font-bold text-[10px] tracking-widest bg-gray-200">AUTONOMÍA CURRICULAR CALIFICACIONES</td>
            </tr>
            {curricularSubjects.map((subject, idx) => (
              <tr key={idx}>
                <td className="text-left font-bold text-[10px] px-2">{subject}</td>
                <td>{getGrade(subject, 1)}</td>
                <td>{getGrade(subject, 2)}</td>
                <td>{getGrade(subject, 3)}</td>
                <td>{getGrade(subject, 4)}</td>
                <td>{getGrade(subject, 5)}</td>
                <td className="bg-gray-100">{getSubjectAvg(subject)}</td>
              </tr>
            ))}
            
            {/* OVERALL PROMEDIO */}
            <tr>
              <td className="text-left font-black text-sm tracking-widest bg-gray-200 px-2">PROMEDIO</td>
              <td className="font-bold">{getBimestreAvg(1)}</td>
              <td className="font-bold">{getBimestreAvg(2)}</td>
              <td className="font-bold">{getBimestreAvg(3)}</td>
              <td className="font-bold">{getBimestreAvg(4)}</td>
              <td className="font-bold">{getBimestreAvg(5)}</td>
              <td className="bg-gray-300"></td>
            </tr>

            {/* Behavior Aspects */}
            {behaviorAspects.map((aspect, idx) => (
              <tr key={idx}>
                <td className="text-left font-bold text-[10px] px-2 italic">{aspect}</td>
                <td>{getGrade(aspect, 1)}</td>
                <td>{getGrade(aspect, 2)}</td>
                <td>{getGrade(aspect, 3)}</td>
                <td>{getGrade(aspect, 4)}</td>
                <td>{getGrade(aspect, 5)}</td>
                <td className="bg-gray-100"></td>
              </tr>
            ))}
            
            {/* SIGNATURES SECTION WITHIN TABLE TO KEEP BORDERS CLEAN */}
            <tr>
                <td colSpan={7} className="font-bold text-[10px] tracking-widest bg-gray-200">FIRMA DEL PADRE O TUTOR</td>
            </tr>
            {[1,2,3,4,5].map(b => (
                <tr key={b}>
                    <td className="bg-gray-200 font-bold text-[10px] text-center w-[20%]">{b}ER BIMESTRE</td>
                    <td colSpan={6} className="h-8"></td>
                </tr>
            ))}
          </tbody>
        </table>
        
        {/* Name Header - sometimes schools want the name on top, but the screenshot didn't have it explicitly shown except the top. Let's place it at the absolute top or bottom. We'll put it at the very top outside the main table constraints. */}
        <div className="absolute top-4 left-4 right-4 flex justify-between px-8 pt-4 pb-2 -mt-16 print:mt-[-40px]">
            <div className="text-sm font-bold">ALUMNO: {student.lastName} {student.name}</div>
            <div className="text-sm font-bold">CURP: {student.curp}</div>
        </div>
      </div>
    </div>
  );
}
