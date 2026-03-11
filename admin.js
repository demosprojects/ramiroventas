import { db, auth } from "./firebase.js";
import { 
    collection, addDoc, getDocs, deleteDoc, doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ─── PROTECCIÓN DE RUTA ──────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        cargarProductos();
    }
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (e) {
        mostrarToast("❌ Error al cerrar sesión");
    }
});

let productos = [];
let productosFiltrados = [];
let idAEliminar = null;

// ─── CARGA INICIAL ────────────────────────────────────────────────────────────
async function cargarProductos() {
    toggleLoader(true);
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        productos = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        aplicarFiltros();
    } catch (e) {
        console.error("Error al cargar:", e);
        mostrarToast("❌ Error al cargar datos");
    } finally {
        toggleLoader(false);
    }
}

// ─── LÓGICA DE FILTRADO UNIFICADA ────────────────────────────────────────────

// Mapa de palabras clave de disponibilidad para búsqueda por texto
const KEYWORDS_DISPONIBLE  = ['disponible', 'stock', 'con stock', 'activo'];
const KEYWORDS_AGOTADO     = ['agotado', 'sin stock', 'agotada', 'inactivo'];

// Mapa de alias de categorías para búsqueda por texto
const ALIAS_CATEGORIAS = {
    'dormitorio': 'Dormitorio', 'cuarto': 'Dormitorio', 'habitacion': 'Dormitorio', 'habitación': 'Dormitorio',
    'cocina': 'Cocina & Comedor', 'comedor': 'Cocina & Comedor',
    'exterior': 'Exterior', 'jardin': 'Exterior', 'jardín': 'Exterior', 'patio': 'Exterior',
    'tecnologia': 'Tecnología', 'tecnología': 'Tecnología', 'electronica': 'Tecnología', 'electrónica': 'Tecnología', 'electronico': 'Tecnología', 'electrónico': 'Tecnología',
    'climatizacion': 'Climatización', 'climatización': 'Climatización', 'aire': 'Climatización', 'calefaccion': 'Climatización', 'calefacción': 'Climatización',
    'mates': 'Mates', 'mate': 'Mates',
};

function aplicarFiltros() {
    const textoRaw = document.getElementById('admin-buscador').value.trim();
    const texto    = textoRaw.toLowerCase();
    const stock    = document.getElementById('filtro-stock').value;
    const cat      = document.getElementById('filtro-categoria').value;

    // Detectar si el texto coincide con un keyword de disponibilidad
    const textoPideDisp    = KEYWORDS_DISPONIBLE.some(k => texto.includes(k));
    const textoPideAgotado = KEYWORDS_AGOTADO.some(k => texto.includes(k));

    // Detectar si el texto coincide con una categoría
    const categoriaDetectada = ALIAS_CATEGORIAS[texto] || null;

    productosFiltrados = productos.filter(p => {
        // ── Filtro de texto ──
        // Si el texto es un keyword de disponibilidad o categoría, no filtrar por nombre
        const esKeywordEspecial = textoPideDisp || textoPideAgotado || categoriaDetectada;
        const matchTexto = esKeywordEspecial
            ? true
            : (texto === '' || p.nombre.toLowerCase().includes(texto) || (p.categoria && p.categoria.toLowerCase().includes(texto)));

        // ── Filtro de stock (select + texto) ──
        let matchStock;
        if (stock !== 'todos') {
            // El select tiene prioridad
            matchStock = stock === 'disponible' ? p.disponible !== false : p.disponible === false;
        } else if (textoPideDisp) {
            matchStock = p.disponible !== false;
        } else if (textoPideAgotado) {
            matchStock = p.disponible === false;
        } else {
            matchStock = true;
        }

        // ── Filtro de categoría (select + texto) ──
        let matchCat;
        if (cat !== 'todos') {
            // El select tiene prioridad
            matchCat = p.categoria === cat;
        } else if (categoriaDetectada) {
            matchCat = p.categoria === categoriaDetectada;
        } else {
            matchCat = true;
        }

        return matchTexto && matchStock && matchCat;
    });

    actualizarStats();
    renderAdmin();
}

