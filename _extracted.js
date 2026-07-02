
// ---------- NAVIGATION (avec historique pour le bouton retour Android) ----------
const screens = document.querySelectorAll(".screen");
let currentCleanup = null;
let currentScreen = "home";

function renderScreen(id){
  if(!document.getElementById(id)) return;
  screens.forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if(currentCleanup){ currentCleanup(); currentCleanup = null; }
  currentScreen = id;

  if(id === "sos") currentCleanup = startSOS();
  if(id === "mirror") setTimeout(()=>{ currentCleanup = initCanvasScreen(mirrorConfig); }, 30);
  if(id === "yin") currentCleanup = startYin();
  if(id === "peripheral") currentCleanup = () => {}; // pure CSS, rien à nettoyer
  if(id === "leftwrite") setTimeout(()=>{ currentCleanup = initCanvasScreen(leftwriteConfig); }, 30);
  if(id === "bowl") currentCleanup = initBowl();
  if(id === "altbreath") currentCleanup = startAltBreath();
  if(id === "doodle") setTimeout(()=>{ currentCleanup = initCanvasScreen(doodleConfig); }, 30);
  if(id === "metronome") currentCleanup = startMetronome();
  if(id === "ritual") currentCleanup = startRitual();
  if(id === "zmanim") currentCleanup = startZmanim();
  if(id === "breathwork") currentCleanup = initBreathwork(pendingBreathKey);
  if(id === "choulhanCA") currentCleanup = initChoulhanCA();
  if(id === "choulhanMB") currentCleanup = initChoulhanMB();
  if(id === "quizList") currentCleanup = initQuizList();
  if(id === "quizPlay") currentCleanup = initQuizPlay();
  if(id === "settings") currentCleanup = initSettings();
}

function goTo(id){
  if(id === currentScreen) return;
  history.pushState({ screen: id }, "", "#" + id);
  renderScreen(id);
}

// Le bouton/geste retour Android déclenche "popstate" : on revient à l'écran
// précédent au lieu de laisser le système fermer l'application.
window.addEventListener("popstate", (e)=>{
  const target = (e.state && e.state.screen) || "home";
  renderScreen(target);
});
history.replaceState({ screen: "home" }, "", "#home");

// ---------- RAPPEL QUOTIDIEN QUIZ (10h) ----------
// Tourne en permanence dès l'ouverture de l'app (pas seulement quand on est sur l'écran Quiz),
// pour rappeler chaque jour à 10h de remplir un quiz. Comme pour les zmaniot, ceci nécessite que
// l'app reste ouverte : Android suspend l'exécution JS si l'app est fermée ou en arrière-plan
// depuis trop longtemps, donc ce n'est pas garanti à la seconde si le téléphone est verrouillé.
function initDailyQuizReminder(){
  setInterval(()=>{
    if(!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    if(now.getHours() !== 10 || now.getMinutes() !== 0) return;
    const todayStr = now.toDateString();
    if(localStorage.getItem("quizReminderNotifiedDate") === todayStr) return;
    localStorage.setItem("quizReminderNotifiedDate", todayStr);
    zmanShowNotification("Quiz Chabbat", { body: "Prends 2 minutes pour remplir un quiz sur les halachot de Chabbat.", icon: "icons/icon-192.png" });
  }, 30000);
}
initDailyQuizReminder();

// ---------- STIMULATION BILATÉRALE ----------
const BILATERAL_LIMIT_MS = 60000; // volontairement court et non modifiable depuis l'interface

function startBilateralRun(mode){
  const dot = document.getElementById("bilateralDot");
  const label = document.getElementById("bilateralLabel");
  const grounding = document.getElementById("bilateralGrounding");
  const panicBtn = document.getElementById("bilateralPanic");

  grounding.classList.remove("show");
  dot.style.display = "block";
  panicBtn.style.display = "block";

  const legSeconds = mode === "fast" ? 0.75 : 1.25;
  dot.style.animationDuration = legSeconds + "s";
  label.textContent = mode === "fast" ? "SOS Bureau · 60 secondes" : "Mantra · 60 secondes";

  const endTimer = setTimeout(finishBilateral, BILATERAL_LIMIT_MS);

  function onPanic(){
    clearTimeout(endTimer);
    dot.style.display = "none";
    panicBtn.style.display = "none";
    grounding.classList.add("show");
  }
  function finishBilateral(){
    dot.style.display = "none";
    panicBtn.style.display = "none";
    goTo("home");
  }
  panicBtn.addEventListener("click", onPanic);

  return () => {
    clearTimeout(endTimer);
    panicBtn.removeEventListener("click", onPanic);
    grounding.classList.remove("show");
  };
}
document.getElementById("bilateralFastBtn").addEventListener("click", ()=>{
  goTo("bilateralRun");
  currentCleanup = startBilateralRun("fast");
});
document.getElementById("bilateralSlowBtn").addEventListener("click", ()=>{
  goTo("bilateralRun");
  currentCleanup = startBilateralRun("slow");
});
document.querySelectorAll("[data-go]").forEach(el=>{
  el.addEventListener("click", ()=> goTo(el.getAttribute("data-go")));
});

// ---------- RESPIRATION (hub + séances guidées, avec instructions écrites) ----------
// Chaque technique porte ses propres consignes en toutes lettres : rien à retenir par cœur,
// le texte reste affiché à l'écran pendant toute la séance.
const BREATH_TECHNIQUES = {
  coherence55: {
    name: "Cohérence 5 / 5",
    subtitle: "Équilibre le système nerveux, sans mot",
    instruction: "Inspire calmement par le nez pendant 5 secondes. Expire par la bouche pendant 5 secondes. Laisse le cercle guider le rythme, sans forcer sur l'air.",
    phases: [
      { type: "in",  word: "Inspire", seconds: 5 },
      { type: "out", word: "Expire",  seconds: 5 }
    ]
  },
  apaisant46: {
    name: "4 / 6 Apaisant",
    subtitle: "Expire plus longue, calme une montée de stress",
    instruction: "Inspire par le nez pendant 4 secondes. Expire lentement par la bouche pendant 6 secondes, comme si tu soufflais doucement sur une bougie sans l'éteindre.",
    phases: [
      { type: "in",  word: "Inspire", seconds: 4 },
      { type: "out", word: "Expire",  seconds: 6 }
    ]
  },
  carree4444: {
    name: "Carrée 4-4-4-4",
    subtitle: "Inspire, retiens, expire, retiens",
    instruction: "Inspire par le nez pendant 4 secondes. Retiens l'air, poumons pleins, pendant 4 secondes. Expire par la bouche pendant 4 secondes. Retiens, poumons vides, pendant 4 secondes. Puis recommence.",
    phases: [
      { type: "in",   word: "Inspire", seconds: 4 },
      { type: "hold", word: "Retiens", seconds: 4 },
      { type: "out",  word: "Expire",  seconds: 4 },
      { type: "hold", word: "Retiens", seconds: 4 }
    ]
  }
};

let pendingBreathKey = null;
document.querySelectorAll("[data-go-breath]").forEach(el=>{
  el.addEventListener("click", ()=>{
    pendingBreathKey = el.getAttribute("data-go-breath");
    goTo("breathwork");
  });
});

// Petit ding synthétisé (aucun fichier audio), joué à chaque changement de phase.
// Réutilise le même contexte audio que le bol tibétain / rituel.
function bwDing(freq){
  if(!bowlAudioCtx) bowlAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = bowlAudioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq || 660;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.16, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.55);
}

function initBreathwork(key){
  const tech = BREATH_TECHNIQUES[key];
  const titleEl = document.getElementById("bwTitle");
  const subtitleEl = document.getElementById("bwSubtitle");
  const instructionEl = document.getElementById("bwInstruction");
  const circle = document.getElementById("bwCircle");
  const word = document.getElementById("bwWord");
  const timerEl = document.getElementById("bwTimer");
  const statusEl = document.getElementById("bwStatus");
  const durationRow = document.getElementById("bwDurationRow");
  const durationBtns = durationRow.querySelectorAll(".bw-duration-btn");

  if(!tech){
    titleEl.textContent = "—";
    subtitleEl.textContent = "";
    instructionEl.textContent = "";
    durationRow.style.display = "none";
    return () => {};
  }

  titleEl.textContent = tech.name;
  subtitleEl.textContent = tech.subtitle;
  instructionEl.textContent = tech.instruction;
  statusEl.textContent = "";
  timerEl.textContent = "";
  word.textContent = "";
  circle.classList.remove("expand", "contract");
  circle.style.transitionDuration = "";
  durationRow.style.display = "flex";

  let phaseTimeout = null;
  let sessionInterval = null;
  let sessionRemaining = 0;

  function runPhase(index){
    const phase = tech.phases[index % tech.phases.length];
    circle.style.transitionDuration = phase.seconds + "s";
    if(phase.type === "in"){ circle.classList.add("expand"); circle.classList.remove("contract"); }
    else if(phase.type === "out"){ circle.classList.add("contract"); circle.classList.remove("expand"); }
    // "hold" : le cercle reste tel quel, aucune animation de taille pendant la rétention.
    word.style.opacity = 0;
    setTimeout(()=>{ word.textContent = phase.word; word.style.opacity = 0.95; }, 150);
    if(navigator.vibrate) navigator.vibrate(phase.type === "hold" ? 12 : 30);
    bwDing(phase.type === "in" ? 740 : phase.type === "out" ? 523 : 660);
    phaseTimeout = setTimeout(()=> runPhase(index + 1), phase.seconds * 1000);
  }

  function endSession(){
    if(sessionInterval){ clearInterval(sessionInterval); sessionInterval = null; }
    if(phaseTimeout){ clearTimeout(phaseTimeout); phaseTimeout = null; }
    if(navigator.vibrate) navigator.vibrate(0);
    ritualDing();
    word.textContent = "";
    timerEl.textContent = "";
    statusEl.textContent = "Séance terminée. Bravo.";
    durationRow.style.display = "flex";
  }

  function startSession(minutes){
    durationRow.style.display = "none";
    statusEl.textContent = "";
    sessionRemaining = minutes * 60;
    timerEl.textContent = ritualFormatTime(sessionRemaining) + " restantes";
    runPhase(0);
    sessionInterval = setInterval(()=>{
      sessionRemaining--;
      timerEl.textContent = ritualFormatTime(Math.max(sessionRemaining, 0)) + " restantes";
      if(sessionRemaining <= 0) endSession();
    }, 1000);
  }

  const handlers = [];
  durationBtns.forEach(btn=>{
    const handler = ()=> startSession(parseInt(btn.getAttribute("data-min"), 10));
    btn.addEventListener("click", handler);
    handlers.push([btn, handler]);
  });

  return () => {
    if(sessionInterval) clearInterval(sessionInterval);
    if(phaseTimeout) clearTimeout(phaseTimeout);
    if(navigator.vibrate) navigator.vibrate(0);
    handlers.forEach(([btn, handler]) => btn.removeEventListener("click", handler));
  };
}

// ---------- SOS BUREAU (cohérence cardiaque) ----------
let vibOn = true;
document.getElementById("vibToggle").addEventListener("click", (e)=>{
  vibOn = !vibOn;
  e.target.textContent = "Vibration : " + (vibOn ? "activée" : "désactivée");
});

function startSOS(){
  const circle = document.getElementById("breathCircle");
  const word = document.getElementById("breathWord");
  let expanding = true;

  function phase(){
    if(expanding){
      circle.classList.remove("contract");
      circle.classList.add("expand");
      word.style.opacity = 0;
      setTimeout(()=>{ word.textContent = "Ribono"; word.style.opacity = 0.95; }, 150);
    } else {
      circle.classList.remove("expand");
      circle.classList.add("contract");
      word.style.opacity = 0;
      setTimeout(()=>{ word.textContent = "Shel Olam"; word.style.opacity = 0.95; }, 150);
    }
    if(vibOn && navigator.vibrate) navigator.vibrate(40);
    expanding = !expanding;
  }
  phase();
  const interval = setInterval(phase, 5000);
  return () => { clearInterval(interval); if(navigator.vibrate) navigator.vibrate(0); };
}

// ---------- NIGOUNIM ----------
const audioEl = document.getElementById("audioEl");
const playlistEl = document.getElementById("playlist");
const playPauseBtn = document.getElementById("playPauseBtn");
let tracks = [];
let currentIndex = 0;
let sleepTimer = null;

document.getElementById("pickFiles").addEventListener("click", ()=>{
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "audio/*";
  input.multiple = true;
  input.onchange = (e)=>{
    tracks = Array.from(e.target.files).map(f => ({ name: f.name, url: URL.createObjectURL(f) }));
    renderPlaylist();
    if(tracks.length){ currentIndex = 0; loadTrack(0); }
    if(typeof ritualCheckShowPlay === "function") ritualCheckShowPlay();
  };
  input.click();
});

