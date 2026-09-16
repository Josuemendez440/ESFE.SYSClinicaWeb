document.addEventListener("DOMContentLoaded", () => {
    // --- ESTADO INICIAL Y CARGA DE DATOS ---
    const EXPEDIENTES_KEY = "curavita_expedientes";
    const COLA_KEY = "curavita_cola_espera";

    // Nombres y DUIs de demostración a omitir
    const DEMO_DUIS = ["02345678-9", "01234567-8", "03456789-0"];

    async function obtenerExpedientes() {
        try {
            const resp = await fetch("/api/ExpedientesApi");
            if (!resp.ok) return [];
            const data = await resp.json();
            return data;
        } catch {
            return [];
        }
    }

    // --- ELEMENTOS DEL DOM ---
    const formCrearExpediente = document.getElementById("formCrearExpediente");
    const inputNombres = document.getElementById("nombres");
    const inputApellidos = document.getElementById("apellidos");
    const inputDui = document.getElementById("dui");
    const inputTelefono = document.getElementById("telefono");
    const inputFechaNacimiento = document.getElementById("fechaNacimiento");

    const inputBusqueda = document.getElementById("inputBusqueda");
    const tablaPacientes = document.getElementById("tablaPacientes");

    // Modal Operación Exitosa
    const modalOperacionExitosa = document.getElementById("modalOperacionExitosa");
    const msgOperacionExitosa = document.getElementById("msgOperacionExitosa");
    const btnAceptarOperacion = document.getElementById("btnAceptarOperacion");

    // Modal Asignar Cita
    const modalAsignarCita = document.getElementById("modalAsignarCita");
    const modalAsignarPaciente = document.getElementById("modalAsignarPaciente");
    const modalAsignarCodigo = document.getElementById("modalAsignarCodigo");
    const selectEspecialidad = document.getElementById("selectEspecialidad");
    const displayMontoConsulta = document.getElementById("displayMontoConsulta");
    const btnCancelarAsignacion = document.getElementById("btnCancelarAsignacion");
    const btnConfirmarAsignacion = document.getElementById("btnConfirmarAsignacion");

    let pacienteSeleccionadoParaCita = null;

    // --- FORMATEO AUTOMÁTICO DE INPUTS (DUI & TELÉFONO) ---
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

    // --- RENDERIZADO DE LA TABLA ---
    async function renderTabla(filtro = "") {
        if (!tablaPacientes) return;
        const expedientes = await obtenerExpedientes();
        const f = filtro.toLowerCase().trim();

        const filtrados = expedientes.filter(exp => {
            if (!f) return true;
            const nom = (exp.nombreCompleto || `${exp.nombres} ${exp.apellidos}`).toLowerCase();
            const dui = (exp.dui || "").toLowerCase();
            const id = (exp.id || "").toLowerCase();
            return nom.includes(f) || dui.includes(f) || id.includes(f);
        });

        tablaPacientes.innerHTML = "";

        if (filtrados.length === 0) {
            const trVacio = document.createElement("tr");
            trVacio.innerHTML = `<td colspan="5" style="text-align: center; color: #94a3b8; padding: 24px;">No se encontraron expedientes registrados.</td>`;
            tablaPacientes.appendChild(trVacio);
            return;
        }

        filtrados.forEach(exp => {
            const tr = document.createElement("tr");

            // Determinar clase del badge según estado
            let estadoClass = "badge-registrado";
            if (exp.estado === "En Espera") estadoClass = "badge-espera";
            else if (exp.estado === "Consulta Activa") estadoClass = "badge-consulta";
            else if (exp.estado === "Facturado") estadoClass = "badge-facturado";
            else if (exp.estado === "Liquidado") estadoClass = "badge-liquidado";

            // Resaltar si viene de agendar cita
            const citaReciente = (() => {
                try {
                    const c = JSON.parse(sessionStorage.getItem("curavita_ultima_cita") || "{}");
                    return c.id === exp.id;
                } catch { return false; }
            })();

            // Determinar la columna de acción según el estado del expediente
            let accionHtml = "";
            const estadoActual = exp.estado || "Registrado";

            if (estadoActual === "En Espera") {
                // Paciente ya tiene cita asignada (desde web o clínica) y está en cola
                accionHtml = `
                    <button type="button" class="btn-cita-asignada" data-id="${exp.id}" title="Haga clic para ver detalles de la cita asignada">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>En Espera</span>
                    </button>
                `;
            } else if (estadoActual === "Registrado") {
                // Paciente registrado sin cita asignada (creado en recepción): habilitado para asignar cita
                accionHtml = `
                    <button type="button" class="btn-select-patient" data-id="${exp.id}">Seleccionar</button>
                `;
            } else if (estadoActual === "Consulta Activa") {
                accionHtml = `<span class="badge-status badge-consulta">En Consulta</span>`;
            } else if (estadoActual === "Facturado") {
                // Paciente ya en facturación pero puede necesitar nueva cita
                accionHtml = `
                    <button type="button" class="btn-nueva-cita" data-id="${exp.id}" title="Agendar una nueva consulta para este paciente">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>Nueva Cita</span>
                    </button>
                `;
            } else if (estadoActual === "Liquidado") {
                // Paciente atendido y pagado — puede regresar para nueva consulta
                accionHtml = `
                    <button type="button" class="btn-nueva-cita" data-id="${exp.id}" title="Agendar una nueva consulta para este paciente">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>Nueva Cita</span>
                    </button>
                `;
            } else {
                accionHtml = `<button type="button" class="btn-select-patient" data-id="${exp.id}">Seleccionar</button>`;
            }

            tr.innerHTML = `
                <td><strong>${exp.codigoExpediente || exp.id}</strong></td>
                <td>${exp.nombreCompleto || `${exp.nombres} ${exp.apellidos}`}</td>
                <td>${exp.dui}</td>
                <td><span class="badge-status ${estadoClass}">${estadoActual}</span></td>
                <td class="text-right">
                    ${accionHtml}
                </td>
            `;

            if (citaReciente) {
                tr.style.backgroundColor = "#f0fdfa";
                tr.style.borderLeft = "4px solid #0d9488";
                tr.style.animation = "rowHighlight 1.5s ease";
            }

            // Event listeners según acción
            const btnSelect = tr.querySelector(".btn-select-patient");
            if (btnSelect) {
                btnSelect.addEventListener("click", () => {
                    abrirModalAsignarCita(exp);
                });
            }

            const btnAsignada = tr.querySelector(".btn-cita-asignada");
            if (btnAsignada) {
                btnAsignada.addEventListener("click", () => {
                    abrirModalDetalleCita(exp);
                });
            }

            // Botón Nueva Cita (pacientes Liquidado o Facturado)
            const btnNuevaCita = tr.querySelector(".btn-nueva-cita");
            if (btnNuevaCita) {
                btnNuevaCita.addEventListener("click", async () => {
                    // Resetear estado para poder asignar nueva cita
                    const expTarget = { ...exp, estado: "Registrado" };
                    try {
                        await fetch(`/api/ExpedientesApi/${exp.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(expTarget)
                        });
                    } catch (e) {
                        console.error(e);
                    }
                    // Abrir modal de asignación de especialidad
                    abrirModalAsignarCita(expTarget);
                });
            }

            tablaPacientes.appendChild(tr);
        });
    }

    // --- FILTRO EN TIEMPO REAL ---
    if (inputBusqueda) {
        inputBusqueda.addEventListener("input", (e) => {
            renderTabla(e.target.value);
        });
    }

    if (formCrearExpediente) {
        formCrearExpediente.addEventListener("submit", async (e) => {
            e.preventDefault();

            const nombres = inputNombres?.value.trim() || "";
            const apellidos = inputApellidos?.value.trim() || "";
            const dui = inputDui?.value.trim() || "";
            const telefono = inputTelefono?.value.trim() || "";
            const fechaNacimiento = inputFechaNacimiento?.value || "";

            if (!nombres || !apellidos || !dui) {
                // Validaciones completas campo por campo
                let hayError = false;

                if (!nombres) {
                    marcarError(inputNombres, "Los nombres son requeridos.");
                    hayError = true;
                } else if (!validarNombre(nombres)) {
                    marcarError(inputNombres, "Solo se permiten letras y espacios (mín. 2 caracteres).");
                    hayError = true;
                } else { limpiarError(inputNombres); }

                if (!apellidos) {
                    marcarError(inputApellidos, "Los apellidos son requeridos.");
                    hayError = true;
                } else if (!validarNombre(apellidos)) {
                    marcarError(inputApellidos, "Solo se permiten letras y espacios (mín. 2 caracteres).");
                    hayError = true;
                } else { limpiarError(inputApellidos); }

                if (!dui) {
                    marcarError(inputDui, "El DUI es requerido.");
                    hayError = true;
                }

                if (hayError) {
                    mostrarToast("⚠️ Por favor complete los campos obligatorios.", "error");
                    return;
                }
            }

            // Validar nombre
            if (!validarNombre(nombres)) {
                marcarError(inputNombres, "Solo se permiten letras y espacios (mín. 2 caracteres).");
                mostrarToast("⚠️ Nombre inválido.", "error");
                return;
            } else { limpiarError(inputNombres); }

            // Validar apellido
            if (!validarNombre(apellidos)) {
                marcarError(inputApellidos, "Solo se permiten letras y espacios (mín. 2 caracteres).");
                mostrarToast("⚠️ Apellido inválido.", "error");
                return;
            } else { limpiarError(inputApellidos); }

            // Validar DUI
            if (!validarDui(dui)) {
                marcarError(inputDui, "DUI inválido. Formato requerido: 00000000-0");
                mostrarToast("⚠️ DUI inválido.", "error");
                return;
            } else { limpiarError(inputDui); }

            // Validar Teléfono (opcional pero si tiene valor debe ser válido)
            if (telefono && !validarTelefono(telefono)) {
                marcarError(inputTelefono, "Teléfono inválido. Formato requerido: 0000-0000");
                mostrarToast("⚠️ Teléfono inválido.", "error");
                return;
            } else { limpiarError(inputTelefono); }

            // Validar Fecha de Nacimiento (opcional)
            if (fechaNacimiento) {
                const rFN = validarFechaNacimiento(fechaNacimiento, 0, 120);
                if (!rFN.valido) {
                    marcarError(inputFechaNacimiento, rFN.mensaje);
                    mostrarToast(`⚠️ ${rFN.mensaje}`, "error");
                    return;
                } else { limpiarError(inputFechaNacimiento); }
            }

            // Verificar DUI duplicado
            const expedientesCheck = await obtenerExpedientes();
            const duiDuplicado = expedientesCheck.find(e => e.dui === dui);
            if (duiDuplicado) {
                marcarError(inputDui, `Ya existe el expediente ${duiDuplicado.codigoExpediente} con este DUI.`);
                mostrarToast(`⚠️ Este DUI ya está registrado (${duiDuplicado.codigoExpediente}).`, "error");
                return;
            }

            const nombreCompleto = `${nombres} ${apellidos}`.trim();

            let edadCalculada = 35;
            let edadEtiquetaCalc = "35 años";
            if (fechaNacimiento && typeof calcularEdadExacta === "function") {
                const rE = calcularEdadExacta(fechaNacimiento);
                edadCalculada = rE.edad;
                edadEtiquetaCalc = rE.etiqueta;
            }

            const nuevoExpediente = {
                codigoExpediente: "", // Se asigna en el backend
                nombres,
                apellidos,
                nombreCompleto,
                dui,
                telefono,
                fechaNacimiento,
                edad: edadCalculada,
                edadEtiqueta: edadEtiquetaCalc,
                estado: "Registrado",
                especialidad: "Medicina General",
                costo: 25.00,
                origen: "Expedientes",
                fechaCreacion: new Date().toISOString()
            };

            try {
                const resp = await fetch("/api/ExpedientesApi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(nuevoExpediente)
                });
                if (resp.ok) {
                    const data = await resp.json();
                    nuevoExpediente.codigoExpediente = data.codigoExpediente;
                }
            } catch (err) {
                console.error(err);
                mostrarToast("Error al guardar en la base de datos.", "error");
                return;
            }

            // Limpiar campos
            formCrearExpediente.reset();

            // Renderizar tabla con el nuevo expediente arriba
            renderTabla();

            // Mostrar modal de confirmación
            if (msgOperacionExitosa) {
                msgOperacionExitosa.innerHTML = `Expediente <strong>${nuevoExpediente.codigoExpediente}</strong> creado exitosamente para <strong>${nombreCompleto}</strong>.`;
            }
            if (modalOperacionExitosa) {
                modalOperacionExitosa.classList.remove("hidden");
            }

            mostrarToast(`Expediente ${nuevoExpediente.codigoExpediente} registrado correctamente.`);
        });
    }

    if (btnAceptarOperacion && modalOperacionExitosa) {
        btnAceptarOperacion.addEventListener("click", () => {
            modalOperacionExitosa.classList.add("hidden");
        });
    }

    // --- MODAL ASIGNAR ESPECIALIDAD Y CITA ---
    function abrirModalAsignarCita(paciente) {
        pacienteSeleccionadoParaCita = paciente;
        if (modalAsignarPaciente) modalAsignarPaciente.textContent = paciente.nombreCompleto || `${paciente.nombres} ${paciente.apellidos}`;
        if (modalAsignarCodigo) modalAsignarCodigo.textContent = paciente.codigoExpediente || paciente.id;

        // Preseleccionar si ya tenía
        if (selectEspecialidad) {
            if (paciente.especialidad) {
                selectEspecialidad.value = paciente.especialidad;
            } else {
                selectEspecialidad.value = "Medicina General";
            }
            actualizarMontoVisual();
        }

        if (modalAsignarCita) {
            modalAsignarCita.classList.remove("hidden");
        }
    }

    function actualizarMontoVisual() {
        if (!selectEspecialidad || !displayMontoConsulta) return;
        const selectedOpt = selectEspecialidad.options[selectEspecialidad.selectedIndex];
        const costo = selectedOpt ? selectedOpt.getAttribute("data-costo") : "25.00";
        displayMontoConsulta.textContent = `$${parseFloat(costo).toFixed(2)}`;
    }

    if (selectEspecialidad) {
        selectEspecialidad.addEventListener("change", actualizarMontoVisual);
    }

    if (btnCancelarAsignacion && modalAsignarCita) {
        btnCancelarAsignacion.addEventListener("click", () => {
            modalAsignarCita.classList.add("hidden");
        });
    }

    if (btnConfirmarAsignacion && modalAsignarCita) {
        btnConfirmarAsignacion.addEventListener("click", async () => {
            if (!pacienteSeleccionadoParaCita) return;

            const esp = selectEspecialidad ? selectEspecialidad.value : "Medicina General";
            const opt = selectEspecialidad ? selectEspecialidad.options[selectEspecialidad.selectedIndex] : null;
            const costo = opt ? parseFloat(opt.getAttribute("data-costo")) : 25.00;

            // Actualizar paciente en la API
            const expTarget = { ...pacienteSeleccionadoParaCita };
            expTarget.estado = "En Espera";
            expTarget.especialidad = esp;
            expTarget.costo = costo;
            if (!expTarget.origen || expTarget.origen !== "Agendar Cita") {
                expTarget.origen = "Expedientes";
            }

            try {
                await fetch(`/api/ExpedientesApi/${expTarget.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(expTarget)
                });
            } catch (err) {
                console.error("Error al actualizar estado a En Espera:", err);
            }

            modalAsignarCita.classList.add("hidden");
            renderTabla(inputBusqueda ? inputBusqueda.value : "");

            mostrarToast(`Cita confirmada para ${pacienteSeleccionadoParaCita.nombreCompleto}. Asignado a cola de espera (${esp}).`);
        });
    }

    // --- MODAL DETALLE DE CITA ASIGNADA ---
    const modalDetalleCita = document.getElementById("modalDetalleCita");
    const detalleCitaPaciente = document.getElementById("detalleCitaPaciente");
    const detalleCitaCodigo = document.getElementById("detalleCitaCodigo");
    const detalleCitaEspecialidad = document.getElementById("detalleCitaEspecialidad");
    const detalleCitaMedico = document.getElementById("detalleCitaMedico");
    const detalleCitaFechaHora = document.getElementById("detalleCitaFechaHora");
    const detalleCitaCosto = document.getElementById("detalleCitaCosto");
    const btnCerrarDetalleCita = document.getElementById("btnCerrarDetalleCita");

    function abrirModalDetalleCita(exp) {
        if (!modalDetalleCita) return;

        const nombre = exp.nombreCompleto || `${exp.nombres} ${exp.apellidos}`;
        if (detalleCitaPaciente) detalleCitaPaciente.textContent = nombre;
        if (detalleCitaCodigo) detalleCitaCodigo.textContent = exp.codigoExpediente || exp.id;
        if (detalleCitaEspecialidad) detalleCitaEspecialidad.textContent = exp.especialidad || "Medicina General";
        if (detalleCitaMedico) detalleCitaMedico.textContent = exp.medico || "Dr. Roberto Gómez";

        const fh = (exp.fechaCita && exp.horaConsulta)
            ? `${exp.fechaCita} – ${exp.horaConsulta}`
            : (exp.fechaHora || "Hoy – Turno en Espera");
        if (detalleCitaFechaHora) detalleCitaFechaHora.textContent = fh;

        const costo = exp.costo ? `$${parseFloat(exp.costo).toFixed(2)}` : "$25.00";
        if (detalleCitaCosto) detalleCitaCosto.textContent = costo;

        modalDetalleCita.classList.remove("hidden");
    }

    if (btnCerrarDetalleCita && modalDetalleCita) {
        btnCerrarDetalleCita.addEventListener("click", () => {
            modalDetalleCita.classList.add("hidden");
        });
    }

    // --- HELPER TOASTS ---
    function mostrarToast(mensaje, tipo = "success") {
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = "toast-item";
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${mensaje}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-fadeout");
            setTimeout(() => toast.remove(), 300);
        }, 3800);
    }

    // --- DETECTAR LLEGÁDA DESDE AGENDAR CITA ---
    // Si el usuario acaba de agendar una cita, mostrar notificación y resaltar el expediente
    try {
        const citaReciente = JSON.parse(localStorage.getItem("citaAgendada") || "null");
        if (citaReciente && citaReciente.paciente) {
            // Buscar el expediente recién creado por nombre para guardarlo en sessionStorage
            obtenerExpedientes().then(expedientes => {
                const expCreado = expedientes.find(e =>
                    (e.nombreCompleto || `${e.nombres} ${e.apellidos}`).trim().toLowerCase() ===
                    citaReciente.paciente.trim().toLowerCase()
                );
                if (expCreado) {
                    sessionStorage.setItem("curavita_ultima_cita", JSON.stringify({ id: expCreado.id }));
                }

                // Mostrar banner informativo
                setTimeout(() => {
                    mostrarToast(
                        `ℹ️ Expediente de <strong>${citaReciente.paciente}</strong> creado desde Agendar Cita y visible en la tabla.`,
                        "info"
                    );
                }, 400);

                // Limpiar clave para que no aparezca en futuras visitas
                localStorage.removeItem("citaAgendada");
            });
        }
    } catch { /* ignorar */ }

    // Inicializar tabla
    renderTabla();

    // Limpiar highlight tras 6 segundos
    setTimeout(() => {
        sessionStorage.removeItem("curavita_ultima_cita");
    }, 6000);
});