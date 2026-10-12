const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

let bgmAtiva = false, proximoTempoNota = 0, indiceNota = 0, tempoLoop;

// 3 OPÇÕES DE MÚSICAS
const MELODIAS = [
    [220, 261.63, 329.63, 440, 329.63, 261.63], // 0: Aventura (Padrão)
    [261.63, 392.00, 329.63, 523.25, 392.00],   // 1: Épica
    [146.83, 164.81, 174.61, 220.00, 174.61]    // 2: Mistério
];

function iniciarAudio() { if (!audioCtx) audioCtx = new AudioContext(); if (audioCtx.state === 'suspended') audioCtx.resume(); }

function loopBGM() {
    if(!bgmAtiva || saveGlobal.config.volMusica === 0) return;
    while (audioCtx && proximoTempoNota < audioCtx.currentTime + 0.1) {
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        let isBoss = bancoPartida[idxPartida] && bancoPartida[idxPartida].boss;
        let isLowHp = match.hp === 1;
        
        osc.type = isBoss ? 'sawtooth' : 'triangle';
        
        // Seleciona a melodia baseada na configuração
        let melodiaAtual = MELODIAS[saveGlobal.config.musicaIdx || 0];
        let freq = melodiaAtual[indiceNota];
        if (isBoss) freq *= 0.8; 
        
        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(audioCtx.destination);
        
        let vol = saveGlobal.config.volMusica / 100;
        gain.gain.setValueAtTime(0.015 * vol, proximoTempoNota);
        gain.gain.exponentialRampToValueAtTime(0.001 * vol, proximoTempoNota + 0.15);
        
        osc.start(proximoTempoNota); osc.stop(proximoTempoNota + 0.15);
        
        let tempoStep = isLowHp ? 0.15 : 0.25; 
        proximoTempoNota += tempoStep; 
        indiceNota = (indiceNota + 1) % melodiaAtual.length;
    }
    tempoLoop = requestAnimationFrame(loopBGM);
}

function iniciarMusicaFundo() {
    if(bgmAtiva || saveGlobal.config.volMusica === 0) return;
    iniciarAudio(); bgmAtiva = true; proximoTempoNota = audioCtx.currentTime + 0.05; loopBGM();
}
function pararMusicaFundo() { bgmAtiva = false; cancelAnimationFrame(tempoLoop); }
document.body.addEventListener('click', () => { iniciarAudio(); iniciarMusicaFundo(); }, { once: true });


const CLASSES = {
    "Aventureiro": { id: "Aventureiro", desc: "Equilibrado. Sem vantagens.", custo: 0 },
    "Mago": { id: "Mage", desc: "Poções de Cura custam -1💎.", custo: 20 },
    "Arqueiro": { id: "Archer", desc: "Tempo base de resposta +5s.", custo: 30 },
    "Ninja": { id: "Ninja", desc: "Multiplicador de Score de Combo +20%.", custo: 40 }
};

let saveGlobal = {
    xp: 0, level: 1, cristaisGlobais: 0,
    heroisDesbloqueados: ["Aventureiro"], heroiAtual: "Aventureiro", bestiario: [],
    stats: {}, errosIDs: [], achievements: { intocavel: false, combo10: false, godSlayer: 0 },
    config: {
        musicaIdx: 0, volMusica: 50, volSfx: 100, animacoesReduzidas: false, semTempo: false, maxHp: 3, tempoBase: 20,
        precos: { pocao: 3, espada: 2, escudo: 4, oraculo: 5, ampulheta: 2 }
    }
};

function carregarSaveGlobal() {
    const s = localStorage.getItem('questAcadGlobal');
    if(s) {
        let parsed = JSON.parse(s); saveGlobal = { ...saveGlobal, ...parsed };
        if(parsed.config) saveGlobal.config = { ...saveGlobal.config, ...parsed.config };
        if(!saveGlobal.bestiario) saveGlobal.bestiario = [];
    }
    atualizarMenuPerfil(); aplicarConfiguracoesUI();
}
function salvarGlobal() { localStorage.setItem('questAcadGlobal', JSON.stringify(saveGlobal)); atualizarMenuPerfil(); }

