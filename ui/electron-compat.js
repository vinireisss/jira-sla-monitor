/**
 * Camada de compatibilidade Electron -> HTTP API
 * Simula ipcRenderer e electronAPI usando fetch HTTP
 */

console.log('[compat] Iniciando camada de compatibilidade...');

// ========== HTTP API ==========

async function callApi(method, ...args) {
    try {
        const response = await fetch('/api/' + method, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ args })
        });
        const data = await response.json();
        if (data.error) {
            console.error('[api] Erro em ' + method + ':', data.error);
            throw new Error(data.error);
        }
        return data.result;
    } catch (e) {
        console.error('[api] Falha em ' + method + ':', e);
        throw e;
    }
}

// ========== MOCK require('electron') ==========

window.require = function(module) {
    if (module === 'electron') {
        return {
            ipcRenderer: window._ipcRenderer,
            webFrame: window._webFrame
        };
    }
    console.warn('[compat] Módulo não suportado:', module);
    return {};
};

// ========== ipcRenderer ==========

window._ipcRenderer = {
    on: (channel, callback) => {
        if (!window._ipcCallbacks) window._ipcCallbacks = {};
        if (!window._ipcCallbacks[channel]) window._ipcCallbacks[channel] = [];
        window._ipcCallbacks[channel].push(callback);
    },
    once: (channel, callback) => window._ipcRenderer.on(channel, callback),
    send: (channel, ...args) => console.log('[ipc] send:', channel),
    invoke: (channel, ...args) => ipcInvoke(channel, ...args),
    removeListener: () => {},
    removeAllListeners: (channel) => {
        if (window._ipcCallbacks) delete window._ipcCallbacks[channel];
    }
};

// ========== webFrame ==========

window._webFrame = {
    setZoomFactor: (f) => { document.body.style.zoom = f; },
    getZoomFactor: () => parseFloat(document.body.style.zoom) || 1,
    setZoomLevel: () => {}
};

// ========== Mapeamento IPC -> API ==========

