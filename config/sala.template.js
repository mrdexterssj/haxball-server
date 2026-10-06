require('dotenv').config();

/**
 * Template de configuración para las salas de Haxball
 * Esta configuración se combina con las variables de entorno específicas de cada sala
 */
function getSalaConfig(salaId) {
    const nombreBase = process.env.SALA_NOMBRE_BASE || 'Torneo Sala';
    const nombreSala = process.env.SALA_NOMBRE || `${nombreBase} ${salaId}`;

    // Buscar token específico de la sala, o usar el general como fallback
    const tokenKey = `HAXBALL_TOKEN_${salaId}`;
    const token = process.env[tokenKey] || process.env.HAXBALL_TOKEN;

    return {
        // Configuración del room
        roomName: nombreSala,
        maxPlayers: parseInt(process.env.MAX_JUGADORES) || 30, // Máximo global: 30 jugadores
        public: process.env.PUBLICO === 'true',
        token: token,

        // Configuración de equipos
        noPlayer: true, // El host no es jugador

        // Geografía - Ecuador
        geo: {
            code: 'EC',
            lat: -1.597754,
            lon: -78.653309
        },

        // Identificador de sala
        salaId: salaId,

        // Info del token usado
        tokenKey: token ? tokenKey : 'HAXBALL_TOKEN (fallback)'
    };
}

module.exports = { getSalaConfig };