let bancoOriginal = [], bancoPartida = [], idxPartida = 0;
let match = { hp: 3, score: 0, combo: 0, cristais: 0, modo: 'Aventura' };
let timerVal = 20, timerInterval, timeFrozen = false, oracleUsado = false, shieldAtivo = false, digitando = false;

const DOM = {
    telas: { menu: document.getElementById('start-screen'), heroes: document.getElementById('heroes-screen'), dungeons: document.getElementById('dungeon-screen'), boletim: document.getElementById('boletim-screen'), config: document.getElementById('settings-screen'), jogo: document.getElementById('gameplay-screen'), fim: document.getElementById('endgame-screen'), bestiario: document.getElementById('bestiary-screen') },
    menu: { lvl: document.getElementById('lvl-display'), cris: document.getElementById('global-cristais'), hero: document.getElementById('hero-display'), btnJogar: document.getElementById('btn-jogar') },
    jogo: { hp: document.getElementById('health-bar'), score: document.getElementById('score-text'), combo: document.getElementById('combo-text'), cris: document.getElementById('match-cristais'), arena: document.getElementById('battle-arena'), imgHero: document.getElementById('img-heroi'), imgMob: document.getElementById('img-monstro'), bossAlert: document.getElementById('boss-alert'), shield: document.getElementById('shield-effect'), pergunta: document.getElementById('question-text'), painel: document.getElementById('action-panel'), timerBar: document.getElementById('timer-bar'), qCounter: document.getElementById('question-counter'), btnPular: document.getElementById('btn-pular') },
    loja: { pocao: document.getElementById('btn-pocao'), espada: document.getElementById('btn-espada'), escudo: document.getElementById('btn-escudo'), oraculo: document.getElementById('btn-oraculo'), ampulheta: document.getElementById('btn-ampulheta') }
};

function mostrarPopup(titulo, mensagem, textoBotao = "Confirmar", callback = null) {
    iniciarAudio(); tocarSom('click');
    document.getElementById('custom-popup-title').innerText = titulo;
    document.getElementById('custom-popup-msg').innerHTML = mensagem;
    const btn = document.getElementById('custom-popup-btn');
    btn.innerText = textoBotao;
    btn.onclick = () => { tocarSom('click'); document.getElementById('custom-popup-overlay').classList.add('escondido'); if(callback) callback(); };
    document.getElementById('custom-popup-overlay').classList.remove('escondido');
}

// SALVAR PERGUNTAS DE IMPORTAÇÕES
document.getElementById('btn-import-deck').onclick = () => { tocarSom('click'); document.getElementById('file-import-deck').click(); };
document.getElementById('file-import-deck').onchange = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const arr = JSON.parse(ev.target.result);
            if(Array.isArray(arr) && arr[0].pergunta) { 
                // Salvar permanentemente no LocalStorage (simula a adição ao perguntas.json)
                let custom = JSON.parse(localStorage.getItem('questAcadCustomDecks') || "[]");
                custom = [...custom, ...arr];
                localStorage.setItem('questAcadCustomDecks', JSON.stringify(custom));
                
                bancoOriginal = [...bancoOriginal, ...arr]; 
                mostrarPopup('Módulo Carregado', `Adicionadas ${arr.length} novas perguntas ao banco!`, 'Incrível'); 
            }
        } catch(err) { mostrarPopup('Erro', 'Formato JSON inválido. Verifique o deck.', 'Voltar'); }
    };
    reader.readAsText(file);
};

