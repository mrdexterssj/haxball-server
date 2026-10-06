/**
 * Lógica compartida del room de Haxball
 * Contiene eventos y comandos comunes para todas las salas
 * Incluye manejo de errores para evitar crashes
 */

/**
 * Helper para ejecutar código de forma segura sin crashear la sala
 */
function safeExecute(fn, salaId, eventName) {
    return function (...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            console.error(`[Sala ${salaId}] ⚠️ Error en ${eventName}:`, error.message);
            console.error(error.stack);
            // NO propagar el error - la sala sigue funcionando
            return false;
        }
    };
}

/**
 * Configura todos los eventos y comandos del room
 * @param {Object} room - Instancia del room de haxball.js
 * @param {string} salaId - Identificador de la sala
 */
function setupRoom(room, salaId) {
    console.log(`[Sala ${salaId}] Room configurado correctamente`);

    // ==================== LISTA DE ADMINS POR AUTH ====================
    // Agrega aquí los auth IDs de los jugadores que tendrán admin automático
    // Puedes obtener el auth de un jugador con el comando !auth (solo admins)
    const superAdminAuths = [
        "xEhAFtj4x1EJNxBrLlu5hQ_k-8n4sPN8XKtHRQI3fMY",
        "3VIqZQlgnDpkAkJxkk2Pzig0Rxt8XqLnIb4VHOfEI5k",
        "gBtgdH9M_iEI_yZyLSp4MhcO8jk3qR26gpLWnx7r_5s",
        "RrIL2lTlm9P8Tjl4ZVxHRVLhZSJFSPgD6SUcOBbvGsc",
        "e2cEwljneDNtILy6VVOsL_Ca3_HfajLYs0E1pos_Dek",
        "V0uqXi1GPG0DHL3tLf5hGDkNmQNkqDBMdb5dBVXFB2g",
        "GryKGbOB54NM8knw-gjb3-mTsq-2flEXOc6qZCT6-eE",
        "0DVUfg0heW29Q6PDulvRj3l4Rrv6XtMi4stjP6nfA08",
        "NxzyidoAecgL81qKIlboN_GprFhWHuhC2Y3PgNkps20",//JOACO
        "bLSSnSuIw7Cz86DpnI4pGHfB8ZCNX3a3SERl3mz0FqY",//DARELL
    ];

    // Lista de admins activos en la sesión
    const admins = new Set();

    // Antispam: guarda el último timestamp de mensaje por jugador
    const lastMessageTime = new Map();
    const MESSAGE_COOLDOWN = 3000; // 3 segundos en milisegundos

    // ==================== SISTEMA DE COLORES DE EQUIPOS ====================
    // Almacena los colores actuales de cada equipo para el swap
    let teamColors = {
        red: { angle: 0, textColor: 0xFFFFFF, colors: [0xE56E56] },   // Colores default rojo
        blue: { angle: 0, textColor: 0xFFFFFF, colors: [0x5689E5] }   // Colores default azul
    };

    // ==================== SISTEMA DE MONITOREO DE PING ====================
    const PING_CHECK_INTERVAL = 10000; // Revisar cada 10 segundos
    const HIGH_PING_THRESHOLD = 90; // Ping considerado alto (ms)
    const CRITICAL_PING_THRESHOLD = 200; // Ping crítico (ms)
    const SERVER_LAG_PLAYER_RATIO = 0.6; // Si 60%+ jugadores tienen ping alto = problema del servidor
    const PING_WARNING_COOLDOWN = 10000; // Avisar cada 10 segundos hasta que mejore

    // Tracking de advertencias para evitar spam
    const pingWarnings = new Map(); // playerId -> lastWarningTime
    let lastServerLagWarning = 0;

    // Cache de información de ISP por jugador (conn -> ispInfo)
    const playerIspCache = new Map();

    // Función para decodificar conn string a IP
    function decodeConnToIp(conn) {
        try {
            // El conn de Haxball es una representación base64-like del IP
            // Decodificamos los bytes
            const bytes = [];
            for (let i = 0; i < conn.length; i += 2) {
                bytes.push(parseInt(conn.substr(i, 2), 16));
            }
            // Los primeros 4 bytes son la IP
            if (bytes.length >= 4) {
                return `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`;
            }
        } catch (error) {
            console.error(`[Sala ${salaId}] Error decodificando conn:`, error.message);
        }
        return null;
    }

    // Función para obtener ISP desde IP (usando API gratuita)
    async function getIspFromIp(ip) {
        try {
            // Usar ip-api.com (gratis, sin key, 45 req/min)
            const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,isp,org,country,city`);
            const data = await response.json();

            if (data.status === 'success') {
                return {
                    isp: data.isp || data.org || 'Desconocido',
                    country: data.country || '',
                    city: data.city || ''
                };
            }
        } catch (error) {
            console.error(`[Sala ${salaId}] Error obteniendo ISP:`, error.message);
        }
        return { isp: 'Desconocido', country: '', city: '' };
    }

    // Función para obtener info del jugador (con cache)
    async function getPlayerIspInfo(player) {
        // Verificar cache
        if (playerIspCache.has(player.conn)) {
            return playerIspCache.get(player.conn);
        }

        // Decodificar IP
        const ip = decodeConnToIp(player.conn);
        if (!ip) {
            return { isp: 'Desconocido', country: '', city: '' };
        }

        // Obtener ISP
        const ispInfo = await getIspFromIp(ip);

        // Guardar en cache
        playerIspCache.set(player.conn, ispInfo);
        console.log(`[Sala ${salaId}] ISP detectado para ${player.name}: ${ispInfo.isp}`);

        return ispInfo;
    }

    // Función para verificar pings
    async function checkPings() {
        try {
            const players = room.getPlayerList().filter(p => p.id !== 0); // Excluir host
            if (players.length < 2) return; // No verificar si hay pocos jugadores

            const now = Date.now();
            let highPingPlayers = [];
            let totalPlayers = players.length;

            players.forEach(player => {
                const ping = player.ping;

                if (ping >= HIGH_PING_THRESHOLD) {
                    highPingPlayers.push({ player, ping });
                }
            });

            const highPingRatio = highPingPlayers.length / totalPlayers;

            // Si más del 60% tiene ping alto = problema del servidor
            if (highPingRatio >= SERVER_LAG_PLAYER_RATIO && highPingPlayers.length >= 2) {
                // Solo avisar si pasaron 30 segundos desde el último aviso global
                if (now - lastServerLagWarning > PING_WARNING_COOLDOWN) {
                    const avgPing = Math.round(
                        highPingPlayers.reduce((sum, p) => sum + p.ping, 0) / highPingPlayers.length
                    );
                    room.sendAnnouncement(
                        `⚠️ LATENCIA DEL SERVIDOR DETECTADA | Ping promedio: ${avgPing}ms`,
                        null,
                        0xFF6B6B,
                        'bold'
                    );
                    lastServerLagWarning = now;
                    console.log(`[Sala ${salaId}] ⚠️ Latencia del servidor detectada. Ping promedio: ${avgPing}ms`);
                }
            } else {
                // Es problema individual de algunos jugadores
                for (const { player, ping } of highPingPlayers) {
                    const lastWarning = pingWarnings.get(player.id) || 0;

                    if (now - lastWarning > PING_WARNING_COOLDOWN) {
                        // Obtener información del ISP
                        const ispInfo = await getPlayerIspInfo(player);
                        const isp = ispInfo.isp !== 'Desconocido' ? ispInfo.isp : 'tu internet';

                        let message, color;

                        // Mensajes chistosos para ping crítico (300+)
                        const criticalMessages = [
                            `🐌 ${ping}ms de ping! ${isp} te está robando el wifi, hermano`,
                            `💀 Ping ${ping}ms... ${isp} cree que estás en 1999`,
                            `🔥 ${ping}ms! ${isp} te odia personalmente`,
                            `📡 ${isp} te está dando internet con palomas mensajeras (${ping}ms)`,
                            `⚰️ RIP tu conexión: ${ping}ms | Culpable: ${isp}`,
                            `🦥 ${ping}ms... ${isp} funciona con energía solar de noche`,
                        ];

                        // Mensajes chistosos para ping alto (150-299)
                        const highMessages = [
                            `🐢 ${ping}ms de lag por culpa de ${isp}`,
                            `😤 Tu ping de ${ping}ms es culpa de ${isp}, no nuestra`,
                            `📶 ${isp} te está fallando: ${ping}ms`,
                            `🎰 ${isp} te dio ${ping}ms de ping... mala suerte!`,
                            `☎️ ${ping}ms... ${isp} sigue usando cables de teléfono?`,
                            `🌧️ ${ping}ms | ${isp} necesita revisar sus cables`,
                        ];

                        if (ping >= CRITICAL_PING_THRESHOLD) {
                            message = criticalMessages[Math.floor(Math.random() * criticalMessages.length)];
                            color = 0xFF4444;
                        } else {
                            message = highMessages[Math.floor(Math.random() * highMessages.length)];
                            color = 0xFFAA00;
                        }

                        room.sendAnnouncement(message, player.id, color, 'bold');
                        pingWarnings.set(player.id, now);
                        console.log(`[Sala ${salaId}] Ping alto: ${player.name} = ${ping}ms (${isp})`);
                    }
                }
            }
        } catch (error) {
            console.error(`[Sala ${salaId}] Error en checkPings:`, error.message);
        }
    }

    // Iniciar monitoreo de ping
    const pingCheckTimer = setInterval(checkPings, PING_CHECK_INTERVAL);
    console.log(`[Sala ${salaId}] 📶 Sistema de monitoreo de ping activado (con detección de ISP)`);

    // ==================== EVENTOS DE JUGADORES ====================

    room.onPlayerJoin = safeExecute(function (player) {
        console.log(`[Sala ${salaId}] ${player.name} se unió (auth: ${player.auth})`);

        // Dar admin automático si está en la lista de superAdmins
        if (superAdminAuths.includes(player.auth)) {
            room.setPlayerAdmin(player.id, true);
            console.log(`[Sala ${salaId}] ⭐ ${player.name} recibió admin automático`);
        }

        room.sendAnnouncement(
            `👋 Bienvenido ${player.name}! Escribe !help para ver los comandos.`,
            player.id,
            0x00FF00,
            'bold'
        );
    }, salaId, 'onPlayerJoin');

    room.onPlayerLeave = safeExecute(function (player) {
        console.log(`[Sala ${salaId}] ${player.name} salió`);
        // Limpiar cooldown y ping tracking del jugador que salió
        lastMessageTime.delete(player.id);
        pingWarnings.delete(player.id);
    }, salaId, 'onPlayerLeave');

    // ==================== COMANDOS ====================

    room.onPlayerChat = function (player, message) {
        // ==================== ANTISPAM ====================
        const now = Date.now();
        const lastTime = lastMessageTime.get(player.id) || 0;
        const timeSinceLastMessage = now - lastTime;

        // Si no pasaron 3 segundos, bloquear silenciosamente (excepto admins)
        if (timeSinceLastMessage < MESSAGE_COOLDOWN && !player.admin) {
            return false; // Silenciosamente bloqueado
        }

        // Actualizar timestamp
        lastMessageTime.set(player.id, now);

        // Registrar mensajes
        console.log(`[Sala ${salaId}] ${player.name}: ${message}`);

        // ==================== CHAT DE EQUIPO ====================
        // Si el mensaje empieza con "t " → chat privado de equipo
        if (message.toLowerCase().startsWith('t ')) {
            const teamMessage = message.slice(2); // Quitar "t "
            const playerTeam = room.getPlayer(player.id).team;

            // Solo funciona si está en un equipo (rojo=1, azul=2)
            if (playerTeam === 0) {
                room.sendAnnouncement(
                    '⚠️ Debes estar en un equipo para usar el chat de equipo.',
                    player.id,
                    0xFFAA00
                );
                return false;
            }

            // Colores legibles para cada equipo
            const teamColor = playerTeam === 1 ? 0xE74C3C : 0x3498DB; // Rojo claro / Azul claro
            const teamName = playerTeam === 1 ? '🔴' : '🔵';

            // Enviar mensaje solo a jugadores del mismo equipo
            const players = room.getPlayerList();
            players.forEach(p => {
                if (p.team === playerTeam) {
                    room.sendAnnouncement(
                        `${teamName} [EQUIPO] ${player.name}: ${teamMessage}`,
                        p.id,
                        teamColor,
                        'normal'
                    );
                }
            });

            console.log(`[Sala ${salaId}] [TEAM-${playerTeam === 1 ? 'ROJO' : 'AZUL'}] ${player.name}: ${teamMessage}`);
            return false; // No mostrar en chat público
        }

        // Procesar comandos
        if (message.startsWith('!')) {
            const args = message.slice(1).split(' ');
            const command = args[0].toLowerCase();

            switch (command) {
                case 'help':
                case 'ayuda':
                    showHelp(room, player);
                    return false;

                case 'bb':
                case 'bye':
                    room.kickPlayer(player.id, '👋 ¡Hasta luego!', false);
                    return false;

                case 'afk':
                    toggleAfk(room, player);
                    return false;

                case 'ping':
                    // Mostrar ping del jugador
                    const myPing = room.getPlayer(player.id).ping;
                    let pingStatus, pingColor;
                    if (myPing < 80) {
                        pingStatus = '🟢 Excelente';
                        pingColor = 0x00FF00;
                    } else if (myPing < 150) {
                        pingStatus = '🟡 Aceptable';
                        pingColor = 0xFFFF00;
                    } else if (myPing < 300) {
                        pingStatus = '🟠 Alto';
                        pingColor = 0xFFAA00;
                    } else {
                        pingStatus = '🔴 Crítico';
                        pingColor = 0xFF4444;
                    }
                    room.sendAnnouncement(
                        `📶 Tu ping: ${myPing}ms (${pingStatus})`,
                        player.id,
                        pingColor,
                        'normal'
                    );
                    return false;

                case 'pings':
                    // Solo admins pueden ver ping de todos
                    if (isAdmin(player, admins)) {
                        const allPlayers = room.getPlayerList().filter(p => p.id !== 0);
                        let pingList = '📶 Ping de jugadores:\n';
                        allPlayers.sort((a, b) => b.ping - a.ping); // Ordenar por ping (mayor primero)
                        allPlayers.forEach(p => {
                            let icon = p.ping < 80 ? '🟢' : p.ping < 150 ? '🟡' : p.ping < 300 ? '🟠' : '🔴';
                            pingList += `${icon} ${p.name}: ${p.ping}ms\n`;
                        });
                        room.sendAnnouncement(pingList, player.id, 0x00BFFF, 'normal');
                    }
                    return false;

                case 'swap':
                case 'cambio':
                    if (isAdmin(player, admins)) {
                        swapTeams(room, teamColors);
                    }
                    return false;

                case 'rr':
                case 'reset':
                    if (isAdmin(player, admins)) {
                        room.stopGame();
                        room.startGame();
                        room.sendAnnouncement('🔄 Partido reiniciado', null, 0xFFAA00, 'bold');
                    }
                    return false;

                case 'clear':
                    if (isAdmin(player, admins)) {
                        clearTeams(room);
                    }
                    return false;

                case 'a':
                case 'anuncio':
                    if (isAdmin(player, admins)) {
                        const anuncioTexto = args.slice(1).join(' ');
                        if (anuncioTexto) {
                            room.sendAnnouncement(
                                `\n🔊 ════════════════════════════════ 🔊`,
                                null,
                                0xFF00FF,
                                'bold'
                            );
                            room.sendAnnouncement(
                                `   ${anuncioTexto.toUpperCase()}`,
                                null,
                                0x00FFFF,
                                'bold'
                            );
                            room.sendAnnouncement(
                                `🔊 ════════════════════════════════ 🔊\n`,
                                null,
                                0xFF00FF,
                                'bold'
                            );
                        }
                    }
                    return false;

                case 'auth':
                    if (isAdmin(player, admins)) {
                        const players = room.getPlayerList();
                        let authList = '🔑 Lista de Auth IDs:\n';
                        players.forEach(p => {
                            if (p.id !== 0) { // No mostrar el host
                                authList += `${p.name}: ${p.auth}\n`;
                            }
                        });
                        room.sendAnnouncement(authList, player.id, 0x00BFFF, 'normal');
                    }
                    return false;

                case '#':
                case 'ids':
                    if (isAdmin(player, admins)) {
                        const players = room.getPlayerList();
                        let idList = '📋 Lista de IDs:\n';
                        players.forEach(p => {
                            if (p.id !== 0) {
                                const teamEmoji = p.team === 1 ? '🔴' : p.team === 2 ? '🔵' : '⚪';
                                idList += `${teamEmoji} #${p.id} - ${p.name}\n`;
                            }
                        });
                        room.sendAnnouncement(idList, player.id, 0x00BFFF, 'normal');
                    }
                    return false;

                case 'ban':
                    if (isAdmin(player, admins)) {
                        // Formato: !ban #id minutos (razón opcional)
                        // Ejemplo: !ban #5 10 o !ban 5 10
                        let targetId = args[1];
                        const minutes = parseInt(args[2]) || 5; // Default 5 minutos
                        const reason = args.slice(3).join(' ') || 'Baneado por admin';

                        if (!targetId) {
                            room.sendAnnouncement('❌ Uso: !ban #id minutos (razón)', player.id, 0xFF6B6B);
                            return false;
                        }

                        // Quitar el # si lo tiene
                        targetId = parseInt(targetId.replace('#', ''));

                        const targetPlayer = room.getPlayer(targetId);
                        if (!targetPlayer) {
                            room.sendAnnouncement(`❌ No se encontró jugador con ID #${targetId}`, player.id, 0xFF6B6B);
                            return false;
                        }

                        // No permitir banear al host o a otro admin
                        if (targetId === 0 || targetPlayer.admin) {
                            room.sendAnnouncement('❌ No puedes banear al host o a otro admin', player.id, 0xFF6B6B);
                            return false;
                        }

                        room.kickPlayer(targetId, `🚫 Baneado ${minutes} min: ${reason}`, true);
                        room.sendAnnouncement(
                            `🚫 ${targetPlayer.name} fue baneado por ${minutes} minutos`,
                            null,
                            0xFF6B6B,
                            'bold'
                        );
                        console.log(`[Sala ${salaId}] ${player.name} baneó a ${targetPlayer.name} por ${minutes} min`);
                    }
                    return false;

                case 'kick':
                    if (isAdmin(player, admins)) {
                        let targetId = args[1];
                        const reason = args.slice(2).join(' ') || 'Expulsado por admin';

                        if (!targetId) {
                            room.sendAnnouncement('❌ Uso: !kick #id (razón)', player.id, 0xFF6B6B);
                            return false;
                        }

                        targetId = parseInt(targetId.replace('#', ''));
                        const targetPlayer = room.getPlayer(targetId);

                        if (!targetPlayer || targetId === 0 || targetPlayer.admin) {
                            room.sendAnnouncement('❌ Jugador no válido o es admin', player.id, 0xFF6B6B);
                            return false;
                        }

                        room.kickPlayer(targetId, `👢 ${reason}`, false);
                        room.sendAnnouncement(`👢 ${targetPlayer.name} fue expulsado`, null, 0xFFAA00);
                    }
                    return false;

                case 'unban':
                    if (isAdmin(player, admins)) {
                        let targetId = args[1];
                        if (!targetId) {
                            room.sendAnnouncement('❌ Uso: !unban #id', player.id, 0xFF6B6B);
                            return false;
                        }
                        targetId = parseInt(targetId.replace('#', ''));
                        room.clearBan(targetId);
                        room.sendAnnouncement(`✅ Ban removido para ID #${targetId}`, player.id, 0x00FF00);
                        console.log(`[Sala ${salaId}] ${player.name} desbaneó al ID #${targetId}`);
                    }
                    return false;

                case 'clearbans':
                    if (isAdmin(player, admins)) {
                        room.clearBans();
                        room.sendAnnouncement('✅ Todos los bans han sido removidos', null, 0x00FF00, 'bold');
                        console.log(`[Sala ${salaId}] ${player.name} limpió todos los bans`);
                    }
                    return false;
            }
        }

        return true; // Mostrar mensaje en chat
    };

    // ==================== EVENTOS DE PARTIDO ====================

    room.onGameStart = safeExecute(function (byPlayer) {
        if (byPlayer) {
            console.log(`[Sala ${salaId}] Partido iniciado por ${byPlayer.name}`);
        }
    }, salaId, 'onGameStart');

    room.onGameStop = safeExecute(function (byPlayer) {
        if (byPlayer) {
            console.log(`[Sala ${salaId}] Partido detenido por ${byPlayer.name}`);
        }
    }, salaId, 'onGameStop');

    room.onTeamGoal = safeExecute(function (team) {
        const teamName = team === 1 ? 'Rojo' : 'Azul';
        const color = team === 1 ? 0xFF0000 : 0x0000FF;
        room.sendAnnouncement(`⚽ ¡GOL del equipo ${teamName}!`, null, color, 'bold');
    }, salaId, 'onTeamGoal');

    room.onTeamVictory = safeExecute(function (scores) {
        const winner = scores.red > scores.blue ? 'ROJO' : 'AZUL';
        const color = scores.red > scores.blue ? 0xFF0000 : 0x0000FF;
        room.sendAnnouncement(
            `🏆 ¡Equipo ${winner} gana! (${scores.red} - ${scores.blue})`,
            null,
            color,
            'bold'
        );
    }, salaId, 'onTeamVictory');

    // ==================== AUTO-ADMIN ====================

    room.onPlayerAdminChange = safeExecute(function (changedPlayer, byPlayer) {
        if (changedPlayer.admin) {
            admins.add(changedPlayer.id);
        } else {
            admins.delete(changedPlayer.id);
        }
    }, salaId, 'onPlayerAdminChange');
}

