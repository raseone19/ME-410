% Plot SOLO del Voltaje del Motor y Pressure Pad
% Version directa para lo que pediste

clear all; close all; clc;

%% CONFIGURACION
COM_PORT = '/dev/cu.usbserial-110';  % CAMBIAR por tu puerto
VCC_MOTOR = 5.0;  % Voltaje de alimentacion del motor (ajustar si usas otro)

%% CONEXION
fprintf('Conectando a %s...\n', COM_PORT);
s = serialport(COM_PORT, 115200);
configureTerminator(s, "LF");
flush(s);

header = readline(s);
fprintf('Header: %s\n\n', header);

%% GRAFICO
figure('Position', [100, 100, 1200, 600]);

% Subplot 1: Voltaje del Motor DC
subplot(2, 1, 1);
h_voltage = animatedline('Color', [0.8500 0.3250 0.0980], 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('Voltaje Motor (V)');
title('Voltaje Aplicado al Motor DC');
grid on;
ylim([0 VCC_MOTOR]);
xlim([0 10]);

% Subplot 2: Pressure Pad
subplot(2, 1, 2);
h_pp = animatedline('Color', [0 0.4470 0.7410], 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('Pressure Pad (mV)');
title('Lectura del Pressure Pad');
grid on;
ylim([0 3300]);
xlim([0 10]);

fprintf('Presiona Ctrl+C para detener.\n\n');

%% LOOP
try
    while true
        if s.NumBytesAvailable > 0
            line = readline(s);
            data = str2double(strsplit(line, ','));

            if length(data) == 5
                time_ms = data(1);
                pp_value_mv = data(4);
                pwm_input_pct = data(5);

                % Convertir PWM% a Voltaje
                % PWM = 0-100% -> Voltage = 0-VCC_MOTOR
                voltage = (abs(pwm_input_pct) / 100.0) * VCC_MOTOR;

                time_s = time_ms / 1000.0;

                % Agregar puntos
                addpoints(h_voltage, time_s, voltage);
                addpoints(h_pp, time_s, pp_value_mv);

                % Actualizar ventana
                if time_s > 10
                    subplot(2, 1, 1);
                    xlim([time_s - 10, time_s]);
                    subplot(2, 1, 2);
                    xlim([time_s - 10, time_s]);
                end

                drawnow limitrate;

                fprintf('t=%.2fs | Motor=%.2fV | PP=%4.0fmV\n', time_s, voltage, pp_value_mv);
            end
        end
    end
catch
    fprintf('\nDetenido.\n');
end

%% CERRAR
delete(s);
fprintf('Puerto cerrado.\n');
