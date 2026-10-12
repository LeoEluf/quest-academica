// 1. REGISTRO PWA E MOTOR DE ÁUDIO
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW falhou:', err)); }

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function iniciarAudio() { if (!audioCtx) audioCtx = new AudioContext(); if (audioCtx.state === 'suspended') audioCtx.resume(); }

// 2. META DATA (Classes, Poderes e Conquistas)
const CLASSES = {
    "Aventureiro": { id: "Aventureiro", desc: "Equilibrado. Sem vantagens.", custo: 0 },
    "Mago": { id: "Mage", desc: "Poções de Cura custam -1💎.", custo: 20 },
    "Arqueiro": { id: "Archer", desc: "Tempo base de resposta +5s.", custo: 30 },
    "Ninja": { id: "Ninja", desc: "Multiplicador de Score de Combo +20%.", custo: 40 }
};

// 3. ESTADO GLOBAL (LocalStorage)
let saveGlobal = {
    xp: 0, level: 1, cristaisGlobais: 0,
    heroisDesbloqueados: ["Aventureiro"], heroiAtual: "Aventureiro",
    stats: {}, errosIDs: [], achievements: { intocavel: false, combo10: false, godSlayer: 0 },
    config: {
        somAtivado: true, animacoesReduzidas: false, maxHp: 3, tempoBase: 20,
        precos: { pocao: 3, espada: 2, escudo: 4, oraculo: 5, ampulheta: 2 }
    }
};

function carregarSaveGlobal() {
    const s = localStorage.getItem('questAcadGlobal');
    if(s) {
        let parsed = JSON.parse(s);
        saveGlobal = { ...saveGlobal, ...parsed };
        if(parsed.config) saveGlobal.config = { ...saveGlobal.config, ...parsed.config };
    }
    atualizarMenuPerfil(); aplicarConfiguracoesUI();
}
function salvarGlobal() { localStorage.setItem('questAcadGlobal', JSON.stringify(saveGlobal)); atualizarMenuPerfil(); }

// 4. ESTADO DA PARTIDA
let bancoOriginal = [], bancoPartida = [], idxPartida = 0;
let match = { hp: 3, score: 0, combo: 0, cristais: 0, modo: 'Aventura' };
let timerVal = 20, timerInterval, timeFrozen = false, oracleUsado = false, shieldAtivo = false, digitando = false;

// 5. MAPEAMENTO DOM
const DOM = {
    telas: { 
        menu: document.getElementById('start-screen'), heroes: document.getElementById('heroes-screen'),
        dungeons: document.getElementById('dungeon-screen'), boletim: document.getElementById('boletim-screen'),
        config: document.getElementById('settings-screen'), jogo: document.getElementById('gameplay-screen'), fim: document.getElementById('endgame-screen')
    },
    menu: { lvl: document.getElementById('lvl-display'), cris: document.getElementById('global-cristais'), hero: document.getElementById('hero-display'), btnJogar: document.getElementById('btn-jogar') },
    jogo: {
        hp: document.getElementById('health-bar'), score: document.getElementById('score-text'),
        combo: document.getElementById('combo-text'), cris: document.getElementById('match-cristais'),
        imgHero: document.getElementById('img-heroi'), imgMob: document.getElementById('img-monstro'),
        bossAlert: document.getElementById('boss-alert'), shield: document.getElementById('shield-effect'),
        pergunta: document.getElementById('question-text'), painel: document.getElementById('action-panel'),
        timerBar: document.getElementById('timer-bar'), qCounter: document.getElementById('question-counter')
    },
    loja: {
        pocao: document.getElementById('btn-pocao'), espada: document.getElementById('btn-espada'),
        escudo: document.getElementById('btn-escudo'), oraculo: document.getElementById('btn-oraculo'), ampulheta: document.getElementById('btn-ampulheta')
    }
};

// 6. SISTEMA DE POPUP MODULAR (Substitui os Alertas)
function mostrarPopup(titulo, mensagem, textoBotao = "Confirmar", callback = null) {
    iniciarAudio(); tocarSom('click');
    document.getElementById('custom-popup-title').innerText = titulo;
    document.getElementById('custom-popup-msg').innerHTML = mensagem;
    const btn = document.getElementById('custom-popup-btn');
    btn.innerText = textoBotao;
    btn.onclick = () => {
        tocarSom('click');
        document.getElementById('custom-popup-overlay').classList.add('escondido');
        if(callback) callback();
    };
    document.getElementById('custom-popup-overlay').classList.remove('escondido');
}

