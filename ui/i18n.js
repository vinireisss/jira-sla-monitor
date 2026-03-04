/**
 * 🌍 SISTEMA DE INTERNACIONALIZAÇÃO (i18n)
 * Sistema completo de tradução para Jira Monitor
 * Idiomas suportados: pt-BR, en (inglês), es (espanhol)
 */

const i18n = {
  // ========================================
  // 🇧🇷 PORTUGUÊS (PT-BR) - DEFAULT
  // ========================================
  'pt-BR': {
    // Header
    'app.title': 'Jira Monitor',
    'header.menu': 'Menu',
    'header.notifications': 'Notificações',
    'header.docs': 'Documentação',
    'header.minimize': 'Minimizar',
    'header.close': 'Fechar',
    
    // Menu Items
    'menu.proMode': '⭐ Modo Pro',
    'menu.refresh': '🔄 Atualizar',
    'menu.settings': '⚙️ Configurações',
    'menu.okta': '🔐 OKTA',
    'menu.jamf': '🍎 JAMF',
    'menu.googleAdmin': '🔐 Google Admin Console',
    'menu.search': '🔍 Busca Rápida',
    'menu.shortcuts': '⌨️ Atalhos',
    'menu.templates': '📋 Templates',
    'menu.timer': '⏱️ Timer / Pomodoro',
    'menu.opacity': '🪟 Opacidade',
    'menu.themes': '🎨 Temas',
    'menu.language': '🌍 Idioma',
    'menu.export': '📄 Exportar',
    
    // User Monitor
    'user.monitor': 'Monitorar Usuário',
    'user.you': 'Você',
    'user.addAnother': 'Adicionar Outro Usuário...',
    
    // Stats Cards
    'stats.total': 'Total de Tickets - IT',
    'stats.support': 'Waiting for Support - IT',
    'stats.customer': 'Waiting for Customer - IT',
    'stats.pending': 'Tickets Pending - IT',
    'stats.expand': 'Expandir',
    'stats.sla': 'SLA',
    'stats.old': 'Antigos',
    
    // Pro Mode Sections
    'pro.dailyActivity': '📅 Atividade de Hoje',
    'pro.received': 'Recebidos',
    'pro.resolved': 'Fechados',
    'pro.commented': 'Atividade',
    'pro.comments': 'comentários',
    'pro.today': 'hoje',
    'pro.telefonia': '📱 Telefonia',
    'pro.simCards': 'Tickets SIM Cards',
    'pro.evaluated': '✅ Tickets Avaliados',
    'pro.lastEvaluated': 'Todos os Avaliados',
    'pro.byProject': '📊 Por Projeto',
    'pro.recentTickets': '🕐 Tickets Recentes',
    'pro.trend': '📈 Tendência (7 dias)',
    
    // Performance Dashboard
    'perf.title': '📊 Dashboard de Performance',
    'perf.avgTime': 'Tempo Médio',
    'perf.resolution': 'de resolução',
    'perf.resolved': 'Resolvidos',
    'perf.last30days': 'últimos 30 dias',
    'perf.perWeek': 'Por Semana',
    'perf.closeRate': 'taxa fechamento',
    'perf.byPriority': '🏷️ Por Prioridade',
    'perf.byProject': '📦 Por Projeto',
    'perf.heatmap': '🔥 Heatmap de Atividade',
    'perf.productive': 'Horários mais produtivos (últimos 30 dias)',
    'perf.last10': '📋 Últimos 10 Resolvidos',
    'perf.updateMetrics': 'Atualizar Métricas',
    
    // Timer Widget
    'timer.title': 'Timer',
    'timer.minimize': 'Minimizar',
    'timer.close': 'Fechar',
    'timer.manual': 'Manual',
    'timer.pomodoro': 'Pomodoro',
    'timer.start': 'Iniciar',
    'timer.pause': 'Pausar',
    'timer.stop': 'Parar',
    'timer.session': 'Sessão:',
    'timer.next': 'Próximo:',
    'timer.break': 'Pausa',
    'timer.worklogComment': 'Comentário do worklog (opcional)...',
    'timer.autoSave': 'Salvar worklog automaticamente',
    'timer.saveWorklog': 'Salvar Worklog no Jira',
    
    // Search
    'search.placeholder': 'Buscar ticket (ex: IT-1234) ou palavras-chave...',
    'search.quickSearch': '🔍 Buscar ticket por key, summary ou projeto...',
    'search.hint': '↑↓ para navegar • Enter para abrir • Esc para fechar',
    
    // Templates
    'templates.title': '📋 Templates de Resposta',
    'templates.create': 'Criar Novo Template',
    'templates.edit': '✏️ Editar Template',
    'templates.name': 'Nome do Template:',
    'templates.text': 'Texto:',
    'templates.internal': 'Comentário interno (visível apenas para equipe)',
    'templates.cancel': 'Cancelar',
    'templates.save': 'Salvar Template',
    'templates.hint': 'Clique em um template para usar • Cmd+Shift+T para abrir',
    
    // Notifications
    'notifications.title': 'Notificações',
    'notifications.viewAll': 'Ver Todas',
    'notifications.clear': 'Limpar',
    'notifications.reset': '🔄 Resetar',
    
    // Documentation
    'docs.title': '📚 Documentação',
    'docs.l1': 'Documentação L1',
    'docs.bpo': 'Documentação BPO',
    
    // Daily Activity
    'daily.title': '📊 Atividade de Hoje',
    'daily.new': 'Novos',
    'daily.closed': 'Fechados',
    'daily.updated': 'Atualizados',
    'daily.receivedTitle': '🆕 Tickets Recebidos Hoje',
    'daily.resolvedTitle': '✅ Tickets Fechados Hoje',
    'daily.commentsTitle': '💬 Comentários de Hoje',
    'daily.noReceived': 'Nenhum ticket recebido hoje',
    'daily.noResolved': 'Nenhum ticket fechado hoje',
    'daily.noComments': 'Nenhum comentário hoje',
    
    // Theme Customizer
    'theme.title': '🎨 Personalizar Tema',
    'theme.accent': 'Cor de Acento:',
    'theme.presets': 'Temas Pré-definidos:',
    'theme.default': 'Padrão',
    'theme.cyberpunk': 'Cyberpunk',
    'theme.nord': 'Nord',
    'theme.dracula': 'Dracula',
    
    // Shortcuts
    'shortcuts.title': '⌨️ Atalhos de Teclado',
    'shortcuts.main': '🚀 Atalhos Principais',
    'shortcuts.openSearch': '🔍 Abrir busca rápida de tickets',
    'shortcuts.togglePro': '⭐ Alternar Modo Pro',
    'shortcuts.toggleLayout': '🔄 Alternar layout (vertical/horizontal)',
    'shortcuts.refresh': '🔄 Atualizar manualmente',
    'shortcuts.openSettings': '⚙️ Abrir configurações',
    'shortcuts.close': '❌ Fechar modais ou minimizar',
    'shortcuts.newFeatures': '✨ Novos Recursos UX',
    'shortcuts.focusMode': '🎯 Ativar/desativar Modo Focus',
    'shortcuts.export': '📄 Exportar relatório',
    'shortcuts.numeric': '🔢 Atalhos Numéricos',
    'shortcuts.card1': '📊 Abrir card Total de Tickets',
    'shortcuts.card2': '🔧 Abrir card Waiting for Support',
    'shortcuts.card3': '👤 Abrir card Waiting for Customer',
    'shortcuts.card4': '⏸️ Abrir card Tickets Pending',
    'shortcuts.searchSection': '🔍 Busca Rápida',
    'shortcuts.navigate': 'Navegar entre resultados',
    'shortcuts.open': 'Abrir ticket selecionado',
    'shortcuts.tips': '💡 Dicas',
    
    // Export
    'export.title': '📄 Exportar Relatório',
    'export.period': 'Período:',
    'export.format': 'Formato:',
    'export.include': 'Incluir:',
    'export.stats': 'Estatísticas',
    'export.tickets': 'Lista de Tickets',
    'export.trend': 'Gráfico de Tendência',
    'export.download': '📥 Baixar Relatório',
    'export.today': 'Hoje',
    'export.week': 'Esta Semana',
    'export.month': 'Este Mês',
    
    // Welcome Message (First Time)
    'welcome.title': 'Bem-vindo ao Jira Monitor!',
    'welcome.subtitle': 'Para começar, configure suas credenciais do Jira abaixo:',
    'welcome.step1': '✅ URL do Jira da sua empresa',
    'welcome.step2': '✅ Seu email corporativo',
    'welcome.step3': '✅ API Token do Jira (clique no link para criar)',
    
    // Settings
    'settings.title': '⚙️ Configurações',
    'settings.language': 'Idioma / Language / Idioma',
    'settings.languageHint': 'O tutorial interativo será exibido neste idioma',
    'settings.jiraUrl': 'URL do Jira',
    'settings.email': 'Email',
    'settings.apiToken': 'API Token',
    'settings.createApiToken': '🔗 Crie seu API token do Jira aqui',
    'settings.queueId': 'ID da Fila',
    'settings.refreshInterval': 'Intervalo de Atualização (segundos)',
    'settings.oldTicketsDays': 'Dias sem atualização para alertar',
    'settings.alertSla': 'Alertar sobre SLA próximo (1 hora antes)',
    'settings.alertOld': 'Alertar sobre tickets antigos',
    'settings.desktopNotifications': '🔔 Notificações desktop',
    'settings.test': 'Testar',
    'settings.notifyNew': '🎫 Novos tickets atribuídos',
    'settings.notifyStatus': '🔄 Mudanças de status',
    'settings.notifyReassign': '👤 Reatribuições para você',
    'settings.notifyMentions': '📢 Quando você for mencionado',
    'settings.soundNotifications': '🔊 Tocar som nas notificações',
    'settings.proMode': '⭐ Modo Pro',
    'settings.theme': '🎨 Tema da Aplicação',
    'settings.themeDefault': '🎨 Padrão (Gradiente Roxo)',
    'settings.themeDark': '🌙 Escuro (Dark Mode)',
    'settings.themeLight': '☀️ Claro (Light Mode)',
    'settings.language': '🌍 Idioma',
    'settings.save': 'Salvar',
    'settings.cancel': 'Cancelar',
    'settings.placeholderUrl': 'https://sua-empresa.atlassian.net',
    'settings.placeholderEmail': 'seu.email@empresa.com',
    'settings.placeholderToken': 'Seu API token do Jira',
    
    // Updated ago (tempo relativo)
    'time.updatedSecondsAgo': 'Atualizado há {time}s',
    'time.updatedMinutesAgo': 'Atualizado há {time} min',
    'time.updatedHoursAgo': 'Atualizado há {time}h',
    'time.updated': 'Atualizado',
    'time.lastUpdate': 'Última atualização',
    'time.now': 'agora',
    'time.minutesAgo': 'há {time} minutos',
    'time.hoursAgo': 'há {time} horas',
    'time.daysAgo': 'há {time} dias',
    
    // Badge modals
    'badge.slaTitle': '⏰ Tickets com SLA em Alerta (vencendo em até 30 minutos)',
    'badge.oldTitle': '📅 Tickets Antigos (sem atualização há 7+ dias)',
    
    // Footer
    'footer.loading': 'Carregando...',
    'footer.refresh': 'Atualizar',
    'footer.lastUpdate': 'Última atualização',
    
    // Error Messages
    'error.connection': 'Erro de Conexão',
    'error.noConnection': 'Não foi possível conectar ao Jira',
    'error.retry': 'Tentar Novamente',
    'error.loading': 'Erro ao carregar ticket',
    
    // Buttons
    'btn.close': 'Fechar',
    'btn.save': 'Salvar',
    'btn.cancel': 'Cancelar',
    'btn.confirm': 'Confirmar',
    'btn.add': 'Adicionar',
    'btn.edit': 'Editar',
    'btn.delete': 'Deletar',
    'btn.retry': 'Tentar Novamente',
    
    // Add User Modal
    'addUser.title': '➕ Adicionar Usuário para Monitorar',
    'addUser.description': 'Digite o e-mail do usuário que deseja monitorar:',
    'addUser.placeholder': 'user@company.com',
    'addUser.cancel': 'Cancelar',
    'addUser.add': 'Adicionar',
    
    // Context Menu
    'context.back': '⬅️ Voltar',
    'context.forward': '➡️ Avançar',
    'context.reload': '🔄 Recarregar',
    'context.cut': '✂️ Recortar',
    'context.copy': '📋 Copiar',
    'context.paste': '📄 Colar',
    'context.delete': '🗑️ Deletar',
    'context.selectAll': '🔍 Selecionar Tudo',
    'context.copyLink': '🔗 Copiar Link',
    'context.copyImage': '🖼️ Copiar Imagem',
    'context.openExternal': '🌐 Abrir Link em Navegador Externo',
    'context.inspect': '🔧 Inspecionar Elemento',
    
    // Onboarding Tour
    'tour.step1.title': '📊 Visão Geral',
    'tour.step1.description': 'Aqui você vê seus contadores de tickets (Total, Suporte, Pendentes, etc). Clique nos cards para expandir e ver a lista completa de tickets.',
    'tour.step2.title': '🔄 Atualizar',
    'tour.step2.description': 'Clique aqui para forçar uma sincronização manual com o Jira. O app atualiza automaticamente em intervalos configuráveis.',
    'tour.step3.title': '🔔 Notificações',
    'tour.step3.description': 'Veja alertas recentes e histórico de mudanças nos seus tickets. Você será notificado sobre novos tickets, mudanças de status e menções.',
    'tour.step4.title': '⚙️ Menu & Configurações',
    'tour.step4.description': 'Acesse o Modo Pro, Temas personalizados, Ajustes de conexão e muito mais. Use Cmd+, para abrir rapidamente as configurações.',
    'tour.step5.title': '🎉 Pronto para começar!',
    'tour.step5.description': 'Você já conhece o básico do Jira Monitor. Use Cmd+K para busca rápida de tickets e Cmd+P para ativar o Modo Pro. Boa sorte!',
    'tour.buttons.next': 'Próximo',
    'tour.buttons.previous': 'Anterior',
    'tour.buttons.done': 'Concluir',
    'tour.buttons.skip': 'Pular',
    'tour.success': '✅ Tutorial concluído! Explore à vontade.',
    
    // Tooltips / Titles
    'tooltip.totalTickets': 'Total de Tickets',
    'tooltip.activateAdvanced': 'Ativar recursos avançados',
    'tooltip.refreshManual': 'Atualizar dados manualmente (Cmd+R)',
    'tooltip.openSettings': 'Abrir configurações (Cmd+,)',
    'tooltip.openOkta': 'Abrir Nubank OKTA',
    'tooltip.openJamf': 'Abrir JAMF Cloud',
    'tooltip.openJiraPortal': 'Abrir Jira Portal',
    'tooltip.openGoogleAdmin': 'Abrir Google Admin Console',
    'tooltip.quickSearch': 'Busca rápida de tickets (Cmd+K)',
    'tooltip.viewShortcuts': 'Ver todos os atalhos de teclado',
    'tooltip.templates': 'Templates de resposta rápida (Cmd+Shift+T)',
    'tooltip.openTimer': 'Abrir Timer/Pomodoro (Cmd+T)',
    'tooltip.customizeTheme': 'Personalizar tema',
    'tooltip.toggleLayout': 'Alternar Layout (Cmd+L)',
    'tooltip.adjustOpacity': 'Ajustar transparência da janela',
    'tooltip.exportReport': 'Exportar relatório',
    'tooltip.connectionStatus': 'Status da conexão',
    'tooltip.resetNotifications': 'Resetar histórico de notificações limpas',
    'tooltip.zoomOut': 'Diminuir Zoom (Cmd+-)',
    'tooltip.zoomIn': 'Aumentar Zoom (Cmd++)',
    'tooltip.densityMode': 'Modo de Densidade',
    'tooltip.monitoredUser': 'Usuário Monitorado',
    'tooltip.backToNormal': 'Voltar ao modo normal (ESC ou Cmd+L)',
    'tooltip.copyKey': 'Copiar key',
    'tooltip.openInJira': 'Abrir no Jira',
    'tooltip.removeFromHistory': 'Remover do histórico',
    'tooltip.openInNewWindow': 'Abrir em nova janela',
    'tooltip.removeNotification': 'Remover notificação',
    'tooltip.clickToEdit': 'Clique para editar',
    
    // Stat Cards
    'card.totalTicketsIT': 'Total de Tickets - IT',
    'card.waitingSupport': 'Waiting for Support - IT',
    'card.waitingCustomer': 'Waiting for Customer - IT',
    'card.ticketsPending': 'Tickets Pending - IT',
    'card.ticketsInProgress': 'Tickets In Progress - IT',
    'card.ticketsPendingSimcard': 'Tickets Pending SimCard',
    'card.ticketsL0JiraBot': 'Tickets L0 Jira Bot',
    'card.allL1Open': 'All L1 Open',
    'card.simcardControl': 'Controle de SIMCARD',
    
    // Mini Stats
    'ministat.resolutionRate': 'Taxa de Resolução',
    'ministat.avgTime': 'Tempo Médio',
    'ministat.today': 'Hoje',
    
    // Timer
    'timer.freeTimer': 'Timer Livre',
    'timer.session': 'Sessão:',
    'timer.next': 'Próximo:',
    'timer.breakMin': 'Pausa (5min)',
    'timer.autoSaveWorklog': 'Salvar worklog automaticamente',
    'timer.saveWorklogJira': 'Salvar Worklog no Jira',
    'timer.stopBeforeSwitch': 'Pare o timer antes de trocar de modo',
    'timer.pomodoroComplete': 'Pomodoro concluído! Hora da pausa.',
    'timer.breakComplete': 'Pausa concluída! De volta ao trabalho.',
    'timer.noTicketSelected': 'Nenhum ticket selecionado para o timer',
    'timer.timeTooShort': 'Tempo muito curto para registrar (mínimo 1 minuto)',
    'timer.savingWorklog': 'Salvando worklog...',
    'timer.worklogSaved': 'Worklog salvo! Tempo:',
    'timer.worklogError': 'Erro ao salvar worklog:',
    
    // Theme
    'theme.mode': 'Modo de Tema:',
    'theme.defaultName': 'Padrão',
    'theme.defaultDesc': 'Gradiente Roxo',
    'theme.darkName': 'Escuro',
    'theme.lightName': 'Claro',
    'theme.accentColor': 'Cor de Acento:',
    'theme.customColor': 'Ou escolha uma cor personalizada:',
    'theme.specialThemes': 'Temas Especiais:',
    'theme.applyCustom': 'Aplicar Cor Personalizada',
    'theme.accentUpdated': 'Cor de acento atualizada',
    'theme.applied': 'aplicado',
    
    // Export
    'export.today': 'Hoje',
    'export.thisWeek': 'Esta Semana',
    'export.thisMonth': 'Este Mês',
    'export.statistics': 'Estatísticas',
    'export.ticketList': 'Lista de Tickets',
    'export.trendChart': 'Gráfico de Tendência',
    'export.downloadBtn': '📥 Baixar Relatório',
    'export.downloaded': 'Relatório baixado com sucesso',
    'export.pdfDev': 'Função em desenvolvimento',
    
    // Floating Window
    'floatingWindow.title': '🪟 Janela Flutuante (Faróis)',
    'floatingWindow.enable': 'Ativar janela flutuante',
    'floatingWindow.enabled': 'Janela flutuante ativada',
    'floatingWindow.disabled': 'Janela flutuante desativada',
    'floatingWindow.opacity': 'Opacidade',
    'floatingWindow.size': 'Tamanho',
    'floatingWindow.width': 'Largura',
    'floatingWindow.height': 'Altura',
    'floatingWindow.show': 'Mostrar',
    'floatingWindow.critical': '🔴 Críticos',
    'floatingWindow.warning': '🟡 Alerta',
    'floatingWindow.normal': '🟢 Normal',
    'floatingWindow.showTicketList': 'Mostrar lista de tickets',
    
    // User Monitor
    'userMonitor.title': '👤 Monitorar Usuário',
    'userMonitor.you': 'Você',
    'userMonitor.addAnother': 'Adicionar Outro Usuário...',
    'userMonitor.monitoring': 'Monitorando:',
    'userMonitor.dataFrom': 'Dados de:',
    
    // Add User Modal
    'addUser.enterEmail': 'Digite o e-mail do usuário que deseja monitorar:',
    'addUser.placeholder': 'user@company.com',
    'addUser.removed': 'removido permanentemente',
    'addUser.monitoringInNewWindow': 'em nova janela',
    'addUser.nowMonitoring': 'Agora monitorando',
    'addUser.invalidEmail': 'Por favor, digite um e-mail válido',
    'addUser.invalidEmailShort': 'E-mail inválido',
    
    // Templates
    'templates.namePlaceholder': 'Ex: Aguardando Cliente',
    'templates.textPlaceholder': 'Digite o texto do template...',
    'templates.internalComment': 'Comentário interno (visível apenas para equipe)',
    'templates.applied': 'aplicado!',
    'templates.copied': 'copiado!',
    'templates.nameTextRequired': 'Nome e texto são obrigatórios!',
    'templates.saved': 'salvo!',
    'templates.deleted': 'Template excluído!',
    'templates.confirmDelete': 'Tem certeza que deseja excluir o template',
    
    // Canned Responses
    'cannedResponses.title': 'Respostas Prontas',
    'cannedResponses.namePlaceholder': 'Ex: Saudação inicial',
    'cannedResponses.contentPlaceholder': 'Digite o conteúdo da resposta...',
    'cannedResponses.inserted': 'Resposta inserida no comentário',
    'cannedResponses.fillRequired': 'Preencha nome e conteúdo',
    'cannedResponses.saved': 'Resposta salva com sucesso',
    'cannedResponses.saveFailed': 'Falha ao salvar resposta',
    'cannedResponses.deleted': 'Resposta removida',
    'cannedResponses.deleteFailed': 'Falha ao deletar',
    'cannedResponses.confirmDelete': 'Tem certeza que deseja deletar esta resposta?',
    
    // Search
    'search.typeToSearch': 'Digite para buscar tickets...',
    'search.noResults': 'Nenhum ticket encontrado',
    'search.searchByName': 'Buscar por nome...',
    
    // Notifications
    'notifications.noRecent': 'Nenhuma notificação recente',
    'notifications.historyReset': 'Histórico resetado - todas as notificações serão mostradas novamente',
    'notifications.cleared': 'Notificações limpas',
    'notifications.testSuccess': 'Se você está vendo isso, as notificações estão funcionando! ✅',
    'notifications.testSent': 'Notificação de teste enviada! Verifique o canto superior direito.',
    'notifications.testError': 'Erro ao criar notificação:',
    
    // Desktop Notifications
    'desktopNotif.ticketReassigned': 'Ticket Reatribuído',
    'desktopNotif.youWereMentioned': 'Você foi mencionado no Jira',
    'desktopNotif.mentionedInComment': 'Você foi mencionado em um comentário',
    'desktopNotif.jiraUpdate': 'Atualização no Jira',
    'desktopNotif.newTicketAssigned': 'Novo ticket atribuído a você',
    'desktopNotif.ticketReassignedToYou': 'Ticket reatribuído para você',
    'desktopNotif.slaExpired': 'SLA Estourado!',
    'desktopNotif.slaExpiredBody': 'O SLA deste ticket expirou!',
    'desktopNotif.slaWarning': 'SLA em Atenção',
    'desktopNotif.slaWarningBody': 'Menos de 30 minutos para o SLA expirar!',
    
    // Ticket Preview
    'preview.loading': 'Carregando ticket...',
    'preview.error': 'Erro ao carregar ticket',
    'preview.noTitle': 'Sem título',
    'preview.unknownStatus': 'Status desconhecido',
    'preview.unknownPriority': 'Prioridade desconhecida',
    'preview.unassigned': 'Não atribuído',
    'preview.notDefined': 'Não definido',
    'preview.noComments': 'Nenhum comentário ainda',
    'preview.addComment': 'Adicionar comentário... (use @ para mencionar)',
    'preview.rating': 'Avaliação do cliente:',
    'preview.stars': 'estrelas',
    'preview.ratings': 'avaliação',
    'preview.ratingsPlural': 'avaliações',
    'preview.fullHistory': 'Histórico completo',
    'preview.created': 'Criado',
    'preview.updated': 'Atualizado',
    
    // Comments
    'comment.empty': 'Comentário não pode estar vazio',
    'comment.sending': 'Enviando comentário...',
    'comment.sent': 'Comentário enviado!',
    'comment.sendFailed': 'Falha ao enviar comentário',
    'comment.updating': 'Atualizando comentário...',
    'comment.updated': 'Comentário atualizado!',
    'comment.updateFailed': 'Falha ao atualizar comentário',
    'comment.deleting': 'Removendo comentário...',
    'comment.deleted': 'Comentário deletado!',
    'comment.deleteFailed': 'Falha ao deletar comentário',
    'comment.confirmDelete': 'Tem certeza que deseja deletar este comentário?',
    
    // Attachments
    'attachment.downloadSuccess': 'Anexo baixado com sucesso!',
    'attachment.downloadError': 'Erro ao baixar anexo',
    'attachment.uploading': 'Enviando anexo(s)...',
    'attachment.uploadSuccess': 'Anexo(s) enviado(s) com sucesso!',
    'attachment.uploadError': 'Erro ao enviar anexo(s)',
    'attachment.sent': 'anexo(s) enviado(s)!',
    
    // Fields
    'field.enterValue': 'Digite um valor',
    'field.selectOption': 'Selecione uma opção',
    'field.saving': 'Atualizando ticket...',
    'field.saved': 'Campo atualizado!',
    'field.saveFailed': 'Falha ao atualizar',
    
    // Status
    'status.transitionsUnavailable': 'Transições de status não disponíveis',
    'status.teamsLoadError': 'Não foi possível carregar times do Jira',
    
    // Connection
    'connection.connected': 'Conectado',
    'connection.disconnected': 'Desconectado',
    'connection.loading': 'Carregando...',
    'connection.unknown': 'Status desconhecido',
    'connection.error': 'Erro de Conexão',
    'connection.noConnection': 'Não foi possível conectar ao Jira. Verifique sua conexão e credenciais.',
    'connection.fetchError': 'Erro ao buscar dados',
    
    // Layout
    'layout.horizontal': 'Modo Horizontal ativo',
    'layout.superCompact': 'Modo Super Compacto ativo - Sempre visível',
    'layout.normal': 'Modo Normal ativo',
    'layout.backToNormal': 'Voltou ao modo normal',
    'layout.cardsUpdated': 'Ordem atualizada',
    
    // Focus Mode
    'focusMode.activated': 'Ativado',
    'focusMode.deactivated': 'Desativado',
    
    // Density Mode
    'density.default': 'Padrão',
    'density.compact': 'Compacto',
    'density.comfortable': 'Confortável',
    'density.modeActivated': 'ativado',
    
    // Priority
    'priority.critical': 'Crítico',
    'priority.high': 'Alto',
    'priority.medium': 'Médio',
    'priority.low': 'Baixo',
    
    // SLA
    'sla.ticketsInAlert': 'ticket(s) com SLA em alerta (até 30min ou atrasados) - Clique para ver detalhes',
    'sla.alertTitle': 'Tickets com SLA em Alerta (vencendo em até 30 minutos)',
    'sla.inAlert': 'SLA em alerta',
    
    // Old Tickets
    'oldTickets.title': 'Tickets Antigos (sem atualização há 7+ dias)',
    
    // Empty States
    'empty.nothingHere': 'Nada por aqui!',
    'empty.noTicketsAssigned': 'Você está sem tickets atribuídos no momento.',
    'empty.greatWork': 'Ótimo trabalho!',
    'empty.noWaitingSupport': 'Nenhum ticket aguardando suporte.',
    'empty.allResponded': 'Tudo respondido!',
    'empty.noWaitingCustomer': 'Nenhum ticket aguardando cliente.',
    'empty.congratulations': 'Parabéns!',
    'empty.noPending': 'Nenhum ticket pendente.',
    'empty.cleanArea': 'Área limpa!',
    'empty.noInProgress': 'Nenhum ticket em progresso no momento.',
    
    // Evaluated
    'evaluated.noTickets': 'Nenhum ticket avaliado encontrado',
    'evaluated.hint': 'Os tickets aparecem aqui quando você recebe avaliação do cliente',
    
    // Mentions
    'mentions.searchError': 'Erro ao buscar usuários',
    'mentions.noUsers': 'Nenhum usuário encontrado',
    
    // Config
    'config.saved': 'Configurações salvas com sucesso',
    'config.saveError': 'Não foi possível salvar as configurações',
    'config.queueId': 'ID da Fila',
    'config.refreshInterval': 'Intervalo de Atualização (segundos)',
    'config.oldTicketsDays': 'Dias sem atualização para alertar',
    'config.alertSla': 'Alertar sobre SLA próximo (1 hora antes)',
    'config.alertOldTickets': 'Alertar sobre tickets antigos',
    'config.newTickets': '🎫 Novos tickets atribuídos',
    'config.statusChanges': '🔄 Mudanças de status',
    'config.reassignments': '👤 Reatribuições para você',
    'config.mentions': '📢 Quando você for mencionado',
    'config.soundNotifications': '🔊 Tocar som nas notificações',
    
    // Shortcuts Custom
    'shortcutsCustom.title': '⌨️ Personalizar Atalhos',
    'shortcutsCustom.quickSearch': 'Busca Rápida',
    'shortcutsCustom.refresh': 'Atualizar',
    'shortcutsCustom.edit': 'Editar',
    'shortcutsCustom.restoreDefault': 'Restaurar Padrão',
    'shortcutsCustom.restored': 'Restaurados para padrão',
    
    // Language
    'language.title': '🌍 Escolher Idioma / Choose Language / Elegir Idioma',
    'language.applied': 'aplicado',
    
    // Daily Activity
    'daily.noReceived': 'Nenhum ticket recebido hoje',
    'daily.noResolved': 'Nenhum ticket fechado hoje',
    'daily.noComments': 'Nenhum comentário hoje',
    
    // Metrics
    'metrics.updated': 'Métricas atualizadas com sucesso!',
    'metrics.error': 'Erro ao carregar métricas:',
    
    // Ticket Resolved
    'ticket.resolved': 'resolvido! Parabéns!',
    
    // General
    'general.success': 'Sucesso!',
    'general.error': 'Erro',
    'general.warning': 'Atenção',
    'general.info': 'Info',
    'general.saved': 'Salvo',
    'general.deleted': 'Deletado',
    'general.inserted': 'Inserido',
    'general.sending': 'Enviando',
    'general.saving': 'Salvando',
    'general.deleting': 'Deletando',
    'general.removed': 'Removido',
    'general.newWindow': 'Nova Janela',
    'general.keyCopied': 'Key copiada!',
    'general.all': 'Todos',
    'general.expand': 'Expandir',
    'general.minimize': 'Minimizar',
    'general.restore': 'Restaurar',
    'general.opacity': '🪟 Opacidade:'
  },
  
  // ========================================
  // 🇺🇸 ENGLISH
  // ========================================
  'en': {
    // Header
    'app.title': 'Jira Monitor',
    'header.menu': 'Menu',
    'header.notifications': 'Notifications',
    'header.docs': 'Documentation',
    'header.minimize': 'Minimize',
    'header.close': 'Close',
    
    // Menu Items
    'menu.proMode': '⭐ Pro Mode',
    'menu.refresh': '🔄 Refresh',
    'menu.settings': '⚙️ Settings',
    'menu.okta': '🔐 OKTA',
    'menu.jamf': '🍎 JAMF',
    'menu.googleAdmin': '🔐 Google Admin Console',
    'menu.search': '🔍 Quick Search',
    'menu.shortcuts': '⌨️ Shortcuts',
    'menu.templates': '📋 Templates',
    'menu.timer': '⏱️ Timer / Pomodoro',
    'menu.opacity': '🪟 Opacity',
    'menu.themes': '🎨 Themes',
    'menu.language': '🌍 Language',
    'menu.export': '📄 Export',
    
    // User Monitor
    'user.monitor': 'Monitor User',
    'user.you': 'You',
    'user.addAnother': 'Add Another User...',
    
    // Stats Cards
    'stats.total': 'Total Tickets - IT',
    'stats.support': 'Waiting for Support - IT',
    'stats.customer': 'Waiting for Customer - IT',
    'stats.pending': 'Tickets Pending - IT',
    'stats.expand': 'Expand',
    'stats.sla': 'SLA',
    'stats.old': 'Old',
    
    // Pro Mode Sections
    'pro.dailyActivity': '📅 Today\'s Activity',
    'pro.received': 'Received',
    'pro.resolved': 'Resolved',
    'pro.commented': 'Activity',
    'pro.comments': 'comments',
    'pro.today': 'today',
    'pro.telefonia': '📱 Telephony',
    'pro.simCards': 'SIM Cards Tickets',
    'pro.evaluated': '✅ Evaluated Tickets',
    'pro.lastEvaluated': 'All Evaluated',
    'pro.byProject': '📊 By Project',
    'pro.recentTickets': '🕐 Recent Tickets',
    'pro.trend': '📈 Trend (7 days)',
    
    // Performance Dashboard
    'perf.title': '📊 Performance Dashboard',
    'perf.avgTime': 'Average Time',
    'perf.resolution': 'to resolution',
    'perf.resolved': 'Resolved',
    'perf.last30days': 'last 30 days',
    'perf.perWeek': 'Per Week',
    'perf.closeRate': 'close rate',
    'perf.byPriority': '🏷️ By Priority',
    'perf.byProject': '📦 By Project',
    'perf.heatmap': '🔥 Activity Heatmap',
    'perf.productive': 'Most productive hours (last 30 days)',
    'perf.last10': '📋 Last 10 Resolved',
    'perf.updateMetrics': 'Update Metrics',
    
    // Proactive Alerts
    'alerts.title': '🔔 Proactive Alerts',
    'alerts.noResponse': 'Tickets without response',
    'alerts.criticalSla': 'Critical SLA',
    'alerts.mentions': 'Mentions in comments',
    'alerts.allClear': 'All clear! No alerts at this time.',
    
    // Timer Widget
    'timer.title': 'Timer',
    'timer.minimize': 'Minimize',
    'timer.close': 'Close',
    'timer.manual': 'Manual',
    'timer.pomodoro': 'Pomodoro',
    'timer.start': 'Start',
    'timer.pause': 'Pause',
    'timer.stop': 'Stop',
    'timer.session': 'Session:',
    'timer.next': 'Next:',
    'timer.break': 'Break',
    'timer.worklogComment': 'Worklog comment (optional)...',
    'timer.autoSave': 'Save worklog automatically',
    'timer.saveWorklog': 'Save Worklog to Jira',
    
    // Search
    'search.placeholder': 'Search ticket (e.g.: IT-1234) or keywords...',
    'search.quickSearch': '🔍 Search ticket by key, summary or project...',
    'search.hint': '↑↓ to navigate • Enter to open • Esc to close',
    
    // Templates
    'templates.title': '📋 Response Templates',
    'templates.create': 'Create New Template',
    'templates.edit': '✏️ Edit Template',
    'templates.name': 'Template Name:',
    'templates.text': 'Text:',
    'templates.internal': 'Internal comment (visible to team only)',
    'templates.cancel': 'Cancel',
    'templates.save': 'Save Template',
    'templates.hint': 'Click on a template to use • Cmd+Shift+T to open',
    
    // Notifications
    'notifications.title': 'Notifications',
    'notifications.viewAll': 'View All',
    'notifications.clear': 'Clear',
    'notifications.reset': '🔄 Reset',
    
    // Documentation
    'docs.title': '📚 Documentation',
    'docs.l1': 'L1 Documentation',
    'docs.bpo': 'BPO Documentation',
    
    // Daily Activity
    'daily.title': '📊 Today\'s Activity',
    'daily.new': 'New',
    'daily.closed': 'Closed',
    'daily.updated': 'Updated',
    'daily.receivedTitle': '🆕 Tickets Received Today',
    'daily.resolvedTitle': '✅ Tickets Closed Today',
    'daily.commentsTitle': '💬 Today\'s Comments',
    'daily.noReceived': 'No tickets received today',
    'daily.noResolved': 'No tickets closed today',
    'daily.noComments': 'No comments today',
    
    // Theme Customizer
    'theme.title': '🎨 Customize Theme',
    'theme.accent': 'Accent Color:',
    'theme.presets': 'Predefined Themes:',
    'theme.default': 'Default',
    'theme.cyberpunk': 'Cyberpunk',
    'theme.nord': 'Nord',
    'theme.dracula': 'Dracula',
    
    // Shortcuts
    'shortcuts.title': '⌨️ Keyboard Shortcuts',
    'shortcuts.main': '🚀 Main Shortcuts',
    'shortcuts.openSearch': '🔍 Open quick ticket search',
    'shortcuts.togglePro': '⭐ Toggle Pro Mode',
    'shortcuts.toggleLayout': '🔄 Toggle layout (vertical/horizontal)',
    'shortcuts.refresh': '🔄 Refresh manually',
    'shortcuts.openSettings': '⚙️ Open settings',
    'shortcuts.close': '❌ Close modals or minimize',
    'shortcuts.newFeatures': '✨ New UX Features',
    'shortcuts.focusMode': '🎯 Enable/disable Focus Mode',
    'shortcuts.export': '📄 Export report',
    'shortcuts.numeric': '🔢 Numeric Shortcuts',
    'shortcuts.card1': '📊 Open Total Tickets card',
    'shortcuts.card2': '🔧 Open Waiting for Support card',
    'shortcuts.card3': '👤 Open Waiting for Customer card',
    'shortcuts.card4': '⏸️ Open Tickets Pending card',
    'shortcuts.searchSection': '🔍 Quick Search',
    'shortcuts.navigate': 'Navigate between results',
    'shortcuts.open': 'Open selected ticket',
    'shortcuts.tips': '💡 Tips',
    
    // Export
    'export.title': '📄 Export Report',
    'export.period': 'Period:',
    'export.format': 'Format:',
    'export.include': 'Include:',
    'export.stats': 'Statistics',
    'export.tickets': 'Ticket List',
    'export.trend': 'Trend Chart',
    'export.download': '📥 Download Report',
    'export.today': 'Today',
    'export.week': 'This Week',
    'export.month': 'This Month',
    
    // Welcome Message (First Time)
    'welcome.title': 'Welcome to Jira Monitor!',
    'welcome.subtitle': 'To get started, configure your Jira credentials below:',
    'welcome.step1': '✅ Your company\'s Jira URL',
    'welcome.step2': '✅ Your corporate email',
    'welcome.step3': '✅ Jira API Token (click the link to create one)',
    
    // Settings
    'settings.title': '⚙️ Settings',
    'settings.language': 'Language / Idioma / Idioma',
    'settings.languageHint': 'The interactive tutorial will be displayed in this language',
    'settings.jiraUrl': 'Jira URL',
    'settings.email': 'Email',
    'settings.apiToken': 'API Token',
    'settings.createApiToken': '🔗 Create your Jira API token here',
    'settings.queueId': 'Queue ID',
    'settings.refreshInterval': 'Refresh Interval (seconds)',
    'settings.oldTicketsDays': 'Days without update to alert',
    'settings.alertSla': 'Alert about upcoming SLA (1 hour before)',
    'settings.alertOld': 'Alert about old tickets',
    'settings.desktopNotifications': '🔔 Desktop notifications',
    'settings.test': 'Test',
    'settings.notifyNew': '🎫 New assigned tickets',
    'settings.notifyStatus': '🔄 Status changes',
    'settings.notifyReassign': '👤 Reassignments to you',
    'settings.notifyMentions': '📢 When you are mentioned',
    'settings.soundNotifications': '🔊 Play sound on notifications',
    'settings.proMode': '⭐ Pro Mode',
    'settings.theme': '🎨 Application Theme',
    'settings.themeDefault': '🎨 Default (Purple Gradient)',
    'settings.themeDark': '🌙 Dark (Dark Mode)',
    'settings.themeLight': '☀️ Light (Light Mode)',
    'settings.language': '🌍 Language',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.placeholderUrl': 'https://your-company.atlassian.net',
    'settings.placeholderEmail': 'your.email@company.com',
    'settings.placeholderToken': 'Your Jira API token',
    
    // Updated ago (relative time)
    'time.updatedSecondsAgo': 'Updated {time}s ago',
    'time.updatedMinutesAgo': 'Updated {time} min ago',
    'time.updatedHoursAgo': 'Updated {time}h ago',
    'time.updated': 'Updated',
    'time.lastUpdate': 'Last update',
    'time.now': 'now',
    'time.minutesAgo': '{time} minutes ago',
    'time.hoursAgo': '{time} hours ago',
    'time.daysAgo': '{time} days ago',
    
    // Badge modals
    'badge.slaTitle': '⏰ Tickets with SLA Alert (expiring in 30 minutes)',
    'badge.oldTitle': '📅 Old Tickets (no update for 7+ days)',
    
    // Footer
    'footer.loading': 'Loading...',
    'footer.refresh': 'Refresh',
    'footer.lastUpdate': 'Last update',
    
    // Error Messages
    'error.connection': 'Connection Error',
    'error.noConnection': 'Could not connect to Jira',
    'error.retry': 'Try Again',
    'error.loading': 'Error loading ticket',
    
    // Buttons
    'btn.close': 'Close',
    'btn.save': 'Save',
    'btn.cancel': 'Cancel',
    'btn.confirm': 'Confirm',
    'btn.add': 'Add',
    'btn.edit': 'Edit',
    'btn.delete': 'Delete',
    'btn.retry': 'Try Again',
    
    // Add User Modal
    'addUser.title': '➕ Add User to Monitor',
    'addUser.description': 'Enter the email of the user you want to monitor:',
    'addUser.placeholder': 'user@company.com',
    'addUser.cancel': 'Cancel',
    'addUser.add': 'Add',
    
    // Context Menu
    'context.back': '⬅️ Back',
    'context.forward': '➡️ Forward',
    'context.reload': '🔄 Reload',
    'context.cut': '✂️ Cut',
    'context.copy': '📋 Copy',
    'context.paste': '📄 Paste',
    'context.delete': '🗑️ Delete',
    'context.selectAll': '🔍 Select All',
    'context.copyLink': '🔗 Copy Link',
    'context.copyImage': '🖼️ Copy Image',
    'context.openExternal': '🌐 Open Link in External Browser',
    'context.inspect': '🔧 Inspect Element',
    
    // Onboarding Tour
    'tour.step1.title': '📊 Overview',
    'tour.step1.description': 'Here you can see your ticket counters (Total, Support, Pending, etc). Click on the cards to expand and view the complete list of tickets.',
    'tour.step2.title': '🔄 Refresh',
    'tour.step2.description': 'Click here to force a manual sync with Jira. The app automatically updates at configurable intervals.',
    'tour.step3.title': '🔔 Notifications',
    'tour.step3.description': 'View recent alerts and change history for your tickets. You\'ll be notified about new tickets, status changes, and mentions.',
    'tour.step4.title': '⚙️ Menu & Settings',
    'tour.step4.description': 'Access Pro Mode, custom Themes, connection settings, and much more. Use Cmd+, to quickly open settings.',
    'tour.step5.title': '🎉 Ready to go!',
    'tour.step5.description': 'You now know the basics of Jira Monitor. Use Cmd+K for quick ticket search and Cmd+P to enable Pro Mode. Good luck!',
    'tour.buttons.next': 'Next',
    'tour.buttons.previous': 'Previous',
    'tour.buttons.done': 'Done',
    'tour.buttons.skip': 'Skip',
    'tour.success': '✅ Tutorial completed! Feel free to explore.',
    
    // Tooltips / Titles
    'tooltip.totalTickets': 'Total Tickets',
    'tooltip.activateAdvanced': 'Activate advanced features',
    'tooltip.refreshManual': 'Refresh data manually (Cmd+R)',
    'tooltip.openSettings': 'Open settings (Cmd+,)',
    'tooltip.openOkta': 'Open Nubank OKTA',
    'tooltip.openJamf': 'Open JAMF Cloud',
    'tooltip.openJiraPortal': 'Open Jira Portal',
    'tooltip.openGoogleAdmin': 'Open Google Admin Console',
    'tooltip.quickSearch': 'Quick ticket search (Cmd+K)',
    'tooltip.viewShortcuts': 'View all keyboard shortcuts',
    'tooltip.templates': 'Quick response templates (Cmd+Shift+T)',
    'tooltip.openTimer': 'Open Timer/Pomodoro (Cmd+T)',
    'tooltip.customizeTheme': 'Customize theme',
    'tooltip.toggleLayout': 'Toggle Layout (Cmd+L)',
    'tooltip.adjustOpacity': 'Adjust window transparency',
    'tooltip.exportReport': 'Export report',
    'tooltip.connectionStatus': 'Connection status',
    'tooltip.resetNotifications': 'Reset cleared notifications history',
    'tooltip.zoomOut': 'Zoom Out (Cmd+-)',
    'tooltip.zoomIn': 'Zoom In (Cmd++)',
    'tooltip.densityMode': 'Density Mode',
    'tooltip.monitoredUser': 'Monitored User',
    'tooltip.backToNormal': 'Back to normal mode (ESC or Cmd+L)',
    'tooltip.copyKey': 'Copy key',
    'tooltip.openInJira': 'Open in Jira',
    'tooltip.removeFromHistory': 'Remove from history',
    'tooltip.openInNewWindow': 'Open in new window',
    'tooltip.removeNotification': 'Remove notification',
    'tooltip.clickToEdit': 'Click to edit',
    
    // Stat Cards
    'card.totalTicketsIT': 'Total Tickets - IT',
    'card.waitingSupport': 'Waiting for Support - IT',
    'card.waitingCustomer': 'Waiting for Customer - IT',
    'card.ticketsPending': 'Tickets Pending - IT',
    'card.ticketsInProgress': 'Tickets In Progress - IT',
    'card.ticketsPendingSimcard': 'Tickets Pending SimCard',
    'card.ticketsL0JiraBot': 'Tickets L0 Jira Bot',
    'card.allL1Open': 'All L1 Open',
    'card.simcardControl': 'SIMCARD Control',
    
    // Mini Stats
    'ministat.resolutionRate': 'Resolution Rate',
    'ministat.avgTime': 'Average Time',
    'ministat.today': 'Today',
    
    // Timer
    'timer.freeTimer': 'Free Timer',
    'timer.session': 'Session:',
    'timer.next': 'Next:',
    'timer.breakMin': 'Break (5min)',
    'timer.autoSaveWorklog': 'Save worklog automatically',
    'timer.saveWorklogJira': 'Save Worklog to Jira',
    'timer.stopBeforeSwitch': 'Stop the timer before switching modes',
    'timer.pomodoroComplete': 'Pomodoro complete! Time for a break.',
    'timer.breakComplete': 'Break complete! Back to work.',
    'timer.noTicketSelected': 'No ticket selected for timer',
    'timer.timeTooShort': 'Time too short to log (minimum 1 minute)',
    'timer.savingWorklog': 'Saving worklog...',
    'timer.worklogSaved': 'Worklog saved! Time:',
    'timer.worklogError': 'Error saving worklog:',
    
    // Theme
    'theme.mode': 'Theme Mode:',
    'theme.defaultName': 'Default',
    'theme.defaultDesc': 'Purple Gradient',
    'theme.darkName': 'Dark',
    'theme.lightName': 'Light',
    'theme.accentColor': 'Accent Color:',
    'theme.customColor': 'Or choose a custom color:',
    'theme.specialThemes': 'Special Themes:',
    'theme.applyCustom': 'Apply Custom Color',
    'theme.accentUpdated': 'Accent color updated',
    'theme.applied': 'applied',
    
    // Export
    'export.today': 'Today',
    'export.thisWeek': 'This Week',
    'export.thisMonth': 'This Month',
    'export.statistics': 'Statistics',
    'export.ticketList': 'Ticket List',
    'export.trendChart': 'Trend Chart',
    'export.downloadBtn': '📥 Download Report',
    'export.downloaded': 'Report downloaded successfully',
    'export.pdfDev': 'Feature in development',
    
    // Floating Window
    'floatingWindow.title': '🪟 Floating Window (Status Lights)',
    'floatingWindow.enable': 'Enable floating window',
    'floatingWindow.enabled': 'Floating window enabled',
    'floatingWindow.disabled': 'Floating window disabled',
    'floatingWindow.opacity': 'Opacity',
    'floatingWindow.size': 'Size',
    'floatingWindow.width': 'Width',
    'floatingWindow.height': 'Height',
    'floatingWindow.show': 'Show',
    'floatingWindow.critical': '🔴 Critical',
    'floatingWindow.warning': '🟡 Warning',
    'floatingWindow.normal': '🟢 Normal',
    'floatingWindow.showTicketList': 'Show ticket list',
    
    // User Monitor
    'userMonitor.title': '👤 Monitor User',
    'userMonitor.you': 'You',
    'userMonitor.addAnother': 'Add Another User...',
    'userMonitor.monitoring': 'Monitoring:',
    'userMonitor.dataFrom': 'Data from:',
    
    // Add User Modal
    'addUser.enterEmail': 'Enter the email of the user you want to monitor:',
    'addUser.placeholder': 'user@company.com',
    'addUser.removed': 'permanently removed',
    'addUser.monitoringInNewWindow': 'in new window',
    'addUser.nowMonitoring': 'Now monitoring',
    'addUser.invalidEmail': 'Please enter a valid email',
    'addUser.invalidEmailShort': 'Invalid email',
    
    // Templates
    'templates.namePlaceholder': 'E.g.: Awaiting Customer',
    'templates.textPlaceholder': 'Enter template text...',
    'templates.internalComment': 'Internal comment (visible to team only)',
    'templates.applied': 'applied!',
    'templates.copied': 'copied!',
    'templates.nameTextRequired': 'Name and text are required!',
    'templates.saved': 'saved!',
    'templates.deleted': 'Template deleted!',
    'templates.confirmDelete': 'Are you sure you want to delete the template',
    
    // Canned Responses
    'cannedResponses.title': 'Canned Responses',
    'cannedResponses.namePlaceholder': 'E.g.: Initial Greeting',
    'cannedResponses.contentPlaceholder': 'Enter the response content...',
    'cannedResponses.inserted': 'Response inserted in comment',
    'cannedResponses.fillRequired': 'Fill in name and content',
    'cannedResponses.saved': 'Response saved successfully',
    'cannedResponses.saveFailed': 'Failed to save response',
    'cannedResponses.deleted': 'Response removed',
    'cannedResponses.deleteFailed': 'Failed to delete',
    'cannedResponses.confirmDelete': 'Are you sure you want to delete this response?',
    
    // Search
    'search.typeToSearch': 'Type to search tickets...',
    'search.noResults': 'No tickets found',
    'search.searchByName': 'Search by name...',
    
    // Notifications
    'notifications.noRecent': 'No recent notifications',
    'notifications.historyReset': 'History reset - all notifications will be shown again',
    'notifications.cleared': 'Notifications cleared',
    'notifications.testSuccess': 'If you see this, notifications are working! ✅',
    'notifications.testSent': 'Test notification sent! Check the upper right corner.',
    'notifications.testError': 'Error creating notification:',
    
    // Desktop Notifications
    'desktopNotif.ticketReassigned': 'Ticket Reassigned',
    'desktopNotif.youWereMentioned': 'You were mentioned in Jira',
    'desktopNotif.mentionedInComment': 'You were mentioned in a comment',
    'desktopNotif.jiraUpdate': 'Jira Update',
    'desktopNotif.newTicketAssigned': 'New ticket assigned to you',
    'desktopNotif.ticketReassignedToYou': 'Ticket reassigned to you',
    'desktopNotif.slaExpired': 'SLA Expired!',
    'desktopNotif.slaExpiredBody': 'This ticket\'s SLA has expired!',
    'desktopNotif.slaWarning': 'SLA Warning',
    'desktopNotif.slaWarningBody': 'Less than 30 minutes until SLA expires!',
    
    // Ticket Preview
    'preview.loading': 'Loading ticket...',
    'preview.error': 'Error loading ticket',
    'preview.noTitle': 'No title',
    'preview.unknownStatus': 'Unknown status',
    'preview.unknownPriority': 'Unknown priority',
    'preview.unassigned': 'Unassigned',
    'preview.notDefined': 'Not defined',
    'preview.noComments': 'No comments yet',
    'preview.addComment': 'Add comment... (use @ to mention)',
    'preview.rating': 'Customer rating:',
    'preview.stars': 'stars',
    'preview.ratings': 'rating',
    'preview.ratingsPlural': 'ratings',
    'preview.fullHistory': 'Full history',
    'preview.created': 'Created',
    'preview.updated': 'Updated',
    
    // Comments
    'comment.empty': 'Comment cannot be empty',
    'comment.sending': 'Sending comment...',
    'comment.sent': 'Comment sent!',
    'comment.sendFailed': 'Failed to send comment',
    'comment.updating': 'Updating comment...',
    'comment.updated': 'Comment updated!',
    'comment.updateFailed': 'Failed to update comment',
    'comment.deleting': 'Removing comment...',
    'comment.deleted': 'Comment deleted!',
    'comment.deleteFailed': 'Failed to delete comment',
    'comment.confirmDelete': 'Are you sure you want to delete this comment?',
    
    // Attachments
    'attachment.downloadSuccess': 'Attachment downloaded successfully!',
    'attachment.downloadError': 'Error downloading attachment',
    'attachment.uploading': 'Uploading attachment(s)...',
    'attachment.uploadSuccess': 'Attachment(s) uploaded successfully!',
    'attachment.uploadError': 'Error uploading attachment(s)',
    'attachment.sent': 'attachment(s) uploaded!',
    
    // Fields
    'field.enterValue': 'Enter a value',
    'field.selectOption': 'Select an option',
    'field.saving': 'Updating ticket...',
    'field.saved': 'Field updated!',
    'field.saveFailed': 'Failed to update',
    
    // Status
    'status.transitionsUnavailable': 'Status transitions unavailable',
    'status.teamsLoadError': 'Could not load Jira teams',
    
    // Connection
    'connection.connected': 'Connected',
    'connection.disconnected': 'Disconnected',
    'connection.loading': 'Loading...',
    'connection.unknown': 'Unknown status',
    'connection.error': 'Connection Error',
    'connection.noConnection': 'Could not connect to Jira. Check your connection and credentials.',
    'connection.fetchError': 'Error fetching data',
    
    // Layout
    'layout.horizontal': 'Horizontal Mode active',
    'layout.superCompact': 'Super Compact Mode active - Always visible',
    'layout.normal': 'Normal Mode active',
    'layout.backToNormal': 'Back to normal mode',
    'layout.cardsUpdated': 'Order updated',
    
    // Focus Mode
    'focusMode.activated': 'Activated',
    'focusMode.deactivated': 'Deactivated',
    
    // Density Mode
    'density.default': 'Default',
    'density.compact': 'Compact',
    'density.comfortable': 'Comfortable',
    'density.modeActivated': 'activated',
    
    // Priority
    'priority.critical': 'Critical',
    'priority.high': 'High',
    'priority.medium': 'Medium',
    'priority.low': 'Low',
    
    // SLA
    'sla.ticketsInAlert': 'ticket(s) with SLA alert (under 30min or overdue) - Click for details',
    'sla.alertTitle': 'Tickets with SLA Alert (expiring in under 30 minutes)',
    'sla.inAlert': 'SLA alert',
    
    // Old Tickets
    'oldTickets.title': 'Old Tickets (no update for 7+ days)',
    
    // Empty States
    'empty.nothingHere': 'Nothing here!',
    'empty.noTicketsAssigned': 'You have no tickets assigned at the moment.',
    'empty.greatWork': 'Great work!',
    'empty.noWaitingSupport': 'No tickets waiting for support.',
    'empty.allResponded': 'All responded!',
    'empty.noWaitingCustomer': 'No tickets waiting for customer.',
    'empty.congratulations': 'Congratulations!',
    'empty.noPending': 'No pending tickets.',
    'empty.cleanArea': 'Clean area!',
    'empty.noInProgress': 'No tickets in progress at the moment.',
    
    // Evaluated
    'evaluated.noTickets': 'No evaluated tickets found',
    'evaluated.hint': 'Tickets appear here when you receive customer feedback',
    
    // Mentions
    'mentions.searchError': 'Error searching users',
    'mentions.noUsers': 'No users found',
    
    // Config
    'config.saved': 'Settings saved successfully',
    'config.saveError': 'Could not save settings',
    'config.queueId': 'Queue ID',
    'config.refreshInterval': 'Refresh Interval (seconds)',
    'config.oldTicketsDays': 'Days without update to alert',
    'config.alertSla': 'Alert about upcoming SLA (1 hour before)',
    'config.alertOldTickets': 'Alert about old tickets',
    'config.newTickets': '🎫 New assigned tickets',
    'config.statusChanges': '🔄 Status changes',
    'config.reassignments': '👤 Reassignments to you',
    'config.mentions': '📢 When you are mentioned',
    'config.soundNotifications': '🔊 Play sound on notifications',
    
    // Shortcuts Custom
    'shortcutsCustom.title': '⌨️ Customize Shortcuts',
    'shortcutsCustom.quickSearch': 'Quick Search',
    'shortcutsCustom.refresh': 'Refresh',
    'shortcutsCustom.edit': 'Edit',
    'shortcutsCustom.restoreDefault': 'Restore Default',
    'shortcutsCustom.restored': 'Restored to default',
    
    // Language
    'language.title': '🌍 Choose Language / Escolher Idioma / Elegir Idioma',
    'language.applied': 'applied',
    
    // Daily Activity
    'daily.noReceived': 'No tickets received today',
    'daily.noResolved': 'No tickets closed today',
    'daily.noComments': 'No comments today',
    
    // Metrics
    'metrics.updated': 'Metrics updated successfully!',
    'metrics.error': 'Error loading metrics:',
    
    // Ticket Resolved
    'ticket.resolved': 'resolved! Congratulations!',
    
    // General
    'general.success': 'Success!',
    'general.error': 'Error',
    'general.warning': 'Warning',
    'general.info': 'Info',
    'general.saved': 'Saved',
    'general.deleted': 'Deleted',
    'general.inserted': 'Inserted',
    'general.sending': 'Sending',
    'general.saving': 'Saving',
    'general.deleting': 'Deleting',
    'general.removed': 'Removed',
    'general.newWindow': 'New Window',
    'general.keyCopied': 'Key copied!',
    'general.all': 'All',
    'general.expand': 'Expand',
    'general.minimize': 'Minimize',
    'general.restore': 'Restore',
    'general.opacity': '🪟 Opacity:'
  },
  
  // ========================================
  // 🇪🇸 ESPAÑOL
  // ========================================
  'es': {
    // Header
    'app.title': 'Jira Monitor',
    'header.menu': 'Menú',
    'header.notifications': 'Notificaciones',
    'header.docs': 'Documentación',
    'header.minimize': 'Minimizar',
    'header.close': 'Cerrar',
    
    // Menu Items
    'menu.proMode': '⭐ Modo Pro',
    'menu.refresh': '🔄 Actualizar',
    'menu.settings': '⚙️ Configuración',
    'menu.okta': '🔐 OKTA',
    'menu.jamf': '🍎 JAMF',
    'menu.googleAdmin': '🔐 Google Admin Console',
    'menu.search': '🔍 Búsqueda Rápida',
    'menu.shortcuts': '⌨️ Atajos',
    'menu.templates': '📋 Plantillas',
    'menu.timer': '⏱️ Timer / Pomodoro',
    'menu.opacity': '🪟 Opacidad',
    'menu.themes': '🎨 Temas',
    'menu.language': '🌍 Idioma',
    'menu.export': '📄 Exportar',
    
    // User Monitor
    'user.monitor': 'Monitorear Usuario',
    'user.you': 'Tú',
    'user.addAnother': 'Agregar Otro Usuario...',
    
    // Stats Cards
    'stats.total': 'Total de Tickets - IT',
    'stats.support': 'Esperando Soporte - IT',
    'stats.customer': 'Esperando Cliente - IT',
    'stats.pending': 'Tickets Pendientes - IT',
    'stats.expand': 'Expandir',
    'stats.sla': 'SLA',
    'stats.old': 'Antiguos',
    
    // Pro Mode Sections
    'pro.dailyActivity': '📅 Actividad de Hoy',
    'pro.received': 'Recibidos',
    'pro.resolved': 'Cerrados',
    'pro.commented': 'Actividad',
    'pro.comments': 'comentarios',
    'pro.today': 'hoy',
    'pro.telefonia': '📱 Telefonía',
    'pro.simCards': 'Tickets SIM Cards',
    'pro.evaluated': '✅ Tickets Evaluados',
    'pro.lastEvaluated': 'Todos los Evaluados',
    'pro.byProject': '📊 Por Proyecto',
    'pro.recentTickets': '🕐 Tickets Recientes',
    'pro.trend': '📈 Tendencia (7 días)',
    
    // Performance Dashboard
    'perf.title': '📊 Panel de Rendimiento',
    'perf.avgTime': 'Tiempo Promedio',
    'perf.resolution': 'de resolución',
    'perf.resolved': 'Resueltos',
    'perf.last30days': 'últimos 30 días',
    'perf.perWeek': 'Por Semana',
    'perf.closeRate': 'tasa de cierre',
    'perf.byPriority': '🏷️ Por Prioridad',
    'perf.byProject': '📦 Por Proyecto',
    'perf.heatmap': '🔥 Mapa de Calor de Actividad',
    'perf.productive': 'Horarios más productivos (últimos 30 días)',
    'perf.last10': '📋 Últimos 10 Resueltos',
    'perf.updateMetrics': 'Actualizar Métricas',
    
    // Timer Widget
    'timer.title': 'Temporizador',
    'timer.minimize': 'Minimizar',
    'timer.close': 'Cerrar',
    'timer.manual': 'Manual',
    'timer.pomodoro': 'Pomodoro',
    'timer.start': 'Iniciar',
    'timer.pause': 'Pausar',
    'timer.stop': 'Parar',
    'timer.session': 'Sesión:',
    'timer.next': 'Siguiente:',
    'timer.break': 'Pausa',
    'timer.worklogComment': 'Comentario del worklog (opcional)...',
    'timer.autoSave': 'Guardar worklog automáticamente',
    'timer.saveWorklog': 'Guardar Worklog en Jira',
    
    // Search
    'search.placeholder': 'Buscar ticket (ej: IT-1234) o palabras clave...',
    'search.quickSearch': '🔍 Buscar ticket por clave, resumen o proyecto...',
    'search.hint': '↑↓ para navegar • Enter para abrir • Esc para cerrar',
    
    // Templates
    'templates.title': '📋 Plantillas de Respuesta',
    'templates.create': 'Crear Nueva Plantilla',
    'templates.edit': '✏️ Editar Plantilla',
    'templates.name': 'Nombre de la Plantilla:',
    'templates.text': 'Texto:',
    'templates.internal': 'Comentario interno (visible solo para el equipo)',
    'templates.cancel': 'Cancelar',
    'templates.save': 'Guardar Plantilla',
    'templates.hint': 'Haz clic en una plantilla para usar • Cmd+Shift+T para abrir',
    
    // Notifications
    'notifications.title': 'Notificaciones',
    'notifications.viewAll': 'Ver Todas',
    'notifications.clear': 'Limpiar',
    'notifications.reset': '🔄 Resetear',
    
    // Documentation
    'docs.title': '📚 Documentación',
    'docs.l1': 'Documentación L1',
    'docs.bpo': 'Documentación BPO',
    
    // Daily Activity
    'daily.title': '📊 Actividad de Hoy',
    'daily.new': 'Nuevos',
    'daily.closed': 'Cerrados',
    'daily.updated': 'Actualizados',
    'daily.receivedTitle': '🆕 Tickets Recibidos Hoy',
    'daily.resolvedTitle': '✅ Tickets Cerrados Hoy',
    'daily.commentsTitle': '💬 Comentarios de Hoy',
    'daily.noReceived': 'No hay tickets recibidos hoy',
    'daily.noResolved': 'No hay tickets cerrados hoy',
    'daily.noComments': 'No hay comentarios hoy',
    
    // Theme Customizer
    'theme.title': '🎨 Personalizar Tema',
    'theme.accent': 'Color de Acento:',
    'theme.presets': 'Temas Predefinidos:',
    'theme.default': 'Predeterminado',
    'theme.cyberpunk': 'Cyberpunk',
    'theme.nord': 'Nord',
    'theme.dracula': 'Dracula',
    
    // Shortcuts
    'shortcuts.title': '⌨️ Atajos de Teclado',
    'shortcuts.main': '🚀 Atajos Principales',
    'shortcuts.openSearch': '🔍 Abrir búsqueda rápida de tickets',
    'shortcuts.togglePro': '⭐ Alternar Modo Pro',
    'shortcuts.toggleLayout': '🔄 Alternar diseño (vertical/horizontal)',
    'shortcuts.refresh': '🔄 Actualizar manualmente',
    'shortcuts.openSettings': '⚙️ Abrir configuración',
    'shortcuts.close': '❌ Cerrar modales o minimizar',
    'shortcuts.newFeatures': '✨ Nuevas Características UX',
    'shortcuts.focusMode': '🎯 Activar/desactivar Modo Foco',
    'shortcuts.export': '📄 Exportar informe',
    'shortcuts.numeric': '🔢 Atajos Numéricos',
    'shortcuts.card1': '📊 Abrir tarjeta Total de Tickets',
    'shortcuts.card2': '🔧 Abrir tarjeta Esperando Soporte',
    'shortcuts.card3': '👤 Abrir tarjeta Esperando Cliente',
    'shortcuts.card4': '⏸️ Abrir tarjeta Tickets Pendientes',
    'shortcuts.searchSection': '🔍 Búsqueda Rápida',
    'shortcuts.navigate': 'Navegar entre resultados',
    'shortcuts.open': 'Abrir ticket seleccionado',
    'shortcuts.tips': '💡 Consejos',
    
    // Export
    'export.title': '📄 Exportar Informe',
    'export.period': 'Período:',
    'export.format': 'Formato:',
    'export.include': 'Incluir:',
    'export.stats': 'Estadísticas',
    'export.tickets': 'Lista de Tickets',
    'export.trend': 'Gráfico de Tendencia',
    'export.download': '📥 Descargar Informe',
    'export.today': 'Hoy',
    'export.week': 'Esta Semana',
    'export.month': 'Este Mes',
    
    // Welcome Message (First Time)
    'welcome.title': '¡Bienvenido a Jira Monitor!',
    'welcome.subtitle': 'Para comenzar, configura tus credenciales de Jira a continuación:',
    'welcome.step1': '✅ URL de Jira de tu empresa',
    'welcome.step2': '✅ Tu correo corporativo',
    'welcome.step3': '✅ Token de API de Jira (haz clic en el enlace para crearlo)',
    
    // Settings
    'settings.title': '⚙️ Configuración',
    'settings.language': 'Idioma / Language / Idioma',
    'settings.languageHint': 'El tutorial interactivo se mostrará en este idioma',
    'settings.jiraUrl': 'URL de Jira',
    'settings.email': 'Correo Electrónico',
    'settings.apiToken': 'Token de API',
    'settings.createApiToken': '🔗 Crea tu token de API de Jira aquí',
    'settings.queueId': 'ID de Cola',
    'settings.refreshInterval': 'Intervalo de Actualización (segundos)',
    'settings.oldTicketsDays': 'Días sin actualización para alertar',
    'settings.alertSla': 'Alertar sobre SLA próximo (1 hora antes)',
    'settings.alertOld': 'Alertar sobre tickets antiguos',
    'settings.desktopNotifications': '🔔 Notificaciones de escritorio',
    'settings.test': 'Probar',
    'settings.notifyNew': '🎫 Nuevos tickets asignados',
    'settings.notifyStatus': '🔄 Cambios de estado',
    'settings.notifyReassign': '👤 Reasignaciones a ti',
    'settings.notifyMentions': '📢 Cuando te mencionen',
    'settings.soundNotifications': '🔊 Reproducir sonido en notificaciones',
    'settings.proMode': '⭐ Modo Pro',
    'settings.theme': '🎨 Tema de la Aplicación',
    'settings.themeDefault': '🎨 Predeterminado (Degradado Púrpura)',
    'settings.themeDark': '🌙 Oscuro (Modo Oscuro)',
    'settings.themeLight': '☀️ Claro (Modo Claro)',
    'settings.language': '🌍 Idioma',
    'settings.save': 'Guardar',
    'settings.cancel': 'Cancelar',
    'settings.placeholderUrl': 'https://tu-empresa.atlassian.net',
    'settings.placeholderEmail': 'tu.email@empresa.com',
    'settings.placeholderToken': 'Tu API token de Jira',
    
    // Updated ago (tiempo relativo)
    'time.updatedSecondsAgo': 'Actualizado hace {time}s',
    'time.updatedMinutesAgo': 'Actualizado hace {time} min',
    'time.updatedHoursAgo': 'Actualizado hace {time}h',
    'time.updated': 'Actualizado',
    'time.lastUpdate': 'Última actualización',
    'time.now': 'ahora',
    'time.minutesAgo': 'hace {time} minutos',
    'time.hoursAgo': 'hace {time} horas',
    'time.daysAgo': 'hace {time} días',
    
    // Badge modals
    'badge.slaTitle': '⏰ Tickets con SLA en Alerta (vencen en 30 minutos)',
    'badge.oldTitle': '📅 Tickets Antiguos (sin actualización hace 7+ días)',
    
    // Footer
    'footer.loading': 'Cargando...',
    'footer.refresh': 'Actualizar',
    'footer.lastUpdate': 'Última actualización',
    
    // Error Messages
    'error.connection': 'Error de Conexión',
    'error.noConnection': 'No se pudo conectar a Jira',
    'error.retry': 'Intentar de Nuevo',
    'error.loading': 'Error al cargar ticket',
    
    // Buttons
    'btn.close': 'Cerrar',
    'btn.save': 'Guardar',
    'btn.cancel': 'Cancelar',
    'btn.confirm': 'Confirmar',
    'btn.add': 'Agregar',
    'btn.edit': 'Editar',
    'btn.delete': 'Eliminar',
    'btn.retry': 'Intentar de Nuevo',
    
    // Add User Modal
    'addUser.title': '➕ Agregar Usuario para Monitorear',
    'addUser.description': 'Ingresa el correo electrónico del usuario que deseas monitorear:',
    'addUser.placeholder': 'user@company.com',
    'addUser.cancel': 'Cancelar',
    'addUser.add': 'Agregar',
    
    // Context Menu
    'context.back': '⬅️ Atrás',
    'context.forward': '➡️ Adelante',
    'context.reload': '🔄 Recargar',
    'context.cut': '✂️ Cortar',
    'context.copy': '📋 Copiar',
    'context.paste': '📄 Pegar',
    'context.delete': '🗑️ Eliminar',
    'context.selectAll': '🔍 Seleccionar Todo',
    'context.copyLink': '🔗 Copiar Enlace',
    'context.copyImage': '🖼️ Copiar Imagen',
    'context.openExternal': '🌐 Abrir Enlace en Navegador Externo',
    'context.inspect': '🔧 Inspeccionar Elemento',
    
    // Onboarding Tour
    'tour.step1.title': '📊 Vista General',
    'tour.step1.description': 'Aquí puedes ver tus contadores de tickets (Total, Soporte, Pendientes, etc). Haz clic en las tarjetas para expandir y ver la lista completa de tickets.',
    'tour.step2.title': '🔄 Actualizar',
    'tour.step2.description': 'Haz clic aquí para forzar una sincronización manual con Jira. La aplicación se actualiza automáticamente en intervalos configurables.',
    'tour.step3.title': '🔔 Notificaciones',
    'tour.step3.description': 'Ve alertas recientes e historial de cambios en tus tickets. Serás notificado sobre nuevos tickets, cambios de estado y menciones.',
    'tour.step4.title': '⚙️ Menú y Configuración',
    'tour.step4.description': 'Accede al Modo Pro, Temas personalizados, Ajustes de conexión y mucho más. Usa Cmd+, para abrir rápidamente la configuración.',
    'tour.step5.title': '🎉 ¡Listo para empezar!',
    'tour.step5.description': 'Ya conoces lo básico de Jira Monitor. Usa Cmd+K para búsqueda rápida de tickets y Cmd+P para activar el Modo Pro. ¡Buena suerte!',
    'tour.buttons.next': 'Siguiente',
    'tour.buttons.previous': 'Anterior',
    'tour.buttons.done': 'Finalizar',
    'tour.buttons.skip': 'Omitir',
    'tour.success': '✅ ¡Tutorial completado! Explora libremente.',
    
    // Tooltips / Titles
    'tooltip.totalTickets': 'Total de Tickets',
    'tooltip.activateAdvanced': 'Activar funciones avanzadas',
    'tooltip.refreshManual': 'Actualizar datos manualmente (Cmd+R)',
    'tooltip.openSettings': 'Abrir configuración (Cmd+,)',
    'tooltip.openOkta': 'Abrir Nubank OKTA',
    'tooltip.openJamf': 'Abrir JAMF Cloud',
    'tooltip.openJiraPortal': 'Abrir Jira Portal',
    'tooltip.openGoogleAdmin': 'Abrir Google Admin Console',
    'tooltip.quickSearch': 'Búsqueda rápida de tickets (Cmd+K)',
    'tooltip.viewShortcuts': 'Ver todos los atajos de teclado',
    'tooltip.templates': 'Plantillas de respuesta rápida (Cmd+Shift+T)',
    'tooltip.openTimer': 'Abrir Timer/Pomodoro (Cmd+T)',
    'tooltip.customizeTheme': 'Personalizar tema',
    'tooltip.toggleLayout': 'Alternar Diseño (Cmd+L)',
    'tooltip.adjustOpacity': 'Ajustar transparencia de la ventana',
    'tooltip.exportReport': 'Exportar informe',
    'tooltip.connectionStatus': 'Estado de conexión',
    'tooltip.resetNotifications': 'Restablecer historial de notificaciones limpiadas',
    'tooltip.zoomOut': 'Reducir Zoom (Cmd+-)',
    'tooltip.zoomIn': 'Aumentar Zoom (Cmd++)',
    'tooltip.densityMode': 'Modo de Densidad',
    'tooltip.monitoredUser': 'Usuario Monitoreado',
    'tooltip.backToNormal': 'Volver al modo normal (ESC o Cmd+L)',
    'tooltip.copyKey': 'Copiar clave',
    'tooltip.openInJira': 'Abrir en Jira',
    'tooltip.removeFromHistory': 'Eliminar del historial',
    'tooltip.openInNewWindow': 'Abrir en nueva ventana',
    'tooltip.removeNotification': 'Eliminar notificación',
    'tooltip.clickToEdit': 'Clic para editar',
    
    // Stat Cards
    'card.totalTicketsIT': 'Total de Tickets - IT',
    'card.waitingSupport': 'Esperando Soporte - IT',
    'card.waitingCustomer': 'Esperando Cliente - IT',
    'card.ticketsPending': 'Tickets Pendientes - IT',
    'card.ticketsInProgress': 'Tickets En Progreso - IT',
    'card.ticketsPendingSimcard': 'Tickets Pendientes SimCard',
    'card.ticketsL0JiraBot': 'Tickets L0 Jira Bot',
    'card.allL1Open': 'Todos L1 Abiertos',
    'card.simcardControl': 'Control de SIMCARD',
    
    // Mini Stats
    'ministat.resolutionRate': 'Tasa de Resolución',
    'ministat.avgTime': 'Tiempo Promedio',
    'ministat.today': 'Hoy',
    
    // Timer
    'timer.freeTimer': 'Timer Libre',
    'timer.session': 'Sesión:',
    'timer.next': 'Siguiente:',
    'timer.breakMin': 'Pausa (5min)',
    'timer.autoSaveWorklog': 'Guardar worklog automáticamente',
    'timer.saveWorklogJira': 'Guardar Worklog en Jira',
    'timer.stopBeforeSwitch': 'Detén el timer antes de cambiar de modo',
    'timer.pomodoroComplete': '¡Pomodoro completado! Hora del descanso.',
    'timer.breakComplete': '¡Descanso completado! De vuelta al trabajo.',
    'timer.noTicketSelected': 'Ningún ticket seleccionado para el timer',
    'timer.timeTooShort': 'Tiempo muy corto para registrar (mínimo 1 minuto)',
    'timer.savingWorklog': 'Guardando worklog...',
    'timer.worklogSaved': '¡Worklog guardado! Tiempo:',
    'timer.worklogError': 'Error al guardar worklog:',
    
    // Theme
    'theme.mode': 'Modo de Tema:',
    'theme.defaultName': 'Predeterminado',
    'theme.defaultDesc': 'Degradado Púrpura',
    'theme.darkName': 'Oscuro',
    'theme.lightName': 'Claro',
    'theme.accentColor': 'Color de Acento:',
    'theme.customColor': 'O elige un color personalizado:',
    'theme.specialThemes': 'Temas Especiales:',
    'theme.applyCustom': 'Aplicar Color Personalizado',
    'theme.accentUpdated': 'Color de acento actualizado',
    'theme.applied': 'aplicado',
    
    // Export
    'export.today': 'Hoy',
    'export.thisWeek': 'Esta Semana',
    'export.thisMonth': 'Este Mes',
    'export.statistics': 'Estadísticas',
    'export.ticketList': 'Lista de Tickets',
    'export.trendChart': 'Gráfico de Tendencia',
    'export.downloadBtn': '📥 Descargar Informe',
    'export.downloaded': 'Informe descargado exitosamente',
    'export.pdfDev': 'Función en desarrollo',
    
    // Floating Window
    'floatingWindow.title': '🪟 Ventana Flotante (Semáforos)',
    'floatingWindow.enable': 'Activar ventana flotante',
    'floatingWindow.enabled': 'Ventana flotante activada',
    'floatingWindow.disabled': 'Ventana flotante desactivada',
    'floatingWindow.opacity': 'Opacidad',
    'floatingWindow.size': 'Tamaño',
    'floatingWindow.width': 'Ancho',
    'floatingWindow.height': 'Alto',
    'floatingWindow.show': 'Mostrar',
    'floatingWindow.critical': '🔴 Críticos',
    'floatingWindow.warning': '🟡 Alerta',
    'floatingWindow.normal': '🟢 Normal',
    'floatingWindow.showTicketList': 'Mostrar lista de tickets',
    
    // User Monitor
    'userMonitor.title': '👤 Monitorear Usuario',
    'userMonitor.you': 'Tú',
    'userMonitor.addAnother': 'Agregar Otro Usuario...',
    'userMonitor.monitoring': 'Monitoreando:',
    'userMonitor.dataFrom': 'Datos de:',
    
    // Add User Modal
    'addUser.enterEmail': 'Ingresa el correo del usuario que deseas monitorear:',
    'addUser.placeholder': 'user@company.com',
    'addUser.removed': 'eliminado permanentemente',
    'addUser.monitoringInNewWindow': 'en nueva ventana',
    'addUser.nowMonitoring': 'Ahora monitoreando',
    'addUser.invalidEmail': 'Por favor, ingresa un correo válido',
    'addUser.invalidEmailShort': 'Correo inválido',
    
    // Templates
    'templates.namePlaceholder': 'Ej: Esperando Cliente',
    'templates.textPlaceholder': 'Ingresa el texto de la plantilla...',
    'templates.internalComment': 'Comentario interno (visible solo para el equipo)',
    'templates.applied': '¡aplicada!',
    'templates.copied': '¡copiada!',
    'templates.nameTextRequired': '¡Nombre y texto son obligatorios!',
    'templates.saved': '¡guardada!',
    'templates.deleted': '¡Plantilla eliminada!',
    'templates.confirmDelete': '¿Estás seguro de eliminar la plantilla',
    
    // Canned Responses
    'cannedResponses.title': 'Respuestas Predefinidas',
    'cannedResponses.namePlaceholder': 'Ej: Saludo inicial',
    'cannedResponses.contentPlaceholder': 'Ingresa el contenido de la respuesta...',
    'cannedResponses.inserted': 'Respuesta insertada en el comentario',
    'cannedResponses.fillRequired': 'Completa nombre y contenido',
    'cannedResponses.saved': 'Respuesta guardada exitosamente',
    'cannedResponses.saveFailed': 'Error al guardar respuesta',
    'cannedResponses.deleted': 'Respuesta eliminada',
    'cannedResponses.deleteFailed': 'Error al eliminar',
    'cannedResponses.confirmDelete': '¿Estás seguro de eliminar esta respuesta?',
    
    // Search
    'search.typeToSearch': 'Escribe para buscar tickets...',
    'search.noResults': 'No se encontraron tickets',
    'search.searchByName': 'Buscar por nombre...',
    
    // Notifications
    'notifications.noRecent': 'No hay notificaciones recientes',
    'notifications.historyReset': 'Historial restablecido - todas las notificaciones se mostrarán de nuevo',
    'notifications.cleared': 'Notificaciones limpiadas',
    'notifications.testSuccess': '¡Si ves esto, las notificaciones funcionan! ✅',
    'notifications.testSent': '¡Notificación de prueba enviada! Revisa la esquina superior derecha.',
    'notifications.testError': 'Error al crear notificación:',
    
    // Desktop Notifications
    'desktopNotif.ticketReassigned': 'Ticket Reasignado',
    'desktopNotif.youWereMentioned': 'Te mencionaron en Jira',
    'desktopNotif.mentionedInComment': 'Te mencionaron en un comentario',
    'desktopNotif.jiraUpdate': 'Actualización de Jira',
    'desktopNotif.newTicketAssigned': 'Nuevo ticket asignado a ti',
    'desktopNotif.ticketReassignedToYou': 'Ticket reasignado a ti',
    'desktopNotif.slaExpired': '¡SLA Expirado!',
    'desktopNotif.slaExpiredBody': '¡El SLA de este ticket ha expirado!',
    'desktopNotif.slaWarning': 'Alerta de SLA',
    'desktopNotif.slaWarningBody': '¡Menos de 30 minutos para que expire el SLA!',
    
    // Ticket Preview
    'preview.loading': 'Cargando ticket...',
    'preview.error': 'Error al cargar ticket',
    'preview.noTitle': 'Sin título',
    'preview.unknownStatus': 'Estado desconocido',
    'preview.unknownPriority': 'Prioridad desconocida',
    'preview.unassigned': 'Sin asignar',
    'preview.notDefined': 'No definido',
    'preview.noComments': 'Sin comentarios aún',
    'preview.addComment': 'Agregar comentario... (usa @ para mencionar)',
    'preview.rating': 'Calificación del cliente:',
    'preview.stars': 'estrellas',
    'preview.ratings': 'calificación',
    'preview.ratingsPlural': 'calificaciones',
    'preview.fullHistory': 'Historial completo',
    'preview.created': 'Creado',
    'preview.updated': 'Actualizado',
    
    // Comments
    'comment.empty': 'El comentario no puede estar vacío',
    'comment.sending': 'Enviando comentario...',
    'comment.sent': '¡Comentario enviado!',
    'comment.sendFailed': 'Error al enviar comentario',
    'comment.updating': 'Actualizando comentario...',
    'comment.updated': '¡Comentario actualizado!',
    'comment.updateFailed': 'Error al actualizar comentario',
    'comment.deleting': 'Eliminando comentario...',
    'comment.deleted': '¡Comentario eliminado!',
    'comment.deleteFailed': 'Error al eliminar comentario',
    'comment.confirmDelete': '¿Estás seguro de eliminar este comentario?',
    
    // Attachments
    'attachment.downloadSuccess': '¡Archivo descargado exitosamente!',
    'attachment.downloadError': 'Error al descargar archivo',
    'attachment.uploading': 'Subiendo archivo(s)...',
    'attachment.uploadSuccess': '¡Archivo(s) subido(s) exitosamente!',
    'attachment.uploadError': 'Error al subir archivo(s)',
    'attachment.sent': '¡archivo(s) subido(s)!',
    
    // Fields
    'field.enterValue': 'Ingresa un valor',
    'field.selectOption': 'Selecciona una opción',
    'field.saving': 'Actualizando ticket...',
    'field.saved': '¡Campo actualizado!',
    'field.saveFailed': 'Error al actualizar',
    
    // Status
    'status.transitionsUnavailable': 'Transiciones de estado no disponibles',
    'status.teamsLoadError': 'No se pudieron cargar los equipos de Jira',
    
    // Connection
    'connection.connected': 'Conectado',
    'connection.disconnected': 'Desconectado',
    'connection.loading': 'Cargando...',
    'connection.unknown': 'Estado desconocido',
    'connection.error': 'Error de Conexión',
    'connection.noConnection': 'No se pudo conectar a Jira. Verifica tu conexión y credenciales.',
    'connection.fetchError': 'Error al obtener datos',
    
    // Layout
    'layout.horizontal': 'Modo Horizontal activo',
    'layout.superCompact': 'Modo Super Compacto activo - Siempre visible',
    'layout.normal': 'Modo Normal activo',
    'layout.backToNormal': 'Volvió al modo normal',
    'layout.cardsUpdated': 'Orden actualizado',
    
    // Focus Mode
    'focusMode.activated': 'Activado',
    'focusMode.deactivated': 'Desactivado',
    
    // Density Mode
    'density.default': 'Predeterminado',
    'density.compact': 'Compacto',
    'density.comfortable': 'Cómodo',
    'density.modeActivated': 'activado',
    
    // Priority
    'priority.critical': 'Crítico',
    'priority.high': 'Alto',
    'priority.medium': 'Medio',
    'priority.low': 'Bajo',
    
    // SLA
    'sla.ticketsInAlert': 'ticket(s) con alerta de SLA (menos de 30min o vencidos) - Clic para ver detalles',
    'sla.alertTitle': 'Tickets con Alerta de SLA (vencen en menos de 30 minutos)',
    'sla.inAlert': 'Alerta de SLA',
    
    // Old Tickets
    'oldTickets.title': 'Tickets Antiguos (sin actualización por 7+ días)',
    
    // Empty States
    'empty.nothingHere': '¡Nada por aquí!',
    'empty.noTicketsAssigned': 'No tienes tickets asignados en este momento.',
    'empty.greatWork': '¡Buen trabajo!',
    'empty.noWaitingSupport': 'Ningún ticket esperando soporte.',
    'empty.allResponded': '¡Todo respondido!',
    'empty.noWaitingCustomer': 'Ningún ticket esperando cliente.',
    'empty.congratulations': '¡Felicitaciones!',
    'empty.noPending': 'Ningún ticket pendiente.',
    'empty.cleanArea': '¡Área limpia!',
    'empty.noInProgress': 'Ningún ticket en progreso en este momento.',
    
    // Evaluated
    'evaluated.noTickets': 'No se encontraron tickets evaluados',
    'evaluated.hint': 'Los tickets aparecen aquí cuando recibes calificación del cliente',
    
    // Mentions
    'mentions.searchError': 'Error al buscar usuarios',
    'mentions.noUsers': 'No se encontraron usuarios',
    
    // Config
    'config.saved': 'Configuración guardada exitosamente',
    'config.saveError': 'No se pudo guardar la configuración',
    'config.queueId': 'ID de Cola',
    'config.refreshInterval': 'Intervalo de Actualización (segundos)',
    'config.oldTicketsDays': 'Días sin actualización para alertar',
    'config.alertSla': 'Alertar sobre SLA próximo (1 hora antes)',
    'config.alertOldTickets': 'Alertar sobre tickets antiguos',
    'config.newTickets': '🎫 Nuevos tickets asignados',
    'config.statusChanges': '🔄 Cambios de estado',
    'config.reassignments': '👤 Reasignaciones a ti',
    'config.mentions': '📢 Cuando te mencionen',
    'config.soundNotifications': '🔊 Reproducir sonido en notificaciones',
    
    // Shortcuts Custom
    'shortcutsCustom.title': '⌨️ Personalizar Atajos',
    'shortcutsCustom.quickSearch': 'Búsqueda Rápida',
    'shortcutsCustom.refresh': 'Actualizar',
    'shortcutsCustom.edit': 'Editar',
    'shortcutsCustom.restoreDefault': 'Restaurar Predeterminado',
    'shortcutsCustom.restored': 'Restaurados a predeterminado',
    
    // Language
    'language.title': '🌍 Elegir Idioma / Choose Language / Escolher Idioma',
    'language.applied': 'aplicado',
    
    // Daily Activity
    'daily.noReceived': 'Ningún ticket recibido hoy',
    'daily.noResolved': 'Ningún ticket cerrado hoy',
    'daily.noComments': 'Ningún comentario hoy',
    
    // Metrics
    'metrics.updated': '¡Métricas actualizadas exitosamente!',
    'metrics.error': 'Error al cargar métricas:',
    
    // Ticket Resolved
    'ticket.resolved': '¡resuelto! ¡Felicitaciones!',
    
    // General
    'general.success': '¡Éxito!',
    'general.error': 'Error',
    'general.warning': 'Atención',
    'general.info': 'Info',
    'general.saved': 'Guardado',
    'general.deleted': 'Eliminado',
    'general.inserted': 'Insertado',
    'general.sending': 'Enviando',
    'general.saving': 'Guardando',
    'general.deleting': 'Eliminando',
    'general.removed': 'Eliminado',
    'general.newWindow': 'Nueva Ventana',
    'general.keyCopied': '¡Clave copiada!',
    'general.all': 'Todos',
    'general.expand': 'Expandir',
    'general.minimize': 'Minimizar',
    'general.restore': 'Restaurar',
    'general.opacity': '🪟 Opacidad:'
  }
};

