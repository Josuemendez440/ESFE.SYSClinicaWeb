// Archivo: wwwroot/js/consulta.js
document.addEventListener("DOMContentLoaded", () => {
    const RECETA_NUM_KEY = "curavita_ultimo_rec_num";
    const FINALIZADOS_KEY = "curavita_pacientes_finalizados";

    function obtenerPacientesFinalizados() {
        try {
            return JSON.parse(sessionStorage.getItem(FINALIZADOS_KEY) || "[]");
        } catch {
            return [];
        }
    }

    function registrarPacienteFinalizado(id) {
        if (!id) return;
        const lista = obtenerPacientesFinalizados();
        if (!lista.includes(String(id))) {
            lista.push(String(id));
            sessionStorage.setItem(FINALIZADOS_KEY, JSON.stringify(lista));
        }
    }

    async function obtenerColaEspera() {
        try {
            const resp = await fetch("/api/ExpedientesApi");
            if (!resp.ok) return [];
            const expedientes = await resp.json();

            const finalizados = obtenerPacientesFinalizados();

            // Filtrar expedientes cuyo estado NO sea Facturado/Atendido y que no se hayan finalizado en esta sesión
            const enEspera = expedientes.filter(e => {
                const est = (e.estado || "").toLowerCase();
                const esAtendidoOFacturado = est.includes("factur") || est.includes("atendid");
                return !esAtendidoOFacturado && !finalizados.includes(String(e.id));
            });

            return enEspera.map(e => ({
                id: e.id,
                codigoExpediente: e.codigoExpediente,
                nombre: e.nombreCompleto || `${e.nombres} ${e.apellidos}`,
                especialidad: e.especialidad || "Medicina General",
                medico: e.medico || "Dr(a). Médico Tratante",
                costo: e.costo || 25.00
            }));
        } catch {
            return [];
        }
    }

    function obtenerSiguienteNumeroReceta() {
        let ultimoNum = parseInt(localStorage.getItem(RECETA_NUM_KEY) || "29", 10);
        if (isNaN(ultimoNum) || ultimoNum < 29) ultimoNum = 29;
        const nuevoNum = ultimoNum + 1;
        localStorage.setItem(RECETA_NUM_KEY, nuevoNum.toString());
        return `REC-${String(nuevoNum).padStart(5, "0")}`;
    }

    let pacienteSeleccionado = null;
    let listaMedicamentosPrescritos = [];
    let recetaGeneradaActual = null;

    // Referencias DOM
    const listaEspera = document.getElementById("listaEspera");
    const emptyWorkspace = document.getElementById("emptyWorkspace");
    const workspacePanel = document.getElementById("workspacePanel");

    // Modal Aceptar Paciente
    const acceptPatientModal = document.getElementById("acceptPatientModal");
    const acceptPatientName = document.getElementById("acceptPatientName");
    const acceptPatientCode = document.getElementById("acceptPatientCode");
    const btnCancelAccept = document.getElementById("btnCancelAccept");
    const btnConfirmAccept = document.getElementById("btnConfirmAccept");

    // Modal Logout
    const logoutModal = document.getElementById("logoutModal");
    const btnOpenLogout = document.getElementById("btnOpenLogout");
    const btnCancelLogout = document.getElementById("btnCancelLogout");

    // Modal Emergency
    const emergencyOverlay = document.getElementById("emergencyOverlay");
    const btnCloseEmergency = document.getElementById("btnCloseEmergency");

    // Modal History
    const historyModal = document.getElementById("historyModal");
    const btnOpenHistory = document.getElementById("btnOpenHistory");
    const btnCloseHistory = document.getElementById("btnCloseHistory");
    const historyModalCode = document.getElementById("historyModalCode");
    const historyModalBody = document.getElementById("historyModalBody");

    // Modal Receta Física
    const modalRecetaFisica = document.getElementById("modalRecetaFisica");
    const recetaFecha = document.getElementById("recetaFecha");
    const recetaPaciente = document.getElementById("recetaPaciente");
    const recetaExpediente = document.getElementById("recetaExpediente");
    const recetaEspecialidad = document.getElementById("recetaEspecialidad");
    const recetaDiagTexto = document.getElementById("recetaDiagTexto");
    const btnCerrarReceta = document.getElementById("btnCerrarReceta");
    const btnPrintReceta = document.getElementById("btnPrintReceta");

    // Campos de Consulta
    const lblNombrePaciente = document.getElementById("lblNombrePaciente");
    const lblExpediente = document.getElementById("lblExpediente");
    const lblEdad = document.getElementById("lblEdad");
    const inputPA = document.getElementById("inputPA");
    const inputFC = document.getElementById("inputFC");
    const inputTemp = document.getElementById("inputTemp");
    const inputPeso = document.getElementById("inputPeso");
    const txtDiagnostico = document.getElementById("txtDiagnostico");

    // Prescripción
    const inputMedicamentoNombre = document.getElementById("inputMedicamentoNombre");
    const inputMedicamentoDosis = document.getElementById("inputMedicamentoDosis");
    const btnAddMedicamento = document.getElementById("btnAddMedicamento");
    const tbodyReceta = document.getElementById("tbodyReceta");
    const btnFinalizarConsulta = document.getElementById("btnFinalizarConsulta");

    async function renderListaEspera() {
        if (!listaEspera) return;
        const cola = await obtenerColaEspera();
        listaEspera.innerHTML = "";

        if (cola.length === 0) {
            const li = document.createElement("li");
            li.style.padding = "20px";
            li.style.color = "#94a3b8";
            li.style.textAlign = "center";
            li.style.fontSize = "13px";
            li.textContent = "No hay pacientes en espera.";
            listaEspera.appendChild(li);
            return;
        }

        cola.forEach((p) => {
            const li = document.createElement("li");
            li.className = "queue-item";
            li.innerHTML = `
                <div class="queue-item-info">
                    <span class="queue-item-name">${p.nombre}</span>
                    <span class="queue-item-code">${p.codigoExpediente || p.id}</span>
                    <span class="queue-item-badge">${p.especialidad || "Medicina General"}</span>
                </div>
            `;
            li.addEventListener("click", () => solicitarAceptarPaciente(p));
            listaEspera.appendChild(li);
        });
    }

    function solicitarAceptarPaciente(p) {
        pacienteSeleccionado = p;
        if (acceptPatientName) acceptPatientName.textContent = p.nombre;
        if (acceptPatientCode) acceptPatientCode.textContent = p.codigoExpediente || p.id;
        if (acceptPatientModal) acceptPatientModal.classList.remove("hidden");
    }

    if (btnCancelAccept && acceptPatientModal) {
        btnCancelAccept.addEventListener("click", () => {
            acceptPatientModal.classList.add("hidden");
        });
    }

    if (btnConfirmAccept && acceptPatientModal) {
        btnConfirmAccept.addEventListener("click", () => {
            acceptPatientModal.classList.add("hidden");
            cargarPacienteEnWorkspace(pacienteSeleccionado);
        });
    }

    function calcularEdad(fechaNacStr) {
        if (typeof calcularEdadExacta === "function" && fechaNacStr) {
            const res = calcularEdadExacta(fechaNacStr);
            return res.valido ? res.etiqueta : "35 años";
        }
        if (!fechaNacStr) return "35 años";
        const partes = fechaNacStr.split("-");
        if (partes.length < 3) return "35 años";
        const anio = parseInt(partes[0], 10);
        const hoy = new Date();
        let edad = hoy.getFullYear() - anio;
        if (isNaN(edad) || edad < 0) edad = 0;
        return edad === 1 ? "1 año" : `${edad} años`;
    }

    function cargarPacienteEnWorkspace(p) {
        if (!p) return;
        if (emptyWorkspace) emptyWorkspace.classList.add("hidden");
        if (workspacePanel) workspacePanel.classList.remove("hidden");

        if (lblNombrePaciente) lblNombrePaciente.textContent = p.nombre;
        if (lblExpediente) lblExpediente.textContent = p.codigoExpediente || p.id;

        let edadFinal = "35 años";
        if (p.edadEtiqueta) {
            edadFinal = p.edadEtiqueta;
        } else if (p.fechaNacimiento) {
            edadFinal = calcularEdad(p.fechaNacimiento);
        } else if (p.edad !== undefined && p.edad !== null) {
            const num = parseInt(p.edad, 10);
            if (!isNaN(num) && num >= 0) {
                edadFinal = num === 1 ? "1 año" : `${num} años`;
            }
        }
        if (lblEdad) lblEdad.textContent = edadFinal;

        [inputPA, inputFC, inputTemp, inputPeso, txtDiagnostico, inputMedicamentoNombre, inputMedicamentoDosis].forEach(inp => {
            if (typeof limpiarError === "function") limpiarError(inp);
        });

        if (inputPA) inputPA.value = "";
        if (inputFC) inputFC.value = "";
        if (inputTemp) inputTemp.value = "";
        if (inputPeso) inputPeso.value = "";
        if (txtDiagnostico) txtDiagnostico.value = "";

        listaMedicamentosPrescritos = [];
        renderRecetaTable();

        mostrarToast(`Expediente ${p.codigoExpediente || p.id} cargado en consulta clínica.`);
    }

    function renderRecetaTable() {
        if (!tbodyReceta) return;
        tbodyReceta.innerHTML = "";

        listaMedicamentosPrescritos.forEach((med, index) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><b>${med.nombre}</b></td>
                <td>${med.dosis}</td>
                <td class="text-center-col">
                    <button class="btn-delete-row" type="button" data-index="${index}">✕</button>
                </td>
            `;

            tr.querySelector(".btn-delete-row").addEventListener("click", () => {
                listaMedicamentosPrescritos.splice(index, 1);
                renderRecetaTable();
            });

            tbodyReceta.appendChild(tr);
        });
    }

    if (btnAddMedicamento && inputMedicamentoNombre && inputMedicamentoDosis) {
        btnAddMedicamento.addEventListener("click", () => {
            if (typeof limpiarError === "function") {
                limpiarError(inputMedicamentoNombre);
                limpiarError(inputMedicamentoDosis);
            }

            const nombre = inputMedicamentoNombre.value.trim();
            const dosis = inputMedicamentoDosis.value.trim();

            let medError = false;
            if (!nombre || nombre.length < 2) {
                if (typeof marcarError === "function") {
                    marcarError(inputMedicamentoNombre, "Ingrese el nombre del fármaco (mín. 2 letras).");
                }
                medError = true;
            }
            if (!dosis || dosis.length < 2) {
                if (typeof marcarError === "function") {
                    marcarError(inputMedicamentoDosis, "Ingrese la posología (ej: 1 tableta c/8h por 5 días).");
                }
                medError = true;
            }

            if (medError) {
                mostrarToast("Por favor complete el nombre y la dosis del fármaco.", "error");
                return;
            }

            listaMedicamentosPrescritos.push({ nombre, dosis });
            renderRecetaTable();

            inputMedicamentoNombre.value = "";
            inputMedicamentoDosis.value = "";
            inputMedicamentoNombre.focus();
        });
    }

    if (btnFinalizarConsulta) {
        btnFinalizarConsulta.addEventListener("click", async () => {
            if (!pacienteSeleccionado) return;

            [inputPA, inputFC, inputTemp, inputPeso, txtDiagnostico].forEach(inp => {
                if (typeof limpiarError === "function") limpiarError(inp);
            });

            const paValCheck = inputPA ? inputPA.value.trim() : "";
            const fcValCheck = inputFC ? inputFC.value.trim() : "";
            const tempValCheck = inputTemp ? inputTemp.value.trim() : "";
            const pesoValCheck = inputPeso ? inputPeso.value.trim() : "";
            const diagCheck = txtDiagnostico ? txtDiagnostico.value.trim() : "";

            let primerCampoConError = null;

            if (typeof validarPresionArterial === "function") {
                const resPA = validarPresionArterial(paValCheck);
                if (!resPA.valido) {
                    marcarError(inputPA, resPA.mensaje);
                    if (!primerCampoConError) primerCampoConError = inputPA;
                }
            } else if (!paValCheck) {
                marcarError(inputPA, "La Presión Arterial es requerida (ej: 120/80).");
                if (!primerCampoConError) primerCampoConError = inputPA;
            }

            if (typeof validarFrecuenciaCardiaca === "function") {
                const resFC = validarFrecuenciaCardiaca(fcValCheck);
                if (!resFC.valido) {
                    marcarError(inputFC, resFC.mensaje);
                    if (!primerCampoConError) primerCampoConError = inputFC;
                }
            } else if (!fcValCheck) {
                marcarError(inputFC, "La Frecuencia Cardíaca es requerida.");
                if (!primerCampoConError) primerCampoConError = inputFC;
            }

            if (typeof validarTemperatura === "function") {
                const resTemp = validarTemperatura(tempValCheck);
                if (!resTemp.valido) {
                    marcarError(inputTemp, resTemp.mensaje);
                    if (!primerCampoConError) primerCampoConError = inputTemp;
                }
            } else if (!tempValCheck) {
                marcarError(inputTemp, "La Temperatura es requerida.");
                if (!primerCampoConError) primerCampoConError = inputTemp;
            }

            if (typeof validarPeso === "function") {
                const resPeso = validarPeso(pesoValCheck);
                if (!resPeso.valido) {
                    marcarError(inputPeso, resPeso.mensaje);
                    if (!primerCampoConError) primerCampoConError = inputPeso;
                }
            } else if (!pesoValCheck) {
                marcarError(inputPeso, "El Peso es requerido.");
                if (!primerCampoConError) primerCampoConError = inputPeso;
            }

            if (typeof validarDiagnostico === "function") {
                const resDiag = validarDiagnostico(diagCheck);
                if (!resDiag.valido) {
                    marcarError(txtDiagnostico, resDiag.mensaje);
                    if (!primerCampoConError) primerCampoConError = txtDiagnostico;
                }
            } else if (!diagCheck) {
                marcarError(txtDiagnostico, "El Diagnóstico Clínico es requerido.");
                if (!primerCampoConError) primerCampoConError = txtDiagnostico;
            }

            if (primerCampoConError) {
                mostrarToast("⚠️ Por favor corrija los campos clínicos resaltados en rojo.", "error");
                primerCampoConError.focus();
                return;
            }

            if (listaMedicamentosPrescritos.length === 0) {
                if (typeof marcarError === "function") {
                    marcarError(inputMedicamentoNombre, "Debe prescribir al menos un medicamento.");
                }
                mostrarToast("⚠️ Debes agregar al menos un medicamento a la prescripción.", "error");
                if (inputMedicamentoNombre) inputMedicamentoNombre.focus();
                return;
            }

            const diag = diagCheck;

            // 1. Marcar como finalizado en la sesión local
            registrarPacienteFinalizado(pacienteSeleccionado.id);

            // 2. Notificar al backend de SQL Server
            try {
                await fetch(`/Account/FinalizarConsulta/${pacienteSeleccionado.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" }
                });
            } catch (err) {
                Console.error("Error al actualizar estado en BD:", err);
            }

            const numeroReceta = obtenerSiguienteNumeroReceta();
            const now = new Date();
            const horas = now.getHours();
            const ampm = horas >= 12 ? "p.m." : "a.m.";
            const horas12 = horas % 12 || 12;
            const minutos = String(now.getMinutes()).padStart(2, "0");
            const fechaHoraStr = `${now.toLocaleDateString("es-ES")} ${String(horas12).padStart(2, "0")}:${minutos} ${ampm}`;

            const paValor = inputPA ? inputPA.value.trim() : "";
            const fcValor = inputFC ? inputFC.value.trim() : "";
            const tempValor = inputTemp ? inputTemp.value.trim() : "";
            const pesoValor = inputPeso ? inputPeso.value.trim() : "";

            recetaGeneradaActual = {
                numeroReceta: numeroReceta,
                fechaHora: fechaHoraStr,
                paciente: pacienteSeleccionado.nombre,
                codigo: pacienteSeleccionado.codigoExpediente || pacienteSeleccionado.id,
                especialidad: pacienteSeleccionado.especialidad || "Medicina General",
                medico: pacienteSeleccionado.medico || "Dr(a). Médico Tratante",
                pa: paValor || "120/70",
                fc: fcValor || "80",
                temp: tempValor || "36.5",
                peso: pesoValor || "70",
                diagnostico: diag || "Sin observaciones adicionales.",
                medicamentos: [...listaMedicamentosPrescritos]
            };

            const recetaCodigoDoc = document.getElementById("recetaCodigoDoc");
            if (recetaCodigoDoc) recetaCodigoDoc.textContent = numeroReceta;
            if (recetaFecha) recetaFecha.textContent = `Fecha: ${fechaHoraStr}`;
            if (recetaPaciente) recetaPaciente.textContent = pacienteSeleccionado.nombre;
            if (recetaExpediente) recetaExpediente.textContent = pacienteSeleccionado.codigoExpediente || pacienteSeleccionado.id;
            if (recetaEspecialidad) recetaEspecialidad.textContent = pacienteSeleccionado.especialidad || "Medicina General";

            const recetaPA = document.getElementById("recetaPA");
            const recetaFC = document.getElementById("recetaFC");
            const recetaTemp = document.getElementById("recetaTemp");
            const recetaPeso = document.getElementById("recetaPeso");
            if (recetaPA) recetaPA.textContent = paValor || "--/--";
            if (recetaFC) recetaFC.textContent = fcValor || "--";
            if (recetaTemp) recetaTemp.textContent = tempValor || "--";
            if (recetaPeso) recetaPeso.textContent = pesoValor || "--";

            if (recetaDiagTexto) recetaDiagTexto.textContent = diag || "Sin observaciones adicionales.";

            const recetaTbodyMedicamentos = document.getElementById("recetaTbodyMedicamentos");
            if (recetaTbodyMedicamentos) {
                recetaTbodyMedicamentos.innerHTML = "";
                if (listaMedicamentosPrescritos.length === 0) {
                    recetaTbodyMedicamentos.innerHTML = "<tr><td colspan='3' style='text-align: center; color: #64748b; padding: 12px;'>No se prescribieron medicamentos en esta consulta.</td></tr>";
                } else {
                    listaMedicamentosPrescritos.forEach((m, idx) => {
                        const tr = document.createElement("tr");
                        tr.style.borderBottom = "1px solid #f1f5f9";
                        tr.innerHTML = `
                            <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #0f766e;">${idx + 1}</td>
                            <td style="padding: 8px 10px; font-weight: 700; color: #1e293b;">${m.nombre}</td>
                            <td style="padding: 8px 10px; color: #475569;">${m.dosis}</td>
                        `;
                        recetaTbodyMedicamentos.appendChild(tr);
                    });
                }
            }

            const recetaMedicoFirma = document.getElementById("recetaMedicoFirma");
            if (recetaMedicoFirma) recetaMedicoFirma.textContent = pacienteSeleccionado.medico || "Dr. Roberto Gómez";

            if (modalRecetaFisica) {
                modalRecetaFisica.classList.remove("hidden");
            }

            mostrarToast("Consulta médica finalizada con éxito. Expediente enviado al Módulo de Pago y Facturación.");

            await renderListaEspera();
        });
    }

    if (btnCerrarReceta && modalRecetaFisica) {
        btnCerrarReceta.addEventListener("click", () => {
            modalRecetaFisica.classList.add("hidden");
            if (emptyWorkspace) emptyWorkspace.classList.remove("hidden");
            if (workspacePanel) workspacePanel.classList.add("hidden");

            const idPacienteFinalizado = pacienteSeleccionado ? pacienteSeleccionado.id : '';
            pacienteSeleccionado = null;

            if (idPacienteFinalizado) {
                window.location.href = `/Account/Facturacion?id=${idPacienteFinalizado}`;
            } else {
                window.location.href = `/Account/Facturacion`;
            }
        });
    }

    if (btnPrintReceta) {
        btnPrintReceta.addEventListener("click", () => {
            if (!recetaGeneradaActual) {
                window.print();
                return;
            }

            const printWindow = window.open("", "_blank", "width=780,height=900");
            if (!printWindow) {
                window.print();
                return;
            }

            const rowsMeds = recetaGeneradaActual.medicamentos.length > 0
                ? recetaGeneradaActual.medicamentos.map((m, i) => `
                    <tr>
                        <td style="text-align:center;font-weight:700;color:#1e7a8e;">${i + 1}</td>
                        <td style="font-weight:700;color:#1e7a8e;">${m.nombre}</td>
                        <td style="color:#64748b;">${m.dosis}</td>
                    </tr>`).join("")
                : `<tr><td colspan="3" style="text-align:center;padding:16px;color:#94a3b8;font-style:italic;">No se prescribieron medicamentos en esta consulta.</td></tr>`;

            const vitalesHtml = [
                recetaGeneradaActual.pa ? `P.A: <strong>${recetaGeneradaActual.pa}</strong>` : null,
                recetaGeneradaActual.fc ? `F.C: <strong>${recetaGeneradaActual.fc} lpm</strong>` : null,
                recetaGeneradaActual.temp ? `Temp: <strong>${recetaGeneradaActual.temp} °C</strong>` : null,
                recetaGeneradaActual.peso ? `Peso: <strong>${recetaGeneradaActual.peso} kg</strong>` : null
            ].filter(Boolean).join(" &nbsp;&bull;&nbsp; ");

            const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Receta Médica — ${recetaGeneradaActual.numeroReceta}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#f8fafc; color:#334155; padding:36px 24px; font-size:13px; }
  .sheet { max-width:700px; margin:0 auto; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px;
           padding:34px 36px; box-shadow:none; }
  .brand-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
  .brand-info { display:flex; gap:12px; align-items:center; }
  .brand-name { font-size:21px; font-weight:800; color:#1a6f83; letter-spacing:-0.3px; }
  .brand-sub  { font-size:10px; font-weight:700; color:#1e7a8e; letter-spacing:0.5px; margin-top:2px; text-transform: uppercase; }
  .brand-addr { font-size:11px; color:#64748b; margin-top:1px; }
  .doc-badge  { border:1px solid #1e7a8e; border-radius:8px; padding:10px 16px; text-align:center;
                background:#f6fbfa; min-width:190px; flex-shrink:0; }
  .doc-badge-label { font-size:10px; font-weight:800; color:#1e7a8e; letter-spacing:0.5px; text-transform:uppercase; }
  .doc-badge-num   { font-size:18px; font-weight:800; color:#1a6f83; margin:3px 0; }
  .doc-badge-date  { font-size:11px; color:#64748b; }
  .divider { height:3px; background:#a2c6ce; border-radius:2px; margin:0 0 16px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; 
               background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; }
  .label { font-size:10px; font-weight:700; color:#64748b; margin-bottom:3px; text-transform: uppercase; }
  .value-lg { font-size:14px; font-weight:700; color:#334155; }
  .value-md { font-size:13px; font-weight:700; color:#334155; }
  .vitals-bar { background:#f6fbfa; border-left:4px solid #1e7a8e; border-radius:4px;
                padding:12px 16px; font-size:13px; font-weight:600; color:#1a6f83; margin-bottom:20px; }
  .vitals-bar strong { color: #1e7a8e; }
  .section-title { font-size:11px; font-weight:800; color:#1e7a8e; letter-spacing:0.5px;
                   text-transform:uppercase; margin-bottom:8px; }
  .diag-box { border:1px solid #e2e8f0; border-radius:4px; padding:14px; background:#ffffff;
              min-height:48px; font-size:13px; color:#334155; line-height:1.5; margin-bottom:24px; }
  .med-table { width:100%; border-collapse:collapse; border:1px solid #e2e8f0;
               border-radius:4px; overflow:hidden; font-size:13px; margin-bottom:24px; }
  .med-table thead tr { background:#1e7a8e; color:#ffffff; text-align:left; }
  .med-table th { padding:12px 14px; font-size: 11px; text-transform: uppercase; font-weight: 700; }
  .med-table th:first-child { width:50px; text-align:center; }
  .med-table td { padding: 14px; border-bottom: 1px solid #f1f5f9; }
  .footer-row { display:flex; justify-content:space-between; align-items:flex-end;
                padding-top:20px; border-top:1px dashed #cbd5e1; gap:20px; margin-top: 20px; }
  .notes-list { list-style:none; font-size:11px; color:#64748b; line-height:1.8; }
  .sign-block { text-align:center; min-width:220px; }
  .sign-line  { border-bottom:1px dashed #94a3b8; width:100%; margin:0 auto 8px; }
  .sign-name  { font-size:13px; font-weight:800; color:#1e7a8e; }
  .sign-sub   { font-size:11px; color:#64748b; margin-top: 2px; }
  .doc-footer { display:flex; justify-content:space-between; font-size:10px; color:#94a3b8;
                margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0; }
  @media print {
    body { padding:0; background:#fff; }
    .sheet { border:none; box-shadow:none; padding:10px; border-radius:0; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="brand-row">
    <div class="brand-info">
      <img src="/images/logo.png" style="width:55px;height:auto;object-fit:contain;" />
      <div>
        <div class="brand-name">CLÍNICA CURAVITA</div>
        <div class="brand-sub">ATENCIÓN MÉDICA INTEGRAL Y ESPECIALIZADA</div>
        <div class="brand-addr">ESFE SYSCURAVITA &bull; PBX: (503) 2200-0000 &bull; San Salvador, El Salvador</div>
      </div>
    </div>
    <div class="doc-badge">
      <div class="doc-badge-label">Receta Médica</div>
      <div class="doc-badge-num">${recetaGeneradaActual.numeroReceta}</div>
      <div class="doc-badge-date">Fecha: ${recetaGeneradaActual.fechaHora}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-grid">
    <div>
      <div class="label">Paciente</div>
      <div class="value-lg">${recetaGeneradaActual.paciente}</div>
      <div class="label" style="margin-top:12px;">Especialidad / Motivo</div>
      <div class="value-md">${recetaGeneradaActual.especialidad}</div>
    </div>
    <div>
      <div class="label">N° de Expediente</div>
      <div class="value-lg">${recetaGeneradaActual.codigo}</div>
      <div class="label" style="margin-top:12px;">Modalidad de Atención</div>
      <div class="value-md">Consulta Externa</div>
    </div>
  </div>

  ${vitalesHtml ? `<div class="vitals-bar">${vitalesHtml}</div>` : ""}

  <div class="section-title">Diagnóstico Clínico</div>
  <div class="diag-box">${recetaGeneradaActual.diagnostico || "Sin observaciones adicionales."}</div>

  <div class="section-title">Prescripción Farmacológica</div>
  <table class="med-table">
    <thead>
      <tr>
        <th style="text-align:center;">#</th>
        <th>Medicamento y Presentación</th>
        <th>Posología / Indicaciones de Uso</th>
      </tr>
    </thead>
    <tbody>${rowsMeds}</tbody>
  </table>

  <div class="footer-row">
    <ul class="notes-list">
      <li>&bull; Siga strictly la dosis y horarios prescritos.</li>
      <li>&bull; No suspenda el tratamiento sin previa indicación médica.</li>
      <li>&bull; En caso de reacciones adversas consulte a emergencias.</li>
    </ul>
    <div class="sign-block">
      <div class="sign-line"></div>
      <div class="sign-name">${recetaGeneradaActual.medico}</div>
      <div class="sign-sub">Firma y Sello Profesional</div>
    </div>
  </div>

  <div class="doc-footer">
    <span>ESFE SYSCURAVITA — Sistema Integral de Gestión Hospitalaria</span>
    <span>Documento Médico Oficial &bull; Válido por 30 días</span>
  </div>
</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

            printWindow.document.write(html);
            printWindow.document.close();
        });
    }

    if (btnOpenHistory && historyModal) {
        btnOpenHistory.addEventListener("click", () => {
            if (!pacienteSeleccionado) return;
            if (historyModalCode) historyModalCode.textContent = `Código: ${pacienteSeleccionado.codigoExpediente || pacienteSeleccionado.id}`;
            if (historyModalBody) {
                historyModalBody.innerHTML = `
                    <div class="history-item">
                        <div class="history-item-date">15/01/2026 - Consulta General</div>
                        <div class="history-item-desc">Paciente presentó cuadro gripal leve. Se recetó Paracetamol 500mg y reposo por 3 días.</div>
                    </div>
                    <div class="history-item">
                        <div class="history-item-date">10/11/2025 - Control de Rutina</div>
                        <div class="history-item-desc">Signos vitales estables. Presión arterial dentro del rango normal. Sin complicaciones.</div>
                    </div>
                `;
            }
            historyModal.classList.remove("hidden");
        });
    }

    if (btnCloseHistory && historyModal) {
        btnCloseHistory.addEventListener("click", () => {
            historyModal.classList.add("hidden");
        });
    }

    if (btnOpenLogout && logoutModal) {
        btnOpenLogout.addEventListener("click", () => logoutModal.classList.remove("hidden"));
    }
    if (btnCancelLogout && logoutModal) {
        btnCancelLogout.addEventListener("click", () => logoutModal.classList.add("hidden"));
    }

    if (btnCloseEmergency && emergencyOverlay) {
        btnCloseEmergency.addEventListener("click", () => emergencyOverlay.classList.add("hidden"));
    }

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
        }, 4000);
    }

    [inputPA, inputFC, inputTemp, inputPeso, txtDiagnostico, inputMedicamentoNombre, inputMedicamentoDosis].forEach(inp => {
        if (inp && typeof enlazarLimpiezaEnInput === "function") {
            enlazarLimpiezaEnInput(inp);
        }
    });

    renderListaEspera();
});