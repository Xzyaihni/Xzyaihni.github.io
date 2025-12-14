const v_shader = `#version 300 es

in vec4 a_vertex_position;

void main()
{
    gl_Position = a_vertex_position;
}`;
const f_shader = `#version 300 es

#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif

out vec4 frag_color;

const ivec2 CANVAS_DIMENSIONS = ivec2(640, 640);

uniform vec2 pos;
uniform float zoom;

float mandelbrot(vec2 pixel)
{
    float z_real = 0.0;
    float z_imag = 0.0;

    const int ITERATIONS = 250;
    for(int i = 0; i <= ITERATIONS; ++i)
    {
        float new_z_real = z_real * z_real - z_imag * z_imag;
        z_imag = z_real * z_imag * 2.0;

        z_real = new_z_real;

        if (abs(z_real + z_imag) > 4.0)
        {
            return float(i) / float(ITERATIONS);
        }

        z_real += (pixel.x - 0.5) * zoom + pos.x;
        z_imag += (pixel.y - 0.5) * zoom + pos.y;
    }

    return 1.0;
}

float lab_f(float t)
{
    float delta = 6.0 / 29.0;
    if (t > delta)
    {
        return t * t * t;
    } else
    {
        return 3.0 * delta * delta * (t - 4.0 / 29.0);
    }
}

void main()
{
    vec2 pixel = gl_FragCoord.xy / vec2(CANVAS_DIMENSIONS);

    float depth = mandelbrot(pixel);

    vec3 lch = vec3(min(100.0, pow(depth, 2.0) * 5000.0), 100.0, log(depth) * 10.0);

    if (depth == 1.0)
    {
        lch.x = 40.0;
        lch.z = pow(abs(cos((pixel.x - 0.5) * zoom + pos.x)) * 3.0 + abs(sin((pixel.y - 0.5) * zoom + pos.y)) * 0.5, 3.0);
    }

    vec3 lab = vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z));

    float l16 = lab.x + 16.0;
    vec3 xyz = vec3(
        95.0489 * lab_f(l16 / 116.0 + lab.y / 500.0),
        100.0 * lab_f(l16 / 116.0),
        108.8840 * lab_f(l16 / 116.0 - lab.z / 200.0)
    );

    vec3 color = abs(mat3(
        vec3(3.2404542, -0.9692660, 0.0556434),
        vec3(-1.5371385, 1.8760108, -0.2040259),
        vec3(-0.4985314, 0.0415560, 1.0572252)
    ) * xyz / 255.0);

    frag_color = vec4(color, 1.0);
}`;
const canvas = document.getElementById("display_canvas");
const gl = canvas.getContext("webgl2");

let pos = [-1.0, 0.0];
let zoom = 3.0;

let program_info = null;

let previous_frame_time = 0.0;

let keys_pressed = {
    left: false,
    right: false,
    up: false,
    down: false,
    zoom_in: false,
    zoom_out: false
};

document.addEventListener("DOMContentLoaded", main);

document.addEventListener("keydown", on_key_down);
document.addEventListener("keyup", on_key_up);

function array_add(a, b)
{
    return a.map((x, i) => x + b[i]);
}

function array_sub(a, b)
{
    return a.map((x, i) => x - b[i]);
}

function array_mul(a, s)
{
    return a.map((x) => x * s);
}

function array_div(a, s)
{
    return a.map((x) => x / s);
}

function array_negate(a)
{
    return a.map((x) => -x);
}

function main()
{
    if (gl === null)
    {
        alert("nyo opengl im so sowy 😭");
        return;
    } else
    {
        initialize_scene();
    }
}

function get_key_changer(e)
{
    switch (e.code)
    {
        case "KeyW":
          return (x) => { keys_pressed.up = x };

        case "KeyS":
          return (x) => { keys_pressed.down = x };

        case "KeyA":
          return (x) => { keys_pressed.left = x };

        case "KeyD":
          return (x) => { keys_pressed.right = x };

        case "KeyZ":
          return (x) => { keys_pressed.zoom_in = x };

        case "KeyX":
          return (x) => { keys_pressed.zoom_out = x };

        default:
          return (_) => {};
    }
}

function on_key_down(e)
{
    get_key_changer(e)(true);
}

function on_key_up(e)
{
    get_key_changer(e)(false);
}

