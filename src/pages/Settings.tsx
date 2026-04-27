import React, { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppSettings, SchoolCycle, UserRole, AppPermissions, AppUser, Announcement, BimestreLock } from '../types';
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
  Database
} from 'lucide-react';
import { motion } from 'motion/react';
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
    pdfFooter: 'GENERADO POR EL SISTEMA DE GESTIÓN ESCOLAR'
  });
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'cycles' | 'users' | 'courses' | 'charges' | 'locks' | 'academic' | 'reception' | 'danger'>('general');
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [gradeLocks, setGradeLocks] = useState<BimestreLock[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState<'Todos' | UserRole>('Todos');

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
    password: '',
    role: 'Cajero',
    permissions: DEFAULT_PERMISSIONS['Cajero']
  });

  // New Cycle Form
  const [newCycle, setNewCycle] = useState({
    name: '',
    tuitionAmount: 0,
    billableMonths: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5] // Default Aug-Dec, Feb-Jun
  });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSettings(prev => ({ ...prev, ...snap.data() }));
      }
      setLoading(false);
    });

    const unsubCycles = onSnapshot(query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), (snap) => {
      setCycles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCycle)));
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc')), (snap) => {
      setAppUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    });

    const unsubLocks = onSnapshot(query(collection(db, 'bimestreLocks'), orderBy('lockedAt', 'desc')), (snap) => {
      setGradeLocks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BimestreLock)));
    });

    return () => { unsubSettings(); unsubCycles(); unsubUsers(); unsubLocks(); };
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
    if (!newCycle.name || newCycle.tuitionAmount <= 0) return;
    try {
      await addDoc(collection(db, 'cycles'), {
        ...newCycle,
        createdAt: serverTimestamp()
      });
      setNewCycle({ name: '', tuitionAmount: 0, billableMonths: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5] });
    } catch (error) {
      console.error("Error adding cycle:", error);
    }
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
            ['academic', 'reception'].includes(activeTab)) && (
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
                          placeholder="0.00"
                          value={isNaN(newCycle.tuitionAmount) ? '' : newCycle.tuitionAmount}
                          onChange={(e) => setNewCycle({...newCycle, tuitionAmount: parseFloat(e.target.value) || 0})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 transition-all focus:bg-white"
                        />
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
                          <div>
                            <p className={`text-xl font-black ${settings.currentCycleId === cycle.id ? 'text-white' : 'text-slate-900'}`}>{cycle.name}</p>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${settings.currentCycleId === cycle.id ? 'text-slate-400' : 'text-slate-500'}`}>Ciclo Escolar</p>
                          </div>
                          
                          <div className={`p-4 rounded-xl ${settings.currentCycleId === cycle.id ? 'bg-white/10' : 'bg-slate-50'}`}>
                             <p className={`text-lg font-black ${settings.currentCycleId === cycle.id ? 'text-emerald-400' : 'text-slate-900'}`}>{formatCurrency(cycle.tuitionAmount)}</p>
                             <p className={`text-[9px] font-bold uppercase ${settings.currentCycleId === cycle.id ? 'text-slate-400' : 'text-slate-500'}`}>Mensualidad Base</p>
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

          {activeTab === 'users' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <Shield size={20} />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Panel de Seguridad</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Usuarios y privilegios</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingUser(null);
                        setUserFormData({ email: '', name: '', password: '', role: 'Cajero', permissions: DEFAULT_PERMISSIONS['Cajero'] });
                        setIsUserModalOpen(true);
                      }}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      <Plus size={16} strokeWidth={3} /> Nuevo Operador
                    </button>
                  </div>
                  
                  <div className="p-8">
                    <div className="flex items-center gap-2 mb-8 bg-slate-50 p-1.5 rounded-xl w-fit border border-slate-200">
                      {(['Todos', 'Superadministrador', 'Administrador', 'Cajero', 'Docente', 'Recepción'] as const).map((role) => (
                        <button
                          key={role}
                          onClick={() => setUserRoleFilter(role)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            userRoleFilter === role 
                              ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                              : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {role}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {appUsers
                        .filter(u => (userRoleFilter === 'Todos' || u.role === userRoleFilter) && u.role !== 'Padre')
                        .map(user => (
                       <div key={user.id} className="p-6 bg-white rounded-xl border border-slate-100 flex flex-col justify-between group hover:border-blue-200 hover:shadow-xl transition-all relative">
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-black shadow-inner">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 leading-none mb-1">{user.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[140px]">{user.email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100/50">
                             <span className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${user.role === 'Administrador' ? 'bg-rose-100 text-rose-600' : user.role === 'Superadministrador' ? 'bg-indigo-900 text-white' : 'bg-blue-100 text-blue-600'}`}>
                               {user.role}
                             </span>
                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setEditingUser(user);
                                    setUserFormData({ ...user, password: '' });
                                    setIsUserModalOpen(true);
                                  }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (window.confirm('¿Eliminar acceso a este usuario?')) {
                                      try {
                                        await deleteDoc(doc(db, 'users', user.id));
                                      } catch (error) {
                                        console.error("Error deleting user:", error);
                                      }
                                    }
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
               </div>
            </div>
          )}

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
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico *</label>
                      <input
                        required
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        disabled={!!editingUser}
                      />
                    </div>
                    {!editingUser && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña Inicial *</label>
                        <input
                          required
                          type="password"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Mínimo 6 caracteres"
                        />
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="md:col-span-3">
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Asignación de Grupo (Solo Docente)</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nivel</label>
                        <select
                          value={userFormData.assignedLevel || ''}
                          onChange={(e) => setUserFormData({...userFormData, assignedLevel: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
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
                          onChange={(e) => setUserFormData({...userFormData, assignedGrade: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
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
                          onChange={(e) => setUserFormData({...userFormData, assignedGroup: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                        >
                          <option value="">Seleccionar Grupo</option>
                          {(settings.academicGroups || ['A', 'B', 'C']).map(group => (
                            <option key={group} value={group}>{group}</option>
                          ))}
                        </select>
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
                          label="Gestionar Usuarios" 
                          checked={userFormData.permissions?.settings?.manageUsers} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, settings: {...userFormData.permissions?.settings, manageUsers: v}}})}
                        />
                        <PermissionToggle 
                          label="Editar Ciclos/Reglas" 
                          checked={userFormData.permissions?.settings?.editCycles} 
                          onChange={(v) => setUserFormData({...userFormData, permissions: {...userFormData.permissions!, settings: {...userFormData.permissions?.settings, editCycles: v, editRules: v}}})}
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
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-4">Checador</p>
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
                        }

                        if (!uid) throw new Error("No se pudo obtener el UID del usuario");

                        const userRef = doc(db, 'users', uid);
                        const { password, ...firestoreData } = userFormData;
                        
                        await setDoc(userRef, {
                          ...firestoreData,
                          id: uid,
                          createdAt: editingUser ? editingUser.createdAt : serverTimestamp(),
                          updatedAt: serverTimestamp()
                        });
                        
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
              activeTab === 'billing' ? hasPermission('settings', 'editRules') : false) && (
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
