#!/bin/bash

# Script para gerar ícones do Jira Monitor a partir do SVG
# Requer: rsvg-convert (brew install librsvg) e iconutil (macOS nativo)

set -e

echo "🎨 Gerando ícones do Jira Monitor..."

# Diretório base
ASSETS_DIR="$(cd "$(dirname "$0")" && pwd)"
SVG_FILE="$ASSETS_DIR/icon.svg"

# Verificar se o SVG existe
if [ ! -f "$SVG_FILE" ]; then
    echo "❌ Erro: icon.svg não encontrado em $ASSETS_DIR"
    exit 1
fi

# Verificar se rsvg-convert está instalado
if ! command -v rsvg-convert &> /dev/null; then
    echo "❌ rsvg-convert não encontrado!"
    echo "📦 Instale com: brew install librsvg"
    exit 1
fi

# Gerar PNG principal (512x512)
echo "📐 Gerando icon.png (512x512)..."
rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ASSETS_DIR/icon.png"

# Gerar PNG para diferentes tamanhos (opcional)
echo "📐 Gerando ícones em múltiplos tamanhos..."
for size in 16 32 64 128 256 512 1024; do
    rsvg-convert -w $size -h $size "$SVG_FILE" -o "$ASSETS_DIR/icon-${size}.png"
done

# Criar iconset para macOS (.icns)
echo "🍎 Gerando icon.icns para macOS..."
ICONSET_DIR="$ASSETS_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# Gerar todos os tamanhos necessários para .icns
rsvg-convert -w 16 -h 16 "$SVG_FILE" -o "$ICONSET_DIR/icon_16x16.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONSET_DIR/icon_16x16@2x.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONSET_DIR/icon_32x32.png"
rsvg-convert -w 64 -h 64 "$SVG_FILE" -o "$ICONSET_DIR/icon_32x32@2x.png"
rsvg-convert -w 128 -h 128 "$SVG_FILE" -o "$ICONSET_DIR/icon_128x128.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONSET_DIR/icon_128x128@2x.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONSET_DIR/icon_256x256.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONSET_DIR/icon_256x256@2x.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONSET_DIR/icon_512x512.png"
rsvg-convert -w 1024 -h 1024 "$SVG_FILE" -o "$ICONSET_DIR/icon_512x512@2x.png"

# Converter iconset para .icns
iconutil -c icns "$ICONSET_DIR" -o "$ASSETS_DIR/icon.icns"

# Limpar iconset temporário
rm -rf "$ICONSET_DIR"

echo "✅ Ícones gerados com sucesso!"
echo "📁 Arquivos criados:"
echo "   - icon.png (512x512)"
echo "   - icon.icns (macOS)"
echo "   - icon-*.png (múltiplos tamanhos)"
echo ""
echo "🚀 Agora execute: npm run package"