// 7. MOTOR DE ÁUDIO SINTÉTICO
function tocarSom(tipo) {
    if (!saveGlobal.config.somAtivado) return;
    iniciarAudio(); if(!audioCtx) return;
    const osc = audioCtx.createOscillator(), ganho = audioCtx.createGain();
    osc.connect(ganho); ganho.connect(audioCtx.destination);
    const ag = audioCtx.currentTime;

    try {
        if (tipo === 'click') { osc.type = 'square'; osc.frequency.setValueAtTime(600, ag); osc.frequency.exponentialRampToValueAtTime(800, ag + 0.05); ganho.gain.setValueAtTime(0.1, ag); ganho.gain.exponentialRampToValueAtTime(0.01, ag + 0.05); osc.start(ag); osc.stop(ag + 0.05); } 
        else if (tipo === 'acerto') { osc.type = 'square'; osc.frequency.setValueAtTime(440, ag); osc.frequency.setValueAtTime(659, ag + 0.1); ganho.gain.setValueAtTime(0.1, ag); ganho.gain.linearRampToValueAtTime(0, ag + 0.3); osc.start(ag); osc.stop(ag + 0.3); } 
        else if (tipo === 'erro') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ag); osc.frequency.exponentialRampToValueAtTime(40, ag + 0.3); ganho.gain.setValueAtTime(0.2, ag); ganho.gain.linearRampToValueAtTime(0, ag + 0.3); osc.start(ag); osc.stop(ag + 0.3); } 
        else if (tipo === 'boss_hit') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, ag); osc.frequency.exponentialRampToValueAtTime(20, ag + 0.5); ganho.gain.setValueAtTime(0.4, ag); ganho.gain.linearRampToValueAtTime(0, ag + 0.5); osc.start(ag); osc.stop(ag + 0.5); } 
        else if (tipo === 'powerup') { osc.type = 'sine'; osc.frequency.setValueAtTime(880, ag); osc.frequency.linearRampToValueAtTime(1760, ag + 0.2); ganho.gain.setValueAtTime(0.1, ag); ganho.gain.linearRampToValueAtTime(0, ag + 0.4); osc.start(ag); osc.stop(ag + 0.4); }
    } catch(e) {}
}
document.body.addEventListener('click', iniciarAudio, { once: true });

// 8. INICIALIZAÇÃO E MENUS
async function iniciar() {
    carregarSaveGlobal();
    try {
        const res = await fetch("perguntas.json");
        bancoOriginal = await res.json();
    } catch(e) { 
        mostrarPopup("Erro Crítico", "Não foi possível carregar o arquivo perguntas.json. Execute o jogo usando um Servidor Local (Live Server).", "Entendi"); 
        DOM.menu.btnJogar.disabled = true; 
    }
}
iniciar();

function atualizarMenuPerfil() {
    DOM.menu.lvl.innerText = `Lvl: ${saveGlobal.level}`;
    DOM.menu.cris.innerText = saveGlobal.cristaisGlobais;
    DOM.menu.hero.innerText = saveGlobal.heroiAtual;
    let lc = document.getElementById('loja-cristais'); if(lc) lc.innerText = saveGlobal.cristaisGlobais;
}

function trocarTela(idEsconder, idMostrar) {
    tocarSom('click');
    Object.values(DOM.telas).forEach(t => t.classList.add('escondido'));
    DOM.telas[idMostrar].classList.remove('escondido');
}
document.querySelectorAll('.btn-voltar').forEach(b => b.onclick = () => trocarTela('', 'menu'));
document.getElementById('btn-desistir').onclick = () => location.reload();
document.getElementById('btn-restart').onclick = () => location.reload();

document.getElementById('btn-jogar').onclick = () => iniciarPartida('Aventura');
document.getElementById('btn-config').onclick = () => trocarTela('menu', 'config');

