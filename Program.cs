using ESFE.ClinicaWEB.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Agregar servicios para controladores y vistas
builder.Services.AddControllersWithViews();

// 2. Registrar el servicio de envío de correos mediante SMTP
builder.Services.AddScoped<IEmailService, EmailService>();

var app = builder.Build();

// 3. Configurar la canalización de solicitudes HTTP
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// 4. Habilitar la lectura de la carpeta wwwroot (CSS, JS, imágenes)
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

// 5. Configurar la ruta por defecto hacia Account/Login
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}");

app.Run();