import type { Disciplina, Nota } from '../types';

export interface DisciplinaOption {
  nome: string;
  docente?: string;
  periodo: string;
}

export interface PeriodoGroup {
  periodo: string;
  disciplinas: DisciplinaOption[];
}

export function parsePeriodoScore(p: string): number {
  if (!p) return -1;
  const match = p.match(/(\d{4})[./\-](\d+)/);
  if (match) {
    return parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
  }
  const yearMatch = p.match(/(\d{4})/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10) * 100;
  }
  return -1;
}

export function getGroupedDisciplinasByPeriod(
  disciplinas: Disciplina[] = [],
  notas: Nota[] = []
): PeriodoGroup[] {
  const map = new Map<string, DisciplinaOption>();

  // 1. Processar notas primeiro (guardam períodos históricos com precisão, ex: 2025.1, 2025.2, 2026.1)
  notas.forEach(n => {
    if (n.componente && n.componente.trim()) {
      const nome = n.componente.trim();
      const key = nome.toLowerCase();
      const periodo = (n.periodo && n.periodo.trim()) || '2026.2';
      const docente = n.docente?.trim() || '';
      map.set(key, { nome, docente, periodo });
    }
  });

  // 2. Processar disciplinas
  disciplinas.forEach(d => {
    if (d.nome && d.nome.trim()) {
      const nome = d.nome.trim();
      const key = nome.toLowerCase();
      const existing = map.get(key);
      const periodo = (d.periodo && d.periodo.trim()) || existing?.periodo || (d.status === 'CURSANDO' ? '2026.2' : (d.status === 'PENDENTE' ? 'Pendente' : 'Outros'));
      const docente = d.docente?.trim() || existing?.docente || '';
      map.set(key, {
        nome: d.nome.trim(),
        docente,
        periodo,
      });
    }
  });

  const allItems = Array.from(map.values());

  // Agrupar por período
  const periodMap = new Map<string, DisciplinaOption[]>();
  allItems.forEach(item => {
    const p = item.periodo || 'Outros';
    if (!periodMap.has(p)) {
      periodMap.set(p, []);
    }
    periodMap.get(p)!.push(item);
  });

  // Ordenar disciplinas alfabeticamente dentro de cada período
  periodMap.forEach(list => {
    list.sort((a, b) => a.nome.localeCompare(b.nome));
  });

  // Ordenar períodos do mais recente ao mais antigo (ex: 2026.2 -> 2026.1 -> 2025.2 -> 2025.1 -> Pendente)
  const sortedPeriodos = Array.from(periodMap.keys()).sort((a, b) => {
    const scoreA = parsePeriodoScore(a);
    const scoreB = parsePeriodoScore(b);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return a.localeCompare(b);
  });

  return sortedPeriodos.map(p => ({
    periodo: p,
    disciplinas: periodMap.get(p) || [],
  }));
}