// Telas de Metadados
document.getElementById('btn-herois').onclick = () => {
    const lista = document.getElementById('lista-herois'); lista.innerHTML = "";
    Object.keys(CLASSES).forEach(key => {
        const c = CLASSES[key], unlocked = saveGlobal.heroisDesbloqueados.includes(key);
        const div = document.createElement('div'); div.className = 'hero-card';
        let btn = `<button class="top-btn anim-pop" onclick="selecionarHeroi('${key}')">Equipar</button>`;
        if(!unlocked) btn = `<button class="top-btn anim-pop" style="background:#f39c12;" onclick="comprarHeroi('${key}', ${c.custo})">Comprar (💎 ${c.custo})</button>`;
        if(saveGlobal.heroiAtual === key) btn = `<span style="color:#2ecc71; font-size:10px;">Ativo</span>`;
        div.innerHTML = `<img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${c.id}"><div class="hero-info"><strong>${key}</strong><br>${c.desc}</div><div>${btn}</div>`;
        lista.appendChild(div);
    });
    trocarTela('menu', 'heroes');
};

window.comprarHeroi = (id, custo) => {
    if(saveGlobal.cristaisGlobais >= custo) {
        saveGlobal.cristaisGlobais -= custo; saveGlobal.heroisDesbloqueados.push(id); salvarGlobal();
        document.getElementById('btn-herois').click(); tocarSom('powerup');
    } else {
        mostrarPopup("Taverna", `Você precisa de ${custo} Cristais para desbloquear ${id}. Jogue mais aventuras!`, "Entendi");
    }
};
window.selecionarHeroi = (id) => { saveGlobal.heroiAtual = id; salvarGlobal(); document.getElementById('btn-herois').click(); };

document.getElementById('btn-boletim').onclick = () => {
    const statsDiv = document.getElementById('stats-list'); statsDiv.innerHTML = "";
    Object.keys(saveGlobal.stats).forEach(cat => {
        const s = saveGlobal.stats[cat], perc = s.total > 0 ? Math.round((s.certas / s.total) * 100) : 0;
        statsDiv.innerHTML += `<div class="dungeon-card"><span>${cat}</span><span>${perc}% (${s.certas}/${s.total})</span></div>`;
    });
    if(statsDiv.innerHTML === "") statsDiv.innerHTML = "<p style='font-size:10px;'>Jogue para gerar dados.</p>";
    
    const achDiv = document.getElementById('achievements-list'); achDiv.innerHTML = "";
    const ac = saveGlobal.achievements;
    achDiv.innerHTML += `<div class="achiev-card" style="opacity:${ac.intocavel?1:0.3}">🛡️ Intocável (Sem Dano)</div>`;
    achDiv.innerHTML += `<div class="achiev-card" style="opacity:${ac.combo10?1:0.3}">🔥 Mestre do Combo (10x)</div>`;
    achDiv.innerHTML += `<div class="achiev-card" style="opacity:${ac.godSlayer>=5?1:0.3}">💀 Matador de Deuses (${ac.godSlayer}/5)</div>`;
    trocarTela('menu', 'boletim');
};

document.getElementById('btn-masmorras').onclick = () => {
    const lista = document.getElementById('lista-masmorras'); lista.innerHTML = "";
    const categorias = [...new Set(bancoOriginal.map(p => p.categoria))];
    categorias.forEach(c => {
        const div = document.createElement('div'); div.className = 'dungeon-card';
        const qtd = bancoOriginal.filter(p => p.categoria === c).length;
        div.innerHTML = `<span>${c} (${qtd} Q)</span> <button class="top-btn anim-pop" onclick="iniciarPartida('Dungeon', '${c}')">Entrar</button>`;
        lista.appendChild(div);
    });
    trocarTela('menu', 'dungeons');
};

document.getElementById('btn-hospital').onclick = () => {
    if(saveGlobal.errosIDs.length === 0) return mostrarPopup("Hospital Vazio", "Saúde perfeita! Você não tem nenhuma pergunta errada salva para revisar.", "Ótimo!");
    iniciarPartida('Hospital');
};


