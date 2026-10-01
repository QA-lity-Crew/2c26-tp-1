const PAIRS = [
  { baseCurrency: "ARS", counterCurrency: "BRL", expectedRate: 0.0034, maxAmount: 1000 },
  { baseCurrency: "ARS", counterCurrency: "EUR", expectedRate: 0.00057, maxAmount: 1000 },
  { baseCurrency: "ARS", counterCurrency: "USD", expectedRate: 0.00066, maxAmount: 1000 },
  { baseCurrency: "BRL", counterCurrency: "ARS", expectedRate: 297.06, maxAmount: 5 },
  { baseCurrency: "EUR", counterCurrency: "ARS", expectedRate: 1761, maxAmount: 2 },
  { baseCurrency: "USD", counterCurrency: "ARS", expectedRate: 1513, maxAmount: 2 },
];

module.exports = {
  generateExchangePayload(context, events, done) {
    const client = Math.floor(Math.random() * 400);
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];

    context.vars.baseCurrency = pair.baseCurrency;
    context.vars.counterCurrency = pair.counterCurrency;
    context.vars.expectedRate = pair.expectedRate;
    context.vars.baseAmount = Number((1 + Math.random() * pair.maxAmount).toFixed(2));
    context.vars.baseAccountId = 10000 + client;
    context.vars.counterAccountId = 20000 + client;

    return done();
  },

  captureExpectedRate(requestParams, response, context, events, done) {
    try {
      const rates = JSON.parse(response.body.toString());
      const expectedRate = rates[context.vars.baseCurrency]?.[context.vars.counterCurrency];
      if (!Number.isFinite(expectedRate)) {
        return done(new Error("The selected exchange rate was not returned by GET /rates"));
      }
      context.vars.expectedRate = expectedRate;
      return done();
    } catch (error) {
      return done(error);
    }
  },

  setExchangeBody(requestParams, context, events, done) {
    requestParams.json = {
      baseCurrency: context.vars.baseCurrency,
      counterCurrency: context.vars.counterCurrency,
      baseAccountId: context.vars.baseAccountId,
      counterAccountId: context.vars.counterAccountId,
      baseAmount: context.vars.baseAmount,
      expectedRate: context.vars.expectedRate,
    };

    return done();
  },
};
