const canvas = document.getElementById("display_canvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

let previous_frame_time = 0.0;

const animation_limit = 100;

let tile_animation = {
    counter: 0.0,
    speed: 0.64,
    frame: 0
};

let normal_animation = {
    counter: 0.0,
    speed: 0.256,
    frame: 0
};

let player_speed = 1.5625;

const blink_time = 0.5;
const blink_time_up = 0.2;

const tile_size = 16;

const pixel_scale = 4;
const position_scale = 16 * pixel_scale;

const levels = {
};

let waiting_textures = 0;

let current_transition = null;
let leave_transition = blink_time_up;

let level_initialized = false;
let level_loaded = false;

let current_level = "snow";

let textures = {
};

let tiles_textures = [];

const animated_tiles = {
    "space/space1_0.png": ["space/space1_1.png"],
    "space/space2_0.png": ["space/space2_1.png"],
    "pink_bubble/odoto_0.png": ["pink_bubble/odoto_1.png", "pink_bubble/odoto_2.png"],
    "pink_bubble/cabcoloncp_0.png": ["pink_bubble/cabcoloncp_1.png", "pink_bubble/cabcoloncp_2.png"],
    "pink_bubble/colonthree_0.png": ["pink_bubble/colonthree_1.png", "pink_bubble/colonthree_2.png"],
    "pink_bubble/dashwdash_0.png": ["pink_bubble/dashwdash_1.png"]
};

let entities = [];

let keys_pressed = {
    left: false,
    right: false,
    up: false,
    down: false
};

let player = null;
let camera = null;

document.addEventListener("keydown", on_key_down);
document.addEventListener("keyup", on_key_up);

load_textures({
    pink_bubble: ["pink_bubble.png"],
    snowflake: ["snowflake.png"],
    star: ["star.png"],
    player_stand: ["player_stand.png"],
    player_walk_up: ["player_walk_up0.png", "player_walk_up1.png"],
    player_walk_down: ["player_walk_down0.png", "player_walk_down1.png"],
    player_walk_left: ["player_walk_left0.png", "player_walk_left1.png"],
    player_walk_right: ["player_walk_right0.png", "player_walk_right1.png"]
});

load_current_level();

update_frame(0.0);

function smoothstep(x)
{
    return x * x * (3.0 - 2.0 * x);
}

function get_resource(name, type, on_get)
{
    let xhr = new XMLHttpRequest();
    xhr.responseType = type;

    xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4)
        {
            return;
        }

        if (xhr.status !== 200)
        {
            return;
        }

        if (type === "text")
        {
            on_get(xhr.responseText)
        } else
        {
            on_get(xhr.response)
        }
    };

    xhr.open("GET", name);
    xhr.send();
}

function on_texture_loaded(texture, name)
{
    if (textures[name] === undefined)
    {
        textures[name] = [texture];
    } else
    {
        textures[name].push(texture);
    }

    waiting_textures -= 1;

    if (waiting_textures === 0)
    {
        try_initialize_scene();
    }
}

function load_texture_image_with(name, on_load)
{
    get_resource(name, "blob", (blob) => {
        window.createImageBitmap(blob)
            .then(on_load, (err) => console.log("failed to load texture", name, err));
    });
}

function load_texture_image(name, field)
{
    load_texture_image_with(name, (image) => on_texture_loaded(image, field))
}

function load_texture(state, assets, name)
{
    return assets.reduce((acc, image) => {
        return {
            count: acc.count + 1,
            loader: () => {
                load_texture_image(image, name);
                acc.loader();
            }
        };
    }, state);
}

function load_textures(textures)
{
    let state = {
        count: 0,
        loader: () => {}
    };

    for (let name in textures)
    {
        state = load_texture(state, textures[name], name);
    }

    waiting_textures += state.count;

    state.loader();
}

function parse_level(text)
{
    const lines = text.split('\n');

    const size_text = lines[0];
    const size = size_text.split('x').map(Number);

    waiting_textures += lines.length - 2;

    const start_index = tiles_textures.length;

    const after_load = () => {
        waiting_textures -= 1;
        if (waiting_textures === 0)
        {
            try_initialize_scene();
        }
    };

    const textures_lines = lines.slice(1, lines.length - 1);

    textures_lines.forEach((name) => {
        if (animated_tiles[name] !== undefined)
        {
            waiting_textures += animated_tiles[name].length;
        }
    });

    const textures = textures_lines.map((name, index) => {
        const this_index = start_index + index;

        load_texture_image_with(name, (texture) => {
            tiles_textures[this_index] = [texture];

            if (animated_tiles[name] !== undefined)
            {
                animated_tiles[name].forEach((animated_name, animated_index) => {
                    load_texture_image_with(animated_name, (animated_texture) => {
                        tiles_textures[this_index][animated_index + 1] = animated_texture;

                        after_load();
                    });
                });
            }

            after_load();
        });

        return this_index;
    });

    const tiles = lines[lines.length - 1].split(' ').map((x) => start_index + Number(x));

    const looping = true;

    return {
        size,
        tiles,
        looping
    };
}

