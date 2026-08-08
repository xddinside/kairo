import { Schema } from "effect";

const uuid = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)),
);
const title = Schema.String;
const markdown = Schema.String;
const version = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)));
const idempotencyKey = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)));

/** Input for creating a Note. */
export const CreateNote = Schema.Struct({
  title,
  bodyMarkdown: Schema.optionalKey(markdown),
  courseId: Schema.optionalKey(Schema.NullOr(uuid)),
  idempotencyKey,
});

/** Decoded Note creation input. */
export interface CreateNote extends Schema.Schema.Type<typeof CreateNote> {}

/** Input for replacing a Note's editable fields. */
export const UpdateNote = Schema.Struct({
  noteId: uuid,
  expectedVersion: version,
  title,
  bodyMarkdown: markdown,
  courseId: Schema.NullOr(uuid),
  idempotencyKey,
});

/** Decoded Note update input. */
export interface UpdateNote extends Schema.Schema.Type<typeof UpdateNote> {}

/** Input for deleting a Note. */
export const DeleteNote = Schema.Struct({
  noteId: uuid,
  expectedVersion: version,
  idempotencyKey,
});

/** Decoded Note deletion input. */
export interface DeleteNote extends Schema.Schema.Type<typeof DeleteNote> {}

/** Input for consuming a Note Undo token. */
export const UndoNoteCommand = Schema.Struct({
  token: Schema.String.pipe(Schema.check(Schema.isMinLength(32), Schema.isMaxLength(256))),
  idempotencyKey,
});

/** Decoded Note Undo input. */
export interface UndoNoteCommand extends Schema.Schema.Type<typeof UndoNoteCommand> {}

/** Sort order supported by the Notes collection. */
export type NoteSort = "updated_desc" | "created_desc" | "title_asc";

/** A current Course available to Note forms. */
export interface NoteCourseOption {
  readonly id: string;
  readonly title: string;
}

/** Full Note projected to route and Canvas consumers. */
export interface Note {
  readonly id: string;
  readonly title: string;
  readonly bodyMarkdown: string;
  readonly courseId: string | null;
  readonly courseTitle: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Lightweight Note projection for the collection route. */
export interface NoteListItem extends Omit<Note, "bodyMarkdown"> {
  readonly preview: string;
}

/** Field-level validation failure returned by a Note command. */
export interface NoteFieldError {
  readonly field: string;
  readonly message: string;
}

/** Result returned by every Note mutation. */
export type NoteCommandResult =
  | { readonly _tag: "applied" | "already_applied"; readonly value: Note | null; readonly undoToken?: string }
  | { readonly _tag: "conflict"; readonly current?: Note }
  | { readonly _tag: "not_found" }
  | { readonly _tag: "invalid"; readonly fields: ReadonlyArray<NoteFieldError> };

/** Normalize Note Markdown before validation and persistence. */
export const normalizeMarkdown = (value: string): string => value.replace(/\r\n?/g, "\n");

/** Return the UTF-8 byte size used by the Note persistence limit. */
export const markdownByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

/** Validate normalized Note fields that cannot be represented by string length alone. */
export const validateNote = (value: { readonly title: string; readonly bodyMarkdown: string }): ReadonlyArray<NoteFieldError> => {
  const errors: Array<NoteFieldError> = [];
  if (value.title.trim().length === 0) errors.push({ field: "title", message: "Enter a title" });
  else if ([...value.title].length > 160) errors.push({ field: "title", message: "Title must be 160 characters or less" });
  if (markdownByteLength(value.bodyMarkdown) > 200_000) errors.push({ field: "bodyMarkdown", message: "Markdown must be 200 KB or less" });
  return errors;
};

/** Produce the plain-text collection preview without rendering or returning HTML. */
export const notePreview = (markdownValue: string): string => markdownValue
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/`([^`]*)`/g, "$1")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/<[^>]*>/g, " ")
  .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, "")
  .replace(/[\n\t ]+/g, " ")
  .trim()
  .slice(0, 240);
