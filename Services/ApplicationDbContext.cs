using Microsoft.EntityFrameworkCore;
using ESFE.ClinicaWEB.Models;

namespace ESFE.ClinicaWEB.Services // Cambia por .Data si la creaste dentro de Data
{
    /// <summary>
    /// Contexto principal de base de datos Entity Framework Core para la solución ESFE.SYSClinicaWeb.
    /// Administra la conexión a la base de datos y la persistencia de las entidades del sistema clínico.
    /// </summary>
    /// <remarks>
    /// Autor: Natalia Elizabeth Hernandez
    /// Versión: 1.0
    /// Fecha: Septiembre 2026
    /// </remarks>
    public class ApplicationDbContext : DbContext
    {
        /// <summary>
        /// Inicializa una nueva instancia de la clase <see cref="ApplicationDbContext"/> con las opciones de configuración especificadas.
        /// </summary>
        /// <param name="options">Opciones de configuración de conexión y proveedor para el contexto de datos.</param>
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        /// <summary>
        /// Colección de entidades que representa la tabla de Citas médicas registradas en la base de datos.
        /// </summary>
        public DbSet<CitasViewModel> Citas { get; set; }

        /// <summary>
        /// Colección de entidades que representa la tabla de Expedientes clínicos de pacientes en la base de datos.
        /// </summary>
        public DbSet<ExpedienteViewModel> Expedientes { get; set; }
    }
}