function load_current_level()
{
    if (levels[current_level] !== undefined)
    {
        return;
    }

    level_loaded = false;

    get_resource(current_level + ".save", "text", (text) => {
        levels[current_level] = parse_level(text);
    });
}

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

function field_exists(field)
{
    return field !== null && field !== undefined;
}

function add_entity(entity)
{
    const id = entities.length;
    entities.push(entity);

    return id;
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
    let moved_horizontal = false;
    let moved_vertical = false;

    let velocity = [0.0, 0.0];

    if (keys_pressed.left)
    {
        moved_horizontal = true;
        velocity[0] -= 1.0;
        entities[player].texture = textures.player_walk_left;
    }

    if (keys_pressed.right)
    {
        moved_horizontal = true;
        velocity[0] += 1.0;
        entities[player].texture = textures.player_walk_right;
    }

    if (keys_pressed.up)
    {
        moved_vertical = true;
        velocity[1] -= 1.0;
        entities[player].texture = textures.player_walk_up;
    }

    if (keys_pressed.down)
    {
        moved_vertical = true;
        velocity[1] += 1.0;
        entities[player].texture = textures.player_walk_down;
    }

    velocity = velocity.map((x) => x * player_speed * dt);

    if (moved_horizontal && moved_vertical)
    {
        velocity = velocity.map((x) => x / Math.sqrt(2.0));
    }

    entities[player].position = array_add(entities[player].position, velocity);

    const moved = moved_vertical || moved_horizontal;

    if (!moved)
    {
        entities[player].texture = textures.player_stand;
    }
}

function handle_movement_inputs(dt)
{
    movement_directions(dt);
}

function handle_inputs(dt)
{
    handle_movement_inputs(dt);
}

function draw_tiles(camera_position)
{
    const level = levels[current_level];

    const width = level.size[0];
    const height = level.size[1];

    const tiles = level.tiles;

    const x_size = canvas.width / position_scale + 1;
    const y_size = canvas.height / position_scale + 1;

    const x_begin = Math.floor(camera_position[0]);
    const y_begin = Math.floor(-camera_position[1] - y_size + 2);

    for(let x = x_begin; x < x_size + x_begin; ++x)
    {
        for(let y = y_begin; y < y_size + y_begin; ++y)
        {
            const wrap_pos = (size, value) =>
            {
                if (value < 0)
                {
                    return size + value;
                } else if (value >= size)
                {
                    return value - size;
                } else
                {
                    return value;
                }
            };

            const index = wrap_pos(height, y) * width + wrap_pos(width, x);

            const textures = tiles_textures[tiles[index]];
            const texture = textures[(tile_animation.frame + index) % textures.length];

            ctx.drawImage(
                texture,
                (x - camera_position[0]) * position_scale - 0.5,
                (-y - camera_position[1]) * position_scale - 0.5,
                tile_size * pixel_scale + 1,
                tile_size * pixel_scale + 1
            );
        }
    }
}

function entity_position(size, position)
{
    const p = position.map((x) => x * position_scale);

    return [
        p[0] + canvas.width * 0.5 - size.width * pixel_scale * 0.5,
        p[1] + canvas.height * 0.5 - size.height * pixel_scale * 0.5
    ];
}

function with_closest(edges, compare, value)
{
    const total = edges[1] - edges[0];
    const middle = edges[0] + total * 0.5;

    if (compare < middle)
    {
        return value - total;
    } else
    {
        return value + total;
    }
}

function entity_touching(a, b)
{
    const edges = level_edges({width: 0.0, height: 0.0});

    const touching_axis = (a_size, b_size, a_pos, b_pos) => {
        const touch_distance = (a_size + b_size) * 0.5 / tile_size;

        const touching_points = (a, b) => Math.abs(b - a) < touch_distance;

        return touching_points(a_pos, b_pos)
            || touching_points(with_closest(edges[0], a_pos, a_pos), b_pos)
            || touching_points(a_pos, with_closest(edges[1], b_pos, b_pos))
            || touching_points(with_closest(edges[0], a_pos, a_pos), with_closest(edges[1], b_pos, b_pos));
    };

    return touching_axis(a.size.width, b.size.width, a.position[0], b.position[0])
        && touching_axis(a.size.height, b.size.height, a.position[1], b.position[1]);
}

