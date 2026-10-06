struct Point {
    pos: vec2f,
    dst: vec2f,
};
@group(0) @binding(0) var<storage, read> points: array<Point>;

@group(0) @binding(1) var<uniform> aspectRatio: f32;

struct VertexOut {
    @builtin(position) pos: vec4f,
    @location(0) xy: vec2f,
};

const N_COLORS = 3;
const COLORS = array<vec3f, N_COLORS>(
    vec3(1.0, 0.6, 0.8118),
    vec3(0.6, 0.9882, 1.0),
    vec3(0.6, 0.7882, 1.0),
);

@vertex
fn v_main(@builtin(vertex_index) i: u32) -> VertexOut {
    const vertices = array<vec2f, 4>(
        vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0), vec2f( 1.0,  1.0),
    );
    let p = vertices[i];

    var out: VertexOut;
    out.pos = vec4f(p, 0.0, 1.0);
    out.xy = p * vec2f(0.5, -0.5) + 0.5;
    return out;
}

@fragment
fn f_main(in: VertexOut) -> @location(0) vec4f {
    var minDist = 1e20;
    var iClosest = 0u;

    for (var i = 0u; i < arrayLength(&points); i++) {
        let d = (in.xy - points[i].pos) * vec2f(aspectRatio, 1.0);
        let dist = dot(d, d);

        if (dist < minDist) {
            minDist = dist;
            iClosest = i;
        }
    }

    var color = COLORS[iClosest % N_COLORS];
    if (minDist < 0.00002) {
        color *= 0.9;
    }

    return vec4f(color, 1.0);
}
