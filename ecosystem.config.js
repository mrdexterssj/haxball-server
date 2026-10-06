/**
 * Configuración PM2 para múltiples salas de Haxball
 * Cada sala es un proceso independiente
 */
module.exports = {
  apps: [
    {
      name: 'sala-1',
      script: './salas/sala-1/index.js',
      env: {
        SALA_ID: '1',
        SALA_NOMBRE: 'Torneo Sala 1'
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000
    },
    {
      name: 'sala-2',
      script: './salas/sala-2/index.js',
      env: {
        SALA_ID: '2',
        SALA_NOMBRE: 'Torneo Sala 2'
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000
    },
    {
      name: 'sala-3',
      script: './salas/sala-3/index.js',
      env: {
        SALA_ID: '3',
        SALA_NOMBRE: 'Torneo Sala 3'
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000
    }
  ]
};
