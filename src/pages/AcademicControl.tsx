import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Enrollment, Student, AppSettings, Payment, SchoolCycle, StudentGrade, Subject, AppUser } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Search, Filter, CheckCircle2, XCircle, Clock, Eye, X, Copy, Check, GraduationCap, MapPin, Phone, Mail, User, Users, ShieldAlert, AlertCircle, Printer, FileDown, Edit2, CreditCard, AlertTriangle, UserRound, Download, BookOpen, Plus, Trash2, Sparkles, Calendar, UserPlus, Image as ImageIcon, ReceiptText, ShieldCheck, FileSpreadsheet, Layers, Link2, MessageSquare } from 'lucide-react';
import { cn, studentMatchesSearch } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EnrollmentPDF from '../components/EnrollmentPDF';
import RegistrationCodePDF from '../components/RegistrationCodePDF';
import OfficialListPDF from '../components/OfficialListPDF';
import StudentObservationsModal from '../components/StudentObservationsModal';
import BatchBoletasModal from '../components/BatchBoletasModal';
import { exportAttendanceExcel, exportAttendanceExcelAllGroups } from '../lib/attendanceExcel';
import { calculateStudentDebts, MONTH_NAMES } from '../lib/paymentUtils';
import { calculateCURP, STATES, getNextGradeAndLevel } from '../lib/studentUtils';
import { getLevelEvaluationConfig, gradeToNumeric, formatAverage, getEffectiveSubjectGrade, isObservationsLevel } from '../lib/evaluationUtils';
import { sendWelcomeEmail } from '../services/mailService';
import { toast } from 'react-toastify';

