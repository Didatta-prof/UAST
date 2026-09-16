import React, { useState, useMemo } from 'react';
import type { Disciplina, Frequencia, Nota, Progresso } from '../types';
import { Modal, Input, Label } from './ui';
import { 
  Plus, 
  BookOpen, 
  Search, 
  AlertCircle, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  LayoutGrid, 
  Table as TableIcon, 
  Archive, 
  Calendar,
  GraduationCap,
  X,
  Edit3,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  disciplinas: Disciplina[];
  progressos?: Progresso[];
  frequencias?: Frequencia[];
  notas?: Nota[];
  currentPeriod?: string;
  onAdd: (n: Omit<Disciplina, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (id: string, nome: string) => Promise<void>;
  onMoveStatus?: (disciplina: Disciplina, newStatus: 'PENDENTE' | 'CURSANDO' | 'CONCLUIDA') => Promise<void>;
  onUpdate?: (id: string, updates: Partial<Disciplina>) => Promise<void>;
  onRenameDisciplina?: (oldNome: string, newNome: string, updates?: Partial<Disciplina>) => Promise<void>;
}

export const DisciplinasSection: React.FC<Props> = ({ 
  disciplinas, 
  progressos = [],
  frequencias = [], 
  notas = [],
  currentPeriod = '2026.2',
  onAdd,
  onDelete,
  onMoveStatus,
  onUpdate,
  onRenameDisciplina
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'cursando' | 'pendentes' | 'arquivadas'>('cursando');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [search, setSearch] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('todos');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [isModalOpen, setModalOpen] = useState(false);
  const [confirmDeleteDisc, setConfirmDeleteDisc] = useState<Disciplina | null>(null);
  const [selectedDiscForMove, setSelectedDiscForMove] = useState<Disciplina | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados para edição global de disciplina
  const [editingDisc, setEditingDisc] = useState<Disciplina | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCompleto, setEditCompleto] = useState('');
  const [editPeriodo, setEditPeriodo] = useState('');

  const [fNome, setFNome] = useState('');
  const [fComp, setFComp] = useState('');
  const [fPer, setFPer] = useState('');
  const [fCh, setFCh] = useState<number>(60);
  const [fStatus, setFStatus] = useState<'CURSANDO' | 'PENDENTE' | 'CONCLUIDA'>('CURSANDO');

  const openAddModal = () => {
    const defaultStatus = activeSubTab === 'pendentes' ? 'PENDENTE' : activeSubTab === 'arquivadas' ? 'CONCLUIDA' : 'CURSANDO';
    setFStatus(defaultStatus);
    setFPer(defaultStatus === 'PENDENTE' ? 'Obrigatória' : currentPeriod);
    setFNome('');
    setFComp('');
    setFCh(60);
    setModalOpen(true);
  };

  const isArchivedDisc = (d: Disciplina): boolean => {
    return d.archived === true || d.status === 'CONCLUIDA';
  };

  // Determinar e separar nas 3 abas: Cursando, Pendentes e Arquivadas (Concluídas)
  const { cursandoList, pendentesList, arquivadasList } = useMemo(() => {
    const normalize = (s: string) => 
      (s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const cursando: Disciplina[] = [];
    const pendentes: Disciplina[] = [];
    const arquivadas: Disciplina[] = [];
    const seen = new Set<string>();

    const allDiscsMap = new Map<string, Disciplina>();

    disciplinas.forEach(d => {
      const key = normalize(d.nome);
      if (key) allDiscsMap.set(key, { ...d });
    });

    (progressos || []).forEach(p => {
      const key = normalize(p.disciplina);
      if (!key) return;
      if (!allDiscsMap.has(key)) {
        const isConcl = p.status?.toLowerCase().includes('concl') || p.status === 'APR';
        const isCurs = p.status?.toLowerCase().includes('matr') || p.status?.toLowerCase().includes('curs');
        allDiscsMap.set(key, {
          id: p.id,
          nome: p.disciplina,
          completo: p.disciplina,
          periodo: p.tipo || 'Obrigatória',
          status: isConcl ? 'CONCLUIDA' : (isCurs ? 'CURSANDO' : 'PENDENTE'),
          archived: isConcl,
          createdAt: p.createdAt || Date.now(),
          updatedAt: p.updatedAt || Date.now(),
        });
      }
    });

    allDiscsMap.forEach(d => {
      const key = normalize(d.nome);
      if (seen.has(key)) return;
      seen.add(key);

      const discNotas = notas.filter(n => normalize(n.componente) === key);
      const hasApr = discNotas.some(n => n.situacao === 'APR' || n.situacao === 'APROVADO' || n.situacao === 'DISP');
      const hasMatr = discNotas.some(n => n.situacao === 'MATR');
      const prog = (progressos || []).find(p => normalize(p.disciplina) === key);

      if (d.status === 'PENDENTE' && !hasApr && !hasMatr) {
        pendentes.push(d);
      } else if (hasApr || d.status === 'CONCLUIDA' || d.archived === true) {
        arquivadas.push(d);
      } else if (hasMatr || d.status === 'CURSANDO') {
        cursando.push(d);
      } else if (prog?.status?.toLowerCase().includes('concl') || prog?.status === 'APR') {
        arquivadas.push(d);
      } else if (prog?.status?.toLowerCase().includes('matr') || prog?.status?.toLowerCase().includes('curs')) {
        cursando.push(d);
      } else {
        pendentes.push(d);
      }
    });

    return { cursandoList: cursando, pendentesList: pendentes, arquivadasList: arquivadas };
  }, [disciplinas, progressos, notas, currentPeriod]);

  // Períodos disponíveis para o filtro
  const availablePeriods = useMemo(() => {
    const listToExtract = activeSubTab === 'cursando' 
      ? cursandoList 
      : activeSubTab === 'pendentes' 
      ? pendentesList 
      : arquivadasList;
    const set = new Set<string>();
    listToExtract.forEach(d => {
      if (d.periodo && d.periodo.trim()) set.add(d.periodo.trim());
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [activeSubTab, cursandoList, pendentesList, arquivadasList]);

  // Lista final filtrada de acordo com aba, busca e período
  const filtered = useMemo(() => {
    const sourceList = activeSubTab === 'cursando' 
      ? cursandoList 
      : activeSubTab === 'pendentes' 
      ? pendentesList 
      : arquivadasList;
    let list = sourceList;

    if (selectedPeriod !== 'todos') {
      list = list.filter(d => d.periodo === selectedPeriod);
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      list = list.filter(d => 
        d.nome.toLowerCase().includes(s) || 
        (d.completo && d.completo.toLowerCase().includes(s))
      );
    }

    return list;
  }, [activeSubTab, cursandoList, pendentesList, arquivadasList, selectedPeriod, search]);

  const showToast = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveStatus = fStatus || (activeSubTab === 'pendentes' ? 'PENDENTE' : activeSubTab === 'arquivadas' ? 'CONCLUIDA' : 'CURSANDO');
    onAdd({ 
      nome: fNome, 
      completo: fComp, 
      periodo: fPer || (effectiveStatus === 'PENDENTE' ? 'Obrigatória' : currentPeriod),
      status: effectiveStatus,
      archived: effectiveStatus === 'CONCLUIDA',
      ch: fCh || 60,
    });
    setModalOpen(false);
    setFNome(''); setFComp(''); setFPer(''); setFCh(60);
    showToast(`Disciplina "${fNome}" adicionada!`);
  };

  const handleExecuteDelete = async (disc: Disciplina) => {
    if (!onDelete) return;
    try {
      setIsProcessing(true);
      await onDelete(disc.id || '', disc.nome);
      setConfirmDeleteDisc(null);
      showToast(`Disciplina "${disc.nome}" excluída.`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteMove = async (disc: Disciplina, newStatus: 'PENDENTE' | 'CURSANDO' | 'CONCLUIDA') => {
    if (!onMoveStatus) return;
    try {
      setIsProcessing(true);
      await onMoveStatus(disc, newStatus);
      setSelectedDiscForMove(null);
      const statusLabel = newStatus === 'CURSANDO' ? 'Cursando' : newStatus === 'CONCLUIDA' ? 'Concluída' : 'Pendente';
      showToast(`Status de "${disc.nome}" alterado para ${statusLabel}!`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Mover de Arquivadas para Cursando Agora
  const handleMoveToCursando = async (disc: Disciplina) => {
    setIsProcessing(true);
    try {
      if (onUpdate && disc.id) {
        await onUpdate(disc.id, { 
          archived: false, 
          status: 'CURSANDO', 
          periodo: currentPeriod 
        });
      }
      if (onMoveStatus) {
        await onMoveStatus(disc, 'CURSANDO');
      }
      showToast(`"${disc.nome}" movida para Cursando Agora!`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Arquivar uma disciplina que está em Cursando Agora
  const handleArchiveDisc = async (disc: Disciplina) => {
    setIsProcessing(true);
    try {
      if (onUpdate && disc.id) {
        await onUpdate(disc.id, { 
          archived: true, 
          status: 'CONCLUIDA' 
        });
      }
      if (onMoveStatus) {
        await onMoveStatus(disc, 'CONCLUIDA');
      }
      showToast(`"${disc.nome}" arquivada como já cursada!`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartEdit = (disc: Disciplina) => {
    setEditingDisc(disc);
    setEditNome(disc.nome);
    setEditCompleto(disc.completo || '');
    setEditPeriodo(disc.periodo || currentPeriod);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDisc || !editNome.trim()) return;
    setIsProcessing(true);
    try {
      const oldNome = editingDisc.nome;
      const newNome = editNome.trim();
      const updates: Partial<Disciplina> = {
        nome: newNome,
        completo: editCompleto.trim() || newNome,
        periodo: editPeriodo.trim() || currentPeriod,
      };

      if (onRenameDisciplina) {
        await onRenameDisciplina(oldNome, newNome, updates);
      } else if (onUpdate && editingDisc.id) {
        await onUpdate(editingDisc.id, updates);
      }

      showToast(`Disciplina "${newNome}" atualizada em todas as páginas!`);
      setEditingDisc(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pt-2 space-y-5">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-indigo-600 text-white text-xs font-semibold rounded-2xl shadow-lg flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-200 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Controls: Guias + Nova Disciplina */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Guias: Cursando Agora vs Pendentes vs Arquivados (Concluídas) */}
        <div className="inline-flex p-1.5 bg-gray-200/70 rounded-2xl gap-1.5 self-stretch sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('cursando');
              setSelectedPeriod('todos');
            }}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              activeSubTab === 'cursando'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Cursando</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              activeSubTab === 'cursando' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-300/60 text-gray-700'
            }`}>
              {cursandoList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('pendentes');
              setSelectedPeriod('todos');
            }}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              activeSubTab === 'pendentes'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Pendentes</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              activeSubTab === 'pendentes' ? 'bg-rose-50 text-rose-700' : 'bg-gray-300/60 text-gray-700'
            }`}>
              {pendentesList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('arquivadas');
              setSelectedPeriod('todos');
            }}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              activeSubTab === 'arquivadas'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Concluídas</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              activeSubTab === 'arquivadas' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-300/60 text-gray-700'
            }`}>
              {arquivadasList.length}
            </span>
          </button>
        </div>

        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition shadow-sm w-full sm:w-auto justify-center cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Disciplina
        </button>
      </div>

      {/* Barra de Filtros e Alternador de Visualização (Tabela vs Cards) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Busca */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <Input 
            type="search" 
            placeholder="Buscar..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 !py-2 text-xs sm:text-sm bg-gray-50/70 border-gray-200"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Filtro por Período */}
          <div className="flex items-center gap-1.5 bg-gray-50/90 border border-gray-200 px-2.5 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value="todos">Todos os Períodos</option>
              {availablePeriods.map(p => (
                <option key={p} value={p}>
                  Período {p}
                </option>
              ))}
            </select>
            {selectedPeriod !== 'todos' && (
              <button
                onClick={() => setSelectedPeriod('todos')}
                className="text-gray-400 hover:text-gray-700 p-0.5"
                title="Limpar filtro de período"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Alternador de Modo de Visualização: Tabela vs Cards */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Visualizar em Tabela"
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Visualizar em Cards"
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo: Vazio vs Cards vs Tabela */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-xs">
          <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
            {activeSubTab === 'arquivadas' ? <Archive className="w-8 h-8" /> : <BookOpen className="w-8 h-8" />}
          </div>
          <p className="text-gray-800 font-bold text-sm">Nenhuma disciplina encontrada.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Visualização em Tabela */
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3 px-4 sm:px-5">Disciplina</th>
                  <th className="py-3 px-3">Período</th>
                  <th className="py-3 px-3">Faltas</th>
                  <th className="py-3 px-3">Situação</th>
                  <th className="py-3 px-4 sm:px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {filtered.map((d) => {
                  const abs = frequencias
                    .filter(f => f.componente.toLowerCase() === d.nome.toLowerCase() && f.status === 'Ausente' && !f.archived)
                    .reduce((acc, f) => acc + (f.quantidade || 4), 0);
                  const isDanger = abs >= 16;
                  const isArchived = isArchivedDisc(d);

                  return (
                    <tr 
                      key={d.id || d.nome}
                      className="hover:bg-gray-50/70 transition-colors group"
                    >
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isDanger 
                              ? 'bg-rose-100 text-rose-600' 
                              : isArchived 
                                ? 'bg-emerald-50 text-emerald-600' 
                                : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {isDanger ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : isArchived ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <BookOpen className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block leading-tight">{d.nome}</span>
                            {d.completo && (
                              <span className="text-[11px] text-gray-400 truncate max-w-xs block leading-tight mt-0.5" title={d.completo}>
                                {d.completo}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">
                          {d.periodo || '—'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isDanger ? 'text-rose-600' : 'text-gray-700'}`}>
                            {abs}
                          </span>
                          {isDanger && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-extrabold text-[10px] rounded uppercase">
                              Risco
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {isArchived ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 className="w-3 h-3" /> Já Cursei
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            <Clock className="w-3 h-3" /> Cursando
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Botão rápido: Se arquivada, mover para cursando agora */}
                          {isArchived ? (
                            <button
                              type="button"
                              onClick={() => handleMoveToCursando(d)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                              title="Cursando"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Cursando</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleArchiveDisc(d)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                              title="Arquivar"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Arquivar</span>
                            </button>
                          )}

                          {/* Botão Editar Disciplina Globalmente */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(d)}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 flex items-center justify-center transition cursor-pointer shrink-0"
                            title="Editar nome / dados da disciplina (altera em todas as páginas)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {onMoveStatus && (
                            <button
                              type="button"
                              onClick={() => setSelectedDiscForMove(d)}
                              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 flex items-center justify-center transition cursor-pointer shrink-0"
                              title="Alterar status de progresso"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDisc(d)}
                              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-rose-50 text-gray-500 hover:text-rose-600 flex items-center justify-center transition cursor-pointer shrink-0"
                              title="Excluir disciplina"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visualização em Cards (Grid) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d, i) => {
            const abs = frequencias
              .filter(f => f.componente.toLowerCase() === d.nome.toLowerCase() && f.status === 'Ausente' && !f.archived)
              .reduce((acc, f) => acc + (f.quantidade || 4), 0);
            const isDanger = abs >= 16;
            const isArchived = isArchivedDisc(d);

            return (
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: i * 0.02 }}
                key={d.id || d.nome} 
                className={`rounded-3xl p-5 border transition-all flex flex-col justify-between group relative overflow-hidden ${
                  isDanger 
                    ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300 hover:shadow-md' 
                    : isArchived
                      ? 'bg-white border-gray-200 hover:border-emerald-200 hover:shadow-md'
                      : 'bg-white border-gray-200 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                {isDanger && <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />}
                
                <div>
                  <div className="flex items-start justify-between mb-3.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isDanger 
                        ? 'bg-rose-100 text-rose-600' 
                        : isArchived 
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      {isDanger ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : isArchived ? (
                        <GraduationCap className="w-5 h-5" />
                      ) : (
                        <BookOpen className="w-5 h-5" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {d.periodo && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${
                          isDanger ? 'bg-rose-100 text-rose-600' : 'text-gray-600 bg-gray-100'
                        }`}>
                          {d.periodo}
                        </span>
                      )}
                      {/* Botão Editar Disciplina Globalmente */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(d)}
                        className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 flex items-center justify-center transition cursor-pointer"
                        title="Editar nome / dados da disciplina (altera em todas as páginas)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {onMoveStatus && (
                        <button
                          type="button"
                          onClick={() => setSelectedDiscForMove(d)}
                          className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 flex items-center justify-center transition cursor-pointer"
                          title="Alterar status de progresso"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDisc(d)}
                          className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                          title="Excluir disciplina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className={`font-bold text-lg leading-tight mb-1 ${isDanger ? 'text-rose-900' : 'text-gray-900'}`}>
                    {d.nome}
                  </h4>
                  
                  {d.completo && (
                    <p className={`text-xs font-medium leading-snug line-clamp-2 ${isDanger ? 'text-rose-700/70' : 'text-gray-500'}`} title={d.completo}>
                      {d.completo}
                    </p>
                  )}

                  {isDanger && (
                    <div className="mt-3 pt-2.5 border-t border-rose-200/70">
                      <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Risco de Reprovação ({abs} Faltas)
                      </p>
                    </div>
                  )}
                </div>

                {/* Botão de ação no rodapé do card */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  {isArchived ? (
                    <button
                      type="button"
                      onClick={() => handleMoveToCursando(d)}
                      disabled={isProcessing}
                      className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Cursando</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleArchiveDisc(d)}
                      disabled={isProcessing}
                      className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Arquivar</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal Mover Status */}
      <Modal isOpen={Boolean(selectedDiscForMove)} onClose={() => setSelectedDiscForMove(null)} title="Mover Status no Progresso">
        {selectedDiscForMove && (
          <div className="space-y-4">
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disciplina</span>
              <h4 className="font-bold text-gray-900 text-sm">{selectedDiscForMove.nome}</h4>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleExecuteMove(selectedDiscForMove, 'CONCLUIDA')}
                className="w-full p-3 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 flex items-center gap-3 text-left transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-gray-900">Concluída (APR)</div>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleExecuteMove(selectedDiscForMove, 'CURSANDO')}
                className="w-full p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 flex items-center gap-3 text-left transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-gray-900">Cursando (Matriculada)</div>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleExecuteMove(selectedDiscForMove, 'PENDENTE')}
                className="w-full p-3 rounded-xl border border-gray-200 hover:border-rose-400 hover:bg-rose-50/50 flex items-center gap-3 text-left transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-gray-900">Pendente (A Cursar)</div>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <Modal isOpen={Boolean(confirmDeleteDisc)} onClose={() => setConfirmDeleteDisc(null)} title="Confirmar Exclusão">
        {confirmDeleteDisc && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-gray-900">Excluir disciplina?</h4>
              <p className="text-xs text-gray-500 mt-1">
                Deseja excluir permanentemente <strong>"{confirmDeleteDisc.nome}"</strong>?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setConfirmDeleteDisc(null)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleExecuteDelete(confirmDeleteDisc)}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
              >
                {isProcessing ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Adicionar Disciplina */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Nova Disciplina">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome Curto (Display)</Label>
            <Input required value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Ex: Linguística I" />
          </div>
          <div>
            <Label>Nome Completo (Opcional)</Label>
            <Input value={fComp} onChange={e => setFComp(e.target.value)} placeholder="Ex: LINGUÍSTICA I - ESTUDOS AVANÇADOS" />
          </div>
          <div>
            <Label>Período (Opcional)</Label>
            <Input value={fPer} onChange={e => setFPer(e.target.value)} placeholder={`Ex: ${currentPeriod}`} />
          </div>
          <div>
            <Label>Carga Horária (Horas)</Label>
            <Input 
              type="number" 
              min="15" 
              step="15" 
              value={fCh} 
              onChange={e => setFCh(parseInt(e.target.value) || 60)} 
              placeholder="60" 
            />
          </div>
          <div>
            <Label>Status Inicial</Label>
            <select
              value={fStatus}
              onChange={e => setFStatus(e.target.value as 'CURSANDO' | 'PENDENTE' | 'CONCLUIDA')}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="CURSANDO">Cursando (Matriculada)</option>
              <option value="PENDENTE">Pendente (Falta Cursar)</option>
              <option value="CONCLUIDA">Concluída (Aprovada)</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer">Cancelar</button>
            <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm cursor-pointer">Adicionar</button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Disciplina */}
      <Modal isOpen={Boolean(editingDisc)} onClose={() => setEditingDisc(null)} title="Editar Disciplina">
        {editingDisc && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <Label>Nome / Identificador</Label>
              <Input 
                required 
                value={editNome} 
                onChange={e => setEditNome(e.target.value)} 
                placeholder="Ex: Teo. Crít. Lit. I" 
                className="font-medium"
              />
            </div>

            <div>
              <Label>Nome Completo (Opcional)</Label>
              <Input 
                value={editCompleto} 
                onChange={e => setEditCompleto(e.target.value)} 
                placeholder="Ex: TEORIA E CRÍTICA LITERÁRIA I" 
              />
            </div>

            <div>
              <Label>Período Acadêmico</Label>
              <Input 
                value={editPeriodo} 
                onChange={e => setEditPeriodo(e.target.value)} 
                placeholder={`Ex: ${currentPeriod}`} 
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100">
              <button 
                type="button" 
                disabled={isProcessing}
                onClick={() => setEditingDisc(null)} 
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isProcessing}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isProcessing ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
