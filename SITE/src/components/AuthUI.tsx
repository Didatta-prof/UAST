import React from 'react';
import { useAuth } from '../lib/hooks';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const AuthUI: React.FC = () => {
  const { user, loading } = useAuth();
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Initialize profile if it doesn't exist
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              name: result.user.displayName || 'Estudante',
              university: 'Minha Universidade',
              course: 'Meu Curso',
              period: '1º Período',
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${result.user.uid}`);
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error?.code === 'auth/unauthorized-domain') {
        setAuthError(
          'Domínio não autorizado pelo Firebase. O domínio ufrpe.vercel.app precisa ser adicionado na lista de Domínios Autorizados no Console do Firebase.'
        );
      } else if (error?.code === 'auth/popup-closed-by-user') {
        setAuthError('O login foi cancelado antes de ser concluído.');
      } else if (error?.code === 'auth/popup-blocked') {
        setAuthError('O navegador bloqueou a janela pop-up do login. Por favor, permita pop-ups para este site.');
      } else {
        setAuthError(error?.message || 'Erro ao realizar login com o Google.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m0-6l-9 5m9-5l9 5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Universidade Tracker</h2>

        {authError && (
          <div className="mb-6 max-w-md p-4 bg-rose-50 border border-rose-200 rounded-2xl text-left">
            <div className="flex items-start gap-3">
              <span className="text-rose-500 text-lg leading-none mt-0.5">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-rose-800">{authError}</p>
                {authError.includes('ufrpe.vercel.app') && (
                  <p className="text-[11px] text-rose-600 mt-2">
                    Acesse o Firebase Console &gt; Authentication &gt; Configurações (Settings) &gt; Domínios autorizados e adicione: <strong className="font-mono bg-rose-100 px-1 py-0.5 rounded">ufrpe.vercel.app</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={authLoading}
          className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          {authLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Conectando...</span>
            </>
          ) : (
            <span>Entrar com Google</span>
          )}
        </button>
      </div>
    );
  }

  return null;
};
