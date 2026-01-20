import { UI } from "./ui.js";

export const Motoboys = {
  add(state, { name, tag }){
    state.motoboys.push({ id: UI.uid(), name: String(name||""), tag: String(tag||"") });
  },

  update(state, id, patch){
    const m = state.motoboys.find(x=>x.id === id);
    if(!m) return;
    if(typeof patch.name === "string" && patch.name.trim()) m.name = patch.name.trim();
    if(typeof patch.tag === "string") m.tag = patch.tag.trim();
  },

  remove(state, id){
    if(id === "ORPHAN") return; // nunca remove
    state.motoboys = state.motoboys.filter(x=>x.id !== id);
  },

  ensureOrphan(state){
    let orphan = state.motoboys.find(m=>m.id === "ORPHAN");
    if(!orphan){
      orphan = { id:"ORPHAN", name:"Sem motoboy", tag:"" };
      state.motoboys.unshift(orphan);
    } else {
      // garante nome sempre
      if(!orphan.name || !orphan.name.trim()) orphan.name = "Sem motoboy";
    }
    return orphan.id;
  }
};
