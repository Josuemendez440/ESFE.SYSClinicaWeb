using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
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
                        break;
                    }

                    usernameGenerado = $"{usernameBase}{contador}";
                    contador++;
                }

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
            var listaCitas = new List<CitasViewModel>();
            string connectionString = _configuration.GetConnectionString("DefaultConnection")!;

            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                string query = @"
                    SELECT 
                        c.consulta_id AS Id,
                        CONCAT(p.nombres, ' ', p.apellidos) AS Paciente,
                        ISNULL(e.nombre_especialidad, 'Medicina General') AS Especialidad,
                        ISNULL(CONCAT(u.nombres, ' ', u.apellidos), 'Doctor Asignado') AS Medico,
                        c.fecha_consulta AS FechaHora,
                        CAST(CASE WHEN pg.pago_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS PagoConfirmado,
                        ISNULL(pg.monto_pagado, 6.25) AS MontoAnticipo,
                        18.75 AS SaldoPendiente
                    FROM dbo.Consultas c
                    INNER JOIN dbo.Pacientes p ON c.paciente_id = p.paciente_id
                    LEFT JOIN dbo.Usuarios u ON c.medico_id = u.usuario_id
                    LEFT JOIN dbo.Especialidades e ON u.especialidad_id = e.especialidad_id
                    LEFT JOIN dbo.Pagos pg ON c.consulta_id = pg.consulta_id
                    ORDER BY c.fecha_consulta DESC";

                using var cmd = new SqlCommand(query, conn);
                using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    listaCitas.Add(new CitasViewModel
                    {
                        Id = reader.GetInt32(reader.GetOrdinal("Id")),
                        Paciente = reader.GetString(reader.GetOrdinal("Paciente")),
                        Especialidad = reader.GetString(reader.GetOrdinal("Especialidad")),
                        Medico = reader.GetString(reader.GetOrdinal("Medico")),
                        FechaHora = reader.GetDateTime(reader.GetOrdinal("FechaHora")),
                        PagoConfirmado = reader.GetBoolean(reader.GetOrdinal("PagoConfirmado")),
                        MontoAnticipo = reader.GetDecimal(reader.GetOrdinal("MontoAnticipo")),
                        SaldoPendiente = reader.GetDecimal(reader.GetOrdinal("SaldoPendiente"))
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[SQL Error] Error al obtener las citas de dbo.Consultas: " + ex.Message);
            }

            return View(listaCitas);
        }

        [HttpGet]
        public IActionResult Agendar() => View();

        [HttpPost]
        public async Task<IActionResult> Agendar([FromBody] CitasViewModel cita)
        {
            if (cita == null)
            {
                return BadRequest(new { exito = false, mensaje = "Los datos de la cita no fueron recibidos." });
            }

            int citaIdFicticia = new Random().Next(1000, 9999);
            return Json(new { exito = true, citaId = citaIdFicticia, redirectUrl = $"/Account/Confirma_pago?id={citaIdFicticia}" });
        }

        [HttpGet]
        public IActionResult Confirma_pago(int? id)
        {
            return View();
        }

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
                        Nombres = form["Nombres"].ToString(),
                        Apellidos = form["Apellidos"].ToString(),
                        Dui = form["Dui"].ToString(),
                        Telefono = form["Telefono"].ToString(),
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

            string nombrePaciente = !string.IsNullOrWhiteSpace(model.Paciente) ? model.Paciente.Trim() : "Paciente Curavita";
            string nombresVal = !string.IsNullOrWhiteSpace(model.Nombres) ? model.Nombres.Trim() : nombrePaciente;
            string apellidosVal = !string.IsNullOrWhiteSpace(model.Apellidos) ? model.Apellidos.Trim() : "General";
            string duiVal = !string.IsNullOrWhiteSpace(model.Dui) ? model.Dui.Trim() : "0" + new Random().Next(10000000, 99999999).ToString() + "-0";

            int idPacienteGenerado = 0;
            string codigoExpedienteGenerado = "";
            int consultaIdGenerada = 0;

            string connectionString = _configuration.GetConnectionString("DefaultConnection")!;

            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                // 1. Buscar o registrar paciente
                string checkQuery = "SELECT paciente_id, codigo_expediente FROM dbo.Pacientes WHERE dui_documento = @dui";
                using (var checkCmd = new SqlCommand(checkQuery, conn))
                {
                    checkCmd.Parameters.AddWithValue("@dui", duiVal);
                    using var reader = await checkCmd.ExecuteReaderAsync();
                    if (await reader.ReadAsync())
                    {
                        idPacienteGenerado = reader.GetInt32(0);
                        codigoExpedienteGenerado = reader.GetString(1);
                    }
                }

                if (idPacienteGenerado == 0)
                {
                    string insertPacienteQuery = @"
                        DECLARE @SiguienteId INT = (SELECT ISNULL(MAX(paciente_id), 0) + 1 FROM dbo.Pacientes);
                        DECLARE @CodigoExp VARCHAR(20) = 'PAC-' + RIGHT('000' + CAST(@SiguienteId AS VARCHAR(10)), 4);

                        INSERT INTO dbo.Pacientes (codigo_expediente, nombres, apellidos, dui_documento, telefono, fecha_creacion)
                        VALUES (@CodigoExp, @nombres, @apellidos, @dui_documento, @telefono, GETDATE());

                        SELECT SCOPE_IDENTITY() AS NuevoId, @CodigoExp AS CodigoGenerado;";

                    using var insertCmd = new SqlCommand(insertPacienteQuery, conn);
                    insertCmd.Parameters.AddWithValue("@nombres", nombresVal);
                    insertCmd.Parameters.AddWithValue("@apellidos", apellidosVal);
                    insertCmd.Parameters.AddWithValue("@dui_documento", duiVal);
                    insertCmd.Parameters.AddWithValue("@telefono", (object?)model.Telefono ?? DBNull.Value);

                    using var readerResult = await insertCmd.ExecuteReaderAsync();
                    if (await readerResult.ReadAsync())
                    {
                        idPacienteGenerado = Convert.ToInt32(readerResult["NuevoId"]);
                        codigoExpedienteGenerado = readerResult["CodigoGenerado"]?.ToString() ?? $"PAC-{idPacienteGenerado:D4}";
                    }
                }

                // 2. Parsear fecha de la consulta
                DateTime fechaCitaParsed = DateTime.Now;
                if (!string.IsNullOrWhiteSpace(model.FechaHora) && DateTime.TryParse(model.FechaHora, out var dtParsed))
                {
                    fechaCitaParsed = dtParsed;
                }
                else if (!string.IsNullOrWhiteSpace(model.Fecha))
                {
                    string fechaCombinada = !string.IsNullOrWhiteSpace(model.Hora) ? $"{model.Fecha} {model.Hora}" : model.Fecha;
                    if (!DateTime.TryParse(fechaCombinada, CultureInfo.InvariantCulture, DateTimeStyles.None, out fechaCitaParsed))
                    {
                        DateTime.TryParse(model.Fecha, out fechaCitaParsed);
                    }
                }

                // Obtener ID de un usuario activo para recepcionista/registrador
                int recepcionistaId = 1;
                using (var recepCmd = new SqlCommand("SELECT TOP 1 usuario_id FROM dbo.Usuarios WHERE estado = 1 ORDER BY usuario_id ASC", conn))
                {
                    var resRecep = await recepCmd.ExecuteScalarAsync();
                    if (resRecep != null && resRecep != DBNull.Value) recepcionistaId = Convert.ToInt32(resRecep);
                }

                // 3. Registrar la consulta en dbo.Consultas
                string insertConsultaQuery = @"
                    INSERT INTO dbo.Consultas 
                        (paciente_id, medico_id, recepcionista_id, fecha_consulta, tipo_atencion_id, estado_consulta_id, es_emergencia)
                    VALUES 
                        (@paciente_id, NULL, @recepcionista_id, @fecha_consulta, 1, 1, 0);
                    SELECT SCOPE_IDENTITY();";

                using (var cmdConsulta = new SqlCommand(insertConsultaQuery, conn))
                {
                    cmdConsulta.Parameters.AddWithValue("@paciente_id", idPacienteGenerado);
                    cmdConsulta.Parameters.AddWithValue("@recepcionista_id", recepcionistaId);
                    cmdConsulta.Parameters.AddWithValue("@fecha_consulta", fechaCitaParsed);

                    var resConsulta = await cmdConsulta.ExecuteScalarAsync();
                    if (resConsulta != null) consultaIdGenerada = Convert.ToInt32(resConsulta);
                }

                // 4. Registrar el Pago en dbo.Pagos
                if (consultaIdGenerada > 0)
                {
                    decimal montoAnticipo = model.MontoAnticipo > 0 ? model.MontoAnticipo : 6.25m;
                    string insertPagoQuery = @"
                        INSERT INTO dbo.Pagos (consulta_id, metodo_pago_id, estado_pago_id, monto_pagado, fecha_pago, cajero_id)
                        VALUES (@consulta_id, 2, 1, @monto_pagado, GETDATE(), @cajero_id)";

                    using var cmdPago = new SqlCommand(insertPagoQuery, conn);
                    cmdPago.Parameters.AddWithValue("@consulta_id", consultaIdGenerada);
                    cmdPago.Parameters.AddWithValue("@monto_pagado", montoAnticipo);
                    cmdPago.Parameters.AddWithValue("@cajero_id", recepcionistaId);

                    await cmdPago.ExecuteNonQueryAsync();
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { exito = false, mensaje = "Error al guardar en la base de datos SQL Server: " + ex.Message });
            }

            // 5. Enviar comprobante por correo
            string correoDestino = model.Correo?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(correoDestino))
            {
                correoDestino = _configuration["EmailSettings:SenderEmail"] ?? "";
            }

            try
            {
                if (!string.IsNullOrWhiteSpace(correoDestino))
                {
                    var citaFake = new CitasViewModel
                    {
                        Paciente = $"{nombresVal} {apellidosVal}",
                        Especialidad = model.Especialidad,
                        Medico = model.Medico,
                        FechaHora = DateTime.Now,
                        MontoAnticipo = model.MontoAnticipo,
                        SaldoPendiente = model.SaldoPendiente
                    };
                    await _emailService.SendComprobantePagoAsync(correoDestino, citaFake, model.TitularTarjeta);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[EmailService] No se pudo enviar el correo: " + ex.Message);
            }

            return Ok(new
            {
                exito = true,
                mensaje = "¡Pago procesado y cita registrada con éxito!",
                codigoExpediente = codigoExpedienteGenerado,
                pacienteId = idPacienteGenerado,
                redirectUrl = "/Account/Citas"
            });
        }

        [HttpGet] public IActionResult Expedientes() => View("expedientes");
        [HttpGet] public IActionResult Consulta() => View();
        [HttpGet] public IActionResult Facturacion() => View("facturacion");

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
        public string Nombres { get; set; } = string.Empty;
        public string Apellidos { get; set; } = string.Empty;
        public string Dui { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string Especialidad { get; set; } = string.Empty;
        public string Medico { get; set; } = string.Empty;
        public string Fecha { get; set; } = string.Empty;
        public string Hora { get; set; } = string.Empty;
        public string FechaHora { get; set; } = string.Empty;
        public string? Correo { get; set; }
        public decimal PrecioTotal { get; set; } = 25.00m;
        public decimal MontoAnticipo { get; set; } = 6.25m;
        public decimal SaldoPendiente { get; set; } = 18.75m;
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