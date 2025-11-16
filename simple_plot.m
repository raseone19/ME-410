% VERSION SIMPLE - Plot basico de Pressure Pad
% Ideal para empezar y verificar que funciona la conexion

clear all; close all; clc;

%% CONFIGURACION - CAMBIAR AQUI TU PUERTO
COM_PORT = '/dev/cu.usbserial-0001';  % En Windows: 'COM3', 'COM4', etc.
                                       % En Mac: '/dev/cu.usbserial-xxxx'
                                       % En Linux: '/dev/ttyUSB0'

%% CONEXION
fprintf('Conectando a %s...\n', COM_PORT);
s = serialport(COM_PORT, 115200);
configureTerminator(s, "LF");
flush(s);

% Leer header
header = readline(s);
fprintf('OK! Header: %s\n\n', header);

%% CREAR FIGURA
figure('Position', [100, 100, 1000, 400]);
h = animatedline('Color', 'b', 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('Pressure Pad (mV)');
title('Lectura del Pressure Pad en Tiempo Real');
grid on;

fprintf('Presiona Ctrl+C para detener.\n\n');

%% LOOP DE LECTURA
try
    while true
        if s.NumBytesAvailable > 0
            line = readline(s);
            data = str2double(strsplit(line, ','));

            if length(data) == 5
                time_s = data(1) / 1000;  % ms -> s
                pp_mv = data(4);          % pressure pad (nueva posicion)

                addpoints(h, time_s, pp_mv);
                drawnow limitrate;

                fprintf('t=%.2fs  |  PP=%4.0f mV\n', time_s, pp_mv);
            end
        end
    end
catch
    fprintf('\nDetenido.\n');
end

%% CERRAR
delete(s);
fprintf('Puerto cerrado.\n');
