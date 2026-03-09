import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const loginForm = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');
const btnLogin = document.getElementById('btn-login');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    btnLogin.disabled = true;
    btnLogin.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i> Verificando...`;
    errorMsg.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "admin.html";
    } catch (error) {
        errorMsg.classList.remove('hidden');
        errorMsg.innerText = "❌ Credenciales incorrectas o error de conexión.";
        btnLogin.disabled = false;
        btnLogin.innerHTML = `<span>Ingresar</span> <i class="fa-solid fa-arrow-right text-xs"></i>`;
    }
});