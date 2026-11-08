import { join } from "node:path/posix"
import { fs as fsWithPromises } from "@zenfs/core";
const fs = fsWithPromises.promises;

import http from "isomorphic-git/http/node";
import git from "isomorphic-git";
import type { GitAuth } from "isomorphic-git";
import type { SettingsProvider } from "./joplin-settings";
import type { Database } from "./joplin-database";


export class Synchronizer {
    private database: Database;
    private settingsProvider: SettingsProvider;

    constructor(database: Database, settingsProvider: SettingsProvider) {
        this.database = database;
        this.settingsProvider = settingsProvider;
    }

    async syncNotes(): Promise<void> {
        const settings = await this.settingsProvider.load();
        const url = settings.repoUrl;
        const author = settings.author;
        const auth = settings.auth;

        await wipeInMemoryFs();

        const dir = ".";
        await git.init({ fs, dir });
        await git.addRemote({ fs, dir, remote: "origin", url });

        const notes = await this.database.getAllNotes();
        for (const note of notes) {
            const title = `${note.title}.md`;
            await fs.writeFile(title, `---\nid: ${note.id}\n---\n\n${note.body}`);
            await git.add({ fs, dir, filepath: title });
        }
        console.log("added notes", notes.length);

        await git.commit({ fs, dir, author, message: "add or modify notes" });
        console.log("committed notes");

        const authFunc: (url: string) => GitAuth = (_url) => {
            return auth as GitAuth;
        };
        await git.push({ fs, http, dir, onAuth: authFunc, force: true });
        console.log("pushed notes");
    }
}

async function wipeInMemoryFs() {
    for (const item of await fs.readdir("/")) {
        await fs.rm(item, { recursive: true, force: true });
    }
}
