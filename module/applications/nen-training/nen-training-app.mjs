/**
 * nen-training-app.mjs
 * TREINO DE NEN — o despertar dos quatro princípios como DESAFIOS DE HABILIDADE
 * (destreza, ritmo, timing e precisão) no lugar das rolagens do livro.
 *
 *   · TEN   — A Caminhada: segure (mouse ou espaço) pra manter a aura na zona
 *             e avance os 27m até o PdN;
 *   · ZETSU — Sumir: avance só com o Olho do Narrador fechado — se ele abrir
 *             com você em movimento, te VÊ e você perde terreno (3 rodadas);
 *   · REN   — A Chama: reflexo puro — aperte a seta que acende na caixa antes
 *             dela sumir; a janela encurta a cada bloco;
 *   · HATSU — O Número da Água: números pipocam fora de ordem ao lado do copo;
 *             clique quando o SEU aparecer — a cada acerto a água reage mais
 *             à sua categoria (transborda, muda cor, engrossa, cria impurezas,
 *             folha violenta ou folha em chamas).
 *
 * Fluxo: o Narrador abre o PAINEL (botão no GM Tools), escolhe fase + participantes
 * e INICIA → o desafio (NenDesafioApp) abre na tela de cada jogador via socket →
 * os resultados voltam ao painel → CONCLUIR aplica a régua do livro: Domínio
 * (item com validade) pra quem terminou + Pontos de Nen somados ÷ jogadores (teto)
 * pra todos os participantes.
 */
import Application5e from "../api/application.mjs";

/* -------------------------------------------- */
/*  Estilos (injetados via JS — mesmo padrão do session-log: nada de reiniciar mundo) */
/* -------------------------------------------- */

