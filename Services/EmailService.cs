using System;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using ESFE.ClinicaWEB.Models;
using SelectPdf;

namespace ESFE.ClinicaWEB.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string toEmail, string subject, string htmlMessage);
        Task SendOtpEmailAsync(string toEmail, string otpCode);
        Task SendComprobantePagoAsync(string toEmail, CitasViewModel cita, string titularTarjeta = "");
        Task SendFacturaEmailAsync(string toEmail, string numeroFactura, string paciente, string especialidad, decimal total, string metodoPago, decimal montoRecibido, decimal cambio, string codigoExpediente = "", decimal costoTotal = 0, decimal anticipoPagado = 0);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;

        public EmailService(IConfiguration configuration, IWebHostEnvironment env)
        {
            _configuration = configuration;
            _env = env;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string htmlMessage)
        {
            var smtpServer = _configuration["EmailSettings:SmtpServer"];
            var port = int.Parse(_configuration["EmailSettings:Port"] ?? "587");
            var senderEmail = _configuration["EmailSettings:SenderEmail"];
            var senderName = _configuration["EmailSettings:SenderName"];
            var password = _configuration["EmailSettings:Password"];

            using var message = new MailMessage();
            message.From = new MailAddress(senderEmail!, senderName);
            message.To.Add(new MailAddress(toEmail));
            message.Subject = subject;

            // 1. Crear la vista HTML para el correo
            AlternateView htmlView = AlternateView.CreateAlternateViewFromString(htmlMessage, null, MediaTypeNames.Text.Html);

            // 2. Ruta exacta del archivo en la carpeta "images"
            string logoPath = Path.Combine(_env.WebRootPath, "images", "logo.png");

            // 3. Incrustar recurso de imagen (CID)
            if (File.Exists(logoPath))
            {
                LinkedResource logoResource = new LinkedResource(logoPath, "image/png")
                {
                    ContentId = "logo_curavita",
                    TransferEncoding = TransferEncoding.Base64
                };
                htmlView.LinkedResources.Add(logoResource);
            }

            message.AlternateViews.Add(htmlView);

            using var client = new SmtpClient(smtpServer, port);
            client.Credentials = new NetworkCredential(senderEmail, password);
            client.EnableSsl = true;

            await client.SendMailAsync(message);
        }

        public async Task SendOtpEmailAsync(string toEmail, string otpCode)
        {
            string filePath = Path.Combine(_env.WebRootPath, "templates", "EmailOtpTemplate.html");
            string htmlTemplate = await File.ReadAllTextAsync(filePath);
            string htmlMessage = htmlTemplate.Replace("{{CODIGO_OTP}}", otpCode);

            string subject = "Código de Verificación - Curavita";
            await SendEmailAsync(toEmail, subject, htmlMessage);
        }

        public async Task SendComprobantePagoAsync(string toEmail, CitasViewModel cita, string titularTarjeta = "")
        {
            string filePath = Path.Combine(_env.WebRootPath, "templates", "EmailComprobanteTemplate.html");
            string htmlTemplate = "";

            if (File.Exists(filePath))
            {
                htmlTemplate = await File.ReadAllTextAsync(filePath);
            }
            else
            {
                htmlTemplate = $@"
                    <h2>¡Cita Confirmada!</h2>
                    <p>Estimado/a <strong>{cita.Paciente}</strong>, tu cita ha sido reservada con éxito.</p>
                    <p><strong>Especialidad:</strong> {cita.Especialidad}</p>
                    <p><strong>Médico:</strong> {cita.Medico}</p>
                    <p><strong>Fecha y Hora:</strong> {cita.FechaHora:dd/MM/yyyy hh:mm tt}</p>
                    <p><strong>Anticipo pagado (25%):</strong> ${cita.MontoAnticipo:F2}</p>
                    <p><strong>Saldo pendiente en clínica (75%):</strong> ${cita.SaldoPendiente:F2}</p>";
            }

            string fechaStr = cita.FechaHora.ToString("dd 'de' MMMM, yyyy", new CultureInfo("es-ES"));
            string horaStr = cita.FechaHora.ToString("hh:mm tt", CultureInfo.InvariantCulture);

            string htmlMessage = htmlTemplate
                .Replace("{{PACIENTE}}", cita.Paciente)
                .Replace("{{ESPECIALIDAD}}", cita.Especialidad)
                .Replace("{{MEDICO}}", cita.Medico)
                .Replace("{{FECHA}}", fechaStr)
                .Replace("{{HORA}}", horaStr)
                .Replace("{{FECHA_HORA}}", $"{fechaStr} – {horaStr}")
                .Replace("{{PRECIO_TOTAL}}", $"${cita.PrecioTotal:F2}")
                .Replace("{{MONTO_ANTICIPO}}", $"${cita.MontoAnticipo:F2}")
                .Replace("{{SALDO_PENDIENTE}}", $"${cita.SaldoPendiente:F2}")
                .Replace("{{TITULAR_TARJETA}}", string.IsNullOrWhiteSpace(titularTarjeta) ? cita.Paciente : titularTarjeta)
                .Replace("{{ID_CITA}}", cita.Id > 0 ? cita.Id.ToString("D5") : "CONF");

            string subject = $"Comprobante de Reserva de Cita - Curavita #{cita.Id:D4}";
            await SendEmailAsync(toEmail, subject, htmlMessage);
        }

        public async Task SendFacturaEmailAsync(
            string toEmail, 
            string numeroFactura, 
            string paciente, 
            string especialidad, 
            decimal total, 
            string metodoPago, 
            decimal montoRecibido, 
            decimal cambio, 
            string codigoExpediente = "", 
            decimal costoTotal = 0, 
            decimal anticipoPagado = 0)
        {
            if (costoTotal <= 0) costoTotal = total;
            if (string.IsNullOrWhiteSpace(codigoExpediente)) codigoExpediente = "PAC-0001";

            // --- 1. Construir el HTML de la factura ---
            string filePath = Path.Combine(_env.WebRootPath, "templates", "EmailFacturaTemplate.html");
            string htmlTemplate = "";

            if (File.Exists(filePath))
            {
                htmlTemplate = await File.ReadAllTextAsync(filePath);
            }
            else
            {
                htmlTemplate = $@"
                    <h2>Factura {numeroFactura}</h2>
                    <p>Paciente: <strong>{paciente}</strong></p>
                    <p>Servicio: {especialidad}</p>
                    <p>Total: ${costoTotal:F2}</p>
                    <p>Método de Pago: {metodoPago}</p>";
            }

            var now = DateTime.Now;
            string ampm = now.Hour >= 12 ? "p.m." : "a.m.";
            int horas12 = now.Hour % 12 == 0 ? 12 : now.Hour % 12;
            string fechaHoraEmision = $"{now:dd/MM/yyyy} {horas12:D2}:{now.Minute:D2} {ampm}";

            decimal subtotal = Math.Round(costoTotal / 1.13m, 2);
            decimal iva = Math.Round(costoTotal - subtotal, 2);

            // Construir filas de anticipo si aplica
            string filaAnticipoHtml = "";
            string constanciaTexto = "";
            if (anticipoPagado > 0)
            {
                filaAnticipoHtml = $@"
                    <tr>
                        <td style=""padding: 4px 0; font-size: 12px; color: #0d9488; font-weight: 600;"">Anticipo pagado en línea (25%):</td>
                        <td align=""right"" style=""padding: 4px 0; font-size: 12px; color: #0d9488; font-weight: 700;"">- ${anticipoPagado:F2}</td>
                    </tr>
                    <tr>
                        <td style=""padding: 8px 0; font-size: 13px; color: #1e7a8e; font-weight: 700; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;"">COBRADO HOY (75%):</td>
                        <td align=""right"" style=""padding: 8px 0; font-size: 15px; color: #1e7a8e; font-weight: 800; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;"">${total:F2}</td>
                    </tr>";

                constanciaTexto = $"Se acredita el pago de la consulta médica mediante anticipo en línea del 25% (${anticipoPagado:F2}) y cancelación del 75% restante (${total:F2}) en caja mediante {metodoPago}. Gracias por confiar en los servicios médicos de Clínica Curavita.";
            }
            else
            {
                constanciaTexto = $"Se acredita la cancelación total del servicio mediante {metodoPago}. Gracias por confiar en los servicios médicos de Clínica Curavita.";
            }

            string logoFilePath = Path.Combine(_env.WebRootPath, "images", "logo.png");
            string logoBase64 = "";
            if (File.Exists(logoFilePath))
            {
                byte[] logoBytes = await File.ReadAllBytesAsync(logoFilePath);
                logoBase64 = $"data:image/png;base64,{Convert.ToBase64String(logoBytes)}";
            }

            string montoRecibidoStr = metodoPago.Equals("Efectivo", StringComparison.OrdinalIgnoreCase) 
                ? $"${montoRecibido:F2}" 
                : $"${total:F2}";
            string cambioStr = metodoPago.Equals("Efectivo", StringComparison.OrdinalIgnoreCase) 
                ? $"${cambio:F2}" 
                : "$0.00";

            string htmlEmail = htmlTemplate
                .Replace("{{LOGO_SRC}}", "cid:logo_curavita")
                .Replace("{{NUMERO_FACTURA}}", numeroFactura)
                .Replace("{{FECHA_EMISION}}", fechaHoraEmision)
                .Replace("{{PACIENTE}}", paciente)
                .Replace("{{CODIGO_EXPEDIENTE}}", codigoExpediente)
                .Replace("{{ESPECIALIDAD}}", especialidad)
                .Replace("{{METODO_PAGO}}", metodoPago)
                .Replace("{{SUBTOTAL}}", $"${subtotal:F2}")
                .Replace("{{IVA}}", $"${iva:F2}")
                .Replace("{{COSTO_TOTAL}}", $"${costoTotal:F2}")
                .Replace("{{TOTAL}}", $"${costoTotal:F2}")
                .Replace("{{FILA_ANTICIPO}}", filaAnticipoHtml)
                .Replace("{{CONSTANCIA_TEXTO}}", constanciaTexto)
                .Replace("{{MONTO_RECIBIDO}}", montoRecibidoStr)
                .Replace("{{CAMBIO}}", cambioStr);

            // HTML optimizado para generar PDF (usa el logo base64 directo)
            string htmlPdf = htmlTemplate
                .Replace("{{LOGO_SRC}}", string.IsNullOrEmpty(logoBase64) ? "cid:logo_curavita" : logoBase64)
                .Replace("{{NUMERO_FACTURA}}", numeroFactura)
                .Replace("{{FECHA_EMISION}}", fechaHoraEmision)
                .Replace("{{PACIENTE}}", paciente)
                .Replace("{{CODIGO_EXPEDIENTE}}", codigoExpediente)
                .Replace("{{ESPECIALIDAD}}", especialidad)
                .Replace("{{METODO_PAGO}}", metodoPago)
                .Replace("{{SUBTOTAL}}", $"${subtotal:F2}")
                .Replace("{{IVA}}", $"${iva:F2}")
                .Replace("{{COSTO_TOTAL}}", $"${costoTotal:F2}")
                .Replace("{{TOTAL}}", $"${costoTotal:F2}")
                .Replace("{{FILA_ANTICIPO}}", filaAnticipoHtml)
                .Replace("{{CONSTANCIA_TEXTO}}", constanciaTexto)
                .Replace("{{MONTO_RECIBIDO}}", montoRecibidoStr)
                .Replace("{{CAMBIO}}", cambioStr);

            // --- 2. Generar PDF desde el HTML ---
            byte[] pdfBytes;
            try
            {
                HtmlToPdf converter = new HtmlToPdf();
                converter.Options.PdfPageSize = PdfPageSize.A4;
                converter.Options.PdfPageOrientation = PdfPageOrientation.Portrait;
                converter.Options.MarginTop = 15;
                converter.Options.MarginBottom = 15;
                converter.Options.MarginLeft = 15;
                converter.Options.MarginRight = 15;
                converter.Options.WebPageWidth = 750;
                converter.Options.WebPageHeight = 0; // auto height

                string baseUrl = $"file:///{_env.WebRootPath.Replace("\\", "/")}/";
                PdfDocument pdfDoc = converter.ConvertHtmlString(htmlPdf, baseUrl);
                pdfBytes = pdfDoc.Save();
                pdfDoc.Close();
            }
            catch (Exception ex)
            {
                pdfBytes = Array.Empty<byte>();
                _ = ex;
            }

            // --- 3. Construir y enviar el correo con el PDF adjunto ---
            string subject = $"Comprobante de Factura Electrónica {numeroFactura} - Clínica Curavita";

            var smtpServer = _configuration["EmailSettings:SmtpServer"];
            var port = int.Parse(_configuration["EmailSettings:Port"] ?? "587");
            var senderEmail = _configuration["EmailSettings:SenderEmail"];
            var senderName = _configuration["EmailSettings:SenderName"];
            var password = _configuration["EmailSettings:Password"];

            using var msg = new MailMessage();
            msg.From = new MailAddress(senderEmail!, senderName);
            msg.To.Add(new MailAddress(toEmail));
            msg.Subject = subject;

            // Vista HTML del cuerpo del correo
            AlternateView htmlView = AlternateView.CreateAlternateViewFromString(htmlEmail, null, MediaTypeNames.Text.Html);
            if (File.Exists(logoFilePath))
            {
                LinkedResource logoResource = new LinkedResource(logoFilePath, "image/png")
                {
                    ContentId = "logo_curavita",
                    TransferEncoding = System.Net.Mime.TransferEncoding.Base64
                };
                htmlView.LinkedResources.Add(logoResource);
            }
            msg.AlternateViews.Add(htmlView);

            // Adjuntar PDF si se generó correctamente
            if (pdfBytes.Length > 0)
            {
                var pdfStream = new MemoryStream(pdfBytes);
                var attachment = new Attachment(pdfStream, $"Factura_{numeroFactura}.pdf", "application/pdf");
                msg.Attachments.Add(attachment);
            }

            using var client = new SmtpClient(smtpServer, port);
            client.Credentials = new NetworkCredential(senderEmail, password);
            client.EnableSsl = true;
            await client.SendMailAsync(msg);
        }
    }
}