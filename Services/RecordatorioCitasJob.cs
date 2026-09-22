using Quartz;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Data;
using System.Threading;
using System.Threading.Tasks;

namespace ESFE.ClinicaWEB.Services
{
    public class RecordatorioCitasJob : IJob
    {
        private readonly IEmailService _emailService;
        private readonly string? _connectionString;

        public RecordatorioCitasJob(IEmailService emailService, IConfiguration configuration)
        {
            _emailService = emailService;
            _connectionString = configuration.GetConnectionString("DefaultConnection")
                                ?? configuration.GetConnectionString("ClinicaConnection");
        }

        public async ValueTask Execute(IJobExecutionContext context, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrEmpty(_connectionString)) return;

            try
            {
                // TEMPORAL PARA PRUEBAS: busca citas programadas entre ayer y mañana
                var inicio = DateTime.Now.AddDays(-1);
                var fin = DateTime.Now.AddDays(1);

                string querySelect = @"
                    SELECT 
                        c.consulta_id,
                        COALESCE(uCreac.correo, uPac.correo, uMod.correo, 'correo_predeterminado@dominio.com') AS correo,
                        p.nombres + ' ' + p.apellidos AS nombre_paciente,
                        c.fecha_consulta
                    FROM dbo.Consultas c
                    INNER JOIN dbo.Pacientes p ON c.paciente_id = p.paciente_id
                    LEFT JOIN dbo.Usuarios uCreac ON p.usuario_creacion_id = uCreac.usuario_id
                    LEFT JOIN dbo.Usuarios uPac ON p.dui_documento = uPac.username OR (p.apellidos = uPac.apellidos AND (p.nombres LIKE '%' + uPac.nombres + '%' OR uPac.nombres LIKE '%' + p.nombres + '%')) OR p.apellidos = uPac.apellidos
                    LEFT JOIN dbo.Usuarios uMod ON c.usuario_modificacion_id = uMod.usuario_id
                    WHERE c.fecha_consulta >= @Inicio 
                      AND c.fecha_consulta <= @Fin 
                      AND c.estado_consulta_id = 1
                      AND c.recordatorio_enviado = 0";

                var citasANotificar = new List<(int ConsultaId, string Correo, string NombrePaciente, DateTime FechaHora)>();

                // Reintentos automáticos para manejar desconexiones temporales por TCP en el servidor remoto
                int maxIntentos = 3;
                for (int intento = 1; intento <= maxIntentos; intento++)
                {
                    try
                    {
                        using var connection = new SqlConnection(_connectionString);
                        await connection.OpenAsync(cancellationToken);

                        using var command = new SqlCommand(querySelect, connection);
                        command.CommandTimeout = 60;
                        command.Parameters.AddWithValue("@Inicio", inicio);
                        command.Parameters.AddWithValue("@Fin", fin);

                        using (var reader = await command.ExecuteReaderAsync(cancellationToken))
                        {
                            while (await reader.ReadAsync(cancellationToken))
                            {
                                citasANotificar.Add((
                                    reader.GetInt32(0),
                                    reader.GetString(1),
                                    reader.GetString(2),
                                    reader.GetDateTime(3)
                                ));
                            }
                        }

                        // Si la lectura se completó correctamente, salir del bucle de reintentos
                        break;
                    }
                    catch (SqlException) when (intento < maxIntentos)
                    {
                        await Task.Delay(2000, cancellationToken);
                    }
                }

                if (citasANotificar.Count == 0) return;

                using (var connection = new SqlConnection(_connectionString))
                {
                    await connection.OpenAsync(cancellationToken);

                    foreach (var cita in citasANotificar)
                    {
                        try
                        {
                            string htmlBody = GenerarPlantillaCorreo(cita.NombrePaciente, cita.FechaHora);

                            await _emailService.SendEmailAsync(
                                cita.Correo,
                                "⏰ Recordatorio: Tu Cita Médica en Curavita es en 8 Horas",
                                htmlBody
                            );

                            string queryUpdate = "UPDATE dbo.Consultas SET recordatorio_enviado = 1 WHERE consulta_id = @ConsultaId";
                            using var updateCommand = new SqlCommand(queryUpdate, connection);
                            updateCommand.CommandTimeout = 60;
                            updateCommand.Parameters.AddWithValue("@ConsultaId", cita.ConsultaId);
                            await updateCommand.ExecuteNonQueryAsync(cancellationToken);
                        }
                        catch (Exception exEmail)
                        {
                            Console.WriteLine($"[RecordatorioCitasJob] Error al enviar correo de recordatorio a {cita.Correo}: {exEmail.Message}");
                        }
                    }
                }
            }
            catch (SqlException sqlEx)
            {
                // Capturado para evitar interrupción no controlada en el depurador de Visual Studio ante caídas de TCP
                Console.WriteLine($"[RecordatorioCitasJob] Advertencia de conexión SQL (TCP): {sqlEx.Message}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RecordatorioCitasJob] Excepción en RecordatorioCitasJob: {ex.Message}");
            }
        }

