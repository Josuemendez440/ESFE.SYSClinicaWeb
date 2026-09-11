document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar si hay una sesión activa
    const usuario = sessionStorage.getItem('usuario');
    if (!usuario) {
        window.location.href = '/Account/Login';
        return;
    }

    // 2. Obtener rol y módulos exactos desde sessionStorage (Base de Datos)
    const rolRaw = sessionStorage.getItem('rol') || '';
    const rol = rolRaw.trim();
    const rolLower = rol.toLowerCase();

    let modulosStr = sessionStorage.getItem('modulos');
    let modulos = [];

    try {
        modulos = modulosStr ? JSON.parse(modulosStr) : [];
    } catch (e) {
        modulos = [];
    }

    console.log('[Curavita Debug] Usuario:', usuario);
    console.log('[Curavita Debug] Rol detectado:', rol);
    console.log('[Curavita Debug] Módulos BD:', modulos);

    const currentPath = window.location.pathname.toLowerCase();

    // 3. Mapeo de rutas para protección de navegación
    const routeMap = {
        '/account/citas': 'citas',
        '/account/agendar': 'agendar',
        '/account/expedientes': 'expedientes',
        '/account/consulta': 'consulta',
        '/account/facturacion': 'facturacion'
    };

    let moduloRequerido = null;
    for (const [route, moduleName] of Object.entries(routeMap)) {
        if (currentPath.includes(route)) {
            moduloRequerido = moduleName;
            break;
        }
    }

    // Validar acceso a la página actual
    if (moduloRequerido) {
        const tieneAcceso = modulos.some(m => m.toLowerCase().includes(moduloRequerido));
        if (!tieneAcceso) {
            console.warn(`[Curavita] Acceso denegado a: ${currentPath}. Requerido: ${moduloRequerido}`);
            window.location.href = '/Account/Inicio';
            return;
        }
    }

    // 4. Ocultar o mostrar elementos según LOS MÓDULOS DE LA BASE DE DATOS
    const navItems = document.querySelectorAll('[data-module]');
    navItems.forEach(item => {
        const moduleAttr = item.getAttribute('data-module') || '';
        const moduleClean = moduleAttr.trim().toLowerCase();

        // Siempre mostrar 'Inicio'
        if (moduleClean === 'inicio') {
            item.style.display = '';
            return;
        }

        // Para los demás botones del menú/tarjetas, verificar si coinciden con los módulos devueltos por la BD
        const isAllowed = modulos.some(m => {
            const mLower = m.trim().toLowerCase();
            return mLower.includes(moduleClean) || moduleClean.includes(mLower);
        });

        if (!isAllowed) {
            item.style.display = 'none';
        } else {
            item.style.display = '';
        }
    });

    // 5. Ajustes de texto según el rol
    const citasLabel = document.querySelector('.citas-label');
    if (citasLabel) {
        if (rolLower.includes('enferm')) {
            citasLabel.textContent = 'Citas';
        } else {
            citasLabel.textContent = 'Mis Citas';
        }
    }

    // 6. Actualizar nombre del usuario
    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `¡Hola, ${usuario}!`;
    }

    const headerUserName = document.getElementById('headerUserName');
    if (headerUserName) {
        headerUserName.textContent = usuario;
    }
    const userNameDisplays = document.querySelectorAll('.user-dropdown span:not(#headerUserName)');
    userNameDisplays.forEach(span => {
        span.textContent = usuario;
    });

    // 7. Subtítulos adaptados
    const welcomeSubtitle = document.querySelector('.welcome-subtitle');
    if (welcomeSubtitle) {
        if (rolLower.includes('admin')) {
            welcomeSubtitle.textContent = 'Bienvenido al panel de administración de Curavita. Tienes acceso completo al sistema.';
        } else if (rolLower.includes('medic') || rolLower.includes('médic')) {
            welcomeSubtitle.textContent = 'Revisa tus consultas programadas y atiende a tus pacientes.';
        } else if (rolLower.includes('enferm')) {
            welcomeSubtitle.textContent = 'Administra los expedientes clínicos y las citas de tus pacientes.';
        } else if (rolLower.includes('recep')) {
            welcomeSubtitle.textContent = 'Gestiona los pagos y facturas de los pacientes.';
        } else {
            welcomeSubtitle.textContent = 'Bienvenido de nuevo a tu portal médico Curavita.';
        }
    }

    // 8. Modal de Cerrar Sesión
    const btnConfirmLogout = document.querySelector('.btn-confirm-logout, .btn-modal-confirm.btn-logout-confirm');
    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener('click', () => {
            sessionStorage.clear();
        });
    }
});