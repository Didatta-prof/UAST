import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import type { Nota, Frequencia, Progresso, Disciplina, UserProfile } from '../types';

export function useAuth() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, loading };
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(docRef, 
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile({ id: snapshot.id, ...snapshot.data() } as UserProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { profile, loading };
}

export function useCollection<T>(userId: string | undefined, collectionName: string) {
  const cacheKey = userId ? `ufrpe_coll_${userId}_${collectionName}` : null;

  const [data, setData] = useState<T[]>(() => {
    if (!cacheKey) return [];
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as T[];
    } catch (e) {
      console.warn(`Erro ao ler cache local de ${collectionName}:`, e);
    }
    return [];
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !cacheKey) {
      setData([]);
      setLoading(false);
      return;
    }

    // Carregar cache local inicial caso o state esteja vazio
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached) as T[]);
      }
    } catch (e) {
      console.warn(`Erro ao ler cache local de ${collectionName}:`, e);
    }

    const q = query(
      collection(db, 'users', userId, collectionName),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as unknown as T[];
        setData(items);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(items));
        } catch (e) {
          console.warn(`Erro ao salvar cache local de ${collectionName}:`, e);
        }
        setLoading(false);
      },
      (error) => {
        console.warn(`Firestore onSnapshot warning para users/${userId}/${collectionName}:`, error);
        // Não quebrar o app se Firestore falhar: manter os dados locais do cache
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, collectionName, cacheKey]);

  const add = async (item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!userId) return;
    const now = Date.now();
    const newRef = doc(collection(db, 'users', userId, collectionName));
    const newItem: T = {
      id: newRef.id,
      ...item,
      createdAt: now,
      updatedAt: now,
    } as unknown as T;

    // Atualização otimista imediata na UI e no cache local
    setData(prev => {
      const next = [newItem, ...prev.filter((x: any) => x.id !== newRef.id)];
      if (cacheKey) {
        try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch (e) {}
      }
      return next;
    });

    try {
      await setDoc(newRef, {
        ...item,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      console.warn(`Aviso: salvamento em nuvem falhou para ${collectionName}, mantido em cache local:`, err);
    }
  };

  const update = async (id: string, updates: Partial<T>) => {
    if (!userId) return;
    const now = Date.now();

    // Atualização otimista imediata
    setData(prev => {
      const next = prev.map((x: any) => x.id === id ? { ...x, ...updates, updatedAt: now } : x);
      if (cacheKey) {
        try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch (e) {}
      }
      return next;
    });

    try {
      const docRef = doc(db, 'users', userId, collectionName, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: now,
      });
    } catch (err) {
      console.warn(`Aviso: atualização em nuvem falhou para ${collectionName}, mantido em cache local:`, err);
    }
  };

  const remove = async (id: string) => {
    if (!userId) return;

    // Remoção otimista imediata
    setData(prev => {
      const next = prev.filter((x: any) => x.id !== id);
      if (cacheKey) {
        try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch (e) {}
      }
      return next;
    });

    try {
      const docRef = doc(db, 'users', userId, collectionName, id);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn(`Aviso: exclusão em nuvem falhou para ${collectionName}:`, err);
    }
  };

  return { data, loading, add, update, remove };
}
