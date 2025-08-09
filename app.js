// ======== Helpers ========
const $ = (sel) => document.querySelector(sel);
const roomLabel = $("#roomCodeLabel");
const copyLinkBtn = $("#copyLinkBtn");
const lobby = $("#lobby");
const gamePanel = $("#gamePanel");
const playersList = $("#playersList");
const wordMaskEl = $("#wordMask");
const timerEl = $("#timer");
const startBtn = $("#startBtn");
const joinBtn = $("#joinBtn");
const createBtn = $("#createBtn");
const nameInput = $("#nameInput");
const roomInput = $("#roomInput");
const chatLog = $("#chatLog");
const chatInput = $("#chatInput");
const sendBtn = $("#sendBtn");
const board = $("#board");
const brushSize = $("#brushSize");
const clearBtn = $("#clearBtn");

let socket = null;
let isDrawer = false;
let myId = null;
let currentRoom = null;

function genCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0;i<4;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function appendChatSystem(text) {
  const div = document.createElement("div");
  div.className = "chat-line system";
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function appendChatMsg(from, text) {
  const div = document.createElement("div");
  div.className = "chat-line";
  const f = document.createElement("span");
  f.className = "from";
  f.textContent = from + ":";
  const t = document.createElement("span");
  t.textContent = " " + text;
  div.appendChild(f);
  div.appendChild(t);
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function updatePlayers(list) {
  playersList.innerHTML = "";
  list.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name} — ${p.score}`;
    if (p.isHost) li.classList.add("host");
    if (p.id === myId) li.style.outline = "1px dashed #3b82f6";
    playersList.appendChild(li);
  });
}

// ======= Socket Setup =======
function connectSocket() {
  socket = io(SERVER_URL, { transports: ["websocket"] });
  socket.on("connect", () => { myId = socket.id; });

  socket.on("room:update", (state) => {
    updatePlayers(state.players);
    const IamDrawer = state.drawerId === myId;
    isDrawer = IamDrawer;
    wordMaskEl.textContent = state.wordMask || "—";
    startBtn.style.display = state.players.find(p => p.id === myId && p.isHost) ? "inline-block" : "none";
  });

  socket.on("chat:system", (msg) => appendChatSystem(msg));
  socket.on("chat:message", ({from, text}) => appendChatMsg(from, text));
  socket.on("score:update", updatePlayers);

  socket.on("round:begin", ({ round, drawerId, duration, wordMask }) => {
    isDrawer = drawerId === myId;
    wordMaskEl.textContent = wordMask;
    startCountdown(duration);
    if (!isDrawer) disableDrawing();
    else enableDrawing();
  });
  socket.on("round:tick", ({ secondsLeft }) => {
    timerEl.textContent = secondsLeft + "s";
  });
  socket.on("round:end", ({ word }) => {
    appendChatSystem("Round ended! Word was: " + word);
    timerEl.textContent = "—";
    disableDrawing();
  });

  socket.on("word:reveal", (word) => {
    // drawer sees actual word
    wordMaskEl.textContent = word;
  });
  socket.on("word:mask", ({ mask }) => {
    wordMaskEl.textContent = mask;
  });

  // Canvas events
  socket.on("canvas:draw", drawRemoteLine);
  socket.on("canvas:clear", clearCanvas);
}

function joinRoom(roomCode, name) {
  currentRoom = roomCode;
  roomLabel.textContent = "Room: " + roomCode;
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomCode);
  history.replaceState({}, "", url.toString());
  lobby.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  socket.emit("room:join", { roomCode, name });
}

startBtn.addEventListener("click", () => socket.emit("game:start"));
sendBtn.addEventListener("click", () => {
  const msg = chatInput.value.trim();
  if (!msg) return;
  socket.emit("chat:message", msg);
  chatInput.value = "";
});
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Player";
  const room = (roomInput.value.trim() || "").toUpperCase();
  if (!room) return alert("Enter a room code.");
  joinRoom(room, name);
});

createBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Player";
  const code = genCode();
  roomInput.value = code;
  joinRoom(code, name);
});

copyLinkBtn.addEventListener("click", async () => {
  if (!currentRoom) return;
  const url = new URL(window.location.href);
  url.searchParams.set("room", currentRoom);
  try {
    await navigator.clipboard.writeText(url.toString());
    copyLinkBtn.textContent = "Copied!";
    setTimeout(()=> copyLinkBtn.textContent = "Copy Invite Link", 1200);
  } catch {}
});

// ======== Canvas Drawing ========
const ctx = board.getContext("2d");
let drawing = false;
let last = null;

function resizeCanvasToCSS() {
  // Keep internal size matching CSS size for crisp lines
  const rect = board.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  board.width = Math.floor(rect.width * scale);
  board.height = Math.floor(rect.height * scale);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#eaf0ff";
}

function pointerPos(e) {
  const rect = board.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  return { x, y };
}

function startDraw(e) {
  if (!isDrawer) return;
  drawing = true;
  last = pointerPos(e);
}
function moveDraw(e) {
  if (!drawing || !isDrawer) return;
  const p = pointerPos(e);
  const size = parseInt(brushSize.value, 10) || 4;
  const line = { from: last, to: p, size };
  drawLocalLine(line);
  socket.emit("canvas:draw", line);
  last = p;
}
function endDraw() { drawing = false; last = null; }

function drawLocalLine({ from, to, size }) {
  ctx.lineWidth = size;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}
function drawRemoteLine(line) {
  drawLocalLine(line);
}

function clearCanvas() {
  const rect = board.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
}
clearBtn.addEventListener("click", () => {
  if (isDrawer) socket.emit("canvas:clear");
});

function enableDrawing() {
  board.style.outline = "2px solid #3b82f6";
}
function disableDrawing() {
  board.style.outline = "1px solid #223056";
}

// events
["mousedown","touchstart"].forEach(ev => board.addEventListener(ev, startDraw));
["mousemove","touchmove"].forEach(ev => board.addEventListener(ev, moveDraw));
["mouseup","mouseleave","touchend","touchcancel"].forEach(ev => board.addEventListener(ev, endDraw));

window.addEventListener("resize", () => {
  const img = ctx.getImageData(0,0,board.width,board.height);
  resizeCanvasToCSS();
  ctx.putImageData(img,0,0);
});

function startCountdown(seconds) { timerEl.textContent = seconds + "s"; }

// ====== Boot ======
resizeCanvasToCSS();
connectSocket();

// Auto-join if ?room=CODE present
const params = new URLSearchParams(window.location.search);
const presetRoom = (params.get("room")||"").toUpperCase();
if (presetRoom) {
  roomInput.value = presetRoom;
}
