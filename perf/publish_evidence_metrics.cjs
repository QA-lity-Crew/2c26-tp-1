const fs = require("fs");
const net = require("net");
const path = require("path");

const evidenceDir = path.resolve(__dirname, "../docs/evidence/raw");
const host = process.env.GRAPHITE_HOST || "localhost";
const port = Number(process.env.GRAPHITE_PORT || 2003);

function point(lines, name, value, timestampMs) {
  if (Number.isFinite(value)) {
    lines.push(`${name} ${value} ${Math.floor(timestampMs / 1000)}`);
  }
}

function publishReadMetrics(lines) {
  const run = JSON.parse(
    fs.readFileSync(path.join(evidenceDir, "read-limit.json"), "utf8")
  );

  for (const interval of run.intermediate) {
    const timestamp = Number(interval.period);
    const counters = interval.counters || {};
    point(lines, "evidence.read.request_rate", interval.rates?.["http.request_rate"], timestamp);
    point(lines, "evidence.read.http_200_rate", (counters["http.codes.200"] || 0) / 10, timestamp);
    point(lines, "evidence.read.http_429_rate", (counters["http.codes.429"] || 0) / 10, timestamp);
    point(lines, "evidence.read.latency_p95_ms", interval.summaries?.["http.response_time"]?.p95, timestamp);
  }
}

function publishExchangeMetrics(lines) {
  const files = fs
    .readdirSync(evidenceDir)
    .filter((name) => /^exchange-[a-f0-9]+\.json$/.test(name));
  const buckets = new Map();

  for (const file of files) {
    const run = JSON.parse(fs.readFileSync(path.join(evidenceDir, file), "utf8"));
    for (const interval of run.intermediate) {
      const timestamp = Math.round(Number(interval.period) / 10000) * 10000;
      const counters = interval.counters || {};
      const latency = interval.summaries?.["http.response_time"];
      const bucket = buckets.get(timestamp) || {
        requestRate: 0,
        ok: 0,
        limited: 0,
        latencyWeighted: 0,
        latencyCount: 0,
        p95: 0,
      };

      bucket.requestRate += interval.rates?.["http.request_rate"] || 0;
      bucket.ok += counters["http.codes.200"] || 0;
      bucket.limited += counters["http.codes.429"] || 0;
      if (latency) {
        bucket.latencyWeighted += latency.mean * latency.count;
        bucket.latencyCount += latency.count;
        bucket.p95 = Math.max(bucket.p95, latency.p95 || 0);
      }
      buckets.set(timestamp, bucket);
    }
  }

  for (const [timestamp, bucket] of [...buckets].sort(([a], [b]) => a - b)) {
    point(lines, "evidence.exchange.request_rate", bucket.requestRate, timestamp);
    point(lines, "evidence.exchange.http_200_rate", bucket.ok / 10, timestamp);
    point(lines, "evidence.exchange.http_429_rate", bucket.limited / 10, timestamp);
    point(
      lines,
      "evidence.exchange.latency_mean_ms",
      bucket.latencyWeighted / bucket.latencyCount,
      timestamp
    );
    point(lines, "evidence.exchange.latency_p95_ms", bucket.p95, timestamp);
  }
}

function publishResourceMetrics(lines) {
  const files = fs
    .readdirSync(evidenceDir)
    .filter((name) => /^exchange-docker-stats-.*\.txt$/.test(name));

  for (const file of files) {
    const filePath = path.join(evidenceDir, file);
    const timestamp = fs.statSync(filePath).mtimeMs;
    const rows = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
    for (const row of rows) {
      const match = row.match(/^(exchange-[^ ]+) ([0-9.]+)% ([0-9.]+)(MiB|GiB)/);
      if (!match) continue;
      const [, container, cpu, memory, unit] = match;
      const metricContainer = container.replace(/-/g, "_");
      const memoryMiB = Number(memory) * (unit === "GiB" ? 1024 : 1);
      point(lines, `evidence.resources.${metricContainer}.cpu_percent`, Number(cpu), timestamp);
      point(lines, `evidence.resources.${metricContainer}.memory_mib`, memoryMiB, timestamp);
    }
  }
}

const lines = [];
publishReadMetrics(lines);
publishExchangeMetrics(lines);
publishResourceMetrics(lines);

const socket = net.createConnection({ host, port }, () => {
  socket.end(`${lines.join("\n")}\n`);
});
socket.on("close", () => console.log(`Published ${lines.length} evidence points to ${host}:${port}`));
socket.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
