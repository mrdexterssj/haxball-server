/**
 * Sala 3 - Solo una línea, toda la lógica está en shared/
 */
const { iniciarSala } = require('../../shared/salaManager');
iniciarSala(process.env.SALA_ID || '3');