function actualizarStats() {
    const total     = productos.length;
    const filtrados = productosFiltrados.length;
    const statsEl   = document.getElementById('stats-text');
    if (statsEl) statsEl.innerHTML = `${filtrados} de ${total} productos mostrados`;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderAdmin() {
    const container = document.getElementById("admin-productos");
    
    if (productosFiltrados.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center"><p class="font-black italic text-slate-300 uppercase text-[10px]">Sin resultados</p></div>`;
        return;
    }

    container.innerHTML = productosFiltrados.map(p => {
        const disponible = p.disponible !== false;
        const enOferta   = p.enOferta === true;

        return `
            <div class="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 hover:border-[#0056b3] transition-all group relative">
                <div class="relative aspect-square rounded-xl overflow-hidden mb-2 bg-slate-50">
                    <img src="${p.imagenes[0]}" class="w-full h-full object-cover ${!disponible ? 'grayscale opacity-50' : ''}">
                    <div class="absolute top-1.5 left-1.5 flex flex-col gap-1">
                        ${!disponible ? '<span class="stat-pill bg-slate-800 text-white">Agotado</span>' : ''}
                        ${enOferta ? '<span class="stat-pill bg-red-500 text-white">Oferta</span>' : ''}
                    </div>
                </div>
                <h3 class="font-black text-[10px] uppercase truncate mb-0.5">${p.nombre}</h3>
                <p class="text-[#0056b3] font-black text-xs">$${Number(p.precio).toLocaleString('es-AR')}</p>
                <div class="flex gap-1.5 mt-3 pt-2 border-t border-slate-50">
                    <button onclick="editarProducto('${p.id}')" class="flex-1 bg-slate-50 text-slate-500 py-1.5 rounded-lg font-bold text-[9px] uppercase hover:bg-blue-50 hover:text-blue-600 transition-all">
                        Editar
                    </button>
                    <button onclick="preguntarEliminar('${p.id}')" class="px-2 bg-red-50 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                        <i class="fa-solid fa-trash-can text-[9px]"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// ─── EVENTOS DE FILTROS ───────────────────────────────────────────────────────
['admin-buscador', 'filtro-stock', 'filtro-categoria'].forEach(id => {
    document.getElementById(id).addEventListener('input', aplicarFiltros);
});

// ─── MODALES ──────────────────────────────────────────────────────────────────
window.preguntarEliminar = function(id) {
    idAEliminar = id;
    document.getElementById("modal-delete").classList.remove("hidden");
    document.body.classList.add("modal-active");
}

window.cerrarModalDelete = function() {
    document.getElementById("modal-delete").classList.add("hidden");
    document.body.classList.remove("modal-active");
    idAEliminar = null;
}

document.getElementById('confirm-delete-btn')?.addEventListener('click', async () => {
    if (!idAEliminar) return;
    const idParaBorrar = idAEliminar;
    cerrarModalDelete();
    toggleLoader(true);
    try {
        await deleteDoc(doc(db, "products", idParaBorrar));
        mostrarToast("🔥 Eliminado");
        await cargarProductos();
    } catch (e) {
        console.error("Error al eliminar:", e);
        mostrarToast(e.code === "permission-denied" ? "❌ Sin permisos en Firestore" : "❌ Error al borrar");
        toggleLoader(false);
    }
});

// ─── GUARDAR PRODUCTO ─────────────────────────────────────────────────────────
window.guardarProducto = async function() {
    const id     = document.getElementById("edit-id").value;
    const nombre = document.getElementById("nombre").value.trim();
    const precio = document.getElementById("precio").value;

    if (!nombre || !precio) return mostrarToast("⚠️ Falta nombre o precio");

    // Leer las URLs desde los inputs hidden populados por el uploader de imágenes
    const imgs = [
        document.getElementById("img1").value.trim(),
        document.getElementById("img2").value.trim(),
        document.getElementById("img3").value.trim(),
        document.getElementById("img4").value.trim(),
        document.getElementById("img5").value.trim(),
        document.getElementById("img6").value.trim()
    ].filter(i => i !== "");

    if (imgs.length === 0) return mostrarToast("⚠️ Agregá al menos una imagen");

    // Leer variantes desde el array global definido en admin.html
    const variantesValidas = (typeof window.variantesData !== 'undefined' ? window.variantesData : [])
        .filter(v => v.nombre.trim() !== '' && Number(v.precio) > 0)
        .map(v => ({ nombre: v.nombre.trim(), precio: Number(v.precio), disponible: v.disponible !== false }));

    const datos = {
        nombre,
        precio:          Number(precio),
        categoria:       document.getElementById("categoria").value,
        descripcion:     document.getElementById("descripcion").value,
        caracteristicas: document.getElementById("caracteristicas").value,
        imagenes:        imgs,
        disponible:      document.getElementById("disponible").checked,
        enOferta:        document.getElementById("enOferta").checked,
        precioAnterior:  document.getElementById("enOferta").checked
                            ? Number(document.getElementById("precioAnterior").value) || null
                            : null,
        variantes:       variantesValidas
    };

    toggleLoader(true);
    try {
        if (id) {
            await updateDoc(doc(db, "products", id), datos);
            mostrarToast("✅ Producto actualizado");
        } else {
            await addDoc(collection(db, "products"), { ...datos, fecha: Date.now() });
            mostrarToast("🚀 Producto creado");
        }
        cerrarModalAdmin();
        await cargarProductos();
    } catch (e) {
        console.error("Error al guardar:", e);
        mostrarToast(e.code === "permission-denied" ? "❌ Sin permisos en Firestore" : "❌ Error al guardar");
        toggleLoader(false);
    }
}

// ─── ABRIR / CERRAR MODAL FORM ────────────────────────────────────────────────
window.abrirModalCrear = function() {
    limpiarForm();
    document.getElementById("modal-titulo").innerText = "Nuevo Producto";
    document.getElementById("modal-form").classList.remove("hidden");
    document.body.classList.add("modal-active");
}

window.cerrarModalAdmin = function() {
    document.getElementById("modal-form").classList.add("hidden");
    document.body.classList.remove("modal-active");
}

window.editarProducto = function(id) {
    const p = productos.find(x => x.id === id);
    if (!p) return;
    limpiarForm();

    document.getElementById("edit-id").value        = id;
    document.getElementById("nombre").value         = p.nombre;
    document.getElementById("precio").value         = p.precio;
    document.getElementById("categoria").value      = p.categoria || "Dormitorio";
    document.getElementById("descripcion").value    = p.descripcion || "";
    document.getElementById("caracteristicas").value = p.caracteristicas || "";

    // Cargar imágenes existentes en las zonas de upload
    // loadExistingImage es una función global definida en admin.html
    if (p.imagenes && typeof loadExistingImage === 'function') {
        p.imagenes.forEach((url, i) => {
            if (url && i < 6) loadExistingImage(url, i + 1);
        });
    }

    document.getElementById("disponible").checked = p.disponible !== false;
    document.getElementById("enOferta").checked   = p.enOferta === true;
    if (p.enOferta) {
        document.getElementById("campo-precio-anterior").classList.remove("hidden");
        document.getElementById("precioAnterior").value = p.precioAnterior || "";
    }

    // Cargar variantes existentes
    if (typeof cargarVariantesExistentes === 'function') {
        cargarVariantesExistentes(p.variantes || []);
    }

    document.getElementById("modal-titulo").innerText = "Editar Producto";
    document.getElementById("modal-form").classList.remove("hidden");
    document.body.classList.add("modal-active");
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toggleLoader(show) {
    document.getElementById("loader").classList.toggle("hidden", !show);
    document.getElementById("admin-productos").classList.toggle("hidden", show);
}

function mostrarToast(msj) {
    const t = document.getElementById("toast");
    t.innerHTML = msj;
    t.classList.remove("translate-y-32");
    setTimeout(() => t.classList.add("translate-y-32"), 2800);
}

function limpiarForm() {
    document.getElementById("edit-id").value = "";
    ["nombre", "precio", "descripcion", "caracteristicas", "precioAnterior"].forEach(id => {
        document.getElementById(id).value = "";
    });
    document.getElementById("categoria").value    = "Dormitorio";
    document.getElementById("disponible").checked = true;
    document.getElementById("enOferta").checked   = false;
    document.getElementById("campo-precio-anterior").classList.add("hidden");

    // Limpiar variantes
    if (typeof resetVariantes === 'function') resetVariantes();

    // Limpiar zonas de imagen — función global en admin.html
    if (typeof resetImageZones === 'function') resetImageZones();
}
