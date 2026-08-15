import { Dimension, Player } from "@minecraft/server";

export type ArgumentType = 'string' | 'int' | 'float' | 'boolean' | 'player' | 'location' | string;

export interface LocationValue {
    x: number;
    y: number;
    z: number;
}

export interface CommandParam {
    name: string;
    type: ArgumentType;
    /** If present, the param is optional and this value is used when omitted. */
    default?: unknown;
    /** Restrict the parsed value to one of these. */
    choices?: unknown[];
}

export interface CommandContext {
    sender: Player;
    dimension: Dimension;
    location: { x: number; y: number; z: number };
}

export interface CommandDefinition {
    name: string;
    aliases?: string[];
    description?: string;
    /** Player must have this tag (player.hasTag(...)) to run the command. */
    requiresTag?: string;
    /** Leaf commands parse these params from the remaining tokens. */
    params?: CommandParam[];
    /** Group commands route to one of these based on the next token. */
    subcommands?: CommandDefinition[];
    /** Required for leaf commands; optional fallback for group commands called with no subcommand. */
    execute?: (ctx: CommandContext, args: Record<string, any>) => void;
}

export interface CommandRegistryOptions {
    /** Chat prefix that triggers command parsing. Default '!'. */
    prefix?: string;
    /** Whether to auto-register a `help` command listing top-level commands. Default true. */
    registerHelpCommand?: boolean;
}

export declare class CommandRegistry {
    constructor(options?: CommandRegistryOptions);

    /** Registers a top-level command (or command group with subcommands). */
    register(definition: CommandDefinition): this;

    /** Adds a custom argument type usable in any command's `params`. */
    registerArgumentType(name: string, parse: (token: string) => unknown): this;
}
