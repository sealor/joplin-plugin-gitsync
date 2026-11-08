import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import http from "isomorphic-git/http/node";
import git from "isomorphic-git";

import { GitClient, GitService } from "./git-tools.ts";
import { MockSettingsProvider } from "./joplin-settings.ts";
import { MockDatabase } from "./joplin-database.ts";
import { Synchronizer } from "./synchronizer.ts";


describe("synchronizer", () => {
    let gitService: GitService;
    let clonePath: string;
    let gitClient: GitClient;

    before(async () => {
        gitService = await GitService.create();
        clonePath = await mkdtemp(join(tmpdir(), "gitsync-clone-"));
        gitClient = new GitClient(clonePath);
    });
    after(async () => {
        await rm(clonePath, { recursive: true, force: true });
        await gitService.close();
    });

    it("should push notes to the remote repository", async () => {
        const settingsProvider = new MockSettingsProvider({
            repoUrl: gitService.url,
            auth: { username: "user", password: "password" },
            author: { name: "Test", email: "test@example.com" },
        });
        const database = new MockDatabase([{ id: "note-1", title: "Note", body: "Note body" }]);
        const synchronizer = new Synchronizer(database, settingsProvider);

        await synchronizer.syncNotes();

        const refs = await git.listServerRefs({ http, url: gitService.url });
        assert.equal(refs.at(0)?.ref, "refs/heads/master");

        await gitClient.run(["clone", "--branch", "master", gitService.url, "."]);

        const content = await readFile(join(clonePath, "Note.md"), "utf8");
        assert.equal(content, "---\nid: note-1\n---\n\nNote body");
    });
});
