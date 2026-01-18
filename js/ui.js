export const UI = {
  uid() {
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  },

  escape(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  formatDateTime(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  dayKey(date) {
    // YYYY-MM-DD local
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },

  formatDay(dayKey) {
    // "YYYY-MM-DD" -> "DD/MM/AAAA"
    const [y, m, d] = String(dayKey || "").split("-");
    if (!y || !m || !d) return "—";
    return `${d}/${m}/${y}`;
  },

  parseCodes(text) {
    const raw = String(text ?? "").trim();
    if (!raw) return [];
    const parts = raw.split(/[\s,]+/g).map(s => s.trim()).filter(Boolean);

    const seen = new Set();
    const out = [];

    for (const p of parts) {
      const digits = p.replace(/\D/g, "");
      if (!digits) continue;

      // só aceita 3, 4, 6
      if (!(digits.length === 3 || digits.length === 4 || digits.length === 6)) continue;

      if (seen.has(digits)) continue;
      seen.add(digits);
      out.push(digits);
    }

    return out;
  },


  showView(viewId) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const el = document.getElementById(`view-${viewId}`);
    if (el) el.classList.add("active");
  },

  getCurrentViewId() {
    const active = document.querySelector(".view.active");
    if (!active) return "";
    return active.id.replace("view-", "");
  },

  toast(title, msg, type = "ok") {
    const wrap = document.getElementById("toastWrap");
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<b>${this.escape(title)}</b><div>${this.escape(msg)}</div>`;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(6px)"; }, 2300);
    setTimeout(() => { t.remove(); }, 2800);
  },

  confirm(title, text) {
    return new Promise((resolve) => {
      const back = document.getElementById("modalBack");
      const t = document.getElementById("modalTitle");
      const x = document.getElementById("modalText");
      const ok = document.getElementById("modalOk");
      const cancel = document.getElementById("modalCancel");

      t.textContent = title;
      x.textContent = text;

      const cleanup = () => {
        back.classList.remove("show");
        ok.onclick = null;
        cancel.onclick = null;
        back.onclick = null;
      };

      ok.onclick = () => { cleanup(); resolve(true); };
      cancel.onclick = () => { cleanup(); resolve(false); };
      back.onclick = (e) => { if (e.target === back) { cleanup(); resolve(false); } };

      back.classList.add("show");
    });
  },
  getInvalidCodes(text) {
    const raw = String(text ?? "").trim();
    if (!raw) return [];
    const parts = raw.split(/[\s,]+/g).map(s => s.trim()).filter(Boolean);

    const bad = [];
    for (const p of parts) {
      const digits = p.replace(/\D/g, "");
      if (!digits) continue;
      if (digits.length === 3 || digits.length === 4 || digits.length === 6) continue;
      bad.push(digits);
    }
    return bad;
  },

};
