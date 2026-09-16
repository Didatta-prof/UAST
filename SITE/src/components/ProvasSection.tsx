import React, { useState, useMemo, useEffect } from 'react';
import type { Prova, Disciplina, Nota } from '../types';
import {
  Award,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  Circle,
  Trash2,
  Edit3,
  User,
  Bell,
  BellRing,
  Check,
  Maximize2,
  Save,
  BookOpen,
  AlertTriangle,
  Loader2,
  Info
} from 'lucide-react';
import { Modal } from './ui';
import { cn } from '../lib/utils';
import {
  calculateDueStatus,
  requestNotificationPermission,
  requestNotificationPermissionWithFeedback,
  sendBrowserNotification,
  checkAndNotifyAcademicReminders
} from '../lib/academicNotifications';
import { getGroupedDisciplinasByPeriod } from '../lib/academicDisciplinas';

interface ProvasSectionProps {
  provas: Prova[];
  disciplinas: Disciplina[];
  notas: Nota[];
  onAdd: (p: Omit<Prova, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, p: Partial<Prova>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const ProvasSection: React.FC<ProvasSectionProps> = ({
  provas,
  disciplinas,
  notas,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Agendada' | 'Realizada'>('ALL');
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProva, setEditingProva] = useState<Prova | null>(null);
  const [detailProva, setDetailProva] = useState<Prova | null>(null);
  const [detailAnotacoes, setDetailAnotacoes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaveFeedback, setNotesSaveFeedback] = useState(false);

  const [formTitulo, setFormTitulo] = useState('');
  const [formDisciplina, setFormDisciplina] = useState('');
  const [isCustomDisciplina, setIsCustomDisciplina] = useState(false);
  const [formProfessor, setFormProfessor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formDataProva, setFormDataProva] = useState('');
  const [formStatus, setFormStatus] = useState<'Agendada' | 'Realizada'>('Agendada');
  const [formAnotacoes, setFormAnotacoes] = useState('');
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [notifFeedback, setNotifFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isSuccess: boolean;
  } | null>(null);

  const [notifPermission, setNotifPermission] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });

  const groupedDisciplinas = useMemo(() => {
    return getGroupedDisciplinasByPeriod(disciplinas, notas);
  }, [disciplinas, notas]);

  const allDisciplinas = useMemo(() => {
    return groupedDisciplinas.flatMap(g => g.disciplinas);
  }, [groupedDisciplinas]);

  useEffect(() => {
    if (provas && provas.length > 0) {
      checkAndNotifyAcademicReminders(
        provas.map(p => ({
          id: p.id,
          titulo: p.titulo,
          data: p.dataProva,
          disciplina: p.disciplina,
          tipo: 'Prova' as const,
          status: p.status,
        }))
      );
    }
  }, [provas]);

  const handleRequestNotif = async () => {
    const result = await requestNotificationPermissionWithFeedback();
    setNotifPermission(result.permission);
    setNotifFeedback({
      isOpen: true,
      title: result.success ? 'Alertas Ativados!' : 'Aviso de Notificações',
      message: result.message,
      isSuccess: result.success,
    });
    if (result.success) {
      checkAndNotifyAcademicReminders(
        provas.map(p => ({
          id: p.id,
          titulo: p.titulo,
          data: p.dataProva,
          disciplina: p.disciplina,
          tipo: 'Prova' as const,
          status: p.status,
        }))
      );
    }
  };

  const handleSendTestNotif = async () => {
    const sent = await sendBrowserNotification('🔔 Teste de Notificação UFRPE', {
      body: 'Seus alertas de provas estão ativos e funcionando perfeitamente!',
    });
    if (sent) {
      setNotifFeedback({
        isOpen: true,
        title: 'Notificação de Teste Enviada!',
        message: 'A notificação foi emitida com sucesso no seu dispositivo.',
        isSuccess: true,
      });
    } else {
      setNotifFeedback({
        isOpen: true,
        title: 'Aviso',
        message: 'Não foi possível emitir a notificação do sistema. Verifique as permissões do navegador ou se o modo Não Perturbe está ativo.',
        isSuccess: false,
      });
    }
  };

