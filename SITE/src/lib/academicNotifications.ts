// Academic notifications and deadline calculation helper

export interface DueStatus {
  daysRemaining: number;
  hoursRemaining: number;
  isOverdue: boolean;
  isToday: boolean;
  isWithin2Days: boolean;
  isWithin7Days: boolean;
  badgeText: string;
  badgeClass: string;
  formattedDate: string;
}

export function calculateDueStatus(dateTimeStr: string, isCompleted: boolean = false): DueStatus {
  if (!dateTimeStr) {
    return {
      daysRemaining: 999,
      hoursRemaining: 999,
      isOverdue: false,
      isToday: false,
      isWithin2Days: false,
      isWithin7Days: false,
      badgeText: 'Sem data',
      badgeClass: 'bg-gray-100 text-gray-600',
      formattedDate: '-',
    };
  }

  const target = new Date(dateTimeStr);
  const now = new Date();

  // Formatted date string
  const formattedDate = target.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isCompleted) {
    return {
      daysRemaining: 0,
      hoursRemaining: 0,
      isOverdue: false,
      isToday: false,
      isWithin2Days: false,
      isWithin7Days: false,
      badgeText: 'Concluído',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      formattedDate,
    };
  }

  // Calculate day difference by midnight boundaries
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffTime = targetMidnight - todayMidnight;
  const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const diffHours = (target.getTime() - now.getTime()) / (1000 * 60 * 60);

  const isOverdue = target.getTime() < now.getTime() && daysRemaining < 0;
  const isToday = daysRemaining === 0;
  const isTomorrow = daysRemaining === 1;
  const isWithin2Days = daysRemaining > 0 && daysRemaining <= 2;
  const isWithin7Days = daysRemaining > 2 && daysRemaining <= 7;

  let badgeText = '';
  let badgeClass = '';

  if (isOverdue) {
    badgeText = 'Atrasado';
    badgeClass = 'bg-rose-100 text-rose-800 border-rose-200 font-bold';
  } else if (isToday) {
    badgeText = '🔔 É Hoje!';
    badgeClass = 'bg-rose-500 text-white border-rose-600 font-black animate-pulse';
  } else if (isTomorrow) {
    badgeText = '⚠️ Amanhã!';
    badgeClass = 'bg-amber-500 text-white border-amber-600 font-bold';
  } else if (isWithin2Days) {
    badgeText = `⚠️ Faltam ${daysRemaining} dias`;
    badgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
  } else if (isWithin7Days) {
    badgeText = `🗓️ Faltam ${daysRemaining} dias`;
    badgeClass = 'bg-blue-100 text-blue-900 border-blue-200 font-semibold';
  } else {
    badgeText = `Em ${daysRemaining} dias`;
    badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';
  }

  return {
    daysRemaining,
    hoursRemaining: Math.round(diffHours),
    isOverdue,
    isToday,
    isWithin2Days,
    isWithin7Days,
    badgeText,
    badgeClass,
    formattedDate,
  };
}

/**
 * Envia notificação no navegador de forma compatível com Android, PWA e Desktop
 */
export async function sendBrowserNotification(
  title: string, 
  options: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    vibrate?: number[];
  } = {}
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Tentar via Service Worker Registration (obrigatório para Android/Chrome Mobile/PWA)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
        return true;
      }
    } catch (swErr) {
      console.warn('Tentativa via serviceWorker falhou, tentando fallback para Notification:', swErr);
    }
  }

  // 2. Fallback para new Notification (Desktop e navegadores convencionais)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/favicon.ico',
        ...options,
      });
      return true;
    } catch (notifErr) {
      console.warn('Falha ao disparar new Notification:', notifErr);
    }
  }

  return false;
}

export interface PermissionFeedback {
  permission: NotificationPermission | 'unsupported';
  success: boolean;
  message: string;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (err) {
    console.error('Erro ao pedir permissão de notificação:', err);
    return 'denied';
  }
}

/**
 * Solicita permissão e fornece diagnóstico completo com notificação de teste imediata
 */
