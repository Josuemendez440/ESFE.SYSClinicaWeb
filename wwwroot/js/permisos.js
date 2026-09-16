document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.toLowerCase();

    // 1. Omitir ejecuciones en páginas públicas
    const esPaginaPublica = currentPath.includes('/account/login') ||
        currentPath.includes('/account/registro') ||
        currentPath.includes('/account/recuperar') ||
        currentPath.includes('/account/verificacion') ||
        currentPath.includes('/account/contrasena');

    if (esPaginaPublica) {
        return;
    }

    // 2. Verificar sesión
    const rawUsuario = sessionStorage.getItem('usuario');
    const rolRaw = sessionStorage.getItem('rol') || '';

    if (!rawUsuario || rawUsuario === 'null' || rawUsuario === 'undefined' || rawUsuario === 'Usuario') {
        window.location.href = '/Account/Login';
        return;
    }

    const usuario = rawUsuario;
    const rolLower = normalizarTexto(rolRaw);

    const esMedico = rolLower.includes('medic') || rolLower.includes('doct') || rolLower.includes('general') || rolLower.includes('medicina');
    const esEnfermero = rolLower.includes('enferm');
    const esAdmin = rolLower.includes('admin');
    const esRecep = rolLower.includes('recep');

    // 3. Extraer módulos desde sessionStorage o aplicar fallback segun rol
    let modulos = [];
    try {
        const modulosStr = sessionStorage.getItem('modulos');
        if (modulosStr && modulosStr !== '[]') {
            modulos = typeof modulosStr === 'string' && modulosStr.startsWith('[')
                ? JSON.parse(modulosStr)
                : modulosStr.split(',');
        }
    } catch (e) {
        console.error('[Curavita] Error al parsear los módulos:', e);
        modulos = [];
    }

    if (modulos.length === 0) {
        if (esAdmin) {
            modulos = ['inicio', 'citas', 'agendar', 'expedientes', 'consulta', 'facturacion'];
        } else if (esMedico) {
            modulos = ['inicio', 'consulta'];
        } else if (esEnfermero) {
            modulos = ['inicio', 'expedientes', 'agendar', 'citas'];
        } else if (esRecep) {
            modulos = ['inicio', 'facturacion'];
        } else {
            modulos = ['inicio', 'citas', 'agendar'];
        }
    }

    const modulosNormalizados = modulos.map(m => normalizarTexto(m));

    // 4. Guard de rutas (Evitar navegación directa por URL sin permiso)
    const mapRutas = [
        { ruta: '/account/citas', modulo: 'citas' },
        { ruta: '/account/agendar', modulo: 'agendar' },
        { ruta: '/account/expedientes', modulo: 'expedientes' },
        { ruta: '/account/consulta', modulo: 'consulta' },
        { ruta: '/account/facturacion', modulo: 'facturacion' }
    ];

    const rutaProtegida = mapRutas.find(r => currentPath.includes(r.ruta));
    if (rutaProtegida) {
        const tienePermiso = modulosNormalizados.some(m => m.includes(rutaProtegida.modulo));
        if (!tienePermiso) {
            console.warn(`[Curavita] Acceso restringido a: ${currentPath}`);
            window.location.href = '/Account/Inicio';
            return;
        }
    }

    // 5. Filtrar la navegación e interfaces según el atributo data-module
    const elementosModulos = document.querySelectorAll('[data-module]');
    elementosModulos.forEach(el => {
        const modAttr = el.getAttribute('data-module') || '';
        const modClean = normalizarTexto(modAttr);

        if (modClean === 'inicio') {
            el.style.display = '';
            return;
        }

        const permitido = modulosNormalizados.some(m => m.includes(modClean) || modClean.includes(m));
        el.style.display = permitido ? '' : 'none';
    });

    // 6. Actualización de interfaz y encabezados
    const citasLabels = document.querySelectorAll('.citas-label');
    citasLabels.forEach(lbl => {
        lbl.textContent = (esMedico || esEnfermero || esAdmin || esRecep) ? 'Citas' : 'Mis Citas';
    });

    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) welcomeTitle.textContent = `¡Hola, ${usuario}!`;

    const bannerTitle = document.querySelector('.banner-text h2');
    if (bannerTitle) bannerTitle.textContent = `¡Hola, ${usuario}!`;

    const headerUser = document.getElementById('headerUserName');
    if (headerUser) headerUser.textContent = usuario;

    const userPills = document.querySelectorAll('.user-pill span, .user-dropdown span');
    userPills.forEach(pill => {
        if (pill.id !== 'headerUserName') {
            const textoRol = rolRaw ? capitalizeFirst(rolRaw) : (esMedico ? 'Médico' : 'Paciente');
            pill.textContent = textoRol;
        }
    });

    const welcomeSub = document.querySelector('.welcome-subtitle');
    if (welcomeSub) {
        if (esAdmin) {
            welcomeSub.textContent = 'Bienvenido al panel de administración de Curavita.';
        } else if (esMedico) {
            welcomeSub.textContent = 'Accede al módulo de consulta médica activa.';
        } else if (esEnfermero) {
            welcomeSub.textContent = 'Gestiona expedientes clínicos y agenda de citas.';
        } else if (esRecep) {
            welcomeSub.textContent = 'Gestiona los pagos y la facturación de la clínica.';
        } else {
            welcomeSub.textContent = 'Bienvenido de nuevo a tu portal médico Curavita.';
        }
    }

    configurarLogoutGlobal();
});

function normalizarTexto(str) {
    return (str || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function configurarLogoutGlobal() {
    const btnOpenLogout = document.getElementById('btnOpenLogout');
    const logoutModal = document.getElementById('logoutModal');
    const btnCancelLogout = document.getElementById('btnCancelLogout');
    const confirmLogoutBtn = document.querySelector('#logoutModal .btn-logout-confirm, #logoutModal a[href*="Login"]');

    if (btnOpenLogout && logoutModal) {
        btnOpenLogout.addEventListener('click', (e) => {
            e.preventDefault();
            logoutModal.classList.remove('hidden');
        });
    }

    if (btnCancelLogout && logoutModal) {
        btnCancelLogout.addEventListener('click', () => {
            logoutModal.classList.add('hidden');
        });
    }

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            sessionStorage.clear();
            localStorage.clear();
        });
    }
}