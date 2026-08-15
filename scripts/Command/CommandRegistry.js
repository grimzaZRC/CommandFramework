/**
 * CommandRegistry
 *
 * A chat-command framework for the Bedrock Script API: register commands
 * with typed, validated parameters and optional nested subcommands, and
 * this handles prefix detection, tokenizing (with quoted-string support),
 * argument parsing, permission checks, and usage/help messages.
 *
 * @author (grimza_zrc)
 * @license MIT
 */
import { Player, world } from '@minecraft/server';
import { tokenize } from './tokenize.js';
import { ArgumentTypes, ArgumentParseError } from './ArgumentTypes.js';

class CommandRegistry {
    /** @type {Map<string, object>} lowercase name/alias -> command definition */
    #lookup = new Map();
    /** @type {object[]} definitions in registration order, for help listing */
    #topLevel = [];
    /** @type {Record<string, {parse: (token: string) => any}>} */
    #argumentTypes;
    #prefix;

    /**
     * @param {{ prefix?: string, registerHelpCommand?: boolean }} [options]
     */
    constructor(options = {}) {
        this.#prefix = options.prefix ?? '!';
        this.#argumentTypes = { ...ArgumentTypes };

        world.beforeEvents.chatSend.subscribe((event) => this.#onChatSend(event));

        if (options.registerHelpCommand !== false) {
            this.#registerHelpCommand();
        }
    }

    /**
     * Registers a top-level command.
     * @param {object} definition See README for the full shape.
     */
    register(definition) {
        this.#validateDefinition(definition, []);
        this.#index(definition);
        this.#topLevel.push(definition);
        return this;
    }

    /**
     * Adds a custom argument type usable in any command's `params`.
     * @param {string} name
     * @param {(token: string) => any} parse Throw ArgumentParseError on invalid input.
     */
    registerArgumentType(name, parse) {
        this.#argumentTypes[name] = { parse };
        return this;
    }

    // --- internals ---------------------------------------------------------

    #index(definition) {
        const names = [definition.name, ...(definition.aliases ?? [])];
        for (const name of names) {
            const key = name.toLowerCase();
            if (this.#lookup.has(key)) {
                throw new Error(`CommandRegistry: "${name}" is already registered.`);
            }
            this.#lookup.set(key, definition);
        }
    }

