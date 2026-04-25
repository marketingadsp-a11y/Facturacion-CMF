import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { GraduationCap, Lock, Mail, AlertCircle, UserPlus, ArrowLeft, User, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<'code' | 'form'>('code');
  const [registrationCode, setRegistrationCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [schoolName, setSchoolName] = useState('Colegio México Franciscano');
  const [loginTitle, setLoginTitle] = useState('Sistema de Control');
  const [loginSubtitle, setLoginSubtitle] = useState('Colegio México Franciscano');
  const [developerAttribution, setDeveloperAttribution] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setLogoUrl(data.logoUrl || '');
          setLoginTitle(data.loginTitle || '');
          setLoginSubtitle(data.loginSubtitle || '');
          if (data.schoolName) {
            setSchoolName(data.schoolName);
            document.title = data.schoolName;
          }
          if (data.developerAttribution) {
            setDeveloperAttribution(data.developerAttribution);
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

        if (email.toLowerCase().trim() !== confirmEmail.toLowerCase().trim()) {
          setError('Los correos electrónicos no coinciden.');
          setLoading(false);
          return;
        }

        // 2. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. Create User Profile
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

        navigate('/');
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if user is a parent and if email is verified
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans tracking-tight">
      <div className="w-full max-w-sm">
        <div className="mb-12 text-center flex flex-col items-center">
          <div className="w-64 h-64 flex items-center justify-center mb-6">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
            ) : (
              <GraduationCap size={128} className="text-slate-900" strokeWidth={1} />
            )}
          </div>
          {loginTitle && (
            <h1 className="text-slate-900 text-base font-black uppercase tracking-[0.3em] mb-1">{loginTitle}</h1>
          )}
          {loginSubtitle && (
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">{loginSubtitle}</p>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-black uppercase tracking-[0.15em] text-slate-800">
                {isRegistering ? 'Vincular Familia' : ''}
              </h2>
              {isRegistering && (
                <button 
                  onClick={() => {
                    setIsRegistering(false);
                    setError('');
                  }}
                  className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft size={10} />
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
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      maxLength={5}
                      value={registrationCode}
                      onChange={(e) => setRegistrationCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-950 focus:border-slate-950 transition-all outline-none font-mono font-black text-center text-xl tracking-[0.5em]"
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
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-950 focus:border-slate-950 transition-all outline-none text-xs"
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
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-950 focus:border-slate-950 transition-all outline-none text-xs"
                      placeholder="usuario@cmfranciscano.mx"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      required
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-950 focus:border-slate-950 transition-all outline-none text-xs"
                      placeholder="Repite tu correo"
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
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-950 focus:border-slate-950 transition-all outline-none text-xs"
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
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-950 focus:border-slate-950 transition-all outline-none text-xs"
                      placeholder="usuario@cmfranciscano.mx"
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
                "w-full text-white font-black uppercase tracking-[0.15em] text-[10px] py-3.5 rounded-md shadow-2xl transition-all active:scale-[0.98] disabled:opacity-70",
                "bg-slate-950 hover:bg-black font-black"
              )}
            >
              {loading ? 'Procesando...' : isRegistering ? (registrationStep === 'code' ? 'Validar Código' : 'Crear mi Cuenta') : 'Ingresar'}
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
      </div>

      <div className="text-center mt-12 space-y-2">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
            ASOCIACION EDUCADORA DEL SUR DE JALISCO
          </p>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest bg-slate-950/5 inline-block px-3 py-1 rounded-full">
            {developerAttribution || 'Powered by Antigravity'}
          </p>
        </div>
      </div>
    </div>
  );
}
