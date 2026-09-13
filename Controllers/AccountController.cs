using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using ESFE.ClinicaWEB.Services;

namespace ESFE.ClinicaWEB.Controllers
{
    public class AccountController : Controller
    {
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;

        // Arreglos estáticos de módulos según rol
        private static readonly string[] ModulosAdmin = ["inicio", "citas", "agendar", "expedientes", "consulta", "facturacion"];
        private static readonly string[] ModulosMedico = ["inicio", "consulta"];
        private static readonly string[] ModulosEnfermero = ["inicio", "expedientes", "agendar", "citas"];
        private static readonly string[] ModulosRecepcionista = ["inicio", "facturacion"];
        private static readonly string[] ModulosPaciente = ["inicio", "citas", "agendar"];

        public AccountController(IConfiguration configuration, IEmailService emailService)
        {
            _configuration = configuration;
            _emailService = emailService;
        }

        // GET: /Account/Login
        [HttpGet]
        public IActionResult Login() => View();

        // POST: /Account/Login
        [HttpPost]
        public async Task<IActionResult> Login([FromForm] string correo, [FromForm] string contrasena)
        {
            if (string.IsNullOrEmpty(correo) || string.IsNullOrEmpty(contrasena))
            {
                return BadRequest(new { exito = false, mensaje = "Credenciales inválidas" });
            }

            string correoNormalizado = correo.Trim().ToLower();

            // 1. Cuenta maestra de administración (Mantenimiento)
            if (correoNormalizado == "admin@curavita.com" && contrasena == "/.4HzHe.GncV/H7MYS8S")
            {
                return Ok(new
                {
                    exito = true,
                    mensaje = "¡Bienvenido/a Administrador Principal!",
                    usuario = "Administrador Principal",
                    rol = "Administrador",
                    redirectUrl = "/Account/Inicio",
                    modulos = ModulosAdmin
                });
            }

            // 2. Validación DINÁMICA en Base de Datos SQL
            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                string query = @"
                    SELECT 
                        u.nombres, 
                        u.apellidos, 
                        r.nombre_rol AS rol, 
                        e.nombre_especialidad AS especialidad 
                    FROM dbo.Usuarios u
                    INNER JOIN dbo.Roles r ON u.rol_id = r.rol_id
                    LEFT JOIN dbo.Especialidades e ON u.especialidad_id = e.especialidad_id
                    WHERE LOWER(u.correo) = @correo 
                      AND u.password_hash = @pass";

                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@correo", correoNormalizado);
                cmd.Parameters.AddWithValue("@pass", HashSHA256(contrasena));

                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    string nombres = reader["nombres"]?.ToString() ?? "";
                    string apellidos = reader["apellidos"]?.ToString() ?? "";
                    string rolBD = reader["rol"]?.ToString() ?? "Paciente";
                    string especialidad = reader["especialidad"]?.ToString() ?? "";

                    string nombreCompleto = $"{nombres} {apellidos}".Trim();

                    // Para la interfaz se puede mostrar la especialidad, pero la autorización de MÓDULOS siempre usa el rol real
                    string rolParaMostrar = (!string.IsNullOrEmpty(especialidad) && especialidad != "N/A") ? especialidad : rolBD;

                    return Ok(new
                    {
                        exito = true,
                        mensaje = $"¡Bienvenido/a {nombreCompleto}!",
                        usuario = nombreCompleto,
                        rol = rolParaMostrar,
                        redirectUrl = "/Account/Inicio",
                        modulos = ObtenerModulosSegunRol(rolBD) // 👈 Evalúa siempre según rolBD (Médico, Recepcionista, Administrador, etc.)
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { exito = false, mensaje = "Error en base de datos: " + ex.Message });
            }

            return BadRequest(new { exito = false, mensaje = "Correo o contraseña incorrectos." });
        }

        // POST: /Account/EnviarCodigoRecuperacion
        [HttpPost]
        public async Task<IActionResult> EnviarCodigoRecuperacion([FromBody] SolicitudCorreoDto model)
        {
            if (string.IsNullOrWhiteSpace(model.Correo))
                return Json(new { exito = false, mensaje = "Por favor ingresa un correo válido." });

            string correoNormalizado = model.Correo.Trim().ToLower();
            bool existeUsuario = false;

            // Búsqueda 100% Dinámica en la Base de Datos
            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                string query = "SELECT COUNT(1) FROM Usuarios WHERE LOWER(correo) = @correo";
                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@correo", correoNormalizado);

                if (Convert.ToInt32(await cmd.ExecuteScalarAsync()) > 0)
                    existeUsuario = true;
            }
            catch { }

