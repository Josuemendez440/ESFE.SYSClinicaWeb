document.addEventListener("DOMContentLoaded", function () {
    // Cargar información guardada previamente desde localStorage
    var datosCitaRaw = localStorage.getItem("resumenCitaData") || localStorage.getItem("citaAgendada");
    var datosCita = null;

    if (datosCitaRaw) {
        try {
            datosCita = JSON.parse(datosCitaRaw);

            // Calcular precios dinámicamente desde costo real de la cita
            var costoTotal = parseFloat(datosCita.costo) || 25.00;
            var anticipo = parseFloat((costoTotal * 0.25).toFixed(2));
            var saldo = parseFloat((costoTotal * 0.75).toFixed(2));
            window.curavitaAnticipoActual = anticipo;

            var elPrecioTotal = document.getElementById("precioTotalDisplay");
            var elSaldo = document.getElementById("saldoPendienteDisplay");
            var elAnticipo = document.getElementById("anticipoDisplay");
            var elModalAnticipo = document.getElementById("modalAnticipo");
            var elModalSaldo = document.getElementById("modalSaldo");
            var elBtnPayText = document.getElementById("btnPayText");
            var elDisclaimer = document.querySelector(".pay-disclaimer");

            if (elPrecioTotal) elPrecioTotal.textContent = "$" + costoTotal.toFixed(2);
            if (elSaldo) elSaldo.textContent = "$" + saldo.toFixed(2);
            if (elAnticipo) elAnticipo.textContent = "$" + anticipo.toFixed(2);
            if (elModalAnticipo) elModalAnticipo.textContent = "$" + anticipo.toFixed(2);
            if (elModalSaldo) elModalSaldo.textContent = "$" + saldo.toFixed(2);
            if (elBtnPayText) elBtnPayText.textContent = "Pagar $" + anticipo.toFixed(2) + " y Confirmar Cita";
            if (elDisclaimer) {
                elDisclaimer.textContent = "Al hacer clic en pagar, autorizas el cobro del 25% ($" + anticipo.toFixed(2) + ") para la reserva de tu cita. El 75% restante ($" + saldo.toFixed(2) + ") se abonará en la recepción el día de tu consulta.";
            }

            // 1. Cargar Paciente
            var elPaciente = document.getElementById("resumenPaciente");
            if (elPaciente && datosCita.paciente) {
                elPaciente.textContent = datosCita.paciente;
            }

            // 2. Cargar Médico y Especialidad
            var elMedico = document.getElementById("resumenMedico");
            if (elMedico) {
                if (datosCita.especialidadMedico) {
                    elMedico.textContent = datosCita.especialidadMedico;
                } else if (datosCita.especialidad || datosCita.medico) {
                    elMedico.textContent = (datosCita.especialidad || "") + " – " + (datosCita.medico || "");
                }
            }

            // 3. Cargar Fecha y Hora
            var elFechaHora = document.getElementById("resumenFechaHora");
            if (elFechaHora) {
                if (datosCita.fechaHora) {
                    elFechaHora.textContent = datosCita.fechaHora;
                } else if (datosCita.fecha) {
                    var fechaFormateada = datosCita.fecha;
                    if (datosCita.fecha.indexOf("-") !== -1) {
                        var partes = datosCita.fecha.split("-");
                        var year = partes[0];
                        var month = partes[1];
                        var day = partes[2];
                        var meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

                        fechaFormateada = parseInt(day, 10) + " de " + meses[parseInt(month, 10) - 1] + ", " + year;
                    }
                    elFechaHora.textContent = fechaFormateada + " – " + (datosCita.hora || "");
                }
            }
        } catch (e) {
            console.error("Error al procesar el resumen de la cita:", e);
        }
    }

    // Bindings visuales interactivos de la tarjeta de crédito
    var cardNameInput = document.getElementById("cardName");
    var cardNumberInput = document.getElementById("cardNumber");
    var cardExpInput = document.getElementById("cardExp");
    var cardCvvInput = document.getElementById("cardCvv");

    var cardNameDisplay = document.getElementById("cardNameDisplay");
    var cardNumDisplay = document.getElementById("cardNumDisplay");
    var cardExpDisplay = document.getElementById("cardExpDisplay");

    if (cardNameInput) {
        cardNameInput.addEventListener("input", function (e) {
            cardNameDisplay.textContent = e.target.value.toUpperCase() || "NOMBRE COMPLETO";
        });
    }

    if (cardNumberInput) {
        cardNumberInput.addEventListener("input", function (e) {
            var val = e.target.value.replace(/\D/g, "").substring(0, 16);
            var matches = val.match(/.{1,4}/g);
            var formatted = matches ? matches.join(" ") : "";
            e.target.value = formatted;
            cardNumDisplay.textContent = formatted || "•••• •••• •••• ••••";
        });
    }

    if (cardExpInput) {
        cardExpInput.addEventListener("input", function (e) {
            var val = e.target.value.replace(/\D/g, "");
            if (val.length >= 2) {
                val = val.substring(0, 2) + "/" + val.substring(2, 4);
            }
            e.target.value = val;
            cardExpDisplay.textContent = val || "MM/AA";
        });
    }

    if (cardCvvInput) {
        cardCvvInput.addEventListener("input", function (e) {
            e.target.value = e.target.value.replace(/\D/g, "");
        });
    }

    // Manejo del Submit de Pago Asíncrono (AJAX / Fetch)
    var paymentForm = document.getElementById("paymentForm");
    var btnPay = document.getElementById("btnPay");
    var btnPayText = document.getElementById("btnPayText");
    var btnPayIcon = document.getElementById("btnPayIcon");
    var alertError = document.getElementById("alertError");
    var modalPagoExitoso = document.getElementById("modalPagoExitoso");
    var btnVerCitas = document.getElementById("btnVerCitas");

    function mostrarError(mensaje) {
        if (alertError) {
            alertError.textContent = mensaje;
            alertError.style.display = "block";
            alertError.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            alert(mensaje);
        }
    }

    function setCargando(cargando) {
        if (!btnPay) return;
        btnPay.disabled = cargando;

        if (cargando) {
            if (btnPayIcon) btnPayIcon.style.display = "none";
            var spinner = document.createElement("span");
            spinner.className = "spinner";
            spinner.id = "btnSpinner";
            btnPay.prepend(spinner);
            if (btnPayText) btnPayText.textContent = "Procesando pago seguro...";
        } else {
            var spinnerExistente = document.getElementById("btnSpinner");
            if (spinnerExistente) spinnerExistente.remove();
            if (btnPayIcon) btnPayIcon.style.display = "block";
            var antVal = (window.curavitaAnticipoActual || 6.25).toFixed(2);
            if (btnPayText) btnPayText.textContent = "Pagar $" + antVal + " y Confirmar Cita";
        }
    }

    if (paymentForm) {
        paymentForm.addEventListener("submit", function (e) {
            e.preventDefault();

            if (alertError) {
                alertError.style.display = "none";
                alertError.textContent = "";
            }

            var titular = cardNameInput ? cardNameInput.value.trim() : "";
            var numero = cardNumberInput ? cardNumberInput.value.replace(/\s+/g, "").trim() : "";
            var exp = cardExpInput ? cardExpInput.value.trim() : "";
            var cvv = cardCvvInput ? cardCvvInput.value.trim() : "";

            if (!titular) {
                mostrarError("Por favor ingresa el nombre del titular de la tarjeta.");
                return;
            }
            if (numero.length < 15) {
                mostrarError("Por favor ingresa un número de tarjeta válido (15 o 16 dígitos).");
                return;
            }
            if (exp.length < 5) {
                mostrarError("Por favor ingresa la fecha de expiración en formato MM/AA.");
                return;
            }
            if (cvv.length < 3) {
                mostrarError("Por favor ingresa el código de seguridad CVV (3 o 4 dígitos).");
                return;
            }

            // Extraer datos de la cita desde el almacenamiento local o elementos del DOM
            var paciente = (datosCita && datosCita.paciente) ? datosCita.paciente : (document.getElementById("resumenPaciente")?.textContent.trim() || "");
            var especialidad = (datosCita && datosCita.especialidad) ? datosCita.especialidad : "";
            var medico = (datosCita && datosCita.medico) ? datosCita.medico : "";
            var fecha = (datosCita && datosCita.fecha) ? datosCita.fecha : "";
            var hora = (datosCita && datosCita.hora) ? datosCita.hora : "";
            var fechaHora = (datosCita && datosCita.fechaHora) ? datosCita.fechaHora : (document.getElementById("resumenFechaHora")?.textContent.trim() || "");
            var rolSesion = (sessionStorage.getItem("rol") || "").toLowerCase();
            var esPersonalClinica = rolSesion.includes("admin") || rolSesion.includes("medic") || rolSesion.includes("doctor") || rolSesion.includes("recep") || rolSesion.includes("enferm");
            var correo = (datosCita && datosCita.correo) ? datosCita.correo : (!esPersonalClinica ? (sessionStorage.getItem("correo") || "") : "");

            if (!especialidad && datosCita && datosCita.especialidadMedico) {
                var partesEsp = datosCita.especialidadMedico.split("–");
                if (partesEsp.length > 0) especialidad = partesEsp[0].trim();
                if (partesEsp.length > 1) medico = partesEsp[1].trim();
            }

            // Separación de Nombres y Apellidos para la BD [dbo].[Pacientes]
            var partesNombre = paciente.trim().split(" ");
            var nombresVal = (datosCita && datosCita.nombres) ? datosCita.nombres : (partesNombre[0] || "Paciente");
            var apellidosVal = (datosCita && datosCita.apellidos) ? datosCita.apellidos : (partesNombre.slice(1).join(" ") || "General");

            var payload = {
                paciente: paciente,
                nombres: nombresVal,
                apellidos: apellidosVal,
                dui: (datosCita && datosCita.dui) ? datosCita.dui : "00000000-0",
                telefono: (datosCita && datosCita.telefono) ? datosCita.telefono : null,
                especialidad: especialidad || "Medicina General",
                medico: medico || "Dr. Roberto Gómez",
                fecha: fecha,
                hora: hora,
                fechaHora: fechaHora,
                correo: correo,
                precioTotal: (datosCita && datosCita.costo) ? parseFloat(datosCita.costo) : 25.00,
                montoAnticipo: (datosCita && datosCita.costo) ? parseFloat((datosCita.costo * 0.25).toFixed(2)) : 6.25,
                saldoPendiente: (datosCita && datosCita.costo) ? parseFloat((datosCita.costo * 0.75).toFixed(2)) : 18.75,
                titularTarjeta: titular,
                numeroTarjeta: numero,
                expiracion: exp,
                cvv: cvv
            };

            setCargando(true);

            // Petición asíncrona Fetch al endpoint POST /Account/ConfirmarPago
            fetch("/Account/ConfirmarPago", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })
            .then(function (response) {
                return response.json().then(function (data) {
                    if (!response.ok) {
                        throw new Error(data.mensaje || "Error al procesar el pago (" + response.status + ")");
                    }
                    return data;
                });
            })
            .then(function (data) {
                setCargando(false);
                if (data.exito) {
                    // Limpiar localStorage temporal tras pago exitoso
                    localStorage.removeItem("resumenCitaData");
                    localStorage.removeItem("citaAgendada");

                    // Datos del paciente confirmado para la redirección al módulo de Consulta Médica
                    var codExp = data.codigoExpediente || (data.pacienteId ? ("PAC-" + String(data.pacienteId).padStart(4, "0")) : "PAC-0001");
                    var pacId = data.pacienteId || codExp;

                    // Rellenar datos en el Modal Flotante
                    var modalPac = document.getElementById("modalPaciente");
                    if (modalPac) modalPac.textContent = paciente || "Paciente";

                    var modalMed = document.getElementById("modalMedico");
                    if (modalMed) {
                        modalMed.textContent = (especialidad ? (especialidad + " – ") : "") + (medico || "Médico Especialista");
                    }

                    var modalFH = document.getElementById("modalFechaHora");
                    if (modalFH) modalFH.textContent = fechaHora || "Fecha confirmada";

                    // Desplegar el Modal Flotante sobre el contenido
                    if (modalPagoExitoso) {
                        modalPagoExitoso.classList.remove("hidden");
                    }

                    // Generar Comprobante PDF automáticamente
                    var numeroComprobante = "COMP-" + Date.now().toString().slice(-6);
                    var html = generarHtmlComprobante({
                        numeroComprobante: numeroComprobante,
                        paciente: paciente,
                        codigo: codExp,
                        especialidad: especialidad,
                        fechaHora: fechaHora,
                        anticipo: payload.montoAnticipo.toFixed(2),
                        saldo: payload.saldoPendiente.toFixed(2),
                        total: payload.precioTotal.toFixed(2),
                        tarjeta: numero.slice(-4)
                    });

                    fetch('/Account/GuardarPDF', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            HtmlContent: html,
                            Tipo: 'Comprobante',
                            NombreArchivo: `Comprobante-${codExp}-${numeroComprobante}.pdf`
                        })
                    }).catch(err => console.error("Error al guardar Comprobante PDF:", err));
                } else {
                    mostrarError(data.mensaje || "Ocurrió un inconveniente al procesar el pago.");
                }
            })
            .catch(function (error) {
                setCargando(false);
                mostrarError(error.message || "Error al comunicar con el servidor. Intente nuevamente.");
            });
        });
    }

    // Redirección al listado de expedientes desde el botón del modal
    if (btnVerCitas) {
        btnVerCitas.addEventListener("click", function () {
            window.location.href = "/Account/Expedientes";
        });
    }

    function generarHtmlComprobante(datos) {
        const now = new Date();
        const fechaEmision = now.toLocaleDateString("es-ES") + " " + now.toLocaleTimeString("es-ES", { hour12: true });
        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8" />
    <title>Comprobante de Pago - ${datos.numeroComprobante}</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #fff; padding: 40px; color: #334155; font-size: 13px; }
        .sheet { max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 30px; border-radius: 8px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e7a8e; padding-bottom: 20px; margin-bottom: 20px; }
        .title { color: #1a6f83; font-size: 20px; font-weight: bold; margin: 0; }
        .subtitle { font-size: 11px; color: #64748b; }
        .badge { background: #f6fbfa; border: 1px solid #1e7a8e; padding: 10px; border-radius: 6px; text-align: center; }
        .badge-title { font-size: 10px; font-weight: bold; color: #1e7a8e; }
        .badge-num { font-size: 16px; font-weight: bold; color: #1a6f83; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .label { font-size: 11px; font-weight: bold; color: #64748b; }
        .value { font-size: 14px; font-weight: bold; color: #334155; }
        .total-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="header">
            <div>
                <h2 class="title">CLÍNICA CURAVITA</h2>
                <div class="subtitle">Comprobante de Reserva de Cita</div>
            </div>
            <div class="badge">
                <div class="badge-title">N° COMPROBANTE</div>
                <div class="badge-num">${datos.numeroComprobante}</div>
                <div class="subtitle">Fecha: ${fechaEmision}</div>
            </div>
        </div>
        <div class="row">
            <div>
                <div class="label">PACIENTE</div>
                <div class="value">${datos.paciente}</div>
            </div>
            <div style="text-align: right;">
                <div class="label">N° EXPEDIENTE</div>
                <div class="value">${datos.codigo}</div>
            </div>
        </div>
        <div class="row">
            <div>
                <div class="label">MÉTODO DE PAGO</div>
                <div class="value">Tarjeta terminada en ${datos.tarjeta}</div>
            </div>
            <div style="text-align: right;">
                <div class="label">ESTADO</div>
                <div class="value" style="color: #1e7a8e;">ANTICIPO PAGADO</div>
            </div>
        </div>
        <div class="total-box">
            <div class="row">
                <span class="label">Costo Total de Consulta:</span>
                <span class="value">$${datos.total}</span>
            </div>
            <div class="row">
                <span class="label">Saldo Pendiente a Pagar en Clínica:</span>
                <span class="value">$${datos.saldo}</span>
            </div>
            <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 10px 0;">
            <div class="row" style="align-items: center;">
                <span class="label" style="font-size: 14px; color: #1e7a8e;">ANTICIPO COBRADO HOY (25%):</span>
                <span class="value" style="font-size: 18px; color: #1e7a8e;">$${datos.anticipo}</span>
            </div>
        </div>
        <div class="footer">
            ESFE SYSCURAVITA - Documento Oficial de Pago Electrónico
        </div>
    </div>
</body>
</html>`;
    }
});