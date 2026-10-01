# TP1: Auditoría Arquitectónica y Tácticas de Calidad - arVault

**Materia:** Arquitectura del Software (75.73 / TB034)  
**Facultad:** Facultad de Ingeniería de la Universidad de Buenos Aires (FIUBA)  
**Cuatrimestre:** 2do Cuatrimestre de 2026  
**Grupo:** QA-lity Crew  

### Integrantes
| Apellido y Nombres | Padrón | Email |
|---|---|---|
| Giménez, Tomás | 110166 | togimenez@fi.uba.ar |
| Corn, Franco | 109025 | fcorn@fi.uba.ar |
| Ruiz Sugliani, Santiago Nahuel | 106768 | sruizs@fi.uba.ar |
| Zajic, Gisela Daiana | 108735 | gzajic@fi.uba.ar |

---

## 📄 Informe Final
El informe completo de evaluación de arquitectura, pruebas de carga y tácticas implementadas se encuentra disponible en formato PDF en:  
👉 [**doc/Informe TP1 - Arquitectura de Software.pdf**](./doc/Informe%20TP1%20-%20Arquitectura%20de%20Software.pdf)

---

## 📌 Resumen de Tácticas Arquitectónicas Implementadas

1. **Atomicidad y Control de Concurrencia (Mutex Locks en Memoria):**
   - Resolución de *race conditions* y saldos negativos bajo ráfagas concurrentes en `POST /exchange`.
2. **Rate Limiting Perimetral (Nginx `limit_req`):**
   - Protección contra ráfagas no deseadas y mitigación de ataques DoS, retornando HTTP 429 estandarizado.
3. **Escalamiento Horizontal y Persistencia Distribuida (Redis + Lua Scripts):**
   - Externalización de estado y reserva atómica de fondos (`reserveFunds.lua`) permitiendo escalar el servicio web a 3 réplicas sin divergencia de datos.
4. **Validación Estricta y Seguridad de Contratos (`expectedRate`):**
   - Prevención de desincronización por *slippage* en tasas de cambio y restricción de conexiones TCP perimetrales.
5. **Métricas de Negocio en Tiempo Real (StatsD + Graphite + Grafana):**
   - Monitoreo en vivo de *Gross Traded Volume* (GTV) y *Net Vault Position* por divisa (ARS, USD, EUR, BRL).

---

## 🚀 Guía de Ejecución y Pruebas

### 1. Requisitos previos
- Docker & Docker Compose
- Node.js (v18+)

### 2. Levantar el stack completo
Para iniciar todos los servicios (Nginx, API de arVault, StatsD/Graphite, cAdvisor y Grafana):

```sh
docker-compose up -d --build
```

- **API a través del Reverse Proxy:** `http://localhost:8080`
- **Dashboard de Grafana:** `http://localhost:3000` (Credenciales por defecto: `admin` / `admin`)

### 3. Pruebas de Carga y Rendimiento (Artillery)
Los escenarios de prueba se encuentran en el directorio `perf/`. Para ejecutarlos:

```sh
./run-scenario.sh <nombre_del_escenario> <entorno>
```

*Ejemplo:*
```sh
./run-scenario.sh exchange-all-tactics-load local
```

---

## 📂 Estructura del Repositorio

```text
├── app/                     # Código fuente de la API arVault (Node.js/Express)
├── doc/                     # Informe final en PDF y colección de Postman
├── perf/                    # Escenarios de Artillery y configuración de Grafana
├── nginx_reverse_proxy.conf # Configuración perimetral de Nginx y Rate Limiting
├── docker-compose.yml       # Orquestación de contenedores y límites de recursos
└── README.md                # Este archivo
```

---

# Enunciado Original de la Cátedra

## Trabajo Práctico 1 de Arquitectura del Software (75.73/TB034) del 2do cuatrimestre de 2026

> **La fecha de entrega para el informe y el código es el jueves 01/10** :bangbang:

La forma de entrega será a través de un canal **privado** del grupo en Slack, al que deben invitar a los docentes. Deben poner ahí un link al repositorio con el código y el informe (o avisar si está en el repositorio).

El informe debe entregarse en formato PDF. **Debe** incluir screenshots del dashboard de métricas para cada caso analizado que permitan observar los resultados obtenidos.

## Objetivos

El objetivo principal es comparar algunas tecnologías, ver cómo diversos aspectos impactan en los atributos de calidad (QA) y probar cuáles tácticas se podrían implementar para mejorarlos.
El objetivo menor es que aprendan a usar una variedad de tecnologías útiles y muy usadas hoy en día, incluyendo:

