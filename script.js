async function readShader(id) {
  const req = await fetch(document.getElementById(id).src);
  return await req.text();
}

function createShader(gl, type, src) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) return shader;

  console.error("Could not compile WebGL Shader", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertShader, fragShader) {
  let program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  let success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) return program;

  console.error("Could not Link WebGL Program", gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

// Définir la matrice de labyrinthe (1 = mur, 0 = espace vide)
const maze = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 0, 1, 1, 0, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1]
];

function createMazeTexture(gl, maze) {
  const width = maze[0].length; // Nombre de colonnes
  const height = maze.length;   // Nombre de lignes
  const textureData = new Uint8Array(width * height);

  // Remplir `textureData` en fonction de la matrice
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      textureData[y * width + x] = maze[y][x] * 255; // 255 pour mur, 0 pour vide
    }
  }

  // Création et configuration de la texture en WebGL2 avec RED
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8,           // Format interne pour WebGL2
    width,            // Largeur de la texture
    height,           // Hauteur de la texture
    0,
    gl.RED,           // Format des données
    gl.UNSIGNED_BYTE, // Type des données
    textureData       // Données de la texture
  );

  // Configuration des paramètres de filtre de la texture
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // Désactiver le wrapping de la texture pour éviter les répétitions hors limites
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

