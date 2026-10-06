/**
 * Script de Control CLI para Salas de Torneo
 * 
 * Uso:
 *   node control.js start <sala>    - Inicia una sala (1, 2, 3 o all)
 *   node control.js stop <sala>     - Detiene una sala
 *   node control.js restart <sala>  - Reinicia una sala
 *   node control.js status          - Ver estado de todas las salas
 *   node control.js logs <sala>     - Ver logs de una sala
 *   node control.js stop-all        - Detener todas las salas
 */

const { exec, spawn } = require('child_process');
const path = require('path');

const SALAS_VALIDAS = ['1', '2', '3', 'all'];
const PM2_CONFIG = path.join(__dirname, 'ecosystem.config.js');

const COLORES = {
    reset: '\x1b[0m',
    verde: '\x1b[32m',
    rojo: '\x1b[31m',
    amarillo: '\x1b[33m',
    azul: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(mensaje, color = 'reset') {
    console.log(`${COLORES[color]}${mensaje}${COLORES.reset}`);
}

function ejecutarPM2(comando) {
    return new Promise((resolve, reject) => {
        exec(comando, (error, stdout, stderr) => {
            if (error && !stderr.includes('Process not found')) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

async function iniciarSala(salaId) {
    if (salaId === 'all') {
        log('\n🚀 Iniciando todas las salas...', 'cyan');
        for (const id of ['1', '2', '3']) {
            await iniciarSala(id);
        }
        return;
    }

    const nombreProceso = `sala-${salaId}`;
    log(`\n🚀 Iniciando ${nombreProceso}...`, 'cyan');

    try {
        await ejecutarPM2(`pm2 start ${PM2_CONFIG} --only ${nombreProceso}`);
        log(`✅ ${nombreProceso} iniciada correctamente`, 'verde');
        log(`   Ver logs: node control.js logs ${salaId}`, 'amarillo');
    } catch (error) {
        log(`❌ Error al iniciar ${nombreProceso}: ${error.message}`, 'rojo');
    }
}

async function detenerSala(salaId) {
    if (salaId === 'all') {
        log('\n🛑 Deteniendo todas las salas...', 'cyan');
        for (const id of ['1', '2', '3']) {
            await detenerSala(id);
        }
        return;
    }

    const nombreProceso = `sala-${salaId}`;
    log(`\n🛑 Deteniendo ${nombreProceso}...`, 'cyan');

    try {
        await ejecutarPM2(`pm2 stop ${nombreProceso}`);
        await ejecutarPM2(`pm2 delete ${nombreProceso}`);
        log(`✅ ${nombreProceso} detenida`, 'verde');
    } catch (error) {
        log(`⚠️  ${nombreProceso} no estaba corriendo`, 'amarillo');
    }
}

async function reiniciarSala(salaId) {
    if (salaId === 'all') {
        log('\n🔄 Reiniciando todas las salas...', 'cyan');
        for (const id of ['1', '2', '3']) {
            await reiniciarSala(id);
        }
        return;
    }

    const nombreProceso = `sala-${salaId}`;
    log(`\n🔄 Reiniciando ${nombreProceso}...`, 'cyan');

    try {
        await ejecutarPM2(`pm2 restart ${nombreProceso}`);
        log(`✅ ${nombreProceso} reiniciada`, 'verde');
    } catch (error) {
        // Si no existe, intentar iniciar
        await iniciarSala(salaId);
    }
}

async function verEstado() {
    log('\n📊 Estado de las salas:', 'cyan');
    log('─'.repeat(60), 'azul');

    try {
        const resultado = await ejecutarPM2('pm2 jlist');
        const procesos = JSON.parse(resultado);

        const salas = procesos.filter(p => p.name.startsWith('sala-'));

        if (salas.length === 0) {
            log('   No hay salas activas', 'amarillo');
        } else {
            salas.forEach(sala => {
                const estado = sala.pm2_env.status;
                const color = estado === 'online' ? 'verde' : 'rojo';
                const icono = estado === 'online' ? '🟢' : '🔴';
                const memoria = Math.round(sala.monit.memory / 1024 / 1024);
                log(`   ${icono} ${sala.name}: ${estado} (${memoria}MB RAM)`, color);
            });
        }

        // Mostrar salas no activas
        const salasActivas = salas.map(s => s.name);
        ['sala-1', 'sala-2', 'sala-3'].forEach(nombre => {
            if (!salasActivas.includes(nombre)) {
                log(`   ⚪ ${nombre}: detenida`, 'amarillo');
            }
        });

    } catch (error) {
        log('   No hay salas activas (PM2 sin procesos)', 'amarillo');
        log('   ⚪ sala-1: detenida', 'amarillo');
        log('   ⚪ sala-2: detenida', 'amarillo');
        log('   ⚪ sala-3: detenida', 'amarillo');
    }

    log('─'.repeat(60), 'azul');
}

function verLogs(salaId) {
    const nombreProceso = `sala-${salaId}`;
    log(`\n📜 Logs de ${nombreProceso} (Ctrl+C para salir):`, 'cyan');
    log('─'.repeat(60), 'azul');

    const logs = spawn('pm2', ['logs', nombreProceso, '--lines', '50'], {
        stdio: 'inherit',
        shell: true
    });

    logs.on('error', (error) => {
        log(`❌ Error al ver logs: ${error.message}`, 'rojo');
    });
}

function mostrarAyuda() {
    log('\n🎮 Control de Salas de Torneo - Haxball', 'cyan');
    log('─'.repeat(50), 'azul');
    log('\nUso: node control.js <comando> [sala]\n', 'reset');
    log('Comandos:', 'amarillo');
    log('  start <sala>    Inicia una sala (1, 2, 3 o all)', 'reset');
    log('  stop <sala>     Detiene una sala', 'reset');
    log('  restart <sala>  Reinicia una sala', 'reset');
    log('  status          Ver estado de todas las salas', 'reset');
    log('  logs <sala>     Ver logs en tiempo real', 'reset');
    log('  stop-all        Detener todas las salas', 'reset');
    log('\nEjemplos:', 'amarillo');
    log('  node control.js start 1', 'reset');
    log('  node control.js status', 'reset');
    log('  node control.js stop all', 'reset');
    log('─'.repeat(50), 'azul');
}

// ==================== MAIN ====================

async function main() {
    const args = process.argv.slice(2);
    const comando = args[0]?.toLowerCase();
    const salaId = args[1];

    // Validar comando
    if (!comando || comando === 'help' || comando === '-h') {
        mostrarAyuda();
        return;
    }

    // Comandos que requieren ID de sala
    const comandosConSala = ['start', 'stop', 'restart', 'logs'];
    if (comandosConSala.includes(comando)) {
        if (!salaId) {
            log('❌ Debes especificar el número de sala (1, 2, 3 o all)', 'rojo');
            return;
        }
        if (!SALAS_VALIDAS.includes(salaId)) {
            log(`❌ Sala inválida. Usa: ${SALAS_VALIDAS.join(', ')}`, 'rojo');
            return;
        }
    }

    // Ejecutar comando
    switch (comando) {
        case 'start':
            await iniciarSala(salaId);
            break;
        case 'stop':
            await detenerSala(salaId);
            break;
        case 'stop-all':
            await detenerSala('all');
            break;
        case 'restart':
            await reiniciarSala(salaId);
            break;
        case 'status':
            await verEstado();
            break;
        case 'logs':
            verLogs(salaId);
            break;
        default:
            log(`❌ Comando desconocido: ${comando}`, 'rojo');
            mostrarAyuda();
    }
}

main().catch(error => {
    log(`\n❌ Error: ${error.message}`, 'rojo');
    process.exit(1);
});
