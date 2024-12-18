let panelId = 0;

const containerElement = document.getElementById("panelsContainer");

const sites = [
    ["badtracer/index.html", "raytracer"],
    ["cottoncandysite/index.html", "cotton candy"],
    ["visualbinary/binary.html", "binary adder"]
];

sites.forEach((x) => { add_site(x[0], x[1]); });

function color_offset(color, offset)
{
    return color + " " + (offset * 100).toFixed(0) + "%";
}

function lower_panels(current, direction)
{
    Array.from(document.getElementsByClassName("panel")).filter((x) =>
    {
	return x.id !== current;
    }).forEach((x) =>
    {
	x.animate(
	    [
		{transform: "translateY(0)", filter: "brightness(100%)"},
		{transform: "translateY(1em)", filter: "brightness(60%)"}
	    ],
	    {
		direction,
		duration: 100,
		easing: "ease-out",
		fill: "both"
	    }
	);
    });
}

function add_site(url, name)
{
    const panel = document.createElement("div");
    panel.classList.add("panel");

    const thisId = "panel" + panelId;
    panel.id = thisId;

    panel.addEventListener("mouseenter", (e) => { lower_panels(thisId, "normal"); });
    panel.addEventListener("mouseleave", (e) => { lower_panels(thisId, "reverse"); });

    const colorA = "hsl(322, 78%, 65%)";
    const colorB = "hsl(43, 100%, 70%)";

    const x = panelId / (sites.length - 1);
    const offset = (x * 0.2) - 0.1;

    const offsetA = offset;
    const offsetB = offset + 0.7;
    const offsetC = offset + 1.3;

    const gradient = [color_offset(colorA, offsetA), color_offset(colorB, offsetB), color_offset(colorA, offsetC)];

    const gradientString = gradient.reduce(
	(acc, value) =>
	{
	    if (acc === "")
	    {
		return value;
	    } else
	    {
		return acc + ", " + value;
	    }
	},
	""
    );

    const degree = 105 + x * 10;

    const image = document.createElement("div");
    image.style.backgroundImage = "linear-gradient(" + degree + "deg, " + gradientString + ")";
    image.classList.add("panelImage");

    panel.appendChild(image);

    const button = document.createElement("button");
    button.innerHTML = name;
    button.addEventListener("click", (e) => { window.location.href = new URL(url, window.location.href).href; });

    panel.appendChild(button);

    containerElement.appendChild(panel);

    panelId = panelId + 1;
}
