% Real-time plotting con guardado de datos
% Version avanzada con estadisticas y exportacion
%
% Funciones adicionales:
% - Guarda datos en archivo .mat
% - Muestra estadisticas en tiempo real
% - Plot del setpoint (reference) tambien

clear all; close all; clc;

%% CONFIGURACION
COM_PORT = '/dev/cu.usbserial-10';  % CAMBIAR por tu puerto
BAUD_RATE = 115200;
MAX_POINTS = 1000;  % Numero maximo de puntos
SAVE_DATA = true;   % Guardar datos al finalizar

%% CONEXION SERIAL
fprintf('Conectando al puerto %s...\n', COM_PORT);
s = serialport(COM_PORT, BAUD_RATE);
configureTerminator(s, "LF");
flush(s);

% Esperar header
fprintf('Esperando header CSV...\n');
header = readline(s);
fprintf('Header: %s\n', header);

%% CONFIGURACION DEL GRAFICO
fig = figure('Name', 'Motor PI Control - Real-time Monitor', 'NumberTitle', 'off');
set(fig, 'Position', [50, 50, 1400, 800]);

% Subplot 1: Setpoint vs Pressure Pad
subplot(3, 1, 1);
h_ref = animatedline('Color', [0.8 0.8 0.8], 'LineWidth', 2, 'LineStyle', '--');
hold on;
h_pp = animatedline('Color', [0 0.4470 0.7410], 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('Presion (mV)');
title('Setpoint (referencia) vs Pressure Pad (medido)');
legend('Setpoint', 'Pressure Pad', 'Location', 'northwest');
grid on;
ylim([0 2000]);
xlim([0 10]);

% Subplot 2: Error de seguimiento
subplot(3, 1, 2);
h_error = animatedline('Color', [0.8500 0.3250 0.0980], 'LineWidth', 1.5);
xlabel('Tiempo (s)');
ylabel('Error (mV)');
title('Error de seguimiento (Setpoint - Pressure Pad)');
grid on;
ylim([-500 500]);
xlim([0 10]);
yline(0, 'k--', 'LineWidth', 1);

% Subplot 3: Motor PWM
subplot(3, 1, 3);
h_pwm = animatedline('Color', [0.4660 0.6740 0.1880], 'LineWidth', 2);
xlabel('Tiempo (s)');
ylabel('PWM (%)');
title('Comando PWM al Motor DC');
grid on;
ylim([-100 100]);
xlim([0 10]);
yline(0, 'k--', 'LineWidth', 1);

% Text box para estadisticas
annotation('textbox', [0.15, 0.02, 0.7, 0.05], ...
           'String', 'Esperando datos...', ...
           'FitBoxToText', 'on', ...
           'BackgroundColor', 'white', ...
           'EdgeColor', 'black', ...
           'Tag', 'StatsBox');

%% ARRAYS PARA GUARDAR DATOS
time_data = [];
ref_data = [];
pp_data = [];
pwm_data = [];

%% LECTURA Y PLOTEO EN TIEMPO REAL
fprintf('Iniciando lectura...\n');
fprintf('Presiona Ctrl+C para detener y guardar.\n\n');

count = 0;
start_matlab_time = tic;

try
    while true
        if s.NumBytesAvailable > 0
            data_line = readline(s);

            % Parsear: time_ms,pot_raw,reference_mv,pp_value_mv,pwm_input_pct
            data = str2double(strsplit(data_line, ','));

            if length(data) == 5 && ~any(isnan(data))
                time_ms = data(1);
                reference_mv = data(3);
                pp_value_mv = data(4);
                pwm_input_pct = data(5);

                time_s = time_ms / 1000.0;
                error_mv = reference_mv - pp_value_mv;

                % Guardar datos
                time_data(end+1) = time_s;
                ref_data(end+1) = reference_mv;
                pp_data(end+1) = pp_value_mv;
                pwm_data(end+1) = pwm_input_pct;

                % Limitar tamano de arrays
                if length(time_data) > MAX_POINTS
                    time_data = time_data(end-MAX_POINTS+1:end);
                    ref_data = ref_data(end-MAX_POINTS+1:end);
                    pp_data = pp_data(end-MAX_POINTS+1:end);
                    pwm_data = pwm_data(end-MAX_POINTS+1:end);
                end

                % Agregar a plots
                addpoints(h_ref, time_s, reference_mv);
                addpoints(h_pp, time_s, pp_value_mv);
                addpoints(h_error, time_s, error_mv);
                addpoints(h_pwm, time_s, pwm_input_pct);

                % Actualizar limites X
                if time_s > 10
                    for i = 1:3
                        subplot(3, 1, i);
                        xlim([time_s - 10, time_s]);
                    end
                end

                % Actualizar estadisticas cada 25 muestras
                count = count + 1;
                if mod(count, 25) == 0 && length(pp_data) > 10
                    % Calcular estadisticas de los ultimos 100 puntos
                    recent_idx = max(1, length(pp_data)-100):length(pp_data);
                    mean_pp = mean(pp_data(recent_idx));
                    std_pp = std(pp_data(recent_idx));
                    mean_error = mean(ref_data(recent_idx) - pp_data(recent_idx));
                    mean_pwm = mean(pwm_data(recent_idx));

                    stats_str = sprintf('Muestras: %d | PP: %.0f±%.0f mV | Error medio: %+.0f mV | PWM medio: %+.1f%%', ...
                                       length(time_data), mean_pp, std_pp, mean_error, mean_pwm);

                    h_stats = findobj('Tag', 'StatsBox');
                    set(h_stats, 'String', stats_str);

                    fprintf('[%.1fs] %s\n', time_s, stats_str);
                end

                drawnow limitrate;
            end
        end
    end

catch ME
    if strcmp(ME.identifier, 'MATLAB:interruption')
        fprintf('\n*** Lectura detenida por el usuario ***\n');
    else
        fprintf('\nError: %s\n', ME.message);
    end
end

%% GUARDAR DATOS
if SAVE_DATA && ~isempty(time_data)
    timestamp = datestr(now, 'yyyymmdd_HHMMSS');
    filename = sprintf('motor_data_%s.mat', timestamp);

    % Crear estructura de datos
    motor_data.time_s = time_data;
    motor_data.reference_mv = ref_data;
    motor_data.pressure_pad_mv = pp_data;
    motor_data.pwm_pct = pwm_data;
    motor_data.sampling_rate_hz = 50;
    motor_data.timestamp = timestamp;

    save(filename, 'motor_data');
    fprintf('\nDatos guardados en: %s\n', filename);
    fprintf('Total de muestras: %d\n', length(time_data));

    % Crear plot final estatico
    figure('Name', 'Datos guardados', 'NumberTitle', 'off');

    subplot(3, 1, 1);
    plot(time_data, ref_data, '--', 'LineWidth', 1.5, 'Color', [0.8 0.8 0.8]);
    hold on;
    plot(time_data, pp_data, 'LineWidth', 2, 'Color', [0 0.4470 0.7410]);
    xlabel('Tiempo (s)');
    ylabel('Presion (mV)');
    title('Setpoint vs Pressure Pad');
    legend('Setpoint', 'Pressure Pad');
    grid on;

    subplot(3, 1, 2);
    plot(time_data, ref_data - pp_data, 'LineWidth', 1.5, 'Color', [0.8500 0.3250 0.0980]);
    xlabel('Tiempo (s)');
    ylabel('Error (mV)');
    title('Error de seguimiento');
    grid on;
    yline(0, 'k--');

    subplot(3, 1, 3);
    plot(time_data, pwm_data, 'LineWidth', 2, 'Color', [0.4660 0.6740 0.1880]);
    xlabel('Tiempo (s)');
    ylabel('PWM (%)');
    title('Comando PWM');
    grid on;
    yline(0, 'k--');
end

%% CERRAR PUERTO
fprintf('Cerrando puerto serial...\n');
delete(s);
clear s;
fprintf('Finalizado.\n');
