import { type Cleanup, fitCanvas, loopWhileVisible, on } from './util'

/*
 * The hero's silk ribbon, drawn in a fragment shader: a band that sweeps from the top middle of the page
 * to the bottom right, widening as it falls, with a second fold riding over it. Color runs across the
 * band (lavender → violet → magenta → coral → orange → gold) and fine striations run along it, which is
 * what gives the reference's ribbon its brushed-silk look. The CSS painting under the canvas stays as the
 * fallback when WebGL is unavailable.
 */

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

const FRAG = `precision highp float;
uniform vec2 res;uniform float t;
vec3 pal(float x){
  x=clamp(x,0.,1.);
  vec3 a=vec3(.62,.68,1.);vec3 b=vec3(.58,.38,1.);vec3 c=vec3(.98,.40,.90);
  vec3 d=vec3(1.,.42,.40);vec3 e=vec3(1.,.55,.14);vec3 f=vec3(1.,.78,.28);
  if(x<.2)return mix(a,b,x/.2);
  if(x<.4)return mix(b,c,(x-.2)/.2);
  if(x<.6)return mix(c,d,(x-.4)/.2);
  if(x<.8)return mix(d,e,(x-.6)/.2);
  return mix(e,f,(x-.8)/.2);
}
vec4 band(vec2 uv,float off,float wid,float ph,float hueShift){
  float v=uv.y;
  float aspect=res.x/res.y;
  off+=aspect<1.?.14:0.;
  float xc=mix(.50+off,1.0+off,pow(v,1.05))+.035*sin(v*3.1+t*.35+ph);
  float w=mix(.17,.44,v)*wid*(1.+.08*sin(v*5.+t*.4+ph));
  float s=(uv.x-xc)/w;
  float a=smoothstep(1.,.9,abs(s));
  float k=(s+1.)*.5;
  float twist=.5+.5*cos(v*4.2-t*.3+ph+s*1.3);
  vec3 col=pal(k*.85+hueShift+(1.-v)*.18);
  float stri=.5+.5*sin(s*70.+v*9.+t*.6);
  col*=.96+.04*stri;
  col=mix(col,col*.78,(1.-twist)*.35);
  col=mix(col,vec3(1.),pow(1.-k,4.)*.3);
  a*=mix(.8,1.,k)*smoothstep(-.05,.18,v+.12);
  return vec4(col,a);
}
void main(){
  vec2 uv=vec2(gl_FragCoord.x/res.x,1.-gl_FragCoord.y/res.y);
  vec4 back=band(uv,.0,1.,0.,.0);
  vec4 front=band(uv,.07,.55,2.1,.12);
  vec3 col=mix(back.rgb,front.rgb,front.a);
  float a=max(back.a,front.a);
  gl_FragColor=vec4(col*a,a);
}`

export function initWave(root: HTMLElement): Cleanup {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-hp-wave]')
  if (!canvas) return () => {}
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true })
  if (!gl) return () => {}

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return () => {}
  // A software renderer draws the shader on the CPU: keep the CSS painting instead.
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
  if (/swiftshader|llvmpipe|software/i.test(renderer)) return () => {}
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const uRes = gl.getUniformLocation(prog, 'res')
  const uT = gl.getUniformLocation(prog, 't')

  let size: [number, number, number] = fitCanvas(canvas, 0.75)
  const offResize = on(window, 'resize', () => (size = fitCanvas(canvas, 0.75)))
  const stop = loopWhileVisible(canvas, (t) => {
    gl.viewport(0, 0, size[0], size[1])
    gl.uniform2f(uRes, size[0], size[1])
    gl.uniform1f(uT, t)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    canvas.dataset.drawn = 'true'
  })
  return () => {
    stop()
    offResize()
  }
}
