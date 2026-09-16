import React, { useState } from 'react';
import { 
  UtensilsCrossed, 
  Plus, 
  Minus, 
  MapPin, 
  Navigation, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  History, 
  Settings2, 
  Info,
  Compass,
  Check,
  RotateCcw
} from 'lucide-react';
import { useRuManager, formatDistance, DEFAULT_RU_COORDS } from '../lib/useRuManager';
import { cn } from '../lib/utils';

interface RuSectionProps {
  ru: ReturnType<typeof useRuManager>;
  onNavigateHome?: () => void;
}

export const RuSection: React.FC<RuSectionProps> = ({ ru }) => {
  const {
    saldo,
    autoDeductEnabled,
    targetLat,
    targetLng,
    radiusMeters,
    lastAutoDeductDateStr,
    logs,
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
  } = ru;

  const [customQty, setCustomQty] = useState('1');
  const [showCoordsModal, setShowCoordsModal] = useState(false);
  const [editLat, setEditLat] = useState(String(targetLat));
  const [editLng, setEditLng] = useState(String(targetLng));
  const [editRadius, setEditRadius] = useState(String(radiusMeters));

  const handleManualAdd = (qty: number) => {
    addPasses(qty, 'Recarga manual');
  };

  const handleManualRemove = () => {
    if (saldo <= 0) {
      alert('Você não tem fichas para remover.');
      return;
    }
    removePasses(1, 'Consumo manual no R.U.');
  };

  const handleSaveCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(editLat);
    const lngNum = parseFloat(editLng);
    const radNum = parseFloat(editRadius);

    if (isNaN(latNum) || isNaN(lngNum) || isNaN(radNum) || radNum <= 0) {
      alert('Coordenadas ou raio inválidos.');
      return;
    }

    setTargetCoords(latNum, lngNum, radNum);
    setShowCoordsModal(false);
  };

  const handleResetCoords = () => {
    setEditLat(String(DEFAULT_RU_COORDS.lat));
    setEditLng(String(DEFAULT_RU_COORDS.lng));
    setEditRadius(String(DEFAULT_RU_COORDS.radius));
    setTargetCoords(DEFAULT_RU_COORDS.lat, DEFAULT_RU_COORDS.lng, DEFAULT_RU_COORDS.radius);
  };

  return (
    <div className="space-y-6 pb-12 pt-2 animate-in fade-in duration-300">
      
      {/* Toast / Alerta de Notificação */}
      {lastNotification && (
        <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between gap-3 text-sm font-medium animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 shrink-0 text-indigo-200" />
            <span>{lastNotification}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setLastNotification(null)}
            className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 1. Header do RU limpo */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-amber-500" />
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
            Restaurante Universitário
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowCoordsModal(true)}
          className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
        >
          <Settings2 className="w-3.5 h-3.5 text-gray-500" />
          <span>Configurar</span>
        </button>
      </div>

      {/* 2. Grid Principal: Contador de Fichas + Painel de Geolocalização */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Lado Esquerdo: Card do Contador de Fichas */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs flex flex-col justify-between h-full relative overflow-hidden">
            
            {/* Display do Contador */}
            <div className="text-center py-2">
              <div className="inline-flex flex-col items-center justify-center py-2 px-6 bg-gray-50/80 rounded-xl border border-gray-100 min-w-[120px]">
                <span className={cn(
                  "text-3xl sm:text-4xl font-black tracking-tight leading-none",
                  saldo > 0 ? "text-gray-900" : "text-gray-400"
                )}>
                  {saldo}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                  {saldo === 1 ? 'Ficha' : 'Fichas'}
                </span>
              </div>
            </div>

            {/* BOTÕES: Adicionar e Usar */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleManualAdd(1)}
                  className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  title="Adicionar 1 ficha"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Adicionar</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualRemove}
                  disabled={saldo <= 0}
                  className={cn(
                    "py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer",
                    saldo > 0
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                      : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  )}
                  title={saldo > 0 ? "Usar 1 ficha" : "Sem fichas para remover"}
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Usar</span>
                </button>
              </div>

              {/* Recarga Rápida */}
              <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleManualAdd(5)}
                  className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 transition cursor-pointer"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => handleManualAdd(10)}
                  className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 transition cursor-pointer"
                >
                  +10
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    placeholder="Qtd"
                    className="w-14 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const q = parseInt(customQty, 10);
                      if (q > 0) {
                        handleManualAdd(q);
                        setCustomQty('1');
                      }
                    }}
                    disabled={!parseInt(customQty, 10) || parseInt(customQty, 10) <= 0}
                    className="p-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md text-xs font-bold transition shadow-xs cursor-pointer"
                    title="Adicionar quantidade personalizada"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Lado Direito: Geolocalização e Gerenciamento Automático */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          
          <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Navigation className={cn("w-4 h-4", autoDeductEnabled ? "text-indigo-600" : "text-gray-400")} />
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Dedução Automática
                </h3>
              </div>

              {/* Switch Liga / Desliga */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={autoDeductEnabled} 
                  onChange={(e) => setAutoDeductEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Status do GPS e da Distância */}
            <div className="grid grid-cols-2 gap-2">
              
              {/* Box de Distância */}
              <div className={cn(
                "p-2.5 rounded-lg border",
                isInsideGeofence
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : "bg-gray-50/80 border-gray-100 text-gray-800"
              )}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Distância
                  </span>
                  <MapPin className="w-3 h-3 text-gray-400" />
                </div>
                <div className="text-base font-bold tracking-tight">
                  {distanceMeters !== null ? formatDistance(distanceMeters) : '—'}
                </div>
                <div className="text-[10px] font-semibold mt-0.5">
                  {isInsideGeofence ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      No raio
                    </span>
                  ) : (
                    <span className="text-gray-400">Fora do raio</span>
                  )}
                </div>
              </div>

              {/* Box do GPS */}
              <div className="p-2.5 rounded-lg border border-gray-100 bg-gray-50/80 text-gray-800">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    GPS
                  </span>
                  <Compass className="w-3 h-3 text-gray-400" />
                </div>
                <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5 mt-1">
                  {geoStatus === 'granted' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Ativo</span>
                    </>
                  )}
                  {geoStatus === 'prompt' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                      <span>Buscando...</span>
                    </>
                  )}
                  {geoStatus === 'denied' && (
                    <>
                      <AlertCircle className="w-3 h-3 text-rose-500" />
                      <span>Sem permissão</span>
                    </>
                  )}
                  {geoStatus === 'error' && (
                    <>
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      <span>Sem sinal</span>
                    </>
                  )}
                  {geoStatus === 'idle' && (
                    <span className="text-gray-400">Inativo</span>
                  )}
                </div>
              </div>

            </div>

            {/* Ações de Verificação e Simulação */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={checkLocationNow}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Atualizar</span>
              </button>

              {/* Botões de Simulação */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => simulatePosition(true)}
                  className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 transition cursor-pointer"
                  title="Simular dentro do raio"
                >
                  Dentro
                </button>
                <button
                  type="button"
                  onClick={() => simulatePosition(false)}
                  className="px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold border border-gray-200 transition cursor-pointer"
                  title="Simular fora do raio"
                >
                  Fora
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* 3. Extrato / Histórico de Transações de Fichas */}
      <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-700" />
            <h3 className="text-xs sm:text-sm font-bold text-gray-900">Histórico</h3>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Limpar histórico de fichas?')) {
                  clearLogs();
                }
              }}
              className="text-[11px] font-semibold text-gray-400 hover:text-rose-600 transition cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-6 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-xs">
            Sem registros
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Qtd</th>
                  <th className="pb-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-medium">
                {logs.map((item) => (
                  <tr key={item.id || item.timestamp} className="hover:bg-gray-50/60 transition">
                    <td className="py-2 text-gray-500 whitespace-nowrap">
                      {item.dataHora || new Date(item.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2">
                      {item.tipo === 'ADD' && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          + Adição
                        </span>
                      )}
                      {item.tipo === 'REMOVE' && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                          - Uso
                        </span>
                      )}
                      {item.tipo === 'AUTO_DEDUCT' && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1 w-fit">
                          <Navigation className="w-2.5 h-2.5" />
                          GPS
                        </span>
                      )}
                    </td>
                    <td className="py-2 font-bold">
                      {item.tipo === 'ADD' ? (
                        <span className="text-emerald-600">+{item.quantidade}</span>
                      ) : (
                        <span className="text-rose-600">-{item.quantidade}</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-bold text-gray-900">
                      {item.saldoResultante}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Configuração de Coordenadas do R.U. */}
      {showCoordsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <span>Configurar Coordenadas do R.U.</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowCoordsModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCoords} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  value={editLat}
                  onChange={(e) => setEditLat(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  Longitude
                </label>
                <input
                  type="text"
                  value={editLng}
                  onChange={(e) => setEditLng(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  Raio (metros)
                </label>
                <input
                  type="number"
                  min="50"
                  max="5000"
                  value={editRadius}
                  onChange={(e) => setEditRadius(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleResetCoords}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrão</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCoordsModal(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
