'use strict';
/* Gerador de QR Code (modo bytes, correção de erro nível M) — funciona offline, sem bibliotecas.
   qrGerar(texto) devolve uma matriz quadrada de true/false (true = quadradinho preto). */

const QR_ECC_POR_BLOCO = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const QR_BLOCOS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

function qrModulosBrutos(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
function qrCodewordsDeDados(ver) {
  return Math.floor(qrModulosBrutos(ver) / 8) - QR_ECC_POR_BLOCO[ver] * QR_BLOCOS[ver];
}

// Aritmética de Reed-Solomon no corpo GF(2^8), polinômio 0x11D.
function qrMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function qrDivisor(grau) {
  const r = new Array(grau).fill(0);
  r[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < grau; j++) {
      r[j] = qrMul(r[j], raiz);
      if (j + 1 < grau) r[j] ^= r[j + 1];
    }
    raiz = qrMul(raiz, 2);
  }
  return r;
}
function qrResto(dados, divisor) {
  const r = divisor.map(() => 0);
  for (const b of dados) {
    const fator = b ^ r.shift();
    r.push(0);
    divisor.forEach((coef, i) => { r[i] ^= qrMul(coef, fator); });
  }
  return r;
}

function qrComCorrecao(dados, ver) {
  const nBlocos = QR_BLOCOS[ver], eccLen = QR_ECC_POR_BLOCO[ver];
  const total = Math.floor(qrModulosBrutos(ver) / 8);
  const nCurtos = nBlocos - total % nBlocos;
  const lenCurto = Math.floor(total / nBlocos);
  const divisor = qrDivisor(eccLen);
  const blocos = [];
  for (let i = 0, k = 0; i < nBlocos; i++) {
    const dat = dados.slice(k, k + lenCurto - eccLen + (i < nCurtos ? 0 : 1));
    k += dat.length;
    const ecc = qrResto(dat, divisor);
    if (i < nCurtos) dat.push(0);
    blocos.push(dat.concat(ecc));
  }
  const saida = [];
  for (let i = 0; i < blocos[0].length; i++) {
    blocos.forEach((bloco, j) => {
      // Pula o byte de enchimento dos blocos curtos.
      if (i !== lenCurto - eccLen || j >= nCurtos) saida.push(bloco[i]);
    });
  }
  return saida;
}

function qrGerar(texto) {
  const bytes = [...new TextEncoder().encode(texto)];
  let ver = 1;
  for (; ; ver++) {
    if (ver > 40) throw new Error('Texto grande demais para um QR Code');
    if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= qrCodewordsDeDados(ver) * 8) break;
  }
  const capacidade = qrCodewordsDeDados(ver) * 8;

  const bits = [];
  const poe = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  poe(4, 4);
  poe(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(b => poe(b, 8));
  poe(0, Math.min(4, capacidade - bits.length));
  poe(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < capacidade; pad ^= 0xEC ^ 0x11) poe(pad, 8);
  const dados = [];
  for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  const codewords = qrComCorrecao(dados, ver);

  const n = ver * 4 + 17;
  const mod = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixo = Array.from({ length: n }, () => new Array(n).fill(false));
  const fx = (x, y, preto) => { mod[y][x] = preto; fixo[y][x] = true; };

  function formato(mascara) {
    const d = mascara;   // nível M = 0 nos dois bits de cima
    let resto = d;
    for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
    const b = ((d << 10) | resto) ^ 0x5412;
    const bit = i => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) fx(8, i, bit(i));
    fx(8, 7, bit(6)); fx(8, 8, bit(7)); fx(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fx(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fx(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fx(8, n - 15 + i, bit(i));
    fx(8, n - 8, true);
  }

  // Linhas de sincronismo, três "olhos", marcas de alinhamento, formato e versão.
  for (let i = 0; i < n; i++) { fx(6, i, i % 2 === 0); fx(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < n && y >= 0 && y < n) fx(x, y, dist !== 2 && dist !== 4);
    }
  }
  const alinh = [];
  if (ver > 1) {
    const q = Math.floor(ver / 7) + 2;
    const passo = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (q * 2 - 2)) * 2;
    alinh.push(6);
    for (let pos = n - 7; alinh.length < q; pos -= passo) alinh.splice(1, 0, pos);
  }
  const u = alinh.length - 1;
  alinh.forEach((ax, i) => alinh.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === u) || (i === u && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      fx(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  formato(0);
  if (ver >= 7) {
    let resto = ver;
    for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1F25);
    const b = (ver << 12) | resto;
    for (let i = 0; i < 18; i++) {
      const preto = ((b >>> i) & 1) !== 0, a = n - 11 + i % 3, c = Math.floor(i / 3);
      fx(a, c, preto); fx(c, a, preto);
    }
  }

  // Dados em ziguezague, de baixo para cima a partir do canto direito.
  let k = 0;
  for (let dir = n - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5;
    for (let v = 0; v < n; v++) for (let j = 0; j < 2; j++) {
      const x = dir - j, sobe = ((dir + 1) & 2) === 0, y = sobe ? n - 1 - v : v;
      if (!fixo[y][x] && k < codewords.length * 8) {
        mod[y][x] = ((codewords[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0;
        k++;
      }
    }
  }

  const MASCARAS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0,
  ];
  const mascarar = m => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      if (!fixo[y][x] && MASCARAS[m](x, y)) mod[y][x] = !mod[y][x];
  };
  // Nota de "legibilidade" de cada máscara: quanto menor, melhor.
  const penalidade = () => {
    let p = 0, pretos = 0;
    const linhas = [];
    for (let y = 0; y < n; y++) linhas.push(mod[y].map(v => (v ? 1 : 0)).join(''));
    for (let x = 0; x < n; x++) linhas.push(mod.map(l => (l[x] ? 1 : 0)).join(''));
    for (const l of linhas) {
      for (const seq of l.match(/0{5,}|1{5,}/g) || []) p += seq.length - 2;
      for (let i = l.indexOf('1011101'); i >= 0; i = l.indexOf('1011101', i + 1)) {
        if (l.slice(Math.max(0, i - 4), i) === '0000' || l.slice(i + 7, i + 11) === '0000') p += 40;
      }
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (mod[y][x]) pretos++;
      if (x + 1 < n && y + 1 < n && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
    }
    return p + Math.floor(Math.abs(pretos * 20 - n * n * 10) / (n * n)) * 10;
  };

  let melhor = 0, menor = Infinity;
  for (let m = 0; m < 8; m++) {
    mascarar(m); formato(m);
    const p = penalidade();
    if (p < menor) { menor = p; melhor = m; }
    mascarar(m);
  }
  mascarar(melhor); formato(melhor);
  return mod;
}

// Desenha o QR Code num <canvas>, com a margem branca exigida pelos leitores.
function qrDesenhar(canvas, texto, escala = 6, margem = 4) {
  const m = qrGerar(texto), n = m.length;
  canvas.width = canvas.height = (n + margem * 2) * escala;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    if (m[y][x]) g.fillRect((x + margem) * escala, (y + margem) * escala, escala, escala);
}
