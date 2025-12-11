const canvas = document.getElementById("display_canvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

let previous_frame_time = 0.0;

const animation_speed = 20;
let animation_counter = 0;

const animation_limit = 100;
let frame_number = 0;

const tile_size = 16;

const pixel_scale = 4;
const position_scale = 16 * pixel_scale;

const levels = {
};

let current_level = "snow";

let textures = {
};

let tiles_textures = [];

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
    star: ["star.png"],
    player_stand: ["player_stand.png"],
    player_walk_up: ["player_walk_up0.png", "player_walk_up1.png"],
    player_walk_down: ["player_walk_down0.png", "player_walk_down1.png"],
    player_walk_left: ["player_walk_left0.png", "player_walk_left1.png"],
    player_walk_right: ["player_walk_right0.png", "player_walk_right1.png"]
});

load_current_level();

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

    waiting_textures = state.count;

    state.loader();
}

function parse_level(text)
{
    const lines = text.split('\n');

    const size_text = lines[0];
    const size = size_text.split('x').map(Number);

    waiting_textures += lines.length - 2;

    const start_index = tiles_textures.length;

    const textures = lines.slice(1, lines.length - 1).map((name, index) => {
        const this_index = start_index + index;

        load_texture_image_with(name, (texture) => {
            tiles_textures[this_index] = texture;

            waiting_textures -= 1;
            if (waiting_textures === 0)
            {
                try_initialize_scene();
            }
        });

        return this_index;
    });

    const tiles = lines[lines.length - 1].split(' ').map((x) => start_index + Number(x));

    return {
        size,
        tiles
    };
}

function load_current_level()
{
    if (levels[current_level] !== undefined)
    {
        return;
    }

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
    const speed = 0.05;
    let moved = false;

    if (keys_pressed.left)
    {
        moved = true;
        entities[player].position[0] -= speed * dt;
        entities[player].texture = textures.player_walk_left;
    }

    if (keys_pressed.right)
    {
        moved = true;
        entities[player].position[0] += speed * dt;
        entities[player].texture = textures.player_walk_right;
    }

    if (keys_pressed.up)
    {
        moved = true;
        entities[player].position[1] -= speed * dt;
        entities[player].texture = textures.player_walk_up;
    }

    if (keys_pressed.down)
    {
        moved = true;
        entities[player].position[1] += speed * dt;
        entities[player].texture = textures.player_walk_down;
    }

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

    const tiles = level.tiles;

    tiles.forEach((tile, index) => {
        const x = index % width;
        const y = Math.floor(index / width);

        const texture = tiles_textures[tile];

        ctx.drawImage(
            texture,
            (x - camera_position[0]) * position_scale - 0.5,
            (-y - camera_position[1]) * position_scale - 0.5,
            tile_size * pixel_scale + 1,
            tile_size * pixel_scale + 1
        );
    });
}

function entity_position(size, position)
{
    const p = position.map((x) => x * position_scale);

    return [
        p[0] + canvas.width * 0.5 - size.width * pixel_scale * 0.5,
        p[1] + canvas.height * 0.5 - size.height * pixel_scale * 0.5
    ];
}

function draw_frame()
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camera_position = entities[camera].position;

    draw_tiles(camera_position);

    entities.forEach((entity) => {
        if (field_exists(entity.texture) && field_exists(entity.position))
        {
            const screen_position = array_sub(entity.position, camera_position);

            const texture = entity.texture[frame_number % entity.texture.length];
            const position = entity_position(texture, screen_position);

            ctx.drawImage(
                texture,
                position[0],
                position[1],
                texture.width * pixel_scale,
                texture.height * pixel_scale
            );
        }
    });
}

function update_entities(dt)
{
    {
        const level_size = levels[current_level].size;

        const camera_entity = entities[camera];

        const distance = array_sub(entities[player].position, camera_entity.position).map((x) => x * 0.1);
        camera_entity.position = array_add(camera_entity.position, distance);

        const limit_camera = (size, x, vertical) => {
            if (vertical)
            {
                return Math.min(Math.max(x, -size + 1), 1 - canvas.height / position_scale);
            } else
            {
                return Math.min(Math.max(x, 0.0), size - canvas.width / position_scale);
            }
        };

        camera_entity.position = [
            limit_camera(level_size[0], camera_entity.position[0], false),
            limit_camera(level_size[1], camera_entity.position[1], true)
        ];
    }

    entities.forEach((entity) => {
        if (field_exists(entity.ai))
        {
            switch (entity.ai.name)
            {
                case "star":
                {
                  if (field_exists(entity.position))
                  {
                    entity.ai.angle = (entity.ai.angle + dt * 0.02) % (Math.PI * 2.0);
                    const circle_position = [Math.cos(entity.ai.angle), Math.sin(entity.ai.angle)].map((x) => x * 1.3);
                    entity.position = array_add(entity.ai.target, circle_position);
                  }

                  return;
                }

                default:
                  return;
            }
        }
    });
}

function update_frame(current_time)
{
    const dt = Math.min(current_time - previous_frame_time, 0.5);
    previous_frame_time = current_time;

    animation_counter = (animation_counter + 1) % animation_speed;

    if (animation_counter === 0)
    {
        frame_number = (frame_number + 1) % animation_limit;
    }

    handle_inputs(dt);

    update_entities(dt);

    draw_frame();

    requestAnimationFrame(update_frame);
}

function try_initialize_scene()
{
    if (levels[current_level] === undefined)
    {
        return;
    }

    initialize_scene();
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
    if (current_level === "snow")
    {
        const position = array_add(middle_position(), [10.0, 8.0]);

        add_entity({
            position: position,
            texture: textures.star,
            ai: {
                name: "star",
                angle: 0.0,
                target: position
            }
        });
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
        texture: textures.player_stand
    });

    initialize_current_level();
}

function initialize_scene()
{
    initialize_level();

    draw_frame();

    requestAnimationFrame(update_frame);
}
