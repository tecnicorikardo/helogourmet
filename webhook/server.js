// ============================================================
// BACKEND — Pix via Efí Bank + Webhook
// ============================================================
const express = require('express');
const cors = require('cors');
const https = require('https');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Firebase Admin
let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  console.log('Firebase Admin conectado.');
} catch (e) {
  console.warn('Firebase Admin não configurado:', e.message);
}

// ── Efí Bank config
const EFI_CLIENT_ID     = process.env.EFI_CLIENT_ID     || '';
const EFI_CLIENT_SECRET = process.env.EFI_CLIENT_SECRET || '';
const EFI_SANDBOX       = process.env.EFI_SANDBOX === 'true';
const EFI_BASE_HOST     = EFI_SANDBOX ? 'pix-h.api.efipay.com.br' : 'pix.api.efipay.com.br';
const EFI_REQUEST_TIMEOUT_MS = Number(process.env.EFI_REQUEST_TIMEOUT_MS || 30000);

console.log(`Efí Bank: ${EFI_SANDBOX ? 'SANDBOX' : 'PRODUCAO'} | ${EFI_BASE_HOST}`);
console.log(`Client ID: ${EFI_CLIENT_ID ? EFI_CLIENT_ID.slice(0,15) + '...' : 'NAO CONFIGURADO'}`);

// ── Certificado mTLS (base64 → buffer)
let efiCert = null;
if (process.env.EFI_CERT_BASE64) {
  efiCert = Buffer.from(process.env.EFI_CERT_BASE64, 'base64');
  console.log(`Certificado: ${efiCert.length} bytes`);
} else {
  console.warn('EFI_CERT_BASE64 nao configurado');
}

// ── Agent HTTPS com certificado
function makeAgent() {
  const opts = { keepAlive: true, rejectUnauthorized: false };
  if (efiCert) { opts.pfx = efiCert; opts.passphrase = ''; }
  return new https.Agent(opts);
}

const efiAgent = makeAgent();
let tokenCache = null;
let tokenExpiraEm = 0;

async function medirEtapa(nome, fn) {
  const inicio = Date.now();
  try {
    const resultado = await fn();
    console.log(`${nome}: ${Date.now() - inicio}ms`);
    return resultado;
  } catch (err) {
    console.error(`${nome} falhou apos ${Date.now() - inicio}ms:`, err?.message || err);
    throw err;
  }
}

// ── Requisição genérica para Efí Bank
function efiReq(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const opts = { hostname: EFI_BASE_HOST, path, method, headers, agent: efiAgent };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(EFI_REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Timeout Efí Bank em ${method} ${path}`));
    });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Obtém token OAuth
async function getToken() {
  if (tokenCache && Date.now() < tokenExpiraEm) return tokenCache;

  const creds = Buffer.from(`${EFI_CLIENT_ID}:${EFI_CLIENT_SECRET}`).toString('base64');
  const body = JSON.stringify({ grant_type: 'client_credentials' });
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    };
    const opts = { hostname: EFI_BASE_HOST, path: '/oauth/token', method: 'POST', headers, agent: efiAgent };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.access_token) {
            const expiresIn = Number(json.expires_in || 3600);
            tokenCache = json.access_token;
            tokenExpiraEm = Date.now() + Math.max(expiresIn - 60, 60) * 1000;
            resolve(tokenCache);
          } else {
            reject(new Error(json.error_description || JSON.stringify(json)));
          }
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(EFI_REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Timeout Efí Bank em POST /oauth/token'));
    });
    req.write(body);
    req.end();
  });
}

// ── Rota de saúde
app.get('/', (req, res) => res.json({ status: 'ok', servico: 'Helo Gourmet Backend', gateway: 'Efi Bank' }));

// ── Gerar QR Code Pix
app.post('/criar-pix', async (req, res) => {
  const inicioPix = Date.now();
  try {
    const { itens, total } = req.body;
    if (!itens || itens.length === 0) return res.status(400).json({ erro: 'Carrinho vazio.' });

    let pedidoId = 'sem-id';
    let pedidoRef = null;
    let salvarPedido = Promise.resolve();
    if (db) {
      pedidoRef = db.collection('pedidos').doc();
      pedidoId = pedidoRef.id;
      salvarPedido = medirEtapa('Firestore criar pedido', () => pedidoRef.set({
        itens, total, status: 'pendente', tipoPagamento: 'pix', criadoEm: Timestamp.now()
      }));
    }

    const descricao = itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ');
    const token = await medirEtapa('Efí token OAuth', async () => {
      const [tokenObtido] = await Promise.all([getToken(), salvarPedido]);
      return tokenObtido;
    });

    // Cria cobrança
    const cobBody = {
      calendario: { expiracao: 3600 },
      valor: { original: Number(total).toFixed(2) },
      chave: process.env.EFI_PIX_KEY || '',
      solicitacaoPagador: descricao.slice(0, 140),
      infoAdicionais: [{ nome: 'Pedido', valor: pedidoId }]
    };
    const cob = await medirEtapa('Efí criar cobrança', () => efiReq('POST', '/v2/cob', token, cobBody));
    if (cob.status !== 201) throw new Error(cob.body?.mensagem || JSON.stringify(cob.body));

    const txid = cob.body.txid;
    const locId = cob.body.loc?.id;

    // Gera QR Code
    let qrCode = '', qrCodeBase64 = '';
    if (locId) {
      const qr = await medirEtapa('Efí gerar QR Code', () => efiReq('GET', `/v2/loc/${locId}/qrcode`, token));
      qrCode = qr.body.qrcode || '';
      qrCodeBase64 = (qr.body.imagemQrcode || '').replace('data:image/png;base64,', '');
    }

    if (pedidoRef) {
      await medirEtapa('Firestore atualizar pedido', () => pedidoRef.update({ txid, locId }));
    }

    console.log(`Pix gerado pedido=${pedidoId} txid=${txid} total_ms=${Date.now() - inicioPix}`);
    res.json({ pedidoId, txid, qrCode, qrCodeBase64, status: cob.body.status });

  } catch (err) {
    console.error(`Erro Pix apos ${Date.now() - inicioPix}ms:`, err?.message || err);
    res.status(500).json({ erro: `Erro ao gerar Pix: ${err?.message || 'Erro desconhecido'}` });
  }
});

// ── Verificar status
app.get('/status-pix/:txid', async (req, res) => {
  try {
    const token = await getToken();
    const r = await efiReq('GET', `/v2/cob/${req.params.txid}`, token);
    res.json({ status: r.body.status === 'CONCLUIDA' ? 'approved' : 'pending', statusEfi: r.body.status });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao verificar status.' });
  }
});

// ── Webhook Efí (GET para validação)
app.get('/webhook', (req, res) => res.sendStatus(200));

// ── Webhook Efí (POST — pagamento confirmado)
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const pixes = req.body?.pix || [];
    for (const pix of pixes) {
      if (!pix.txid || !db) continue;
      const snap = await db.collection('pedidos').where('txid', '==', pix.txid).limit(1).get();
      if (snap.empty) continue;
      await snap.docs[0].ref.update({
        status: 'pago',
        pagamentoId: pix.endToEndId || pix.txid,
        atualizadoEm: Timestamp.now()
      });
      console.log(`Pix pago: ${pix.txid}`);
    }
  } catch (err) {
    console.error('Erro webhook:', err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