- Node.js (+ Express)
- Docker
- Docker Compose
- Nginx
- Algún generador de carga (la propuesta es usar Artillery, pero pueden cambiarlo)
- Alguna forma de tomar mediciones varias y visualizarlas, preferentemente en tiempo real, con persistencia, y en un dashboard unificado (la propuesta es usar el plugin de Artillery + cAdvisor + StatsD + Graphite + Grafana, pero pueden cambiarlo).

## Antecedentes

La startup **arVault** es una fintech que opera una billetera digital, de reciente creación. Su fundador, un desarrollador aficionado y entusiasta con algo de dinero y muchas ideas, consciente de que la clave de su negocio es la implementación de su backend, tercerizó el desarrollo de las apps para dispositivos móviles, y se concentró en implementar rápidamente (bajo la consigna _fake it until you make it_) un núcleo de servicios que le permitieran conseguir más fondos a través de inversores.

Luego de la ronda inicial, los primeros fondos fueron utilizados, no para robustecer la arquitectura existente, sino para agregar más funcionalidad. Una de estas funcionalidades nuevas permite abrir cuentas en distintas monedas (que se respaldan en bancos existentes), y realizar operaciones de cambio entre éstas. El diferencial de arVault es tener la tasa de cambio más conveniente dentro de las aplicaciones que proveen este servicio. Para ganar usuarios, las tasas de cambio no tienen gap entre el valor de compra y de venta.

Si bien el lanzamiento fue exitoso, comenzaron a aparecer reclamos de los usuarios sobre problemas en el uso de la función de cambio de monedas. Estos reclamos llegaron en el peor momento, dado que arVault necesita captar más inversiones y, debido a la caída de la reputación y las reviews negativas, los potenciales inversores se niegan a aportar más fondos si no se realiza una auditoría y se mejora el servicio.

Frente a este reclamo, arVault decide contratar a un grupo de arquitectos (ustedes) para que evalúen, propongan e implementen soluciones que mejoren los atributos de calidad del servicio de cambio de monedas.

## Consigna

Realizar un análisis de la arquitectura, código e infraestructura recibidos. Determinar, indicar y **justificar** cuáles son los QA clave para este servicio.

Estudiar cómo los distintos QAs se ven influenciados según las decisiones de diseño que tomó el desarrollador (recorrer los QAs vistos en clase, incluir los que no son clave). Realizar una crítica fundamentada.

Hacer pruebas de carga, obtener y graficar métricas relevantes, para tener un panorama del comportamiento del servicio.

Proponer e implementar modificaciones aplicando tácticas. Verificar el impacto sobre los distintos QAs y mostrar resultados (métricas en los casos mensurables, ejecuciones en los otros). Si la evidencia no permite ver una diferencia, o si empeora algún atributo, discutir los motivos. Analizar el tradeoff entre distintos atributos (siempre aplicado a lo que implementen en el TP).

Realizar un **diagrama Components & Connectors** para el "caso base" (el recibido) y para todos los casos en los que se altere la arquitectura.

El informe debe estar correctamente redactado, asumiendo que quienes vayan a leerlo comprenden los conceptos de arquitectura, pero necesitan ver justificaciones de las recomendaciones.

### Pedidos adicionales

El fundador de arVault tiene un par de pedidos adicionales al análisis:

