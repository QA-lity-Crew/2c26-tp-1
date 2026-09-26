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

// Ventanas de volatilidad, en segundos desde el arranque del test.
// IMPORTANTE: estos rangos tienen que coincidir con las fases del YAML.
// Es la forma más simple de que este processor "sepa" en qué fase está sin acoplarse
// a la librería interna de Artillery.
// Si se mopdifican duraciones en el YAML, hay que actualizarlas acá igual.
const VOLATILITY_WINDOWS = [
  { from: 80, to: 170 }, // primer shock
  { from: 200, to: 260 }, // segundo shock
];

const testStartMs = Date.now();

function isInVolatilityWindow() {
  const elapsedSec = (Date.now() - testStartMs) / 1000;
  return VOLATILITY_WINDOWS.some((w) => elapsedSec >= w.from && elapsedSec <= w.to);
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