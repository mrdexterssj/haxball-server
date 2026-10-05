/**
 * Servidor Web para Control de Salas
 * Puerto: 3005 (configurable en .env)
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.WEB_PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta al archivo .env
const ENV_PATH = path.join(__dirname, '.env');

// Código de acceso para administración (configurable en .env)
const ADMIN_CODE = process.env.ADMIN_CODE || 'torneo2024';

// Guardar links de salas activas
const salaLinks = new Map();

// Guardar estado público/privado de cada sala
const salaPublicState = new Map();

// Guardar nombres personalizados de cada sala
const salaNames = new Map();

// ==================== MIDDLEWARE ====================

// Validar código de acceso
function validarCodigoAcceso(req, res, next) {
    const codigo = req.body.accessCode || req.headers['x-access-code'];

    if (!codigo) {
        return res.status(401).json({
            success: false,
            error: 'Código de acceso requerido'
        });
    }

    if (codigo !== ADMIN_CODE) {
        return res.status(403).json({
            success: false,
            error: 'Código de acceso incorrecto'
        });
    }

    next();
}

// ==================== HELPERS ====================

function ejecutarPM2(comando) {
    return new Promise((resolve, reject) => {
        exec(comando, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error && !stderr.includes('Process not found')) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve(stdout);
        });
    });
}

function actualizarTokenEnEnv(salaId, token) {
    const tokenKey = `HAXBALL_TOKEN_${salaId}`;
    let envContent = '';

    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    // Buscar si ya existe el token
    const regex = new RegExp(`^${tokenKey}=.*$`, 'm');
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${tokenKey}=${token}`);
    } else {
        envContent += `\n${tokenKey}=${token}`;
    }

    fs.writeFileSync(ENV_PATH, envContent.trim() + '\n');

    // Actualizar variable de entorno en memoria
    process.env[tokenKey] = token;
}

// Esperar a que el room link aparezca en los logs (obtiene el MÁS RECIENTE)
async function esperarLinkSala(salaId, maxIntentos = 20) {
    for (let i = 0; i < maxIntentos; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo

        try {
            const logs = await ejecutarPM2(`pm2 logs sala-${salaId} --nostream --lines 50`);

            // Buscar TODOS los links en los logs y tomar el ÚLTIMO (más reciente)
            // Incluye: letras, números, guiones bajos y guiones
            const allLinks = logs.match(/https:\/\/www\.haxball\.com\/play\?c=[A-Za-z0-9_-]+/g);
            if (allLinks && allLinks.length > 0) {
                return allLinks[allLinks.length - 1]; // Retornar el último link
            }
        } catch (error) {
            // Continuar intentando
        }
    }
    return null;
}

async function obtenerEstadoSalas() {
    try {
        const resultado = await ejecutarPM2('pm2 jlist');
        const procesos = JSON.parse(resultado);

        const salas = {};
        for (let i = 1; i <= 3; i++) {
            const proceso = procesos.find(p => p.name === `sala-${i}`);
            salas[i] = {
                id: i,
                nombre: salaNames.get(i.toString()) || `Sala ${i}`,
                estado: proceso ? proceso.pm2_env.status : 'stopped',
                memoria: proceso ? Math.round(proceso.monit.memory / 1024 / 1024) : 0,
                uptime: proceso ? proceso.pm2_env.pm_uptime : null,
                link: salaLinks.get(i.toString()) || null,
                isPublic: salaPublicState.get(i.toString()) || false
            };
        }
        return salas;
    } catch (error) {
        // PM2 no tiene procesos
        return {
            1: { id: 1, nombre: 'Sala 1', estado: 'stopped', memoria: 0, link: null, isPublic: false },
            2: { id: 2, nombre: 'Sala 2', estado: 'stopped', memoria: 0, link: null, isPublic: false },
            3: { id: 3, nombre: 'Sala 3', estado: 'stopped', memoria: 0, link: null, isPublic: false }
        };
    }
}

// ==================== API ENDPOINTS ====================

// Estado de todas las salas
app.get('/api/status', async (req, res) => {
    try {
        const salas = await obtenerEstadoSalas();
        res.json({ success: true, salas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciar sala (requiere código de acceso)
app.post('/api/salas/:id/start', validarCodigoAcceso, async (req, res) => {
    const salaId = req.params.id;
    const { token, isPublic, roomName } = req.body;

    if (!['1', '2', '3'].includes(salaId)) {
        return res.status(400).json({ success: false, error: 'ID de sala inválido' });
    }

    if (!token) {
        return res.status(400).json({ success: false, error: 'Token requerido' });
    }

    try {
        // Guardar token en .env
        actualizarTokenEnEnv(salaId, token);

        // Guardar configuración de visibilidad (pública/privada)
        const publicValue = isPublic ? 'true' : 'false';
        process.env[`SALA_${salaId}_PUBLIC`] = publicValue;

        // Guardar nombre personalizado de la sala
        if (roomName && roomName.trim()) {
            process.env[`SALA_${salaId}_NOMBRE`] = roomName.trim();
            salaNames.set(salaId, roomName.trim());
        } else {
            // Usar nombre por defecto
            const defaultName = `Torneo Sala ${salaId}`;
            process.env[`SALA_${salaId}_NOMBRE`] = defaultName;
            salaNames.set(salaId, defaultName);
        }

        // Iniciar sala con PM2
        const PM2_CONFIG = path.join(__dirname, 'ecosystem.config.js');
        await ejecutarPM2(`pm2 start ${PM2_CONFIG} --only sala-${salaId} --update-env`);

        // Esperar y obtener el link
        const visibilidadTexto = isPublic ? 'PÚBLICA' : 'PRIVADA';
        console.log(`[Panel] Esperando link de sala ${salaId} (${visibilidadTexto})...`);
        const link = await esperarLinkSala(salaId);

        if (link) {
            salaLinks.set(salaId, link);
            console.log(`[Panel] Link obtenido: ${link}`);
        }

        // Guardar estado de visibilidad
        salaPublicState.set(salaId, isPublic || false);

        res.json({
            success: true,
            message: `Sala ${salaId} iniciada correctamente (${visibilidadTexto})`,
            sala: salaId,
            link: link || 'Link no disponible aún, usa el botón de Link',
            isPublic: isPublic || false
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener link de una sala (siempre busca el más reciente)
app.get('/api/salas/:id/link', async (req, res) => {
    const salaId = req.params.id;

    try {
        // Siempre buscar el link más reciente en los logs
        const logs = await ejecutarPM2(`pm2 logs sala-${salaId} --nostream --lines 50`);
        // Incluye: letras, números, guiones bajos y guiones
        const allLinks = logs.match(/https:\/\/www\.haxball\.com\/play\?c=[A-Za-z0-9_-]+/g);

        if (allLinks && allLinks.length > 0) {
            const latestLink = allLinks[allLinks.length - 1]; // Tomar el último
            salaLinks.set(salaId, latestLink); // Actualizar el link guardado
            return res.json({ success: true, link: latestLink });
        }

        // Si no hay link en logs, usar el guardado si existe
        if (salaLinks.has(salaId)) {
            return res.json({ success: true, link: salaLinks.get(salaId) });
        }

        res.json({ success: false, error: 'Link no encontrado. La sala puede estar iniciando.' });
    } catch (error) {
        // Fallback al link guardado
        if (salaLinks.has(salaId)) {
            return res.json({ success: true, link: salaLinks.get(salaId) });
        }
        res.json({ success: false, error: 'Sala no activa' });
    }
});

// Detener sala (requiere código de acceso)
app.post('/api/salas/:id/stop', validarCodigoAcceso, async (req, res) => {
    const salaId = req.params.id;

    if (!['1', '2', '3'].includes(salaId)) {
        return res.status(400).json({ success: false, error: 'ID de sala inválido' });
    }

    try {
        await ejecutarPM2(`pm2 stop sala-${salaId}`);
        await ejecutarPM2(`pm2 delete sala-${salaId}`);

        // Limpiar el link guardado
        salaLinks.delete(salaId);

        res.json({
            success: true,
            message: `Sala ${salaId} detenida`,
            sala: salaId
        });
    } catch (error) {
        salaLinks.delete(salaId);
        res.json({
            success: true,
            message: `Sala ${salaId} ya estaba detenida`,
            sala: salaId
        });
    }
});

// Obtener logs de una sala
app.get('/api/salas/:id/logs', async (req, res) => {
    const salaId = req.params.id;

    try {
        const resultado = await ejecutarPM2(`pm2 logs sala-${salaId} --nostream --lines 50`);
        res.json({ success: true, logs: resultado });
    } catch (error) {
        res.json({ success: true, logs: 'No hay logs disponibles' });
    }
});

// ==================== SERVIDOR ====================

app.listen(PORT, () => {
    console.log(`\n🌐 Panel de Control iniciado en: http://localhost:${PORT}`);
    console.log(`   API disponible en: http://localhost:${PORT}/api/status\n`);
});