function renderPlaylist(){
  playlistEl.innerHTML = "";
  tracks.forEach((t, i)=>{
    const div = document.createElement("div");
    div.className = "track" + (i === currentIndex ? " playing" : "");
    div.textContent = t.name.replace(/\.[^/.]+$/, "");
    div.addEventListener("click", ()=>{ currentIndex = i; loadTrack(i); playAudio(); });
    playlistEl.appendChild(div);
  });
}
function loadTrack(i){
  if(!tracks[i]) return;
  audioEl.src = tracks[i].url;
  renderPlaylist();
}
function playAudio(){
  audioEl.play();
  playPauseBtn.textContent = "❚❚";
  startSleepTimer();
}
function pauseAudio(){
  audioEl.pause();
  playPauseBtn.textContent = "▶";
}
playPauseBtn.addEventListener("click", ()=>{
  if(audioEl.paused) playAudio(); else pauseAudio();
});
document.getElementById("nextBtn").addEventListener("click", ()=>{
  if(!tracks.length) return;
  currentIndex = (currentIndex + 1) % tracks.length;
  loadTrack(currentIndex); playAudio();
});
document.getElementById("prevBtn").addEventListener("click", ()=>{
  if(!tracks.length) return;
  currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
  loadTrack(currentIndex); playAudio();
});
audioEl.addEventListener("ended", ()=>{
  if(!tracks.length) return;
  currentIndex = (currentIndex + 1) % tracks.length;
  loadTrack(currentIndex); playAudio();
});
function startSleepTimer(){
  if(sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = setTimeout(()=>{ pauseAudio(); }, 15 * 60 * 1000);
}

// ---------- MOTEUR CANVAS COMMUN (Miroir Gauche / Écriture / Gribouillage) ----------
function initCanvasScreen(config){
  const canvas = document.getElementById(config.canvasId);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let fadeInterval = null;

  if(config.drawGuide) config.drawGuide(ctx, canvas);

  if(config.fade){
    fadeInterval = setInterval(()=>{
      ctx.fillStyle = config.fadeColor;
      ctx.fillRect(0,0,canvas.width, canvas.height);
    }, 60);
  }

  function pos(e){
    const t = e.touches ? e.touches[0] : e;
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  canvas.onpointerdown = (e)=>{
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  canvas.onpointermove = (e)=>{
    if(!drawing) return;
    const p = pos(e);
    ctx.strokeStyle = config.strokeColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = ()=> drawing = false;
  window.addEventListener("pointerup", up);

  if(config.actionBtnId){
    const btn = document.getElementById(config.actionBtnId);
    const handler = ()=> config.onAction(ctx, canvas);
    btn.addEventListener("click", handler);
    config._btn = btn; config._handler = handler;
  }

  return () => {
    if(fadeInterval) clearInterval(fadeInterval);
    window.removeEventListener("pointerup", up);
    canvas.onpointerdown = null;
    canvas.onpointermove = null;
    if(config._btn) config._btn.removeEventListener("click", config._handler);
  };
}

// -- Miroir Gauche : forme géométrique à retracer, main gauche --
const mirrorGuideShapes = [
  (ctx, canvas)=>{
    const cx = canvas.width/2, cy = canvas.height/2 - 40;
    ctx.beginPath();
    for(let x=-140; x<=140; x+=4){
      const y = Math.sin(x/28) * 70;
      if(x === -140) ctx.moveTo(cx+x, cy+y); else ctx.lineTo(cx+x, cy+y);
    }
    ctx.stroke();
  },
  (ctx, canvas)=>{
    const cx = canvas.width/2, cy = canvas.height/2 - 40;
    ctx.beginPath(); ctx.arc(cx, cy, 110, 0, Math.PI*2); ctx.stroke();
  },
  (ctx, canvas)=>{
    const cx = canvas.width/2, cy = canvas.height/2 - 40;
    ctx.beginPath();
    for(let i=0;i<=200;i++){
      const t = i/200 * Math.PI * 4;
      const r = 20 + i*0.5;
      const x = cx + r*Math.cos(t);
      const y = cy + r*Math.sin(t)*0.6;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
];
const mirrorConfig = {
  canvasId: "mirrorCanvas",
  fade: true,
  fadeColor: "rgba(244,242,238,0.045)",
  strokeColor: "rgba(120,110,90,0.55)",
  actionBtnId: "newShape",
  drawGuide(ctx, canvas){
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(150,150,150,0.35)";
    ctx.lineWidth = 2;
    mirrorGuideShapes[Math.floor(Math.random()*mirrorGuideShapes.length)](ctx, canvas);
  },
  onAction(ctx, canvas){ mirrorConfig.drawGuide(ctx, canvas); }
};

// -- Écriture Non-Dominante : consigne texte, main gauche --
const leftwritePrompts = [
  "Trace ton prénom, de la main gauche",
  "Dessine une spirale, de la main gauche",
  "Trace des vagues, de la main gauche",
  "Écris les jours de la semaine, de la main gauche",
  "Dessine un cercle lentement, de la main gauche"
];
let leftwriteIndex = 0;
const leftwriteConfig = {
  canvasId: "leftwriteCanvas",
  fade: true,
  fadeColor: "rgba(244,242,238,0.045)",
  strokeColor: "rgba(120,110,90,0.55)",
  actionBtnId: "leftwriteNext",
  drawGuide(ctx, canvas){ ctx.clearRect(0,0,canvas.width, canvas.height); },
  onAction(ctx, canvas){
    leftwriteIndex = (leftwriteIndex + 1) % leftwritePrompts.length;
    document.getElementById("leftwriteHint").textContent = leftwritePrompts[leftwriteIndex];
    ctx.clearRect(0,0,canvas.width, canvas.height);
  }
};

// -- Gribouillage Libre : aucune consigne, aucun fondu --
const doodleConfig = {
  canvasId: "doodleCanvas",
  fade: false,
  strokeColor: "rgba(201,168,106,0.7)",
  actionBtnId: "doodleClear",
  drawGuide(ctx, canvas){ ctx.clearRect(0,0,canvas.width, canvas.height); },
  onAction(ctx, canvas){ ctx.clearRect(0,0,canvas.width, canvas.height); }
};

// ---------- YIN YOGA ----------
// Illustrations : silhouettes simples dessinées pour l'app (pas de photos/images externes)
const yinPoses = [
  { name: "Posture de l'enfant", cue: "Genoux écartés, bassin vers les talons, bras relâchés vers l'avant.",
    svg: '<circle cx="95" cy="50" r="7"/><path d="M88,50 L84,50 M89,54 L58,66 L58,88 M58,88 L48,92 M58,88 L68,92 M62,58 L20,78"/><circle class="pt" cx="20" cy="78" r="2.8"/><circle class="pt" cx="48" cy="92" r="2.8"/><circle class="pt" cx="68" cy="92" r="2.8"/>' },
  { name: "Papillon", cue: "Plantes de pieds jointes, dos rond, buste qui se penche doucement en avant.",
    svg: '<circle cx="60" cy="20" r="7"/><path d="M60,27 L60,52 M60,52 L30,56 M60,52 L90,56 M30,56 L55,72 M90,56 L65,72 M58,35 L55,68 M62,35 L65,68"/><circle class="pt" cx="55" cy="72" r="2.8"/><circle class="pt" cx="65" cy="72" r="2.8"/><circle class="pt" cx="55" cy="68" r="2.8"/><circle class="pt" cx="65" cy="68" r="2.8"/>' },
  { name: "Chenille", cue: "Jambes tendues devant toi, dos relâché, buste qui plie vers l'avant.",
    svg: '<circle cx="26" cy="60" r="7"/><path d="M26,64 L29,67 M32,62 L58,46 L110,44 M40,54 L95,50"/><circle class="pt" cx="110" cy="44" r="2.8"/><circle class="pt" cx="95" cy="50" r="2.8"/>' },
  { name: "Torsion couchée", cue: "Allongé, les genoux tombent d'un côté, les deux épaules restent au sol.",
    svg: '<circle cx="14" cy="48" r="7"/><path d="M14,42 L14,39 M21,48 L68,48 M42,48 L42,20 M42,48 L42,76 M68,48 L95,70 L108,58"/><circle class="pt" cx="42" cy="20" r="2.8"/><circle class="pt" cx="42" cy="76" r="2.8"/><circle class="pt" cx="108" cy="58" r="2.8"/>' },
  { name: "Dragon", cue: "Fente avant basse, les hanches s'enfoncent doucement vers le sol.",
    svg: '<circle cx="23" cy="26" r="7"/><path d="M30,26 L33,26 M23,33 L40,50 M40,50 L58,54 L52,80 M52,80 L68,82 M40,50 L72,58 L100,64 M30,40 L34,64"/><circle class="pt" cx="68" cy="82" r="2.8"/><circle class="pt" cx="100" cy="64" r="2.8"/><circle class="pt" cx="34" cy="64" r="2.8"/>' },
  { name: "Sphinx", cue: "Allongé sur le ventre, appui sur les avant-bras, poitrine ouverte.",
    svg: '<circle cx="92" cy="50" r="7"/><path d="M99,50 L102,50 M85,56 L26,58 L2,60 M78,56 L74,72 L58,74"/><circle class="pt" cx="2" cy="60" r="2.8"/><circle class="pt" cx="58" cy="74" r="2.8"/>' },
  { name: "Jambes au mur", cue: "Allongé, jambes levées à la verticale, bras relâchés le long du corps.",
    svg: '<circle cx="14" cy="80" r="7"/><path d="M14,74 L14,71 M21,80 L60,80 M60,80 L60,16 M34,80 L34,92"/><circle class="pt" cx="60" cy="16" r="2.8"/><circle class="pt" cx="34" cy="92" r="2.8"/>' },
  { name: "Œil de l'aiguille", cue: "Allongé, une cheville posée sur le genou opposé, jambe ramenée vers toi.",
    svg: '<circle cx="14" cy="56" r="7"/><path d="M14,50 L14,47 M21,56 L54,56 M54,56 L68,36 L84,42 M54,56 L74,50 L88,54"/><circle class="pt" cx="84" cy="42" r="2.8"/><circle class="pt" cx="88" cy="54" r="2.8"/>' },
  { name: "Demi-grenouille", cue: "Allongé sur le ventre, un talon ramené doucement vers la hanche.",
    svg: '<circle cx="14" cy="52" r="7"/><path d="M21,52 L24,52 M21,52 L70,52 L100,54 M21,52 L4,48 M70,52 L76,72 L58,62"/><circle class="pt" cx="100" cy="54" r="2.8"/><circle class="pt" cx="4" cy="48" r="2.8"/><circle class="pt" cx="58" cy="62" r="2.8"/>' },
  { name: "Selle", cue: "Assis entre tes talons, buste incliné en arrière si c'est confortable.",
    svg: '<circle cx="68" cy="26" r="7"/><path d="M61,26 L58,26 M50,58 L68,26 M50,58 L34,74 M50,58 L66,74 M34,74 L44,60 M66,74 L56,60 M58,40 L78,52"/><circle class="pt" cx="44" cy="60" r="2.8"/><circle class="pt" cx="56" cy="60" r="2.8"/><circle class="pt" cx="78" cy="52" r="2.8"/>' }
];
// 2min30 : suffisant pour amorcer le relâchement du tissu conjonctif visé par le yin yoga,
// tout en restant accessible pour une première pratique sans forcer.
const YIN_HOLD_SECONDS = 150;
function startYin(){
  let index = Math.floor(Math.random()*yinPoses.length);
  let remaining = YIN_HOLD_SECONDS;
  let paused = false;
  const ring = document.getElementById("yinRing");
  const nameEl = document.getElementById("yinPose");
  const cueEl = document.getElementById("yinCue");
  const illusEl = document.getElementById("yinIllus");
  const pauseBtn = document.getElementById("yinPauseBtn");
  const CIRC = 289;

  function render(){
    nameEl.textContent = yinPoses[index].name;
    cueEl.textContent = yinPoses[index].cue;
    illusEl.innerHTML = '<svg viewBox="0 0 120 100">' + yinPoses[index].svg + '</svg>';
  }
  function updateRing(){
    const pct = 1 - (remaining / YIN_HOLD_SECONDS);
    ring.setAttribute("stroke-dashoffset", CIRC - pct * CIRC);
  }
  function next(){
    index = (index + 1) % yinPoses.length;
    remaining = YIN_HOLD_SECONDS;
    render(); updateRing();
  }
  render(); updateRing();

  const interval = setInterval(()=>{
    if(paused) return;
    remaining--;
    updateRing();
    if(remaining <= 0) next();
  }, 1000);

  function togglePause(){
    paused = !paused;
    pauseBtn.textContent = paused ? "Reprendre" : "Pause";
  }
  pauseBtn.textContent = "Pause";
  pauseBtn.addEventListener("click", togglePause);
  document.getElementById("yinNextBtn").addEventListener("click", next);

  return () => {
    clearInterval(interval);
    pauseBtn.removeEventListener("click", togglePause);
  };
}

// ---------- BOL TIBÉTAIN (son synthétisé, aucun fichier) ----------
let bowlAudioCtx = null;
function initBowl(){
  const btn = document.getElementById("bowlBtn");
  const ripple = document.getElementById("bowlRipple");

  function strike(){
    if(!bowlAudioCtx) bowlAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = bowlAudioCtx;
    const now = ctx.currentTime;
    const freqs = [220, 329.6, 440, 554.4];
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.22, now + 0.4);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 24);
    master.connect(ctx.destination);

    freqs.forEach((f, i)=>{
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 1 / (i + 1.4);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 24);
    });

    ripple.style.transition = "none";
    ripple.style.opacity = "0.8";
    ripple.style.transform = "scale(1)";
    requestAnimationFrame(()=>{
      ripple.style.transition = "transform 4s ease-out, opacity 4s ease-out";
      ripple.style.transform = "scale(2.4)";
      ripple.style.opacity = "0";
    });
  }
  btn.addEventListener("click", strike);
  return () => { btn.removeEventListener("click", strike); };
}

// ---------- RESPIRATION ALTERNÉE ----------
// Cycle complet : inspire narine gauche -> expire narine gauche -> inspire narine droite -> expire narine droite
const ALT_PHASE_SECONDS = 5; // durée de chaque inspire / expire
function startAltBreath(){
  const dot = document.getElementById("altDot");
  const word = document.getElementById("altWord");
  const phaseEl = document.getElementById("altPhase");
  let step = 0; // 0: gauche/inspire, 1: gauche/expire, 2: droite/inspire, 3: droite/expire

  function render(){
    const side = step < 2 ? "gauche" : "droite";
    const isInspire = step % 2 === 0;
    dot.classList.toggle("right", side === "droite");
    word.style.opacity = 0;
    phaseEl.style.opacity = 0;
    setTimeout(()=>{
      word.textContent = side === "gauche" ? "Narine gauche" : "Narine droite";
      phaseEl.textContent = isInspire ? "Inspire" : "Expire";
      word.style.opacity = 0.95;
      phaseEl.style.opacity = 0.9;
    }, 150);
    if(navigator.vibrate) navigator.vibrate(isInspire ? 30 : 15);
  }
  word.style.transition = "opacity 1s ease";
  render();
  const interval = setInterval(()=>{
    step = (step + 1) % 4;
    render();
  }, ALT_PHASE_SECONDS * 1000);
  return () => { clearInterval(interval); if(navigator.vibrate) navigator.vibrate(0); };
}

// ---------- MÉTRONOME TACTILE ----------
function startMetronome(){
  const dot = document.getElementById("metroDot");
  const ripple = document.getElementById("metroRipple");
  const PERIOD = 1400;

  function pulse(){
    dot.classList.add("pulse");
    if(navigator.vibrate) navigator.vibrate(15);
    setTimeout(()=> dot.classList.remove("pulse"), 500);
  }
  pulse();
  const interval = setInterval(pulse, PERIOD);

  function onTap(){
    ripple.style.transition = "none";
    ripple.style.opacity = "0.6";
    ripple.style.transform = "scale(1)";
    requestAnimationFrame(()=>{
      ripple.style.transition = "transform 0.6s ease-out, opacity 0.6s ease-out";
      ripple.style.transform = "scale(1.8)";
      ripple.style.opacity = "0";
    });
  }
  dot.addEventListener("pointerdown", onTap);

  return () => {
    clearInterval(interval);
    dot.removeEventListener("pointerdown", onTap);
  };
}

// ---------- RITUEL PRÉ-RÉUNION ----------
const RITUAL_PHASES = [
  { key: "decrochage", name: "1. Décrochage", duration: 185,
    text: "Ferme ton ordinateur ou tes écrans de travail. Étire-toi, relâche tes épaules, bois une gorgée d'eau. C'est le signal : la session de travail est suspendue." },
  { key: "cercle", name: "2. Cercle & Mantra", duration: 305, text: "" },
  { key: "nigoun", name: "3. Nigoun", duration: 245,
    text: "Ferme les yeux. Laisse-toi porter par la musique, sans rien faire d'autre." },
  { key: "retour", name: "4. Retour en douceur", duration: 185,
    text: "Reconnecte-toi calmement. Ouvre ton lien de réunion. Tu es centré, prêt à échanger." }
];
let ritualInterval = null;
let ritualBreathInterval = null;
let ritualPhaseIndex = 0;
let ritualRemaining = 0;
let ritualWaitingForAudio = false;

function ritualCheckShowPlay(){
  const btn = document.getElementById("ritualPlayBtn");
  if(!btn) return;
  const inNigounWait = currentScreen === "ritual" && RITUAL_PHASES[ritualPhaseIndex] &&
    RITUAL_PHASES[ritualPhaseIndex].key === "nigoun" && ritualWaitingForAudio;
  btn.style.display = (inNigounWait && tracks.length) ? "block" : "none";
}
function ritualDing(){
  if(!bowlAudioCtx) bowlAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = bowlAudioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 880;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.22, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.1);
}

function ritualFormatTime(s){
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}
function ritualRenderDots(){
  const dots = document.querySelectorAll("#ritualSteps .ritual-dot");
  dots.forEach((d, i)=>{
    d.classList.toggle("active", i === ritualPhaseIndex);
    d.classList.toggle("done", i < ritualPhaseIndex);
  });
}
function ritualStartBreath(){
  const circle = document.getElementById("ritualBreathCircle");
  const word = document.getElementById("ritualBreathWord");
  let expanding = true;
  function tick(){
    if(expanding){
      circle.classList.remove("contract"); circle.classList.add("expand");
      word.style.opacity = 0;
      setTimeout(()=>{ word.textContent = "Ribono"; word.style.opacity = 0.95; }, 150);
    } else {
      circle.classList.remove("expand"); circle.classList.add("contract");
      word.style.opacity = 0;
      setTimeout(()=>{ word.textContent = "Shel Olam"; word.style.opacity = 0.95; }, 150);
    }
    expanding = !expanding;
  }
  word.style.transition = "opacity 1s ease";
  tick();
  ritualBreathInterval = setInterval(tick, 5000);
}
function ritualStopBreath(){
  if(ritualBreathInterval){ clearInterval(ritualBreathInterval); ritualBreathInterval = null; }
}
function ritualStartPhase(i){
  ritualPhaseIndex = i;
  const phase = RITUAL_PHASES[i];
  ritualRemaining = phase.duration;
  document.getElementById("ritualPhaseTitle").textContent = phase.name;
  document.getElementById("ritualText").textContent = phase.text;
  document.getElementById("ritualTimer").textContent = ritualFormatTime(ritualRemaining);
  ritualRenderDots();

  const breathWrap = document.getElementById("ritualBreathWrap");
  if(phase.key === "cercle"){
    breathWrap.style.display = "flex";
    ritualStartBreath();
  } else {
    breathWrap.style.display = "none";
    ritualStopBreath();
  }
  if(phase.key === "nigoun"){
    if(tracks.length){
      ritualWaitingForAudio = false;
      playAudio();
    } else {
      ritualWaitingForAudio = true;
      document.getElementById("ritualText").textContent = "Choisis ta musique ci-dessous puis appuie sur lecture. Le décompte démarre à ce moment-là.";
    }
  } else {
    ritualWaitingForAudio = false;
  }
  ritualCheckShowPlay();
}
function ritualNextPhase(){
  ritualDing();
  const finished = RITUAL_PHASES[ritualPhaseIndex];
  if(finished.key === "nigoun" && !audioEl.paused) pauseAudio();
  if(ritualPhaseIndex < RITUAL_PHASES.length - 1){
    ritualStartPhase(ritualPhaseIndex + 1);
  } else {
    ritualFinish();
  }
}
function ritualFinish(){
  ritualStopBreath();
  if(ritualInterval){ clearInterval(ritualInterval); ritualInterval = null; }
  if(!audioEl.paused) pauseAudio();
  ritualWaitingForAudio = false;
  goTo("home");
}
function startRitual(){
  ritualStartPhase(0);
  ritualInterval = setInterval(()=>{
    if(ritualWaitingForAudio) return;
    ritualRemaining--;
    document.getElementById("ritualTimer").textContent = ritualFormatTime(ritualRemaining);
    if(ritualRemaining <= 0) ritualNextPhase();
  }, 1000);

  const skipBtn = document.getElementById("ritualSkipBtn");
  const stopBtn = document.getElementById("ritualStopBtn");
  const pickBtn = document.getElementById("ritualPickMusic");
  const onSkip = ()=> ritualNextPhase();
  const onStop = ()=> ritualFinish();
  const onPick = ()=> document.getElementById("pickFiles").click();
  const playBtn = document.getElementById("ritualPlayBtn");
  const onPlayBtn = ()=>{ if(tracks.length) playAudio(); };
  const onAudioPlay = ()=>{
    if(currentScreen === "ritual" && RITUAL_PHASES[ritualPhaseIndex].key === "nigoun" && ritualWaitingForAudio){
      ritualWaitingForAudio = false;
      document.getElementById("ritualText").textContent = RITUAL_PHASES[ritualPhaseIndex].text;
      ritualCheckShowPlay();
    }
  };
  skipBtn.addEventListener("click", onSkip);
  stopBtn.addEventListener("click", onStop);
  pickBtn.addEventListener("click", onPick);
  playBtn.addEventListener("click", onPlayBtn);
  audioEl.addEventListener("play", onAudioPlay);

  return () => {
    if(ritualInterval){ clearInterval(ritualInterval); ritualInterval = null; }
    ritualStopBreath();
    if(!audioEl.paused) pauseAudio();
    ritualWaitingForAudio = false;
    skipBtn.removeEventListener("click", onSkip);
    stopBtn.removeEventListener("click", onStop);
    pickBtn.removeEventListener("click", onPick);
    playBtn.removeEventListener("click", onPlayBtn);
    audioEl.removeEventListener("play", onAudioPlay);
  };
}

// ---------- ZMANIOT (Harish, Israël) ----------
// Nécessite internet : les horaires sont calculés par un service externe (Hebcal)
// plutôt que recalculés dans le code, pour garantir l'exactitude de ces horaires religieux.
const ZMAN_HARISH = { lat: 32.4636, lon: 35.0447, tzid: "Asia/Jerusalem" };
const ZMAN_LABELS = [
  { key: "alotHaShachar", label: "עלות השחר" },
  { key: "sunrise", label: "הנץ החמה" },
  { key: "sofZmanShma", label: "סוף זמן קריאת שמע" },
  { key: "sofZmanTfilla", label: "סוף זמן תפילה" },
  { key: "chatzot", label: "חצות" },
  { key: "minchaGedola", label: "מנחה גדולה" },
  { key: "minchaKetana", label: "מנחה קטנה" },
  { key: "plagHaMincha", label: "פלג המנחה" },
  { key: "sunset", label: "שקיעה" },
  { key: "tzeit85deg", label: "צאת הכוכבים" }
];
let zmanNotifyState = { sofZmanShma: true, sunset: true };
let zmanTimesCache = null;
let zmanCheckInterval = null;
let zmanNotifiedToday = {};

function zmanFormatTime(iso){
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: ZMAN_HARISH.tzid });
}
function zmanTodayParts(){
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}
function fetchZmanim(){
  const { y, m, d } = zmanTodayParts();
  const dateStr = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  const zUrl = "https://www.hebcal.com/zmanim?cfg=json&latitude=" + ZMAN_HARISH.lat +
    "&longitude=" + ZMAN_HARISH.lon + "&tzid=" + ZMAN_HARISH.tzid + "&date=" + dateStr;
  const hUrl = "https://www.hebcal.com/converter?cfg=json&gy=" + y + "&gm=" + m + "&gd=" + d + "&g2h=1";
  return Promise.all([fetch(zUrl).then(r => r.json()), fetch(hUrl).then(r => r.json())])
    .then(([zJson, hJson]) => ({ times: zJson.times, hebrew: hJson.hebrew, events: hJson.events || [] }));
}
function zmanRenderList(times){
  const list = document.getElementById("zmanList");
  list.innerHTML = "";
  ZMAN_LABELS.forEach((z)=>{
    const iso = times[z.key];
    if(!iso) return;
    const row = document.createElement("div");
    row.className = "zman-row";
    row.setAttribute("data-key", z.key);
    const bellOn = !!zmanNotifyState[z.key];
    row.innerHTML = '<span class="zman-time"><span class="zman-tag" style="display:none;">בקרוב</span>' + zmanFormatTime(iso) + '</span>' +
      '<span class="zman-name">' + z.label +
      '<span class="zman-bell' + (bellOn ? " on" : "") + '" data-key="' + z.key + '">🔔</span></span>';
    list.appendChild(row);
  });
  list.querySelectorAll(".zman-bell").forEach((bell)=>{
    bell.addEventListener("click", onZmanBellClick);
  });
  zmanUpdateHighlight();
}
function zmanUpdateHighlight(){
  if(!zmanTimesCache) return;
  const now = new Date();
  let nextKey = null;
  for(const z of ZMAN_LABELS){
    const iso = zmanTimesCache[z.key];
    if(!iso) continue;
    if(new Date(iso) > now){ nextKey = z.key; break; }
  }
  document.querySelectorAll("#zmanList .zman-row").forEach((row)=>{
    const key = row.getAttribute("data-key");
    const iso = zmanTimesCache[key];
    const isPast = iso && new Date(iso) <= now;
    const isNext = key === nextKey;
    row.classList.toggle("past", isPast && !isNext);
    row.classList.toggle("next", isNext);
    const tag = row.querySelector(".zman-tag");
    if(tag) tag.style.display = isNext ? "inline-block" : "none";
  });
}
function onZmanBellClick(e){
  const key = e.currentTarget.getAttribute("data-key");
  zmanNotifyState[key] = !zmanNotifyState[key];
  e.currentTarget.classList.toggle("on", zmanNotifyState[key]);
  if(zmanNotifyState[key] && "Notification" in window && Notification.permission === "default"){
    Notification.requestPermission();
  }
}
// Sur mobile (Android/iOS), le constructeur `new Notification(...)` échoue systématiquement :
// il faut passer par le service worker déjà enregistré (sw.js) via showNotification().
// Sur desktop, les deux fonctionnent ; on utilise le service worker partout quand il est
// disponible, et on ne retombe sur `new Notification` qu'en tout dernier recours.
function zmanShowNotification(title, options){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, options)).catch(() => {
      try{ new Notification(title, options); } catch(e){ /* non supporté ici, on abandonne silencieusement */ }
    });
  } else {
    try{ new Notification(title, options); } catch(e){ /* non supporté ici, on abandonne silencieusement */ }
  }
}

