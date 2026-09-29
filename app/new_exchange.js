import { nanoid } from "nanoid";
import * as state from "./new_state.js";
import { emitExchangeMetrics } from "./metrics.js";

export const init = state.init;
export const getAccounts = state.getAccounts;
export const getRates = state.getRates;
export const getLog = state.getLog;
export const setAccountBalance = state.setAccountBalance;

export async function setRate({ baseCurrency, counterCurrency, rate }) {
  await state.setRate(baseCurrency, counterCurrency, rate);
}

export async function exchange(exchangeRequest) {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId: clientBaseAccountId,
    counterAccountId: clientCounterAccountId,
    baseAmount,
  } = exchangeRequest;

  const exchangeRate = await state.getRate(baseCurrency, counterCurrency);
  const counterAmount = baseAmount * exchangeRate;
  const baseAccountId = await state.getAccountIdByCurrency(baseCurrency);
  const counterAccountId = await state.getAccountIdByCurrency(counterCurrency);

  const exchangeResult = {
    id: nanoid(),
    ts: new Date(),
    ok: false,
    request: exchangeRequest,
    exchangeRate,
    counterAmount: 0.0,
    obs: null,
  };

  // 1) Reservar fondos en nuestra cuenta de contramoneda (chequeo + descuento atómico)
  if (await state.reserveFunds(counterAccountId, counterAmount)) {
    if (await transfer(clientBaseAccountId, baseAccountId, baseAmount)) {
      if (await transfer(counterAccountId, clientCounterAccountId, counterAmount)) {
        // 2) Todo OK: acreditar la cuenta base (la contra ya fue descontada)
        await state.addFunds(baseAccountId, baseAmount);
        exchangeResult.ok = true;
        exchangeResult.counterAmount = counterAmount;
      } else {
        // rollback: devolver reserva y devolver al cliente lo que nos transfirió
        await state.addFunds(counterAccountId, counterAmount);
        await transfer(baseAccountId, clientBaseAccountId, baseAmount);
        exchangeResult.obs = "Could not transfer to clients' account";
      }
    } else {
      await state.addFunds(counterAccountId, counterAmount); // rollback de la reserva
      exchangeResult.obs = "Could not withdraw from clients' account";
    }
  } else {
    exchangeResult.obs = "Not enough funds on counter currency account";
  }

  await state.appendLog(exchangeResult);
  if (exchangeResult.ok) emitExchangeMetrics(exchangeResult);
  return exchangeResult;
}

async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}