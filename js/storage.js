export const Storage = {
  KEY: "MM_APP_STATE_V2",

  loadAppState(defaultState){
    try{
      const raw = localStorage.getItem(this.KEY);
      if(!raw) return defaultState;
      const data = JSON.parse(raw);

      return {
        ...defaultState,
        ...data,
        ui: data.ui ?? defaultState.ui,
        license: data.license ?? defaultState.license,
        motoboys: Array.isArray(data.motoboys) ? data.motoboys : defaultState.motoboys,
        pedidos: Array.isArray(data.pedidos) ? data.pedidos : defaultState.pedidos,
        historico: Array.isArray(data.historico) ? data.historico : defaultState.historico,
      };
    }catch{
      return defaultState;
    }
  },

  saveAppState(state){
    localStorage.setItem(this.KEY, JSON.stringify(state));
  },

  downloadJSON(filename, obj){
    const txt = JSON.stringify(obj, null, 2);
    this.downloadText(filename, txt, "application/json");
  },

  downloadText(filename, text, mime="text/plain"){
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  },

  buildCSV(state){
    const safe = (v)=>{
      const s = String(v ?? "");
      const q = s.replaceAll('"','""');
      return `"${q}"`;
    };

    const mbMap = new Map(state.motoboys.map(m=>[m.id, m.name]));
    const header = ["code","platform","pay","motoboy","dayKey","createdAt","finishedAt"].map(safe).join(",");

    const rows = state.historico.map(h=>{
      const mb = mbMap.get(h.motoboyId) || "";
      return [
        safe(h.code),
        safe(h.platform || "AUTO"),
        safe(h.pay),
        safe(mb),
        safe(h.dayKey || ""),
        safe(new Date(h.createdAt).toISOString()),
        safe(new Date(h.finishedAt).toISOString())
      ].join(",");
    });

    return [header, ...rows].join("\n");
  }
};