// L'alerte doit prévenir 15 minutes avant l'heure du zman, pas au moment même.
const ZMAN_NOTIFY_ADVANCE_MS = 15 * 60 * 1000;
function zmanCheckNotifications(){
  if(!zmanTimesCache) return;
  if(!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const todayStr = now.toDateString();
  ZMAN_LABELS.forEach((z)=>{
    if(!zmanNotifyState[z.key]) return;
    const iso = zmanTimesCache[z.key];
    if(!iso) return;
    const t = new Date(iso);
    const diffMs = t - now;
    // Fenêtre d'une minute autour du seuil "15 minutes avant" (la vérification tourne
    // toutes les 20s) : on notifie une seule fois par zman et par jour, dès que le temps
    // restant passe sous 15 min, tant qu'il reste au moins 14 min.
    if(diffMs <= ZMAN_NOTIFY_ADVANCE_MS && diffMs > ZMAN_NOTIFY_ADVANCE_MS - 60000 && zmanNotifiedToday[z.key] !== todayStr){
      zmanShowNotification(z.label, { body: "Dans 15 min (" + zmanFormatTime(iso) + ")", icon: "icons/icon-192.png" });
      zmanNotifiedToday[z.key] = todayStr;
    }
  });
}
function startZmanim(){
  const statusEl = document.getElementById("zmanStatus");
  statusEl.textContent = "Chargement des horaires...";
  fetchZmanim().then((data)=>{
    zmanTimesCache = data.times;
    document.getElementById("zmanHebrewDate").textContent = data.hebrew || "—";
    document.getElementById("zmanParasha").textContent = data.events[0] || "";
    statusEl.textContent = "";
    zmanRenderList(data.times);
  }).catch(()=>{
    statusEl.textContent = "Impossible de charger les horaires (vérifie ta connexion internet).";
  });

  zmanCheckInterval = setInterval(()=>{
    zmanCheckNotifications();
    zmanUpdateHighlight();
  }, 20000);

  const testBtn = document.getElementById("zmanTestBtn");
  const testStatus = document.getElementById("zmanTestStatus");
  const onTest = () => {
    if(!("Notification" in window)){
      testStatus.textContent = "Les notifications ne sont pas supportées sur ce navigateur.";
      return;
    }
    if(Notification.permission === "denied"){
      testStatus.textContent = "Notifications bloquées : autorise-les dans les réglages de ton téléphone pour cette app, puis réessaie.";
      return;
    }
    if(Notification.permission === "default"){
      Notification.requestPermission().then((perm)=>{
        if(perm === "granted"){
          zmanShowNotification("Test Cerveau Droit", { body: "Si tu vois ceci, les notifications fonctionnent." });
          testStatus.textContent = "Notification envoyée — regarde en haut de ton écran.";
        } else {
          testStatus.textContent = "Permission refusée.";
        }
      });
      return;
    }
    zmanShowNotification("Test Cerveau Droit", { body: "Si tu vois ceci, les notifications fonctionnent." });
    testStatus.textContent = "Notification envoyée — regarde en haut de ton écran.";
  };
  testBtn.addEventListener("click", onTest);

  return () => {
    if(zmanCheckInterval){ clearInterval(zmanCheckInterval); zmanCheckInterval = null; }
    testBtn.removeEventListener("click", onTest);
  };
}

// ---------- CHOULHAN AROUKH (siman 304, seif par seif) ----------
// Sources : Choulhan Aroukh (R. Yossef Karo, m. 1575) et Michna Beroura (Hafets Haïm, m. 1933),
// tous deux dans le domaine public. Texte hébreu/araméen récupéré via l'API Sefaria,
// traduction française phrase par phrase faite pour cette app (annotations araméennes entre parenthèses).
// Rambam (Rabbi Moché ben Maïmon, m. 1204), Michné Torah, Hilkhot Chabbat, chapitre 20, halakha 14 —
// domaine public. C'est l'unique halakha du Rambam qui traite de tout le sujet des seifim 1 à 3
// du siman 304 (le Rambam ne détaille pas cas par cas comme le Choulhan Aroukh) : elle est donc
// affichée à l'identique pour les 3 seifim, comme source commune.
const RAMBAM_304_14 = [
  { he: "כְּשֵׁם שֶׁאָדָם מְצֻוֶּה עַל שְׁבִיתַת בְּהֶמְתּוֹ בְּשַׁבָּת, כָּךְ הוּא מְצֻוֶּה עַל שְׁבִיתַת עַבְדּוֹ וַאֲמָתוֹ.", fr: "De même qu'un homme est commandé au sujet du repos de son animal le Chabbat, de même il est commandé au sujet du repos de son esclave et de sa servante." },
  { he: "וְאַף עַל פִּי שֶׁהֵן בְּנֵי דַּעַת וּלְדַעַת עַצְמָן עוֹשִׂין, מִצְוָה עָלֵינוּ לְשָׁמְרָן וּלְמָנְעָן מֵעֲשִׂיַּת מְלָאכָה בְּשַׁבָּת, שֶׁנֶּאֱמַר (שמות כג יב): לְמַעַן יָנוּחַ שׁוֹרְךָ וַחֲמֹרֶךָ וְיִנָּפֵשׁ בֶּן אֲמָתְךָ וְהַגֵּר.", fr: "Et bien qu'ils soient doués de raison et agissent selon leur propre volonté, c'est un commandement pour nous de les surveiller et de les empêcher de faire un travail le Chabbat, comme il est dit (Exode 23:12) : « afin que ton bœuf et ton âne se reposent, et que le fils de ta servante et l'étranger reprennent leur souffle »." },
  { he: "עֶבֶד וְאָמָה שֶׁאָנוּ מְצֻוִּין עַל שְׁבִיתָתָן הֵם עֲבָדִים שֶׁמָּלוּ וְטָבְלוּ לְשֵׁם עַבְדוּת וְקִבְּלוּ מִצְוֹת שֶׁהָעֲבָדִים חַיָּבִין בָּהֶן.", fr: "L'esclave et la servante au sujet du repos desquels nous sommes commandés sont ceux qui ont été circoncis et immergés en vue de leur statut d'esclave, et qui ont accepté les commandements auxquels les esclaves sont tenus." },
  { he: "אֲבָל עֲבָדִים שֶׁלֹּא מָלוּ וְלֹא טָבְלוּ אֶלָּא קִבְּלוּ עֲלֵיהֶם שֶׁבַע מִצְוֺת שֶׁנִּצְטַוּוּ בְּנֵי נֹחַ בִּלְבַד, הֲרֵי הֵן כְּגֵר תּוֹשָׁב, וּמֻתָּרִין לַעֲשׂוֹת מְלָאכָה בְּשַׁבָּת לְעַצְמָן בְּפַרְהֶסְיָא כְּיִשְׂרָאֵל בְּחֹל.", fr: "Mais les esclaves qui n'ont été ni circoncis ni immergés, et ont seulement accepté les sept lois commandées aux descendants de Noé, sont comme un guer tochav <span class='ca-aram'>(גֵּר תּוֹשָׁב [guer tochav] — hébreu, « résident étranger » ayant accepté les 7 lois noahides)</span>, et il leur est permis de faire un travail le Chabbat pour eux-mêmes, ouvertement, comme un Juif en semaine." },
  { he: "וְאֵין מְקַבְּלִין גֵּר תּוֹשָׁב אֶלָּא בִּזְמַן שֶׁהַיּוֹבֵל נוֹהֵג.", fr: "Et l'on n'accepte un guer tochav que lorsque le [jubilé] est en vigueur." },
  { he: "הוֹאִיל וְגֵר תּוֹשָׁב עוֹשֶׂה מְלָאכָה לְעַצְמוֹ בְּשַׁבָּת וְגֵר צֶדֶק הֲרֵי הוּא כְּיִשְׂרָאֵל לְכָל דָּבָר, בְּמִי נֶאֱמַר וְיִנָּפֵשׁ בֶּן אֲמָתְךָ וְהַגֵּר?", fr: "Puisque le guer tochav travaille pour lui-même le Chabbat, et que le guer tsédek <span class='ca-aram'>(גֵּר צֶדֶק [guer tsédek] — hébreu, « converti » à part entière)</span> est en tout point comme un Juif — à propos de qui donc est-il dit « et que le fils de ta servante et l'étranger reprennent leur souffle » ?" },
  { he: "זֶה גֵּר תּוֹשָׁב שֶׁהוּא לְקִיטוֹ וּשְׂכִירוֹ שֶׁל יִשְׂרָאֵל כְּמוֹ בֶּן אֲמָתוֹ, שֶׁלֹּא יַעֲשֶׂה מְלָאכָה לְיִשְׂרָאֵל רַבּוֹ בְּשַׁבָּת, אֲבָל לְעַצְמוֹ עוֹשֶׂה.", fr: "C'est le guer tochav qui est l'ouvrier saisonnier <span class='ca-aram'>(לְקִיטוֹ [lekito] — hébreu mishnique, « son ouvrier engagé pour la récolte/saison »)</span> ou le salarié d'un Juif, comme le fils de sa servante — il ne doit pas faire de travail pour le Juif qui l'emploie le Chabbat, mais il peut travailler pour lui-même." },
  { he: "וַאֲפִלּוּ הָיָה הַגֵּר זֶה עַבְדּוֹ, הֲרֵי זֶה עוֹשֶׂה לְעַצְמוֹ.", fr: "Et même si ce guer était son esclave, il travaille tout de même pour lui-même." }
];
const RAMBAM_304_REF = "משנה תורה · הלכות שבת · פרק כ׳ הלכה י״ד";

// Structure multi-simanim : permet d'ajouter la suite des simanim de Hilkhot Chabbat
// (305, 306, ...) sans casser la progression "Lu" qui avance en continu à travers tous les seifim.
const CHOULHAN_SHABBAT = {
  simanim: [
    {
      num: 304,
      numHe: "שד",
      simTitle: "על איזה עבד מצווה על שביתתו — À propos de quel esclave le maître est commandé sur son repos",
      seifim: [
    {
      num: 1,
      badge: "deoraita",
      badgeLabel: "דאורייתא · interdiction de la Torah",
      ca: [
        { he: "אָדָם מְצֻוֶּה עַל שְׁבִיתַת עַבְדּוֹ", fr: "Un homme (maître) est commandé au sujet du repos de son esclave," },
        { he: "שֶׁמָּל וְטָבַל לְשֵׁם עַבְדּוּת", fr: "qui a été circoncis et immergé au mikvé en vue de son statut d'esclave," },
        { he: "וְקִבֵּל עָלָיו מִצְוֺת הַנּוֹהֲגוֹת בְּעֶבֶד", fr: "et a accepté les commandements qui s'appliquent à un esclave." },
        { he: "אֲבָל אִם לֹא מָל וְטָבַל אֶלָּא קִבֵּל עָלָיו שֶׁבַע מִצְוֺת בְּנֵי נֹחַ", fr: "Mais s'il n'a pas été circoncis ni immergé, et a seulement accepté les sept lois noahides," },
        { he: "הֲרֵי הוּא כְּגֵר תּוֹשָׁב וּמֻתָּר לַעֲשׂוֹת מְלָאכָה בְּשַׁבָּת לְעַצְמוֹ אֲבָל לֹא לְרַבּוֹ", fr: "il est alors comme un guer tochav (résident non-juif ayant accepté les 7 lois), et il lui est permis de travailler le Chabbat pour lui-même, mais pas pour son maître." },
        { he: "וְאָסוּר לְכָל יִשְׂרָאֵל לוֹמַר לוֹ לַעֲשׂוֹת מְלָאכָה בְּשַׁבָּת לְצֹרֶךְ יִשְׂרָאֵל אֲפִלּוּ מִי שֶׁאֵינוֹ רַבּוֹ", fr: "Et il est interdit à tout Juif — même à celui qui n'est pas son maître — de lui demander de faire un travail le Chabbat pour un besoin juif." },
        { he: "וְאִם לֹא קִבֵּל עָלָיו שׁוּם מִצְוָה אֶלָּא עֲדַיִן הוּא עַכּוּ״ם גָּמוּר, דִּינוֹ שָׁוֶה לְקִבֵּל עָלָיו שֶׁבַע מִצְוֺת", fr: "Et s'il n'a accepté aucun commandement et reste un idolâtre complet <span class='ca-aram'>(עַכּוּ״ם [akoum] — acronyme de \"עובד כוכבים ומזלות\", terme rabbinique désignant un non-Juif)</span>, sa loi équivaut à celui qui a accepté les sept lois." },
        { he: "וּלְפִי זֶה צָרְכֵי חוֹלֶה שֶׁאֵין בּוֹ סַכָּנָה דְּקַיְימָא לָן אוֹמֵר לְעַכּוּ״ם וְעוֹשֶׂה", fr: "Et selon cela, pour les besoins d'un malade sans danger de mort, au sujet duquel <span class='ca-aram'>nous retenons (דְּקַיְימָא לָן [dekayema lan] — araméen, \"que nous établissons comme loi constante\")</span> qu'on peut le dire à un non-Juif et qu'il le fasse." },
        { he: "אָסוּר לוֹמַר לְעֶבֶד יִשְׂרָאֵל אֲפִילּוּ הוּא עַכּוּ״ם, דְּכֵיוָן דִּמְלֶאכֶת הָעֶבֶד אָסוּר מִן הַתּוֹרָה", fr: "Il est interdit de le dire à l'esclave d'un Juif, même s'il est idolâtre, <b>car le travail de l'esclave est interdit par la Torah</b> <span class='ca-aram'>(דְּכֵיוָן [dekeivan] — araméen, \"puisque, étant donné que\")</span>," },
        { he: "לֹא הֻתְּרָה בְּדָבָר שֶׁאֵין בּוֹ פִּקּוּחַ נֶפֶשׁ", fr: "et cela n'a pas été permis là où il n'y a pas de danger de mort." },
        { he: "וְיֵשׁ חוֹלְקִים וּמַתִּירִים בָּזֶה", fr: "Et il y a ceux qui contestent et permettent cela." },
        { he: "וּמִכָּל מָקוֹם אִם הָיָה עוֹשֶׂה מְלֶאכֶת רַבּוֹ שֶׁלֹּא מִדַּעְתּוֹ וְנִכָּר שֶׁאֵינוֹ עוֹשֶׂה לְדַעְתּוֹ מֻתָּר", fr: "Et de toute façon <span class='ca-aram'>(וּמִכָּל מָקוֹם [oumikol makom] — litt. \"et de tout endroit\", c.-à-d. \"en tout cas, néanmoins\")</span>, s'il faisait le travail de son maître sans son consentement, et qu'il est manifeste qu'il ne le fait pas sciemment pour lui, c'est permis," },
        { he: "וְאֵינוֹ צָרִיךְ לְהַפְרִישׁוֹ (אֲפִלּוּ קִבֵּל עָלָיו שֶׁבַע מִצְוֺת)", fr: "et il n'est pas nécessaire de l'arrêter (même s'il a accepté les sept lois)." },
        { he: "וּלְיִשְׂרָאֵל אַחֵר שֶׁאֵינוֹ רַבּוֹ, אֲפִלּוּ עוֹשֶׂה לְדַעַת יִשְׂרָאֵל, מֻתָּר כָּל שֶׁאֵין שָׁם אֲמִירַת יִשְׂרָאֵל", fr: "Et pour un autre Juif qui n'est pas son maître, même s'il agit sciemment pour ce Juif, c'est permis tant que ce Juif n'a rien dit." },
        { he: "וּבִלְבַד שֶׁלֹּא יֵהָנֶה יִשְׂרָאֵל בְּשַׁבָּת מֵאוֹתָהּ מְלָאכָה", fr: "à condition que le Juif ne profite pas le Chabbat de ce travail." },
        { he: "וְיֵשׁ אוֹמְרִים שֶׁכָּל שֶׁלֹּא קִבֵּל עָלָיו שֶׁבַע מִצְוֺת בְּנֵי נֹחַ, כֵּיוָן דְּעַכּוּ״ם גָּמוּר הוּא, אֵין רַבּוֹ מֻזְהָר עָלָיו", fr: "Et il y a ceux qui disent que tant qu'il n'a pas accepté les sept lois noahides — puisqu'il <span class='ca-aram'>(דְּ... [de] — araméen, \"puisque, que\")</span> est un idolâtre complet — son maître n'est pas averti (responsable) à son sujet." },
        { he: "וּלְפִי זֶה צָרְכֵי חוֹלֶה שֶׁאֵין בּוֹ סַכָּנָה וְכֵן צָרְכֵי מֵתִים בְּיוֹם טוֹב רִאשׁוֹן מֻתָּר לוֹמַר לָהֶם לַעֲשׂוֹתוֹ", fr: "et selon cela, pour les besoins d'un malade sans danger de mort, ainsi que pour les besoins des défunts le premier jour de Yom Tov, il est permis de le leur demander." },
        { he: "הַגָּה: וְכָל עֶבֶד שֶׁמְּצֻוֶּה עַל שְׁבִיתָתוֹ, אָסוּר לָצֵאת בְּחוֹתָם שֶׁעָשָׂה לוֹ רַבּוֹ לְהַרְאוֹת בּוֹ שֶׁהוּא עַבְדּוֹ", fr: "Glose (Rama) : Et tout esclave pour le repos duquel on est commandé, il lui est interdit de sortir avec le sceau que son maître lui a fait pour montrer par là qu'il est son esclave." },
        { he: "וְאִם הוּא שֶׁל טִיט, מֻתָּר לָצֵאת בּוֹ כְּשֶׁתָּלוּי בְּצַוָּארוֹ, אֲבָל לֹא בִּכְסוּתוֹ", fr: "Et s'il est en argile, il est permis de sortir avec lorsqu'il est suspendu à son cou, mais pas attaché à son vêtement." },
        { he: "וּבְשֶׁל מַתֶּכֶת בְּכָל עִנְיָן אָסוּר (טוּר)", fr: "Et s'il est en métal, c'est interdit en tout cas (Tour)." },
        { he: "וְאִם הָעֶבֶד עָשָׂה הַחוֹתָם לְעַצְמוֹ, אֲפִלּוּ בְּשֶׁל טִיט, בְּכָל עִנְיָן אָסוּר (הַמַּגִּיד פֶּרֶק י״ט)", fr: "Et si l'esclave a fait le sceau lui-même, même en argile, c'est interdit en tout cas (Maguid Michné, chapitre 19)." }
      ],
      resumeCA: "Le maître doit empêcher son esclave/serviteur non-juif de travailler pour un Juif le Chabbat — obligation d'origine biblique. Interdiction aussi de porter un sceau métallique ou attaché au vêtement.",
      mb: [
        { he: "אָדָם וְכוּ׳ — וּכְדֵי לְהָקֵל עַל הַמְּעַיֵּן לֵידַע טַעַם חִלּוּקֵי הַדִּינִים הַמְבוֹאָרִים בְּסִימָן זֶה, אַקְדִּים הַקְדָּמָה קְטַנָּה, וּכְפִי מַה שֶּׁמְּבוֹאָר בַּגְּמָרָא וּפוֹסְקִים.", fr: "<b>Note 1.</b> « Un homme, etc. » — Afin de faciliter la compréhension des différences de lois exposées dans ce siman, je poserai une petite introduction, conforme à ce qui est expliqué dans la Guemara et les décisionnaires." },
        { he: "דְּהִנֵּה תְּרֵי קְרָאֵי כְּתִיבֵי חַד: לְמַעַן יָנוּחַ עַבְדְּךָ וַאֲמָתְךָ כָּמוֹךָ — זֶה קָאֵי עַל עֶבֶד שֶׁמָּל וְטָבַל לְשֵׁם עַבְדּוּת וְקִבֵּל עָלָיו כָּל מִצְוֺת עֲבָדִים, דְּהַיְנוּ כָּל מַה שֶּׁאִשָּׁה חַיֶּבֶת, וְאִם כֵּן גַּם מִצְוַת שַׁבָּת בִּכְלָל, וְאָסוּר לַעֲשׂוֹת מְלָאכָה בְּשַׁבָּת.", fr: "Voici : deux versets sont écrits <span class='ca-aram'>(תְּרֵי קְרָאֵי כְּתִיבֵי [terei kra'ei ketivei] — araméen, « deux versets sont écrits »)</span>. L'un : « afin que ton serviteur et ta servante se reposent comme toi » (Dt 5:14) — celui-ci concerne <span class='ca-aram'>(קָאֵי [ka'ei] — araméen, « se rapporte à »)</span> l'esclave qui a été circoncis et immergé au mikvé en vue de son statut d'esclave, et a accepté sur lui tous les commandements des esclaves, c'est-à-dire tout ce à quoi une femme est tenue — et donc aussi le commandement du Chabbat en général —, si bien qu'il lui est interdit de faire un travail le Chabbat." },
        { he: "וְאָתֵי הַאי קְרָא לְאוֹרוּיֵי דִּשְׁבִיתַת הָעֶבֶד מוּטָל גַּם עַל רַבּוֹ, שֶׁהוּא מְצֻוֶּה עָלָיו לְמָנְעוֹ מֵעֲשׂוֹת מְלָאכָה, אֲפִלּוּ לְצֹרֶךְ עַצְמוֹ שֶׁל הָעֶבֶד.", fr: "Et ce verset vient enseigner <span class='ca-aram'>(לְאוֹרוּיֵי [le'orouyei] — araméen, « pour enseigner »)</span> que le repos de l'esclave incombe aussi à son maître, qui est commandé de l'empêcher de faire un travail, même pour le propre besoin de l'esclave." },
        { he: "וְעוֹד כְּתִיב קְרָא: וְיִנָּפֵשׁ בֶּן אֲמָתְךָ וְהַגֵּר — וְדָרְשׁוּ חֲזַ״ל דְּקָאֵי עַל עֶבֶד הַקָּנוּי לְיִשְׂרָאֵל קִנְיַן הַגּוּף, אֲבָל לֹא מָל וְטָבַל, רַק קִבֵּל עָלָיו שֶׁבַע מִצְוֺת בְּנֵי נֹחַ.", fr: "Et de plus il est écrit un autre verset : « et que le fils de ta servante et l'étranger reprennent leur souffle » (Ex 23:12) — et nos sages ont enseigné que celui-ci concerne l'esclave acquis à un Juif par acquisition corporelle, mais qui n'a pas été circoncis ni immergé, et a seulement accepté les sept lois noahides." },
        { he: "דְּגַם לָזֶה צָרִיךְ רַבּוֹ לְמָנְעוֹ מִלַּעֲשׂוֹת מְלָאכָה עֲבוּרוֹ בְּשַׁבָּת, וְהוּא הַדִּין דְּאָסוּר מִן הַתּוֹרָה לְכָל יִשְׂרָאֵל לְצַוּוֹת לוֹ לַעֲשׂוֹת מְלָאכָה עֲבוּרָם בְּשַׁבָּת.", fr: "Car pour celui-ci aussi, son maître doit l'empêcher de faire un travail pour lui le Chabbat ; et de même, il est interdit par la Torah à tout Juif de lui ordonner de faire un travail pour lui le Chabbat." },
        { he: "אֲבָל לְעַצְמוֹ מֻתָּר עֶבֶד כָּזֶה לַעֲשׂוֹת מְלָאכָה בְּשַׁבָּת, כֵּיוָן דְּשַׁבָּת אֵינוֹ נִכְלָל תּוֹךְ שֶׁבַע מִצְוֺת בְּנֵי נֹחַ, וְדִינוֹ כְּגֵר תּוֹשָׁב דְּאֵינוֹ מֻזְהָר עַל הַשַּׁבָּת.", fr: "Mais pour lui-même, un tel esclave a le droit de faire un travail le Chabbat, puisque le Chabbat n'est pas inclus dans les sept lois noahides, et sa loi est celle d'un guer tochav, qui n'est pas averti au sujet du Chabbat." },
        { he: "וּמִכָּל מָקוֹם אָסוּר מֵהַתּוֹרָה לְיִשְׂרָאֵל לְצַוּוֹתוֹ לַעֲשׂוֹת מְלָאכָה עֲבוּרוֹ, וּכְדִכְתִיב וְיִנָּפֵשׁ בֶּן אֲמָתְךָ וְהַגֵּר.", fr: "Et néanmoins, il est interdit par la Torah à un Juif de lui ordonner de faire un travail pour lui, comme il est écrit : « et que le fils de ta servante et l'étranger reprennent leur souffle »." },
        { he: "וְעֶבֶד הַקָּנוּי לְיִשְׂרָאֵל קִנְיַן גּוּף, וְלֹא מָל וְלֹא טָבַל, וְגַם לֹא קִבֵּל עָלָיו אֲפִלּוּ שֶׁבַע מִצְוֺת בְּנֵי נֹחַ — בָּזֶה נֶחְלְקוּ הַפּוֹסְקִים אִם גַּם עַל זֶה מְצֻוִּים אָנוּ עַל שְׁבִיתָתוֹ, וּכְמוֹ שֶׁיִּתְבָּאֵר.", fr: "Et quant à l'esclave acquis à un Juif par acquisition corporelle, qui n'a été ni circoncis ni immergé, et n'a même pas accepté les sept lois noahides — sur ce cas les décisionnaires sont en désaccord : sommes-nous aussi commandés sur son repos ? Comme cela sera expliqué [aux seifim suivants]." },
        { he: "עַל שְׁבִיתַת עַבְדּוֹ — דְּמִצְוָה עַל רַבּוֹ לְשָׁמְרוֹ וּלְמָנְעוֹ מֵעֲשׂוֹת מְלָאכָה, אֲפִלּוּ לְצֹרֶךְ עַצְמוֹ, וְכַנַּ״ל.", fr: "<b>Note 2.</b> « Sur le repos de son esclave » — car c'est un commandement pour le maître de le surveiller et de l'empêcher de faire un travail, même pour son propre besoin, comme dit plus haut." },
        { he: "וּמֻתָּר לְהַשְׂכִּיר עַבְדּוֹ לְעַכּוּ״ם בִּימֵי הַחֹל, אִם מַתְנֶה עִמּוֹ שֶׁלֹּא יַעֲשֶׂה בּוֹ מְלָאכָה בְּשַׁבָּת, וְלֹא דָּמֵי לִבְהֶמְתּוֹ הַמְבוֹאָר לְעֵיל בְּסִימָן רמ״ו סָעִיף ג׳ דְּאָסוּר לְהַשְׂכִּירָהּ לְעַכּוּ״ם בְּכִי הַאי גַוְונָא, דְּאֵין הָעַכּוּ״ם נֶאֱמָן עַל כָּךְ, דְּהָכָא הָעַכּוּ״ם לֹא יַעֲשֶׂה מְלָאכָה בְּעַל כָּרְחוֹ שֶׁל עֶבֶד, וְיֵשׁ לָעֶבֶד נֶאֱמָנוּת עַל זֶה [פְּרִי מְגָדִים].", fr: "Et il est permis de louer son esclave à un non-Juif en semaine, à condition de stipuler avec lui qu'il ne fera pas de travail le Chabbat — ce qui diffère du cas de son animal, exposé plus haut au siman 246:3, où il est interdit de la louer à un non-Juif dans un cas semblable <span class='ca-aram'>(בְּכִי הַאי גַוְונָא [bekhi hai gavna] — araméen, « dans un cas semblable »)</span>, car le non-Juif n'est pas fiable sur ce point ; ici, en revanche, le non-Juif n'agira pas contre la volonté de l'esclave, et l'esclave, lui, est fiable sur ce point [Pri Meguidim]." },
        { he: "הַנּוֹהֲגוֹת בְּעֶבֶד — דְּהַיְנוּ כָּל הַמִּצְוֺת שֶׁהָאִשָּׁה חַיֶּבֶת.", fr: "<b>Note 3.</b> « Qui s'appliquent à un esclave » — c'est-à-dire tous les commandements auxquels une femme est tenue." },
        { he: "הֲרֵי הוּא כְּגֵר תּוֹשָׁב — גֵּר תּוֹשָׁב מִקְרֵי כָּל שֶׁקִּבֵּל עָלָיו לְקַיֵּם שֶׁבַע מִצְוֺת בְּנֵי נֹחַ, וְשֶׁלֹּא לַעֲבֹד עֲבוֹדָה זָרָה, אֲפִלּוּ בְּשִׁתּוּף.", fr: "<b>Note 4.</b> « Il est comme un guer tochav » — on appelle guer tochav quiconque a accepté de respecter les sept lois noahides, et de ne pas pratiquer l'idolâtrie, même par association [avec D.ieu]." },
        { he: "לְעַצְמוֹ — הַיְנוּ מְלֶאכֶת עַצְמוֹ, כְּגוֹן תְּפִירַת בְּגָדָיו וְתִקּוּן מִנְעָלָיו וְכַיּוֹצֵא בָּזֶה, אוֹ שֶׁעוֹשֶׂה לְהִשְׂתַּכֵּר כְּדֵי שֶׁיִּהְיוּ לוֹ מְזוֹנוֹתָיו בְּרֶוַח יָתֵר עַל הַסְפָּקַת אֲדוֹנָיו.", fr: "<b>Note 5.</b> « Pour lui-même » — c'est-à-dire son propre travail, comme coudre ses vêtements et réparer ses chaussures et similaire, ou bien travailler pour gagner de quoi avoir sa nourriture en surplus de ce que fournit son maître." },
        { he: "אֲבָל לֹא לְרַבּוֹ — הַיְנוּ אֲפִלּוּ לֹא צִוָּהוּ רַבּוֹ בְּהֶדְיָא עַל הַמְּלָאכָה, גַּם כֵּן אָסוּר, דְּמִסְתָּמָא עַל דַּעַת רַבּוֹ הוּא עוֹשֶׂה, וְהִזְהִירָה הַתּוֹרָה עַל זֶה לְמָנְעוֹ, וּכְדִכְתִיב וְיִנָּפֵשׁ בֶּן אֲמָתְךָ וְהַגֵּר, וְכַנַּ״ל בְּסָעִיף קָטָן א׳.", fr: "<b>Note 6.</b> « Mais pas pour son maître » — c'est-à-dire que même si son maître ne le lui a pas ordonné explicitement <span class='ca-aram'>(בְּהֶדְיָא [behadya] — araméen, « explicitement »)</span> au sujet du travail, c'est également interdit, car on présume <span class='ca-aram'>(מִסְתָּמָא [mistama] — araméen, « on présume »)</span> qu'il agit selon la volonté de son maître, et la Torah a averti à ce sujet de l'en empêcher, comme dit plus haut à la note 1." },
        { he: "וַאֲפִלּוּ מְלָאכָה דְּרַבָּנָן אָסוּר גַּם כֵּן לַעֲשׂוֹת בִּשְׁבִיל רַבּוֹ, וְיֵשׁ מְקִלִּין בָּזֶה אִם לֹא הִזְהִירוֹ רַבּוֹ בְּהֶדְיָא עַל זֶה, כֵּיוָן שֶׁהוּא רַק מְלָאכָה דְּרַבָּנָן.", fr: "Et même un travail qui n'est interdit que par les rabbins <span class='ca-aram'>(דְּרַבָּנָן [derabbanan] — araméen, « d'origine rabbinique »)</span> est également interdit de faire pour son maître ; et certains sont indulgents sur ce point si le maître ne l'a pas explicitement averti, puisqu'il ne s'agit que d'un travail d'origine rabbinique." },
        { he: "וְאָסוּר לְכָל יִשְׂרָאֵל — הַיְנוּ מִן הַתּוֹרָה, דְּכֵיוָן דִּכְבָר קִבֵּל עָלָיו שֶׁבַע מִצְוֺת, לְכוּלֵי עָלְמָא הֲוֵי דִּינוֹ כְּגֵר תּוֹשָׁב, דְּאָסְרָה הַתּוֹרָה לְיִשְׂרָאֵל לַעֲשׂוֹת מְלָאכָה עַל יָדוֹ.", fr: "<b>Note 7.</b> « Et il est interdit à tout Juif » — c'est-à-dire par la Torah, car puisqu'il a déjà accepté les sept lois, de l'avis de tous <span class='ca-aram'>(לְכוּלֵי עָלְמָא [lekhulei alma] — araméen, « de l'avis de tous »)</span> sa loi est celle d'un guer tochav, et la Torah a interdit à un Juif de faire faire un travail par son intermédiaire." },
        { he: "וְאִם לֹא קִבֵּל — רְצוֹנוֹ לוֹמַר דְּהוּא הַדִּין גַּם כֵּן אִם לֹא קִבֵּל עָלָיו שׁוּם מִצְוָה, אַף עַל פִּי כֵן כֵּיוָן שֶׁהוּא עֶבֶד יִשְׂרָאֵל הַקָּנוּי לוֹ קִנְיַן הַגּוּף, סָבַר לָהּ דֵּעָה זוֹ דְּדִינוֹ שָׁוֶה לְקִבֵּל עָלָיו שֶׁבַע מִצְוֺת, וְאָסוּר לַעֲשׂוֹת מְלָאכָה בִּשְׁבִיל שׁוּם יִשְׂרָאֵל, וְכַנַּ״ל.", fr: "<b>Note 8.</b> « Et s'il n'a pas accepté » — c'est-à-dire que la même loi s'applique aussi s'il n'a accepté aucun commandement : néanmoins, puisqu'il est un esclave juif acquis par acquisition corporelle, cet avis considère que sa loi équivaut à celle de celui qui a accepté les sept lois, et il est interdit de faire un travail pour un quelconque Juif, comme dit plus haut." },
        { he: "לוֹמַר לְעֶבֶד יִשְׂרָאֵל — דְּדַוְקָא אֲמִירָה לִסְתָם עַכּוּ״ם, שֶׁאֵינוֹ אֶלָּא שְׁבוּת, הִתִּירוּ בִּדְבָרִים אֵלּוּ, אֲבָל בְּעֶבֶד עַכּוּ״ם שֶׁל יִשְׂרָאֵל שֶׁמֻּזְהָרִין עָלָיו מִן הַתּוֹרָה, אֵין לוֹ הֶתֵּר אֶלָּא בְּפִקּוּחַ נֶפֶשׁ.", fr: "<b>Note 9.</b> « De dire à l'esclave d'un Juif » — car c'est seulement en s'adressant à un non-Juif ordinaire, ce qui n'est qu'un interdit rabbinique <span class='ca-aram'>(שְׁבוּת [shevout] — araméen, « interdit de second degré »)</span>, qu'on a permis ces choses ; mais pour l'esclave non-juif d'un Juif, au sujet duquel on est averti par la Torah, il n'y a de permission qu'en cas de danger de mort." },
        { he: "וְיֵשׁ חוֹלְקִים וּמַתִּירִים בָּזֶה — הַיְנוּ בָּזֶה שֶׁהָעֶבֶד הוּא נָכְרִי גָּמוּר, וְאַף עַל פִּי כֵן סָבְרָה לָהּ דֵּעָה רִאשׁוֹנָה דְּהוּא שָׁוֶה לְקִבֵּל עָלָיו שֶׁבַע מִצְוֺת, דְּאָסוּר אֲפִלּוּ לְיִשְׂרָאֵל אַחֵר לוֹמַר לוֹ לַעֲשׂוֹת לוֹ מְלָאכָה.", fr: "<b>Note 10.</b> « Et il y a ceux qui contestent et permettent cela » — c'est-à-dire dans le cas où l'esclave est un idolâtre complet : et pourtant, le premier avis considérait que cela équivaut à avoir accepté les sept lois, de sorte qu'il serait interdit même à un autre Juif de lui demander de faire un travail pour lui." },
        { he: "וְעַל זֶה חוֹלְקִים, וְסָבְרֵי דְּבָזֶה לֹא אָסְרָה הַתּוֹרָה אֶלָּא לַעֲשׂוֹת מְלָאכָה בִּשְׁבִיל רַבּוֹ, וּכְדִכְתִיב וְיִנָּפֵשׁ בֶּן אֲמָתְךָ, אֲבָל לִשְׁאָר אִישׁ יִשְׂרָאֵל לֹא עָדִיף מִשְּׁאָר עַכּוּ״ם דְּעָלְמָא, דְּאֵינוֹ אָסוּר רַק מִדְּרַבָּנָן, וּמִמֵּילָא לְצֹרֶךְ חוֹלֶה אֲפִלּוּ אֵין בּוֹ סַכָּנָה מֻתָּר.", fr: "Et sur ce point ils contestent, considérant que sur ce cas la Torah n'a interdit que de faire un travail pour son maître, comme il est écrit « et que le fils de ta servante reprenne son souffle », mais pour un autre Juif quelconque, il n'est pas pire qu'un non-Juif ordinaire, ce qui n'est interdit que par les rabbins ; et de fait, pour le besoin d'un malade, même sans danger de mort, c'est permis." },
        { he: "אִם הָיָה עוֹשֶׂה וְכוּ׳ — הַיְנוּ דְּאַף דִּמְבוֹאָר לְעֵיל שֶׁמְּצֻוֶּה עַל שְׁבִיתַת עַבְדּוֹ, בֵּין כְּשֶׁקִּבֵּל עָלָיו שֶׁבַע מִצְוֺת וּבֵין כְּשֶׁלֹּא קִבֵּל עָלָיו, שֶׁלֹּא יַעֲשֶׂה מְלָאכָה עֲבוּרוֹ, הַיְנוּ דַּוְקָא בְּדְנִיחָא לֵיהּ בִּמְלָאכָה זוֹ, דְּאָז אָמְרִינַן דְּמִסְתָּמָא עוֹשֶׂה עַל דַּעְתּוֹ, וְעַל כֵּן מְחֻיָּב לְהַפְרִישׁוֹ מִזֶּה.", fr: "<b>Note 11.</b> « S'il faisait, etc. » — c'est-à-dire que bien qu'il soit exposé plus haut qu'on est commandé sur le repos de son esclave — que celui-ci ait accepté les sept lois ou non — pour qu'il ne fasse pas de travail pour lui, cela vaut spécifiquement lorsque ce travail lui est agréable <span class='ca-aram'>(דְּנִיחָא לֵיהּ [denicha leih] — araméen, « lorsque cela lui est agréable »)</span>, car alors on dit qu'il présume agir selon la volonté [de son maître], et c'est pourquoi celui-ci est tenu de l'en écarter." },
        { he: "מַה שֶּׁאֵין כֵּן כְּשֶׁנִּכָּר שֶׁאֵין עוֹשֶׂה לְדַעְתּוֹ, הֲוֵי כִּמְלֶאכֶת עַצְמוֹ, וְאֵינוֹ מֻטָּל עָלָיו לְמָנְעוֹ.", fr: "Ce qui n'est pas le cas lorsqu'il est manifeste qu'il n'agit pas selon sa volonté [du maître] : c'est alors comme son propre travail, et il n'incombe pas [au maître] de l'en empêcher." },
        { he: "וּלְיִשְׂרָאֵל אַחֵר וְכוּ׳ — דְּדַוְקָא גַּבֵּי רַבּוֹ שֶׁהוּא עַבְדּוֹ אָמְרִינַן דְּמִסְתָּמָא כָּל מַה שֶּׁהוּא עוֹשֶׂה עַל דַּעַת רַבּוֹ עוֹשֶׂה, מַה שֶּׁאֵין כֵּן בָּזֶה, אַף שֶׁהוּא עוֹשֶׂה לְדַעַת יִשְׂרָאֵל, כָּל שֶׁלֹּא צִוָּהוּ וּמַתְחִיל הָעֶבֶד אוֹ הַגֵּר תּוֹשָׁב לַעֲשׂוֹת מֵאֵלָיו.", fr: "<b>Note 12.</b> « Et pour un autre Juif, etc. » — car c'est seulement à l'égard de son propre maître qu'on dit que, présumément, tout ce qu'il fait, il le fait selon la volonté de son maître ; ce qui n'est pas le cas ici : même s'il agit à la connaissance d'un autre Juif, tant que celui-ci ne le lui a pas ordonné et que c'est l'esclave ou le guer tochav qui commence à agir de lui-même." },
        { he: "אָמְרִינַן דְּהָעִקָּר אַדַּעְתֵּיהּ דְּנַפְשֵׁיהּ עָבִיד לְהַרְוִיחַ לְבַסּוֹף מִמְּלַאכְתּוֹ, וְאֵינוֹ אָסוּר אֶלָּא אִם כֵּן מְצַוֵּהוּ לַעֲשׂוֹת, וְכַנַּ״ל בְּסָעִיף קָטָן ז׳.", fr: "On dit que l'essentiel est qu'il agit pour son propre compte <span class='ca-aram'>(אַדַּעְתֵּיהּ דְּנַפְשֵׁיהּ [ada'ateih denafshei] — araméen, « pour son propre compte »)</span> afin de tirer profit en fin de compte de son travail, et ce n'est interdit que s'il le lui ordonne de le faire, comme dit plus haut à la note 7." },
        { he: "מֻתָּר — וְעַיֵּן סִימָן רנ״ב סוֹף סָעִיף ב׳, דִּלְפְעָמִים צָרִיךְ לִמְחוֹת מִדְּרַבָּנָן.", fr: "<b>Note 13.</b> « Permis » — et voir siman 252, fin du seif 2, où parfois il faut néanmoins protester par obligation rabbinique." },
        { he: "וּבִלְבַד שֶׁלֹּא יֵהָנֶה — וְהַיְנוּ מִדְּרַבָּנָן, דְּלֹא עָדִיף הָעֶבֶד מִשְּׁאָר עַכּוּ״ם דְּעָלְמָא שֶׁעָשָׂה מְלָאכָה לְדַעַת יִשְׂרָאֵל, שֶׁאָסוּר לְיִשְׂרָאֵל לֵהָנוֹת מֵאוֹתָהּ הַמְּלָאכָה בְּשַׁבָּת, וְכַנַּ״ל בְּרֵישׁ סִימָן רע״ו.", fr: "<b>Note 14.</b> « À condition qu'il n'en profite pas » — c'est-à-dire par obligation rabbinique, car l'esclave n'est pas mieux traité qu'un non-Juif ordinaire ayant fait un travail à la connaissance d'un Juif, cas où il est interdit au Juif de profiter le Chabbat de ce travail, comme dit plus haut au début du siman 276." },
        { he: "וְיֵשׁ אוֹמְרִים שֶׁכָּל וְכוּ׳ — סָבְרֵי דְּלֹא הִזְהִירָה הַתּוֹרָה עַל עֶבֶד שֶׁל יִשְׂרָאֵל לְעִנְיַן שַׁבָּת אֶלָּא בְּיֵשׁ עָלָיו עַל כָּל פָּנִים קְצָת מִצְוֺת, דְּהַיְנוּ שֶׁבַע מִצְוֺת בְּנֵי נֹחַ, וְכַמְבוֹאָר בְּבֵית יוֹסֵף, עַיֵּן שָׁם.", fr: "<b>Note 15.</b> « Et il y a ceux qui disent que tant que, etc. » — ils considèrent que la Torah n'a averti au sujet d'un esclave juif pour la question du Chabbat que s'il porte au moins quelques commandements, à savoir les sept lois noahides, comme exposé dans le Beit Yossef." },
        { he: "וְעַיֵּן בָּאֵלִיָּהוּ רַבָּה שֶׁהֵבִיא בְּשֵׁם כַּמָּה פּוֹסְקִים דְּלְמַעֲשֶׂה יֵשׁ לְהַחְמִיר כַּסְּבָרָא הָרִאשׁוֹנָה. אָסוּר לוֹמַר לְמוּמָר וְקָרָאִים לַעֲשׂוֹת לוֹ מְלָאכָה בְּשַׁבָּת וְיוֹם טוֹב, דְּעוֹבֵר מִשּׁוּם לִפְנֵי עִוֵּר [פְּרִי מְגָדִים].", fr: "Et voir dans l'Eliyahou Rabba, qui a rapporté au nom de plusieurs décisionnaires qu'en pratique il faut être strict comme le premier avis. Il est interdit de dire à un apostat ou à un karaïte de faire un travail pour lui le Chabbat et Yom Tov, car on transgresserait alors l'interdit de « ne pas placer d'obstacle devant l'aveugle » [Pri Meguidim]." },
        { he: "וְכָל עֶבֶד וְכוּ׳ — אִי קָאֵי גַּם אַעֶבֶד שֶׁלֹּא מָל וְטָבַל, עַיֵּן בְּתוֹסֶפֶת שַׁבָּת וּפְרִי מְגָדִים.", fr: "<b>Note 16.</b> « Et tout esclave, etc. » — reste à examiner si cela s'applique aussi à l'esclave qui n'a pas été circoncis ni immergé ; voir dans le Tosefet Chabbat et le Pri Meguidim." },
        { he: "אָסוּר לָצֵאת וְכוּ׳ — הִנֵּה מִתְּחִלָּה סָתַם הַדָּבָר, וְאַחַר כָּךְ בֵּאֵר דְּאִם יֵשׁ בּוֹ תַּרְתֵּי לְמַעֲלִיּוֹתָא דְּהַיְנוּ שֶׁהַחוֹתָם הָיָה שֶׁל טִיט וְהוּא תָּלוּי בְּצַוָּארוֹ, מֻתָּר לָצֵאת בּוֹ.", fr: "<b>Note 17.</b> « Il est interdit de sortir, etc. » — voici : le Choulhan Aroukh a d'abord formulé la chose de façon générale, puis a précisé que s'il y a deux points favorables <span class='ca-aram'>(תַּרְתֵּי לְמַעֲלִיּוֹתָא [tartei lema'alyouta] — araméen, « deux points favorables »)</span>, à savoir que le sceau était en argile ET qu'il est suspendu à son cou, il est permis de sortir avec." },
        { he: "דְּלְמַאי נִיחוּשׁ לָהּ דִּלְשֶׁמָּא יְסִירֶנָּה בְּיָדוֹ וִיבִיאֶנָּה אַרְבַּע אַמּוֹת בִּרְשׁוּת הָרַבִּים? בְּוַדַּאי לֵיכָּא לְמֵיחָשׁ, דְּאִית עֲלֵיהּ אֵימְתָא דְּרַבֵּיהּ שֶׁיֹּאמַר שֶׁהֱסִירָהּ כְּדֵי לְהַרְאוֹת שֶׁהוּא בֶּן חוֹרִין.", fr: "Car de quoi craindrait-on <span class='ca-aram'>(נִיחוּשׁ לָהּ [nichoush lah] — araméen, « de quoi craindrait-on »)</span> qu'il ne l'enlève de sa main et ne la transporte quatre coudées dans le domaine public ? Il n'y a certainement pas lieu de le craindre, car il ressent la crainte de son maître <span class='ca-aram'>(אֵימְתָא דְּרַבֵּיהּ [eimta derabbeih] — araméen, « la crainte de son maître »)</span>, qui dirait qu'il l'a enlevé pour montrer qu'il est un homme libre." },
        { he: "וּלְשֶׁמָּא יִפָּסֵק וְיִשָּׁבֵר הַחוֹתָם מֵאֵלָיו בִּרְשׁוּת הָרַבִּים וְאָתֵי לְאַתּוֹיֵי אַחַר כָּךְ לְבֵיתוֹ, גַּם כֵּן לֵיכָּא לְמֵיחָשׁ, דִּלְמַאי יְבִיאֶנּוּ? דְּחוֹתָם שָׁבוּר שֶׁל טִיט לֹא חֲזֵי לְמִידֵי.", fr: "Et de crainte qu'il ne se détache et que le sceau ne se brise de lui-même dans le domaine public, et qu'il ne vienne ensuite le rapporter chez lui — là non plus il n'y a pas lieu de le craindre : car pourquoi le rapporterait-il, puisqu'un sceau d'argile brisé n'a plus aucun usage ?" },
        { he: "וְאִם כְּדֵי לְהַרְאוֹת לְרַבּוֹ שֶׁהוּא כָּפוּף לוֹ וְאוֹחֵז בְּיָדוֹ הַחוֹתָם שֶׁל עַבְדּוּת, זֶה אֵינוֹ סִימָן כְּלָל עַל עַבְדּוּת, כִּי אִם כְּשֶׁתָּלוּי בְּצַוָּארוֹ אוֹ בִּכְסוּתוֹ. אֲבָל אִי אִית בֵּיהּ חֲדָא לְמַעֲלִיּוֹתָא, שֶׁהָיָה הַחוֹתָם תָּלוּי בִּכְסוּתוֹ אוֹ שֶׁהָיָה הַחוֹתָם שֶׁל מַתֶּכֶת שֶׁהוּא חָשׁוּב, אָסוּר לָצֵאת בּוֹ לִרְשׁוּת הָרַבִּים, וּכְדִלְקַמֵּיהּ.", fr: "Et si c'est pour montrer à son maître qu'il lui est soumis, en tenant simplement dans sa main le sceau d'esclavage, cela n'est pas du tout un signe d'esclavage, sauf lorsqu'il est suspendu à son cou ou attaché à son vêtement. Mais s'il n'y a qu'un seul point favorable — que le sceau était attaché au vêtement, ou qu'il était en métal, ce qui est de valeur — il est interdit de sortir avec dans le domaine public, comme il sera expliqué ci-après." },
        { he: "אֲבָל לֹא בִּכְסוּתוֹ — דִּלְמָא מִיפְסַק הַחוֹתָם מֵאֵלָיו, וּמִירְתַת מֵרַבּוֹ שֶׁיֹּאמַר שֶׁהֱסִירוֹ כְּדֵי לְהַרְאוֹת לַכֹּל שֶׁהוּא בֶּן חוֹרִין, וִיקַפֵּל טַלִּיתוֹ כְּדֵי שֶׁלֹּא יִתְרָאֶה מְקוֹם הַחוֹתָם, וְיִשָּׂאֶנּוּ עַל כְּתֵפוֹ, וְדָמֵי הַטַּלִּית עַל כְּתֵפוֹ כְּמַשּׂאוֹי.", fr: "<b>Note 18.</b> « Mais pas attaché à son vêtement » — de peur que le sceau ne se détache <span class='ca-aram'>(מִיפְסַק [meifsak] — araméen, « se détache »)</span> de lui-même, et qu'il ne craigne <span class='ca-aram'>(מִירְתַת [mirtat] — araméen, « il craint »)</span> son maître, qui dirait qu'il l'a enlevé pour montrer à tous qu'il est un homme libre, et qu'il ne plie alors son châle pour que l'endroit du sceau ne se voie pas, et ne le porte sur son épaule — auquel cas le châle sur son épaule devient comme un fardeau porté, interdit." },
        { he: "וּבְשֶׁל מַתֶּכֶת וְכוּ׳ — דְּכֵיוָן שֶׁהוּא חָשׁוּב וְקָפִיד עָלָיו רַבּוֹ שֶׁלֹּא יֹאבַד, חַיְישִׁינַן דִּלְמָא מִיפְסַק וְאָתֵי לְאַתּוֹיֵי אַרְבַּע אַמּוֹת בִּרְשׁוּת הָרַבִּים.", fr: "<b>Note 19.</b> « Et s'il est en métal, etc. » — car puisqu'il est de valeur et que le maître tient à ce qu'il ne se perde pas, nous craignons <span class='ca-aram'>(חַיְישִׁינַן [chayeshinan] — araméen, « nous craignons »)</span> qu'il ne se détache et qu'il ne vienne à le transporter quatre coudées dans le domaine public." },
        { he: "בְּכָל עִנְיָן — הַיְנוּ אֲפִלּוּ כְּשֶׁהוּא תָּלוּי עַל צַוָּארוֹ, וְהַטַּעַם: דְּכֵיוָן שֶׁהוּא עָשָׂה לְעַצְמוֹ, אֵינוֹ מִירְתַת מֵרַבּוֹ כְּשֶׁיְּסִירֶנּוּ, וְחַיְישִׁינַן דִּלְמָא שָׁקִיל לֵיהּ בְּיָדֵיהּ וִיבִיאֶנּוּ אַרְבַּע אַמּוֹת בִּרְשׁוּת הָרַבִּים.", fr: "<b>Note 20.</b> « En tout cas » — c'est-à-dire même lorsqu'il est suspendu à son cou ; et la raison en est que, puisqu'il l'a fait lui-même, il ne craint pas son maître lorsqu'il l'enlève, et nous craignons qu'il ne le prenne dans sa main et ne le transporte quatre coudées dans le domaine public." }
      ],
      resumeMB: "Détaille pourquoi le sceau d'esclave doit cumuler deux conditions (argile + cou) pour être toléré, et les limites précises de qui doit être empêché de travailler.",
      rambam: RAMBAM_304_14,
      rambamRef: RAMBAM_304_REF,
      resumeRambam: "Source unique du Rambam pour tout le siman 304 : distingue l'esclave circoncis/immergé (repos obligatoire) du guer tochav (travaille pour lui-même, pas pour son maître)."
    },
    {
      num: 2,
      badge: "deoraita",
      badgeLabel: "דאורייתא · même cadre légal",
      ca: [
        { he: "וְהֵיכָא דְּמֻתָּר הָעֶבֶד לַעֲשׂוֹת מְלָאכָה לְעַצְמוֹ", fr: "Et là où <span class='ca-aram'>(וְהֵיכָא [veheikha] — araméen, \"et là où, dans le cas où\")</span> il est permis à l'esclave de travailler pour lui-même," },
        { he: "אִם אָמַר לוֹ הָאָדוֹן שֶׁיַּעֲשֶׂה לְעַצְמוֹ וְיָזוּן עַצְמוֹ בְּיוֹם הַשַּׁבָּת", fr: "si le maître lui a dit de travailler pour lui-même et de se nourrir le jour du Chabbat," },
        { he: "כֵּיוָן שֶׁהִתְנָה עִמּוֹ מִבְּעוֹד יוֹם", fr: "puisqu'il a posé cette condition avec lui avant l'entrée du Chabbat <span class='ca-aram'>(מִבְּעוֹד יוֹם [mibeod yom] — litt. \"alors qu'il fait encore jour\")</span>," },
        { he: "עוֹשֶׂה הוּא לְצָרְכֵי מְזוֹנוֹתָיו", fr: "il peut travailler pour ses besoins alimentaires," },
        { he: "וּבִלְבַד בְּצִנְעָה שֶׁלֹּא יְהֵא בַּדָּבָר חֲשַׁשׁ רוֹאִים", fr: "à condition [de le faire] discrètement <span class='ca-aram'>(בְּצִנְעָה [betsin'a] — discrètement)</span>, pour qu'il n'y ait pas de risque que des gens le voient." }
      ],
      resumeCA: "Le serviteur peut travailler pour se nourrir le Chabbat si le maître l'a autorisé avant l'entrée de Chabbat, et à condition de rester discret.",
      mb: [
        { he: "אִם אָמַר לוֹ הָאָדוֹן וְכוּ׳ — שֶׁאִם יִרְצֶה שֶׁלֹּא לְזוּנוֹ וְשֶׁיַּחֲזֹר הָעֶבֶד עַל הַפְּתָחִים, הָרְשׁוּת בְּיָדוֹ, וְאִם כֵּן עוֹשֶׂה הָעֶבֶד לְעַצְמוֹ.", fr: "<b>Note 21.</b> « Si le maître lui a dit, etc. » — car s'il veut ne pas le nourrir et laisser l'esclave mendier de porte en porte, il en a le droit ; et dans ce cas l'esclave travaille pour lui-même." },
        { he: "כֵּיוָן שֶׁהִתְנָה עִמּוֹ מִבְּעוֹד יוֹם — לְאַפּוֹקֵי לְהַתְנוֹת בְּשַׁבָּת דְּאָסוּר.", fr: "<b>Note 22.</b> « Puisqu'il a posé cette condition avec lui alors qu'il faisait encore jour » — ceci vient exclure <span class='ca-aram'>(לְאַפּוֹקֵי [le'afokei] — araméen, « pour exclure »)</span> le fait de poser la condition pendant le Chabbat même, ce qui est interdit." },
        { he: "וְאִם לֹא אָמַר לֵיהּ כְּלָל, אֶלָּא הָעֶבֶד עוֹשֶׂה מֵעַצְמוֹ וְרוֹצֶה לִיזוֹן מִמֶּנּוּ, הֵבִיא בְּאֵלִיָּהוּ רַבָּה בְּשֵׁם סֵפֶר מַשְׂאַת בִּנְיָמִין דְּמֻתָּר, כֵּיוָן שֶׁאֵין הַיִּשְׂרָאֵל אוֹמֵר לוֹ שֶׁיַּעֲשֶׂנָּה, וּבִלְבוּשֵׁי שְׂרָד בְּרֵישׁ סִימָן זֶה מַשְׁמָע דְּאֵין לְהָקֵל בָּזֶה.", fr: "Et s'il ne lui a rien dit du tout, mais que l'esclave agit de lui-même et veut s'en nourrir, l'Eliyahou Rabba a rapporté au nom du Massat Binyamin que c'est permis, puisque le Juif ne lui dit pas de le faire ; mais dans le Levouché Sérad, au début de ce siman, il ressort qu'il ne faut pas être indulgent sur ce point." },
        { he: "עוֹשֶׂה הוּא וְכוּ׳ — רְצוֹנוֹ לוֹמַר אֲפִלּוּ בְּבֵית רַבּוֹ, כֵּיוָן שֶׁהוּא בְּצִנְעָה, וְכָל שֶׁכֵּן אִם מַרְוִיחַ אֵצֶל אֵינוֹ יְהוּדִי; אֲבָל לֹא יַעֲשֶׂה לְצֹרֶךְ יִשְׂרָאֵל אַחֵר אֲפִלּוּ בְּצִנְעָה, דְּהָא מִכָּל מָקוֹם עֶבֶד יִשְׂרָאֵל הוּא.", fr: "<b>Note 23.</b> « Il travaille, etc. » — c'est-à-dire même dans la maison de son maître, du moment que c'est discret <span class='ca-aram'>(בְּצִנְעָה [betsin'a] — discrètement)</span>, et à plus forte raison <span class='ca-aram'>(וְכָל שֶׁכֵּן [vekhol shekken] — araméen/hébreu, « a fortiori »)</span> s'il gagne chez un non-Juif ; mais il ne doit pas le faire pour le besoin d'un autre Juif, même discrètement, car de toute façon il reste l'esclave d'un Juif." }
      ],
      resumeMB: "Précise que le travail doit être discret, non commandé par le maître, et jamais rendu à un autre Juif.",
      rambam: RAMBAM_304_14,
      rambamRef: RAMBAM_304_REF,
      resumeRambam: "Même halakha du Rambam (20:14) : elle fonde aussi la permission pour l'esclave de travailler pour lui-même, comme pour se nourrir, tant que ce n'est pas pour son maître."
    },
    {
      num: 3,
      badge: "permis",
      badgeLabel: "לא מדאורייתא · pas d'interdit de la Torah ici",
      ca: [
        { he: "עַכּוּ״ם גָּמוּר שֶׁהוּא שָׂכִיר", fr: "Un idolâtre à part entière qui est un <span class='ca-aram'>salarié journalier (שָׂכִיר [sakhir])</span>," },
        { he: "אֵין רַבּוֹ מְצֻוֶּה עַל שְׁבִיתָתוֹ", fr: "son employeur n'est pas commandé au sujet de son repos le Chabbat." }
      ],
      resumeCA: "Un employé non-juif salarié (donc pas un esclave à titre perpétuel) n'engage aucune obligation de repos chabbatique pour son employeur juif.",
      mb: [
        { he: "עַכּוּ״ם גָּמוּר — אֲבָל אִם קִבֵּל עָלָיו שֶׁבַע מִצְוֺת, הֲרֵי הוּא גֵּר תּוֹשָׁב, וְאָסוּר לַעֲשׂוֹת מְלָאכָה לְיִשְׂרָאֵל אַף לְמִי שֶׁאֵינוֹ רַבּוֹ, וְכַנַּ״ל.", fr: "<b>Note 24.</b> « Un idolâtre complet » — mais s'il a accepté sur lui les sept lois, il est alors un guer tochav, et il est interdit de travailler pour un Juif, même pour celui qui n'est pas son maître, comme dit plus haut." },
        { he: "וְעַיֵּן בְּרַמְבַּ״ם פֶּרֶק י״ד מֵהִלְכוֹת אִסּוּרֵי בִּיאָה, דְּאֵין מְקַבְּלִין גֵּר תּוֹשָׁב בִּזְמַן שֶׁאֵין הַיּוֹבֵל נוֹהֵג, וְכֵן עֶבֶד שֶׁאֵינוֹ רוֹצֶה לְקַבֵּל עָלָיו מִצְוֺת כִּי אִם שֶׁבַע כְּמוֹ גֵּר תּוֹשָׁב, גַּם כֵּן אֵין מְקַבְּלִין אוֹתוֹ בִּזְמַן שֶׁאֵין הַיּוֹבֵל נוֹהֵג, וְהָרַאֲבַ״ד שָׁם חוֹלֵק עַל זֶה.", fr: "Et voir dans le Rambam, chapitre 14 des lois des interdits sexuels, selon lequel on n'accepte pas un guer tochav à une époque où le Jubilé n'est pas en vigueur ; de même un esclave qui ne veut accepter que les sept lois comme un guer tochav n'est pas non plus accepté à une telle époque ; et le Raavad, au même endroit, conteste ce point." },
        { he: "שֶׁהוּא שָׂכִיר — וַאֲפִלּוּ אִם הוּא שָׂכִיר לְכַמָּה שָׁנִים, מִכָּל מָקוֹם הֲרֵי אֵינוֹ קָנוּי לוֹ קִנְיַן עוֹלָם, וְעַל כֵּן אֲפִלּוּ אִם הוּא עוֹשֶׂה מְלֶאכֶת רַבּוֹ, אֵינוֹ אָסוּר מִדְּאוֹרַיְתָא, שֶׁאֵינוֹ בִּכְלַל ׳עַבְדּוֹ׳, וְהַמְּלָאכוֹת הַמֻּתָּרוֹת לְכַתְּחִלָּה עַל יְדֵי עַכּוּ״ם מֻתָּר גַּם עַל יָדוֹ.", fr: "<b>Note 25.</b> « Qui est un salarié » — et même s'il est engagé pour plusieurs années, il n'est de toute façon pas acquis à titre d'acquisition perpétuelle <span class='ca-aram'>(קִנְיַן עוֹלָם [kinyan olam] — hébreu, « acquisition perpétuelle »)</span>, et c'est pourquoi, même s'il fait le travail de son maître, ce n'est <b>pas interdit par la Torah</b>, car il n'entre pas dans la catégorie de « son esclave » ; et les travaux permis d'emblée par l'intermédiaire d'un non-Juif sont également permis par son intermédiaire." },
        { he: "וְכָתַב בֵּית יוֹסֵף שֶׁמַּהֲרִי״א נִסְתַּפֵּק בְּאוֹתָן הָעֲבָדִים וְהַשְּׁפָחוֹת עוֹבְדֵי גִּלּוּלִים, שֶׁאִם רָצוּ לְהָמִיר דָּתָם וְלִיכָּנֵס לְדַת יִשְׁמָעֵאל יוֹצְאִים לְחֵרוּת, אֶפְשָׁר שֶׁאַף עַל פִּי שֶׁהֵם עַתָּה קְנוּיוֹת קִנְיַן עוֹלָם, שֶׁמֵּחֲמַת זֶה הֵם חֲשׁוּבִים רַק כְּשָׂכִיר עוֹבֵד גִּלּוּלִים בְּעָלְמָא, וְצָרִיךְ עִיּוּן.", fr: "Et le Beit Yossef a écrit que le Maharia s'est interrogé sur ces esclaves et servantes idolâtres qui, s'ils voulaient changer de religion et entrer dans la religion d'Ismaël, sortent en liberté : peut-être que, bien qu'ils soient à présent acquis à titre perpétuel, du fait de cette possibilité ils ne sont considérés que comme de simples salariés idolâtres — question qui reste à approfondir." },
        { he: "וְדַעַת הָאַחֲרוֹנִים לְהַחְמִיר בָּזֶה, מִפְּנֵי שֶׁיֵּשׁ בָּזֶה חֲשַׁשׁ אִסּוּר תּוֹרָה, וְכָל שֶׁכֵּן אִם הוּא בְּמָקוֹם שֶׁאֵין לוֹ רְשׁוּת לְפִי דִּינֵיהֶם לְהַפְקִיעַ עַצְמוֹ בַּהֲמָרַת דָּתוֹ, שֶׁבָּזֶה וַדַּאי אָסוּר לַעֲשׂוֹת מְלָאכָה בְּשַׁבָּת לְיִשְׂרָאֵל.", fr: "Et l'avis des décisionnaires tardifs est d'être strict sur ce point, car il y a là un risque d'interdit de la Torah ; et a fortiori s'il se trouve dans un lieu où, selon leurs lois, il n'a pas le droit de se soustraire [à son statut] en changeant de religion — auquel cas il est certainement interdit de lui faire faire un travail le Chabbat pour un Juif." },
        { he: "אֵין רַבּוֹ מְצֻוֶּה — בְּמָקוֹם שֶׁהַמֶּלֶךְ יָרוּם הוֹדוֹ גָּזַר שֶׁאֵין שׁוּם אָדָם חוּץ מִדָּתָם יְכוֹלִין לִקְנוֹת עֶבֶד וְאָמָה, הָעֲבָדִים וְהַשְּׁפָחוֹת יְכוֹלִין לְהַעֲבִיר אֵשׁ בְּשַׁבָּת, דְּהָוְיָין כְּשָׂכִיר בְּעָלְמָא [רַשְׁדַּ״ם וְרִיבָ״ל].", fr: "<b>Note 26.</b> « Son maître n'est pas commandé » — dans un lieu où le roi a décrété que nul, hormis les gens de sa propre religion, ne peut acquérir d'esclave ou de servante, les esclaves et servantes peuvent faire passer du feu le Chabbat pour le compte d'un Juif, car ils sont alors considérés comme de simples salariés [Rashdam et Rival]." },
        { he: "אֲבָל יֵשׁ חוֹלְקִים וְסָבְרֵי דְּאַף עַתָּה גּוּפָן קָנוּי לְיִשְׂרָאֵל, וְעַכְשָׁו שֶׁפּוֹרְעִים כְּרָגָא בְּעַד הָעֲבָדִים וְהַשְּׁפָחוֹת, לְכוּלֵי עָלְמָא גּוּפָן קָנוּי וַאֲסוּרִים בִּמְלָאכָה; וְכֵן לְקֻלָּא, דְּהַיְנוּ שֶׁיָּכוֹל מַמְזֵר לִשָּׂא שִׁפְחָה וְעֶבֶד מַמְזֶרֶת.", fr: "Mais il y a ceux qui contestent et considèrent que même à présent leur corps reste acquis au Juif, et que maintenant qu'on paie l'impôt par tête <span class='ca-aram'>(כְּרָגָא [kraga] — araméen, « impôt par tête »)</span> pour les esclaves et servantes, de l'avis de tous <span class='ca-aram'>(לְכוּלֵי עָלְמָא [lekhulei alma] — araméen, « de l'avis de tous »)</span> leur corps est acquis et ils restent interdits de travail ; et de même pour ce qui est de la clémence, à savoir qu'un mamzer peut épouser une servante, et un esclave une mamzeret." }
      ],
      resumeMB: "Explique pourquoi un salarié non-esclave échappe à l'obligation de la Torah, avec un cas historique limite discuté par les décisionnaires.",
      rambam: RAMBAM_304_14,
      rambamRef: RAMBAM_304_REF,
      resumeRambam: "Même halakha du Rambam (20:14) : elle ne parle que de l'esclave et du guer tochav, ce qui explique pourquoi le simple salarié non-esclave en est exclu."
    }
      ]
    }
  ]
};

function caRenderLines(container, lines){
  container.innerHTML = lines.map(l =>
    '<div class="ca-he">' + l.he + '</div><div class="ca-fr">' + l.fr + '</div>'
  ).join("");
}

// Numération hébraïque simple (1-99), en évitant יה/יו (15/16 -> טו/טז) pour ne pas
// écrire une abréviation du Nom divin dans un simple numéro de seif.
function caHebNum(n){
  const ones = ["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens = ["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
  if(n === 15) return "טו";
  if(n === 16) return "טז";
  const t = Math.floor(n / 10), o = n % 10;
  return tens[t] + ones[o];
}

// Aplatit tous les simanim/seifim en une seule liste, pour permettre au bouton "Lu"
// d'avancer en continu à travers plusieurs simanim (304, 305, ...) sans que l'index
// ait besoin de connaître la structure interne.
function caFlatList(){
  const list = [];
  CHOULHAN_SHABBAT.simanim.forEach(siman => {
    siman.seifim.forEach(seif => {
      list.push({ simanNum: siman.num, simanNumHe: siman.numHe, simTitle: siman.simTitle, totalInSiman: siman.seifim.length, seif });
    });
  });
  return list;
}

function caGetIndex(){
  const list = caFlatList();
  const v = parseInt(localStorage.getItem("caSeifIndex") || "0", 10);
  return (isNaN(v) || v < 0 || v >= list.length) ? 0 : v;
}
function caSetIndex(i){
  localStorage.setItem("caSeifIndex", String(i));
}
function caCurrentEntry(){
  return caFlatList()[caGetIndex()];
}

function caRenderCA(){
  const entry = caCurrentEntry();
  const seif = entry.seif;
  document.getElementById("caRef").textContent = "אורח חיים · סימן " + entry.simanNumHe + " · סעיף " + caHebNum(seif.num);
  document.getElementById("caSimTitle").textContent = entry.simTitle;
  const badgeEl = document.getElementById("caBadge");
  badgeEl.textContent = seif.badgeLabel;
  badgeEl.className = "ca-badge " + seif.badge;
  caRenderLines(document.getElementById("caContent"), seif.ca);
  document.getElementById("caResume").textContent = "Résumé : " + seif.resumeCA;
  document.getElementById("caProgress").textContent = "Seif " + seif.num + " sur " + entry.totalInSiman + " · Siman " + entry.simanNum;
  aiResetThread("caAiAnswer");
  document.getElementById("caAiInput").value = "";
  updateCaAiNote("caAiNote");
}

function caRenderMB(){
  const entry = caCurrentEntry();
  const seif = entry.seif;
  document.getElementById("mbRef").textContent = "אורח חיים · סימן " + entry.simanNumHe + " · סעיף " + caHebNum(seif.num);
  caRenderLines(document.getElementById("mbContent"), seif.mb);
  document.getElementById("mbResume").textContent = "Résumé : " + seif.resumeMB;
  document.getElementById("mbProgress").textContent = "Seif " + seif.num + " sur " + entry.totalInSiman + " · Siman " + entry.simanNum;
  aiResetThread("mbAiAnswer");
  document.getElementById("mbAiInput").value = "";
  updateCaAiNote("mbAiNote");
  // Le bloc Michna Beroura repart fermé à chaque nouveau seif affiché.
  document.getElementById("mbBlock").classList.add("collapsed");
  document.querySelector("#mbToggle span").textContent = "Michna Beroura — appuyer pour afficher";
}

function caRenderRambam(){
  // Pas de compteur "Seif X sur Y" ici : un seul indicateur de progression suffit
  // pour toute la page 2 (affiché en bas, sous le Michna Beroura).
  const entry = caCurrentEntry();
  const seif = entry.seif;
  document.getElementById("rambamRef").textContent = seif.rambamRef || "—";
  caRenderLines(document.getElementById("rambamContent"), seif.rambam || []);
  document.getElementById("rambamResume").textContent = "Résumé : " + (seif.resumeRambam || "");
  aiResetThread("rambamAiAnswer");
  document.getElementById("rambamAiInput").value = "";
  updateCaAiNote("rambamAiNote");
}

function updateCaAiNote(noteId){
  const note = document.getElementById(noteId);
  const key = localStorage.getItem("geminiApiKey");
  note.textContent = key
    ? "Réponse générée par Gemini, à titre d'aide à l'étude — vérifie toujours auprès d'un rav pour une décision pratique."
    : "Nécessite ta clé API Gemini, à configurer une fois dans les réglages.";
}

function caContextText(entry){
  const seif = entry.seif;
  const caText = seif.ca.map(l => l.fr.replace(/<[^>]+>/g, "")).join(" ");
  const mbText = seif.mb.map(l => l.fr.replace(/<[^>]+>/g, "")).join(" ");
  const rambamText = (seif.rambam || []).map(l => l.fr.replace(/<[^>]+>/g, "")).join(" ");
  return "Choulhan Aroukh Orach Chaim siman " + entry.simanNum + " seif " + seif.num + " (traduction française) : " + caText +
    "\n\nMichna Beroura associé : " + mbText +
    (rambamText ? ("\n\nRambam, Michné Torah (" + (seif.rambamRef || "") + ") : " + rambamText) : "");
}

// Le modèle répond parfois avec de la mise en forme markdown (*emphase*, **gras**, tirets de
// liste) alors que l'affichage à l'écran est en texte brut : sans nettoyage, les astérisques
// et tirets apparaissent littéralement. On les retire ici, en plus de le demander dans le prompt.
function caSanitizeAiText(text){
  if(!text) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^[-•]\s+/gm, "")
    .trim();
}

// ---------- Conversations Gemini multi-tours ----------
// Chaque boîte "Question sur..." (Choulhan Aroukh, Rambam, Michna Beroura, quiz) garde son propre
// historique d'échanges, indexé simplement par l'id de son div de réponse. Le premier message
// envoyé à Gemini embarque tout le contexte (texte du seif ou du cas de quiz) + la question ; les
// messages suivants ne renvoient que la question, car l'historique complet (contents[]) est
// retransmis à chaque appel et donne au modèle la mémoire de la conversation.
const aiThreads = {};

function aiEscapeHtml(s){
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Vide le fil d'une boîte (appelé à chaque changement de seif / de question de quiz, pour ne pas
// mélanger deux contextes différents dans une même conversation).
function aiResetThread(answerElId){
  aiThreads[answerElId] = [];
  const el = document.getElementById(answerElId);
  if(el) el.innerHTML = "";
}

function aiRenderThread(answerElId){
  const el = document.getElementById(answerElId);
  if(!el) return;
  const thread = aiThreads[answerElId] || [];
  el.innerHTML = thread.map(m =>
    '<div class="ca-ai-msg ' + m.role + '">' + aiEscapeHtml(m.text) + '</div>'
  ).join("");
  el.scrollTop = el.scrollHeight;
}

// Le modèle répond parfois avec de la mise en forme markdown (*emphase*, **gras**, tirets de
// liste) alors que l'affichage à l'écran est en texte brut : sans nettoyage, les astérisques
// et tirets apparaissent littéralement. On les retire ici, en plus de le demander dans le prompt.
function caSanitizeAiText(text){
  if(!text) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^[-•]\s+/gm, "")
    .trim();
}

// Moteur générique d'échange avec Gemini, utilisé par caAskGemini et quizAskGemini ci-dessous.
// contextText et finalInstruction ne sont utilisés que pour le tout premier message du fil ;
// les relances suivantes n'envoient que la nouvelle question, en s'appuyant sur l'historique.
async function aiConverse(answerElId, question, contextText, finalInstruction){
  const thread = aiThreads[answerElId] = aiThreads[answerElId] || [];
  const apiKey = localStorage.getItem("geminiApiKey");

  if(!apiKey){
    thread.push({ role: "model", text: "Ajoute d'abord ta clé API Gemini dans les réglages (⚙, depuis la page Choulhan Aroukh)." });
    aiRenderThread(answerElId);
    return;
  }
  if(!question || !question.trim()){
    thread.push({ role: "model", text: "Écris une question dans le champ ci-dessus." });
    aiRenderThread(answerElId);
    return;
  }

  const isFirstTurn = thread.length === 0;
  const sendText = isFirstTurn
    ? (contextText + "\n\nQuestion de l'utilisateur : " + question + "\n\n" + finalInstruction)
    : question;

  thread.push({ role: "user", text: question, sendText: sendText });
  aiRenderThread(answerElId);

  // On retransmet tout l'historique (y compris le contexte embarqué dans le tout premier tour) à
  // chaque appel : c'est ce qui donne à Gemini la mémoire des échanges précédents.
  const contents = thread.map(m => ({ role: m.role, parts: [{ text: m.sendText || m.text }] }));

  thread.push({ role: "model", text: "…" });
  aiRenderThread(answerElId);

  // Liste de secours : si un alias/modèle est mis hors service ou a un quota à 0 sur le palier gratuit,
  // on retente automatiquement avec le suivant, pour que l'app ne reste jamais bloquée sur un seul nom de modèle.
  const GEMINI_MODEL_CANDIDATES = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  let lastErrorMsg = "";
  for(const model of GEMINI_MODEL_CANDIDATES){
    // Garde-fou : si l'appel ne répond pas en 15s (réseau capricieux), on l'annule et on passe au modèle suivant
    // au lieu de rester bloqué indéfiniment sur "…".
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try{
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents,
          // thinkingBudget:0 désactive le raisonnement interne (invisible) de certains modèles Gemini,
          // qui grignotait sinon le quota de tokens et coupait la réponse avant qu'elle ne soit écrite.
          // maxOutputTokens relevé à 800 (au lieu de 500) pour ne pas tronquer une réponse à 5-6
          // phrases quand le sujet demande un peu plus de détail ; la consigne de longueur reste
          // portée par le prompt, ce plafond n'est qu'un filet de sécurité.
          generationConfig: { maxOutputTokens: 800, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } }
        })
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if(!res.ok){
        lastErrorMsg = (data.error && data.error.message ? data.error.message : String(res.status));
        continue; // essaie le modèle suivant
      }
      const text = data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text;
      thread[thread.length - 1].text = caSanitizeAiText(text) || "Pas de réponse reçue.";
      aiRenderThread(answerElId);
      return;
    } catch(e){
      clearTimeout(timeoutId);
      lastErrorMsg = (e.name === "AbortError") ? "délai dépassé (15s)" : ("réseau : " + e.message);
    }
  }
  thread[thread.length - 1].text = "Erreur API (tous les modèles ont échoué) : " + lastErrorMsg;
  aiRenderThread(answerElId);
}

