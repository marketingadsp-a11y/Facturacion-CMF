import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation,
  Link
} from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './firebase';
import { doc, getDoc, onSnapshot, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { usePermissions, PermissionsProvider } from './hooks/usePermissions';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Settings as SettingsIcon, 
  LogOut,
  GraduationCap,
  ShieldAlert,
  Menu,
  X
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Pages
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import ParentDashboard from './pages/ParentDashboard';
import Settings from './pages/Settings';
import Login from './pages/Login';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [user] = useAuthState(auth);
  const { userProfile, hasPermission, loading } = usePermissions();
  const [logoUrl, setLogoUrl] = useState('');
  const [schoolName, setSchoolName] = useState('Colegio México Franciscano');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  useEffect(() => {
    // Fetch settings for logo and name
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLogoUrl(data.logoUrl || '');
        if (data.schoolName) {
          setSchoolName(data.schoolName);
          document.title = data.schoolName;
        }
      }
    });

    // Auto-create SuperAdmin for the owner email if it doesn't exist
    // Only run if we are sure the profile doesn't exist (loading is false)
    if (user?.email?.toLowerCase() === 'cramonmb@gmail.com' && !loading && !userProfile) {
      const createSuperAdmin = async () => {
        try {
          // Double check with a direct fetch to avoid race conditions with onSnapshot
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              id: user.uid,
              email: user.email,
              name: 'Super Admin',
              role: 'Superadministrador',
              permissions: {
                dashboard: { view: true },
                students: { view: true, create: true, edit: true, delete: true, viewHistory: true },
                payments: { view: true, create: true, cancel: true, invoice: true, downloadInvoice: true },
                expenses: { view: true, create: true, edit: true, delete: true },
                settings: { view: true, editGeneral: true, editCycles: true, editRules: true, manageUsers: true }
              },
              createdAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Error creating superadmin:", err);
        }
      };
      createSuperAdmin();
    }

    return () => unsubSettings();
  }, [user?.uid, loading, !!userProfile]);
  
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, section: 'dashboard', action: 'view' },
    { name: 'Alumnos', path: '/students', icon: Users, section: 'students', action: 'view' },
    { name: 'Pagos', path: '/payments', icon: CreditCard, section: 'payments', action: 'view' },
    { name: 'Gastos', path: '/expenses', icon: CreditCard, section: 'expenses', action: 'view' },
    { name: 'Ajustes', path: '/settings', icon: SettingsIcon, section: 'settings', action: 'view' },
  ];

  const handleLogout = () => auth.signOut();

  const isParent = userProfile?.role === 'Padre';

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!userProfile && user?.email?.toLowerCase() !== 'cramonmb@gmail.com') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h1>
        <p className="text-slate-500 max-w-md mb-6">
          Tu cuenta ({user?.email}) no tiene permisos para acceder al sistema. 
          Por favor, contacta al Superadministrador para que te asigne un rol.
        </p>
        <button
          onClick={handleLogout}
          className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans">
      {/* Sidebar - Hidden on mobile for parents, toggleable for others */}
      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col transition-all duration-300",
        isParent ? "hidden md:flex md:w-64" : "hidden md:flex md:w-64"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
            ) : (
              <div className="bg-blue-600 w-full h-full flex items-center justify-center text-white">
                <GraduationCap size={20} />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-sm leading-tight truncate max-w-[140px]">
              {schoolName}
            </h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.filter(item => hasPermission(item.section as any, item.action)).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                location.pathname === item.path
                  ? "bg-blue-50 text-blue-600 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={18} />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
              {userProfile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">{userProfile?.name || user?.email}</p>
              <p className="text-[10px] text-slate-500">{userProfile?.role || 'Sin Rol'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white border-b border-slate-100 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <GraduationCap size={16} />
          </div>
          <span className="font-bold text-slate-800 text-sm truncate max-w-[150px]">{schoolName}</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
          {userProfile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <GraduationCap size={16} />
                  </div>
                  <span className="font-bold text-slate-800 text-sm truncate max-w-[140px]">{schoolName}</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {userProfile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{userProfile?.name || user?.email}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{userProfile?.role || 'Sin Rol'}</p>
                  </div>
                </div>
              </div>

              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.filter(item => hasPermission(item.section as any, item.action)).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                      location.pathname === item.path
                        ? "bg-blue-50 text-blue-600 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon size={20} />
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all duration-200"
                >
                  <LogOut size={20} />
                  Cerrar Sesión
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [user, loading] = useAuthState(auth);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;

  return <Layout>{children}</Layout>;
};

const AppContent = () => {
  const { userProfile } = usePermissions();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            {userProfile?.role === 'Padre' ? <ParentDashboard /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/students" 
        element={
          <ProtectedRoute>
            <Students />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/payments" 
        element={
          <ProtectedRoute>
            <Payments />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/expenses" 
        element={
          <ProtectedRoute>
            <Expenses />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

export default function App() {
  return (
    <PermissionsProvider>
      <Router>
        <AppContent />
      </Router>
    </PermissionsProvider>
  );
}
