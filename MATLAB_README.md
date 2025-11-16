# MATLAB - Plotting en Tiempo Real

Scripts de MATLAB para visualizar datos del ESP32 en tiempo real.

---

## 📋 Scripts Disponibles

### 1. `simple_plot.m` - **Empezar aquí**
Plot básico solo del pressure pad. Ideal para verificar que todo funciona.

**Uso:**
```matlab
% 1. Abrir simple_plot.m en MATLAB
% 2. Cambiar la linea 6 con tu puerto serial
% 3. Presionar F5 o "Run"
```

**Output:** Gráfico simple del pressure pad vs tiempo.

---

### 2. `realtime_plot.m` - **Recomendado**
Plot dual: Pressure Pad + PWM del motor en dos subplots.

**Uso:**
```matlab
% 1. Conectar ESP32 al USB
% 2. Modificar COM_PORT en linea 16
% 3. Ejecutar script
```

**Features:**
- Subplot 1: Pressure Pad (mV)
- Subplot 2: Motor PWM (%)
- Ventana deslizante de 10 segundos
- Imprime datos cada 50 muestras

---

### 3. `realtime_plot_advanced.m` - **Completo**
Versión avanzada con estadísticas y guardado de datos.

**Features adicionales:**
- Plot de Setpoint vs Pressure Pad
- Plot del error de seguimiento
- Estadísticas en tiempo real
- Guarda datos en archivo `.mat` al finalizar (Ctrl+C)
- Genera plot final estático

**Datos guardados:**
```matlab
motor_data.time_s            % Tiempo en segundos
motor_data.reference_mv      % Setpoint del potenciómetro
motor_data.pressure_pad_mv   % Lectura del pressure pad
motor_data.pwm_pct           % PWM aplicado al motor
```

**Para cargar datos después:**
```matlab
load('motor_data_20241114_123456.mat')
plot(motor_data.time_s, motor_data.pressure_pad_mv)
```

---

## 🔧 Configuración Inicial

### 1. Encontrar el puerto serial

#### Windows:
```matlab
serialportlist("available")
% Output: "COM3", "COM4", etc.
```

#### Mac:
```bash
ls /dev/cu.*
% Output: /dev/cu.usbserial-0001
```

#### Linux:
```bash
ls /dev/ttyUSB*
% Output: /dev/ttyUSB0
```

### 2. Modificar el script
Abrir el script y cambiar:
```matlab
COM_PORT = 'TU_PUERTO_AQUI';  % Ejemplo: 'COM3' o '/dev/cu.usbserial-0001'
```

### 3. Ejecutar
Presionar **F5** o click en **Run** en MATLAB.

---

## 📊 Formato de Datos

El ESP32 envía datos en CSV por serial a 115200 baudios:

```csv
time_ms,reference_mv,pp_value_mv,pwm_input_pct
1000,850.5,820.3,45.2
1020,900.0,855.1,42.8
1040,920.0,890.5,38.5
...
```

**Columnas:**
1. `time_ms`: Timestamp en milisegundos desde el inicio
2. `reference_mv`: Setpoint generado por el potenciómetro (200-1500 mV)
3. `pp_value_mv`: Lectura del pressure pad en mV
4. `pwm_input_pct`: Comando PWM al motor (-100 a +100%, negativo = reversa)

**Frecuencia:** 50 Hz (cada 20 ms)

---

## 🚀 Ejemplo de Uso Completo

```matlab
%% 1. VERIFICAR PUERTO
serialportlist("available")

%% 2. PLOT SIMPLE (verificar conexion)
% Abrir simple_plot.m, cambiar puerto, ejecutar

%% 3. PLOT AVANZADO (experimento real)
% Abrir realtime_plot_advanced.m, ejecutar
% Girar el potenciometro para cambiar el setpoint
% Observar como el control PI ajusta el motor
% Presionar Ctrl+C para detener y guardar

%% 4. ANALIZAR DATOS GUARDADOS
load('motor_data_20241114_123456.mat')

figure;
subplot(2,1,1)
plot(motor_data.time_s, motor_data.reference_mv, '--', 'LineWidth', 2)
hold on
plot(motor_data.time_s, motor_data.pressure_pad_mv, 'LineWidth', 2)
legend('Setpoint', 'Measured')
ylabel('Presion (mV)')
grid on

subplot(2,1,2)
plot(motor_data.time_s, motor_data.pwm_pct, 'LineWidth', 2)
ylabel('PWM (%)')
xlabel('Tiempo (s)')
grid on
```

---

## ⚠️ Troubleshooting

### Error: "Unable to connect to port"
- **Causa:** Puerto ocupado o incorrecto
- **Solución:**
  - Cerrar Arduino IDE / PlatformIO Monitor
  - Verificar puerto con `serialportlist("available")`
  - Desconectar/reconectar USB

### Error: "Permission denied" (Linux/Mac)
```bash
sudo chmod 666 /dev/ttyUSB0
# o agregar usuario al grupo dialout:
sudo usermod -a -G dialout $USER
# Luego logout/login
```

### Plot no se actualiza
- **Causa:** Buffer serial lleno
- **Solución:** Agregar `flush(s)` antes del loop

### Datos con NaN
- **Causa:** ESP32 aún no empezó a enviar
- **Solución:** Esperar 2-3 segundos después de conectar

---

## 💡 Tips

1. **Ventana deslizante:** Los scripts usan una ventana de 10 segundos. Para cambiar:
   ```matlab
   xlim([time_s - 20, time_s]);  % Ventana de 20 segundos
   ```

2. **Cambiar frecuencia de actualización:**
   ```matlab
   drawnow limitrate;  % Max 20 Hz (recomendado)
   drawnow;            % Sin limite (puede ser lento)
   ```

3. **Exportar a Excel:**
   ```matlab
   load('motor_data_20241114_123456.mat')
   T = table(motor_data.time_s', motor_data.reference_mv', ...
             motor_data.pressure_pad_mv', motor_data.pwm_pct', ...
             'VariableNames', {'Time_s', 'Reference_mV', 'PressurePad_mV', 'PWM_pct'});
   writetable(T, 'motor_data.xlsx')
   ```

4. **Calcular tiempo de establecimiento:**
   ```matlab
   % Encontrar cuando el error < 5% del setpoint
   error = abs(motor_data.reference_mv - motor_data.pressure_pad_mv);
   threshold = 0.05 * mean(motor_data.reference_mv);
   settling_idx = find(error < threshold, 1);
   settling_time = motor_data.time_s(settling_idx);
   fprintf('Tiempo de establecimiento: %.2f s\n', settling_time);
   ```

---

## 📝 Notas

- El control PI tiene **Kp=0.15** y **Ki=0.60** (configurables en `main.cpp`)
- El deadband del motor es **40%** (MIN_RUN en `main.cpp`)
- PWM negativo indica rotación en reversa
- El potenciómetro genera setpoints de 200-1500 mV

---

¡Listo para plotear! 🎉
