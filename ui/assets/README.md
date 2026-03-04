# 🎨 Assets do Jira Monitor

Este diretório contém todos os recursos visuais do aplicativo Jira Monitor.

## 📁 Estrutura

```
assets/
├── icon.svg                 # Ícone vetorial original
├── icon.png                 # Ícone principal (512x512px)
├── icon.icns                # Ícone para macOS
├── generate-icons.sh        # Script de geração
├── tray-icons/             # Ícones da Menu Bar
│   ├── red.svg             # SLA vencido
│   ├── red.png
│   ├── yellow.svg          # SLA próximo
│   ├── yellow.png
│   ├── green.svg           # SLA OK
│   ├── green.png
│   ├── gray.svg            # Sem dados
│   └── gray.png
├── screenshots/            # Screenshots para documentação
│   └── (a serem adicionados - veja GUIA-SCREENSHOTS.md)
└── README.md               # Este arquivo
```

## 🎨 Design dos Ícones

### Ícone Principal (icon.png)

O ícone representa:
- 📋 **Ticket card** - Documento/ticket do Jira
- 🔔 **Sino de notificação** - Alertas em tempo real
- 📊 **Dashboard** - Estatísticas e monitoramento

Cores:
- Gradiente roxo/azul (#667eea → #764ba2)
- Acento rosa/vermelho (#f093fb → #f5576c)

### Ícones da Menu Bar (tray-icons/)

Ícones minimalistas para indicar status de SLA na barra do macOS:

| Ícone | Cor | Status | Uso |
|-------|-----|--------|-----|
| ![red](tray-icons/red.png) | 🔴 Vermelho | SLA Vencido/Crítico | Tickets urgentes |
| ![yellow](tray-icons/yellow.png) | 🟡 Amarelo | SLA Próximo (1-3h) | Atenção necessária |
| ![green](tray-icons/green.png) | 🟢 Verde | SLA OK (>3h) | Tudo tranquilo |
| ![gray](tray-icons/gray.png) | ⚪ Cinza | Sem dados | Nenhum ticket |

**Características:**
- Tamanho: 16x16px (Retina: 32x32px)
- Formato: PNG com transparência
- Design: Círculos simples e claros
- Visibilidade: Otimizado para Menu Bar clara e escura do macOS

## 🛠️ Como Gerar os Ícones

### Método 1: Usando o Script (Recomendado)

```bash
# 1. Instalar librsvg (se ainda não tiver)
brew install librsvg

# 2. Tornar o script executável
chmod +x assets/generate-icons.sh

# 3. Executar o script
./assets/generate-icons.sh
```

### Método 2: Conversão Online

Se não quiser instalar nada, use ferramentas online:

1. **SVG → PNG:**
   - Abra https://svgtopng.com/
   - Upload `icon.svg`
   - Baixe como `icon.png` (512x512px)

2. **PNG → ICNS:**
   - Abra https://cloudconvert.com/png-to-icns
   - Upload `icon.png`
   - Baixe como `icon.icns`

### Método 3: Usando macOS Preview

1. Abra `icon.svg` no Preview
2. File → Export → PNG (512x512px)
3. Para .icns, use o script ou ferramenta online

## 🚀 Após Gerar os Ícones

```bash
# 1. Verificar se os arquivos foram criados
ls -lh assets/icon.*

# 2. Rebuild do app
npm run package

# 3. O novo ícone aparecerá no build
```

## 🎨 Personalização

Para customizar o ícone:

1. Edite `icon.svg` no seu editor favorito:
   - Figma (import SVG)
   - Adobe Illustrator
   - Inkscape (grátis)
   - Ou qualquer editor de texto

2. Regere os ícones com o script

3. Rebuild do app

## 📐 Especificações Técnicas

### PNG
- Tamanho: 512x512px ou 1024x1024px
- Formato: PNG com transparência
- Resolução: 72 DPI

### ICNS (macOS)
- Tamanhos inclusos: 16, 32, 64, 128, 256, 512, 1024px
- Retina: @2x para cada tamanho
- Gerado com `iconutil`

## 🔧 Troubleshooting

### "rsvg-convert not found"
```bash
brew install librsvg
```

### "iconutil: command not found"
O `iconutil` é nativo do macOS. Se estiver no Linux/Windows, use:
```bash
# Linux
sudo apt-get install icnsutils

# Windows (use WSL ou ferramenta online)
```

### Ícone não aparece após build
1. Limpe o cache do Electron Builder:
```bash
rm -rf dist/
npm run package
```

2. Limpe o cache do macOS:
```bash
# Força o macOS a recarregar o ícone
touch "dist/Jira Monitor.app"
killall Finder
```

## 📸 Screenshots

Para adicionar screenshots para documentação, veja o guia completo:
- **[GUIA-SCREENSHOTS.md](../GUIA-SCREENSHOTS.md)** - Lista completa de screenshots necessários

**Estrutura recomendada:**
```
assets/screenshots/
├── 01-instalacao/
├── 02-configuracao/
├── 03-dashboard/
├── 04-tickets/
├── 05-sla-colors/
├── 06-notificacoes/
├── 07-modo-pro/
├── 08-menu-bar/
└── 09-diversos/
```

## 🎯 Resultado Final

### Ícone Principal
Após o build, o ícone aparecerá:
- ✅ Na barra de aplicativos do macOS
- ✅ No Dock quando o app estiver aberto
- ✅ No Finder
- ✅ No menu Applications
- ✅ Em notificações desktop

### Ícones da Menu Bar
Durante a execução:
- ✅ Na Menu Bar do macOS (barra superior)
- ✅ Mudam de cor conforme status dos tickets
- ✅ Podem aparecer múltiplos simultaneamente (ex: 🔴🟡🟢)

## 📝 Como Usar nas Documentações

### Markdown

```markdown
# Ícone principal
![Jira Monitor](assets/icon.png)# Ícones de status
![Status Verde](assets/tray-icons/green.png) SLA OK
![Status Amarelo](assets/tray-icons/yellow.png) Atenção
![Status Vermelho](assets/tray-icons/red.png) Crítico

# Screenshots (quando disponíveis)
![Dashboard](assets/screenshots/03-dashboard/dashboard-completo.png)
```

### HTML

```html
<!-- Ícone principal -->
<img src="assets/icon.png" alt="Jira Monitor" width="128" height="128">

<!-- Ícones inline -->
<img src="assets/tray-icons/green.png" alt="OK" width="16"> Tudo OK
<img src="assets/tray-icons/red.png" alt="Crítico" width="16"> Urgente!
```

## 🔄 Atualizando os Ícones

### 1. Editar Ícone Principal

```bash
# Editar o SVG (use Figma, Illustrator, Inkscape, etc)
code assets/icon.svg# Regenerar todos os formatos
./assets/generate-icons.sh

# Rebuild do app
npm run build
```

### 2. Editar Ícones da Menu Bar

```bash
# Editar SVGs individuais
code assets/tray-icons/red.svg

# Regenerar PNGs (se necessário)
cd assets/tray-icons
for file in *.svg; do
  rsvg-convert -w 32 -h 32 "$file" -o "${file%.svg}.png"
done

# Recarregar app
npm start
```

## 🎨 Diretrizes de Design

### Ícone Principal

**✅ Faça:**
- Use gradientes suaves
- Mantenha bordas arredondadas
- Priorize legibilidade em pequenos tamanhos
- Use transparência quando necessário

**❌ Evite:**
- Muitos detalhes pequenos
- Cores muito claras (baixo contraste)
- Fontes (use símbolos)
- Gradientes com muitas cores

### Ícones da Menu Bar

**✅ Faça:**
- Mantenha design minimalista
- Use cores sólidas e claras
- Teste em fundo claro E escuro
- 16x16px (32x32 para Retina)

**❌ Evite:**
- Detalhes complexos
- Gradientes (podem não renderizar bem)
- Formas muito finas (< 2px)
- Muitas cores na mesma imagem

## 📐 Especificações Técnicas Completas

### Ícone Principal (PNG)
```yaml
Resolução: 512x512px (ou 1024x1024px)
Formato: PNG-24 com canal alpha
DPI: 72 (web) ou 144 (Retina)
Espaço de cores: sRGB
Compressão: Máxima qualidade
```

### Ícone macOS (ICNS)
```yaml
Tamanhos inclusos:
  - 16x16 (@1x e @2x)
  - 32x32 (@1x e @2x)
  - 128x128 (@1x e @2x)
  - 256x256 (@1x e @2x)
  - 512x512 (@1x e @2x)
  - 1024x1024 (@1x)

Ferramenta: iconutil (nativo macOS)
```

### Ícones Menu Bar (PNG)
```yaml
Tamanho padrão: 16x16px (@1x)
Tamanho Retina: 32x32px (@2x)
Formato: PNG-24 com transparência
Espaço de cores: sRGB
Otimização: Para Menu Bar (sem sombras)
```

## 🌍 Internacionalização

Os ícones são universais e não requerem tradução.

**No entanto:**
- Mantenha símbolos culturalmente neutros
- Evite texto nos ícones
- Cores têm significados diferentes em culturas diferentes:
  - 🔴 Vermelho: Perigo (ocidental) / Sorte (China)
  - 🟢 Verde: OK (universal)
  - 🟡 Amarelo: Atenção (universal)

## 📄 Licença

Todos os ícones são propriedade do Nubank e são para uso interno apenas.

---

**Última atualização**: 09/01/2026  
**Versão**: 1.1

---

**Design com ❤️ para o time IT! 🎨**