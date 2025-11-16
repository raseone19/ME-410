# 🔌 Configuración del Multiplexer

## ✅ Código actualizado con soporte de Multiplexer

He actualizado el código para leer el potenciómetro y el pressure pad a través del **multiplexer analógico 16:1**.

---

## 📋 Configuración actual

### Multiplexer 16:1 (CD74HC4067 o similar)

**Pines de control:**
```cpp
MUX_S0  = Pin 23   // Selector bit 0
MUX_S1  = Pin 33   // Selector bit 1
MUX_S2  = Pin 32   // Selector bit 2
MUX_S3  = Pin 3    // Selector bit 3 (RX0)
MUX_SIG = Pin 35   // Señal analógica (salida del mux → ADC ESP32)
```

**Canales configurados:**
```cpp
POT_CHANNEL = 0   // Potenciómetro en C0 ✅
PP_CHANNEL  = 1   // Pressure Pad en C1 (VERIFICAR)
```

---

## ⚠️ IMPORTANTE: Verifica el canal del Pressure Pad

**Pregunta:** ¿En qué canal del multiplexer está conectado tu pressure pad?

Posibles canales: C0, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15

### Si NO es C1, cambia esta línea en `main.cpp` (línea 43):

```cpp
constexpr uint8_t PP_CHANNEL  = 1;   // Cambiar por el canal correcto
```

**Ejemplos:**
- Si el PP está en C3: `constexpr uint8_t PP_CHANNEL = 3;`
- Si el PP está en C6: `constexpr uint8_t PP_CHANNEL = 6;`
- Si el PP está en C8: `constexpr uint8_t PP_CHANNEL = 8;`

---

## 🔍 Cómo verificar qué canal usa cada sensor

### Opción 1: Revisar el proyecto Multi_5PP

Si usaste el proyecto **Multi_5PP** antes, abre el archivo:
```
/Users/miguelmoorcastro/Desktop/EPFL/410/Projects/Multi_5PP/src/main.cpp
```

Busca las líneas 19-25:
```cpp
constexpr uint8_t PP_CHANNELS[NUM_PP] = {
  1,  // PP1 -> C1
  2,  // PP2 -> C2
  3,  // PP3 -> C3
  6,  // PP4 -> C6
  8   // PP5 -> C8
};
```

Identifica cuál de esos canales corresponde a tu pressure pad.

### Opción 2: Revisar el esquema/conexiones físicas

Mira las conexiones físicas del multiplexer:
- El multiplexer tiene 16 canales de entrada (C0-C15)
- Identifica a qué canal físico está conectado el cable del pressure pad

---

## 🧪 Tabla de Canales del Multiplexer

| Canal | S3 | S2 | S1 | S0 | Binario | Decimal |
|-------|----|----|----|----|---------|---------|
| C0    | 0  | 0  | 0  | 0  | 0000    | 0       |
| C1    | 0  | 0  | 0  | 1  | 0001    | 1       |
| C2    | 0  | 0  | 1  | 0  | 0010    | 2       |
| C3    | 0  | 0  | 1  | 1  | 0011    | 3       |
| C4    | 0  | 1  | 0  | 0  | 0100    | 4       |
| C5    | 0  | 1  | 0  | 1  | 0101    | 5       |
| C6    | 0  | 1  | 1  | 0  | 0110    | 6       |
| C7    | 0  | 1  | 1  | 1  | 0111    | 7       |
| C8    | 1  | 0  | 0  | 0  | 1000    | 8       |
| ...   | ...| ...| ...| ...| ...     | ...     |

La función `setMuxChannel(channel)` configura automáticamente S0-S3 según el número de canal.

---

## 🔧 Cambios realizados en el código

### 1. Agregadas funciones del multiplexer:

```cpp
void setMuxChannel(uint8_t channel)
```
Selecciona un canal del multiplexer (0-15)

```cpp
uint16_t readMuxRawAveraged(uint8_t channel, int samples)
```
Lee un canal en RAW (0-4095) con promediado

```cpp
uint16_t readMuxMilliVoltsAveraged(uint8_t channel, int samples)
```
Lee un canal en mV (0-3300) con promediado

### 2. Configuración en setup():

- Se configuran los pines S0, S1, S2, S3 como OUTPUT
- Se configura MUX_SIG (Pin 35) como entrada analógica
- Se inicializa el mux en canal C0

### 3. Lectura en loop():

- **Potenciómetro:** `readMuxRawAveraged(POT_CHANNEL, 8)` → Canal C0
- **Pressure Pad:** `readMuxMilliVoltsAveraged(PP_CHANNEL, 8)` → Canal C1 (ajustar si es otro)

---

## 🚀 Próximos pasos

### Paso 1: Confirmar canal del Pressure Pad

Responde: **¿En qué canal (C0-C15) está el pressure pad?**

Si no lo sabes, prueba cargando el código actual (asumiendo C1) y observa si el valor del PP cambia al presionarlo.

### Paso 2: Modificar si es necesario

Si el PP está en otro canal (ej: C3), edita `main.cpp` línea 43:
```cpp
constexpr uint8_t PP_CHANNEL  = 3;   // Cambiar número
```

### Paso 3: Compilar y cargar

```bash
cd /Users/miguelmoorcastro/Desktop/EPFL/410/Projects/PID_motor_PP
pio run -t upload
```

### Paso 4: Usar el script de debug

```matlab
>> debug_potentiometer
```

Ahora deberías ver:
- **pot_raw** cambiando de **0 a 4095** cuando giras el potenciómetro ✅
- **pp_value_mv** cambiando cuando presionas el pressure pad ✅

---

## 📊 Output esperado

```csv
time_ms,pot_raw,reference_mv,pp_value_mv,pwm_input_pct
1000,0,200.0,150.0,50.0          ← Pot al mínimo
2000,2048,850.0,780.5,20.5       ← Pot a la mitad
3000,4095,1500.0,1450.2,5.0      ← Pot al máximo
```

Ahora `pot_raw` debe **cambiar** al girar el potenciómetro. 🎉

---

## 🛠️ Troubleshooting

### El pot_raw sigue sin cambiar

1. Verifica que el potenciómetro esté conectado al canal C0 del multiplexer (físicamente)
2. Verifica las conexiones S0, S1, S2, S3, SIG del multiplexer
3. Revisa que VCC y GND del multiplexer estén conectados

### El pressure pad no responde

1. Verifica el canal correcto (probablemente no es C1)
2. Cambia `PP_CHANNEL` al canal correcto en `main.cpp`
3. Re-compila y carga

### Error de compilación

Si ves errores de "undeclared identifier":
- Asegúrate de haber guardado todos los cambios en `main.cpp`
- Verifica que las funciones del multiplexer estén antes del setup()

---

¿En qué canal está tu pressure pad? Una vez que me lo confirmes, ajustaré el código si es necesario.
