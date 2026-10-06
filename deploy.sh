#!/bin/bash
# Script de despliegue para VPS - salastorneo.duckdns.org

set -e

echo "Starting server..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Actualizar sistema
echo -e "${YELLOW}1. Updating dependencies...${NC}"
sudo apt update -y

# 2. Instalar dependencias
echo -e "${YELLOW}2. Installing Node.js, NPM, PM2 y Nginx...${NC}"

#if ! command -v node &> /dev/null; then
#    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
#    sudo apt install -y nodejs
#fi

# Remove curl | bash as that is bad practice

if ! command -v node &> /dev/null; then
	#For arch based
	sudo pacman -S nodejs

if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

if ! command -v nginx &> /dev/null; then
    #sudo apt install -y nginx
    #For arch based
    sudo pacman -S nginx
fi

# 3. Instalar Certbot para SSL
echo -e "${YELLOW}3. Instalando Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
   # sudo apt install -y certbot python3-certbot-nginx
   #For arch based
   sudo pacman -S certbot certbot-nginx
fi

# 4. Copiar configuración nginx
echo -e "${YELLOW}4. Setting up Nginx...${NC}"
sudo cp nginx-salastorneo.conf /etc/nginx/sites-available/salastorneo
sudo ln -sf /etc/nginx/sites-available/salastorneo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# 5. Instalar dependencias del proyecto
echo -e "${YELLOW}5. Installing npm dependencies...${NC}"
npm install

# 6. Verificar archivo .env
echo -e "${YELLOW}6. Checking .env...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}[WARN]  .env file created from .env.example${NC}"
        echo -e "${YELLOW}   [IMPORTANT]: Edit .env and add your Haxball tokens and ADMIN_CODE${NC}"
    fi
fi

# 7. Configurar SSL con Certbot
echo -e "${YELLOW}7. Setting up SSL (HTTPS)...${NC}"
echo -e "${YELLOW}   This will open a prompt for your email and a ToS prompt${NC}"
#WARNING: Change example email
sudo certbot --nginx -d salastorneo.duckdns.org --non-interactive --agree-tos --email tu-email@example.com || true

# 8. Iniciar panel con PM2
echo -e "${YELLOW}8. Starting web panel with PM2...${NC}"
pm2 stop panel 2>/dev/null || true
pm2 start server.js --name panel
pm2 save

# 9. Configurar PM2 para iniciar en boot
echo -e "${YELLOW}9. Setting up PM2 autostart...${NC}"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo -e "${GREEN}[INFO] Deployment finished${NC}"
echo ""
echo -e "${GREEN}Panel url: https://salastorneo.duckdns.org${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "   pm2 status          - Fetch status"
echo "   pm2 logs panel      - Fetch panel logs"
echo "   pm2 restart panel   - Restart panel"
echo "   sudo nginx -t       - Test nginx config"
echo ""
echo -e "${YELLOW}[IMPORTANT] If this is the first deployment, edit .env and add:${NC}"
echo "   - ADMIN_CODE (panel access code)"
echo "   - HAXBALL_TOKEN_1, HAXBALL_TOKEN_2, HAXBALL_TOKEN_3"
echo "   Then restart: pm2 restart panel"
