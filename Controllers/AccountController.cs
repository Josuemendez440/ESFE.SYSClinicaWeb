using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using ESFE.ClinicaWEB.Services;
using ESFE.ClinicaWEB.Models;

namespace ESFE.ClinicaWEB.Controllers
{
    public class AccountController : Controller
    {
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;
        private readonly ApplicationDbContext _context;

        private static readonly string[] ModulosAdmin = ["inicio", "citas", "agendar", "expedientes", "consulta", "facturacion"];
        private static readonly string[] ModulosMedico = ["inicio", "consulta"];
        private static readonly string[] ModulosEnfermero = ["inicio", "expedientes", "agendar", "citas"];
        private static readonly string[] ModulosRecepcionista = ["inicio", "facturacion"];
        private static readonly string[] ModulosPaciente = ["inicio", "citas", "agendar"];

        public AccountController(IConfiguration configuration, IEmailService emailService, ApplicationDbContext context)
        {
            _configuration = configuration;
            _emailService = emailService;
            _context = context;
        }

        [HttpGet]
        public IActionResult Login() => View();

        [HttpPost]
        public async Task<IActionResult> Login([FromForm] string correo, [FromForm] string contrasena)
        {
            if (string.IsNullOrEmpty(correo) || string.IsNullOrEmpty(contrasena))
            {
                return BadRequest(new { exito = false, mensaje = "Credenciales inválidas" });
            }

            string correoNormalizado = correo.Trim().ToLower();

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
                    string rolParaMostrar = (!string.IsNullOrEmpty(especialidad) && especialidad != "N/A") ? especialidad : rolBD;

                    return Ok(new
                    {
                        exito = true,
                        mensaje = $"¡Bienvenido/a {nombreCompleto}!",
                        usuario = nombreCompleto,
                        rol = rolParaMostrar,
                        redirectUrl = "/Account/Inicio",
                        modulos = ObtenerModulosSegunRol(rolBD)
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { exito = false, mensaje = "Error en base de datos: " + ex.Message });
            }

            return BadRequest(new { exito = false, mensaje = "Correo o contraseña incorrectos." });
        }

        // POST: /Account/Registrar
        [HttpPost]
        public async Task<IActionResult> Registrar(RegisterViewModel model)
        {
            bool isAjax = Request.Headers["X-Requested-With"] == "XMLHttpRequest";

            if (!ModelState.IsValid)
            {
                if (isAjax)
                    return Json(new { exito = false, mensaje = "Datos del formulario inválidos." });

                return View("Cuenta", model);
            }

            string correoNormalizado = model.Email.Trim().ToLower();

            // 1. Dividir FullName sin perder palabras y extraer componentes para el username
            var partes = model.FullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);

            string nombres = "";
            string apellidos = "";
            string primerNombreLimpio = RemoverAcentos(partes[0]);
            string primerApellidoLimpio = "";

            if (partes.Length == 1)
            {
                nombres = partes[0];
                apellidos = "";
            }
            else if (partes.Length == 2)
            {
                nombres = partes[0];
                apellidos = partes[1];
                primerApellidoLimpio = RemoverAcentos(partes[1]);
            }
            else if (partes.Length == 3)
            {
                nombres = partes[0];
                apellidos = $"{partes[1]} {partes[2]}";
                primerApellidoLimpio = RemoverAcentos(partes[1]);
            }
            else
            {
                nombres = $"{partes[0]} {partes[1]}";
                apellidos = string.Join(" ", partes.Skip(2));
                primerApellidoLimpio = RemoverAcentos(partes[2]);
            }

            // 2. Generar Username Base (Ej: "josue" + "m" -> "josuem")
            string inicialApellido = !string.IsNullOrEmpty(primerApellidoLimpio) ? primerApellidoLimpio[0].ToString() : "";
            string usernameBase = $"{primerNombreLimpio}{inicialApellido}".ToLower();

            if (string.IsNullOrWhiteSpace(usernameBase))
            {
                usernameBase = correoNormalizado.Split('@')[0];
            }

            string connectionString = _configuration.GetConnectionString("DefaultConnection")!;

            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                // 3. Comprobar si el correo ya existe
                string checkEmailQuery = "SELECT COUNT(1) FROM dbo.Usuarios WHERE LOWER(correo) = @correo";
                using (var checkEmailCmd = new SqlCommand(checkEmailQuery, conn))
                {
                    checkEmailCmd.Parameters.AddWithValue("@correo", correoNormalizado);
                    int existeCorreo = Convert.ToInt32(await checkEmailCmd.ExecuteScalarAsync());
                    if (existeCorreo > 0)
                    {
                        string msgError = "El correo electrónico ya se encuentra registrado.";
                        if (isAjax)
                            return Json(new { exito = false, mensaje = msgError });

                        ModelState.AddModelError("Email", msgError);
                        return View("Cuenta", model);
                    }
                }