1. **[OBLIGATORIO]** Enterado de que se van a utilizar métricas para analizar el servicio, solicita que se agreguen métricas que muestren el **volumen** operado en cada moneda (compras y ventas sumadas por moneda), como así también el **neto** (compras suman y ventas restan), ambos a medida que transcurre el tiempo. Estas métricas deberían aparecer en el dashboard de alguno de los casos estudiados.
2. **[OPCIONAL]** Más allá de las tácticas que prueben para favorecer distintos QA, él les comenta que, según le parece, el servicio funcionaría mejor si la información que se almacena actualmente en archivos `.json` fuera almacenada en un base de datos externa (propone usar [Redis](https://redis.io/es/), pero pueden utilizar cualquier otro motor que prefieran). No sabe a cuáles QA impactaría (recién está leyendo sobre el tema), pero está dispuesto a dar un bonus para que este cambio forme parte del análisis e implementación y se discutan en el informe los pros y contras. Este pedido es **opcional** en esta entrega, recomendamos hacerlo si ven que el resto del TP está hecho de manera consistente y balanceada. Tengan en cuenta que en el TP 2 va a aparecer de manera obligatoria. Si lo prueban ahora, ganan tiempo para el siguiente TP.

## Desarrollo

- El servicio se encuentra en el directorio `app/`
- La única documentación de la que disponen es
  - El README del servicio, escrito por el desarrollador/fundador de arVault
  - Los comentarios en el código
  - Una colección de [Postman](https://www.postman.com/) en el directorio `doc/` que pueden utilizar para probar el servicio.
- En `docker-compose.yml` tienen la solución tal como corre en el único servidor disponible al momento de comenzar el proyecto.
- Para cambiar la configuración de nginx deben editar el archivo `nginx_reverse_proxy.conf`.

Para generar carga y ver las mediciones obtenidas, en el directorio `perf/` tienen un dashboard de Grafana ya armado (`dashboard.json`) al que **deberán ajustar según las características de su equipo de pruebas (RAM, cores)**, y al que pueden modificar agregando métricas o alterando las visualizaciones. Además, tienen un ejemplo de un escenario básico de Artillery (**deben** crear sus propios escenarios de manera apropiada para lo que estén probando). También hay un script y una configuración en el `package.json` para que puedan ejecutar los escenarios corriendo:

```./run-scenario.sh <filename> <env>```

donde `<filename>` es el nombre del archivo con el escenario (sin la extensión `.yaml`) y `<env>` es el entorno en el cual correrá la prueba (vean la sección `environments` dentro del yaml del escenario).

### Generación de carga para las pruebas

> **Importante**: Generen valores de carga que tengan relación con los tiempos que ven en la aplicación. No agrega valor que generen una carga enorme y luego cueste saber cuál de todos los componentes está fallando. Vayan de a poco con la carga y verifiquen cómo se van afectando los atributos de calidad.

Hay muchos tipos de escenarios de carga y pruebas de performance en general. Pueden leer por ejemplo [aquí](https://www.softwaretestingclass.com/what-is-performance-testing/) (o en cualquiera de los miles de links al googlear sobre el tema) sobre algunos tipos de escenarios que pueden implementar. Queda a decisión de cada grupo elegirlos, considerando siempre cuál es el que más útil les resulta para analizar lo que quieran estudiar.

## Tener en cuenta

- El tráfico entre el cliente y el servidor debe pasar por el nginx, para que tenga la latencia del salto extra.
- Asumimos que existe un componente que se encarga de los aspectos de **autenticación** y **autorización**, y que dicho componente solo permite que nos lleguen los requests apropiados. Tener en cuenta que ese servicio _solo se encarga de esos dos aspectos de Seguridad_.
- Para este TP, simplificamos la dependencia en un servicio de transferencia de fondos, que siempre funciona. La demora de cada request es generada al azar entre 200 y 400 milisegundos.

## Condiciones sobre la entrega

1. El trabajo debe entregarse **completo**. No se aceptan entregas parciales.
2. **Toda** afirmación que se realice debe estar apoyada en **evidencia**. Si se encuentra alguna afirmación que no está correctamente fundamentada con evidencia, se disminuirá la nota. Esto incluye las observaciones que realicen sobre el código y su funcionamiento en general. Que no existan métricas para un determinado QA no implica que no pueda evidenciarse el efecto de una táctica.
3. Asumimos que todo el grupo participa en la resolución del trabajo. De ocurrir problemas o surgir contratiempos, es el grupo quien debe responder y solucionarlos. Pueden consultar a los docentes pero deben demostrar primero que intentaron solucionarlos internamente.
4. Si utilizan uno o más agentes o herramientas de IA en la realización del TP, deberán agregar un apartado en el que detallen cuáles fueron los usos específicos que les dieron. Si se detecta un uso de IA no declarado se lo tomará como una falta grave.
5. De haber defectos importantes en el desarrollo o en el informe del TP, se solicitará una re-entrega. Esto tiene un impacto considerable en la nota final, por lo que les recomendamos que controlen entre todo el grupo el cumplimiento del enunciado, las conclusiones y las justificaciones antes de entregar el trabajo. Una vez más, no se considera a un TP hecho parcialmente como un caso de re-entrega. Tampoco se aceptan entregas con secciones sin desarrollar o con contenido de relleno.

-----------

## Links útiles

- Node.js: https://nodejs.org/
- Express: https://expressjs.com/
- Nginx: https://nginx.org/
- Redis: https://redis.io/
- Docker: https://www.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- StatsD: https://github.com/etsy/statsd
- Graphite: https://graphiteapp.org/
- Grafana: https://grafana.com/
- Artillery: https://artillery.io/docs/

## Pequeño cheatsheet de Docker

```sh
# Ver qué containers existen
docker ps [-a]

# Ver qué imagenes hay en mi máquina
docker images

# Ver uso de recursos de containers (como "top" en linux)
docker stats [--format <format_string>]

# Descargar una imagen
docker pull <image>[:<tag>]

# Eliminar un container
docker rm <container_id> [-f]

# Eliminar una imagen
docker rmi <image_id> [-f]
```

## Pequeño cheatsheet de Docker Compose

```sh
# Levantar servicios en background
docker-compose up -d

# Ver logs de los servicios
docker-compose logs -f

# Listar containers y sus estados
docker-compose ps

# Frenar y remover containers, redes y volúmenes
docker-compose down
```