    #validateDefinition(definition, path) {
        if (!definition.name) throw new Error('CommandRegistry: command definition is missing "name".');
        const hasSub = definition.subcommands?.length > 0;
        const hasExec = typeof definition.execute === 'function';
        if (!hasSub && !hasExec) {
            throw new Error(
                `CommandRegistry: "${[...path, definition.name].join(' ')}" needs either "execute" or "subcommands".`
            );
        }
        for (const sub of definition.subcommands ?? []) {
            this.#validateDefinition(sub, [...path, definition.name]);
        }
    }

    #onChatSend(event) {
        const player = event.sender;
        if (!(player instanceof Player)) return;

        const message = event.message;
        if (!message.startsWith(this.#prefix)) return;

        event.cancel = true;

        let tokens;
        try {
            tokens = tokenize(message.slice(this.#prefix.length));
        } catch (err) {
            player.sendMessage(`§c${err.message}`);
            return;
        }
        if (tokens.length === 0) return;

        const [commandName, ...rest] = tokens;
        const definition = this.#lookup.get(commandName.toLowerCase());
        if (!definition) {
            player.sendMessage(`§cUnknown command "${commandName}". Try ${this.#prefix}help.`);
            return;
        }

        this.#dispatch(definition, rest, player, [commandName]);
    }

    #dispatch(definition, tokens, player, path) {
        if (definition.requiresTag && !player.hasTag(definition.requiresTag)) {
            player.sendMessage("§cYou don't have permission to use this command.");
            return;
        }

        if (definition.subcommands?.length) {
            const [subName, ...rest] = tokens;

            if (subName === undefined) {
                if (typeof definition.execute === 'function') {
                    this.#invoke(definition, {}, player);
                } else {
                    player.sendMessage(this.#usageFor(definition, path));
                }
                return;
            }

            const sub = definition.subcommands.find(
                (s) => s.name.toLowerCase() === subName.toLowerCase() || s.aliases?.some((a) => a.toLowerCase() === subName.toLowerCase())
            );
            if (!sub) {
                player.sendMessage(`§cUnknown subcommand "${subName}".`);
                player.sendMessage(this.#usageFor(definition, path));
                return;
            }

            this.#dispatch(sub, rest, player, [...path, sub.name]);
            return;
        }

        let args;
        try {
            args = this.#parseParams(definition.params ?? [], tokens, player);
        } catch (err) {
            // Any error during parsing is treated as a user-input problem
            // (built-in types throw ArgumentParseError; custom types
            // registered via registerArgumentType may throw plain Error).
            player.sendMessage(`§c${err.message ?? err}`);
            player.sendMessage(this.#usageFor(definition, path));
            return;
        }

        this.#invoke(definition, args, player);
    }

    #invoke(definition, args, player) {
        try {
            definition.execute({ sender: player, dimension: player.dimension, location: player.location }, args);
        } catch (err) {
            player.sendMessage(`§cCommand failed: ${err}`);
        }
    }

    #parseParams(params, tokens, player) {
        const result = {};
        let idx = 0;

        for (const param of params) {
            if (param.type === 'location') {
                const chunk = tokens.slice(idx, idx + 3);
                if (chunk.length < 3) {
                    if (Object.prototype.hasOwnProperty.call(param, 'default')) {
                        result[param.name] = param.default;
                        continue;
                    }
                    throw new ArgumentParseError(`Missing coordinates for "${param.name}" (expected x y z).`);
                }
                result[param.name] = this.#parseLocation(chunk, player);
                idx += 3;
                continue;
            }

            const token = tokens[idx];
            if (token === undefined) {
                if (Object.prototype.hasOwnProperty.call(param, 'default')) {
                    result[param.name] = param.default;
                    continue;
                }
                throw new ArgumentParseError(`Missing required argument "${param.name}".`);
            }

            let value;
            if (param.type === 'player') {
                value = this.#resolvePlayer(token);
                if (!value) throw new ArgumentParseError(`No player found named "${token}".`);
            } else {
                const handler = this.#argumentTypes[param.type];
                if (!handler) throw new Error(`CommandRegistry: unknown argument type "${param.type}".`);
                value = handler.parse(token);
            }

            if (param.choices && !param.choices.includes(value)) {
                throw new ArgumentParseError(`"${token}" must be one of: ${param.choices.join(', ')}.`);
            }

            result[param.name] = value;
            idx++;
        }

        return result;
    }

    #parseLocation([xt, yt, zt], player) {
        const base = player.location;
        const parseAxis = (token, baseValue) => {
            if (token.startsWith('~')) {
                const rest = token.slice(1);
                const offset = rest === '' ? 0 : Number(rest);
                if (Number.isNaN(offset)) throw new ArgumentParseError(`Invalid relative coordinate "${token}".`);
                return baseValue + offset;
            }
            const n = Number(token);
            if (Number.isNaN(n)) throw new ArgumentParseError(`Invalid coordinate "${token}".`);
            return n;
        };

        return {
            x: parseAxis(xt, base.x),
            y: parseAxis(yt, base.y),
            z: parseAxis(zt, base.z),
        };
    }

    #resolvePlayer(name) {
        for (const p of world.getAllPlayers()) {
            if (p.name.toLowerCase() === name.toLowerCase()) return p;
        }
        return undefined;
    }

    #usageFor(definition, path) {
        if (definition.subcommands?.length) {
            const names = definition.subcommands.map((s) => s.name).join(' | ');
            return `§7Usage: ${this.#prefix}${path.join(' ')} <${names}>`;
        }
        const paramText = (definition.params ?? [])
            .map((p) => (Object.prototype.hasOwnProperty.call(p, 'default') ? `[${p.name}]` : `<${p.name}>`))
            .join(' ');
        return `§7Usage: ${this.#prefix}${path.join(' ')}${paramText ? ' ' + paramText : ''}`;
    }

    #registerHelpCommand() {
        this.register({
            name: 'help',
            description: 'Lists available commands.',
            execute: (ctx) => {
                const lines = this.#topLevel.map((d) => `§b${this.#prefix}${d.name}§7 - ${d.description ?? ''}`);
                ctx.sender.sendMessage(['§l§bCommands:', ...lines].join('\n'));
            },
        });
    }
}

export { CommandRegistry };
