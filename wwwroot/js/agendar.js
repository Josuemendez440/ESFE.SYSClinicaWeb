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
        agendarForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // --- Capturar valores ---
            const nombresEl   = document.getElementById("nombres");
            const apellidosEl = document.getElementById("apellidos");
            const duiEl       = inputDui;
            const telEl       = inputTelefono;
            const fechaNacEl  = inputFechaNacimiento;
            const fechaCitaEl = document.getElementById("fechaCita");

            const nombres   = nombresEl?.value.trim()   || "";
            const apellidos = apellidosEl?.value.trim() || "";
            const dui       = duiEl?.value.trim()       || "";
            const telefono  = telEl?.value.trim()       || "";
            const fechaNac  = fechaNacEl?.value         || "";
            const fechaCita = fechaCitaEl?.value        || "";
            const esp       = especialidadSelect?.value || "";
            const med       = medicoSelect?.value       || "";
            const hora      = horaConsultaSelect?.value || "";

            let hayError = false;

            // Nombres
            if (!nombres) {
                marcarError(nombresEl, "Los nombres son requeridos.");
                hayError = true;
            } else if (!validarNombre(nombres)) {
                marcarError(nombresEl, "Solo se permiten letras y espacios (mín. 2 caracteres).");
                hayError = true;
            } else { limpiarError(nombresEl); }

            // Apellidos
            if (!apellidos) {
                marcarError(apellidosEl, "Los apellidos son requeridos.");
                hayError = true;
            } else if (!validarNombre(apellidos)) {
                marcarError(apellidosEl, "Solo se permiten letras y espacios (mín. 2 caracteres).");
                hayError = true;
            } else { limpiarError(apellidosEl); }

            // DUI salvadoreño
            if (!dui) {
                marcarError(duiEl, "El DUI es requerido.");
                hayError = true;
            } else if (!validarDui(dui)) {
                marcarError(duiEl, "DUI inválido. Formato requerido: 00000000-0");
                hayError = true;
            } else { limpiarError(duiEl); }

            // Teléfono
            if (telefono && !validarTelefono(telefono)) {
                marcarError(telEl, "Teléfono inválido. Formato requerido: 0000-0000");
                hayError = true;
            } else { limpiarError(telEl); }

            // Fecha de Nacimiento
            if (fechaNac) {
                const rFN = validarFechaNacimiento(fechaNac, 0, 120);
                if (!rFN.valido) {
                    marcarError(fechaNacEl, rFN.mensaje);
                    hayError = true;
                } else { limpiarError(fechaNacEl); }
            }

            // Fecha de Cita
            if (!fechaCita) {
                marcarError(fechaCitaEl, "La fecha de la cita es requerida.");
                hayError = true;
            } else {
                const rFC = validarFechaCita(fechaCita);
                if (!rFC.valido) {
                    marcarError(fechaCitaEl, rFC.mensaje);
                    hayError = true;
                } else { limpiarError(fechaCitaEl); }
            }

            // Especialidad
            if (!esp) {
                mostrarToast("⚠️ Selecciona una especialidad.", "error");
                hayError = true;
            }

            // Médico
            if (!med) {
                mostrarToast("⚠️ Selecciona un médico especialista.", "error");
                hayError = true;
            }

            // Hora
            if (!hora) {
                mostrarToast("⚠️ Selecciona una hora de consulta.", "error");
                hayError = true;
            }

            if (hayError) return;

            // Capturar datos del formulario (ya validados arriba)
            const especialidad  = esp;
            const medico        = med;
            const horaConsulta  = hora;
            const fechaNacimiento = fechaNac;
            const nombreCompleto  = `${nombres} ${apellidos}`.trim();


            const costoConsultaTemp = especialidad === "Cardiología" ? 50.00 : (especialidad === "Pediatría" ? 35.00 : 25.00);

            // Formar objeto con los datos procesados para el pago
            const datosCita = {
                paciente: nombreCompleto,
                especialidadMedico: `${especialidad} \u2013 ${medico}`,
                fechaHora: `${formatearFecha(fechaCita)} \u2013 ${horaConsulta}`,
                especialidad: especialidad,
                medico: medico,
                fecha: fechaCita,
                hora: horaConsulta,
                dui: dui,
                telefono: telefono,
                fechaNacimiento: fechaNacimiento,
                costo: costoConsultaTemp
            };

            // Guardar en localStorage para la vista de pago
            localStorage.setItem("resumenCitaData", JSON.stringify(datosCita));
            localStorage.setItem("citaAgendada", JSON.stringify(datosCita));

            // --- SINCRONIZACIÓN CON GESTIÓN DE EXPEDIENTES Y CONSULTA MÉDICA ---
            try {
                // Obtener expedientes desde la API
                const resp = await fetch("/api/ExpedientesApi");
                let expedientes = [];
                if (resp.ok) {
                    expedientes = await resp.json();
                }

                // Buscar si ya existe un expediente con el mismo DUI
                let expedienteExistente = (dui && dui !== "00000000-0")
                    ? expedientes.find(e => e.dui === dui)
                    : null;

                const costoConsulta = especialidad === "Cardiología" ? 50.00 : (especialidad === "Pediatría" ? 35.00 : 25.00);

                let edadCalculada = 35;
                let edadEtiqueta = "35 años";
                if (fechaNacimiento && typeof calcularEdadExacta === "function") {
                    const rEdad = calcularEdadExacta(fechaNacimiento);
                    edadCalculada = rEdad.edad;
                    edadEtiqueta = rEdad.etiqueta;
                }

                if (expedienteExistente) {
                    // Actualizar datos del paciente existente
                    const expTarget = { ...expedienteExistente };
                    expTarget.nombres = nombres;
                    expTarget.apellidos = apellidos;
                    expTarget.nombreCompleto = nombreCompleto;
                    expTarget.telefono = telefono;
                    expTarget.fechaNacimiento = fechaNacimiento;
                    expTarget.especialidad = especialidad;
                    expTarget.medico = medico;
                    expTarget.costo = costoConsulta;
                    expTarget.estado = "En Espera";
                    expTarget.fechaCita = fechaCita;
                    expTarget.horaConsulta = horaConsulta;
                    expTarget.origen = "Agendar Cita";
                    expTarget.edad = edadCalculada;
                    expTarget.edadEtiqueta = edadEtiqueta;

                    const putResp = await fetch(`/api/ExpedientesApi/${expTarget.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(expTarget)
                    });
                    if (!putResp.ok) {
                        mostrarToast("⚠️ Error al actualizar el expediente. Intenta nuevamente.", "error");
                        return;
                    }
                } else {
                    // Crear nuevo paciente
                    const nuevoExpediente = {
                        codigoExpediente: "",
                        nombres: nombres,
                        apellidos: apellidos,
                        nombreCompleto: nombreCompleto,
                        dui: dui,
                        telefono: telefono,
                        fechaNacimiento: fechaNacimiento,
                        especialidad: especialidad,
                        medico: medico,
                        costo: costoConsulta,
                        estado: "En Espera",
                        fechaCita: fechaCita,
                        horaConsulta: horaConsulta,
                        origen: "Agendar Cita",
                        edad: edadCalculada,
                        edadEtiqueta: edadEtiqueta,
                        fechaCreacion: new Date().toISOString()
                    };

                    const postResp = await fetch("/api/ExpedientesApi", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(nuevoExpediente)
                    });
                    if (!postResp.ok) {
                        mostrarToast("⚠️ Error al registrar el expediente. Intenta nuevamente.", "error");
                        return;
                    }
                }
            } catch (err) {
                console.error("[Curavita] Error al sincronizar expediente:", err);
                mostrarToast("⚠️ Error de conexión al guardar. Intenta nuevamente.", "error");
                return;
            }

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