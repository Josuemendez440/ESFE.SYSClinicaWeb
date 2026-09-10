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
            return View("expedientes"); // Carga Views/Account/expedientes.cshtml (minúscula)
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
            return View("facturacion"); // Carga Views/Account/facturacion.cshtml (minúscula)
        }
    }
}