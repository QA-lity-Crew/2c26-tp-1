const PAIRS = [
  { baseCurrency: "ARS", counterCurrency: "BRL", rate: 0.00340 },
  { baseCurrency: "ARS", counterCurrency: "EUR", rate: 0.00057 },
  { baseCurrency: "ARS", counterCurrency: "USD", rate: 0.00066 },
  { baseCurrency: "BRL", counterCurrency: "ARS", rate: 297.06 },
  { baseCurrency: "EUR", counterCurrency: "ARS", rate: 1761 },
  { baseCurrency: "USD", counterCurrency: "ARS", rate: 1513 },
];

// Par que concentraría casi todas las actualizaciones en un evento real de volatilidad
const HOT_PAIR = PAIRS.find(
  (p) => p.baseCurrency === "USD" && p.counterCurrency === "ARS"
);

// Ventana de volatilidad, en segundos desde el arranque del test.
// IMPORTANTE: este rango tiene que coincidir con la fase "Volatility shock" del YAML.
// Es la forma más simple de que este processor "sepa" en qué fase está sin acoplarse
// a la librería interna de Artillery.
// Si se modifican duraciones en el YAML, hay que actualizar esto también.
const VOLATILITY_WINDOW = { from: 80, to: 200 };

const testStartMs = Date.now();

function isInVolatilityWindow() {
  const elapsedSec = (Date.now() - testStartMs) / 1000;
  return elapsedSec >= VOLATILITY_WINDOW.from && elapsedSec <= VOLATILITY_WINDOW.to;
}

function pickPair(volatile) {
  if (volatile && Math.random() < 0.85) {
    // 85% de las escrituras concentradas en el mismo par durante el shock
    return HOT_PAIR;
  }
  return PAIRS[Math.floor(Math.random() * PAIRS.length)];
}

module.exports = {
  generateVolatilityPayload: function (context, events, done) {
    const volatile = isInVolatilityWindow();
    const picked = pickPair(volatile);

    context.vars.baseCurrency = picked.baseCurrency;
    context.vars.counterCurrency = picked.counterCurrency;

    // Durante el shock el valor también se movería fuerte; se simula con ±15% de ruido
    // sobre el rate base. No se intenta reconstruir una trayectoria real de devaluación:
    // eso está fuera de alcance de una prueba de carga, donde lo que importa es la
    // frecuencia/concurrencia de escritura, no la magnitud exacta del valor.
    const noise = volatile ? 1 + (Math.random() * 0.3 - 0.15) : 1;
    context.vars.rate = Number((picked.rate * noise).toFixed(5));

    return done();
  },
};