import React, { useState, useMemo } from 'react';
import type { Nota, Frequencia, Progresso, Horario, Disciplina } from '../types';
import { 
  CalendarDays, 
  MapPin, 
  UtensilsCrossed, 
  Plus, 
  Minus, 
  CheckCircle2, 
  RefreshCw, 
  Calendar,
  Edit3,
  Trash2,
  ArrowRight,
  X,
  Clock
} from 'lucide-react';
import type { useRuManager } from '../lib/useRuManager';
import { formatDistance } from '../lib/useRuManager';
import { cn } from '../lib/utils';
import { FrequencyRegisterModal } from './FrequencyRegisterModal';
import { Modal, Input, Label } from './ui';
import { getGroupedDisciplinasByPeriod } from '../lib/academicDisciplinas';

interface SummarySectionProps {
  notas: Nota[];
  frequencias: Frequencia[];
  progressos: Progresso[];
  horarios?: Horario[];
  period: string;
  disciplinas?: Disciplina[];
  onAddFreq?: (f: Omit<Frequencia, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateFreq?: (id: string, updates: Partial<Frequencia>) => void;
  onDeleteFreq?: (id: string) => void;
  onAddHorario?: (h: Omit<Horario, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void;
  onUpdateHorario?: (id: string, updates: Partial<Horario>) => Promise<void> | void;
  onDeleteHorario?: (id: string) => Promise<void> | void;
  ru?: ReturnType<typeof useRuManager>;
  onNavigateToRu?: () => void;
}

export const SummarySection: React.FC<SummarySectionProps> = ({ 
  notas, 
  frequencias, 
  progressos, 
  horarios = [], 
  period, 
  disciplinas = [],
  onAddFreq,
  onUpdateFreq,
  onDeleteFreq,
  onAddHorario,
  onUpdateHorario,
  onDeleteHorario,
  ru,
  onNavigateToRu
}) => {
  const [isFreqModalOpen, setIsFreqModalOpen] = useState(false);
  const [freqModalDate, setFreqModalDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [freqModalDisc, setFreqModalDisc] = useState<string>('');

  // Toast feedback rápido para ações na home
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Estados para Modal de Gerenciar / Adicionar Horário
  const [isHorarioModalOpen, setIsHorarioModalOpen] = useState(false);
  const [editingHorarioId, setEditingHorarioId] = useState<string | null>(null);
  const [hDia, setHDia] = useState('Segunda-feira');
  const [hDisc, setHDisc] = useState('');
  const [hBloco, setHBloco] = useState('A');
  const [hSala, setHSala] = useState('');
  const [hOrdem, setHOrdem] = useState(1);
  const [isProcessingHorario, setIsProcessingHorario] = useState(false);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3000);
  };

  const mat = notas.filter(n => !n.archived && n.situacao === 'MATR');
  const chMat = mat.reduce((acc, n) => acc + (n.ch || 0), 0);
  
  const aus = frequencias.filter(f => f.status === 'Ausente' && !f.archived).length;
  const pre = frequencias.filter(f => f.status === 'Presente' && !f.archived).length;

  const chConcluida = notas.filter(n => n.situacao === 'APR').reduce((acc, n) => acc + (n.ch || 0), 0) ||
    progressos.filter(p => p.status === 'Concluída' && !p.archived).reduce((acc, p) => acc + (p.ch || 0), 0);

  const chTotalCalculada = progressos.length > 0 
    ? progressos.reduce((acc, p) => acc + (p.ch || 0), 0)
    : (notas.length > 0 ? notas.reduce((acc, n) => acc + (n.ch || 0), 0) : 0);

  const chPendente = Math.max(0, chTotalCalculada - chConcluida);

  const obgRestam = progressos.filter(p => p.tipo === 'Obrigatória' && p.status !== 'Concluída').reduce((acc, p) => acc + (p.ch || 60), 0);
  const optRestam = progressos.filter(p => p.tipo === 'Optativa' && p.status !== 'Concluída').reduce((acc, p) => acc + (p.ch || 60), 0);
  const compRestam = progressos.filter(p => p.tipo?.toLowerCase().includes('comp') && p.status !== 'Concluída').reduce((acc, p) => acc + (p.ch || 0), 0);

  const hasData = notas.length > 0 || progressos.length > 0 || horarios.length > 0;

  // Lista unificada de disciplinas agrupadas por período do mais recente ao mais antigo
  const groupedDisciplinas = useMemo(() => {
    return getGroupedDisciplinasByPeriod(disciplinas, notas);
  }, [disciplinas, notas]);

  const availableDisciplinas = useMemo(() => {
    return groupedDisciplinas.flatMap(g => g.disciplinas.map(d => d.nome));
  }, [groupedDisciplinas]);

  // Identifica a data correspondente ao dia da semana na semana corrente
  const getDateForWeekday = (dia?: string): string => {
    if (!dia) return new Date().toISOString().slice(0, 10);
    const clean = dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    let targetDayIdx = 1;
    if (clean.startsWith('dom')) targetDayIdx = 0;
    else if (clean.startsWith('seg') || clean.startsWith('2')) targetDayIdx = 1;
    else if (clean.startsWith('ter') || clean.startsWith('3')) targetDayIdx = 2;
    else if (clean.startsWith('qua') || clean.startsWith('4')) targetDayIdx = 3;
    else if (clean.startsWith('qui') || clean.startsWith('5')) targetDayIdx = 4;
    else if (clean.startsWith('sex') || clean.startsWith('6')) targetDayIdx = 5;
    else if (clean.startsWith('sab')) targetDayIdx = 6;

    const today = new Date();
    const currentDayIdx = today.getDay();
    const diff = targetDayIdx - currentDayIdx;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Abrir modal completo de frequência
  const handleOpenFreqModal = (
    disciplina?: string,
    diaSemana?: string
  ) => {
    const targetDate = diaSemana ? getDateForWeekday(diaSemana) : new Date().toISOString().slice(0, 10);
    const targetDisc = disciplina || availableDisciplinas[0] || '';
    setFreqModalDate(targetDate);
    setFreqModalDisc(targetDisc);
    setIsFreqModalOpen(true);
  };

  // Marcar presença rápida DIRETO na tabela sem abrir o modal
  const handleQuickMarkFreq = (
    disciplina: string,
    diaSemana: string,
    quickStatus: 'Presente' | 'Ausente' | 'Não Registrado' | 'Feriado'
  ) => {
    const targetDate = getDateForWeekday(diaSemana);
    const targetDisc = disciplina.trim();
    if (!targetDisc) return;

    const existing = frequencias.find(
      f => !f.archived && f.data.startsWith(targetDate) && f.componente.toLowerCase().trim() === targetDisc.toLowerCase()
    );

    if (existing?.id && onUpdateFreq) {
      onUpdateFreq(existing.id, { status: quickStatus });
    } else if (onAddFreq) {
      onAddFreq({
        componente: targetDisc,
        data: targetDate,
        status: quickStatus,
        quantidade: 4,
        archived: false,
      });
    }

    showToast(`${targetDisc}: marcado como ${quickStatus}!`);
  };

  // Funções de CRUD de Horários
  const openNewHorarioModal = () => {
    setEditingHorarioId(null);
    setHDia('Segunda-feira');
    setHDisc(availableDisciplinas[0] || '');
    setHBloco('A');
    setHSala('');
    setHOrdem((horarios.length || 0) + 1);
    setIsHorarioModalOpen(true);
  };

  const openEditHorarioModal = (h: Horario) => {
    setEditingHorarioId(h.id || null);
    setHDia(h.dia || 'Segunda-feira');
    setHDisc(h.disciplina || '');
    setHBloco(h.bloco || 'A');
    setHSala(h.sala || '');
    setHOrdem(h.ordem || 1);
    setIsHorarioModalOpen(true);
  };

  const handleSaveHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hDisc.trim() || !hDia.trim()) return;
    setIsProcessingHorario(true);
    try {
      if (editingHorarioId && onUpdateHorario) {
        await onUpdateHorario(editingHorarioId, {
          dia: hDia.trim(),
          disciplina: hDisc.trim(),
          bloco: hBloco.trim() || 'A',
          sala: hSala.trim() || '1',
          ordem: Number(hOrdem) || 1,
        });
        showToast('Horário atualizado com sucesso!');
      } else if (onAddHorario) {
        await onAddHorario({
          dia: hDia.trim(),
          disciplina: hDisc.trim(),
          bloco: hBloco.trim() || 'A',
          sala: hSala.trim() || '1',
          ordem: Number(hOrdem) || 1,
        });
        showToast('Novo horário adicionado!');
      }
      setIsHorarioModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingHorario(false);
    }
  };