  const handleOpenAddModal = () => {
    setEditingProva(null);
    setFormTitulo('');
    setFormError(null);
    setIsSavingForm(false);
    const firstDisc = allDisciplinas[0];
    if (firstDisc?.nome) {
      setFormDisciplina(firstDisc.nome);
      setFormProfessor(firstDisc.docente || '');
      setIsCustomDisciplina(false);
    } else {
      setFormDisciplina('');
      setFormProfessor('');
      setIsCustomDisciplina(true);
    }
    setFormDescricao('');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const datePart = d.toISOString().slice(0, 10);
    setFormDataProva(datePart + 'T08:00');
    setFormStatus('Agendada');
    setFormAnotacoes('');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (p: Prova, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProva(p);
    setFormTitulo(p.titulo);
    setFormDisciplina(p.disciplina);
    setIsCustomDisciplina(!allDisciplinas.some(d => d.nome.toLowerCase() === p.disciplina.toLowerCase()));
    setFormProfessor(p.professor || '');
    setFormDescricao(p.descricao || '');
    setFormDataProva(p.dataProva || '');
    setFormStatus(p.status);
    setFormAnotacoes(p.anotacoes || '');
    setFormError(null);
    setIsSavingForm(false);
    setIsFormModalOpen(true);
  };

  const handleDisciplinaChange = (selected: string) => {
    if (selected === '__CUSTOM__') {
      setIsCustomDisciplina(true);
      setFormDisciplina('');
      return;
    }
    setIsCustomDisciplina(false);
    setFormDisciplina(selected);
    const match = allDisciplinas.find(d => d.nome.toLowerCase() === selected.toLowerCase());
    if (match && match.docente && !formProfessor) {
      setFormProfessor(match.docente);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) {
      setFormError('Por favor, informe o título da avaliação.');
      return;
    }
    if (!formDisciplina.trim()) {
      setFormError('Por favor, informe a matéria/disciplina.');
      return;
    }
    if (!formDataProva) {
      setFormError('Por favor, selecione a data e horário da prova.');
      return;
    }

    setIsSavingForm(true);
    setFormError(null);

    try {
      if (editingProva && editingProva.id) {
        await onUpdate(editingProva.id, {
          titulo: formTitulo.trim(),
          disciplina: formDisciplina.trim(),
          professor: formProfessor.trim(),
          descricao: formDescricao.trim(),
          dataProva: formDataProva,
          status: formStatus,
          anotacoes: formAnotacoes,
        });
        if (detailProva && detailProva.id === editingProva.id) {
          setDetailProva({
            ...detailProva,
            titulo: formTitulo.trim(),
            disciplina: formDisciplina.trim(),
            professor: formProfessor.trim(),
            descricao: formDescricao.trim(),
            dataProva: formDataProva,
            status: formStatus,
            anotacoes: formAnotacoes,
          });
          setDetailAnotacoes(formAnotacoes);
        }
      } else {
        await onAdd({
          titulo: formTitulo.trim(),
          disciplina: formDisciplina.trim(),
          professor: formProfessor.trim(),
          descricao: formDescricao.trim(),
          dataProva: formDataProva,
          status: formStatus,
          anotacoes: formAnotacoes,
          archived: false,
        });
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao agendar/salvar prova:', err);
      setFormError(err?.message || 'Ocorreu um erro ao salvar a prova. Tente novamente.');
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Tem certeza de que deseja excluir esta prova?')) {
      await onDelete(id);
      if (detailProva && detailProva.id === id) {
        setDetailProva(null);
      }
    }
  };

  const handleToggleStatus = async (p: Prova, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!p.id) return;
    const newStatus = p.status === 'Realizada' ? 'Agendada' : 'Realizada';
    await onUpdate(p.id, { status: newStatus });
    if (detailProva && detailProva.id === p.id) {
      setDetailProva({ ...detailProva, status: newStatus });
    }
  };

  const handleOpenDetail = (p: Prova) => {
    setDetailProva(p);
    setDetailAnotacoes(p.anotacoes || '');
    setNotesSaveFeedback(false);
  };

  const handleSaveDetailNotes = async () => {
    if (!detailProva || !detailProva.id) return;
    setIsSavingNotes(true);
    await onUpdate(detailProva.id, {
      anotacoes: detailAnotacoes,
    });
    setDetailProva({
      ...detailProva,
      anotacoes: detailAnotacoes,
    });
    setIsSavingNotes(false);
    setNotesSaveFeedback(true);
    setTimeout(() => setNotesSaveFeedback(false), 2500);
  };

  const filteredProvas = useMemo(() => {
    return provas.filter(p => {
      const matchSearch = (p.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.disciplina || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.professor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.anotacoes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchDisc = filterDisciplina === 'ALL' || p.disciplina.toLowerCase() === filterDisciplina.toLowerCase();
      const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;

      return matchSearch && matchDisc && matchStatus;
    }).sort((a, b) => new Date(a.dataProva).getTime() - new Date(b.dataProva).getTime());
  }, [provas, searchTerm, filterDisciplina, filterStatus]);

  const agendadasCount = provas.filter(p => p.status === 'Agendada').length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Minimal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-600 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
            Provas & Avaliações
          </h1>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-semibold",
            agendadasCount > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          )}>
            {agendadasCount === 0 ? 'Nenhuma agendada' : `${agendadasCount} ${agendadasCount === 1 ? 'agendada' : 'agendadas'}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {notifPermission === 'granted' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Alertas Ativos</span>
              <button
                type="button"
                onClick={handleSendTestNotif}
                className="ml-1 px-2 py-0.5 rounded bg-white text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
                title="Testar notificação no dispositivo"
              >
                Testar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRequestNotif}
              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Ativar lembretes no navegador"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Ativar Alertas</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Prova</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-gray-100 shadow-xs flex flex-col md:flex-row gap-2.5 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar prova, matéria, tópicos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            value={filterDisciplina}
            onChange={(e) => setFilterDisciplina(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="ALL">Todas as Matérias</option>
            {groupedDisciplinas.map(group => (
              <optgroup key={`filter-group-${group.periodo}`} label={`Período ${group.periodo}`}>
                {group.disciplinas.map(d => (
                  <option key={`filter-${group.periodo}-${d.nome}`} value={d.nome}>{d.nome}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="ALL">Todos os Status</option>
            <option value="Agendada">Agendadas</option>
            <option value="Realizada">Realizadas</option>
          </select>
        </div>
      </div>

      {/* Tabela de Provas */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        {filteredProvas.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Award className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="font-semibold text-gray-700 text-xs sm:text-sm">Nenhuma prova cadastrada</p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar Prova</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-2 px-3 w-10 text-center">Status</th>
                  <th className="py-2 px-3">Avaliação / Prova</th>
                  <th className="py-2 px-3">Matéria</th>
                  <th className="py-2 px-3">Professor</th>
                  <th className="py-2 px-3">Data & Horário</th>
                  <th className="py-2 px-3">Lembrete</th>
                  <th className="py-2 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {filteredProvas.map(p => {
                  const due = calculateDueStatus(p.dataProva, p.status === 'Realizada');
                  return (
                    <tr 
                      key={p.id}
                      onClick={() => handleOpenDetail(p)}
                      className={cn(
                        "hover:bg-purple-50/40 transition cursor-pointer group",
                        p.status === 'Realizada' && "bg-gray-50/40 opacity-75"
                      )}
                    >
                      <td className="py-2 px-3 text-center" onClick={(e) => handleToggleStatus(p, e)}>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-purple-600 transition cursor-pointer"
                          title={p.status === 'Realizada' ? "Marcar como agendada" : "Marcar como realizada"}
                        >
                          {p.status === 'Realizada' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4 hover:text-purple-600" />
                          )}
                        </button>
                      </td>

                      <td className="py-2 px-3">
                        <div className={cn("font-bold text-gray-900 group-hover:text-purple-600 transition", p.status === 'Realizada' && "line-through text-gray-500")}>
                          {p.titulo}
                        </div>
                        {p.descricao && (
                          <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5 font-normal">
                            {p.descricao}
                          </div>
                        )}
                        {p.anotacoes && (
                          <div className="flex items-center gap-1 text-[10px] text-purple-600 mt-0.5 font-semibold">
                            <BookOpen className="w-2.5 h-2.5" />
                            <span>Possui dicas de estudo e tópicos</span>
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-bold text-[11px] border border-purple-100">
                          {p.disciplina}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                        {p.professor ? (
                          <div className="flex items-center gap-1 text-xs">
                            <User className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{p.professor}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs text-gray-700">
                          <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{due.formattedDate}</span>
                        </div>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] border", due.badgeClass)}>
                          {due.badgeText}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition cursor-pointer"
                            title="Editar prova"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(p.id!, e)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Excluir prova"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalhes / Revisão */}
      {detailProva && (
        <Modal
          isOpen={true}
          onClose={() => setDetailProva(null)}
          title="Ficha da Prova"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block">
                  {detailProva.disciplina}
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-0.5">
                  {detailProva.titulo}
                </h3>
                {detailProva.professor && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400" />
                    <span>Professor: {detailProva.professor}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleToggleStatus(detailProva)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0",
                  detailProva.status === 'Realizada'
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                )}
              >
                {detailProva.status === 'Realizada' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Realizada</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-3.5 h-3.5" />
                    <span>Agendada</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Data do Exame</span>
                <span className="font-bold text-gray-800">
                  {calculateDueStatus(detailProva.dataProva).formattedDate}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Prazo / Alerta</span>
                <span className={cn("inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold border", calculateDueStatus(detailProva.dataProva).badgeClass)}>
                  {calculateDueStatus(detailProva.dataProva).badgeText}
                </span>
              </div>
            </div>

            {detailProva.descricao && (
              <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 text-xs">
                <span className="font-bold text-purple-900 block mb-1">Informações / Sala:</span>
                <p className="text-purple-800 whitespace-pre-wrap">{detailProva.descricao}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                  <span>Anotações & Tópicos de Estudo</span>
                </label>
                {notesSaveFeedback && (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3 h-3" />
                    Salvo!
                  </span>
                )}
              </div>
              <textarea
                rows={4}
                value={detailAnotacoes}
                onChange={(e) => setDetailAnotacoes(e.target.value)}
                placeholder="Anote aqui fórmulas importantes, tópicos que mais caem, dúvidas a tirar..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleDelete(detailProva.id!)}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(detailProva)}
                  className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition cursor-pointer"
                >
                  Editar Prova
                </button>
                <button
                  type="button"
                  onClick={handleSaveDetailNotes}
                  disabled={isSavingNotes}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingNotes ? 'Salvando...' : 'Salvar Anotações'}</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Form */}
      {isFormModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsFormModalOpen(false)}
          title={editingProva ? "Editar Prova" : "Nova Prova"}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSaveForm} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                Título / Identificação da Avaliação *
              </label>
              <input
                type="text"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Ex: 1ª Verificação (VA1), Prova Final..."
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                    Matéria / Disciplina *
                  </label>
                  {allDisciplinas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCustomDisciplina(prev => !prev)}
                      className="text-[11px] text-purple-600 hover:text-purple-800 font-bold transition cursor-pointer"
                    >
                      {isCustomDisciplina ? "← Escolher da lista" : "➕ Digitar outra"}
                    </button>
                  )}
                </div>

                {!isCustomDisciplina && allDisciplinas.length > 0 ? (
                  <select
                    value={formDisciplina}
                    onChange={(e) => handleDisciplinaChange(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                  >
                    <option value="" disabled>Selecione a disciplina...</option>
                    {groupedDisciplinas.map(group => (
                      <optgroup key={`form-group-${group.periodo}`} label={`Período ${group.periodo}`}>
                        {group.disciplinas.map(d => (
                          <option key={`form-${group.periodo}-${d.nome}`} value={d.nome}>
                            {d.nome}{d.docente ? ` • Prof. ${d.docente}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="__CUSTOM__">➕ Digitar outra matéria...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formDisciplina}
                    onChange={(e) => setFormDisciplina(e.target.value)}
                    placeholder="Ex: Cálculo I"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  Professor
                </label>
                <input
                  type="text"
                  value={formProfessor}
                  onChange={(e) => setFormProfessor(e.target.value)}
                  placeholder="Nome do docente..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  Data e Horário da Prova *
                </label>
                <input
                  type="datetime-local"
                  value={formDataProva}
                  onChange={(e) => setFormDataProva(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                >
                  <option value="Agendada">Agendada</option>
                  <option value="Realizada">Realizada</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                Informações da Prova / Sala / Observações
              </label>
              <textarea
                rows={2}
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Ex: Sala 204, levar calculadora científica, 10 questões..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                Anotações Iniciais de Revisão (Opcional)
              </label>
              <textarea
                rows={3}
                value={formAnotacoes}
                onChange={(e) => setFormAnotacoes(e.target.value)}
                placeholder="Rascunho de tópicos essenciais, fórmulas para lembrar..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                disabled={isSavingForm}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingForm}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                {isSavingForm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSavingForm ? 'Agendando...' : (editingProva ? "Salvar Alterações" : "Agendar Prova")}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal de Feedback de Notificações */}
      {notifFeedback && (
        <Modal
          isOpen={notifFeedback.isOpen}
          onClose={() => setNotifFeedback(null)}
          title={notifFeedback.title}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                notifFeedback.isSuccess ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-700"
              )}>
                {notifFeedback.isSuccess ? <BellRing className="w-5 h-5" /> : <Info className="w-5 h-5" />}
              </div>
              <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed">
                {notifFeedback.message}
              </p>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setNotifFeedback(null)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};