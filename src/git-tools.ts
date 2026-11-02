import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path/posix";

import child_process from "node:child_process";
import util from "node:util";
import { Readable } from "node:stream";

import http from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";

const execFile = util.promisify(child_process.execFile);


export class GitClient {
    private readonly path: string;

    constructor(path: string) {
        this.path = path;
    }

    async run(args: string[], options: child_process.ExecFileOptions = {}) {
        const { stdout, stderr } = await execFile("git", ["-C", this.path, ...args], {
            ...options,
            env: {
                GIT_AUTHOR_NAME: "Test",
                GIT_AUTHOR_EMAIL: "test@example.com",
                GIT_COMMITTER_NAME: "Test",
                GIT_COMMITTER_EMAIL: "test@example.com",
                ...process.env,
                GIT_TERMINAL_PROMPT: "0",
                ...options.env,
            },
        });

        return { stdout: stdout.toString(), stderr: stderr.toString() };
    }
}

export class GitService {
    private server: http.Server;
    private path: string;
    private gitClient: GitClient;
    public url: string;

    private constructor() { }

    public static async create(): Promise<GitService> {
        const service = new GitService();
        await service.initialize();
        return service;
    }

    private async initialize() {
        this.server = http.createServer(async (req, res) => { await this.handleGitHttpRequest(req, res); });
        this.server.listen(0, "127.0.0.1");
        await once(this.server, "listening");
        const { port } = this.server.address() as AddressInfo;
        this.url = `http://127.0.0.1:${port}`;

        this.path = await mkdtemp(join(tmpdir(), "gitsync-http-backend-"));
        this.gitClient = new GitClient(this.path);
        await this.gitClient.run(["init", "--bare"]);
        await this.gitClient.run(["config", "http.receivepack", "true"]);
    }

    public async close() {
        const closed = new Promise<void>((resolve, reject) => {
            this.server?.close((error) => (error ? reject(error) : resolve()));
        });
        this.server.closeAllConnections();
        await closed;
        await rm(this.path, { recursive: true, force: true });
    }

    private async handleGitHttpRequest(request: http.IncomingMessage, response: http.ServerResponse) {
        try {
            const url = new URL(request.url ?? "/", "http://localhost");
            const child = child_process.spawn("git", ["http-backend"], {
                env: {
                    ...process.env,
                    GIT_PROJECT_ROOT: this.path,
                    GIT_HTTP_EXPORT_ALL: "1",
                    REQUEST_METHOD: request.method ?? "GET",
                    PATH_INFO: decodeURIComponent(url.pathname),
                    QUERY_STRING: url.search.replace(/^\?/, ""),
                    CONTENT_TYPE: this.resolveHeaderValue(request.headers["content-type"]),
                    CONTENT_LENGTH: this.resolveHeaderValue(request.headers["content-length"]),
                    REMOTE_ADDR: request.socket.remoteAddress ?? "",
                    HTTP_GIT_PROTOCOL: this.resolveHeaderValue(request.headers["git-protocol"]),
                    SERVER_PROTOCOL: `HTTP/${request.httpVersion}`,
                },
                stdio: ["pipe", "pipe", "pipe"],
            });

            if (!child.stdin) {
                throw new Error("git http-backend stdin is unavailable");
            }

            child.stdin.on("error", () => undefined);
            request.pipe(child.stdin);

            const [stdout, stderr, close] = await Promise.all([
                this.collect(child.stdout),
                this.collect(child.stderr),
                once(child, "close"),
            ]);
            const [code] = close as [number | null, NodeJS.Signals | null];

            if (code !== 0) {
                throw new Error(`git http-backend exited with ${code}: ${stderr.toString("utf8")}`);
            }

            const { status, headers, body } = this.parseCgiResponse(stdout);
            response.writeHead(status, headers);
            response.end(body);
        } catch (error) {
            if (!response.headersSent) {
                response.writeHead(500, { "Content-Type": "text/plain" });
            }
            response.end(error instanceof Error ? error.message : String(error));
        }
    }

    private resolveHeaderValue(value: string | string[] | undefined) {
        return Array.isArray(value) ? value.join(", ") : value ?? "";
    }

    private async collect(stream: Readable): Promise<Buffer> {
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    }

    private parseCgiResponse(output: Buffer) {
        const crlfEnd = output.indexOf("\r\n\r\n");
        const lfEnd = output.indexOf("\n\n");

        let headerEnd: number;
        let separatorLength: number;

        if (crlfEnd >= 0) {
            headerEnd = crlfEnd;
            separatorLength = 4;
        } else if (lfEnd >= 0) {
            headerEnd = lfEnd;
            separatorLength = 2;
        } else {
            headerEnd = output.length;
            separatorLength = 0;
        }

        const headerBlock = output.subarray(0, headerEnd).toString("utf8");
        const body = output.subarray(headerEnd + separatorLength);
        const headers: Record<string, string> = {};
        let status = 200;

        for (const line of headerBlock.split(/\r?\n/)) {
            const separator = line.indexOf(":");
            if (separator < 0) continue;

            const name = line.slice(0, separator).trim();
            const value = line.slice(separator + 1).trim();

            if (name.toLowerCase() === "status") {
                status = Number.parseInt(value, 10);
            } else {
                headers[name] = value;
            }
        }

        return { status, headers, body };
    }
}