                // 4. Garantizar Username Único (Agrega correlativo 1, 2, 3... si ya existe)
                string usernameGenerado = usernameBase;
                int contador = 1;

                while (true)
                {
                    string checkUserQuery = "SELECT COUNT(1) FROM dbo.Usuarios WHERE LOWER(username) = @username";
                    using var checkUserCmd = new SqlCommand(checkUserQuery, conn);
                    checkUserCmd.Parameters.AddWithValue("@username", usernameGenerado);
                    int existeUser = Convert.ToInt32(await checkUserCmd.ExecuteScalarAsync());

                    if (existeUser == 0)
                    {
                        break; // Username disponible
                    }

                    usernameGenerado = $"{usernameBase}{contador}";
                    contador++;
                }

                // 5. Buscar dinámicamente el rol_id para el rol 'Cliente'
                int rolClienteId = 5;
                string getRolQuery = "SELECT rol_id FROM dbo.Roles WHERE LOWER(nombre_rol) = 'cliente'";
                using (var rolCmd = new SqlCommand(getRolQuery, conn))
                {
                    var result = await rolCmd.ExecuteScalarAsync();
                    if (result != null && result != DBNull.Value)
                    {
                        rolClienteId = Convert.ToInt32(result);
                    }
                }

                // 6. Insertar usuario guardando username, correo, nombres y apellidos correctamente
                string insertQuery = @"
                    INSERT INTO dbo.Usuarios (username, correo, password_hash, nombres, apellidos, rol_id, especialidad_id, estado, fecha_creacion)
                    VALUES (@username, @correo, @password_hash, @nombres, @apellidos, @rol_id, NULL, 1, GETDATE())";

                using (var insertCmd = new SqlCommand(insertQuery, conn))
                {
                    insertCmd.Parameters.AddWithValue("@username", usernameGenerado);
                    insertCmd.Parameters.AddWithValue("@correo", correoNormalizado);
                    insertCmd.Parameters.AddWithValue("@password_hash", HashSHA256(model.Password));
                    insertCmd.Parameters.AddWithValue("@nombres", nombres);
                    insertCmd.Parameters.AddWithValue("@apellidos", apellidos);
                    insertCmd.Parameters.AddWithValue("@rol_id", rolClienteId);

                    await insertCmd.ExecuteNonQueryAsync();
                }

                if (isAjax)
                {
                    return Json(new { exito = true, redirectUrl = Url.Action("Login", "Account") });
                }

