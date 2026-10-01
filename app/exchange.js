import { nanoid } from "nanoid";

import { init as stateInit, getAccounts as stateAccounts, getRates as stateRates, getLog as stateLog } from "./state.js";
import { emitExchangeMetrics } from "./metrics.js";

let accounts;
let rates;
let log;

//call to initialize the exchange service
export async function init() {
  await stateInit();

  accounts = stateAccounts();
  rates = stateRates();
  log = stateLog();
}

//returns all internal accounts
export function getAccounts() {
  return accounts;
}

//sets balance for an account
export function setAccountBalance(accountId, balance) {
  const account = findAccountById(accountId);

  if (account != null) {
    account.balance = balance;
  }
}

//returns all current exchange rates
export function getRates() {
  return rates;
}

//returns the whole transaction log
export function getLog() {
  return log;
}

//sets the exchange rate for a given pair of currencies, and the reciprocal rate as well
export function setRate(rateRequest) {
  const { baseCurrency, counterCurrency, rate } = rateRequest;

  rates[baseCurrency][counterCurrency] = rate;
  rates[counterCurrency][baseCurrency] = Number((1 / rate).toFixed(5));
}

// Simple Mutex queue mechanism for concurrency control per account
const accountLocks = new Map();

async function acquireLock(key) {
  while (accountLocks.get(key)) {
    await accountLocks.get(key);
  }
  let resolver;
  const promise = new Promise((resolve) => {
    resolver = resolve;
  });
  accountLocks.set(key, promise);
  return resolver;
}

// Helper to acquire locks on multiple keys sequentially to avoid deadlocks
async function acquireLocks(keys) {
  // Sort keys deterministically to prevent deadlock conditions
  const sortedKeys = Array.from(new Set(keys)).sort();
  const releases = [];
  for (const key of sortedKeys) {
    const release = await acquireLock(key);
    releases.push(release);
  }
  return () => {
    for (let i = releases.length - 1; i >= 0; i--) {
      releases[i]();
    }
    for (const key of sortedKeys) {
      accountLocks.delete(key);
    }
  };
}

//executes an exchange operation
export async function exchange(exchangeRequest) {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId: clientBaseAccountId,
    counterAccountId: clientCounterAccountId,
    baseAmount,
  } = exchangeRequest;

  // Acquire locks on involved account IDs to guarantee atomicity and prevent race conditions
  const releaseLock = await acquireLocks([
    String(clientBaseAccountId),
    String(clientCounterAccountId),
    String(baseCurrency),
    String(counterCurrency),
  ]);

  try {
    //get the exchange rate
    const exchangeRate = rates[baseCurrency][counterCurrency];
    //compute the requested (counter) amount
    const counterAmount = baseAmount * exchangeRate;
    //find our account on the provided (base) currency
    const baseAccount = findAccountByCurrency(baseCurrency);
    //find our account on the counter currency
    const counterAccount = findAccountByCurrency(counterCurrency);

    //construct the result object with defaults
    const exchangeResult = {
      id: nanoid(),
      ts: new Date(),
      ok: false,
      request: exchangeRequest,
      exchangeRate: exchangeRate,
      counterAmount: 0.0,
      obs: null,
    };

    //check if we have funds on the counter currency account
    if (counterAccount.balance >= counterAmount) {
      //try to transfer from clients' base account
      if (await transfer(clientBaseAccountId, baseAccount.id, baseAmount)) {
        //try to transfer to clients' counter account
        if (
          await transfer(counterAccount.id, clientCounterAccountId, counterAmount)
        ) {
          //all good, update balances atomically under lock protection
          baseAccount.balance += baseAmount;
          counterAccount.balance -= counterAmount;
          exchangeResult.ok = true;
          exchangeResult.counterAmount = counterAmount;
        } else {
          //could not transfer to clients' counter account, return base amount to client
          await transfer(baseAccount.id, clientBaseAccountId, baseAmount);
          exchangeResult.obs = "Could not transfer to clients' account";
        }
      } else {
        //could not withdraw from clients' account
        exchangeResult.obs = "Could not withdraw from clients' account";
      }
    } else {
      //not enough funds on internal counter account
      exchangeResult.obs = "Not enough funds on counter currency account";
    }

    //log the transaction and return it
    log.push(exchangeResult);

    if (exchangeResult.ok) {
      emitExchangeMetrics(exchangeResult);
    }

    return exchangeResult;
  } finally {
    // Release locks in all execution paths (success or error)
    releaseLock();
  }
}

// internal - call transfer service to execute transfer between accounts
async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}

function findAccountByCurrency(currency) {
  for (let account of accounts) {
    if (account.currency == currency) {
      return account;
    }
  }

  return null;
}

function findAccountById(id) {
  for (let account of accounts) {
    if (account.id == id) {
      return account;
    }
  }

  return null;
}
