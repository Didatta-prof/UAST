import { collection, writeBatch, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Nota, Disciplina, Frequencia, Progresso, Horario, RuConfig, RuLog, Trabalho, Prova } from '../types';

export interface UserAcademicExport {
  version: number;
  exportedAt: string;
  userId: string;
  notas: Nota[];
  disciplinas: Disciplina[];
  frequencias: Frequencia[];
  progressos: Progresso[];
  horarios: Horario[];
  ruConfig?: RuConfig;
  ruLogs?: RuLog[];
  trabalhos?: Trabalho[];
  provas?: Prova[];
}

export function exportUserDataAsJSON(
  userId: string, 
  data: {
    notas: Nota[];
    disciplinas: Disciplina[];
    frequencias: Frequencia[];
    progressos: Progresso[];
    horarios: Horario[];
    ruConfig?: RuConfig;
    ruLogs?: RuLog[];
    trabalhos?: Trabalho[];
    provas?: Prova[];
  }
) {
  const exportPayload: UserAcademicExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    notas: data.notas.map(n => ({ ...n })),
    disciplinas: data.disciplinas.map(d => ({ ...d })),
    frequencias: data.frequencias.map(f => ({ ...f })),
    progressos: data.progressos.map(p => ({ ...p })),
    horarios: data.horarios.map(h => ({ ...h })),
    ruConfig: data.ruConfig ? { ...data.ruConfig } : undefined,
    ruLogs: data.ruLogs ? data.ruLogs.map(l => ({ ...l })) : undefined,
    trabalhos: data.trabalhos ? data.trabalhos.map(t => ({ ...t })) : undefined,
    provas: data.provas ? data.provas.map(p => ({ ...p })) : undefined,
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportPayload, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `meu_historico_ufrpe_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export async function importUserDataFromJSON(userId: string, jsonString: string): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const parsed = JSON.parse(jsonString);
    const now = Date.now();
    const batch = writeBatch(db);
    let count = 0;

    if (Array.isArray(parsed.disciplinas)) {
      parsed.disciplinas.forEach((d: Partial<Disciplina>) => {
        if (!d.nome) return;
        const ref = doc(collection(db, 'users', userId, 'discs'));
        batch.set(ref, {
          nome: d.nome,
          completo: d.completo || d.nome,
          periodo: d.periodo || '2026.1',
          archived: d.archived || false,
          status: d.status || 'CURSANDO',
          createdAt: d.createdAt || now,
          updatedAt: now,
        });
        count++;
      });
    }

    if (Array.isArray(parsed.notas)) {
      parsed.notas.forEach((n: Partial<Nota>) => {
        if (!n.componente) return;
        const ref = doc(collection(db, 'users', userId, 'notas'));
        batch.set(ref, {
          componente: n.componente,
          periodo: n.periodo || '2026.1',
          situacao: n.situacao || 'MATR',
          ch: n.ch || 60,
          nota1: n.nota1 ?? null,
          nota2: n.nota2 ?? null,
          nota3: n.nota3 ?? null,
          final: n.final ?? null,
          media: n.media ?? null,
          frequencia: n.frequencia ?? 100,
          archived: n.archived || false,
          createdAt: n.createdAt || now,
          updatedAt: now,
        });
        count++;
      });
    }

    if (Array.isArray(parsed.frequencias)) {
      parsed.frequencias.forEach((f: Partial<Frequencia>) => {
        if (!f.componente) return;
        const ref = doc(collection(db, 'users', userId, 'freqs'));
        batch.set(ref, {
          componente: f.componente,
          data: f.data || new Date().toISOString().slice(0, 10),
          status: f.status || 'Presente',
          quantidade: f.quantidade || 4,
          justificativa: f.justificativa || '',
          professor: f.professor || '',
          archived: f.archived || false,
          createdAt: f.createdAt || now,
          updatedAt: now,
        });
        count++;
      });
    }

    if (Array.isArray(parsed.progressos)) {
      parsed.progressos.forEach((p: Partial<Progresso>) => {
        if (!p.disciplina) return;
        const ref = doc(collection(db, 'users', userId, 'progs'));
        batch.set(ref, {
          disciplina: p.disciplina,
          tipo: p.tipo || 'Obrigatória',
          ch: p.ch || 60,
          status: p.status || 'Concluída',
          archived: p.archived || false,
          createdAt: p.createdAt || now,
          updatedAt: now,
        });
        count++;
      });
    }

    if (Array.isArray(parsed.horarios)) {
      parsed.horarios.forEach((h: Partial<Horario>) => {
        if (!h.disciplina || !h.dia) return;
        const ref = doc(collection(db, 'users', userId, 'horarios'));
        batch.set(ref, {
          dia: h.dia,
          disciplina: h.disciplina,
          sala: h.sala || '1',
          bloco: h.bloco || 'A',
          ordem: h.ordem || 1,
          createdAt: h.createdAt || now,
          updatedAt: now,
        });
        count++;
      });
    }

    if (parsed.ruConfig && typeof parsed.ruConfig === 'object') {
      const ruRef = doc(db, 'users', userId, 'ru', 'config');
      batch.set(ruRef, {
        saldo: Number(parsed.ruConfig.saldo) || 0,
        autoDeductEnabled: parsed.ruConfig.autoDeductEnabled ?? true,
        targetLat: Number(parsed.ruConfig.targetLat) || -7.955448259560658,
        targetLng: Number(parsed.ruConfig.targetLng) || -38.29594815743501,
        radiusMeters: Number(parsed.ruConfig.radiusMeters) || 700,
        lastAutoDeductTimestamp: parsed.ruConfig.lastAutoDeductTimestamp || null,
        lastAutoDeductDateStr: parsed.ruConfig.lastAutoDeductDateStr || null,
        updatedAt: now,
      }, { merge: true });
      count++;
    }

    if (Array.isArray(parsed.ruLogs)) {
      parsed.ruLogs.forEach((l: Partial<RuLog>) => {
        if (!l.tipo || l.quantidade === undefined) return;
        const ref = doc(collection(db, 'users', userId, 'ru_logs'));
        batch.set(ref, {
          tipo: l.tipo,
          quantidade: Number(l.quantidade) || 1,
          saldoResultante: Number(l.saldoResultante) || 0,
          motivo: l.motivo || 'Importado de backup',
          timestamp: l.timestamp || now,
          dataHora: l.dataHora || new Date().toLocaleString('pt-BR'),
        });
        count++;
      });
    }

    if (Array.isArray(parsed.trabalhos)) {
      parsed.trabalhos.forEach((t: Partial<Trabalho>) => {
        if (!t.titulo) return;
        const ref = doc(collection(db, 'users', userId, 'trabalhos'));
        batch.set(ref, {
          titulo: t.titulo,
          disciplina: t.disciplina || '',
          professor: t.professor || '',
          descricao: t.descricao || '',
          dataEntrega: t.dataEntrega || new Date().toISOString(),
          anotacoes: t.anotacoes || '',
          status: t.status || 'Pendente',
          archived: t.archived || false,
          createdAt: t.createdAt || now,
          updatedAt: now,
        });
        count++;
      });
    }

    if (Array.isArray(parsed.provas)) {
      parsed.provas.forEach((p: Partial<Prova>) => {
        if (!p.titulo) return;
        const ref = doc(collection(db, 'users', userId, 'provas'));
        batch.set(ref, {
          titulo: p.titulo,
          disciplina: p.disciplina || '',
          professor: p.professor || '',
          descricao: p.descricao || '',
          dataProva: p.dataProva || new Date().toISOString(),
          anotacoes: p.anotacoes || '',
          status: p.status || 'Agendada',
          archived: p.archived || false,
          createdAt: p.createdAt || now,
          updatedAt: now,
        });
        count++;
      });
    }

    await batch.commit();
    return { success: true, message: 'Dados importados com sucesso para sua conta!', count };
  } catch (err) {
    console.error('Falha ao importar dados:', err);
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Erro ao processar arquivo JSON.', 
      count: 0 
    };
  }
}

export async function clearAllUserData(userId: string): Promise<boolean> {
  const collections = ['notas', 'discs', 'freqs', 'progs', 'horarios', 'ru_logs', 'trabalhos', 'provas'];
  try {
    for (const col of collections) {
      const snap = await getDocs(collection(db, 'users', userId, col));
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }

    // Reset RU config
    const ruRef = doc(db, 'users', userId, 'ru', 'config');
    await setDoc(ruRef, {
      saldo: 0,
      autoDeductEnabled: true,
      targetLat: -7.955448259560658,
      targetLng: -38.29594815743501,
      radiusMeters: 700,
      updatedAt: Date.now(),
    });

    return true;
  } catch (e) {
    console.error('Erro ao limpar dados:', e);
    return false;
  }
}
