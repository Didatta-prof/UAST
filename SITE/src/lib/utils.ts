import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fd(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) {
    const [y, m, day] = parts;
    return `${day}/${m}/${y}`;
  }
  return d;
}

export function badgeClass(s: string | null | undefined): string {
  if (!s) return 'bg-gray-100 text-gray-600 border border-gray-200/60 shadow-sm';
  const x = String(s).toLowerCase();
  if (x.includes('presente') || x.includes('apr') || x.includes('conclu')) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm';
  }
  if (x.includes('ausente') || x.includes('rep')) {
    return 'bg-rose-50 text-rose-700 border border-rose-200/60 shadow-sm';
  }
  if (x.includes('feriado')) {
    return 'bg-sky-50 text-sky-700 border border-sky-200/60 shadow-sm';
  }
  if (x.includes('não reg') || x.includes('nao reg') || x.includes('justific')) {
    return 'bg-slate-50 text-slate-700 border border-slate-200/60 shadow-sm';
  }
  if (x.includes('pendente') || x.includes('matr')) {
    return 'bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm';
  }
  return 'bg-gray-100 text-gray-600 border border-gray-200/60 shadow-sm';
}

export interface CalculoNotasResultado {
  duasMaiores: number[];
  somaDuasMaiores: number | null;
  media: number | null;
  situacaoSugerida: 'APR' | 'REP' | 'MATR';
  motivo: string;
}

export function calcularNotas(
  n1?: number | null,
  n2?: number | null,
  n3?: number | null,
  final?: number | null
): CalculoNotasResultado {
  const notasValidas = [n1, n2, n3].filter((v): v is number => typeof v === 'number' && !isNaN(v));

  if (notasValidas.length === 0) {
    return {
      duasMaiores: [],
      somaDuasMaiores: null,
      media: null,
      situacaoSugerida: 'MATR',
      motivo: 'Aguardando notas parciais'
    };
  }

  // Se houver 3 notas, considera as duas maiores
  const ordenadas = [...notasValidas].sort((a, b) => b - a);
  const duasMaiores = ordenadas.slice(0, 2);
  
  if (duasMaiores.length === 1) {
    return {
      duasMaiores,
      somaDuasMaiores: duasMaiores[0],
      media: duasMaiores[0],
      situacaoSugerida: 'MATR',
      motivo: '1ª nota lançada (aguardando demais avaliações)'
    };
  }

  const somaDuasMaiores = Number((duasMaiores[0] + duasMaiores[1]).toFixed(2));
  // O usuário solicitou: "eu preciso que faça a soma e coloque na media, nao que tenha uma seção soma"
  const media = somaDuasMaiores;

  // Regra do usuário: "se a soma de 2 notas for maior que sete considere como aprovado, se houver 3 notas considerar as duas maiores"
  if (somaDuasMaiores > 7.0) {
    return {
      duasMaiores,
      somaDuasMaiores,
      media,
      situacaoSugerida: 'APR',
      motivo: `Aprovado! Soma das 2 maiores notas (${somaDuasMaiores.toFixed(1)}) > 7.0`
    };
  }

  // Se a soma não for maior que 7, avalia a prova final
  const temFinal = typeof final === 'number' && !isNaN(final);
  if (temFinal) {
    const mediaFinal = Number(((somaDuasMaiores + final) / 2).toFixed(2));
    if (mediaFinal >= 5.0 || final >= 5.0) {
      return {
        duasMaiores,
        somaDuasMaiores,
        media: mediaFinal,
        situacaoSugerida: 'APR',
        motivo: `Aprovado na Prova Final! (Final: ${final.toFixed(1)}, Média Final: ${mediaFinal.toFixed(1)})`
      };
    } else {
      return {
        duasMaiores,
        somaDuasMaiores,
        media: mediaFinal,
        situacaoSugerida: 'REP',
        motivo: `Reprovado após Final. Média final: ${mediaFinal.toFixed(1)} < 5.0`
      };
    }
  }

  return {
    duasMaiores,
    somaDuasMaiores,
    media,
    situacaoSugerida: 'MATR',
    motivo: `Soma das 2 maiores (${somaDuasMaiores.toFixed(1)}) ≤ 7.0. Necessita Prova Final`
  };
}
