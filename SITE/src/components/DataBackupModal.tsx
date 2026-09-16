import React, { useState, useRef } from 'react';
import { Modal } from './ui';
import { 
  Download, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Database, 
  FileJson,
  User,
  Loader2
} from 'lucide-react';
import type { Nota, Disciplina, Frequencia, Progresso, Horario, RuConfig, RuLog } from '../types';
import { exportUserDataAsJSON, importUserDataFromJSON, clearAllUserData } from '../lib/dataManagement';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  data: {
    notas: Nota[];
    disciplinas: Disciplina[];
    frequencias: Frequencia[];
    progressos: Progresso[];
    horarios: Horario[];
    ruConfig?: RuConfig | null;
    ruLogs?: RuLog[];
  };
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  userId,
  userEmail,
  userName,
  data,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalRecords = data.disciplinas.length + data.notas.length + data.frequencias.length + data.progressos.length + data.horarios.length + (data.ruLogs?.length || 0);

  const handleExport = () => {
    try {
      exportUserDataAsJSON(userId, data);
      setFeedback({
        type: 'success',
        message: 'Arquivo JSON com seus dados baixado com sucesso!'
      });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: 'Erro ao gerar arquivo de exportação.'
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      const text = await file.text();
      const res = await importUserDataFromJSON(userId, text);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `${res.message} (${res.count} registros adicionados/atualizados).`
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Falha ao ler arquivo. Verifique se é um arquivo JSON válido.'
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    setIsProcessing(true);
    try {
      const ok = await clearAllUserData(userId);
      if (ok) {
        setFeedback({
          type: 'success',
          message: 'Todos os seus dados foram apagados da sua conta com sucesso.'
        });
        setShowClearConfirm(false);
      } else {
        setFeedback({
          type: 'error',
          message: 'Erro ao apagar dados do banco.'
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciamento de Dados & Backup">
      <div className="space-y-6 pt-2">
        {/* Status da Conta */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-gray-900 text-sm">Backup em Nuvem • {userEmail || 'Sua conta'}</h4>
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-white text-indigo-700 font-bold rounded-lg border border-indigo-100 shadow-2xs">
                {data.disciplinas.length} Disciplinas
              </span>
              <span className="px-2.5 py-1 bg-white text-indigo-700 font-bold rounded-lg border border-indigo-100 shadow-2xs">
                {data.notas.length} Notas
              </span>
              <span className="px-2.5 py-1 bg-white text-indigo-700 font-bold rounded-lg border border-indigo-100 shadow-2xs">
                {data.frequencias.length} Aulas
              </span>
              <span className="px-2.5 py-1 bg-white text-indigo-700 font-bold rounded-lg border border-indigo-100 shadow-2xs">
                {data.horarios.length} Horários
              </span>
            </div>
          </div>
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Ações de Exportação e Importação */}
        <div className="space-y-3">
          <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-indigo-600" />
                <h5 className="font-bold text-gray-900 text-sm">Exportar Backup JSON</h5>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={totalRecords === 0}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Backup</span>
            </button>
          </div>

          <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-600" />
                <h5 className="font-bold text-gray-900 text-sm">Importar Backup JSON</h5>
              </div>
            </div>
            <label className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm cursor-pointer shrink-0">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Selecionar Arquivo JSON</span>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".json,application/json" 
                onChange={handleFileSelect}
                disabled={isProcessing}
                className="hidden" 
              />
            </label>
          </div>
        </div>

        {/* Zona de Perigo / Limpeza */}
        <div className="pt-2 border-t border-gray-100">
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs font-semibold text-rose-500 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer py-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Deseja apagar todos os dados da sua conta para recomeçar?</span>
            </button>
          ) : (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h6 className="font-bold text-rose-900">Tem certeza absoluta?</h6>
                  <p className="text-rose-700 mt-0.5">
                    Esta ação excluirá permanentemente todas as suas disciplinas, notas e frequências registradas nesta conta.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 bg-white text-gray-700 font-semibold text-xs rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearData}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Sim, apagar tudo</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
