// ============================================================
// CARDÁPIO — carrega pratos e config do Firestore
// ============================================================
import { db } from './firebase.js';
import {
  collection, getDocs, doc, getDoc, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { carrinho } from './carrinho.js';

const BACKEND_URL_PADRAO = 'https://helogourmet-backend.onrender.com';
const PIX_REQUEST_TIMEOUT_MS = 90000;
const BACKEND_WARMUP_TIMEOUT_MS = 12000;
const PIX_STATUS_TIMEOUT_MS = 15000;

// Expõe funções do carrinho globalmente para uso nos botões inline
window.carrinhoAdicionar = (prato) => carrinho.adicionar(prato);
window.carrinhoRemover = (id) => carrinho.remover(id);

function obterBackendUrl() {
  return (window._backendUrl || BACKEND_URL_PADRAO).replace(/\/+$/, '');
}

function fetchComTimeout(url, options = {}, timeoutMs = PIX_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

let backendAquecimentoIniciado = false;
function aquecerBackendPix() {
  if (backendAquecimentoIniciado) return;
  backendAquecimentoIniciado = true;

  fetchComTimeout(`${obterBackendUrl()}/`, {}, BACKEND_WARMUP_TIMEOUT_MS)
    .catch(() => {
      backendAquecimentoIniciado = false;
    });
}

// ── Carrega configurações do restaurante (telefone, endereço, etc.)
async function carregarConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'restaurante'));
    if (!snap.exists()) return {};
    return snap.data();
  } catch (e) {
    console.warn('Config não encontrada, usando padrões.');
    return {};
  }
}

// ── Aplica config no site (telefone WhatsApp, endereço, horários, hero)
function aplicarConfig(config) {
  // Telefone nos botões WhatsApp
  if (config.telefone) {
    window._telefoneWpp = config.telefone.replace(/\D/g, '');
  }
  // Endereço no rodapé
  const endEl = document.getElementById('rodape-endereco');
  if (endEl && config.endereco) endEl.innerHTML = config.endereco.replace(/\n/g, '<br/>');
  // Telefone no rodapé
  const telEl = document.getElementById('rodape-telefone');
  if (telEl && config.telefone) telEl.textContent = config.telefone;
  // Horários
  const horEl = document.getElementById('rodape-horarios');
  if (horEl && config.horarios) horEl.innerHTML = config.horarios.replace(/\n/g, '<br/>');
  // Nome do restaurante
  if (config.nome) {
    document.querySelectorAll('.nome-restaurante').forEach(el => el.textContent = config.nome);
    document.title = config.nome + ' | Cardápio Digital';
  }
  // Subtítulo header
  if (config.subtitulo) {
    document.querySelectorAll('.subtitulo-restaurante').forEach(el => el.textContent = config.subtitulo);
  }
  // ── HERO
  if (config.heroTitulo) {
    const el = document.getElementById('hero-titulo');
    if (el) el.innerHTML = config.heroTitulo;
  }
  if (config.heroSubtitulo) {
    const el = document.getElementById('hero-subtitulo');
    if (el) el.textContent = config.heroSubtitulo;
  }
  if (config.heroImagem) {
    const hero = document.getElementById('hero-section');
    if (hero) {
      hero.style.backgroundImage = `linear-gradient(rgba(26,58,42,0.72), rgba(26,58,42,0.72)), url('${config.heroImagem}')`;
    }
  }
  // Efeito hover nas imagens decorativas — controlado pelo admin
  if (config.efeitoImagens) {
    document.body.classList.add('efeito-ativo');
  } else {
    document.body.classList.remove('efeito-ativo');
  }
  if (config.instagram) {
    const el = document.getElementById('link-instagram');
    if (el) el.href = config.instagram;
  }
  if (config.backendUrl) {
    window._backendUrl = config.backendUrl;
  }
  // Fotos decorativas laterais
  const t1 = config.fotoDeco1Tamanho || (config.fotoDeco1 ? 180 : 0);
  const t2 = config.fotoDeco2Tamanho || (config.fotoDeco2 ? 180 : 0);

  if (config.fotoDeco1) {
    const el = document.getElementById('foto-deco-esquerda');
    if (el) {
      el.src = config.fotoDeco1;
      el.style.display = 'block';
      // Usa função global que respeita viewport
      if (window.aplicarTamanhoFoto) window.aplicarTamanhoFoto('foto-deco-esquerda', t1);
      else el.style.width = t1 + 'px';
    }
  }
  if (config.fotoDeco2) {
    const el = document.getElementById('foto-deco-direita');
    if (el) {
      el.src = config.fotoDeco2;
      el.style.display = 'block';
      if (window.aplicarTamanhoFoto) window.aplicarTamanhoFoto('foto-deco-direita', t2);
      else el.style.width = t2 + 'px';
    }
  }
}

