# Sistema Inteligente de Gestión y Análisis de Rendimiento en Futsal

Página web estática para la Unidad Educativa Técnico Humanístico Maestro Pitágoras II.

## Archivos incluidos

- `index.html`: página principal.
- `style.css`: diseño visual responsivo.
- `app.js`: lógica del sistema, login, panel administrador, estadísticas y exportación.
- `datos.js`: datos iniciales del campeonato.
- `logo.png`: logo institucional extraído del documento del proyecto.

## Usuario y contraseña

- Usuario: `admin`
- Contraseña: `pitagoras2026`

Puede cambiar estos datos al inicio del archivo `app.js`:

```js
const ADMIN_USER = "admin";
const ADMIN_PASS = "pitagoras2026";
```

## Cómo subir a GitHub Pages

1. Cree un repositorio nuevo en GitHub.
2. Suba todos los archivos de esta carpeta en la raíz del repositorio, sin subcarpetas.
3. Entre a **Settings > Pages**.
4. En **Build and deployment**, seleccione `Deploy from a branch`.
5. Seleccione la rama `main` y la carpeta `/root`.
6. Guarde los cambios y espere el enlace de publicación.

## Cómo publicar cambios de resultados

Esta página está preparada para GitHub Pages, por eso no usa PHP ni base de datos. Los cambios realizados desde el panel se guardan en el navegador del administrador.

Para que todos vean los nuevos resultados:

1. Ingrese al panel administrador.
2. Registre equipos, jugadores, partidos, goles y tarjetas.
3. Presione **Exportar datos.js**.
4. Suba el nuevo archivo `datos.js` a GitHub reemplazando el anterior.
5. Espere a que GitHub Pages actualice la página.

## Privacidad

No publique datos sensibles de estudiantes en una página pública. El sistema permite guardar datos internos como CI/RUDE, tutor, teléfono y observaciones, pero la vista pública solo muestra datos deportivos básicos: nombre, equipo, edad, curso, dorsal y posición.

Para una seguridad real con usuario y contraseña, se necesita una versión con backend y base de datos. Esta versión es estática y compatible con GitHub Pages.