const STYLE_ID = "hunter-nen-treino-styles";
const CSS_TEXT = `
.hunter-nen-treino .window-content,
.hunter-nen-desafio .window-content { padding: 0; background: #14161c; color: #e7eaf0; }

/* ---------- painel do Narrador ---------- */
.hj-tr { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.hj-tr__topo {
  padding: 14px 18px 10px; text-align: center;
  background: linear-gradient(160deg, #232838, #151824);
  border-bottom: 2px solid #d8c390;
}
.hj-tr__topo h1 { margin: 0; border: none; font-size: 20px; letter-spacing: 6px; color: #d8c390; }
.hj-tr__topo p { margin: 3px 0 0; font-size: 11.5px; color: #9aa3b5; }
.hj-tr__fases { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 10px 12px 4px; margin: 0; }
.hj-tr__fase {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 4px; cursor: pointer; height: auto; width: auto;
  background: rgba(255, 255, 255, .05); color: #cfd4de;
  border: 1px solid rgba(255, 255, 255, .12); border-radius: 8px;
}
.hj-tr__fase i { font-size: 15px; }
.hj-tr__fase b { font-size: 12px; letter-spacing: 1px; }
.hj-tr__fase small { font-size: 9.5px; opacity: .65; }
.hj-tr__fase.is-ativa { background: rgba(216, 195, 144, .16); border-color: #d8c390; color: #d8c390; }
.hj-tr__fase:hover { border-color: rgba(216, 195, 144, .6); }
.hj-tr__corpo { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 10px; }
.hj-tr__sobre {
  padding: 10px 12px; border-radius: 8px;
  background: rgba(0, 0, 0, .3); border: 1px solid rgba(255, 255, 255, .1);
}
.hj-tr__sobre h2 { margin: 0 0 4px; border: none; font-size: 14px; letter-spacing: 2px; color: #eef1f6; }
.hj-tr__sobre p { margin: 0; font-size: 12px; line-height: 1.55; color: #b9c0cd; }
.hj-tr__regra { margin-top: 5px !important; color: #d8c390 !important; font-size: 11.5px !important; }
.hj-tr__pool {
  display: flex; flex-direction: column; gap: 2px;
  padding: 9px 12px; border-radius: 8px;
  background: rgba(216, 165, 60, .12); border: 1px solid rgba(216, 165, 60, .5);
}
.hj-tr__pool b { font-size: 11px; letter-spacing: 1.5px; color: #e8c477; }
.hj-tr__pool span { font-size: 11.5px; color: #cfd4de; }
.hj-tr__lista h3 { margin: 0 0 6px; border: none; font-size: 11px; letter-spacing: 2px; color: #9aa3b5; }
.hj-tr__pessoa {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; margin-bottom: 4px; border-radius: 8px; cursor: pointer;
  background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .09);
}
.hj-tr__pessoa.is-off { opacity: .55; }
.hj-tr__pessoa img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,.25); }
.hj-tr__nome { font-size: 12.5px; font-weight: 600; }
.hj-tr__nome em { font-size: 10px; color: #8b93a5; font-style: normal; }
.hj-tr__res { margin-left: auto; font-size: 10.5px; text-align: right; max-width: 55%; }
.hj-tr__res.is-dominio { color: #7fd08a; font-weight: 700; }
.hj-tr__res.is-falha { color: #e08a8a; }
.hj-tr__res.is-jogando { color: #d8c390; }
.hj-tr__vazio { font-size: 12px; color: #8b93a5; font-style: italic; }
.hj-tr__acoes { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(255, 255, 255, .1); }
.hj-tr__btn {
  flex: 1; padding: 11px 8px; cursor: pointer; border-radius: 9px; height: auto;
  font-size: 12px; font-weight: 800; letter-spacing: 1.5px;
  border: 1px solid transparent; color: #14161c;
}
.hj-tr__btn.is-iniciar { background: linear-gradient(180deg, #ecd9a8, #c9a961); border-color: #8a713a; }
.hj-tr__btn.is-concluir { background: linear-gradient(180deg, #9fd8a8, #5aa568); border-color: #35663f; }
.hj-tr__btn.is-cancelar, .hj-tr__btn.is-testar {
  flex: 0 0 auto; background: rgba(255, 255, 255, .08); color: #cfd4de; border-color: rgba(255, 255, 255, .2);
}
.hj-tr__btn:hover { filter: brightness(1.08); }

/* ---------- arena do jogador ---------- */
.hj-df { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow-y: auto; }
.hj-df__brief, .hj-df__final {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 22px 24px; text-align: center;
}
.hj-df__selo, .hj-df__final-selo {
  width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; font-size: 26px; color: #d8c390;
  background: rgba(216, 195, 144, .12); border: 2px solid #d8c390;
  box-shadow: 0 0 24px rgba(216, 195, 144, .3);
}
.hj-df__brief h2, .hj-df__final h2 { margin: 0; border: none; font-size: 17px; letter-spacing: 3px; color: #eef1f6; }
.hj-df__brief p { margin: 0; font-size: 12.5px; line-height: 1.6; color: #b9c0cd; max-width: 380px; }
.hj-df__regra { color: #d8c390 !important; font-size: 11.5px !important; }
.hj-df__numeros { display: flex; gap: 7px; flex-wrap: wrap; justify-content: center; margin: 4px 0 0; }
.hj-df__num {
  width: 62px; height: 52px; cursor: pointer; border-radius: 9px; padding: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  background: rgba(255, 255, 255, .05); color: #cfd4de;
  border: 1px solid rgba(255, 255, 255, .16);
}
.hj-df__num b { font-size: 16px; }
.hj-df__num small { font-size: 9px; letter-spacing: .3px; opacity: .85; white-space: nowrap; }
.hj-df__num:hover { border-color: var(--cor, #9fd0f5); }
.hj-df__num.is-marcado {
  border-color: var(--cor, #9fd0f5); color: #fff;
  background: rgba(255, 255, 255, .09);
  box-shadow: inset 0 0 0 1px var(--cor, #9fd0f5), 0 0 12px -4px var(--cor, #9fd0f5);
}
.hj-df__num-dica { font-size: 10.5px !important; color: #8b93a5 !important; }
.hj-df__btn {
  margin-top: 6px; padding: 12px 26px; cursor: pointer; border-radius: 10px; height: auto; width: auto;
  font-size: 13px; font-weight: 800; letter-spacing: 2.5px; color: #14161c;
  background: linear-gradient(180deg, #ecd9a8, #c9a961); border: 1px solid #8a713a;
}
.hj-df__btn:hover { filter: brightness(1.08); }
.hj-df__final.is-dominio h2 { color: #7fd08a; }
.hj-df__final.is-falha h2 { color: #e08a8a; }
.hj-df__final-det { margin: 0; font-size: 12.5px; color: #cfd4de; }
.hj-df__final-aviso { margin: 0; font-size: 11px; color: #8b93a5; max-width: 340px; }
.hj-df__arena { flex: 1; display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 18px; min-height: 0; user-select: none; }
.hj-df__hud {
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  padding: 0 2px; font-size: 11px; letter-spacing: 1.5px; color: #9aa3b5; white-space: nowrap;
}
.hj-df__hud b { color: #d8c390; font-size: 14px; }
.hj-df__dica { margin: 0; padding: 0 6px 2px; font-size: 11.5px; line-height: 1.55; color: #9aa3b5; text-align: center; }
.hj-df__dica kbd {
  padding: 1px 6px; border-radius: 4px; font-size: 10.5px;
  background: rgba(255, 255, 255, .12); border: 1px solid rgba(255, 255, 255, .3); color: #eef1f6;
}

/* TEN: trilha + medidor de aura */
.hj-ten__cena { flex: 1; display: flex; gap: 14px; min-height: 240px; cursor: pointer; }
.hj-ten__trilha {
  position: relative; flex: 1; border-radius: 10px; overflow: hidden;
  background: linear-gradient(180deg, #1b2030 65%, #232b40 65%);
  border: 1px solid rgba(255, 255, 255, .12);
}
.hj-ten__runner { position: absolute; left: 0; bottom: 24%; font-size: 30px; transition: left .1s linear; }
.hj-ten__pdn { position: absolute; right: 4px; bottom: 24%; font-size: 30px; filter: drop-shadow(0 0 8px rgba(216,195,144,.8)); }
.hj-ten__medidor {
  position: relative; width: 52px; border-radius: 10px; overflow: hidden;
  background: rgba(0, 0, 0, .45); border: 1px solid rgba(255, 255, 255, .15);
}
.hj-ten__zona {
  position: absolute; left: 0; right: 0; bottom: 38%; height: 24%;
  background: rgba(216, 195, 144, .25);
  border-top: 1px dashed #d8c390; border-bottom: 1px dashed #d8c390;
}
.hj-ten__agulha {
  position: absolute; left: 4px; right: 4px; bottom: 50%; height: 8px; border-radius: 4px;
  background: #9fd0f5; box-shadow: 0 0 10px rgba(159, 208, 245, .9);
}
.hj-ten__agulha.is-fora { background: #e08a8a; box-shadow: 0 0 10px rgba(224, 138, 138, .9); }

/* ZETSU: o olho e a penumbra */
.hj-zt__cena {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  min-height: 240px; border-radius: 10px; cursor: pointer;
  background: radial-gradient(circle at 50% 30%, #232838, #101218 70%);
  border: 1px solid rgba(255, 255, 255, .12);
  transition: border-color .2s ease, box-shadow .2s ease;
}
.hj-zt__cena.is-flagra {
  border-color: #e08a8a;
  box-shadow: inset 0 0 40px rgba(224, 80, 80, .35);
}
.hj-zt__cena.is-flagra .hj-zt__olho { animation: hj-zt-treme .35s ease; }
@keyframes hj-zt-treme {
  0%, 100% { transform: scale(1.3) translateX(0); }
  25% { transform: scale(1.35) translateX(-5px); }
  75% { transform: scale(1.35) translateX(5px); }
}
.hj-zt__olho { font-size: 64px; transition: transform .15s; }
.hj-zt__olho.is-abrindo { transform: scale(1.15); }
.hj-zt__olho.is-aberto { transform: scale(1.3); filter: drop-shadow(0 0 16px rgba(224, 80, 80, .9)); }
.hj-zt__progresso {
  width: 82%; height: 14px; border-radius: 7px; overflow: hidden;
  background: rgba(0, 0, 0, .5); border: 1px solid rgba(255, 255, 255, .2);
}
.hj-zt__barra { width: 0%; height: 100%; background: linear-gradient(90deg, #5b6ea8, #9fd0f5); }

/* REN: a caixa do reflexo + a fornalha */
.hj-rn__corpo {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 12px;
  min-height: 240px;
}
.hj-rn__caixa { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.hj-rn__seta {
  width: 84px; height: 84px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 42px; font-weight: 900; color: #eef1f6;
  background: rgba(0, 0, 0, .4);
  border: 2px solid rgba(255, 255, 255, .18);
  transition: border-color .1s ease, transform .1s ease, color .1s ease;
}
.hj-rn__seta.is-vazia { color: rgba(255, 255, 255, .12); }
.hj-rn__seta.is-acerto { border-color: #7fd08a; transform: scale(1.07); }
.hj-rn__seta.is-erro { border-color: #e08a8a; transform: scale(.93); }
.hj-rn__tempo {
  width: 84px; height: 5px; border-radius: 3px; overflow: hidden;
  background: rgba(255, 255, 255, .1);
}
.hj-rn__tempo-b { height: 100%; width: 0%; background: #d8c390; }
.hj-rn__fornalha {
  position: relative; width: 150px; flex: 1; min-height: 120px; border-radius: 10px; overflow: hidden;
  background: rgba(0, 0, 0, .45); border: 1px solid rgba(255, 255, 255, .15);
}
.hj-rn__linha { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed rgba(255,255,255,.4); z-index: 2; }
.hj-rn__linha.is-alta { bottom: 68%; border-color: rgba(127, 208, 138, .7); }
.hj-rn__linha.is-media { bottom: 40%; border-color: rgba(232, 196, 119, .7); }
.hj-rn__chama {
  position: absolute; left: 0; right: 0; bottom: 0; height: 55%;
  background: linear-gradient(180deg, #ffd77a, #ff8a3c 45%, #d84315);
  box-shadow: 0 -8px 24px rgba(255, 138, 60, .55);
  transition: height .1s linear;
}
.hj-rn__chama.is-alta { filter: brightness(1.2) saturate(1.2); }
.hj-rn__chama.is-baixa { filter: brightness(.65) saturate(.7); }

/* HATSU: o copo que sintoniza + o número que pipoca */
.hj-ht__palco {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 30px;
  min-height: 230px; border-radius: 10px; cursor: pointer;
  background: radial-gradient(circle at 50% 40%, #1d2a3a, #101218 75%);
  border: 1px solid rgba(255, 255, 255, .12);
}
.hj-ht__num {
  width: 96px; height: 96px; display: flex; align-items: center; justify-content: center;
  border-radius: 16px; font-size: 54px; font-weight: 900;
  color: rgba(255, 255, 255, .14);
  background: rgba(0, 0, 0, .35); border: 2px solid rgba(255, 255, 255, .14);
  transition: transform .1s ease, border-color .1s ease;
}
.hj-ht__num.is-mostra {
  color: var(--corn, #fff); border-color: var(--corn, #fff);
  transform: scale(1.08);
  text-shadow: 0 0 18px var(--corn, #fff);
}
.hj-ht__num.is-acerto { border-color: #7fd08a; box-shadow: 0 0 18px -4px #7fd08a; }
.hj-ht__num.is-erro { border-color: #e08a8a; box-shadow: 0 0 18px -4px #e08a8a; }
.hj-ht__copo { position: relative; width: 88px; height: 106px; }
.hj-ht__vidro {
  position: absolute; inset: 0;
  border: 2px solid rgba(190, 210, 235, .55);
  border-radius: 8px 8px 18px 18px;
  background: linear-gradient(180deg, rgba(190, 210, 235, .05), rgba(190, 210, 235, .12));
  box-shadow: inset 0 0 12px rgba(120, 170, 220, .18);
}
.hj-ht__liquido {
  position: absolute; left: 2px; right: 2px; bottom: 2px; height: 86%; overflow: hidden;
  border-radius: 3px 3px 15px 15px;
  background: linear-gradient(180deg, rgba(90, 160, 220, .32), rgba(40, 90, 150, .55));
  transition: height .5s ease, filter .6s ease, background .6s ease;
}
.hj-ht__superficie {
  position: absolute; left: 0; right: 0; top: 0; height: 4px;
  background: rgba(190, 225, 255, .5);
  animation: hj-ht-bob 3.2s ease-in-out infinite;
}
.hj-ht__ninho { position: absolute; inset: 0; }
.hj-ht__folha {
  position: absolute; left: 50%; top: 4%; margin-left: -9px; font-size: 17px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .5));
  animation: hj-ht-bob 3.2s ease-in-out infinite;
}
.hj-ht__folha.is-nav { animation: hj-ht-nav 2.6s ease-in-out infinite; margin-left: 0; }
.hj-ht__fogo {
  position: absolute; left: 50%; top: -8%; margin-left: -8px; font-size: 15px;
  opacity: 0; transition: opacity .4s ease, transform .4s ease;
}
@keyframes hj-ht-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(2.5px); }
}
@keyframes hj-ht-nav {
  0%, 100% { left: 18%; transform: rotate(-16deg); }
  50%      { left: 66%; transform: rotate(16deg) translateY(2px); }
}
.hj-ht__gota {
  position: absolute; top: 1px; width: 5px; height: 9px; opacity: 0;
  border-radius: 50% 50% 60% 60%; background: #7fb4e6; pointer-events: none;
}
.hj-ht__gota.g1 { left: 16%; } .hj-ht__gota.g2 { left: 50%; animation-delay: .45s !important; } .hj-ht__gota.g3 { left: 78%; animation-delay: .9s !important; }
.hj-ht__copo.is-transb .hj-ht__gota { animation: hj-ht-gota 1.3s ease-in infinite; }
@keyframes hj-ht-gota {
  0%   { transform: translateY(0); opacity: 0; }
  12%  { opacity: 1; }
  100% { transform: translateY(110px); opacity: 0; }
}
.hj-ht__bolha {
  position: absolute; bottom: 6px; width: 7px; height: 7px; border-radius: 50%; opacity: 0;
  border: 1px solid rgba(255, 255, 255, .75); background: rgba(255, 255, 255, .15); pointer-events: none;
}
.hj-ht__bolha.b1 { left: 22%; } .hj-ht__bolha.b2 { left: 48%; animation-delay: .6s !important; } .hj-ht__bolha.b3 { left: 70%; animation-delay: 1.2s !important; }
.hj-ht__copo.is-viscosa .hj-ht__bolha { animation: hj-ht-bolha 2.4s ease-in infinite; }
@keyframes hj-ht-bolha {
  0%   { transform: translateY(0) scale(.7); opacity: 0; }
  18%  { opacity: .9; }
  100% { transform: translateY(-74px) scale(1.05); opacity: 0; }
}
.hj-ht__impureza {
  position: absolute; width: 7px; height: 7px; opacity: .95;
  border-radius: 40% 60% 55% 45%; background: #16222f;
  box-shadow: 0 0 3px rgba(0, 0, 0, .8);
  animation: hj-ht-imp .5s ease;
}
@keyframes hj-ht-imp {
  from { opacity: 0; transform: scale(.2); }
  to   { opacity: .95; transform: scale(1); }
}
.hj-ht__legenda { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.hj-ht__cat {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 8px; border-radius: 7px; font-size: 10.5px; color: #b9c0cd;
  background: rgba(0, 0, 0, .3); border: 1px solid rgba(255, 255, 255, .12);
}
.hj-ht__cat b { color: #fff; }
.hj-ht__cat .k { color: var(--cor, #fff); font-weight: 700; }
.hj-ht__cat.is-minha { border-color: var(--cor, #fff); box-shadow: 0 0 10px -4px var(--cor, #fff); color: #eef1f6; }
`;

