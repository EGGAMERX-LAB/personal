'use strict';
/* Personal Trainer — desenvolvido por EG Gamer X
   Versão de teste: tudo fica salvo só no aparelho (localStorage). Sem servidor e sem login. */

const VERSAO_APP = '0.3 (teste)';
const NOME_APP = 'Personal Trainer';
const CHAVE = 'personal_trainer_v1';
// Licença: o app funciona HORAS_TESTE horas e depois pede um código de liberação, que só a EG Gamer X gera
// (pasta Licencas, fora do app). Aqui fica só a chave pública, que confere o código mas não cria códigos.
const APP_ID = 'personal-trainer';
const HORAS_TESTE = 1;   // 1 hora só para testar o bloqueio; para 7 dias de teste, trocar por 7 * 24
const CHAVE_LICENCA = 'personal_trainer_licenca';
const CHAVE_PUBLICA = '0403c7e165fefce8bdea16943b6f11f9da0be4f73629b258390f94969557b4abb18a2825dc3d5f4c7e8296c243f87924a9393ee3904facebe7ca1011803355df7b';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = MESES.map(m => m.slice(0, 3));
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const NIVEIS_FICHA = ['Iniciante', 'Intermediário', 'Avançado'];
const DIFICULDADES = { '': '—', facil: 'Fácil', moderado: 'Moderado', dificil: 'Difícil' };
const COR_DIFICULDADE = { facil: 'bom', moderado: 'medio', dificil: 'ruim' };
const TIPOS_OBS = ['Lesão', 'Fratura', 'Cirurgia', 'Em recuperação', 'Restrição médica', 'Dor', 'Outro'];
const TIPOS_REGISTRO = { melhora: 'Melhorou', parado: 'Não evoluiu', observacao: 'Observação' };
const COR_REGISTRO = { melhora: 'bom', parado: 'ruim', observacao: 'neutro' };
const TIPOS_CHAVE = { cpf: 'CPF ou CNPJ', celular: 'Celular', email: 'E-mail', aleatoria: 'Chave aleatória' };
const PLANOS = { '': 'Sem plano', mensal: 'Mensal', quinzenal: 'Quinzenal', semanal: 'Semanal' };
const STATUS_ALUNO = { ativo: 'Ativo', inativo: 'Inativo', cancelado: 'Cancelado' };
const FORMAS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro'];
const CATEGORIAS = ['Aluguel de espaço', 'Transporte', 'Equipamentos', 'Cursos', 'Divulgação', 'Impostos e taxas', 'Outros'];
const SERVICOS_PADRAO = ['Personal presencial', 'Consultoria online', 'Aula em dupla', 'Aula avulsa'];
const TIPOS_PERIODO = { semana: 'Semanal', mes: 'Mensal', ano: 'Anual' };
const DIAS_PARADO = 28;   // sem aumento de carga há mais que isso = "não está evoluindo"
const DIAS_PERTO = 3;     // cobrança que vence em até 3 dias = "próxima do vencimento"
const MSG_PADRAO = 'Olá, {nome}! Segue a cobrança: {referencia}, no valor de {valor}, com vencimento em {vencimento}.';

const IC = {
  haltere: '<svg viewBox="0 0 24 24"><path d="M6.5 6v12M3.5 9v6M17.5 6v12M20.5 9v6M6.5 12h11"/></svg>',
  aluno: '<svg viewBox="0 0 24 24"><circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.6 3-6 7-6 1.3 0 2.5.3 3.5.7M18 14v6M15 17h6"/></svg>',
  receber: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>',
  despesa: '<svg viewBox="0 0 24 24"><path d="M12 21V9M7 14l5-5 5 5M4 4h16"/></svg>',
  grafico: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
};

/* ---------- Dados ---------- */

function bancoVazio() {
  return {
    versao: 2, exemplo: false,
    config: {
      personal: '', pixTipo: 'cpf', pixChave: '', pixNome: '', pixCidade: '',
      mensagem: MSG_PADRAO, servicos: [...SERVICOS_PADRAO], senha: '', ultimaForma: 'Pix', ultimoBackup: null,
      marcaNome: '', marcaLogo: '',   // nome e logo do personal no topo (a EG Gamer X continua em "Mais")
    },
    alunos: [], fichas: [], obs: [], cargas: [], registros: [], recados: {},
    cobrancas: [], despesas: [],
  };
}

function normalizar(d) {
  const base = bancoVazio();
  for (const k in base) if (d[k] === undefined) d[k] = base[k];
  for (const k in base.config) if (d.config[k] === undefined) d.config[k] = base.config[k];
  // Dados gravados pela versão 0.1: "ativo" virou status e cada cobrança passou a guardar os pagamentos.
  d.alunos.forEach(a => {
    a.status ??= a.ativo === false ? 'inativo' : 'ativo';
    a.servico ??= '';
    delete a.ativo;
  });
  d.cobrancas.forEach(c => {
    c.pagamentos ??= c.status === 'pago' ? [{ id: novoId(), data: c.pagoEm || c.venc, valor: c.valor, forma: 'Pix', obs: '' }] : [];
    c.cancelada ??= c.status === 'cancelada';
    c.desconto ??= 0;
    c.avisadoEm ??= null;
    delete c.status;
    delete c.pagoEm;
  });
  d.versao = 2;
  return d;
}

function carregar() {
  try {
    const t = localStorage.getItem(CHAVE);
    if (t) return normalizar(JSON.parse(t));
  } catch (e) { console.error(e); }
  return bancoVazio();
}

let db = carregar();

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(db)); }
  catch (e) { toast('Erro ao salvar: ' + e.message); }
}

const aluno = id => db.alunos.find(a => a.id === id);
const fichasDe = id => db.fichas.filter(f => f.alunoId === id);
const obsAtivas = id => db.obs.filter(o => o.alunoId === id && o.ativa);
const cobrancasValidas = () => db.cobrancas.filter(c => !c.cancelada && aluno(c.alunoId));
const cobrancasDe = id => db.cobrancas.filter(c => c.alunoId === id && !c.cancelada);

/* ---------- Utilidades ---------- */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dataDe(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); }
function hoje() { return isoLocal(new Date()); }
function somaDias(iso, n) { const d = dataDe(iso); d.setDate(d.getDate() + n); return isoLocal(d); }
function somaMes(anoMes, n) { const [a, m] = anoMes.split('-').map(Number); return isoLocal(new Date(a, m - 1 + n, 1)).slice(0, 7); }
function ultimoDia(anoMes) { const [a, m] = anoMes.split('-').map(Number); return isoLocal(new Date(a, m, 0)); }
function diasDesde(iso) { return Math.round((dataDe(hoje()) - dataDe(iso)) / 864e5); }
function segundaDe(iso) { return somaDias(iso, -((dataDe(iso).getDay() + 6) % 7)); }
function fmtData(iso) { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; }
function fmtDataCurta(iso) { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}`; }
function fmtMes(anoMes) { const [a, m] = anoMes.split('-').map(Number); return `${MESES[m - 1]} de ${a}`; }
function fmtBRL(n) { return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtCurto(n) { return n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(Math.round(n)); }
function fmtKg(n) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kg'; }
function emReais(n) { return n ? n.toFixed(2).replace('.', ',') : ''; }
function arred(n) { return Math.round(n * 100) / 100; }
// Aceita "150", "150,50", "1.200,00" e "150.5".
function lerNumero(s) {
  s = String(s ?? '').trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function porNome(a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }
function iniciais(nome) {
  const p = nome.trim().split(/\s+/).filter(w => /^\p{L}/u.test(w));
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function plural(n, um, varios) { return `${n} ${n === 1 ? um : varios}`; }
function soma(lista, fn = x => x.valor) { return arred(lista.reduce((s, x) => s + fn(x), 0)); }
function semAcento(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, ''); }
function linhas(texto) { return texto.split('\n').map(s => s.trim()).filter(Boolean); }

/* ---------- Licença de uso (período de teste + código de liberação) ---------- */

// Fica guardada separada dos dados: restaurar backup ou apagar os dados não reinicia o período de teste.
function carregarLicenca() {
  let l = null;
  try { l = JSON.parse(localStorage.getItem(CHAVE_LICENCA)); } catch (e) { console.error(e); }
  // "ate" e "visto" são momentos exatos (milissegundos), para o teste poder ser contado em horas.
  if (!l?.id || typeof l.ate !== 'number') {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const s = [...crypto.getRandomValues(new Uint8Array(8))].map(b => letras[b % 32]).join('');
    l = { id: `${s.slice(0, 4)}-${s.slice(4)}`, ate: Date.now() + HORAS_TESTE * 36e5, visto: Date.now(), liberado: false };
    localStorage.setItem(CHAVE_LICENCA, JSON.stringify(l));
  }
  return l;
}
let licenca = carregarLicenca();
function salvarLicenca() { localStorage.setItem(CHAVE_LICENCA, JSON.stringify(licenca)); }

// 'ok', 'vencida' ou 'relogio' (o relógio do celular foi voltado para ganhar mais tempo; tolera 10 minutos).
function situacaoLicenca() {
  const agora = Date.now();
  if (agora < licenca.visto - 6e5) return 'relogio';
  if (agora > licenca.visto) { licenca.visto = agora; salvarLicenca(); }
  return agora > licenca.ate ? 'vencida' : 'ok';
}
function fmtMomento(ms) {
  const d = new Date(ms);
  return `${fmtData(isoLocal(d))} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
// O código libera até o fim do dia que vem nele; o teste acaba na hora exata.
function fimDaLicenca() { return licenca.liberado ? fmtData(isoLocal(new Date(licenca.ate - 1))) : fmtMomento(licenca.ate); }
function tempoDeLicenca() {
  const min = Math.max(0, Math.ceil((licenca.ate - Date.now()) / 6e4));
  if (min < 60) return plural(min, 'minuto', 'minutos');
  if (min < 1440) return plural(Math.ceil(min / 60), 'hora', 'horas');
  return plural(Math.ceil(min / 1440), 'dia', 'dias');
}

// Confere a assinatura do código. Ele vale só para este app, este aparelho e a data que vem dentro dele.
async function aplicarCodigo(texto) {
  const m = texto.replace(/\s+/g, '').match(/^(\d\d)(\d\d)(\d\d)([\w-]{86})$/);
  if (!m) return 'Código incompleto. Copie e cole o código inteiro.';
  const ate = `20${m[1]}-${m[2]}-${m[3]}`;
  const bytes = bin => Uint8Array.from(bin, c => c.charCodeAt(0));
  try {
    const assinatura = bytes(atob(m[4].replace(/-/g, '+').replace(/_/g, '/')));
    const publica = Uint8Array.from(CHAVE_PUBLICA.match(/../g), h => parseInt(h, 16));
    const chave = await crypto.subtle.importKey('raw', publica, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, chave, assinatura,
      new TextEncoder().encode(`${APP_ID}|${licenca.id}|${ate}`));
    if (!ok) return 'Código inválido para este aparelho.';
  } catch (e) {
    console.error(e);
    return 'Não foi possível conferir o código neste aparelho.';
  }
  const fim = dataDe(somaDias(ate, 1)).getTime();
  if (fim < Date.now()) return `Este código venceu em ${fmtData(ate)}. Peça um novo.`;
  licenca.ate = licenca.liberado ? Math.max(licenca.ate, fim) : fim;
  licenca.liberado = true;
  salvarLicenca();
  return '';
}

function caixaCodigo() {
  return `<p>Código deste aparelho: <b class="cod-aparelho">${licenca.id}</b></p>
    <button class="btn largo" data-lic="copiar">Copiar código do aparelho</button>
    <label class="campo"><span>Código de liberação</span><textarea class="codigo-pix" rows="3" data-lic="texto"
      autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Cole aqui o código que você recebeu"></textarea></label>
    <button class="btn primario largo" data-lic="liberar">Liberar</button>`;
}
function ligarCaixaCodigo(raiz) {
  $('[data-lic=copiar]', raiz).onclick = () => copiar(licenca.id, 'Código do aparelho copiado');
  $('[data-lic=liberar]', raiz).onclick = async () => {
    const erro = await aplicarCodigo($('[data-lic=texto]', raiz).value);
    toast(erro || `App liberado até ${fimDaLicenca()}`);
    if (!erro) rotear();
  };
}

// Tela que cobre o app quando o período acabou. Os dados continuam guardados e dá para exportar o backup.
function conferirLicenca() {
  const s = situacaoLicenca();
  $('#bloqueio')?.remove();
  if (s === 'ok') return;
  const t = document.createElement('div');
  t.id = 'bloqueio';
  t.innerHTML = `<div><img class="logo-sobre" src="logo.webp" alt="">
    <h2>${s === 'relogio' ? 'Data do celular errada' : licenca.liberado ? 'Sua licença venceu' : 'Período de teste encerrado'}</h2>
    <p>${s === 'relogio' ? `O relógio do celular está antes de ${fmtMomento(licenca.visto)}. Acerte a data e a hora para continuar.`
      : `O acesso ao ${NOME_APP} terminou em ${fimDaLicenca()}. Seus dados continuam guardados neste aparelho.
         Para continuar, peça um código de liberação à EG Gamer X informando o código do aparelho.`}</p>
    ${s === 'relogio' ? '' : caixaCodigo()}
    <button class="btn largo" id="bloq-backup">Exportar backup dos meus dados</button></div>`;
  document.body.appendChild(t);
  if (s !== 'relogio') ligarCaixaCodigo(t);
  $('#bloq-backup').onclick = () => exportarBackup();
}

/* ---------- Contas: cobranças, pagamentos, períodos ---------- */

// Uma cobrança guarda os pagamentos dela, então o mesmo dinheiro nunca entra duas vezes nos totais.
const devido = c => Math.max(0, arred(c.valor - (c.desconto || 0)));
const pagoDe = c => soma(c.pagamentos);
const falta = c => Math.max(0, arred(devido(c) - pagoDe(c)));
const quitada = c => falta(c) < 0.005;
function situacao(c) {
  if (quitada(c)) return 'pago';
  if (c.venc < hoje()) return 'atrasado';
  return pagoDe(c) > 0 ? 'parcial' : 'pendente';
}
function emAtraso(a) { return cobrancasDe(a.id).some(c => situacao(c) === 'atrasado'); }
// Todos os pagamentos registrados, cada um com a cobrança de onde veio.
function pagamentos() { return cobrancasValidas().flatMap(c => c.pagamentos.map(p => ({ ...p, cob: c }))); }

