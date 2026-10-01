# arVault - Servicio de cambio de monedas :money_with_wings: :currency_exchange:

La idea es tener un servicio que permita comprar y vender monedas dentro de la wallet. Se usan cuentas internas manejadas por la empresa. Por ahora, no se pueden configurar límites, el único límite es que una cuenta se quede sin plata.

Este servicio **no maneja seguridad**, eso lo resuelve vaultSec, para cuando llega al nginx, el request está autenticado y autorizado. TODO: replicar vaultSec!!! :fearful:.

## Configuración

El servicio tiene un Dockerfile para poder armar una imagen de Docker y levantarlo.

### Almacenamiento

Las cuentas internas, las tasas y el log se guardan en Redis. Al iniciar el entorno por primera vez, una de las réplicas carga los valores iniciales de `state/accounts.json` y `state/rates.json`. Las demás esperan a que termine esa carga para no pisar el estado compartido.

La validación y el descuento de fondos se ejecutan juntos mediante un script Lua de Redis. Así, dos réplicas no pueden aprobar operaciones concurrentes usando el mismo saldo disponible.

## Endpoints

### Tasas de cambio

`GET /rates`

Devuelve las tasas de cambio vigentes.

`PUT /rates`

Permite alterar la tasa entre dos monedas. Calcula la recíproca.

    {
    "baseCurrency": "USD",
    "counterCurrency": "ARS",
    "rate": 1064
    }

- `baseCurrency`: Moneda de origen
- `counterCurrency`: Moneda de destino
- `rate`: Tasa de cambio de la moneda origen hacia la destino. La recíproca se calcula como 1/tasa. Notar que no ganamos plata con la operación de cambio.

TODO

- Manejar distintos valores para ganar plata cuando tengamos una buena base de usuarios :smiling_imp:
- Soportar tiers de usuarios para que, si pagan algo por mes, tengan mejor tasa :rocket:

### Cuentas

`GET /accounts`

Devuelve las cuentas internas, sirve para chequear saldos.

`PUT /accounts/<id>/balance`

Actualiza el saldo de una cuenta. No me gusta cómo está hecho esto, otro servicio debería ocuparse de esto (el que hace las transferencias?)

### Cambio

`POST /exchange`

Ejecuta una operación de cambio de monedas

    {
        "baseCurrency": "USD",
        "counterCurrency": "ARS",
        "baseAmount": 100.0,
        "baseAccountId": 11,
        "counterAccountId": 10,
        "expectedRate": 1064
    }

- `baseCurrency`: Moneda origen de la transacción
- `counterCurrency`: Moneda destino de la transacción
- `baseAmount`: Importe en moneda origen a cambiar
- `baseAccountId`: ID de la cuenta origen para la operación de cambio (cuenta del cliente)
- `counterAccountId`: ID de la cuenta destino para la operación de cambio (cuenta del cliente)
- `expectedRate`: Cotización obtenida previamente de `GET /rates` y confirmada por el cliente. Funciona como precondición; la cotización autoritativa sigue siendo la almacenada en el servidor.

Este endpoint busca en las cuentas propias las que correspondan a las monedas. Se valida que haya saldo suficiente para efectuar la operación **en la cuenta propia**. **No** se valida que haya saldo en la cuenta del cliente, se espera que lo haga la UI y que no permita la operación.

Antes de iniciar transferencias, el servidor compara `expectedRate` con la cotización vigente. El cliente debe reenviar sin modificar el valor recibido de `GET /rates`. Si la cotización cambió, la operación no produce efectos y responde `409 Conflict`:

    {
        "ok": false,
        "error": "RATE_CHANGED",
        "exchangeRate": 1065,
        "counterAmount": 0,
        "obs": "The expected exchange rate is no longer available"
    }

El cliente debe obtener la nueva cotización y solicitar una nueva confirmación al usuario. Un body incompleto o un `expectedRate` que no sea un número positivo responde `400 Bad Request`.

Todas las operaciones se registran en un log. Ver más abajo.

### Logs

`GET /log`

Devuelve el log de operaciones almacenado en Redis.

## TODO

- No valida casi nada, solo que los parámetros de los JSON tengan algún valor :collision:
- Ver el tema del manejo de las cuentas, debería ser responsabilidad de otro servicio.
