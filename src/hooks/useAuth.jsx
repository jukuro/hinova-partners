import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AppLoading from '../components/AppLoading';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null); // 紐づくパートナー行（パートナーの場合）
  const [role, setRole] = useState(null);       // 'admin' | 'partner' | null
  const [loading, setLoading] = useState(true);

  // ユーザーに紐づくパートナー行を取得し、役割を判定
  const loadProfile = async (u) => {
    if (!u) { setPartner(null); setRole(null); return; }
    const { data } = await supabase
      .from('partners')
      .select('*')
      .eq('auth_user_id', u.id)
      .maybeSingle();
    if (data) { setPartner(data); setRole('partner'); }
    else { setPartner(null); setRole('admin'); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      await loadProfile(u);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      await loadProfile(u);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  const refreshProfile = () => loadProfile(user);

  return (
    <AuthContext.Provider value={{ user, partner, role, signIn, signOut, loading, refreshProfile }}>
      {loading ? <AppLoading message="読み込み中..." /> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
