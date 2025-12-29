// Webview Preload - Identidad Vivaldi (Pasiva)
(function () {
    // 1. Ocultar la marca de automatización de la forma más sencilla
    // Google detecta si intentamos borrar la propiedad, así que la dejamos en false
    if (navigator.webdriver) {
        const newProto = navigator.__proto__;
        delete newProto.webdriver;
        navigator.__proto__ = newProto;
    }

    // 2. Simular objeto chrome de Vivaldi
    if (!window.chrome) {
        window.chrome = {
            app: { isInstalled: false },
            runtime: { id: "pkedcjkdefgpdelpbdgme" }
        };
    }
})();
