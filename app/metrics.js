import dgram from "dgram";

const STATSD_HOST = process.env.STATSD_HOST || "graphite";
const STATSD_PORT = Number(process.env.STATSD_PORT) || 8125;

const socket = dgram.createSocket("udp4");

socket.on("error", (err) => {
  console.error("StatsD socket error:", err.message);
});

/**
 * Sends business metrics via UDP to StatsD for a completed exchange operation.
 * Emits:
 * - Gross volume per currency (business.volume.<currency>)
 * - Net balance change for arVault per currency (business.net.<currency>)
 *
 * @param {Object} exchangeResult
 */
export function emitExchangeMetrics(exchangeResult) {
  if (!exchangeResult || !exchangeResult.ok || !exchangeResult.request) {
    return;
  }

  const { baseCurrency, counterCurrency, baseAmount } = exchangeResult.request;
  const counterAmount = exchangeResult.counterAmount;

  // StatsD counter format: <metric>:<value>|c
  // Gross volume: always positive for both currencies traded
  // Net volume: from arVault perspective (+baseAmount received, -counterAmount paid out)
  const metrics = [
    `business.volume.${baseCurrency}:${baseAmount}|c`,
    `business.volume.${counterCurrency}:${counterAmount}|c`,
    `business.net.${baseCurrency}:${baseAmount}|c`,
    `business.net.${counterCurrency}:-${counterAmount}|c`,
  ];

  const payload = Buffer.from(metrics.join("\n") + "\n");

  socket.send(payload, 0, payload.length, STATSD_PORT, STATSD_HOST, (err) => {
    if (err) {
      console.error("Error sending StatsD business metrics:", err.message);
    }
  });
}
