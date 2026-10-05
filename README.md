# 🎮 Salas de Torneo - Haxball VPS

Sistema para gestionar salas de Haxball bajo demanda en una VPS.

## 🚀 Instalación Rápida (VPS)

```bash
# 1. Clonar/subir el proyecto a la VPS
git clone <tu-repo> salastorneo
cd salastorneo

# 2. Ejecutar script de instalación
bash setup.sh

# 3. Configurar tokens y código de acceso
nano .env
# Agregar tus tokens de Haxball y ADMIN_CODE

# 4. Iniciar panel web
pm2 start server.js --name panel

# 5. Guardar configuración PM2
pm2 save
```

Accede al panel: `http://tu-ip:3005`

---

## 🔐 Seguridad

El panel requiere un **código de acceso** para iniciar/detener salas.
Configura en `.env`:
```env
ADMIN_CODE=tu_codigo_secreto
```

---

## 📋 Comandos Útiles

### Panel Web
```bash
pm2 start server.js --name panel   # Iniciar
pm2 stop panel                      # Detener
pm2 restart panel                   # Reiniciar
pm2 logs panel                      # Ver logs
```

### Control CLI (alternativo)
```bash
node control.js start 1   # Iniciar sala 1
node control.js status    # Ver estado
node control.js stop 1    # Detener sala 1
```

### PM2 General
```bash
pm2 list      # Ver todos los procesos
pm2 logs      # Ver todos los logs
pm2 monit     # Monitor en tiempo real
pm2 save      # Guardar config actual
```

---

## 🎮 Comandos del Room

### Para todos:
| Comando | Descripción |
|---------|-------------|
| `!help` | Ver ayuda |
| `!bb` | Salir de la sala |
| `!afk` | Modo AFK |
| `!ping` | Ver tu ping actual |
| `t <msg>` | Chat de equipo |

### Para admins:
| Comando | Descripción |
|---------|-------------|
| `!swap` | Cambiar equipos (mantiene uniformes) |
| `!rr` | Reiniciar partido |
| `!clear` | Todos a espectadores |
| `!a <texto>` | Anuncio colorido |
| `!pings` | Ver ping de todos |
| `!ban #id min` | Banear jugador |
| `!kick #id` | Expulsar jugador |
| `!unban #id` | Desbanear |
| `!clearbans` | Limpiar todos los bans |
| `!auth` | Ver auth IDs |
| `!#` | Ver IDs de jugadores |

---

## 📶 Sistema de Ping

El sistema monitorea el ping de todos los jugadores automáticamente:

- **90-199ms**: Aviso amarillo con mensaje chistoso + nombre del ISP
- **200ms+**: Aviso rojo crítico + nombre del ISP
- **60%+ jugadores con ping alto**: Aviso global de latencia del servidor

Los mensajes se repiten cada 10 segundos hasta que el ping mejore.

---

## ⚙️ Configuración

### Archivo .env
```env
# Tokens de Haxball (uno por sala)
HAXBALL_TOKEN_1=thr1.XXXX
HAXBALL_TOKEN_2=thr1.YYYY
HAXBALL_TOKEN_3=thr1.ZZZZ

# Configuración de salas
SALA_NOMBRE_BASE=Torneo Sala
MAX_JUGADORES=30
PUBLICO=false

# Geolocalización
GEO_CODE=EC
GEO_LAT=-1.597754
GEO_LON=-78.653309

# Panel de control
WEB_PORT=3000
ADMIN_CODE=tu_codigo_secreto
```

### Admins permanentes (shared/room.js)
```javascript
const superAdminAuths = [
    'tu_auth_id_aqui',
];
```

---

## 📁 Estructura

```
salastorneo/
├── server.js           # Panel web + API
├── control.js          # CLI alternativo
├── ecosystem.config.js # Configuración PM2
├── setup.sh            # Script instalador VPS
├── public/
│   └── index.html      # Interfaz del panel
├── shared/
│   ├── salaManager.js  # Inicialización de salas
│   └── room.js         # Lógica y comandos
└── salas/
    ├── sala-1/
    ├── sala-2/
    └── sala-3/
```

---

## 🆕 Últimas Mejoras

- ✅ **Panel con tabs** - Navegación moderna entre salas
- ✅ **Auto-refresh inteligente** - No interrumpe la escritura
- ✅ **Sistema de ping con ISP** - Detecta el proveedor de internet
- ✅ **Mensajes chistosos** - Avisos de ping con humor
- ✅ **Swap con uniformes** - Intercambia equipos manteniendo colores
- ✅ **Anuncios coloridos** - Comando !a con estilo magenta/cyan
- ✅ **Código de acceso** - Protección para iniciar/detener salas
