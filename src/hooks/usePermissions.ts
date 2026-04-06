import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AppUser, AppPermissions } from '../types';

const DEFAULT_PERMISSIONS: AppPermissions = {
  dashboard: { view: true },
  students: { view: true, create: true, edit: true, delete: true, viewHistory: true },
  payments: { view: true, create: true, cancel: true, invoice: true, downloadInvoice: true },
  expenses: { view: true, create: true, edit: true, delete: true },
  settings: { view: true, editGeneral: true, editCycles: true, editRules: true, manageUsers: true }
};

export function usePermissions() {
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) {
            setUserProfile({ id: snap.id, ...snap.data() } as AppUser);
          } else {
            // If no profile exists, maybe it's the first superadmin or a new user
            // For now, let's assume if no profile, they have no permissions unless they are the owner
            setUserProfile(null);
          }
          setLoading(false);
        });
        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const hasPermission = (section: keyof AppPermissions, action: string): boolean => {
    // If user is the owner, they always have all permissions even if profile is loading
    if (auth.currentUser?.email?.toLowerCase() === 'cramonmb@gmail.com') return true;
    
    if (!userProfile) return false;
    // Superadministrador always has all permissions
    if (userProfile.role === 'Superadministrador') return true;
    
    const sectionPerms = userProfile.permissions[section] as any;
    return sectionPerms ? !!sectionPerms[action] : false;
  };

  return { userProfile, hasPermission, loading };
}