function tocarSom(tipo) {
    if (saveGlobal.config.volSfx === 0) return;
    iniciarAudio(); if(!audioCtx) return;
    const osc = audioCtx.createOscillator(), ganho = audioCtx.createGain();
    osc.connect(ganho); ganho.connect(audioCtx.destination);
    const ag = audioCtx.currentTime;
    let vol = saveGlobal.config.volSfx / 100;
    try {
        if (tipo === 'click') { osc.type = 'square'; osc.frequency.setValueAtTime(600, ag); osc.frequency.exponentialRampToValueAtTime(800, ag + 0.05); ganho.gain.setValueAtTime(0.1 * vol, ag); ganho.gain.exponentialRampToValueAtTime(0.01, ag + 0.05); osc.start(ag); osc.stop(ag + 0.05); } 
        else if (tipo === 'acerto') { osc.type = 'square'; osc.frequency.setValueAtTime(440, ag); osc.frequency.setValueAtTime(659, ag + 0.1); ganho.gain.setValueAtTime(0.1 * vol, ag); ganho.gain.linearRampToValueAtTime(0, ag + 0.3); osc.start(ag); osc.stop(ag + 0.3); } 
        else if (tipo === 'erro') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ag); osc.frequency.exponentialRampToValueAtTime(40, ag + 0.3); ganho.gain.setValueAtTime(0.2 * vol, ag); ganho.gain.linearRampToValueAtTime(0, ag + 0.3); osc.start(ag); osc.stop(ag + 0.3); } 
        else if (tipo === 'boss_hit') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, ag); osc.frequency.exponentialRampToValueAtTime(20, ag + 0.5); ganho.gain.setValueAtTime(0.4 * vol, ag); ganho.gain.linearRampToValueAtTime(0, ag + 0.5); osc.start(ag); osc.stop(ag + 0.5); } 
        else if (tipo === 'powerup') { osc.type = 'sine'; osc.frequency.setValueAtTime(880, ag); osc.frequency.linearRampToValueAtTime(1760, ag + 0.2); ganho.gain.setValueAtTime(0.1 * vol, ag); ganho.gain.linearRampToValueAtTime(0, ag + 0.4); osc.start(ag); osc.stop(ag + 0.4); }
    } catch(e) {}
}

async function iniciar() {
    carregarSaveGlobal();
    try {
        const res = await fetch("perguntas.json"); 
        bancoOriginal = await res.json();
    } catch(e) { console.log("perguntas.json não encontrado localmente."); }
    
    // Recupera perguntas customizadas salvas previamente
    let custom = JSON.parse(localStorage.getItem('questAcadCustomDecks') || "[]");
    if(custom.length > 0) { bancoOriginal = [...bancoOriginal, ...custom]; }
}
iniciar();

function atualizarMenuPerfil() {
    DOM.menu.lvl.innerText = `Lvl: ${saveGlobal.level}`; DOM.menu.cris.innerText = saveGlobal.cristaisGlobais; DOM.menu.hero.innerText = saveGlobal.heroiAtual;
    let lc = document.getElementById('loja-cristais'); if(lc) lc.innerText = saveGlobal.cristaisGlobais;
}

function trocarTela(idEsconder, idMostrar) { tocarSom('click'); Object.values(DOM.telas).forEach(t => t.classList.add('escondido')); DOM.telas[idMostrar].classList.remove('escondido'); }
document.querySelectorAll('.btn-voltar').forEach(b => b.onclick = () => trocarTela('', 'menu'));
document.getElementById('btn-desistir').onclick = () => location.reload(); document.getElementById('btn-restart').onclick = () => location.reload();
document.getElementById('btn-jogar').onclick = () => iniciarPartida('Aventura'); document.getElementById('btn-config').onclick = () => trocarTela('menu', 'config');

// CORREÇÃO: TELA DE HERÓIS
window.selecionarHeroi = (id) => { saveGlobal.heroiAtual = id; salvarGlobal(); document.getElementById('btn-herois').click(); };
window.comprarHeroi = (id) => {
    if(saveGlobal.cristaisGlobais >= CLASSES[id].custo) {
        saveGlobal.cristaisGlobais -= CLASSES[id].custo;
        saveGlobal.heroisDesbloqueados.push(id);
        salvarGlobal(); document.getElementById('btn-herois').click();
    } else { mostrarPopup("Aviso", "Cristais insuficientes!"); }
};
document.getElementById('btn-herois').onclick = () => { 
    const lista = document.getElementById('lista-herois'); lista.innerHTML = "";
    Object.values(CLASSES).forEach(h => {
        let unlocked = saveGlobal.heroisDesbloqueados.includes(h.id);
        lista.innerHTML += `<div class="hero-card">
            <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${h.id}" style="${unlocked?'':'filter:grayscale(1)'}">
            <div class="hero-info"><strong>${h.id}</strong><br>${h.desc}</div>
            ${unlocked ? (saveGlobal.heroiAtual===h.id ? '<span style="color:#2ecc71; font-size:10px;">Equipado</span>' : `<button class="top-btn" onclick="selecionarHeroi('${h.id}')">Equipar</button>`) : `<button class="top-btn" onclick="comprarHeroi('${h.id}')">${h.custo}💎</button>`}
        </div>`;
    });
    trocarTela('menu', 'heroes'); 
};