// ── Renderiza um card de prato
function criarCardPrato(id, prato) {
  const preco = Number(prato.preco) || 0;
  const precoFormatado = preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pratoObj = JSON.stringify({ id, nome: prato.nome, preco }).replace(/"/g, '&quot;');

  return `
    <article class="card-prato destaque" id="prato-${id}">
      <div class="card-img-wrap">
        <img src="${prato.imagem || 'img/placeholder.svg'}"
             alt="${prato.nome} – Hélo Gourmet"
             loading="lazy"
             onerror="this.src='img/placeholder.svg'" />
        ${prato.destaque ? '<span class="badge-destaque">⭐ Destaque</span>' : ''}
      </div>
      <div class="card-corpo">
        <h3 class="card-nome">${prato.nome}</h3>
        <p class="card-desc">${prato.descricao || ''}</p>
        <div class="card-rodape">
          <span class="card-preco">${precoFormatado}</span>
          <div class="card-acoes">
            <button class="btn-adicionar" onclick="window.carrinhoAdicionar(${pratoObj})"
                    aria-label="Adicionar ${prato.nome} ao carrinho">
              🛒 Adicionar
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

// ── Carrega e renderiza pratos em tempo real (onSnapshot)
function carregarPratos() {
  const grid = document.getElementById('grid-pratos');
  if (!grid) return;

  grid.innerHTML = '<p class="carregando">Carregando cardápio...</p>';

  const q = query(collection(db, 'pratos'), orderBy('ordem', 'asc'));

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      grid.innerHTML = '<p class="sem-pratos">Cardápio em atualização. Volte em breve!</p>';
      return;
    }

    // Separa por categoria: pratos primeiro, sobremesas depois
    const pratos     = [];
    const sobremesas = [];
    const outros     = [];

    snapshot.forEach(docSnap => {
      const prato = docSnap.data();
      if (prato.ativo === false) return;
      const cat = (prato.categoria || 'prato').toLowerCase();
      const card = criarCardPrato(docSnap.id, prato);
      if (cat === 'sobremesa' || cat === 'sobremesas') sobremesas.push(card);
      else if (cat === 'bebida' || cat === 'bebidas') outros.push(card);
      else pratos.push(card);
    });

    let html = '';

    if (pratos.length > 0) {
      html += `<div class="categoria-titulo"><span>🍽️ Pratos</span></div>`;
      html += `<div class="grid-cards-inner">${pratos.join('')}</div>`;
    }
    if (sobremesas.length > 0) {
      html += `<div class="categoria-titulo"><span>🍮 Sobremesas</span></div>`;
      html += `<div class="grid-cards-inner">${sobremesas.join('')}</div>`;
    }
    if (outros.length > 0) {
      html += `<div class="categoria-titulo"><span>🥤 Bebidas</span></div>`;
      html += `<div class="grid-cards-inner">${outros.join('')}</div>`;
    }

    grid.innerHTML = html || '<p class="sem-pratos">Nenhum prato disponível no momento.</p>';
  }, (error) => {
    console.error('Erro ao carregar pratos:', error);
    grid.innerHTML = '<p class="erro-pratos">Erro ao carregar o cardápio. Tente novamente.</p>';
  });
}

// ── Inicializa tudo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  carrinho.carregar();

  const config = await carregarConfig();
  aplicarConfig(config);
  setTimeout(aquecerBackendPix, 800);

  carregarPratos();

  // Botão abrir/fechar carrinho drawer
  const btnCarrinho = document.getElementById('btn-carrinho');
  const drawer = document.getElementById('carrinho-drawer');
  const overlay = document.getElementById('carrinho-overlay');
  const btnFechar = document.getElementById('btn-fechar-carrinho');

  function abrirCarrinho() {
    drawer?.classList.add('aberto');
    overlay?.classList.add('visivel');
    document.body.style.overflow = 'hidden';
  }
  function fecharCarrinho() {
    drawer?.classList.remove('aberto');
    overlay?.classList.remove('visivel');
    document.body.style.overflow = '';
  }

  btnCarrinho?.addEventListener('click', abrirCarrinho);
  btnFechar?.addEventListener('click', fecharCarrinho);
  overlay?.addEventListener('click', fecharCarrinho);

  // Botão finalizar via WhatsApp
  document.getElementById('btn-whatsapp-pedido')?.addEventListener('click', () => {
    if (carrinho.itens.length === 0) {
      alert('Adicione pelo menos um prato ao carrinho.');
      return;
    }
    const endereco = document.getElementById('input-endereco')?.value || '';
    const tel = window._telefoneWpp || '5521976528124';
    window.open(carrinho.textoWhatsApp(tel, endereco), '_blank');
  });

  // Botão finalizar via Pix
  document.getElementById('btn-pagar-online')?.addEventListener('click', async () => {
    if (carrinho.itens.length === 0) {
      alert('Adicione pelo menos um prato ao carrinho.');
      return;
    }
    const btn = document.getElementById('btn-pagar-online');
    btn.disabled = true;
    btn.textContent = '🔄 Gerando Pix...';

    try {
      const resp = await fetchComTimeout(`${obterBackendUrl()}/criar-pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: carrinho.itens,
          total: carrinho.total()
        })
      }, PIX_REQUEST_TIMEOUT_MS);

      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Servidor indisponível (${resp.status}). Tente novamente.`);
      }

      const data = await resp.json();

      if (data.qrCode) {
        // Mostra área do Pix
        document.getElementById('pix-area').style.display = 'block';
        document.getElementById('pix-codigo').value = data.qrCode;
        if (data.qrCodeBase64) {
          document.getElementById('pix-qrcode-img').src =
            `data:image/png;base64,${data.qrCodeBase64}`;
        }
        btn.textContent = '🔄 Gerar novo Pix';
        btn.disabled = false;
        window._pixTxid    = data.txid;
        window._pixPedidoId = data.pedidoId;
        iniciarPollingPix(data.txid, data.pedidoId);
        // Rola para mostrar o QR Code
        setTimeout(() => {
          document.getElementById('pix-area')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 200);
      } else {
        throw new Error(data.erro || 'QR Code não gerado.');
      }
    } catch (e) {
      const msg = e.name === 'AbortError'
        ? 'Servidor demorou para responder. Tente novamente em alguns instantes.'
        : e.message || 'Erro ao iniciar pagamento.';
      alert(msg);
      console.error(e);
      btn.disabled = false;
      btn.textContent = '💳 Pagar Online';
    }
  });

  // Copiar código Pix
  document.getElementById('btn-copiar-pix')?.addEventListener('click', () => {
    const codigo = document.getElementById('pix-codigo').value;
    navigator.clipboard.writeText(codigo).then(() => {
      const btn = document.getElementById('btn-copiar-pix');
      btn.textContent = '✅ Copiado!';
      setTimeout(() => btn.textContent = '📋 Copiar código Pix', 2000);
    });
  });
});

// ── Polling: verifica status do Pix a cada 5 segundos
let _pollingTimer = null;
function iniciarPollingPix(txid, pedidoId) {
  if (_pollingTimer) clearInterval(_pollingTimer);
  const statusMsg = document.getElementById('pix-status-msg');
  let tentativas = 0;
  const maxTentativas = 72; // 6 minutos

  _pollingTimer = setInterval(async () => {
    tentativas++;
    if (tentativas > maxTentativas) {
      clearInterval(_pollingTimer);
      if (statusMsg) statusMsg.textContent = '⏰ Pix expirado. Gere um novo.';
      return;
    }
    try {
      const resp = await fetchComTimeout(`${obterBackendUrl()}/status-pix/${txid}`, {}, PIX_STATUS_TIMEOUT_MS);
      const data = await resp.json();
      if (data.status === 'approved') {
        clearInterval(_pollingTimer);
        if (statusMsg) statusMsg.textContent = '✅ Pix confirmado!';
        setTimeout(() => {
          window.location.href =
            `/sucesso.html?payment_id=${txid}&external_reference=${pedidoId}&collection_status=approved`;
        }, 1500);
      } else {
        if (statusMsg) statusMsg.textContent = `⏳ Aguardando pagamento... (${tentativas * 5}s)`;
      }
    } catch (e) {
      console.warn('Erro ao verificar Pix:', e);
    }
  }, 5000);
}
