using Microsoft.EntityFrameworkCore;
using ESFE.ClinicaWEB.Models;

namespace ESFE.ClinicaWEB.Services // Cambia por .Data si la creaste dentro de Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // Aquí se registra la tabla de Citas
        public DbSet<CitasViewModel> Citas { get; set; }
    }
}