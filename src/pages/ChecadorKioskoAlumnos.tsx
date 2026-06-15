import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Student, AppSettings } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, CheckCircle2, ShieldAlert, LogOut, Check, ArrowLeft, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

export default function ChecadorKioskoAlumnos() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const { hasPermission } = usePermissions();
  const canViewAdmin = hasPermission('timeClock', 'view');

  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [kioskBackground, setKioskBackground] = useState<string | null>(null);

  // Camera devices and constraints
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCamera, setActiveCamera] = useState<string | { facingMode: string }>({ facingMode: 'user' });
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);

  // Scan feedback overlay state
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    student?: Student;
    type?: 'Entrada' | 'Salida';
    message?: string;
  } | null>(null);

  const cooldownRef = useRef<boolean>(false);

  // Refs to avoid stale closures in the scanner's callback
  const studentsRef = useRef<Student[]>([]);
  const settingsRef = useRef<AppSettings | null>(null);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 1. Subscribe to students and settings
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), 
      (snap) => {
        setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      },
      (error) => {
        console.error("Error subscribing to students:", error);
        toast.error("Error cargando alumnos: " + error.message);
      }
    );

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AppSettings;
          setSettings(data);
          if (data.logoUrl) setSchoolLogo(data.logoUrl);
          if (data.kioskBackgroundUrl) setKioskBackground(data.kioskBackgroundUrl);
        }
      },
      (error) => {
        console.error("Error subscribing to settings:", error);
      }
    );

    return () => {
      unsubStudents();
      unsubSettings();
    };
  }, []);

  // 3. Initialize and handle starting the camera scanner
  useEffect(() => {
    if (!activeCamera) return;

    const html5QrCode = new Html5Qrcode("student-qr-reader");
    let isStopped = false;

    const handleScanSuccess = (decodedText: string) => {
      if (!isStopped) {
        handleQrScan(decodedText);
      }
    };

    const startScanning = async () => {
      try {
        await html5QrCode.start(
          activeCamera,
          {
            fps: 10,
            qrbox: (width, height) => {
              const minSize = Math.min(width, height);
              const boxSize = Math.floor(minSize * 0.7);
              return { width: boxSize, height: boxSize };
            }
          },
          handleScanSuccess,
          () => {} // Ignorar errores de procesamiento de cuadros
        );
        setIsScannerActive(true);
        setCameraPermissionError(false);

        // Fetch cameras only after permission is granted and scanner has started
        Html5Qrcode.getCameras()
          .then((devices) => {
            if (devices && devices.length > 0) {
              setCameras(devices);
            }
          })
          .catch((err) => {
            console.error("Error fetching cameras after start:", err);
          });
      } catch (err) {
        console.error("Failed to start QR scanner:", err);
        // Fallback to front camera by constraint if ID start fails
        try {
          if (!isStopped) {
            await html5QrCode.start(
              { facingMode: "user" },
              {
                fps: 10,
                qrbox: { width: 250, height: 250 }
              },
              handleScanSuccess,
              () => {}
            );
            setIsScannerActive(true);
            setCameraPermissionError(false);
          }
        } catch (fallbackErr) {
          console.error("Fallback scanning failed too:", fallbackErr);
          setCameraPermissionError(true);
        }
      }
    };

    startScanning();

    return () => {
      isStopped = true;
      if (html5QrCode.isScanning) {
        html5QrCode.stop()
          .then(() => console.log("Student Kiosk scanner stopped successfully on cleanup."))
          .catch(err => console.error("Error stopping scanner on cleanup:", err));
      }
    };
  }, [activeCamera]);

  // Sound and Tone synthesis fallback
  const playBeep = (frequency: number, type: OscillatorType, duration: number) => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      gain.gain.setValueAtTime(0.35, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);
      osc.stop(context.currentTime + duration);
    } catch (e) {
      console.error("Audio beep synthesis failed:", e);
    }
  };

  const playSuccessSound = () => {
    try {
      const audio = new Audio('/success.mp3');
      audio.play().catch(() => playBeep(880, 'sine', 0.15));
    } catch (e) {
      playBeep(880, 'sine', 0.15);
    }
  };

  const playErrorSound = () => {
    try {
      const audio = new Audio('/error.mp3');
      audio.play().catch(() => playBeep(220, 'sawtooth', 0.25));
    } catch (e) {
      playBeep(220, 'sawtooth', 0.25);
    }
  };

  // QR scan processor logic
  const handleQrScan = async (decodedText: string) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true; // Lock scanning to display welcome/farewell card for 2s

    const scannedText = decodedText.trim();
    
    // Normalization helper to ignore hyphens (-), spaces, and case differences
    const normalize = (txt: string | undefined | null) => {
      if (!txt) return '';
      return txt.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const targetText = normalize(scannedText);

    // Look for matching student in memory list
    let student = studentsRef.current.find(s => 
      (s.matricula && normalize(s.matricula) === targetText) ||
      (s.curp && normalize(s.curp) === targetText) ||
      (s.registrationCode && normalize(s.registrationCode) === targetText) ||
      (s.id === scannedText)
    );

    // Fallback: If not found in the local list (perhaps due to state synchronization delay), query Firestore directly
    if (!student) {
      try {
        const { query, collection, where, getDocs, getDoc, doc } = await import('firebase/firestore');
        // Search by exact matricula match
        let q = query(collection(db, 'students'), where('matricula', '==', scannedText));
        let snap = await getDocs(q);
        
        if (snap.empty) {
          // Try upper-cased
          q = query(collection(db, 'students'), where('matricula', '==', scannedText.toUpperCase()));
          snap = await getDocs(q);
        }

        if (snap.empty) {
          // Try lower-cased
          q = query(collection(db, 'students'), where('matricula', '==', scannedText.toLowerCase()));
          snap = await getDocs(q);
        }

        if (snap.empty) {
          // Finally try document ID match
          const docRef = doc(db, 'students', scannedText);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            student = { id: docSnap.id, ...docSnap.data() } as Student;
          }
        } else {
          student = { id: snap.docs[0].id, ...snap.docs[0].data() } as Student;
        }
      } catch (err) {
        console.error("Error doing direct Firestore fallback lookup:", err);
      }
    }

    if (!student) {
      setScanResult({
        success: false,
        message: `Credencial no reconocida: "${scannedText}"`
      });
      playErrorSound();

      setTimeout(() => {
        setScanResult(null);
        cooldownRef.current = false;
      }, 2000);
      return;
    }

    const trackExit = settingsRef.current?.studentAttendanceTrackExit || false;
    const todayDate = format(new Date(), 'yyyy-MM-dd');
    const recordId = `${student.id}_${todayDate}`;
    const recordRef = doc(db, 'student_attendance_records', recordId);

    try {
      const recordSnap = await getDoc(recordRef);
      let type: 'Entrada' | 'Salida' = 'Entrada';

      if (recordSnap.exists()) {
        const data = recordSnap.data();
        // Override Falta status to Entrada, otherwise if exit is enabled do Salida
        if (data.status === 'Falta' || !data.checkIn) {
          type = 'Entrada';
        } else if (trackExit) {
          type = 'Salida';
        } else {
          type = 'Entrada';
        }
      }

      const fullName = `${student.lastName} ${student.motherLastName || ''} ${student.name}`.trim();

      if (type === 'Entrada') {
        await setDoc(recordRef, {
          studentId: student.id,
          studentName: fullName,
          level: student.level,
          grade: student.grade,
          group: student.group || '',
          date: todayDate,
          checkIn: serverTimestamp(),
          status: 'Asistió',
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await setDoc(recordRef, {
          checkOut: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      setScanResult({
        success: true,
        student,
        type
      });
      playSuccessSound();

      setTimeout(() => {
        setScanResult(null);
        cooldownRef.current = false;
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar asistencia en Firestore.");
      cooldownRef.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans text-white transition-all duration-1000"
      style={kioskBackground ? {
        backgroundImage: `url(${kioskBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : {}}
    >
      {/* Background Graphic Overlay */}
      <div className={cn(
        "absolute inset-0 opacity-20 pointer-events-none",
        kioskBackground ? "bg-black/65" : "bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18)_0,rgba(0,0,0,1)_100%)]"
      )} />

      {/* Admin Quick Exit Button */}
      {user && canViewAdmin && (
        <button
          onClick={() => navigate('/checador-alumnos')}
          className="absolute top-6 left-6 z-30 px-4 py-2 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all"
        >
          <ArrowLeft size={16} />
          Volver a Panel
        </button>
      )}

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center justify-center h-full">
        
        {/* Instituional Logo */}
        <div className="mb-6">
          {schoolLogo ? (
            <img 
              src={schoolLogo} 
              alt="Logo Escolar" 
              className="h-24 md:h-32 w-auto object-contain opacity-95 drop-shadow-[0_0_20px_rgba(255,255,255,0.35)]" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-[1.75rem] bg-indigo-500/20 text-indigo-400 drop-shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-500/30">
              <Camera size={38} />
            </div>
          )}
        </div>

        {/* Camera Selector Dropdown */}
        {cameras.length > 1 && (
          <div className="mb-4 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cámara:</span>
            <select
              value={typeof activeCamera === 'string' ? activeCamera : ''}
              onChange={(e) => setActiveCamera(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
            >
              {typeof activeCamera !== 'string' && (
                <option value="" className="bg-slate-900 text-white">-- Seleccione Cámara --</option>
              )}
              {cameras.map((cam, idx) => (
                <option key={cam.id} value={cam.id} className="bg-slate-900 text-white">
                  {cam.label || `Cámara ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Video feed scanner container */}
        <div className="relative bg-slate-900 border-4 border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden w-full max-w-[380px] aspect-square flex items-center justify-center drop-shadow-[0_0_50px_rgba(0,0,0,0.6)] mb-8">
          
          {cameraPermissionError ? (
            <div className="flex flex-col items-center text-slate-500 px-6 text-center">
              <ShieldAlert className="mb-4 text-rose-500" size={36} />
              <p className="text-sm font-black uppercase tracking-widest text-rose-400 mb-2">Cámara Bloqueada</p>
              <p className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                Active los permisos de cámara en su navegador para iniciar el kiosko.
              </p>
            </div>
          ) : (
            <>
              {/* CSS override for dynamically created elements inside html5-qrcode */}
              <style>{`
                #student-qr-reader video {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                  transform: scaleX(-1); /* Espejo de camara frontal */
                }
                #student-qr-reader {
                  border: none !important;
                  background: transparent !important;
                }
              `}</style>

              {/* HTML5 Qrcode Element (Absolutely positioned to prevent flex layout collapse) */}
              <div id="student-qr-reader" className="absolute inset-0 w-full h-full" />

              {/* Fancy Scanning Guide Overlay */}
              {!scanResult && isScannerActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Outer Pulsing Ring */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-indigo-500/25 rounded-full animate-ping opacity-30" />
                  
                  {/* Focus Rect with corner borders */}
                  <div className="w-56 h-56 border border-white/10 rounded-2xl relative shadow-[inset_0_0_40px_rgba(99,102,241,0.15)]">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-xl" />
                    
                    {/* Pulsing scanning guide laser line */}
                    <div className="w-full h-0.5 bg-indigo-500/80 absolute top-0 left-0 animate-bounce" />
                  </div>

                  {/* Header overlay badge */}
                  <div className="absolute top-3 w-full flex justify-center">
                    <span className="bg-indigo-500/25 text-indigo-300 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border border-indigo-500/30 flex items-center gap-1.5 shadow-md">
                      <RefreshCw className="animate-spin" size={10} /> Escanee Código QR
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Realtime Scan Result Feedback Overlay */}
          <AnimatePresence>
            {scanResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "absolute inset-0 z-20 flex flex-col items-center justify-center p-6 backdrop-blur-lg text-center",
                  scanResult.success 
                    ? (scanResult.type === 'Entrada' ? "bg-emerald-950/90" : "bg-blue-950/90")
                    : "bg-rose-950/90"
                )}
              >
                <motion.div
                  initial={{ scale: 0.2, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 14 }}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-2xl",
                    scanResult.success 
                      ? (scanResult.type === 'Entrada' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white")
                      : "bg-rose-500 text-white"
                  )}
                >
                  {scanResult.success ? (
                    scanResult.type === 'Entrada' ? <Check size={44} strokeWidth={3.5} /> : <LogOut size={36} strokeWidth={3.5} className="ml-1" />
                  ) : (
                    <ShieldAlert size={44} strokeWidth={2.5} />
                  )}
                </motion.div>

                {scanResult.success && scanResult.student ? (
                  <>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 leading-none mb-1.5">
                      {scanResult.type === 'Entrada' ? 'BIENVENIDO(A)' : 'HASTA LUEGO'}
                    </h2>
                    <h3 className="text-xl font-black text-white leading-tight mb-2 tracking-tight max-w-[280px]">
                      {scanResult.student.name}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-black/20 border border-white/5 px-2.5 py-1 rounded-md">
                      {scanResult.student.level} - {scanResult.student.grade}°"{scanResult.student.group || ''}"
                    </p>

                    {scanResult.student.photoUrl && (
                      <img 
                        src={scanResult.student.photoUrl} 
                        alt="Estudiante"
                        className="w-28 h-28 rounded-2xl object-cover border-2 border-white/20 mt-4 shadow-xl"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-black uppercase text-white tracking-tight mb-2">
                      {scanResult.message}
                    </h2>
                    <p className="text-[9px] uppercase font-bold text-white/50 tracking-wider">
                      Por favor, intente de nuevo o consulte en control escolar.
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Institutional branding badge */}
        <div className="text-center space-y-4">
          <div className="inline-block bg-black/45 backdrop-blur-md px-6 py-3 rounded-[1.75rem] border border-white/10 shadow-2xl">
            <h1 className="text-xl md:text-2xl font-black tracking-tighter text-white uppercase drop-shadow-md mb-1">
              CHECADOR ESCOLAR ALUMNOS
            </h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-300 tracking-wide max-w-xs mx-auto leading-relaxed opacity-90">
              Coloque el código QR de su credencial frente a la cámara para marcar su asistencia.
            </p>
          </div>
        </div>

        {/* Digital Clock Overlay at the bottom */}
        <div className="mt-8">
          <DigitalClock />
        </div>
      </div>
    </div>
  );
}

// Clock component
function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-4 bg-black/45 backdrop-blur-xl px-5 py-2.5 rounded-[1.5rem] border border-white/10 shadow-2xl">
      <div className="flex flex-col items-center">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40 leading-none mb-1">Hora</span>
        <span className="font-mono text-lg font-black text-white tracking-widest leading-none">
          {format(time, 'HH:mm:ss')}
        </span>
      </div>
      <div className="w-px h-7 bg-white/15 mx-0.5"></div>
      <div className="flex flex-col">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40 leading-none mb-1 text-center">Fecha</span>
        <span className="text-[9px] font-black uppercase tracking-tight text-indigo-300 leading-none">
          {format(time, 'EEEE d \'de\' MMMM, yyyy', { locale: es })}
        </span>
      </div>
    </div>
  );
}