async function caAskGemini(question, answerElId){
  const entry = caCurrentEntry();
  const contextText = "Voici un seif du Choulhan Aroukh (Orach Chaim, siman " + entry.simanNum + ") avec le Michna Beroura et le Rambam associés, déjà traduits en français :\n\n" +
    caContextText(entry);
  const finalInstruction =
    "Réponds en français. Base-toi sur le contexte fourni, mais si le texte ou la question de l'utilisateur contiennent des raccourcis, " +
    "des manques de nuances ou des imprécisions halachiques flagrantes par rapport aux règles réelles des lois de Chabbat, signale-le gentiment " +
    "et apporte les corrections nécessaires. Consigne de style : réponse complète et précise, ne saute aucune étape de raisonnement nécessaire " +
    "à la compréhension, mais reste concis (pas de répétitions ni de remplissage inutile) — au maximum 5 à 6 phrases. Pas de liste à puces, " +
    "pas de titres, pas de mise en forme markdown (n'utilise jamais d'astérisques ni de tirets de liste) : texte brut uniquement, va droit au but.";
  await aiConverse(answerElId, question, contextText, finalInstruction);
}

function initChoulhanCA(){
  caRenderCA();
  document.getElementById("choulhanCA").scrollTo({ top: 0, behavior: "auto" });
  const goMbBtn = document.getElementById("caGoMbBtn");
  const aiBtn = document.getElementById("caAiBtn");

  const onGoMb = () => goTo("choulhanMB");
  // Le champ se vide dès l'envoi (comme un chat) : la question part vers Gemini, et on peut tout
  // de suite taper la relance suivante sans effacer soi-même l'ancienne question.
  const onAsk = () => {
    const inputEl = document.getElementById("caAiInput");
    const question = inputEl.value;
    inputEl.value = "";
    caAskGemini(question, "caAiAnswer");
  };

  goMbBtn.addEventListener("click", onGoMb);
  aiBtn.addEventListener("click", onAsk);

  return () => {
    goMbBtn.removeEventListener("click", onGoMb);
    aiBtn.removeEventListener("click", onAsk);
  };
}