/**
 * Obtém a tradução para uma chave específica
 * @param {string} key - Chave da tradução
 * @param {string} lang - Idioma (pt-BR, en, es)
 * @returns {string} - Texto traduzido
 */
function getTranslation(key, lang = 'pt-BR') {
  if (!i18n[lang]) {
    console.warn(`⚠️ Idioma '${lang}' não encontrado, usando pt-BR`);
    lang = 'pt-BR';
  }
  
  const translation = i18n[lang][key];
  
  if (!translation) {
    console.warn(`⚠️ Tradução não encontrada para '${key}' no idioma '${lang}'`);
    return i18n['pt-BR'][key] || key;
  }
  
  return translation;
}

/**
 * Obtém o idioma atual do localStorage
 * @returns {string} - Código do idioma (pt-BR, en, es)
 */
function getCurrentLanguage() {
  return localStorage.getItem('language') || 'pt-BR';
}

/**
 * Define o idioma atual
 * @param {string} lang - Código do idioma (pt-BR, en, es)
 */
function setCurrentLanguage(lang) {
  if (!i18n[lang]) {
    console.warn(`⚠️ Idioma '${lang}' não suportado`);
    return;
  }
  localStorage.setItem('language', lang);
}

/**
 * Traduz um elemento HTML baseado no atributo data-i18n
 * @param {HTMLElement} element - Elemento a ser traduzido
 * @param {string} lang - Idioma
 */
function translateElement(element, lang) {
  const key = element.getAttribute('data-i18n');
  if (key) {
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
      // Se o elemento tem HTML interno complexo, usar innerHTML
      if (element.querySelector('svg, img')) {
        // Manter os elementos internos e atualizar apenas o texto
        const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) {
          textNode.textContent = translation;
        } else {
          element.innerHTML = translation + element.innerHTML;
        }
      } else {
        element.textContent = translation;
      }
    }
  }
}

/**
 * Aplica as traduções em toda a página
 * @param {string} lang - Idioma (pt-BR, en, es)
 */
function applyTranslations(lang = 'pt-BR') {
  console.log(`🌍 Aplicando traduções para: ${lang}`);
  
  // Selecionar todos os elementos com data-i18n
  const elements = document.querySelectorAll('[data-i18n]');
  
  elements.forEach(element => {
    translateElement(element, lang);
  });
  
  // Atualizar atributo lang do HTML
  document.documentElement.lang = lang;
  
  console.log(`✅ ${elements.length} elementos traduzidos`);
}

// Exportar funções para uso global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    i18n,
    getTranslation,
    getCurrentLanguage,
    setCurrentLanguage,
    translateElement,
    applyTranslations
  };
}

