using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ESFE.ClinicaWEB.Models;
using ESFE.ClinicaWEB.Services;
using System;

namespace ESFE.ClinicaWEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ExpedientesApiController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ExpedientesApiController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/ExpedientesApi
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ExpedienteViewModel>>> GetExpedientes()
        {
            return await _context.Expedientes.OrderByDescending(e => e.Id).ToListAsync();
        }

        // GET: api/ExpedientesApi/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ExpedienteViewModel>> GetExpediente(int id)
        {
            var expediente = await _context.Expedientes.FindAsync(id);

            if (expediente == null)
            {
                return NotFound();
            }

            return expediente;
        }

        // PUT: api/ExpedientesApi/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutExpediente(int id, ExpedienteViewModel expediente)
        {
            if (id != expediente.Id)
            {
                return BadRequest();
            }

            _context.Entry(expediente).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ExpedienteExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/ExpedientesApi
        [HttpPost]
        public async Task<ActionResult<ExpedienteViewModel>> PostExpediente(ExpedienteViewModel expediente)
        {
            _context.Expedientes.Add(expediente);
            await _context.SaveChangesAsync();

            // Actualizar CodigoExpediente después de tener el Id autogenerado si no viene seteado
            if (string.IsNullOrEmpty(expediente.CodigoExpediente))
            {
                expediente.CodigoExpediente = $"EXP-{expediente.Id:D3}";
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction("GetExpediente", new { id = expediente.Id }, expediente);
        }

        // DELETE: api/ExpedientesApi/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteExpediente(int id)
        {
            var expediente = await _context.Expedientes.FindAsync(id);
            if (expediente == null)
            {
                return NotFound();
            }

            _context.Expedientes.Remove(expediente);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ExpedienteExists(int id)
        {
            return _context.Expedientes.Any(e => e.Id == id);
        }
    }
}
