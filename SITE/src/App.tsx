import React, { useState } from 'react';
import { AuthUI } from './components/AuthUI';
import { useAuth, useProfile, useCollection } from './lib/hooks';
import type { Nota, Frequencia, Progresso, Disciplina, Horario, Trabalho, Prova } from './types';
import { SummarySection } from './components/SummarySection';
import { NotasSection } from './components/NotasSection';
import { FreqSection } from './components/FreqSection';
import { ProgressoSection } from './components/ProgressoSection';
import { DisciplinasSection } from './components/DisciplinasSection';
import { TrabalhosSection } from './components/TrabalhosSection';
import { ProvasSection } from './components/ProvasSection';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LogOut, BookMarked, PieChart, GraduationCap, CalendarDays, RefreshCw, PanelLeft, PanelLeftOpen, Menu, X, Database, ShieldCheck, UtensilsCrossed, FileText, Award } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { cn } from './lib/utils';
import { DataBackupModal } from './components/DataBackupModal';
import { RuSection } from './components/RuSection';
import { useRuManager } from './lib/useRuManager';

export default function App() {
  const { user } = useAuth();
  const userId = user?.uid;
  const { profile } = useProfile(userId);

  const ru = useRuManager(userId);

  const { data: notas, add: addNota, update: updateNota, remove: removeNota, loading: notasLoading } = useCollection<Nota>(userId, 'notas');
  const { data: freqs, add: addFreq, update: updateFreq, remove: removeFreq, loading: freqsLoading } = useCollection<Frequencia>(userId, 'freqs');
  const { data: progs, add: addProg, update: updateProg, remove: removeProg, loading: progsLoading } = useCollection<Progresso>(userId, 'progs');
  const { data: discs, add: addDisc, update: updateDisc, remove: removeDisc, loading: discsLoading } = useCollection<Disciplina>(userId, 'discs');
  const { data: horarios, add: addHorario, update: updateHorario, remove: removeHorario, loading: horariosLoading } = useCollection<Horario>(userId, 'horarios');
  const { data: trabalhos, add: addTrabalho, update: updateTrabalho, remove: removeTrabalho, loading: trabalhosLoading } = useCollection<Trabalho>(userId, 'trabalhos');
  const { data: provas, add: addProva, update: updateProva, remove: removeProva, loading: provasLoading } = useCollection<Prova>(userId, 'provas');

  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('ufrpe_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Bloquear clique com botão direito do mouse no site
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('ufrpe_sidebar_open', String(next));
      return next;
    });
  };

  const isDataLoading = notasLoading || freqsLoading || progsLoading || discsLoading || horariosLoading || trabalhosLoading || provasLoading;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans text-gray-900">
        <AuthUI />
      </div>
    );
  }

  const tabs = [
    { id: 'home', label: 'Início', icon: PieChart },
    { id: 'ru', label: 'R.U.', icon: UtensilsCrossed },
    { id: 'trabalhos', label: 'Trabalhos', icon: FileText },
    { id: 'provas', label: 'Provas', icon: Award },
    { id: 'disc', label: 'Disciplinas', icon: BookMarked },
    { id: 'notas', label: 'Notas', icon: GraduationCap },
    { id: 'freq', label: 'Frequência', icon: CalendarDays },
    { id: 'prog', label: 'Progresso', icon: PieChart }
  ];

  const now = new Date();
  const hour = now.getHours();
  let greeting = 'Olá!';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia!';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde!';
  else if (hour >= 18 && hour < 24) greeting = 'Boa noite!';
  else greeting = 'Olá, madrugador(a)!';

  const formattedDate = now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Deduplicate data to handle accidental double-seeding
  const uniqueNotas = Array.from(new Map(notas.map(n => [`${n.componente}-${n.periodo}-${n.archived}`, n])).values());
  const uniqueFreqs = Array.from(new Map(freqs.map(f => [`${f.componente}-${f.data}-${f.status}-${f.archived}`, f])).values());
  const uniqueProgs = Array.from(new Map(progs.map(p => [p.disciplina, p])).values());
  const uniqueDiscs = Array.from(new Map(discs.map(d => [d.nome, d])).values());

  const pendentesTrabalhos = trabalhos.filter(t => t.status === 'Pendente').length;
  const agendadasProvas = provas.filter(p => p.status === 'Agendada').length;

  const handleDeleteDisciplina = async (disciplinaId: string, nome: string) => {
    // Remover da coleção de disciplinas (todas as instâncias com mesmo ID ou nome)
    const matchingDiscs = discs.filter(d => (disciplinaId && d.id === disciplinaId) || d.nome.toLowerCase() === nome.toLowerCase());
    for (const d of matchingDiscs) {
      if (d.id) await removeDisc(d.id);
    }
    // Também remover notas associadas se existirem
    const matchingNotas = notas.filter(n => n.componente.toLowerCase() === nome.toLowerCase());
    for (const n of matchingNotas) {
      if (n.id) await removeNota(n.id);
    }
    // Também remover de progressos se existir
    if (removeProg) {
      const matchingProgs = progs.filter(p => (disciplinaId && p.id === disciplinaId) || p.disciplina.toLowerCase() === nome.toLowerCase());
      for (const p of matchingProgs) {
        if (p.id) await removeProg(p.id);
      }
    }
    // Remover trabalhos e provas vinculados
    const matchingTrabalhos = trabalhos.filter(t => t.disciplina.toLowerCase() === nome.toLowerCase());
    for (const t of matchingTrabalhos) {
      if (t.id) await removeTrabalho(t.id);
    }
    const matchingProvas = provas.filter(p => p.disciplina.toLowerCase() === nome.toLowerCase());
    for (const p of matchingProvas) {
      if (p.id) await removeProva(p.id);
    }
  };

  const handleMoveDisciplinaStatus = async (
    disciplina: Disciplina, 
    newStatus: 'PENDENTE' | 'CURSANDO' | 'CONCLUIDA'
  ) => {
    const existingNotas = notas.filter(n => n.componente.toLowerCase() === disciplina.nome.toLowerCase());
    const matchingProg = progs.find(p => p.disciplina.toLowerCase().trim() === disciplina.nome.toLowerCase().trim());
    
    if (newStatus === 'CONCLUIDA') {
      if (disciplina.id && updateDisc) {
        await updateDisc(disciplina.id, { archived: true, status: 'CONCLUIDA' });
      }
      if (existingNotas.length > 0) {
        for (const n of existingNotas) {
          if (n.id) await updateNota(n.id, { situacao: 'APR', media: n.media || 8.0, archived: true });
        }
      } else {
        await addNota({
          componente: disciplina.nome,
          ch: 60,
          situacao: 'APR',
          media: 8.5,
          periodo: disciplina.periodo || '2026.1',
          archived: true,
        });
      }
      if (matchingProg?.id && updateProg) {
        await updateProg(matchingProg.id, { status: 'Concluída', archived: true });
      }
    } else if (newStatus === 'CURSANDO') {
      if (disciplina.id && updateDisc) {
        await updateDisc(disciplina.id, { archived: false, status: 'CURSANDO', periodo: '2026.2' });
      }
      if (existingNotas.length > 0) {
        for (const n of existingNotas) {
          if (n.id) await updateNota(n.id, { situacao: 'MATR', periodo: '2026.2', archived: false });
        }
      } else {
        await addNota({
          componente: disciplina.nome,
          ch: 60,
          situacao: 'MATR',
          periodo: '2026.2',
          archived: false,
        });
      }
      if (matchingProg?.id && updateProg) {
        await updateProg(matchingProg.id, { status: 'Matriculada', archived: false });
      }
    } else if (newStatus === 'PENDENTE') {
      if (disciplina.id && updateDisc) {
        await updateDisc(disciplina.id, { archived: false, status: 'PENDENTE' });
      } else if (addDisc && !disciplina.id) {
        await addDisc({
          nome: disciplina.nome,
          completo: disciplina.completo || disciplina.nome,
          periodo: disciplina.periodo || 'Pendente',
          status: 'PENDENTE',
          archived: false,
        });
      }
      for (const n of existingNotas) {
        if (n.id) await removeNota(n.id);
      }
      if (matchingProg?.id && updateProg) {
        await updateProg(matchingProg.id, { status: 'Pendente', archived: false });
      }
    }
  };

  const handleRenameDisciplina = async (
    oldNome: string,
    newNome: string,
    extraUpdates?: Partial<Disciplina>
  ) => {
    if (!userId || !oldNome?.trim()) return;
    const cleanOld = oldNome.trim();
    const cleanNew = (newNome || '').trim();
    if (!cleanNew) return;

    const isSameName = cleanOld.toLowerCase() === cleanNew.toLowerCase();
    const batch = writeBatch(db);
    const now = Date.now();

    // 1. Atualizar ou criar na coleção 'discs' (disciplinas globais)
    let foundInDiscs = false;
    discs.forEach(d => {
      if (d.nome && d.nome.trim().toLowerCase() === cleanOld.toLowerCase()) {
        foundInDiscs = true;
        if (d.id) {
          const ref = doc(db, 'users', userId, 'discs', d.id);
          const updatesToApply: Record<string, any> = {
            nome: cleanNew,
            updatedAt: now,
          };
          if (extraUpdates?.completo !== undefined) {
            updatesToApply.completo = extraUpdates.completo;
          } else if (d.completo && d.completo.trim().toLowerCase() === cleanOld.toLowerCase()) {
            updatesToApply.completo = cleanNew;
          }
          if (extraUpdates?.periodo !== undefined) updatesToApply.periodo = extraUpdates.periodo;
          if (extraUpdates?.status !== undefined) updatesToApply.status = extraUpdates.status;
          if (extraUpdates?.archived !== undefined) updatesToApply.archived = extraUpdates.archived;
          batch.update(ref, updatesToApply);
        }
      }
    });

    if (!foundInDiscs) {
      const newRef = doc(collection(db, 'users', userId, 'discs'));
      batch.set(newRef, {
        nome: cleanNew,
        completo: extraUpdates?.completo || cleanNew,
        periodo: extraUpdates?.periodo || profile?.period || '2026.2',
        archived: extraUpdates?.archived ?? false,
        status: extraUpdates?.status || 'CURSANDO',
        createdAt: now,
        updatedAt: now,
      });
    }

    // Se o nome mudou, propagar em cascata para TODAS as outras coleções
    if (!isSameName) {
      // 2. Atualizar todas as Notas vinculadas
      notas.forEach(n => {
        if (n.componente && n.componente.trim().toLowerCase() === cleanOld.toLowerCase() && n.id) {
          const ref = doc(db, 'users', userId, 'notas', n.id);
          batch.update(ref, {
            componente: cleanNew,
            updatedAt: now,
          });
        }
      });

      // 3. Atualizar todas as Frequências vinculadas
      freqs.forEach(f => {
        if (f.componente && f.componente.trim().toLowerCase() === cleanOld.toLowerCase() && f.id) {
          const ref = doc(db, 'users', userId, 'freqs', f.id);
          batch.update(ref, {
            componente: cleanNew,
            updatedAt: now,
          });
        }
      });

      // 4. Atualizar todos os Horários vinculados
      horarios.forEach(h => {
        if (h.disciplina && h.disciplina.trim().toLowerCase() === cleanOld.toLowerCase() && h.id) {
          const ref = doc(db, 'users', userId, 'horarios', h.id);
          batch.update(ref, {
            disciplina: cleanNew,
            updatedAt: now,
          });
        }
      });

      // 5. Atualizar todos os Progressos vinculados
      progs.forEach(p => {
        if (p.disciplina && p.disciplina.trim().toLowerCase() === cleanOld.toLowerCase() && p.id) {
          const ref = doc(db, 'users', userId, 'progs', p.id);
          batch.update(ref, {
            disciplina: cleanNew,
            updatedAt: now,
          });
        }
      });

      // 6. Atualizar todos os Trabalhos vinculados
      trabalhos.forEach(t => {
        if (t.disciplina && t.disciplina.trim().toLowerCase() === cleanOld.toLowerCase() && t.id) {
          const ref = doc(db, 'users', userId, 'trabalhos', t.id);
          batch.update(ref, {
            disciplina: cleanNew,
            updatedAt: now,
          });
        }
      });

      // 7. Atualizar todas as Provas vinculadas
      provas.forEach(p => {
        if (p.disciplina && p.disciplina.trim().toLowerCase() === cleanOld.toLowerCase() && p.id) {
          const ref = doc(db, 'users', userId, 'provas', p.id);
          batch.update(ref, {
            disciplina: cleanNew,
            updatedAt: now,
          });
        }
      });
    }

    await batch.commit();
  };

  const handleUpdateDisciplina = async (id: string, updates: Partial<Disciplina>) => {
    const current = discs.find(d => d.id === id);
    if (current && updates.nome && updates.nome.trim().toLowerCase() !== current.nome.trim().toLowerCase()) {
      await handleRenameDisciplina(current.nome, updates.nome.trim(), updates);
      return;
    }
    if (updateDisc && id) {
      await updateDisc(id, updates);
    }
  };

  const handleAddDisciplina = async (n: Omit<Disciplina, 'id' | 'createdAt' | 'updatedAt'>) => {
    await addDisc(n);
    const cleanNome = n.nome.trim();
    const disciplineCh = n.ch || 60;
    const existingNota = notas.find(item => item.componente.trim().toLowerCase() === cleanNome.toLowerCase());
    if (!existingNota) {
      if (n.status === 'CONCLUIDA' || n.archived) {
        await addNota({
          componente: cleanNome,
          ch: disciplineCh,
          situacao: 'APR',
          media: 8.5,
          periodo: n.periodo || profile?.period || '2026.1',
          archived: true,
        });
        const existingProg = progs.find(p => p.disciplina.trim().toLowerCase() === cleanNome.toLowerCase());
        if (!existingProg && addProg) {
          await addProg({
            disciplina: cleanNome,
            tipo: 'Obrigatória',
            ch: disciplineCh,
            status: 'Concluída',
            archived: true,
          });
        }
      } else if (n.status === 'PENDENTE') {
        // Para disciplina pendente, não cria nota MATR
        const existingProg = progs.find(p => p.disciplina.trim().toLowerCase() === cleanNome.toLowerCase());
        if (!existingProg && addProg) {
          await addProg({
            disciplina: cleanNome,
            tipo: n.periodo || 'Obrigatória',
            ch: disciplineCh,
            status: 'Pendente',
            archived: false,
          });
        }
      } else {
        await addNota({
          componente: cleanNome,
          ch: disciplineCh,
          situacao: 'MATR',
          periodo: n.periodo || profile?.period || '2026.2',
          archived: false,
        });
        const existingProg = progs.find(p => p.disciplina.trim().toLowerCase() === cleanNome.toLowerCase());
        if (!existingProg && addProg) {
          await addProg({
            disciplina: cleanNome,
            tipo: 'Obrigatória',
            ch: disciplineCh,
            status: 'Matriculada',
            archived: false,
          });
        }
      }
    }
  };

  const handleAddNotaGlobal = async (n: Omit<Nota, 'id' | 'createdAt' | 'updatedAt'>) => {
    await addNota(n);
    const cleanNome = n.componente.trim();
    const isApproved = n.situacao === 'APR' || (n.archived === true && n.situacao !== 'REP' && n.situacao !== 'REPF');
    const isRep = n.situacao === 'REP' || n.situacao === 'REPF';
    const discStatus = isApproved ? 'CONCLUIDA' : isRep ? 'PENDENTE' : 'CURSANDO';
    const isArchived = isApproved;

    const matchingDisc = discs.find(d => d.nome.trim().toLowerCase() === cleanNome.toLowerCase());
    if (!matchingDisc) {
      await addDisc({
        nome: cleanNome,
        completo: cleanNome,
        periodo: n.periodo || profile?.period || '2026.2',
        archived: isArchived,
        status: discStatus,
        ch: n.ch || 60,
      });
    } else if (matchingDisc.id && updateDisc) {
      await updateDisc(matchingDisc.id, {
        status: discStatus,
        archived: isArchived,
        ch: n.ch || matchingDisc.ch || 60,
      });
    }

    const matchingProg = progs.find(p => p.disciplina.trim().toLowerCase() === cleanNome.toLowerCase());
    const progStatus = isApproved ? 'Concluída' : isRep ? 'Pendente' : 'Matriculada';
    if (!matchingProg && addProg) {
      await addProg({
        disciplina: cleanNome,
        tipo: 'Obrigatória',
        ch: n.ch || 60,
        status: progStatus,
        archived: isArchived,
      });
    } else if (matchingProg?.id && updateProg) {
      await updateProg(matchingProg.id, {
        status: progStatus,
        archived: isArchived,
        ch: n.ch || matchingProg.ch || 60,
      });
    }
  };

  const handleUpdateNotaGlobal = async (id: string, updates: Partial<Nota>) => {
    const current = notas.find(n => n.id === id);
    if (current && updates.componente && updates.componente.trim().toLowerCase() !== current.componente.trim().toLowerCase()) {
      await handleRenameDisciplina(current.componente, updates.componente.trim());
    }
    await updateNota(id, updates);

    // Propagar em cascata atualizações de aprovação/reprovação/matrícula para discs e progs
    const effectiveComp = (updates.componente || current?.componente || '').trim();
    if (effectiveComp && (updates.situacao !== undefined || updates.archived !== undefined)) {
      const targetSituacao = updates.situacao !== undefined ? updates.situacao : current?.situacao;
      const targetArchived = updates.archived !== undefined ? updates.archived : current?.archived;
      const isApproved = targetSituacao === 'APR' || (targetArchived === true && targetSituacao !== 'REP' && targetSituacao !== 'REPF');
      const isRep = targetSituacao === 'REP' || targetSituacao === 'REPF';
      const isMatr = targetSituacao === 'MATR' || targetSituacao === 'REC';

      // Atualizar disciplinas
      const matchingDiscs = discs.filter(d => d.nome.trim().toLowerCase() === effectiveComp.toLowerCase());
      for (const d of matchingDiscs) {
        if (d.id && updateDisc) {
          if (isApproved) {
            await updateDisc(d.id, { status: 'CONCLUIDA', archived: true });
          } else if (isRep) {
            await updateDisc(d.id, { status: 'PENDENTE', archived: false });
          } else if (isMatr) {
            await updateDisc(d.id, { status: 'CURSANDO', archived: false });
          }
        }
      }

      // Atualizar progresso
      const matchingProgs = progs.filter(p => p.disciplina.trim().toLowerCase() === effectiveComp.toLowerCase());
      for (const p of matchingProgs) {
        if (p.id && updateProg) {
          if (isApproved) {
            await updateProg(p.id, { status: 'Concluída', archived: true });
          } else if (isRep) {
            await updateProg(p.id, { status: 'Pendente', archived: false });
          } else if (isMatr) {
            await updateProg(p.id, { status: 'Matriculada', archived: false });
          }
        }
      }
    }
  };

  const handleAddFreqGlobal = async (f: Omit<Frequencia, 'id' | 'createdAt' | 'updatedAt'>) => {
    await addFreq(f);
    const cleanNome = f.componente.trim();
    const exists = discs.some(d => d.nome.trim().toLowerCase() === cleanNome.toLowerCase());
    if (!exists && cleanNome) {
      await addDisc({
        nome: cleanNome,
        completo: cleanNome,
        periodo: profile?.period || '2026.2',
        archived: false,
        status: 'CURSANDO',
      });
    }
  };

  const handleUpdateFreqGlobal = async (id: string, updates: Partial<Frequencia>) => {
    const current = freqs.find(f => f.id === id);
    if (current && updates.componente && updates.componente.trim().toLowerCase() !== current.componente.trim().toLowerCase()) {
      await handleRenameDisciplina(current.componente, updates.componente.trim());
    }
    await updateFreq(id, updates);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      
      {/* Sidebar Desktop - Aba lateral que abre e fecha */}
      <aside className={cn(
        "bg-[#111827] text-gray-300 hidden md:flex flex-col justify-between shrink-0 shadow-2xl relative transition-all duration-300 ease-in-out z-20",
        isSidebarOpen ? "w-52 lg:w-56" : "w-14 items-center"
      )}>
        <div className={cn("p-3 sm:p-4 w-full", !isSidebarOpen && "px-1.5 py-3")}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 mb-5 px-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h1 className="font-bold text-base tracking-tight text-white truncate">
                UFRPE
              </h1>
            </div>
          ) : (
            <div className="flex flex-col items-center mb-5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
          )}
          
          <nav className="space-y-1 w-full">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={!isSidebarOpen ? (tab.id === 'ru' ? `R.U. (${ru.saldo} fichas)` : tab.label) : undefined}
                  className={cn(
                    "w-full text-xs lg:text-sm font-semibold rounded-xl lg:rounded-2xl flex items-center transition-all cursor-pointer relative",
                    isSidebarOpen ? "px-3.5 py-2.5 gap-2.5 lg:gap-3" : "p-2.5 justify-center",
                    active 
                      ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className={cn("w-4 h-4 lg:w-5 lg:h-5 shrink-0", active ? "text-white" : "text-gray-500")} />
                  {isSidebarOpen && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="truncate">{tab.label}</span>
                      {tab.id === 'ru' && (
                        <span className={cn(
                          "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                          ru.saldo > 0 ? "bg-emerald-500 text-white" : "bg-white/10 text-gray-400"
                        )}>
                          {ru.saldo}
                        </span>
                      )}
                      {tab.id === 'trabalhos' && pendentesTrabalhos > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500 text-white">
                          {pendentesTrabalhos}
                        </span>
                      )}
                      {tab.id === 'provas' && agendadasProvas > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-purple-500 text-white">
                          {agendadasProvas}
                        </span>
                      )}
                    </div>
                  )}
                  {!isSidebarOpen && tab.id === 'ru' && ru.saldo > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                  {!isSidebarOpen && tab.id === 'trabalhos' && pendentesTrabalhos > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                  {!isSidebarOpen && tab.id === 'provas' && agendadasProvas > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {isSidebarOpen ? (
          <div className="p-4 sm:p-5 relative overflow-hidden w-full space-y-3">
            {/* Ondulações decorativas no fundo da sidebar */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
              <svg className="absolute bottom-0 left-0 w-full h-44" viewBox="0 0 240 160" preserveAspectRatio="none">
                <path d="M-20,90 C40,50 80,120 150,70 C200,30 230,90 260,60 L260,160 L-20,160 Z" fill="url(#sideWave1)" />
                <path d="M-20,110 C50,130 110,80 170,115 C210,135 240,95 260,110 L260,160 L-20,160 Z" fill="url(#sideWave2)" />
                <defs>
                  <linearGradient id="sideWave1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="sideWave2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Identificação do Usuário e Conta Privada */}
            <div className="relative z-10 p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'Avatar'} className="w-8 h-8 rounded-full border border-white/20 shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </div>
              </div>
            </div>

            {/* Botão de Backup */}
            <button 
              onClick={() => setIsBackupModalOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all relative z-10 cursor-pointer border border-white/5"
              title="Backup"
            >
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>Backup</span>
              </div>
            </button>

            <button 
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group relative z-10 cursor-pointer"
              title="Sair"
            >
              <span>Sair</span>
              <LogOut className="w-3.5 h-3.5 group-hover:text-rose-400 transition-colors" />
            </button>
          </div>
        ) : (
          <div className="p-3 w-full flex flex-col items-center gap-2">
            <button 
              onClick={() => setIsBackupModalOpen(true)}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
              title="Backup"
            >
              <Database className="w-4 h-4 text-indigo-400" />
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        )}
      </aside>

      {/* Drawer Móvel quando abre no mobile */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#111827] text-gray-300 flex flex-col justify-between h-full shadow-2xl z-10 p-5">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <h1 className="font-bold text-lg text-white">UFRPE</h1>
                </div>
                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informações da conta no mobile */}
              <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Avatar'} className="w-8 h-8 rounded-full border border-white/20 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {user.displayName || user.email?.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              <nav className="space-y-1.5">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={cn(
                        "w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-between transition-all cursor-pointer",
                        active 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("w-5 h-5 shrink-0", active ? "text-white" : "text-gray-500")} />
                        <span>{tab.label}</span>
                      </div>
                      {tab.id === 'ru' && (
                        <span className={cn(
                          "text-[10px] font-black px-2 py-0.5 rounded-full",
                          ru.saldo > 0 ? "bg-emerald-500 text-white" : "bg-white/10 text-gray-400"
                        )}>
                          {ru.saldo} fichas
                        </span>
                      )}
                      {tab.id === 'trabalhos' && pendentesTrabalhos > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500 text-white">
                          {pendentesTrabalhos} {pendentesTrabalhos === 1 ? 'pendente' : 'pendentes'}
                        </span>
                      )}
                      {tab.id === 'provas' && agendadasProvas > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500 text-white">
                          {agendadasProvas} {agendadasProvas === 1 ? 'agendada' : 'agendadas'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10">
              <button 
                onClick={() => {
                  setIsBackupModalOpen(true);
                  setIsMobileDrawerOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition"
                title="Backup"
              >
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>Backup</span>
                </span>
              </button>

              <button 
                onClick={() => signOut(auth)}
                className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition"
                title="Sair"
              >
                <span>Sair</span>
                <LogOut className="w-4 h-4 text-rose-400" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Mobile Navigation (Top Bar) */}
        <div className="md:hidden sticky top-0 z-40 bg-[#111827] text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-1.5 -ml-1 text-gray-300 hover:text-white rounded-lg"
              title="Abrir menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white">
              <GraduationCap className="w-4 h-4" />
            </div>
            <h1 className="font-bold tracking-tight">UFRPE</h1>
          </div>
          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <button onClick={() => signOut(auth)} className="p-2 text-gray-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="md:hidden bg-[#111827] overflow-x-auto hide-scrollbar border-t border-white/10">
          <nav className="flex items-center gap-2 p-2">
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5",
                    active ? "bg-indigo-500 text-white" : "text-gray-400"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.id === 'ru' && (
                    <span className={cn(
                      "text-[10px] font-black px-1.5 py-0.2 rounded-full",
                      active ? "bg-white text-indigo-700" : (ru.saldo > 0 ? "bg-emerald-500 text-white" : "bg-white/10 text-gray-400")
                    )}>
                      {ru.saldo}
                    </span>
                  )}
                  {tab.id === 'trabalhos' && pendentesTrabalhos > 0 && (
                    <span className={cn(
                      "text-[10px] font-black px-1.5 py-0.2 rounded-full",
                      active ? "bg-white text-indigo-700" : "bg-indigo-500 text-white"
                    )}>
                      {pendentesTrabalhos}
                    </span>
                  )}
                  {tab.id === 'provas' && agendadasProvas > 0 && (
                    <span className={cn(
                      "text-[10px] font-black px-1.5 py-0.2 rounded-full",
                      active ? "bg-white text-purple-700" : "bg-purple-500 text-white"
                    )}>
                      {agendadasProvas}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Top Header - Compacto e elegante com botão de alternar menu lateral */}
        <header className="px-3 sm:px-5 lg:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 bg-gray-50 z-10 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleSidebar}
              className="hidden md:flex p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-200/60 transition cursor-pointer shrink-0"
              title={isSidebarOpen ? "Recolher menu lateral" : "Expandir menu lateral"}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{greeting}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-xs shrink-0 whitespace-nowrap self-start sm:self-auto">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none">Hoje</p>
              <p className="text-xs font-bold text-gray-900 leading-tight">{formattedDate}</p>
            </div>
            <div className="w-px h-5 bg-gray-100 mx-0.5 hidden sm:block"></div>
            <div className="hidden sm:flex items-center pl-0.5">
               <PWAInstallButton />
            </div>
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-5 lg:px-6 pb-6">
          {isDataLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-4" />
              <p className="font-medium text-gray-500">Sincronizando dados...</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              {activeTab === 'home' && (
                <SummarySection 
                  notas={uniqueNotas} 
                  frequencias={uniqueFreqs} 
                  progressos={uniqueProgs} 
                  horarios={horarios}
                  disciplinas={uniqueDiscs}
                  period={profile?.period || 'Atual'} 
                  onAddFreq={handleAddFreqGlobal}
                  onUpdateFreq={handleUpdateFreqGlobal}
                  onDeleteFreq={removeFreq}
                  onAddHorario={addHorario}
                  onUpdateHorario={updateHorario}
                  onDeleteHorario={removeHorario}
                  ru={ru}
                  onNavigateToRu={() => setActiveTab('ru')}
                />
              )}

              {activeTab === 'ru' && (
                <RuSection 
                  ru={ru} 
                  onNavigateHome={() => setActiveTab('home')} 
                />
              )}
              {activeTab === 'trabalhos' && (
                <TrabalhosSection 
                  trabalhos={trabalhos}
                  disciplinas={uniqueDiscs}
                  notas={uniqueNotas}
                  onAdd={addTrabalho}
                  onUpdate={updateTrabalho}
                  onDelete={removeTrabalho}
                />
              )}
              {activeTab === 'provas' && (
                <ProvasSection 
                  provas={provas}
                  disciplinas={uniqueDiscs}
                  notas={uniqueNotas}
                  onAdd={addProva}
                  onUpdate={updateProva}
                  onDelete={removeProva}
                />
              )}
              {activeTab === 'notas' && (
                <NotasSection 
                  notas={uniqueNotas} 
                  disciplinas={uniqueDiscs} 
                  onAdd={handleAddNotaGlobal} 
                  onUpdate={handleUpdateNotaGlobal} 
                  onDelete={removeNota}
                  onRenameDisciplina={handleRenameDisciplina}
                />
              )}
              {activeTab === 'freq' && (
                <FreqSection 
                  frequencias={uniqueFreqs} 
                  disciplinas={uniqueDiscs} 
                  notas={uniqueNotas} 
                  horarios={horarios}
                  onAdd={handleAddFreqGlobal} 
                  onUpdate={handleUpdateFreqGlobal} 
                  onDelete={removeFreq}
                />
              )}
              {activeTab === 'prog' && (
                <ProgressoSection 
                  notas={uniqueNotas} 
                  disciplinas={uniqueDiscs} 
                  progressos={uniqueProgs}
                  frequencias={uniqueFreqs}
                  onAddDisciplina={handleAddDisciplina}
                  onDeleteDisciplina={handleDeleteDisciplina}
                  onMoveDisciplinaStatus={handleMoveDisciplinaStatus}
                  onUpdateDisciplina={handleUpdateDisciplina}
                  onRenameDisciplina={handleRenameDisciplina}
                />
              )}
              {activeTab === 'disc' && (
                <DisciplinasSection 
                  disciplinas={uniqueDiscs} 
                  progressos={uniqueProgs} 
                  frequencias={uniqueFreqs} 
                  notas={uniqueNotas}
                  currentPeriod={profile?.period || '2026.2'}
                  onAdd={handleAddDisciplina} 
                  onDelete={handleDeleteDisciplina}
                  onMoveStatus={handleMoveDisciplinaStatus}
                  onUpdate={handleUpdateDisciplina}
                  onRenameDisciplina={handleRenameDisciplina}
                />
              )}
            </div>
          )}
        </main>

        <OfflineIndicator />

        {/* Modal de Backup e Gerenciamento de Dados Privados */}
        <DataBackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          userId={userId}
          userEmail={user.email}
          userName={user.displayName}
          data={{
            notas,
            disciplinas: discs,
            frequencias: freqs,
            progressos: progs,
            horarios: horarios || [],
            trabalhos: trabalhos || [],
            provas: provas || [],
            ruConfig: ru.config,
            ruLogs: ru.logs,
          }}
        />
      </div>
    </div>
  );
}