function initChoulhanMB(){
  // Cette page 2 affiche le Rambam (ouvert) puis, en dessous, le Michna Beroura (fermé par défaut).
  caRenderRambam();
  caRenderMB();
  document.getElementById("choulhanMB").scrollTo({ top: 0, behavior: "auto" });
  const luBtn = document.getElementById("caLuBtn");
  const rambamAiBtn = document.getElementById("rambamAiBtn");
  const mbAiBtn = document.getElementById("mbAiBtn");
  const toggleEl = document.getElementById("mbToggle");
  const blockEl = document.getElementById("mbBlock");

  const onLu = () => {
    const list = caFlatList();
    const next = (caGetIndex() + 1) % list.length;
    caSetIndex(next);
    // On retourne sur la page Choulhan Aroukh pour lire le nouveau seif depuis le début.
    goTo("choulhanCA");
  };
  const onAskRambam = () => {
    const inputEl = document.getElementById("rambamAiInput");
    const question = inputEl.value;
    inputEl.value = "";
    caAskGemini(question, "rambamAiAnswer");
  };
  const onAskMb = () => {
    const inputEl = document.getElementById("mbAiInput");
    const question = inputEl.value;
    inputEl.value = "";
    caAskGemini(question, "mbAiAnswer");
  };
  const onToggle = () => {
    const nowCollapsed = blockEl.classList.toggle("collapsed");
    toggleEl.querySelector("span").textContent = nowCollapsed
      ? "Michna Beroura — appuyer pour afficher"
      : "Michna Beroura — appuyer pour masquer";
  };

  luBtn.addEventListener("click", onLu);
  rambamAiBtn.addEventListener("click", onAskRambam);
  mbAiBtn.addEventListener("click", onAskMb);
  toggleEl.addEventListener("click", onToggle);

  return () => {
    luBtn.removeEventListener("click", onLu);
    rambamAiBtn.removeEventListener("click", onAskRambam);
    mbAiBtn.removeEventListener("click", onAskMb);
    toggleEl.removeEventListener("click", onToggle);
  };
}