function injectStyles() {
  if ( document.getElementById(STYLE_ID) ) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

/* -------------------------------------------- */
/*  Dados das fases + helpers                    */
/* -------------------------------------------- */

/** Ordem canônica das categorias — Aprimoramento é o nº 1, Especialização o nº 6. */
const CATEGORIAS = ["aprimorador", "emissor", "transmutador", "conjurador", "manipulador", "especialista"];
const CATEGORIA_INFO = {
  aprimorador:  { label: "Aprimorador",  curto: "Aprim.",  cor: "#e86800" },
  emissor:      { label: "Emissor",      curto: "Emissor", cor: "#B8860B" },
  transmutador: { label: "Transmutador", curto: "Transm.", cor: "#9B59D0" },
  conjurador:   { label: "Conjurador",   curto: "Conjur.", cor: "#3A8FD4" },
  manipulador:  { label: "Manipulador",  curto: "Manip.",  cor: "#2ECC71" },
  especialista: { label: "Especialista", curto: "Espec.",  cor: "#AAAAAA" }
};

export const FASES = {
  ten: {
    label: "Ten", titulo: "APRENDENDO O TEN", dias: 3, icone: "fa-solid fa-circle-notch",
    resumo: "Mantenha a aura contida na zona enquanto caminha os 27 metros até o PdN. Vazou a aura, os pés param.",
    regra: "Domínio ao chegar · até 10 vazamentos: 4 PN · de 11 a 15: 2 PN."
  },
  zetsu: {
    label: "Zetsu", titulo: "CONHECENDO O ZETSU", dias: 7, icone: "fa-solid fa-eye-slash",
    resumo: "Três rodadas: avance na penumbra SÓ enquanto o Olho do Narrador estiver fechado. Se ele abrir com você em movimento, te vê — e a cada rodada ele abre mais rápido.",
    regra: "Domínio com 1 rodada completa · 2 PN com 2 rodadas limpas · 4 PN com as 3 limpas."
  },
  ren: {
    label: "Ren", titulo: "DOMINANDO O REN", dias: 15, icone: "fa-solid fa-fire-flame-curved",
    resumo: "Reflexo puro: aperte a seta que acende na caixa antes dela sumir. As setas vêm cada vez mais rápido — e a chama definha sozinha.",
    regra: "Domínio completando os 3 blocos · 2 PN com 1 bloco ALTO e 1 MÉDIO · 4 PN com 2 ALTOS e 1 MÉDIO."
  },
  hatsu: {
    label: "Hatsu", titulo: "ALCANÇANDO O HATSU", dias: 30, icone: "fa-solid fa-hand-sparkles",
    resumo: "Números pipocam fora de ordem ao lado do copo. Reaja quando o SEU aparecer — cada acerto sintoniza a água com a sua categoria.",
    regra: "Domínio ao encarar as 10 aparições · 2 PN com 2 acertos · 4 PN com 4 acertos."
  }
};

/** O personagem deste usuário (GM não tem "seu" personagem — retorna null). */
function meuPersonagem() {
  if ( game.user.character ) return game.user.character;
  if ( game.user.isGM ) return null;
  return game.actors.find(a => a.type === "character" && a.testUserPermission(game.user, "OWNER")) ?? null;
}

/** Personagens com dono jogador (elegíveis pro treinamento). */
function cacadoresComDono() {
  return game.actors
    .filter(a => a.type === "character" && game.users.some(u => !u.isGM && a.testUserPermission(u, "OWNER")))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** O número da água de um ator (1–6 pela categoria dominante; null sem categoria). */
export function numeroDaAgua(ator) {
  const cats = ator?.system?.nenCategories ?? {};
  let melhor = null;
  for ( const [key, dado] of Object.entries(cats) ) {
    const lvl = Number(dado?.level) || 0;
    if ( lvl > 0 && (!melhor || lvl > melhor.lvl) ) melhor = { key, lvl };
  }
  if ( !melhor ) return null;
  const i = CATEGORIAS.indexOf(melhor.key);
  return i >= 0 ? i + 1 : null;
}

/* ============================================================ */
/*  PAINEL DO NARRADOR                                           */
/* ============================================================ */

export default class NenTreinoApp extends Application5e {
  static instancia = null;
  static abrir() {
    if ( !game.user.isGM ) return;
    if ( NenTreinoApp.instancia?.rendered ) return NenTreinoApp.instancia.render();
    NenTreinoApp.instancia = new NenTreinoApp();
    NenTreinoApp.instancia.render(true);
  }

  /** Convite chegou por socket: se algum personagem MEU foi convocado, o desafio abre. */
  static receberConvite(data) {
    if ( game.user.isGM ) return;
    const lista = data.participantes ?? [];
    // prefere o personagem principal do usuário; senão, qualquer participante que ele possua
    const atorId = lista.includes(game.user.character?.id)
      ? game.user.character.id
      : lista.find(id => game.actors.get(id)?.testUserPermission(game.user, "OWNER"));
    if ( !atorId ) return;
    NenDesafioApp.abrir({ fase: data.fase, sessaoId: data.sessaoId, atorId });
  }

  /**
   * Resultado de um jogador chegou. A sessão vive em NenTreinoApp.sessao (estática):
   * nada se perde com o painel fechado — reabrir retoma de onde parou.
   */
  static receberResultado(data) {
    const s = NenTreinoApp.sessao;
    if ( !s || data.sessaoId !== s.id ) return;
    if ( !s.participantes.includes(data.atorId) ) return;
    s.resultados[data.atorId] = {
      dominio: !!data.dominio,
      pn: Math.min(4, Math.max(0, Number(data.pn) || 0)),   // teto do livro — ninguém "traz" mais que 4
      detalhe: String(data.detalhe ?? "").slice(0, 120)
    };
    NenTreinoApp.instancia?.render();
  }

  static DEFAULT_OPTIONS = {
    id: "nen-treino-app",
    tag: "div",
    classes: ["hunter-nen-treino"],
    window: { title: "Treino de Nen — o Despertar", icon: "fa-solid fa-hand-sparkles", resizable: true },
    position: { width: 620, height: 640 },
    actions: {
      treinoFase:     NenTreinoApp.#onFase,
      treinoIniciar:  NenTreinoApp.#onIniciar,
      treinoTestar:   NenTreinoApp.#onTestar,
      treinoConcluir: NenTreinoApp.#onConcluir,
      treinoCancelar: NenTreinoApp.#onCancelar
    }
  };

  static PARTS = {
    main: { template: "systems/hunter-system/templates/apps/nen-treino.hbs", scrollable: [".hj-tr__corpo"] }
  };

  _fase = "ten";
  #concluindo = false;   // trava de clique-duplo na premiação

  /** A sessão em andamento — ESTÁTICA de propósito: sobrevive a fechar/reabrir o painel. */
  static sessao = null;   // { id, fase, participantes: [atorIds], resultados: {atorId: {dominio, pn, detalhe}} }
  get _sessao() { return NenTreinoApp.sessao; }
  set _sessao(v) { NenTreinoApp.sessao = v; }

  _onClose(options) {
    super._onClose(options);
    if ( NenTreinoApp.instancia === this ) NenTreinoApp.instancia = null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this._sessao;
    if ( s ) this._fase = s.fase;   // painel reaberto no meio de um treino mostra a fase certa
    const fase = FASES[this._fase];
    context.cacadores = cacadoresComDono().map(a => {
      const online = game.users.some(u => u.active && !u.isGM && a.testUserPermission(u, "OWNER"));
      const r = s?.resultados?.[a.id];
      return {
        id: a.id, nome: a.name, img: a.img, online,
        participa: s ? s.participantes.includes(a.id) : online,
        resultado: r ? {
          dominio: r.dominio, pn: r.pn,
          rotulo: r.dominio ? (r.pn ? `DOMÍNIO +${r.pn} PN` : "DOMÍNIO") : "não concluiu",
          detalhe: r.detalhe
        } : null
      };
    });
    let pool = null;
    if ( s ) {
      const total = Object.values(s.resultados).reduce((x, r) => x + (r.pn || 0), 0);
      pool = {
        total,
        n: s.participantes.length,
        cada: s.participantes.length ? Math.ceil(total / s.participantes.length) : 0,
        respondidos: Object.keys(s.resultados).length
      };
    }
    context.fases = Object.entries(FASES).map(([key, f]) => ({ key, ...f, ativa: key === this._fase }));
    context.fase = { key: this._fase, ...fase };
    context.sessao = s ? { fase: FASES[s.fase].label, ...pool } : null;
    context.emAndamento = !!s;
    return context;
  }

  /* ---------- ações ---------- */

  static #onFase(event, target) {
    if ( this._sessao ) return void ui.notifications.warn("Conclua (ou cancele) o treino em andamento primeiro.");
    this._fase = target.dataset.fase;
    this.render();
  }

  static #onIniciar() {
    if ( this._sessao ) return;
    const marcados = [...this.element.querySelectorAll("input[data-tr-part]:checked")].map(i => i.dataset.trPart);
    if ( !marcados.length ) return void ui.notifications.warn("Marque quem participa do treinamento.");
    this._sessao = {
      id: Math.random().toString(36).slice(2, 10),
      fase: this._fase,
      participantes: marcados,
      resultados: {}
    };
    game.socket.emit("system.hunter-system", {
      action: "nenTreinoConvite", sessaoId: this._sessao.id, fase: this._fase, participantes: marcados
    });
    ChatMessage.create({
      speaker: { alias: "Treino de Nen" },
      content: `<p><b>🔥 O DESPERTAR COMEÇOU — ${FASES[this._fase].titulo}</b></p>
        <p>O desafio abriu na tela dos participantes. Concentrem-se.</p>`
    }).catch(() => null);
    this.render();
  }

  /** O Narrador prova do próprio remédio (não conta pro treino). */
  static #onTestar() {
    NenDesafioApp.abrir({ fase: this._fase, sessaoId: null, atorId: null, teste: true });
  }

  static async #onConcluir() {
    const s = this._sessao;
    if ( !s || this.#concluindo ) return;
    this.#concluindo = true;   // clique-duplo no meio dos awaits não premia duas vezes
    const fase = FASES[s.fase];
    const esc = foundry.utils.escapeHTML;
    const total = Object.values(s.resultados).reduce((x, r) => x + (r.pn || 0), 0);
    const cada = s.participantes.length ? Math.ceil(total / s.participantes.length) : 0;
    const linhas = [];

    for ( const atorId of s.participantes ) {
      const ator = game.actors.get(atorId);
      if ( !ator ) continue;
      const r = s.resultados[atorId];
      // Domínio: o princípio básico vira item na ficha, com a validade do livro
      if ( r?.dominio ) {
        await ator.createEmbeddedDocuments("Item", [{
          name: `Princípio Básico: ${fase.label}`,
          type: "feat",
          img: "icons/svg/aura.svg",
          system: { description: { value:
            `<p><b>Domínio do ${fase.label}</b> — treinamento do despertar concluído. Dura até <b>${fase.dias} dia(s)</b>.</p>
             <p><em>${fase.resumo}</em></p>` } }
        }]).catch(() => null);
      }
      // Pontos de Nen: a soma da turma dividida pela turma — pra TODOS os participantes
      if ( cada > 0 ) {
        const atual = ator.system?.curseResources?.cursePoints ?? 0;
        await ator.update({ "system.curseResources.cursePoints": atual + cada }).catch(() => null);
      }
      linhas.push(`<li><b>${esc(ator.name)}</b> — ${r?.dominio ? `Domínio do ${fase.label}` : "não concluiu"}${r?.detalhe ? ` <em>(${esc(r.detalhe)})</em>` : ""}${r?.pn ? ` · trouxe +${r.pn} PN` : ""}</li>`);
    }

    ChatMessage.create({
      speaker: { alias: "Treino de Nen" },
      content: `<p><b>🔥 TREINO CONCLUÍDO — ${fase.titulo}</b></p>
        <ul style="margin:4px 0 6px; padding-left:18px">${linhas.join("")}</ul>
        <p>Pontos de Nen da turma: <b>${total}</b> ÷ ${s.participantes.length} jogador(es) = <b>+${cada} PN pra cada</b>.</p>`
    }).catch(() => null);

    this._sessao = null;
    this.#concluindo = false;
    this.render();
  }

  static #onCancelar() {
    this._sessao = null;
    this.render();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    injectStyles();
  }
}

