using Microsoft.AspNetCore.Mvc;

namespace ESFE.ClinicaWEB.Controllers
{
    public class AccountController : Controller
    {
        // GET: /Account/Login
        [HttpGet]
        public IActionResult Login()
        {
            return View();
        }

        // POST: /Account/Login
        [HttpPost]
        public IActionResult Login([FromForm] string correo, [FromForm] string contrasena)
        {
            // Validación temporal de prueba
            if (!string.IsNullOrEmpty(correo) && !string.IsNullOrEmpty(contrasena))
            {
                return RedirectToAction("Inicio", "Account");
            }

            return BadRequest(new { mensaje = "Credenciales inválidas" });
        }

        // GET: /Account/Recuperar
        [HttpGet]
        public IActionResult Recuperar()
        {
            return View(); // Carga Views/Account/Recuperar.cshtml
        }

        // POST: /Account/EnviarCodigo
        [HttpPost]
        public IActionResult EnviarCodigo([FromForm] string Correo)
        {
            if (string.IsNullOrEmpty(Correo))
            {
                return BadRequest(new { mensaje = "El correo es obligatorio." });
            }

            // TODO: Lógica para enviar el código de verificación al correo

            // Redirige hacia la vista de Verificación tras enviar el código
            return RedirectToAction("Verificacion", "Account");
        }

        // GET: /Account/Verificacion
        [HttpGet]
        public IActionResult Verificacion()
        {
            return View("Verificacion"); // Carga Views/Account/Verificacion.cshtml
        }

        // POST: /Account/ValidarCodigo
        [HttpPost]
        public IActionResult ValidarCodigo([FromForm] string CodigoOtp)
        {
            if (string.IsNullOrEmpty(CodigoOtp))
            {
                return BadRequest(new { mensaje = "El código de verificación es obligatorio." });
            }

            // TODO: Lógica para validar el código OTP ingresado

            // Redirige a la pantalla para ingresar la nueva contraseña
            return RedirectToAction("Contrasena", "Account");
        }

        // GET: /Account/Contrasena
        [HttpGet]
        public IActionResult Contrasena()
        {
            return View(); // Carga Views/Account/Contrasena.cshtml
        }

        // POST: /Account/CambiarContrasena
        [HttpPost]
        public IActionResult CambiarContrasena([FromForm] string NewPassword, [FromForm] string ConfirmPassword)
        {
            if (string.IsNullOrEmpty(NewPassword) || string.IsNullOrEmpty(ConfirmPassword))
            {
                return BadRequest(new { mensaje = "Todos los campos son obligatorios." });
            }

            if (NewPassword != ConfirmPassword)
            {
                return BadRequest(new { mensaje = "Las contraseñas no coinciden." });
            }

            // TODO: Lógica para actualizar la contraseña en la base de datos

            // Redirige al Login una vez completado el cambio
            return RedirectToAction("Login", "Account");
        }

        // GET: /Account/Inicio
        [HttpGet]
        public IActionResult Inicio()
        {
            return View(); // Carga Views/Account/Inicio.cshtml
        }

        // GET: /Account/Citas
        [HttpGet]
        public IActionResult Citas()
        {
            return View(); // Carga Views/Account/Citas.cshtml
        }

        // GET: /Account/Agendar
        [HttpGet]
        public IActionResult Agendar()
        {
            return View(); // Carga Views/Account/Agendar.cshtml
        }

        // GET: /Account/Expedientes
        [HttpGet]
        public IActionResult Expedientes()
        {
            return View("expedientes"); // Carga Views/Account/expedientes.cshtml
        }

        // GET: /Account/Consulta
        [HttpGet]
        public IActionResult Consulta()
        {
            return View(); // Carga Views/Account/Consulta.cshtml
        }

        // GET: /Account/Facturacion
        [HttpGet]
        public IActionResult Facturacion()
        {
            return View("facturacion"); // Carga Views/Account/facturacion.cshtml
        }
    }
}