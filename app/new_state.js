import Redis from "ioredis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Descuenta `amount` del saldo solo si alcanza. Atómico (Redis ejecuta el script sin interrupciones).
redis.defineCommand("reserveFunds", {
  numberOfKeys: 1,
  lua: `
    local bal = tonumber(redis.call('HGET', KEYS[1], ARGV[1]))
    if bal and bal >= tonumber(ARGV[2]) then
      redis.call('HINCRBYFLOAT', KEYS[1], ARGV[1], -tonumber(ARGV[2]))
      return 1
    end
    return 0
  `,
});

const readJson = (f) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "state", f), "utf8"));

// Una única instancia "siembra" los datos iniciales en redis.
// Dado que una vez implementada la redundancia en los web servers
// contamos con 3 instancias del proceso de Node Js, es que una de ellas
// se encarga de poblar con los datos de los archivos proporcionados inicialmente.
export async function init() {
  // NX implica establecer la clave solo si no existe (esta operación se ejecuta de forma atómica).
  // La primera instancia que la ejecute poblará según los datos provistos en los archivos JSON.
  const won = await redis.set("seed:lock", "1", "NX");

  if (won) {
    // Con multi() declaramos el inicio de una transacción sobre la cual vamos a encolar comandos
    // acá cada transacción se encargará de ir poblando accounts (según balance y currency) y rates.
    const multi = redis.multi();
    for (const a of readJson("accounts.json")) {
      multi.hset("accounts:balance", a.id, a.balance);
      multi.hset("accounts:byCurrency", a.currency, a.id);
    }
    const rates = readJson("rates.json");
    for (const base of Object.keys(rates))
      for (const counter of Object.keys(rates[base]))
        multi.hset("rates", `${base}:${counter}`, rates[base][counter]);
    multi.set("seed:done", "1");
    await multi.exec();
  } else {
    // Si no es la primera instancia y por ende la encargada de poblar los datos, espera a que se
    // establezca ese registro en redis a modo de flag (TODO: ver si vale la pena sacar este busy wait).
    while (!(await redis.get("seed:done"))) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

// ACCOUNTS
export async function getAccounts() {
  const balances = await redis.hgetall("accounts:balance");
  const byCurrency = await redis.hgetall("accounts:byCurrency");
  return Object.entries(byCurrency).map(([currency, id]) => ({
    id: Number(id),
    currency,
    balance: Number(balances[id]),
  }));
}

export const getAccountIdByCurrency = (currency) =>
  redis.hget("accounts:byCurrency", currency);

export async function setAccountBalance(id, balance) {
  const exists = await redis.hexists("accounts:balance", id);
  if (exists) await redis.hset("accounts:balance", id, balance);
}

export const reserveFunds = async (id, amount) =>
  (await redis.reserveFunds("accounts:balance", id, amount)) === 1;

export const addFunds = (id, amount) =>
  redis.hincrbyfloat("accounts:balance", id, amount);

// RATES
export async function getRates() {
  const flat = await redis.hgetall("rates");
  const out = {};
  for (const [pair, rate] of Object.entries(flat)) {
    const [base, counter] = pair.split(":");
    (out[base] ??= {})[counter] = Number(rate);
  }
  return out;
}

export async function getRate(base, counter) {
  const r = await redis.hget("rates", `${base}:${counter}`);
  return r === null ? null : Number(r);
}

export async function setRate(base, counter, rate) {
  await redis
    .multi()
    .hset("rates", `${base}:${counter}`, rate)
    .hset("rates", `${counter}:${base}`, Number((1 / rate).toFixed(5)))
    .exec();
}

// LOG
export const appendLog = (entry) => redis.rpush("log", JSON.stringify(entry));

export async function getLog() {
  return (await redis.lrange("log", 0, -1)).map((l) => JSON.parse(l));
}