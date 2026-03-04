# Jira Monitor

Monitor de tickets Jira com interface gráfica moderna e notificações de SLA.

## Funcionalidades

- **Monitoramento de Tickets**: Visualização em tempo real dos tickets atribuídos
- **Indicadores de SLA**: Cores indicando status do SLA (vermelho, amarelo, verde)
- **Notificações Nativas**: Alertas do sistema quando SLA está próximo de estourar
- **Alertas Proativos**: Notifica tickets aguardando resposta por X horas
- **Tray Icon**: Ícone na barra de menu com contagem de tickets e acesso rápido
- **Modo Focus**: Interface limpa focada apenas nos tickets
- **Modo Compacto**: Janela minimalista para monitoramento discreto
- **Confetti**: Celebração visual ao resolver tickets
- **Persistência**: Lembra tamanho e posição da janela

## Requisitos

- Python 3.10+
- macOS (para tray icon nativo)

## Instalação

```bash
# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install pywebview requests pyobjc-framework-Cocoa
```

## Configuração

Na primeira execução, configure:
- URL do Jira (ex: https://empresa.atlassian.net)
- Email da conta Jira
- API Token (gerar em: https://id.atlassian.com/manage-profile/security/api-tokens)
- JQL da fila de tickets

## Uso

```bash
python3 main.py
```

### Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Cmd+Shift+F` | Modo Focus |
| `Cmd+Shift+C` | Modo Compacto |
| `Cmd+L` | Alternar layout |
| `Cmd+R` | Atualizar tickets |
| `ESC` | Sair do modo atual |

## Estrutura

```
├── main.py           # Backend Python (PyWebView + API Jira)
├── ui/
│   ├── index.html    # Interface HTML
│   ├── styles.css    # Estilos
│   ├── renderer.js   # Lógica do frontend
│   └── ...
├── assets/           # Ícones e recursos
└── config.json       # Configurações (não versionado)
```

## Build (macOS App)

```bash
pip install pyinstaller
pyinstaller "Jira Monitor.spec"
```

O app será gerado em `dist/Jira Monitor.app`

## Licença

Uso interno.
