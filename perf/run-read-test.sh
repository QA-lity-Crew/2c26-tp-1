#!/bin/sh
set -eu

if [ "$#" -ne 5 ]; then
  echo "Usage: $0 <run-name> <scenario> <environment> <account-count> <log-count>" >&2
  exit 1
fi

run_name="$1"
scenario="$2"
environment="$3"
account_count="$4"
log_count="$5"
result_dir="perf/results/$run_name"

mkdir -p "$result_dir"

PERF_ACCOUNT_COUNT="$account_count" PERF_LOG_COUNT="$log_count" \
  docker-compose up -d --force-recreate api nginx

attempt=0
until curl -fsS http://localhost:5555/accounts >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "API did not become ready" >&2
    exit 1
  fi
  sleep 1
done

actual_accounts=$(curl -fsS http://localhost:5555/accounts | node -e 'let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",()=>console.log(JSON.parse(b).length))')
actual_logs=$(curl -fsS http://localhost:5555/log | node -e 'let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",()=>console.log(JSON.parse(b).length))')
started_at=$(date +%s)

docker-compose --profile load run --rm --no-deps loadgen sh -c \
  "./node_modules/.bin/artillery run '$scenario.yaml' -e '$environment' --output '/perf/results/$run_name/artillery.json'" \
  >"$result_dir/console.log" 2>&1

finished_at=$(date +%s)

node -e '
  const fs = require("node:fs");
  const metadata = {
    run: process.argv[1],
    scenario: process.argv[2],
    environment: process.argv[3],
    configuredAccounts: Number(process.argv[4]),
    configuredLogs: Number(process.argv[5]),
    actualAccounts: Number(process.argv[6]),
    actualLogs: Number(process.argv[7]),
    startedAtEpoch: Number(process.argv[8]),
    finishedAtEpoch: Number(process.argv[9]),
    startedAt: new Date(Number(process.argv[8]) * 1000).toISOString(),
    finishedAt: new Date(Number(process.argv[9]) * 1000).toISOString()
  };
  fs.writeFileSync(process.argv[10], JSON.stringify(metadata, null, 2) + "\n");
' "$run_name" "$scenario" "$environment" "$account_count" "$log_count" \
  "$actual_accounts" "$actual_logs" "$started_at" "$finished_at" "$result_dir/metadata.json"

tail -n 35 "$result_dir/console.log"
