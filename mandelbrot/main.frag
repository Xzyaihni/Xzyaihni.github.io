#version 300 es

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

    const int ITERATIONS = 500;
    for(int i = 0; i < ITERATIONS; ++i)
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

void main()
{
    vec2 pixel = gl_FragCoord.xy / vec2(CANVAS_DIMENSIONS);

    float depth = mandelbrot(pixel);

    frag_color = vec4(vec3(depth, 0.0, depth * depth * 0.5), 1.0);
}
