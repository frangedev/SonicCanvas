precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_amplitude;
uniform float u_tempo;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(uv, center);
  float angle = atan(uv.y - center.y, uv.x - center.x);
  
  // Swirling pattern influenced by amplitude and tempo
  float swirl = sin(dist * 10.0 - u_time * u_tempo) * u_amplitude * 5.0;
  angle += swirl;
  
  // Color based on audio
  vec3 color = vec3(
    sin(angle + u_time) * 0.5 + 0.5,
    cos(dist * 10.0 + u_time) * 0.5 + 0.5,
    sin(u_amplitude * 20.0 + u_tempo) * 0.5 + 0.5
  );
  
  gl_FragColor = vec4(color, 1.0);
}