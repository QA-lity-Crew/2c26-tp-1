# Pruebas de carga

Artillery 2.0.22 requiere Node 22. Si se usa `nvm`, seleccionar la versión indicada por `.nvmrc`. Luego, con el entorno levantado mediante `docker-compose up -d`, instalar las dependencias una vez:

```bash
cd perf
nvm use
npm ci
```

## Límite de requests

```bash
npx artillery run -e api \
  --output ../docs/evidence/raw/read-limit.json \
  integrated_read_limit.yaml
```

## Exchanges con 400 clientes simulados

```bash
npx artillery run -e api \
  --output ../docs/evidence/raw/exchange-local.json \
  integrated_exchange_load.yaml
```

Este escenario genera la carga total desde un solo proceso de Artillery: 10, 50, 100, 200 y 20 exchanges por segundo. Como todo el tráfico sale desde la misma IP, `limit_conn` puede rechazar parte de las operaciones cuando se superan las 20 conexiones simultáneas.

Cada usuario virtual consulta primero `GET /rates` y usa esa respuesta como `expectedRate` en `POST /exchange`.

La evidencia del informe se generó con diez workers para representar tráfico desde varias IPs. Cada contenedor ejecuta el mismo comando de Artillery usando `integrated_exchange_worker.yaml`:

```bash
docker-compose --profile load up --scale loadgen=10 --no-deps loadgen
```

Artillery sólo ofrece distribución automática mediante sus comandos para AWS o Azure. Por eso la ejecución local con diez IPs utiliza contenedores separados.