export async function requestNotificationPermissionWithFeedback(): Promise<PermissionFeedback> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      permission: 'unsupported',
      success: false,
      message: 'Seu navegador não suporta a API de notificações do sistema. Os alertas continuarão sendo destacados diretamente na interface do app.',
    };
  }

  // Se o contexto não for seguro (ex: HTTP na rede local do celular)
  if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return {
      permission: 'unsupported',
      success: false,
      message: 'Notificações do sistema exigem conexão segura (HTTPS ou localhost). Como você está acessando por IP local HTTP, os alertas de prazos serão sinalizados diretamente na tela.',
    };
  }

  try {
    const perm = await Notification.requestPermission();

    if (perm === 'granted') {
      // Disparar notificação de confirmação imediatamente para o usuário ver que funcionou!
      await sendBrowserNotification('🔔 Alertas UFRPE Ativados!', {
        body: 'Notificações ativas com sucesso! Você será avisado sobre prazos de provas e trabalhos.',
        tag: 'ufrpe_welcome_notif',
      });

      return {
        permission: 'granted',
        success: true,
        message: 'Alertas ativados com sucesso! Uma notificação de teste foi enviada ao seu dispositivo.',
      };
    } else if (perm === 'denied') {
      return {
        permission: 'denied',
        success: false,
        message: 'As notificações foram bloqueadas nas permissões do seu navegador. Para ativá-las: clique no ícone de cadeado/configurações ao lado do endereço do site e permita as notificações.',
      };
    } else {
      return {
        permission: 'default',
        success: false,
        message: 'A permissão de notificações não foi concluída. Tente clicar novamente e selecione "Permitir" quando a janela do navegador solicitar.',
      };
    }
  } catch (err) {
    console.error('Erro ao solicitar permissão de notificações:', err);
    return {
      permission: 'denied',
      success: false,
      message: 'Ocorreu um erro ao solicitar permissão de notificações. Verifique as permissões de site do navegador.',
    };
  }
}

export async function checkAndNotifyAcademicReminders(items: {
  id?: string;
  titulo: string;
  data: string;
  disciplina: string;
  tipo: 'Trabalho' | 'Prova';
  status?: string;
}[]) {
  if (typeof window === 'undefined') return;

  const hasPermission = 'Notification' in window && Notification.permission === 'granted';
  const todayDateKey = new Date().toISOString().slice(0, 10);

  for (const item of items) {
    // Ignorar itens já concluídos
    if (item.status === 'Concluído' || item.status === 'Realizada') continue;
    if (!item.data) continue;

    const due = calculateDueStatus(item.data);
    let reminderMilestone: string | null = null;

    if (due.isToday) {
      reminderMilestone = 'HOJE';
    } else if (due.isWithin2Days) {
      reminderMilestone = '2DIAS';
    } else if (due.isWithin7Days) {
      reminderMilestone = '7DIAS';
    }

    if (!reminderMilestone || !item.id) continue;

    const storageKey = `ufrpe_notif_${item.tipo.toLowerCase()}_${item.id}_${reminderMilestone}_${todayDateKey}`;
    const alreadyNotified = localStorage.getItem(storageKey);

    if (!alreadyNotified) {
      let body = '';
      if (reminderMilestone === 'HOJE') {
        body = `Atenção: O ${item.tipo.toLowerCase()} "${item.titulo}" de ${item.disciplina} é HOJE às ${due.formattedDate.split(' ')[1] || ''}!`;
      } else if (reminderMilestone === '2DIAS') {
        body = `Lembrete: Faltam apenas ${due.daysRemaining} dias para o ${item.tipo.toLowerCase()} "${item.titulo}" (${item.disciplina})!`;
      } else {
        body = `Fique atento: Faltam ${due.daysRemaining} dias para o ${item.tipo.toLowerCase()} "${item.titulo}" (${item.disciplina}).`;
      }

      if (hasPermission) {
        await sendBrowserNotification(`UFRPE • ${item.tipo}: ${item.titulo}`, {
          body,
          tag: `ufrpe_${item.id}_${reminderMilestone}`,
        });
      }

      // Disparar evento para avisos na interface do app
      window.dispatchEvent(new CustomEvent('ufrpe-reminder-alert', {
        detail: {
          tipo: item.tipo,
          titulo: item.titulo,
          disciplina: item.disciplina,
          body,
          milestone: reminderMilestone,
        }
      }));

      localStorage.setItem(storageKey, 'true');
    }
  }
}
