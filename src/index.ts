import joplin from "api";
import { JoplinSettingsProvider } from "./joplin-settings";

joplin.plugins.register({
    onStart: async function () {
        console.info("Hello gitsync user!");

        const settingsProvider = new JoplinSettingsProvider(joplin);
        await settingsProvider.register();

        const notes: Response = await joplin.data.get(['notes'], { fields: ["id", "title", "body"] });
        console.log("notes:", notes);
    },
});
