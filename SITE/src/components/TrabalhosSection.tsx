import React, { useState, useMemo, useEffect } from 'react';
import type { Trabalho, Disciplina, Nota } from '../types';
import {
  FileText,
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
  FileEdit,
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

interface TrabalhosSectionProps {
  trabalhos: Trabalho[];
  disciplinas: Disciplina[];
  notas: Nota[];
  onAdd: (t: Omit<Trabalho, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, t: Partial<Trabalho>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const TrabalhosSection: React.FC<TrabalhosSectionProps> = ({
  trabalhos,
  disciplinas,
  notas,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Pendente' | 'Concluído'>('ALL');
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTrabalho, setEditingTrabalho] = useState<Trabalho | null>(null);
  const [detailTrabalho, setDetailTrabalho] = useState<Trabalho | null>(null);
  const [detailAnotacoes, setDetailAnotacoes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaveFeedback, setNotesSaveFeedback] = useState(false);

  const [formTitulo, setFormTitulo] = useState('');
  const [formDisciplina, setFormDisciplina] = useState('');
  const [isCustomDisciplina, setIsCustomDisciplina] = useState(false);
  const [formProfessor, setFormProfessor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formDataEntrega, setFormDataEntrega] = useState('');
  const [formStatus, setFormStatus] = useState<'Pendente' | 'Concluído'>('Pendente');
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
    if (trabalhos && trabalhos.length > 0) {
      checkAndNotifyAcademicReminders(
        trabalhos.map(t => ({
          id: t.id,
          titulo: t.titulo,
          data: t.dataEntrega,
          disciplina: t.disciplina,
          tipo: 'Trabalho' as const,
          status: t.status,
        }))
      );
    }
  }, [trabalhos]);

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
        trabalhos.map(t => ({
          id: t.id,
          titulo: t.titulo,
          data: t.dataEntrega,
          disciplina: t.disciplina,
          tipo: 'Trabalho' as const,
          status: t.status,
        }))
      );
    }
  };

  const handleSendTestNotif = async () => {
    const sent = await sendBrowserNotification('🔔 Teste de Notificação UFRPE', {
      body: 'Seus alertas de trabalhos estão ativos e funcionando perfeitamente!',
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
    setEditingTrabalho(null);
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
    d.setDate(d.getDate() + 1);
    const datePart = d.toISOString().slice(0, 10);
    setFormDataEntrega(datePart + 'T23:59');
    setFormStatus('Pendente');
    setFormAnotacoes('');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (t: Trabalho, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTrabalho(t);
    setFormTitulo(t.titulo);
    setFormDisciplina(t.disciplina);
    setIsCustomDisciplina(!allDisciplinas.some(d => d.nome.toLowerCase() === t.disciplina.toLowerCase()));
    setFormProfessor(t.professor || '');
    setFormDescricao(t.descricao || '');
    setFormDataEntrega(t.dataEntrega || '');
    setFormStatus(t.status);
    setFormAnotacoes(t.anotacoes || '');
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
      setFormError('Por favor, informe o título do trabalho/atividade.');
      return;
    }
    if (!formDisciplina.trim()) {
      setFormError('Por favor, informe a matéria/disciplina.');
      return;
    }
    if (!formDataEntrega) {
      setFormError('Por favor, selecione a data e horário da entrega.');
      return;
    }

    setIsSavingForm(true);
    setFormError(null);

    try {
      if (editingTrabalho && editingTrabalho.id) {
        await onUpdate(editingTrabalho.id, {
          titulo: formTitulo.trim(),
          disciplina: formDisciplina.trim(),
          professor: formProfessor.trim(),
          descricao: formDescricao.trim(),
          dataEntrega: formDataEntrega,
          status: formStatus,
          anotacoes: formAnotacoes,
        });
        if (detailTrabalho && detailTrabalho.id === editingTrabalho.id) {
          setDetailTrabalho({
            ...detailTrabalho,
            titulo: formTitulo.trim(),
            disciplina: formDisciplina.trim(),
            professor: formProfessor.trim(),
            descricao: formDescricao.trim(),
            dataEntrega: formDataEntrega,
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
          dataEntrega: formDataEntrega,
          status: formStatus,
          anotacoes: formAnotacoes,
          archived: false,
        });
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao adicionar/salvar trabalho:', err);
      setFormError(err?.message || 'Ocorreu um erro ao salvar o trabalho. Tente novamente.');
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Tem certeza de que deseja excluir este trabalho?')) {
      await onDelete(id);
      if (detailTrabalho && detailTrabalho.id === id) {
        setDetailTrabalho(null);
      }
    }
  };

  const handleToggleStatus = async (t: Trabalho, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!t.id) return;
    const newStatus = t.status === 'Concluído' ? 'Pendente' : 'Concluído';
    await onUpdate(t.id, { status: newStatus });
    if (detailTrabalho && detailTrabalho.id === t.id) {
      setDetailTrabalho({ ...detailTrabalho, status: newStatus });
    }
  };

  const handleOpenDetail = (t: Trabalho) => {
    setDetailTrabalho(t);
    setDetailAnotacoes(t.anotacoes || '');
    setNotesSaveFeedback(false);
  };

  const handleSaveDetailNotes = async () => {
    if (!detailTrabalho || !detailTrabalho.id) return;
    setIsSavingNotes(true);
    await onUpdate(detailTrabalho.id, {
      anotacoes: detailAnotacoes,
    });
    setDetailTrabalho({
      ...detailTrabalho,
      anotacoes: detailAnotacoes,
    });
    setIsSavingNotes(false);
    setNotesSaveFeedback(true);
    setTimeout(() => setNotesSaveFeedback(false), 2500);
  };

  const filteredTrabalhos = useMemo(() => {
    return trabalhos.filter(t => {
      const matchSearch = (t.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.disciplina || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.professor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.anotacoes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchDisc = filterDisciplina === 'ALL' || t.disciplina.toLowerCase() === filterDisciplina.toLowerCase();
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;

      return matchSearch && matchDisc && matchStatus;
    }).sort((a, b) => new Date(a.dataEntrega).getTime() - new Date(b.dataEntrega).getTime());
  }, [trabalhos, searchTerm, filterDisciplina, filterStatus]);

  const pendentesCount = trabalhos.filter(t => t.status === 'Pendente').length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Minimal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
            Trabalhos & Atividades
          </h1>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-semibold",
            pendentesCount > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          )}>
            {pendentesCount === 0 ? 'Em dia' : `${pendentesCount} ${pendentesCount === 1 ? 'pendente' : 'pendentes'}`}
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
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Trabalho</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-gray-100 shadow-xs flex flex-col md:flex-row gap-2.5 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar trabalho, matéria, professor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            value={filterDisciplina}
            onChange={(e) => setFilterDisciplina(e.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
            className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">Todos os Status</option>
            <option value="Pendente">Pendentes</option>
            <option value="Concluído">Concluídos</option>
          </select>
        </div>
      </div>

      {/* Tabela de Trabalhos */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        {filteredTrabalhos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="font-semibold text-gray-700 text-xs sm:text-sm">Nenhum trabalho encontrado</p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Trabalho</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-2 px-3 w-10 text-center">Status</th>
                  <th className="py-2 px-3">Trabalho</th>
                  <th className="py-2 px-3">Matéria</th>
                  <th className="py-2 px-3">Professor</th>
                  <th className="py-2 px-3">Entrega</th>
                  <th className="py-2 px-3">Lembrete</th>
                  <th className="py-2 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {filteredTrabalhos.map(t => {
                  const due = calculateDueStatus(t.dataEntrega, t.status === 'Concluído');
                  return (
                    <tr 
                      key={t.id}
                      onClick={() => handleOpenDetail(t)}
                      className={cn(
                        "hover:bg-indigo-50/40 transition cursor-pointer group",
                        t.status === 'Concluído' && "bg-gray-50/40 opacity-75"
                      )}
                    >
                      <td className="py-2 px-3 text-center" onClick={(e) => handleToggleStatus(t, e)}>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-indigo-600 transition cursor-pointer"
                          title={t.status === 'Concluído' ? "Marcar como pendente" : "Marcar como concluído"}
                        >
                          {t.status === 'Concluído' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4 hover:text-indigo-600" />
                          )}
                        </button>
                      </td>

                      <td className="py-2 px-3">
                        <div className={cn("font-bold text-gray-900 group-hover:text-indigo-600 transition", t.status === 'Concluído' && "line-through text-gray-500")}>
                          {t.titulo}
                        </div>
                        {t.descricao && (
                          <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5 font-normal">
                            {t.descricao}
                          </div>
                        )}
                        {t.anotacoes && (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-600 mt-0.5 font-semibold">
                            <FileEdit className="w-2.5 h-2.5" />
                            <span>Possui anotações de estudo</span>
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold text-[11px] border border-indigo-100">
                          {t.disciplina}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                        {t.professor ? (
                          <div className="flex items-center gap-1 text-xs">
                            <User className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{t.professor}</span>
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
                            onClick={() => handleOpenEditModal(t)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                            title="Editar trabalho"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(t.id!, e)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Excluir trabalho"
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
      {detailTrabalho && (
        <Modal
          isOpen={true}
          onClose={() => setDetailTrabalho(null)}
          title="Ficha do Trabalho"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                  {detailTrabalho.disciplina}
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-0.5">
                  {detailTrabalho.titulo}
                </h3>
                {detailTrabalho.professor && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400" />
                    <span>Professor: {detailTrabalho.professor}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleToggleStatus(detailTrabalho)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0",
                  detailTrabalho.status === 'Concluído'
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                )}
              >
                {detailTrabalho.status === 'Concluído' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Concluído</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-3.5 h-3.5" />
                    <span>Pendente</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Data de Entrega</span>
                <span className="font-bold text-gray-800">
                  {calculateDueStatus(detailTrabalho.dataEntrega).formattedDate}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Prazo / Alerta</span>
                <span className={cn("inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold border", calculateDueStatus(detailTrabalho.dataEntrega).badgeClass)}>
                  {calculateDueStatus(detailTrabalho.dataEntrega).badgeText}
                </span>
              </div>
            </div>

            {detailTrabalho.descricao && (
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs">
                <span className="font-bold text-indigo-900 block mb-1">Instruções / Regras:</span>
                <p className="text-indigo-800 whitespace-pre-wrap">{detailTrabalho.descricao}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <FileEdit className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Anotações, Links & Rascunho</span>
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
                placeholder="Insira notas de progresso, links de referências, dúvidas ou checklist..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleDelete(detailTrabalho.id!)}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(detailTrabalho)}
                  className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition cursor-pointer"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDetailNotes}
                  disabled={isSavingNotes}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
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
          title={editingTrabalho ? "Editar Trabalho" : "Novo Trabalho"}
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
                Título do Trabalho *
              </label>
              <input
                type="text"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Ex: Seminário de Redes, Artigo Científico..."
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold transition cursor-pointer"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  Data e Hora da Entrega *
                </label>
                <input
                  type="datetime-local"
                  value={formDataEntrega}
                  onChange={(e) => setFormDataEntrega(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                Descrição ou Instruções
              </label>
              <textarea
                rows={2}
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Detalhes, regras ou formato da entrega..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                Anotações Iniciais de Estudo (Opcional)
              </label>
              <textarea
                rows={3}
                value={formAnotacoes}
                onChange={(e) => setFormAnotacoes(e.target.value)}
                placeholder="Rascunho de tópicos, ideias, links..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                {isSavingForm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSavingForm ? 'Cadastrando...' : (editingTrabalho ? "Salvar Alterações" : "Cadastrar Trabalho")}</span>
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
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
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