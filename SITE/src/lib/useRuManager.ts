import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  query, 
  orderBy, 
  limit, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import type { RuConfig, RuLog } from '../types';

export const DEFAULT_RU_COORDS = {
  lat: -7.955448259560658,
  lng: -38.29594815743501,
  name: 'Restaurante Universitário (R.U.)',
  institution: 'UFRPE - UAST',
  radius: 700, // 700 metros conforme solicitado
};

// Fórmula de Haversine para cálculo de distância precisa em metros
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio da Terra em metros
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistance(meters: number | null): string {
  if (meters === null) return 'Calculando...';
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return `${km.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} km`;
}

export function useRuManager(userId: string | undefined) {
  const [config, setConfig] = useState<RuConfig>({
    saldo: 0,
    autoDeductEnabled: true,
    targetLat: DEFAULT_RU_COORDS.lat,
    targetLng: DEFAULT_RU_COORDS.lng,
    radiusMeters: DEFAULT_RU_COORDS.radius,
    updatedAt: Date.now(),
  });

  const [logs, setLogs] = useState<RuLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Localização do dispositivo do usuário
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
  } | null>(null);

  const [geoStatus, setGeoStatus] = useState<'idle' | 'prompt' | 'granted' | 'denied' | 'error' | 'unsupported'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const isDeductingRef = useRef(false);

  // 1. Sincronização em tempo real da configuração do RU com Firestore
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', userId, 'ru', 'config');
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as RuConfig;
        setConfig(prev => ({
          ...prev,
          ...data,
          targetLat: data.targetLat ?? DEFAULT_RU_COORDS.lat,
          targetLng: data.targetLng ?? DEFAULT_RU_COORDS.lng,
          radiusMeters: data.radiusMeters ?? DEFAULT_RU_COORDS.radius,
          autoDeductEnabled: data.autoDeductEnabled ?? true,
          saldo: Number.isFinite(data.saldo) ? data.saldo : 0,
        }));
      } else {
        // Inicializa com padrão
        const initial: RuConfig = {
          saldo: 0,
          autoDeductEnabled: true,
          targetLat: DEFAULT_RU_COORDS.lat,
          targetLng: DEFAULT_RU_COORDS.lng,
          radiusMeters: DEFAULT_RU_COORDS.radius,
          updatedAt: Date.now(),
        };
        setDoc(docRef, initial).catch(console.error);
        setConfig(initial);
      }
      setLoading(false);
    }, (err) => {
      console.error("Erro ao sincronizar RU config:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  // 2. Sincronização dos logs de movimentação (Extrato do RU)
  useEffect(() => {
    if (!userId) return;

    const logsQuery = query(
      collection(db, 'users', userId, 'ru_logs'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );

    const unsub = onSnapshot(logsQuery, (snap) => {
      const items: RuLog[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as RuLog[];
      setLogs(items);
    }, (err) => {
      console.error("Erro ao sincronizar RU logs:", err);
    });

    return () => unsub();
  }, [userId]);

  // 3. Salvar configuração no Firestore
  const saveConfig = useCallback(async (newConfig: Partial<RuConfig>) => {
    if (!userId) return;
    try {
      const docRef = doc(db, 'users', userId, 'ru', 'config');
      await setDoc(docRef, {
        ...config,
        ...newConfig,
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (err) {
      console.error("Erro ao salvar config RU:", err);
    }
  }, [userId, config]);

  // 4. Registrar log de transação de fichas
  const appendLog = useCallback(async (entry: Omit<RuLog, 'id'>) => {
    if (!userId) return;
    try {
      const logRef = doc(collection(db, 'users', userId, 'ru_logs'));
      await setDoc(logRef, entry);
    } catch (err) {
      console.error("Erro ao registrar log RU:", err);
    }
  }, [userId]);

  // 5. Adicionar fichas manualmente (Botão Verde)
  const addPasses = useCallback(async (amount: number = 1, motivo: string = 'Adição manual') => {
    if (amount <= 0) return;
    const novoSaldo = (config.saldo || 0) + amount;
    setConfig(prev => ({ ...prev, saldo: novoSaldo }));

    const nowStr = new Date().toLocaleString('pt-BR');
    await saveConfig({ saldo: novoSaldo });
    await appendLog({
      tipo: 'ADD',
      quantidade: amount,
      saldoResultante: novoSaldo,
      motivo,
      timestamp: Date.now(),
      dataHora: nowStr,
    });
    setLastNotification(`+${amount} ficha(s) adicionada(s)! Saldo atual: ${novoSaldo}`);
  }, [config.saldo, saveConfig, appendLog]);

  // 6. Remover fichas manualmente (Botão Vermelho)
  const removePasses = useCallback(async (amount: number = 1, motivo: string = 'Uso manual no R.U.') => {
    if (amount <= 0) return;
    if ((config.saldo || 0) <= 0) {
      setLastNotification('Você não possui fichas disponíveis para descontar.');
      return false;
    }

    const novoSaldo = Math.max(0, (config.saldo || 0) - amount);
    setConfig(prev => ({ ...prev, saldo: novoSaldo }));

    const nowStr = new Date().toLocaleString('pt-BR');
    await saveConfig({ saldo: novoSaldo });
    await appendLog({
      tipo: 'REMOVE',
      quantidade: amount,
      saldoResultante: novoSaldo,
      motivo,
      timestamp: Date.now(),
      dataHora: nowStr,
    });
    setLastNotification(`-${amount} ficha(s) utilizada(s)! Saldo restante: ${novoSaldo}`);
    return true;
  }, [config.saldo, saveConfig, appendLog]);

  // 7. Desconto Automático por Proximidade (Geofencing)
  const executeAutoDeduct = useCallback(async (currentDist: number) => {
    if (isDeductingRef.current) return;
    if (!config.autoDeductEnabled) return;
    if ((config.saldo || 0) <= 0) {
      setLastNotification('Você está no R.U., mas não possui fichas disponíveis.');
      return;
    }

    // Regra anti-loop: desconta no máximo uma vez a cada 2 horas (para almoço/jantar)
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const now = Date.now();
    if (config.lastAutoDeductTimestamp && now - config.lastAutoDeductTimestamp < twoHoursMs) {
      const minutesAgo = Math.max(1, Math.round((now - config.lastAutoDeductTimestamp) / 60000));
      setLastNotification(`📍 Você está no perímetro do R.U. (${currentDist}m). Nenhuma ficha foi descontada agora pois já houve um desconto há ${minutesAgo} min (proteção de 2h contra cobrança dupla). Saldo: ${config.saldo}`);
      return;
    }

    isDeductingRef.current = true;
    try {
      const novoSaldo = Math.max(0, (config.saldo || 0) - 1);
      const nowStr = new Date().toLocaleString('pt-BR');

      setConfig(prev => ({ 
        ...prev, 
        saldo: novoSaldo, 
        lastAutoDeductTimestamp: now,
        lastAutoDeductDateStr: nowStr 
      }));

      await saveConfig({
        saldo: novoSaldo,
        lastAutoDeductTimestamp: now,
        lastAutoDeductDateStr: nowStr
      });

      await appendLog({
        tipo: 'AUTO_DEDUCT',
        quantidade: 1,
        saldoResultante: novoSaldo,
        motivo: `Desconto automático por proximidade (${currentDist}m do R.U.)`,
        timestamp: now,
        dataHora: nowStr,
      });

      setLastNotification(`📍 1 ficha descontada automaticamente! Você está a ${currentDist}m do R.U. Saldo: ${novoSaldo}`);
    } finally {
      isDeductingRef.current = false;
    }
  }, [config.autoDeductEnabled, config.saldo, config.lastAutoDeductTimestamp, saveConfig, appendLog]);

  // 8. Processar uma leitura de coordenadas do GPS
  const handlePositionSuccess = useCallback((pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;

    setUserLocation({
      lat,
      lng,
      accuracy,
      timestamp: pos.timestamp,
    });
    setGeoStatus('granted');
    setGeoError(null);

    const dist = calculateDistanceMeters(
      lat,
      lng,
      config.targetLat || DEFAULT_RU_COORDS.lat,
      config.targetLng || DEFAULT_RU_COORDS.lng
    );
    setDistanceMeters(dist);

    const inside = dist <= (config.radiusMeters || DEFAULT_RU_COORDS.radius);
    setIsInsideGeofence(inside);

    // Se estiver a menos de 700m e o gerenciamento automático estiver ativo, considera descontar
    if (inside && config.autoDeductEnabled) {
      executeAutoDeduct(dist);
    }
  }, [config.targetLat, config.targetLng, config.radiusMeters, config.autoDeductEnabled, executeAutoDeduct]);

  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    let msg = 'Não foi possível obter sua localização.';
    if (err.code === err.PERMISSION_DENIED) {
      setGeoStatus('denied');
      msg = 'Permissão de localização negada pelo navegador.';
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setGeoStatus('error');
      msg = 'Sinal de GPS indisponível no momento.';
    } else if (err.code === err.TIMEOUT) {
      setGeoStatus('error');
      msg = 'Tempo limite esgotado ao buscar GPS.';
    }
    setGeoError(msg);
  }, []);

  // 9. Solicitar e monitorar localização do usuário
  const checkLocationNow = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      setGeoError('Seu navegador não suporta geolocalização.');
      return;
    }

    setGeoStatus('prompt');
    navigator.geolocation.getCurrentPosition(
      handlePositionSuccess,
      (err) => {
        // Se falhar em alta precisão, tenta modo padrão
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            handlePositionSuccess,
            handlePositionError,
            { enableHighAccuracy: false, timeout: 10000 }
          );
        } else {
          handlePositionError(err);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [handlePositionSuccess, handlePositionError]);

  // Ativa o monitoramento contínuo de localização
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }

    // Solicita uma checagem inicial
    checkLocationNow();

    // Se o gerenciamento automático estiver ativado, monitora continuamente
    if (config.autoDeductEnabled) {
      try {
        const id = navigator.geolocation.watchPosition(
          handlePositionSuccess,
          handlePositionError,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 }
        );
        watchIdRef.current = id;
      } catch (e) {
        console.warn('Erro ao registrar watchPosition:', e);
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [config.autoDeductEnabled, checkLocationNow, handlePositionSuccess, handlePositionError]);

  // 10. Alternar status do gerenciamento automático
  const setAutoDeductEnabled = useCallback(async (enabled: boolean) => {
    setConfig(prev => ({ ...prev, autoDeductEnabled: enabled }));
    await saveConfig({ autoDeductEnabled: enabled });
    if (enabled) {
      checkLocationNow();
      setLastNotification('Gerenciamento automático ativado. Fichas serão descontadas a menos de 700m do R.U.');
    } else {
      setLastNotification('Gerenciamento automático desativado. Nenhuma ficha será descontada automaticamente.');
    }
  }, [saveConfig, checkLocationNow]);

  // 11. Ajustar Coordenadas e Raio
  const setTargetCoords = useCallback(async (lat: number, lng: number, radius: number = DEFAULT_RU_COORDS.radius) => {
    setConfig(prev => ({ ...prev, targetLat: lat, targetLng: lng, radiusMeters: radius }));
    await saveConfig({ targetLat: lat, targetLng: lng, radiusMeters: radius });
    checkLocationNow();
  }, [saveConfig, checkLocationNow]);

  // 12. Simulação de proximidade (ideal para testar sem estar fisicamente no RU)
  const simulatePosition = useCallback((inside: boolean) => {
    const lat = inside 
      ? config.targetLat + 0.001 // aprox 110 metros do ponto
      : config.targetLat + 0.02; // aprox 2.2 km de distância
    const lng = inside 
      ? config.targetLng + 0.001 
      : config.targetLng + 0.02;

    const fakeDist = inside ? 150 : 2800;
    setUserLocation({ lat, lng, accuracy: 10, timestamp: Date.now() });
    setGeoStatus('granted');
    setGeoError(null);
    setDistanceMeters(fakeDist);
    setIsInsideGeofence(inside);

    if (inside && config.autoDeductEnabled) {
      executeAutoDeduct(fakeDist);
    } else if (inside) {
      setLastNotification(`Você está simulando estar no R.U. (${fakeDist}m), mas o gerenciamento automático está desativado.`);
    } else {
      setLastNotification(`Simulação: Fora do R.U. (${formatDistance(fakeDist)}).`);
    }
  }, [config.targetLat, config.targetLng, config.autoDeductEnabled, executeAutoDeduct]);

  // 13. Limpar logs
  const clearLogs = useCallback(async () => {
    if (!userId) return;
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'ru_logs'));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      setLogs([]);
      setLastNotification('Histórico de fichas limpo.');
    } catch (err) {
      console.error('Erro ao limpar logs:', err);
    }
  }, [userId]);

  return {
    config,
    saldo: config.saldo || 0,
    autoDeductEnabled: Boolean(config.autoDeductEnabled),
    targetLat: config.targetLat || DEFAULT_RU_COORDS.lat,
    targetLng: config.targetLng || DEFAULT_RU_COORDS.lng,
    radiusMeters: config.radiusMeters || DEFAULT_RU_COORDS.radius,
    lastAutoDeductDateStr: config.lastAutoDeductDateStr,
    logs,
    loading,
    userLocation,
    geoStatus,
    geoError,
    distanceMeters,
    isInsideGeofence,
    lastNotification,
    setLastNotification,
    addPasses,
    removePasses,
    setAutoDeductEnabled,
    setTargetCoords,
    checkLocationNow,
    simulatePosition,
    clearLogs,
  };
}
