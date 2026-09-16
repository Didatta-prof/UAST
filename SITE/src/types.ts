export interface UserProfile {
  id?: string;
  name?: string;
  university?: string;
  course?: string;
  period?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Nota {
  id?: string;
  periodo?: string;
  componente: string;
  nota1?: number | null;
  nota2?: number | null;
  nota3?: number | null;
  final?: number | null;
  media?: number;
  frequencia?: number;
  situacao: string;
  ch?: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Frequencia {
  id?: string;
  componente: string;
  status: string;
  data: string;
  quantidade?: number;
  justificativa?: string;
  professor?: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Progresso {
  id?: string;
  disciplina: string;
  tipo: string;
  ch: number;
  status: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Disciplina {
  id?: string;
  nome: string;
  completo: string;
  professor?: string;
  periodo?: string;
  ch?: number;
  archived?: boolean;
  status?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Horario {
  id?: string;
  dia: string;
  disciplina: string;
  sala: string;
  bloco: string;
  ordem: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface RuConfig {
  id?: string;
  saldo: number;
  autoDeductEnabled: boolean;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
  lastAutoDeductTimestamp?: number;
  lastAutoDeductDateStr?: string;
  updatedAt: number;
}

export interface RuLog {
  id?: string;
  tipo: 'ADD' | 'REMOVE' | 'AUTO_DEDUCT';
  quantidade: number;
  saldoResultante: number;
  motivo?: string;
  timestamp: number;
  dataHora: string;
}

export interface Trabalho {
  id?: string;
  titulo: string;
  disciplina: string;
  professor?: string;
  descricao?: string;
  dataEntrega: string;
  anotacoes?: string;
  status: 'Pendente' | 'Concluído';
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Prova {
  id?: string;
  titulo: string;
  disciplina: string;
  professor?: string;
  descricao?: string;
  dataProva: string;
  anotacoes?: string;
  status: 'Agendada' | 'Realizada';
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}