function draw_blink()
{
    ctx.fillStyle = "hsv(50%, 10%, 10%)";

    if (!level_initialized)
    {
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        return;
    }

    if (current_transition !== null)
    {
        const fraction = (1.0 - Math.pow(current_transition.time / blink_time, 3.0)) + 0.1;

        ctx.fillRect(0, 0, canvas.width, canvas.height * Math.min(Math.max(fraction, 0.0), 1.0));
    } else if (leave_transition !== null)
    {
        const time_fraction = leave_transition / blink_time_up;
        const fraction = Math.pow(time_fraction, 4.0) - 0.1 * (1.0 - time_fraction);

        ctx.fillRect(0, 0, canvas.width, canvas.height * Math.min(Math.max(fraction, 0.0), 1.0));
    }
}

function draw_frame()
{
    const level = levels[current_level];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (level === undefined)
    {
        return;
    }

    const looping = level.looping;

    const camera_position = entities[camera].position;

    draw_tiles(camera_position);

    const edges = level_edges({width: 0.0, height: 0.0});

    entities.forEach((entity) => {
        if (field_exists(entity.texture) && field_exists(entity.position))
        {
            const draw_at = (x, y) => {
                const screen_position = array_sub([x, y], camera_position);

                const texture = entity.texture[normal_animation.frame % entity.texture.length];
                const position = entity_position(texture, screen_position);

                ctx.drawImage(
                    texture,
                    position[0],
                    position[1],
                    texture.width * pixel_scale,
                    texture.height * pixel_scale
                );
            };

            const this_entity_position = entity.position;
            draw_at(this_entity_position[0], this_entity_position[1]);

            if (looping)
            {
                draw_at(
                    with_closest(edges[0], camera_position[0], this_entity_position[0]),
                    this_entity_position[1]
                );

                draw_at(
                    this_entity_position[0],
                    with_closest(edges[1], camera_position[1], this_entity_position[1])
                );

                draw_at(
                    with_closest(edges[0], camera_position[0], this_entity_position[0]),
                    with_closest(edges[1], camera_position[1], this_entity_position[1])
                );
            }
        }
    });
}

function level_edges(size)
{
    const level_size = levels[current_level].size;

    const is_entity = size !== null;

    const x_bottom_offset = is_entity ? -canvas.width * 0.5 / position_scale + size.width * 0.5 / tile_size : 0.0;
    const y_bottom_offset = is_entity ? -canvas.height * 0.5 / position_scale + size.height * 0.5 / tile_size : 0.0;

    const x_top_offset = is_entity ? -canvas.width * 0.5 / position_scale - size.width * 0.5 / tile_size : -canvas.width / position_scale;
    const y_top_offset = is_entity ? -canvas.height * 0.5 / position_scale - size.height * 0.5 / tile_size : -canvas.height / position_scale;

    return [
        [0.0 + x_bottom_offset, level_size[0] + x_top_offset],
        [-level_size[1] + 1 + y_bottom_offset, 1 + y_top_offset]
    ];
}

function transition_done(target)
{
    level_initialized = false;

    current_level = target;
    load_current_level();

    leave_transition = blink_time_up;
}

function transition_level(target)
{
    if (current_transition !== null)
    {
        return;
    }

    current_transition = {
        time: blink_time,
        target
    };
}

