const PROTOCOL = 8;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cleanTag(value) {
  return String(value || "").trim().replace(/^@/, "");
}

function cleanClient(message) {
  return {
    tag: cleanTag(message.tag),
    clientId: String(message.clientId || "").trim().toLowerCase(),
    romHash: String(message.romHash || "").trim().toLowerCase(),
    romSize: Number(message.romSize || 0),
    gameCode: String(message.gameCode || "").trim().toUpperCase(),
  };
}

function validateClient(message) {
  if (Number(message.protocol) !== PROTOCOL) return "Actualiza la app: protocolo incompatible.";
  const client = cleanClient(message);
  if (!/^[A-Za-z0-9_]{3,16}$/.test(client.tag)) return "Tag-name invalido.";
  if (!/^[0-9a-f-]{32,40}$/.test(client.clientId)) return "Identidad de dispositivo invalida.";
  if (!/^[0-9a-f]{40}$/.test(client.romHash) || client.romSize <= 0) {
    return "Selecciona una ROM antes de entrar al modo online.";
  }
  return "";
}

function attachment(socket) {
  return socket.deserializeAttachment() || {
    roomCode: "",
    playerId: -1,
    tag: "",
    clientId: "",
    romHash: "",
    romSize: 0,
    gameCode: "",
    stateHash: "",
    playerSaveHash: "",
    guestReady: false,
  };
}

function saveAttachment(socket, value) {
  socket.serializeAttachment(value);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ ok: true, service: "gazapo-link-relay", protocol: PROTOCOL });
    }
    const id = env.RELAY.idFromName("global-relay-v8");
    return env.RELAY.get(id).fetch(request);
  },
};

