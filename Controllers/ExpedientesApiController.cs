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
                    SELECT 
                        paciente_id,
                        codigo_expediente,
                        nombres,
                        apellidos,
                        dui_documento,
                        telefono,
                        fecha_nacimiento
                    FROM dbo.Pacientes
                    ORDER BY paciente_id DESC";

                using var cmd = new SqlCommand(query, conn);
                using var reader = cmd.ExecuteReader();

                while (reader.Read())
                {
                    string nombres = reader["nombres"]?.ToString() ?? "";
                    string apellidos = reader["apellidos"]?.ToString() ?? "";

                    lista.Add(new
                    {
                        id = reader["paciente_id"],
                        paciente_id = reader["paciente_id"],
                        codigoExpediente = reader["codigo_expediente"]?.ToString(),
                        codigo_expediente = reader["codigo_expediente"]?.ToString(),
                        nombres = nombres,
                        apellidos = apellidos,
                        nombreCompleto = $"{nombres} {apellidos}".Trim(),
                        dui = reader["dui_documento"]?.ToString(),
                        dui_documento = reader["dui_documento"]?.ToString(),
                        telefono = reader["telefono"]?.ToString() ?? "Sin Teléfono",
                        fechaNacimiento = reader["fecha_nacimiento"] != DBNull.Value ? Convert.ToDateTime(reader["fecha_nacimiento"]).ToString("yyyy-MM-dd") : null,
                        estado = "En Espera"
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
                    SELECT 
                        paciente_id,
                        codigo_expediente,
                        nombres,
                        apellidos,
                        dui_documento,
                        telefono,
                        fecha_nacimiento
                    FROM dbo.Pacientes
                    WHERE paciente_id = @id";

                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@id", id);
                using var reader = cmd.ExecuteReader();

                if (reader.Read())
                {
                    string nombres = reader["nombres"]?.ToString() ?? "";
                    string apellidos = reader["apellidos"]?.ToString() ?? "";

                    return Ok(new
                    {
                        id = reader["paciente_id"],
                        paciente_id = reader["paciente_id"],
                        codigoExpediente = reader["codigo_expediente"]?.ToString(),
                        nombres = nombres,
                        apellidos = apellidos,
                        nombreCompleto = $"{nombres} {apellidos}".Trim(),
                        dui = reader["dui_documento"]?.ToString(),
                        telefono = reader["telefono"]?.ToString(),
                        fechaNacimiento = reader["fecha_nacimiento"] != DBNull.Value ? Convert.ToDateTime(reader["fecha_nacimiento"]).ToString("yyyy-MM-dd") : null,
                        estado = "En Espera"
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