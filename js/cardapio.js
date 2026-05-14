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

// ── Aplica config no site (telefone WhatsApp, endereço, horários)
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
  }
  // Subtítulo
  if (config.subtitulo) {
    document.querySelectorAll('.subtitulo-restaurante').forEach(el => el.textContent = config.subtitulo);
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

  // Botão finalizar via Mercado Pago
  document.getElementById('btn-pagar-online')?.addEventListener('click', async () => {
    if (carrinho.itens.length === 0) {
      alert('Adicione pelo menos um prato ao carrinho.');
      return;
    }
    const btn = document.getElementById('btn-pagar-online');
    btn.disabled = true;
    btn.textContent = 'Aguarde...';

    try {
      // Chama o backend (Render) para criar preferência de pagamento
      const resp = await fetch(`${window._backendUrl}/criar-pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: carrinho.itens,
          total: carrinho.total()
        })
      });
      const data = await resp.json();
      if (data.init_point) {
        window.location.href = data.init_point; // redireciona para MP
      } else {
        throw new Error('Link de pagamento não gerado');
      }
    } catch (e) {
      alert('Erro ao iniciar pagamento. Tente pelo WhatsApp.');
      console.error(e);
    } finally {
      btn.disabled = false;
      btn.textContent = '💳 Pagar Online';
    }
  });
});