// 9. PÁGINA DE CONFIGURAÇÕES AVANÇADAS
function aplicarConfiguracoesUI() {
    const c = saveGlobal.config;
    document.getElementById("btn-toggle-som").innerText = c.somAtivado ? "Ligado" : "Desligado";
    document.getElementById("btn-toggle-som").className = c.somAtivado ? "config-btn on anim-pop" : "config-btn off anim-pop";
    document.getElementById("btn-toggle-anim").innerText = c.animacoesReduzidas ? "Desativadas" : "Ativadas";
    document.getElementById("btn-toggle-anim").className = c.animacoesReduzidas ? "config-btn off anim-pop" : "config-btn on anim-pop";
    document.body.classList.toggle("reduzir-anim", c.animacoesReduzidas);
    
    document.getElementById("val-vida").innerText = c.maxHp; document.getElementById("slider-vida").value = c.maxHp;
    document.getElementById("val-tempo").innerText = c.tempoBase; document.getElementById("slider-tempo").value = c.tempoBase;
    
    document.getElementById("val-pocao").innerText = c.precos.pocao; document.getElementById("slider-pocao").value = c.precos.pocao;
    document.getElementById("val-espada").innerText = c.precos.espada; document.getElementById("slider-espada").value = c.precos.espada;
    document.getElementById("val-escudo").innerText = c.precos.escudo; document.getElementById("slider-escudo").value = c.precos.escudo;
    document.getElementById("val-oraculo").innerText = c.precos.oraculo; document.getElementById("slider-oraculo").value = c.precos.oraculo;
    document.getElementById("val-ampulheta").innerText = c.precos.ampulheta; document.getElementById("slider-ampulheta").value = c.precos.ampulheta;
}

document.getElementById("btn-toggle-som").onclick = () => { saveGlobal.config.somAtivado = !saveGlobal.config.somAtivado; aplicarConfiguracoesUI(); tocarSom('click'); salvarGlobal(); }
document.getElementById("btn-toggle-anim").onclick = () => { saveGlobal.config.animacoesReduzidas = !saveGlobal.config.animacoesReduzidas; aplicarConfiguracoesUI(); tocarSom('click'); salvarGlobal(); }
document.getElementById("slider-vida").oninput = (e) => { saveGlobal.config.maxHp = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); }
document.getElementById("slider-tempo").oninput = (e) => { saveGlobal.config.tempoBase = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); }
document.getElementById("slider-pocao").oninput = (e) => { saveGlobal.config.precos.pocao = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); }
document.getElementById("slider-espada").oninput = (e) => { saveGlobal.config.precos.espada = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); }
document.getElementById("slider-escudo").oninput = (e) => { saveGlobal.config.precos.escudo = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); }
document.getElementById("slider-oraculo").oninput = (e) => { saveGlobal.config.precos.oraculo = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); }
document.getElementById("slider-ampulheta").oninput = (e) => { saveGlobal.config.precos.ampulheta = parseInt(e.target.value); aplicarConfiguracoesUI(); salvarGlobal(); }


