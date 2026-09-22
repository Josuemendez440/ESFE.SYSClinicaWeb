using Microsoft.EntityFrameworkCore;
using ESFE.ClinicaWEB.Services;
using Quartz;

var builder = WebApplication.CreateBuilder(args);

// 1. Agregar servicios para controladores y vistas
builder.Services.AddControllersWithViews();

// 2. Registrar la Base de Datos con Entity Framework (SQL Server)
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 3. Registrar el servicio de envío de correos mediante SMTP
builder.Services.AddScoped<IEmailService, EmailService>();

// 4. Registrar Quartz para el envío automático de recordatorios
builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey("RecordatorioCitasJob");
    q.AddJob<RecordatorioCitasJob>(opts => opts.WithIdentity(jobKey));

    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithIdentity("RecordatorioCitasJob-trigger")
        .WithSimpleSchedule(x => x.WithInterval(TimeSpan.FromSeconds(10)).RepeatForever())); // <--- Cambiar a minutos (ej. TimeSpan.FromMinutes(30)) en producción
});

// Habilitar el servicio hospedado de Quartz en segundo plano
builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

var app = builder.Build();

// 5. Configurar la canalización de solicitudes HTTP
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// 6. Habilitar la lectura de la carpeta wwwroot (CSS, JS, imágenes)
app.UseStaticFiles();

app.UseRouting();
app.UseAuthorization();

// 7. Configurar la ruta por defecto hacia Account/Login
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}");

app.Run();