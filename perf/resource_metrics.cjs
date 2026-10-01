const http = require("node:http");
const dgram = require("node:dgram");

const dockerSocket = "/var/run/docker.sock";
const project = process.env.COMPOSE_PROJECT_NAME || "exchange";
const statsdHost = process.env.STATSD_HOST || "graphite";
const statsd = dgram.createSocket("udp4");

function dockerGet(path) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { socketPath: dockerSocket, path, timeout: 4000 },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            return reject(new Error(`${path}: HTTP ${response.statusCode}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error(`${path}: timeout`)));
    request.on("error", reject);
  });
}

function gauge(metric, value) {
  if (!Number.isFinite(value) || value < 0) return;
  statsd.send(Buffer.from(`${metric}:${value}|g`), 8125, statsdHost);
}

async function collectContainer(container) {
  const name = container.Names?.[0]?.replace(/^\//, "");
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) return;

  const stats = await dockerGet(
    `/v1.41/containers/${container.Id}/stats?stream=false`
  );
  const prefix = `resources.${name}`;
  const cpu = stats.cpu_stats;
  const previousCpu = stats.precpu_stats;
  const cpuDelta = cpu?.cpu_usage?.total_usage - previousCpu?.cpu_usage?.total_usage;
  const systemDelta = cpu?.system_cpu_usage - previousCpu?.system_cpu_usage;
  const cores = cpu?.online_cpus || cpu?.cpu_usage?.percpu_usage?.length || 1;

  if (cpuDelta >= 0 && systemDelta > 0) {
    gauge(`${prefix}.cpu_percent`, (cpuDelta / systemDelta) * cores * 100);
  }

  const memory = stats.memory_stats;
  const inactive =
    memory?.stats?.inactive_file ?? memory?.stats?.total_inactive_file ?? 0;
  const used = Math.max(0, (memory?.usage || 0) - inactive);
  gauge(`${prefix}.memory_bytes`, used);
  if (memory?.limit > 0) {
    gauge(`${prefix}.memory_percent`, (used / memory.limit) * 100);
  }
}

let collecting = false;
async function collect() {
  if (collecting) return;
  collecting = true;
  try {
    const containers = await dockerGet("/v1.41/containers/json");
    const own = containers.filter(
      (container) => container.Labels?.["com.docker.compose.project"] === project
    );
    await Promise.all(own.map(collectContainer));
  } catch (error) {
    console.error(error);
  } finally {
    collecting = false;
  }
}

collect();
setInterval(collect, 5000);
