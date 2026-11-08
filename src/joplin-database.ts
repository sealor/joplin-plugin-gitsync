import type Joplin from "api/Joplin";


export interface Database {
    getAllNotes(): Promise<Note[]>;
}


export interface Response {
    items: Note[];
    has_more: boolean;
}

export interface Note {
    id: string;
    title: string;
    body: string;
}


export class MockDatabase implements Database {
    notes: Note[];

    constructor(notes: Note[]) {
        this.notes = notes;
    }

    async getAllNotes(): Promise<Note[]> {
        return this.notes;
    }
}

export class JoplinDatabase implements Database {
    constructor(private readonly joplin: Joplin) { }

    async getAllNotes(): Promise<Note[]> {
        const response: Response = await this.joplin.data.get(['notes'], { fields: ["id", "title", "body"] });
        return response.items;
    }

}