                return RedirectToAction("Login");
            }
            catch (Exception ex)
            {
                string errorMsg = "Error al registrar la cuenta: " + ex.Message;
                if (isAjax)
                    return Json(new { exito = false, mensaje = errorMsg });

                ModelState.AddModelError("", errorMsg);
                return View("Cuenta", model);
            }
        }

        // POST: /Account/EnviarCodigoRecuperacion
        [HttpPost]
        public async Task<IActionResult> EnviarCodigoRecuperacion([FromBody] SolicitudCorreoDto model)
        {
            if (string.IsNullOrWhiteSpace(model.Correo))
                return Json(new { exito = false, mensaje = "Por favor ingresa un correo válido." });

            string correoNormalizado = model.Correo.Trim().ToLower();
            bool existeUsuario = false;

            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                string query = "SELECT COUNT(1) FROM dbo.Usuarios WHERE LOWER(correo) = @correo";
                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@correo", correoNormalizado);

                if (Convert.ToInt32(await cmd.ExecuteScalarAsync()) > 0)
                    existeUsuario = true;
            }
            catch (Exception ex)
            {
                return Json(new { exito = false, mensaje = "Error al consultar la base de datos: " + ex.Message });
            }

            if (!existeUsuario && correoNormalizado != "admin@curavita.com")
                return Json(new { exito = false, mensaje = "El correo electrónico no se encuentra registrado." });

            string codigoOtp = RandomNumberGenerator.GetInt32(100000, 999999).ToString();

            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                string updateOtp = @"
                    UPDATE dbo.Usuarios 
                    SET codigo_recuperacion = @otp, 
                        fecha_expiracion_codigo = DATEADD(MINUTE, 15, GETDATE()) 
                    WHERE LOWER(correo) = @correo";

                using var cmd = new SqlCommand(updateOtp, conn);
                cmd.Parameters.AddWithValue("@otp", codigoOtp);
                cmd.Parameters.AddWithValue("@correo", correoNormalizado);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }

            try
            {
                await _emailService.SendOtpEmailAsync(correoNormalizado, codigoOtp);
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
            if (string.IsNullOrWhiteSpace(model.Codigo) || model.Codigo.Length != 6)
                return Json(new { exito = false, mensaje = "El código debe tener 6 dígitos." });

            string correoNormalizado = model.Correo?.Trim().ToLower() ?? "";

            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                string query = @"
                    SELECT COUNT(1) 
                    FROM dbo.Usuarios 
                    WHERE LOWER(correo) = @correo 
                      AND codigo_recuperacion = @codigo 
                      AND fecha_expiracion_codigo >= GETDATE()";

                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@correo", correoNormalizado);
                cmd.Parameters.AddWithValue("@codigo", model.Codigo);

                int valido = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                if (valido > 0)
                {
                    return Json(new { exito = true, tokenValidacion = Guid.NewGuid().ToString() });
                }
            }
            catch (Exception ex)
            {
                return Json(new { exito = false, mensaje = "Error al validar el código: " + ex.Message });
            }

            return Json(new { exito = false, mensaje = "El código ingresado es incorrecto o ha expirado." });
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

                string update = "UPDATE dbo.Usuarios SET password_hash = @nuevaPassword, codigo_recuperacion = NULL WHERE LOWER(correo) = @correo";
                using var cmd = new SqlCommand(update, conn);
                cmd.Parameters.AddWithValue("@nuevaPassword", HashSHA256(model.NuevaContrasena));
                cmd.Parameters.AddWithValue("@correo", correoDestino);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }

            return Json(new { exito = true, mensaje = "Contraseña restablecida correctamente." });
        }

        [HttpGet] public IActionResult Recuperar() => View();
        [HttpGet] public IActionResult Verificacion() => View();
        [HttpGet] public IActionResult Contrasena() => View();
        [HttpGet] public IActionResult Cuenta() => View();
        [HttpGet] public IActionResult Inicio() => View();
        [HttpGet] public IActionResult Citas() => View();

        // GET: /Account/Agendar
        [HttpGet]
        public IActionResult Agendar() => View();

        // POST: /Account/Agendar (Guarda la cita en la BD SQL usando Entity Framework Core)
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Agendar(CitasViewModel cita)
        {
            if (ModelState.IsValid)
            {
                _context.Citas.Add(cita);
                await _context.SaveChangesAsync();

                return RedirectToAction("Confirma_pago", new { id = cita.Id });
            }

            return View(cita);
        }

        // GET: /Account/Confirma_pago/5 (Obtiene los detalles de la cita agendada por su ID)
        [HttpGet]
        public async Task<IActionResult> Confirma_pago(int? id)
        {
            if (id == null)
            {
                return View();
            }

            var cita = await _context.Citas.FindAsync(id);
            if (cita == null)
            {
                return NotFound();
            }

            return View(cita);
        }

        [HttpGet] public IActionResult Expedientes() => View("expedientes");
        [HttpGet] public IActionResult Consulta() => View();
        [HttpGet] public IActionResult Facturacion() => View("facturacion");

        private static string[] ObtenerModulosSegunRol(string rol)
        {
            if (string.IsNullOrWhiteSpace(rol)) return ModulosPaciente;

            string normalized = rol.Normalize(NormalizationForm.FormD);
            StringBuilder sb = new();
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
                return ModulosMedico;
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

        private static string RemoverAcentos(string texto)
        {
            if (string.IsNullOrWhiteSpace(texto)) return "";
            string normalized = texto.Normalize(NormalizationForm.FormD);
            StringBuilder sb = new();
            foreach (char c in normalized)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(c))
                {
                    sb.Append(c);
                }
            }
            return sb.ToString();
        }
    }

    public class SolicitudCorreoDto { public string Correo { get; set; } = string.Empty; }
    public class ValidarOtpDto { public string Correo { get; set; } = string.Empty; public string Codigo { get; set; } = string.Empty; }
    public class NuevaPasswordDto { public string Correo { get; set; } = string.Empty; public string TokenValidacion { get; set; } = string.Empty; public string NuevaContrasena { get; set; } = string.Empty; }
}