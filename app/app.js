import express from "express";

import {
  init as exchangeInit,
  getAccounts,
  setAccountBalance,
  getRates,
  setRate,
  getLog,
  exchange,
  EXCHANGE_ERROR_CODES,
} from "./new_exchange.js";

await exchangeInit();

const app = express();
const port = 3000;

app.use(express.json());

// ACCOUNT endpoints

app.get("/accounts", async (req, res) => res.json(await getAccounts()));

app.put("/accounts/:id/balance", async (req, res) => {
  const { balance } = req.body;

  if (!req.params.id || !balance) {
    return res.status(400).json({ error: "Malformed request" });
  }

  await setAccountBalance(req.params.id, balance);
  res.json(await getAccounts());
});


// RATE endpoints

app.get("/rates", async (req, res) => res.json(await getRates()));

app.put("/rates", async (req, res) => {
  const { baseCurrency, counterCurrency, rate } = req.body;

  if (!baseCurrency || !counterCurrency || !rate) {
    return res.status(400).json({ error: "Malformed request" });
  }
    
  await setRate(req.body);
  res.json(await getRates());
});

// LOG endpoint

app.get("/log", async (req, res) => res.json(await getLog()));

// EXCHANGE endpoint

app.post("/exchange", async (req, res) => {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
    expectedRate,
  } = req.body;

  if (
    !baseCurrency ||
    !counterCurrency ||
    !baseAccountId ||
    !counterAccountId ||
    !baseAmount ||
    !Number.isFinite(expectedRate) ||
    expectedRate <= 0
  ) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const exchangeRequest = { ...req.body };
  const exchangeResult = await exchange(exchangeRequest);

  if (exchangeResult.ok) {
    res.status(200).json(exchangeResult);
  } else if (exchangeResult.error === EXCHANGE_ERROR_CODES.RATE_CHANGED) {
    res.status(409).json(exchangeResult);
  } else {
    res.status(500).json(exchangeResult);
  }
});

app.listen(port, () => {
  console.log(`Exchange API listening on port ${port}`);
});

export default app;