// ==================== FUNCIONES AUXILIARES ====================

function showHelp(room, player) {
    const helpMessage = `
📋 Comandos disponibles:
!help - Muestra esta ayuda
!bb - Salir de la sala
!afk - Marcar/desmarcar AFK
!ping - Ver tu ping actual
--- Chat de Equipo ---
t <mensaje> - Hablar solo con tu equipo
--- Admin ---
!swap - Cambiar equipos
!rr - Reiniciar partido
!clear - Limpiar equipos
!a <texto> - Enviar anuncio
!pings - Ver ping de todos
  `.trim();

    room.sendAnnouncement(helpMessage, player.id, 0x00BFFF, 'normal');
}

function isAdmin(player, admins) {
    return player.admin || admins.has(player.id);
}

function toggleAfk(room, player) {
    // Mover a espectadores si está en equipo
    const currentTeam = room.getPlayer(player.id).team;
    if (currentTeam !== 0) {
        room.setPlayerTeam(player.id, 0);
        room.sendAnnouncement(`😴 ${player.name} está AFK`, null, 0x888888);
    } else {
        room.sendAnnouncement(`✅ ${player.name} ya no está AFK`, null, 0x00FF00);
    }
}

function swapTeams(room, teamColors) {
    const players = room.getPlayerList();

    // Intercambiar jugadores de equipos
    players.forEach(p => {
        if (p.team === 1) {
            room.setPlayerTeam(p.id, 2);
        } else if (p.team === 2) {
            room.setPlayerTeam(p.id, 1);
        }
    });

    // Intercambiar los uniformes/colores para mantener la identidad visual
    // Los que eran rojos ahora son azules pero con el uniforme rojo, y viceversa
    const tempRed = { ...teamColors.red };
    const tempBlue = { ...teamColors.blue };

    // Aplicar colores intercambiados
    // El equipo rojo ahora tiene los colores que tenía el azul
    room.setTeamColors(1, tempBlue.angle, tempBlue.textColor, tempBlue.colors);
    // El equipo azul ahora tiene los colores que tenía el rojo
    room.setTeamColors(2, tempRed.angle, tempRed.textColor, tempRed.colors);

    // Actualizar el tracking de colores
    teamColors.red = tempBlue;
    teamColors.blue = tempRed;

    room.sendAnnouncement('🔄 Equipos intercambiados (uniformes mantenidos)', null, 0xFFAA00, 'bold');
}

function clearTeams(room) {
    const players = room.getPlayerList();
    players.forEach(p => {
        if (p.id !== 0) { // No mover al host
            room.setPlayerTeam(p.id, 0);
        }
    });
    room.sendAnnouncement('🧹 Equipos limpiados', null, 0xFFAA00, 'bold');
}

module.exports = { setupRoom };
