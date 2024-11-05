# AICGraymarching
 1st experience of Raymarching for an AICH Course
This project is an interactive web application that displays a 3D maze generated in real-time using the Ray Marching technique with WebGL2. Users can explore the maze from an overhead view or a first-person perspective, with controls adapted for desktop and mobile devices.

Features:
    Real-time Ray Marching: Renders the maze in 3D using Signed Distance Functions (SDF).
    Two camera modes:
        Overhead View: A top-down view of the maze, allowing the player cube to be moved.
        First-Person View: Immersion in the maze, with camera control via mouse or touch.
    Interactive Controls:
        Keyboard: Use the ZQSD keys,arrow keys to move the cube in the overhead perspective.
        HTML Buttons: Touch controls for mobile devices.
        Camera Control: Mouse or finger movement to orient the camera in first-person view.

Visual Effects:
Dynamic Color Palette: The colors of objects vary based on light intensity.
Fog: Limits visibility in overhead view to areas close to the player cube.
Distance-based Lighting: Objects change color based on their proximity to the light source.


Usage
Overhead Mode:
    Move the cube:
        Keyboard: Use the Z, Q, S, D keys or arrow keys.
        Buttons: Click or tap the on-screen buttons.
        Change camera: Click the "Change Camera" button to switch to first-person view.
First-Person Mode:
    Camera control:
        Desktop: Click on the canvas to activate camera control, then move the mouse.
        Mobile: Touch the canvas to activate control, then move your finger to orient the camera.
        Change camera: Click the "Change Camera" button again to return to overhead view.


Code Structure
    index.html: Contains the HTML structure of the page, interactive elements, and embedded CSS style.
    script.js: Contains the main JavaScript code, handles events, controls, and WebGL initialization.
    shader.vert: Vertex shader in GLSL ES, passes positions and texture coordinates.
    shader.frag: Fragment shader in GLSL ES, implements Ray Marching and visual effects.
    maze: The maze is defined as a matrix in script.js and converted into a texture for use in the shaders.

Code Explanation

    In this project, the fragment shader (shader.frag) implements Ray Marching to render the maze in 3D. The walls of the maze and the player cube are defined using simple SDFs like boxes (boxSDF) and planes (planeSDF) with some spheres(sdp_sphere) to add some more animations.

Controls and Interactions
    The JavaScript code (script.js) handles user interactions:

Player Controls: Keyboard inputs and HTML buttons update the player's state.
    Continuous Movement: By monitoring the state of keys and buttons, the player can move smoothly.
    Camera Control: Mouse or touch movements adjust the camera orientation in first-person view.

Visual Effects
    Dynamic Color Palette: The palette function in the fragment shader generates colors based on light intensity, creating variations in shades based on distance to the light.
    Fog: A fog effect is applied in overhead view to limit visibility to areas close to the player cube.
    Distance-based Lighting: The intensity of light decreases with distance, following the inverse-square law, affecting the color and brightness of objects.

Inspirations : 
    An introduction to Ray Marching: https://www.youtube.com/watch?v=khblXafu7iA&ab_channel=kishimisu
    Basic primitives for Ray marching: https://iquilezles.org/articles/distfunctions/
    Smin for for some interesting interactions between objects: https://iquilezles.org/articles/smin/