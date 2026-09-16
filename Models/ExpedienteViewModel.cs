using System;
using System.ComponentModel.DataAnnotations;

namespace ESFE.ClinicaWEB.Models
{
    public class ExpedienteViewModel
    {
        [Key]
        public int Id { get; set; }

        public string CodigoExpediente { get; set; } = string.Empty; // "EXP-001"
        
        [Required]
        public string Nombres { get; set; } = string.Empty;
        
        [Required]
        public string Apellidos { get; set; } = string.Empty;
        
        public string NombreCompleto { get; set; } = string.Empty;
        
        [Required]
        public string Dui { get; set; } = string.Empty;
        
        public string Telefono { get; set; } = string.Empty;
        
        public string FechaNacimiento { get; set; } = string.Empty;
        
        public int Edad { get; set; } = 0;
        
        public string EdadEtiqueta { get; set; } = string.Empty;
        
        public string Especialidad { get; set; } = "Medicina General";
        
        public string Medico { get; set; } = string.Empty;
        
        public decimal Costo { get; set; } = 25.00m;
        
        public string Estado { get; set; } = "Registrado"; // Registrado, En Espera, Consulta Activa, Facturado, Liquidado
        
        public string FechaCita { get; set; } = string.Empty;
        
        public string HoraConsulta { get; set; } = string.Empty;
        
        public string Origen { get; set; } = string.Empty;
        
        public DateTime FechaCreacion { get; set; } = DateTime.Now;
    }
}
