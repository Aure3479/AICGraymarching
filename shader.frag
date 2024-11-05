#version 300 es
precision highp float;

#define EPS         0.001
#define N_MAX_STEPS 80
#define MAX_DIST    100.0

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dt;
uniform sampler2D u_mazeTexture; // Texture de matrice pour le labyrinthe

uniform vec3 u_playerPosition;
uniform int u_cameraMode; // 0 pour overhead, 1 pour first-person
uniform vec2 u_cameraRotation; // [yaw, pitch]

in vec2 f_uv;
out vec4 outColor;

float boxSDF(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float planeSDF(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}

float smin(float a, float b, float k) {
    k = max(k, 0.0001);
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float mazeSize = 8.0;

float sdf_scene(vec3 p) {
    float sceneDistance = MAX_DIST; // Distance initiale élevée

    // Parcourir la matrice pour positionner les cubes (murs)
    for (int x = 0; x < int(mazeSize); x++) {
        for (int z = 0; z < int(mazeSize); z++) {
            // Obtenir la valeur de la cellule de la matrice
            float cellValue = texture(u_mazeTexture, vec2(float(x) + 0.5, float(z) + 0.5) / mazeSize).r;

            if (cellValue > 0.5) { // Si la cellule est un mur (valeur 1 dans la matrice)
                vec3 cubePos = vec3(float(x) + 0.5, 0.5, float(z) + 0.5);

                // Distance au cube (mur)
                float dCube = boxSDF(p - cubePos, vec3(0.5));

                // Prendre la distance minimale pour la scène
                sceneDistance = min(sceneDistance, dCube);
            }
        }
    }

    // Ajouter le joueur (cube)
    float dPlayer = boxSDF(p - u_playerPosition, vec3(0.3));
    sceneDistance = min(sceneDistance, dPlayer);

    // Ajouter un sol
    float dFloor = planeSDF(p, vec3(0.0, 1.0, 0.0), 0.0);
    sceneDistance = min(sceneDistance, dFloor);

    return sceneDistance;
}

float ray_march(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < N_MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        float d = sdf_scene(p);
        t += d;
        if (d < EPS || t > MAX_DIST) break;
    }
    return t;
}

vec3 approx_normal(vec3 p) {
    vec2 eps = vec2(EPS, -EPS);
    return normalize(
        eps.xyy * sdf_scene(p + eps.xyy) +
        eps.yyx * sdf_scene(p + eps.yyx) +
        eps.yxy * sdf_scene(p + eps.yxy) +
        eps.xxx * sdf_scene(p + eps.xxx)
    );
}

void main() {
    vec2 uv = (f_uv - 0.5) * 2.0; // UV variant de -1 à 1

    vec3 ro;
    vec3 rd;

    if (u_cameraMode == 0) {
        // Caméra overhead
        float viewSize = mazeSize * 1.2; // Ajuster si nécessaire
        ro = vec3(
            uv.x * viewSize / 2.0 + mazeSize / 2.0,
            mazeSize * 1.5,
            uv.y * viewSize / 2.0 + mazeSize / 2.0
        );
        rd = vec3(0.0, -1.0, 0.0); // Direction verticale vers le bas
    } else {
        // Caméra en première personne à la position du joueur
        ro = u_playerPosition + vec3(0.0, 1.0, 0.0); // Caméra à 1 unité au-dessus du joueur

        // Calculer rd à partir de la rotation de la caméra
        float yaw = u_cameraRotation.x;
        float pitch = u_cameraRotation.y;

        vec3 forward = vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
        vec3 right = vec3(cos(yaw), 0.0, -sin(yaw));
        vec3 up = vec3(0.0, 1.0, 0.0);

        rd = normalize(forward + uv.x * right + uv.y * up);
    }

    vec3 col = vec3(0.0);

    vec3 l_pos = u_playerPosition + vec3(0.0, 0.5, 0.0); // Lumière à la position du joueur
    vec3 l_col = vec3(1.0, 1.0, 0.8);

    float t = ray_march(ro, rd);
    if (t <= MAX_DIST) {
        vec3 p = ro + rd * t;

        vec3 n = approx_normal(p);

        // Éclairage
        vec3 l_dir = normalize(l_pos - p);
        float diff = max(0.0, dot(n, l_dir));

        // Lumière spéculaire
        vec3 viewDir = normalize(ro - p);
        vec3 reflectDir = reflect(-l_dir, n);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);
        vec3 specular = spec * l_col;

        // Déterminer quel objet a été touché
        float dPlayer = boxSDF(p - u_playerPosition, vec3(0.3));
        float dScene = sdf_scene(p);

        if (abs(dPlayer - dScene) < EPS) {
            // On a touché le cube joueur
            col = l_col;
        } else {
            // On a touché d'autres objets
            col = (diff) * vec3(0.8, 0.8, 0.8) + specular;

            // En vue première personne, changer la couleur en fonction de la proximité
            if (u_cameraMode == 1) {
                float distanceToCamera = length(p - ro);
                float maxDistance = 5.0; // Distance maximale pour l'effet
                float proximityFactor = clamp(1.0 - (distanceToCamera / maxDistance), 0.0, 1.0);

                // Modifier la couleur en fonction de proximityFactor
                vec3 closeColor = vec3(1.0, 0.0, 0.0); // Rouge pour les objets proches
                vec3 farColor = vec3(0.8, 0.8, 0.8);   // Gris pour les objets éloignés

                col = mix(farColor, closeColor, proximityFactor) * diff + specular;
            }
        }

        // Appliquer le brouillard en vue overhead
        if (u_cameraMode == 0) {
            float distanceToPlayer = length(p - u_playerPosition);
            float fogDistance = 5.0; // Distance à laquelle le brouillard commence
            float fogFactor = clamp(1.0 - (distanceToPlayer / fogDistance), 0.0, 1.0);
            col *= fogFactor;
        }

    } else {
        // Couleur de fond (ciel)
        col = vec3(0.0); // Noir
    }

    col = pow(col, vec3(0.4545));
    outColor = vec4(col, 1.0);
}
