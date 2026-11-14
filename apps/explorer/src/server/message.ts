/** What a failure says, for a refusal or the status read. */
export const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