export class RelayRoom {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ ok: false, message: "WebSocket requerido." }, 426);
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    saveAttachment(server, attachment(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, rawMessage) {
    let message;
    try {
      message = JSON.parse(typeof rawMessage === "string"
        ? rawMessage
        : new TextDecoder().decode(rawMessage));
    } catch {
      return this.send(socket, { type: "error", message: "Mensaje JSON invalido." });
    }
    switch (message.type) {
      case "create":
        return this.createRoom(socket, message);
      case "join":
        return this.joinRoom(socket, message);
      case "state_begin":
      case "state_chunk":
      case "state_end":
        return this.forwardState(socket, message);
      case "player_save_begin":
      case "player_save_chunk":
      case "player_save_end":
        return this.forwardPlayerSave(socket, message);
      case "state_ready":
        return this.stateReady(socket, message);
      case "start":
        return this.start(socket);
      case "input":
        if (Number.isInteger(message.frame) && Number.isInteger(message.buttons)) {
          return this.forward(socket, {
            type: "input",
            frame: message.frame,
            buttons: message.buttons,
          });
        }
        return;
      case "input_batch":
        if (Number.isInteger(message.fromFrame) && Array.isArray(message.inputs)
            && message.inputs.length > 0 && message.inputs.length <= 12
            && message.inputs.every(Number.isInteger)) {
          return this.forward(socket, {
            type: "input_batch",
            fromFrame: message.fromFrame,
            inputs: message.inputs,
          });
        }
        return;
      case "state_hash":
        if (Number.isInteger(message.frame) && /^[0-9a-f]{64}$/i.test(String(message.hash || ""))) {
          return this.forward(socket, {
            type: "state_hash",
            frame: message.frame,
            hash: String(message.hash).toLowerCase(),
          });
        }
        return;
      case "ping":
        return this.send(socket, {
          type: "pong",
          sentAt: Number.isSafeInteger(message.sentAt) ? message.sentAt : -1,
          now: Date.now(),
        });
      default:
        return this.send(socket, { type: "error", message: "Tipo de mensaje desconocido." });
    }
  }

  webSocketClose(socket) {
    this.leave(socket);
  }

  webSocketError(socket) {
    this.leave(socket);
  }

  socketsInRoom(code) {
    return this.state.getWebSockets().filter((socket) => attachment(socket).roomCode === code);
  }

  peerFor(socket) {
    const current = attachment(socket);
    if (!current.roomCode) return null;
    return this.socketsInRoom(current.roomCode)
      .find((candidate) => attachment(candidate).playerId !== current.playerId) || null;
  }

  roomCode() {
    const occupied = new Set(
      this.state.getWebSockets().map((socket) => attachment(socket).roomCode).filter(Boolean)
    );
    do {
      const random = new Uint32Array(6);
      crypto.getRandomValues(random);
      let code = "";
      for (const value of random) code += ALPHABET[value % ALPHABET.length];
      if (!occupied.has(code)) return code;
    } while (true);
  }

  createRoom(socket, message) {
    const error = validateClient(message);
    if (error) return this.send(socket, { type: "error", message: error });
    this.leave(socket);
    const code = this.roomCode();
    const client = cleanClient(message);
    saveAttachment(socket, {
      ...attachment(socket),
      ...client,
      roomCode: code,
      playerId: 0,
      stateHash: "",
      playerSaveHash: "",
      guestReady: false,
    });
    this.send(socket, { type: "room", code, playerId: 0, tag: client.tag });
  }

  joinRoom(socket, message) {
    const error = validateClient(message);
    if (error) return this.send(socket, { type: "error", message: error });
    const code = String(message.code || "").trim().toUpperCase();
    const members = this.socketsInRoom(code);
    const hostSocket = members.find((member) => attachment(member).playerId === 0);
    if (!hostSocket) return this.send(socket, { type: "error", message: "La sala no existe." });
    if (members.some((member) => attachment(member).playerId === 1)) {
      return this.send(socket, { type: "error", message: "La sala esta llena." });
    }
    const host = attachment(hostSocket);
    const guest = cleanClient(message);
    if (host.tag.toLowerCase() === guest.tag.toLowerCase()) {
      return this.send(socket, { type: "error", message: "Los dos jugadores no pueden usar el mismo tag." });
    }
    if (host.romHash !== guest.romHash || host.romSize !== guest.romSize) {
      return this.send(socket, { type: "error", message: "La ROM no coincide con la del creador." });
    }
    this.leave(socket);
    saveAttachment(hostSocket, {
      ...host, stateHash: "", playerSaveHash: "", guestReady: false,
    });
    saveAttachment(socket, {
      ...attachment(socket),
      ...guest,
      roomCode: code,
      playerId: 1,
      stateHash: "",
      playerSaveHash: "",
      guestReady: false,
    });
    this.send(socket, { type: "joined", code, playerId: 1, tag: guest.tag });
    this.send(hostSocket, { type: "session_ready", playerId: 0, peerTag: guest.tag });
    this.send(socket, { type: "session_ready", playerId: 1, peerTag: host.tag });
  }

  forwardState(socket, message) {
    const current = attachment(socket);
    if (!current.roomCode || current.playerId !== 0) return;
    if (message.type === "state_begin") {
      const size = Number(message.size || 0);
      const chunks = Number(message.chunks || 0);
      const hash = String(message.hash || "").toLowerCase();
      if (size <= 0 || size > 8 * 1024 * 1024 || chunks <= 0 || !/^[0-9a-f]{64}$/.test(hash)) {
        return this.send(socket, { type: "error", message: "Estado inicial invalido." });
      }
      saveAttachment(socket, { ...current, stateHash: hash, guestReady: false });
      const peer = this.peerFor(socket);
      if (peer) {
        saveAttachment(peer, { ...attachment(peer), stateHash: hash, guestReady: false });
      }
    }
    this.forward(socket, message);
  }

  forwardPlayerSave(socket, message) {
    const current = attachment(socket);
    if (!current.roomCode || current.playerId !== 1) return;
    if (message.type === "player_save_begin") {
      const size = Number(message.size || 0);
      const chunks = Number(message.chunks || 0);
      const hash = String(message.hash || "").toLowerCase();
      if (size <= 0 || size > 8 * 1024 * 1024 || chunks <= 0
          || !/^[0-9a-f]{64}$/.test(hash)) {
        return this.send(socket, { type: "error", message: "Perfil del invitado invalido." });
      }
      saveAttachment(socket, { ...current, playerSaveHash: hash });
      const peer = this.peerFor(socket);
      if (peer) {
        saveAttachment(peer, { ...attachment(peer), playerSaveHash: hash });
      }
    } else if (!current.playerSaveHash) {
      return this.send(socket, { type: "error", message: "Perfil fuera de secuencia." });
    }
    this.forward(socket, message);
  }

  stateReady(socket, message) {
    const current = attachment(socket);
    const hash = String(message.hash || "").toLowerCase();
    if (current.playerId !== 1 || !current.stateHash || hash !== current.stateHash) {
      return this.send(socket, { type: "error", message: "No se pudo verificar el estado inicial." });
    }
    saveAttachment(socket, { ...current, guestReady: true });
    const host = this.peerFor(socket);
    if (host) {
      saveAttachment(host, { ...attachment(host), guestReady: true });
      this.send(host, { type: "state_ready", hash });
    }
  }

  start(socket) {
    const current = attachment(socket);
    if (current.playerId !== 0 || !current.guestReady) {
      return this.send(socket, { type: "error", message: "El invitado aun no esta sincronizado." });
    }
    for (const member of this.socketsInRoom(current.roomCode)) {
      this.send(member, { type: "start" });
    }
  }

  forward(socket, message) {
    const peer = this.peerFor(socket);
    if (peer) this.send(peer, message);
  }

  leave(socket) {
    const current = attachment(socket);
    if (!current.roomCode) return;
    const peer = this.peerFor(socket);
    if (peer) this.send(peer, { type: "peer_left", tag: current.tag });
    saveAttachment(socket, {
      ...current,
      roomCode: "",
      playerId: -1,
      stateHash: "",
      playerSaveHash: "",
      guestReady: false,
    });
  }

  send(socket, message) {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.leave(socket);
    }
  }
}
