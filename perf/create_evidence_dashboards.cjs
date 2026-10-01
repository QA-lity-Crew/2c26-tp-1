const datasource = { type: "graphite", uid: "bfzjqn1j5q5mof" };

function target(refId, query) {
  return { datasource, refId, target: query };
}

function chart(id, title, x, y, w, h, unit, targets) {
  return {
    id,
    title,
    type: "timeseries",
    datasource,
    gridPos: { x, y, w, h },
    fieldConfig: {
      defaults: {
        color: { mode: "palette-classic" },
        min: 0,
        unit,
        custom: {
          drawStyle: "line",
          fillOpacity: 18,
          lineInterpolation: "linear",
          lineWidth: 2,
          pointSize: 7,
          showPoints: "always",
          spanNulls: true,
          stacking: { group: "A", mode: "none" },
        },
      },
      overrides: [],
    },
    options: {
      legend: {
        calcs: ["mean", "max", "lastNotNull"],
        displayMode: "table",
        placement: "bottom",
        showLegend: true,
      },
      tooltip: { mode: "multi", sort: "desc" },
    },
    targets: targets.map((query, index) =>
      target(String.fromCharCode(65 + index), query)
    ),
  };
}

function note(id, markdown) {
  return {
    id,
    title: "Resumen de la ejecución",
    type: "text",
    gridPos: { x: 0, y: 0, w: 24, h: 4 },
    options: { mode: "markdown", content: markdown },
  };
}

const readDashboard = {
  uid: "qa-read-limit-evidence",
  title: "Evidencia - límite de 3000 requests por segundo",
  timezone: "browser",
  schemaVersion: 40,
  refresh: false,
  time: { from: "2026-09-30T22:54:15.000Z", to: "2026-09-30T22:56:30.000Z" },
  panels: [
    note(
      1,
      "**203.577 requests** · **194.478 HTTP 200** · **9.099 HTTP 429** · **0 usuarios fallidos**  \nLa carga subió por etapas hasta 3500 req/s y terminó con una recuperación a 100 req/s."
    ),
    chart(2, "Requests enviados y respuestas por segundo", 0, 4, 16, 9, "reqps", [
      "alias(evidence.read.request_rate,'Enviados/s')",
      "alias(evidence.read.http_200_rate,'HTTP 200/s')",
      "alias(evidence.read.http_429_rate,'HTTP 429/s')",
    ]),
    chart(3, "Respuestas limitadas", 16, 4, 8, 9, "reqps", [
      "alias(evidence.read.http_429_rate,'HTTP 429/s')",
    ]),
    chart(4, "Latencia p95", 0, 13, 24, 8, "ms", [
      "alias(evidence.read.latency_p95_ms,'p95')",
    ]),
  ],
};

const exchangeDashboard = {
  uid: "qa-exchange-load-evidence",
  title: "Evidencia - carga de exchanges con 400 clientes",
  timezone: "browser",
  schemaVersion: 40,
  refresh: false,
  time: { from: "2026-09-30T22:57:00.000Z", to: "2026-09-30T23:01:00.000Z" },
  panels: [
    note(
      1,
      "**10 generadores** · **400 IDs de clientes** · **21.050 intentos** · **21.026 HTTP 200** · **24 HTTP 429**  \nLatencia media: **606,8 ms**. Ninguna cuenta interna terminó con saldo negativo."
    ),
    chart(2, "Exchanges por segundo (total de los 10 generadores)", 0, 4, 16, 9, "reqps", [
      "alias(evidence.exchange.request_rate,'Intentos/s')",
      "alias(evidence.exchange.http_200_rate,'HTTP 200/s')",
      "alias(evidence.exchange.http_429_rate,'HTTP 429/s')",
    ]),
    chart(3, "Latencia del exchange", 16, 4, 8, 9, "ms", [
      "alias(evidence.exchange.latency_mean_ms,'Media')",
      "alias(evidence.exchange.latency_p95_ms,'p95')",
    ]),
    chart(4, "CPU de las tres réplicas", 0, 13, 12, 8, "percent", [
      "alias(evidence.resources.exchange_api1_1.cpu_percent,'api1')",
      "alias(evidence.resources.exchange_api2_1.cpu_percent,'api2')",
      "alias(evidence.resources.exchange_api3_1.cpu_percent,'api3')",
    ]),
    chart(5, "Memoria usada", 12, 13, 12, 8, "mbytes", [
      "alias(evidence.resources.exchange_api1_1.memory_mib,'api1')",
      "alias(evidence.resources.exchange_api2_1.memory_mib,'api2')",
      "alias(evidence.resources.exchange_api3_1.memory_mib,'api3')",
      "alias(evidence.resources.exchange_redis_1.memory_mib,'redis')",
    ]),
  ],
};

async function save(dashboard) {
  const response = await fetch("http://localhost/api/dashboards/db", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from("admin:admin").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dashboard, overwrite: true }),
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  console.log(await response.text());
}

async function main() {
  const authorization = `Basic ${Buffer.from("admin:admin").toString("base64")}`;
  const response = await fetch("http://localhost/api/datasources/name/graphite", {
    headers: { Authorization: authorization },
  });
  if (!response.ok) throw new Error(`Graphite datasource not found: ${response.status}`);
  datasource.uid = (await response.json()).uid;
  await Promise.all([save(readDashboard), save(exchangeDashboard)]);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