// 10. LÓGICA DA PARTIDA
function iniciarPartida(modo, param = null) {
    match = { hp: saveGlobal.config.maxHp, score: 0, combo: 0, cristais: 0, modo: modo, hitTaken: false };
    shieldAtivo = false; timeFrozen = false; oracleUsado = false;
    
    if(modo === 'Aventura') bancoPartida = [...bancoOriginal];
    else if(modo === 'Dungeon') bancoPartida = bancoOriginal.filter(p => p.categoria === param);
    else if(modo === 'Hospital') bancoPartida = bancoOriginal.filter(p => saveGlobal.errosIDs.includes(p.id));
    
    bancoPartida = bancoPartida.sort(() => Math.random() - 0.5).slice(0, 10);
    idxPartida = 0;
    
    DOM.jogo.imgHero.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${CLASSES[saveGlobal.heroiAtual].id}`;
    document.getElementById('current-dungeon-name').innerText = modo + (param ? ` (${param})` : "");
    
    trocarTela('menu', 'jogo');
    DOM.jogo.imgHero.classList.add("anim-flutuar");
    carregarPergunta();
}

function atualizarHUD() {
    DOM.jogo.score.innerText = match.score; DOM.jogo.combo.innerText = match.combo; DOM.jogo.cris.innerText = match.cristais;
    
    // Atualiza a Barra Topo (Contador de Questões)
    DOM.jogo.qCounter.innerText = `Questão: ${idxPartida + 1}/${bancoPartida.length}`;
    
    DOM.jogo.hp.innerHTML = "Vidas: ";
    for(let i=0; i < saveGlobal.config.maxHp; i++) {
        let span = document.createElement("span"); span.innerHTML = "❤️ ";
        if(i >= match.hp) span.className = "coracao-perdido";
        DOM.jogo.hp.appendChild(span);
    }
    
    const precos = saveGlobal.config.precos;
    const custoPocao = saveGlobal.heroiAtual === "Mago" ? Math.max(1, precos.pocao - 1) : precos.pocao;
    
    DOM.loja.pocao.innerText = `❤️ Cura (${custoPocao}💎)`;
    DOM.loja.espada.innerText = `⚔️ 50/50 (${precos.espada}💎)`;
    DOM.loja.escudo.innerText = `🛡️ Escudo (${precos.escudo}💎)`;
    DOM.loja.oraculo.innerText = `👁️ Oráculo (${precos.oraculo}💎)`;
    DOM.loja.ampulheta.innerText = `⏳ Tempo (${precos.ampulheta}💎)`;

    DOM.loja.pocao.disabled = (match.cristais < custoPocao || match.hp >= saveGlobal.config.maxHp || digitando);
    DOM.loja.espada.disabled = (match.cristais < precos.espada || digitando || bancoPartida[idxPartida].alternativas.length <= 2);
    DOM.loja.escudo.disabled = (match.cristais < precos.escudo || digitando || shieldAtivo);
    DOM.loja.oraculo.disabled = (match.cristais < precos.oraculo || digitando || oracleUsado);
    DOM.loja.ampulheta.disabled = (match.cristais < precos.ampulheta || digitando || timeFrozen);
    
    DOM.jogo.shield.classList.toggle('escondido', !shieldAtivo);
}

function iniciarTempo() {
    clearInterval(timerInterval);
    timerVal = saveGlobal.config.tempoBase + (saveGlobal.heroiAtual === "Arqueiro" ? 5 : 0);
    let timerTotal = timerVal;
    
    timerInterval = setInterval(() => {
        if(timeFrozen || digitando) return;
        timerVal -= 0.1;
        let pct = (timerVal / timerTotal) * 100;
        DOM.jogo.timerBar.style.width = `${pct}%`;
        
        if(pct > 50) DOM.jogo.timerBar.style.backgroundColor = "#2ecc71";
        else if(pct > 20) DOM.jogo.timerBar.style.backgroundColor = "#f1c40f";
        else DOM.jogo.timerBar.style.backgroundColor = "#e74c3c";
        
        if(timerVal <= 0) { clearInterval(timerInterval); processarResposta(null); }
    }, 100);
}

function carregarPergunta() {
    if (idxPartida >= bancoPartida.length) return finalizarPartida(true);
    
    const p = bancoPartida[idxPartida];
    DOM.jogo.imgMob.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${p.boss ? 'Demon' : p.categoria}`;
    DOM.jogo.imgMob.classList.toggle("sprite-boss", p.boss);
    DOM.jogo.bossAlert.classList.toggle("escondido", !p.boss);
    
    oracleUsado = false; timeFrozen = false;
    atualizarHUD();
    DOM.jogo.timerBar.style.width = "100%"; DOM.jogo.timerBar.style.backgroundColor = "#2ecc71";
    
    travar(true); DOM.jogo.pergunta.innerHTML = "";
    digitar(p.pergunta, 20, () => { travar(false); atualizarHUD(); iniciarTempo(); });

    DOM.jogo.painel.innerHTML = "";
    let alts = [...p.alternativas].sort(() => Math.random() - 0.5);
    alts.forEach(a => {
        let btn = document.createElement("button"); btn.className = "answer-btn anim-pop"; btn.innerText = a;
        btn.onclick = () => processarResposta(btn);
        DOM.jogo.painel.appendChild(btn);
    });
}

function digitar(txt, vel, cb) {
    let i = 0; digitando = true; clearInterval(timerInterval);
    let int = setInterval(() => {
        if (i < txt.length) { DOM.jogo.pergunta.innerHTML = txt.substring(0, i+1) + '<span class="cursor-pisca">_</span>'; i++; } 
        else { clearInterval(int); digitando = false; if(cb) cb(); }
    }, vel);
}

