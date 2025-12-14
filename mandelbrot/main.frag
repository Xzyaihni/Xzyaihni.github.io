#version 300 es

#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif

out vec4 frag_color;

uniform vec2 canvas_dimensions;

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
    vec2 pixel = gl_FragCoord.xy / canvas_dimensions;

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
}
