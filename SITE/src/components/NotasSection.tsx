import React, { useState, useMemo } from 'react';
import type { Nota, Disciplina } from '../types';
import { badgeClass, calcularNotas } from '../lib/utils';
import { Modal, Input, Select, Label } from './ui';
import { Plus, Archive, Undo2, Search, Edit3, Trash2, CheckCircle2, AlertCircle, Sparkles, Table as TableIcon, LayoutGrid } from 'lucide-react';

interface Props {
  notas: Nota[];
  disciplinas?: Disciplina[];
  onAdd: (n: Omit<Nota, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<Nota>) => void;
  onDelete?: (id: string) => void;
  onRenameDisciplina?: (oldNome: string, newNome: string) => Promise<void>;
}

export const NotasSection: React.FC<Props> = ({ 
  notas, 
  disciplinas = [], 
  onAdd, 
  onUpdate, 
  onDelete,
  onRenameDisciplina 
}) => {
  const [archived, setArchived] = useState(false);
  const [periodoFiltro, setPeriodoFiltro] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isModalOpen, setModalOpen] = useState(false);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalNome, setOriginalNome] = useState<string>('');
  const [fModo, setFModo] = useState<'matriculada' | 'outro'>('matriculada');
  const [fNome, setFNome] = useState('');
  const [fPer, setFPer] = useState('2026.2');
  const [fCH, setFCH] = useState(60);
  const [fN1, setFN1] = useState('');
  const [fN2, setFN2] = useState('');
  const [fN3, setFN3] = useState('');
  const [fFinal, setFFinal] = useState('');
  const [fSitManual, setFSitManual] = useState<string>('');

  // Disciplinas que está matriculado (MATR e não arquivadas)
  const matriculadas = useMemo(() => {
    return notas.filter(n => !n.archived && n.situacao === 'MATR');
  }, [notas]);

  const matriculadasNomes = useMemo(() => {
    const fromNotas = matriculadas.map(m => m.componente);
    const fromDiscs = disciplinas.filter(d => !d.archived && d.status !== 'CONCLUIDA').map(d => d.nome);
    return Array.from(new Set([...fromNotas, ...fromDiscs])).filter(Boolean);
  }, [matriculadas, disciplinas]);

  const filtered = useMemo(() => {
    const list = notas.filter(n => {
      if (n.archived !== archived) return false;
      if (periodoFiltro && n.periodo !== periodoFiltro) return false;
      if (search && !n.componente.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    
    const deduped: Nota[] = [];
    const seen = new Set<string>();
    for (const n of list) {
      const key = `${n.componente}-${n.periodo}-${n.archived}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(n);
      }
    }
    return deduped;
  }, [notas, archived, periodoFiltro, search]);

  const periodos = useMemo(() => {
    return Array.from(new Set(notas.map(n => n.periodo).filter(Boolean))).sort().reverse();
  }, [notas]);

  // Cálculo ao vivo com base na regra do usuário:
  // "preciso de 3 notas e a final para inserir, se a soma de 2 notas for maior que sete considere como aprovado, se houver 3 notas considerar as duas maiores"
  const valN1 = fN1.trim() !== '' ? parseFloat(fN1) : null;
  const valN2 = fN2.trim() !== '' ? parseFloat(fN2) : null;
  const valN3 = fN3.trim() !== '' ? parseFloat(fN3) : null;
  const valFinal = fFinal.trim() !== '' ? parseFloat(fFinal) : null;

  const resultadoCalc = useMemo(() => {
    return calcularNotas(valN1, valN2, valN3, valFinal);
  }, [valN1, valN2, valN3, valFinal]);

  const situacaoEfetiva = fSitManual || resultadoCalc.situacaoSugerida;

  const abrirModalParaNova = () => {
    setEditingId(null);
    setOriginalNome('');
    if (matriculadasNomes.length > 0) {
      setFModo('matriculada');
      setFNome(matriculadasNomes[0]);
      const existing = notas.find(n => n.componente === matriculadasNomes[0] && !n.archived);
      carregarDadosNota(existing);
    } else {
      setFModo('outro');
      setFNome('');
      limparCamposNotas();
    }
    setModalOpen(true);
  };

  const abrirModalParaEdicao = (nota: Nota) => {
    setEditingId(nota.id || null);
    setOriginalNome(nota.componente);
    setFNome(nota.componente);
    // Para edição, permite editar e renomear diretamente o nome da disciplina
    setFModo('outro');
    carregarDadosNota(nota);
    setModalOpen(true);
  };

  const carregarDadosNota = (nota?: Nota) => {
    if (nota) {
      setEditingId(nota.id || null);
      setFPer(nota.periodo || '2026.2');
      setFCH(nota.ch || 60);
      setFN1(nota.nota1 != null ? String(nota.nota1) : '');
      setFN2(nota.nota2 != null ? String(nota.nota2) : '');
      setFN3(nota.nota3 != null ? String(nota.nota3) : '');
      setFFinal(nota.final != null ? String(nota.final) : '');
      setFSitManual(nota.situacao || '');
    } else {
      limparCamposNotas();
    }
  };

  const limparCamposNotas = () => {
    setFPer('2026.2');
    setFCH(60);
    setFN1('');
    setFN2('');
    setFN3('');
    setFFinal('');
    setFSitManual('');
  };

  const handleSelecionarMatriculada = (nome: string) => {
    if (nome === '__OUTRO__') {
      setFModo('outro');
      setFNome('');
      setEditingId(null);
      limparCamposNotas();
      return;
    }

    setFNome(nome);
    const existing = notas.find(n => n.componente === nome && !n.archived);
    carregarDadosNota(existing);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fNome.trim()) return;

    const cleanNewName = fNome.trim();
    if (editingId && originalNome && originalNome.trim().toLowerCase() !== cleanNewName.toLowerCase()) {
      if (onRenameDisciplina) {
        await onRenameDisciplina(originalNome.trim(), cleanNewName);
      }
    }

    const mediaFinal = resultadoCalc.media != null ? resultadoCalc.media : null;
    const situacaoFinal = situacaoEfetiva || 'MATR';
    const isArchived = situacaoFinal === 'APR' || situacaoFinal === 'REP' || situacaoFinal === 'REPF';

    const payload: Omit<Nota, 'id' | 'createdAt' | 'updatedAt'> = {
      componente: cleanNewName,
      periodo: fPer.trim() || '2026.2',
      ch: Number(fCH) || 60,
      nota1: valN1 !== null && !isNaN(valN1) ? valN1 : null,
      nota2: valN2 !== null && !isNaN(valN2) ? valN2 : null,
      nota3: valN3 !== null && !isNaN(valN3) ? valN3 : null,
      final: valFinal !== null && !isNaN(valFinal) ? valFinal : null,
      media: mediaFinal !== null && !isNaN(mediaFinal) ? mediaFinal : null,
      situacao: situacaoFinal,
      archived: isArchived
    };

    if (editingId) {
      onUpdate(editingId, payload);
    } else {
      onAdd(payload);
    }

    setModalOpen(false);
  };

  return (
    <div className="pt-2">
      {/* Barra de Filtros e Ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
          <button 
            onClick={() => {
              setArchived(false);
              setPeriodoFiltro('');
            }}
            className={`flex-1 md:flex-none px-6 py-2 text-sm font-semibold rounded-lg transition-all ${!archived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Cursando ({notas.filter(n => !n.archived).length})
          </button>
          <button 
            onClick={() => setArchived(true)}
            className={`flex-1 md:flex-none px-6 py-2 text-sm font-semibold rounded-lg transition-all ${archived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Todas as Cadeiras ({notas.filter(n => n.archived).length})
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {archived && (
            <Select value={periodoFiltro} onChange={e => setPeriodoFiltro(e.target.value)} className="w-full sm:w-40 !py-2.5">
              <option value="">Todos períodos</option>
              {periodos.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          )}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <Input 
              type="search" 
              placeholder="Buscar..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 !py-2.5"
            />
          </div>

          {/* Alternador de Modo de Visualização: Tabela vs Cards */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Tabela"
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Cards"
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <button 
            onClick={abrirModalParaNova}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-sm w-full sm:w-auto justify-center shrink-0"
          >
            <Plus className="w-4 h-4" />
            Notas
          </button>
        </div>
      </div>

      {/* Conteúdo: Vazio vs Tabela vs Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100/50 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Archive className="w-8 h-8" />
          </div>
          <p className="text-gray-500 font-medium">
            {archived ? 'Nenhuma nota arquivada encontrada.' : 'Nenhuma disciplina em andamento.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-3xl border border-gray-100/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/50 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Período</th>
                  <th className="px-6 py-4">Componente</th>
                  <th className="px-6 py-4 text-center">CH</th>
                  <th className="px-4 py-4 text-center">Nota 1</th>
                  <th className="px-4 py-4 text-center">Nota 2</th>
                  <th className="px-4 py-4 text-center">Nota 3</th>
                  <th className="px-4 py-4 text-center">Final</th>
                  <th className="px-4 py-4 text-center">Média</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((n) => {
                  const calc = calcularNotas(n.nota1, n.nota2, n.nota3, n.final);
                  const mediaVal = calc.media != null ? calc.media : n.media;
                  const mediaDisplay = mediaVal != null ? mediaVal.toFixed(1) : '—';

                  return (
                    <tr key={n.id || `${n.componente}-${n.periodo}`} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-md text-xs">
                          {n.periodo?.replace('20', '') || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => abrirModalParaEdicao(n)}
                          className="font-bold text-gray-900 hover:text-indigo-600 text-left transition-colors flex items-center gap-1.5"
                        >
                          <span>{n.componente}</span>
                          <Edit3 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-500 font-medium">{n.ch || '—'}h</td>
                      
                      {/* N1 */}
                      <td className="px-4 py-4 text-center">
                        {n.nota1 != null ? (
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">
                            {n.nota1.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* N2 */}
                      <td className="px-4 py-4 text-center">
                        {n.nota2 != null ? (
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">
                            {n.nota2.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* N3 */}
                      <td className="px-4 py-4 text-center">
                        {n.nota3 != null ? (
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 text-xs" title="3ª Avaliação">
                            {n.nota3.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Final */}
                      <td className="px-4 py-4 text-center">
                        {n.final != null ? (
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs" title="Prova Final">
                            {n.final.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Média */}
                      <td className="px-4 py-4 text-center">
                        {mediaDisplay !== '—' ? (
                          <span className={`font-mono font-bold text-sm ${parseFloat(mediaDisplay) > 7.0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                            {mediaDisplay}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${badgeClass(n.situacao)}`}>
                          {n.situacao}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => abrirModalParaEdicao(n)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar / Lançar Notas"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onUpdate(n.id!, { archived: !n.archived })}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={archived ? "Desarquivar" : "Arquivar"}
                          >
                            {archived ? <Undo2 className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                          </button>
                          {onDelete && n.id && (
                            <button 
                              onClick={() => {
                                if (window.confirm(`Excluir o registro de ${n.componente}?`)) {
                                  onDelete(n.id!);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
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
        /* Visualização em Cards Padrão */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filtered.map((n) => {
            const calc = calcularNotas(n.nota1, n.nota2, n.nota3, n.final);
            const mediaVal = calc.media != null ? calc.media : n.media;
            const mediaDisplay = mediaVal != null ? mediaVal.toFixed(1) : '—';
            const situacaoDisplay = n.situacao || calc.situacaoSugerida || 'MATR';
            const temNotas = n.nota1 != null || n.nota2 != null || n.nota3 != null || n.final != null;

            return (
              <div 
                key={n.id || `${n.componente}-${n.periodo}`}
                onClick={() => abrirModalParaEdicao(n)}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <span className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-indigo-600 transition-colors block truncate">
                        {n.componente}
                      </span>
                      {n.periodo && (
                        <span className="text-[11px] font-semibold text-gray-400 mt-0.5 block">
                          Período {n.periodo.replace('20', '')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                        {n.ch || 60}h
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass(situacaoDisplay)}`}>
                        {situacaoDisplay}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 py-2 px-3 bg-gray-50/80 rounded-xl mb-3 text-xs font-mono">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 font-sans text-[11px]">N1:</span>
                      <strong className="text-gray-800">{n.nota1 != null ? n.nota1.toFixed(1) : '—'}</strong>
                    </div>
                    <span className="text-gray-300 font-sans">|</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 font-sans text-[11px]">N2:</span>
                      <strong className="text-gray-800">{n.nota2 != null ? n.nota2.toFixed(1) : '—'}</strong>
                    </div>
                    {n.nota3 != null && (
                      <>
                        <span className="text-gray-300 font-sans">|</span>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 font-sans text-[11px]">N3:</span>
                          <strong className="text-gray-800">{n.nota3.toFixed(1)}</strong>
                        </div>
                      </>
                    )}
                    {n.final != null && (
                      <>
                        <span className="text-gray-300 font-sans">|</span>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 font-sans text-[11px]">Final:</span>
                          <strong className="text-gray-800">{n.final.toFixed(1)}</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400 font-medium">Média:</span>
                    <span className={`font-mono font-bold ${mediaDisplay !== '—' && parseFloat(mediaDisplay) > 7.0 ? 'text-emerald-600' : (mediaDisplay !== '—' ? 'text-gray-900' : 'text-gray-400')}`}>
                      {mediaDisplay}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 group-hover:underline">
                      <Edit3 className="w-3.5 h-3.5" />
                      {temNotas ? 'Editar' : 'Lançar'}
                    </span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(n.id!, { archived: !n.archived });
                      }}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title={archived ? "Desarquivar" : "Arquivar"}
                    >
                      {archived ? <Undo2 className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </button>
                    {onDelete && n.id && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Excluir o registro de ${n.componente}?`)) {
                            onDelete(n.id!);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Lançamento / Edição de Notas */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingId ? "Editar Notas" : "Lançar Notas"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seleção de Disciplina */}
          <div>
            <Label>Nome da Disciplina</Label>
            {matriculadasNomes.length > 0 && fModo === 'matriculada' ? (
              <div className="space-y-2">
                <Select 
                  value={fNome} 
                  onChange={e => handleSelecionarMatriculada(e.target.value)}
                  className="w-full font-medium"
                >
                  <optgroup label="Disciplinas Matriculadas (Semestre Atual)">
                    {matriculadasNomes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                  <option value="__OUTRO__">+ Outra disciplina (digitar)...</option>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Input 
                  required 
                  value={fNome} 
                  onChange={e => setFNome(e.target.value)} 
                  placeholder="Ex: Literatura Brasileira III" 
                />
                {matriculadasNomes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFModo('matriculada');
                      handleSelecionarMatriculada(matriculadasNomes[0]);
                    }}
                    className="text-xs text-indigo-600 hover:underline font-semibold"
                  >
                    ← Voltar para lista de matriculadas
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Período e CH */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Período</Label>
              <Input value={fPer} onChange={e => setFPer(e.target.value)} placeholder="2026.2" />
            </div>
            <div>
              <Label>Carga Horária (h)</Label>
              <Input type="number" min="0" value={fCH} onChange={e => setFCH(Number(e.target.value))} />
            </div>
          </div>

          {/* 3 Notas + Prova Final */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Avaliações
              </span>
              {(fN1 || fN2 || fN3 || fFinal) && (
                <button
                  type="button"
                  onClick={() => {
                    setFN1('');
                    setFN2('');
                    setFN3('');
                    setFFinal('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-lg transition cursor-pointer"
                >
                  Limpar Todas
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="!mb-0">Nota 1 (VA 1)</Label>
                  {fN1 && (
                    <button
                      type="button"
                      onClick={() => setFN1('')}
                      className="text-[10px] text-gray-400 hover:text-rose-600 font-bold"
                      title="Deixar vazia"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <Input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="10" 
                  value={fN1} 
                  onChange={e => setFN1(e.target.value)} 
                  placeholder="Vazio" 
                  className="font-mono text-center font-bold"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="!mb-0">Nota 2 (VA 2)</Label>
                  {fN2 && (
                    <button
                      type="button"
                      onClick={() => setFN2('')}
                      className="text-[10px] text-gray-400 hover:text-rose-600 font-bold"
                      title="Deixar vazia"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <Input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="10" 
                  value={fN2} 
                  onChange={e => setFN2(e.target.value)} 
                  placeholder="Vazio" 
                  className="font-mono text-center font-bold"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="!mb-0">Nota 3 (VA 3)</Label>
                  {fN3 && (
                    <button
                      type="button"
                      onClick={() => setFN3('')}
                      className="text-[10px] text-gray-400 hover:text-rose-600 font-bold"
                      title="Deixar vazia"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <Input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="10" 
                  value={fN3} 
                  onChange={e => setFN3(e.target.value)} 
                  placeholder="Opcional" 
                  className="font-mono text-center font-bold"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="!mb-0">Prova Final</Label>
                  {fFinal && (
                    <button
                      type="button"
                      onClick={() => setFFinal('')}
                      className="text-[10px] text-gray-400 hover:text-rose-600 font-bold"
                      title="Deixar vazia"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <Input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="10" 
                  value={fFinal} 
                  onChange={e => setFFinal(e.target.value)} 
                  placeholder="Opcional" 
                  className="font-mono text-center font-bold text-purple-700"
                />
              </div>
            </div>
          </div>

          {/* Painel Informativo com Cálculo Automático */}
          <div className="p-3.5 rounded-2xl border transition-colors bg-indigo-50/50 border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {resultadoCalc.situacaoSugerida === 'APR' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-800">
                <span>Média: <strong className="font-mono text-indigo-700">{resultadoCalc.media != null ? resultadoCalc.media.toFixed(1) : '—'}</strong></span>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider text-xs ${badgeClass(situacaoEfetiva)}`}>
              {situacaoEfetiva}
            </span>
          </div>

          {/* Situação */}
          <div>
            <Label>Situação do Componente</Label>
            <Select 
              value={situacaoEfetiva} 
              onChange={e => setFSitManual(e.target.value)}
              className="font-medium"
            >
              <option value="MATR">MATR - Matriculado (Em andamento)</option>
              <option value="APR">APR - Aprovado</option>
              <option value="REP">REP - Reprovado</option>
            </Select>
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 flex items-center justify-end gap-2 sm:gap-3 border-t border-gray-100">
            {editingId && onDelete && (
              <button 
                type="button" 
                onClick={() => {
                  if (window.confirm(`Excluir o registro de notas de "${fNome}"?`)) {
                    onDelete(editingId);
                    setModalOpen(false);
                  }
                }}
                className="mr-auto px-3.5 py-2 text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                title="Remover este registro"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Excluir</span>
              </button>
            )}
            <button 
              type="button" 
              onClick={() => setModalOpen(false)} 
              className="px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm cursor-pointer"
            >
              Salvar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
