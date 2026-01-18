const USERS_KEY = "MM_USERS_V1";
const CURRENT_KEY = "MM_CURRENT_USER_V1";

async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b=>b.toString(16).padStart(2,"0")).join("");
}

function loadUsers(){
  try{
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  }catch{
    return [];
  }
}

function saveUsers(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export const Auth = {
  getCurrentUser(){
    try{
      const raw = localStorage.getItem(CURRENT_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch{
      return null;
    }
  },

  async signup(email, password){
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

    if(!email.includes("@")) return { ok:false, error:"E-mail inválido." };
    if(password.length < 4) return { ok:false, error:"Senha muito curta (min 4)." };

    const users = loadUsers();
    if(users.some(u=>u.email === email)) return { ok:false, error:"Esse e-mail já existe." };

    const passHash = await sha256(password);
    users.push({ email, passHash, createdAt: Date.now() });
    saveUsers(users);

    localStorage.setItem(CURRENT_KEY, JSON.stringify({ email, loggedAt: Date.now() }));
    return { ok:true };
  },

  async login(email, password){
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

    if(!email.includes("@")) return { ok:false, error:"E-mail inválido." };
    const users = loadUsers();
    const u = users.find(x=>x.email === email);
    if(!u) return { ok:false, error:"Conta não encontrada." };

    const passHash = await sha256(password);
    if(passHash !== u.passHash) return { ok:false, error:"Senha incorreta." };

    localStorage.setItem(CURRENT_KEY, JSON.stringify({ email, loggedAt: Date.now() }));
    return { ok:true };
  },

  async resetPassword(email, newPassword){
    email = String(email || "").trim().toLowerCase();
    newPassword = String(newPassword || "");
    if(!email.includes("@")) return { ok:false, error:"E-mail inválido." };
    if(newPassword.length < 4) return { ok:false, error:"Senha muito curta (min 4)." };

    const users = loadUsers();
    const idx = users.findIndex(u=>u.email === email);
    if(idx < 0) return { ok:false, error:"Conta não encontrada." };

    users[idx].passHash = await sha256(newPassword);
    saveUsers(users);
    return { ok:true };
  },

  logout(){
    localStorage.removeItem(CURRENT_KEY);
  }
};
