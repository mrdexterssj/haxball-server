#!/bin/bash
# ============================================
# Script de instalación para VPS
# Ejecutar con: bash setup.sh
# ============================================

echo "🚀 Instalando Sistema de Salas de Torneo..."
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    echo "   Instala con: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js: $(node -v)"

# Instalar dependencias
echo ""
echo "📦 Instalando dependencias..."
npm install

# Instalar PM2 globalmente si no existe
if ! command -v pm2 &> /dev/null; then
    echo ""
    echo "📦 Instalando PM2..."
    sudo npm install -g pm2
fi

echo "✅ PM2: $(pm2 -v)"

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creando archivo .env..."
    cp .env.example .env
    echo "⚠️  IMPORTANTE: Edita .env y agrega tus tokens de Haxball"
    echo "   nano .env"
fi

# Configurar PM2 para inicio automático
echo ""
echo "🔧 Configurando PM2 para inicio automático..."
pm2 startup
echo "   Copia y ejecuta el comando que aparece arriba si es necesario"

echo ""
echo "============================================"
echo "✅ Instalación completada!"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Edita .env con tus tokens: nano .env"
echo "   2. Inicia el panel web: pm2 start server.js --name panel"
echo "   3. Abre salas desde: http://tu-ip:3005"
echo ""
echo "🎮 Comandos útiles:"
echo "   pm2 list          - Ver procesos"
echo "   pm2 logs          - Ver logs"
echo "   pm2 save          - Guardar config"
echo "============================================"
