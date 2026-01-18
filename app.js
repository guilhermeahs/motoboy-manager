import { UI } from "./js/ui.js";
import { Storage } from "./js/storage.js";
import { Auth } from "./js/auth.js";
import { License } from "./js/license.js";
import { Motoboys } from "./js/motoboy.js";
import { Pedidos } from "./js/pedidos.js";

const App = {
  state: {
    ui: { dayFilter: "", seededMotoboys: false }, // YYYY-MM-DD
    user: null,
    license: { level: 0, key: "" },
    motoboys: [],
    pedidos: [],     // ativos
    historico: []    // finalizados
  },

  async init() {
    // Load
    this.state = Storage.loadAppState(this.state);

    // garante defaults novos
    if (typeof this.state.ui?.seededMotoboys !== "boolean") this.state.ui.seededMotoboys = true;

    // Auth
    this.state.user = Auth.getCurrentUser();

    // License
    this.state.license = License.getLicense();

    // Seed básico (só na 1a vez). Se o usuário apagar todos, não re-semeia.
    if (!this.state.ui.seededMotoboys && this.state.motoboys.length === 0) {
      this.state.motoboys = [
        { id: UI.uid(), name: "Motoboy 01", tag: "" },
        { id: UI.uid(), name: "Motoboy 02", tag: "" },
      ];
      this.state.ui.seededMotoboys = true;
    }

    // Migração: não existe mais "sem atribuição".
    // - Pedidos ativos sem motoboy (ou com motoboy inexistente) são APAGADOS.
    // - No histórico, apenas normaliza para "" quando o motoboy não existe mais.
    const ids = new Set(this.state.motoboys.map(m => m.id));

    this.state.pedidos = (this.state.pedidos || []).filter(p => {
      const id = String(p?.motoboyId ?? "").trim();
      if (!id || id === "ORPHAN") return false;
      return ids.has(id);
    });

    (this.state.historico || []).forEach(h => {
      const id = String(h?.motoboyId ?? "").trim();
      if (!id || id === "ORPHAN" || !ids.has(id)) h.motoboyId = "";
    });

    // filtro de dia padrão = hoje (se vazio)
    const today = UI.dayKey(new Date());
    if (!this.state.ui.dayFilter) this.state.ui.dayFilter = today;

    // Wire UI events
    this.bindTopbarButtons();
    this.bindNavigation();
    this.bindAuthTabs();
    this.bindAuthActions();
    this.bindConfigActions();
    this.bindMotoboysActions();
    this.bindOperacaoActions();
    this.bindHistoricoActions();

    // Render
    this.refreshAll();

    // Default view
    UI.showView("operacao");
    UI.toast("Pronto", "App carregado.", "ok");
  },

  persist() {
    Storage.saveAppState(this.state);
    this.refreshBadges();
  },

  getDayFilter() {
    return (this.state.ui.dayFilter || "").trim(); // YYYY-MM-DD
  },

  getActivePedidosFiltered() {
    const day = this.getDayFilter();
    if (!day) return this.state.pedidos.slice();
    return this.state.pedidos.filter(p => (p.dayKey || UI.dayKey(new Date(p.createdAt))) === day);
  },

  refreshAll() {
    this.refreshBadges();
    this.refreshNavUser();
    this.refreshConfig();
    this.refreshMotoboysUI();
    this.refreshOperacaoUI();
    this.refreshStatsUI();
    this.refreshHistoricoUI();
    this.applyLicenseGates();
  },

  refreshBadges() {
    const badge = document.getElementById("licenseBadge");
    const { level, key } = this.state.license;

    badge.classList.remove("ok", "warn", "bad");
    if (level === 2) {
      badge.classList.add("ok");
      badge.textContent = `Licença: Nível 2 (${key || "ok"})`;
    } else if (level === 1) {
      badge.classList.add("warn");
      badge.textContent = `Licença: Nível 1 (${key || "ok"})`;
    } else {
      badge.classList.add("bad");
      badge.textContent = "Licença: inválida / não definida";
    }

    const topInfo = document.getElementById("topInfo");
    topInfo.textContent = this.state.user ? `Logado: ${this.state.user.email}` : "Deslogado";

    const cfgUser = document.getElementById("cfgUser");
    const cfgStatus = document.getElementById("cfgStatus");
    cfgUser.textContent = this.state.user ? this.state.user.email : "—";
    cfgStatus.textContent = this.state.user ? "Logado" : "Deslogado";
  },

  refreshNavUser() {
    const navEmail = document.getElementById("navEmail");
    const navMeta = document.getElementById("navMeta");
    navEmail.textContent = this.state.user ? this.state.user.email : "—";
    navMeta.textContent = this.state.user ? "Conta ativa" : "Você não está logado";
  },

  refreshConfig() {
    document.getElementById("licenseKey").value = this.state.license.key || "";
  },

  refreshMotoboysUI() {
    // dropdown do batch
    const selBatch = document.getElementById("batchMotoboy");
    const prev = selBatch.value;
    selBatch.innerHTML = "";

    if (this.state.motoboys.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Cadastre um motoboy para adicionar pedidos";
      selBatch.appendChild(opt);
      selBatch.disabled = true;
    } else {
      selBatch.disabled = false;
      this.state.motoboys.forEach(mb => {
        const opt = document.createElement("option");
        opt.value = mb.id;
        opt.textContent = mb.tag ? `${mb.name} (${mb.tag})` : mb.name;
        selBatch.appendChild(opt);
      });

      // mantém seleção anterior se ainda existir; senão, seleciona o primeiro
      const stillOk = this.state.motoboys.some(m => m.id === prev);
      selBatch.value = stillOk ? prev : this.state.motoboys[0].id;
    }

    // list de motoboys
    const list = document.getElementById("motoboysList");
    list.innerHTML = "";
    this.state.motoboys.forEach(mb => {
      const row = document.createElement("div");
      row.className = "item";

      const left = document.createElement("div");
      left.innerHTML = `<b>${UI.escape(mb.name)}</b><br/><small>${mb.tag ? UI.escape(mb.tag) : "—"}</small>`;

      const actions = document.createElement("div");
      actions.className = "itemActions";

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn";
      btnEdit.textContent = "Editar";
      btnEdit.onclick = async () => {
        const name = prompt("Nome do motoboy:", mb.name);
        if (name === null) return;
        const tag = prompt("Identificador (opcional):", mb.tag || "");
        if (tag === null) return;

        Motoboys.update(this.state, mb.id, { name: name.trim(), tag: tag.trim() });
        this.persist();
        this.refreshAll();
        UI.toast("Atualizado", "Motoboy editado.", "ok");
      };

      const btnDel = document.createElement("button");
      btnDel.className = "btn danger";
      btnDel.textContent = "Remover";
      btnDel.onclick = async () => {
        const affected = this.state.pedidos.filter(p => p.motoboyId === mb.id).length;
        const ok = await UI.confirm(
          "Remover motoboy",
          affected > 0
            ? `Isso vai remover o motoboy e APAGAR ${affected} pedido(s) ativo(s) dele. Continuar?`
            : "Isso vai remover o motoboy. Continuar?"
        );
        if (!ok) return;

        // apaga os pedidos ativos desse motoboy (sem "sem atribuição")
        this.state.pedidos = this.state.pedidos.filter(p => p.motoboyId !== mb.id);

        Motoboys.remove(this.state, mb.id);
        this.persist();
        this.refreshAll();
        UI.toast("Removido", "Motoboy removido.", "ok");
      };

      actions.append(btnEdit, btnDel);
      row.append(left, actions);
      list.appendChild(row);
    });
  },

  refreshOperacaoUI() {
    // pills (filtrados por dia)
    const pedidosFiltrados = this.getActivePedidosFiltered();
    document.getElementById("pillMotoboys").textContent = String(this.state.motoboys.length);
    document.getElementById("pillPedidos").textContent = String(pedidosFiltrados.length);

    // dia caption
    const day = this.getDayFilter();
    const cap = document.getElementById("dayCaption");
    cap.textContent = day ? `Mostrando: ${UI.formatDay(day)}` : "Mostrando: todos os dias";

    // board
    const board = document.getElementById("board");
    board.innerHTML = "";

    // sem motoboys: não existe lane "sem atribuição" (e nem dá pra adicionar pedidos)
    if (this.state.motoboys.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.innerHTML = `<div><b>Nenhum motoboy cadastrado</b><br/><small>Cadastre um motoboy na aba Motoboys para começar.</small></div>`;
      board.appendChild(empty);
      return;
    }

    // lanes: apenas motoboys (não existe mais "sem atribuição")
    const lanes = this.state.motoboys.slice();

    // render lanes
    lanes.forEach(mb => {
      const lane = document.createElement("div");
      lane.className = "lane";

      const laneTop = document.createElement("div");
      laneTop.className = "laneTop";

      const title = document.createElement("div");
      title.className = "laneTitle";

      const count = mb.id
        ? pedidosFiltrados.filter(p => p.motoboyId === mb.id).length
        : 0;
      title.innerHTML = `<strong>${UI.escape(mb.name)}</strong><span>${count} pedido(s)</span>`;

      const btns = document.createElement("div");
      btns.className = "laneBtns";

      const btnPlus = document.createElement("button");
      btnPlus.className = "miniBtn gold";
      btnPlus.textContent = "+";
      btnPlus.title = "Adicionar pedido neste motoboy (no card do topo)";
      btnPlus.onclick = () => {
        document.getElementById("batchMotoboy").value = mb.id;
        document.getElementById("batchCodes").focus();
      };

      const btnFinish = document.createElement("button");
      btnFinish.className = "miniBtn red";
      btnFinish.textContent = "🗑";
      btnFinish.title = "Finalizar selecionados";
      btnFinish.onclick = async () => {
        const selected = Array.from(lane.querySelectorAll('input[type="checkbox"]:checked'))
          .map(cb => cb.dataset.pid);

        if (selected.length === 0) {
          UI.toast("Nada selecionado", "Marque pedidos para finalizar.", "bad");
          return;
        }

        const ok = await UI.confirm("Finalizar pedidos", `Finalizar ${selected.length} pedido(s) deste motoboy?`);
        if (!ok) return;

        selected.forEach(id => Pedidos.finish(this.state, id));
        this.persist();
        this.refreshAll();
        UI.toast("Finalizado", `${selected.length} pedido(s) finalizado(s).`, "ok");
      };

      btns.append(btnPlus, btnFinish);
      laneTop.append(title, btns);

      const body = document.createElement("div");
      body.className = "laneBody";

      // orders list (filtrados por dia)
      const orders = pedidosFiltrados
        .filter(p => p.motoboyId === mb.id)
        .sort((a, b) => b.createdAt - a.createdAt);

      const ordersWrap = document.createElement("div");
      ordersWrap.className = "list";

      if (orders.length === 0) {
        const empty = document.createElement("div");
        empty.className = "item";
        empty.innerHTML = `<div><b>Sem pedidos</b><br/><small>Adicione pelo topo.</small></div>`;
        ordersWrap.appendChild(empty);
      } else {
        orders.forEach(p => {
          const card = document.createElement("div");
          card.className = "order";

          const meta = document.createElement("div");
          meta.className = "meta";

          const when = new Date(p.createdAt);
          meta.innerHTML = `
            <div class="code">${UI.escape(p.code)}</div>
            <div class="sub">
              <span class="tag platform">${UI.escape(p.platform || "AUTO")}</span>
              <span class="tag gold">${UI.escape(p.pay)}</span>
              <span class="tag">${UI.formatDateTime(when)}</span>
            </div>
          `;

          const tools = document.createElement("div");
          tools.className = "tools";

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.dataset.pid = p.id;

          const del = document.createElement("button");
          del.className = "miniBtn red";
          del.textContent = "X";
          del.title = "Apagar pedido (sem finalizar)";
          del.onclick = async () => {
            const ok = await UI.confirm("Apagar pedido", `Apagar o pedido ${p.code}?`);
            if (!ok) return;
            Pedidos.remove(this.state, p.id);
            this.persist();
            this.refreshAll();
            UI.toast("Apagado", `Pedido ${p.code} removido.`, "ok");
          };

          tools.append(cb, del);
          card.append(meta, tools);
          ordersWrap.appendChild(card);
        });
      }

      body.append(ordersWrap);
      lane.append(laneTop, body);
      board.appendChild(lane);
    });
  },

  refreshStatsUI() {
    const byMb = document.getElementById("statsByMotoboy");
    const byPay = document.getElementById("statsByPay");
    byMb.innerHTML = "";
    byPay.innerHTML = "";

    if (this.state.license.level < 2) {
      byMb.innerHTML = `<div class="item"><div><b>Bloqueado</b><br/><small>Recurso do Nível 2.</small></div></div>`;
      byPay.innerHTML = byMb.innerHTML;
      return;
    }

    const mbMap = new Map(this.state.motoboys.map(m => [m.id, m.name]));
    const countMb = {};
    const countPay = {};

    this.state.historico.forEach(h => {
      countMb[h.motoboyId] = (countMb[h.motoboyId] || 0) + 1;
      countPay[h.pay] = (countPay[h.pay] || 0) + 1;
    });

    Object.entries(countMb)
      .sort((a, b) => b[1] - a[1])
      .forEach(([id, qty]) => {
        const name = id ? (mbMap.get(id) || "—") : "—";
        const it = document.createElement("div");
        it.className = "item";
        it.innerHTML = `<div><b>${UI.escape(name)}</b><br/><small>Finalizados: ${qty}</small></div>`;
        byMb.appendChild(it);
      });

    if (byMb.children.length === 0) {
      byMb.innerHTML = `<div class="item"><div><b>Sem dados</b><br/><small>Nenhum pedido finalizado ainda.</small></div></div>`;
    }

    Object.entries(countPay)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pay, qty]) => {
        const it = document.createElement("div");
        it.className = "item";
        it.innerHTML = `<div><b>${UI.escape(pay)}</b><br/><small>Finalizados: ${qty}</small></div>`;
        byPay.appendChild(it);
      });

    if (byPay.children.length === 0) {
      byPay.innerHTML = `<div class="item"><div><b>Sem dados</b><br/><small>Nenhum pedido finalizado ainda.</small></div></div>`;
    }
  },

  refreshHistoricoUI() {
    const list = document.getElementById("histList");
    const search = (document.getElementById("histSearch")?.value || "").trim().toLowerCase();
    list.innerHTML = "";

    if (this.state.license.level < 2) {
      list.innerHTML = `<div class="item"><div><b>Bloqueado</b><br/><small>Recurso do Nível 2.</small></div></div>`;
      return;
    }

    const mbMap = new Map(this.state.motoboys.map(m => [m.id, m.name]));
    const filtered = this.state.historico
      .slice()
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .filter(h => !search || String(h.code).toLowerCase().includes(search));

    if (filtered.length === 0) {
      list.innerHTML = `<div class="item"><div><b>Nada por aqui</b><br/><small>Sem pedidos finalizados (ou busca vazia).</small></div></div>`;
      return;
    }

    filtered.forEach(h => {
      const it = document.createElement("div");
      it.className = "item";
      const mbName = h.motoboyId ? (mbMap.get(h.motoboyId) || "—") : "—";
      it.innerHTML = `
        <div>
          <b>${UI.escape(h.code)}</b>
          <br/>
          <small>${UI.escape(h.platform || "AUTO")} • ${UI.escape(h.pay)} • ${UI.escape(mbName)} • ${UI.formatDateTime(new Date(h.finishedAt))}</small>
        </div>
      `;
      list.appendChild(it);
    });
  },

  applyLicenseGates() {
    document.querySelectorAll("[data-requires]").forEach(el => {
      const req = el.getAttribute("data-requires");
      const allowed = (req === "L2") ? (this.state.license.level >= 2) : true;
      el.classList.toggle("disabled", !allowed);
      el.style.opacity = allowed ? "1" : ".45";
      el.style.pointerEvents = allowed ? "auto" : "none";
    });

    const currentView = UI.getCurrentViewId();
    if ((currentView === "stats" || currentView === "historico") && this.state.license.level < 2) {
      UI.showView("config");
      UI.toast("Licença necessária", "Essas telas são do Nível 2.", "bad");
    }
  },

  bindTopbarButtons() {
    const api = window.electronAPI;

    const safeCall = (fn, msg) => {
      if (typeof fn === "function") return fn();
      UI.toast("Electron", msg, "bad");
    };

    const btnMin = document.getElementById("btnMin");
    const btnMax = document.getElementById("btnMax");
    const btnClose = document.getElementById("btnClose");

    if (btnMin) btnMin.onclick = () => safeCall(api?.minimize, "Minimizar indisponível (abra pelo app Electron). ");
    if (btnMax) btnMax.onclick = () => safeCall(api?.maximize, "Maximizar indisponível (abra pelo app Electron). ");
    if (btnClose) btnClose.onclick = () => safeCall(api?.close, "Fechar indisponível (abra pelo app Electron). ");
  },

  bindNavigation() {
    document.querySelectorAll(".navBtn").forEach(btn => {
      btn.onclick = () => {
        const view = btn.dataset.view;
        const req = btn.dataset.requires;

        if (req === "L2" && this.state.license.level < 2) {
          UI.showView("config");
          UI.toast("Bloqueado", "Esse recurso é do Nível 2.", "bad");
          return;
        }

        document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        UI.showView(view);
        document.getElementById("topbarSub").textContent =
          btn.querySelector("span")?.textContent || "Motoboy Manager";
      };
    });
  },

  bindAuthTabs() {
    document.querySelectorAll(".tab").forEach(t => {
      t.onclick = () => {
        document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
        document.querySelectorAll(".tabView").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        document.getElementById(`tab-${t.dataset.tab}`).classList.add("active");
      };
    });
  },

  bindAuthActions() {
    document.getElementById("btnLogin").onclick = async () => {
      const email = document.getElementById("loginEmail").value.trim();
      const pass = document.getElementById("loginPass").value;
      const res = await Auth.login(email, pass);
      if (!res.ok) { UI.toast("Erro", res.error, "bad"); return; }
      this.state.user = Auth.getCurrentUser();
      this.refreshAll();
      UI.toast("Bem-vindo", "Login realizado.", "ok");
      UI.showView("operacao");
    };

    document.getElementById("btnSignup").onclick = async () => {
      const email = document.getElementById("signupEmail").value.trim();
      const pass = document.getElementById("signupPass").value;
      const res = await Auth.signup(email, pass);
      if (!res.ok) { UI.toast("Erro", res.error, "bad"); return; }
      this.state.user = Auth.getCurrentUser();
      this.refreshAll();
      UI.toast("Conta criada", "Você já está logado.", "ok");
      UI.showView("config");
    };

    document.getElementById("btnResetPass").onclick = async () => {
      const email = document.getElementById("resetEmail").value.trim();
      const pass = document.getElementById("resetPass").value;
      const res = await Auth.resetPassword(email, pass);
      if (!res.ok) { UI.toast("Erro", res.error, "bad"); return; }
      UI.toast("Ok", "Senha redefinida.", "ok");
      UI.showView("auth");
    };
  },

  bindConfigActions() {
    document.getElementById("btnGoAuth").onclick = () => UI.showView("auth");

    document.getElementById("btnLogout").onclick = async () => {
      if (!this.state.user) {
        UI.toast("Info", "Você já está deslogado.", "ok");
        return;
      }
      const ok = await UI.confirm("Sair", "Deseja deslogar?");
      if (!ok) return;
      Auth.logout();
      this.state.user = null;
      this.refreshAll();
      UI.toast("Saiu", "Você foi deslogado.", "ok");
    };

    document.getElementById("btnApplyLicense").onclick = () => {
      const key = document.getElementById("licenseKey").value.trim();
      const res = License.apply(key);
      if (!res.ok) {
        UI.toast("Licença inválida", res.error, "bad");
        this.state.license = License.getLicense();
        this.refreshAll();
        return;
      }
      this.state.license = License.getLicense();
      this.refreshAll();
      UI.toast("Licença aplicada", `Nível ${this.state.license.level} liberado.`, "ok");
    };
  },

  bindMotoboysActions() {
    document.getElementById("btnAddMotoboy").onclick = () => {
      const name = document.getElementById("mbName").value.trim();
      const tag = document.getElementById("mbTag").value.trim();
      if (!name) {
        UI.toast("Atenção", "Informe o nome do motoboy.", "bad");
        return;
      }
      Motoboys.add(this.state, { name, tag });
      document.getElementById("mbName").value = "";
      document.getElementById("mbTag").value = "";
      this.persist();
      this.refreshAll();
      UI.toast("Adicionado", "Motoboy criado.", "ok");
    };
  },

  bindOperacaoActions() {
    // Dia
    const dayInput = document.getElementById("dayFilter");
    dayInput.value = this.state.ui.dayFilter || "";

    dayInput.addEventListener("change", () => {
      this.state.ui.dayFilter = dayInput.value || "";
      this.persist();
      this.refreshAll();
    });

    document.getElementById("btnDayToday").onclick = () => {
      const today = UI.dayKey(new Date());
      this.state.ui.dayFilter = today;
      dayInput.value = today;
      this.persist();
      this.refreshAll();
      UI.toast("Dia", "Filtrando hoje.", "ok");
    };

    document.getElementById("btnDayClear").onclick = () => {
      this.state.ui.dayFilter = "";
      dayInput.value = "";
      this.persist();
      this.refreshAll();
      UI.toast("Dia", "Sem filtro de dia.", "ok");
    };

    // Contador batch
    const ta = document.getElementById("batchCodes");
    const updateCount = () => {
      const codes = UI.parseCodes(ta.value);
      const invalid = UI.getInvalidCodes(ta.value);

      document.getElementById("batchCount").textContent = String(codes.length);

      // opcional: avisa quando tiver inválido
      
    };

    ta.addEventListener("input", updateCount);
    updateCount();

    // Limpar batch
    document.getElementById("btnBatchClear").onclick = () => {
      ta.value = "";
      updateCount();
      UI.toast("Ok", "Campo limpo.", "ok");
      ta.focus();
    };

    // Adicionar vários
    document.getElementById("btnBatchAdd").onclick = () => {
      if (this.state.motoboys.length === 0) {
        UI.toast("Atenção", "Cadastre um motoboy antes de adicionar pedidos.", "bad");
        return;
      }

      const codes = UI.parseCodes(ta.value);
      const invalid = UI.getInvalidCodes(ta.value);
      if (invalid.length > 0) {
        UI.toast("Atenção", "Tem código inválido (ex: 5 dígitos). Eles foram ignorados.", "bad");
      }


      if (codes.length === 0) {
        UI.toast("Atenção", "Cole um ou mais códigos.", "bad");
        return;
      }

      const pay = document.getElementById("batchPay").value;
      const motoboyId = document.getElementById("batchMotoboy").value;
      if (!motoboyId || !this.state.motoboys.some(m => m.id === motoboyId)) {
        UI.toast("Atenção", "Selecione um motoboy.", "bad");
        return;
      }

      const dayKey = this.getDayFilter() || UI.dayKey(new Date());

      let added = 0;
      codes.forEach(code => {
        const res = Pedidos.add(this.state, { code, pay, motoboyId, dayKey });
        if (res?.ok) added++;
      });

      if (added === 0) {
        UI.toast("Nada adicionado", "Nenhum pedido válido foi adicionado.", "bad");
        return;
      }

      ta.value = "";
      updateCount();
      this.persist();
      this.refreshAll();
      UI.toast("Adicionado", `${added} pedido(s) adicionado(s).`, "ok");
    };

    // Export
    document.getElementById("btnExportJSON").onclick = () => {
      if (this.state.license.level < 2) {
        UI.toast("Bloqueado", "Backup é do Nível 2.", "bad");
        return;
      }
      Storage.downloadJSON("backup-motoboy-manager.json", this.state);
      UI.toast("Backup", "JSON exportado.", "ok");
    };

    document.getElementById("btnExportCSV").onclick = () => {
      if (this.state.license.level < 2) {
        UI.toast("Bloqueado", "CSV é do Nível 2.", "bad");
        return;
      }
      const csv = Storage.buildCSV(this.state);
      Storage.downloadText("historico.csv", csv, "text/csv");
      UI.toast("Exportado", "CSV gerado.", "ok");
    };
  },

  bindHistoricoActions() {
    const input = document.getElementById("histSearch");
    input.addEventListener("input", () => this.refreshHistoricoUI());
    document.getElementById("btnHistClear").onclick = () => {
      input.value = "";
      this.refreshHistoricoUI();
    };
  }
};

window.addEventListener("DOMContentLoaded", () => App.init());
