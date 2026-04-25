import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Enrollment, Student, AppSettings, Payment, SchoolCycle, StudentGrade, Subject } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Search, Filter, CheckCircle2, XCircle, Clock, Eye, X, Copy, Check, GraduationCap, MapPin, Phone, Mail, User, ShieldAlert, AlertCircle, Printer, FileDown, Edit2, CreditCard, AlertTriangle, UserRound, Download, BookOpen, Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EnrollmentPDF from '../components/EnrollmentPDF';
import RegistrationCodePDF from '../components/RegistrationCodePDF';
import { calculateStudentDebts } from '../lib/paymentUtils';
import { createRoot } from 'react-dom/client';

export default function AcademicControl() {
  const { hasPermission, userProfile } = usePermissions();
  const [activeTab, setActiveTab] = useState<'enrollments' | 'studentList' | 'subjects'>('enrollments');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
  const [codeModalStudent, setCodeModalStudent] = useState<Student | null>(null);
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

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });

    return () => {
      unsubEnrollments();
      unsubStudents();
      unsubSettings();
      unsubPayments();
      unsubGrades();
      unsubCycles();
      unsubSubjects();
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
    // Open the dedicated print page in a new window/tab
    const printWindow = window.open(`/imprimir-boleta/${student.id}`, '_blank');
    if (!printWindow) {
      alert("Por favor habilita las ventanas emergentes (pop-ups) para imprimir la boleta.");
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
    <div className="space-y-6 pb-12 font-sans tracking-tight max-w-[1600px] mx-auto">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Administración Académica</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic">
            Control Escolar
            <span className="not-italic text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-tighter leading-none inline-flex items-center h-4">
              v2.4.0
            </span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex items-center">
            <button
              onClick={() => setActiveTab('enrollments')}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'enrollments' 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-900"
              )}
            >
              Inscripciones
            </button>
            <button
              onClick={() => setActiveTab('studentList')}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'studentList' 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-900"
              )}
            >
              Listas Oficiales
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'subjects' 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-900"
              )}
            >
              Materias
            </button>
          </div>
          {activeTab === 'enrollments' && (
            <button
              onClick={handleCopyLink}
              className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-4 py-2.5 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95"
            >
              {copySuccess ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copySuccess ? 'Copiado' : 'Link de Inscripción'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'enrollments' ? (
        <>
          {/* Filters for Enrollments - Technical Style */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                placeholder="BUSCAR POR ALUMNO O FOLIO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-slate-900 outline-none transition-all text-[10px] font-bold uppercase tracking-wide"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
              <Filter size={12} className="text-slate-400" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
              >
                <option value="">FILTRAR ESTADO</option>
                <option value="Pendiente">PENDIENTES</option>
                <option value="Aprobado">APROBADOS</option>
                <option value="Rechazado">RECHAZADOS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredEnrollments.map(enrol => (
              <div 
                key={enrol.id}
                className="group bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all overflow-hidden flex flex-col"
              >
                <div className="p-4 space-y-3 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded shrink-0 flex items-center justify-center text-white",
                        enrol.status === 'Aprobado' ? "bg-emerald-500" :
                        enrol.status === 'Rechazado' ? "bg-rose-500" :
                        "bg-blue-500"
                      )}>
                        <UserRound size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-black text-slate-900 leading-tight uppercase truncate">
                          {enrol.studentName} {enrol.studentLastName}
                        </h3>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                          #{enrol.folio || enrol.id.slice(0, 4)}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter leading-none whitespace-nowrap",
                      enrol.status === 'Aprobado' ? "bg-emerald-50 text-emerald-600" :
                      enrol.status === 'Rechazado' ? "bg-rose-50 text-rose-600" :
                      "bg-blue-50 text-blue-600"
                    )}>
                      {enrol.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Nivel / Grado</span>
                       <span className="text-[10px] font-bold text-slate-700 truncate block uppercase italic">
                         {enrol.level} {enrol.grade}
                       </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Fecha Solicitud</span>
                       <span className="text-[10px] font-bold text-slate-700 truncate block uppercase">
                         {enrol.createdAt ? format(enrol.createdAt.toDate(), "dd/MM/yy", { locale: es }) : 'N/A'}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => setSelectedEnrollment(enrol)}
                    className="flex-1 py-1.5 bg-slate-950 text-white rounded text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95"
                  >
                    <Eye size={12} /> Revisar Expediente
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!loading && filteredEnrollments.length === 0 && (
            <div className="bg-white border border-dashed border-slate-200 rounded-lg p-20 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-50 text-slate-200 rounded flex items-center justify-center mb-4">
                <UserRound size={24} />
              </div>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Cero Registros Encontrados</h2>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Filters for Student List - High Density */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
              <input
                placeholder="BUSCAR POR NOMBRE O CURP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold uppercase tracking-tight focus:bg-white focus:border-slate-900 transition-all outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:border-slate-900"
              >
                <option value="">TODOS NIVELES</option>
                {(settings?.academicLevels || []).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:border-slate-900"
              >
                <option value="">TODOS GRADOS</option>
                {(settings?.academicGrades || []).map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:border-slate-900"
              >
                <option value="">TODOS GRUPOS</option>
                {(settings?.academicGroups || ['A', 'B', 'C', 'D']).map(group => (
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
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Student List Grid - Technical Data Style */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden shadow-slate-100">
            <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-950 text-slate-400 text-[8px] font-black uppercase tracking-[0.2em] border-b border-slate-800">
                    <th className="px-4 py-3 border-r border-slate-800 italic w-px whitespace-nowrap">Expediente Alumno</th>
                    <th className="px-4 py-3 border-r border-slate-800 text-center italic">ID / CURP</th>
                    <th className="px-4 py-3 border-r border-slate-800 text-center">Nivel</th>
                    <th className="px-4 py-3 border-r border-slate-800 text-center bg-slate-900">Gado/Gpo</th>
                    <th className="px-4 py-3 border-r border-slate-800 text-center italic">Cód. Reg</th>
                    <th className="px-4 py-3 border-r border-slate-800 text-center">Promedio</th>
                    <th className="px-4 py-3 border-r border-slate-800 text-center">Estatus</th>
                    <th className="px-4 py-3 text-right italic w-full">Panel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[10px]">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => {
                      const currentCycle = cycles.find(c => c.id === settings?.currentCycleId);
                      const debtStatus = calculateStudentDebts(student, payments, currentCycle || null, settings);
                      
                      const studentGrades = grades.filter(g => g.studentId === student.id && (!currentCycle || g.cycleId === currentCycle.id));
                      const academicSubjectNames = subjects
                        .filter(sub => sub.level?.toLowerCase().trim() === student.level?.toLowerCase().trim() && (sub.category === 'Académica' || !sub.category))
                        .map(sub => sub.name);

                      const getBimestreAvg = (num: number) => {
                        const bg = studentGrades.find(g => Number(g.bimestre) === num);
                        if (!bg || !bg.subjects) return null;
                        
                        // Filter only grades for subjects that are Academic and belong to the student's level
                        const numericGrades = Object.entries(bg.subjects)
                          .filter(([name, val]) => academicSubjectNames.includes(name) && typeof val === 'number')
                          .map(([_, val]) => val as number);

                        if (numericGrades.length === 0) return null;
                        return numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length;
                      };

                      const capturedAvgs = [1, 2, 3, 4, 5].map(num => getBimestreAvg(num)).filter((v): v is number => v !== null);
                      const finalAvg = capturedAvgs.length > 0 
                        ? capturedAvgs.reduce((a, b) => a + b, 0) / capturedAvgs.length 
                        : null;

                      return (
                        <tr 
                          key={student.id} 
                          className="group hover:bg-slate-950 hover:text-white transition-all cursor-default"
                        >
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 w-px whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-slate-100 group-hover:bg-slate-800 flex items-center justify-center font-black text-slate-500 text-[8px] group-hover:text-slate-400 border border-slate-200 group-hover:border-slate-700 shrink-0">
                                {student.name.charAt(0)}{student.lastName.charAt(0)}
                              </div>
                              <div>
                                 <span className="font-bold uppercase tracking-tight leading-none whitespace-nowrap">{student.lastName} {student.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center font-mono group-hover:text-amber-400 whitespace-nowrap">
                            {student.curp || 'N/A'}
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center">
                            <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{student.level}</span>
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center bg-slate-50 group-hover:bg-slate-900">
                             <span className="text-[11px] font-black tracking-tighter italic">{student.grade} - {student.group}</span>
                          </td>
                          
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center">
                            <button
                              onClick={() => setCodeModalStudent(student)}
                              className="text-[10px] font-mono font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-tight"
                            >
                              {student.registrationCode || 'N/A'}
                            </button>
                          </td>
                          
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center">
                            {finalAvg !== null ? (
                              <span className={cn(
                                "text-[10px] font-black px-1.5 py-0.5 rounded",
                                finalAvg < 6 ? "bg-rose-50 text-rose-600 group-hover:bg-rose-500 group-hover:text-white" : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                              )}>
                                {finalAvg.toFixed(1)}
                              </span>
                            ) : (
                               <span className="text-[8px] font-black text-slate-300 group-hover:text-slate-700">0.0</span>
                            )}
                          </td>

                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center">
                            {debtStatus.hasDebt ? (
                              <span className="bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">ADEUDO</span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">AL DÍA</span>
                            )}
                          </td>
                          
                          <td className="px-4 py-2.5 text-right w-px whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handlePrintBoleta(student)}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:!bg-emerald-500 hover:!text-white group-hover:bg-slate-800 group-hover:text-slate-400 rounded transition-all"
                                title="Boleta"
                              >
                                <Printer size={13} />
                              </button>
                              <button
                                onClick={() => handleEditStudent(student)}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:!bg-blue-600 hover:!text-white group-hover:bg-slate-800 group-hover:text-slate-400 rounded transition-all"
                                title="Editar"
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] italic">
                        Sistema sin coincidencias registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <SubjectsManagement subjects={subjects} settings={settings} />
      )}

      {/* Code Modal */}
      <AnimatePresence>
        {codeModalStudent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white italic font-black shadow-lg">
                    ID
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tighter uppercase italic">Clave de Acceso</h2>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">Familia / Vinculación Directa</p>
                  </div>
                </div>
                <button
                  onClick={() => setCodeModalStudent(null)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-900 shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8 text-center">
                <div className="space-y-4">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Alumnos Identificados</p>
                  <div className="space-y-2">
                    {students
                      .filter(s => s.registrationCode === codeModalStudent.registrationCode)
                      .map((sibling, idx) => (
                        <h3 key={idx} className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none italic">
                          {sibling.lastName}, {sibling.name}
                        </h3>
                      ))
                    }
                  </div>
                </div>

                <div className="bg-slate-950 p-8 rounded-2xl shadow-inner border border-slate-800 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <UserRound size={80} />
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Registro Unico</p>
                  <p className="text-5xl font-black text-white tracking-[0.2em] font-mono shadow-sm">
                    {codeModalStudent.registrationCode}
                  </p>
                  <div className="mt-6 flex justify-center">
                     <span className="text-[8px] font-black text-indigo-400 border border-indigo-900 px-2 py-1 rounded bg-indigo-950/50 uppercase tracking-widest animate-pulse">Token Activo</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 text-left space-y-3">
                  <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={14} className="text-indigo-600" />
                    Protocolo de Acceso
                  </p>
                  <ul className="space-y-2">
                    <li className="flex gap-2 text-[10px] text-slate-500 leading-tight">
                      <span className="font-black text-slate-900 italic">01.</span> Acceder al portal de padres de familia institucional.
                    </li>
                    <li className="flex gap-2 text-[10px] text-slate-500 leading-tight">
                      <span className="font-black text-slate-900 italic">02.</span> Utilizar el ID superior para validar la vinculación.
                    </li>
                    <li className="flex gap-2 text-[10px] text-slate-500 leading-tight">
                      <span className="font-black text-slate-900 italic">03.</span> Completar el perfil con datos de contacto verificados.
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <PDFDownloadLink
                    document={
                      <RegistrationCodePDF 
                        studentNames={students
                          .filter(s => s.registrationCode === codeModalStudent.registrationCode)
                          .map(s => `${s.lastName}, ${s.name}`)
                        } 
                        registrationCode={codeModalStudent.registrationCode || ''} 
                        schoolName={settings?.schoolName}
                        registrationInstructions={settings?.registrationInstructions}
                        pdfFooter={settings?.pdfFooter}
                      />
                    }
                    fileName={`REG_${codeModalStudent.lastName}_${codeModalStudent.registrationCode}.pdf`}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95"
                  >
                    {/* @ts-ignore */}
                    {({ loading }: any) => (
                      <>
                        <Download size={16} />
                        {loading ? 'Generando...' : 'Descargar PDF'}
                      </>
                    )}
                  </PDFDownloadLink>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(codeModalStudent.registrationCode || '');
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="w-full h-12 bg-white border border-slate-200 hover:border-slate-950 text-slate-950 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    {copySuccess ? <Check size={16} /> : <Copy size={16} />}
                    {copySuccess ? 'Copiado' : 'Copiar Clave'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

function SubjectsManagement({ subjects, settings }: { subjects: Subject[]; settings: AppSettings | null }) {
  const [newSubject, setNewSubject] = useState({ name: '', level: '', category: 'Académica' as const });
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const levels = settings?.academicLevels || [];

  const handleCreateSubject = async () => {
    if (!newSubject.name || !newSubject.level) {
      alert("Por favor completa el nombre y selecciona un nivel.");
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'subjects'), {
        name: newSubject.name,
        level: newSubject.level,
        category: newSubject.category,
        createdAt: serverTimestamp()
      });
      setNewSubject({ name: '', level: '', category: 'Académica' });
    } catch (error) {
      console.error("Error creating subject:", error);
      alert("Error al crear materia");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSubject = async () => {
    if (!editingSubject || !editingSubject.name || !editingSubject.level) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'subjects', editingSubject.id), {
        name: editingSubject.name,
        level: editingSubject.level,
        category: editingSubject.category || 'Académica',
        updatedAt: serverTimestamp()
      });
      setEditingSubject(null);
    } catch (error) {
      console.error("Error updating subject:", error);
      alert("Error al actualizar materia");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar esta materia? Esto podría afectar la visualización de calificaciones anteriores.")) return;
    try {
      // In a real app we'd use deleteDoc, but let's be careful with foreign keys. 
      // For now just delete.
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'subjects', id));
    } catch (error) {
      console.error("Error deleting subject:", error);
      alert("Error al eliminar materia");
    }
  };

  const subjectsByLevel = levels.reduce((acc, level) => {
    acc[level] = subjects.filter(s => s.level === level);
    return acc;
  }, {} as Record<string, Subject[]>);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Create Subject Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2rem] mb-6 flex items-center gap-2 italic">
          <Plus size={16} className="text-blue-500" /> Registrar Nueva Materia
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <FormInput 
            label="Nombre de la Materia" 
            placeholder="Ej. Matemáticas I, Inglés..."
            value={newSubject.name}
            onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
          />
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nivel Académico</label>
            <select
              value={newSubject.level}
              onChange={(e) => setNewSubject({ ...newSubject, level: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold uppercase tracking-tight"
            >
              <option value="">Seleccionar Nivel</option>
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tipo / Categoría</label>
            <select
              value={newSubject.category}
              onChange={(e) => setNewSubject({ ...newSubject, category: e.target.value as any })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold uppercase tracking-tight"
            >
              <option value="Académica">Académica (Base)</option>
              <option value="Extracurricular">Extracurricular / Taller</option>
              <option value="Aspectos Formativos">Aspectos Formativos / Conducta</option>
            </select>
          </div>
          <button
            onClick={handleCreateSubject}
            disabled={isSaving}
            className="h-[46px] bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Clock className="animate-spin" size={14} /> : <Plus size={14} />}
            Agregar Materia
          </button>
        </div>
</div>

      {/* List by Level */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {levels.map(level => (
          <div key={level} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <BookOpen size={14} className="text-blue-500" /> {level}
              </h3>
              <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">
                {subjectsByLevel[level]?.length || 0} Materias
              </span>
            </div>
            <div className="p-2 flex-1 md:min-h-[200px]">
              <div className="divide-y divide-slate-50">
                {subjectsByLevel[level]?.length > 0 ? (
                  subjectsByLevel[level].map(subj => (
                    <div key={subj.id} className="p-3 flex items-center justify-between group hover:bg-slate-50 rounded-lg transition-all">
                      {editingSubject?.id === subj.id ? (
                        <div className="flex-1 flex gap-2">
                          <input 
                            autoFocus
                            value={editingSubject.name}
                            onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                            className="flex-1 bg-white border border-blue-200 rounded px-2 py-1 text-sm font-bold outline-none"
                          />
                          <select
                            value={editingSubject.category}
                            onChange={(e) => setEditingSubject({ ...editingSubject, category: e.target.value as any })}
                            className="bg-white border border-blue-200 rounded px-1 py-1 text-[8px] font-black uppercase"
                          >
                            <option value="Académica">Aca.</option>
                            <option value="Extracurricular">Ext.</option>
                            <option value="Aspectos Formativos">Asp.</option>
                          </select>
                          <button onClick={handleUpdateSubject} className="text-emerald-500 hover:text-emerald-700"><Check size={16}/></button>
                          <button onClick={() => setEditingSubject(null)} className="text-rose-500 hover:text-rose-700"><X size={16}/></button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 uppercase tracking-tight italic">{subj.name}</span>
                            <span className={cn(
                              "text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded w-fit mt-0.5",
                              subj.category === 'Extracurricular' ? "bg-indigo-50 text-indigo-500" : "bg-blue-50 text-blue-500"
                            )} shadow-sm>
                              {subj.category || 'Académica'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setEditingSubject(subj)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => handleDeleteSubject(subj.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Sin materias asignadas</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
