// Archivo: wwwroot/js/facturacion.js
document.addEventListener("DOMContentLoaded", () => {
    const ULTIMO_FAC_KEY = "curavita_ultimo_fac_num";
    const fechaHoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

    function obtenerPacientesPendientesLocal() {
        try {
            return JSON.parse(localStorage.getItem("curavita_facturas_pendientes") || "[]");
        } catch {
            return [];
        }
    }

    function removerPacienteFacturadoLocal(id) {
        try {
            let lista = JSON.parse(localStorage.getItem("curavita_facturas_pendientes") || "[]");
            lista = lista.filter(x => String(x) !== String(id));
            localStorage.setItem("curavita_facturas_pendientes", JSON.stringify(lista));
        } catch { }
    }

    async function obtenerFacturasPendientes() {
        try {
            const resp = await fetch("/api/ExpedientesApi");
            if (!resp.ok) return [];
            const expedientes = await resp.json();

            const pendientesLocal = obtenerPacientesPendientesLocal();

            // Muestra solo los pacientes con consulta médica finalizada o que fueron enviados desde Consulta
            const facturados = expedientes.filter(e => {
                const est = (e.estado || "").toLowerCase();
                const esFacturadoBD = est === "facturado" || est.includes("factur") || est.includes("finaliz");
                const esFacturadoLocal = pendientesLocal.includes(String(e.id));
                const noEstaPagado = est !== "pagado" && !e.liquidado;
                return (esFacturadoBD || esFacturadoLocal) && noEstaPagado;
            });

            return facturados.map(e => {
                const costoTotal = parseFloat(e.costoTotal || e.costo) || 25.00;
                let anticipoPagado = parseFloat(e.anticipoPagado) || 0;
                let pagoAnticipo = Boolean(e.pagoAnticipo) || (e.origen === "Agendar Cita") || anticipoPagado > 0;
                if (pagoAnticipo && anticipoPagado <= 0) {
                    anticipoPagado = parseFloat((costoTotal * 0.25).toFixed(2));
                }
                const saldoPendiente = (e.saldoPendiente !== undefined && e.saldoPendiente !== null)
                    ? parseFloat(e.saldoPendiente)
                    : parseFloat(Math.max(0, costoTotal - anticipoPagado).toFixed(2));

                return {
                    id: e.id,
                    codigoExpediente: e.codigoExpediente || `PAC-${String(e.id).padStart(4, '0')}`,
                    paciente: e.nombreCompleto || `${e.nombres || ''} ${e.apellidos || ''}`.trim() || "Paciente Curavita",
                    especialidad: e.especialidad || "Medicina General",
                    monto: saldoPendiente,
                    costoTotal: costoTotal,
                    anticipoPagado: anticipoPagado,
                    pagoAnticipo: pagoAnticipo,
                    origen: e.origen
                };
            });
        } catch {
            return [];
        }
    }

    function obtenerSiguienteNumeroFactura() {
        let num = parseInt(localStorage.getItem(ULTIMO_FAC_KEY) || "31", 10);
        if (isNaN(num)) num = 31;
        return `FAC-${String(num).padStart(5, "0")}`;
    }

    function incrementarNumeroFactura() {
        let num = parseInt(localStorage.getItem(ULTIMO_FAC_KEY) || "31", 10);
        if (isNaN(num)) num = 31;
        localStorage.setItem(ULTIMO_FAC_KEY, String(num + 1));
    }

    // Elementos DOM
    const listaFacturasEl = document.getElementById("listaFacturasPendientes");
    const panelDetalleVacio = document.getElementById("panelDetalleVacio");
    const formPago = document.getElementById("formPago");

    const lblNumeroFactura = document.getElementById("lblNumeroFactura");
    const lblFechaFactura = document.getElementById("lblFechaFactura");
    const lblPacienteFactura = document.getElementById("lblPacienteFactura");
    const lblCodigoFactura = document.getElementById("lblCodigoFactura");
    const lblEspecialidadFactura = document.getElementById("lblEspecialidadFactura");
    const montoPagarEl = document.getElementById("montoPagar");

    const metodoPagoSelect = document.getElementById("metodoPago");
    const grupoEfectivo = document.getElementById("grupoEfectivo");
    const grupoCambio = document.getElementById("grupoCambio");
    const montoRecibidoInput = document.getElementById("montoRecibido");
    const montoCambioEl = document.getElementById("montoCambio");
    const btnProcesarPago = document.getElementById("btnProcesarPago");

    // Modal Factura Finalizada
    const modalFacturaFinalizada = document.getElementById("modalFacturaFinalizada");
    const modalFacturaNum = document.getElementById("modalFacturaNum");
    const modalFacturaPac = document.getElementById("modalFacturaPac");
    const modalFacturaEsp = document.getElementById("modalFacturaEsp");
    const modalFacturaMetodo = document.getElementById("modalFacturaMetodo");
    const modalFacturaTotal = document.getElementById("modalFacturaTotal");
    const inputCorreoFactura = document.getElementById("inputCorreoFactura");
    const btnEnviarCorreoFactura = document.getElementById("btnEnviarCorreoFactura");
    const btnPrintFactura = document.getElementById("btnPrintFactura");
    const btnSiguienteFactura = document.getElementById("btnSiguienteFactura");

    // Modal Logout
    const btnOpenLogout = document.getElementById("btnOpenLogout");
    const btnCancelLogout = document.getElementById("btnCancelLogout");
    const logoutModal = document.getElementById("logoutModal");

    let facturaSeleccionada = null;
    let facturaPagadaActual = null;

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
        if (tipo === "error") {
            toast.style.borderLeftColor = "#ef4444";
        }
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="${tipo === 'error' ? '#ef4444' : '#0d9488'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                ${tipo === 'error'
                ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
                : '<polyline points="20 6 9 17 4 12"></polyline>'}
            </svg>
            <span>${mensaje}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-fadeout");
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    async function renderListaFacturas() {
        let facturas = await obtenerFacturasPendientes();
        if (!listaFacturasEl) return;

        // Verificar parámetro URL id
        const urlParams = new URLSearchParams(window.location.search);
        const paramId = urlParams.get("id");

        if (paramId) {
            const encontrada = facturas.find(f => String(f.id) === String(paramId));
            // Si no se encuentra en la BD, simplemente no se agrega un registro falso
            if (encontrada) {
                // Asegurarse que aparezca seleccionada al inicio
                facturas = [encontrada, ...facturas.filter(f => String(f.id) !== String(paramId))];
            }
        }


        listaFacturasEl.innerHTML = "";

        if (facturas.length === 0) {
            listaFacturasEl.innerHTML = `
                <div class="empty-state" style="padding: 24px 10px;">
                    <p>No hay facturas pendientes de cobro en este momento.</p>
                </div>
            `;
            return;
        }

        facturas.forEach((factura) => {
            const item = document.createElement("div");
            const esActivo = facturaSeleccionada && String(facturaSeleccionada.id) === String(factura.id);
            item.className = `factura-item ${esActivo ? "active" : ""}`;

            // Usar los valores del API (costoTotal ya calculado correctamente desde el anticipo pagado)
            const costoBase = Number(factura.costoTotal) || 25.00;
            const anticipoPagado = factura.pagoAnticipo ? Number(factura.anticipoPagado || (costoBase * 0.25).toFixed(2)) : 0;
            const saldoPendiente = Number((costoBase - anticipoPagado).toFixed(2));
            const montoFormateado = `$${saldoPendiente.toFixed(2)}`;
            
            item.innerHTML = `
                <div class="factura-item-info">
                    <div class="factura-item-name">${factura.paciente}</div>
                    <div class="factura-item-meta">${factura.codigoExpediente || factura.id} • ${factura.especialidad} • ${factura.fecha || fechaHoy}</div>
                </div>
                <div class="factura-item-cost">${montoFormateado}</div>
            `;

            item.addEventListener("click", () => {
                seleccionarFactura(factura);
            });

            listaFacturasEl.appendChild(item);
        });

        if (paramId && !facturaSeleccionada) {
            const objSel = facturas.find(f => String(f.id) === String(paramId)) || facturas[0];
            if (objSel) seleccionarFactura(objSel);
        }
    }

    function seleccionarFactura(factura) {
        facturaSeleccionada = factura;

        renderListaFacturas();

        if (panelDetalleVacio) panelDetalleVacio.classList.add("hidden");
        if (formPago) formPago.classList.remove("hidden");

        const numFactura = obtenerSiguienteNumeroFactura();
        if (lblNumeroFactura) lblNumeroFactura.textContent = numFactura;
        if (lblFechaFactura) lblFechaFactura.textContent = factura.fecha || fechaHoy;
        if (lblPacienteFactura) lblPacienteFactura.textContent = factura.paciente;
        if (lblCodigoFactura) lblCodigoFactura.textContent = factura.codigoExpediente || factura.id;
        if (lblEspecialidadFactura) lblEspecialidadFactura.textContent = factura.especialidad;

        // Usar los valores del API (costoTotal ya reconstruido correctamente desde el anticipo)
        const costoBase = Number(factura.costoTotal) || 25.00;
        const anticipoPagado = Number(factura.anticipoPagado) || (factura.pagoAnticipo ? Number((costoBase * 0.25).toFixed(2)) : 0);
        const saldo = Number((costoBase - anticipoPagado).toFixed(2));
        if (montoPagarEl) montoPagarEl.textContent = `$${saldo.toFixed(2)}`;

        const desgloseEl = document.getElementById("desgloseAnticipo");
        if (desgloseEl) {
            if (factura.pagoAnticipo) {
                desgloseEl.innerHTML = `
                    <div class="desglose-row">
                        <span>Precio total de la consulta:</span>
                        <span>$${costoBase.toFixed(2)}</span>
                    </div>
                    <div class="desglose-row desglose-anticipo">
                        <span>Anticipo pagado en línea (25%):</span>
                        <span style="color:#0d9488;">- $${anticipoPagado.toFixed(2)}</span>
                    </div>
                    <div class="desglose-row desglose-total">
                        <span><strong>Saldo pendiente a cobrar (75%):</strong></span>
                        <span><strong>$${saldo.toFixed(2)}</strong></span>
                    </div>`;
                desgloseEl.style.display = "block";
            } else {
                desgloseEl.innerHTML = `
                    <div class="desglose-row">
                        <span>Precio total de la consulta:</span>
                        <span>$${Number(factura.costoTotal || factura.monto).toFixed(2)}</span>
                    </div>`;
                desgloseEl.style.display = "block";
            }
        }

        if (metodoPagoSelect) metodoPagoSelect.value = "Efectivo";
        if (grupoEfectivo) grupoEfectivo.classList.remove("hidden");
        if (grupoCambio) grupoCambio.classList.remove("hidden");
        if (montoRecibidoInput) {
            montoRecibidoInput.value = "";
            montoRecibidoInput.focus();
        }
        if (montoCambioEl) montoCambioEl.textContent = "$0.00";
        if (btnProcesarPago) btnProcesarPago.disabled = true;
    }

    if (metodoPagoSelect) {
        metodoPagoSelect.addEventListener("change", (e) => {
            const metodo = e.target.value;
            if (metodo === "Tarjeta") {
                if (grupoEfectivo) grupoEfectivo.classList.add("hidden");
                if (grupoCambio) grupoCambio.classList.add("hidden");
                if (btnProcesarPago) btnProcesarPago.disabled = false;
            } else {
                if (grupoEfectivo) grupoEfectivo.classList.remove("hidden");
                if (grupoCambio) grupoCambio.classList.remove("hidden");
                validarMontoEfectivo();
            }
        });
    }

    if (montoRecibidoInput) {
        montoRecibidoInput.addEventListener("input", validarMontoEfectivo);
    }

    function validarMontoEfectivo() {
        if (!facturaSeleccionada) return;

        const total = Number(facturaSeleccionada.monto || 0);
        const recibido = parseFloat(montoRecibidoInput.value);

        if (isNaN(recibido) || recibido < total) {
            if (montoCambioEl) montoCambioEl.textContent = "$0.00";
            if (btnProcesarPago) btnProcesarPago.disabled = true;
        } else {
            const cambio = recibido - total;
            if (montoCambioEl) montoCambioEl.textContent = `$${cambio.toFixed(2)}`;
            if (btnProcesarPago) btnProcesarPago.disabled = false;
        }
    }

    if (formPago) {
        formPago.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!facturaSeleccionada) return;

            const total = Number(facturaSeleccionada.monto || 0);
            const metodo = metodoPagoSelect ? metodoPagoSelect.value : "Efectivo";
            const numFactura = lblNumeroFactura ? lblNumeroFactura.textContent : obtenerSiguienteNumeroFactura();

            let recibido = total;
            let cambio = 0;

            if (metodo === "Efectivo") {
                recibido = parseFloat(montoRecibidoInput.value) || total;
                cambio = Math.max(0, recibido - total);
            }

            if (btnProcesarPago) btnProcesarPago.disabled = true;

            // Registrar liquidacion de pago en BD
            try {
                await fetch("/Account/ProcesarPagoFactura", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pacienteId: parseInt(facturaSeleccionada.id, 10),
                        montoTotal: total,
                        metodoPago: metodo
                    })
                });
            } catch (err) {
                console.error("Error al registrar el pago en BD:", err);
            }

            // Eliminar de los pendientes en localStorage al ser cobrado exitosamente
            removerPacienteFacturadoLocal(facturaSeleccionada.id);

            facturaPagadaActual = {
                numeroFactura: numFactura,
                paciente: facturaSeleccionada.paciente,
                codigo: facturaSeleccionada.codigoExpediente || facturaSeleccionada.id,
                especialidad: facturaSeleccionada.especialidad,
                montoTotal: `$${total.toFixed(2)}`,
                montoTotalNum: total,
                costoTotal: facturaSeleccionada.costoTotal || total,
                anticipoPagado: facturaSeleccionada.anticipoPagado || 0,
                pagoAnticipo: facturaSeleccionada.pagoAnticipo || false,
                metodoPago: metodo,
                montoRecibido: `$${recibido.toFixed(2)}`,
                cambio: `$${cambio.toFixed(2)}`,
                fecha: lblFechaFactura ? lblFechaFactura.textContent : fechaHoy
            };

            incrementarNumeroFactura();

            if (modalFacturaNum) modalFacturaNum.textContent = facturaPagadaActual.numeroFactura;
            if (modalFacturaPac) modalFacturaPac.textContent = facturaPagadaActual.paciente;
            if (modalFacturaEsp) modalFacturaEsp.textContent = facturaPagadaActual.especialidad;
            if (modalFacturaMetodo) modalFacturaMetodo.textContent = facturaPagadaActual.metodoPago;
            if (modalFacturaTotal) modalFacturaTotal.textContent = facturaPagadaActual.montoTotal;

            if (inputCorreoFactura) {
                inputCorreoFactura.value = "";
                inputCorreoFactura.placeholder = "correo@ejemplo.com";
            }

            if (modalFacturaFinalizada) {
                modalFacturaFinalizada.classList.remove("hidden");
            }

            mostrarToast("¡Factura procesada y liquidada con éxito!");
        });
    }

    if (btnEnviarCorreoFactura) {
        btnEnviarCorreoFactura.addEventListener("click", async () => {
            if (!facturaPagadaActual) return;

            const correo = inputCorreoFactura ? inputCorreoFactura.value.trim() : "";
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!correo || !emailRegex.test(correo)) {
                mostrarToast("Por favor ingresa un correo electrónico válido.", "error");
                if (inputCorreoFactura) inputCorreoFactura.focus();
                return;
            }

            const btnTextoOriginal = btnEnviarCorreoFactura.innerHTML;
            btnEnviarCorreoFactura.disabled = true;
            btnEnviarCorreoFactura.innerHTML = `<span>Enviando...</span>`;

            try {
                const payload = {
                    correo: correo,
                    numeroFactura: facturaPagadaActual.numeroFactura,
                    paciente: facturaPagadaActual.paciente,
                    codigo: facturaPagadaActual.codigo,
                    especialidad: facturaPagadaActual.especialidad,
                    costoTotal: facturaPagadaActual.costoTotal,
                    anticipoPagado: facturaPagadaActual.anticipoPagado,
                    montoTotal: facturaPagadaActual.montoTotal,
                    metodoPago: facturaPagadaActual.metodoPago,
                    montoRecibido: facturaPagadaActual.montoRecibido,
                    cambio: facturaPagadaActual.cambio
                };

                const resp = await fetch("/Account/EnviarFacturaCorreo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await resp.json();

                if (resp.ok && data.success) {
                    mostrarToast(data.message || `Factura enviada exitosamente a ${correo}`);
                } else {
                    mostrarToast(data.message || "No se pudo enviar el correo en este momento.", "error");
                }
            } catch (err) {
                console.error("Error al enviar factura:", err);
                mostrarToast("Hubo un error de conexión al enviar el correo.", "error");
            } finally {
                btnEnviarCorreoFactura.disabled = false;
                btnEnviarCorreoFactura.innerHTML = btnTextoOriginal;
            }
        });
    }

    if (btnPrintFactura) {
        btnPrintFactura.addEventListener("click", () => {
            if (!facturaPagadaActual) return;

            const printWindow = window.open("", "_blank", "width=750,height=850");
            if (!printWindow) {
                window.print();
                return;
            }

            const totalNum = parseFloat(facturaPagadaActual.montoTotal.replace("$", "")) || 0;
            const costoTotalNum = parseFloat(facturaPagadaActual.costoTotal) || totalNum;
            const anticipoPagadoNum = parseFloat(facturaPagadaActual.anticipoPagado) || 0;
            const subtotalNum = (costoTotalNum / 1.13).toFixed(2);
            const ivaNum = (costoTotalNum - parseFloat(subtotalNum)).toFixed(2);

            const now = new Date();
            const horas = now.getHours();
            const ampm = horas >= 12 ? "p.m." : "a.m.";
            const horas12 = horas % 12 || 12;
            const minutos = String(now.getMinutes()).padStart(2, "0");
            const fechaHoraEmision = `${now.toLocaleDateString("es-ES")} ${String(horas12).padStart(2, "0")}:${minutos} ${ampm}`;

            const htmlContent = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="utf-8" />
                    <title>Factura Electrónica - ${facturaPagadaActual.numeroFactura}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                        body { padding: 40px; color: #334155; background: #fff; font-size: 13px; }
                        .sheet { max-width: 700px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 32px; box-shadow: none; }
                        .text-teal { color: #1e7a8e; }
                        @media print {
                            body { padding: 0; background: #fff; }
                            .sheet { border: none; box-shadow: none; padding: 10px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="sheet">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <img src="/images/logo.png" style="width: 55px; height: auto; object-fit: contain; margin-right: 6px;" />
                                <div>
                                    <h2 style="color: #1a6f83; font-size: 21px; font-weight: 800; margin: 0; letter-spacing: -0.3px;">CLÍNICA CURAVITA</h2>
                                    <div style="font-size: 10px; font-weight: 700; color: #1e7a8e; letter-spacing: 0.5px; margin-top: 2px;">COMPROBANTE DE PAGO Y FACTURACIÓN</div>
                                    <div style="font-size: 11px; color: #64748b; margin-top: 1px;">ESFE SYSCURAVITA • PBX: (503) 2200-0000 • San Salvador, El Salvador</div>
                                </div>
                            </div>
                            <div style="border: 1px solid #1e7a8e; border-radius: 8px; padding: 10px 16px; text-align: center; background-color: #f6fbfa; min-width: 190px;">
                                <div style="font-size: 10px; font-weight: 800; color: #1e7a8e; letter-spacing: 0.5px;">FACTURA ELECTRÓNICA</div>
                                <div style="font-size: 18px; font-weight: 800; color: #1a6f83; margin: 3px 0;">${facturaPagadaActual.numeroFactura}</div>
                                <div style="font-size: 11px; color: #64748b;">Fecha: ${fechaHoraEmision}</div>
                            </div>
                        </div>

                        <div style="height: 3px; background: #a2c6ce; border-radius: 2px; margin: 0 0 16px;"></div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; background: #f8fafc; gap: 14px; margin-bottom: 24px;">
                            <div>
                                <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 3px;">PACIENTE / CLIENTE</div>
                                <div style="font-size: 14px; font-weight: 700; color: #334155;">${facturaPagadaActual.paciente}</div>
                                <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 12px; margin-bottom: 3px;">MÉTODO DE PAGO</div>
                                <div style="font-size: 13px; font-weight: 700; color: #334155;">${facturaPagadaActual.metodoPago}</div>
                            </div>
                            <div>
                                <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 3px;">N° DE EXPEDIENTE</div>
                                <div style="font-size: 14px; font-weight: 700; color: #334155;">${facturaPagadaActual.codigo}</div>
                                <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 12px; margin-bottom: 3px;">ESTADO DEL COMPROBANTE</div>
                                <div style="font-size: 13px; font-weight: 700; color: #1e7a8e;">CANCELADO / PAGADO</div>
                            </div>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <div style="font-size: 11px; font-weight: 800; color: #1e7a8e; margin-bottom: 8px;">DETALLE DEL SERVICIO FACTURADO</div>
                            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; font-size: 12px;">
                                <thead>
                                    <tr style="background: #1e7a8e; color: #ffffff; text-align: left;">
                                        <th style="padding: 10px 14px; width: 60px; text-align: center;">CANT.</th>
                                        <th style="padding: 10px 14px;">CONCEPTO / ESPECIALIDAD DEL SERVICIO</th>
                                        <th style="padding: 10px 14px; text-align: right; width: 110px;">PRECIO UNIT.</th>
                                        <th style="padding: 10px 14px; text-align: right; width: 110px;">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="padding: 14px; text-align: center; font-weight: 700; color: #1e7a8e;">1</td>
                                        <td style="padding: 14px;">
                                            <div style="font-weight: 700; color: #1e7a8e; font-size: 13px;">Consulta Médica Especializada</div>
                                            <div style="font-size: 12px; color: #64748b; margin-top: 3px;">Especialidad: ${facturaPagadaActual.especialidad}</div>
                                        </td>
                                        <td style="padding: 14px; text-align: right; color: #64748b;">$${subtotalNum}</td>
                                        <td style="padding: 14px; text-align: right; font-weight: 700; color: #1e7a8e;">$${subtotalNum}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: stretch; margin-bottom: 30px;">
                            <div style="border-left: 3px solid #1e7a8e; background: #f6fbfa; border-radius: 4px; padding: 16px; font-size: 12px; color: #1e7a8e; line-height: 1.6;">
                                ${anticipoPagadoNum > 0 ? `
                                <strong style="color: #1a6f83;">Constancia de Pago:</strong> Se acredita el pago de la consulta médica mediante anticipo en línea del 25% ($${anticipoPagadoNum.toFixed(2)}) y cancelación del 75% restante en caja mediante <strong style="color: #1a6f83;">${facturaPagadaActual.metodoPago}</strong>. Gracias por confiar en los servicios médicos de Clínica Curavita.
                                ` : `
                                <strong style="color: #1a6f83;">Constancia de Pago:</strong> Se acredita la cancelación total del servicio mediante <strong style="color: #1a6f83;">${facturaPagadaActual.metodoPago}</strong>. Gracias por confiar en los servicios médicos de Clínica Curavita.
                                `}
                            </div>

                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; font-size: 13px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b;">
                                    <span>Subtotal:</span>
                                    <span>$${subtotalNum}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: #64748b;">
                                    <span>IVA (13%):</span>
                                    <span>$${ivaNum}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; margin-bottom: ${anticipoPagadoNum > 0 ? '8px' : '12px'};">
                                    <span style="font-weight: 700; font-size: 14px; color: #1e7a8e;">${anticipoPagadoNum > 0 ? 'TOTAL CONSULTA:' : 'TOTAL:'}</span>
                                    <span style="font-size: 18px; font-weight: 800; color: #1e7a8e;">$${costoTotalNum.toFixed(2)}</span>
                                </div>
                                ${anticipoPagadoNum > 0 ? `
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #0d9488; font-size: 12px; font-weight: 600;">
                                    <span>Anticipo pagado en línea (25%):</span>
                                    <span>- $${anticipoPagadoNum.toFixed(2)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; margin-bottom: 12px;">
                                    <span style="font-weight: 700; font-size: 14px; color: #1e7a8e;">COBRADO HOY (75%):</span>
                                    <span style="font-size: 16px; font-weight: 800; color: #1e7a8e;">${facturaPagadaActual.montoTotal}</span>
                                </div>` : ''}
                                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b; font-size: 12px;">
                                    <span>Monto Recibido:</span>
                                    <span>${facturaPagadaActual.montoRecibido}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 12px;">
                                    <span>Cambio / Vuelto:</span>
                                    <span>${facturaPagadaActual.cambio}</span>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                            <span>ESFE SYSCURAVITA - Módulo de Facturación y Caja</span>
                            <span>Gracias por su preferencia • Comprobante Fiscal Oficial</span>
                        </div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `;

            printWindow.document.write(htmlContent);
            printWindow.document.close();
        });
    }

    if (btnSiguienteFactura) {
        btnSiguienteFactura.addEventListener("click", async () => {
            if (modalFacturaFinalizada) modalFacturaFinalizada.classList.add("hidden");

            facturaSeleccionada = null;
            facturaPagadaActual = null;

            if (formPago) formPago.classList.add("hidden");
            if (panelDetalleVacio) panelDetalleVacio.classList.remove("hidden");

            // Se refresca la lista directamente desde la API
            await renderListaFacturas();
        });
    }

    if (modalFacturaFinalizada) {
        modalFacturaFinalizada.addEventListener("click", async (e) => {
            if (e.target === modalFacturaFinalizada) {
                modalFacturaFinalizada.classList.add("hidden");
                facturaSeleccionada = null;
                if (formPago) formPago.classList.add("hidden");
                if (panelDetalleVacio) panelDetalleVacio.classList.remove("hidden");
                await renderListaFacturas();
            }
        });
    }

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

    renderListaFacturas();
});