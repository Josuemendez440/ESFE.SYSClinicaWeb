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
            if (string.IsNullOrEmpty(correo) || string.IsNullOrEmpty(contrasena))
            {
                return BadRequest(new { exito = false, mensaje = "Credenciales inválidas" });
            }

            // Normalización para prevenir errores de escritura
            string correoNormalizado = correo.Trim().ToLower();

            // 1. Administrador Principal
            if (correoNormalizado == "admin@curavita.com" && contrasena == "/.4HzHe.GncV/H7MYS8S")
            {
                return Ok(new
                {
                    exito = true,
                    mensaje = "¡Bienvenido/a Administrador Principal!",
                    usuario = "Administrador Principal",
                    rol = "Administrador",
                    redirectUrl = "/Account/Inicio",
                    modulos = new[] { "Inicio", "Citas", "Agendar", "Gestion Expedientes", "Consulta", "Facturacion" }
                });
            }
            // 2. Médico (JM Alexander)
            else if (correoNormalizado == "jmalexander2007@gmail.com" && contrasena == "DrAlexander2026!")
            {
                return Ok(new
                {
                    exito = true,
                    mensaje = "¡Bienvenido/a JM Alexander!",
                    usuario = "JM Alexander",
                    rol = "Médico",
                    redirectUrl = "/Account/Inicio",
                    modulos = new[] { "Inicio", "Consulta" }
                });
            }
            // 3. ENFERMERO (Miriame Guzmán - Correo corregido con el punto)
            else if (correoNormalizado == "miriameguzman.06@gmail.com" && contrasena == "Miriame2026!Rec")
            {
                return Ok(new
                {
                    exito = true,
                    mensaje = "¡Bienvenida Miriame Guzmán!",
                    usuario = "Miriame Guzmán",
                    rol = "Enfermero",
                    redirectUrl = "/Account/Inicio",
                    modulos = new[] { "Inicio", "Citas", "Agendar", "Gestion Expedientes" }
                });
            }
            // 4. RECEPCIONISTA (Recepción Curavita)
            else if (correoNormalizado == "recepcion@curavita.com" && contrasena == "Recepcion2026!")
            {
                return Ok(new
                {
                    exito = true,
                    mensaje = "¡Bienvenido/a Recepción!",
                    usuario = "Recepción Curavita",
                    rol = "Recepcionista",
                    redirectUrl = "/Account/Inicio",
                    modulos = new[] { "Inicio", "Facturacion" }
                });
            }
            // Fallback para Pacientes / Clientes genéricos
            else
            {
                return Ok(new
                {
                    exito = true,
                    mensaje = "¡Bienvenido/a!",
                    usuario = "Paciente",
                    rol = "Cliente",
                    redirectUrl = "/Account/Inicio",
                    modulos = new[] { "Inicio", "Agendar", "Citas" }
                });
            }
        }

        // GET: /Account/Recuperar
        [HttpGet]
        public IActionResult Recuperar()
        {
            return View();
        }

        // POST: /Account/EnviarCodigo
        [HttpPost]
        public IActionResult EnviarCodigo([FromForm] string Correo)
        {
            if (string.IsNullOrEmpty(Correo))
            {
                return BadRequest(new { mensaje = "El correo es obligatorio." });
            }

            return RedirectToAction("Verificacion", "Account");
        }

        // GET: /Account/Verificacion
        [HttpGet]
        public IActionResult Verificacion()
        {
            return View("Verificacion");
        }

        // POST: /Account/ValidarCodigo
        [HttpPost]
        public IActionResult ValidarCodigo([FromForm] string CodigoOtp)
        {
            if (string.IsNullOrEmpty(CodigoOtp))
            {
                return BadRequest(new { mensaje = "El código de verificación es obligatorio." });
            }

            return RedirectToAction("Contrasena", "Account");
        }

        // GET: /Account/Contrasena
        [HttpGet]
        public IActionResult Contrasena()
        {
            return View();
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

            return RedirectToAction("Login", "Account");
        }

        // GET: /Account/Inicio
        [HttpGet]
        public IActionResult Inicio()
        {
            return View();
        }

        // GET: /Account/Citas
        [HttpGet]
        public IActionResult Citas()
        {
            return View();
        }

        // GET: /Account/Agendar
        [HttpGet]
        public IActionResult Agendar()
        {
            return View();
        }

        // GET: /Account/Expedientes
        [HttpGet]
        public IActionResult Expedientes()
        {
            return View("expedientes");
        }

        // GET: /Account/Consulta
        [HttpGet]
        public IActionResult Consulta()
        {
            return View();
        }

        // GET: /Account/Facturacion
        [HttpGet]
        public IActionResult Facturacion()
        {
            return View("facturacion");
        }
    }
}