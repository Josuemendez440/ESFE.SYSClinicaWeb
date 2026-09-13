document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById('btnEnviarCodigo') || document.querySelector('button[type="submit"]');
    const inputEmail = document.getElementById('userEmail') || document.querySelector('input[type="email"]');

    if (btnEnviar && inputEmail) {
        btnEnviar.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = inputEmail.value.trim();

            if (!email) {
                alert('Por favor, ingresa tu correo electrónico.');
                return;
            }

            try {
                const response = await fetch('/Account/EnviarCodigoRecuperacion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo: email })
                });

                const data = await response.json();

                if (data.exito) {
                    sessionStorage.setItem('resetEmail', email);
                    window.location.href = `/Account/Verificacion?email=${encodeURIComponent(email)}`;
                } else {
                    // Muestra el mensaje si el correo NO existe en la base de datos
                    alert(data.mensaje);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Ocurrió un error al conectar con el servidor.');
            }
        });
    }
});