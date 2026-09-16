import React, { useState, useMemo } from 'react';
import type { Nota, Disciplina, Progresso, Frequencia } from '../types';
import { motion } from 'motion/react';
import { 
  PieChart, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Trash2, 
  Search, 
  RotateCcw,
  Sparkles,
  Edit3,
  ArrowLeft,
  ArrowRight,
  Plus,
  Calendar,
  Award
} from 'lucide-react';
import { Modal } from './ui';

interface Props {
  notas: Nota[];
  disciplinas: Disciplina[];
  frequencias?: Frequencia[];
  progressos?: Progresso[];
  onAddDisciplina?: (d: Omit<Disciplina, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void;
  onDeleteDisciplina?: (id: string, nome: string) => Promise<void>;
  onMoveDisciplinaStatus?: (disciplina: Disciplina, newStatus: 'PENDENTE' | 'CURSANDO' | 'CONCLUIDA') => Promise<void>;
  onUpdateDisciplina?: (id: string, updates: Partial<Disciplina>) => Promise<void>;
  onRenameDisciplina?: (oldNome: string, newNome: string, updates?: Partial<Disciplina>) => Promise<void>;
}

export const ProgressoSection: React.FC<Props> = ({ 
  notas, 
  disciplinas, 
  frequencias = [],
  progressos,
  onAddDisciplina,
  onDeleteDisciplina,
  onMoveDisciplinaStatus,
  onUpdateDisciplina,
  onRenameDisciplina
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDisc, setSelectedDisc] = useState<{ disciplina: Disciplina; status: 'PENDENTE' | 'CURSANDO' | 'CONCLUIDA' } | null>(null);
  const [confirmDeleteDisc, setConfirmDeleteDisc] = useState<Disciplina | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados para exibição completa em tela cheia das disciplinas concluídas (3 colunas)
  const [showAllConcluidas, setShowAllConcluidas] = useState(false);
  const [searchConcluidas, setSearchConcluidas] = useState('');
  const [selectedPeriodConcluidas, setSelectedPeriodConcluidas] = useState<string>('todos');

  // Estados para adicionar nova disciplina pendente
  const [isAddPendenteOpen, setIsAddPendenteOpen] = useState(false);
  const [newPendenteNome, setNewPendenteNome] = useState('');
  const [newPendenteCompleto, setNewPendenteCompleto] = useState('');
  const [newPendenteCh, setNewPendenteCh] = useState(60);
  const [newPendenteTipo, setNewPendenteTipo] = useState('Obrigatória');

  // Estados para edição e renomeação global de disciplina
  const [isEditingNome, setIsEditingNome] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editCompleto, setEditCompleto] = useState('');
  const [editPeriodo, setEditPeriodo] = useState('');

