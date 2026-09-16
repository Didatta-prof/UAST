import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  GraduationCap, 
  UserCheck, 
  Check, 
  Minus, 
  FileText, 
  Trash2, 
  Info, 
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import type { Frequencia, Horario } from '../types';
import { cn } from '../lib/utils';

interface FrequencyRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialDisciplina?: string;
  frequencias: Frequencia[];
  disciplinas: string[];
  horarios?: Horario[];
  onAdd: (f: Omit<Frequencia, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<Frequencia>) => void;
  onDelete?: (id: string) => void;
}

export const FrequencyRegisterModal: React.FC<FrequencyRegisterModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialDisciplina,
  frequencias,
  disciplinas,
  horarios = [],
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [currentDate, setCurrentDate] = useState<string>(() => {
    return initialDate || new Date().toISOString().slice(0, 10);
  });

  const [currentDisciplina, setCurrentDisciplina] = useState<string>(() => {
    return initialDisciplina || disciplinas[0] || '';
  });

  const [isCustomDisciplina, setIsCustomDisciplina] = useState<boolean>(() => {
    return disciplinas.length === 0;
  });

  const [discError, setDiscError] = useState(false);
  const [justificativa, setJustificativa] = useState<string>('');

  // Identifica a disciplina sugerida para o dia da semana
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
      const matched = horarios.find(h => h.dia && pattern.some(p => p.test(h.dia)));
      if (matched?.disciplina) {
        const found = disciplinas.find(d => d.toLowerCase().trim() === matched.disciplina.toLowerCase().trim());
        return found || matched.disciplina;
      }

      const freqsOnDay = frequencias.filter(f => {
        if (f.archived) return false;
        const [y, m, d] = f.data.split('-').map(Number);
        if (!y || !m || !d) return false;
        return new Date(y, m - 1, d).getDay() === dayIndex;
      });
      if (freqsOnDay.length > 0 && freqsOnDay[0].componente) {
        const found = disciplinas.find(d => d.toLowerCase().trim() === freqsOnDay[0].componente.toLowerCase().trim());
        return found || freqsOnDay[0].componente;
      }

      if (disciplinas[dayIndex - 1]) {
        return disciplinas[dayIndex - 1];
      }
    }

    return currentDisciplina || disciplinas[0] || '';
  };

  // Sincroniza estado inicial sempre que o modal abre
  useEffect(() => {
    if (isOpen) {
      setDiscError(false);
      const targetDate = initialDate || currentDate;
      if (targetDate) setCurrentDate(targetDate);

      const [y, m, d] = (targetDate || '').split('-').map(Number);
      const dayIdx = (y && m && d) ? new Date(y, m - 1, d).getDay() : new Date().getDay();
      const discForDay = getDisciplineForDayOfWeek(dayIdx);

      if (initialDisciplina && initialDisciplina.trim()) {
        setCurrentDisciplina(initialDisciplina);
        setIsCustomDisciplina(!disciplinas.includes(initialDisciplina));
      } else if (discForDay) {
        setCurrentDisciplina(discForDay);
        setIsCustomDisciplina(!disciplinas.includes(discForDay));
      } else if (disciplinas.length > 0) {
        setCurrentDisciplina(disciplinas[0]);
        setIsCustomDisciplina(false);
      } else {
        setIsCustomDisciplina(true);
      }
    }
  }, [isOpen, initialDate, initialDisciplina, disciplinas, horarios]);

  // Registro existente para a data e disciplina ativas
  const activeRecord = useMemo(() => {
    if (!currentDate || !currentDisciplina.trim()) return null;
    return frequencias.find(
      f => !f.archived && f.data.startsWith(currentDate) && f.componente.toLowerCase().trim() === currentDisciplina.toLowerCase().trim()
    ) || null;
  }, [currentDate, currentDisciplina, frequencias]);

  // Atualiza justificativa quando o registro ativo mudar
  useEffect(() => {
    if (activeRecord) {
      setJustificativa(activeRecord.justificativa || '');
    } else {
      setJustificativa('');
    }
  }, [activeRecord]);

  // Navegar dia (-1 ou +1)
  const handleNavigateDay = (delta: number) => {
    const [y, m, d] = currentDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + delta);
    
    const newYear = dateObj.getFullYear();
    const newMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newDay = String(dateObj.getDate()).padStart(2, '0');
    const newDateStr = `${newYear}-${newMonth}-${newDay}`;

    setCurrentDate(newDateStr);

    const autoDisc = getDisciplineForDayOfWeek(dateObj.getDay());
    if (autoDisc) {
      setCurrentDisciplina(autoDisc);
      setIsCustomDisciplina(!disciplinas.includes(autoDisc));
    }
  };

  // Atalho do teclado ← e →
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateDay(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateDay(1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentDate, currentDisciplina, disciplinas, horarios, isCustomDisciplina]);

  const handleCloseModal = () => {
    if (activeRecord?.id && justificativa.trim() !== (activeRecord.justificativa || '')) {
      onUpdate(activeRecord.id, {
        justificativa: justificativa.trim() || undefined,
      });
    }
    onClose();
  };

  // Salvar status
  const handleSelectStatus = (selectedStatus: 'Presente' | 'Ausente' | 'Feriado' | 'Não Registrado') => {
    if (!currentDate) return;

    let cleanDisc = currentDisciplina.trim();
    if (!cleanDisc) {
      const [y, m, d] = currentDate.split('-').map(Number);
      const targetDate = new Date(y, m - 1, d);
      const autoDisc = getDisciplineForDayOfWeek(targetDate.getDay());
      if (autoDisc) {
        cleanDisc = autoDisc;
        setCurrentDisciplina(autoDisc);
      }
    }

    if (!cleanDisc) {
      setDiscError(true);
      return;
    }
    setDiscError(false);

    if (activeRecord?.id) {
      onUpdate(activeRecord.id, {
        status: selectedStatus,
        justificativa: justificativa.trim() || undefined,
      });
    } else {
      onAdd({
        componente: cleanDisc,
        data: currentDate,
        status: selectedStatus,
        quantidade: 4,
        justificativa: justificativa.trim() || undefined,
        archived: false,
      });
    }
  };

  // Atualizar justificativa ao sair do campo
  const handleJustificativaBlur = () => {
    if (activeRecord?.id && (activeRecord.justificativa || '') !== justificativa.trim()) {
      onUpdate(activeRecord.id, {
        justificativa: justificativa.trim() || undefined,
      });
    }
  };

  // Excluir registro do dia ativo
  const handleDeleteCurrent = () => {
    if (activeRecord?.id && onDelete) {
      onDelete(activeRecord.id);
      setJustificativa('');
    }
  };

  // Detalhes formatados da data ativa
  const dateInfo = useMemo(() => {
    const [y, m, d] = currentDate.split('-').map(Number);
    if (!y || !m || !d) {
      return { shortDate: currentDate, dayOfWeek: '' };
    }
    const dateObj = new Date(y, m - 1, d);
    const weekDays = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    return {
      shortDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
      dayOfWeek: weekDays[dateObj.getDay()] || '',
    };
  }, [currentDate]);

  // Status atual normalizado
  const currentStatus = activeRecord?.status;
  const isPresente = currentStatus === 'Presente';
  const isFalta = currentStatus === 'Ausente';
  const isFeriado = currentStatus === 'Feriado';
  const isNaoRegistrado = currentStatus === 'Não Registrado';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
          onClick={handleCloseModal}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-[28px] sm:rounded-[36px] shadow-2xl w-full max-w-xl p-5 sm:p-8 relative border border-gray-100/60 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Ícone Laranja + Título + Subtítulo + Botão Fechar */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-orange-50 border border-orange-100/90 flex items-center justify-center text-orange-500 shrink-0 shadow-xs">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-snug">
                    Registro de Frequência
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 font-normal mt-0.5">
                    Informe a disciplina e o status da presença.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Navegador de Data (Card suave com botões Anterior e Próximo) */}
            <div className="bg-[#f8fafc] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between border border-slate-100/90 mb-5">
              <button
                type="button"
                onClick={() => handleNavigateDay(-1)}
                className="px-3.5 sm:px-4 py-2 rounded-full bg-white hover:bg-gray-50 border border-gray-200/80 shadow-xs text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="Dia anterior (tecla ←)"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
                <span>Anterior</span>
              </button>

              <div className="text-center px-2">
                <div className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-bold text-gray-900">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>{dateInfo.shortDate}</span>
                </div>
                <div className="text-[11px] sm:text-xs text-gray-500 font-normal mt-0.5 capitalize">
                  {dateInfo.dayOfWeek}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleNavigateDay(1)}
                className="px-3.5 sm:px-4 py-2 rounded-full bg-white hover:bg-gray-50 border border-gray-200/80 shadow-xs text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="Próximo dia (tecla →)"
              >
                <span>Próximo</span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* 2. Seleção / Entrada de Disciplina */}
            <div className="mb-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-orange-500 shrink-0" />
                  <label className="text-sm font-semibold text-gray-700">
                    Disciplina
                  </label>
                </div>
                {disciplinas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDisciplina(prev => !prev);
                      setDiscError(false);
                    }}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition cursor-pointer"
                  >
                    {isCustomDisciplina ? '← Escolher da lista' : '+ Digitar outra...'}
                  </button>
                )}
              </div>

              {isCustomDisciplina || disciplinas.length === 0 ? (
                <div>
                  <input
                    type="text"
                    required
                    value={currentDisciplina}
                    onChange={(e) => {
                      setCurrentDisciplina(e.target.value);
                      if (e.target.value.trim()) setDiscError(false);
                    }}
                    placeholder="Ex: Literatura Brasileira III..."
                    className={cn(
                      "w-full bg-white border rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900 shadow-xs focus:outline-none focus:ring-2 transition",
                      discError 
                        ? "border-rose-400 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20" 
                        : "border-gray-200/80 focus:ring-orange-500/20 focus:border-orange-500"
                    )}
                  />
                  {discError && (
                    <p className="text-xs text-rose-600 font-medium mt-1">
                      Por favor, digite o nome da disciplina para marcar a frequência.
                    </p>
                  )}
                </div>
              ) : (
                <div className="relative w-full">
                  <select
                    value={currentDisciplina}
                    onChange={(e) => {
                      if (e.target.value === '__OUTRO__') {
                        setIsCustomDisciplina(true);
                        setCurrentDisciplina('');
                      } else {
                        setCurrentDisciplina(e.target.value);
                        setDiscError(false);
                      }
                    }}
                    className={cn(
                      "w-full bg-white border rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900 shadow-xs appearance-none pr-10 focus:outline-none focus:ring-2 transition cursor-pointer",
                      discError 
                        ? "border-rose-400 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20" 
                        : "border-gray-200/80 focus:ring-orange-500/20 focus:border-orange-500"
                    )}
                  >
                    {disciplinas.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="__OUTRO__">+ Digitar outra disciplina...</option>
                  </select>
                  <ChevronDown className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {discError && (
                    <p className="text-xs text-rose-600 font-medium mt-1">
                      Por favor, selecione uma disciplina para marcar a frequência.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 3. Opções de Frequência (4 Cards Alinhados) */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <UserCheck className="w-4 h-4 text-orange-500 shrink-0" />
                <label className="text-sm font-semibold text-gray-700">
                  Frequência
                </label>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {/* 1. Presente */}
                <button
                  type="button"
                  onClick={() => handleSelectStatus('Presente')}
                  className={cn(
                    "py-3 px-1.5 sm:px-2 rounded-2xl sm:rounded-3xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer select-none active:scale-95",
                    isPresente
                      ? "bg-[#ecfdf5] border-2 border-[#10b981] shadow-xs ring-2 ring-emerald-500/10"
                      : "bg-[#f8fafc]/50 hover:bg-[#ecfdf5]/40 border-gray-200/70 hover:border-emerald-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors shadow-2xs",
                      isPresente
                        ? "bg-[#10b981] text-white"
                        : "bg-emerald-100/80 text-emerald-700"
                    )}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#059669]">
                    Presente
                  </span>
                </button>

                {/* 2. Falta */}
                <button
                  type="button"
                  onClick={() => handleSelectStatus('Ausente')}
                  className={cn(
                    "py-3 px-1.5 sm:px-2 rounded-2xl sm:rounded-3xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer select-none active:scale-95",
                    isFalta
                      ? "bg-[#fef2f2] border-2 border-[#ef4444] shadow-xs ring-2 ring-rose-500/10"
                      : "bg-[#f8fafc]/50 hover:bg-[#fef2f2]/40 border-gray-200/70 hover:border-rose-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors shadow-2xs",
                      isFalta
                        ? "bg-[#ef4444] text-white"
                        : "bg-rose-100/80 text-rose-700"
                    )}
                  >
                    <X className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#dc2626]">
                    Falta
                  </span>
                </button>

                {/* 3. Feriado */}
                <button
                  type="button"
                  onClick={() => handleSelectStatus('Feriado')}
                  className={cn(
                    "py-3 px-1.5 sm:px-2 rounded-2xl sm:rounded-3xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer select-none active:scale-95",
                    isFeriado
                      ? "bg-[#eff6ff] border-2 border-[#3b82f6] shadow-xs ring-2 ring-blue-500/10"
                      : "bg-[#f8fafc]/50 hover:bg-[#eff6ff]/40 border-gray-200/70 hover:border-blue-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors shadow-2xs",
                      isFeriado
                        ? "bg-[#3b82f6] text-white"
                        : "bg-blue-100/80 text-blue-700"
                    )}
                  >
                    <Minus className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#2563eb]">
                    Feriado
                  </span>
                </button>

                {/* 4. Não Registrado */}
                <button
                  type="button"
                  onClick={() => handleSelectStatus('Não Registrado')}
                  className={cn(
                    "py-3 px-1.5 sm:px-2 rounded-2xl sm:rounded-3xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer select-none active:scale-95",
                    isNaoRegistrado
                      ? "bg-[#f8fafc] border-2 border-[#64748b] shadow-xs ring-2 ring-slate-500/10"
                      : "bg-[#f8fafc]/50 hover:bg-[#f8fafc] border-gray-200/70 hover:border-slate-400"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors border-2",
                      isNaoRegistrado
                        ? "border-[#64748b] bg-transparent text-[#64748b]"
                        : "border-gray-300 bg-transparent text-gray-400"
                    )}
                  />
                  <span className="text-[11px] sm:text-xs font-semibold text-[#475569] text-center leading-tight">
                    Não Registrado
                  </span>
                </button>
              </div>
            </div>

            {/* 4. Justificativa (Opcional) & Botão Excluir Este Dia */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 pt-1">
              <div className="relative flex-1">
                <FileText className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  onBlur={handleJustificativaBlur}
                  placeholder="Justificativa (opcional)"
                  className="w-full bg-[#f8fafc] border border-gray-200/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                />
              </div>

              {activeRecord && onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteCurrent}
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 transition cursor-pointer self-end sm:self-center px-2 py-1.5 rounded-xl hover:bg-rose-50/80 shrink-0"
                  title="Excluir o registro deste dia"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>Excluir este dia</span>
                </button>
              )}
            </div>

            {/* 5. Footer: Botão Concluir */}
            <div className="flex items-center justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Concluir</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
