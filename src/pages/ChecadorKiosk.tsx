import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs, Timestamp, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Employee, TimeLog } from '../types';
import * as faceapi from '@vladmandic/face-api';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, CheckCircle2, ShieldAlert, Clock, ScanFace, Check } from 'lucide-react';
import { startOfDay, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

// Convert stored arrays back to Float32Array
function getFloat32Array(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

export default function ChecadorKiosk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [kioskBackground, setKioskBackground] = useState<string | null>(null);

  // States for matching feedback
  const [matchedEmployee, setMatchedEmployee] = useState<Employee | null>(null);
  const [actionType, setActionType] = useState<'Entrada' | 'Salida' | null>(null);
  
  // Cooldown to avoid rapid double scanning
  const cooldownRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Load models
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

    // 2. Load employees
    const unsub = onSnapshot(collection(db, 'employees'), (snap) => {
      const emps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps);
      
      // Rebuild FaceMatcher
      if (emps.length > 0) {
        const labeledDescriptors = emps
          .filter(e => e.faceDescriptor && e.faceDescriptor.length === 128)
          .map(e => new faceapi.LabeledFaceDescriptors(
            e.id, 
            [getFloat32Array(e.faceDescriptor)]
          ));
        
        if (labeledDescriptors.length > 0) {
          // 0.45 distance threshold for stricter matching
          setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.45));
        } else {
          setFaceMatcher(null);
        }
      }
    });

    // 3. Load settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.logoUrl) {
          setSchoolLogo(data.logoUrl);
        }
        if (data.kioskBackgroundUrl) {
          setKioskBackground(data.kioskBackgroundUrl);
        }
      }
    });

    return () => {
      unsub();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (modelsLoaded && faceMatcher) {
      startCamera();
    }
  }, [modelsLoaded, faceMatcher]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsReady(true);
          startDetectionLoop();
        };
      }
    } catch (err) {
      console.error("Camera access denied", err);
      toast.error("Permiso de cámara denegado. No se puede iniciar el checador.");
    }
  };

  const startDetectionLoop = () => {
    setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || cooldownRef.current || !faceMatcher) return;

      const video = videoRef.current;
      if (video.paused || video.ended) return;

      try {
        const detection = await faceapi.detectSingleFace(
          video, 
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        ).withFaceLandmarks().withFaceDescriptor();

        if (detection) {
          const match = faceMatcher.findBestMatch(detection.descriptor);
          
          if (match.label !== 'unknown' && match.distance < 0.45) {
            handleCheckIn(match.label);
          }
        }
      } catch (e) {
        // Ignorar errores de procesamiento de frames
      }
    }, 1000); // Check every second to spare CPU on iPad
  };

  const handleCheckIn = async (employeeId: string) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true; // Lock

    const emp = employees.find(e => e.id === employeeId);
    if (!emp) {
      cooldownRef.current = false;
      return;
    }

    try {
      // Logic for Entrada/Salida
      const today = startOfDay(new Date());
      // Query without composite filter to avoid missing index error
      const qCheck = query(
        collection(db, 'attendance_logs'),
        where('employeeId', '==', emp.id)
      );
      
      const snap = await getDocs(qCheck);
      // Filter today's logs in memory
      const logsToday = snap.docs.map(d => d.data() as TimeLog).filter(d => 
        d.timestamp && d.timestamp.toMillis() >= today.getTime()
      );
      
      let type: 'Entrada' | 'Salida' = 'Entrada';
      
      if (logsToday.length > 0) {
        // Sort by timestamp descending
        logsToday.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
        const lastLog = logsToday[0];
        
        // If last log was Entrada, this is Salida. If Salida, this is Entrada.
        if (lastLog.type === 'Entrada') {
          type = 'Salida';
        }
      }

      await addDoc(collection(db, 'attendance_logs'), {
        employeeId: emp.id,
        employeeName: emp.name,
        employeePosition: emp.position,
        type,
        timestamp: serverTimestamp()
      } as TimeLog);

      // Show Feedback
      setMatchedEmployee(emp);
      setActionType(type);

      const isBirthday = emp.birthDate && (() => {
        const bDay = new Date(emp.birthDate + 'T12:00:00');
        const now = new Date();
        return bDay.getMonth() === now.getMonth() && bDay.getDate() === now.getDate();
      })();

      if (isBirthday) {
        // Multiple bursts for extra impact
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          // since particles fall down, start a bit higher than random
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FF69B4', '#00CED1', '#ADFF2F', '#FF4500']
        });
      }

      // Play success sound (optional, assuming no strict browser policy if interacted)
      const audio = new Audio('/success.mp3');
      audio.play().catch(() => {}); // ignore catch if autoplay is blocked

      // Cooldown for 5 seconds before next scan
      setTimeout(() => {
        setMatchedEmployee(null);
        setActionType(null);
        cooldownRef.current = false;
      }, 5000);

    } catch (err) {
      console.error(err);
      toast.error("Error validando asistencia.");
      setTimeout(() => {
        cooldownRef.current = false;
      }, 3000);
    }
  };

  const checkIsBirthday = (employee: Employee | null) => {
    if (!employee || !employee.birthDate) return false;
    const bDay = new Date(employee.birthDate + 'T12:00:00');
    const now = new Date();
    return bDay.getMonth() === now.getMonth() && bDay.getDate() === now.getDate();
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
        kioskBackground ? "bg-black/60" : "bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.2)_0,rgba(0,0,0,1)_100%)]"
      )} />

      {/* Main Kiosk Content */}
      <div className="relative z-10 w-full max-w-4xl px-8 flex flex-col items-center justify-center h-full">
        
        {/* LOGO */}
        <div className="mb-10">
          {schoolLogo ? (
            <img src={schoolLogo} alt="Logo" className="h-32 md:h-40 w-auto object-contain opacity-95 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" referrerPolicy="no-referrer" />
          ) : (
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-indigo-500/20 text-indigo-400 drop-shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-500/30">
              <ScanFace size={48} />
            </div>
          )}
        </div>

        {/* Video Container (Checador) */}
        <div className="relative bg-slate-900 border-4 border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden w-full max-w-[480px] aspect-[3/4] flex items-center justify-center drop-shadow-[0_0_50px_rgba(0,0,0,0.5)] mb-10 group">
          {!modelsLoaded ? (
            <div className="flex flex-col items-center text-slate-500">
              <RefreshCw className="animate-spin mb-4 text-indigo-500" size={32} />
              <p className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-2">Inicializando Biometría</p>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">Cargando módulos de IA...</p>
            </div>
          ) : !faceMatcher ? (
             <div className="flex flex-col items-center text-slate-500 px-6 text-center">
              <ShieldAlert className="mb-4 text-rose-500" size={32} />
              <p className="text-sm font-black uppercase tracking-widest text-rose-400 mb-2">Sin Perfiles</p>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">No hay empleados registrados en la base de datos.</p>
            </div>
          ) : (
            <>
              {/* The Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100 opacity-90 filter contrast-125"
              />
              <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

              {/* Scanning Overlay (Pulse) */}
              {!matchedEmployee && isReady && (
                <div className="absolute inset-0 pointer-events-none border-4 border-indigo-500/30 rounded-[3rem] shadow-[inset_0_0_50px_rgba(99,102,241,0.2)]">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-indigo-500/50 rounded-full animate-ping opacity-20" />
                  <div className="absolute top-4 left-0 w-full flex justify-center">
                    <span className="bg-indigo-500/20 text-indigo-300 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-indigo-500/30 flex items-center gap-2">
                       <RefreshCw className="animate-spin" size={12} /> Escaneando
                    </span>
                  </div>
                </div>
              )}

              {/* Match Feedback Overlay */}
              <AnimatePresence>
                {matchedEmployee && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn(
                      "absolute inset-0 z-20 flex flex-col items-center justify-center p-8 backdrop-blur-md",
                      actionType === 'Entrada' ? "bg-emerald-950/80" : "bg-blue-950/80"
                    )}
                  >
                    <motion.div 
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className={cn(
                        "w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl relative",
                        checkIsBirthday(matchedEmployee) ? "bg-gradient-to-tr from-yellow-400 to-orange-500 text-white" : (actionType === 'Entrada' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white")
                      )}
                    >
                      {checkIsBirthday(matchedEmployee) ? (
                        <span className="text-5xl animate-bounce">🎂</span>
                      ) : (
                        actionType === 'Entrada' ? <Check size={48} strokeWidth={3} /> : <LogOutIcon size={40} strokeWidth={3} />
                      )}
                    </motion.div>
                    
                    {checkIsBirthday(matchedEmployee) ? (
                        (() => {
                          const parts = matchedEmployee!.name.split(' ');
                          const firstName = parts[0] || '';
                          const firstLastName = parts[1] || '';
                          return (
                            <div className="text-center mb-4">
                              <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-pulse">
                                ¡FELIZ CUMPLEAÑOS!
                              </h2>
                              <h3 className="text-2xl font-black text-yellow-300 tracking-tight">
                                {firstName} {firstLastName}
                              </h3>
                            </div>
                          );
                        })()
                      ) : (
                        <>
                          <h2 className="text-3xl font-black text-white text-center tracking-tight mb-2">
                            {matchedEmployee?.name}
                          </h2>
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60 mb-8">
                            {matchedEmployee?.position}
                          </p>
                        </>
                      )}

                    <div className={cn(
                      "px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest border shadow-xl flex items-center gap-3",
                      actionType === 'Entrada' 
                        ? "bg-emerald-900/50 border-emerald-500/50 text-emerald-300" 
                        : "bg-blue-900/50 border-blue-500/50 text-blue-300"
                    )}>
                      {actionType === 'Entrada' ? 'Entrada Registrada' : 'Salida Registrada'}
                      <span className="font-mono bg-black/30 px-3 py-1 rounded-lg text-white">
                        {format(new Date(), 'HH:mm')}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Realtime Clock Overlay inside Video */}
              <div className="absolute bottom-6 left-0 w-full flex justify-center z-10 px-4">
                <RealTimeClock />
              </div>
            </>
          )}
        </div>

        {/* Text Headers below video */}
        <div className="text-center space-y-4">
          <div className="inline-block bg-black/40 backdrop-blur-md px-8 py-4 rounded-[2rem] border border-white/10 shadow-2xl">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white drop-shadow-lg mb-1 leading-none">
              RELOJ CHECADOR
            </h1>
            <p className="text-sm md:text-lg font-bold text-slate-200 tracking-wide opacity-90 leading-relaxed max-w-sm mx-auto">
              Acérquese a la cámara para el reconocimiento automático de entrada o salida.
            </p>
          </div>
        </div>
        
        {/* Bottom Section (Space reserved if needed) */}
      </div>
    </div>
  );
}

function RealTimeClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  
  return (
    <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl px-6 py-2.5 rounded-[1.5rem] border border-white/10 shadow-2xl">
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 leading-none mb-1">Hora Local</span>
        <span className="font-mono text-xl font-black text-white tracking-widest leading-none">
          {format(time, 'HH:mm:ss')}
        </span>
      </div>
      <div className="w-px h-8 bg-white/10 mx-1"></div>
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 leading-none mb-1 text-center">Fecha</span>
        <span className="text-[10px] font-black uppercase tracking-tight text-indigo-300 leading-none">
          {format(time, 'EEEE d MMM, yyyy', { locale: es })}
        </span>
      </div>
    </div>
  );
}

function LogOutIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}