/* ============================================================ */
/*  O DESAFIO (janela do jogador)                                */
/* ============================================================ */

export class NenDesafioApp extends Application5e {
  static instancia = null;
  static abrir({ fase, sessaoId, atorId, teste = false } = {}) {
    NenDesafioApp.instancia?.close();
    const app = new NenDesafioApp();
    app._fase = fase;
    app._sessaoId = sessaoId;
    app._atorId = atorId;
    app._teste = teste;
    // Hatsu: o número da água vem pré-marcado pela categoria dominante da ficha
    if ( fase === "hatsu" ) app._numero = numeroDaAgua(game.actors.get(atorId) ?? meuPersonagem());
    NenDesafioApp.instancia = app;
    app.render(true);
  }

  static DEFAULT_OPTIONS = {
    id: "nen-desafio-app",
    tag: "div",
    classes: ["hunter-nen-desafio"],
    // sem ícone no header: com título longo ele sobrepunha o texto
    window: { title: "O Despertar do Nen", resizable: false },
    position: { width: 470, height: 610 },
    actions: {
      desafioNumero:  NenDesafioApp.#onNumero,
      desafioComecar: NenDesafioApp.#onComecar,
      desafioFechar:  NenDesafioApp.#onFechar
    }
  };

  static PARTS = {
    main: { template: "systems/hunter-system/templates/apps/nen-desafio.hbs" }
  };

