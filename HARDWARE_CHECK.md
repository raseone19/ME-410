# ⚠️ DIAGNÓSTICO: Potenciómetro no responde

## Problema detectado
Los valores impresos son constantes: `201.6,143.0,100.0`

Esto indica que:
- ✅ El motor funciona (PWM al 100%)
- ✅ El pressure pad funciona (lee 143 mV)
- ❌ **El potenciómetro NO cambia** (siempre lee ~201.6 mV de setpoint)

---

## 🔍 Pasos de diagnóstico

### PASO 1: Cargar el código actualizado con debug

He agregado un campo extra al CSV para ver el valor **RAW** del potenciómetro.

**Compilar y cargar:**
```bash
cd PID_motor_PP
pio run -t upload
pio device monitor
```

**Nuevo formato CSV:**
```csv
time_ms,pot_raw,reference_mv,pp_value_mv,pwm_input_pct
1000,45,201.6,143.0,100.0
```

El campo `pot_raw` debe estar entre **0-4095** (ADC de 12 bits).

---

### PASO 2: Usar el script de debug de MATLAB

```matlab
>> debug_potentiometer
```

Este script mostrará:
- Gráfico del valor RAW del potenciómetro (0-4095)
- Setpoint calculado
- Pressure pad
- PWM del motor

**Gira el potenciómetro mientras observas el gráfico.**

**Resultados esperados:**
- ✅ POT RAW cambia de **0 a 4095** al girar el pot → **Pot funciona correctamente**
- ❌ POT RAW se queda en **0-50** → **Problema de conexión/hardware**
- ❌ POT RAW no cambia al girar → **Pot dañado o cable suelto**

---

## 🔧 Verificación de Hardware

### Conexión del Potenciómetro

```
Potenciómetro (3 pines):
┌─────────────────┐
│   POTENTIOMETER │
│                 │
│  [1]  [2]  [3] │
└───┬────┬────┬───┘
    │    │    │
    │    │    └─── Pin 3: GND ────────→ ESP32 GND
    │    │
    │    └──────── Pin 2: WIPER ──────→ ESP32 Pin 34 (ADC1_CH6)
    │
    └───────────── Pin 1: VCC ────────→ ESP32 3.3V
```

**⚠️ IMPORTANTE:**
- El **WIPER** (pin central) debe ir al **Pin 34** del ESP32
- **NO conectar a 5V**, usar solo **3.3V** (el ADC del ESP32 es de 3.3V máximo)
- Verificar que no haya cables sueltos

---

### Motor DC (TB6612FNG)

```
Motor Driver TB6612:
  PWM  → ESP32 Pin 25
  IN1  → ESP32 Pin 27
  IN2  → ESP32 Pin 26
  VM   → Batería/fuente del motor (5-12V)
  VCC  → ESP32 3.3V
  GND  → ESP32 GND + GND de fuente motor
```

---

### Pressure Pad (FSR)

```
Pressure Pad + Resistor:
  Pin 39 ─┬─── FSR ─── VCC (3.3V)
          │
          └─── R(10kΩ) ─── GND
```

---

## 🧪 Test con Multímetro

### Test 1: Verificar potenciómetro
```
1. Desconectar el potenciómetro del ESP32
2. Medir resistencia entre pines 1-3: debe ser ~10kΩ (valor total)
3. Medir resistencia entre pines 1-2 mientras giras:
   - Mínimo: ~0Ω
   - Máximo: ~10kΩ
4. Si NO cambia → Potenciómetro dañado
```

### Test 2: Verificar voltaje en Pin 34
```
1. Conectar potenciómetro al ESP32
2. Medir voltaje en Pin 34 del ESP32 (con ESP32 encendido)
3. Girar el potenciómetro:
   - Mínimo: ~0V
   - Máximo: ~3.3V
4. Si NO cambia → Verificar conexión del WIPER
```

---

## 🛠️ Soluciones posibles

### Solución 1: Verificar conexiones físicas
- [ ] Wiper del pot conectado a Pin 34
- [ ] VCC del pot a 3.3V (NO 5V)
- [ ] GND del pot a GND
- [ ] Cables bien conectados (no sueltos)

### Solución 2: Verificar pin correcto
El código usa **Pin 34 (ADC1_CH6)**. Verifica en tu ESP32:
```cpp
constexpr uint8_t POT_PIN = 34;  // En main.cpp línea 43
```

Si tu potenciómetro está en **otro pin**, cambia este valor.

Pines ADC1 válidos en ESP32:
- 32, 33, 34, 35, 36, 37, 38, 39

### Solución 3: Probar con lectura directa en mV

Si el problema persiste, puedo cambiar el código para leer directamente en mV:

```cpp
// Cambiar de:
uint16_t pot_raw = readAveragedRaw(POT_PIN, 8);
// A:
uint16_t pot_mv = readAveragedMilliVolts(POT_PIN, 8);
```

---

## 📊 Valores esperados

| Pot girado a | RAW (0-4095) | mV (0-3300) | Setpoint (mV) |
|--------------|--------------|-------------|---------------|
| Mínimo       | 0            | 0           | 200           |
| 25%          | ~1024        | ~825        | 525           |
| 50%          | ~2048        | ~1650       | 850           |
| 75%          | ~3072        | ~2475       | 1175          |
| Máximo       | 4095         | 3300        | 1500          |

---

## 🚨 Si el POT RAW siempre lee ~0-50:

Hay un **problema de hardware**. Posibles causas:
1. **Wiper no conectado** → El pin 34 está flotando → lee 0
2. **Wiper conectado a GND** → Siempre lee 0
3. **Pot dañado** → Wiper en corto a GND

**Prueba esto:**
```cpp
// Temporalmente, agrega esto en setup() después de analogReadResolution(12):
pinMode(POT_PIN, INPUT_PULLUP);
```

Esto activará el pull-up interno. Si sigue leyendo 0, es porque hay un corto a GND.

---

## 📝 Próximos pasos

1. **Cargar código actualizado** con debug (ya está listo)
2. **Ejecutar `debug_potentiometer.m`** en MATLAB
3. **Girar el potenciómetro** y observar si POT RAW cambia
4. **Reportar resultados:**
   - ¿El valor POT RAW cambia al girar? (Sí/No)
   - ¿Qué rango de valores ves? (ej: 0-4095, o siempre 0-50)
5. Basado en eso, ajustaremos el código o el hardware

---

¿Necesitas ayuda adicional? Comparte los valores de `pot_raw` que ves en el monitor serial.