// CORREÇÃO: TELA DE BOLETIM
document.getElementById('btn-boletim').onclick = () => { 
    const stats = document.getElementById('stats-list'); stats.innerHTML = "";
    if(Object.keys(saveGlobal.stats).length === 0) stats.innerHTML = "<p style='font-size:10px;'>Jogue partidas para gerar dados.</p>";
    Object.keys(saveGlobal.stats).forEach(k => {
        let s = saveGlobal.stats[k];
        stats.innerHTML += `<p style="font-size:10px; margin-bottom:5px; color:#ecf0f1;">${k}: ${s.certas}/${s.total} (${Math.round((s.certas/s.total)*100)}%)</p>`;
    });
    const ach = document.getElementById('achievements-list');
    ach.innerHTML = `<p style="font-size:10px; margin-bottom:5px; color:#ecf0f1;">Perfeição (Intocável): ${saveGlobal.achievements.intocavel ? '✅' : '❌'}</p>
                     <p style="font-size:10px; margin-bottom:5px; color:#ecf0f1;">Combo x10: ${saveGlobal.achievements.combo10 ? '✅' : '❌'}</p>
                     <p style="font-size:10px; margin-bottom:5px; color:#ecf0f1;">Chefes Derrotados: ${saveGlobal.achievements.godSlayer}</p>`;
    trocarTela('menu', 'boletim'); 
};

// CORREÇÃO: TELA DE MASMORRAS
document.getElementById('btn-masmorras').onclick = () => { 
    const lista = document.getElementById('lista-masmorras'); lista.innerHTML = "";
    const cats = [...new Set(bancoOriginal.map(p => p.categoria))];
    if(cats.length === 0) lista.innerHTML = "<p style='font-size:10px;'>Sem categorias disponíveis.</p>";
    cats.forEach(c => { lista.innerHTML += `<button class="menu-btn anim-pop" style="width:100%; margin-bottom:10px;" onclick="iniciarPartida('Dungeon', '${c}')">${c}</button>`; });
    trocarTela('menu', 'dungeons'); 
};

document.getElementById('btn-hospital').onclick = () => {
    if(saveGlobal.errosIDs.length === 0) return mostrarPopup("Hospital Vazio", "Saúde perfeita! Você não tem nenhuma pergunta errada salva para revisar.", "Ótimo!");
    iniciarPartida('Hospital');
};

// CORREÇÃO: TELA DE BESTIÁRIO (Referência a `bestiario` na DOM)
document.getElementById('btn-bestiario').onclick = () => {
    const lista = document.getElementById('lista-bestiario'); lista.innerHTML = "";
    const todasCategorias = [...new Set(bancoOriginal.map(p => p.categoria))];
    todasCategorias.forEach(cat => {
        let card = document.createElement('div');
        let unlocked = saveGlobal.bestiario.includes(cat);
        card.className = `bestiary-card ${unlocked ? '' : 'locked'}`;
        card.innerHTML = `<img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${cat}"><div>${unlocked ? cat : '???'}</div>`;
        lista.appendChild(card);
    });
    trocarTela('menu', 'bestiario');
};