  const handleDeleteHorarioEntry = async (id: string, disc: string) => {
    if (window.confirm(`Remover horário de ${disc}?`)) {
      if (onDeleteHorario) {
        await onDeleteHorario(id);
        showToast('Horário removido.');
      }
    }
  };

  const sortedHorarios: Horario[] = [];
  const seenHorarios = new Set();
  [...horarios].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(h => {
    const key = `${h.dia}-${h.disciplina}`;
    if (!seenHorarios.has(key)) {
      seenHorarios.add(key);
      sortedHorarios.push(h);
    }
  });

  return (
    <div className="space-y-6 mb-8">
      {/* Toast de Feedback Rápido */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-gray-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{feedbackToast}</span>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-gray-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header do Painel Principal (sem banner) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
            {hasData ? (
              <>Carga integralizada: <span className="text-indigo-600 font-extrabold">{chConcluida}h</span></>
            ) : (
              <>Painel acadêmico</>
            )}
          </h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            {hasData ? `${mat.length} cursando agora` : 'Privado'}
          </span>
        </div>

        {progressos.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-xs text-xs font-semibold text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block mr-1"></span>
              Restam <span className="text-indigo-600 font-bold">{obgRestam}h</span> obg.
            </div>
            <div className="bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-xs text-xs font-semibold text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block mr-1"></span>
              Restam <span className="text-purple-600 font-bold">{optRestam}h</span> opt.
            </div>
            {compRestam > 0 && (
              <div className="bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-xs text-xs font-semibold text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block mr-1"></span>
                Restam <span className="text-amber-600 font-bold">{compRestam}h</span> comp.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Síntese do Restaurante Universitário (R.U.) - Sem textos inúteis */}
      {ru && (
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-gray-100 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            
            {/* Lado Esquerdo: Identificação e Contador */}
            <div className="flex items-center gap-2.5">
              <div 
                className={cn(
                  "w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs",
                  onNavigateToRu && "cursor-pointer hover:bg-amber-600 transition"
                )}
                onClick={onNavigateToRu}
                title="Abrir painel do R.U."
              >
                <UtensilsCrossed className="w-4 h-4" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 
                    onClick={onNavigateToRu}
                    className={cn(
                      "text-sm font-bold text-gray-900 tracking-tight flex items-center gap-1",
                      onNavigateToRu && "cursor-pointer hover:text-indigo-600 transition"
                    )}
                  >
                    R.U.
                    {onNavigateToRu && <ArrowRight className="w-3 h-3 text-gray-400" />}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    ru.saldo > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {ru.saldo}
                  </span>
                </div>

                {ru.distanceMeters !== null && (
                  <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span>{formatDistance(ru.distanceMeters)}</span>
                    <button
                      type="button"
                      onClick={ru.checkLocationNow}
                      className="text-gray-400 hover:text-indigo-600 p-0.5 rounded transition cursor-pointer"
                      title="Atualizar GPS"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Lado Direito: Botões Compactos (Verde e Vermelho) */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  ru.addPasses(1, 'Adição rápida');
                  showToast('+1 ficha adicionada');
                }}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Adicionar 1 ficha"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Adicionar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (ru.saldo <= 0) {
                    alert('Sem fichas disponíveis.');
                    return;
                  }
                  ru.removePasses(1, 'Uso rápido');
                  showToast('1 ficha utilizada');
                }}
                disabled={ru.saldo <= 0}
                className={cn(
                  "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  ru.saldo > 0
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs active:scale-95"
                    : "bg-gray-100 text-gray-400 border border-gray-200/80 cursor-not-allowed"
                )}
                title={ru.saldo > 0 ? "Usar 1 ficha" : "Sem fichas para usar"}
              >
                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Usar</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. Horário e Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Lado Esquerdo: Horário Semanal */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Horários</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openNewHorarioModal}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-indigo-200/60 shadow-2xs active:scale-95"
                title="Cadastrar novo horário de aula"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-500" />
                <span>+ Horário</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenFreqModal()}
                className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-orange-200/60 shadow-2xs active:scale-95"
                title="Abrir registro de frequência"
              >
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                <span>Registrar Frequência</span>
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden flex flex-col h-full">
            <div className="overflow-x-auto p-3 sm:p-3.5">
              <table className="w-full text-left border-separate border-spacing-y-1 min-w-[500px]">
                <thead>
                  <tr>
                    <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Dia</th>
                    <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Disciplina</th>
                    <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Bloco</th>
                    <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Sala</th>
                    <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Frequência / Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHorarios.length > 0 ? sortedHorarios.map((h, i) => {
                    const abs = frequencias.filter(f => f.componente === h.disciplina && f.status === 'Ausente' && !f.archived).reduce((acc, f) => acc + (f.quantidade || 4), 0);
                    const isDanger = abs >= 16;
                    const bloco = h.bloco || 'A';
                    const targetDate = getDateForWeekday(h.dia);
                    const currentFreqForDay = frequencias.find(
                      f => !f.archived && f.data.startsWith(targetDate) && f.componente.toLowerCase().trim() === h.disciplina.toLowerCase().trim()
                    );
                    const currentStatus = currentFreqForDay?.status;
                    
                    return (
                      <tr key={h.id || i} className="group">
                        <td className="py-1.5 sm:py-2 pr-2.5 border-b border-gray-50/60">
                          <button
                            type="button"
                            onClick={() => handleOpenFreqModal(h.disciplina, h.dia)}
                            className="font-bold text-gray-900 bg-gray-50 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors px-2.5 py-1 rounded-lg text-xs inline-block cursor-pointer text-left"
                            title="Registrar frequência para este dia"
                          >
                            {h.dia}
                          </button>
                        </td>
                        <td className="py-1.5 sm:py-2 pr-2.5 border-b border-gray-50/60">
                          <button
                            type="button"
                            onClick={() => handleOpenFreqModal(h.disciplina, h.dia)}
                            className="flex flex-col text-left cursor-pointer group-hover:opacity-90"
                            title="Abrir frequência desta disciplina"
                          >
                            <span className={`font-bold text-xs sm:text-sm ${isDanger ? 'text-rose-600' : 'text-gray-900 group-hover:text-indigo-600 transition-colors'}`}>{h.disciplina}</span>
                            {isDanger && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mt-0.5">Risco de Reprovação ({abs} Faltas)</span>}
                          </button>
                        </td>
                        <td className="py-1.5 sm:py-2 pr-2.5 border-b border-gray-50/60">
                          <span className="font-semibold text-gray-700 bg-gray-100 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors px-2 py-0.5 rounded-md text-[11px] inline-flex items-center gap-1">
                            Bloco {bloco}
                          </span>
                        </td>
                        <td className="py-1.5 sm:py-2 pr-2.5 border-b border-gray-50/60">
                          <div className="flex items-center gap-1 text-gray-700 font-medium text-xs whitespace-nowrap">
                            <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>Sala {h.sala.replace(/^[Ss]ala\s*|^[Ss]\s*/i, '')}</span>
                          </div>
                        </td>
                        <td className="py-1.5 sm:py-2 border-b border-gray-50/60">
                          <div className="flex items-center gap-1.5">
                            {/* Botões rápidos de frequência com indicação de seleção ativa nesta semana */}
                            <div className="flex items-center gap-1">
                              <button 
                                type="button"
                                onClick={() => handleQuickMarkFreq(h.disciplina, h.dia, 'Presente')} 
                                className={cn(
                                  "px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider rounded-md transition active:scale-95 cursor-pointer shadow-2xs",
                                  currentStatus === 'Presente'
                                    ? "bg-emerald-600 text-white ring-2 ring-emerald-300 font-black shadow-xs"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                )}
                                title={currentStatus === 'Presente' ? 'Presença confirmada nesta semana' : 'Marcar Presente nesta semana'}
                              >
                                P
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleQuickMarkFreq(h.disciplina, h.dia, 'Ausente')} 
                                className={cn(
                                  "px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider rounded-md transition active:scale-95 cursor-pointer shadow-2xs",
                                  currentStatus === 'Ausente'
                                    ? "bg-rose-600 text-white ring-2 ring-rose-300 font-black shadow-xs"
                                    : "bg-rose-50 hover:bg-rose-100 text-rose-700"
                                )}
                                title={currentStatus === 'Ausente' ? 'Falta registrada nesta semana' : 'Marcar Falta nesta semana'}
                              >
                                F
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleQuickMarkFreq(h.disciplina, h.dia, 'Não Registrado')} 
                                className={cn(
                                  "px-1.5 py-0.5 font-bold text-[10px] uppercase tracking-wider rounded-md transition active:scale-95 cursor-pointer shadow-2xs",
                                  currentStatus === 'Não Registrado'
                                    ? "bg-gray-600 text-white ring-2 ring-gray-300 font-black shadow-xs"
                                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                )}
                                title="Limpar registro da semana"
                              >
                                -
                              </button>
                            </div>

                            {/* Ações de Edição e Exclusão */}
                            <div className="flex items-center gap-0.5 ml-1">
                              <button
                                type="button"
                                onClick={() => openEditHorarioModal(h)}
                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                                title="Editar horário"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              {h.id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHorarioEntry(h.id!, h.disciplina)}
                                  className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                  title="Remover horário"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400 font-medium bg-gray-50 rounded-xl text-xs">
                        Nenhum horário cadastrado. Clique em "+ Horário" para cadastrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Lado Direito: Resumo Rápido */}
        <div className="flex flex-col">
          <div className="flex items-center mb-3 px-1">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Estatísticas</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 sm:gap-3 h-full">
            {[
              { label: 'CH Integralizada', val: `${chConcluida}h`, color: 'text-indigo-600', bg: 'bg-white' },
              { label: 'CH Pendente', val: `${chPendente}h`, color: 'text-rose-600', bg: 'bg-white' },
              { label: 'Matriculado Agora', val: `${chMat}h`, color: 'text-purple-600', bg: 'bg-white' },
              { label: 'Presenças / Faltas', val: `${pre} / ${aus}`, color: 'text-gray-900', bg: 'bg-white', special: true },
            ].map((stat, i) => (
              <div key={i} className={`rounded-xl p-3 sm:p-3.5 border border-gray-100/70 shadow-xs ${stat.bg} flex flex-col justify-center`}>
                <div className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">{stat.label}</div>
                {stat.special ? (
                  <div className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                    <span className="text-emerald-500">{pre}</span>
                    <span className="text-gray-200 font-light mx-1.5">/</span>
                    <span className="text-rose-500">{aus}</span>
                  </div>
                ) : (
                  <div className={`text-lg sm:text-xl font-bold tracking-tight ${stat.color}`}>{stat.val}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Cadastro / Edição de Horário */}
      <Modal
        isOpen={isHorarioModalOpen}
        onClose={() => setIsHorarioModalOpen(false)}
        title={editingHorarioId ? 'Editar Horário de Aula' : 'Novo Horário de Aula'}
      >
        <form onSubmit={handleSaveHorario} className="space-y-4">
          <div>
            <Label htmlFor="h-dia">Dia da Semana</Label>
            <select
              id="h-dia"
              value={hDia}
              onChange={(e) => setHDia(e.target.value)}
              className="w-full mt-1.5 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              required
            >
              <option value="Segunda-feira">Segunda-feira</option>
              <option value="Terça-feira">Terça-feira</option>
              <option value="Quarta-feira">Quarta-feira</option>
              <option value="Quinta-feira">Quinta-feira</option>
              <option value="Sexta-feira">Sexta-feira</option>
              <option value="Sábado">Sábado</option>
              <option value="Domingo">Domingo</option>
            </select>
          </div>

          <div>
            <Label htmlFor="h-disc">Disciplina</Label>
            {availableDisciplinas.length > 0 ? (
              <select
                id="h-disc"
                value={hDisc}
                onChange={(e) => setHDisc(e.target.value)}
                className="w-full mt-1.5 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                required
              >
                <option value="" disabled>Selecione a disciplina...</option>
                {groupedDisciplinas.map(group => (
                  <optgroup key={`h-${group.periodo}`} label={`Período ${group.periodo}`}>
                    {group.disciplinas.map(d => (
                      <option key={`h-${group.periodo}-${d.nome}`} value={d.nome}>
                        {d.nome}{d.docente ? ` • Prof. ${d.docente}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <input
                id="h-disc"
                type="text"
                value={hDisc}
                onChange={(e) => setHDisc(e.target.value)}
                placeholder="Ex: Engenharia de Software"
                className="w-full mt-1.5 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                required
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="h-bloco">Bloco</Label>
              <Input
                id="h-bloco"
                value={hBloco}
                onChange={(e) => setHBloco(e.target.value)}
                placeholder="Ex: A"
              />
            </div>
            <div>
              <Label htmlFor="h-sala">Sala</Label>
              <Input
                id="h-sala"
                value={hSala}
                onChange={(e) => setHSala(e.target.value)}
                placeholder="Ex: 04"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="h-ordem">Ordem de Exibição</Label>
            <Input
              id="h-ordem"
              type="number"
              min="1"
              value={hOrdem}
              onChange={(e) => setHOrdem(parseInt(e.target.value) || 1)}
              placeholder="1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsHorarioModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessingHorario || !hDisc.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-xs cursor-pointer"
            >
              {isProcessingHorario ? 'Salvando...' : editingHorarioId ? 'Salvar Alterações' : 'Adicionar Horário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Registro de Frequência */}
      <FrequencyRegisterModal
        isOpen={isFreqModalOpen}
        onClose={() => setIsFreqModalOpen(false)}
        initialDate={freqModalDate}
        initialDisciplina={freqModalDisc}
        frequencias={frequencias}
        disciplinas={availableDisciplinas}
        horarios={horarios}
        onAdd={(f) => onAddFreq && onAddFreq(f)}
        onUpdate={(id, updates) => onUpdateFreq && onUpdateFreq(id, updates)}
        onDelete={(id) => onDeleteFreq && onDeleteFreq(id)}
      />
    </div>
  );
};
