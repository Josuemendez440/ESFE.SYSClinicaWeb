using System.ComponentModel.DataAnnotations;

namespace ESFE.ClinicaWEB.Models
{
    /// <summary>
    /// Modelo de vista para el proceso de registro de nuevos usuarios en la plataforma clínica.
    /// Valida los requisitos de seguridad de credenciales y la información de perfil inicial.
    /// </summary>
    /// <remarks>
    /// Autor: Natalia Elizabeth Hernandez
    /// Versión: 1.0
    /// Fecha: Septiembre 2026
    /// </remarks>
    public class RegisterViewModel
    {
        /// <summary>
        /// Constructor principal que inicializa el modelo con los valores suministrados en el formulario de registro.
        /// </summary>
        /// <param name="fullName">Nombre completo del usuario aspirante.</param>
        /// <param name="email">Dirección de correo electrónico única para inicio de sesión y notificaciones.</param>
        /// <param name="password">Contraseña en texto plano que debe cumplir con las directivas de seguridad.</param>
        /// <param name="confirmPassword">Confirmación de contraseña para evitar errores de escritura.</param>
        public RegisterViewModel(string fullName, string email, string password, string confirmPassword)
        {
            FullName = fullName;
            Email = email;
            Password = password;
            ConfirmPassword = confirmPassword;
        }

        /// <summary>
        /// Constructor sin parámetros requerido para el mecanismo de Model Binding y serialización de ASP.NET Core.
        /// </summary>
        public RegisterViewModel() : this(string.Empty, string.Empty, string.Empty, string.Empty) { }

        /// <summary>
        /// Nombre y apellido completo del usuario a registrarse en el sistema.
        /// </summary>
        [Required(ErrorMessage = "El nombre completo es obligatorio.")]
        public string FullName { get; set; }

        /// <summary>
        /// Dirección de correo electrónico principal del usuario; actúa como identificador para la autenticación.
        /// </summary>
        [Required(ErrorMessage = "El correo electrónico es obligatorio.")]
        [EmailAddress(ErrorMessage = "El correo electrónico no tiene un formato válido.")]
        public string Email { get; set; }

        /// <summary>
        /// Contraseña elegida por el usuario, protegida bajo reglas de complejidad alfanumérica.
        /// </summary>
        [Required(ErrorMessage = "La contraseña es obligatoria.")]
        [RegularExpression(@"^(?=.*[A-Za-z])(?=.*\d).{6,}$",
            ErrorMessage = "La contraseña debe tener al menos 6 caracteres e incluir letras y números.")]
        public string Password { get; set; }

        /// <summary>
        /// Campo de confirmación que debe coincidir exactamente con la contraseña introducida.
        /// </summary>
        [Required(ErrorMessage = "Debe confirmar la contraseña.")]
        [Compare("Password", ErrorMessage = "Las contraseñas no coinciden.")]
        public string ConfirmPassword { get; set; }
    }
}