function aplicarConfiguracoesUI() {
    const c = saveGlobal.config;
    document.getElementById("select-musica").value = c.musicaIdx || 0;
    document.getElementById("slider-musica").value = c.volMusica; document.getElementById("val-musica").innerText = c.volMusica;
    document.getElementById("slider-sfx").value = c.volSfx; document.getElementById("val-sfx").innerText = c.volSfx;
    document.getElementById("btn-toggle-anim").innerText = c.animacoesReduzidas ? "Desativadas" : "Ativadas";
    document.getElementById("btn-toggle-anim").className = c.animacoesReduzidas ? "config-btn off anim-pop" : "config-btn on anim-pop";
    document.body.classList.toggle("reduzir-anim", c.animacoesReduzidas);
    document.getElementById("btn-toggle-tempo").innerText = c.semTempo ? "Ativado" : "Desativado";
    document.getElementById("btn-toggle-tempo").className = c.semTempo ? "config-btn on anim-pop" : "config-btn off anim-pop";
    document.getElementById("slider-tempo").disabled = c.semTempo;
}

document.getElementById("select-musica").onchange = (e) => { saveGlobal.config.musicaIdx = parseInt(e.target.value); indiceNota = 0; salvarGlobal(); };
document.getElementById("slider-musica").oninput = (e) => { saveGlobal.config.volMusica = parseInt(e.target.value); document.getElementById("val-musica").innerText = saveGlobal.config.volMusica; salvarGlobal(); if(saveGlobal.config.volMusica === 0) pararMusicaFundo(); else if(!bgmAtiva) iniciarMusicaFundo(); };
document.getElementById("slider-sfx").oninput = (e) => { saveGlobal.config.volSfx = parseInt(e.target.value); document.getElementById("val-sfx").innerText = saveGlobal.config.volSfx; tocarSom('click'); salvarGlobal(); };
document.getElementById("btn-toggle-anim").onclick = () => { saveGlobal.config.animacoesReduzidas = !saveGlobal.config.animacoesReduzidas; aplicarConfiguracoesUI(); tocarSom('click'); salvarGlobal(); };
document.getElementById("btn-toggle-tempo").onclick = () => { saveGlobal.config.semTempo = !saveGlobal.config.semTempo; aplicarConfiguracoesUI(); tocarSom('click'); salvarGlobal(); };
document.getElementById("slider-vida").oninput = (e) => { saveGlobal.config.maxHp = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); };
document.getElementById("slider-tempo").oninput = (e) => { saveGlobal.config.tempoBase = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); };

