using System.ComponentModel.DataAnnotations;

namespace ESFE.ClinicaWEB.Models
{
    // Definición de modelo utilizando Constructor Principal de C# 12
    public class RegisterViewModel(string fullName, string email, string password, string confirmPassword)
    {
        // Constructor sin parámetros necesario para la vinculación de datos (Model Binding) en ASP.NET Core
        public RegisterViewModel() : this(string.Empty, string.Empty, string.Empty, string.Empty) { }

        [Required(ErrorMessage = "El nombre completo es obligatorio.")]
        public string FullName { get; set; } = fullName;

        [Required(ErrorMessage = "El correo electrónico es obligatorio.")]
        [EmailAddress(ErrorMessage = "El correo electrónico no tiene un formato válido.")]
        public string Email { get; set; } = email;

        [Required(ErrorMessage = "La contraseña es obligatoria.")]
        [RegularExpression(@"^(?=.*[A-Za-z])(?=.*\d).{6,}$",
            ErrorMessage = "La contraseña debe tener al menos 6 caracteres e incluir letras y números.")]
        public string Password { get; set; } = password;

        [Required(ErrorMessage = "Debe confirmar la contraseña.")]
        [Compare("Password", ErrorMessage = "Las contraseñas no coinciden.")]
        public string ConfirmPassword { get; set; } = confirmPassword;
    }
}