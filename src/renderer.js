const tabs = document.querySelectorAll(".tab");

function showTab(id) {
  tabs.forEach(t => t.style.display = "none");
  document.getElementById(id).style.display = "block";
}

showTab("pedido");

async function loadMotoboys() {
  const motoboys = await window.api.getMotoboys();
  const select = document.getElementById("motoboySelect");
  const list = document.getElementById("motoboyList");
  select.innerHTML = "";
  list.innerHTML = "";
  motoboys.forEach(m => {
    select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    list.innerHTML += `<li>${m.name}</li>`;
  });
}

async function addMotoboy() {
  const name = document.getElementById("motoboyName").value;
  await window.api.addMotoboy(name);
  loadMotoboys();
}

async function addOrder() {
  await window.api.addOrder({
    orderNumber: document.getElementById("orderNumber").value,
    payment: document.getElementById("payment").value,
    motoboyId: document.getElementById("motoboySelect").value
  });
  alert("Pedido salvo!");
}

async function loadOrders() {
  const date = document.getElementById("datePicker").value;
  const orders = await window.api.getOrdersByDate(date);
  const table = document.getElementById("ordersTable");
  table.innerHTML = "<tr><th>Pedido</th><th>Plataforma</th><th>Pagamento</th><th>Moto Boy</th><th>Hora</th></tr>";
  orders.forEach(o => {
    table.innerHTML += `
      <tr>
        <td>${o.order_number}</td>
        <td>${o.platform}</td>
        <td>${o.payment}</td>
        <td>${o.name}</td>
        <td>${new Date(o.datetime).toLocaleTimeString()}</td>
      </tr>
    `;
  });
}

async function loadReport() {
  const date = document.getElementById("reportDate").value;
  const data = await window.api.dailyReport(date);
  const list = document.getElementById("reportList");
  list.innerHTML = "";
  data.forEach(r => {
    list.innerHTML += `<li>${r.name}: ${r.total} pedidos</li>`;
  });
}

loadMotoboys();
// Modal de confirmação (Promise)
// Uso: const ok = await confirmarExclusao({ titulo, mensagem, okText, danger:true })
function confirmarExclusao(opts = {}) {
  const overlay = document.getElementById("confirmOverlay");
  const titleEl = document.getElementById("confirmTitle");
  const msgEl = document.getElementById("confirmMessage");
  const okBtn = document.getElementById("confirmOkBtn");
  const cancelBtn = document.getElementById("confirmCancelBtn");
  const iconEl = document.getElementById("confirmIcon");

  const {
    titulo = "Confirmar exclusão",
    mensagem = "Tem certeza que deseja apagar?",
    okText = "Apagar",
    cancelText = "Cancelar",
    danger = true
  } = opts;

  titleEl.textContent = titulo;
  msgEl.textContent = mensagem;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;

  // visual “danger”
  if (danger) {
    okBtn.classList.add("btn-danger");
    iconEl.style.color = "#ff5f56";
    iconEl.style.borderColor = "rgba(255, 95, 86, .28)";
    iconEl.style.background = "rgba(255, 95, 86, .14)";
    iconEl.textContent = "!";
  } else {
    okBtn.classList.remove("btn-danger");
    iconEl.textContent = "i";
  }

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKey);
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    const onOverlay = (e) => {
      if (e.target === overlay) onCancel(); // clicou fora fecha
    };

    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onOk();
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKey);

    // foco no botão cancelar pra evitar "Enter" apagar sem querer
    setTimeout(() => cancelBtn.focus(), 0);
  });
}

