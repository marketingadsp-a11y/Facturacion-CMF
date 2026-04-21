import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Enrollment, Student, AppSettings, Payment, SchoolCycle, StudentGrade } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Search, Filter, CheckCircle2, XCircle, Clock, Eye, X, Copy, Check, GraduationCap, MapPin, Phone, Mail, User, ShieldAlert, AlertCircle, Printer, FileDown, Edit2, CreditCard, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EnrollmentPDF from '../components/EnrollmentPDF';
import { calculateStudentDebts } from '../lib/paymentUtils';
import { createRoot } from 'react-dom/client';
import ReportCardPrint from '../components/ReportCardPrint';

export default function AcademicControl() {
  const { hasPermission, userProfile } = usePermissions();
  const [activeTab, setActiveTab] = useState<'enrollments' | 'studentList'>('enrollments');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  // Student List Filters
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentFormData, setStudentFormData] = useState<Partial<Student>>({});
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const qEnrollments = query(collection(db, 'enrollments'), orderBy('createdAt', 'desc'));
    const unsubEnrollments = onSnapshot(qEnrollments, (snap) => {
      setEnrollments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)));
      setLoading(false);
    });

    const qStudents = query(collection(db, 'students'), orderBy('lastName', 'asc'));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    });

    const unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    const unsubGrades = onSnapshot(collection(db, 'grades'), (snap) => {
      setGrades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentGrade)));
    });

    const unsubCycles = onSnapshot(collection(db, 'cycles'), (snap) => {
      setCycles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCycle)));
    });

    return () => {
      unsubEnrollments();
      unsubStudents();
      unsubSettings();
      unsubPayments();
      unsubGrades();
      unsubCycles();
    };
  }, []);

  const handleCopyLink = () => {
    const slug = settings?.enrollmentSlug || 'enroll';
    const link = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleStatusUpdate = async (id: string, status: 'Aprobado' | 'Rechazado' | 'Pendiente') => {
    const statusText = status === 'Pendiente' ? 'en Revisión' : status;
    if (!window.confirm(`¿Estás seguro de marcar esta solicitud como ${statusText}?`)) return;
    
    try {
      const enrol = enrollments.find(e => e.id === id);
      if (!enrol) return;

      await updateDoc(doc(db, 'enrollments', id), {
        status,
        updatedAt: serverTimestamp()
      });

      // If approved, create a student record if requested
      if (status === 'Aprobado') {
        const parentEmail = (enrol.fatherEmail || enrol.motherEmail || '').toLowerCase().trim();
        
        // Find if a sibling already exists to reuse registration code
        const sibling = students.find(s => s.parentEmail.toLowerCase().trim() === parentEmail);
        
        let registrationCode = sibling?.registrationCode;
        
        if (!registrationCode) {
          registrationCode = Math.floor(10000 + Math.random() * 90000).toString();
          
          // Ensure uniqueness across other families
          let attempts = 0;
          while (students.some(s => s.registrationCode === registrationCode) && attempts < 10) {
            registrationCode = Math.floor(10000 + Math.random() * 90000).toString();
            attempts++;
          }
        }

        await addDoc(collection(db, 'students'), {
          name: enrol.studentName,
          lastName: `${enrol.studentLastName} ${enrol.studentMotherLastName}`,
          curp: enrol.curp,
          email: enrol.fatherEmail || enrol.motherEmail || '',
          phone: enrol.phone,
          parentEmail: parentEmail,
          level: enrol.level,
          grade: enrol.grade,
          group: '',
          billingAddress: `${enrol.address} ${enrol.addressNo}, ${enrol.neighborhood}`,
          zipCode: enrol.zipCode,
          registrationCode,
          createdAt: serverTimestamp()
        });
        alert(`Solicitud aprobada. Se ha creado el registro del alumno con código de registro: ${registrationCode}${sibling ? ' (Reutilizado de hermano/a)' : ''}`);
      }

      setSelectedEnrollment(null);
    } catch (error) {
      console.error("Error updating enrollment status:", error);
      alert("Error al actualizar el estado");
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentFormData({
      name: student.name,
      lastName: student.lastName,
      curp: student.curp,
      level: student.level,
      grade: student.grade,
      group: student.group,
      email: student.email,
      phone: student.phone
    });
  };

  const handleSaveStudent = async () => {
    if (!editingStudent) return;
    setIsSavingStudent(true);
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), {
        ...studentFormData,
        updatedAt: serverTimestamp()
      });
      setEditingStudent(null);
      alert('Alumno actualizado correctamente.');
    } catch (error) {
      console.error("Error updating student:", error);
      alert('Error al actualizar alumno.');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handlePrintBoleta = (student: Student) => {
    const studentGrades = grades.filter(g => g.studentId === student.id);
    const currentCycle = cycles.find(c => c.id === settings?.currentCycleId);
    
    if (!currentCycle || !settings) {
      alert("Configuración de ciclo escolar incompleta.");
      return;
    }

    // Open a new window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor habilita las ventanas emergentes (pop-ups) para imprimir la boleta.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Boleta ${student.lastName} ${student.name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              @media print {
                  @page { margin: 10mm; }
              }
          </style>
        </head>
        <body>
          <div id="print-root"></div>
        </body>
      </html>
    `);
    
    printWindow.document.close();

    const container = printWindow.document.getElementById('print-root');
    if (container) {
      const root = createRoot(container);
      root.render(
        <ReportCardPrint 
          student={student} 
          grades={studentGrades} 
          settings={settings} 
          cycle={currentCycle} 
        />
      );
      
      // Wait for React to render and Tailwind to load before printing
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 1000);
    }
  };

  const filteredEnrollments = enrollments.filter(e => {
    const matchesSearch = `${e.studentName} ${e.studentLastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.folio?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || e.status === filterStatus;

    // Granular permissions for Control Escolar on enrollments
    if (userProfile?.role === 'Control Escolar') {
      const restrictedLevels = (userProfile as any).restrictedLevels || [];
      const restrictedGrades = (userProfile as any).restrictedGrades || [];
      // Enrollments usually don't have group yet, so we don't check group here

      if (restrictedLevels.length > 0 && !restrictedLevels.includes(e.level)) return false;
      if (restrictedGrades.length > 0 && !restrictedGrades.includes(e.grade)) return false;
    }

    return matchesSearch && matchesStatus;
  });

  const filteredStudents = students.filter(s => {
    const fullName = `${s.name} ${s.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                         (s.curp && s.curp.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLevel = !filterLevel || s.level === filterLevel;
    const matchesGrade = !filterGrade || s.grade === filterGrade;
    const matchesGroup = !filterGroup || s.group === filterGroup;

    // Granular permissions for Control Escolar
    if (userProfile?.role === 'Control Escolar') {
      const restrictedLevels = (userProfile as any).restrictedLevels || [];
      const restrictedGrades = (userProfile as any).restrictedGrades || [];
      const restrictedGroups = (userProfile as any).restrictedGroups || [];

      if (restrictedLevels.length > 0 && !restrictedLevels.includes(s.level)) return false;
      if (restrictedGrades.length > 0 && !restrictedGrades.includes(s.grade)) return false;
      if (restrictedGroups.length > 0 && !restrictedGroups.includes(s.group || '')) return false;
    }

    return matchesSearch && matchesLevel && matchesGrade && matchesGroup;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Control Escolar</h1>
          <p className="text-slate-500">Gestión de inscripciones y listas oficiales de alumnos.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-2xl border border-slate-100 shadow-sm flex items-center">
            <button
              onClick={() => setActiveTab('enrollments')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === 'enrollments' 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-100" 
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              Inscripciones
            </button>
            <button
              onClick={() => setActiveTab('studentList')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === 'studentList' 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-100" 
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              Listas de Alumnos
            </button>
          </div>
          {activeTab === 'enrollments' && (
            <button
              onClick={handleCopyLink}
              className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm transition-all active:scale-95"
            >
              {copySuccess ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
              {copySuccess ? 'Link Copiado' : 'Copiar Link de Inscripción'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'enrollments' ? (
        <>
          {/* Filters for Enrollments */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                placeholder="Buscar por alumno o folio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <Filter size={16} className="text-slate-400" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-sm font-bold outline-none"
              >
                <option value="">Todos los estados</option>
                <option value="Pendiente">Pendientes</option>
                <option value="Aprobado">Aprobados</option>
                <option value="Rechazado">Rechazados</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEnrollments.map(enrol => (
              <div 
                key={enrol.id}
                className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0",
                    enrol.status === 'Aprobado' ? "bg-emerald-500 shadow-emerald-100" :
                    enrol.status === 'Rechazado' ? "bg-red-500 shadow-red-100" :
                    "bg-blue-500 shadow-blue-100"
                  )}>
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      {enrol.studentName} {enrol.studentLastName}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                      Folio: {enrol.folio || enrol.id.slice(0, 4)}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
                  enrol.status === 'Aprobado' ? "bg-emerald-50 text-emerald-600" :
                  enrol.status === 'Rechazado' ? "bg-red-50 text-red-600" :
                  "bg-blue-50 text-blue-600"
                )}>
                  {enrol.status}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                  <GraduationCap size={14} className="text-slate-400" />
                  {enrol.level} - {enrol.grade}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                  <Clock size={14} className="text-slate-400" />
                  {enrol.createdAt ? format(enrol.createdAt.toDate(), "d 'de' MMMM, yyyy", { locale: es }) : 'No disponible'}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-50 flex gap-2">
                <button
                  onClick={() => setSelectedEnrollment(enrol)}
                  className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                >
                  <Eye size={14} /> Detalles
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && filteredEnrollments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm font-medium">Cargando solicitudes...</p>
        </div>
      )}

      {!loading && filteredEnrollments.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl p-20 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mb-4">
            <User size={32} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">No se encontraron solicitudes</h2>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Asegúrate de compartir el link de inscripción con los padres de familia.
          </p>
        </div>
      )}
        </>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Filters for Student List */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                placeholder="Buscar por nombre o CURP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los Niveles</option>
                {(settings?.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato']).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los Grados</option>
                {(settings?.academicGrades || Array.from(new Set(students.map(s => s.grade))).filter(Boolean).sort()).map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los Grupos</option>
                {(settings?.academicGroups || Array.from(new Set(students.map(s => s.group))).filter(Boolean).sort()).map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>

              {(filterLevel || filterGrade || filterGroup || searchTerm) && (
                <button
                  onClick={() => {
                    setFilterLevel('');
                    setFilterGrade('');
                    setFilterGroup('');
                    setSearchTerm('');
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Limpiar filtros"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Student List Grid */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-wider border-b border-slate-100">
                    <th className="px-4 py-4">Alumno</th>
                    <th className="px-4 py-4">Nivel / Grado</th>
                    <th className="px-4 py-4 text-center">B1</th>
                    <th className="px-4 py-4 text-center">B2</th>
                    <th className="px-4 py-4 text-center">B3</th>
                    <th className="px-4 py-4 text-center">B4</th>
                    <th className="px-4 py-4 text-center">B5</th>
                    <th className="px-4 py-4 text-center bg-blue-50/50">Promedio</th>
                    <th className="px-4 py-4 text-center">Estatus Pago</th>
                    <th className="px-4 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => {
                      const currentCycle = cycles.find(c => c.id === settings?.currentCycleId);
                      const debtStatus = calculateStudentDebts(student, payments, currentCycle || null, settings);
                      
                      // Calculate averages for each bimestre
                      const studentGrades = grades.filter(g => g.studentId === student.id && (!currentCycle || g.cycleId === currentCycle.id));
                      
                      const getBimestreAvg = (num: number) => {
                        const bg = studentGrades.find(g => g.bimestre === num);
                        if (!bg || !bg.subjects) return null;
                        const subjects = Object.values(bg.subjects);
                        if (subjects.length === 0) return null;
                        return subjects.reduce((a, b) => a + b, 0) / subjects.length;
                      };

                      const b1 = getBimestreAvg(1);
                      const b2 = getBimestreAvg(2);
                      const b3 = getBimestreAvg(3);
                      const b4 = getBimestreAvg(4);
                      const b5 = getBimestreAvg(5);

                      const capturedAvgs = [b1, b2, b3, b4, b5].filter((v): v is number => v !== null);
                      const finalAvg = capturedAvgs.length > 0 
                        ? capturedAvgs.reduce((a, b) => a + b, 0) / capturedAvgs.length 
                        : null;

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-all group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] uppercase shadow-sm">
                                {student.name.charAt(0)}{student.lastName.charAt(0)}
                              </div>
                              <div>
                                 <p className="text-xs font-bold text-slate-900 leading-none mb-0.5">{student.lastName}</p>
                                 <p className="text-[10px] text-slate-500 font-medium">{student.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 border-l border-slate-50">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest leading-none mb-0.5">{student.level}</span>
                              <span className="text-xs font-black text-slate-800 tracking-tighter">{student.grade}{student.group}</span>
                            </div>
                          </td>
                          
                          {/* Bimestres */}
                          {[b1, b2, b3, b4, b5].map((avg, i) => (
                            <td key={i} className="px-4 py-3 text-center border-l border-slate-50">
                              {avg !== null ? (
                                <span className={cn(
                                  "text-[11px] font-black",
                                  avg < 6 ? "text-red-500" : "text-slate-700"
                                )}>
                                  {avg.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-300">-</span>
                              )}
                            </td>
                          ))}

                          <td className="px-4 py-3 text-center border-l border-slate-100 bg-blue-50/20">
                            {finalAvg !== null ? (
                              <span className={cn(
                                "text-xs font-black px-2 py-1 rounded-md",
                                finalAvg < 6 ? "bg-red-50 text-red-600" : "bg-blue-600 text-white"
                              )}>
                                {finalAvg.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">Pdt.</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center border-l border-slate-50">
                            {debtStatus.hasDebt ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-tight border border-red-100">
                                <AlertTriangle size={10} />
                                DEUDA
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tight border border-emerald-100">
                                <CheckCircle2 size={10} />
                                AL DÍA
                              </div>
                            )}
                          </td>
                          
                          <td className="px-4 py-3 text-right border-l border-slate-50">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handlePrintBoleta(student)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Imprimir Boleta"
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                onClick={() => handleEditStudent(student)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Editar Alumno"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-sm italic font-medium">
                        No se encontraron alumnos con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Editar Información</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{editingStudent.lastName}, {editingStudent.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingStudent(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                disabled={isSavingStudent}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormInput 
                  label="Nombre" 
                  value={studentFormData.name} 
                  onChange={(e: any) => setStudentFormData({...studentFormData, name: e.target.value})} 
                />
                <FormInput 
                  label="Apellidos" 
                  value={studentFormData.lastName} 
                  onChange={(e: any) => setStudentFormData({...studentFormData, lastName: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nivel</label>
                  <select
                    value={studentFormData.level}
                    onChange={(e) => setStudentFormData({...studentFormData, level: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                  >
                    {(settings?.academicLevels || []).map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Grado</label>
                  <select
                    value={studentFormData.grade}
                    onChange={(e) => setStudentFormData({...studentFormData, grade: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                  >
                    {(settings?.academicGrades || []).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Grupo</label>
                  <select
                    value={studentFormData.group}
                    onChange={(e) => setStudentFormData({...studentFormData, group: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                  >
                    <option value="">Ninguno</option>
                    {(settings?.academicGroups || []).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <FormInput 
                label="CURP" 
                value={studentFormData.curp} 
                onChange={(e: any) => setStudentFormData({...studentFormData, curp: e.target.value.toUpperCase()})} 
              />
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingStudent(null)}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                disabled={isSavingStudent}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStudent}
                disabled={isSavingStudent}
                className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingStudent ? <Clock className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                {isSavingStudent ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Details Modal */}
      {selectedEnrollment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm text-blue-600">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Detalles de Solicitud</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inscripción {selectedEnrollment.folio}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEnrollment(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {/* Alumno */}
              <section className="space-y-4">
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                   <GraduationCap size={14} /> Datos del Alumno
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <DetailItem label="Nombre Completo" value={`${selectedEnrollment.studentName} ${selectedEnrollment.studentLastName} ${selectedEnrollment.studentMotherLastName}`} span={2} />
                  <DetailItem label="CURP" value={selectedEnrollment.curp} />
                  <DetailItem label="Sexo" value={selectedEnrollment.gender} />
                  <DetailItem label="Nivel" value={selectedEnrollment.level} />
                  <DetailItem label="Grado" value={selectedEnrollment.grade} />
                  <DetailItem label="Edad" value={`${selectedEnrollment.age} años`} />
                  <DetailItem label="F. Nacimiento" value={selectedEnrollment.birthDate} />
                  <DetailItem label="Domicilio" value={`${selectedEnrollment.address} ${selectedEnrollment.addressNo}, ${selectedEnrollment.neighborhood}`} span={2} />
                  <DetailItem label="C.P." value={selectedEnrollment.zipCode} />
                  <DetailItem label="Teléfono" value={selectedEnrollment.phone} />
                  <DetailItem label="Escuela Proc." value={selectedEnrollment.previousSchool || 'Ninguna'} span={2} />
                  <DetailItem label="Mencionó Enfermedad" value={selectedEnrollment.medicalConditions || 'No'} />
                  <DetailItem label="Medicamentos" value={selectedEnrollment.medications || 'Ninguno'} />
                </div>
              </section>

              {/* Padres */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                     <User size={14} /> Padre / Tutor
                  </h3>
                  <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 space-y-3">
                    <DetailItem label="Nombre" value={selectedEnrollment.fatherName} />
                    <DetailItem label="Teléfono" value={selectedEnrollment.fatherPhone} />
                    <DetailItem label="Email" value={selectedEnrollment.fatherEmail} />
                    <DetailItem label="Ocupación" value={selectedEnrollment.fatherOccupation} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-pink-600 uppercase tracking-widest flex items-center gap-2">
                     <User size={14} /> Madre / Tutora
                  </h3>
                  <div className="bg-pink-50/50 p-6 rounded-2xl border border-pink-100 space-y-3">
                    <DetailItem label="Nombre" value={selectedEnrollment.motherName} />
                    <DetailItem label="Teléfono" value={selectedEnrollment.motherPhone} />
                    <DetailItem label="Email" value={selectedEnrollment.motherEmail} />
                    <DetailItem label="Ocupación" value={selectedEnrollment.motherOccupation} />
                  </div>
                </div>
              </section>

              {/* Emergencia y Otros */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                     <ShieldAlert size={14} /> Emergencia
                  </h3>
                  <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 space-y-3">
                    <DetailItem label="Contacto" value={selectedEnrollment.emergencyContactName} />
                    <DetailItem label="Teléfono" value={selectedEnrollment.emergencyContactPhone} />
                    <DetailItem label="Domicilio" value={selectedEnrollment.emergencyContactAddress} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                     <AlertCircle size={14} /> Otros Motivos
                  </h3>
                  <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 space-y-3">
                    <DetailItem label="Cambio de Escuela" value={selectedEnrollment.schoolChangeReason || 'N/A'} />
                    <DetailItem label="¿Por qué nosotros?" value={selectedEnrollment.whyChooseSchool || 'N/A'} />
                    <DetailItem label="Apoyo Especial" value={selectedEnrollment.specialSupportRequired ? selectedEnrollment.specialSupportDescription : 'No'} />
                  </div>
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button 
                onClick={() => handleStatusUpdate(selectedEnrollment.id, 'Rechazado')}
                className="px-6 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                disabled={selectedEnrollment.status !== 'Pendiente'}
              >
                <XCircle size={18} /> Rechazar Solicitud
              </button>
              <div className="flex gap-3">
                {settings && (
                  <PDFDownloadLink
                    key={selectedEnrollment.id}
                    document={<EnrollmentPDF enrollment={selectedEnrollment} settings={settings} />}
                    fileName={`Solicitud_Inscripcion_${selectedEnrollment.studentName.replace(/\s+/g, '_')}.pdf`}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-all flex items-center gap-2"
                  >
                    {/* @ts-ignore */}
                    {({ loading }) => (
                      <>
                        {loading ? <Clock size={18} className="animate-spin" /> : <Printer size={18} />}
                        {loading ? 'Generando...' : 'Descargar PDF'}
                      </>
                    )}
                  </PDFDownloadLink>
                )}
                <button
                  onClick={() => setSelectedEnrollment(null)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Cerrar
                </button>
                {selectedEnrollment.status === 'Pendiente' && (
                  <button 
                    onClick={() => handleStatusUpdate(selectedEnrollment.id, 'Aprobado')}
                    className="px-8 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-100 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 size={18} /> Aprobar Inscripción
                  </button>
                )}
                {selectedEnrollment.status === 'Aprobado' && (
                  <button 
                    onClick={() => handleStatusUpdate(selectedEnrollment.id, 'Pendiente')}
                    className="px-8 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-lg shadow-amber-100 transition-all flex items-center gap-2"
                  >
                    <Clock size={18} /> Regresar a Revisión
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (e: any) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold transition-all placeholder:text-slate-300"
      />
    </div>
  );
}

function DetailItem({ label, value, span = 1 }: { label: string; value?: string | number; span?: number }) {
  return (
    <div className={cn(
      span === 2 ? "md:col-span-2" : 
      span === 3 ? "md:col-span-3" : 
      span === 4 ? "md:col-span-4" : ""
    )}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-xs font-bold text-slate-900 break-words">{value || '-'}</p>
    </div>
  );
}