            if (!existeUsuario && correoNormalizado != "admin@curavita.com")
                return Json(new { exito = false, mensaje = "El correo electrónico no se encuentra registrado." });

            string codigoOtp = RandomNumberGenerator.GetInt32(100000, 999999).ToString();

            try
            {
                string cuerpoHtml = $"<p>Tu código de recuperación es: <b>{codigoOtp}</b></p>";
                await _emailService.SendEmailAsync(correoNormalizado, "Código de Verificación - Curavita", cuerpoHtml);
                return Json(new { exito = true, mensaje = "Código enviado a tu correo electrónico." });
            }
            catch (Exception ex)
            {
                return Json(new { exito = false, mensaje = "Error al enviar correo: " + ex.Message });
            }
        }

        // POST: /Account/ValidarCodigoOtp
        [HttpPost]
        public async Task<IActionResult> ValidarCodigoOtp([FromBody] ValidarOtpDto model)
        {
            await Task.CompletedTask;
            if (string.IsNullOrWhiteSpace(model.Codigo) || model.Codigo.Length != 6)
                return Json(new { exito = false, mensaje = "El código debe tener 6 dígitos." });

            return Json(new { exito = true, tokenValidacion = Guid.NewGuid().ToString() });
        }

        // POST: /Account/RestablecerPassword
        [HttpPost]
        public async Task<IActionResult> RestablecerPassword([FromBody] NuevaPasswordDto model, [FromQuery] string email)
        {
            if (string.IsNullOrWhiteSpace(model.NuevaContrasena))
                return Json(new { exito = false, mensaje = "La contraseña es requerida." });

            string correoDestino = !string.IsNullOrWhiteSpace(model.Correo)
                ? model.Correo.Trim().ToLower()
                : email?.Trim().ToLower() ?? "";

            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                string update = "UPDATE Usuarios SET password_hash = @nuevaPassword WHERE LOWER(correo) = @correo";
                using var cmd = new SqlCommand(update, conn);
                cmd.Parameters.AddWithValue("@nuevaPassword", HashSHA256(model.NuevaContrasena));
                cmd.Parameters.AddWithValue("@correo", correoDestino);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }

            return Json(new { exito = true, mensaje = "Contraseña restablecida correctamente." });
        }

        // Métodos de vistas
        [HttpGet] public IActionResult Recuperar() => View();
        [HttpGet] public IActionResult Verificacion() => View();
        [HttpGet] public IActionResult Contrasena() => View();
        [HttpGet] public IActionResult Inicio() => View();
        [HttpGet] public IActionResult Citas() => View();
        [HttpGet] public IActionResult Agendar() => View();
        [HttpGet] public IActionResult Expedientes() => View("expedientes");
        [HttpGet] public IActionResult Consulta() => View();
        [HttpGet] public IActionResult Facturacion() => View("facturacion");

        // Métodos auxiliares estáticos
        private static string[] ObtenerModulosSegunRol(string rol)
        {
            if (string.IsNullOrWhiteSpace(rol)) return ModulosPaciente;

            // Normalización: Elimina tildes/acentos y convierte a minúsculas
            string normalized = rol.Normalize(NormalizationForm.FormD);
            StringBuilder sb = new StringBuilder();
            foreach (char c in normalized)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                {
                    sb.Append(c);
                }
            }
            string r = sb.ToString().ToLower().Trim();

            if (r.Contains("admin"))
                return ModulosAdmin;
            if (r.Contains("medic") || r.Contains("doct") || r.Contains("medicina"))
                return ModulosMedico; // 👈 Coincidirá independientemente de si viene como "Médico" o "Medico"
            if (r.Contains("enferm"))
                return ModulosEnfermero;
            if (r.Contains("recep"))
                return ModulosRecepcionista;

            return ModulosPaciente;
        }

        private static string HashSHA256(string rawData)
        {
            byte[] bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawData));
            StringBuilder builder = new();
            for (int i = 0; i < bytes.Length; i++)
                builder.Append(bytes[i].ToString("x2"));
            return builder.ToString();
        }
    }

    public class SolicitudCorreoDto { public string Correo { get; set; } = string.Empty; }
    public class ValidarOtpDto { public string Correo { get; set; } = string.Empty; public string Codigo { get; set; } = string.Empty; }
    public class NuevaPasswordDto { public string Correo { get; set; } = string.Empty; public string TokenValidacion { get; set; } = string.Empty; public string NuevaContrasena { get; set; } = string.Empty; }
}