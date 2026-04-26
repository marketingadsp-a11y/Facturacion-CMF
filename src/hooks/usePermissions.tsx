import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AppUser, AppPermissions } from '../types';

interface PermissionsContextType {
  userProfile: AppUser | null;
  loading: boolean;
  hasPermission: (section: keyof AppPermissions, action: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) {
            setUserProfile({ id: snap.id, ...snap.data() } as AppUser);
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user profile:", error);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const hasPermission = (section: keyof AppPermissions, action: string): boolean => {
    if (auth.currentUser?.email?.toLowerCase() === 'cramonmb@gmail.com') return true;
    if (!userProfile) return false;
    if (userProfile.role === 'Superadministrador') return true;
    
    const sectionPerms = userProfile.permissions[section] as any;
    return sectionPerms ? !!sectionPerms[action] : false;
  };

  return (
    <PermissionsContext.Provider value={{ userProfile, loading, hasPermission }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