// LÓGICA DE COMPRA DOS POWER-UPS DA PARTIDA
DOM.loja.pocao.onclick = () => { let c = saveGlobal.heroiAtual==="Mago"?Math.max(1,saveGlobal.config.precos.pocao-1):saveGlobal.config.precos.pocao; match.cristais-=c; match.hp++; atualizarHUD(); };
DOM.loja.escudo.onclick = () => { match.cristais -= saveGlobal.config.precos.escudo; shieldAtivo = true; atualizarHUD(); };
DOM.loja.ampulheta.onclick = () => { match.cristais -= saveGlobal.config.precos.ampulheta; timeFrozen = true; setTimeout(()=> timeFrozen=false, 10000); atualizarHUD(); };
DOM.loja.oraculo.onclick = () => {
    match.cristais -= saveGlobal.config.precos.oraculo; oracleUsado = true; atualizarHUD();
    const certa = bancoPartida[idxPartida].resposta_correta;
    Array.from(DOM.jogo.painel.children).forEach(b => { if(b.innerText === certa) b.classList.add('btn-oraculo-highlight'); });
};
DOM.loja.espada.onclick = () => {
    match.cristais -= saveGlobal.config.precos.espada; atualizarHUD(); DOM.loja.espada.disabled = true;
    let errados = Array.from(DOM.jogo.painel.children).filter(b => b.innerText !== bancoPartida[idxPartida].resposta_correta).sort(()=>Math.random()-0.5);
    let qtd = Math.floor(errados.length / 2) || 1;
    for(let i=0; i<qtd; i++) errados[i].classList.add("btn-apagado");
};

// 11. COMBATE E VALIDAÇÃO
function processarResposta(btnClicado) {
    if(digitando) return;
    clearInterval(timerInterval); travar(true);
    const p = bancoPartida[idxPartida];
    
    if(!saveGlobal.stats[p.categoria]) saveGlobal.stats[p.categoria] = { certas: 0, total: 0 };
    saveGlobal.stats[p.categoria].total++;

    if (btnClicado && btnClicado.innerText === p.resposta_correta) {
        // ACERTOU
        saveGlobal.stats[p.categoria].certas++; btnClicado.classList.add("btn-correto");
        match.combo++; match.cristais += p.boss ? 2 : 1;
        
        if(!oracleUsado) {
            let base = saveGlobal.heroiAtual === "Ninja" ? 120 : 100;
            match.score += (base * match.combo) + (Math.floor(timerVal) * 5);
        }
        
        if(saveGlobal.achievements.combo10 === false && match.combo >= 10) saveGlobal.achievements.combo10 = true;
        if(p.boss) saveGlobal.achievements.godSlayer++;
        
        saveGlobal.errosIDs = saveGlobal.errosIDs.filter(id => id !== p.id);
        
        DOM.jogo.imgHero.classList.add("anim-ataque"); DOM.jogo.imgMob.classList.add("anim-dano");
        atualizarHUD(); salvarGlobal();
        if(p.boss) lancarParticulas(DOM.jogo.imgMob); 

        setTimeout(() => { DOM.jogo.imgHero.classList.remove("anim-ataque"); DOM.jogo.imgMob.classList.remove("anim-dano"); idxPartida++; carregarPergunta(); }, 1200);

    } else {
        // ERROU / TIMEOUT
        if(btnClicado) btnClicado.classList.add("btn-errado");
        if(!saveGlobal.errosIDs.includes(p.id)) saveGlobal.errosIDs.push(p.id); 
        match.combo = 0; match.hitTaken = true;
        
        let dano = p.boss ? 2 : 1;
        if(shieldAtivo) { shieldAtivo = false; dano = 0; } 
        match.hp -= dano;
        
        atualizarHUD(); salvarGlobal();
        containerJogo.classList.add("anim-shake");
        
        setTimeout(() => {
            containerJogo.classList.remove("anim-shake");
            document.getElementById('modal-resposta-correta').innerText = p.resposta_correta;
            document.getElementById('modal-explicacao').innerText = p.explicacao;
            document.getElementById('feedback-modal').classList.remove('escondido');
            
            let tmp = 3, btnE = document.getElementById('btn-entendi');
            btnE.disabled = true; btnE.innerText = `Lendo... (${tmp})`;
            let intB = setInterval(()=>{ tmp--; if(tmp>0) btnE.innerText = `Lendo... (${tmp})`; else { clearInterval(intB); btnE.disabled = false; btnE.innerText = "Avançar"; } }, 1000);
        }, 500);
    }
}