function update_entities(dt)
{
    {
        const camera_entity = entities[camera];

        const distance = array_sub(entities[player].position, camera_entity.position).map((x) => x * 0.1);
        camera_entity.position = array_add(camera_entity.position, distance);

        if (!levels[current_level].looping)
        {
            const edges = level_edges(null);

            const limit_camera = (edges, x) => {
                return Math.min(Math.max(x, edges[0]), edges[1]);
            };

            camera_entity.position = [
                limit_camera(edges[0], camera_entity.position[0]),
                limit_camera(edges[1], camera_entity.position[1])
            ];
        }
    }

    {
        const camera_entity = entities[camera];

        const size = entities[player].texture[0];

        const limit_player  = (edges, wrap_edges, x, camera_x) => {
            if (levels[current_level].looping)
            {
                const total = wrap_edges[1] - wrap_edges[0];

                if (x < wrap_edges[0])
                {
                    return [total, total + x];
                } else if (x >= wrap_edges[1])
                {
                    return [-total, x - total];
                } else
                {
                    return [0.0, x];
                }
            } else
            {
                return [0.0, Math.min(Math.max(x, edges[0]), edges[1])];
            }
        };

        const edges = level_edges(size);
        const wrap_edges = level_edges({width: 0.0, height: 0.0});

        const [camera_x, limited_x] = limit_player(edges[0], wrap_edges[0], entities[player].position[0]);
        const [camera_y, limited_y] = limit_player(edges[1], wrap_edges[1], entities[player].position[1]);

        camera_entity.position[0] += camera_x;
        camera_entity.position[1] += camera_y;

        entities[player].position = [limited_x, limited_y];
    }

    entities.forEach((entity) => {
        if (field_exists(entity.transition))
        {
            if (field_exists(entity.position))
            {
                const is_touched = entity_touching(
                    {size: entity.texture[0], position: entity.position},
                    {size: entities[player].collider, position: entities[player].position}
                );

                if (is_touched)
                {
                    transition_level(entity.transition);
                }
            }
        }
    });

    entities.forEach((entity) => {
        if (field_exists(entity.ai))
        {
            switch (entity.ai.name)
            {
                case "star":
                {
                    if (field_exists(entity.position))
                    {
                        entity.ai.angle = (entity.ai.angle + dt * 0.625) % (Math.PI * 2.0);
                        const circle_position = [Math.cos(entity.ai.angle), Math.sin(entity.ai.angle)].map((x) => x * 1.3);
                        entity.position = array_add(entity.ai.target, circle_position);
                    }

                    return;
                }

                case "snowflake":
                {
                    if (field_exists(entity.position))
                    {
                        entity.ai.value = (entity.ai.value + dt * 0.1875) % 1.0;
                        const offset = smoothstep(Math.abs(entity.ai.value - 0.5) * 2.0) * 0.7;
                        entity.position[1] = entity.ai.target + offset;
                    }

                    return;
                }

                default:
                    return;
            }
        }
    });
}

function advance_animation(animation, dt)
{
    animation.counter += dt;

    if (animation.counter >= animation.speed)
    {
        animation.frame = (animation.frame + 1) % animation_limit;

        animation.counter -= animation.speed;
    }
}

function update_frame(current_time)
{
    const dt = Math.min(current_time - previous_frame_time, (1000.0 / 30.0)) * 0.001;
    previous_frame_time = current_time;

    advance_animation(normal_animation, dt);
    advance_animation(tile_animation, dt);

    if (levels[current_level] !== undefined && level_loaded)
    {
        if (!level_initialized)
        {
            initialize_level();
        }

        handle_inputs(dt);

        update_entities(dt);

        draw_frame();

        if (leave_transition !== null)
        {
            leave_transition -= dt;

            if (leave_transition <= 0.0)
            {
                leave_transition = null;
            }
        }
    }

    draw_blink();

    if (current_transition !== null)
    {
        current_transition.time -= dt;

        if (current_transition.time <= 0.0)
        {
            transition_done(current_transition.target);

            current_transition = null;
        }
    }

    requestAnimationFrame(update_frame);
}

function middle_position()
{
    const size = levels[current_level].size;

    const bottom_left = [canvas.width, canvas.height].map((x) => x * -0.5 / position_scale);

    const half_scale = size.map((x) => x * 0.5);

    return array_add(bottom_left, [half_scale[0], -half_scale[1]]);
}

function initialize_current_level()
{
    switch (current_level)
    {
        case "snow":
        {
            {
                const position = array_add(middle_position(), [-8.0, -5.0]);

                add_entity({
                    position: position,
                    texture: textures.pink_bubble,
                    transition: "pink_bubble",
                    ai: {
                        name: "snowflake",
                        value: 0.0,
                        target: position[1]
                    }
                });
            }

            {
                const position = array_add(middle_position(), [10.0, 8.0]);

                add_entity({
                    position: position,
                    texture: textures.star,
                    transition: "space",
                    ai: {
                        name: "star",
                        angle: 0.0,
                        target: position
                    }
                });
            }

            return;
        }

        case "pink_bubble":
        {
            {
                const position = array_add(middle_position(), [-10.0, 2.0]);

                add_entity({
                    position: position,
                    texture: textures.star,
                    transition: "space",
                    ai: {
                        name: "star",
                        angle: 0.0,
                        target: position
                    }
                });
            }

            return;
        }

        case "space":
        {
            {
                const position = array_add(middle_position(), [-8.0, -6.0]);

                add_entity({
                    position: position,
                    texture: textures.snowflake,
                    transition: "snow",
                    ai: {
                        name: "snowflake",
                        value: 0.0,
                        target: position[1]
                    }
                });
            }

            return;
        }

        default:
            return;
    }
}

function initialize_level()
{
    entities = [];

    camera = add_entity({
        position: middle_position()
    });

    player = add_entity({
        position: middle_position(),
        texture: textures.player_stand,
        collider: {width: 10.0, height: 16.0}
    });

    initialize_current_level();

    level_initialized = true;
}

function try_initialize_scene()
{
    level_loaded = true;
}
