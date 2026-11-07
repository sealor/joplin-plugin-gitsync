import { after, before, describe, it } from "node:test";
import assert from "node:assert";

import { join } from "node:path/posix"
import { fs as fsWithPromises } from "@zenfs/core";
const fs = fsWithPromises.promises;

import http from "isomorphic-git/http/node";
import git from "isomorphic-git";

import { GitService } from "./git-tools.ts";


describe("isomorphic-git", async () => {
    let repoPath: string;
    let gitService: GitService;

    before(async () => {
        gitService = await GitService.create();
        repoPath = join("/tmp", "gitsync-git-service");
        await fs.mkdir(repoPath, { recursive: true });
    });
    after(async () => {
        await gitService.close();
        await fs.rm(repoPath, { recursive: true, force: true });
    });

    it("should respond", async () => {
        let remoteRefs = await git.listServerRefs({ http: http, url: gitService.url })
        assert.deepEqual([], remoteRefs);

        await fs.writeFile(join(repoPath, "file.txt"), "file content");
        await git.init({ fs, dir: "." });
        await git.addRemote({ fs, dir: ".", remote: "origin", url: gitService.url });
        await git.add({ fs, dir: repoPath, filepath: "file.txt" });
        await git.commit({ fs, dir: ".", message: "add file.txt", author: { name: "Stefan" } })
        await git.push({ fs, http, dir: "." })

        remoteRefs = await git.listServerRefs({ http: http, url: gitService.url })
        assert.equal("refs/heads/master", remoteRefs.at(0)?.ref);
    });
});
