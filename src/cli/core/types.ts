export type CliArgs = Record<string, string | boolean>;

export type SourceMode = 'All' | 'Staged' | 'Unstaged' | 'Commit';

export interface OnecConnection {
  infoBasePath: string;
  infoBaseServer: string;
  infoBaseRef: string;
  userName: string;
  password: string;
  v8Path: string;
}