function periodo(tipo, ref) {
  if (tipo === 'semana') { const ini = segundaDe(ref); return { tipo, ini, fim: somaDias(ini, 6) }; }
  if (tipo === 'ano') return { tipo, ini: ref.slice(0, 4) + '-01-01', fim: ref.slice(0, 4) + '-12-31' };
  return { tipo: 'mes', ini: ref.slice(0, 7) + '-01', fim: ultimoDia(ref.slice(0, 7)) };
}
function moverPeriodo(p, n) {
  if (p.tipo === 'semana') return periodo('semana', somaDias(p.ini, 7 * n));
  if (p.tipo === 'ano') return periodo('ano', `${+p.ini.slice(0, 4) + n}-01-01`);
  return periodo('mes', somaMes(p.ini.slice(0, 7), n) + '-01');
}
function nomePeriodo(p) {
  if (p.tipo === 'semana') return `semana de ${fmtDataCurta(p.ini)} a ${fmtData(p.fim)}`;
  if (p.tipo === 'ano') return p.ini.slice(0, 4);
  return fmtMes(p.ini.slice(0, 7));
}
const entre = (data, p) => data >= p.ini && data <= p.fim;

// Números de um período. Recebido e despesas usam a data real em que o dinheiro entrou ou saiu;
// previsto, pendente e atrasado usam o vencimento das cobranças.
function resumo(p) {
  const h = hoje();
  const pags = pagamentos().filter(x => entre(x.data, p));
  const cobs = cobrancasValidas().filter(c => entre(c.venc, p));
  const desp = db.despesas.filter(d => entre(d.data, p));
  const recebido = soma(pags), despesas = soma(desp);
  return {
    pags, cobs, desp, recebido, despesas, liquido: arred(recebido - despesas),
    previsto: soma(cobs, devido),
    pendente: soma(cobs.filter(c => c.venc >= h), falta),
    atrasado: soma(cobs.filter(c => c.venc < h), falta),
  };
}
function recebidoEm(p) { return soma(pagamentos().filter(x => entre(x.data, p))); }

function variacao(atual, anterior, oQue) {
  if (!anterior) return `<span class="sub">Nada recebido n${oQue} para comparar.</span>`;
  const pct = Math.round((atual - anterior) / anterior * 100);
  return `<span class="${pct >= 0 ? 'sobe' : 'desce'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%</span> em relação a${oQue} (${fmtBRL(anterior)})`;
}

function grafico(itens) {
  const max = Math.max(1, ...itens.map(i => i.valor));
  return `<div class="grafico">${itens.map(i => `<div class="col ${i.atual ? 'atual' : ''}">
    <span class="gv">${i.valor ? fmtCurto(i.valor) : ''}</span>
    <div class="gb"><div class="barra" style="height:${Math.round(i.valor / max * 100)}%"></div></div>
    <span class="gr">${esc(i.rotulo)}</span></div>`).join('')}</div>`;
}
// Barras do recebido: 7 dias (semana), 12 meses (ano) ou os 6 meses até o mês escolhido.
function graficoRecebido(p) {
  if (p.tipo === 'semana') {
    return grafico([0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = somaDias(p.ini, i);
      return { rotulo: SEMANA[dataDe(d).getDay()].slice(0, 3), valor: recebidoEm({ ini: d, fim: d }), atual: d === hoje() };
    }));
  }
  const fimMes = p.tipo === 'ano' ? p.ini.slice(0, 4) + '-12' : p.ini.slice(0, 7);
  const n = p.tipo === 'ano' ? 12 : 6;
  return grafico(Array.from({ length: n }, (_, i) => {
    const m = somaMes(fimMes, i - n + 1);
    return { rotulo: MESES_CURTOS[+m.slice(5) - 1], valor: recebidoEm(periodo('mes', m + '-01')), atual: p.tipo === 'ano' ? m === hoje().slice(0, 7) : i === n - 1 };
  }));
}

/* ---------- Pix (copia e cola + QR Code) ---------- */

function chavePix() {
  const c = db.config, k = c.pixChave.trim();
  if (c.pixTipo === 'cpf') return k.replace(/\D/g, '');
  if (c.pixTipo === 'celular') { const n = k.replace(/\D/g, ''); return '+' + (n.length <= 11 ? '55' + n : n); }
  return k.toLowerCase();
}
function pixPronto() { const c = db.config; return !!(c.pixChave.trim() && c.pixNome.trim() && c.pixCidade.trim()); }
// Devolve o que parece errado na chave (ou '' se está tudo certo).
function problemaNaChave() {
  const c = db.config, k = c.pixChave.trim(), n = k.replace(/\D/g, '').length;
  if (!k) return '';
  if (c.pixTipo === 'cpf' && n !== 11 && n !== 14) return 'CPF tem 11 números e CNPJ tem 14.';
  if (c.pixTipo === 'celular' && (n < 10 || n > 13)) return 'Digite o celular com DDD, por exemplo (11) 91234-5678.';
  if (c.pixTipo === 'email' && !/^\S+@\S+\.\S+$/.test(k)) return 'O e-mail parece incompleto.';
  if (c.pixTipo === 'aleatoria' && k.length !== 36) return 'A chave aleatória tem 36 caracteres (letras, números e traços).';
  return '';
}
function crc16(s) {
  let crc = 0xFFFF;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
// Código "Pix copia e cola" (padrão BR Code do Banco Central) com a chave do personal e o valor.
function pixCopiaECola(valor) {
  const c = db.config;
  const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const s = tlv('00', '01')
    + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', chavePix()))
    + tlv('52', '0000') + tlv('53', '986') + tlv('54', valor.toFixed(2)) + tlv('58', 'BR')
    + tlv('59', semAcento(c.pixNome).trim().slice(0, 25))
    + tlv('60', semAcento(c.pixCidade).trim().slice(0, 15))
    + tlv('62', tlv('05', '***')) + '6304';
  return s + crc16(s);
}

/* ---------- WhatsApp, área de transferência e arquivos ---------- */

const NO_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Guarda os arquivos no aparelho para abrir sem internet.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Modo offline indisponível:', e));
}
// Pede ao navegador para não apagar os dados sozinho quando faltar espaço.
navigator.storage?.persist?.().catch(() => {});

function linkWhats(telefone, texto) {
  let n = String(telefone || '').replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
function botaoWhats(telefone, texto, rotulo) {
  return `<a class="btn whats largo nao-imprimir" target="_blank" rel="noopener" href="${esc(linkWhats(telefone, texto))}">${esc(rotulo)}</a>`;
}

function copiar(texto, aviso) {
  const ok = () => toast(aviso);
  const antigo = () => {
    const t = document.createElement('textarea');
    t.value = texto;
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); ok(); } catch { toast('Não foi possível copiar'); }
    t.remove();
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texto).then(ok, antigo); else antigo();
}

function salvarArquivo(nome, texto, mime, aoTerminar) {
  // iPhone/iPad: abre a folha "Compartilhar" (Salvar em Arquivos, WhatsApp, e-mail...).
  if (NO_IOS) {
    const arq = new File([texto], nome, { type: mime });
    if (navigator.canShare?.({ files: [arq] })) {
      navigator.share({ files: [arq], title: nome })
        .then(() => aoTerminar?.(true), () => aoTerminar?.(false));
      return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: mime }));
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  aoTerminar?.(true);
}

function abrirArquivo(aoLer) {
  const i = document.createElement('input');
  i.type = 'file';
  i.accept = '.json,application/json';
  i.onchange = () => {
    const f = i.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => aoLer(r.result);
    r.readAsText(f);
  };
  i.click();
}

/* ---------- Interface base ---------- */

let rotaPai = null;
let ultimoCaminho = null;
let seqModal = 0;
let timerToast = null;

/* ---------- Marca do personal (logo e nome no topo) ---------- */

const nomeMarca = () => db.config.marcaNome || NOME_APP;
const logoMarca = () => db.config.marcaLogo || 'logo.webp';
// Cabeçalho e rodapé dos relatórios: marca do personal em cima, EG Gamer X embaixo.
function cabecalhoMarca() {
  const c = db.config;
  return `${c.marcaLogo ? `<img class="rel-logo" src="${c.marcaLogo}" alt="">` : ''}
    ${c.marcaNome ? `<p><b>${esc(c.marcaNome)}</b></p>` : ''}`;
}
const RODAPE_RELATORIO = '<p class="rel-rodape">Feito no app Personal Trainer · desenvolvido por EG Gamer X</p>';

// Recorta a foto num quadrado pequeno para caber no topo e não pesar no backup.
function lerLogo(arquivo, aoLer) {
  const img = new Image();
  img.onload = () => {
    const lado = Math.min(img.width, img.height), canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    canvas.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
    URL.revokeObjectURL(img.src);
    aoLer(canvas.toDataURL('image/webp', 0.85));
  };
  img.onerror = () => toast('Não foi possível abrir esta imagem');
  img.src = URL.createObjectURL(arquivo);
}

function modalMarca() {
  const c = db.config;
  let logo = c.marcaLogo;
  const m = abrirModal('Sua marca', `<img class="logo-sobre" id="marca-previa" src="${logo || 'logo.webp'}" alt="">
    <button class="btn largo" id="marca-escolher">Escolher foto ou logo</button>
    ${logo ? '<button class="btn largo perigo-texto" id="marca-tirar">Tirar meu logo</button>' : ''}
    ${campo('Seu nome ou o nome da sua empresa', 'marcaNome', c.marcaNome, 'text', 'maxlength="24" placeholder="Ex.: João Personal" autocomplete="off"')}
    <p class="legenda">Aparece no topo do app e nos relatórios. Deixe vazio para usar "${NOME_APP}".</p>`, [
    { texto: 'Cancelar' },
    {
      texto: 'Salvar', classe: 'primario', acao: modal => {
        c.marcaNome = lerForm(modal).marcaNome;
        c.marcaLogo = logo;
        salvar();
        toast('Marca salva');
        rotear();
      },
    },
  ]);
  const trocar = novo => { logo = novo; $('#marca-previa', m).src = novo || 'logo.webp'; };
  $('#marca-escolher', m).onclick = () => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/*';
    i.onchange = () => { if (i.files[0]) lerLogo(i.files[0], trocar); };
    i.click();
  };
  $('#marca-tirar', m)?.addEventListener('click', () => trocar(''));
}

function render(titulo, html, { voltar = null, acao = '' } = {}) {
  rotaPai = voltar;
  $('#titulo').textContent = titulo;
  $('#btn-voltar').hidden = !voltar;
  $('#marca').hidden = !!voltar;
  $('#marca').src = logoMarca();
  $('#topo-acao').innerHTML = acao;
  $('#tela').innerHTML = html;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('mostrar');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove('mostrar'), 2600);
}

function vazio(html) { return `<div class="vazio">${html}</div>`; }

function campo(rotulo, nome, valor = '', tipo = 'text', extra = '') {
  return `<label class="campo"><span>${esc(rotulo)}</span><input type="${tipo}" name="${nome}" value="${esc(valor)}" ${extra}></label>`;
}
function campoTexto(rotulo, nome, valor = '', nLinhas = 3, extra = '') {
  return `<label class="campo"><span>${esc(rotulo)}</span><textarea name="${nome}" rows="${nLinhas}" ${extra}>${esc(valor)}</textarea></label>`;
}
function opcoes(lista, valor) {
  return lista.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(valor ?? '') ? 'selected' : ''}>${esc(t)}</option>`;
  }).join('');
}
function campoSelect(rotulo, nome, lista, valor = '') {
  return `<label class="campo"><span>${esc(rotulo)}</span><select name="${nome}">${opcoes(lista, valor)}</select></label>`;
}
function campoMarcar(rotulo, nome, marcado) {
  return `<label class="campo-marcar"><input type="checkbox" name="${nome}" ${marcado ? 'checked' : ''}>${esc(rotulo)}</label>`;
}
function campoValor(rotulo, nome, valor) {
  return campo(rotulo, nome, emReais(valor), 'text', 'inputmode="decimal" placeholder="0,00" autocomplete="off"');
}
function lerForm(el) {
  const o = {};
  $$('[name]', el).forEach(i => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
  return o;
}

function abrirModal(titulo, corpo, botoes = []) {
  const meu = ++seqModal;
  const raiz = $('#modal-raiz');
  raiz.innerHTML = `<div class="modal-fundo"><div class="modal" role="dialog" aria-modal="true">
    <h2>${esc(titulo)}</h2><div class="modal-corpo">${corpo}</div>
    <div class="modal-botoes">${botoes.map((b, i) =>
      `<button type="button" class="btn ${b.classe || ''}" data-i="${i}">${esc(b.texto)}</button>`).join('')}</div>
  </div></div>`;
  raiz.hidden = false;
  const modal = $('.modal', raiz);
  $$('.modal-botoes button', raiz).forEach(btn => btn.onclick = () => {
    const b = botoes[+btn.dataset.i];
    const r = b.acao ? b.acao(modal) : undefined;
    // Só fecha se a ação não pediu para manter e não abriu outro modal no lugar.
    if (r !== false && seqModal === meu) fecharModal();
  });
  $('.modal-fundo', raiz).onclick = e => { if (e.target.classList.contains('modal-fundo')) fecharModal(); };
  return modal;
}
function fecharModal() { const r = $('#modal-raiz'); r.hidden = true; r.innerHTML = ''; seqModal++; }
const modalAberto = () => !$('#modal-raiz').hidden;

function confirmar(msg, textoBotao, acao, perigo = true) {
  abrirModal('Confirmar', `<p>${esc(msg)}</p>`, [
    { texto: 'Cancelar' },
    { texto: textoBotao, classe: perigo ? 'perigo' : 'primario', acao },
  ]);
}

function ir(hash) { if (location.hash === hash) rotear(); else location.hash = hash; }

/* ---------- Navegação ---------- */

const ROTAS = [
  [/^\/$/, telaInicio],
  [/^\/alunos$/, telaAlunos],
  [/^\/aluno\/([^/]+)(?:\/(\w+))?$/, telaAluno],
  [/^\/ficha\/([^/]+)$/, telaFicha],
  [/^\/evolucao\/([^/]+)$/, telaRelatorioAluno],
  [/^\/financeiro$/, telaFinanceiro],
  [/^\/relatorios$/, telaRelatorios],
  [/^\/config$/, telaConfig],
];

function rotear() {
  if (modalAberto()) fecharModal();
  conferirLicenca();
  garantirCobrancas();
  const [caminho, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  for (const [re, fn] of ROTAS) {
    const m = caminho.match(re);
    if (!m) continue;
    fn(...m.slice(1), params);
    marcarMenu(caminho);
    if (caminho !== ultimoCaminho) window.scrollTo(0, 0);
    ultimoCaminho = caminho;
    return;
  }
  location.replace('#/');
}

// Monta o endereço da tela atual trocando só alguns filtros (valor vazio tira o filtro).
function comFiltro(caminho, params, mudancas) {
  const p = new URLSearchParams(params);
  for (const [k, v] of Object.entries(mudancas)) { if (v) p.set(k, v); else p.delete(k); }
  const qs = p.toString();
  return '#' + caminho + (qs ? '?' + qs : '');
}

function marcarMenu(caminho) {
  let sec = '/';
  if (/^\/(aluno|ficha|evolucao)/.test(caminho)) sec = '/alunos';
  else if (caminho !== '/') sec = caminho;
  $$('#menu a').forEach(a => a.classList.toggle('ativo', a.dataset.nav === sec));
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-ir]');
  if (!el || !el.dataset.ir) return;
  e.preventDefault();
  ir(el.dataset.ir);
});
document.addEventListener('change', e => { if (e.target.dataset.filtro) ir(e.target.value); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalAberto()) fecharModal(); });

