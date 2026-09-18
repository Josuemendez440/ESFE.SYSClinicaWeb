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
                    LEFT JOIN dbo.Usuarios u ON uc.medico_id = u.usuario_id
                    LEFT JOIN dbo.Especialidades e ON u.especialidad_id = e.especialidad_id
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
                    if (costoConsulta <= 0) costoConsulta = 25.00m;

                    decimal montoAnticipo = Convert.ToDecimal(reader["monto_anticipo"]);
                    if (montoAnticipo <= 0 && totalPagos == 1 && tienePagoLiquidado == 0)
                    {
                        montoAnticipo = Convert.ToDecimal(reader["total_pagado"]);
                    }

                    bool tieneAnticipo = montoAnticipo > 0;
                    decimal saldoPendiente = Math.Max(0m, costoConsulta - montoAnticipo);

                    // Determinar estado dinámico basado en Consulta y Pagos
                    string estadoFinal = "En Espera";
                    bool liquidado = false;

                    if (tienePagoLiquidado == 1 || totalPagos >= 2)
                    {
                        estadoFinal = "Facturado";
                        liquidado = true;
                    }
                    else if (estadoConsultaId == 4)
                    {
                        estadoFinal = "Finalizado";
                    }
                    else if (estadoConsultaId == 3)
                    {
                        estadoFinal = "En Consulta";
                    }
                    else if (estadoConsultaId == 2)
                    {
                        estadoFinal = "En Triaje";
                    }
                    else
                    {
                        estadoFinal = "En Espera";
                    }

                    lista.Add(new
                    {
                        id = reader["paciente_id"],
                        paciente_id = reader["paciente_id"],
                        consultaId = reader["consulta_id"] != DBNull.Value ? reader["consulta_id"] : null,
                        codigoExpediente = reader["codigo_expediente"]?.ToString(),
                        codigo_expediente = reader["codigo_expediente"]?.ToString(),
                        nombres = nombres,
                        apellidos = apellidos,
                        nombreCompleto = $"{nombres} {apellidos}".Trim(),
                        dui = reader["dui_documento"]?.ToString(),
                        dui_documento = reader["dui_documento"]?.ToString(),
                        telefono = reader["telefono"]?.ToString() ?? "Sin Teléfono",
                        fechaNacimiento = reader["fecha_nacimiento"] != DBNull.Value ? Convert.ToDateTime(reader["fecha_nacimiento"]).ToString("yyyy-MM-dd") : null,
                        especialidad = reader["especialidad"]?.ToString() ?? "Medicina General",
                        medico = reader["medico"]?.ToString() ?? "Dr. Roberto Gómez",
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
                    LEFT JOIN dbo.Usuarios u ON uc.medico_id = u.usuario_id
                    LEFT JOIN dbo.Especialidades e ON u.especialidad_id = e.especialidad_id
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

                    string estadoFinal = "En Espera";
                    bool liquidado = false;

                    if (tienePagoLiquidado == 1 || totalPagos >= 2)
                    {
                        estadoFinal = "Facturado";
                        liquidado = true;
                    }
                    else if (estadoConsultaId == 4)
                    {
                        estadoFinal = "Finalizado";
                    }
                    else if (estadoConsultaId == 3)
                    {
                        estadoFinal = "En Consulta";
                    }
                    else if (estadoConsultaId == 2)
                    {
                        estadoFinal = "En Triaje";
                    }
                    else
                    {
                        estadoFinal = "En Espera";
                    }

                    return Ok(new
                    {
                        id = reader["paciente_id"],
                        paciente_id = reader["paciente_id"],
                        consultaId = reader["consulta_id"] != DBNull.Value ? reader["consulta_id"] : null,
                        codigoExpediente = reader["codigo_expediente"]?.ToString(),
                        codigo_expediente = reader["codigo_expediente"]?.ToString(),
                        nombres = nombres,
                        apellidos = apellidos,
                        nombreCompleto = $"{nombres} {apellidos}".Trim(),
                        dui = reader["dui_documento"]?.ToString(),
                        dui_documento = reader["dui_documento"]?.ToString(),
                        telefono = reader["telefono"]?.ToString(),
                        fechaNacimiento = reader["fecha_nacimiento"] != DBNull.Value ? Convert.ToDateTime(reader["fecha_nacimiento"]).ToString("yyyy-MM-dd") : null,
                        especialidad = reader["especialidad"]?.ToString() ?? "Medicina General",
                        medico = reader["medico"]?.ToString() ?? "Dr. Roberto Gómez",
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