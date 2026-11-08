import type Joplin from "api/Joplin";
import { type SettingItemType } from "api/types";


const SETTING = {
    REPO_URL: "gitsync.REPO_URL",
    USERNAME: "gitsync.USERNAME",
    PASSWORD: "gitsync.PASSWORD",
    AUTHOR_NAME: "gitsync.AUTHOR_NAME",
    AUTHOR_EMAIL: "gitsync.AUTHOR_EMAIL",
} as const;

export interface SettingsProvider {
    register(): Promise<void>;
    load(): Promise<GitSyncSettings>;
}

export interface GitSyncSettings {
    repoUrl: string;
    auth: GitSyncAuth;
    author: GitSyncAuthor;
}

export interface GitSyncAuth {
    username: string;
    password: string;
}

export interface GitSyncAuthor {
    name: string;
    email: string;
}

export class MockSettingsProvider implements SettingsProvider {
    settings: GitSyncSettings;

    constructor(settings?: GitSyncSettings) {
        this.settings = settings;
    }

    async register(): Promise<void> {
    }

    async load(): Promise<GitSyncSettings> {
        return this.settings;
    }

}

export class JoplinSettingsProvider implements SettingsProvider {
    private readonly joplin: Joplin;

    constructor(joplin: Joplin) { this.joplin = joplin; }

    async register(): Promise<void> {
        await this.joplin.settings.registerSection("gitsync", {
            label: "Git Sync",
            iconName: "fas fa-code-branch",
        });

        await this.joplin.settings.registerSettings({
            [SETTING.REPO_URL]: {
                label: "Repository URL (HTTPS)",
                section: "gitsync",
                type: SettingItemType.String,
                value: "https://",
                public: true,
                description: "The HTTPS URL of the git repository to sync with, e.g. https://github.com/user/repo.git",
            },
            [SETTING.USERNAME]: {
                label: "Username",
                section: "gitsync",
                type: SettingItemType.String,
                value: "user",
                public: true,
                description: "A username for read/write access to the repository.",
            },
            [SETTING.PASSWORD]: {
                label: "Password",
                section: "gitsync",
                type: SettingItemType.String,
                value: "*****",
                secure: true,
                public: true,
                description: "A password for the user. Stored securely.",
            },
            [SETTING.AUTHOR_NAME]: {
                label: "Author name",
                section: "gitsync",
                type: SettingItemType.String,
                value: "User",
                public: true,
                description: "Author name used for git commits.",
            },
            [SETTING.AUTHOR_EMAIL]: {
                label: "Author email",
                section: "gitsync",
                type: SettingItemType.String,
                value: "gitsync@joplinapp.org",
                public: true,
                description: "Author email used for git commits.",
            },
        });
    }

    async load(): Promise<GitSyncSettings> {
        const values = await this.joplin.settings.values(Object.values(SETTING));
        return {
            repoUrl: values["gitsync.REPO_URL"],
            auth: {
                username: values["gitsync.USERNAME"],
                password: values["gitsync.PASSWORD"],
            },
            author: {
                name: values["gitsync.AUTHOR_NAME"],
                email: values["gitsync.AUTHOR_EMAIL"],
            },
        }
    }
}
