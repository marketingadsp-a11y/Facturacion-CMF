import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Enrollment, Student, AppSettings } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Search, Filter, CheckCircle2, XCircle, Clock, Eye, X, Copy, Check, GraduationCap, MapPin, Phone, Mail, User, ShieldAlert, AlertCircle, Printer, FileDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EnrollmentPDF from '../components/EnrollmentPDF';

export default function AcademicControl() {
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<'enrollments' | 'studentList'>('enrollments');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  // Student List Filters
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
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

    return () => {
      unsubEnrollments();
      unsubStudents();
      unsubSettings();
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

      // If approved, create a student record if requested (for simplicity, we'll do it automatically)
      if (status === 'Aprobado') {
        const registrationCode = Math.floor(10000 + Math.random() * 90000).toString();
        await addDoc(collection(db, 'students'), {
          name: enrol.studentName,
          lastName: `${enrol.studentLastName} ${enrol.studentMotherLastName}`,
          curp: enrol.curp,
          email: enrol.fatherEmail || enrol.motherEmail || '',
          phone: enrol.phone,
          parentEmail: enrol.fatherEmail || enrol.motherEmail || '',
          level: enrol.level,
          grade: enrol.grade,
          group: '',
          billingAddress: `${enrol.address} ${enrol.addressNo}, ${enrol.neighborhood}`,
          zipCode: enrol.zipCode,
          registrationCode,
          createdAt: serverTimestamp()
        });
        alert(`Solicitud aprobada. Se ha creado el registro del alumno con código de registro: ${registrationCode}`);
      }

      setSelectedEnrollment(null);
    } catch (error) {
      console.error("Error updating enrollment status:", error);
      alert("Error al actualizar el estado");
    }
  };

  const filteredEnrollments = enrollments.filter(e => {
    const matchesSearch = `${e.studentName} ${e.studentLastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.folio?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || e.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredStudents = students.filter(s => {
    const fullName = `${s.name} ${s.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                         (s.curp && s.curp.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLevel = !filterLevel || s.level === filterLevel;
    const matchesGrade = !filterGrade || s.grade === filterGrade;
    const matchesGroup = !filterGroup || s.group === filterGroup;
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
                <option value="Preescolar">Preescolar</option>
                <option value="Primaria">Primaria</option>
                <option value="Secundaria">Secundaria</option>
                <option value="Bachillerato">Bachillerato</option>
              </select>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los Grados</option>
                {Array.from(new Set(students.map(s => s.grade))).filter(Boolean).sort().map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los Grupos</option>
                {Array.from(new Set(students.map(s => s.group))).filter(Boolean).sort().map(group => (
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
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4">Alumno</th>
                    <th className="px-6 py-4">Nivel / Grado</th>
                    <th className="px-6 py-4 text-center">Grupo</th>
                    <th className="px-6 py-4">CURP</th>
                    <th className="px-6 py-4">Contacto</th>
                    <th className="px-6 py-4 text-right">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                              {student.name.charAt(0)}{student.lastName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-none mb-1">{student.lastName}</p>
                              <p className="text-xs text-slate-500">{student.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{student.level}</span>
                            <span className="text-xs font-bold text-slate-700">{student.grade}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "inline-block px-2 py-1 rounded-md text-[10px] font-black",
                            student.group ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-300"
                          )}>
                            {student.group || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-mono font-bold text-slate-500 uppercase">
                          {student.curp || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {student.phone && (
                              <p className="text-[10px] text-slate-500 flex items-center gap-1 font-bold">
                                <Phone size={10} className="text-slate-300" /> {student.phone}
                              </p>
                            )}
                            {student.email && (
                              <p className="text-[10px] text-slate-500 flex items-center gap-1 font-bold">
                                <Mail size={10} className="text-slate-300" /> {student.email}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase">
                            <CheckCircle2 size={12} />
                            Activo
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
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
