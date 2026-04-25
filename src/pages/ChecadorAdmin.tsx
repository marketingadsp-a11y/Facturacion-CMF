import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, where, Timestamp, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Employee, TimeLog } from '../types';
import { 
  Users, 
  Plus, 
  Link as LinkIcon, 
  Camera, 
  X,
  History,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  RefreshCw,
  FileDown,
  Timer,
  Edit2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import * as faceapi from '@vladmandic/face-api';
import { toast } from 'react-toastify';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ChecadorLogPDF } from '../components/ChecadorLogPDF';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export default function ChecadorAdmin() {
  const [activeTab, setActiveTab] = useState<'personal' | 'bitacora'>('personal');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [logDate, setLogDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [schoolName, setSchoolName] = useState('Centro de Asistencia');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsModalOpen(true);
  };

  const closeRegistrationModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.schoolName) setSchoolName(data.schoolName);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      }
    });
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Error loading face-api models", err);
      }
    };
    loadModels();

    // Fetch employees
    const unsubEmployees = onSnapshot(query(collection(db, 'employees'), orderBy('name', 'asc')), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    return () => {
      unsubEmployees();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'bitacora') return;
    
    const parts = logDate.split('-');
    if (parts.length !== 3) return;
    const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const startObj = startOfDay(targetDate);
    const endObj = endOfDay(targetDate);
    
    // Only query by timestamp to avoid composite index error (or fetch all and filter)
    const qLogs = query(
      collection(db, 'attendance_logs'),
      orderBy('timestamp', 'desc')
    );

    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const allLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog));
      const filtered = allLogs.filter(log => 
        log.timestamp && 
        log.timestamp.toMillis() >= startObj.getTime() && 
        log.timestamp.toMillis() <= endObj.getTime()
      );
      setLogs(filtered);
    });

    return () => unsubLogs();
  }, [activeTab, logDate]);

  const copyKioskLink = () => {
    const url = `${window.location.origin}/checador`;
    navigator.clipboard.writeText(url);
    setIsCopying(true);
    toast.success("Enlace del checador copiado");
    setTimeout(() => setIsCopying(false), 2000);
  };

  const deleteEmployee = async (id: string) => {
    if (window.confirm('¿Eliminar a este empleado del sistema? No podrá realizar check-ins.')) {
      await deleteDoc(doc(db, 'employees', id));
      toast.success("Empleado eliminado");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <div className="bg-white border-b border-slate-200 px-6 py-4 mb-6 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
            )}
            <h1 className="text-2xl font-black text-slate-950 tracking-tighter flex items-center gap-3 italic">
              Reloj Checador Biométrico
              <span className="not-italic text-[9px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase">Reconocimiento Facial</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={copyKioskLink}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-sm transition-all"
            >
              {isCopying ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
              Copiar Enlace Panel
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-950 hover:bg-black text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200 transition-all active:scale-95"
            >
              <Plus size={16} />
              Registrar Personal
            </button>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto mt-6 flex gap-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('personal')}
            className={cn(
              "px-4 py-2 font-black text-[11px] uppercase tracking-widest transition-all border-b-2",
              activeTab === 'personal' 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
            )}
          >
            Base de Personal
          </button>
          <button
            onClick={() => setActiveTab('bitacora')}
            className={cn(
              "px-4 py-2 font-black text-[11px] uppercase tracking-widest transition-all border-b-2 flex items-center gap-2",
              activeTab === 'bitacora' 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
            )}
          >
            Registro de Entradas y Salidas
          </button>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-6 space-y-6">
        {activeTab === 'personal' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-3">Empleado</th>
                  <th className="px-6 py-3">Puesto</th>
                  <th className="px-6 py-3">Biometría</th>
                  <th className="px-6 py-3">Nacimiento</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map(employee => (
                  <tr key={employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                          {employee.name.charAt(0)}
                        </div>
                        <p className="text-sm font-black text-slate-900">{employee.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">{employee.position}</span>
                    </td>
                    <td className="px-6 py-4">
                      {employee.faceDescriptor ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle2 size={12} /> Registrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded">
                          <AlertCircle size={12} /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {employee.birthDate ? (
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                          {format(new Date(employee.birthDate + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                        </p>
                      ) : (
                        <span className="text-slate-300 italic text-[10px]">No reg.</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(employee)}
                          className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => deleteEmployee(employee.id)} 
                          className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                        <Users size={32} className="opacity-20 mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No hay personal registrado</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'bitacora' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha de Consulta</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm font-black text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              
              <PDFDownloadLink
                document={<ChecadorLogPDF logs={logs} date={new Date(parseInt(logDate.split('-')[0]), parseInt(logDate.split('-')[1]) - 1, parseInt(logDate.split('-')[2]))} schoolName={schoolName} />}
                fileName={`bitacora-checador-${logDate}.pdf`}
                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-emerald-200 hover:border-emerald-600 shadow-sm"
              >
                {({ loading }) => (
                  <>
                    {loading ? <Timer size={14} className="animate-spin" /> : <FileDown size={14} />}
                    {loading ? 'Generando Reporte...' : 'Exportar PDF Resumen'}
                  </>
                )}
              </PDFDownloadLink>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-3">Hora</th>
                    <th className="px-6 py-3">Empleado</th>
                    <th className="px-6 py-3">Movimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-mono text-xs text-slate-900 font-bold">
                          {format(log.timestamp.toDate(), 'HH:mm:ss')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-slate-900">{log.employeeName}</p>
                        <p className="text-[10px] font-bold text-slate-500">{log.employeePosition}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                          log.type === 'Entrada' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                        )}>
                          {log.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                          <History size={32} className="opacity-20 mb-3" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No hay registros hoy</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <RegistrationModal 
            onClose={closeRegistrationModal} 
            editingEmployee={editingEmployee}
            modelsLoaded={modelsLoaded} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RegistrationModal({ onClose, editingEmployee, modelsLoaded }: { onClose: () => void, editingEmployee: Employee | null, modelsLoaded: boolean }) {
  const [name, setName] = useState(editingEmployee?.name || '');
  const [position, setPosition] = useState(editingEmployee?.position || '');
  const [birthDate, setBirthDate] = useState(editingEmployee?.birthDate || '');
  const [step, setStep] = useState<1 | 2>(1); // 1: Info, 2: Capture
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [descriptor, setDescriptor] = useState<Float32Array | null>(editingEmployee?.faceDescriptor ? new Float32Array(editingEmployee.faceDescriptor) : null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (step === 2 && !stream) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(str => {
          setStream(str);
          if (videoRef.current) {
            videoRef.current.srcObject = str;
          }
        })
        .catch(err => {
          console.error("No camera permissions", err);
          toast.error("Permiso de cámara denegado");
        });
    }

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [step, stream]);

  const captureFace = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setIsScanning(true);
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        setDescriptor(detection.descriptor);
        toast.success("Rostro capturado correctamente. ¡Listo para guardar!");
      } else {
        toast.error("No se detectó el rostro. Acércate y mira fijamente.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar el rostro.");
    } finally {
      setIsScanning(false);
    }
  };

  const saveEmployee = async () => {
    if (!name || !position) return;
    setIsSaving(true);
    try {
      if (editingEmployee) {
        const { updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'employees', editingEmployee.id), {
          name,
          position,
          birthDate,
          faceDescriptor: descriptor ? Array.from(descriptor) : editingEmployee.faceDescriptor,
          updatedAt: serverTimestamp()
        });
        toast.success("Personal actualizado");
      } else {
        if (!descriptor) {
          toast.error("Debe capturar el rostro para registros nuevos");
          setIsSaving(false);
          return;
        }
        await addDoc(collection(db, 'employees'), {
          name,
          position,
          birthDate,
          faceDescriptor: Array.from(descriptor),
          createdAt: serverTimestamp()
        } as Partial<Employee>);
        toast.success("Personal registrado");
      }
      onClose();
    } catch (err) {
      console.error("Error saving employee", err);
      toast.error("Error al guardar cambios");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tighter">
              {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Registro biométrico
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-2 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Puesto / Cargo</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="Ej. Docente Principal"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Nacimiento</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="pt-4 space-y-3">
                <button
                  disabled={!name || !position}
                  onClick={() => setStep(2)}
                  className="w-full bg-slate-100 text-slate-700 rounded-xl py-3 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera size={14} />
                  {descriptor ? 'Actualizar Rostro' : 'Capturar Rostro'}
                </button>
                
                {editingEmployee && (
                  <button
                    disabled={!name || !position || isSaving}
                    onClick={saveEmployee}
                    className="w-full bg-slate-950 text-white rounded-xl py-3 font-black text-[10px] uppercase tracking-widest hover:bg-black transition-colors"
                  >
                    Guardar Cambios
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-square rounded-full overflow-hidden bg-slate-100 border-4 border-indigo-50 shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                {!modelsLoaded && (
                  <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm flex items-center justify-center">
                    <RefreshCw className="animate-spin text-white" size={24} />
                  </div>
                )}
                {descriptor && (
                  <div className="absolute inset-0 border-8 border-emerald-500 rounded-full flex flex-col items-center justify-center bg-emerald-500/20">
                    <CheckCircle2 size={48} className="text-white drop-shadow-md bg-emerald-500 rounded-full" />
                  </div>
                )}
              </div>

              {!descriptor ? (
                <div className="text-center w-full">
                  <p className="text-xs font-bold text-slate-600 mb-4 px-4">
                    Colóquese frente a la cámara, con buena iluminación y presione capturar.
                  </p>
                  <button
                    disabled={isScanning || !modelsLoaded}
                    onClick={captureFace}
                    className="w-full bg-indigo-600 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {isScanning ? <RefreshCw className="animate-spin" size={16} /> : <Camera size={16} />}
                    Capturar Rostro
                  </button>
                </div>
              ) : (
                <div className="w-full mt-2">
                  <button
                    disabled={isSaving}
                    onClick={saveEmployee}
                    className="w-full bg-emerald-600 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                  >
                    {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    {isSaving ? 'Guardando...' : 'Finalizar Registro'}
                  </button>
                  <button
                    onClick={() => setDescriptor(null)}
                    className="w-full mt-3 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600"
                  >
                    Volver a Capturar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