document.getElementById('btn-entendi').onclick = () => {
    tocarSom('click'); document.getElementById('feedback-modal').classList.add('escondido');
    if(match.hp > 0) { idxPartida++; carregarPergunta(); } else finalizarPartida(false);
};

// 12. FIM DE JOGO
function finalizarPartida(vitoria) {
    if(vitoria && !match.hitTaken) saveGlobal.achievements.intocavel = true;
    
    saveGlobal.cristaisGlobais += match.cristais;
    let xpGanha = Math.floor(match.score / 10); 
    saveGlobal.xp += xpGanha;
    
    let levelUp = false, proxLevel = saveGlobal.level * 1000;
    while(saveGlobal.xp >= proxLevel) { saveGlobal.xp -= proxLevel; saveGlobal.level++; levelUp = true; proxLevel = saveGlobal.level * 1000; }
    salvarGlobal(); trocarTela('jogo', 'fim');

    document.getElementById('endgame-score').innerText = match.score;
    document.getElementById('endgame-xp').innerText = `+${xpGanha} XP (Total: ${saveGlobal.xp}/${proxLevel})`;
    document.getElementById('level-up-alert').classList.toggle('escondido', !levelUp);
    
    const tf = document.getElementById('endgame-title'), tr = document.getElementById('endgame-rank');
    if(vitoria) {
        tocarSom('powerup'); lancarConfetes(); tf.innerText = "VITÓRIA"; tf.style.color = "#f1c40f";
        let r = "C", cr = "rank-C";
        if (match.score >= 1000 && match.hp === saveGlobal.config.maxHp) { r = "S"; cr = "rank-S"; }
        else if (match.score >= 600) { r = "A"; cr = "rank-A"; }
        else if (match.score >= 300) { r = "B"; cr = "rank-B"; }
        tr.innerText = r; tr.className = cr;
    } else {
        tocarSom('boss_hit'); tf.innerText = "GAME OVER"; tf.style.color = "#e74c3c";
        tr.innerText = "Destruído"; tr.className = "rank-C";
    }
}

// 13. UTILITÁRIOS FINAIS
function embaralharArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function travar(estado) { Array.from(DOM.jogo.painel.children).forEach(b => { if(!b.classList.contains("btn-apagado")) b.disabled = estado; }); }

function lancarParticulas(origem) {
    const c = document.getElementById('particles-container'), rect = origem.getBoundingClientRect();
    for(let i=0; i<15; i++) {
        let p = document.createElement('div'); p.className = 'particle-coin';
        p.style.left = rect.left + (rect.width/2) + 'px'; p.style.top = rect.top + (rect.height/2) + 'px';
        p.style.setProperty('--tx', (Math.random() * 200 - 100) + 'px'); p.style.setProperty('--ty', (Math.random() * -200 - 50) + 'px');
        c.appendChild(p); setTimeout(()=>p.remove(), 1000);
    }
}
function lancarConfetes() {
    const container = document.getElementById("particles-container"), cores = ['#f1c40f', '#2ecc71', '#e74c3c', '#9b59b6', '#3498db'];
    for(let i=0; i<80; i++) {
        let conf = document.createElement('div'); conf.className = 'particle-coin'; conf.style.borderRadius = "0"; 
        conf.style.left = Math.random() * 100 + 'vw'; conf.style.animation = `explode ${Math.random() * 3 + 2}s forwards linear`;
        conf.style.setProperty('--tx', '0px'); conf.style.setProperty('--ty', '100vh');
        conf.style.backgroundColor = cores[Math.floor(Math.random() * cores.length)];
        container.appendChild(conf); setTimeout(()=>conf.remove(), 5000);
    }
}