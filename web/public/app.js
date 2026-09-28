'use strict';

// The frontend talks only to the App Router (same origin). The session
// cookie is sent automatically; the App Router injects the JWT into the
// /api/** calls. The browser never handles the token itself.

const form = document.getElementById('item-form');
const payloadInput = document.getElementById('payload');
const submitBtn = document.getElementById('submit-btn');
const refreshBtn = document.getElementById('refresh-btn');
const formMessage = document.getElementById('form-message');
const listMessage = document.getElementById('list-message');
const itemsList = document.getElementById('items');

function setMessage(el, text, type) {
  el.textContent = text;
  el.className = 'message' + (type ? ' ' + type : '');
}

// Accept either raw text or JSON. If it parses as JSON, store the parsed
// value; otherwise store the string as-is.
function parsePayload(raw) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function formatValue(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

async function loadItems() {
  setMessage(listMessage, 'Carregando...', null);
  try {
    const res = await fetch('/api/items', { headers: { accept: 'application/json' } });
    if (res.status === 401 || res.status === 403) {
      setMessage(listMessage, 'Sessão expirada. Recarregue a página para entrar novamente.', 'error');
      return;
    }
    if (!res.ok) {
      setMessage(listMessage, `Erro ao carregar (HTTP ${res.status}).`, 'error');
      return;
    }
    const items = await res.json();
    renderItems(items);
    setMessage(listMessage, '', null);
  } catch (err) {
    setMessage(listMessage, 'Falha de rede ao carregar os dados.', 'error');
  }
}

function renderItems(items) {
  itemsList.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nenhum dado gravado ainda.';
    itemsList.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    const when = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '';
    meta.textContent = `#${item.id}${when ? ' · ' + when : ''}`;

    const pre = document.createElement('pre');
    pre.textContent = formatValue(item.payload);

    li.appendChild(meta);
    li.appendChild(pre);
    itemsList.appendChild(li);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const raw = payloadInput.value;
  if (!raw.trim()) {
    setMessage(formMessage, 'Digite algum dado.', 'error');
    return;
  }

  submitBtn.disabled = true;
  setMessage(formMessage, 'Salvando...', null);

  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsePayload(raw)),
    });
    if (res.status === 401 || res.status === 403) {
      setMessage(formMessage, 'Sessão expirada. Recarregue a página.', 'error');
      return;
    }
    if (!res.ok) {
      setMessage(formMessage, `Erro ao salvar (HTTP ${res.status}).`, 'error');
      return;
    }
    payloadInput.value = '';
    setMessage(formMessage, 'Dado gravado no HANA.', 'success');
    await loadItems();
  } catch (err) {
    setMessage(formMessage, 'Falha de rede ao salvar.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

refreshBtn.addEventListener('click', loadItems);

// Initial load.
loadItems();
