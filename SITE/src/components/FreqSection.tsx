import React, { useState, useMemo, useEffect } from 'react';
import type { Frequencia, Disciplina, Nota, Horario } from '../types';
import { badgeClass, fd } from '../lib/utils';
import { Modal, Select, Input, Label } from './ui';
import { FrequencyRegisterModal } from './FrequencyRegisterModal';
import { 
  Plus, 
  Archive, 
  Undo2, 
  Calendar, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeftRight, 
  GripVertical
} from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  frequencias: Frequencia[];
  disciplinas: Disciplina[];
  notas: Nota[];
  horarios?: Horario[];
  onAdd: (f: Omit<Frequencia, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<Frequencia>) => void;
  onDelete?: (id: string) => void;
}

export const FreqSection: React.FC<Props> = ({ frequencias, disciplinas, notas, horarios = [], onAdd, onUpdate, onDelete }) => {
  const [archived, setArchived] = useState(false);
  const [comp, setComp] = useState('');
  const [status, setStatus] = useState('');

  const [view, setView] = useState<'calendar'|'list'>('calendar');

  // Controle do Calendário e Drag & Drop
  const [calDate, setCalDate] = useState(() => new Date());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Editor Contínuo e Simplificado de Frequência (Navegável dia a dia sem fechar)
  const [editorDate, setEditorDate] = useState<string | null>(null);
  const [editorDisc, setEditorDisc] = useState<string>('');

  const filtered = useMemo(() => {
    const list = frequencias.filter(f => {
      if (f.archived !== archived) return false;
      if (comp && f.componente !== comp) return false;
      if (status && f.status !== status) return false;
      return true;
    });
    
    const deduped = [];
    const seen = new Set();
    for (const f of list) {
      const key = `${f.componente}-${f.data}-${f.status}-${f.archived}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(f);
      }
    }
    return deduped;
  }, [frequencias, archived, comp, status]);

  // Disciplinas ativas disponíveis para seleção de frequência
  const availableDiscs = useMemo(() => {
    const set = new Set<string>();
    notas
      .filter(n => !n.archived && n.situacao === 'MATR')
      .forEach(n => set.add(n.componente));
    disciplinas
      .filter(d => !d.archived && d.status !== 'CONCLUIDA')
      .forEach(d => set.add(d.nome));
    horarios
      .forEach(h => {
        if (h.disciplina) set.add(h.disciplina);
      });
    if (set.size === 0) {
      notas
        .filter(n => !n.archived)
        .forEach(n => set.add(n.componente));
    }
    return Array.from(set);
  }, [notas, disciplinas, horarios]);

  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { calendarDays, monthLabel } = useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    
    const label = calDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { calendarDays: days, monthLabel: label.charAt(0).toUpperCase() + label.slice(1) };
  }, [calDate]);

  // Cabeçalhos dos dias da semana (Dom e Sáb permanecem; Seg a Sex usam as 3 primeiras letras das disciplinas do período atual)
  const weekDayHeaders = useMemo(() => {
    const defaultLabels = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const dayPatterns = [
      [/dom/i],
      [/seg/i, /^2/],
      [/ter/i, /^3/],
      [/qua/i, /^4/],
      [/qui/i, /^5/],
      [/sex/i, /^6/],
      [/s[aá]b/i],
    ];

    const matriculadas = availableDiscs;

    return defaultLabels.map((defaultLabel, index) => {
      if (index === 0) return { label: 'DOM', title: 'Domingo' };
      if (index === 6) return { label: 'SÁB', title: 'Sábado' };

      // 1. Procurar em horários cadastrados
      const pattern = dayPatterns[index];
      const matchedHorario = (horarios || []).find(h => 
        h.dia && pattern.some(p => p.test(h.dia))
      );

      let discName = matchedHorario?.disciplina;

      // 2. Se não houver horário para esse dia, verificar se há registros de frequência nesse dia da semana
      if (!discName && frequencias && frequencias.length > 0) {
        const freqsOnDay = frequencias.filter(f => {
          if (f.archived) return false;
          const [y, m, d] = f.data.split('-').map(Number);
          if (!y || !m || !d) return false;
          return new Date(y, m - 1, d).getDay() === index;
        });
        if (freqsOnDay.length > 0) {
          discName = freqsOnDay[0].componente;
        }
      }

      // 3. Se ainda não houver, associar sequencialmente com as disciplinas matriculadas do período atual
      if (!discName && matriculadas[index - 1]) {
        discName = matriculadas[index - 1];
      }

      if (discName) {
        const clean = discName.trim();
        const threeLetters = clean.slice(0, 3).toUpperCase();
        return {
          label: threeLetters,
          title: `${defaultLabel}: ${clean}`
        };
      }

      return { label: defaultLabel, title: defaultLabel };
    });
  }, [horarios, availableDiscs, frequencias]);
  
  const getFreqsForDate = (d: Date | null) => {
    if (!d) return [];
    const ds = formatDateKey(d);
    return filtered.filter(f => f.data.startsWith(ds));
  };

  // Mover via Drag and Drop - a disciplina do novo dia passa a fazer parte do registro
  const handleDropOnDate = (targetDate: Date) => {
    setDragOverDate(null);
    if (!draggedId) return;
    const targetDateStr = formatDateKey(targetDate);
    const targetDayIdx = targetDate.getDay();
    const targetDisc = getDisciplineForDayOfWeek(targetDayIdx);

    const updates: Partial<Frequencia> = { data: targetDateStr };
    if (targetDisc) {
      updates.componente = targetDisc;
    }
    onUpdate(draggedId, updates);
    setDraggedId(null);
  };

  // Identifica automaticamente a disciplina de acordo com o dia da semana
  const getDisciplineForDayOfWeek = (dayIndex: number): string => {
    const dayPatterns = [
      [/dom/i],
      [/seg/i, /^2/],
      [/ter/i, /^3/],
      [/qua/i, /^4/],
      [/qui/i, /^5/],
      [/sex/i, /^6/],
      [/s[aá]b/i],
    ];

    if (dayIndex >= 1 && dayIndex <= 5) {
      const pattern = dayPatterns[dayIndex];
      const matched = (horarios || []).find(h => h.dia && pattern.some(p => p.test(h.dia)));
      if (matched?.disciplina) return matched.disciplina;

      const freqsOnDay = (frequencias || []).filter(f => {
        if (f.archived) return false;
        const [y, m, d] = f.data.split('-').map(Number);
        if (!y || !m || !d) return false;
        return new Date(y, m - 1, d).getDay() === dayIndex;
      });
      if (freqsOnDay.length > 0 && freqsOnDay[0].componente) {
        return freqsOnDay[0].componente;
      }

      if (availableDiscs[dayIndex - 1]) {
        return availableDiscs[dayIndex - 1];
      }
    }

    return availableDiscs[0] || '';
  };

  // Abre o editor rápido para qualquer dia
  const openEditor = (dateStr: string, preferredDisc?: string) => {
    setEditorDate(dateStr);
    if (preferredDisc && availableDiscs.includes(preferredDisc)) {
      setEditorDisc(preferredDisc);
    } else {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dayIdx = new Date(y, m - 1, d).getDay();
      const autoDisc = getDisciplineForDayOfWeek(dayIdx) || availableDiscs[0] || '';
      setEditorDisc(autoDisc);
    }
  };

  // Alterna entre dias (-1 ou +1) sem fechar o modal
  const handleNavigateDay = (delta: number) => {
    if (!editorDate) return;
    const [y, m, d] = editorDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + delta);
    const newDateStr = formatDateKey(dateObj);
    
    // Sincroniza visualmente o calendário se mudar de mês
    if (dateObj.getMonth() !== calDate.getMonth() || dateObj.getFullYear() !== calDate.getFullYear()) {
      setCalDate(new Date(dateObj.getFullYear(), dateObj.getMonth(), 1));
    }

    const newDayIdx = dateObj.getDay();
    const autoDisc = getDisciplineForDayOfWeek(newDayIdx);
    setEditorDate(newDateStr);
    if (autoDisc && availableDiscs.includes(autoDisc)) {
      setEditorDisc(autoDisc);
    }
  };

  // Navegação rápida pelo teclado (← / →) enquanto o editor estiver aberto
  useEffect(() => {
    if (!editorDate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateDay(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateDay(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorDate, calDate, availableDiscs, horarios]);

  // Registro existente no dia e disciplina selecionados
  const activeRecord = useMemo(() => {
    if (!editorDate || !editorDisc) return null;
    return frequencias.find(f => !f.archived && f.data.startsWith(editorDate) && f.componente === editorDisc) || null;
  }, [editorDate, editorDisc, frequencias]);

  // Salva o status com um clique e MANTÉM o modal aberto para inserção contínua
  const handleSetStatus = (newStatus: string, justificativa?: string) => {
    if (!editorDate || !editorDisc) return;
    if (activeRecord?.id) {
      onUpdate(activeRecord.id, { 
        status: newStatus, 
        ...(justificativa !== undefined ? { justificativa } : {}) 
      });
    } else {
      onAdd({
        componente: editorDisc,
        data: editorDate,
        status: newStatus,
        quantidade: 4,
        justificativa,
        archived: false
      });
    }
  };

  // Exclui o registro desse dia sem fechar o modal
  const handleDeleteCurrent = () => {
    if (activeRecord?.id && onDelete) {
      onDelete(activeRecord.id);
    }
  };

  // Detalhes formatados da data ativa no editor
  const editorDateInfo = useMemo(() => {
    if (!editorDate) return null;
    const [y, m, d] = editorDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return {
      dayOfWeek: weekDays[dateObj.getDay()],
      formatted: `${d} de ${months[dateObj.getMonth()]} de ${y}`,
      shortDate: `${String(d).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${y}`,
    };
  }, [editorDate]);

  return (
    <div className="pt-1">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-gray-100 p-0.5 rounded-lg shrink-0">
            <button 
              onClick={() => setArchived(false)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${!archived ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Cursando
            </button>
            <button 
              onClick={() => setArchived(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${archived ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Arquivadas
            </button>
          </div>

          <div className="hidden md:flex bg-gray-100 p-0.5 rounded-lg shrink-0">
            <button onClick={() => setView('calendar')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view==='calendar' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}>Calendário</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view==='list' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}>Lista</button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <Select value={comp} onChange={e => setComp(e.target.value)} className="w-full sm:w-44 !py-1.5 !text-xs">
            <option value="">Todas disciplinas</option>
            {availableDiscs.map(d => {
              const abs = frequencias.filter(f => f.componente === d && f.status === 'Ausente' && !f.archived).reduce((a, c) => a + (c.quantidade || 4), 0);
              const warn = abs >= 16 ? ' (Em Risco)' : '';
              return <option key={d} value={d}>{d}{warn}</option>
            })}
          </Select>
          <Select value={status} onChange={e => setStatus(e.target.value)} className="w-full sm:w-36 !py-1.5 !text-xs">
            <option value="">Todos status</option>
            <option>Presente</option>
            <option>Ausente</option>
            <option>Justificado</option>
            <option>Não Registrado</option>
            <option>Feriado</option>
          </Select>
          <button 
            onClick={() => {
              const today = new Date();
              const discForToday = getDisciplineForDayOfWeek(today.getDay());
              openEditor(formatDateKey(today), discForToday);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shadow-xs w-full sm:w-auto justify-center shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100/50 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Archive className="w-8 h-8" />
          </div>
          <p className="text-gray-500 font-medium">{archived ? 'Nenhum registro arquivado.' : 'Nenhum registro de frequência. Use + Registrar.'}</p>
        </div>
      ) : view === 'list' ? (
        <div className="bg-white rounded-3xl border border-gray-100/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/50 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Componente</th>
                  <th className="px-6 py-4">Detalhes</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((f, i) => {
                  const isAusente = f.status === 'Ausente';
                  const isRisco = isAusente && frequencias.filter(fr => fr.componente === f.componente && fr.status === 'Ausente' && !fr.archived).reduce((a, c) => a + (c.quantidade || 4), 0) >= 16;
                  
                  return (
                    <tr key={f.id} className={`hover:bg-indigo-50/30 transition-colors ${isRisco ? 'bg-rose-50/20' : ''}`}>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg">{fd(f.data)}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 text-base flex items-center gap-2">
                        {f.componente}
                        {isRisco && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] uppercase tracking-wider">Risco (16+ Faltas)</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {f.quantidade ? `${f.quantidade} aulas ` : '4 aulas '}
                        {f.justificativa && <span className="italic">({f.justificativa})</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${badgeClass(f.status)}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end items-center gap-2">
                        <button onClick={() => onUpdate(f.id!, { status: 'Presente' })} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold uppercase transition" title="Presente">P</button>
                        <button onClick={() => onUpdate(f.id!, { status: 'Ausente' })} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold uppercase transition" title="Falta">F</button>
                        <button onClick={() => {
                          const just = window.prompt('Justificativa para Não Registrado:', f.justificativa || '');
                          if (just !== null) onUpdate(f.id!, { status: 'Não Registrado', justificativa: just });
                        }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase transition" title="Não Registrado">N/R</button>
                        <button onClick={() => onUpdate(f.id!, { archived: !f.archived })} className="p-2 ml-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition" title={archived ? "Desarquivar" : "Arquivar"}>
                          {archived ? <Undo2 className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                        {onDelete && f.id && (
                          <button 
                            onClick={() => {
                              if (window.confirm(`Excluir este registro de frequência?`)) {
                                onDelete(f.id!);
                              }
                            }} 
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition" 
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-3.5 sm:p-4 overflow-x-auto">
          {/* Cabeçalho do Calendário: Navegação de Mês e Legenda */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 pb-2.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <button 
                type="button"
                onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} 
                className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition cursor-pointer"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base min-w-[130px] text-center">{monthLabel}</h3>
              <button 
                type="button"
                onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} 
                className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition cursor-pointer"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => setCalDate(new Date())} 
                className="text-[11px] font-semibold px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md ml-1 transition cursor-pointer"
              >
                Hoje
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-gray-500 font-medium">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Presente</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Falta</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span> Não Registrado</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block"></span> Feriado</span>
            </div>
          </div>

          <div className="min-w-[650px]">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {weekDayHeaders.map((hdr, idx) => (
                <div 
                  key={idx} 
                  className="text-center font-bold text-gray-400 text-[11px] uppercase tracking-wider cursor-default"
                  title={hdr.title}
                >
                  {hdr.label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} className="min-h-[72px] rounded-xl bg-gray-50/40 border border-gray-100/40" />;
                const dayFreqs = getFreqsForDate(date);
                const isToday = formatDateKey(date) === formatDateKey(new Date());
                const dateKey = formatDateKey(date);
                const isDragOver = dragOverDate === dateKey;
                
                return (
                  <div 
                    key={dateKey} 
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverDate !== dateKey) setDragOverDate(dateKey);
                    }}
                    onDragLeave={() => {
                      if (dragOverDate === dateKey) setDragOverDate(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropOnDate(date);
                    }}
                    onClick={() => {
                      const dayIdx = date.getDay();
                      const discForDay = getDisciplineForDayOfWeek(dayIdx);
                      openEditor(dateKey, discForDay);
                    }}
                    className={`min-h-[72px] p-1.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer group/cell ${
                      isDragOver 
                        ? 'border-indigo-500 bg-indigo-50/70 shadow-md ring-2 ring-indigo-400/30' 
                        : isToday 
                        ? 'border-indigo-300 bg-indigo-50/30' 
                        : 'border-gray-100 hover:border-indigo-200 bg-white hover:bg-gray-50/40'
                    }`}
                    title="Clique para adicionar falta/presença neste dia"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-gray-300 group-hover/cell:text-indigo-400 opacity-0 group-hover/cell:opacity-100 transition-opacity font-bold">
                        + Add
                      </span>
                      <span className={`text-[11px] font-bold ${isToday ? 'bg-indigo-600 text-white px-1.5 py-0.5 rounded-md' : 'text-gray-500'}`}>
                        {date.getDate()}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 justify-start" onClick={(e) => e.stopPropagation()}>
                      {dayFreqs.map(f => {
                        let bg = 'bg-gray-100 text-gray-700 border-gray-200';
                        if (f.status === 'Presente') bg = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200';
                        if (f.status === 'Ausente') bg = 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200';
                        if (f.status === 'Feriado') bg = 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200';
                        if (f.status === 'Não Registrado' || f.status === 'Justificado') bg = 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200';
                        
                        return (
                          <div 
                            key={f.id} 
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', f.id || '');
                              setDraggedId(f.id || null);
                            }}
                            onDragEnd={() => {
                              setDraggedId(null);
                              setDragOverDate(null);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditor(f.data.slice(0, 10), f.componente);
                            }}
                            className={`group/pill relative px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide flex items-center justify-between gap-1 cursor-grab active:cursor-grabbing transition-all border shadow-2xs hover:shadow-xs select-none ${bg}`} 
                            title={`${f.componente}: ${f.status} (Arraste ou clique para opções)`}
                          >
                            <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
                              <GripVertical className="w-2.5 h-2.5 opacity-40 group-hover/pill:opacity-90 shrink-0" />
                              <span className="truncate">{f.status}</span>
                            </div>

                            {/* Ações Rápidas no Hover do Pill */}
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/pill:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextStatus = f.status === 'Presente' ? 'Ausente' : 'Presente';
                                  onUpdate(f.id!, { status: nextStatus });
                                }}
                                className="p-0.5 rounded hover:bg-black/10 text-current transition"
                                title={`Alternar para ${f.status === 'Presente' ? 'Ausente (Falta)' : 'Presente'}`}
                              >
                                <ArrowLeftRight className="w-2.5 h-2.5" />
                              </button>
                              {onDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Excluir ${f.status} em ${f.componente}?`)) {
                                      onDelete(f.id!);
                                    }
                                  }}
                                  className="p-0.5 rounded hover:bg-rose-500 hover:text-white transition"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Moderno de Registro de Frequência conforme layout */}
      <FrequencyRegisterModal
        isOpen={Boolean(editorDate)}
        onClose={() => setEditorDate(null)}
        initialDate={editorDate || undefined}
        initialDisciplina={editorDisc || undefined}
        frequencias={frequencias}
        disciplinas={availableDiscs}
        horarios={horarios}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
};