export default function AcademicControl() {
  const { hasPermission, userProfile } = usePermissions();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const defaultTab = (requestedTab === 'enrollments' || requestedTab === 'studentList' || requestedTab === 'subjects' || requestedTab === 'taes') 
    ? requestedTab 
    : 'studentList';
  const [activeTab, setActiveTab] = useState<'enrollments' | 'studentList' | 'subjects' | 'taes'>(defaultTab);

  useEffect(() => {
    if (requestedTab === 'enrollments' || requestedTab === 'studentList' || requestedTab === 'subjects' || requestedTab === 'taes') {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  // Student List Filters
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  // Attendance List Export States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'allInLevel'>('current');
  const [exportLevel, setExportLevel] = useState('');
  const [exportGrade, setExportGrade] = useState('');
  const [exportGroup, setExportGroup] = useState('');
  const [exportTeacherName, setExportTeacherName] = useState('');

  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentFormData, setStudentFormData] = useState<Partial<Student>>({});
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [codeModalStudent, setCodeModalStudent] = useState<Student | null>(null);
  const [observationsModalStudent, setObservationsModalStudent] = useState<Student | null>(null);
  const [isBatchBoletasModalOpen, setIsBatchBoletasModalOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [isGroupSelectModalOpen, setIsGroupSelectModalOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  // Migration and Cycles States
  const [filterCycleId, setFilterCycleId] = useState('');
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState(false);
  const [migrationSourceCycle, setMigrationSourceCycle] = useState('');
  const [migrationTargetCycle, setMigrationTargetCycle] = useState('');
  const [migrationSelectedStudents, setMigrationSelectedStudents] = useState<string[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);

  const currentCycle = cycles.find(c => c.id === settings?.currentCycleId);

  useEffect(() => {
    // If we were on studentList and it's active, show the prompt if no filters are set
    if (activeTab === 'studentList' && !filterLevel && !filterGrade && !filterGroup) {
      setIsGroupSelectModalOpen(true);
    }
  }, [activeTab]);

  const handleApplyGroupFilter = () => {
    setFilterLevel(selectedLevel);
    setFilterGrade(selectedGrade);
    setFilterGroup(selectedGroup);
    setIsGroupSelectModalOpen(false);
  };

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
      setGrades(snap.docs.map(doc => {
        const raw = doc.data() as any;
        const subjects = { ...(raw.subjects || {}) };
        Object.keys(raw).forEach(key => {
          if (key.startsWith('subjects.')) {
            const subjName = key.slice('subjects.'.length);
            if (raw[key] !== undefined && raw[key] !== null) {
              subjects[subjName] = raw[key];
            }
          }
        });
        return { id: doc.id, ...raw, subjects } as StudentGrade;
      }));
    });

    const unsubCycles = onSnapshot(collection(db, 'cycles'), (snap) => {
      setCycles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCycle)));
    });

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    });

    return () => {
      unsubEnrollments();
      unsubStudents();
      unsubSettings();
      unsubPayments();
      unsubGrades();
      unsubCycles();
      unsubSubjects();
      unsubUsers();
    };
  }, []);

  useEffect(() => {
    if (exportLevel && exportGrade && exportGroup) {
      const match = users.find(u => 
        u.role === 'Docente' && 
        u.assignedLevel === exportLevel && 
        (!u.assignedGrade || u.assignedGrade === exportGrade) && 
        (!u.assignedGroup || u.assignedGroup === exportGroup)
      );
      if (match) {
        setExportTeacherName(match.name);
      }
    }
  }, [exportLevel, exportGrade, exportGroup, users]);

  useEffect(() => {
    if (settings?.currentCycleId && !filterCycleId) {
      setFilterCycleId(settings.currentCycleId);
    }
  }, [settings?.currentCycleId]);

  const handleExecuteMigration = async () => {
    if (!migrationSourceCycle || !migrationTargetCycle || migrationSelectedStudents.length === 0) return;
    if (migrationSourceCycle === migrationTargetCycle) {
      alert("El ciclo de origen y destino no pueden ser el mismo.");
      return;
    }
    
    setIsMigrating(true);
    try {
      const batch = updateDoc(doc(db, 'settings', 'general'), {}).constructor.name === 'Function' ? null : collection(db, 'students'); // dummy to trigger transaction or writeBatch
      const writeBatchRef = await import('firebase/firestore').then(m => m.writeBatch);
      const batchInstance = writeBatchRef(db);
      
      for (const studentId of migrationSelectedStudents) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;
        
        const histLevel = student.cycleId === migrationSourceCycle ? student.level : (student.gradeHistory?.[migrationSourceCycle]?.level || student.level);
        const histGrade = student.cycleId === migrationSourceCycle ? student.grade : (student.gradeHistory?.[migrationSourceCycle]?.grade || student.grade);
        const histGroup = student.cycleId === migrationSourceCycle ? student.group : (student.gradeHistory?.[migrationSourceCycle]?.group || student.group);
        
        const { grade: nextGrade, level: nextLevel } = getNextGradeAndLevel(histGrade, histLevel);
        const nextGroup = histGroup || '';
        
        const currentCycles = student.cycles || (student.cycleId ? [student.cycleId] : []);
        const newCycles = currentCycles.includes(migrationTargetCycle)
          ? currentCycles
          : [...currentCycles, migrationTargetCycle];
          
        const currentHistory = student.gradeHistory || {};
        const newHistory = {
          ...currentHistory,
          [migrationSourceCycle]: {
            level: histLevel,
            grade: histGrade,
            group: histGroup || ''
          }
        };
        
        const studentRef = doc(db, 'students', student.id);
        batchInstance.update(studentRef, {
          cycleId: migrationTargetCycle,
          cycles: newCycles,
          gradeHistory: newHistory,
          level: nextLevel,
          grade: nextGrade,
          group: nextGroup,
          updatedAt: serverTimestamp()
        });
      }
      
      await batchInstance.commit();
      alert(`Migración completada con éxito. Se migraron ${migrationSelectedStudents.length} alumnos.`);
      setIsMigrateModalOpen(false);
      setMigrationSourceCycle('');
      setMigrationTargetCycle('');
      setMigrationSelectedStudents([]);
    } catch (error) {
      console.error("Error migrating students:", error);
      alert("Hubo un error al ejecutar la migración.");
    } finally {
      setIsMigrating(false);
    }
  };

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
          lastName: enrol.studentLastName,
          motherLastName: enrol.studentMotherLastName,
          birthDate: enrol.birthDate,
          gender: enrol.gender === 'Hombre' ? 'H' : 'M',
          birthState: enrol.birthPlaceStateCode || '', 
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

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  const generateMatriculaCode = (level: string) => {
    const prefix = settings?.matriculaPrefixes?.[level] || '';
    let code = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
    let attempts = 0;
    while (students.some(s => s.matricula === code) && attempts < 20) {
      code = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
      attempts++;
    }
    return code;
  };

  const handleResendEmail = async (student: Student) => {
    if (!settings || !student.parentEmail) return;
    
    setSendingEmailId(student.id);
    try {
      await sendWelcomeEmail(student, settings);
      alert('Invitación enviada exitosamente.');
    } catch (error) {
      console.error('Error reenviando correo:', error);
      alert('Hubo un error al reenviar el correo. Por favor intente más tarde.');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentFormData({
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
      level: student.level || availableLevels[0] || 'Primaria',
      grade: student.grade || '',
      group: student.group || '',
      rfc: student.rfc || '',
      billingName: student.billingName || '',
      billingAddress: student.billingAddress || '',
      zipCode: student.zipCode || '',
      taxSystem: student.taxSystem || '605',
      registrationCode: student.registrationCode || '',
      photoUrl: student.photoUrl || '',
      matricula: student.matricula || '',
      cycleId: student.cycleId || settings?.currentCycleId || '',
      enrollmentMonth: student.enrollmentMonth,
      enrollmentYear: student.enrollmentYear
    });
  };

  // Auto-calculate CURP in edit modal
  useEffect(() => {
    if (editingStudent && studentFormData.name && studentFormData.lastName && studentFormData.birthDate && studentFormData.gender && studentFormData.birthState) {
      const calculatedToken = calculateCURP({
        firstName: studentFormData.name,
        lastName: studentFormData.lastName,
        motherLastName: studentFormData.motherLastName,
        birthDate: studentFormData.birthDate,
        gender: studentFormData.gender as 'H' | 'M',
        birthState: studentFormData.birthState
      });
      
      if (calculatedToken && (!studentFormData.curp || studentFormData.curp.slice(0, 16) !== calculatedToken)) {
        setStudentFormData(prev => ({ ...prev, curp: calculatedToken + (prev.curp?.slice(16) || '') }));
      }
    }
  }, [studentFormData.name, studentFormData.lastName, studentFormData.motherLastName, studentFormData.birthDate, studentFormData.gender, studentFormData.birthState, editingStudent]);

  const handleSaveStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingStudent) return;

    // Check for matrícula conflict
    const hasMatriculaConflict = studentFormData.matricula && students.some(s => 
      s.matricula === studentFormData.matricula && s.id !== editingStudent.id
    );

    if (hasMatriculaConflict) {
      const conflictingStudent = students.find(s => s.matricula === studentFormData.matricula);
      alert(
        `Conflicto de Matrícula:\n\nLa matrícula "${studentFormData.matricula}" ya está asignada a:\n${conflictingStudent?.lastName} ${conflictingStudent?.name} (${conflictingStudent?.level} ${conflictingStudent?.grade})\n\nPor favor asigne una matrícula única.`
      );
      return;
    }

    setIsSavingStudent(true);
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), {
        ...studentFormData,
        parentEmail: (studentFormData.parentEmail || '').toLowerCase().trim(),
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

  const isSuperAdmin = userProfile?.role === 'Superadministrador' || userProfile?.email?.toLowerCase() === 'cramonmb@gmail.com';
  const restrictedLevels = useMemo(() => isSuperAdmin ? [] : (userProfile?.restrictedLevels || []), [isSuperAdmin, userProfile?.restrictedLevels]);
  const restrictedGrades = useMemo(() => isSuperAdmin ? [] : (userProfile?.restrictedGrades || []), [isSuperAdmin, userProfile?.restrictedGrades]);
  const restrictedGroups = useMemo(() => isSuperAdmin ? [] : (userProfile?.restrictedGroups || []), [isSuperAdmin, userProfile?.restrictedGroups]);

  const availableLevels = useMemo(() => {
    const all = settings?.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato'];
    if (restrictedLevels.length > 0) {
      return all.filter(lvl => restrictedLevels.includes(lvl));
    }
    return all;
  }, [settings?.academicLevels, restrictedLevels]);

  const availableGrades = useMemo(() => {
    const all = settings?.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to'];
    if (restrictedGrades.length > 0) {
      return all.filter(g => restrictedGrades.includes(g));
    }
    return all;
  }, [settings?.academicGrades, restrictedGrades]);

  const availableGroups = useMemo(() => {
    const all = settings?.academicGroups || ['A', 'B', 'C', 'D'];
    if (restrictedGroups.length > 0) {
      return all.filter(grp => restrictedGroups.includes(grp));
    }
    return all;
  }, [settings?.academicGroups, restrictedGroups]);

  const filteredEnrollments = enrollments.filter(e => {
    // Restricciones granulares asignadas al usuario
    if (restrictedLevels.length > 0 && !restrictedLevels.includes(e.level)) return false;
    if (restrictedGrades.length > 0 && !restrictedGrades.includes(e.grade)) return false;

    const matchesSearch = studentMatchesSearch([
      e.studentName,
      e.studentLastName,
      e.folio,
      e.curp
    ], searchTerm);
    const matchesStatus = !filterStatus || e.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const filteredStudents = students.filter(s => {
    // Restricciones granulares asignadas al usuario
    if (restrictedLevels.length > 0 && !restrictedLevels.includes(s.level)) return false;
    if (restrictedGrades.length > 0 && !restrictedGrades.includes(s.grade)) return false;
    if (restrictedGroups.length > 0 && !restrictedGroups.includes(s.group || '')) return false;

    const matchesSearch = studentMatchesSearch([
      s.name,
      s.lastName,
      s.motherLastName,
      s.curp,
      s.matricula
    ], searchTerm);
    const matchesLevel = !filterLevel || s.level === filterLevel;
    const matchesGrade = !filterGrade || s.grade === filterGrade;
    const matchesGroup = !filterGroup || s.group === filterGroup;
    const matchesCycle = !filterCycleId || s.cycleId === filterCycleId || (s.cycles && s.cycles.includes(filterCycleId)) || (!s.cycleId && filterCycleId === settings?.currentCycleId);

    return matchesSearch && matchesLevel && matchesGrade && matchesGroup && matchesCycle;
  }).sort((a, b) => {
    const nameA = `${a.lastName || ''} ${a.name || ''}`.toLowerCase();
    const nameB = `${b.lastName || ''} ${b.name || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Groups data for multi-group level export
  const levelGroupsData = useMemo(() => {
    const targetLevel = exportLevel || filterLevel || (availableLevels.length > 0 ? availableLevels[0] : '');
    if (!targetLevel) return [];
    
    const levelStudents = students.filter(s => {
      if (restrictedLevels.length > 0 && !restrictedLevels.includes(s.level)) return false;
      if (restrictedGrades.length > 0 && !restrictedGrades.includes(s.grade)) return false;
      if (restrictedGroups.length > 0 && !restrictedGroups.includes(s.group || '')) return false;

      const matchesCycle = !filterCycleId || s.cycleId === filterCycleId || (s.cycles && s.cycles.includes(filterCycleId)) || (!s.cycleId && filterCycleId === settings?.currentCycleId);
      return s.level === targetLevel && matchesCycle;
    });

    const map = new Map<string, { level: string; grade: string; group: string; students: Student[]; teacherName?: string }>();
    
    levelStudents.forEach(s => {
      const key = `${s.grade}__${s.group || 'Sin Grupo'}`;
      if (!map.has(key)) {
        const teacher = users.find(u => 
          u.role === 'Docente' && 
          u.assignedLevel === targetLevel && 
          u.assignedGrade === s.grade && 
          (!u.assignedGroup || u.assignedGroup === s.group)
        );
        map.set(key, {
          level: targetLevel,
          grade: s.grade,
          group: s.group || '',
          students: [],
          teacherName: teacher?.name || '',
        });
      }
      map.get(key)!.students.push(s);
    });

    return Array.from(map.values()).sort((a, b) => {
      const gComp = a.grade.localeCompare(b.grade, undefined, { numeric: true });
      if (gComp !== 0) return gComp;
      return a.group.localeCompare(b.group);
    });
  }, [students, exportLevel, filterLevel, filterCycleId, settings?.currentCycleId, users, availableLevels, restrictedLevels, restrictedGrades, restrictedGroups]);

  // Students for single group export in modal
  const exportStudentsList = useMemo(() => {
    const tLevel = exportLevel || filterLevel;
    const tGrade = exportGrade || filterGrade;
    const tGroup = exportGroup || filterGroup;

    return students.filter(s => {
      if (restrictedLevels.length > 0 && !restrictedLevels.includes(s.level)) return false;
      if (restrictedGrades.length > 0 && !restrictedGrades.includes(s.grade)) return false;
      if (restrictedGroups.length > 0 && !restrictedGroups.includes(s.group || '')) return false;

      const matchesLevel = !tLevel || s.level === tLevel;
      const matchesGrade = !tGrade || s.grade === tGrade;
      const matchesGroup = !tGroup || s.group === tGroup;
      const matchesCycle = !filterCycleId || s.cycleId === filterCycleId || (s.cycles && s.cycles.includes(filterCycleId)) || (!s.cycleId && filterCycleId === settings?.currentCycleId);
      return matchesLevel && matchesGrade && matchesGroup && matchesCycle;
    }).sort((a, b) => {
      const nameA = `${a.lastName || ''} ${a.name || ''}`.toLowerCase();
      const nameB = `${b.lastName || ''} ${b.name || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [students, exportLevel, filterLevel, exportGrade, filterGrade, exportGroup, filterGroup, filterCycleId, settings?.currentCycleId, restrictedLevels, restrictedGrades, restrictedGroups]);

  // Students for batch report cards download when in a group
  const currentGroupStudents = useMemo(() => {
    if (!filterLevel || !filterGrade || !filterGroup) return [];
    return students.filter(s => {
      if (restrictedLevels.length > 0 && !restrictedLevels.includes(s.level)) return false;
      if (restrictedGrades.length > 0 && !restrictedGrades.includes(s.grade)) return false;
      if (restrictedGroups.length > 0 && !restrictedGroups.includes(s.group || '')) return false;

      const matchesLevel = s.level === filterLevel;
      const matchesGrade = s.grade === filterGrade;
      const matchesGroup = s.group === filterGroup;
      const matchesCycle = !filterCycleId || s.cycleId === filterCycleId || (s.cycles && s.cycles.includes(filterCycleId)) || (!s.cycleId && filterCycleId === settings?.currentCycleId);
      return matchesLevel && matchesGrade && matchesGroup && matchesCycle;
    }).sort((a, b) => {
      const nameA = `${a.lastName || ''} ${a.name || ''}`.toLowerCase();
      const nameB = `${b.lastName || ''} ${b.name || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [students, filterLevel, filterGrade, filterGroup, filterCycleId, settings?.currentCycleId, restrictedLevels, restrictedGrades, restrictedGroups]);

  // Teacher assigned to current group
  const currentGroupTeacher = useMemo(() => {
    if (!filterLevel) return '';
    const match = users.find(u => 
      u.role === 'Docente' && 
      u.assignedLevel === filterLevel && 
      (!u.assignedGrade || u.assignedGrade === filterGrade) && 
      (!u.assignedGroup || u.assignedGroup === filterGroup)
    );
    return match?.name || '';
  }, [users, filterLevel, filterGrade, filterGroup]);

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
            <button
              onClick={() => setActiveTab('taes')}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                activeTab === 'taes' 
                  ? "bg-blue-900 text-white shadow-sm" 
                  : "text-slate-400 hover:text-blue-950"
              )}
            >
              <Sparkles size={11} className={activeTab === 'taes' ? "text-blue-200" : "text-slate-400"} />
              TAES
            </button>
          </div>
          {activeTab === 'studentList' && (
            <button
              onClick={() => {
                setExportLevel(filterLevel || (availableLevels[0] || ''));
                setExportGrade(filterGrade || (availableGrades[0] || ''));
                setExportGroup(filterGroup || (availableGroups[0] || ''));
                setIsExportModalOpen(true);
              }}
              className="bg-slate-950 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" />
              Exportar Listas (PDF / Excel)
            </button>
          )}
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

      {activeTab === 'enrollments' && (
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
      )}

      {activeTab === 'studentList' && (
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
              <button
                onClick={() => setIsGroupSelectModalOpen(true)}
                className="bg-slate-900 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all"
              >
                <Filter size={12} /> Cambiar Grupo
              </button>
              <button
                onClick={() => setIsMigrateModalOpen(true)}
                className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
              >
                <Calendar size={12} className="text-blue-500" /> Migrar Alumnos
              </button>
              <button
                onClick={() => {
                  setExportLevel(filterLevel || (availableLevels[0] || ''));
                  setExportGrade(filterGrade || (availableGrades[0] || ''));
                  setExportGroup(filterGroup || (availableGroups[0] || ''));
                  setIsExportModalOpen(true);
                }}
                className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
              >
                <FileSpreadsheet size={12} className="text-emerald-600" /> Exportar Listas
              </button>

              <button
                onClick={() => {
                  if (!filterLevel || !filterGrade || !filterGroup) {
                    setIsGroupSelectModalOpen(true);
                    return;
                  }
                  setIsBatchBoletasModalOpen(true);
                }}
                className={cn(
                  "px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer shadow-sm",
                  filterLevel && filterGrade && filterGroup
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 active:scale-95"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
                title={filterLevel && filterGrade && filterGroup ? "Descargar todas las boletas de este grupo en PDFs individuales" : "Selecciona un grupo para descargar las boletas"}
              >
                <FileDown size={12} className={filterLevel && filterGrade && filterGroup ? "text-white" : "text-indigo-600"} />
                <span>Descargar Boletas {filterLevel && filterGrade && filterGroup ? `(${currentGroupStudents.length})` : ''}</span>
              </button>

              <select
                value={filterCycleId}
                onChange={(e) => setFilterCycleId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:border-slate-900"
              >
                <option value="">TODOS LOS CICLOS</option>
                {cycles.map(cycle => (
                  <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                ))}
              </select>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:border-slate-900"
              >
                <option value="">TODOS NIVELES</option>
                {availableLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:border-slate-900"
              >
                <option value="">TODOS GRADOS</option>
                {availableGrades.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:border-slate-900"
              >
                <option value="">TODOS GRUPOS</option>
                {availableGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>

              {(filterLevel || filterGrade || filterGroup || searchTerm || (filterCycleId !== (settings?.currentCycleId || ''))) && (
                <button
                  onClick={() => {
                    setFilterLevel('');
                    setFilterGrade('');
                    setFilterGroup('');
                    setSearchTerm('');
                    setFilterCycleId(settings?.currentCycleId || '');
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Active Group Indicator Banner */}
          {filterLevel && filterGrade && filterGroup && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-indigo-950 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider">
                  Grupo Activo: {filterLevel} {filterGrade} "{filterGroup}"
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                  {currentGroupStudents.length} {currentGroupStudents.length === 1 ? 'Alumno' : 'Alumnos'}
                </span>
              </div>
              <button
                onClick={() => setIsBatchBoletasModalOpen(true)}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <FileDown size={12} />
                <span>Descargar Boletas del Grupo ({currentGroupStudents.length})</span>
              </button>
            </div>
          )}

          {/* Student List Grid - Technical Data Style */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden shadow-slate-100">
            <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-950 text-slate-400 text-[8px] font-black uppercase tracking-[0.2em] border-b border-slate-800">
                    <th className="px-4 py-3 border-r border-slate-800 text-center w-px whitespace-nowrap">No.</th>
                    <th className="px-4 py-3 border-r border-slate-800 italic w-px whitespace-nowrap">Expediente Alumno</th>
                    <th className="px-4 py-3 border-r border-slate-800 text-center italic">Matrícula</th>
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
                      const debtStatus = calculateStudentDebts(student, payments, currentCycle || null, settings, cycles);
                      const history = (filterCycleId && student.cycleId !== filterCycleId) ? student.gradeHistory?.[filterCycleId] : null;
                      const displayLevel = history?.level || student.level;
                      const displayGrade = history?.grade || student.grade;
                      const displayGroup = history?.group || student.group || '-';
                      
                      const studentGrades = grades.filter(g => g.studentId === student.id && (!currentCycle || g.cycleId === currentCycle.id));
                      const academicSubjectNames = subjects
                        .filter(sub => sub.level?.toLowerCase().trim() === student.level?.toLowerCase().trim() && (sub.category === 'Académica' || !sub.category))
                        .map(sub => sub.name);

                      const evalConfig = getLevelEvaluationConfig(settings, displayLevel);
                      const scale = evalConfig.gradingScale || 'numeric_10';

                      const getBimestreAvg = (num: number) => {
                        const bg = studentGrades.find(g => Number(g.bimestre) === num);
                        if (!bg || !bg.subjects) return null;
                        
                        const nums: number[] = [];
                        for (const name of academicSubjectNames) {
                          const result = getEffectiveSubjectGrade(name, num, studentGrades, subjects, scale);
                          if (result.numericValue !== null) nums.push(result.numericValue);
                        }

                        if (nums.length === 0) return null;
                        return nums.reduce((a, b) => a + b, 0) / nums.length;
                      };

                      const periodIndices = Array.from({ length: evalConfig.periodCount }, (_, i) => i + 1);
                      const capturedAvgs = periodIndices.map(num => getBimestreAvg(num)).filter((v): v is number => v !== null);
                      const finalAvgDisplay = capturedAvgs.length > 0 
                        ? formatAverage(capturedAvgs.reduce((a, b) => a + b, 0), capturedAvgs.length, scale)
                        : null;

                      return (
                        <tr 
                          key={student.id} 
                          className="group hover:bg-slate-950 hover:text-white transition-all cursor-default"
                        >
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center font-black text-slate-400 group-hover:text-white w-px whitespace-nowrap">
                            {filteredStudents.indexOf(student) + 1}
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 w-px whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {student.photoUrl ? (
                                <img 
                                  src={student.photoUrl} 
                                  alt="Avatar" 
                                  className="w-6 h-6 rounded object-cover border border-slate-200 group-hover:border-slate-700 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-slate-100 group-hover:bg-slate-800 flex items-center justify-center font-black text-slate-500 text-[8px] group-hover:text-slate-400 border border-slate-200 group-hover:border-slate-700 shrink-0">
                                  {student.name.charAt(0)}{student.lastName.charAt(0)}
                                </div>
                              )}
                              <div>
                                 <span className="font-bold uppercase tracking-tight leading-none whitespace-nowrap">{student.lastName} {student.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center font-mono group-hover:text-amber-400 whitespace-nowrap">
                            {student.matricula || 'N/A'}
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center font-mono group-hover:text-amber-400 whitespace-nowrap">
                            {student.curp || 'N/A'}
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center">
                            <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{displayLevel}</span>
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 group-hover:border-slate-800 text-center bg-slate-50 group-hover:bg-slate-900">
                             <span className="text-[11px] font-black tracking-tighter italic">{displayGrade} - {displayGroup}</span>
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
                            {finalAvgDisplay !== null ? (
                              <span className={cn(
                                "text-[10px] font-black px-1.5 py-0.5 rounded",
                                scale === 'letters'
                                  ? (finalAvgDisplay === 'A' ? "bg-emerald-50 text-emerald-600 border border-emerald-200 group-hover:bg-emerald-500 group-hover:text-white" :
                                     finalAvgDisplay === 'E' || finalAvgDisplay === 'B' ? "bg-blue-50 text-blue-600 border border-blue-200 group-hover:bg-blue-600 group-hover:text-white" :
                                     finalAvgDisplay === 'ED' || finalAvgDisplay === 'C' ? "bg-amber-50 text-amber-600 border border-amber-200 group-hover:bg-amber-500 group-hover:text-white" :
                                     "bg-rose-50 text-rose-600 border border-rose-200 group-hover:bg-rose-500 group-hover:text-white")
                                  : (scale === 'numeric_100'
                                     ? (Number(finalAvgDisplay) < 60 ? "bg-rose-50 text-rose-600 group-hover:bg-rose-500 group-hover:text-white" : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white")
                                     : (Number(finalAvgDisplay) < 6 ? "bg-rose-50 text-rose-600 group-hover:bg-rose-500 group-hover:text-white" : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"))
                              )}>
                                {finalAvgDisplay}
                              </span>
                            ) : (
                               <span className="text-[8px] font-black text-slate-300 group-hover:text-slate-700">-</span>
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
                              {isObservationsLevel(displayLevel) && (
                                <button
                                  onClick={() => setObservationsModalStudent(student)}
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:!bg-blue-600 hover:!text-white group-hover:bg-slate-800 group-hover:text-slate-400 rounded transition-all flex items-center justify-center"
                                  title="Observaciones por Materia"
                                >
                                  <MessageSquare size={13} />
                                </button>
                              )}
                              <a
                                href={`/imprimir-boleta/${student.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-slate-100 text-slate-600 hover:!bg-emerald-500 hover:!text-white group-hover:bg-slate-800 group-hover:text-slate-400 rounded transition-all flex items-center justify-center"
                                title="Imprimir Boleta"
                              >
                                <Printer size={13} />
                              </a>
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
        <SubjectsManagement subjects={subjects} settings={settings} availableLevels={availableLevels} />
      )}

      {activeTab === 'taes' && (
        <TaesManagement
          subjects={subjects}
          students={students}
          settings={settings}
          availableLevels={availableLevels}
          onGoToSubjects={() => setActiveTab('subjects')}
        />
      )}

      {/* Select Group Modal */}
      <AnimatePresence>
        {isGroupSelectModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsGroupSelectModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Filter size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">Seleccionar Grupo</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Control de Listas Oficiales</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6 text-center">
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => {
                      setFilterLevel('');
                      setFilterGrade('');
                      setFilterGroup('');
                      setIsGroupSelectModalOpen(false);
                    }}
                    className="w-full py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
                  >
                    <UserRound size={20} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Ver Todos los Alumnos</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase italic">Matrícula General</span>
                  </button>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-2 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">O SELECCIONAR GRUPO</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Nivel</label>
                      <select
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-slate-900 transition-all uppercase"
                      >
                        <option value="">NIVEL</option>
                        {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Grado</label>
                      <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-slate-900 transition-all uppercase"
                      >
                        <option value="">GRADO</option>
                        {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Grupo</label>
                      <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-slate-900 transition-all uppercase"
                      >
                        <option value="">GRUPO</option>
                        {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                   <button
                    onClick={() => setIsGroupSelectModalOpen(false)}
                    className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handleApplyGroupFilter}
                    disabled={!selectedLevel || !selectedGrade || !selectedGroup}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-100"
                  >
                    Confirmar Seleccion
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Attendance Lists Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
              onClick={() => setIsExportModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-slate-950 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                    <FileSpreadsheet size={22} className="text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">Exportar Lista de Asistencia</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Formatos Oficiales Institucionales</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[calc(85vh-140px)] overflow-y-auto">
                {/* Scope selector */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">
                    1. Alcance de la Exportación
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExportScope('current')}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all cursor-pointer relative",
                        exportScope === 'current'
                          ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className={exportScope === 'current' ? "text-sky-400" : "text-slate-400"} />
                        <span className="text-xs font-black uppercase tracking-tight">Un Solo Grupo</span>
                      </div>
                      <p className={cn("text-[9px] font-medium leading-relaxed", exportScope === 'current' ? "text-slate-300" : "text-slate-500")}>
                        Exporta la lista de un grado y grupo en específico.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportScope('allInLevel')}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all cursor-pointer relative",
                        exportScope === 'allInLevel'
                          ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Layers size={16} className={exportScope === 'allInLevel' ? "text-emerald-400" : "text-slate-400"} />
                        <span className="text-xs font-black uppercase tracking-tight">Todos los Grupos</span>
                      </div>
                      <p className={cn("text-[9px] font-medium leading-relaxed", exportScope === 'allInLevel' ? "text-slate-300" : "text-slate-500")}>
                        Exporta todos los grupos del nivel en un solo archivo.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Filters according to scope */}
                {exportScope === 'current' ? (
                  <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-1">Nivel</label>
                        <select
                          value={exportLevel}
                          onChange={(e) => setExportLevel(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none uppercase focus:border-slate-900"
                        >
                          <option value="">SELECCIONE</option>
                          {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-1">Grado</label>
                        <select
                          value={exportGrade}
                          onChange={(e) => setExportGrade(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none uppercase focus:border-slate-900"
                        >
                          <option value="">SELECCIONE</option>
                          {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-1">Grupo</label>
                        <select
                          value={exportGroup}
                          onChange={(e) => setExportGroup(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none uppercase focus:border-slate-900"
                        >
                          <option value="">SELECCIONE</option>
                          {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-1">
                        Docente Responsable / Titular
                      </label>
                      <input
                        type="text"
                        placeholder="Nombre del docente asignado al grupo"
                        value={exportTeacherName}
                        onChange={(e) => setExportTeacherName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none uppercase focus:border-slate-900"
                      />
                      <p className="text-[9px] text-slate-400 mt-1 font-medium italic">
                        * Detectado automáticamente de usuarios colaboradores o puedes escribirlo manualmente.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alumnos en este grupo:</span>
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-900 font-black text-xs rounded-lg">
                        {exportStudentsList.length} Alumnos
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-1">Nivel Educativo</label>
                      <select
                        value={exportLevel}
                        onChange={(e) => setExportLevel(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none uppercase focus:border-slate-900"
                      >
                        <option value="">SELECCIONE NIVEL</option>
                        {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600">Grupos detectados:</span>
                        <span className="font-black text-slate-900">{levelGroupsData.length} Grupos</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600">Total de alumnos en el nivel:</span>
                        <span className="font-black text-emerald-600">
                          {levelGroupsData.reduce((acc, g) => acc + g.students.length, 0)} Alumnos
                        </span>
                      </div>
                    </div>

                    <p className="text-[9px] text-slate-500 leading-normal">
                      ℹ️ <strong>En PDF:</strong> Se generará un documento con una página apaisada para cada grupo con membrete institucional y firmas.
                      <br />
                      ℹ️ <strong>En Excel:</strong> Se generará un libro de cálculo con una pestaña individual para cada grupo.
                    </p>
                  </div>
                )}

                {/* Export Action Buttons */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">
                    2. Selecciona el Formato de Descarga
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* PDF Button via PDFDownloadLink */}
                    {exportScope === 'current' ? (
                      <PDFDownloadLink
                        document={
                          <OfficialListPDF
                            students={exportStudentsList}
                            settings={settings}
                            level={exportLevel}
                            grade={exportGrade}
                            group={exportGroup}
                            cycleName={currentCycle?.name || 'ACTUAL'}
                            teacherName={exportTeacherName}
                          />
                        }
                        fileName={`LISTA_${exportLevel}_${exportGrade}_${exportGroup}_${currentCycle?.name || 'ACTUAL'}.pdf`.replace(/\s+/g, '_')}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 hover:bg-black text-white text-center transition-all shadow-xl shadow-slate-200 active:scale-95 cursor-pointer",
                          (!exportLevel || !exportGrade || !exportGroup) && "opacity-50 pointer-events-none"
                        )}
                      >
                        {/* @ts-ignore */}
                        {({ loading }: any) => (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-2">
                              <Printer size={20} className="text-rose-400" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">
                              {loading ? 'Generando PDF...' : 'Descargar PDF Oficial'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                              Landscape con membrete y firmas
                            </span>
                          </>
                        )}
                      </PDFDownloadLink>
                    ) : (
                      <PDFDownloadLink
                        document={
                          <OfficialListPDF
                            groups={levelGroupsData}
                            settings={settings}
                            level={exportLevel}
                            cycleName={currentCycle?.name || 'ACTUAL'}
                          />
                        }
                        fileName={`LISTAS_${exportLevel}_TODOS_LOS_GRUPOS_${currentCycle?.name || 'ACTUAL'}.pdf`.replace(/\s+/g, '_')}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 hover:bg-black text-white text-center transition-all shadow-xl shadow-slate-200 active:scale-95 cursor-pointer",
                          (!exportLevel || levelGroupsData.length === 0) && "opacity-50 pointer-events-none"
                        )}
                      >
                        {/* @ts-ignore */}
                        {({ loading }: any) => (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-2">
                              <Printer size={20} className="text-rose-400" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">
                              {loading ? 'Generando PDF...' : 'Descargar PDF (Todos)'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                              {levelGroupsData.length} grupos en un solo PDF
                            </span>
                          </>
                        )}
                      </PDFDownloadLink>
                    )}

                    {/* Excel Button */}
                    <button
                      type="button"
                      disabled={
                        exportScope === 'current'
                          ? (!exportLevel || !exportGrade || !exportGroup)
                          : (!exportLevel || levelGroupsData.length === 0)
                      }
                      onClick={() => {
                        if (exportScope === 'current') {
                          exportAttendanceExcel({
                            students: exportStudentsList,
                            settings,
                            level: exportLevel,
                            grade: exportGrade,
                            group: exportGroup,
                            cycle: currentCycle || null,
                            teacherName: exportTeacherName,
                          });
                        } else {
                          exportAttendanceExcelAllGroups({
                            groups: levelGroupsData,
                            settings,
                            level: exportLevel,
                            cycle: currentCycle || null,
                          });
                        }
                      }}
                      className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-center transition-all shadow-xl shadow-emerald-100 active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-2">
                        <FileSpreadsheet size={20} className="text-emerald-200" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider">Descargar Excel (.xlsx)</span>
                      <span className="text-[9px] text-emerald-200 font-medium mt-0.5">
                        {exportScope === 'current' ? 'Hoja con membrete y casillas' : `${levelGroupsData.length} pestañas por grupo`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Edit Student Modal */}
      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingStudent(null)}
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
                      Editar Registro
                    </h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">
                      Control Escolar • Ciclo {currentCycle?.name || 'Actual'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingStudent(null)} 
                  className="p-1.5 hover:bg-slate-100 rounded-md transition-all text-slate-400 hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              </div>
              
              <form id="student-edit-form" onSubmit={handleSaveStudent} className="flex-1 overflow-y-auto p-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Bloque 1: Identidad */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <User size={14} className="text-blue-600" />
                       <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.1em]">Identidad</span>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Carga de Fotografía de Alumno */}
                      <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Fotografía del Alumno</span>
                        <div className="relative group w-20 h-24 bg-slate-200 rounded-lg overflow-hidden border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all">
                          {studentFormData.photoUrl ? (
                            <img src={studentFormData.photoUrl} alt="Foto Alumno" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-slate-400 group-hover:text-blue-500 text-center">
                              <ImageIcon size={20} className="mb-1" />
                              <span className="text-[8px] font-bold uppercase">Sin Foto</span>
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white text-[8px] font-black uppercase tracking-tight">
                            {studentFormData.photoUrl ? 'Cambiar' : 'Subir'}
                          </div>
                          
                          <input 
                            type="file" 
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!settings?.imgbbApiKey) {
                                alert("No se ha configurado la API Key de ImgBB en Ajustes.");
                                return;
                              }
                              
                              setUploadingPhoto(true);
                              try {
                                const fd = new FormData();
                                fd.append('image', file);
                                const res = await fetch(`https://api.imgbb.com/1/upload?key=${settings.imgbbApiKey}`, {
                                  method: 'POST',
                                  body: fd
                                });
                                if (!res.ok) throw new Error("Error en la respuesta del servidor ImgBB");
                                const resData = await res.json();
                                if (resData.success && resData.data?.url) {
                                  setStudentFormData(prev => ({ ...prev, photoUrl: resData.data.url }));
                                } else {
                                  throw new Error(resData.error?.message || "Error al subir la imagen");
                                }
                              } catch (err: any) {
                                console.error("Error subiendo foto:", err);
                                alert(`Error al subir fotografía: ${err.message || err}`);
                              } finally {
                                setUploadingPhoto(false);
                              }
                            }}
                          />
                          
                          {uploadingPhoto && (
                            <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        {studentFormData.photoUrl && (
                          <button
                            type="button"
                            onClick={() => setStudentFormData(prev => ({ ...prev, photoUrl: '' }))}
                            className="text-[8px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest hover:underline"
                          >
                            Eliminar Foto
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Nombre(s) *</label>
                        <input
                          required
                          value={studentFormData.name || ''}
                          onChange={(e) => setStudentFormData({...studentFormData, name: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold uppercase transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Paterno *</label>
                          <input
                            required
                            value={studentFormData.lastName || ''}
                            onChange={(e) => setStudentFormData({...studentFormData, lastName: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold uppercase transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Materno</label>
                          <input
                            value={studentFormData.motherLastName || ''}
                            onChange={(e) => setStudentFormData({...studentFormData, motherLastName: e.target.value})}
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
                                 value={studentFormData.birthDate || ''}
                                 onChange={(e) => setStudentFormData({...studentFormData, birthDate: e.target.value})}
                                 className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                           </div>
                           <div>
                              <label className="block text-[9px] font-bold text-blue-800 uppercase mb-1">Género</label>
                              <select
                                 required
                                 value={studentFormData.gender || 'H'}
                                 onChange={(e) => setStudentFormData({...studentFormData, gender: e.target.value as 'H' | 'M'})}
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
                              value={studentFormData.birthState || 'JC'}
                              onChange={(e) => setStudentFormData({...studentFormData, birthState: e.target.value})}
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
                            value={studentFormData.curp || ''}
                            onChange={(e) => setStudentFormData({...studentFormData, curp: e.target.value.toUpperCase()})}
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
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Ciclo Escolar *</label>
                        <select
                          required
                          value={studentFormData.cycleId || ''}
                          onChange={(e) => setStudentFormData({...studentFormData, cycleId: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold transition-all"
                        >
                          <option value="">Seleccionar...</option>
                          {cycles.map(cycle => (
                            <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Nivel Educativo *</label>
                        <select
                          required
                          value={studentFormData.level || ''}
                          onChange={(e) => {
                            const newLevel = e.target.value;
                            setStudentFormData(prev => {
                              const oldLevel = prev.level || '';
                              const oldPrefix = settings?.matriculaPrefixes?.[oldLevel] || '';
                              const isAutoGenerated = !prev.matricula || (oldPrefix && prev.matricula.startsWith(oldPrefix));
                              
                              let nextMatricula = prev.matricula;
                              if (isAutoGenerated) {
                                nextMatricula = generateMatriculaCode(newLevel);
                              }
                              return { ...prev, level: newLevel, matricula: nextMatricula };
                            });
                          }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold transition-all"
                        >
                          <option value="">Seleccionar...</option>
                          {availableLevels.map(level => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Matrícula</label>
                        <input
                          value={studentFormData.matricula || ''}
                          onChange={(e) => setStudentFormData({...studentFormData, matricula: e.target.value})}
                          placeholder="Autogenerada..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none text-xs font-bold uppercase transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Grado *</label>
                          <select
                            required
                            value={studentFormData.grade || ''}
                            onChange={(e) => setStudentFormData({...studentFormData, grade: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-bold"
                          >
                            <option value="">Grado</option>
                            {availableGrades.map(grade => (
                              <option key={grade} value={grade}>{grade}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Grupo</label>
                          <select
                            value={studentFormData.group || ''}
                            onChange={(e) => setStudentFormData({...studentFormData, group: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-bold"
                          >
                            <option value="">Grupo</option>
                            {availableGroups.map(group => (
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
                        <p className="text-[10px] text-emerald-700 font-bold italic text-center">
                          Inscrito: {studentFormData.enrollmentMonth !== undefined ? MONTH_NAMES[studentFormData.enrollmentMonth] : '-'} {studentFormData.enrollmentYear || ''}
                        </p>
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Código de Registro *</label>
                         <input
                            required
                            maxLength={5}
                            value={studentFormData.registrationCode || ''}
                            onChange={(e) => setStudentFormData({...studentFormData, registrationCode: e.target.value.replace(/\D/g, '')})}
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
                          <label className="block text-[10px] font-black text-slate-700 uppercase ml-1">
                            Correo Acceso Padres <span className="text-slate-400 font-normal text-[9px] lowercase">(opcional)</span>
                          </label>
                          {editingStudent && studentFormData.parentEmail && (
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
                          value={studentFormData.parentEmail || ''}
                          onChange={(e) => setStudentFormData({...studentFormData, parentEmail: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 outline-none text-xs font-bold"
                          placeholder="ej. padre@correo.com (opcional)"
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
                            value={studentFormData.rfc || ''}
                            onChange={(e) => setStudentFormData({...studentFormData, rfc: e.target.value.toUpperCase()})}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs font-bold uppercase outline-none focus:border-slate-900"
                            placeholder="XAXX010101000"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Régimen Fiscal</label>
                          <select
                            value={studentFormData.taxSystem || '605'}
                            onChange={(e) => setStudentFormData({...studentFormData, taxSystem: e.target.value})}
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
                    onClick={() => setEditingStudent(null)}
                    className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-all"
                    disabled={isSavingStudent}
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    form="student-edit-form"
                    disabled={isSavingStudent}
                    className="px-6 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200 flex items-center gap-2"
                  >
                    {isSavingStudent ? <Clock size={12} className="animate-spin" /> : <Edit2 size={12} />}
                    {isSavingStudent ? 'Actualizando...' : 'Actualizar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Modal de Migración de Ciclo */}
      <AnimatePresence>
        {isMigrateModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-xl w-full flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 text-left">
                  <Calendar size={18} className="text-blue-500" />
                  Migrar Alumnos de Ciclo Escolar
                </h3>
                <button onClick={() => {
                  setIsMigrateModalOpen(false);
                  setMigrationSourceCycle('');
                  setMigrationTargetCycle('');
                  setMigrationSelectedStudents([]);
                }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="py-4 space-y-4 flex-1 overflow-y-auto text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ciclo de Origen *</label>
                    <select
                      value={migrationSourceCycle}
                      onChange={(e) => {
                        setMigrationSourceCycle(e.target.value);
                        setMigrationSelectedStudents([]);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    >
                      <option value="">Seleccionar...</option>
                      {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ciclo de Destino *</label>
                    <select
                      value={migrationTargetCycle}
                      onChange={(e) => setMigrationTargetCycle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    >
                      <option value="">Seleccionar...</option>
                      {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {migrationSourceCycle && (() => {
                  const srcStudents = students.filter(s => {
                    if (restrictedLevels.length > 0 && !restrictedLevels.includes(s.level)) return false;
                    if (restrictedGrades.length > 0 && !restrictedGrades.includes(s.grade)) return false;
                    if (restrictedGroups.length > 0 && !restrictedGroups.includes(s.group || '')) return false;
                    return s.cycleId === migrationSourceCycle || (s.cycles && s.cycles.includes(migrationSourceCycle)) || (!s.cycleId && migrationSourceCycle === settings?.currentCycleId);
                  });
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Alumnos en Ciclo Origen ({srcStudents.length})
                        </span>
                        <button
                          onClick={() => {
                            if (migrationSelectedStudents.length === srcStudents.length) {
                              setMigrationSelectedStudents([]);
                            } else {
                              setMigrationSelectedStudents(srcStudents.map(s => s.id));
                            }
                          }}
                          className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                        >
                          {migrationSelectedStudents.length === srcStudents.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                        </button>
                      </div>

                      <div className="border border-slate-100 rounded-xl max-h-[250px] overflow-y-auto divide-y divide-slate-50 p-2 bg-slate-50">
                        {srcStudents.map(student => {
                        const history = student.cycleId !== migrationSourceCycle ? student.gradeHistory?.[migrationSourceCycle] : null;
                        const level = history?.level || student.level;
                        const grade = history?.grade || student.grade;
                        const group = history?.group || student.group || '';
                        
                        return (
                          <label key={student.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-white rounded-md cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={migrationSelectedStudents.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMigrationSelectedStudents(prev => [...prev, student.id]);
                                } else {
                                  setMigrationSelectedStudents(prev => prev.filter(id => id !== student.id));
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 truncate uppercase">{student.lastName} {student.name}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase">{level} - {grade} {group}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsMigrateModalOpen(false);
                    setMigrationSourceCycle('');
                    setMigrationTargetCycle('');
                    setMigrationSelectedStudents([]);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  disabled={isMigrating}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExecuteMigration}
                  disabled={isMigrating || !migrationSourceCycle || !migrationTargetCycle || migrationSelectedStudents.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                >
                  {isMigrating ? 'Migrando...' : `Migrar (${migrationSelectedStudents.length})`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Observations Modal for Preescolar and Primaria */}
      <StudentObservationsModal
        isOpen={!!observationsModalStudent}
        onClose={() => setObservationsModalStudent(null)}
        student={observationsModalStudent}
        cycle={currentCycle || null}
        settings={settings}
        subjects={subjects}
      />

      {/* Batch Boletas Modal per Group */}
      <BatchBoletasModal
        isOpen={isBatchBoletasModalOpen}
        onClose={() => setIsBatchBoletasModalOpen(false)}
        students={currentGroupStudents}
        grades={grades}
        subjects={subjects}
        settings={settings}
        cycle={currentCycle || ({ id: filterCycleId || 'actual', name: 'Ciclo Actual' } as SchoolCycle)}
        level={filterLevel}
        grade={filterGrade}
        group={filterGroup}
        teacherName={currentGroupTeacher}
      />
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

function SubjectsManagement({ subjects, settings, availableLevels }: { subjects: Subject[]; settings: AppSettings | null; availableLevels?: string[] }) {
  const [newSubject, setNewSubject] = useState<{
    name: string;
    level: string;
    category: 'Académica' | 'Autonomía Curricular' | 'Desarrollo Personal' | 'Aspectos Formativos' | 'Recursamiento';
    linkedSubjectName: string;
    isAttendanceCount: boolean;
    isTae: boolean;
  }>({ name: '', level: '', category: 'Académica', linkedSubjectName: '', isAttendanceCount: false, isTae: false });
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copyingLevel, setCopyingLevel] = useState<string | null>(null); // level card that is picking a source
  const [isCopying, setIsCopying] = useState(false);
  const levels = (availableLevels && availableLevels.length > 0) ? availableLevels : (settings?.academicLevels || []);

  const CATEGORIES = [
    { key: 'Académica', label: 'Académica', color: 'blue', icon: '📘' },
    { key: 'Autonomía Curricular', label: 'Autonomía Curricular', color: 'amber', icon: '🎨' },
    { key: 'Desarrollo Personal', label: 'Desarrollo Personal', color: 'indigo', icon: '🧠' },
    { key: 'Recursamiento', label: 'Recursamiento', color: 'rose', icon: '🔄' },
  ];

  const getCategoryColor = (cat: string) => {
    if (cat === 'Autonomía Curricular') return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', header: 'bg-amber-50/80 border-amber-100', headerText: 'text-amber-600' };
    if (cat === 'Desarrollo Personal' || cat === 'Aspectos Formativos') return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', header: 'bg-indigo-50/80 border-indigo-100', headerText: 'text-indigo-600' };
    if (cat === 'Recursamiento') return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', header: 'bg-rose-50/80 border-rose-100', headerText: 'text-rose-600' };
    return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', header: 'bg-blue-50/80 border-blue-100', headerText: 'text-blue-600' };
  };

  const handleMoveCategory = async (subject: Subject, newCategory: 'Académica' | 'Autonomía Curricular' | 'Desarrollo Personal' | 'Recursamiento') => {
    if (subject.category === newCategory) return;
    try {
      await updateDoc(doc(db, 'subjects', subject.id), {
        category: newCategory,
        linkedSubjectName: newCategory === 'Autonomía Curricular' ? (subject.linkedSubjectName || null) : null,
        isAttendanceCount: (newCategory === 'Desarrollo Personal' || (newCategory as any) === 'Aspectos Formativos') ? !!subject.isAttendanceCount : false,
        updatedAt: serverTimestamp()
      });
      toast.success(`Materia "${subject.name}" movida a ${newCategory}.`);
    } catch (err) {
      console.error("Error moving subject category:", err);
      toast.error("Error al mover la materia de categoría");
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubject.name || !newSubject.level) {
      alert("Por favor completa el nombre y selecciona un nivel.");
      return;
    }
    const cleanName = newSubject.name.trim();
    const cleanLevel = newSubject.level.trim();
    const alreadyExists = subjects.some(s => 
      (s.level || '').toLowerCase().trim() === cleanLevel.toLowerCase() &&
      s.name.toLowerCase().trim() === cleanName.toLowerCase()
    );
    if (alreadyExists) {
      alert(`La materia "${cleanName}" ya está registrada en el nivel ${cleanLevel}. No se pueden duplicar materias en el mismo nivel.`);
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'subjects'), {
        name: cleanName,
        level: cleanLevel,
        category: newSubject.category,
        linkedSubjectName: newSubject.category === 'Autonomía Curricular' ? (newSubject.linkedSubjectName || null) : null,
        isAttendanceCount: (newSubject.category === 'Desarrollo Personal' || newSubject.category === 'Aspectos Formativos') ? !!newSubject.isAttendanceCount : false,
        isTae: !!newSubject.isTae,
        taeStudentMode: newSubject.isTae ? 'all' : null,
        taeStudentIds: [],
        createdAt: serverTimestamp()
      });
      setNewSubject({ name: '', level: '', category: 'Académica', linkedSubjectName: '', isAttendanceCount: false, isTae: false });
      toast.success(newSubject.isTae ? `Materia TAE "${cleanName}" creada. Configura sus alumnos en la pestaña TAES.` : `Materia "${cleanName}" creada correctamente.`);
    } catch (error) {
      console.error("Error creating subject:", error);
      alert("Error al crear materia");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSubject = async () => {
    if (!editingSubject || !editingSubject.name || !editingSubject.level) return;
    const cleanName = editingSubject.name.trim();
    const cleanLevel = editingSubject.level.trim();
    const alreadyExists = subjects.some(s => 
      s.id !== editingSubject.id &&
      (s.level || '').toLowerCase().trim() === cleanLevel.toLowerCase() &&
      s.name.toLowerCase().trim() === cleanName.toLowerCase()
    );
    if (alreadyExists) {
      alert(`Ya existe otra materia llamada "${cleanName}" en el nivel ${cleanLevel}.`);
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'subjects', editingSubject.id), {
        name: cleanName,
        level: cleanLevel,
        category: editingSubject.category || 'Académica',
        linkedSubjectName: editingSubject.category === 'Autonomía Curricular' ? (editingSubject.linkedSubjectName || null) : null,
        isAttendanceCount: (editingSubject.category === 'Desarrollo Personal' || editingSubject.category === 'Aspectos Formativos') ? !!editingSubject.isAttendanceCount : false,
        isTae: !!editingSubject.isTae,
        taeStudentMode: editingSubject.isTae ? (editingSubject.taeStudentMode || 'all') : null,
        updatedAt: serverTimestamp()
      });
      toast.success("Materia actualizada correctamente.");
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
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'subjects', id));
      toast.success("Materia eliminada.");
    } catch (error) {
      console.error("Error deleting subject:", error);
      alert("Error al eliminar materia");
    }
  };

  const handleCopyFromLevel = async (targetLevel: string, sourceLevel: string) => {
    const sourceSubjects = subjects.filter(s => s.level === sourceLevel);
    if (sourceSubjects.length === 0) {
      alert(`No hay materias en ${sourceLevel} para copiar.`);
      return;
    }
    const targetSubjectNames = subjects
      .filter(s => (s.level || '').toLowerCase().trim() === targetLevel.toLowerCase().trim())
      .map(s => s.name.toLowerCase().trim());

    const toCreate = sourceSubjects.filter(
      s => !targetSubjectNames.includes(s.name.toLowerCase().trim())
    );

    if (toCreate.length === 0) {
      alert(`Todas las materias de ${sourceLevel} ya existen en ${targetLevel}.`);
      setCopyingLevel(null);
      return;
    }

    if (!window.confirm(`Se copiarán ${toCreate.length} materia(s) de ${sourceLevel} a ${targetLevel}. ¿Continuar?`)) {
      setCopyingLevel(null);
      return;
    }

    setIsCopying(true);
    try {
      for (const subj of toCreate) {
        await addDoc(collection(db, 'subjects'), {
          name: subj.name,
          level: targetLevel,
          category: subj.category || 'Académica',
          linkedSubjectName: subj.linkedSubjectName || null,
          isAttendanceCount: !!subj.isAttendanceCount,
          isTae: !!subj.isTae,
          taeStudentMode: subj.isTae ? (subj.taeStudentMode || 'all') : null,
          taeStudentIds: subj.isTae ? (subj.taeStudentIds || []) : [],
          createdAt: serverTimestamp()
        });
      }
      toast.success(`${toCreate.length} materias copiadas a ${targetLevel}.`);
      setCopyingLevel(null);
    } catch (error) {
      console.error("Error copying subjects:", error);
      alert("Error al copiar materias");
    } finally {
      setIsCopying(false);
    }
  };

  const subjectsByLevel = levels.reduce((acc, level) => {
    acc[level] = subjects.filter(s => s.level === level);
    return acc;
  }, {} as Record<string, Subject[]>);

  const normalizeCategory = (cat?: string) => {
    if (cat === 'Aspectos Formativos') return 'Desarrollo Personal';
    if (cat === 'Recursamiento') return 'Recursamiento';
    if (cat === 'Autonomía Curricular') return 'Autonomía Curricular';
    if (cat === 'Desarrollo Personal') return 'Desarrollo Personal';
    return 'Académica';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Create Subject Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2rem] mb-6 flex items-center gap-2 italic">
          <Plus size={16} className="text-blue-500" /> Registrar Nueva Materia
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-end">
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
              onChange={(e) => setNewSubject({ ...newSubject, level: e.target.value, linkedSubjectName: '' })}
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
              onChange={(e) => setNewSubject({ ...newSubject, category: e.target.value as any, linkedSubjectName: '', isAttendanceCount: false })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold uppercase tracking-tight"
            >
              <option value="Académica">Académica (Base)</option>
              <option value="Autonomía Curricular">Autonomía Curricular</option>
              <option value="Desarrollo Personal">Desarrollo Personal / Conducta</option>
              <option value="Recursamiento">Recursamiento</option>
            </select>
          </div>
          {newSubject.category === 'Autonomía Curricular' && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Suma al promedio de
              </label>
              <select
                value={newSubject.linkedSubjectName || ''}
                onChange={(e) => setNewSubject({ ...newSubject, linkedSubjectName: e.target.value })}
                className="w-full px-4 py-3 bg-amber-50/60 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm font-bold uppercase tracking-tight text-amber-900"
              >
                <option value="">(Ninguna - Independiente)</option>
                {(subjectsByLevel[newSubject.level] || [])
                  .filter(s => normalizeCategory(s.category) === 'Académica')
                  .map(s => (
                    <option key={s.id} value={s.name}>Suma a: {s.name}</option>
                  ))}
              </select>
            </div>
          )}
          {newSubject.category === 'Desarrollo Personal' && (
            <div>
              <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 ml-1">
                Faltas de Asistencia
              </label>
              <label className="flex items-center gap-2 px-3 py-3 bg-indigo-50/60 border border-indigo-200 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!newSubject.isAttendanceCount}
                  onChange={(e) => setNewSubject({ ...newSubject, isAttendanceCount: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-tight leading-none">
                  Suma Faltas Auto.
                </span>
              </label>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1.5 ml-1">
              Modalidad TAE
            </label>
            <label className="flex items-center gap-2 px-3 py-3 bg-blue-50/60 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100/50 transition-colors">
              <input
                type="checkbox"
                checked={!!newSubject.isTae}
                onChange={(e) => setNewSubject({ ...newSubject, isTae: e.target.checked })}
                className="w-4 h-4 text-blue-900 rounded border-blue-300 focus:ring-blue-900 cursor-pointer"
              />
              <span className="text-[11px] font-bold text-blue-950 uppercase tracking-tight leading-none">
                ¿Es TAE?
              </span>
            </label>
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
        {levels.map(level => {
          const levelSubjects = subjectsByLevel[level] || [];
          const otherLevels = levels.filter(l => l !== level && (subjectsByLevel[l]?.length || 0) > 0);

          return (
            <div key={level} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <BookOpen size={14} className="text-blue-500" /> {level}
                  </h3>
                  <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">
                    {levelSubjects.length} Materias
                  </span>
                </div>
                {/* Copy from Level */}
                <div className="flex items-center gap-2">
                  {copyingLevel === level ? (
                    <div className="flex items-center gap-2 w-full">
                      <select
                        autoFocus
                        className="flex-1 bg-white border border-blue-300 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase tracking-tight outline-none focus:ring-2 focus:ring-blue-200"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) handleCopyFromLevel(level, e.target.value);
                        }}
                      >
                        <option value="" disabled>Copiar materias de...</option>
                        {otherLevels.map(l => (
                          <option key={l} value={l}>{l} ({subjectsByLevel[l]?.length || 0} materias)</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setCopyingLevel(null)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCopyingLevel(level)}
                      disabled={isCopying || otherLevels.length === 0}
                      className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-blue-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Copy size={11} /> Copiar de otro nivel
                    </button>
                  )}
                </div>
              </div>

              <div className="p-2 flex-1 md:min-h-[200px] space-y-1">
                {levelSubjects.length > 0 ? (
                  CATEGORIES.map(cat => {
                    const catSubjects = levelSubjects.filter(s => normalizeCategory(s.category) === cat.key);
                    if (catSubjects.length === 0) return null;
                    const colors = getCategoryColor(cat.key);

                    return (
                      <div key={cat.key} className="mb-2">
                        {/* Category Header */}
                        <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border mb-1", colors.header)}>
                          <span className={cn("text-[9px] font-black uppercase tracking-[0.15em]", colors.headerText)}>
                            {cat.label}
                          </span>
                          <span className={cn("text-[8px] font-bold ml-auto px-1.5 py-0.5 rounded-full", colors.bg, colors.text)}>
                            {catSubjects.length}
                          </span>
                        </div>
                        {/* Category Subjects */}
                        <div className="divide-y divide-slate-50">
                          {catSubjects.map(subj => (
                            <div key={subj.id} className="px-3 py-2 flex items-center justify-between group hover:bg-slate-50 rounded-lg transition-all">
                              {editingSubject?.id === subj.id ? (
                                <div className="flex-1 flex flex-wrap gap-2 items-center">
                                  <input 
                                    autoFocus
                                    value={editingSubject.name}
                                    onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                                    className="flex-1 min-w-[120px] bg-white border border-blue-200 rounded px-2 py-1 text-sm font-bold outline-none"
                                  />
                                  <select
                                    value={normalizeCategory(editingSubject.category)}
                                    onChange={(e) => setEditingSubject({ 
                                      ...editingSubject, 
                                      category: e.target.value as any,
                                      linkedSubjectName: e.target.value === 'Autonomía Curricular' ? editingSubject.linkedSubjectName : undefined
                                    })}
                                    className="bg-white border border-blue-200 rounded px-1.5 py-1 text-[9px] font-black uppercase"
                                  >
                                    <option value="Académica">Académica</option>
                                    <option value="Autonomía Curricular">Aut. Curr.</option>
                                    <option value="Desarrollo Personal">Des. Personal</option>
                                    <option value="Recursamiento">Recursamiento</option>
                                  </select>
                                  {normalizeCategory(editingSubject.category) === 'Autonomía Curricular' && (
                                    <select
                                      value={editingSubject.linkedSubjectName || ''}
                                      onChange={(e) => setEditingSubject({ ...editingSubject, linkedSubjectName: e.target.value })}
                                      className="bg-amber-50 border border-amber-200 rounded px-1.5 py-1 text-[8px] font-black uppercase text-amber-900 max-w-[160px]"
                                      title="Vincular a materia académica para promediar"
                                    >
                                      <option value="">(Sin vincular)</option>
                                      {(subjectsByLevel[editingSubject.level] || [])
                                        .filter(s => normalizeCategory(s.category) === 'Académica' && s.id !== editingSubject.id)
                                        .map(s => (
                                          <option key={s.id} value={s.name}>Suma a: {s.name}</option>
                                        ))}
                                    </select>
                                  )}
                                  {normalizeCategory(editingSubject.category) === 'Desarrollo Personal' && (
                                    <label className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-1 text-[8px] font-black uppercase text-indigo-900 cursor-pointer" title="Marcar para sumar faltas automáticamente">
                                      <input
                                        type="checkbox"
                                        checked={!!editingSubject.isAttendanceCount}
                                        onChange={(e) => setEditingSubject({ ...editingSubject, isAttendanceCount: e.target.checked })}
                                        className="w-3 h-3 text-indigo-600 rounded"
                                      />
                                      <span>Suma Faltas</span>
                                    </label>
                                  )}
                                  <label className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-1.5 py-1 text-[8px] font-black uppercase text-blue-900 cursor-pointer" title="Marcar como materia TAE">
                                    <input
                                      type="checkbox"
                                      checked={!!editingSubject.isTae}
                                      onChange={(e) => setEditingSubject({ ...editingSubject, isTae: e.target.checked })}
                                      className="w-3 h-3 text-blue-900 rounded"
                                    />
                                    <span>Es TAE</span>
                                  </label>
                                  <button onClick={handleUpdateSubject} className="text-emerald-500 hover:text-emerald-700"><Check size={16}/></button>
                                  <button onClick={() => setEditingSubject(null)} className="text-rose-500 hover:text-rose-700"><X size={16}/></button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-sm font-bold text-slate-700 uppercase tracking-tight italic truncate">{subj.name}</span>
                                    {subj.isTae && (
                                      <span className="text-[9px] font-black text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1 mt-0.5 w-fit">
                                        <Sparkles size={10} className="text-blue-700" /> TAE {subj.taeStudentMode === 'specific' ? `(${subj.taeStudentIds?.length || 0} alumnos)` : '(Todos los alumnos)'}
                                      </span>
                                    )}
                                    {subj.linkedSubjectName && (
                                      <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                        <Link2 size={10} /> Suma a: {subj.linkedSubjectName}
                                      </span>
                                    )}
                                    {subj.isAttendanceCount && (
                                      <span className="text-[9px] font-bold text-indigo-600 flex items-center gap-1 mt-0.5">
                                        <Sparkles size={10} /> Suma Faltas Automáticas
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                    <select
                                      value={normalizeCategory(subj.category)}
                                      onChange={(e) => handleMoveCategory(subj, e.target.value as any)}
                                      className="bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-700 outline-none cursor-pointer transition-colors"
                                      title="Mover categoría de la materia"
                                    >
                                      <option value="Académica">Académica</option>
                                      <option value="Autonomía Curricular">Aut. Curr.</option>
                                      <option value="Desarrollo Personal">Des. Personal</option>
                                      <option value="Recursamiento">Recursamiento</option>
                                    </select>
                                    <button 
                                      onClick={() => setEditingSubject(subj)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                      title="Editar materia"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteSubject(subj.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                      title="Eliminar materia"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Sin materias asignadas</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaesManagement({
  subjects,
  students,
  settings,
  availableLevels,
  onGoToSubjects
}: {
  subjects: Subject[];
  students: Student[];
  settings: AppSettings | null;
  availableLevels?: string[];
  onGoToSubjects: () => void;
}) {
  const levels = (availableLevels && availableLevels.length > 0) ? availableLevels : (settings?.academicLevels || []);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');
  const [taeSearch, setTaeSearch] = useState<string>('');

  // Modal student assignment state
  const [managingTae, setManagingTae] = useState<Subject | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('');
  const [modalGradeFilter, setModalGradeFilter] = useState<string>('all');
  const [modalGroupFilter, setModalGroupFilter] = useState<string>('all');
  const [isSavingAssignment, setIsSavingAssignment] = useState<boolean>(false);

  // All subjects marked as TAE
  const taes = useMemo(() => {
    return subjects.filter(s => !!s.isTae);
  }, [subjects]);

  // Counts of TAES per level
  const countsByLevel = useMemo(() => {
    const map: Record<string, number> = {};
    levels.forEach(lvl => {
      map[lvl] = taes.filter(t => (t.level || '').toLowerCase().trim() === lvl.toLowerCase().trim()).length;
    });
    return map;
  }, [levels, taes]);

  // Filtered TAES by level and search term
  const filteredTaes = useMemo(() => {
    return taes.filter(t => {
      const matchesLevel = selectedLevelFilter === 'all' || (t.level?.toLowerCase().trim() === selectedLevelFilter.toLowerCase().trim());
      const matchesSearch = !taeSearch.trim() || t.name.toLowerCase().includes(taeSearch.toLowerCase().trim());
      return matchesLevel && matchesSearch;
    });
  }, [taes, selectedLevelFilter, taeSearch]);

  const handleToggleMode = async (tae: Subject, mode: 'all' | 'specific') => {
    try {
      await updateDoc(doc(db, 'subjects', tae.id), {
        taeStudentMode: mode,
        updatedAt: serverTimestamp()
      });
      if (mode === 'all') {
        toast.success(`TAE asignada a todos los alumnos.`);
      } else {
        openAssignModal({ ...tae, taeStudentMode: 'specific' });
      }
    } catch (err) {
      console.error("Error updating TAE mode:", err);
      toast.error("Error al actualizar la modalidad");
    }
  };

  const openAssignModal = (tae: Subject) => {
    setManagingTae(tae);
    setSelectedStudentIds(tae.taeStudentIds || []);
    setModalSearchTerm('');
    setModalGradeFilter('all');
    setModalGroupFilter('all');
  };

  const handleSaveStudents = async () => {
    if (!managingTae) return;
    setIsSavingAssignment(true);
    try {
      await updateDoc(doc(db, 'subjects', managingTae.id), {
        taeStudentMode: 'specific',
        taeStudentIds: selectedStudentIds,
        updatedAt: serverTimestamp()
      });
      toast.success(`Alumnos asignados correctamente.`);
      setManagingTae(null);
    } catch (err) {
      console.error("Error saving TAE students:", err);
      toast.error("Error al guardar alumnos");
    } finally {
      setIsSavingAssignment(false);
    }
  };

  // Eligible students for the TAE's level
  const eligibleStudents = useMemo(() => {
    if (!managingTae) return [];
    const lvl = managingTae.level?.toLowerCase().trim();
    return students.filter(st => {
      const stLvl = st.level?.toLowerCase().trim();
      return stLvl === lvl;
    });
  }, [managingTae, students]);

  // Distinct grades & groups in eligible students
  const modalAvailableGrades = useMemo(() => {
    const setG = new Set<string>();
    eligibleStudents.forEach(st => {
      if (st.grade) setG.add(st.grade);
    });
    return Array.from(setG).sort();
  }, [eligibleStudents]);

  const modalAvailableGroups = useMemo(() => {
    const setGr = new Set<string>();
    eligibleStudents.forEach(st => {
      if (st.group) setGr.add(st.group);
    });
    return Array.from(setGr).sort();
  }, [eligibleStudents]);

  // Filtered students inside modal
  const modalFilteredStudents = useMemo(() => {
    return eligibleStudents.filter(st => {
      if (modalGradeFilter !== 'all' && st.grade !== modalGradeFilter) return false;
      if (modalGroupFilter !== 'all' && st.group !== modalGroupFilter) return false;
      if (modalSearchTerm.trim()) {
        const query = modalSearchTerm.toLowerCase().trim();
        const full = `${st.name || ''} ${st.lastName || ''} ${st.motherLastName || ''} ${st.curp || ''} ${st.id || ''}`.toLowerCase();
        if (!full.includes(query)) return false;
      }
      return true;
    }).sort((a, b) => {
      const nameA = `${a.name || ''} ${a.lastName || ''}`.toLowerCase();
      const nameB = `${b.name || ''} ${b.lastName || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [eligibleStudents, modalGradeFilter, modalGroupFilter, modalSearchTerm]);

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = modalFilteredStudents.map(s => s.id);
    setSelectedStudentIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  };

  const deselectAllVisible = () => {
    const visibleIds = new Set(modalFilteredStudents.map(s => s.id));
    setSelectedStudentIds(prev => prev.filter(id => !visibleIds.has(id)));
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar: Level pills + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedLevelFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
              selectedLevelFilter === 'all'
                ? "bg-blue-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <span>Todos</span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.2 rounded font-bold",
              selectedLevelFilter === 'all' ? "bg-blue-800 text-blue-100" : "bg-white text-slate-600"
            )}>
              {taes.length}
            </span>
          </button>

          {levels.map(lvl => {
            const count = countsByLevel[lvl] || 0;
            const isSelected = selectedLevelFilter.toLowerCase().trim() === lvl.toLowerCase().trim();
            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevelFilter(lvl)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                  isSelected
                    ? "bg-blue-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <span>{lvl}</span>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.2 rounded font-bold",
                  isSelected ? "bg-blue-800 text-blue-100" : "bg-white text-slate-600"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            placeholder="Buscar TAE..."
            value={taeSearch}
            onChange={(e) => setTaeSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold w-full outline-none focus:bg-white focus:border-blue-900 uppercase"
          />
        </div>
      </div>

      {/* TAES Grid / Empty State */}
      {taes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            No hay materias marcadas como TAE
          </p>
          <button
            onClick={onGoToSubjects}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            Ir a Materias
          </button>
        </div>
      ) : filteredTaes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs font-bold uppercase">
          Sin TAES para este filtro
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTaes.map(tae => {
            const isSpecific = tae.taeStudentMode === 'specific';
            const assignedCount = (tae.taeStudentIds || []).length;

            return (
              <div
                key={tae.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div>
                  <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                    {tae.level}
                  </span>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1.5 truncate" title={tae.name}>
                    {tae.name}
                  </h3>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {/* Segmented Switch */}
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleToggleMode(tae, 'all')}
                      className={cn(
                        "py-1 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                        !isSpecific
                          ? "bg-blue-900 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleMode(tae, 'specific')}
                      className={cn(
                        "py-1 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                        isSpecific
                          ? "bg-blue-900 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Específicos
                    </button>
                  </div>

                  {isSpecific ? (
                    <button
                      type="button"
                      onClick={() => openAssignModal(tae)}
                      className="w-full py-1.5 px-3 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <Users size={12} />
                      <span>Alumnos ({assignedCount})</span>
                    </button>
                  ) : (
                    <div className="py-1.5 text-center text-xs font-bold text-slate-500 uppercase bg-slate-50 rounded-lg border border-slate-200/60">
                      Todos los alumnos
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Asignar Alumnos a TAE */}
      <AnimatePresence>
        {managingTae && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setManagingTae(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-5 py-4 bg-blue-900 text-white flex items-center justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-wide truncate">
                    {managingTae.name}
                  </h2>
                  <p className="text-[10px] font-bold text-blue-200 uppercase mt-0.5">
                    {managingTae.level} • Asignación de Alumnos
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setManagingTae(null)}
                  className="p-1 text-white/80 hover:text-white rounded transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Filters */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input
                      placeholder="Buscar alumno..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold w-full outline-none focus:border-blue-900 uppercase"
                    />
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={modalGradeFilter}
                      onChange={(e) => setModalGradeFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none uppercase"
                    >
                      <option value="all">Grado: Todos</option>
                      {modalAvailableGrades.map(g => (
                        <option key={g} value={g}>Grado: {g}</option>
                      ))}
                    </select>

                    <select
                      value={modalGroupFilter}
                      onChange={(e) => setModalGroupFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none uppercase"
                    >
                      <option value="all">Grupo: Todos</option>
                      {modalAvailableGroups.map(gr => (
                        <option key={gr} value={gr}>Grupo: {gr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      className="text-[10px] font-black uppercase text-blue-900 hover:text-blue-950 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded cursor-pointer"
                    >
                      Seleccionar visibles ({modalFilteredStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllVisible}
                      className="text-[10px] font-black uppercase text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded cursor-pointer"
                    >
                      Deseleccionar
                    </button>
                  </div>

                  <span className="text-[11px] font-black text-blue-950">
                    {selectedStudentIds.length} seleccionados de {eligibleStudents.length}
                  </span>
                </div>
              </div>

              {/* Student Rows */}
              <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
                {modalFilteredStudents.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase">
                    Sin alumnos que coincidan
                  </div>
                ) : (
                  modalFilteredStudents.map(student => {
                    const isSelected = selectedStudentIds.includes(student.id);

                    return (
                      <div
                        key={student.id}
                        onClick={() => toggleStudentSelection(student.id)}
                        className={cn(
                          "py-2 px-3 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer select-none",
                          isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 text-blue-900 rounded border-slate-300 focus:ring-blue-900 cursor-pointer"
                          />

                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase text-slate-900 truncate">
                              {student.lastName} {student.motherLastName} {student.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase">
                              {student.grade || ''} "{student.group || ''}" • Matrícula: {student.id.substring(0, 8)}
                            </p>
                          </div>
                        </div>

                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0",
                          isSelected ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {isSelected ? 'Inscrito' : 'No'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                <span className="text-xs font-bold text-slate-500">
                  Total: <strong>{selectedStudentIds.length}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManagingTae(null)}
                    disabled={isSavingAssignment}
                    className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveStudents}
                    disabled={isSavingAssignment}
                    className="px-4 py-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingAssignment ? (
                      <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check size={13} strokeWidth={3} />
                    )}
                    <span>Guardar ({selectedStudentIds.length})</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
