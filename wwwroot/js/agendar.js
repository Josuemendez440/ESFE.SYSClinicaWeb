document.addEventListener("DOMContentLoaded", () => {
    const medicosPorEspecialidad = {
        "Cardiología": [
            { id: 1, nombre: "Dr. Roberto Gómez" },
            { id: 2, nombre: "Dra. Sofía Alvarado" }
        ],
        "Medicina General": [
            { id: 3, nombre: "Dra. Elena Ramos" },
            { id: 4, nombre: "Dr. Roberto Fuentes" }
        ],
        "Pediatría": [
            { id: 5, nombre: "Dra. Lucía Méndez" },
            { id: 6, nombre: "Dr. Mario Castillo" }
        ]
    };

    const horariosDisponibles = [
        "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
        "02:00 PM", "03:00 PM", "04:00 PM"
    ];

    const agendarForm = document.getElementById("agendarForm");
    const especialidadSelect = document.getElementById("especialidad");
    const medicoSelect = document.getElementById("medico");
    const horaConsultaSelect = document.getElementById("horaConsulta");
    const inputDui = document.getElementById("dui");
    const inputTelefono = document.getElementById("telefono");
    const inputFechaNacimiento = document.getElementById("fechaNacimiento");

    const logoutModal = document.getElementById("logoutModal");
    const btnOpenLogout = document.getElementById("btnOpenLogout");
    const btnCancelLogout = document.getElementById("btnCancelLogout");

    // Formateo para DUI ( El Salvador: 00000000-0 )
    if (inputDui) {
        inputDui.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length > 9) val = val.substring(0, 9);
            if (val.length > 8) {
                val = val.substring(0, 8) + "-" + val.substring(8);
            }
            e.target.value = val;
        });
    }

    // Formateo para Teléfono ( 0000-0000 )
    if (inputTelefono) {
        inputTelefono.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length > 8) val = val.substring(0, 8);
            if (val.length > 4) {
                val = val.substring(0, 4) + "-" + val.substring(4);
            }
            e.target.value = val;
        });
    }

    // Función para validar edad (sin romper el flujo)
    function validarEdadPaciente(fechaNacStr) {
        if (!fechaNacStr) return true;

        const partes = fechaNacStr.split("-");
        if (partes.length !== 3) return true;

        const anio = parseInt(partes[0], 10);
        if (partes[0].length < 4 || isNaN(anio)) return true;

        const mes = parseInt(partes[1], 10) - 1;
        const dia = parseInt(partes[2], 10);

        const fechaNac = new Date(anio, mes, dia);
        const hoy = new Date();

        let edad = hoy.getFullYear() - fechaNac.getFullYear();
        const mesDiff = hoy.getMonth() - fechaNac.getMonth();

        if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fechaNac.getDate())) {
            edad--;
        }

        if (edad > 80 || edad < 0) {
            if (inputFechaNacimiento) {
                inputFechaNacimiento.value = "";
                inputFechaNacimiento.focus();
            }
            return false;
        }

        return true;
    }

    // 1. Cargar médicos según la especialidad seleccionada
    if (especialidadSelect && medicoSelect) {
        especialidadSelect.addEventListener("change", (e) => {
            const espSelected = e.target.value;
            medicoSelect.innerHTML = '<option value="" disabled selected>Seleccione Especialista</option>';

            if (medicosPorEspecialidad[espSelected]) {
                medicosPorEspecialidad[espSelected].forEach((m) => {
                    const opt = document.createElement("option");
                    opt.value = m.nombre;
                    opt.textContent = m.nombre;
                    medicoSelect.appendChild(opt);
                });
                medicoSelect.disabled = false;
            } else {
                medicoSelect.disabled = true;
            }

            if (horaConsultaSelect) {
                horaConsultaSelect.innerHTML = '<option value="" disabled selected>Seleccione Médico primero</option>';
                horaConsultaSelect.disabled = true;
            }
        });
    }

    // 2. Cargar horas cuando se selecciona un médico
    if (medicoSelect && horaConsultaSelect) {
        medicoSelect.addEventListener("change", () => {
            horaConsultaSelect.innerHTML = '<option value="" disabled selected>Seleccione Hora</option>';
            horariosDisponibles.forEach((h) => {
                const opt = document.createElement("option");
                opt.value = h;
                opt.textContent = h;
                horaConsultaSelect.appendChild(opt);
            });
            horaConsultaSelect.disabled = false;
        });
    }

    // 3. Guardar datos en el navegador y REDIRIGIR explícitamente
    if (agendarForm) {
        agendarForm.addEventListener("submit", (e) => {
            // Evitar recarga predeterminada del formulario HTML
            e.preventDefault();

            // Validar edad si el campo existe
            if (inputFechaNacimiento && inputFechaNacimiento.value) {
                if (!validarEdadPaciente(inputFechaNacimiento.value)) {
                    return; // Si la edad supera 80 se detiene y borra la fecha
                }
            }

            // Capturar datos del formulario
            const nombres = document.getElementById("nombres")?.value || "";
            const apellidos = document.getElementById("apellidos")?.value || "";
            const especialidad = especialidadSelect?.value || "";
            const medico = medicoSelect?.value || "";
            const fechaCita = document.getElementById("fechaCita")?.value || "";
            const horaConsulta = horaConsultaSelect?.value || "";

            // Formar objeto con los datos procesados
            const datosCita = {
                paciente: `${nombres} ${apellidos}`.trim(),
                especialidadMedico: `${especialidad} – ${medico}`,
                fechaHora: `${formatearFecha(fechaCita)} – ${horaConsulta}`,
                especialidad: especialidad,
                medico: medico,
                fecha: fechaCita,
                hora: horaConsulta
            };

            // Guardar en localStorage para la vista de pago
            localStorage.setItem("resumenCitaData", JSON.stringify(datosCita));
            localStorage.setItem("citaAgendada", JSON.stringify(datosCita));

            // REDIRECCIÓN DIRECTA A LA PANTALLA DE PAGO
            window.location.href = "/Account/Confirma_pago";
        });
    }

    // Función auxiliar para formatear la fecha
    function formatearFecha(fechaStr) {
        if (!fechaStr) return "";
        const partes = fechaStr.split("-");
        if (partes.length !== 3) return fechaStr;

        const meses = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];

        const anio = partes[0];
        const mes = meses[parseInt(partes[1], 10) - 1];
        const dia = parseInt(partes[2], 10);

        return `${dia} de ${mes}, ${anio}`;
    }

    // Modal de Cerrar Sesión
    if (btnOpenLogout && logoutModal) {
        btnOpenLogout.addEventListener("click", () => logoutModal.classList.remove("hidden"));
    }

    if (btnCancelLogout && logoutModal) {
        btnCancelLogout.addEventListener("click", () => logoutModal.classList.add("hidden"));
    }

    if (logoutModal) {
        logoutModal.addEventListener("click", (e) => {
            if (e.target === logoutModal) logoutModal.classList.add("hidden");
        });
    }
});