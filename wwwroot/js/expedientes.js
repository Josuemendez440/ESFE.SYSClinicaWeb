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
            console.error("Error al obtener expediente:", e);
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
            const nom = (exp.nombreCompleto || `${exp.nombres} ${exp.apellidos}`).toLowerCase();
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
            const nom = exp.nombreCompleto || `${exp.nombres} ${exp.apellidos}`;
            const dui = exp.dui || exp.dui_documento || "-";
            const estado = exp.estado || "En Espera";

            tr.innerHTML = `
                <td><strong>${cod}</strong></td>
                <td>${nom}</td>
                <td>${dui}</td>
                <td><span class="badge-status badge-espera">${estado}</span></td>
                <td class="text-right">
                    <button type="button" class="btn-select-patient" data-id="${exp.id || exp.paciente_id}">
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
                mostrarToast("⚠️ Nombres y Apellidos son obligatorios.");
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
                    mostrarToast("⚠️ No se pudo guardar el expediente en la base de datos.");
                }
            } catch (err) {
                console.error(err);
                mostrarToast("⚠️ Error de conexión con el servidor.");
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
    function mostrarToast(mensaje) {
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
});