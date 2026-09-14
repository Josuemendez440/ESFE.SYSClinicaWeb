using System;
using System.ComponentModel.DataAnnotations;

namespace ESFE.ClinicaWEB.Models
{
    public class CitasViewModel
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "El nombre del paciente es obligatorio")]
        public string Paciente { get; set; } = string.Empty;

        [Required(ErrorMessage = "La especialidad es obligatoria")]
        public string Especialidad { get; set; } = string.Empty;

        [Required(ErrorMessage = "El médico es obligatorio")]
        public string Medico { get; set; } = string.Empty;

        [Required(ErrorMessage = "La fecha y hora son obligatorias")]
        public DateTime FechaHora { get; set; }

        public decimal PrecioTotal { get; set; } = 50.00m;
        public decimal MontoAnticipo { get; set; } = 12.50m;
        public decimal SaldoPendiente { get; set; } = 37.50m;

        public bool PagoConfirmado { get; set; } = false;
    }
}