function iniciarPartida(modo, param = null) {
    if(bancoOriginal.length === 0) return mostrarPopup("Sem Perguntas", "O arquivo perguntas.json e o deck local estão vazios. Importe questões.", "OK");
    
    match = { hp: saveGlobal.config.maxHp, score: 0, combo: 0, cristais: 0, modo: modo, hitTaken: false };
    shieldAtivo = false; timeFrozen = false; oracleUsado = false;
    
    if(modo === 'Aventura') bancoPartida = [...bancoOriginal];
    else if(modo === 'Dungeon') bancoPartida = bancoOriginal.filter(p => p.categoria === param);
    else if(modo === 'Hospital') bancoPartida = bancoOriginal.filter(p => saveGlobal.errosIDs.includes(p.id));
    
    // CORREÇÃO: Embaralha e coloca TODAS as perguntas no jogo, removendo o limite de ".slice(0, 10)"
    bancoPartida = bancoPartida.sort(() => Math.random() - 0.5);
    idxPartida = 0;
    
    if(bancoPartida.length === 0) return mostrarPopup("Aviso", "Não há perguntas para este modo.", "OK");

    DOM.jogo.imgHero.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${CLASSES[saveGlobal.heroiAtual].id}`;
    document.getElementById('current-dungeon-name').innerText = modo + (param ? ` (${param})` : "");
    
    trocarTela('menu', 'jogo'); DOM.jogo.imgHero.classList.add("anim-flutuar"); carregarPergunta();
}

function atualizarHUD() {
    DOM.jogo.score.innerText = match.score; DOM.jogo.combo.innerText = match.combo; DOM.jogo.cris.innerText = match.cristais;
    DOM.jogo.qCounter.innerText = `Questão: ${idxPartida + 1}/${bancoPartida.length}`;
    
    DOM.jogo.hp.innerHTML = "Vidas: ";
    for(let i=0; i < saveGlobal.config.maxHp; i++) {
        let span = document.createElement("span"); span.innerHTML = "❤️ ";
        if(i >= match.hp) span.className = "coracao-perdido"; DOM.jogo.hp.appendChild(span);
    }
    const precos = saveGlobal.config.precos;
    const custoPocao = saveGlobal.heroiAtual === "Mago" ? Math.max(1, precos.pocao - 1) : precos.pocao;
    DOM.loja.pocao.innerText = `❤️ Cura (${custoPocao}💎)`; DOM.loja.pocao.disabled = (match.cristais < custoPocao || match.hp >= saveGlobal.config.maxHp || digitando);
    DOM.loja.espada.disabled = (match.cristais < precos.espada || digitando || bancoPartida[idxPartida].alternativas.length <= 2);
    DOM.loja.escudo.disabled = (match.cristais < precos.escudo || digitando || shieldAtivo);
    DOM.loja.oraculo.disabled = (match.cristais < precos.oraculo || digitando || oracleUsado);
    DOM.loja.ampulheta.disabled = (match.cristais < precos.ampulheta || digitando || timeFrozen || saveGlobal.config.semTempo);
    DOM.jogo.shield.classList.toggle('escondido', !shieldAtivo);
    DOM.jogo.btnPular.disabled = (idxPartida >= bancoPartida.length - 1 || digitando);
}

DOM.jogo.btnPular.onclick = () => {
    if(digitando || idxPartida >= bancoPartida.length - 1) return; tocarSom('click'); clearInterval(timerInterval);
    const questaoAtual = bancoPartida.splice(idxPartida, 1)[0]; bancoPartida.push(questaoAtual); carregarPergunta();
};

function iniciarTempo() {
    clearInterval(timerInterval);
    if(saveGlobal.config.semTempo) { DOM.jogo.timerBar.style.width = "100%"; DOM.jogo.timerBar.style.backgroundColor = "#3498db"; return; }
    timerVal = saveGlobal.config.tempoBase + (saveGlobal.heroiAtual === "Arqueiro" ? 5 : 0);
    let timerTotal = timerVal;
    timerInterval = setInterval(() => {
        if(timeFrozen || digitando) return; timerVal -= 0.1; let pct = (timerVal / timerTotal) * 100; DOM.jogo.timerBar.style.width = `${pct}%`;
        if(pct > 50) DOM.jogo.timerBar.style.backgroundColor = "#2ecc71"; else if(pct > 20) DOM.jogo.timerBar.style.backgroundColor = "#f1c40f"; else DOM.jogo.timerBar.style.backgroundColor = "#e74c3c";
        if(timerVal <= 0) { clearInterval(timerInterval); processarResposta(null); }
    }, 100);
}

function carregarPergunta() {
    if (idxPartida >= bancoPartida.length) return finalizarPartida(true);
    const p = bancoPartida[idxPartida];
    DOM.jogo.imgMob.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${p.boss ? 'Demon' : p.categoria}`;
    DOM.jogo.imgMob.classList.toggle("sprite-boss", p.boss); DOM.jogo.bossAlert.classList.toggle("escondido", !p.boss);
    DOM.jogo.arena.className = `arena-${p.categoria}`;

    oracleUsado = false; timeFrozen = false; atualizarHUD();
    if(!saveGlobal.config.semTempo) { DOM.jogo.timerBar.style.width = "100%"; DOM.jogo.timerBar.style.backgroundColor = "#2ecc71"; }
    
    travar(true); DOM.jogo.pergunta.innerHTML = "";
    digitar(p.pergunta, 20, () => { travar(false); atualizarHUD(); iniciarTempo(); });

    DOM.jogo.painel.innerHTML = "";
    let alts = [...p.alternativas].sort(() => Math.random() - 0.5);
    alts.forEach(a => { let btn = document.createElement("button"); btn.className = "answer-btn anim-pop"; btn.innerText = a; btn.onclick = () => processarResposta(btn); DOM.jogo.painel.appendChild(btn); });
}

function digitar(txt, vel, cb) {
    let i = 0; digitando = true; clearInterval(timerInterval);
    let int = setInterval(() => { if (i < txt.length) { DOM.jogo.pergunta.innerHTML = txt.substring(0, i+1) + '<span class="cursor-pisca">_</span>'; i++; } else { clearInterval(int); digitando = false; if(cb) cb(); } }, vel);
}

