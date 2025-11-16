% DEBUG: Ver valores RAW del potenciometro
% Este script te ayudara a diagnosticar el problema del potenciometro

clear all; close all; clc;

%% CONFIGURACION
COM_PORT = '/dev/cu.usbserial-0001';  % CAMBIAR por tu puerto

%% CONEXION
fprintf('Conectando a %s...\n', COM_PORT);
s = serialport(COM_PORT, 115200);
configureTerminator(s, "LF");
flush(s);

header = readline(s);
fprintf('Header: %s\n\n', header);

%% GRAFICO
figure('Position', [100, 100, 1200, 800]);

% Plot 1: Valor RAW del potenciometro
subplot(4, 1, 1);
h_raw = animatedline('Color', 'k', 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('Potenciometro RAW (0-4095)');
title('Valor RAW del Potenciometro (ADC 12-bit)');
grid on;
ylim([0 4095]);
xlim([0 10]);

% Plot 2: Setpoint (reference)
subplot(4, 1, 2);
h_ref = animatedline('Color', [0.8 0.8 0.8], 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('Setpoint (mV)');
title('Setpoint calculado desde el Potenciometro');
grid on;
ylim([0 2000]);
xlim([0 10]);

% Plot 3: Pressure Pad
subplot(4, 1, 3);
h_pp = animatedline('Color', 'b', 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('Pressure Pad (mV)');
title('Lectura del Pressure Pad');
grid on;
ylim([0 3300]);
xlim([0 10]);

% Plot 4: PWM
subplot(4, 1, 4);
h_pwm = animatedline('Color', 'r', 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('PWM (%)');
title('PWM del Motor');
grid on;
ylim([-100 100]);
xlim([0 10]);

fprintf('================================================================\n');
fprintf('INSTRUCCIONES:\n');
fprintf('1. Gira el potenciometro desde minimo hasta maximo\n');
fprintf('2. Observa si el valor RAW cambia (debe ir de 0 a 4095)\n');
fprintf('3. Si RAW no cambia, hay un problema de conexion del pot\n');
fprintf('4. Presiona Ctrl+C para detener\n');
fprintf('================================================================\n\n');

fprintf('%-10s | %-12s | %-12s | %-12s | %-8s\n', ...
        'Tiempo', 'POT RAW', 'Setpoint', 'PP Value', 'PWM');
fprintf('----------------------------------------------------------------\n');

%% LOOP
try
    while true
        if s.NumBytesAvailable > 0
            line = readline(s);
            % Nuevo formato: time_ms,pot_raw,reference_mv,pp_value_mv,pwm_input_pct
            data = str2double(strsplit(line, ','));

            if length(data) == 5
                time_ms = data(1);
                pot_raw = data(2);
                reference_mv = data(3);
                pp_value_mv = data(4);
                pwm_input_pct = data(5);

                time_s = time_ms / 1000.0;

                % Agregar puntos
                addpoints(h_raw, time_s, pot_raw);
                addpoints(h_ref, time_s, reference_mv);
                addpoints(h_pp, time_s, pp_value_mv);
                addpoints(h_pwm, time_s, pwm_input_pct);

                % Actualizar ventana
                if time_s > 10
                    for i = 1:4
                        subplot(4, 1, i);
                        xlim([time_s - 10, time_s]);
                    end
                end

                drawnow limitrate;

                % Imprimir cada 1 segundo
                if mod(round(time_ms), 1000) < 50
                    fprintf('%-10.1fs | %-12d | %-12.1f | %-12.1f | %-8.1f\n', ...
                            time_s, pot_raw, reference_mv, pp_value_mv, pwm_input_pct);
                end
            end
        end
    end
catch
    fprintf('\n*** Detenido ***\n');
end

%% DIAGNOSTICO
fprintf('\n================================================================\n');
fprintf('DIAGNOSTICO:\n');
fprintf('================================================================\n');

if exist('pot_raw', 'var')
    fprintf('Ultimo valor POT RAW: %d (esperado: 0-4095)\n', pot_raw);

    if pot_raw < 50
        fprintf('\n!! PROBLEMA DETECTADO !!\n');
        fprintf('El potenciometro lee valores muy bajos (cerca de 0).\n');
        fprintf('Posibles causas:\n');
        fprintf('  1. El potenciometro no esta conectado correctamente\n');
        fprintf('  2. El pin del potenciometro esta mal (verificar Pin 34)\n');
        fprintf('  3. El potenciometro esta en corto a GND\n');
        fprintf('  4. El wiper del potenciometro esta conectado a GND\n\n');
        fprintf('SOLUCION:\n');
        fprintf('  - Verificar conexiones: VCC, GND, WIPER\n');
        fprintf('  - El WIPER del pot debe ir al Pin 34 del ESP32\n');
        fprintf('  - VCC del pot debe ir a 3.3V\n');
        fprintf('  - GND del pot debe ir a GND\n');
    elseif pot_raw > 4000
        fprintf('\n!! ADVERTENCIA !!\n');
        fprintf('El potenciometro lee valores muy altos (cerca de 4095).\n');
        fprintf('Esto puede ser normal si el pot esta al maximo.\n');
        fprintf('Gira el pot a minimo y verifica si el valor baja a ~0.\n');
    else
        fprintf('\nEl valor RAW parece estar en rango normal.\n');
        fprintf('Si el valor NO CAMBIA al girar el pot, verifica:\n');
        fprintf('  - Cable del WIPER conectado correctamente\n');
        fprintf('  - Pot no este dañado (medir con multimetro)\n');
    end
end

%% CERRAR
delete(s);
fprintf('\nPuerto cerrado.\n');