/* ---------- Início (painel) ---------- */

// Android (Chrome): o navegador avisa quando o app pode ser instalado; guardamos o aviso para o botão "Instalar".
let pedidoInstalar = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  pedidoInstalar = e;
  if (ultimoCaminho === '/') rotear();
});

function avisoInstalar() {
  const instalado = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (instalado) return '';
  if (pedidoInstalar) {
    return `<div class="cartao instalar">
      <h3>Instale o app no seu celular</h3>
      <p class="sub">Fica com ícone na tela inicial, abre em tela cheia e funciona sem internet.</p>
      <button class="btn primario" id="btn-instalar">Instalar app</button>
    </div>`;
  }
  if (!NO_IOS) return '';
  const icCompartilhar = `<svg class="ic-ios" viewBox="0 0 24 24"><path d="M12 15V3M8 6.5 12 3l4 3.5M7 10H5.5v10.5h13V10H17"/></svg>`;
  return `<div class="cartao instalar">
    <h3>Instale o app no seu iPhone</h3>
    <ol>
      <li>Toque em <b>Compartilhar</b> ${icCompartilhar} na barra do Safari.</li>
      <li>Role o menu e toque em <b>Adicionar à Tela de Início</b>.</li>
      <li>Toque em <b>Adicionar</b>.</li>
    </ol>
    <p class="sub">Depois abra sempre pelo ícone do app. Cadastre os alunos só depois de instalar:
    o que for digitado aqui no Safari não aparece no app instalado.</p>
  </div>`;
}

function telaInicio() {
  const h = hoje(), c = db.config;
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = c.personal ? `, ${esc(c.personal.split(' ')[0])}` : '';
  let html = `<section class="boas-vindas">
    <p class="saudacao">${saudacao}${nome}!</p>
    <p class="data-hoje">${SEMANA[new Date().getDay()]}, ${fmtData(h)}</p>
  </section>${avisoInstalar()}`;
  if (licenca.ate - Date.now() <= 3 * 864e5) {
    html += `<div class="cartao destaque"><p><b>${licenca.liberado ? 'Sua licença' : 'Seu período de teste'} termina
      em ${tempoDeLicenca()}</b> (${fimDaLicenca()}). Peça o código de liberação para continuar usando.</p>
      <button class="btn" data-ir="#/config">Ver código do aparelho</button></div>`;
  }
  const ligarInstalar = () => $('#btn-instalar')?.addEventListener('click', () => {
    pedidoInstalar.prompt();
    pedidoInstalar = null;
    rotear();
  });

  if (!db.alunos.length) {
    html += `<div class="cartao destaque">
      <img class="logo-sobre" src="logo.webp" alt="Logo EG Gamer X">
      <h3>Bem-vindo(a) ao ${NOME_APP}</h3>
      <p>Comece cadastrando seu primeiro aluno. Tudo fica salvo só neste aparelho.</p>
      <div class="linha-botoes">
        <button class="btn primario" id="ini-aluno">Cadastrar primeiro aluno</button>
        <button class="btn" id="ini-exemplo">Ver com dados de exemplo</button>
      </div></div>`;
    render(nomeMarca(), html);
    $('#ini-aluno').onclick = () => modalAluno();
    $('#ini-exemplo').onclick = carregarExemplo;
    ligarInstalar();
    return;
  }

  if (db.exemplo) {
    html += `<div class="cartao destaque"><p><b>Você está vendo dados de exemplo.</b> Os alunos e valores são fictícios, só para demonstração.</p>
      <button class="btn" id="apagar-exemplo">Apagar exemplos e começar</button></div>`;
  }

  const mes = periodo('mes', h), r = resumo(mes);
  const ano = periodo('ano', h), anoAnt = moverPeriodo(ano, -1);
  const recAno = recebidoEm(ano), recAnoAnt = recebidoEm(anoAnt);
  const cobs = cobrancasValidas();
  const atrasadas = cobs.filter(x => situacao(x) === 'atrasado').sort(ordemCobranca);
  const ativos = db.alunos.filter(a => a.status === 'ativo').length;
  const comCobranca = new Set(r.cobs.map(x => x.alunoId)).size;

  html += `<div class="placar">${IC.haltere}
      <small>Recebido em ${MESES[+h.slice(5, 7) - 1]}</small>
      <b>${fmtBRL(r.recebido)}</b>
      <span>de ${fmtBRL(r.previsto)} previstos</span>
    </div>
    <p class="legenda">${variacao(r.recebido, recebidoEm(moverPeriodo(mes, -1)), 'o mês passado')}</p>
    <div class="indicadores">
      <div><b>${fmtBRL(recebidoEm({ ini: h, fim: h }))}</b><span>hoje</span></div>
      <div><b>${fmtBRL(recebidoEm(periodo('semana', h)))}</b><span>na semana</span></div>
      <div><b>${fmtBRL(recAno)}</b><span>no ano</span></div>
      <div><b class="${atrasadas.length ? 'ruim' : ''}">${fmtBRL(soma(atrasadas, falta))}</b><span>em atraso</span></div>
      <div><b>${fmtBRL(r.despesas)}</b><span>despesas</span></div>
      <div><b class="${r.liquido < 0 ? 'ruim' : 'bom'}">${fmtBRL(r.liquido)}</b><span>líquido</span></div>
      <div><b>${ativos}</b><span>alunos ativos</span></div>
      <div><b>${fmtBRL(comCobranca ? r.previsto / comCobranca : 0)}</b><span>ticket médio</span></div>
      <div><b>${fmtBRL(r.pendente)}</b><span>a vencer</span></div>
    </div>
    <div class="atalhos">
      <button class="atalho" id="at-aluno"><span class="ic">${IC.aluno}</span>Novo aluno</button>
      <a class="atalho" href="#/financeiro"><span class="ic">${IC.receber}</span>Receber</a>
      <button class="atalho" id="at-despesa"><span class="ic">${IC.despesa}</span>Despesa</button>
      <a class="atalho" href="#/relatorios"><span class="ic">${IC.grafico}</span>Relatórios</a>
    </div>`;

  if (!pixPronto()) {
    html += `<div class="cartao destaque" style="margin-top:16px">
      <p><b>Cadastre sua chave Pix</b> para gerar o QR Code e o Pix copia e cola das cobranças.</p>
      <button class="btn primario" data-ir="#/config">Cadastrar chave Pix</button></div>`;
  }
  if (!db.exemplo && (!c.ultimoBackup || somaDias(c.ultimoBackup, 7) < h)) {
    html += `<div class="cartao destaque" style="margin-top:16px">
      <p><b>Faça um backup.</b> Seus dados ficam só neste celular.
      ${c.ultimoBackup ? `Último backup em ${fmtData(c.ultimoBackup)}.` : 'Você ainda não fez nenhum backup.'}</p>
      <button class="btn primario" data-ir="#/config">Fazer backup agora</button></div>`;
  }

  if (atrasadas.length) {
    html += `<h3 class="secao ruim">Pagamentos atrasados</h3><div class="lista">${atrasadas.map(x => itemCobranca(x)).join('')}</div>`;
  }
  const limite = somaDias(h, 7);
  const proximas = cobs.filter(x => !quitada(x) && x.venc >= h && x.venc <= limite).sort(ordemCobranca);
  html += `<h3 class="secao">Vencem nos próximos 7 dias</h3>` + (proximas.length
    ? `<div class="lista">${proximas.map(x => itemCobranca(x)).join('')}</div>`
    : vazio('Nenhuma cobrança vencendo nos próximos dias.'));

  html += `<h3 class="secao">Faturamento dos últimos 6 meses</h3><div class="cartao">${graficoRecebido(mes)}
    <p class="legenda">${ano.ini.slice(0, 4)}: <b>${fmtBRL(recAno)}</b> · ${anoAnt.ini.slice(0, 4)}: <b>${fmtBRL(recAnoAnt)}</b></p></div>`;

  const comObs = db.alunos.filter(a => a.status === 'ativo' && obsAtivas(a.id).length).sort(porNome);
  if (comObs.length) {
    html += `<h3 class="secao">Alunos com observação especial</h3><div class="lista">${comObs.map(a =>
      `<a class="item" href="#/aluno/${a.id}/obs"><div><strong>${esc(a.nome)}</strong>
        <div class="sub">${obsAtivas(a.id).map(o => esc(o.tipo + (o.local ? ' – ' + o.local : ''))).join(' · ')}</div></div>
        <span class="seta">›</span></a>`).join('')}</div>`;
  }

  render(nomeMarca(), html);
  $('#at-aluno').onclick = () => modalAluno();
  $('#at-despesa').onclick = () => modalDespesa();
  $('#apagar-exemplo')?.addEventListener('click', () => confirmar('Apagar todos os dados de exemplo? Sua chave Pix e seus dados em "Mais" continuam.', 'Apagar exemplos', () => {
    const cfg = db.config;
    db = bancoVazio();
    db.config = cfg;
    salvar();
    ir('#/');
  }));
  ligarCobrancas($('#tela'));
  ligarInstalar();
}

/* ---------- Alunos ---------- */

function seloAluno(a) {
  if (a.status !== 'ativo') return `<span class="selo neutro">${STATUS_ALUNO[a.status]}</span>`;
  return emAtraso(a) ? '<span class="selo ruim">Em atraso</span>' : '';
}

function telaAlunos(params) {
  const st = params.get('st') || 'ativo';
  const FILTROS = { ativo: 'Ativos', atraso: 'Em atraso', inativo: 'Inativos', cancelado: 'Cancelados', todos: 'Todos' };
  const lista = db.alunos.filter(a => st === 'todos' || (st === 'atraso' ? a.status === 'ativo' && emAtraso(a) : a.status === st)).sort(porNome);
  let html = `<button class="btn primario largo" id="novo-aluno">+ Novo aluno</button>
    ${campo('Procurar', 'busca', '', 'search', 'placeholder="Nome do aluno" autocomplete="off"')}
    <div class="chips">${Object.entries(FILTROS).map(([k, t]) =>
      `<a class="chip ${k === st ? 'on' : ''}" href="${comFiltro('/alunos', params, { st: k === 'ativo' ? '' : k })}">${t}</a>`).join('')}</div>`;
  html += lista.length ? `<div class="lista">${lista.map(a => {
    const n = obsAtivas(a.id).length;
    return `<a class="item" href="#/aluno/${a.id}" data-nome="${esc(semAcento(a.nome).toLowerCase())}">
      <span class="avatar mini">${esc(iniciais(a.nome))}</span>
      <div class="cresce"><strong>${esc(a.nome)}</strong>
        <div class="sub">${esc([a.servico, a.objetivo].filter(Boolean).join(' · ') || 'Cadastro incompleto')}</div></div>
      ${n ? `<span class="selo medio">${plural(n, 'obs.', 'obs.')}</span>` : ''}${seloAluno(a)}
      <span class="seta">›</span></a>`;
  }).join('')}</div>` : vazio(db.alunos.length ? 'Nenhum aluno neste filtro.' : 'Nenhum aluno. Toque em <b>+ Novo aluno</b> para cadastrar.');
  render('Alunos', html);
  $('#novo-aluno').onclick = () => modalAluno();
  $('[name=busca]').oninput = e => {
    const q = semAcento(e.target.value).toLowerCase().trim();
    $$('[data-nome]').forEach(i => { i.hidden = !i.dataset.nome.includes(q); });
  };
}

function modalAluno(a) {
  const p = a?.plano || {};
  const servicos = [...db.config.servicos];
  if (a?.servico && !servicos.includes(a.servico)) servicos.push(a.servico);
  const corpo = `
    ${campo('Nome completo', 'nome', a?.nome, 'text', 'autocomplete="off"')}
    ${campo('Telefone / WhatsApp (com DDD)', 'whatsapp', a?.whatsapp, 'tel', 'placeholder="(11) 91234-5678" autocomplete="off"')}
    <div class="duas">
      ${campo('Início do acompanhamento', 'inicio', a?.inicio ?? hoje(), 'date')}
      ${campo('Nascimento', 'nascimento', a?.nascimento, 'date')}
    </div>
    ${campo('Objetivo', 'objetivo', a?.objetivo, 'text', 'placeholder="Ex.: emagrecer, ganhar massa"')}
    ${campo('Dias e horários', 'horarios', a?.horarios, 'text', 'placeholder="Ex.: seg, qua e sex às 7h"')}
    ${campoSelect('Serviço contratado', 'servico', [['', '—'], ...servicos], a?.servico)}
    <div class="duas">
      ${campoSelect('Pagamento', 'planoTipo', Object.entries(PLANOS), p.tipo)}
      ${campoValor('Valor do plano (R$)', 'planoValor', p.valor)}
    </div>
    ${campo('Primeiro vencimento', 'planoDesde', p.desde ?? hoje(), 'date')}
    <p class="legenda">A partir dessa data o app cria as cobranças sozinho: todo mês no mesmo dia, a cada 14 dias ou a cada 7 dias.</p>
    ${a ? campoSelect('Situação', 'status', Object.entries(STATUS_ALUNO), a.status) : ''}`;
  const botoes = [{ texto: 'Cancelar' }, {
    texto: 'Salvar', classe: 'primario', acao: m => {
      const d = lerForm(m);
      if (!d.nome) { toast('Digite o nome do aluno'); return false; }
      const valor = lerNumero(d.planoValor);
      if (d.planoTipo && !(valor > 0)) { toast('Digite o valor do plano'); return false; }
      if (d.planoTipo && !d.planoDesde) { toast('Escolha a data do primeiro vencimento'); return false; }
      const novo = !a;
      if (novo) { a = { id: novoId(), status: 'ativo' }; db.alunos.push(a); }
      Object.assign(a, {
        nome: d.nome, whatsapp: d.whatsapp, objetivo: d.objetivo, horarios: d.horarios, servico: d.servico,
        nascimento: d.nascimento, inicio: d.inicio,
        plano: { tipo: d.planoTipo, valor: d.planoTipo ? valor : 0, desde: d.planoDesde },
      });
      if (!novo) a.status = d.status;
      salvar();
      toast('Aluno salvo');
      if (novo) ir(`#/aluno/${a.id}`); else rotear();
    },
  }];
  if (a) botoes.unshift({ texto: 'Excluir', classe: 'perigo-texto esq', acao: () => excluirAluno(a) });
  abrirModal(a ? 'Editar aluno' : 'Novo aluno', corpo, botoes);
}