DOM.loja.pocao.onclick = () => { let c = saveGlobal.heroiAtual==="Mago"?Math.max(1,saveGlobal.config.precos.pocao-1):saveGlobal.config.precos.pocao; match.cristais-=c; match.hp++; tocarSom('powerup'); atualizarHUD(); };
DOM.loja.escudo.onclick = () => { match.cristais -= saveGlobal.config.precos.escudo; shieldAtivo = true; tocarSom('powerup'); atualizarHUD(); };
DOM.loja.ampulheta.onclick = () => { match.cristais -= saveGlobal.config.precos.ampulheta; timeFrozen = true; setTimeout(()=> timeFrozen=false, 10000); tocarSom('powerup'); atualizarHUD(); };
DOM.loja.oraculo.onclick = () => { match.cristais -= saveGlobal.config.precos.oraculo; oracleUsado = true; tocarSom('powerup'); atualizarHUD(); const certa = bancoPartida[idxPartida].resposta_correta; Array.from(DOM.jogo.painel.children).forEach(b => { if(b.innerText === certa) b.classList.add('btn-oraculo-highlight'); }); };
DOM.loja.espada.onclick = () => { match.cristais -= saveGlobal.config.precos.espada; tocarSom('powerup'); atualizarHUD(); DOM.loja.espada.disabled = true; let errados = Array.from(DOM.jogo.painel.children).filter(b => b.innerText !== bancoPartida[idxPartida].resposta_correta).sort(()=>Math.random()-0.5); let qtd = Math.floor(errados.length / 2) || 1; for(let i=0; i<qtd; i++) errados[i].classList.add("btn-apagado"); };

function processarResposta(btnClicado) {
    if(digitando) return;
    clearInterval(timerInterval); travar(true); const p = bancoPartida[idxPartida];
    if(!saveGlobal.stats[p.categoria]) saveGlobal.stats[p.categoria] = { certas: 0, total: 0 };
    saveGlobal.stats[p.categoria].total++;

    if (btnClicado && btnClicado.innerText === p.resposta_correta) {
        tocarSom('acerto'); saveGlobal.stats[p.categoria].certas++; btnClicado.classList.add("btn-correto");
        match.combo++; match.cristais += p.boss ? 2 : 1;
        if(!oracleUsado) { let base = saveGlobal.heroiAtual === "Ninja" ? 120 : 100; match.score += (base * match.combo) + (saveGlobal.config.semTempo ? 50 : Math.floor(timerVal) * 5); }
        if(saveGlobal.achievements.combo10 === false && match.combo >= 10) saveGlobal.achievements.combo10 = true;
        if(p.boss) saveGlobal.achievements.godSlayer++;
        if(!saveGlobal.bestiario.includes(p.categoria)) saveGlobal.bestiario.push(p.categoria);
        
        saveGlobal.errosIDs = saveGlobal.errosIDs.filter(id => id !== p.id);
        DOM.jogo.imgHero.classList.add("anim-ataque"); DOM.jogo.imgMob.classList.add("anim-dano");
        atualizarHUD(); salvarGlobal(); if(p.boss) lancarParticulas(DOM.jogo.imgMob); 
        setTimeout(() => { DOM.jogo.imgHero.classList.remove("anim-ataque"); DOM.jogo.imgMob.classList.remove("anim-dano"); idxPartida++; carregarPergunta(); }, 1200);
    } else {
        tocarSom('erro'); if(btnClicado) btnClicado.classList.add("btn-errado");
        if(!saveGlobal.errosIDs.includes(p.id)) saveGlobal.errosIDs.push(p.id); 
        match.combo = 0; match.hitTaken = true;
        let dano = p.boss ? 2 : 1; if(shieldAtivo) { shieldAtivo = false; dano = 0; } match.hp -= dano;
        atualizarHUD(); salvarGlobal(); DOM.telas.jogo.classList.add("anim-shake");
        
        setTimeout(() => {
            DOM.telas.jogo.classList.remove("anim-shake"); document.getElementById('modal-resposta-correta').innerText = p.resposta_correta;
            document.getElementById('modal-explicacao').innerText = p.explicacao; document.getElementById('feedback-modal').classList.remove('escondido');
            let tmp = 3, btnE = document.getElementById('btn-entendi'); btnE.disabled = true; btnE.innerText = `Lendo... (${tmp})`;
            let intB = setInterval(()=>{ tmp--; if(tmp>0) btnE.innerText = `Lendo... (${tmp})`; else { clearInterval(intB); btnE.disabled = false; btnE.innerText = "Avançar"; } }, 1000);
        }, 500);
    }
}

