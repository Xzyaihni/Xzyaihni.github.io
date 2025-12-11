const canvas = document.getElementById("display_canvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

let previous_frame_time = 0.0;

const animation_speed = 20;
let animation_counter = 0;

const animation_limit = 100;
let frame_number = 0;

const pixel_scale = 4;
const position_scale = 16 * pixel_scale;

const levels = {
    snow: []
};

let current_level = "snow";

let textures = {
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
    star: ["star.png"],
    player_stand: ["player_stand.png"],
    player_walk_up: ["player_walk_up0.png", "player_walk_up1.png"],
    player_walk_down: ["player_walk_down0.png", "player_walk_down1.png"],
    player_walk_left: ["player_walk_left0.png", "player_walk_left1.png"],
    player_walk_right: ["player_walk_right0.png", "player_walk_right1.png"]
});

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
        initialize_scene();
    }
}

function load_texture_image(name, field)
{
    let xhr = new XMLHttpRequest();
    xhr.responseType = "blob";

    xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4)
        {
            return;
        }

        if (xhr.status !== 200)
        {
            return;
        }

        window.createImageBitmap(xhr.response)
            .then((x) => on_texture_loaded(x, field), (err) => console.log("failed to load texture", name, err));
    };

    xhr.open("GET", name);
    xhr.send();
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

function draw_frame()
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camera_position = entities[camera].position;

    entities.forEach((entity) => {
        if (field_exists(entity.texture) && field_exists(entity.position))
        {
            const texture = entity.texture[frame_number % entity.texture.length];
            ctx.drawImage(
                texture,
                (entity.position[0] - camera_position[0]) * position_scale + canvas.width * 0.5 - texture.width * pixel_scale * 0.5,
                (entity.position[1] - camera_position[1]) * position_scale + canvas.height * 0.5 - texture.height * pixel_scale * 0.5,
                texture.width * pixel_scale,
                texture.height * pixel_scale
            );
        }
    });
}

function update_entities(dt)
{
    {
        const distance = array_sub(entities[player].position, entities[camera].position).map((x) => x * 0.1);
        entities[camera].position = array_add(entities[camera].position, distance);
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

function initialize_scene()
{
    camera = add_entity({
        position: [0.0, 0.0]
    });

    player = add_entity({
        position: [0.0, 0.0],
        texture: textures.player_stand
    });

    add_entity({
        position: [0.5, 0.0],
        texture: textures.star,
        ai: {
            name: "star",
            angle: 0.0,
            target: [1.0, 0.0]
        }
    });

    draw_frame();

    requestAnimationFrame(update_frame);
}
