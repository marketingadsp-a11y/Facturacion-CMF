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
  MapPin
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
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
      grading: { view: true, manage: true }
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
      grading: { view: true, manage: true }
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
      grading: { view: true, manage: false }
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
      grading: { view: false, manage: false }
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
      grading: { view: false, manage: false }
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
      grading: { view: false, manage: false }
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
      grading: { view: true, manage: true }
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
      grading: { view: false, manage: false }
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
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ajustes del Sistema</h1>
        <p className="text-slate-500">Configura la información de tu colegio, ciclos escolares y facturación.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="space-y-1">
          <button 
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'general' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
          >
            <Globe size={18} /> General
          </button>
          <button 
            onClick={() => setActiveTab('cycles')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'cycles' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
          >
            <Calendar size={18} /> Ciclos y Colegiaturas
          </button>
          <button 
            onClick={() => setActiveTab('academic')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'academic' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
          >
            <GraduationCap size={18} /> Datos Académicos
          </button>
          <button 
            onClick={() => setActiveTab('reception')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'reception' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
          >
            <Users size={18} /> Atención y Recepción
          </button>
          <button 
            onClick={() => setActiveTab('courses')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'courses' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
          >
            <BookOpen size={18} /> Catálogo de Cursos
          </button>
          <button 
            onClick={() => setActiveTab('charges')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'charges' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
          >
            <CreditCard size={18} /> Catálogo de Cobros
          </button>
          <button 
            onClick={() => setActiveTab('billing')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'billing' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
          >
            <Key size={18} /> Facturación
          </button>
          {hasPermission('settings', 'manageUsers') && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
            >
              <Shield size={18} /> Gestión de Usuarios
            </button>
          )}
          {hasPermission('settings', 'manageUsers') && (
            <button 
              onClick={() => setActiveTab('locks')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'locks' ? 'bg-white text-blue-600 font-semibold shadow-sm border border-slate-100' : 'text-slate-600 hover:bg-white'}`}
            >
              <Lock size={18} /> Bloqueos de Notas
            </button>
          )}
          {userProfile?.role === 'Superadministrador' && (
            <button 
              onClick={() => setActiveTab('danger')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'danger' ? 'bg-red-50 text-red-600 font-semibold shadow-sm border border-red-100' : 'text-slate-600 hover:bg-white'}`}
            >
              <AlertTriangle size={18} /> Zona de Peligro
            </button>
          )}
        </div>

        {/* Content */}
        <div className="md:col-span-3 space-y-6">
          {activeTab === 'general' && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Globe size={20} className="text-blue-600" />
                Información del Colegio
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Comercial</label>
                  <input
                    value={settings.schoolName}
                    onChange={(e) => setSettings({...settings, schoolName: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Social</label>
                  <input
                    value={settings.legalName}
                    onChange={(e) => setSettings({...settings, legalName: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">URL del Logotipo</label>
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="text-slate-400" size={24} />
                      )}
                    </div>
                    <input
                      placeholder="https://ejemplo.com/logo.png"
                      value={settings.logoUrl}
                      onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Enrollment Settings */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" />
                  Configuración de Inscripciones
                </h2>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Link Público (Slug)</label>
                  <div className="flex gap-2 items-center">
                    <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm font-medium">
                      {window.location.origin}/
                    </div>
                    <input
                      placeholder="enroll"
                      value={settings.enrollmentSlug || ''}
                      onChange={(e) => setSettings({...settings, enrollmentSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic">
                    * Este es el nombre que aparecerá en la URL para las inscripciones públicas. Solo usa letras minúsculas, números y guiones.
                  </p>
                </div>
              </div>

              {/* Developer Attribution Settings - Superadmin only */}
              {userProfile?.role === 'Superadministrador' && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Edit2 size={20} className="text-emerald-600" />
                    Atribución del Desarrollador (Footer)
                  </h2>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Texto de Créditos / Desarrollador</label>
                    <input
                      placeholder="Creado por CIUDAPP MX - Cristobal Moran"
                      value={settings.developerAttribution || ''}
                      onChange={(e) => setSettings({...settings, developerAttribution: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-2 italic">
                      * Este texto aparecerá en el pie de página de la pantalla de inicio de sesión y en el formulario público de visitas.
                    </p>
                  </div>
                </div>
              )}

              {/* PDF & Registration Config */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" />
                  Configuración de PDF y Registro de Padres
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Instrucciones de Registro (Una por línea)</label>
                    <textarea
                      rows={5}
                      value={settings.registrationInstructions || ''}
                      onChange={(e) => setSettings({...settings, registrationInstructions: e.target.value})}
                      placeholder="Escriba los pasos para el registro..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm leading-relaxed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pie de Página en PDF (Footer)</label>
                    <input
                      value={settings.pdfFooter || ''}
                      onChange={(e) => setSettings({...settings, pdfFooter: e.target.value})}
                      placeholder="Ej: GENERADO POR EL SISTEMA DE GESTIÓN ESCOLAR"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cycles' && (
            <div className="space-y-6">
              {/* Tuition Rules */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={20} className="text-orange-600" />
                  Reglas de Pago y Recargos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Día Máximo de Pago (Sin recargos)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={isNaN(settings.dueDay) ? '' : settings.dueDay}
                      onChange={(e) => setSettings({...settings, dueDay: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Ejemplo: 10 para el día 10 de cada mes.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Monto de Recargo</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={isNaN(settings.lateFeeAmount) ? '' : settings.lateFeeAmount}
                        onChange={(e) => setSettings({...settings, lateFeeAmount: parseFloat(e.target.value) || 0})}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <select
                        value={settings.lateFeeType}
                        onChange={(e) => setSettings({...settings, lateFeeType: e.target.value as 'fixed' | 'percentage'})}
                        className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="fixed">$ Fijo</option>
                        <option value="percentage">% Porc.</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cycle Management */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={20} className="text-blue-600" />
                  Ciclos Escolares
                </h2>

                {/* Add New Cycle */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">Registrar Nuevo Ciclo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre del Ciclo</label>
                      <input
                        placeholder="Ej. 2025-2026"
                        value={newCycle.name}
                        onChange={(e) => setNewCycle({...newCycle, name: e.target.value})}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Costo de Colegiatura Mensual</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={isNaN(newCycle.tuitionAmount) ? '' : newCycle.tuitionAmount}
                        onChange={(e) => setNewCycle({...newCycle, tuitionAmount: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Meses a Cobrar</label>
                    <div className="flex flex-wrap gap-2">
                      {MONTHS.map((month, index) => (
                        <button
                          key={month}
                          onClick={() => toggleMonth(index)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${newCycle.billableMonths.includes(index) ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'}`}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleAddCycle}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus size={18} /> Registrar Ciclo
                  </button>
                </div>

                {/* Cycles List */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">Ciclo Actual y Lista de Ciclos</label>
                  {cycles.map(cycle => (
                    <div key={cycle.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${settings.currentCycleId === cycle.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{cycle.name}</span>
                          {settings.currentCycleId === cycle.id && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase">Actual</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Colegiatura: {formatCurrency(cycle.tuitionAmount)} • {cycle.billableMonths.length} meses cobrables
                        </p>
                      </div>
                      <button
                        onClick={() => setSettings({...settings, currentCycleId: cycle.id})}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${settings.currentCycleId === cycle.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {settings.currentCycleId === cycle.id ? 'Seleccionado' : 'Seleccionar'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Key size={20} className="text-emerald-600" />
                  Integración Facturapi
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">API Key (Secret Key)</label>
                    <input
                      type="password"
                      placeholder="sk_test_..."
                      value={settings.facturapiApiKey}
                      onChange={(e) => setSettings({...settings, facturapiApiKey: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Obtén tu llave en dashboard.facturapi.io</p>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <input
                      type="checkbox"
                      id="sandbox"
                      checked={settings.facturapiSandbox}
                      onChange={(e) => setSettings({...settings, facturapiSandbox: e.target.checked})}
                      className="w-5 h-5 text-emerald-600 rounded-lg focus:ring-emerald-500"
                    />
                    <label htmlFor="sandbox" className="text-sm font-medium text-emerald-900 cursor-pointer">
                      Modo Sandbox (Pruebas)
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <CreditCard size={20} className="text-blue-600" />
                  Integración Conekta (Pagos en Línea)
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Public Key</label>
                    <input
                      placeholder="key_..."
                      value={settings.conektaPublicKey}
                      onChange={(e) => setSettings({...settings, conektaPublicKey: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Private Key (Secret Key)</label>
                    <input
                      type="password"
                      placeholder="key_..."
                      value={settings.conektaPrivateKey}
                      onChange={(e) => setSettings({...settings, conektaPrivateKey: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Configura estas llaves para permitir que los padres paguen colegiaturas con tarjeta, transferencia o efectivo (OXXO) desde la app.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <CoursesCatalog />
          )}

          {activeTab === 'locks' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Lock size={20} className="text-amber-600" />
                  Bloqueos de Calificaciones
                </h2>
                <div className="space-y-3">
                  {gradeLocks.length === 0 && (
                    <div className="py-12 text-center text-slate-400">
                      No hay bimestres bloqueados actualmente.
                    </div>
                  )}
                  {gradeLocks.map(lock => (
                    <div key={lock.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900"> Bimestre {lock.bimestre} - {lock.level}</p>
                        <p className="text-xs text-slate-500">
                          {lock.grade} {lock.group} • Ciclo: {cycles.find(c => c.id === lock.cycleId)?.name || lock.cycleId}
                        </p>
                        {lock.lockedAt && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Bloqueado el: {lock.lockedAt.toDate().toLocaleString()}
                          </p>
                        )}
                      </div>
                      <button 
                        onClick={async () => {
                          if (window.confirm('¿Estás seguro de desbloquear este bimestre? El docente podrá volver a editar calificaciones.')) {
                            try {
                              await deleteDoc(doc(db, 'bimestreLocks', lock.id));
                            } catch (error) {
                              console.error("Error deleting lock:", error);
                            }
                          }
                        }}
                        className="px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                      >
                        <Unlock size={16} /> Desbloquear
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                      <GraduationCap size={20} className="text-blue-600" />
                      Estructura Académica Global
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Define los niveles, grados y grupos que se utilizarán en todo el sistema.
                    </p>
                  </div>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    <Save size={18} /> Guardar Cambios
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <AcademicListManager 
                    title="Niveles" 
                    description="Ej. Primaria, Secundaria"
                    items={settings.academicLevels || []} 
                    onUpdate={(newItems) => setSettings({...settings, academicLevels: newItems})}
                  />
                  <AcademicListManager 
                    title="Grados" 
                    description="Ej. 1ro, 2do"
                    items={settings.academicGrades || []} 
                    onUpdate={(newItems) => setSettings({...settings, academicGrades: newItems})}
                  />
                  <AcademicListManager 
                    title="Grupos" 
                    description="Ej. A, B, Verde"
                    items={settings.academicGroups || []} 
                    onUpdate={(newItems) => setSettings({...settings, academicGroups: newItems})}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reception' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                      <Users size={20} className="text-indigo-600" />
                      Configuración de Recepción
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Gestiona los perfiles de visitantes y los motivos de atención.
                    </p>
                  </div>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    <Save size={18} /> Guardar Cambios
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <AcademicListManager 
                    title="Nivel o Área" 
                    description="Departamentos o áreas de atención"
                    items={settings.receptionAreas || []} 
                    onUpdate={(newItems) => setSettings({...settings, receptionAreas: newItems})}
                  />
                  <AcademicListManager 
                    title="Motivos de Atención" 
                    description="Razones de la solicitud"
                    items={settings.receptionReasons || []} 
                    onUpdate={(newItems) => setSettings({...settings, receptionReasons: newItems})}
                  />
                </div>

                {userProfile?.role === 'Superadministrador' && (
                  <div className="pt-8 border-t border-slate-100 space-y-6">
                    <div className="flex items-center gap-2">
                       <CheckCircle2 size={18} className="text-emerald-600" />
                       <h3 className="text-base font-bold text-slate-800">Mensaje de Éxito (Público)</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Título de Éxito</label>
                        <input
                          placeholder="¡Registro Exitoso!"
                          value={settings.receptionSuccessTitle || ''}
                          onChange={(e) => setSettings({...settings, receptionSuccessTitle: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Cuerpo del Mensaje</label>
                        <textarea
                          rows={3}
                          placeholder="Hemos recibido tu registro. Por favor, toma asiento, en un momento te atenderemos."
                          value={settings.receptionSuccessMessage || ''}
                          onChange={(e) => setSettings({...settings, receptionSuccessMessage: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'danger' && userProfile?.role === 'Superadministrador' && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-red-100 space-y-6">
              <h2 className="font-bold text-red-600 flex items-center gap-2">
                <AlertTriangle size={20} />
                Zona de Peligro
              </h2>
              
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-red-900">Restablecer Datos del Sistema</h3>
                    <p className="text-xs text-red-700 mt-1">
                      Esta acción eliminará permanentemente todos los alumnos, pagos, gastos, ciclos y anuncios. 
                      Las cuentas de usuario administrativas y la configuración general se mantendrán.
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-red-200 space-y-4">
                  <button
                    onClick={async () => {
                      if (!window.confirm('¿Deseas cargar datos de ejemplo? Esto agregará alumnos, pagos, gastos, ciclos y anuncios para que veas el sistema funcionando.')) return;
                      
                      try {
                        setLoading(true);
                        await loadExampleData();
                        alert('Datos de ejemplo cargados correctamente.');
                        window.location.reload();
                      } catch (error) {
                        console.error("Error loading example data:", error);
                        alert('Error al cargar datos: ' + (error.message || 'Desconocido'));
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
                  >
                    Cargar Datos de Ejemplo
                  </button>

                  <button
                    onClick={async () => {
                      const confirm1 = window.confirm('¿ESTÁS ABSOLUTAMENTE SEGURO? Esta acción no se puede deshacer.');
                      if (!confirm1) return;
                      
                      const confirm2 = window.prompt('Para confirmar, escribe "ELIMINAR TODO" en mayúsculas:');
                      if (confirm2 !== 'ELIMINAR TODO') return;

                      try {
                        const collections = [
                          'students', 'payments', 'expenses', 'cycles', 
                          'announcements', 'grades', 'attendance', 
                          'reception_visits', 'bimestreLocks', 'enrollments'
                        ];
                        for (const coll of collections) {
                          const snap = await getDocs(collection(db, coll));
                          const deletePromises = snap.docs.map(d => deleteDoc(doc(db, coll, d.id)));
                          await Promise.all(deletePromises);
                        }
                        alert('Datos restablecidos correctamente.');
                        window.location.reload();
                      } catch (error) {
                        console.error("Error resetting data:", error);
                        alert('Error al restablecer datos.');
                      }
                    }}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-100 transition-all active:scale-95"
                  >
                    Restablecer Sistema (Borrar Todo)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Shield size={20} className="text-indigo-600" />
                    Usuarios Administrativos
                  </h2>
                  <button 
                    onClick={() => {
                      setEditingUser(null);
                      setUserFormData({ email: '', name: '', password: '', role: 'Cajero', permissions: DEFAULT_PERMISSIONS['Cajero'] });
                      setIsUserModalOpen(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
                  >
                    <Plus size={16} /> Nuevo Usuario
                  </button>
                </div>

                <div className="space-y-3">
                  {appUsers.map(user => (
                    <div key={user.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user.name}</p>
                          <p className="text-[10px] text-slate-500">{user.email} • <span className="font-bold text-indigo-600 uppercase">{user.role}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingUser(user);
                            setUserFormData({ ...user, password: '' });
                            setIsUserModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={async () => {
                            if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
                              try {
                                await deleteDoc(doc(db, 'users', user.id));
                              } catch (error) {
                                console.error("Error deleting user:", error);
                              }
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isUserModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
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
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico *</label>
                      <input
                        required
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
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
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
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
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
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
                      </div>
                    </div>
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
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
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
          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          className="p-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-all active:scale-95 flex items-center justify-center shrink-0 w-8 h-8"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 group hover:border-slate-200 transition-all">
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
