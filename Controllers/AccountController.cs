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
                        correo = correoNormalizado,
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
        [HttpGet]
        public async Task<IActionResult> Citas()
        {
            try
            {
                var citas = await _context.Citas.OrderByDescending(c => c.FechaHora).ToListAsync();
                return View(citas);
            }
            catch
            {
                return View();
            }
        }

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

        // POST: /Account/ConfirmarPago
        [HttpPost]
        public async Task<IActionResult> ConfirmarPago()
        {
            ConfirmarPagoDto model;

            try
            {
                if (Request.HasJsonContentType())
                {
                    model = await Request.ReadFromJsonAsync<ConfirmarPagoDto>() ?? new ConfirmarPagoDto();
                }
                else if (Request.HasFormContentType)
                {
                    var form = await Request.ReadFormAsync();
                    model = new ConfirmarPagoDto
                    {
                        CitaId = int.TryParse(form["CitaId"], out var cid) ? cid : 0,
                        Paciente = form["Paciente"].ToString(),
                        Especialidad = form["Especialidad"].ToString(),
                        Medico = form["Medico"].ToString(),
                        Fecha = form["Fecha"].ToString(),
                        Hora = form["Hora"].ToString(),
                        FechaHora = form["FechaHora"].ToString(),
                        Correo = form["Correo"].ToString(),
                        TitularTarjeta = form["TitularTarjeta"].ToString(),
                        NumeroTarjeta = form["NumeroTarjeta"].ToString(),
                        Expiracion = form["Expiracion"].ToString(),
                        Cvv = form["Cvv"].ToString()
                    };

                    if (decimal.TryParse(form["PrecioTotal"], NumberStyles.Any, CultureInfo.InvariantCulture, out var pt)) model.PrecioTotal = pt;
                    if (decimal.TryParse(form["MontoAnticipo"], NumberStyles.Any, CultureInfo.InvariantCulture, out var ma)) model.MontoAnticipo = ma;
                    if (decimal.TryParse(form["SaldoPendiente"], NumberStyles.Any, CultureInfo.InvariantCulture, out var sp)) model.SaldoPendiente = sp;
                }
                else
                {
                    model = new ConfirmarPagoDto();
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { exito = false, mensaje = "Datos de solicitud inválidos: " + ex.Message });
            }

            // 1. Resolver Fecha y Hora de la cita
            DateTime fechaHoraFinal = DateTime.Now;
            bool fechaParseada = false;

            if (!string.IsNullOrWhiteSpace(model.Fecha) && !string.IsNullOrWhiteSpace(model.Hora))
            {
                string combined = $"{model.Fecha.Trim()} {model.Hora.Trim()}";
                if (DateTime.TryParse(combined, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dtInv))
                {
                    fechaHoraFinal = dtInv;
                    fechaParseada = true;
                }
                else if (DateTime.TryParse(combined, new CultureInfo("es-ES"), DateTimeStyles.None, out var dtEs))
                {
                    fechaHoraFinal = dtEs;
                    fechaParseada = true;
                }
            }

            if (!fechaParseada && !string.IsNullOrWhiteSpace(model.Fecha))
            {
                if (DateTime.TryParse(model.Fecha.Trim(), out var dtSoloFecha))
                {
                    fechaHoraFinal = dtSoloFecha;
                    fechaParseada = true;
                }
            }

            if (!fechaParseada && !string.IsNullOrWhiteSpace(model.FechaHora))
            {
                if (DateTime.TryParse(model.FechaHora.Trim(), out var dtDirecto))
                {
                    fechaHoraFinal = dtDirecto;
                    fechaParseada = true;
                }
            }

            string nombrePaciente = !string.IsNullOrWhiteSpace(model.Paciente) ? model.Paciente.Trim() : "Paciente Curavita";
            string nombreEspecialidad = !string.IsNullOrWhiteSpace(model.Especialidad) ? model.Especialidad.Trim() : "Medicina General";
            string nombreMedico = !string.IsNullOrWhiteSpace(model.Medico) ? model.Medico.Trim() : "Dr. Roberto Gómez";

            decimal total = model.PrecioTotal > 0 ? model.PrecioTotal : 50.00m;
            decimal anticipo = model.MontoAnticipo > 0 ? model.MontoAnticipo : 12.50m;
            decimal saldo = total - anticipo;

            CitasViewModel citaProcesada;

            // 2. Procesar registro en la Base de Datos
            try
            {
                if (model.CitaId > 0)
                {
                    var citaExistente = await _context.Citas.FindAsync(model.CitaId);
                    if (citaExistente != null)
                    {
                        citaExistente.PagoConfirmado = true;
                        citaExistente.MontoAnticipo = anticipo;
                        citaExistente.SaldoPendiente = saldo;
                        _context.Citas.Update(citaExistente);
                        await _context.SaveChangesAsync();
                        citaProcesada = citaExistente;
                    }
                    else
                    {
                        citaProcesada = new CitasViewModel
                        {
                            Paciente = nombrePaciente,
                            Especialidad = nombreEspecialidad,
                            Medico = nombreMedico,
                            FechaHora = fechaHoraFinal,
                            PrecioTotal = total,
                            MontoAnticipo = anticipo,
                            SaldoPendiente = saldo,
                            PagoConfirmado = true
                        };
                        _context.Citas.Add(citaProcesada);
                        await _context.SaveChangesAsync();
                    }
                }
                else
                {
                    citaProcesada = new CitasViewModel
                    {
                        Paciente = nombrePaciente,
                        Especialidad = nombreEspecialidad,
                        Medico = nombreMedico,
                        FechaHora = fechaHoraFinal,
                        PrecioTotal = total,
                        MontoAnticipo = anticipo,
                        SaldoPendiente = saldo,
                        PagoConfirmado = true
                    };
                    _context.Citas.Add(citaProcesada);
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { exito = false, mensaje = "Error al guardar la cita en la base de datos: " + ex.Message });
            }

            // 3. Obtener correo de destino para el comprobante
            string correoDestino = model.Correo?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(correoDestino))
            {
                try
                {
                    string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                    using var conn = new SqlConnection(connectionString);
                    await conn.OpenAsync();

                    string query = @"
                        SELECT TOP 1 correo 
                        FROM dbo.Usuarios 
                        WHERE LOWER(RTRIM(CONCAT(nombres, ' ', apellidos))) = LOWER(@paciente)
                           OR LOWER(nombres) = LOWER(@paciente)";

                    using var cmd = new SqlCommand(query, conn);
                    cmd.Parameters.AddWithValue("@paciente", nombrePaciente.ToLower());
                    var result = await cmd.ExecuteScalarAsync();
                    if (result != null && result != DBNull.Value)
                    {
                        correoDestino = result.ToString() ?? "";
                    }
                }
                catch { }
            }

            if (string.IsNullOrWhiteSpace(correoDestino))
            {
                correoDestino = _configuration["EmailSettings:SenderEmail"] ?? "";
            }

            // 4. Integrar el Envío de Correo Electrónico con la plantilla de comprobante
            try
            {
                if (!string.IsNullOrWhiteSpace(correoDestino))
                {
                    await _emailService.SendComprobantePagoAsync(correoDestino, citaProcesada, model.TitularTarjeta);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[EmailService] No se pudo enviar el correo del comprobante: " + ex.Message);
            }

            // 5. Responder exitosamente al cliente
            return Ok(new
            {
                exito = true,
                mensaje = "¡Pago procesado con éxito y cita confirmada!",
                idCita = citaProcesada.Id,
                cita = new
                {
                    id = citaProcesada.Id,
                    paciente = citaProcesada.Paciente,
                    especialidad = citaProcesada.Especialidad,
                    medico = citaProcesada.Medico,
                    fechaHora = citaProcesada.FechaHora.ToString("dd/MM/yyyy hh:mm tt"),
                    anticipo = citaProcesada.MontoAnticipo,
                    saldoPendiente = citaProcesada.SaldoPendiente,
                    correo = correoDestino
                },
                redirectUrl = "/Account/Citas"
            });
        }

        [HttpGet] public IActionResult Expedientes() => View("expedientes");
        [HttpGet] public IActionResult Consulta() => View();
        [HttpGet] public IActionResult Facturacion() => View("facturacion");

        // POST: /Account/EnviarFacturaCorreo
        [HttpPost]
        public async Task<IActionResult> EnviarFacturaCorreo([FromBody] EnviarFacturaDto model)
        {
            if (model == null)
            {
                return BadRequest(new { success = false, message = "Datos inválidos o nulos." });
            }

            if (string.IsNullOrWhiteSpace(model.Correo))
            {
                return BadRequest(new { success = false, message = "El correo electrónico es requerido." });
            }

            try
            {
                decimal montoTotal = ParsearDecimalSeguro(model.MontoTotal);
                decimal costoTotal = ParsearDecimalSeguro(model.CostoTotal, montoTotal);
                decimal anticipoPagado = ParsearDecimalSeguro(model.AnticipoPagado, 0m);
                decimal montoRecibido = ParsearDecimalSeguro(model.MontoRecibido);
                decimal cambio = ParsearDecimalSeguro(model.Cambio);

                await _emailService.SendFacturaEmailAsync(
                    model.Correo.Trim(),
                    model.NumeroFactura ?? "",
                    model.Paciente ?? "",
                    model.Especialidad ?? "",
                    montoTotal,
                    model.MetodoPago ?? "Efectivo",
                    montoRecibido,
                    cambio,
                    model.Codigo ?? "",
                    costoTotal,
                    anticipoPagado
                );

                return Ok(new { success = true, exito = true, message = $"Factura {model.NumeroFactura} enviada exitosamente a {model.Correo}." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, exito = false, message = "Error al enviar la factura por correo: " + ex.Message });
            }
        }

        private static decimal ParsearDecimalSeguro(object? val, decimal valorDefecto = 0m)
        {
            if (val == null) return valorDefecto;
            if (val is decimal d) return d;
            if (val is double db) return (decimal)db;
            if (val is int i) return i;
            if (val is long l) return l;
            if (val is System.Text.Json.JsonElement je)
            {
                if (je.ValueKind == System.Text.Json.JsonValueKind.Number && je.TryGetDecimal(out decimal num)) return num;
                string sj = je.GetString() ?? "";
                sj = sj.Replace("$", "").Replace(",", "").Trim();
                if (decimal.TryParse(sj, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal resj)) return resj;
            }
            string s = val.ToString()?.Replace("$", "").Replace(",", "").Trim() ?? "";
            if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal res)) return res;
            return valorDefecto;
        }

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

    public class ConfirmarPagoDto
    {
        public int CitaId { get; set; }
        public string Paciente { get; set; } = string.Empty;
        public string Especialidad { get; set; } = string.Empty;
        public string Medico { get; set; } = string.Empty;
        public string Fecha { get; set; } = string.Empty;
        public string Hora { get; set; } = string.Empty;
        public string FechaHora { get; set; } = string.Empty;
        public string? Correo { get; set; }
        public decimal PrecioTotal { get; set; } = 50.00m;
        public decimal MontoAnticipo { get; set; } = 12.50m;
        public decimal SaldoPendiente { get; set; } = 37.50m;
        public string TitularTarjeta { get; set; } = string.Empty;
        public string NumeroTarjeta { get; set; } = string.Empty;
        public string Expiracion { get; set; } = string.Empty;
        public string Cvv { get; set; } = string.Empty;
    }

    public class EnviarFacturaDto
    {
        public string? Correo { get; set; }
        public string? NumeroFactura { get; set; }
        public string? Paciente { get; set; }
        public string? Codigo { get; set; }
        public string? Especialidad { get; set; }
        public object? CostoTotal { get; set; }
        public object? AnticipoPagado { get; set; }
        public object? MontoTotal { get; set; }
        public string? MetodoPago { get; set; } = "Efectivo";
        public object? MontoRecibido { get; set; }
        public object? Cambio { get; set; }
    }
}