// ---------- QUIZ CHABBAT ----------
// Sources : Choulhan Aroukh (R. Yossef Karo, m. 1575), domaine public. Banque volontairement large
// (38 questions, siman 253 à 340+397) couvrant la quasi-totalité des thèmes pratiques de Hilkhot
// Chabbat : les 39 travaux (Bishoul/cuisson y compris Iroui et Ha'hazara, Borer/tri, Tochén/moudre,
// Kotzer/cueillir, Gozez/couper, Kotev/écrire, Tofer/coudre, Boneh/construire, Melabén/lessiver,
// Dash/battre, Zoréa/planter, Mav'ir/allumer y compris capteurs électroniques, Mékhabé/éteindre,
// Memaded/mesurer, Mé'abéd/saler-conserver), le muktsé sous toutes ses formes (objet lui-même,
// kéli chémélakhto lé'issour, bassis lédavar ha'assour), la réfoua (médicaments), et le tehoum
// Chabbat. Sont volontairement exclus : l'érouv de "hotza'a" (porter d'un domaine à un autre),
// le port d'objets dehors, et le 2e jour de Yom Tov en dehors d'Israël — non pertinents pour
// quelqu'un qui vit en Israël.
const QUIZ_CHAPTERS = [
  {
    id: "quotidien",
    title: "Les gestes du quotidien",
    subtitle: "10 questions à chaque fois, tirées d'une banque de 38, jamais deux fois la même avant d'avoir fait tout le tour",
    questions: [
      {
        id: "q1",
        scenario: "Tu presses un citron au-dessus d'un verre d'eau pour en extraire le jus et le boire.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Dash / Molid (extraire un liquide)",
        source: "Choulhan Aroukh, Orah Haim, siman 320",
        explain: "Extraire le jus d'un fruit pour le boire est considéré comme « faire naître » un nouveau liquide (מוליד), ce qui est interdit le Chabbat — même si le geste en lui-même est simple. Seuls le raisin et l'olive sont interdits d'origine biblique (deoraita) pour cet usage ; pour les autres fruits comme le citron, l'interdit est d'origine rabbinique (derabbanan).",
        howto: "Presse le citron avant l'entrée de Chabbat et garde le jus au réfrigérateur. Si tu es déjà à table, verse d'abord un peu de nourriture solide dans le verre : presser un fruit sur un aliment déjà présent (plutôt que dans le liquide seul) est permis pour beaucoup de décisionnaires."
      },
      {
        id: "q2",
        scenario: "Après t'être lavé les mains, tu essores une serviette bien trempée pour qu'elle ne reste pas mouillée.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Melabben (blanchir/laver)",
        source: "Choulhan Aroukh, Orah Haim, siman 301",
        explain: "Essorer un tissu imbibé d'eau (סחיטה) est interdit, pour la même raison que presser un fruit : on en fait sortir un liquide qui y était absorbé. Pour un tissu, c'est un dérivé du travail de « lessive » (מלבן), considéré comme un interdit d'origine biblique (deoraita).",
        howto: "Secoue la serviette ou laisse-la sécher à l'air libre sans la tordre. Si tu dois éponger quelque chose, tapote sans presser ni essorer."
      },
      {
        id: "q3",
        scenario: "Il y a un tas de pièces de monnaie ou ton téléphone posés sur la table du salon. Tu les déplaces simplement pour faire de la place, sans autre besoin.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Muktsé",
        source: "Choulhan Aroukh, Orah Haim, siman 310",
        explain: "L'argent (et par extension tout objet sans aucune utilité permise le Chabbat, comme un téléphone) est muktsé : il est interdit de le déplacer, même pour dégager la table, sauf besoin réel (protéger l'objet, libérer une place indispensable). Le muktsé est entièrement une institution rabbinique (derabbanan), il n'existe pas dans la Torah elle-même.",
        howto: "Si tu as vraiment besoin de la place, déplace l'objet muktsé indirectement (avec le coude, un objet permis, ou en le poussant) plutôt qu'à main nue, ou déplace-le avant l'entrée de Chabbat."
      },
      {
        id: "q4",
        scenario: "Avant l'entrée de Chabbat, tu laisses un plat déjà cuit, couvert, sur une plaque chauffante restée allumée (blech), pour t'en servir le lendemain à midi.",
        options: ["Permis", "Interdit"],
        correctIndex: 0,
        badge: "permis",
        level: "deoraita",
        melakha: "Bishul (cuisson)",
        source: "Choulhan Aroukh, Orah Haim, siman 253",
        explain: "C'est permis, à condition que le plat soit déjà cuisiné avant Chabbat et posé sur la source de chaleur avant l'entrée de Chabbat, sur une plaque couverte (non à flamme nue directement visible) — cela évite tout risque d'attiser le feu ou de continuer une cuisson interdite. La cuisson (בישול) elle-même est l'un des 39 travaux d'origine biblique (deoraita) ; c'est pourquoi les conditions pour rester dans le permis sont aussi strictes.",
        howto: "Pour que ce soit permis : le plat doit être entièrement cuit avant l'entrée de Chabbat, posé sur la plaque avant Chabbat, et la plaque doit être couverte (blech) pour qu'on ne voie pas la flamme directement."
      },
      {
        id: "q5",
        scenario: "Tu casses pour la première fois l'opercule ou le bouchon scellé d'un pot, sachant que le récipient vide pourra ensuite être réutilisé comme contenant.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Tikoun Kli (façonner un ustensile)",
        source: "Choulhan Aroukh, Orah Haim, siman 314",
        explain: "Le principe de ce siman interdit de façonner ou d'achever un ustensile (תיקון כלי). Les décisionnaires appliquent ce principe classique aux emballages modernes qui deviennent, une fois ouverts, un récipient réutilisable — mieux vaut les ouvrir avant Chabbat. La plupart des décisionnaires contemporains classent ce cas d'emballage jetable comme un interdit rabbinique (derabbanan), la fabrication complète d'un ustensile neuf restant le cas biblique classique.",
        howto: "Ouvre le pot ou l'emballage avant l'entrée de Chabbat. Si tu dois vraiment l'ouvrir pendant Chabbat, essaie de l'abîmer en l'ouvrant (déchirer largement, écraser) plutôt que de l'ouvrir proprement de façon à ce qu'il reste un contenant intact et réutilisable."
      },
      {
        id: "q6",
        scenario: "Tu fermes un sac plastique de courses avec un vrai double-nœud serré aux deux poignées, avec l'intention de le laisser noué ainsi un moment.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Kocher (nouer)",
        source: "Choulhan Aroukh, Orah Haim, siman 317",
        explain: "Faire un nœud destiné à durer (קשר של קיימא) est un travail interdit le Chabbat. Un nœud simple, provisoire, fait pour être défait rapidement, est généralement permis — la différence tient à l'intention de solidité et de durée. L'interdit biblique (deoraita) exige un nœud à la fois permanent ET fait selon un savoir-faire professionnel (קשר של אומן) ; un double-nœud fait par un particulier, même solide, reste donc d'origine rabbinique (derabbanan).",
        howto: "Pour fermer un sac sans transgresser, fais un nœud simple destiné à être défait rapidement plutôt qu'un double-nœud serré, ou utilise un lien élastique, une pince ou un simple tour sans nouer."
      },
      {
        id: "q7",
        scenario: "Tu fermes la porte d'entrée à clé, en tournant simplement la clé dans la serrure, avant de sortir.",
        options: ["Permis", "Interdit"],
        correctIndex: 0,
        badge: "permis",
        level: "deoraita",
        melakha: "Boneh (construire)",
        source: "Choulhan Aroukh, Orah Haim, siman 313",
        explain: "Verrouiller ou déverrouiller une porte avec sa clé normale est un usage courant de la porte, pas un acte de construction : c'est permis. La catégorie concernée, Boneh (construire), est l'un des 39 travaux d'origine biblique (deoraita) — mais un simple tour de clé n'en relève pas du tout, ce qui explique que ce soit permis sans aucune réserve.",
        howto: "Une clé mécanique classique dans une serrure normale ne pose aucun problème. Une serrure électronique, un digicode ou un cadenas à combinaison relèvent en revanche d'autres questions (usage de l'électricité, écriture des chiffres) à vérifier séparément."
      },
      {
        id: "q8",
        scenario: "Tu laves les assiettes du repas de midi avec du savon liquide, dans l'idée de les réutiliser propres pour le repas du soir, le même Chabbat.",
        options: ["Permis", "Interdit"],
        correctIndex: 0,
        badge: "permis",
        level: "derabbanan",
        melakha: "Hachana (préparer pour après Chabbat)",
        source: "Choulhan Aroukh, Orah Haim, siman 323",
        explain: "Laver la vaisselle est permis lorsqu'il y a un vrai besoin de la réutiliser avant la fin du Chabbat — ce n'est pas considéré comme un travail de préparation pour après Chabbat, mais un besoin du jour même. L'interdit de « hachana » (préparer un jour pour un autre) évité ici est d'origine rabbinique (derabbanan) ; c'est pourquoi un vrai besoin du jour même suffit à lever la réserve.",
        howto: "Ne lave que les couverts et assiettes dont tu as vraiment besoin pour la suite du Chabbat, pas toute la vaisselle sale mise de côté pour après Chabbat — ça, ça peut attendre la fin de Chabbat."
      },
      {
        id: "q9",
        scenario: "La lumière d'une chambre est restée allumée et t'empêche de dormir. Tu croises un non-juif et tu lui demandes directement de venir l'éteindre pour toi.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Amira Le-Nokri (demander à un non-juif)",
        source: "Choulhan Aroukh, Orah Haim, siman 276",
        explain: "Demander DIRECTEMENT à un non-juif d'accomplir une tâche interdite (Amira Le-Nokri) pour un simple besoin de confort ou de sommeil est formellement interdit le Chabbat. L'interdiction ne s'efface que devant un besoin vital, un cas de maladie (même sans danger) ou une perte financière majeure. C'est un interdit d'origine rabbinique (derabbanan, appelé « shvout ») : la Torah n'interdit pas au non-juif lui-même de travailler, ce sont nos sages qui ont interdit de le lui demander.",
        howto: "Si la lumière empêche de dormir, on ne peut pas donner d'ordre direct. En revanche, on peut formuler une simple phrase narrative à voix haute, sans ordre ni sous-entendu explicite (ex: 'Il y a trop de lumière ici pour dormir'). Si le non-juif choisit de lui-même de l'éteindre pour rendre service, cela est toléré dans certains cas."
      },
      {
        id: "q10",
        scenario: "Ta cour a un sol en terre battue, pas carrelé. Après un repas pris à l'extérieur, tu balaies avec un vrai balai les miettes et débris qui s'y sont accumulés.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Ḥorech (labourer)",
        source: "Choulhan Aroukh, Orah Haim, siman 337:2",
        explain: "Sur un sol en terre, balayer risque de niveler des creux ou des bosses : c'est assimilé à « aplanir le sol », un travail interdit. Sur un sol carrelé ou dallé, sans ce risque, le Choulhan Aroukh permet de balayer avec un balai — mais l'usage achkénaze, suivant le Rama, reste plus strict même sur un sol carrelé. Ramasser les miettes à la main ou avec un chiffon est permis dans tous les cas. C'est une interdiction rabbinique (derabbanan) : ce n'est pas un vrai labourage (חורש, l'un des 39 travaux bibliques), mais une mesure de précaution contre un nivellement involontaire du sol.",
        howto: "Sur un sol en terre battue, ramasse les miettes et débris à la main ou avec un chiffon plutôt qu'avec un balai. Un balai reste utilisable sans crainte sur un sol carrelé ou dallé (avec plus de réserve dans l'usage achkénaze)."
      },
      {
        id: "q11",
        scenario: "Tu déchires soigneusement, le long du pointillé prévu, un sachet de gâteaux pour l'ouvrir.",
        options: ["Permis", "Interdit"],
        correctIndex: 0,
        badge: "permis",
        level: "derabbanan",
        melakha: "Tikoun Kli (façonner un ustensile)",
        source: "Choulhan Aroukh, Orah Haim, siman 314",
        explain: "Ouvrir un emballage jetable qui ne devient pas un récipient réutilisable n'est pas « façonner un ustensile » : c'est permis, contrairement au cas d'un pot qui reste utilisable une fois ouvert. C'est la même catégorie que ce cas-là (Tikoun Kli, généralement classée derabbanan pour les emballages modernes), mais ici les conditions de l'interdit ne sont simplement pas réunies.",
        howto: "Continue de déchirer le long du pointillé prévu à cet effet. Évite d'utiliser un ciseau ou un couteau pour découper proprement l'emballage, ce qui pose un problème distinct de « découpage » (קורע) selon certains avis."
      },
      {
        id: "q12",
        scenario: "Tu signes un reçu ou tu écris ton nom au stylo sur un formulaire.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Kotev (écrire)",
        source: "Choulhan Aroukh, Orah Haim, siman 340",
        explain: "Écrire, même quelques lettres ou une simple signature, fait partie des 39 travaux interdits (כותב), et c'est un interdit d'origine biblique (deoraita), sans lien avec la longueur ou l'importance de ce qui est écrit.",
        howto: "Prépare et signe tout document nécessaire avant l'entrée de Chabbat. S'il s'agit d'un besoin réellement vital (documents administratifs urgents pour raison médicale), consulte un rav : il existe des façons de modifier l'écriture (à l'envers, avec le mauvais coude) qui allègent le niveau de l'interdit sans le supprimer."
      },
      {
        id: "q13",
        scenario: "Tu te coupes les ongles des mains avec un coupe-ongles avant de sortir.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Gozez (tondre/couper)",
        source: "Choulhan Aroukh, Orah Haim, siman 340",
        explain: "Couper les ongles est un dérivé du travail de « tonte » (גוזז), l'un des 39 travaux, séparer une partie du corps qui y était rattachée. C'est un interdit d'origine biblique (deoraita), qu'on utilise un coupe-ongles, des ciseaux ou même les dents.",
        howto: "Coupe-toi les ongles avant l'entrée de Chabbat si tu penses en avoir besoin. Le cas d'un ongle à moitié détaché qui gêne réellement est plus nuancé — demande à un rav."
      },
      {
        id: "q14",
        scenario: "Tu arroses une plante d'intérieur avec un arrosoir, comme tu le ferais n'importe quel autre jour.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Zoréa (semer/planter, par extension)",
        source: "Choulhan Aroukh, Orah Haim, siman 336",
        explain: "Arroser une plante favorise sa croissance, ce qui est rattaché par nos sages au travail de « semer » (זורע) — l'un des 39 travaux à l'origine, mais l'extension à l'arrosage de plantes déjà en terre est classée comme un interdit rabbinique (derabbanan).",
        howto: "Arrose tes plantes avant l'entrée de Chabbat. Si de l'eau se renverse involontairement sur une plante en faisant autre chose (comme laver par terre), ce n'est généralement pas un problème puisque ce n'est pas ton intention."
      },
      {
        id: "q15",
        scenario: "Il pleut. Tu ouvres un parapluie dans la rue pour te protéger en marchant.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Ohel Arai (construire une tente provisoire)",
        source: "Choulhan Aroukh, Orah Haim, siman 315",
        explain: "Ouvrir un parapluie crée une sorte de toit provisoire (אוהל עראי) au-dessus de la tête, ce que nos sages ont interdit par précaution même s'il ne s'agit pas d'une vraie construction. C'est un interdit d'origine rabbinique (derabbanan).",
        howto: "Ouvre le parapluie avant l'entrée de Chabbat si tu sais que tu en auras besoin, ou reste à l'abri sans l'ouvrir pendant Chabbat lui-même."
      },
      {
        id: "q16",
        scenario: "Tu actionnes l'interrupteur pour allumer la lumière électrique d'une pièce.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Mav'ir (allumer un feu)",
        source: "Choulhan Aroukh, Orah Haim, siman 278",
        explain: "Le Choulhan Aroukh interdit d'allumer une flamme (מבעיר) le Chabbat, l'un des 39 travaux d'origine biblique (deoraita) ; les décisionnaires appliquent ce même principe à la fermeture d'un circuit électrique qui produit de la lumière, pour la même raison de fond.",
        howto: "Prépare l'éclairage dont tu as besoin avant l'entrée de Chabbat (minuteur, lumière laissée allumée, ou éteinte dans la pièce où tu ne vas pas). N'actionne aucun interrupteur pendant Chabbat, même pour éteindre."
      },
      {
        id: "q17",
        scenario: "Tu te coiffes avec une vraie brosse à cheveux aux poils durs, alors que tes cheveux sont un peu emmêlés.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Gozez (tondre/couper, par précaution)",
        source: "Choulhan Aroukh, Orah Haim, siman 303",
        explain: "Se coiffer avec une brosse dure sur des cheveux emmêlés risque d'arracher des cheveux, ce qui rejoindrait le travail de « tonte » (גוזז). Comme ce n'est pas l'intention et que le résultat n'est pas certain, c'est classé comme un interdit rabbinique (derabbanan) — mais bien réel.",
        howto: "Utilise un peigne à dents larges ou une brosse souple, en démêlant doucement, plutôt qu'une brosse dure sur des nœuds serrés."
      },
      {
        id: "q18",
        scenario: "Un bol contient un mélange d'amandes et de noisettes. Tu retires toutes les amandes pour les mettre de côté, en vue de les manger seulement dans une heure.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Borer (trier/sélectionner)",
        source: "Choulhan Aroukh, Orah Haim, siman 319",
        explain: "Trier un mélange en séparant ce qu'on veut manger de ce qu'on ne veut pas est le travail de « Borer » (בורר), l'un des 39 travaux, interdit d'origine biblique (deoraita) lorsqu'on sépare pour plus tard plutôt que pour une consommation immédiate.",
        howto: "Retire les amandes seulement au moment de les manger tout de suite (Borer est permis à la main, pour consommation immédiate). Si tu veux les mettre de côté pour plus tard, prends plutôt les noisettes (ce que tu ne veux pas garder) pour les jeter, ou attends après Chabbat."
      },
      {
        id: "q19",
        scenario: "Tu presses un citron directement au-dessus de ta tasse de thé, qui contient déjà les feuilles de thé et du sucre.",
        options: ["Permis", "Interdit"],
        correctIndex: 0,
        badge: "permis",
        level: "derabbanan",
        melakha: "Dash / Molid (extraire un liquide)",
        source: "Choulhan Aroukh, Orah Haim, siman 320",
        explain: "Contrairement au cas de presser un citron dans un verre d'eau pure, presser un fruit directement sur un aliment déjà présent dans le récipient est permis pour beaucoup de décisionnaires : ce n'est plus perçu comme fabriquer un jus, mais comme assaisonner une boisson déjà préparée.",
        howto: "Assure-toi qu'il y a déjà quelque chose dans la tasse (thé, sucre) avant de presser le citron dessus — presser directement dans un verre d'eau pure resterait interdit."
      },
      {
        id: "q20",
        scenario: "Tu cueilles une fleur dans le jardin, ou un fruit encore accroché à sa branche sur un arbre en pot.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Kotzer (moissonner/cueillir)",
        source: "Choulhan Aroukh, Orah Haim, siman 336",
        explain: "Détacher un fruit ou une fleur de la plante qui les a fait pousser est le travail de « moisson » (קוצר), l'un des 39 travaux, interdit d'origine biblique (deoraita) — que ce soit dans un champ ou dans un pot de fleurs sur le balcon.",
        howto: "Cueille avant l'entrée de Chabbat tout ce que tu penses vouloir utiliser (fleurs pour la table, fruits du jardin). Une fois détaché tout seul (fruit tombé), il n'est en général pas muktsé et peut être ramassé."
      },
      {
        id: "q21",
        scenario: "Tu casses la coquille de pistaches ou de noix avec les doigts pour les manger tout de suite à table.",
        options: ["Permis", "Interdit"],
        correctIndex: 0,
        badge: "permis",
        level: "deoraita",
        melakha: "Dash (battre/séparer)",
        source: "Choulhan Aroukh, Orah Haim, siman 319",
        explain: "Séparer un fruit de son enveloppe naturelle est en principe rattaché au travail de « battre » (דש), d'origine biblique (deoraita). Mais écaler des fruits à coque pour les manger immédiatement est la façon normale de les consommer (דרך אכילה) : ce n'est pas perçu comme un travail agricole de traitement, donc c'est permis.",
        howto: "Écale au fur et à mesure, juste avant de manger. Évite d'écaler une grande quantité à l'avance pour la stocker ou la donner à quelqu'un d'autre plus tard : cela se rapprocherait davantage d'un vrai travail de traitement."
      },
      {
        id: "q22",
        scenario: "Un bouton de ta chemise est tombé. Tu prends une aiguille et du fil pour le recoudre.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Tofer (coudre)",
        source: "Choulhan Aroukh, Orah Haim, siman 340",
        explain: "Coudre, même quelques points ou un seul bouton, fait partie des 39 travaux (תופר), interdit d'origine biblique (deoraita), indépendamment de la taille de la réparation.",
        howto: "Recouds le bouton avant l'entrée de Chabbat, ou porte un autre vêtement pour l'instant. Une épingle à nourrice pour tenir temporairement un vêtement est généralement plus tolérée qu'une vraie couture, à vérifier selon les avis."
      },
      {
        id: "q23",
        scenario: "Tu agrafes ensemble plusieurs feuilles de papier avec une agrafeuse, pour qu'elles restent attachées.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Tofer (coudre, par extension)",
        source: "Choulhan Aroukh, Orah Haim, siman 340",
        explain: "Agrafer des feuilles pour les maintenir assemblées durablement est rapproché par les décisionnaires du travail de « coudre » (תופר) — assembler deux éléments de façon durable. Pour un objet moderne comme l'agrafeuse, l'extension du principe classique est généralement classée comme un interdit rabbinique (derabbanan).",
        howto: "Agrafe les documents dont tu sais avoir besoin avant l'entrée de Chabbat, ou utilise un trombone (qui ne crée pas d'attache permanente) pour les regrouper temporairement."
      },
      {
        id: "q24",
        scenario: "Une bougie de Chabbat est encore allumée alors que le repas est terminé depuis longtemps. Tu la souffles simplement parce qu'elle ne sert plus, sans aucun danger.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Mekhabé (éteindre)",
        source: "Choulhan Aroukh, Orah Haim, siman 278",
        explain: "Éteindre une flamme (מכבה) est l'un des 39 travaux, interdit d'origine biblique (deoraita), même quand la bougie n'a plus d'utilité et qu'il n'y a aucun risque — contrairement au cas d'un vrai danger (incendie), qui autorise à éteindre.",
        howto: "Laisse la bougie se consumer et s'éteindre toute seule. Si elle représente un vrai risque (proche d'un rideau, d'un objet inflammable), l'éteindre reste permis dans ce cas précis."
      },
      {
        id: "q25",
        scenario: "En pleine semaine (pas pour le repas de Chabbat), tu utilises une balance de cuisine électronique pour peser exactement 200 grammes de farine en vue d'une recette.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Memadéd (mesurer)",
        source: "Choulhan Aroukh, Orah Haim, siman 306",
        explain: "Mesurer précisément une quantité, en dehors d'un besoin direct du repas de Chabbat, est un interdit rabbinique (derabbanan) : Chabbat n'est pas un jour pour peser et calculer en vue d'une activité de la semaine.",
        howto: "Prépare et pèse tes ingrédients avant l'entrée de Chabbat si c'est pour après. Mesurer approximativement, à l'œil, pose beaucoup moins de problème qu'une pesée exacte au gramme près."
      },
      {
        id: "q26",
        scenario: "Tu prends une photo avec ton smartphone pour immortaliser un moment en famille.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Kotev (écrire, par extension)",
        source: "Choulhan Aroukh, Orah Haim, siman 340",
        explain: "Le Choulhan Aroukh (16e siècle) ne pouvait pas parler littéralement de photographie, mais les décisionnaires contemporains rattachent la création d'une image numérique permanente au principe de « former une trace durable », dans la même famille que l'écriture (כותב) — un interdit d'origine biblique (deoraita) pour cette catégorie de travail, en plus de l'usage de l'électronique lui-même.",
        howto: "Prends tes photos avant l'entrée de Chabbat. Pendant Chabbat, profite du moment sans essayer de le capturer — c'est aussi l'esprit du jour."
      },
      {
        id: "q27",
        scenario: "Tu utilises un moulin à poivre classique pour moudre du poivre frais directement sur ton assiette.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Tochén (moudre)",
        source: "Choulhan Aroukh, Orah Haim, siman 321",
        explain: "Moudre, même une petite quantité et même pour une consommation immédiate, est le travail de « moudre » (טוחן), l'un des 39 travaux, interdit d'origine biblique (deoraita) — contrairement au tri (Borer) ou à l'écalage, moudre n'a pas d'exception pour la consommation immédiate.",
        howto: "Moulds le poivre (ou toute épice) avant l'entrée de Chabbat et garde-le dans un petit récipient prêt à l'emploi, ou utilise du poivre déjà moulu."
      },
      {
        id: "q28",
        scenario: "Tu verses de l'eau bouillante, fraîchement sortie de la bouilloire, directement sur des feuilles de thé pour préparer une infusion.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Bishoul (cuire, par transvasement — Iroui Kli Richon)",
        source: "Choulhan Aroukh, Orah Haim, siman 318",
        explain: "Verser un liquide bouillant directement depuis son récipient de cuisson (« kéli richon ») sur un aliment cru le fait réellement cuire, même sans le remettre sur le feu. C'est une forme de cuisson, interdit d'origine biblique (deoraita).",
        howto: "Prépare ton thé avec de l'essence de thé préparée avant Chabbat, ou verse d'abord l'eau chaude dans une tasse vide (elle devient un « kéli chlichi », un 3e récipient) puis ajoute les feuilles — selon les avis suivis par ta communauté, demande à ton rav le protocole exact."
      },
      {
        id: "q29",
        scenario: "Tu as retiré une casserole de la plaque chauffante (blech) et tu l'as posée sur le plan de travail. Une heure plus tard, tu veux la reposer sur le blech pour garder le plat au chaud.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Bishoul (cuire — Ha'hazara, remettre un plat sur le feu)",
        source: "Choulhan Aroukh, Orah Haim, siman 253",
        explain: "Remettre un plat sur une source de chaleur (« ha'hazara ») n'est permis que sous des conditions strictes : le plat doit être tenu en main sans jamais être posé, la plaque doit être couverte, et le plat doit déjà être au moins partiellement cuit. Dès qu'on l'a posé sur le plan de travail, ces conditions ne sont plus réunies : le reposer est un interdit rabbinique (derabbanan).",
        howto: "Si tu enlèves un plat du blech, garde-le à la main sans le poser si tu comptes le reposer, ou dépose-le d'emblée sur une plaque annexe déjà prévue à cet effet dès le départ."
      },
      {
        id: "q30",
        scenario: "Tu te laves les mains avec un savon liquide ou un shampoing qui mousse abondamment.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Molid (créer une substance nouvelle — la mousse)",
        source: "Choulhan Aroukh, Orah Haim, siman 302",
        explain: "Créer de la mousse ou de l'écume est considéré comme « faire naître » (molid) une nouvelle substance qui n'existait pas auparavant, un interdit d'origine rabbinique (derabbanan) rattaché à l'esprit du travail de pétrir (Lash).",
        howto: "Utilise un savon dur (pain de savon) plutôt qu'un savon liquide, ou un savon liquide spécial « Chabbat » qui ne mousse pas, disponible dans le commerce."
      },
      {
        id: "q31",
        scenario: "Avant Chabbat, tu poses ton téléphone (muktsé) sur une chaise. Pendant Chabbat, tu veux déplacer cette chaise pour t'asseoir ailleurs, alors que le téléphone est resté dessus.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Muktsé (bassis lédavar ha'assour — support d'un objet muktsé)",
        source: "Choulhan Aroukh, Orah Haim, siman 309",
        explain: "Un objet permis qui sert de support (« bassis ») à un objet muktsé, posé intentionnellement dessus avant Chabbat, devient lui-même muktsé et ne peut pas être déplacé tant que l'objet muktsé s'y trouve — sauf besoin réel de la chaise elle-même (comme s'asseoir dessus là où elle est).",
        howto: "Avant Chabbat, prends l'habitude de ne rien poser de muktsé sur des meubles que tu comptes déplacer. Si besoin, on peut retirer l'objet muktsé lui-même avec le dos de la main ou un objet permis, plutôt que de déplacer le support."
      },
      {
        id: "q32",
        scenario: "Tu as un léger mal de tête ordinaire et tu prends un comprimé antidouleur, comme tu le ferais n'importe quel autre jour.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Réfoua (décret rabbinique sur les médicaments — chéhikat samamanim)",
        source: "Choulhan Aroukh, Orah Haim, siman 328",
        explain: "Les sages ont institué un décret général interdisant de prendre un médicament pour un malaise léger et courant, de peur qu'on en vienne à broyer soi-même des remèdes (moudre) le jour de Chabbat. Cet interdit rabbinique (derabbanan) ne s'applique pas en cas de réelle souffrance ou de maladie plus sérieuse — dans ce cas, il faut se renseigner car les règles s'assouplissent nettement.",
        howto: "Pour un inconfort mineur et habituel, essaie d'attendre la fin de Chabbat. En cas de douleur plus forte, de fièvre, ou de doute sur la gravité, un médicament reste permis — demande à ton rav si tu hésites."
      },
      {
        id: "q33",
        scenario: "Pour préparer un biberon, tu verses de l'eau bouillante fraîchement sortie de la bouilloire directement sur la poudre de lait infantile.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "deoraita",
        melakha: "Bishoul (cuire, par transvasement — Iroui Kli Richon)",
        source: "Choulhan Aroukh, Orah Haim, siman 318",
        explain: "Comme pour le thé, verser un liquide bouillant sortant directement de son récipient de cuisson sur une poudre la fait cuire — un interdit d'origine biblique (deoraita), même s'il s'agit de nourrir un bébé.",
        howto: "Prépare à l'avance de l'eau chaude dans un thermos (déjà en dessous du seuil de cuisson, « yad soledet bo »), ou verse l'eau chaude dans un biberon vide (kéli chlichi) avant d'y ajouter la poudre. Demande à ton rav la méthode recommandée — les besoins d'un nourrisson permettent souvent des solutions pratiques."
      },
      {
        id: "q34",
        scenario: "Tu utilises des feuilles de papier essuie-tout ou de papier toilette déjà pré-découpées, préparées avant l'entrée de Chabbat.",
        options: ["Permis", "Interdit"],
        correctIndex: 0,
        badge: "permis",
        level: "derabbanan",
        melakha: "Kore'a (déchirer)",
        source: "Choulhan Aroukh, Orah Haim, siman 340",
        explain: "Le problème du papier toilette ou essuie-tout en rouleau est qu'il faut le déchirer pour le séparer, ce qui pose un problème de Kore'a. Si les feuilles sont déjà séparées avant Chabbat, il n'y a plus aucun acte de déchirer à faire — leur usage est donc permis.",
        howto: "Prépare et découpe à l'avance des piles de papier toilette et d'essuie-tout avant l'entrée de Chabbat, pour toute la durée du Chabbat."
      },
      {
        id: "q35",
        scenario: "Tu pars te promener à pied, loin de chez toi, jusqu'à dépasser la limite de ta ville ou de ton quartier (« tehoum Chabbat »), sans qu'aucun érouv de tehoumin n'ait été établi.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Tehoum Chabbat (limite de déplacement)",
        source: "Choulhan Aroukh, Orah Haim, siman 397",
        explain: "Au-delà d'une certaine distance depuis les habitations de sa ville (environ 2000 coudées, soit un peu moins d'un kilomètre, dans le prolongement de l'agglomération), il est interdit rabbiniquement de marcher le jour de Chabbat. Cette limite est distincte de l'érouv de « hotza'a » (le fait de porter d'un domaine à un autre) : ici, il s'agit uniquement d'une distance de marche.",
        howto: "Renseigne-toi sur les limites de tehoum de ta ville avant de partir en promenade longue le jour de Chabbat, en particulier si tu marches vers une localité voisine."
      },
      {
        id: "q36",
        scenario: "Tu utilises un marteau (un outil « dont l'usage habituel est interdit ») uniquement pour caler une porte qui grince, sans t'en servir pour marteler quoi que ce soit.",
        options: ["Permis", "Interdit"],
        correctIndex: 0,
        badge: "permis",
        level: "derabbanan",
        melakha: "Muktsé (kéli chémélakhto lé'issour)",
        source: "Choulhan Aroukh, Orah Haim, siman 308",
        explain: "Un outil dont l'usage principal est une activité interdite (« kéli chémélakhto lé'issour ») reste malgré tout déplaçable pour un besoin réel de l'objet lui-même ou de la place qu'il occupe — ici, on utilise le marteau lui-même comme cale, ce qui est un usage direct et permis de l'objet, pas de son usage habituel de martelage.",
        howto: "Rappelle-toi la distinction : un outil « lé'issour » peut être déplacé s'il sert lui-même à quelque chose de permis, mais pas juste pour le ranger sans raison — dans ce cas il faudrait un léger besoin supplémentaire (« tsorekh mékomo »)."
      },
      {
        id: "q37",
        scenario: "Tu passes tes mains sous un robinet équipé d'un capteur automatique, qui déclenche l'écoulement de l'eau électroniquement dès qu'il détecte ta présence.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Mav'ir (allumer un circuit électrique, par déclenchement)",
        source: "Choulhan Aroukh, Orah Haim, siman 278",
        explain: "Même si tu n'appuies sur aucun interrupteur, ton geste déclenche directement un circuit électrique. La majorité des décisionnaires traitent ce déclenchement direct comme un acte actif plutôt qu'un simple effet indirect (« grama »), ce qui le classe comme interdit lié au même principe que l'interrupteur électrique.",
        howto: "Cherche les robinets, distributeurs de savon ou éclairages à commande manuelle dans les lieux publics le jour de Chabbat, ou évite-les si une alternative existe."
      },
      {
        id: "q38",
        scenario: "Tu prépares une grande quantité de concombres dans une saumure de vinaigre et de sel, pour qu'ils marinent plusieurs jours avant d'être consommés la semaine suivante.",
        options: ["Permis", "Interdit"],
        correctIndex: 1,
        badge: "interdit",
        level: "derabbanan",
        melakha: "Mé'abéd (saler/conserver — dérivé de tanner)",
        source: "Choulhan Aroukh, Orah Haim, siman 321",
        explain: "Saler ou mariner un aliment dans le but explicite de le conserver pendant une longue durée est rattaché au travail de « tanner » (mé'abéd), un interdit d'origine rabbinique (derabbanan) lorsqu'il s'agit d'un aliment — à distinguer d'assaisonner une petite quantité pour une consommation immédiate, qui reste permis.",
        howto: "Prépare tes marinades et conserves avant l'entrée de Chabbat. Le jour même, tu peux assaisonner une portion destinée à être mangée dans l'heure, mais pas en grande quantité en vue de la semaine."
      }
    ]
  }
];

