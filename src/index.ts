import joplin from "api";
import { JoplinSettingsProvider } from "./joplin-settings";
import { JoplinDatabase } from "./joplin-database";

joplin.plugins.register({
    onStart: async function () {
        console.info("Hello gitsync user!");

        const settingsProvider = new JoplinSettingsProvider(joplin);
        await settingsProvider.register();

        const database = new JoplinDatabase(joplin);
        const notes = await database.getAllNotes();
        console.log("notes:", notes);
    },
});
