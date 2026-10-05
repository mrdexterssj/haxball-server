#!/bin/bash
# Script de despliegue para VPS - salastorneo.duckdns.org

set -e

echo "🚀 Iniciando despliegue de Salas de Torneo..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Actualizar sistema
echo -e "${YELLOW}1. Actualizando sistema...${NC}"
sudo apt update -y

# 2. Instalar dependencias
echo -e "${YELLOW}2. Instalando Node.js, NPM, PM2 y Nginx...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
fi

# 3. Instalar Certbot para SSL
echo -e "${YELLOW}3. Instalando Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
fi

# 4. Copiar configuración nginx
echo -e "${YELLOW}4. Configurando Nginx...${NC}"
sudo cp nginx-salastorneo.conf /etc/nginx/sites-available/salastorneo
sudo ln -sf /etc/nginx/sites-available/salastorneo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# 5. Instalar dependencias del proyecto
echo -e "${YELLOW}5. Instalando dependencias...${NC}"
npm install

# 6. Verificar archivo .env
echo -e "${YELLOW}6. Verificando configuración .env...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Archivo .env creado desde .env.example${NC}"
        echo -e "${YELLOW}   IMPORTANTE: Edita .env y agrega tus tokens de Haxball y ADMIN_CODE${NC}"
    fi
fi

# 7. Configurar SSL con Certbot
echo -e "${YELLOW}7. Configurando SSL (HTTPS)...${NC}"
echo -e "${YELLOW}   Esto abrirá un prompt para tu email y aceptar términos${NC}"
sudo certbot --nginx -d salastorneo.duckdns.org --non-interactive --agree-tos --email tu-email@example.com || true

# 8. Iniciar panel con PM2
echo -e "${YELLOW}8. Iniciando panel web con PM2...${NC}"
pm2 stop panel 2>/dev/null || true
pm2 start server.js --name panel
pm2 save

# 9. Configurar PM2 para iniciar en boot
echo -e "${YELLOW}9. Configurando PM2 para iniciar en boot...${NC}"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo -e "${GREEN}✅ Despliegue completado!${NC}"
echo ""
echo -e "${GREEN}🌐 Panel disponible en: https://salastorneo.duckdns.org${NC}"
echo ""
echo -e "${YELLOW}📋 Comandos útiles:${NC}"
echo "   pm2 status          - Ver estado"
echo "   pm2 logs panel      - Ver logs del panel"
echo "   pm2 restart panel   - Reiniciar panel"
echo "   sudo nginx -t       - Testear config nginx"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE: Si es primera vez, edita .env y agrega:${NC}"
echo "   - ADMIN_CODE (código de acceso al panel)"
echo "   - HAXBALL_TOKEN_1, HAXBALL_TOKEN_2, HAXBALL_TOKEN_3"
echo "   Luego reinicia: pm2 restart panel"
