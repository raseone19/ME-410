% Real-time plotting of Pressure Pad and Motor PWM
% Para el proyecto PID_motor_PP con ESP32
%
% Instrucciones:
% 1. Conectar el ESP32 al puerto USB
% 2. Cambiar 'COM_PORT' por el puerto correcto (ej: 'COM3' en Windows, '/dev/ttyUSB0' en Linux)
% 3. Ejecutar este script en MATLAB
% 4. Presionar Ctrl+C para detener

clear all; close all; clc;

%% CONFIGURACION
COM_PORT = '/dev/cu.usbserial-0001';  % Cambiar por tu puerto
BAUD_RATE = 115200;
MAX_POINTS = 500;  % Numero maximo de puntos en el grafico

%% CONEXION SERIAL
fprintf('Conectando al puerto %s...\n', COM_PORT);
s = serialport(COM_PORT, BAUD_RATE);
configureTerminator(s, "LF");
flush(s);

% Esperar a que el ESP32 envie el header
fprintf('Esperando header CSV...\n');
header = readline(s);
fprintf('Header recibido: %s\n', header);

%% CONFIGURACION DEL GRAFICO
fig = figure('Name', 'Real-time Pressure Pad & Motor PWM', 'NumberTitle', 'off');
set(fig, 'Position', [100, 100, 1200, 600]);

% Subplot 1: Pressure Pad
subplot(2, 1, 1);
h_pp = animatedline('Color', 'b', 'LineWidth', 1.5);
xlabel('Tiempo (s)');
ylabel('Pressure Pad (mV)');
title('Presion del Pressure Pad');
grid on;
ylim([0 3300]);  % Ajustar segun tu sensor
xlim([0 10]);

% Subplot 2: Motor PWM
subplot(2, 1, 2);
h_pwm = animatedline('Color', 'r', 'LineWidth', 1.5);
xlabel('Tiempo (s)');
ylabel('Motor PWM (%)');
title('PWM Aplicado al Motor DC');
grid on;
ylim([-100 100]);  % PWM puede ser negativo (reversa)
xlim([0 10]);

%% LECTURA Y PLOTEO EN TIEMPO REAL
fprintf('Iniciando lectura de datos...\n');
fprintf('Presiona Ctrl+C para detener.\n\n');

% Variables para almacenar datos
time_start = tic;
count = 0;

try
    while true
        % Leer linea del serial
        if s.NumBytesAvailable > 0
            data_line = readline(s);

            % Parsear CSV: time_ms,pot_raw,reference_mv,pp_value_mv,pwm_input_pct
            data = str2double(strsplit(data_line, ','));

            if length(data) == 5
                time_ms = data(1);
                reference_mv = data(3);
                pp_value_mv = data(4);
                pwm_input_pct = data(5);

                % Convertir tiempo a segundos
                time_s = time_ms / 1000.0;

                % Agregar puntos a las lineas animadas
                addpoints(h_pp, time_s, pp_value_mv);
                addpoints(h_pwm, time_s, pwm_input_pct);

                % Actualizar limites del eje X
                if time_s > 10
                    subplot(2, 1, 1);
                    xlim([time_s - 10, time_s]);
                    subplot(2, 1, 2);
                    xlim([time_s - 10, time_s]);
                end

                % Actualizar grafico
                drawnow limitrate;

                % Imprimir datos cada 50 muestras
                count = count + 1;
                if mod(count, 50) == 0
                    fprintf('t=%.2fs | PP=%4.0f mV | PWM=%+5.1f%%\n', ...
                            time_s, pp_value_mv, pwm_input_pct);
                end
            end
        end
    end

catch ME
    if strcmp(ME.identifier, 'MATLAB:interruption')
        fprintf('\nLectura detenida por el usuario.\n');
    else
        fprintf('\nError: %s\n', ME.message);
    end
end

%% CERRAR PUERTO SERIAL
fprintf('Cerrando puerto serial...\n');
delete(s);
clear s;
fprintf('Puerto cerrado. Fin.\n');
