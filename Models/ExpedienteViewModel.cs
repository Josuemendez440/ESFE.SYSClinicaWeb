using System;
using System.ComponentModel.DataAnnotations;

namespace ESFE.ClinicaWEB.Models
{
    /// <summary>
    /// Representa el modelo de vista (ViewModel) para el expediente clínico de un paciente.
    /// Centraliza la información demográfica, identificación oficial (DUI), datos médicos, estado de atención y costos.
    /// </summary>
    /// <remarks>
    /// Autor: Natalia Elizabeth Hernandez
    /// Versión: 1.0
    /// Fecha: Septiembre 2026
    /// </remarks>
    public class ExpedienteViewModel
    {
        /// <summary>
        /// Identificador único autoincremental del registro de expediente en la base de datos.
        /// </summary>
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Código único estandarizado del expediente clínico del paciente (ej. "EXP-001").
        /// </summary>
        public string CodigoExpediente { get; set; } = string.Empty; // "EXP-001"
        
        /// <summary>
        /// Nombres de pila del paciente registrado.
        /// </summary>
        [Required]
        public string Nombres { get; set; } = string.Empty;
        
        /// <summary>
        /// Apellidos legales del paciente registrado.
        /// </summary>
        [Required]
        public string Apellidos { get; set; } = string.Empty;
        
        /// <summary>
        /// Nombre completo concatenado del paciente (Nombres + Apellidos) para visualización en reportes y tablas.
        /// </summary>
        public string NombreCompleto { get; set; } = string.Empty;
        
        /// <summary>
        /// Documento Único de Identidad (DUI) del paciente para validación legal e identificación única.
        /// </summary>
        [Required]
        public string Dui { get; set; } = string.Empty;
        
        /// <summary>
        /// Número telefónico de contacto del paciente o responsable para recordatorios y avisos clínicos.
        /// </summary>
        public string Telefono { get; set; } = string.Empty;
        
        /// <summary>
        /// Fecha de nacimiento del paciente en formato de texto representativo.
        /// </summary>
        public string FechaNacimiento { get; set; } = string.Empty;
        
        /// <summary>
        /// Edad calculada en años cumplidos del paciente.
        /// </summary>
        public int Edad { get; set; } = 0;
        
        /// <summary>
        /// Etiqueta descriptiva del grupo etario o rango de edad del paciente (ej. "Adulto", "Tercera Edad").
        /// </summary>
        public string EdadEtiqueta { get; set; } = string.Empty;
        
        /// <summary>
        /// Especialidad médica vinculada a la atención del expediente (ej. "Medicina General").
        /// </summary>
        public string Especialidad { get; set; } = "Medicina General";
        
        /// <summary>
        /// Nombre del médico tratante o responsable asignado al paciente.
        /// </summary>
        public string Medico { get; set; } = string.Empty;
        
        /// <summary>
        /// Costo arancelario asociado a la consulta o procedimiento médico del expediente.
        /// </summary>
        public decimal Costo { get; set; } = 25.00m;
        
        /// <summary>
        /// Estado actual del flujo de atención clínica del paciente (ej. Registrado, En Espera, Consulta Activa, Facturado, Liquidado).
        /// </summary>
        public string Estado { get; set; } = "Registrado"; // Registrado, En Espera, Consulta Activa, Facturado, Liquidado
        
        /// <summary>
        /// Fecha agendada para la cita o consulta médica asociada al expediente.
        /// </summary>
        public string FechaCita { get; set; } = string.Empty;
        
        /// <summary>
        /// Hora asignada para el inicio de la consulta médica del paciente.
        /// </summary>
        public string HoraConsulta { get; set; } = string.Empty;
        
        /// <summary>
        /// Origen o canal de procedencia de la creación del expediente (ej. Ventanilla, Web, Emergencia).
        /// </summary>
        public string Origen { get; set; } = string.Empty;
        
        /// <summary>
        /// Fecha y hora exacta de creación o alta del expediente en el sistema.
        /// </summary>
        public DateTime FechaCreacion { get; set; } = DateTime.Now;
    }
}
