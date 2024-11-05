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

// fonctions pour les formes primitives  SDF en Raymarching (source: https://iquilezles.org/articles/distfunctions/)

float boxSDF(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float planeSDF(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}
float sdp_sphere(vec3 p, float r) {
    return length(p) - r;
}

// fonctions pour un mélange interéssant entre 2 forms SDF (source: https://iquilezles.org/articles/smin/)
float smin(float a, float b, float k) {
    k = max(k, 0.0001);
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}
float mazeSize = 8.0;

float sdf_scene(vec3 p) {
     float sceneDistance = MAX_DIST; // Distance initiale élevée

    // Calculer les indices de la grille
    int gridX = int(floor(p.x));
    int gridZ = int(floor(p.z));

    // Limiter les indices au labyrinthe
    int minX = max(gridX - 1, 0);
    int maxX = min(gridX + 1, int(mazeSize) - 1);
    int minZ = max(gridZ - 1, 0);
    int maxZ = min(gridZ + 1, int(mazeSize) - 1);

    // Parcourir uniquement les cellules proches
    for (int x = minX; x <= maxX; x++) {
        for (int z = minZ; z <= maxZ; z++){
            // Obtenir la valeur de la cellule de la matrice
            float cellValue = texture(u_mazeTexture, vec2(float(x) + 0.5, float(z) + 0.5) / mazeSize).r;

            if (cellValue > 0.5) { // Si la cellule est un mur (valeur 1 dans la matrice)
                vec3 cubePos = vec3(float(x) + 0.5, 0.5, float(z) + 0.5);

                // Distance au cube (mur)
                float dCube = boxSDF(p - cubePos, vec3(0.5));

                // Ajouter une sphère mobile au-dessus du cube
                float yOffset = sin(u_time + float(x + z)) * (0.5*(float(z)+1.0)) + 0.20; // Mouvement vertical oscillant
                vec3 spherePos = cubePos + vec3(0.0, yOffset, 0.0);
                float dSphere = sdp_sphere(p - spherePos, 0.3);

                // Fusionner le cube et la sphère
                float dCombined = smin(dCube, dSphere, 0.7); // Le 3e element permet de contrôler l'intensité du mélange

                // Prendre la distance minimale pour la scène
                sceneDistance = min(sceneDistance, dCube);
                sceneDistance = min(sceneDistance, dCombined);
            }
        }
    }

    // Ajouter le joueur (cube)
    float dPlayer = boxSDF(p - u_playerPosition, vec3(0.1));
    sceneDistance = min(sceneDistance, dPlayer);

    // Ajouter un sol
    float dFloor = planeSDF(p, vec3(0.0, 1.0, 0.0), 0.0);
    sceneDistance = smin(sceneDistance, dFloor, 0.15);

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

// Fonction pour appliquer une palette de couleurs
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.00, 0.33, 0.67); // Ajuster si nécessaire

    return a + b * cos(6.28318 * (c * t + d));
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

        // Direction de la lumière et intensité
        vec3 l_dir = normalize(l_pos - p);
        float distanceToLight = length(l_pos - p);
        float lightIntensity = 1.0 / (distanceToLight * distanceToLight); // Loi de l'inverse du carré
        lightIntensity = clamp(lightIntensity, 0.0, 1.0); // Limiter entre [0,1]

        float diff = max(0.0, dot(n, l_dir)) * lightIntensity;

        // Lumière spéculaire
        vec3 viewDir = normalize(ro - p);
        vec3 reflectDir = reflect(-l_dir, n);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0) * lightIntensity;
        vec3 specular = spec * l_col;

        // Déterminer quel objet a été touché
        float dPlayer = boxSDF(p - u_playerPosition, vec3(0.3));
        float dScene = sdf_scene(p);

        // Utiliser la palette basée sur l'intensité lumineuse
        float tColor = lightIntensity; // Utiliser lightIntensity pour varier la couleur
        vec3 objectColor = palette(tColor);

        if (abs(dPlayer - dScene) < EPS) {
            // On a touché le cube joueur
            col = l_col * lightIntensity;
        } else {
            // On a touché d'autres objets
            col = (diff * objectColor) + specular;

            // En vue première personne, changer la couleur en fonction de la proximité
            if (u_cameraMode == 1) {
                float distanceToCamera = length(p - ro);
                float maxDistance = 5.0; // Distance maximale pour l'effet
                float proximityFactor = clamp(1.0 - (distanceToCamera / maxDistance), 0.0, 1.0);

                // Modifier la couleur en fonction de proximityFactor
                vec3 closeColor = vec3(1.0, 0.0, 0.0); // Rouge pour les objets proches
                vec3 farColor = objectColor;           // Couleur originale

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
