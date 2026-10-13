export type MemberFormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
      created?: { name: string; email: string; password: string };
    }
  | undefined;

export type PasswordResetState = { error?: string; password?: string } | undefined;

export type AccountFormState = { error?: string; ok?: boolean } | undefined;