async function main() {
  const fps = document.getElementById("fps");

  const time = {
    current_t: Date.now(),
    dts: [1 / 60],
    t: 0,

    dt: () => time.dts[0],
    update: () => {
      const new_t = Date.now();
      time.dts = [(new_t - time.current_t) / 1_000, ...time.dts].slice(0, 10);
      time.t += time.dt();
      time.current_t = new_t;

      const dt = time.dts.reduce((a, dt) => a + dt, 0) / time.dts.length;
      fps.innerHTML = `${Math.round(1 / dt, 2)}`;
    },
  };

  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) alert("Could not initialize WebGL Context.");

  const vertShader = createShader(gl, gl.VERTEX_SHADER, await readShader("vert"));
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, await readShader("frag"));
  const program = createProgram(gl, vertShader, fragShader);

  const a_position = gl.getAttribLocation(program, "a_position");
  const a_uv = gl.getAttribLocation(program, "a_uv");

  const u_resolution = gl.getUniformLocation(program, "u_resolution");
  const u_time = gl.getUniformLocation(program, "u_time");
  const u_dt = gl.getUniformLocation(program, "u_dt");
  const u_mazeTexture = gl.getUniformLocation(program, "u_mazeTexture");
  const u_playerPosition = gl.getUniformLocation(program, "u_playerPosition");
  const u_cameraMode = gl.getUniformLocation(program, "u_cameraMode");
  const u_cameraRotation = gl.getUniformLocation(program, "u_cameraRotation");

  // Créer et charger la texture de la matrice
  const mazeTexture = createMazeTexture(gl, maze);

  gl.useProgram(program); // Utiliser le programme avant de définir les uniformes
  gl.activeTexture(gl.TEXTURE0); // Assure que TEXTURE0 est activée
  gl.bindTexture(gl.TEXTURE_2D, mazeTexture);
  gl.uniform1i(u_mazeTexture, 0); // Lier l'uniforme à l'unité de texture 0

  // Préparer les données pour le rendu
  const data = new Float32Array([
    // x    y       u    v
    -1.0, -1.0,   0.0, 0.0,
     1.0, -1.0,   1.0, 0.0,
     1.0,  1.0,   1.0, 1.0,
    -1.0,  1.0,   0.0, 1.0,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(a_position);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.enableVertexAttribArray(a_uv);
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

  const ebo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // Position du joueur
  let playerPosition = { x: 1.5, y: 0.5, z: 1.5 }; // Position de départ
  const playerSpeed = 2.0; // Vitesse de déplacement

  // Caméra
  let cameraMode = 'overhead'; // 'overhead' ou 'first-person'
  let cameraYaw = 0.0;
  let cameraPitch = 0.0;

  // Contrôles
  let isPointerLocked = false;
  let isTouchMoving = false;
  let lastTouchX = 0;
  let lastTouchY = 0;

  const canvasContainer = document.getElementById('canvas-container');

  // Fonction pour redimensionner le canvas
  function resizeCanvas() {
    const scale = window.devicePixelRatio > 1 ? 0.5 : 1;
    canvas.width = Math.floor(canvas.clientWidth * scale);
    canvas.height = Math.floor(canvas.clientHeight * scale);
  }
  
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas(); // Appel initial

  // Variables pour suivre l'état des boutons
  const buttonStates = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  // Variables pour suivre l'état des touches
  const keyStates = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    z: false,
    q: false,
    s: false,
    d: false,
    Z: false,
    Q: false,
    S: false,
    D: false,
  };

  // Fonction pour gérer les états des boutons
  const setButtonState = (buttonName, isPressed) => {
    buttonStates[buttonName] = isPressed;
  };

  // Écouteurs d'événements pour les boutons
  const addButtonEventListener = (id, buttonName) => {
    const button = document.getElementById(id);
    button.addEventListener('mousedown', (event) => {
      setButtonState(buttonName, true);
      event.preventDefault();
    });
    button.addEventListener('mouseup', (event) => {
      setButtonState(buttonName, false);
      event.preventDefault();
    });
    button.addEventListener('mouseleave', (event) => {
      setButtonState(buttonName, false);
      event.preventDefault();
    });
    button.addEventListener('touchstart', (event) => {
      setButtonState(buttonName, true);
      event.preventDefault();
    });
    button.addEventListener('touchend', (event) => {
      setButtonState(buttonName, false);
      event.preventDefault();
    });
    button.addEventListener('touchcancel', (event) => {
      setButtonState(buttonName, false);
      event.preventDefault();
    });
  };

  addButtonEventListener('btn-up', 'up');
  addButtonEventListener('btn-down', 'down');
  addButtonEventListener('btn-left', 'left');
  addButtonEventListener('btn-right', 'right');

  addButtonEventListener('btn-arrow-up', 'up');
  addButtonEventListener('btn-arrow-down', 'down');
  addButtonEventListener('btn-arrow-left', 'left');
  addButtonEventListener('btn-arrow-right', 'right');

  // Écouteur pour le bouton de changement de caméra
  const switchCameraButton = document.getElementById('btn-switch-camera');
  switchCameraButton.addEventListener('click', () => {
    cameraMode = (cameraMode === 'overhead') ? 'first-person' : 'overhead';
  });
  switchCameraButton.addEventListener('touchstart', (event) => {
    cameraMode = (cameraMode === 'overhead') ? 'first-person' : 'overhead';
    event.preventDefault();
  });

  function movePlayer(dx, dz) {
    const newX = playerPosition.x + dx * playerSpeed * time.dt();
    const newZ = playerPosition.z + dz * playerSpeed * time.dt();

    // Vérifier les collisions avec les murs
    if (!isCollision(newX, newZ)) {
      playerPosition.x = newX;
      playerPosition.z = newZ;
    }
  }

  function isCollision(x, z) {
    // Convertir x, z en coordonnées de grille
    const mazeX = Math.floor(x);
    const mazeZ = Math.floor(z);

    // Vérifier les limites
    if (mazeX < 0 || mazeX >= maze[0].length || mazeZ < 0 || mazeZ >= maze.length) {
      return true; // Hors limites, considérer comme une collision
    }

    // Vérifier si la cellule est un mur
    return maze[mazeZ][mazeX] === 1;
  }

  // Entrée clavier
  document.addEventListener('keydown', (event) => {
    if (cameraMode !== 'overhead') return; // Déplacement uniquement en mode overhead
    if (keyStates.hasOwnProperty(event.key)) {
      keyStates[event.key] = true;
      event.preventDefault();
    }
  });

  document.addEventListener('keyup', (event) => {
    if (keyStates.hasOwnProperty(event.key)) {
      keyStates[event.key] = false;
      event.preventDefault();
    }
  });

  // Mouvement de la souris pour la caméra en première personne
  canvas.addEventListener('click', () => {
    if (cameraMode === 'first-person') {
      if ('ontouchstart' in window) {
        // Sur les appareils tactiles, démarrer le mouvement tactile
        isTouchMoving = true;
      } else {
        // Sur ordinateur, demander le verrouillage du pointeur
        canvas.requestPointerLock();
      }
    }
  });

  // Événements tactiles pour le contrôle de la caméra
  canvas.addEventListener('touchstart', (event) => {
    if (cameraMode === 'first-person') {
      isTouchMoving = true;
      const touch = event.touches[0];
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      event.preventDefault();
    }
  });

  canvas.addEventListener('touchmove', (event) => {
    if (cameraMode !== 'first-person' || !isTouchMoving) return;
    const touch = event.touches[0];
    const movementX = touch.clientX - lastTouchX;
    const movementY = touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    cameraYaw -= movementX * 0.005; // Ajuster la sensibilité si nécessaire
    cameraPitch -= movementY * 0.005;

    // Limiter l'angle de la caméra
    const maxPitch = Math.PI / 2 - 0.01;
    cameraPitch = Math.max(-maxPitch, Math.min(maxPitch, cameraPitch));

    event.preventDefault();
  });

  canvas.addEventListener('touchend', (event) => {
    isTouchMoving = false;
    event.preventDefault();
  });

  // Écouteur pour le changement du verrouillage du pointeur
  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', (event) => {
    if (cameraMode !== 'first-person' || !isPointerLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    cameraYaw -= movementX * 0.002;
    cameraPitch -= movementY * 0.002;

    // Limiter l'angle de la caméra
    const maxPitch = Math.PI / 2 - 0.01;
    cameraPitch = Math.max(-maxPitch, Math.min(maxPitch, cameraPitch));
  });

  function loop() {
    resizeCanvas(); // Assurer que la taille du canvas est à jour

    // Déplacer le joueur si des boutons ou des touches sont enfoncés
    if (cameraMode === 'overhead') {
      let dx = 0;
      let dz = 0;

      // Contrôles via les boutons HTML
      if (buttonStates.up) dz += 1;
      if (buttonStates.down) dz -= 1;
      if (buttonStates.left) dx -= 1;
      if (buttonStates.right) dx += 1;

      // Contrôles via le clavier
      if (keyStates.ArrowUp || keyStates.z || keyStates.Z) dz += 1;
      if (keyStates.ArrowDown || keyStates.s || keyStates.S) dz -= 1;
      if (keyStates.ArrowLeft || keyStates.q || keyStates.Q) dx -= 1;
      if (keyStates.ArrowRight || keyStates.d || keyStates.D) dx += 1;

      // Normaliser le déplacement
      if (dx !== 0 || dz !== 0) {
        const length = Math.sqrt(dx * dx + dz * dz);
        dx /= length;
        dz /= length;
        movePlayer(dx, dz);
      }
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindVertexArray(vao);
    gl.useProgram(program);
    gl.uniform2f(u_resolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(u_time, time.t);
    gl.uniform1f(u_dt, time.dt());
    gl.uniform1i(u_mazeTexture, 0); // Lier la texture du labyrinthe
    gl.uniform3f(u_playerPosition, playerPosition.x, playerPosition.y, playerPosition.z);
    gl.uniform1i(u_cameraMode, cameraMode === 'overhead' ? 0 : 1);
    gl.uniform2f(u_cameraRotation, cameraYaw, cameraPitch);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    time.update();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', main);
