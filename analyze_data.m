% Script para analizar datos guardados
% Cargar archivo .mat y realizar analisis de performance

clear all; close all; clc;

%% CARGAR DATOS
fprintf('Archivos .mat disponibles:\n');
files = dir('motor_data_*.mat');
for i = 1:length(files)
    fprintf('%d. %s\n', i, files(i).name);
end

if isempty(files)
    error('No se encontraron archivos motor_data_*.mat');
end

% Cargar el archivo mas reciente
[~, idx] = max([files.datenum]);
filename = files(idx).name;
fprintf('\nCargando: %s\n', filename);
load(filename);

%% EXTRAER DATOS
t = motor_data.time_s;
ref = motor_data.reference_mv;
pp = motor_data.pressure_pad_mv;
pwm = motor_data.pwm_pct;
error = ref - pp;

fprintf('\n=== RESUMEN DE DATOS ===\n');
fprintf('Duracion total: %.2f segundos\n', max(t) - min(t));
fprintf('Numero de muestras: %d\n', length(t));
fprintf('Frecuencia de muestreo: %.1f Hz\n', motor_data.sampling_rate_hz);

%% ANALISIS DE PERFORMANCE

% 1. Error RMS
rms_error = sqrt(mean(error.^2));
fprintf('\nError RMS: %.2f mV\n', rms_error);

% 2. Error maximo
max_error = max(abs(error));
fprintf('Error maximo: %.2f mV\n', max_error);

% 3. Error medio
mean_error = mean(error);
fprintf('Error medio: %.2f mV\n', mean_error);

% 4. Desviacion estandar del pressure pad
std_pp = std(pp);
fprintf('Desviacion std del PP: %.2f mV\n', std_pp);

% 5. Valor medio de PWM
mean_pwm = mean(pwm);
fprintf('PWM medio: %.2f %%\n', mean_pwm);

% 6. Detectar cambios de setpoint (steps)
diff_ref = diff(ref);
step_threshold = 50; % mV
step_indices = find(abs(diff_ref) > step_threshold);

if ~isempty(step_indices)
    fprintf('\nDetectados %d cambios de setpoint (steps)\n', length(step_indices));

    % Analizar primer step (si existe)
    if length(step_indices) >= 1
        step_idx = step_indices(1);
        step_start = t(step_idx);

        % Buscar tiempo de establecimiento (settling time)
        % Criterio: error < 5% del step durante al menos 0.5s
        step_magnitude = abs(ref(step_idx+1) - ref(step_idx));
        settling_criterion = 0.05 * step_magnitude;

        % Buscar desde el step hacia adelante
        search_window = step_idx:min(step_idx+500, length(t));
        settled = false;

        for i = search_window
            % Verificar si se mantiene dentro del criterio por 0.5s
            future_window = i:min(i+25, length(error)); % 25 samples @ 50Hz = 0.5s
            if all(abs(error(future_window)) < settling_criterion)
                settling_time = t(i) - step_start;
                settled = true;
                fprintf('Tiempo de establecimiento (2%% settling): %.3f s\n', settling_time);
                break;
            end
        end

        if ~settled
            fprintf('El sistema no alcanzo el settling criterion\n');
        end

        % Overshoot
        response_window = step_idx:min(step_idx+200, length(pp));
        final_value = ref(step_idx+1);
        overshoot = max(abs(pp(response_window) - final_value));
        overshoot_pct = (overshoot / step_magnitude) * 100;
        fprintf('Overshoot: %.2f mV (%.1f%%)\n', overshoot, overshoot_pct);
    end
end

%% PLOTS DETALLADOS

figure('Position', [50, 50, 1400, 900]);

% Plot 1: Setpoint vs Medicion
subplot(4, 1, 1);
plot(t, ref, '--', 'LineWidth', 1.5, 'Color', [0.5 0.5 0.5]);
hold on;
plot(t, pp, 'LineWidth', 2, 'Color', [0 0.4470 0.7410]);
ylabel('Presion (mV)');
title(sprintf('Setpoint vs Pressure Pad - %s', filename), 'Interpreter', 'none');
legend('Setpoint', 'Pressure Pad', 'Location', 'best');
grid on;

% Plot 2: Error
subplot(4, 1, 2);
plot(t, error, 'LineWidth', 1.5, 'Color', [0.8500 0.3250 0.0980]);
hold on;
yline(0, 'k--', 'LineWidth', 1);
yline(mean_error, 'r--', 'LineWidth', 1, 'Label', sprintf('Media: %.1f mV', mean_error));
ylabel('Error (mV)');
title(sprintf('Error de seguimiento (RMS: %.2f mV)', rms_error));
grid on;

% Plot 3: PWM
subplot(4, 1, 3);
plot(t, pwm, 'LineWidth', 1.5, 'Color', [0.4660 0.6740 0.1880]);
hold on;
yline(0, 'k--', 'LineWidth', 1);
yline(mean_pwm, 'r--', 'LineWidth', 1, 'Label', sprintf('Media: %.1f%%', mean_pwm));
ylabel('PWM (%)');
title('Comando PWM al Motor');
grid on;

% Plot 4: Histograma del error
subplot(4, 1, 4);
histogram(error, 50, 'FaceColor', [0.8500 0.3250 0.0980]);
xlabel('Error (mV)');
ylabel('Frecuencia');
title(sprintf('Distribucion del Error (Media: %.1f mV, Std: %.1f mV)', mean_error, std(error)));
grid on;

%% ANALISIS ESPECTRAL (FFT)
figure('Position', [100, 100, 1200, 500]);

% FFT del error
Fs = motor_data.sampling_rate_hz;
L = length(error);
Y = fft(error);
P2 = abs(Y/L);
P1 = P2(1:floor(L/2)+1);
P1(2:end-1) = 2*P1(2:end-1);
f = Fs*(0:(floor(L/2)))/L;

subplot(1, 2, 1);
plot(f, P1, 'LineWidth', 1.5);
xlabel('Frecuencia (Hz)');
ylabel('Amplitud');
title('Espectro de Frecuencias del Error');
xlim([0 min(10, Fs/2)]);
grid on;

% FFT del Pressure Pad
Y_pp = fft(pp);
P2_pp = abs(Y_pp/L);
P1_pp = P2_pp(1:floor(L/2)+1);
P1_pp(2:end-1) = 2*P1_pp(2:end-1);

subplot(1, 2, 2);
plot(f, P1_pp, 'LineWidth', 1.5);
xlabel('Frecuencia (Hz)');
ylabel('Amplitud');
title('Espectro de Frecuencias del Pressure Pad');
xlim([0 min(10, Fs/2)]);
grid on;

%% CORRELACION SETPOINT-PWM
figure('Position', [150, 150, 800, 600]);

scatter(ref, pwm, 20, t, 'filled');
xlabel('Setpoint (mV)');
ylabel('PWM (%)');
title('Relacion Setpoint vs PWM (color = tiempo)');
colorbar;
colormap('jet');
grid on;

% Agregar linea de tendencia
p = polyfit(ref, pwm, 1);
hold on;
plot([min(ref) max(ref)], polyval(p, [min(ref) max(ref)]), 'r--', 'LineWidth', 2);
legend('Datos', sprintf('Tendencia: PWM = %.3f*Setpoint + %.1f', p(1), p(2)), 'Location', 'best');

fprintf('\n=== ANALISIS COMPLETADO ===\n');
fprintf('Revisa las figuras generadas para mas detalles.\n');
