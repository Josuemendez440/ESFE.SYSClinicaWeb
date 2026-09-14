using Microsoft.EntityFrameworkCore;
using ESFE.ClinicaWEB.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Agregar servicios para controladores y vistas
builder.Services.AddControllersWithViews();

// 2. Registrar la Base de Datos con Entity Framework (SQL Server)
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 3. Registrar el servicio de envío de correos mediante SMTP
builder.Services.AddScoped<IEmailService, EmailService>();

var app = builder.Build();

// 4. Configurar la canalización de solicitudes HTTP
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// 5. Habilitar la lectura de la carpeta wwwroot (CSS, JS, imágenes)
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

// 6. Configurar la ruta por defecto hacia Account/Login
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}");

app.Run();