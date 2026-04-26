import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, Payment, AppSettings, SchoolCycle } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Plus, Search, Edit2, Trash2, UserPlus, X, GraduationCap, Mail, Phone, FileText, MapPin, History, Filter, ChevronRight, Calendar, CreditCard, AlertCircle, TrendingDown, UserRound, Download, Check, Copy, ShieldAlert, Sparkles, User, BookOpen, ReceiptText, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateStudentDebts, MONTH_NAMES } from '../lib/paymentUtils';
import { calculateCURP, STATES } from '../lib/studentUtils';
import { sendWelcomeEmail } from '../services/mailService';
import { motion, AnimatePresence } from 'motion/react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import RegistrationCodePDF from '../components/RegistrationCodePDF';

export default function Students() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterDebt, setFilterDebt] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [duplicateError, setDuplicateError] = useState<{name: string, curp: string} | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [codeModalStudent, setCodeModalStudent] = useState<Student | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [showEmailSuccess, setShowEmailSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    motherLastName: '',
    birthDate: '',
    gender: 'H' as 'H' | 'M',
    birthState: 'JC',
    curp: '',
    email: '',
    phone: '',
    parentEmail: '',
    level: 'Primaria',
    grade: '',
    group: '',
    rfc: '',
    billingName: '',
    billingAddress: '',
    zipCode: '',
    taxSystem: '605',
    registrationCode: '',
    startPayment: 'current' as 'current' | 'next',
    enrollmentMonth: undefined as number | undefined,
    enrollmentYear: undefined as number | undefined
  });

  // Auto-calculate CURP
  useEffect(() => {
    if (formData.name && formData.lastName && formData.birthDate && formData.gender && formData.birthState) {
      const calculatedToken = calculateCURP({
        firstName: formData.name,
        lastName: formData.lastName,
        motherLastName: formData.motherLastName,
        birthDate: formData.birthDate,
        gender: formData.gender,
        birthState: formData.birthState
      });
      
      // Only update if it's different and not already complete (if they want to manually edit the last digits)
      // but usually users want it to stay linked. Let's update it if the first 16 change.
      if (calculatedToken && (!formData.curp || formData.curp.slice(0, 16) !== calculatedToken)) {
        setFormData(prev => ({ ...prev, curp: calculatedToken + (prev.curp.slice(16) || '') }));
      }
    }
  }, [formData.name, formData.lastName, formData.motherLastName, formData.birthDate, formData.gender, formData.birthState]);

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('lastName', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const pUnsub = onSnapshot(collection(db, 'payments'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(data);
    });

    const sUnsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    });

    const cUnsub = onSnapshot(collection(db, 'cycles'), (snap) => {
      setCycles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCycle)));
    });

    return () => {
      unsub();
      pUnsub();
      sUnsub();
      cUnsub();
    };
  }, []);

  const currentCycle = cycles.find(c => c.id === settings?.currentCycleId) || null;

  const generateRegistrationCode = () => {
    let code = Math.floor(10000 + Math.random() * 90000).toString();
    let attempts = 0;
    while (students.some(s => s.registrationCode === code) && attempts < 10) {
      code = Math.floor(10000 + Math.random() * 90000).toString();
      attempts++;
    }
    return code;
  };

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        name: student.name || '',
        lastName: student.lastName || '',
        motherLastName: student.motherLastName || '',
        birthDate: student.birthDate || '',
        gender: (student.gender as 'H' | 'M') || 'H',
        birthState: student.birthState || 'JC',
        curp: student.curp || '',
        email: student.email || '',
        phone: student.phone || '',
        parentEmail: student.parentEmail || '',
        level: student.level || 'Primaria',
        grade: student.grade || '',
        group: student.group || '',
        rfc: student.rfc || '',
        billingName: student.billingName || '',
        billingAddress: student.billingAddress || '',
        zipCode: student.zipCode || '',
        taxSystem: student.taxSystem || '605',
        registrationCode: student.registrationCode || generateRegistrationCode(),
        startPayment: 'current',
        enrollmentMonth: student.enrollmentMonth,
        enrollmentYear: student.enrollmentYear
      });
    } else {
      setEditingStudent(null);
      setFormData({
        name: '', 
        lastName: '', 
        motherLastName: '',
        birthDate: '',
        gender: 'H',
        birthState: 'MC',
        curp: '', 
        email: '', 
        phone: '', 
        parentEmail: '', 
        level: 'Primaria', 
        grade: '', 
        group: '', 
        rfc: '', 
        billingName: '', 
        billingAddress: '', 
        zipCode: '', 
        taxSystem: '605', 
        registrationCode: generateRegistrationCode(),
        startPayment: 'current',
        enrollmentMonth: undefined,
        enrollmentYear: undefined
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenHistory = (student: Student) => {
    setSelectedStudent(student);
    setIsHistoryModalOpen(true);
  };

  const handleResendEmail = async (student: Student) => {
    if (!settings || !student.parentEmail) return;
    
    setSendingEmailId(student.id);
    try {
      await sendWelcomeEmail(student, settings);
      setShowEmailSuccess(true);
      setTimeout(() => setShowEmailSuccess(false), 5000);
    } catch (error) {
      console.error('Error reenviando correo:', error);
      alert('Hubo un error al reenviar el correo. Por favor intente más tarde.');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isDuplicate = students.some(s => {
        // Skip check for the student currently being edited
        if (editingStudent && s.id === editingStudent.id) return false;
        
        // Match by CURP (strongest identifier)
        const sameCurp = formData.curp && s.curp === formData.curp;
        
        // Match by Full Identity (Name + BirthDate)
        const sameIdentity = 
          s.name.toLowerCase().trim() === formData.name.toLowerCase().trim() &&
          s.lastName.toLowerCase().trim() === formData.lastName.toLowerCase().trim() &&
          (s.motherLastName || '').toLowerCase().trim() === (formData.motherLastName || '').toLowerCase().trim() &&
          s.birthDate === formData.birthDate;
          
        return sameCurp || sameIdentity;
      });

      if (isDuplicate) {
        const existing = students.find(s => {
          if (editingStudent && s.id === editingStudent.id) return false;
          const sameCurp = formData.curp && s.curp === formData.curp;
          const sameIdentity = 
            s.name.toLowerCase().trim() === formData.name.toLowerCase().trim() &&
            s.lastName.toLowerCase().trim() === formData.lastName.toLowerCase().trim() &&
            (s.motherLastName || '').toLowerCase().trim() === (formData.motherLastName || '').toLowerCase().trim() &&
            s.birthDate === formData.birthDate;
          return sameCurp || sameIdentity;
        });

        if (existing) {
          setDuplicateError({
            name: `${existing.name} ${existing.lastName}`,
            curp: existing.curp || 'SIN CURP'
          });
        }
        return;
      }

      // Check if registrationCode already exists for another student (NOT a sibling)
      const codeExists = students.some(s => 
        s.registrationCode === formData.registrationCode && 
        (!editingStudent || s.id !== editingStudent.id) &&
        s.parentEmail.toLowerCase().trim() !== formData.parentEmail.toLowerCase().trim()
      );

      if (codeExists) {
        alert('Este código de registro ya está en uso por otro alumno. Por favor, ingrese un código único.');
        return;
      }

      const now = new Date();
      let enrollmentMonth = now.getMonth();
      let enrollmentYear = now.getFullYear();

      if (formData.startPayment === 'next') {
        const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        enrollmentMonth = nextDate.getMonth();
        enrollmentYear = nextDate.getFullYear();
      }

      let dataToSave = {
        ...formData,
        parentEmail: formData.parentEmail.toLowerCase().trim(),
        enrollmentMonth,
        enrollmentYear,
        updatedAt: serverTimestamp()
      };
      
      // Remove startPayment from the data sent to Firestore as it's a UI-only helper
      const { startPayment, ...cleanedData } = dataToSave;

      // Validate generic RFC tax system
      if ((formData.rfc === 'XAXX010101000' || formData.rfc === 'XEXX010101000') && formData.taxSystem !== '616') {
        dataToSave.taxSystem = '616';
      }

      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), cleanedData);
      } else {
        const docRef = await addDoc(collection(db, 'students'), {
          ...cleanedData,
          createdAt: serverTimestamp()
        });
        
        // Trigger welcome email for new students if settings are available
        if (settings) {
          sendWelcomeEmail({ id: docRef.id, ...cleanedData, createdAt: Timestamp.now() } as Student, settings);
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar a este alumno?')) {
      try {
        await deleteDoc(doc(db, 'students', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `students/${id}`);
      }
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.name} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.curp?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = !filterLevel || s.level === filterLevel;
    const matchesGrade = !filterGrade || s.grade === filterGrade;
    const matchesGroup = !filterGroup || s.group === filterGroup;
    
    if (filterDebt) {
      const debtStatus = calculateStudentDebts(s, payments, currentCycle, settings);
      if (!debtStatus.hasDebt) return false;
    }

    return matchesSearch && matchesLevel && matchesGrade && matchesGroup;
  });

  const studentPayments = selectedStudent 
    ? payments.filter(p => p.studentId === selectedStudent.id).sort((a, b) => b.date.toMillis() - a.date.toMillis())
    : [];

  return (
    <div className="space-y-6 pb-12 font-sans tracking-tight max-w-[1600px] mx-auto">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Matrícula Escolar</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic">
            Gestión de Alumnos
            <span className="not-italic text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-tighter leading-none inline-flex items-center h-4">
              {students.length} Registros
            </span>
          </h1>
        </div>
        {hasPermission('students', 'create') && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-slate-950 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-900 transition-all active:scale-95"
          >
            <UserPlus size={14} />
            Nuevo Registro
          </button>
        )}
      </div>

      {/* Filters - Minimal Utility */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
          <input
            type="text"
            placeholder="BUSCAR POR NOMBRE O CURP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all text-[10px] font-bold uppercase tracking-wide"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 rounded-md">
            <Filter size={12} className="text-slate-400" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-transparent py-1.5 text-[10px] font-black uppercase tracking-tight outline-none cursor-pointer"
            >
              <option value="">NIVEL</option>
              {(settings?.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato']).map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 rounded-md">
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="bg-transparent py-1.5 text-[10px] font-black uppercase tracking-tight outline-none cursor-pointer"
            >
              <option value="">GRADO</option>
              {(settings?.academicGrades || Array.from(new Set(students.map(s => s.grade))).sort()).map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 rounded-md">
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="bg-transparent py-1.5 text-[10px] font-black uppercase tracking-tight outline-none cursor-pointer"
            >
              <option value="">GRUPO</option>
              {(settings?.academicGroups || Array.from(new Set(students.map(s => s.group))).filter(Boolean).sort()).map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setFilterDebt(!filterDebt)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[10px] font-black flex items-center gap-2 transition-all uppercase tracking-tight",
              filterDebt ? "bg-rose-950 text-white border-rose-950" : "bg-slate-50 text-slate-600 border border-slate-200"
            )}
          >
            {filterDebt ? <AlertCircle size={12} /> : <TrendingDown size={12} />}
            {filterDebt ? 'Con Adeudo' : 'Ver Adeudos'}
          </button>
          
          {(filterLevel || filterGrade || filterGroup || searchTerm || filterDebt) && (
            <button
              onClick={() => {
                setFilterLevel('');
                setFilterGrade('');
                setFilterGroup('');
                setSearchTerm('');
                setFilterDebt(false);
              }}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Limpiar filtros"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Students Table - Specialist Grid */}
      <div className="compact-card shadow-lg shadow-slate-100">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-left border-collapse table-auto min-w-max">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-[0.1em] border-b border-slate-200">
                <th className="px-4 py-3 border-r border-slate-100 italic whitespace-nowrap">Apellidos</th>
                <th className="px-4 py-3 border-r border-slate-100 italic whitespace-nowrap">Nombre(s)</th>
                <th className="px-4 py-3 border-r border-slate-100 mono-label uppercase whitespace-nowrap">CURP</th>
                <th className="px-4 py-3 border-r border-slate-100 italic whitespace-nowrap">Nivel</th>
                <th className="px-4 py-3 border-r border-slate-100 italic whitespace-nowrap text-center">Grado</th>
                <th className="px-4 py-3 border-r border-slate-100 text-center italic whitespace-nowrap">Gpo</th>
                <th className="px-4 py-3 border-r border-slate-100 text-center mono-label whitespace-nowrap">Cód. Reg</th>
                <th className="px-4 py-3 border-r border-slate-100 italic whitespace-nowrap">Correo Padre</th>
                <th className="px-4 py-3 border-r border-slate-100 mono-label uppercase whitespace-nowrap">Estatus Pago</th>
                <th className="px-4 py-3 text-right italic whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const debtStatus = calculateStudentDebts(student, payments, currentCycle, settings);
                  return (
                    <tr 
                      key={student.id} 
                      className="group hover:bg-slate-950 hover:text-white transition-all cursor-default text-[10px]"
                    >
                      <td className="px-4 py-2 border-r border-slate-100 font-bold uppercase whitespace-nowrap group-hover:border-slate-800 text-slate-900 group-hover:text-white">
                        {student.lastName} {student.motherLastName || ''}
                      </td>
                      <td className="px-4 py-2 border-r border-slate-100 font-bold uppercase whitespace-nowrap group-hover:border-slate-800 group-hover:text-white">
                        {student.name}
                      </td>
                      <td className="px-4 py-2 border-r border-slate-100 font-mono text-[9px] whitespace-nowrap group-hover:border-slate-800 group-hover:text-slate-300">
                        {student.curp || '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 whitespace-nowrap">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter",
                          student.level === 'Preescolar' ? "bg-purple-100 text-purple-700" :
                          student.level === 'Primaria' ? "bg-blue-100 text-blue-700" :
                          student.level === 'Secundaria' ? "bg-orange-100 text-orange-700" : "bg-indigo-100 text-indigo-700"
                        )}>
                          {student.level}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-center font-bold text-slate-600 whitespace-nowrap group-hover:text-white">
                        {student.grade}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-center font-bold text-slate-600 whitespace-nowrap group-hover:text-white">
                        {student.group || '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-center font-mono font-bold text-emerald-600 whitespace-nowrap group-hover:text-emerald-400">
                        <button
                          onClick={() => setCodeModalStudent(student)}
                          className="hover:text-indigo-600 transition-colors uppercase tracking-tight"
                        >
                          {student.registrationCode || '-'}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-slate-500 whitespace-nowrap group-hover:text-slate-300">
                        <div className="flex items-center gap-2">
                          <span>{student.parentEmail || '-'}</span>
                          {student.parentEmail && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResendEmail(student);
                              }}
                              disabled={sendingEmailId === student.id}
                              className={cn(
                                "p-1 rounded-md transition-all hover:bg-slate-800 hover:text-white",
                                sendingEmailId === student.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                              )}
                              title="Reenviar correo de bienvenida"
                            >
                              {sendingEmailId === student.id ? (
                                <div className="w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Mail size={12} />
                                  <span className="hidden group-hover:inline text-[8px] font-black uppercase">Reenviar</span>
                                </div>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 whitespace-nowrap">
                        {debtStatus.hasDebt ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-red-600 font-black">
                              ${debtStatus.totalDebt.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-emerald-600 font-bold">AL DÍA</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('payments', 'create') && (
                            <button 
                              onClick={() => navigate('/pagos', { state: { studentId: student.id } })}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                              title="Pago"
                            >
                              <CreditCard size={14} />
                            </button>
                          )}
                          {hasPermission('students', 'viewHistory') && (
                            <button 
                              onClick={() => handleOpenHistory(student)}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                              title="Historial"
                            >
                              <History size={14} />
                            </button>
                          )}
                          {hasPermission('students', 'edit') && (
                            <button 
                              onClick={() => handleOpenModal(student)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {hasPermission('students', 'delete') && (
                            <button 
                              onClick={() => handleDelete(student.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No se encontraron alumnos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Rediseñado */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
              <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200"
            >
              {/* Header Compacto */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-md">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">
                      {editingStudent ? 'Editar Registro' : 'Nuevo Expediente'}
                    </h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">
                      Control Escolar • Ciclo {currentCycle?.name || 'Actual'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-1.5 hover:bg-slate-100 rounded-md transition-all text-slate-400 hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              </div>
              
              <form id="student-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Bloque 1: Identidad */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <User size={14} className="text-blue-600" />
                       <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.1em]">Identidad</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Nombre(s) *</label>
                        <input
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold uppercase transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Paterno *</label>
                          <input
                            required
                            value={formData.lastName}
                            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold uppercase transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Materno</label>
                          <input
                            value={formData.motherLastName}
                            onChange={(e) => setFormData({...formData, motherLastName: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold uppercase transition-all"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                           <div>
                              <label className="block text-[9px] font-bold text-blue-800 uppercase mb-1">Nacimiento</label>
                              <input
                                 type="date"
                                 required
                                 value={formData.birthDate}
                                 onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                                 className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                           </div>
                           <div>
                              <label className="block text-[9px] font-bold text-blue-800 uppercase mb-1">Género</label>
                              <select
                                 required
                                 value={formData.gender}
                                 onChange={(e) => setFormData({...formData, gender: e.target.value as 'H' | 'M'})}
                                 className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                              >
                                 <option value="H">Hombre</option>
                                 <option value="M">Mujer</option>
                              </select>
                           </div>
                        </div>
                        <div>
                           <label className="block text-[9px] font-bold text-blue-800 uppercase mb-1">Estado de Nacimiento</label>
                           <select
                              required
                              value={formData.birthState}
                              onChange={(e) => setFormData({...formData, birthState: e.target.value})}
                              className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                           >
                              {STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                           </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center justify-between">
                            CURP CALCULADA
                            <Sparkles size={10} className="text-blue-400" />
                          </label>
                          <input
                            value={formData.curp}
                            onChange={(e) => setFormData({...formData, curp: e.target.value.toUpperCase()})}
                            className="w-full px-3 py-2 bg-white border border-blue-300 rounded focus:border-blue-600 outline-none uppercase font-mono font-black text-[11px] text-blue-800 text-center tracking-wider"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloque 2: Académico & Finanzas */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <BookOpen size={14} className="text-indigo-600" />
                       <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.1em]">Academia y Pagos</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Nivel Educativo *</label>
                        <select
                          required
                          value={formData.level}
                          onChange={(e) => setFormData({...formData, level: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold transition-all"
                        >
                          <option value="">Seleccionar...</option>
                          {(settings?.academicLevels || ['Preescolar', 'Primaria', 'Secundaria']).map(level => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Grado *</label>
                          <select
                            required
                            value={formData.grade}
                            onChange={(e) => setFormData({...formData, grade: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-bold"
                          >
                            <option value="">Grado</option>
                            {(settings?.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to']).map(grade => (
                              <option key={grade} value={grade}>{grade}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Grupo</label>
                          <select
                            value={formData.group}
                            onChange={(e) => setFormData({...formData, group: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-bold"
                          >
                            <option value="">Grupo</option>
                            {(settings?.academicGroups || ['A', 'B', 'C']).map(group => (
                              <option key={group} value={group}>{group}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Configuración de Cobro */}
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <ReceiptText size={12} className="text-emerald-600" />
                          <span className="text-[9px] font-black text-emerald-800 uppercase">Inicio de Cobros</span>
                        </div>
                        
                        {!editingStudent ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, startPayment: 'current'})}
                              className={cn(
                                "p-2 rounded border transition-all text-center",
                                formData.startPayment === 'current' 
                                  ? "bg-emerald-600 text-white border-emerald-600" 
                                  : "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                              )}
                            >
                              <p className="text-[10px] font-black uppercase">Mes Actual</p>
                              <p className="text-[8px] opacity-80">{format(new Date(), 'MMMM', { locale: es })}</p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, startPayment: 'next'})}
                              className={cn(
                                "p-2 rounded border transition-all text-center",
                                formData.startPayment === 'next' 
                                  ? "bg-emerald-600 text-white border-emerald-600" 
                                  : "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                              )}
                            >
                              <p className="text-[10px] font-black uppercase">Prox. Mes</p>
                              <p className="text-[8px] opacity-80">{format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), 'MMMM', { locale: es })}</p>
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-emerald-700 font-bold italic text-center">Inscrito: {formData.enrollmentMonth !== undefined ? MONTH_NAMES[formData.enrollmentMonth] : '-'} {formData.enrollmentYear}</p>
                        )}
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Código de Registro *</label>
                         <input
                            required
                            maxLength={5}
                            value={formData.registrationCode}
                            onChange={(e) => setFormData({...formData, registrationCode: e.target.value.replace(/\D/g, '')})}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-950 rounded-lg text-white font-mono font-black text-center text-lg tracking-[0.2em] shadow-inner"
                         />
                      </div>
                    </div>
                  </div>

                  {/* Bloque 3: Contacto y SAT */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <Mail size={14} className="text-slate-600" />
                       <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.1em]">Contacto y Fiscal</span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-black text-blue-600 uppercase ml-1">Correo Acceso Padres *</label>
                          {editingStudent && formData.parentEmail && (
                            <button
                              type="button"
                              onClick={() => handleResendEmail(editingStudent)}
                              disabled={sendingEmailId === editingStudent.id}
                              className="flex items-center gap-1 text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase transition-all"
                            >
                              {sendingEmailId === editingStudent.id ? (
                                <div className="w-2 h-2 border border-blue-600 border-t-white rounded-full animate-spin" />
                              ) : (
                                <Mail size={10} />
                              )}
                              Reenviar Invitación
                            </button>
                          )}
                        </div>
                        <input
                          type="email"
                          required
                          value={formData.parentEmail}
                          onChange={(e) => setFormData({...formData, parentEmail: e.target.value})}
                          className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg focus:bg-white focus:border-blue-600 outline-none text-xs font-bold"
                          placeholder="obligatorio para el portal"
                        />
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <ShieldCheck size={12} className="text-slate-400" />
                          <span className="text-[9px] font-black text-slate-500 uppercase italic">Facturación CFDI 4.0</span>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RFC</label>
                          <input
                            value={formData.rfc}
                            onChange={(e) => setFormData({...formData, rfc: e.target.value.toUpperCase()})}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs font-bold uppercase outline-none focus:border-slate-900"
                            placeholder="XAXX010101000"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Régimen Fiscal</label>
                          <select
                            value={formData.taxSystem}
                            onChange={(e) => setFormData({...formData, taxSystem: e.target.value})}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded text-[10px] font-bold outline-none focus:border-slate-900"
                          >
                            <option value="605">605 - Sueldos y Salarios</option>
                            <option value="601">601 - General Personas Morales</option>
                            <option value="616">616 - Sin obligaciones</option>
                            <option value="626">626 - RESICO</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>

              {/* Botonera de Acción */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                  * Todos los campos identitarios son obligatorios para el sistema.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-all"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    form="student-form"
                    className="px-6 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200 flex items-center gap-2"
                  >
                    {editingStudent ? <Edit2 size={12} /> : <Check size={12} />}
                    {editingStudent ? 'Actualizar' : 'Finalizar Alta'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      {isHistoryModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 italic">
                  <History className="text-emerald-600 not-italic" size={20} />
                  HISTORIAL DE PAGOS
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{selectedStudent.name} {selectedStudent.lastName}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-md transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[70vh]">
              {studentPayments.length > 0 ? (
                <div className="space-y-3">
                  {studentPayments.map((payment) => (
                    <div key={payment.id} className="p-3 bg-white rounded-md border border-slate-100 flex items-center justify-between gap-4 hover:border-slate-300 transition-colors shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-50 rounded flex items-center justify-center text-slate-400 border border-slate-100">
                          <CreditCard size={14} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{payment.concept}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                              <Calendar size={10} /> {format(payment.date.toDate(), 'dd MMM yyyy', { locale: es })}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[8px] font-black uppercase tracking-widest">
                              {payment.paymentMethod}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-950">${payment.amount.toLocaleString()}</p>
                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em]">LIQUIDADO</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-200">
                    <CreditCard size={24} />
                  </div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sin registros de pago.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="tech-button"
              >
                CERRAR VENTANA
              </button>
            </div>
          </div>
        </div>
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

      {/* Modal de Error por Duplicado */}
      <AnimatePresence>
        {duplicateError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDuplicateError(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-red-100"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">¡Alumno ya existe!</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Hemos detectado que ya existe un expediente activo con estos datos.
                </p>
                
                <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expediente Coincidente:</p>
                  <p className="text-sm font-bold text-slate-900 uppercase">{duplicateError.name}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-1">{duplicateError.curp}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDuplicateError(null)}
                    className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Modal de Éxito Correo */}
      <AnimatePresence>
        {showEmailSuccess && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-sm w-full text-center space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto shadow-inner">
                <Check size={32} strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">¡Correo Enviado!</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mt-2">
                  El correo de bienvenida ha sido reenviado con éxito al padre de familia.
                </p>
              </div>
              <button 
                onClick={() => setShowEmailSuccess(false)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
