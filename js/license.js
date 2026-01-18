const KEY = "MM_LICENSE_V1";

// Validador simples (offline) + chaves demo.
// Depois você pode trocar por validação real (servidor, assinatura, etc).
function normalize(k){
  return String(k || "").trim().toUpperCase().replace(/\s+/g,"");
}

// Um check básico pra “não aceitar qualquer coisa”:
function looksValidFormat(k){
  if(k === "DEMO-N1" || k === "DEMO-N2") return true;
  // Exemplo futuro: N1-XXXX-XXXX-XXXX ou N2-...
  return /^N[12]-[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/.test(k);
}

// Exemplo de “checksum” simples (não é anti-pirataria forte, mas já é um validador).
function pseudoChecksumOk(k){
  if(k === "DEMO-N1" || k === "DEMO-N2") return true;
  // soma chars mod 7 == 0
  const sum = [...k].reduce((a,c)=>a + c.charCodeAt(0), 0);
  return (sum % 7) === 0;
}

function computeLevel(k){
  if(k === "DEMO-N2") return 2;
  if(k === "DEMO-N1") return 1;
  if(k.startsWith("N2-")) return 2;
  if(k.startsWith("N1-")) return 1;
  return 0;
}

export const License = {
  getLicense(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return { level: 0, key: "" };
      const data = JSON.parse(raw);
      return { level: Number(data.level || 0), key: String(data.key || "") };
    }catch{
      return { level: 0, key: "" };
    }
  },

  apply(key){
    const k = normalize(key);
    if(!k) {
      localStorage.setItem(KEY, JSON.stringify({ level: 0, key: "" }));
      return { ok:false, error:"Informe uma chave." };
    }

    if(!looksValidFormat(k)){
      localStorage.setItem(KEY, JSON.stringify({ level: 0, key: k }));
      return { ok:false, error:"Formato de licença inválido." };
    }

    if(!pseudoChecksumOk(k)){
      localStorage.setItem(KEY, JSON.stringify({ level: 0, key: k }));
      return { ok:false, error:"Licença reprovada (checksum)." };
    }

    const level = computeLevel(k);
    if(level === 0){
      localStorage.setItem(KEY, JSON.stringify({ level: 0, key: k }));
      return { ok:false, error:"Nível não reconhecido." };
    }

    localStorage.setItem(KEY, JSON.stringify({ level, key: k }));
    return { ok:true };
  }
};
