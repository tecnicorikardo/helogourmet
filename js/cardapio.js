// ============================================================
// CARDÁPIO — carrega pratos e config do Firestore
// ============================================================
import { db } from './firebase.js';
import {
  collection, getDocs, doc, getDoc, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { carrinho } from './carrinho.js';

// Expõe funções do carrinho globalmente para uso nos botões inline
window.carrinhoAdicionar = (prato) => carrinho.adicionar(prato);
window.carrinhoRemover = (id) => carrinho.remover(id);

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

    const pratos = [];
    snapshot.forEach(docSnap => {
      const prato = docSnap.data();
      if (prato.ativo !== false) { // mostra todos exceto os marcados como inativos
        pratos.push(criarCardPrato(docSnap.id, prato));
      }
    });

    grid.innerHTML = pratos.length > 0
      ? pratos.join('')
      : '<p class="sem-pratos">Nenhum prato disponível no momento.</p>';
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
    const tel = window._telefoneWpp || '5500000000000';
    window.open(carrinho.textoWhatsApp(tel, endereco), '_blank');
  });

  // Botão finalizar via Mercado Pago (Checkout Pro com Pix preferencial)
  document.getElementById('btn-pagar-online')?.addEventListener('click', async () => {
    if (carrinho.itens.length === 0) {
      alert('Adicione pelo menos um prato ao carrinho.');
      return;
    }
    const btn = document.getElementById('btn-pagar-online');
    btn.disabled = true;
    btn.textContent = '⏳ Conectando...';

    const backendUrl = window._backendUrl || 'https://helogourmet-backend.onrender.com';

    // Acorda o backend se estiver dormindo
    try {
      await fetch(`${backendUrl}/`, { signal: AbortSignal.timeout(60000) });
    } catch(e) { /* ignora */ }

    btn.textContent = '🔄 Gerando link...';

    try {
      const resp = await fetch(`${backendUrl}/criar-pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: carrinho.itens,
          total: carrinho.total()
        }),
        signal: AbortSignal.timeout(60000)
      });

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
      const msg = e.name === 'TimeoutError'
        ? 'Servidor demorou para responder. Aguarde 1 minuto e tente novamente.'
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
      const backendUrl = window._backendUrl || 'https://helogourmet-backend.onrender.com';
      const resp = await fetch(`${backendUrl}/status-pix/${txid}`);
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
