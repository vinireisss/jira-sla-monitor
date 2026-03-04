const { ipcRenderer, webFrame } = require('electron');

// 🎛️ CONTROLE DE DEBUG: Altere para true para ver logs detalhados
const DEBUG_MODE = false;

// 🌍 Helper de tradução - shortcut para getTranslation()
const t = (key, fallback = null) => {
  try {
    if (typeof getTranslation === 'function' && typeof getCurrentLanguage === 'function') {
      const lang = getCurrentLanguage() || 'pt-BR';
      const translation = getTranslation(key, lang);
      // Se a tradução retorna a própria chave, use o fallback
      return (translation === key && fallback) ? fallback : translation;
    }
  } catch (e) {
    console.warn('Translation error:', key, e);
  }
  return fallback || key;
};

// 🛡️ Função auxiliar para logs condicionais
const debugLog = (...args) => {
  if (DEBUG_MODE) {
    console.log(...args);
  }
};

// Estado Global
let currentConfig = {};
let currentStats = null;
let currentUser = null; // Dados do usuário atual (displayName, emailAddress, accountId)
let slaStatusCache = new Map(); // Cache do status de SLA de cada ticket
let searchTickets = [];
let updateInterval = null;
let isProMode = false;
let isHorizontalLayout = false;
let layoutMode = 'normal'; // normal, horizontal, super-compact

// 🚀 OTIMIZAÇÃO: Limpar cache de SLA periodicamente (a cada 10 minutos)
setInterval(() => {
  if (!currentStats) return;
  
  // Pegar todas as keys de tickets atuais
  const currentTicketKeys = new Set();
  ['allTickets', 'supportTickets', 'customerTickets', 'pendingTickets'].forEach(listName => {
    const tickets = currentStats[listName] || [];
    tickets.forEach(t => currentTicketKeys.add(t.key));
  });
  
  // Remover do cache tickets que não estão mais nas listas
  for (const key of slaStatusCache.keys()) {
    if (!currentTicketKeys.has(key)) {
      slaStatusCache.delete(key);
    }
  }
  
  debugLog(`🧹 Cache de SLA limpo: ${slaStatusCache.size} tickets mantidos`);
}, 600000); // 10 minutos
let connectionStatus = 'offline'; // online, offline, loading
let progressInterval = null;
let lastUpdateTime = null;
let densityMode = 'default'; // default, compact, comfortable
let isMicroMode = false; // Modo micro (visualização ultra compacta)
let isSecondaryWindow = false; // Se esta é uma janela secundária de monitoramento
let previousTicketKeys = new Set(); // Para detectar novos tickets
let previousTicketStates = new Map(); // Para detectar mudanças de status { key: { status, assignee } }

// 🚀 FUNÇÃO HELPER: Carregar SLAs em batch com timeout e fallback
async function loadSlaForTicketsBatch(ticketKeys, timeoutMs = 12000) {
  if (!ticketKeys || ticketKeys.length === 0) return;
  
  const uniqueKeys = [...new Set(ticketKeys)];
  debugLog(`🔄 [SLA] Carregando SLAs em batch para ${uniqueKeys.length} tickets...`);
  
  // Pequeno delay para garantir que os containers foram renderizados
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Criar promise com timeout
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('SLA batch timeout')), timeoutMs)
  );
  
  try {
    // Tentar carregar em batch
    const result = await Promise.race([
      ipcRenderer.invoke('get-ticket-sla-batch', uniqueKeys),
      timeoutPromise
    ]);
    
    if (result && result.success && result.data) {
      // Atualizar cada ticket
      for (const key of uniqueKeys) {
        const slaContainer = document.getElementById(`sla-${key}`);
        if (slaContainer) {
          const slaData = result.data[key];
          if (slaData) {
            updateTicketSlaDisplay(key, slaData);
          } else {
            // Sem SLA disponível - limpar completamente
            slaContainer.innerHTML = '';
            slaContainer.style.display = 'none';
          }
        }
      }
      debugLog(`✅ [SLA] Batch carregado: ${Object.keys(result.data).length} SLAs`);
    } else {
      // Sem resultado - limpar todos
      clearSlaContainers(uniqueKeys);
    }
  } catch (err) {
    console.warn(`⚠️ [SLA] Batch falhou:`, err.message);
    // Em caso de erro, limpar todos os containers para não ficar "Carregando..."
    clearSlaContainers(uniqueKeys);
  }
}

// Limpar containers de SLA (quando falha ou sem dados)
function clearSlaContainers(ticketKeys) {
  for (const key of ticketKeys) {
    const slaContainer = document.getElementById(`sla-${key}`);
    if (slaContainer) {
      slaContainer.innerHTML = '';
      slaContainer.style.display = 'none';
    }
  }
}

// Limpar TODOS os containers de SLA que ainda mostram "Carregando"
function clearAllLoadingSlaContainers() {
  document.querySelectorAll('.sla-loading').forEach(el => {
    const parent = el.closest('.ticket-sla-info');
    if (parent) {
      parent.innerHTML = '';
      parent.style.display = 'none';
    }
  });
}

// Executar limpeza periódica de containers travados (a cada 30 segundos)
setInterval(() => {
  clearAllLoadingSlaContainers();
}, 30000);
let viewedTickets = new Set(); // Tickets que o usuário já visualizou
let windowOpacity = 1.0; // Opacidade da janela (0.2 - 1.0)
let internalNotifications = []; // Notificações internas (sino)
let isFocusMode = false; // Modo focus ativo
let isUpdatingUI = false; // Flag para prevenir múltiplas atualizações simultâneas
let pendingUpdate = null; // Guardar update pendente se houver
let dailyActivity = {
  received: 0,      // Tickets recebidos hoje
  resolved: 0,      // Tickets resolvidos/fechados hoje
  commented: 0,     // Comentários adicionados hoje
  statusChanged: 0, // Status alterados hoje
  lastReset: new Date().toDateString(), // Data do último reset
  receivedTickets: [],  // Lista de tickets recebidos
  resolvedTickets: [],  // Lista de tickets fechados
  commentedTickets: []  // Lista de tickets com comentários
}; // Atividade do dia
let dailyActivityWidgetClosed = false; // Flag para rastrear se o usuário fechou manualmente
let dailyActivityLastValues = { received: 0, resolved: 0, commented: 0 }; // Valores quando foi fechado
let lastMentionsCheck = {}; // Rastrear últimas menções verificadas
let currentLanguage = 'pt-BR'; // Idioma atual

// ========================================
// 🌍 FUNÇÕES DE INTERNACIONALIZAÇÃO
// ========================================

/**
 * Aplica as traduções em toda a interface
 */
function applyLanguage(lang = 'pt-BR') {
  debugLog(`🌍 Aplicando idioma: ${lang}`);
  
  currentLanguage = lang;
  
  // Atualizar atributo lang do HTML
  document.documentElement.lang = lang;
  
  // Traduzir todos os elementos com data-i18n
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = getTranslation(key, lang);
    
    // Verificar se deve traduzir o placeholder
    if (element.hasAttribute('data-i18n-placeholder')) {
      element.placeholder = translation;
    }
    // Verificar se deve traduzir o title
    else if (element.hasAttribute('data-i18n-title')) {
      element.title = translation;
    }
    // Caso padrão: traduzir o textContent
    else {
      element.textContent = translation;
    }
  });
  
  // Traduzir elementos específicos do HTML sem data-i18n
  translateStaticElements(lang);
  
  // Salvar preferência de idioma
  localStorage.setItem('language', lang);
  
  debugLog(`✅ Idioma ${lang} aplicado com sucesso`);
}

/**
 * Traduz elementos estáticos do HTML que não têm data-i18n
 */
function translateStaticElements(lang) {
  const tr = (key) => getTranslation(key, lang);
  
  // Títulos de cards de estatísticas
  const cardTitles = {
    'card-total': tr('card.totalTicketsIT'),
    'card-support': tr('card.waitingSupport'),
    'card-customer': tr('card.waitingCustomer'),
    'card-pending': tr('card.ticketsPending'),
    'card-inprogress': tr('card.ticketsInProgress'),
    'card-simcard': tr('card.ticketsPendingSimcard'),
    'card-l0bot': tr('card.ticketsL0JiraBot'),
    'card-l1open': tr('card.allL1Open')
  };
  
  Object.entries(cardTitles).forEach(([id, text]) => {
    const card = document.getElementById(id);
    if (card) {
      const title = card.querySelector('h3');
      if (title) title.textContent = text;
    }
  });
  
  // Mini Stats Dashboard
  const miniStatLabels = document.querySelectorAll('.mini-stat-label');
  const miniStatTexts = [tr('ministat.resolutionRate'), tr('ministat.avgTime'), tr('ministat.today')];
  miniStatLabels.forEach((label, i) => {
    if (miniStatTexts[i]) label.textContent = miniStatTexts[i];
  });
  
  // Notificações Preview
  const notifHeader = document.querySelector('.notifications-preview-header h3');
  if (notifHeader) notifHeader.textContent = tr('notifications.title');
  
  const viewAllBtn = document.getElementById('view-all-notifications');
  if (viewAllBtn) viewAllBtn.textContent = tr('notifications.viewAll');
  
  const clearBtn = document.getElementById('clear-notifications');
  if (clearBtn) clearBtn.textContent = tr('notifications.clear');
  
  // Documentação
  const docsHeader = document.querySelector('.docs-dropdown-header h3');
  if (docsHeader) docsHeader.textContent = tr('docs.title');
  
  // Timer labels
  const timerManual = document.querySelector('#timer-mode-manual span');
  if (timerManual) timerManual.textContent = tr('timer.manual');
  
  const timerPomodoro = document.querySelector('#timer-mode-pomodoro span');
  if (timerPomodoro) timerPomodoro.textContent = tr('timer.pomodoro');
  
  const timerStart = document.querySelector('#timer-start-btn span');
  if (timerStart) timerStart.textContent = tr('timer.start');
  
  const timerPause = document.querySelector('#timer-pause-btn span');
  if (timerPause) timerPause.textContent = tr('timer.pause');
  
  const timerStop = document.querySelector('#timer-stop-btn span');
  if (timerStop) timerStop.textContent = tr('timer.stop');
  
  // User Monitor
  const userMonitorHeader = document.querySelector('.user-monitor-dropdown-header h3');
  if (userMonitorHeader) userMonitorHeader.textContent = tr('userMonitor.title');
  
  const addUserBtn = document.querySelector('#add-user-btn span');
  if (addUserBtn) addUserBtn.textContent = tr('userMonitor.addAnother');
  
  const userMonitorLabel = document.getElementById('user-monitor-label');
  if (userMonitorLabel && userMonitorLabel.textContent === 'Você') {
    userMonitorLabel.textContent = tr('userMonitor.you');
  }
  
  // Templates Modal
  const templatesHeader = document.querySelector('.templates-header h3');
  if (templatesHeader) templatesHeader.textContent = tr('templates.title');
  
  const addTemplateBtn = document.querySelector('#add-template-btn span');
  if (addTemplateBtn) addTemplateBtn.textContent = tr('templates.create');
  
  // Theme Customizer
  const themeHeader = document.querySelector('.theme-customizer-header h3');
  if (themeHeader) themeHeader.textContent = tr('theme.title');
  
  // Export Modal
  const exportHeader = document.querySelector('.export-header h3');
  if (exportHeader) exportHeader.textContent = tr('export.title');
  
  // Config Panel
  const configHeader = document.querySelector('.config-header h2');
  if (configHeader) configHeader.textContent = tr('settings.title');
  
  // Floating Window Section
  const floatTitle = document.querySelector('.config-section-title span');
  if (floatTitle && floatTitle.textContent.includes('Janela Flutuante')) {
    floatTitle.textContent = tr('floatingWindow.title');
  }
  
  // Shortcuts Modal
  const shortcutsHeader = document.querySelector('.shortcuts-modal-header h2');
  if (shortcutsHeader) shortcutsHeader.textContent = tr('shortcuts.title');
  
  // Add User Modal
  const addUserModalHeader = document.querySelector('.add-user-modal-header h2');
  if (addUserModalHeader) addUserModalHeader.textContent = tr('addUser.title');
  
  const addUserDesc = document.querySelector('.add-user-description');
  if (addUserDesc) addUserDesc.textContent = tr('addUser.enterEmail');
  
  // Ticket Preview
  const previewLoading = document.querySelector('#ticket-preview-loading p');
  if (previewLoading) previewLoading.textContent = tr('preview.loading');
  
  const previewError = document.querySelector('#ticket-preview-error p');
  if (previewError) previewError.textContent = tr('preview.error');
  
  // Buttons
  const cancelAddUser = document.getElementById('cancel-add-user-btn');
  if (cancelAddUser) cancelAddUser.textContent = tr('btn.cancel');
  
  const confirmAddUser = document.getElementById('confirm-add-user-btn');
  if (confirmAddUser) confirmAddUser.textContent = tr('btn.add');
  
  const retryPreview = document.getElementById('retry-ticket-preview');
  if (retryPreview) retryPreview.textContent = tr('btn.retry');
  
  // Daily Activity
  const dailyLabels = document.querySelectorAll('.daily-stat-label');
  const dailyTexts = [tr('daily.new'), tr('daily.closed'), tr('daily.updated')];
  dailyLabels.forEach((label, i) => {
    if (dailyTexts[i]) label.textContent = dailyTexts[i];
  });
  
  // Tooltips/Titles
  const tooltipMappings = {
    'menu-pro': tr('tooltip.activateAdvanced'),
    'menu-refresh': tr('tooltip.refreshManual'),
    'menu-settings': tr('tooltip.openSettings'),
    'menu-okta': tr('tooltip.openOkta'),
    'menu-jamf': tr('tooltip.openJamf'),
    'menu-jira-portal': tr('tooltip.openJiraPortal'),
    'menu-google-admin': tr('tooltip.openGoogleAdmin'),
    'menu-search': tr('tooltip.quickSearch'),
    'menu-shortcuts': tr('tooltip.viewShortcuts'),
    'menu-templates': tr('tooltip.templates'),
    'menu-timer': tr('tooltip.openTimer'),
    'menu-themes': tr('tooltip.customizeTheme'),
    'menu-toggle-layout': tr('tooltip.toggleLayout'),
    'menu-export': tr('tooltip.exportReport'),
    'connection-status': tr('tooltip.connectionStatus'),
    'zoom-out-btn': tr('tooltip.zoomOut'),
    'zoom-in-btn': tr('tooltip.zoomIn'),
    'toggle-density-btn': tr('tooltip.densityMode'),
    'user-monitor-btn': tr('tooltip.monitoredUser')
  };
  
  Object.entries(tooltipMappings).forEach(([id, title]) => {
    const el = document.getElementById(id);
    if (el) el.title = title;
  });
  
  // Expand buttons
  document.querySelectorAll('.expand-btn, .expand-btn-inline').forEach(btn => {
    btn.title = tr('general.expand');
  });
  
  // Config Panel - Placeholders
  const jiraUrlInput = document.getElementById('jira-url');
  if (jiraUrlInput) jiraUrlInput.placeholder = tr('settings.placeholderUrl');
  
  const jiraEmailInput = document.getElementById('jira-email');
  if (jiraEmailInput) jiraEmailInput.placeholder = tr('settings.placeholderEmail');
  
  const jiraTokenInput = document.getElementById('jira-api-token');
  if (jiraTokenInput) jiraTokenInput.placeholder = tr('settings.placeholderToken');
  
  // Config Panel - Labels sem data-i18n
  const queueIdLabel = document.querySelector('label[for="queue-id"]');
  if (queueIdLabel) queueIdLabel.textContent = tr('settings.queueId');
  
  const refreshIntervalLabel = document.querySelector('label[for="refresh-interval"]');
  if (refreshIntervalLabel) refreshIntervalLabel.textContent = tr('settings.refreshInterval');
  
  const oldTicketsDaysLabel = document.querySelector('label[for="old-tickets-days"]');
  if (oldTicketsDaysLabel) oldTicketsDaysLabel.textContent = tr('settings.oldTicketsDays');
  
  // Config Panel - Checkboxes
  const alertSlaSpan = document.querySelector('#alert-sla')?.parentElement?.querySelector('span');
  if (alertSlaSpan) alertSlaSpan.textContent = tr('settings.alertSla');
  
  const alertOldSpan = document.querySelector('#alert-old-tickets')?.parentElement?.querySelector('span');
  if (alertOldSpan) alertOldSpan.textContent = tr('settings.alertOld');
  
  const desktopNotifSpan = document.querySelector('#desktop-notifications')?.parentElement?.querySelector('span');
  if (desktopNotifSpan) desktopNotifSpan.textContent = tr('settings.desktopNotifications');
  
  const testNotifBtn = document.getElementById('test-notification-btn');
  if (testNotifBtn) testNotifBtn.textContent = tr('settings.test');
  
  const notifyNewSpan = document.querySelector('#notify-new-tickets')?.parentElement?.querySelector('span');
  if (notifyNewSpan) notifyNewSpan.textContent = tr('settings.notifyNew');
  
  const notifyStatusSpan = document.querySelector('#notify-status-changes')?.parentElement?.querySelector('span');
  if (notifyStatusSpan) notifyStatusSpan.textContent = tr('settings.notifyStatus');
  
  const notifyReassignSpan = document.querySelector('#notify-reassignments')?.parentElement?.querySelector('span');
  if (notifyReassignSpan) notifyReassignSpan.textContent = tr('settings.notifyReassign');
  
  const notifyMentionsSpan = document.querySelector('#notify-mentions')?.parentElement?.querySelector('span');
  if (notifyMentionsSpan) notifyMentionsSpan.textContent = tr('settings.notifyMentions');
  
  const soundNotifSpan = document.querySelector('#sound-notifications')?.parentElement?.querySelector('span');
  if (soundNotifSpan) soundNotifSpan.textContent = tr('settings.soundNotifications');
  
  const proModeSpan = document.querySelector('#pro-mode')?.parentElement?.querySelector('span');
  if (proModeSpan) proModeSpan.textContent = tr('settings.proMode');
  
  // Config Panel - Save/Cancel buttons
  const saveConfigBtn = document.getElementById('save-config-btn');
  if (saveConfigBtn) {
    const span = saveConfigBtn.querySelector('span');
    if (span) span.textContent = tr('settings.save');
  }
  
  const cancelConfigBtn = document.getElementById('cancel-config-btn');
  if (cancelConfigBtn) {
    const span = cancelConfigBtn.querySelector('span');
    if (span) span.textContent = tr('settings.cancel');
  }
}

/**
 * Adiciona atributos data-i18n aos elementos do HTML dinamicamente
 * (para elementos que não foram marcados no HTML)
 */
function addI18nAttributes() {
  // Menu items - remover emojis do texto original antes de marcar
  const menuMapping = {
    'menu-pro': 'menu.proMode',
    'menu-refresh': 'menu.refresh',
    'menu-settings': 'menu.settings',
    'menu-okta': 'menu.okta',
    'menu-jamf': 'menu.jamf',
    'menu-google-admin': 'menu.googleAdmin',
    'menu-search': 'menu.search',
    'menu-shortcuts': 'menu.shortcuts',
    'menu-templates': 'menu.templates',
    'menu-themes': 'menu.themes',
    'menu-export': 'menu.export'
  };
  
  Object.entries(menuMapping).forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (element) {
      const span = element.querySelector('span');
      if (span && !span.hasAttribute('data-i18n')) {
        span.setAttribute('data-i18n', key);
        // Forçar tradução inicial
        span.textContent = getTranslation(key, currentLanguage);
      }
    }
  });
  
  // Stats cards
  const statsMapping = {
    'card-total': 'stats.total',
    'card-support': 'stats.support',
    'card-customer': 'stats.customer',
    'card-pending': 'stats.pending'
  };
  
  Object.entries(statsMapping).forEach(([id, key]) => {
    const card = document.getElementById(id);
    if (card) {
      const title = card.querySelector('h3');
      if (title && !title.hasAttribute('data-i18n')) {
        title.setAttribute('data-i18n', key);
      }
    }
  });
}

// ========================================
// 🎓 ONBOARDING TOUR (driver.js)
// ========================================

/**
 * Inicializa o tour de onboarding para novos usuários
 * Usa a biblioteca driver.js para criar um tutorial interativo
 */
function initOnboarding() {
  console.log('🎓 initOnboarding() chamado');
  console.log('🔍 window.driver:', window.driver);
  console.log('🔍 window.driver?.js:', window.driver?.js);
  console.log('🔍 window.driver?.js?.driver:', window.driver?.js?.driver);
  
  // Verificar se driver.js está disponível
  if (!window.driver || !window.driver.js || typeof window.driver.js.driver !== 'function') {
    console.error('❌ Driver.js não está carregado corretamente! Tentando aguardar...');
    
    // Tentar aguardar um pouco mais para o script carregar
    setTimeout(() => {
      if (window.driver?.js?.driver && typeof window.driver.js.driver === 'function') {
        console.log('✅ Driver.js carregou! Iniciando tour...');
        startDriverTour();
      } else {
        console.error('❌ Driver.js ainda não está disponível.');
        console.error('📦 window.driver:', window.driver);
      }
    }, 1000);
    return;
  }
  
  console.log('✅ Driver.js está disponível! Iniciando tour...');
  startDriverTour();
}

/**
 * Inicia o tour do driver.js
 */
function startDriverTour() {
  console.log('🚀 Iniciando driver tour...');
  
  try {
    // Obter traduções do idioma atual
    const lang = currentLanguage || 'pt-BR';
    const t = (key) => getTranslation(key, lang);
    
    console.log('🌍 Idioma do tour:', lang);
    
    // Criar instância do driver com configuração no idioma correto
    // A biblioteca está exposta em window.driver.js.driver()
    const driverObj = window.driver.js.driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayClickNext: false,
    overlayOpacity: 0.75,
    stagePadding: 10,
    stageRadius: 8,
    popoverOffset: 15,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: t('tour.buttons.next'),
    prevBtnText: t('tour.buttons.previous'),
    doneBtnText: t('tour.buttons.done'),
    closeBtnText: t('tour.buttons.skip'),
    progressText: '{{current}} de {{total}}',
    
    // Callback quando o tour termina (completed or skipped)
    onDestroyed: async () => {
      debugLog('🎓 Onboarding Tour finalizado');
      
      // Salvar no config que o tutorial foi completado
      try {
        await ipcRenderer.invoke('save-config', { hasCompletedTutorial: true });
        debugLog('✅ Estado do tutorial salvo');
        
        // Atualizar config local
        currentConfig.hasCompletedTutorial = true;
        
        // Mostrar toast de sucesso no idioma correto
        const successMsg = getTranslation('tour.success', currentLanguage || 'pt-BR');
        showToast(successMsg, 'success');
        
        // 🚀 SE for primeira configuração, AGORA carregar os dados do Jira
        if (window._isFirstConfiguration) {
          console.log('🚀 Tour concluído! Carregando dados do Jira...');
          window._isFirstConfiguration = false; // Limpar flag
          
          // Aguardar 500ms para o usuário ver o toast de sucesso
          setTimeout(async () => {
            await fetchAndUpdateStats();
            startAutoUpdate();
            console.log('✅ Dados carregados e auto-update iniciado!');
          }, 500);
        }
      } catch (error) {
        console.error('❌ Erro ao salvar estado do tutorial:', error);
      }
    },
    
    steps: [
      {
        element: '#stats-grid',
        popover: {
          title: t('tour.step1.title'),
          description: t('tour.step1.description'),
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#refresh-btn',
        popover: {
          title: t('tour.step2.title'),
          description: t('tour.step2.description'),
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '#notifications-btn',
        popover: {
          title: t('tour.step3.title'),
          description: t('tour.step3.description'),
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '#menu-btn',
        popover: {
          title: t('tour.step4.title'),
          description: t('tour.step4.description'),
          side: 'left',
          align: 'center'
        }
      },
      {
        popover: {
          title: t('tour.step5.title'),
          description: t('tour.step5.description'),
          side: 'center',
          align: 'center'
        }
      }
    ]
  });
  
  // Iniciar o tour
  console.log('🎯 Chamando driverObj.drive()...');
  driverObj.drive();
  console.log('✅ Tour iniciado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao iniciar tour:', error);
  }
}

// Expor função para teste manual no console
window.testOnboarding = function() {
  console.log('🧪 Teste manual do onboarding iniciado...');
  initOnboarding();
};

// Expor função para resetar tutorial
window.resetTutorial = async function() {
  console.log('🔄 Resetando tutorial...');
  try {
    await ipcRenderer.invoke('save-config', { hasCompletedTutorial: false });
    currentConfig.hasCompletedTutorial = false;
    console.log('✅ Tutorial resetado! Recarregue a página (Cmd+R)');
  } catch (error) {
    console.error('❌ Erro ao resetar tutorial:', error);
  }
};

// Expor função para simular primeira vez (limpar config)
window.simulateFirstTime = async function() {
  console.log('🆕 Simulando primeira vez (limpando configuração)...');
  try {
    // Limpar localStorage também
    localStorage.removeItem('testFirstTime');
    
    // Salvar config vazio
    await ipcRenderer.invoke('save-config', {
      jiraUrl: '',
      jiraEmail: '',
      jiraApiToken: '',
      hasCompletedTutorial: false,
      queueId: '1104',
      refreshInterval: 60,
      oldTicketsDays: 7
    });
    
    // Atualizar config local para forçar detecção
    currentConfig = {
      jiraUrl: '',
      jiraEmail: '',
      jiraApiToken: '',
      hasCompletedTutorial: false
    };
    
    console.log('✅ Configuração limpa! Recarregando em 1 segundo...');
    console.log('📋 Config atual:', currentConfig);
    
    setTimeout(() => {
      console.log('🔄 Recarregando agora...');
      location.reload();
    }, 1000);
  } catch (error) {
    console.error('❌ Erro ao limpar config:', error);
  }
};

console.log('💡 Funções de debug disponíveis:');
console.log('   - window.testOnboarding() : Testar o tutorial manualmente');
console.log('   - window.resetTutorial() : Resetar o tutorial e forçar exibição');
console.log('   - window.simulateFirstTime() : Simular primeira vez (limpa config e recarrega)');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 DOMContentLoaded disparado');
  await loadConfig();
  console.log('✅ Config carregada:', currentConfig);
  
  // 🎯 PRIMEIRA VEZ: Abrir configurações automaticamente se não houver configuração
  // Para testar: adicione ?firstTime=true na URL ou use localStorage.setItem('testFirstTime', 'true')
  const forceFirstTime = localStorage.getItem('testFirstTime') === 'true';
  const isFirstTime = forceFirstTime || !currentConfig.jiraUrl || !currentConfig.jiraEmail || !currentConfig.jiraApiToken;
  
  console.log('🔍 VERIFICAÇÃO PRIMEIRA VEZ:', {
    isFirstTime,
    forceFirstTime,
    hasUrl: !!currentConfig.jiraUrl,
    hasEmail: !!currentConfig.jiraEmail,
    hasToken: !!currentConfig.jiraApiToken,
    jiraUrl: currentConfig.jiraUrl,
    jiraEmail: currentConfig.jiraEmail,
    jiraApiToken: currentConfig.jiraApiToken ? '***' : '',
    currentConfig: currentConfig
  });
  
  if (isFirstTime) {
    console.log('👋 PRIMEIRA VEZ DETECTADA! Abrindo painel de configurações...');
    console.log('📝 Razões para primeira vez:', {
      semUrl: !currentConfig.jiraUrl,
      semEmail: !currentConfig.jiraEmail,
      semToken: !currentConfig.jiraApiToken
    });
    
    // Limpar flag de teste após usar
    if (forceFirstTime) {
      localStorage.removeItem('testFirstTime');
    }
    
    // Aguardar um pouco para a UI carregar completamente
    setTimeout(() => {
      console.log('🎬 Abrindo painel de configuração...');
      showConfigPanel(true); // true = mostrar mensagem de boas-vindas
    }, 500);
  } else {
    console.log('✅ Usuário já configurado, pulando painel de boas-vindas');
  }
  
  // 🎓 ONBOARDING TOUR: Disparar tutorial para usuários que já configuraram mas ainda não completaram
  const shouldShowTutorial = 
    !isFirstTime && // Não está na primeira vez (já configurou)
    currentConfig.jiraEmail && // Tem email configurado
    !currentConfig.hasCompletedTutorial; // Ainda não completou o tutorial
  
  console.log('🎓 VERIFICAÇÃO TUTORIAL:', {
    shouldShowTutorial,
    isFirstTime,
    hasEmail: !!currentConfig.jiraEmail,
    hasCompletedTutorial: currentConfig.hasCompletedTutorial
  });
  
  if (shouldShowTutorial) {
    console.log('🎓 Disparando Onboarding Tour...');
    // Aguardar a UI carregar completamente antes de iniciar o tour
    setTimeout(() => {
      initOnboarding();
    }, 1500); // 1.5s para garantir que tudo está renderizado
  }
  
  // Aplicar idioma salvo ou padrão
  const savedLanguage = localStorage.getItem('language') || currentConfig.language || 'pt-BR';
  applyLanguage(savedLanguage);
  
  setupEventListeners();
  setupKeyboardShortcuts();
  
  // Inicializar toggle da janela flutuante
  setupFloatingWindowToggle();
  
  // Inicializar contadores de atividade diária
  checkDailyReset();
  updateDailyActivityDisplay();
  
  // Verificar reset à meia-noite a cada minuto
  setInterval(checkDailyReset, 60000);
  
  // 🚀 OTIMIZAÇÃO: Salvar estado a cada 2 minutos (reduz I/O)
  setInterval(() => {
    saveCurrentState();
  }, 120000); // 2 minutos ao invés de 30s
  
  // Salvar estado antes de fechar o app
  window.addEventListener('beforeunload', (e) => {
    // Usar forma síncrona pois beforeunload não aguarda promises
    const stateToSave = {
      ...currentConfig,
      proMode: isProMode,
      layoutMode: layoutMode, // Novo: salvar modo de layout
      isHorizontalLayout: isHorizontalLayout, // Manter compatibilidade
      windowOpacity: windowOpacity,
      focusMode: isFocusMode,
      densityMode: densityMode,
      zoomLevel: zoomLevels[currentZoomIndex], // Salvar nível de zoom
      dailyActivity: dailyActivity, // Salvar atividade diária
      dailyActivityWidgetClosed: dailyActivityWidgetClosed, // Salvar se foi fechado manualmente
      dailyActivityLastValues: dailyActivityLastValues // Salvar valores quando foi fechado
    };
    
    // ❗ NÃO salvar windowBounds aqui - o main.js já cuida disso nos eventos de janela
    delete stateToSave.windowBounds;
    delete stateToSave.jiraWebviewBounds;
    // Também remover bounds de janelas de usuários
    Object.keys(stateToSave).forEach(key => {
      if (key.startsWith('userMonitorBounds_')) {
        delete stateToSave[key];
      }
    });
    
    debugLog('🚪 ========================================');
    debugLog('🚪 FECHANDO APP - SALVANDO ESTADO FINAL');
    debugLog('🚪 Modo Pro ao fechar:', isProMode);
    debugLog('🚪 Zoom ao fechar:', zoomLevels[currentZoomIndex]);
    debugLog('🚪 ========================================');
    ipcRenderer.send('save-config-sync', stateToSave);
  });
  
  // Solicitar permissão para notificações desktop
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      debugLog('🔔 Permissão de notificações:', permission);
    } else {
      debugLog('🔔 Permissão de notificações atual:', Notification.permission);
    }
  } else {
    console.warn('⚠️ Notificações desktop não suportadas neste navegador');
  }
  
  // Aplicar opacidade salva
  if (currentConfig.windowOpacity) {
    updateWindowOpacity(currentConfig.windowOpacity);
  }
  
  // Aplicar tema customizado
  if (currentConfig.themePreset && currentConfig.themePreset !== 'default') {
    debugLog('🎨 Aplicando tema preset:', currentConfig.themePreset);
    applyThemePreset(currentConfig.themePreset);
  } else if (currentConfig.accentColor) {
    debugLog('🎨 Aplicando cor de acento:', currentConfig.accentColor);
    applyAccentColor(currentConfig.accentColor);
  }
  
  // Forçar desativar modo focus (sempre inicia normal)
  isFocusMode = false;
  document.body.classList.remove('focus-mode');
  
  // Inicializar status de conexão
  updateConnectionStatus('offline');
  
  // Verificar se está configurado
  if (currentConfig.jiraEmail && currentConfig.jiraApiToken) {
    // Carregar informações do usuário atual
    try {
      const userResult = await ipcRenderer.invoke('get-current-user');
      if (userResult.success) {
        currentUser = {
          displayName: userResult.displayName,
          emailAddress: userResult.emailAddress,
          accountId: userResult.accountId
        };
        debugLog('👤 Usuário atual carregado:', currentUser.displayName, currentUser.accountId);
      }
    } catch (e) {
      console.error('Erro ao carregar usuário atual:', e);
    }
    
    await fetchAndUpdateStats();
    startAutoUpdate();
  } else {
    showConfigPanel();
  }
});

// Listener para sair do modo compacto via menu de contexto
ipcRenderer.on('exit-compact-mode', () => {
  if (layoutMode === 'super-compact') {
    // Voltar ao modo normal
    layoutMode = 'normal';
    const container = document.querySelector('.app-container');
    const header = document.getElementById('header');
    const footer = document.querySelector('.footer');
    const proSection = document.getElementById('pro-mode-section');
    
    container.classList.remove('super-compact-layout');
    container.classList.remove('horizontal-layout');
    if (header) header.style.display = 'flex';
    if (footer) footer.style.display = 'flex';
    if (proSection && isProMode) proSection.style.display = 'block';
    
    // Restaurar tamanho normal
    ipcRenderer.invoke('resize-window', { width: 420, height: 700 });
    
    // Desativar always-on-top ao sair do modo compacto
    ipcRenderer.invoke('set-always-on-top', false);
    
    showToast('Layout', t('layout.backToNormal'), 'success');
    saveCurrentState();
  }
});

// Listener para configurar usuário monitorado (quando aberto em nova janela)
ipcRenderer.on('set-monitored-user', async (event, userEmail) => {
  if (userEmail) {
    currentConfig.monitorOtherUser = true;
    currentConfig.otherUserEmail = userEmail;
    
    // Atualizar indicador
    updateMonitoredUserIndicator();
    
    // Recarregar stats
    await fetchAndUpdateStats();
    
    // Atualizar título da janela para indicar que está monitorando outro usuário
    const header = document.querySelector('.header h3');
    if (header) {
      const displayName = userEmail.split('@')[0].split('.').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');
      header.textContent = `Jira Monitor - ${displayName}`;
    }
  }
});

// Listener para alternar modo focus (do menu de contexto)
ipcRenderer.on('toggle-focus-mode', () => {
  toggleFocusMode();
});

// Listener para focar em um ticket específico (do menu bar / tray)
ipcRenderer.on('focus-ticket', (event, ticketKey) => {
  debugLog(`📨 Evento focus-ticket recebido para: ${ticketKey}`);
  focusAndHighlightTicket(ticketKey);
});

// Listener para abrir configurações do tray
ipcRenderer.on('open-config-from-tray', () => {
  // Simular clique no botão de configurações
  const configBtn = document.getElementById('config-btn');
  if (configBtn) {
    configBtn.click();
  }
});

// Carregar Configuração
async function loadConfig() {
  try {
    const config = await ipcRenderer.invoke('get-config');
    currentConfig = config;
    
    debugLog('📥 Config carregada:', {
      monitorOtherUser: config.monitorOtherUser,
      otherUserEmail: config.otherUserEmail,
      jiraEmail: config.jiraEmail
    });
    
    // Aplicar configurações na UI
    if (config.jiraUrl) document.getElementById('jira-url').value = config.jiraUrl;
    if (config.jiraEmail) document.getElementById('jira-email').value = config.jiraEmail;
    if (config.jiraApiToken) document.getElementById('jira-api-token').value = config.jiraApiToken;
    if (config.queueId) document.getElementById('queue-id').value = config.queueId;
    if (config.refreshInterval) document.getElementById('refresh-interval').value = config.refreshInterval;
    if (config.oldTicketsDays) document.getElementById('old-tickets-days').value = config.oldTicketsDays;
    
    document.getElementById('alert-sla').checked = config.alertSla !== false;
    document.getElementById('alert-old-tickets').checked = config.alertOldTickets !== false;
    document.getElementById('desktop-notifications').checked = config.desktopNotifications !== false;
    document.getElementById('sound-notifications').checked = config.soundNotifications !== false;
    document.getElementById('pro-mode').checked = config.proMode === true;
    
    // Opções de tipos de notificações
    document.getElementById('notify-new-tickets').checked = config.notifyNewTickets !== false;
    document.getElementById('notify-status-changes').checked = config.notifyStatusChanges !== false;
    document.getElementById('notify-reassignments').checked = config.notifyReassignments !== false;
    document.getElementById('notify-mentions').checked = config.notifyMentions !== false;
    
    // Mostrar/ocultar opções de tipos de notificações
    const notificationTypesGroup = document.getElementById('notification-types-group');
    if (notificationTypesGroup) {
      notificationTypesGroup.style.display = config.desktopNotifications !== false ? 'block' : 'none';
    }
    
    // Aplicar tema (gerenciado pelo modal de temas no menu)
    const theme = config.theme || 'default';
    applyTheme(theme);
    
    // Aplicar idioma (gerenciado pelo modal de idioma no menu)
    const language = config.language || localStorage.getItem('language') || 'pt-BR';
    currentLanguage = language;
    
    // Mostrar/ocultar campo de outro usuário
    const otherUserGroup = document.getElementById('other-user-email-group');
    if (otherUserGroup) {
      otherUserGroup.style.display = config.monitorOtherUser ? 'block' : 'none';
    }
    
    // Aplicar Modo Pro
    debugLog('📥 ========================================');
    debugLog('📥 CARREGANDO MODO PRO DA CONFIGURAÇÃO');
    debugLog('📥 config.proMode:', config.proMode);
    debugLog('📥 tipo:', typeof config.proMode);
    debugLog('📥 ========================================');
    isProMode = config.proMode === true;
    debugLog('✅ MODO PRO DEFINIDO COMO:', isProMode);
    debugLog('📥 ========================================');
    updateProModeUI();
    
    // Restaurar layout
    layoutMode = config.layoutMode || 'normal';
    isHorizontalLayout = config.isHorizontalLayout === true; // Compatibilidade legado
    
    // Se tem layoutMode salvo, usar ele
    const container = document.querySelector('.app-container');
    const exitBtn = document.getElementById('super-compact-exit-btn');
    if (layoutMode === 'horizontal') {
      container.classList.add('horizontal-layout');
      if (exitBtn) exitBtn.style.display = 'none';
    } else if (layoutMode === 'super-compact') {
      container.classList.add('super-compact-layout');
      const header = document.getElementById('header');
      const footer = document.querySelector('.footer');
      if (header) header.style.display = 'none';
      if (footer) footer.style.display = 'none';
      if (exitBtn) exitBtn.style.display = 'flex';
    }
    // Se não tem layoutMode mas tem isHorizontalLayout (migração legado)
    else if (isHorizontalLayout) {
      layoutMode = 'horizontal';
      container.classList.add('horizontal-layout');
      if (exitBtn) exitBtn.style.display = 'none';
    }
    
    // Restaurar focus mode
    isFocusMode = config.focusMode === true;
    if (isFocusMode) {
      document.body.classList.add('focus-mode');
    }
    
    // Restaurar atividade diária
    if (config.dailyActivity && config.dailyActivity.lastReset === new Date().toDateString()) {
      dailyActivity = config.dailyActivity;
      debugLog('📥 Atividade diária restaurada:', dailyActivity);
      
      // Restaurar flags de fechamento manual (mesmo dia)
      if (config.dailyActivityWidgetClosed !== undefined) {
        dailyActivityWidgetClosed = config.dailyActivityWidgetClosed;
      }
      if (config.dailyActivityLastValues) {
        dailyActivityLastValues = config.dailyActivityLastValues;
      }
      debugLog('📥 Estado do badge restaurado:', { 
        closed: dailyActivityWidgetClosed, 
        lastValues: dailyActivityLastValues 
      });
    } else {
      debugLog('🔄 Reset de atividade diária (nova data)');
      dailyActivity.lastReset = new Date().toDateString();
      // Resetar flags de fechamento manual (novo dia = badge deve aparecer novamente)
      dailyActivityWidgetClosed = false;
      dailyActivityLastValues = { received: 0, resolved: 0, commented: 0 };
    }
    
    // Restaurar modo de densidade
    if (config.densityMode) {
      densityMode = config.densityMode;
      applyDensityMode(densityMode, false); // false para não mostrar toast no início
    }
    
    // Restaurar zoom
    if (config.zoomLevel !== undefined) {
      currentZoomIndex = zoomLevels.indexOf(config.zoomLevel);
      if (currentZoomIndex === -1) {
        currentZoomIndex = 5; // Default 100%
      }
      currentZoom = zoomLevels[currentZoomIndex];
      
      // Aplicar zoom usando webFrame (nativo do Electron)
      if (webFrame) {
        webFrame.setZoomFactor(currentZoom);
      }
    }
    
    // Atualizar indicador de usuário monitorado
    updateMonitoredUserIndicator();
    
    // Carregar configurações da janela flutuante
    const fw = config.floatingWindow || {};
    const fwEnabled = document.getElementById('floating-window-enabled');
    const fwOpacity = document.getElementById('floating-window-opacity');
    const fwOpacityValue = document.getElementById('floating-window-opacity-value');
    const fwWidth = document.getElementById('floating-window-width');
    const fwHeight = document.getElementById('floating-window-height');
    const fwShowCritical = document.getElementById('fw-show-critical');
    const fwShowWarning = document.getElementById('fw-show-warning');
    const fwShowNormal = document.getElementById('fw-show-normal');
    const fwShowTicketList = document.getElementById('fw-show-ticket-list');
    const fwOptions = document.getElementById('floating-window-options');
    
    if (fwEnabled) fwEnabled.checked = fw.enabled !== false;
    if (fwOpacity) fwOpacity.value = fw.opacity ?? 0.9;
    if (fwOpacityValue) fwOpacityValue.textContent = Math.round((fw.opacity ?? 0.9) * 100) + '%';
    if (fwWidth) fwWidth.value = fw.width ?? 160;
    if (fwHeight) fwHeight.value = fw.height ?? 80;
    if (fwShowCritical) fwShowCritical.checked = fw.showCritical !== false;
    if (fwShowWarning) fwShowWarning.checked = fw.showWarning !== false;
    if (fwShowNormal) fwShowNormal.checked = fw.showNormal !== false;
    if (fwShowTicketList) fwShowTicketList.checked = fw.showTicketList === true;
    if (fwOptions) fwOptions.style.display = fw.enabled !== false ? 'block' : 'none';
    
  } catch (error) {
    console.error('Erro ao carregar configuração:', error);
  }
}

// Salvar Configuração
async function saveConfig() {
  try {
    const config = {
      jiraUrl: document.getElementById('jira-url').value,
      jiraEmail: document.getElementById('jira-email').value,
      jiraApiToken: document.getElementById('jira-api-token').value,
      queueId: document.getElementById('queue-id').value,
      refreshInterval: parseInt(document.getElementById('refresh-interval').value),
      oldTicketsDays: parseInt(document.getElementById('old-tickets-days').value),
      theme: currentConfig.theme || 'default', // Mantém o tema atual
      language: document.getElementById('config-language-select')?.value || currentLanguage || 'pt-BR', // Idioma selecionado
      alertSla: document.getElementById('alert-sla').checked,
      alertOldTickets: document.getElementById('alert-old-tickets').checked,
      desktopNotifications: document.getElementById('desktop-notifications').checked,
      soundNotifications: document.getElementById('sound-notifications').checked,
      proMode: document.getElementById('pro-mode').checked,
      notifyNewTickets: document.getElementById('notify-new-tickets').checked,
      notifyStatusChanges: document.getElementById('notify-status-changes').checked,
      notifyReassignments: document.getElementById('notify-reassignments').checked,
      notifyMentions: document.getElementById('notify-mentions').checked,
      // monitorOtherUser e otherUserEmail agora são gerenciados pelo botão no header
      monitorOtherUser: currentConfig.monitorOtherUser || false,
      otherUserEmail: currentConfig.otherUserEmail || '',
      userHistory: currentConfig.userHistory || [],
      // Configurações de UI/UX que devem persistir
      layoutMode: layoutMode, // Novo: salvar modo de layout
      isHorizontalLayout: isHorizontalLayout, // Manter compatibilidade
      windowOpacity: windowOpacity,
      focusMode: isFocusMode,
      densityMode: densityMode,
      zoomLevel: zoomLevels[currentZoomIndex], // Salvar nível de zoom
      accentColor: currentConfig.accentColor,
      themePreset: currentConfig.themePreset,
      clearedNotifications: currentConfig.clearedNotifications || [],
      customShortcuts: currentConfig.customShortcuts,
      // IMPORTANTE: Manter hasCompletedTutorial do config anterior
      // Se não existir, deixar undefined para que o tour possa disparar
      hasCompletedTutorial: currentConfig.hasCompletedTutorial,
      // Janela flutuante
      floatingWindow: {
        enabled: document.getElementById('floating-window-enabled')?.checked ?? false,
        opacity: parseFloat(document.getElementById('floating-window-opacity')?.value ?? 0.9),
        width: parseInt(document.getElementById('floating-window-width')?.value ?? 160),
        height: parseInt(document.getElementById('floating-window-height')?.value ?? 80),
        showCritical: document.getElementById('fw-show-critical')?.checked ?? true,
        showWarning: document.getElementById('fw-show-warning')?.checked ?? true,
        showNormal: document.getElementById('fw-show-normal')?.checked ?? true,
        showTicketList: document.getElementById('fw-show-ticket-list')?.checked ?? false,
        x: currentConfig.floatingWindow?.x ?? 20,
        y: currentConfig.floatingWindow?.y ?? 60
      }
    };
    
    // Aplicar configurações da janela flutuante
    if (config.floatingWindow) {
      ipcRenderer.invoke('update-floating-window-config', config.floatingWindow).catch(err => {
        console.warn('Erro ao atualizar floating window:', err);
      });
    }
    
    await ipcRenderer.invoke('save-config', config);
    currentConfig = config;
    
    // Aplicar tema
    applyTheme(config.theme);
    
    // Aplicar idioma
    applyLanguage(config.language);
    
    // Aplicar Modo Pro
    isProMode = config.proMode;
    updateProModeUI();
    
    // Atualizar indicador de usuário monitorado
    updateMonitoredUserIndicator();
    
    // Verificar se é primeira configuração (para disparar o tour)
    const isFirstConfiguration = !currentConfig.hasCompletedTutorial && config.jiraEmail && config.jiraApiToken;
    
    console.log('💾 Configuração salva:', {
      isFirstConfiguration,
      hasCompletedTutorial: currentConfig.hasCompletedTutorial,
      willShowTour: isFirstConfiguration
    });
    
    // Esconder mensagem de boas-vindas após salvar
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) {
      welcomeMsg.style.display = 'none';
    }
    
    hideConfigPanel();
    
    // 🎓 INICIAR TOUR se for primeira configuração (ANTES de carregar dados)
    if (isFirstConfiguration) {
      console.log('🎉 Primeira configuração detectada! Iniciando tour imediatamente...');
      
      // Marcar globalmente que é primeira config para o callback do tour saber
      window._isFirstConfiguration = true;
      
      // Aguardar apenas 500ms para UI se estabilizar
      setTimeout(() => {
        console.log('🎓 Disparando tour de onboarding...');
        initOnboarding();
      }, 500);
    } else {
      // Se não for primeira vez, carregar dados normalmente
      await fetchAndUpdateStats();
      startAutoUpdate();
      showToast(t('general.success'), t('config.saved'), 'success');
    }
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    showToast(t('general.error'), t('config.saveError'), 'error');
  }
}

// Atualizar Indicador de Usuário Monitorado
function updateMonitoredUserIndicator() {
  const label = document.getElementById('user-monitor-label');
  
  if (currentConfig.monitorOtherUser && currentConfig.otherUserEmail) {
    // Mostrar só o primeiro nome do email
    const emailParts = currentConfig.otherUserEmail.split('@')[0];
    const firstName = emailParts.split('.')[0];
    label.textContent = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  } else {
    label.textContent = 'Você';
  }
  
  updateUserListDropdown();
  updateProMonitoredUserBadge();
}

// Atualizar badges de usuário monitorado nas seções PRO
function updateProMonitoredUserBadge() {
  const dashboardBadge = document.getElementById('dashboard-monitored-user');
  
  if (currentConfig.monitorOtherUser && currentConfig.otherUserEmail) {
    const emailParts = currentConfig.otherUserEmail.split('@')[0];
    const firstName = emailParts.split('.')[0];
    const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    const badgeText = `👤 ${displayName}`;
    
    if (dashboardBadge) {
      dashboardBadge.textContent = badgeText;
      dashboardBadge.style.display = 'inline-flex';
    }
  } else {
    if (dashboardBadge) dashboardBadge.style.display = 'none';
  }
}

// Gerenciamento de Histórico de Usuários
function getUserHistory() {
  const history = currentConfig.userHistory || [];
  return history;
}

async function saveUserHistory(history) {
  currentConfig.userHistory = history.slice(0, 5); // Manter apenas os últimos 5
  // Salvar no disco
  await ipcRenderer.invoke('save-config', { userHistory: currentConfig.userHistory });
}

async function addUserToHistory(email) {
  if (!email) return;
  
  let history = getUserHistory();
  
  // Remover duplicatas
  history = history.filter(e => e.toLowerCase() !== email.toLowerCase());
  
  // Adicionar no início
  history.unshift(email);
  
  // Manter apenas 5 e salvar
  await saveUserHistory(history);
}

// Remover usuário do histórico
async function removeUserFromHistory(email) {
  if (!email) return;
  
  debugLog('🗑️ Removendo usuário do histórico:', email);
  
  let history = getUserHistory();
  const historyBefore = [...history];
  history = history.filter(e => e.toLowerCase() !== email.toLowerCase());
  
  debugLog('📋 Histórico antes:', historyBefore);
  debugLog('📋 Histórico depois:', history);
  
  await saveUserHistory(history);
  debugLog('💾 Histórico salvo no disco');
  
  // Se estava monitorando esse usuário, voltar para "você"
  if (currentConfig.otherUserEmail === email) {
    debugLog('⚠️ Estava monitorando este usuário, voltando para "você"');
    await switchMonitoredUser('');
  }
  
  // Atualizar dropdown
  updateUserListDropdown();
  
  showToast(t('general.removed'), `${email} ${t('addUser.removed')}`, 'success');
}

// Abrir usuário em nova janela
async function openUserInNewWindow(email) {
  if (!email) return;
  
  try {
    await ipcRenderer.invoke('open-user-window', email);
    showToast(t('general.newWindow'), `${t('userMonitor.monitoring')} ${email} ${t('addUser.monitoringInNewWindow')}`, 'success');
  } catch (error) {
    console.error('Erro ao abrir nova janela:', error);
    showToast(t('general.error'), t('general.error'), 'error');
  }
}

// Atualizar Dropdown de Usuários
function updateUserListDropdown() {
  const userList = document.getElementById('user-list');
  const history = getUserHistory();
  
  let html = '';
  
  // Opção "Você"
  const isMonitoringSelf = !currentConfig.monitorOtherUser;
  html += `
    <div class="user-item ${isMonitoringSelf ? 'active' : ''}" data-user="">
      <div class="user-info" data-user-select="">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        <span class="user-name">Você</span>
      </div>
      ${isMonitoringSelf ? '<svg viewBox="0 0 24 24" width="18" height="18" class="check-icon"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
    </div>
  `;
  
  // Histórico de usuários
  if (history.length > 0) {
    html += '<div class="user-divider"></div>';
    
    history.forEach(email => {
      const isActive = currentConfig.monitorOtherUser && currentConfig.otherUserEmail === email;
      const emailParts = email.split('@')[0];
      const displayName = emailParts.split('.').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');
      
      html += `
        <div class="user-item ${isActive ? 'active' : ''}" data-user="${email}">
          <div class="user-info" data-user-select="${email}">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <div class="user-details">
              <span class="user-name">${displayName}</span>
              <span class="user-email">${email}</span>
            </div>
          </div>
          <div class="user-actions">
            <button class="user-action-btn open-new-window-btn" data-user="${email}" title="Abrir em nova janela">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
              </svg>
            </button>
            <button class="user-action-btn remove-user-btn" data-user="${email}" title="Remover do histórico">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            ${isActive ? '<svg viewBox="0 0 24 24" width="18" height="18" class="check-icon"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
          </div>
        </div>
      `;
    });
  }
  
  userList.innerHTML = html;
  
  // Adicionar event listeners para seleção
  userList.querySelectorAll('.user-info[data-user-select]').forEach(item => {
    item.addEventListener('click', () => {
      const email = item.getAttribute('data-user-select');
      switchMonitoredUser(email);
    });
  });
  
  // Event listeners para abrir em nova janela
  userList.querySelectorAll('.open-new-window-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const email = btn.getAttribute('data-user');
      openUserInNewWindow(email);
    });
  });
  
  // Event listeners para remover usuário
  userList.querySelectorAll('.remove-user-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const email = btn.getAttribute('data-user');
      await removeUserFromHistory(email);
    });
  });
}

// Trocar Usuário Monitorado
async function switchMonitoredUser(email) {
  debugLog('🔄 Trocando usuário monitorado:', email || 'você');
  
  if (!email || email === '') {
    // Monitorar "você"
    currentConfig.monitorOtherUser = false;
    currentConfig.otherUserEmail = '';
    debugLog('✅ Configurado para monitorar você');
  } else {
    // Monitorar outro usuário
    currentConfig.monitorOtherUser = true;
    currentConfig.otherUserEmail = email;
    await addUserToHistory(email);
    debugLog('✅ Configurado para monitorar:', email);
  }
  
  // Salvar config completa
  const configToSave = {
    ...currentConfig,
    monitorOtherUser: currentConfig.monitorOtherUser,
    otherUserEmail: currentConfig.otherUserEmail
  };
  await ipcRenderer.invoke('save-config', configToSave);
  
  debugLog('💾 Config salva:', {
    monitorOtherUser: configToSave.monitorOtherUser,
    otherUserEmail: configToSave.otherUserEmail
  });
  
  // Atualizar UI
  updateMonitoredUserIndicator();
  hideUserMonitorDropdown();
  
  // Limpar notificações internas do usuário anterior
  internalNotifications = [];
  debugLog('🗑️ Notificações internas limpas ao trocar usuário');
  
  // Limpar estados de tickets anteriores para o novo usuário
  previousTicketKeys = new Set();
  previousTicketStates = new Map();
  debugLog('🗑️ Estados de tickets resetados ao trocar usuário');
  
  // Recarregar stats e notificações do usuário selecionado
  showToast(t('general.success'), `${t('addUser.nowMonitoring')} ${email || t('userMonitor.you')}`, 'success');
  await fetchAndUpdateStats();
  
  // Sempre recarregar notificações ao trocar usuário
  await loadNotifications();
  
  debugLog('✅ Stats e notificações atualizadas para:', email || 'você');
}

// Aplicar Tema
function applyTheme(theme) {
  const container = document.querySelector('.app-container');
  container.setAttribute('data-theme', theme);
  
  // Atualizar tema da janela flutuante
  ipcRenderer.invoke('set-floating-window-theme', theme).catch(err => {
    console.warn('Erro ao atualizar tema da janela flutuante:', err);
  });
  
  debugLog('🎨 Tema aplicado:', theme);
}

// Modo de Densidade
function toggleDensityMode() {
  const modes = ['default', 'compact', 'comfortable'];
  const currentIndex = modes.indexOf(densityMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  densityMode = modes[nextIndex];
  
  applyDensityMode(densityMode);
  saveCurrentState(); // Salvar automaticamente
}

/**
 * Aplica o modo de densidade visual
 * @param {string} mode - 'default', 'compact' ou 'comfortable'
 * @param {boolean} showNotification - Se deve mostrar o toast informativo
 */
function applyDensityMode(mode, showNotification = true) {
  const container = document.querySelector('.app-container');
  if (!container) return;

  // Remover classes anteriores
  container.classList.remove('density-compact', 'density-comfortable');
  
  // Adicionar nova classe
  if (mode !== 'default') {
    container.classList.add(`density-${mode}`);
  }
  
  if (showNotification) {
    const modeNames = {
      default: t('density.default'),
      compact: t('density.compact'),
      comfortable: t('density.comfortable')
    };
    showToast(t('tooltip.densityMode'), `${modeNames[mode] || mode} ${t('density.modeActivated')}`, 'info');
  }
  
  debugLog('📐 Modo de densidade aplicado:', mode);
}

// Atualizar Mini Stats
function updateMiniStats(stats) {
  if (!stats) return;
  
  const dashboard = document.getElementById('mini-stats-dashboard');
  
  // Mostrar mini stats apenas em Modo Pro
  if (isProMode) {
    dashboard.style.display = 'flex';
    
    // Calcular taxa de resolução (exemplo simplificado)
    const resolutionRate = stats.total > 0 ? Math.round((stats.waitingForSupport / stats.total) * 100) : 0;
    document.getElementById('mini-resolution-rate').textContent = `${resolutionRate}%`;
    
    // Tempo médio (placeholder - pode ser calculado com dados reais)
    document.getElementById('mini-avg-time').textContent = '2.5h';
    
    // Tickets de hoje (placeholder - precisa de dados de criação)
    document.getElementById('mini-today-count').textContent = stats.total || 0;
  } else {
    dashboard.style.display = 'none';
  }
}

// Event Listeners
function setupEventListeners() {
  // Header buttons
  document.getElementById('menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });
  document.getElementById('user-monitor-btn').addEventListener('click', toggleUserMonitorDropdown);
  document.getElementById('notifications-btn').addEventListener('click', toggleNotifications);
  document.getElementById('docs-btn').addEventListener('click', toggleDocsDropdown);
  document.getElementById('zoom-in-btn').addEventListener('click', zoomIn);
  document.getElementById('zoom-out-btn').addEventListener('click', zoomOut);
  document.getElementById('toggle-density-btn').addEventListener('click', toggleDensityMode);
  document.getElementById('minimize-btn').addEventListener('click', () => ipcRenderer.invoke('minimize-window'));
  document.getElementById('close-btn').addEventListener('click', () => ipcRenderer.invoke('close-window'));
  
  // Menu items
  document.getElementById('menu-pro').addEventListener('click', () => {
    toggleProMode();
    hideMenu();
  });
  document.getElementById('menu-refresh').addEventListener('click', () => {
    fetchAndUpdateStats();
    hideMenu();
  });
  document.getElementById('menu-settings').addEventListener('click', () => {
    showConfigPanel();
    hideMenu();
  });
  document.getElementById('menu-okta').addEventListener('click', () => {
    ipcRenderer.invoke('open-url', 'https://your-company.okta.com/');
    hideMenu();
  });
  document.getElementById('menu-jamf').addEventListener('click', () => {
    ipcRenderer.invoke('open-url', 'https://your-company.jamfcloud.com/');
    hideMenu();
  });
  document.getElementById('menu-jira-portal').addEventListener('click', () => {
    ipcRenderer.invoke('open-url', 'https://your-company.atlassian.net/servicedesk/customer/portals');
    hideMenu();
  });
  document.getElementById('menu-google-admin').addEventListener('click', () => {
    ipcRenderer.invoke('open-url', 'https://admin.google.com/?authuser=0&utm_source=og_am');
    hideMenu();
  });
  document.getElementById('menu-search').addEventListener('click', () => {
    toggleSearch();
    hideMenu();
  });
  document.getElementById('menu-shortcuts').addEventListener('click', () => {
    showShortcutsModal();
    hideMenu();
  });
  document.getElementById('menu-templates')?.addEventListener('click', () => {
    showTemplatesModal();
    hideMenu();
  });
  
  document.getElementById('menu-timer')?.addEventListener('click', () => {
    showTimerWidget();
    hideMenu();
  });
  // Opacity slider
  const opacitySlider = document.getElementById('opacity-slider');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) / 100;
      updateWindowOpacity(value);
    });
    opacitySlider.addEventListener('click', (e) => {
      e.stopPropagation(); // Não fechar o menu ao clicar no slider
    });
  }
  document.getElementById('menu-themes').addEventListener('click', () => {
    showThemeCustomizer();
    hideMenu();
  });
  document.getElementById('menu-toggle-layout').addEventListener('click', () => {
    toggleLayout();
    hideMenu();
  });
  
  // Botão flutuante para sair do modo super compacto
  const exitSuperCompactBtn = document.getElementById('super-compact-exit-btn');
  if (exitSuperCompactBtn) {
    exitSuperCompactBtn.addEventListener('click', () => {
      // Voltar diretamente ao modo normal
      layoutMode = 'normal';
      const container = document.querySelector('.app-container');
      const header = document.getElementById('header');
      const footer = document.querySelector('.footer');
      const proSection = document.getElementById('pro-mode-section');
      
      container.classList.remove('super-compact-layout');
      container.classList.remove('horizontal-layout');
      if (header) header.style.display = 'flex';
      if (footer) footer.style.display = 'flex';
      if (proSection && isProMode) proSection.style.display = 'block';
      exitSuperCompactBtn.style.display = 'none';
      
      showToast('Layout', 'Voltou ao modo normal', 'success');
      saveCurrentState();
    });
  }
  
  document.getElementById('menu-language').addEventListener('click', () => {
    showLanguageModal();
    hideMenu();
  });
  document.getElementById('menu-export').addEventListener('click', () => {
    showExportModal();
    hideMenu();
  });
  
  // Config panel
  document.getElementById('save-config-btn').addEventListener('click', saveConfig);
  document.getElementById('cancel-config-btn').addEventListener('click', hideConfigPanel);
  document.getElementById('close-config-btn').addEventListener('click', hideConfigPanel);
  document.getElementById('toggle-password-btn').addEventListener('click', togglePasswordVisibility);
  document.getElementById('test-notification-btn').addEventListener('click', testDesktopNotification);
  
  // Seletor de idioma no config panel
  const configLanguageSelect = document.getElementById('config-language-select');
  if (configLanguageSelect) {
    configLanguageSelect.addEventListener('change', (e) => {
      const newLang = e.target.value;
      console.log('🌍 Idioma alterado para:', newLang);
      applyLanguage(newLang);
      
      // Atualizar mensagem de boas-vindas se estiver visível
      const welcomeMsg = document.getElementById('welcome-message');
      if (welcomeMsg && welcomeMsg.style.display !== 'none') {
        applyLanguage(newLang);
      }
    });
  }
  
  // Link para criar API token
  document.getElementById('create-api-token-link').addEventListener('click', (e) => {
    e.preventDefault();
    ipcRenderer.invoke('open-url', 'https://id.atlassian.com/manage-profile/security/api-tokens');
  });
  
  // Mostrar/ocultar opções de tipos de notificações
  document.getElementById('desktop-notifications').addEventListener('change', (e) => {
    const notificationTypesGroup = document.getElementById('notification-types-group');
    notificationTypesGroup.style.display = e.target.checked ? 'block' : 'none';
  });
  
  // Janela flutuante - toggle opções
  const fwEnabledCheckbox = document.getElementById('floating-window-enabled');
  if (fwEnabledCheckbox) {
    fwEnabledCheckbox.addEventListener('change', (e) => {
      const fwOptions = document.getElementById('floating-window-options');
      if (fwOptions) fwOptions.style.display = e.target.checked ? 'block' : 'none';
    });
  }
  
  // Janela flutuante - slider de opacidade
  const fwOpacitySlider = document.getElementById('floating-window-opacity');
  if (fwOpacitySlider) {
    fwOpacitySlider.addEventListener('input', (e) => {
      const valueDisplay = document.getElementById('floating-window-opacity-value');
      if (valueDisplay) valueDisplay.textContent = Math.round(e.target.value * 100) + '%';
    });
  }
  
  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', fetchAndUpdateStats);
  
  // Badge listeners - tornando badges clicáveis
  document.getElementById('badge-sla').addEventListener('click', (e) => {
    e.stopPropagation();
    showBadgeTickets('sla');
  });
  
  document.getElementById('badge-old').addEventListener('click', (e) => {
    e.stopPropagation();
    showBadgeTickets('old');
  });
  
  // SIM Cards expand button
  const expandSimCardsBtn = document.getElementById('expand-sim-cards');
  if (expandSimCardsBtn) {
    expandSimCardsBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevenir propagação para o botão pai
      toggleSimCardsExpansion();
    });
  }
  
  // Evaluated Tickets expand button
  const expandEvaluatedTicketsBtn = document.getElementById('expand-evaluated-tickets');
  if (expandEvaluatedTicketsBtn) {
    expandEvaluatedTicketsBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevenir propagação para o botão pai
      toggleEvaluatedTicketsExpansion();
    });
  }
  
  // SIM Cards count button - abre o filtro no Jira
  const simCardsCountBtn = document.getElementById('sim-cards-count-btn');
  if (simCardsCountBtn) {
    simCardsCountBtn.addEventListener('click', () => {
      if (currentStats && currentStats.simcardPendingTickets && currentStats.simcardPendingTickets.jql) {
        const jiraUrl = currentConfig.jiraUrl || 'https://your-company.atlassian.net';
        ipcRenderer.send('open-url', `${jiraUrl}/issues/?filter=52128`);
      }
    });
  }
  
  // Evaluated Tickets count button - abre o filtro no Jira
  const evaluatedTicketsCountBtn = document.getElementById('evaluated-tickets-count-btn');
  if (evaluatedTicketsCountBtn) {
    evaluatedTicketsCountBtn.addEventListener('click', () => {
      const jiraUrl = currentConfig.jiraUrl || 'https://your-company.atlassian.net';
      ipcRenderer.send('open-url', `${jiraUrl}/issues/?filter=52358`);
    });
  }
  
  // Search
  document.getElementById('search-input').addEventListener('input', performSearch);
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSearch();
    if (e.key === 'Enter' && document.querySelector('.search-result-item')) {
      document.querySelector('.search-result-item').click();
    }
  });
  
  // Shortcuts modal
  document.getElementById('close-shortcuts-btn').addEventListener('click', hideShortcutsModal);
  document.getElementById('shortcuts-modal').addEventListener('click', (e) => {
    if (e.target.id === 'shortcuts-modal') hideShortcutsModal();
  });
  
  // Error banner
  document.getElementById('error-retry-btn').addEventListener('click', fetchAndUpdateStats);
  document.getElementById('error-close-btn').addEventListener('click', hideErrorBanner);
  
  // Docs dropdown
  document.getElementById('close-docs-dropdown').addEventListener('click', hideDocsDropdown);
  
  // Docs links
  document.querySelectorAll('.docs-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        ipcRenderer.invoke('open-url', url);
        hideDocsDropdown();
      }
    });
  });
  
  // User Monitor dropdown
  document.getElementById('close-user-monitor-dropdown').addEventListener('click', hideUserMonitorDropdown);
  document.getElementById('add-user-btn').addEventListener('click', showAddUserModal);
  
  // Add User Modal
  document.getElementById('close-add-user-btn').addEventListener('click', hideAddUserModal);
  document.getElementById('cancel-add-user-btn').addEventListener('click', hideAddUserModal);
  document.getElementById('confirm-add-user-btn').addEventListener('click', confirmAddUser);
  document.getElementById('new-user-email-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmAddUser();
    if (e.key === 'Escape') hideAddUserModal();
  });
  
  // Quick Search Modal
  document.getElementById('close-quick-search').addEventListener('click', hideQuickSearch);
  document.getElementById('quick-search-input').addEventListener('input', performQuickSearch);
  document.getElementById('quick-search-input').addEventListener('keydown', handleQuickSearchKeydown);
  document.getElementById('quick-search-modal').addEventListener('click', (e) => {
    if (e.target.id === 'quick-search-modal') hideQuickSearch();
  });
  
  // Theme Customizer Modal
  const closeThemeBtn = document.getElementById('close-theme-customizer');
  if (closeThemeBtn) {
    closeThemeBtn.addEventListener('click', hideThemeCustomizer);
  }
  
  // Os event listeners de cores e temas serão adicionados quando o modal abrir
  setupThemeCustomizerListeners();
  
  // Shortcuts Custom Modal
  document.getElementById('close-shortcuts-custom').addEventListener('click', hideShortcutsCustomModal);
  document.getElementById('reset-shortcuts').addEventListener('click', resetShortcutsToDefault);
  
  // Export Modal
  document.getElementById('close-export-modal').addEventListener('click', hideExportModal);
  document.getElementById('export-download-btn').addEventListener('click', downloadReport);
  
  // Botões de notificações
  document.getElementById('view-all-notifications').addEventListener('click', viewAllNotifications);
  document.getElementById('clear-notifications').addEventListener('click', clearAllNotifications);
  document.getElementById('reset-notification-history').addEventListener('click', resetNotificationHistory);
  document.getElementById('close-notifications-preview').addEventListener('click', () => {
    document.getElementById('notifications-preview').style.display = 'none';
  });
  
  // Atividade do dia
  document.getElementById('close-daily-activity').addEventListener('click', closeDailyActivityWidget);
  
  // Cards clicáveis
  setupCardListeners();
  
  // Fechar menu ao clicar fora
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('menu-dropdown');
    const menuBtn = document.getElementById('menu-btn');
    if (menu.style.display === 'block' && !menu.contains(e.target) && !menuBtn.contains(e.target)) {
      hideMenu();
    }
    
    // Fechar dropdown de docs ao clicar fora
    const docsDropdown = document.getElementById('docs-dropdown');
    const docsBtn = document.getElementById('docs-btn');
    if (docsDropdown.style.display === 'block' && !docsDropdown.contains(e.target) && !docsBtn.contains(e.target)) {
      hideDocsDropdown();
    }
  });
  
  // Resize handle
  setupResizeHandle();
  
  // ============================================
  // Event listeners para v1.5.0
  // ============================================
  
  // Dashboard de Performance
  const expandDashboardBtn = document.getElementById('expand-performance-dashboard');
  if (expandDashboardBtn) {
    expandDashboardBtn.addEventListener('click', () => {
      const detailsContainer = document.getElementById('performance-details');
      const isExpanded = expandDashboardBtn.classList.contains('expanded');
      
      if (isExpanded) {
        expandDashboardBtn.classList.remove('expanded');
        detailsContainer.style.display = 'none';
      } else {
        expandDashboardBtn.classList.add('expanded');
        detailsContainer.style.display = 'block';
        
        // Carregar gráficos se houver dados em cache
        if (performanceMetricsCache) {
          generatePerformanceCharts(performanceMetricsCache);
        } else {
          loadPerformanceDashboard();
        }
      }
    });
  }
  
  const refreshMetricsBtn = document.getElementById('performance-refresh-btn');
  if (refreshMetricsBtn) {
    refreshMetricsBtn.addEventListener('click', () => {
      loadPerformanceDashboard();
    });
  }
  
  // Timer & Pomodoro
  const timerStartBtn = document.getElementById('timer-start-btn');
  const timerPauseBtn = document.getElementById('timer-pause-btn');
  const timerStopBtn = document.getElementById('timer-stop-btn');
  const timerMinimizeBtn = document.getElementById('timer-minimize-btn');
  const timerCloseBtn = document.getElementById('timer-close-btn');
  const timerMiniRestore = document.getElementById('timer-mini-restore');
  const timerSaveWorklogBtn = document.getElementById('timer-save-worklog-btn');
  
  if (timerStartBtn) timerStartBtn.addEventListener('click', startTimer);
  if (timerPauseBtn) timerPauseBtn.addEventListener('click', pauseTimer);
  if (timerStopBtn) timerStopBtn.addEventListener('click', stopTimer);
  if (timerMinimizeBtn) timerMinimizeBtn.addEventListener('click', minimizeTimerWidget);
  if (timerCloseBtn) timerCloseBtn.addEventListener('click', hideTimerWidget);
  if (timerMiniRestore) timerMiniRestore.addEventListener('click', restoreTimerWidget);
  
  if (timerSaveWorklogBtn) {
    timerSaveWorklogBtn.addEventListener('click', () => {
      if (timerState.running) {
        const secondsToSave = timerState.seconds;
        stopTimer();
        saveWorklog(secondsToSave);
      } else {
        saveWorklog();
      }
    });
  }
  
  // Botões de modo do timer
  document.querySelectorAll('.timer-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTimerMode(btn.dataset.mode));
  });
  
  // Fechar menu ao clicar fora
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('menu-dropdown');
    const menuBtn = document.getElementById('menu-btn');
    
    if (menu && menuBtn && 
        !menu.contains(e.target) && 
        !menuBtn.contains(e.target) &&
        menu.style.display === 'block') {
      hideMenu();
    }
  });
  
  debugLog('✅ Event listeners v1.5.0 configurados');
}

// Setup do Toggle da Janela Flutuante
function setupFloatingWindowToggle() {
  const toggle = document.getElementById('floating-window-toggle');
  if (!toggle) {
    console.warn('⚠️ Toggle da janela flutuante não encontrado');
    return;
  }
  
  // Carregar estado inicial do config
  const floatingEnabled = currentConfig.floatingWindow?.enabled ?? false;
  toggle.checked = floatingEnabled;
  
  debugLog('🪟 Janela flutuante toggle inicializado:', floatingEnabled);
  
  // Listener para mudanças
  toggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    debugLog('🪟 Toggle janela flutuante:', enabled);
    
    try {
      // Atualizar config via API
      const result = await ipcRenderer.invoke('update-floating-window-config', { enabled });
      
      if (result.success) {
        // Atualizar config local
        if (!currentConfig.floatingWindow) {
          currentConfig.floatingWindow = {};
        }
        currentConfig.floatingWindow.enabled = enabled;
        
        // Mostrar toast
        const message = enabled 
          ? t('floatingWindow.enabled', 'Janela flutuante ativada')
          : t('floatingWindow.disabled', 'Janela flutuante desativada');
        showToast('🪟', message, 'success');
      } else {
        // Reverter toggle em caso de erro
        toggle.checked = !enabled;
        showToast(t('general.error'), result.error || 'Erro ao alterar janela flutuante', 'error');
      }
    } catch (error) {
      console.error('Erro ao alterar janela flutuante:', error);
      toggle.checked = !enabled;
      showToast(t('general.error'), error.message, 'error');
    }
  });
}

// Atalhos de Teclado
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignorar atalhos quando estiver em inputs (exceto Esc)
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) && e.key !== 'Escape') return;
    
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    
    if (isCmdOrCtrl && e.key === 'k') {
      e.preventDefault();
      showQuickSearch();
    } else if (isCmdOrCtrl && e.key === 'p') {
      e.preventDefault();
      toggleProMode();
    } else if (isCmdOrCtrl && e.key === 'l') {
      e.preventDefault();
      toggleLayout();
    } else if (isCmdOrCtrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      zoomIn();
    } else if (isCmdOrCtrl && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      zoomOut();
    } else if (isCmdOrCtrl && e.key === '0') {
      e.preventDefault();
      resetZoom();
    } else if (isCmdOrCtrl && e.key === 'r') {
      e.preventDefault();
      fetchAndUpdateStats();
    } else if (isCmdOrCtrl && e.key === ',') {
      e.preventDefault();
      showConfigPanel();
    } else if (isCmdOrCtrl && e.key === 'e') {
      e.preventDefault();
      showExportModal();
    } else if (isCmdOrCtrl && e.key === 't') {
      e.preventDefault();
      showTimerWidget();
    } else if (e.key === '1' && !isCmdOrCtrl) {
      e.preventDefault();
      toggleCardExpansion('total');
    } else if (e.key === '2' && !isCmdOrCtrl) {
      e.preventDefault();
      toggleCardExpansion('support');
    } else if (e.key === '3' && !isCmdOrCtrl) {
      e.preventDefault();
      toggleCardExpansion('customer');
    } else if (e.key === '4' && !isCmdOrCtrl) {
      e.preventDefault();
      toggleCardExpansion('pending');
    } else if (e.key === '5' && !isCmdOrCtrl) {
      e.preventDefault();
      toggleCardExpansion('inprogress');
    } else if (isCmdOrCtrl && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault();
      ipcRenderer.invoke('toggle-devtools');
    } else if (e.key === 'F12') {
      e.preventDefault();
      ipcRenderer.invoke('toggle-devtools');
    } else if (e.key === 'Escape') {
      if (document.getElementById('quick-search-modal').style.display !== 'none') {
        hideQuickSearch();
      } else if (document.getElementById('search-container')?.style.display !== 'none') {
        hideSearch();
      } else if (document.getElementById('config-panel').style.display !== 'none') {
        hideConfigPanel();
      } else if (document.getElementById('shortcuts-modal').style.display !== 'none') {
        hideShortcutsModal();
      } else if (document.getElementById('ticket-preview-modal').style.display !== 'none') {
        hideTicketPreview();
      } else if (document.getElementById('attachment-preview-modal')?.style.display === 'flex') {
        hideAttachmentPreview();
      } else if (document.getElementById('theme-customizer-modal')?.style.display === 'flex') {
        hideThemeCustomizer();
      } else if (document.getElementById('export-modal')?.style.display === 'flex') {
        hideExportModal();
      } else if (layoutMode === 'super-compact') {
        // Se estiver no modo super compacto, ESC volta para o modo normal
        layoutMode = 'normal';
        const container = document.querySelector('.app-container');
        const header = document.getElementById('header');
        const footer = document.querySelector('.footer');
        const proSection = document.getElementById('pro-mode-section');
        const exitBtn = document.getElementById('super-compact-exit-btn');
        
        container.classList.remove('super-compact-layout');
        container.classList.remove('horizontal-layout');
        if (header) header.style.display = 'flex';
        if (footer) footer.style.display = 'flex';
        if (proSection && isProMode) proSection.style.display = 'block';
        if (exitBtn) exitBtn.style.display = 'none';
        
        // Restaurar tamanho normal
        ipcRenderer.invoke('resize-window', { width: 420, height: 700 });
        
        // Desativar always-on-top ao sair do modo compacto
        ipcRenderer.invoke('set-always-on-top', false);
        
        showToast('Layout', 'Voltou ao modo normal', 'info');
        saveCurrentState();
      } else {
        ipcRenderer.invoke('minimize-window');
      }
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      const cards = ['total', 'support', 'customer', 'pending'];
      const card = document.getElementById(`card-${cards[parseInt(e.key) - 1]}`);
      if (card) card.click();
    }
  });
}

// Menu
function toggleMenu() {
  debugLog('🍔 toggleMenu chamado');
  const menu = document.getElementById('menu-dropdown');
  if (!menu) {
    console.error('❌ Elemento menu-dropdown não encontrado!');
    return;
  }
  
  const isHidden = menu.style.display === 'none' || menu.style.display === '';
  menu.style.display = isHidden ? 'block' : 'none';
  debugLog(`📋 Menu agora está: ${menu.style.display}`);
}

function hideMenu() {
  document.getElementById('menu-dropdown').style.display = 'none';
}

// Notificações
function toggleNotifications() {
  const preview = document.getElementById('notifications-preview');
  preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
  
  if (preview.style.display === 'block') {
    loadNotifications();
  }
}

function viewAllNotifications() {
  // Abrir o Jira na página de notificações
  const baseUrl = currentConfig.jiraUrl || 'https://your-company.atlassian.net';
  const url = `${baseUrl}/secure/ViewProfile.jspa`;
  ipcRenderer.invoke('open-url', url);
  
  // Fechar o preview
  document.getElementById('notifications-preview').style.display = 'none';
}

async function resetNotificationHistory() {
  // Limpar histórico de notificações limpas
  await ipcRenderer.invoke('save-config', { clearedNotifications: [] });
  
  // Recarregar notificações
  await loadNotifications();
  
  showToast(t('notifications.title'), t('notifications.historyReset'), 'success');
}

async function testDesktopNotification() {
  debugLog('🧪 Testando notificação desktop...');
  
  // Usar notificação nativa do macOS via backend
  try {
    const result = await ipcRenderer.invoke('show-notification', 
      '🧪 Jira Monitor - Teste', 
      'Se você está vendo isso, as notificações estão funcionando! ✅'
    );
    
    // Tocar som se habilitado
    if (currentConfig.soundNotifications !== false) {
      playNotificationSound();
    }
    
    showToast(t('general.success'), t('notifications.testSent'), 'success');
    debugLog('✅ Notificação de teste enviada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar notificação:', error);
    showToast(t('general.error'), `${t('notifications.testError')} ${error.message}`, 'error');
  }
}

async function clearAllNotifications() {
  // Marcar todas as notificações atuais como limpas
  if (window.currentNotifications && window.currentNotifications.length > 0) {
    const notificationIds = window.currentNotifications.map(notif => 
      `${notif.ticketKey}-${notif.commentId}`
    );
    
    // Carregar IDs já limpos e adicionar os novos
    const config = await ipcRenderer.invoke('get-config');
    const clearedNotifications = config.clearedNotifications || [];
    const updatedCleared = [...new Set([...clearedNotifications, ...notificationIds])];
    
    // Manter apenas os últimos 100 IDs para não crescer indefinidamente
    const limitedCleared = updatedCleared.slice(-100);
    
    // Salvar no config
    await ipcRenderer.invoke('save-config', { clearedNotifications: limitedCleared });
  }
  
  // Limpar UI
  const body = document.getElementById('notifications-preview-body');
  body.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">Nenhuma notificação recente</p>';
  
  // Limpar badge
  const badge = document.getElementById('notification-badge');
  badge.style.display = 'none';
  badge.textContent = '0';
  
  // Limpar notificações armazenadas
  window.currentNotifications = [];
  internalNotifications = [];
  
  showToast(t('notifications.title'), t('notifications.cleared'), 'success');
}

async function removeNotification(index) {
  if (!window.currentNotifications || !window.currentNotifications[index]) return;
  
  // Marcar esta notificação como limpa
  const notif = window.currentNotifications[index];
  const notifId = `${notif.ticketKey}-${notif.commentId || notif.id || 'unknown'}`;
  
  // Se for notificação interna, remover do array interno
  if (notif.id && notif.id.startsWith('internal-')) {
    const internalIndex = internalNotifications.findIndex(n => n.id === notif.id);
    if (internalIndex !== -1) {
      internalNotifications.splice(internalIndex, 1);
    }
  }
  
  // Carregar IDs já limpos e adicionar este
  const config = await ipcRenderer.invoke('get-config');
  const clearedNotifications = config.clearedNotifications || [];
  const updatedCleared = [...new Set([...clearedNotifications, notifId])];
  
  // Manter apenas os últimos 100 IDs
  const limitedCleared = updatedCleared.slice(-100);
  
  // Salvar no config
  await ipcRenderer.invoke('save-config', { clearedNotifications: limitedCleared });
  
  // Remover notificação do array
  window.currentNotifications.splice(index, 1);
  
  // Reexibir notificações
  displayNotifications(window.currentNotifications);
  
  // Se não houver mais notificações, esconder badge
  if (window.currentNotifications.length === 0) {
    const badge = document.getElementById('notification-badge');
    badge.style.display = 'none';
  }
}

// Docs Dropdown
function toggleDocsDropdown() {
  const dropdown = document.getElementById('docs-dropdown');
  const isVisible = dropdown.style.display === 'block';
  
  // Fechar outros dropdowns/menus
  hideMenu();
  document.getElementById('notifications-preview').style.display = 'none';
  
  dropdown.style.display = isVisible ? 'none' : 'block';
}

function hideDocsDropdown() {
  document.getElementById('docs-dropdown').style.display = 'none';
}

// User Monitor Dropdown
function toggleUserMonitorDropdown() {
  const dropdown = document.getElementById('user-monitor-dropdown');
  const isVisible = dropdown.style.display === 'block';
  
  // Fechar outros dropdowns/menus
  hideMenu();
  document.getElementById('notifications-preview').style.display = 'none';
  document.getElementById('docs-dropdown').style.display = 'none';
  
  if (!isVisible) {
    updateUserListDropdown();
  }
  
  dropdown.style.display = isVisible ? 'none' : 'block';
}

function hideUserMonitorDropdown() {
  document.getElementById('user-monitor-dropdown').style.display = 'none';
}

// Add User Modal
function showAddUserModal() {
  document.getElementById('add-user-modal').style.display = 'flex';
  document.getElementById('new-user-email-input').value = '';
  document.getElementById('new-user-email-input').focus();
  hideUserMonitorDropdown();
}

function hideAddUserModal() {
  document.getElementById('add-user-modal').style.display = 'none';
}

async function confirmAddUser() {
  const input = document.getElementById('new-user-email-input');
  const email = input.value.trim();
  
  if (!email) {
    showToast(t('general.warning'), t('addUser.invalidEmail'), 'warning');
    return;
  }
  
  // Validar formato de email básico
  if (!email.includes('@')) {
    showToast(t('general.error'), t('addUser.invalidEmailShort'), 'error');
    return;
  }
  
  hideAddUserModal();
  await switchMonitoredUser(email);
}

async function loadNotifications() {
  try {
    debugLog('🔔 Carregando notificações para:', {
      monitorOtherUser: currentConfig.monitorOtherUser,
      otherUserEmail: currentConfig.otherUserEmail,
      jiraEmail: currentConfig.jiraEmail
    });
    
    debugLog('🔔 Notificações internas existentes:', internalNotifications.length, internalNotifications);
    
    const result = await ipcRenderer.invoke('get-recent-notifications', 15);
    let jiraNotifications = [];
    
    if (result && result.success) {
      jiraNotifications = result.data || [];
      debugLog('✅ Notificações do Jira:', jiraNotifications.length);
    } else {
      debugLog('⚠️ Erro ao buscar notificações do Jira:', result?.error);
    }
    
    // Carregar notificações limpas do config
    const config = await ipcRenderer.invoke('get-config');
    const clearedNotifications = config.clearedNotifications || [];
    
    // Filtrar notificações do Jira que já foram limpas
    const filteredJiraNotifications = jiraNotifications.filter(notif => {
      const notifId = `${notif.ticketKey}-${notif.commentId || notif.id}`;
      return !clearedNotifications.includes(notifId);
    });
    
    // Filtrar notificações internas que já foram limpas
    const filteredInternalNotifications = internalNotifications.filter(notif => {
      const notifId = `${notif.ticketKey}-${notif.commentId || notif.id}`;
      return !clearedNotifications.includes(notifId);
    });
    
    // Combinar: internas primeiro, depois do Jira
    const allNotifications = [...filteredInternalNotifications, ...filteredJiraNotifications];
    
    debugLog('✅ Total notificações:', allNotifications.length, 
      '(Internas:', filteredInternalNotifications.length, 
      ', Jira:', filteredJiraNotifications.length, ')');
    
    displayNotifications(allNotifications);
  } catch (error) {
    console.error('Erro ao carregar notificações:', error);
  }
}

// Adicionar notificação interna ao sino
function addInternalNotification(ticket, changeType, changeDescription) {
  const timestamp = Date.now();
  const notif = {
    id: `internal-${ticket.key}-${changeType}-${timestamp}`,
    ticketKey: ticket.key,
    ticketSummary: ticket.summary || ticket.fields?.summary || 'Sem título',
    priority: ticket.priority || ticket.fields?.priority?.name || 'Medium',
    type: changeType,
    author: 'Sistema',
    created: new Date().toISOString(),
    body: changeDescription,
    isInternal: false,
    commentId: `internal-${timestamp}`
  };
  
  // Verificar se já existe uma notificação similar (mesmo ticket, tipo e descrição nos últimos 5 minutos)
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  const exists = internalNotifications.some(n => 
    n.ticketKey === ticket.key && 
    n.type === changeType &&
    n.body === changeDescription &&
    new Date(n.created).getTime() > fiveMinutesAgo
  );
  
  if (exists) {
    debugLog('⚠️ Notificação duplicada ignorada:', notif);
    return;
  }
  
  // Adicionar no início do array (mais recente primeiro)
  internalNotifications.unshift(notif);
  
  // Manter apenas as últimas 20 notificações internas
  internalNotifications = internalNotifications.slice(0, 20);
  
  // Atualizar o sino
  updateNotificationBadge();
  
  debugLog('🔔 Notificação interna adicionada:', notif);
}

// Atualizar badge do sino
function updateNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  const totalNotifications = internalNotifications.length;
  
  if (totalNotifications > 0) {
    badge.textContent = totalNotifications;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function displayNotifications(notifications) {
  const body = document.getElementById('notifications-preview-body');
  const badge = document.getElementById('notification-badge');
  
  if (notifications.length === 0) {
    body.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">Nenhuma notificação recente</p>';
    badge.style.display = 'none';
    return;
  }
  
  // Atualizar badge
  badge.textContent = notifications.length;
  badge.style.display = 'inline-flex';
  
  body.innerHTML = notifications.map((notif, index) => {
    // Determinar ícone baseado no tipo
    let typeIcon = '📝 Comentário';
    let typeClass = 'comment';
    
    if (notif.type === 'mention') {
      typeIcon = '💬 Menção';
      typeClass = 'mention';
    } else if (notif.type === 'new') {
      typeIcon = '🎫 Novo';
      typeClass = 'new';
    } else if (notif.type === 'status') {
      typeIcon = '🔄 Status';
      typeClass = 'status';
    } else if (notif.type === 'reassigned') {
      typeIcon = '👤 Reatribuído';
      typeClass = 'reassigned';
    }
    
    return `
      <div class="notification-item" data-notification-index="${index}" data-type="${typeClass}">
        <button class="notification-close-btn" onclick="event.stopPropagation(); removeNotification(${index})" title="Remover notificação">✕</button>
        <div class="notification-content" onclick="openTicketPreview('${notif.ticketKey}')">
          <div class="notification-header">
            <span class="notification-ticket-key">${notif.ticketKey}</span>
            <span class="notification-time">${getTimeAgo(notif.created)}</span>
          </div>
          <div class="notification-summary">${notif.ticketSummary}</div>
          <div class="notification-body">${notif.body}</div>
          <div class="notification-badges">
            <span class="notification-badge-item ${typeClass}">${typeIcon}</span>
            ${notif.isInternal ? '<span class="notification-badge-item">🔒 Interno</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Armazenar notificações para poder remover individualmente
  window.currentNotifications = notifications;
}

function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return t('time.now', 'now');
  if (seconds < 3600) return t('time.minutesAgo', '{time} minutes ago').replace('{time}', Math.floor(seconds / 60));
  if (seconds < 86400) return t('time.hoursAgo', '{time} hours ago').replace('{time}', Math.floor(seconds / 3600));
  return t('time.daysAgo', '{time} days ago').replace('{time}', Math.floor(seconds / 86400));
}

// ===================================
// Badge Tickets Modal
// ===================================

function showBadgeTickets(type) {
  const tickets = type === 'sla' ? window.slaTicketsList : window.oldTicketsList;
  
  if (!tickets || tickets.length === 0) {
    return;
  }
  
  const title = type === 'sla' 
    ? t('badge.slaTitle', '⏰ Tickets with SLA Alert (expiring in 30 minutes)')
    : t('badge.oldTitle', '📅 Old Tickets (no update for 7+ days)');
  
  const modalHtml = `
    <div class="badge-modal-overlay" id="badge-modal-overlay" onclick="closeBadgeModal()">
      <div class="badge-modal" onclick="event.stopPropagation()">
        <div class="badge-modal-header">
          <h3>${title}</h3>
          <button class="badge-modal-close" onclick="closeBadgeModal()">✕</button>
        </div>
        <div class="badge-modal-body">
          ${tickets.map(ticket => {
            let timeInfo, timeClass, urgencyIcon;
            
            if (type === 'sla') {
              const slaInfo = getSlaInfo(ticket.fields.duedate);
              timeInfo = slaInfo.text;
              timeClass = slaInfo.class;
              urgencyIcon = slaInfo.icon;
            } else {
              timeInfo = `${t('time.lastUpdate', 'Last update')}: ${getTimeAgo(ticket.fields.updated)}`;
              timeClass = 'old';
              urgencyIcon = '📅';
            }
            
            return `
              <div class="badge-ticket-item" data-ticket-key="${ticket.key}" onclick="openTicketPreview('${ticket.key}'); closeBadgeModal();">
                <div class="badge-ticket-header">
                  <span class="badge-ticket-key">${ticket.key}</span>
                  <span class="badge-ticket-status">${ticket.fields.status.name}</span>
                </div>
                <div class="badge-ticket-summary">${ticket.fields.summary}</div>
                <div class="badge-ticket-time ${timeClass}">${urgencyIcon} ${timeInfo}</div>
                <div class="badge-ticket-actions">
                  <button class="badge-ticket-btn" onclick="event.stopPropagation(); navigator.clipboard.writeText('${ticket.key}'); showToast('Key copiada!');" title="Copiar key">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                  </button>
                  <button class="badge-ticket-btn" onclick="event.stopPropagation(); ipcRenderer.invoke('open-url', 'https://your-company.atlassian.net/browse/${ticket.key}');" title="Abrir no Jira">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                    </svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  // Remover modal anterior se existir
  const existingModal = document.getElementById('badge-modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Adicionar novo modal
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function getSlaInfo(dueDateString) {
  if (!dueDateString) return { text: 'Sem data', class: 'unknown', icon: '❓' };
  
  const dueDate = new Date(dueDateString);
  const now = new Date();
  const diffMs = dueDate - now;
  const diffMinutes = Math.floor(diffMs / 60000);
  
  // Thresholds:
  // 🔴 overdue: < 0 (estourado)
  // 🟡 warning: ≤ 30 min
  // 🟢 safe: > 30 min
  
  if (diffMinutes < 0) {
    return {
      text: `SLA ESTOURADO (atrasado ${Math.abs(diffMinutes)} min)`,
      class: 'overdue',
      icon: '🔴'
    };
  }
  
  if (diffMinutes <= 30) {
    return {
      text: `ATENÇÃO: Vence em ${diffMinutes} minutos`,
      class: 'warning',
      icon: '🟡'
    };
  }
  
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  
  return {
    text: `Vence em ${diffHours}h ${remainingMinutes}min`,
    class: 'safe',
    icon: '🟢'
  };
}

function closeBadgeModal() {
  const modal = document.getElementById('badge-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

function formatDueDate(dueDateString) {
  if (!dueDateString) return 'Sem data';
  
  const dueDate = new Date(dueDateString);
  const now = new Date();
  const diffMs = dueDate - now;
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes < 0) {
    return `⚠️ Atrasado`;
  }
  
  if (diffMinutes < 60) {
    return `${diffMinutes} minutos`;
  }
  
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  
  if (diffHours < 1) {
    return `${diffMinutes} minutos`;
  }
  
  return `${diffHours}h ${remainingMinutes}min`;
}

// Busca Rápida
function toggleSearch() {
  const container = document.getElementById('search-container');
  if (container.style.display === 'none') {
    container.style.display = 'block';
    document.getElementById('search-input').focus();
  } else {
    hideSearch();
  }
}

function hideSearch() {
  document.getElementById('search-container').style.display = 'none';
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
}

function performSearch() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const resultsContainer = document.getElementById('search-results');
  
  if (!query || searchTickets.length === 0) {
    resultsContainer.innerHTML = '';
    return;
  }
  
  const results = searchTickets.filter(ticket => 
    ticket.key.toLowerCase().includes(query) ||
    ticket.fields.summary.toLowerCase().includes(query) ||
    ticket.fields.status.name.toLowerCase().includes(query)
  );
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div style="padding: 12px; color: #666; text-align: center;">Nenhum ticket encontrado</div>';
    return;
  }
  
  resultsContainer.innerHTML = results.slice(0, 10).map(ticket => `
    <div class="search-result-item" onclick="openTicketInJira('${ticket.key}')">
      <div class="search-result-key">${ticket.key}</div>
      <div class="search-result-summary">${ticket.fields.summary}</div>
      <div class="search-result-status">${ticket.fields.status.name}</div>
    </div>
  `).join('');
}

// Modal de Atalhos
function showShortcutsModal() {
  document.getElementById('shortcuts-modal').style.display = 'flex';
}

function hideShortcutsModal() {
  document.getElementById('shortcuts-modal').style.display = 'none';
}

// Config Panel
function showConfigPanel(showWelcome = false) {
  console.log('🔧 showConfigPanel() chamado, showWelcome:', showWelcome);
  
  const configPanel = document.getElementById('config-panel');
  if (!configPanel) {
    console.error('❌ config-panel não encontrado!');
    return;
  }
  
  configPanel.style.display = 'flex';
  console.log('✅ config-panel exibido');
  
  // Mostrar mensagem de boas-vindas apenas se for primeira vez
  const welcomeMsg = document.getElementById('welcome-message');
  if (welcomeMsg) {
    welcomeMsg.style.display = showWelcome ? 'block' : 'none';
    console.log('👋 Mensagem de boas-vindas:', showWelcome ? 'EXIBIDA' : 'ocultada');
  }
  
  // Definir idioma correto no seletor
  const configLanguageSelect = document.getElementById('config-language-select');
  if (configLanguageSelect) {
    configLanguageSelect.value = currentLanguage || 'pt-BR';
    console.log('🌍 Idioma no seletor:', configLanguageSelect.value);
  }
  
  // Destacar visualmente o seletor de idioma se for primeira vez
  const languageSelectorConfig = document.getElementById('language-selector-config');
  if (languageSelectorConfig && showWelcome) {
    languageSelectorConfig.style.animation = 'pulse 2s ease-in-out 3';
    console.log('✨ Animação pulse aplicada ao seletor de idioma');
  }
}

function hideConfigPanel() {
  document.getElementById('config-panel').style.display = 'none';
}

function togglePasswordVisibility() {
  const input = document.getElementById('jira-api-token');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// Layout - Ciclo entre 3 modos: normal -> horizontal -> super-compact -> normal
function toggleLayout() {
  const container = document.querySelector('.app-container');
  const header = document.getElementById('header');
  const footer = document.querySelector('.footer');
  const proSection = document.getElementById('pro-mode-section');
  const exitBtn = document.getElementById('super-compact-exit-btn');
  
  // Ciclo: normal -> horizontal -> super-compact -> normal
  if (layoutMode === 'normal') {
    layoutMode = 'horizontal';
    container.classList.add('horizontal-layout');
    container.classList.remove('super-compact-layout');
    if (exitBtn) exitBtn.style.display = 'none';
    showToast('Layout', t('layout.horizontal'), 'info');
  } else if (layoutMode === 'horizontal') {
    layoutMode = 'super-compact';
    container.classList.remove('horizontal-layout');
    container.classList.add('super-compact-layout');
    // No modo super compacto, esconder header e footer para economizar espaço
    if (header) header.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (proSection) proSection.style.display = 'none';
    if (exitBtn) exitBtn.style.display = 'none'; // Não mostrar mais o botão flutuante
    
    // Redimensionar janela para 192x72
    ipcRenderer.invoke('resize-window', { width: 192, height: 72 });
    
    // Ativar always-on-top para janela ficar sempre visível
    ipcRenderer.invoke('set-always-on-top', true);
    
    showToast('Layout', t('layout.superCompact'), 'info');
  } else {
    layoutMode = 'normal';
    container.classList.remove('horizontal-layout');
    container.classList.remove('super-compact-layout');
    // Restaurar header e footer
    if (header) header.style.display = 'flex';
    if (footer) footer.style.display = 'flex';
    if (proSection && isProMode) proSection.style.display = 'block';
    if (exitBtn) exitBtn.style.display = 'none';
    
    // Restaurar tamanho normal da janela
    ipcRenderer.invoke('resize-window', { width: 420, height: 700 });
    
    // Desativar always-on-top ao voltar ao modo normal
    ipcRenderer.invoke('set-always-on-top', false);
    
    showToast('Layout', t('layout.normal'), 'info');
  }
  
  // Atualizar flag legado
  isHorizontalLayout = (layoutMode === 'horizontal');
  
  // Salvar preferência
  saveCurrentState();
}

// Zoom
let currentZoom = 1.0;
const zoomLevels = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];
let currentZoomIndex = 5; // Começa em 1.0 (100%)

function zoomIn() {
  if (currentZoomIndex < zoomLevels.length - 1) {
    currentZoomIndex++;
    applyZoom();
  }
}

function zoomOut() {
  if (currentZoomIndex > 0) {
    currentZoomIndex--;
    applyZoom();
  }
}

function resetZoom() {
  currentZoomIndex = 5; // Reset para 100%
  applyZoom();
}

function applyZoom() {
  currentZoom = zoomLevels[currentZoomIndex];
  
  // Usar webFrame do Electron - forma nativa que NÃO interfere com redimensionamento
  if (webFrame) {
    webFrame.setZoomFactor(currentZoom);
  }
  
  // Feedback visual
  showZoomIndicator();
}

function showZoomIndicator() {
  // Remove indicador anterior se existir
  const existingIndicator = document.getElementById('zoom-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  // Criar novo indicador
  const indicator = document.createElement('div');
  indicator.id = 'zoom-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(20, 20, 30, 0.95);
    backdrop-filter: blur(10px);
    color: white;
    padding: 20px 40px;
    border-radius: 16px;
    font-size: 32px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(102, 126, 234, 0.5);
    pointer-events: none;
    animation: zoomFadeIn 0.2s ease-out;
  `;
  indicator.textContent = `${Math.round(currentZoom * 100)}%`;
  
  // Adicionar animação
  const style = document.createElement('style');
  style.textContent = `
    @keyframes zoomFadeIn {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }
    @keyframes zoomFadeOut {
      from {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      to {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(indicator);
  
  // Remover após 1 segundo
  setTimeout(() => {
    indicator.style.animation = 'zoomFadeOut 0.2s ease-out';
    setTimeout(() => indicator.remove(), 200);
  }, 800);
}

// Salvar configurações atuais automaticamente (sem UI)
async function saveCurrentState() {
  try {
    const stateToSave = {
      ...currentConfig,
      proMode: isProMode,
      layoutMode: layoutMode, // Novo: salvar modo de layout
      isHorizontalLayout: isHorizontalLayout, // Manter compatibilidade
      windowOpacity: windowOpacity,
      focusMode: isFocusMode,
      densityMode: densityMode,
      zoomLevel: zoomLevels[currentZoomIndex], // Salvar nível de zoom
      dailyActivity: dailyActivity, // Salvar atividade diária
      dailyActivityWidgetClosed: dailyActivityWidgetClosed, // Salvar se foi fechado manualmente
      dailyActivityLastValues: dailyActivityLastValues // Salvar valores quando foi fechado
    };
    
    await ipcRenderer.invoke('save-config', stateToSave);
    debugLog('💾 Estado salvo automaticamente:', {
      proMode: stateToSave.proMode,
      layoutMode: stateToSave.layoutMode,
      focusMode: stateToSave.focusMode,
      windowOpacity: stateToSave.windowOpacity,
      dailyActivity: stateToSave.dailyActivity
    });
  } catch (error) {
    console.error('❌ Erro ao salvar estado:', error);
  }
}

// Modo Pro
async function toggleProMode() {
  isProMode = !isProMode;
  currentConfig.proMode = isProMode;
  await saveCurrentState(); // Salvar automaticamente
  debugLog('💾 Modo Pro alterado e salvo:', isProMode);
  updateProModeUI();
}

function updateProModeUI() {
  debugLog('🎨 updateProModeUI chamada, isProMode:', isProMode);
  const proSection = document.getElementById('pro-mode-section');
  proSection.style.display = isProMode ? 'block' : 'none';
  
  // Atualizar botão PRO no menu
  const menuProBtn = document.getElementById('menu-pro');
  if (isProMode) {
    menuProBtn.style.color = '#667eea';
    menuProBtn.style.fontWeight = '600';
    
    // Configurar drag-and-drop e edição para botões customizáveis
    setupCustomButtonsFunctionality();
    
    // Atualizar indicador de usuário no Modo Pro
    updateProModeUserIndicator();
    
    // ✨ v1.5.0 - Iniciar novas funcionalidades
    // Carregar Dashboard de Performance
    if (typeof loadPerformanceDashboard === 'function') {
      loadPerformanceDashboard(30);
    }
    
    debugLog('✅ Funcionalidades v1.5.0 ativadas (Dashboard)');
  } else {
    menuProBtn.style.color = 'white';
    menuProBtn.style.fontWeight = 'normal';
  }
}

// Atualizar indicador de usuário no Modo Pro
function updateProModeUserIndicator() {
  const indicator = document.getElementById('pro-mode-user-indicator');
  const nameSpan = document.getElementById('pro-mode-user-name');
  
  if (!indicator || !nameSpan) return;
  
  if (currentConfig.monitorOtherUser && currentConfig.otherUserEmail) {
    const email = currentConfig.otherUserEmail;
    const displayName = email.split('@')[0].split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
    
    nameSpan.textContent = `Dados de: ${displayName}`;
    indicator.style.display = 'flex';
  } else {
    indicator.style.display = 'none';
  }
}

// ===================================
// Atividade Diária (Modo Pro)
// ===================================

// Resetar contadores à meia-noite
function checkDailyReset() {
  const today = new Date().toDateString();
  if (dailyActivity.lastReset !== today) {
    debugLog('🔄 Resetando contadores de atividade diária...');
    dailyActivity = {
      received: 0,
      resolved: 0,
      commented: 0,
      statusChanged: 0,
      lastReset: today,
      receivedTickets: [],
      resolvedTickets: [],
      commentedTickets: []
    };
    updateDailyActivityDisplay();
    updateDailyActivityDetails();
  }
}

// Atualizar display dos cards de atividade
function updateDailyActivityDisplay() {
  const receivedEl = document.getElementById('activity-received');
  const resolvedEl = document.getElementById('activity-resolved');
  const commentedEl = document.getElementById('activity-commented');
  
  if (receivedEl) receivedEl.textContent = dailyActivity.received;
  if (resolvedEl) resolvedEl.textContent = dailyActivity.resolved;
  if (commentedEl) commentedEl.textContent = dailyActivity.commented;
  
  // Manter o widget compacto em sincronia com os cards
  updateDailyActivityUI();
}

// Calcular atividade do dia baseada nos tickets atuais
function calculateDailyActivityFromTickets(allTickets) {
  if (!allTickets || allTickets.length === 0) {
    debugLog('⚠️ Nenhum ticket para calcular atividade');
    return;
  }
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  // Fallback: últimas 24h se não houver atividade hoje
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  debugLog('📊 Calculando atividade do dia a partir dos tickets...');
  debugLog('📊 Total de tickets:', allTickets.length);
  debugLog('📊 Início do dia:', startOfDay.toISOString());
  
  let todayCount = 0;
  let last24hCount = 0;
  
  allTickets.forEach(ticket => {
    const createdDate = ticket.fields?.created ? new Date(ticket.fields.created) : null;
    const updatedDate = ticket.fields?.updated ? new Date(ticket.fields.updated) : null;
    const resolutionDate = ticket.fields?.resolutiondate ? new Date(ticket.fields.resolutiondate) : null;
    const status = ticket.fields?.status?.name || '';
    
    // Tickets recebidos hoje (criados hoje)
    if (createdDate && createdDate >= startOfDay) {
      todayCount++;
      trackNewTicketReceived({
        key: ticket.key,
        summary: ticket.fields?.summary || ticket.key
      });
    } 
    // Fallback: tickets das últimas 24h
    else if (createdDate && createdDate >= last24h && dailyActivity.received === 0) {
      last24hCount++;
      trackNewTicketReceived({
        key: ticket.key,
        summary: ticket.fields?.summary || ticket.key
      });
    }
    
    // Tickets fechados hoje (resolvidos hoje)
    const closedStatuses = ['Fechado', 'Closed', 'Resolvido', 'Resolved', 'Concluído', 'Concluido', 'Done'];
    if (closedStatuses.includes(status)) {
      if (resolutionDate && resolutionDate >= startOfDay) {
        trackTicketResolved({
          key: ticket.key,
          summary: ticket.fields?.summary || ticket.key
        });
      }
      // Fallback: se foi atualizado hoje e está fechado
      else if (updatedDate && updatedDate >= startOfDay && dailyActivity.resolved === 0) {
        trackTicketResolved({
          key: ticket.key,
          summary: ticket.fields?.summary || ticket.key
        });
      }
    }
  });
  
  debugLog('📊 Atividade calculada:', {
    recebidos: dailyActivity.received,
    fechados: dailyActivity.resolved,
    comentarios: dailyActivity.commented,
    todayCount: todayCount,
    last24hCount: last24hCount
  });
  
  // Se ainda estiver zerado, mostrar mensagem
  if (dailyActivity.received === 0 && dailyActivity.resolved === 0) {
    debugLog('ℹ️ Nenhuma atividade detectada hoje. Aguarde novos tickets ou interações.');
  }
}

// Rastrear novos tickets recebidos hoje
function trackNewTicketReceived(ticket) {
  if (!ticket) return;
  
  // Garantir que o array existe
  if (!dailyActivity.receivedTickets) {
    dailyActivity.receivedTickets = [];
  }
  
  // Evitar duplicatas
  if (!dailyActivity.receivedTickets.find(t => t.key === ticket.key)) {
    dailyActivity.received++;
    dailyActivity.receivedTickets.push({
      key: ticket.key,
      summary: ticket.summary,
      time: new Date().toISOString()
    });
    updateDailyActivityDisplay();
    updateDailyActivityDetails();
    debugLog('📥 Ticket recebido hoje:', ticket.key);
  }
}

// Rastrear ticket resolvido/fechado hoje
function trackTicketResolved(ticket) {
  if (!ticket) return;
  
  // Garantir que o array existe
  if (!dailyActivity.resolvedTickets) {
    dailyActivity.resolvedTickets = [];
  }
  
  // Evitar duplicatas
  if (!dailyActivity.resolvedTickets.find(t => t.key === ticket.key)) {
    dailyActivity.resolved++;
    dailyActivity.resolvedTickets.push({
      key: ticket.key,
      summary: ticket.summary,
      time: new Date().toISOString()
    });
    updateDailyActivityDisplay();
    updateDailyActivityDetails();
    debugLog('✅ Ticket resolvido hoje:', ticket.key);
  }
}

// Rastrear comentário adicionado hoje
function trackCommentAdded(ticketKey, ticketSummary) {
  if (!ticketKey) return;
  
  // Garantir que o array existe
  if (!dailyActivity.commentedTickets) {
    dailyActivity.commentedTickets = [];
  }
  
  dailyActivity.commented++;
  dailyActivity.commentedTickets.push({
    key: ticketKey,
    summary: ticketSummary || ticketKey,
    time: new Date().toISOString()
  });
  updateDailyActivityDisplay();
  updateDailyActivityDetails();
  debugLog('💬 Comentário adicionado hoje:', ticketKey);
}

// Atualizar listas de detalhes
function updateDailyActivityDetails() {
  // Garantir que os arrays existem antes de atualizar
  if (!dailyActivity.receivedTickets) dailyActivity.receivedTickets = [];
  if (!dailyActivity.resolvedTickets) dailyActivity.resolvedTickets = [];
  if (!dailyActivity.commentedTickets) dailyActivity.commentedTickets = [];
  
  updateActivityList('received', dailyActivity.receivedTickets);
  updateActivityList('resolved', dailyActivity.resolvedTickets);
  updateActivityList('commented', dailyActivity.commentedTickets);
}

function updateActivityList(type, tickets) {
  const listEl = document.getElementById(`activity-${type}-list`);
  if (!listEl) return;
  
  // Garantir que tickets é um array válido
  if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
    const typeLabels = {
      received: 'Nenhum ticket recebido hoje',
      resolved: 'Nenhum ticket fechado hoje',
      commented: 'Nenhum comentário hoje'
    };
    listEl.innerHTML = `<p class="no-activity-msg">${typeLabels[type]}</p>`;
  } else {
    listEl.innerHTML = tickets.map(ticket => `
      <div class="activity-detail-item ${type}" onclick="openTicketPreview('${ticket.key}')">
        <div>
          <span class="item-key">${ticket.key}</span>
          <span class="item-summary">${ticket.summary}</span>
        </div>
        <div class="item-time">${getTimeAgo(ticket.time)}</div>
      </div>
    `).join('');
  }
}

// Expandir/colapsar detalhes de atividade
function toggleActivityDetails(type) {
  const detailsEl = document.getElementById('daily-activity-details');
  const expandBtn = document.getElementById('expand-daily-activity');
  
  if (detailsEl.style.display === 'none') {
    detailsEl.style.display = 'block';
    if (expandBtn) expandBtn.classList.add('expanded');
  }
  
  // Scroll suave para a seção correspondente
  setTimeout(() => {
    const section = document.querySelector(`#activity-${type}-list`).closest('.activity-detail-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
}

// Configurar funcionalidades dos botões customizáveis
function setupCustomButtonsFunctionality() {
  // Configurar para cada container de botões
  const containers = [
    'sim-cards-buttons-container',
    'project-stats' // Container único para todos os projetos (IT, DCI, GTC)
  ];
  
  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      setupDragAndDropForContainer(container);
      setupEditableButtons(container);
    }
  });
  
  debugLog('✅ Funcionalidades de drag-and-drop e edição configuradas');
}

// Fetch Stats
// Verificar menções ao usuário
async function checkForMentions() {
  try {
    debugLog('📢 Verificando menções...');
    
    const result = await ipcRenderer.invoke('fetch-mentions');
    
    if (!result.success) {
      console.error('❌ Erro ao buscar menções:', result.error);
      return;
    }
    
    const mentions = result.data.issues || [];
    debugLog('📢 Menções encontradas:', mentions.length);
    
    // Verificar novas menções
    const newMentions = mentions.filter(mention => {
      const mentionKey = `${mention.key}-${mention.latestMentionComment.id}`;
      const lastCheck = lastMentionsCheck[mentionKey];
      
      // É nova se nunca foi verificada ou se o comentário é mais recente
      if (!lastCheck) return true;
      
      const mentionTime = new Date(mention.mentionedAt).getTime();
      return mentionTime > lastCheck;
    });
    
    debugLog('📢 Novas menções:', newMentions.length);
    
    if (newMentions.length > 0) {
      // Atualizar registro de menções verificadas
      newMentions.forEach(mention => {
        const mentionKey = `${mention.key}-${mention.latestMentionComment.id}`;
        lastMentionsCheck[mentionKey] = new Date(mention.mentionedAt).getTime();
      });
      
      // Criar notificações
      newMentions.forEach(mention => {
        const comment = mention.latestMentionComment;
        const author = comment.author?.displayName || 'Alguém';
        
        // Notificação no sino
        addInternalNotification(
          {
            key: mention.key,
            summary: mention.fields.summary,
            fields: mention.fields
          },
          'mention',
          `${author} mencionou você em um comentário`
        );
        
        // Notificação desktop (se habilitada e se notificações de menção estão ativas)
        if (currentConfig.desktopNotifications && 
            currentConfig.notifyMentions !== false && 
            Notification.permission === 'granted') {
          const notification = new Notification(`📢 Você foi mencionado - ${mention.key}`, {
            body: `${author}: ${mention.fields.summary}`,
            icon: 'https://your-company.atlassian.net/favicon.ico',
            tag: `mention-${mention.key}-${comment.id}`,
            requireInteraction: false
          });
          
          notification.onclick = () => {
            openTicketPreview(mention.key);
            notification.close();
          };
          
          if (currentConfig.soundNotifications) {
            playNotificationSound();
          }
        }
      });
      
      updateNotificationBadge();
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar menções:', error);
  }
}

async function fetchAndUpdateStats() {
  try {
    showLoading();
    updateConnectionStatus('loading');
    hideErrorBanner();
    
    // Adicionar spinner no botão de refresh
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.classList.add('loading');
    
    // Verificar se precisa resetar contadores diários
    checkDailyReset();
    
    debugLog('🚀 === INICIANDO FETCH DE STATS ===');
    const otherUserEmail = currentConfig.monitorOtherUser ? currentConfig.otherUserEmail : null;
    debugLog('👤 Monitorando:', otherUserEmail || 'você (currentUser)');
    const result = await ipcRenderer.invoke('fetch-jira-stats', otherUserEmail);
    
    if (result.success) {
      debugLog('📊 Dados recebidos do Jira:', {
        total: result.data.total,
        waitingForSupport: result.data.waitingForSupport,
        waitingForCustomer: result.data.waitingForCustomer,
        pending: result.data.pending
      });
      
      // Usar dados específicos de atividade diária do backend
      if (result.data.todayReceived || result.data.todayResolved || result.data.todayComments) {
        debugLog('📊 Atualizando atividade diária com dados do Jira...');
        
        // Limpar e recalcular atividade do dia
        dailyActivity.received = 0;
        dailyActivity.resolved = 0;
        dailyActivity.commented = 0;
        dailyActivity.receivedTickets = [];
        dailyActivity.resolvedTickets = [];
        dailyActivity.commentedTickets = [];
        
        // Tickets recebidos hoje
        if (result.data.todayReceived && result.data.todayReceived.length > 0) {
          result.data.todayReceived.forEach(ticket => {
            trackNewTicketReceived({
              key: ticket.key,
              summary: ticket.fields?.summary || ticket.key
            });
          });
        }
        
        // Tickets fechados hoje
        if (result.data.todayResolved && result.data.todayResolved.length > 0) {
          result.data.todayResolved.forEach(ticket => {
            trackTicketResolved({
              key: ticket.key,
              summary: ticket.fields?.summary || ticket.key
            });
          });
        }
        
        // Comentários feitos hoje
        if (result.data.todayComments && result.data.todayComments.length > 0) {
          dailyActivity.commented = result.data.todayComments.length;
          dailyActivity.commentedTickets = result.data.todayComments.map(comment => ({
            key: comment.ticketKey,
            summary: comment.ticketSummary,
            time: comment.commentCreated
          }));
          debugLog(`✅ ${dailyActivity.commented} comentários detectados hoje`);
        } else {
          debugLog('⚠️ Nenhum comentário detectado hoje');
        }
        
        debugLog('📊 Atividade diária atualizada:', {
          recebidos: dailyActivity.received,
          fechados: dailyActivity.resolved,
          comentarios: dailyActivity.commented
        });
      }
      
      // 🔥 ATUALIZAÇÃO ATÔMICA: Atualizar TUDO de uma vez para evitar estados intermediários
      debugLog('💾 Salvando stats globalmente...');
      currentStats = result.data;
      searchTickets = result.data.allTickets || [];
      
      debugLog('🎨 Chamando updateUI() com dados finais...');
      updateUI(result.data);
      
      debugLog('📋 Atualizando listas expandidas...');
      updateExpandedTicketsLists();
      
      // Atualizar display de atividade diária
      updateDailyActivityDisplay();
      
      // Atualizar status de sucesso
      updateConnectionStatus('online');
      lastUpdateTime = new Date();
      updateLastUpdateTime();
      startProgressBar();
    } else {
      showError(result.error);
      updateConnectionStatus('offline');
      showErrorBanner('Erro ao buscar dados', result.error);
    }
    
    refreshBtn.classList.remove('loading');
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    showError(error.message);
    updateConnectionStatus('offline');
    showErrorBanner('Erro de Conexão', 'Não foi possível conectar ao Jira. Verifique sua conexão e credenciais.');
    
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.classList.remove('loading');
  } finally {
    hideLoading();
  }
}

// ===================================
// 🔔 MENU BAR / TRAY - FOCAR TICKET
// ===================================

// Focar e destacar um ticket específico na UI
function focusAndHighlightTicket(ticketKey) {
  debugLog(`🎯 Focando no ticket: ${ticketKey}`);
  
  // Procurar o ticket em todas as listas expandidas
  const ticketElements = document.querySelectorAll('[data-ticket-key]');
  let targetElement = null;
  
  for (const element of ticketElements) {
    if (element.dataset.ticketKey === ticketKey) {
      targetElement = element;
      break;
    }
  }
  
  if (!targetElement) {
    console.warn(`⚠️ Ticket ${ticketKey} não encontrado na UI`);
    // Tentar expandir listas se estiverem fechadas
    expandAllTicketLists();
    
    // Tentar novamente após um delay
    setTimeout(() => {
      const retryElement = document.querySelector(`[data-ticket-key="${ticketKey}"]`);
      if (retryElement) {
        scrollAndHighlight(retryElement);
      } else {
        console.warn(`⚠️ Ticket ${ticketKey} ainda não encontrado após expandir listas`);
      }
    }, 500);
    return;
  }
  
  scrollAndHighlight(targetElement);
}

// Fazer scroll suave e destacar elemento
function scrollAndHighlight(element) {
  // Scroll suave até o elemento
  element.scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center'
  });
  
  // Adicionar classe de destaque temporariamente
  element.classList.add('ticket-highlight');
  
  // Criar efeito de pulso
  element.style.animation = 'ticketPulse 1s ease-in-out 2';
  
  // Remover destaque após 3 segundos
  setTimeout(() => {
    element.classList.remove('ticket-highlight');
    element.style.animation = '';
  }, 3000);
  
  debugLog('✨ Ticket destacado com sucesso');
}

// Expandir todas as listas de tickets
function expandAllTicketLists() {
  const expandButtons = document.querySelectorAll('.expand-toggle');
  expandButtons.forEach(btn => {
    const card = btn.closest('.stat-card');
    if (card) {
      const cardId = card.id?.replace('stat-', '');
      if (cardId) {
        expandTickets(cardId);
      }
    }
  });
}

// ===================================
// 🔔 ATUALIZAR MENU BAR / TRAY
// ===================================

function updateTrayWithTickets(stats) {
  if (!stats || !stats.allTickets) {
    debugLog('⚠️ Sem tickets para atualizar o tray');
    return;
  }

  const ticketsData = {
    critical: [],
    warning: [],
    normal: []
  };

  // Processar todos os tickets e categorizar por status de SLA
  stats.allTickets.forEach(ticket => {
    const slaInfo = extractSLAInfo(ticket);
    const ticketData = {
      key: ticket.key,
      summary: ticket.fields?.summary || 'Sem título',
      slaInfo: slaInfo.displayText,
      priority: ticket.fields?.priority?.name || 'Medium',
      slaTimeRemaining: slaInfo.timeRemaining, // Em milissegundos (negativo se vencido)
      created: ticket.fields?.created || null
    };

    // Categorizar baseado no status de SLA
    if (slaInfo.isBreached) {
      ticketsData.critical.push(ticketData);
    } else if (slaInfo.isNearBreach) {
      ticketsData.warning.push(ticketData);
    } else {
      ticketsData.normal.push(ticketData);
    }
  });

  // Limitar a quantidade para não sobrecarregar o menu
  ticketsData.critical = ticketsData.critical.slice(0, 10);
  ticketsData.warning = ticketsData.warning.slice(0, 10);
  ticketsData.normal = ticketsData.normal.slice(0, 5);

  debugLog('🔔 Atualizando tray:', {
    critical: ticketsData.critical.length,
    warning: ticketsData.warning.length,
    normal: ticketsData.normal.length
  });

  // Enviar para o backend atualizar o tray
  ipcRenderer.invoke('update-tray', ticketsData).catch(err => {
    console.warn('Erro ao atualizar tray:', err);
  });
}

// Extrair informações de SLA do ticket
function extractSLAInfo(ticket) {
  // 🎯 CAMPOS CORRETOS DO JIRA SERVICE MANAGEMENT
  // customfield_10123 = Time to resolution (JSM)
  // customfield_10124 = Time to first response (JSM)
  const timeToResolution = ticket.fields?.customfield_10123;
  const timeToFirstResponse = ticket.fields?.customfield_10124;
  
  let isBreached = false;
  let isNearBreach = false;
  let displayText = '';
  let timeRemaining = null; // Tempo em milissegundos (negativo se vencido)
  let slaType = ''; // 'resolution' ou 'first_response'

  // Verificar ambos os SLAs e usar o mais crítico
  const slas = [
    { field: timeToResolution, type: 'resolution', label: 'Resolution' },
    { field: timeToFirstResponse, type: 'first_response', label: 'First Response' }
  ];

  let mostCriticalSla = null;
  let mostCriticalTimeRemaining = Infinity;

  for (const sla of slas) {
    if (sla.field && sla.field.ongoingCycle) {
      const breachTime = sla.field.ongoingCycle.breachTime;
      
      if (breachTime) {
        const breachDate = new Date(breachTime.iso8601 || breachTime);
        const now = new Date();
        const diffMs = breachDate - now;

        // O SLA mais crítico é o que tem menos tempo restante (ou mais tempo estourado)
        if (diffMs < mostCriticalTimeRemaining) {
          mostCriticalTimeRemaining = diffMs;
          mostCriticalSla = { ...sla, diffMs, breachDate };
        }
      }
    }
  }

  // Se encontramos um SLA ativo, processar o mais crítico
  if (mostCriticalSla) {
    const diffMs = mostCriticalSla.diffMs;
    const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));

    timeRemaining = diffMs;
    slaType = mostCriticalSla.type;

    if (diffMs < 0) {
      // SLA estourado
      isBreached = true;
      displayText = `${mostCriticalSla.label}: Estourado há ${diffHours}h ${diffMinutes}m`;
    } else if (diffMs <= 30 * 60 * 1000) {
      // Próximo de estourar (≤ 30 min)
      isNearBreach = true;
      displayText = `${mostCriticalSla.label}: Estoura em ${diffMinutes}m`;
    } else {
      displayText = `${mostCriticalSla.label}: ${diffHours}h ${diffMinutes}m restantes`;
    }
  }

  // Fallback: checar se está na lista de tickets com SLA em alerta
  if (!displayText && window.slaTicketsList) {
    const inSlaList = window.slaTicketsList.find(t => t.key === ticket.key);
    if (inSlaList) {
      isNearBreach = true;
      displayText = 'SLA em alerta';
      // Tentar estimar tempo restante se não temos dados precisos
      timeRemaining = 30 * 60 * 1000; // ~30min como estimativa
    }
  }

  return {
    isBreached,
    isNearBreach,
    displayText: displayText || 'SLA OK',
    timeRemaining, // Tempo em milissegundos (negativo se vencido, null se sem SLA)
    slaType // 'resolution' ou 'first_response'
  };
}

function updateUI(stats) {
  // 🔒 LOCK: Prevenir múltiplas atualizações simultâneas
  if (isUpdatingUI) {
    console.warn('⚠️ updateUI() já está em execução, salvando update pendente...');
    pendingUpdate = stats;
    return;
  }
  
  isUpdatingUI = true;
  
  try {
    // Debug: verificar os dados recebidos
    debugLog('🔢 === UPDATEUI CHAMADO ===');
    debugLog('🔢 Contadores recebidos:', {
      total: stats.total,
      support: stats.waitingForSupport,
      customer: stats.waitingForCustomer,
      pending: stats.pending,
      inProgress: stats.inProgress
    });
    debugLog('📋 Listas de tickets recebidas:', {
      supportTickets: stats.supportTickets?.length || 0,
      customerTickets: stats.customerTickets?.length || 0,
      pendingTickets: stats.pendingTickets?.length || 0,
      inProgressTickets: stats.inProgressTickets?.length || 0
    });
  
  // Detectar novos tickets e enviar notificações
  if (currentConfig.desktopNotifications !== false && stats.allTickets) {
    debugLog('🔔 Verificando novos tickets para notificações...');
    checkForNewTickets(stats.allTickets);
  } else {
    debugLog('⚠️ Notificações ou stats não disponíveis:', {
      notificationsEnabled: currentConfig.desktopNotifications !== false,
      hasStats: !!stats.allTickets
    });
  }
  
  // Atualizar Menu Bar / Tray com dados dos tickets
  updateTrayWithTickets(stats);
  
  // Atualizar contadores com animação
  debugLog('🎬 Animando números:');
  debugLog('   Total:', stats.total || 0);
  debugLog('   Support:', stats.waitingForSupport || 0);
  debugLog('   Customer:', stats.waitingForCustomer || 0);
  debugLog('   Pending:', stats.pending || 0);
  debugLog('   In Progress:', stats.inProgress || 0);
  
  animateNumber('stat-total', stats.total || 0);
  animateNumber('stat-support', stats.waitingForSupport || 0);
  animateNumber('stat-customer', stats.waitingForCustomer || 0);
  animateNumber('stat-pending', stats.pending || 0);
  animateNumber('stat-inprogress', stats.inProgress || 0);
  
  // 🔬 Atualizar modo micro se ativo
  if (isMicroMode) {
    updateMicroStats();
  }
  
  // Atualizar badges
  const slaBadge = document.getElementById('badge-sla');
  const oldBadge = document.getElementById('badge-old');
  
  // Armazenar listas de tickets para os badges
  window.slaTicketsList = stats.slaTickets || [];
  window.oldTicketsList = stats.oldTicketsList || [];
  
  if (stats.slaAlerts > 0 && currentConfig.alertSla !== false) {
    slaBadge.style.display = 'inline-flex';
    slaBadge.style.cursor = 'pointer';
    slaBadge.title = `${stats.slaAlerts} ticket(s) com SLA em alerta (até 30min ou atrasados) - Clique para ver detalhes`;
    document.getElementById('badge-sla-text').textContent = stats.slaAlerts;
  } else {
    slaBadge.style.display = 'none';
  }
  
  if (stats.oldTickets > 0 && currentConfig.alertOldTickets !== false) {
    oldBadge.style.display = 'inline-flex';
    oldBadge.style.cursor = 'pointer';
    oldBadge.title = `${stats.oldTickets} ticket(s) sem atualização há 7+ dias - Clique para ver`;
    document.getElementById('badge-old-text').textContent = stats.oldTickets;
  } else {
    oldBadge.style.display = 'none';
  }
  
    // Atualizar Modo Pro
    if (isProMode) {
      updateProModeSection(stats);
    }
    
    // Atualizar última atualização
    const timeStr = new Date().toLocaleTimeString(currentLanguage === 'en' ? 'en-US' : (currentLanguage === 'es' ? 'es-ES' : 'pt-BR'));
    document.getElementById('last-update').textContent = `${t('time.updated', 'Updated')}: ${timeStr}`;
    
    debugLog('✅ === UPDATEUI CONCLUÍDO ===');
    
  } finally {
    // 🔓 UNLOCK: Liberar flag
    isUpdatingUI = false;
    
    // Se houver update pendente, processar agora
    if (pendingUpdate) {
      debugLog('🔄 Processando update pendente...');
      const nextUpdate = pendingUpdate;
      pendingUpdate = null;
      
      // Usar setTimeout para evitar stack overflow em caso de loop
      setTimeout(() => updateUI(nextUpdate), 0);
    }
  }
}

// Detectar novos tickets e mudanças
function checkForNewTickets(allTickets) {
  debugLog('🔍 checkForNewTickets chamado:', {
    ticketsCount: allTickets?.length || 0,
    previousCount: previousTicketKeys.size,
    isFirstTime: previousTicketKeys.size === 0
  });
  
  if (!allTickets || allTickets.length === 0) {
    debugLog('⚠️ Nenhum ticket para verificar');
    return;
  }
  
  const currentTicketKeys = new Set(allTickets.map(t => t.key));
  const newTickets = [];
  const changedTickets = [];
  
  // Se é a primeira vez, apenas inicializar
  if (previousTicketKeys.size === 0) {
    debugLog('📋 Primeira vez - inicializando lista de tickets');
    previousTicketKeys = currentTicketKeys;
    
    // Inicializar estados
    allTickets.forEach(ticket => {
      previousTicketStates.set(ticket.key, {
        status: ticket.status || ticket.fields?.status?.name,
        assignee: ticket.assignee || ticket.fields?.assignee?.emailAddress
      });
    });
    return;
  }
  
  // Verificar cada ticket
  for (const ticket of allTickets) {
    const ticketKey = ticket.key;
    const currentStatus = ticket.status || ticket.fields?.status?.name;
    const currentAssignee = ticket.assignee || ticket.fields?.assignee?.emailAddress;
    const previousState = previousTicketStates.get(ticketKey);
    
    // Caso 1: Ticket NOVO (não existia antes)
    if (!previousTicketKeys.has(ticketKey)) {
      debugLog('🆕 Novo ticket detectado:', ticketKey);
      newTickets.push({
        ...ticket,
        changeType: 'new',
        changeDescription: 'Novo ticket atribuído a você'
      });
      
      // Rastrear novo ticket para atividade diária
      trackNewTicketReceived({
        key: ticketKey,
        summary: ticket.summary || ticket.fields?.summary || ticketKey
      });
    }
    // Caso 2: Ticket MUDOU DE STATUS
    else if (previousState && previousState.status !== currentStatus) {
      debugLog('🔄 Status mudou:', ticketKey, previousState.status, '→', currentStatus);
      
      // Rastrear ticket fechado se mudou para um status de fechamento
      const closedStatuses = ['Fechado', 'Closed', 'Resolvido', 'Resolved', 'Concluído', 'Concluido', 'Done'];
      if (closedStatuses.includes(currentStatus)) {
        trackTicketResolved({
          key: ticketKey,
          summary: ticket.summary || ticket.fields?.summary || ticketKey
        });
      }
      changedTickets.push({
        ...ticket,
        changeType: 'status',
        changeDescription: `Status mudou: ${previousState.status} → ${currentStatus}`,
        previousStatus: previousState.status,
        currentStatus: currentStatus
      });
    }
    // Caso 3: Ticket FOI REATRIBUÍDO PARA O USUÁRIO
    else if (previousState && previousState.assignee !== currentAssignee) {
      debugLog('👤 Reatribuído:', ticketKey, previousState.assignee, '→', currentAssignee);
      
      // Só notificar se foi atribuído PARA o usuário atual
      const currentUserEmail = currentConfig.jiraEmail;
      if (currentAssignee === currentUserEmail) {
        changedTickets.push({
          ...ticket,
          changeType: 'reassigned',
          changeDescription: 'Ticket reatribuído para você',
          previousAssignee: previousState.assignee,
          currentAssignee: currentAssignee
        });
      }
    }
    
    // Atualizar estado deste ticket
    previousTicketStates.set(ticketKey, {
      status: currentStatus,
      assignee: currentAssignee
    });
  }
  
  // Atualizar lista de tickets anteriores
  previousTicketKeys = currentTicketKeys;
  
  // Limpar estados de tickets que não existem mais
  for (const key of previousTicketStates.keys()) {
    if (!currentTicketKeys.has(key)) {
      previousTicketStates.delete(key);
    }
  }
  
  // Filtrar notificações baseado nas preferências do usuário
  let notificationsToShow = [];
  
  if (currentConfig.notifyNewTickets !== false) {
    notificationsToShow.push(...newTickets.filter(t => t.changeType === 'new'));
  }
  
  if (currentConfig.notifyStatusChanges !== false) {
    notificationsToShow.push(...changedTickets.filter(t => t.changeType === 'status'));
  }
  
  if (currentConfig.notifyReassignments !== false) {
    notificationsToShow.push(...changedTickets.filter(t => t.changeType === 'reassigned'));
  }
  
  // Mostrar notificações
  const allNotifications = [...newTickets, ...changedTickets];
  
  if (allNotifications.length > 0) {
    debugLog('✅ Total de mudanças:', {
      novos: newTickets.length,
      alterados: changedTickets.length,
      total: allNotifications.length,
      aNotificar: notificationsToShow.length
    });
    
    // Adicionar notificações ao sino interno (sempre, independente das preferências)
    allNotifications.forEach(ticket => {
      addInternalNotification(ticket, ticket.changeType, ticket.changeDescription);
    });
    
    // Mostrar notificações desktop (baseado nas preferências)
    if (notificationsToShow.length > 0) {
      showDesktopNotifications(notificationsToShow);
    } else {
      debugLog('⚠️ Mudanças detectadas, mas notificações desktop desabilitadas para estes tipos');
    }
    
    // Atualizar atividade do dia (widget usa os mesmos contadores dos cards)
    updateDailyActivityUI();
    
    // 🔄 IMPORTANTE: Forçar atualização dos cards expandidos após mudanças
    debugLog('🔄 Forçando re-renderização dos cards após mudanças...');
    updateExpandedTicketsLists();
  } else {
    debugLog('✅ Nenhuma mudança nesta verificação');
  }
}

// Mostrar notificações desktop
function showDesktopNotifications(newTickets) {
  debugLog('🔔 showDesktopNotifications chamado:', {
    enabled: currentConfig.desktopNotifications,
    ticketsCount: newTickets.length,
    permission: Notification.permission
  });
  
  if (!currentConfig.desktopNotifications) {
    debugLog('⚠️ Notificações desktop desabilitadas no config');
    return;
  }
  
  if (newTickets.length === 0) {
    debugLog('⚠️ Nenhum ticket novo para notificar');
    return;
  }
  
  // Verificar permissão
  if (Notification.permission !== 'granted') {
    console.warn('⚠️ Permissão de notificações não concedida:', Notification.permission);
    // Tentar solicitar permissão novamente
    Notification.requestPermission().then(permission => {
      debugLog('🔔 Nova tentativa de permissão:', permission);
      if (permission === 'granted') {
        showDesktopNotifications(newTickets); // Tentar novamente
      }
    });
    return;
  }
  
  debugLog('✅ Mostrando', newTickets.length, 'notificações desktop');
  
  // Notificar todas as movimentações para não perder nenhuma atualização
  const ticketsToNotify = newTickets;
  
  ticketsToNotify.forEach((ticket, index) => {
    setTimeout(() => {
      // Determinar título e corpo baseado no tipo de mudança
      let title, body;
      
      switch (ticket.changeType) {
        case 'new':
          title = '🎫 Novo Ticket no Jira';
          body = `${ticket.key}: ${ticket.summary || ticket.fields?.summary || 'Sem título'}`;
          break;
        
        case 'status':
          title = '🔄 Status Alterado';
          body = `${ticket.key}: ${ticket.previousStatus} → ${ticket.currentStatus}`;
          break;
        
        case 'reassigned':
          title = '👤 Ticket Reatribuído';
          body = `${ticket.key}: Agora é seu!\n${ticket.summary || ticket.fields?.summary || ''}`;
          break;
        
        case 'mention':
          title = '📢 Você foi mencionado no Jira';
          body = `${ticket.key}: ${ticket.changeDescription || ticket.summary || ticket.fields?.summary || 'Você foi mencionado em um comentário'}`;
          break;
        
        default:
          title = '🎫 Atualização no Jira';
          body = `${ticket.key}: ${ticket.summary || ticket.fields?.summary || 'Sem título'}`;
      }
      
      debugLog('📨 Enviando notificação:', title, body);
      
      const notification = new Notification(title, {
        body: body,
        icon: 'https://your-company.atlassian.net/favicon.ico',
        tag: ticket.key + '-' + ticket.changeType,
        requireInteraction: false
      });
      
      notification.onclick = () => {
        debugLog('🖱️ Notificação clicada:', ticket.key);
        openTicketPreview(ticket.key);
        notification.close();
      };
      
      notification.onerror = (error) => {
        console.error('❌ Erro ao mostrar notificação:', error);
      };
      
      // Tocar som se habilitado
      if (currentConfig.soundNotifications !== false) {
        playNotificationSound();
      }
    }, index * 300); // Espaçar notificações por 300ms
  });
  
  // Sem notificação resumida para garantir uma notificação por movimento
}

// Tocar som de notificação
function playNotificationSound() {
  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi2A0fPbhzYHGWe56+idTgwOUKzk7bllHAU2k9n1y3goB');
  audio.volume = 0.3;
  audio.play().catch(() => {}); // Ignorar erro se não puder tocar
}

function updateProModeSection(stats) {
  debugLog('📊 Atualizando Modo Pro com dados de:', currentConfig.monitorOtherUser ? currentConfig.otherUserEmail : 'você');
  
  // Atualizar indicador de usuário no Modo Pro
  updateProModeUserIndicator();
  
  // 📱 SIM Cards - Atualizar contador no card
  if (stats.simcardPendingTickets) {
    animateNumber('stat-simcard', stats.simcardPendingTickets.count || 0);
    debugLog('📱 SIM Cards count:', stats.simcardPendingTickets.count);
  } else {
    animateNumber('stat-simcard', 0);
    debugLog('⚠️ SIM Cards: Nenhum dado recebido');
  }
  
  // 🤖 L0 Jira Bot - Atualizar contador no card
  if (stats.l0BotTickets) {
    animateNumber('stat-l0bot', stats.l0BotTickets.count || 0);
    debugLog('🤖 L0 Bot count:', stats.l0BotTickets.count);
  } else {
    animateNumber('stat-l0bot', 0);
    debugLog('⚠️ L0 Bot: Nenhum dado recebido');
  }
  
  // 🎯 All L1 Open - Atualizar contador no card
  if (stats.l1OpenTickets) {
    animateNumber('stat-l1open', stats.l1OpenTickets.count || 0);
    debugLog('🎯 L1 Open count:', stats.l1OpenTickets.count);
  } else {
    animateNumber('stat-l1open', 0);
    debugLog('⚠️ L1 Open: Nenhum dado recebido');
  }
  
  // SIM Cards - contador antigo (mantido para compatibilidade se houver referência em outro lugar)
  if (stats.simcardPendingTickets) {
    const simCardsCountEl = document.getElementById('sim-cards-count');
    if (simCardsCountEl) {
      simCardsCountEl.textContent = stats.simcardPendingTickets.count || 0;
    }
  }
  
  // =========================================================
  // CORREÇÃO DOS TICKETS AVALIADOS (SOLUÇÃO DEFINITIVA)
  // =========================================================
  if (stats.evaluatedTickets) {
    // 🔥 FILTRO AGRESSIVO: Só aceita se a propriedade 'satisfaction' existir de fato.
    // Se for 'undefined', o ticket foi resolvido mas NÃO foi avaliado.
    const allTickets = stats.evaluatedTickets.tickets || [];
    const ticketsValidos = allTickets.filter(t => 
      t.satisfaction !== undefined && t.satisfaction !== null
    );

    debugLog('═══════════════════════════════════════════════════════');
    debugLog('🔍 FILTRO POR CAMPO SATISFACTION (Solução Definitiva)');
    debugLog(`📥 Total de tickets recebidos do backend: ${allTickets.length}`);
    debugLog(`✅ Tickets com avaliação real (satisfaction definido): ${ticketsValidos.length}`);
    debugLog(`❌ Tickets sem avaliação (satisfaction undefined): ${allTickets.length - ticketsValidos.length}`);
    
    if (ticketsValidos.length > 0) {
      debugLog('\n⭐ Amostra dos primeiros 3 tickets com avaliação:');
      ticketsValidos.slice(0, 3).forEach((t, i) => {
        const rating = t.satisfaction || t.ratingNumber;
        debugLog(`  ${i + 1}. ${t.key}: ${rating} estrelas (satisfaction: ${t.satisfaction})`);
      });
    }

    // Contar por rating usando satisfaction ou ratingNumber como fallback
    const counts = {
      all: ticketsValidos.length,
      5: ticketsValidos.filter(t => parseInt(t.satisfaction || t.ratingNumber) === 5).length,
      4: ticketsValidos.filter(t => parseInt(t.satisfaction || t.ratingNumber) === 4).length,
      3: ticketsValidos.filter(t => parseInt(t.satisfaction || t.ratingNumber) === 3).length,
      2: ticketsValidos.filter(t => parseInt(t.satisfaction || t.ratingNumber) === 2).length,
      1: ticketsValidos.filter(t => parseInt(t.satisfaction || t.ratingNumber) === 1).length
    };
    
    debugLog('\n📊 Distribuição por estrelas:');
    debugLog(`   ⭐⭐⭐⭐⭐ (5): ${counts[5]}`);
    debugLog(`   ⭐⭐⭐⭐ (4): ${counts[4]}`);
    debugLog(`   ⭐⭐⭐ (3): ${counts[3]}`);
    debugLog(`   ⭐⭐ (2): ${counts[2]}`);
    debugLog(`   ⭐ (1): ${counts[1]}`);
    debugLog(`   📦 TOTAL: ${counts.all}`);
    debugLog('═══════════════════════════════════════════════════════\n');
    
    // Atualizar os contadores nos botões de filtro
    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-5').textContent = counts[5];
    document.getElementById('count-4').textContent = counts[4];
    document.getElementById('count-3').textContent = counts[3];
    document.getElementById('count-2').textContent = counts[2];
    document.getElementById('count-1').textContent = counts[1];
    
    // 🎨 Atualizar as barras do gráfico "Resumo de Avaliações"
    const total = counts.all || 1;
    [5, 4, 3, 2, 1].forEach(num => {
      const bar = document.querySelector(`.rating-row[onclick*="(${num})"] .rating-bar-fill`);
      const label = document.querySelector(`.rating-row[onclick*="(${num})"] .rating-count`);
      if (bar && label) {
        const percent = (counts[num] / total) * 100;
        bar.style.width = `${percent}%`;
        label.textContent = counts[num];
      }
    });
    
    // ✅ IMPORTANTE: Atualizar a lista de tickets para usar apenas os válidos
    stats.evaluatedTickets.tickets = ticketsValidos;
  }
  
  // Projeto Stats
  updateProjectStats(stats.byProject);
  
  // Tickets Recentes
  updateRecentTickets(stats.recentTickets);
  
  // Gráfico de Tendência
  updateTrendChart(stats.trend);
  
  // Atualizar Mini Stats Dashboard
  updateMiniStats(stats);
}

function updateProjectStats(byProject) {
  const container = document.getElementById('project-stats');
  if (!byProject) return;
  
  // 🔥 DINÂMICO: Pega TODOS os projetos que existirem, não apenas IT, DCI, GTC
  const projects = Object.keys(byProject).sort(); // Ordenado alfabeticamente
  
  // Se não houver projetos, exibe mensagem
  if (projects.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">Nenhum projeto encontrado</p>';
    return;
  }
  
  container.innerHTML = projects.map(proj => {
    const data = byProject[proj] || { count: 0 };
    const url = `https://your-company.atlassian.net/issues/?jql=assignee%20%3D%20currentUser%28%29%20AND%20resolution%20%3D%20Unresolved%20AND%20status%20NOT%20IN%20%28%22Cancelled%22%2C%20%22Canceled%22%2C%20%22Cancelado%22%2C%20%22Closed%22%29%20AND%20project%20%3D%20${proj}%20ORDER%20BY%20updated%20DESC`;
    return `
      <div class="project-card-wrapper">
        <div class="project-card-main">
          <button class="custom-btn draggable-btn" data-btn-id="${proj.toLowerCase()}" data-url="${url}">
            <span class="drag-handle">☰</span>
            <span class="btn-text" contenteditable="false">${proj}</span>
            <span class="stat-number-inline">${data.count}</span>
            <span class="edit-icon">✏️</span>
          </button>
          <button class="expand-btn-inline" id="expand-${proj.toLowerCase()}" title="Expandir" data-project="${proj}">
            <svg class="expand-icon" viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
        </div>
        <div class="tickets-list project-tickets-list" id="tickets-list-${proj.toLowerCase()}" style="display: none;">
          <!-- Lista de tickets do projeto ${proj} será inserida aqui -->
        </div>
      </div>
    `;
  }).join('');
  
  setupDragAndDropForContainer(container);
  setupEditableButtons(container);
  setupProjectExpandButtons(projects); // Passa os projetos dinâmicos
}

// Configurar botões de expandir dos projetos
function setupProjectExpandButtons(projects = []) {
  // 🔥 DINÂMICO: Usa os projetos passados como parâmetro
  const projectsToSetup = projects.map(p => p.toLowerCase());
  
  // Expandir atividade diária
  const dailyActivityBtn = document.getElementById('expand-daily-activity');
  const dailyActivityDetails = document.getElementById('daily-activity-details');
  
  if (dailyActivityBtn && dailyActivityDetails) {
    dailyActivityBtn.onclick = (e) => {
      e.stopPropagation();
      const isExpanded = dailyActivityDetails.style.display !== 'none';
      
      if (isExpanded) {
        dailyActivityDetails.style.display = 'none';
        dailyActivityBtn.classList.remove('expanded');
      } else {
        dailyActivityDetails.style.display = 'block';
        dailyActivityBtn.classList.add('expanded');
        updateDailyActivityDetails();
      }
    };
  }
  
  projectsToSetup.forEach(proj => {
    const expandBtn = document.getElementById(`expand-${proj}`);
    const ticketsList = document.getElementById(`tickets-list-${proj}`);
    
    if (expandBtn && ticketsList) {
      expandBtn.onclick = async (e) => {
        e.stopPropagation();
        const isExpanded = ticketsList.style.display !== 'none';
        
        if (isExpanded) {
          // Colapsar
          ticketsList.style.display = 'none';
          expandBtn.classList.remove('expanded');
        } else {
          // Expandir
          ticketsList.style.display = 'block';
          expandBtn.classList.add('expanded');
          
          // Carregar tickets do projeto se ainda não foram carregados
          if (ticketsList.children.length === 0) {
            ticketsList.innerHTML = '<div class="loading-tickets">Carregando tickets...</div>';
            await loadProjectTickets(proj.toUpperCase(), ticketsList);
          }
        }
      };
    }
  });
}

// Carregar tickets de um projeto específico
async function loadProjectTickets(projectKey, container) {
  try {
    // Usar a mesma lógica de assignee que o resto do app
    const assignee = currentConfig.monitorOtherUser && currentConfig.otherUserEmail 
      ? `"${currentConfig.otherUserEmail}"` 
      : 'currentUser()';
    
    const jql = `assignee = ${assignee} AND resolution = Unresolved AND status NOT IN ("Cancelled", "Canceled", "Cancelado", "Closed") AND project = ${projectKey} ORDER BY updated DESC`;
    const result = await ipcRenderer.invoke('search-jira-tickets', jql, 50);
    
    if (!result.success) {
      throw new Error(result.error || 'Falha ao buscar tickets');
    }
    
    const tickets = result.data;
    
    if (tickets && tickets.issues && tickets.issues.length > 0) {
      container.innerHTML = tickets.issues.map(issue => {
        const key = issue.key;
        const summary = issue.fields.summary;
        const status = issue.fields.status.name;
        const priority = issue.fields.priority?.name || 'Sem prioridade';
        const updated = new Date(issue.fields.updated).toLocaleDateString('pt-BR');
        const assigneeEmail = issue.fields.assignee?.emailAddress || '';
        
        // 🎨 Calcular status do SLA para tickets IT
        let slaStatus = '';
        const project = issue.fields.project?.key || '';
        
        if (project === 'IT') {
          // 🎯 PRIORIDADE: Verificar campo breached do JSM
          if (isSlaBreached(issue)) {
            slaStatus = 'overdue'; // 🔴 Estourado (campo breached = true)
          } else {
            const slaDate = getSlaDate(issue);
            
            if (slaDate) {
              const now = new Date();
              const dueDate = new Date(slaDate);
              const timeDiff = dueDate - now;
              const diffMinutes = Math.floor(timeDiff / 60000);
              
              // Thresholds: 🔴 estourado, 🟡 ≤30min, 🟢 >30min
              if (diffMinutes < 0) {
                slaStatus = 'overdue'; // 🔴 Estourado
              } else if (diffMinutes <= 30) {
                slaStatus = 'warning'; // 🟡 Atenção (≤ 30 min)
              } else {
                slaStatus = 'safe'; // 🟢 Seguro (> 30 min)
              }
            }
          }
        }
        
        // 👤 Gerar avatar com iniciais
        const avatarHTML = createAvatarHTML(assigneeEmail);
        
        return `
          <div class="ticket-item" data-ticket-key="${key}" ${slaStatus ? `data-sla-status="${slaStatus}"` : ''}>
            <div class="ticket-item-content">
              <div class="ticket-key-link">
                <a href="https://your-company.atlassian.net/browse/${key}" target="_blank" onclick="event.stopPropagation()">${key}</a>
              </div>
              <div class="ticket-summary">${summary}</div>
              <div class="ticket-meta">
                <span class="ticket-status">${status}</span>
                <span class="ticket-priority priority-${priority.toLowerCase().replace(/\s+/g, '-')}">${priority}</span>
                <span class="ticket-updated">${updated}</span>
              </div>
              <div class="ticket-sla-info" id="sla-${key}" style="margin-top: 8px; font-size: 11px; color: #888;">
                <div class="sla-loading">⏳ Carregando SLAs...</div>
              </div>
            </div>
            ${avatarHTML}
          </div>
        `;
      }).join('');
      
  // Adicionar event listeners para abrir preview ao clicar no ticket
  container.querySelectorAll('.ticket-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ticketKey = item.dataset.ticketKey;
      console.log('🎯 Clique no ticket do projeto detectado:', ticketKey);
      if (ticketKey && typeof openTicketPreview === 'function') {
        openTicketPreview(ticketKey);
      } else {
        console.error('❌ Erro: ticketKey ou openTicketPreview não disponível', {
          ticketKey,
          hasFunction: typeof openTicketPreview === 'function'
        });
      }
    });
  });
      
      // Carregar SLAs em batch (otimizado)
      const ticketKeys = tickets.issues.map(issue => issue.key);
      loadSlaForTicketsBatch(ticketKeys);
    } else {
      container.innerHTML = '<div class="no-tickets">Nenhum ticket encontrado</div>';
    }
  } catch (error) {
    console.error(`Erro ao carregar tickets do projeto ${projectKey}:`, error);
    container.innerHTML = '<div class="error-tickets">Erro ao carregar tickets</div>';
  }
}

function updateRecentTickets(tickets) {
  const container = document.getElementById('recent-tickets-list');
  if (!tickets || tickets.length === 0) {
    container.innerHTML = '<p style="color: #666; text-align: center; padding: 12px;">Nenhum ticket recente</p>';
    return;
  }
  
  container.innerHTML = tickets.map(ticket => {
    const isNew = !viewedTickets.has(ticket.key);
    const newBadge = isNew ? '<span class="ticket-new-badge">NOVO</span>' : '';
    const assigneeEmail = ticket.assignee?.emailAddress || '';
    const avatarHTML = createAvatarHTML(assigneeEmail);
    
    return `
      <div class="recent-ticket-item" data-ticket-key="${ticket.key}" style="position: relative;">
        <div style="flex: 1; min-width: 0;">
          <div class="recent-ticket-key">${ticket.key} ${newBadge}</div>
          <div class="recent-ticket-summary">${ticket.summary}</div>
          <div class="recent-ticket-meta">${ticket.status} • ${getTimeAgo(ticket.updated)}</div>
        </div>
        <div class="ticket-quick-actions">
          <button class="quick-action-btn" onclick="event.stopPropagation(); navigator.clipboard.writeText('${ticket.key}');" title="Copiar Key">
            <svg viewBox="0 0 24 24"><path fill="white" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="quick-action-btn" onclick="event.stopPropagation(); window.openTicketInJira('${ticket.key}');" title="Abrir no Jira">
            <svg viewBox="0 0 24 24"><path fill="white" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          </button>
        </div>
        ${avatarHTML}
      </div>
    `;
  }).join('');
  
  // Add event listeners
  container.querySelectorAll('.recent-ticket-item').forEach(item => {
    item.addEventListener('click', () => {
      const ticketKey = item.getAttribute('data-ticket-key');
      viewedTickets.add(ticketKey); // Marcar como visto
      openTicketPreview(ticketKey);
    });
  });
}

function updateTrendChart(trend) {
  const container = document.getElementById('trend-chart');
  if (!trend || trend.length === 0) return;
  
  const maxCount = Math.max(...trend.map(d => d.count), 1);
  
  container.innerHTML = trend.map(day => {
    const height = (day.count / maxCount) * 100;
    const date = new Date(day.date);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
    const fullDate = date.toLocaleDateString('pt-BR');
    
    return `
      <div class="trend-bar-container" data-jql="${day.jql.replace(/"/g, '&quot;')}" style="position: relative;">
        <div class="trend-bar-tooltip">${fullDate}<br/>${day.count} ticket${day.count !== 1 ? 's' : ''}<br/>Clique para ver</div>
        <div class="trend-bar-value">${day.count}</div>
        <div class="trend-bar" style="height: ${height}%; transition: all 0.3s;"></div>
        <div class="trend-bar-date">${dateStr}</div>
      </div>
    `;
  }).join('');
  
  // Add click and hover listeners to trend bars
  container.querySelectorAll('.trend-bar-container').forEach(bar => {
    bar.addEventListener('click', () => {
      const jql = bar.getAttribute('data-jql');
      if (jql) {
        openTrendDay(jql);
      }
    });
    
    // Animação no hover
    bar.addEventListener('mouseenter', () => {
      bar.querySelector('.trend-bar').style.transform = 'scaleY(1.1)';
      bar.querySelector('.trend-bar').style.filter = 'brightness(1.3)';
    });
    
    bar.addEventListener('mouseleave', () => {
      bar.querySelector('.trend-bar').style.transform = 'scaleY(1)';
      bar.querySelector('.trend-bar').style.filter = 'brightness(1)';
    });
  });
}

function openTrendDay(jql) {
  const baseUrl = currentConfig.jiraUrl || 'https://your-company.atlassian.net';
  const url = `${baseUrl}/issues/?jql=${encodeURIComponent(jql)}`;
  ipcRenderer.invoke('open-url', url);
}

// Cards
function setupCardListeners() {
  const cards = ['total', 'support', 'customer', 'pending', 'inprogress', 'simcard', 'l0bot', 'l1open'];
  cards.forEach(cardId => {
    const card = document.getElementById(`card-${cardId}`);
    
    // Verificar se o card existe antes de adicionar listeners
    if (!card) {
      debugLog(`⚠️ Card ${cardId} não encontrado no DOM`);
      return;
    }
    
    // Click listener
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.expand-btn')) {
        openCardInJira(cardId);
      }
    });
    
    // Expand button listener
    const expandBtn = card.querySelector('.expand-btn');
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCardExpansion(cardId);
    });
    
    // Drag and drop para reordenar (em Pro Mode)
    if (isProMode) {
      card.setAttribute('draggable', 'true');
      
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cardId);
        card.classList.add('dragging');
      });
      
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
      
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });
      
      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });
      
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId !== cardId) {
          // Reordenar cards
          const container = card.parentElement;
          const draggedCard = document.getElementById(`card-${draggedId}`);
          
          // Inserir antes ou depois baseado na posição
          const rect = card.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          
          if (e.clientY < midpoint) {
            container.insertBefore(draggedCard, card);
          } else {
            container.insertBefore(draggedCard, card.nextSibling);
          }
          
          showToast('Cards', t('layout.cardsUpdated'), 'success');
        }
      });
    }
  });
}

function openCardInJira(cardId) {
  const baseUrl = currentConfig.jiraUrl || 'https://your-company.atlassian.net';
  let url = '';
  
  const assignee = currentConfig.monitorOtherUser && currentConfig.otherUserEmail 
    ? `"${currentConfig.otherUserEmail}"` 
    : 'currentUser()';
  
  // Para o card pending, usar sempre o link específico
  if (cardId === 'pending') {
    url = 'https://your-company.atlassian.net/issues?jql=resolution%20%3D%20Unresolved%20AND%20status%20IN%20%28%22Pending%22%2C%20%22Pendente%22%29%20AND%20assignee%20%3D%20currentUser%28%29';
    ipcRenderer.invoke('open-url', url);
    return;
  }
  
  let jql = '';
  
  switch (cardId) {
    case 'total':
      jql = `assignee = ${assignee} AND resolution = Unresolved AND status NOT IN ("Cancelled", "Canceled", "Cancelado", "Closed") ORDER BY updated DESC`;
      break;
    case 'support':
      jql = `assignee = ${assignee} AND resolution = Unresolved AND status in ("Waiting for Support", "Aguardando Suporte")`;
      break;
    case 'customer':
      jql = `assignee = ${assignee} AND resolution = Unresolved AND status in ("Waiting for Customer", "Aguardando Cliente")`;
      break;
    case 'inprogress':
      jql = `assignee = ${assignee} AND resolution = Unresolved AND status in ("In Progress", "Em Progresso")`;
      break;
    case 'simcard':
      // Abrir filtro 52128
      url = 'https://your-company.atlassian.net/issues/?filter=52128';
      ipcRenderer.invoke('open-url', url);
      return;
    case 'l0bot':
      // Abrir queue 7631
      url = 'https://your-company.atlassian.net/jira/servicedesk/projects/IT/queues/custom/7631';
      ipcRenderer.invoke('open-url', url);
      return;
    case 'l1open':
      // Abrir queue 3015
      url = 'https://your-company.atlassian.net/jira/servicedesk/projects/IT/queues/custom/3015';
      ipcRenderer.invoke('open-url', url);
      return;
  }
  
  url = `${baseUrl}/issues/?jql=${encodeURIComponent(jql)}`;
  ipcRenderer.invoke('open-url', url);
}

function toggleCardExpansion(cardId) {
  const card = document.getElementById(`card-${cardId}`);
  const expandBtn = card.querySelector('.expand-btn');
  const ticketsList = document.getElementById(`tickets-list-${cardId}`);
  
  if (ticketsList.style.display === 'none') {
    expandBtn.classList.add('expanded');
    card.classList.add('expanded'); // 🎨 Adiciona classe ao card para reorganização automática
    card.classList.add('has-visible-list'); // 🎨 Fallback para navegadores sem :has()
    ticketsList.style.display = 'block';
    
    // 🎯 Forçar reorganização suave do grid após expansão
    optimizeGridLayout();
    
    loadTicketsList(cardId);
  } else {
    expandBtn.classList.remove('expanded');
    card.classList.remove('expanded'); // 🎨 Remove classe para reorganização automática
    card.classList.remove('has-visible-list'); // 🎨 Remove fallback
    ticketsList.style.display = 'none';
    
    // 🎯 Reorganizar grid após colapsar
    optimizeGridLayout();
  }
}

// 🎨 Função auxiliar para otimizar o layout do grid
function optimizeGridLayout() {
  requestAnimationFrame(() => {
    const statsGrid = document.getElementById('stats-grid');
    if (!statsGrid) return;
    
    // Forçar recalculação do layout
    statsGrid.style.gridAutoFlow = 'dense';
    
    // Aplicar transição suave aos cards
    const cards = statsGrid.querySelectorAll('.stat-card');
    cards.forEach(card => {
      // Adicionar efeito visual de reorganização
      card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
    
    // Log para debug (pode ser removido em produção)
    debugLog('🎨 Grid reorganizado automaticamente');
  });
}

// 🎨 Reorganizar grid automaticamente ao redimensionar janela
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    checkMicroMode();
    optimizeGridLayout();
  }, 150); // Debounce de 150ms
});

// 🔬 MODO MICRO - Visualização ultra compacta
// Ativado automaticamente quando a janela é menor que 250px de largura ou 150px de altura
const MICRO_MODE_WIDTH_THRESHOLD = 250;
const MICRO_MODE_HEIGHT_THRESHOLD = 150;

function checkMicroMode() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const shouldBeMicro = width < MICRO_MODE_WIDTH_THRESHOLD || height < MICRO_MODE_HEIGHT_THRESHOLD;
  
  if (shouldBeMicro !== isMicroMode) {
    isMicroMode = shouldBeMicro;
    const container = document.querySelector('.app-container');
    
    if (isMicroMode) {
      container.classList.add('micro-view');
      console.log('🔬 Modo Micro ativado:', { width, height });
      
      // Atualizar stats no modo micro
      updateMicroStats();
    } else {
      container.classList.remove('micro-view');
      console.log('📊 Modo Normal restaurado:', { width, height });
    }
  }
}

function updateMicroStats() {
  if (!currentStats) return;
  
  const microTotal = document.getElementById('micro-total');
  const microSupport = document.getElementById('micro-support');
  const microCustomer = document.getElementById('micro-customer');
  const microPending = document.getElementById('micro-pending');
  const microInProgress = document.getElementById('micro-inprogress');
  const microStatusDot = document.getElementById('micro-status-dot');
  
  if (microTotal) microTotal.textContent = currentStats.total || 0;
  if (microSupport) microSupport.textContent = currentStats.waitingForSupport || 0;
  if (microCustomer) microCustomer.textContent = currentStats.waitingForCustomer || 0;
  if (microPending) microPending.textContent = currentStats.pending || 0;
  if (microInProgress) microInProgress.textContent = currentStats.inProgress || 0;
  
  // Atualizar status de conexão
  if (microStatusDot) {
    microStatusDot.classList.remove('offline', 'loading');
    if (connectionStatus === 'offline') {
      microStatusDot.classList.add('offline');
    } else if (connectionStatus === 'loading') {
      microStatusDot.classList.add('loading');
    }
  }
}

// Inicializar verificação de modo micro
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkMicroMode, 100);
});

// 🔔 Função para verificar mudança de status de SLA e notificar
function checkSlaStatusChange(ticketKey, newStatus, summary, minutesRemaining) {
  const previousStatus = slaStatusCache.get(ticketKey);
  
  // Atualizar cache
  slaStatusCache.set(ticketKey, newStatus);
  
  // Se é a primeira vez vendo este ticket, não notificar
  if (!previousStatus) return;
  
  // Se não mudou, não notificar
  if (previousStatus === newStatus) return;
  
  // 🔔 Notificar apenas mudanças críticas
  let shouldNotify = false;
  let notificationTitle = '';
  let notificationBody = '';
  let notificationIcon = '';
  
  if (newStatus === 'overdue' && previousStatus !== 'overdue') {
    // SLA ESTOUROU! 🔴
    shouldNotify = true;
    notificationTitle = '🔴 SLA Estourado!';
    notificationBody = `${ticketKey}: ${summary}\nO SLA deste ticket expirou!`;
    notificationIcon = '🔴';
  } else if (newStatus === 'warning' && previousStatus === 'safe') {
    // Entrou em ATENÇÃO (≤ 30 min) 🟡
    shouldNotify = true;
    notificationTitle = '🟡 SLA em Atenção';
    notificationBody = `${ticketKey}: ${summary}\nMenos de 30 minutos para o SLA expirar!`;
    notificationIcon = '🟡';
  }
  
  if (shouldNotify) {
    // Notificação desktop
    if (Notification.permission === 'granted') {
      new Notification(notificationTitle, {
        body: notificationBody,
        icon: './assets/icon.png',
        tag: `sla-${ticketKey}`,
        requireInteraction: true // Não desaparece automaticamente
      });
    }
    
    // Notificação interna (sino)
    addInternalNotification({
      key: ticketKey,
      summary: summary
    }, 'sla', notificationBody);
    
    debugLog(`🔔 Notificação SLA: ${ticketKey} mudou de ${previousStatus} para ${newStatus}`);
  }
}

// 🎨 Função auxiliar para extrair data de SLA de um ticket
function getSlaDate(ticket) {
  if (!ticket || !ticket.fields) return null;
  
  // 1. 🎯 PRIORIDADE: customfield_10123 (Time to resolution - Jira Service Management)
  const timeToResolution = ticket.fields.customfield_10123;
  if (timeToResolution && timeToResolution.ongoingCycle && timeToResolution.ongoingCycle.breachTime) {
    return timeToResolution.ongoingCycle.breachTime.iso8601;
  }
  
  // 2. Tentar customfield_10124 (Time to first response)
  const timeToFirstResponse = ticket.fields.customfield_10124;
  if (timeToFirstResponse && timeToFirstResponse.ongoingCycle && timeToFirstResponse.ongoingCycle.breachTime) {
    return timeToFirstResponse.ongoingCycle.breachTime.iso8601;
  }
  
  // 3. Tentar duedate padrão
  if (ticket.fields.duedate) {
    return ticket.fields.duedate;
  }
  
  // 4. Buscar em outros campos customizados com padrão JSM
  const slaFieldPatterns = [
    /customfield.*sla/i,
    /customfield.*resolution/i,
    /customfield.*due/i,
    /time.*resolution/i
  ];
  
  for (const fieldKey in ticket.fields) {
    if (slaFieldPatterns.some(pattern => pattern.test(fieldKey))) {
      const value = ticket.fields[fieldKey];
      // Verificar se é um objeto no formato JSM (com breachTime)
      if (value && typeof value === 'object') {
        if (value.ongoingCycle && value.ongoingCycle.breachTime && value.ongoingCycle.breachTime.iso8601) {
          return value.ongoingCycle.breachTime.iso8601;
        }
        if (value.goalDate) {
          return value.goalDate;
        }
        if (value.ongoingCycle && value.ongoingCycle.goalDate) {
          return value.ongoingCycle.goalDate;
        }
      }
      // Se for string de data
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        return value;
      }
    }
  }
  
  return null;
}

// 🎯 Verificar se o SLA foi estourado (campo breached do JSM)
// 
// IMPORTANTE: Apenas verifica SLAs EM ANDAMENTO (ongoingCycle).
// SLAs já completados (completedCycles) NÃO são considerados para o status.
// Isso evita que tickets já respondidos fiquem com indicador vermelho,
// permitindo foco nos tickets que realmente precisam de atenção.
//
// Contribuição: Vinicius Reis (@vinireisss)
function isSlaBreached(ticket) {
  if (!ticket || !ticket.fields) return false;
  
  // Verificar customfield_10123 (Time to resolution)
  const timeToResolution = ticket.fields.customfield_10123;
  if (timeToResolution) {
    // Verificar APENAS ongoingCycle.breached (SLA em andamento)
    if (timeToResolution.ongoingCycle && timeToResolution.ongoingCycle.breached === true) {
      debugLog(`🔴 SLA BREACHED detectado em customfield_10123 para ${ticket.key}`);
      return true;
    }
    // REMOVIDO: Verificação de completedCycles
    // Motivo: Se o SLA foi completado (respondido/resolvido), não deve mais
    // aparecer como breached, mesmo que tenha estourado antes de ser atendido.
  }
  
  // Verificar customfield_10124 (Time to first response)
  const timeToFirstResponse = ticket.fields.customfield_10124;
  if (timeToFirstResponse) {
    // Verificar APENAS ongoingCycle.breached (SLA em andamento)
    if (timeToFirstResponse.ongoingCycle && timeToFirstResponse.ongoingCycle.breached === true) {
      debugLog(`🔴 SLA BREACHED detectado em customfield_10124 para ${ticket.key}`);
      return true;
    }
    // REMOVIDO: Verificação de completedCycles
  }
  
  return false;
}

function loadTicketsList(cardId) {
  if (!currentStats) return;
  
  const ticketsList = document.getElementById(`tickets-list-${cardId}`);
  let tickets = [];
  
  switch (cardId) {
    case 'total':
      tickets = currentStats.allTickets || [];
      break;
    case 'support':
      tickets = currentStats.supportTickets || [];
      break;
    case 'customer':
      tickets = currentStats.customerTickets || [];
      break;
    case 'pending':
      tickets = currentStats.pendingTickets || [];
      break;
    case 'inprogress':
      tickets = currentStats.inProgressTickets || [];
      break;
    case 'simcard':
      tickets = currentStats.simcardPendingTickets?.tickets || [];
      break;
    case 'l0bot':
      tickets = currentStats.l0BotTickets?.tickets || [];
      break;
    case 'l1open':
      tickets = currentStats.l1OpenTickets?.tickets || [];
      break;
  }
  
  if (tickets.length === 0) {
    showEmptyState(ticketsList, cardId);
    return;
  }
  
  // 🚀 OTIMIZAÇÃO: Limitar tickets renderizados para economizar memória
  const MAX_TICKETS_RENDER = 100;
  const ticketsToRender = tickets.slice(0, MAX_TICKETS_RENDER);
  const hasMore = tickets.length > MAX_TICKETS_RENDER;
  
  ticketsList.innerHTML = ticketsToRender.map(ticket => {
    const key = ticket.key;
    const summary = ticket.summary || ticket.fields?.summary || '';
    const status = ticket.status || ticket.fields?.status?.name || '';
    const assigneeEmail = ticket.assignee?.emailAddress || ticket.fields?.assignee?.emailAddress || '';
    
    // 👤 Gerar avatar com iniciais
    const avatarHTML = createAvatarHTML(assigneeEmail);
    
    // 🎨 Calcular status do SLA para tickets IT
    let slaStatus = '';
    const project = ticket.fields?.project?.key || '';
    
    if (project === 'IT') {
      // 🎯 PRIORIDADE: Verificar campo breached do JSM
      if (isSlaBreached(ticket)) {
        slaStatus = 'overdue'; // 🔴 Estourado (campo breached = true)
      } else {
        const slaDate = getSlaDate(ticket);
        
        if (slaDate) {
          const now = new Date();
          const dueDate = new Date(slaDate);
          const timeDiff = dueDate - now;
          const diffMinutes = Math.floor(timeDiff / 60000);
          
          // Thresholds: 🔴 estourado, 🟡 ≤30min, 🟢 >30min
          if (diffMinutes < 0) {
            slaStatus = 'overdue'; // 🔴 Estourado
          } else if (diffMinutes <= 30) {
            slaStatus = 'warning'; // 🟡 Atenção (≤ 30 min)
          } else {
            slaStatus = 'safe'; // 🟢 Seguro (> 30 min)
          }
          
          // 🔔 Verificar se houve mudança de status e notificar
          checkSlaStatusChange(key, slaStatus, summary, diffMinutes);
        }
      }
    }
    
    return `
      <div class="ticket-item" data-ticket-key="${key}" ${slaStatus ? `data-sla-status="${slaStatus}"` : ''}>
        <div class="ticket-item-content">
          <div class="ticket-key">${key}</div>
          <div class="ticket-summary">${summary}</div>
          <div class="ticket-status">${status}</div>
          <div class="ticket-sla-info" id="sla-${key}" style="margin-top: 8px; font-size: 11px; color: #888;">
            <div class="sla-loading">⏳ Carregando SLAs...</div>
          </div>
        </div>
        ${avatarHTML}
      </div>
    `;
  }).join('');
  
  // 🚀 OTIMIZAÇÃO: Mostrar aviso se houver mais tickets
  if (hasMore) {
    ticketsList.innerHTML += `
      <div style="padding: 10px; text-align: center; color: #888; font-size: 12px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 8px;">
        📊 +${tickets.length - MAX_TICKETS_RENDER} tickets não exibidos (economia de memória)
      </div>
    `;
  }
  
  // Add event listeners to prevent propagation
  ticketsList.querySelectorAll('.ticket-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ticketKey = item.getAttribute('data-ticket-key');
      console.log('🎯 Clique no ticket detectado:', ticketKey);
      openTicketPreview(ticketKey);
    });
  });
  
  // Carregar SLAs em batch (otimizado)
  const ticketKeys = ticketsToRender.map(ticket => ticket.key);
  loadSlaForTicketsBatch(ticketKeys);
}

function updateExpandedTicketsLists() {
  const cards = ['total', 'support', 'customer', 'pending'];
  cards.forEach(cardId => {
    const ticketsList = document.getElementById(`tickets-list-${cardId}`);
    if (ticketsList.style.display !== 'none') {
      loadTicketsList(cardId);
    }
  });
  
  // Atualizar também lista de SIM Cards se estiver expandida
  const simCardsTicketsList = document.getElementById('tickets-list-sim-cards');
  if (simCardsTicketsList && simCardsTicketsList.style.display !== 'none') {
    loadSimCardsTicketsList();
  }
  
  // Atualizar também lista de Tickets Avaliados se estiver expandida
  const evaluatedTicketsList = document.getElementById('tickets-list-evaluated-tickets');
  if (evaluatedTicketsList && evaluatedTicketsList.style.display !== 'none') {
    loadEvaluatedTicketsTicketsList();
  }
}

// Função para expandir/recolher lista de tickets SIM Cards
function toggleSimCardsExpansion() {
  const expandBtn = document.getElementById('expand-sim-cards');
  const ticketsList = document.getElementById('tickets-list-sim-cards');
  
  if (ticketsList.style.display === 'none') {
    expandBtn.classList.add('expanded');
    ticketsList.style.display = 'block';
    loadSimCardsTicketsList();
  } else {
    expandBtn.classList.remove('expanded');
    ticketsList.style.display = 'none';
  }
}

// Função para expandir/recolher lista de tickets Avaliados
function toggleEvaluatedTicketsExpansion() {
  const expandBtn = document.getElementById('expand-evaluated-tickets');
  const ticketsList = document.getElementById('tickets-list-evaluated-tickets');
  
  if (ticketsList.style.display === 'none') {
    expandBtn.classList.add('expanded');
    ticketsList.style.display = 'block';
    loadEvaluatedTicketsTicketsList();
  } else {
    expandBtn.classList.remove('expanded');
    ticketsList.style.display = 'none';
  }
}

// Função para carregar lista de tickets SIM Cards
function loadSimCardsTicketsList() {
  if (!currentStats || !currentStats.simcardPendingTickets) {
    document.getElementById('tickets-list-sim-cards').innerHTML = '<p style="color: #666; text-align: center; padding: 12px;">Nenhum ticket de SIM Card</p>';
    return;
  }
  
  const tickets = currentStats.simcardPendingTickets.tickets || [];
  const ticketsList = document.getElementById('tickets-list-sim-cards');
  
  if (tickets.length === 0) {
    ticketsList.innerHTML = '<p style="color: #666; text-align: center; padding: 12px;">Nenhum ticket de SIM Card</p>';
    return;
  }
  
  ticketsList.innerHTML = tickets.map(ticket => {
    // 🎨 Calcular status do SLA para tickets IT (SIM Cards são do projeto IT)
    let slaStatus = '';
    
    // 🎯 PRIORIDADE: Verificar campo breached do JSM
    if (isSlaBreached(ticket)) {
      slaStatus = 'overdue'; // 🔴 Estourado (campo breached = true)
    } else {
      const slaDate = ticket.duedate || getSlaDate(ticket);
      
      if (slaDate) {
        const now = new Date();
        const dueDate = new Date(slaDate);
        const timeDiff = dueDate - now;
        const diffMinutes = Math.floor(timeDiff / 60000);
        
        // Thresholds: 🔴 estourado, 🟡 ≤30min, 🟢 >30min
        if (diffMinutes < 0) {
          slaStatus = 'overdue'; // 🔴 Estourado
        } else if (diffMinutes <= 30) {
          slaStatus = 'warning'; // 🟡 Atenção (≤ 30 min)
        } else {
          slaStatus = 'safe'; // 🟢 Seguro (> 30 min)
        }
      }
    }
    
    return `
      <div class="ticket-item" data-ticket-key="${ticket.key}" ${slaStatus ? `data-sla-status="${slaStatus}"` : ''}>
        <div class="ticket-key">${ticket.key}</div>
        <div class="ticket-summary">${ticket.summary}</div>
        <div class="ticket-status">${ticket.status}</div>
        <div class="ticket-sla-info" id="sla-${ticket.key}" style="margin-top: 8px; font-size: 11px; color: #888;">
          <div class="sla-loading">⏳ Carregando SLAs...</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners to prevent propagation
  ticketsList.querySelectorAll('.ticket-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ticketKey = item.getAttribute('data-ticket-key');
      console.log('🎯 Clique no ticket detectado:', ticketKey);
      openTicketPreview(ticketKey);
    });
  });
  
  // Carregar SLAs em batch (otimizado)
  const ticketKeys = tickets.map(ticket => ticket.key);
  loadSlaForTicketsBatch(ticketKeys);
}

// Função para carregar lista de tickets Avaliados
function loadEvaluatedTicketsTicketsList() {
  const ticketsList = document.getElementById('tickets-list-evaluated-tickets');
  
  if (!currentStats || !currentStats.evaluatedTickets) {
    ticketsList.innerHTML = '<p style="color: #666; text-align: center; padding: 12px;">Nenhum ticket avaliado</p>';
    return;
  }
  
  const allTickets = currentStats.evaluatedTickets.tickets || [];
  
  // 🔍 DEBUG CRÍTICO: Mostrar primeiros 10 tickets BRUTOS do backend
  debugLog('═══════════════════════════════════════════════════════');
  debugLog('🔥 DEBUG CRÍTICO - DADOS BRUTOS DO BACKEND');
  debugLog('═══════════════════════════════════════════════════════');
  debugLog(`📥 Total de tickets recebidos do backend: ${allTickets.length}`);
  debugLog('\n🔍 PRIMEIROS 10 TICKETS (dados brutos):');
  allTickets.slice(0, 10).forEach((ticket, idx) => {
    debugLog(`\n   ${idx + 1}. ${ticket.key}:`);
    debugLog(`      satisfaction: ${ticket.satisfaction} (tipo: ${typeof ticket.satisfaction})`);
    debugLog(`      ratingNumber: ${ticket.ratingNumber} (tipo: ${typeof ticket.ratingNumber})`);
    debugLog(`      ratingEmoji: ${ticket.ratingEmoji}`);
    debugLog(`      Objeto completo:`, JSON.stringify(ticket, null, 2));
  });
  
  // 🔥 FILTRO: Garantir que estamos usando apenas tickets com satisfaction definido
  const tickets = allTickets.filter(t => 
    t.satisfaction !== undefined && t.satisfaction !== null
  );
  
  debugLog(`\n📊 APÓS FILTRO:`);
  debugLog(`✅ Tickets com avaliação válida (1-5): ${tickets.length}`);
  debugLog(`❌ Tickets filtrados (sem avaliação): ${allTickets.length - tickets.length}`);
  
  if (tickets.length === 0) {
    debugLog('⚠️ Nenhum ticket com avaliação válida!');
    ticketsList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px; font-size: 14px;">📊 Nenhum ticket avaliado encontrado<br><span style="font-size: 12px; color: #666; margin-top: 8px; display: block;">Os tickets aparecem aqui quando você recebe avaliação do cliente</span></p>';
    return;
  }
  
  // 🌟 NOVO: Calcular estatísticas de avaliações por estrelas
  const ratingsStats = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  };
  
  debugLog('\n🔍 CONTANDO RATINGS:');
  tickets.forEach((ticket, idx) => {
    if (idx < 5) {
      debugLog(`   ${idx + 1}. ${ticket.key}: ratingNumber=${ticket.ratingNumber}, satisfaction=${ticket.satisfaction}`);
    }
    if (ticket.ratingNumber >= 1 && ticket.ratingNumber <= 5) {
      ratingsStats[ticket.ratingNumber]++;
    } else {
      debugLog(`   ⚠️  Ticket ${ticket.key} tem ratingNumber INVÁLIDO: ${ticket.ratingNumber}`);
    }
  });
  
  const totalRatings = Object.values(ratingsStats).reduce((sum, count) => sum + count, 0);
  
  debugLog('\n📊 DISTRIBUIÇÃO FINAL:');
  debugLog(`   ⭐⭐⭐⭐⭐ (5): ${ratingsStats[5]}`);
  debugLog(`   ⭐⭐⭐⭐ (4): ${ratingsStats[4]}`);
  debugLog(`   ⭐⭐⭐ (3): ${ratingsStats[3]}`);
  debugLog(`   ⭐⭐ (2): ${ratingsStats[2]}`);
  debugLog(`   ⭐ (1): ${ratingsStats[1]}`);
  debugLog(`   📦 TOTAL: ${totalRatings}`);
  debugLog('═══════════════════════════════════════════════════════\n');
  
  // Gerar HTML do resumo de avaliações
  const ratingsStatsHtml = totalRatings > 0 ? `
    <div class="ratings-statistics" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 16px; margin-bottom: 16px; color: white;">
      <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <span>📊</span>
        <span>Resumo de Avaliações</span>
        <span style="font-size: 12px; font-weight: 400; opacity: 0.8;">(${totalRatings} ${totalRatings === 1 ? 'avaliação' : 'avaliações'} • Histórico completo)</span>
      </h4>
      <div class="ratings-breakdown">
        ${[5, 4, 3, 2, 1].map(stars => {
          const count = ratingsStats[stars];
          const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
          return `
            <div class="rating-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; cursor: pointer; padding: 6px; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'" onclick="filterEvaluatedTicketsByRating(${stars})">
              <div class="rating-stars" style="min-width: 90px; display: flex; align-items: center; gap: 4px; font-size: 14px;">
                <span style="color: #ffd700;">${'⭐'.repeat(stars)}</span>
              </div>
              <div class="rating-bar-container" style="flex: 1; height: 20px; background: rgba(255, 255, 255, 0.2); border-radius: 10px; overflow: hidden; position: relative;">
                <div class="rating-bar-fill" style="height: 100%; width: ${percentage}%; background: linear-gradient(90deg, #ffd700 0%, #ffed4e 100%); border-radius: 10px; transition: width 0.3s ease;"></div>
              </div>
              <div class="rating-count" style="min-width: 45px; text-align: right; font-weight: 600; font-size: 16px;">
                ${count}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.2); font-size: 12px; opacity: 0.9;">
        <div style="text-align: center; margin-bottom: 8px;">💡 Clique em uma linha para filtrar os tickets</div>
        <div style="display: flex; justify-content: center; gap: 16px; font-size: 11px; opacity: 0.8;">
          <span>📋 ${tickets.length} ${tickets.length === 1 ? 'ticket' : 'tickets'}</span>
          <span>⏰ Desde o início</span>
        </div>
      </div>
    </div>
  ` : '';
  
  // Gerar HTML da lista de tickets
  const ticketsListHtml = tickets.map(ticket => {
    // Mostrar as estrelas da avaliação com número
    const starsHtml = ticket.ratingEmoji ? 
      `<div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
        <span style="font-size: 16px; color: #ffd700; letter-spacing: 2px;" title="Avaliação do cliente: ${ticket.ratingNumber || '?'} estrelas">${ticket.ratingEmoji}</span>
        ${ticket.ratingNumber ? `<span style="font-size: 12px; color: #ffd700; font-weight: 600;">(${ticket.ratingNumber})</span>` : ''}
      </div>` : '';
    
    return `
      <div class="ticket-item" data-ticket-key="${ticket.key}" data-rating="${ticket.ratingNumber || 0}">
        <div class="ticket-key">${ticket.key}</div>
        ${starsHtml}
        <div class="ticket-summary">${ticket.summary}</div>
        <div class="ticket-meta" style="font-size: 11px; color: #888; margin-top: 4px;">
          <span style="color: #10b981;">✓ ${ticket.status}</span>
          ${ticket.timeAgo ? ` • ${ticket.timeAgo}` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Combinar resumo + lista
  ticketsList.innerHTML = ratingsStatsHtml + ticketsListHtml;
  
  // Add event listeners to prevent propagation
  ticketsList.querySelectorAll('.ticket-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ticketKey = item.getAttribute('data-ticket-key');
      console.log('🎯 Clique no ticket detectado:', ticketKey);
      openTicketPreview(ticketKey);
    });
  });
}

// 🌟 NOVA FUNÇÃO: Filtrar tickets avaliados por número de estrelas
let currentRatingFilter = null;

function filterEvaluatedTicketsByRating(stars) {
  if (!currentStats || !currentStats.evaluatedTickets) return;
  
  const ticketsList = document.getElementById('tickets-list-evaluated-tickets');
  const allTickets = ticketsList.querySelectorAll('.ticket-item');
  
  // Atualizar filtro atual
  currentRatingFilter = stars;
  
  // Remover 'active' de todos os botões de filtro
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Se stars é null, mostrar todos
  if (stars === null) {
    allTickets.forEach(ticket => {
      ticket.style.display = '';
    });
    
    // Ativar botão "Todos"
    const allButton = document.getElementById('filter-all');
    if (allButton) allButton.classList.add('active');
    
    // Remover destaque das barras (se existirem)
    document.querySelectorAll('.rating-row').forEach(row => {
      row.style.background = 'transparent';
      row.style.opacity = '1';
    });
    
    return;
  }
  
  // Filtrar por rating específico
  allTickets.forEach(ticket => {
    const rating = parseInt(ticket.getAttribute('data-rating'));
    if (rating === stars) {
      ticket.style.display = '';
    } else {
      ticket.style.display = 'none';
    }
  });
  
  // Ativar o botão correspondente
  const activeButton = document.getElementById(`filter-${stars}`);
  if (activeButton) activeButton.classList.add('active');
  
  // Destacar a barra selecionada (se existir)
  document.querySelectorAll('.rating-row').forEach((row, index) => {
    const rowStars = 5 - index; // 5, 4, 3, 2, 1
    if (rowStars === stars) {
      row.style.background = 'rgba(255, 255, 255, 0.15)';
      row.style.opacity = '1';
    } else {
      row.style.opacity = '0.5';
    }
  });
}

// Abrir Ticket
function openTicketInJira(ticketKey) {
  const baseUrl = currentConfig.jiraUrl || 'https://your-company.atlassian.net';
  const url = `${baseUrl}/browse/${ticketKey}`;
  ipcRenderer.invoke('open-url', url);
  hideSearch();
}

// Preview de Ticket
async function openTicketPreview(ticketKey) {
  console.log('🎯 openTicketPreview chamada para:', ticketKey);
  
  const modal = document.getElementById('ticket-preview-modal');
  const loading = document.getElementById('ticket-preview-loading');
  const body = document.getElementById('ticket-preview-body');
  const error = document.getElementById('ticket-preview-error');
  
  if (!modal) {
    console.error('❌ Modal ticket-preview-modal não encontrado!');
    return;
  }
  
  console.log('✅ Modal encontrado, exibindo...');
  modal.style.display = 'flex';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
  loading.style.display = 'block';
  body.style.display = 'none';
  error.style.display = 'none';
  
  try {
    debugLog(`🔍 Buscando detalhes do ticket: ${ticketKey}`);
    const result = await ipcRenderer.invoke('get-ticket-details', ticketKey);
    
    debugLog('📦 Resultado recebido:', result);
    
    if (result.success) {
      debugLog('✅ Dados do ticket:', {
        key: result.data?.key,
        summary: result.data?.summary,
        hasComments: !!result.data?.comments,
        commentsLength: result.data?.comments?.length,
        hasAttachments: !!result.data?.attachments,
        attachmentsLength: result.data?.attachments?.length
      });
      
      displayTicketPreview(result.data);
      loading.style.display = 'none';
      body.style.display = 'block';
    } else {
      console.error('❌ Erro no resultado:', result.error);
      throw new Error(result.error);
    }
  } catch (err) {
    console.error('❌ Erro ao carregar ticket:', err);
    console.error('Stack trace:', err.stack);
    loading.style.display = 'none';
    error.style.display = 'block';
    error.innerHTML = `
      <h3>Erro ao carregar ticket</h3>
      <p>${err.message}</p>
      <button onclick="closeTicketPreview()">Fechar</button>
    `;
  }
}

let currentPreviewTicket = null;

function displayTicketPreview(ticket) {
  if (!ticket) {
    console.error('❌ Ticket vazio ou undefined!');
    return;
  }
  
  debugLog('🎨 Renderizando preview do ticket:', ticket);
  debugLog('📋 Support Level:', ticket.supportLevel || 'N/A');
  debugLog('📋 ITOps Team:', ticket.team || 'N/A');
  debugLog('📋 Custom Fields:', ticket.customFields || {});
  
  const body = document.getElementById('ticket-preview-body');
  if (!body) {
    console.error('❌ Elemento ticket-preview-body não encontrado!');
    return;
  }
  
  currentPreviewTicket = ticket; // Store for later use
  window.currentPreviewTicket = ticket; // Expor globalmente para menções
  
  try {
    const html = `
    <div class="ticket-preview-header">
      <div class="ticket-preview-title-section">
        <div class="ticket-key-large">${ticket.key}</div>
        <div class="ticket-status-badge" style="background: #e3f2fd; color: #1976d2;">${ticket.status.name}</div>
        <div class="ticket-title-large">${ticket.summary}</div>
      </div>
      <div class="ticket-preview-actions">
        <button class="btn-open-jira" id="btn-open-jira-preview" title="Abrir no Jira">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
          Abrir no Jira
        </button>
        <button class="close-preview-btn-large" onclick="hideTicketPreview()">✕</button>
      </div>
    </div>
    
    <div class="ticket-info-grid">
      <!-- Status - EDITÁVEL -->
      <div class="ticket-info-item editable-field">
        <div class="ticket-info-label">
          Status
          <span class="edit-icon" title="Clique para editar">✏️</span>
        </div>
        <div class="ticket-info-value-editable" onclick="makeFieldEditable('status', '${ticket.key}', '${ticket.status.name}')">
          <span id="status-display">${ticket.status.name}</span>
        </div>
      </div>
      
      <!-- Prioridade - EDITÁVEL -->
      <div class="ticket-info-item editable-field">
        <div class="ticket-info-label">
          Prioridade
          <span class="edit-icon" title="Clique para editar">✏️</span>
        </div>
        <div class="ticket-info-value-editable" onclick="makeFieldEditable('priority', '${ticket.key}', '${ticket.priority}')">
          <span id="priority-display">${ticket.priority}</span>
        </div>
      </div>
      
      <!-- Assignee - EDITÁVEL -->
      <div class="ticket-info-item editable-field">
        <div class="ticket-info-label">
          Assignee 
          <span class="edit-icon" title="Clique para editar">✏️</span>
        </div>
        <div class="ticket-info-value-editable" onclick="makeFieldEditable('assignee', '${ticket.key}', '${ticket.assignee?.displayName || ''}')">
          <span id="assignee-display">${ticket.assignee?.displayName || 'Não atribuído'}</span>
        </div>
      </div>
      
      <!-- Reporter - EDITÁVEL -->
      <div class="ticket-info-item editable-field">
        <div class="ticket-info-label">
          Reporter
          <span class="edit-icon" title="Clique para editar">✏️</span>
        </div>
        <div class="ticket-info-value-editable" onclick="makeFieldEditable('reporter', '${ticket.key}', '${ticket.reporter?.displayName || ''}')">
          <span id="reporter-display">${ticket.reporter?.displayName || 'N/A'}</span>
        </div>
      </div>
      
      <!-- Support Level - EDITÁVEL -->
      <div class="ticket-info-item editable-field">
        <div class="ticket-info-label">
          Support Level - ITOPS
          <span class="edit-icon" title="Clique para editar">✏️</span>
        </div>
        <div class="ticket-info-value-editable" onclick="makeFieldEditable('supportLevel', '${ticket.key}', '${ticket.supportLevel || ''}')">
          <span id="supportLevel-display">${ticket.supportLevel || `<span style="color: #999; font-style: italic;">${t('preview.notDefined', 'Not defined')}</span>`}</span>
        </div>
      </div>
      
      <!-- ITOps Team - EDITÁVEL -->
      <div class="ticket-info-item editable-field">
        <div class="ticket-info-label">
          ITOps Team
          <span class="edit-icon" title="Clique para editar">✏️</span>
        </div>
        <div class="ticket-info-value-editable" onclick="makeFieldEditable('team', '${ticket.key}', '${ticket.team || ''}')">
          <span id="team-display">${ticket.team || `<span style="color: #999; font-style: italic;">${t('preview.notDefined', 'Not defined')}</span>`}</span>
        </div>
      </div>
      
      <div class="ticket-info-item">
        <div class="ticket-info-label">${t('preview.created', 'Created')}</div>
        <div class="ticket-info-value">${new Date(ticket.created).toLocaleString(currentLanguage === 'en' ? 'en-US' : (currentLanguage === 'es' ? 'es-ES' : 'pt-BR'))}</div>
      </div>
      <div class="ticket-info-item">
        <div class="ticket-info-label">${t('preview.updated', 'Updated')}</div>
        <div class="ticket-info-value">${new Date(ticket.updated).toLocaleString(currentLanguage === 'en' ? 'en-US' : (currentLanguage === 'es' ? 'es-ES' : 'pt-BR'))}</div>
      </div>
      
      ${ticket.sla ? `
        <!-- Time to First Response -->
        ${ticket.sla.timeToFirstResponse ? (() => {
          const sla = ticket.sla.timeToFirstResponse;
          const cycle = sla.completedCycles?.[0] || sla.ongoingCycle;
          
          if (!cycle) return '';
          
          const goalDuration = cycle.goalDuration?.millis;
          const elapsedTime = cycle.elapsedTime?.millis;
          const remainingTime = cycle.remainingTime?.millis;
          const breachTime = cycle.breachTime?.epochMillis;
          
          let displayValue = '';
          let statusClass = '';
          let statusEmoji = '';
          
          if (sla.completedCycles && sla.completedCycles.length > 0) {
            // SLA já foi completado
            const completedTime = elapsedTime;
            const wasBreached = sla.completedCycles[0].breached;
            
            if (wasBreached) {
              statusEmoji = '🔴';
              statusClass = 'sla-breached';
              displayValue = `Estourado em ${formatDuration(completedTime)}`;
            } else {
              statusEmoji = '✅';
              statusClass = 'sla-met';
              displayValue = `Respondido em ${formatDuration(completedTime)}`;
            }
          } else if (remainingTime) {
            // SLA em andamento
            if (remainingTime < 0) {
              statusEmoji = '🔴';
              statusClass = 'sla-breached';
              displayValue = `Estourado há ${formatDuration(Math.abs(remainingTime))}`;
            } else if (remainingTime < 3600000) { // menos de 1h
              statusEmoji = '🟠';
              statusClass = 'sla-warning';
              displayValue = `${formatDuration(remainingTime)} restante`;
            } else {
              statusEmoji = '🟢';
              statusClass = 'sla-ok';
              displayValue = `${formatDuration(remainingTime)} restante`;
            }
          } else if (goalDuration) {
            displayValue = `Meta: ${formatDuration(goalDuration)}`;
          }
          
          return `
            <div class="ticket-info-item sla-item">
              <div class="ticket-info-label">
                ${statusEmoji} Time to First Response
              </div>
              <div class="ticket-info-value ${statusClass}">
                ${displayValue}
                ${breachTime ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">Meta: ${new Date(breachTime).toLocaleString('pt-BR')}</div>` : ''}
              </div>
            </div>
          `;
        })() : ''}
        
        <!-- Time to Resolution -->
        ${ticket.sla.timeToResolution ? (() => {
          const sla = ticket.sla.timeToResolution;
          const cycle = sla.completedCycles?.[0] || sla.ongoingCycle;
          
          if (!cycle) return '';
          
          const goalDuration = cycle.goalDuration?.millis;
          const elapsedTime = cycle.elapsedTime?.millis;
          const remainingTime = cycle.remainingTime?.millis;
          const breachTime = cycle.breachTime?.epochMillis;
          
          let displayValue = '';
          let statusClass = '';
          let statusEmoji = '';
          
          if (sla.completedCycles && sla.completedCycles.length > 0) {
            // SLA já foi completado
            const completedTime = elapsedTime;
            const wasBreached = sla.completedCycles[0].breached;
            
            if (wasBreached) {
              statusEmoji = '🔴';
              statusClass = 'sla-breached';
              displayValue = `Estourado em ${formatDuration(completedTime)}`;
            } else {
              statusEmoji = '✅';
              statusClass = 'sla-met';
              displayValue = `Resolvido em ${formatDuration(completedTime)}`;
            }
          } else if (remainingTime) {
            // SLA em andamento
            if (remainingTime < 0) {
              statusEmoji = '🔴';
              statusClass = 'sla-breached';
              displayValue = `Estourado há ${formatDuration(Math.abs(remainingTime))}`;
            } else if (remainingTime < 3600000) { // menos de 1h
              statusEmoji = '🟠';
              statusClass = 'sla-warning';
              displayValue = `${formatDuration(remainingTime)} restante`;
            } else {
              statusEmoji = '🟢';
              statusClass = 'sla-ok';
              displayValue = `${formatDuration(remainingTime)} restante`;
            }
          } else if (goalDuration) {
            displayValue = `Meta: ${formatDuration(goalDuration)}`;
          }
          
          return `
            <div class="ticket-info-item sla-item">
              <div class="ticket-info-label">
                ${statusEmoji} Time to Resolution
              </div>
              <div class="ticket-info-value ${statusClass}">
                ${displayValue}
                ${breachTime ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">Meta: ${new Date(breachTime).toLocaleString('pt-BR')}</div>` : ''}
              </div>
            </div>
          `;
        })() : ''}
      ` : ''}
    </div>
    
    <div class="ticket-section">
      <h3 class="ticket-section-title">📝 Descrição</h3>
      <div class="ticket-description">${ticket.description}</div>
    </div>
    
    ${ticket.attachments && ticket.attachments.length > 0 ? `
      <div class="ticket-section">
        <h3 class="ticket-section-title">📎 Anexos (${ticket.attachments.length})</h3>
        <div class="attachments-list">
          ${ticket.attachments.map(att => {
            const isPreviewable = att.mimeType && (
              att.mimeType.startsWith('image/') || 
              att.mimeType === 'application/pdf' ||
              att.mimeType.startsWith('video/')
            );
            
            let icon = '📄';
            if (att.mimeType) {
              if (att.mimeType.startsWith('image/')) icon = '🖼️';
              else if (att.mimeType === 'application/pdf') icon = '📕';
              else if (att.mimeType.startsWith('video/')) icon = '🎬';
              else if (att.mimeType.includes('word')) icon = '📝';
              else if (att.mimeType.includes('excel') || att.mimeType.includes('spreadsheet')) icon = '📊';
              else if (att.mimeType.includes('powerpoint') || att.mimeType.includes('presentation')) icon = '📊';
              else if (att.mimeType.includes('zip') || att.mimeType.includes('compressed')) icon = '🗜️';
            }
            
            return `
              <div class="attachment-item">
                ${att.mimeType && att.mimeType.startsWith('image/') ? `
                  <img class="attachment-preview" src="" data-attachment-id="${att.id}" alt="${att.filename}">
                ` : `
                  <div class="attachment-icon">${icon}</div>
                `}
                <div class="attachment-name" title="${att.filename}">${att.filename}</div>
                <div class="attachment-meta">${formatFileSize(att.size)} • ${new Date(att.created).toLocaleDateString('pt-BR')}</div>
                <div class="attachment-actions">
                  ${isPreviewable ? `
                    <button class="attachment-btn" onclick="showAttachmentPreview('${att.id}', '${att.filename.replace(/'/g, "\\'")}', '${att.mimeType}')">👁️ Abrir</button>
                  ` : ''}
                  <button class="attachment-btn" onclick="downloadAttachment('${att.id}', '${att.filename.replace(/'/g, "\\'")}')">⬇️ Baixar</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn-primary" style="margin-top: 12px;" onclick="selectAndUploadAttachments('${ticket.key}')">➕ Adicionar Anexo</button>
      </div>
    ` : ''}
    
    <div class="ticket-section">
      <h3 class="ticket-section-title">💬 Comentários (${ticket.comments?.length || 0})</h3>
      <div class="ticket-comments">
        ${(ticket.comments && Array.isArray(ticket.comments) && ticket.comments.length > 0) ? ticket.comments.map(comment => `
          <div class="comment-item" data-comment-id="${comment.id}">
            <div class="comment-header">
              <span class="comment-author">${comment.author}</span>
              ${comment.isInternal ? '<span class="comment-badge">🔒 Interno</span>' : ''}
              <span class="comment-date">${new Date(comment.created).toLocaleString('pt-BR')}</span>
              ${comment.authorAccountId === currentUser?.accountId ? `
                <div class="comment-actions-buttons">
                  <button class="comment-edit-btn" onclick="editComment('${ticket.key}', '${comment.id}')" title="Editar">✏️</button>
                  <button class="comment-delete-btn" onclick="deleteComment('${ticket.key}', '${comment.id}')" title="Deletar">🗑️</button>
                </div>
              ` : ''}
            </div>
            <div class="comment-body" id="comment-body-${comment.id}">${comment.body}</div>
          </div>
        `).join('') : '<p class="no-comments-msg">Nenhum comentário ainda</p>'}
      </div>
      
      <div class="add-comment-section">
        <div class="comment-input-container" style="position: relative;">
          <textarea 
            class="comment-textarea" 
            id="new-comment-textarea-${ticket.key}"
            placeholder="Adicionar comentário... (use @ para mencionar)" 
            oninput="checkForMentions('${ticket.key}', this.value)"
            onkeydown="return !handleMentionKeyboard('${ticket.key}', event)"
            rows="4"></textarea>
          <div class="mention-suggestions" id="mention-suggestions-${ticket.key}" style="display: none;"></div>
        </div>
        <div class="comment-actions">
          <div class="comment-checkbox">
            <input type="checkbox" id="internal-comment-checkbox-${ticket.key}">
            <label for="internal-comment-checkbox-${ticket.key}">🔒 Comentário interno</label>
          </div>
          <button class="btn-canned-responses" onclick="openCannedResponses('${ticket.key}')" title="Respostas Prontas">
            📋 Respostas Prontas
          </button>
          <button class="btn-primary" onclick="addComment('${ticket.key}')">💬 Enviar Comentário</button>
        </div>
      </div>
    </div>
  `;
  
  body.innerHTML = html;
  
  // Add event listener for open in Jira button
  const btnOpenJira = document.getElementById('btn-open-jira-preview');
  if (btnOpenJira) {
    btnOpenJira.addEventListener('click', () => {
      openCurrentTicketInJira();
    });
  }
  
    // Carregar previews de imagens
    ticket.attachments?.forEach(att => {
      if (att.mimeType && att.mimeType.startsWith('image/')) {
        loadAttachmentPreview(att.id);
      }
    });
    
    debugLog('✅ Preview renderizado com sucesso');
  } catch (err) {
    console.error('❌ Erro ao renderizar preview:', err);
    console.error('Stack:', err.stack);
    body.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <h3>Erro ao exibir ticket</h3>
        <p style="color: #666; margin: 20px 0;">${err.message}</p>
        <button class="btn-primary" onclick="closeTicketPreview()">Fechar</button>
      </div>
    `;
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(milliseconds) {
  if (!milliseconds || milliseconds === 0) return '0m';
  
  const seconds = Math.floor(Math.abs(milliseconds) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  if (minutes > 0) {
    return `${minutes}m`;
  }
  
  return `${seconds}s`;
}

function updateTicketSlaDisplay(ticketKey, slaInfo) {
  const slaContainer = document.getElementById(`sla-${ticketKey}`);
  if (!slaContainer) return;
  
  // Se não houver SLA, esconder completamente a seção
  if (!slaInfo || (!slaInfo.timeToFirstResponse && !slaInfo.timeToResolution)) {
    slaContainer.innerHTML = '';
    slaContainer.style.display = 'none';
    return;
  }
  
  let html = '<div class="sla-container">';
  
  // Time to First Response
  if (slaInfo.timeToFirstResponse) {
    const sla = slaInfo.timeToFirstResponse;
    const cycle = sla.completedCycles?.[0] || sla.ongoingCycle;
    
    if (cycle) {
      const remainingTime = cycle.remainingTime?.millis;
      const elapsedTime = cycle.elapsedTime?.millis;
      let emoji = '';
      let color = '';
      let text = '';
      let dateTime = '';
      
      // Formatar data/hora - usar breachTime (quando vai estourar) ou stopTime (quando foi completado)
      if (sla.completedCycles && sla.completedCycles.length > 0) {
        // SLA completado - mostrar quando foi resolvido
        if (cycle.stopTime?.iso8601) {
          const date = new Date(cycle.stopTime.iso8601);
          dateTime = date.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
        
        if (sla.completedCycles[0].breached) {
          emoji = '🔴';
          color = '#ef4444';
          text = `Estourado: ${formatDuration(elapsedTime)}`;
        } else {
          emoji = '✅';
          color = '#10b981';
          text = `OK: ${formatDuration(elapsedTime)}`;
        }
      } else if (remainingTime) {
        // SLA em andamento - mostrar quando vai estourar (breachTime)
        if (cycle.breachTime?.iso8601) {
          const date = new Date(cycle.breachTime.iso8601);
          dateTime = date.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
        
        if (remainingTime < 0) {
          emoji = '🔴';
          color = '#ef4444';
          text = `Estourado há ${formatDuration(Math.abs(remainingTime))}`;
        } else if (remainingTime < 3600000) {
          emoji = '🟠';
          color = '#f59e0b';
          text = `${formatDuration(remainingTime)} restante`;
        } else {
          emoji = '🟢';
          color = '#10b981';
          text = `${formatDuration(remainingTime)} restante`;
        }
      }
      
      html += `<div class="sla-row">
        <span class="sla-emoji">${emoji}</span>
        <span class="sla-label" style="color: ${color}; font-weight: 600;">First Response:</span>
        <span class="sla-status" style="color: #666;">${text}</span>
        ${dateTime ? `<span class="sla-datetime" style="margin-left: auto;">${dateTime}</span>` : ''}
      </div>`;
    }
  }
  
  // Time to Resolution
  if (slaInfo.timeToResolution) {
    const sla = slaInfo.timeToResolution;
    const cycle = sla.completedCycles?.[0] || sla.ongoingCycle;
    
    if (cycle) {
      const remainingTime = cycle.remainingTime?.millis;
      const elapsedTime = cycle.elapsedTime?.millis;
      let emoji = '';
      let color = '';
      let text = '';
      let dateTime = '';
      
      // Formatar data/hora - usar breachTime (quando vai estourar) ou stopTime (quando foi completado)
      if (sla.completedCycles && sla.completedCycles.length > 0) {
        // SLA completado - mostrar quando foi resolvido
        if (cycle.stopTime?.iso8601) {
          const date = new Date(cycle.stopTime.iso8601);
          dateTime = date.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
        
        if (sla.completedCycles[0].breached) {
          emoji = '🔴';
          color = '#ef4444';
          text = `Estourado: ${formatDuration(elapsedTime)}`;
        } else {
          emoji = '✅';
          color = '#10b981';
          text = `OK: ${formatDuration(elapsedTime)}`;
        }
      } else if (remainingTime) {
        // SLA em andamento - mostrar quando vai estourar (breachTime)
        if (cycle.breachTime?.iso8601) {
          const date = new Date(cycle.breachTime.iso8601);
          dateTime = date.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
        
        if (remainingTime < 0) {
          emoji = '🔴';
          color = '#ef4444';
          text = `Estourado há ${formatDuration(Math.abs(remainingTime))}`;
        } else if (remainingTime < 3600000) {
          emoji = '🟠';
          color = '#f59e0b';
          text = `${formatDuration(remainingTime)} restante`;
        } else {
          emoji = '🟢';
          color = '#10b981';
          text = `${formatDuration(remainingTime)} restante`;
        }
      }
      
      html += `<div class="sla-row">
        <span class="sla-emoji">${emoji}</span>
        <span class="sla-label" style="color: ${color}; font-weight: 600;">Resolution:</span>
        <span class="sla-status" style="color: #666;">${text}</span>
        ${dateTime ? `<span class="sla-datetime" style="margin-left: auto;">${dateTime}</span>` : ''}
      </div>`;
    }
  }
  
  html += '</div>';
  slaContainer.innerHTML = html;
}

async function loadAttachmentPreview(attachmentId) {
  try {
    const result = await ipcRenderer.invoke('get-attachment-url', attachmentId);
    if (result.success) {
      const response = await fetch(result.url, {
        headers: {
          'Authorization': `Basic ${btoa(`${result.auth.email}:${result.auth.apiToken}`)}`
        }
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const img = document.querySelector(`img[data-attachment-id="${attachmentId}"]`);
      if (img) {
        img.src = url;
      }
    }
  } catch (error) {
    console.error('Erro ao carregar preview:', error);
  }
}

async function downloadAttachment(attachmentId, filename) {
  try {
    const result = await ipcRenderer.invoke('download-attachment', attachmentId, filename);
    if (result.success) {
      showToast(t('attachment.downloadSuccess'), 'success');
    } else if (!result.cancelled) {
      showToast(t('attachment.downloadError'), 'error');
    }
  } catch (error) {
    console.error('Erro ao baixar anexo:', error);
    showToast(t('attachment.downloadError'), 'error');
  }
}

async function selectAndUploadAttachments(ticketKey) {
  try {
    const selectResult = await ipcRenderer.invoke('select-attachment-files');
    
    if (selectResult.cancelled || !selectResult.filePaths || selectResult.filePaths.length === 0) {
      return;
    }
    
    showToast(t('attachment.uploading'), 'info');
    
    const result = await ipcRenderer.invoke('add-attachment', ticketKey, selectResult.filePaths);
    
    if (result.success) {
      showToast(t('attachment.uploadSuccess'), 'success');
      // Recarregar preview
      setTimeout(() => openTicketPreview(ticketKey), 1000);
    } else {
      showToast(t('attachment.uploadError'), 'error');
    }
  } catch (error) {
    console.error('Erro ao enviar anexo:', error);
    showToast(t('attachment.uploadError'), 'error');
  }
}

// Verificar menções enquanto digita
let mentionTimeout = null;
let mentionUsers = {};
let selectedMentionIndex = {};
let currentMentionUsers = {};

// Função para obter envolvidos do ticket (reporter, assignee, comentaristas)
function getTicketInvolved() {
  const currentTicket = window.currentPreviewTicket;
  if (!currentTicket) return [];
  
  const involved = [];
  const addedIds = new Set();
  
  // 1. Reporter (quem abriu o ticket) - PRIORIDADE MÁXIMA
  if (currentTicket.reporter && currentTicket.reporter.accountId) {
    involved.push({
      ...currentTicket.reporter,
      _role: 'reporter'
    });
    addedIds.add(currentTicket.reporter.accountId);
  }
  
  // 2. Assignee (responsável)
  if (currentTicket.assignee && currentTicket.assignee.accountId && !addedIds.has(currentTicket.assignee.accountId)) {
    involved.push({
      ...currentTicket.assignee,
      _role: 'assignee'
    });
    addedIds.add(currentTicket.assignee.accountId);
  }
  
  // 3. Comentaristas (pessoas que comentaram)
  if (currentTicket.comments && Array.isArray(currentTicket.comments)) {
    currentTicket.comments.forEach(comment => {
      if (comment.authorAccountId && !addedIds.has(comment.authorAccountId)) {
        involved.push({
          displayName: comment.author,
          accountId: comment.authorAccountId,
          emailAddress: null,
          _role: 'commenter'
        });
        addedIds.add(comment.authorAccountId);
      }
    });
  }
  
  return involved;
}

async function checkForMentions(ticketKey, text) {
  clearTimeout(mentionTimeout);
  
  const suggestionsDiv = document.getElementById(`mention-suggestions-${ticketKey}`);
  if (!suggestionsDiv) return;
  
  // Procurar @ seguido de texto
  const atIndex = text.lastIndexOf('@');
  if (atIndex === -1) {
    suggestionsDiv.style.display = 'none';
    selectedMentionIndex[ticketKey] = -1;
    return;
  }
  
  // Verificar se o @ está no final ou seguido de texto (não de espaço)
  const afterAt = text.substring(atIndex + 1);
  const spaceIndex = afterAt.search(/[\s\n]/);
  const query = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
  
  // Se há espaço depois do @query, não mostrar sugestões
  if (spaceIndex !== -1 && spaceIndex < afterAt.length) {
    suggestionsDiv.style.display = 'none';
    return;
  }
  
  // MOSTRAR IMEDIATAMENTE os envolvidos quando digita apenas @
  if (query.length === 0) {
    const involved = getTicketInvolved();
    
    if (involved.length > 0) {
      debugLog('👥 Mostrando envolvidos do ticket:', involved.map(u => u.displayName));
      currentMentionUsers[ticketKey] = involved;
      selectedMentionIndex[ticketKey] = 0;
      renderMentionSuggestions(ticketKey, involved);
      suggestionsDiv.style.display = 'block';
    } else {
      // Se não há envolvidos, buscar via API
      suggestionsDiv.innerHTML = '<div class="mention-no-results">Carregando...</div>';
      suggestionsDiv.style.display = 'block';
      
      const result = await ipcRenderer.invoke('search-users', 'a');
      if (result && result.success && result.data) {
        const users = result.data.slice(0, 10);
        currentMentionUsers[ticketKey] = users;
        selectedMentionIndex[ticketKey] = 0;
        renderMentionSuggestions(ticketKey, users);
      }
    }
    return;
  }
  
  // Debounce para busca com query
  mentionTimeout = setTimeout(async () => {
    try {
      debugLog(`🔎 Buscando usuários com query "${query}" via API...`);
      
      // Primeiro, filtrar envolvidos localmente
      const involved = getTicketInvolved();
      const queryLower = query.toLowerCase().trim();
      
      const filteredInvolved = involved.filter(user => {
        if (!user.displayName) return false;
        const displayNameLower = user.displayName.toLowerCase();
        const emailLower = (user.emailAddress || '').toLowerCase();
        return displayNameLower.includes(queryLower) || emailLower.includes(queryLower);
      });
      
      // Buscar via API também
      const result = await ipcRenderer.invoke('search-users', query);
      
      let apiUsers = [];
      if (result && result.success && result.data) {
        apiUsers = result.data || [];
      }
      
      // Combinar: envolvidos filtrados primeiro, depois API (sem duplicados)
      const addedIds = new Set(filteredInvolved.map(u => u.accountId));
      const combinedUsers = [...filteredInvolved];
      
      apiUsers.forEach(user => {
        if (!addedIds.has(user.accountId)) {
          combinedUsers.push(user);
          addedIds.add(user.accountId);
        }
      });
      
      // Filtrar por query
      const filtered = combinedUsers.filter(user => {
        if (!user.displayName) return false;
        
        const displayNameLower = user.displayName.toLowerCase();
        const emailLower = (user.emailAddress || '').toLowerCase();
        const emailPrefix = emailLower.split('@')[0];
        
        // Separar nome em partes (primeiro nome, sobrenomes, etc)
        const nameParts = displayNameLower.split(/[\s.]+/).filter(p => p.length > 0);
        
        // Separar email em partes
        const emailParts = emailPrefix.split(/[._-]+/).filter(p => p.length > 0);
        
        // Match se a query está em QUALQUER parte do nome ou email
        const matchesName = nameParts.some(part => part.includes(queryLower));
        const matchesEmail = emailParts.some(part => part.includes(queryLower));
        const matchesFullName = displayNameLower.includes(queryLower);
        const matchesFullEmail = emailPrefix.includes(queryLower);
        
        return matchesName || matchesEmail || matchesFullName || matchesFullEmail;
      })
      .sort((a, b) => {
        // Priorizar por relevância
        const aNameLower = a.displayName.toLowerCase();
        const bNameLower = b.displayName.toLowerCase();
        
        // 1. Nome começa com a query
        const aStartsWith = aNameLower.startsWith(queryLower);
        const bStartsWith = bNameLower.startsWith(queryLower);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        // 2. Alguma parte do nome começa com a query
        const aPartStarts = aNameLower.split(/[\s.]+/).some(p => p.startsWith(queryLower));
        const bPartStarts = bNameLower.split(/[\s.]+/).some(p => p.startsWith(queryLower));
        if (aPartStarts && !bPartStarts) return -1;
        if (!aPartStarts && bPartStarts) return 1;
        
        // 3. Ordem alfabética
        return aNameLower.localeCompare(bNameLower);
      })
      .slice(0, 15); // Mostrar até 15 resultados
      
      debugLog(`✅ ${filtered.length} usuários encontrados com query "${query}"`);
      if (filtered.length > 0) {
        debugLog('👤 Resultados:', filtered.map(u => `${u.displayName} (${u.emailAddress})`));
      }
      
      if (filtered.length > 0) {
        currentMentionUsers[ticketKey] = filtered;
        selectedMentionIndex[ticketKey] = 0; // Selecionar primeiro
        renderMentionSuggestions(ticketKey, filtered);
        suggestionsDiv.style.display = 'block';
      } else {
        suggestionsDiv.innerHTML = '<div class="mention-no-results">Nenhum usuário encontrado</div>';
        suggestionsDiv.style.display = 'block';
        currentMentionUsers[ticketKey] = [];
        selectedMentionIndex[ticketKey] = -1;
      }
    } catch (error) {
      console.error('❌ Erro ao buscar usuários para menção:', error);
      suggestionsDiv.style.display = 'none';
    }
  }, 400); // 🚀 OTIMIZAÇÃO: 400ms ao invés de 200ms (reduz chamadas API)
}

// Renderizar sugestões de menção
function renderMentionSuggestions(ticketKey, users) {
  const suggestionsDiv = document.getElementById(`mention-suggestions-${ticketKey}`);
  if (!suggestionsDiv) return;
  
  const selectedIndex = selectedMentionIndex[ticketKey] || 0;
  
  // Verificar quem é o reporter e assignee do ticket
  const currentTicket = window.currentPreviewTicket;
  const reporterAccountId = currentTicket?.reporter?.accountId;
  const assigneeAccountId = currentTicket?.assignee?.accountId;
  
  let html = '';
  users.forEach((user, index) => {
    const isSelected = index === selectedIndex;
    
    // Determinar papel do usuário
    const isReporter = reporterAccountId && user.accountId === reporterAccountId;
    const isAssignee = assigneeAccountId && user.accountId === assigneeAccountId;
    const role = user._role || (isReporter ? 'reporter' : (isAssignee ? 'assignee' : null));
    
    // Badge baseado no papel
    let badgeHtml = '';
    let roleClass = '';
    if (isReporter || role === 'reporter') {
      badgeHtml = '<span class="mention-role-badge reporter">Reportou</span>';
      roleClass = 'is-reporter';
    } else if (isAssignee || role === 'assignee') {
      badgeHtml = '<span class="mention-role-badge assignee">Responsável</span>';
      roleClass = 'is-assignee';
    } else if (role === 'commenter') {
      badgeHtml = '<span class="mention-role-badge commenter">Comentou</span>';
      roleClass = 'is-commenter';
    }
    
    html += `
      <div class="mention-item ${isSelected ? 'selected' : ''} ${roleClass}" 
           data-index="${index}"
           data-ticket-key="${ticketKey}"
           data-display-name="${user.displayName}"
           data-account-id="${user.accountId}"
           onmouseenter="setSelectedMention('${ticketKey}', ${index})">
        <div class="mention-avatar ${roleClass ? roleClass + '-avatar' : ''}">
          ${user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}
        </div>
        <div class="mention-info">
          <div class="mention-name">
            @${escapeHtml(user.displayName || 'Usuário')}
            ${badgeHtml}
          </div>
          ${user.emailAddress ? `<div class="mention-email">${escapeHtml(user.emailAddress)}</div>` : ''}
        </div>
      </div>
    `;
  });
  
  suggestionsDiv.innerHTML = html;
  
  // FORÇAR estilos inline para garantir que funcione
  suggestionsDiv.style.position = 'absolute';
  suggestionsDiv.style.zIndex = '999999'; // MUITO alto
  suggestionsDiv.style.pointerEvents = 'auto';
  suggestionsDiv.style.display = 'block';
  
  debugLog('🎨 Renderizou', users.length, 'sugestões de menção para ticket', ticketKey);
  debugLog('📍 SuggestionsDiv:', suggestionsDiv);
  debugLog('🎨 Estilos computed:', {
    display: getComputedStyle(suggestionsDiv).display,
    zIndex: getComputedStyle(suggestionsDiv).zIndex,
    pointerEvents: getComputedStyle(suggestionsDiv).pointerEvents,
    position: getComputedStyle(suggestionsDiv).position
  });
  
  // Teste para ver qual elemento está realmente sob o cursor
  setTimeout(() => {
    const rect = suggestionsDiv.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    debugLog('🎯 Elemento no centro do suggestionsDiv:', elementAtPoint);
    debugLog('🎯 É o suggestionsDiv ou filho?', suggestionsDiv.contains(elementAtPoint));
    debugLog('📏 BoundingRect:', rect);
  }, 100);
  
  // Aguardar DOM estar pronto e adicionar listeners
  setTimeout(() => {
    debugLog('⏰ Adicionando listeners após render...');
    
    // Event handler usando mousedown (mais confiável)
    const mousedownHandler = function(e) {
      debugLog('🖱️ MOUSEDOWN detectado!', e.target);
      
      // Buscar o elemento .mention-item mais próximo
      const mentionItem = e.target.closest('.mention-item');
      
      if (mentionItem) {
        debugLog('✅ Encontrou .mention-item:', mentionItem);
        debugLog('📦 Datasets:', mentionItem.dataset);
        
        e.preventDefault();
        e.stopPropagation();
        
        const tKey = mentionItem.dataset.ticketKey;
        const dName = mentionItem.dataset.displayName;
        const aId = mentionItem.dataset.accountId;
        
        debugLog('🔑 Extraindo dados:', { tKey, dName, aId });
        
        if (tKey && dName && aId) {
          insertMention(tKey, dName, aId);
          // Esconder sugestões imediatamente
          suggestionsDiv.style.display = 'none';
        } else {
          console.error('❌ Dados inválidos:', mentionItem.dataset);
        }
      } else {
        debugLog('⚠️ Click fora de .mention-item');
      }
    };
    
    // REMOVER listeners antigos
    if (suggestionsDiv._mousedownHandler) {
      suggestionsDiv.removeEventListener('mousedown', suggestionsDiv._mousedownHandler, true);
    }
    
    // Adicionar listener com capture=true (captura ANTES de qualquer outro)
    suggestionsDiv.addEventListener('mousedown', mousedownHandler, true);
    suggestionsDiv._mousedownHandler = mousedownHandler;
    
    debugLog('✅ Listener MOUSEDOWN adicionado ao suggestionsDiv');
    
    // Também adicionar diretamente em cada item como fallback
    const items = suggestionsDiv.querySelectorAll('.mention-item');
    items.forEach((item, idx) => {
      item.addEventListener('mousedown', function(e) {
        debugLog(`🎯 MOUSEDOWN DIRETO no item ${idx}`);
        e.stopPropagation();
        
        const tKey = this.dataset.ticketKey;
        const dName = this.dataset.displayName;
        const aId = this.dataset.accountId;
        
        if (tKey && dName && aId) {
          insertMention(tKey, dName, aId);
          suggestionsDiv.style.display = 'none';
        }
      }, true);
    });
    
    debugLog(`✅ Listeners diretos adicionados a ${items.length} itens`);
  }, 50); // 50ms de delay
}

// Definir menção selecionada (ao passar mouse)
function setSelectedMention(ticketKey, index) {
  selectedMentionIndex[ticketKey] = index;
  const users = currentMentionUsers[ticketKey] || [];
  if (users.length > 0) {
    renderMentionSuggestions(ticketKey, users);
  }
}

// Navegar pelas sugestões com teclado
function handleMentionKeyboard(ticketKey, event) {
  const suggestionsDiv = document.getElementById(`mention-suggestions-${ticketKey}`);
  if (!suggestionsDiv || suggestionsDiv.style.display === 'none') return false;
  
  const users = currentMentionUsers[ticketKey] || [];
  if (users.length === 0) return false;
  
  let currentIndex = selectedMentionIndex[ticketKey] || 0;
  
  switch(event.key) {
    case 'ArrowDown':
      event.preventDefault();
      currentIndex = Math.min(currentIndex + 1, users.length - 1);
      selectedMentionIndex[ticketKey] = currentIndex;
      renderMentionSuggestions(ticketKey, users);
      scrollToSelectedMention(ticketKey);
      return true;
      
    case 'ArrowUp':
      event.preventDefault();
      currentIndex = Math.max(currentIndex - 1, 0);
      selectedMentionIndex[ticketKey] = currentIndex;
      renderMentionSuggestions(ticketKey, users);
      scrollToSelectedMention(ticketKey);
      return true;
      
    case 'Enter':
    case 'Tab':
      event.preventDefault();
      const selectedUser = users[currentIndex];
      if (selectedUser) {
        insertMention(ticketKey, selectedUser.displayName, selectedUser.accountId);
      }
      return true;
      
    case 'Escape':
      event.preventDefault();
      suggestionsDiv.style.display = 'none';
      selectedMentionIndex[ticketKey] = -1;
      return true;
  }
  
  return false;
}

// Scroll para a sugestão selecionada
function scrollToSelectedMention(ticketKey) {
  const suggestionsDiv = document.getElementById(`mention-suggestions-${ticketKey}`);
  if (!suggestionsDiv) return;
  
  const selectedItem = suggestionsDiv.querySelector('.mention-item.selected');
  if (selectedItem) {
    selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Escape HTML para prevenir XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Inserir menção a partir do elemento clicado (data-attributes)
function insertMentionFromElement(element) {
  debugLog('🖱️ Clicou em elemento de menção:', element);
  
  // Se clicou em um elemento filho, buscar o pai com a classe mention-item
  let mentionItem = element;
  if (!mentionItem.classList.contains('mention-item')) {
    mentionItem = element.closest('.mention-item');
  }
  
  if (!mentionItem) {
    console.error('❌ Elemento .mention-item não encontrado');
    return;
  }
  
  debugLog('📋 Elemento mention-item encontrado:', mentionItem);
  debugLog('📋 Datasets disponíveis:', mentionItem.dataset);
  
  const ticketKey = mentionItem.dataset.ticketKey;
  const displayName = mentionItem.dataset.displayName;
  const accountId = mentionItem.dataset.accountId;
  
  debugLog('🔑 Dados extraídos:', { ticketKey, displayName, accountId });
  
  if (!ticketKey || !displayName || !accountId) {
    console.error('❌ Dados de menção inválidos:', { ticketKey, displayName, accountId });
    console.error('❌ Elemento HTML:', mentionItem.outerHTML);
    return;
  }
  
  insertMention(ticketKey, displayName, accountId);
}

// Inserir menção no texto
function insertMention(ticketKey, displayName, accountId) {
  debugLog('📝 Inserindo menção:', { ticketKey, displayName, accountId });
  
  const textarea = document.getElementById(`new-comment-textarea-${ticketKey}`);
  if (!textarea) {
    console.error('❌ Textarea não encontrado:', `new-comment-textarea-${ticketKey}`);
    return;
  }
  
  const text = textarea.value;
  const atIndex = text.lastIndexOf('@');
  
  if (atIndex === -1) {
    console.warn('⚠️ Símbolo @ não encontrado no texto');
    return;
  }
  
  // Substituir @query por @displayName
  const before = text.substring(0, atIndex);
  const after = text.substring(atIndex).replace(/@[^\s]*/, `@${displayName} `);
  textarea.value = before + after;
  
  debugLog('✅ Texto atualizado:', textarea.value);
  
  // Guardar accountId para envio
  if (!textarea.dataset.mentions) {
    textarea.dataset.mentions = JSON.stringify({});
  }
  const mentions = JSON.parse(textarea.dataset.mentions);
  mentions[displayName] = accountId;
  textarea.dataset.mentions = JSON.stringify(mentions);
  
  debugLog('✅ Menções salvas:', mentions);
  
  // Esconder sugestões
  const suggestionsDiv = document.getElementById(`mention-suggestions-${ticketKey}`);
  if (suggestionsDiv) {
    suggestionsDiv.style.display = 'none';
  }
  
  // Focar no textarea
  textarea.focus();
}

// Adicionar comentário
async function addComment(ticketKey) {
  const textarea = document.getElementById(`new-comment-textarea-${ticketKey}`);
  const isInternal = document.getElementById(`internal-comment-checkbox-${ticketKey}`).checked;
  const commentBody = textarea.value.trim();
  
  if (!commentBody) {
    showToast(t('general.error'), t('comment.empty'), 'error');
    return;
  }
  
  try {
    showToast(t('general.sending'), t('comment.sending'), 'info');
    
    // Extrair menções
    const mentions = textarea.dataset.mentions ? JSON.parse(textarea.dataset.mentions) : {};
    
    const result = await ipcRenderer.invoke('add-comment', {
      ticketKey,
      commentBody,
      isInternal,
      mentions
    });
    
    if (result.success) {
      showToast(t('general.success'), t('comment.sent'), 'success');
      textarea.value = '';
      textarea.dataset.mentions = '';
      
      // Rastrear comentário adicionado
      const ticket = searchTickets.find(t => t.key === ticketKey);
      const ticketSummary = ticket?.summary || ticket?.fields?.summary || ticketKey;
      trackCommentAdded(ticketKey, ticketSummary);
      
      // Recarregar preview
      setTimeout(() => openTicketPreview(ticketKey), 1000);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Erro ao enviar comentário:', error);
    showToast(t('general.error'), error.message || t('comment.sendFailed'), 'error');
  }
}

// Editar comentário
async function editComment(ticketKey, commentId) {
  const commentBody = document.getElementById(`comment-body-${commentId}`);
  if (!commentBody) return;
  
  // Pegar texto atual (remover HTML)
  const currentText = commentBody.innerText || commentBody.textContent || '';
  
  // Substituir por textarea para edição
  const originalHtml = commentBody.innerHTML;
  commentBody.innerHTML = `
    <div class="edit-comment-container">
      <textarea class="edit-comment-textarea" id="edit-textarea-${commentId}" rows="4">${currentText}</textarea>
      <div class="edit-comment-actions">
        <button class="btn-save-comment" onclick="saveEditedComment('${ticketKey}', '${commentId}')">💾 Salvar</button>
        <button class="btn-cancel-comment" onclick="cancelEditComment('${commentId}', '${encodeURIComponent(originalHtml)}')">❌ Cancelar</button>
      </div>
    </div>
  `;
  
  // Focar no textarea
  document.getElementById(`edit-textarea-${commentId}`)?.focus();
}

// Salvar comentário editado
async function saveEditedComment(ticketKey, commentId) {
  const textarea = document.getElementById(`edit-textarea-${commentId}`);
  if (!textarea) return;
  
  const newBody = textarea.value.trim();
  if (!newBody) {
    showToast(t('general.error'), t('comment.empty'), 'error');
    return;
  }
  
  try {
    showToast(t('general.saving'), t('comment.updating'), 'info');
    
    const result = await ipcRenderer.invoke('update-comment', ticketKey, commentId, newBody);
    
    if (result.success) {
      showToast(t('general.success'), t('comment.updated'), 'success');
      // Recarregar preview
      setTimeout(() => openTicketPreview(ticketKey), 500);
    } else {
      throw new Error(result.error || 'Erro ao atualizar');
    }
  } catch (error) {
    console.error('Erro ao atualizar comentário:', error);
    showToast(t('general.error'), error.message || t('comment.updateFailed'), 'error');
  }
}

// Cancelar edição de comentário
function cancelEditComment(commentId, originalHtmlEncoded) {
  const commentBody = document.getElementById(`comment-body-${commentId}`);
  if (commentBody) {
    commentBody.innerHTML = decodeURIComponent(originalHtmlEncoded);
  }
}

// Deletar comentário
async function deleteComment(ticketKey, commentId) {
  if (!confirm('Tem certeza que deseja deletar este comentário?')) {
    return;
  }
  
  try {
    showToast(t('general.deleting'), t('comment.deleting'), 'info');
    
    const result = await ipcRenderer.invoke('delete-comment', ticketKey, commentId);
    
    if (result.success) {
      showToast(t('general.success'), t('comment.deleted'), 'success');
      // Recarregar preview
      setTimeout(() => openTicketPreview(ticketKey), 500);
    } else {
      throw new Error(result.error || 'Erro ao deletar');
    }
  } catch (error) {
    console.error('Erro ao deletar comentário:', error);
    showToast(t('general.error'), error.message || t('comment.deleteFailed'), 'error');
  }
}

// Upload de anexos
async function selectAndUploadAttachments(ticketKey) {
  try {
    const result = await ipcRenderer.invoke('select-and-upload-attachments', ticketKey);
    
    if (result.success) {
      showToast(t('general.success'), `${result.count} ${t('attachment.sent')}`, 'success');
      // Recarregar preview
      setTimeout(() => openTicketPreview(ticketKey), 1000);
    } else if (!result.cancelled) {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Erro ao enviar anexos:', error);
    showToast(t('general.error'), error.message || t('attachment.uploadError'), 'error');
  }
}

function hideTicketPreview() {
  document.getElementById('ticket-preview-modal').style.display = 'none';
  currentPreviewTicket = null;
}

function openCurrentTicketInJira() {
  if (!currentPreviewTicket) return;
  const baseUrl = currentConfig.jiraUrl || 'https://your-company.atlassian.net';
  const url = `${baseUrl}/browse/${currentPreviewTicket.key}`;
  ipcRenderer.invoke('open-url', url);
}

// Tornar campo editável inline
async function makeFieldEditable(fieldName, ticketKey, currentValue) {
  const displayElement = document.getElementById(`${fieldName}-display`);
  if (!displayElement) {
    console.error(`Elemento ${fieldName}-display não encontrado`);
    return;
  }
  
  const parent = displayElement.parentElement;
  parent.onclick = null; // Remove o onclick temporariamente
  
  // Garantir que o valor não seja undefined ou null
  const safeValue = currentValue || '';
  
  // Para STATUS, buscar transições disponíveis do Jira
  if (fieldName === 'status') {
    if (!currentPreviewTicket || !currentPreviewTicket.availableTransitions) {
      showToast(t('general.error'), t('status.transitionsUnavailable'), 'error');
      return;
    }
    
    const transitions = currentPreviewTicket.availableTransitions;
    
    parent.innerHTML = `
      <select class="inline-edit-select" id="${fieldName}-edit" onchange="saveField('${fieldName}', '${ticketKey}', this.value)" style="background: #e3f2fd; color: #1976d2; border: 2px solid #1976d2;">
        <option value="">Status Atual: ${safeValue}</option>
        ${transitions.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
      </select>
    `;
    return;
  }
  
  // Para PRIORIDADE, buscar prioridades do Jira
  if (fieldName === 'priority') {
    // Mostrar loading
    parent.innerHTML = '<span style="color: #666;">Carregando prioridades...</span>';
    
    try {
      const result = await ipcRenderer.invoke('get-jira-priorities');
      
      if (!result.success || !result.data || result.data.length === 0) {
        // Fallback com prioridades padrão do Jira
        const priorities = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
        parent.innerHTML = `
          <select class="inline-edit-select" id="${fieldName}-edit" onchange="saveField('${fieldName}', '${ticketKey}', this.value)">
            <option value="">Prioridade Atual: ${safeValue}</option>
            ${priorities.map(p => `<option value="${p}">${p}</option>`).join('')}
          </select>
        `;
      } else {
        const priorities = result.data;
        parent.innerHTML = `
          <select class="inline-edit-select" id="${fieldName}-edit" onchange="saveField('${fieldName}', '${ticketKey}', this.value)">
            <option value="">Prioridade Atual: ${safeValue}</option>
            ${priorities.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
          </select>
        `;
      }
    } catch (error) {
      console.error('Erro ao buscar prioridades:', error);
      parent.innerHTML = `<span style="color: #ff5252;">Erro ao carregar prioridades</span>`;
      setTimeout(() => {
        parent.innerHTML = `<span id="${fieldName}-display" onclick="makeFieldEditable('${fieldName}', '${ticketKey}', '${safeValue}')">${safeValue}</span>`;
      }, 2000);
    }
    return;
  }
  
  // Para Support Level, usar dropdown simples
  if (fieldName === 'supportLevel') {
    parent.innerHTML = `
      <select class="inline-edit-select" id="${fieldName}-edit" onchange="saveField('${fieldName}', '${ticketKey}', this.value, this.value)">
        <option value="L1" ${safeValue === 'L1' ? 'selected' : ''}>L1</option>
        <option value="L2" ${safeValue === 'L2' ? 'selected' : ''}>L2</option>
        <option value="L3" ${safeValue === 'L3' ? 'selected' : ''}>L3</option>
      </select>
    `;
    return;
  }
  
  // Para ITOps Team, buscar opções do Jira e usar dropdown
  if (fieldName === 'team') {
    const teamsResult = await ipcRenderer.invoke('get-itops-team-options');
    if (teamsResult.success && teamsResult.data) {
      const optionsHtml = teamsResult.data.map(team =>
        `<option value="${team}" ${currentValue === team ? 'selected' : ''}>${team}</option>`
      ).join('');
      parent.innerHTML = `
        <select class="inline-edit-select" id="${fieldName}-edit" onchange="saveField('${fieldName}', '${ticketKey}', this.value, this.value)">
          ${optionsHtml}
        </select>
      `;
    } else {
      showToast(t('general.error'), t('status.teamsLoadError'), 'error');
      cancelEdit(fieldName, currentValue);
    }
    return;
  }
  
  // Para Assignee e Reporter, usar input com autocomplete
  if (fieldName === 'assignee' || fieldName === 'reporter') {
    parent.innerHTML = `
      <div class="autocomplete-container" style="flex: 1; position: relative;">
        <input 
          type="text" 
          class="inline-edit-input" 
          id="${fieldName}-edit" 
          value="${safeValue}" 
          placeholder="Digite para buscar..."
          autocomplete="off"
          oninput="searchUsers('${fieldName}', '${ticketKey}', this.value)"
          style="flex: 1; width: 100%;"
        >
        <div class="autocomplete-suggestions" id="${fieldName}-suggestions" style="display: none;"></div>
      </div>
      <button 
        class="inline-save-btn" 
        onclick="event.stopPropagation(); saveFieldFromInput('${fieldName}', '${ticketKey}')"
        title="Salvar">
        💾
      </button>
      <button 
        class="inline-cancel-btn" 
        onclick="event.stopPropagation(); cancelEdit('${fieldName}', '${safeValue}')"
        title="Cancelar">
        ✕
      </button>
    `;
    
    // Focar no input
    setTimeout(() => {
      const input = document.getElementById(`${fieldName}-edit`);
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  }
}

// Buscar usuários enquanto digita
let searchTimeout = null;
let cachedUsers = {};

async function searchUsers(fieldName, ticketKey, query) {
  clearTimeout(searchTimeout);
  
  const suggestionsDiv = document.getElementById(`${fieldName}-suggestions`);
  if (!suggestionsDiv) return;
  
  // Se query vazio, esconder sugestões
  if (!query || query.trim().length < 2) {
    suggestionsDiv.style.display = 'none';
    return;
  }
  
  // 🚀 OTIMIZAÇÃO: Debounce de 600ms (reduz chamadas à API)
  searchTimeout = setTimeout(async () => {
    try {
      // Mostrar loading
      suggestionsDiv.innerHTML = '<div class="autocomplete-loading">🔍 Buscando...</div>';
      suggestionsDiv.style.display = 'block';
      
      // Buscar usuários
      const projectKey = ticketKey.split('-')[0];
      
      // Cache de usuários por projeto
      if (!cachedUsers[projectKey]) {
        const result = await ipcRenderer.invoke('get-assignable-users', projectKey);
        if (result.success && result.data) {
          cachedUsers[projectKey] = result.data;
        } else {
          throw new Error('Falha ao buscar usuários');
        }
      }
      
      const users = cachedUsers[projectKey];
      
      // Filtrar usuários que contenham a query
      const queryLower = query.toLowerCase();
      const filtered = users.filter(user => 
        user.displayName.toLowerCase().includes(queryLower) ||
        (user.emailAddress && user.emailAddress.toLowerCase().includes(queryLower))
      ).slice(0, 10); // Limitar a 10 resultados
      
      if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="autocomplete-no-results">❌ Nenhum usuário encontrado</div>';
      } else {
        let html = '';
        filtered.forEach(user => {
          html += `
            <div class="autocomplete-item" onclick="selectUser('${fieldName}', '${user.accountId}', '${user.displayName.replace(/'/g, "\\'")}')">
              <div class="autocomplete-name">${user.displayName}</div>
              ${user.emailAddress ? `<div class="autocomplete-email">${user.emailAddress}</div>` : ''}
            </div>
          `;
        });
        suggestionsDiv.innerHTML = html;
      }
      
      suggestionsDiv.style.display = 'block';
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      suggestionsDiv.innerHTML = '<div class="autocomplete-error">⚠️ Erro ao buscar</div>';
    }
  }, 600); // 600ms ao invés de 300ms
}

// Selecionar usuário da lista de sugestões
function selectUser(fieldName, accountId, displayName) {
  const input = document.getElementById(`${fieldName}-edit`);
  if (input) {
    input.value = displayName;
    input.setAttribute('data-account-id', accountId);
    input.setAttribute('data-display-name', displayName);
  }
  
  const suggestionsDiv = document.getElementById(`${fieldName}-suggestions`);
  if (suggestionsDiv) {
    suggestionsDiv.style.display = 'none';
  }
}

// Salvar campo a partir do input
async function saveFieldFromInput(fieldName, ticketKey) {
  const input = document.getElementById(`${fieldName}-edit`);
  if (!input) return;
  
  const accountId = input.getAttribute('data-account-id');
  const displayName = input.getAttribute('data-display-name') || input.value;
  
  if (!accountId) {
    // Se não tem accountId, tentar buscar pelo texto digitado
    await saveField(fieldName, ticketKey, input.value, displayName);
  } else {
    // Se tem accountId, usar ele
    await saveField(fieldName, ticketKey, accountId, displayName);
  }
}

// Salvar campo direto do input (para campos que não precisam de accountId)
async function saveFieldFromInputDirect(fieldName, ticketKey) {
  const input = document.getElementById(`${fieldName}-edit`);
  if (!input) return;
  
  const value = input.value.trim();
  if (!value) {
    showToast(t('general.error'), t('field.enterValue'), 'error');
    return;
  }
  
  await saveField(fieldName, ticketKey, value);
}

// Buscar times enquanto digita
let searchTeamTimeout = null;
let cachedTeams = null;

async function searchTeams(fieldName, query) {
  clearTimeout(searchTeamTimeout);
  
  const suggestionsDiv = document.getElementById(`${fieldName}-suggestions`);
  if (!suggestionsDiv) return;
  
  // Se query vazio, esconder sugestões
  if (!query || query.trim().length < 1) {
    suggestionsDiv.style.display = 'none';
    return;
  }
  
  // Debounce
  searchTeamTimeout = setTimeout(async () => {
    try {
      // Buscar times do Jira (com cache)
      if (!cachedTeams) {
        suggestionsDiv.innerHTML = '<div class="autocomplete-loading">🔍 Carregando times do Jira...</div>';
        suggestionsDiv.style.display = 'block';
        
        const result = await ipcRenderer.invoke('get-itops-team-options');
        if (result.success && result.data) {
          cachedTeams = result.data;
          debugLog('✅ Times carregados do Jira:', cachedTeams);
        } else {
          throw new Error('Falha ao carregar times');
        }
      }
      
      // Filtrar times que contenham a query
      const queryLower = query.toLowerCase();
      const filtered = cachedTeams.filter(team => 
        team.toLowerCase().includes(queryLower)
      );
      
      if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="autocomplete-no-results">❌ Nenhum time encontrado</div>';
        suggestionsDiv.style.display = 'block';
      } else {
        let html = '';
        filtered.forEach(team => {
          html += `
            <div class="autocomplete-item" onclick="selectTeam('${fieldName}', '${team}')">
              <div class="autocomplete-name">${team}</div>
            </div>
          `;
        });
        suggestionsDiv.innerHTML = html;
        suggestionsDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Erro ao buscar times:', error);
      suggestionsDiv.innerHTML = '<div class="autocomplete-error">⚠️ Erro ao buscar times</div>';
      suggestionsDiv.style.display = 'block';
    }
  }, 400); // 🚀 OTIMIZAÇÃO: 400ms ao invés de 200ms
}

// Selecionar time da lista de sugestões
function selectTeam(fieldName, teamName) {
  const input = document.getElementById(`${fieldName}-edit`);
  if (input) {
    input.value = teamName;
  }
  
  const suggestionsDiv = document.getElementById(`${fieldName}-suggestions`);
  if (suggestionsDiv) {
    suggestionsDiv.style.display = 'none';
  }
}

// Salvar campo editado
async function saveField(fieldName, ticketKey, newValue, displayName = null) {
  if (!newValue || newValue.trim() === '') {
    showToast(t('general.error'), t('field.selectOption'), 'error');
    return;
  }
  
  debugLog(`💾 Salvando ${fieldName}:`, newValue, displayName);
  showToast(t('general.saving'), t('field.saving'), 'info');
  
  try {
    const result = await ipcRenderer.invoke('update-ticket-field', {
      ticketKey,
      fieldName,
      value: newValue,
      displayName
    });
    
    if (result.success) {
      showToast(t('general.success'), t('field.saved'), 'success');
      // Recarregar preview após 800ms
      setTimeout(() => openTicketPreview(ticketKey), 800);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Erro ao salvar campo:', error);
    showToast(t('general.error'), error.message || t('field.saveFailed'), 'error');
  }
}

// Cancelar edição
function cancelEdit(fieldName, originalValue) {
  if (!currentPreviewTicket) return;
  
  // Encontrar o parent container
  const containers = document.querySelectorAll('.ticket-info-value-editable');
  let targetContainer = null;
  
  containers.forEach(container => {
    if (container.innerHTML.includes(`${fieldName}-edit`)) {
      targetContainer = container;
    }
  });
  
  if (targetContainer) {
    // Restaurar o valor original
    const displayValue = originalValue || (fieldName === 'team' ? 'TechCenter' : 'N/A');
    targetContainer.innerHTML = `<span id="${fieldName}-display">${displayValue}</span>`;
    targetContainer.onclick = () => makeFieldEditable(fieldName, currentPreviewTicket.key, originalValue);
  }
}


// Drag and Drop
function setupDragAndDropForContainer(container) {
  const buttons = container.querySelectorAll('.draggable-btn');
  
  debugLog(`🔧 Configurando drag-and-drop para ${buttons.length} botões em:`, container.id);
  
  buttons.forEach(button => {
    const handle = button.querySelector('.drag-handle');
    if (!handle) {
      console.warn('⚠️ Botão sem drag-handle:', button);
      return;
    }
    
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      button.draggable = true;
      debugLog('🖱️ Drag iniciado:', button.querySelector('.btn-text')?.textContent);
    });
    
    button.addEventListener('dragstart', (e) => {
      button.classList.add('dragging');
      debugLog('🎯 Dragstart:', button.querySelector('.btn-text')?.textContent);
    });
    
    button.addEventListener('dragend', (e) => {
      button.classList.remove('dragging');
      button.draggable = false;
      debugLog('✅ Drag finalizado');
      saveButtonsOrder(container);
    });
  });
  
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = container.querySelector('.dragging');
    if (!dragging) return;
    
    const afterElement = getDragAfterElement(container, e.clientY);
    
    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll('.draggable-btn:not(.dragging)')];
  
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveButtonsOrder(container) {
  // Implementar salvamento da ordem se necessário
  debugLog('Ordem dos botões salva');
}

// Botões Editáveis
function setupEditableButtons(container) {
  const buttons = container.querySelectorAll('.draggable-btn');
  
  debugLog(`✏️ Configurando edição para ${buttons.length} botões em:`, container.id);
  
  buttons.forEach(button => {
    const editIcon = button.querySelector('.edit-icon');
    const btnText = button.querySelector('.btn-text');
    
    if (!editIcon || !btnText) {
      console.warn('⚠️ Botão sem edit-icon ou btn-text:', button);
      return;
    }
    
    // Remover event listeners anteriores (se houver)
    const newEditIcon = editIcon.cloneNode(true);
    editIcon.parentNode.replaceChild(newEditIcon, editIcon);
    
    newEditIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      debugLog('✏️ Edição iniciada:', btnText.textContent);
      startEditingButton(button, btnText);
    });
    
    btnText.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      debugLog('✏️ Duplo clique para editar:', btnText.textContent);
      startEditingButton(button, btnText);
    });
    
    button.addEventListener('click', (e) => {
      // Não executar se estiver editando
      if (btnText.contentEditable === 'true') return;
      
      const url = button.getAttribute('data-url');
      if (url) {
        debugLog('🔗 Abrindo URL:', url);
        ipcRenderer.invoke('open-url', url);
      }
    });
  });
}

function startEditingButton(button, btnText) {
  const currentText = btnText.textContent;
  btnText.contentEditable = true;
  btnText.focus();
  
  const range = document.createRange();
  range.selectNodeContents(btnText);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  
  const finishEditing = () => {
    btnText.contentEditable = false;
    const newText = btnText.textContent.trim();
    if (!newText) {
      btnText.textContent = currentText;
    }
    // Salvar alteração se necessário
    debugLog('Botão editado:', newText);
  };
  
  btnText.addEventListener('blur', finishEditing, { once: true });
  btnText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnText.blur();
    } else if (e.key === 'Escape') {
      btnText.textContent = currentText;
      btnText.blur();
    }
  }, { once: true });
}

// Loading
function showLoading() {
  document.getElementById('loading-indicator').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-indicator').style.display = 'none';
}

function showError(message) {
  showToast(`Erro: ${message}`, 'error');
}

// Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Auto Update
function startAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  const interval = (currentConfig.refreshInterval || 60) * 1000;
  updateInterval = setInterval(() => {
    fetchAndUpdateStats();
    checkForMentions(); // Verificar menções junto com os stats
  }, interval);
  
  // Verificar menções também na inicialização
  checkForMentions();
}

// Resize Handle
function setupResizeHandle() {
  const handle = document.getElementById('resize-handle');
  const container = document.querySelector('.app-container');
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = container.offsetWidth;
    startHeight = container.offsetHeight;
    
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  });
  
  function resize(e) {
    if (!isResizing) return;
    
    const width = startWidth + (e.clientX - startX);
    const height = startHeight + (e.clientY - startY);
    
    if (width >= 350 && height >= 500) {
      const { remote } = require('electron');
      const win = remote.getCurrentWindow();
      win.setSize(Math.floor(width), Math.floor(height));
    }
  }
  
  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  }
}

// ========================================
// MELHORIAS DE UX
// ========================================

// Atualizar Status de Conexão
function updateConnectionStatus(status) {
  connectionStatus = status;
  const statusDot = document.getElementById('status-dot');
  
  statusDot.className = 'status-dot';
  statusDot.classList.add(status);
  
  const statusText = {
    online: 'Conectado',
    offline: 'Desconectado',
    loading: 'Carregando...'
  };
  
  statusDot.parentElement.title = statusText[status] || 'Status desconhecido';
}

// Mostrar Banner de Erro
function showErrorBanner(title, description) {
  const banner = document.getElementById('error-banner');
  const titleEl = document.getElementById('error-title');
  const descEl = document.getElementById('error-description');
  
  titleEl.textContent = title;
  descEl.textContent = description;
  banner.style.display = 'block';
  
  updateConnectionStatus('offline');
}

// Esconder Banner de Erro
function hideErrorBanner() {
  const banner = document.getElementById('error-banner');
  banner.style.display = 'none';
  updateConnectionStatus('online');
}

// Toast Notification
function showToast(title, message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close">✕</button>
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remover após 4 segundos
  const timeout = setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
  
  // Botão de fechar
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(timeout);
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  });
}

// Adicionar animação de saída
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }
`;
document.head.appendChild(style);

// Modal de Confirmação
function showConfirmModal(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
      <div class="confirm-modal-content">
        <div class="confirm-modal-title">${title}</div>
        <div class="confirm-modal-message">${message}</div>
        <div class="confirm-modal-actions">
          <button class="confirm-btn confirm-btn-cancel">${cancelText}</button>
          <button class="confirm-btn confirm-btn-confirm ${isDanger ? 'confirm-btn-danger' : ''}">${confirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const handleClose = (confirmed) => {
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => modal.remove(), 200);
      resolve(confirmed);
    };
    
    modal.querySelector('.confirm-btn-cancel').addEventListener('click', () => handleClose(false));
    modal.querySelector('.confirm-btn-confirm').addEventListener('click', () => handleClose(true));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) handleClose(false);
    });
  });
}

const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
  @keyframes fadeOut {
    to {
      opacity: 0;
    }
  }
`;
document.head.appendChild(fadeOutStyle);

// Atualizar Tempo Real
function updateLastUpdateTime() {
  if (!lastUpdateTime) return;
  
  const now = new Date();
  const diff = Math.floor((now - lastUpdateTime) / 1000); // em segundos
  
  let text = '';
  if (diff < 60) {
    text = t('time.updatedSecondsAgo', `Updated ${diff}s ago`).replace('{time}', diff);
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    text = t('time.updatedMinutesAgo', `Updated ${minutes} min ago`).replace('{time}', minutes);
  } else {
    const hours = Math.floor(diff / 3600);
    text = t('time.updatedHoursAgo', `Updated ${hours}h ago`).replace('{time}', hours);
  }
  
  document.getElementById('last-update').textContent = text;
}

// 🚀 OTIMIZAÇÃO: Atualizar contador a cada 15s (reduz CPU)
setInterval(updateLastUpdateTime, 15000); // A cada 15 segundos ao invés de 5s

// Barra de Progresso
function startProgressBar() {
  const progressFill = document.getElementById('progress-fill');
  const refreshInterval = (currentConfig.refreshInterval || 60) * 1000;
  
  progressFill.style.width = '0%';
  progressFill.style.transition = 'none';
  
  setTimeout(() => {
    progressFill.style.transition = `width ${refreshInterval}ms linear`;
    progressFill.style.width = '100%';
  }, 50);
  
  clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    progressFill.style.width = '0%';
    progressFill.style.transition = 'none';
    setTimeout(() => {
      progressFill.style.transition = `width ${refreshInterval}ms linear`;
      progressFill.style.width = '100%';
    }, 50);
  }, refreshInterval);
}

// Animar Números ao Atualizar
function animateNumber(elementId, newValue) {
  const element = document.getElementById(elementId);
  const oldValue = parseInt(element.textContent) || 0;
  
  if (oldValue !== newValue) {
    element.classList.add('updating');
    setTimeout(() => {
      element.classList.remove('updating');
    }, 500);
  }
  
  element.textContent = newValue;
}

// Estado Vazio com Mensagem Motivacional
function showEmptyState(container, type) {
  const messages = {
    total: {
      icon: '🎉',
      title: 'Nada por aqui!',
      message: 'Você está sem tickets atribuídos no momento.'
    },
    support: {
      icon: '✨',
      title: 'Ótimo trabalho!',
      message: 'Nenhum ticket aguardando suporte.'
    },
    customer: {
      icon: '👏',
      title: 'Tudo respondido!',
      message: 'Nenhum ticket aguardando cliente.'
    },
    pending: {
      icon: '🚀',
      title: 'Parabéns!',
      message: 'Nenhum ticket pendente.'
    },
    inprogress: {
      icon: '🎯',
      title: 'Área limpa!',
      message: 'Nenhum ticket em progresso no momento.'
    }
  };
  
  const state = messages[type] || messages.total;
  
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${state.icon}</div>
      <div class="empty-state-title">${state.title}</div>
      <div class="empty-state-message">${state.message}</div>
    </div>
  `;
}

// ========================================
// 🚀 NOVAS FUNCIONALIDADES UX
// ========================================

// 🔍 BUSCA RÁPIDA DE TICKETS
function showQuickSearch() {
  document.getElementById('quick-search-modal').style.display = 'flex';
  document.getElementById('quick-search-input').focus();
  document.getElementById('quick-search-input').value = '';
}

function hideQuickSearch() {
  document.getElementById('quick-search-modal').style.display = 'none';
}

function performQuickSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  const resultsContainer = document.getElementById('quick-search-results');
  
  if (!query) {
    resultsContainer.innerHTML = '<div class="quick-search-empty">Digite para buscar tickets...</div>';
    return;
  }
  
  const results = searchTickets.filter(ticket => {
    const key = ticket.key.toLowerCase();
    const summary = (ticket.summary || ticket.fields?.summary || '').toLowerCase();
    const project = (ticket.fields?.project?.key || '').toLowerCase();
    return key.includes(query) || summary.includes(query) || project.includes(query);
  });
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="quick-search-empty">Nenhum ticket encontrado</div>';
    return;
  }
  
  resultsContainer.innerHTML = results.slice(0, 10).map((ticket, index) => `
    <div class="quick-search-result-item" data-ticket-key="${ticket.key}" data-index="${index}">
      <div class="quick-search-result-key">${ticket.key}</div>
      <div class="quick-search-result-summary">${ticket.summary || ticket.fields?.summary || 'Sem título'}</div>
      <div class="quick-search-result-meta">
        ${ticket.fields?.status?.name || 'Status desconhecido'} • 
        ${ticket.fields?.priority?.name || 'Prioridade desconhecida'}
      </div>
    </div>
  `).join('');
  
  // Adicionar event listeners
  resultsContainer.querySelectorAll('.quick-search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const ticketKey = item.getAttribute('data-ticket-key');
      openTicketPreview(ticketKey);
      hideQuickSearch();
    });
  });
}

function handleQuickSearchKeydown(e) {
  const results = document.querySelectorAll('.quick-search-result-item');
  const current = document.querySelector('.quick-search-result-item.selected');
  let index = current ? parseInt(current.getAttribute('data-index')) : -1;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    index = Math.min(index + 1, results.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    index = Math.max(index - 1, 0);
  } else if (e.key === 'Enter' && index >= 0) {
    e.preventDefault();
    results[index].click();
    return;
  } else if (e.key === 'Escape') {
    hideQuickSearch();
    return;
  } else {
    return; // Deixar o input funcionar normalmente
  }
  
  // Atualizar seleção
  results.forEach(r => r.classList.remove('selected'));
  if (results[index]) {
    results[index].classList.add('selected');
    results[index].scrollIntoView({ block: 'nearest' });
  }
}

function toggleSearch() {
  showQuickSearch();
}

// 📊 HISTÓRICO DE ATIVIDADE DO DIA
function updateDailyActivityUI() {
  const widget = document.getElementById('daily-activity-widget');
  const newEl = document.getElementById('daily-new-count');
  const closedEl = document.getElementById('daily-closed-count');
  const updatedEl = document.getElementById('daily-updated-count');
  
  if (newEl) newEl.textContent = dailyActivity.received || 0;
  if (closedEl) closedEl.textContent = dailyActivity.resolved || 0;
  if (updatedEl) updatedEl.textContent = dailyActivity.commented || 0;
  
  // Mostrar widget se houver atividade
  if (!widget) return;
  
  // 🚫 Não mostrar no modo super compacto
  if (layoutMode === 'super-compact') {
    widget.style.display = 'none';
    return;
  }
  
  if (dailyActivity.received > 0 || dailyActivity.resolved > 0 || dailyActivity.commented > 0) {
    widget.style.display = 'block';
  } else {
    widget.style.display = 'none';
    return;
  }
  
  // Se o usuário fechou manualmente, só reabrir se houver NOVA atividade
  if (dailyActivityWidgetClosed) {
    const hasNewActivity = 
      dailyActivity.received > dailyActivityLastValues.received ||
      dailyActivity.resolved > dailyActivityLastValues.resolved ||
      dailyActivity.commented > dailyActivityLastValues.commented;
    
    if (hasNewActivity) {
      debugLog('🆕 Nova atividade detectada! Reabrindo badge:', {
        anterior: dailyActivityLastValues,
        atual: { 
          received: dailyActivity.received, 
          resolved: dailyActivity.resolved, 
          commented: dailyActivity.commented 
        }
      });
      widget.style.display = 'block';
      dailyActivityWidgetClosed = false; // Resetar flag
    } else {
      debugLog('📊 Badge permanece fechado (sem nova atividade)');
      // Manter fechado
    }
  } else {
    // Se não foi fechado manualmente, mostrar normalmente
    widget.style.display = 'block';
  }
}

function closeDailyActivityWidget() {
  const widget = document.getElementById('daily-activity-widget');
  widget.style.display = 'none';
  
  // Salvar que o usuário fechou manualmente
  dailyActivityWidgetClosed = true;
  
  // Salvar os valores atuais (só reabrirá quando houver NOVA atividade)
  dailyActivityLastValues = {
    received: dailyActivity.received,
    resolved: dailyActivity.resolved,
    commented: dailyActivity.commented
  };
  
  debugLog('📊 Badge de atividade fechado manualmente. Valores salvos:', dailyActivityLastValues);
}

// 🎯 MODO FOCUS
function toggleFocusMode() {
  isFocusMode = !isFocusMode;
  const body = document.body;
  
  if (isFocusMode) {
    body.classList.add('focus-mode');
    showToast('Modo Focus', t('focusMode.activated'), 'success');
  } else {
    body.classList.remove('focus-mode');
    showToast('Modo Focus', t('focusMode.deactivated'), 'info');
  }
  
  // Salvar preferência
  ipcRenderer.invoke('save-config', { focusMode: isFocusMode });
}

// 🪟 OPACIDADE AJUSTÁVEL
function updateWindowOpacity(opacity) {
  windowOpacity = Math.max(0.2, Math.min(1.0, opacity));
  document.body.style.opacity = windowOpacity;
  
  // Atualizar UI
  const opacityPercent = Math.round(windowOpacity * 100);
  document.getElementById('opacity-value').textContent = `${opacityPercent}%`;
  
  // Atualizar slider se existir
  const slider = document.getElementById('opacity-slider');
  if (slider) {
    slider.value = opacityPercent;
  }
  
  // Salvar preferência
  ipcRenderer.invoke('save-config', { windowOpacity });
}

// 🎨 TEMAS CUSTOMIZÁVEIS
function setupThemeCustomizerListeners() {
  debugLog('🎨 Configurando listeners do customizador de tema');
  
  // Remover listeners antigos (se existirem) e adicionar novos
  const swatches = document.querySelectorAll('.color-swatch');
  debugLog('📊 Encontrados', swatches.length, 'botões de cor');
  
  swatches.forEach(btn => {
    // Clonar o elemento para remover todos os listeners antigos
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const color = newBtn.getAttribute('data-color');
      debugLog('🎨 Cor selecionada:', color);
      applyAccentColor(color, true);
      
      // Atualizar visual de selecionado
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      newBtn.classList.add('active');
    });
  });
  
  // Theme presets
  const presetBtns = document.querySelectorAll('.theme-preset-btn');
  debugLog('📊 Encontrados', presetBtns.length, 'temas pré-definidos');
  
  presetBtns.forEach(btn => {
    // Clonar o elemento para remover todos os listeners antigos
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const theme = newBtn.getAttribute('data-theme');
      debugLog('🎨 Tema selecionado:', theme);
      applyThemePreset(theme, true);
      hideThemeCustomizer();
    });
  });
  
  debugLog('✅ Listeners configurados!');
}

function showThemeCustomizer() {
  debugLog('🎨 Abrindo customizador de tema');
  const modal = document.getElementById('theme-customizer-modal');
  modal.style.display = 'flex';
  
  // Marcar o tema atual como ativo
  const currentTheme = currentConfig.theme || 'default';
  document.querySelectorAll('.theme-mode-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-theme-mode') === currentTheme) {
      btn.classList.add('active');
    }
  });
  
  // Configurar botões de modo de tema
  document.querySelectorAll('.theme-mode-btn').forEach(btn => {
    // Remover listeners antigos
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const themeMode = newBtn.getAttribute('data-theme-mode');
      
      // Atualizar visual
      document.querySelectorAll('.theme-mode-btn').forEach(b => b.classList.remove('active'));
      newBtn.classList.add('active');
      
      // Aplicar tema
      applyTheme(themeMode);
      
      // Salvar no config
      ipcRenderer.invoke('save-config', { theme: themeMode }).then(() => {
        currentConfig.theme = themeMode;
        const themeName = themeMode === 'default' ? t('theme.defaultName') : themeMode === 'dark' ? t('theme.darkName') : t('theme.lightName');
        showToast('Tema', `Tema ${themeName} ${t('theme.applied')}`, 'success');
      });
    });
  });
  
  // Aguardar um momento para garantir que o modal está renderizado
  setTimeout(() => {
    setupThemeCustomizerListeners();
  }, 100);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideThemeCustomizer();
    }
  });
}

function hideThemeCustomizer() {
  document.getElementById('theme-customizer-modal').style.display = 'none';
}

// ============================================
// 🌍 MODAL DE IDIOMA
// ============================================

function showLanguageModal() {
  debugLog('🌍 Abrindo modal de idioma');
  const modal = document.getElementById('language-modal');
  modal.style.display = 'flex';
  
  // Marcar o idioma atual como ativo
  const currentLang = currentLanguage || 'pt-BR';
  document.querySelectorAll('.language-option-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-language') === currentLang) {
      btn.classList.add('active');
    }
  });
  
  // Configurar botões de idioma
  document.querySelectorAll('.language-option-btn').forEach(btn => {
    // Remover listeners antigos
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = newBtn.getAttribute('data-language');
      
      // Atualizar visual
      document.querySelectorAll('.language-option-btn').forEach(b => b.classList.remove('active'));
      newBtn.classList.add('active');
      
      // Aplicar idioma
      applyLanguage(lang);
      currentLanguage = lang;
      
      // Salvar no config
      ipcRenderer.invoke('save-config', { language: lang }).then(() => {
        currentConfig.language = lang;
        const langName = lang === 'pt-BR' ? 'Português' : lang === 'en' ? 'English' : 'Español';
        showToast(t('menu.language'), `${langName} ${t('language.applied')}`, 'success');
        
        // Fechar modal após 1 segundo
        setTimeout(() => {
          hideLanguageModal();
        }, 1000);
      });
    });
  });
  
  // Botão de fechar
  document.getElementById('close-language-modal').onclick = hideLanguageModal;
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideLanguageModal();
    }
  });
}

function hideLanguageModal() {
  document.getElementById('language-modal').style.display = 'none';
}

function applyAccentColor(color, showNotification = false) {
  debugLog('🎨 Aplicando cor de acento:', color);
  
  // Aplicar a cor
  document.documentElement.style.setProperty('--accent-color', color);
  debugLog('✅ Variável CSS setada');
  
  // Salvar no config
  ipcRenderer.invoke('save-config', { accentColor: color }).then(() => {
    debugLog('💾 Cor salva no config');
  });
  
  if (showNotification) {
    showToast('Tema', t('theme.accentUpdated'), 'success');
  }
}

// Função para aplicar cor personalizada do color picker
function applyCustomColor() {
  const colorInput = document.getElementById('customColorPicker');
  if (colorInput && colorInput.value) {
    const customColor = colorInput.value;
    debugLog('🎨 Aplicando cor personalizada:', customColor);
    applyAccentColor(customColor, true);
  }
}

// Expor para uso global
window.applyCustomColor = applyCustomColor;
window.applyAccentColor = applyAccentColor;

function applyThemePreset(theme, showNotification = false) {
  debugLog('🎨 Aplicando tema preset:', theme);
  
  const presets = {
    default: {
      accent: '#667eea',
      bg: '#1a1d2e',
      text: '#ffffff'
    },
    cyberpunk: {
      accent: '#ff00ff',
      bg: '#0a0e27',
      text: '#00ffff'
    },
    nord: {
      accent: '#88c0d0',
      bg: '#2e3440',
      text: '#eceff4'
    },
    dracula: {
      accent: '#bd93f9',
      bg: '#282a36',
      text: '#f8f8f2'
    }
  };
  
  const preset = presets[theme];
  if (preset) {
    debugLog('✅ Preset encontrado:', preset);
    
    // Aplicar as cores
    document.documentElement.style.setProperty('--accent-color', preset.accent);
    document.documentElement.style.setProperty('--bg-primary', preset.bg);
    document.documentElement.style.setProperty('--text-primary', preset.text);
    debugLog('✅ Variáveis CSS setadas');
    
    // Salvar no config
    ipcRenderer.invoke('save-config', { themePreset: theme }).then(() => {
      debugLog('💾 Tema salvo:', theme);
    });
    
    if (showNotification) {
      showToast('Tema', `Tema "${theme}" ${t('theme.applied')}`, 'success');
    }
  } else {
    console.warn('⚠️ Preset não encontrado:', theme);
  }
}

// ⌨️ ATALHOS CUSTOMIZÁVEIS
function hideShortcutsCustomModal() {
  document.getElementById('shortcuts-custom-modal').style.display = 'none';
}

function resetShortcutsToDefault() {
  ipcRenderer.invoke('save-config', { customShortcuts: null });
  showToast(t('menu.shortcuts'), t('shortcutsCustom.restored'), 'success');
  hideShortcutsCustomModal();
}

// 📄 EXPORT DE RELATÓRIOS
function showExportModal() {
  document.getElementById('export-modal').style.display = 'flex';
}

function hideExportModal() {
  document.getElementById('export-modal').style.display = 'none';
}

async function downloadReport() {
  const period = document.getElementById('export-period').value;
  const format = document.getElementById('export-format').value;
  const includeStats = document.getElementById('export-stats').checked;
  const includeTickets = document.getElementById('export-tickets').checked;
  const includeTrend = document.getElementById('export-trend').checked;
  
  const reportData = {
    period,
    timestamp: new Date().toISOString(),
    user: currentConfig.jiraEmail,
    monitoredUser: currentConfig.monitorOtherUser ? currentConfig.otherUserEmail : 'self'
  };
  
  if (includeStats && currentStats) {
    reportData.stats = {
      total: currentStats.total,
      waitingForSupport: currentStats.waitingForSupport,
      waitingForCustomer: currentStats.waitingForCustomer,
      pending: currentStats.pending,
      slaAlerts: currentStats.slaAlerts,
      oldTickets: currentStats.oldTickets
    };
  }
  
  if (includeTickets && currentStats) {
    reportData.tickets = currentStats.allTickets?.map(t => ({
      key: t.key,
      summary: t.summary || t.fields?.summary,
      status: t.fields?.status?.name,
      priority: t.fields?.priority?.name,
      project: t.fields?.project?.key
    }));
  }
  
  if (includeTrend && currentStats) {
    reportData.trend = currentStats.trend;
  }
  
  // Gerar e baixar arquivo
  if (format === 'json') {
    downloadJSON(reportData, `jira-report-${period}.json`);
  } else if (format === 'csv') {
    downloadCSV(reportData, `jira-report-${period}.csv`);
  } else if (format === 'pdf') {
    showToast('PDF', t('export.pdfDev'), 'info');
  }
  
  hideExportModal();
  showToast('Export', t('export.downloaded'), 'success');
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(data, filename) {
  let csv = 'Key,Summary,Status,Priority,Project\n';
  
  if (data.tickets) {
    data.tickets.forEach(ticket => {
      csv += `"${ticket.key}","${ticket.summary}","${ticket.status}","${ticket.priority}","${ticket.project}"\n`;
    });
  }
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 👤 INDICADOR VISUAL DE USUÁRIO MONITORADO
function updateMonitoredUserIndicator() {
  const indicator = document.getElementById('monitored-user-indicator');
  const label = document.getElementById('user-monitor-label');
  
  if (currentConfig.monitorOtherUser && currentConfig.otherUserEmail) {
    const email = currentConfig.otherUserEmail;
    const displayName = email.split('@')[0].split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
    
    indicator.textContent = `Monitorando: ${displayName}`;
    indicator.style.display = 'inline-block';
    label.textContent = displayName;
    
    // Aplicar cor única ao usuário
    const userColor = getUserColor(email);
    document.body.style.borderTop = `3px solid ${userColor}`;
  } else {
    indicator.style.display = 'none';
    label.textContent = 'Você';
    document.body.style.borderTop = 'none';
  }
  
  updateUserListDropdown();
}

function getUserColor(email) {
  // Gerar cor consistente baseada no email
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  return colors[Math.abs(hash) % colors.length];
}

// 👤 AVATAR COM INICIAIS - Extrair iniciais do usuário
function getUserInitials(username) {
  if (!username) return '??';
  
  // Formato esperado: nome.sobrenome.empresa (ex: yanka.araujo.digisystem)
  // Regra: pegar primeira letra do índice 0 e índice 1
  const parts = username.split('.');
  
  if (parts.length >= 2) {
    const firstInitial = parts[0].charAt(0).toUpperCase();
    const secondInitial = parts[1].charAt(0).toUpperCase();
    return firstInitial + secondInitial;
  } else if (parts.length === 1) {
    // Fallback: se só tiver 1 parte, pegar as 2 primeiras letras
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return '??';
}

// 👤 GERAR HTML DO AVATAR COM INICIAIS
function createAvatarHTML(assigneeEmail) {
  if (!assigneeEmail) {
    return '<div class="ticket-avatar" data-color="gray" title="Não atribuído">U</div>';
  }
  
  // Extrair nome do usuário do email (antes do @)
  const username = assigneeEmail.split('@')[0];
  const initials = getUserInitials(username);
  
  // Gerar cor baseada no hash do email
  const colorVariants = ['blue', 'green', 'orange', 'red', 'purple', 'pink', 'cyan'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colorVariants[Math.abs(hash) % colorVariants.length];
  
  return `<div class="ticket-avatar" data-color="${color}" title="${assigneeEmail}">${initials}</div>`;
}

// 🔴 PRIORIDADE VISUAL NOS TICKETS
function getPriorityBadge(priority) {
  const priorities = {
    'Highest': { color: '#dc2626', icon: '🔴', label: 'Crítico' },
    'High': { color: '#ea580c', icon: '🟠', label: 'Alto' },
    'Medium': { color: '#f59e0b', icon: '🟡', label: 'Médio' },
    'Low': { color: '#3b82f6', icon: '🔵', label: 'Baixo' },
    'Lowest': { color: '#6b7280', icon: '⚪', label: 'Mínimo' }
  };
  
  const p = priorities[priority] || priorities['Medium'];
  return `<span class="priority-badge" style="background: ${p.color}20; color: ${p.color}; border: 1px solid ${p.color};">${p.icon} ${p.label}</span>`;
}

// Expor funções globais
window.openTicketInJira = openTicketInJira;
window.openTicketPreview = openTicketPreview;
window.hideTicketPreview = hideTicketPreview;
window.openTrendDay = openTrendDay;
window.downloadAttachment = downloadAttachment;
window.testDesktopNotification = testDesktopNotification;
window.testNotification = testDesktopNotification; // alias

// Função auxiliar para determinar o tipo de preview
function getPreviewType(mimeType) {
  if (!mimeType) return 'unsupported';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  return 'unsupported';
}

window.showAttachmentPreview = async (attachmentId, filename = 'arquivo', mimeType = '') => {
  debugLog('🖼️ showAttachmentPreview chamada', { attachmentId, filename, mimeType });
  
  const previewType = getPreviewType(mimeType);
  
  // Criar modal de preview se não existir
  let modal = document.getElementById('attachment-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'attachment-preview-modal';
    modal.className = 'attachment-preview-modal';
    document.body.appendChild(modal);
  }
  
  // Conteúdo do modal baseado no tipo
  modal.innerHTML = `
    <div class="attachment-preview-overlay" onclick="hideAttachmentPreview()"></div>
    <div class="attachment-preview-content">
      <div class="attachment-preview-header">
        <div class="attachment-preview-title" title="${filename}">${filename}</div>
        <div class="attachment-preview-actions">
          <button class="attachment-preview-btn secondary" onclick="downloadAttachment('${attachmentId}', '${filename.replace(/'/g, "\\'")}')">
            ⬇️ Baixar
          </button>
          <button class="attachment-preview-btn" onclick="hideAttachmentPreview()">
            ✕ Fechar
          </button>
        </div>
      </div>
      <div class="attachment-preview-body">
        <div class="attachment-preview-loader">
          <div class="loader-spinner"></div>
          <p>Carregando arquivo...</p>
        </div>
        <img class="attachment-preview-image" alt="Preview" style="display: none;">
        <video class="attachment-preview-video" controls style="display: none;"></video>
        <iframe class="attachment-preview-pdf" style="display: none;"></iframe>
        <div class="attachment-preview-unsupported" style="display: none;">
          <div class="attachment-preview-unsupported-icon">📄</div>
          <div class="attachment-preview-unsupported-text">
            Este tipo de arquivo não pode ser visualizado diretamente.
          </div>
        </div>
        <div class="attachment-preview-error" style="display: none;">
          <p>❌ Erro ao carregar arquivo</p>
        </div>
      </div>
    </div>
  `;
  
  // Mostrar modal
  modal.style.display = 'flex';
  
  // Elementos do modal
  const loader = modal.querySelector('.attachment-preview-loader');
  const img = modal.querySelector('.attachment-preview-image');
  const video = modal.querySelector('.attachment-preview-video');
  const pdf = modal.querySelector('.attachment-preview-pdf');
  const unsupported = modal.querySelector('.attachment-preview-unsupported');
  const error = modal.querySelector('.attachment-preview-error');
  
  // Reset do estado
  loader.style.display = 'block';
  img.style.display = 'none';
  video.style.display = 'none';
  pdf.style.display = 'none';
  unsupported.style.display = 'none';
  error.style.display = 'none';
  
  // Se não é suportado, mostrar mensagem
  if (previewType === 'unsupported') {
    loader.style.display = 'none';
    unsupported.style.display = 'block';
    return;
  }
  
  try {
    // Buscar URL do anexo
    const result = await ipcRenderer.invoke('get-attachment-url', attachmentId);
    
    if (!result.success) {
      throw new Error(result.error || 'Falha ao obter URL do anexo');
    }
    
    // Fazer fetch do arquivo com autenticação
    const response = await fetch(result.url, {
      headers: {
        'Authorization': `Basic ${btoa(currentConfig.jiraEmail + ':' + currentConfig.jiraApiToken)}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Falha ao carregar arquivo');
    }
    
    const blob = await response.blob();
    const fileUrl = URL.createObjectURL(blob);
    
    // Armazenar URL para limpeza posterior
    modal.dataset.currentFileUrl = fileUrl;
    
    // Renderizar baseado no tipo
    if (previewType === 'image') {
      img.src = fileUrl;
      img.onload = () => {
        loader.style.display = 'none';
        img.style.display = 'block';
      };
      img.onerror = () => {
        loader.style.display = 'none';
        error.style.display = 'block';
        URL.revokeObjectURL(fileUrl);
      };
    } else if (previewType === 'video') {
      video.src = fileUrl;
      video.onloadeddata = () => {
        loader.style.display = 'none';
        video.style.display = 'block';
      };
      video.onerror = () => {
        loader.style.display = 'none';
        error.style.display = 'block';
        URL.revokeObjectURL(fileUrl);
      };
    } else if (previewType === 'pdf') {
      pdf.src = fileUrl;
      pdf.onload = () => {
        loader.style.display = 'none';
        pdf.style.display = 'block';
      };
      // Para PDFs, aguardar um pouco antes de mostrar
      setTimeout(() => {
        loader.style.display = 'none';
        pdf.style.display = 'block';
      }, 500);
    }
    
  } catch (err) {
    console.error('Erro ao carregar preview:', err);
    loader.style.display = 'none';
    error.style.display = 'block';
  }
};

window.hideAttachmentPreview = () => {
  const modal = document.getElementById('attachment-preview-modal');
  if (modal) {
    modal.style.display = 'none';
    
    // Limpar recursos
    const fileUrl = modal.dataset.currentFileUrl;
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
      delete modal.dataset.currentFileUrl;
    }
    
    // Limpar elementos de mídia
    const img = modal.querySelector('.attachment-preview-image');
    const video = modal.querySelector('.attachment-preview-video');
    const pdf = modal.querySelector('.attachment-preview-pdf');
    
    if (img) img.src = '';
    if (video) {
      video.pause();
      video.src = '';
    }
    if (pdf) pdf.src = '';
  }
};

// Log para confirmar que as funções foram registradas
console.log('✅ Funções de preview registradas:', {
  showAttachmentPreview: typeof window.showAttachmentPreview,
  hideAttachmentPreview: typeof window.hideAttachmentPreview
});

window.selectAndUploadAttachments = selectAndUploadAttachments;
window.addComment = addComment;
window.editComment = editComment;
window.saveEditedComment = saveEditedComment;
window.cancelEditComment = cancelEditComment;
window.deleteComment = deleteComment;
window.removeNotification = removeNotification;
window.applyAccentColor = applyAccentColor;
window.applyThemePreset = applyThemePreset;
window.toggleActivityDetails = toggleActivityDetails;

// ============================================
// 📊 DASHBOARD DE PERFORMANCE - v1.5.0
// ============================================

let performanceMetricsCache = null;

async function loadPerformanceDashboard(days = 30) {
  debugLog('📊 Carregando Dashboard de Performance...');
  
  // Atualizar badge de usuário monitorado
  updateProMonitoredUserBadge();
  
  const refreshBtn = document.getElementById('performance-refresh-btn');
  if (refreshBtn) {
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
  }
  
  try {
    const result = await ipcRenderer.invoke('get-performance-metrics', days);
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Falha ao carregar métricas');
    }
    
    const metrics = result.data;
    performanceMetricsCache = metrics;
    
    // Atualizar resumo de métricas
    document.getElementById('perf-avg-resolution').textContent = 
      metrics.avgResolutionDays >= 1 
        ? `${metrics.avgResolutionDays}d` 
        : `${metrics.avgResolutionHours}h`;
    
    document.getElementById('perf-tickets-resolved').textContent = metrics.ticketsResolved;
    document.getElementById('perf-rate-week').textContent = metrics.ticketsPerWeek.toFixed(1);
    
    // Gerar gráficos (se os detalhes estiverem expandidos)
    const detailsContainer = document.getElementById('performance-details');
    if (detailsContainer && detailsContainer.style.display !== 'none') {
      generatePerformanceCharts(metrics);
    }
    
    showToast(t('metrics.updated'), 'success');
    
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    showToast(`${t('metrics.error')} ${error.message}`, 'error');
  } finally {
    if (refreshBtn) {
      refreshBtn.classList.remove('loading');
      refreshBtn.disabled = false;
    }
  }
}

function generatePerformanceCharts(metrics) {
  // Gráfico de pizza - Por Prioridade
  generateSimplePieChart('chart-by-priority', metrics.byPriority, 'chart-legend-priority');
  
  // Gráfico de pizza - Por Projeto
  generateSimplePieChart('chart-by-project', metrics.byProject, 'chart-legend-project');
  
  // Heatmap de atividade
  generateHeatmap(metrics.activityByHour);
  
  // Lista de tickets resolvidos recentemente
  displayRecentResolved(metrics.recentResolved);
}

function generateSimplePieChart(canvasId, data, legendId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const legend = document.getElementById(legendId);
  
  // Limpar
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (legend) legend.innerHTML = '';
  
  const entries = Object.entries(data);
  if (entries.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const colors = ['#667eea', '#764ba2', '#2ecc71', '#f39c12', '#e74c3c', '#3498db', '#9b59b6', '#1abc9c'];
  
  let currentAngle = -Math.PI / 2;
  
  entries.forEach(([label, value], index) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    const color = colors[index % colors.length];
    
    // Desenhar fatia
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.arc(100, 100, 80, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();
    
    currentAngle += sliceAngle;
    
    // Adicionar à legenda
    if (legend) {
      const item = document.createElement('div');
      item.className = 'chart-legend-item';
      item.innerHTML = `
        <div style="display: flex; align-items: center;">
          <span class="chart-legend-color" style="background: ${color};"></span>
          <span class="chart-legend-label">${label}</span>
        </div>
        <span class="chart-legend-value">${value}</span>
      `;
      legend.appendChild(item);
    }
  });
}

function generateHeatmap(activityByHour) {
  const container = document.getElementById('heatmap-by-hour');
  if (!container) return;
  
  container.innerHTML = '';
  
  const max = Math.max(...activityByHour, 1);
  
  activityByHour.forEach((count, hour) => {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    
    // Calcular intensidade (0-5)
    const intensity = Math.min(5, Math.floor((count / max) * 5));
    cell.classList.add(`intensity-${intensity}`);
    
    cell.title = `${hour}h: ${count} tickets`;
    
    container.appendChild(cell);
  });
}

function displayRecentResolved(recentTickets) {
  const container = document.getElementById('recent-resolved-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (recentTickets.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhum ticket resolvido recentemente</p>';
    return;
  }
  
  recentTickets.forEach(ticket => {
    const item = document.createElement('div');
    item.className = 'recent-resolved-item';
    item.onclick = () => openTicketPreview(ticket.key);
    
    const resolvedDate = new Date(ticket.resolved);
    const timeAgo = getTimeAgo(resolvedDate);
    
    item.innerHTML = `
      <div class="recent-resolved-info">
        <div class="recent-resolved-key">${ticket.key}</div>
        <div class="recent-resolved-summary">${ticket.summary}</div>
      </div>
      <div class="recent-resolved-meta">
        <span>${ticket.priority || 'Normal'}</span>
        <span>${timeAgo}</span>
      </div>
    `;
    
    container.appendChild(item);
  });
}

// ============================================
// ⏱️ TIMER / POMODORO - v1.5.0
// ============================================

let timerState = {
  running: false,
  paused: false,
  mode: 'manual', // 'manual' or 'pomodoro'
  seconds: 0,
  ticketKey: null,
  startTime: null,
  interval: null,
  pomodoroSession: 1,
  pomodoroType: 'work', // 'work' or 'break'
};

const POMODORO_WORK_TIME = 25 * 60; // 25 minutos
const POMODORO_SHORT_BREAK = 5 * 60; // 5 minutos
const POMODORO_LONG_BREAK = 15 * 60; // 15 minutos

function showTimerWidget(ticketKey = null) {
  const widget = document.getElementById('timer-widget');
  if (!widget) return;
  
  timerState.ticketKey = ticketKey;
  document.getElementById('timer-ticket-key').textContent = ticketKey || 'Timer Livre';
  
  widget.style.display = 'block';
  document.getElementById('timer-minimized').style.display = 'none';
}

function hideTimerWidget() {
  const widget = document.getElementById('timer-widget');
  if (widget) {
    widget.style.display = 'none';
  }
  stopTimer();
}

function minimizeTimerWidget() {
  document.getElementById('timer-widget').style.display = 'none';
  document.getElementById('timer-minimized').style.display = 'flex';
}

function restoreTimerWidget() {
  document.getElementById('timer-widget').style.display = 'block';
  document.getElementById('timer-minimized').style.display = 'none';
}

function startTimer() {
  if (timerState.running) return;
  
  timerState.running = true;
  timerState.paused = false;
  timerState.startTime = Date.now() - (timerState.seconds * 1000);
  
  // UI
  document.getElementById('timer-start-btn').style.display = 'none';
  document.getElementById('timer-pause-btn').style.display = 'flex';
  
  // Timer
  timerState.interval = setInterval(() => {
    timerState.seconds = Math.floor((Date.now() - timerState.startTime) / 1000);
    updateTimerDisplay();
    
    // Verificar Pomodoro
    if (timerState.mode === 'pomodoro') {
      const target = timerState.pomodoroType === 'work' ? POMODORO_WORK_TIME : 
                     (timerState.pomodoroSession % 4 === 0 ? POMODORO_LONG_BREAK : POMODORO_SHORT_BREAK);
      
      if (timerState.seconds >= target) {
        completePomodoroSession();
      }
    }
  }, 1000);
  
  debugLog('⏱️ Timer iniciado');
}

function pauseTimer() {
  if (!timerState.running) return;
  
  timerState.running = false;
  timerState.paused = true;
  clearInterval(timerState.interval);
  
  // UI
  document.getElementById('timer-start-btn').style.display = 'flex';
  document.getElementById('timer-pause-btn').style.display = 'none';
  
  debugLog('⏸️ Timer pausado em:', formatTime(timerState.seconds));
}

function stopTimer() {
  timerState.running = false;
  timerState.paused = false;
  clearInterval(timerState.interval);
  
  const totalSeconds = timerState.seconds;
  timerState.seconds = 0;
  timerState.startTime = null;
  
  updateTimerDisplay();
  
  // UI
  document.getElementById('timer-start-btn').style.display = 'flex';
  document.getElementById('timer-pause-btn').style.display = 'none';
  
  debugLog('⏹️ Timer parado. Tempo total:', formatTime(totalSeconds));
  
  return totalSeconds;
}

function updateTimerDisplay() {
  const formatted = formatTime(timerState.seconds);
  document.getElementById('timer-display').textContent = formatted;
  document.getElementById('timer-mini-display').textContent = formatted.substring(0, 5); // MM:SS
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function switchTimerMode(mode) {
  if (timerState.running) {
    showToast(t('timer.stopBeforeSwitch'), 'warning');
    return;
  }
  
  timerState.mode = mode;
  
  // UI
  document.querySelectorAll('.timer-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  
  const pomodoroInfo = document.getElementById('timer-pomodoro-info');
  if (mode === 'pomodoro') {
    pomodoroInfo.style.display = 'grid';
    updatePomodoroUI();
  } else {
    pomodoroInfo.style.display = 'none';
  }
}

function updatePomodoroUI() {
  document.getElementById('pomodoro-session').textContent = `${timerState.pomodoroSession}/4`;
  
  const nextType = timerState.pomodoroType === 'work' 
    ? (timerState.pomodoroSession % 4 === 0 ? 'Pausa Longa (15min)' : 'Pausa (5min)')
    : 'Trabalho (25min)';
  
  document.getElementById('pomodoro-next-type').textContent = nextType;
}

function completePomodoroSession() {
  stopTimer();
  
  // Som de conclusão
  if (currentConfig.soundNotifications) {
    ipcRenderer.invoke('play-sound', '/System/Library/Sounds/Glass.aiff');
  }
  
  if (timerState.pomodoroType === 'work') {
    // Concluiu trabalho, iniciar pausa
    showToast(t('timer.pomodoroComplete'), 'success');
    timerState.pomodoroType = 'break';
    
    // Salvar worklog automaticamente se configurado
    const autoSave = document.getElementById('timer-auto-save');
    if (autoSave && autoSave.checked && timerState.ticketKey) {
      saveWorklog(POMODORO_WORK_TIME);
    }
  } else {
    // Concluiu pausa, iniciar trabalho
    showToast(t('timer.breakComplete'), 'success');
    timerState.pomodoroType = 'work';
    timerState.pomodoroSession++;
    
    if (timerState.pomodoroSession > 4) {
      timerState.pomodoroSession = 1;
    }
  }
  
  updatePomodoroUI();
}

async function saveWorklog(timeSpentSeconds = null) {
  const secondsToLog = timeSpentSeconds || timerState.seconds;
  
  if (!timerState.ticketKey) {
    showToast(t('timer.noTicketSelected'), 'warning');
    return;
  }
  
  if (secondsToLog < 60) {
    showToast(t('timer.timeTooShort'), 'warning');
    return;
  }
  
  const comment = document.getElementById('timer-worklog-comment').value.trim();
  
  try {
    showToast(t('timer.savingWorklog'), 'info');
    
    const result = await ipcRenderer.invoke('add-worklog', 
      timerState.ticketKey, 
      secondsToLog, 
      comment, 
      timerState.startTime ? new Date(timerState.startTime).toISOString() : null
    );
    
    if (result.success) {
      showToast(`✅ Worklog salvo! Tempo: ${formatTime(secondsToLog)}`, 'success');
      document.getElementById('timer-worklog-comment').value = '';
    } else {
      throw new Error(result.error || 'Falha ao salvar worklog');
    }
    
  } catch (error) {
    console.error('Erro ao salvar worklog:', error);
    showToast(`${t('timer.worklogError')} ${error.message}`, 'error');
  }
}

// Exportar funções para uso global
window.showTimerWidget = showTimerWidget;
window.loadPerformanceDashboard = loadPerformanceDashboard;

console.log('✅ Funcionalidades v1.5.0 carregadas: Dashboard, Alertas, Timer');

// ============================================
// ✨ UX ENHANCEMENTS v1.6.0
// ============================================

// 📋 TEMPLATES DE RESPOSTA RÁPIDA
let responseTemplates = [];
let currentEditingTemplateId = null;

// Carregar templates salvos
function loadResponseTemplates() {
  const saved = localStorage.getItem('responseTemplates');
  if (saved) {
    responseTemplates = JSON.parse(saved);
  } else {
    // Templates padrão
    responseTemplates = [
      {
        id: 'template-1',
        name: 'Aguardando Cliente',
        text: 'Obrigado pelo contato! Estamos aguardando as informações solicitadas para darmos continuidade ao atendimento.\n\nPor favor, nos retorne assim que possível.',
        isInternal: false
      },
      {
        id: 'template-2',
        name: 'Resolvido',
        text: 'Ticket resolvido com sucesso! ✅\n\nPor favor, confirme se está funcionando corretamente. Caso persista algum problema, fique à vontade para reabrir este ticket.',
        isInternal: false
      },
      {
        id: 'template-3',
        name: 'Escalado para L2',
        text: 'Este ticket foi escalado para o time de nível 2 para análise mais detalhada.\n\nPrevisão de retorno: até 4 horas úteis.',
        isInternal: true
      },
      {
        id: 'template-4',
        name: 'Aguardando Aprovação',
        text: 'Solicitação encaminhada para aprovação do gestor responsável.\n\nTicket: {{ticketKey}}\nData: {{date}}\n\nVocê será notificado assim que tivermos um retorno.',
        isInternal: false
      }
    ];
    saveResponseTemplates();
  }
}

// Salvar templates
function saveResponseTemplates() {
  localStorage.setItem('responseTemplates', JSON.stringify(responseTemplates));
}

// Mostrar modal de templates
function showTemplatesModal() {
  const modal = document.getElementById('templates-modal');
  if (!modal) return;
  
  loadResponseTemplates();
  renderTemplatesList();
  modal.style.display = 'flex';
}

// Ocultar modal de templates
function hideTemplatesModal() {
  const modal = document.getElementById('templates-modal');
  if (modal) modal.style.display = 'none';
}

// Renderizar lista de templates
function renderTemplatesList() {
  const container = document.getElementById('templates-list');
  if (!container) return;
  
  if (responseTemplates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Nenhum template criado</div>
        <div class="empty-state-description">Crie seu primeiro template de resposta para economizar tempo!</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = responseTemplates.map(template => `
    <div class="template-item" data-template-id="${template.id}" onclick="useTemplate('${template.id}')">
      <div class="template-item-header">
        <div class="template-item-name">
          <span>${template.name}</span>
          ${template.isInternal ? '<span class="template-badge-internal">Interno</span>' : ''}
        </div>
        <div class="template-item-actions">
          <button class="template-action-btn" onclick="event.stopPropagation(); editTemplate('${template.id}')" title="Editar">
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/>
            </svg>
          </button>
          <button class="template-action-btn" onclick="event.stopPropagation(); deleteTemplate('${template.id}')" title="Excluir">
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="template-item-text">${template.text}</div>
    </div>
  `).join('');
}

// Usar template
function useTemplate(templateId) {
  const template = responseTemplates.find(t => t.id === templateId);
  if (!template) return;
  
  // Substituir variáveis
  let text = template.text;
  text = text.replace(/{{ticketKey}}/g, currentTicketKey || '');
  text = text.replace(/{{userName}}/g, currentConfig.jiraEmail?.split('@')[0] || 'Usuário');
  text = text.replace(/{{date}}/g, new Date().toLocaleDateString('pt-BR'));
  text = text.replace(/{{time}}/g, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  
  // Colocar texto no campo de comentário do preview
  const commentField = document.querySelector('.preview-comment-textarea');
  if (commentField) {
    commentField.value = text;
    
    // Definir se é interno
    const internalCheckbox = document.querySelector('#preview-comment-internal');
    if (internalCheckbox) {
      internalCheckbox.checked = template.isInternal;
    }
    
    showToast(`📋 Template "${template.name}" aplicado!`, 'success');
  } else {
    // Se não estiver no preview, copiar para clipboard
    navigator.clipboard.writeText(text).then(() => {
      showToast(`📋 Template "${template.name}" copiado!`, 'success');
    });
  }
  
  hideTemplatesModal();
}

// Editar template
function editTemplate(templateId) {
  const template = responseTemplates.find(t => t.id === templateId);
  if (!template) return;
  
  currentEditingTemplateId = templateId;
  
  document.getElementById('template-name').value = template.name;
  document.getElementById('template-text').value = template.text;
  document.getElementById('template-internal').checked = template.isInternal;
  
  document.getElementById('edit-template-modal').style.display = 'flex';
}

// Criar novo template
function createNewTemplate() {
  currentEditingTemplateId = null;
  
  document.getElementById('template-name').value = '';
  document.getElementById('template-text').value = '';
  document.getElementById('template-internal').checked = false;
  
  document.getElementById('edit-template-modal').style.display = 'flex';
}

// Salvar template
function saveTemplate() {
  const name = document.getElementById('template-name').value.trim();
  const text = document.getElementById('template-text').value.trim();
  const isInternal = document.getElementById('template-internal').checked;
  
  if (!name || !text) {
    showToast(t('templates.nameTextRequired'), 'error');
    return;
  }
  
  if (currentEditingTemplateId) {
    // Editar existente
    const template = responseTemplates.find(t => t.id === currentEditingTemplateId);
    if (template) {
      template.name = name;
      template.text = text;
      template.isInternal = isInternal;
    }
  } else {
    // Criar novo
    responseTemplates.push({
      id: `template-${Date.now()}`,
      name,
      text,
      isInternal
    });
  }
  
  saveResponseTemplates();
  hideEditTemplateModal();
  renderTemplatesList();
  showToast(`✅ Template "${name}" salvo!`, 'success');
}

// Deletar template
function deleteTemplate(templateId) {
  const template = responseTemplates.find(t => t.id === templateId);
  if (!template) return;
  
  if (confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) {
    responseTemplates = responseTemplates.filter(t => t.id !== templateId);
    saveResponseTemplates();
    renderTemplatesList();
    showToast(`🗑️ Template excluído!`, 'info');
  }
}

// Ocultar modal de edição
function hideEditTemplateModal() {
  document.getElementById('edit-template-modal').style.display = 'none';
  currentEditingTemplateId = null;
}

// 🎉 CONFETTI CELEBRATIONS
function celebrateTicketResolved(ticketKey) {
  debugLog('🎉 Celebrando ticket resolvido:', ticketKey);
  
  // Confetti animation
  if (window.confetti) {
    window.confetti.basic();
  }
  
  // Toast com confetti emoji
  showToast(`🎉 Ticket ${ticketKey} resolvido! Parabéns!`, 'success');
  
  // Som de sucesso (se ativado)
  if (currentConfig.soundNotifications) {
    ipcRenderer.invoke('play-sound', '/System/Library/Sounds/Glass.aiff');
  }
  
  // Atualizar contador de daily activity
  dailyActivity.resolved++;
  dailyActivity.resolvedTickets.push({
    key: ticketKey,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });
  saveDailyActivity();
  updateDailyActivityDisplay();
}

// 🌈 APLICAR CORES POR PRIORIDADE
function applyPriorityColors(ticketElement, priority) {
  if (!ticketElement || !priority) return;
  
  // Remover classes existentes
  ticketElement.removeAttribute('data-priority');
  
  // Adicionar nova prioridade
  ticketElement.setAttribute('data-priority', priority);
  
  // Adicionar badge de prioridade se não existir
  if (!ticketElement.querySelector('.priority-badge')) {
    const badge = document.createElement('span');
    badge.className = `priority-badge ${priority.toLowerCase()}`;
    badge.textContent = priority;
    
    const keyElement = ticketElement.querySelector('.alert-ticket-key, .recent-resolved-key');
    if (keyElement) {
      keyElement.parentNode.insertBefore(badge, keyElement.nextSibling);
    }
  }
}

// 🔍 FUZZY SEARCH (busca aproximada)
function fuzzySearch(pattern, text) {
  pattern = pattern.toLowerCase();
  text = text.toLowerCase();
  
  let patternIdx = 0;
  let textIdx = 0;
  let score = 0;
  
  while (patternIdx < pattern.length && textIdx < text.length) {
    if (pattern[patternIdx] === text[textIdx]) {
      score++;
      patternIdx++;
    }
    textIdx++;
  }
  
  return patternIdx === pattern.length ? score / pattern.length : 0;
}

// Melhorar busca rápida com fuzzy
function enhancedQuickSearch(query) {
  if (!query || query.length < 2) return [];
  
  const results = [];
  
  // Buscar em tickets recentes e cache
  if (currentStats && currentStats.allTickets) {
    currentStats.allTickets.forEach(ticket => {
      const keyMatch = ticket.key.toLowerCase().includes(query.toLowerCase());
      const summaryScore = fuzzySearch(query, ticket.fields.summary);
      
      if (keyMatch || summaryScore > 0.5) {
        results.push({
          ticket,
          score: keyMatch ? 1 : summaryScore
        });
      }
    });
  }
  
  // Ordenar por score
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, 10).map(r => r.ticket);
}

// Event Listeners para Templates
document.addEventListener('DOMContentLoaded', () => {
  // Botão de abrir templates
  const addTemplateBtn = document.getElementById('add-template-btn');
  if (addTemplateBtn) {
    addTemplateBtn.addEventListener('click', createNewTemplate);
  }
  
  // Fechar modais
  document.getElementById('close-templates')?.addEventListener('click', hideTemplatesModal);
  document.getElementById('close-edit-template')?.addEventListener('click', hideEditTemplateModal);
  
  // Salvar template
  document.getElementById('save-template-btn')?.addEventListener('click', saveTemplate);
  document.getElementById('cancel-template-btn')?.addEventListener('click', hideEditTemplateModal);
  
  // Fechar modais ao clicar fora
  document.getElementById('templates-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'templates-modal') hideTemplatesModal();
  });
  
  document.getElementById('edit-template-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'edit-template-modal') hideEditTemplateModal();
  });
  
  // Fechar modal de ticket preview ao clicar no overlay
  document.getElementById('ticket-preview-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'ticket-preview-modal') {
      console.log('🔒 Clicou no overlay, fechando modal');
      hideTicketPreview();
    }
  });
  
  // Garantir que clicar no conteúdo do modal não fecha
  document.querySelector('.ticket-preview-content')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  debugLog('✅ UX Enhancements v1.6.0 carregados');
  debugLog('✅ Event listeners do modal de ticket preview configurados');
});

// Adicionar atalho Cmd+Shift+T para templates
document.addEventListener('keydown', (e) => {
  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  
  if (isCmdOrCtrl && e.shiftKey && e.key === 'T') {
    e.preventDefault();
    showTemplatesModal();
  }
});

// 🔍 DEBUG: Função para testar contadores customizados
window.debugCustomCounters = async function() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('🔍 DEBUG: CONTADORES CUSTOMIZADOS');
  console.log('════════════════════════════════════════════════════════\n');
  
  if (!currentStats) {
    console.log('⚠️  Nenhum dado de stats disponível ainda. Aguarde a primeira atualização.');
    return;
  }
  
  console.log('📊 CONTADORES ATUAIS:\n');
  
  // SIM Cards
  console.log('📱 TICKETS PENDING SIMCARD:');
  if (currentStats.simcardPendingTickets) {
    console.log(`   ✅ Count: ${currentStats.simcardPendingTickets.count}`);
    console.log(`   ✅ Tickets: ${currentStats.simcardPendingTickets.tickets?.length || 0}`);
    console.log(`   📋 JQL: ${currentStats.simcardPendingTickets.jql || 'N/A'}`);
    if (currentStats.simcardPendingTickets.tickets && currentStats.simcardPendingTickets.tickets.length > 0) {
      console.log('   🎫 Primeiros tickets:');
      currentStats.simcardPendingTickets.tickets.slice(0, 5).forEach((t, idx) => {
        console.log(`      ${idx + 1}. ${t.key} - ${t.status} - ${t.summary?.substring(0, 50)}...`);
      });
    }
  } else {
    console.log('   ❌ Dados não encontrados');
  }
  
  console.log('\n🤖 TICKETS L0 JIRA BOT:');
  if (currentStats.l0BotTickets) {
    console.log(`   ✅ Count: ${currentStats.l0BotTickets.count}`);
    console.log(`   ✅ Tickets: ${currentStats.l0BotTickets.tickets?.length || 0}`);
    console.log(`   📋 JQL: ${currentStats.l0BotTickets.jql || 'N/A'}`);
    if (currentStats.l0BotTickets.tickets && currentStats.l0BotTickets.tickets.length > 0) {
      console.log('   🎫 Primeiros tickets:');
      currentStats.l0BotTickets.tickets.slice(0, 5).forEach((t, idx) => {
        console.log(`      ${idx + 1}. ${t.key} - ${t.status} - ${t.summary?.substring(0, 50)}...`);
      });
    }
  } else {
    console.log('   ❌ Dados não encontrados');
  }
  
  console.log('\n🎯 ALL L1 OPEN:');
  if (currentStats.l1OpenTickets) {
    console.log(`   ✅ Count: ${currentStats.l1OpenTickets.count}`);
    console.log(`   ✅ Tickets: ${currentStats.l1OpenTickets.tickets?.length || 0}`);
    console.log(`   📋 JQL: ${currentStats.l1OpenTickets.jql || 'N/A'}`);
    if (currentStats.l1OpenTickets.tickets && currentStats.l1OpenTickets.tickets.length > 0) {
      console.log('   🎫 Primeiros tickets:');
      currentStats.l1OpenTickets.tickets.slice(0, 5).forEach((t, idx) => {
        console.log(`      ${idx + 1}. ${t.key} - ${t.status} - ${t.summary?.substring(0, 50)}...`);
      });
    }
  } else {
    console.log('   ❌ Dados não encontrados');
  }
  
  console.log('\n💡 ANÁLISE:');
  
  const allZero = (currentStats.simcardPendingTickets?.count || 0) === 0 &&
                  (currentStats.l0BotTickets?.count || 0) === 0 &&
                  (currentStats.l1OpenTickets?.count || 0) === 0;
  
  if (allZero) {
    console.log('⚠️  Todos os contadores estão em 0');
    console.log('\n📋 Possíveis causas:');
    console.log('   1. Não há tickets que correspondam aos filtros configurados');
    console.log('   2. As JQLs podem precisar de ajuste');
    console.log('   3. Você pode não ter permissão para ver essas filas');
    console.log('\n💡 Teste as JQLs acima diretamente no Jira:');
    console.log('   Issues > Search > JQL');
  } else {
    console.log('✅ Pelo menos um contador tem dados!');
    
    const emptyOnes = [];
    if ((currentStats.simcardPendingTickets?.count || 0) === 0) emptyOnes.push('SIM Cards');
    if ((currentStats.l0BotTickets?.count || 0) === 0) emptyOnes.push('L0 Bot');
    if ((currentStats.l1OpenTickets?.count || 0) === 0) emptyOnes.push('L1 Open');
    
    if (emptyOnes.length > 0) {
      console.log(`⚠️  Contadores vazios: ${emptyOnes.join(', ')}`);
    }
  }
  
  console.log('\n════════════════════════════════════════════════════════\n');
  console.log('💾 Use window.currentStats para inspecionar todos os dados');
  console.log('🔄 Execute refreshData() para forçar atualização');
  console.log('════════════════════════════════════════════════════════\n');
};

// Exportar funções
window.showTemplatesModal = showTemplatesModal;
window.useTemplate = useTemplate;
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;

// 🔍 Função de teste para verificar se o modal de ticket preview funciona
window.testTicketPreviewModal = function() {
  console.log('🧪 Testando modal de ticket preview...');
  
  const modal = document.getElementById('ticket-preview-modal');
  if (!modal) {
    console.error('❌ Modal não encontrado!');
    return;
  }
  
  console.log('✅ Modal encontrado');
  console.log('📋 Estilo atual:', {
    display: modal.style.display,
    visibility: modal.style.visibility,
    position: window.getComputedStyle(modal).position,
    zIndex: window.getComputedStyle(modal).zIndex
  });
  
  // Teste: abrir o modal com um ticket fictício
  console.log('🎯 Tentando abrir modal...');
  modal.style.display = 'flex';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
  
  setTimeout(() => {
    console.log('📋 Estilo após 1 segundo:', {
      display: modal.style.display,
      visibility: modal.style.visibility
    });
  }, 1000);
  
  console.log('✅ Se o modal não aparecer, verifique o z-index e position no CSS');
};
window.celebrateTicketResolved = celebrateTicketResolved;
window.applyPriorityColors = applyPriorityColors;

// Exportar variáveis de debug
Object.defineProperty(window, 'currentStats', {
  get: () => currentStats,
  enumerable: true
});

Object.defineProperty(window, 'currentConfig', {
  get: () => currentConfig,
  enumerable: true
});

// Função para forçar atualização (se ainda não existe)
if (typeof window.refreshData !== 'function') {
  window.refreshData = function() {
    console.log('🔄 Forçando atualização dos dados...');
    if (typeof refreshData === 'function') {
      refreshData();
    } else {
      console.warn('⚠️  Função refreshData não encontrada no escopo');
    }
  };
}

console.log('🎨 UX Enhancements v1.6.0: Templates, Confetti, Priority Colors');
console.log('🔍 Debug: Execute debugCustomCounters() no console para diagnosticar contadores');

// ========== CANNED RESPONSES (Respostas Prontas) ==========
let cannedResponsesData = { personal: [] };
let currentCannedTicketKey = null;
let cannedResponsesFilter = '';

async function loadCannedResponses() {
  try {
    const result = await ipcRenderer.invoke('get-canned-responses');
    if (result.success) {
      cannedResponsesData = result.data;
    }
  } catch (e) {
    console.error('Erro ao carregar respostas prontas:', e);
  }
}

function openCannedResponses(ticketKey) {
  currentCannedTicketKey = ticketKey;
  loadCannedResponses().then(() => {
    renderCannedResponsesModal();
  });
}

function renderCannedResponsesModal() {
  // Remover modal existente se houver
  const existingModal = document.getElementById('canned-responses-modal');
  if (existingModal) existingModal.remove();
  
  const filteredResponses = (cannedResponsesData.personal || []).filter(r => 
    !cannedResponsesFilter || r.name.toLowerCase().includes(cannedResponsesFilter.toLowerCase())
  );
  
  const modal = document.createElement('div');
  modal.id = 'canned-responses-modal';
  modal.className = 'canned-responses-modal';
  modal.innerHTML = `
    <div class="canned-responses-container">
      <div class="canned-responses-header">
        <h2>📋 Respostas Prontas</h2>
        <button class="canned-close-btn" onclick="closeCannedResponses()">✕</button>
      </div>
      
      <div class="canned-responses-body">
        <div class="canned-responses-sidebar">
          <div class="canned-search">
            <input type="text" 
              id="canned-search-input"
              placeholder="🔍 Buscar por nome..." 
              value="${cannedResponsesFilter}"
              oninput="filterCannedResponses(this.value)">
          </div>
          
          <div class="canned-category">
            <div class="canned-category-header">
              <span>Minhas Respostas</span>
              <span class="canned-count">${filteredResponses.length}</span>
            </div>
            <div class="canned-list" id="canned-list-items">
              ${filteredResponses.map(r => `
                <div class="canned-item ${r.id === window.selectedCannedId ? 'selected' : ''}" 
                     onclick="selectCannedResponse('${r.id}')">
                  ${r.name}
                </div>
              `).join('') || '<div class="canned-empty">Nenhuma resposta salva</div>'}
            </div>
          </div>
          
          <button class="btn-create-canned" onclick="createNewCannedResponse()">
            ➕ Criar nova
          </button>
        </div>
        
        <div class="canned-responses-content">
          <div id="canned-preview-area">
            ${window.selectedCannedId ? renderCannedPreview() : `
              <div class="canned-placeholder">
                <p>👈 Selecione uma resposta para visualizar</p>
                <p>ou clique em "Criar nova" para adicionar</p>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focar no campo de busca
  setTimeout(() => document.getElementById('canned-search-input')?.focus(), 100);
}

function renderCannedPreview() {
  const response = findCannedById(window.selectedCannedId);
  if (!response) return '<div class="canned-placeholder">Resposta não encontrada</div>';
  
  return `
    <div class="canned-preview">
      <div class="canned-preview-header">
        <div class="canned-preview-actions">
          <button onclick="deleteCannedResponse('${response.id}')" title="Deletar">🗑️ Deletar</button>
          <button onclick="editCannedResponse('${response.id}')" title="Editar">✏️ Editar</button>
        </div>
      </div>
      
      <div class="canned-preview-name">
        <label>Nome</label>
        <div>${response.name}</div>
      </div>
      
      <div class="canned-preview-content">
        <label>Resposta</label>
        <div class="canned-content-text">${response.content}</div>
      </div>
      
      <div class="canned-preview-footer">
        <button class="btn-cancel-canned" onclick="closeCannedResponses()">Cancelar</button>
        <button class="btn-insert-canned" onclick="insertCannedResponse()">Inserir resposta</button>
      </div>
    </div>
  `;
}

function findCannedById(id) {
  return (cannedResponsesData.personal || []).find(r => r.id === id);
}

function selectCannedResponse(id) {
  window.selectedCannedId = id;
  renderCannedResponsesModal();
}

function filterCannedResponses(value) {
  cannedResponsesFilter = value;
  renderCannedResponsesModal();
}

function closeCannedResponses() {
  const modal = document.getElementById('canned-responses-modal');
  if (modal) modal.remove();
  window.selectedCannedId = null;
  cannedResponsesFilter = '';
}

function insertCannedResponse() {
  const response = findCannedById(window.selectedCannedId);
  if (!response || !currentCannedTicketKey) return;
  
  const textarea = document.getElementById(`new-comment-textarea-${currentCannedTicketKey}`);
  if (textarea) {
    // Inserir no cursor ou no final
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + response.content + text.substring(end);
    textarea.focus();
    
    // Posicionar cursor após o texto inserido
    const newPos = start + response.content.length;
    textarea.setSelectionRange(newPos, newPos);
  }
  
  closeCannedResponses();
  showToast(t('general.inserted'), t('cannedResponses.inserted'), 'success');
}

function createNewCannedResponse() {
  window.selectedCannedId = null;
  
  const previewArea = document.getElementById('canned-preview-area');
  if (previewArea) {
    previewArea.innerHTML = `
      <div class="canned-edit-form">
        <h3>➕ Nova Resposta</h3>
        
        <div class="canned-form-group">
          <label>Nome</label>
          <input type="text" id="canned-edit-name" placeholder="Ex: Saudação inicial">
        </div>
        
        <div class="canned-form-group">
          <label>Resposta</label>
          <textarea id="canned-edit-content" rows="10" placeholder="Digite o conteúdo da resposta..."></textarea>
        </div>
        
        <div class="canned-form-actions">
          <button class="btn-cancel-canned" onclick="renderCannedResponsesModal()">Cancelar</button>
          <button class="btn-save-canned" onclick="saveCannedResponseForm()">💾 Salvar</button>
        </div>
      </div>
    `;
    
    // Focar no campo de nome
    setTimeout(() => document.getElementById('canned-edit-name')?.focus(), 100);
  }
}

function editCannedResponse(id) {
  const response = findCannedById(id);
  if (!response) return;
  
  const previewArea = document.getElementById('canned-preview-area');
  if (previewArea) {
    previewArea.innerHTML = `
      <div class="canned-edit-form">
        <h3>✏️ Editar Resposta</h3>
        
        <div class="canned-form-group">
          <label>Nome</label>
          <input type="text" id="canned-edit-name" value="${response.name}">
        </div>
        
        <div class="canned-form-group">
          <label>Resposta</label>
          <textarea id="canned-edit-content" rows="10">${response.content}</textarea>
        </div>
        
        <input type="hidden" id="canned-edit-id" value="${id}">
        
        <div class="canned-form-actions">
          <button class="btn-cancel-canned" onclick="renderCannedResponsesModal()">Cancelar</button>
          <button class="btn-save-canned" onclick="saveCannedResponseForm()">💾 Salvar</button>
        </div>
      </div>
    `;
  }
}

async function saveCannedResponseForm() {
  const name = document.getElementById('canned-edit-name')?.value.trim();
  const content = document.getElementById('canned-edit-content')?.value.trim();
  const id = document.getElementById('canned-edit-id')?.value || null;
  
  if (!name || !content) {
    showToast(t('general.error'), t('cannedResponses.fillRequired'), 'error');
    return;
  }
  
  try {
    const result = await ipcRenderer.invoke('save-canned-response', { id, name, content, category: 'personal' });
    if (result.success) {
      cannedResponsesData = result.data;
      showToast(t('general.saved'), t('cannedResponses.saved'), 'success');
      window.selectedCannedId = null;
      renderCannedResponsesModal();
    } else {
      throw new Error(result.error);
    }
  } catch (e) {
    showToast(t('general.error'), t('cannedResponses.saveFailed'), 'error');
  }
}

async function deleteCannedResponse(id) {
  if (!confirm('Tem certeza que deseja deletar esta resposta?')) return;
  
  try {
    const result = await ipcRenderer.invoke('delete-canned-response', id, 'personal');
    if (result.success) {
      cannedResponsesData = result.data;
      window.selectedCannedId = null;
      showToast(t('general.deleted'), t('cannedResponses.deleted'), 'success');
      renderCannedResponsesModal();
    }
  } catch (e) {
    showToast(t('general.error'), t('cannedResponses.deleteFailed'), 'error');
  }
}

// Expor funções globalmente
window.openCannedResponses = openCannedResponses;
window.closeCannedResponses = closeCannedResponses;
window.selectCannedResponse = selectCannedResponse;
window.filterCannedResponses = filterCannedResponses;
window.insertCannedResponse = insertCannedResponse;
window.createNewCannedResponse = createNewCannedResponse;
window.editCannedResponse = editCannedResponse;
window.saveCannedResponseForm = saveCannedResponseForm;
window.deleteCannedResponse = deleteCannedResponse;
window.renderCannedResponsesModal = renderCannedResponsesModal;