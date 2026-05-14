// ============================================================
// CARRINHO DE COMPRAS
// ============================================================

export const carrinho = {
  itens: [],

  adicionar(prato) {
    const existente = this.itens.find(i => i.id === prato.id);
    if (existente) {
      existente.quantidade++;
    } else {
      this.itens.push({ ...prato, quantidade: 1 });
    }
    this.salvar();
    this.atualizar();
  },

  remover(id) {
    const idx = this.itens.findIndex(i => i.id === id);
    if (idx === -1) return;
    if (this.itens[idx].quantidade > 1) {
      this.itens[idx].quantidade--;
    } else {
      this.itens.splice(idx, 1);
    }
    this.salvar();
    this.atualizar();
  },

  total() {
    return this.itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  },

  totalFormatado() {
    return this.total().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  quantidade() {
    return this.itens.reduce((s, i) => s + i.quantidade, 0);
  },

  salvar() {
    localStorage.setItem('carrinho', JSON.stringify(this.itens));
  },

  carregar() {
    const salvo = localStorage.getItem('carrinho');
    this.itens = salvo ? JSON.parse(salvo) : [];
    this.atualizar();
  },

  limpar() {
    this.itens = [];
    this.salvar();
    this.atualizar();
  },

  // Monta texto para WhatsApp com o pedido completo
  textoWhatsApp(telefone, endereco) {
    const linhas = this.itens.map(i =>
      `• ${i.quantidade}x ${i.nome} — ${(i.preco * i.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    );
    const texto = [
      '🍽️ *Novo Pedido – Hélo Gourmet*',
      '',
      ...linhas,
      '',
      `*Total: ${this.totalFormatado()}*`,
      '',
      endereco ? `📍 Endereço de entrega: ${endereco}` : '',
      '',
      'Aguardo confirmação! 😊'
    ].filter(l => l !== undefined).join('\n');

    return `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;
  },

  atualizar() {
    // Atualiza badge do carrinho
    const badge = document.getElementById('carrinho-badge');
    if (badge) {
      const qtd = this.quantidade();
      badge.textContent = qtd;
      badge.style.display = qtd > 0 ? 'flex' : 'none';
    }
    // Atualiza total no drawer
    const totalEl = document.getElementById('carrinho-total');
    if (totalEl) totalEl.textContent = this.totalFormatado();
    // Re-renderiza lista do drawer
    this.renderizarDrawer();
  },

  renderizarDrawer() {
    const lista = document.getElementById('carrinho-lista');
    if (!lista) return;

    if (this.itens.length === 0) {
      lista.innerHTML = '<p class="carrinho-vazio">Seu carrinho está vazio.</p>';
      return;
    }

    lista.innerHTML = this.itens.map(item => `
      <div class="carrinho-item">
        <div class="carrinho-item-info">
          <span class="carrinho-item-nome">${item.nome}</span>
          <span class="carrinho-item-preco">${(item.preco * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        <div class="carrinho-item-controles">
          <button onclick="window.carrinhoRemover('${item.id}')" aria-label="Remover um ${item.nome}">−</button>
          <span>${item.quantidade}</span>
          <button onclick="window.carrinhoAdicionar(${JSON.stringify(item).replace(/"/g, '&quot;')})" aria-label="Adicionar um ${item.nome}">+</button>
        </div>
      </div>
    `).join('');
  }
};
