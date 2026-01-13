const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "motoboy.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao abrir o banco:", err);
  } else {
    console.log("Banco conectado com sucesso");
  }
});

// Criar tabelas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS motoboys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT,
      platform TEXT,
      payment TEXT,
      motoboy_id INTEGER,
      datetime TEXT
    )
  `);
});

// ---------- HELPERS ----------
function detectPlatform(number) {
  if (number.length === 3) return "Anota Aí";
  if (number.length === 4) return "iFood";
  if (number.length === 6) return "99Food";
  throw new Error("Número de pedido inválido");
}

// ---------- EXPORTS ----------
module.exports = {
  addMotoboy(name) {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO motoboys (name) VALUES (?)",
        [name],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getMotoboys() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM motoboys", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  addOrder({ orderNumber, payment, motoboyId }) {
    return new Promise((resolve, reject) => {
      let platform;
      try {
        platform = detectPlatform(orderNumber);
      } catch (e) {
        return reject(e);
      }

      const datetime = new Date().toISOString();

      db.run(
        `
        INSERT INTO orders (order_number, platform, payment, motoboy_id, datetime)
        VALUES (?, ?, ?, ?, ?)
        `,
        [orderNumber, platform, payment, motoboyId, datetime],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getOrdersByDate(date) {
    return new Promise((resolve, reject) => {
      db.all(
        `
        SELECT o.order_number, o.platform, o.payment, o.datetime, m.name
        FROM orders o
        JOIN motoboys m ON m.id = o.motoboy_id
        WHERE DATE(o.datetime) = ?
        `,
        [date],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  dailyReport(date) {
    return new Promise((resolve, reject) => {
      db.all(
        `
        SELECT m.name, COUNT(*) as total
        FROM orders o
        JOIN motoboys m ON m.id = o.motoboy_id
        WHERE DATE(o.datetime) = ?
        GROUP BY m.name
        `,
        [date],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
};