function excluirAluno(a) {
  // Quem já pagou alguma coisa faz parte do faturamento: não some, só muda de situação.
  if (cobrancasDe(a.id).some(c => c.pagamentos.length)) {
    abrirModal('Aluno com pagamentos', `<p><b>${esc(a.nome)}</b> tem pagamentos registrados. Se ele for excluído, o faturamento dos meses passados muda.</p>
      <p>Mude a situação para <b>Cancelado</b>: ele sai da lista de ativos e o histórico financeiro continua certo.</p>`, [
      { texto: 'Voltar' },
      { texto: 'Marcar como cancelado', classe: 'primario', acao: () => { a.status = 'cancelado'; salvar(); toast('Aluno cancelado'); rotear(); } },
    ]);
    return;
  }
  confirmar(`Excluir ${a.nome} e todas as fichas, observações, evolução e cobranças desse aluno? Não dá para desfazer.`, 'Excluir aluno', () => {
    db.alunos = db.alunos.filter(x => x.id !== a.id);
    for (const k of ['fichas', 'obs', 'cargas', 'registros', 'cobrancas']) db[k] = db[k].filter(x => x.alunoId !== a.id);
    salvar();
    toast('Aluno excluído');
    ir('#/alunos');
  });
}

function avisoObs(alunoId) {
  const l = obsAtivas(alunoId);
  if (!l.length) return '';
  return `<div class="cartao atencao"><b>Atenção antes de montar o treino:</b>
    <ul>${l.map(o => `<li><b>${esc(o.tipo)}${o.local ? ' – ' + esc(o.local) : ''}</b>${o.texto ? ': ' + esc(o.texto) : ''}</li>`).join('')}</ul></div>`;
}

function telaAluno(id, aba = 'treino') {
  const a = aluno(id);
  if (!a) return ir('#/alunos');
  const ABAS = { treino: 'Treino', obs: 'Observações', evolucao: 'Evolução', financeiro: 'Financeiro' };
  if (!ABAS[aba]) aba = 'treino';
  const html = `<nav class="abas">${Object.entries(ABAS).map(([k, t]) =>
      `<a href="#/aluno/${id}/${k}" class="${k === aba ? 'ativa' : ''}">${t}</a>`).join('')}</nav>
    <div class="cartao perfil">
      <span class="avatar">${esc(iniciais(a.nome))}</span>
      <div class="cresce"><h2>${esc(a.nome)}</h2>
        <div class="sub">${[a.servico, a.objetivo, a.horarios].filter(Boolean).map(esc).join(' · ') || 'Toque no lápis para completar o cadastro'}</div>
        ${seloAluno(a)}</div>
    </div><div id="aba"></div>`;
  render(a.nome, html, {
    voltar: '/alunos',
    acao: `<button class="btn-icone" id="editar-aluno" aria-label="Editar aluno">✎</button>`,
  });
  $('#editar-aluno').onclick = () => modalAluno(a);
  ({ treino: abaTreino, obs: abaObs, evolucao: abaEvolucao, financeiro: abaFinanceiro })[aba](a, $('#aba'));
}

/* ---------- Ficha de treino ---------- */

function resumoExercicio(e) {
  return [e.series && e.reps ? `${e.series}x${e.reps}` : e.series ? `${e.series} séries` : e.reps,
    e.carga != null ? fmtKg(e.carga) : '', e.descanso ? `descanso ${e.descanso}` : ''].filter(Boolean).join(' · ');
}

function abaTreino(a, alvo) {
  const fichas = fichasDe(a.id);
  alvo.innerHTML = avisoObs(a.id)
    + (fichas.length ? `<div class="lista">${fichas.map(f =>
      `<a class="item" href="#/ficha/${f.id}"><div><strong>${esc(f.nome)}</strong>
        <div class="sub">${plural(f.exercicios.length, 'exercício', 'exercícios')}${f.exercicios.length ? ': ' + f.exercicios.map(e => esc(e.nome)).join(', ') : ''}</div></div>
        <span class="selo">${esc(f.nivel)}</span><span class="seta">›</span></a>`).join('')}</div>`
      : vazio('Nenhuma ficha de treino ainda.'))
    + `<button class="btn primario largo" id="nova-ficha">+ Nova ficha de treino</button>`;
  $('#nova-ficha').onclick = () => modalFicha(a);
}

function modalFicha(a, f) {
  const letra = String.fromCharCode(65 + fichasDe(a.id).length);
  const corpo = `${campo('Nome da ficha', 'nome', f?.nome ?? `Treino ${letra}`)}
    ${campoSelect('Nível de dificuldade', 'nivel', NIVEIS_FICHA, f?.nivel)}
    ${campoTexto('Anotações da ficha', 'obs', f?.obs, 2, 'placeholder="Ex.: peito e tríceps, aquecer 10 min antes"')}`;
  const botoes = [{ texto: 'Cancelar' }, {
    texto: 'Salvar', classe: 'primario', acao: m => {
      const d = lerForm(m);
      if (!d.nome) { toast('Digite o nome da ficha'); return false; }
      if (!f) { f = { id: novoId(), alunoId: a.id, exercicios: [] }; db.fichas.push(f); }
      Object.assign(f, d);
      salvar();
      ir(`#/ficha/${f.id}`);
    },
  }];
  if (f) botoes.unshift({
    texto: 'Excluir', classe: 'perigo-texto esq', acao: () => confirmar(`Excluir a ficha "${f.nome}"?`, 'Excluir ficha', () => {
      db.fichas = db.fichas.filter(x => x.id !== f.id);
      salvar();
      ir(`#/aluno/${a.id}/treino`);
    }),
  });
  abrirModal(f ? 'Editar ficha' : 'Nova ficha de treino', corpo, botoes);
}

function textoFicha(f, a) {
  const l = [`*${f.nome}* – ${a.nome}`];
  if (f.obs) l.push(f.obs);
  l.push('');
  f.exercicios.forEach((e, i) => {
    l.push(`${i + 1}. ${e.nome}${resumoExercicio(e) ? ' – ' + resumoExercicio(e) : ''}`);
    if (e.obs) l.push(`   ${e.obs}`);
  });
  return l.join('\n');
}

function telaFicha(id) {
  const f = db.fichas.find(x => x.id === id);
  const a = f && aluno(f.alunoId);
  if (!a) return ir('#/alunos');
  let html = `<p class="sub">${esc(a.nome)} · <span class="selo">${esc(f.nivel)}</span></p>
    ${f.obs ? `<div class="cartao"><p style="white-space:pre-wrap">${esc(f.obs)}</p></div>` : ''}${avisoObs(a.id)}`;
  html += f.exercicios.length ? `<div class="lista">${f.exercicios.map((e, i) =>
    `<button class="item" data-ex="${e.id}"><div><strong>${i + 1}. ${esc(e.nome)}</strong>
      <div class="sub">${esc(resumoExercicio(e)) || 'Toque para completar'}</div>
      ${e.obs ? `<div class="sub">${esc(e.obs)}</div>` : ''}</div>
      ${e.dificuldade ? `<span class="selo ${COR_DIFICULDADE[e.dificuldade]}">${DIFICULDADES[e.dificuldade]}</span>` : ''}</button>`).join('')}</div>
    <p class="legenda">Toque num exercício para mudar a carga. Cada mudança de carga entra na aba Evolução do aluno.</p>`
    : vazio('Nenhum exercício nesta ficha.');
  html += `<button class="btn primario largo" id="novo-ex">+ Adicionar exercício</button>`;
  if (f.exercicios.length) html += botaoWhats(a.whatsapp, textoFicha(f, a), 'Enviar ficha pelo WhatsApp');
  render(f.nome, html, {
    voltar: `/aluno/${a.id}/treino`,
    acao: `<button class="btn-icone" id="editar-ficha" aria-label="Editar ficha">✎</button>`,
  });
  $('#editar-ficha').onclick = () => modalFicha(a, f);
  $('#novo-ex').onclick = () => modalExercicio(f);
  $$('[data-ex]').forEach(b => b.onclick = () => modalExercicio(f, f.exercicios.find(e => e.id === b.dataset.ex)));
}

function modalExercicio(f, e) {
  const corpo = `${campo('Exercício', 'nome', e?.nome, 'text', 'placeholder="Ex.: Supino reto" autocomplete="off"')}
    <div class="tres">
      ${campo('Séries', 'series', e?.series, 'text', 'inputmode="numeric"')}
      ${campo('Repetições', 'reps', e?.reps, 'text', 'placeholder="12 ou 8-10"')}
      ${campo('Carga (kg)', 'carga', e?.carga != null ? String(e.carga).replace('.', ',') : '', 'text', 'inputmode="decimal"')}
    </div>
    <div class="duas">
      ${campo('Descanso', 'descanso', e?.descanso, 'text', 'placeholder="Ex.: 60s"')}
      ${campoSelect('Para o aluno está', 'dificuldade', Object.entries(DIFICULDADES), e?.dificuldade)}
    </div>
    ${campoTexto('Anotação', 'obs', e?.obs, 2, 'placeholder="Ex.: cuidar da postura"')}`;
  const botoes = [{ texto: 'Cancelar' }, {
    texto: 'Salvar', classe: 'primario', acao: m => {
      const d = lerForm(m);
      if (!d.nome) { toast('Digite o nome do exercício'); return false; }
      const carga = lerNumero(d.carga);
      const mudouCarga = carga != null && carga !== (e?.carga ?? null);
      if (!e) { e = { id: novoId() }; f.exercicios.push(e); }
      Object.assign(e, d, { carga });
      if (mudouCarga) db.cargas.push({ id: novoId(), alunoId: f.alunoId, exercicio: e.nome, data: hoje(), carga });
      salvar();
      rotear();
    },
  }];
  if (e) {
    const i = f.exercicios.indexOf(e);
    const mover = para => () => {
      f.exercicios.splice(i, 1);
      f.exercicios.splice(para, 0, e);
      salvar();
      rotear();
    };
    botoes.unshift({
      texto: 'Excluir', classe: 'perigo-texto esq', acao: () => {
        f.exercicios.splice(i, 1);
        salvar();
        rotear();
      },
    });
    if (i > 0) botoes.splice(1, 0, { texto: '↑ Subir', acao: mover(i - 1) });
    if (i < f.exercicios.length - 1) botoes.splice(1, 0, { texto: '↓ Descer', acao: mover(i + 1) });
  }
  abrirModal(e ? 'Editar exercício' : 'Novo exercício', corpo, botoes);
}

/* ---------- Observações especiais ---------- */

function abaObs(a, alvo) {
  const lista = db.obs.filter(o => o.alunoId === a.id).sort((x, y) => (y.ativa - x.ativa) || y.data.localeCompare(x.data));
  alvo.innerHTML = `<button class="btn primario largo" id="nova-obs">+ Nova observação especial</button>`
    + (lista.length ? lista.map(o => `<button class="reg ${o.ativa ? 'ruim' : 'neutro'}" data-obs="${o.id}">
        <div class="reg-topo"><strong>${esc(o.tipo)}${o.local ? ' – ' + esc(o.local) : ''}</strong>
          <span class="selo ${o.ativa ? 'ruim' : 'bom'}">${o.ativa ? 'Em atenção' : 'Recuperado'}</span>
          <span class="sub">${fmtData(o.data)}</span></div>
        ${o.texto ? `<p>${esc(o.texto)}</p>` : ''}</button>`).join('')
      : vazio('Nenhuma lesão, fratura ou restrição registrada.'))
    + `<p class="legenda">Lesões, fraturas, cirurgias, recuperação e restrições. As que estão "em atenção" aparecem em vermelho na ficha de treino.</p>`;
  $('#nova-obs').onclick = () => modalObs(a);
  $$('[data-obs]', alvo).forEach(b => b.onclick = () => modalObs(a, db.obs.find(o => o.id === b.dataset.obs)));
}

function modalObs(a, o) {
  const corpo = `<div class="duas">
      ${campoSelect('Tipo', 'tipo', TIPOS_OBS, o?.tipo)}
      ${campo('Data', 'data', o?.data ?? hoje(), 'date')}
    </div>
    ${campo('Local do corpo', 'local', o?.local, 'text', 'placeholder="Ex.: joelho direito"')}
    ${campoTexto('Detalhes e cuidados no treino', 'texto', o?.texto, 3, 'placeholder="Ex.: evitar agachamento profundo; liberado pelo médico para caminhada"')}
    ${campoMarcar('Ainda exige atenção (não recuperado)', 'ativa', o ? o.ativa : true)}`;
  const botoes = [{ texto: 'Cancelar' }, {
    texto: 'Salvar', classe: 'primario', acao: m => {
      const d = lerForm(m);
      if (!o) { o = { id: novoId(), alunoId: a.id }; db.obs.push(o); }
      Object.assign(o, d, { data: d.data || hoje() });
      salvar();
      rotear();
    },
  }];
  if (o) botoes.unshift({
    texto: 'Excluir', classe: 'perigo-texto esq', acao: () => {
      db.obs = db.obs.filter(x => x.id !== o.id);
      salvar();
      rotear();
    },
  });
  abrirModal(o ? 'Editar observação' : 'Nova observação especial', corpo, botoes);
}

/* ---------- Evolução ---------- */

function cargasPorExercicio(alunoId) {
  const grupos = {};
  db.cargas.filter(c => c.alunoId === alunoId).sort((x, y) => x.data.localeCompare(y.data)).forEach(c => {
    const k = c.exercicio.trim().toLowerCase();
    (grupos[k] ||= { chave: k, nome: c.exercicio, hist: [] }).hist.push(c);
  });
  return Object.values(grupos).sort(porNome);
}