  _fase = "ten";
  _sessaoId = null;
  _atorId = null;
  _teste = false;
  _numero = null;      // Hatsu: número da água (1–6), escolhido no briefing
  _comecou = false;
  _resultado = null;   // { dominio, pn, detalhe }
  #timers = [];
  #teclaFn = null;
  #ponteiroFn = null;
  #jogo = null;        // estado do minigame em andamento

  get title() {
    return `${FASES[this._fase]?.titulo ?? "Despertar"}${this._teste ? " (teste)" : ""}`;
  }

  _onClose(options) {
    super._onClose(options);
    this.#limparTimers();
    // fechou no meio sem terminar: o Narrador fica sabendo
    if ( this._comecou && !this._resultado && !this._teste ) {
      this.#enviar({ dominio: false, pn: 0, detalhe: "abandonou o treino" });
    }
    if ( NenDesafioApp.instancia === this ) NenDesafioApp.instancia = null;
  }

  #limparTimers() {
    for ( const t of this.#timers ) clearInterval(t);   // limpa intervals E timeouts (mesmo pool)
    this.#timers = [];
    if ( this.#teclaFn ) {
      window.removeEventListener("keydown", this.#teclaFn.down, true);
      window.removeEventListener("keyup", this.#teclaFn.up, true);
      this.#teclaFn = null;
    }
    if ( this.#ponteiroFn ) {
      this.#ponteiroFn.arena?.removeEventListener("pointerdown", this.#ponteiroFn.down);
      if ( this.#ponteiroFn.up ) window.removeEventListener("pointerup", this.#ponteiroFn.up);
      this.#ponteiroFn = null;
    }
  }

  #intervalo(fn, ms) {
    const id = setInterval(fn, ms);
    this.#timers.push(id);
    return id;
  }

  #agendar(fn, ms) {
    const id = setTimeout(fn, ms);
    this.#timers.push(id);
    return id;
  }

  /**
   * Teclado em fase de CAPTURA: o desafio come a tecla antes do core do Foundry
   * (senão seta move token, espaço pausa o mundo, enter foca o chat).
   * Digitação em input/textarea/chat passa reto.
   */
  #teclas(down, up = null) {
    const emCampo = ev => ev.target instanceof HTMLElement
      && !!ev.target.closest("input, textarea, [contenteditable]");
    this.#teclaFn = {
      down: ev => { if ( !emCampo(ev) ) down(ev); },
      up: ev => { if ( !emCampo(ev) ) up?.(ev); }
    };
    window.addEventListener("keydown", this.#teclaFn.down, true);
    window.addEventListener("keyup", this.#teclaFn.up, true);
  }

  /** Mouse na arena: `down` no clique (botão esquerdo), `up` ao soltar (em qualquer lugar). */
  #ponteiro(down, up = null) {
    const arena = this.element?.querySelector("[data-df-arena]") ?? this.element;
    if ( !arena ) return;
    this.#ponteiroFn = {
      arena,
      down: ev => { if ( ev.button === 0 ) { ev.preventDefault(); down(ev); } },
      up: up ? (ev => up(ev)) : null
    };
    arena.addEventListener("pointerdown", this.#ponteiroFn.down);
    if ( this.#ponteiroFn.up ) window.addEventListener("pointerup", this.#ponteiroFn.up);
  }

  #q(sel) { return this.element?.querySelector(sel); }

  #enviar(resultado) {
    this._resultado = resultado;
    if ( this._teste ) return;
    const data = { action: "nenTreinoResultado", sessaoId: this._sessaoId, atorId: this._atorId, ...resultado };
    if ( game.user.isGM ) NenTreinoApp.receberResultado(data);
    else game.socket.emit("system.hunter-system", data);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const fase = FASES[this._fase] ?? FASES.ten;
    context.fase = { key: this._fase, ...fase };
    context.isTen = this._fase === "ten";
    context.isZetsu = this._fase === "zetsu";
    context.isRen = this._fase === "ren";
    context.isHatsu = this._fase === "hatsu";
    context.comecou = this._comecou;
    if ( context.isHatsu ) {
      const sugestao = numeroDaAgua(game.actors.get(this._atorId) ?? meuPersonagem());
      context.numero = this._numero;
      context.numeros = CATEGORIAS.map((id, i) => ({
        n: i + 1,
        curto: CATEGORIA_INFO[id].curto,
        cor: CATEGORIA_INFO[id].cor,
        label: CATEGORIA_INFO[id].label,
        marcado: this._numero === i + 1,
        sugerido: sugestao === i + 1
      }));
      context.sugestao = sugestao ? { n: sugestao, label: CATEGORIA_INFO[CATEGORIAS[sugestao - 1]].label } : null;
    }
    context.resultado = this._resultado ? {
      ...this._resultado,
      rotulo: this._resultado.dominio
        ? (this._resultado.pn ? `DOMÍNIO DO ${fase.label.toUpperCase()} — +${this._resultado.pn} PN pra turma!` : `DOMÍNIO DO ${fase.label.toUpperCase()}!`)
        : "A aura escapou — o princípio não veio desta vez."
    } : null;
    return context;
  }

