// hero.glsl
// Upgraded "Neural Nexus" Shader for GEKRO.COM

#ifdef VERTEX
varying vec3 vColor;
varying float vAlpha;

uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform float uPixelRatio;

attribute float aSize;
attribute vec3 aColor;

// Simple 3D Noise function for organic movement
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

void main() {
    vColor = aColor;
    
    vec3 pos = position;
    
    // Organic Noise Displacement
    float n = noise(pos * 0.1 + uTime * 0.3);
    pos += normal * n * 2.0;
    
    // Flow Field
    pos.x += sin(uTime * 0.1 + pos.z * 0.2) * 2.0;
    pos.y += cos(uTime * 0.15 + pos.x * 0.2) * 2.0;
    
    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    
    // Smooth Mouse Interaction (Ripple Effect)
    float dist = distance(modelPosition.xyz, vec3(uMouse * 20.0, 0.0));
    float wave = sin(dist * 0.5 - uTime * 5.0) * 0.5 + 0.5;
    float ripple = smoothstep(15.0, 0.0, dist);
    modelPosition.xyz += normalize(modelPosition.xyz - vec3(uMouse * 20.0, 0.0)) * ripple * wave * 5.0;
    
    // Scroll Morph (Implosion + Rotation)
    float scrollFactor = uScroll * 1.2;
    modelPosition.xyz *= (1.0 - scrollFactor);
    
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectionPosition;
    
    // Enhanced Size Attenuation
    gl_PointSize = aSize * uPixelRatio * 80.0;
    gl_PointSize *= (1.0 / -viewPosition.z);
    
    // Fade out as they get closer to the camera or further away
    vAlpha = smoothstep(50.0, 10.0, abs(viewPosition.z));
}
#endif

#ifdef FRAGMENT
varying vec3 vColor;
varying float vAlpha;

void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    
    // Multi-layered glow
    float core = smoothstep(0.5, 0.2, dist);
    float glow = pow(1.0 - dist * 2.0, 4.0);
    
    vec3 finalColor = mix(vColor, vec3(1.0), core * 0.5);
    gl_FragColor = vec4(finalColor, (core + glow) * vAlpha * 0.8);
}
#endif
