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
  [1, 1, 1, 0, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 1],
  [1, 1, 1, 0, 1, 1, 0, 1],
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
  let cameraYaw = 0;
  let cameraPitch = 0;

  // Écouteurs d'événements pour les boutons
  document.getElementById('btn-up').addEventListener('click', () => movePlayer(0, -1));
  document.getElementById('btn-down').addEventListener('click', () => movePlayer(0, 1));
  document.getElementById('btn-left').addEventListener('click', () => movePlayer(-1, 0));
  document.getElementById('btn-right').addEventListener('click', () => movePlayer(1, 0));

  document.getElementById('btn-arrow-up').addEventListener('click', () => movePlayer(0, -1));
  document.getElementById('btn-arrow-down').addEventListener('click', () => movePlayer(0, 1));
  document.getElementById('btn-arrow-left').addEventListener('click', () => movePlayer(-1, 0));
  document.getElementById('btn-arrow-right').addEventListener('click', () => movePlayer(1, 0));

  document.getElementById('btn-switch-camera').addEventListener('click', () => {
    cameraMode = (cameraMode === 'overhead') ? 'first-person' : 'overhead';
  });

  function movePlayer(dx, dz) {
    // Déplacement uniquement en mode overhead
    if (cameraMode !== 'overhead') return;

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

    switch (event.key) {
      case 'z':
      case 'Z':
      case 'ArrowUp':
        movePlayer(0, -1);
        break;
      case 's':
      case 'S':
      case 'ArrowDown':
        movePlayer(0, 1);
        break;
      case 'q':
      case 'Q':
      case 'ArrowLeft':
        movePlayer(-1, 0);
        break;
      case 'd':
      case 'D':
      case 'ArrowRight':
        movePlayer(1, 0);
        break;
    }
  });

  // Mouvement de la souris pour la caméra en première personne
  let isPointerLocked = false;

  canvas.addEventListener('click', () => {
    if (cameraMode === 'first-person' && !isPointerLocked) {
      canvas.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', (event) => {
    if (cameraMode !== 'first-person' || !isPointerLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    cameraYaw += movementX * 0.002;
    cameraPitch -= movementY * 0.002;

    // Limiter l'angle de la caméra
    const maxPitch = Math.PI / 2 - 0.01;
    cameraPitch = Math.max(-maxPitch, Math.min(maxPitch, cameraPitch));
  });

  function loop() {
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

