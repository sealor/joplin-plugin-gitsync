import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GitClient, GitService } from "./git-tools.ts";


describe("git-tools", () => {
    let repoPath: string;
    let gitService: GitService;
    let gitClient: GitClient;

    before(async () => {
        gitService = await GitService.create();
        repoPath = await mkdtemp(join(tmpdir(), "gitsync-git-service-"));
        gitClient = new GitClient(repoPath);
    });
    after(async () => {
        await gitService.close();
        await rm(repoPath, { recursive: true, force: true });
    });

    it("should respond", async () => {
        const { stdout: stdout1 } = await gitClient.run(["ls-remote", `${gitService.url}`]);
        assert.equal(stdout1, "");

        fs.writeFileSync(join(repoPath, "file.txt"), "file content");
        await gitClient.run(["init"]);
        await gitClient.run(["remote", "add", "origin", gitService.url]);
        await gitClient.run(["add", "."]);
        await gitClient.run(["commit", "-m", "add file.txt"]);
        await gitClient.run(["branch", "-m", "main"]);
        await gitClient.run(["push", "origin", "main"]);

        const { stdout: stdout2 } = await gitClient.run(["ls-remote", `${gitService.url}`]);
        assert.match(stdout2, /refs\/heads\/main/);
    });
});