  // Cálculo unificado de Concluídas, Cursando e Pendentes (faltantes)
  const { concluido, cursando, faltantes, chTotal, chConcluida } = useMemo(() => {
    const normalize = (s: string) => 
      (s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const notasMap = new Map<string, Nota>();
    notas.forEach(n => {
      const key = normalize(n.componente);
      if (key) notasMap.set(key, n);
    });

    const allDiscsMap = new Map<string, Disciplina>();

    // 1. Incluir da coleção de disciplinas
    disciplinas.forEach(d => {
      const key = normalize(d.nome);
      if (key) {
        allDiscsMap.set(key, { ...d });
      }
    });

    // 2. Incluir da coleção de progressos (currículo do curso / histórico)
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
          archived: p.archived || false,
          createdAt: p.createdAt || Date.now(),
          updatedAt: p.updatedAt || Date.now(),
        });
      } else {
        const existing = allDiscsMap.get(key)!;
        if (!existing.periodo && p.tipo) {
          existing.periodo = p.tipo;
        }
      }
    });

    // 3. Incluir da coleção de notas se ainda não presente
    notas.forEach(n => {
      const key = normalize(n.componente);
      if (!key) return;
      if (!allDiscsMap.has(key)) {
        allDiscsMap.set(key, {
          id: n.id,
          nome: n.componente,
          completo: n.componente,
          periodo: n.periodo,
          status: n.situacao === 'APR' ? 'CONCLUIDA' : (n.situacao === 'MATR' ? 'CURSANDO' : 'PENDENTE'),
          archived: n.archived || false,
          createdAt: n.createdAt || Date.now(),
          updatedAt: n.updatedAt || Date.now(),
        });
      }
    });

    const concluidoList: Disciplina[] = [];
    const cursandoList: Disciplina[] = [];
    const faltantesList: Disciplina[] = [];

    let totalHoras = 0;
    let concluidaHoras = 0;

    allDiscsMap.forEach(d => {
      const key = normalize(d.nome);
      const n = notasMap.get(key);
      const prog = (progressos || []).find(p => normalize(p.disciplina) === key);
      const ch = n?.ch || prog?.ch || 60;
      totalHoras += ch;

      // Se explicitamente marcada como PENDENTE
      if (d.status === 'PENDENTE' && (!n || (n.situacao !== 'APR' && n.situacao !== 'MATR'))) {
        faltantesList.push(d);
        return;
      }

      // Se tem nota aprovada (APR, APROVADO, DISP)
      if (n && (n.situacao === 'APR' || n.situacao === 'APROVADO' || n.situacao === 'DISP')) {
        concluidoList.push(d);
        concluidaHoras += ch;
        return;
      }

      // Se está matriculado (MATR) e não arquivado
      if (n && n.situacao === 'MATR' && !n.archived) {
        cursandoList.push(d);
        return;
      }

      // Se status do registro indica concluída
      if (d.status === 'CONCLUIDA' || prog?.status?.toLowerCase().includes('concl') || prog?.status === 'APR') {
        concluidoList.push(d);
        concluidaHoras += ch;
        return;
      }

      // Se status do registro indica cursando
      if (d.status === 'CURSANDO' || prog?.status?.toLowerCase().includes('matr') || prog?.status?.toLowerCase().includes('curs')) {
        cursandoList.push(d);
        return;
      }

      // Se nota for reprovada ou pendente
      if (n && (n.situacao === 'PENDENTE' || n.situacao === 'A CURSAR' || n.situacao === 'REP' || n.situacao === 'REPF')) {
        faltantesList.push(d);
        return;
      }

      // Se no progresso o status for Pendente ou a cursar
      if (prog && (prog.status?.toLowerCase().includes('pend') || prog.status?.toLowerCase().includes('cursar') || prog.status === 'Obrigatória')) {
        faltantesList.push(d);
        return;
      }

      // Caso padrão: se não foi concluída nem está matriculada, fica como pendente
      faltantesList.push(d);
    });

    return { 
      concluido: concluidoList, 
      cursando: cursandoList, 
      faltantes: faltantesList, 
      chTotal: totalHoras, 
      chConcluida: concluidaHoras 
    };
  }, [notas, disciplinas, progressos]);

  // Filtragem da busca geral
  const filterList = (list: Disciplina[]) => {
    if (!searchTerm.trim()) return list;
    const s = searchTerm.toLowerCase();
    return list.filter(d => d.nome.toLowerCase().includes(s) || (d.completo && d.completo.toLowerCase().includes(s)));
  };

  const filteredFaltantes = useMemo(() => filterList(faltantes), [faltantes, searchTerm]);
  const filteredCursando = useMemo(() => filterList(cursando), [cursando, searchTerm]);
  const filteredConcluido = useMemo(() => filterList(concluido), [concluido, searchTerm]);

  // Filtro específico para a página cheia de Concluídas (3 colunas)
  const availablePeriodsConcluidas = useMemo(() => {
    const set = new Set<string>();
    concluido.forEach(d => {
      if (d.periodo && d.periodo.trim()) set.add(d.periodo.trim());
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [concluido]);

  const finalConcluidasList = useMemo(() => {
    let list = concluido;
    if (selectedPeriodConcluidas !== 'todos') {
      list = list.filter(d => d.periodo === selectedPeriodConcluidas);
    }
    if (searchConcluidas.trim()) {
      const s = searchConcluidas.toLowerCase().trim();
      list = list.filter(d => 
        d.nome.toLowerCase().includes(s) || 
        (d.completo && d.completo.toLowerCase().includes(s)) ||
        (d.periodo && d.periodo.toLowerCase().includes(s))
      );
    }
    return list;
  }, [concluido, selectedPeriodConcluidas, searchConcluidas]);

  const percentage = chTotal > 0 ? Math.round((chConcluida / chTotal) * 100) : 0;
  const faltamHoras = Math.max(0, chTotal - chConcluida);

  // Limite de faltas do semestre (4 dias)
  const LIMITE_FALTAS = 4;

  // Cálculo das faltas por disciplina para o gráfico
  const faltasPorDisciplina = useMemo(() => {
    const normalize = (s: string) => 
      (s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const discNamesMap = new Map<string, string>();

    // 1. Cursando (prioridade para o semestre atual)
    cursando.forEach(d => {
      const norm = normalize(d.nome);
      if (norm && !discNamesMap.has(norm)) {
        discNamesMap.set(norm, d.nome);
      }
    });

    // 2. Se cursando estiver vazio, usar disciplinas não arquivadas
    if (discNamesMap.size === 0) {
      disciplinas.filter(d => !d.archived).forEach(d => {
        const norm = normalize(d.nome);
        if (norm && !discNamesMap.has(norm)) {
          discNamesMap.set(norm, d.nome);
        }
      });
    }

    // 3. Incluir qualquer disciplina que possua registro em frequências
    frequencias.filter(f => !f.archived && f.componente).forEach(f => {
      const norm = normalize(f.componente);
      if (norm && !discNamesMap.has(norm)) {
        discNamesMap.set(norm, f.componente.trim());
      }
    });

    const result: Array<{
      nome: string;
      faltasDias: number;
      presencasDias: number;
      totalAulas: number;
      datasFalta: string[];
    }> = [];

    discNamesMap.forEach((displayName, normKey) => {
      const matchingFreqs = frequencias.filter(f => {
        if (f.archived) return false;
        const fNorm = normalize(f.componente);
        return fNorm === normKey || fNorm.includes(normKey) || normKey.includes(fNorm);
      });

      const datasFaltaSet = new Set<string>();
      const datasPresencaSet = new Set<string>();

      matchingFreqs.forEach(f => {
        const dateKey = (f.data || '').slice(0, 10);
        if (!dateKey) return;
        if (f.status === 'Ausente') {
          datasFaltaSet.add(dateKey);
        } else if (f.status === 'Presente') {
          datasPresencaSet.add(dateKey);
        }
      });

      result.push({
        nome: displayName,
        faltasDias: datasFaltaSet.size,
        presencasDias: datasPresencaSet.size,
        totalAulas: datasFaltaSet.size + datasPresencaSet.size,
        datasFalta: Array.from(datasFaltaSet).sort(),
      });
    });

    // Ordenar decrescente por faltas (quem tem mais faltas fica no topo)
    return result.sort((a, b) => {
      if (b.faltasDias !== a.faltasDias) {
        return b.faltasDias - a.faltasDias;
      }
      return a.nome.localeCompare(b.nome);
    });
  }, [cursando, disciplinas, frequencias]);

  const maxFaltas = useMemo(() => {
    return Math.max(0, ...faltasPorDisciplina.map(d => d.faltasDias));
  }, [faltasPorDisciplina]);

  // Escala máxima do gráfico (no mínimo 5 para dar espaço ao limite de 4)
  const scaleMax = Math.max(5, maxFaltas + 1);
  const redLinePercent = (LIMITE_FALTAS / scaleMax) * 100;

  const handleExecuteMove = async (disciplina: Disciplina, newStatus: 'PENDENTE' | 'CURSANDO' | 'CONCLUIDA') => {
    if (!onMoveDisciplinaStatus) return;
    try {
      setIsProcessing(true);
      await onMoveDisciplinaStatus(disciplina, newStatus);
      setSelectedDisc(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteDelete = async (disciplina: Disciplina) => {
    if (!onDeleteDisciplina) return;
    try {
      setIsProcessing(true);
      await onDeleteDisciplina(disciplina.id || '', disciplina.nome);
      setConfirmDeleteDisc(null);
      setSelectedDisc(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDisc = (item: { disciplina: Disciplina; status: 'PENDENTE' | 'CURSANDO' | 'CONCLUIDA' }) => {
    setSelectedDisc(item);
    setIsEditingNome(false);
    setEditNome(item.disciplina.nome);
    setEditCompleto(item.disciplina.completo || '');
    setEditPeriodo(item.disciplina.periodo || '');
  };

  const handleSaveRename = async () => {
    if (!selectedDisc || !editNome.trim()) return;
    setIsProcessing(true);
    try {
      const oldNome = selectedDisc.disciplina.nome;
      const newNome = editNome.trim();
      const updates: Partial<Disciplina> = {
        nome: newNome,
        completo: editCompleto.trim() || newNome,
        periodo: editPeriodo.trim() || selectedDisc.disciplina.periodo,
      };

      if (onRenameDisciplina) {
        await onRenameDisciplina(oldNome, newNome, updates);
      } else if (onUpdateDisciplina && selectedDisc.disciplina.id) {
        await onUpdateDisciplina(selectedDisc.disciplina.id, updates);
      }

      setSelectedDisc({
        ...selectedDisc,
        disciplina: {
          ...selectedDisc.disciplina,
          ...updates,
        }
      });
      setIsEditingNome(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreatePendente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPendenteNome.trim() || !onAddDisciplina) return;
    try {
      setIsProcessing(true);
      await onAddDisciplina({
        nome: newPendenteNome.trim(),
        completo: newPendenteCompleto.trim() || newPendenteNome.trim(),
        periodo: newPendenteTipo || 'Obrigatória',
        status: 'PENDENTE',
        archived: false,
        ch: Number(newPendenteCh) || 60,
      });
      setIsAddPendenteOpen(false);
      setNewPendenteNome('');
      setNewPendenteCompleto('');
      setNewPendenteCh(60);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const obgConcluido = (progressos && progressos.length > 0)
    ? progressos.filter(p => p.tipo === 'Obrigatória' && p.status === 'Concluída').reduce((acc, p) => acc + (p.ch || 60), 0)
    : chConcluida;
  const obgTotal = (progressos && progressos.length > 0)
    ? progressos.filter(p => p.tipo === 'Obrigatória').reduce((acc, p) => acc + (p.ch || 60), 0)
    : (chTotal > 0 ? chTotal : 0);

  const optConcluido = (progressos && progressos.length > 0)
    ? progressos.filter(p => p.tipo === 'Optativa' && p.status === 'Concluída').reduce((acc, p) => acc + (p.ch || 60), 0)
    : 0;
  const optTotal = (progressos && progressos.length > 0)
    ? (progressos.filter(p => p.tipo === 'Optativa').reduce((acc, p) => acc + (p.ch || 60), 0) || 180)
    : 180;

  const compConcluido = (progressos && progressos.length > 0)
    ? progressos.filter(p => p.tipo?.toLowerCase().includes('comp') && p.status === 'Concluída').reduce((acc, p) => acc + (p.ch || 0), 0)
    : 0;
  const compTotal = (progressos && progressos.length > 0)
    ? (progressos.filter(p => p.tipo?.toLowerCase().includes('comp')).reduce((acc, p) => acc + (p.ch || 0), 0) || 210)
    : 210;

  const renderCircle = (val: number, total: number, color: string, title: string, subtitle: string) => {
    const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((val / total) * 100))) : 0;
    const radius = 36;
    const circ = 2 * Math.PI * radius;
    const strokeDashoffset = circ - (pct / 100) * circ;

    return (
      <div key={title} className="bg-white rounded-xl p-3.5 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden border border-gray-100 shadow-xs hover:shadow-sm transition-all">
        <h4 className="text-xs font-bold text-gray-900 mb-2 tracking-tight">{title}</h4>
        <div className="relative w-24 h-24 mb-2 flex items-center justify-center">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#f3f4f6"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circ}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-base font-bold text-gray-900">{pct}%</span>
          </div>
        </div>
        <p className="text-xs font-bold text-gray-900 mb-0.5">{val} <span className="text-gray-400 font-medium">/ {total}h</span></p>
        <p className="text-[11px] text-gray-500 font-medium bg-gray-50 px-2.5 py-0.5 rounded-full">{subtitle}</p>
      </div>
    );
  };

  // ==========================================
  // VIEW EM TELA CHEIA: CONCLUÍDAS EM 3 COLUNAS
  // ==========================================
  if (showAllConcluidas) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-200">
        {/* Top Header com Botão de Voltar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-xs">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowAllConcluidas(false)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-indigo-600 text-xs sm:text-sm font-bold transition cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Voltar ao Progresso</span>
            </button>
            <div className="flex items-center gap-3 pt-1">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                  Disciplinas Concluídas
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-2xl text-center shadow-2xs">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Concluídas</p>
              <p className="text-lg sm:text-xl font-black text-emerald-900">{concluido.length} matérias</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-2xl text-center shadow-2xs">
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Horas Feitas</p>
              <p className="text-lg sm:text-xl font-black text-indigo-900">{chConcluida}h</p>
            </div>
          </div>
        </div>

        {/* Barra de Filtro e Busca */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder="Buscar por nome, código ou período da matéria..."
              value={searchConcluidas}
              onChange={e => setSearchConcluidas(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
              <select
                value={selectedPeriodConcluidas}
                onChange={e => setSelectedPeriodConcluidas(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer pr-1"
              >
                <option value="todos">Todos os Períodos</option>
                {availablePeriodsConcluidas.map(p => (
                  <option key={p} value={p}>Período {p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* GRADE DE 3 COLUNAS CONFORME SOLICITADO PELO USUÁRIO */}
        {finalConcluidasList.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-8 h-8" />
            </div>
            <p className="text-gray-800 font-bold text-base">Nenhuma disciplina encontrada</p>
            <p className="text-gray-500 text-xs mt-1">Tente ajustar a busca ou o período selecionado.</p>
            {searchConcluidas && (
              <button
                type="button"
                onClick={() => setSearchConcluidas('')}
                className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {finalConcluidasList.map((d, i) => {
              const key = d.nome.toLowerCase().trim();
              const n = notas.find(item => item.componente.toLowerCase().trim() === key);
              const prog = (progressos || []).find(p => p.disciplina.toLowerCase().trim() === key);
              const ch = n?.ch || prog?.ch || 60;
              const media = typeof n?.media === 'number' ? n.media.toFixed(1) : null;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.25) }}
                  key={d.id || `${d.nome}-${i}`}
                  className="bg-white rounded-2xl border border-gray-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all p-4 sm:p-5 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-sm sm:text-base text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                          {d.nome}
                        </h3>
                        {d.completo && d.completo !== d.nome && (
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                            {d.completo}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0 uppercase tracking-wider">
                        APR
                      </span>
                    </div>

                    {/* Chips de Informações da Disciplina */}
                    <div className="flex items-center gap-2 flex-wrap my-3 pt-2 border-t border-gray-100 text-xs">
                      {d.periodo && (
                        <span className="bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {d.periodo}
                        </span>
                      )}
                      <span className="bg-emerald-50/70 text-emerald-800 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        {ch}h
                      </span>
                      {media !== null && (
                        <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px]">
                          <Award className="w-3 h-3 text-amber-600" />
                          Média: {media}
                        </span>
                      )}
                      {prog?.tipo && (
                        <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                          {prog.tipo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas no Rodapé do Card */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleOpenDisc({ disciplina: d, status: 'CONCLUIDA' })}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Gerenciar</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExecuteMove(d, 'PENDENTE')}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-amber-50 text-gray-400 hover:text-amber-600 flex items-center justify-center transition cursor-pointer"
                        title="Mover de volta para Pendente"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExecuteMove(d, 'CURSANDO')}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 flex items-center justify-center transition cursor-pointer"
                        title="Mover para Cursando Agora"
                      >
                        <Clock className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteDisc(d)}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                        title="Excluir do currículo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Modal de Gerenciamento da Disciplina (Mover / Renomear / Excluir) */}
        <Modal 
          isOpen={Boolean(selectedDisc)} 
          onClose={() => setSelectedDisc(null)} 
          title="Gerenciar Disciplina"
        >
          {selectedDisc && (
            <div className="space-y-5">
              {!isEditingNome ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disciplina</span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-700">
                      Status: Concluída (APR)
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 mt-1">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{selectedDisc.disciplina.nome}</h3>
                      {selectedDisc.disciplina.completo && (
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">{selectedDisc.disciplina.completo}</p>
                      )}
                      {selectedDisc.disciplina.periodo && (
                        <span className="inline-block mt-1.5 text-[10px] font-bold bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded-md">
                          Período: {selectedDisc.disciplina.periodo}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingNome(true)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Renomear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-white rounded-2xl border-2 border-indigo-200 space-y-3 shadow-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Nome / Identificador</label>
                    <input
                      type="text"
                      required
                      value={editNome}
                      onChange={e => setEditNome(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Nome Completo (Opcional)</label>
                    <input
                      type="text"
                      value={editCompleto}
                      onChange={e => setEditCompleto(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Período Acadêmico</label>
                    <input
                      type="text"
                      value={editPeriodo}
                      onChange={e => setEditPeriodo(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setIsEditingNome(false)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing || !editNome.trim()}
                      onClick={handleSaveRename}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isProcessing ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Mover para outro status */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5">
                  Mover Status Para
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleExecuteMove(selectedDisc.disciplina, 'CURSANDO')}
                    className="w-full p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-800 flex items-center justify-between text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-bold text-gray-900">Cursando (Matriculada)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleExecuteMove(selectedDisc.disciplina, 'PENDENTE')}
                    className="w-full p-3 rounded-xl border border-gray-200 hover:border-rose-400 hover:bg-rose-50/50 text-gray-800 flex items-center justify-between text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-bold text-gray-900">Pendente (A Cursar)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Exclusão da Disciplina */}
              <div className="pt-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setConfirmDeleteDisc(selectedDisc.disciplina)}
                  className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir disciplina do currículo
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal de Confirmação de Exclusão */}
        <Modal 
          isOpen={Boolean(confirmDeleteDisc)} 
          onClose={() => setConfirmDeleteDisc(null)} 
          title="Confirmar Exclusão"
        >
          {confirmDeleteDisc && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h4 className="text-base font-bold text-gray-900">Excluir disciplina?</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Tem certeza que deseja remover <strong>"{confirmDeleteDisc.nome}"</strong> do currículo? Esta ação removerá a matéria e registros associados.
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
      </div>
    );
  }

  // ==========================================
  // VIEW PADRÃO DO DASHBOARD DE PROGRESSO
  return (
    <div className="space-y-5 pt-1">
      {/* 4 Cards de Resumo no Topo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <PieChart className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-gray-500">Conclusão</h3>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{percentage}%</div>
            <p className="text-[11px] font-medium text-gray-400 mt-0.5">do curso finalizado</p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-gray-500">Horas Feitas</h3>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{chConcluida}h</div>
            <p className="text-[11px] font-medium text-gray-400 mt-0.5">validadas no histórico</p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-gray-500">Horas Faltantes</h3>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{faltamHoras}h</div>
            <p className="text-[11px] font-medium text-gray-400 mt-0.5">para integralização</p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-gray-500">Pendentes</h3>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{faltantes.length}</div>
            <p className="text-[11px] font-medium text-gray-400 mt-0.5">disciplinas a cursar</p>
          </div>
        </div>
      </div>

      {/* Barra de Progresso Geral */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-xs">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-xs font-bold text-gray-900">Progresso do Curso</h3>
          <span className="text-xs font-bold text-indigo-600">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="bg-indigo-600 h-2.5 rounded-full"
          />
        </div>
      </div>

      {/* Anéis de Integralização */}
      <div>
        <div className="flex items-center mb-4 px-1">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Integralização</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {renderCircle(obgConcluido, obgTotal, '#4f46e5', 'Obrigatórias', `Pendente: ${Math.max(0, obgTotal - obgConcluido)}h`)}
          {renderCircle(optConcluido, optTotal, '#a855f7', 'Optativas', `Pendente: ${Math.max(0, optTotal - optConcluido)}h`)}
          {renderCircle(compConcluido, compTotal, '#f97316', 'Complementares', `Pendente: ${Math.max(0, compTotal - compConcluido)}h`)}
        </div>
      </div>

      {/* Gráfico de Monitoramento de Faltas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                Faltas por Disciplina
              </h3>
              {faltasPorDisciplina.some(d => d.faltasDias > LIMITE_FALTAS) && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                  Limite Excedido
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              <span>Limite: {LIMITE_FALTAS} dias</span>
            </div>
          </div>
        </div>

        {faltasPorDisciplina.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-xs font-medium">
            Nenhuma disciplina cadastrada para monitoramento de faltas.
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Régua de Escala com Marcador de Limite */}
            <div className="relative h-5 text-[11px] font-semibold text-gray-400 select-none hidden sm:block">
              <span className="absolute left-0">0 dias</span>
              <span 
                className="absolute -translate-x-1/2 text-rose-600 font-extrabold flex items-center gap-1 bg-white px-1 z-30"
                style={{ left: `${redLinePercent}%` }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                Linha de Limite ({LIMITE_FALTAS})
              </span>
              <span className="absolute right-0">{scaleMax} dias</span>
            </div>

            {/* Container das Barras com a Linha Vermelha de Limite */}
            <div className="relative pt-1">
              {/* Linha Vermelha Vertical */}
              <div 
                className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
                style={{ left: `${redLinePercent}%` }}
              >
                <div className="w-0.5 h-full border-l-2 border-dashed border-rose-500 shadow-xs"></div>
              </div>

              <div className="space-y-3">
                {faltasPorDisciplina.map((item, idx) => {
                  const pctWidth = Math.min(100, Math.max(item.faltasDias > 0 ? 3 : 0, (item.faltasDias / scaleMax) * 100));
                  const isExceeded = item.faltasDias > LIMITE_FALTAS;
                  const isAtLimit = item.faltasDias === LIMITE_FALTAS;
                  const isWarning = item.faltasDias === 3;

                  let barBg = 'bg-linear-to-r from-indigo-500 to-indigo-600';
                  let textColor = 'text-gray-600';

                  if (isExceeded) {
                    barBg = 'bg-linear-to-r from-rose-500 via-rose-600 to-rose-700 shadow-xs shadow-rose-200';
                    textColor = 'text-rose-700 font-black';
                  } else if (isAtLimit) {
                    barBg = 'bg-linear-to-r from-rose-500 to-rose-600';
                    textColor = 'text-rose-600 font-bold';
                  } else if (isWarning) {
                    barBg = 'bg-linear-to-r from-amber-400 to-amber-500';
                    textColor = 'text-amber-700 font-semibold';
                  }

                  return (
                    <div key={item.nome} className="relative group">
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {idx === 0 && item.faltasDias > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 shrink-0">
                              + Faltas
                            </span>
                          )}
                          <span className="font-bold text-gray-800 truncate" title={item.nome}>
                            {item.nome}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs ${textColor}`}>
                            {item.faltasDias} {item.faltasDias === 1 ? 'falta' : 'faltas'}
                          </span>
                          {isExceeded && (
                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                              +{item.faltasDias - LIMITE_FALTAS}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra de Progresso com Trilho */}
                      <div className="h-3.5 w-full bg-gray-100 rounded-full relative overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${pctWidth}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${barBg} transition-all`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Busca das Colunas */}
      <div className="flex items-center justify-end bg-white p-3 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text"
            placeholder="Buscar nas colunas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Colunas Interativas de Disciplinas: Pendentes, Cursando, Concluídas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. Pendentes */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Pendentes</h2>
              <span className="text-xs font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100">
                {filteredFaltantes.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddPendenteOpen(true)}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Adicionar disciplina pendente"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova</span>
            </button>
          </div>

          {filteredFaltantes.length === 0 ? (
            <div className="bg-emerald-50 text-emerald-700 p-6 rounded-3xl border border-emerald-100 text-center font-semibold text-sm">
              <p>{searchTerm ? 'Nenhuma disciplina pendente encontrada.' : 'Nenhuma disciplina pendente encontrada no seu cadastro.'}</p>
              <button
                type="button"
                onClick={() => setIsAddPendenteOpen(true)}
                className="mt-3 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Pendente
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredFaltantes.map((d, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 6 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  key={d.id || `${d.nome}-${i}`} 
                  onClick={() => handleOpenDisc({ disciplina: d, status: 'PENDENTE' })}
                  className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-3"
                  title="Clique para gerenciar, mover ou excluir esta disciplina"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                        {d.nome}
                      </h4>
                      {d.periodo && (
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                          {d.periodo}
                        </span>
                      )}
                    </div>
                    {d.completo && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 group-hover:text-gray-700 transition-colors">
                        {d.completo}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Ação: Mover para Cursando */}
                    <button 
                      onClick={() => handleExecuteMove(d, 'CURSANDO')}
                      className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                      title="Mover para Cursando (Matriculada)"
                    >
                      Cursar
                    </button>

                    {/* Ação: Concluir com APR */}
                    <button 
                      onClick={() => handleExecuteMove(d, 'CONCLUIDA')}
                      className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 flex items-center justify-center transition cursor-pointer"
                      title="Marcar como Concluída (APR)"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Ação: Excluir */}
                    <button 
                      onClick={() => setConfirmDeleteDisc(d)}
                      className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                      title="Excluir disciplina"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Cursando */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Cursando</h2>
            </div>
            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
              {filteredCursando.length}
            </span>
          </div>

          {filteredCursando.length === 0 ? (
            <div className="bg-gray-50 text-gray-500 p-6 rounded-3xl border border-gray-100 text-center font-medium text-sm">
              Nenhuma disciplina sendo cursada no momento.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredCursando.map((d, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 6 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  key={d.id || `${d.nome}-${i}`} 
                  onClick={() => handleOpenDisc({ disciplina: d, status: 'CURSANDO' })}
                  className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-3"
                  title="Clique para gerenciar, mover ou excluir esta disciplina"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                        {d.nome}
                      </h4>
                      {d.periodo && (
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                          {d.periodo}
                        </span>
                      )}
                    </div>
                    {d.completo && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 group-hover:text-gray-700 transition-colors">
                        {d.completo}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <span 
                      onClick={() => handleOpenDisc({ disciplina: d, status: 'CURSANDO' })}
                      className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                      title="Clique para mover status"
                    >
                      MATR
                    </span>

                    {/* Ação: Concluir com APR */}
                    <button 
                      onClick={() => handleExecuteMove(d, 'CONCLUIDA')}
                      className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 flex items-center justify-center transition cursor-pointer"
                      title="Marcar como Concluída (APR)"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Ação: Mover para Pendente */}
                    <button 
                      onClick={() => handleExecuteMove(d, 'PENDENTE')}
                      className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-amber-50 text-gray-400 hover:text-amber-600 flex items-center justify-center transition cursor-pointer"
                      title="Mover para Pendente"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* Ação: Excluir */}
                    <button 
                      onClick={() => setConfirmDeleteDisc(d)}
                      className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                      title="Excluir disciplina"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Concluídas - Exibe até 4 e botão "Mostrar mais" */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Concluídas</h2>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
              {filteredConcluido.length}
            </span>
          </div>

          {filteredConcluido.length === 0 ? (
            <div className="bg-gray-50 text-gray-500 p-6 rounded-3xl border border-gray-100 text-center font-medium text-sm">
              Nenhuma disciplina concluída listada.
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Exibe até 4 disciplinas conforme solicitado */}
              {filteredConcluido.slice(0, 4).map((d, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 6 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  key={d.id || `${d.nome}-${i}`} 
                  onClick={() => handleOpenDisc({ disciplina: d, status: 'CONCLUIDA' })}
                  className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-3"
                  title="Clique para gerenciar, mover ou excluir esta disciplina"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900 group-hover:text-emerald-700 transition-colors truncate">
                        {d.nome}
                      </h4>
                      {d.periodo && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                          {d.periodo}
                        </span>
                      )}
                    </div>
                    {d.completo && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 group-hover:text-gray-700 transition-colors">
                        {d.completo}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <span 
                      onClick={() => handleOpenDisc({ disciplina: d, status: 'CONCLUIDA' })}
                      className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                      title="Clique para mover status"
                    >
                      APR
                    </span>

                    {/* Ação: Mover de volta para Pendente */}
                    <button 
                      onClick={() => handleExecuteMove(d, 'PENDENTE')}
                      className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-amber-50 text-gray-400 hover:text-amber-600 flex items-center justify-center transition cursor-pointer"
                      title="Mover de volta para Pendente"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* Ação: Excluir */}
                    <button 
                      onClick={() => setConfirmDeleteDisc(d)}
                      className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                      title="Excluir disciplina"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}

              {/* Botão Mostrar Mais - Abre nova página ocupando toda a tela (exceto menu lateral) em 3 colunas */}
              {filteredConcluido.length > 4 ? (
                <button
                  type="button"
                  onClick={() => setShowAllConcluidas(true)}
                  className="w-full mt-2 py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm rounded-2xl border border-emerald-200/80 transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <span>Mostrar mais ({filteredConcluido.length - 4} restantes)</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : filteredConcluido.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllConcluidas(true)}
                  className="w-full mt-1.5 py-2 px-3 text-emerald-700 hover:text-emerald-900 text-xs font-semibold hover:bg-emerald-50/60 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Ver todas em 3 colunas ({filteredConcluido.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Adicionar Nova Disciplina Pendente */}
      <Modal
        isOpen={isAddPendenteOpen}
        onClose={() => setIsAddPendenteOpen(false)}
        title="Nova Disciplina Pendente"
      >
        <form onSubmit={handleCreatePendente} className="space-y-4">

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nome / Sigla da Disciplina *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: TCC, Estágio, Inteligência Artificial..."
              value={newPendenteNome}
              onChange={e => setNewPendenteNome(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nome Completo Oficial (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Trabalho de Conclusão de Curso II"
              value={newPendenteCompleto}
              onChange={e => setNewPendenteCompleto(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={newPendenteTipo}
                onChange={e => setNewPendenteTipo(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="Obrigatória">Obrigatória</option>
                <option value="Optativa">Optativa</option>
                <option value="Complementar">Complementar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Carga Horária (CH)
              </label>
              <input
                type="number"
                min="15"
                step="15"
                value={newPendenteCh}
                onChange={e => setNewPendenteCh(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsAddPendenteOpen(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing || !newPendenteNome.trim()}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? 'Salvando...' : 'Adicionar Pendente'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Gerenciamento da Disciplina (Mover / Renomear / Excluir) */}
      <Modal 
        isOpen={Boolean(selectedDisc)} 
        onClose={() => setSelectedDisc(null)} 
        title="Gerenciar Disciplina"
      >
        {selectedDisc && (
          <div className="space-y-5">
            {!isEditingNome ? (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disciplina</span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    selectedDisc.status === 'CONCLUIDA' ? 'bg-emerald-100 text-emerald-700' :
                    selectedDisc.status === 'CURSANDO' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    Status: {selectedDisc.status === 'CONCLUIDA' ? 'Concluída (APR)' : selectedDisc.status === 'CURSANDO' ? 'Cursando' : 'Pendente'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 mt-1">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{selectedDisc.disciplina.nome}</h3>
                    {selectedDisc.disciplina.completo && (
                      <p className="text-xs text-gray-500 mt-0.5 font-medium">{selectedDisc.disciplina.completo}</p>
                    )}
                    {selectedDisc.disciplina.periodo && (
                      <span className="inline-block mt-1.5 text-[10px] font-bold bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded-md">
                        Período / Tipo: {selectedDisc.disciplina.periodo}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingNome(true)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-2xs"
                    title="Renomear globalmente"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Renomear
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white rounded-2xl border-2 border-indigo-200 space-y-3 shadow-xs">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Nome / Identificador</label>
                  <input
                    type="text"
                    required
                    value={editNome}
                    onChange={e => setEditNome(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Nome da matéria"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Nome Completo (Opcional)</label>
                  <input
                    type="text"
                    value={editCompleto}
                    onChange={e => setEditCompleto(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Nome completo oficial"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Período Acadêmico</label>
                  <input
                    type="text"
                    value={editPeriodo}
                    onChange={e => setEditPeriodo(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Ex: 2026.2"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setIsEditingNome(false)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing || !editNome.trim()}
                    onClick={handleSaveRename}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isProcessing ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* Mover para outro status */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5">
                Mover Status Para
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={isProcessing || selectedDisc.status === 'CONCLUIDA'}
                  onClick={() => handleExecuteMove(selectedDisc.disciplina, 'CONCLUIDA')}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                    selectedDisc.status === 'CONCLUIDA' 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 opacity-60 cursor-default' 
                      : 'bg-white border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-gray-800 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-gray-900">Concluída (APR)</div>
                  </div>
                  {selectedDisc.status === 'CONCLUIDA' && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Atual</span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isProcessing || selectedDisc.status === 'CURSANDO'}
                  onClick={() => handleExecuteMove(selectedDisc.disciplina, 'CURSANDO')}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                    selectedDisc.status === 'CURSANDO' 
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800 opacity-60 cursor-default' 
                      : 'bg-white border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-800 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-gray-900">Cursando (Matriculada)</div>
                  </div>
                  {selectedDisc.status === 'CURSANDO' && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">Atual</span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isProcessing || selectedDisc.status === 'PENDENTE'}
                  onClick={() => handleExecuteMove(selectedDisc.disciplina, 'PENDENTE')}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                    selectedDisc.status === 'PENDENTE' 
                      ? 'bg-rose-50 border-rose-300 text-rose-800 opacity-60 cursor-default' 
                      : 'bg-white border-gray-200 hover:border-rose-400 hover:bg-rose-50/50 text-gray-800 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-gray-900">Pendente (A Cursar)</div>
                  </div>
                  {selectedDisc.status === 'PENDENTE' && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">Atual</span>
                  )}
                </button>
              </div>
            </div>

            {/* Exclusão da Disciplina */}
            <div className="pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setConfirmDeleteDisc(selectedDisc.disciplina)}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Excluir disciplina do currículo
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal 
        isOpen={Boolean(confirmDeleteDisc)} 
        onClose={() => setConfirmDeleteDisc(null)} 
        title="Confirmar Exclusão"
      >
        {confirmDeleteDisc && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-gray-900">Excluir disciplina?</h4>
              <p className="text-xs text-gray-500 mt-1">
                Tem certeza que deseja remover <strong>"{confirmDeleteDisc.nome}"</strong> do currículo? Esta ação removerá a matéria e registros associados.
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
    </div>
  );
};
