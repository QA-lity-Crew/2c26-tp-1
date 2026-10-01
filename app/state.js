import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

let accounts = null;
let rates = null;
let log = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCOUNTS = "./state/accounts.json";
const RATES = "./state/rates.json";
const LOG = "./state/log.json";

export async function init() {
  accounts = await load(ACCOUNTS);
  rates = await load(RATES);
  log = await load(LOG);

  seedPerformanceData();

  scheduleSave(accounts, ACCOUNTS, 1000);
  scheduleSave(rates, RATES, 5000);
  scheduleSave(log, LOG, 1000);
}

function seedPerformanceData() {
  const accountCount = parsePerformanceCount("PERF_ACCOUNT_COUNT");
  const logCount = parsePerformanceCount("PERF_LOG_COUNT");
  const currencies = ["ARS", "USD", "EUR", "BRL"];

  for (let index = accounts.length; index < accountCount; index++) {
    accounts.push({
      id: index + 1,
      currency: currencies[index % currencies.length],
      balance: 1000000 + index,
    });
  }

  for (let index = log.length; index < logCount; index++) {
    const baseCurrency = currencies[index % currencies.length];
    const counterCurrency = currencies[(index + 1) % currencies.length];
    log.push({
      id: `perf-log-${index + 1}`,
      ts: new Date(1739145600000 + index * 1000).toISOString(),
      ok: true,
      request: {
        baseCurrency,
        counterCurrency,
        baseAmount: 100 + (index % 1000),
        baseAccountId: index * 2 + 1,
        counterAccountId: index * 2 + 2,
      },
      exchangeRate: 1.25,
      counterAmount: (100 + (index % 1000)) * 1.25,
      obs: null,
    });
  }
}

function parsePerformanceCount(name) {
  const value = Number.parseInt(process.env[name] || "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function getAccounts() {
  return accounts;
}

export function getRates() {
  return rates;
}

export function getLog() {
  return log;
}

async function load(fileName) {
  const filePath = path.join(__dirname, fileName);

  try {
    await fs.promises.access(filePath);
    const raw = await fs.promises.readFile(filePath, "utf8");
    
    return JSON.parse(raw);
  } catch (err) {
    if (err.code == "ENOENT") {
      console.error(`${filePath} not found`);
    } else {
      console.error(`Error loading ${filePath}:`, err);
    }
  }
}

async function save(data, fileName) {
  const filePath = path.join(__dirname, fileName);
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
}

function scheduleSave(data, fileName, period) {
  setInterval(async () => {
    await save(data, fileName);
  }, period);
}
