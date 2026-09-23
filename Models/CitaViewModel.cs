using System;
using System.ComponentModel.DataAnnotations;

namespace ESFE.ClinicaWEB.Models
{
    /// <summary>
    /// Representa el modelo de vista (ViewModel) para la gestión y registro de citas médicas en el sistema clínico.
    /// Contiene la información del paciente, médico asignado, fecha, horarios y control de pagos/anticipos.
    /// </summary>
    /// <remarks>
    /// Autor: Natalia Elizabeth Hernandez
    /// Versión: 1.0
    /// Fecha: Septiembre 2026
    /// </remarks>
    public class CitasViewModel
    {
        /// <summary>
        /// Identificador único autoincremental de la cita médica.
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Nombre completo del paciente que solicita y asiste a la consulta médica.
        /// </summary>
        [Required(ErrorMessage = "El nombre del paciente es obligatorio")]
        public string Paciente { get; set; } = string.Empty;

        /// <summary>
        /// Especialidad médica requerida para la consulta (ej. Medicina General, Odontología, Pediatría).
        /// </summary>
        [Required(ErrorMessage = "La especialidad es obligatoria")]
        public string Especialidad { get; set; } = string.Empty;

        /// <summary>
        /// Nombre del profesional médico asignado para atender la cita.
        /// </summary>
        [Required(ErrorMessage = "El médico es obligatorio")]
        public string Medico { get; set; } = string.Empty;

        /// <summary>
        /// Fecha y hora programada para la realización de la cita médica.
        /// </summary>
        [Required(ErrorMessage = "La fecha y hora son obligatorias")]
        public DateTime FechaHora { get; set; }

        /// <summary>
        /// Monto monetario total fijado para la consulta o servicio médico brindado.
        /// </summary>
        public decimal PrecioTotal { get; set; } = 50.00m;

        /// <summary>
        /// Monto abonado previamente por el paciente en concepto de anticipo o reserva de cita.
        /// </summary>
        public decimal MontoAnticipo { get; set; } = 12.50m;

        /// <summary>
        /// Monto restante que el paciente tiene pendiente de cancelar el día de la cita.
        /// </summary>
        public decimal SaldoPendiente { get; set; } = 37.50m;

        /// <summary>
        /// Indicador booleano que determina si el pago de la cita médica ha sido verificado y confirmado.
        /// </summary>
        public bool PagoConfirmado { get; set; } = false;
    }
}