        private string GenerarPlantillaCorreo(string paciente, DateTime fechaHora)
        {
            string ampm = fechaHora.Hour >= 12 ? "p.m." : "a.m.";
            int hora12 = fechaHora.Hour % 12 == 0 ? 12 : fechaHora.Hour % 12;
            string fechaHoraFormateada = $"{fechaHora:dd/MM/yyyy} {hora12:D2}:{fechaHora.Minute:D2} {ampm}";

            return $@"<!DOCTYPE html PUBLIC ""-//W3C//DTD XHTML 1.0 Transitional//EN"" ""http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"">
<html xmlns=""http://www.w3.org/1999/xhtml"" lang=""es"">
<head>
    <meta http-equiv=""Content-Type"" content=""text/html; charset=UTF-8"" />
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
    <title>Recordatorio de Cita - Curavita</title>
    <!--[if mso]>
    <style type=""text/css"">
        body, table, td {{ font-family: Arial, Helvetica, sans-serif !important; }}
    </style>
    <![endif]-->
    <style type=""text/css"">
        body {{
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-width: 100% !important;
            background-color: #f4f7f6;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }}
        table, td {{
            border-collapse: collapse;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }}
        img {{
            border: 0;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
        }}
    </style>
</head>
<body style=""margin: 0; padding: 0; width: 100%; background-color: #f4f7f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;"">

    <center style=""width: 100%; background-color: #f4f7f6; text-align: center;"">
        <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" align=""center"" style=""width: 100%; background-color: #f4f7f6; margin: 0 auto; table-layout: fixed;"">
            <tr>
                <td align=""center"" valign=""top"" style=""padding: 35px 12px;"">

                    <!-- Tarjeta Principal del Recordatorio -->
                    <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" align=""center"" style=""max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #d1e7dd; overflow: hidden; box-shadow: 0 10px 25px rgba(13, 148, 136, 0.08); text-align: left;"">

                        <!-- Encabezado con degradado Curavita y Logo -->
                        <tr>
                            <td align=""center"" style=""padding: 28px 24px 22px 24px; background-color: #0f766e; background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: #ffffff; text-align: center;"">
                                <!-- Contenedor del Logo -->
                                <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" align=""center"" style=""margin: 0 auto 12px auto;"">
                                    <tr>
                                        <td align=""center"" style=""background-color: #ffffff; border-radius: 12px; padding: 8px 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.12);"">
                                            <img src=""cid:logo_curavita"" alt=""Curavita"" width=""115"" style=""display: block; border: 0; max-width: 115px; height: auto; margin: 0 auto;"" />
                                        </td>
                                    </tr>
                                </table>

                                <!-- Insignia de Recordatorio -->
                                <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" align=""center"" style=""margin: 0 auto;"">
                                    <tr>
                                        <td align=""center"" style=""background-color: rgba(255, 255, 255, 0.2); padding: 5px 16px; border-radius: 20px;"">
                                            <span style=""color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;"">
                                                RECORDATORIO DE CITA
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Cuerpo del Correo -->
                        <tr>
                            <td style=""padding: 32px 28px; background-color: #ffffff;"">

                                <!-- Título Principal -->
                                <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"">
                                    <tr>
                                        <td align=""center"" style=""padding-bottom: 24px;"">
                                            <h1 style=""color: #111827; font-size: 21px; font-weight: 800; margin: 0 0 6px 0; line-height: 1.3;"">
                                                ¡Tu Cita es en 8 Horas!
                                            </h1>
                                            <p style=""color: #6b7280; font-size: 13.5px; margin: 0; line-height: 1.5;"">
                                                Te recordamos los detalles de tu próxima consulta médica.
                                            </p>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Tabla de Detalles de la Consulta -->
                                <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;"">
                                    <tr>
                                        <td colspan=""2"" style=""padding: 12px 18px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;"">
                                            DETALLES DE LA CONSULTA
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style=""padding: 13px 18px; font-size: 13px; color: #64748b; width: 35%; border-bottom: 1px solid #f1f5f9; font-weight: 600;"">
                                            Paciente:
                                        </td>
                                        <td style=""padding: 13px 18px; font-size: 13.5px; color: #1e293b; font-weight: 700; border-bottom: 1px solid #f1f5f9;"">
                                            {paciente}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style=""padding: 13px 18px; font-size: 13px; color: #64748b; font-weight: 600;"">
                                            Fecha y Hora:
                                        </td>
                                        <td style=""padding: 13px 18px; font-size: 13.5px; color: #1e293b; font-weight: 700;"">
                                            {fechaHoraFormateada}
                                        </td>
                                    </tr>
                                </table>

                                <!-- Nota de Importancia -->
                                <div style=""background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 13px 16px; border-radius: 6px; margin-bottom: 24px;"">
                                    <p style=""color: #166534; font-size: 12px; line-height: 1.5; margin: 0;"">
                                        📌 <strong>Importante:</strong> Te recomendamos presentarte 10 minutos antes en la recepción de la clínica con tu documento de identidad y tu comprobante o pago correspondiente.
                                    </p>
                                </div>

                                <p style=""color: #94a3b8; font-size: 11.5px; text-align: center; margin: 0; line-height: 1.4;"">
                                    Si necesitas reprogramar o tienes alguna duda, comunícate con la recepción de la clínica con anticipación.
                                </p>

                            </td>
                        </tr>

                        <!-- Pie de Página -->
                        <tr>
                            <td align=""center"" style=""background-color: #0f766e; padding: 18px 24px; text-align: center;"">
                                <p style=""color: #ffffff; font-size: 12px; font-weight: 600; margin: 0 0 4px 0;"">
                                    Clínica Médica Curavita
                                </p>
                                <p style=""color: #ccfbf1; font-size: 11px; margin: 0;"">
                                    Cuidando de tu salud y bienestar &bull; &copy; 2026 Todos los derechos reservados.
                                </p>
                            </td>
                        </tr>

                    </table>

                </td>
            </tr>
        </table>
    </center>

</body>
</html>";
        }
    }
}