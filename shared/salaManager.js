/**
 * Punto de entrada centralizado para todas las salas
 * Las salas individuales solo llaman a este módulo
 * Incluye manejo robusto de errores para evitar crashes
 */
const HaxballJS = require('haxball.js');
const path = require('path');
const { setupRoom } = require('./room');

// Cargar .env desde la raíz del proyecto
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ==================== MANEJO GLOBAL DE ERRORES ====================
// Evita que errores no capturados cierren el proceso

process.on('uncaughtException', (error) => {
    console.error('⚠️ Error no capturado (la sala sigue funcionando):', error.message);
    console.error(error.stack);
    // NO hacer process.exit() - la sala sigue funcionando
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Promise rechazada no manejada (la sala sigue funcionando):', reason);
    // NO hacer process.exit() - la sala sigue funcionando
});

/**
 * Inicia una sala de Haxball con manejo robusto de errores
 * @param {string} salaId - ID de la sala (1, 2, 3...)
 */
async function iniciarSala(salaId) {
    console.log(`[Sala ${salaId}] Iniciando...`);

    // Obtener configuración
    const config = getConfig(salaId);

    if (!config.token) {
        console.error(`[Sala ${salaId}] ❌ ERROR: No se encontró el token HAXBALL_TOKEN_${salaId} en .env`);
        console.error(`[Sala ${salaId}] 💡 Asegúrate de tener HAXBALL_TOKEN_${salaId}=thr1.XXX en tu archivo .env`);
        process.exit(1);
    }

    try {
        const HBInit = await HaxballJS;

        const room = HBInit({
            roomName: config.roomName,
            maxPlayers: config.maxPlayers,
            public: config.public,
            noPlayer: config.noPlayer,
            token: config.token,
            geo: config.geo
        });

        room.onRoomLink = function (link) {
            const visibilidad = config.public ? 'PÚBLICA' : 'PRIVADA';
            console.log(`[Sala ${salaId}] ✅ Room creado! (${visibilidad})`);
            console.log(`[Sala ${salaId}] 🔗 Link: ${link}`);

            // Guardar link en variable de entorno para acceso desde API
            process.env[`SALA_${salaId}_LINK`] = link;
        };

        // Configurar eventos y comandos (lógica centralizada con manejo de errores)
        setupRoom(room, salaId);

        // Mantener el proceso vivo
        setInterval(() => {
            // Heartbeat - mantiene el proceso activo
        }, 30000);

        return room;

    } catch (error) {
        console.error(`[Sala ${salaId}] ❌ Error al crear el room:`, error.message);

        // Solo salir si es un error crítico de inicialización
        if (error.message.includes('token') || error.message.includes('Token')) {
            console.error(`[Sala ${salaId}] 💡 Verifica que el token sea válido y no haya expirado`);
            process.exit(1);
        }

        // Para otros errores, intentar reconectar después de un delay
        console.log(`[Sala ${salaId}] 🔄 Reintentando en 10 segundos...`);
        setTimeout(() => iniciarSala(salaId), 10000);
    }
}

/**
 * Obtiene la configuración para una sala específica
 */
function getConfig(salaId) {
    const nombreBase = process.env.SALA_NOMBRE_BASE || 'Torneo Sala';
    const nombreSala = process.env[`SALA_${salaId}_NOMBRE`] || `${nombreBase} ${salaId}`;

    // Token específico de la sala o fallback al general
    const token = process.env[`HAXBALL_TOKEN_${salaId}`] || process.env.HAXBALL_TOKEN;

    // Visibilidad específica de la sala (prioridad) o global como fallback
    const salaPublic = process.env[`SALA_${salaId}_PUBLIC`];
    const isPublic = salaPublic !== undefined
        ? salaPublic === 'true'
        : process.env.PUBLICO === 'true';

    return {
        roomName: nombreSala,
        maxPlayers: parseInt(process.env.MAX_JUGADORES) || 30, // Máximo global: 30 jugadores
        public: isPublic, // Ahora lee configuración específica de la sala
        noPlayer: true,
        token: token,
        geo: {
            code: process.env.GEO_CODE || 'EC',
            lat: parseFloat(process.env.GEO_LAT) || -1.597754,
            lon: parseFloat(process.env.GEO_LON) || -78.653309
        },
        salaId: salaId
    };
}

module.exports = { iniciarSala, getConfig };
