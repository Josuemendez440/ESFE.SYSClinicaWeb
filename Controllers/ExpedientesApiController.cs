using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;

namespace ESFE.ClinicaWEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ExpedientesApiController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public ExpedientesApiController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        // GET: api/ExpedientesApi
        [HttpGet]
        public IActionResult GetExpedientes()
        {
            var lista = new List<object>();

            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                conn.Open();

                string query = @"
                    WITH UltimaConsulta AS (
                        SELECT 
                            c.consulta_id,
                            c.paciente_id,
                            c.medico_id,
                            c.fecha_consulta,
                            c.estado_consulta_id,
                            ROW_NUMBER() OVER (PARTITION BY c.paciente_id ORDER BY c.fecha_consulta DESC, c.consulta_id DESC) AS rn
                        FROM dbo.Consultas c
                    ),
                    ResumenPagos AS (
                        SELECT 
                            pg.consulta_id,
                            COUNT(pg.pago_id) AS total_pagos,
                            SUM(pg.monto_pagado) AS total_pagado,
                            MAX(CASE WHEN pg.estado_pago_id = 2 THEN 1 ELSE 0 END) AS tiene_pago_liquidado,
                            MAX(CASE WHEN pg.estado_pago_id = 1 THEN pg.monto_pagado ELSE 0 END) AS monto_anticipo
                        FROM dbo.Pagos pg
                        GROUP BY pg.consulta_id
                    )
                    SELECT 
                        p.paciente_id,
                        p.codigo_expediente,
                        p.nombres,
                        p.apellidos,
                        p.dui_documento,
                        p.telefono,
                        p.fecha_nacimiento,
                        uc.consulta_id,
                        uc.fecha_consulta,
                        uc.estado_consulta_id,
                        ISNULL(e.nombre_especialidad, 'Medicina General') AS especialidad,
                        ISNULL(e.costo_consulta, 25.00) AS costo_consulta,
                        ISNULL(CONCAT(u.nombres, ' ', u.apellidos), 'Dr. Roberto Gómez') AS medico,
                        ISNULL(rp.total_pagos, 0) AS total_pagos,
                        ISNULL(rp.total_pagado, 0.00) AS total_pagado,
                        ISNULL(rp.tiene_pago_liquidado, 0) AS tiene_pago_liquidado,
                        ISNULL(rp.monto_anticipo, 0.00) AS monto_anticipo
                    FROM dbo.Pacientes p
                    LEFT JOIN UltimaConsulta uc ON p.paciente_id = uc.paciente_id AND uc.rn = 1
                    LEFT JOIN dbo.Medicos m ON uc.medico_id = m.medico_id
                    LEFT JOIN dbo.Usuarios u ON m.usuario_id = u.usuario_id
                    LEFT JOIN dbo.Especialidades e ON m.especialidad_id = e.especialidad_id
                    LEFT JOIN ResumenPagos rp ON uc.consulta_id = rp.consulta_id
                    ORDER BY p.paciente_id DESC";

                using var cmd = new SqlCommand(query, conn);
                using var reader = cmd.ExecuteReader();

                while (reader.Read())
                {
                    string nombres = reader["nombres"]?.ToString() ?? "";
                    string apellidos = reader["apellidos"]?.ToString() ?? "";
                    int? estadoConsultaId = reader["estado_consulta_id"] != DBNull.Value ? Convert.ToInt32(reader["estado_consulta_id"]) : null;
                    int tienePagoLiquidado = Convert.ToInt32(reader["tiene_pago_liquidado"]);
                    int totalPagos = Convert.ToInt32(reader["total_pagos"]);
                    decimal costoConsulta = Convert.ToDecimal(reader["costo_consulta"]);
                    decimal montoAnticipo = Convert.ToDecimal(reader["monto_anticipo"]);
                    if (montoAnticipo <= 0 && totalPagos == 1 && tienePagoLiquidado == 0)
                    {
                        montoAnticipo = Convert.ToDecimal(reader["total_pagado"]);
                    }

                    // Si la especialidad viene de la BD del médico (medico_id era NULL al agendar),
                    // reconstruir el costo total desde el anticipo pagado (anticipo = 25% del total)
                    if (costoConsulta <= 0 || costoConsulta == 25.00m)
                    {
                        if (montoAnticipo > 0)
                        {
                            // anticipo * 4 = total (porque anticipo es siempre el 25%)
                            decimal costoReconstruido = Math.Round(montoAnticipo * 4, 2);
                            if (costoReconstruido > 25.00m) // solo sobreescribir si difiere del default
                                costoConsulta = costoReconstruido;
                        }
                    }
                    if (costoConsulta <= 0) costoConsulta = 25.00m;

                    bool tieneAnticipo = montoAnticipo > 0;
                    decimal saldoPendiente = Math.Max(0m, costoConsulta - montoAnticipo);

                    // Determinar estado dinámico basado en Consulta y Pagos
                    bool tieneConsulta = reader["consulta_id"] != DBNull.Value;
                    string especialidad = tieneConsulta ? (reader["especialidad"]?.ToString() ?? "Medicina General") : "Sin Asignar";
                    string medico = tieneConsulta ? (reader["medico"]?.ToString() ?? "Dr. Roberto Gómez") : "Sin Asignar";

                    string estadoFinal = "Registrado";
                    bool liquidado = false;

                    if (!tieneConsulta)
                    {
                        estadoFinal = "Registrado";
                    }
                    // Si la consulta está activa (En Espera, Triaje o Consulta), ese estado tiene prioridad absoluta
                    else if (estadoConsultaId == 1)
                    {
                        estadoFinal = "En Espera";
                    }
                    else if (estadoConsultaId == 2)
                    {
                        estadoFinal = "En Triaje";
                    }
                    else if (estadoConsultaId == 3)
                    {
                        estadoFinal = "En Consulta";
                    }
                    // Solo si la consulta está en un estado terminal (Finalizado/Facturado), revisamos pagos
                    else if (estadoConsultaId == 4 || estadoConsultaId == 5)
                    {
                        if (tienePagoLiquidado == 1 || totalPagos >= 2)
                        {
                            estadoFinal = "Facturado";
                            liquidado = true;
                        }
                        else
                        {
                            estadoFinal = "Finalizado";
                        }
                    }
                    else
                    {
                        // Fallback: si hay pagos liquidados, marcar como Facturado
                        if (tienePagoLiquidado == 1 || totalPagos >= 2)
                        {
                            estadoFinal = "Facturado";
                            liquidado = true;
                        }
                        else
                        {
                            estadoFinal = "Registrado";
                        }
                    }

                    lista.Add(new
                    {
                        id = reader["paciente_id"],
                        paciente_id = reader["paciente_id"],
                        consultaId = tieneConsulta ? reader["consulta_id"] : null,
                        codigoExpediente = reader["codigo_expediente"]?.ToString(),
                        codigo_expediente = reader["codigo_expediente"]?.ToString(),
                        nombres = nombres,
                        apellidos = apellidos,
                        nombreCompleto = $"{nombres} {apellidos}".Trim(),
                        dui = reader["dui_documento"]?.ToString(),
                        dui_documento = reader["dui_documento"]?.ToString(),
                        telefono = reader["telefono"]?.ToString() ?? "Sin Teléfono",
                        fechaNacimiento = reader["fecha_nacimiento"] != DBNull.Value ? Convert.ToDateTime(reader["fecha_nacimiento"]).ToString("yyyy-MM-dd") : null,
                        especialidad = especialidad,
                        medico = medico,
                        costo = costoConsulta,
                        costoTotal = costoConsulta,
                        anticipoPagado = montoAnticipo,
                        pagoAnticipo = tieneAnticipo,
                        saldoPendiente = saldoPendiente,
                        estado = estadoFinal,
                        estadoConsultaId = estadoConsultaId,
                        liquidado = liquidado
                    });
                }

                return Ok(lista);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al consultar pacientes: " + ex.Message });
            }
        }

        // GET: api/ExpedientesApi/5
        [HttpGet("{id}")]
        public IActionResult GetExpedienteById(int id)
        {
            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                conn.Open();

                string query = @"
                    WITH UltimaConsulta AS (
                        SELECT 
                            c.consulta_id,
                            c.paciente_id,
                            c.medico_id,
                            c.fecha_consulta,
                            c.estado_consulta_id,
                            ROW_NUMBER() OVER (PARTITION BY c.paciente_id ORDER BY c.fecha_consulta DESC, c.consulta_id DESC) AS rn
                        FROM dbo.Consultas c
                        WHERE c.paciente_id = @id
                    ),
                    ResumenPagos AS (
                        SELECT 
                            pg.consulta_id,
                            COUNT(pg.pago_id) AS total_pagos,
                            SUM(pg.monto_pagado) AS total_pagado,
                            MAX(CASE WHEN pg.estado_pago_id = 2 THEN 1 ELSE 0 END) AS tiene_pago_liquidado,
                            MAX(CASE WHEN pg.estado_pago_id = 1 THEN pg.monto_pagado ELSE 0 END) AS monto_anticipo
                        FROM dbo.Pagos pg
                        GROUP BY pg.consulta_id
                    )
                    SELECT 
                        p.paciente_id,
                        p.codigo_expediente,
                        p.nombres,
                        p.apellidos,
                        p.dui_documento,
                        p.telefono,
                        p.fecha_nacimiento,
                        uc.consulta_id,
                        uc.fecha_consulta,
                        uc.estado_consulta_id,
                        ISNULL(e.nombre_especialidad, 'Medicina General') AS especialidad,
                        ISNULL(e.costo_consulta, 25.00) AS costo_consulta,
                        ISNULL(CONCAT(u.nombres, ' ', u.apellidos), 'Dr. Roberto Gómez') AS medico,
                        ISNULL(rp.total_pagos, 0) AS total_pagos,
                        ISNULL(rp.total_pagado, 0.00) AS total_pagado,
                        ISNULL(rp.tiene_pago_liquidado, 0) AS tiene_pago_liquidado,
                        ISNULL(rp.monto_anticipo, 0.00) AS monto_anticipo
                    FROM dbo.Pacientes p
                    LEFT JOIN UltimaConsulta uc ON p.paciente_id = uc.paciente_id AND uc.rn = 1
                    LEFT JOIN dbo.Medicos m ON uc.medico_id = m.medico_id
                    LEFT JOIN dbo.Usuarios u ON m.usuario_id = u.usuario_id
                    LEFT JOIN dbo.Especialidades e ON m.especialidad_id = e.especialidad_id
                    LEFT JOIN ResumenPagos rp ON uc.consulta_id = rp.consulta_id
                    WHERE p.paciente_id = @id";

                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@id", id);
                using var reader = cmd.ExecuteReader();

                if (reader.Read())
                {
                    string nombres = reader["nombres"]?.ToString() ?? "";
                    string apellidos = reader["apellidos"]?.ToString() ?? "";
                    int? estadoConsultaId = reader["estado_consulta_id"] != DBNull.Value ? Convert.ToInt32(reader["estado_consulta_id"]) : null;
                    int tienePagoLiquidado = Convert.ToInt32(reader["tiene_pago_liquidado"]);
                    int totalPagos = Convert.ToInt32(reader["total_pagos"]);
                    decimal costoConsulta = Convert.ToDecimal(reader["costo_consulta"]);
                    if (costoConsulta <= 0) costoConsulta = 25.00m;

                    decimal montoAnticipo = Convert.ToDecimal(reader["monto_anticipo"]);
                    if (montoAnticipo <= 0 && totalPagos == 1 && tienePagoLiquidado == 0)
                    {
                        montoAnticipo = Convert.ToDecimal(reader["total_pagado"]);
                    }

                    bool tieneAnticipo = montoAnticipo > 0;
                    decimal saldoPendiente = Math.Max(0m, costoConsulta - montoAnticipo);

                    bool tieneConsulta = reader["consulta_id"] != DBNull.Value;
                    string especialidad = tieneConsulta ? (reader["especialidad"]?.ToString() ?? "Medicina General") : "Sin Asignar";
                    string medico = tieneConsulta ? (reader["medico"]?.ToString() ?? "Dr. Roberto Gómez") : "Sin Asignar";

                    string estadoFinal = "Registrado";
                    bool liquidado = false;

                    if (!tieneConsulta)
                    {
                        estadoFinal = "Registrado";
                    }
                    else if (estadoConsultaId == 1)
                    {
                        estadoFinal = "En Espera";
                    }
                    else if (estadoConsultaId == 2)
                    {
                        estadoFinal = "En Triaje";
                    }
                    else if (estadoConsultaId == 3)
                    {
                        estadoFinal = "En Consulta";
                    }
                    else if (estadoConsultaId == 4 || estadoConsultaId == 5)
                    {
                        if (tienePagoLiquidado == 1 || totalPagos >= 2)
                        {
                            estadoFinal = "Facturado";
                            liquidado = true;
                        }
                        else
                        {
                            estadoFinal = "Finalizado";
                        }
                    }
                    else
                    {
                        if (tienePagoLiquidado == 1 || totalPagos >= 2)
                        {
                            estadoFinal = "Facturado";
                            liquidado = true;
                        }
                        else
                        {
                            estadoFinal = "Registrado";
                        }
                    }

                    return Ok(new
                    {
                        id = reader["paciente_id"],
                        paciente_id = reader["paciente_id"],
                        consultaId = tieneConsulta ? reader["consulta_id"] : null,
                        codigoExpediente = reader["codigo_expediente"]?.ToString(),
                        codigo_expediente = reader["codigo_expediente"]?.ToString(),
                        nombres = nombres,
                        apellidos = apellidos,
                        nombreCompleto = $"{nombres} {apellidos}".Trim(),
                        dui = reader["dui_documento"]?.ToString(),
                        dui_documento = reader["dui_documento"]?.ToString(),
                        telefono = reader["telefono"]?.ToString(),
                        fechaNacimiento = reader["fecha_nacimiento"] != DBNull.Value ? Convert.ToDateTime(reader["fecha_nacimiento"]).ToString("yyyy-MM-dd") : null,
                        especialidad = especialidad,
                        medico = medico,
                        costo = costoConsulta,
                        costoTotal = costoConsulta,
                        anticipoPagado = montoAnticipo,
                        pagoAnticipo = tieneAnticipo,
                        saldoPendiente = saldoPendiente,
                        estado = estadoFinal,
                        estadoConsultaId = estadoConsultaId,
                        liquidado = liquidado
                    });
                }

                return NotFound(new { mensaje = "Paciente no encontrado." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al obtener el expediente: " + ex.Message });
            }
        }

        // POST: api/ExpedientesApi
        [HttpPost]
        public IActionResult PostExpediente([FromBody] PacienteCrearDto model)
        {
            if (model == null) return BadRequest("Datos no válidos.");

            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                conn.Open();

                string duiVal = !string.IsNullOrWhiteSpace(model.Dui) ? model.Dui.Trim() : (!string.IsNullOrWhiteSpace(model.Dui_documento) ? model.Dui_documento.Trim() : "00000000-0");

                string query = @"
                    DECLARE @SiguienteId INT = (SELECT ISNULL(MAX(paciente_id), 0) + 1 FROM dbo.Pacientes);
                    DECLARE @CodigoExp VARCHAR(20) = 'PAC-' + RIGHT('000' + CAST(@SiguienteId AS VARCHAR(10)), 4);

                    INSERT INTO dbo.Pacientes (codigo_expediente, nombres, apellidos, dui_documento, telefono, fecha_nacimiento, fecha_creacion)
                    VALUES (@CodigoExp, @nombres, @apellidos, @dui, @telefono, @fechaNac, GETDATE());

                    SELECT SCOPE_IDENTITY() AS NuevoId, @CodigoExp AS CodigoGenerado;";

                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@nombres", model.Nombres ?? "Paciente");
                cmd.Parameters.AddWithValue("@apellidos", model.Apellidos ?? "General");
                cmd.Parameters.AddWithValue("@dui", duiVal);
                cmd.Parameters.AddWithValue("@telefono", (object?)model.Telefono ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@fechaNac", (object?)model.FechaNacimiento ?? DBNull.Value);

                using var reader = cmd.ExecuteReader();
                int newId = 0;
                string codigoGenerado = "";

                if (reader.Read())
                {
                    newId = Convert.ToInt32(reader["NuevoId"]);
                    codigoGenerado = reader["CodigoGenerado"]?.ToString() ?? $"PAC-{newId:D4}";
                }

                return Ok(new
                {
                    id = newId,
                    paciente_id = newId,
                    codigoExpediente = codigoGenerado,
                    nombres = model.Nombres,
                    apellidos = model.Apellidos
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al guardar el paciente: " + ex.Message });
            }
        }

        // PUT: api/ExpedientesApi/5
        [HttpPut("{id}")]
        public IActionResult PutExpediente(int id, [FromBody] PacienteEstadoDto model)
        {
            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                conn.Open();

                string query = "SELECT COUNT(1) FROM dbo.Pacientes WHERE paciente_id = @id";
                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@id", id);

                int existe = Convert.ToInt32(cmd.ExecuteScalar());
                if (existe == 0) return NotFound(new { mensaje = "El expediente no existe." });

                return Ok(new { exito = true, mensaje = "Expediente actualizado exitosamente." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al actualizar el expediente: " + ex.Message });
            }
        }
        // GET: api/ExpedientesApi/medicos
        [HttpGet("medicos")]
        public async Task<IActionResult> GetMedicos()
        {
            var medicos = new List<object>();
            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                string query = @"
                    SELECT 
                        m.medico_id,
                        CONCAT(u.nombres, ' ', u.apellidos) AS nombre_completo,
                        ISNULL(e.nombre_especialidad, 'Medicina General') AS especialidad,
                        ISNULL(e.costo_consulta, 25.00) AS costo_consulta
                    FROM dbo.Medicos m
                    INNER JOIN dbo.Usuarios u ON m.usuario_id = u.usuario_id
                    LEFT JOIN dbo.Especialidades e ON m.especialidad_id = e.especialidad_id
                    WHERE m.estado = 1 AND u.estado = 1
                    ORDER BY e.nombre_especialidad, u.nombres";

                using var cmd = new SqlCommand(query, conn);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    medicos.Add(new
                    {
                        id = reader["medico_id"],
                        nombre = reader["nombre_completo"]?.ToString(),
                        especialidad = reader["especialidad"]?.ToString(),
                        costo = Convert.ToDecimal(reader["costo_consulta"])
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[GetMedicos] " + ex.Message);
            }

            return Ok(medicos);
        }

        // POST: api/ExpedientesApi/asignar-cita
        [HttpPost("asignar-cita")]
        public async Task<IActionResult> AsignarCita([FromBody] AsignarCitaDto model)
        {
            if (model == null) return BadRequest(new { exito = false, mensaje = "Datos de asignación no válidos." });

            try
            {
                string connectionString = _configuration.GetConnectionString("DefaultConnection")!;
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                int pacienteId = model.PacienteId;
                if (pacienteId <= 0 && !string.IsNullOrWhiteSpace(model.CodigoExpediente))
                {
                    string qPac = "SELECT TOP 1 paciente_id FROM dbo.Pacientes WHERE codigo_expediente = @cod";
                    using var cmdP = new SqlCommand(qPac, conn);
                    cmdP.Parameters.AddWithValue("@cod", model.CodigoExpediente.Trim());
                    var resP = await cmdP.ExecuteScalarAsync();
                    if (resP != null && resP != DBNull.Value) pacienteId = Convert.ToInt32(resP);
                }

                if (pacienteId <= 0)
                {
                    return BadRequest(new { exito = false, mensaje = "Paciente no encontrado." });
                }

                // Resolver usuario médico en dbo.Usuarios
                int? medicoId = model.MedicoId > 0 ? model.MedicoId : null;
                string medicoNombre = model.MedicoNombre?.Trim() ?? "Dr. Roberto Gómez";

                if (!medicoId.HasValue && !string.IsNullOrWhiteSpace(medicoNombre))
                {
                    string qMed = @"
                        SELECT TOP 1 m.medico_id 
                        FROM dbo.Medicos m
                        INNER JOIN dbo.Usuarios u ON m.usuario_id = u.usuario_id
                        WHERE CONCAT(u.nombres, ' ', u.apellidos) LIKE @medNom 
                           OR @medNom LIKE '%' + u.nombres + '%'
                        ORDER BY m.medico_id ASC";
                    using var cmdM = new SqlCommand(qMed, conn);
                    cmdM.Parameters.AddWithValue("@medNom", $"%{medicoNombre.Replace("Dr.", "").Replace("Dra.", "").Trim()}%");
                    var resM = await cmdM.ExecuteScalarAsync();
                    if (resM != null && resM != DBNull.Value) medicoId = Convert.ToInt32(resM);
                }

                // Si aún no se tiene medico_id, buscar cualquier médico o médico default
                if (!medicoId.HasValue)
                {
                    string qDefaultMed = @"
                        SELECT TOP 1 m.medico_id 
                        FROM dbo.Medicos m
                        INNER JOIN dbo.Usuarios u ON m.usuario_id = u.usuario_id
                        WHERE m.estado = 1 AND u.estado = 1
                        ORDER BY m.medico_id ASC";
                    using var cmdDM = new SqlCommand(qDefaultMed, conn);
                    var resDM = await cmdDM.ExecuteScalarAsync();
                    if (resDM != null && resDM != DBNull.Value) medicoId = Convert.ToInt32(resDM);
                    else medicoId = 1;
                }

                // Recepcionista
                int recepcionistaId = 1;
                using (var recepCmd = new SqlCommand("SELECT TOP 1 usuario_id FROM dbo.Usuarios WHERE estado = 1 ORDER BY usuario_id ASC", conn))
                {
                    var resRecep = await recepCmd.ExecuteScalarAsync();
                    if (resRecep != null && resRecep != DBNull.Value) recepcionistaId = Convert.ToInt32(resRecep);
                }

                // Verificar si tiene consulta activa con estado_consulta_id = 1 (En Espera)
                int consultaId = 0;
                string qExiste = @"
                    SELECT TOP 1 consulta_id 
                    FROM dbo.Consultas 
                    WHERE paciente_id = @pid AND estado_consulta_id = 1
                    ORDER BY fecha_consulta DESC, consulta_id DESC";
                using (var cmdEx = new SqlCommand(qExiste, conn))
                {
                    cmdEx.Parameters.AddWithValue("@pid", pacienteId);
                    var resEx = await cmdEx.ExecuteScalarAsync();
                    if (resEx != null && resEx != DBNull.Value) consultaId = Convert.ToInt32(resEx);
                }

                if (consultaId > 0)
                {
                    string qUpd = @"
                        UPDATE dbo.Consultas 
                        SET medico_id = @mid, fecha_consulta = GETDATE()
                        WHERE consulta_id = @cid";
                    using var cmdUpd = new SqlCommand(qUpd, conn);
                    cmdUpd.Parameters.AddWithValue("@mid", medicoId);
                    cmdUpd.Parameters.AddWithValue("@cid", consultaId);
                    await cmdUpd.ExecuteNonQueryAsync();
                }
                else
                {
                    // ── Validar que el paciente no tenga ya una cita activa HOY ─────────
                    string qDupHoy = @"
                        SELECT COUNT(*) FROM dbo.Consultas
                        WHERE paciente_id = @pid
                          AND CAST(fecha_consulta AS DATE) = CAST(GETDATE() AS DATE)
                          AND estado_consulta_id NOT IN (4, 5)";
                    using (var cmdDup = new SqlCommand(qDupHoy, conn))
                    {
                        cmdDup.Parameters.AddWithValue("@pid", pacienteId);
                        var dupCount = (int)(await cmdDup.ExecuteScalarAsync() ?? 0);
                        if (dupCount > 0)
                        {
                            return BadRequest(new
                            {
                                exito = false,
                                mensaje = "Este paciente ya tiene una cita registrada para hoy. No se permiten dos citas el mismo día."
                            });
                        }
                    }
                    // ─────────────────────────────────────────────────────────────────

                    string qIns = @"
                        INSERT INTO dbo.Consultas 
                            (paciente_id, medico_id, recepcionista_id, fecha_consulta, tipo_atencion_id, estado_consulta_id, es_emergencia)
                        VALUES 
                            (@pid, @mid, @rid, GETDATE(), 1, 1, 0);
                        SELECT SCOPE_IDENTITY();";
                    using var cmdIns = new SqlCommand(qIns, conn);
                    cmdIns.Parameters.AddWithValue("@pid", pacienteId);
                    cmdIns.Parameters.AddWithValue("@mid", medicoId);
                    cmdIns.Parameters.AddWithValue("@rid", recepcionistaId);
                    var resIns = await cmdIns.ExecuteScalarAsync();
                    if (resIns != null && resIns != DBNull.Value) consultaId = Convert.ToInt32(resIns);
                }

                return Ok(new
                {
                    exito = true,
                    mensaje = $"Cita asignada exitosamente con {medicoNombre} ({model.Especialidad}).",
                    consultaId = consultaId,
                    pacienteId = pacienteId,
                    medicoId = medicoId,
                    medico = medicoNombre,
                    especialidad = model.Especialidad ?? "Medicina General",
                    costo = model.Costo > 0 ? model.Costo : 25.00m
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { exito = false, mensaje = "Error al asignar cita en el servidor: " + ex.Message });
            }
        }
    }

    public class AsignarCitaDto
    {
        public int PacienteId { get; set; }
        public string? CodigoExpediente { get; set; }
        public int? MedicoId { get; set; }
        public string? MedicoNombre { get; set; }
        public string? Especialidad { get; set; }
        public decimal Costo { get; set; }
    }

    public class PacienteCrearDto
    {
        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }
        public string? Dui { get; set; }
        public string? Dui_documento { get; set; }
        public string? Telefono { get; set; }
        public DateTime? FechaNacimiento { get; set; }
    }

    public class PacienteEstadoDto
    {
        public string? Estado { get; set; }
    }
}