function movement_directions(dt)
{
    const speed = 0.625 * zoom;
    const zoom_speed = 0.7;

    let moved = false;

    if (keys_pressed.left)
    {
        moved = true;
        pos[0] -= speed * dt;
    }

    if (keys_pressed.right)
    {
        moved = true;
        pos[0] += speed * dt;
    }

    if (keys_pressed.up)
    {
        moved = true;
        pos[1] -= speed * dt;
    }

    if (keys_pressed.down)
    {
        moved = true;
        pos[1] += speed * dt;
    }

    if (keys_pressed.zoom_in)
    {
        moved = true;
        zoom *= Math.pow(zoom_speed, dt);
    }

    if (keys_pressed.zoom_out)
    {
        moved = true;
        zoom /= Math.pow(zoom_speed, dt);
    }

    return moved;
}

function handle_movement_inputs(dt)
{
    const moved = movement_directions(dt);

    if (!moved)
    {
        return;
    }

    draw_frame();
}

function handle_inputs(dt)
{
    handle_movement_inputs(dt);
}

function draw_frame()
{
    bind_uniforms();

    //draw the rectangle with everything on it
    //0 offset 4 vertices
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function update_frame(current_time)
{
    const dt = Math.min(current_time - previous_frame_time, (1000.0 / 30.0)) * 0.001;
    previous_frame_time = current_time;

    handle_inputs(dt);

    requestAnimationFrame(update_frame);
}

function bind_uniforms()
{
    if (program_info === null)
    {
        return null;
    }

    gl.uniform2fv(program_info.uniform_locations.pos, pos);
    gl.uniform1f(program_info.uniform_locations.zoom, zoom);
}

function initialize_scene()
{
    program_info = attributes_info();
    if (program_info === null)
    {
        return;
    }

    const buffer = init_default_buffer(program_info);

    gl.useProgram(program_info.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    //default but still
    gl.frontFace(gl.CCW);

    if (bind_uniforms() === null)
    {
        alert("error when binding uniforms");

        return;
    }

    draw_frame();

    requestAnimationFrame(update_frame);
}

function init_default_buffer(program_info)
{
    const position_buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);

    const positions = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(
        program_info.attribute_locations.vertex_position,
        2, //positions per vertex
        gl.FLOAT,
        false, //no normalization
        0, //calculate stride automatically
        0 //no offset
    );

    gl.enableVertexAttribArray(program_info.attribute_locations.vertex_position);

    return position_buffer;
}

function attributes_info()
{
    const shader_program = load_program();
    if (shader_program === null)
    {
        return null;
    }

    const get_attrib = name => gl.getAttribLocation(shader_program, name);

    const program_info =
    {
        program: shader_program,
        attribute_locations:
        {
            vertex_position: get_attrib("a_vertex_position")
        },
        uniform_locations: {}
    };

    const add_uniform = name =>
    {
        program_info.uniform_locations[name] = gl.getUniformLocation(shader_program, name);
    };

    add_uniform("pos");
    add_uniform("zoom");

    return program_info;
}

function load_program()
{
    const vertex_shader = load_shader(v_shader, gl.VERTEX_SHADER);
    const fragment_shader = load_shader(f_shader, gl.FRAGMENT_SHADER);

    if (vertex_shader === null || fragment_shader === null)
    {
        return null;
    }

    const shader_program = gl.createProgram();
    gl.attachShader(shader_program, vertex_shader);
    gl.attachShader(shader_program, fragment_shader);
    gl.linkProgram(shader_program);

    if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS))
    {
        const program_log = gl.getProgramInfoLog(shader_program);
        alert(`error linking shader program 😭: ${program_log}`);

        return null;
    } else
    {
        return shader_program;
    }
}

function load_shader(source, type)
{
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    {
        let type_stringified = "unknown";
        if (type === gl.VERTEX_SHADER)
        {
            type_stringified = "vertex";
        } else if (type === gl.FRAGMENT_SHADER)
        {
            type_stringified = "fragment";
        }

        const shader_log = gl.getShaderInfoLog(shader);
        alert(`error compiling shader 😭 (${type_stringified} type): ${shader_log}`);

        gl.deleteShader(shader);
        return null;
    } else
    {
        return shader;
    }
}
