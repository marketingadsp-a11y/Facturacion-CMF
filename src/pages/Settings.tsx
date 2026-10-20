import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, addDoc, updateDoc, serverTimestamp, query, orderBy, deleteDoc, getDocs, getDoc, writeBatch, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppSettings, SchoolCycle, UserRole, AppPermissions, AppUser, Announcement, BimestreLock, LevelEvaluationConfig, Subject, GradingScale } from '../types';
import { getLevelEvaluationConfig, generateDefaultPeriodNames } from '../lib/evaluationUtils';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Settings as SettingsIcon, 
  Save, 
  Shield, 
  Globe, 
  Image as ImageIcon, 
  Key, 
  CheckCircle2, 
  Calendar, 
  Plus, 
  Clock, 
  DollarSign,
  ShieldAlert,
  Users,
  Lock,
  Unlock,
  Edit2,
  Trash2,
  Check,
  X as XIcon,
  CreditCard,
  BookOpen,
  Bell,
  AlertTriangle,
  AlertCircle,
  FileText,
  GraduationCap,
  MapPin,
  Database,
  Search,
  Phone,
  Mail,
  LayoutList,
  LayoutGrid,
  Eye,
  EyeOff,
  Copy,
  Briefcase,
  Sparkles,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '../lib/utils';