let quizCurrentChapterId = null;
let quizSessionQuestions = [];
let quizCurrentIndex = 0;
let quizScore = 0;
let quizWrongCount = 0;
let quizAnswered = false;

// On tire jusqu'à 10 questions à chaque nouvelle entrée dans un chapitre, dans un ordre aléatoire.
const QUIZ_TARGET_LEN = 10;

function quizGetChapter(id){
  return QUIZ_CHAPTERS.find(c => c.id === id);
}

function quizShuffle(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Les questions ratées sont mémorisées par chapitre (sur ce téléphone) et repassent en priorité
// dans un futur questionnaire — pas forcément le suivant, selon le tirage aléatoire — jusqu'à ce
// qu'elles soient répondues correctement une fois.
function quizMissedKey(chapterId){ return "quizMissed_" + chapterId; }
function quizGetMissedIds(chapterId){
  try{ return JSON.parse(localStorage.getItem(quizMissedKey(chapterId)) || "[]"); }
  catch(e){ return []; }
}
function quizSetMissedIds(chapterId, ids){
  localStorage.setItem(quizMissedKey(chapterId), JSON.stringify(ids));
}
function quizMarkMissed(chapterId, questionId){
  const ids = quizGetMissedIds(chapterId);
  if(!ids.includes(questionId)){
    ids.push(questionId);
    quizSetMissedIds(chapterId, ids);
  }
}
function quizMarkResolved(chapterId, questionId){
  const ids = quizGetMissedIds(chapterId).filter(id => id !== questionId);
  quizSetMissedIds(chapterId, ids);
}

// Construit un nouveau questionnaire tiré au hasard : les questions déjà ratées passent en
// priorité (et peuvent être répétées pour combler jusqu'à 10 si le total de questions disponibles
// est encore petit), puis on complète avec des questions fraîches, dans un ordre mélangé.
// ---------- Rotation "chaque question vue une fois avant de repasser" ----------
// Un tirage purement aléatoire (même avec priorité aux ratées) pouvait redonner en grande partie
// le même lot d'une session à l'autre dès que la banque fixe est petite par rapport à la taille
// d'un questionnaire (ex : 19 questions pour des sessions de 10 → au moins 1 question commune
// garantie, souvent beaucoup plus par hasard). On coche donc explicitement, sur ce téléphone,
// les questions déjà montrées dans le "cycle" en cours, et on ne les repropose qu'une fois que
// TOUTE la banque du chapitre est passée.
function quizCycleKey(chapterId){ return "quizCycleUsed_" + chapterId; }
function quizGetCycleUsed(chapterId){
  try{ return JSON.parse(localStorage.getItem(quizCycleKey(chapterId)) || "[]"); }
  catch(e){ return []; }
}
function quizAddCycleUsed(chapterId, ids){
  const merged = Array.from(new Set(quizGetCycleUsed(chapterId).concat(ids)));
  localStorage.setItem(quizCycleKey(chapterId), JSON.stringify(merged));
}
function quizResetCycle(chapterId){
  localStorage.setItem(quizCycleKey(chapterId), JSON.stringify([]));
}

function quizBuildSession(chapter, targetLen){
  targetLen = targetLen || QUIZ_TARGET_LEN;
  if(targetLen <= 0) return [];

  const missedIds = quizGetMissedIds(chapter.id);
  const usedIds = quizGetCycleUsed(chapter.id);

  // Les questions ratées passent en priorité, mais seulement si elles n'ont pas déjà été
  // montrées dans le cycle en cours (sinon elles écraseraient la rotation).
  const missedCap = Math.max(1, Math.ceil(targetLen * 0.3));
  const missedAvailable = quizShuffle(chapter.questions.filter(q => missedIds.includes(q.id) && !usedIds.includes(q.id)));
  const missedPick = missedAvailable.slice(0, missedCap);
  const pickedIds = new Set(missedPick.map(q => q.id));

  // Le reste vient exclusivement de ce qui n'a pas encore été vu dans ce cycle.
  const unseenPool = quizShuffle(chapter.questions.filter(q => !usedIds.includes(q.id) && !pickedIds.has(q.id)));
  let session = missedPick.concat(unseenPool).slice(0, targetLen);

  // Si le cycle ne fournit pas assez de questions inédites pour remplir la session (on a fait le
  // tour de toute la banque), on relance un nouveau cycle et on complète avec les questions déjà
  // vues avant — mais jamais deux fois la même question à l'intérieur d'UNE session.
  if(session.length < targetLen && chapter.questions.length > session.length){
    quizResetCycle(chapter.id);
    const sessionIds = new Set(session.map(q => q.id));
    const rest = quizShuffle(chapter.questions.filter(q => !sessionIds.has(q.id)));
    session = session.concat(rest).slice(0, targetLen);
  }

  // On coche toutes les questions de cette session comme "vues" pour le cycle en cours : elles ne
  // repasseront qu'après avoir fait le tour du reste de la banque de ce chapitre.
  quizAddCycleUsed(chapter.id, session.map(q => q.id));

  return quizShuffle(session);
}

// Score cumulé sur ce téléphone, additionné à la fin de chaque quiz terminé (pas remis à zéro
// entre les sessions, contrairement à quizScore/quizWrongCount qui repartent à 0 à chaque quiz).
function quizGetCumulative(){
  return {
    correct: parseInt(localStorage.getItem("quizCumulCorrect") || "0", 10),
    wrong: parseInt(localStorage.getItem("quizCumulWrong") || "0", 10)
  };
}
function quizAddToCumulative(correct, wrong){
  const cur = quizGetCumulative();
  localStorage.setItem("quizCumulCorrect", String(cur.correct + correct));
  localStorage.setItem("quizCumulWrong", String(cur.wrong + wrong));
}

function initQuizList(){
  const listEl = document.getElementById("quizChapterList");
  listEl.innerHTML = QUIZ_CHAPTERS.map(ch =>
    '<div class="quiz-chapter" data-id="' + ch.id + '">' +
      '<div class="quiz-chapter-title">' + ch.title + '</div>' +
      '<div class="quiz-chapter-sub">' + ch.subtitle + '</div>' +
    '</div>'
  ).join("") +
  '<div class="quiz-chapter soon"><div class="quiz-chapter-title">Porter dehors et l\'erouv</div><div class="quiz-chapter-sub">à venir</div></div>' +
  '<div class="quiz-chapter soon"><div class="quiz-chapter-title">Les animaux (siman 304-305)</div><div class="quiz-chapter-sub">à venir</div></div>';

  // Ouverture d'un chapitre : entièrement local, aucun appel réseau. La banque fixe de ce
  // chapitre fournit directement la session (rotation "chaque question vue une fois avant de
  // repasser" gérée par quizBuildSession), donc c'est instantané et fonctionne hors-ligne.
  const onClick = (e) => {
    const card = e.target.closest(".quiz-chapter");
    if(!card || card.classList.contains("soon")) return;
    const chapterId = card.getAttribute("data-id");
    const chapter = quizGetChapter(chapterId);

    quizCurrentChapterId = chapterId;
    quizSessionQuestions = quizBuildSession(chapter, QUIZ_TARGET_LEN);
    quizCurrentIndex = 0;
    quizScore = 0;
    quizWrongCount = 0;
    goTo("quizPlay");
  };
  listEl.addEventListener("click", onClick);

  return () => {
    listEl.removeEventListener("click", onClick);
  };
}

function quizRenderQuestion(){
  const q = quizSessionQuestions[quizCurrentIndex];
  quizAnswered = false;

  document.getElementById("quizProgress").textContent =
    "Question " + (quizCurrentIndex + 1) + " sur " + quizSessionQuestions.length + " · Score : " + quizScore;
  document.getElementById("quizScenario").textContent = q.scenario;

  const optionsEl = document.getElementById("quizOptions");
  optionsEl.innerHTML = q.options.map((opt, i) =>
    '<div class="quiz-option" data-idx="' + i + '"><span class="quiz-option-label">' + opt + '</span><span class="quiz-option-icon"></span></div>'
  ).join("");

  document.getElementById("quizAnswer").style.display = "none";
  document.getElementById("quizNextBtn").style.display = "none";
  document.getElementById("quizHowto").style.display = "none";
  document.getElementById("quizAiInput").value = "";
  aiResetThread("quizAiAnswer");
  updateCaAiNote("quizAiNote");
  document.getElementById("quizPlay").scrollTo({ top: 0, behavior: "auto" });
}

// Q&A libre sur le cas de quiz affiché, sur le même principe que caAskGemini pour le Choulhan
// Aroukh : on donne à Gemini le scénario, la réponse attendue, la source et l'explication déjà
// affichées, puis la question de l'utilisateur. Le prompt lui demande explicitement de corriger
// toute simplification excessive plutôt que de la valider telle quelle. Comme pour caAskGemini,
// les relances suivantes passent par aiConverse et gardent la mémoire de tout l'échange.
async function quizAskGemini(question, answerElId){
  const q = quizSessionQuestions[quizCurrentIndex];
  const contextText = "Mise en situation du quiz : " + q.scenario +
    "\nRéponse attendue : " + (q.correctIndex === 0 ? "Permis" : "Interdit") +
    (q.melakha ? ("\nCatégorie de travail / thème concerné : " + q.melakha) : "") +
    (q.level ? ("\nNiveau de cette catégorie : " + (q.level === "deoraita" ? "d'origine biblique (deoraita)" : "d'origine rabbinique (derabbanan)")) : "") +
    "\nSource citée : " + q.source +
    "\nExplication donnée dans le quiz : " + q.explain +
    (q.howto ? ("\nConseil pratique donné dans le quiz : " + q.howto) : "");
  const finalInstruction =
    "Réponds en français. Base-toi sur le contexte fourni, mais si la situation du quiz ou sa source contiennent des raccourcis ou des imprécisions halachiques par rapport à la loi stricte (Halakha), signale-le gentiment au lieu de valider l'erreur, et détaille précisément la nuance réelle. Consigne de style : réponse complète et précise, ne saute aucune étape de raisonnement nécessaire à la compréhension, mais reste concis (pas de répétitions ni de remplissage inutile) — au maximum 5 à 6 phrases. Pas de liste à puces, pas de titres, pas de mise en forme markdown (n'utilise jamais d'astérisques ni de tirets de liste) : texte brut uniquement, va droit à la réponse.";
  await aiConverse(answerElId, question, "Voici une question d'un quiz sur les halachot de Chabbat, avec sa réponse et son explication :\n\n" + contextText, finalInstruction);
}

function initQuizPlay(){
  if(!quizCurrentChapterId || !quizSessionQuestions.length){
    // Sécurité : si on arrive ici sans chapitre choisi (ex. retour arrière Android), on revient à la liste.
    goTo("quizList");
    return () => {};
  }
  quizRenderQuestion();

  const optionsEl = document.getElementById("quizOptions");
  const nextBtn = document.getElementById("quizNextBtn");

  const onOptionClick = (e) => {
    if(quizAnswered) return;
    const optEl = e.target.closest(".quiz-option");
    if(!optEl) return;
    quizAnswered = true;

    const q = quizSessionQuestions[quizCurrentIndex];
    const chosenIdx = parseInt(optEl.getAttribute("data-idx"), 10);
    const isCorrect = chosenIdx === q.correctIndex;
    if(isCorrect){
      quizScore++;
      quizMarkResolved(quizCurrentChapterId, q.id);
    } else {
      quizWrongCount++;
      quizMarkMissed(quizCurrentChapterId, q.id);
    }

    optionsEl.querySelectorAll(".quiz-option").forEach((el) => {
      el.classList.add("disabled");
      const idx = parseInt(el.getAttribute("data-idx"), 10);
      const iconEl = el.querySelector(".quiz-option-icon");
      if(idx === q.correctIndex){
        el.classList.add("correct");
        if(iconEl) iconEl.textContent = "✓";
      } else if(idx === chosenIdx){
        el.classList.add("wrong");
        if(iconEl) iconEl.textContent = "✗";
      }
    });

    const feedbackEl = document.getElementById("quizFeedback");
    feedbackEl.textContent = isCorrect ? "✓ Ta réponse était juste" : "✗ Ta réponse était fausse";
    feedbackEl.className = "quiz-feedback " + (isCorrect ? "right" : "wrong");

    const badgeEl = document.getElementById("quizBadge");
    badgeEl.textContent = q.badge === "permis" ? "✓ Permis" : "✗ Interdit";
    badgeEl.className = "ca-badge " + q.badge;

    // Second badge : précise si l'interdit (ou la catégorie de travail concernée) est d'origine
    // biblique (deoraita) ou rabbinique (derabbanan), comme sur les pages du Choulhan Aroukh.
    const levelEl = document.getElementById("quizLevelBadge");
    if(q.level){
      levelEl.textContent = q.level === "deoraita" ? "דאורייתא · deoraita" : "דרבנן · derabbanan";
      levelEl.className = "ca-badge " + q.level;
      levelEl.style.display = "inline-block";
    } else {
      levelEl.style.display = "none";
    }

    // Troisième badge : siman + nom de la melakha/thème concerné (ex. "Siman 337 · Ḥorech
    // (labourer)"), pour situer chaque question dans les 39 travaux ou les catégories rabbiniques,
    // sans avoir besoin d'aller chercher le numéro de siman dans la ligne de source en dessous.
    const themeEl = document.getElementById("quizThemeBadge");
    if(q.melakha){
      const simanMatch = String(q.source || "").match(/siman\s+([0-9:]+)/i);
      themeEl.textContent = (simanMatch ? "Siman " + simanMatch[1] + " · " : "") + q.melakha;
      themeEl.style.display = "inline-block";
    } else {
      themeEl.style.display = "none";
    }

    document.getElementById("quizSource").textContent = q.source;
    document.getElementById("quizExplain").textContent = q.explain;

    const howtoEl = document.getElementById("quizHowto");
    if(q.howto){
      howtoEl.textContent = q.howto;
      howtoEl.style.display = "block";
    } else {
      howtoEl.style.display = "none";
    }

    document.getElementById("quizAnswer").style.display = "block";

    const isLast = quizCurrentIndex >= quizSessionQuestions.length - 1;
    nextBtn.textContent = isLast ? "Voir mon score →" : "Question suivante →";
    nextBtn.style.display = "block";

    document.getElementById("quizProgress").textContent =
      "Question " + (quizCurrentIndex + 1) + " sur " + quizSessionQuestions.length + " · Score : " + quizScore;
  };

  // Le bouton "Question suivante" devient "Retour aux chapitres" en fin de parcours, mais on
  // garde UN SEUL gestionnaire stable (piloté par ce flag) plutôt que de le remplacer par un
  // second addEventListener : remplacer le gestionnaire cassait le nettoyage de cet écran (la
  // fonction de cleanup ne connaissait que l'ancien handler), ce qui laissait un handler fantôme
  // s'accumuler à chaque partie et bloquait le quiz dès la 2e ouverture.
  let quizFinished = false;

  const onNext = () => {
    if(quizFinished){
      goTo("quizList");
      return;
    }
    if(quizCurrentIndex >= quizSessionQuestions.length - 1){
      // Fin du quiz : on ajoute le score de cette session au cumul persistant sur le téléphone,
      // une seule fois (ce bloc ne s'exécute qu'à la toute fin du quiz).
      quizFinished = true;
      quizAddToCumulative(quizScore, quizWrongCount);
      const cumul = quizGetCumulative();
      document.getElementById("quizProgress").textContent = "Quiz terminé";
      document.getElementById("quizScenario").innerHTML =
        '<div class="quiz-score-row">' +
          '<div class="quiz-score-item"><div class="quiz-score-num right">' + quizScore + ' ✓</div><div class="quiz-score-label">bonnes</div></div>' +
          '<div class="quiz-score-item"><div class="quiz-score-num wrong">' + quizWrongCount + ' ✗</div><div class="quiz-score-label">fausses</div></div>' +
        '</div>' +
        '<div class="quiz-cumul-label">Cumulé depuis le début</div>' +
        '<div class="quiz-score-row">' +
          '<div class="quiz-score-item"><div class="quiz-score-num right">' + cumul.correct + ' ✓</div></div>' +
          '<div class="quiz-score-item"><div class="quiz-score-num wrong">' + cumul.wrong + ' ✗</div></div>' +
        '</div>';
      document.getElementById("quizOptions").innerHTML = "";
      document.getElementById("quizAnswer").style.display = "none";
      nextBtn.textContent = "Retour aux chapitres →";
      return;
    }
    quizCurrentIndex++;
    quizRenderQuestion();
  };

  const quizAiBtn = document.getElementById("quizAiBtn");
  const onAskQuiz = () => {
    const inputEl = document.getElementById("quizAiInput");
    const question = inputEl.value;
    inputEl.value = "";
    quizAskGemini(question, "quizAiAnswer");
  };

  optionsEl.addEventListener("click", onOptionClick);
  nextBtn.addEventListener("click", onNext);
  quizAiBtn.addEventListener("click", onAskQuiz);

  return () => {
    optionsEl.removeEventListener("click", onOptionClick);
    nextBtn.removeEventListener("click", onNext);
    quizAiBtn.removeEventListener("click", onAskQuiz);
  };
}

// ---------- RÉGLAGES (clé API Gemini) ----------
function initSettings(){
  const input = document.getElementById("geminiKeyInput");
  const saveBtn = document.getElementById("geminiKeySave");
  const status = document.getElementById("geminiKeyStatus");
  input.value = localStorage.getItem("geminiApiKey") || "";
  status.textContent = "";

  const onSave = () => {
    localStorage.setItem("geminiApiKey", input.value.trim());
    status.textContent = input.value.trim() ? "Clé enregistrée sur ce téléphone." : "Clé effacée.";
  };
  saveBtn.addEventListener("click", onSave);

  return () => {
    saveBtn.removeEventListener("click", onSave);
  };
}

// ---------- SERVICE WORKER ----------
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}
