import { UI } from "./ui.js";

export const Pedidos = {
  detectPlatform(digits){
    if(digits.length === 4) return "iFood";
    if(digits.length === 3) return "Anota.ai";
    if(digits.length === 6) return "99Food";
    return ""; // inválido
  },

  isValidCode(digits){
    return digits.length === 3 || digits.length === 4 || digits.length === 6;
  },

  add(state, { code, pay, motoboyId, dayKey }){
    const digits = String(code ?? "").replace(/\D/g, "").trim();
    if(!digits) return { ok:false, reason:"empty" };

    if(!this.isValidCode(digits)){
      return { ok:false, reason:"invalid_length", digits };
    }

    const id = UI.uid();
    const platform = this.detectPlatform(digits);

    // Motoboy é obrigatório (não existe mais "sem atribuição")
    const mb = String(motoboyId ?? "").trim();
    if (!mb) return { ok: false, reason: "motoboy_required" };

    state.pedidos.push({
      id,
      code: digits,
      platform,
      pay: String(pay || "PIX"),
      motoboyId: mb,
      dayKey: String(dayKey || UI.dayKey(new Date())),
      createdAt: Date.now()
    });

    return { ok:true };
  },

  remove(state, id){
    state.pedidos = state.pedidos.filter(p=>p.id !== id);
  },

  finish(state, id){
    const idx = state.pedidos.findIndex(p=>p.id === id);
    if(idx < 0) return;
    const p = state.pedidos[idx];

    state.pedidos.splice(idx, 1);
    state.historico.push({
      ...p,
      finishedAt: Date.now()
    });
  }
};
