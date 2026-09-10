document.addEventListener("DOMContentLoaded", () => {
    // Datos simulados de pacientes
    const pacientesEnEspera = [
        { id: "EXP-101", nombre: "María Josefina Flores", edad: 45, pa: "120/80", fc: "75", temp: "36.6", peso: "65" },
        { id: "EXP-102", nombre: "Carlos Eduardo Ramos", edad: 58, pa: "135/85", fc: "82", temp: "37.0", peso: "82" },
        { id: "EXP-103", nombre: "Ana Patricia Gómez", edad: 31, pa: "110/70", fc: "68", temp: "36.4", peso: "58" }
    ];

    let pacienteSeleccionado = null;

    // Referencias DOM
    const listaEspera = document.getElementById("listaEspera");
    const emptyWorkspace = document.getElementById("emptyWorkspace");
    const workspacePanel = document.getElementById("workspacePanel");

    // Modal Aceptar
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

    // Campos de Consulta
    const lblNombrePaciente = document.getElementById("lblNombrePaciente");
    const lblExpediente = document.getElementById("lblExpediente");
    const lblEdad = document.getElementById("lblEdad");
    const inputPA = document.getElementById("inputPA");
    const inputFC = document.getElementById("inputFC");
    const inputTemp = document.getElementById("inputTemp");
    const inputPeso = document.getElementById("inputPeso");
    const txtDiagnostico = document.getElementById("txtDiagnostico");

    // Recetas
    const inputMedicamentoNombre = document.getElementById("inputMedicamentoNombre");
    const inputMedicamentoDosis = document.getElementById("inputMedicamentoDosis");
    const btnAddMedicamento = document.getElementById("btnAddMedicamento");
    const tbodyReceta = document.getElementById("tbodyReceta");
    const btnFinalizarConsulta = document.getElementById("btnFinalizarConsulta");

    // Render lista de espera
    function renderListaEspera() {
        if (!listaEspera) return;
        listaEspera.innerHTML = "";

        pacientesEnEspera.forEach((p) => {
            const li = document.createElement("li");
            li.className = "queue-item";
            li.innerHTML = `
                <div class="queue-item-info">
                    <span class="queue-item-name">${p.nombre}</span>
                    <span class="queue-item-code">${p.id}</span>
                </div>
            `;
            li.addEventListener("click", () => solicitarAceptarPaciente(p));
            listaEspera.appendChild(li);
        });
    }

    function solicitarAceptarPaciente(p) {
        pacienteSeleccionado = p;
        if (acceptPatientName) acceptPatientName.textContent = p.nombre;
        if (acceptPatientCode) acceptPatientCode.textContent = p.id;
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

    function cargarPacienteEnWorkspace(p) {
        if (!p) return;
        if (emptyWorkspace) emptyWorkspace.classList.add("hidden");
        if (workspacePanel) workspacePanel.classList.remove("hidden");

        if (lblNombrePaciente) lblNombrePaciente.textContent = p.nombre;
        if (lblExpediente) lblExpediente.textContent = p.id;
        if (lblEdad) lblEdad.textContent = p.edad;

        if (inputPA) inputPA.value = p.pa || "";
        if (inputFC) inputFC.value = p.fc || "";
        if (inputTemp) inputTemp.value = p.temp || "";
        if (inputPeso) inputPeso.value = p.peso || "";
        if (txtDiagnostico) txtDiagnostico.value = "";
        if (tbodyReceta) tbodyReceta.innerHTML = "";
    }

    // Prescripción
    if (btnAddMedicamento && inputMedicamentoNombre && inputMedicamentoDosis && tbodyReceta) {
        btnAddMedicamento.addEventListener("click", () => {
            const nombre = inputMedicamentoNombre.value.trim();
            const dosis = inputMedicamentoDosis.value.trim();

            if (!nombre || !dosis) {
                alert("Por favor ingrese el nombre y la dosis del medicamento.");
                return;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><b>${nombre}</b></td>
                <td>${dosis}</td>
                <td class="text-center-col">
                    <button class="btn-delete-row" type="button">✕</button>
                </td>
            `;

            tr.querySelector(".btn-delete-row").addEventListener("click", () => tr.remove());
            tbodyReceta.appendChild(tr);

            inputMedicamentoNombre.value = "";
            inputMedicamentoDosis.value = "";
            inputMedicamentoNombre.focus();
        });
    }

    if (btnFinalizarConsulta) {
        btnFinalizarConsulta.addEventListener("click", () => {
            alert("Consulta finalizada exitosamente. Imprimiendo receta...");
            if (emptyWorkspace) emptyWorkspace.classList.remove("hidden");
            if (workspacePanel) workspacePanel.classList.add("hidden");
        });
    }

    // Modal Logout
    if (btnOpenLogout && logoutModal) {
        btnOpenLogout.addEventListener("click", () => {
            logoutModal.classList.remove("hidden");
        });
    }

    if (btnCancelLogout && logoutModal) {
        btnCancelLogout.addEventListener("click", () => {
            logoutModal.classList.add("hidden");
        });
    }

    if (logoutModal) {
        logoutModal.addEventListener("click", (e) => {
            if (e.target === logoutModal) logoutModal.classList.add("hidden");
        });
    }

    // Emergency Overlay
    if (btnCloseEmergency && emergencyOverlay) {
        btnCloseEmergency.addEventListener("click", () => {
            emergencyOverlay.classList.add("hidden");
        });
    }

    // Modal Historial
    if (btnOpenHistory && historyModal) {
        btnOpenHistory.addEventListener("click", () => {
            if (!pacienteSeleccionado) return;
            if (historyModalCode) historyModalCode.textContent = `Código: ${pacienteSeleccionado.id}`;
            if (historyModalBody) {
                historyModalBody.innerHTML = `
                    <div class="history-item">
                        <div class="history-item-date">15/01/2026 - Consulta General</div>
                        <div class="history-item-desc">Paciente presentó cuadro gripal leve. Se recetó Paracetamol 500mg y reposo por 3 días.</div>
                    </div>
                    <div class="history-item">
                        <div class="history-item-date">10/11/2025 - Control de Rutina</div>
                        <div class="history-item-desc">Signos vitales estables. Presión arterial dentro del rango normal.</div>
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

    if (historyModal) {
        historyModal.addEventListener("click", (e) => {
            if (e.target === historyModal) historyModal.classList.add("hidden");
        });
    }

    // Inicializar
    renderListaEspera();
});