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
    state.motoboys = state.motoboys.filter(x=>x.id !== id);
  },
};