// Diz, para cada exercício, se o aluno está subindo de carga ou parado hoje.
function evolucaoCargas(alunoId) {
  return cargasPorExercicio(alunoId).map(g => {
    const h = g.hist, ult = h[h.length - 1], ant = h[h.length - 2];
    const dias = diasDesde(ult.data);
    let estado, texto;
    if (ant && ult.carga > ant.carga && dias <= DIAS_PARADO) {
      estado = 'melhora';
      texto = `Subiu de ${fmtKg(ant.carga)} para ${fmtKg(ult.carga)} em ${fmtDataCurta(ult.data)}`;
    } else if (ant && ult.carga < ant.carga) {
      estado = 'parado';
      texto = `Caiu de ${fmtKg(ant.carga)} para ${fmtKg(ult.carga)} em ${fmtDataCurta(ult.data)}`;
    } else if (dias > DIAS_PARADO) {
      estado = 'parado';
      texto = `Mesma carga (${fmtKg(ult.carga)}) há ${dias} dias`;
    } else {
      estado = 'inicio';
      texto = `${fmtKg(ult.carga)} desde ${fmtDataCurta(ult.data)}`;
    }
    return { ...g, estado, texto, total: ult.carga - h[0].carga };
  });
}

function abaEvolucao(a, alvo) {
  const cargas = evolucaoCargas(a.id);
  const regs = db.registros.filter(r => r.alunoId === a.id).sort((x, y) => y.data.localeCompare(x.data));
  const linhaCarga = g => `<button class="item" data-carga="${esc(g.chave)}"><div><strong>${esc(g.nome)}</strong>
    <div class="sub">${esc(g.texto)}</div></div>
    ${g.total ? `<span class="selo ${g.total > 0 ? 'bom' : 'ruim'}">${g.total > 0 ? '+' : '−'}${fmtKg(Math.abs(g.total))} no total</span>` : ''}</button>`;
  const linhaReg = r => `<button class="reg ${COR_REGISTRO[r.tipo]}" data-reg="${r.id}">
    <div class="reg-topo"><strong>${esc(r.area || TIPOS_REGISTRO[r.tipo])}</strong><span class="sub">${fmtData(r.data)}</span></div>
    <p>${esc(r.texto)}</p></button>`;
  const bloco = (titulo, cor, estado, tipo, vazioTxt) => {
    const c = cargas.filter(g => g.estado === estado), r = regs.filter(x => x.tipo === tipo);
    return `<h3 class="secao ${cor}">${titulo}</h3>`
      + (c.length ? `<div class="lista" style="margin-bottom:8px">${c.map(linhaCarga).join('')}</div>` : '')
      + r.map(linhaReg).join('') + (c.length || r.length ? '' : vazio(vazioTxt));
  };
  const inicio = cargas.filter(g => g.estado === 'inicio'), outras = regs.filter(r => r.tipo === 'observacao');
  alvo.innerHTML = `<button class="btn primario largo" id="novo-reg">+ Anotar evolução</button>
    <a class="btn largo" href="#/evolucao/${a.id}">Relatório do mês para o aluno</a>`
    + bloco('Está melhorando', 'bom', 'melhora', 'melhora', 'Nada registrado ainda. Aumente a carga de um exercício na ficha ou anote uma melhora.')
    + bloco('Não está melhorando', 'ruim', 'parado', 'parado', 'Nenhum ponto parado.')
    + (inicio.length ? `<h3 class="secao">Cargas recentes</h3><div class="lista">${inicio.map(linhaCarga).join('')}</div>` : '')
    + (outras.length ? `<h3 class="secao">Outras anotações</h3>${outras.map(linhaReg).join('')}` : '')
    + `<p class="legenda">As cargas vêm da ficha de treino. Um exercício entra em "não está melhorando" quando a carga cai ou fica igual por mais de ${DIAS_PARADO} dias.</p>`;
  $('#novo-reg').onclick = () => modalRegistro(a);
  $$('[data-reg]', alvo).forEach(b => b.onclick = () => modalRegistro(a, db.registros.find(r => r.id === b.dataset.reg)));
  $$('[data-carga]', alvo).forEach(b => b.onclick = () => modalHistorico(cargas.find(g => g.chave === b.dataset.carga)));
}

function modalHistorico(g) {
  const m = abrirModal(g.nome, `<div class="lista">${[...g.hist].reverse().map(c =>
    `<div class="item"><div><strong>${fmtKg(c.carga)}</strong><div class="sub">${fmtData(c.data)}</div></div>
      <button class="btn perigo-texto" data-apagar="${c.id}">Apagar</button></div>`).join('')}</div>
    <p class="legenda">Para registrar uma carga nova, mude a carga do exercício na ficha de treino.</p>`, [{ texto: 'Fechar' }]);
  $$('[data-apagar]', m).forEach(b => b.onclick = () => {
    db.cargas = db.cargas.filter(c => c.id !== b.dataset.apagar);
    salvar();
    rotear();
  });
}

function modalRegistro(a, r) {
  const corpo = `<div class="duas">
      ${campoSelect('Como está', 'tipo', Object.entries(TIPOS_REGISTRO), r?.tipo)}
      ${campo('Data', 'data', r?.data ?? hoje(), 'date')}
    </div>
    ${campo('Em quê', 'area', r?.area, 'text', 'placeholder="Ex.: força, resistência, postura, peso"')}
    ${campoTexto('Anotação', 'texto', r?.texto, 3)}`;
  const botoes = [{ texto: 'Cancelar' }, {
    texto: 'Salvar', classe: 'primario', acao: m => {
      const d = lerForm(m);
      if (!d.texto && !d.area) { toast('Escreva a anotação'); return false; }
      if (!r) { r = { id: novoId(), alunoId: a.id }; db.registros.push(r); }
      Object.assign(r, d, { data: d.data || hoje() });
      salvar();
      rotear();
    },
  }];
  if (r) botoes.unshift({
    texto: 'Excluir', classe: 'perigo-texto esq', acao: () => {
      db.registros = db.registros.filter(x => x.id !== r.id);
      salvar();
      rotear();
    },
  });
  abrirModal(r ? 'Editar anotação' : 'Anotar evolução', corpo, botoes);
}

// O que aconteceu com o aluno num mês: cargas que subiram, caíram ou ficaram iguais, e as anotações.
function evolucaoNoMes(alunoId, p) {
  const subiu = [], caiu = [], manteve = [];
  for (const g of cargasPorExercicio(alunoId)) {
    const antes = g.hist.filter(c => c.data < p.ini).pop();
    const noMes = g.hist.filter(c => entre(c.data, p));
    const fim = noMes[noMes.length - 1] || antes;
    const base = antes || noMes[0];
    if (!fim) continue;
    const item = { nome: g.nome, de: base.carga, para: fim.carga };
    (fim.carga > base.carga ? subiu : fim.carga < base.carga ? caiu : manteve).push(item);
  }
  const regs = db.registros.filter(r => r.alunoId === alunoId && entre(r.data, p));
  return { subiu, caiu, manteve, regs };
}

