/** Retrieves and returns a WebGPU device. */
const getDevice = async () => {
    if (!navigator.gpu)
        throw new Error("WebGPU is not supported");

    const adapter = await navigator.gpu.requestAdapter({ featureLevel: "compatibility" });
    if (!adapter)
        throw new Error("No suitable GPU found");
    const isCpu = adapter.info.isFallbackAdapter;

    const device = await adapter.requestDevice();
    if (!device)
        throw new Error("Failed to get device");

    return { device, isCpu };
};

/** Retrieves the canvas and returns a context configured for WebGPU. */
const getCanvasContext = (device) => {
    const canvas = document.getElementById("_canvas");
    const context = canvas.getContext("webgpu");
    context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat() });

    new ResizeObserver(([entry]) => {
        const size = entry.devicePixelContentBoxSize?.[0];
        canvas.width = Math.max(1, size ? size.inlineSize : Math.round(entry.contentRect.width * devicePixelRatio));
        canvas.height = Math.max(1, size ? size.blockSize : Math.round(entry.contentRect.height * devicePixelRatio));
    }).observe(canvas);

    return context;
};

/** Returns a random position. */
const randPos = () => {
    return Math.random();
}

/** Loads a shader from a file into a module. */
const loadShader = async (device, path) => {
    const code = await (await fetch(path)).text();
    const module = device.createShaderModule({ label: path, code });

    const compileInfo = await module.getCompilationInfo();
    for (const msg of compileInfo.messages)
        console.warn(`${path}: ${msg.message}`);

    return module;
};

const main = async () => {
    const { device, isCpu } = await getDevice();
    const context = getCanvasContext(device);
    const format = navigator.gpu.getPreferredCanvasFormat();

    const N_VERTICES = isCpu ? 4 : 20;
    const FLOATS_PER_VERTEX = 4;
    const vertexData = new Float32Array(N_VERTICES * FLOATS_PER_VERTEX);
    const nodes = Array.from({ length: vertexData.length }, (_, i) => {
        const j = i * FLOATS_PER_VERTEX;
        return {
            pos: vertexData.subarray(j, j + 2),
            dst: vertexData.subarray(j + 2, j + 4),
        };
    });
    const vertexBuffer = device.createBuffer({
        label: "vertexData",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const aspectBuffer = device.createBuffer({
        label: "aspect",
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const shader = await loadShader(device, "shaders/main.wgsl");
    const pipeline = await device.createRenderPipelineAsync({
        label: "tri",
        layout: "auto",
        vertex: { module: shader, entryPoint: "v_main", },
        fragment: {
            module: shader,
            entryPoint: "f_main", 
            targets: [{ format }],
        },
        primitive: { topology: "triangle-strip" },
    });
    const bindGroup = device.createBindGroup({
        label: "nodesBindGroup",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: vertexBuffer } },
            { binding: 1, resource: { buffer: aspectBuffer } },
        ],
    });

    // Randomize nodes.
    for (let i = 0; i < nodes.length; i++) {
        nodes[i].pos[0] = randPos();
        nodes[i].pos[1] = randPos();
        nodes[i].dst[0] = randPos();
        nodes[i].dst[1] = randPos();
    }

    const update = () => {
        // Moves nodes toward their destination.
        const SPEED = 0.00025;
        for (let i = 0; i < nodes.length; i++) {
            const dx = nodes[i].dst[0] - nodes[i].pos[0];
            const dy = nodes[i].dst[1] - nodes[i].pos[1];
            const d = Math.sqrt((dx * dx) + (dy * dy));
            const vx = SPEED * (dx / d);
            const vy = SPEED * (dy / d);

            nodes[i].pos[0] += vx;
            nodes[i].pos[1] += vy;

            // Pick a new destination if close.
            if (d < SPEED * 2.0) {
                nodes[i].dst[0] = randPos();
                nodes[i].dst[1] = randPos();
            }
        }
    }

    const draw = () => {
        update();

        const encoder = device.createCommandEncoder();
        const canvasTexture = context.getCurrentTexture();
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: canvasTexture,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: "clear",
                storeOp: "store",
            }],   
        });

        device.queue.writeBuffer(vertexBuffer, 0, vertexData);
        const aspectRatio = canvasTexture.width / canvasTexture.height;
        device.queue.writeBuffer(aspectBuffer, 0, new Float32Array([aspectRatio]));

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(4);

        renderPass.end();
        device.queue.submit([encoder.finish()]);

        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
}
main().catch(e => console.error(e));
