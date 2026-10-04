struct Point {
    pos: vec2f,
    color: vec3f,
};
@group(0) @binding(0) var<storage, read> points: array<Point>;

@group(0) @binding(1) var<uniform> aspectRatio: f32;

struct VertexOut {
    @builtin(position) pos: vec4f,
    @location(0) xy: vec2f,
};

@vertex
fn v_main(@builtin(vertex_index) i: u32) -> VertexOut {
    const vertices = array<vec2f, 6>(
        vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0),
        vec2f(-1.0,  1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0),
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
    var color = vec3(0.0);

    for (var i = 0u; i < arrayLength(&points); i++) {
        let d = (in.xy - points[i].pos) * vec2f(aspectRatio, 1.0);
        let dist = dot(d, d);

        if (dist < minDist) {
            minDist = dist;
            color = points[i].color;
        }
    }

    if (minDist < 0.00002) {
        color *= 0.9;
    }

    return vec4f(color, 1.0);
}