async function ipcInvoke(channel, ...args) {
    // Mapeamento de canais IPC para métodos da API HTTP
    const map = {
        // Config
        'get-config': () => callApi('getConfig'),
        'save-config': (c) => callApi('saveConfig', c),
        
        // Jira
        'test-connection': () => callApi('testConnection'),
        'get-current-user': () => callApi('getCurrentUser'),
        'fetch-jira-stats': (otherUserEmail) => otherUserEmail ? callApi('fetchStats', otherUserEmail) : callApi('fetchStats'),
        'fetch-stats': (otherUserEmail) => otherUserEmail ? callApi('fetchStats', otherUserEmail) : callApi('fetchStats'),
        'get-ticket-details': (k) => callApi('getTicketDetails', k),
        'add-comment': (d) => callApi('addComment', d.ticketKey, d.commentBody, d.isInternal, d.mentions),
        'add-worklog': (k, t, c) => callApi('addWorklog', k, t, c),
        'get-worklogs': (k) => callApi('getWorklogs', k),
        'update-comment': (k, cid, body) => callApi('updateComment', k, cid, body),
        'delete-comment': (k, cid) => callApi('deleteComment', k, cid),
        'get-transitions': (k) => callApi('getTransitions', k),
        'transition-ticket': (k, t) => callApi('transitionTicket', k, t),
        'search-jira-tickets': (q, m) => callApi('searchTickets', q, m),
        'get-ticket-sla': (k) => callApi('getTicketSla', k),
        'get-ticket-sla-batch': (keys) => callApi('getTicketSlaBatch', keys),
        'update-ticket-field': (data) => callApi('updateTicketField', data.ticketKey, data.fieldName, data.value),
        'search-users': (q) => callApi('searchUsers', q),
        'get-assignable-users': (p) => callApi('getAssignableUsers', p),
        'fetch-mentions': () => callApi('fetchMentions'),
        'get-jira-priorities': () => callApi('getJiraPriorities'),
        'open-url': (u) => callApi('openExternal', u),
        
        // Sistema
        'open-external': (u) => callApi('openExternal', u),
        'open-jira-ticket': (k) => callApi('openJiraTicket', k),
        'open-user-window': (u) => callApi('openUserWindow', u),
        'open-jira-webview': (url, title) => callApi('openJiraWebview', url, title),
        'copy-to-clipboard': (t) => callApi('copyToClipboard', t),
        'show-notification': (t, b) => callApi('showNotification', t, b),
        'test-notification': () => callApi('testNotification'),
        'test-download': () => callApi('testDownload'),
        
        // Janela
        'minimize-window': () => callApi('minimizeWindow'),
        'maximize-window': () => callApi('maximizeWindow'),
        'close-window': () => callApi('closeWindow'),
        'set-always-on-top': (v) => callApi('setAlwaysOnTop', v),
        'resize-window': (w, h) => callApi('resizeWindow', w, h),
        'get-window-bounds': () => callApi('getWindowBounds'),
        'set-window-bounds': (b) => callApi('setWindowBounds', b),
        
        // Tray / Proactive Alerts
        'update-tray': (data) => callApi('updateTray', data),
        'check-tickets-needing-response': (h) => callApi('checkTicketsNeedingResponse', h || 2),
        'send-proactive-alerts': (h) => callApi('sendProactiveAlerts', h || 2),
        
        // Outros
        'get-performance-metrics': (d) => callApi('getPerformanceMetrics', d || 30),
        'get-itops-team-options': () => callApi('getItopsTeamOptions'),
        'get-recent-notifications': (max) => callApi('getRecentNotifications', max || 15),
        'get-tickets-with-critical-sla': (mins) => callApi('getTicketsWithCriticalSLA', mins || 15),
        
        // Anexos
        'select-attachment-files': () => callApi('selectAttachmentFiles'),
        'add-attachment': (key, paths) => callApi('addAttachment', key, paths),
        'download-attachment': (id, filename) => callApi('downloadAttachment', id, filename),
        'select-and-upload-attachments': (key) => callApi('selectAndUploadAttachments', key),
        'get-attachment-url': (id) => callApi('getAttachmentUrl', id),
        
        // Respostas Prontas (Canned Responses)
        'get-canned-responses': () => callApi('getCannedResponses'),
        'save-canned-response': (data) => callApi('saveCannedResponse', data),
        'delete-canned-response': (id, category) => callApi('deleteCannedResponse', id, category),
        
        // Outros
        'play-sound': () => ({}),
    };
    
    const handler = map[channel];
    if (handler) {
        try {
            return await handler(...args);
        } catch (e) {
            console.error('[ipc] Erro em ' + channel + ':', e);
            // Retornar no formato esperado pelo frontend
            return { success: false, error: e.message };
        }
    }
    
    console.warn('[ipc] Canal desconhecido:', channel);
    // Retornar objeto vazio para canais desconhecidos (evitar erros)
    return { success: true, data: {} };
}

// ========== electronAPI ==========

window.electronAPI = {
    getConfig: () => callApi('getConfig'),
    saveConfig: (c) => callApi('saveConfig', c),
    getConfigValue: (k, d) => callApi('getConfigValue', k, d),
    setConfigValue: (k, v) => callApi('setConfigValue', k, v),
    
    fetchStats: () => callApi('fetchStats'),
    testConnection: () => callApi('testConnection'),
    getCurrentUser: () => callApi('getCurrentUser'),
    getTicketDetails: (k) => callApi('getTicketDetails', k),
    addComment: (k, c, i) => callApi('addComment', k, c, i),
    addWorklog: (k, t, c) => callApi('addWorklog', k, t, c),
    getTransitions: (k) => callApi('getTransitions', k),
    transitionTicket: (k, t) => callApi('transitionTicket', k, t),
    
    openExternal: (u) => callApi('openExternal', u),
    openJiraTicket: (k) => callApi('openJiraTicket', k),
    copyToClipboard: (t) => callApi('copyToClipboard', t),
    
    minimizeWindow: () => callApi('minimizeWindow'),
    maximizeWindow: () => callApi('maximizeWindow'),
    closeWindow: () => callApi('closeWindow'),
    setAlwaysOnTop: (v) => callApi('setAlwaysOnTop', v),
    resizeWindow: (w, h) => callApi('resizeWindow', w, h),
    
    getPerformanceMetrics: () => callApi('getPerformanceMetrics'),
};

console.log('[compat] Camada de compatibilidade pronta!');
