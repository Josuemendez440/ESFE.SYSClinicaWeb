// Archivo: wwwroot/js/expedientes.js
document.addEventListener("DOMContentLoaded", () => {
    const formCrearExpediente = document.getElementById("formCrearExpediente");
    const inputNombres = document.getElementById("nombres");
    const inputApellidos = document.getElementById("apellidos");
    const inputDui = document.getElementById("dui");
    const inputTelefono = document.getElementById("telefono");
    const inputFechaNacimiento = document.getElementById("fechaNacimiento");

    const inputBusqueda = document.getElementById("inputBusqueda");
    const tablaPacientes = document.getElementById("tablaPacientes");

    // Modales y Toasts del sistema
    const modalOperacionExitosa = document.getElementById("modalOperacionExitosa");
    const msgOperacionExitosa = document.getElementById("msgOperacionExitosa");
    const btnAceptarOperacion = document.getElementById("btnAceptarOperacion");

    // Formateo automático de DUI y Teléfono
    if (inputDui) {
        inputDui.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length > 9) val = val.substring(0, 9);
            if (val.length > 8) val = val.substring(0, 8) + "-" + val.substring(8);
            e.target.value = val;
        });
    }

    if (inputTelefono) {
        inputTelefono.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length > 8) val = val.substring(0, 8);
            if (val.length > 4) val = val.substring(0, 4) + "-" + val.substring(4);
            e.target.value = val;
        });
    }

    // Obtener pacientes desde SQL Server
    async function obtenerPacientesBD() {
        try {
            const resp = await fetch("/api/ExpedientesApi");
            if (!resp.ok) return [];
            return await resp.json();
        } catch (e) {
            console.error("Error al obtener expedientes:", e);
            return [];
        }
    }

    // Renderizar la tabla con estilos del sistema
    async function renderTabla(filtro = "") {
        if (!tablaPacientes) return;

        const lista = await obtenerPacientesBD();
        const f = filtro.toLowerCase().trim();

        const filtrados = lista.filter(exp => {
            if (!f) return true;
            const nom = (exp.nombreCompleto || `${exp.nombres || ''} ${exp.apellidos || ''}`).toLowerCase();
            const dui = (exp.dui || exp.dui_documento || "").toLowerCase();
            const cod = (exp.codigoExpediente || exp.codigo_expediente || "").toLowerCase();
            return nom.includes(f) || dui.includes(f) || cod.includes(f);
        });

        tablaPacientes.innerHTML = "";

        if (filtrados.length === 0) {
            tablaPacientes.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: #94a3b8; padding: 24px;">
                        No se encontraron expedientes registrados.
                    </td>
                </tr>`;
            return;
        }

        filtrados.forEach(exp => {
            const tr = document.createElement("tr");

            const cod = exp.codigoExpediente || exp.codigo_expediente || "PAC-000";
            const nom = exp.nombreCompleto || `${exp.nombres || ''} ${exp.apellidos || ''}`.trim() || "Sin nombre";
            const dui = exp.dui || exp.dui_documento || "-";
            const estado = exp.estado || "Registrado";

            let badgeClass = "badge-registrado";
            const estLower = estado.toLowerCase();
            if (estLower.includes("factur") || estLower.includes("liquid")) {
                badgeClass = "badge-facturado";
            } else if (estLower.includes("finaliz") || estLower.includes("atendid")) {
                badgeClass = "badge-facturado";
            } else if (estLower.includes("consulta")) {
                badgeClass = "badge-consulta";
            } else if (estLower.includes("espera")) {
                badgeClass = "badge-espera";
            } else {
                badgeClass = "badge-registrado";
            }

            tr.innerHTML = `
                <td><strong>${cod}</strong></td>
                <td>${nom}</td>
                <td>${dui}</td>
                <td><span class="badge-status ${badgeClass}">${estado}</span></td>
                <td class="text-right">
                    <button type="button" class="btn-select-patient" data-id="${exp.id || exp.paciente_id || ''}">
                        <span>Seleccionar</span>
                    </button>
                </td>
            `;

            tablaPacientes.appendChild(tr);
        });
    }

    // Búsqueda en tiempo real
    if (inputBusqueda) {
        inputBusqueda.addEventListener("input", (e) => {
            renderTabla(e.target.value);
        });
    }

    // Submit con Modal o Toast estilizado
    if (formCrearExpediente) {
        formCrearExpediente.addEventListener("submit", async (e) => {
            e.preventDefault();

            const nombres = inputNombres?.value.trim() || "";
            const apellidos = inputApellidos?.value.trim() || "";
            const dui = inputDui?.value.trim() || "";
            const telefono = inputTelefono?.value.trim() || "";
            const fechaNacimiento = inputFechaNacimiento?.value || null;

            if (!nombres || !apellidos) {
                mostrarToast("⚠️ Nombres y Apellidos son obligatorios.", "error");
                return;
            }

            const nuevoPaciente = {
                nombres,
                apellidos,
                dui,
                telefono,
                fechaNacimiento
            };

            try {
                const resp = await fetch("/api/ExpedientesApi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(nuevoPaciente)
                });

                if (resp.ok) {
                    const data = await resp.json();
                    formCrearExpediente.reset();
                    await renderTabla();

                    // 1. Mostrar Modal Flotante si existe en la vista
                    if (modalOperacionExitosa && msgOperacionExitosa) {
                        msgOperacionExitosa.innerHTML = `Expediente <strong>${data.codigoExpediente || ''}</strong> guardado correctamente para <strong>${nombres} ${apellidos}</strong>.`;
                        modalOperacionExitosa.classList.remove("hidden");
                    } else {
                        // 2. Si no hay modal, mostrar Toast con diseño Curavita
                        mostrarToast(`✨ Expediente ${data.codigoExpediente || ''} registrado con éxito.`);
                    }
                } else {
                    mostrarToast("⚠️ No se pudo guardar el expediente en la base de datos.", "error");
                }
            } catch (err) {
                console.error("Error al registrar expediente:", err);
                mostrarToast("⚠️ Error de conexión con el servidor.", "error");
            }
        });
    }

    // Cerrar Modal al dar clic en Aceptar
    if (btnAceptarOperacion && modalOperacionExitosa) {
        btnAceptarOperacion.addEventListener("click", () => {
            modalOperacionExitosa.classList.add("hidden");
        });
    }

    // Notificaciones Toast dinámicas
    function mostrarToast(mensaje, tipo = "success") {
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `toast-item ${tipo === "error" ? "toast-error" : ""}`;
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:8px;">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${mensaje}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-fadeout");
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Cargar la tabla al iniciar
    renderTabla();

    // ── Modal Asignar Especialidad y Médico ──────────────────────────────────
    const modalAsignarCita       = document.getElementById("modalAsignarCita");
    const modalAsignarPaciente   = document.getElementById("modalAsignarPaciente");
    const modalAsignarCodigo     = document.getElementById("modalAsignarCodigo");
    const selectEspecialidad     = document.getElementById("selectEspecialidad");
    const selectMedico           = document.getElementById("selectMedico");
    const displayMontoConsulta   = document.getElementById("displayMontoConsulta");
    const btnCancelarAsignacion  = document.getElementById("btnCancelarAsignacion");
    const btnConfirmarAsignacion = document.getElementById("btnConfirmarAsignacion");

    // Modal Detalle Cita (confirmación visual antes de ir a consulta)
    const modalDetalleCita        = document.getElementById("modalDetalleCita");
    const detalleCitaPaciente     = document.getElementById("detalleCitaPaciente");
    const detalleCitaCodigo       = document.getElementById("detalleCitaCodigo");
    const detalleCitaEspecialidad = document.getElementById("detalleCitaEspecialidad");
    const detalleCitaMedico       = document.getElementById("detalleCitaMedico");
    const detalleCitaFechaHora    = document.getElementById("detalleCitaFechaHora");
    const detalleCitaCosto        = document.getElementById("detalleCitaCosto");
    const btnCerrarDetalleCita    = document.getElementById("btnCerrarDetalleCita");

    // Catálogo de médicos especialistas
    const medicosPorEspecialidad = {
        "Medicina General": [
            { id: 3, nombre: "Dr. Roberto Gómez" },
            { id: 4, nombre: "Dra. Elena Ramos" },
            { id: 5, nombre: "Dr. Roberto Fuentes" }
        ],
        "Pediatría": [
            { id: 6, nombre: "Dra. Ana Martínez" },
            { id: 7, nombre: "Dra. Lucía Méndez" },
            { id: 8, nombre: "Dr. Mario Castillo" }
        ],
        "Cardiología": [
            { id: 1, nombre: "Dr. Carlos Herrera" },
            { id: 2, nombre: "Dra. Sofía Alvarado" }
        ]
    };

    // Actualizar selector de médicos dinámicamente según la especialidad
    function actualizarMedicosDisponibles(especialidad) {
        if (!selectMedico) return;
        selectMedico.innerHTML = "";
        const lista = medicosPorEspecialidad[especialidad] || [
            { id: 1, nombre: "Dr. Roberto Gómez" }
        ];

        lista.forEach((m, idx) => {
            const opt = document.createElement("option");
            opt.value = m.nombre;
            opt.dataset.id = m.id;
            opt.textContent = `${m.nombre} (${especialidad})`;
            if (idx === 0) opt.selected = true;
            selectMedico.appendChild(opt);
        });
    }

    // Paciente actualmente seleccionado en el modal
    let _pacienteParaAsignar = null;

    // Delegación de eventos: clic en botón Seleccionar de cualquier fila
    if (tablaPacientes) {
        tablaPacientes.addEventListener("click", (e) => {
            const btn = e.target.closest(".btn-select-patient");
            if (!btn) return;

            const id  = btn.dataset.id  || "";
            const nom = btn.dataset.nom || btn.closest("tr")?.querySelector("td:nth-child(2)")?.textContent.trim() || "Paciente";
            const cod = btn.dataset.cod || btn.closest("tr")?.querySelector("td:nth-child(1)")?.textContent.trim() || "---";

            _pacienteParaAsignar = { id, nombre: nom, codigoExpediente: cod };

            if (modalAsignarPaciente) modalAsignarPaciente.textContent = nom;
            if (modalAsignarCodigo)   modalAsignarCodigo.textContent   = cod;

            // Resetear selector de especialidad y actualizar médicos y costo
            if (selectEspecialidad) {
                selectEspecialidad.selectedIndex = 0;
                actualizarCostoMostrado();
                actualizarMedicosDisponibles(selectEspecialidad.value);
            }

            if (modalAsignarCita) modalAsignarCita.classList.remove("hidden");
        });
    }

    // Actualizar costo y médicos al cambiar especialidad
    function actualizarCostoMostrado() {
        if (!selectEspecialidad || !displayMontoConsulta) return;
        const opt   = selectEspecialidad.options[selectEspecialidad.selectedIndex];
        const costo = opt ? (opt.dataset.costo || "25.00") : "25.00";
        displayMontoConsulta.textContent = `$${parseFloat(costo).toFixed(2)}`;
    }

    if (selectEspecialidad) {
        selectEspecialidad.addEventListener("change", () => {
            actualizarCostoMostrado();
            actualizarMedicosDisponibles(selectEspecialidad.value);
        });
    }

    // Cancelar asignación
    if (btnCancelarAsignacion && modalAsignarCita) {
        btnCancelarAsignacion.addEventListener("click", () => {
            modalAsignarCita.classList.add("hidden");
            _pacienteParaAsignar = null;
        });
    }

    // Confirmar asignación → Enviar al Backend, mostrar detalle y luego navegar
    if (btnConfirmarAsignacion && modalAsignarCita) {
        btnConfirmarAsignacion.addEventListener("click", async () => {
            if (!_pacienteParaAsignar) return;

            const opt          = selectEspecialidad ? selectEspecialidad.options[selectEspecialidad.selectedIndex] : null;
            const especialidad = opt ? opt.value : "Medicina General";
            const costo        = opt ? (opt.dataset.costo || "25.00") : "25.00";

            // Obtener médico elegido manualmente
            const optMed       = selectMedico ? selectMedico.options[selectMedico.selectedIndex] : null;
            const medicoNombre = optMed ? optMed.value : (selectMedico?.value || "Dr. Roberto Gómez");
            const medicoId     = optMed ? (optMed.dataset.id || null) : null;

            const now        = new Date();
            const horas      = now.getHours();
            const ampm       = horas >= 12 ? "p.m." : "a.m.";
            const horas12    = horas % 12 || 12;
            const minutos    = String(now.getMinutes()).padStart(2, "0");
            const fechaHoraStr = `${now.toLocaleDateString("es-ES")} ${String(horas12).padStart(2, "0")}:${minutos} ${ampm}`;

            // 1. Persistir en Backend (API SQL Server) la asignación del médico y especialidad
            try {
                const payloadAsignacion = {
                    pacienteId: parseInt(_pacienteParaAsignar.id, 10) || 0,
                    codigoExpediente: _pacienteParaAsignar.codigoExpediente,
                    medicoId: medicoId ? parseInt(medicoId, 10) : null,
                    medicoNombre: medicoNombre,
                    especialidad: especialidad,
                    costo: parseFloat(costo)
                };

                await fetch("/api/ExpedientesApi/asignar-cita", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payloadAsignacion)
                });
            } catch (err) {
                console.error("Error al persistir cita asignada en backend:", err);
            }

            // Cerrar modal de asignación
            modalAsignarCita.classList.add("hidden");

            // 2. Mostrar modal de detalle con el médico elegido antes de redirigir
            if (modalDetalleCita) {
                if (detalleCitaPaciente)     detalleCitaPaciente.textContent     = _pacienteParaAsignar.nombre;
                if (detalleCitaCodigo)       detalleCitaCodigo.textContent       = _pacienteParaAsignar.codigoExpediente;
                if (detalleCitaEspecialidad) detalleCitaEspecialidad.textContent = especialidad;
                if (detalleCitaMedico)       detalleCitaMedico.textContent       = medicoNombre;
                if (detalleCitaFechaHora)    detalleCitaFechaHora.textContent    = fechaHoraStr;
                if (detalleCitaCosto)        detalleCitaCosto.textContent        = `$${parseFloat(costo).toFixed(2)}`;
                modalDetalleCita.classList.remove("hidden");
            } else {
                // Si no hay modal de detalle, navegar a Consulta Médica
                window.location.href = "/Account/Consulta";
            }
        });
    }

    // Cerrar modal de detalle y navegar a Consulta Médica limpia
    if (btnCerrarDetalleCita && modalDetalleCita) {
        btnCerrarDetalleCita.addEventListener("click", () => {
            modalDetalleCita.classList.add("hidden");
            window.location.href = "/Account/Consulta";
        });
    }
});