function telaRelatorioAluno(id, params) {
  const a = aluno(id);
  if (!a) return ir('#/alunos');
  const p = periodo('mes', (/^\d{4}-\d{2}$/.test(params.get('m') || '') ? params.get('m') : hoje().slice(0, 7)) + '-01');
  const mes = p.ini.slice(0, 7), chaveRecado = `${id}|${mes}`;
  const ev = evolucaoNoMes(id, p);
  const troca = c => `${c.nome}: ${fmtKg(c.de)} → ${fmtKg(c.para)}`;
  const nota = r => `${r.area ? r.area + ': ' : ''}${r.texto}`;
  const bons = [...ev.subiu.map(c => `${troca(c)} (+${fmtKg(c.para - c.de)})`), ...ev.regs.filter(r => r.tipo === 'melhora').map(nota)];
  const ruins = [...ev.caiu.map(troca), ...ev.regs.filter(r => r.tipo === 'parado').map(nota)];
  const iguais = ev.manteve.map(c => `${c.nome} (${fmtKg(c.para)})`);
  const outras = ev.regs.filter(r => r.tipo === 'observacao').map(nota);
  const cuidados = obsAtivas(id).map(o => `${o.tipo}${o.local ? ' – ' + o.local : ''}`);
  const partes = [
    ['Onde você evoluiu', '✅', bons],
    ['Onde ainda vamos melhorar', '⚠️', ruins],
    ['Cargas mantidas', '➡️', iguais],
    ['Outras anotações', '📝', outras],
    ['Cuidados no treino', '🩺', cuidados],
  ].filter(x => x[2].length);
  const texto = recado => [`*Relatório de evolução – ${fmtMes(mes)}*`, `Aluno(a): ${a.nome}`,
    ...partes.flatMap(([t, e, l]) => ['', `${e} *${t}*`, ...l.map(x => `• ${x}`)]),
    ...(recado ? ['', `💬 ${recado}`] : []), ...(db.config.personal ? ['', db.config.personal] : [])].join('\n');

  const html = `<div class="mes-nav nao-imprimir">
      <button class="btn-icone" data-ir="#/evolucao/${id}?m=${somaMes(mes, -1)}" aria-label="Mês anterior">‹</button>
      <h2>${fmtMes(mes)}</h2>
      <button class="btn-icone" data-ir="#/evolucao/${id}?m=${somaMes(mes, 1)}" aria-label="Próximo mês">›</button>
    </div>
    <div class="relatorio">
      <div class="rel-cab">${cabecalhoMarca()}<h2>Relatório de evolução</h2><p>${esc(a.nome)}</p><p>${fmtMes(mes)}</p></div>
      ${partes.length ? partes.map(([t, , l]) => `<h3>${t}</h3><ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')
        : '<p class="sub centro">Nada registrado neste mês. Mude cargas na ficha de treino ou anote a evolução do aluno.</p>'}
      <h3>Recado do personal</h3>
      <textarea id="recado" rows="3" placeholder="Escreva um recado para o aluno (opcional)">${esc(db.recados[chaveRecado] || '')}</textarea>
      ${db.config.personal ? `<p class="sub">${esc(db.config.personal)}</p>` : ''}
      ${RODAPE_RELATORIO}
    </div>
    <a class="btn whats largo nao-imprimir" id="rel-whats" target="_blank" rel="noopener" href="#">Enviar relatório pelo WhatsApp</a>
    <button class="btn largo nao-imprimir" id="rel-pdf">Salvar em PDF ou imprimir</button>`;
  render('Evolução do mês', html, { voltar: `/aluno/${id}/evolucao` });
  const link = () => { $('#rel-whats').href = linkWhats(a.whatsapp, texto($('#recado').value.trim())); };
  $('#recado').oninput = e => {
    const v = e.target.value.trim();
    if (v) db.recados[chaveRecado] = v; else delete db.recados[chaveRecado];
    salvar();
    link();
  };
  link();
  $('#rel-pdf').onclick = () => window.print();
}

/* ---------- Cobranças e pagamentos ---------- */

function vencimentoMensal(desde, n) {
  const [a, m, d] = desde.split('-').map(Number);
  const ultimo = new Date(a, m + n, 0).getDate();
  return isoLocal(new Date(a, m - 1 + n, Math.min(d, ultimo)));
}

// Cria as cobranças do plano de cada aluno ativo até o fim do mês (mensal) ou da semana atual.
function garantirCobrancas() {
  const h = hoje(), corte = somaDias(h, -93);
  const existentes = new Set(db.cobrancas.map(c => c.chave));
  let mudou = false;
  for (const a of db.alunos) {
    const p = a.plano;
    if (a.status !== 'ativo' || !p?.tipo || !(p.valor > 0) || !p.desde) continue;
    const mensal = p.tipo === 'mensal', passo = p.tipo === 'quinzenal' ? 14 : 7;
    const limite = mensal ? ultimoDia(h.slice(0, 7)) : somaDias(segundaDe(h), 6);
    for (let n = 0; n < 2000; n++) {
      const venc = mensal ? vencimentoMensal(p.desde, n) : somaDias(p.desde, passo * n);
      if (venc > limite) break;
      if (venc < corte) continue;
      const seg = segundaDe(venc);
      const chave = `${a.id}|${mensal ? venc.slice(0, 7) : seg}`;
      if (existentes.has(chave)) continue;
      db.cobrancas.push({
        id: novoId(), alunoId: a.id, chave, valor: p.valor, desconto: 0, venc, avisadoEm: null, cancelada: false, pagamentos: [],
        ref: mensal ? `Mensalidade de ${MESES[+venc.slice(5, 7) - 1]}/${venc.slice(0, 4)}`
          : p.tipo === 'quinzenal' ? `Quinzena até ${fmtDataCurta(somaDias(venc, 13))}`
            : `Semana de ${fmtDataCurta(seg)} a ${fmtDataCurta(somaDias(seg, 6))}`,
      });
      mudou = true;
    }
  }
  if (mudou) salvar();
}

function ordemCobranca(a, b) { return a.venc.localeCompare(b.venc) || porNome(aluno(a.alunoId), aluno(b.alunoId)); }
function seloCobranca(c) {
  const s = situacao(c);
  return `<span class="selo ${{ pago: 'bom', atrasado: 'ruim', parcial: 'medio', pendente: 'medio' }[s]}">${{ pago: 'Pago', atrasado: 'Atrasado', parcial: 'Parcial', pendente: 'Pendente' }[s]}</span>`;
}
function itemCobranca(c, comNome = true) {
  const pago = quitada(c), ultimo = c.pagamentos[c.pagamentos.length - 1];
  const quando = pago ? (ultimo ? `pago em ${fmtData(ultimo.data)}` : 'isento') : `vence ${fmtData(c.venc)}`;
  return `<button class="item" data-cob="${c.id}"><div>
      <strong>${esc(comNome ? aluno(c.alunoId).nome : c.ref)}</strong>
      <div class="sub">${comNome ? esc(c.ref) + ' · ' : ''}${quando}${c.avisadoEm && !pago ? ` · avisado ${fmtDataCurta(c.avisadoEm)}` : ''}</div></div>
    <span class="valor">${fmtBRL(pago ? devido(c) : falta(c))}</span>${seloCobranca(c)}</button>`;
}
function itemPagamento(p, comNome = true) {
  return `<button class="item" data-cob="${p.cob.id}"><div>
      <strong>${esc(comNome ? aluno(p.cob.alunoId).nome : p.cob.ref)}</strong>
      <div class="sub">${fmtData(p.data)} · ${esc(p.forma)}${comNome ? ' · ' + esc(p.cob.ref) : ''}${p.obs ? ' · ' + esc(p.obs) : ''}</div></div>
    <span class="valor bom">${fmtBRL(p.valor)}</span></button>`;
}
function ligarCobrancas(raiz) {
  $$('[data-cob]', raiz).forEach(b => b.onclick = () => modalCobranca(db.cobrancas.find(c => c.id === b.dataset.cob)));
}

function modalEditarCobranca(a, c) {
  const corpo = `${campo('Descrição', 'ref', c?.ref ?? 'Aula avulsa')}
    <div class="duas">
      ${campoValor('Valor (R$)', 'valor', c?.valor)}
      ${campoValor('Desconto (R$)', 'desconto', c?.desconto)}
    </div>
    ${campo('Vencimento', 'venc', c?.venc ?? hoje(), 'date')}`;
  abrirModal(c ? 'Editar cobrança' : 'Nova cobrança', corpo, [{ texto: 'Cancelar' }, {
    texto: 'Salvar', classe: 'primario', acao: m => {
      const d = lerForm(m), valor = lerNumero(d.valor), desconto = lerNumero(d.desconto) || 0;
      if (!(valor > 0)) { toast('Digite o valor'); return false; }
      if (desconto < 0 || desconto > valor) { toast('O desconto não pode ser maior que o valor'); return false; }
      if (!d.venc) { toast('Escolha o vencimento'); return false; }
      if (c && arred(valor - desconto) < pagoDe(c) - 0.005) { toast(`Este aluno já pagou ${fmtBRL(pagoDe(c))} nesta cobrança`); return false; }
      if (!c) { c = { id: novoId(), alunoId: a.id, chave: null, avisadoEm: null, cancelada: false, pagamentos: [] }; db.cobrancas.push(c); }
      Object.assign(c, { ref: d.ref || 'Cobrança', valor, desconto, venc: d.venc });
      salvar();
      rotear();
      modalCobranca(c);
    },
  }]);
}

function modalPagamento(c) {
  const resta = falta(c);
  const corpo = `<p class="sub">${esc(aluno(c.alunoId).nome)} · ${esc(c.ref)} · falta ${fmtBRL(resta)}</p>
    <div class="duas">
      ${campoValor('Valor recebido (R$)', 'valor', resta)}
      ${campo('Data do pagamento', 'data', hoje(), 'date', `max="${hoje()}"`)}
    </div>
    ${campoSelect('Forma de pagamento', 'forma', FORMAS, db.config.ultimaForma)}
    ${campo('Descrição (opcional)', 'obs', '', 'text', 'autocomplete="off"')}
    <p class="legenda">Se o aluno pagou só uma parte, digite o valor que entrou. O resto continua em aberto.</p>`;
  abrirModal('Registrar pagamento', corpo, [{ texto: 'Cancelar', acao: () => modalCobranca(c) }, {
    texto: 'Confirmar pagamento', classe: 'primario', acao: m => {
      const d = lerForm(m), valor = lerNumero(d.valor);
      if (!(valor > 0)) { toast('Digite o valor recebido'); return false; }
      if (valor > resta + 0.005) { toast(`O valor é maior do que falta pagar (${fmtBRL(resta)})`); return false; }
      if (!d.data || d.data > hoje()) { toast('A data do pagamento não pode ser no futuro'); return false; }
      c.pagamentos.push({ id: novoId(), data: d.data, valor: arred(valor), forma: d.forma, obs: d.obs });
      c.pagamentos.sort((x, y) => x.data.localeCompare(y.data));
      db.config.ultimaForma = d.forma;
      salvar();
      toast(quitada(c) ? 'Pagamento confirmado' : `Pagamento parcial registrado. Falta ${fmtBRL(falta(c))}`);
      rotear();
    },
  }]);
}

function mensagemCobranca(c) {
  const a = aluno(c.alunoId), cfg = db.config;
  let t = (cfg.mensagem || MSG_PADRAO)
    .replace(/\{nome\}/g, a.nome.split(' ')[0]).replace(/\{referencia\}/g, c.ref)
    .replace(/\{valor\}/g, fmtBRL(falta(c))).replace(/\{vencimento\}/g, fmtData(c.venc));
  if (pixPronto()) t += '\n\nVou mandar o código Pix copia e cola na próxima mensagem. É só copiar e colar no app do seu banco.';
  if (cfg.personal) t += `\n\n${cfg.personal}`;
  return t;
}

function modalCobranca(c) {
  const a = aluno(c.alunoId), pago = quitada(c), resta = falta(c);
  const codigo = !pago && pixPronto() ? pixCopiaECola(resta) : '';
  let corpo = `<p class="cob-valor">${fmtBRL(pago ? devido(c) : resta)}</p>
    <p class="sub centro">${esc(c.ref)} · vencimento ${fmtData(c.venc)}</p>
    <p class="centro">${seloCobranca(c)}</p>`;
  if (c.desconto || c.pagamentos.length) {
    corpo += `<table class="contas"><tr><td>Valor</td><td>${fmtBRL(c.valor)}</td></tr>
      ${c.desconto ? `<tr><td>Desconto</td><td>− ${fmtBRL(c.desconto)}</td></tr>` : ''}
      ${c.pagamentos.map(p => `<tr><td>${fmtData(p.data)} · ${esc(p.forma)}${p.obs ? ' · ' + esc(p.obs) : ''}
        <button class="btn perigo-texto" data-apagar="${p.id}" style="min-height:30px;padding:0 8px;margin-left:6px">Apagar</button></td><td class="bom">${fmtBRL(p.valor)}</td></tr>`).join('')}
      <tr><td><b>Falta pagar</b></td><td>${fmtBRL(resta)}</td></tr></table>`;
  }
  if (!pago) {
    corpo += `<button class="btn primario largo" id="cob-pagar">Confirmar pagamento</button>`;
    if (codigo) {
      corpo += `<canvas class="qr" id="cob-qr" aria-label="QR Code do Pix"></canvas>
        <label class="campo"><span>Pix copia e cola</span><textarea class="codigo-pix" rows="4" readonly>${esc(codigo)}</textarea></label>
        <button class="btn largo" id="cob-copiar">Copiar código Pix</button>
        ${botaoWhats(a.whatsapp, mensagemCobranca(c), '1. Enviar mensagem no WhatsApp')}
        ${botaoWhats(a.whatsapp, codigo, '2. Enviar código Pix no WhatsApp')}
        <button class="btn largo" id="cob-imagem" hidden>Compartilhar imagem do QR Code</button>
        <p class="legenda">O código vai numa mensagem separada para o aluno conseguir copiar só ele.${a.whatsapp ? '' : ' Este aluno está sem WhatsApp cadastrado: você escolhe o contato na hora.'}</p>`;
    } else {
      corpo += `<div class="cartao destaque"><p>Cadastre sua chave Pix para gerar o QR Code e o Pix copia e cola.</p>
          <button class="btn primario" data-ir="#/config">Cadastrar chave Pix</button></div>
        ${botaoWhats(a.whatsapp, mensagemCobranca(c), 'Enviar mensagem no WhatsApp')}`;
    }
    corpo += `<button class="btn largo" id="cob-avisar">${c.avisadoEm ? `Aluno avisado em ${fmtData(c.avisadoEm)} · desmarcar` : 'Marcar que avisei o aluno'}</button>`;
  }
  const m = abrirModal(a.nome, corpo, [
    {
      texto: 'Excluir', classe: 'perigo-texto esq', acao: () => {
        if (c.pagamentos.length) { toast('Apague os pagamentos desta cobrança antes de excluir'); return false; }
        confirmar('Excluir esta cobrança?', 'Excluir cobrança', () => {
          // As cobranças do plano ficam guardadas como canceladas para o app não criar de novo.
          if (c.chave) c.cancelada = true; else db.cobrancas = db.cobrancas.filter(x => x.id !== c.id);
          salvar();
          rotear();
        });
      },
    },
    { texto: 'Editar', acao: () => modalEditarCobranca(a, c) },
    { texto: 'Fechar' },
  ]);
  const reabrir = () => { salvar(); rotear(); modalCobranca(c); };
  $('#cob-pagar', m)?.addEventListener('click', () => modalPagamento(c));
  $('#cob-avisar', m)?.addEventListener('click', () => { c.avisadoEm = c.avisadoEm ? null : hoje(); reabrir(); });
  $$('[data-apagar]', m).forEach(b => b.onclick = () => confirmar('Apagar este pagamento? O valor volta a ficar em aberto.', 'Apagar pagamento', () => {
    c.pagamentos = c.pagamentos.filter(p => p.id !== b.dataset.apagar);
    reabrir();
  }));
  if (!codigo) return;
  const canvas = $('#cob-qr', m);
  qrDesenhar(canvas, codigo);
  $('#cob-copiar', m).onclick = () => copiar(codigo, 'Código Pix copiado');
  canvas.toBlob(blob => {
    const arq = new File([blob], 'pix-qrcode.png', { type: 'image/png' });
    const btn = $('#cob-imagem', m);
    if (!btn || !navigator.canShare?.({ files: [arq] })) return;
    btn.hidden = false;
    btn.onclick = () => navigator.share({ files: [arq], title: 'QR Code Pix' }).catch(() => {});
  });
}

function modalDespesa(d) {
  const corpo = `${campo('Descrição', 'descricao', d?.descricao, 'text', 'placeholder="Ex.: aluguel da sala" autocomplete="off"')}
    <div class="duas">
      ${campoValor('Valor (R$)', 'valor', d?.valor)}
      ${campo('Data', 'data', d?.data ?? hoje(), 'date')}
    </div>
    ${campoSelect('Categoria', 'categoria', CATEGORIAS, d?.categoria)}`;
  const botoes = [{ texto: 'Cancelar' }, {
    texto: 'Salvar', classe: 'primario', acao: m => {
      const f = lerForm(m), valor = lerNumero(f.valor);
      if (!(valor > 0)) { toast('Digite o valor da despesa'); return false; }
      if (!f.data) { toast('Escolha a data'); return false; }
      if (!d) { d = { id: novoId() }; db.despesas.push(d); }
      Object.assign(d, { descricao: f.descricao || f.categoria, valor: arred(valor), data: f.data, categoria: f.categoria });
      salvar();
      toast('Despesa salva');
      rotear();
    },
  }];
  if (d) botoes.unshift({
    texto: 'Excluir', classe: 'perigo-texto esq', acao: () => {
      db.despesas = db.despesas.filter(x => x.id !== d.id);
      salvar();
      rotear();
    },
  });
  abrirModal(d ? 'Editar despesa' : 'Nova despesa', corpo, botoes);
}

/* ---------- Financeiro ---------- */

function telaFinanceiro(params) {
  const h = hoje();
  const aba = ['cal', 'desp'].includes(params.get('aba')) ? params.get('aba') : 'cob';
  const mes = /^\d{4}-\d{2}$/.test(params.get('m') || '') ? params.get('m') : h.slice(0, 7);
  const url = mud => comFiltro('/financeiro', params, mud);
  const p = periodo('mes', mes + '-01'), r = resumo(p);
  let html = `<nav class="abas">${[['cob', 'Cobranças'], ['cal', 'Calendário'], ['desp', 'Despesas']].map(([k, t]) =>
      `<a href="${url({ aba: k === 'cob' ? '' : k, d: '' })}" class="${k === aba ? 'ativa' : ''}">${t}</a>`).join('')}</nav>
    <div class="mes-nav">
      <button class="btn-icone" data-ir="${url({ m: somaMes(mes, -1), d: '' })}" aria-label="Mês anterior">‹</button>
      <h2>${fmtMes(mes)}</h2>
      <button class="btn-icone" data-ir="${url({ m: somaMes(mes, 1), d: '' })}" aria-label="Próximo mês">›</button>
    </div>`;

  if (aba === 'desp') {
    const lista = [...r.desp].sort((x, y) => y.data.localeCompare(x.data));
    html += `<div class="indicadores">
        <div><b class="bom">${fmtBRL(r.recebido)}</b><span>recebido</span></div>
        <div><b>${fmtBRL(r.despesas)}</b><span>despesas</span></div>
        <div><b class="${r.liquido < 0 ? 'ruim' : 'bom'}">${fmtBRL(r.liquido)}</b><span>resultado líquido</span></div>
      </div>
      <button class="btn primario largo" id="nova-desp">+ Nova despesa</button>`
      + (lista.length ? `<div class="lista">${lista.map(d => `<button class="item" data-desp="${d.id}"><div>
          <strong>${esc(d.descricao)}</strong><div class="sub">${fmtData(d.data)} · ${esc(d.categoria)}</div></div>
          <span class="valor">${fmtBRL(d.valor)}</span></button>`).join('')}</div>` : vazio('Nenhuma despesa neste mês.'));
    render('Financeiro', html);
    $('#nova-desp').onclick = () => modalDespesa();
    $$('[data-desp]').forEach(b => b.onclick = () => modalDespesa(db.despesas.find(d => d.id === b.dataset.desp)));
    return;
  }

  if (aba === 'cal') {
    const dia = params.get('d') || (mes === h.slice(0, 7) ? h : '');
    const porDia = {};
    r.cobs.forEach(c => (porDia[c.venc] ||= []).push(c));
    const vazios = (dataDe(p.ini).getDay() + 6) % 7, total = +p.fim.slice(8);
    html += `<div class="calendario">${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(s => `<span class="sem">${s}</span>`).join('')}
      ${'<span></span>'.repeat(vazios)}${Array.from({ length: total }, (_, i) => {
        const d = `${mes}-${String(i + 1).padStart(2, '0')}`, l = porDia[d] || [];
        const abertas = l.filter(c => !quitada(c));
        const cor = !l.length ? '' : !abertas.length ? 'bom' : d < h ? 'ruim' : d <= somaDias(h, DIAS_PERTO) ? 'perto' : 'pend';
        return `<a class="dia ${cor} ${d === h ? 'hoje' : ''} ${d === dia ? 'sel' : ''}" href="${url({ d })}">${i + 1}<i></i></a>`;
      }).join('')}</div>
      <p class="legenda"><span class="ruim">▬</span> vencida · <span style="color:var(--medio)">▬</span> vence em até ${DIAS_PERTO} dias ·
        <span style="color:var(--prata)">▬</span> a vencer · <span class="bom">▬</span> paga</p>`;
    const l = (porDia[dia] || []).sort(ordemCobranca);
    html += dia ? `<h3 class="secao">Vencimentos de ${fmtData(dia)}</h3>` + (l.length
      ? `<div class="lista">${l.map(c => itemCobranca(c)).join('')}</div>` : vazio('Nenhum vencimento neste dia.'))
      : `<p class="legenda">Toque num dia para ver os vencimentos.</p>`;
    render('Financeiro', html);
    ligarCobrancas($('#tela'));
    return;
  }

  // Aba Cobranças, com filtros por situação, aluno e forma de pagamento.
  const st = params.get('st') || '', al = params.get('al') || '', forma = params.get('forma') || '';
  const passa = c => (!al || c.alunoId === al) && (!forma || c.pagamentos.some(x => x.forma === forma))
    && (!st || (st === 'aberto' ? !quitada(c) : situacao(c) === st));
  const lista = r.cobs.filter(passa).sort(ordemCobranca);
  const antigas = mes === h.slice(0, 7) && (!st || st === 'atrasado' || st === 'aberto')
    ? cobrancasValidas().filter(c => c.venc < p.ini && !quitada(c) && passa(c)).sort(ordemCobranca) : [];
  const pags = r.pags.filter(x => (!al || x.cob.alunoId === al) && (!forma || x.forma === forma)).sort((x, y) => y.data.localeCompare(x.data));
  const comCob = db.alunos.filter(a => cobrancasDe(a.id).length).sort(porNome);
  html += `<div class="indicadores">
      <div><b>${fmtBRL(r.previsto)}</b><span>previsto</span></div>
      <div><b class="bom">${fmtBRL(r.recebido)}</b><span>recebido</span></div>
      <div><b class="${r.atrasado ? 'ruim' : ''}">${fmtBRL(r.atrasado)}</b><span>atrasado</span></div>
    </div>
    <p class="legenda">Recebido é só o dinheiro que entrou neste mês. Ainda a vencer: <b>${fmtBRL(r.pendente)}</b>.</p>
    <div class="chips">${[['', 'Todas'], ['aberto', 'A receber'], ['atrasado', 'Atrasadas'], ['pago', 'Pagas']].map(([k, t]) =>
      `<a class="chip ${k === st ? 'on' : ''}" href="${url({ st: k })}">${t}</a>`).join('')}</div>
    <div class="filtros">
      <select data-filtro="1" aria-label="Filtrar por aluno">${opcoes([[url({ al: '' }), 'Todos os alunos'], ...comCob.map(a => [url({ al: a.id }), a.nome])], url({ al }))}</select>
      <select data-filtro="1" aria-label="Filtrar por forma de pagamento">${opcoes([[url({ forma: '' }), 'Todas as formas'], ...FORMAS.map(f => [url({ forma: f }), f])], url({ forma }))}</select>
    </div>`;
  if (!pixPronto()) {
    html += `<div class="cartao destaque">
      <p><b>Cadastre sua chave Pix</b> para gerar o QR Code e o Pix copia e cola.</p>
      <button class="btn primario" data-ir="#/config">Cadastrar chave Pix</button></div>`;
  }
  if (antigas.length) {
    html += `<h3 class="secao ruim">Atrasadas de meses anteriores</h3><div class="lista">${antigas.map(c => itemCobranca(c)).join('')}</div>`;
  }
  html += `<h3 class="secao">Cobranças do mês</h3>` + (lista.length
    ? `<div class="lista">${lista.map(c => itemCobranca(c)).join('')}</div>` : vazio('Nenhuma cobrança com este filtro.'));
  html += `<h3 class="secao bom">Pagamentos recebidos no mês</h3>` + (pags.length
    ? `<div class="lista">${pags.map(x => itemPagamento(x)).join('')}</div>
       <p class="legenda">Total da lista: <b>${fmtBRL(soma(pags))}</b></p>` : vazio('Nenhum pagamento com este filtro.'));
  html += `<p class="legenda">Toque numa cobrança para ver o QR Code, enviar pelo WhatsApp ou confirmar o pagamento.
    As cobranças são criadas sozinhas a partir do plano de cada aluno.</p>`;
  render('Financeiro', html);
  ligarCobrancas($('#tela'));
}

function abaFinanceiro(a, alvo) {
  const p = a.plano || {};
  const cobs = cobrancasDe(a.id).sort((x, y) => y.venc.localeCompare(x.venc));
  const pags = cobs.flatMap(c => c.pagamentos.map(x => ({ ...x, cob: c }))).sort((x, y) => y.data.localeCompare(x.data));
  alvo.innerHTML = `<div class="indicadores" style="margin-bottom:16px">
      <div><b class="bom">${fmtBRL(soma(pags))}</b><span>total já pago</span></div>
      <div><b>${fmtBRL(soma(cobs, falta))}</b><span>em aberto</span></div>
      <div><b class="${emAtraso(a) ? 'ruim' : ''}">${fmtBRL(soma(cobs.filter(c => situacao(c) === 'atrasado'), falta))}</b><span>em atraso</span></div>
    </div>
    <div class="cartao">
      <h3>Plano</h3>
      <p>${a.servico ? `${esc(a.servico)} · ` : ''}${p.tipo ? `<b>${PLANOS[p.tipo]}</b> · ${fmtBRL(p.valor)} · primeiro vencimento em ${fmtData(p.desde)}` : 'Sem plano cadastrado.'}</p>
      <div class="linha-botoes"><button class="btn" id="alterar-plano">${p.tipo ? 'Alterar plano' : 'Cadastrar plano'}</button>
        <button class="btn" id="nova-cob">+ Cobrança avulsa</button></div>
    </div>
    <h3 class="secao">Cobranças</h3>`
    + (cobs.length ? `<div class="lista">${cobs.map(c => itemCobranca(c, false)).join('')}</div>` : vazio('Nenhuma cobrança para este aluno.'))
    + `<h3 class="secao bom">Histórico de pagamentos</h3>`
    + (pags.length ? `<div class="lista">${pags.map(x => itemPagamento(x, false)).join('')}</div>` : vazio('Nenhum pagamento registrado.'));
  $('#alterar-plano').onclick = () => modalAluno(a);
  $('#nova-cob').onclick = () => modalEditarCobranca(a);
  ligarCobrancas(alvo);
}

/* ---------- Relatórios ---------- */

function dadosRelatorio(p) {
  const r = resumo(p), h = hoje();
  const agrupar = (lista, chave, valor) => {
    const g = {};
    lista.forEach(x => { const k = chave(x); (g[k] ||= { nome: k, total: 0, n: 0 }); g[k].total = arred(g[k].total + valor(x)); g[k].n++; });
    return Object.values(g).sort((x, y) => y.total - x.total);
  };
  return {
    ...r, anterior: recebidoEm(moverPeriodo(p, -1)),
    formas: agrupar(r.pags, x => x.forma, x => x.valor),
    pagantes: agrupar(r.pags, x => aluno(x.cob.alunoId).nome, x => x.valor),
    inadimplentes: agrupar(r.cobs.filter(c => c.venc < h && !quitada(c)), c => aluno(c.alunoId).nome, falta),
    categorias: agrupar(r.desp, d => d.categoria, d => d.valor),
  };
}

function textoRelatorio(p, d) {
  const lista = (titulo, l) => l.length ? ['', `*${titulo}*`, ...l.map(x => `• ${x.nome}: ${fmtBRL(x.total)}`)] : [];
  return [`*Relatório ${TIPOS_PERIODO[p.tipo].toLowerCase()} – ${nomePeriodo(p)}*`, '',
    `Previsto: ${fmtBRL(d.previsto)}`, `Recebido: ${fmtBRL(d.recebido)}`, `Despesas: ${fmtBRL(d.despesas)}`,
    `Resultado líquido: ${fmtBRL(d.liquido)}`, `A vencer: ${fmtBRL(d.pendente)}`, `Em atraso: ${fmtBRL(d.atrasado)}`,
    ...lista('Formas de pagamento', d.formas), ...lista('Quem pagou', d.pagantes), ...lista('Em atraso', d.inadimplentes),
    ...(db.config.personal ? ['', db.config.personal] : [])].join('\n');
}

// Planilha para o Excel: ponto e vírgula como separador e vírgula decimal, do jeito que o Excel em português abre.
function csvRelatorio(d) {
  const cel = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const num = n => n.toFixed(2).replace('.', ',');
  const linhasCsv = [['Tipo', 'Data', 'Aluno', 'Descrição', 'Forma de pagamento', 'Categoria', 'Valor']];
  d.pags.forEach(x => linhasCsv.push(['Recebimento', fmtData(x.data), aluno(x.cob.alunoId).nome, [x.cob.ref, x.obs].filter(Boolean).join(' - '), x.forma, '', num(x.valor)]));
  d.desp.forEach(x => linhasCsv.push(['Despesa', fmtData(x.data), '', x.descricao, '', x.categoria, num(-x.valor)]));
  d.cobs.filter(c => !quitada(c)).forEach(c => linhasCsv.push([c.venc < hoje() ? 'Em atraso' : 'A vencer', fmtData(c.venc), aluno(c.alunoId).nome, c.ref, '', '', num(falta(c))]));
  return '﻿' + linhasCsv.map(l => l.map(cel).join(';')).join('\r\n');
}

function telaRelatorios(params) {
  const tipo = TIPOS_PERIODO[params.get('t')] ? params.get('t') : 'mes';
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(params.get('r') || '') ? params.get('r') : hoje();
  const p = periodo(tipo, ref), d = dadosRelatorio(p);
  const url = mud => comFiltro('/relatorios', params, mud);
  const tabela = (l, vazioTxt, comQtd) => l.length
    ? `<table class="contas">${l.map(x => `<tr><td>${esc(x.nome)}${comQtd ? ` <span class="sub">(${x.n})</span>` : ''}</td><td>${fmtBRL(x.total)}</td></tr>`).join('')}</table>`
    : `<p class="sub">${vazioTxt}</p>`;
  const html = `<div class="chips nao-imprimir">${Object.entries(TIPOS_PERIODO).map(([k, t]) =>
      `<a class="chip ${k === tipo ? 'on' : ''}" href="${url({ t: k === 'mes' ? '' : k })}">${t}</a>`).join('')}</div>
    <div class="mes-nav nao-imprimir">
      <button class="btn-icone" data-ir="${url({ r: moverPeriodo(p, -1).ini })}" aria-label="Período anterior">‹</button>
      <h2>${nomePeriodo(p)}</h2>
      <button class="btn-icone" data-ir="${url({ r: moverPeriodo(p, 1).ini })}" aria-label="Próximo período">›</button>
    </div>
    <div class="relatorio">
      <div class="rel-cab">${cabecalhoMarca()}<h2>Relatório ${TIPOS_PERIODO[tipo].toLowerCase()}</h2><p>${nomePeriodo(p)}</p>
        ${db.config.personal ? `<p>${esc(db.config.personal)}</p>` : ''}${db.exemplo ? '<p><b>Dados de exemplo</b></p>' : ''}</div>
      <table class="contas">
        <tr><td>Faturamento previsto (bruto)</td><td>${fmtBRL(d.previsto)}</td></tr>
        <tr><td>Total efetivamente recebido</td><td class="bom">${fmtBRL(d.recebido)}</td></tr>
        <tr><td>Despesas</td><td>− ${fmtBRL(d.despesas)}</td></tr>
        <tr><td><b>Resultado líquido</b></td><td class="${d.liquido < 0 ? 'ruim' : 'bom'}">${fmtBRL(d.liquido)}</td></tr>
        <tr><td>Ainda a vencer</td><td>${fmtBRL(d.pendente)}</td></tr>
        <tr><td>Em atraso</td><td class="${d.atrasado ? 'ruim' : ''}">${fmtBRL(d.atrasado)}</td></tr>
      </table>
      <p class="legenda">${variacao(d.recebido, d.anterior, 'o período anterior')}</p>
      <h3>Evolução do faturamento</h3>${graficoRecebido(p)}
      <h3>Formas de pagamento</h3>${tabela(d.formas, 'Nenhum pagamento no período.', true)}
      <h3>Alunos que pagaram</h3>${tabela(d.pagantes, 'Nenhum pagamento no período.')}
      <h3>Alunos em atraso</h3>${tabela(d.inadimplentes, 'Ninguém em atraso no período.')}
      <h3>Despesas por categoria</h3>${tabela(d.categorias, 'Nenhuma despesa no período.')}
      <p class="legenda">Recebido e despesas contam pela data real do pagamento. Previsto, a vencer e em atraso contam pelo vencimento.</p>
      ${RODAPE_RELATORIO}
    </div>
    <button class="btn primario largo nao-imprimir" id="rel-pdf">Salvar em PDF ou imprimir</button>
    <button class="btn largo nao-imprimir" id="rel-excel">Exportar para Excel</button>
    ${botaoWhats('', textoRelatorio(p, d), 'Compartilhar resumo pelo WhatsApp')}`;
  render('Relatórios', html);
  $('#rel-pdf').onclick = () => window.print();
  $('#rel-excel').onclick = () => salvarArquivo(`relatorio-${tipo}-${p.ini}.csv`, csvRelatorio(d), 'text/csv', ok => { if (ok) toast('Planilha exportada'); });
}

/* ---------- Mais (dados do personal, Pix, senha, licença, backup) ---------- */

function exportarBackup(aoTerminar) {
  const texto = JSON.stringify({ app: APP_ID, versao: VERSAO_APP, exportadoEm: new Date().toISOString(), dados: db });
  salvarArquivo(`personal-trainer-backup-${hoje()}.json`, texto, 'application/json', ok => {
    if (!ok) return;
    db.config.ultimoBackup = hoje();
    salvar();
    toast('Backup exportado');
    aoTerminar?.();
  });
}

function telaConfig() {
  const c = db.config;
  const html = `<div class="cartao">
      <h3>Sua marca</h3>
      <div class="perfil"><img class="avatar" src="${logoMarca()}" alt="">
        <div class="cresce"><b>${esc(nomeMarca())}</b><div class="sub">Logo e nome que aparecem no topo do app e nos relatórios.</div></div></div>
      <button class="btn largo" id="mudar-marca">Mudar logo e nome</button>
    </div>
    <form id="form-config" class="cartao">
      <h3>Seus dados</h3>
      ${campo('Seu nome', 'personal', c.personal, 'text', 'placeholder="Aparece no fim das mensagens e relatórios"')}
      ${campoTexto('Serviços que você oferece (um por linha)', 'servicos', c.servicos.join('\n'), 4)}
      <h3 style="margin-top:20px">Sua chave Pix</h3>
      ${campoSelect('Tipo da chave', 'pixTipo', Object.entries(TIPOS_CHAVE), c.pixTipo)}
      ${campo('Chave Pix', 'pixChave', c.pixChave, 'text', 'autocomplete="off" autocapitalize="off" spellcheck="false"')}
      ${campo('Nome de quem recebe (como está no banco)', 'pixNome', c.pixNome, 'text', 'maxlength="25" autocomplete="off"')}
      ${campo('Cidade', 'pixCidade', c.pixCidade, 'text', 'maxlength="15" autocomplete="off"')}
      ${campoTexto('Mensagem da cobrança', 'mensagem', c.mensagem, 4)}
      <p class="legenda">O app troca {nome}, {referencia}, {valor} e {vencimento} pelos dados de cada cobrança. Nada é enviado sozinho: você sempre toca no botão.</p>
      <h3 style="margin-top:20px">Senha para abrir o app</h3>
      ${campo('Senha de 4 números (vazio = sem senha)', 'senha', c.senha, 'password', 'inputmode="numeric" maxlength="4" autocomplete="off"')}
      <p class="legenda">Impede que um curioso abra o app. Anote a senha: se esquecer, não há como recuperar sem apagar os dados.</p>
      <button class="btn primario largo" type="submit">Salvar</button>
      <button class="btn largo" type="button" id="testar-pix">Testar minha chave Pix (R$ 0,01)</button>
    </form>
    <div class="cartao" id="cartao-licenca">
      <h3>Licença de uso</h3>
      <p>${licenca.liberado ? 'Liberado' : 'Período de teste'} até <b>${fimDaLicenca()}</b>
        (faltam ${tempoDeLicenca()}).</p>
      ${caixaCodigo()}
      <p class="legenda">Para renovar, envie o código do aparelho à EG Gamer X e cole aqui o código de liberação recebido.</p>
    </div>
    <div class="cartao">
      <h3>Backup</h3>
      <p>Seus dados ficam guardados <b>somente neste aparelho</b>. Se o celular quebrar, for trocado ou o app for
      apagado, eles se perdem. Exporte um backup de vez em quando e guarde no WhatsApp, e-mail, iCloud ou Google Drive.</p>
      <p class="sub">Último backup: ${c.ultimoBackup ? fmtData(c.ultimoBackup) : 'nunca'}</p>
      <div class="linha-botoes"><button class="btn primario" id="exportar">Exportar backup</button>
        <button class="btn" id="importar">Restaurar</button></div>
    </div>
    <div class="cartao">
      <h3>Dados</h3>
      <p class="sub">${plural(db.alunos.length, 'aluno', 'alunos')} · ${plural(db.fichas.length, 'ficha', 'fichas')} · ${plural(cobrancasValidas().length, 'cobrança', 'cobranças')} · ${plural(db.despesas.length, 'despesa', 'despesas')}${db.exemplo ? ' · <b>dados de exemplo</b>' : ''}</p>
      <div class="linha-botoes">
        ${db.alunos.length ? '' : '<button class="btn" id="exemplo">Carregar dados de exemplo</button>'}
        <button class="btn perigo-texto" id="apagar">Apagar todos os dados</button>
      </div>
    </div>
    <div class="cartao sobre">
      <img class="logo-sobre" src="logo.webp" alt="Logo EG Gamer X">
      <p><b>${NOME_APP}</b> · versão ${VERSAO_APP}</p>
      <p>Desenvolvido por <b>EG Gamer X</b></p>
      <p class="sub">Funciona offline. Nenhum dado sai do aparelho: só o WhatsApp abre quando você toca em enviar.</p>
    </div>`;
  render('Mais', html);

  const guardar = () => {
    const d = lerForm($('#form-config'));
    if (d.senha && !/^\d{4}$/.test(d.senha)) { toast('A senha precisa ter exatamente 4 números'); return false; }
    Object.assign(c, d, { servicos: linhas(d.servicos).length ? linhas(d.servicos) : [...SERVICOS_PADRAO], mensagem: d.mensagem || MSG_PADRAO });
    salvar();
    return true;
  };
  $('#form-config').onsubmit = e => {
    e.preventDefault();
    if (!guardar()) return;
    toast(problemaNaChave() || 'Dados salvos');
    rotear();
  };
  $('#testar-pix').onclick = () => {
    if (!guardar()) return;
    if (!pixPronto()) { toast('Preencha a chave Pix, o nome e a cidade'); return; }
    const codigo = pixCopiaECola(0.01);
    const m = abrirModal('Teste da chave Pix', `${problemaNaChave() ? `<p class="ruim">${esc(problemaNaChave())}</p>` : ''}
      <p>Abra o app do seu banco em <b>outro celular</b> e leia este QR Code (ou copie o código). Confira se aparece
      <b>o seu nome</b> como recebedor e o valor de R$ 0,01. Não precisa pagar.</p>
      <canvas class="qr" id="teste-qr"></canvas>
      <button class="btn largo" id="teste-copiar">Copiar código Pix</button>`, [{ texto: 'Fechar' }]);
    qrDesenhar($('#teste-qr', m), codigo);
    $('#teste-copiar', m).onclick = () => copiar(codigo, 'Código Pix copiado');
  };
  $('#mudar-marca').onclick = modalMarca;
  ligarCaixaCodigo($('#cartao-licenca'));
  $('#exportar').onclick = () => exportarBackup(() => { if (location.hash === '#/config') rotear(); });
  $('#importar').onclick = () => abrirArquivo(texto => {
    let obj;
    try { obj = JSON.parse(texto); } catch { toast('Arquivo inválido'); return; }
    const dados = obj?.dados || obj;
    if (obj?.app !== 'personal-trainer' || !Array.isArray(dados?.alunos) || !dados.config) { toast('Este arquivo não é um backup do Personal Trainer'); return; }
    const quando = obj.exportadoEm ? ` de ${fmtData(isoLocal(new Date(obj.exportadoEm)))}` : '';
    confirmar(`Restaurar o backup${quando} com ${plural(dados.alunos.length, 'aluno', 'alunos')}? Os dados atuais deste aparelho serão substituídos.`,
      'Restaurar', () => {
        db = normalizar(dados);
        salvar();
        toast('Backup restaurado');
        ir('#/');
      }, false);
  });
  $('#exemplo')?.addEventListener('click', carregarExemplo);
  $('#apagar').onclick = () => abrirModal('Apagar todos os dados',
    `<p>Isso apaga <b>todos</b> os alunos, fichas, observações, evolução, cobranças, pagamentos e despesas deste aparelho.
     Exporte um backup antes se quiser guardar.</p>${campo('Digite APAGAR para confirmar', 'conf', '', 'text', 'autocomplete="off"')}`,
    [{ texto: 'Cancelar' }, {
      texto: 'Apagar tudo', classe: 'perigo', acao: m => {
        if (lerForm(m).conf.toUpperCase() !== 'APAGAR') { toast('Digite APAGAR para confirmar'); return false; }
        db = bancoVazio();
        salvar();
        toast('Dados apagados');
        ir('#/');
      },
    }]);
}

// Tela de senha na abertura do app (só se o personal cadastrou uma senha em "Mais").
function travar() {
  if (!db.config.senha) return;
  const t = document.createElement('div');
  t.id = 'trava';
  t.innerHTML = `<img class="logo-sobre" src="logo.webp" alt=""><h2>${NOME_APP}</h2><p class="sub">Digite sua senha</p>
    <input type="password" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="Senha">`;
  document.body.appendChild(t);
  const i = $('input', t);
  i.focus();
  i.oninput = () => {
    if (i.value.length < 4) return;
    if (i.value === db.config.senha) t.remove(); else { i.value = ''; toast('Senha incorreta'); }
  };
}

/* ---------- Dados de exemplo (fictícios, só para demonstração) ---------- */

function carregarExemplo() {
  const h = hoje();
  db.exemplo = true;
  const novoAluno = (nome, objetivo, horarios, servico, tipo, valor, desde) => {
    const a = { id: novoId(), status: 'ativo', nome, whatsapp: '', objetivo, horarios, servico, nascimento: '', inicio: somaDias(h, -120), plano: { tipo, valor, desde } };
    db.alunos.push(a);
    return a;
  };
  const ex = (nome, series, reps, carga, dificuldade, obs = '') => ({ id: novoId(), nome, series, reps, carga, descanso: '60s', dificuldade, obs });
  const carga = (a, exercicio, lista) => lista.forEach(([dias, kg]) =>
    db.cargas.push({ id: novoId(), alunoId: a.id, exercicio, data: somaDias(h, -dias), carga: kg }));

  const bruna = novoAluno('Bruna Carvalho (exemplo)', 'Emagrecer e fortalecer', 'seg, qua e sex às 7h', 'Personal presencial', 'mensal', 280, somaDias(h, -64));
  const diego = novoAluno('Diego Martins (exemplo)', 'Ganhar massa', 'ter e qui às 19h', 'Personal presencial', 'mensal', 320, somaDias(h, -57));
  const marta = novoAluno('Marta Nogueira (exemplo)', 'Qualidade de vida', 'sáb às 9h', 'Aula em dupla', 'semanal', 70, somaDias(h, -30));
  const paulo = novoAluno('Paulo Reis (exemplo)', 'Correr 10 km', 'online', 'Consultoria online', 'mensal', 150, somaDias(h, -85));

  db.fichas.push(
    { id: novoId(), alunoId: bruna.id, nome: 'Treino A', nivel: 'Iniciante', obs: 'Pernas e glúteos. Aquecer 10 min na esteira.', exercicios: [
      ex('Agachamento livre', '3', '12', 30, 'moderado'), ex('Leg press', '3', '12', 80, 'facil'),
      ex('Cadeira extensora', '3', '15', 25, 'dificil', 'Parar se o joelho doer'), ex('Prancha', '3', '30s', null, 'moderado')] },
    { id: novoId(), alunoId: bruna.id, nome: 'Treino B', nivel: 'Iniciante', obs: 'Braços e costas.', exercicios: [
      ex('Puxada frontal', '3', '12', 35, 'moderado'), ex('Rosca direta', '3', '12', 8, 'moderado')] },
    { id: novoId(), alunoId: diego.id, nome: 'Treino A', nivel: 'Intermediário', obs: 'Peito e tríceps.', exercicios: [
      ex('Supino reto', '4', '8-10', 60, 'dificil'), ex('Supino inclinado com halteres', '3', '10', 22, 'moderado'),
      ex('Tríceps na polia', '3', '12', 30, 'facil')] },
    { id: novoId(), alunoId: marta.id, nome: 'Treino único', nivel: 'Iniciante', obs: '', exercicios: [
      ex('Remada baixa', '3', '12', 20, 'moderado'), ex('Elevação pélvica', '3', '15', 15, 'facil')] },
  );

  carga(bruna, 'Agachamento livre', [[90, 20], [50, 25], [10, 30]]);
  carga(bruna, 'Leg press', [[90, 60], [45, 70], [7, 80]]);
  carga(bruna, 'Cadeira extensora', [[60, 25]]);
  carga(bruna, 'Puxada frontal', [[70, 30], [14, 35]]);
  carga(bruna, 'Rosca direta', [[80, 8]]);
  carga(diego, 'Supino reto', [[80, 50], [40, 60], [12, 60]]);
  carga(diego, 'Supino inclinado com halteres', [[60, 18], [9, 22]]);
  carga(diego, 'Tríceps na polia', [[60, 32], [20, 30]]);
  carga(marta, 'Remada baixa', [[20, 15], [6, 20]]);
  carga(marta, 'Elevação pélvica', [[20, 15]]);

  db.obs.push(
    { id: novoId(), alunoId: bruna.id, tipo: 'Lesão', local: 'joelho direito', data: somaDias(h, -75), ativa: true, texto: 'Condromalácia. Evitar agachamento profundo e impacto.' },
    { id: novoId(), alunoId: marta.id, tipo: 'Restrição médica', local: 'coluna lombar', data: somaDias(h, -30), ativa: true, texto: 'Hérnia de disco. Sem carga na coluna; liberada para fortalecimento leve.' },
    { id: novoId(), alunoId: diego.id, tipo: 'Fratura', local: 'punho esquerdo', data: somaDias(h, -400), ativa: false, texto: 'Fratura antiga, totalmente recuperado.' },
  );
  db.registros.push(
    { id: novoId(), alunoId: bruna.id, tipo: 'melhora', area: 'Resistência', data: somaDias(h, -8), texto: 'Fez 20 min de esteira sem parar. Perdeu 3 kg desde o início.' },
    { id: novoId(), alunoId: bruna.id, tipo: 'parado', area: 'Flexibilidade', data: somaDias(h, -15), texto: 'Ainda não alcança os pés no alongamento.' },
    { id: novoId(), alunoId: diego.id, tipo: 'parado', area: 'Frequência', data: somaDias(h, -5), texto: 'Faltou 3 treinos no mês.' },
  );

  garantirCobrancas();
  // Cobranças antigas já pagas (em formas diferentes), uma paga pela metade e as mais recentes em aberto.
  db.cobrancas.filter(c => c.venc < somaDias(h, -6)).forEach((c, i) => {
    c.pagamentos.push({ id: novoId(), data: somaDias(c.venc, i % 3), valor: c.valor, forma: FORMAS[i % 3 === 2 ? 1 : 0], obs: '' });
  });
  const aberta = db.cobrancas.find(c => c.alunoId === diego.id && !c.pagamentos.length);
  if (aberta) aberta.pagamentos.push({ id: novoId(), data: somaDias(h, -1), valor: 120, forma: 'Dinheiro', obs: 'Pagou uma parte' });
  db.despesas.push(
    { id: novoId(), data: somaDias(h, -3), valor: 180, categoria: 'Aluguel de espaço', descricao: 'Taxa da academia' },
    { id: novoId(), data: somaDias(h, -10), valor: 65.5, categoria: 'Transporte', descricao: 'Combustível' },
    { id: novoId(), data: somaDias(h, -40), valor: 240, categoria: 'Equipamentos', descricao: 'Elásticos e colchonete' },
  );
  salvar();
  toast('Dados de exemplo carregados');
  ir('#/');
}

/* ---------- Partida ---------- */

$('#btn-voltar').onclick = () => location.replace('#' + (rotaPai || '/'));
$('#marca').onclick = modalMarca;
window.addEventListener('hashchange', rotear);
// Com o app aberto e parado na mesma tela, o bloqueio entra sozinho quando o tempo acaba.
setInterval(() => { if (!$('#bloqueio') && situacaoLicenca() !== 'ok') conferirLicenca(); }, 20000);
rotear();
travar();