import CoursesCatalog from '../components/settings/CoursesCatalog';
import ChargesCatalog from '../components/settings/ChargesCatalog';
import { loadExampleData } from '../services/exampleDataService';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    schoolName: 'Colegio México Franciscano',
    legalName: 'ASOCIACION EDUCADORA DEL SUR DE JALISCO',
    logoUrl: '',
    facturapiApiKey: '',
    facturapiSandbox: true,
    conektaPublicKey: '',
    conektaPrivateKey: '',
    paymentMethods: ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque'],
    dueDay: 10,
    lateFeeAmount: 0,
    lateFeeType: 'fixed',
    academicLevels: ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato'],
    academicGrades: ['1ro', '2do', '3ro', '4to', '5to', '6to'],
    academicGroups: ['A', 'B', 'C'],
    receptionReasons: ['Información', 'Inscripción', 'Pago', 'Otro'],
    receptionAreas: ['Dirección', 'Administración', 'Control Escolar', 'Finanzas'],
    registrationInstructions: '1. Ingrese a la plataforma oficial de padres de familia.\n2. Seleccione la opción "Registrarse" o "Vincular Alumno".\n3. Ingrese su correo electrónico personal y cree una contraseña segura.\n4. Cuando se le solicite, ingrese el CÓDIGO DE REGISTRO que aparece arriba.\n5. Una vez validado, podrá consultar calificaciones, estados de cuenta y avisos institucionales.',
    pdfFooter: 'GENERADO POR EL SISTEMA DE GESTIÓN ESCOLAR',
    credentialTerms: '',
    imgbbApiKey: '',
    matriculaPrefixes: {}
  });
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'cycles' | 'users' | 'courses' | 'charges' | 'locks' | 'academic' | 'reception' | 'danger' | 'parentPortal' | 'attendanceLists'>('general');
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [gradeLocks, setGradeLocks] = useState<BimestreLock[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState<'Todos' | UserRole>('Todos');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userViewMode, setUserViewMode] = useState<'table' | 'cards'>('table');
  const [selectedUserDetail, setSelectedUserDetail] = useState<AppUser | null>(null);
  const [userLevelFilter, setUserLevelFilter] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showDetailPassword, setShowDetailPassword] = useState(false);
  const [isResetEmailSending, setIsResetEmailSending] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expandedSubjectLevels, setExpandedSubjectLevels] = useState<Record<string, boolean>>({});
  const [customGradeGroupSubjs, setCustomGradeGroupSubjs] = useState<Record<string, boolean>>({});

  const [selectedScheduleLevel, setSelectedScheduleLevel] = useState<string>('');

  const DEFAULT_TIME_PERIODS = useMemo(() => [
    { label: '1er Periodo', time: '07:30 - 08:20', isBreak: false },
    { label: '2do Periodo', time: '08:20 - 09:10', isBreak: false },
    { label: '3er Periodo', time: '09:10 - 10:00', isBreak: false },
    { label: 'Receso', time: '10:00 - 10:30', isBreak: true },
    { label: '4to Periodo', time: '10:30 - 11:20', isBreak: false },
    { label: '5to Periodo', time: '11:20 - 12:10', isBreak: false },
    { label: '6to Periodo', time: '12:10 - 13:00', isBreak: false },
    { label: '7mo Periodo', time: '13:00 - 13:50', isBreak: false },
  ], []);

  useEffect(() => {
    if (settings.academicLevels && settings.academicLevels.length > 0 && !selectedScheduleLevel) {
      setSelectedScheduleLevel(settings.academicLevels[0]);
    }
  }, [settings.academicLevels, selectedScheduleLevel]);

  const currentPeriods = useMemo(() => {
    if (!selectedScheduleLevel) return [];
    return settings.levelPeriods?.[selectedScheduleLevel] || DEFAULT_TIME_PERIODS.map(p => ({ ...p }));
  }, [settings.levelPeriods, selectedScheduleLevel, DEFAULT_TIME_PERIODS]);

  const handleUpdatePeriods = (newPeriods: any[]) => {
    const updatedLevelPeriods = { ...(settings.levelPeriods || {}) };
    updatedLevelPeriods[selectedScheduleLevel] = newPeriods;
    setSettings({ ...settings, levelPeriods: updatedLevelPeriods });
  };

  const handlePeriodChange = (idx: number, field: string, value: any) => {
    const newPeriods = [...currentPeriods];
    newPeriods[idx] = { ...newPeriods[idx], [field]: value };
    handleUpdatePeriods(newPeriods);
  };

  const handleMovePeriod = (idx: number, direction: 'up' | 'down') => {
    const newPeriods = [...currentPeriods];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newPeriods.length) return;
    const temp = newPeriods[idx];
    newPeriods[idx] = newPeriods[targetIdx];
    newPeriods[targetIdx] = temp;
    handleUpdatePeriods(newPeriods);
  };

  const handleDeletePeriod = (idx: number) => {
    const newPeriods = currentPeriods.filter((_, i) => i !== idx);
    handleUpdatePeriods(newPeriods);
  };

  const handleAddPeriod = () => {
    const newPeriods = [...currentPeriods];
    const classCount = newPeriods.filter(p => !p.isBreak).length;
    const newLabel = `${classCount + 1}o Periodo`;
    newPeriods.push({ label: newLabel, time: '08:00 - 08:50', isBreak: false });
    handleUpdatePeriods(newPeriods);
  };

  const { hasPermission, userProfile } = usePermissions();

  const DEFAULT_PERMISSIONS: Record<UserRole, AppPermissions> = {
    Superadministrador: {
      dashboard: { view: true },
      reception: { view: true, manage: true },
      students: { view: true, create: true, edit: true, delete: true, viewHistory: true },
      payments: { view: true, create: true, cancel: true, invoice: true, downloadInvoice: true },
      expenses: { view: true, create: true, edit: true, delete: true },
      settings: { view: true, editGeneral: true, editCycles: true, editRules: true, manageUsers: true },
      announcements: { view: true, manage: true },
      parents: { view: true, manage: true },
      controlEscolar: { view: true, manage: true },
      grading: { view: true, manage: true },
      timeClock: { view: true, manage: true }
    },
    Administrador: {
      dashboard: { view: true },
      reception: { view: true, manage: true },
      students: { view: true, create: true, edit: true, delete: false, viewHistory: true },
      payments: { view: true, create: true, cancel: false, invoice: true, downloadInvoice: true },
      expenses: { view: true, create: true, edit: true, delete: true },
      settings: { view: true, editGeneral: false, editCycles: true, editRules: true, manageUsers: false },
      announcements: { view: true, manage: true },
      parents: { view: true, manage: true },
      controlEscolar: { view: true, manage: true },
      grading: { view: true, manage: true },
      timeClock: { view: true, manage: true }
    },
    Visor: {
      dashboard: { view: true },
      reception: { view: true, manage: false },
      students: { view: true, create: false, edit: false, delete: false, viewHistory: true },
      payments: { view: true, create: false, cancel: false, invoice: false, downloadInvoice: true },
      expenses: { view: true, create: false, edit: false, delete: false },
      settings: { view: true, editGeneral: false, editCycles: false, editRules: false, manageUsers: false },
      announcements: { view: true, manage: false },
      parents: { view: true, manage: false },
      controlEscolar: { view: true, manage: false },
      grading: { view: true, manage: false },
      timeClock: { view: true, manage: false }
    },
    Cajero: {
      dashboard: { view: true },
      reception: { view: true, manage: false },
      students: { view: true, create: false, edit: false, delete: false, viewHistory: false },
      payments: { view: true, create: true, cancel: false, invoice: true, downloadInvoice: true },
      expenses: { view: true, create: true, edit: false, delete: false },
      settings: { view: false, editGeneral: false, editCycles: false, editRules: false, manageUsers: false },
      announcements: { view: true, manage: false },
      parents: { view: true, manage: false },
      controlEscolar: { view: true, manage: false },
      grading: { view: false, manage: false },
      timeClock: { view: false, manage: false }
    },
    Padre: {
      dashboard: { view: true },
      reception: { view: false, manage: false },
      students: { view: true, create: false, edit: false, delete: false, viewHistory: true },
      payments: { view: true, create: false, cancel: false, invoice: false, downloadInvoice: true },
      expenses: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, editGeneral: false, editCycles: false, editRules: false, manageUsers: false },
      announcements: { view: true, manage: false },
      parents: { view: false, manage: false },
      controlEscolar: { view: false, manage: false },
      grading: { view: false, manage: false },
      timeClock: { view: false, manage: false }
    },
    'Control Escolar': {
      dashboard: { view: true },
      reception: { view: true, manage: true },
      students: { view: true, create: false, edit: false, delete: false, viewHistory: false },
      payments: { view: false, create: false, cancel: false, invoice: false, downloadInvoice: false },
      expenses: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, editGeneral: false, editCycles: false, editRules: false, manageUsers: false },
      announcements: { view: true, manage: true },
      parents: { view: true, manage: true },
      controlEscolar: { view: true, manage: true },
      grading: { view: false, manage: false },
      timeClock: { view: false, manage: false }
    },
    Docente: {
      dashboard: { view: true },
      reception: { view: false, manage: false },
      students: { view: true, create: false, edit: false, delete: false, viewHistory: false },
      payments: { view: false, create: false, cancel: false, invoice: false, downloadInvoice: false },
      expenses: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, editGeneral: false, editCycles: false, editRules: false, manageUsers: false },
      announcements: { view: true, manage: false },
      parents: { view: false, manage: false },
      controlEscolar: { view: false, manage: false },
      grading: { view: true, manage: true },
      timeClock: { view: false, manage: false }
    },
    'Recepción': {
      dashboard: { view: true },
      reception: { view: true, manage: true },
      students: { view: true, create: false, edit: false, delete: false, viewHistory: false },
      payments: { view: true, create: false, cancel: false, invoice: false, downloadInvoice: false },
      expenses: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, editGeneral: false, editCycles: false, editRules: false, manageUsers: false },
      announcements: { view: true, manage: false },
      parents: { view: true, manage: false },
      controlEscolar: { view: false, manage: false },
      grading: { view: false, manage: false },
      timeClock: { view: true, manage: true }
    }
  };

  const [annFormData, setAnnFormData] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    type: 'info',
    active: true
  });

  const [userFormData, setUserFormData] = useState<Partial<AppUser> & { password?: string }>({
    email: '',
    name: '',
    phone: '',
    employeeNumber: '',
    password: '',
    role: 'Cajero',
    permissions: DEFAULT_PERMISSIONS['Cajero'],
    teacherSubjectAccess: 'all',
    assignedSubjects: [],
    teacherGradeGroups: {}
  });

  // New Cycle Form
  const [newCycle, setNewCycle] = useState({
    name: '',
    tuitionAmount: 0,
    billableMonths: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5] // Default Aug-Dec, Feb-Jun
  });

  // Edit Cycle Form
  const [editingCycle, setEditingCycle] = useState<SchoolCycle | null>(null);
  const [isEditCycleModalOpen, setIsEditCycleModalOpen] = useState(false);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSettings(prev => ({ ...prev, ...snap.data() }));
      }
      setLoading(false);
    });

    const unsubCycles = onSnapshot(query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), (snap) => {
      setCycles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SchoolCycle)));
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc')), (snap) => {
      setAppUsers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppUser)));
    });

    const unsubLocks = onSnapshot(query(collection(db, 'bimestreLocks'), orderBy('lockedAt', 'desc')), (snap) => {
      setGradeLocks(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as BimestreLock)));
    });

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Subject)));
    });

    return () => { unsubSettings(); unsubCycles(); unsubUsers(); unsubLocks(); unsubSubjects(); };
  }, []);

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleAddCycle = async () => {
    if (!newCycle.name.trim() || Number(newCycle.tuitionAmount) < 0) return;
    try {
      await addDoc(collection(db, 'cycles'), {
        name: newCycle.name.trim(),
        tuitionAmount: Number(newCycle.tuitionAmount) || 0,
        billableMonths: newCycle.billableMonths,
        createdAt: serverTimestamp()
      });
      setNewCycle({ name: '', tuitionAmount: 0, billableMonths: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error adding cycle:", error);
    }
  };

  const handleOpenEditCycle = (cycle: SchoolCycle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCycle({ ...cycle });
    setIsEditCycleModalOpen(true);
  };

  const handleUpdateCycle = async () => {
    if (!editingCycle || !editingCycle.name.trim() || Number(editingCycle.tuitionAmount) < 0) return;
    try {
      await updateDoc(doc(db, 'cycles', editingCycle.id), {
        name: editingCycle.name.trim(),
        tuitionAmount: Number(editingCycle.tuitionAmount) || 0,
        billableMonths: editingCycle.billableMonths || []
      });
      setIsEditCycleModalOpen(false);
      setEditingCycle(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error updating cycle:", error);
    }
  };

  const toggleEditCycleMonth = (monthIndex: number) => {
    if (!editingCycle) return;
    const current = editingCycle.billableMonths || [];
    setEditingCycle({
      ...editingCycle,
      billableMonths: current.includes(monthIndex)
        ? current.filter(m => m !== monthIndex)
        : [...current, monthIndex].sort((a, b) => a - b)
    });
  };

  const toggleMonth = (monthIndex: number) => {
    setNewCycle(prev => ({
      ...prev,
      billableMonths: prev.billableMonths.includes(monthIndex)
        ? prev.billableMonths.filter(m => m !== monthIndex)
        : [...prev.billableMonths, monthIndex].sort((a, b) => a - b)
    }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight uppercase">Configuración</h1>
          <p className="text-slate-500 font-medium text-sm">Administra el núcleo operativo y la identidad de tu institución.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-100"
            >
              <CheckCircle2 size={16} />
              Cambios guardados
            </motion.div>
          )}
          {(activeTab === 'general' ? hasPermission('settings', 'editGeneral') : 
            activeTab === 'cycles' ? hasPermission('settings', 'editCycles') : 
            activeTab === 'billing' ? hasPermission('settings', 'editRules') : 
            ['academic', 'reception', 'attendanceLists'].includes(activeTab)) && (
            <button
              onClick={handleSave}
              className="bg-slate-950 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={18} />
              Guardar Cambios
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Nav */}
        <div className="lg:col-span-3 space-y-1">
          <div className="px-4 py-2 mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sistema</p>
          </div>
          <button 
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'general' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Globe size={18} className={activeTab === 'general' ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-500'} />
            <span className="text-sm font-bold">Identidad Global</span>
          </button>
          <button 
            onClick={() => setActiveTab('academic')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'academic' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <GraduationCap size={18} className={activeTab === 'academic' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-500'} />
            <span className="text-sm font-bold">Académico</span>
          </button>
          <button 
            onClick={() => setActiveTab('cycles')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'cycles' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
          >
            <Calendar size={18} className={activeTab === 'cycles' ? 'text-orange-400' : 'text-slate-400 group-hover:text-orange-500'} />
            <span className="text-sm font-bold">Ciclos y Costos</span>
          </button>
          
          <div className="px-4 py-2 mt-6 mb-2 border-t border-slate-100 pt-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operación</p>
          </div>
          <button 
            onClick={() => setActiveTab('reception')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'reception' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Users size={18} className={activeTab === 'reception' ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-500'} />
            <span className="text-sm font-bold">Recepción</span>
          </button>
          <button 
            onClick={() => setActiveTab('courses')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'courses' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <BookOpen size={18} className={activeTab === 'courses' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-500'} />
            <span className="text-sm font-bold">Cursos</span>
          </button>
          <button 
            onClick={() => setActiveTab('charges')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'charges' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <CreditCard size={18} className={activeTab === 'charges' ? 'text-purple-400' : 'text-slate-400 group-hover:text-purple-500'} />
            <span className="text-sm font-bold">Cobros Extra</span>
          </button>
          <button 
            onClick={() => setActiveTab('attendanceLists')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'attendanceLists' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <FileText size={18} className={activeTab === 'attendanceLists' ? 'text-sky-400' : 'text-slate-400 group-hover:text-sky-500'} />
            <span className="text-sm font-bold">Listas de Asistencia</span>
          </button>

          <div className="px-4 py-2 mt-6 mb-2 border-t border-slate-100 pt-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Seguridad</p>
          </div>
          <button 
            onClick={() => setActiveTab('billing')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'billing' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Key size={18} className={activeTab === 'billing' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-500'} />
            <span className="text-sm font-bold">Pasarelas/APIs</span>
          </button>
          {hasPermission('settings', 'manageUsers') && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Shield size={18} className={activeTab === 'users' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-500'} />
              <span className="text-sm font-bold">Colaboradores</span>
            </button>
          )}
          {hasPermission('settings', 'manageUsers') && (
            <button 
              onClick={() => setActiveTab('locks')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'locks' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Lock size={18} className={activeTab === 'locks' ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-500'} />
              <span className="text-sm font-bold">Bloqueos</span>
            </button>
          )}
          {hasPermission('settings', 'editGeneral') && (
            <button 
              onClick={() => setActiveTab('parentPortal')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'parentPortal' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Users size={18} className={activeTab === 'parentPortal' ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-500'} />
              <span className="text-sm font-bold">Portal de Padres</span>
            </button>
          )}
          {userProfile?.role === 'Superadministrador' && (
            <button 
              onClick={() => setActiveTab('danger')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${activeTab === 'danger' ? 'bg-red-600 text-white shadow-lg' : 'text-red-500 hover:bg-red-50'}`}
            >
              <AlertTriangle size={18} />
              <span className="text-sm font-bold">Zona Crítica</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9">
          {activeTab === 'parentPortal' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 text-left">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                      <Users size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Portal de Padres por Niveles</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Activar/desactivar funciones según el nivel académico</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  {(settings?.academicLevels || ["Preescolar", "Primaria", "Secundaria", "Preparatoria"]).map((level) => {
                    const enabledFeatures = settings?.parentPortalFeatures?.[level] || ["grades", "horarios", "avisos", "facturas", "billing"];
                    
                    const handleToggleFeature = async (featureKey: string) => {
                      if (!settings) return;
                      const currentFeatures = settings.parentPortalFeatures || {};
                      const levelFeatures = currentFeatures[level] || ["grades", "horarios", "avisos", "facturas", "billing"];
                      
                      let newLevelFeatures: string[];
                      if (levelFeatures.includes(featureKey)) {
                        newLevelFeatures = levelFeatures.filter(f => f !== featureKey);
                      } else {
                        newLevelFeatures = [...levelFeatures, featureKey];
                      }
                      
                      const newFeatures = {
                        ...currentFeatures,
                        [level]: newLevelFeatures
                      };
                      
                      try {
                        await setDoc(doc(db, 'settings', 'general'), {
                          ...settings,
                          parentPortalFeatures: newFeatures
                        });
                        setSettings(prev => prev ? { ...prev, parentPortalFeatures: newFeatures } : null);
                        setSaved(true);
                        setTimeout(() => setSaved(false), 3000);
                      } catch (error) {
                        console.error("Error saving parent portal features:", error);
                        alert("Hubo un error al guardar los ajustes.");
                      }
                    };

                    return (
                      <div key={level} className="border border-slate-100 rounded-2xl p-6 bg-slate-50/30 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h3 className="font-bold text-sm text-slate-900 uppercase tracking-tight italic">{level}</h3>
                          <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded uppercase">
                            {enabledFeatures.length} Activas
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            { key: 'grades', label: 'Calificaciones (Boletas)' },
                            { key: 'horarios', label: 'Horarios Escolares' },
                            { key: 'avisos', label: 'Avisos y Circulares' },
                            { key: 'facturas', label: 'Facturas de Pagos' },
                            { key: 'billing', label: 'Datos de Facturación (RFC)' }
                          ].map(feature => {
                            const isChecked = enabledFeatures.includes(feature.key);
                            return (
                              <label key={feature.key} className="flex items-center gap-3 py-2 px-3 hover:bg-white rounded-xl cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleFeature(feature.key)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                />
                                <span className="text-xs font-bold text-slate-700">{feature.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Card: Colegio */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Identidad Institucional</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Información pública y legal</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nombre Comercial</label>
                      <input
                         value={settings.schoolName}
                         onChange={(e) => setSettings({...settings, schoolName: e.target.value})}
                         className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Razón Social</label>
                      <input
                        value={settings.legalName}
                        onChange={(e) => setSettings({...settings, legalName: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Dirección del Plantel (para encabezados de listas)</label>
                      <input
                        placeholder="Ej. Av. Hidalgo #123, Col. Centro, C.P. 49000"
                        value={settings.schoolAddress || ''}
                        onChange={(e) => setSettings({...settings, schoolAddress: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Logotipo Institucional</label>
                      <div className="flex gap-4 items-center">
                        <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm group relative">
                          {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                          ) : (
                            <ImageIcon className="text-slate-300" size={32} />
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            placeholder="URL del logo (png, jpg)"
                            value={settings.logoUrl}
                            onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-xs transition-all focus:bg-white"
                          />
                          <p className="text-[9px] text-slate-400 mt-2 font-medium">Se recomienda fondo transparente.</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Teléfono Institucional</label>
                      <input
                        placeholder="Ej. (341) 412 0000"
                        value={settings.schoolPhone || ''}
                        onChange={(e) => setSettings({...settings, schoolPhone: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Sitio Web / Correo Institucional</label>
                      <input
                        placeholder="Ej. www.cmfranciscano.mx"
                        value={settings.schoolWebsite || ''}
                        onChange={(e) => setSettings({...settings, schoolWebsite: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card: Personalization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Acceso y Login</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Personalizar bienvenida</p>
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Título de Bienvenida</label>
                      <input
                        value={settings.loginTitle || ''}
                        onChange={(e) => setSettings({...settings, loginTitle: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Subtítulo</label>
                      <input
                        value={settings.loginSubtitle || ''}
                        onChange={(e) => setSettings({...settings, loginSubtitle: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-200">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Checador y Kiosk</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fondos de pantalla</p>
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Fondo del Checador (URL)</label>
                      <input
                        value={settings.kioskBackgroundUrl || ''}
                        onChange={(e) => setSettings({...settings, kioskBackgroundUrl: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs transition-all focus:bg-white"
                      />
                    </div>
                    <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                      <p className="text-[10px] text-orange-700 font-bold leading-relaxed italic">
                        * Dejar vacío para usar el tema oscuro predeterminado con el logo del colegio.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card: Registration Instructions */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Registro de Padres</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Formatos y documentos</p>
                  </div>
                </div>
                
                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Instrucciones de Registro</label>
                      <textarea
                        rows={6}
                        value={settings.registrationInstructions || ''}
                        onChange={(e) => setSettings({...settings, registrationInstructions: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold leading-relaxed transition-all focus:bg-white resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Previsualización en PDF</label>
                      <div className="p-6 bg-slate-950 rounded-xl text-white shadow-lg relative overflow-hidden h-full min-h-[160px]">
                        <div className="absolute top-0 right-0 p-3">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        </div>
                        <p className="text-[10px] font-black uppercase mb-4 text-emerald-400 tracking-widest">Ejemplo de PDF</p>
                        <div className="space-y-1.5 opacity-60">
                           {settings.registrationInstructions?.split('\n').filter(Boolean).slice(0, 3).map((line, i) => (
                             <p key={i} className="text-[10px] font-medium leading-tight truncate">{line}</p>
                           )) || <p className="text-[10px] italic">No hay instrucciones registradas</p>}
                           <p className="text-[10px] mt-4 border-t border-white/10 pt-4 font-black uppercase text-center opacity-40">
                             {settings.pdfFooter || 'Pie de página'}
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-50">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Pie de Página en PDF (Footer)</label>
                    <input
                      value={settings.pdfFooter || ''}
                      onChange={(e) => setSettings({...settings, pdfFooter: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                    />
                  </div>

                  <div className="pt-6 border-t border-slate-50">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Términos / Información Importante en Credencial de Estudiantes</label>
                    <textarea
                      value={settings.credentialTerms || ''}
                      onChange={(e) => setSettings({...settings, credentialTerms: e.target.value})}
                      placeholder="Ej: Esta credencial es de uso estrictamente personal e intransferible..."
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all focus:bg-white resize-none text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Card: Email Template */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                      <Bell size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Correo de Bienvenida</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Portal de padres</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-tighter">
                    <Check size={12} strokeWidth={3} /> Envío Automático Activo
                  </div>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                      Este correo se enviará al correo de acceso de los padres cuando se genere su código. 
                      Variables disponibles: <span className="bg-white px-1.5 py-0.5 rounded border border-blue-200">{`{alumno}`}</span>, <span className="bg-white px-1.5 py-0.5 rounded border border-blue-200">{`{codigo}`}</span>, <span className="bg-white px-1.5 py-0.5 rounded border border-blue-200">{`{colegio}`}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Asunto</label>
                        <input
                          value={settings.welcomeEmailSubject || ''}
                          onChange={(e) => setSettings({...settings, welcomeEmailSubject: e.target.value})}
                          placeholder="Bienvenido al Portal - {colegio}"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Cuerpo (HTML / Texto)</label>
                        <textarea
                          rows={8}
                          value={settings.welcomeEmailBody || ''}
                          onChange={(e) => setSettings({...settings, welcomeEmailBody: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium leading-relaxed transition-all focus:bg-white resize-none font-mono"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Previsualización en tiempo real</label>
                       <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 h-full min-h-[340px] flex flex-col">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                               {settings.logoUrl && <img src={settings.logoUrl} className="w-full h-full object-contain" />}
                            </div>
                            <div>
                               <p className="text-[11px] font-black text-slate-900">{settings.schoolName}</p>
                               <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Soporte Escolar</p>
                            </div>
                          </div>
                          <div className="flex-1">
                             <h4 className="text-base font-black text-slate-900 mb-4">
                                {settings.welcomeEmailSubject?.replace('{colegio}', settings.schoolName) || 'Asunto del correo'}
                             </h4>
                             <div className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap italic">
                                {settings.welcomeEmailBody?.replace('{alumno}', 'JUAN PEREZ').replace('{codigo}', 'CODE-XXXX').replace('{colegio}', settings.schoolName) || 'Escribe el contenido para ver como se verá...'}
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card: 404 & Credits */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Página de Error y Atribución</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Configuración visual</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">URL de Fondo 404</label>
                      <input
                        value={settings.notFoundBackgroundUrl || ''}
                        onChange={(e) => setSettings({...settings, notFoundBackgroundUrl: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-medium text-xs transition-all focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Firma del Desarrollador (Footer)</label>
                      <input
                        value={settings.developerAttribution || ''}
                        onChange={(e) => setSettings({...settings, developerAttribution: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                     <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Texto del Error 404</label>
                     <textarea
                        rows={1}
                        value={settings.notFoundText || ''}
                        onChange={(e) => setSettings({...settings, notFoundText: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-800 transition-all focus:bg-white resize-none"
                     />
                     <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-red-700 font-bold leading-tight">Esta configuración afecta la experiencia de usuario cuando intentan acceder a una página restringida o inexistente.</p>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendanceLists' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Header Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-600 flex items-center justify-center text-white shadow-lg shadow-sky-200">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Listas de Asistencia Oficiales</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Personalización de encabezados, columnas y formato para PDF y Excel</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Column settings */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                      <LayoutList size={14} className="text-sky-600" /> Columnas del Alumno
                    </h3>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Número de Lista (No.)</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Muestra la columna consecutiva numerada (1, 2, 3...)</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.attendanceListShowNo !== false}
                        onChange={(e) => setSettings({ ...settings, attendanceListShowNo: e.target.checked })}
                        className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Matrícula Escolar</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Muestra la clave o matrícula oficial de cada alumno</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.attendanceListShowMatricula !== false}
                        onChange={(e) => setSettings({ ...settings, attendanceListShowMatricula: e.target.checked })}
                        className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                      />
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                      <label className="block text-xs font-black text-slate-800 uppercase tracking-tight mb-1">
                        Casillas de Asistencia por Hoja
                      </label>
                      <p className="text-[10px] text-slate-500 font-medium mb-3">
                        Número de columnas cuadriculadas en blanco numeradas (1 al N) para el pase de lista o fechas del mes
                      </p>
                      <select
                        value={settings.attendanceListColumns ?? 31}
                        onChange={(e) => setSettings({ ...settings, attendanceListColumns: parseInt(e.target.value) || 31 })}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-bold text-xs uppercase cursor-pointer"
                      >
                        <option value={20}>20 Casillas (Días hábiles promedio del mes)</option>
                        <option value={25}>25 Casillas</option>
                        <option value={30}>30 Casillas</option>
                        <option value={31}>31 Casillas (Mes completo - Recomendado)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Pie de Página Oficial (PDF)</label>
                      <input
                        value={settings.pdfFooter || ''}
                        onChange={(e) => setSettings({ ...settings, pdfFooter: e.target.value })}
                        placeholder="Ej. DOCUMENTO OFICIAL GENERADO POR CONTROL ESCOLAR"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-bold text-xs text-slate-800 transition-all focus:bg-white uppercase"
                      />
                    </div>
                  </div>

                  {/* Institution info on list headers */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                      <Globe size={14} className="text-sky-600" /> Membrete Institucional (PDF / Excel)
                    </h3>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nombre Comercial del Colegio</label>
                      <input
                        value={settings.schoolName}
                        onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-bold text-xs text-slate-800 transition-all focus:bg-white uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Razón Social</label>
                      <input
                        value={settings.legalName}
                        onChange={(e) => setSettings({ ...settings, legalName: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-bold text-xs text-slate-800 transition-all focus:bg-white uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Dirección del Plantel</label>
                      <input
                        placeholder="Ej. Av. Hidalgo #123, Col. Centro, C.P. 49000"
                        value={settings.schoolAddress || ''}
                        onChange={(e) => setSettings({ ...settings, schoolAddress: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-bold text-xs text-slate-800 transition-all focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Teléfono</label>
                        <input
                          placeholder="Ej. (341) 412 0000"
                          value={settings.schoolPhone || ''}
                          onChange={(e) => setSettings({ ...settings, schoolPhone: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-bold text-xs text-slate-800 transition-all focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Web / Correo</label>
                        <input
                          placeholder="Ej. www.colegio.edu.mx"
                          value={settings.schoolWebsite || ''}
                          onChange={(e) => setSettings({ ...settings, schoolWebsite: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-bold text-xs text-slate-800 transition-all focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual preview of attendance list format */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-slate-500" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Vista Previa de Estructura Institucional</h3>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 bg-sky-100 text-sky-800 rounded-full">
                    Formato PDF Landscape & Excel
                  </span>
                </div>

                <div className="p-8 bg-slate-100/60">
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden p-6 max-w-4xl mx-auto">
                    {/* Header Strip */}
                    <div className="bg-slate-950 -m-6 mb-4 p-5 text-white flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded bg-white p-1 flex items-center justify-center shrink-0">
                          {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon className="text-slate-400" size={24} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-wide">{settings.schoolName || 'COLEGIO MÉXICO FRANCISCANO'}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{settings.legalName || 'ASOCIACION EDUCADORA DEL SUR DE JALISCO'}</p>
                        </div>
                      </div>
                      <div className="text-right text-[9px] text-slate-300 font-medium space-y-0.5">
                        {settings.schoolAddress && <p>{settings.schoolAddress}</p>}
                        {settings.schoolPhone && <p>Tel. {settings.schoolPhone}</p>}
                        {settings.schoolWebsite && <p>{settings.schoolWebsite}</p>}
                      </div>
                    </div>

                    {/* Title bar */}
                    <div className="bg-blue-900 -mx-6 px-6 py-2 text-white flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-4">
                      <span>Lista de Asistencia Oficial</span>
                      <span className="text-blue-200">PRIMARIA • 1RO A • CICLO 2026-2027</span>
                    </div>

                    {/* Meta cards */}
                    <div className="grid grid-cols-5 gap-2 mb-4 text-[9px]">
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Nivel</span>
                        <span className="font-bold text-slate-800">Primaria</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Grado y Grupo</span>
                        <span className="font-bold text-slate-800">1ro — A</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Ciclo</span>
                        <span className="font-bold text-slate-800">2026-2027</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Docente</span>
                        <span className="font-bold text-slate-800">Prof. Juan Pérez</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Total</span>
                        <span className="font-bold text-blue-600">28 Alumnos</span>
                      </div>
                    </div>

                    {/* Mini table preview */}
                    <div className="border border-slate-200 rounded overflow-hidden text-[9px] mb-4">
                      <div className="bg-slate-900 text-white flex font-bold uppercase text-[8px] py-1.5 px-2">
                        {settings.attendanceListShowNo !== false && <span className="w-8 text-center">No.</span>}
                        {settings.attendanceListShowMatricula !== false && <span className="w-20 text-center">Matrícula</span>}
                        <span className="flex-1 px-2">Nombre Completo del Alumno</span>
                        <span className="w-48 text-center tracking-widest text-slate-400">Casillas 1 ... {settings.attendanceListColumns ?? 31}</span>
                      </div>
                      <div className="bg-white py-1.5 px-2 flex border-b border-slate-100 font-medium">
                        {settings.attendanceListShowNo !== false && <span className="w-8 text-center text-blue-700 font-bold">1</span>}
                        {settings.attendanceListShowMatricula !== false && <span className="w-20 text-center text-slate-400">PRI-2026-001</span>}
                        <span className="flex-1 px-2 font-bold uppercase text-slate-800">GARCÍA HERNÁNDEZ, MATÍAS</span>
                        <span className="w-48 flex justify-between px-2 text-slate-300">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <span key={i} className="inline-block w-3.5 h-3.5 border border-slate-200 rounded-xs text-[7px] text-center">{i + 1}</span>
                          ))}
                        </span>
                      </div>
                      <div className="bg-slate-50 py-1.5 px-2 flex font-medium">
                        {settings.attendanceListShowNo !== false && <span className="w-8 text-center text-blue-700 font-bold">2</span>}
                        {settings.attendanceListShowMatricula !== false && <span className="w-20 text-center text-slate-400">PRI-2026-002</span>}
                        <span className="flex-1 px-2 font-bold uppercase text-slate-800">LÓPEZ MORALES, SOFÍA</span>
                        <span className="w-48 flex justify-between px-2 text-slate-300">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <span key={i} className="inline-block w-3.5 h-3.5 border border-slate-200 rounded-xs text-[7px] text-center">{i + 1}</span>
                          ))}
                        </span>
                      </div>
                    </div>

                    {/* Signature block */}
                    <div className="grid grid-cols-3 gap-6 pt-6 text-center text-[7.5px] font-black text-slate-700 uppercase tracking-wider">
                      <div className="border-t border-slate-800 pt-1.5">FIRMA DEL DOCENTE RESPONSABLE</div>
                      <div className="border-t border-slate-800 pt-1.5">DIRECTOR/A DE NIVEL</div>
                      <div className="border-t border-slate-800 pt-1.5">SELLO INSTITUCIONAL</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cycles' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Rules */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-200">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Reglas de Pago</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Vencimientos y recargos</p>
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Día Máximo de Pago</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={isNaN(settings.dueDay) ? '' : settings.dueDay}
                        onChange={(e) => setSettings({...settings, dueDay: parseInt(e.target.value) || 0})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                      />
                      <p className="text-[9px] text-slate-400 mt-2 font-medium italic">* Día del mes después del cual se aplican recargos.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Monto de Recargo</label>
                        <input
                          type="number"
                          value={isNaN(settings.lateFeeAmount) ? '' : settings.lateFeeAmount}
                          onChange={(e) => setSettings({...settings, lateFeeAmount: parseFloat(e.target.value) || 0})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Tipo</label>
                        <select
                          value={settings.lateFeeType}
                          onChange={(e) => setSettings({...settings, lateFeeType: e.target.value as 'fixed' | 'percentage'})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat"
                        >
                          <option value="fixed">$ Fijo</option>
                          <option value="percentage">% Porcentaje</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add New Cycle */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Plus size={20} strokeWidth={3} />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Nuevo Ciclo</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Registrar apertura</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nombre</label>
                        <input
                          placeholder="2025-2026"
                          value={newCycle.name}
                          onChange={(e) => setNewCycle({...newCycle, name: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Monto Colegiatura</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={isNaN(newCycle.tuitionAmount) ? '' : newCycle.tuitionAmount}
                          onChange={(e) => setNewCycle({...newCycle, tuitionAmount: Math.max(0, parseFloat(e.target.value) || 0)})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                        />
                        {Number(newCycle.tuitionAmount) === 0 && (
                          <p className="text-[9px] text-amber-600 font-bold mt-1">
                            * En $0.00 no se generarán cobros ni deudas de colegiatura.
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Meses Cobrables</label>
                      <div className="flex flex-wrap gap-2">
                        {MONTHS.map((month, index) => (
                          <button
                            key={month}
                            onClick={() => toggleMonth(index)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${newCycle.billableMonths.includes(index) ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                          >
                            {month.substring(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleAddCycle}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-100"
                    >
                      <Save size={18} /> Registrar Ciclo Académico
                    </button>
                  </div>
                </div>
              </div>

              {/* Cycle Management List */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Ciclos Registrados</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Historial y selección</p>
                  </div>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cycles.map(cycle => (
                      <div 
                        key={cycle.id} 
                        onClick={() => setSettings({...settings, currentCycleId: cycle.id})}
                        className={`group p-6 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden ${settings.currentCycleId === cycle.id ? 'bg-slate-900 border-slate-900 shadow-xl scale-[1.02]' : 'bg-white border-slate-50 hover:border-slate-200 shadow-sm'}`}
                      >
                        {settings.currentCycleId === cycle.id && (
                           <div className="absolute top-0 right-0 p-4">
                              <CheckCircle2 size={24} className="text-emerald-400" />
                           </div>
                        )}
                        <div className="space-y-4">
                          <div className="flex items-start justify-between pr-8">
                            <div>
                              <p className={`text-xl font-black ${settings.currentCycleId === cycle.id ? 'text-white' : 'text-slate-900'}`}>{cycle.name}</p>
                              <p className={`text-[10px] font-bold uppercase tracking-widest ${settings.currentCycleId === cycle.id ? 'text-slate-400' : 'text-slate-500'}`}>
                                {settings.currentCycleId === cycle.id ? 'Ciclo Activo Actual' : 'Ciclo Escolar'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditCycle(cycle, e)}
                              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${
                                settings.currentCycleId === cycle.id
                                  ? 'bg-white/20 hover:bg-white text-white hover:text-slate-900'
                                  : 'bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white'
                              }`}
                              title="Modificar ciclo escolar"
                            >
                              <Edit2 size={12} />
                              <span>Editar</span>
                            </button>
                          </div>
                          
                          <div className={`p-4 rounded-xl ${settings.currentCycleId === cycle.id ? 'bg-white/10' : 'bg-slate-50'}`}>
                             <div className="flex items-baseline gap-2">
                               <p className={`text-lg font-black ${
                                 Number(cycle.tuitionAmount) === 0
                                   ? (settings.currentCycleId === cycle.id ? 'text-amber-300' : 'text-amber-600')
                                   : (settings.currentCycleId === cycle.id ? 'text-emerald-400' : 'text-slate-900')
                               }`}>
                                 {formatCurrency(cycle.tuitionAmount || 0)}
                               </p>
                               {Number(cycle.tuitionAmount) === 0 && (
                                 <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                   settings.currentCycleId === cycle.id ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-100 text-amber-700'
                                 }`}>
                                   Sin cobro
                                 </span>
                               )}
                             </div>
                             <p className={`text-[9px] font-bold uppercase ${settings.currentCycleId === cycle.id ? 'text-slate-400' : 'text-slate-500'}`}>
                               {Number(cycle.tuitionAmount) === 0 ? 'Sin cobro de colegiaturas' : 'Mensualidad Base'}
                             </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                             {cycle.billableMonths.slice(0, 4).map(m => (
                               <span key={m} className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${settings.currentCycleId === cycle.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                 {MONTHS[m].substring(0, 3)}
                               </span>
                             ))}
                             {cycle.billableMonths.length > 4 && (
                               <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${settings.currentCycleId === cycle.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                 +{cycle.billableMonths.length - 4}
                               </span>
                             )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Edit Cycle Modal */}
              {isEditCycleModalOpen && editingCycle && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Editar Ciclo Escolar</h2>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{editingCycle.name || 'Ciclo'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setIsEditCycleModalOpen(false); setEditingCycle(null); }}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                      >
                        <XIcon size={18} />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nombre del Ciclo</label>
                          <input
                            type="text"
                            placeholder="2026-2027"
                            value={editingCycle.name}
                            onChange={(e) => setEditingCycle({ ...editingCycle, name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 focus:bg-white transition-all text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Monto Colegiatura ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={isNaN(editingCycle.tuitionAmount) ? '' : editingCycle.tuitionAmount}
                            onChange={(e) => setEditingCycle({ ...editingCycle, tuitionAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 focus:bg-white transition-all text-sm"
                          />
                        </div>
                      </div>

                      {/* Info box when tuition is 0 */}
                      {Number(editingCycle.tuitionAmount) === 0 ? (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5">
                          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                          <div className="text-xs">
                            <p className="font-bold text-amber-900">Monto de colegiatura configurado en $0.00</p>
                            <p className="text-amber-700 mt-0.5">Para este ciclo no se generarán cobros ni deudas automáticas de colegiaturas a los alumnos.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-2.5">
                          <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                          <div className="text-xs">
                            <p className="font-bold text-emerald-900">Colegiatura activa: {formatCurrency(editingCycle.tuitionAmount)}</p>
                            <p className="text-emerald-700 mt-0.5">Se generará cobro mensual a los alumnos vinculados durante los meses cobrables seleccionados.</p>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Meses Cobrables</label>
                        <div className="flex flex-wrap gap-2">
                          {MONTHS.map((month, index) => {
                            const isSelected = (editingCycle.billableMonths || []).includes(index);
                            return (
                              <button
                                key={month}
                                type="button"
                                onClick={() => toggleEditCycleMonth(index)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border",
                                  isSelected
                                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                                )}
                              >
                                {month.substring(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {settings.currentCycleId === editingCycle.id && (
                        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                          <p className="text-xs font-bold text-blue-900">Este ciclo es actualmente el ciclo escolar activo del sistema.</p>
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => { setIsEditCycleModalOpen(false); setEditingCycle(null); }}
                        className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleUpdateCycle}
                        disabled={!editingCycle.name.trim()}
                        className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
                      >
                        <Save size={15} /> Guardar Cambios
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Pasarelas de Pago</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Facturación y cobro digital</p>
                  </div>
                </div>
                
                <div className="p-8 space-y-12">
                   {/* Facturapi */}
                   <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <img src="https://www.facturapi.io/img/logo.svg" alt="Facturapi" className="h-6 opacity-80" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest ml-2">Integration</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">API Key (Producción/Test)</label>
                          <input
                            type="password"
                            value={settings.facturapiApiKey || ''}
                            onChange={(e) => setSettings({...settings, facturapiApiKey: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="flex items-center gap-2">
                             <input
                               type="checkbox"
                               checked={settings.facturapiSandbox}
                               onChange={(e) => setSettings({...settings, facturapiSandbox: e.target.checked})}
                               className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Modo Sandbox</span>
                           </div>
                        </div>
                      </div>
                   </div>

                   {/* Conekta */}
                   <div className="pt-12 border-t border-slate-100 space-y-6">
                      <div className="flex items-center gap-3">
                        <img src="https://cdn.conekta.io/branding/logo-conekta.svg" alt="Conekta" className="h-4 opacity-80" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest ml-2">Digital Payments</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Private API Key</label>
                          <input
                            type="password"
                            value={settings.conektaPrivateKey || ''}
                            onChange={(e) => setSettings({...settings, conektaPrivateKey: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Public API Key</label>
                          <input
                            type="text"
                            value={settings.conektaPublicKey || ''}
                            onChange={(e) => setSettings({...settings, conektaPublicKey: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
                          />
                        </div>
                      </div>
                   </div>

                   {/* Resend */}
                   <div className="pt-12 border-t border-slate-100 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-white">
                          <Bell size={16} />
                        </div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest ml-2">Resend Email Gateway</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">API Key</label>
                          <input
                            type="password"
                            value={settings.resendApiKey || ''}
                            onChange={(e) => setSettings({...settings, resendApiKey: e.target.value})}
                            placeholder="re_..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Remitente Autorizado (From)</label>
                          <input
                            type="text"
                            value={settings.mailFrom || ''}
                            onChange={(e) => setSettings({...settings, mailFrom: e.target.value})}
                            placeholder="Escuela <aviso@tudominio.com>"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                          />
                          <p className="text-[9px] text-slate-400 mt-2 font-medium">Debe ser un dominio verificado en Resend para que los correos lleguen a los destinatarios.</p>
                        </div>
                      </div>
                   </div>

                   {/* ImgBB */}
                   <div className="pt-12 border-t border-slate-100 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                          <ImageIcon size={16} />
                        </div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest ml-2">ImgBB Image Hosting Gateway</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">ImgBB API Key</label>
                          <input
                            type="password"
                            value={settings.imgbbApiKey || ''}
                            onChange={(e) => setSettings({...settings, imgbbApiKey: e.target.value})}
                            placeholder="Ingresa tu API Key de imgbb..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
                          />
                          <p className="text-[9px] text-slate-400 mt-2 font-medium">Se utilizará para subir fotografías de alumnos y otros recursos multimedia.</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-200">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Catálogo de Cursos</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gestión de oferta educativa</p>
                    </div>
                  </div>
                  <div className="p-8">
                     <CoursesCatalog />
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'locks' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Bloqueos de Grado</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Control de captura de notas</p>
                    </div>
                  </div>
                  <div className="p-8 space-y-4">
                    {gradeLocks.length === 0 && (
                      <div className="py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Lock size={40} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay bimestres bloqueados</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {gradeLocks.map(lock => (
                        <div key={lock.id} className="p-6 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-amber-600 shadow-sm border border-slate-100">
                                <span className="text-lg font-black">{lock.bimestre}</span>
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{lock.level} - {lock.grade} {lock.group}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic opacity-60">Bimestre académico</p>
                             </div>
                          </div>
                          <button 
                            onClick={async () => {
                              if (window.confirm('¿Desbloquear este grado? Los docentes podrán editar notas nuevamente.')) {
                                try {
                                  await deleteDoc(doc(db, 'bimestreLocks', lock.id));
                                } catch (error) {
                                  console.error("Error deleting lock:", error);
                                }
                              }
                            }}
                            className="p-3 bg-amber-100 text-amber-700 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm"
                            title="Desbloquear"
                          >
                            <Unlock size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Estructura Académica Global</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Niveles, grados y grupos</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
                  <AcademicListManager 
                    title="Niveles Educativos" 
                    description="Clasificación general"
                    items={settings.academicLevels || []} 
                    onUpdate={(newItems) => setSettings({...settings, academicLevels: newItems})}
                  />
                  <AcademicListManager 
                    title="Grados" 
                    description="Etapas por nivel"
                    items={settings.academicGrades || []} 
                    onUpdate={(newItems) => setSettings({...settings, academicGrades: newItems})}
                  />
                  <AcademicListManager 
                    title="Grupos" 
                    description="Secciones de clase"
                    items={settings.academicGroups || []} 
                    onUpdate={(newItems) => setSettings({...settings, academicGroups: newItems})}
                  />
                </div>
              </div>

              {/* Card: Periodos de Calificación por Nivel Educativo */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Periodos de Calificación por Nivel</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Trimestres, Bimestres y entregas de notas docentes</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newConfig = { ...(settings.levelEvaluationConfig || {}) };
                      (settings.academicLevels || []).forEach(lvl => {
                        const lower = lvl.toLowerCase();
                        if (lower.includes('prepa') || lower.includes('bachiller')) {
                          newConfig[lvl] = {
                            periodCount: 5,
                            periodType: 'Bimestres',
                            periodNames: generateDefaultPeriodNames('Bimestres', 5)
                          };
                        } else if (lower.includes('uni') || lower.includes('licenciatura')) {
                          newConfig[lvl] = {
                            periodCount: 2,
                            periodType: 'Semestres',
                            periodNames: generateDefaultPeriodNames('Semestres', 2)
                          };
                        } else {
                          newConfig[lvl] = {
                            periodCount: 3,
                            periodType: 'Trimestres',
                            periodNames: generateDefaultPeriodNames('Trimestres', 3)
                          };
                        }
                      });
                      setSettings({ ...settings, levelEvaluationConfig: newConfig });
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors"
                  >
                    <Sparkles size={14} />
                    Aplicar Regla SEP (3 Trimestres / 5 Bimestres)
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                    <AlertCircle className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Define los periodos que conformarán el ciclo escolar por cada nivel educativo (por ejemplo, <strong>3 Trimestres</strong> en Primaria y Secundaria, y <strong>5 Bimestres</strong> en Preparatoria). Esta configuración se aplicará automáticamente a la <strong>captura docente</strong>, el <strong>bloqueo de notas</strong>, el cálculo de <strong>promedios</strong> y la <strong>boleta oficial</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {settings.academicLevels?.map((level) => {
                      const currentConfig = getLevelEvaluationConfig(settings, level);
                      return (
                        <div key={level} className="p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 transition-all shadow-sm space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{level}</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {currentConfig.periodCount} {currentConfig.periodType}
                              </span>
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border",
                                currentConfig.gradingScale === 'letters' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                currentConfig.gradingScale === 'numeric_100' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                "bg-blue-50 text-blue-700 border-blue-200"
                              )}>
                                {currentConfig.gradingScale === 'letters' ? 'Letras (A - D)' :
                                 currentConfig.gradingScale === 'numeric_100' ? 'Escala 0 a 100' : 'Escala 0 a 10'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                Tipo de Periodo
                              </label>
                              <select
                                value={currentConfig.periodType}
                                onChange={(e) => {
                                  const newType = e.target.value as any;
                                  let newCount = currentConfig.periodCount;
                                  if (newType === 'Trimestres' && newCount !== 3) newCount = 3;
                                  if (newType === 'Bimestres' && newCount !== 5) newCount = 5;
                                  if (newType === 'Semestres' && newCount !== 2) newCount = 2;
                                  if (newType === 'Cuatrimestres' && newCount !== 3) newCount = 3;

                                  const updated: LevelEvaluationConfig = {
                                    ...currentConfig,
                                    periodType: newType,
                                    periodCount: newCount,
                                    periodNames: generateDefaultPeriodNames(newType, newCount)
                                  };
                                  const newMap = { ...(settings.levelEvaluationConfig || {}) };
                                  newMap[level] = updated;
                                  setSettings({ ...settings, levelEvaluationConfig: newMap });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                              >
                                <option value="Trimestres">Trimestres (SEP Primaria/Secundaria)</option>
                                <option value="Bimestres">Bimestres (Preparatoria)</option>
                                <option value="Semestres">Semestres</option>
                                <option value="Cuatrimestres">Cuatrimestres</option>
                                <option value="Personalizado">Personalizado</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                Cantidad de Periodos (Entregas)
                              </label>
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5, 6].map((num) => (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => {
                                      const updated: LevelEvaluationConfig = {
                                        ...currentConfig,
                                        periodCount: num,
                                        periodNames: generateDefaultPeriodNames(currentConfig.periodType, num)
                                      };
                                      const newMap = { ...(settings.levelEvaluationConfig || {}) };
                                      newMap[level] = updated;
                                      setSettings({ ...settings, levelEvaluationConfig: newMap });
                                    }}
                                    className={cn(
                                      "flex-1 py-1.5 rounded-lg text-xs font-black transition-all",
                                      currentConfig.periodCount === num
                                        ? "bg-slate-900 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                  >
                                    {num}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                Previsualización de Entregas Docentes
                              </label>
                              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100 min-h-[36px] items-center">
                                {currentConfig.periodNames?.map((pName, pIdx) => (
                                  <span key={pIdx} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded shadow-2xs">
                                    {pName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Escala de Calificación y Promedios */}
                          <div className="pt-3 border-t border-slate-100">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">
                                  Tipo de Calificación y Escala de Promedio
                                </label>
                                <p className="text-xs text-slate-500 font-medium">
                                  {currentConfig.gradingScale === 'letters' && 'Cualitativa con letras: A (Destacado), B (Satisfactorio), C (Suficiente), D (Insuficiente). El promedio se calculará en letras.'}
                                  {currentConfig.gradingScale === 'numeric_10' && 'Escala decimal estándar de 0 a 10 puntos (promedios con un decimal en rango 0 - 10).'}
                                  {currentConfig.gradingScale === 'numeric_100' && 'Escala numérica entera de 0 a 100 puntos (promedios en rango 0 - 100 sin decimales).'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated: LevelEvaluationConfig = {
                                      ...currentConfig,
                                      gradingScale: 'letters'
                                    };
                                    const newMap = { ...(settings.levelEvaluationConfig || {}) };
                                    newMap[level] = updated;
                                    setSettings({ ...settings, levelEvaluationConfig: newMap });
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5",
                                    currentConfig.gradingScale === 'letters'
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                  )}
                                >
                                  <span>Letras (A - D)</span>
                                  <span className={cn("text-[9px] px-1 rounded font-bold", currentConfig.gradingScale === 'letters' ? "bg-emerald-700 text-emerald-100" : "bg-slate-200 text-slate-600")}>Preescolar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated: LevelEvaluationConfig = {
                                      ...currentConfig,
                                      gradingScale: 'numeric_10'
                                    };
                                    const newMap = { ...(settings.levelEvaluationConfig || {}) };
                                    newMap[level] = updated;
                                    setSettings({ ...settings, levelEvaluationConfig: newMap });
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5",
                                    currentConfig.gradingScale === 'numeric_10'
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                  )}
                                >
                                  <span>0 a 10</span>
                                  <span className={cn("text-[9px] px-1 rounded font-bold", currentConfig.gradingScale === 'numeric_10' ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-600")}>Primaria / Sec.</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated: LevelEvaluationConfig = {
                                      ...currentConfig,
                                      gradingScale: 'numeric_100'
                                    };
                                    const newMap = { ...(settings.levelEvaluationConfig || {}) };
                                    newMap[level] = updated;
                                    setSettings({ ...settings, levelEvaluationConfig: newMap });
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5",
                                    currentConfig.gradingScale === 'numeric_100'
                                      ? "bg-slate-900 text-white shadow-xs"
                                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                  )}
                                >
                                  <span>0 a 100</span>
                                  <span className={cn("text-[9px] px-1 rounded font-bold", currentConfig.gradingScale === 'numeric_100' ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-600")}>Prepa / 100</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {(!settings.academicLevels || settings.academicLevels.length === 0) && (
                      <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-sm font-bold text-slate-400">Primero configura los Niveles Educativos arriba.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Nuevo Card: Gestionar CCT por Nivel */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <Key size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Gestionar CCT</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Clave de Centro de Trabajo por Nivel</p>
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {settings.academicLevels?.map((level) => (
                      <div key={level}>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{level}</label>
                        <input
                          placeholder="Ingrese CCT..."
                          value={settings.levelCCT?.[level] || ''}
                          onChange={(e) => {
                            const newLevelCCT = { ...(settings.levelCCT || {}) };
                            newLevelCCT[level] = e.target.value;
                            setSettings({ ...settings, levelCCT: newLevelCCT });
                          }}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                        />
                      </div>
                    ))}
                    {(!settings.academicLevels || settings.academicLevels.length === 0) && (
                      <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-sm font-bold text-slate-400">Primero configura los Niveles Educativos arriba.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card: Prefijos de Matrícula por Nivel */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Prefijos de Matrícula</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Base de matrícula por cada nivel educativo</p>
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {settings.academicLevels?.map((level) => (
                      <div key={level}>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{level}</label>
                        <input
                          placeholder="Ej: PRM- o SEC-..."
                          value={settings.matriculaPrefixes?.[level] || ''}
                          onChange={(e) => {
                            const newPrefixes = { ...(settings.matriculaPrefixes || {}) };
                            newPrefixes[level] = e.target.value;
                            setSettings({ ...settings, matriculaPrefixes: newPrefixes });
                          }}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                        />
                      </div>
                    ))}
                    {(!settings.academicLevels || settings.academicLevels.length === 0) && (
                      <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-sm font-bold text-slate-400">Primero configura los Niveles Educativos arriba.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card: Configuración de Periodos y Recesos por Nivel */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Periodos y Recesos por Nivel</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Configura las horas de clase y recesos específicos</p>
                    </div>
                  </div>
                  {/* Selector de Nivel */}
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel:</label>
                    <select
                      value={selectedScheduleLevel}
                      onChange={(e) => setSelectedScheduleLevel(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                    >
                      {settings.academicLevels?.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="p-8">
                  {selectedScheduleLevel ? (
                    <div className="space-y-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                              <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider w-12 text-center">#</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Etiqueta / Nombre</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Rango de Horario</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider w-32 text-center">Tipo</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider w-40 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentPeriods.map((period: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3.5 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                                <td className="px-4 py-3.5">
                                  <input
                                    type="text"
                                    value={period.label}
                                    onChange={(e) => handlePeriodChange(idx, 'label', e.target.value)}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3.5">
                                  <input
                                    type="text"
                                    value={period.time}
                                    placeholder="ej. 07:30 - 08:20"
                                    onChange={(e) => handlePeriodChange(idx, 'time', e.target.value)}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={!!period.isBreak}
                                      onChange={(e) => handlePeriodChange(idx, 'isBreak', e.target.checked)}
                                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Receso</span>
                                  </label>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMovePeriod(idx, 'up')}
                                      className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 transition-colors"
                                      title="Subir"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === currentPeriods.length - 1}
                                      onClick={() => handleMovePeriod(idx, 'down')}
                                      className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 transition-colors"
                                      title="Bajar"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePeriod(idx)}
                                      className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded text-slate-500 transition-colors"
                                      title="Eliminar"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={handleAddPeriod}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                        >
                          + Agregar Periodo / Receso
                        </button>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          * Los cambios se guardarán al pulsar "Guardar Configuración" al final de la página.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                      <p className="text-sm font-bold text-slate-400">Primero configura los Niveles Educativos arriba.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reception' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                      <Users size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Atención al Público</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Catálogos de recepción</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <AcademicListManager 
                      title="Áreas de Atención" 
                      description="Ej. Dirección, Caja"
                      items={settings.receptionAreas || []} 
                      onUpdate={(newItems) => setSettings({...settings, receptionAreas: newItems})}
                    />
                    <AcademicListManager 
                      title="Motivos de Visita" 
                      description="Razones de consulta"
                      items={settings.receptionReasons || []} 
                      onUpdate={(newItems) => setSettings({...settings, receptionReasons: newItems})}
                    />
                  </div>

                  {userProfile?.role === 'Superadministrador' && (
                    <div className="mt-12 pt-12 border-t border-slate-100 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 size={16} />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Kiosk Público (QR)</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Título de Éxito</label>
                          <input
                            placeholder="¡Registro Exitoso!"
                            value={settings.receptionSuccessTitle || ''}
                            onChange={(e) => setSettings({...settings, receptionSuccessTitle: e.target.value})}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Contenido QR (ej. WiFi)</label>
                          <input
                            placeholder="WIFI:S:MyNet..."
                            value={settings.visitorQrCodeContent || ''}
                            onChange={(e) => setSettings({...settings, visitorQrCodeContent: e.target.value})}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mensaje de Confirmación</label>
                          <textarea
                            rows={2}
                            value={settings.receptionSuccessMessage || ''}
                            onChange={(e) => setSettings({...settings, receptionSuccessMessage: e.target.value})}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-xs resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'charges' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-200">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Cobros Extraordinarios</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Catálogo de conceptos adicionales</p>
                    </div>
                  </div>
                  <div className="p-8">
                     <ChargesCatalog />
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'danger' && userProfile?.role === 'Superadministrador' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-red-50/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-100">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-red-900 uppercase tracking-tight">Zona Crítica</h2>
                      <p className="text-[10px] text-red-700/60 font-bold uppercase tracking-widest">Acciones irreversibles</p>
                    </div>
                  </div>
                  
                  <div className="p-8 space-y-8">
                    <div className="p-8 bg-red-50 rounded-xl border border-red-100 relative overflow-hidden">
                       <div className="absolute -top-10 -right-10 text-red-100/50 rotate-12">
                          <AlertCircle size={160} />
                       </div>
                       <div className="relative z-10 space-y-6">
                         <div>
                           <h3 className="text-xl font-black text-red-900 mb-2">Mantenimiento de Datos</h3>
                           <p className="text-sm text-red-700 font-medium leading-relaxed max-w-2xl">
                             Estas herramientas permiten gestionar el estado de la base de datos. Úsalas con extrema precaución ya que pueden afectar la integridad de la información escolar.
                           </p>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <button
                              onClick={async () => {
                                if (!window.confirm('¿Cargar datos de ejemplo? Esto agregará información ficticia para demostración.')) return;
                                try {
                                  setLoading(true);
                                  await loadExampleData();
                                  alert('Datos cargados. La página se recargará.');
                                  window.location.reload();
                                } catch (error) {
                                  alert('Error: ' + error.message);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="group p-6 bg-white rounded-xl border border-red-100 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100 transition-all text-left"
                            >
                               <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                  <Database size={24} />
                               </div>
                               <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">Cargar Alumnos Demo</p>
                               <p className="text-[10px] text-slate-500 font-bold">Poblar sistema con datos ficticios</p>
                            </button>

                            <button
                              onClick={async () => {
                                const confirm1 = window.confirm('¿ESTÁS SEGURO? Se borrarán todos los alumnos y pagos.');
                                if (!confirm1) return;
                                const confirm2 = window.prompt('Escribe "ELIMINAR TODO" para confirmar:');
                                if (confirm2 !== 'ELIMINAR TODO') return;

                                try {
                                  const collections = ['students', 'payments', 'expenses', 'cycles', 'announcements', 'grades', 'attendance', 'reception_visits', 'bimestreLocks', 'enrollments'];
                                  for (const coll of collections) {
                                    const snap = await getDocs(collection(db, coll));
                                    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, coll, d.id))));
                                  }
                                  alert('Sistema restablecido.');
                                  window.location.reload();
                                } catch (error) {
                                  alert('Error al borrar.');
                                }
                              }}
                              className="group p-6 bg-white rounded-xl border border-red-100 hover:border-red-600 hover:shadow-xl hover:shadow-red-100 transition-all text-left"
                            >
                               <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-all">
                                  <Trash2 size={24} />
                               </div>
                               <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1 text-red-600">Restablecer Todo</p>
                               <p className="text-[10px] text-slate-500 font-bold">Borrar información operativa permanentemente</p>
                            </button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (() => {
            const allStaffUsers = appUsers.filter(u => u.role !== 'Padre');

            // Quick Stats
            const totalCount = allStaffUsers.length;
            const teacherCount = allStaffUsers.filter(u => u.role === 'Docente').length;
            const adminCount = allStaffUsers.filter(u => u.role === 'Administrador' || u.role === 'Superadministrador' || u.role === 'Control Escolar').length;
            const opsCount = allStaffUsers.filter(u => u.role === 'Cajero' || u.role === 'Recepción' || u.role === 'Visor').length;

            const filteredUsers = allStaffUsers.filter(user => {
              // Role filter
              if (userRoleFilter !== 'Todos' && user.role !== userRoleFilter) return false;

              // Level filter
              if (userLevelFilter && user.assignedLevel !== userLevelFilter) return false;

              // Search term
              if (userSearchTerm) {
                const term = userSearchTerm.toLowerCase();
                const matchesName = (user.name || '').toLowerCase().includes(term);
                const matchesEmail = (user.email || '').toLowerCase().includes(term);
                const matchesPhone = (user.phone || '').toLowerCase().includes(term);
                const matchesEmpNo = (user.employeeNumber || '').toLowerCase().includes(term);
                const matchesRole = (user.role || '').toLowerCase().includes(term);
                const matchesAssignment = `${user.assignedLevel || ''} ${user.assignedGrade || ''} ${user.assignedGroup || ''}`.toLowerCase().includes(term);
                if (!matchesName && !matchesEmail && !matchesPhone && !matchesEmpNo && !matchesRole && !matchesAssignment) {
                  return false;
                }
              }

              return true;
            });

            const getRoleBadge = (role: UserRole) => {
              switch (role) {
                case 'Superadministrador':
                  return 'bg-purple-950 text-purple-200 border-purple-800 shadow-sm';
                case 'Administrador':
                  return 'bg-rose-50 text-rose-700 border-rose-200';
                case 'Control Escolar':
                  return 'bg-amber-50 text-amber-800 border-amber-200';
                case 'Docente':
                  return 'bg-blue-50 text-blue-700 border-blue-200';
                case 'Cajero':
                  return 'bg-emerald-50 text-emerald-800 border-emerald-200';
                case 'Recepción':
                  return 'bg-cyan-50 text-cyan-800 border-cyan-200';
                case 'Visor':
                  return 'bg-slate-100 text-slate-700 border-slate-200';
                default:
                  return 'bg-slate-100 text-slate-700 border-slate-200';
              }
            };

            const getPermissionsList = (perms?: AppPermissions) => {
              if (!perms) return [];
              const list: { key: string; label: string }[] = [];
              if (perms.dashboard?.view) list.push({ key: 'dashboard', label: 'Dashboard' });
              if (perms.students?.view) list.push({ key: 'students', label: 'Alumnos' });
              if (perms.payments?.view) list.push({ key: 'payments', label: 'Pagos' });
              if (perms.expenses?.view) list.push({ key: 'expenses', label: 'Gastos' });
              if (perms.controlEscolar?.view) list.push({ key: 'controlEscolar', label: 'Control Escolar' });
              if (perms.grading?.view) list.push({ key: 'grading', label: 'Calificaciones' });
              if (perms.timeClock?.view) list.push({ key: 'timeClock', label: 'Checador' });
              if (perms.reception?.view) list.push({ key: 'reception', label: 'Recepción' });
              if (perms.announcements?.view) list.push({ key: 'announcements', label: 'Avisos' });
              if (perms.parents?.view) list.push({ key: 'parents', label: 'Padres' });
              if (perms.settings?.view) list.push({ key: 'settings', label: 'Ajustes' });
              return list;
            };

            const handleCopyEmail = (email: string) => {
              navigator.clipboard.writeText(email);
              setCopiedEmail(email);
              setTimeout(() => setCopiedEmail(null), 2000);
            };

            const handleDeleteUser = async (user: AppUser) => {
              if (window.confirm(`¿Eliminar acceso al usuario ${user.name}? Se quitarán todas sus lecciones y clases asignadas en los horarios.`)) {
                try {
                  const batch = writeBatch(db);
                  
                  // Delete user doc and biometric profile
                  batch.delete(doc(db, 'users', user.id));
                  batch.delete(doc(db, 'employees', user.id));
                  
                  // If it was a teacher, sweep their schedule contracts
                  const contractsSnap = await getDocs(
                    query(collection(db, 'schedule_contracts'), where('teacherId', '==', user.id))
                  );
                  contractsSnap.forEach(d => {
                    batch.delete(doc(db, 'schedule_contracts', d.id));
                  });

                  // Sweep their grid slots
                  const schedulesSnap = await getDocs(
                    query(collection(db, 'schedules'), where('teacherId', '==', user.id))
                  );
                  schedulesSnap.forEach(d => {
                    batch.delete(doc(db, 'schedules', d.id));
                  });

                  await batch.commit();
                } catch (error) {
                  console.error("Error deleting user and schedules:", error);
                  alert("Hubo un error al eliminar al colaborador.");
                }
              }
            };

            return (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 font-sans">
                
                {/* Header & Main Action */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <Shield size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                            Gestión de Colaboradores
                          </h2>
                          <span className="bg-indigo-100 text-indigo-700 font-black text-[10px] px-2 py-0.5 rounded-full">
                            {totalCount} Personal
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-bold">
                          Directorio de usuarios, credenciales, asignaciones académicas y privilegios
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setEditingUser(null);
                        setUserFormData({
                          email: '',
                          name: '',
                          phone: '',
                          employeeNumber: '',
                          password: '',
                          role: 'Cajero',
                          permissions: DEFAULT_PERMISSIONS['Cajero'],
                          teacherSubjectAccess: 'all',
                          assignedSubjects: [],
                          teacherSubjectGrades: {},
                          teacherSubjectGroups: {},
                          teacherGradeGroups: {},
                          teacherGroupAccess: 'single',
                          restrictedLevels: [],
                          restrictedGrades: [],
                          restrictedGroups: []
                        });
                        setShowCurrentPassword(false);
                        setShowNewPassword(false);
                        setIsUserModalOpen(true);
                      }}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer self-start md:self-auto"
                    >
                      <Plus size={16} strokeWidth={3} />
                      <span>Nuevo Colaborador</span>
                    </button>
                  </div>

                  {/* KPI Quick Stats */}
                  <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50/30">
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block leading-none mb-1">
                          Total Personal
                        </span>
                        <span className="text-xl font-black text-slate-900">{totalCount}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <GraduationCap size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block leading-none mb-1">
                          Docentes / Tutores
                        </span>
                        <span className="text-xl font-black text-blue-900">{teacherCount}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <ShieldAlert size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block leading-none mb-1">
                          Administrativos
                        </span>
                        <span className="text-xl font-black text-rose-900">{adminCount}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Briefcase size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block leading-none mb-1">
                          Caja y Recepción
                        </span>
                        <span className="text-xl font-black text-emerald-900">{opsCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Control & Filter Bar */}
                  <div className="p-6 space-y-4">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                      {/* Search Input */}
                      <div className="relative flex-1 min-w-[280px]">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          placeholder="Buscar por nombre, correo, teléfono o no. de empleado..."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all placeholder:text-slate-400 placeholder:font-normal"
                        />
                        {userSearchTerm && (
                          <button
                            onClick={() => setUserSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Level Filter (if any levels configured) */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                          <GraduationCap size={14} className="text-slate-400" />
                          <select
                            value={userLevelFilter}
                            onChange={(e) => setUserLevelFilter(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                          >
                            <option value="">TODOS LOS NIVELES</option>
                            {(settings.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato']).map(lvl => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                        </div>

                        {/* View Switcher: Table vs Cards */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            onClick={() => setUserViewMode('table')}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              userViewMode === 'table'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                            title="Vista en Tabla"
                          >
                            <LayoutList size={15} />
                            <span className="hidden sm:inline text-[11px]">Tabla</span>
                          </button>
                          <button
                            onClick={() => setUserViewMode('cards')}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              userViewMode === 'cards'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                            title="Vista en Cuadrícula"
                          >
                            <LayoutGrid size={15} />
                            <span className="hidden sm:inline text-[11px]">Tarjetas</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Role Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {(['Todos', 'Superadministrador', 'Administrador', 'Control Escolar', 'Docente', 'Cajero', 'Recepción', 'Visor'] as const).map((role) => {
                        const count = role === 'Todos' ? totalCount : allStaffUsers.filter(u => u.role === role).length;
                        const isSelected = userRoleFilter === role;
                        return (
                          <button
                            key={role}
                            onClick={() => setUserRoleFilter(role)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                              isSelected
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span>{role}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
                              isSelected ? 'bg-slate-800 text-indigo-300' : 'bg-slate-200/80 text-slate-600'
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Main Display: TABLE VIEW */}
                  {userViewMode === 'table' ? (
                    <div className="border-t border-slate-200 overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-wider">
                          <tr>
                            <th className="py-3 px-4 w-10 text-center text-slate-400">#</th>
                            <th className="py-3 px-4">Colaborador</th>
                            <th className="py-3 px-4">Contacto</th>
                            <th className="py-3 px-4">Rol en el Sistema</th>
                            <th className="py-3 px-4">Asignación / Alcance</th>
                            <th className="py-3 px-4">Módulos Habilitados</th>
                            <th className="py-3 px-4">Fecha de Alta</th>
                            <th className="py-3 px-4 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-slate-400">
                                <Users size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-sm font-bold text-slate-600">No se encontraron colaboradores</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {userSearchTerm ? 'Prueba con otros términos de búsqueda' : 'No hay usuarios dados de alta en este filtro.'}
                                </p>
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((user, idx) => {
                              const permissionsList = getPermissionsList(user.permissions);
                              const hasFullAssignment = user.assignedLevel || user.assignedGrade || user.assignedGroup;

                              return (
                                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                                  {/* # */}
                                  <td className="py-3.5 px-4 text-center text-[10px] font-bold text-slate-400">
                                    {idx + 1}
                                  </td>

                                  {/* User Name & Avatar */}
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-3">
                                      {user.photoUrl ? (
                                        <img
                                          src={user.photoUrl}
                                          alt={user.name}
                                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-sm font-black shadow-xs">
                                          {user.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div>
                                        <button
                                          onClick={() => setSelectedUserDetail(user)}
                                          className="text-xs font-black text-slate-900 hover:text-indigo-600 transition-colors text-left uppercase flex items-center gap-1 cursor-pointer"
                                        >
                                          {user.name}
                                        </button>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          {user.employeeNumber ? (
                                            <span className="font-mono text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded uppercase">
                                              No. {user.employeeNumber}
                                            </span>
                                          ) : (
                                            <span className="text-[9px] font-mono text-slate-400">
                                              ID: {user.id.slice(0, 7)}...
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Contact info */}
                                  <td className="py-3.5 px-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <Mail size={12} className="text-slate-400 shrink-0" />
                                        <span className="text-slate-700 font-bold truncate max-w-[180px]">{user.email}</span>
                                        <button
                                          onClick={() => handleCopyEmail(user.email)}
                                          className="text-slate-300 hover:text-indigo-600 transition-colors p-0.5 cursor-pointer"
                                          title="Copiar correo"
                                        >
                                          {copiedEmail === user.email ? (
                                            <Check size={11} className="text-emerald-600" />
                                          ) : (
                                            <Copy size={11} />
                                          )}
                                        </button>
                                      </div>
                                      {user.phone ? (
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                          <Phone size={12} className="text-slate-400 shrink-0" />
                                          <span className="font-mono text-[11px] font-semibold">{user.phone}</span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">Sin teléfono</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Role */}
                                  <td className="py-3.5 px-4">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${getRoleBadge(user.role)}`}>
                                      <Shield size={10} />
                                      {user.role}
                                    </span>
                                  </td>

                                  {/* Academic Assignment */}
                                  <td className="py-3.5 px-4">
                                    {user.role === 'Docente' ? (
                                      (user.teacherGroupAccess === 'multiple' || (user.restrictedLevels && user.restrictedLevels.length > 1) || (user.restrictedGrades && user.restrictedGrades.length > 1)) ? (
                                        <div className="space-y-0.5">
                                          <div className="font-black text-indigo-700 text-[11px] flex items-center gap-1">
                                            <Users size={12} className="text-indigo-600" />
                                            Múltiples Grupos
                                          </div>
                                          <span className="text-[10px] text-slate-500 font-bold block">
                                            {user.restrictedLevels?.join(', ') || 'Todos los niveles'}
                                          </span>
                                        </div>
                                      ) : hasFullAssignment ? (
                                        <div className="space-y-0.5">
                                          <div className="font-black text-slate-800 text-[11px]">
                                            {user.assignedLevel} {user.assignedGrade} "{user.assignedGroup}"
                                          </div>
                                          {user.maxHoursPerWeek ? (
                                            <span className="text-[10px] font-bold text-slate-400 block">
                                              Jornada: {user.maxHoursPerWeek} hrs/sem
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold">
                                          Sin grupo asignado
                                        </span>
                                      )
                                    ) : user.role === 'Control Escolar' ? (
                                      (user.restrictedLevels?.length || user.restrictedGrades?.length || user.restrictedGroups?.length) ? (
                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                                          Acceso Restringido ({user.restrictedLevels?.length || 0} niv.)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                          Acceso Total
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                                        Institucional
                                      </span>
                                    )}
                                  </td>

                                  {/* Permissions Summary */}
                                  <td className="py-3.5 px-4">
                                    <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                                      {permissionsList.slice(0, 3).map(p => (
                                        <span key={p.key} className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                          {p.label}
                                        </span>
                                      ))}
                                      {permissionsList.length > 3 && (
                                        <button
                                          onClick={() => setSelectedUserDetail(user)}
                                          className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors cursor-pointer"
                                        >
                                          +{permissionsList.length - 3} más
                                        </button>
                                      )}
                                      {permissionsList.length === 0 && (
                                        <span className="text-[10px] text-slate-400 italic">Sin permisos</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Date Created */}
                                  <td className="py-3.5 px-4 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                    {user.createdAt ? (
                                      format(user.createdAt.toDate(), 'dd MMM yyyy', { locale: es })
                                    ) : (
                                      'N/D'
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-3.5 px-4 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => setSelectedUserDetail(user)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                        title="Ver detalles completos"
                                      >
                                        <Eye size={15} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingUser(user);
                                          setUserFormData({
                                            ...user,
                                            password: '',
                                            teacherSubjectAccess: user.teacherSubjectAccess || 'all',
                                            assignedSubjects: user.assignedSubjects || [],
                                            teacherSubjectGrades: user.teacherSubjectGrades || {},
                                            teacherSubjectGroups: user.teacherSubjectGroups || {},
                                            teacherGradeGroups: user.teacherGradeGroups || {},
                                            teacherGroupAccess: user.teacherGroupAccess || (
                                              (user.restrictedLevels && user.restrictedLevels.length > 1) ||
                                              (user.restrictedGrades && user.restrictedGrades.length > 1) ||
                                              (user.restrictedGroups && user.restrictedGroups.length > 1)
                                                ? 'multiple'
                                                : 'single'
                                            ),
                                            restrictedLevels: user.restrictedLevels || (user.assignedLevel ? [user.assignedLevel] : []),
                                            restrictedGrades: user.restrictedGrades || (user.assignedGrade ? [user.assignedGrade] : []),
                                            restrictedGroups: user.restrictedGroups || (user.assignedGroup ? [user.assignedGroup] : [])
                                          });
                                          setShowCurrentPassword(false);
                                          setShowNewPassword(false);
                                          setIsUserModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                        title="Editar colaborador"
                                      >
                                        <Edit2 size={15} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(user)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                        title="Eliminar colaborador"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* CARDS VIEW */
                    <div className="p-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredUsers.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400">
                          <Users size={32} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-sm font-bold text-slate-600">No se encontraron colaboradores</p>
                        </div>
                      ) : (
                        filteredUsers.map(user => {
                          const permissionsList = getPermissionsList(user.permissions);
                          return (
                            <div key={user.id} className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all flex flex-col justify-between space-y-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    {user.photoUrl ? (
                                      <img
                                        src={user.photoUrl}
                                        alt={user.name}
                                        className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-base font-black shadow-xs">
                                        {user.name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div>
                                      <h3 className="text-sm font-black text-slate-900 leading-tight uppercase">
                                        {user.name}
                                      </h3>
                                      <p className="text-[11px] text-slate-500 font-bold truncate max-w-[160px]">
                                        {user.email}
                                      </p>
                                    </div>
                                  </div>

                                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${getRoleBadge(user.role)}`}>
                                    {user.role}
                                  </span>
                                </div>

                                {user.phone && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                                    <Phone size={12} className="text-slate-400" />
                                    <span>{user.phone}</span>
                                  </div>
                                )}

                                {user.role === 'Docente' && (
                                  (user.teacherGroupAccess === 'multiple' || (user.restrictedLevels && user.restrictedLevels.length > 1)) ? (
                                    <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-900 flex items-center justify-between">
                                      <span className="flex items-center gap-1.5"><Users size={12} className="text-indigo-600" /> Múltiples Grupos ({user.restrictedLevels?.join(', ') || 'Todos'})</span>
                                    </div>
                                  ) : (user.assignedLevel || user.assignedGrade) ? (
                                    <div className="p-2 bg-blue-50 rounded-lg text-xs font-bold text-blue-900 flex items-center justify-between">
                                      <span>{user.assignedLevel} {user.assignedGrade} "{user.assignedGroup || 'A'}"</span>
                                      {user.maxHoursPerWeek ? (
                                        <span className="text-[10px] text-blue-600 font-mono">{user.maxHoursPerWeek}h/sem</span>
                                      ) : null}
                                    </div>
                                  ) : null
                                )}

                                {/* Permissions count */}
                                <div className="flex items-center justify-between text-[11px] pt-1">
                                  <span className="text-slate-400 font-bold uppercase text-[10px]">Permisos:</span>
                                  <span className="text-indigo-600 font-black">{permissionsList.length} módulos</span>
                                </div>
                              </div>

                              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {user.createdAt ? format(user.createdAt.toDate(), 'dd/MM/yyyy') : ''}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setSelectedUserDetail(user)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Ver Ficha"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingUser(user);
                                      setUserFormData({
                                        ...user,
                                        password: '',
                                        teacherSubjectAccess: user.teacherSubjectAccess || 'all',
                                        assignedSubjects: user.assignedSubjects || [],
                                        teacherSubjectGrades: user.teacherSubjectGrades || {},
                                        teacherSubjectGroups: user.teacherSubjectGroups || {},
                                        teacherGradeGroups: user.teacherGradeGroups || {},
                                        teacherGroupAccess: user.teacherGroupAccess || (
                                          (user.restrictedLevels && user.restrictedLevels.length > 1) ||
                                          (user.restrictedGrades && user.restrictedGrades.length > 1) ||
                                          (user.restrictedGroups && user.restrictedGroups.length > 1)
                                            ? 'multiple'
                                            : 'single'
                                        ),
                                        restrictedLevels: user.restrictedLevels || (user.assignedLevel ? [user.assignedLevel] : []),
                                        restrictedGrades: user.restrictedGrades || (user.assignedGrade ? [user.assignedGrade] : []),
                                        restrictedGroups: user.restrictedGroups || (user.assignedGroup ? [user.assignedGroup] : [])
                                      });
                                      setShowCurrentPassword(false);
                                      setShowNewPassword(false);
                                      setIsUserModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Table Footer info */}
                  <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
                    <span>Mostrando <strong>{filteredUsers.length}</strong> de <strong>{totalCount}</strong> colaboradores</span>
                    <span className="text-[11px]">Control Integral Escolar • Seguridad y Accesos</span>
                  </div>
                </div>

              </div>
            );
          })()}

          {isUserModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="text-indigo-600" />
                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                  </h2>
                  <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <XIcon size={20} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
                      <input
                        required
                        value={userFormData.name}
                        onChange={(e) => setUserFormData({...userFormData, name: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico *</label>
                      <input
                        required
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                        disabled={!!editingUser}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                      <input
                        type="tel"
                        placeholder="Ej. 55 1234 5678"
                        value={userFormData.phone || ''}
                        onChange={(e) => setUserFormData({...userFormData, phone: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">No. de Empleado / Clave</label>
                      <input
                        type="text"
                        placeholder="Ej. EMP-024"
                        value={userFormData.employeeNumber || ''}
                        onChange={(e) => setUserFormData({...userFormData, employeeNumber: e.target.value.toUpperCase()})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase"
                      />
                    </div>
                    {!editingUser ? (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña Inicial *</label>
                        <div className="relative">
                          <input
                            required
                            type={showNewPassword ? 'text' : 'password'}
                            value={userFormData.password}
                            onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                            className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                            placeholder="Mínimo 6 caracteres"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title={showNewPassword ? "Ocultar" : "Ver contraseña"}
                          >
                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="md:col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Key size={14} className="text-indigo-600" />
                            Gestión de Contraseña
                          </label>
                          {userFormData.email && (
                            <button
                              type="button"
                              disabled={isResetEmailSending}
                              onClick={async () => {
                                try {
                                  setIsResetEmailSending(true);
                                  const auth = getAuth();
                                  await sendPasswordResetEmail(auth, userFormData.email!);
                                  alert(`Se ha enviado un correo de restablecimiento de contraseña a ${userFormData.email}`);
                                } catch (err: any) {
                                  alert(`Error al enviar correo: ${err.message}`);
                                } finally {
                                  setIsResetEmailSending(false);
                                }
                              }}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer disabled:opacity-50 text-left sm:text-right"
                            >
                              {isResetEmailSending ? 'Enviando...' : 'Enviar enlace de restablecimiento al correo'}
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Contraseña Actual */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Contraseña Actual</span>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-slate-800 select-all">
                                {editingUser.currentPassword 
                                  ? (showCurrentPassword ? editingUser.currentPassword : '••••••••••••')
                                  : <span className="text-slate-400 font-normal italic text-[11px]">No registrada previamente</span>}
                              </span>
                              {editingUser.currentPassword && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                                    title={showCurrentPassword ? "Ocultar" : "Ver contraseña"}
                                  >
                                    {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(editingUser.currentPassword || '');
                                      setCopiedPassword('current');
                                      setTimeout(() => setCopiedPassword(null), 2000);
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                                    title="Copiar contraseña"
                                  >
                                    {copiedPassword === 'current' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Cambiar Contraseña */}
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nueva Contraseña (Opcional)</span>
                            <div className="relative">
                              <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={userFormData.password || ''}
                                onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                                placeholder="Dejar en blanco para conservar"
                                className="w-full px-3 py-2 pr-9 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                title={showNewPassword ? "Ocultar" : "Ver contraseña"}
                              >
                                {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Rol del Usuario *</label>
                      <select
                        value={userFormData.role}
                        onChange={(e) => {
                          const role = e.target.value as UserRole;
                          setUserFormData({...userFormData, role, permissions: DEFAULT_PERMISSIONS[role]});
                        }}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat"
                      >
                        <option value="Superadministrador">Superadministrador</option>
                        <option value="Administrador">Administrador</option>
                        <option value="Control Escolar">Control Escolar</option>
                        <option value="Docente">Docente</option>
                        <option value="Recepción">Recepción</option>
                        <option value="Visor">Visor</option>
                        <option value="Cajero">Cajero</option>
                      </select>
                  </div>

                  {userFormData.role === 'Control Escolar' && (
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={14} className="text-indigo-600" />
                        <p className="text-[10px] font-bold text-indigo-600 uppercase">Restricciones de Acceso (Opcional)</p>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-4 italic">Si no seleccionas nada, tendrá acceso a todos los niveles/grados/grupos.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Niveles Permitidos</label>
                          <div className="space-y-1 max-h-32 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                            {(settings.academicLevels || []).map(level => (
                              <label key={level} className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer hover:text-indigo-600">
                                <input 
                                  type="checkbox" 
                                  checked={(userFormData.restrictedLevels || []).includes(level)}
                                  onChange={(e) => {
                                    const current = userFormData.restrictedLevels || [];
                                    const next = e.target.checked ? [...current, level] : current.filter(l => l !== level);
                                    setUserFormData({...userFormData, restrictedLevels: next});
                                  }}
                                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                {level}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Grados Permitidos</label>
                          <div className="space-y-1 max-h-32 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                            {(settings.academicGrades || []).map(grade => (
                              <label key={grade} className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer hover:text-indigo-600">
                                <input 
                                  type="checkbox" 
                                  checked={(userFormData.restrictedGrades || []).includes(grade)}
                                  onChange={(e) => {
                                    const current = userFormData.restrictedGrades || [];
                                    const next = e.target.checked ? [...current, grade] : current.filter(g => g !== grade);
                                    setUserFormData({...userFormData, restrictedGrades: next});
                                  }}
                                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                {grade}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Grupos Permitidos</label>
                          <div className="space-y-1 max-h-32 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                            {(settings.academicGroups || []).map(group => (
                              <label key={group} className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer hover:text-indigo-600">
                                <input 
                                  type="checkbox" 
                                  checked={(userFormData.restrictedGroups || []).includes(group)}
                                  onChange={(e) => {
                                    const current = userFormData.restrictedGroups || [];
                                    const next = e.target.checked ? [...current, group] : current.filter(g => g !== group);
                                    setUserFormData({...userFormData, restrictedGroups: next});
                                  }}
                                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                {group}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {userFormData.role === 'Docente' && (
                    <div className="space-y-4 p-4 bg-blue-50/70 rounded-2xl border border-blue-100">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-black text-blue-700 uppercase flex items-center gap-1.5 tracking-wider">
                            <Users size={13} className="text-blue-600" />
                            Modalidad de Asignación de Grupos
                          </p>
                          <span className="text-[10px] font-bold text-slate-500">
                            {userFormData.teacherGroupAccess === 'multiple' 
                              ? `${(userFormData.restrictedLevels || []).length} niv. • ${(userFormData.restrictedGrades || []).length} gr. • ${(userFormData.restrictedGroups || []).length} grupos`
                              : 'Grupo único'}
                          </span>
                        </div>

                        {/* Selector de Modalidad */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2 rounded-xl border border-blue-200 mb-4">
                          <label className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all",
                            (!userFormData.teacherGroupAccess || userFormData.teacherGroupAccess === 'single')
                              ? "bg-blue-50/80 border-blue-300 shadow-xs"
                              : "border-slate-100 hover:bg-slate-50"
                          )}>
                            <input
                              type="radio"
                              name="teacherGroupAccess"
                              checked={!userFormData.teacherGroupAccess || userFormData.teacherGroupAccess === 'single'}
                              onChange={() => {
                                const defaultLvl = userFormData.restrictedLevels?.[0] || userFormData.assignedLevel || (settings.academicLevels?.[0] || 'Primaria');
                                const defaultGrd = userFormData.restrictedGrades?.[0] || userFormData.assignedGrade || '1ro';
                                const defaultGrp = userFormData.restrictedGroups?.[0] || userFormData.assignedGroup || 'A';
                                setUserFormData({
                                  ...userFormData,
                                  teacherGroupAccess: 'single',
                                  assignedLevel: defaultLvl,
                                  assignedGrade: defaultGrd,
                                  assignedGroup: defaultGrp,
                                  restrictedLevels: [defaultLvl],
                                  restrictedGrades: [defaultGrd],
                                  restrictedGroups: [defaultGrp]
                                });
                              }}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <p className="text-xs font-black text-slate-800">Grupo Único / Titular</p>
                              <p className="text-[10px] text-slate-500">Asignado a 1 solo grupo exclusivo</p>
                            </div>
                          </label>

                          <label className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all",
                            userFormData.teacherGroupAccess === 'multiple'
                              ? "bg-blue-50/80 border-blue-300 shadow-xs"
                              : "border-slate-100 hover:bg-slate-50"
                          )}>
                            <input
                              type="radio"
                              name="teacherGroupAccess"
                              checked={userFormData.teacherGroupAccess === 'multiple'}
                              onChange={() => {
                                const allLvls = settings.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato'];
                                const allGrds = settings.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to'];
                                const allGrps = settings.academicGroups || ['A', 'B', 'C'];
                                setUserFormData({
                                  ...userFormData,
                                  teacherGroupAccess: 'multiple',
                                  restrictedLevels: (userFormData.restrictedLevels && userFormData.restrictedLevels.length > 0) ? userFormData.restrictedLevels : allLvls,
                                  restrictedGrades: (userFormData.restrictedGrades && userFormData.restrictedGrades.length > 0) ? userFormData.restrictedGrades : allGrds,
                                  restrictedGroups: (userFormData.restrictedGroups && userFormData.restrictedGroups.length > 0) ? userFormData.restrictedGroups : allGrps,
                                  assignedLevel: userFormData.assignedLevel || allLvls[0],
                                  assignedGrade: userFormData.assignedGrade || allGrds[0],
                                  assignedGroup: userFormData.assignedGroup || allGrps[0]
                                });
                              }}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <p className="text-xs font-black text-slate-800">Múltiples Grupos / Especialidad</p>
                              <p className="text-[10px] text-slate-500">Música, Arte, Educación Física o varios grupos</p>
                            </div>
                          </label>
                        </div>

                        {/* Single Group Form */}
                        {(!userFormData.teacherGroupAccess || userFormData.teacherGroupAccess === 'single') ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-blue-200">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nivel</label>
                              <select
                                value={userFormData.assignedLevel || ''}
                                onChange={(e) => {
                                  const lvl = e.target.value;
                                  setUserFormData({
                                    ...userFormData,
                                    assignedLevel: lvl,
                                    restrictedLevels: lvl ? [lvl] : []
                                  });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                              >
                                <option value="">Seleccionar Nivel</option>
                                {(settings.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato']).map(level => (
                                  <option key={level} value={level}>{level}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grado</label>
                              <select
                                value={userFormData.assignedGrade || ''}
                                onChange={(e) => {
                                  const grd = e.target.value;
                                  setUserFormData({
                                    ...userFormData,
                                    assignedGrade: grd,
                                    restrictedGrades: grd ? [grd] : []
                                  });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                              >
                                <option value="">Seleccionar Grado</option>
                                {(settings.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to']).map(grade => (
                                  <option key={grade} value={grade}>{grade}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grupo</label>
                              <select
                                value={userFormData.assignedGroup || ''}
                                onChange={(e) => {
                                  const grp = e.target.value;
                                  setUserFormData({
                                    ...userFormData,
                                    assignedGroup: grp,
                                    restrictedGroups: grp ? [grp] : []
                                  });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                              >
                                <option value="">Seleccionar Grupo</option>
                                {(settings.academicGroups || ['A', 'B', 'C']).map(group => (
                                  <option key={group} value={group}>{group}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          /* Multi-Group Checkboxes */
                          <div className="bg-white p-3.5 rounded-xl border border-blue-200 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                              <span className="text-xs font-bold text-slate-700">Selecciona los niveles, grados y grupos asignados:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const allLvls = settings.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato'];
                                  const allGrds = settings.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to'];
                                  const allGrps = settings.academicGroups || ['A', 'B', 'C'];
                                  const newGradeGroups: Record<string, string[]> = {};
                                  allGrds.forEach(g => {
                                    newGradeGroups[g] = allGrps;
                                    allLvls.forEach(l => {
                                      newGradeGroups[`${l}__${g}`] = allGrps;
                                    });
                                  });
                                  setUserFormData({
                                    ...userFormData,
                                    restrictedLevels: allLvls,
                                    restrictedGrades: allGrds,
                                    restrictedGroups: allGrps,
                                    teacherGradeGroups: newGradeGroups,
                                    assignedLevel: allLvls[0],
                                    assignedGrade: allGrds[0],
                                    assignedGroup: allGrps[0]
                                  });
                                }}
                                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                ⚡ Asignar a TODOS los grupos del colegio
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Niveles */}
                              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black text-slate-600 uppercase">Niveles ({userFormData.restrictedLevels?.length || 0})</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const all = settings.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato'];
                                      const isAll = (userFormData.restrictedLevels || []).length === all.length;
                                      setUserFormData({ ...userFormData, restrictedLevels: isAll ? [] : all, assignedLevel: isAll ? '' : all[0] });
                                    }}
                                    className="text-[9px] font-bold text-blue-600 hover:underline"
                                  >
                                    {(userFormData.restrictedLevels || []).length === (settings.academicLevels || []).length ? 'Desmarcar' : 'Todos'}
                                  </button>
                                </div>
                                <div className="space-y-1 max-h-56 overflow-y-auto">
                                  {(settings.academicLevels || ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato']).map(lvl => (
                                    <label key={lvl} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer hover:text-blue-700">
                                      <input
                                        type="checkbox"
                                        checked={(userFormData.restrictedLevels || []).includes(lvl)}
                                        onChange={(e) => {
                                          const current = userFormData.restrictedLevels || [];
                                          const next = e.target.checked ? [...current, lvl] : current.filter(l => l !== lvl);
                                          setUserFormData({ ...userFormData, restrictedLevels: next, assignedLevel: next[0] || '' });
                                        }}
                                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                                      />
                                      {lvl}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Grados */}
                              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black text-slate-600 uppercase">Grados ({userFormData.restrictedGrades?.length || 0})</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const all = settings.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to'];
                                      const isAll = (userFormData.restrictedGrades || []).length === all.length;
                                      const nextGrades = isAll ? [] : all;
                                      const newGradeGroups = { ...(userFormData.teacherGradeGroups || {}) };
                                      if (isAll) {
                                        all.forEach(g => {
                                          delete newGradeGroups[g];
                                          (userFormData.restrictedLevels || []).forEach(l => delete newGradeGroups[`${l}__${g}`]);
                                        });
                                      } else {
                                        const defaultGrps = (userFormData.restrictedGroups && userFormData.restrictedGroups.length > 0)
                                          ? userFormData.restrictedGroups
                                          : (settings.academicGroups || ['A', 'B', 'C']);
                                        all.forEach(g => {
                                          if (!newGradeGroups[g] || newGradeGroups[g].length === 0) {
                                            newGradeGroups[g] = defaultGrps;
                                            (userFormData.restrictedLevels || []).forEach(l => {
                                              newGradeGroups[`${l}__${g}`] = defaultGrps;
                                            });
                                          }
                                        });
                                      }
                                      const unionSet = new Set<string>();
                                      Object.values(newGradeGroups).forEach(arr => {
                                        if (Array.isArray(arr)) arr.forEach(g => unionSet.add(g));
                                      });
                                      const unionArr = Array.from(unionSet);
                                      setUserFormData({ 
                                        ...userFormData, 
                                        restrictedGrades: nextGrades, 
                                        teacherGradeGroups: newGradeGroups,
                                        restrictedGroups: unionArr,
                                        assignedGrade: nextGrades[0] || '',
                                        assignedGroup: unionArr[0] || ''
                                      });
                                    }}
                                    className="text-[9px] font-bold text-blue-600 hover:underline"
                                  >
                                    {(userFormData.restrictedGrades || []).length === (settings.academicGrades || []).length ? 'Desmarcar' : 'Todos'}
                                  </button>
                                </div>
                                <div className="space-y-1 max-h-56 overflow-y-auto">
                                  {(settings.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to']).map(grd => (
                                    <label key={grd} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer hover:text-blue-700">
                                      <input
                                        type="checkbox"
                                        checked={(userFormData.restrictedGrades || []).includes(grd)}
                                        onChange={(e) => {
                                          const current = userFormData.restrictedGrades || [];
                                          const next = e.target.checked ? [...current, grd] : current.filter(g => g !== grd);
                                          const newGradeGroups = { ...(userFormData.teacherGradeGroups || {}) };
                                          if (e.target.checked) {
                                            if (!newGradeGroups[grd] || newGradeGroups[grd].length === 0) {
                                              const defaultGrps = (userFormData.restrictedGroups && userFormData.restrictedGroups.length > 0)
                                                ? userFormData.restrictedGroups
                                                : [settings.academicGroups?.[0] || 'A'];
                                              newGradeGroups[grd] = defaultGrps;
                                              (userFormData.restrictedLevels || []).forEach(l => {
                                                newGradeGroups[`${l}__${grd}`] = defaultGrps;
                                              });
                                            }
                                          } else {
                                            delete newGradeGroups[grd];
                                            (userFormData.restrictedLevels || []).forEach(l => delete newGradeGroups[`${l}__${grd}`]);
                                          }
                                          const unionSet = new Set<string>();
                                          next.forEach(g => {
                                            (newGradeGroups[g] || []).forEach(grp => unionSet.add(grp));
                                          });
                                          const unionArr = Array.from(unionSet);
                                          setUserFormData({ 
                                            ...userFormData, 
                                            restrictedGrades: next, 
                                            teacherGradeGroups: newGradeGroups,
                                            restrictedGroups: unionArr,
                                            assignedGrade: next[0] || '',
                                            assignedGroup: unionArr[0] || ''
                                          });
                                        }}
                                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                                      />
                                      {grd}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Grupos por Grado */}
                              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black text-slate-600 uppercase">Grupos por Grado</label>
                                  {(userFormData.restrictedGrades || []).length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const allGrps = settings.academicGroups || ['A', 'B', 'C'];
                                          const newGradeGroups = { ...(userFormData.teacherGradeGroups || {}) };
                                          (userFormData.restrictedGrades || []).forEach(g => {
                                            newGradeGroups[g] = allGrps;
                                            (userFormData.restrictedLevels || []).forEach(lvl => {
                                              newGradeGroups[`${lvl}__${g}`] = allGrps;
                                            });
                                          });
                                          setUserFormData({
                                            ...userFormData,
                                            teacherGradeGroups: newGradeGroups,
                                            restrictedGroups: allGrps,
                                            assignedGroup: allGrps[0] || ''
                                          });
                                        }}
                                        className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
                                      >
                                        Todos
                                      </button>
                                      <span className="text-slate-300 text-[9px]">•</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newGradeGroups = { ...(userFormData.teacherGradeGroups || {}) };
                                          (userFormData.restrictedGrades || []).forEach(g => {
                                            newGradeGroups[g] = [];
                                            (userFormData.restrictedLevels || []).forEach(lvl => {
                                              newGradeGroups[`${lvl}__${g}`] = [];
                                            });
                                          });
                                          setUserFormData({
                                            ...userFormData,
                                            teacherGradeGroups: newGradeGroups,
                                            restrictedGroups: [],
                                            assignedGroup: ''
                                          });
                                        }}
                                        className="text-[9px] font-bold text-slate-400 hover:text-slate-600 hover:underline cursor-pointer"
                                      >
                                        Ninguno
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                                  {(userFormData.restrictedGrades || []).length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                                      <p className="text-[10px] font-medium leading-tight">
                                        Selecciona al menos un grado en la columna izquierda para configurar sus grupos independientes.
                                      </p>
                                    </div>
                                  ) : (
                                    (userFormData.restrictedGrades || []).map(grd => {
                                      const gg = userFormData.teacherGradeGroups || {};
                                      const currentGroupsForGrade: string[] = Array.isArray(gg[grd])
                                        ? gg[grd]
                                        : (userFormData.restrictedGroups || []);

                                      return (
                                        <div key={grd} className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                              Grado {grd}:
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const allGrps = settings.academicGroups || ['A', 'B', 'C'];
                                                  const newGradeGroups = { ...(userFormData.teacherGradeGroups || {}) };
                                                  newGradeGroups[grd] = allGrps;
                                                  (userFormData.restrictedLevels || []).forEach(lvl => {
                                                    newGradeGroups[`${lvl}__${grd}`] = allGrps;
                                                  });
                                                  const unionSet = new Set<string>();
                                                  (userFormData.restrictedGrades || []).forEach(g => {
                                                    const list = g === grd ? allGrps : (newGradeGroups[g] || (userFormData.restrictedGroups || []));
                                                    list.forEach(item => unionSet.add(item));
                                                  });
                                                  const unionArr = Array.from(unionSet);
                                                  setUserFormData({
                                                    ...userFormData,
                                                    teacherGradeGroups: newGradeGroups,
                                                    restrictedGroups: unionArr,
                                                    assignedGroup: unionArr[0] || ''
                                                  });
                                                }}
                                                className="text-[8px] font-bold text-blue-600 hover:underline"
                                              >
                                                Todos
                                              </button>
                                              <span className="text-slate-300 text-[8px]">•</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newGradeGroups = { ...(userFormData.teacherGradeGroups || {}) };
                                                  newGradeGroups[grd] = [];
                                                  (userFormData.restrictedLevels || []).forEach(lvl => {
                                                    newGradeGroups[`${lvl}__${grd}`] = [];
                                                  });
                                                  const unionSet = new Set<string>();
                                                  (userFormData.restrictedGrades || []).forEach(g => {
                                                    const list = g === grd ? [] : (newGradeGroups[g] || (userFormData.restrictedGroups || []));
                                                    list.forEach(item => unionSet.add(item));
                                                  });
                                                  const unionArr = Array.from(unionSet);
                                                  setUserFormData({
                                                    ...userFormData,
                                                    teacherGradeGroups: newGradeGroups,
                                                    restrictedGroups: unionArr,
                                                    assignedGroup: unionArr[0] || ''
                                                  });
                                                }}
                                                className="text-[8px] font-bold text-slate-400 hover:text-slate-600 hover:underline"
                                              >
                                                Ninguno
                                              </button>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {(settings.academicGroups || ['A', 'B', 'C']).map(grp => {
                                              const isChecked = currentGroupsForGrade.includes(grp);
                                              return (
                                                <button
                                                  key={grp}
                                                  type="button"
                                                  onClick={() => {
                                                    const next = isChecked
                                                      ? currentGroupsForGrade.filter(g => g !== grp)
                                                      : [...currentGroupsForGrade, grp];

                                                    const newGradeGroups = { ...(userFormData.teacherGradeGroups || {}) };
                                                    newGradeGroups[grd] = next;
                                                    (userFormData.restrictedLevels || []).forEach(lvl => {
                                                      newGradeGroups[`${lvl}__${grd}`] = next;
                                                    });

                                                    const unionSet = new Set<string>();
                                                    (userFormData.restrictedGrades || []).forEach(g => {
                                                      const list = g === grd ? next : (newGradeGroups[g] || (userFormData.restrictedGroups || []));
                                                      list.forEach(item => unionSet.add(item));
                                                    });

                                                    const unionArr = Array.from(unionSet);
                                                    setUserFormData({
                                                      ...userFormData,
                                                      teacherGradeGroups: newGradeGroups,
                                                      restrictedGroups: unionArr,
                                                      assignedGroup: unionArr[0] || ''
                                                    });
                                                  }}
                                                  className={cn(
                                                    "px-2.5 py-1 rounded-md text-[10px] font-black transition-all cursor-pointer border flex items-center gap-1",
                                                    isChecked
                                                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                                  )}
                                                >
                                                  {isChecked && <Check size={11} strokeWidth={3} />}
                                                  Grupo {grp}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Resumen de Asignación por Grado */}
                            {(userFormData.restrictedGrades || []).length > 0 && (
                              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase text-slate-500 mr-1">Asignados:</span>
                                {(userFormData.restrictedGrades || []).map(g => {
                                  const grps = (userFormData.teacherGradeGroups?.[g] || userFormData.restrictedGroups || []);
                                  return (
                                    <span key={g} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                                      {g}: {grps.length > 0 ? grps.map(grp => `Grupo ${grp}`).join(', ') : 'Sin grupo'}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Nivel Principal por defecto */}
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Nivel inicial por defecto (al iniciar sesión):</span>
                              <select
                                value={userFormData.assignedLevel || (userFormData.restrictedLevels?.[0] || '')}
                                onChange={(e) => setUserFormData({ ...userFormData, assignedLevel: e.target.value })}
                                className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                              >
                                {(userFormData.restrictedLevels && userFormData.restrictedLevels.length > 0 ? userFormData.restrictedLevels : (settings.academicLevels || [])).map(lvl => (
                                  <option key={lvl} value={lvl}>{lvl}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Límites de Jornada Académica (Docente) */}
                      <div className="border-t border-blue-100/60 pt-3">
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Límites de Jornada Académica (Docente)</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horas Máximas por Día</label>
                            <input
                              type="number"
                              min="1"
                              max="24"
                              placeholder="Sin límite"
                              value={userFormData.maxHoursPerDay || ''}
                              onChange={(e) => setUserFormData({...userFormData, maxHoursPerDay: e.target.value ? Number(e.target.value) : undefined})}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horas Máximas por Semana</label>
                            <input
                              type="number"
                              min="1"
                              max="168"
                              placeholder="Sin límite"
                              value={userFormData.maxHoursPerWeek || ''}
                              onChange={(e) => setUserFormData({...userFormData, maxHoursPerWeek: e.target.value ? Number(e.target.value) : undefined})}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Acceso a Materias / Calificaciones */}
                      <div className="md:col-span-3 mt-2 border-t border-blue-100/60 pt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-1.5">
                            <BookOpen size={13} className="text-blue-600" />
                            Acceso a Materias y Calificaciones
                          </p>
                          {userFormData.teacherSubjectAccess === 'specific' && (
                            <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              {(userFormData.assignedSubjects || []).length} materias seleccionadas
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-blue-200">
                          <label className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all",
                            (!userFormData.teacherSubjectAccess || userFormData.teacherSubjectAccess === 'all')
                              ? "bg-blue-50 border-blue-300 text-blue-950 font-bold"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}>
                            <input
                              type="radio"
                              name="teacherSubjectAccess"
                              value="all"
                              checked={!userFormData.teacherSubjectAccess || userFormData.teacherSubjectAccess === 'all'}
                              onChange={() => setUserFormData({...userFormData, teacherSubjectAccess: 'all'})}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <p className="text-xs font-bold leading-tight">Todas las materias del grupo</p>
                              <p className="text-[9px] text-slate-400 font-normal">Docente titular / califica todas las materias</p>
                            </div>
                          </label>

                          <label className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all",
                            userFormData.teacherSubjectAccess === 'specific'
                              ? "bg-blue-50 border-blue-300 text-blue-950 font-bold"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}>
                            <input
                              type="radio"
                              name="teacherSubjectAccess"
                              value="specific"
                              checked={userFormData.teacherSubjectAccess === 'specific'}
                              onChange={() => setUserFormData({...userFormData, teacherSubjectAccess: 'specific'})}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <p className="text-xs font-bold leading-tight">Materias específicas / Talleres</p>
                              <p className="text-[9px] text-slate-400 font-normal">Solo califica música, artes, deportes, etc.</p>
                            </div>
                          </label>
                        </div>

                        {userFormData.teacherSubjectAccess === 'specific' && (() => {
                          const allowedLevels = userFormData.teacherGroupAccess === 'multiple' && (userFormData.restrictedLevels || []).length > 0
                            ? userFormData.restrictedLevels
                            : (userFormData.assignedLevel ? [userFormData.assignedLevel] : []);

                          const allKnownLevels = (settings.academicLevels && settings.academicLevels.length > 0)
                            ? settings.academicLevels
                            : ['Preescolar', 'Primaria', 'Secundaria', 'Preparatoria'];

                          const configuredLevels = allowedLevels.length > 0
                            ? allowedLevels
                            : allKnownLevels;

                          // Include any distinct levels from registered subjects if allowedLevels is empty
                          const distinctSubjectLevels = Array.from(new Set(subjects.map(s => s.level).filter(Boolean)));
                          const levelsList: string[] = Array.from(new Set([
                            ...configuredLevels,
                            ...(allowedLevels.length === 0 ? distinctSubjectLevels : [])
                          ]));

                          // Check if there are subjects without level
                          const hasSubjectsWithoutLevel = subjects.some(s => !s.level);
                          if (hasSubjectsWithoutLevel && allowedLevels.length === 0) {
                            levelsList.push('General / Sin nivel');
                          }

                          const lvlMatches = (subjLevel?: string, targetLevel?: string) => {
                            if (targetLevel === 'General / Sin nivel') return !subjLevel;
                            return (subjLevel || '').trim().toLowerCase() === (targetLevel || '').trim().toLowerCase();
                          };

                          const isSubjectSelected = (subj: Subject) => {
                            const subjKey = `${subj.name}__${subj.level}`.toLowerCase().trim();
                            const normName = subj.name.toLowerCase().trim();
                            const list = userFormData.assignedSubjects || [];
                            return list.some(x => {
                              if (x === subj.id) return true;
                              const normX = x.toLowerCase().trim();
                              if (normX === subjKey) return true;
                              if (normX === normName) return true;
                              return false;
                            });
                          };

                          const totalAvailableCount = levelsList.reduce((acc, lvl) => {
                            const rawLvlSubjs = subjects.filter(s => lvlMatches(s.level, lvl));
                            const seen = new Set<string>();
                            return acc + rawLvlSubjs.filter(s => {
                              const norm = s.name.toLowerCase().trim();
                              if (seen.has(norm)) return false;
                              seen.add(norm);
                              return true;
                            }).length;
                          }, 0);

                          const totalSelectedCount = subjects.filter(s => 
                            levelsList.some(lvl => lvlMatches(s.level, lvl)) && isSubjectSelected(s)
                          ).length;

                          const handleToggleSubject = (subj: Subject, checked: boolean) => {
                            const current = userFormData.assignedSubjects || [];
                            const subjKey = `${subj.name}__${subj.level}`;
                            const normName = subj.name.toLowerCase().trim();
                            const normKey = subjKey.toLowerCase().trim();

                            let next: string[];
                            if (checked) {
                              next = Array.from(new Set([...current, subj.id, subjKey]));
                            } else {
                              next = current.filter(x => {
                                if (x === subj.id) return false;
                                const normX = x.toLowerCase().trim();
                                if (normX === normKey) return false;
                                if (normX === normName) return false;
                                return true;
                              });
                            }

                            const newGrades = { ...(userFormData.teacherSubjectGrades || {}) };
                            const newGroups = { ...(userFormData.teacherSubjectGroups || {}) };

                            if (!checked) {
                              delete newGrades[subjKey];
                              delete newGrades[subj.name];
                              delete newGrades[subj.id];
                              delete newGroups[subjKey];
                              delete newGroups[subj.name];
                              delete newGroups[subj.id];
                              Object.keys(newGroups).forEach(k => {
                                if (k.startsWith(`${subjKey}__`) || k.startsWith(`${subj.name}__`) || k.startsWith(`${subj.id}__`)) {
                                  delete newGroups[k];
                                }
                              });
                            }

                            setUserFormData({
                              ...userFormData,
                              assignedSubjects: next,
                              teacherSubjectGrades: newGrades,
                              teacherSubjectGroups: newGroups
                            });
                          };

                          const handleSelectAllInLevel = (lvl: string) => {
                            const rawLvlSubjs = subjects.filter(s => lvlMatches(s.level, lvl));
                            const current = userFormData.assignedSubjects || [];
                            const additions: string[] = [];
                            rawLvlSubjs.forEach(s => {
                              additions.push(s.id, `${s.name}__${s.level}`);
                            });
                            setUserFormData({
                              ...userFormData,
                              assignedSubjects: Array.from(new Set([...current, ...additions]))
                            });
                          };

                          const handleClearLevel = (lvl: string) => {
                            const rawLvlSubjs = subjects.filter(s => lvlMatches(s.level, lvl));
                            const lvlIds = new Set(rawLvlSubjs.map(s => s.id));
                            const lvlKeys = new Set(rawLvlSubjs.map(s => `${s.name}__${s.level}`.toLowerCase().trim()));
                            const lvlNames = new Set(rawLvlSubjs.map(s => s.name.toLowerCase().trim()));
                            const current = userFormData.assignedSubjects || [];

                            const next = current.filter(x => {
                              if (lvlIds.has(x)) return false;
                              const normX = x.toLowerCase().trim();
                              if (lvlKeys.has(normX)) return false;
                              if (lvlNames.has(normX)) return false;
                              return true;
                            });

                            const newGrades = { ...(userFormData.teacherSubjectGrades || {}) };
                            const newGroups = { ...(userFormData.teacherSubjectGroups || {}) };
                            rawLvlSubjs.forEach(s => {
                              const subjKey = `${s.name}__${s.level}`;
                              delete newGrades[subjKey];
                              delete newGrades[s.name];
                              delete newGrades[s.id];
                              delete newGroups[subjKey];
                              delete newGroups[s.name];
                              delete newGroups[s.id];
                              Object.keys(newGroups).forEach(k => {
                                if (k.startsWith(`${subjKey}__`) || k.startsWith(`${s.name}__`) || k.startsWith(`${s.id}__`)) {
                                  delete newGroups[k];
                                }
                              });
                            });

                            setUserFormData({
                              ...userFormData,
                              assignedSubjects: next,
                              teacherSubjectGrades: newGrades,
                              teacherSubjectGroups: newGroups
                            });
                          };

                          const handleExpandAll = (expand: boolean) => {
                            const map: Record<string, boolean> = {};
                            levelsList.forEach(l => { map[l] = expand; });
                            setExpandedSubjectLevels(map);
                          };

                          return (
                            <div className="bg-white rounded-xl border border-blue-200 shadow-xs overflow-hidden space-y-0">
                              {/* Header Bar */}
                              <div className="p-3.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white border-b border-blue-200/80 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                                    <Layers size={17} />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                                      Materias por Nivel Educativo
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                        {totalSelectedCount} de {totalAvailableCount} seleccionadas
                                      </span>
                                    </h4>
                                    <p className="text-[10px] text-slate-500">
                                      {allowedLevels.length > 0 
                                        ? `Niveles asignados al docente: ${allowedLevels.join(', ')}`
                                        : 'Organizadas por cada nivel para evitar confusiones entre grados y materias'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => handleExpandAll(true)}
                                    className="px-2 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Desplegar todos
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleExpandAll(false)}
                                    className="px-2 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Colapsar todos
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allAdditions: string[] = [];
                                      subjects.forEach(s => {
                                        if (levelsList.some(lvl => lvlMatches(s.level, lvl))) {
                                          allAdditions.push(s.id, `${s.name}__${s.level}`);
                                        }
                                      });
                                      setUserFormData({ ...userFormData, assignedSubjects: Array.from(new Set(allAdditions)) });
                                    }}
                                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                  >
                                    Marcar todas
                                  </button>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => setUserFormData({ ...userFormData, assignedSubjects: [], teacherSubjectGrades: {}, teacherSubjectGroups: {} })}
                                    className="text-slate-500 hover:text-slate-700 underline cursor-pointer"
                                  >
                                    Limpiar
                                  </button>
                                </div>
                              </div>

                              {/* Table / List of Levels */}
                              <div className="divide-y divide-slate-200">
                                {levelsList.map((lvl) => {
                                  const rawLvlSubjs = subjects.filter(s => lvlMatches(s.level, lvl));
                                  // Deduplicate subjects within this level by normalized name so no duplicates appear
                                  const seenLvlNames = new Set<string>();
                                  const lvlSubjs = rawLvlSubjs.filter(s => {
                                    const norm = s.name.toLowerCase().trim();
                                    if (seenLvlNames.has(norm)) return false;
                                    seenLvlNames.add(norm);
                                    return true;
                                  });
                                  const selectedInLvl = lvlSubjs.filter(s => isSubjectSelected(s));
                                  const selectedCount = selectedInLvl.length;
                                  const isExpanded = expandedSubjectLevels[lvl] !== undefined
                                    ? expandedSubjectLevels[lvl]
                                    : (levelsList.length === 1 || selectedCount > 0);

                                  const lvlLower = lvl.toLowerCase();
                                  const defaultLevelGrades = lvlLower.includes('preescolar') || lvlLower.includes('secundaria')
                                    ? ['1ro', '2do', '3ro']
                                    : (settings.academicGrades || ['1ro', '2do', '3ro', '4to', '5to', '6to']);
                                  const finalGrades = (userFormData.restrictedGrades && userFormData.restrictedGrades.length > 0)
                                    ? defaultLevelGrades.filter(g => userFormData.restrictedGrades?.includes(g))
                                    : defaultLevelGrades;
                                  const effectiveGrades = finalGrades.length > 0 ? finalGrades : defaultLevelGrades;

                                  const defaultLevelGroups = (userFormData.restrictedGroups && userFormData.restrictedGroups.length > 0)
                                    ? userFormData.restrictedGroups
                                    : (settings.academicGroups && settings.academicGroups.length > 0)
                                      ? settings.academicGroups
                                      : ['A', 'B', 'C'];

                                  return (
                                    <div key={lvl} className="transition-all">
                                      {/* Level Row Header (Clickable Table Row) */}
                                      <div 
                                        onClick={() => {
                                          setExpandedSubjectLevels(prev => ({
                                            ...prev,
                                            [lvl]: !isExpanded
                                          }));
                                        }}
                                        className={cn(
                                          "p-3 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors",
                                          isExpanded ? "bg-slate-50/90 border-b border-slate-200/60" : "bg-white hover:bg-slate-50/60"
                                        )}
                                      >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                          <div className={cn(
                                            "w-6 h-6 rounded-md flex items-center justify-center transition-transform",
                                            isExpanded ? "rotate-180 bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                                          )}>
                                            <ChevronDown size={14} />
                                          </div>

                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-xs font-black text-slate-800 tracking-wide">
                                                {lvl}
                                              </span>
                                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                {lvlSubjs.length} {lvlSubjs.length === 1 ? 'materia' : 'materias'}
                                              </span>
                                              {selectedCount > 0 ? (
                                                <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                  ✓ {selectedCount} asignada{selectedCount > 1 ? 's' : ''}
                                                </span>
                                              ) : (
                                                <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-slate-100 text-slate-400">
                                                  0 asignadas
                                                </span>
                                              )}
                                            </div>

                                            {/* Preview tags of selected subjects in this level */}
                                            {selectedCount > 0 && !isExpanded && (
                                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {selectedInLvl.slice(0, 4).map(s => {
                                                  const subjKey = `${s.name}__${s.level}`;
                                                  const grades = userFormData.teacherSubjectGrades?.[subjKey] 
                                                    || userFormData.teacherSubjectGrades?.[s.name];
                                                  const hasSpecificGrades = grades && grades.length > 0 && !grades.includes('all');
                                                  
                                                  const perGradeSummary: string[] = [];
                                                  if (hasSpecificGrades) {
                                                    grades!.forEach(grd => {
                                                      const gGrp = userFormData.teacherSubjectGroups?.[`${subjKey}__${grd}`]
                                                        || userFormData.teacherSubjectGroups?.[`${s.name}__${grd}`]
                                                        || userFormData.teacherSubjectGroups?.[`${s.id}__${grd}`];
                                                      if (gGrp && gGrp.length > 0 && !gGrp.includes('all')) {
                                                        perGradeSummary.push(`${grd}: ${gGrp.join(',')}`);
                                                      }
                                                    });
                                                  }

                                                  const groups = userFormData.teacherSubjectGroups?.[subjKey] 
                                                    || userFormData.teacherSubjectGroups?.[s.name];
                                                  const hasSpecificGroups = groups && groups.length > 0 && !groups.includes('all');
                                                  return (
                                                    <span key={s.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800">
                                                      {s.name}
                                                      {perGradeSummary.length > 0 ? (
                                                        ` [${perGradeSummary.join(' | ')}]`
                                                      ) : (
                                                        <>
                                                          {hasSpecificGrades ? ` (${grades!.join(',')})` : ''}
                                                          {hasSpecificGroups ? ` [Grp: ${groups!.join(',')}]` : ''}
                                                        </>
                                                      )}
                                                    </span>
                                                  );
                                                })}
                                                {selectedCount > 4 && (
                                                  <span className="text-[9px] text-slate-400 font-bold">
                                                    +{selectedCount - 4} más...
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Actions for this level */}
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={() => handleSelectAllInLevel(lvl)}
                                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold px-2 py-1 rounded bg-blue-50/70 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                                            title={`Seleccionar todas las materias de ${lvl}`}
                                          >
                                            + Todas
                                          </button>
                                          {selectedCount > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => handleClearLevel(lvl)}
                                              className="text-[10px] text-slate-500 hover:text-red-600 font-bold px-2 py-1 rounded bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                                              title={`Desmarcar materias de ${lvl}`}
                                            >
                                              Limpiar
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExpandedSubjectLevels(prev => ({
                                                ...prev,
                                                [lvl]: !isExpanded
                                              }));
                                            }}
                                            className="text-[10px] font-bold text-slate-600 hover:text-slate-800 px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                                          >
                                            {isExpanded ? 'Ocultar' : 'Ver materias'}
                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Unfolded Level Panel (se desprenden las materias) */}
                                      {isExpanded && (
                                        <div className="p-3 bg-slate-50/50 space-y-2.5">
                                          {lvlSubjs.length === 0 ? (
                                            <p className="text-xs text-amber-600 italic py-2 px-2 bg-amber-50 rounded-lg border border-amber-200">
                                              No hay materias registradas para el nivel <strong>{lvl}</strong>. Puedes agregarlas en la pestaña de Materias.
                                            </p>
                                          ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                              {lvlSubjs.map(subj => {
                                                const isSelected = isSubjectSelected(subj);
                                                const cat = subj.category || 'Académica';
                                                const isAutonomy = cat === 'Autonomía Curricular';
                                                const isDP = cat === 'Desarrollo Personal' || cat === 'Aspectos Formativos';
                                                const subjKey = `${subj.name}__${subj.level}`;
                                                const currentGrades = userFormData.teacherSubjectGrades?.[subjKey] 
                                                  || userFormData.teacherSubjectGrades?.[subj.name] 
                                                  || ['all'];
                                                const isAllGrades = currentGrades.includes('all') || currentGrades.length === 0;
                                                const activeSubjectGrades = isAllGrades ? effectiveGrades : currentGrades;
                                                const isPerGradeGroups = !isAllGrades || !!customGradeGroupSubjs[subjKey];

                                                // Helper to get groups for a specific grade
                                                const getGradeGroups = (grd: string) => {
                                                  const specific = userFormData.teacherSubjectGroups?.[`${subjKey}__${grd}`]
                                                    || userFormData.teacherSubjectGroups?.[`${subj.name}__${grd}`]
                                                    || userFormData.teacherSubjectGroups?.[`${subj.id}__${grd}`];
                                                  if (specific && specific.length > 0) return specific;
                                                  const general = userFormData.teacherSubjectGroups?.[subjKey]
                                                    || userFormData.teacherSubjectGroups?.[subj.name]
                                                    || userFormData.teacherSubjectGroups?.[subj.id];
                                                  return (general && general.length > 0) ? general : ['all'];
                                                };

                                                const handleSetGradeGroups = (grd: string, groups: string[]) => {
                                                  const newGroups = { ...(userFormData.teacherSubjectGroups || {}) };
                                                  newGroups[`${subjKey}__${grd}`] = groups;
                                                  newGroups[`${subj.name}__${grd}`] = groups;
                                                  newGroups[`${subj.id}__${grd}`] = groups;

                                                  // Recompute general summary union for this subject across activeSubjectGrades
                                                  const unionSet = new Set<string>();
                                                  let hasAnyAll = false;
                                                  activeSubjectGrades.forEach(g => {
                                                    const gList = (g === grd) ? groups : getGradeGroups(g);
                                                    if (gList.includes('all') || gList.length === 0) {
                                                      hasAnyAll = true;
                                                    } else {
                                                      gList.forEach(item => unionSet.add(item));
                                                    }
                                                  });

                                                  const unionArr = hasAnyAll ? ['all'] : (unionSet.size > 0 ? Array.from(unionSet) : ['all']);
                                                  newGroups[subjKey] = unionArr;
                                                  newGroups[subj.name] = unionArr;
                                                  newGroups[subj.id] = unionArr;

                                                  setUserFormData({ ...userFormData, teacherSubjectGroups: newGroups });
                                                };

                                                const handleToggleGradeGroup = (grd: string, grp: string) => {
                                                  const currentGrdGroups = getGradeGroups(grd);
                                                  const isGrdAll = currentGrdGroups.includes('all') || currentGrdGroups.length === 0;
                                                  let nextGrdGroups: string[];
                                                  if (isGrdAll) {
                                                    nextGrdGroups = [grp];
                                                  } else if (currentGrdGroups.includes(grp)) {
                                                    nextGrdGroups = currentGrdGroups.filter(g => g !== grp);
                                                    if (nextGrdGroups.length === 0) nextGrdGroups = ['all'];
                                                  } else {
                                                    nextGrdGroups = [...currentGrdGroups, grp];
                                                    if (defaultLevelGroups.every(g => nextGrdGroups.includes(g))) {
                                                      nextGrdGroups = ['all'];
                                                    }
                                                  }
                                                  handleSetGradeGroups(grd, nextGrdGroups);
                                                };

                                                const handleApplyGroupToAllActiveGrades = (grpOrAll: string) => {
                                                  const newGroups = { ...(userFormData.teacherSubjectGroups || {}) };
                                                  const targetVal = [grpOrAll];
                                                  newGroups[subjKey] = targetVal;
                                                  newGroups[subj.name] = targetVal;
                                                  newGroups[subj.id] = targetVal;

                                                  activeSubjectGrades.forEach(g => {
                                                    newGroups[`${subjKey}__${g}`] = targetVal;
                                                    newGroups[`${subj.name}__${g}`] = targetVal;
                                                    newGroups[`${subj.id}__${g}`] = targetVal;
                                                  });

                                                  setUserFormData({ ...userFormData, teacherSubjectGroups: newGroups });
                                                };

                                                // General groups (used when not configuring per grade)
                                                const currentGeneralGroups = userFormData.teacherSubjectGroups?.[subjKey] 
                                                  || userFormData.teacherSubjectGroups?.[subj.name] 
                                                  || userFormData.teacherSubjectGroups?.[subj.id]
                                                  || ['all'];
                                                const isAllGeneralGroups = currentGeneralGroups.includes('all') || currentGeneralGroups.length === 0;

                                                const handleToggleGeneralGroup = (grp: string) => {
                                                  let nextGroups: string[];
                                                  if (isAllGeneralGroups) {
                                                    nextGroups = [grp];
                                                  } else if (currentGeneralGroups.includes(grp)) {
                                                    nextGroups = currentGeneralGroups.filter(g => g !== grp);
                                                    if (nextGroups.length === 0) nextGroups = ['all'];
                                                  } else {
                                                    nextGroups = [...currentGeneralGroups, grp];
                                                    if (defaultLevelGroups.every(g => nextGroups.includes(g))) {
                                                      nextGroups = ['all'];
                                                    }
                                                  }

                                                  const newGroups = { ...(userFormData.teacherSubjectGroups || {}) };
                                                  newGroups[subjKey] = nextGroups;
                                                  newGroups[subj.name] = nextGroups;
                                                  newGroups[subj.id] = nextGroups;

                                                  // Clear grade overrides so general applies to all
                                                  Object.keys(newGroups).forEach(k => {
                                                    if (k.startsWith(`${subjKey}__`) || k.startsWith(`${subj.name}__`) || k.startsWith(`${subj.id}__`)) {
                                                      delete newGroups[k];
                                                    }
                                                  });

                                                  setUserFormData({ ...userFormData, teacherSubjectGroups: newGroups });
                                                };

                                                const handleSetAllGeneralGroups = () => {
                                                  const newGroups = { ...(userFormData.teacherSubjectGroups || {}) };
                                                  newGroups[subjKey] = ['all'];
                                                  newGroups[subj.name] = ['all'];
                                                  newGroups[subj.id] = ['all'];

                                                  Object.keys(newGroups).forEach(k => {
                                                    if (k.startsWith(`${subjKey}__`) || k.startsWith(`${subj.name}__`) || k.startsWith(`${subj.id}__`)) {
                                                      delete newGroups[k];
                                                    }
                                                  });

                                                  setUserFormData({ ...userFormData, teacherSubjectGroups: newGroups });
                                                };

                                                return (
                                                  <div 
                                                    key={subj.id}
                                                    className={cn(
                                                      "p-2.5 rounded-xl border text-xs transition-all flex flex-col justify-between gap-2 shadow-2xs",
                                                      isSelected 
                                                        ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-200" 
                                                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                                                    )}
                                                  >
                                                    <div className="flex items-start gap-2">
                                                      <input
                                                        type="checkbox"
                                                        id={`subj_${subj.id}`}
                                                        checked={isSelected}
                                                        onChange={(e) => handleToggleSubject(subj, e.target.checked)}
                                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                                                      />
                                                      <div className="min-w-0 flex-1">
                                                        <label htmlFor={`subj_${subj.id}`} className="font-bold text-slate-800 leading-tight block cursor-pointer">
                                                          {subj.name}
                                                        </label>
                                                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                          <span className={cn(
                                                            "text-[8px] font-bold px-1 rounded inline-block",
                                                            isAutonomy ? "bg-amber-100 text-amber-800" :
                                                            isDP ? "bg-indigo-100 text-indigo-800" :
                                                            "bg-blue-100 text-blue-800"
                                                          )}>
                                                            {cat}
                                                          </span>
                                                          <span className="text-[8px] font-bold px-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                            {lvl}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Grade and Group assignment selector per subject */}
                                                    {isSelected && (
                                                      <div className="pt-2 border-t border-indigo-200/60 space-y-2 bg-white/80 p-1.5 rounded-lg">
                                                        {/* Grados */}
                                                        <div className="space-y-1">
                                                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                                            <span>Grados en {lvl}:</span>
                                                            <span className="text-indigo-700 font-black">
                                                              {isAllGrades ? 'Todos los grados' : currentGrades.join(', ')}
                                                            </span>
                                                          </div>
                                                          <div className="flex flex-wrap items-center gap-1">
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                const newMap = { ...(userFormData.teacherSubjectGrades || {}) };
                                                                newMap[subjKey] = ['all'];
                                                                newMap[subj.name] = ['all'];
                                                                newMap[subj.id] = ['all'];
                                                                setUserFormData({ ...userFormData, teacherSubjectGrades: newMap });
                                                              }}
                                                              className={cn(
                                                                "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                                                isAllGrades
                                                                  ? "bg-indigo-600 text-white shadow-xs"
                                                                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                              )}
                                                            >
                                                              Todos
                                                            </button>
                                                            {effectiveGrades.map(grd => {
                                                              const isGradeActive = !isAllGrades && currentGrades.includes(grd);
                                                              return (
                                                                <button
                                                                  key={grd}
                                                                  type="button"
                                                                  onClick={() => {
                                                                    const newMap = { ...(userFormData.teacherSubjectGrades || {}) };
                                                                    let nextGrades: string[];
                                                                    if (isAllGrades) {
                                                                      nextGrades = [grd];
                                                                    } else if (currentGrades.includes(grd)) {
                                                                      nextGrades = currentGrades.filter(g => g !== grd);
                                                                      if (nextGrades.length === 0) nextGrades = ['all'];
                                                                    } else {
                                                                      nextGrades = [...currentGrades, grd];
                                                                    }
                                                                    newMap[subjKey] = nextGrades;
                                                                    newMap[subj.name] = nextGrades;
                                                                    newMap[subj.id] = nextGrades;

                                                                    // Clean up groups for any grades that were removed
                                                                    const newGroups = { ...(userFormData.teacherSubjectGroups || {}) };
                                                                    if (!nextGrades.includes('all')) {
                                                                      effectiveGrades.forEach(g => {
                                                                        if (!nextGrades.includes(g)) {
                                                                          delete newGroups[`${subjKey}__${g}`];
                                                                          delete newGroups[`${subj.name}__${g}`];
                                                                          delete newGroups[`${subj.id}__${g}`];
                                                                        }
                                                                      });
                                                                    }

                                                                    setUserFormData({ 
                                                                      ...userFormData, 
                                                                      teacherSubjectGrades: newMap,
                                                                      teacherSubjectGroups: newGroups
                                                                    });
                                                                  }}
                                                                  className={cn(
                                                                    "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer",
                                                                    isGradeActive
                                                                      ? "bg-indigo-600 text-white font-black shadow-xs"
                                                                      : isAllGrades
                                                                        ? "bg-indigo-100 text-indigo-900 border border-indigo-200 hover:bg-indigo-200"
                                                                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                                  )}
                                                                >
                                                                  {grd}
                                                                </button>
                                                              );
                                                            })}
                                                          </div>
                                                        </div>

                                                        {/* Grupos selector: por cada grado específico o general */}
                                                        <div className="pt-2 border-t border-indigo-200/60 space-y-2">
                                                          {isPerGradeGroups ? (
                                                            <div className="space-y-1.5">
                                                              <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                                                <span className="text-slate-700 font-extrabold flex items-center gap-1">
                                                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                                                                  Grupos asignados por grado:
                                                                </span>
                                                                {activeSubjectGrades.length > 1 && (
                                                                  <div className="flex items-center gap-1 text-[8px] text-slate-400">
                                                                    <span>Copiar a todos:</span>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => handleApplyGroupToAllActiveGrades('all')}
                                                                      className="px-1 py-0.2 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold cursor-pointer"
                                                                    >
                                                                      Todos
                                                                    </button>
                                                                    {defaultLevelGroups.map(g => (
                                                                      <button
                                                                        key={g}
                                                                        type="button"
                                                                        onClick={() => handleApplyGroupToAllActiveGrades(g)}
                                                                        className="px-1 py-0.2 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold cursor-pointer"
                                                                      >
                                                                        {g}
                                                                      </button>
                                                                    ))}
                                                                  </div>
                                                                )}
                                                              </div>

                                                              <div className="space-y-1.5">
                                                                {activeSubjectGrades.map(grd => {
                                                                  const grdGroups = getGradeGroups(grd);
                                                                  const isGrdAll = grdGroups.includes('all') || grdGroups.length === 0;

                                                                  return (
                                                                    <div 
                                                                      key={grd} 
                                                                      className="p-1.5 rounded-lg bg-slate-50/90 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                                                    >
                                                                      <div className="flex items-center gap-1.5 min-w-0">
                                                                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-black text-[9px] shadow-2xs">
                                                                          {grd}
                                                                        </span>
                                                                        <span className="text-[9px] text-blue-700 font-bold truncate">
                                                                          {isGrdAll ? 'Todos los grupos' : grdGroups.map(g => `Grupo ${g}`).join(', ')}
                                                                        </span>
                                                                      </div>

                                                                      <div className="flex flex-wrap items-center gap-1">
                                                                        <button
                                                                          type="button"
                                                                          onClick={() => handleSetGradeGroups(grd, ['all'])}
                                                                          className={cn(
                                                                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                                                            isGrdAll
                                                                              ? "bg-blue-600 text-white shadow-xs"
                                                                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                                          )}
                                                                        >
                                                                          Todos
                                                                        </button>
                                                                        {defaultLevelGroups.map(grp => {
                                                                          const isGroupActive = !isGrdAll && grdGroups.includes(grp);
                                                                          return (
                                                                            <button
                                                                              key={grp}
                                                                              type="button"
                                                                              onClick={() => handleToggleGradeGroup(grd, grp)}
                                                                              className={cn(
                                                                                "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer",
                                                                                isGroupActive
                                                                                  ? "bg-blue-600 text-white font-black shadow-xs"
                                                                                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                                              )}
                                                                            >
                                                                              Grupo {grp}
                                                                            </button>
                                                                          );
                                                                        })}
                                                                      </div>
                                                                    </div>
                                                                  );
                                                                })}
                                                              </div>

                                                              {isAllGrades && (
                                                                <div className="pt-1 flex justify-end">
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => setCustomGradeGroupSubjs(prev => ({ ...prev, [subjKey]: false }))}
                                                                    className="text-[8px] text-slate-400 hover:text-indigo-600 font-bold underline cursor-pointer"
                                                                  >
                                                                    ← Volver a grupos generales para todos los grados
                                                                  </button>
                                                                </div>
                                                              )}
                                                            </div>
                                                          ) : (
                                                            <div className="space-y-1">
                                                              <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                                                <span>Grupos en {lvl} (todos los grados):</span>
                                                                <span className="text-blue-700 font-black">
                                                                  {isAllGeneralGroups ? 'Todos los grupos' : currentGeneralGroups.map(g => `Grupo ${g}`).join(', ')}
                                                                </span>
                                                              </div>
                                                              <div className="flex flex-wrap items-center gap-1">
                                                                <button
                                                                  type="button"
                                                                  onClick={handleSetAllGeneralGroups}
                                                                  className={cn(
                                                                    "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                                                    isAllGeneralGroups
                                                                      ? "bg-blue-600 text-white shadow-xs"
                                                                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                                  )}
                                                                >
                                                                  Todos
                                                                </button>
                                                                {defaultLevelGroups.map(grp => {
                                                                  const isGroupActive = !isAllGeneralGroups && currentGeneralGroups.includes(grp);
                                                                  return (
                                                                    <button
                                                                      key={grp}
                                                                      type="button"
                                                                      onClick={() => handleToggleGeneralGroup(grp)}
                                                                      className={cn(
                                                                        "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer",
                                                                        isGroupActive
                                                                          ? "bg-blue-600 text-white font-black shadow-xs"
                                                                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                                      )}
                                                                    >
                                                                      Grupo {grp}
                                                                    </button>
                                                                  );
                                                                })}
                                                              </div>

                                                              <div className="pt-1 flex justify-end">
                                                                <button
                                                                  type="button"
                                                                  onClick={() => setCustomGradeGroupSubjs(prev => ({ ...prev, [subjKey]: true }))}
                                                                  className="text-[8px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                                                                >
                                                                  Personalizar grupos por cada grado →
                                                                </button>
                                                              </div>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Lock size={14} /> Permisos Personalizados
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Dashboard & Students */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Dashboard y Alumnos</p>
                        <PermissionToggle 
                          label="Ver Dashboard" 
                          checked={userFormData.permissions?.dashboard?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, dashboard: {...userFormData.permissions?.dashboard, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Ver Alumnos" 
                          checked={userFormData.permissions?.students?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, students: {...userFormData.permissions?.students, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Crear Alumnos" 
                          checked={userFormData.permissions?.students?.create} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, students: {...userFormData.permissions?.students, create: v}}})}
                        />
                        <PermissionToggle 
                          label="Editar Alumnos" 
                          checked={userFormData.permissions?.students?.edit} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, students: {...userFormData.permissions?.students, edit: v}}})}
                        />
                        <PermissionToggle 
                          label="Eliminar Alumnos" 
                          checked={userFormData.permissions?.students?.delete} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, students: {...userFormData.permissions?.students, delete: v}}})}
                        />
                      </div>

                      {/* Expenses & Settings */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Gastos y Ajustes</p>
                        <PermissionToggle 
                          label="Ver Gastos" 
                          checked={userFormData.permissions?.expenses?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, expenses: {...userFormData.permissions?.expenses, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Registrar Gastos" 
                          checked={userFormData.permissions?.expenses?.create} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, expenses: {...userFormData.permissions?.expenses, create: v}}})}
                        />
                        <PermissionToggle 
                          label="Ver Pagos" 
                          checked={userFormData.permissions?.payments?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, payments: {...userFormData.permissions?.payments, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Registrar Pagos" 
                          checked={userFormData.permissions?.payments?.create} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, payments: {...userFormData.permissions?.payments, create: v}}})}
                        />
                        <PermissionToggle 
                          label="Facturar" 
                          checked={userFormData.permissions?.payments?.invoice} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, payments: {...userFormData.permissions?.payments, invoice: v}}})}
                        />
                        <PermissionToggle 
                          label="Ver Ajustes" 
                          checked={userFormData.permissions?.settings?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, settings: {...userFormData.permissions?.settings, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Gestionar Usuarios" 
                          checked={userFormData.permissions?.settings?.manageUsers} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, settings: {...userFormData.permissions?.settings, manageUsers: v}}})}
                        />
                        <PermissionToggle 
                          label="Editar Ciclos/Reglas" 
                          checked={userFormData.permissions?.settings?.editCycles} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, settings: {...userFormData.permissions?.settings, editCycles: v, editRules: v}}})}
                        />
                        <PermissionToggle 
                          label="Editar Datos Generales" 
                          checked={userFormData.permissions?.settings?.editGeneral} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, settings: {...userFormData.permissions?.settings, editGeneral: v}}})}
                        />
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-4">Anuncios y Control Escolar</p>
                        <PermissionToggle 
                          label="Ver Anuncios" 
                          checked={userFormData.permissions?.announcements?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, announcements: {...userFormData.permissions?.announcements, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Gestionar Anuncios" 
                          checked={userFormData.permissions?.announcements?.manage} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, announcements: {...userFormData.permissions?.announcements, manage: v}}})}
                        />
                        <PermissionToggle 
                          label="Ver Control Escolar" 
                          checked={userFormData.permissions?.controlEscolar?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, controlEscolar: {...userFormData.permissions?.controlEscolar, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Gestionar Inscripciones" 
                          checked={userFormData.permissions?.controlEscolar?.manage} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, controlEscolar: {...userFormData.permissions?.controlEscolar, manage: v}}})}
                        />
                        <PermissionToggle 
                          label="Ver Calificaciones" 
                          checked={userFormData.permissions?.grading?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, grading: {...userFormData.permissions?.grading, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Gestionar Calificaciones" 
                          checked={userFormData.permissions?.grading?.manage} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, grading: {...userFormData.permissions?.grading, manage: v}}})}
                        />
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-4">Checador y Recepción</p>
                        <PermissionToggle 
                          label="Ver Checador" 
                          checked={userFormData.permissions?.timeClock?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, timeClock: {...userFormData.permissions?.timeClock, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Gestionar Checador" 
                          checked={userFormData.permissions?.timeClock?.manage} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, timeClock: {...userFormData.permissions?.timeClock, manage: v}}})}
                        />
                        <PermissionToggle 
                          label="Ver Recepción" 
                          checked={userFormData.permissions?.reception?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, reception: {...userFormData.permissions?.reception, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Gestionar Recepción" 
                          checked={userFormData.permissions?.reception?.manage} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, reception: {...userFormData.permissions?.reception, manage: v}}})}
                        />
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-4">Directorio de Familias</p>
                        <PermissionToggle 
                          label="Ver Padres de Familia" 
                          checked={userFormData.permissions?.parents?.view} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, parents: {...userFormData.permissions?.parents, view: v}}})}
                        />
                        <PermissionToggle 
                          label="Gestionar Padres" 
                          checked={userFormData.permissions?.parents?.manage} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, parents: {...userFormData.permissions?.parents, manage: v}}})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Personalización Pantalla de Login
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Título Login</label>
                        <input
                          placeholder="Sistema de Control"
                          value={settings.loginTitle || ''}
                          onChange={(e) => setSettings({...settings, loginTitle: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Subtítulo Login</label>
                        <input
                          placeholder="Colegio México Franciscano"
                          value={settings.loginSubtitle || ''}
                          onChange={(e) => setSettings({...settings, loginSubtitle: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 italic">
                      * Si dejas estos campos vacíos, no se mostrarán textos en la pantalla de acceso.
                    </p>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                  <button
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (!userFormData.email || !userFormData.name) return;
                      if (!editingUser && !userFormData.password) {
                        alert('Por favor ingresa una contraseña para el nuevo usuario.');
                        return;
                      }

                      try {
                        let uid = editingUser?.id;

                        // If creating a new user, register them in Firebase Auth first
                        if (!editingUser) {
                          const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_${Date.now()}`);
                          const secondaryAuth = getAuth(secondaryApp);
                          try {
                            const userCredential = await createUserWithEmailAndPassword(
                              secondaryAuth, 
                              userFormData.email!, 
                              userFormData.password!
                            );
                            uid = userCredential.user.uid;
                          } finally {
                            await deleteApp(secondaryApp);
                          }
                        } else if (userFormData.password && userFormData.password.trim() !== '') {
                          // If editing an existing user and a new password was provided, update it in Firebase Auth
                          let authUpdated = false;
                          let authErrorMsg = '';
                          try {
                            const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_Update_${Date.now()}`);
                            const secondaryAuth = getAuth(secondaryApp);
                            try {
                              if (editingUser.currentPassword) {
                                const cred = await signInWithEmailAndPassword(
                                  secondaryAuth,
                                  editingUser.email,
                                  editingUser.currentPassword
                                );
                                await updatePassword(cred.user, userFormData.password.trim());
                                authUpdated = true;
                              } else {
                                authErrorMsg = 'Este usuario no tenía contraseña previa registrada en el sistema.';
                              }
                            } catch (err: any) {
                              authErrorMsg = err.message || 'La contraseña anterior no coincide con Firebase Auth.';
                            } finally {
                              await deleteApp(secondaryApp);
                            }
                          } catch (authErr: any) {
                            console.warn("Could not update auth password directly via secondaryApp:", authErr);
                            authErrorMsg = authErr.message;
                          }

                          if (!authUpdated) {
                            // Automatically trigger a password reset email so the collaborator can sync their key
                            try {
                              await sendPasswordResetEmail(auth, userFormData.email!);
                            } catch (_) {}
                            alert(
                              `Aviso sobre la contraseña:\n\nSe actualizó la ficha de ${userFormData.name} en el sistema.\n\nSin embargo, para sincronizar el acceso a Firebase Auth (ya que este usuario fue dado de alta con anterioridad sin registro de clave previa), se ha enviado un enlace de restablecimiento a ${userFormData.email}.\n\nEl usuario debe abrir ese correo para confirmar su nueva clave.`
                            );
                          }
                        }

                        if (!uid) throw new Error("No se pudo obtener el UID del usuario");

                        const userRef = doc(db, 'users', uid);
                        const { password, ...firestoreData } = userFormData;

                        const finalPassword = userFormData.password && userFormData.password.trim() !== ''
                          ? userFormData.password.trim()
                          : (editingUser?.currentPassword || '');
                        
                        // If specific subjects with groups are configured, ensure restrictedLevels, restrictedGrades, and restrictedGroups cover them
                        let finalRestrictedGroups = userFormData.restrictedGroups || [];
                        let finalRestrictedGrades = userFormData.restrictedGrades || [];
                        let finalRestrictedLevels = userFormData.restrictedLevels || [];

                        if (userFormData.role === 'Docente' && userFormData.teacherSubjectAccess === 'specific') {
                          const subjGroups = new Set<string>();
                          const subjGrades = new Set<string>();
                          const subjLevels = new Set<string>();

                          (userFormData.assignedSubjects || []).forEach(subj => {
                            if (subj.includes('__')) {
                              const parts = subj.split('__');
                              if (parts[1]) subjLevels.add(parts[1]);
                            }
                            const subjObj = subjects.find(s => s.id === subj);
                            if (subjObj?.level) subjLevels.add(subjObj.level);
                          });

                          Object.values(userFormData.teacherSubjectGrades || {}).forEach(arr => {
                            if (Array.isArray(arr)) {
                              arr.filter(g => g !== 'all').forEach(g => subjGrades.add(g));
                            }
                          });

                          Object.values(userFormData.teacherSubjectGroups || {}).forEach(arr => {
                            if (Array.isArray(arr)) {
                              arr.filter(g => g !== 'all').forEach(g => subjGroups.add(g));
                            }
                          });

                          if (subjLevels.size > 0) {
                            finalRestrictedLevels = Array.from(new Set([...finalRestrictedLevels, ...Array.from(subjLevels)]));
                          }
                          if (subjGrades.size > 0) {
                            finalRestrictedGrades = Array.from(new Set([...finalRestrictedGrades, ...Array.from(subjGrades)]));
                          }
                          if (subjGroups.size > 0) {
                            finalRestrictedGroups = Array.from(new Set([...finalRestrictedGroups, ...Array.from(subjGroups)]));
                          }
                        }

                        // Also include groups from per-grade assignments if configured
                        if (userFormData.role === 'Docente' && userFormData.teacherGradeGroups) {
                          const ggGroups = new Set<string>();
                          Object.values(userFormData.teacherGradeGroups).forEach(arr => {
                            if (Array.isArray(arr)) {
                              arr.forEach(g => ggGroups.add(g));
                            }
                          });
                          if (ggGroups.size > 0) {
                            finalRestrictedGroups = Array.from(new Set([...finalRestrictedGroups, ...Array.from(ggGroups)]));
                          }
                        }

                        const isMultiGroup = userFormData.role === 'Docente' && (
                          userFormData.teacherGroupAccess === 'multiple' ||
                          finalRestrictedGroups.length > 1 ||
                          finalRestrictedLevels.length > 1 ||
                          finalRestrictedGrades.length > 1 ||
                          Object.keys(userFormData.teacherGradeGroups || {}).length > 0
                        );

                        await setDoc(userRef, {
                          ...firestoreData,
                          ...(finalPassword ? { currentPassword: finalPassword } : {}),
                          teacherSubjectAccess: userFormData.role === 'Docente' ? (userFormData.teacherSubjectAccess || 'all') : 'all',
                          assignedSubjects: userFormData.role === 'Docente' && userFormData.teacherSubjectAccess === 'specific'
                            ? Array.from(new Set(userFormData.assignedSubjects || []))
                            : [],
                          teacherSubjectGrades: userFormData.role === 'Docente' && userFormData.teacherSubjectAccess === 'specific'
                            ? (userFormData.teacherSubjectGrades || {})
                            : {},
                          teacherSubjectGroups: userFormData.role === 'Docente' && userFormData.teacherSubjectAccess === 'specific'
                            ? (userFormData.teacherSubjectGroups || {})
                            : {},
                          teacherGradeGroups: userFormData.role === 'Docente'
                            ? (userFormData.teacherGradeGroups || {})
                            : {},
                          teacherGroupAccess: isMultiGroup ? 'multiple' : (userFormData.teacherGroupAccess || 'single'),
                          restrictedLevels: finalRestrictedLevels.length > 0 ? finalRestrictedLevels : (userFormData.restrictedLevels || []),
                          restrictedGrades: finalRestrictedGrades.length > 0 ? finalRestrictedGrades : (userFormData.restrictedGrades || []),
                          restrictedGroups: finalRestrictedGroups,
                          assignedLevel: userFormData.assignedLevel || (finalRestrictedLevels[0] || 'General'),
                          assignedGrade: userFormData.assignedGrade || (finalRestrictedGrades[0] || ''),
                          assignedGroup: userFormData.assignedGroup || (finalRestrictedGroups[0] || ''),
                          id: uid,
                          createdAt: editingUser ? editingUser.createdAt : serverTimestamp(),
                          updatedAt: serverTimestamp()
                        }, { merge: true });

                        // Automatically sync with biometric employees list
                        if (userFormData.role === 'Docente') {
                          const empRef = doc(db, 'employees', uid);
                          const empSnap = await getDoc(empRef);
                          const empData: any = {
                            id: uid,
                            name: userFormData.name,
                            position: 'Docente',
                            updatedAt: serverTimestamp()
                          };
                          
                          if (!empSnap.exists()) {
                            empData.faceDescriptor = [];
                            empData.createdAt = serverTimestamp();
                          }
                          await setDoc(empRef, empData, { merge: true });
                        } else {
                          // If they were a teacher but their position/role changed, update the employee position
                          const empRef = doc(db, 'employees', uid);
                          const empSnap = await getDoc(empRef);
                          if (empSnap.exists()) {
                            await setDoc(empRef, {
                              name: userFormData.name,
                              position: userFormData.role || 'Personal',
                              updatedAt: serverTimestamp()
                            }, { merge: true });
                          }
                        }

                        setIsUserModalOpen(false);
                      } catch (error: any) {
                        console.error("Error saving user:", error);
                        alert(`Error al guardar usuario: ${error.message}`);
                      }
                    }}
                    className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
                  >
                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Collaborator Detailed Profile Modal */}
          {selectedUserDetail && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[88vh]">
                {/* Modal Header */}
                <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    {selectedUserDetail.photoUrl ? (
                      <img
                        src={selectedUserDetail.photoUrl}
                        alt={selectedUserDetail.name}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-400"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-inner">
                        {selectedUserDetail.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                          {selectedUserDetail.role}
                        </span>
                        {selectedUserDetail.employeeNumber && (
                          <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                            No. {selectedUserDetail.employeeNumber}
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-black uppercase tracking-tight text-white mt-0.5">
                        {selectedUserDetail.name}
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedUserDetail(null)}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  >
                    <XIcon size={18} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
                  {/* General Info Grid */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={12} className="text-indigo-600" />
                      Datos de Contacto y Cuenta
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Correo Electrónico:</span>
                        <span className="font-bold text-slate-900">{selectedUserDetail.email}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Teléfono:</span>
                        <span className="font-bold text-slate-900">{selectedUserDetail.phone || 'Sin registrar'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Identificador UID:</span>
                        <span className="font-mono text-[10px] text-slate-600 break-all">{selectedUserDetail.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Fecha de Registro:</span>
                        <span className="font-bold text-slate-900">
                          {selectedUserDetail.createdAt ? format(selectedUserDetail.createdAt.toDate(), 'PPP', { locale: es }) : 'N/D'}
                        </span>
                      </div>
                    </div>

                    {/* Contraseña Actual Registrada */}
                    <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Contraseña Registrada:</span>
                        <span className="font-mono text-xs font-bold text-slate-800 select-all">
                          {selectedUserDetail.currentPassword ? (
                            showDetailPassword ? selectedUserDetail.currentPassword : '••••••••••••'
                          ) : (
                            <span className="text-slate-400 font-normal italic">Sin registrar en base de datos</span>
                          )}
                        </span>
                      </div>
                      {selectedUserDetail.currentPassword && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setShowDetailPassword(!showDetailPassword)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                            title={showDetailPassword ? "Ocultar" : "Mostrar contraseña"}
                          >
                            {showDetailPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedUserDetail.currentPassword || '');
                              setCopiedPassword('detail');
                              setTimeout(() => setCopiedPassword(null), 2000);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                            title="Copiar contraseña"
                          >
                            {copiedPassword === 'detail' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Academic Assignment (If Docente or Control Escolar) */}
                  {(selectedUserDetail.role === 'Docente' || selectedUserDetail.role === 'Control Escolar') && (
                    <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap size={13} className="text-blue-600" />
                        Asignación y Jornada Académica
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-blue-600/80 block text-[10px] font-bold uppercase">Modalidad y Nivel:</span>
                          <span className="font-black text-blue-950">
                            {selectedUserDetail.teacherGroupAccess === 'multiple' || (selectedUserDetail.restrictedLevels && selectedUserDetail.restrictedLevels.length > 1)
                              ? `Múltiples Grupos (${selectedUserDetail.restrictedLevels?.join(', ') || 'Todos'})`
                              : (selectedUserDetail.assignedLevel || 'No especificado')}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600/80 block text-[10px] font-bold uppercase">Grados y Grupos:</span>
                          <span className="font-black text-blue-950">
                            {selectedUserDetail.teacherGradeGroups && Object.keys(selectedUserDetail.teacherGradeGroups).length > 0
                              ? Object.entries(selectedUserDetail.teacherGradeGroups)
                                  .filter(([_, grps]) => Array.isArray(grps) && grps.length > 0)
                                  .map(([grdKey, grps]) => `${grdKey.replace(/.*__/, '')}: [${grps.join(', ')}]`)
                                  .join(' | ') || 'Sin grupos'
                              : (selectedUserDetail.teacherGroupAccess === 'multiple' || (selectedUserDetail.restrictedGrades && selectedUserDetail.restrictedGrades.length > 1)
                                  ? `Grados: ${selectedUserDetail.restrictedGrades?.join(', ') || 'Todos'} | Grupos: ${selectedUserDetail.restrictedGroups?.join(', ') || 'Todos'}`
                                  : (selectedUserDetail.assignedGrade ? `${selectedUserDetail.assignedGrade} "${selectedUserDetail.assignedGroup || 'A'}"` : 'General'))}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600/80 block text-[10px] font-bold uppercase">Carga Horaria:</span>
                          <span className="font-black text-blue-950">
                            {selectedUserDetail.maxHoursPerWeek ? `${selectedUserDetail.maxHoursPerWeek} hrs/semana` : 'Sin límite'}
                          </span>
                        </div>
                      </div>

                      {/* Restrictions if Docente */}
                      {selectedUserDetail.role === 'Docente' && (
                        <div className="pt-2 border-t border-blue-200/60 text-[11px]">
                          <span className="text-blue-700 font-bold block mb-1">Materias y Calificaciones Permitidas:</span>
                          {selectedUserDetail.teacherSubjectAccess === 'specific' ? (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                                  Materias Específicas / Talleres ({selectedUserDetail.assignedSubjects?.length || 0})
                                </span>
                              </div>
                              {selectedUserDetail.assignedSubjects?.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {(() => {
                                    const seen = new Set<string>();
                                    const itemsToRender: { id: string; name: string; level?: string; grades?: string[]; groups?: string[]; uniqueKey: string }[] = [];

                                    (selectedUserDetail.assignedSubjects || []).forEach(subj => {
                                      const subjObj = subjects.find(s => s.id === subj || `${s.name}__${s.level}` === subj || s.name === subj);
                                      const name = subjObj ? subjObj.name : (subj.includes('__') ? subj.split('__')[0] : subj);
                                      const level = subjObj?.level || (subj.includes('__') ? subj.split('__')[1] : undefined);
                                      const uniqueKey = `${name}__${level || ''}`;

                                      if (!seen.has(uniqueKey)) {
                                        seen.add(uniqueKey);
                                        const grades = selectedUserDetail.teacherSubjectGrades?.[uniqueKey]
                                          || (subjObj && selectedUserDetail.teacherSubjectGrades?.[subjObj.id])
                                          || selectedUserDetail.teacherSubjectGrades?.[name]
                                          || selectedUserDetail.teacherSubjectGrades?.[subj];
                                        const groups = selectedUserDetail.teacherSubjectGroups?.[uniqueKey]
                                          || (subjObj && selectedUserDetail.teacherSubjectGroups?.[subjObj.id])
                                          || selectedUserDetail.teacherSubjectGroups?.[name]
                                          || selectedUserDetail.teacherSubjectGroups?.[subj];
                                        itemsToRender.push({ id: subjObj?.id || subj, name, level, grades, groups, uniqueKey });
                                      }
                                    });

                                    return itemsToRender.map(item => {
                                      const hasSpecificGrades = item.grades && item.grades.length > 0 && !item.grades.includes('all');
                                      const hasSpecificGroups = item.groups && item.groups.length > 0 && !item.groups.includes('all');

                                      const perGradeGroups: { grade: string; groups: string[] }[] = [];
                                      if (hasSpecificGrades) {
                                        item.grades!.forEach(grd => {
                                          const grdGrp = selectedUserDetail.teacherSubjectGroups?.[`${item.uniqueKey}__${grd}`]
                                            || (item.id && selectedUserDetail.teacherSubjectGroups?.[`${item.id}__${grd}`])
                                            || selectedUserDetail.teacherSubjectGroups?.[`${item.name}__${grd}`];
                                          if (grdGrp && grdGrp.length > 0 && !grdGrp.includes('all')) {
                                            perGradeGroups.push({ grade: grd, groups: grdGrp });
                                          }
                                        });
                                      }

                                      return (
                                        <span key={item.id} className="bg-white border border-blue-200 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 shadow-2xs">
                                          <span>{item.name}</span>
                                          {item.level && (
                                            <span className="text-[8px] bg-slate-100 text-slate-600 px-1 rounded border border-slate-200 font-bold">
                                              {item.level}
                                            </span>
                                          )}
                                          {perGradeGroups.length > 0 ? (
                                            <span className="text-[9px] text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded font-black">
                                              {item.grades!.map(grd => {
                                                const match = perGradeGroups.find(p => p.grade === grd);
                                                return match ? `${grd}: Grupo ${match.groups.join(',')}` : `${grd}: Todos`;
                                              }).join(' | ')}
                                            </span>
                                          ) : (
                                            <>
                                              {hasSpecificGrades && (
                                                <span className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 rounded font-black">
                                                  Grados: {item.grades!.join(', ')}
                                                </span>
                                              )}
                                              {hasSpecificGroups && (
                                                <span className="text-[9px] text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded font-black">
                                                  Grupos: {item.groups!.join(', ')}
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </span>
                                      );
                                    });
                                  })()}
                                </div>
                              ) : (
                                <span className="text-amber-700 italic">No tiene materias seleccionadas (no podrá asentar calificaciones).</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-700 font-bold">
                              ✓ Docente Titular (Acceso completo a calificar todas las materias del grupo)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Restrictions if Control Escolar */}
                      {selectedUserDetail.role === 'Control Escolar' && (
                        <div className="pt-2 border-t border-blue-200/60 text-[11px]">
                          <span className="text-blue-700 font-bold block mb-1">Alcance de Niveles Permitidos:</span>
                          {selectedUserDetail.restrictedLevels?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedUserDetail.restrictedLevels.map(lvl => (
                                <span key={lvl} className="bg-white border border-blue-200 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded">
                                  {lvl}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-emerald-700 font-bold">✓ Acceso global a todos los niveles de Control Escolar</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Permissions Breakdown Matrix */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={12} className="text-indigo-600" />
                      Privilegios y Accesos a Módulos
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Dashboard', enabled: selectedUserDetail.permissions?.dashboard?.view },
                        { label: 'Alumnos (Ver)', enabled: selectedUserDetail.permissions?.students?.view },
                        { label: 'Alumnos (Crear)', enabled: selectedUserDetail.permissions?.students?.create },
                        { label: 'Alumnos (Editar)', enabled: selectedUserDetail.permissions?.students?.edit },
                        { label: 'Alumnos (Eliminar)', enabled: selectedUserDetail.permissions?.students?.delete },
                        { label: 'Pagos (Ver)', enabled: selectedUserDetail.permissions?.payments?.view },
                        { label: 'Pagos (Cobrar)', enabled: selectedUserDetail.permissions?.payments?.create },
                        { label: 'Facturación', enabled: selectedUserDetail.permissions?.payments?.invoice },
                        { label: 'Gastos (Ver)', enabled: selectedUserDetail.permissions?.expenses?.view },
                        { label: 'Gastos (Registrar)', enabled: selectedUserDetail.permissions?.expenses?.create },
                        { label: 'Control Escolar', enabled: selectedUserDetail.permissions?.controlEscolar?.view },
                        { label: 'Calificaciones', enabled: selectedUserDetail.permissions?.grading?.view },
                        { label: 'Checador (Ver)', enabled: selectedUserDetail.permissions?.timeClock?.view },
                        { label: 'Checador (Gestionar)', enabled: selectedUserDetail.permissions?.timeClock?.manage },
                        { label: 'Recepción', enabled: selectedUserDetail.permissions?.reception?.view },
                        { label: 'Portal Padres', enabled: selectedUserDetail.permissions?.parents?.view },
                        { label: 'Ajustes Generales', enabled: selectedUserDetail.permissions?.settings?.editGeneral },
                        { label: 'Gestión Usuarios', enabled: selectedUserDetail.permissions?.settings?.manageUsers }
                      ].map((item, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded-lg border flex items-center justify-between text-[11px] font-bold ${
                            item.enabled
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="text-[10px] font-black">{item.enabled ? '✓' : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Ficha Técnica de Colaborador
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedUserDetail(null)}
                      className="px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={() => {
                        const targetUser = selectedUserDetail;
                        setSelectedUserDetail(null);
                        setEditingUser(targetUser);
                        setUserFormData({
                          ...targetUser,
                          password: '',
                          teacherSubjectAccess: targetUser.teacherSubjectAccess || 'all',
                          assignedSubjects: targetUser.assignedSubjects || [],
                          teacherGradeGroups: targetUser.teacherGradeGroups || {}
                        });
                        setShowCurrentPassword(false);
                        setShowNewPassword(false);
                        setIsUserModalOpen(true);
                      }}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                    >
                      <Edit2 size={13} />
                      Editar Colaborador
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}



          <div className="flex items-center justify-between pt-4">
            {saved && (
              <div className="flex items-center gap-2 text-emerald-600 font-medium animate-in fade-in slide-in-from-left-2">
                <CheckCircle2 size={20} />
                Cambios guardados correctamente
              </div>
            )}
            <div className="flex-1" />
            {(activeTab === 'general' ? hasPermission('settings', 'editGeneral') : 
              activeTab === 'cycles' ? hasPermission('settings', 'editCycles') : 
              activeTab === 'billing' ? hasPermission('settings', 'editRules') : 
              ['academic', 'reception', 'attendanceLists'].includes(activeTab)) && (
              <button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
              >
                <Save size={20} />
                Guardar Configuración
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionToggle({ label, checked, onChange }: { label: string, checked?: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-8 h-4 rounded-full transition-all relative ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

interface AcademicListManagerProps {
  title: string;
  description: string;
  items: string[];
  onUpdate: (items: string[]) => void;
}

function AcademicListManager({ title, description, items, onUpdate }: AcademicListManagerProps) {
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleAdd = () => {
    if (!newItem.trim()) return;
    if (items.includes(newItem.trim())) {
      alert('Este elemento ya existe en la lista.');
      return;
    }
    onUpdate([...items, newItem.trim()]);
    setNewItem('');
  };

  const handleRemove = (index: number) => {
    if (window.confirm('¿Estás seguro de eliminar este elemento?')) {
      onUpdate(items.filter((_, i) => i !== index));
    }
  };

  const startEditing = (index: number, value: string) => {
    setEditingIndex(index);
    setEditingValue(value);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const saveEdit = (index: number) => {
    if (!editingValue.trim()) return;
    if (items.some((item, i) => item === editingValue.trim() && i !== index)) {
      alert('Este elemento ya existe en la lista.');
      return;
    }
    const newItems = [...items];
    newItems[index] = editingValue.trim();
    onUpdate(newItems);
    setEditingIndex(null);
    setEditingValue('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{title}</h3>
          <p className="text-[9px] text-slate-500">{description}</p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Agregar..."
          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all active:scale-95 flex items-center justify-center shrink-0 w-8 h-8"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 group hover:border-slate-200 transition-all">
            {editingIndex === index ? (
              <div className="flex-1 flex gap-2 items-center">
                <input
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(index);
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  className="flex-1 px-2 py-1 bg-slate-50 border border-blue-200 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => saveEdit(index)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded">
                  <Check size={12} />
                </button>
                <button onClick={cancelEditing} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                  <XIcon size={12} />
                </button>
              </div>
            ) : (
              <>
                <span className="text-[11px] font-bold text-slate-700">{item}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEditing(index, item)}
                    className="p-1 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Editar"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleRemove(index)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Borrar"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-[10px] text-slate-400 font-medium italic">Lista vacía</p>
          </div>
        )}
      </div>
    </div>
  );
}
