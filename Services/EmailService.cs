using System;
using System.IO;
using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace ESFE.ClinicaWEB.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string toEmail, string subject, string htmlMessage);
        Task SendOtpEmailAsync(string toEmail, string otpCode);
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
    }
}