document.getElementById('btn-entendi').onclick = () => { tocarSom('click'); document.getElementById('feedback-modal').classList.add('escondido'); if(match.hp > 0) { idxPartida++; carregarPergunta(); } else finalizarPartida(false); };

function finalizarPartida(vitoria) {
    if(vitoria && !match.hitTaken) saveGlobal.achievements.intocavel = true;
    saveGlobal.cristaisGlobais += match.cristais; let xpGanha = Math.floor(match.score / 10); saveGlobal.xp += xpGanha;
    let levelUp = false, proxLevel = saveGlobal.level * 1000;
    while(saveGlobal.xp >= proxLevel) { saveGlobal.xp -= proxLevel; saveGlobal.level++; levelUp = true; proxLevel = saveGlobal.level * 1000; }
    
    salvarGlobal(); trocarTela('jogo', 'fim'); document.getElementById('endgame-score').innerText = match.score; document.getElementById('endgame-xp').innerText = `+${xpGanha} XP (Total: ${saveGlobal.xp}/${proxLevel})`;
    document.getElementById('level-up-alert').classList.toggle('escondido', !levelUp); const tf = document.getElementById('endgame-title'), tr = document.getElementById('endgame-rank');
    
    if(vitoria) {
        tocarSom('vitoria'); lancarConfetes(); tf.innerText = "VITÓRIA"; tf.style.color = "#f1c40f"; let r = "C", cr = "rank-C";
        if (match.score >= 1000 && match.hp === saveGlobal.config.maxHp) { r = "S"; cr = "rank-S"; } else if (match.score >= 600) { r = "A"; cr = "rank-A"; } else if (match.score >= 300) { r = "B"; cr = "rank-B"; }
        tr.innerText = r; tr.className = cr;
    } else { tocarSom('boss_hit'); tf.innerText = "GAME OVER"; tf.style.color = "#e74c3c"; tr.innerText = "Destruído"; tr.className = "rank-C"; }
}

function travar(estado) { Array.from(DOM.jogo.painel.children).forEach(b => { if(!b.classList.contains("btn-apagado")) b.disabled = estado; }); }
function lancarParticulas(origem) { const c = document.getElementById('particles-container'), rect = origem.getBoundingClientRect(); for(let i=0; i<15; i++) { let p = document.createElement('div'); p.className = 'particle-coin'; p.style.left = rect.left + (rect.width/2) + 'px'; p.style.top = rect.top + (rect.height/2) + 'px'; p.style.setProperty('--tx', (Math.random() * 200 - 100) + 'px'); p.style.setProperty('--ty', (Math.random() * -200 - 50) + 'px'); c.appendChild(p); setTimeout(()=>p.remove(), 1000); } }
function lancarConfetes() { const container = document.getElementById("particles-container"), cores = ['#f1c40f', '#2ecc71', '#e74c3c', '#9b59b6', '#3498db']; for(let i=0; i<80; i++) { let conf = document.createElement('div'); conf.className = 'particle-coin'; conf.style.borderRadius = "0"; conf.style.left = Math.random() * 100 + 'vw'; conf.style.animation = `explode ${Math.random() * 3 + 2}s forwards linear`; conf.style.setProperty('--tx', '0px'); conf.style.setProperty('--ty', '100vh'); conf.style.backgroundColor = cores[Math.floor(Math.random() * cores.length)]; container.appendChild(conf); setTimeout(()=>conf.remove(), 5000); } }
