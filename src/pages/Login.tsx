import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { GraduationCap, Lock, Mail, AlertCircle, UserPlus, ArrowLeft, User, CheckCircle2, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<'code' | 'form'>('code');
  const [registrationCode, setRegistrationCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [schoolName, setSchoolName] = useState('Colegio México Franciscano');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setLogoUrl(data.logoUrl || '');
          if (data.schoolName) {
            setSchoolName(data.schoolName);
            document.title = data.schoolName;
          }
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        if (registrationStep === 'code') {
          // 1. Validate registration code
          const studentsQuery = query(
            collection(db, 'students'), 
            where('registrationCode', '==', registrationCode.trim())
          );
          const querySnapshot = await getDocs(studentsQuery);

          if (querySnapshot.empty) {
            setError('El código de registro no es válido. Por favor, contacta a la administración.');
            setLoading(false);
            return;
          }

          // Code is valid, move to form step
          setRegistrationStep('form');
          setLoading(false);
          return;
        }

        // 2. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. Send Verification Email
        await sendEmailVerification(user);

        // 4. Create User Profile
        await setDoc(doc(db, 'users', user.uid), {
          id: user.uid,
          email: email.toLowerCase().trim(),
          name: name,
          phone: phone,
          role: 'Padre',
          registrationCode: registrationCode.trim(),
          permissions: {
            dashboard: { view: true },
            students: { view: true, create: false, edit: false, delete: false, viewHistory: true },
            payments: { view: true, create: false, cancel: false, invoice: false, downloadInvoice: true },
            expenses: { view: false, create: false, edit: false, delete: false },
            settings: { view: false, editGeneral: false, editCycles: false, editRules: false, manageUsers: false }
          },
          createdAt: serverTimestamp()
        });

        // 5. Update all students with this registration code to have this parent email
        const studentsQuery = query(
          collection(db, 'students'), 
          where('registrationCode', '==', registrationCode.trim())
        );
        const querySnapshot = await getDocs(studentsQuery);
        
        const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
        const updatePromises = querySnapshot.docs.map(studentDoc => 
          updateDoc(firestoreDoc(db, 'students', studentDoc.id), {
            parentEmail: email.toLowerCase().trim()
          })
        );
        await Promise.all(updatePromises);

        setVerificationSent(true);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if user is a parent and if email is verified
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

        if (userData?.role === 'Padre' && !user.emailVerified) {
          setVerificationSent(true);
          setLoading(false);
          return;
        }

        navigate('/');
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya tiene una cuenta registrada.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError(`Error: ${err.message || 'Problema de conexión'}`);
      }
    } finally {
      if (!verificationSent) setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Verifica tu correo!</h2>
          <p className="text-slate-500 mb-6">
            Hemos enviado un enlace de confirmación a <strong>{email}</strong>. 
            Por favor, revisa tu bandeja de entrada (y la carpeta de spam) para activar tu cuenta.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-100 transition-all"
            >
              Ya lo verifiqué, entrar
            </button>
            <button
              onClick={() => {
                setVerificationSent(false);
                signOut(auth);
              }}
              className="w-full text-slate-500 font-medium py-2 hover:text-slate-800 transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 shadow-lg shadow-slate-200 overflow-hidden border border-slate-100">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
            ) : (
              <GraduationCap size={40} className="text-blue-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{schoolName}</h1>
          <p className="text-slate-500 mt-1">Sistema de Control Escolar - {schoolName}</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">
              {isRegistering ? 'Registro de Padre' : 'Iniciar Sesión'}
            </h2>
            {isRegistering && (
              <button 
                onClick={() => {
                  setIsRegistering(false);
                  setError('');
                }}
                className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline"
              >
                <ArrowLeft size={14} />
                Volver
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && registrationStep === 'code' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 text-center mb-4">
                  Ingresa el código de 5 dígitos proporcionado por el colegio para vincular tu cuenta.
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Código Temporal de Registro</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={registrationCode}
                      onChange={(e) => setRegistrationCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none font-mono font-bold text-center text-xl tracking-[0.5em]"
                      placeholder="00000"
                    />
                  </div>
                </div>
              </div>
            )}

            {isRegistering && registrationStep === 'form' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      placeholder="Tu nombre completo"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Celular</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      placeholder="10 dígitos"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            )}

            {!isRegistering && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      placeholder="admin@colegiomexico.edu.mx"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full text-white font-semibold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-70",
                isRegistering ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
              )}
            >
              {loading ? 'Procesando...' : isRegistering ? (registrationStep === 'code' ? 'Validar Código' : 'Crear mi Cuenta') : 'Entrar al Sistema'}
            </button>

            {!isRegistering && (
              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(true);
                    setRegistrationStep('code');
                    setError('');
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors"
                >
                  <UserPlus size={16} />
                  ¿Eres padre/madre de familia? Regístrate aquí
                </button>
              </div>
            )}
          </form>
        </div>

        <div className="text-center mt-8 space-y-1">
          <p className="text-slate-400 text-xs font-medium">
            ASOCIACION EDUCADORA DEL SUR DE JALISCO
          </p>
          <p className="text-slate-400 text-[10px]">
            Creado por CIUDAPP MX - Cristobal Moran
          </p>
        </div>
      </div>
    </div>
  );
}
