import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { GraduationCap, Lock, Mail, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError(`Error: ${err.message || 'Problema de conexión'}`);
      }
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="text-xl font-semibold text-slate-800 mb-6">
            Iniciar Sesión
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {loading ? 'Cargando...' : 'Entrar al Sistema'}
            </button>
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