  static #onFechar() { this.close(); }

  /** Hatsu: marca o número da água (a categoria combinada com o Narrador). */
  static #onNumero(event, target) {
    if ( this._comecou ) return;
    this._numero = Number(target.dataset.n) || null;
    this.render();
  }

  static #onComecar() {
    if ( this._comecou ) return;
    if ( this._fase === "hatsu" && !this._numero ) {
      return void ui.notifications.warn("Escolha o número da sua categoria antes de encarar a água.");
    }
    this._comecou = true;
    this.render();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    injectStyles();
    if ( !this._comecou || this._resultado ) return;
    this.#limparTimers();
    if ( this._fase === "ten" ) this.#jogarTen();
    else if ( this._fase === "zetsu" ) this.#jogarZetsu();
    else if ( this._fase === "ren" ) this.#jogarRen();
    else if ( this._fase === "hatsu" ) this.#jogarHatsu();
  }

  #terminar(resultado) {
    this.#limparTimers();
    this.#enviar(resultado);
    this.render();
  }

  /* ---------- TEN: a caminhada dos 27 metros ---------- */

  #jogarTen() {
    const ALTURA_ZONA = 24;   // 20% menor que a original (30)
    const j = this.#jogo = {
      dist: 27, agulha: 50, drift: 0, segurando: false,
      fora: false, surtos: 0, t: 0,
      zona: 38, zonaAlvo: 38, zonaT: 0   // a faixa dourada VAGUEIA — o jogador persegue
    };
    const SEGURA = ["Space", "Enter", "NumpadEnter"];
    this.#teclas(
      ev => { if ( SEGURA.includes(ev.code) ) { ev.preventDefault(); ev.stopImmediatePropagation(); j.segurando = true; } },
      ev => { if ( SEGURA.includes(ev.code) ) { ev.preventDefault(); ev.stopImmediatePropagation(); j.segurando = false; } }
    );
    this.#ponteiro(() => { j.segurando = true; }, () => { j.segurando = false; });
    const FORCA = 2.4;   // a força do jogador SEMPRE vence a deriva (máx 1.5 × 1.3 = 1.95)
    this.#intervalo(() => {
      j.t += 0.05;
      // a ZONA vagueia: sorteia um destino de tempos em tempos e desliza até ele,
      // um pouco mais rápido conforme o treino avança — mas sempre perseguível
      j.zonaT -= 0.05;
      if ( j.zonaT <= 0 ) {
        j.zonaAlvo = 6 + Math.random() * (94 - ALTURA_ZONA - 6);
        j.zonaT = 1.8 + Math.random() * 2.2;
      }
      // teto de velocidade ABAIXO da autoridade do jogador no pior caso de deriva
      // (2.4 − 1.5×1.3 = 0.45/tick): a zona nunca fica impossível de alcançar
      const velZona = 0.28 + Math.min(0.14, j.t / 220);
      j.zona += Math.max(-velZona, Math.min(velZona, j.zonaAlvo - j.zona));
      const zonaEl = this.#q("[data-ten-zona]");
      if ( zonaEl ) zonaEl.style.bottom = `${j.zona}%`;

      // a aura deriva, mas com reversão à média e teto ABAIXO da força do jogador:
      // sempre dá pra puxar de volta, pros dois lados
      j.drift += (Math.random() - 0.5) * 0.55;
      j.drift *= 0.985;
      j.drift = Math.max(-1.5, Math.min(1.5, j.drift));
      const dificuldade = Math.min(1.3, 1 + j.t / 120);
      j.agulha += (j.segurando ? FORCA : -FORCA) + j.drift * dificuldade;
      j.agulha = Math.max(0, Math.min(100, j.agulha));

      const dentro = j.agulha >= j.zona && j.agulha <= j.zona + ALTURA_ZONA;
      if ( dentro ) {
        if ( j.fora ) j.fora = false;
        j.dist = Math.max(0, j.dist - 0.045);   // ~0,9 m/s com a aura firme
      } else if ( !j.fora ) {
        j.fora = true;
        j.surtos++;
      }

      const agulhaEl = this.#q("[data-ten-agulha]");
      if ( agulhaEl ) {
        agulhaEl.style.bottom = `${j.agulha}%`;
        agulhaEl.classList.toggle("is-fora", !dentro);
      }
      const distEl = this.#q("[data-ten-dist]");
      if ( distEl ) distEl.textContent = j.dist.toFixed(1);
      const trilhaEl = this.#q("[data-ten-runner]");
      if ( trilhaEl ) trilhaEl.style.left = `${(1 - j.dist / 27) * 92}%`;
      const surtoEl = this.#q("[data-ten-surtos]");
      if ( surtoEl ) surtoEl.textContent = j.surtos;

      if ( j.dist <= 0 ) {
        // régua calibrada nos testes da mesa: só os vazamentos contam
        const pn = j.surtos <= 10 ? 4 : j.surtos <= 15 ? 2 : 0;
        this.#terminar({ dominio: true, pn, detalhe: `27m em ${Math.round(j.t)}s, ${j.surtos} vazamento(s)` });
      } else if ( j.t >= 120 ) {
        this.#terminar({ dominio: false, pn: 0, detalhe: `parou a ${j.dist.toFixed(1)}m do PdN` });
      }
    }, 50);
  }

  /* ---------- ZETSU: avance só de olho fechado ---------- */

  #jogarZetsu() {
    const j = this.#jogo = {
      rodada: 1, barra: 0, flagras: 0, limpas: 0, completas: 0,
      olho: "fechado", proximo: 2.2, t: 0, segurando: false, flagrouNesteOlhar: false
    };
    const SEGURA = ["Space", "Enter", "NumpadEnter"];
    this.#teclas(
      ev => { if ( SEGURA.includes(ev.code) ) { ev.preventDefault(); ev.stopImmediatePropagation(); j.segurando = true; } },
      ev => { if ( SEGURA.includes(ev.code) ) { ev.preventDefault(); ev.stopImmediatePropagation(); j.segurando = false; } }
    );
    this.#ponteiro(() => { j.segurando = true; }, () => { j.segurando = false; });
    const proximaRodada = () => {
      if ( j.barra >= 100 ) {
        j.completas++;
        if ( j.flagras === 0 ) j.limpas++;
      }
      if ( j.rodada >= 3 ) {
        const pn = j.limpas >= 3 ? 4 : j.limpas >= 2 ? 2 : 0;
        return this.#terminar({
          dominio: j.completas >= 1, pn,
          detalhe: `${j.completas}/3 rodadas completas, ${j.limpas} limpa(s)`
        });
      }
      j.rodada++;
      j.barra = 0; j.flagras = 0; j.t = 0;
      j.olho = "fechado"; j.proximo = 2 + Math.random() * 1.5;
      const rodadaEl = this.#q("[data-zt-rodada]");
      if ( rodadaEl ) rodadaEl.textContent = j.rodada;
      const flagEl = this.#q("[data-zt-flagras]");
      if ( flagEl ) flagEl.textContent = "0";   // o HUD acompanha o zerar da rodada
    };

    this.#intervalo(() => {
      j.t += 0.05;
      j.proximo -= 0.05;
      // o olho alterna: fechado (seguro) → abrindo (aviso) → ABERTO (perigo)
      if ( j.proximo <= 0 ) {
        // o aviso 😑→👁️ encurta a cada rodada: 0,55s → 0,40s → 0,25s
        if ( j.olho === "fechado" ) { j.olho = "abrindo"; j.proximo = 0.55 - (j.rodada - 1) * 0.15; }
        else if ( j.olho === "abrindo" ) { j.olho = "aberto"; j.proximo = 0.9 + Math.random() * 1.2; j.flagrouNesteOlhar = false; }
        // e ele abre mais vezes: o descanso de olho fechado também encolhe por rodada
        else { j.olho = "fechado"; j.proximo = (1.6 + Math.random() * 2.1) * (1 - (j.rodada - 1) * 0.15); }
      }
      if ( j.segurando ) {
        if ( j.olho === "aberto" ) {
          // ele te VÊ: recuo contínuo + o susto do flagra custa terreno de uma vez
          j.barra = Math.max(0, j.barra - 1.3);
          if ( !j.flagrouNesteOlhar ) {
            j.flagras++;
            j.flagrouNesteOlhar = true;
            j.barra = Math.max(0, j.barra - 18);
            const cena = this.#q("[data-zt-cena]");
            if ( cena ) {
              cena.classList.add("is-flagra");
              this.#agendar(() => cena.classList.remove("is-flagra"), 450);
            }
            const flagEl = this.#q("[data-zt-flagras]");
            if ( flagEl ) flagEl.textContent = j.flagras;
          }
        } else {
          // fechado E franzindo enchem a barra — o franzido é a janela da ganância
          j.barra = Math.min(100, j.barra + 0.62);
        }
      }
      const olhoEl = this.#q("[data-zt-olho]");
      if ( olhoEl ) {
        olhoEl.textContent = j.olho === "aberto" ? "👁️" : j.olho === "abrindo" ? "😑" : "😌";
        olhoEl.className = `hj-zt__olho is-${j.olho}`;
      }
      const barraEl = this.#q("[data-zt-barra]");
      if ( barraEl ) barraEl.style.width = `${j.barra}%`;

      if ( j.barra >= 100 || j.t >= 22 ) proximaRodada();
    }, 50);
  }

  /* ---------- REN: o reflexo das setas ---------- */

  #jogarRen() {
    const SETAS = [
      { teclas: ["ArrowUp", "KeyW"], char: "▲" },
      { teclas: ["ArrowDown", "KeyS"], char: "▼" },
      { teclas: ["ArrowLeft", "KeyA"], char: "◀" },
      { teclas: ["ArrowRight", "KeyD"], char: "▶" }
    ];
    const j = this.#jogo = {
      bloco: 1, chama: 62, soma: 0, amostras: 0, blocos: [], t: 0,
      seta: null, setaT: 0, janelaDaSeta: 0, gap: 0.6, certas: 0
    };
    // 1,0s → 0,9s → 0,8s por bloco — e encolhendo também DENTRO do bloco:
    // manter o Ren fica sempre mais difícil com o passar do tempo
    const janela = () => Math.max(0.45, (1.1 - j.bloco * 0.1) - j.t * 0.015);
    const limpaSeta = classe => {
      const el = this.#q("[data-rn-seta]");
      if ( el ) {
        el.textContent = "·";
        el.className = "hj-rn__seta is-vazia" + (classe ? ` ${classe}` : "");
      }
      const tempoEl = this.#q("[data-rn-tempo]");
      if ( tempoEl ) tempoEl.style.width = "0%";
    };
    const novaSeta = () => {
      j.seta = Math.floor(Math.random() * 4);
      j.janelaDaSeta = janela();   // congela a janela DESTA seta (a barrinha mede contra ela)
      j.setaT = j.janelaDaSeta;
      const el = this.#q("[data-rn-seta]");
      if ( el ) { el.textContent = SETAS[j.seta].char; el.className = "hj-rn__seta"; }
    };
    this.#teclas(ev => {
      const i = SETAS.findIndex(s => s.teclas.includes(ev.code));
      if ( i < 0 ) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();   // seta é do jogo — não move token nem dá pan
      if ( ev.repeat || j.seta == null ) return;   // sem seta acesa, apertar não faz nada
      if ( i === j.seta ) {
        j.chama = Math.min(100, j.chama + 11);
        j.certas++;
        limpaSeta("is-acerto");
        const cEl = this.#q("[data-rn-certas]");
        if ( cEl ) cEl.textContent = j.certas;
      } else {
        j.chama = Math.max(0, j.chama - 8);
        limpaSeta("is-erro");
      }
      j.seta = null;
      // o respiro entre setas também encolhe com bloco e tempo — elas vêm cada vez mais rápido
      j.gap = Math.max(0.12, 0.3 + Math.random() * 0.3 - (j.bloco - 1) * 0.06 - j.t * 0.006);
    });
    this.#intervalo(() => {
      j.t += 0.1;
      // a chama definha sozinha — só o reflexo alimenta
      j.chama = Math.max(0, j.chama - (0.5 + j.bloco * 0.15));
      j.soma += j.chama; j.amostras++;

      if ( j.seta != null ) {
        j.setaT -= 0.1;
        const tempoEl = this.#q("[data-rn-tempo]");
        if ( tempoEl ) tempoEl.style.width = `${Math.max(0, j.setaT / (j.janelaDaSeta || 1)) * 100}%`;
        if ( j.setaT <= 0 ) {   // a seta sumiu sem resposta
          j.chama = Math.max(0, j.chama - 8);
          limpaSeta("is-erro");
          j.seta = null;
          j.gap = Math.max(0.15, 0.4 - (j.bloco - 1) * 0.08);
        }
      } else {
        j.gap -= 0.1;
        if ( j.gap <= 0 ) novaSeta();
      }

      const chamaEl = this.#q("[data-rn-chama]");
      if ( chamaEl ) {
        chamaEl.style.height = `${j.chama}%`;
        chamaEl.classList.toggle("is-alta", j.chama >= 70);
        chamaEl.classList.toggle("is-baixa", j.chama < 40);
      }
      const blocoEl = this.#q("[data-rn-bloco]");
      if ( blocoEl ) blocoEl.textContent = j.bloco;
      const tEl = this.#q("[data-rn-t]");
      if ( tEl ) tEl.textContent = Math.max(0, Math.ceil(12 - j.t)).toString();

      if ( j.t >= 12 ) {
        const media = j.soma / Math.max(1, j.amostras);
        j.blocos.push(media >= 68 ? "alta" : media >= 40 ? "media" : "baixa");
        if ( j.bloco >= 3 ) {
          const altas = j.blocos.filter(b => b === "alta").length;
          const medias = j.blocos.filter(b => b === "media").length;
          const pn = (altas >= 2 && altas + medias >= 3) ? 4 : (altas >= 1 && altas + medias >= 2) ? 2 : 0;
          return this.#terminar({
            dominio: true, pn,
            detalhe: `blocos: ${j.blocos.join(" · ")} (${j.certas} setas)`
          });
        }
        j.bloco++; j.t = 0; j.soma = 0; j.amostras = 0;
        j.seta = null; j.gap = 0.7;
        limpaSeta();
      }
    }, 100);
  }

  /* ---------- HATSU: reaja ao número da água ---------- */

  #jogarHatsu() {
    const j = this.#jogo = {
      numero: this._numero ?? 1,
      atual: null, consumido: false,
      aparicoes: 0, acertos: 0, erros: 0,
      mostraMs: 950, gapBase: 320
    };
    const numEl = () => this.#q("[data-ht-num]");

    const esconder = () => {
      if ( this._resultado || !this.rendered ) return;
      j.atual = null;
      const el = numEl();
      if ( el ) {
        el.textContent = "·";
        el.className = "hj-ht__num";
        el.style.removeProperty("--corn");
      }
      if ( j.aparicoes >= 10 ) {
        const pn = j.acertos >= 4 ? 4 : j.acertos >= 2 ? 2 : 0;
        return this.#terminar({ dominio: true, pn, detalhe: `${j.acertos}/10 aparições do nº ${j.numero}` });
      }
      this.#agendar(mostrar, j.gapBase + Math.random() * 240);
    };

    const mostrar = () => {
      if ( this._resultado || !this.rendered ) return;
      // fora de ordem: sorteio puxado pro SEU número (senão a espera vira eternidade)
      j.atual = Math.random() < 0.38 ? j.numero : 1 + Math.floor(Math.random() * 6);
      j.consumido = false;
      if ( j.atual === j.numero ) {
        j.aparicoes++;
        const apEl = this.#q("[data-ht-aparicoes]");
        if ( apEl ) apEl.textContent = j.aparicoes;
      }
      const el = numEl();
      if ( el ) {
        const info = CATEGORIA_INFO[CATEGORIAS[j.atual - 1]];
        el.textContent = j.atual;
        el.className = "hj-ht__num is-mostra";
        el.style.setProperty("--corn", info.cor);
      }
      this.#agendar(esconder, j.mostraMs);
    };

    const reagir = () => {
      if ( j.atual == null || j.consumido || this._resultado ) return;
      j.consumido = true;
      // TODA tentativa acelera a água — acertando ou errando, os números passam
      // a trocar mais rápido (menos tempo aceso, menos respiro entre eles)
      j.mostraMs = Math.max(480, j.mostraMs - 35);
      j.gapBase = Math.max(170, j.gapBase - 12);
      const el = numEl();
      if ( j.atual === j.numero ) {
        j.acertos++;
        if ( el ) el.classList.add("is-acerto");
        const acEl = this.#q("[data-ht-acertos]");
        if ( acEl ) acEl.textContent = j.acertos;
        this.#copoReage(j);
      } else {
        // número errado: a água estranha — apaga um acerto (senão clicar em tudo sairia de graça)
        j.erros++;
        j.acertos = Math.max(0, j.acertos - 1);
        if ( el ) el.classList.add("is-erro");
        const acEl = this.#q("[data-ht-acertos]");
        if ( acEl ) acEl.textContent = j.acertos;
      }
    };

    this.#teclas(ev => {
      if ( ["Space", "Enter", "NumpadEnter"].includes(ev.code) ) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        reagir();
      }
    });
    this.#ponteiro(() => reagir());
    this.#agendar(mostrar, 700);
  }

  /**
   * A água sintoniza com a categoria: a cada acerto o efeito do copo cresce.
   * 1 Aprimorador transborda · 2 Emissor muda de cor · 3 Transmutador engrossa ·
   * 4 Conjurador cria impurezas · 5 Manipulador agita a folha · 6 Especialista queima a folha.
   */
  #copoReage(j) {
    const f = j.acertos;                       // força 1..10
    const cat = CATEGORIAS[j.numero - 1];
    const copo = this.#q("[data-ht-copo]");
    if ( !copo ) return;
    const liquido = this.#q("[data-ht-liquido]");
    const folha = this.#q("[data-ht-folha]");
    const fogo = this.#q("[data-ht-fogo]");

    if ( cat === "aprimorador" ) {
      if ( liquido ) liquido.style.height = `${Math.min(100, 86 + f * 1.5)}%`;
      copo.classList.add("is-transb");
      for ( const g of copo.querySelectorAll(".hj-ht__gota") ) {
        g.style.animationDuration = `${Math.max(0.45, 1.4 - f * 0.09)}s`;
      }
    }
    else if ( cat === "emissor" ) {
      if ( liquido ) liquido.style.filter = `hue-rotate(${f * 30}deg) saturate(${1 + f * 0.09})`;
    }
    else if ( cat === "transmutador" ) {
      copo.classList.add("is-viscosa");
      if ( liquido ) liquido.style.filter = `saturate(${1 + f * 0.05}) brightness(${1 - f * 0.025}) contrast(${1 + f * 0.05})`;
      for ( const b of copo.querySelectorAll(".hj-ht__bolha") ) {
        b.style.animationDuration = `${2 + f * 0.3}s`;   // quanto mais grossa, mais devagar a bolha sobe
      }
    }
    else if ( cat === "conjurador" ) {
      const ninho = this.#q("[data-ht-impurezas]");
      if ( ninho ) {
        const POS = [[28, 40], [58, 58], [40, 72], [66, 34], [22, 62], [50, 48], [34, 56], [62, 70], [46, 30], [30, 78]];
        const [x, y] = POS[(f - 1) % POS.length];
        const s = document.createElement("span");
        s.className = "hj-ht__impureza";
        s.style.left = `${x}%`;
        s.style.top = `${y}%`;
        ninho.appendChild(s);
      }
    }
    else if ( cat === "manipulador" ) {
      if ( folha ) {
        folha.classList.add("is-nav");
        folha.style.animationDuration = `${Math.max(0.55, 2.6 - f * 0.21)}s`;
      }
    }
    else if ( cat === "especialista" ) {
      if ( fogo ) {
        fogo.style.opacity = `${Math.min(1, 0.15 + f * 0.12)}`;
        fogo.style.transform = `scale(${1 + f * 0.09})`;
      }
      if ( folha ) folha.style.filter = `sepia(${f * 10}%) hue-rotate(-${f * 5}deg) brightness(${1 + f * 0.03})`;
    }
  }
}

/* -------------------------------------------- */
/*  Socket + botão de cena                       */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  game.socket.on("system.hunter-system", data => {
    if ( data?.action === "nenTreinoConvite" ) NenTreinoApp.receberConvite(data);
    else if ( data?.action === "nenTreinoResultado" ) NenTreinoApp.receberResultado(data);
  });
});

// Entra no grupo "GM Tools" (criado pelo session-log; hooks rodam na ordem do barrel).
Hooks.on("getSceneControlButtons", controls => {
  if ( !game.user?.isGM ) return;
  const grupo = controls.gmTools ?? controls.notes;
  if ( !grupo?.tools ) return;
  grupo.tools.nenTreino = {
    name: "nenTreino",
    order: 5,
    title: "Treino de Nen (despertar)",
    icon: "fa-solid fa-hand-sparkles",
    button: true,
    visible: game.user.isGM,
    onChange: () => { if ( game.user.isGM ) NenTreinoApp.abrir(); }
  };
});
